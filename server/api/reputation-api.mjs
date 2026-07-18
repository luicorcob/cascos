import { corsHeaders } from "../lib/cors.mjs";
import { getRequestClientSession } from "../lib/client-auth.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { sendChannelMessage } from "../lib/channel-providers.mjs";
import { assertOutboundConsent, ensureOutboundCustomerThread, listChannelConnections, recordOutboundMessage } from "../lib/omnichannel-model.mjs";
import { fetchBusinessProfileReviews, publishBusinessProfileReply } from "../lib/reputation-provider.mjs";
import {
  approveReviewReply,
  buildReputationCenter,
  createReviewReplyDraft,
  createReviewRequest,
  ensureReputationCollections,
  markReviewReplyPublished,
  markReviewRequestSent,
  recordReviewRequestClick,
  syncReputationReviews
} from "../lib/reputation-model.mjs";

const MAX_BODY_BYTES = Number(process.env.REPUTATION_API_MAX_BODY_BYTES || 512 * 1024);

export function isReputationApiRequest(pathname) {
  return /^\/api\/public\/review-requests\/[^/]+$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/reputation(?:\/sync|\/reviews\/[^/]+\/replies(?:\/[^/]+\/(?:approve|publish))?|\/review-requests(?:\/[^/]+\/send)?)?$/.test(pathname);
}

export async function handleReputationApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local"); const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context, "GET, POST, OPTIONS");
  try {
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (segments[1] === "public") return await handlePublic(segments[3] || "", response, context);
    const businessRef = segments[2] || ""; const section = segments[4] || ""; const reviewId = segments[5] || ""; const subresource = segments[6] || ""; const replyId = segments[7] || ""; const action = segments[8] || "";
    const db = ensureReputationCollections(await loadBusinessStore(context)); const business = requireBusiness(db, businessRef); const clientSession = getRequestClientSession(request); if (clientSession && clientSession.businessId !== business.id) throw apiError(403, "Client session cannot access this business"); const readOnly = Boolean(clientSession); const now = new Date().toISOString();
    if (!section && method === "GET") return sendJson(response, 200, { center: buildReputationCenter(db, business.id, new Date(now)) }, context);
    if (readOnly) throw apiError(403, "Reputation changes require admin access");
    if (section === "sync" && method === "POST") {
      const source = await readOptionalJsonBody(request); let providerPayload;
      if (Array.isArray(source.reviews) && process.env.NODE_ENV !== "production") providerPayload = { provider: source.provider || "development", accountId: source.accountId || "dev", locationId: source.locationId || "dev", reviews: source.reviews };
      else providerPayload = await fetchBusinessProfileReviews(context, business, source);
      const result = syncReputationReviews(db, business, providerPayload, now); audit(db, business.id, "reputation.synced", result.run.id, now); await saveBusinessStore(db, context, "reputation-sync"); return sendJson(response, 200, result, context);
    }
    if (section === "reviews" && subresource === "replies" && !replyId && method === "POST") {
      const reply = createReviewReplyDraft(db, business.id, reviewId, await readJsonBody(request), now); audit(db, business.id, "reputation.reply_drafted", reply.id, now); await saveBusinessStore(db, context, "reputation-reply-draft"); return sendJson(response, 201, { reply, center: buildReputationCenter(db, business.id, new Date(now)) }, context);
    }
    if (section === "reviews" && subresource === "replies" && replyId && action === "approve" && method === "POST") {
      const reply = approveReviewReply(db, business.id, reviewId, replyId, await readOptionalJsonBody(request), now); audit(db, business.id, "reputation.reply_approved", reply.id, now); await saveBusinessStore(db, context, "reputation-reply-approve"); return sendJson(response, 200, { reply, center: buildReputationCenter(db, business.id, new Date(now)) }, context);
    }
    if (section === "reviews" && subresource === "replies" && replyId && action === "publish" && method === "POST") {
      const source = await readOptionalJsonBody(request); if (source.confirm !== true) return sendJson(response, 200, { dryRun: true, message: "Reply approved but not published. Send confirm=true after human review." }, context);
      const review = db.reputationReviews.find((item) => item.businessId === business.id && item.id === reviewId); const reply = db.reputationReplies.find((item) => item.businessId === business.id && item.reviewId === reviewId && item.id === replyId); if (!review || !reply) throw apiError(404, "Review or reply not found");
      const providerResult = review.provider === "development" && process.env.NODE_ENV !== "production" ? { provider: "development", published: true } : await publishBusinessProfileReply(context, business, { accountId: review.accountId, locationId: review.locationId, reviewId: review.providerReviewId, comment: reply.comment });
      markReviewReplyPublished(db, business.id, reviewId, replyId, providerResult, now); audit(db, business.id, "reputation.reply_published", reply.id, now); await saveBusinessStore(db, context, "reputation-reply-publish"); return sendJson(response, 200, { reply, center: buildReputationCenter(db, business.id, new Date(now)) }, context);
    }
    if (section === "review-requests" && !reviewId && method === "POST") {
      const source = await readJsonBody(request); const record = createReviewRequest(db, business, source, { publicBaseUrl: requestBaseUrl(request) }, now); if (source.send === true) await deliverReviewRequest(db, business, record, source, now); audit(db, business.id, "review_request.created", record.request.id, now); await saveBusinessStore(db, context, "review-request-create"); return sendJson(response, 201, { request: publicRequest(record.request), center: buildReputationCenter(db, business.id, new Date(now)) }, context);
    }
    if (section === "review-requests" && reviewId && subresource === "send" && method === "POST") {
      const requestRecord = db.reviewRequests.find((item) => item.businessId === business.id && item.id === reviewId); if (!requestRecord) throw apiError(404, "Review request not found"); const contact = db.contacts.find((item) => item.businessId === business.id && item.id === requestRecord.contactId && !item.merged); const booking = db.bookings.find((item) => item.businessId === business.id && item.id === requestRecord.bookingId); await deliverReviewRequest(db, business, { request: requestRecord, contact, booking }, await readOptionalJsonBody(request), now); audit(db, business.id, "review_request.sent", requestRecord.id, now); await saveBusinessStore(db, context, "review-request-send"); return sendJson(response, 200, { request: publicRequest(requestRecord), center: buildReputationCenter(db, business.id, new Date(now)) }, context);
    }
    throw methodNotAllowed("GET, POST, OPTIONS");
  } catch (error) { const status = error.statusCode || 500; sendJson(response, status, { error: status >= 500 && process.env.NODE_ENV !== "test" ? "Internal reputation API error" : error.message, code: error.code || "reputation_error" }, context, error.allow ? { Allow: error.allow } : {}); }
}

