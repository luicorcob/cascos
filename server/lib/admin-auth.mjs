import { timingSafeEqual } from "node:crypto";
import { corsHeaders } from "./cors.mjs";

const ADMIN_TOKEN_ENV_KEYS = ["LOCALLIFT_ADMIN_TOKEN", "ADMIN_API_TOKEN"];

export function isAdminApiRequest(pathname) {
  return pathname === "/api/businesses"
    || pathname.startsWith("/api/businesses/")
    || (pathname.startsWith("/api/google/") && pathname !== "/api/google/oauth/callback");
}

export function requireAdminApiAuth(request, response, context) {
  const expectedToken = getAdminToken();

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
    "WWW-Authenticate": 'Bearer realm="LocalLift Admin API"'
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
