import {
  buildCompletedBookingReviewSuggestion,
  isHumanCrmActivity
} from "./crm-automation.mjs";

const DEFAULT_TIMEZONE = "Europe/Madrid";
const DEFAULT_STALE_CUSTOMER_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
const PENDING_PROPOSAL_STATUSES = new Set(["enviada", "vista"]);
const CLOSED_BOOKING_STATUSES = new Set(["canceled", "cancelled", "no-show"]);
const CUSTOMER_STATUSES = new Set(["customer", "won"]);

const SECTION_DEFINITIONS = [
  { key: "overdueActions", label: "Actividades vencidas", priority: 600 },
  { key: "newLeads", label: "Leads nuevos", priority: 500 },
  { key: "todayBookings", label: "Reservas de hoy", priority: 450 },
  { key: "pendingProposals", label: "Propuestas pendientes", priority: 400 },
  { key: "staleCustomers", label: "Clientes sin seguimiento", priority: 300 },
  { key: "reviewSuggestions", label: "Sugerencias de reseña", priority: 250 }
];

export function buildCommercialInbox(db, business, options = {}) {
  const businessId = clean(business?.id);
  if (!businessId) {
    throw new TypeError("business.id is required");
  }

  const now = validDate(options.now) || new Date();
  const timezone = normalizeInboxTimezone(options.timezone || resolveInboxTimezone(options.env));
  const staleCustomerDays = normalizeStaleCustomerDays(options.staleCustomerDays);
  const todayKey = zonedDateKey(now, timezone);
  const contacts = uniqueRecords(
    collection(db, "contacts").filter((contact) => contact?.businessId === businessId && !contact?.merged),
    (contact) => clean(contact?.id)
  ).filter((contact) => clean(contact?.id));
  const activities = uniqueRecords(
    collection(db, "activities").filter((activity) => activity?.businessId === businessId),
    (activity) => clean(activity?.id) || activityIdentity(activity)
  );
  const bookings = uniqueRecords(
    collection(db, "bookings").filter((booking) => booking?.businessId === businessId),
    (booking) => clean(booking?.id) || bookingIdentity(booking)
  );
  const proposals = uniqueRecords(
    collection(db, "proposals").filter((proposal) => proposal?.businessId === businessId),
    (proposal) => clean(proposal?.id)
  ).filter((proposal) => clean(proposal?.id));
  const contactById = new Map(contacts.map((contact) => [clean(contact.id), contact]));
  const activitiesByContact = groupActivitiesByContact(activities);

  const itemsBySection = {
    newLeads: buildNewLeadItems(contacts),
    overdueActions: buildOverdueActionItems(contacts, todayKey, timezone),
    todayBookings: buildTodayBookingItems(bookings, contacts, todayKey, timezone),
    pendingProposals: buildPendingProposalItems(proposals, contactById, now, timezone),
    staleCustomers: buildStaleCustomerItems(contacts, activitiesByContact, todayKey, timezone, staleCustomerDays, now),
    reviewSuggestions: buildReviewSuggestionItems(bookings, contacts, business, now, todayKey, timezone)
  };

  const sections = SECTION_DEFINITIONS
    .map((definition) => {
      const items = dedupeItems(itemsBySection[definition.key] || []).sort(compareInboxItems);
      return {
        ...definition,
        count: items.length,
        items
      };
    })
    .sort((left, right) => {
      const leftUrgency = left.items[0]?.urgency ?? left.priority;
      const rightUrgency = right.items[0]?.urgency ?? right.priority;
      return rightUrgency - leftUrgency || right.priority - left.priority || left.key.localeCompare(right.key);
    });

  return {
    business: {
      id: businessId,
      slug: clean(business?.slug),
      name: clean(business?.name)
    },
    generatedAt: now.toISOString(),
    timezone,
    staleCustomerDays,
    total: sections.reduce((total, section) => total + section.count, 0),
    sections
  };
}

export function compareInboxItems(left, right) {
  const urgency = Number(right?.urgency || 0) - Number(left?.urgency || 0);
  if (urgency) {
    return urgency;
  }

  const rightTime = dateTimestamp(right?.date);
  const leftTime = dateTimestamp(left?.date);
  return rightTime - leftTime || clean(left?.id).localeCompare(clean(right?.id));
}

export function normalizeStaleCustomerDays(value, fallback = DEFAULT_STALE_CUSTOMER_DAYS) {
  if (value === undefined || value === null || clean(value) === "") {
    return fallback;
  }

  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw new RangeError("staleCustomerDays must be an integer between 1 and 3650");
  }

  return days;
}

