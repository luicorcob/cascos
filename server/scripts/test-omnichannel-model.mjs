import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { sendChannelMessage } from "../lib/channel-providers.mjs";
import { normalizeResendWebhook, normalizeWhatsAppWebhook, verifyMetaWebhook, verifyResendWebhook } from "../lib/channel-webhooks.mjs";
import {
  acquireThreadLock,
  addInternalNote,
  assertOutboundConsent,
  buildChannelInbox,
  ingestInboundMessage,
  markCustomerThreadRead,
  recordDeliveryStatus,
  recordOutboundMessage,
  releaseThreadLock,
  saveChannelConnection,
  updateCustomerThread
} from "../lib/omnichannel-model.mjs";

const now = "2026-07-17T12:00:00.000Z";
const business = { id: "biz_channels", slug: "channels", name: "Canales DLS" };
const db = { businesses: [business], contacts: [], activities: [], associations: [], teamMembers: [{ id: "member_ana", businessId: business.id, name: "Ana Agente", role: "manager", active: true }], communicationThreads: [], communicationMessages: [], channelConnections: [], channelDeliveryEvents: [], consentEvents: [], auditLog: [] };

saveChannelConnection(db, business.id, { channel: "email", provider: "development", senderId: "hola@example.com", displayName: "Email ventas", active: true, firstResponseTargetMinutes: 30 }, now);
saveChannelConnection(db, business.id, { channel: "whatsapp", provider: "development", active: true, firstResponseTargetMinutes: 15 }, now);
const inbound = ingestInboundMessage(db, business, { channel: "email", provider: "development", providerMessageId: "email_in_1", externalConversationId: "email:eva:demo", externalMessageId: "<email_in_1>", senderName: "Eva Cliente", email: "eva@example.com", subject: "Quiero reservar", body: "Necesito una mesa para cuatro", occurredAt: now });
assert.equal(inbound.created, true);
assert.equal(inbound.contact.email, "eva@example.com");
assert.equal(inbound.thread.type, "customer");
assert.equal(inbound.thread.unreadCount, 1);
assert.ok(db.associations.some((item) => item.toId === inbound.thread.id));
assert.ok(db.consentEvents.some((item) => item.contactId === inbound.contact.id && item.purpose === "service"));
const duplicate = ingestInboundMessage(db, business, { channel: "email", provider: "development", providerMessageId: "email_in_1", email: "eva@example.com", body: "duplicado" }, { now });
assert.equal(duplicate.duplicate, true);
assert.equal(db.communicationMessages.filter((item) => item.providerMessageId === "email_in_1").length, 1);

assert.doesNotThrow(() => assertOutboundConsent(db, business.id, inbound.contact.id, "email", "service"));
assert.throws(() => assertOutboundConsent(db, business.id, inbound.contact.id, "email", "marketing"), /blocked by consent/);
const provider = await sendChannelMessage({ connection: { channel: "email", provider: "development", active: true }, thread: inbound.thread, contact: inbound.contact, message: { body: "Confirmado", idempotencyKey: "idem_1" } });
const outbound = recordOutboundMessage(db, business, inbound.thread, inbound.contact, { provider: "development", body: "Confirmado", subject: "Re: reserva", senderName: "Ana", purpose: "service", idempotencyKey: "idem_1" }, provider, "2026-07-17T12:10:00.000Z");
assert.equal(outbound.direction, "outbound");
assert.equal(inbound.thread.firstResponseAt, "2026-07-17T12:10:00.000Z");
recordDeliveryStatus(db, business.id, { provider: "development", providerMessageId: outbound.providerMessageId, status: "delivered", occurredAt: "2026-07-17T12:11:00.000Z" });
recordDeliveryStatus(db, business.id, { provider: "development", providerMessageId: outbound.providerMessageId, status: "read", occurredAt: "2026-07-17T12:12:00.000Z" });
assert.equal(outbound.deliveryStatus, "read");

