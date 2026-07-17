import { randomUUID } from "node:crypto";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import {
  CONSENT_ACTIONS,
  CONSENT_BASES,
  CONSENT_CHANNELS,
  CONSENT_PURPOSES,
  appendConsentEvent,
  consentStateForContact,
  evaluateConsentState
} from "../lib/consent-model.mjs";
import { corsHeaders } from "../lib/cors.mjs";

const MAX_BODY_BYTES = Number(process.env.CONSENT_API_MAX_BODY_BYTES || 256 * 1024);
const CHANNELS = new Set(CONSENT_CHANNELS);
const PURPOSES = new Set(CONSENT_PURPOSES);
const ACTIONS = new Set(CONSENT_ACTIONS);
const BASES = new Set(CONSENT_BASES);
const EVENT_FIELDS = new Set(["channel", "purpose", "action", "lawfulBasis", "source", "textVersion", "textSnapshot", "policyUrl", "actorType", "actorId", "evidence", "occurredAt"]);
const PREFERENCE_FIELDS = new Set(["globalSuppressed", "preferences", "source", "textVersion", "textSnapshot", "policyUrl", "actorType", "actorId", "evidence", "occurredAt"]);
const DEFAULT_DB = { version: 1, updatedAt: null, businesses: [], contacts: [], consentEvents: [], auditLog: [] };

export function isConsentApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/(?:contacts\/[^/]+\/(?:consents|preferences)|consent\/eligibility)$/.test(pathname);
}

export async function handleConsentApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://dls.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context);
  try {
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const businessRef = segments[2] || "";
    if (segments[3] === "consent" && segments[4] === "eligibility" && method === "POST") return await checkEligibility(businessRef, request, response, context);
    const contactId = segments[4] || "";
    const resource = segments[5] || "";
    if (resource === "consents" && method === "GET") return await getConsentLedger(businessRef, contactId, response, context);
    if (resource === "consents" && method === "POST") return await createConsentEvent(businessRef, contactId, request, response, context);
    if (resource === "preferences" && method === "GET") return await getPreferences(businessRef, contactId, response, context);
    if (resource === "preferences" && method === "PUT") return await updatePreferences(businessRef, contactId, request, response, context);
    throw httpError(405, "Method not allowed");
  } catch (error) {
    sendJson(response, error.statusCode || 500, { error: (error.statusCode || 500) >= 500 ? "Internal consent API error" : error.message, code: error.code || "consent_error" }, context);
  }
}

async function getConsentLedger(businessRef, contactId, response, context) {
  const { db, business, contact } = await loadContext(businessRef, contactId, context);
  sendJson(response, 200, { contact: summarizeContact(contact), ...consentStateForContact(db, business.id, contact.id) }, context);
}

async function getPreferences(businessRef, contactId, response, context) {
  const { db, business, contact } = await loadContext(businessRef, contactId, context);
  const state = consentStateForContact(db, business.id, contact.id);
  sendJson(response, 200, { contact: summarizeContact(contact), globalSuppressed: state.globalSuppressed, preferences: state.preferences, lastNotice: state.lastNotice, eventCount: state.total }, context);
}

async function createConsentEvent(businessRef, contactId, request, response, context) {
  const { db, business, contact } = await loadContext(businessRef, contactId, context);
  const source = requireObject(await readJsonBody(request));
  assertAllowedFields(source, EVENT_FIELDS, "consent event");
  const action = requiredEnum(source.action, ACTIONS, "action");
  const channel = requiredEnum(source.channel, CHANNELS, "channel");
  const purpose = requiredEnum(source.purpose, PURPOSES, "purpose");
  if (["suppressed", "unsuppressed"].includes(action) && (channel === "any") !== (purpose === "any")) throw httpError(400, "Global suppression must use channel any and purpose any");
  const event = buildEventInput(business.id, contact.id, source, { action, channel, purpose });
  const result = appendConsentEvent(db, event);
  appendAudit(db, "consent.event_appended", business.id, event.occurredAt, { contactId: contact.id, consentEventId: result.event.id, action, channel, purpose });
  await saveBusinessStore(db, context, "consent-event");
  sendJson(response, 201, { event: result.event, state: consentStateForContact(db, business.id, contact.id) }, context);
}

