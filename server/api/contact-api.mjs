import { corsHeaders } from "../lib/cors.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";

const MAX_BODY_BYTES = Number(process.env.CONTACT_API_MAX_BODY_BYTES || 512 * 1024);
const CONTACT_TYPES = new Set(["lead", "customer"]);
const CONTACT_STATUSES = new Set(["new", "contacted", "waiting", "reserved", "won", "lost", "customer"]);
const CONTACT_PIPELINE_STATUSES = ["new", "contacted", "waiting", "reserved", "won", "lost", "customer"];
const CONTACT_PRIORITIES = new Set(["alta", "media", "baja"]);
const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  contacts: [],
  activities: [],
  auditLog: []
};

export function isContactApiRequest(pathname) {
  return /^\/api\/public\/[^/]+\/leads$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/contacts(?:\/pipeline|\/[^/]+(?:\/activities|\/pipeline)?)?$/.test(pathname);
}

export async function handleContactApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const segments = requestUrl.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    if (segments[0] === "api" && segments[1] === "public" && segments[3] === "leads" && method === "POST") {
      await createPublicLead(segments[2], request, response, context);
      return;
    }

    if (segments[0] === "api" && segments[1] === "businesses" && segments[3] === "contacts") {
      const businessId = segments[2];
      const contactId = segments[4] || "";
      const action = segments[5] || "";

      if (contactId === "pipeline" && !action && method === "GET") {
        await getContactPipeline(businessId, requestUrl, response, context);
        return;
      }

      if (!contactId && method === "GET") {
        await listContacts(businessId, requestUrl, response, context);
        return;
      }

      if (!contactId && method === "POST") {
        await createAdminContact(businessId, request, response, context);
        return;
      }

      if (contactId && !action && method === "PATCH") {
        await updateContact(businessId, contactId, request, response, context);
        return;
      }

      if (contactId && action === "pipeline" && method === "PATCH") {
        await updateContactPipeline(businessId, contactId, request, response, context);
        return;
      }

      if (contactId && action === "activities" && method === "POST") {
        await addContactActivity(businessId, contactId, request, response, context);
        return;
      }
    }

    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "GET, POST, PATCH, OPTIONS" });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status >= 500 ? "Internal contact API error" : error.message;
    sendJson(response, status, { error: message }, context);
  }
}

async function listContacts(businessId, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const type = cleanText(requestUrl.searchParams.get("type") || "");
  const status = normalizeOptionalStatus(requestUrl.searchParams.get("status") || "");
  const q = cleanText(requestUrl.searchParams.get("q") || "").toLowerCase();
  const includeActivities = requestUrl.searchParams.get("includeActivities") === "true";

  let contacts = db.contacts
    .filter((contact) => contact.businessId === business.id)
    .map((contact) => normalizeStoredContact(contact))
    .filter((contact) => !type || contact.type === type)
    .filter((contact) => !status || contact.status === status)
    .filter((contact) => {
      if (!q) {
        return true;
      }

      return [contact.name, contact.phone, contact.email, contact.source, contact.status, contact.notes, ...(contact.tags || [])]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(q));
    })
    .sort((a, b) => String(b.lastInteractionAt || b.createdAt || "").localeCompare(String(a.lastInteractionAt || a.createdAt || "")));

  if (includeActivities) {
    contacts = contacts.map((contact) => ({
      ...contact,
      activities: db.activities
        .filter((activity) => activity.businessId === business.id && activity.contactId === contact.id)
        .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
    }));
  }

  sendJson(response, 200, { contacts, total: contacts.length }, context);
}

async function getContactPipeline(businessId, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const includeActivities = requestUrl.searchParams.get("includeActivities") === "true";
  const contacts = db.contacts
    .filter((contact) => contact.businessId === business.id)
    .map((contact) => normalizeStoredContact(contact));
  const columns = CONTACT_PIPELINE_STATUSES.map((status) => {
    const columnContacts = contacts
      .filter((contact) => contact.status === status)
      .sort(comparePipelineContacts)
      .map((contact) => includeActivities ? withContactActivities(db, business.id, contact) : contact);
    const totalValueEstimate = columnContacts.reduce((sum, contact) => sum + normalizeMoney(contact.valueEstimate), 0);

    return {
      status,
      count: columnContacts.length,
      totalValueEstimate,
      contacts: columnContacts
    };
  });

  const pipeline = Object.fromEntries(columns.map((column) => [column.status, column]));
  const totalValueEstimate = columns.reduce((sum, column) => sum + column.totalValueEstimate, 0);

  sendJson(response, 200, {
    statuses: CONTACT_PIPELINE_STATUSES,
    columns,
    pipeline,
    total: contacts.length,
    totalValueEstimate
  }, context);
}

