import assert from "node:assert/strict";
import {
  acceptWaitlistOffer,
  allocateBookingResources,
  applyBookingCheckoutProviderResult,
  applyBookingStatusPolicy,
  completeBookingCheckout,
  createBookingCheckoutRecord,
  createWaitlistEntry,
  ensureBookingResourceCollections,
  getResourceAvailability,
  normalizeBookingResource,
  normalizeResourceException,
  offerWaitlistSlot,
  replaceResourceSchedule,
  syncBookingResourceAssignments
} from "../lib/booking-resources.mjs";

const now = "2026-07-17T12:00:00.000Z";
const business = { id: "biz_booking", slug: "booking", name: "Reserva Inteligente", currency: "EUR" };
const service = { id: "svc_booking", businessId: business.id, name: "Sesion premium", durationMinutes: 60, price: 100, requiredResourceTypes: ["professional"], defaultPartySize: 1, depositMode: "percent", depositValue: 25 };
const db = ensureBookingResourceCollections({ businesses: [business], services: [service], bookings: [], auditLog: [] });
const laura = normalizeBookingResource({ name: "Laura", type: "professional", serviceIds: [service.id], capacity: 1, bufferBeforeMinutes: 15, bufferAfterMinutes: 15 }, null, business.id, now);
const mario = normalizeBookingResource({ name: "Mario", type: "professional", serviceIds: [service.id], capacity: 1 }, null, business.id, now);
db.bookingResources.push(laura, mario);
replaceResourceSchedule(db, laura, { schedule: [{ weekday: 1, startTime: "09:00", endTime: "18:00", active: true }] }, now);
replaceResourceSchedule(db, mario, { schedule: [{ weekday: 1, startTime: "09:00", endTime: "18:00", active: true }] }, now);

const first = booking("book_first", "2026-07-20T10:00:00.000Z", "2026-07-20T11:00:00.000Z", [laura.id]);
assert.equal(allocateBookingResources(db, first).resourceIds[0], laura.id);
db.bookings.push(first); syncBookingResourceAssignments(db, first, now);
const simultaneous = booking("book_second", first.startsAt, first.endsAt, [mario.id]);
assert.equal(allocateBookingResources(db, simultaneous).resourceIds[0], mario.id, "A second professional must allow a simultaneous booking");
assert.throws(() => allocateBookingResources(db, booking("book_conflict", first.startsAt, first.endsAt, [laura.id])), /not available/);
assert.throws(() => allocateBookingResources(db, booking("book_buffer", "2026-07-20T11:05:00.000Z", "2026-07-20T12:05:00.000Z", [laura.id])), /not available/, "Cleanup buffer must block adjacent appointments");

const exception = normalizeResourceException({ startsAt: "2026-07-20T12:30:00.000Z", endsAt: "2026-07-20T14:00:00.000Z", mode: "blocked", reason: "Formacion" }, null, laura, now);
db.bookingResourceExceptions.push(exception);
assert.equal(getResourceAvailability(db, business.id, { serviceId: service.id, startsAt: "2026-07-20T13:00:00.000Z", partySize: 1 }).resources.find((item) => item.id === laura.id).available, false);

const wait = createWaitlistEntry(db, business, { serviceId: service.id, customerName: "Nora Espera", email: "nora@example.com", desiredStartsAt: "2026-07-20T15:00:00.000Z", flexibleMinutes: 30 }, now);
const offered = offerWaitlistSlot(db, business, { entryId: wait.id, serviceId: service.id, startsAt: "2026-07-20T15:15:00.000Z", endsAt: "2026-07-20T16:15:00.000Z" }, now);
assert.ok(offered.token.length > 30);
const accepted = acceptWaitlistOffer(db, offered.token, "2026-07-17T12:01:00.000Z");
assert.equal(accepted.bookingDraft.waitlistEntryId, wait.id);
assert.equal(wait.status, "accepted");

const paidBooking = { ...simultaneous, depositRequired: true, depositMode: "percent", depositAmount: 25, depositStatus: "pending", guaranteeRequired: true, guaranteeStatus: "pending", currency: "EUR" };
db.bookings.push(paidBooking);
const checkout = createBookingCheckoutRecord(db, business, paidBooking, { idempotencyKey: "deposit-one" }, now);
applyBookingCheckoutProviderResult(db, checkout.checkout.id, { provider: "stripe", providerSessionId: "cs_booking_test", checkoutUrl: "https://checkout.stripe.com/test" }, now);
assert.equal(completeBookingCheckout(db, { id: "evt_booking_test", type: "checkout.session.completed", providerSessionId: "cs_booking_test", providerPaymentId: "pi_booking_test", paidAt: now }, now).completed, true);
assert.equal(paidBooking.depositStatus, "paid");
applyBookingStatusPolicy(paidBooking, "confirmed", "2026-07-20T18:00:00.000Z");
paidBooking.status = "no-show";
applyBookingStatusPolicy(paidBooking, "confirmed", "2026-07-20T18:00:00.000Z");
assert.equal(paidBooking.depositStatus, "forfeited");
assert.equal(paidBooking.guaranteeStatus, "charge_due");
assert.equal(db.bookingResourceAssignments.filter((item) => item.status === "active").length, 1);
console.log("Booking resource model checks passed: resource schedules, buffers, simultaneous staff, exceptions, availability, waitlist offer/acceptance, assignments, deposit reconciliation and no-show policy.");

function booking(id, startsAt, endsAt, resourceIds) { return { id, businessId: business.id, serviceId: service.id, serviceName: service.name, requiredResourceTypes: ["professional"], startsAt, endsAt, status: "confirmed", resourceIds, partySize: 1, customerName: id, email: `${id}@example.com` }; }
