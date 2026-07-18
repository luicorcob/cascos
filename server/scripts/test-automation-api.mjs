import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-automation-api-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const otherBusinessId = "biz_demo_luz_habitat";
const adminToken = "automation-admin-token";
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
      CLIENT_SESSION_SECRET: "automation-client-session-secret-32",
      BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  child.stdout.on("data", appendLog); child.stderr.on("data", appendLog); await waitForHealth();

  await jsonRequest(`/api/businesses/${businessId}/automations`, { expectedStatus: 401 });
  const seeded = await adminJson(`/api/businesses/${businessId}/automations/recipes/seed`, { method: "POST", body: {} });
  assert.equal(seeded.created.length, 4);
  assert.equal((await adminJson(`/api/businesses/${businessId}/automations/recipes/seed`, { method: "POST", body: {} })).created.length, 0);

  const lead = await jsonRequest("/api/public/brasa-norte/leads", { method: "POST", expectedStatus: 201, body: { name: "Ada Automatizada", email: "ada-automation@example.com", message: "Quiero informacion", privacyAccepted: true, privacyAcceptedAt: new Date().toISOString(), privacyPolicyUrl: "https://example.com/privacidad" } });
  const contacts = await adminJson(`/api/businesses/${businessId}/contacts`);
  const contact = contacts.contacts.find((item) => item.id === lead.contact.id);
  assert.ok(contact);
  const created = await adminJson(`/api/businesses/${businessId}/automations`, {
    method: "POST", expectedStatus: 201,
    body: {
      name: "Seguimiento API", kind: "automation", trigger: { type: "manual" },
      nodes: [
        { id: "start", type: "trigger", label: "Manual", config: { type: "manual" } },
        { id: "condition", type: "condition", label: "Existe contacto", config: { field: "contact.id", operator: "exists" } },
        { id: "task", type: "action", label: "Crear tarea", config: { action: "create_task", title: "Llamar a {{contact.name}}", taskType: "call", priority: "high", dueInMinutes: 15 } },
        { id: "tag", type: "action", label: "Etiquetar", config: { action: "add_tag", tag: "seguimiento-api" } },
        { id: "end", type: "exit", label: "Fin", config: {} }
      ]
    }
  });
  const automationId = created.automation.id;
  assert.equal(created.automation.draftVersion, 1);
  const updated = await adminJson(`/api/businesses/${businessId}/automations/${automationId}`, { method: "PATCH", body: { description: "Editada desde API" } });
  assert.equal(updated.automation.description, "Editada desde API");
  const published = await adminJson(`/api/businesses/${businessId}/automations/${automationId}/publish`, { method: "POST", body: {} });
  assert.equal(published.automation.status, "published");
  assert.equal(published.automation.draftVersion, 2);

  const testRun = await adminJson(`/api/businesses/${businessId}/automations/${automationId}/test`, { method: "POST", body: { contactId: contact.id, context: { contact } } });
  assert.equal(testRun.run.status, "test_completed");
  assert.equal(testRun.run.actionsExecuted, 2);
  assert.ok(testRun.logs.filter((item) => item.status === "simulated").length >= 2);

  const beforeStore = JSON.parse(await readFile(dbPath, "utf8"));
  const beforeTasks = beforeStore.tasks.length;
  const runPayload = { contactId: contact.id, event: { id: "manual-api-event-1", type: "manual", contactId: contact.id }, idempotencyKey: "manual-api-run-1" };
  const run = await adminJson(`/api/businesses/${businessId}/automations/${automationId}/run`, { method: "POST", expectedStatus: 201, body: runPayload });
  assert.equal(run.run.status, "completed");
  assert.equal(run.run.actionsExecuted, 2);
  const duplicate = await adminJson(`/api/businesses/${businessId}/automations/${automationId}/run`, { method: "POST", body: runPayload });
  assert.equal(duplicate.duplicate, true);
  const runs = await adminJson(`/api/businesses/${businessId}/automations/${automationId}/runs`);
  assert.ok(runs.runs.find((item) => item.id === run.run.id).logs.some((item) => item.event === "node.action"));

  const afterStore = JSON.parse(await readFile(dbPath, "utf8"));
  assert.equal(afterStore.tasks.length, beforeTasks + 1, "Test runs must not create tasks and real run must create exactly one");
  assert.ok(afterStore.contacts.find((item) => item.id === contact.id).tags.includes("seguimiento-api"));

  const sequence = await adminJson(`/api/businesses/${businessId}/automations`, {
    method: "POST", expectedStatus: 201,
    body: {
      name: "Secuencia API", kind: "sequence", trigger: { type: "sequence.enrolled" }, stopConditions: ["reply", "booking", "unsubscribe"], quietHours: { enabled: false },
      nodes: [
        { id: "start", type: "trigger", label: "Alta", config: { type: "sequence.enrolled" } },
        { id: "wait", type: "wait", label: "Esperar", config: { minutes: 60 } },
        { id: "task", type: "action", label: "Tarea", config: { action: "create_task", title: "Segundo seguimiento" } },
        { id: "end", type: "exit", label: "Fin", config: {} }
      ]
    }
  });
  await adminJson(`/api/businesses/${businessId}/automations/${sequence.automation.id}/publish`, { method: "POST", body: {} });
  const preview = await adminJson(`/api/businesses/${businessId}/sequences/preview`, { method: "POST", body: { automationId: sequence.automation.id, contactIds: [contact.id, "missing-contact"] } });
  assert.equal(preview.preview.eligible.length, 1);
  assert.equal(preview.preview.blocked.length, 1);
  assert.equal(preview.preview.steps.length, 4);
  const enrolled = await adminJson(`/api/businesses/${businessId}/sequences/enrollments`, { method: "POST", expectedStatus: 201, body: { automationId: sequence.automation.id, contactId: contact.id } });
  assert.equal(enrolled.enrollment.status, "active");
  assert.equal(enrolled.enrollment.run.status, "waiting");
  const stopped = await adminJson(`/api/businesses/${businessId}/sequences/signals`, { method: "POST", body: { contactId: contact.id, signal: "reply" } });
  assert.ok(stopped.stopped.some((item) => item.id === enrolled.enrollment.id));
  assert.equal(stopped.stopped.find((item) => item.id === enrolled.enrollment.id).metrics.responses, 1);
  assert.equal((await adminJson(`/api/businesses/${businessId}/sequences/enrollments?contactId=${contact.id}`)).enrollments.find((item) => item.id === enrolled.enrollment.id).status, "stopped");

  const eventAutomation = seeded.automations.find((item) => item.recipeKey === "new-lead-response");
  await adminJson(`/api/businesses/${businessId}/automations/${eventAutomation.id}/publish`, { method: "POST", body: {} });
  const dispatched = await adminJson(`/api/businesses/${businessId}/automations/events`, { method: "POST", body: { event: { id: "contact-created-dispatch", type: "record.created", entity: "contact", entityId: contact.id, contactId: contact.id } } });
  assert.ok(dispatched.matched >= 1);

  await adminJson(`/api/businesses/${businessId}/portal-access`, { method: "POST", body: { password: "AutomationPortal2026!" } });
  const login = await jsonRequest("/api/client/login", { method: "POST", body: { business: businessId, password: "AutomationPortal2026!" } });
  const clientHeaders = { "X-LocalLift-Client-Token": login.session.token };
  assert.ok((await jsonRequest(`/api/businesses/${businessId}/automations`, { headers: clientHeaders })).automations.length >= 1);
  await jsonRequest(`/api/businesses/${businessId}/automations`, { method: "POST", headers: clientHeaders, expectedStatus: 403, body: { name: "No permitido" } });
  await jsonRequest(`/api/businesses/${otherBusinessId}/automations`, { headers: clientHeaders, expectedStatus: 403 });

  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.ok(persisted.automations.length >= 6);
  assert.ok(persisted.automationVersions.length >= persisted.automations.length);
  assert.ok(persisted.automationRuns.length >= 4);
  assert.ok(persisted.automationRunLogs.some((item) => item.event === "run.completed"));
  assert.ok(persisted.sequenceEnrollments.some((item) => item.status === "stopped"));
  assert.ok(persisted.auditLog.some((item) => item.type === "automation.published"));
  console.log("Automation API checks passed: recipes, CRUD, version publish, test mode, real actions, idempotency, logs, event dispatch, sequences, stops, tenancy and client read-only access.");
} finally {
  if (child && child.exitCode === null) { child.kill(); await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]); }
  await rm(tempDir, { recursive: true, force: true });
}

function adminJson(pathname, options = {}) { return jsonRequest(pathname, { ...options, headers: { ...options.headers, Authorization: `Bearer ${adminToken}` } }); }
async function jsonRequest(pathname, options = {}) { const headers = { ...options.headers }; const init = { method: options.method || "GET", headers }; if (options.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); } const response = await fetch(`${baseUrl}${pathname}`, init); const text = await response.text(); const expectedStatus = options.expectedStatus || 200; if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`); return text ? JSON.parse(text) : {}; }
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (child.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