async function updatePreferences(businessRef, contactId, request, response, context) {
  const { db, business, contact } = await loadContext(businessRef, contactId, context);
  const source = requireObject(await readJsonBody(request));
  assertAllowedFields(source, PREFERENCE_FIELDS, "preferences");
  if (!Array.isArray(source.preferences) && typeof source.globalSuppressed !== "boolean") throw httpError(400, "Preferences update needs globalSuppressed or preferences");
  const before = consentStateForContact(db, business.id, contact.id);
  const created = [];
  if (typeof source.globalSuppressed === "boolean" && source.globalSuppressed !== before.globalSuppressed) {
    created.push(appendConsentEvent(db, buildEventInput(business.id, contact.id, source, {
      action: source.globalSuppressed ? "suppressed" : "unsuppressed", channel: "any", purpose: "any"
    })).event);
  }
  if (source.preferences !== undefined) {
    if (!Array.isArray(source.preferences) || source.preferences.length > 40) throw httpError(400, "preferences must be an array with at most 40 entries");
    for (const preference of source.preferences) {
      const item = requireObject(preference);
      const channel = requiredEnum(item.channel, new Set(CONSENT_CHANNELS.filter((value) => value !== "any")), "preference.channel");
      const purpose = requiredEnum(item.purpose, new Set(CONSENT_PURPOSES.filter((value) => !["any", "service"].includes(value))), "preference.purpose");
      if (typeof item.allowed !== "boolean") throw httpError(400, "preference.allowed must be boolean");
      const effective = evaluateConsentState(before, channel, purpose);
      if (effective.allowed === item.allowed && !effective.suppressed) continue;
      created.push(appendConsentEvent(db, buildEventInput(business.id, contact.id, source, {
        action: item.allowed ? "granted" : "withdrawn", channel, purpose, lawfulBasis: "consent"
      })).event);
    }
  }
  const now = new Date().toISOString();
  created.forEach((event) => appendAudit(db, "consent.preference_changed", business.id, event.occurredAt, { contactId: contact.id, consentEventId: event.id, action: event.action, channel: event.channel, purpose: event.purpose }));
  if (created.length) await saveBusinessStore(db, context, "consent-preferences");
  sendJson(response, 200, { changed: created.length, events: created, state: consentStateForContact(db, business.id, contact.id), updatedAt: now }, context);
}

async function checkEligibility(businessRef, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const source = requireObject(await readJsonBody(request));
  assertAllowedFields(source, new Set(["contactIds", "channel", "purpose"]), "eligibility");
  if (!Array.isArray(source.contactIds) || !source.contactIds.length || source.contactIds.length > 1000) throw httpError(400, "contactIds must contain between 1 and 1000 ids");
  const contactIds = [...new Set(source.contactIds.map((id) => requiredId(id, "contactId")))];
  const channel = requiredEnum(source.channel, new Set(CONSENT_CHANNELS.filter((value) => value !== "any")), "channel");
  const purpose = requiredEnum(source.purpose, new Set(CONSENT_PURPOSES.filter((value) => value !== "any")), "purpose");
  const results = contactIds.map((contactId) => {
    const contact = requireContact(db, business.id, contactId);
    const consent = evaluateConsentState(consentStateForContact(db, business.id, contact.id), channel, purpose);
    return { contact: summarizeContact(contact), allowed: consent.allowed && !consent.suppressed, reason: consent.reason, eventId: consent.eventId };
  });
  sendJson(response, 200, { channel, purpose, eligible: results.filter((item) => item.allowed), blocked: results.filter((item) => !item.allowed), total: results.length }, context);
}

