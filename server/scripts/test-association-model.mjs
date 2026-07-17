import assert from "node:assert/strict";
import {
  ASSOCIATION_ENTITY_COLLECTIONS,
  findBusinessEntity,
  listEntityAssociations,
  moveAssociationEntity,
  upsertAssociation
} from "../lib/association-model.mjs";

const businessId = "biz_relations";
const now = "2026-07-17T12:00:00.000Z";
const db = {
  contacts: [{ id: "contact_one", businessId, name: "Persona" }],
  accounts: [{ id: "account_one", businessId, name: "Cuenta" }],
  deals: [{ id: "deal_one", businessId, title: "Oportunidad" }],
  tasks: [{ id: "task_one", businessId, title: "Tarea" }],
  proposals: [{ id: "proposal_one", businessId, title: "Propuesta" }],
  bookings: [{ id: "booking_one", businessId, customerName: "Reserva" }],
  invoices: [{ id: "invoice_one", businessId, concept: "Factura" }],
  hospitalityInvoices: [{ id: "hospitality_invoice_one", businessId, concept: "Factura operativa" }],
  projects: [{ id: "project_one", businessId, name: "Proyecto" }],
  communicationThreads: [{ id: "conversation_one", businessId, title: "Conversacion" }],
  associations: []
};

for (const [type, collection] of Object.entries(ASSOCIATION_ENTITY_COLLECTIONS)) {
  const record = db[collection][0];
  assert.equal(findBusinessEntity(db, businessId, type, record.id), record, `${type} must resolve inside its business`);
  assert.equal(findBusinessEntity(db, "biz_other", type, record.id), null, `${type} must not cross tenant boundaries`);
  if (type === "account") continue;
  const result = upsertAssociation(db, {
    businessId,
    fromType: "account",
    fromId: "account_one",
    toType: type,
    toId: record.id,
    kind: "related",
    now
  });
  assert.equal(result.created, true);
}

const accountRelations = listEntityAssociations(db, businessId, "account", "account_one");
assert.equal(accountRelations.length, Object.keys(ASSOCIATION_ENTITY_COLLECTIONS).length - 1);
assert.deepEqual(
  new Set(accountRelations.map((association) => association.toType)),
  new Set(["contact", "deal", "task", "proposal", "booking", "invoice", "hospitalityInvoice", "project", "conversation"])
);

db.accounts.push({ id: "account_duplicate", businessId, name: "Cuenta duplicada" });
upsertAssociation(db, {
  businessId,
  fromType: "account",
  fromId: "account_duplicate",
  toType: "deal",
  toId: "deal_one",
  kind: "related",
  now
});
moveAssociationEntity(db, businessId, "account", ["account_duplicate"], "account_one", now);
const dealLinks = listEntityAssociations(db, businessId, "deal", "deal_one").filter((association) => !association.archivedAt);
assert.equal(dealLinks.length, 1, "Moving a merged account must deduplicate identical associations");

console.log("Association model checks passed: every CRM, task, booking, money, project and conversation entity is linkable and tenant-safe.");
