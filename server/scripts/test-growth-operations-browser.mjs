import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, copyFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-growth-operations-browser-"));
const profileRoot = await mkdtemp(path.join(os.tmpdir(), "dls-growth-operations-browser-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const serviceId = "svc_menu_degustacion";
const chrome = await findChrome();
const bookingDate = addDays(new Date().toISOString().slice(0, 10), 2);
let server;
let logs = "";

try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  server = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: "",
      ADMIN_API_TOKEN: "",
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
  server.stdout.on("data", appendLog);
  server.stderr.on("data", appendLog);
  await waitForHealth();

  const referrer = await jsonRequest(`/api/businesses/${businessId}/contacts`, { method: "POST", expectedStatus: 201, body: { name: "Ana Club", email: "ana-club@example.com", status: "customer" } });
  const referred = await jsonRequest(`/api/businesses/${businessId}/contacts`, { method: "POST", expectedStatus: 201, body: { name: "Beto Referido", email: "beto-referido-browser@example.com", status: "customer" } });
  await jsonRequest(`/api/businesses/${businessId}/loyalty/program`, {
    method: "PUT",
    body: {
      name: "Club Brasa Visible",
      mode: "points",
      unitLabel: "brasas",
      earnPerCurrency: 1,
      expirationDays: 180,
      referral: { referrerReward: 40, referredReward: 20, maxConversionsPerReferrer: 10 }
    }
  });
  await jsonRequest(`/api/businesses/${businessId}/loyalty/movements`, { method: "POST", expectedStatus: 201, body: { contactId: referrer.contact.id, type: "earn", amount: 140, reason: "Compra visible" } });
  await jsonRequest(`/api/businesses/${businessId}/loyalty/rewards`, { method: "POST", expectedStatus: 201, body: { name: "Postre Visible", cost: 50, stock: 3 } });
  const code = await jsonRequest(`/api/businesses/${businessId}/loyalty/referrals/codes`, { method: "POST", expectedStatus: 201, body: { contactId: referrer.contact.id } });
  const attribution = await jsonRequest(`/api/businesses/${businessId}/loyalty/referrals/attribute`, { method: "POST", expectedStatus: 201, body: { code: code.code.code, referredContactId: referred.contact.id, fingerprint: "browser-visible-device" } });
  await jsonRequest(`/api/businesses/${businessId}/loyalty/referrals/${attribution.attribution.id}/convert`, { method: "POST", body: {} });

  const table1 = await createResource("Mesa Visible 1", 4);
  const table2 = await createResource("Mesa Visible 2", 4);
  await schedule(table1.resource.id);
  await schedule(table2.resource.id);
  const zone = await jsonRequest(`/api/businesses/${businessId}/vertical/zones`, { method: "POST", expectedStatus: 201, body: { name: "Terraza Visible", resourceIds: [table1.resource.id, table2.resource.id], capacity: 8 } });
  await jsonRequest(`/api/businesses/${businessId}/vertical/combinations`, { method: "POST", expectedStatus: 201, body: { name: "Mesa Imperial Visible", zoneId: zone.item.id, tableResourceIds: [table1.resource.id, table2.resource.id], minGuests: 4, maxGuests: 8 } });
  const shift = await jsonRequest(`/api/businesses/${businessId}/vertical/shifts`, { method: "POST", expectedStatus: 201, body: { name: "Comida Visible", weekdays: [0, 1, 2, 3, 4, 5, 6], startTime: "13:00", endTime: "16:30", expectedDurationMinutes: 90, maxCovers: 50 } });
  const policy = await jsonRequest(`/api/businesses/${businessId}/vertical/policies`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Política Visible",
      version: "2026-07",
      visibleText: "Cancelación gratuita hasta 48 horas antes.",
      cancellationHours: 48,
      refundPercentBeforeDeadline: 100,
      refundPercentAfterDeadline: 20,
      disputeInstructions: "Contacta con el local."
    }
  });
  const inventory = await jsonRequest(`/api/businesses/${businessId}/hospitality/inventory`, { method: "POST", expectedStatus: 201, body: { name: "Vino Crítico Visible", category: "Bebidas", unit: "bottles", currentStock: 1, minStock: 1, costPerUnit: 8, active: true } });
  await jsonRequest(`/api/businesses/${businessId}/vertical/experiences`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Menú Terraza Visible",
      type: "menu",
      serviceId,
      zoneIds: [zone.item.id],
      serviceShiftIds: [shift.item.id],
      minGuests: 1,
      maxGuests: 20,
      capacity: 20,
      durationMinutes: 90,
      inventoryRules: [{ inventoryItemId: inventory.item.id, quantityPerGuest: 0.5 }],
      depositRules: [{ id: "visible-vip", mode: "percent", value: 20, segments: ["vip"], priority: 10 }],
      policyId: policy.item.id
    }
  });
  const booking = await jsonRequest(`/api/businesses/${businessId}/bookings`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      serviceId,
      contactId: referred.contact.id,
      customerName: "Beto Referido",
      email: "beto-referido-browser@example.com",
      startsAt: `${bookingDate}T13:00:00.000Z`,
      resourceIds: [table1.resource.id],
      partySize: 4,
      status: "confirmed",
      source: "dashboard"
    }
  });
  await jsonRequest(`/api/businesses/${businessId}/vertical/bookings/${booking.booking.id}/policy-acceptance`, { method: "POST", expectedStatus: 201, body: { policyId: policy.item.id, accepted: true, channel: "browser-seed" } });

  for (const size of ["1440,1200", "390,844"]) {
    await assertDashboard(size, "customers", [
      /data-loyalty-center/,
      /Club Brasa Visible/,
      /Retención medible/,
      /Ana Club/,
      /Postre Visible/,
      /brasas disponibles/,
      /referidos convertidos/,
      /data-loyalty-program-form/,
      /data-loyalty-movement-form/,
      /data-loyalty-reward-form/,
      /data-referral-attribution-form/
    ]);
    await assertDashboard(size, "bookings", [
      /data-vertical-operations-center/,
      /Capacidad y servicio explicados/,
      /Terraza Visible/,
      /Mesa Imperial Visible/,
      /Comida Visible/,
      /Política Visible/,
      /Menú Terraza Visible/,
      /Vino Crítico Visible/,
      /Ver origen/,
      /data-vertical-zone-form/,
      /data-vertical-combination-form/,
      /data-vertical-shift-form/,
      /data-vertical-policy-form/,
      /data-vertical-experience-form/,
      /data-booking-combination-form/,
      /data-booking-public-confirmation/
    ]);
  }
  console.log("Growth and vertical operations browser checks passed: responsive loyalty, rewards, referrals, zones, table combinations, shifts, experiences, policies, booking controls and actionable planning.");
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(2000)]);
  }
  await rm(tempDir, { recursive: true, force: true });
  await rm(profileRoot, { recursive: true, force: true }).catch(() => {});
}

