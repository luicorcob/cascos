import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const adminToken = "hospitality-test-admin-token-32-characters";
const businessId = "biz_demo_brasa_norte";
let child;
let tempDir;
let logs = "";

async function main() {
  tempDir = await mkdtemp(path.join(root, ".tmp-hospitality-test-"));
  const dbPath = path.join(tempDir, "business-db.json");
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: adminToken,
      CLIENT_SESSION_SECRET: "hospitality-test-client-session-secret-32-characters",
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

  const prefix = `/api/businesses/${businessId}/hospitality`;
  await request(baseUrl, `${prefix}/summary`, { expectedStatus: 401 });
  const empty = await admin(baseUrl, `${prefix}/summary`);
  assert.equal(empty.finance.income, 0);
  assert.equal(empty.team.activeEmployees, 0);
  assert.equal(empty.inventory.lowStock, 0);

  const supplier = await admin(baseUrl, `${prefix}/suppliers`, {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Mercado Norte", taxId: "B12345678", category: "Alimentación", email: "pedidos@mercado.example", active: true }
  });
  assert.equal(supplier.supplier.name, "Mercado Norte");

  const employee = await admin(baseUrl, `${prefix}/employees`, {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Laura Martín", role: "manager", accessLevel: "manager", hourlyRate: 14.5, active: true, color: "#5262d9" }
  });
  assert.equal(employee.employee.role, "manager");

  const today = new Date().toISOString().slice(0, 10);
  const shift = await admin(baseUrl, `${prefix}/shifts`, {
    method: "POST",
    expectedStatus: 201,
    body: { employeeId: employee.employee.id, date: today, startTime: "12:00", endTime: "18:30", area: "floor", status: "confirmed" }
  });
  assert.equal(shift.shift.durationHours, 6.5);

  const inventory = await admin(baseUrl, `${prefix}/inventory`, {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Arroz bomba", category: "Despensa", unit: "kg", currentStock: 3, minStock: 5, costPerUnit: 4.25, supplierId: supplier.supplier.id, active: true }
  });
  assert.equal(inventory.item.lowStock, true);
  assert.equal(inventory.item.stockValue, 12.75);

  const expense = await admin(baseUrl, `${prefix}/expenses`, {
    method: "POST",
    expectedStatus: 201,
    body: { concept: "Compra semanal", supplierId: supplier.supplier.id, category: "food", date: today, subtotal: 100, taxRate: 10, paymentMethod: "card", status: "paid", deductible: true }
  });
  assert.equal(expense.expense.total, 110);

  const invoice = await admin(baseUrl, `${prefix}/invoices`, {
    method: "POST",
    expectedStatus: 201,
    body: { customerName: "Empresa Demo", customerTaxId: "A87654321", concept: "Cena de grupo", issueDate: today, dueDate: today, subtotal: 200, taxRate: 10, status: "sent", paymentMethod: "transfer" }
  });
  assert.equal(invoice.invoice.total, 220);
  assert.match(invoice.invoice.number, /^FAC-\d{4}-0001$/);

  await admin(baseUrl, `${prefix}/shifts`, {
    method: "POST",
    expectedStatus: 201,
    body: { employeeId: "", date: today, startTime: "20:00", endTime: "23:00", area: "kitchen", status: "scheduled" }
  });

  const summary = await admin(baseUrl, `${prefix}/summary`);
  assert.equal(summary.finance.income, 220);
  assert.equal(summary.finance.expenses, 110);
  assert.equal(summary.finance.profit, 110);
  assert.equal(summary.finance.outstanding, 220);
  assert.equal(summary.team.activeEmployees, 1);
  assert.equal(summary.inventory.lowStock, 1);
  assert.equal(summary.inventory.value, 12.75);

  const filtered = await admin(baseUrl, `${prefix}/inventory?search=arroz&active=true`);
  assert.equal(filtered.total, 1);
  assert.equal(filtered.items[0].supplierName, "Mercado Norte");

  const paid = await admin(baseUrl, `${prefix}/invoices/${invoice.invoice.id}`, { method: "PATCH", body: { status: "paid" } });
  assert.equal(paid.invoice.status, "paid");
  const afterPayment = await admin(baseUrl, `${prefix}/summary`);
  assert.equal(afterPayment.finance.outstanding, 0);

  const adjusted = await admin(baseUrl, `${prefix}/inventory/${inventory.item.id}`, { method: "PATCH", body: { currentStock: 8 } });
  assert.equal(adjusted.item.lowStock, false);

  await admin(baseUrl, `${prefix}/employees`, { method: "POST", expectedStatus: 400, body: { name: "Rol inválido", role: "superadmin" } });
  await admin(baseUrl, `${prefix}/shifts`, { method: "POST", expectedStatus: 400, body: { employeeId: employee.employee.id, date: today, startTime: "18:00", endTime: "12:00", area: "floor" } });

  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.equal(persisted.hospitalityInvoices.length, 1);
  assert.equal(persisted.hospitalityExpenses.length, 1);
  assert.equal(persisted.hospitalitySuppliers.length, 1);
  assert.equal(persisted.hospitalityEmployees.length, 1);
  assert.equal(persisted.hospitalityShifts.length, 2);
  assert.equal(persisted.hospitalityInventory.length, 1);
  assert.ok(persisted.auditLog.some((entry) => entry.type === "hospitality.invoice_created"));

  console.log("Hospitality API checks passed: accounting, suppliers, roles, shifts, inventory, validation and persistence.");
}

async function admin(baseUrl, pathname, options = {}) {
  return request(baseUrl, pathname, { ...options, headers: { ...options.headers, Authorization: `Bearer ${adminToken}` } });
}

async function request(baseUrl, pathname, options = {}) {
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
    try { return await request(baseUrl, "/api/health"); } catch { await delay(150); }
  }
  throw new Error(`Healthcheck did not pass.\n${logs}`);
}

function freePort() {
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

function appendLog(chunk) { logs += chunk.toString(); }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    if (logs) console.error(logs);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (child && child.exitCode === null) child.kill();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });
