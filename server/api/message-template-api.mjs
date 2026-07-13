import { corsHeaders } from "../lib/cors.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import {
  DEFAULT_MESSAGE_TEMPLATES,
  MESSAGE_TEMPLATE_TYPES,
  SAFE_MESSAGE_PLACEHOLDERS,
  buildMessageLinks,
  getDefaultMessageTemplate,
  renderMessageTemplate
} from "../lib/message-template-renderer.mjs";

const MAX_BODY_BYTES = Number(process.env.MESSAGE_TEMPLATE_API_MAX_BODY_BYTES || 128 * 1024);
const MESSAGE_TEMPLATE_TYPE_SET = new Set(MESSAGE_TEMPLATE_TYPES);
const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  contacts: [],
  messageTemplates: [],
  auditLog: []
};

export function isMessageTemplateApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/message-templates(?:\/[^/]+(?:\/render)?)?$/.test(pathname);
}

export async function handleMessageTemplateApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const segments = requestUrl.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    if (segments[0] !== "api" || segments[1] !== "businesses" || segments[3] !== "message-templates") {
      throw httpError(404, "Message template route not found");
    }

    const businessId = segments[2] || "";
    const templateId = segments[4] || "";
    const action = segments[5] || "";

    if (!templateId && method === "GET") {
      await listMessageTemplates(businessId, response, context);
      return;
    }

    if (!templateId && method === "POST") {
      await createMessageTemplate(businessId, request, response, context);
      return;
    }

    if (templateId === "render" && !action && method === "POST") {
      await renderSelectedMessageTemplate(businessId, "", request, response, context);
      return;
    }

    if (templateId && !action && method === "GET") {
      await getMessageTemplate(businessId, templateId, response, context);
      return;
    }

    if (templateId && !action && ["PUT", "PATCH"].includes(method)) {
      await updateMessageTemplate(businessId, templateId, request, response, context);
      return;
    }

    if (templateId && !action && method === "DELETE") {
      await deleteMessageTemplate(businessId, templateId, response, context);
      return;
    }

    if (templateId && action === "render" && method === "POST") {
      await renderSelectedMessageTemplate(businessId, templateId, request, response, context);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" }, context, {
      Allow: "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status >= 500 ? "Internal message template API error" : error.message;
    sendJson(response, status, { error: message }, context);
  }
}

async function listMessageTemplates(businessRef, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const templates = effectiveTemplates(db, business.id);

  sendJson(response, 200, {
    templates,
    total: templates.length,
    types: MESSAGE_TEMPLATE_TYPES,
    placeholders: SAFE_MESSAGE_PLACEHOLDERS
  }, context);
}

async function getMessageTemplate(businessRef, templateId, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const template = findTemplate(db, business.id, templateId);

  if (!template) {
    throw httpError(404, "Message template not found");
  }

  sendJson(response, 200, { template }, context);
}

async function createMessageTemplate(businessRef, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const payload = await readJsonBody(request);
  const source = extractTemplatePayload(payload);
  const type = normalizeTemplateType(source.type);

  if (findOverrideByType(db, business.id, type)) {
    throw httpError(409, `Message template override already exists for type: ${type}`);
  }

  const now = new Date().toISOString();
  const template = normalizeTemplate(source, null, business.id, db, now);
  db.messageTemplates.push(template);
  appendAudit(db, "message_template.created", business.id, template.id, now);
  await saveDb(db, context, "message-template-create");
  sendJson(response, 201, { template: storedTemplateView(template) }, context);
}

async function updateMessageTemplate(businessRef, templateId, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);

  if (defaultTypeFromId(templateId)) {
    throw httpError(409, "Virtual default templates cannot be updated; create a business override instead");
  }

  const index = db.messageTemplates.findIndex((template) => template.businessId === business.id && template.id === templateId);

  if (index === -1) {
    throw httpError(404, "Message template not found");
  }

  const payload = await readJsonBody(request);
  const source = extractTemplatePayload(payload);
  const nextType = normalizeTemplateType(source.type ?? db.messageTemplates[index].type);
  const collision = findOverrideByType(db, business.id, nextType);

  if (collision && collision.id !== templateId) {
    throw httpError(409, `Message template override already exists for type: ${nextType}`);
  }

  const now = new Date().toISOString();
  const template = normalizeTemplate(source, db.messageTemplates[index], business.id, db, now);
  db.messageTemplates[index] = template;
  appendAudit(db, "message_template.updated", business.id, template.id, now);
  await saveDb(db, context, "message-template-update");
  sendJson(response, 200, { template: storedTemplateView(template) }, context);
}