async function assertDashboard(size, tab, patterns) {
  const profile = `${profileRoot}-${tab}-${size.replace(",", "x")}`;
  const result = await run(chrome, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profile}`,
    `--window-size=${size}`,
    "--virtual-time-budget=24000",
    "--dump-dom",
    `${baseUrl}/pages/business-dashboard.html?business=${businessId}&tab=${tab}&apiBase=same-origin`
  ]);
  assert.equal(result.exitCode, 0, `Chrome failed at ${tab}/${size}: ${result.stderr}`);
  for (const pattern of patterns) assert.match(result.stdout, pattern);
  assert.doesNotMatch(result.stdout, /No se pudo cargar/);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

function createResource(name, capacity) { return jsonRequest(`/api/businesses/${businessId}/resources`, { method: "POST", expectedStatus: 201, body: { name, type: "table", capacity, serviceIds: [serviceId], active: true } }); }
function schedule(resourceId) { return jsonRequest(`/api/businesses/${businessId}/resources/${resourceId}/schedule`, { method: "PUT", body: { schedule: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "12:00", endTime: "23:00", active: true })) } }); }
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
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (server.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
async function findChrome() {
  const candidates = process.platform === "win32"
    ? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")]
    : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  for (const candidate of candidates) { try { await access(candidate); return candidate; } catch {} }
  throw new Error("Chrome or Chromium is required for the growth operations browser test");
}
function run(command, args) { return new Promise((resolve, reject) => { const processChild = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; processChild.stdout.on("data", (chunk) => { stdout += String(chunk); }); processChild.stderr.on("data", (chunk) => { stderr += String(chunk); }); processChild.on("error", reject); processChild.on("close", (exitCode) => resolve({ exitCode, stdout, stderr })); }); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function addDays(dateValue, days) { const date = new Date(`${dateValue}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
