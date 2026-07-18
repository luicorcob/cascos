import { createHash, randomUUID } from "node:crypto";
import { upsertAssociation } from "./association-model.mjs";
import { appendConsentEvent, consentStateForContact, evaluateConsentState } from "./consent-model.mjs";
import { CHANNEL_PROVIDERS, describeChannelConnection } from "./channel-providers.mjs";

export const OMNICHANNEL_CHANNELS = Object.freeze(["email", "whatsapp"]);
export const DELIVERY_STATUSES = Object.freeze(["queued", "sent", "delivered", "read", "failed", "bounced", "complained"]);

export function ensureOmnichannelCollections(db) {
  for (const key of ["businesses", "contacts", "activities", "associations", "teamMembers", "communicationThreads", "communicationMessages", "channelConnections", "channelDeliveryEvents", "consentEvents", "auditLog"]) {
    db[key] = Array.isArray(db[key]) ? db[key] : [];
  }
  return db;
}

export function listChannelConnections(db, businessId, env = process.env) {
  ensureOmnichannelCollections(db);
  return OMNICHANNEL_CHANNELS.map((channel) => {
    const stored = db.channelConnections.find((item) => item.businessId === businessId && item.channel === channel);
    return describeChannelConnection(stored || virtualConnection(businessId, channel), env);
  });
}

export function saveChannelConnection(db, businessId, source, now = new Date().toISOString()) {
  ensureOmnichannelCollections(db);
  const channel = requiredChannel(source.channel);
  const allowedProviders = new Set(CHANNEL_PROVIDERS[channel]);
  const provider = clean(source.provider || "development");
  if (!allowedProviders.has(provider)) throw modelError(400, `Unsupported provider for ${channel}`);
  let connection = db.channelConnections.find((item) => item.businessId === businessId && item.channel === channel);
  if (!connection) {
    connection = virtualConnection(businessId, channel, now);
    db.channelConnections.push(connection);
  }
  connection.provider = provider;
  connection.displayName = optionalText(source.displayName, 120);
  connection.senderId = optionalText(source.senderId, 240);
  connection.active = Boolean(source.active);
  connection.firstResponseTargetMinutes = clampInteger(source.firstResponseTargetMinutes, 5, 10080, connection.firstResponseTargetMinutes || 60);
  connection.updatedAt = now;
  appendAudit(db, "channel.connection_saved", businessId, now, { channel, provider, active: connection.active });
  return connection;
}

