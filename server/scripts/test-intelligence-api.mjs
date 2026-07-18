import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-intelligence-api-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const otherBusinessId = "biz_demo_luz_habitat";
const adminToken = "intelligence-admin-token";
let child;
let logs = "";

try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  const seed = JSON.parse(await readFile(dbPath, "utf8"));
  Object.assign(seed, {
    contacts: [
      { id: "contact_intel_a", businessId, name: "Ana Intel", email: "ana-intel@example.com", source: "google", status: "customer", createdAt: "2026-01-02T10:00:00.000Z" },
      { id: "contact_intel_b", businessId, name: "Beto Intel", email: "beto-intel@example.com", source: "campaign", status: "customer", createdAt: "2026-02-02T10:00:00.000Z" }
    ],
    pipelines: [{
      id: "pipeline_intelligence",
      businessId,
      name: "Pipeline Intelligence",
      stages: [{ id: "qualified", name: "Cualificada", probability: 30 }, { id: "won", name: "Ganada", probability: 100 }]
    }],
    deals: [
      { id: "deal_intel_a", businessId, contactId: "contact_intel_a", pipelineId: "pipeline_intelligence", stageId: "qualified", status: "won", createdAt: "2026-01-03T10:00:00.000Z" },
      { id: "deal_intel_b", businessId, contactId: "contact_intel_b", pipelineId: "pipeline_intelligence", stageId: "qualified", status: "lost", createdAt: "2026-02-03T10:00:00.000Z" }
    ],
    proposals: [{ id: "proposal_intel_a", businessId, contactId: "contact_intel_a", status: "accepted", acceptedAt: "2026-01-04T10:00:00.000Z", createdAt: "2026-01-04T09:00:00.000Z" }],
    bookings: [
      { id: "booking_intel_a1", businessId, contactId: "contact_intel_a", customerName: "Ana Intel", serviceName: "Cena", status: "completed", startsAt: "2026-01-10T20:00:00.000Z", endsAt: "2026-01-10T21:30:00.000Z", partySize: 2 },
      { id: "booking_intel_a2", businessId, contactId: "contact_intel_a", customerName: "Ana Intel", serviceName: "Cena", status: "completed", startsAt: "2026-02-10T20:00:00.000Z", endsAt: "2026-02-10T21:30:00.000Z", partySize: 2 },
      { id: "booking_intel_b", businessId, contactId: "contact_intel_b", customerName: "Beto Intel", serviceName: "Menu", status: "confirmed", startsAt: "2026-07-18T13:00:00.000Z", endsAt: "2026-07-18T14:30:00.000Z", partySize: 6, depositRequired: true, depositStatus: "pending" }
    ],
    moneyRecords: [
      { id: "money_intel_a", businessId, contactId: "contact_intel_a", customerName: "Ana Intel", status: "paid", total: 250, paidAmount: 250, currency: "EUR", dealId: "deal_intel_a", createdAt: "2026-01-11T10:00:00.000Z" }
    ],
    tasks: [{ id: "task_intel_overdue", businessId, title: "Seguimiento Intel", status: "open", dueAt: "2026-07-17T09:00:00.000Z" }],
    communicationThreads: [{ id: "thread_intel", businessId, contactId: "contact_intel_a", subject: "Alergias Intel", updatedAt: "2026-07-18T09:00:00.000Z" }],
    communicationMessages: [{ id: "message_intel", businessId, threadId: "thread_intel", body: "Necesitamos confirmar una alergia.", occurredAt: "2026-07-18T09:00:00.000Z" }],
    bookingResources: [{ id: "capacity_intel", businessId, name: "Aforo Intel", type: "capacity", capacity: 20, active: true }],
    hospitalityInventory: [{ id: "stock_intel", businessId, name: "Pescado Intel", unit: "kg", currentStock: 1, minStock: 2, active: true }],
    hospitalityExperiences: [],
    hospitalityShifts: []
  });
  await writeFile(dbPath, JSON.stringify(seed, null, 2), "utf8");

  child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: adminToken,
      ADMIN_API_TOKEN: adminToken,
      BUSINESS_USER_SESSION_SECRET: "intelligence-user-session-secret-32",
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
  await waitForHealth();

  await jsonRequest(`/api/businesses/${businessId}/intelligence`, { expectedStatus: 401 });
  const initial = await adminJson(`/api/businesses/${businessId}/intelligence?now=2026-07-18T10:00:00.000Z`);
  assert.equal(initial.center.analytics.metrics.find((item) => item.key === "revenue.total").value, 250);
  assert.ok(initial.center.analytics.metrics.every((item) => item.description && item.sourceUrl));
  assert.ok(initial.center.copilot.brief.priorities.some((item) => item.citations[0].sourceId === "task_intel_overdue"));
  assert.ok(initial.center.copilot.conversationSummaries[0].citations.some((item) => item.sourceId === "message_intel"));

  const funnel = await adminJson(`/api/businesses/${businessId}/intelligence/funnels`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Embudo API",
      steps: [
        { id: "contact", label: "Contacto", entity: "contact" },
        { id: "deal", label: "Oportunidad", entity: "deal" },
        { id: "booking", label: "Visita", entity: "booking", statuses: ["completed"] },
        { id: "money", label: "Cobro", entity: "money", statuses: ["paid"] }
      ]
    }
  });
  assert.equal(funnel.funnel.steps.length, 4);
  const goal = await adminJson(`/api/businesses/${businessId}/intelligence/goals`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Objetivo API",
      metricKey: "revenue.total",
      target: 500,
      scope: "team",
      scopeId: "team_sales",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31"
    }
  });
  assert.equal(goal.center.analytics.goals[0].progressPercent, 50);
  const prediction = await adminJson(`/api/businesses/${businessId}/intelligence/predictions/settings`, {
    method: "PUT",
    body: { enabled: true, minSampleSize: 2, churnDays: 90, compareBaseline: true }
  });
  assert.equal(prediction.center.predictions.closeProbability.find((item) => item.stageId === "qualified").modelUsed, "calibrated");
  const disabled = await adminJson(`/api/businesses/${businessId}/intelligence/predictions/settings`, {
    method: "PATCH",
    body: { enabled: false, minSampleSize: 2 }
  });
  assert.equal(disabled.center.predictions.comparison.baselineOnly, true);

  const query = await adminJson(`/api/businesses/${businessId}/intelligence/query`, { method: "POST", body: { question: "¿Cuántos ingresos tenemos?" } });
  assert.equal(query.result.metric.key, "revenue.total");
  assert.ok(query.result.citations[0].sourceUrl);
  const draft = await adminJson(`/api/businesses/${businessId}/intelligence/copilot/drafts`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      type: "response",
      title: "Respuesta API",
      content: "Gracias. Revisaremos la alergia antes de confirmar.",
      targetType: "conversation",
      targetId: "thread_intel",
      suggestedAction: "send",
      citations: [{ sourceType: "message", sourceId: "message_intel", label: "Alergia", sourceUrl: "?tab=messages&message=message_intel" }]
    }
  });
  await adminJson(`/api/businesses/${businessId}/intelligence/copilot/actions/confirm`, {
    method: "POST",
    expectedStatus: 400,
    body: { draftId: draft.draft.id, action: "send", confirm: false }
  });
  const confirmation = await adminJson(`/api/businesses/${businessId}/intelligence/copilot/actions/confirm`, {
    method: "POST",
    expectedStatus: 201,
    body: { draftId: draft.draft.id, action: "send", confirm: true, confirmationText: "Confirmo el envío", idempotencyKey: "intel-confirm-1" }
  });
  assert.equal(confirmation.event.automated, false);
  assert.equal((await adminJson(`/api/businesses/${businessId}/intelligence/copilot/actions/confirm`, {
    method: "POST",
    body: { draftId: draft.draft.id, action: "send", confirm: true, idempotencyKey: "intel-confirm-1" }
  })).duplicate, true);

  await createUser("Marta Intelligence", "manager-intel@example.com", "manager", "ManagerIntel2026!");
  await createUser("Rita Intelligence", "readonly-intel@example.com", "readonly", "ReadonlyIntel2026!");
  const manager = await login("manager-intel@example.com", "ManagerIntel2026!");
  const readonly = await login("readonly-intel@example.com", "ReadonlyIntel2026!");
  assert.ok((await userJson(`/api/businesses/${businessId}/intelligence`, readonly)).center.analytics.metrics.length >= 8);
  assert.equal((await userJson(`/api/businesses/${businessId}/intelligence/query`, readonly, { method: "POST", body: { question: "reservas" } })).result.metric.key, "bookings.total");
  await userJson(`/api/businesses/${businessId}/intelligence/goals`, readonly, { method: "POST", expectedStatus: 403, body: { name: "No permitido", metricKey: "contacts.total", target: 10 } });
  await userJson(`/api/businesses/${businessId}/intelligence/goals`, manager, {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Meta manager", metricKey: "contacts.total", target: 10, scope: "user", scopeId: "manager", periodStart: "2026-07-01", periodEnd: "2026-07-31" }
  });
  await userJson(`/api/businesses/${otherBusinessId}/intelligence`, manager, { expectedStatus: 403 });

  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.ok(persisted.analyticsFunnels.some((item) => item.name === "Embudo API"));
  assert.ok(persisted.businessGoals.some((item) => item.scope === "team"));
  assert.equal(persisted.predictionSettings[0].enabled, false);
  assert.ok(persisted.copilotActionEvents.some((item) => item.action === "send" && item.actorType === "admin"));
  assert.ok(persisted.securityAuditEvents.some((item) => item.action === "intelligence.metric_queried"));
  assert.ok(persisted.securityAuditEvents.some((item) => item.action === "intelligence.copilot_action_confirmed"));
  console.log("Intelligence API checks passed: configurable funnels, cohorts/revenue/metrics/goals, calibrated and disabled predictions, visible evidence, authorized natural-language queries, cited drafts, explicit confirmation, audit, RBAC and tenant isolation.");
} finally {
  if (child && child.exitCode === null) {
    child.kill();
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]);
  }
  await rm(tempDir, { recursive: true, force: true });
}

function createUser(name, email, role, password) { return adminJson(`/api/businesses/${businessId}/security/users`, { method: "POST", expectedStatus: 201, body: { name, email, role, password } }); }
function login(email, password) { return jsonRequest("/api/business-users/login", { method: "POST", body: { business: businessId, email, password } }); }
function userJson(pathname, loginPayload, options = {}) { return jsonRequest(pathname, { ...options, headers: { ...options.headers, "X-LocalLift-User-Token": loginPayload.session.token } }); }
function adminJson(pathname, options = {}) { return jsonRequest(pathname, { ...options, headers: { ...options.headers, Authorization: `Bearer ${adminToken}` } }); }
async function jsonRequest(pathname, options = {}) {
  const headers = { ...options.headers };
  const init = { method: options.method || "GET", headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
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
