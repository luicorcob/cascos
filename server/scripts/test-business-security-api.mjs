import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-business-security-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const otherBusinessId = "biz_demo_luz_habitat";
const adminToken = "business-security-admin";
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
      BUSINESS_USER_SESSION_SECRET: "business-user-session-secret-at-least-32",
      BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);
  await waitForHealth();

  await jsonRequest(`/api/businesses/${businessId}/security`, { expectedStatus: 401 });
  const owner = await createUser("Olivia Owner", "owner@example.com", "owner", "OwnerPassword2026!");
  const operations = await createUser("Oscar Operaciones", "operations@example.com", "operations", "OperationsPassword2026!");
  await createUser("Fina Finanzas", "finance@example.com", "finance", "FinancePassword2026!");
  await createUser("Rita Lectura", "readonly@example.com", "readonly", "ReadonlyPassword2026!");

  const ownerLogin = await login("owner@example.com", "OwnerPassword2026!");
  const ownerHeaders = userHeaders(ownerLogin.session.token);
  const ownerCenter = await jsonRequest(`/api/businesses/${businessId}/security`, { headers: ownerHeaders });
  assert.equal(ownerCenter.summary.activeUsers, 4);
  assert.equal(ownerCenter.roles.length, 6);
  await jsonRequest(`/api/businesses/${businessId}/security/users`, { method: "POST", expectedStatus: 201, headers: ownerHeaders, body: { name: "Sara Comercial", email: "sales@example.com", role: "sales", password: "SalesPassword2026!" } });
  await jsonRequest(`/api/businesses/${businessId}/security/users/${owner.user.id}`, { method: "PATCH", expectedStatus: 409, headers: ownerHeaders, body: { active: false } });

  const operationsLogin = await login("operations@example.com", "OperationsPassword2026!");
  const operationsHeaders = userHeaders(operationsLogin.session.token);
  assert.equal((await jsonRequest("/api/businesses?includeArchived=true", { headers: operationsHeaders })).businesses.length, 1);
  await jsonRequest(`/api/businesses/${businessId}/bookings`, { headers: operationsHeaders });
  await jsonRequest(`/api/businesses/${businessId}/hospitality/employees`, { headers: operationsHeaders });
  await jsonRequest(`/api/businesses/${businessId}/resources`, { method: "POST", expectedStatus: 201, headers: operationsHeaders, body: { name: "Sala RBAC", type: "room", capacity: 6, active: true } });
  await jsonRequest(`/api/businesses/${businessId}/hospitality/invoices`, { expectedStatus: 403, headers: operationsHeaders });
  await jsonRequest(`/api/businesses/${businessId}/security/users`, { expectedStatus: 403, headers: operationsHeaders });
  await jsonRequest(`/api/businesses/${otherBusinessId}/bookings`, { expectedStatus: 403, headers: operationsHeaders });

  const financeLogin = await login("finance@example.com", "FinancePassword2026!");
  const financeHeaders = userHeaders(financeLogin.session.token);
  await jsonRequest(`/api/businesses/${businessId}/hospitality/invoices`, { headers: financeHeaders });
  await jsonRequest(`/api/businesses/${businessId}/resources`, { method: "POST", expectedStatus: 403, headers: financeHeaders, body: { name: "No permitido", type: "room" } });

  const readonlyLogin = await login("readonly@example.com", "ReadonlyPassword2026!");
  const readonlyHeaders = userHeaders(readonlyLogin.session.token);
  await jsonRequest(`/api/businesses/${businessId}/contacts`, { headers: readonlyHeaders });
  await jsonRequest(`/api/businesses/${businessId}/contacts`, { method: "POST", expectedStatus: 403, headers: readonlyHeaders, body: { name: "No permitido" } });

  const impersonation = await jsonRequest(`/api/businesses/${businessId}/security/impersonations`, { method: "POST", expectedStatus: 201, headers: ownerHeaders, body: { userId: operations.user.id, reason: "Validar permisos operativos", ttlSeconds: 600 } });
  assert.equal(impersonation.session.impersonatedBy, owner.user.id);
  await jsonRequest(`/api/businesses/${businessId}/hospitality/invoices`, { expectedStatus: 403, headers: userHeaders(impersonation.session.token) });
  const exportEvent = await jsonRequest(`/api/businesses/${businessId}/security/audit`, { method: "POST", expectedStatus: 201, headers: ownerHeaders, body: { resource: "contacts", format: "csv", count: 12, reason: "Revision mensual" } });
  assert.equal(exportEvent.event.action, "security.export_recorded");
  const audit = await jsonRequest(`/api/businesses/${businessId}/security/audit`, { headers: ownerHeaders });
  assert.ok(audit.events.some((item) => item.action === "security.impersonation_started"));
  assert.ok(audit.events.some((item) => item.action === "security.export_recorded"));

  const session = await jsonRequest("/api/business-users/session", { headers: ownerHeaders });
  assert.equal(session.session.user.role, "owner");
  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.ok(persisted.businessUsers.every((item) => item.passwordHash.startsWith("scrypt:")));
  assert.ok(persisted.businessUsers.every((item) => !Object.values(item).includes("OwnerPassword2026!")));
  assert.ok(persisted.securityAuditEvents.length >= 8);
  console.log("Business security API checks passed: independent users, signed sessions, six roles, backend action authorization, tenant isolation, finance protection, read-only enforcement, audit and impersonation.");
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