export function ingestInboundMessage(db, business, input, options = {}) {
  ensureOmnichannelCollections(db);
  const now = validIso(input.occurredAt) || validIso(options.now) || new Date().toISOString();
  const channel = requiredChannel(input.channel);
  const providerMessageId = requiredText(input.providerMessageId, "providerMessageId", 500);
  const duplicate = db.communicationMessages.find((message) => message.businessId === business.id && message.provider === input.provider && message.providerMessageId === providerMessageId);
  if (duplicate) return { created: false, duplicate: true, message: duplicate, thread: requireThread(db, business.id, duplicate.threadId), contact: findContact(db, business.id, duplicate.contactId) };

  const contact = resolveInboundContact(db, business, input, now);
  const externalConversationId = optionalText(input.externalConversationId, 500) || `${channel}:${contact.id}`;
  let thread = db.communicationThreads.find((item) => item.businessId === business.id && item.type === "customer" && item.channel === channel && item.externalConversationId === externalConversationId && item.status !== "closed");
  if (!thread) {
    thread = createCustomerThread(business, contact, input, externalConversationId, now);
    db.communicationThreads.push(thread);
    upsertAssociation(db, { businessId: business.id, fromType: "contact", fromId: contact.id, toType: "conversation", toId: thread.id, kind: "participant", isPrimary: true, now });
    appendAudit(db, "channel.thread_created", business.id, now, { threadId: thread.id, contactId: contact.id, channel });
  }

  const message = {
    id: `communication_message_${randomUUID()}`,
    businessId: business.id,
    threadId: thread.id,
    contactId: contact.id,
    channel,
    provider: clean(input.provider) || "webhook",
    providerMessageId,
    externalMessageId: optionalText(input.externalMessageId, 500),
    direction: "inbound",
    senderRole: "contact",
    senderName: optionalText(input.senderName, 160) || contact.name || contact.email || contact.phone || "Contacto",
    subject: optionalText(input.subject, 500),
    body: optionalText(input.body, 20000),
    attachments: normalizeAttachments(input.attachments),
    deliveryStatus: "delivered",
    deliveryError: "",
    occurredAt: now,
    createdAt: now,
    updatedAt: now
  };
  if (!message.body && !message.attachments.length) message.body = `[${clean(input.messageType) || "mensaje sin contenido textual"}]`;
  db.communicationMessages.push(message);
  thread.status = "open";
  thread.subject = message.subject || thread.subject || "";
  thread.externalMessageId = message.externalMessageId || thread.externalMessageId || providerMessageId;
  thread.firstInboundAt = thread.firstInboundAt || now;
  thread.lastInboundAt = now;
  thread.lastMessageAt = now;
  thread.unreadCount = Number(thread.unreadCount || 0) + 1;
  thread.updatedAt = now;
  contact.lastInteractionAt = now;
  contact.updatedAt = now;
  recordInboundServiceEvidence(db, business.id, contact.id, message, now);
  db.activities.push({ id: `activity_${randomUUID()}`, businessId: business.id, contactId: contact.id, type: "communication.inbound", title: `Mensaje entrante · ${channel}`, note: message.body.slice(0, 1000), source: message.provider, metadata: { threadId: thread.id, messageId: message.id, channel }, createdAt: now });
  appendAudit(db, "channel.message_received", business.id, now, { threadId: thread.id, messageId: message.id, contactId: contact.id, channel, providerMessageId });
  return { created: true, duplicate: false, message, thread, contact };
}

export function assertOutboundConsent(db, businessId, contactId, channel, purpose = "service") {
  const state = consentStateForContact(db, businessId, contactId);
  const result = evaluateConsentState(state, channel === "email" ? "email" : "whatsapp", purpose);
  if (!result.allowed || result.suppressed) throw modelError(409, `Outbound ${channel} is blocked by consent preferences`, "consent_blocked");
  return result;
}

export function recordOutboundMessage(db, business, thread, contact, input, providerResult, now = new Date().toISOString()) {
  ensureOmnichannelCollections(db);
  const message = {
    id: `communication_message_${randomUUID()}`,
    businessId: business.id,
    threadId: thread.id,
    contactId: contact.id,
    channel: thread.channel,
    provider: input.provider,
    providerMessageId: requiredText(providerResult.providerMessageId, "providerMessageId", 500),
    idempotencyKey: optionalText(input.idempotencyKey, 256),
    automationRunId: optionalText(input.automationRunId, 180),
    externalMessageId: "",
    direction: "outbound",
    senderRole: "agent",
    senderName: optionalText(input.senderName, 160) || "Equipo",
    subject: optionalText(input.subject, 500),
    body: requiredText(input.body, "body", 20000),
    attachments: normalizeAttachments(input.attachments),
    purpose: clean(input.purpose) || "service",
    deliveryStatus: clean(providerResult.deliveryStatus) || "queued",
    deliveryError: optionalText(providerResult.deliveryError, 2000),
    occurredAt: now,
    createdAt: now,
    updatedAt: now
  };
  db.communicationMessages.push(message);
  thread.status = "open";
  thread.firstResponseAt = thread.firstResponseAt || now;
  thread.lastOutboundAt = now;
  thread.lastMessageAt = now;
  thread.updatedAt = now;
  appendAudit(db, "channel.message_sent", business.id, now, { threadId: thread.id, messageId: message.id, contactId: contact.id, channel: thread.channel, providerMessageId: message.providerMessageId, purpose: message.purpose });
  return message;
}

