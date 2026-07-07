import { timingSafeEqual } from "node:crypto";
import { getClientSessionForRequest, isClientApiAccessPath } from "./client-auth.mjs";
import { corsHeaders } from "./cors.mjs";

const ADMIN_TOKEN_ENV_KEYS = ["LOCALLIFT_ADMIN_TOKEN", "ADMIN_API_TOKEN"];

export function isAdminApiRequest(pathname) {
  return pathname === "/api/businesses"
    || pathname.startsWith("/api/businesses/")
    || pathname === "/api/site-images"
    || pathname === "/api/leads"
    || pathname === "/api/studio/from-opportunity"
    || (pathname.startsWith("/api/google/") && pathname !== "/api/google/oauth/callback");
}

export async function requireAdminApiAuth(request, response, context, pathname = "") {
  const expectedToken = getAdminToken();
  const providedClientToken = getProvidedClientToken(request);
  const clientSession = await getClientSessionForRequest(request);

  if (clientSession && isClientApiAccessPath(pathname, clientSession)) {
    request.localLiftClientSession = clientSession;
    return true;
  }

  if (providedClientToken) {
    response.writeHead(clientSession ? 403 : 401, {
      ...context.baseHeaders,
      ...corsHeaders(context),
      "Content-Type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify({
      error: clientSession ? "Client session cannot access this route" : "Client session invalid or expired",
      code: clientSession ? "client_forbidden" : "client_auth_required"
    }, null, 2));
    return false;
  }

  if (!expectedToken || request.method === "OPTIONS") {
    return true;
  }

  const providedToken = getProvidedToken(request);

  if (providedToken && secureCompare(providedToken, expectedToken)) {
    return true;
  }

  response.writeHead(401, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    "Content-Type": "application/json; charset=utf-8",
    "WWW-Authenticate": 'Bearer realm="DLS Admin API"'
  });
  response.end(JSON.stringify({
    error: "Admin API token required",
    code: "admin_auth_required"
  }, null, 2));
  return false;
}

function getAdminToken() {
  return ADMIN_TOKEN_ENV_KEYS
    .map((key) => clean(process.env[key]))
    .find(Boolean) || "";
}

function getProvidedToken(request) {
  const headerToken = clean(request.headers["x-locallift-admin-token"]);

  if (headerToken) {
    return headerToken;
  }

  const authorization = clean(request.headers.authorization);
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return clean(match?.[1] || "");
}

function getProvidedClientToken(request) {
  return clean(request.headers["x-locallift-client-token"]);
}

function secureCompare(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function clean(value) {
  return String(value || "").trim();
}
