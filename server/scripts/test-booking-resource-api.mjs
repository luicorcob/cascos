import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-booking-resource-api-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort(); const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte"; const serviceId = "svc_menu_degustacion"; const adminToken = "booking-resource-admin"; const webhookSecret = "booking-resource-webhook";
let child; let logs = "";
try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  child = spawn(process.execPath, ["server/server.mjs"], { cwd: root, env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test", LOCALLIFT_ADMIN_TOKEN: adminToken, ADMIN_API_TOKEN: adminToken, CLIENT_SESSION_SECRET: "booking-resource-client-secret-32", DLS_BOOKING_WEBHOOK_SECRET: webhookSecret, STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "", STRIPE_BOOKING_WEBHOOK_SECRET: "", BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "", BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false" }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  child.stdout.on("data", appendLog); child.stderr.on("data", appendLog); await waitForHealth();

  await adminJson(`/api/businesses/${businessId}/services/${serviceId}`, { method: "PATCH", body: { price: 100, requiredResourceTypes: ["table"], defaultPartySize: 2, depositMode: "percent", depositValue: 25, guaranteeRequired: true, cancellationWindowHours: 24, noShowFee: 30 } });
  await adminJson(`/api/businesses/${businessId}/portal-access`, { method: "POST", body: { password: "BookingResourcePortal2026!" } });
  const login = await jsonRequest("/api/client/login", { method: "POST", body: { business: businessId, password: "BookingResourcePortal2026!" } });
  const table1 = await createResource("Mesa 1", 4); const table2 = await createResource("Mesa 2", 4);
  await schedule(table1.resource.id); await schedule(table2.resource.id);
  const clientResources = await clientJson(`/api/businesses/${businessId}/resources`, login.session.token);
  assert.equal(clientResources.resources.length, 2, "Client portal must be able to read booking resources");
  const clientWaitlist = await clientJson(`/api/businesses/${businessId}/waitlist`, login.session.token);
  assert.ok(Array.isArray(clientWaitlist.entries), "Client portal must be able to read the waitlist");
  await clientJson(`/api/businesses/${businessId}/resources`, login.session.token, { method: "POST", expectedStatus: 403, body: { name: "No permitido", type: "table" } });
  const first = await createBooking("Mesa Uno", table1.resource.id, "2026-07-20T13:00:00.000Z");
  const second = await createBooking("Mesa Dos", table2.resource.id, "2026-07-20T13:00:00.000Z");
  assert.equal(first.booking.depositAmount, 25); assert.equal(first.booking.resources[0].name, "Mesa 1");
  assert.equal(second.booking.resources[0].name, "Mesa 2", "Two resources must support simultaneous bookings");
  await createBooking("Conflicto", table1.resource.id, "2026-07-20T13:00:00.000Z", 409);

  const availability = await adminJson(`/api/businesses/${businessId}/resource-availability?serviceId=${serviceId}&startsAt=${encodeURIComponent("2026-07-20T16:00:00.000Z")}&partySize=2`);
  assert.equal(availability.availability.available, true); assert.equal(availability.availability.resources.length, 2);
  const exception = await adminJson(`/api/businesses/${businessId}/resources/${table1.resource.id}/exceptions`, { method: "POST", expectedStatus: 201, body: { startsAt: "2026-07-20T16:00:00.000Z", endsAt: "2026-07-20T18:00:00.000Z", mode: "blocked", reason: "Evento privado" } });
  assert.equal(exception.exception.mode, "blocked");

  const wait = await adminJson(`/api/businesses/${businessId}/waitlist`, { method: "POST", expectedStatus: 201, body: { serviceId, customerName: "Nora Lista", email: "nora-lista@example.com", desiredStartsAt: first.booking.startsAt, desiredEndsAt: first.booking.endsAt, partySize: 2, source: "dashboard" } });
  const canceled = await adminJson(`/api/businesses/${businessId}/bookings/${first.booking.id}`, { method: "PATCH", body: { status: "canceled" } });
  assert.equal(canceled.waitlistOffer.entry.id, wait.entry.id); assert.ok(canceled.waitlistOffer.token.length > 30);
  const publicOffer = await jsonRequest(`/api/public/waitlist-offers/${encodeURIComponent(canceled.waitlistOffer.token)}`); assert.equal(publicOffer.entry.customerName, "Nora Lista");
  const accepted = await jsonRequest(`/api/public/waitlist-offers/${encodeURIComponent(canceled.waitlistOffer.token)}/accept`, { method: "POST", body: {} }); assert.equal(accepted.bookingDraft.waitlistEntryId, wait.entry.id);
  const converted = await adminJson(`/api/businesses/${businessId}/bookings`, { method: "POST", expectedStatus: 201, body: { ...accepted.bookingDraft, status: "confirmed", source: "waitlist" } });
  assert.equal(converted.booking.waitlistEntryId, wait.entry.id);

  const checkout = await adminJson(`/api/businesses/${businessId}/bookings/${second.booking.id}/deposit-checkout`, { method: "POST", expectedStatus: 201, body: { idempotencyKey: "booking-api-deposit" } });
  assert.equal(checkout.checkout.provider, "development"); assert.ok(checkout.checkout.providerSessionId.startsWith("cs_booking_dev_"));
  const event = { id: "evt_booking_paid_api", type: "checkout.session.completed", data: { providerSessionId: checkout.checkout.providerSessionId, providerPaymentId: "pi_booking_paid_api", paidAt: new Date().toISOString() } };
  assert.equal((await signedWebhook(event)).completed, true); assert.equal((await signedWebhook(event)).duplicate, true);
  const noShow = await adminJson(`/api/businesses/${businessId}/bookings/${second.booking.id}`, { method: "PATCH", body: { status: "no-show" } });
  assert.equal(noShow.booking.deposit.status, "forfeited"); assert.equal(noShow.booking.guaranteeStatus, "charge_due");

  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.equal(persisted.bookingResources.length, 2); assert.ok(persisted.bookingResourceSchedules.length >= 14); assert.ok(persisted.bookingResourceAssignments.length >= 3); assert.ok(persisted.bookingWaitlist.some((item) => item.status === "booked")); assert.equal(persisted.bookingCheckouts[0].status, "paid"); assert.equal(persisted.bookingPaymentEvents.length, 1);
  console.log("Booking resource API checks passed: CRUD, schedules, resource-aware concurrency, capacity, exceptions, availability, waitlist auto-offer/public accept/conversion, deposits, webhook idempotency and no-show guarantee policy.");
} finally { if (child && child.exitCode === null) { child.kill(); await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]); } await rm(tempDir, { recursive: true, force: true }); }