export function normalizeInboxTimezone(value, fallback = DEFAULT_TIMEZONE) {
  const timezone = clean(value) || fallback;

  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date(0));
    return timezone;
  } catch {
    if (timezone !== fallback) {
      return normalizeInboxTimezone(fallback, DEFAULT_TIMEZONE);
    }
    return DEFAULT_TIMEZONE;
  }
}

export function resolveInboxTimezone(env = process.env) {
  return normalizeInboxTimezone(
    env?.CRM_TIMEZONE
      || env?.BUSINESS_TIMEZONE
      || env?.TZ
      || DEFAULT_TIMEZONE
  );
}

export function zonedDateKey(value, timezone = DEFAULT_TIMEZONE) {
  const date = validDate(value);
  if (!date) {
    return "";
  }

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeInboxTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function buildNewLeadItems(contacts) {
  return contacts
    .filter((contact) => !isCustomer(contact) && normalizeStatus(contact.status) === "new")
    .map((contact) => ({
      id: `lead:${contact.id}`,
      type: "lead.new",
      urgency: 500,
      date: firstIso(contact.createdAt, contact.updatedAt, contact.lastInteractionAt),
      title: contactName(contact),
      summary: clean(contact.source) ? `Origen: ${clean(contact.source)}` : "Lead pendiente de primer contacto",
      refId: clean(contact.id),
      contactId: clean(contact.id),
      status: "new",
      contact: contactSummary(contact)
    }));
}

function buildOverdueActionItems(contacts, todayKey, timezone) {
  return contacts.flatMap((contact) => {
    const action = isPlainObject(contact.nextAction) ? contact.nextAction : null;
    const status = normalizeStatus(action?.status);
    const dueDate = validDate(action?.dueDate);
    const dueKey = zonedDateKey(dueDate, timezone);

    if (!action || !dueDate || !dueKey || dueKey >= todayKey || !["pendiente", "vencida", "pending", "overdue"].includes(status)) {
      return [];
    }

    const overdueDays = Math.max(1, calendarDayDifference(dueKey, todayKey));
    return [{
      id: `next-action:${contact.id}`,
      type: "next_action.overdue",
      urgency: 600 + Math.min(overdueDays, 99),
      date: dueDate.toISOString(),
      title: contactName(contact),
      summary: clean(action.note) || `Acción pendiente: ${clean(action.type || "seguimiento")}`,
      refId: clean(contact.id),
      contactId: clean(contact.id),
      status: "vencida",
      contact: contactSummary(contact),
      details: {
        actionType: clean(action.type),
        dueDate: dueDate.toISOString(),
        overdueDays
      }
    }];
  });
}

function buildTodayBookingItems(bookings, contacts, todayKey, timezone) {
  return bookings
    .filter((booking) => !CLOSED_BOOKING_STATUSES.has(normalizeStatus(booking.status)))
    .filter((booking) => zonedDateKey(booking.startsAt || booking.date, timezone) === todayKey)
    .map((booking) => {
      const date = firstIso(booking.startsAt, booking.date);
      const status = normalizeStatus(booking.status || "pending");
      const contact = findContactForRecord(booking, contacts);
      const statusUrgency = status === "pending" ? 20 : status === "confirmed" ? 10 : 0;
      return {
        id: `booking:${recordId(booking, bookingIdentity(booking))}`,
        type: "booking.today",
        urgency: 450 + statusUrgency,
        date,
        title: clean(booking.serviceName || booking.service || "Reserva"),
        summary: bookingCustomerName(booking, contact),
        refId: clean(booking.id),
        contactId: clean(contact?.id),
        status,
        contact: contactSummary(contact || contactPreview(booking)),
        details: {
          startsAt: date,
          serviceName: clean(booking.serviceName || booking.service),
          notes: clean(booking.notes)
        }
      };
    });
}

function buildPendingProposalItems(proposals, contactById, now, timezone) {
  return proposals
    .filter((proposal) => PENDING_PROPOSAL_STATUSES.has(normalizeStatus(proposal.status)))
    .filter((proposal) => {
      const expiresAt = validDate(proposal.expiresAt);
      return expiresAt && expiresAt.getTime() > now.getTime();
    })
    .map((proposal) => {
      const expiresAt = validDate(proposal.expiresAt);
      const expiryKey = zonedDateKey(expiresAt, timezone);
      const todayKey = zonedDateKey(now, timezone);
      const daysUntilExpiry = Math.max(0, calendarDayDifference(todayKey, expiryKey));
      const status = normalizeStatus(proposal.status);
      const contact = contactById.get(clean(proposal.contactId)) || null;
      return {
        id: `proposal:${proposal.id}`,
        type: "proposal.pending",
        urgency: 400 + (status === "vista" ? 10 : 0) + Math.max(0, 30 - Math.min(daysUntilExpiry, 30)),
        date: firstIso(proposal.updatedAt, proposal.createdAt, proposal.expiresAt),
        title: contact ? contactName(contact) : "Propuesta pendiente",
        summary: `Paquete: ${clean(proposal.package || "custom")}`,
        refId: clean(proposal.id),
        contactId: clean(proposal.contactId),
        status,
        contact: contactSummary(contact),
        details: {
          package: clean(proposal.package),
          setupPrice: finiteNumber(proposal.setupPrice),
          monthlyPrice: finiteNumber(proposal.monthlyPrice),
          expiresAt: expiresAt.toISOString(),
          daysUntilExpiry
        }
      };
    });
}

function buildStaleCustomerItems(contacts, activitiesByContact, todayKey, timezone, staleCustomerDays, now) {
  return contacts.flatMap((contact) => {
    if (!isCustomer(contact)) {
      return [];
    }

    const activityDates = (activitiesByContact.get(clean(contact.id)) || [])
      .filter(isHumanCrmActivity)
      .map((activity) => validDate(activity.createdAt || activity.date))
      .filter((date) => date && date.getTime() <= now.getTime());
    const candidates = [contact.lastInteractionAt, contact.createdAt]
      .map(validDate)
      .filter((date) => date && date.getTime() <= now.getTime())
      .concat(activityDates)
      .sort((left, right) => right.getTime() - left.getTime());
    const lastInteraction = candidates[0] || null;
    const lastKey = zonedDateKey(lastInteraction, timezone);
    const daysWithoutFollowUp = lastKey ? calendarDayDifference(lastKey, todayKey) : null;

    if (daysWithoutFollowUp !== null && daysWithoutFollowUp < staleCustomerDays) {
      return [];
    }

    return [{
      id: `customer:${contact.id}`,
      type: "customer.stale",
      urgency: 300 + (daysWithoutFollowUp === null
        ? 99
        : Math.min(Math.max(daysWithoutFollowUp - staleCustomerDays, 0), 99)),
      date: lastInteraction?.toISOString() || "",
      title: contactName(contact),
      summary: daysWithoutFollowUp === null
        ? "Sin seguimiento registrado"
        : `${daysWithoutFollowUp} días sin seguimiento`,
      refId: clean(contact.id),
      contactId: clean(contact.id),
      status: normalizeStatus(contact.status || "customer"),
      contact: contactSummary(contact),
      details: {
        lastInteractionAt: lastInteraction?.toISOString() || "",
        daysWithoutFollowUp
      }
    }];
  });
}

function buildReviewSuggestionItems(bookings, contacts, business, now, todayKey, timezone) {
  const reviewStore = { businesses: [business], contacts };
  const contactsById = new Map(contacts.map((contact) => [clean(contact.id), contact]));
  const candidates = bookings
    .map((booking) => {
      const suggestion = buildCompletedBookingReviewSuggestion(reviewStore, booking, { now, business });
      if (!suggestion) {
        return null;
      }

      const completedAt = validDate(suggestion.date);
      const completedKey = zonedDateKey(completedAt, timezone);
      const daysSinceCompletion = Math.max(0, calendarDayDifference(completedKey, todayKey));
      const canonicalContact = contactsById.get(clean(suggestion.contactId)) || suggestion.contact;
      const identity = reviewRecipientIdentity(suggestion.contact || booking, canonicalContact);
      return {
        identity,
        item: {
          id: suggestion.id,
          type: suggestion.type,
          urgency: 250 + Math.max(0, 30 - Math.min(daysSinceCompletion, 30)),
          date: suggestion.date,
          title: clean(suggestion.contact?.name) || "Cliente sin nombre",
          summary: "Pedir una reseña tras la reserva completada",
          refId: clean(suggestion.bookingId),
          contactId: clean(suggestion.contactId),
          status: "suggested",
          contact: contactSummary(canonicalContact || contactPreview(booking)),
          details: {
            bookingId: clean(suggestion.bookingId),
            serviceName: clean(booking.serviceName || booking.service),
            completedAt: suggestion.date,
            reviewUrl: clean(suggestion.reviewUrl),
            daysSinceCompletion
          }
        }
      };
    })
    .filter(Boolean)
    .sort((left, right) => compareInboxItems(left.item, right.item));

  const byRecipient = new Map();
  candidates.forEach(({ identity, item }) => {
    const key = identity || item.id;
    if (!byRecipient.has(key)) {
      byRecipient.set(key, item);
    }
  });
  return Array.from(byRecipient.values());
}

function groupActivitiesByContact(activities) {
  const grouped = new Map();
  activities.forEach((activity) => {
    const contactId = clean(activity.contactId || activity.contact_id);
    if (!contactId) {
      return;
    }
    if (!grouped.has(contactId)) {
      grouped.set(contactId, []);
    }
    grouped.get(contactId).push(activity);
  });
  return grouped;
}

function findContactForRecord(record, contacts) {
  const directId = clean(record?.contactId || record?.contact_id || record?.customer?.contactId);
  if (directId) {
    const direct = contacts.find((contact) => clean(contact.id) === directId);
    if (direct) {
      return direct;
    }
  }

  const recordEmail = normalizeEmail(record?.email || record?.customerEmail || record?.customer?.email);
  if (recordEmail) {
    const byEmail = contacts.find((contact) => normalizeEmail(contact.email) === recordEmail);
    if (byEmail) {
      return byEmail;
    }
  }

  const recordPhone = normalizePhone(record?.phone || record?.customerPhone || record?.customer?.phone);
  return recordPhone
    ? contacts.find((contact) => normalizePhone(contact.phone) === recordPhone) || null
    : null;
}

function contactSummary(contact) {
  if (!contact) {
    return null;
  }
  return {
    id: clean(contact.id),
    name: contactName(contact),
    phone: clean(contact.phone),
    email: clean(contact.email),
    status: normalizeStatus(contact.status),
    source: clean(contact.source)
  };
}

function contactPreview(record) {
  return {
    id: "",
    name: clean(record?.customerName || record?.name || record?.customer?.name || "Cliente sin nombre"),
    phone: clean(record?.phone || record?.customerPhone || record?.customer?.phone),
    email: clean(record?.email || record?.customerEmail || record?.customer?.email),
    status: "",
    source: clean(record?.source)
  };
}

function contactName(contact) {
  return clean(contact?.name || contact?.fullName || contact?.customerName || contact?.email || contact?.phone || "Contacto sin nombre");
}

function bookingCustomerName(booking, contact) {
  return contact
    ? contactName(contact)
    : clean(booking?.customerName || booking?.name || booking?.customer?.name || booking?.email || booking?.phone || "Cliente sin nombre");
}

function isCustomer(contact) {
  return clean(contact?.type).toLowerCase() === "customer"
    || CUSTOMER_STATUSES.has(normalizeStatus(contact?.status));
}

function reviewRecipientIdentity(booking, contact) {
  if (contact?.id) {
    return `contact:${contact.id}`;
  }
  const email = normalizeEmail(booking?.email || booking?.customerEmail || booking?.customer?.email);
  if (email) {
    return `email:${email}`;
  }
  const phone = normalizePhone(booking?.phone || booking?.customerPhone || booking?.customer?.phone);
  return phone ? `phone:${phone}` : "";
}

function dedupeItems(items) {
  const byId = new Map();
  items.forEach((item) => {
    const key = clean(item?.id);
    if (!key) {
      return;
    }
    const current = byId.get(key);
    if (!current || compareInboxItems(item, current) < 0) {
      byId.set(key, item);
    }
  });
  return Array.from(byId.values());
}

function uniqueRecords(items, getKey) {
  const records = new Map();
  items.forEach((item) => {
    const key = clean(getKey(item));
    if (!key) {
      return;
    }
    const current = records.get(key);
    if (!current || recordTimestamp(item) >= recordTimestamp(current)) {
      records.set(key, item);
    }
  });
  return Array.from(records.values());
}

function recordTimestamp(record) {
  return dateTimestamp(record?.updatedAt || record?.createdAt || record?.startsAt);
}

function activityIdentity(activity) {
  return [activity?.contactId, activity?.type, activity?.createdAt, activity?.note].map(clean).join("|");
}

function bookingIdentity(booking) {
  return [
    booking?.startsAt || booking?.date,
    booking?.email || booking?.customer?.email,
    booking?.phone || booking?.customer?.phone,
    booking?.serviceId || booking?.serviceName
  ].map(clean).join("|");
}

function recordId(record, fallback) {
  return clean(record?.id) || stableToken(fallback);
}

function stableToken(value) {
  let hash = 2166136261;
  const text = clean(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function firstIso(...values) {
  for (const value of values) {
    const date = validDate(value);
    if (date) {
      return date.toISOString();
    }
  }
  return "";
}

function calendarDayDifference(fromKey, toKey) {
  const from = dateKeyTimestamp(fromKey);
  const to = dateKeyTimestamp(toKey);
  return Number.isFinite(from) && Number.isFinite(to)
    ? Math.round((to - from) / DAY_MS)
    : 0;
}

function dateKeyTimestamp(key) {
  const match = clean(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : Number.NaN;
}

function dateTimestamp(value) {
  const date = validDate(value);
  return date ? date.getTime() : 0;
}

function validDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeStatus(value) {
  return clean(value).toLowerCase();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function normalizePhone(value) {
  const digits = clean(value).replace(/\D+/g, "");
  return digits.length >= 6 ? digits : "";
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function collection(db, key) {
  return Array.isArray(db?.[key]) ? db[key] : [];
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
