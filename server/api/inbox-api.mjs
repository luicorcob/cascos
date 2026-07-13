import { corsHeaders } from "../lib/cors.mjs";
import { loadBusinessStore } from "../lib/business-store.mjs";
import {
  buildCommercialInbox,
  normalizeStaleCustomerDays,
  resolveInboxTimezone
} from "../lib/commercial-inbox.mjs";

const ALLOWED_METHODS = "GET, OPTIONS";
const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  businesses: [],
  contacts: [],
  activities: [],
  proposals: [],
  services: [],
  bookings: [],
  availability: [],
  bookingBlocks: [],
  bookingReminders: [],
  businessEvents: [],
  auditLog: []
};

export function isInboxApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/inbox$/.test(String(pathname || ""));
}

export async function handleInboxApi(request, response, context = {}) {
  const method = String(request?.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  if (method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: ALLOWED_METHODS });
    return;
  }

  try {
    const requestUrl = new URL(request?.url || "/", "http://locallift.local");
    if (!isInboxApiRequest(requestUrl.pathname)) {
      throw httpError(404, "Inbox route not found");
    }

    const businessRef = decodeURIComponent(requestUrl.pathname.split("/")[3] || "");
    const staleCustomerDays = readStaleCustomerDays(requestUrl.searchParams);
    const db = await loadDb(context);
    const business = db.businesses.find((item) => item?.id === businessRef || item?.slug === businessRef);
    if (!business) {
      throw httpError(404, "Business not found");
    }

    const inbox = buildCommercialInbox(db, business, {
      now: context.inboxNow,
      staleCustomerDays,
      timezone: resolveInboxTimezone(context.env || process.env)
    });

    sendJson(response, 200, { inbox }, context);
  } catch (error) {
    const status = error?.statusCode
      || (error instanceof RangeError || error instanceof URIError ? 400 : 500);
    const message = status >= 500 ? "Internal inbox API error" : error.message;
    sendJson(response, status, { error: message }, context);
  }
}

async function loadDb(context) {
  const loader = typeof context?.loadBusinessStore === "function"
    ? context.loadBusinessStore
    : loadBusinessStore;
  const db = await loader(context, DEFAULT_DB);
  const source = db && typeof db === "object" ? db : {};

  return {
    ...source,
    businesses: array(source.businesses),
    contacts: array(source.contacts),
    activities: array(source.activities),
    proposals: array(source.proposals),
    bookings: array(source.bookings)
  };
}

function readStaleCustomerDays(searchParams) {
  const staleValues = searchParams.getAll("staleDays");
  const aliasValues = searchParams.getAll("days");
  const values = staleValues.length ? staleValues : aliasValues;

  if (!values.length) {
    return normalizeStaleCustomerDays(undefined);
  }
  if (staleValues.length + aliasValues.length !== 1 || !/^[1-9]\d{0,3}$/.test(values[0])) {
    throw new RangeError("staleDays must be an integer between 1 and 3650");
  }
  return normalizeStaleCustomerDays(values[0]);
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function sendJson(response, status, payload, context, extraHeaders = {}) {
  response.writeHead(status, {
    ...(context.baseHeaders || {}),
    ...corsHeaders(context),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendEmpty(response, status, context) {
  response.writeHead(status, {
    ...(context.baseHeaders || {}),
    ...corsHeaders(context),
    Allow: ALLOWED_METHODS
  });
  response.end();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
