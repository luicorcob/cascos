import { readFile } from "node:fs/promises";
import path from "node:path";
import { corsHeaders } from "../lib/cors.mjs";
import {
  completeGoogleAuthorization,
  createGoogleAuthorization,
  disconnectGoogle,
  getGoogleAccessToken,
  getGoogleConnectionStatus,
  googleJsonRequest,
  normalizeGoogleFeatures,
  saveGooglePlaceSnapshot,
  setupError
} from "../lib/google-auth.mjs";
import { backupJsonStore, cloneJson, readJsonStore, writeJsonStore } from "../lib/json-store.mjs";

const MAX_BODY_BYTES = Number(process.env.GOOGLE_API_MAX_BODY_BYTES || 512 * 1024);
const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  bookings: [],
  auditLog: []
};
const PLACE_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "internationalPhoneNumber",
  "nationalPhoneNumber",
  "websiteUri",
  "googleMapsUri",
  "rating",
  "userRatingCount",
  "regularOpeningHours",
  "businessStatus",
  "photos"
];
const LOCATION_READ_MASK = [
  "name",
  "title",
  "storefrontAddress",
  "phoneNumbers",
  "websiteUri",
  "regularHours",
  "specialHours",
  "metadata",
  "profile",
  "categories",
  "serviceArea"
].join(",");
const PERFORMANCE_METRICS = new Set([
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_CONVERSATIONS",
  "BUSINESS_DIRECTION_REQUESTS",
  "CALL_CLICKS",
  "WEBSITE_CLICKS",
  "BUSINESS_BOOKINGS",
  "BUSINESS_FOOD_ORDERS",
  "BUSINESS_FOOD_MENU_CLICKS"
]);
const DEFAULT_PERFORMANCE_METRICS = [
  "WEBSITE_CLICKS",
  "CALL_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
  "BUSINESS_BOOKINGS"
];

export function isGoogleApiRequest(pathname) {
  return pathname === "/api/google/oauth/start"
    || pathname === "/api/google/oauth/callback"
    || /^\/api\/businesses\/[^/]+\/google(?:\/.*)?$/.test(pathname);
}

export async function handleGoogleApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const segments = requestUrl.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    if (requestUrl.pathname === "/api/google/oauth/start" && method === "GET") {
      await startOAuth(requestUrl, response, context);
      return;
    }

    if (requestUrl.pathname === "/api/google/oauth/callback" && method === "GET") {
      await finishOAuth(requestUrl, response, context);
      return;
    }

    if (segments[0] === "api" && segments[1] === "businesses" && segments[3] === "google") {
      await handleBusinessGoogleRoute(segments[2], segments.slice(4), method, requestUrl, request, response, context);
      return;
    }

    sendJson(response, 404, { error: "Google API route not found" }, context);
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status >= 500 && !error.code ? "Internal Google integration error" : error.message;
    sendJson(response, status, {
      error: message,
      code: error.code || "google_integration_error",
      details: error.details || {}
    }, context);
  }
}

async function handleBusinessGoogleRoute(businessRef, route, method, requestUrl, request, response, context) {
  const db = await loadBusinessDb(context);
  const business = findBusiness(db, businessRef);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  if (!route.length && method === "GET") {
    await getStatus(business, response, context);
    return;
  }

  if (route[0] === "diagnostics" && method === "GET") {
    await runDiagnostics(business, response, context);
    return;
  }

  if (route[0] === "disconnect" && method === "POST") {
    sendJson(response, 200, await disconnectGoogle(context, business.id), context);
    return;
  }

  if (route[0] === "place" && route.length === 1 && method === "GET") {
    await getPlace(business, requestUrl, response, context);
    return;
  }

  if (route[0] === "place" && route[1] === "sync" && method === "POST") {
    await syncPlace(db, business, request, response, context);
    return;
  }

  if (route[0] === "calendar" && route[1] === "freebusy" && method === "POST") {
    await calendarFreeBusy(business, request, response, context);
    return;
  }

  if (route[0] === "calendar" && route[1] === "events" && method === "POST") {
    await createCalendarEvent(business, request, response, context);
    return;
  }

  if (route[0] === "calendar" && route[1] === "sync-booking" && route[2] && method === "POST") {
    await syncBooking(db, business, route[2], request, response, context);
    return;
  }

  if (route[0] === "business" && route[1] === "accounts" && method === "GET") {
    await listBusinessAccounts(business, response, context);
    return;
  }

  if (route[0] === "business" && route[1] === "locations" && method === "GET") {
    await listBusinessLocations(business, requestUrl, response, context);
    return;
  }

  if (route[0] === "business" && route[1] === "location" && method === "PATCH") {
    await updateBusinessLocation(business, request, response, context);
    return;
  }

  if (route[0] === "business" && route[1] === "reviews" && method === "GET") {
    await listReviews(business, requestUrl, response, context);
    return;
  }

  if (route[0] === "business" && route[1] === "reviews" && route[2] === "reply" && method === "POST") {
    await replyToReview(business, request, response, context);
    return;
  }

  if (route[0] === "business" && route[1] === "performance" && method === "GET") {
    await getBusinessPerformance(business, requestUrl, response, context);
    return;
  }

  if (route[0] === "business" && route[1] === "place-actions" && method === "GET") {
    await listPlaceActions(business, requestUrl, response, context);
    return;
  }

  if (route[0] === "business" && route[1] === "place-actions" && ["POST", "PATCH", "DELETE"].includes(method)) {
    await mutatePlaceAction(business, method, request, response, context);
    return;
  }

  if (route[0] === "workspace" && route[1] === "users" && method === "POST") {
    await createWorkspaceUser(business, request, response, context);
    return;
  }

  if (route[0] === "review-request" && method === "POST") {
    await makeReviewRequest(business, request, response, context);
    return;
  }

  throw httpError(405, "Method not allowed");
}

