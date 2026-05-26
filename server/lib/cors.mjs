const DEFAULT_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const DEFAULT_HEADERS = "Content-Type, Authorization, X-LocalLift-Admin-Token";

export function corsHeaders(context = {}) {
  const allowedOrigins = getAllowedOrigins();
  const requestOrigin = clean(context.requestOrigin);
  const allowOrigin = resolveAllowOrigin(allowedOrigins, requestOrigin);

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": DEFAULT_METHODS,
    "Access-Control-Allow-Headers": DEFAULT_HEADERS,
    Vary: "Origin"
  };
}

function resolveAllowOrigin(allowedOrigins, requestOrigin) {
  if (!allowedOrigins.length) {
    return "*";
  }

  if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
    return requestOrigin;
  }

  return allowedOrigins[0];
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