async function deleteMessageTemplate(businessRef, templateId, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);

  if (defaultTypeFromId(templateId)) {
    throw httpError(409, "Virtual default templates cannot be deleted");
  }

  const index = db.messageTemplates.findIndex((template) => template.businessId === business.id && template.id === templateId);

  if (index === -1) {
    throw httpError(404, "Message template not found");
  }

  const [template] = db.messageTemplates.splice(index, 1);
  const now = new Date().toISOString();
  appendAudit(db, "message_template.deleted", business.id, template.id, now);
  await saveDb(db, context, "message-template-delete");
  sendJson(response, 200, {
    template: storedTemplateView(template),
    deleted: true,
    fallback: virtualTemplate(template.type, business.id)
  }, context);
}

async function renderSelectedMessageTemplate(businessRef, routeTemplateId, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const payload = await readJsonBody(request);
  const source = isPlainObject(payload.render) ? payload.render : payload;
  const contactId = cleanId(source.contactId || source.contact_id);

  if (!contactId) {
    throw httpError(400, "contactId is required to render a message template");
  }

  const contact = db.contacts.find((item) => (
    item.businessId === business.id && item.id === contactId && !item.merged
  ));

  if (!contact) {
    throw httpError(404, "Contact not found");
  }

  const requestedTemplateId = cleanId(routeTemplateId || source.templateId || source.template_id);
  const requestedType = source.type ? normalizeTemplateType(source.type) : "";
  const template = requestedTemplateId
    ? findTemplate(db, business.id, requestedTemplateId)
    : requestedType
      ? effectiveTemplateForType(db, business.id, requestedType)
      : null;

  if (!template) {
    throw httpError(requestedTemplateId || requestedType ? 404 : 400, requestedTemplateId || requestedType
      ? "Message template not found"
      : "templateId or type is required to render a message template");
  }

  const variables = buildRenderVariables(source, business, contact);
  const rendered = renderMessageTemplate(template, variables);
  const links = buildMessageLinks({
    phone: contact.phone,
    email: contact.email,
    subject: rendered.subject,
    message: rendered.message
  });

  sendJson(response, 200, {
    template,
    contact: contactSummary(contact),
    subject: rendered.subject,
    message: rendered.message,
    unknownPlaceholders: rendered.unknownPlaceholders,
    missingPlaceholders: rendered.missingPlaceholders,
    usedPlaceholders: rendered.usedPlaceholders,
    links
  }, context);
}

function effectiveTemplates(db, businessId) {
  return MESSAGE_TEMPLATE_TYPES.map((type) => effectiveTemplateForType(db, businessId, type));
}

function effectiveTemplateForType(db, businessId, type) {
  const override = findOverrideByType(db, businessId, type);
  return override ? storedTemplateView(override) : virtualTemplate(type, businessId);
}

function findTemplate(db, businessId, templateId) {
  const stored = db.messageTemplates.find((template) => template.businessId === businessId && template.id === templateId);

  if (stored) {
    return storedTemplateView(stored);
  }

  const defaultType = defaultTypeFromId(templateId);
  return defaultType ? virtualTemplate(defaultType, businessId) : null;
}

function findOverrideByType(db, businessId, type) {
  return db.messageTemplates
    .filter((template) => template.businessId === businessId && template.type === type)
    .sort((left, right) => String(right.updatedAt || "").localeCompare(String(left.updatedAt || "")))[0] || null;
}

function virtualTemplate(type, businessId) {
  const template = getDefaultMessageTemplate(type);

  if (!template) {
    return null;
  }

  return {
    ...template,
    businessId,
    virtual: true,
    isDefault: true,
    isOverride: false
  };
}

function storedTemplateView(template) {
  return {
    id: template.id,
    businessId: template.businessId,
    type: template.type,
    label: template.label,
    subject: template.subject,
    body: template.body,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
    virtual: false,
    isDefault: false,
    isOverride: true
  };
}

