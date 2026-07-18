import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-campaign-api-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const otherBusinessId = "biz_demo_luz_habitat";
const adminToken = "campaign-admin-token";
const webhookSecret = "campaign-webhook-secret";
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
      CLIENT_SESSION_SECRET: "campaign-client-session-secret-32",
      DLS_CHANNEL_WEBHOOK_SECRET: webhookSecret,
      BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  child.stdout.on("data", appendLog); child.stderr.on("data", appendLog); await waitForHealth();

  await jsonRequest(`/api/businesses/${businessId}/campaigns`, { expectedStatus: 401 });
  const templates = await adminJson(`/api/businesses/${businessId}/campaigns/templates`);
  assert.equal(templates.templates.length, 4);
  await adminJson(`/api/businesses/${businessId}/channels/connections/email`, { method: "PUT", body: { provider: "development", displayName: "Campaign Email", senderId: "campaign@example.com", active: true } });

  const eligibleLead = await createLead("Lola Campana", "lola-campaign@example.com");
  const blockedLead = await createLead("Mario Bloqueado", "mario-campaign@example.com");
  await grantMarketing(eligibleLead.contact.id);
  const created = await adminJson(`/api/businesses/${businessId}/campaigns`, {
    method: "POST", expectedStatus: 201,
    body: { templateKey: "welcome", name: "Bienvenida API Magistral", channel: "email", purpose: "marketing", variants: [{ key: "A", name: "Control", weight: 50, subject: "Hola {{contact.name}}", body: "Bienvenida A" }, { key: "B", name: "Cercana", weight: 50, subject: "Tenemos algo para ti", body: "Bienvenida B" }], contactIds: [eligibleLead.contact.id, blockedLead.contact.id], quietHours: { enabled: false }, frequencyCapDays: 0, batchSize: 10 }
  });
  const campaignId = created.campaign.id;
  assert.equal(created.campaign.status, "draft");
  const edited = await adminJson(`/api/businesses/${businessId}/campaigns/${campaignId}`, { method: "PATCH", body: { description: "Lifecycle con consentimiento y atribucion", subject: "Hola {{contact.name}}" } });
  assert.equal(edited.campaign.revision, 2);
  const preview = await adminJson(`/api/businesses/${businessId}/campaigns/${campaignId}/preview`, { method: "POST", body: {} });
  assert.equal(preview.preview.eligible.length, 1);
  assert.equal(preview.preview.blocked.length, 1);
  assert.equal(preview.preview.blocked[0].reason, "no_grant");

  const scheduled = await adminJson(`/api/businesses/${businessId}/campaigns/${campaignId}/schedule`, { method: "POST", body: {} });
  assert.equal(scheduled.campaign.metrics.queued, 1);
  const processed = await adminJson(`/api/businesses/${businessId}/campaigns/${campaignId}/process`, { method: "POST", body: {} });
  assert.equal(processed.processed, 1);
  assert.equal(processed.campaign.status, "completed");
  const recipient = processed.campaign.recipients.find((item) => item.status === "sent");
  assert.ok(recipient.providerMessageId.startsWith("dev_message_"));
  assert.ok(["A", "B"].includes(recipient.variantKey));

  await signedWebhook(`/api/webhooks/${businessId}/email`, { deliveries: [{ providerMessageId: recipient.providerMessageId, status: "delivered", occurredAt: new Date().toISOString() }] });
  let campaign = (await adminJson(`/api/businesses/${businessId}/campaigns/${campaignId}`)).campaign;
  assert.equal(campaign.metrics.delivered, 1);
  await signedWebhook(`/api/webhooks/${businessId}/email`, { messages: [{ providerMessageId: "campaign_reply_1", externalConversationId: `email:${eligibleLead.contact.id}`, externalMessageId: "<campaign_reply_1>", senderName: "Lola Campana", email: "lola-campaign@example.com", subject: "Re: Hola", body: "Me interesa, reservemos", occurredAt: new Date().toISOString() }] });
  campaign = (await adminJson(`/api/businesses/${businessId}/campaigns/${campaignId}`)).campaign;
  assert.equal(campaign.metrics.responded, 1);

  const future = await adminJson(`/api/businesses/${businessId}/campaigns`, { method: "POST", expectedStatus: 201, body: { name: "Win back pausado", channel: "email", body: "Vuelve {{contact.name}}", contactIds: [eligibleLead.contact.id], quietHours: { enabled: false }, frequencyCapDays: 0 } });
  const futureAt = new Date(Date.now() + 86400000).toISOString();
  await adminJson(`/api/businesses/${businessId}/campaigns/${future.campaign.id}/schedule`, { method: "POST", body: { scheduledAt: futureAt } });
  assert.equal((await adminJson(`/api/businesses/${businessId}/campaigns/${future.campaign.id}/status`, { method: "PATCH", body: { status: "paused" } })).campaign.status, "paused");
  assert.equal((await adminJson(`/api/businesses/${businessId}/campaigns/${future.campaign.id}/status`, { method: "PATCH", body: { status: "scheduled" } })).campaign.status, "scheduled");

  await adminJson(`/api/businesses/${businessId}/portal-access`, { method: "POST", body: { password: "CampaignPortal2026!" } });
  const login = await jsonRequest("/api/client/login", { method: "POST", body: { business: businessId, password: "CampaignPortal2026!" } });
  const clientHeaders = { "X-LocalLift-Client-Token": login.session.token };
  assert.ok((await jsonRequest(`/api/businesses/${businessId}/campaigns`, { headers: clientHeaders })).campaigns.length >= 2);
  await jsonRequest(`/api/businesses/${businessId}/campaigns`, { method: "POST", headers: clientHeaders, expectedStatus: 403, body: { name: "No permitido" } });
  await jsonRequest(`/api/businesses/${otherBusinessId}/campaigns`, { headers: clientHeaders, expectedStatus: 403 });

  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.ok(persisted.campaigns.length >= 2);
  assert.ok(persisted.campaignRecipients.some((item) => item.status === "responded"));
  assert.ok(persisted.communicationMessages.some((item) => item.campaignId === campaignId));
  assert.ok(persisted.campaignEvents.some((item) => item.type === "recipient.responded"));
  assert.ok(persisted.auditLog.some((item) => item.type === "campaign.scheduled"));
  console.log("Campaign API checks passed: auth, templates, CRUD revisions, consent preview, snapshot schedule, real channel send, delivery, response attribution, pause/resume, tenancy and client read-only access.");
} finally {
  if (child && child.exitCode === null) { child.kill(); await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]); }
  await rm(tempDir, { recursive: true, force: true });
}

