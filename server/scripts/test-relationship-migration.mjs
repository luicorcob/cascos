import assert from "node:assert/strict";
import { backfillBusinessAssociations } from "../lib/relationship-migration.mjs";

const businessId = "biz_migration";
const db = {
  contacts: [{ id: "contact_1", businessId }],
  accounts: [{ id: "account_1", businessId }],
  deals: [{ id: "deal_1", businessId, contactId: "contact_1", accountId: "account_1" }],
  proposals: [{ id: "proposal_1", businessId, contactId: "contact_1", dealId: "deal_1", accountId: "account_1" }],
  bookings: [{ id: "booking_1", businessId, contactId: "contact_1", accountId: "account_1" }],
  projects: [{ id: "project_1", businessId, contactId: "contact_1", proposalId: "proposal_1", accountId: "account_1" }],
  invoices: [{ id: "invoice_1", businessId, projectId: "project_1", proposalId: "proposal_1", contactId: "contact_1", accountId: "account_1" }],
  hospitalityInvoices: [{ id: "hospitality_invoice_1", businessId, contactId: "contact_1", accountId: "account_1" }],
  communicationThreads: [{ id: "conversation_1", businessId, contactId: "contact_1", accountId: "account_1", dealId: "deal_1" }],
  associations: []
};

const first = backfillBusinessAssociations(db, { now: "2026-07-17T12:00:00.000Z" });
assert.equal(first.skipped, 0);
assert.ok(first.created >= 15);
assert.ok(db.associations.some((item) => item.fromType === "contact" && item.toType === "booking"));
assert.ok(db.associations.some((item) => item.fromType === "project" && item.toType === "invoice"));
assert.ok(db.associations.some((item) => item.fromType === "hospitalityInvoice" && item.toType === "account"));
assert.ok(db.associations.some((item) => item.fromType === "conversation" && item.toType === "deal"));
const count = db.associations.length;

const second = backfillBusinessAssociations(db, { now: "2026-07-17T13:00:00.000Z" });
assert.equal(second.created, 0);
assert.equal(second.existing, first.candidates);
assert.equal(db.associations.length, count, "Association backfill must be idempotent");

console.log("Relationship migration checks passed: direct CRM and operations references backfill idempotently.");
