import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { corsHeaders } from "../lib/cors.mjs";
import { getRequestClientSession } from "../lib/client-auth.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { sendChannelMessage, retrieveResendEmail } from "../lib/channel-providers.mjs";
import {
  acquireThreadLock,
  addInternalNote,
  assertOutboundConsent,
  buildChannelInbox,
  ensureOmnichannelCollections,
  ingestInboundMessage,
  listChannelConnections,
  markCustomerThreadRead,
  recordDeliveryStatus,
  recordOutboundMessage,
  releaseThreadLock,
  requireCustomerThread,
  requireThreadContact,
  saveChannelConnection,
  updateCustomerThread
} from "../lib/omnichannel-model.mjs";
import { normalizeDevelopmentWebhook, normalizeResendWebhook, normalizeWhatsAppWebhook, verifyMetaWebhook, verifyResendWebhook } from "../lib/channel-webhooks.mjs";
import { applySequenceSignal, recordSequenceMetric } from "../lib/automation-engine.mjs";
import { dispatchAutomationEvent } from "./automation-api.mjs";
import { recordCampaignDelivery, recordCampaignResponse } from "../lib/campaign-model.mjs";

const MAX_BODY_BYTES = Number(process.env.CHANNEL_API_MAX_BODY_BYTES || 2 * 1024 * 1024);
const PURPOSES = new Set(["service", "marketing", "reviews"]);

export function isChannelApiRequest(pathname) {
  return /^\/api\/webhooks\/[^/]+\/(?:email|whatsapp)$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/channels(?:\/(?:connections(?:\/(?:email|whatsapp))?|inbox|conversations\/[^/]+(?:\/(?:messages|notes|read|lock))?))?$/.test(pathname);
}

export async function handleChannelApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://dls.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context, "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  try {
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (segments[1] === "webhooks") return await handleWebhook({ request, response, context, requestUrl, method, businessRef: segments[2], channel: segments[3] });
    return await handleBusinessChannels({ request, response, context, requestUrl, method, businessRef: segments[2], area: segments[4] || "", resourceId: segments[5] || "", action: segments[6] || "" });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, { error: status >= 500 && !error.expose ? "Internal channel API error" : error.message, code: error.code || "channel_error", ...(error.extra || {}) }, context, error.allow ? { Allow: error.allow } : {});
  }
}

async function handleBusinessChannels(input) {
  const { request, response, context, requestUrl, method, businessRef, area, resourceId, action } = input;
  const db = ensureOmnichannelCollections(await loadBusinessStore(context));
  const business = requireBusiness(db, businessRef);
  const clientSession = getRequestClientSession(request);
  if (clientSession && clientSession.businessId !== business.id) throw apiError(403, "Client session cannot access this business");

  if (!area || area === "connections") {
    if (!resourceId && method === "GET") return sendJson(response, 200, { connections: listChannelConnections(db, business.id, process.env) }, context);
    if (resourceId && method === "PUT") {
      if (clientSession) throw apiError(403, "Channel connection settings require admin access");
      const source = requireObject(await readJsonBody(request));
      const connection = saveChannelConnection(db, business.id, { ...source, channel: resourceId });
      await saveBusinessStore(db, context, "channel-connection");
      return sendJson(response, 200, { connection: listChannelConnections(db, business.id, process.env).find((item) => item.channel === connection.channel) }, context);
    }
    throw methodNotAllowed("GET, PUT, OPTIONS");
  }

  if (area === "inbox") {
    if (method !== "GET") throw methodNotAllowed("GET, OPTIONS");
    const inbox = buildChannelInbox(db, business.id, { channel: requestUrl.searchParams.get("channel"), status: requestUrl.searchParams.get("status"), ownerId: requestUrl.searchParams.get("ownerId"), search: requestUrl.searchParams.get("search"), env: process.env });
    return sendJson(response, 200, { inbox }, context);
  }

  if (area !== "conversations" || !resourceId) throw apiError(404, "Channel resource not found");
  const thread = requireCustomerThread(db, business.id, resourceId);

  if (!action && method === "PATCH") {
    const source = requireObject(await readJsonBody(request));
    const updated = updateCustomerThread(db, business.id, thread.id, source);
    await saveBusinessStore(db, context, "channel-thread-update");
    return sendJson(response, 200, { conversation: buildChannelInbox(db, business.id, { env: process.env }).conversations.find((item) => item.id === updated.id) }, context);
  }
  if (action === "messages" && method === "POST") return await sendOutbound({ request, response, context, db, business, thread });
  if (action === "notes" && method === "POST") {
    const note = addInternalNote(db, business.id, thread.id, requireObject(await readJsonBody(request)));
    await saveBusinessStore(db, context, "channel-internal-note");
    return sendJson(response, 201, { note }, context);
  }
  if (action === "read" && method === "POST") {
    const updated = markCustomerThreadRead(db, business.id, thread.id);
    await saveBusinessStore(db, context, "channel-thread-read");
    return sendJson(response, 200, { conversation: updated }, context);
  }
  if (action === "lock" && method === "POST") {
    const lock = acquireThreadLock(db, business.id, thread.id, requireObject(await readJsonBody(request)));
    await saveBusinessStore(db, context, "channel-thread-lock");
    return sendJson(response, 200, { lock }, context);
  }
  if (action === "lock" && method === "DELETE") {
    const actorId = clean(requestUrl.searchParams.get("actorId"));
    const updated = releaseThreadLock(db, business.id, thread.id, actorId);
    await saveBusinessStore(db, context, "channel-thread-unlock");
    return sendJson(response, 200, { conversation: updated }, context);
  }
  throw methodNotAllowed("POST, PATCH, DELETE, OPTIONS");
}

