import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-reputation-api-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const otherBusinessId = "biz_demo_luz_habitat";
const contactId = "contact_reputation_api";
const bookingId = "booking_reputation_api";
const adminToken = "reputation-admin-token";
let child;
let logs = "";

try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  const seed = JSON.parse(await readFile(dbPath, "utf8"));
  const completedAt = new Date(Date.now() - 3600000).toISOString();
  seed.contacts.push({ id: contactId, businessId, type: "customer", status: "customer", name: "Alicia Reputacion", email: "alicia-reputacion@example.com", createdAt: completedAt, updatedAt: completedAt });
  seed.bookings.push({ id: bookingId, businessId, contactId, serviceId: "svc_menu_degustacion", serviceName: "Menu degustacion", customerName: "Alicia Reputacion", email: "alicia-reputacion@example.com", status: "completed", startsAt: new Date(Date.now() - 7200000).toISOString(), endsAt: completedAt, createdAt: completedAt, updatedAt: completedAt });
  seed.consentEvents = Array.isArray(seed.consentEvents) ? seed.consentEvents : [];
  seed.consentEvents.push({ id: "consent_reputation_api", businessId, contactId, channel: "email", purpose: "reviews", action: "granted", lawfulBasis: "consent", source: "api-test", textVersion: "v1", textSnapshot: "Acepto solicitudes de opinion", actorType: "contact", actorId: contactId, evidence: {}, occurredAt: completedAt, createdAt: completedAt });
  await writeFile(dbPath, JSON.stringify(seed, null, 2), "utf8");

  child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: adminToken, ADMIN_API_TOKEN: adminToken,
      CLIENT_SESSION_SECRET: "reputation-client-session-secret-32",
      BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);
  await waitForHealth();

  await jsonRequest(`/api/businesses/${businessId}/reputation`, { expectedStatus: 401 });
  await adminJson(`/api/businesses/${businessId}/channels/connections/email`, { method: "PUT", body: { provider: "development", displayName: "Resenas Email", senderId: "reviews@example.com", active: true } });
  const sync = await adminJson(`/api/businesses/${businessId}/reputation/sync`, {
    method: "POST",
    body: {
      provider: "development",
      reviews: [
        { reviewId: "review-api-critical", reviewerName: "Cliente API", rating: 1, comment: "Servicio lento y peligro por alergia", createTime: new Date(Date.now() - 4 * 3600000).toISOString() },
        { reviewId: "review-api-positive", reviewerName: "Cliente Feliz API", rating: 5, comment: "Gran calidad y servicio", createTime: new Date(Date.now() - 1800000).toISOString() }
      ]
    }
  });
  assert.equal(sync.run.created, 2);
  assert.equal(sync.center.summary.overdue, 1);
  const review = sync.center.reviews.find((item) => item.providerReviewId === "review-api-critical");
  const draft = await adminJson(`/api/businesses/${businessId}/reputation/reviews/${review.id}/replies`, { method: "POST", expectedStatus: 201, body: { comment: "Sentimos lo ocurrido. Lo estamos revisando con prioridad." } });
  assert.equal(draft.reply.status, "draft");
  const approved = await adminJson(`/api/businesses/${businessId}/reputation/reviews/${review.id}/replies/${draft.reply.id}/approve`, { method: "POST", body: { actorId: "owner-api" } });
  assert.equal(approved.reply.status, "approved");
  const dryRun = await adminJson(`/api/businesses/${businessId}/reputation/reviews/${review.id}/replies/${draft.reply.id}/publish`, { method: "POST", body: {} });
  assert.equal(dryRun.dryRun, true);
  const published = await adminJson(`/api/businesses/${businessId}/reputation/reviews/${review.id}/replies/${draft.reply.id}/publish`, { method: "POST", body: { confirm: true } });
  assert.equal(published.reply.status, "published");

  await adminJson(`/api/businesses/${businessId}/reputation/review-requests`, { method: "POST", expectedStatus: 409, body: { bookingId, contactId, channel: "email", message: "Te damos un regalo por tu resena" } });
  const request = await adminJson(`/api/businesses/${businessId}/reputation/review-requests`, { method: "POST", expectedStatus: 201, body: { bookingId, contactId, channel: "email", send: true } });
  assert.equal(request.request.status, "sent");
  assert.ok(request.request.trackingUrl.includes("/api/public/review-requests/"));
  const tracking = await fetch(request.request.trackingUrl, { redirect: "manual" });
  assert.equal(tracking.status, 302);
  assert.match(tracking.headers.get("location") || "", /^https:\/\/g\.page\//);

  await adminJson(`/api/businesses/${businessId}/portal-access`, { method: "POST", body: { password: "ReputationPortal2026!" } });
  const login = await jsonRequest("/api/client/login", { method: "POST", body: { business: businessId, password: "ReputationPortal2026!" } });
  const clientHeaders = { "X-LocalLift-Client-Token": login.session.token };
  const clientCenter = await jsonRequest(`/api/businesses/${businessId}/reputation`, { headers: clientHeaders });
  assert.equal(clientCenter.center.reviews.length, 2);
  await jsonRequest(`/api/businesses/${businessId}/reputation/sync`, { method: "POST", expectedStatus: 403, headers: clientHeaders, body: { reviews: [] } });
  await jsonRequest(`/api/businesses/${otherBusinessId}/reputation`, { expectedStatus: 403, headers: clientHeaders });

  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.equal(persisted.reputationReviews.length, 2);
  assert.equal(persisted.reputationReplies[0].status, "published");
  assert.equal(persisted.reviewRequests[0].status, "clicked");
  assert.ok(persisted.auditLog.some((item) => item.type === "reputation.synced"));
  assert.ok(persisted.auditLog.some((item) => item.type === "reputation.reply_published"));
  assert.ok(persisted.auditLog.some((item) => item.type === "review_request.created"));
  console.log("Reputation API checks passed: auth, sync, classification, draft, approval, confirmed publication, consent, anti-incentive policy, request tracking, tenancy and client read-only access.");
} finally {
  if (child && child.exitCode === null) {
    child.kill();
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]);
  }
  await rm(tempDir, { recursive: true, force: true });
}

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
