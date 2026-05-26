import { readFile } from "node:fs/promises";
import path from "node:path";
import { corsHeaders } from "../lib/cors.mjs";
import { backupJsonStore, cloneJson, readJsonStore, writeJsonStore } from "../lib/json-store.mjs";

const MAX_BODY_BYTES = Number(process.env.BUSINESS_API_MAX_BODY_BYTES || 1024 * 1024);
const STATUSES = new Set(["lead", "onboarding", "in-design", "in-review", "published", "maintenance", "paused", "archived"]);
const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  auditLog: []
};

export function isBusinessApiRequest(pathname) {
  return pathname === "/api/businesses" || pathname.startsWith("/api/businesses/");
}

export async function handleBusinessApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const segments = requestUrl.pathname.split("/").filter(Boolean);
  const id = segments[2] ? decodeURIComponent(segments[2]) : "";
  const action = segments[3] ? decodeURIComponent(segments[3]) : "";
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    if (segments.length === 2 && method === "GET") {
      await listBusinesses(requestUrl, response, context);
      return;
    }

    if (segments.length === 2 && method === "POST") {
      await createBusiness(request, response, context);
      return;
    }

    if (segments.length === 3 && method === "GET") {
      await getBusiness(id, response, context);
      return;
    }

    if (segments.length === 3 && method === "PUT") {
      await updateBusiness(id, request, response, context);
      return;
    }

    if (segments.length === 4 && action === "archive" && method === "DELETE") {
      await archiveBusiness(id, response, context);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "GET, POST, PUT, DELETE, OPTIONS" });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status >= 500 ? "Internal business API error" : error.message;
    sendJson(response, status, { error: message }, context);
  }
}

async function listBusinesses(requestUrl, response, context) {
  const db = await loadBusinessDb(context);
  const includeArchived = requestUrl.searchParams.get("includeArchived") === "true";
  const q = cleanText(requestUrl.searchParams.get("q") || "").toLowerCase();
  const status = cleanText(requestUrl.searchParams.get("status") || "");
  const category = cleanText(requestUrl.searchParams.get("category") || requestUrl.searchParams.get("sector") || "").toLowerCase();
  const plan = cleanText(requestUrl.searchParams.get("plan") || "").toLowerCase();

  const businesses = db.businesses
    .filter((business) => includeArchived || business.status !== "archived")
    .filter((business) => !status || business.status === status)
    .filter((business) => !category || business.category.toLowerCase().includes(category))
    .filter((business) => !plan || business.plan.toLowerCase() === plan)
    .filter((business) => {
      if (!q) {
        return true;
      }

      return [business.name, business.slug, business.category, business.city, business.ownerName, business.ownerEmail]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(q));
    })
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
    .map(toBusinessSummary);

  sendJson(response, 200, { businesses, total: businesses.length }, context);
}

async function createBusiness(request, response, context) {
  const db = await loadBusinessDb(context);
  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const business = normalizeBusiness(payload, null, db, now);

  if (db.businesses.some((item) => item.id === business.id)) {
    throw httpError(409, "Business id already exists");
  }

  db.businesses.push(business);
  appendAudit(db, "business.created", business.id, now);
  await saveBusinessDb(db, context, "create");
  sendJson(response, 201, { business }, context);
}

async function getBusiness(id, response, context) {
  const db = await loadBusinessDb(context);
  const business = findBusiness(db, id);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  sendJson(response, 200, { business }, context);
}

async function updateBusiness(id, request, response, context) {
  const db = await loadBusinessDb(context);
  const index = db.businesses.findIndex((business) => matchesBusinessId(business, id));

  if (index === -1) {
    throw httpError(404, "Business not found");
  }

  const payload = await readJsonBody(request);
  const now = new Date().toISOString();
  const business = normalizeBusiness(payload, db.businesses[index], db, now);

  db.businesses[index] = business;
  appendAudit(db, "business.updated", business.id, now);
  await saveBusinessDb(db, context, "update");
  sendJson(response, 200, { business }, context);
}

async function archiveBusiness(id, response, context) {
  const db = await loadBusinessDb(context);
  const business = findBusiness(db, id);

  if (!business) {
    throw httpError(404, "Business not found");
  }

  const now = new Date().toISOString();
  business.status = "archived";
  business.archivedAt = now;
  business.updatedAt = now;
  appendAudit(db, "business.archived", business.id, now);
  await saveBusinessDb(db, context, "archive");
  sendJson(response, 200, { business }, context);
}

