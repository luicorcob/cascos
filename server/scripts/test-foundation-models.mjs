import assert from "node:assert/strict";
import { createMoneyPayment, reconcileMoneyRecords, updateMoneyRecord } from "../lib/money-model.mjs";
import {
  buildCrmConfigCenter,
  upsertCustomFieldDefinition,
  upsertPipelineRule,
  upsertSavedView,
  validateCustomFieldValues
} from "../lib/crm-config-model.mjs";

const businessId = "biz_foundation_model";
const db = {
  invoices: [{
    id: "invoice_general",
    businessId,
    contactId: "contact_1",
    accountId: "account_1",
    customerName: "Cliente General",
    number: "F-001",
    currency: "eur",
    status: "sent",
    issueDate: "2026-07-01",
    dueDate: "2026-07-30",
    lines: [{ description: "Servicio", quantity: 2, unitPrice: 100, taxRate: 21 }],
    proposalId: "proposal_1",
    projectId: "project_1",
    subscriptionId: "subscription_1",
    createdAt: "2026-07-01T10:00:00.000Z"
  }],
  hospitalityInvoices: [{
    id: "invoice_legacy",
    businessId,
    customerName: "Nombre historico sin ID",
    concept: "Evento privado",
    subtotal: 300,
    taxRate: 10,
    status: "draft",
    issueDate: "2026-07-02",
    dueDate: "2026-08-02",
    createdAt: "2026-07-02T10:00:00.000Z"
  }],
  payments: [],
  associations: [],
  moneyRecords: [],
  customFieldDefinitions: [],
  savedViews: [],
  pipelineRules: [],
  pipelines: [{
    id: "pipeline_sales",
    businessId,
    name: "Ventas",
    stages: [{ id: "new", name: "Nuevo", probability: 10 }, { id: "won", name: "Ganada", probability: 100 }]
  }, {
    id: "pipeline_partners",
    businessId,
    name: "Partners",
    stages: [{ id: "qualified", name: "Cualificado", probability: 50 }]
  }]
};

const first = reconcileMoneyRecords(db, businessId, "2026-07-18T12:00:00.000Z");
assert.equal(first.summary.created, 2);
const second = reconcileMoneyRecords(db, businessId, "2026-07-18T13:00:00.000Z");
assert.equal(second.summary.created, 0);
assert.equal(second.summary.unchanged, 2);
const general = db.moneyRecords.find((item) => item.sourceId === "invoice_general");
const legacy = db.moneyRecords.find((item) => item.sourceId === "invoice_legacy");
assert.equal(general.currency, "EUR");
assert.equal(general.subtotal, 200);
assert.equal(general.taxTotal, 42);
assert.equal(general.total, 242);
assert.equal(general.proposalId, "proposal_1");
assert.equal(legacy.customerName, "Nombre historico sin ID");
assert.equal(legacy.legacyCustomerNamePreserved, true);

const updated = updateMoneyRecord(db, businessId, legacy.id, {
  contactId: "contact_legacy",
  accountId: "account_legacy",
  currency: "EUR",
  lines: [{ description: "Evento", quantity: 1, unitPrice: 300, taxRate: 10 }]
}, "2026-07-18T13:10:00.000Z");
assert.equal(updated.total, 330);
assert.equal(db.hospitalityInvoices[0].contactId, "contact_legacy");
const payment = createMoneyPayment(db, businessId, legacy.id, { amount: 100, currency: "EUR", provider: "manual", providerPaymentId: "payment-model-1" }, "2026-07-18T13:11:00.000Z");
assert.equal(payment.record.status, "partially_paid");
assert.equal(payment.record.balance, 230);
assert.equal(createMoneyPayment(db, businessId, legacy.id, { amount: 100, currency: "EUR", providerPaymentId: "payment-model-1" }).duplicate, true);

const field = upsertCustomFieldDefinition(db, businessId, {
  entityType: "deal",
  key: "numero_comensales",
  label: "Numero de comensales",
  type: "number",
  required: true,
  min: 1,
  max: 500,
  readRoles: ["owner", "manager", "sales", "operations"],
  writeRoles: ["owner", "manager", "sales"]
});
assert.equal(field.key, "numero_comensales");
assert.deepEqual(validateCustomFieldValues(db, businessId, "deal", { numero_comensales: 40 }, "sales"), { valid: true, values: { numero_comensales: 40 }, errors: [] });
assert.equal(validateCustomFieldValues(db, businessId, "deal", { numero_comensales: 0 }, "sales").valid, false);
assert.equal(validateCustomFieldValues(db, businessId, "deal", { numero_comensales: 40 }, "operations").valid, false);

const view = upsertSavedView(db, businessId, {
  entityType: "deal",
  name: "Grandes eventos abiertos",
  filters: { combinator: "and", conditions: [{ field: "status", operator: "eq", value: "open" }], groups: [{ combinator: "or", conditions: [{ field: "numero_comensales", operator: "gte", value: 20 }, { field: "value", operator: "gte", value: 1000 }] }] },
  columns: ["title", "value", "numero_comensales"],
  bulkActions: ["assign", "stage", "export"]
});
assert.equal(view.filters.groups.length, 1);
assert.ok(view.bulkActions.includes("export"));
const rule = upsertPipelineRule(db, businessId, {
  pipelineId: "pipeline_sales",
  stageId: "new",
  probability: 15,
  entryConditions: { conditions: [{ field: "contactId", operator: "not_empty" }] },
  exitRequirements: [{ field: "numero_comensales", operator: "not_empty" }],
  automaticTasks: [{ title: "Cualificar oportunidad", dueInHours: 4 }]
});
assert.equal(rule.probability, 15);
assert.equal(buildCrmConfigCenter(db, businessId).pipelines.length, 2);

console.log("Foundation model checks passed: idempotent money normalization, legacy customer preservation, taxes, links, payments, typed custom fields, role validation, compound views and pipeline rules.");
