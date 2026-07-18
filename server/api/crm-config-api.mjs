import { corsHeaders } from "../lib/cors.mjs";
import { appendSecurityAudit, getRequestBusinessUserSession } from "../lib/business-access.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import {
  archiveCrmConfigRecord,
  buildCrmConfigCenter,
  ensureCrmConfigCollections,
  upsertCustomFieldDefinition,
  upsertPipelineRule,
  upsertSavedView,
  validateCustomFieldValues
} from "../lib/crm-config-model.mjs";

const MAX_BODY_BYTES = Number(process.env.CRM_CONFIG_API_MAX_BODY_BYTES || 256 * 1024);
const COLLECTION_BY_SECTION = Object.freeze({ fields: "customFieldDefinitions", views: "savedViews", "pipeline-rules": "pipelineRules" });

export function isCrmConfigApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/crm-config(?:\/(?:fields|views|pipeline-rules)(?:\/[^/]+)?|\/validate)?$/.test(pathname);
}

export async function handleCrmConfigApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context, "GET, POST, PATCH, DELETE, OPTIONS");
  try {
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const businessRef = segments[2] || "";
    const section = segments[4] || "";
    const resourceId = segments[5] || "";
    const db = ensureCrmConfigCollections(await loadBusinessStore(context));
    const business = db.businesses.find((item) => item.id === businessRef || item.slug === businessRef);
    if (!business) throw apiError(404, "Business not found");
    const session = getRequestBusinessUserSession(request);
    const actorRole = session?.userRole || "owner";
    const actor = session ? { type: "businessUser", id: session.userId, userId: session.userId, impersonatedBy: session.impersonatedBy } : { type: "admin", id: "admin" };

    if (!section && method === "GET") return sendJson(response, 200, { center: buildCrmConfigCenter(db, business.id) }, context);
    if (section === "validate" && method === "POST") {
      const source = await readJsonBody(request);
      const result = validateCustomFieldValues(db, business.id, clean(source.entityType), source.values, actorRole);
      return sendJson(response, result.valid ? 200 : 422, result, context);
    }
    const collection = COLLECTION_BY_SECTION[section];
    if (!collection) throw apiError(404, "CRM configuration section not found");
    const existing = resourceId ? db[collection].find((item) => item.businessId === business.id && item.id === resourceId && item.archived !== true) : null;
    if (resourceId && !existing) throw apiError(404, "CRM configuration record not found");
    if (!resourceId && method === "GET") return sendJson(response, 200, { items: db[collection].filter((item) => item.businessId === business.id && item.archived !== true) }, context);
    if (!resourceId && method === "POST") {
      const source = await readJsonBody(request);
      const item = createOrUpdate(section, db, business.id, source, null);
      appendSecurityAudit(db, business.id, actor, "crm_config.created", section, item.id, {});
      await saveBusinessStore(db, context, `crm-config-${section}-create`);
      return sendJson(response, 201, { item, center: buildCrmConfigCenter(db, business.id) }, context);
    }
    if (resourceId && method === "PATCH") {
      const item = createOrUpdate(section, db, business.id, await readJsonBody(request), existing);
      appendSecurityAudit(db, business.id, actor, "crm_config.updated", section, item.id, {});
      await saveBusinessStore(db, context, `crm-config-${section}-update`);
      return sendJson(response, 200, { item, center: buildCrmConfigCenter(db, business.id) }, context);
    }
    if (resourceId && method === "DELETE") {
      const item = archiveCrmConfigRecord(db, business.id, collection, resourceId);
      appendSecurityAudit(db, business.id, actor, "crm_config.archived", section, item.id, {});
      await saveBusinessStore(db, context, `crm-config-${section}-archive`);
      return sendJson(response, 200, { item, center: buildCrmConfigCenter(db, business.id) }, context);
    }
    throw methodNotAllowed("GET, POST, PATCH, DELETE, OPTIONS");
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: (error.statusCode || 500) >= 500 && process.env.NODE_ENV !== "test" ? "Internal CRM configuration API error" : error.message, code: error.code || "crm_config_error", errors: error.errors || [] }, context, error.allow ? { Allow: error.allow } : {});
  }
}

function createOrUpdate(section, db, businessId, source, existing) {
  if (section === "fields") return upsertCustomFieldDefinition(db, businessId, source, existing);
  if (section === "views") return upsertSavedView(db, businessId, source, existing);
  return upsertPipelineRule(db, businessId, source, existing);
}
async function readJsonBody(request) { let raw = ""; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > MAX_BODY_BYTES) throw apiError(413, "CRM configuration payload too large"); raw += chunk.toString("utf8"); } try { const value = JSON.parse(raw); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; } catch { throw apiError(400, "Invalid JSON body"); } }
function methodNotAllowed(allow) { const error = apiError(405, "Method not allowed"); error.allow = allow; return error; }
function apiError(statusCode, message, code = "crm_config_error") { return Object.assign(new Error(message), { statusCode, code }); }
function sendJson(response, status, payload, context, extra = {}) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }); response.end(JSON.stringify(payload)); }
function sendEmpty(response, status, context, allow) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: allow }); response.end(); }
function clean(value) { return String(value ?? "").trim(); }