export function recordDeliveryStatus(db, businessId, input, now = new Date().toISOString()) {
  ensureOmnichannelCollections(db);
  const providerMessageId = requiredText(input.providerMessageId, "providerMessageId", 500);
  const status = clean(input.status);
  if (!DELIVERY_STATUSES.includes(status)) throw modelError(400, "Invalid delivery status");
  const eventKey = `${input.provider || "provider"}:${providerMessageId}:${status}:${input.occurredAt || now}`;
  const eventId = `delivery_${createHash("sha256").update(eventKey).digest("hex").slice(0, 24)}`;
  const existing = db.channelDeliveryEvents.find((event) => event.id === eventId);
  if (existing) return { created: false, event: existing, message: db.communicationMessages.find((item) => item.providerMessageId === providerMessageId) || null };
  const message = db.communicationMessages.find((item) => item.businessId === businessId && item.providerMessageId === providerMessageId);
  const event = { id: eventId, businessId, messageId: message?.id || "", provider: clean(input.provider), providerMessageId, status, error: optionalText(input.error, 2000), occurredAt: validIso(input.occurredAt) || now, createdAt: now };
  db.channelDeliveryEvents.push(event);
  if (message && shouldApplyDelivery(message.deliveryStatus, status, event.occurredAt, message.deliveryUpdatedAt)) {
    message.deliveryStatus = status;
    message.deliveryError = event.error;
    message.deliveryUpdatedAt = event.occurredAt;
    message.updatedAt = now;
  }
  appendAudit(db, "channel.delivery_updated", businessId, now, { messageId: message?.id || "", providerMessageId, status });
  return { created: true, event, message: message || null };
}

export function buildChannelInbox(db, businessId, options = {}) {
  ensureOmnichannelCollections(db);
  const now = new Date(validIso(options.now) || Date.now());
  const channel = clean(options.channel);
  const status = clean(options.status);
  const ownerId = clean(options.ownerId);
  const search = clean(options.search).toLowerCase();
  const connections = listChannelConnections(db, businessId, options.env);
  const threads = db.communicationThreads
    .filter((thread) => thread.businessId === businessId && thread.type === "customer")
    .filter((thread) => !channel || thread.channel === channel)
    .filter((thread) => !status || thread.status === status)
    .filter((thread) => !ownerId || thread.assignedToId === ownerId)
    .map((thread) => decorateCustomerThread(db, thread, now, connections))
    .filter((thread) => !search || threadSearchText(thread).includes(search))
    .sort(compareChannelThreads);
  const open = threads.filter((thread) => thread.status === "open");
  const responseTimes = threads.map((thread) => thread.firstResponseMinutes).filter(Number.isFinite);
  return {
    generatedAt: now.toISOString(),
    connections,
    members: db.teamMembers.filter((member) => member.businessId === businessId && member.active !== false).map((member) => ({ id: member.id, name: member.name, role: member.role })),
    summary: {
      conversations: threads.length,
      open: open.length,
      unread: threads.reduce((sum, thread) => sum + thread.unreadCount, 0),
      unassigned: open.filter((thread) => !thread.assignedToId).length,
      slaBreached: open.filter((thread) => thread.sla.breached).length,
      averageFirstResponseMinutes: responseTimes.length ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length) : null
    },
    total: threads.length,
    conversations: threads
  };
}

export function updateCustomerThread(db, businessId, threadId, source, now = new Date().toISOString()) {
  const thread = requireThread(db, businessId, threadId);
  if (Object.prototype.hasOwnProperty.call(source, "status")) {
    const status = clean(source.status);
    if (!new Set(["open", "closed"]).has(status)) throw modelError(400, "Invalid conversation status");
    thread.status = status;
    thread.closedAt = status === "closed" ? now : "";
  }
  if (Object.prototype.hasOwnProperty.call(source, "assignedToId")) {
    const assignedToId = clean(source.assignedToId);
    if (assignedToId && !db.teamMembers.some((member) => member.businessId === businessId && member.id === assignedToId && member.active !== false)) throw modelError(404, "Team member not found");
    thread.assignedToId = assignedToId;
  }
  thread.updatedAt = now;
  appendAudit(db, "channel.thread_updated", businessId, now, { threadId, status: thread.status, assignedToId: thread.assignedToId || "" });
  return thread;
}

