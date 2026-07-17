import { corsHeaders } from "../lib/cors.mjs";
import { upsertAssociation } from "../lib/association-model.mjs";
import { recordPrivacyAcknowledgement } from "../lib/consent-model.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { buildCompletedBookingReviewSuggestion } from "../lib/crm-automation.mjs";
import { recalculateContactScore } from "../lib/lead-score.mjs";

const MAX_BODY_BYTES = Number(process.env.BOOKING_API_MAX_BODY_BYTES || 512 * 1024);
const BOOKING_STATUSES = new Set(["pending", "confirmed", "canceled", "completed", "no-show"]);
const OPEN_BOOKING_STATUSES = new Set(["pending", "confirmed"]);
const ATTRIBUTION_FIELDS = [
  { key: "utmSource", alias: "utm_source", maxLength: 120 },
  { key: "utmMedium", alias: "utm_medium", maxLength: 120 },
  { key: "utmCampaign", alias: "utm_campaign", maxLength: 240 }
];
const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  contacts: [],
  activities: [],
  services: [],
  bookings: [],
  availability: [],
  bookingBlocks: [],
  bookingReminders: [],
  associations: [],
  consentEvents: [],
  auditLog: []
};

export function isBookingApiRequest(pathname) {
  return /^\/api\/public\/[^/]+\/bookings$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/services(?:\/[^/]+)?$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/bookings(?:\/[^/]+)?(?:\/reminders)?$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/availability$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/blocks(?:\/[^/]+)?$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/reminders$/.test(pathname);
}

export async function handleBookingApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const segments = requestUrl.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    if (segments[0] === "api" && segments[1] === "public" && segments[3] === "bookings" && method === "POST") {
      await createPublicBooking(segments[2], request, response, context);
      return;
    }

    if (segments[0] === "api" && segments[1] === "businesses" && segments[3] === "services") {
      const businessId = segments[2];
      const serviceId = segments[4] || "";

      if (!serviceId && method === "GET") {
        await listServices(businessId, response, context);
        return;
      }

      if (!serviceId && method === "POST") {
        await createService(businessId, request, response, context);
        return;
      }

      if (serviceId && method === "PATCH") {
        await updateService(businessId, serviceId, request, response, context);
        return;
      }
    }

    if (segments[0] === "api" && segments[1] === "businesses" && segments[3] === "bookings") {
      const businessId = segments[2];
      const bookingId = segments[4] || "";

      if (bookingId && segments[5] === "reminders" && method === "POST") {
        await createBookingReminder(businessId, bookingId, request, response, context);
        return;
      }

      if (!bookingId && method === "GET") {
        await listBookings(businessId, requestUrl, response, context);
        return;
      }

      if (!bookingId && method === "POST") {
        await createAdminBooking(businessId, request, response, context);
        return;
      }

      if (bookingId && method === "PATCH") {
        await updateBooking(businessId, bookingId, request, response, context);
        return;
      }
    }

    if (segments[0] === "api" && segments[1] === "businesses" && segments[3] === "availability") {
      const businessId = segments[2];

      if (method === "GET") {
        await listAvailability(businessId, response, context);
        return;
      }

      if (method === "PUT" || method === "PATCH") {
        await saveAvailability(businessId, request, response, context);
        return;
      }
    }

    if (segments[0] === "api" && segments[1] === "businesses" && segments[3] === "blocks") {
      const businessId = segments[2];
      const blockId = segments[4] || "";

      if (!blockId && method === "GET") {
        await listBlocks(businessId, response, context);
        return;
      }

      if (!blockId && method === "POST") {
        await createBlock(businessId, request, response, context);
        return;
      }

      if (blockId && method === "PATCH") {
        await updateBlock(businessId, blockId, request, response, context);
        return;
      }
    }

    if (segments[0] === "api" && segments[1] === "businesses" && segments[3] === "reminders") {
      const businessId = segments[2];

      if (method === "GET") {
        await listDueReminders(businessId, requestUrl, response, context);
        return;
      }

      if (method === "POST") {
        await createDueReminders(businessId, request, response, context);
        return;
      }
    }

    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "GET, POST, PATCH, PUT, OPTIONS" });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status >= 500 ? "Internal booking API error" : error.message;
    sendJson(response, status, { error: message }, context);
  }
}

async function listServices(businessId, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const services = ensureBusinessServices(db, business).sort((a, b) => a.name.localeCompare(b.name));
  sendJson(response, 200, { services, total: services.length }, context);
}

async function createService(businessId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const service = normalizeService(payload, null, business.id, now);

  db.services.push(service);
  appendAudit(db, "service.created", business.id, now, service.id);
  await saveDb(db, context, "service");
  sendJson(response, 201, { service }, context);
}

