import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedCustomer360Fixture } from "./customer-360-fixture.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-customer-360-api-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const otherBusinessId = "biz_customer_360_other";
const adminToken = "customer-360-admin-token";
let child;
let logs = "";

try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  const ids = seedCustomer360Fixture(db, { businessId, now: "2026-07-17T12:00:00.000Z" });
  db.businesses.push({ id: otherBusinessId, slug: "customer-360-other", name: "Otro negocio 360", status: "published", content: { currency: "EUR" }, createdAt: "2026-07-01T10:00:00.000Z", updatedAt: "2026-07-01T10:00:00.000Z" });
  await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
  child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: adminToken, ADMIN_API_TOKEN: adminToken,
      CLIENT_SESSION_SECRET: "customer-360-client-session-secret-32",
      BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);
  await waitForHealth();

  await jsonRequest(`/api/businesses/${businessId}/customers/360`, { expectedStatus: 401 });
  const result = await adminJson(`/api/businesses/${businessId}/customers/360?now=2026-07-17T12%3A00%3A00.000Z&limit=500&timelineLimit=12`);
  assert.ok(result.customers.some((item) => item.contact.id === ids.vip));
  assert.ok(result.customers.some((item) => item.contact.id === ids.risk));
  assert.ok(result.summary.revenue >= 1510);
  assert.ok(result.segments.some((item) => item.id === "at_risk" && item.count >= 1));

  const detail = await adminJson(`/api/businesses/${businessId}/customers/${ids.vip}/360?now=2026-07-17T12%3A00%3A00.000Z&timelineLimit=40`);
  assert.equal(detail.customer.contact.name, "Clara VIP 360");
  assert.ok(detail.customer.timeline.some((item) => item.type === "conversation"));
  const filtered = await adminJson(`/api/businesses/${businessId}/customers/360?now=2026-07-17T12%3A00%3A00.000Z&segment=vip&search=Clara`);
  assert.equal(filtered.filteredTotal, 1);
  assert.equal(filtered.customers[0].contact.id, ids.vip);

  await adminJson(`/api/businesses/${businessId}/customers/360`, { method: "POST", expectedStatus: 405, body: {} });
  await adminJson(`/api/businesses/${otherBusinessId}/customers/${ids.vip}/360`, { expectedStatus: 404 });
  const other = await adminJson(`/api/businesses/${otherBusinessId}/customers/360`);
  assert.equal(other.total, 0);

  await adminJson(`/api/businesses/${businessId}/portal-access`, { method: "POST", body: { password: "Customer360Portal2026!" } });
  const login = await jsonRequest("/api/client/login", { method: "POST", body: { business: businessId, password: "Customer360Portal2026!" } });
  const clientResult = await jsonRequest(`/api/businesses/${businessId}/customers/360?segment=vip`, { headers: { "X-LocalLift-Client-Token": login.session.token } });
  assert.ok(clientResult.customers.some((item) => item.contact.id === ids.vip));
  await jsonRequest(`/api/businesses/${otherBusinessId}/customers/360`, { headers: { "X-LocalLift-Client-Token": login.session.token }, expectedStatus: 403 });

  console.log("Customer 360 API checks passed: list, detail, filters, client access, method guard and tenant isolation.");
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
