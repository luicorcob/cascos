import { corsHeaders } from "../lib/cors.mjs";
import { getRequestClientSession } from "../lib/client-auth.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { applySequenceSignal } from "../lib/automation-engine.mjs";
import { recordCampaignConversion } from "../lib/campaign-model.mjs";
import { createQuoteCheckoutSession, verifyQuotePaymentWebhook } from "../lib/quote-payment-provider.mjs";
import {
  addProposalComment,
  applyCheckoutProviderResult,
  approveProposalDiscount,
  completeQuoteCheckout,
  createProposalShare,
  createProposalVersion,
  createQuoteCheckoutRecord,
  decideProposal,
  decorateQuoteProposal,
  ensureAcceptedQuoteOutputs,
  ensureQuoteCollections,
  listProposalVersions,
  publicProposalPayload,
  recordProposalView,
  resolveProposalShare,
  revokeProposalShare
} from "../lib/quote-to-cash.mjs";
import { dispatchAutomationEvent } from "./automation-api.mjs";

const MAX_BODY_BYTES = Number(process.env.QUOTE_API_MAX_BODY_BYTES || 512 * 1024);

export function isQuoteApiRequest(pathname) {
  return /^\/api\/public\/quotes\/[^/]+(?:\/(?:comments|decision|checkout))?$/.test(pathname)
    || pathname === "/api/webhooks/stripe/quotes"
    || /^\/api\/businesses\/[^/]+\/proposals\/[^/]+\/(?:versions|share|timeline|approval|outputs)(?:\/[^/]+)?$/.test(pathname);
}

export async function handleQuoteApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://dls.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context, "GET, POST, PATCH, DELETE, OPTIONS");
  try {
    if (requestUrl.pathname === "/api/webhooks/stripe/quotes") return await handlePaymentWebhook(request, response, context);
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (segments[1] === "public" && segments[2] === "quotes") return await handlePublicQuote({ request, response, context, method, token: segments[3] || "", action: segments[4] || "" });
    return await handleAdminQuote({ request, response, context, method, businessRef: segments[2] || "", proposalId: segments[4] || "", action: segments[5] || "", resourceId: segments[6] || "" });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, { error: status >= 500 && process.env.NODE_ENV !== "test" ? "Internal quote-to-cash API error" : error.message, code: error.code || "quote_to_cash_error" }, context, error.allow ? { Allow: error.allow } : {});
  }
}

async function handleAdminQuote(input) {
  const { request, response, context, method, businessRef, proposalId, action, resourceId } = input;
  const db = ensureQuoteCollections(await loadBusinessStore(context));
  const business = requireBusiness(db, businessRef);
  const proposal = requireProposal(db, business.id, proposalId);
  const clientSession = getRequestClientSession(request);
  if (clientSession && clientSession.businessId !== business.id) throw apiError(403, "Client session cannot access this business");
  const readOnly = Boolean(clientSession);
  if (action === "versions") {
    if (method === "GET") return sendJson(response, 200, { versions: listProposalVersions(db, business.id, proposal.id) }, context);
    if (readOnly) throw apiError(403, "Proposal changes require admin access");
    if (method === "POST") { const version = createProposalVersion(db, proposal, requireObject(await readJsonBody(request))); await saveBusinessStore(db, context, "proposal-version"); return sendJson(response, 201, { version, proposal: decorateQuoteProposal(db, proposal) }, context); }
    throw methodNotAllowed("GET, POST, OPTIONS");
  }
  if (action === "share") {
    if (resourceId && method === "DELETE") { if (readOnly) throw apiError(403, "Proposal changes require admin access"); const share = revokeProposalShare(db, business.id, proposal.id, resourceId); await saveBusinessStore(db, context, "proposal-share-revoke"); return sendJson(response, 200, { share, proposal: decorateQuoteProposal(db, proposal) }, context); }
    if (method === "GET") return sendJson(response, 200, { shares: decorateQuoteProposal(db, proposal).shares }, context);
    if (readOnly) throw apiError(403, "Proposal changes require admin access");
    if (method === "POST") { const source = requireObject(await readJsonBody(request)); const share = createProposalShare(db, business, proposal, { ...source, publicBaseUrl: source.publicBaseUrl || requestBaseUrl(request) }); await saveBusinessStore(db, context, "proposal-share"); return sendJson(response, 201, { ...share, proposal: decorateQuoteProposal(db, proposal) }, context); }
    throw methodNotAllowed("GET, POST, DELETE, OPTIONS");
  }
  if (action === "timeline" && method === "GET") return sendJson(response, 200, { proposal: decorateQuoteProposal(db, proposal) }, context);
  if (action === "approval") {
    if (readOnly) throw apiError(403, "Proposal changes require admin access");
    if (method !== "POST") throw methodNotAllowed("POST, OPTIONS");
    const updated = approveProposalDiscount(db, business.id, proposal.id, requireObject(await readJsonBody(request)));
    await saveBusinessStore(db, context, "proposal-approval");
    return sendJson(response, 200, { proposal: updated }, context);
  }
  if (action === "outputs") {
    if (method !== "POST") throw methodNotAllowed("POST, OPTIONS");
    if (readOnly) throw apiError(403, "Proposal changes require admin access");
    const contact = requireContact(db, business.id, proposal.contactId);
    const outputs = ensureAcceptedQuoteOutputs(db, business, contact, proposal);
    await saveBusinessStore(db, context, "proposal-output-reconcile");
    return sendJson(response, 200, { outputs, proposal: decorateQuoteProposal(db, proposal) }, context);
  }
  throw apiError(404, "Quote-to-cash action not found");
}

