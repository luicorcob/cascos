import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const adminToken = "consent-test-admin-token-32-characters";
const businessId = "biz_demo_brasa_norte";
let child;
let tempDir;
let dbPath;
let logs = "";

async function main() {
  tempDir = await mkdtemp(path.join(root, ".tmp-consent-test-"));
  dbPath = path.join(tempDir, "business-db.json");
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test", LOCALLIFT_ADMIN_TOKEN: adminToken, CLIENT_SESSION_SECRET: "consent-test-session-secret-32-characters", BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "", BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false" },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);
  const health = await waitForHealth(baseUrl);
  assert.equal(health.counts.consentEvents, 0);

  const lead = await jsonRequest(baseUrl, "/api/public/brasa-norte/leads", {
    method: "POST", expectedStatus: 201,
    body: { name: "Consentimiento demostrable", email: "consent@example.com", message: "Informacion", privacyAccepted: true, privacyAcceptedAt: new Date().toISOString(), privacyPolicyUrl: "https://example.com/privacy-v2" }
  });
  const contactId = lead.contact.id;
  const ledger = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts/${contactId}/consents`);
  assert.equal(ledger.total, 1);
  assert.equal(ledger.events[0].action, "acknowledged");
  assert.equal(ledger.preferences.email.service.allowed, true);
  assert.equal(ledger.preferences.email.marketing.allowed, false, "Accepting a privacy notice cannot opt a contact into marketing");

  const preferences = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts/${contactId}/preferences`, {
    method: "PUT",
    body: {
      globalSuppressed: false,
      source: "dashboard-preference-center",
      textVersion: "marketing-v1",
      textSnapshot: "Autorizo comunicaciones comerciales por los canales seleccionados.",
      policyUrl: "https://example.com/preferences",
      actorType: "contact",
      actorId: contactId,
      evidence: { surface: "crm" },
      preferences: [
        { channel: "email", purpose: "marketing", allowed: true },
        { channel: "whatsapp", purpose: "reviews", allowed: true }
      ]
    }
  });
  assert.equal(preferences.changed, 2);
  assert.equal(preferences.state.preferences.email.marketing.allowed, true);
  assert.equal(preferences.state.preferences.whatsapp.reviews.allowed, true);

  const second = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST", expectedStatus: 201, body: { name: "Sin permiso marketing", email: "blocked@example.com" }
  });
  const eligibility = await adminJson(baseUrl, `/api/businesses/${businessId}/consent/eligibility`, {
    method: "POST", body: { contactIds: [contactId, second.contact.id], channel: "email", purpose: "marketing" }
  });
  assert.deepEqual(eligibility.eligible.map((item) => item.contact.id), [contactId]);
  assert.deepEqual(eligibility.blocked.map((item) => item.contact.id), [second.contact.id]);

  await adminJson(baseUrl, `/api/businesses/${businessId}/contacts/${contactId}/consents`, {
    method: "POST", expectedStatus: 201,
    body: { channel: "email", purpose: "marketing", action: "withdrawn", lawfulBasis: "consent", source: "unsubscribe", actorType: "contact", actorId: contactId, evidence: { link: "one-click" } }
  });
  const afterWithdrawal = await adminJson(baseUrl, `/api/businesses/${businessId}/consent/eligibility`, {
    method: "POST", body: { contactIds: [contactId], channel: "email", purpose: "marketing" }
  });
  assert.equal(afterWithdrawal.blocked[0].reason, "withdrawn");

  await adminJson(baseUrl, `/api/businesses/${businessId}/contacts/${contactId}/preferences`, {
    method: "PUT", body: { globalSuppressed: true, source: "preference-center", actorType: "contact", actorId: contactId }
  });
  const suppressed = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts/${contactId}/preferences`);
  assert.equal(suppressed.globalSuppressed, true);
  assert.equal(suppressed.preferences.whatsapp.reviews.suppressed, true);
  await adminJson(baseUrl, `/api/businesses/${businessId}/contacts/${contactId}/consents`, { method: "PATCH", expectedStatus: 405, body: { action: "granted" } });

  const otherBusiness = await adminJson(baseUrl, "/api/businesses", { method: "POST", expectedStatus: 201, body: { name: "Otro consentimiento", slug: "otro-consentimiento" } });
  await adminJson(baseUrl, `/api/businesses/${otherBusiness.business.id}/contacts/${contactId}/preferences`, { expectedStatus: 404 });
  await adminJson(baseUrl, `/api/businesses/${businessId}/portal-access`, { method: "POST", body: { password: "PortalConsent2026!" } });
  const login = await jsonRequest(baseUrl, "/api/client/login", { method: "POST", body: { business: businessId, password: "PortalConsent2026!" } });
  const clientHeaders = { "X-LocalLift-Client-Token": login.session.token };
  assert.equal((await jsonRequest(baseUrl, `/api/businesses/${businessId}/contacts/${contactId}/preferences`, { headers: clientHeaders })).globalSuppressed, true);
  await jsonRequest(baseUrl, `/api/businesses/${otherBusiness.business.id}/contacts/${contactId}/preferences`, { headers: clientHeaders, expectedStatus: 403 });

  const finalHealth = await jsonRequest(baseUrl, "/api/health");
  assert.ok(finalHealth.counts.consentEvents >= 4);
  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.ok(persisted.auditLog.some((entry) => entry.type === "consent.event_appended"));
  assert.ok(persisted.auditLog.some((entry) => entry.type === "consent.preference_changed"));
  console.log("Consent API checks passed: immutable ledger, effective preferences, withdrawal, suppression, audience blocking and tenancy.");
}

function adminJson(baseUrl, pathname, options = {}) { return jsonRequest(baseUrl, pathname, { ...options, headers: { ...options.headers, Authorization: `Bearer ${adminToken}` } }); }
async function jsonRequest(baseUrl, pathname, options = {}) { const headers = { ...options.headers }; const init = { method: options.method || "GET", headers }; if (options.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); } const response = await fetch(`${baseUrl}${pathname}`, init); const text = await response.text(); const expectedStatus = options.expectedStatus || 200; if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`); return text ? JSON.parse(text) : {}; }
async function waitForHealth(baseUrl) { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (child.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest(baseUrl, "/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
function getFreePort() { return new Promise((resolve, reject) => { const server = createServer(); server.unref(); server.on("error", reject); server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
main().catch((error) => { console.error(`Consent API test failed: ${error.message}`); if (logs) console.error(logs); process.exitCode = 1; }).finally(async () => { if (child && child.exitCode === null) { child.kill(); await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]); } if (tempDir) await rm(tempDir, { recursive: true, force: true }); });
