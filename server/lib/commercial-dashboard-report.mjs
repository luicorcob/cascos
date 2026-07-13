import {
  buildCommercialForecast,
  FORECAST_STATUS_ORDER,
  normalizeForecastMonth
} from "./commercial-forecast.mjs";
import {
  buildCommercialSla,
  isMeaningfulCommercialActivity
} from "./commercial-sla.mjs";

export const COMMERCIAL_LOST_REASONS = Object.freeze([
  "precio",
  "no_responde",
  "ya_tiene_proveedor",
  "fuera_de_zona",
  "pospuesto",
  "no_encaja",
  "competencia"
]);

const LOST_REASON_LABELS = Object.freeze({
  precio: "Precio",
  no_responde: "No responde",
  ya_tiene_proveedor: "Ya tiene proveedor",
  fuera_de_zona: "Fuera de zona",
  pospuesto: "Pospuesto",
  no_encaja: "No encaja",
  competencia: "Competencia"
});
const CUSTOMER_STATUSES = new Set(["customer", "won"]);
const SENT_PROPOSAL_STATUSES = new Set(["enviada", "sent"]);
const ACCEPTED_PROPOSAL_STATUSES = new Set(["aceptada", "accepted"]);
const PROPOSAL_LIFECYCLE_TYPES = new Set([
  "proposal.created",
  "proposal.status_changed",
  "proposal.sent",
  "proposal.accepted"
]);

/**
 * Builds the single commercial reporting payload while delegating forecast and
 * SLA calculations to their canonical builders. Event metrics use an
 * inclusive/exclusive UTC month range so results do not depend on server
 * timezone.
 */
export function buildCommercialDashboardReport(db, business, options = {}) {
  const now = validDate(options.now) || new Date();
  const month = normalizeForecastMonth(options.month, now);
  const period = utcMonthRange(month);
  const businessId = clean(business?.id);
  const contacts = collection(db, "contacts")
    .filter((contact) => contact?.businessId === businessId && !contact?.merged);
  const activities = collection(db, "activities")
    .filter((activity) => activity?.businessId === businessId);
  const proposals = collection(db, "proposals")
    .filter((proposal) => proposal?.businessId === businessId);
  const bookings = collection(db, "bookings")
    .filter((booking) => booking?.businessId === businessId);

  const periodLeads = contacts
    .filter(isLeadContact)
    .filter((contact) => isInRange(contact?.createdAt, period));
  const leadsBySource = groupedCounts(periodLeads, (contact) => normalizeSource(contact?.source), "source");
  const conversionByStatus = buildConversionByStatus(contacts);
  const completedActivities = buildCompletedActivities(activities, period);
  const proposalMetrics = buildProposalMetrics(proposals, activities, period);
  const convertedBookings = buildConvertedBookingMetrics(bookings, contacts, period);
  const customers = contacts.filter(isCustomerContact).length;
  const forecast = buildCommercialForecast(db, business, { month, now });
  const sla = buildCommercialSla(db, business, { hours: options.hours, now });
  const lostReasons = buildCommercialLostReasons(db, business);

  return {
    business: {
      id: businessId,
      slug: clean(business?.slug),
      name: clean(business?.name)
    },
    generatedAt: now.toISOString(),
    period: {
      month,
      from: period.from.toISOString(),
      to: period.to.toISOString()
    },
    counts: {
      contacts: contacts.length,
      leadsCreated: periodLeads.length,
      customers,
      activitiesCompleted: completedActivities.total,
      proposalsSent: proposalMetrics.sent,
      proposalsAccepted: proposalMetrics.accepted,
      bookingsConvertedToCustomer: convertedBookings.total
    },
    leadsBySource: withPercentages(leadsBySource, periodLeads.length),
    conversionByStatus,
    activities: completedActivities,
    proposals: proposalMetrics,
    convertedBookings,
    forecast,
    sla,
    lostReasons
  };
}

/**
 * Canonical lost-reason report shared by the dedicated and aggregate routes.
 * Merged legacy records remain included to preserve the existing endpoint's
 * historical definition.
 */