async function startOAuth(requestUrl, response, context) {
  const businessRef = cleanText(requestUrl.searchParams.get("businessId") || requestUrl.searchParams.get("business"), 120);
  const db = await loadBusinessDb(context);
  const business = findBusiness(db, businessRef);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const features = normalizeGoogleFeatures(requestUrl.searchParams.get("features") || "calendar");
  const authorization = await createGoogleAuthorization(context, {
    businessId: business.id,
    features,
    loginHint: requestUrl.searchParams.get("loginHint") || business.ownerEmail || ""
  });

  sendJson(response, 200, authorization, context);
}

async function finishOAuth(requestUrl, response, context) {
  if (requestUrl.searchParams.get("error")) {
    sendOAuthHtml(response, 400, "Conexion cancelada", cleanText(requestUrl.searchParams.get("error_description") || requestUrl.searchParams.get("error"), 1000), context);
    return;
  }

  try {
    const connection = await completeGoogleAuthorization(context, {
      code: requestUrl.searchParams.get("code"),
      state: requestUrl.searchParams.get("state")
    });
    sendOAuthHtml(response, 200, "Google conectado", `La conexion para ${connection.businessId} se ha guardado de forma cifrada. Ya puedes cerrar esta ventana y actualizar el dashboard.`, context);
  } catch (error) {
    sendOAuthHtml(response, error.statusCode || 500, "No se pudo conectar Google", error.message, context);
  }
}

async function getStatus(business, response, context) {
  const status = await getGoogleConnectionStatus(context, business.id);
  const config = googleConfig(business);

  sendJson(response, 200, {
    businessId: business.id,
    businessName: business.name,
    ...status,
    settings: {
      placeId: cleanText(config.placeId, 300),
      calendarId: cleanText(config.calendarId, 500) || cleanText(process.env.GOOGLE_CALENDAR_ID, 500) || "primary",
      businessProfileAccountId: cleanText(config.businessProfileAccountId, 300),
      businessProfileLocationId: cleanText(config.businessProfileLocationId, 300),
      reviewUrl: cleanText(config.reviewUrl, 2000)
    }
  }, context);
}

async function runDiagnostics(business, response, context) {
  const status = await getGoogleConnectionStatus(context, business.id);
  const config = googleConfig(business);
  const checks = [];

  await diagnosticCheck(checks, "places", Boolean(status.configured.placesApi && config.placeId), async () => {
    const place = await fetchPlace(config.placeId);
    return { placeId: place.placeId, name: place.name };
  });

  await diagnosticCheck(checks, "calendar", status.connected.calendar, async () => {
    const accessToken = await getGoogleAccessToken(context, business.id, "calendar");
    const now = new Date();
    const result = await googleJsonRequest("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: googleHeaders(accessToken, true),
      body: JSON.stringify({
        timeMin: now.toISOString(),
        timeMax: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
        items: [{ id: calendarIdFor(business) }]
      })
    });
    return { calendars: Object.keys(result.calendars || {}) };
  });

  await diagnosticCheck(checks, "business-profile", status.connected.businessProfile, async () => {
    const accessToken = await getGoogleAccessToken(context, business.id, "business-profile");
    const result = await googleJsonRequest("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
      headers: googleHeaders(accessToken)
    });
    return { accounts: Array.isArray(result.accounts) ? result.accounts.length : 0 };
  });

  await diagnosticCheck(checks, "workspace", status.connected.workspace, async () => {
    const accessToken = await getGoogleAccessToken(context, business.id, "workspace");
    const endpoint = new URL("https://admin.googleapis.com/admin/directory/v1/users");
    endpoint.searchParams.set("customer", "my_customer");
    endpoint.searchParams.set("maxResults", "1");
    endpoint.searchParams.set("orderBy", "email");
    const result = await googleJsonRequest(endpoint, { headers: googleHeaders(accessToken) });
    return { usersVisible: Array.isArray(result.users) ? result.users.length : 0 };
  });

  sendJson(response, 200, {
    businessId: business.id,
    ok: checks.every((check) => check.ok || check.skipped),
    checks
  }, context);
}

