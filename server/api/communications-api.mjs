import { randomUUID } from "node:crypto";
import { upsertAssociation } from "../lib/association-model.mjs";
import { corsHeaders } from "../lib/cors.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { getRequestClientSession } from "../lib/client-auth.mjs";

const MAX_BODY_BYTES = Number(process.env.COMMUNICATIONS_API_MAX_BODY_BYTES || 96 * 1024);
const THREAD_TYPES = new Set(["support", "team", "customer"]);
const THREAD_STATUSES = new Set(["open", "closed"]);
const MEMBER_ROLES = new Set(["owner", "manager", "employee"]);
const THREAD_FIELDS = new Set(["type", "title", "contactId", "accountId", "dealId"]);
const THREAD_UPDATE_FIELDS = new Set(["title", "status"]);
const MESSAGE_FIELDS = new Set(["body", "senderName", "attachmentName", "attachmentUrl"]);
const MEMBER_FIELDS = new Set(["name", "role"]);
const MEMBER_UPDATE_FIELDS = new Set(["name", "role", "active"]);

export function isCommunicationsApiRequest(pathname) {
  return /^\/api\/enterprise\/communications\/threads(?:\/[^/]+(?:\/messages)?)?$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/communications\/(?:threads(?:\/[^/]+(?:\/messages)?)?|members(?:\/[^/]+)?)$/.test(pathname);
}

export async function handleCommunicationsApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://dls.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    const route = parseRoute(requestUrl.pathname);
    const db = await loadDb(context);
    const clientSession = getRequestClientSession(request);
    const actor = clientSession
      ? { role: "client", businessId: clientSession.businessId, name: clean(clientSession.businessName) || "Cliente" }
      : { role: "developer", businessId: "", name: "Equipo DLS" };
    const developerPortalPreview = actor.role === "developer"
      && requestUrl.searchParams.get("portalPreview") === "developer";
    const business = route.businessRef ? requireBusiness(db, route.businessRef) : null;

    if (clientSession && business?.id !== clientSession.businessId) throw httpError(403, "Client session cannot access this business");
    if (!business && route.resource === "members") throw httpError(400, "Members require a business scope");

    if (route.resource === "threads") {
      await handleThreads({ request, response, context, requestUrl, method, route, db, business, actor, developerPortalPreview });
      return;
    }
    if (route.resource === "members") {
      if (actor.role === "developer") {
        if (method === "GET" && !route.resourceId) {
          const members = developerPortalPreview
            ? db.teamMembers.filter((member) => member.businessId === business.id && member.active !== false).sort(compareNames)
            : [];
          sendJson(response, 200, { members, total: members.length, readOnly: developerPortalPreview }, context);
          return;
        }
        throw httpError(403, "Private team profiles are only available in the client portal");
      }
      await handleMembers({ request, response, context, method, route, db, business, actor });
      return;
    }
    throw httpError(404, "Communications resource not found");
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, {
      error: status >= 500 ? "Internal communications API error" : error.message,
      code: error.code || "communications_error"
    }, context);
  }
}

