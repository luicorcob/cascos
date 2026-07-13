import { randomUUID } from "node:crypto";
import { corsHeaders } from "../lib/cors.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { applyAcceptedProposalAutomation } from "../lib/crm-automation.mjs";
import { recalculateContactScore } from "../lib/lead-score.mjs";
import { renderProposalHtml, renderProposalPdf } from "../lib/proposal-export.mjs";

const MAX_BODY_BYTES = Number(process.env.PROPOSAL_API_MAX_BODY_BYTES || 128 * 1024);
const PROPOSAL_PACKAGES = new Set(["presencia_local", "conversion_pro", "growth_local", "custom"]);
const PROPOSAL_STATUSES = new Set(["borrador", "enviada", "vista", "aceptada", "rechazada", "caducada"]);
const EXPIRABLE_STATUSES = new Set(["enviada", "vista"]);
const CREATE_FIELDS = new Set(["contactId", "package", "setupPrice", "monthlyPrice", "conditions", "expiresAt", "status"]);
const UPDATE_FIELDS = new Set(["package", "setupPrice", "monthlyPrice", "conditions", "expiresAt", "status"]);
const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  contacts: [],
  activities: [],
  proposals: [],
  auditLog: []
};

export function isProposalApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/proposals(?:\/[^/]+(?:\/export)?)?$/.test(pathname);
}

export async function handleProposalApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const segments = requestUrl.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    const businessRef = segments[2] || "";
    const proposalId = segments[4] || "";
    const action = segments[5] || "";

    if (!proposalId && method === "GET") {
      await listProposals(businessRef, requestUrl, response, context);
      return;
    }

    if (!proposalId && method === "POST") {
      await createProposal(businessRef, request, response, context);
      return;
    }

    if (proposalId && !action && method === "GET") {
      await getProposal(businessRef, proposalId, response, context);
      return;
    }

    if (proposalId && !action && method === "PATCH") {
      await updateProposal(businessRef, proposalId, request, response, context);
      return;
    }

    if (proposalId && !action && method === "DELETE") {
      await deleteProposal(businessRef, proposalId, response, context);
      return;
    }

    if (proposalId && action === "export" && method === "GET") {
      await exportProposal(businessRef, proposalId, requestUrl, response, context);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" }, context, {
      Allow: "GET, POST, PATCH, DELETE, OPTIONS"
    });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status >= 500 ? "Internal proposal API error" : error.message;
    sendJson(response, status, { error: message }, context);
  }
}

async function listProposals(businessRef, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const expirationActivities = expireBusinessProposals(db, business.id, new Date().toISOString());

  if (expirationActivities.length) {
    await saveDb(db, context, "proposal-expiration");
  }

  const requestedStatus = optionalEnum(requestUrl.searchParams.get("status"), PROPOSAL_STATUSES, "status");
  const requestedContactId = optionalId(requestUrl.searchParams.get("contactId"), "contactId");
  const proposals = db.proposals
    .filter((proposal) => proposal.businessId === business.id)
    .filter((proposal) => !requestedStatus || proposal.status === requestedStatus)
    .filter((proposal) => !requestedContactId || proposal.contactId === requestedContactId)
    .sort(compareProposals)
    .map(copyProposal);

  sendJson(response, 200, { proposals, total: proposals.length }, context);
}

async function createProposal(businessRef, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const source = extractProposalPayload(await readJsonBody(request));
  assertAllowedFields(source, CREATE_FIELDS);
  assertRequiredFields(source, ["contactId", "package", "setupPrice", "monthlyPrice", "conditions", "expiresAt"]);

  const now = new Date().toISOString();
  const contactId = requiredId(source.contactId, "contactId");
  const contact = requireContact(db, business.id, contactId);
  const proposal = {
    id: `proposal_${randomUUID()}`,
    businessId: business.id,
    contactId: contact.id,
    package: requiredEnum(source.package, PROPOSAL_PACKAGES, "package"),
    setupPrice: requiredMoney(source.setupPrice, "setupPrice"),
    monthlyPrice: requiredMoney(source.monthlyPrice, "monthlyPrice"),
    conditions: requiredConditions(source.conditions),
    expiresAt: requiredIsoDate(source.expiresAt, "expiresAt"),
    status: source.status === undefined ? "borrador" : requiredEnum(source.status, PROPOSAL_STATUSES, "status"),
    createdAt: now,
    updatedAt: now
  };

  applyAutomaticExpiration(proposal, now);
  db.proposals.push(proposal);
  const activities = [recordProposalActivity(db, proposal, "proposal.created", now, {
    title: "Propuesta creada",
    previousStatus: ""
  })];
  activities.push(...convertAcceptedProposalContact(db, business.id, proposal, now));
  appendAudit(db, "proposal.created", proposal, now);
  await saveDb(db, context, "proposal-create");
  sendJson(response, 201, { proposal: copyProposal(proposal), activities }, context);
}