async function diagnosticCheck(checks, name, enabled, action) {
  if (!enabled) {
    checks.push({ name, ok: false, skipped: true, message: "Not configured or connected" });
    return;
  }

  try {
    checks.push({ name, ok: true, skipped: false, detail: await action() });
  } catch (error) {
    checks.push({
      name,
      ok: false,
      skipped: false,
      message: cleanText(error.message || "Diagnostic failed", 1000),
      code: error.code || "google_diagnostic_failed"
    });
  }
}

async function getPlace(business, requestUrl, response, context) {
  const placeId = cleanText(requestUrl.searchParams.get("placeId") || googleConfig(business).placeId, 500);
  const snapshot = await fetchPlace(placeId);
  sendJson(response, 200, { place: snapshot }, context);
}

async function syncPlace(db, business, request, response, context) {
  const payload = await readOptionalJsonBody(request);
  const placeId = cleanText(payload.placeId || googleConfig(business).placeId, 500);
  const snapshot = await fetchPlace(placeId);
  const snapshotRecord = await saveGooglePlaceSnapshot(context, business.id, snapshot);
  const now = new Date().toISOString();

  business.content = isPlainObject(business.content) ? business.content : {};
  business.content.google = {
    ...(isPlainObject(business.content.google) ? business.content.google : {}),
    enabled: true,
    placeId: snapshot.placeId,
    mapsUrl: snapshot.mapsUrl,
    rating: snapshot.rating,
    reviewCount: snapshot.reviewCount,
    hours: snapshot.hours,
    lastSyncedAt: now
  };

  if (payload.applyToBusiness === true) {
    business.content.address = snapshot.address || business.content.address || "";
    business.content.phone = snapshot.phone || business.content.phone || "";
    business.content.website = snapshot.websiteUri || business.content.website || "";
  }

  business.updatedAt = now;
  appendBusinessAudit(db, "google.place.applied", business.id, now, snapshot.placeId);
  await saveBusinessDb(db, context, "google-place-applied");
  sendJson(response, 200, {
    place: snapshot,
    syncedAt: snapshotRecord.updatedAt,
    appliedToBusiness: payload.applyToBusiness === true
  }, context);
}

async function calendarFreeBusy(business, request, response, context) {
  const payload = await readJsonBody(request);
  const timeMin = requiredIso(payload.timeMin, "timeMin is required");
  const timeMax = requiredIso(payload.timeMax, "timeMax is required");
  const calendarIds = Array.isArray(payload.calendarIds) && payload.calendarIds.length
    ? payload.calendarIds.map((value) => cleanText(value, 500)).filter(Boolean)
    : [calendarIdFor(business, payload.calendarId)];
  const accessToken = await getGoogleAccessToken(context, business.id, "calendar");
  const result = await googleJsonRequest("https://www.googleapis.com/calendar/v3/freeBusy", {
    method: "POST",
    headers: googleHeaders(accessToken, true),
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: cleanText(payload.timeZone, 120) || "Europe/Madrid",
      items: calendarIds.map((id) => ({ id }))
    })
  });

  sendJson(response, 200, result, context);
}

async function createCalendarEvent(business, request, response, context) {
  const payload = await readJsonBody(request);
  const accessToken = await getGoogleAccessToken(context, business.id, "calendar");
  const calendarId = calendarIdFor(business, payload.calendarId);
  const event = eventFromPayload(payload, business);
  const result = await googleJsonRequest(calendarEventsUrl(calendarId), {
    method: "POST",
    headers: googleHeaders(accessToken, true),
    body: JSON.stringify(event)
  });

  sendJson(response, 201, { event: result }, context);
}