async function handleThreads(input) {
  const { request, response, context, requestUrl, method, route, db, business, actor, developerPortalPreview } = input;
  if (!route.resourceId) {
    if (method === "GET") {
      const threads = listThreads(
        db,
        requestUrl.searchParams,
        business?.id || "",
        actor,
        actor.role === "developer" && !developerPortalPreview ? "support" : "",
        developerPortalPreview ? new Set(["support", "team"]) : null
      );
      if (parseBoolean(requestUrl.searchParams.get("markRead"))) {
        const now = new Date().toISOString();
        const unreadThreads = threads.filter((item) => Number(item.unreadCount || 0) > 0);
        unreadThreads.forEach((item) => markThreadRead(requireThread(db, item.id, item.businessId), actor, now));
        if (unreadThreads.length) await saveBusinessStore(db, context, "communications-read");
      }
      sendJson(response, 200, {
        threads,
        total: threads.length,
        unreadTotal: threads.reduce((sum, thread) => sum + thread.unreadCount, 0)
      }, context);
      return;
    }
    if (method === "POST") {
      if (!business) throw httpError(400, "Thread creation requires a business scope");
      const source = extractPayload(await readJsonBody(request), "thread");
      assertAllowedFields(source, THREAD_FIELDS, "thread");
      const type = requiredEnum(source.type, THREAD_TYPES, "type");
      if (actor.role === "developer" && type === "team") throw httpError(403, "Private team rooms are only available in the client portal");
      if (actor.role === "client" && type === "support") {
        const existing = db.communicationThreads.find((thread) => thread.businessId === business.id && thread.type === "support");
        if (existing) {
          sendJson(response, 200, { thread: decorateThread(db, existing, actor), created: false }, context);
          return;
        }
      }
      const now = new Date().toISOString();
      const contactId = optionalId(source.contactId, "contactId");
      const accountId = optionalId(source.accountId, "accountId");
      const dealId = optionalId(source.dealId, "dealId");
      if (contactId && !db.contacts.some((item) => item.businessId === business.id && item.id === contactId && !item.merged)) throw httpError(404, "Contact not found");
      if (accountId && !db.accounts.some((item) => item.businessId === business.id && item.id === accountId && !item.archivedAt && !item.merged)) throw httpError(404, "Account not found");
      if (dealId && !db.deals.some((item) => item.businessId === business.id && item.id === dealId && !item.archivedAt)) throw httpError(404, "Deal not found");
      const thread = {
        id: `communication_thread_${randomUUID()}`,
        businessId: business.id,
        type,
        contactId,
        accountId,
        dealId,
        title: type === "support"
          ? `Atención DLS · ${business.name}`
          : requiredText(source.title, "title", 160),
        status: "open",
        createdByRole: actor.role,
        createdByName: actor.name,
        clientReadAt: actor.role === "client" ? now : "",
        adminReadAt: actor.role === "developer" ? now : "",
        lastMessageAt: "",
        createdAt: now,
        updatedAt: now
      };
      db.communicationThreads.push(thread);
      syncThreadAssociations(db, thread, now);
      appendAudit(db, "communication.thread_created", thread, now);
      await saveBusinessStore(db, context, "communication-thread-create");
      sendJson(response, 201, { thread: decorateThread(db, thread, actor), created: true }, context);
      return;
    }
    throw methodNotAllowed();
  }

  const thread = requireThread(db, route.resourceId, business?.id || "");
  if (actor.role === "developer" && thread.type !== "support") throw httpError(404, "Communication thread not found");
  if (route.action === "messages") {
    await handleMessages({ request, response, context, method, db, thread, actor });
    return;
  }
  if (method === "GET") {
    const result = decorateThread(db, thread, actor);
    markThreadRead(thread, actor, new Date().toISOString());
    await saveBusinessStore(db, context, "communication-thread-read");
    sendJson(response, 200, { thread: result }, context);
    return;
  }
  if (method === "PATCH") {
    const source = extractPayload(await readJsonBody(request), "thread");
    assertAllowedFields(source, THREAD_UPDATE_FIELDS, "thread");
    assertHasFields(source, "thread");
    if (actor.role === "client" && thread.type === "support" && Object.prototype.hasOwnProperty.call(source, "title")) {
      throw httpError(403, "Support thread title is managed by DLS");
    }
    if (Object.prototype.hasOwnProperty.call(source, "title")) thread.title = requiredText(source.title, "title", 160);
    if (Object.prototype.hasOwnProperty.call(source, "status")) thread.status = requiredEnum(source.status, THREAD_STATUSES, "status");
    thread.updatedAt = new Date().toISOString();
    appendAudit(db, "communication.thread_updated", thread, thread.updatedAt);
    await saveBusinessStore(db, context, "communication-thread-update");
    sendJson(response, 200, { thread: decorateThread(db, thread, actor) }, context);
    return;
  }
  throw methodNotAllowed();
}

