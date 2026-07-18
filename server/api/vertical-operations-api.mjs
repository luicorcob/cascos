import { corsHeaders } from "../lib/cors.mjs";
import { appendSecurityAudit, getRequestBusinessUserSession } from "../lib/business-access.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import {
  acceptBookingPolicy,
  answerReminderConfirmation,
  assignTableCombination,
  buildOperationalPlanning,
  buildVerticalOperationsCenter,
  createReminderConfirmation,
  ensureVerticalOperationsCollections,
  recordBookingPolicyEvent,
  resolveExperienceDepositRule,
  resolveReminderConfirmation,
  upsertBookingPolicy,
  upsertHospitalityExperience,
  upsertHospitalityZone,
  upsertServiceShift,
  upsertTableCombination
} from "../lib/vertical-operations-model.mjs";

const MAX_BODY_BYTES = Number(process.env.VERTICAL_OPERATIONS_API_MAX_BODY_BYTES || 256 * 1024);
const CONFIG = Object.freeze({
  zones: { collection: "hospitalityZones", upsert: upsertHospitalityZone },
  combinations: { collection: "hospitalityTableCombinations", upsert: upsertTableCombination },
  shifts: { collection: "hospitalityServiceShifts", upsert: upsertServiceShift },
  experiences: { collection: "hospitalityExperiences", upsert: upsertHospitalityExperience },
  policies: { collection: "bookingPolicies", upsert: upsertBookingPolicy }
});

export function isVerticalOperationsApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/vertical(?:\/(?:planning|(?:zones|combinations|shifts|experiences|policies)(?:\/[^/]+(?:\/deposit-preview)?)?|bookings\/[^/]+\/(?:combination|policy-acceptance|policy-events|reminder-confirmations)))?$/.test(pathname)
    || /^\/api\/public\/booking-reminders\/[^/]+$/.test(pathname);
}

export async function handleVerticalOperationsApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context, "GET, POST, PATCH, OPTIONS");
  try {
    if (requestUrl.pathname.startsWith("/api/public/booking-reminders/")) {
      return await handlePublicReminder(request, response, context, requestUrl, method);
    }
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const businessRef = segments[2] || "";
    const section = segments[4] || "";
    const resourceId = segments[5] || "";
    const action = segments[6] || "";
    const db = ensureVerticalOperationsCollections(await loadBusinessStore(context));
    const business = db.businesses.find((item) => item.id === businessRef || item.slug === businessRef);
    if (!business) throw apiError(404, "Business not found");
    const session = getRequestBusinessUserSession(request);
    const actor = session
      ? { type: "businessUser", id: session.userId, userId: session.userId, impersonatedBy: session.impersonatedBy }
      : { type: "admin", id: "admin" };

    if (!section && method === "GET") {
      return sendJson(response, 200, { center: buildVerticalOperationsCenter(db, business.id, Object.fromEntries(requestUrl.searchParams)) }, context);
    }
    if (section === "planning" && method === "GET") {
      return sendJson(response, 200, { planning: buildOperationalPlanning(db, business.id, Object.fromEntries(requestUrl.searchParams)) }, context);
    }
    const config = CONFIG[section];
    if (config) {
      if (!resourceId && method === "GET") {
        return sendJson(response, 200, { items: db[config.collection].filter((item) => item.businessId === business.id && item.active !== false) }, context);
      }
      if (!resourceId && method === "POST") {
        const item = config.upsert(db, business.id, await readJsonBody(request));
        appendSecurityAudit(db, business.id, actor, `vertical.${section}_created`, section, item.id, {});
        await persist(db, context, `vertical-${section}-create`);
        return sendJson(response, 201, { item, center: buildVerticalOperationsCenter(db, business.id) }, context);
      }
      const existing = db[config.collection].find((item) => item.businessId === business.id && item.id === resourceId);
      if (!existing) throw apiError(404, "Vertical operations record not found");
      if (!action && method === "PATCH") {
        const item = config.upsert(db, business.id, await readJsonBody(request), existing);
        appendSecurityAudit(db, business.id, actor, `vertical.${section}_updated`, section, item.id, {});
        await persist(db, context, `vertical-${section}-update`);
        return sendJson(response, 200, { item, center: buildVerticalOperationsCenter(db, business.id) }, context);
      }
      if (section === "experiences" && action === "deposit-preview" && method === "POST") {
        const source = await readJsonBody(request);
        const rule = resolveExperienceDepositRule(existing, source.bookingDate, source.segments);
        return sendJson(response, 200, { rule, experienceId: existing.id }, context);
      }
    }
    if (section === "bookings" && resourceId && action === "combination" && method === "POST") {
      const source = await readJsonBody(request);
      const result = assignTableCombination(db, business.id, resourceId, clean(source.combinationId));
      appendSecurityAudit(db, business.id, actor, "vertical.table_combination_assigned", "booking", resourceId, { combinationId: result.combination.id, resourceIds: result.combination.tableResourceIds });
      await persist(db, context, "vertical-booking-combination");
      return sendJson(response, 200, result, context);
    }
    if (section === "bookings" && resourceId && action === "policy-acceptance" && method === "POST") {
      const result = acceptBookingPolicy(db, business.id, resourceId, await readJsonBody(request), actor);
      appendSecurityAudit(db, business.id, actor, "vertical.booking_policy_accepted", "booking", resourceId, { policyId: result.event.policyId, version: result.event.policyVersion });
      await persist(db, context, "vertical-policy-acceptance");
      return sendJson(response, result.duplicate ? 200 : 201, result, context);
    }
    if (section === "bookings" && resourceId && action === "policy-events" && method === "POST") {
      const event = recordBookingPolicyEvent(db, business.id, resourceId, await readJsonBody(request), actor);
      appendSecurityAudit(db, business.id, actor, `vertical.${event.type}`, "booking", resourceId, { eventId: event.id, amount: event.amount, currency: event.currency });
      await persist(db, context, "vertical-policy-event");
      return sendJson(response, 201, { event }, context);
    }
    if (section === "bookings" && resourceId && action === "reminder-confirmations" && method === "POST") {
      const result = createReminderConfirmation(db, business.id, resourceId, await readJsonBody(request));
      appendSecurityAudit(db, business.id, actor, "vertical.reminder_confirmation_created", "booking", resourceId, { confirmationId: result.confirmation.id });
      await persist(db, context, "vertical-reminder-confirmation");
      return sendJson(response, result.duplicate ? 200 : 201, {
        ...result,
        publicUrl: result.token ? `/api/public/booking-reminders/${encodeURIComponent(result.token)}` : ""
      }, context);
    }
    throw methodNotAllowed("GET, POST, PATCH, OPTIONS");
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: (error.statusCode || 500) >= 500 && process.env.NODE_ENV !== "test" ? "Internal vertical operations API error" : error.message,
      code: error.code || "vertical_operations_error"
    }, context, error.allow ? { Allow: error.allow } : {});
  }
}

