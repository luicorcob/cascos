import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, copyFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-campaign-browser-"));
const profileRoot = await mkdtemp(path.join(os.tmpdir(), "dls-campaign-browser-"));
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

  await jsonRequest(`/api/businesses/${businessId}/channels/connections/email`, { method: "PUT", body: { provider: "development", displayName: "Lifecycle Email", senderId: "lifecycle@example.com", active: true } });
  const eligible = await createLead("Nora Lifecycle", "nora-lifecycle@example.com");
  const blocked = await createLead("Oscar Sin Consentimiento", "oscar-no-consent@example.com");
  await jsonRequest(`/api/businesses/${businessId}/contacts/${eligible.contact.id}/consents`, { method: "POST", expectedStatus: 201, body: { channel: "email", purpose: "marketing", action: "granted", lawfulBasis: "consent", source: "browser-test", textVersion: "v1", textSnapshot: "Acepto marketing", actorType: "contact", actorId: eligible.contact.id } });
  const completed = await jsonRequest(`/api/businesses/${businessId}/campaigns`, { method: "POST", expectedStatus: 201, body: { templateKey: "welcome", name: "Bienvenida Lifecycle Browser", channel: "email", contactIds: [eligible.contact.id, blocked.contact.id], quietHours: { enabled: false }, frequencyCapDays: 0 } });
  await jsonRequest(`/api/businesses/${businessId}/campaigns/${completed.campaign.id}/schedule`, { method: "POST", body: {} });
  await jsonRequest(`/api/businesses/${businessId}/campaigns/${completed.campaign.id}/process`, { method: "POST", body: {} });
  await jsonRequest(`/api/businesses/${businessId}/campaigns`, { method: "POST", expectedStatus: 201, body: { templateKey: "win-back-90", name: "Win-back 90 Browser", channel: "email", contactIds: [eligible.contact.id], quietHours: { enabled: false }, frequencyCapDays: 0 } });

  for (const size of ["1440,1200", "390,844"]) {
    const profile = `${profileRoot}-${size.replace(",", "x")}`;
    const result = await run(chrome, [
      "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${profile}`, `--window-size=${size}`, "--virtual-time-budget=18000", "--dump-dom",
      `${baseUrl}/pages/business-dashboard.html?business=${businessId}&tab=customers&apiBase=same-origin`
    ]);
    assert.equal(result.exitCode, 0, `Chrome failed at ${size}: ${result.stderr}`);
    assert.match(result.stdout, /data-campaign-center/);
    assert.match(result.stdout, /Lifecycle y retencion/);
    assert.match(result.stdout, /Campanas medibles de principio a ingreso/);
    assert.match(result.stdout, /Bienvenida Lifecycle Browser/);
    assert.match(result.stdout, /Win-back 90 Browser/);
    assert.match(result.stdout, /Ingreso atribuido/);
    assert.match(result.stdout, /Nueva campana segura/);
    assert.match(result.stdout, /data-campaign-create-form/);
    assert.match(result.stdout, /Destinatarios y resultados/);
    assert.match(result.stdout, /Nora Lifecycle/);
    assert.match(result.stdout, /Oscar Sin Consentimiento/);
    assert.match(result.stdout, /Bloqueado/);
    assert.match(result.stdout, /Completada/);
    assert.match(result.stdout, /Bienvenida/);
    assert.match(result.stdout, /Reactivacion 30 dias/);
    assert.match(result.stdout, /Opinion tras la visita/);
    assert.doesNotMatch(result.stdout, /Centro de campanas no disponible/);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  console.log("Campaign browser checks passed: responsive lifecycle center, recipes, KPIs, campaign detail, audience results, blocked recipients and management controls.");
} finally {
  if (server && server.exitCode === null) { server.kill(); await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(2000)]); }
  await rm(tempDir, { recursive: true, force: true });
  await rm(profileRoot, { recursive: true, force: true }).catch(() => {});
}

function createLead(name, email) { return jsonRequest("/api/public/brasa-norte/leads", { method: "POST", expectedStatus: 201, body: { name, email, message: "Quiero informacion", privacyAccepted: true, privacyAcceptedAt: new Date().toISOString(), privacyPolicyUrl: "https://example.com/privacidad" } }); }
async function jsonRequest(pathname, options = {}) { const headers = { ...options.headers }; const init = { method: options.method || "GET", headers }; if (options.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); } const response = await fetch(`${baseUrl}${pathname}`, init); const text = await response.text(); const expectedStatus = options.expectedStatus || 200; if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`); return text ? JSON.parse(text) : {}; }
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (server.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
async function findChrome() { const candidates = process.platform === "win32" ? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")] : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]; for (const candidate of candidates) { try { await access(candidate); return candidate; } catch {} } throw new Error("Chrome or Chromium is required for the campaign browser test"); }
function run(command, args) { return new Promise((resolve, reject) => { const processChild = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; processChild.stdout.on("data", (chunk) => { stdout += String(chunk); }); processChild.stderr.on("data", (chunk) => { stderr += String(chunk); }); processChild.on("error", reject); processChild.on("close", (exitCode) => resolve({ exitCode, stdout, stderr })); }); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
