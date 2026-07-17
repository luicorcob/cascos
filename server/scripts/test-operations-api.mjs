import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const adminToken = "operations-test-admin-token-32-characters";
const businessId = "biz_demo_brasa_norte";
let child;
let tempDir;
let dbPath;
let logs = "";

async function main() {
  tempDir = await mkdtemp(path.join(root, ".tmp-operations-test-"));
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
      CLIENT_SESSION_SECRET: "operations-test-client-session-secret-32-characters",
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

  await jsonRequest(baseUrl, "/api/enterprise/projects", { expectedStatus: 401 });
  const emptyProjects = await adminJson(baseUrl, "/api/enterprise/projects");
  assert.equal(emptyProjects.total, 0);
  const projectContact = await adminJson(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST", expectedStatus: 201, body: { name: "Cliente del proyecto", email: "project-client@example.com" }
  });

  await adminJson(baseUrl, "/api/enterprise/projects", {
    method: "POST",
    expectedStatus: 400,
    body: { businessId, name: "Web nueva", priority: "imposible" }
  });
  const created = await adminJson(baseUrl, "/api/enterprise/projects", {
    method: "POST",
    expectedStatus: 201,
    body: {
      businessId,
      contactId: projectContact.contact.id,
      name: "Web corporativa 2026",
      description: "Rediseño y publicación",
      responsible: "Lucía",
      priority: "high",
      status: "in-design",
      startDate: "2026-07-01",
      dueDate: "2026-07-30"
    }
  });
  const projectId = created.project.id;
  assert.equal(created.project.businessId, businessId);
  assert.deepEqual(created.project.tasks, []);
  const projectRelations = await adminJson(baseUrl, `/api/businesses/${businessId}/associations?entityType=project&entityId=${encodeURIComponent(projectId)}`);
  assert.ok(projectRelations.associations.some((item) => item.related?.id === projectContact.contact.id && item.kind === "customer"));

  const task = await adminJson(baseUrl, `/api/enterprise/projects/${projectId}/tasks`, {
    method: "POST",
    expectedStatus: 201,
    body: { title: "Preparar diseño", assignee: "Lucía", dueDate: "2026-07-20" }
  });
  assert.equal(task.task.status, "pending");
  const completedTask = await adminJson(baseUrl, `/api/enterprise/projects/${projectId}/tasks/${task.task.id}`, {
    method: "PATCH",
    body: { status: "done" }
  });
  assert.equal(completedTask.task.status, "done");

  await adminJson(baseUrl, `/api/enterprise/projects/${projectId}/files`, {
    method: "POST",
    expectedStatus: 400,
    body: { name: "Brief", url: "file:///brief.pdf" }
  });
  const file = await adminJson(baseUrl, `/api/enterprise/projects/${projectId}/files`, {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Brief aprobado", url: "https://files.example.com/brief.pdf", category: "brief" }
  });
  assert.equal(file.file.category, "brief");

  const filtered = await adminJson(baseUrl, "/api/enterprise/projects?status=in-design&priority=high&search=corporativa");
  assert.equal(filtered.total, 1);
  assert.equal(filtered.projects[0].progress, 100);
  assert.equal(filtered.projects[0].files.length, 1);

  await adminJson(baseUrl, "/api/enterprise/subscriptions", {
    method: "POST",
    expectedStatus: 400,
    body: { businessId, name: "Hosting", price: -1, nextRenewal: "2026-08-01" }
  });
  const subscription = await adminJson(baseUrl, "/api/enterprise/subscriptions", {
    method: "POST",
    expectedStatus: 201,
    body: {
      businessId,
      name: "Hosting y mantenimiento",
      description: "Infraestructura, copias y soporte",
      price: 90,
      currency: "EUR",
      frequency: "quarterly",
      nextRenewal: "2026-08-01",
      status: "active",
      noticeDays: 30
    }
  });
  assert.equal(subscription.subscription.intervalMonths, 3);
  const invoice = await adminJson(baseUrl, "/api/enterprise/invoices", {
    method: "POST",
    expectedStatus: 201,
    body: {
      businessId,
      projectId,
      concept: "Desarrollo y publicación web",
      issueDate: dateOffset(0),
      dueDate: dateOffset(15),
      subtotal: 100,
      taxRate: 21,
      currency: "EUR",
      status: "sent"
    }
  });
  assert.equal(invoice.invoice.total, 121);
  assert.match(invoice.invoice.number, /^DLS-\d{4}-0001$/);
  const invoiceRelations = await adminJson(baseUrl, `/api/businesses/${businessId}/associations?entityType=invoice&entityId=${encodeURIComponent(invoice.invoice.id)}`);
  assert.ok(invoiceRelations.associations.some((item) => item.related?.id === projectId), "Invoice must be associated with its project");
  const partialPayment = await adminJson(baseUrl, `/api/enterprise/invoices/${invoice.invoice.id}/payments`, {
    method: "POST",
    expectedStatus: 201,
    body: { amount: 40, method: "transfer", reference: "TEST-40" }
  });
  assert.equal(partialPayment.invoice.balance, 81);
  assert.equal(partialPayment.invoice.status, "sent");
  const clientDocument = await adminJson(baseUrl, "/api/enterprise/documents", {
    method: "POST",
    expectedStatus: 201,
    body: { businessId, projectId, name: "Diseño para aprobar", category: "deliverable", url: "https://files.example.com/design.pdf", visibility: "client" }
  });
  const internalDocument = await adminJson(baseUrl, "/api/enterprise/documents", {
    method: "POST",
    expectedStatus: 201,
    body: { businessId, invoiceId: invoice.invoice.id, name: "Nota interna", category: "invoice", url: "https://files.example.com/internal.pdf", visibility: "internal" }
  });
  const summary = await adminJson(baseUrl, "/api/enterprise/summary");
  assert.equal(summary.projects, 1);
  assert.equal(summary.activeSubscriptions, 1);
  assert.equal(summary.monthlyRecurringRevenue, 30);
  assert.equal(summary.outstandingPayments, 81);

  await adminJson(baseUrl, `/api/businesses/${businessId}/portal-access`, {
    method: "POST",
    body: { password: "PortalOperations2026!" }
  });
  const login = await jsonRequest(baseUrl, "/api/client/login", {
    method: "POST",
    body: { business: businessId, password: "PortalOperations2026!" }
  });
  const clientHeaders = { "X-LocalLift-Client-Token": login.session.token };
  const clientProjects = await jsonRequest(baseUrl, `/api/businesses/${businessId}/projects`, { headers: clientHeaders });
  assert.equal(clientProjects.total, 1);
  const clientSubscriptions = await jsonRequest(baseUrl, `/api/businesses/${businessId}/subscriptions`, { headers: clientHeaders });
  assert.equal(clientSubscriptions.total, 1);
  const clientInvoices = await jsonRequest(baseUrl, `/api/businesses/${businessId}/invoices`, { headers: clientHeaders });
  assert.equal(clientInvoices.total, 1);
  assert.equal(clientInvoices.invoices[0].balance, 81);
  const clientDocuments = await jsonRequest(baseUrl, `/api/businesses/${businessId}/documents`, { headers: clientHeaders });
  assert.equal(clientDocuments.total, 1, "Client must not see internal documents");
  assert.equal(clientDocuments.documents[0].id, clientDocument.document.id);
  const comment = await jsonRequest(baseUrl, `/api/businesses/${businessId}/projects/${projectId}/comments`, {
    method: "POST", headers: clientHeaders, body: { message: "Cambiad el color principal, por favor." }, expectedStatus: 201
  });
  assert.equal(comment.comment.actorRole, "client");
  const approval = await jsonRequest(baseUrl, `/api/businesses/${businessId}/projects/${projectId}/approvals`, {
    method: "POST", headers: clientHeaders, body: { decision: "changes-requested", note: "Revisar el color." }, expectedStatus: 201
  });
  assert.equal(approval.approval.decision, "changes-requested");
  const uploaded = await jsonRequest(baseUrl, `/api/businesses/${businessId}/documents`, {
    method: "POST",
    headers: clientHeaders,
    body: { projectId, name: "Logotipo cliente", category: "contract", url: "https://client.example.com/logo.svg", visibility: "internal" },
    expectedStatus: 201
  });
  assert.equal(uploaded.document.category, "client-file", "Client uploads must use the safe category");
  assert.equal(uploaded.document.visibility, "client", "Client uploads cannot become internal");
  await jsonRequest(baseUrl, `/api/businesses/${businessId}/projects`, {
    method: "POST",
    headers: clientHeaders,
    body: { name: "No autorizado" },
    expectedStatus: 403
  });

  const otherBusiness = await adminJson(baseUrl, "/api/businesses", {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Otro cliente", slug: "otro-cliente" }
  });
  await jsonRequest(baseUrl, `/api/businesses/${otherBusiness.business.id}/projects`, {
    headers: clientHeaders,
    expectedStatus: 403
  });

  const patched = await adminJson(baseUrl, `/api/enterprise/projects/${projectId}`, {
    method: "PATCH",
    body: { status: "review", dueDate: "2026-08-05" }
  });
  assert.equal(patched.project.status, "review");
  const scoped = await adminJson(baseUrl, `/api/businesses/${businessId}/projects/${projectId}`);
  assert.equal(scoped.project.files.length, 1);
  assert.equal(scoped.project.comments.length, 1);
  assert.equal(scoped.project.approvals.length, 1);

  const paid = await adminJson(baseUrl, `/api/enterprise/invoices/${invoice.invoice.id}/payments`, {
    method: "POST", expectedStatus: 201, body: { amount: 81, method: "card" }
  });
  assert.equal(paid.invoice.status, "paid");
  assert.equal(paid.invoice.balance, 0);
  await adminJson(baseUrl, `/api/enterprise/invoices/${invoice.invoice.id}/payments`, {
    method: "POST", expectedStatus: 400, body: { amount: 1, method: "cash" }
  });

  await adminJson(baseUrl, `/api/enterprise/projects/${projectId}/files/${file.file.id}`, { method: "DELETE" });
  await adminJson(baseUrl, `/api/enterprise/subscriptions/${subscription.subscription.id}`, { method: "DELETE" });
  await adminJson(baseUrl, `/api/enterprise/invoices/${invoice.invoice.id}`, { method: "DELETE" });
  await adminJson(baseUrl, `/api/enterprise/documents/${clientDocument.document.id}`, { method: "DELETE" });
  await adminJson(baseUrl, `/api/enterprise/documents/${uploaded.document.id}`, { method: "DELETE" });
  await adminJson(baseUrl, `/api/enterprise/projects/${projectId}`, { method: "DELETE" });

  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.equal(persisted.projects.length, 0);
  assert.equal(persisted.projectTasks.length, 0, "Deleting a project must cascade to tasks");
  assert.equal(persisted.projectFiles.length, 0, "Deleting a project must cascade to files");
  assert.equal(persisted.subscriptions.length, 0);
  assert.equal(persisted.invoices.length, 0);
  assert.equal(persisted.payments.length, 0);
  assert.equal(persisted.documents.length, 0);
  assert.equal(persisted.projectComments.length, 0);
  assert.equal(persisted.projectApprovals.length, 0);
  assert.ok(persisted.auditLog.some((entry) => entry.type === "project.created"));

  console.log("Operations API checks passed: projects, tasks, files, subscriptions, filters, summary, tenancy and persistence.");
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

function dateOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function cleanup() {
  if (child && child.exitCode === null) {
    child.kill();
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]);
  }
  if (tempDir && tempDir.startsWith(root) && path.basename(tempDir).startsWith(".tmp-operations-test-")) {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Operations API test failed: ${error.message}`);
  process.exitCode = 1;
}).finally(cleanup);