async function handlePublicReminder(request, response, context, requestUrl, method) {
  const token = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent).at(-1);
  const db = ensureVerticalOperationsCollections(await loadBusinessStore(context));
  if (method === "GET") {
    const result = resolveReminderConfirmation(db, token);
    const policy = db.bookingPolicies.find((item) => item.businessId === result.booking.businessId && item.id === result.booking.policyId);
    return sendJson(response, 200, {
      confirmation: {
        id: result.confirmation.id,
        status: result.confirmation.status,
        expiresAt: result.confirmation.expiresAt
      },
      booking: {
        id: result.booking.id,
        serviceName: result.booking.serviceName || result.booking.service || "",
        startsAt: result.booking.startsAt,
        endsAt: result.booking.endsAt,
        partySize: result.booking.partySize || 1
      },
      business: { name: result.business?.name || "" },
      policy: policy ? { name: policy.name, version: policy.version, visibleText: policy.visibleText } : null
    }, context);
  }
  if (method === "POST") {
    const source = await readJsonBody(request);
    const result = answerReminderConfirmation(db, token, clean(source.decision));
    await persist(db, context, "vertical-public-reminder-answer");
    return sendJson(response, 200, {
      confirmation: {
        id: result.confirmation.id,
        status: result.confirmation.status,
        confirmedAt: result.confirmation.confirmedAt,
        declinedAt: result.confirmation.declinedAt
      },
      booking: { id: result.booking.id, status: result.booking.status },
      duplicate: result.duplicate
    }, context);
  }
  throw methodNotAllowed("GET, POST, OPTIONS");
}

async function persist(db, context, reason) { await saveBusinessStore(db, context, reason); }
async function readJsonBody(request) {
  let raw = "";
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw apiError(413, "Vertical operations payload too large");
    raw += chunk.toString("utf8");
  }
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw apiError(400, "Invalid JSON body");
  }
}
function methodNotAllowed(allow) { const error = apiError(405, "Method not allowed"); error.allow = allow; return error; }
function apiError(statusCode, message, code = "vertical_operations_error") { return Object.assign(new Error(message), { statusCode, code }); }
function sendJson(response, status, payload, context, extra = {}) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }); response.end(JSON.stringify(payload)); }
function sendEmpty(response, status, context, allow) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: allow }); response.end(); }
function clean(value) { return String(value ?? "").trim(); }