const lock = acquireThreadLock(db, business.id, inbound.thread.id, { actorId: "member_ana", actorName: "Ana Agente", ttlSeconds: 180 }, "2026-07-17T12:12:00.000Z");
assert.ok(lock.expiresAt);
assert.throws(() => acquireThreadLock(db, business.id, inbound.thread.id, { actorId: "member_luis", actorName: "Luis" }, "2026-07-17T12:12:30.000Z"), /being handled/);
releaseThreadLock(db, business.id, inbound.thread.id, "member_ana", "2026-07-17T12:13:00.000Z");
const note = addInternalNote(db, business.id, inbound.thread.id, { senderName: "Ana", body: "@Luis confirma disponibilidad", mentions: ["member_luis"] }, "2026-07-17T12:14:00.000Z");
assert.equal(note.direction, "internal");
updateCustomerThread(db, business.id, inbound.thread.id, { assignedToId: "member_ana" }, "2026-07-17T12:15:00.000Z");
markCustomerThreadRead(db, business.id, inbound.thread.id, "2026-07-17T12:16:00.000Z");
const inbox = buildChannelInbox(db, business.id, { now: "2026-07-17T12:20:00.000Z", env: {} });
assert.equal(inbox.summary.open, 1);
assert.equal(inbox.summary.unread, 0);
assert.equal(inbox.summary.unassigned, 0);
assert.equal(inbox.conversations[0].firstResponseMinutes, 10);
assert.equal(inbox.conversations[0].assignedTo.name, "Ana Agente");

const resendPayload = JSON.stringify({ type: "email.received", created_at: now, data: { email_id: "resend_in_1", from: "Eva <eva@example.com>", to: ["hola@example.com"], subject: "Hola", message_id: "<r1>", attachments: [] } });
const svixId = "msg_test";
const svixTimestamp = String(Math.floor(Date.parse(now) / 1000));
const resendKey = Buffer.from("resend-test-secret-32-bytes-value").toString("base64");
const resendSignature = createHmac("sha256", Buffer.from(resendKey, "base64")).update(`${svixId}.${svixTimestamp}.${resendPayload}`).digest("base64");
assert.equal(verifyResendWebhook(resendPayload, { "svix-id": svixId, "svix-timestamp": svixTimestamp, "svix-signature": `v1,${resendSignature}` }, `whsec_${resendKey}`, Date.parse(now)), true);
assert.equal(normalizeResendWebhook(JSON.parse(resendPayload), { text: "Contenido completo", headers: {} }).inbound[0].body, "Contenido completo");
const metaSecret = "meta-secret";
const metaPayload = JSON.stringify({ entry: [] });
assert.equal(verifyMetaWebhook(metaPayload, `sha256=${createHmac("sha256", metaSecret).update(metaPayload).digest("hex")}`, metaSecret), true);
const whatsapp = normalizeWhatsAppWebhook({ entry: [{ changes: [{ value: { contacts: [{ wa_id: "346111", profile: { name: "Eva WA" } }], messages: [{ from: "346111", id: "wamid_1", timestamp: "1784289600", type: "text", text: { body: "Hola WhatsApp" } }], statuses: [{ id: "wamid_out", status: "delivered", timestamp: "1784289660" }] } }] }] });
assert.equal(whatsapp.inbound[0].body, "Hola WhatsApp");
assert.equal(whatsapp.deliveries[0].status, "delivered");

const resendCalls = [];
const resendResult = await sendChannelMessage({ connection: { channel: "email", provider: "resend", senderId: "DLS <hola@example.com>", active: true }, thread: inbound.thread, contact: inbound.contact, message: { body: "Respuesta real", subject: "Re: demo", idempotencyKey: "idem-resend" }, env: { RESEND_API_KEY: "re_test" }, fetchImpl: async (url, init) => { resendCalls.push({ url, init }); return fakeResponse(200, { id: "resend_out_1" }); } });
assert.equal(resendResult.providerMessageId, "resend_out_1");
assert.equal(JSON.parse(resendCalls[0].init.body).to[0], "eva@example.com");
const whatsappCalls = [];
const whatsappResult = await sendChannelMessage({ connection: { channel: "whatsapp", provider: "whatsapp-cloud", senderId: "phone_123", active: true }, thread: { ...inbound.thread, channel: "whatsapp" }, contact: { ...inbound.contact, phone: "+34 611 000 111" }, message: { body: "Respuesta WA", idempotencyKey: "idem-wa" }, env: { WHATSAPP_ACCESS_TOKEN: "wa_token", WHATSAPP_GRAPH_VERSION: "v-test" }, fetchImpl: async (url, init) => { whatsappCalls.push({ url, init }); return fakeResponse(200, { messages: [{ id: "wamid_out_1" }] }); } });
assert.equal(whatsappResult.providerMessageId, "wamid_out_1");
assert.match(whatsappCalls[0].url, /phone_123\/messages$/);

console.log("Omnichannel model checks passed: connections, inbound dedupe, identity, consent, outbound providers, delivery, assignment, notes, locks and SLA.");

function fakeResponse(status, payload) { return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(payload) }; }