async function sendOutbound({ request, response, context, db, business, thread }) {
  const source = requireObject(await readJsonBody(request));
  const body = requiredText(source.body, "body", 20000);
  const purpose = clean(source.purpose || "service");
  if (!PURPOSES.has(purpose)) throw apiError(400, "Invalid message purpose");
  const actorId = clean(source.actorId);
  if (thread.lockedById && Date.parse(thread.lockExpiresAt || "") > Date.now() && thread.lockedById !== actorId) throw apiError(409, `Conversation is being handled by ${thread.lockedByName || thread.lockedById}`, "conversation_locked");
  const contact = requireThreadContact(db, business.id, thread);
  assertOutboundConsent(db, business.id, contact.id, thread.channel, purpose);
  const connection = listChannelConnections(db, business.id, process.env).find((item) => item.channel === thread.channel);
  if (!connection) throw apiError(409, "Channel connection not found");
  const idempotencyKey = clean(source.idempotencyKey) || `dls_${thread.id}_${randomUUID()}`;
  const existing = db.communicationMessages.find((message) => message.businessId === business.id && message.idempotencyKey === idempotencyKey);
  if (existing) return sendJson(response, 200, { message: existing, duplicate: true }, context);
  const providerInput = { body, subject: optionalText(source.subject, 500), purpose, senderName: optionalText(source.senderName, 160) || "Equipo", attachments: normalizeAttachments(source.attachments), actorId, idempotencyKey, provider: connection.provider };
  try {
    const providerResult = await sendChannelMessage({ connection, thread, contact, message: providerInput, env: process.env, fetchImpl: context.fetchImpl });
    const message = recordOutboundMessage(db, business, thread, contact, providerInput, providerResult);
    await saveBusinessStore(db, context, "channel-message-send");
    return sendJson(response, 201, { message, conversation: buildChannelInbox(db, business.id, { env: process.env }).conversations.find((item) => item.id === thread.id), provider: { mode: connection.mode, status: message.deliveryStatus } }, context);
  } catch (error) {
    const failed = recordOutboundMessage(db, business, thread, contact, providerInput, { providerMessageId: `failed_${randomUUID()}`, deliveryStatus: "failed", deliveryError: error.message });
    await saveBusinessStore(db, context, "channel-message-failed");
    throw Object.assign(apiError(error.statusCode || 502, error.message, error.code || "provider_send_failed"), { expose: true, extra: { message: failed } });
  }
}

