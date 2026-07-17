import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const adminToken = "task-test-admin-token-32-characters";
const businessId = "biz_demo_brasa_norte";
let child;
let tempDir;
let dbPath;
let logs = "";

async function main() {
  tempDir = await mkdtemp(path.join(root, ".tmp-task-test-"));
  dbPath = path.join(tempDir, "business-db.json");
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: adminToken,
      CLIENT_SESSION_SECRET: "task-test-client-session-secret-32-characters",
      BUSINESS_STORE: "json",
      BUSINESS_DB_DRIVER: "json",
      DATABASE_URL: "",
      POSTGRES_URL: "",
      LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath,
      BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"),
      BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);
  const health = await waitForHealth(baseUrl);
  assert.equal(health.counts.tasks, 0);
  await jsonRequest(baseUrl, `/api/businesses/${businessId}/tasks`, { expectedStatus: 401 });

  await adminJson(baseUrl, `/api/businesses/${businessId}/portal-access`, { method: "POST", body: { password: "PortalTasks2026!" } });
  const login = await jsonRequest(baseUrl, "/api/client/login", { method: "POST", body: { business: businessId, password: "PortalTasks2026!" } });
  const clientHeaders = { "X-LocalLift-Client-Token": login.session.token };
  const owner = await jsonRequest(baseUrl, `/api/businesses/${businessId}/communications/members`, {
    method: "POST", headers: clientHeaders, expectedStatus: 201, body: { name: "Lucia Comercial", role: "manager" }
  });
  const participant = await jsonRequest(baseUrl, `/api/businesses/${businessId}/communications/members`, {
    method: "POST", headers: clientHeaders, expectedStatus: 201, body: { name: "Mateo Operaciones", role: "employee" }
  });
  const contact = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST", expectedStatus: 201, body: { name: "Cliente con tareas", email: "tasks@example.com" }
  });
  const deal = await adminJson(baseUrl, `/api/businesses/${businessId}/deals`, {
    method: "POST", expectedStatus: 201, body: { contactId: contact.contact.id, title: "Venta con responsable", value: 1800 }
  });

  await adminJson(baseUrl, `/api/businesses/${businessId}/tasks`, {
    method: "POST", expectedStatus: 400, body: { title: "Campo invalido", unexpected: true }
  });
  await adminJson(baseUrl, `/api/businesses/${businessId}/tasks`, {
    method: "POST", expectedStatus: 404, body: { title: "Responsable invalido", ownerId: "team_member_missing" }
  });

  const dueToday = todayAt(16);
  const reminderToday = todayAt(15);
  const first = await adminJson(baseUrl, `/api/businesses/${businessId}/tasks`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      title: "Llamar y confirmar alcance",
      type: "call",
      priority: "high",
      ownerId: owner.member.id,
      participantIds: [participant.member.id],
      dueAt: dueToday,
      reminderAt: reminderToday,
      recurrence: "daily",
      tags: ["venta", "urgente"],
      links: [
        { type: "contact", id: contact.contact.id, kind: "related", isPrimary: true },
        { type: "deal", id: deal.deal.id, kind: "related", isPrimary: true }
      ]
    }
  });
  assert.equal(first.task.owner.name, "Lucia Comercial");
  assert.equal(first.task.participants[0].name, "Mateo Operaciones");
  assert.equal(first.task.relations.length, 2);
  const assignedDeal = await adminJson(baseUrl, `/api/businesses/${businessId}/deals/${deal.deal.id}`);
  assert.equal(assignedDeal.deal.ownerId, owner.member.id, "Assigning a linked task must fill an empty deal owner");

  const overdue = await adminJson(baseUrl, `/api/businesses/${businessId}/tasks`, {
    method: "POST", expectedStatus: 201, body: {
      title: "Seguimiento vencido sin asignar",
      type: "follow_up",
      priority: "urgent",
      dueAt: yesterdayAt(10),
      entityType: "contact",
      entityId: contact.contact.id
    }
  });
  await adminJson(baseUrl, `/api/businesses/${businessId}/tasks`, {
    method: "POST", expectedStatus: 400, body: { title: "Recordatorio posterior", dueAt: todayAt(10), reminderAt: todayAt(11) }
  });
  const dependency = await adminJson(baseUrl, `/api/businesses/${businessId}/tasks`, {
    method: "POST", expectedStatus: 201, body: {
      title: "Preparar dossier",
      type: "proposal",
      ownerId: owner.member.id,
      dependencyIds: [first.task.id],
      links: [{ type: "deal", id: deal.deal.id, kind: "related" }]
    }
  });
  await adminJson(baseUrl, `/api/businesses/${businessId}/tasks/${first.task.id}`, {
    method: "PATCH", expectedStatus: 400, body: { dependencyIds: [dependency.task.id] }
  });

  const queues = await adminJson(baseUrl, `/api/businesses/${businessId}/tasks/queues?ownerId=${encodeURIComponent(owner.member.id)}`);
  assert.equal(queues.members.length, 2);
  assert.ok(queues.queues.today.some((task) => task.id === first.task.id));
  assert.ok(queues.queues.overdue.some((task) => task.id === overdue.task.id));
  assert.ok(queues.queues.unassigned.some((task) => task.id === overdue.task.id));
  assert.ok(queues.queues.mine.some((task) => task.id === first.task.id));
  assert.equal(queues.queues.team.length, 3);
  assert.equal(queues.unownedDeals.length, 0);

  const linkedTasks = await adminJson(baseUrl, `/api/businesses/${businessId}/tasks?entityType=deal&entityId=${encodeURIComponent(deal.deal.id)}`);
  assert.equal(linkedTasks.total, 2, "One deal must support multiple independent tasks");
  const relations = await adminJson(baseUrl, `/api/businesses/${businessId}/tasks/${first.task.id}/relations`);
  assert.deepEqual(new Set(relations.relations.map((relation) => relation.related.type)), new Set(["contact", "deal"]));

  const completed = await adminJson(baseUrl, `/api/businesses/${businessId}/tasks/${first.task.id}`, {
    method: "PATCH", body: { status: "completed", result: "Cliente confirma el alcance" }
  });
  assert.equal(completed.task.status, "completed");
  assert.equal(completed.recurringTask.status, "pending");
  assert.equal(completed.recurringTask.recurrenceParentId, first.task.id);
  assert.equal(completed.recurringTask.relations.length, 2, "Recurring tasks must retain CRM context");
  assert.ok(Date.parse(completed.recurringTask.dueAt) > Date.parse(first.task.dueAt));

  const legacyContact = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST", expectedStatus: 201, body: { name: "Compatibilidad nextAction", email: "legacy-task@example.com" }
  });
  const legacyAction = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts/${legacyContact.contact.id}/next-action`, {
    method: "POST", expectedStatus: 201, body: { type: "email", dueDate: todayAt(18), note: "Seguimiento heredado" }
  });
  assert.ok(legacyAction.nextAction.taskId, "Legacy nextAction writes must project into the task model");
  const legacyTasks = await adminJson(baseUrl, `/api/businesses/${businessId}/tasks?entityType=contact&entityId=${encodeURIComponent(legacyContact.contact.id)}`);
  assert.equal(legacyTasks.total, 1);
  assert.equal(legacyTasks.tasks[0].legacyNextAction, true);
  await adminJson(baseUrl, `/api/businesses/${businessId}/contacts/${legacyContact.contact.id}/next-action`, {
    method: "PATCH", body: { status: "hecha", note: "Seguimiento resuelto" }
  });
  const completedLegacyTask = await adminJson(baseUrl, `/api/businesses/${businessId}/tasks/${legacyAction.nextAction.taskId}`);
  assert.equal(completedLegacyTask.task.status, "completed");

  const otherBusiness = await adminJson(baseUrl, "/api/businesses", {
    method: "POST", expectedStatus: 201, body: { name: "Otro negocio tareas", slug: "otro-negocio-tareas", status: "lead" }
  });
  await adminJson(baseUrl, `/api/businesses/${otherBusiness.business.id}/tasks/${first.task.id}`, { expectedStatus: 404 });
  await adminJson(baseUrl, `/api/businesses/${otherBusiness.business.id}/tasks`, {
    method: "POST", expectedStatus: 404, body: { title: "Cruce de tenant", entityType: "contact", entityId: contact.contact.id }
  });
  const clientTasks = await jsonRequest(baseUrl, `/api/businesses/${businessId}/tasks`, { headers: clientHeaders });
  assert.ok(clientTasks.total >= 4);
  await jsonRequest(baseUrl, `/api/businesses/${otherBusiness.business.id}/tasks`, { headers: clientHeaders, expectedStatus: 403 });

  await adminJson(baseUrl, `/api/businesses/${businessId}/tasks/${dependency.task.id}`, { method: "DELETE" });
  const archived = await adminJson(baseUrl, `/api/businesses/${businessId}/tasks?includeArchived=true`);
  assert.ok(archived.tasks.some((task) => task.id === dependency.task.id && task.archivedAt));
  const finalHealth = await jsonRequest(baseUrl, "/api/health");
  assert.ok(finalHealth.counts.tasks >= 4);
  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.ok(persisted.auditLog.some((entry) => entry.type === "task.created"));
  assert.ok(persisted.auditLog.some((entry) => entry.type === "task.updated" && entry.recurringTaskId));
  assert.ok(persisted.activities.some((entry) => entry.type === "task.created" && entry.contactId === contact.contact.id));
  console.log("Task API checks passed: multiple links, owners, queues, dependencies, recurrence, tenancy, client scope and archive.");
}

function todayAt(hour) { const date = new Date(); date.setHours(hour, 0, 0, 0); return date.toISOString(); }
function yesterdayAt(hour) { const date = new Date(); date.setDate(date.getDate() - 1); date.setHours(hour, 0, 0, 0); return date.toISOString(); }
function adminJson(baseUrl, pathname, options = {}) { return jsonRequest(baseUrl, pathname, { ...options, headers: { ...options.headers, Authorization: `Bearer ${adminToken}` } }); }
async function jsonRequest(baseUrl, pathname, options = {}) {
  const headers = { ...options.headers };
  const init = { method: options.method || "GET", headers };
  if (options.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); }
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  const expectedStatus = options.expectedStatus || 200;
  if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`);
  return text ? JSON.parse(text) : {};
}
async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`);
    try { return await jsonRequest(baseUrl, "/api/health"); } catch { await delay(150); }
  }
  throw new Error(`Healthcheck did not pass.\n${logs}`);
}
function getFreePort() { return new Promise((resolve, reject) => { const server = createServer(); server.unref(); server.on("error", reject); server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

main().catch((error) => { console.error(`Task API test failed: ${error.message}`); if (logs) console.error(logs); process.exitCode = 1; }).finally(async () => {
  if (child && child.exitCode === null) { child.kill(); await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]); }
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});
