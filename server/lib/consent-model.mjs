import { createHash, randomUUID } from "node:crypto";

export const CONSENT_CHANNELS = Object.freeze(["any", "email", "whatsapp", "sms", "phone"]);
export const CONSENT_PURPOSES = Object.freeze(["any", "service", "marketing", "reviews", "profiling"]);
export const CONSENT_ACTIONS = Object.freeze(["acknowledged", "granted", "withdrawn", "suppressed", "unsuppressed"]);
export const CONSENT_BASES = Object.freeze(["consent", "contract", "legitimate_interest", "legal_obligation"]);

export function appendConsentEvent(db, input) {
  db.consentEvents = Array.isArray(db.consentEvents) ? db.consentEvents : [];
  const occurredAt = validIso(input.occurredAt) || new Date().toISOString();
  const event = Object.freeze({
    id: input.id || `consent_${randomUUID()}`,
    businessId: input.businessId,
    contactId: input.contactId,
    channel: input.channel,
    purpose: input.purpose,
    action: input.action,
    lawfulBasis: input.lawfulBasis,
    source: clean(input.source) || "dashboard",
    textVersion: clean(input.textVersion),
    textSnapshot: clean(input.textSnapshot),
    policyUrl: clean(input.policyUrl),
    actorType: clean(input.actorType) || "system",
    actorId: clean(input.actorId),
    evidence: normalizeEvidence(input.evidence),
    occurredAt,
    createdAt: validIso(input.createdAt) || occurredAt
  });
  const existing = db.consentEvents.find((item) => item.id === event.id);
  if (existing) return { event: existing, created: false };
  db.consentEvents.push(event);
  return { event, created: true };
}

export function consentStateForContact(db, businessId, contactId) {
  const events = (Array.isArray(db.consentEvents) ? db.consentEvents : [])
    .filter((event) => event.businessId === businessId && event.contactId === contactId)
    .sort((left, right) => String(left.occurredAt || left.createdAt || "").localeCompare(String(right.occurredAt || right.createdAt || "")));
  const decisions = new Map();
  const suppressions = new Map();
  let globalSuppressed = false;
  let lastNotice = null;
  for (const event of events) {
    const key = consentKey(event.channel, event.purpose);
    if (event.action === "acknowledged") lastNotice = event;
    if (event.action === "granted") decisions.set(key, true);
    if (event.action === "withdrawn") decisions.set(key, false);
    if (event.action === "suppressed") {
      if (event.channel === "any" && event.purpose === "any") globalSuppressed = true;
      else suppressions.set(key, true);
    }
    if (event.action === "unsuppressed") {
      if (event.channel === "any" && event.purpose === "any") globalSuppressed = false;
      else suppressions.set(key, false);
    }
  }
  const preferences = {};
  for (const channel of CONSENT_CHANNELS.filter((item) => item !== "any")) {
    preferences[channel] = {};
    for (const purpose of CONSENT_PURPOSES.filter((item) => item !== "any")) {
      const result = evaluateConsent({ decisions, suppressions, globalSuppressed, channel, purpose, events });
      preferences[channel][purpose] = result;
    }
  }
  return {
    contactId,
    globalSuppressed,
    preferences,
    lastNotice,
    events: [...events].reverse(),
    total: events.length
  };
}

export function evaluateConsentState(state, channel, purpose) {
  return state?.preferences?.[channel]?.[purpose] || { allowed: false, suppressed: Boolean(state?.globalSuppressed), reason: state?.globalSuppressed ? "global_suppression" : "no_grant", eventId: "" };
}

