import { randomUUID } from "node:crypto";
import { corsHeaders } from "../lib/cors.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import {
  ASSOCIATION_KINDS,
  archiveEntityAssociations,
  associationCounterpart,
  findBusinessEntity,
  listEntityAssociations,
  moveAssociationEntity,
  normalizeAssociationEntityType,
  summarizeAssociatedEntity,
  upsertAssociation
} from "../lib/association-model.mjs";

const MAX_BODY_BYTES = Number(process.env.ACCOUNT_API_MAX_BODY_BYTES || 256 * 1024);
const ACCOUNT_TYPES = new Set(["company", "household", "group"]);
const ACCOUNT_STATUSES = new Set(["active", "inactive"]);
const ASSOCIATION_KINDS_SET = new Set(ASSOCIATION_KINDS);
const ACCOUNT_FIELDS = new Set([
  "name", "type", "status", "domain", "phone", "email", "website", "address",
  "city", "postalCode", "country", "taxId", "industry", "tags", "notes", "ownerId"
]);
const ASSOCIATION_FIELDS = new Set(["fromType", "fromId", "toType", "toId", "kind", "isPrimary"]);
const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  contacts: [],
  accounts: [],
  tasks: [],
  deals: [],
  proposals: [],
  bookings: [],
  invoices: [],
  hospitalityInvoices: [],
  projects: [],
  communicationThreads: [],
  associations: [],
  auditLog: []
};

export function isAccountApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/(?:accounts(?:\/(?:duplicates|merge|[^/]+(?:\/relations)?))?|associations(?:\/[^/]+)?)$/.test(pathname);
}

export async function handleAccountApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const segments = requestUrl.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context);

  try {
    const businessRef = segments[2] || "";
    const area = segments[3] || "";
    const recordId = segments[4] || "";
    const action = segments[5] || "";

    if (area === "accounts") {
      if (!recordId && method === "GET") return await listAccounts(businessRef, requestUrl, response, context);
      if (!recordId && method === "POST") return await createAccount(businessRef, request, response, context);
      if (recordId === "duplicates" && method === "GET") return await listAccountDuplicates(businessRef, response, context);
      if (recordId === "merge" && method === "POST") return await mergeAccounts(businessRef, request, response, context);
      if (recordId && action === "relations" && method === "GET") return await getAccountRelations(businessRef, recordId, response, context);
      if (recordId && !action && method === "GET") return await getAccount(businessRef, recordId, response, context);
      if (recordId && !action && method === "PATCH") return await updateAccount(businessRef, recordId, request, response, context);
      if (recordId && !action && method === "DELETE") return await archiveAccount(businessRef, recordId, response, context);
    }

    if (area === "associations") {
      if (!recordId && method === "GET") return await listAssociations(businessRef, requestUrl, response, context);
      if (!recordId && method === "POST") return await createAssociation(businessRef, request, response, context);
      if (recordId && method === "DELETE") return await archiveAssociation(businessRef, recordId, response, context);
    }

    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "GET, POST, PATCH, DELETE, OPTIONS" });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, { error: status >= 500 ? "Internal account API error" : error.message }, context);
  }
}

async function listAccounts(businessRef, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const q = clean(requestUrl.searchParams.get("q")).toLowerCase();
  const type = optionalEnum(requestUrl.searchParams.get("type"), ACCOUNT_TYPES, "type");
  const includeArchived = requestUrl.searchParams.get("includeArchived") === "true";
  const includeRelations = requestUrl.searchParams.get("includeRelations") === "true";
  const accounts = db.accounts
    .filter((account) => account.businessId === business.id)
    .filter((account) => includeArchived || (!account.archivedAt && !account.merged))
    .filter((account) => !type || account.type === type)
    .filter((account) => !q || accountMatchesQuery(account, q))
    .sort(compareAccounts)
    .map((account) => copyAccount(account, includeRelations ? buildRelations(db, business.id, "account", account.id) : null));
  sendJson(response, 200, { accounts, total: accounts.length }, context);
}

async function createAccount(businessRef, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const source = requireObject(await readJsonBody(request));
  assertAllowedFields(source, ACCOUNT_FIELDS, "account");
  const now = new Date().toISOString();
  const account = normalizeAccount(source, null, business.id, now);
  db.accounts.push(account);
  appendAudit(db, "account.created", business.id, now, { accountId: account.id });
  await saveDb(db, context, "account-create");
  sendJson(response, 201, { account: copyAccount(account, []) }, context);
}

