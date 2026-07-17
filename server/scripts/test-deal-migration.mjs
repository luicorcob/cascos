import assert from "node:assert/strict";
import { migrateContactsToDeals } from "../lib/deal-migration.mjs";

const now = "2026-07-17T10:00:00.000Z";
const db = {
  businesses: [
    { id: "biz_one", name: "Uno", content: { currency: "EUR" } },
    { id: "biz_two", name: "Dos", content: { currency: "USD" } }
  ],
  contacts: [
    {
      id: "contact_open",
      businessId: "biz_one",
      name: "Lead abierto",
      type: "lead",
      status: "contacted",
      priority: "alta",
      valueEstimate: 1200.5,
      createdAt: "2026-07-01T10:00:00.000Z"
    },
    {
      id: "contact_lost",
      businessId: "biz_one",
      name: "Lead perdido",
      type: "lead",
      status: "lost",
      lostReason: "precio",
      valueEstimate: 300
    },
    { id: "contact_customer", businessId: "biz_one", name: "Cliente", type: "customer", status: "customer" },
    { id: "contact_merged", businessId: "biz_one", name: "Fusionado", type: "lead", status: "new", merged: true },
    { id: "contact_other", businessId: "biz_two", name: "Otro", type: "lead", status: "reserved", valueEstimate: 50 }
  ],
  pipelines: [],
  deals: []
};

const first = migrateContactsToDeals(db, { now });
assert.equal(first.businessesScanned, 2);
assert.equal(first.contactsScanned, 3, "Customers and merged contacts must not become legacy deals");
assert.equal(first.pipelinesCreated, 2);
assert.equal(first.dealsCreated, 3);
assert.equal(db.deals.filter((deal) => deal.contactId === "contact_open").length, 1);
assert.equal(db.deals.find((deal) => deal.contactId === "contact_open")?.stageId, "contacted");
assert.equal(db.deals.find((deal) => deal.contactId === "contact_open")?.value, 1200.5);
assert.equal(db.deals.find((deal) => deal.contactId === "contact_lost")?.status, "lost");
assert.equal(db.deals.find((deal) => deal.contactId === "contact_lost")?.lostReason, "precio");
assert.equal(db.deals.find((deal) => deal.contactId === "contact_other")?.currency, "USD");

const second = migrateContactsToDeals(db, { now: "2026-07-17T11:00:00.000Z" });
assert.equal(second.pipelinesCreated, 0);
assert.equal(second.dealsCreated, 0);
assert.equal(second.dealsSkipped, 3);
assert.equal(db.deals.length, 3, "The migration must be idempotent");

console.log("Deal migration checks passed: additive defaults, legacy mapping, tenant scope and idempotence.");