async function handleMessages({ request, response, context, method, db, thread, actor }) {
  if (method === "GET") {
    const messages = threadMessages(db, thread.id);
    markThreadRead(thread, actor, new Date().toISOString());
    await saveBusinessStore(db, context, "communication-messages-read");
    sendJson(response, 200, { messages, total: messages.length }, context);
    return;
  }
  if (method === "POST") {
    const source = extractPayload(await readJsonBody(request), "message");
    assertAllowedFields(source, MESSAGE_FIELDS, "message");
    const body = optionalText(source.body, 5000);
    const attachmentUrl = optionalHttpUrl(source.attachmentUrl, "attachmentUrl");
    if (!body && !attachmentUrl) throw httpError(400, "Message body or attachment is required");
    const now = new Date().toISOString();
    const senderRole = thread.type === "team" && actor.role === "client" ? "employee" : actor.role;
    const senderName = actor.role === "developer"
      ? optionalText(source.senderName, 120) || "Equipo DLS"
      : requiredText(source.senderName, "senderName", 120);
    const message = {
      id: `communication_message_${randomUUID()}`,
      businessId: thread.businessId,
      threadId: thread.id,
      senderRole,
      senderName,
      body,
      attachmentName: attachmentUrl ? optionalText(source.attachmentName, 240) || "Archivo adjunto" : "",
      attachmentUrl,
      createdAt: now,
      updatedAt: now
    };
    db.communicationMessages.push(message);
    thread.status = "open";
    thread.lastMessageAt = now;
    thread.updatedAt = now;
    if (actor.role === "client") thread.clientReadAt = now;
    if (actor.role === "developer") thread.adminReadAt = now;
    appendAudit(db, "communication.message_created", message, now, { threadId: thread.id });
    await saveBusinessStore(db, context, "communication-message-create");
    sendJson(response, 201, { message, thread: decorateThread(db, thread, actor) }, context);
    return;
  }
  throw methodNotAllowed();
}

async function handleMembers({ request, response, context, method, route, db, business, actor }) {
  if (!route.resourceId) {
    if (method === "GET") {
      const members = db.teamMembers.filter((member) => member.businessId === business.id && member.active !== false).sort(compareNames);
      sendJson(response, 200, { members, total: members.length }, context);
      return;
    }
    if (method === "POST") {
      const source = extractPayload(await readJsonBody(request), "member");
      assertAllowedFields(source, MEMBER_FIELDS, "member");
      const name = requiredText(source.name, "name", 120);
      const existing = db.teamMembers.find((member) => member.businessId === business.id && normalizeLookup(member.name) === normalizeLookup(name));
      if (existing) {
        existing.active = true;
        existing.updatedAt = new Date().toISOString();
        await saveBusinessStore(db, context, "team-member-reactivate");
        sendJson(response, 200, { member: existing, created: false }, context);
        return;
      }
      const now = new Date().toISOString();
      const member = {
        id: `team_member_${randomUUID()}`,
        businessId: business.id,
        name,
        role: optionalEnum(source.role, MEMBER_ROLES, "role") || "employee",
        active: true,
        createdByRole: actor.role,
        createdAt: now,
        updatedAt: now
      };
      db.teamMembers.push(member);
      appendAudit(db, "communication.member_created", member, now);
      await saveBusinessStore(db, context, "team-member-create");
      sendJson(response, 201, { member, created: true }, context);
      return;
    }
    throw methodNotAllowed();
  }

  const member = db.teamMembers.find((item) => item.id === route.resourceId && item.businessId === business.id);
  if (!member) throw httpError(404, "Team member not found");
  if (method === "PATCH") {
    const source = extractPayload(await readJsonBody(request), "member");
    assertAllowedFields(source, MEMBER_UPDATE_FIELDS, "member");
    assertHasFields(source, "member");
    if (Object.prototype.hasOwnProperty.call(source, "name")) member.name = requiredText(source.name, "name", 120);
    if (Object.prototype.hasOwnProperty.call(source, "role")) member.role = requiredEnum(source.role, MEMBER_ROLES, "role");
    if (Object.prototype.hasOwnProperty.call(source, "active")) member.active = Boolean(source.active);
    member.updatedAt = new Date().toISOString();
    await saveBusinessStore(db, context, "team-member-update");
    sendJson(response, 200, { member }, context);
    return;
  }
  throw methodNotAllowed();
}

