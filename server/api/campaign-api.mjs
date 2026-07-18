import { corsHeaders } from "../lib/cors.mjs";
import { getRequestClientSession } from "../lib/client-auth.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { sendChannelMessage } from "../lib/channel-providers.mjs";
import { assertOutboundConsent, ensureOutboundCustomerThread, listChannelConnections, recordOutboundMessage } from "../lib/omnichannel-model.mjs";
import {
  LIFECYCLE_CAMPAIGN_TEMPLATES,
  createCampaign,
  ensureCampaignCollections,
  getCampaign,
  listCampaigns,
  previewCampaign,
  processCampaignBatch,
  scheduleCampaign,
  setCampaignStatus,
  updateCampaign
} from "../lib/campaign-model.mjs";

const MAX_BODY_BYTES = Number(process.env.CAMPAIGN_API_MAX_BODY_BYTES || 512 * 1024);

export function isCampaignApiRequest(pathname) { return /^\/api\/businesses\/[^/]+\/campaigns(?:\/.*)?$/.test(pathname); }

export async function handleCampaignApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://dls.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context, "GET, POST, PATCH, DELETE, OPTIONS");
  try {
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const db = ensureCampaignCollections(await loadBusinessStore(context));
    const business = requireBusiness(db, segments[2]);
    const clientSession = getRequestClientSession(request);
    if (clientSession && clientSession.businessId !== business.id) throw apiError(403, "Client session cannot access this business");
    const campaignId = segments[4] || "";
    const action = segments[5] || "";
    if (!campaignId) {
      if (method === "GET") return sendJson(response, 200, { campaigns: listCampaigns(db, business.id), templates: LIFECYCLE_CAMPAIGN_TEMPLATES }, context);
      requireAdmin(clientSession);
      if (method === "POST") { const campaign = createCampaign(db, business.id, requireObject(await readJsonBody(request))); await saveBusinessStore(db, context, "campaign-create"); return sendJson(response, 201, { campaign }, context); }
      throw methodNotAllowed("GET, POST, OPTIONS");
    }
    if (campaignId === "templates") {
      if (method !== "GET") throw methodNotAllowed("GET, OPTIONS");
      return sendJson(response, 200, { templates: LIFECYCLE_CAMPAIGN_TEMPLATES }, context);
    }
    if (!action) {
      if (method === "GET") return sendJson(response, 200, { campaign: getCampaign(db, business.id, campaignId) }, context);
      requireAdmin(clientSession);
      if (method === "PATCH") { const campaign = updateCampaign(db, business.id, campaignId, requireObject(await readJsonBody(request))); await saveBusinessStore(db, context, "campaign-update"); return sendJson(response, 200, { campaign }, context); }
      if (method === "DELETE") { const campaign = setCampaignStatus(db, business.id, campaignId, "cancelled"); await saveBusinessStore(db, context, "campaign-cancel"); return sendJson(response, 200, { campaign }, context); }
      throw methodNotAllowed("GET, PATCH, DELETE, OPTIONS");
    }
    requireAdmin(clientSession);
    if (action === "preview" && method === "POST") return sendJson(response, 200, { preview: previewCampaign(db, business.id, campaignId, requireObject(await readJsonBody(request))) }, context);
    if (action === "schedule" && method === "POST") { const result = scheduleCampaign(db, business.id, campaignId, requireObject(await readJsonBody(request))); await saveBusinessStore(db, context, "campaign-schedule"); return sendJson(response, 200, result, context); }
    if (action === "process" && method === "POST") { const source = requireObject(await readJsonBody(request)); const result = await processCampaignBatch(db, business.id, campaignId, { now: source.now, sendExecutor: createCampaignSendExecutor(context, business) }); await saveBusinessStore(db, context, "campaign-process"); return sendJson(response, 200, result, context); }
    if (action === "status" && method === "PATCH") { const campaign = setCampaignStatus(db, business.id, campaignId, requireObject(await readJsonBody(request)).status); await saveBusinessStore(db, context, "campaign-status"); return sendJson(response, 200, { campaign }, context); }
    throw apiError(404, "Campaign action not found");
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, { error: status >= 500 && process.env.NODE_ENV !== "test" ? "Internal campaign API error" : error.message, code: error.code || "campaign_error" }, context, error.allow ? { Allow: error.allow } : {});
  }
}

export function createCampaignSendExecutor(context, business) {
  return async ({ db, campaign, recipient, contact, now }) => {
    const connection = listChannelConnections(db, business.id, process.env).find((item) => item.channel === campaign.channel);
    if (!connection) throw apiError(409, "Channel connection not found");
    assertOutboundConsent(db, business.id, contact.id, campaign.channel, campaign.purpose);
    const thread = ensureOutboundCustomerThread(db, business, contact, campaign.channel, { provider: connection.provider, subject: campaign.snapshot?.subject || campaign.subject }, now);
    const render = (value) => String(value ?? "").replace(/\{\{\s*contact\.([A-Za-z0-9_]+)\s*\}\}/g, (_, key) => String(contact?.[key] ?? ""));
    const input = { body: recipient.renderedBody || render(campaign.snapshot?.body || campaign.body), subject: recipient.renderedSubject || render(campaign.snapshot?.subject || campaign.subject), purpose: campaign.purpose, senderName: campaign.name, attachments: [], actorId: "campaign-engine", idempotencyKey: `campaign_${campaign.id}_${recipient.id}`, provider: connection.provider };
    const provider = await sendChannelMessage({ connection, thread, contact, message: input, env: process.env, fetchImpl: context.fetchImpl });
    const message = recordOutboundMessage(db, business, thread, contact, input, provider, now);
    message.campaignId = campaign.id;
    message.campaignRecipientId = recipient.id;
    return { providerMessageId: message.providerMessageId, messageId: message.id, deliveryStatus: message.deliveryStatus };
  };
}

function requireAdmin(clientSession) { if (clientSession) throw apiError(403, "Campaign changes require admin access"); }
function requireBusiness(db, ref) { const business = db.businesses.find((item) => item.id === ref || item.slug === ref); if (!business) throw apiError(404, "Business not found"); return business; }
function requireObject(value) { if (!value || typeof value !== "object" || Array.isArray(value)) throw apiError(400, "JSON body must be an object"); return value; }
function methodNotAllowed(allow) { const error = apiError(405, "Method not allowed"); error.allow = allow; return error; }
function apiError(statusCode, message, code = "campaign_error") { return Object.assign(new Error(message), { statusCode, code }); }
async function readJsonBody(request) { let raw = ""; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > MAX_BODY_BYTES) throw apiError(413, "Campaign payload too large"); raw += chunk.toString("utf8"); } if (!raw.trim()) return {}; try { return JSON.parse(raw); } catch { throw apiError(400, "Invalid JSON body"); } }
function sendJson(response, status, payload, context, extra = {}) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra }); response.end(JSON.stringify(payload)); }
function sendEmpty(response, status, context, allow) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: allow }); response.end(); }