function createLead(name, email) { return jsonRequest("/api/public/brasa-norte/leads", { method: "POST", expectedStatus: 201, body: { name, email, message: "Quiero informacion", privacyAccepted: true, privacyAcceptedAt: new Date().toISOString(), privacyPolicyUrl: "https://example.com/privacidad" } }); }
function grantMarketing(contactId) { return adminJson(`/api/businesses/${businessId}/contacts/${contactId}/consents`, { method: "POST", expectedStatus: 201, body: { channel: "email", purpose: "marketing", action: "granted", lawfulBasis: "consent", source: "campaign-api-test", textVersion: "v1", textSnapshot: "Acepto comunicaciones de marketing", actorType: "contact", actorId: contactId } }); }
function adminJson(pathname, options = {}) { return jsonRequest(pathname, { ...options, headers: { ...options.headers, Authorization: `Bearer ${adminToken}` } }); }
async function signedWebhook(pathname, body) { const raw = JSON.stringify(body); const signature = `sha256=${createHmac("sha256", webhookSecret).update(raw).digest("hex")}`; return jsonRequest(pathname, { method: "POST", rawBody: raw, headers: { "Content-Type": "application/json", "x-dls-signature": signature } }); }
async function jsonRequest(pathname, options = {}) { const headers = { ...options.headers }; const init = { method: options.method || "GET", headers }; if (options.rawBody !== undefined) init.body = options.rawBody; else if (options.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); } const response = await fetch(`${baseUrl}${pathname}`, init); const text = await response.text(); const expectedStatus = options.expectedStatus || 200; if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`); return text ? JSON.parse(text) : {}; }
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (child.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