function parseRoute(pathname) {
  const segments = pathname.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  if (segments[1] === "enterprise") {
    return { businessRef: "", resource: segments[3] || "", resourceId: segments[4] || "", action: segments[5] || "" };
  }
  return { businessRef: segments[2] || "", resource: segments[4] || "", resourceId: segments[5] || "", action: segments[6] || "" };
}

function listThreads(db, searchParams, businessId, actor, forcedType = "", visibleTypes = null) {
  const requestedType = optionalEnum(searchParams.get("type"), THREAD_TYPES, "type");
  const type = forcedType || requestedType;
  const status = optionalEnum(searchParams.get("status"), THREAD_STATUSES, "status");
  const search = clean(searchParams.get("search")).toLowerCase();
  return db.communicationThreads
    .filter((thread) => !businessId || thread.businessId === businessId)
    .filter((thread) => !visibleTypes || visibleTypes.has(thread.type))
    .filter((thread) => !type || thread.type === type)
    .filter((thread) => !status || thread.status === status)
    .filter((thread) => !search || threadSearchText(db, thread).includes(search))
    .sort(compareThreads)
    .map((thread) => decorateThread(db, thread, actor));
}

function decorateThread(db, thread, actor) {
  const messages = threadMessages(db, thread.id).slice(-100);
  const business = db.businesses.find((item) => item.id === thread.businessId) || {};
  const readAt = actor.role === "client" ? thread.clientReadAt : thread.adminReadAt;
  const unreadRoles = actor.role === "client" ? new Set(["developer"]) : new Set(["client"]);
  return {
    ...thread,
    business: { id: business.id || thread.businessId, slug: business.slug || "", name: business.name || "Cliente" },
    messageCount: db.communicationMessages.filter((message) => message.threadId === thread.id).length,
    unreadCount: messages.filter((message) => unreadRoles.has(message.senderRole) && (!readAt || message.createdAt > readAt)).length,
    lastMessage: messages.at(-1) || null,
    messages
  };
}

function markThreadRead(thread, actor, now) {
  if (actor.role === "client") thread.clientReadAt = now;
  else thread.adminReadAt = now;
}

