import { corsHeaders } from "../lib/cors.mjs";
import { getRequestClientSession } from "../lib/client-auth.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { createBookingCheckoutSession, verifyBookingPaymentWebhook } from "../lib/booking-payment-provider.mjs";
import {
  acceptWaitlistOffer,
  applyBookingCheckoutProviderResult,
  bookingResourceSummary,
  completeBookingCheckout,
  createBookingCheckoutRecord,
  createWaitlistEntry,
  ensureBookingResourceCollections,
  getResourceAvailability,
  normalizeBookingResource,
  normalizeResourceException,
  offerWaitlistSlot,
  replaceResourceSchedule,
  resolveWaitlistOffer,
  updateWaitlistEntry
} from "../lib/booking-resources.mjs";

const MAX_BODY_BYTES = Number(process.env.BOOKING_RESOURCE_API_MAX_BODY_BYTES || 512 * 1024);

export function isBookingResourceApiRequest(pathname) {
  return pathname === "/api/webhooks/stripe/bookings"
    || /^\/api\/public\/waitlist-offers\/[^/]+(?:\/accept)?$/.test(pathname)
    || /^\/api\/public\/[^/]+\/(?:resource-availability|waitlist)$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/(?:resources(?:\/[^/]+)?(?:\/(?:schedule|exceptions)(?:\/[^/]+)?)?|resource-availability|booking-resource-summary|waitlist(?:\/[^/]+)?(?:\/offer)?|bookings\/[^/]+\/deposit-checkout)$/.test(pathname);
}

export async function handleBookingResourceApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context, "GET, POST, PATCH, PUT, DELETE, OPTIONS");
  try {
    if (requestUrl.pathname === "/api/webhooks/stripe/bookings") return await handlePaymentWebhook(request, response, context);
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (segments[1] === "public") return await handlePublic({ request, response, context, method, requestUrl, segments });
    return await handleAdmin({ request, response, context, method, requestUrl, segments });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, { error: status >= 500 && process.env.NODE_ENV !== "test" ? "Internal booking resource API error" : error.message, code: error.code || "booking_resource_error" }, context, error.allow ? { Allow: error.allow } : {});
  }
}