async function handlePublicQuote(input) {
  const { request, response, context, method, token, action } = input;
  const db = ensureQuoteCollections(await loadBusinessStore(context));
  const now = new Date().toISOString();
  const quoteContext = resolveProposalShare(db, token, now);
  if (!action && method === "GET") {
    recordProposalView(db, quoteContext, requestMeta(request), now);
    await saveBusinessStore(db, context, "proposal-view");
    return sendJson(response, 200, publicProposalPayload(db, quoteContext), context);
  }
  if (action === "comments" && method === "POST") {
    const comment = addProposalComment(db, quoteContext, requireObject(await readJsonBody(request)), now);
    await saveBusinessStore(db, context, "proposal-comment");
    return sendJson(response, 201, { comment, proposal: publicProposalPayload(db, quoteContext) }, context);
  }
  if (action === "decision" && method === "POST") {
    const source = requireObject(await readJsonBody(request));
    const result = decideProposal(db, quoteContext, { ...source, idempotencyKey: source.idempotencyKey || request.headers["idempotency-key"] }, requestMeta(request), now);
    let configurableAutomations = [];
    if (result.decision.decision === "accepted" && !result.duplicate) {
      applySequenceSignal(db, quoteContext.business.id, quoteContext.proposal.contactId, "proposal_accepted", now);
      recordCampaignConversion(db, quoteContext.business.id, quoteContext.proposal.contactId, { type: "proposal_accepted", revenue: quoteContext.proposal.total || quoteContext.proposal.setupPrice + quoteContext.proposal.monthlyPrice }, now);
      configurableAutomations = await dispatchAutomationEvent(db, quoteContext.business, { id: `proposal-decision:${result.decision.id}`, type: "record.updated", entity: "proposal", entityId: quoteContext.proposal.id, contactId: quoteContext.proposal.contactId, payload: { ...quoteContext.proposal, publicDecision: result.decision.decision }, occurredAt: now }, context);
    }
    await saveBusinessStore(db, context, "proposal-decision");
    return sendJson(response, 200, { ...result, proposal: publicProposalPayload(db, quoteContext), configurableAutomations }, context);
  }
  if (action === "checkout" && method === "POST") {
    const source = requireObject(await readJsonBody(request));
    const record = createQuoteCheckoutRecord(db, quoteContext, { ...source, idempotencyKey: source.idempotencyKey || request.headers["idempotency-key"] }, now);
    if (!record.checkout.checkoutUrl) {
      const base = requestBaseUrl(request);
      const pageUrl = `${base}/pages/proposal.html?quote=${encodeURIComponent(token)}`;
      const provider = await createQuoteCheckoutSession({ checkoutId: record.checkout.id, proposalId: quoteContext.proposal.id, invoiceId: record.checkout.invoiceId, businessId: quoteContext.business.id, amount: record.checkout.amount, currency: record.checkout.currency, name: quoteContext.proposal.title || `Propuesta ${quoteContext.proposal.id}`, description: quoteContext.proposal.conditions, customerEmail: quoteContext.contact.email, successUrl: `${pageUrl}&payment=success`, cancelUrl: `${pageUrl}&payment=cancelled`, idempotencyKey: record.checkout.idempotencyKey });
      applyCheckoutProviderResult(db, record.checkout.id, provider, now);
    }
    await saveBusinessStore(db, context, "proposal-checkout");
    return sendJson(response, record.duplicate ? 200 : 201, { checkout: record.checkout, duplicate: record.duplicate, invoice: record.invoice, schedule: record.schedule }, context);
  }
  throw methodNotAllowed("GET, POST, OPTIONS");
}