async function updateService(businessId, serviceId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const index = db.services.findIndex((service) => service.businessId === business.id && service.id === serviceId);

  if (index === -1) {
    throw httpError(404, "Service not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const service = normalizeService(payload, db.services[index], business.id, now);

  db.services[index] = service;
  appendAudit(db, "service.updated", business.id, now, service.id);
  await saveDb(db, context, "service-update");
  sendJson(response, 200, { service }, context);
}

async function listBookings(businessId, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const status = cleanText(requestUrl.searchParams.get("status") || "");
  const from = parseOptionalDate(requestUrl.searchParams.get("from") || requestUrl.searchParams.get("date_from") || "");
  const to = parseOptionalDate(requestUrl.searchParams.get("to") || requestUrl.searchParams.get("date_to") || "");

  let bookings = db.bookings
    .filter((booking) => booking.businessId === business.id)
    .filter((booking) => !status || booking.status === normalizeBookingStatus(status))
    .filter((booking) => !from || new Date(booking.startsAt) >= from)
    .filter((booking) => !to || new Date(booking.startsAt) <= to)
    .map((booking) => withReminderSummary(db, booking))
    .sort((a, b) => String(a.startsAt || "").localeCompare(String(b.startsAt || "")));

  sendJson(response, 200, { bookings, total: bookings.length }, context);
}

async function createPublicBooking(slug, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, slug);

  if (!business || business.status === "archived") {
    throw httpError(404, "Business not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const booking = normalizeBooking(payload, null, business, db, now, {
    status: "pending",
    source: "public-widget"
  });

  ensureBookingIsAvailable(db, booking);
  ensureNoBookingConflict(db, booking);
  db.bookings.push(booking);
  const contact = ensureContactForBooking(db, business.id, booking, now);
  syncBookingAssociation(db, booking, contact, now);
  recordBookingPrivacy(db, business, booking, contact, now);
  db.activities.push(makeActivity(business.id, contact.id, now, {
    type: "booking.created",
    title: "Reserva creada",
    note: `${booking.serviceName} - ${formatIsoForNote(booking.startsAt)}`,
    source: booking.source,
    metadata: { bookingId: booking.id }
  }));
  recalculateContactScore(db, business.id, contact, new Date(now));
  appendAudit(db, "booking.public_created", business.id, now, booking.id);
  await saveDb(db, context, "booking");
  const reviewSuggestion = buildCompletedBookingReviewSuggestion(db, booking, {
    business,
    now
  });
  sendJson(response, 201, { booking, contact, reviewSuggestion }, context);
}

async function createAdminBooking(businessId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const booking = normalizeBooking(payload, null, business, db, now, {
    status: "confirmed",
    source: "dashboard"
  });

  ensureBookingIsAvailable(db, booking);
  ensureNoBookingConflict(db, booking);
  db.bookings.push(booking);
  const contact = ensureContactForBooking(db, business.id, booking, now);
  syncBookingAssociation(db, booking, contact, now);
  recordBookingPrivacy(db, business, booking, contact, now);
  db.activities.push(makeActivity(business.id, contact.id, now, {
    type: "booking.created",
    title: "Reserva creada",
    note: `${booking.serviceName} - ${formatIsoForNote(booking.startsAt)}`,
    source: booking.source,
    metadata: { bookingId: booking.id }
  }));
  recalculateContactScore(db, business.id, contact, new Date(now));
  appendAudit(db, "booking.created", business.id, now, booking.id);
  await saveDb(db, context, "booking");
  const reviewSuggestion = buildCompletedBookingReviewSuggestion(db, booking, {
    business,
    now
  });
  sendJson(response, 201, { booking, contact, reviewSuggestion }, context);
}

async function updateBooking(businessId, bookingId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const index = db.bookings.findIndex((booking) => booking.businessId === business.id && booking.id === bookingId);

  if (index === -1) {
    throw httpError(404, "Booking not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const previousStatus = db.bookings[index].status;
  const booking = normalizeBooking(payload, db.bookings[index], business, db, now, {});

  ensureBookingIsAvailable(db, booking);
  ensureNoBookingConflict(db, booking, booking.id);
  db.bookings[index] = booking;
  const contact = booking.contactId
    ? db.contacts.find((item) => item.businessId === business.id && item.id === booking.contactId && !item.merged)
    : null;
  syncBookingAssociation(db, booking, contact, now);
  appendAudit(db, "booking.updated", business.id, now, booking.id);
  await saveDb(db, context, "booking-update");
  const reviewSuggestion = previousStatus !== "completed"
    ? buildCompletedBookingReviewSuggestion(db, booking, { business, now })
    : null;
  sendJson(response, 200, { booking, reviewSuggestion }, context);
}

async function createBookingReminder(businessId, bookingId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const booking = db.bookings.find((item) => item.businessId === business.id && item.id === bookingId);

  if (!booking) {
    throw httpError(404, "Booking not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const contact = ensureContactForBooking(db, business.id, booking, now);
  const reminder = normalizeReminder(payload, business.id, booking, contact, business, now);

  db.bookingReminders.push(reminder);
  db.activities.push(makeActivity(business.id, contact.id, now, {
    type: "booking.reminder",
    title: "Recordatorio de reserva",
    note: reminder.message,
    source: reminder.source,
    metadata: { bookingId: booking.id, reminderId: reminder.id, channel: reminder.channel }
  }));
  recalculateContactScore(db, business.id, contact, new Date(now));

  booking.lastReminderAt = now;
  booking.reminderCount = getBookingReminders(db, booking.id).length;
  booking.updatedAt = now;
  appendAudit(db, "booking.reminder_created", business.id, now, reminder.id);
  await saveDb(db, context, "booking-reminder");
  sendJson(response, 201, {
    reminder,
    booking: withReminderSummary(db, booking),
    contact,
    actions: buildReminderActions(reminder, booking, contact)
  }, context);
}

async function listAvailability(businessId, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const availability = getBusinessAvailability(db, business.id);
  sendJson(response, 200, { availability, total: availability.length }, context);
}

async function saveAvailability(businessId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const availability = normalizeAvailabilitySet(payload, business.id, now);

  db.availability = db.availability.filter((rule) => rule.businessId !== business.id).concat(availability);
  appendAudit(db, "availability.updated", business.id, now, business.id);
  await saveDb(db, context, "availability");
  sendJson(response, 200, { availability: getBusinessAvailability(db, business.id), total: availability.length }, context);
}

async function listBlocks(businessId, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const blocks = getBusinessBlocks(db, business.id);
  sendJson(response, 200, { blocks, total: blocks.length }, context);
}

async function createBlock(businessId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const block = normalizeBlock(payload, null, business.id, now);

  db.bookingBlocks.push(block);
  appendAudit(db, "booking_block.created", business.id, now, block.id);
  await saveDb(db, context, "booking-block");
  sendJson(response, 201, { block }, context);
}

async function updateBlock(businessId, blockId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const index = db.bookingBlocks.findIndex((block) => block.businessId === business.id && block.id === blockId);

  if (index === -1) {
    throw httpError(404, "Block not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const block = normalizeBlock(payload, db.bookingBlocks[index], business.id, now);

  db.bookingBlocks[index] = block;
  appendAudit(db, "booking_block.updated", business.id, now, block.id);
  await saveDb(db, context, "booking-block-update");
  sendJson(response, 200, { block }, context);
}

async function listDueReminders(businessId, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const hours = clampNumber(requestUrl.searchParams.get("hours") || 24, 1, 168);
  const now = new Date();
  const candidates = getDueReminderCandidates(db, business, now, hours);

  sendJson(response, 200, {
    reminders: candidates,
    total: candidates.length,
    windowHours: hours,
    mode: "dry-run"
  }, context);
}

async function createDueReminders(businessId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const payload = await readJsonBody(request);
  const source = extractPayload(payload, "reminders");
  const hours = clampNumber(source.hours || source.windowHours || 24, 1, 168);
  const limit = clampNumber(source.limit || 25, 1, 100);
  const now = new Date();
  const nowIso = now.toISOString();
  const candidates = getDueReminderCandidates(db, business, now, hours).slice(0, limit);
  const created = [];

  for (const candidate of candidates) {
    const booking = db.bookings.find((item) => item.id === candidate.booking.id && item.businessId === business.id);

    if (!booking) {
      continue;
    }

    const contact = ensureContactForBooking(db, business.id, booking, nowIso);
    const reminder = normalizeReminder({
      channel: candidate.channel,
      message: candidate.message,
      source: "automatic-dry-run"
    }, business.id, booking, contact, business, nowIso);

    db.bookingReminders.push(reminder);
    db.activities.push(makeActivity(business.id, contact.id, nowIso, {
      type: "booking.reminder",
      title: "Recordatorio automatico preparado",
      note: reminder.message,
      source: reminder.source,
      metadata: { bookingId: booking.id, reminderId: reminder.id, channel: reminder.channel }
    }));
    recalculateContactScore(db, business.id, contact, new Date(nowIso));
    booking.lastReminderAt = nowIso;
    booking.reminderCount = getBookingReminders(db, booking.id).length;
    booking.updatedAt = nowIso;
    created.push({
      reminder,
      booking: withReminderSummary(db, booking),
      contact,
      actions: buildReminderActions(reminder, booking, contact)
    });
  }

  appendAudit(db, "booking.reminders_dry_run", business.id, nowIso, business.id);
  await saveDb(db, context, "booking-reminders-dry-run");
  sendJson(response, 201, {
    reminders: created,
    total: created.length,
    windowHours: hours,
    mode: "dry-run"
  }, context);
}

function normalizeService(payload, existing, businessId, now) {
  const source = extractPayload(payload, "service");
  const name = cleanText(source.name || source.title || existing?.name || "", 160);

  if (!name) {
    throw httpError(400, "Service name is required");
  }

  const durationMinutes = clampNumber(source.durationMinutes ?? source.duration ?? existing?.durationMinutes ?? 60, 10, 480);

  return {
    id: existing?.id || cleanId(source.id) || `svc_${slugify(name) || Date.now().toString(36)}`,
    businessId,
    name,
    durationMinutes,
    price: Math.max(0, roundMoney(source.price ?? existing?.price ?? 0)),
    description: cleanText(source.description || existing?.description || "", 800),
    active: source.active ?? existing?.active ?? true,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeBooking(payload, existing, business, db, now, defaults) {
  const source = extractPayload(payload, "booking");
  const services = ensureBusinessServices(db, business);
  const service = services.find((item) => item.id === cleanText(source.serviceId || existing?.serviceId || ""))
    || services.find((item) => item.name.toLowerCase() === cleanText(source.serviceName || source.service || "").toLowerCase())
    || services[0];

  if (!service) {
    throw httpError(400, "A service is required before creating bookings");
  }

  const startsAt = parseRequiredDate(source.startsAt || source.date || existing?.startsAt, "Booking startsAt is required");
  const durationMinutes = clampNumber(source.durationMinutes ?? existing?.durationMinutes ?? service.durationMinutes ?? 60, 10, 480);
  const endsAt = source.endsAt
    ? parseRequiredDate(source.endsAt, "Booking endsAt is invalid")
    : new Date(startsAt.getTime() + durationMinutes * 60000);

  if (endsAt <= startsAt) {
    throw httpError(400, "Booking end must be after start");
  }

  const contactText = cleanText(source.contact || "", 320);
  const contactEmail = extractEmail(contactText);
  const phone = cleanText(source.phone || (contactEmail ? "" : contactText) || existing?.phone || "", 80);
  const email = cleanText(source.email || contactEmail || existing?.email || "", 320);
  const attribution = normalizeFirstTouchAttribution(source, existing);

  return {
    id: existing?.id || cleanId(source.id) || `book_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    businessId: business.id,
    contactId: cleanId(existing?.contactId || ""),
    serviceId: service.id,
    serviceName: service.name,
    durationMinutes,
    customerName: cleanText(source.customerName || source.name || existing?.customerName || "Cliente sin nombre", 160),
    phone,
    email,
    notes: cleanText(source.notes || source.message || existing?.notes || "", 1600),
    ...attribution,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    status: normalizeBookingStatus(source.status || existing?.status || defaults.status || "pending"),
    source: cleanText(source.source || existing?.source || defaults.source || "dashboard", 80),
    privacyAccepted: normalizeBoolean(source.privacyAccepted, existing?.privacyAccepted ?? false),
    privacyAcceptedAt: cleanText(source.privacyAcceptedAt || existing?.privacyAcceptedAt || "", 80),
    privacyPolicyUrl: cleanText(source.privacyPolicyUrl || existing?.privacyPolicyUrl || "", 500),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeAvailabilitySet(payload, businessId, now) {
  return extractArrayPayload(payload, ["availability", "rules", "slots"])
    .map((item, index) => normalizeAvailabilityRule(item, businessId, now, index));
}

function normalizeAvailabilityRule(source, businessId, now, index) {
  if (!isPlainObject(source)) {
    throw httpError(400, "Availability entries must be objects");
  }

  const weekday = normalizeWeekday(source.weekday ?? source.day);
  const startTime = normalizeTimeString(source.startTime || source.start || source.from);
  const endTime = normalizeTimeString(source.endTime || source.end || source.to);

  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    throw httpError(400, "Availability endTime must be after startTime");
  }

  return {
    id: cleanId(source.id) || `av_${businessId}_${weekday}_${startTime.replace(":", "")}_${endTime.replace(":", "")}_${index + 1}`,
    businessId,
    weekday,
    startTime,
    endTime,
    active: normalizeBoolean(source.active, true),
    createdAt: cleanText(source.createdAt || "") || now,
    updatedAt: now
  };
}

function normalizeBlock(payload, existing, businessId, now) {
  const source = extractPayload(payload, "block");
  const startsAt = parseRequiredDate(source.startsAt || source.start || existing?.startsAt, "Block startsAt is required");
  const endsAt = parseRequiredDate(source.endsAt || source.end || existing?.endsAt, "Block endsAt is required");

  if (endsAt <= startsAt) {
    throw httpError(400, "Block end must be after start");
  }

  return {
    id: existing?.id || cleanId(source.id) || `block_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    businessId,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    reason: cleanText(source.reason || source.note || existing?.reason || "Bloqueo manual", 300),
    active: normalizeBoolean(source.active, existing?.active ?? true),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeReminder(payload, businessId, booking, contact, business, now) {
  const source = extractPayload(payload, "reminder");
  const channel = normalizeReminderChannel(source.channel || preferredReminderChannel(booking, contact));
  const message = cleanText(source.message || makeReminderMessage(business, booking), 1200);

  if (!message) {
    throw httpError(400, "Reminder message is required");
  }

  return {
    id: cleanId(source.id) || `rem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    businessId,
    bookingId: booking.id,
    contactId: contact.id,
    channel,
    message,
    status: "ready",
    source: cleanText(source.source || "dashboard", 80),
    createdAt: now,
    updatedAt: now
  };
}

function ensureBusinessServices(db, business) {
  db.services = Array.isArray(db.services) ? db.services : [];
  const current = db.services.filter((service) => service.businessId === business.id);

  if (current.length) {
    return current;
  }

  const now = new Date().toISOString();
  const contentServices = Array.isArray(business.content?.services) ? business.content.services : [];
  const generated = contentServices.slice(0, 6).map((item, index) => {
    const name = cleanText(String(item).split(":")[0] || item || `Servicio ${index + 1}`, 160);
    return normalizeService({
      id: `svc_${slugify(name) || index + 1}`,
      name,
      durationMinutes: 60,
      price: 0,
      description: cleanText(item, 800),
      active: true
    }, null, business.id, now);
  });

  if (generated.length) {
    db.services.push(...generated);
  }

  return generated;
}

function ensureBookingIsAvailable(db, booking) {
  if (!OPEN_BOOKING_STATUSES.has(booking.status)) {
    return;
  }

  const start = new Date(booking.startsAt);
  const end = new Date(booking.endsAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw httpError(400, "Booking dates are invalid");
  }

  ensureBookingMatchesWeeklyAvailability(db, booking, start, end);
  ensureBookingDoesNotHitBlock(db, booking, start, end);
}

function ensureBookingMatchesWeeklyAvailability(db, booking, start, end) {
  const rules = getBusinessAvailability(db, booking.businessId).filter((rule) => rule.active !== false);

  if (!rules.length) {
    return;
  }

  if (!sameLocalDate(start, end)) {
    throw httpError(409, "Booking outside availability");
  }

  const weekday = start.getDay();
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const isAllowed = rules.some((rule) => (
    Number(rule.weekday) === weekday
      && startMinutes >= timeToMinutes(rule.startTime)
      && endMinutes <= timeToMinutes(rule.endTime)
  ));

  if (!isAllowed) {
    throw httpError(409, "Booking outside availability");
  }
}

function ensureBookingDoesNotHitBlock(db, booking, start, end) {
  const blocks = getBusinessBlocks(db, booking.businessId).filter((block) => block.active !== false);
  const conflict = blocks.find((block) => intervalsOverlap(
    start.getTime(),
    end.getTime(),
    new Date(block.startsAt).getTime(),
    new Date(block.endsAt).getTime()
  ));

  if (conflict) {
    throw httpError(409, "Booking slot blocked");
  }
}

function ensureNoBookingConflict(db, booking, ignoredBookingId = "") {
  if (!OPEN_BOOKING_STATUSES.has(booking.status)) {
    return;
  }

  const start = new Date(booking.startsAt).getTime();
  const end = new Date(booking.endsAt).getTime();
  const conflict = db.bookings.find((item) => {
    if (item.businessId !== booking.businessId || item.id === ignoredBookingId || !OPEN_BOOKING_STATUSES.has(item.status)) {
      return false;
    }

    const itemStart = new Date(item.startsAt).getTime();
    const itemEnd = new Date(item.endsAt).getTime();
    return intervalsOverlap(start, end, itemStart, itemEnd);
  });

  if (conflict) {
    throw httpError(409, "Booking slot already taken");
  }
}

function getBusinessAvailability(db, businessId) {
  db.availability = Array.isArray(db.availability) ? db.availability : [];
  return db.availability
    .filter((rule) => rule.businessId === businessId)
    .sort((a, b) => Number(a.weekday) - Number(b.weekday) || String(a.startTime).localeCompare(String(b.startTime)));
}

function getBusinessBlocks(db, businessId) {
  db.bookingBlocks = Array.isArray(db.bookingBlocks) ? db.bookingBlocks : [];
  return db.bookingBlocks
    .filter((block) => block.businessId === businessId)
    .sort((a, b) => String(a.startsAt || "").localeCompare(String(b.startsAt || "")));
}

function getBookingReminders(db, bookingId) {
  db.bookingReminders = Array.isArray(db.bookingReminders) ? db.bookingReminders : [];
  return db.bookingReminders
    .filter((reminder) => reminder.bookingId === bookingId)
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}

function withReminderSummary(db, booking) {
  const reminders = getBookingReminders(db, booking.id);
  const lastReminder = reminders[reminders.length - 1] || null;

  return {
    ...booking,
    reminderCount: reminders.length,
    lastReminderAt: lastReminder?.createdAt || booking.lastReminderAt || "",
    lastReminderChannel: lastReminder?.channel || booking.lastReminderChannel || ""
  };
}

function getDueReminderCandidates(db, business, now, hours) {
  const until = new Date(now.getTime() + hours * 60 * 60 * 1000);

  return db.bookings
    .filter((booking) => booking.businessId === business.id)
    .filter((booking) => OPEN_BOOKING_STATUSES.has(booking.status))
    .filter((booking) => {
      const startsAt = new Date(booking.startsAt || "");
      return !Number.isNaN(startsAt.getTime()) && startsAt >= now && startsAt <= until;
    })
    .filter((booking) => !getBookingReminders(db, booking.id).length)
    .sort((a, b) => String(a.startsAt || "").localeCompare(String(b.startsAt || "")))
    .map((booking) => {
      const contact = findContactForBooking(db, business.id, booking) || contactPreviewForBooking(booking);
      const channel = preferredReminderChannel(booking, contact);
      const message = makeReminderMessage(business, booking);
      const reminder = {
        booking: withReminderSummary(db, booking),
        contact,
        channel,
        message,
        actions: buildReminderActions({ channel, message }, booking, contact)
      };

      return reminder;
    });
}

function ensureContactForBooking(db, businessId, booking, now) {
  db.contacts = Array.isArray(db.contacts) ? db.contacts : [];
  const email = booking.email || extractEmail(booking.phone);
  const phone = booking.phone || "";
  let contact = findContactForBooking(db, businessId, booking);

  if (!contact) {
    contact = {
      id: `contact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      businessId,
      type: "lead",
      name: booking.customerName,
      phone,
      email,
      source: "booking",
      ...normalizeAttribution(booking),
      status: "reserved",
      tags: ["reserva"],
      notes: booking.notes,
      valueEstimate: 0,
      privacyAccepted: booking.privacyAccepted,
      privacyAcceptedAt: booking.privacyAcceptedAt,
      privacyPolicyUrl: booking.privacyPolicyUrl,
      lastInteractionAt: now,
      createdAt: now,
      updatedAt: now
    };
    db.contacts.push(contact);
    booking.contactId = contact.id;
    return contact;
  }

  contact.name = contact.name || booking.customerName;
  contact.phone = contact.phone || phone;
  contact.email = contact.email || email;
  contact.status = contact.status === "new" ? "reserved" : contact.status;
  contact.privacyAccepted = contact.privacyAccepted || booking.privacyAccepted;
  contact.privacyAcceptedAt = contact.privacyAcceptedAt || booking.privacyAcceptedAt;
  contact.privacyPolicyUrl = contact.privacyPolicyUrl || booking.privacyPolicyUrl;
  Object.assign(contact, normalizeFirstTouchAttribution(booking, contact));
  contact.lastInteractionAt = now;
  contact.updatedAt = now;
  contact.tags = Array.from(new Set([...(Array.isArray(contact.tags) ? contact.tags : []), "reserva"])).slice(0, 12);
  booking.contactId = contact.id;
  return contact;
}

function syncBookingAssociation(db, booking, contact, now) {
  if (!contact) return;
  upsertAssociation(db, {
    businessId: booking.businessId,
    fromType: "contact",
    fromId: contact.id,
    toType: "booking",
    toId: booking.id,
    kind: "customer",
    isPrimary: true,
    now
  });
}

function recordBookingPrivacy(db, business, booking, contact, now) {
  if (!booking.privacyAccepted || !contact) return null;
  return recordPrivacyAcknowledgement(db, {
    businessId: business.id,
    contactId: contact.id,
    source: booking.source || "booking",
    occurredAt: booking.privacyAcceptedAt || now,
    policyUrl: booking.privacyPolicyUrl || "",
    actorType: "contact",
    actorId: contact.id,
    evidence: { recordType: "booking", recordId: booking.id }
  });
}

function findContactForBooking(db, businessId, booking) {
  db.contacts = Array.isArray(db.contacts) ? db.contacts : [];
  const directContactId = cleanId(booking.contactId || "");
  const directContact = directContactId
    ? db.contacts.find((item) => item.businessId === businessId && item.id === directContactId && !item.merged)
    : null;

  if (directContact) {
    return directContact;
  }

  const email = normalizeEmail(booking.email || extractEmail(booking.phone));
  const phone = cleanPhone(booking.phone || "");
  return db.contacts.find((item) => item.businessId === businessId && !item.merged && (
    (email && normalizeEmail(item.email) === email) || (phone && cleanPhone(item.phone) === phone)
  ));
}

function contactPreviewForBooking(booking) {
  return {
    id: "",
    name: booking.customerName,
    phone: booking.phone || "",
    email: booking.email || ""
  };
}

function makeActivity(businessId, contactId, now, source) {
  return {
    id: `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    businessId,
    contactId,
    type: cleanText(source.type || "booking.created", 80),
    title: cleanText(source.title || "Reserva creada", 160),
    note: cleanText(source.note || "", 4000),
    source: cleanText(source.source || "booking", 80),
    metadata: isPlainObject(source.metadata) ? source.metadata : {},
    createdAt: now
  };
}

async function loadDb(context) {
  const db = await loadBusinessStore(context, DEFAULT_DB);

  db.version = Number(db.version || 1);
  db.businesses = Array.isArray(db.businesses) ? db.businesses : [];
  db.contacts = Array.isArray(db.contacts) ? db.contacts : [];
  db.activities = Array.isArray(db.activities) ? db.activities : [];
  db.services = Array.isArray(db.services) ? db.services : [];
  db.bookings = Array.isArray(db.bookings) ? db.bookings : [];
  db.availability = Array.isArray(db.availability) ? db.availability : [];
  db.bookingBlocks = Array.isArray(db.bookingBlocks) ? db.bookingBlocks : [];
  db.bookingReminders = Array.isArray(db.bookingReminders) ? db.bookingReminders : [];
  db.associations = Array.isArray(db.associations) ? db.associations : [];
  db.consentEvents = Array.isArray(db.consentEvents) ? db.consentEvents : [];
  db.auditLog = Array.isArray(db.auditLog) ? db.auditLog : [];
  return db;
}

async function saveDb(db, context, backupLabel) {
  await saveBusinessStore(db, context, backupLabel);
}

async function readJsonBody(request) {
  let size = 0;
  let raw = "";

  for await (const chunk of request) {
    size += chunk.length;

    if (size > MAX_BODY_BYTES) {
      throw httpError(413, "JSON body is too large");
    }

    raw += chunk;
  }

  if (!raw.trim()) {
    throw httpError(400, "JSON body is required");
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw httpError(400, "Invalid JSON body");
  }
}

function findBusiness(db, id) {
  return db.businesses.find((business) => business.id === id || business.slug === id);
}

function extractPayload(payload, key) {
  if (!isPlainObject(payload)) {
    throw httpError(400, "JSON body must be an object");
  }

  if (isPlainObject(payload[key])) {
    return payload[key];
  }

  return payload;
}

function extractArrayPayload(payload, keys) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!isPlainObject(payload)) {
    throw httpError(400, "JSON body must be an object");
  }

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return payload[key];
    }
  }

  return [];
}

function normalizeBookingStatus(value) {
  const status = cleanText(value, 80).toLowerCase();
  const aliases = {
    confirmado: "confirmed",
    confirmada: "confirmed",
    pendiente: "pending",
    cancelado: "canceled",
    cancelada: "canceled",
    completado: "completed",
    completada: "completed",
    no_show: "no-show"
  };
  const normalized = aliases[status] || status || "pending";

  if (!BOOKING_STATUSES.has(normalized)) {
    throw httpError(400, `Invalid booking status: ${normalized}`);
  }

  return normalized;
}

function normalizeReminderChannel(value) {
  const channel = cleanText(value, 40).toLowerCase();
  const aliases = {
    whatsapp: "whatsapp",
    wa: "whatsapp",
    email: "email",
    mail: "email",
    phone: "phone",
    telefono: "phone",
    manual: "manual"
  };

  return aliases[channel] || "manual";
}

function preferredReminderChannel(booking, contact) {
  if (cleanPhone(booking.phone || contact.phone || "").length >= 6) {
    return "whatsapp";
  }

  if (booking.email || contact.email) {
    return "email";
  }

  return "manual";
}

function normalizeWeekday(value) {
  const aliases = {
    sunday: 0,
    domingo: 0,
    dom: 0,
    monday: 1,
    lunes: 1,
    lun: 1,
    tuesday: 2,
    martes: 2,
    mar: 2,
    wednesday: 3,
    miercoles: 3,
    mie: 3,
    thursday: 4,
    jueves: 4,
    jue: 4,
    friday: 5,
    viernes: 5,
    vie: 5,
    saturday: 6,
    sabado: 6,
    sab: 6
  };
  const text = cleanText(value, 40).toLowerCase();
  const numeric = Number(text);
  const weekday = Number.isInteger(numeric) ? numeric : aliases[text];

  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    throw httpError(400, "Availability weekday must be between 0 and 6");
  }

  return weekday;
}

function normalizeTimeString(value) {
  const match = cleanText(value, 20).match(/^(\d{1,2}):(\d{2})/);

  if (!match) {
    throw httpError(400, "Availability time must use HH:MM format");
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw httpError(400, "Availability time is invalid");
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function timeToMinutes(value) {
  const [hours, minutes] = normalizeTimeString(value).split(":").map(Number);
  return hours * 60 + minutes;
}

function normalizeBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const text = cleanText(value, 20).toLowerCase();

  if (["true", "1", "yes", "y", "on", "si"].includes(text)) {
    return true;
  }

  if (["false", "0", "no", "n", "off"].includes(text)) {
    return false;
  }

  return fallback;
}

function parseRequiredDate(value, message) {
  const date = new Date(value || "");

  if (!value || Number.isNaN(date.getTime())) {
    throw httpError(400, message);
  }

  return date;
}

function parseOptionalDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameLocalDate(left, right) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function intervalsOverlap(startA, endA, startB, endB) {
  return [startA, endA, startB, endB].every(Number.isFinite)
    && startA < endB
    && endA > startB;
}

function appendAudit(db, type, businessId, now, subjectId) {
  db.auditLog.push({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    businessId,
    subjectId,
    createdAt: now
  });
}

function sendJson(response, status, payload, context, extraHeaders = {}) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendEmpty(response, status, context) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    Allow: "GET, POST, PATCH, PUT, OPTIONS"
  });
  response.end();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanText(value, maxLength = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeAttribution(source = {}) {
  return Object.fromEntries(ATTRIBUTION_FIELDS.map((field) => [
    field.key,
    readAttributionValue(source, field)
  ]));
}

function normalizeFirstTouchAttribution(source = {}, existing = {}) {
  return Object.fromEntries(ATTRIBUTION_FIELDS.map((field) => [
    field.key,
    readAttributionValue(existing, field) || readAttributionValue(source, field)
  ]));
}

function readAttributionValue(source, field) {
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return "";
  }

  return normalizeAttributionValue(source[field.key], field.maxLength)
    || normalizeAttributionValue(source[field.alias], field.maxLength);
}

function normalizeAttributionValue(value, maxLength) {
  if (typeof value !== "string" && typeof value !== "number") {
    return "";
  }

  return cleanText(value, maxLength);
}

function cleanId(value) {
  return cleanText(value, 80).replace(/[^a-z0-9_-]/gi, "_").replace(/^_+|_+$/g, "");
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function clampNumber(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(number)));
}

function roundMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

function extractEmail(value) {
  return String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}

function normalizeEmail(value) {
  return extractEmail(value).toLowerCase();
}

function formatIsoForNote(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? String(value || "") : date.toISOString();
}

function makeReminderMessage(business, booking) {
  const date = new Date(booking.startsAt || "");
  const formattedDate = Number.isNaN(date.getTime())
    ? cleanText(booking.startsAt || "")
    : date.toLocaleString("es-ES", {
      weekday: "long",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });

  return `Hola ${booking.customerName || "cliente"}, te recordamos tu reserva en ${business.name} para ${formattedDate}. Servicio: ${booking.serviceName}. Si necesitas cambiarla, responde a este mensaje.`;
}

function buildReminderActions(reminder, booking, contact) {
  const phone = cleanPhone(booking.phone || contact.phone || "");
  const email = booking.email || contact.email || "";
  const encodedMessage = encodeURIComponent(reminder.message);

  return {
    whatsappUrl: phone ? `https://wa.me/${phone}?text=${encodedMessage}` : "",
    mailtoUrl: email ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent("Recordatorio de reserva")}&body=${encodedMessage}` : "",
    copyText: reminder.message
  };
}

function cleanPhone(value) {
  return cleanText(value, 80).replace(/[^\d+]/g, "").replace(/^\+/, "");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
