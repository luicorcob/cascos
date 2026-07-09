import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const adminToken = "pilot-smoke-admin-token-32-characters";
const businessId = "biz_demo_brasa_norte";
const businessSlug = "brasa-norte";
let child;
let tempDir;
let logs = "";

async function main() {
  tempDir = await mkdtemp(path.join(root, ".tmp-pilot-smoke-"));
  const dbPath = path.join(tempDir, "business-db.json");
  const backupDir = path.join(tempDir, "backups");
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
      BUSINESS_STORE: "json",
      BUSINESS_DB_DRIVER: "json",
      DATABASE_URL: "",
      POSTGRES_URL: "",
      LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath,
      BUSINESS_DB_BACKUP_DIR: backupDir,
      BUSINESS_DB_BACKUPS: "true",
      GOOGLE_AUTH_DB_FILE: path.join(tempDir, "google-auth-db.json"),
      GOOGLE_MAPS_API_KEY: "",
      GOOGLE_OAUTH_CLIENT_ID: "",
      GOOGLE_OAUTH_CLIENT_SECRET: "",
      GOOGLE_OAUTH_REDIRECT_URI: "",
      GOOGLE_TOKEN_ENCRYPTION_KEY: "",
      PUBLIC_LEAD_RATE_LIMIT: "30",
      PUBLIC_BOOKING_RATE_LIMIT: "30",
      PUBLIC_EVENT_RATE_LIMIT: "30"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });

  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);

  const health = await waitForHealth(baseUrl);
  assert(health.ok === true, "Healthcheck must return ok: true");

  await request(baseUrl, "/api/businesses", { expectedStatus: 401 });

  const lead = await request(baseUrl, `/api/public/${businessSlug}/leads`, {
    method: "POST",
    body: {
      name: "Prueba Lead",
      email: "lead@example.com",
      message: "Solicitud de informacion desde smoke test",
      privacyAccepted: true,
      privacyAcceptedAt: new Date().toISOString(),
      privacyPolicyUrl: "https://example.com/privacidad"
    },
    expectedStatus: 201
  });
  assert(lead.contact?.privacyAccepted === true, "Lead consent must be stored");

  await request(baseUrl, `/api/public/${businessSlug}/events`, {
    method: "POST",
    body: {
      name: "lead_form_submit",
      detail: { source: "pilot-smoke" }
    },
    expectedStatus: 201
  });

  const services = await adminRequest(baseUrl, `/api/businesses/${businessId}/services`);
  const availability = await adminRequest(baseUrl, `/api/businesses/${businessId}/availability`);
  const service = services.services?.find((item) => item.active !== false);
  const rule = availability.availability?.find((item) => item.active !== false);
  assert(service && rule, "Pilot fixture must include an active service and availability rule");

  const startsAt = nextAvailableStart(rule, service.durationMinutes);
  const booking = await request(baseUrl, `/api/public/${businessSlug}/bookings`, {
    method: "POST",
    body: {
      serviceId: service.id,
      startsAt: startsAt.toISOString(),
      customerName: "Prueba Reserva",
      phone: "+34600000000",
      notes: "Reserva creada por smoke test",
      privacyAccepted: true,
      privacyAcceptedAt: new Date().toISOString(),
      privacyPolicyUrl: "https://example.com/privacidad"
    },
    expectedStatus: 201
  });
  assert(booking.booking?.privacyAccepted === true, "Booking consent must be stored");

  const contacts = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts?includeActivities=true`);
  assert(contacts.contacts?.some((item) => item.id === lead.contact.id), "Public lead must appear in admin contacts");

  const updatedLead = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/${lead.contact.id}`, {
    method: "PATCH",
    body: { status: "contacted" }
  });
  assert(updatedLead.contact?.status === "contacted", "Lead status must be editable");

  const pipeline = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/pipeline`);
  const pipelineLead = pipeline.pipeline?.contacted?.contacts?.find((item) => item.id === lead.contact.id);
  assert(pipelineLead, "Pipeline must group contacts by status");
  assert(pipelineLead.priority === "media", "Pipeline contacts must expose default priority");
  assert(Number.isFinite(Number(pipelineLead.order)), "Pipeline contacts must expose a numeric order");

  const movedLead = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/${lead.contact.id}/pipeline`, {
    method: "PATCH",
    body: { status: "waiting", order: 7.5 }
  });
  assert(movedLead.contact?.status === "waiting", "Pipeline PATCH must update status");
  assert(movedLead.contact?.order === 7.5, "Pipeline PATCH must persist manual order");
  assert(movedLead.activity?.type === "contact.status_changed", "Pipeline status changes must create contact history");

  const movedPipeline = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/pipeline`);
  const waitingLead = movedPipeline.pipeline?.waiting?.contacts?.find((item) => item.id === lead.contact.id);
  assert(waitingLead?.order === 7.5, "Pipeline order must persist after reload");

  const updatedBooking = await adminRequest(baseUrl, `/api/businesses/${businessId}/bookings/${booking.booking.id}`, {
    method: "PATCH",
    body: { status: "confirmed" }
  });
  assert(updatedBooking.booking?.status === "confirmed", "Booking status must be editable");

  const currentMonth = formatMonth(new Date());
  const bookingMonth = formatMonth(startsAt);
  const currentReport = await adminRequest(baseUrl, `/api/businesses/${businessId}/reports/monthly?month=${currentMonth}`);
  const bookingReport = bookingMonth === currentMonth
    ? currentReport
    : await adminRequest(baseUrl, `/api/businesses/${businessId}/reports/monthly?month=${bookingMonth}`);

  assert(currentReport.report?.metrics?.newContacts >= 1, "Current report must include the lead");
  assert(currentReport.report?.metrics?.conversionEvents >= 1, "Current report must include the conversion event");
  assert(bookingReport.report?.metrics?.bookings >= 1, "Booking report must include the booking");
  assert(bookingReport.report?.metrics?.confirmedBookings >= 1, "Booking report must include the confirmed booking");

  const googleStatus = await adminRequest(baseUrl, `/api/businesses/${businessId}/google`);
  assert(googleStatus.connected?.calendar === false, "Google status must report disconnected Calendar without credentials");
  assert(googleStatus.configured?.oauth === false, "Google status must report missing OAuth configuration");

  const reviewRequest = await adminRequest(baseUrl, `/api/businesses/${businessId}/google/review-request`, {
    method: "POST",
    body: {
      customerName: "Cliente Google",
      reviewUrl: "https://example.com/review"
    }
  });
  assert(reviewRequest.message?.includes("https://example.com/review"), "Google review request must contain the review URL");

  const placeActionDryRun = await adminRequest(baseUrl, `/api/businesses/${businessId}/google/business/place-actions`, {
    method: "POST",
    body: {
      locationId: "test-location",
      uri: "https://example.com/reservar",
      placeActionType: "APPOINTMENT"
    }
  });
  assert(placeActionDryRun.dryRun === true, "Google place action must default to dry-run");

  const googleDiagnostics = await adminRequest(baseUrl, `/api/businesses/${businessId}/google/diagnostics`);
  assert(googleDiagnostics.ok === true, "Google diagnostics must skip unavailable integrations without failing");
  assert(googleDiagnostics.checks?.every((check) => check.skipped === true), "Google diagnostics must identify unconfigured services");

  const oauthPending = await adminRequest(baseUrl, `/api/google/oauth/start?businessId=${businessId}&features=calendar`, {
    expectedStatus: 503
  });
  assert(oauthPending.code === "google_setup_required", "Google OAuth start must explain missing configuration");

  const finalHealth = await request(baseUrl, "/api/health");
  assert(finalHealth.counts?.contacts >= 2, "Healthcheck must count created contacts");
  assert(finalHealth.counts?.bookings >= 1, "Healthcheck must count created bookings");
  assert(finalHealth.counts?.events >= 1, "Healthcheck must count created events");
  assert(finalHealth.google?.oauthConfigured === false, "Healthcheck must expose Google readiness");

  console.log("Pilot smoke test passed.");
  console.log(`Health: ok; contacts: ${finalHealth.counts.contacts}; bookings: ${finalHealth.counts.bookings}; events: ${finalHealth.counts.events}.`);
  console.log("Verified: admin auth, lead consent, booking consent, status changes, monthly reports and Google readiness.");
}

async function adminRequest(baseUrl, pathname, options = {}) {
  return request(baseUrl, pathname, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${adminToken}`
    }
  });
}