async function syncBooking(db, business, bookingId, request, response, context) {
  const booking = db.bookings.find((item) => item.businessId === business.id && item.id === bookingId);

  if (!booking) {
    throw httpError(404, "Booking not found");
  }

  const payload = await readOptionalJsonBody(request);
  const calendarId = calendarIdFor(business, payload.calendarId || booking.google?.calendarId);
  const accessToken = await getGoogleAccessToken(context, business.id, "calendar");
  const now = new Date().toISOString();
  let googleEvent;
  let action;

  const isCanceled = ["canceled", "cancelled"].includes(String(booking.status || "").toLowerCase());

  if (isCanceled && !booking.google?.eventId) {
    sendJson(response, 200, { action: "skipped", booking, event: null }, context);
    return;
  }

  if (isCanceled && booking.google?.eventId) {
    if (payload.dryRun === true) {
      sendJson(response, 200, { dryRun: true, action: "delete", bookingId, eventId: booking.google.eventId }, context);
      return;
    }

    await googleJsonRequest(`${calendarEventsUrl(calendarId)}/${encodeURIComponent(booking.google.eventId)}`, {
      method: "DELETE",
      headers: googleHeaders(accessToken)
    });
    googleEvent = { id: booking.google.eventId, status: "cancelled" };
    action = "deleted";
  } else {
    const event = eventFromBooking(booking, business);
    const existingEventId = cleanText(booking.google?.eventId, 500);
    const method = existingEventId ? "PATCH" : "POST";
    const endpoint = existingEventId
      ? `${calendarEventsUrl(calendarId)}/${encodeURIComponent(existingEventId)}`
      : calendarEventsUrl(calendarId);

    if (payload.dryRun === true) {
      sendJson(response, 200, { dryRun: true, action: existingEventId ? "update" : "create", bookingId, calendarId, event }, context);
      return;
    }

    googleEvent = await googleJsonRequest(endpoint, {
      method,
      headers: googleHeaders(accessToken, true),
      body: JSON.stringify(event)
    });
    action = existingEventId ? "updated" : "created";
  }

  booking.google = {
    ...(isPlainObject(booking.google) ? booking.google : {}),
    eventId: action === "deleted" ? "" : googleEvent.id || booking.google?.eventId || "",
    htmlLink: action === "deleted" ? "" : googleEvent.htmlLink || booking.google?.htmlLink || "",
    calendarId,
    status: googleEvent.status || action,
    syncedAt: now
  };
  booking.updatedAt = now;
  appendBusinessAudit(db, `google.calendar.booking_${action}`, business.id, now, booking.id);
  await saveBusinessDb(db, context, `google-booking-${action}`);
  sendJson(response, 200, { action, booking, event: googleEvent }, context);
}

async function listBusinessAccounts(business, response, context) {
  const accessToken = await getGoogleAccessToken(context, business.id, "business-profile");
  const result = await googleJsonRequest("https://mybusinessaccountmanagement.googleapis.com/v1/accounts", {
    headers: googleHeaders(accessToken)
  });
  sendJson(response, 200, result, context);
}

async function listBusinessLocations(business, requestUrl, response, context) {
  const accountId = resourceId(requestUrl.searchParams.get("accountId") || googleConfig(business).businessProfileAccountId, "accounts");

  if (!accountId) {
    throw httpError(400, "accountId is required");
  }

  const accessToken = await getGoogleAccessToken(context, business.id, "business-profile");
  const endpoint = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${encodeURIComponent(accountId)}/locations`);
  endpoint.searchParams.set("readMask", LOCATION_READ_MASK);
  endpoint.searchParams.set("pageSize", "100");
  const result = await googleJsonRequest(endpoint, { headers: googleHeaders(accessToken) });
  sendJson(response, 200, result, context);
}

async function updateBusinessLocation(business, request, response, context) {
  const payload = await readJsonBody(request);
  const locationName = resourceName(payload.locationName || payload.location?.name, "locations");
  const updateMask = normalizeUpdateMask(payload.updateMask);

  if (!locationName || !updateMask) {
    throw httpError(400, "locationName and updateMask are required");
  }

  if (!isPlainObject(payload.location)) {
    throw httpError(400, "location must be an object");
  }

  if (payload.confirm !== true) {
    sendJson(response, 200, {
      dryRun: true,
      message: "Business Profile update validated but not published. Send confirm=true to apply it.",
      locationName,
      updateMask,
      location: payload.location
    }, context);
    return;
  }

  const accessToken = await getGoogleAccessToken(context, business.id, "business-profile");
  const endpoint = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}`);
  endpoint.searchParams.set("updateMask", updateMask);
  const result = await googleJsonRequest(endpoint, {
    method: "PATCH",
    headers: googleHeaders(accessToken, true),
    body: JSON.stringify(payload.location)
  });
  sendJson(response, 200, { location: result }, context);
}

async function listReviews(business, requestUrl, response, context) {
  const config = googleConfig(business);
  const accountId = resourceId(requestUrl.searchParams.get("accountId") || config.businessProfileAccountId, "accounts");
  const locationId = resourceId(requestUrl.searchParams.get("locationId") || config.businessProfileLocationId, "locations");

  if (!accountId || !locationId) {
    throw httpError(400, "accountId and locationId are required");
  }

  const accessToken = await getGoogleAccessToken(context, business.id, "business-profile");
  const endpoint = new URL(`https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/reviews`);
  endpoint.searchParams.set("pageSize", cleanText(requestUrl.searchParams.get("pageSize"), 20) || "50");
  if (requestUrl.searchParams.get("pageToken")) {
    endpoint.searchParams.set("pageToken", requestUrl.searchParams.get("pageToken"));
  }
  const result = await googleJsonRequest(endpoint, { headers: googleHeaders(accessToken) });
  sendJson(response, 200, result, context);
}