async function handlePublic(token, response, context) { const db = ensureReputationCollections(await loadBusinessStore(context)); const request = recordReviewRequestClick(db, token); await saveBusinessStore(db, context, "review-request-click"); response.writeHead(302, { ...context.baseHeaders, ...corsHeaders(context), Location: request.reviewUrl, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }); response.end(); }

async function deliverReviewRequest(db, business, record, source, now) {
  if (!record.contact) throw apiError(404, "Review request contact not found"); const channel = record.request.channel; assertOutboundConsent(db, business.id, record.contact.id, channel, "reviews"); const connection = listChannelConnections(db, business.id).find((item) => item.channel === channel); if (!connection?.active) throw apiError(409, `${channel} connection is not active`);
  const thread = ensureOutboundCustomerThread(db, business, record.contact, channel, { provider: connection.provider, subject: `Tu opinion sobre ${business.name}` }, now); const provider = await sendChannelMessage({ connection, thread, contact: record.contact, message: { subject: `Tu opinion sobre ${business.name}`, body: record.request.message, idempotencyKey: `review-request:${record.request.id}` }, env: process.env }); const message = recordOutboundMessage(db, business, thread, record.contact, { provider: connection.provider, subject: `Tu opinion sobre ${business.name}`, body: record.request.message, idempotencyKey: `review-request:${record.request.id}`, purpose: "reviews" }, provider, now); markReviewRequestSent(record.request, message.providerMessageId, now); return message;
}

function requireBusiness(db, ref) { const business = db.businesses.find((item) => item.id === ref || item.slug === ref); if (!business) throw apiError(404, "Business not found"); return business; }
function publicRequest(request) { const { trackingToken, trackingTokenHash, ...result } = request; return result; }
function audit(db, businessId, type, subjectId, now) { db.auditLog = Array.isArray(db.auditLog) ? db.auditLog : []; db.auditLog.push({ id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, businessId, type, subjectId, createdAt: now }); }
function requestBaseUrl(request) { const protocol = String(request.headers["x-forwarded-proto"] || "http").split(",")[0].trim(); const host = String(request.headers["x-forwarded-host"] || request.headers.host || "127.0.0.1").split(",")[0].trim(); return `${protocol}://${host}`; }
function methodNotAllowed(allow) { const error = apiError(405, "Method not allowed"); error.allow = allow; return error; }
function apiError(statusCode, message, code = "reputation_error") { return Object.assign(new Error(message), { statusCode, code }); }
async function readJsonBody(request) { const value = await readOptionalJsonBody(request); if (!Object.keys(value).length) throw apiError(400, "JSON body is required"); return value; }
async function readOptionalJsonBody(request) { let raw = ""; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > MAX_BODY_BYTES) throw apiError(413, "Reputation payload too large"); raw += chunk.toString("utf8"); } if (!raw.trim()) return {}; try { const value = JSON.parse(raw); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(); return value; } catch { throw apiError(400, "Invalid JSON body"); } }
function sendJson(response, status, payload, context, extra = {}) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }); response.end(JSON.stringify(payload)); }
function sendEmpty(response, status, context, allow) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: allow }); response.end(); }