function buildEventInput(businessId, contactId, source, fixed) {
  const action = fixed.action;
  return {
    businessId, contactId,
    channel: fixed.channel,
    purpose: fixed.purpose,
    action,
    lawfulBasis: fixed.lawfulBasis || optionalEnum(source.lawfulBasis, BASES, "lawfulBasis") || (action === "acknowledged" ? "contract" : "consent"),
    source: optionalText(source.source, "source", 120) || "preference-center",
    textVersion: optionalText(source.textVersion, "textVersion", 160),
    textSnapshot: optionalText(source.textSnapshot, "textSnapshot", 10000),
    policyUrl: optionalText(source.policyUrl, "policyUrl", 2000),
    actorType: optionalText(source.actorType, "actorType", 80) || "contact",
    actorId: optionalText(source.actorId, "actorId", 180) || contactId,
    evidence: source.evidence && typeof source.evidence === "object" && !Array.isArray(source.evidence) ? source.evidence : {},
    occurredAt: optionalIso(source.occurredAt, "occurredAt") || new Date().toISOString()
  };
}

async function loadContext(businessRef, contactId, context) { const db = await loadDb(context); const business = requireBusiness(db, businessRef); const contact = requireContact(db, business.id, requiredId(contactId, "contactId")); return { db, business, contact }; }
async function loadDb(context) { const db = await loadBusinessStore(context, DEFAULT_DB); Object.keys(DEFAULT_DB).forEach((key) => { if (Array.isArray(DEFAULT_DB[key])) db[key] = Array.isArray(db[key]) ? db[key] : []; }); return db; }
function requireBusiness(db, ref) { const business = db.businesses.find((item) => item.id === ref || item.slug === ref); if (!business) throw httpError(404, "Business not found"); return business; }
function requireContact(db, businessId, id) { const contact = db.contacts.find((item) => item.businessId === businessId && item.id === id && !item.merged); if (!contact) throw httpError(404, "Contact not found"); return contact; }
function summarizeContact(contact) { return { id: contact.id, name: contact.name || "", email: contact.email || "", phone: contact.phone || "" }; }
function assertAllowedFields(source, allowed, resource) { const unknown = Object.keys(source).filter((field) => !allowed.has(field)); if (unknown.length) throw httpError(400, `Unknown ${resource} field(s): ${unknown.join(", ")}`); }
function requiredEnum(value, allowed, field) { const normalized = clean(value); if (!allowed.has(normalized)) throw httpError(400, `${field} has an invalid value`); return normalized; }
function optionalEnum(value, allowed, field) { return value === undefined || value === null || value === "" ? "" : requiredEnum(value, allowed, field); }
function requiredId(value, field) { if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,180}$/.test(value)) throw httpError(400, `${field} has an invalid format`); return value; }
function optionalText(value, field, max) { if (value === undefined || value === null || value === "") return ""; if (typeof value !== "string") throw httpError(400, `${field} must be text`); const result = value.trim(); if (result.length > max) throw httpError(400, `${field} cannot exceed ${max} characters`); return result; }
function optionalIso(value, field) { if (value === undefined || value === null || value === "") return ""; const date = new Date(value); if (typeof value !== "string" || Number.isNaN(date.getTime())) throw httpError(400, `${field} must be an ISO date`); return date.toISOString(); }
function requireObject(value) { if (!value || typeof value !== "object" || Array.isArray(value)) throw httpError(400, "JSON body must be an object"); return value; }
function appendAudit(db, type, businessId, createdAt, extra = {}) { db.auditLog.push({ id: `audit_${randomUUID()}`, type, businessId, ...extra, createdAt }); }
function clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
function httpError(statusCode, message, code = "consent_error") { return Object.assign(new Error(message), { statusCode, code }); }
async function readJsonBody(request) { let raw = ""; let size = 0; for await (const chunk of request) { size += chunk.length; if (size > MAX_BODY_BYTES) throw httpError(413, "Consent payload too large"); raw += chunk.toString("utf8"); } if (!raw.trim()) throw httpError(400, "JSON body is required"); try { return JSON.parse(raw); } catch { throw httpError(400, "Invalid JSON body"); } }
function sendJson(response, statusCode, payload, context) { response.writeHead(statusCode, { ...corsHeaders(context.requestOrigin, context), "Content-Type": "application/json; charset=utf-8" }); response.end(JSON.stringify(payload)); }
function sendEmpty(response, statusCode, context) { response.writeHead(statusCode, corsHeaders(context.requestOrigin, context)); response.end(); }