async function replyToReview(business, request, response, context) {
  const payload = await readJsonBody(request);
  const config = googleConfig(business);
  const accountId = resourceId(payload.accountId || config.businessProfileAccountId, "accounts");
  const locationId = resourceId(payload.locationId || config.businessProfileLocationId, "locations");
  const reviewId = resourceId(payload.reviewId, "reviews");
  const comment = cleanText(payload.comment, 4096);

  if (!accountId || !locationId || !reviewId || !comment) {
    throw httpError(400, "accountId, locationId, reviewId and comment are required");
  }

  if (payload.confirm !== true) {
    sendJson(response, 200, {
      dryRun: true,
      message: "Review reply validated but not published. Send confirm=true after human approval.",
      reply: { accountId, locationId, reviewId, comment }
    }, context);
    return;
  }

  const accessToken = await getGoogleAccessToken(context, business.id, "business-profile");
  const endpoint = `https://mybusiness.googleapis.com/v4/accounts/${encodeURIComponent(accountId)}/locations/${encodeURIComponent(locationId)}/reviews/${encodeURIComponent(reviewId)}/reply`;
  const result = await googleJsonRequest(endpoint, {
    method: "PUT",
    headers: googleHeaders(accessToken, true),
    body: JSON.stringify({ comment })
  });
  sendJson(response, 200, { reply: result }, context);
}

async function getBusinessPerformance(business, requestUrl, response, context) {
  const locationId = resourceId(requestUrl.searchParams.get("locationId") || googleConfig(business).businessProfileLocationId, "locations");

  if (!locationId) {
    throw httpError(400, "locationId is required");
  }

  const range = performanceRange(requestUrl.searchParams.get("start"), requestUrl.searchParams.get("end"));
  const requestedMetrics = requestUrl.searchParams.getAll("metric")
    .concat(String(requestUrl.searchParams.get("metrics") || "").split(","))
    .map((metric) => cleanText(metric, 120).toUpperCase())
    .filter((metric) => PERFORMANCE_METRICS.has(metric));
  const metrics = Array.from(new Set(requestedMetrics.length ? requestedMetrics : DEFAULT_PERFORMANCE_METRICS));
  const endpoint = new URL(`https://businessprofileperformance.googleapis.com/v1/locations/${encodeURIComponent(locationId)}:fetchMultiDailyMetricsTimeSeries`);
  metrics.forEach((metric) => endpoint.searchParams.append("dailyMetrics", metric));
  endpoint.searchParams.set("dailyRange.start_date.year", String(range.start.year));
  endpoint.searchParams.set("dailyRange.start_date.month", String(range.start.month));
  endpoint.searchParams.set("dailyRange.start_date.day", String(range.start.day));
  endpoint.searchParams.set("dailyRange.end_date.year", String(range.end.year));
  endpoint.searchParams.set("dailyRange.end_date.month", String(range.end.month));
  endpoint.searchParams.set("dailyRange.end_date.day", String(range.end.day));
  const accessToken = await getGoogleAccessToken(context, business.id, "business-profile");
  const result = await googleJsonRequest(endpoint, { headers: googleHeaders(accessToken) });
  sendJson(response, 200, { metrics, range, performance: result }, context);
}

async function listPlaceActions(business, requestUrl, response, context) {
  const locationId = resourceId(requestUrl.searchParams.get("locationId") || googleConfig(business).businessProfileLocationId, "locations");

  if (!locationId) {
    throw httpError(400, "locationId is required");
  }

  const endpoint = new URL(`https://mybusinessplaceactions.googleapis.com/v1/locations/${encodeURIComponent(locationId)}/placeActionLinks`);
  const placeActionType = cleanText(requestUrl.searchParams.get("placeActionType"), 120);
  if (placeActionType) {
    endpoint.searchParams.set("filter", `placeActionType=${placeActionType}`);
  }
  if (requestUrl.searchParams.get("pageToken")) {
    endpoint.searchParams.set("pageToken", requestUrl.searchParams.get("pageToken"));
  }
  endpoint.searchParams.set("pageSize", cleanText(requestUrl.searchParams.get("pageSize"), 20) || "100");
  const accessToken = await getGoogleAccessToken(context, business.id, "business-profile");
  const result = await googleJsonRequest(endpoint, { headers: googleHeaders(accessToken) });
  sendJson(response, 200, result, context);
}

