import { timingSafeEqual } from "node:crypto";
import {
  authorizeBusinessUserRequest,
  getBusinessUserSessionForRequest,
  getProvidedBusinessUserToken
} from "./business-access.mjs";
import { getClientSessionForRequest, isClientApiAccessPath } from "./client-auth.mjs";
import { corsHeaders } from "./cors.mjs";
import { clearAuthFailures, recordAuthFailure } from "./structured-logger.mjs";

const ADMIN_TOKEN_ENV_KEYS = ["LOCALLIFT_ADMIN_TOKEN", "ADMIN_API_TOKEN"];

export function isAdminApiRequest(pathname) {
  return pathname === "/api/businesses"
    || pathname.startsWith("/api/businesses/")
    || pathname.startsWith("/api/enterprise/")
    || pathname === "/api/demo-publish"
    || pathname === "/api/qa-visual"
    || pathname === "/api/site-images"
    || pathname === "/api/leads"
    || pathname === "/api/studio/from-opportunity"
    || (pathname.startsWith("/api/google/") && pathname !== "/api/google/oauth/callback");
}

export async function requireAdminApiAuth(request, response, context, pathname = "") {
  const expectedToken = getAdminToken();
  const providedClientToken = getProvidedClientToken(request);
  const providedBusinessUserToken = getProvidedBusinessUserToken(request);
  const clientSession = await getClientSessionForRequest(request);
  const businessUserSession = await getBusinessUserSessionForRequest(request, context);

  if (clientSession && isClientApiAccessPath(pathname, clientSession)) {
    request.localLiftClientSession = clientSession;
    clearAuthFailures(request, context, { route: pathname });
    return true;
  }

  if (providedClientToken) {
    recordAuthFailure(request, clientSession ? "client_session_forbidden" : "client_session_invalid", context, {
      route: pathname,
      hasProvidedToken: true,
      clientSessionRole: clientSession?.role || "",
      statusCode: clientSession ? 403 : 401
    });
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

  if (businessUserSession && authorizeBusinessUserRequest(pathname, request.method || "GET", businessUserSession)) {
    request.localLiftBusinessUserSession = businessUserSession;
    clearAuthFailures(request, context, { route: pathname });
    return true;
  }

  if (providedBusinessUserToken) {
    recordAuthFailure(request, businessUserSession ? "business_user_forbidden" : "business_user_session_invalid", context, {
      route: pathname,
      hasProvidedToken: true,
      businessUserRole: businessUserSession?.userRole || "",
      statusCode: businessUserSession ? 403 : 401
    });
    response.writeHead(businessUserSession ? 403 : 401, {
      ...context.baseHeaders,
      ...corsHeaders(context),
      "Content-Type": "application/json; charset=utf-8"
    });
    response.end(JSON.stringify({
      error: businessUserSession ? "Business user cannot perform this action" : "Business user session invalid or expired",
      code: businessUserSession ? "business_user_forbidden" : "business_user_auth_required"
    }, null, 2));
    return false;
  }

  if (request.method === "OPTIONS") {
    return true;
  }

  if (!expectedToken) {
    if (process.env.NODE_ENV === "production") {
      recordAuthFailure(request, "admin_auth_not_configured", context, {
        route: pathname,
        hasProvidedToken: false,
        statusCode: 503
      });
      response.writeHead(503, {
        ...context.baseHeaders,
        ...corsHeaders(context),
        "Content-Type": "application/json; charset=utf-8"
      });
      response.end(JSON.stringify({
        error: "Admin API token is not configured",
        code: "admin_auth_not_configured"
      }, null, 2));
      return false;
    }

    return true;
  }

  const providedToken = getProvidedToken(request);

  if (providedToken && secureCompare(providedToken, expectedToken)) {
    clearAuthFailures(request, context, { route: pathname });
    return true;
  }

  recordAuthFailure(request, "admin_token_invalid_or_missing", context, {
    route: pathname,
    hasProvidedToken: Boolean(providedToken),
    statusCode: 401
  });
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
