import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { corsHeaders } from "./cors.mjs";
import { loadBusinessStore } from "./business-store.mjs";
import { clearAuthFailures, recordAuthFailure } from "./structured-logger.mjs";

const scryptAsync = promisify(scrypt);
const MAX_BODY_BYTES = Number(process.env.CLIENT_AUTH_MAX_BODY_BYTES || 64 * 1024);
const SESSION_TTL_SECONDS = Number(process.env.CLIENT_SESSION_TTL_SECONDS || 60 * 60 * 24 * 14);

export function isClientAuthApiRequest(pathname) {
  return pathname === "/api/client/login" || pathname === "/api/client/session";
}

export async function handleClientAuthApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    if (requestUrl.pathname === "/api/client/login" && method === "POST") {
      await loginClient(request, response, context);
      return;
    }

    if (requestUrl.pathname === "/api/client/session" && method === "GET") {
      await getClientSession(request, response, context);
      return;
    }

    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "GET, POST, OPTIONS" });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, {
      error: status >= 500 ? "Internal client auth error" : error.message,
      code: error.code || "client_auth_error"
    }, context);
  }
}

export async function getClientSessionForRequest(request) {
  const token = getProvidedClientToken(request);

  if (!token) {
    return null;
  }

  return verifyClientSessionToken(token);
}

function getProvidedClientToken(request) {
  return clean(request.headers["x-locallift-client-token"]);
}

export function isClientApiAccessPath(pathname, session) {
  if (!session?.businessId) {
    return false;
  }

  const segments = pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));

  if (segments[0] !== "api" || segments[1] !== "businesses") {
    return false;
  }

  if (segments.length === 2) {
    return true;
  }

  const businessRef = segments[2] || "";
  if (!matchesBusinessSession(session, businessRef)) {
    return false;
  }

  const area = segments[3] || "";
  const allowedAreas = new Set(["contacts", "services", "bookings", "availability", "blocks", "reminders", "reports", "events"]);
  return segments.length === 3 || allowedAreas.has(area);
}

export function matchesBusinessSession(session, businessRef) {
  return Boolean(session?.businessId && (
    session.businessId === businessRef || session.businessSlug === businessRef
  ));
}

export function getRequestClientSession(request) {
  return request.localLiftClientSession || null;
}

export async function hashClientPassword(password) {
  const cleanPassword = clean(password);

  if (cleanPassword.length < 8) {
    throw httpError(400, "Client password must have at least 8 characters");
  }

  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(cleanPassword, salt, 64);
  return `scrypt:${salt}:${hash.toString("hex")}`;
}

export async function setBusinessClientPassword(business, password, now = new Date().toISOString()) {
  const passwordHash = await hashClientPassword(password);
  const settings = isPlainObject(business.settings) ? business.settings : {};
  const portal = isPlainObject(settings.portal) ? settings.portal : {};

  business.settings = {
    ...settings,
    portal: {
      ...portal,
      enabled: true,
      passwordHash,
      passwordUpdatedAt: now
    }
  };
  business.updatedAt = now;
  return business;
}

export function toPortalAccessSummary(business) {
  const portal = business?.settings?.portal || {};
  return {
    enabled: portal.enabled === true,
    passwordSet: Boolean(portal.passwordHash),
    passwordUpdatedAt: portal.passwordUpdatedAt || ""
  };
}

async function loginClient(request, response, context) {
  const payload = await readJsonBody(request);
  const businessRef = clean(payload.business || payload.businessName || payload.name || payload.slug || payload.id);
  const password = clean(payload.password);

  if (!businessRef || !password) {
    throw httpError(400, "Business name and password are required");
  }

  const db = await loadBusinessStore(context);
  const business = findBusinessForLogin(db, businessRef);

  if (!business || business.status === "archived") {
    recordAuthFailure(request, "client_login_invalid_credentials", context, {
      route: "/api/client/login",
      statusCode: 401
    });
    throw httpError(401, "Invalid business credentials");
  }

  const passwordHash = business.settings?.portal?.passwordHash || "";
  const enabled = business.settings?.portal?.enabled === true;

  if (!enabled || !passwordHash || !(await verifyClientPassword(password, passwordHash))) {
    recordAuthFailure(request, "client_login_invalid_credentials", context, {
      route: "/api/client/login",
      statusCode: 401
    });
    throw httpError(401, "Invalid business credentials");
  }

  clearAuthFailures(request, context, { route: "/api/client/login" });
  const session = makeClientSession(business);
  sendJson(response, 200, {
    session,
    business: toClientBusiness(business)
  }, context);
}

async function getClientSession(request, response, context) {
  const session = await getClientSessionForRequest(request);

  if (!session) {
    recordAuthFailure(request, "client_session_invalid_or_missing", context, {
      route: "/api/client/session",
      hasProvidedToken: Boolean(getProvidedClientToken(request)),
      statusCode: 401
    });
    throw httpError(401, "Client session required");
  }

  const db = await loadBusinessStore(context);
  const business = db.businesses.find((item) => item.id === session.businessId && item.status !== "archived");

  if (!business) {
    recordAuthFailure(request, "client_session_business_missing", context, {
      route: "/api/client/session",
      hasProvidedToken: true,
      statusCode: 401
    });
    throw httpError(401, "Client session is no longer valid");
  }

  clearAuthFailures(request, context, { route: "/api/client/session" });
  sendJson(response, 200, {
    session: {
      ...session,
      businessSlug: business.slug,
      businessName: business.name
    },
    business: toClientBusiness(business)
  }, context);
}

async function verifyClientPassword(password, passwordHash) {
  const [scheme, salt, expectedHex] = String(passwordHash || "").split(":");

  if (scheme !== "scrypt" || !salt || !expectedHex) {
    return false;
  }

  const actual = await scryptAsync(clean(password), salt, 64);
  const expected = Buffer.from(expectedHex, "hex");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

function makeClientSession(business) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = {
    role: "client",
    businessId: business.id,
    businessSlug: business.slug,
    businessName: business.name,
    exp: expiresAt
  };
  const tokenPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = signTokenPayload(tokenPayload);

  return {
    ...payload,
    token: `${tokenPayload}.${signature}`,
    expiresAt: new Date(expiresAt * 1000).toISOString()
  };
}

function verifyClientSessionToken(token) {
  const [tokenPayload, signature] = clean(token).split(".");

  if (!tokenPayload || !signature || signTokenPayload(tokenPayload) !== signature) {
    return null;
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(tokenPayload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (payload.role !== "client" || !payload.businessId || Number(payload.exp || 0) < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
}

function signTokenPayload(tokenPayload) {
  return createHmac("sha256", getSessionSecret()).update(tokenPayload).digest("base64url");
}

function getSessionSecret() {
  return clean(process.env.CLIENT_SESSION_SECRET)
    || clean(process.env.LOCALLIFT_ADMIN_TOKEN)
    || clean(process.env.ADMIN_API_TOKEN)
    || clean(process.env.DATABASE_URL)
    || "locallift-local-client-session";
}

function findBusinessForLogin(db, businessRef) {
  const normalized = normalizeLookup(businessRef);
  return db.businesses.find((business) => (
    normalizeLookup(business.id) === normalized
      || normalizeLookup(business.slug) === normalized
      || normalizeLookup(business.name) === normalized
  ));
}

function toClientBusiness(business) {
  return {
    id: business.id,
    slug: business.slug,
    name: business.name,
    category: business.category,
    city: business.city,
    publishedUrl: business.publishedUrl || ""
  };
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

function normalizeLookup(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clean(value) {
  return String(value || "").trim();
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