async function mutatePlaceAction(business, method, request, response, context) {
  const payload = await readJsonBody(request);
  const config = googleConfig(business);
  const locationId = resourceId(payload.locationId || config.businessProfileLocationId, "locations");
  const link = isPlainObject(payload.placeActionLink) ? payload.placeActionLink : {
    name: payload.name,
    uri: payload.uri,
    placeActionType: payload.placeActionType,
    isPreferred: payload.isPreferred
  };

  if (method === "POST" && (!locationId || !cleanText(link.uri, 2000) || !cleanText(link.placeActionType, 120))) {
    throw httpError(400, "locationId, uri and placeActionType are required");
  }

  const name = normalizePlaceActionName(link.name || payload.name);
  if (["PATCH", "DELETE"].includes(method) && !name) {
    throw httpError(400, "A valid place action link name is required");
  }

  const updateMask = normalizePlaceActionUpdateMask(payload.updateMask);
  if (method === "PATCH" && !updateMask) {
    throw httpError(400, "updateMask must contain uri, placeActionType or isPreferred");
  }

  if (payload.confirm !== true) {
    sendJson(response, 200, {
      dryRun: true,
      message: `Place action ${method.toLowerCase()} validated but not published. Send confirm=true to apply it.`,
      method,
      locationId,
      updateMask,
      placeActionLink: method === "DELETE" ? { name } : link
    }, context);
    return;
  }

  const accessToken = await getGoogleAccessToken(context, business.id, "business-profile");
  let endpoint;
  let body;

  if (method === "POST") {
    endpoint = `https://mybusinessplaceactions.googleapis.com/v1/locations/${encodeURIComponent(locationId)}/placeActionLinks`;
    body = JSON.stringify({
      uri: cleanText(link.uri, 2000),
      placeActionType: cleanText(link.placeActionType, 120),
      isPreferred: link.isPreferred === true
    });
  } else {
    endpoint = `https://mybusinessplaceactions.googleapis.com/v1/${encodeResourceName(name)}`;
    if (method === "PATCH") {
      endpoint = `${endpoint}?updateMask=${encodeURIComponent(updateMask)}`;
      body = JSON.stringify({ ...link, name });
    }
  }

  const result = await googleJsonRequest(endpoint, {
    method,
    headers: googleHeaders(accessToken, method !== "DELETE"),
    ...(body ? { body } : {})
  });
  sendJson(response, method === "POST" ? 201 : 200, {
    action: method.toLowerCase(),
    placeActionLink: method === "DELETE" ? { name, deleted: true } : result
  }, context);
}

async function createWorkspaceUser(business, request, response, context) {
  const payload = await readJsonBody(request);
  const primaryEmail = cleanText(payload.primaryEmail || googleConfig(business).workspaceEmail, 320).toLowerCase();
  const givenName = cleanText(payload.givenName, 120);
  const familyName = cleanText(payload.familyName, 120);
  const password = String(payload.password || "");

  if (!primaryEmail || !givenName || !familyName || !password) {
    throw httpError(400, "primaryEmail, givenName, familyName and password are required");
  }

  const user = {
    primaryEmail,
    name: { givenName, familyName },
    password,
    changePasswordAtNextLogin: payload.changePasswordAtNextLogin !== false
  };

  if (payload.confirm !== true) {
    sendJson(response, 200, {
      dryRun: true,
      message: "Workspace user validated but not created. Send confirm=true after client approval.",
      user: {
        primaryEmail,
        name: user.name,
        changePasswordAtNextLogin: user.changePasswordAtNextLogin
      }
    }, context);
    return;
  }

  const accessToken = await getGoogleAccessToken(context, business.id, "workspace");
  const result = await googleJsonRequest("https://admin.googleapis.com/admin/directory/v1/users", {
    method: "POST",
    headers: googleHeaders(accessToken, true),
    body: JSON.stringify(user)
  });
  sendJson(response, 201, { user: result }, context);
}

async function makeReviewRequest(business, request, response, context) {
  const payload = await readOptionalJsonBody(request);
  const config = googleConfig(business);
  const reviewUrl = cleanText(payload.reviewUrl || config.reviewUrl, 2000);
  const customerName = cleanText(payload.customerName, 240);
  const channel = cleanText(payload.channel, 80) || "whatsapp";
  const template = String(
    payload.template
      || config.reviewRequestTemplate
      || "Gracias por visitar {business}. Tu opinion nos ayuda a mejorar. Puedes dejar una resena aqui: {reviewUrl}"
  );
  const message = template
    .replaceAll("{business}", business.name || "el negocio")
    .replaceAll("{reviewUrl}", reviewUrl)
    .replaceAll("{customerName}", customerName);

  sendJson(response, 200, {
    channel,
    business: business.name,
    customerName,
    reviewUrl,
    message,
    actions: {
      whatsappUrl: payload.phone ? `https://wa.me/${cleanPhone(payload.phone)}?text=${encodeURIComponent(message)}` : "",
      mailtoUrl: payload.email ? `mailto:${encodeURIComponent(payload.email)}?subject=${encodeURIComponent(`Tu opinion sobre ${business.name}`)}&body=${encodeURIComponent(message)}` : ""
    }
  }, context);
}