export function addInternalNote(db, businessId, threadId, source, now = new Date().toISOString()) {
  const thread = requireThread(db, businessId, threadId);
  const message = { id: `communication_message_${randomUUID()}`, businessId, threadId, contactId: thread.contactId, channel: "internal", provider: "dls", providerMessageId: `internal_${randomUUID()}`, direction: "internal", senderRole: "agent", senderName: optionalText(source.senderName, 160) || "Equipo", body: requiredText(source.body, "body", 10000), mentions: normalizeMentions(source.mentions), attachments: [], deliveryStatus: "internal", occurredAt: now, createdAt: now, updatedAt: now };
  db.communicationMessages.push(message);
  thread.updatedAt = now;
  appendAudit(db, "channel.internal_note_created", businessId, now, { threadId, messageId: message.id, mentions: message.mentions });
  return message;
}

export function markCustomerThreadRead(db, businessId, threadId, now = new Date().toISOString()) {
  const thread = requireThread(db, businessId, threadId);
  thread.unreadCount = 0;
  thread.lastReadAt = now;
  thread.updatedAt = now;
  return thread;
}

export function acquireThreadLock(db, businessId, threadId, source, now = new Date().toISOString()) {
  const thread = requireThread(db, businessId, threadId);
  const actorId = requiredText(source.actorId, "actorId", 180);
  const actorName = optionalText(source.actorName, 160) || actorId;
  const currentExpiry = Date.parse(thread.lockExpiresAt || "");
  if (thread.lockedById && thread.lockedById !== actorId && Number.isFinite(currentExpiry) && currentExpiry > Date.parse(now)) throw modelError(409, `Conversation is being handled by ${thread.lockedByName || thread.lockedById}`, "conversation_locked");
  const expiresAt = new Date(Date.parse(now) + clampInteger(source.ttlSeconds, 30, 900, 180) * 1000).toISOString();
  thread.lockedById = actorId;
  thread.lockedByName = actorName;
  thread.lockExpiresAt = expiresAt;
  thread.updatedAt = now;
  return { actorId, actorName, expiresAt };
}

export function releaseThreadLock(db, businessId, threadId, actorId, now = new Date().toISOString()) {
  const thread = requireThread(db, businessId, threadId);
  if (thread.lockedById && thread.lockedById !== actorId) throw modelError(409, "Only the current agent can release this lock", "conversation_locked");
  thread.lockedById = "";
  thread.lockedByName = "";
  thread.lockExpiresAt = "";
  thread.updatedAt = now;
  return thread;
}

export function requireCustomerThread(db, businessId, threadId) { return requireThread(db, businessId, threadId); }
export function requireThreadContact(db, businessId, thread) { const contact = findContact(db, businessId, thread.contactId); if (!contact) throw modelError(404, "Conversation contact not found"); return contact; }

export function ensureOutboundCustomerThread(db, business, contact, channel, input = {}, now = new Date().toISOString()) {
  ensureOmnichannelCollections(db);
  const normalizedChannel = requiredChannel(channel);
  const externalConversationId = optionalText(input.externalConversationId, 500) || `${normalizedChannel}:${contact.id}`;
  let thread = db.communicationThreads.find((item) => item.businessId === business.id && item.type === "customer" && item.channel === normalizedChannel && item.externalConversationId === externalConversationId && item.status !== "closed");
  if (thread) return thread;
  thread = createCustomerThread(business, contact, {
    channel: normalizedChannel,
    provider: optionalText(input.provider, 120) || "automation",
    subject: optionalText(input.subject, 500)
  }, externalConversationId, now);
  db.communicationThreads.push(thread);
  upsertAssociation(db, { businessId: business.id, fromType: "contact", fromId: contact.id, toType: "conversation", toId: thread.id, kind: "participant", isPrimary: true, now });
  appendAudit(db, "channel.thread_created", business.id, now, { threadId: thread.id, contactId: contact.id, channel: normalizedChannel, source: "automation" });
  return thread;
}

