import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-growth-operations-api-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const otherBusinessId = "biz_demo_luz_habitat";
const serviceId = "svc_menu_degustacion";
const adminToken = "growth-operations-admin";
let child;
let logs = "";

try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: adminToken,
      ADMIN_API_TOKEN: adminToken,
      BUSINESS_USER_SESSION_SECRET: "growth-operations-user-session-secret-32",
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
  await waitForHealth();

  await jsonRequest(`/api/businesses/${businessId}/loyalty`, { expectedStatus: 401 });
  await jsonRequest(`/api/businesses/${businessId}/vertical`, { expectedStatus: 401 });
  const referrer = await createContact("Ana Referente", "ana-referente@example.com");
  const referred = await createContact("Beto Referido", "beto-referido@example.com");
  const other = await createContact("Carla Otra", "carla-otra@example.com");

  const program = await adminJson(`/api/businesses/${businessId}/loyalty/program`, {
    method: "PUT",
    body: {
      name: "Club Brasa",
      mode: "points",
      unitLabel: "puntos",
      earnPerCurrency: 2,
      expirationDays: 180,
      levels: [{ name: "Base", threshold: 0 }, { name: "VIP", threshold: 100 }],
      referral: { enabled: true, referrerReward: 40, referredReward: 20, maxConversionsPerReferrer: 2, attributionDays: 30 }
    }
  });
  assert.equal(program.program.mode, "points");
  const movement = await adminJson(`/api/businesses/${businessId}/loyalty/movements`, {
    method: "POST",
    expectedStatus: 201,
    body: { contactId: referrer.contact.id, type: "earn", amount: 120, reason: "Compra inicial", idempotencyKey: "growth-purchase-1" }
  });
  assert.equal(movement.account.level, "VIP");
  assert.equal((await adminJson(`/api/businesses/${businessId}/loyalty/movements`, {
    method: "POST",
    body: { contactId: referrer.contact.id, type: "earn", amount: 120, reason: "Compra inicial", idempotencyKey: "growth-purchase-1" }
  })).duplicate, true);
  const reward = await adminJson(`/api/businesses/${businessId}/loyalty/rewards`, {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Postre de la casa", description: "Una unidad", cost: 50, stock: 2 }
  });
  const redemption = await adminJson(`/api/businesses/${businessId}/loyalty/rewards/${reward.reward.id}/redeem`, {
    method: "POST",
    expectedStatus: 201,
    body: { contactId: referrer.contact.id, idempotencyKey: "growth-reward-1" }
  });
  assert.ok(redemption.redemption.code);
  const referralCode = await adminJson(`/api/businesses/${businessId}/loyalty/referrals/codes`, {
    method: "POST",
    expectedStatus: 201,
    body: { contactId: referrer.contact.id }
  });
  await adminJson(`/api/businesses/${businessId}/loyalty/referrals/attribute`, {
    method: "POST",
    expectedStatus: 409,
    body: { code: referralCode.code.code, referredContactId: referrer.contact.id }
  });
  const attribution = await adminJson(`/api/businesses/${businessId}/loyalty/referrals/attribute`, {
    method: "POST",
    expectedStatus: 201,
    body: { code: referralCode.code.code, referredContactId: referred.contact.id, fingerprint: "device-growth-a", source: "landing" }
  });
  await adminJson(`/api/businesses/${businessId}/loyalty/referrals/attribute`, {
    method: "POST",
    expectedStatus: 409,
    body: { code: referralCode.code.code, referredContactId: other.contact.id, fingerprint: "device-growth-a" }
  });
  const converted = await adminJson(`/api/businesses/${businessId}/loyalty/referrals/${attribution.attribution.id}/convert`, { method: "POST", body: {} });
  assert.equal(converted.attribution.rewardMovementIds.length, 2);

  const table1 = await createResource("Mesa Growth 1", 4);
  const table2 = await createResource("Mesa Growth 2", 4);
  await schedule(table1.resource.id);
  await schedule(table2.resource.id);
  const zone = await adminJson(`/api/businesses/${businessId}/vertical/zones`, {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Terraza Growth", resourceIds: [table1.resource.id, table2.resource.id], capacity: 8 }
  });
  const combination = await adminJson(`/api/businesses/${businessId}/vertical/combinations`, {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Mesa imperial Growth", zoneId: zone.item.id, tableResourceIds: [table1.resource.id, table2.resource.id], minGuests: 4, maxGuests: 8, setupMinutes: 10 }
  });
  const serviceShift = await adminJson(`/api/businesses/${businessId}/vertical/shifts`, {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Comida Growth", weekdays: [1, 2, 3, 4, 5, 6, 0], startTime: "12:30", endTime: "16:30", expectedDurationMinutes: 90, turnoverBufferMinutes: 15, maxCovers: 50 }
  });
  const policy = await adminJson(`/api/businesses/${businessId}/vertical/policies`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Politica Growth",
      version: "2026-07",
      visibleText: "Cancelacion gratuita hasta 48 horas antes. Las devoluciones posteriores se revisan.",
      cancellationHours: 48,
      refundPercentBeforeDeadline: 100,
      refundPercentAfterDeadline: 20,
      noShowDepositTreatment: "review",
      disputeInstructions: "Contacta con el local."
    }
  });
  const inventory = await adminJson(`/api/businesses/${businessId}/hospitality/inventory`, {
    method: "POST",
    expectedStatus: 201,
    body: { name: "Vino Growth", category: "Bebidas", unit: "bottles", currentStock: 2, minStock: 1, costPerUnit: 7, active: true }
  });
  const experience = await adminJson(`/api/businesses/${businessId}/vertical/experiences`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Menu terraza Growth",
      type: "menu",
      serviceId,
      zoneIds: [zone.item.id],
      serviceShiftIds: [serviceShift.item.id],
      minGuests: 2,
      maxGuests: 20,
      durationMinutes: 90,
      capacity: 20,
      inventoryRules: [{ inventoryItemId: inventory.item.id, quantityPerGuest: 0.5 }],
      depositRules: [
        { id: "vip-summer", validFrom: "2026-07-01", validTo: "2026-08-31", segments: ["vip"], mode: "percent", value: 20, priority: 10 },
        { id: "standard", mode: "fixed", value: 10, priority: 1 }
      ],
      policyId: policy.item.id
    }
  });
  const preview = await adminJson(`/api/businesses/${businessId}/vertical/experiences/${experience.item.id}/deposit-preview`, {
    method: "POST",
    body: { bookingDate: "2026-07-20", segments: ["vip"] }
  });
  assert.equal(preview.rule.id, "vip-summer");

  const booking = await adminJson(`/api/businesses/${businessId}/bookings`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      serviceId,
      contactId: referred.contact.id,
      customerName: "Beto Referido",
      email: "beto-referido@example.com",
      startsAt: "2026-07-20T13:00:00.000Z",
      resourceIds: [table1.resource.id],
      partySize: 4,
      status: "confirmed",
      source: "dashboard"
    }
  });
  const assigned = await adminJson(`/api/businesses/${businessId}/vertical/bookings/${booking.booking.id}/combination`, {
    method: "POST",
    body: { combinationId: combination.item.id }
  });
  assert.deepEqual(assigned.booking.resourceIds, [table1.resource.id, table2.resource.id]);
  const acceptance = await adminJson(`/api/businesses/${businessId}/vertical/bookings/${booking.booking.id}/policy-acceptance`, {
    method: "POST",
    expectedStatus: 201,
    body: { policyId: policy.item.id, accepted: true, channel: "public", ip: "127.0.0.1", userAgent: "api-test" }
  });
  assert.equal(acceptance.event.policyTextSnapshot, policy.item.visibleText);
  const dispute = await adminJson(`/api/businesses/${businessId}/vertical/bookings/${booking.booking.id}/policy-events`, {
    method: "POST",
    expectedStatus: 201,
    body: { type: "dispute_opened", amount: 10, currency: "EUR", reason: "Revision solicitada" }
  });
  assert.equal(dispute.event.type, "dispute_opened");
  await adminJson(`/api/businesses/${businessId}/vertical/bookings/${booking.booking.id}/policy-events`, {
    method: "POST",
    expectedStatus: 201,
    body: { type: "refunded", amount: 10, currency: "EUR", reason: "Devolucion aprobada" }
  });
  const reminder = await adminJson(`/api/businesses/${businessId}/vertical/bookings/${booking.booking.id}/reminder-confirmations`, {
    method: "POST",
    expectedStatus: 201,
    body: { expiresInHours: 48 }
  });
  assert.ok(reminder.publicUrl);
  const publicReminder = await jsonRequest(reminder.publicUrl);
  assert.equal(publicReminder.policy.visibleText, policy.item.visibleText);
  const confirmed = await jsonRequest(reminder.publicUrl, { method: "POST", body: { decision: "confirm" } });
  assert.equal(confirmed.confirmation.status, "confirmed");
  assert.equal((await jsonRequest(reminder.publicUrl, { method: "POST", body: { decision: "confirm" } })).duplicate, true);

  const planning = await adminJson(`/api/businesses/${businessId}/vertical/planning?startDate=2026-07-20&days=3`);
  assert.equal(planning.planning.daily.length, 3);
  assert.ok(planning.planning.alerts.some((item) => item.type === "stock" && item.sourceUrl.includes("inventory")));
  assert.ok(planning.planning.alerts.every((item) => item.reason && item.evidence));

  await createUser("Marta Manager", "manager-growth@example.com", "manager", "ManagerGrowth2026!");
  await createUser("Oscar Ops", "ops-growth@example.com", "operations", "OperationsGrowth2026!");
  await createUser("Fina Finance", "finance-growth@example.com", "finance", "FinanceGrowth2026!");
  await createUser("Sara Sales", "sales-growth@example.com", "sales", "SalesGrowth2026!");
  const manager = await login("manager-growth@example.com", "ManagerGrowth2026!");
  const operations = await login("ops-growth@example.com", "OperationsGrowth2026!");
  const finance = await login("finance-growth@example.com", "FinanceGrowth2026!");
  const sales = await login("sales-growth@example.com", "SalesGrowth2026!");
  assert.ok((await userJson(`/api/businesses/${businessId}/loyalty`, manager)).center.summary.members >= 2);
  await userJson(`/api/businesses/${businessId}/loyalty/rewards`, operations, { method: "POST", expectedStatus: 403, body: { name: "No permitido", cost: 5 } });
  await userJson(`/api/businesses/${businessId}/loyalty`, sales);
  await userJson(`/api/businesses/${businessId}/loyalty/movements`, sales, { method: "POST", expectedStatus: 403, body: { contactId: referrer.contact.id, type: "earn", amount: 5, reason: "No permitido" } });
  await userJson(`/api/businesses/${businessId}/vertical`, operations);
  await userJson(`/api/businesses/${businessId}/vertical/zones`, finance, { method: "POST", expectedStatus: 403, body: { name: "No permitido", resourceIds: [] } });
  await userJson(`/api/businesses/${otherBusinessId}/vertical`, operations, { expectedStatus: 403 });

  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.ok(persisted.loyaltyMovements.length >= 4);
  assert.ok(persisted.referralAttributions.some((item) => item.status === "converted"));
  assert.ok(persisted.hospitalityTableCombinations.length === 1);
  assert.ok(persisted.bookingPolicyEvents.some((item) => item.type === "refunded"));
  assert.ok(persisted.bookingReminderConfirmations.some((item) => item.status === "confirmed"));
  assert.ok(persisted.securityAuditEvents.some((item) => item.action === "vertical.dispute_opened"));
  console.log("Growth and vertical operations API checks passed: loyalty/rewards/referrals with RBAC, zones/table combinations/shifts/experiences, date-segment deposits, policy consent/refunds/disputes, public confirmations, planning alerts and tenant isolation.");
} finally {
  if (child && child.exitCode === null) {
    child.kill();
    await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]);
  }
  await rm(tempDir, { recursive: true, force: true });
}