async function handleAdmin({ request, response, context, method, requestUrl, segments }) {
  const businessRef = segments[2] || "";
  const section = segments[3] || "";
  const resourceId = segments[4] || "";
  const action = segments[5] || "";
  const childId = segments[6] || "";
  const db = ensureBookingResourceCollections(await loadBusinessStore(context));
  const business = requireBusiness(db, businessRef);
  const clientSession = getRequestClientSession(request);
  if (clientSession && clientSession.businessId !== business.id) throw apiError(403, "Client session cannot access this business");
  const readOnly = Boolean(clientSession);
  const now = new Date().toISOString();

  if (section === "resources") {
    if (!resourceId && method === "GET") {
      const resources = db.bookingResources.filter((item) => item.businessId === business.id).map((item) => decorateResource(db, item));
      return sendJson(response, 200, { resources, total: resources.length, summary: bookingResourceSummary(db, business.id) }, context);
    }
    if (!resourceId && method === "POST") {
      requireMutationAccess(readOnly);
      const resource = normalizeBookingResource(await readJsonBody(request), null, business.id, now);
      db.bookingResources.push(resource); audit(db, business.id, "booking_resource.created", resource.id, now);
      await saveBusinessStore(db, context, "booking-resource-create");
      return sendJson(response, 201, { resource: decorateResource(db, resource), summary: bookingResourceSummary(db, business.id) }, context);
    }
    const resource = requireResource(db, business.id, resourceId);
    if (!action && method === "GET") return sendJson(response, 200, { resource: decorateResource(db, resource) }, context);
    if (!action && method === "PATCH") {
      requireMutationAccess(readOnly);
      const updated = normalizeBookingResource(await readJsonBody(request), resource, business.id, now);
      Object.assign(resource, updated); audit(db, business.id, "booking_resource.updated", resource.id, now);
      await saveBusinessStore(db, context, "booking-resource-update");
      return sendJson(response, 200, { resource: decorateResource(db, resource) }, context);
    }
    if (!action && method === "DELETE") {
      requireMutationAccess(readOnly);
      resource.active = false; resource.updatedAt = now; audit(db, business.id, "booking_resource.archived", resource.id, now);
      await saveBusinessStore(db, context, "booking-resource-archive");
      return sendJson(response, 200, { resource: decorateResource(db, resource) }, context);
    }
    if (action === "schedule") {
      if (method === "GET") return sendJson(response, 200, { schedule: resourceSchedule(db, resource.id) }, context);
      if (method === "PUT" || method === "PATCH") {
        requireMutationAccess(readOnly);
        const schedule = replaceResourceSchedule(db, resource, await readJsonBody(request), now); audit(db, business.id, "booking_resource.schedule_updated", resource.id, now);
        await saveBusinessStore(db, context, "booking-resource-schedule");
        return sendJson(response, 200, { schedule, resource: decorateResource(db, resource) }, context);
      }
    }
    if (action === "exceptions") {
      if (!childId && method === "GET") return sendJson(response, 200, { exceptions: resourceExceptions(db, resource.id) }, context);
      if (!childId && method === "POST") {
        requireMutationAccess(readOnly);
        const exception = normalizeResourceException(await readJsonBody(request), null, resource, now); db.bookingResourceExceptions.push(exception); audit(db, business.id, "booking_resource.exception_created", exception.id, now);
        await saveBusinessStore(db, context, "booking-resource-exception");
        return sendJson(response, 201, { exception, resource: decorateResource(db, resource) }, context);
      }
      const exception = db.bookingResourceExceptions.find((item) => item.businessId === business.id && item.resourceId === resource.id && item.id === childId);
      if (!exception) throw apiError(404, "Resource exception not found");
      if (method === "PATCH") {
        requireMutationAccess(readOnly);
        Object.assign(exception, normalizeResourceException(await readJsonBody(request), exception, resource, now)); audit(db, business.id, "booking_resource.exception_updated", exception.id, now);
        await saveBusinessStore(db, context, "booking-resource-exception-update"); return sendJson(response, 200, { exception }, context);
      }
      if (method === "DELETE") {
        requireMutationAccess(readOnly);
        exception.active = false; exception.updatedAt = now; audit(db, business.id, "booking_resource.exception_archived", exception.id, now);
        await saveBusinessStore(db, context, "booking-resource-exception-archive"); return sendJson(response, 200, { exception }, context);
      }
    }
    throw methodNotAllowed("GET, POST, PATCH, PUT, DELETE, OPTIONS");
  }

  if (section === "resource-availability" && method === "GET") {
    const availability = getResourceAvailability(db, business.id, Object.fromEntries(requestUrl.searchParams));
    return sendJson(response, 200, { availability }, context);
  }
  if (section === "booking-resource-summary" && method === "GET") return sendJson(response, 200, { summary: bookingResourceSummary(db, business.id) }, context);

  if (section === "waitlist") {
    if (!resourceId && method === "GET") {
      const status = clean(requestUrl.searchParams.get("status"));
      const entries = db.bookingWaitlist.filter((item) => item.businessId === business.id && (!status || item.status === status)).sort(waitlistSort);
      return sendJson(response, 200, { entries, total: entries.length, summary: bookingResourceSummary(db, business.id) }, context);
    }
    if (!resourceId && method === "POST") {
      requireMutationAccess(readOnly);
      const entry = createWaitlistEntry(db, business, await readJsonBody(request), now); audit(db, business.id, "booking_waitlist.created", entry.id, now);
      await saveBusinessStore(db, context, "booking-waitlist-create"); return sendJson(response, 201, { entry }, context);
    }
    if (resourceId === "offer" && method === "POST") {
      requireMutationAccess(readOnly);
      const result = offerWaitlistSlot(db, business, await readJsonBody(request), now); audit(db, business.id, "booking_waitlist.offered", result.entry.id, now);
      await saveBusinessStore(db, context, "booking-waitlist-offer");
      const base = requestBaseUrl(request); return sendJson(response, 201, { ...result, publicUrl: `${base}/api/public/waitlist-offers/${encodeURIComponent(result.token)}` }, context);
    }
    if (method === "PATCH") {
      requireMutationAccess(readOnly);
      const entry = updateWaitlistEntry(db, business.id, resourceId, await readJsonBody(request), now); audit(db, business.id, "booking_waitlist.updated", entry.id, now);
      await saveBusinessStore(db, context, "booking-waitlist-update"); return sendJson(response, 200, { entry }, context);
    }
    throw methodNotAllowed("GET, POST, PATCH, OPTIONS");
  }

  if (section === "bookings" && action === "deposit-checkout" && method === "POST") {
    requireMutationAccess(readOnly);
    const booking = db.bookings.find((item) => item.businessId === business.id && item.id === resourceId);
    if (!booking) throw apiError(404, "Booking not found");
    const source = await readJsonBody(request);
    const record = createBookingCheckoutRecord(db, business, booking, { ...source, idempotencyKey: source.idempotencyKey || request.headers["idempotency-key"] }, now);
    if (!record.checkout.checkoutUrl) {
      const base = requestBaseUrl(request); const returnUrl = clean(source.returnUrl) || `${base}/pages/dashboard.html?tab=bookings`;
      const provider = await createBookingCheckoutSession({ checkoutId: record.checkout.id, bookingId: booking.id, businessId: business.id, amount: record.checkout.amount, currency: record.checkout.currency, name: `Señal · ${booking.serviceName}`, description: `${booking.customerName} · ${booking.startsAt}`, customerEmail: booking.email, successUrl: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}booking_payment=success`, cancelUrl: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}booking_payment=cancelled`, idempotencyKey: record.checkout.idempotencyKey });
      applyBookingCheckoutProviderResult(db, record.checkout.id, provider, now);
    }
    audit(db, business.id, "booking.deposit_checkout_created", booking.id, now); await saveBusinessStore(db, context, "booking-deposit-checkout");
    return sendJson(response, record.duplicate ? 200 : 201, { checkout: record.checkout, duplicate: record.duplicate, booking }, context);
  }
  throw apiError(404, "Booking resource route not found");
}