async function handleWebhook({ request, response, context, requestUrl, method, businessRef, channel }) {
  if (channel === "whatsapp" && method === "GET") {
    const mode = requestUrl.searchParams.get("hub.mode");
    const token = requestUrl.searchParams.get("hub.verify_token");
    const challenge = requestUrl.searchParams.get("hub.challenge") || "";
    if (mode !== "subscribe" || !secureEqual(token, process.env.WHATSAPP_VERIFY_TOKEN || "")) throw apiError(403, "WhatsApp webhook verification failed");
    response.writeHead(200, { ...context.baseHeaders, "Content-Type": "text/plain; charset=utf-8" });
    response.end(challenge);
    return;
  }
  if (method !== "POST") throw methodNotAllowed("POST, OPTIONS");
  const db = ensureOmnichannelCollections(await loadBusinessStore(context));
  const business = requireBusiness(db, businessRef);
  const connection = listChannelConnections(db, business.id, process.env).find((item) => item.channel === channel);
  if (!connection?.active) throw apiError(409, `${channel} connection is not active`);
  const rawBody = await readRawBody(request);
  const payload = parseJson(rawBody);
  let normalized;

  if (channel === "email" && connection.provider === "resend") {
    const secret = clean(process.env.RESEND_WEBHOOK_SECRET);
    if (!secret && process.env.NODE_ENV === "production") throw apiError(503, "RESEND_WEBHOOK_SECRET is not configured");
    if (secret && !verifyResendWebhook(rawBody, request.headers, secret)) throw apiError(401, "Invalid Resend webhook signature");
    let receivedEmail = null;
    if (payload.type === "email.received" && payload.data?.email_id) {
      try { receivedEmail = await retrieveResendEmail(payload.data.email_id, { env: process.env, fetchImpl: context.fetchImpl }); } catch (error) { receivedEmail = { retrievalError: error.message }; }
    }
    normalized = normalizeResendWebhook(payload, receivedEmail);
  } else if (channel === "whatsapp" && connection.provider === "whatsapp-cloud") {
    const secret = clean(process.env.WHATSAPP_APP_SECRET);
    if (!secret && process.env.NODE_ENV === "production") throw apiError(503, "WHATSAPP_APP_SECRET is not configured");
    if (secret && !verifyMetaWebhook(rawBody, request.headers["x-hub-signature-256"], secret)) throw apiError(401, "Invalid WhatsApp webhook signature");
    normalized = normalizeWhatsAppWebhook(payload);
  } else {
    const secret = clean(process.env.DLS_CHANNEL_WEBHOOK_SECRET);
    const signature = request.headers["x-dls-signature"];
    if (secret && !verifyMetaWebhook(rawBody, signature, secret)) throw apiError(401, "Invalid development webhook signature");
    if (!secret && process.env.NODE_ENV === "production") throw apiError(503, "DLS_CHANNEL_WEBHOOK_SECRET is not configured");
    normalized = normalizeDevelopmentWebhook(channel, payload);
  }

  const inbound = normalized.inbound.map((message) => ingestInboundMessage(db, business, message));
  const deliveries = normalized.deliveries.map((event) => recordDeliveryStatus(db, business.id, event));
  inbound.filter((item) => item.created && item.contact?.id).forEach((item) => applySequenceSignal(db, business.id, item.contact.id, "reply"));
  inbound.filter((item) => item.created && item.contact?.id).forEach((item) => recordCampaignResponse(db, business.id, item.contact.id, item.message.occurredAt));
  deliveries.filter((item) => item.created && item.event?.status === "delivered" && item.message?.automationRunId).forEach((item) => recordSequenceMetric(db, business.id, item.message.automationRunId, "delivered"));
  deliveries.filter((item) => item.created && item.event?.providerMessageId).forEach((item) => recordCampaignDelivery(db, business.id, item.event.providerMessageId, item.event.status, item.event.occurredAt));
  const configurableAutomations = [];
  for (const item of inbound.filter((entry) => entry.created && entry.contact?.id)) {
    configurableAutomations.push(...await dispatchAutomationEvent(db, business, { id: `message:${item.message.id}`, type: "message.received", entity: "contact", entityId: item.contact.id, contactId: item.contact.id, payload: { channel, messageId: item.message.id, threadId: item.thread.id, body: item.message.body }, occurredAt: item.message.occurredAt }, context));
  }
  if (inbound.some((item) => item.created) || deliveries.some((item) => item.created)) await saveBusinessStore(db, context, `channel-webhook-${channel}`);
  return sendJson(response, 200, { received: true, inboundCreated: inbound.filter((item) => item.created).length, duplicates: inbound.filter((item) => item.duplicate).length, deliveryEvents: deliveries.filter((item) => item.created).length, configurableAutomations }, context);
}

function requireBusiness(db, ref) { const business = db.businesses.find((item) => item.id === ref || item.slug === ref); if (!business) throw apiError(404, "Business not found"); return business; }
function normalizeAttachments(value) { return Array.isArray(value) ? value.slice(0, 20) : []; }
function requireObject(value) { if (!value || typeof value !== "object" || Array.isArray(value)) throw apiError(400, "JSON body must be an object"); return value; }
function requiredText(value, field, max) { const result = optionalText(value, max); if (!result) throw apiError(400, `${field} is required`); return result; }
function optionalText(value, max) { if (value === undefined || value === null || value === "") return ""; if (typeof value !== "string") throw apiError(400, "Text fields must be strings"); const result = value.trim(); if (result.length > max) throw apiError(400, `Text cannot exceed ${max} characters`); return result; }
function methodNotAllowed(allow) { const error = apiError(405, "Method not allowed"); error.allow = allow; return error; }
function apiError(statusCode, message, code = "channel_error") { return Object.assign(new Error(message), { statusCode, code }); }
function parseJson(raw) { try { return JSON.parse(raw); } catch { throw apiError(400, "Invalid JSON body"); } }
async function readJsonBody(request) { return parseJson(await readRawBody(request)); }
async function readRawBody(request) { let raw = ""; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > MAX_BODY_BYTES) throw apiError(413, "Channel payload too large"); raw += chunk.toString("utf8"); } if (!raw.trim()) throw apiError(400, "JSON body is required"); return raw; }
function secureEqual(left, right) { const a = Buffer.from(clean(left)); const b = Buffer.from(clean(right)); return Boolean(a.length && a.length === b.length && timingSafeEqual(a, b)); }
function clean(value) { return String(value ?? "").trim(); }
function sendJson(response, status, payload, context, extraHeaders = {}) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extraHeaders }); response.end(JSON.stringify(payload)); }
function sendEmpty(response, status, context, allow) { response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: allow }); response.end(); }