function createContact(name, email) { return adminJson(`/api/businesses/${businessId}/contacts`, { method: "POST", expectedStatus: 201, body: { name, email, status: "customer" } }); }
function createResource(name, capacity) { return adminJson(`/api/businesses/${businessId}/resources`, { method: "POST", expectedStatus: 201, body: { name, type: "table", capacity, serviceIds: [serviceId], active: true } }); }
function schedule(resourceId) { return adminJson(`/api/businesses/${businessId}/resources/${resourceId}/schedule`, { method: "PUT", body: { schedule: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "12:00", endTime: "23:00", active: true })) } }); }
function createUser(name, email, role, password) { return adminJson(`/api/businesses/${businessId}/security/users`, { method: "POST", expectedStatus: 201, body: { name, email, role, password } }); }
function login(email, password) { return jsonRequest("/api/business-users/login", { method: "POST", body: { business: businessId, email, password } }); }
function userJson(pathname, loginPayload, options = {}) { return jsonRequest(pathname, { ...options, headers: { ...options.headers, "X-LocalLift-User-Token": loginPayload.session.token } }); }
function adminJson(pathname, options = {}) { return jsonRequest(pathname, { ...options, headers: { ...options.headers, Authorization: `Bearer ${adminToken}` } }); }
async function jsonRequest(pathname, options = {}) {
  const headers = { ...options.headers };
  const init = { method: options.method || "GET", headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  const expectedStatus = options.expectedStatus || 200;
  if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}\n${logs}`);
  return text ? JSON.parse(text) : {};
}
async function waitForHealth() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`);
    try { return await jsonRequest("/api/health"); } catch { await delay(150); }
  }
  throw new Error(`Healthcheck did not pass.\n${logs}`);
}
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