export function migrateLegacyPrivacyToConsent(db, options = {}) {
  const now = options.now || new Date().toISOString();
  db.contacts = Array.isArray(db.contacts) ? db.contacts : [];
  db.bookings = Array.isArray(db.bookings) ? db.bookings : [];
  db.consentEvents = Array.isArray(db.consentEvents) ? db.consentEvents : [];
  const summary = { contactsScanned: 0, bookingsScanned: 0, acknowledgementsFound: 0, eventsCreated: 0, eventsSkipped: 0, createdEventIds: [] };
  for (const contact of db.contacts) {
    if (!contact?.businessId || !contact?.id || contact.merged) continue;
    summary.contactsScanned += 1;
    if (!contact.privacyAccepted) continue;
    summary.acknowledgementsFound += 1;
    const result = recordPrivacyAcknowledgement(db, {
      businessId: contact.businessId,
      contactId: contact.id,
      source: contact.source || "legacy-contact",
      occurredAt: contact.privacyAcceptedAt || contact.createdAt || now,
      policyUrl: contact.privacyPolicyUrl || "",
      evidence: { legacyRecordType: "contact", legacyRecordId: contact.id },
      id: legacyConsentId("contact", contact.id)
    });
    trackMigrationResult(summary, result);
  }
  for (const booking of db.bookings) {
    if (!booking?.businessId || !booking?.id || !booking?.contactId) continue;
    summary.bookingsScanned += 1;
    if (!booking.privacyAccepted) continue;
    summary.acknowledgementsFound += 1;
    const result = recordPrivacyAcknowledgement(db, {
      businessId: booking.businessId,
      contactId: booking.contactId,
      source: booking.source || "legacy-booking",
      occurredAt: booking.privacyAcceptedAt || booking.createdAt || now,
      policyUrl: booking.privacyPolicyUrl || "",
      evidence: { legacyRecordType: "booking", legacyRecordId: booking.id },
      id: legacyConsentId("booking", booking.id)
    });
    trackMigrationResult(summary, result);
  }
  return summary;
}

export function recordPrivacyAcknowledgement(db, input) {
  return appendConsentEvent(db, {
    ...input,
    channel: "any",
    purpose: "service",
    action: "acknowledged",
    lawfulBasis: "contract",
    actorType: input.actorType || "contact",
    textVersion: input.textVersion || "legacy-privacy-notice"
  });
}

function evaluateConsent({ decisions, suppressions, globalSuppressed, channel, purpose, events }) {
  if (globalSuppressed) return { allowed: false, suppressed: true, reason: "global_suppression", eventId: latestMatchingEvent(events, channel, purpose, ["suppressed"])?.id || "" };
  const keys = [consentKey(channel, purpose), consentKey("any", purpose), consentKey(channel, "any"), consentKey("any", "any")];
  const suppressedKey = keys.find((key) => suppressions.get(key) === true);
  if (suppressedKey) return { allowed: false, suppressed: true, reason: "channel_or_purpose_suppression", eventId: latestMatchingEvent(events, channel, purpose, ["suppressed"])?.id || "" };
  const decisionKey = keys.find((key) => decisions.has(key));
  if (decisionKey) {
    const allowed = decisions.get(decisionKey) === true;
    return { allowed, suppressed: false, reason: allowed ? "granted" : "withdrawn", eventId: latestMatchingEvent(events, channel, purpose, [allowed ? "granted" : "withdrawn"])?.id || "" };
  }
  if (purpose === "service") {
    const notice = latestMatchingEvent(events, channel, purpose, ["acknowledged"]);
    if (notice) return { allowed: true, suppressed: false, reason: "service_notice_acknowledged", eventId: notice.id };
  }
  return { allowed: false, suppressed: false, reason: "no_grant", eventId: "" };
}

function latestMatchingEvent(events, channel, purpose, actions) {
  return [...events].reverse().find((event) => actions.includes(event.action) && matchesScope(event, channel, purpose)) || null;
}
function matchesScope(event, channel, purpose) { return (event.channel === channel || event.channel === "any") && (event.purpose === purpose || event.purpose === "any"); }
function consentKey(channel, purpose) { return `${channel}:${purpose}`; }
function legacyConsentId(type, id) { return `consent_legacy_${type}_${createHash("sha256").update(String(id)).digest("hex").slice(0, 20)}`; }
function normalizeEvidence(value) { if (!value || typeof value !== "object" || Array.isArray(value)) return {}; return JSON.parse(JSON.stringify(value)); }
function validIso(value) { const time = Date.parse(value || ""); return Number.isFinite(time) ? new Date(time).toISOString() : ""; }
function trackMigrationResult(summary, result) { if (result.created) { summary.eventsCreated += 1; summary.createdEventIds.push(result.event.id); } else summary.eventsSkipped += 1; }
function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
