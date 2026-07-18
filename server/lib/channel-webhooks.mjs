import { createHmac, timingSafeEqual } from "node:crypto";

const RESEND_DELIVERY_MAP = Object.freeze({
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "sent",
  "email.failed": "failed"
});

export function verifyResendWebhook(rawBody, headers, secret, now = Date.now()) {
  if (!secret) return false;
  const id = header(headers, "svix-id");
  const timestamp = header(headers, "svix-timestamp");
  const signatures = header(headers, "svix-signature").split(/\s+/).map((item) => item.split(",")).filter(([version, value]) => version === "v1" && value);
  const seconds = Number(timestamp);
  if (!id || !Number.isFinite(seconds) || Math.abs(Math.floor(now / 1000) - seconds) > 300) return false;
  const encodedSecret = String(secret).startsWith("whsec_") ? String(secret).slice(6) : String(secret);
  let key;
  try { key = Buffer.from(encodedSecret, "base64"); } catch { return false; }
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  return signatures.some(([, value]) => secureEqual(value, expected));
}

export function verifyMetaWebhook(rawBody, signature, secret) {
  if (!secret) return false;
  const value = String(signature || "").replace(/^sha256=/, "");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  return secureEqual(value, expected);
}

export function normalizeResendWebhook(payload, receivedEmail = null) {
  const type = clean(payload?.type);
  const data = payload?.data && typeof payload.data === "object" ? payload.data : {};
  if (type === "email.received") {
    const full = receivedEmail && typeof receivedEmail === "object" ? receivedEmail : {};
    const from = parseEmailAddress(full.from || data.from);
    const subject = clean(full.subject || data.subject);
    const messageId = clean(full.message_id || data.message_id || data.email_id);
    return {
      inbound: [{
        channel: "email",
        provider: "resend",
        providerMessageId: clean(data.email_id || full.id),
        externalMessageId: messageId,
        externalConversationId: emailConversationKey(from.email, subject, full.headers),
        senderName: from.name,
        email: from.email,
        subject,
        body: clean(full.text) || htmlToText(full.html) || `[Email recibido: ${subject || "sin asunto"}]`,
        attachments: normalizeEmailAttachments(full.attachments || data.attachments, data.email_id || full.id),
        occurredAt: validIso(data.created_at || payload.created_at),
        messageType: "email"
      }],
      deliveries: []
    };
  }
  const deliveryStatus = RESEND_DELIVERY_MAP[type];
  return {
    inbound: [],
    deliveries: deliveryStatus && data.email_id ? [{ provider: "resend", providerMessageId: clean(data.email_id), status: deliveryStatus, error: clean(data.bounce?.message || data.failed?.message), occurredAt: validIso(payload.created_at || data.created_at) }] : []
  };
}

export function normalizeWhatsAppWebhook(payload) {
  const inbound = [];
  const deliveries = [];
  for (const entry of Array.isArray(payload?.entry) ? payload.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value || {};
      const names = new Map((Array.isArray(value.contacts) ? value.contacts : []).map((contact) => [clean(contact.wa_id), clean(contact.profile?.name)]));
      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        const phone = clean(message.from);
        inbound.push({
          channel: "whatsapp",
          provider: "whatsapp-cloud",
          providerMessageId: clean(message.id),
          externalMessageId: clean(message.context?.id),
          externalConversationId: `whatsapp:${phone}`,
          senderName: names.get(phone) || phone,
          phone,
          subject: "",
          body: whatsappBody(message),
          attachments: whatsappAttachments(message),
          occurredAt: unixIso(message.timestamp),
          messageType: clean(message.type)
        });
      }
      for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
        deliveries.push({ provider: "whatsapp-cloud", providerMessageId: clean(status.id), status: whatsappStatus(status.status), error: clean(status.errors?.[0]?.title || status.errors?.[0]?.message), occurredAt: unixIso(status.timestamp) });
      }
    }
  }
  return { inbound: inbound.filter((item) => item.providerMessageId && item.phone), deliveries: deliveries.filter((item) => item.providerMessageId && item.status) };
}

