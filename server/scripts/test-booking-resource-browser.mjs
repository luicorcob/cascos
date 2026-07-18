import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, copyFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-booking-resource-browser-")); const profileRoot = await mkdtemp(path.join(os.tmpdir(), "dls-booking-resource-browser-")); const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort(); const baseUrl = `http://127.0.0.1:${port}`; const businessId = "biz_demo_brasa_norte"; const serviceId = "svc_menu_degustacion"; const chrome = await findChrome();
let child; let logs = "";
try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  child = spawn(process.execPath, ["server/server.mjs"], { cwd: root, env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test", LOCALLIFT_ADMIN_TOKEN: "", ADMIN_API_TOKEN: "", STRIPE_SECRET_KEY: "", BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "", BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  child.stdout.on("data", appendLog); child.stderr.on("data", appendLog); await waitForHealth();
  await jsonRequest(`/api/businesses/${businessId}/services/${serviceId}`, { method: "PATCH", body: { price: 120, requiredResourceTypes: ["table"], depositMode: "percent", depositValue: 30, guaranteeRequired: true } });
  const resource = await jsonRequest(`/api/businesses/${businessId}/resources`, { method: "POST", expectedStatus: 201, body: { name: "Mesa Mirador", type: "table", capacity: 6, serviceIds: [serviceId], bufferBeforeMinutes: 10, bufferAfterMinutes: 15, color: "#2563eb" } });
  await jsonRequest(`/api/businesses/${businessId}/resources/${resource.resource.id}/schedule`, { method: "PUT", body: { schedule: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "12:00", endTime: "23:00", active: true })) } });
  await jsonRequest(`/api/businesses/${businessId}/resources/${resource.resource.id}/exceptions`, { method: "POST", expectedStatus: 201, body: { startsAt: "2026-07-21T12:00:00.000Z", endsAt: "2026-07-21T13:00:00.000Z", mode: "blocked", reason: "Montaje" } });
  await jsonRequest(`/api/businesses/${businessId}/bookings`, { method: "POST", expectedStatus: 201, body: { serviceId, customerName: "Celia Reserva", email: "celia@example.com", startsAt: "2026-07-20T13:00:00.000Z", resourceIds: [resource.resource.id], partySize: 3, status: "confirmed" } });
  await jsonRequest(`/api/businesses/${businessId}/waitlist`, { method: "POST", expectedStatus: 201, body: { serviceId, customerName: "Nora Espera", phone: "+34600000111", desiredStartsAt: "2026-07-20T15:00:00.000Z", partySize: 4 } });
  for (const size of ["1440,1200", "390,844"]) {
    const dom = await browserDom(`${baseUrl}/pages/business-dashboard.html?business=${businessId}&tab=bookings&apiBase=same-origin`, size, `dashboard-${size}`);
    assert.match(dom, /Reservas inteligentes/); assert.match(dom, /Recursos, aforo y lista de espera/); assert.match(dom, /Nuevo recurso/); assert.match(dom, /Mesa Mirador/); assert.match(dom, /Aforo 6|aforo 6/i); assert.match(dom, /Horario del recurso/); assert.match(dom, /Excepciones/); assert.match(dom, /Lista de espera/); assert.match(dom, /Nora Espera/); assert.match(dom, /Celia Reserva/); assert.match(dom, /Crear enlace de se/); assert.match(dom, /booking-resource-center/); assert.match(dom, /resource-card-grid/); assert.doesNotMatch(dom, /La agenda no respondio/);
  }
  console.log("Booking resource browser checks passed: responsive resource center, resource cards, schedule/exception controls, capacity, waitlist, assigned booking, no-show risk and deposit actions.");
} finally { if (child && child.exitCode === null) { child.kill(); await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]); } await rm(tempDir, { recursive: true, force: true }); await rm(profileRoot, { recursive: true, force: true }).catch(() => {}); }

async function jsonRequest(pathname, options = {}) { const headers = { ...options.headers }; const init = { method: options.method || "GET", headers }; if (options.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); } const response = await fetch(`${baseUrl}${pathname}`, init); const text = await response.text(); const expectedStatus = options.expectedStatus || 200; if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}\n${logs}`); return text ? JSON.parse(text) : {}; }
async function browserDom(url, size, label) { const profile = `${profileRoot}-${label.replace(/[^A-Za-z0-9_-]/g, "-")}`; const result = await run(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, `--window-size=${size}`, "--virtual-time-budget=18000", "--dump-dom", url]); assert.equal(result.exitCode, 0, `Chrome failed for ${label}: ${result.stderr}`); await rm(profile, { recursive: true, force: true }).catch(() => {}); return result.stdout; }
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (child.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
async function findChrome() { const candidates = process.platform === "win32" ? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")] : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]; for (const candidate of candidates) { try { await access(candidate); return candidate; } catch {} } throw new Error("Chrome or Chromium is required for the booking resource browser test"); }
function run(command, args) { return new Promise((resolve, reject) => { const processChild = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; processChild.stdout.on("data", (chunk) => { stdout += String(chunk); }); processChild.stderr.on("data", (chunk) => { stderr += String(chunk); }); processChild.on("error", reject); processChild.on("close", (exitCode) => resolve({ exitCode, stdout, stderr })); }); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
