import { corsHeaders } from "../lib/cors.mjs";
import { appendSecurityAudit, getRequestBusinessUserSession } from "../lib/business-access.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { buildMoneyCenter, createMoneyPayment, ensureMoneyCollections, reconcileMoneyRecords, updateMoneyRecord } from "../lib/money-model.mjs";

const MAX_BODY_BYTES = Number(process.env.MONEY_API_MAX_BODY_BYTES || 256 * 1024);

export function isMoneyApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/money(?:\/(?:reconcile|[^/]+(?:\/payments)?))?$/.test(pathname);
}

export async function handleMoneyApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context, "GET, POST, PATCH, OPTIONS");
  try {
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const businessRef = segments[2] || "";
    const resourceId = segments[4] || "";
    const action = segments[5] || "";
    const db = ensureMoneyCollections(await loadBusinessStore(context));
    const business = db.businesses.find((item) => item.id === businessRef || item.slug === businessRef);
    if (!business) throw apiError(404, "Business not found");
    const session = getRequestBusinessUserSession(request);
    const actor = session ? { type: "businessUser", id: session.userId, userId: session.userId, impersonatedBy: session.impersonatedBy } : { type: "admin", id: "admin" };

    if (!resourceId && method === "GET") {
      reconcileMoneyRecords(db, business.id);
      return sendJson(response, 200, { center: buildMoneyCenter(db, business.id, Object.fromEntries(requestUrl.searchParams)) }, context);
    }
    if (resourceId === "reconcile" && method === "POST") {
      const result = reconcileMoneyRecords(db, business.id);
      appendSecurityAudit(db, business.id, actor, "money.reconciled", "money", business.id, result.summary);
      await saveBusinessStore(db, context, "money-reconcile");
      return sendJson(response, 200, result, context);
    }
    const record = db.moneyRecords.find((item) => item.businessId === business.id && item.id === resourceId);
    if (!record) throw apiError(404, "Money record not found");
    if (!action && method === "GET") return sendJson(response, 200, { record: buildMoneyCenter(db, business.id).records.find((item) => item.id === record.id) }, context);
    if (!action && method === "PATCH") {
      const updated = updateMoneyRecord(db, business.id, record.id, await readJsonBody(request));
      appendSecurityAudit(db, business.id, actor, "money.record_updated", "moneyRecord", record.id, { status: updated.status, total: updated.total, currency: updated.currency });
      await saveBusinessStore(db, context, "money-record-update");
      return sendJson(response, 200, { record: updated, center: buildMoneyCenter(db, business.id) }, context);
    }
    if (action === "payments" && method === "POST") {
      const result = createMoneyPayment(db, business.id, record.id, await readJsonBody(request));
      appendSecurityAudit(db, business.id, actor, "money.payment_recorded", "moneyRecord", record.id, { paymentId: result.payment.id, amount: result.payment.amount, currency: result.payment.currency });
      await saveBusinessStore(db, context, "money-payment-create");
      return sendJson(response, result.duplicate ? 200 : 201, { ...result, center: buildMoneyCenter(db, business.id) }, context);
    }
    throw methodNotAllowed("GET, POST, PATCH, OPTIONS");
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: (error.statusCode || 500) >= 500 && process.env.NODE_ENV !== "test" ? "Internal money API error" : error.message, code: error.code || "money_error" }, context, error.allow ? { Allow: error.allow } : {});
  }
}

async function readJsonBody(request) { let raw = ""; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > MAX_BODY_BYTES) throw apiError(413, "Money payload too large"); raw += chunk.toString("utf8"); } try { const value = JSON.parse(raw); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; } catch { throw apiError(400, "Invalid JSON body"); } }
function methodNotAllowed(allow) { const error = apiError(405, "Method not allowed"); error.allow = allow; return error; }
function apiError(statusCode, message, code = "money_error") { return Object.assign(new Error(message), { statusCode, code }); }
function sendJson(response, status, payload, context, extra = {}) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }); response.end(JSON.stringify(payload)); }
function sendEmpty(response, status, context, allow) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: allow }); response.end(); }