async function request(baseUrl, pathname, options = {}) {
  const headers = { ...options.headers };
  const init = {
    method: options.method || "GET",
    headers
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  const expectedStatus = options.expectedStatus || 200;

  if (response.status !== expectedStatus) {
    throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`);
  }

  return payload;
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 15000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before healthcheck passed.\n${logs}`);
    }

    try {
      return await request(baseUrl, "/api/health");
    } catch {
      await delay(150);
    }
  }

  throw new Error(`Healthcheck did not pass within 15 seconds.\n${logs}`);
}

function nextAvailableStart(rule, durationMinutes) {
  const [startHour, startMinute] = String(rule.startTime).split(":").map(Number);
  const [endHour, endMinute] = String(rule.endTime).split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  const duration = Number(durationMinutes || 60);

  if (endTotal - startTotal < duration) {
    throw new Error("Availability rule is shorter than the selected service");
  }

  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);

  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(date);
    candidate.setDate(date.getDate() + offset);

    if (candidate.getDay() === Number(rule.weekday)) {
      candidate.setHours(startHour, startMinute, 0, 0);
      return candidate;
    }
  }

  throw new Error("Could not find the next available booking date");
}

function formatMonth(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function cleanup() {
  if (child && child.exitCode === null) {
    child.kill();
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(2000)
    ]);
  }

  if (tempDir && tempDir.startsWith(root) && path.basename(tempDir).startsWith(".tmp-pilot-smoke-")) {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main()
  .catch((error) => {
    console.error(`Pilot smoke test failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(cleanup);
