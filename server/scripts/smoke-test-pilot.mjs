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
  assert(lead.automation?.applied === true, "A new lead must schedule its first response automatically");
  assert(lead.contact?.nextAction?.note === "Responder hoy", "Automatic first response must be visible on the contact");

  const repeatedLead = await request(baseUrl, `/api/public/${businessSlug}/leads`, {
    method: "POST",
    body: {
      name: "Prueba Lead Repetido",
      email: "lead@example.com",
      message: "Segunda solicitud con el mismo email",
      privacyAccepted: true,
      privacyAcceptedAt: new Date().toISOString(),
      privacyPolicyUrl: "https://example.com/privacidad"
    },
    expectedStatus: 200
  });
  assert(repeatedLead.contact?.id === lead.contact.id, "Repeated public lead must update the existing contact");
  assert(repeatedLead.mergedWithExisting === true, "Repeated public lead must be reported as an existing contact update");
  assert(repeatedLead.automation === null, "A duplicate submission must not create a second automatic action");
  assert(repeatedLead.contact?.nextAction?.note === "Responder hoy", "Duplicate updates must preserve the existing automatic action");

  await request(baseUrl, `/api/public/${businessSlug}/events`, {
    method: "POST",
    body: {
      name: "booking_click",
      detail: { email: "lead@example.com", source: "pilot-smoke" }
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

  const bookingReminder = await adminRequest(baseUrl, `/api/businesses/${businessId}/bookings/${booking.booking.id}/reminders`, {
    method: "POST",
    body: {
      channel: "whatsapp",
      message: "Recordatorio creado por smoke test"
    },
    expectedStatus: 201
  });
  const bookingTimeline = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/${booking.contact.id}/timeline`);
  assert(bookingTimeline.timeline?.some((item) => item.type === "booking" && item.refId === booking.booking.id), "Contact timeline must include bookings");
  assert(bookingTimeline.timeline?.some((item) => item.type === "booking.reminder" && item.refId === bookingReminder.reminder.id), "Contact timeline must include booking reminders");

  const contacts = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts?includeActivities=true`);
  const listedLead = contacts.contacts?.find((item) => item.id === lead.contact.id);
  assert(listedLead, "Public lead must appear in admin contacts");
  assert(Number(listedLead.score) >= 55, "Lead score must include email, form, booking click and recent interaction signals");
  assert(listedLead.scoreLabel === "templado", "Lead score label must follow configured thresholds");

  const lostScoreContact = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST",
    body: {
      name: "Lead perdido scoring",
      email: "lost-score@example.com",
      status: "lost",
      lostReason: "no_responde",
      source: "manual"
    },
    expectedStatus: 201
  });
  assert(lostScoreContact.contact?.scoreLabel === "perdido", "Lost contacts must force the perdido score label");

  const lossCandidate = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST",
    body: {
      name: "Lead con motivo obligatorio",
      email: "lost-reason@example.com",
      source: "manual"
    },
    expectedStatus: 201
  });
  await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/${lossCandidate.contact.id}`, {
    method: "PATCH",
    body: { status: "lost" },
    expectedStatus: 400
  });
  await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/${lossCandidate.contact.id}/pipeline`, {
    method: "PATCH",
    body: { status: "lost", order: 4.5 },
    expectedStatus: 400
  });
  const lostWithReason = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/${lossCandidate.contact.id}/pipeline`, {
    method: "PATCH",
    body: { status: "lost", order: 4.5, lostReason: "precio" }
  });
  assert(lostWithReason.contact?.lostReason === "precio", "Lost reason must be stored when moving to lost");
  assert(/Motivo: Precio/.test(lostWithReason.activity?.note || ""), "Lost reason must be visible in contact history");

  const lostReasons = await adminRequest(baseUrl, `/api/businesses/${businessId}/reports/lost-reasons`);
  assert(lostReasons.reasons?.some((item) => item.reason === "precio" && item.count >= 1), "Lost reasons report must count price losses");

  const mergeSurvivor = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST",
    body: {
      name: "Duplicado superviviente",
      email: "merge-a@example.com",
      phone: "+34 611 111 111",
      source: "manual"
    },
    expectedStatus: 201
  });
  const mergeDuplicate = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST",
    body: {
      name: "Duplicado secundario",
      email: "merge-b@example.com",
      phone: "+34 622 222 222",
      source: "manual"
    },
    expectedStatus: 201
  });
  await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/${mergeDuplicate.contact.id}/activities`, {
    method: "POST",
    body: {
      type: "note",
      title: "Nota duplicada",
      note: "Historial que debe sobrevivir",
      source: "dashboard"
    },
    expectedStatus: 201
  });
  await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/${mergeDuplicate.contact.id}`, {
    method: "PATCH",
    body: { email: "merge-a@example.com" }
  });
  const duplicateGroups = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/duplicates`);
  assert(duplicateGroups.groups?.some((group) => {
    const ids = group.contacts?.map((contact) => contact.id) || [];
    return ids.includes(mergeSurvivor.contact.id) && ids.includes(mergeDuplicate.contact.id);
  }), "Duplicate candidates must be detected by normalized email");
  const merged = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/merge`, {
    method: "POST",
    body: {
      survivorId: mergeSurvivor.contact.id,
      duplicateIds: [mergeDuplicate.contact.id]
    }
  });
  assert(merged.contact?.id === mergeSurvivor.contact.id, "Merge must return the survivor contact");
  assert(merged.merged?.[0]?.merged === true, "Duplicate contact must be soft merged");

  const contactsAfterMerge = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts?includeActivities=true&includeTimeline=true`);
  assert(!contactsAfterMerge.contacts?.some((item) => item.id === mergeDuplicate.contact.id), "Merged duplicates must be hidden from normal contact lists");
  const survivorAfterMerge = contactsAfterMerge.contacts?.find((item) => item.id === mergeSurvivor.contact.id);
  assert(survivorAfterMerge?.activities?.some((activity) => activity.note === "Historial que debe sobrevivir"), "Merged survivor must keep duplicate activity history");
  assert(survivorAfterMerge?.timeline?.some((item) => /Historial que debe sobrevivir/.test(item.summary || "")), "Merged survivor timeline must keep duplicate activity history");

  const allContactsAfterMerge = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts?includeMerged=true`);
  const softMergedContact = allContactsAfterMerge.contacts?.find((item) => item.id === mergeDuplicate.contact.id);
  assert(softMergedContact?.merged === true && softMergedContact?.mergedInto === mergeSurvivor.contact.id, "Merged duplicate must keep mergedInto metadata");

  const updatedLead = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/${lead.contact.id}`, {
    method: "PATCH",
    body: { status: "contacted" }
  });
  assert(updatedLead.contact?.status === "contacted", "Lead status must be editable");

  const pipeline = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/pipeline?includeTimeline=true`);
  const pipelineLead = pipeline.pipeline?.contacted?.contacts?.find((item) => item.id === lead.contact.id);
  assert(pipelineLead, "Pipeline must group contacts by status");
  assert(pipelineLead.priority === "media", "Pipeline contacts must expose default priority");
  assert(Number.isFinite(Number(pipelineLead.order)), "Pipeline contacts must expose a numeric order");
  assert(pipelineLead.timeline?.some((item) => item.type === "booking_click"), "Pipeline contacts must expose contact timeline events");

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

  const automaticTodayActions = await adminRequest(baseUrl, `/api/businesses/${businessId}/next-actions?filter=hoy`);
  assert(automaticTodayActions.actions?.some((item) => (
    item.contact?.id === lead.contact.id
      && item.nextAction?.note === "Responder hoy"
  )), "Automatic first response must appear in today's action list");

  const completedAutomaticAction = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/${lead.contact.id}/next-action`, {
    method: "PATCH",
    body: { status: "hecha" }
  });
  assert(completedAutomaticAction.contact?.nextAction === null, "The automatic action must be completable like a manual action");

  const nextAction = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/${lead.contact.id}/next-action`, {
    method: "POST",
    body: {
      type: "llamada",
      dueDate: dateAtLocalNoon(new Date()).toISOString(),
      note: "Llamar hoy"
    },
    expectedStatus: 201
  });
  assert(nextAction.contact?.nextAction?.type === "llamada", "Next action must be stored on the contact");

  const todayActions = await adminRequest(baseUrl, `/api/businesses/${businessId}/next-actions?filter=hoy`);
  assert(todayActions.actions?.some((item) => item.contact?.id === lead.contact.id), "Next action due today must appear in today's list");

  const completedNextAction = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/${lead.contact.id}/next-action`, {
    method: "PATCH",
    body: { status: "hecha" }
  });
  assert(completedNextAction.contact?.nextAction === null, "Completed next action must clear the active nextAction");
  assert(completedNextAction.activity?.type === "next_action.completed", "Completed next action must be archived as an activity");

  const leadTimeline = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/${lead.contact.id}/timeline`);
  assert(leadTimeline.timeline?.some((item) => item.type === "contact.status_changed"), "Contact timeline must include status changes");
  assert(leadTimeline.timeline?.some((item) => item.type === "next_action.completed"), "Contact timeline must include completed next actions");
  assert(leadTimeline.timeline?.some((item) => item.type === "booking_click"), "Contact timeline must include associated business events");

  const todayAfterDone = await adminRequest(baseUrl, `/api/businesses/${businessId}/next-actions?filter=hoy`);
  const overdueAfterDone = await adminRequest(baseUrl, `/api/businesses/${businessId}/next-actions?filter=vencidas`);
  const missingAfterDone = await adminRequest(baseUrl, `/api/businesses/${businessId}/next-actions?filter=sin-accion`);
  assert(!todayAfterDone.actions?.some((item) => item.contact?.id === lead.contact.id), "Completed next action must leave today's list");
  assert(!overdueAfterDone.actions?.some((item) => item.contact?.id === lead.contact.id), "Completed next action must leave overdue list");
  assert(!missingAfterDone.actions?.some((item) => item.contact?.id === lead.contact.id), "Completed next action must not reappear in missing list the same day");

  await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/${lead.contact.id}/next-action`, {
    method: "POST",
    body: {
      type: "email",
      dueDate: dateAtLocalNoon(addDays(new Date(), -1)).toISOString(),
      note: "Email vencido"
    },
    expectedStatus: 201
  });
  const overdueActions = await adminRequest(baseUrl, `/api/businesses/${businessId}/next-actions?filter=vencidas`);
  assert(overdueActions.actions?.some((item) => item.contact?.id === lead.contact.id && item.nextAction?.status === "vencida"), "Past pending next action must appear as overdue");

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

  const completedBooking = await adminRequest(baseUrl, `/api/businesses/${businessId}/bookings/${booking.booking.id}`, {
    method: "PATCH",
    body: { status: "completed" }
  });
  assert(completedBooking.booking?.status === "completed", "Booking status must support completion");
  assert(completedBooking.reviewSuggestion?.type === "review.suggested", "A completed booking must return a review suggestion");
  assert(completedBooking.reviewSuggestion?.bookingId === booking.booking.id, "Review suggestion must reference the completed booking");

  const bookingsAfterCompletion = await adminRequest(baseUrl, `/api/businesses/${businessId}/bookings`);
  const persistedCompletedBooking = bookingsAfterCompletion.bookings?.find((item) => item.id === booking.booking.id);
  assert(persistedCompletedBooking?.status === "completed", "Completed booking must persist its status");
  assert(!Object.prototype.hasOwnProperty.call(persistedCompletedBooking || {}, "reviewSuggestion"), "Review suggestion must remain derived, not persisted");

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

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function dateAtLocalNoon(date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
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