async function loadBusinessDb(context) {
  const dbPath = getDbPath(context.root);
  const fallback = await loadFallbackDb(context.root);
  const db = await readJsonStore(dbPath, fallback);

  db.version = Number(db.version || 1);
  db.businesses = Array.isArray(db.businesses) ? db.businesses : [];
  db.auditLog = Array.isArray(db.auditLog) ? db.auditLog : [];
  return db;
}

async function saveBusinessDb(db, context, backupLabel) {
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

function normalizeBusiness(payload, existing, db, now) {
  const source = extractBusinessPayload(payload);
  const name = cleanText(source.name || source.businessName || source.title || existing?.name || "");

  if (!name) {
    throw httpError(400, "Business name is required");
  }

  const id = existing?.id || cleanId(source.id) || createBusinessId(name, now);
  const requestedSlug = cleanSlug(source.slug || source.handle || "");
  const baseSlug = requestedSlug || slugify(`${name}-${source.city || source.location || existing?.city || ""}`) || id;
  const slug = ensureUniqueSlug(baseSlug, db, id);
  const status = normalizeStatus(source.status || existing?.status || "lead");
  const content = normalizeContent(source, existing);
  const owner = isPlainObject(source.owner) ? source.owner : {};

  return {
    id,
    slug,
    name,
    category: cleanText(source.category || source.sector || existing?.category || "General"),
    city: cleanText(source.city || source.location || existing?.city || ""),
    ownerName: cleanText(source.ownerName || owner.name || existing?.ownerName || ""),
    ownerEmail: cleanText(source.ownerEmail || owner.email || existing?.ownerEmail || ""),
    ownerPhone: cleanText(source.ownerPhone || owner.phone || source.phone || existing?.ownerPhone || ""),
    plan: cleanText(source.plan || existing?.plan || "presencia-local"),
    status,
    publishedUrl: cleanText(source.publishedUrl || existing?.publishedUrl || ""),
    brand: mergePlainObjects(existing?.brand, source.brand),
    integrations: mergePlainObjects(existing?.integrations, source.integrations),
    settings: mergePlainObjects(existing?.settings, source.settings),
    content,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    archivedAt: status === "archived" ? existing?.archivedAt || now : ""
  };
}

function normalizeContent(source, existing) {
  if (isPlainObject(source.content)) {
    return mergePlainObjects(existing?.content, source.content);
  }

  if (isPlainObject(source.website)) {
    return mergePlainObjects(existing?.content, source.website);
  }

  const content = { ...source };
  ["id", "slug", "handle", "owner", "ownerName", "ownerEmail", "ownerPhone", "plan", "status", "publishedUrl", "brand", "integrations", "settings"].forEach((key) => {
    delete content[key];
  });

  return mergePlainObjects(existing?.content, content);
}

function extractBusinessPayload(payload) {
  if (!isPlainObject(payload)) {
    throw httpError(400, "JSON body must be an object");
  }

  if (isPlainObject(payload.business)) {
    return payload.business;
  }

  return payload;
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
  return db.businesses.find((business) => matchesBusinessId(business, id));
}

function matchesBusinessId(business, id) {
  return business.id === id || business.slug === id;
}

function toBusinessSummary(business) {
  return {
    id: business.id,
    slug: business.slug,
    name: business.name,
    category: business.category,
    city: business.city,
    ownerName: business.ownerName,
    ownerEmail: business.ownerEmail,
    ownerPhone: business.ownerPhone,
    plan: business.plan,
    status: business.status,
    publishedUrl: business.publishedUrl,
    updatedAt: business.updatedAt,
    createdAt: business.createdAt,
    archivedAt: business.archivedAt || ""
  };
}

function appendAudit(db, type, businessId, now) {
  db.auditLog.push({
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    businessId,
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
    Allow: "GET, POST, PUT, DELETE, OPTIONS"
  });
  response.end();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeStatus(value) {
  const status = cleanText(value);

  if (!STATUSES.has(status)) {
    throw httpError(400, `Invalid business status: ${status}`);
  }

  return status;
}

function cleanText(value, maxLength = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function cleanId(value) {
  return cleanText(value, 80).replace(/[^a-z0-9_-]/gi, "_").replace(/^_+|_+$/g, "");
}

function createBusinessId(name, now) {
  return `biz_${slugify(name) || "business"}_${Date.parse(now).toString(36)}`;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cleanSlug(value) {
  return slugify(value);
}

function ensureUniqueSlug(baseSlug, db, id) {
  let slug = baseSlug;
  let counter = 2;

  while (db.businesses.some((business) => business.id !== id && business.slug === slug)) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
}

function mergePlainObjects(current, next) {
  return {
    ...(isPlainObject(current) ? current : {}),
    ...(isPlainObject(next) ? next : {})
  };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