async function fetchPlace(placeId) {
  const apiKey = cleanText(process.env.GOOGLE_MAPS_API_KEY, 2000);

  if (!apiKey) {
    throw setupError("Set GOOGLE_MAPS_API_KEY to use Places API");
  }

  if (!placeId) {
    throw httpError(400, "placeId is required");
  }

  const place = await googleJsonRequest(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": PLACE_FIELDS.join(",")
    }
  });

  return normalizePlace(place);
}

function eventFromPayload(payload, business) {
  const start = requiredIso(payload.start || payload.startsAt, "start is required");
  const end = requiredIso(payload.end || payload.endsAt, "end is required");
  const timeZone = cleanText(payload.timeZone, 120) || "Europe/Madrid";

  if (new Date(end) <= new Date(start)) {
    throw httpError(400, "Event end must be after start");
  }

  return {
    summary: cleanText(payload.summary, 500) || `Reserva LocalLift - ${cleanText(payload.customerName, 200) || "Cliente"}`,
    description: [
      "Reserva creada desde LocalLift.",
      payload.service ? `Servicio: ${cleanText(payload.service, 500)}` : "",
      payload.customerName ? `Cliente: ${cleanText(payload.customerName, 500)}` : "",
      payload.phone ? `Telefono: ${cleanText(payload.phone, 200)}` : "",
      payload.email ? `Email: ${cleanText(payload.email, 320)}` : "",
      payload.notes ? `Notas: ${cleanText(payload.notes, 3000)}` : ""
    ].filter(Boolean).join("\n"),
    location: cleanText(payload.location || business.content?.address, 1000) || undefined,
    start: { dateTime: start, timeZone },
    end: { dateTime: end, timeZone },
    attendees: payload.email ? [{ email: cleanText(payload.email, 320) }] : undefined,
    extendedProperties: {
      private: {
        source: "locallift",
        businessId: business.id,
        leadId: cleanText(payload.leadId, 300)
      }
    }
  };
}

function eventFromBooking(booking, business) {
  return eventFromPayload({
    summary: `${booking.serviceName || "Reserva"} - ${booking.customerName || "Cliente"}`,
    service: booking.serviceName,
    customerName: booking.customerName,
    phone: booking.phone,
    email: booking.email,
    notes: booking.notes,
    start: booking.startsAt,
    end: booking.endsAt,
    timeZone: booking.timeZone || googleConfig(business).timeZone || "Europe/Madrid",
    leadId: booking.contactId || ""
  }, business);
}

