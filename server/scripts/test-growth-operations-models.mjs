import assert from "node:assert/strict";
import {
  addLoyaltyMovement,
  attributeReferral,
  buildLoyaltyCenter,
  convertReferral,
  ensureLoyaltyAccount,
  issueReferralCode,
  redeemLoyaltyReward,
  upsertLoyaltyProgram,
  upsertLoyaltyReward
} from "../lib/loyalty-model.mjs";
import {
  acceptBookingPolicy,
  answerReminderConfirmation,
  assignTableCombination,
  buildOperationalPlanning,
  createReminderConfirmation,
  recordBookingPolicyEvent,
  resolveExperienceDepositRule,
  upsertBookingPolicy,
  upsertHospitalityExperience,
  upsertHospitalityZone,
  upsertServiceShift,
  upsertTableCombination
} from "../lib/vertical-operations-model.mjs";

const businessId = "biz_growth_models";
const now = "2026-07-18T10:00:00.000Z";
const db = {
  businesses: [{ id: businessId, name: "Mesa Modelo" }],
  contacts: [
    { id: "contact_referrer", businessId, name: "Ana Referente" },
    { id: "contact_referred", businessId, name: "Beto Referido" },
    { id: "contact_other", businessId, name: "Carla Otra" }
  ],
  bookingResources: [
    { id: "table_1", businessId, name: "Mesa 1", type: "table", capacity: 4, active: true },
    { id: "table_2", businessId, name: "Mesa 2", type: "table", capacity: 4, active: true }
  ],
  services: [{ id: "service_menu", businessId, name: "Menu especial", durationMinutes: 90 }],
  hospitalityInventory: [
    { id: "stock_wine", businessId, name: "Vino", unit: "bottles", currentStock: 2, minStock: 1, active: true }
  ],
  hospitalityShifts: [
    { id: "staff_shift", businessId, employeeId: "employee_1", date: "2026-07-18", startTime: "12:00", endTime: "14:00", status: "confirmed" }
  ],
  bookings: [
    {
      id: "booking_event",
      businessId,
      contactId: "contact_referred",
      serviceId: "service_menu",
      serviceName: "Menu especial",
      startsAt: "2026-07-18T13:00:00.000Z",
      endsAt: "2026-07-18T14:30:00.000Z",
      partySize: 8,
      status: "confirmed",
      currency: "EUR",
      depositStatus: "paid"
    },
    {
      id: "booking_history",
      businessId,
      contactId: "contact_referrer",
      serviceId: "service_menu",
      startsAt: "2026-07-11T13:00:00.000Z",
      endsAt: "2026-07-11T14:45:00.000Z",
      partySize: 6,
      status: "completed"
    }
  ]
};

const program = upsertLoyaltyProgram(db, businessId, {
  name: "Club Mesa",
  mode: "points",
  earnPerCurrency: 2,
  expirationDays: 30,
  levels: [
    { name: "Base", threshold: 0 },
    { name: "VIP", threshold: 100, multiplier: 1.2 }
  ],
  referral: { enabled: true, referrerReward: 40, referredReward: 20, maxConversionsPerReferrer: 2, attributionDays: 30 }
}, null, now);
assert.equal(program.mode, "points");
const account = ensureLoyaltyAccount(db, businessId, "contact_referrer", now);
const earned = addLoyaltyMovement(db, businessId, {
  accountId: account.id,
  type: "earn",
  amount: 120,
  reason: "Compra",
  idempotencyKey: "purchase-1"
}, { type: "businessUser", id: "owner_1" }, now);
const duplicateEarn = addLoyaltyMovement(db, businessId, {
  accountId: account.id,
  type: "earn",
  amount: 120,
  reason: "Compra",
  idempotencyKey: "purchase-1"
}, {}, now);
assert.equal(duplicateEarn.duplicate, true);
assert.equal(earned.account.level, "VIP");
const correction = addLoyaltyMovement(db, businessId, {
  accountId: account.id,
  type: "correction",
  amount: -10,
  reason: "Correccion auditada"
}, { type: "businessUser", id: "owner_1" }, now);
assert.equal(correction.movement.actorId, "owner_1");
assert.throws(() => addLoyaltyMovement(db, businessId, { accountId: account.id, type: "redeem", amount: 999, reason: "No permitido" }, {}, now), /Insufficient/);
const reward = upsertLoyaltyReward(db, businessId, { name: "Postre", cost: 50, stock: 2 }, null, now);
const redemption = redeemLoyaltyReward(db, businessId, reward.id, { accountId: account.id, idempotencyKey: "reward-1" }, {}, now);
assert.equal(redemption.redemption.status, "issued");
assert.equal(reward.stock, 1);

