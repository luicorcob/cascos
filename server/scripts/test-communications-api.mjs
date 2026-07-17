import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const adminToken = "communications-test-admin-token-32-characters";
const businessId = "biz_demo_brasa_norte";
let child;
let tempDir;
let dbPath;
let logs = "";

async function main() {
  tempDir = await mkdtemp(path.join(root, ".tmp-communications-test-"));
  dbPath = path.join(tempDir, "business-db.json");
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: adminToken,
      CLIENT_SESSION_SECRET: "communications-test-session-secret-32-characters",
      BUSINESS_STORE: "json",
      BUSINESS_DB_DRIVER: "json",
      DATABASE_URL: "",
      POSTGRES_URL: "",
      LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath,
      BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"),
      BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);
  await waitForHealth(baseUrl);

  await jsonRequest(baseUrl, "/api/enterprise/communications/threads", { expectedStatus: 401 });
  await adminJson(baseUrl, `/api/businesses/${businessId}/portal-access`, {
    method: "POST",
    body: { password: "PortalMessages2026!" }
  });
  const login = await jsonRequest(baseUrl, "/api/client/login", {
    method: "POST",
    body: { business: businessId, password: "PortalMessages2026!" }
  });
  const clientHeaders = { "X-LocalLift-Client-Token": login.session.token };

  const member = await jsonRequest(baseUrl, `/api/businesses/${businessId}/communications/members`, {
    method: "POST",
    headers: clientHeaders,
    expectedStatus: 201,
    body: { name: "Ana Cliente", role: "owner" }
  });
  assert.equal(member.member.role, "owner");
  const duplicateMember = await jsonRequest(baseUrl, `/api/businesses/${businessId}/communications/members`, {
    method: "POST",
    headers: clientHeaders,
    body: { name: "ana cliente", role: "employee" }
  });
  assert.equal(duplicateMember.created, false);
  assert.equal((await jsonRequest(baseUrl, `/api/businesses/${businessId}/communications/members`, { headers: clientHeaders })).total, 1);

  const contact = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Ana Cliente", email: "ana.crm@example.com" }
  });
  const account = await adminJson(baseUrl, `/api/businesses/${businessId}/accounts`, {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Cliente mensajería", type: "company", domain: "mensajeria.example" }
  });
  const deal = await adminJson(baseUrl, `/api/businesses/${businessId}/deals`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      contactId: contact.contact.id,
      accountId: account.account.id,
      title: "Conversación comercial enlazada",
      value: 640
    }
  });

  const support = await jsonRequest(baseUrl, `/api/businesses/${businessId}/communications/threads`, {
    method: "POST",
    headers: clientHeaders,
    expectedStatus: 201,
    body: {
      type: "support",
      contactId: contact.contact.id,
      accountId: account.account.id,
      dealId: deal.deal.id
    }
  });
  const supportId = support.thread.id;
  const threadRelations = await adminJson(
    baseUrl,
    `/api/businesses/${businessId}/associations?entityType=conversation&entityId=${encodeURIComponent(supportId)}`
  );
  assert.equal(threadRelations.total, 3);
  assert.deepEqual(
    new Set(threadRelations.associations.map((association) => association.related.type)),
    new Set(["contact", "account", "deal"]),
    "A CRM conversation must preserve its contact, account and deal context"
  );
  const sameSupport = await jsonRequest(baseUrl, `/api/businesses/${businessId}/communications/threads`, {
    method: "POST",
    headers: clientHeaders,
    body: { type: "support" }
  });
  assert.equal(sameSupport.thread.id, supportId, "There must be one support conversation per client");

  await jsonRequest(baseUrl, `/api/businesses/${businessId}/communications/threads/${supportId}/messages`, {
    method: "POST",
    headers: clientHeaders,
    expectedStatus: 400,
    body: { senderName: "Ana Cliente", attachmentUrl: "file:///private.pdf" }
  });
  await jsonRequest(baseUrl, `/api/businesses/${businessId}/communications/threads/${supportId}/messages`, {
    method: "POST",
    headers: clientHeaders,
    expectedStatus: 201,
    body: {
      senderName: "Ana Cliente",
      body: "Necesito ayuda con la web.",
      attachmentName: "Captura",
      attachmentUrl: "https://files.example.com/captura.png"
    }
  });

  const team = await jsonRequest(baseUrl, `/api/businesses/${businessId}/communications/threads`, {
    method: "POST",
    headers: clientHeaders,
    expectedStatus: 201,
    body: { type: "team", title: "Equipo general" }
  });
  await jsonRequest(baseUrl, `/api/businesses/${businessId}/communications/threads/${team.thread.id}/messages`, {
    method: "POST",
    headers: clientHeaders,
    expectedStatus: 201,
    body: { senderName: "Ana Cliente", body: "Bienvenidos al canal interno." }
  });

  const supportInbox = await adminJson(baseUrl, "/api/enterprise/communications/threads?type=support");
  assert.equal(supportInbox.total, 1);
  assert.equal(supportInbox.unreadTotal, 1);
  assert.equal(supportInbox.threads[0].messages[0].senderRole, "client");
  const privateInbox = await adminJson(baseUrl, "/api/enterprise/communications/threads");
  assert.equal(privateInbox.total, 1, "The DLS inbox must not expose private employee rooms");
  await adminJson(baseUrl, `/api/enterprise/communications/threads/${team.thread.id}`, { expectedStatus: 404 });
  const privateScopedInbox = await adminJson(baseUrl, `/api/businesses/${businessId}/communications/threads`);
  assert.equal(privateScopedInbox.total, 1, "Scoped admin previews must not expose private employee rooms");
  assert.equal((await adminJson(baseUrl, `/api/businesses/${businessId}/communications/members`)).total, 0);
  await adminJson(baseUrl, `/api/enterprise/communications/threads/${supportId}/messages`, {
    method: "POST",
    expectedStatus: 201,
    body: { senderName: "Lucia · Soporte DLS", body: "Ya estamos revisándolo." }
  });

  const clientBeforeRead = await jsonRequest(baseUrl, `/api/businesses/${businessId}/communications/threads?type=support&markRead=true`, { headers: clientHeaders });
  assert.equal(clientBeforeRead.unreadTotal, 1);
  const clientAfterRead = await jsonRequest(baseUrl, `/api/businesses/${businessId}/communications/threads?type=support`, { headers: clientHeaders });
  assert.equal(clientAfterRead.unreadTotal, 0);
  assert.equal(clientAfterRead.threads[0].messages.at(-1).senderRole, "developer");

  await adminJson(baseUrl, `/api/enterprise/communications/threads/${supportId}`, {
    method: "PATCH",
    body: { status: "closed" }
  });
  await jsonRequest(baseUrl, `/api/businesses/${businessId}/communications/threads/${supportId}/messages`, {
    method: "POST",
    headers: clientHeaders,
    expectedStatus: 201,
    body: { senderName: "Ana Cliente", body: "Añado otra consulta." }
  });
  const reopened = await adminJson(baseUrl, `/api/enterprise/communications/threads/${supportId}`);
  assert.equal(reopened.thread.status, "open", "A new message must reopen a closed support thread");

  const otherBusiness = await adminJson(baseUrl, "/api/businesses", {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Otro cliente", slug: "otro-cliente-mensajes" }
  });
  await jsonRequest(baseUrl, `/api/businesses/${otherBusiness.business.id}/communications/threads`, {
    headers: clientHeaders,
    expectedStatus: 403
  });
  const scopedThreads = await jsonRequest(baseUrl, `/api/businesses/${businessId}/communications/threads`, { headers: clientHeaders });
  assert.equal(scopedThreads.total, 2);
  assert.deepEqual(new Set(scopedThreads.threads.map((thread) => thread.type)), new Set(["support", "team"]));

  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.equal(persisted.teamMembers.length, 1);
  assert.equal(persisted.communicationThreads.length, 2);
  assert.equal(persisted.communicationMessages.length, 4);
  assert.equal(persisted.associations.filter((association) => association.toId === supportId || association.fromId === supportId).length, 3);
  assert.ok(persisted.auditLog.some((entry) => entry.type === "communication.message_created"));

  console.log("Communications API checks passed: CRM links, support, team rooms, unread state, attachments, tenancy and persistence.");
}

function adminJson(baseUrl, pathname, options = {}) {
  return jsonRequest(baseUrl, pathname, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${adminToken}` }
  });
}

async function jsonRequest(baseUrl, pathname, options = {}) {
  const headers = { ...options.headers };
  const init = { method: options.method || "GET", headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const body = await response.text();
  const expectedStatus = options.expectedStatus || 200;
  if (response.status !== expectedStatus) {
    throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${body}`);
  }
  return body ? JSON.parse(body) : {};
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`);
    try { return await jsonRequest(baseUrl, "/api/health"); } catch { await delay(150); }
  }
  throw new Error(`Healthcheck did not pass.\n${logs}`);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

async function cleanup() {
  if (child && child.exitCode === null) {
    child.kill();
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]);
  }
  if (tempDir && tempDir.startsWith(root) && path.basename(tempDir).startsWith(".tmp-communications-test-")) {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Communications API test failed: ${error.message}`);
  process.exitCode = 1;
}).finally(cleanup);