async function getProposal(businessRef, proposalId, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const expirationActivities = expireBusinessProposals(db, business.id, new Date().toISOString());

  if (expirationActivities.length) {
    await saveDb(db, context, "proposal-expiration");
  }

  const proposal = requireProposal(db, business.id, proposalId);
  sendJson(response, 200, { proposal: copyProposal(proposal) }, context);
}

async function updateProposal(businessRef, proposalId, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const proposal = requireProposal(db, business.id, proposalId);
  const now = new Date().toISOString();
  const activities = [];
  const statusBeforeAutomaticExpiration = proposal.status;

  if (applyAutomaticExpiration(proposal, now)) {
    activities.push(recordProposalActivity(db, proposal, "proposal.expired", now, {
      title: "Propuesta caducada",
      previousStatus: statusBeforeAutomaticExpiration,
      automated: true
    }));
    appendAudit(db, "proposal.expired", proposal, now);
  }

  const source = extractProposalPayload(await readJsonBody(request));
  assertAllowedFields(source, UPDATE_FIELDS);
  if (!Object.keys(source).length) {
    throw httpError(400, "Proposal update needs at least one editable field");
  }

  const previousStatus = proposal.status;
  if (Object.prototype.hasOwnProperty.call(source, "package")) {
    proposal.package = requiredEnum(source.package, PROPOSAL_PACKAGES, "package");
  }
  if (Object.prototype.hasOwnProperty.call(source, "setupPrice")) {
    proposal.setupPrice = requiredMoney(source.setupPrice, "setupPrice");
  }
  if (Object.prototype.hasOwnProperty.call(source, "monthlyPrice")) {
    proposal.monthlyPrice = requiredMoney(source.monthlyPrice, "monthlyPrice");
  }
  if (Object.prototype.hasOwnProperty.call(source, "conditions")) {
    proposal.conditions = requiredConditions(source.conditions);
  }
  if (Object.prototype.hasOwnProperty.call(source, "expiresAt")) {
    proposal.expiresAt = requiredIsoDate(source.expiresAt, "expiresAt");
  }
  if (Object.prototype.hasOwnProperty.call(source, "status")) {
    proposal.status = requiredEnum(source.status, PROPOSAL_STATUSES, "status");
  }
  proposal.updatedAt = now;
  applyAutomaticExpiration(proposal, now);

  const statusChanged = proposal.status !== previousStatus;
  activities.push(recordProposalActivity(db, proposal, statusChanged ? "proposal.status_changed" : "proposal.updated", now, {
    title: statusChanged ? "Estado de propuesta actualizado" : "Propuesta actualizada",
    previousStatus
  }));
  activities.push(...convertAcceptedProposalContact(db, business.id, proposal, now));
  appendAudit(db, "proposal.updated", proposal, now);
  await saveDb(db, context, "proposal-update");
  sendJson(response, 200, { proposal: copyProposal(proposal), activities }, context);
}

async function deleteProposal(businessRef, proposalId, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const index = db.proposals.findIndex((proposal) => proposal.businessId === business.id && proposal.id === proposalId);

  if (index === -1) {
    throw httpError(404, "Proposal not found");
  }

  const [proposal] = db.proposals.splice(index, 1);
  const now = new Date().toISOString();
  const activity = recordProposalActivity(db, proposal, "proposal.deleted", now, {
    title: "Propuesta eliminada",
    previousStatus: proposal.status
  });
  appendAudit(db, "proposal.deleted", proposal, now);
  await saveDb(db, context, "proposal-delete");
  sendJson(response, 200, { proposal: copyProposal(proposal), deleted: true, activities: [activity] }, context);
}

