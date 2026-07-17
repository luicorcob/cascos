import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const adminToken = "deal-test-admin-token-32-characters";
const businessId = "biz_demo_brasa_norte";
let child;
let tempDir;
let dbPath;
let logs = "";

async function main() {
  tempDir = await mkdtemp(path.join(root, ".tmp-deal-test-"));
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
      CLIENT_SESSION_SECRET: "deal-test-client-session-secret-32-characters",
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

  const health = await waitForHealth(baseUrl);
  assert.equal(health.counts.pipelines, 0);
  assert.equal(health.counts.deals, 0);
  await jsonRequest(baseUrl, `/api/businesses/${businessId}/deals`, { expectedStatus: 401 });

  const virtualPipelines = await adminJson(baseUrl, `/api/businesses/${businessId}/pipelines`);
  assert.equal(virtualPipelines.total, 1);
  assert.equal(virtualPipelines.pipelines[0].isDefault, true);
  assert.deepEqual(virtualPipelines.pipelines[0].stages.map((stage) => stage.id), ["new", "contacted", "waiting", "reserved", "won", "lost"]);

  const contact = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Contacto con dos ventas", email: "two-deals@example.com", valueEstimate: 900 }
  });
  const contactId = contact.contact.id;

  await adminJson(baseUrl, `/api/businesses/${businessId}/deals`, {
    method: "POST",
    expectedStatus: 400,
    body: { contactId, title: "Valor invalido", value: "900" }
  });
  await adminJson(baseUrl, `/api/businesses/${businessId}/deals`, {
    method: "POST",
    expectedStatus: 400,
    body: { contactId, title: "Campo desconocido", value: 900, unexpected: true }
  });

  const first = await adminJson(baseUrl, `/api/businesses/${businessId}/deals`, {
    method: "POST",
    expectedStatus: 201,
    body: { contactId, title: "Web corporativa", value: 1200, priority: "alta" }
  });
  const second = await adminJson(baseUrl, `/api/businesses/${businessId}/deals`, {
    method: "POST",
    expectedStatus: 201,
    body: { contactId, title: "Campaña local", value: 450, priority: "media" }
  });
  assert.notEqual(first.deal.id, second.deal.id);
  assert.equal(first.deal.contact.id, contactId);

  const byContact = await adminJson(baseUrl, `/api/businesses/${businessId}/deals?contactId=${encodeURIComponent(contactId)}`);
  assert.equal(byContact.total, 2, "A contact must support multiple independent deals");
  const board = await adminJson(baseUrl, `/api/businesses/${businessId}/deals/pipeline`);
  assert.equal(board.total, 2);
  assert.equal(board.totalValue, 1650);
  assert.equal(board.columns.find((column) => column.stageId === "new")?.count, 2);

  await adminJson(baseUrl, `/api/businesses/${businessId}/deals/${first.deal.id}/pipeline`, {
    method: "PATCH",
    expectedStatus: 400,
    body: { stageId: "lost", order: 10 }
  });
  const lost = await adminJson(baseUrl, `/api/businesses/${businessId}/deals/${first.deal.id}/pipeline`, {
    method: "PATCH",
    body: { stageId: "lost", order: 10, lostReason: "precio" }
  });
  assert.equal(lost.deal.status, "lost");
  assert.equal(lost.deal.lostReason, "precio");
  const untouched = await adminJson(baseUrl, `/api/businesses/${businessId}/deals/${second.deal.id}`);
  assert.equal(untouched.deal.stageId, "new", "Moving one deal must not alter another deal from the same contact");

  const customPipeline = await adminJson(baseUrl, `/api/businesses/${businessId}/pipelines`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Eventos",
      stages: [
        { id: "brief", name: "Brief", type: "open", order: 100, probability: 20 },
        { id: "confirmed", name: "Confirmado", type: "won", order: 200, probability: 100 },
        { id: "discarded", name: "Descartado", type: "lost", order: 300, probability: 0 }
      ]
    }
  });
  const moved = await adminJson(baseUrl, `/api/businesses/${businessId}/deals/${second.deal.id}/pipeline`, {
    method: "PATCH",
    body: { pipelineId: customPipeline.pipeline.id, stageId: "brief", order: 50 }
  });
  assert.equal(moved.deal.pipelineId, customPipeline.pipeline.id);
  assert.equal(moved.deal.stageId, "brief");
  await adminJson(baseUrl, `/api/businesses/${businessId}/pipelines/${customPipeline.pipeline.id}`, {
    method: "DELETE",
    expectedStatus: 409
  });

  const survivor = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST", expectedStatus: 201, body: { name: "Superviviente", email: "survivor-deal@example.com" }
  });
  const duplicate = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST", expectedStatus: 201, body: { name: "Duplicado", email: "duplicate-deal@example.com" }
  });
  const mergeDeal = await adminJson(baseUrl, `/api/businesses/${businessId}/deals`, {
    method: "POST", expectedStatus: 201, body: { contactId: duplicate.contact.id, title: "Venta conservada", value: 80 }
  });
  await adminJson(baseUrl, `/api/businesses/${businessId}/contacts/merge`, {
    method: "POST", body: { survivorId: survivor.contact.id, duplicateIds: [duplicate.contact.id] }
  });
  const mergedReference = await adminJson(baseUrl, `/api/businesses/${businessId}/deals/${mergeDeal.deal.id}`);
  assert.equal(mergedReference.deal.contactId, survivor.contact.id, "Contact merge must preserve and move deal references");

  const otherBusiness = await adminJson(baseUrl, "/api/businesses", {
    method: "POST", expectedStatus: 201, body: { name: "Otro Deals", slug: "otro-deals", status: "lead" }
  });
  await adminJson(baseUrl, `/api/businesses/${otherBusiness.business.id}/deals/${first.deal.id}`, { expectedStatus: 404 });
  await adminJson(baseUrl, `/api/businesses/${otherBusiness.business.id}/deals`, {
    method: "POST", expectedStatus: 404, body: { contactId, title: "Cruce prohibido", value: 10 }
  });

  await adminJson(baseUrl, `/api/businesses/${businessId}/portal-access`, {
    method: "POST", body: { password: "PortalDeals2026!" }
  });
  const login = await jsonRequest(baseUrl, "/api/client/login", {
    method: "POST", body: { business: businessId, password: "PortalDeals2026!" }
  });
  const clientHeaders = { "X-LocalLift-Client-Token": login.session.token };
  const clientDeals = await jsonRequest(baseUrl, `/api/businesses/${businessId}/deals`, { headers: clientHeaders });
  assert.ok(clientDeals.total >= 3, "The business client session must access its own opportunities");
  await jsonRequest(baseUrl, `/api/businesses/${otherBusiness.business.id}/deals`, {
    headers: clientHeaders, expectedStatus: 403
  });

  await adminJson(baseUrl, `/api/businesses/${businessId}/deals/${second.deal.id}`, { method: "DELETE" });
  await adminJson(baseUrl, `/api/businesses/${businessId}/pipelines/${customPipeline.pipeline.id}`, { method: "DELETE" });
  const activeDeals = await adminJson(baseUrl, `/api/businesses/${businessId}/deals`);
  assert.equal(activeDeals.deals.some((deal) => deal.id === second.deal.id), false);
  const archivedDeals = await adminJson(baseUrl, `/api/businesses/${businessId}/deals?includeArchived=true`);
  assert.equal(archivedDeals.deals.some((deal) => deal.id === second.deal.id && deal.archivedAt), true);

  const finalHealth = await jsonRequest(baseUrl, "/api/health");
  assert.equal(finalHealth.counts.pipelines, 2);
  assert.equal(finalHealth.counts.deals, 3);
  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.ok(persisted.auditLog.some((entry) => entry.type === "deal.stage_changed" && entry.dealId === first.deal.id));
  assert.ok(persisted.activities.some((activity) => activity.type === "deal.created" && activity.dealId === first.deal.id));

  console.log("Deal API checks passed: multiple deals, pipelines, stages, tenancy, soft archive, merge and persistence.");
}

async function adminJson(baseUrl, pathname, options = {}) {
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
  const text = await response.text();
  const expectedStatus = options.expectedStatus || 200;
  if (response.status !== expectedStatus) {
    throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`);
    try {
      return await jsonRequest(baseUrl, "/api/health");
    } catch {
      await delay(150);
    }
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

function appendLog(chunk) {
  logs += String(chunk);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function cleanup() {
  if (child && child.exitCode === null) {
    child.kill();
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]);
  }
  if (tempDir && tempDir.startsWith(root) && path.basename(tempDir).startsWith(".tmp-deal-test-")) {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main()
  .catch((error) => {
    console.error(`Deal API test failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(cleanup);