export function normalizeDevelopmentWebhook(channel, payload) {
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const deliveries = Array.isArray(payload?.deliveries) ? payload.deliveries : [];
  return {
    inbound: messages.map((message) => ({ channel, provider: "development", providerMessageId: clean(message.providerMessageId || message.id), externalMessageId: clean(message.externalMessageId), externalConversationId: clean(message.externalConversationId), senderName: clean(message.senderName || message.name), email: clean(message.email), phone: clean(message.phone), subject: clean(message.subject), body: clean(message.body), attachments: Array.isArray(message.attachments) ? message.attachments : [], occurredAt: validIso(message.occurredAt), messageType: clean(message.messageType || "text") })),
    deliveries: deliveries.map((event) => ({ provider: "development", providerMessageId: clean(event.providerMessageId), status: clean(event.status), error: clean(event.error), occurredAt: validIso(event.occurredAt) }))
  };
}

function whatsappBody(message) {
  const type = clean(message.type);
  if (type === "text") return clean(message.text?.body);
  if (type === "button") return clean(message.button?.text || message.button?.payload);
  if (type === "interactive") return clean(message.interactive?.button_reply?.title || message.interactive?.list_reply?.title);
  if (type === "image") return clean(message.image?.caption) || "[Imagen]";
  if (type === "document") return clean(message.document?.caption || message.document?.filename) || "[Documento]";
  if (type === "audio") return "[Audio]";
  if (type === "video") return clean(message.video?.caption) || "[Video]";
  if (type === "location") return `[Ubicacion ${message.location?.latitude || ""}, ${message.location?.longitude || ""}]`;
  if (type === "order") return "[Pedido recibido por WhatsApp]";
  return `[Mensaje ${type || "desconocido"}]`;
}

function whatsappAttachments(message) {
  const type = clean(message.type);
  const media = message[type];
  if (!new Set(["image", "document", "audio", "video", "sticker"]).has(type) || !media?.id) return [];
  return [{ id: clean(media.id), name: clean(media.filename) || `${type}-${media.id}`, type: clean(media.mime_type), url: "", size: 0 }];
}

function whatsappStatus(value) { const status = clean(value); return ({ sent: "sent", delivered: "delivered", read: "read", failed: "failed" })[status] || ""; }
function normalizeEmailAttachments(value, emailId) { return (Array.isArray(value) ? value : []).slice(0, 20).map((item) => ({ id: clean(item.id), name: clean(item.filename) || "Adjunto", type: clean(item.content_type), url: item.download_url || "", size: Number(item.size || 0), providerEmailId: clean(emailId) })); }
function emailConversationKey(email, subject, headers) { const references = clean(headers?.references || headers?.["in-reply-to"]); if (references) return `email:${email}:${references.slice(0, 300)}`; return `email:${email}:${normalizeSubject(subject)}`; }
function normalizeSubject(value) { return clean(value).replace(/^(?:(?:re|fw|fwd):\s*)+/i, "").toLowerCase().slice(0, 300) || "sin-asunto"; }
function parseEmailAddress(value) { const text = clean(value); const match = text.match(/^(.*?)\s*<([^>]+)>$/); return match ? { name: clean(match[1].replace(/^"|"$/g, "")), email: clean(match[2]).toLowerCase() } : { name: "", email: text.toLowerCase() }; }
function htmlToText(value) { return clean(String(value || "").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")); }
function unixIso(value) { const seconds = Number(value); return Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : ""; }
function validIso(value) { const time = Date.parse(value || ""); return Number.isFinite(time) ? new Date(time).toISOString() : ""; }
function header(headers, name) { if (!headers) return ""; if (typeof headers.get === "function") return clean(headers.get(name)); return clean(headers[name] || headers[name.toLowerCase()]); }
function secureEqual(left, right) { const a = Buffer.from(String(left)); const b = Buffer.from(String(right)); return a.length === b.length && timingSafeEqual(a, b); }
function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