async function exportProposal(businessRef, proposalId, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const expirationActivities = expireBusinessProposals(db, business.id, new Date().toISOString());

  if (expirationActivities.length) {
    await saveDb(db, context, "proposal-expiration");
  }

  const proposal = requireProposal(db, business.id, proposalId);
  const contact = requireContact(db, business.id, proposal.contactId, { allowMerged: true });
  const format = String(requestUrl.searchParams.get("format") || "html").trim().toLowerCase();

  if (!new Set(["html", "pdf"]).has(format)) {
    throw httpError(400, "format must be html or pdf");
  }

  const input = { proposal: copyProposal(proposal), business, contact };
  if (format === "pdf") {
    const pdf = renderProposalPdf(input);
    sendDocument(response, 200, pdf, "application/pdf", `${proposal.id}.pdf`, context, "attachment");
    return;
  }

  const html = Buffer.from(renderProposalHtml(input), "utf8");
  sendDocument(response, 200, html, "text/html; charset=utf-8", `${proposal.id}.html`, context, "inline");
}

function expireBusinessProposals(db, businessId, now) {
  const activities = [];

  db.proposals
    .filter((proposal) => proposal.businessId === businessId)
    .forEach((proposal) => {
      const previousStatus = proposal.status;
      if (!applyAutomaticExpiration(proposal, now)) {
        return;
      }

      activities.push(recordProposalActivity(db, proposal, "proposal.expired", now, {
        title: "Propuesta caducada",
        previousStatus,
        automated: true
      }));
      appendAudit(db, "proposal.expired", proposal, now);
    });

  return activities;
}

function applyAutomaticExpiration(proposal, now) {
  if (!EXPIRABLE_STATUSES.has(proposal.status)) {
    return false;
  }

  const expiresAt = Date.parse(proposal.expiresAt || "");
  const reference = Date.parse(now || "");
  if (!Number.isFinite(expiresAt) || !Number.isFinite(reference) || expiresAt > reference) {
    return false;
  }

  proposal.status = "caducada";
  proposal.updatedAt = now;
  return true;
}

function recordProposalActivity(db, proposal, type, now, options = {}) {
  const activity = {
    id: `activity_${randomUUID()}`,
    businessId: proposal.businessId,
    contactId: proposal.contactId,
    type,
    title: options.title || "Propuesta actualizada",
    note: proposalActivityNote(proposal, options.previousStatus),
    source: options.automated ? "crm-automation" : "crm-proposals",
    metadata: {
      proposalId: proposal.id,
      package: proposal.package,
      status: proposal.status,
      previousStatus: options.previousStatus || "",
      automated: Boolean(options.automated)
    },
    createdAt: now
  };
  db.activities.push(activity);

  const contact = db.contacts.find((item) => item.businessId === proposal.businessId && item.id === proposal.contactId);
  if (contact) {
    if (!options.automated) {
      contact.lastInteractionAt = now;
      contact.updatedAt = now;
    }
    recalculateContactScore(db, proposal.businessId, contact, new Date(now));
  }
  return activity;
}

function convertAcceptedProposalContact(db, businessId, proposal, now) {
  const result = applyAcceptedProposalAutomation(db, proposal, { now });

  if (!result.applied || !result.activity) {
    return [];
  }

  appendAudit(db, "contact.converted_from_proposal", proposal, now, result.contactId);
  return [result.activity];
}

function proposalActivityNote(proposal, previousStatus) {
  const transition = previousStatus && previousStatus !== proposal.status
    ? ` Estado: ${previousStatus} -> ${proposal.status}.`
    : ` Estado: ${proposal.status}.`;
  return `Propuesta ${proposal.id}.${transition} Paquete: ${proposal.package}. Setup: ${proposal.setupPrice}. Mensual: ${proposal.monthlyPrice}.`;
}

async function loadDb(context) {
  const db = await loadBusinessStore(context, DEFAULT_DB);
  db.version = Number(db.version || 1);
  db.businesses = Array.isArray(db.businesses) ? db.businesses : [];
  db.contacts = Array.isArray(db.contacts) ? db.contacts : [];
  db.activities = Array.isArray(db.activities) ? db.activities : [];
  db.proposals = Array.isArray(db.proposals) ? db.proposals : [];
  db.auditLog = Array.isArray(db.auditLog) ? db.auditLog : [];
  return db;
}

async function saveDb(db, context, label) {
  await saveBusinessStore(db, context, label);
}

function requireBusiness(db, businessRef) {
  const business = db.businesses.find((item) => item.id === businessRef || item.slug === businessRef);
  if (!business) {
    throw httpError(404, "Business not found");
  }
  return business;
}

