import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-channel-browser-"));
const profileRoot = await mkdtemp(path.join(os.tmpdir(), "dls-channel-browser-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const webhookSecret = "channel-browser-webhook-secret";
const chrome = await findChrome();
let server;
let logs = "";

try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  db.teamMembers = Array.isArray(db.teamMembers) ? db.teamMembers : [];
  db.teamMembers.push({ id: "member_channel_browser", businessId, name: "Ana Omnicanal", role: "manager", active: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");

  server = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: "", ADMIN_API_TOKEN: "", DLS_CHANNEL_WEBHOOK_SECRET: webhookSecret,
      BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  server.stdout.on("data", appendLog);
  server.stderr.on("data", appendLog);
  await waitForHealth();

  await jsonRequest(`/api/businesses/${businessId}/channels/connections/email`, { method: "PUT", body: { provider: "development", displayName: "Email DLS", senderId: "equipo@example.com", active: true, firstResponseTargetMinutes: 30 } });
  await jsonRequest(`/api/businesses/${businessId}/channels/connections/whatsapp`, { method: "PUT", body: { provider: "development", displayName: "WhatsApp DLS", active: true, firstResponseTargetMinutes: 20 } });
  const occurredAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  await signedWebhook(`/api/webhooks/${businessId}/email`, {
    messages: [{
      providerMessageId: "browser_inbound_email_1", externalConversationId: "email:ines:browser", externalMessageId: "<browser_inbound_email_1>",
      senderName: "Ines Cliente", email: "ines-browser@example.com", subject: "Reserva de grupo",
      body: "Quiero reservar una mesa para doce personas", occurredAt,
      attachments: [{ id: "browser_attachment_1", name: "brief-reserva.pdf", type: "application/pdf", url: "https://example.com/brief-reserva.pdf" }]
    }]
  });
  const inbox = (await jsonRequest(`/api/businesses/${businessId}/channels/inbox`)).inbox;
  const conversation = inbox.conversations.find((item) => item.contact.email === "ines-browser@example.com");
  assert.ok(conversation);
  await jsonRequest(`/api/businesses/${businessId}/channels/conversations/${conversation.id}`, { method: "PATCH", body: { assignedToId: "member_channel_browser" } });
  await jsonRequest(`/api/businesses/${businessId}/channels/conversations/${conversation.id}/lock`, { method: "POST", body: { actorId: "member_channel_browser", actorName: "Ana Omnicanal", ttlSeconds: 600 } });
  const sent = await jsonRequest(`/api/businesses/${businessId}/channels/conversations/${conversation.id}/messages`, { method: "POST", expectedStatus: 201, body: { actorId: "member_channel_browser", senderName: "Ana Omnicanal", body: "Tenemos disponibilidad y te confirmamos la mesa.", subject: "Re: Reserva de grupo", purpose: "service", idempotencyKey: "browser_channel_send_1" } });
  await jsonRequest(`/api/businesses/${businessId}/channels/conversations/${conversation.id}/notes`, { method: "POST", expectedStatus: 201, body: { senderName: "Ana Omnicanal", body: "Nota interna: confirmar menu con cocina", mentions: ["member_channel_browser"] } });
  await signedWebhook(`/api/webhooks/${businessId}/email`, { deliveries: [{ providerMessageId: sent.message.providerMessageId, status: "delivered", occurredAt: new Date().toISOString() }] });

  for (const size of ["1440,1100", "390,844"]) {
    const profile = `${profileRoot}-${size.replace(",", "x")}`;
    const result = await run(chrome, [
      "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${profile}`, `--window-size=${size}`, "--virtual-time-budget=25000", "--dump-dom",
      `${baseUrl}/pages/business-dashboard.html?business=${businessId}&tab=inbox&apiBase=same-origin`
    ]);
    assert.equal(result.exitCode, 0, `Chrome failed at ${size}: ${result.stderr}`);
    assert.match(result.stdout, /data-channel-inbox/);
    assert.match(result.stdout, /Bandeja omnicanal/);
    assert.match(result.stdout, /Conversaciones reales/);
    assert.match(result.stdout, /data-channel-connection="email"/);
    assert.match(result.stdout, /data-channel-connection="whatsapp"/);
    assert.match(result.stdout, /Ines Cliente/);
    assert.match(result.stdout, /Ana Omnicanal/);
    assert.match(result.stdout, /Quiero reservar una mesa para doce personas/);
    assert.match(result.stdout, /Tenemos disponibilidad y te confirmamos la mesa/);
    assert.match(result.stdout, /Nota interna: confirmar menu con cocina/);
    assert.match(result.stdout, /brief-reserva.pdf/);
    assert.match(result.stdout, /Entregado/);
    assert.match(result.stdout, /SLA vencido/);
    assert.match(result.stdout, /Tu tienes el turno/);
    assert.match(result.stdout, /data-channel-reply-form/);
    assert.match(result.stdout, /data-channel-note-form/);
    assert.doesNotMatch(result.stdout, /Bandeja omnicanal no disponible/);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  console.log("Channel browser checks passed: responsive omnichannel inbox, connections, messages, attachments, delivery, SLA, assignment, notes and collision lock.");
} finally {
  if (server && server.exitCode === null) { server.kill(); await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(2000)]); }
  await rm(tempDir, { recursive: true, force: true });
  await rm(profileRoot, { recursive: true, force: true }).catch(() => {});
}

async function signedWebhook(pathname, body) { const raw = JSON.stringify(body); const signature = `sha256=${createHmac("sha256", webhookSecret).update(raw).digest("hex")}`; return jsonRequest(pathname, { method: "POST", rawBody: raw, headers: { "Content-Type": "application/json", "x-dls-signature": signature } }); }
async function jsonRequest(pathname, options = {}) { const headers = { ...options.headers }; const init = { method: options.method || "GET", headers }; if (options.rawBody !== undefined) init.body = options.rawBody; else if (options.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); } const response = await fetch(`${baseUrl}${pathname}`, init); const text = await response.text(); const expectedStatus = options.expectedStatus || 200; if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`); return text ? JSON.parse(text) : {}; }
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (server.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
async function findChrome() { const candidates = process.platform === "win32" ? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")] : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]; for (const candidate of candidates) { try { await access(candidate); return candidate; } catch {} } throw new Error("Chrome or Chromium is required for the channel browser test"); }
function run(command, args) { return new Promise((resolve, reject) => { const processChild = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; processChild.stdout.on("data", (chunk) => { stdout += String(chunk); }); processChild.stderr.on("data", (chunk) => { stderr += String(chunk); }); processChild.on("error", reject); processChild.on("close", (exitCode) => resolve({ exitCode, stdout, stderr })); }); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