async function getAccount(businessRef, accountId, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const account = requireAccount(db, business.id, accountId);
  sendJson(response, 200, { account: copyAccount(account, buildRelations(db, business.id, "account", account.id)) }, context);
}

async function updateAccount(businessRef, accountId, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const account = requireAccount(db, business.id, accountId);
  const source = requireObject(await readJsonBody(request));
  assertAllowedFields(source, ACCOUNT_FIELDS, "account");
  const now = new Date().toISOString();
  Object.assign(account, normalizeAccount(source, account, business.id, now));
  appendAudit(db, "account.updated", business.id, now, { accountId: account.id });
  await saveDb(db, context, "account-update");
  sendJson(response, 200, { account: copyAccount(account, buildRelations(db, business.id, "account", account.id)) }, context);
}

async function archiveAccount(businessRef, accountId, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const account = requireAccount(db, business.id, accountId);
  const activeDeals = db.deals.filter((deal) => deal.businessId === business.id && deal.accountId === account.id && !deal.archivedAt && deal.status === "open");
  if (activeDeals.length) throw httpError(409, "An account with open deals cannot be archived");
  const now = new Date().toISOString();
  account.archivedAt = now;
  account.status = "inactive";
  account.updatedAt = now;
  archiveEntityAssociations(db, business.id, "account", account.id, now);
  appendAudit(db, "account.archived", business.id, now, { accountId: account.id });
  await saveDb(db, context, "account-archive");
  sendJson(response, 200, { archived: true, account: copyAccount(account, []) }, context);
}

async function getAccountRelations(businessRef, accountId, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const account = requireAccount(db, business.id, accountId);
  const relations = buildRelations(db, business.id, "account", account.id);
  sendJson(response, 200, { account: copyAccount(account), relations, total: relations.length }, context);
}

async function listAccountDuplicates(businessRef, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const groups = detectAccountDuplicates(db.accounts.filter((account) => account.businessId === business.id && !account.archivedAt && !account.merged));
  sendJson(response, 200, { groups, total: groups.length }, context);
}

async function mergeAccounts(businessRef, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const source = requireObject(await readJsonBody(request));
  const survivorId = requiredId(source.survivorId, "survivorId");
  const duplicateIds = Array.isArray(source.duplicateIds) ? [...new Set(source.duplicateIds.map((id) => requiredId(id, "duplicateId")))] : [];
  if (!duplicateIds.length || duplicateIds.includes(survivorId)) throw httpError(400, "Merge needs distinct survivorId and duplicateIds");
  const survivor = requireAccount(db, business.id, survivorId);
  const duplicates = duplicateIds.map((id) => requireAccount(db, business.id, id));
  const now = new Date().toISOString();
  mergeAccountValues(survivor, duplicates, now);
  duplicates.forEach((account) => {
    account.merged = true;
    account.mergedInto = survivor.id;
    account.status = "inactive";
    account.updatedAt = now;
  });
  moveAccountReferences(db, business.id, duplicateIds, survivor.id, now);
  moveAssociationEntity(db, business.id, "account", duplicateIds, survivor.id, now);
  appendAudit(db, "account.merged", business.id, now, { accountId: survivor.id, duplicateIds });
  await saveDb(db, context, "account-merge");
  sendJson(response, 200, {
    account: copyAccount(survivor, buildRelations(db, business.id, "account", survivor.id)),
    mergedIds: duplicateIds
  }, context);
}

async function listAssociations(businessRef, requestUrl, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const rawEntityType = clean(requestUrl.searchParams.get("entityType"));
  const entityType = normalizeAssociationEntityType(rawEntityType);
  const entityId = optionalId(requestUrl.searchParams.get("entityId"), "entityId");
  const kind = optionalEnum(requestUrl.searchParams.get("kind"), ASSOCIATION_KINDS_SET, "kind");
  if (rawEntityType && !entityType) throw httpError(400, "entityType has an invalid value");
  if (Boolean(entityType) !== Boolean(entityId)) throw httpError(400, "entityType and entityId must be provided together");
  let associations = db.associations.filter((association) => association.businessId === business.id && !association.archivedAt);
  if (entityType) associations = listEntityAssociations(db, business.id, entityType, entityId);
  if (kind) associations = associations.filter((association) => association.kind === kind);
  const enriched = associations.map((association) => enrichAssociation(db, business.id, association, entityType, entityId));
  sendJson(response, 200, { associations: enriched, total: enriched.length }, context);
}