async function handlePublic({ request, response, context, method, requestUrl, segments }) {
  const db = ensureBookingResourceCollections(await loadBusinessStore(context));
  const now = new Date().toISOString();
  if (segments[2] === "waitlist-offers") {
    const token = segments[3] || ""; const action = segments[4] || ""; const resolved = resolveWaitlistOffer(db, token, now);
    if (!action && method === "GET") return sendJson(response, 200, { offer: publicOffer(resolved.offer), entry: publicWaitlistEntry(resolved.entry) }, context);
    if (action === "accept" && method === "POST") { const result = acceptWaitlistOffer(db, token, now); await saveBusinessStore(db, context, "booking-waitlist-accept"); return sendJson(response, 200, result, context); }
    throw methodNotAllowed("GET, POST, OPTIONS");
  }
  const business = requireBusiness(db, segments[2] || ""); const section = segments[3] || "";
  if (section === "resource-availability" && method === "GET") return sendJson(response, 200, { availability: getResourceAvailability(db, business.id, Object.fromEntries(requestUrl.searchParams)) }, context);
  if (section === "waitlist" && method === "POST") { const entry = createWaitlistEntry(db, business, { ...(await readJsonBody(request)), source: "public-widget" }, now); await saveBusinessStore(db, context, "booking-public-waitlist"); return sendJson(response, 201, { entry: publicWaitlistEntry(entry) }, context); }
  throw methodNotAllowed("GET, POST, OPTIONS");
}

async function handlePaymentWebhook(request, response, context) {
  if ((request.method || "GET") !== "POST") throw methodNotAllowed("POST, OPTIONS");
  const rawBody = await readRawBody(request); const event = await verifyBookingPaymentWebhook(rawBody, request.headers, { env: process.env });
  if (event.ignored) return sendJson(response, 200, { received: true, ignored: true, type: event.type }, context);
  const db = ensureBookingResourceCollections(await loadBusinessStore(context)); const result = completeBookingCheckout(db, event);
  if (result.completed) await saveBusinessStore(db, context, "booking-payment-webhook");
  return sendJson(response, 200, { received: true, eventId: event.id, ...result }, context);
}

function decorateResource(db, resource) { return { ...resource, schedule: resourceSchedule(db, resource.id), exceptions: resourceExceptions(db, resource.id), activeAssignments: db.bookingResourceAssignments.filter((item) => item.resourceId === resource.id && item.status === "active").length }; }
function resourceSchedule(db, resourceId) { return db.bookingResourceSchedules.filter((item) => item.resourceId === resourceId).sort((a, b) => Number(a.weekday) - Number(b.weekday) || String(a.startTime).localeCompare(String(b.startTime))); }
function resourceExceptions(db, resourceId) { return db.bookingResourceExceptions.filter((item) => item.resourceId === resourceId).sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt))); }
function requireBusiness(db, ref) { const business = db.businesses.find((item) => item.id === ref || item.slug === ref); if (!business) throw apiError(404, "Business not found"); return business; }
function requireResource(db, businessId, id) { const resource = db.bookingResources.find((item) => item.businessId === businessId && item.id === id); if (!resource) throw apiError(404, "Booking resource not found"); return resource; }
function publicOffer(offer) { const { tokenHash, ...result } = offer; return result; }
function publicWaitlistEntry(entry) { const { businessId, contactId, priority, ...result } = entry; return result; }
function waitlistSort(a, b) { return Number(b.priority || 0) - Number(a.priority || 0) || String(a.createdAt).localeCompare(String(b.createdAt)); }
function audit(db, businessId, type, subjectId, now) { db.auditLog = Array.isArray(db.auditLog) ? db.auditLog : []; db.auditLog.push({ id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, businessId, type, subjectId, createdAt: now }); }
function requestBaseUrl(request) { const protocol = String(request.headers["x-forwarded-proto"] || "http").split(",")[0].trim(); const host = String(request.headers["x-forwarded-host"] || request.headers.host || "127.0.0.1").split(",")[0].trim(); return `${protocol}://${host}`; }
function methodNotAllowed(allow) { const error = apiError(405, "Method not allowed"); error.allow = allow; return error; }
function requireMutationAccess(readOnly) { if (readOnly) throw apiError(403, "Booking resource changes require admin access"); }
function apiError(statusCode, message, code = "booking_resource_error") { return Object.assign(new Error(message), { statusCode, code }); }
async function readJsonBody(request) { const raw = await readRawBody(request); try { const value = JSON.parse(raw); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; } catch { throw apiError(400, "Invalid JSON body"); } }
async function readRawBody(request) { let raw = ""; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > MAX_BODY_BYTES) throw apiError(413, "Booking resource payload too large"); raw += chunk.toString("utf8"); } if (!raw.trim()) throw apiError(400, "JSON body is required"); return raw; }
function sendJson(response, status, payload, context, extra = {}) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }); response.end(JSON.stringify(payload)); }
function sendEmpty(response, status, context, allow) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: allow }); response.end(); }
function clean(value) { return String(value ?? "").trim(); }
