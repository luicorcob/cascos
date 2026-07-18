import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, copyFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-automation-browser-"));
const profileRoot = await mkdtemp(path.join(os.tmpdir(), "dls-automation-browser-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const chrome = await findChrome();
let server;
let logs = "";

try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  server = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test", LOCALLIFT_ADMIN_TOKEN: "", ADMIN_API_TOKEN: "",
      BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  server.stdout.on("data", appendLog); server.stderr.on("data", appendLog); await waitForHealth();

  const lead = await jsonRequest("/api/public/brasa-norte/leads", { method: "POST", expectedStatus: 201, body: { name: "Clara Secuencia", email: "clara-sequence@example.com", message: "Quiero una demo", privacyAccepted: true, privacyAcceptedAt: new Date().toISOString(), privacyPolicyUrl: "https://example.com/privacidad" } });
  await jsonRequest(`/api/businesses/${businessId}/automations/recipes/seed`, { method: "POST", body: {} });
  const sequence = await jsonRequest(`/api/businesses/${businessId}/automations`, {
    method: "POST", expectedStatus: 201,
    body: {
      name: "Secuencia Browser Magistral", description: "Seguimiento visible, versionado y seguro.", kind: "sequence", trigger: { type: "sequence.enrolled" }, stopConditions: ["reply", "booking", "proposal_accepted", "unsubscribe"], quietHours: { enabled: false },
      nodes: [
        { id: "trigger", type: "trigger", label: "Contacto inscrito", config: { type: "sequence.enrolled" } },
        { id: "condition", type: "condition", label: "Contacto con email", config: { field: "contact.email", operator: "exists" } },
        { id: "wait", type: "wait", label: "Esperar 24 horas", config: { minutes: 1440 } },
        { id: "task", type: "action", label: "Crear seguimiento personal", config: { action: "create_task", title: "Responder a {{contact.name}}" } },
        { id: "goal", type: "goal", label: "Reserva conseguida", config: { field: "payload.booked", operator: "equals", value: true } },
        { id: "exit", type: "exit", label: "Salida segura", config: { outcome: "completed" } }
      ]
    }
  });
  await jsonRequest(`/api/businesses/${businessId}/automations/${sequence.automation.id}/publish`, { method: "POST", body: {} });
  await jsonRequest(`/api/businesses/${businessId}/automations/${sequence.automation.id}/test`, { method: "POST", body: { contactId: lead.contact.id, context: { contact: lead.contact, payload: { booked: false } } } });
  await jsonRequest(`/api/businesses/${businessId}/sequences/enrollments`, { method: "POST", expectedStatus: 201, body: { automationId: sequence.automation.id, contactId: lead.contact.id, source: "browser-test" } });

  for (const size of ["1440,1100", "390,844"]) {
    const profile = `${profileRoot}-${size.replace(",", "x")}`;
    const result = await run(chrome, [
      "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${profile}`, `--window-size=${size}`, "--virtual-time-budget=25000", "--dump-dom",
      `${baseUrl}/pages/business-dashboard.html?business=${businessId}&tab=settings&apiBase=same-origin`
    ]);
    assert.equal(result.exitCode, 0, `Chrome failed at ${size}: ${result.stderr}`);
    assert.match(result.stdout, /data-automation-studio/);
    assert.match(result.stdout, /Estudio de automatizaciones/);
    assert.match(result.stdout, /Crecimiento sin trabajo repetitivo/);
    assert.match(result.stdout, /Secuencia Browser Magistral/);
    assert.match(result.stdout, /Seguimiento visible, versionado y seguro/);
    assert.match(result.stdout, /Contacto inscrito/);
    assert.match(result.stdout, /Contacto con email/);
    assert.match(result.stdout, /Esperar 24 horas/);
    assert.match(result.stdout, /Crear seguimiento personal/);
    assert.match(result.stdout, /Reserva conseguida/);
    assert.match(result.stdout, /Salida segura/);
    assert.match(result.stdout, /Publicada v1/);
    assert.match(result.stdout, /Modo prueba/);
    assert.match(result.stdout, /Editar definicion avanzada/);
    assert.match(result.stdout, /data-automation-draft-form/);
    assert.match(result.stdout, /data-automation-create-form/);
    assert.match(result.stdout, /Inscripciones/);
    assert.match(result.stdout, /Clara Secuencia/);
    assert.match(result.stdout, /En espera/);
    assert.match(result.stdout, /Ejecuciones recientes/);
    assert.match(result.stdout, /Prueba correcta/);
    assert.match(result.stdout, /Responder lead nuevo/);
    assert.match(result.stdout, /Solicitar resena tras visita/);
    assert.doesNotMatch(result.stdout, /Estudio no disponible/);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  console.log("Automation browser checks passed: responsive studio, recipes, flow diagram, versions, test mode, sequence enrollment, waits and execution logs.");
} finally {
  if (server && server.exitCode === null) { server.kill(); await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(2000)]); }
  await rm(tempDir, { recursive: true, force: true });
  await rm(profileRoot, { recursive: true, force: true }).catch(() => {});
}

async function jsonRequest(pathname, options = {}) { const headers = { ...options.headers }; const init = { method: options.method || "GET", headers }; if (options.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); } const response = await fetch(`${baseUrl}${pathname}`, init); const text = await response.text(); const expectedStatus = options.expectedStatus || 200; if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`); return text ? JSON.parse(text) : {}; }
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (server.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
async function findChrome() { const candidates = process.platform === "win32" ? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")] : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]; for (const candidate of candidates) { try { await access(candidate); return candidate; } catch {} } throw new Error("Chrome or Chromium is required for the automation browser test"); }
function run(command, args) { return new Promise((resolve, reject) => { const processChild = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; processChild.stdout.on("data", (chunk) => { stdout += String(chunk); }); processChild.stderr.on("data", (chunk) => { stderr += String(chunk); }); processChild.on("error", reject); processChild.on("close", (exitCode) => resolve({ exitCode, stdout, stderr })); }); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
