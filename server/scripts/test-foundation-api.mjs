import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-foundation-api-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const adminToken = "foundation-admin-token";
let child;
let logs = "";

try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: adminToken, ADMIN_API_TOKEN: adminToken,
      BUSINESS_USER_SESSION_SECRET: "foundation-user-session-secret-32",
      BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);
  await waitForHealth();

  await jsonRequest(`/api/businesses/${businessId}/money`, { expectedStatus: 401 });
  await jsonRequest(`/api/businesses/${businessId}/crm-config`, { expectedStatus: 401 });
  const contactField = await adminJson(`/api/businesses/${businessId}/crm-config/fields`, { method: "POST", expectedStatus: 201, body: { entityType: "contact", key: "idioma_preferido", label: "Idioma preferido", type: "select", options: ["Espanol", "English"], writeRoles: ["owner", "manager", "sales"] } });
  assert.equal(contactField.item.type, "select");
  const dealField = await adminJson(`/api/businesses/${businessId}/crm-config/fields`, { method: "POST", expectedStatus: 201, body: { entityType: "deal", key: "tamano_evento", label: "Tamano del evento", type: "number", required: true, min: 1, max: 500, writeRoles: ["owner", "manager", "sales"] } });
  assert.equal(dealField.item.required, true);
  const view = await adminJson(`/api/businesses/${businessId}/crm-config/views`, { method: "POST", expectedStatus: 201, body: { entityType: "deal", name: "Eventos grandes", filters: { combinator: "and", conditions: [{ field: "tamano_evento", operator: "gte", value: 30 }] }, columns: ["title", "value", "tamano_evento"], bulkActions: ["assign", "stage", "export"] } });
  assert.equal(view.item.bulkActions.length, 3);
  const pipelines = await adminJson(`/api/businesses/${businessId}/pipelines`);
  const pipeline = pipelines.pipelines[0];
  const rule = await adminJson(`/api/businesses/${businessId}/crm-config/pipeline-rules`, { method: "POST", expectedStatus: 201, body: { pipelineId: pipeline.id, stageId: pipeline.stages[0].id, probability: 12, exitRequirements: [{ field: "tamano_evento", operator: "not_empty" }], automaticTasks: [{ title: "Cualificar evento", dueInHours: 4 }] } });
  assert.equal(rule.item.probability, 12);

  const contact = await adminJson(`/api/businesses/${businessId}/contacts`, { method: "POST", expectedStatus: 201, body: { name: "Cliente Configurable", email: "configurable@example.com", customFields: { idioma_preferido: "espanol" } } });
  assert.equal(contact.contact.customFields.idioma_preferido, "espanol");
  await adminJson(`/api/businesses/${businessId}/contacts/${contact.contact.id}`, { method: "PATCH", expectedStatus: 422, body: { customFields: { idioma_preferido: "frances" } } });
  const deal = await adminJson(`/api/businesses/${businessId}/deals`, { method: "POST", expectedStatus: 201, body: { contactId: contact.contact.id, title: "Evento configurable", value: 2500, currency: "EUR", customFields: { tamano_evento: 60 } } });
  assert.equal(deal.deal.customFields.tamano_evento, 60);
  await adminJson(`/api/businesses/${businessId}/crm-config/validate`, { method: "POST", expectedStatus: 422, body: { entityType: "deal", values: { tamano_evento: 800 } } });

  await adminJson(`/api/businesses/${businessId}/hospitality/invoices`, { method: "POST", expectedStatus: 201, body: { customerName: "Cliente historico preservado", concept: "Evento privado", issueDate: "2026-07-18", dueDate: "2026-08-18", subtotal: 500, taxRate: 10, status: "sent" } });
  const reconciliation = await adminJson(`/api/businesses/${businessId}/money/reconcile`, { method: "POST", body: {} });
  assert.ok(reconciliation.summary.created >= 1);
  const legacy = reconciliation.center.records.find((item) => item.customerName === "Cliente historico preservado");
  assert.equal(legacy.legacyCustomerNamePreserved, true);
  const linked = await adminJson(`/api/businesses/${businessId}/money/${legacy.id}`, { method: "PATCH", body: { contactId: contact.contact.id, customerName: contact.contact.name, lines: [{ description: "Evento privado", quantity: 1, unitPrice: 500, taxRate: 10 }] } });
  assert.equal(linked.record.total, 550);
  const paid = await adminJson(`/api/businesses/${businessId}/money/${legacy.id}/payments`, { method: "POST", expectedStatus: 201, body: { amount: 200, currency: "EUR", provider: "manual", providerPaymentId: "foundation-payment-1" } });
  assert.equal(paid.record.status, "partially_paid");
  assert.equal(paid.record.balance, 350);
  const duplicate = await adminJson(`/api/businesses/${businessId}/money/${legacy.id}/payments`, { method: "POST", body: { amount: 200, currency: "EUR", providerPaymentId: "foundation-payment-1" } });
  assert.equal(duplicate.duplicate, true);

  await createUser("Marta Manager", "manager-foundation@example.com", "manager", "ManagerFoundation2026!");
  await createUser("Oscar Ops", "ops-foundation@example.com", "operations", "OperationsFoundation2026!");
  await createUser("Fina Finance", "finance-foundation@example.com", "finance", "FinanceFoundation2026!");
  const manager = await login("manager-foundation@example.com", "ManagerFoundation2026!");
  const operations = await login("ops-foundation@example.com", "OperationsFoundation2026!");
  const finance = await login("finance-foundation@example.com", "FinanceFoundation2026!");
  assert.ok((await jsonRequest(`/api/businesses/${businessId}/crm-config`, { headers: userHeaders(manager.session.token) })).center.fieldDefinitions.length >= 2);
  await jsonRequest(`/api/businesses/${businessId}/crm-config`, { expectedStatus: 403, headers: userHeaders(operations.session.token) });
  await jsonRequest(`/api/businesses/${businessId}/money`, { expectedStatus: 403, headers: userHeaders(operations.session.token) });
  assert.ok((await jsonRequest(`/api/businesses/${businessId}/money`, { headers: userHeaders(finance.session.token) })).center.records.length >= 1);

  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.ok(persisted.moneyRecords.some((item) => item.contactId === contact.contact.id));
  assert.ok(persisted.customFieldDefinitions.length >= 2);
  assert.ok(persisted.savedViews.some((item) => item.name === "Eventos grandes"));
  assert.ok(persisted.pipelineRules.some((item) => item.automaticTasks[0].title === "Cualificar evento"));
  console.log("Foundation API checks passed: typed custom fields on contacts/deals, compound views, configurable pipeline rules, idempotent money reconciliation, legacy names, linked payments and RBAC.");
} finally {
  if (child && child.exitCode === null) {
    child.kill();
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]);
  }
  await rm(tempDir, { recursive: true, force: true });
}

function createUser(name, email, role, password) { return adminJson(`/api/businesses/${businessId}/security/users`, { method: "POST", expectedStatus: 201, body: { name, email, role, password } }); }
function login(email, password) { return jsonRequest("/api/business-users/login", { method: "POST", body: { business: businessId, email, password } }); }
function userHeaders(token) { return { "X-LocalLift-User-Token": token }; }
function adminJson(pathname, options = {}) { return jsonRequest(pathname, { ...options, headers: { ...options.headers, Authorization: `Bearer ${adminToken}` } }); }
async function jsonRequest(pathname, options = {}) {
  const headers = { ...options.headers };
  const init = { method: options.method || "GET", headers };
  if (options.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); }
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  const expectedStatus = options.expectedStatus || 200;
  if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}\n${logs}`);
  return text ? JSON.parse(text) : {};
}
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (child.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
