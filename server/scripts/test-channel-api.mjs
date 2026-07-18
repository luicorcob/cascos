import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-channel-api-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const adminToken = "channel-admin-token";
const webhookSecret = "channel-webhook-secret";
let child;
let logs = "";

try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  db.teamMembers = Array.isArray(db.teamMembers) ? db.teamMembers : [];
  db.teamMembers.push({ id: "member_channel_ana", businessId, name: "Ana Omnicanal", role: "manager", active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
  child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: adminToken, ADMIN_API_TOKEN: adminToken,
      CLIENT_SESSION_SECRET: "channel-client-session-secret-32-characters",
      DLS_CHANNEL_WEBHOOK_SECRET: webhookSecret,
      WHATSAPP_VERIFY_TOKEN: "verify-channel-wa",
      BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  child.stdout.on("data", appendLog); child.stderr.on("data", appendLog); await waitForHealth();

  await jsonRequest(`/api/businesses/${businessId}/channels/inbox`, { expectedStatus: 401 });
  const connection = await adminJson(`/api/businesses/${businessId}/channels/connections/email`, { method: "PUT", body: { provider: "development", displayName: "Email DLS", senderId: "hola@example.com", active: true, firstResponseTargetMinutes: 30 } });
  assert.equal(connection.connection.credentialsReady, true);
  await adminJson(`/api/businesses/${businessId}/channels/connections/whatsapp`, { method: "PUT", body: { provider: "development", active: true } });

  const inboundPayload = { messages: [{ providerMessageId: "dev_email_in_1", externalConversationId: "email:ines:reserva", externalMessageId: "<dev_email_in_1>", senderName: "Ines Cliente", email: "ines-channel@example.com", subject: "Reserva de grupo", body: "Quiero reservar para doce", occurredAt: new Date().toISOString(), attachments: [{ id: "att_1", name: "brief.pdf", type: "application/pdf", url: "https://example.com/brief.pdf" }] }] };
  await signedWebhook(`/api/webhooks/${businessId}/email`, inboundPayload, { signature: "sha256=bad", expectedStatus: 401 });
  const inbound = await signedWebhook(`/api/webhooks/${businessId}/email`, inboundPayload);
  assert.equal(inbound.inboundCreated, 1);
  const duplicate = await signedWebhook(`/api/webhooks/${businessId}/email`, inboundPayload);
  assert.equal(duplicate.duplicates, 1);

  let inbox = (await adminJson(`/api/businesses/${businessId}/channels/inbox`)).inbox;
  assert.equal(inbox.summary.open, 1);
  assert.equal(inbox.summary.unread, 1);
  const conversation = inbox.conversations.find((item) => item.contact.email === "ines-channel@example.com");
  assert.ok(conversation);
  assert.equal(conversation.messages[0].attachments[0].name, "brief.pdf");

  await adminJson(`/api/businesses/${businessId}/channels/conversations/${conversation.id}/lock`, { method: "POST", body: { actorId: "member_channel_ana", actorName: "Ana Omnicanal", ttlSeconds: 180 } });
  await adminJson(`/api/businesses/${businessId}/channels/conversations/${conversation.id}/messages`, { method: "POST", expectedStatus: 409, body: { actorId: "otro_agente", senderName: "Otro", body: "No deberia salir", purpose: "service" } });
  const sent = await adminJson(`/api/businesses/${businessId}/channels/conversations/${conversation.id}/messages`, { method: "POST", expectedStatus: 201, body: { actorId: "member_channel_ana", senderName: "Ana Omnicanal", body: "Tenemos disponibilidad", subject: "Re: Reserva de grupo", purpose: "service", idempotencyKey: "channel-api-send-1" } });
  assert.equal(sent.message.direction, "outbound");
  assert.equal(sent.message.deliveryStatus, "queued");
  const duplicateSend = await adminJson(`/api/businesses/${businessId}/channels/conversations/${conversation.id}/messages`, { method: "POST", body: { actorId: "member_channel_ana", senderName: "Ana Omnicanal", body: "Tenemos disponibilidad", purpose: "service", idempotencyKey: "channel-api-send-1" } });
  assert.equal(duplicateSend.duplicate, true);
  await adminJson(`/api/businesses/${businessId}/channels/conversations/${conversation.id}/notes`, { method: "POST", expectedStatus: 201, body: { senderName: "Ana Omnicanal", body: "Confirmar menu con cocina", mentions: ["member_channel_ana"] } });
  await adminJson(`/api/businesses/${businessId}/channels/conversations/${conversation.id}`, { method: "PATCH", body: { assignedToId: "member_channel_ana" } });
  await adminJson(`/api/businesses/${businessId}/channels/conversations/${conversation.id}/read`, { method: "POST", body: {} });
  const delivery = await signedWebhook(`/api/webhooks/${businessId}/email`, { deliveries: [{ providerMessageId: sent.message.providerMessageId, status: "delivered", occurredAt: new Date().toISOString() }] });
  assert.equal(delivery.deliveryEvents, 1);
  inbox = (await adminJson(`/api/businesses/${businessId}/channels/inbox`)).inbox;
  const updated = inbox.conversations.find((item) => item.id === conversation.id);
  assert.equal(updated.unreadCount, 0);
  assert.equal(updated.assignedTo.name, "Ana Omnicanal");
  assert.equal(updated.messages.find((item) => item.id === sent.message.id).deliveryStatus, "delivered");
  assert.ok(updated.messages.some((item) => item.direction === "internal"));
  await adminJson(`/api/businesses/${businessId}/channels/conversations/${conversation.id}/lock?actorId=member_channel_ana`, { method: "DELETE" });
  await adminJson(`/api/businesses/${businessId}/channels/conversations/${conversation.id}`, { method: "PATCH", body: { status: "closed" } });

  const challenge = await rawRequest(`/api/webhooks/${businessId}/whatsapp?hub.mode=subscribe&hub.verify_token=verify-channel-wa&hub.challenge=123456`);
  assert.equal(challenge.status, 200);
  assert.equal(challenge.text, "123456");
  const deniedChallenge = await rawRequest(`/api/webhooks/${businessId}/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=x`);
  assert.equal(deniedChallenge.status, 403);

  await adminJson(`/api/businesses/${businessId}/portal-access`, { method: "POST", body: { password: "ChannelPortal2026!" } });
  const login = await jsonRequest("/api/client/login", { method: "POST", body: { business: businessId, password: "ChannelPortal2026!" } });
  const clientHeaders = { "X-LocalLift-Client-Token": login.session.token };
  assert.ok((await jsonRequest(`/api/businesses/${businessId}/channels/inbox`, { headers: clientHeaders })).inbox.total >= 1);
  await jsonRequest(`/api/businesses/${businessId}/channels/connections/email`, { method: "PUT", headers: clientHeaders, expectedStatus: 403, body: { provider: "development", active: false } });

  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.ok(persisted.channelConnections.length >= 2);
  assert.equal(persisted.communicationMessages.filter((item) => item.providerMessageId === "dev_email_in_1").length, 1);
  assert.ok(persisted.channelDeliveryEvents.some((event) => event.status === "delivered"));
  assert.ok(persisted.auditLog.some((entry) => entry.type === "channel.message_received"));
  console.log("Channel API checks passed: signed webhook, dedupe, identity, consent, send, delivery, notes, assignment, lock, SLA access and tenancy.");
} finally {
  if (child && child.exitCode === null) { child.kill(); await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]); }
  await rm(tempDir, { recursive: true, force: true });
}

function adminJson(pathname, options = {}) { return jsonRequest(pathname, { ...options, headers: { ...options.headers, Authorization: `Bearer ${adminToken}` } }); }
async function signedWebhook(pathname, body, options = {}) { const raw = JSON.stringify(body); const signature = options.signature || `sha256=${createHmac("sha256", webhookSecret).update(raw).digest("hex")}`; return jsonRequest(pathname, { method: "POST", expectedStatus: options.expectedStatus, rawBody: raw, headers: { "Content-Type": "application/json", "x-dls-signature": signature } }); }
async function jsonRequest(pathname, options = {}) { const headers = { ...options.headers }; const init = { method: options.method || "GET", headers }; if (options.rawBody !== undefined) init.body = options.rawBody; else if (options.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); } const response = await fetch(`${baseUrl}${pathname}`, init); const text = await response.text(); const expectedStatus = options.expectedStatus || 200; if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`); return text ? JSON.parse(text) : {}; }
async function rawRequest(pathname) { const response = await fetch(`${baseUrl}${pathname}`); return { status: response.status, text: await response.text() }; }
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (child.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
