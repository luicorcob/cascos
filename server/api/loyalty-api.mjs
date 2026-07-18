import { corsHeaders } from "../lib/cors.mjs";
import { appendSecurityAudit, getRequestBusinessUserSession } from "../lib/business-access.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import {
  addLoyaltyMovement,
  attributeReferral,
  buildLoyaltyCenter,
  convertReferral,
  ensureLoyaltyAccount,
  ensureLoyaltyCollections,
  issueReferralCode,
  redeemLoyaltyReward,
  upsertLoyaltyProgram,
  upsertLoyaltyReward
} from "../lib/loyalty-model.mjs";

const MAX_BODY_BYTES = Number(process.env.LOYALTY_API_MAX_BODY_BYTES || 256 * 1024);

export function isLoyaltyApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/loyalty(?:\/(?:program|accounts(?:\/[^/]+)?|movements|rewards(?:\/[^/]+(?:\/redeem)?)?|referrals\/(?:codes|attribute|[^/]+\/convert)))?$/.test(pathname);
}

export async function handleLoyaltyApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context, "GET, POST, PUT, PATCH, OPTIONS");
  try {
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const businessRef = segments[2] || "";
    const section = segments[4] || "";
    const resourceId = segments[5] || "";
    const action = segments[6] || "";
    const db = ensureLoyaltyCollections(await loadBusinessStore(context));
    const business = db.businesses.find((item) => item.id === businessRef || item.slug === businessRef);
    if (!business) throw apiError(404, "Business not found");
    const session = getRequestBusinessUserSession(request);
    const actor = session
      ? { type: "businessUser", id: session.userId, userId: session.userId, impersonatedBy: session.impersonatedBy }
      : { type: "admin", id: "admin" };

    if (!section && method === "GET") {
      return sendJson(response, 200, { center: buildLoyaltyCenter(db, business.id) }, context);
    }
    if (section === "program" && ["PUT", "PATCH"].includes(method)) {
      const existing = db.loyaltyPrograms.find((item) => item.businessId === business.id);
      const program = upsertLoyaltyProgram(db, business.id, await readJsonBody(request), existing);
      appendSecurityAudit(db, business.id, actor, "loyalty.program_updated", "loyaltyProgram", program.id, { mode: program.mode });
      await persist(db, context, "loyalty-program");
      return sendJson(response, 200, { program, center: buildLoyaltyCenter(db, business.id) }, context);
    }
    if (section === "accounts" && !resourceId && method === "POST") {
      const source = await readJsonBody(request);
      const account = ensureLoyaltyAccount(db, business.id, clean(source.contactId));
      appendSecurityAudit(db, business.id, actor, "loyalty.account_created", "loyaltyAccount", account.id, { contactId: account.contactId });
      await persist(db, context, "loyalty-account");
      return sendJson(response, 201, { account, center: buildLoyaltyCenter(db, business.id) }, context);
    }
    if (section === "accounts" && resourceId && method === "GET") {
      const center = buildLoyaltyCenter(db, business.id);
      const account = center.accounts.find((item) => item.id === resourceId || item.contactId === resourceId);
      if (!account) throw apiError(404, "Loyalty account not found");
      return sendJson(response, 200, {
        account,
        movements: center.movements.filter((item) => item.accountId === account.id),
        redemptions: center.redemptions.filter((item) => item.accountId === account.id),
        referralCode: center.referralCodes.find((item) => item.contactId === account.contactId) || null
      }, context);
    }
    if (section === "movements" && method === "POST") {
      const result = addLoyaltyMovement(db, business.id, await readJsonBody(request), actor);
      appendSecurityAudit(db, business.id, actor, "loyalty.movement_recorded", "loyaltyMovement", result.movement.id, { type: result.movement.type, amount: result.movement.amount, reason: result.movement.reason });
      await persist(db, context, "loyalty-movement");
      return sendJson(response, result.duplicate ? 200 : 201, { ...result, center: buildLoyaltyCenter(db, business.id) }, context);
    }
    if (section === "rewards" && !resourceId && method === "POST") {
      const reward = upsertLoyaltyReward(db, business.id, await readJsonBody(request));
      appendSecurityAudit(db, business.id, actor, "loyalty.reward_created", "loyaltyReward", reward.id, { cost: reward.cost });
      await persist(db, context, "loyalty-reward-create");
      return sendJson(response, 201, { reward, center: buildLoyaltyCenter(db, business.id) }, context);
    }
    if (section === "rewards" && resourceId && !action && method === "PATCH") {
      const existing = db.loyaltyRewards.find((item) => item.businessId === business.id && item.id === resourceId);
      if (!existing) throw apiError(404, "Reward not found");
      const reward = upsertLoyaltyReward(db, business.id, await readJsonBody(request), existing);
      appendSecurityAudit(db, business.id, actor, "loyalty.reward_updated", "loyaltyReward", reward.id, { cost: reward.cost, active: reward.active });
      await persist(db, context, "loyalty-reward-update");
      return sendJson(response, 200, { reward, center: buildLoyaltyCenter(db, business.id) }, context);
    }
    if (section === "rewards" && resourceId && action === "redeem" && method === "POST") {
      const result = redeemLoyaltyReward(db, business.id, resourceId, await readJsonBody(request), actor);
      appendSecurityAudit(db, business.id, actor, "loyalty.reward_redeemed", "loyaltyReward", resourceId, { redemptionId: result.redemption.id });
      await persist(db, context, "loyalty-reward-redeem");
      return sendJson(response, result.duplicate ? 200 : 201, { ...result, center: buildLoyaltyCenter(db, business.id) }, context);
    }
    if (section === "referrals" && resourceId === "codes" && method === "POST") {
      const source = await readJsonBody(request);
      const code = issueReferralCode(db, business.id, clean(source.contactId));
      appendSecurityAudit(db, business.id, actor, "loyalty.referral_code_issued", "referralCode", code.id, { contactId: code.contactId });
      await persist(db, context, "loyalty-referral-code");
      return sendJson(response, 201, { code, center: buildLoyaltyCenter(db, business.id) }, context);
    }
    if (section === "referrals" && resourceId === "attribute" && method === "POST") {
      const attribution = attributeReferral(db, business.id, await readJsonBody(request));
      appendSecurityAudit(db, business.id, actor, "loyalty.referral_attributed", "referralAttribution", attribution.id, { referrerContactId: attribution.referrerContactId, referredContactId: attribution.referredContactId });
      await persist(db, context, "loyalty-referral-attribute");
      return sendJson(response, 201, { attribution, center: buildLoyaltyCenter(db, business.id) }, context);
    }
    if (section === "referrals" && resourceId && action === "convert" && method === "POST") {
      const result = convertReferral(db, business.id, resourceId, actor);
      appendSecurityAudit(db, business.id, actor, "loyalty.referral_converted", "referralAttribution", resourceId, { rewardMovementIds: result.attribution.rewardMovementIds });
      await persist(db, context, "loyalty-referral-convert");
      return sendJson(response, 200, { ...result, center: buildLoyaltyCenter(db, business.id) }, context);
    }
    throw methodNotAllowed("GET, POST, PUT, PATCH, OPTIONS");
  } catch (error) {
    sendJson(response, error.statusCode || 500, {
      error: (error.statusCode || 500) >= 500 && process.env.NODE_ENV !== "test" ? "Internal loyalty API error" : error.message,
      code: error.code || "loyalty_error"
    }, context, error.allow ? { Allow: error.allow } : {});
  }
}

async function persist(db, context, reason) { await saveBusinessStore(db, context, reason); }
async function readJsonBody(request) {
  let raw = "";
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw apiError(413, "Loyalty payload too large");
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
function apiError(statusCode, message, code = "loyalty_error") { return Object.assign(new Error(message), { statusCode, code }); }
function sendJson(response, status, payload, context, extra = {}) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }); response.end(JSON.stringify(payload)); }
function sendEmpty(response, status, context, allow) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: allow }); response.end(); }
function clean(value) { return String(value ?? "").trim(); }