async function createAssociation(businessRef, request, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const source = requireObject(await readJsonBody(request));
  assertAllowedFields(source, ASSOCIATION_FIELDS, "association");
  const fromType = requiredEntityType(source.fromType, "fromType");
  const toType = requiredEntityType(source.toType, "toType");
  const fromId = requiredId(source.fromId, "fromId");
  const toId = requiredId(source.toId, "toId");
  if (fromType === toType && fromId === toId) throw httpError(400, "An entity cannot be associated with itself");
  requireEntity(db, business.id, fromType, fromId);
  requireEntity(db, business.id, toType, toId);
  const kind = source.kind === undefined ? "related" : requiredEnum(source.kind, ASSOCIATION_KINDS_SET, "kind");
  const now = new Date().toISOString();
  const result = upsertAssociation(db, {
    businessId: business.id,
    fromType,
    fromId,
    toType,
    toId,
    kind,
    isPrimary: source.isPrimary === true,
    now
  });
  syncDirectReference(db, result.association, false);
  appendAudit(db, result.created ? "association.created" : "association.restored", business.id, now, { associationId: result.association.id });
  await saveDb(db, context, "association-create");
  sendJson(response, result.created ? 201 : 200, { association: enrichAssociation(db, business.id, result.association) }, context);
}

async function archiveAssociation(businessRef, associationId, response, context) {
  const db = await loadDb(context);
  const business = requireBusiness(db, businessRef);
  const association = db.associations.find((item) => item.businessId === business.id && item.id === requiredId(associationId, "associationId") && !item.archivedAt);
  if (!association) throw httpError(404, "Association not found");
  const now = new Date().toISOString();
  association.archivedAt = now;
  association.updatedAt = now;
  syncDirectReference(db, association, true);
  appendAudit(db, "association.archived", business.id, now, { associationId: association.id });
  await saveDb(db, context, "association-archive");
  sendJson(response, 200, { archived: true, association: enrichAssociation(db, business.id, association) }, context);
}

function normalizeAccount(source, existing, businessId, now) {
  const base = existing || {};
  return {
    ...base,
    id: base.id || `account_${randomUUID()}`,
    businessId,
    name: Object.prototype.hasOwnProperty.call(source, "name") ? requiredText(source.name, "name", 180) : base.name,
    type: Object.prototype.hasOwnProperty.call(source, "type") ? requiredEnum(source.type, ACCOUNT_TYPES, "type") : (base.type || "company"),
    status: Object.prototype.hasOwnProperty.call(source, "status") ? requiredEnum(source.status, ACCOUNT_STATUSES, "status") : (base.status || "active"),
    domain: fieldText(source, base, "domain", 240).toLowerCase(),
    phone: fieldText(source, base, "phone", 80),
    email: fieldText(source, base, "email", 240).toLowerCase(),
    website: fieldText(source, base, "website", 2000),
    address: fieldText(source, base, "address", 500),
    city: fieldText(source, base, "city", 160),
    postalCode: fieldText(source, base, "postalCode", 40),
    country: fieldText(source, base, "country", 120),
    taxId: fieldText(source, base, "taxId", 80).toUpperCase(),
    industry: fieldText(source, base, "industry", 160),
    tags: Object.prototype.hasOwnProperty.call(source, "tags") ? normalizeTags(source.tags) : (base.tags || []),
    notes: fieldText(source, base, "notes", 10000),
    ownerId: Object.prototype.hasOwnProperty.call(source, "ownerId") ? optionalId(source.ownerId, "ownerId") : (base.ownerId || ""),
    createdAt: base.createdAt || now,
    updatedAt: now,
    archivedAt: base.archivedAt || "",
    merged: Boolean(base.merged),
    mergedInto: base.mergedInto || ""
  };
}

function buildRelations(db, businessId, entityType, entityId) {
  return listEntityAssociations(db, businessId, entityType, entityId).map((association) => {
    const counterpart = associationCounterpart(association, entityType, entityId);
    const record = findBusinessEntity(db, businessId, counterpart.type, counterpart.id, { includeArchived: true });
    return {
      ...copyAssociation(association),
      direction: counterpart.direction,
      related: summarizeAssociatedEntity(counterpart.type, record)
    };
  });
}

