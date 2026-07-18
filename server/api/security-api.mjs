import { corsHeaders } from "../lib/cors.mjs";
import {
  appendSecurityAudit,
  createBusinessUser,
  ensureBusinessAccessCollections,
  getRequestBusinessUserSession,
  issueBusinessUserSession,
  listBusinessRoles,
  publicBusinessUser,
  requireBusinessUser,
  updateBusinessUser
} from "../lib/business-access.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";

const MAX_BODY_BYTES = Number(process.env.SECURITY_API_MAX_BODY_BYTES || 128 * 1024);

export function isSecurityApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/security(?:\/(?:roles|users(?:\/[^/]+)?|audit|impersonations))?$/.test(pathname);
}

export async function handleSecurityApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context, "GET, POST, PATCH, DELETE, OPTIONS");
  try {
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const businessRef = segments[2] || "";
    const section = segments[4] || "";
    const resourceId = segments[5] || "";
    const db = ensureBusinessAccessCollections(await loadBusinessStore(context));
    const business = db.businesses.find((item) => item.id === businessRef || item.slug === businessRef);
    if (!business) throw apiError(404, "Business not found");
    const session = getRequestBusinessUserSession(request);
    if (session && session.businessId !== business.id) throw apiError(403, "Business user cannot access this business");
    const actor = session ? { type: "businessUser", id: session.userId, userId: session.userId, impersonatedBy: session.impersonatedBy } : { type: "admin", id: "admin" };

    if (!section && method === "GET") return sendJson(response, 200, securityCenter(db, business.id), context);
    if (section === "roles" && method === "GET") return sendJson(response, 200, { roles: listBusinessRoles() }, context);
    if (section === "users" && !resourceId && method === "GET") return sendJson(response, 200, { users: businessUsers(db, business.id) }, context);
    if (section === "users" && !resourceId && method === "POST") {
      const user = await createBusinessUser(db, business, await readJsonBody(request), actor);
      await saveBusinessStore(db, context, "security-user-create");
      return sendJson(response, 201, { user: publicBusinessUser(user), center: securityCenter(db, business.id) }, context);
    }
    if (section === "users" && resourceId && method === "PATCH") {
      const user = await updateBusinessUser(db, business.id, resourceId, await readJsonBody(request), actor);
      await saveBusinessStore(db, context, "security-user-update");
      return sendJson(response, 200, { user: publicBusinessUser(user), center: securityCenter(db, business.id) }, context);
    }
    if (section === "users" && resourceId && method === "DELETE") {
      const user = await updateBusinessUser(db, business.id, resourceId, { active: false }, actor);
      await saveBusinessStore(db, context, "security-user-disable");
      return sendJson(response, 200, { user: publicBusinessUser(user), center: securityCenter(db, business.id) }, context);
    }
    if (section === "audit" && method === "GET") {
      const limit = Math.max(1, Math.min(500, Number(requestUrl.searchParams.get("limit") || 100)));
      return sendJson(response, 200, { events: db.securityAuditEvents.filter((item) => item.businessId === business.id).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit) }, context);
    }
    if (section === "audit" && method === "POST") {
      const source = await readJsonBody(request);
      const event = appendSecurityAudit(db, business.id, actor, "security.export_recorded", clean(source.resource || "unknown"), clean(source.subjectId), { format: clean(source.format || "csv"), count: Number(source.count || 0), reason: clean(source.reason) });
      await saveBusinessStore(db, context, "security-export-audit");
      return sendJson(response, 201, { event }, context);
    }
    if (section === "impersonations" && method === "POST") {
      const source = await readJsonBody(request);
      const target = requireBusinessUser(db, business.id, clean(source.userId));
      if (target.active === false) throw apiError(409, "Disabled users cannot be impersonated");
      const token = issueBusinessUserSession(business, target, { impersonatedBy: actor.id, ttlSeconds: Math.min(3600, Math.max(300, Number(source.ttlSeconds || 1800))) });
      const event = appendSecurityAudit(db, business.id, actor, "security.impersonation_started", "businessUser", target.id, { reason: clean(source.reason), expiresIn: Math.min(3600, Math.max(300, Number(source.ttlSeconds || 1800))) });
      await saveBusinessStore(db, context, "security-impersonation");
      return sendJson(response, 201, { session: { token, user: publicBusinessUser(target), impersonatedBy: actor.id }, event }, context);
    }
    throw methodNotAllowed("GET, POST, PATCH, DELETE, OPTIONS");
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: (error.statusCode || 500) >= 500 && process.env.NODE_ENV !== "test" ? "Internal security API error" : error.message, code: error.code || "security_error" }, context, error.allow ? { Allow: error.allow } : {});
  }
}

function securityCenter(db, businessId) {
  const events = db.securityAuditEvents.filter((item) => item.businessId === businessId).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { roles: listBusinessRoles(), users: businessUsers(db, businessId), audit: events.slice(0, 50), summary: { activeUsers: db.businessUsers.filter((item) => item.businessId === businessId && item.active !== false).length, owners: db.businessUsers.filter((item) => item.businessId === businessId && item.active !== false && item.role === "owner").length, sensitiveEvents: events.length } };
}
function businessUsers(db, businessId) { return db.businessUsers.filter((item) => item.businessId === businessId).map(publicBusinessUser).sort((a, b) => String(a.name).localeCompare(String(b.name), "es")); }
async function readJsonBody(request) { let raw = ""; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > MAX_BODY_BYTES) throw apiError(413, "Security payload too large"); raw += chunk.toString("utf8"); } try { const value = JSON.parse(raw); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; } catch { throw apiError(400, "Invalid JSON body"); } }
function methodNotAllowed(allow) { const error = apiError(405, "Method not allowed"); error.allow = allow; return error; }
function apiError(statusCode, message, code = "security_error") { return Object.assign(new Error(message), { statusCode, code }); }
function sendJson(response, status, payload, context, extra = {}) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }); response.end(JSON.stringify(payload)); }
function sendEmpty(response, status, context, allow) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: allow }); response.end(); }
function clean(value) { return String(value ?? "").trim(); }
