const apiBase = normalizeBase(process.env.PILOT_API_BASE_URL);
const demoUrl = clean(process.env.PILOT_DEMO_URL);
const adminToken = clean(process.env.PILOT_ADMIN_TOKEN || process.env.LOCALLIFT_ADMIN_TOKEN);
const businessId = clean(process.env.PILOT_BUSINESS_ID);
const businessSlug = clean(process.env.PILOT_BUSINESS_SLUG);
const privacyUrl = clean(process.env.PILOT_PRIVACY_URL);
const frontendOrigin = normalizeOrigin(process.env.PILOT_FRONTEND_ORIGIN || demoUrl);
const allowHttp = clean(process.env.PILOT_ALLOW_HTTP).toLowerCase() === "true";
const runId = new Date().toISOString().replace(/[:.]/g, "-");

main().catch((error) => {
  console.error(`Public pilot acceptance failed: ${error.message}`);
  process.exitCode = 1;
});

async function main() {
  validateConfiguration();

  const demoResponse = await fetch(demoUrl, { redirect: "follow" });
  assert(demoResponse.ok, `Demo URL returned ${demoResponse.status}`);
  const demoHtml = await demoResponse.text();
  assert(/LocalLift|sitePreview|Luma Studio/i.test(demoHtml), "Demo URL does not look like LocalLift");

  const privacyResponse = await fetch(privacyUrl, { redirect: "follow" });
  assert(privacyResponse.ok, `Privacy URL returned ${privacyResponse.status}`);
  assert(/privacidad|privacy/i.test(await privacyResponse.text()), "Privacy URL does not contain privacy information");

  const health = await request("/api/health");
  assert(health.ok === true, "Healthcheck must return ok: true");
  await request("/api/businesses", { expectedStatus: 401 });

  const corsResponse = await fetch(`${apiBase}/api/businesses`, {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      Origin: frontendOrigin
    }
  });
  assert(corsResponse.ok, `CORS admin request returned ${corsResponse.status}`);
  assert(
    corsResponse.headers.get("access-control-allow-origin") === frontendOrigin,
    `CORS must allow the frontend origin exactly: ${frontendOrigin}`
  );

  const businesses = await adminRequest("/api/businesses");
  assert(
    businesses.businesses?.some((business) => business.id === businessId || business.slug === businessSlug),
    "Configured pilot business is not available through the admin API"
  );

  const lead = await request(`/api/public/${businessSlug}/leads`, {
    method: "POST",
    body: {
      name: `Aceptacion publica ${runId}`,
      email: "aceptacion-publica@example.com",
      message: "Lead de aceptacion de Fase 0",
      privacyAccepted: true,
      privacyAcceptedAt: new Date().toISOString(),
      privacyPolicyUrl: privacyUrl
    },
    expectedStatus: 201
  });
  assert(lead.contact?.privacyAccepted === true, "Lead consent must be stored");

  await request(`/api/public/${businessSlug}/events`, {
    method: "POST",
    body: { name: "lead_form_submit", detail: { source: "phase0-public-acceptance", runId } },
    expectedStatus: 201
  });

  const services = await adminRequest(`/api/businesses/${businessId}/services`);
  const availability = await adminRequest(`/api/businesses/${businessId}/availability`);
  const service = services.services?.find((item) => item.active !== false);
  const rule = availability.availability?.find((item) => item.active !== false);
  assert(service && rule, "Pilot business needs an active service and availability rule");

  const startsAt = nextAvailableStart(rule, service.durationMinutes);
  const booking = await request(`/api/public/${businessSlug}/bookings`, {
    method: "POST",
    body: {
      serviceId: service.id,
      startsAt: startsAt.toISOString(),
      customerName: `Aceptacion publica ${runId}`,
      phone: "+34600000000",
      notes: "Reserva de aceptacion de Fase 0",
      privacyAccepted: true,
      privacyAcceptedAt: new Date().toISOString(),
      privacyPolicyUrl: privacyUrl
    },
    expectedStatus: 201
  });
  assert(booking.booking?.privacyAccepted === true, "Booking consent must be stored");

  const contacts = await adminRequest(`/api/businesses/${businessId}/contacts?includeActivities=true`);
  assert(contacts.contacts?.some((item) => item.id === lead.contact.id), "Lead must appear in dashboard data");

  const updatedLead = await adminRequest(`/api/businesses/${businessId}/contacts/${lead.contact.id}`, {
    method: "PATCH",
    body: { status: "contacted" }
  });
  assert(updatedLead.contact?.status === "contacted", "Lead status must be editable");

  const updatedBooking = await adminRequest(`/api/businesses/${businessId}/bookings/${booking.booking.id}`, {
    method: "PATCH",
    body: { status: "confirmed" }
  });
  assert(updatedBooking.booking?.status === "confirmed", "Booking must be confirmable");

  const currentMonth = formatMonth(new Date());
  const bookingMonth = formatMonth(startsAt);
  const currentReport = await adminRequest(`/api/businesses/${businessId}/reports/monthly?month=${currentMonth}`);
  const bookingReport = bookingMonth === currentMonth
    ? currentReport
    : await adminRequest(`/api/businesses/${businessId}/reports/monthly?month=${bookingMonth}`);
  assert(currentReport.report?.metrics?.newContacts >= 1, "Current report must include contacts");
  assert(currentReport.report?.metrics?.conversionEvents >= 1, "Current report must include conversion events");
  assert(bookingReport.report?.metrics?.bookings >= 1, "Booking report must include the booking");
  assert(bookingReport.report?.metrics?.confirmedBookings >= 1, "Booking report must include the confirmed booking");

  const finalHealth = await request("/api/health");
  assert(finalHealth.ok === true, "Final healthcheck must remain healthy");

  console.log("Public pilot acceptance passed.");
  console.log(`Run: ${runId}`);
  console.log(`Health: ok; contacts: ${finalHealth.counts?.contacts}; bookings: ${finalHealth.counts?.bookings}; events: ${finalHealth.counts?.events}.`);
  console.log("Set PHASE0_PUBLIC_ACCEPTANCE_PASSED=true and save this output as evidence.");
}