function decorateCustomerThread(db, thread, now, connections) {
  const contact = findContact(db, thread.businessId, thread.contactId) || {};
  const assigned = db.teamMembers.find((member) => member.businessId === thread.businessId && member.id === thread.assignedToId) || null;
  const messages = db.communicationMessages.filter((message) => message.threadId === thread.id).sort((left, right) => String(left.occurredAt || left.createdAt).localeCompare(String(right.occurredAt || right.createdAt))).slice(-100);
  const target = Number(connections.find((connection) => connection.channel === thread.channel)?.firstResponseTargetMinutes || 60);
  const firstResponseMinutes = thread.firstInboundAt && thread.firstResponseAt ? Math.max(0, Math.round((Date.parse(thread.firstResponseAt) - Date.parse(thread.firstInboundAt)) / 60000)) : null;
  const waitingMinutes = thread.firstInboundAt && !thread.firstResponseAt ? Math.max(0, Math.round((now.getTime() - Date.parse(thread.firstInboundAt)) / 60000)) : 0;
  const lockActive = Boolean(thread.lockedById && Date.parse(thread.lockExpiresAt || "") > now.getTime());
  return {
    ...thread,
    contact: { id: contact.id || thread.contactId, name: contact.name || "", email: contact.email || "", phone: contact.phone || "", status: contact.status || "" },
    assignedTo: assigned ? { id: assigned.id, name: assigned.name, role: assigned.role } : null,
    unreadCount: Number(thread.unreadCount || 0),
    messageCount: db.communicationMessages.filter((message) => message.threadId === thread.id).length,
    lastMessage: messages.at(-1) || null,
    messages,
    firstResponseMinutes,
    sla: { targetMinutes: target, waitingMinutes, breached: firstResponseMinutes !== null ? firstResponseMinutes > target : waitingMinutes > target },
    lock: lockActive ? { actorId: thread.lockedById, actorName: thread.lockedByName, expiresAt: thread.lockExpiresAt } : null
  };
}

function resolveInboundContact(db, business, input, now) {
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  let contact = db.contacts.find((item) => item.businessId === business.id && !item.merged && ((email && normalizeEmail(item.email) === email) || (phone && normalizePhone(item.phone) === phone)));
  if (contact) return contact;
  contact = { id: `contact_${randomUUID()}`, businessId: business.id, name: optionalText(input.senderName, 160) || email || phone || "Nuevo contacto", email, phone: optionalText(input.phone, 80), status: "new", type: "lead", source: `inbound-${input.channel}`, createdAt: now, updatedAt: now, lastInteractionAt: now };
  db.contacts.push(contact);
  appendAudit(db, "channel.contact_created", business.id, now, { contactId: contact.id, channel: input.channel });
  return contact;
}

function createCustomerThread(business, contact, input, externalConversationId, now) {
  return { id: `communication_thread_${randomUUID()}`, businessId: business.id, type: "customer", channel: input.channel, provider: clean(input.provider), externalConversationId, externalMessageId: optionalText(input.externalMessageId, 500), contactId: contact.id, accountId: "", dealId: "", assignedToId: "", title: optionalText(input.subject, 500) || `${input.channel === "email" ? "Email" : "WhatsApp"} · ${contact.name || contact.email || contact.phone}`, subject: optionalText(input.subject, 500), status: "open", unreadCount: 0, firstInboundAt: "", firstResponseAt: "", lastInboundAt: "", lastOutboundAt: "", lastMessageAt: "", lastReadAt: "", lockedById: "", lockedByName: "", lockExpiresAt: "", closedAt: "", createdAt: now, updatedAt: now };
}

function recordInboundServiceEvidence(db, businessId, contactId, message, now) {
  const id = `consent_inbound_${createHash("sha256").update(`${message.provider}:${message.providerMessageId}`).digest("hex").slice(0, 24)}`;
  appendConsentEvent(db, { id, businessId, contactId, channel: message.channel === "email" ? "email" : "whatsapp", purpose: "service", action: "acknowledged", lawfulBasis: "contract", source: `${message.provider}-inbound`, actorType: "contact", actorId: contactId, evidence: { threadId: message.threadId, messageId: message.id, providerMessageId: message.providerMessageId }, occurredAt: now });
}

