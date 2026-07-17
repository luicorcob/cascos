import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const adminToken = "proposal-test-admin-token-32-characters";
const businessId = "biz_demo_brasa_norte";
const businessSlug = "brasa-norte";
let child;
let tempDir;
let dbPath;
let logs = "";

async function main() {
  tempDir = await mkdtemp(path.join(root, ".tmp-proposal-test-"));
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
      CLIENT_SESSION_SECRET: "proposal-test-client-session-secret-32-characters",
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
  assert.equal(initialHealth.counts.proposals, 0);
  assert.equal(initialHealth.counts.projects, 0);
  await jsonRequest(baseUrl, `/api/businesses/${businessId}/proposals`, { expectedStatus: 401 });

  const contact = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Contacto Propuesta", email: "proposal@example.com", valueEstimate: 1200 }
  });
  const contactId = contact.contact.id;
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const future = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  await adminJson(baseUrl, `/api/businesses/${businessId}/proposals`, {
    method: "POST",
    expectedStatus: 400,
    body: proposalBody(contactId, future, { package: "enterprise" })
  });
  await adminJson(baseUrl, `/api/businesses/${businessId}/proposals`, {
    method: "POST",
    expectedStatus: 400,
    body: proposalBody(contactId, future, { setupPrice: "490" })
  });
  await adminJson(baseUrl, `/api/businesses/${businessId}/proposals`, {
    method: "POST",
    expectedStatus: 400,
    body: { ...proposalBody(contactId, future), unexpected: true }
  });

  const draft = await adminJson(baseUrl, `/api/businesses/${businessId}/proposals`, {
    method: "POST",
    expectedStatus: 201,
    body: proposalBody(contactId, past, {
      conditions: "Primera línea\n<script>alert('&')</script>"
    })
  });
  assert.equal(draft.proposal.status, "borrador", "Past drafts must not expire");
  assert.equal(draft.activities[0].type, "proposal.created");
  const draftRelations = await adminJson(baseUrl, `/api/businesses/${businessId}/associations?entityType=proposal&entityId=${encodeURIComponent(draft.proposal.id)}`);
  assert.ok(draftRelations.associations.some((item) => item.related?.id === contactId && item.kind === "primary"), "Proposal must be associated with its contact");

  const expired = await adminJson(baseUrl, `/api/businesses/${businessId}/proposals/${draft.proposal.id}`, {
    method: "PATCH",
    body: { status: "enviada" }
  });
  assert.equal(expired.proposal.status, "caducada", "Past sent proposals must expire immediately");
  assert.ok(expired.activities.some((item) => item.type === "proposal.status_changed"));

  const accepted = await adminJson(baseUrl, `/api/businesses/${businessId}/proposals`, {
    method: "POST",
    expectedStatus: 201,
    body: proposalBody(contactId, past, { status: "aceptada", package: "conversion_pro", setupPrice: 890, monthlyPrice: 119 })
  });
  assert.equal(accepted.proposal.status, "aceptada", "Accepted proposals must never auto-expire");
  assert.ok(accepted.activities.some((item) => item.type === "contact.status_changed"));
  assert.equal(accepted.project.proposalId, accepted.proposal.id, "Acceptance must create a linked project");
  const acceptedRelations = await adminJson(baseUrl, `/api/businesses/${businessId}/associations?entityType=proposal&entityId=${encodeURIComponent(accepted.proposal.id)}`);
  assert.ok(acceptedRelations.associations.some((item) => item.related?.id === accepted.project.id), "Accepted proposal must be associated with its project");

  const acceptedAgain = await adminJson(baseUrl, `/api/businesses/${businessId}/proposals/${accepted.proposal.id}`, {
    method: "PATCH",
    body: { status: "aceptada" }
  });
  assert.equal(acceptedAgain.project.id, accepted.project.id, "Repeated acceptance must reuse the same project");

  const contacts = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts`);
  assert.equal(contacts.contacts.find((item) => item.id === contactId)?.status, "customer", "Acceptance must convert the contact");
  const timeline = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts/${contactId}/timeline`);
  assert.ok(timeline.timeline.some((item) => item.type === "proposal.created"), "Proposal activity must reach the timeline");
  assert.ok(timeline.timeline.some((item) => item.type === "contact.status_changed"), "Customer conversion must reach the timeline");

  const listed = await adminJson(baseUrl, `/api/businesses/${businessSlug}/proposals?contactId=${encodeURIComponent(contactId)}`);
  assert.equal(listed.total, 2);
  const filtered = await adminJson(baseUrl, `/api/businesses/${businessId}/proposals?status=caducada`);
  assert.equal(filtered.total, 1);
  const fetched = await adminJson(baseUrl, `/api/businesses/${businessId}/proposals/${accepted.proposal.id}`);
  assert.equal(fetched.proposal.contactId, contactId);

  const html = await documentRequest(baseUrl, `/api/businesses/${businessId}/proposals/${draft.proposal.id}/export?format=html`);
  assert.match(html.contentType, /^text\/html/);
  assert.match(html.text, /&lt;script&gt;/);
  assert.doesNotMatch(html.text, /<script>alert/);
  const pdf = await documentRequest(baseUrl, `/api/businesses/${businessId}/proposals/${accepted.proposal.id}/export?format=pdf`);
  assert.equal(pdf.contentType, "application/pdf");
  assert.equal(pdf.buffer.subarray(0, 8).toString("ascii"), "%PDF-1.4");
  assert.match(pdf.buffer.subarray(-20).toString("ascii"), /%%EOF/);
  assert.ok(pdf.buffer.length > 2000, "PDF export must contain a real document body");
  await adminJson(baseUrl, `/api/businesses/${businessId}/proposals/${accepted.proposal.id}/export?format=docx`, { expectedStatus: 400 });

  const survivor = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST", expectedStatus: 201, body: { name: "Superviviente", email: "survivor@example.com" }
  });
  const duplicate = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST", expectedStatus: 201, body: { name: "Duplicado", email: "duplicate@example.com" }
  });
  const mergeProposal = await adminJson(baseUrl, `/api/businesses/${businessId}/proposals`, {
    method: "POST", expectedStatus: 201, body: proposalBody(duplicate.contact.id, future)
  });
  await adminJson(baseUrl, `/api/businesses/${businessId}/contacts/merge`, {
    method: "POST",
    body: { survivorId: survivor.contact.id, duplicateIds: [duplicate.contact.id] }
  });
  const moved = await adminJson(baseUrl, `/api/businesses/${businessId}/proposals/${mergeProposal.proposal.id}`);
  assert.equal(moved.proposal.contactId, survivor.contact.id, "Contact merge must move proposal references");

  const otherBusiness = await adminJson(baseUrl, "/api/businesses", {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Otro Negocio", slug: "otro-negocio", status: "lead" }
  });
  const otherContact = await adminJson(baseUrl, `/api/businesses/${otherBusiness.business.id}/contacts`, {
    method: "POST", expectedStatus: 201, body: { name: "Otro Contacto", email: "other@example.com" }
  });
  await adminJson(baseUrl, `/api/businesses/${businessId}/proposals`, {
    method: "POST", expectedStatus: 404, body: proposalBody(otherContact.contact.id, future)
  });
  await adminJson(baseUrl, `/api/businesses/${otherBusiness.business.id}/proposals/${accepted.proposal.id}`, { expectedStatus: 404 });

  await adminJson(baseUrl, `/api/businesses/${businessId}/portal-access`, {
    method: "POST", body: { password: "PortalProposal2026!" }
  });
  const login = await jsonRequest(baseUrl, "/api/client/login", {
    method: "POST", body: { business: businessId, password: "PortalProposal2026!" }
  });
  const clientHeaders = { "X-LocalLift-Client-Token": login.session.token };
  const clientList = await jsonRequest(baseUrl, `/api/businesses/${businessId}/proposals`, { headers: clientHeaders });
  assert.ok(clientList.total >= 3, "Business client must access its proposals");
  await jsonRequest(baseUrl, `/api/businesses/${otherBusiness.business.id}/proposals`, {
    headers: clientHeaders, expectedStatus: 403
  });

  const deleted = await adminJson(baseUrl, `/api/businesses/${businessId}/proposals/${mergeProposal.proposal.id}`, { method: "DELETE" });
  assert.equal(deleted.deleted, true);
  await adminJson(baseUrl, `/api/businesses/${businessId}/proposals/${mergeProposal.proposal.id}`, { expectedStatus: 404 });

  const finalHealth = await jsonRequest(baseUrl, "/api/health");
  assert.equal(finalHealth.counts.proposals, 2, "Health must expose persisted proposal count");
  assert.equal(finalHealth.counts.projects, 1, "Health must expose the automatically created project");
  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.equal(persisted.proposals.find((item) => item.id === draft.proposal.id)?.status, "caducada");
  assert.ok(persisted.auditLog.some((item) => item.type === "proposal.created" && item.proposalId));

  console.log("Proposal API checks passed: strict CRUD, tenancy, expiry, conversion, merge, HTML/PDF and persistence.");
}

function proposalBody(contactId, expiresAt, overrides = {}) {
  return {
    contactId,
    package: "presencia_local",
    setupPrice: 490,
    monthlyPrice: 59,
    conditions: "Entrega profesional y mantenimiento mensual.",
    expiresAt,
    ...overrides
  };
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

async function documentRequest(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!response.ok) {
    throw new Error(`GET ${pathname} returned ${response.status}: ${buffer.toString("utf8")}`);
  }
  return {
    buffer,
    text: buffer.toString("utf8"),
    contentType: response.headers.get("content-type") || ""
  };
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before healthcheck passed.\n${logs}`);
    }
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
  if (tempDir && tempDir.startsWith(root) && path.basename(tempDir).startsWith(".tmp-proposal-test-")) {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main()
  .catch((error) => {
    console.error(`Proposal API test failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(cleanup);