function requireContact(db, businessId, contactId, options = {}) {
  const contact = db.contacts.find((item) => item.businessId === businessId && item.id === contactId);
  if (!contact) {
    throw httpError(404, "Contact not found");
  }
  if (contact.merged && !options.allowMerged) {
    throw httpError(409, "Contact has been merged into another contact");
  }
  return contact;
}

function requireProposal(db, businessId, proposalId) {
  const cleanProposalId = requiredId(proposalId, "proposalId");
  const proposal = db.proposals.find((item) => item.businessId === businessId && item.id === cleanProposalId);
  if (!proposal) {
    throw httpError(404, "Proposal not found");
  }
  return proposal;
}

function extractProposalPayload(payload) {
  if (!isPlainObject(payload)) {
    throw httpError(400, "JSON body must be an object");
  }

  if (Object.prototype.hasOwnProperty.call(payload, "proposal")) {
    if (Object.keys(payload).length !== 1 || !isPlainObject(payload.proposal)) {
      throw httpError(400, "proposal wrapper must be the only top-level field and contain an object");
    }
    return payload.proposal;
  }
  return payload;
}

function assertAllowedFields(source, allowed) {
  const unknown = Object.keys(source).filter((field) => !allowed.has(field));
  if (unknown.length) {
    throw httpError(400, `Unknown proposal field(s): ${unknown.join(", ")}`);
  }
}

function assertRequiredFields(source, fields) {
  const missing = fields.filter((field) => !Object.prototype.hasOwnProperty.call(source, field));
  if (missing.length) {
    throw httpError(400, `Missing proposal field(s): ${missing.join(", ")}`);
  }
}

async function readJsonBody(request) {
  let size = 0;
  let raw = "";

  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw httpError(413, "Proposal payload too large");
    }
    raw += chunk.toString("utf8");
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

function requiredEnum(value, allowed, field) {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw httpError(400, `${field} has an invalid value`);
  }
  return value;
}

function optionalEnum(value, allowed, field) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return requiredEnum(value, allowed, field);
}

function requiredMoney(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100000000) {
    throw httpError(400, `${field} must be a non-negative number no greater than 100000000`);
  }
  if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) {
    throw httpError(400, `${field} must have at most two decimal places`);
  }
  return value;
}

function requiredConditions(value) {
  if (typeof value !== "string") {
    throw httpError(400, "conditions must be a string");
  }

  const normalized = value
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  if (!normalized) {
    throw httpError(400, "conditions cannot be empty");
  }
  if (normalized.length > 20000) {
    throw httpError(400, "conditions cannot exceed 20000 characters");
  }
  return normalized;
}

function requiredIsoDate(value, field) {
  if (typeof value !== "string" || value.length > 80) {
    throw httpError(400, `${field} must be an ISO date-time string`);
  }

  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;
  const timestamp = Date.parse(value);
  if (!isoPattern.test(value) || !Number.isFinite(timestamp)) {
    throw httpError(400, `${field} must be a valid ISO date-time with timezone`);
  }
  return new Date(timestamp).toISOString();
}

function requiredId(value, field) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(value)) {
    throw httpError(400, `${field} has an invalid format`);
  }
  return value;
}

function optionalId(value, field) {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return requiredId(value, field);
}

function compareProposals(left, right) {
  const updated = Date.parse(right.updatedAt || right.createdAt || "") - Date.parse(left.updatedAt || left.createdAt || "");
  if (Number.isFinite(updated) && updated !== 0) {
    return updated;
  }
  return String(left.id || "").localeCompare(String(right.id || ""));
}

function copyProposal(proposal) {
  return {
    id: proposal.id,
    businessId: proposal.businessId,
    contactId: proposal.contactId,
    package: proposal.package,
    setupPrice: proposal.setupPrice,
    monthlyPrice: proposal.monthlyPrice,
    conditions: proposal.conditions,
    expiresAt: proposal.expiresAt,
    status: proposal.status,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt
  };
}

function appendAudit(db, type, proposal, now, contactId = proposal.contactId) {
  db.auditLog.push({
    id: `audit_${randomUUID()}`,
    type,
    businessId: proposal.businessId,
    contactId,
    proposalId: proposal.id,
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

function sendDocument(response, status, body, contentType, filename, context, disposition) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    "Content-Type": contentType,
    "Content-Length": String(body.length),
    "Content-Disposition": `${disposition}; filename="${filename}"`
  });
  response.end(body);
}

function sendEmpty(response, status, context) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    Allow: "GET, POST, PATCH, DELETE, OPTIONS"
  });
  response.end();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