async function createPublicLead(slug, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, slug);

  if (!business || business.status === "archived") {
    throw httpError(404, "Business not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const contact = normalizeContact(payload, null, business.id, now, {
    type: "lead",
    status: "new",
    source: "web"
  });
  const activity = makeActivity(business.id, contact.id, payload, now, {
    type: "lead.created",
    title: "Lead creado",
    source: contact.source,
    note: contact.notes
  });

  db.contacts.push(contact);
  db.activities.push(activity);
  appendAudit(db, "contact.public_lead_created", business.id, now, contact.id);
  await saveDb(db, context, "lead");
  sendJson(response, 201, { contact, activity }, context);
}

async function createAdminContact(businessId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const contact = normalizeContact(payload, null, business.id, now, {
    type: "lead",
    status: "new",
    source: "manual"
  });
  const activity = makeActivity(business.id, contact.id, payload, now, {
    type: "contact.created",
    title: "Contacto creado",
    source: contact.source,
    note: contact.notes
  });

  db.contacts.push(contact);
  db.activities.push(activity);
  appendAudit(db, "contact.created", business.id, now, contact.id);
  await saveDb(db, context, "contact");
  sendJson(response, 201, { contact, activity }, context);
}

async function updateContact(businessId, contactId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const index = db.contacts.findIndex((contact) => contact.businessId === business.id && contact.id === contactId);

  if (index === -1) {
    throw httpError(404, "Contact not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const previous = db.contacts[index];
  const contact = normalizeContact(payload, previous, business.id, now, {});

  db.contacts[index] = contact;

  let activity = null;
  if (previous.status !== contact.status) {
    activity = makeActivity(business.id, contact.id, { note: `Estado: ${previous.status} -> ${contact.status}` }, now, {
      type: "contact.status_changed",
      title: "Estado actualizado",
      source: "dashboard"
    });
    db.activities.push(activity);
  }

  appendAudit(db, "contact.updated", business.id, now, contact.id);
  await saveDb(db, context, "contact-update");
  sendJson(response, 200, { contact, activity }, context);
}

async function updateContactPipeline(businessId, contactId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const index = db.contacts.findIndex((contact) => contact.businessId === business.id && contact.id === contactId);

  if (index === -1) {
    throw httpError(404, "Contact not found");
  }

  const payload = await readJsonBody(request);
  const source = extractPayload(payload);
  const hasStatus = Object.prototype.hasOwnProperty.call(source, "status");
  const hasOrder = Object.prototype.hasOwnProperty.call(source, "order");

  if (!hasStatus && !hasOrder) {
    throw httpError(400, "Pipeline update needs status or order");
  }

  const now = new Date().toISOString();
  const previous = normalizeStoredContact(db.contacts[index]);
  const status = hasStatus ? normalizeStatus(source.status) : previous.status;
  const order = hasOrder ? normalizeOrder(source.order, previous.order) : previous.order;
  const contact = {
    ...previous,
    status,
    order,
    updatedAt: now
  };

  db.contacts[index] = contact;

  let activity = null;
  if (previous.status !== contact.status) {
    activity = makeActivity(business.id, contact.id, {
      note: `Estado: ${previous.status} -> ${contact.status}`,
      metadata: {
        previousStatus: previous.status,
        status: contact.status,
        order: contact.order
      }
    }, now, {
      type: "contact.status_changed",
      title: "Estado actualizado",
      source: "dashboard"
    });
    db.activities.push(activity);
  }

  appendAudit(db, "contact.pipeline_updated", business.id, now, contact.id);
  await saveDb(db, context, "contact-pipeline");
  sendJson(response, 200, { contact, activity }, context);
}

async function addContactActivity(businessId, contactId, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const contact = db.contacts.find((item) => item.businessId === business.id && item.id === contactId);

  if (!contact) {
    throw httpError(404, "Contact not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const activity = makeActivity(business.id, contact.id, payload, now, {
    type: "note",
    title: "Nota",
    source: "dashboard"
  });

  db.activities.push(activity);
  contact.lastInteractionAt = now;
  contact.updatedAt = now;
  appendAudit(db, "contact.activity_created", business.id, now, contact.id);
  await saveDb(db, context, "activity");
  sendJson(response, 201, { contact, activity }, context);
}

function normalizeContact(payload, existing, businessId, now, defaults) {
  const source = extractPayload(payload);
  const rawContact = cleanText(source.contact || source.leadContact || source.phoneOrEmail || "", 320);
  const email = cleanText(source.email || extractEmail(rawContact) || existing?.email || "", 320);
  const phone = cleanText(source.phone || source.telephone || extractPhone(rawContact) || existing?.phone || "", 80);
  const name = cleanText(source.name || source.fullName || source.leadName || existing?.name || "Lead sin nombre", 160);
  const notes = cleanText(source.notes || source.message || source.need || existing?.notes || "", 4000);

  if (!name && !phone && !email && !notes) {
    throw httpError(400, "Contact needs at least name, contact or notes");
  }

  const type = normalizeType(source.type || existing?.type || defaults.type || "lead");
  const status = normalizeStatus(source.status || existing?.status || defaults.status || (type === "customer" ? "customer" : "new"));
  const tags = normalizeTags(source.tags ?? existing?.tags);
  const priority = normalizePriority(source.priority || existing?.priority || defaults.priority || "media");
  const order = normalizeOrder(source.order ?? existing?.order ?? defaults.order, fallbackContactOrder(existing, now));

  return {
    id: existing?.id || cleanId(source.id) || `contact_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    businessId,
    type,
    name,
    phone,
    email,
    source: cleanText(source.source || existing?.source || defaults.source || "manual", 80),
    status,
    priority,
    order,
    tags,
    notes,
    valueEstimate: Number.isFinite(Number(source.valueEstimate ?? existing?.valueEstimate))
      ? Number(source.valueEstimate ?? existing?.valueEstimate)
      : 0,
    privacyAccepted: normalizeBoolean(source.privacyAccepted, existing?.privacyAccepted ?? false),
    privacyAcceptedAt: cleanText(source.privacyAcceptedAt || existing?.privacyAcceptedAt || "", 80),
    privacyPolicyUrl: cleanText(source.privacyPolicyUrl || existing?.privacyPolicyUrl || "", 500),
    lastInteractionAt: cleanText(source.lastInteractionAt || existing?.lastInteractionAt || now, 80),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeStoredContact(contact) {
  const normalizedStatus = normalizeStoredStatus(contact?.status);
  const normalizedPriority = normalizeStoredPriority(contact?.priority);

  return {
    ...contact,
    status: normalizedStatus,
    priority: normalizedPriority,
    order: normalizeOrder(contact?.order, fallbackContactOrder(contact))
  };
}

function withContactActivities(db, businessId, contact) {
  return {
    ...contact,
    activities: db.activities
      .filter((activity) => activity.businessId === businessId && activity.contactId === contact.id)
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")))
  };
}

function makeActivity(businessId, contactId, payload, now, defaults) {
  const source = extractPayload(payload);
  return {
    id: cleanId(source.id) || `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    businessId,
    contactId,
    type: cleanText(source.type || defaults.type || "note", 80),
    title: cleanText(source.title || defaults.title || "Actividad", 160),
    note: cleanText(source.note || source.notes || source.message || defaults.note || "", 4000),
    source: cleanText(source.source || defaults.source || "manual", 80),
    metadata: isPlainObject(source.metadata) ? source.metadata : {},
    createdAt: now
  };
}

async function loadDb(context) {
  const db = await loadBusinessStore(context, DEFAULT_DB);

  db.version = Number(db.version || 1);
  db.businesses = Array.isArray(db.businesses) ? db.businesses : [];
  db.contacts = Array.isArray(db.contacts) ? db.contacts : [];
  db.activities = Array.isArray(db.activities) ? db.activities : [];
  db.auditLog = Array.isArray(db.auditLog) ? db.auditLog : [];
  return db;
}

async function saveDb(db, context, backupLabel) {
  await saveBusinessStore(db, context, backupLabel);
}

async function readJsonBody(request) {
  let size = 0;
  let raw = "";

  for await (const chunk of request) {
    size += chunk.length;

    if (size > MAX_BODY_BYTES) {
      throw httpError(413, "JSON body is too large");
    }

    raw += chunk;
  }

  if (!raw.trim()) {
    throw httpError(400, "JSON body is required");
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw httpError(400, "Invalid JSON body");
  }
}

function findBusiness(db, id) {
  return db.businesses.find((business) => business.id === id || business.slug === id);
}

function extractPayload(payload) {
  if (!isPlainObject(payload)) {
    throw httpError(400, "JSON body must be an object");
  }

  if (isPlainObject(payload.contact)) {
    return payload.contact;
  }

  if (isPlainObject(payload.lead)) {
    return payload.lead;
  }

  if (isPlainObject(payload.activity)) {
    return payload.activity;
  }

  return payload;
}

function normalizeType(value) {
  const type = cleanText(value, 40);

  if (!CONTACT_TYPES.has(type)) {
    throw httpError(400, `Invalid contact type: ${type}`);
  }

  return type;
}

function normalizeStatus(value) {
  const status = normalizeStatusAlias(value);

  if (!CONTACT_STATUSES.has(status)) {
    throw httpError(400, `Invalid contact status: ${status}`);
  }

  return status;
}

function normalizeStoredStatus(value) {
  const status = normalizeStatusAlias(value);
  return CONTACT_STATUSES.has(status) ? status : "new";
}

function normalizePriority(value) {
  const priority = normalizePriorityAlias(value);

  if (!CONTACT_PRIORITIES.has(priority)) {
    throw httpError(400, `Invalid contact priority: ${priority}`);
  }

  return priority;
}

function normalizeStoredPriority(value) {
  const priority = normalizePriorityAlias(value);
  return CONTACT_PRIORITIES.has(priority) ? priority : "media";
}

function normalizePriorityAlias(value) {
  const priority = cleanText(value, 40).toLowerCase();
  const aliases = {
    high: "alta",
    medium: "media",
    low: "baja"
  };

  return aliases[priority] || priority || "media";
}

function normalizeOrder(value, fallback = 0) {
  const number = Number(value);

  if (Number.isFinite(number)) {
    return number;
  }

  const fallbackNumber = Number(fallback);
  return Number.isFinite(fallbackNumber) ? fallbackNumber : 0;
}

function fallbackContactOrder(contact, now = new Date().toISOString()) {
  const parsed = Date.parse(contact?.createdAt || contact?.updatedAt || now);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function comparePipelineContacts(left, right) {
  const order = normalizeOrder(left.order, fallbackContactOrder(left)) - normalizeOrder(right.order, fallbackContactOrder(right));

  if (Math.abs(order) > Number.EPSILON) {
    return order;
  }

  return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
}

function normalizeMoney(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeOptionalStatus(value) {
  return value ? normalizeStatus(value) : "";
}

function normalizeStatusAlias(value) {
  const status = cleanText(value, 80).toLowerCase();
  const aliases = {
    nuevo: "new",
    contacted: "contacted",
    contactado: "contacted",
    "esperando respuesta": "waiting",
    waiting_response: "waiting",
    reservado: "reserved",
    ganada: "won",
    ganado: "won",
    perdida: "lost",
    perdido: "lost",
    cliente: "customer"
  };

  return aliases[status] || status || "new";
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item, 60)).filter(Boolean).slice(0, 12);
  }

  return cleanText(value || "", 300)
    .split(",")
    .map((item) => cleanText(item, 60))
    .filter(Boolean)
    .slice(0, 12);
}

function appendAudit(db, type, businessId, now, contactId) {
  db.auditLog.push({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    businessId,
    contactId,
    createdAt: now
  });
}

function sendJson(response, status, payload, context, extraHeaders = {}) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendEmpty(response, status, context) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    Allow: "GET, POST, PATCH, OPTIONS"
  });
  response.end();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanText(value, maxLength = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function normalizeBoolean(value, fallback = false) {
  if (value === true || value === "true" || value === "on" || value === 1 || value === "1") {
    return true;
  }

  if (value === false || value === "false" || value === "off" || value === 0 || value === "0") {
    return false;
  }

  return Boolean(fallback);
}

function cleanId(value) {
  return cleanText(value, 80).replace(/[^a-z0-9_-]/gi, "_").replace(/^_+|_+$/g, "");
}

function extractEmail(value) {
  return String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}

function extractPhone(value) {
  return String(value || "").match(/(\+?\d[\d\s().-]{7,})/)?.[0] || "";
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