export function buildCommercialLostReasons(db, business) {
  const businessId = clean(business?.id);
  const lostContacts = collection(db, "contacts")
    .filter((contact) => contact?.businessId === businessId)
    .filter((contact) => String(contact?.status || "").toLowerCase() === "lost");
  const counts = new Map();

  lostContacts.forEach((contact) => {
    const reason = normalizeLostReason(contact?.lostReason) || "sin_motivo";
    counts.set(reason, (counts.get(reason) || 0) + 1);
  });

  return {
    business: {
      id: business?.id,
      slug: business?.slug,
      name: business?.name
    },
    total: lostContacts.length,
    reasons: COMMERCIAL_LOST_REASONS.map((reason) => ({
      reason,
      label: LOST_REASON_LABELS[reason],
      count: counts.get(reason) || 0
    })),
    legacyMissing: counts.get("sin_motivo") || 0
  };
}

function buildConversionByStatus(contacts) {
  const counts = new Map(FORECAST_STATUS_ORDER.map((status) => [status, 0]));

  contacts.forEach((contact) => {
    const status = normalizeStatus(contact?.status, contact?.type);
    counts.set(status, (counts.get(status) || 0) + 1);
  });

  return FORECAST_STATUS_ORDER.map((status) => ({
    status,
    count: counts.get(status) || 0,
    percentage: percentage(counts.get(status) || 0, contacts.length)
  }));
}

function buildCompletedActivities(activities, period) {
  const completed = activities
    .filter(isMeaningfulCommercialActivity)
    .filter((activity) => isInRange(activity?.createdAt, period));

  return {
    total: completed.length,
    byType: groupedCounts(completed, (activity) => clean(activity?.type).toLowerCase(), "type")
  };
}

function buildProposalMetrics(proposals, activities, period) {
  const sent = new Set();
  const accepted = new Set();
  const proposalsWithLifecycle = new Set();

  activities.forEach((activity) => {
    const type = clean(activity?.type).toLowerCase();
    if (!PROPOSAL_LIFECYCLE_TYPES.has(type)) {
      return;
    }

    const proposalId = proposalIdFromActivity(activity);
    if (proposalId) {
      proposalsWithLifecycle.add(proposalId);
    }
    if (!isInRange(activity?.createdAt, period)) {
      return;
    }

    const key = proposalId || `activity:${clean(activity?.id) || activityEventKey(activity)}`;
    const status = normalizeProposalStatus(
      activity?.metadata?.status
      || activity?.detail?.status
      || activity?.status
    );

    if (type === "proposal.sent" || SENT_PROPOSAL_STATUSES.has(status)) {
      sent.add(key);
    }
    if (type === "proposal.accepted" || ACCEPTED_PROPOSAL_STATUSES.has(status)) {
      accepted.add(key);
    }
  });

  // Legacy proposal rows can predate lifecycle activities. Only those records
  // use their latest stored timestamp as a conservative fallback.
  proposals.forEach((proposal) => {
    const proposalId = clean(proposal?.id);
    if (proposalId && proposalsWithLifecycle.has(proposalId)) {
      return;
    }
    if (!isInRange(proposal?.updatedAt || proposal?.createdAt, period)) {
      return;
    }

    const key = proposalId || `proposal:${proposalRecordKey(proposal)}`;
    const status = normalizeProposalStatus(proposal?.status);
    if (SENT_PROPOSAL_STATUSES.has(status)) {
      sent.add(key);
    }
    if (ACCEPTED_PROPOSAL_STATUSES.has(status)) {
      accepted.add(key);
    }
  });

  return {
    sent: sent.size,
    accepted: accepted.size
  };
}