function virtualConnection(businessId, channel, now = new Date().toISOString()) { return { id: `channel_connection_${businessId}_${channel}`, businessId, channel, provider: "development", displayName: channel === "email" ? "Email" : "WhatsApp", senderId: "", active: false, firstResponseTargetMinutes: 60, createdAt: now, updatedAt: now }; }
function findContact(db, businessId, contactId) { return db.contacts.find((item) => item.businessId === businessId && item.id === contactId && !item.merged) || null; }
function requireThread(db, businessId, threadId) { const thread = db.communicationThreads.find((item) => item.businessId === businessId && item.id === threadId && item.type === "customer"); if (!thread) throw modelError(404, "Customer conversation not found"); return thread; }
function threadSearchText(thread) { return [thread.title, thread.subject, thread.channel, thread.status, thread.contact?.name, thread.contact?.email, thread.contact?.phone, thread.lastMessage?.body].map(clean).join(" ").toLowerCase(); }
function compareChannelThreads(left, right) { return Number(right.unreadCount > 0) - Number(left.unreadCount > 0) || Number(right.sla.breached) - Number(left.sla.breached) || String(right.lastMessageAt || right.updatedAt).localeCompare(String(left.lastMessageAt || left.updatedAt)); }
function shouldApplyDelivery(current, next, occurredAt, currentAt) { if (Date.parse(occurredAt || "") < Date.parse(currentAt || "")) return false; const rank = { queued: 1, sent: 2, delivered: 3, read: 4, failed: 5, bounced: 5, complained: 5 }; return (rank[next] || 0) >= (rank[current] || 0) || ["failed", "bounced", "complained"].includes(next); }
function normalizeAttachments(value) { if (!Array.isArray(value)) return []; return value.slice(0, 20).map((item) => ({ id: optionalText(item?.id, 500), name: optionalText(item?.name || item?.filename, 240) || "Adjunto", type: optionalText(item?.type || item?.contentType, 160), url: optionalHttpUrl(item?.url), size: clampInteger(item?.size, 0, 50 * 1024 * 1024, 0) })); }
function normalizeMentions(value) { if (!Array.isArray(value)) return []; return [...new Set(value.map((item) => clean(item)).filter((item) => /^[A-Za-z0-9_-]{1,180}$/.test(item)))].slice(0, 30); }
function requiredChannel(value) { const channel = clean(value); if (!OMNICHANNEL_CHANNELS.includes(channel)) throw modelError(400, "Invalid channel"); return channel; }
function requiredText(value, field, max) { const result = optionalText(value, max); if (!result) throw modelError(400, `${field} is required`); return result; }
function optionalText(value, max) { if (value === null || value === undefined || value === "") return ""; if (typeof value !== "string") throw modelError(400, "Text fields must be strings"); const result = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim(); if (result.length > max) throw modelError(400, `Text cannot exceed ${max} characters`); return result; }
function optionalHttpUrl(value) { const text = clean(value); if (!text) return ""; try { const url = new URL(text); return ["http:", "https:"].includes(url.protocol) ? url.toString() : ""; } catch { return ""; } }
function validIso(value) { const timestamp = Date.parse(value || ""); return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : ""; }
function normalizeEmail(value) { return clean(value).toLowerCase().replace(/^.*<([^>]+)>.*$/, "$1"); }
function normalizePhone(value) { return clean(value).replace(/\D+/g, ""); }
function clampInteger(value, min, max, fallback) { const number = Number(value); return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback; }
function appendAudit(db, type, businessId, createdAt, extra = {}) { db.auditLog.push({ id: `audit_${randomUUID()}`, type, businessId, ...extra, createdAt }); }
function modelError(statusCode, message, code = "omnichannel_error") { return Object.assign(new Error(message), { statusCode, code }); }
function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
