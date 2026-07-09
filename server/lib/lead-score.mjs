const SCORE_LABELS = new Set(["caliente", "templado", "frio", "perdido"]);
const FORM_SOURCES = new Set(["form", "web", "client-site", "lead-form", "public-form"]);
const CHATBOT_SOURCES = new Set(["chatbot", "bot", "assistant"]);
const BOOKING_CLICK_EVENTS = new Set(["booking_click", "dock_booking_click", "reservation_click", "booking_cta_click"]);
const CHATBOT_EVENTS = new Set(["chatbot_open", "chatbot_message", "chatbot_prompt", "chatbot_lead_captured"]);
const FORM_EVENTS = new Set(["lead_form_submit"]);
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export function recalculateContactScore(db, businessId, contact, now = new Date()) {
  if (!contact || typeof contact !== "object") {
    return contact;
  }

  const result = calculateContactScore(contact, buildScoreContext(db, businessId, now));
  contact.score = result.score;
  contact.scoreLabel = result.scoreLabel;
  return contact;
}

export function recalculateBusinessContactScores(db, businessId, now = new Date()) {
  db.contacts = Array.isArray(db.contacts) ? db.contacts : [];

  db.contacts
    .filter((contact) => contact.businessId === businessId)
    .forEach((contact) => recalculateContactScore(db, businessId, contact, now));

  return db.contacts.filter((contact) => contact.businessId === businessId);
}

export function withComputedLeadScore(db, businessId, contact, now = new Date()) {
  return recalculateContactScore(db, businessId, { ...(contact || {}) }, now);
}

export function normalizeStoredScoreLabel(value, fallback = "frio") {
  const label = cleanToken(value);
  return SCORE_LABELS.has(label) ? label : fallback;
}

function calculateContactScore(contact, context) {
  const associatedActivities = context.activities.filter((activity) => activity.contactId === contact.id);
  const associatedEvents = context.events.filter((event) => isEventAssociatedWithContact(event, contact));
  const latestInteractionAt = getLatestInteractionAt(contact, associatedActivities, associatedEvents);
  let score = 0;

  if (clean(contact.phone)) {
    score += 10;
  }

  if (clean(contact.email)) {
    score += 10;
  }

  if (hasFormSignal(contact, associatedActivities, associatedEvents)) {
    score += 15;
  }

  if (hasChatbotSignal(contact, associatedActivities, associatedEvents)) {
    score += 10;
  }

  if (hasBookingClickSignal(associatedEvents)) {
    score += 15;
  }

  if (Number(contact.valueEstimate || 0) > context.medianValueEstimate) {
    score += 15;
  }

  if (latestInteractionAt && context.now.getTime() - latestInteractionAt.getTime() <= THREE_DAYS_MS) {
    score += 15;
  }

  if (latestInteractionAt && context.now.getTime() - latestInteractionAt.getTime() > FOURTEEN_DAYS_MS) {
    score -= 20;
  }

  const boundedScore = Math.min(100, Math.max(0, Math.round(score)));
  const forcedLost = cleanToken(contact.status) === "lost";

  return {
    score: boundedScore,
    scoreLabel: forcedLost ? "perdido" : scoreLabelFor(boundedScore)
  };
}

function buildScoreContext(db, businessId, now) {
  const contacts = (Array.isArray(db?.contacts) ? db.contacts : [])
    .filter((contact) => contact.businessId === businessId);
  const values = contacts
    .map((contact) => Number(contact.valueEstimate || 0))
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right);

  return {
    now: now instanceof Date ? now : new Date(now),
    medianValueEstimate: median(values),
    activities: (Array.isArray(db?.activities) ? db.activities : [])
      .filter((activity) => activity.businessId === businessId),
    events: (Array.isArray(db?.businessEvents) ? db.businessEvents : [])
      .filter((event) => event.businessId === businessId)
  };
}

function median(values) {
  if (!values.length) {
    return 0;
  }

  const middle = Math.floor(values.length / 2);

  if (values.length % 2) {
    return values[middle];
  }

  return (values[middle - 1] + values[middle]) / 2;
}

function scoreLabelFor(score) {
  if (score >= 70) {
    return "caliente";
  }

  if (score >= 40) {
    return "templado";
  }

  return "frio";
}

function hasFormSignal(contact, activities, events) {
  const source = cleanToken(contact.source);

  return (FORM_SOURCES.has(source) && !CHATBOT_SOURCES.has(source))
    || activities.some((activity) => FORM_SOURCES.has(cleanToken(activity.source)) || FORM_EVENTS.has(cleanToken(activity.type)))
    || events.some((event) => FORM_EVENTS.has(cleanToken(event.type || event.name)));
}

function hasChatbotSignal(contact, activities, events) {
  return CHATBOT_SOURCES.has(cleanToken(contact.source))
    || activities.some((activity) => CHATBOT_SOURCES.has(cleanToken(activity.source)) || cleanToken(activity.type).includes("chatbot"))
    || events.some((event) => CHATBOT_EVENTS.has(cleanToken(event.type || event.name)));
}

function hasBookingClickSignal(events) {
  return events.some((event) => BOOKING_CLICK_EVENTS.has(cleanToken(event.type || event.name)));
}

function isEventAssociatedWithContact(event, contact) {
  const detail = event?.detail && typeof event.detail === "object" ? event.detail : {};
  const contactIds = [event?.contactId, event?.contact_id, detail.contactId, detail.contact_id, detail.leadId, detail.lead_id]
    .map(clean)
    .filter(Boolean);

  if (contactIds.includes(clean(contact.id))) {
    return true;
  }

  const emails = [event?.email, detail.email, detail.contact, detail.leadContact, detail.phoneOrEmail]
    .map(extractEmail)
    .filter(Boolean);
  const contactEmail = extractEmail(contact.email);

  if (contactEmail && emails.includes(contactEmail)) {
    return true;
  }

  const phones = [event?.phone, detail.phone, detail.contact, detail.leadContact, detail.phoneOrEmail]
    .map(normalizePhone)
    .filter(Boolean);
  const contactPhone = normalizePhone(contact.phone);

  return Boolean(contactPhone && phones.includes(contactPhone));
}

function getLatestInteractionAt(contact, activities, events) {
  const candidates = [
    contact.lastInteractionAt,
    contact.createdAt,
    ...activities.map((activity) => activity.createdAt),
    ...events.map((event) => event.createdAt || event.timestamp)
  ]
    .map((value) => new Date(value || ""))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());

  return candidates[0] || null;
}

function cleanToken(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function extractEmail(value) {
  return clean(value).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase() || "";
}

function normalizePhone(value) {
  return clean(value).replace(/[^\d+]/g, "").replace(/^\+/, "");
}