async function adminRequest(pathname, options = {}) {
  return request(pathname, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${adminToken}`
    }
  });
}

async function request(pathname, options = {}) {
  const headers = { ...options.headers };
  const init = { method: options.method || "GET", headers };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${apiBase}${pathname}`, init);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  const expectedStatus = options.expectedStatus || 200;

  if (response.status !== expectedStatus) {
    throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`);
  }

  return payload;
}

function validateConfiguration() {
  const required = [
    ["PILOT_API_BASE_URL", apiBase],
    ["PILOT_DEMO_URL", demoUrl],
    ["PILOT_ADMIN_TOKEN", adminToken],
    ["PILOT_BUSINESS_ID", businessId],
    ["PILOT_BUSINESS_SLUG", businessSlug],
    ["PILOT_PRIVACY_URL", privacyUrl],
    ["PILOT_FRONTEND_ORIGIN", frontendOrigin]
  ];
  const missing = required.filter(([, value]) => !value).map(([key]) => key);

  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }

  if (!allowHttp && (![apiBase, demoUrl, privacyUrl].every((value) => value.startsWith("https://")))) {
    throw new Error("Public acceptance requires HTTPS URLs. Use PILOT_ALLOW_HTTP=true only for local testing.");
  }

  assert(adminToken.length >= 32, "PILOT_ADMIN_TOKEN must have at least 32 characters");
}

function nextAvailableStart(rule, durationMinutes) {
  const [startHour, startMinute] = String(rule.startTime).split(":").map(Number);
  const [endHour, endMinute] = String(rule.endTime).split(":").map(Number);
  const startTotal = startHour * 60 + startMinute;
  const endTotal = endHour * 60 + endMinute;
  const duration = Number(durationMinutes || 60);
  assert(endTotal - startTotal >= duration, "Availability rule is shorter than service duration");

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

function normalizeBase(value) {
  return clean(value).replace(/\/+$/, "");
}

function normalizeOrigin(value) {
  const text = clean(value);

  try {
    return new URL(text).origin;
  } catch {
    return "";
  }
}

function clean(value) {
  return String(value || "").trim();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