function buildConvertedBookingMetrics(bookings, contacts, period) {
  const contactById = new Map(contacts.map((contact) => [clean(contact?.id), contact]));
  const customerContacts = contacts.filter(isCustomerContact);
  const contactByEmail = firstByIdentity(customerContacts, (contact) => normalizeEmail(contact?.email));
  const contactByPhone = firstByIdentity(customerContacts, (contact) => normalizePhone(contact?.phone));
  let linkedByContactId = 0;
  let linkedByIdentity = 0;

  bookings
    .filter((booking) => isInRange(booking?.startsAt || booking?.date || booking?.createdAt, period))
    .forEach((booking) => {
      const directId = clean(booking?.contactId || booking?.contact_id || booking?.customer?.contactId);
      const directContact = directId ? contactById.get(directId) : null;

      if (directContact) {
        if (isCustomerContact(directContact)) {
          linkedByContactId += 1;
        }
        return;
      }

      const email = normalizeEmail(booking?.email || booking?.customerEmail || booking?.customer?.email);
      if (email && contactByEmail.has(email)) {
        linkedByIdentity += 1;
        return;
      }

      const phone = normalizePhone(booking?.phone || booking?.customerPhone || booking?.customer?.phone);
      if (phone && contactByPhone.has(phone)) {
        linkedByIdentity += 1;
      }
    });

  return {
    total: linkedByContactId + linkedByIdentity,
    linkedByContactId,
    linkedByIdentity
  };
}

function utcMonthRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return {
    month,
    from: new Date(Date.UTC(year, monthNumber - 1, 1)),
    to: new Date(Date.UTC(year, monthNumber, 1))
  };
}

function isInRange(value, period) {
  const date = validDate(value);
  return Boolean(date && date >= period.from && date < period.to);
}

function groupedCounts(items, getKey, property) {
  const counts = new Map();
  items.forEach((item) => {
    const key = clean(getKey(item)) || "sin-dato";
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([key, count]) => ({ [property]: key, count }))
    .sort((left, right) => right.count - left.count || left[property].localeCompare(right[property]));
}

function withPercentages(rows, total) {
  return rows.map((row) => ({
    ...row,
    percentage: percentage(row.count, total)
  }));
}

function percentage(value, total) {
  return total ? round((value / total) * 100, 2) : 0;
}

function normalizeStatus(value, type) {
  const status = clean(value).toLowerCase();
  if (FORECAST_STATUS_ORDER.includes(status)) {
    return status;
  }
  return clean(type).toLowerCase() === "customer" ? "customer" : "new";
}

function isCustomerContact(contact) {
  return clean(contact?.type).toLowerCase() === "customer"
    || CUSTOMER_STATUSES.has(normalizeStatus(contact?.status, contact?.type));
}

function isLeadContact(contact) {
  return clean(contact?.type).toLowerCase() !== "customer";
}

function normalizeSource(value) {
  return clean(value).toLowerCase() || "manual";
}

function normalizeLostReason(value) {
  const reason = clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return COMMERCIAL_LOST_REASONS.includes(reason) ? reason : "";
}

function normalizeProposalStatus(value) {
  return clean(value).toLowerCase();
}

function proposalIdFromActivity(activity) {
  return clean(
    activity?.proposalId
    || activity?.proposal_id
    || activity?.metadata?.proposalId
    || activity?.metadata?.proposal_id
    || activity?.detail?.proposalId
    || activity?.detail?.proposal_id
  );
}

function activityEventKey(activity) {
  return [activity?.type, activity?.contactId, activity?.createdAt].map(clean).join("|");
}

function proposalRecordKey(proposal) {
  return [proposal?.contactId, proposal?.status, proposal?.updatedAt, proposal?.createdAt].map(clean).join("|");
}

function firstByIdentity(contacts, getIdentity) {
  const byIdentity = new Map();
  contacts.forEach((contact) => {
    const identity = getIdentity(contact);
    if (identity && !byIdentity.has(identity)) {
      byIdentity.set(identity, contact);
    }
  });
  return byIdentity;
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function normalizePhone(value) {
  const digits = clean(value).replace(/\D+/g, "");
  return digits.length >= 6 ? digits : "";
}

function collection(db, key) {
  return Array.isArray(db?.[key]) ? db[key] : [];
}

function validDate(value) {
  const date = value instanceof Date ? value : new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
}

function clean(value) {
  return String(value ?? "").trim();
}
