import { readFile } from "node:fs/promises";
import path from "node:path";
import { corsHeaders } from "../lib/cors.mjs";
import { backupJsonStore, cloneJson, readJsonStore, writeJsonStore } from "../lib/json-store.mjs";

const MAX_BODY_BYTES = Number(process.env.EVENT_API_MAX_BODY_BYTES || 256 * 1024);
const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  businessEvents: [],
  auditLog: []
};

export function isEventApiRequest(pathname) {
  return /^\/api\/public\/[^/]+\/events$/.test(pathname)
    || /^\/api\/businesses\/[^/]+\/events$/.test(pathname);
}

export async function handleEventApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const segments = requestUrl.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    if (segments[0] === "api" && segments[1] === "public" && segments[3] === "events" && method === "POST") {
      await createPublicEvent(segments[2], request, response, context);
      return;
    }

    if (segments[0] === "api" && segments[1] === "businesses" && segments[3] === "events" && method === "GET") {
      await listBusinessEvents(segments[2], requestUrl, response, context);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "GET, POST, OPTIONS" });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status >= 500 ? "Internal event API error" : error.message;
    sendJson(response, status, { error: message }, context);
  }
}

async function createPublicEvent(slug, request, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, slug);

  if (!business || business.status === "archived") {
    throw httpError(404, "Business not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const events = extractEvents(payload)
    .map((item) => normalizeEvent(item, business.id, now))
    .filter(Boolean);

  db.businessEvents.push(...events);
  appendAudit(db, "business_events.created", business.id, now, String(events.length));
  await saveDb(db, context, "business-events");
  sendJson(response, 201, { events, total: events.length }, context);
}

async function listBusinessEvents(businessId, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = findBusiness(db, businessId);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const from = parseOptionalDate(requestUrl.searchParams.get("from") || "");
  const to = parseOptionalDate(requestUrl.searchParams.get("to") || "");
  const events = db.businessEvents
    .filter((event) => event.businessId === business.id)
    .filter((event) => !from || new Date(event.createdAt) >= from)
    .filter((event) => !to || new Date(event.createdAt) <= to)
    .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

  sendJson(response, 200, { events, total: events.length }, context);
}

function extractEvents(payload) {
  if (!isPlainObject(payload)) {
    throw httpError(400, "JSON body must be an object");
  }

  if (Array.isArray(payload.events)) {
    return payload.events;
  }

  if (isPlainObject(payload.event)) {
    return [payload.event];
  }

  return [payload];
}

function normalizeEvent(source, businessId, now) {
  if (!isPlainObject(source)) {
    return null;
  }

  const name = cleanEventName(source.name || source.type || source.event || "");

  if (!name) {
    return null;
  }

  return {
    id: cleanId(source.id) || `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    businessId,
    name,
    type: name,
    detail: isPlainObject(source.detail) ? sanitizeDetail(source.detail) : {},
    page: cleanText(source.page || source.path || source.url || "", 500),
    referrer: cleanText(source.referrer || "", 500),
    userAgent: cleanText(source.userAgent || "", 500),
    createdAt: parseOptionalDate(source.timestamp || source.createdAt || "")?.toISOString() || now
  };
}

function sanitizeDetail(detail) {
  return Object.fromEntries(
    Object.entries(detail)
      .slice(0, 30)
      .map(([key, value]) => [cleanText(key, 80), cleanText(value, 500)])
      .filter(([key]) => key)
  );
}

async function loadDb(context) {
  const dbPath = getDbPath(context.root);
  const fallback = await loadFallbackDb(context.root);
  const db = await readJsonStore(dbPath, fallback);

  db.version = Number(db.version || 1);
  db.businesses = Array.isArray(db.businesses) ? db.businesses : [];
  db.businessEvents = Array.isArray(db.businessEvents) ? db.businessEvents : [];
  db.auditLog = Array.isArray(db.auditLog) ? db.auditLog : [];
  return db;
}

async function saveDb(db, context, backupLabel) {
  const dbPath = getDbPath(context.root);
  db.updatedAt = new Date().toISOString();

  if (process.env.BUSINESS_DB_BACKUPS !== "false") {
    await backupJsonStore(dbPath, getBackupDir(context.root), backupLabel);
  }

  await writeJsonStore(dbPath, db);
}

async function loadFallbackDb(root) {
  const examplePath = path.join(root, "data", "business-db.example.json");

  try {
    const raw = await readFile(examplePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }

    return cloneJson(DEFAULT_DB);
  }
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

function parseOptionalDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function appendAudit(db, type, businessId, now, subjectId) {
  db.auditLog.push({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    businessId,
    subjectId,
    createdAt: now
  });
}

function getDbPath(root) {
  return process.env.BUSINESS_DB_FILE
    ? path.resolve(root, process.env.BUSINESS_DB_FILE)
    : path.join(root, "data", "business-db.json");
}

function getBackupDir(root) {
  return process.env.BUSINESS_DB_BACKUP_DIR
    ? path.resolve(root, process.env.BUSINESS_DB_BACKUP_DIR)
    : path.join(root, "data", "backups");
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
    Allow: "GET, POST, OPTIONS"
  });
  response.end();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function cleanEventName(value) {
  return cleanText(value, 120).toLowerCase().replace(/[^a-z0-9_.:-]+/g, "_").replace(/^_+|_+$/g, "");
}

function cleanText(value, maxLength = 500) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanId(value) {
  return cleanText(value, 80).replace(/[^a-z0-9_-]/gi, "_").replace(/^_+|_+$/g, "");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
