const OPEN_LEAD_STATUSES = new Set(["new", "contacted", "waiting", "reserved"]);
const EXCLUDED_ACTIVITY_TYPES = new Set([
  "lead.created",
  "contact.created",
  "booking.created",
  "booking.updated",
  "booking.reminder",
  "next_action.created",
  "automation.created",
  "automation.review_scheduled",
  "proposal.created",
  "proposal.updated",
  "proposal.deleted",
  "proposal.expired"
]);
const INCLUDED_ACTIVITY_TYPES = new Set([
  "contact.status_changed",
  "next_action.completed",
  "proposal.sent",
  "proposal.accepted",
  "proposal.status_changed",
  "message.sent",
  "note",
  "task"
]);

export function buildCommercialSla(db, business, options = {}) {
  const now = validDate(options.now) || new Date();
  const thresholdHours = normalizeSlaHours(options.hours);
  const thresholdMs = thresholdHours * 60 * 60 * 1000;
  const businessId = clean(business?.id);
  const activities = (Array.isArray(db?.activities) ? db.activities : [])
    .filter((activity) => activity?.businessId === businessId);
  const contacts = (Array.isArray(db?.contacts) ? db.contacts : [])
    .filter((contact) => contact?.businessId === businessId && !contact?.merged)
    .filter((contact) => {
      const createdAt = validDate(contact?.createdAt);
      return createdAt && createdAt.getTime() <= now.getTime();
    });

  const responseRows = [];
  const untouched = [];

  contacts.forEach((contact) => {
    const createdAt = validDate(contact.createdAt);
    const firstActivity = firstMeaningfulActivity(activities, contact.id, createdAt, now);

    if (firstActivity) {
      const respondedAt = validDate(firstActivity.createdAt);
      const firstResponseTimeMs = Math.max(0, respondedAt.getTime() - createdAt.getTime());
      responseRows.push({
        contactId: contact.id,
        createdAt: createdAt.toISOString(),
        respondedAt: respondedAt.toISOString(),
        activityId: clean(firstActivity.id),
        activityType: clean(firstActivity.type),
        firstResponseTimeMs,
        firstResponseTimeMinutes: round(firstResponseTimeMs / 60000, 2),
        withinSla: firstResponseTimeMs <= thresholdMs
      });
      return;
    }

    const ageMs = Math.max(0, now.getTime() - createdAt.getTime());
    const status = normalizeStatus(contact.status, contact.type);

    if (OPEN_LEAD_STATUSES.has(status) && ageMs > thresholdMs) {
      untouched.push({
        id: clean(contact.id),
        businessId,
        name: contactName(contact),
        phone: clean(contact.phone),
        email: clean(contact.email),
        source: clean(contact.source || "manual"),
        status,
        createdAt: createdAt.toISOString(),
        ageMs,
        ageHours: round(ageMs / 3600000, 2)
      });
    }
  });

  responseRows.sort((left, right) => left.firstResponseTimeMs - right.firstResponseTimeMs || left.contactId.localeCompare(right.contactId));
  untouched.sort((left, right) => right.ageMs - left.ageMs || left.id.localeCompare(right.id));

  const responseTimes = responseRows.map((row) => row.firstResponseTimeMs);
  const totalResponseMs = responseTimes.reduce((total, value) => total + value, 0);
  const averageMs = responseTimes.length ? Math.round(totalResponseMs / responseTimes.length) : 0;
  const medianMs = median(responseTimes);
  const withinSla = responseRows.filter((row) => row.withinSla).length;

  return {
    business: {
      id: businessId,
      name: clean(business?.name)
    },
    generatedAt: now.toISOString(),
    thresholdHours,
    totalContacts: contacts.length,
    responded: responseRows.length,
    notResponded: contacts.length - responseRows.length,
    withinSla,
    complianceRate: responseRows.length ? round((withinSla / responseRows.length) * 100, 2) : 0,
    averageFirstResponseMs: averageMs,
    averageFirstResponseMinutes: round(averageMs / 60000, 2),
    medianFirstResponseMs: medianMs,
    medianFirstResponseMinutes: round(medianMs / 60000, 2),
    responses: responseRows,
    untouched,
    untouchedTotal: untouched.length
  };
}

export function normalizeSlaHours(value, fallback = 24) {
  if (value === undefined || value === null || clean(value) === "") {
    return fallback;
  }

  const hours = Number(value);

  if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 90) {
    throw new RangeError("hours must be a number between 0 and 2160");
  }

  return round(hours, 2);
}

export function isMeaningfulCommercialActivity(activity) {
  const type = clean(activity?.type).toLowerCase();

  if (!type || EXCLUDED_ACTIVITY_TYPES.has(type) || type.startsWith("booking.")) {
    return false;
  }

  const source = clean(activity?.source).toLowerCase();
  const automated = activity?.metadata?.automated === true
    || source.includes("automation");

  if (automated || ["web", "chatbot", "booking", "system", "automation"].includes(source)) {
    return false;
  }

  if (INCLUDED_ACTIVITY_TYPES.has(type)) {
    return true;
  }

  return Boolean(clean(activity?.note || activity?.title));
}

function firstMeaningfulActivity(activities, contactId, createdAt, now) {
  return activities
    .filter((activity) => (activity?.contactId || activity?.contact_id) === contactId)
    .filter(isMeaningfulCommercialActivity)
    .filter((activity) => {
      const activityDate = validDate(activity?.createdAt);
      return activityDate
        && activityDate.getTime() >= createdAt.getTime()
        && activityDate.getTime() <= now.getTime();
    })
    .sort((left, right) => {
      const dateOrder = validDate(left.createdAt).getTime() - validDate(right.createdAt).getTime();
      return dateOrder || clean(left.id).localeCompare(clean(right.id));
    })[0] || null;
}

function median(values) {
  if (!values.length) {
    return 0;
  }

  const middle = Math.floor(values.length / 2);
  return values.length % 2
    ? values[middle]
    : Math.round((values[middle - 1] + values[middle]) / 2);
}

function normalizeStatus(status, type) {
  const value = clean(status).toLowerCase();
  return value || (clean(type).toLowerCase() === "customer" ? "customer" : "new");
}

function contactName(contact) {
  return clean(contact?.name || contact?.fullName || contact?.email || contact?.phone || "Contacto sin nombre");
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
