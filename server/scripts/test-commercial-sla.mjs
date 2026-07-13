import assert from "node:assert/strict";
import {
  buildCommercialSla,
  isMeaningfulCommercialActivity,
  normalizeSlaHours
} from "../lib/commercial-sla.mjs";

const business = { id: "biz_a", name: "Negocio A" };
const db = {
  contacts: [
    contact("lead_2h", "2026-07-10T08:00:00.000Z"),
    contact("lead_4h", "2026-07-10T08:00:00.000Z"),
    contact("lead_untouched", "2026-07-10T08:00:00.000Z"),
    contact("lead_recent", "2026-07-13T09:30:00.000Z"),
    contact("lead_lost", "2026-07-01T08:00:00.000Z", { status: "lost" }),
    contact("lead_merged", "2026-07-01T08:00:00.000Z", { merged: true }),
    contact("lead_other", "2026-07-01T08:00:00.000Z", { businessId: "biz_b" }),
    contact("lead_invalid", "not-a-date"),
    contact("lead_future", "2026-07-14T08:00:00.000Z")
  ],
  activities: [
    activity("created_2h", "lead_2h", "lead.created", "2026-07-10T08:00:00.000Z", "web"),
    activity("booking_2h", "lead_2h", "booking.created", "2026-07-10T08:30:00.000Z", "booking"),
    activity("response_2h", "lead_2h", "contact.status_changed", "2026-07-10T10:00:00.000Z", "dashboard"),
    activity("later_2h", "lead_2h", "note", "2026-07-10T14:00:00.000Z", "dashboard"),
    activity("scheduled_4h", "lead_4h", "next_action.created", "2026-07-10T09:00:00.000Z", "automation"),
    activity("response_4h", "lead_4h", "note", "2026-07-10T12:00:00.000Z", "dashboard"),
    activity("other_business", "lead_untouched", "note", "2026-07-10T09:00:00.000Z", "dashboard", { businessId: "biz_b" }),
    activity("future_response", "lead_untouched", "note", "2026-07-14T09:00:00.000Z", "dashboard")
  ]
};

const report = buildCommercialSla(db, business, {
  hours: 24,
  now: new Date("2026-07-13T10:00:00.000Z")
});

assert.equal(report.totalContacts, 5);
assert.equal(report.responded, 2);
assert.equal(report.notResponded, 3);
assert.equal(report.withinSla, 2);
assert.equal(report.complianceRate, 100);
assert.equal(report.averageFirstResponseMinutes, 180);
assert.equal(report.medianFirstResponseMinutes, 180);
assert.equal(report.responses.find((row) => row.contactId === "lead_2h").firstResponseTimeMinutes, 120);
assert.deepEqual(report.untouched.map((contact) => contact.id), ["lead_untouched"]);
assert.equal(report.untouched[0].ageHours, 74);

assert.equal(isMeaningfulCommercialActivity({ type: "lead.created", source: "web" }), false);
assert.equal(isMeaningfulCommercialActivity({ type: "note", source: "dashboard", note: "Respondido" }), true);
assert.equal(isMeaningfulCommercialActivity({ type: "note", source: "crm-automation", note: "Automatica" }), false);
assert.equal(isMeaningfulCommercialActivity({ type: "proposal.created", source: "crm-proposals", note: "Borrador" }), false);
assert.equal(isMeaningfulCommercialActivity({ type: "proposal.status_changed", source: "crm-proposals", note: "Enviada" }), true);
assert.equal(isMeaningfulCommercialActivity({ type: "custom", source: "system", note: "Automatica" }), false);
assert.equal(normalizeSlaHours("12.5"), 12.5);
assert.equal(normalizeSlaHours(""), 24);
assert.throws(() => normalizeSlaHours(0), /between/);
assert.throws(() => normalizeSlaHours(3000), /between/);

console.log("Commercial SLA tests passed.");

function contact(id, createdAt, overrides = {}) {
  return {
    id,
    businessId: "biz_a",
    type: "lead",
    status: "new",
    name: id,
    createdAt,
    ...overrides
  };
}

function activity(id, contactId, type, createdAt, source, overrides = {}) {
  return {
    id,
    businessId: "biz_a",
    contactId,
    type,
    source,
    note: type,
    createdAt,
    ...overrides
  };
}
