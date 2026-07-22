import { corsHeaders } from "../lib/cors.mjs";
import {
  buildZonePreview,
  buildZoneRecommendations,
  listZoneExclusionOptions,
  prepareZoneForBusiness,
  recalculateBusinessConnections
} from "../lib/zone-discovery-service.mjs";
import {
  findZoneBusiness,
  getZoneMetrics,
  getZoneSettings,
  insertZoneEvent,
  upsertZoneSettings
} from "../lib/zone-discovery-store.mjs";
import { buildZoneRoute } from "../lib/zone-route-service.mjs";

const MAX_BODY_BYTES = Number(process.env.ZONE_DISCOVERY_API_MAX_BODY_BYTES || 256 * 1024);
const EVENT_TYPES = new Set(["opened", "card_clicked", "directions_clicked"]);

export function isZoneDiscoveryApiRequest(pathname) {
  return pathname === "/api/zone/route"
    || pathname === "/api/zone-discovery/preview"
    || /^\/api\/public\/[^/]+\/zone(?:\/events)?$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/zone(?:\/(?:settings|refresh|metrics))?$/.test(pathname);
}

export async function handleZoneDiscoveryApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://dls.local");
  const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const method = request.method || "GET";
  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    if (requestUrl.pathname === "/api/zone/route" && method === "POST") {
      const payload = await readJsonBody(request);
      const route = await buildZoneRoute(payload);
      sendJson(response, 200, { route }, context, { "Cache-Control": "no-store" });
      return;
    }

    if (segments[1] === "zone-discovery" && segments[2] === "preview" && segments.length === 3 && method === "POST") {
      const payload = await readJsonBody(request);
      const zone = await buildZonePreview(payload);
      sendJson(response, 200, { zone }, context, { "Cache-Control": "no-store" });
      return;
    }

    if (segments[1] === "public") {
      const reference = segments[2];
      if (segments.length === 4 && method === "GET") {
        const zone = await buildZoneRecommendations(reference);
        sendJson(response, 200, { zone }, context, { "Cache-Control": "public, max-age=120, stale-while-revalidate=300" });
        return;
      }
      if (segments[4] === "events" && method === "POST") {
        await trackPublicZoneEvent(reference, request, response, context);
        return;
      }
    }

    if (segments[1] === "businesses") {
      const reference = segments[2];
      const action = segments[4] || "";
      if (!action && method === "GET") {
        await getAdminZone(reference, response, context);
        return;
      }
      if (action === "settings" && method === "PUT") {
        await updateSettings(reference, request, response, context);
        return;
      }
      if (action === "refresh" && method === "POST") {
        const result = await prepareZoneForBusiness(reference, { force: requestUrl.searchParams.get("force") === "true" });
        const zone = await buildZoneRecommendations(reference, { includeDisabled: true });
        sendJson(response, 200, { result: summarizePreparation(result), zone }, context);
        return;
      }
      if (action === "metrics" && method === "GET") {
        const business = await requireBusiness(reference);
        sendJson(response, 200, { metrics: await getZoneMetrics(business.id) }, context);
        return;
      }
    }

    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "GET, POST, PUT, OPTIONS" });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, {
      error: status >= 500 && !error.code ? "Internal zone discovery API error" : error.message,
      code: error.code || "zone_discovery_error",
      ...(error.details && typeof error.details === "object" ? error.details : {})
    }, context);
  }
}

async function getAdminZone(reference, response, context) {
  const business = await requireBusiness(reference);
  const [zone, exclusions, metrics] = await Promise.all([
    buildZoneRecommendations(business.id, { includeDisabled: true }),
    listZoneExclusionOptions(business.id),
    getZoneMetrics(business.id)
  ]);
  sendJson(response, 200, { zone, exclusions, metrics }, context);
}

async function updateSettings(reference, request, response, context) {
  const business = await requireBusiness(reference);
  const payload = await readJsonBody(request);
  const current = await getZoneSettings(business.id);
  const desiredEnabled = payload.isEnabled === undefined ? current.isEnabled : payload.isEnabled === true;
  const settingsInput = {
    isEnabled: desiredEnabled ? current.isEnabled : false,
    excludedBusinessIds: payload.excludedBusinessIds,
    excludedPoiIds: payload.excludedPoiIds,
    radiusMeters: payload.radiusMeters
  };
  await upsertZoneSettings(business.id, settingsInput);
  let preparation = null;
  if (desiredEnabled) {
    preparation = await prepareZoneForBusiness(business.id);
    await upsertZoneSettings(business.id, { isEnabled: true });
  }
  if (payload.radiusMeters !== undefined && current.radiusMeters !== Number(payload.radiusMeters) && business.coordinates) {
    await recalculateBusinessConnections(business.id);
  }
  const [zone, exclusions, metrics] = await Promise.all([
    buildZoneRecommendations(business.id, { includeDisabled: true }),
    listZoneExclusionOptions(business.id),
    getZoneMetrics(business.id)
  ]);
  sendJson(response, 200, { zone, exclusions, metrics, preparation: preparation ? summarizePreparation(preparation) : null }, context);
}

async function trackPublicZoneEvent(reference, request, response, context) {
  const business = await requireBusiness(reference);
  const payload = await readJsonBody(request);
  const eventType = clean(payload.eventType || payload.type);
  if (!EVENT_TYPES.has(eventType)) throw apiError(400, "Unknown zone event type", "zone_event_invalid");
  const targetBusinessId = clean(payload.targetBusinessId);
  const targetPoiId = clean(payload.targetPoiId);
  if (eventType === "opened" && (targetBusinessId || targetPoiId)) {
    throw apiError(400, "Opened events cannot have a target", "zone_event_target_invalid");
  }
  if (eventType !== "opened" && Boolean(targetBusinessId) === Boolean(targetPoiId)) {
    throw apiError(400, "Click events require exactly one target", "zone_event_target_required");
  }
  if (eventType !== "opened") {
    const zone = await buildZoneRecommendations(business.id);
    const valid = zone.recommendations.some((item) => (
      targetBusinessId ? item.targetBusinessId === targetBusinessId : item.targetPoiId === targetPoiId
    ));
    if (!valid) throw apiError(400, "Event target is not a current recommendation", "zone_event_target_unknown");
  }
  const event = await insertZoneEvent({
    hostBusinessId: business.id,
    eventType,
    targetBusinessId,
    targetPoiId
  });
  sendJson(response, 201, { event }, context, { "Cache-Control": "no-store" });
}

async function requireBusiness(reference) {
  const business = await findZoneBusiness(reference);
  if (!business) throw apiError(404, "Business not found", "zone_business_not_found");
  return business;
}

function summarizePreparation(result) {
  return {
    businessId: result.business.id,
    zone: result.business.zone,
    coordinates: result.business.coordinates,
    poisImported: result.pois.imported,
    poisInRadius: result.pois.totalInRadius,
    connections: result.connections.total
  };
}

async function readOptionalJsonBody(request) {
  let raw = "";
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw apiError(413, "JSON body is too large", "zone_body_too_large");
    raw += chunk;
  }
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { throw apiError(400, "Invalid JSON body", "zone_json_invalid"); }
}

async function readJsonBody(request) {
  const payload = await readOptionalJsonBody(request);
  if (!Object.keys(payload).length) throw apiError(400, "JSON body is required", "zone_body_required");
  return payload;
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
  response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: "GET, POST, PUT, OPTIONS" });
  response.end();
}

function apiError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
function clean(value) { return String(value ?? "").trim(); }
