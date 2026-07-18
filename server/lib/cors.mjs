const DEFAULT_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const DEFAULT_HEADERS = "Content-Type, Authorization, X-LocalLift-Admin-Token, X-LocalLift-Client-Token, X-LocalLift-User-Token";

export function corsHeaders(context = {}) {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = clean(context.requestOrigin);
  const allowOrigin = resolveAllowOrigin(allowedOrigins, requestOrigin);

  return cleanHeaders({
    "Access-Control-Allow-Origin": allowOrigin || null,
    "Access-Control-Allow-Methods": DEFAULT_METHODS,
    "Access-Control-Allow-Headers": DEFAULT_HEADERS,
    "Access-Control-Max-Age": "600",
    Vary: "Origin"
  });
}

function resolveAllowOrigin(allowedOrigins, requestOrigin) {
  if (!allowedOrigins.length) {
    return process.env.NODE_ENV === "production" ? "" : "*";
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return requestOrigin ? "" : allowedOrigins[0];
}

function getAllowedOrigins() {
  return clean(process.env.CORS_ORIGIN || process.env.LOCALLIFT_CORS_ORIGIN)
    .split(",")
    .map((origin) => clean(origin))
    .filter(Boolean);
}

function clean(value) {
  return String(value || "").trim();
}

function cleanHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).filter(([, value]) => value !== null && value !== undefined && value !== "")
  );
}