function threadMessages(db, threadId) {
  return db.communicationMessages.filter((message) => message.threadId === threadId).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function threadSearchText(db, thread) {
  const business = db.businesses.find((item) => item.id === thread.businessId) || {};
  const lastMessage = threadMessages(db, thread.id).at(-1) || {};
  return [thread.title, thread.type, thread.status, business.name, lastMessage.body, lastMessage.senderName].map(clean).join(" ").toLowerCase();
}

async function loadDb(context) {
  const db = await loadBusinessStore(context);
  for (const key of ["businesses", "contacts", "accounts", "deals", "associations", "teamMembers", "communicationThreads", "communicationMessages", "auditLog"]) {
    db[key] = Array.isArray(db[key]) ? db[key] : [];
  }
  return db;
}

function syncThreadAssociations(db, thread, now) {
  if (thread.contactId) {
    upsertAssociation(db, { businessId: thread.businessId, fromType: "contact", fromId: thread.contactId, toType: "conversation", toId: thread.id, kind: "participant", isPrimary: true, now });
  }
  if (thread.accountId) {
    upsertAssociation(db, { businessId: thread.businessId, fromType: "conversation", fromId: thread.id, toType: "account", toId: thread.accountId, kind: "related", isPrimary: false, now });
  }
  if (thread.dealId) {
    upsertAssociation(db, { businessId: thread.businessId, fromType: "conversation", fromId: thread.id, toType: "deal", toId: thread.dealId, kind: "related", isPrimary: false, now });
  }
}

function requireBusiness(db, ref) {
  const business = db.businesses.find((item) => item.id === ref || item.slug === ref);
  if (!business) throw httpError(404, "Business not found");
  return business;
}

function requireThread(db, id, businessId) {
  const cleanId = requiredId(id, "threadId");
  const thread = db.communicationThreads.find((item) => item.id === cleanId && (!businessId || item.businessId === businessId));
  if (!thread) throw httpError(404, "Communication thread not found");
  return thread;
}

function compareThreads(left, right) {
  return String(right.lastMessageAt || right.updatedAt || "").localeCompare(String(left.lastMessageAt || left.updatedAt || ""));
}

function compareNames(left, right) {
  return String(left.name || "").localeCompare(String(right.name || ""), "es", { sensitivity: "base" });
}

function extractPayload(payload, wrapper) {
  if (!isPlainObject(payload)) throw httpError(400, "JSON body must be an object");
  if (Object.prototype.hasOwnProperty.call(payload, wrapper)) {
    if (Object.keys(payload).length !== 1 || !isPlainObject(payload[wrapper])) throw httpError(400, `${wrapper} wrapper must contain an object`);
    return payload[wrapper];
  }
  return payload;
}

function assertAllowedFields(source, allowed, resource) {
  const unknown = Object.keys(source).filter((field) => !allowed.has(field));
  if (unknown.length) throw httpError(400, `Unknown ${resource} field(s): ${unknown.join(", ")}`);
}

function assertHasFields(source, resource) {
  if (!Object.keys(source).length) throw httpError(400, `${resource} update needs at least one field`);
}

function requiredEnum(value, allowed, field) {
  if (typeof value !== "string" || !allowed.has(value)) throw httpError(400, `${field} has an invalid value`);
  return value;
}

function optionalEnum(value, allowed, field) {
  return value === null || value === undefined || value === "" ? "" : requiredEnum(value, allowed, field);
}

function requiredText(value, field, maxLength) {
  const result = optionalText(value, maxLength);
  if (!result) throw httpError(400, `${field} is required`);
  return result;
}

function optionalText(value, maxLength) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string") throw httpError(400, "Text fields must be strings");
  const result = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (result.length > maxLength) throw httpError(400, `Text cannot exceed ${maxLength} characters`);
  return result;
}

function optionalHttpUrl(value, field) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string" || value.length > 2000) throw httpError(400, `${field} must be a valid HTTP URL`);
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("protocol");
    return url.toString();
  } catch {
    throw httpError(400, `${field} must be a valid HTTP URL`);
  }
}

function requiredId(value, field) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,180}$/.test(value)) throw httpError(400, `${field} has an invalid format`);
  return value;
}

function optionalId(value, field) {
  if (value === undefined || value === null || value === "") return "";
  return requiredId(value, field);
}

async function readJsonBody(request) {
  let raw = "";
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw httpError(413, "Communications payload too large");
    raw += chunk.toString("utf8");
  }
  if (!raw.trim()) throw httpError(400, "JSON body is required");
  try { return JSON.parse(raw); } catch { throw httpError(400, "Invalid JSON body"); }
}

function appendAudit(db, type, entity, now, extra = {}) {
  db.auditLog.push({ id: `audit_${randomUUID()}`, type, businessId: entity.businessId, entityId: entity.id, ...extra, createdAt: now });
}

function parseBoolean(value) {
  return ["1", "true", "yes", "on"].includes(clean(value).toLowerCase());
}

function normalizeLookup(value) {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function methodNotAllowed() { return httpError(405, "Method not allowed"); }
function httpError(statusCode, message) { const error = new Error(message); error.statusCode = statusCode; return error; }
function clean(value) { return String(value || "").trim(); }
function isPlainObject(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }

function sendJson(response, status, payload, context) {
  response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload, null, 2));
}

function sendEmpty(response, status, context) {
  response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: "GET, POST, PATCH, OPTIONS" });
  response.end();
}
