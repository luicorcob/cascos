import assert from "node:assert/strict";
import { appendConsentEvent } from "../lib/consent-model.mjs";
import {
  approveReviewReply,
  buildReputationCenter,
  createReviewReplyDraft,
  createReviewRequest,
  markReviewReplyPublished,
  markReviewRequestSent,
  recordReviewRequestClick,
  syncReputationReviews
} from "../lib/reputation-model.mjs";

const business = {
  id: "biz_reputation_model",
  name: "Casa Modelo",
  content: { google: { reviewUrl: "https://g.page/r/model/review" } }
};
const contact = { id: "contact_reputation", businessId: business.id, name: "Ana Modelo", email: "ana@example.com" };
const booking = {
  id: "booking_reputation",
  businessId: business.id,
  contactId: contact.id,
  customerName: contact.name,
  serviceName: "Cena",
  status: "completed",
  startsAt: "2026-07-17T18:00:00.000Z",
  endsAt: "2026-07-17T20:00:00.000Z"
};
const db = {
  businesses: [business],
  contacts: [contact],
  bookings: [booking],
  consentEvents: [],
  reputationReviews: [],
  reputationReplies: [],
  reputationSyncRuns: [],
  reviewRequests: []
};
appendConsentEvent(db, {
  businessId: business.id,
  contactId: contact.id,
  channel: "email",
  purpose: "reviews",
  action: "granted",
  lawfulBasis: "consent",
  source: "model-test",
  textVersion: "v1",
  textSnapshot: "Acepto recibir solicitudes de opinion",
  actorType: "contact",
  actorId: contact.id,
  occurredAt: "2026-07-17T19:00:00.000Z"
});

const firstSync = syncReputationReviews(db, business, {
  provider: "development",
  reviews: [
    { reviewId: "critical-1", reviewerName: "Cliente Critico", rating: 1, comment: "Servicio lento y problema de alergia", createTime: "2026-07-18T08:00:00.000Z" },
    { reviewId: "positive-1", reviewerName: "Cliente Feliz", rating: 5, comment: "Servicio rapido y gran calidad", createTime: "2026-07-18T10:30:00.000Z" }
  ]
}, "2026-07-18T12:00:00.000Z");
assert.equal(firstSync.run.created, 2);
assert.equal(firstSync.center.summary.averageRating, 3);
assert.equal(firstSync.center.summary.pending, 2);
assert.equal(firstSync.center.summary.overdue, 1);
assert.ok(firstSync.center.topics.some((item) => item.topic === "service"));
assert.ok(firstSync.center.topics.some((item) => item.topic === "speed"));
assert.equal(firstSync.center.eligibleRequests.length, 1);

const critical = firstSync.center.reviews.find((item) => item.providerReviewId === "critical-1");
assert.equal(critical.sentiment, "negative");
assert.equal(critical.urgency, "critical");
assert.equal(critical.sla.breached, true);
const draft = createReviewReplyDraft(db, business.id, critical.id, {}, "2026-07-18T12:05:00.000Z");
assert.equal(draft.status, "draft");
approveReviewReply(db, business.id, critical.id, draft.id, { actorId: "owner-1" }, "2026-07-18T12:06:00.000Z");
assert.throws(() => markReviewReplyPublished(db, business.id, critical.id, "missing", {}, "2026-07-18T12:07:00.000Z"), /not found/i);
markReviewReplyPublished(db, business.id, critical.id, draft.id, { provider: "development" }, "2026-07-18T12:07:00.000Z");
assert.equal(buildReputationCenter(db, business.id, new Date("2026-07-18T12:08:00.000Z")).summary.pending, 1);

assert.throws(() => createReviewRequest(db, business, {
  bookingId: booking.id,
  contactId: contact.id,
  channel: "email",
  message: "Te damos un descuento si dejas una resena"
}, { publicBaseUrl: "https://example.com" }, "2026-07-18T12:10:00.000Z"), /cannot offer/i);

const created = createReviewRequest(db, business, {
  bookingId: booking.id,
  contactId: contact.id,
  channel: "email"
}, { publicBaseUrl: "https://example.com" }, "2026-07-18T12:10:00.000Z");
assert.ok(created.request.trackingUrl.includes("/api/public/review-requests/"));
markReviewRequestSent(created.request, "dev_message_review", "2026-07-18T12:11:00.000Z");
recordReviewRequestClick(db, created.request.trackingToken, "2026-07-18T12:12:00.000Z");
assert.equal(created.request.status, "clicked");

const attributed = syncReputationReviews(db, business, {
  provider: "development",
  reviews: [{ reviewId: "attributed-1", reviewerName: "Ana Modelo", rating: 5, comment: "Todo perfecto", createTime: "2026-07-18T13:00:00.000Z" }]
}, "2026-07-18T13:05:00.000Z");
assert.equal(created.request.status, "reviewed");
assert.equal(attributed.center.summary.reviewsAttributed, 1);
assert.equal(attributed.center.summary.requestClicks, 1);

console.log("Reputation model checks passed: sync, classification, SLA, topics, approval, publication, consent, anti-incentive policy, tracking and attribution.");
