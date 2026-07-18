import { corsHeaders } from "../lib/cors.mjs";
import { appendSecurityAudit, getRequestBusinessUserSession } from "../lib/business-access.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import {
  answerMetricQuery,
  buildIntelligenceCenter,
  confirmCopilotAction,
  createCopilotDraft,
  ensureIntelligenceCollections,
  upsertAnalyticsFunnel,
  upsertBusinessGoal,
  upsertPredictionSettings
} from "../lib/intelligence-model.mjs";

const MAX_BODY_BYTES = Number(process.env.INTELLIGENCE_API_MAX_BODY_BYTES || 256 * 1024);

export function isIntelligenceApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/intelligence(?:\/(?:funnels(?:\/[^/]+)?|goals(?:\/[^/]+)?|predictions\/settings|query|copilot\/(?:drafts|actions\/confirm)))?$/.test(pathname);
}

export async function handleIntelligenceApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context, "GET, POST, PUT, PATCH, OPTIONS");
  try {
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const businessRef = segments[2] || "";
    const section = segments[4] || "";
    const resourceId = segments[5] || "";
    const action = segments[6] || "";
    const subAction = segments[7] || "";
    const db = ensureIntelligenceCollections(await loadBusinessStore(context));
    const business = db.businesses.find((item) => item.id === businessRef || item.slug === businessRef);
    if (!business) throw apiError(404, "Business not found");
    const session = getRequestBusinessUserSession(request);
    const actor = session
      ? { type: "businessUser", id: session.userId, userId: session.userId, impersonatedBy: session.impersonatedBy }
      : { type: "admin", id: "admin" };

    if (!section && method === "GET") {
      return sendJson(response, 200, { center: buildIntelligenceCenter(db, business.id, { now: requestUrl.searchParams.get("now") || undefined }) }, context);
    }
    if (section === "funnels" && !resourceId && method === "POST") {
      const funnel = upsertAnalyticsFunnel(db, business.id, await readJsonBody(request));
      appendSecurityAudit(db, business.id, actor, "intelligence.funnel_created", "analyticsFunnel", funnel.id, { steps: funnel.steps.length });
      await persist(db, context, "intelligence-funnel-create");
      return sendJson(response, 201, { funnel, center: buildIntelligenceCenter(db, business.id) }, context);
    }
    if (section === "funnels" && resourceId && method === "PATCH") {
      const existing = db.analyticsFunnels.find((item) => item.businessId === business.id && item.id === resourceId);
      if (!existing) throw apiError(404, "Analytics funnel not found");
      const funnel = upsertAnalyticsFunnel(db, business.id, await readJsonBody(request), existing);
      appendSecurityAudit(db, business.id, actor, "intelligence.funnel_updated", "analyticsFunnel", funnel.id, { steps: funnel.steps.length });
      await persist(db, context, "intelligence-funnel-update");
      return sendJson(response, 200, { funnel, center: buildIntelligenceCenter(db, business.id) }, context);
    }
    if (section === "goals" && !resourceId && method === "POST") {
      const goal = upsertBusinessGoal(db, business.id, await readJsonBody(request));
      appendSecurityAudit(db, business.id, actor, "intelligence.goal_created", "businessGoal", goal.id, { metricKey: goal.metricKey, target: goal.target, scope: goal.scope });
      await persist(db, context, "intelligence-goal-create");
      return sendJson(response, 201, { goal, center: buildIntelligenceCenter(db, business.id) }, context);
    }
    if (section === "goals" && resourceId && method === "PATCH") {
      const existing = db.businessGoals.find((item) => item.businessId === business.id && item.id === resourceId);
      if (!existing) throw apiError(404, "Business goal not found");
      const goal = upsertBusinessGoal(db, business.id, await readJsonBody(request), existing);
      appendSecurityAudit(db, business.id, actor, "intelligence.goal_updated", "businessGoal", goal.id, { metricKey: goal.metricKey, target: goal.target, active: goal.active });
      await persist(db, context, "intelligence-goal-update");
      return sendJson(response, 200, { goal, center: buildIntelligenceCenter(db, business.id) }, context);
    }
    if (section === "predictions" && resourceId === "settings" && ["PUT", "PATCH"].includes(method)) {
      const settings = upsertPredictionSettings(db, business.id, await readJsonBody(request));
      appendSecurityAudit(db, business.id, actor, "intelligence.prediction_settings_updated", "predictionSettings", settings.id, { enabled: settings.enabled, minSampleSize: settings.minSampleSize });
      await persist(db, context, "intelligence-prediction-settings");
      return sendJson(response, 200, { settings, center: buildIntelligenceCenter(db, business.id) }, context);
    }
    if (section === "query" && method === "POST") {
      const source = await readJsonBody(request);
      const result = answerMetricQuery(db, business.id, source.question);
      appendSecurityAudit(db, business.id, actor, "intelligence.metric_queried", "metricDictionary", result.metric?.key || "unmatched", { answered: result.answered });
      await persist(db, context, "intelligence-query-audit");
      return sendJson(response, 200, { result }, context);
    }
    if (section === "copilot" && resourceId === "drafts" && method === "POST") {
      const draft = createCopilotDraft(db, business.id, await readJsonBody(request), actor);
      appendSecurityAudit(db, business.id, actor, "intelligence.copilot_draft_created", "copilotDraft", draft.id, { type: draft.type, targetType: draft.targetType, targetId: draft.targetId });
      await persist(db, context, "intelligence-copilot-draft");
      return sendJson(response, 201, { draft, center: buildIntelligenceCenter(db, business.id) }, context);
    }
    if (section === "copilot" && resourceId === "actions" && action === "confirm" && !subAction && method === "POST") {
      const result = confirmCopilotAction(db, business.id, await readJsonBody(request), actor);
      appendSecurityAudit(db, business.id, actor, "intelligence.copilot_action_confirmed", "copilotAction", result.event.id, { draftId: result.draft.id, action: result.event.action, targetType: result.event.targetType, targetId: result.event.targetId });
      await persist(db, context, "intelligence-copilot-confirm");
      return sendJson(response, result.duplicate ? 200 : 201, { ...result, center: buildIntelligenceCenter(db, business.id) }, context);
    }
    throw methodNotAllowed("GET, POST, PUT, PATCH, OPTIONS");
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: (error.statusCode || 500) >= 500 && process.env.NODE_ENV !== "test" ? "Internal intelligence API error" : error.message,
      code: error.code || "intelligence_error"
    }, context, error.allow ? { Allow: error.allow } : {});
  }
}

async function persist(db, context, reason) { await saveBusinessStore(db, context, reason); }
async function readJsonBody(request) {
  let raw = "";
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw apiError(413, "Intelligence payload too large");
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
function apiError(statusCode, message, code = "intelligence_error") { return Object.assign(new Error(message), { statusCode, code }); }
function sendJson(response, status, payload, context, extra = {}) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }); response.end(JSON.stringify(payload)); }
function sendEmpty(response, status, context, allow) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: allow }); response.end(); }
