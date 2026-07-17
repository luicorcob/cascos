import assert from "node:assert/strict";
import { appendConsentEvent, consentStateForContact, evaluateConsentState, migrateLegacyPrivacyToConsent } from "../lib/consent-model.mjs";

const db = {
  contacts: [{ id: "contact_one", businessId: "biz_one", privacyAccepted: true, privacyAcceptedAt: "2026-07-10T10:00:00.000Z", privacyPolicyUrl: "https://example.com/privacy" }],
  bookings: [{ id: "booking_one", businessId: "biz_one", contactId: "contact_one", privacyAccepted: true, privacyAcceptedAt: "2026-07-11T10:00:00.000Z" }],
  consentEvents: []
};
const first = migrateLegacyPrivacyToConsent(db, { now: "2026-07-17T10:00:00.000Z" });
assert.equal(first.eventsCreated, 2);
assert.equal(evaluateConsentState(consentStateForContact(db, "biz_one", "contact_one"), "email", "service").allowed, true);
assert.equal(evaluateConsentState(consentStateForContact(db, "biz_one", "contact_one"), "email", "marketing").allowed, false, "Privacy notice acknowledgement must never become marketing consent");
const second = migrateLegacyPrivacyToConsent(db, { now: "2026-07-17T11:00:00.000Z" });
assert.equal(second.eventsCreated, 0);
assert.equal(db.consentEvents.length, 2);

appendConsentEvent(db, { businessId: "biz_one", contactId: "contact_one", channel: "email", purpose: "marketing", action: "granted", lawfulBasis: "consent", occurredAt: "2026-07-17T12:00:00.000Z" });
assert.equal(evaluateConsentState(consentStateForContact(db, "biz_one", "contact_one"), "email", "marketing").allowed, true);
appendConsentEvent(db, { businessId: "biz_one", contactId: "contact_one", channel: "email", purpose: "marketing", action: "withdrawn", lawfulBasis: "consent", occurredAt: "2026-07-17T13:00:00.000Z" });
assert.equal(evaluateConsentState(consentStateForContact(db, "biz_one", "contact_one"), "email", "marketing").reason, "withdrawn");
appendConsentEvent(db, { businessId: "biz_one", contactId: "contact_one", channel: "any", purpose: "any", action: "suppressed", lawfulBasis: "consent", occurredAt: "2026-07-17T14:00:00.000Z" });
assert.equal(consentStateForContact(db, "biz_one", "contact_one").globalSuppressed, true);

console.log("Consent model checks passed: append-only evidence, privacy migration, withdrawal and global suppression.");