async function handlePaymentWebhook(request, response, context) {
  if ((request.method || "GET") !== "POST") throw methodNotAllowed("POST, OPTIONS");
  const rawBody = await readRawBody(request);
  const event = await verifyQuotePaymentWebhook(rawBody, request.headers, { env: process.env });
  if (event.ignored) return sendJson(response, 200, { received: true, ignored: true, type: event.type }, context);
  const db = ensureQuoteCollections(await loadBusinessStore(context));
  const result = completeQuoteCheckout(db, event);
  if (result.completed) await saveBusinessStore(db, context, "proposal-payment-webhook");
  return sendJson(response, 200, { received: true, eventId: event.id, ...result }, context);
}

function requestMeta(request) { const forwarded = String(request.headers["x-forwarded-for"] || "").split(",")[0].trim(); return { ip: forwarded || request.socket?.remoteAddress || "", userAgent: String(request.headers["user-agent"] || ""), referrer: String(request.headers.referer || ""), fingerprint: `${forwarded || request.socket?.remoteAddress || ""}:${String(request.headers["user-agent"] || "")}` }; }
function requestBaseUrl(request) { const protocol = String(request.headers["x-forwarded-proto"] || "http").split(",")[0].trim(); const host = String(request.headers["x-forwarded-host"] || request.headers.host || "127.0.0.1").split(",")[0].trim(); return `${protocol}://${host}`; }
function requireBusiness(db, ref) { const business = db.businesses.find((item) => item.id === ref || item.slug === ref); if (!business) throw apiError(404, "Business not found"); return business; }
function requireProposal(db, businessId, proposalId) { const proposal = db.proposals.find((item) => item.businessId === businessId && item.id === proposalId); if (!proposal) throw apiError(404, "Proposal not found"); return proposal; }
function requireContact(db, businessId, contactId) { const contact = db.contacts.find((item) => item.businessId === businessId && item.id === contactId && !item.merged); if (!contact) throw apiError(404, "Contact not found"); return contact; }
function requireObject(value) { if (!value || typeof value !== "object" || Array.isArray(value)) throw apiError(400, "JSON body must be an object"); return value; }
function methodNotAllowed(allow) { const error = apiError(405, "Method not allowed"); error.allow = allow; return error; }
function apiError(statusCode, message, code = "quote_to_cash_error") { return Object.assign(new Error(message), { statusCode, code }); }
async function readJsonBody(request) { const raw = await readRawBody(request); try { return JSON.parse(raw); } catch { throw apiError(400, "Invalid JSON body"); } }
async function readRawBody(request) { let raw = ""; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > MAX_BODY_BYTES) throw apiError(413, "Quote payload too large"); raw += chunk.toString("utf8"); } if (!raw.trim()) throw apiError(400, "JSON body is required"); return raw; }
function sendJson(response, status, payload, context, extra = {}) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }); response.end(JSON.stringify(payload)); }
function sendEmpty(response, status, context, allow) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: allow }); response.end(); }
