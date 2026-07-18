import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-reputation-browser-"));
const profileRoot = await mkdtemp(path.join(os.tmpdir(), "dls-reputation-browser-"));
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
  const completedAt = new Date(Date.now() - 3600000).toISOString();
  seed.contacts.push({ id: "contact_reputation_browser", businessId, type: "customer", status: "customer", name: "Nora Opinion", email: "nora-opinion@example.com", createdAt: completedAt, updatedAt: completedAt });
  seed.bookings.push({ id: "booking_reputation_browser", businessId, contactId: "contact_reputation_browser", serviceId: "svc_menu_degustacion", serviceName: "Menu degustacion", customerName: "Nora Opinion", email: "nora-opinion@example.com", status: "completed", startsAt: new Date(Date.now() - 7200000).toISOString(), endsAt: completedAt, createdAt: completedAt, updatedAt: completedAt });
  seed.consentEvents = Array.isArray(seed.consentEvents) ? seed.consentEvents : [];
  seed.consentEvents.push({ id: "consent_reputation_browser", businessId, contactId: "contact_reputation_browser", channel: "email", purpose: "reviews", action: "granted", lawfulBasis: "consent", source: "browser-test", textVersion: "v1", textSnapshot: "Acepto solicitudes de opinion", actorType: "contact", actorId: "contact_reputation_browser", evidence: {}, occurredAt: completedAt, createdAt: completedAt });
  await writeFile(dbPath, JSON.stringify(seed, null, 2), "utf8");

  server = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test", LOCALLIFT_ADMIN_TOKEN: "", ADMIN_API_TOKEN: "",
      BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  server.stdout.on("data", appendLog);
  server.stderr.on("data", appendLog);
  await waitForHealth();

  const sync = await jsonRequest(`/api/businesses/${businessId}/reputation/sync`, {
    method: "POST",
    body: {
      provider: "development",
      reviews: [
        { reviewId: "browser-critical", reviewerName: "Clara Critica", rating: 1, comment: "Servicio muy lento y problema de alergia", createTime: new Date(Date.now() - 5 * 3600000).toISOString() },
        { reviewId: "browser-positive", reviewerName: "Felipe Feliz", rating: 5, comment: "Calidad excelente y ambiente agradable", createTime: new Date(Date.now() - 1800000).toISOString() }
      ]
    }
  });
  const critical = sync.center.reviews.find((item) => item.providerReviewId === "browser-critical");
  await jsonRequest(`/api/businesses/${businessId}/reputation/reviews/${critical.id}/replies`, { method: "POST", expectedStatus: 201, body: { comment: "Sentimos lo ocurrido. Estamos revisandolo." } });

  for (const size of ["1440,1200", "390,844"]) {
    const profile = `${profileRoot}-${size.replace(",", "x")}`;
    const result = await run(chrome, [
      "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${profile}`, `--window-size=${size}`, "--virtual-time-budget=18000", "--dump-dom",
      `${baseUrl}/pages/business-dashboard.html?business=${businessId}&tab=google&apiBase=same-origin`
    ]);
    assert.equal(result.exitCode, 0, `Chrome failed at ${size}: ${result.stderr}`);
    assert.match(result.stdout, /data-reputation-center/);
    assert.match(result.stdout, /Reputacion operativa/);
    assert.match(result.stdout, /Resenas, respuestas y solicitudes con trazabilidad/);
    assert.match(result.stdout, /Clara Critica/);
    assert.match(result.stdout, /Felipe Feliz/);
    assert.match(result.stdout, /SLA vencido/);
    assert.match(result.stdout, /Borrador pendiente/);
    assert.match(result.stdout, /data-reputation-approve/);
    assert.match(result.stdout, /Nora Opinion/);
    assert.match(result.stdout, /Crear y enviar/);
    assert.match(result.stdout, /Nota media/);
    assert.match(result.stdout, /Temas recurrentes|aria-label="Temas recurrentes"/);
    assert.doesNotMatch(result.stdout, /Centro de reputacion no disponible/);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  console.log("Reputation browser checks passed: responsive KPIs, urgency queue, SLA, topics, review drafts, eligible requests and management controls.");
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
  if (options.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); }
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  const expectedStatus = options.expectedStatus || 200;
  if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}\n${logs}`);
  return text ? JSON.parse(text) : {};
}
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (server.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
async function findChrome() { const candidates = process.platform === "win32" ? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")] : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]; for (const candidate of candidates) { try { await access(candidate); return candidate; } catch {} } throw new Error("Chrome or Chromium is required for the reputation browser test"); }
function run(command, args) { return new Promise((resolve, reject) => { const processChild = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; processChild.stdout.on("data", (chunk) => { stdout += String(chunk); }); processChild.stderr.on("data", (chunk) => { stderr += String(chunk); }); processChild.on("error", reject); processChild.on("close", (exitCode) => resolve({ exitCode, stdout, stderr })); }); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