function normalizeTemplate(source, existing, businessId, db, now) {
  const type = normalizeTemplateType(source.type ?? existing?.type);
  const fallback = getDefaultMessageTemplate(type);
  const label = hasOwn(source, "label")
    ? cleanText(source.label, 160)
    : cleanText(existing?.label || fallback?.label, 160);
  const subject = hasOwn(source, "subject")
    ? cleanText(source.subject, 500)
    : cleanText(existing?.subject ?? fallback?.subject, 500);
  const body = hasOwn(source, "body")
    ? cleanBody(source.body, 12000)
    : cleanBody(existing?.body || fallback?.body, 12000);

  if (!label) {
    throw httpError(400, "Message template label is required");
  }

  if (!body) {
    throw httpError(400, "Message template body is required");
  }

  const requestedId = cleanId(source.id || existing?.id);

  if (!existing && (defaultTypeFromId(requestedId) || requestedId === "render")) {
    throw httpError(400, "Message template id is reserved");
  }

  const id = existing?.id || requestedId || createTemplateId(db);

  if (!existing && db.messageTemplates.some((template) => template.id === id)) {
    throw httpError(409, "Message template id already exists");
  }

  return {
    id,
    businessId,
    type,
    label,
    subject,
    body,
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function buildRenderVariables(source, business, contact) {
  const supplied = isPlainObject(source.variables) ? source.variables : {};
  const content = isPlainObject(business.content) ? business.content : {};
  const google = isPlainObject(content.google) ? content.google : {};
  const integrationGoogle = isPlainObject(business.integrations?.google) ? business.integrations.google : {};
  const activeDemo = isPlainObject(business.settings?.activeDemo) ? business.settings.activeDemo : {};

  return {
    nombre: cleanText(contact.name || contact.fullName || contact.customerName || "", 300),
    negocio: cleanText(business.name || "", 300),
    telefono: cleanText(contact.phone || "", 120),
    email: cleanText(contact.email || "", 500),
    demo_url: safeUrl(source.demoUrl || source.demo_url || supplied.demo_url || activeDemo.url || business.publishedUrl),
    propuesta_url: safeUrl(source.proposalUrl || source.propuestaUrl || source.propuesta_url || supplied.propuesta_url),
    review_url: safeUrl(source.reviewUrl || source.review_url || supplied.review_url || google.reviewUrl || integrationGoogle.reviewUrl)
  };
}

function contactSummary(contact) {
  return {
    id: contact.id,
    businessId: contact.businessId,
    name: cleanText(contact.name || "", 300),
    phone: cleanText(contact.phone || "", 120),
    email: cleanText(contact.email || "", 500),
    status: cleanText(contact.status || "", 80)
  };
}

async function loadDb(context) {
  const db = await loadBusinessStore(context, DEFAULT_DB);
  db.version = Number(db.version || 1);
  db.businesses = Array.isArray(db.businesses) ? db.businesses : [];
  db.contacts = Array.isArray(db.contacts) ? db.contacts : [];
  db.messageTemplates = Array.isArray(db.messageTemplates) ? db.messageTemplates : [];
  db.auditLog = Array.isArray(db.auditLog) ? db.auditLog : [];
  return db;
}

async function saveDb(db, context, backupLabel) {
  await saveBusinessStore(db, context, backupLabel);
}

function requireBusiness(db, businessRef) {
  const business = db.businesses.find((item) => item.id === businessRef || item.slug === businessRef);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  return business;
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
  } catch {
    throw httpError(400, "Invalid JSON body");
  }
}

function extractTemplatePayload(payload) {
  if (!isPlainObject(payload)) {
    throw httpError(400, "JSON body must be an object");
  }

  return isPlainObject(payload.template) ? payload.template : payload;
}

function normalizeTemplateType(value) {
  const token = normalizeToken(value);
  const aliases = {
    envio_de_demo: "envio_demo",
    seguimiento_48_h: "seguimiento_48h",
    envio_de_propuesta: "envio_propuesta",
    reactivacion_de_lead_frio: "reactivacion_lead_frio",
    solicitud_de_resena: "solicitud_resena"
  };
  const normalized = aliases[token] || token;

  if (!MESSAGE_TEMPLATE_TYPE_SET.has(normalized)) {
    throw httpError(400, `Invalid message template type: ${normalized}`);
  }

  return normalized;
}

function defaultTypeFromId(templateId) {
  const value = String(templateId || "");

  if (!value.startsWith("default_")) {
    return "";
  }

  const type = value.slice("default_".length);
  return MESSAGE_TEMPLATE_TYPE_SET.has(type) ? type : "";
}

function createTemplateId(db) {
  let id = "";

  do {
    id = `msg_tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
  } while (db.messageTemplates.some((template) => template.id === id));

  return id;
}

function appendAudit(db, type, businessId, templateId, now) {
  db.auditLog.push({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    businessId,
    templateId,
    createdAt: now
  });
}

function safeUrl(value) {
  const url = String(value || "").trim().slice(0, 2000);

  if (!url) {
    return "";
  }

  if (url.startsWith("/")) {
    return url;
  }

  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : "";
  } catch {
    return "";
  }
}

function normalizeToken(value) {
  return cleanText(value, 80)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function cleanText(value, maxLength = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanBody(value, maxLength = 12000) {
  return String(value ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}

function cleanId(value) {
  return cleanText(value, 160).replace(/[^a-z0-9_-]/gi, "_").replace(/^_+|_+$/g, "");
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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
    Allow: "GET, POST, PUT, PATCH, DELETE, OPTIONS"
  });
  response.end();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export const MESSAGE_TEMPLATE_DEFAULTS = DEFAULT_MESSAGE_TEMPLATES;
