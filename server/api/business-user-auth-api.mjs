import { corsHeaders } from "../lib/cors.mjs";
import {
  authenticateBusinessUser,
  getBusinessUserSessionForRequest,
  issueBusinessUserSession,
  publicBusinessUser
} from "../lib/business-access.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";

const MAX_BODY_BYTES = Number(process.env.BUSINESS_USER_AUTH_MAX_BODY_BYTES || 64 * 1024);

export function isBusinessUserAuthApiRequest(pathname) {
  return pathname === "/api/business-users/login" || pathname === "/api/business-users/session";
}

export async function handleBusinessUserAuthApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context, "GET, POST, OPTIONS");
  try {
    if (requestUrl.pathname === "/api/business-users/login" && method === "POST") {
      const source = await readJsonBody(request);
      const db = await loadBusinessStore(context);
      const { business, user } = await authenticateBusinessUser(db, clean(source.business), source.email, source.password);
      await saveBusinessStore(db, context, "business-user-login");
      const token = issueBusinessUserSession(business, user);
      return sendJson(response, 200, { session: { token, expiresIn: 8 * 60 * 60, business: { id: business.id, slug: business.slug, name: business.name }, user: publicBusinessUser(user) } }, context);
    }
    if (requestUrl.pathname === "/api/business-users/session" && method === "GET") {
      const session = await getBusinessUserSessionForRequest(request, context);
      if (!session) throw apiError(401, "Business user session invalid or expired", "business_user_auth_required");
      return sendJson(response, 200, { session: { businessId: session.businessId, businessSlug: session.businessSlug, user: session.user, impersonatedBy: session.impersonatedBy || "", expiresAt: new Date(Number(session.exp) * 1000).toISOString() } }, context);
    }
    throw methodNotAllowed("GET, POST, OPTIONS");
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: (error.statusCode || 500) >= 500 && process.env.NODE_ENV !== "test" ? "Internal business user auth error" : error.message, code: error.code || "business_user_auth_error" }, context, error.allow ? { Allow: error.allow } : {});
  }
}

async function readJsonBody(request) {
  let raw = ""; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > MAX_BODY_BYTES) throw apiError(413, "Auth payload too large"); raw += chunk.toString("utf8"); }
  try { const value = JSON.parse(raw); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; } catch { throw apiError(400, "Invalid JSON body"); }
}
function methodNotAllowed(allow) { const error = apiError(405, "Method not allowed"); error.allow = allow; return error; }
function apiError(statusCode, message, code = "business_user_auth_error") { return Object.assign(new Error(message), { statusCode, code }); }
function sendJson(response, status, payload, context, extra = {}) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }); response.end(JSON.stringify(payload)); }
function sendEmpty(response, status, context, allow) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: allow }); response.end(); }
function clean(value) { return String(value ?? "").trim(); }