function calendarEventsUrl(calendarId) {
  return `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
}

function calendarIdFor(business, override = "") {
  return cleanText(override, 500)
    || cleanText(googleConfig(business).calendarId, 500)
    || cleanText(process.env.GOOGLE_CALENDAR_ID, 500)
    || "primary";
}

function googleConfig(business) {
  return {
    ...(isPlainObject(business.integrations?.google) ? business.integrations.google : {}),
    ...(isPlainObject(business.content?.google) ? business.content.google : {}),
    ...(isPlainObject(business.google) ? business.google : {})
  };
}

function normalizePlace(place) {
  return {
    placeId: place.id || "",
    name: place.displayName?.text || "",
    address: place.formattedAddress || "",
    phone: place.internationalPhoneNumber || place.nationalPhoneNumber || "",
    websiteUri: place.websiteUri || "",
    mapsUrl: place.googleMapsUri || "",
    rating: Number(place.rating || 0),
    reviewCount: Number(place.userRatingCount || 0),
    businessStatus: place.businessStatus || "",
    hours: place.regularOpeningHours?.weekdayDescriptions || [],
    photoNames: (place.photos || []).map((photo) => photo.name).filter(Boolean).slice(0, 10)
  };
}

function normalizeUpdateMask(value) {
  return String(value || "")
    .split(",")
    .map((item) => cleanText(item, 120))
    .filter((item) => /^[a-zA-Z][a-zA-Z0-9_.]*$/.test(item))
    .slice(0, 30)
    .join(",");
}

function normalizePlaceActionUpdateMask(value) {
  const allowed = new Set(["uri", "placeActionType", "isPreferred"]);
  return String(value || "")
    .split(",")
    .map((item) => cleanText(item, 120))
    .filter((item) => allowed.has(item))
    .join(",");
}

function normalizePlaceActionName(value) {
  const text = cleanText(value, 1000).replace(/^\/+|\/+$/g, "");
  return /^locations\/[^/]+\/placeActionLinks\/[^/]+$/.test(text) ? text : "";
}

function encodeResourceName(value) {
  return String(value || "").split("/").map((part) => encodeURIComponent(part)).join("/");
}

function performanceRange(startValue, endValue) {
  const end = parseDateOnly(endValue) || new Date();
  const start = parseDateOnly(startValue) || new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);

  if (start > end) {
    throw httpError(400, "Performance start date must be before end date");
  }

  if (end.getTime() - start.getTime() > 18 * 31 * 24 * 60 * 60 * 1000) {
    throw httpError(400, "Performance date range is too large");
  }

  return {
    start: dateParts(start),
    end: dateParts(end)
  };
}

function parseDateOnly(value) {
  if (!value) {
    return null;
  }

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateParts(date) {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

function resourceId(value, prefix) {
  const text = cleanText(value, 500).replace(/^\/+|\/+$/g, "");
  return text.startsWith(`${prefix}/`) ? text.slice(prefix.length + 1) : text;
}

function resourceName(value, prefix) {
  const id = resourceId(value, prefix);
  return id ? `${prefix}/${id}` : "";
}

function googleHeaders(accessToken, json = false) {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(json ? { "Content-Type": "application/json" } : {})
  };
}

function requiredIso(value, message) {
  const date = new Date(value || "");

  if (!value || Number.isNaN(date.getTime())) {
    throw httpError(400, message);
  }

  return date.toISOString();
}

async function loadBusinessDb(context) {
  const dbPath = getBusinessDbPath(context.root);
  const fallback = await loadFallbackDb(context.root);
  const db = await readJsonStore(dbPath, fallback);
  db.version = Number(db.version || 1);
  db.businesses = Array.isArray(db.businesses) ? db.businesses : [];
  db.bookings = Array.isArray(db.bookings) ? db.bookings : [];
  db.auditLog = Array.isArray(db.auditLog) ? db.auditLog : [];
  return db;
}

async function saveBusinessDb(db, context, backupLabel) {
  const dbPath = getBusinessDbPath(context.root);
  db.updatedAt = new Date().toISOString();

  if (process.env.BUSINESS_DB_BACKUPS !== "false") {
    await backupJsonStore(dbPath, getBackupDir(context.root), backupLabel);
  }

  await writeJsonStore(dbPath, db);
}

async function loadFallbackDb(root) {
  const examplePath = path.join(root, "data", "business-db.example.json");

  try {
    return JSON.parse(await readFile(examplePath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    return cloneJson(DEFAULT_DB);
  }
}

function findBusiness(db, id) {
  return db.businesses.find((business) => business.id === id || business.slug === id);
}

function appendBusinessAudit(db, type, businessId, createdAt, subjectId) {
  db.auditLog.push({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    businessId,
    subjectId,
    createdAt
  });
}

function getBusinessDbPath(root) {
  return process.env.BUSINESS_DB_FILE
    ? path.resolve(root, process.env.BUSINESS_DB_FILE)
    : path.join(root, "data", "business-db.json");
}

function getBackupDir(root) {
  return process.env.BUSINESS_DB_BACKUP_DIR
    ? path.resolve(root, process.env.BUSINESS_DB_BACKUP_DIR)
    : path.join(root, "data", "backups");
}

async function readJsonBody(request) {
  const payload = await readOptionalJsonBody(request);

  if (!Object.keys(payload).length) {
    throw httpError(400, "JSON body is required");
  }

  return payload;
}

async function readOptionalJsonBody(request) {
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
    return {};
  }

  try {
    const payload = JSON.parse(raw);
    if (!isPlainObject(payload)) {
      throw new Error("not-object");
    }
    return payload;
  } catch (error) {
    throw httpError(400, "Invalid JSON body");
  }
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
    Allow: "GET, POST, PATCH, DELETE, OPTIONS"
  });
  response.end();
}

function sendOAuthHtml(response, status, title, message, context) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  response.writeHead(status, {
    ...context.baseHeaders,
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"
  });
  response.end(`<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
    <style>body{font-family:system-ui,sans-serif;max-width:680px;margin:10vh auto;padding:24px;line-height:1.5;background:#10131a;color:#f5f7fb}main{background:#1b2230;border:1px solid #364055;border-radius:18px;padding:28px}button{padding:10px 16px;border:0;border-radius:10px;font-weight:700}</style>
  </head>
  <body>
    <main>
      <h1>${safeTitle}</h1>
      <p>${safeMessage}</p>
      <button type="button" onclick="window.close()">Cerrar ventana</button>
    </main>
  </body>
</html>`);
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanText(value, maxLength = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanPhone(value) {
  return cleanText(value, 80).replace(/[^\d+]/g, "").replace(/^\+/, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