const code = issueReferralCode(db, businessId, "contact_referrer", now);
assert.throws(() => attributeReferral(db, businessId, { code: code.code, referredContactId: "contact_referrer" }, now), /Self-referrals/);
const attribution = attributeReferral(db, businessId, { code: code.code, referredContactId: "contact_referred", fingerprint: "device-a" }, now);
assert.throws(() => attributeReferral(db, businessId, { code: code.code, referredContactId: "contact_other", fingerprint: "device-a" }, now), /abuse/);
const conversion = convertReferral(db, businessId, attribution.id, { id: "owner_1" }, now);
assert.equal(conversion.attribution.rewardMovementIds.length, 2);
assert.equal(convertReferral(db, businessId, attribution.id, {}, now).duplicate, true);
assert.equal(buildLoyaltyCenter(db, businessId, now).summary.referralsConverted, 1);

const zone = upsertHospitalityZone(db, businessId, { name: "Terraza", resourceIds: ["table_1", "table_2"] }, null, now);
const combination = upsertTableCombination(db, businessId, {
  name: "Terraza unida",
  zoneId: zone.id,
  tableResourceIds: ["table_1", "table_2"],
  minGuests: 6,
  maxGuests: 8
}, null, now);
const serviceShift = upsertServiceShift(db, businessId, {
  name: "Comida",
  weekdays: [5, 6, 0],
  startTime: "13:00",
  endTime: "16:30",
  expectedDurationMinutes: 90,
  turnoverBufferMinutes: 15,
  maxCovers: 40
}, null, now);
const policy = upsertBookingPolicy(db, businessId, {
  name: "Cancelacion grupos",
  version: "2026-07",
  visibleText: "Cancelacion gratuita hasta 48 horas antes. Despues se revisa la señal.",
  cancellationHours: 48,
  refundPercentBeforeDeadline: 100,
  refundPercentAfterDeadline: 20,
  noShowDepositTreatment: "review",
  disputeInstructions: "Contacta con el responsable del local."
}, null, now);
const experience = upsertHospitalityExperience(db, businessId, {
  name: "Menu terraza",
  type: "menu",
  serviceId: "service_menu",
  zoneIds: [zone.id],
  serviceShiftIds: [serviceShift.id],
  minGuests: 4,
  maxGuests: 20,
  capacity: 20,
  inventoryRules: [{ inventoryItemId: "stock_wine", quantityPerGuest: 0.5 }],
  depositRules: [
    { id: "vip-summer", validFrom: "2026-07-01", validTo: "2026-08-31", segments: ["vip"], mode: "percent", value: 20, priority: 10 },
    { id: "base", mode: "fixed", value: 10, priority: 1 }
  ],
  policyId: policy.id
}, null, now);
db.bookings[0].experienceId = experience.id;
assert.equal(resolveExperienceDepositRule(experience, "2026-07-18", ["vip"]).id, "vip-summer");
assert.equal(resolveExperienceDepositRule(experience, "2026-09-18", ["new"]).id, "base");
assert.deepEqual(assignTableCombination(db, businessId, "booking_event", combination.id, now).booking.resourceIds, ["table_1", "table_2"]);

const acceptance = acceptBookingPolicy(db, businessId, "booking_event", {
  policyId: policy.id,
  accepted: true,
  channel: "public",
  ip: "127.0.0.1",
  userAgent: "model-test"
}, { type: "contact", id: "contact_referred" }, now);
assert.equal(acceptance.event.policyTextSnapshot, policy.visibleText);
assert.equal(acceptBookingPolicy(db, businessId, "booking_event", { policyId: policy.id, accepted: true }, {}, now).duplicate, true);
const dispute = recordBookingPolicyEvent(db, businessId, "booking_event", { type: "dispute_opened", amount: 20, reason: "Cliente solicita revision" }, { id: "owner_1" }, now);
assert.equal(dispute.actorId, "owner_1");
assert.equal(db.bookings[0].depositStatus, "disputed");
recordBookingPolicyEvent(db, businessId, "booking_event", { type: "refunded", amount: 20, reason: "Devolucion aprobada" }, { id: "owner_1" }, now);
assert.equal(db.bookings[0].depositStatus, "refunded");

const reminder = createReminderConfirmation(db, businessId, "booking_event", { expiresInHours: 24 }, now);
assert.ok(reminder.token);
const confirmed = answerReminderConfirmation(db, reminder.token, "confirm", "2026-07-18T11:00:00.000Z");
assert.equal(confirmed.confirmation.status, "confirmed");
assert.equal(answerReminderConfirmation(db, reminder.token, "confirm", "2026-07-18T12:00:00.000Z").duplicate, true);

const planning = buildOperationalPlanning(db, businessId, { startDate: "2026-07-18", days: 3 });
assert.equal(planning.daily.length, 3);
assert.ok(planning.summary.forecastCovers >= 8);
assert.ok(planning.stock.find((item) => item.inventoryItemId === "stock_wine").critical);
assert.ok(planning.alerts.some((item) => item.type === "stock" && item.sourceUrl.includes("inventory")));
assert.ok(planning.alerts.some((item) => item.type === "staff" && item.sourceUrl.includes("team")));

console.log("Growth and vertical operations model checks passed: immutable loyalty, expiry-ready balances, rewards, anti-abuse referrals, zones, table combinations, service shifts, experiences, date/segment deposits, policy evidence, refunds, public confirmations and actionable planning.");