function enrichAssociation(db, businessId, association, entityType = "", entityId = "") {
  const base = copyAssociation(association);
  if (entityType && entityId) {
    const counterpart = associationCounterpart(association, entityType, entityId);
    return {
      ...base,
      direction: counterpart.direction,
      related: summarizeAssociatedEntity(counterpart.type, findBusinessEntity(db, businessId, counterpart.type, counterpart.id, { includeArchived: true }))
    };
  }
  return {
    ...base,
    from: summarizeAssociatedEntity(association.fromType, findBusinessEntity(db, businessId, association.fromType, association.fromId, { includeArchived: true })),
    to: summarizeAssociatedEntity(association.toType, findBusinessEntity(db, businessId, association.toType, association.toId, { includeArchived: true }))
  };
}

function copyAccount(account, relations) {
  return {
    id: account.id,
    businessId: account.businessId,
    name: account.name,
    type: account.type,
    status: account.status,
    domain: account.domain || "",
    phone: account.phone || "",
    email: account.email || "",
    website: account.website || "",
    address: account.address || "",
    city: account.city || "",
    postalCode: account.postalCode || "",
    country: account.country || "",
    taxId: account.taxId || "",
    industry: account.industry || "",
    tags: Array.isArray(account.tags) ? [...account.tags] : [],
    notes: account.notes || "",
    ownerId: account.ownerId || "",
    createdAt: account.createdAt || "",
    updatedAt: account.updatedAt || "",
    archivedAt: account.archivedAt || "",
    merged: Boolean(account.merged),
    mergedInto: account.mergedInto || "",
    ...(relations ? { relations, relationCount: relations.length } : {})
  };
}

function copyAssociation(association) {
  return {
    id: association.id,
    businessId: association.businessId,
    fromType: association.fromType,
    fromId: association.fromId,
    toType: association.toType,
    toId: association.toId,
    kind: association.kind,
    isPrimary: Boolean(association.isPrimary),
    createdAt: association.createdAt || "",
    updatedAt: association.updatedAt || "",
    archivedAt: association.archivedAt || ""
  };
}

function detectAccountDuplicates(accounts) {
  const groups = new Map();
  accounts.forEach((account) => {
    const keys = duplicateKeys(account);
    keys.forEach((key) => {
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(account);
    });
  });
  const seen = new Set();
  return Array.from(groups.entries())
    .filter(([, items]) => items.length > 1)
    .map(([key, items]) => {
      const unique = [...new Map(items.map((account) => [account.id, account])).values()];
      const signature = unique.map((account) => account.id).sort().join(":");
      if (seen.has(signature)) return null;
      seen.add(signature);
      return { id: `account-duplicates-${seen.size}`, key, accounts: unique.map((account) => copyAccount(account)) };
    })
    .filter(Boolean);
}

function duplicateKeys(account) {
  return [
    account.taxId ? `tax:${clean(account.taxId).toLowerCase()}` : "",
    account.domain ? `domain:${clean(account.domain).toLowerCase().replace(/^www\./, "")}` : "",
    account.phone ? `phone:${clean(account.phone).replace(/\D/g, "")}` : "",
    account.name ? `name:${clean(account.name).toLowerCase()}` : ""
  ].filter((key) => !key.endsWith(":"));
}

function mergeAccountValues(survivor, duplicates, now) {
  const records = [survivor, ...duplicates];
  const scalarFields = ["domain", "phone", "email", "website", "address", "city", "postalCode", "country", "taxId", "industry", "ownerId"];
  scalarFields.forEach((field) => {
    survivor[field] = survivor[field] || records.map((record) => record[field]).find(Boolean) || "";
  });
  survivor.tags = [...new Set(records.flatMap((record) => Array.isArray(record.tags) ? record.tags : []).map(clean).filter(Boolean))].slice(0, 24);
  survivor.notes = [...new Set(records.map((record) => clean(record.notes)).filter(Boolean))].join("\n\n");
  survivor.updatedAt = now;
}

function moveAccountReferences(db, businessId, duplicateIds, survivorId, now) {
  const ids = new Set(duplicateIds);
  ["deals", "proposals", "bookings", "invoices", "hospitalityInvoices", "projects"].forEach((collection) => {
    (Array.isArray(db[collection]) ? db[collection] : []).forEach((record) => {
      if (record.businessId === businessId && ids.has(record.accountId)) {
        record.accountId = survivorId;
        record.updatedAt = now;
      }
    });
  });
}

function syncDirectReference(db, association, removing) {
  if (association.fromType === "deal" && association.toType === "account" && association.kind === "primary") {
    const deal = findBusinessEntity(db, association.businessId, "deal", association.fromId, { includeArchived: true });
    if (deal && (!removing || deal.accountId === association.toId)) deal.accountId = removing ? "" : association.toId;
  }
}

