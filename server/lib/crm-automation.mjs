import { createHash } from "node:crypto";
import { recalculateContactScore } from "./lead-score.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INACTIVITY_DAYS = 7;
const OPEN_LEAD_STATUSES = new Set(["new", "contacted", "waiting", "reserved"]);
const CUSTOMER_STATUSES = new Set(["customer", "won"]);
const VALID_NEXT_ACTION_TYPES = new Set([
  "llamada",
  "whatsapp",
  "email",
  "reunion",
  "enviar_propuesta",
  "revisar_reserva"
]);
const NON_HUMAN_ACTIVITY_TYPES = new Set([
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
const HUMAN_ACTIVITY_TYPES = new Set([
  "contact.status_changed",
  "next_action.completed",
  "proposal.sent",
  "proposal.accepted",
  "proposal.status_changed",
  "message.sent",
  "note",
  "task"
]);
const NON_HUMAN_SOURCES = new Set(["web", "chatbot", "booking", "system", "automation"]);

export function applyNewLeadAutomation(db, contactRef, options = {}) {
  const now = normalizeAutomationNow(options.now);
  const store = requireStore(db);
  const contact = findStoredContact(store, contactRef);

  if (!contact) {
    return automationResult("new-lead-response", false, "contact-not-found");
  }
  if (!isOpenLead(contact) || normalizeToken(contact.status || "new") !== "new") {
    return automationResult("new-lead-response", false, "not-new-lead", contact);
  }
  if (hasNextAction(contact)) {
    return automationResult("new-lead-response", false, "existing-next-action", contact);
  }

  const automationKey = `new-lead-response:${contact.businessId}:${contact.id}`;
  if (findAutomationActivity(store.activities, automationKey, contact.businessId, contact.id)) {
    return automationResult("new-lead-response", false, "already-applied", contact);
  }

  const nextAction = makeNextAction(
    preferredContactActionType(contact),
    now,
    "Responder hoy",
    now
  );
  const activity = applyAutomatedNextAction(store, contact, nextAction, {
    automationKey,
    rule: "new-lead-response",
    activityType: "automation.created",
    title: "Respuesta inicial programada",
    now
  });

  return automationResult("new-lead-response", true, "created", contact, nextAction, activity);
}

export function applyPublishedDemoAutomation(db, demoRecord, options = {}) {
  const now = normalizeAutomationNow(options.now);
  const store = requireStore(db);
  const demo = normalizeDemoRecord(demoRecord);

  if (!demo.businessId || !demo.contactId) {
    return automationResult("published-demo-follow-up", false, "explicit-contact-link-required");
  }

  const contact = store.contacts.find((item) => (
    clean(item?.businessId) === demo.businessId
      && clean(item?.id) === demo.contactId
      && !item?.merged
  )) || null;
  if (!contact) {
    return automationResult("published-demo-follow-up", false, "contact-not-found");
  }
  if (hasNextAction(contact)) {
    return automationResult("published-demo-follow-up", false, "existing-next-action", contact);
  }

  const automationKey = `published-demo-follow-up:${demo.businessId}:${demo.contactId}:${demo.identity}`;
  if (findAutomationActivity(store.activities, automationKey, demo.businessId, demo.contactId)) {
    return automationResult("published-demo-follow-up", false, "already-applied", contact);
  }

  const publishedAt = validDate(demo.publishedAt) || now;
  const dueDate = new Date(publishedAt.getTime() + 48 * 60 * 60 * 1000);
  const nextAction = makeNextAction(
    preferredContactActionType(contact),
    dueDate,
    "Seguimiento de demo publicada en 48h",
    now
  );
  const activity = applyAutomatedNextAction(store, contact, nextAction, {
    automationKey,
    rule: "published-demo-follow-up",
    activityType: "automation.created",
    title: "Seguimiento de demo programado",
    now,
    metadata: {
      demoId: demo.id,
      demoUrl: demo.url,
      publishedAt: publishedAt.toISOString()
    }
  });

  return automationResult("published-demo-follow-up", true, "created", contact, nextAction, activity);
}

export function applyAcceptedProposalAutomation(db, proposalRecord, options = {}) {
  const now = normalizeAutomationNow(options.now);
  const store = requireStore(db);
  const proposal = isPlainObject(proposalRecord?.proposal) ? proposalRecord.proposal : proposalRecord;

  if (!isPlainObject(proposal) || !["aceptada", "accepted"].includes(normalizeToken(proposal.status))) {
    return automationResult("accepted-proposal-conversion", false, "proposal-not-accepted");
  }

  const businessId = clean(proposal.businessId || proposal.business_id);
  const contactId = clean(proposal.contactId || proposal.contact_id);
  const proposalId = clean(proposal.id);
  const contact = store.contacts.find((item) => (
    clean(item?.businessId) === businessId
      && clean(item?.id) === contactId
      && !item?.merged
  )) || null;

  if (!businessId || !contactId || !contact) {
    return automationResult("accepted-proposal-conversion", false, "contact-not-found");
  }
  if (normalizeToken(contact.status) === "customer") {
    return automationResult("accepted-proposal-conversion", false, "already-customer", contact);
  }

  const previousStatus = normalizeToken(contact.status || "new");
  const automationKey = `accepted-proposal-conversion:${businessId}:${proposalId || contactId}`;
  const existingActivity = findAutomationActivity(store.activities, automationKey, businessId, contactId);

  contact.status = "customer";
  contact.lostReason = "";
  contact.lastInteractionAt = latestIso(contact.lastInteractionAt, now) || now.toISOString();
  contact.updatedAt = latestIso(contact.updatedAt, now) || now.toISOString();

  const activity = existingActivity || appendAutomationActivity(store, {
    automationKey,
    rule: "accepted-proposal-conversion",
    activityType: "contact.status_changed",
    title: "Contacto convertido en cliente",
    note: `Estado: ${previousStatus} -> customer. Propuesta aceptada: ${proposalId || "sin id"}`,
    businessId,
    contactId,
    now,
    metadata: {
      proposalId,
      previousStatus,
      status: "customer"
    }
  });
  recalculateContactScore(store, businessId, contact, now);

  return automationResult(
    "accepted-proposal-conversion",
    true,
    existingActivity ? "reconciled" : "converted",
    contact,
    null,
    activity
  );
}

export function applyDailyLeadInactivityAutomation(db, options = {}) {
  const now = normalizeAutomationNow(options.now);
  const thresholdDays = normalizeInactivityDays(options.thresholdDays);
  const thresholdMs = thresholdDays * DAY_MS;
  const businessId = clean(options.businessId);
  const store = requireStore(db);
  const latestHumanByContact = latestHumanActivityMap(store.activities, now);
  const contacts = store.contacts
    .filter((contact) => !businessId || clean(contact?.businessId) === businessId)
    .slice()
    .sort((left, right) => (
      clean(left?.businessId).localeCompare(clean(right?.businessId))
        || clean(left?.id).localeCompare(clean(right?.id))
    ));
  const skipped = {
    notOpenLead: 0,
    existingNextAction: 0,
    invalidCreatedAt: 0,
    recentHumanActivity: 0,
    alreadyApplied: 0
  };
  const changes = [];

  contacts.forEach((contact) => {
    if (!isOpenLead(contact)) {
      skipped.notOpenLead += 1;
      return;
    }
    if (hasNextAction(contact)) {
      skipped.existingNextAction += 1;
      return;
    }

    const createdAt = validDate(contact.createdAt);
    if (!createdAt || createdAt.getTime() > now.getTime()) {
      skipped.invalidCreatedAt += 1;
      return;
    }

    const contactKey = scopedContactKey(contact.businessId, contact.id);
    const humanActivityAt = latestHumanByContact.get(contactKey) || null;
    const anchorAt = humanActivityAt && humanActivityAt.getTime() >= createdAt.getTime()
      ? humanActivityAt
      : createdAt;
    const inactivityMs = now.getTime() - anchorAt.getTime();
    if (inactivityMs < thresholdMs) {
      skipped.recentHumanActivity += 1;
      return;
    }

    const automationKey = `inactive-lead-review:${clean(contact.businessId)}:${clean(contact.id)}:${anchorAt.toISOString()}`;
    if (findAutomationActivity(store.activities, automationKey, contact.businessId, contact.id)) {
      skipped.alreadyApplied += 1;
      return;
    }

    const inactiveDays = Math.floor(inactivityMs / DAY_MS);
    const nextAction = makeNextAction(
      preferredContactActionType(contact),
      now,
      `Revisar lead: ${inactiveDays} días sin actividad humana`,
      now
    );
    const activity = applyAutomatedNextAction(store, contact, nextAction, {
      automationKey,
      rule: "inactive-lead-review",
      activityType: "automation.review_scheduled",
      title: "Revisión de lead programada",
      now,
      metadata: {
        anchorAt: anchorAt.toISOString(),
        inactiveDays,
        thresholdDays
      }
    });

    changes.push({
      businessId: clean(contact.businessId),
      contactId: clean(contact.id),
      anchorAt: anchorAt.toISOString(),
      inactiveDays,
      nextAction: copyNextAction(nextAction),
      activityId: activity.id
    });
  });

  return {
    rule: "inactive-lead-review",
    generatedAt: now.toISOString(),
    thresholdDays,
    businessId,
    scanned: contacts.length,
    created: changes.length,
    skipped,
    changes
  };
}

export function buildCompletedBookingReviewSuggestion(db, bookingRecord, options = {}) {
  const now = normalizeAutomationNow(options.now);
  const booking = isPlainObject(bookingRecord?.booking) ? bookingRecord.booking : bookingRecord;

  if (!isPlainObject(booking) || normalizeToken(booking.status) !== "completed") {
    return null;
  }

  const businessId = clean(booking.businessId || booking.business_id);
  const completedAt = validDate(
    booking.completedAt
      || booking.updatedAt
      || booking.endsAt
      || booking.startsAt
  );
  if (!businessId || !completedAt || completedAt.getTime() > now.getTime()) {
    return null;
  }

  const businesses = collection(db, "businesses");
  const business = isPlainObject(options.business)
    && clean(options.business.id) === businessId
    ? options.business
    : businesses.find((item) => clean(item?.id) === businessId) || null;
  const contact = findContactForBooking(collection(db, "contacts"), booking, businessId);
  const recipient = contact || booking;
  const bookingId = clean(booking.id) || `booking_${stableToken(bookingIdentity(booking))}`;
  const recommendedActionType = preferredContactActionType(recipient);
  const suggestedNextAction = makeNextAction(
    recommendedActionType,
    now,
    "Pedir una reseña tras la reserva completada",
    now
  );

  return {
    id: `review:${bookingId}`,
    type: "review.suggested",
    businessId,
    bookingId: clean(booking.id),
    contactId: clean(contact?.id),
    date: completedAt.toISOString(),
    title: "Pedir una reseña",
    summary: clean(booking.serviceName || booking.service)
      ? `Reserva completada: ${clean(booking.serviceName || booking.service)}`
      : "Reserva completada",
    reviewUrl: findReviewUrl(business),
    recommendedActionType,
    suggestedNextAction,
    contact: {
      id: clean(contact?.id),
      name: clean(contact?.name || booking.customerName || booking.name || "Cliente sin nombre"),
      phone: clean(contact?.phone || booking.phone),
      email: clean(contact?.email || booking.email)
    }
  };
}

export function preferredContactActionType(contact) {
  if (clean(contact?.phone || contact?.customerPhone || contact?.customer?.phone)) {
    return "whatsapp";
  }
  if (clean(contact?.email || contact?.customerEmail || contact?.customer?.email)) {
    return "email";
  }
  return "llamada";
}

export function isHumanCrmActivity(activity) {
  const type = normalizeToken(activity?.type);
  const source = normalizeToken(activity?.source);
  const automated = activity?.metadata?.automated === true
    || source.includes("automation")
    || type.startsWith("automation.");

  if (!type || automated || NON_HUMAN_ACTIVITY_TYPES.has(type) || type.startsWith("booking.")) {
    return false;
  }
  if (NON_HUMAN_SOURCES.has(source)) {
    return false;
  }
  if (HUMAN_ACTIVITY_TYPES.has(type)) {
    return true;
  }
  return Boolean(clean(activity?.note || activity?.title));
}

export function normalizeInactivityDays(value, fallback = DEFAULT_INACTIVITY_DAYS) {
  if (value === undefined || value === null || clean(value) === "") {
    return fallback;
  }

  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 3650) {
    throw new RangeError("thresholdDays must be an integer between 1 and 3650");
  }
  return days;
}

export function normalizeAutomationNow(value) {
  if (value === undefined || value === null || value === "") {
    return new Date();
  }

  const date = validDate(value);
  if (!date) {
    throw new RangeError("now must be a valid date");
  }
  return date;
}

function applyAutomatedNextAction(store, contact, nextAction, options) {
  contact.nextAction = copyNextAction(nextAction);
  contact.updatedAt = latestIso(contact.updatedAt, options.now) || options.now.toISOString();

  return appendAutomationActivity(store, {
    automationKey: options.automationKey,
    rule: options.rule,
    activityType: options.activityType,
    title: options.title,
    note: nextAction.note,
    businessId: contact.businessId,
    contactId: contact.id,
    now: options.now,
    metadata: {
      ...(isPlainObject(options.metadata) ? options.metadata : {}),
      nextAction: copyNextAction(nextAction)
    }
  });
}

function appendAutomationActivity(store, options) {
  const existing = findAutomationActivity(
    store.activities,
    options.automationKey,
    options.businessId,
    options.contactId
  );
  if (existing) {
    return existing;
  }

  const activity = {
    id: `act_auto_${stableToken(`${clean(options.businessId)}\u0000${clean(options.contactId)}\u0000${options.automationKey}`)}`,
    businessId: clean(options.businessId),
    contactId: clean(options.contactId),
    type: clean(options.activityType || "automation.created"),
    title: clean(options.title || "Automatización CRM"),
    note: clean(options.note),
    source: "crm-automation",
    metadata: {
      ...(isPlainObject(options.metadata) ? options.metadata : {}),
      automated: true,
      automationKey: options.automationKey,
      rule: options.rule
    },
    createdAt: options.now.toISOString()
  };
  store.activities.push(activity);
  return activity;
}

function latestHumanActivityMap(activities, now) {
  const latest = new Map();

  activities.forEach((activity) => {
    if (!isHumanCrmActivity(activity)) {
      return;
    }

    const businessId = clean(activity?.businessId || activity?.business_id);
    const contactId = clean(activity?.contactId || activity?.contact_id);
    const createdAt = validDate(activity?.createdAt || activity?.date);
    if (!businessId || !contactId || !createdAt || createdAt.getTime() > now.getTime()) {
      return;
    }

    const key = scopedContactKey(businessId, contactId);
    const current = latest.get(key);
    if (!current || createdAt.getTime() > current.getTime()) {
      latest.set(key, createdAt);
    }
  });

  return latest;
}

function makeNextAction(type, dueDate, note, now) {
  if (!VALID_NEXT_ACTION_TYPES.has(type)) {
    throw new TypeError(`Unsupported nextAction type: ${type}`);
  }

  return {
    type,
    dueDate: dueDate.toISOString(),
    status: "pendiente",
    note,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
}

function normalizeDemoRecord(record) {
  const source = isPlainObject(record) ? record : {};
  const nested = isPlainObject(source.demo) ? source.demo : {};
  const detail = isPlainObject(source.detail) ? source.detail : {};
  const metadata = isPlainObject(source.metadata) ? source.metadata : {};
  const businessId = clean(
    source.businessId || source.business_id
      || nested.businessId || nested.business_id
      || detail.businessId || detail.business_id
      || metadata.businessId || metadata.business_id
  );
  const contactId = clean(
    source.contactId || source.contact_id || source.leadId || source.lead_id
      || nested.contactId || nested.contact_id || nested.leadId || nested.lead_id
      || detail.contactId || detail.contact_id || detail.leadId || detail.lead_id
      || metadata.contactId || metadata.contact_id || metadata.leadId || metadata.lead_id
  );
  const id = clean(source.id || source.demoId || nested.id || nested.demoId);
  const url = clean(source.publishedUrl || source.url || nested.publishedUrl || nested.url || nested.path);
  const publishedAt = clean(
    source.publishedAt || nested.publishedAt || nested.createdAt || source.createdAt
  );
  const identity = id || url || publishedAt || `contact-${contactId}`;

  return { businessId, contactId, id, url, publishedAt, identity: stableToken(identity) };
}

function findStoredContact(store, reference) {
  const source = isPlainObject(reference) ? reference : {};
  const businessId = clean(source.businessId || source.business_id);
  const contactId = clean(source.id || source.contactId || source.contact_id);
  if (!businessId || !contactId) {
    return null;
  }
  return store.contacts.find((item) => (
    clean(item?.businessId) === businessId
      && clean(item?.id) === contactId
      && !item?.merged
  )) || null;
}

function findContactForBooking(contacts, booking, businessId) {
  const contactId = clean(booking.contactId || booking.contact_id || booking.customer?.contactId);
  const direct = contactId
    ? contacts.find((contact) => clean(contact?.businessId) === businessId && clean(contact?.id) === contactId && !contact?.merged)
    : null;
  if (direct) {
    return direct;
  }

  const email = normalizeEmail(booking.email || booking.customerEmail || booking.customer?.email);
  if (email) {
    const match = contacts.find((contact) => (
      clean(contact?.businessId) === businessId
        && !contact?.merged
        && normalizeEmail(contact?.email) === email
    ));
    if (match) {
      return match;
    }
  }

  const phone = normalizePhone(booking.phone || booking.customerPhone || booking.customer?.phone);
  return phone
    ? contacts.find((contact) => (
      clean(contact?.businessId) === businessId
        && !contact?.merged
        && normalizePhone(contact?.phone) === phone
    )) || null
    : null;
}

function findReviewUrl(business) {
  return clean(
    business?.content?.google?.reviewUrl
      || business?.content?.reviewUrl
      || business?.integrations?.google?.reviewUrl
      || business?.integrations?.reviewUrl
      || business?.reviewUrl
  );
}

function findAutomationActivity(activities, automationKey, businessId, contactId) {
  const expectedBusinessId = clean(businessId);
  const expectedContactId = clean(contactId);
  return activities.find((activity) => (
    clean(activity?.metadata?.automationKey) === automationKey
      && clean(activity?.businessId || activity?.business_id) === expectedBusinessId
      && clean(activity?.contactId || activity?.contact_id) === expectedContactId
  )) || null;
}

function automationResult(rule, applied, reason, contact = null, nextAction = null, activity = null) {
  return {
    rule,
    applied,
    reason,
    contactId: clean(contact?.id),
    nextAction: nextAction ? copyNextAction(nextAction) : null,
    activity: activity || null
  };
}

function isOpenLead(contact) {
  if (
    !contact
    || !clean(contact.id)
    || !clean(contact.businessId)
    || contact.merged
    || normalizeToken(contact.type) === "customer"
  ) {
    return false;
  }
  const status = normalizeToken(contact.status || "new");
  return OPEN_LEAD_STATUSES.has(status) && !CUSTOMER_STATUSES.has(status);
}

function hasNextAction(contact) {
  return Boolean(contact?.nextAction);
}

function requireStore(db) {
  if (!db || typeof db !== "object" || Array.isArray(db)) {
    throw new TypeError("CRM automation requires a store object");
  }
  db.contacts = collection(db, "contacts");
  db.activities = collection(db, "activities");
  return db;
}

function collection(db, key) {
  return Array.isArray(db?.[key]) ? db[key] : [];
}

function scopedContactKey(businessId, contactId) {
  return `${clean(businessId)}\u0000${clean(contactId)}`;
}

function bookingIdentity(booking) {
  return [
    booking?.businessId,
    booking?.completedAt || booking?.updatedAt || booking?.createdAt,
    booking?.startsAt,
    booking?.endsAt,
    booking?.email || booking?.customer?.email,
    booking?.phone || booking?.customer?.phone,
    booking?.serviceId || booking?.serviceName
  ].map(clean).join("|");
}

function copyNextAction(nextAction) {
  return nextAction ? {
    type: nextAction.type,
    dueDate: nextAction.dueDate,
    status: nextAction.status,
    note: nextAction.note,
    createdAt: nextAction.createdAt,
    updatedAt: nextAction.updatedAt
  } : null;
}

function latestIso(value, comparison) {
  const current = validDate(value);
  if (!current) {
    return comparison.toISOString();
  }
  return current.getTime() > comparison.getTime()
    ? current.toISOString()
    : comparison.toISOString();
}

function validDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function normalizePhone(value) {
  const digits = clean(value).replace(/\D+/g, "");
  return digits.length >= 6 ? digits : "";
}

function normalizeToken(value) {
  return clean(value).toLowerCase();
}

function stableToken(value) {
  return createHash("sha256")
    .update(clean(value), "utf8")
    .digest("hex")
    .slice(0, 24);
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
