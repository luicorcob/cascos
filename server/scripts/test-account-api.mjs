import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const adminToken = "account-test-admin-token-32-characters";
const businessId = "biz_demo_brasa_norte";
let child;
let tempDir;
let dbPath;
let logs = "";

async function main() {
  tempDir = await mkdtemp(path.join(root, ".tmp-account-test-"));
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
      CLIENT_SESSION_SECRET: "account-test-client-session-secret-32-characters",
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
  const initialHealth = await waitForHealth(baseUrl);
  assert.equal(initialHealth.counts.accounts, 0);
  assert.equal(initialHealth.counts.associations, 0);
  await jsonRequest(baseUrl, `/api/businesses/${businessId}/accounts`, { expectedStatus: 401 });

  await adminJson(baseUrl, `/api/businesses/${businessId}/accounts`, {
    method: "POST", expectedStatus: 400, body: { name: "Invalida", type: "enterprise" }
  });
  await adminJson(baseUrl, `/api/businesses/${businessId}/accounts`, {
    method: "POST", expectedStatus: 400, body: { name: "Invalida", unexpected: true }
  });

  const survivor = await adminJson(baseUrl, `/api/businesses/${businessId}/accounts`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Acme Sevilla",
      type: "company",
      domain: "acme.example",
      taxId: "B12345678",
      city: "Sevilla",
      tags: ["B2B"]
    }
  });
  const duplicate = await adminJson(baseUrl, `/api/businesses/${businessId}/accounts`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Acme Sevilla SL",
      type: "company",
      domain: "www.acme.example",
      taxId: "B12345678",
      phone: "+34954000111"
    }
  });
  const duplicates = await adminJson(baseUrl, `/api/businesses/${businessId}/accounts/duplicates`);
  assert.equal(duplicates.total, 1);
  assert.equal(duplicates.groups[0].accounts.length, 2);

  const contact = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST", expectedStatus: 201, body: { name: "Decisora Acme", email: "decision@example.com" }
  });
  const relation = await adminJson(baseUrl, `/api/businesses/${businessId}/associations`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      fromType: "contact",
      fromId: contact.contact.id,
      toType: "account",
      toId: survivor.account.id,
      kind: "decision_maker",
      isPrimary: true
    }
  });
  const restored = await adminJson(baseUrl, `/api/businesses/${businessId}/associations`, {
    method: "POST",
    body: {
      fromType: "contact",
      fromId: contact.contact.id,
      toType: "account",
      toId: survivor.account.id,
      kind: "decision_maker",
      isPrimary: true
    }
  });
  assert.equal(restored.association.id, relation.association.id, "Association creation must be idempotent");

  const duplicateContact = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST", expectedStatus: 201, body: { name: "Decisora duplicada", email: "decision-duplicate@example.com" }
  });
  await adminJson(baseUrl, `/api/businesses/${businessId}/associations`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      fromType: "contact",
      fromId: duplicateContact.contact.id,
      toType: "account",
      toId: survivor.account.id,
      kind: "member"
    }
  });
  await adminJson(baseUrl, `/api/businesses/${businessId}/contacts/merge`, {
    method: "POST", body: { survivorId: contact.contact.id, duplicateIds: [duplicateContact.contact.id] }
  });
  const contactRelationsAfterMerge = await adminJson(baseUrl, `/api/businesses/${businessId}/associations?entityType=contact&entityId=${encodeURIComponent(contact.contact.id)}`);
  assert.ok(contactRelationsAfterMerge.associations.some((item) => item.kind === "member" && item.related.id === survivor.account.id));
  assert.equal(contactRelationsAfterMerge.associations.some((item) => item.fromId === duplicateContact.contact.id), false, "Contact merge must move associations");

  const deal = await adminJson(baseUrl, `/api/businesses/${businessId}/deals`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      contactId: contact.contact.id,
      accountId: duplicate.account.id,
      title: "Proyecto para cuenta",
      value: 2400
    }
  });
  assert.equal(deal.deal.account.id, duplicate.account.id);
  const dealRelations = await adminJson(baseUrl, `/api/businesses/${businessId}/associations?entityType=deal&entityId=${encodeURIComponent(deal.deal.id)}`);
  assert.equal(dealRelations.total, 2);
  const dealAccountRelation = dealRelations.associations.find((item) => item.related?.type === "account");
  assert.equal(dealAccountRelation.kind, "primary");
  assert.equal(dealAccountRelation.related.id, duplicate.account.id);

  const accountRelationsBeforeMerge = await adminJson(baseUrl, `/api/businesses/${businessId}/accounts/${duplicate.account.id}/relations`);
  assert.ok(accountRelationsBeforeMerge.relations.some((item) => item.related?.id === deal.deal.id));
  assert.ok(accountRelationsBeforeMerge.relations.some((item) => item.related?.id === contact.contact.id));

  const merged = await adminJson(baseUrl, `/api/businesses/${businessId}/accounts/merge`, {
    method: "POST", body: { survivorId: survivor.account.id, duplicateIds: [duplicate.account.id] }
  });
  assert.deepEqual(merged.mergedIds, [duplicate.account.id]);
  assert.equal(merged.account.phone, "+34954000111");
  assert.ok(merged.account.relations.some((item) => item.related?.id === deal.deal.id));
  const movedDeal = await adminJson(baseUrl, `/api/businesses/${businessId}/deals/${deal.deal.id}`);
  assert.equal(movedDeal.deal.accountId, survivor.account.id);
  assert.equal(movedDeal.deal.account.id, survivor.account.id);
  await adminJson(baseUrl, `/api/businesses/${businessId}/accounts/${survivor.account.id}`, { method: "DELETE", expectedStatus: 409 });

  const won = await adminJson(baseUrl, `/api/businesses/${businessId}/deals/${deal.deal.id}/pipeline`, {
    method: "PATCH", body: { stageId: "won", order: 1 }
  });
  assert.equal(won.deal.status, "won");

  const otherBusiness = await adminJson(baseUrl, "/api/businesses", {
    method: "POST", expectedStatus: 201, body: { name: "Cuenta Ajena", slug: "cuenta-ajena", status: "lead" }
  });
  const otherAccount = await adminJson(baseUrl, `/api/businesses/${otherBusiness.business.id}/accounts`, {
    method: "POST", expectedStatus: 201, body: { name: "Otra cuenta", type: "company" }
  });
  await adminJson(baseUrl, `/api/businesses/${businessId}/associations`, {
    method: "POST",
    expectedStatus: 404,
    body: { fromType: "contact", fromId: contact.contact.id, toType: "account", toId: otherAccount.account.id, kind: "member" }
  });
  await adminJson(baseUrl, `/api/businesses/${otherBusiness.business.id}/accounts/${survivor.account.id}`, { expectedStatus: 404 });

  await adminJson(baseUrl, `/api/businesses/${businessId}/portal-access`, {
    method: "POST", body: { password: "PortalAccounts2026!" }
  });
  const login = await jsonRequest(baseUrl, "/api/client/login", {
    method: "POST", body: { business: businessId, password: "PortalAccounts2026!" }
  });
  const clientHeaders = { "X-LocalLift-Client-Token": login.session.token };
  const ownAccounts = await jsonRequest(baseUrl, `/api/businesses/${businessId}/accounts`, { headers: clientHeaders });
  assert.equal(ownAccounts.total, 1);
  await jsonRequest(baseUrl, `/api/businesses/${otherBusiness.business.id}/accounts`, { headers: clientHeaders, expectedStatus: 403 });

  await adminJson(baseUrl, `/api/businesses/${businessId}/accounts/${survivor.account.id}`, { method: "DELETE" });
  const activeAccounts = await adminJson(baseUrl, `/api/businesses/${businessId}/accounts`);
  assert.equal(activeAccounts.total, 0);
  const allAccounts = await adminJson(baseUrl, `/api/businesses/${businessId}/accounts?includeArchived=true`);
  assert.equal(allAccounts.total, 2);
  await adminJson(baseUrl, `/api/businesses/${businessId}/associations/${relation.association.id}`, { method: "DELETE", expectedStatus: 404 });

  const finalHealth = await jsonRequest(baseUrl, "/api/health");
  assert.equal(finalHealth.counts.accounts, 3);
  assert.ok(finalHealth.counts.associations >= 3);
  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.ok(persisted.auditLog.some((entry) => entry.type === "account.merged" && entry.accountId === survivor.account.id));
  assert.ok(persisted.auditLog.some((entry) => entry.type === "association.created"));
  console.log("Account API checks passed: CRUD, relations, duplicate merge, deal links, tenancy, client scope and soft archive.");
}

async function adminJson(baseUrl, pathname, options = {}) {
  return jsonRequest(baseUrl, pathname, { ...options, headers: { ...options.headers, Authorization: `Bearer ${adminToken}` } });
}

async function jsonRequest(baseUrl, pathname, options = {}) {
  const headers = { ...options.headers };
  const init = { method: options.method || "GET", headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  const expectedStatus = options.expectedStatus || 200;
  if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`);
  return text ? JSON.parse(text) : {};
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
  if (tempDir && tempDir.startsWith(root) && path.basename(tempDir).startsWith(".tmp-account-test-")) {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main()
  .catch((error) => {
    console.error(`Account API test failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(cleanup);
