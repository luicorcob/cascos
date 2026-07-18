import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-intelligence-browser-"));
const profileRoot = await mkdtemp(path.join(os.tmpdir(), "dls-intelligence-browser-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const chrome = await findChrome();
let server;
let logs = "";

try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  const seed = JSON.parse(await readFile(dbPath, "utf8"));
  Object.assign(seed, {
    contacts: [
      { id: "contact_browser_a", businessId, name: "Ana Analítica", email: "ana-analytics@example.com", source: "google", status: "customer", createdAt: "2026-01-02T10:00:00.000Z" },
      { id: "contact_browser_b", businessId, name: "Beto Analítica", email: "beto-analytics@example.com", source: "campaign", status: "customer", createdAt: "2026-02-02T10:00:00.000Z" }
    ],
    pipelines: [{
      id: "pipeline_browser_intel",
      businessId,
      name: "Ventas explicables",
      stages: [{ id: "qualified", name: "Cualificada", probability: 30 }, { id: "won", name: "Ganada", probability: 100 }]
    }],
    deals: [
      { id: "deal_browser_a", businessId, contactId: "contact_browser_a", pipelineId: "pipeline_browser_intel", stageId: "qualified", status: "won", createdAt: "2026-01-03T10:00:00.000Z" },
      { id: "deal_browser_b", businessId, contactId: "contact_browser_b", pipelineId: "pipeline_browser_intel", stageId: "qualified", status: "lost", createdAt: "2026-02-03T10:00:00.000Z" }
    ],
    proposals: [{ id: "proposal_browser_a", businessId, contactId: "contact_browser_a", status: "accepted", acceptedAt: "2026-01-04T10:00:00.000Z", createdAt: "2026-01-04T09:00:00.000Z" }],
    bookings: [
      { id: "booking_browser_a1", businessId, contactId: "contact_browser_a", customerName: "Ana Analítica", serviceName: "Cena", status: "completed", startsAt: "2026-01-10T20:00:00.000Z", endsAt: "2026-01-10T21:30:00.000Z", partySize: 2 },
      { id: "booking_browser_a2", businessId, contactId: "contact_browser_a", customerName: "Ana Analítica", serviceName: "Cena", status: "completed", startsAt: "2026-02-10T20:00:00.000Z", endsAt: "2026-02-10T21:30:00.000Z", partySize: 2 },
      { id: "booking_browser_b", businessId, contactId: "contact_browser_b", customerName: "Beto Analítica", serviceName: "Menú", status: "confirmed", startsAt: "2026-07-18T13:00:00.000Z", endsAt: "2026-07-18T14:30:00.000Z", partySize: 6, depositRequired: true, depositStatus: "pending" }
    ],
    moneyRecords: [{ id: "money_browser_a", businessId, contactId: "contact_browser_a", customerName: "Ana Analítica", status: "paid", total: 320, paidAmount: 320, currency: "EUR", dealId: "deal_browser_a", createdAt: "2026-01-11T10:00:00.000Z" }],
    tasks: [{ id: "task_browser_overdue", businessId, title: "Llamar a Ana", status: "open", dueAt: "2026-07-17T09:00:00.000Z" }],
    communicationThreads: [{ id: "thread_browser_intel", businessId, contactId: "contact_browser_a", subject: "Alergias y reserva", updatedAt: "2026-07-18T09:00:00.000Z" }],
    communicationMessages: [
      { id: "message_browser_intel", businessId, threadId: "thread_browser_intel", body: "Necesitamos confirmar una alergia antes de reservar.", occurredAt: "2026-07-18T09:00:00.000Z" }
    ],
    bookingResources: [{ id: "capacity_browser", businessId, name: "Aforo", type: "capacity", capacity: 20, active: true }],
    hospitalityInventory: [{ id: "stock_browser_intel", businessId, name: "Pescado Analítica", unit: "kg", currentStock: 1, minStock: 2, active: true }],
    hospitalityExperiences: [],
    hospitalityShifts: []
  });
  await writeFile(dbPath, JSON.stringify(seed, null, 2), "utf8");

  server = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: "",
      ADMIN_API_TOKEN: "",
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
  server.stdout.on("data", appendLog);
  server.stderr.on("data", appendLog);
  await waitForHealth();

  await jsonRequest(`/api/businesses/${businessId}/intelligence/funnels`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Ciclo Analítica Visible",
      steps: [
        { id: "contact", label: "Contacto captado", entity: "contact" },
        { id: "deal", label: "Oportunidad abierta", entity: "deal" },
        { id: "visit", label: "Visita completada", entity: "booking", statuses: ["completed"] },
        { id: "money", label: "Ingreso cobrado", entity: "money", statuses: ["paid"] }
      ]
    }
  });
  await jsonRequest(`/api/businesses/${businessId}/intelligence/goals`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Meta Visible 500",
      metricKey: "revenue.total",
      target: 500,
      scope: "team",
      scopeId: "Equipo comercial",
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31"
    }
  });
  await jsonRequest(`/api/businesses/${businessId}/intelligence/predictions/settings`, {
    method: "PUT",
    body: { enabled: true, minSampleSize: 2, churnDays: 90, compareBaseline: true }
  });
  await jsonRequest(`/api/businesses/${businessId}/intelligence/copilot/drafts`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      type: "response",
      title: "Borrador Visible Alergias",
      content: "Gracias. Revisaremos la alergia antes de confirmar.",
      targetType: "conversation",
      targetId: "thread_browser_intel",
      suggestedAction: "send",
      citations: [{ sourceType: "message", sourceId: "message_browser_intel", label: "Alergia", sourceUrl: "?tab=messages&message=message_browser_intel" }]
    }
  });

  for (const size of ["1440,1200", "390,844"]) {
    const profile = `${profileRoot}-${size.replace(",", "x")}`;
    const result = await run(chrome, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      `--window-size=${size}`,
      "--virtual-time-budget=24000",
      "--dump-dom",
      `${baseUrl}/pages/business-dashboard.html?business=${businessId}&tab=reports&apiBase=same-origin`
    ]);
    assert.equal(result.exitCode, 0, `Chrome failed at ${size}: ${result.stderr}`);
    assert.match(result.stdout, /data-intelligence-center/);
    assert.match(result.stdout, /Cada recomendación explica por qué/);
    assert.match(result.stdout, /Diccionario de métricas|aria-label="Diccionario de métricas"/);
    assert.match(result.stdout, /Ciclo Analítica Visible/);
    assert.match(result.stdout, /Contacto captado/);
    assert.match(result.stdout, /Cohortes de primera visita/);
    assert.match(result.stdout, /Ingresos de ciclo completo/);
    assert.match(result.stdout, /Meta Visible 500/);
    assert.match(result.stdout, /Equipo comercial/);
    assert.match(result.stdout, /data-prediction-center/);
    assert.match(result.stdout, /Modelo comparado con la regla simple/);
    assert.match(result.stdout, /calibrated · n=2/);
    assert.match(result.stdout, /Riesgo de abandono/);
    assert.match(result.stdout, /Riesgo de no-show/);
    assert.match(result.stdout, /Pescado Analítica/);
    assert.match(result.stdout, /data-copilot-center/);
    assert.match(result.stdout, /Tareas vencidas/);
    assert.match(result.stdout, /task #task_browser_overdue/);
    assert.match(result.stdout, /message_browser_intel/);
    assert.match(result.stdout, /Borrador Visible Alergias/);
    assert.match(result.stdout, /data-copilot-confirm-draft/);
    assert.match(result.stdout, /data-copilot-query-form/);
    assert.match(result.stdout, /requiere confirmación humana explícita/);
    assert.match(result.stdout, /data-intelligence-funnel-form/);
    assert.match(result.stdout, /data-intelligence-goal-form/);
    assert.doesNotMatch(result.stdout, /Inteligencia no disponible/);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  console.log("Intelligence browser checks passed: responsive metric drilldowns, funnels, cohorts, revenue attribution, scoped goals, calibrated-vs-baseline predictions, visible risk factors, cited briefs/summaries, reviewable drafts, explicit confirmation and natural-language metrics.");
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(2000)]);
  }
  await rm(tempDir, { recursive: true, force: true });
  await rm(profileRoot, { recursive: true, force: true }).catch(() => {});
}

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
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (server.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
async function findChrome() {
  const candidates = process.platform === "win32"
    ? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")]
    : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  for (const candidate of candidates) { try { await access(candidate); return candidate; } catch {} }
  throw new Error("Chrome or Chromium is required for the intelligence browser test");
}
function run(command, args) { return new Promise((resolve, reject) => { const processChild = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; processChild.stdout.on("data", (chunk) => { stdout += String(chunk); }); processChild.stderr.on("data", (chunk) => { stderr += String(chunk); }); processChild.on("error", reject); processChild.on("close", (exitCode) => resolve({ exitCode, stdout, stderr })); }); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