function createResource(name, capacity) { return adminJson(`/api/businesses/${businessId}/resources`, { method: "POST", expectedStatus: 201, body: { name, type: "table", capacity, serviceIds: [serviceId], simultaneousCapacity: 1, bufferBeforeMinutes: 10, bufferAfterMinutes: 10, active: true } }); }
function schedule(resourceId) { return adminJson(`/api/businesses/${businessId}/resources/${resourceId}/schedule`, { method: "PUT", body: { schedule: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startTime: "12:00", endTime: "23:00", active: true })) } }); }
function createBooking(name, resourceId, startsAt, expectedStatus = 201) { return adminJson(`/api/businesses/${businessId}/bookings`, { method: "POST", expectedStatus, body: { serviceId, customerName: name, email: `${name.toLowerCase().replace(/\s+/g, "-")}@example.com`, startsAt, resourceIds: [resourceId], partySize: 2, status: "confirmed", source: "dashboard" } }); }
function adminJson(pathname, options = {}) { return jsonRequest(pathname, { ...options, headers: { ...options.headers, Authorization: `Bearer ${adminToken}` } }); }
function clientJson(pathname, session, options = {}) { return jsonRequest(pathname, { ...options, headers: { ...options.headers, "x-locallift-client-token": session } }); }
async function signedWebhook(body) { const raw = JSON.stringify(body); const signature = `sha256=${createHmac("sha256", webhookSecret).update(raw).digest("hex")}`; return jsonRequest("/api/webhooks/stripe/bookings", { method: "POST", rawBody: raw, headers: { "Content-Type": "application/json", "x-dls-signature": signature } }); }
async function jsonRequest(pathname, options = {}) { const headers = { ...options.headers }; const init = { method: options.method || "GET", headers }; if (options.rawBody !== undefined) init.body = options.rawBody; else if (options.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); } const response = await fetch(`${baseUrl}${pathname}`, init); const text = await response.text(); const expectedStatus = options.expectedStatus || 200; if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}\n${logs}`); return text ? JSON.parse(text) : {}; }
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (child.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