function requireEntity(db, businessId, type, id) {
  const entity = findBusinessEntity(db, businessId, type, id);
  if (!entity) throw httpError(404, `${type} not found`);
  return entity;
}

function requireAccount(db, businessId, accountId) {
  const account = db.accounts.find((item) => item.businessId === businessId && item.id === requiredId(accountId, "accountId") && !item.archivedAt && !item.merged);
  if (!account) throw httpError(404, "Account not found");
  return account;
}

function requireBusiness(db, businessRef) {
  const business = db.businesses.find((item) => item.id === businessRef || item.slug === businessRef);
  if (!business) throw httpError(404, "Business not found");
  return business;
}

async function loadDb(context) {
  const db = await loadBusinessStore(context, DEFAULT_DB);
  Object.keys(DEFAULT_DB).forEach((key) => {
    if (Array.isArray(DEFAULT_DB[key])) db[key] = Array.isArray(db[key]) ? db[key] : [];
  });
  return db;
}

async function saveDb(db, context, label) {
  await saveBusinessStore(db, context, label);
}

async function readJsonBody(request) {
  let size = 0;
  let raw = "";
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw httpError(413, "Account payload too large");
    raw += chunk.toString("utf8");
  }
  if (!raw.trim()) throw httpError(400, "JSON body is required");
  try { return JSON.parse(raw); } catch { throw httpError(400, "Invalid JSON body"); }
}

function accountMatchesQuery(account, q) {
  return [account.name, account.domain, account.phone, account.email, account.taxId, account.industry, account.city, ...(account.tags || [])]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

function compareAccounts(left, right) {
  return String(left.name || "").localeCompare(String(right.name || ""), "es") || String(left.id).localeCompare(String(right.id));
}

function requireObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw httpError(400, "JSON body must be an object");
  return value;
}

function assertAllowedFields(source, allowed, label) {
  const unknown = Object.keys(source).filter((field) => !allowed.has(field));
  if (unknown.length) throw httpError(400, `Unknown ${label} field(s): ${unknown.join(", ")}`);
}

function fieldText(source, existing, field, maxLength) {
  return Object.prototype.hasOwnProperty.call(source, field) ? optionalText(source[field], field, maxLength) : (existing[field] || "");
}

function requiredText(value, field, maxLength) {
  if (typeof value !== "string") throw httpError(400, `${field} must be a string`);
  const text = clean(value);
  if (!text) throw httpError(400, `${field} cannot be empty`);
  if (text.length > maxLength) throw httpError(400, `${field} cannot exceed ${maxLength} characters`);
  return text;
}

function optionalText(value, field, maxLength) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string") throw httpError(400, `${field} must be a string`);
  const text = String(value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
  if (text.length > maxLength) throw httpError(400, `${field} cannot exceed ${maxLength} characters`);
  return text;
}

function requiredEnum(value, allowed, field) {
  if (typeof value !== "string" || !allowed.has(value)) throw httpError(400, `${field} has an invalid value`);
  return value;
}

function optionalEnum(value, allowed, field) {
  if (value === undefined || value === null || value === "") return "";
  return requiredEnum(value, allowed, field);
}

function requiredEntityType(value, field) {
  const type = normalizeAssociationEntityType(value);
  if (!type) throw httpError(400, `${field} has an invalid value`);
  return type;
}

function requiredId(value, field) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,180}$/.test(value)) throw httpError(400, `${field} has an invalid format`);
  return value;
}

function optionalId(value, field) {
  if (value === undefined || value === null || value === "") return "";
  return requiredId(value, field);
}

function normalizeTags(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 24) throw httpError(400, "tags must be an array with at most 24 values");
  return [...new Set(value.map((tag) => requiredText(tag, "tag", 60)))];
}

function appendAudit(db, type, businessId, now, metadata = {}) {
  db.auditLog.push({ id: `audit_${randomUUID()}`, type, businessId, ...metadata, createdAt: now });
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sendJson(response, status, payload, context, extraHeaders = {}) {
  response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), "Content-Type": "application/json; charset=utf-8", ...extraHeaders });
  response.end(JSON.stringify(payload, null, 2));
}

function sendEmpty(response, status, context) {
  response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context), Allow: "GET, POST, PATCH, DELETE, OPTIONS" });
  response.end();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
