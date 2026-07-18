import { randomUUID } from "node:crypto";

export const CHANNEL_PROVIDERS = Object.freeze({
  email: Object.freeze(["development", "resend"]),
  whatsapp: Object.freeze(["development", "whatsapp-cloud"])
});

export function describeChannelConnection(connection, env = process.env) {
  const channel = connection.channel;
  const provider = connection.provider || "development";
  const missing = [];
  if (provider === "resend") {
    if (!clean(env.RESEND_API_KEY)) missing.push("RESEND_API_KEY");
    if (!clean(connection.senderId || env.RESEND_FROM_EMAIL)) missing.push("senderId/RESEND_FROM_EMAIL");
  }
  if (provider === "whatsapp-cloud") {
    if (!clean(env.WHATSAPP_ACCESS_TOKEN)) missing.push("WHATSAPP_ACCESS_TOKEN");
    if (!clean(connection.senderId || env.WHATSAPP_PHONE_NUMBER_ID)) missing.push("senderId/WHATSAPP_PHONE_NUMBER_ID");
    if (!clean(env.WHATSAPP_GRAPH_VERSION)) missing.push("WHATSAPP_GRAPH_VERSION");
  }
  return {
    ...connection,
    channel,
    provider,
    credentialsReady: provider === "development" || missing.length === 0,
    missingConfiguration: missing,
    mode: provider === "development" ? "development" : "live"
  };
}

export async function sendChannelMessage(input) {
  const fetchImpl = input.fetchImpl || globalThis.fetch;
  const connection = describeChannelConnection(input.connection, input.env);
  if (!connection.active) throw providerError(409, `${connection.channel} connection is not active`, "channel_inactive");
  if (!connection.credentialsReady) throw providerError(503, `Missing provider configuration: ${connection.missingConfiguration.join(", ")}`, "channel_not_configured");
  if (connection.provider === "development") {
    return { providerMessageId: `dev_message_${randomUUID()}`, deliveryStatus: "queued", raw: { development: true } };
  }
  if (connection.provider === "resend") return sendResendEmail({ ...input, connection, fetchImpl });
  if (connection.provider === "whatsapp-cloud") return sendWhatsAppText({ ...input, connection, fetchImpl });
  throw providerError(400, "Unsupported channel provider", "provider_unsupported");
}

export async function retrieveResendEmail(emailId, options = {}) {
  const apiKey = clean(options.env?.RESEND_API_KEY || process.env.RESEND_API_KEY);
  if (!apiKey) throw providerError(503, "RESEND_API_KEY is not configured", "channel_not_configured");
  const response = await (options.fetchImpl || globalThis.fetch)(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }
  });
  const payload = await readProviderResponse(response);
  if (!response.ok) throw providerError(response.status, providerMessage(payload, "Resend could not retrieve the received email"), "provider_retrieve_failed");
  return payload;
}

async function sendResendEmail({ connection, thread, contact, message, env = process.env, fetchImpl }) {
  const from = clean(connection.senderId || env.RESEND_FROM_EMAIL);
  const to = clean(contact.email);
  if (!to) throw providerError(400, "Contact has no email address", "recipient_missing");
  const subject = clean(message.subject || thread.subject || thread.title || "Mensaje") || "Mensaje";
  const headers = {};
  if (thread.externalMessageId) headers["In-Reply-To"] = thread.externalMessageId;
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clean(env.RESEND_API_KEY)}`,
      "Content-Type": "application/json",
      "Idempotency-Key": message.idempotencyKey
    },
    body: JSON.stringify({ from, to: [to], subject, text: message.body, headers, tags: [{ name: "dls_thread", value: safeTag(thread.id) }] })
  });
  const payload = await readProviderResponse(response);
  if (!response.ok) throw providerError(response.status, providerMessage(payload, "Resend could not send the email"), "provider_send_failed");
  return { providerMessageId: clean(payload.id), deliveryStatus: "sent", raw: payload };
}

async function sendWhatsAppText({ connection, contact, message, env = process.env, fetchImpl }) {
  const phoneNumberId = clean(connection.senderId || env.WHATSAPP_PHONE_NUMBER_ID);
  const recipient = normalizePhone(contact.phone);
  if (!recipient) throw providerError(400, "Contact has no WhatsApp-compatible phone", "recipient_missing");
  const version = clean(env.WHATSAPP_GRAPH_VERSION);
  const response = await fetchImpl(`https://graph.facebook.com/${encodeURIComponent(version)}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${clean(env.WHATSAPP_ACCESS_TOKEN)}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: recipient, type: "text", text: { preview_url: false, body: message.body } })
  });
  const payload = await readProviderResponse(response);
  if (!response.ok) throw providerError(response.status, providerMessage(payload, "WhatsApp Cloud API could not send the message"), "provider_send_failed");
  return { providerMessageId: clean(payload.messages?.[0]?.id), deliveryStatus: "sent", raw: payload };
}

async function readProviderResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text.slice(0, 1000) }; }
}

function providerMessage(payload, fallback) { return clean(payload?.message || payload?.error?.message || payload?.error) || fallback; }
function providerError(statusCode, message, code) { return Object.assign(new Error(message), { statusCode, code }); }
function safeTag(value) { return clean(value).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 256) || "thread"; }
function normalizePhone(value) { return clean(value).replace(/\D+/g, ""); }
function clean(value) { return String(value ?? "").trim(); }
