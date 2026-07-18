import { loadBusinessStore } from "../lib/business-store.mjs";
import { buildCustomer360, buildCustomer360Detail } from "../lib/customer-360.mjs";
import { corsHeaders } from "../lib/cors.mjs";

const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  contacts: [],
  activities: [],
  accounts: [],
  associations: [],
  deals: [],
  tasks: [],
  consentEvents: [],
  proposals: [],
  projects: [],
  invoices: [],
  payments: [],
  hospitalityInvoices: [],
  communicationThreads: [],
  bookings: []
};

export function isCustomer360ApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/customers\/(?:360|[^/]+\/360)$/.test(pathname);
}

export async function handleCustomer360Api(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://dls.local");
  const method = request.method || "GET";
  if (method === "OPTIONS") return sendEmpty(response, 204, context);

  try {
    if (method !== "GET") throw httpError(405, "Method not allowed");
    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    const businessRef = segments[2] || "";
    const db = await loadBusinessStore(context, DEFAULT_DB);
    ensureCollections(db);
    const business = requireBusiness(db, businessRef);
    const options = {
      now: optionalIso(requestUrl.searchParams.get("now"), "now"),
      search: optionalText(requestUrl.searchParams.get("search"), "search", 240),
      segment: optionalText(requestUrl.searchParams.get("segment"), "segment", 80),
      limit: optionalInteger(requestUrl.searchParams.get("limit"), "limit", 1, 500),
      timelineLimit: optionalInteger(requestUrl.searchParams.get("timelineLimit"), "timelineLimit", 1, 100)
    };

    if (segments[4] === "360") {
      const result = buildCustomer360(db, business.id, options);
      return sendJson(response, 200, result, context);
    }

    const contactId = requiredId(segments[4], "contactId");
    const result = buildCustomer360Detail(db, business.id, contactId, options);
    if (!result) throw httpError(404, "Customer not found");
    return sendJson(response, 200, result, context);
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, {
      error: status >= 500 ? "Internal customer 360 API error" : error.message,
      code: error.code || "customer_360_error"
    }, context, error.allow ? { Allow: error.allow } : {});
  }
}

function ensureCollections(db) {
  for (const [key, value] of Object.entries(DEFAULT_DB)) {
    if (Array.isArray(value)) db[key] = Array.isArray(db[key]) ? db[key] : [];
  }
}

function requireBusiness(db, ref) {
  const business = db.businesses.find((item) => item.id === ref || item.slug === ref);
  if (!business) throw httpError(404, "Business not found");
  return business;
}

function requiredId(value, field) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,180}$/.test(value)) throw httpError(400, `${field} has an invalid format`);
  return value;
}

function optionalText(value, field, max) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value !== "string") throw httpError(400, `${field} must be text`);
  const result = value.trim();
  if (result.length > max) throw httpError(400, `${field} cannot exceed ${max} characters`);
  return result;
}

function optionalInteger(value, field, min, max) {
  if (value === null || value === undefined || value === "") return undefined;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min || number > max) throw httpError(400, `${field} must be an integer between ${min} and ${max}`);
  return number;
}

function optionalIso(value, field) {
  if (value === null || value === undefined || value === "") return undefined;
  const date = new Date(value);
  if (typeof value !== "string" || Number.isNaN(date.getTime())) throw httpError(400, `${field} must be an ISO date`);
  return date.toISOString();
}

function httpError(statusCode, message, code = "customer_360_error") {
  const error = Object.assign(new Error(message), { statusCode, code });
  if (statusCode === 405) error.allow = "GET, OPTIONS";
  return error;
}

function sendJson(response, statusCode, payload, context, extraHeaders = {}) {
  response.writeHead(statusCode, {
    ...context.baseHeaders,
    ...corsHeaders(context.requestOrigin, context),
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload));
}

function sendEmpty(response, statusCode, context) {
  response.writeHead(statusCode, { ...context.baseHeaders, ...corsHeaders(context.requestOrigin, context), Allow: "GET, OPTIONS" });
  response.end();
}
