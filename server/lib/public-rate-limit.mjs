import { corsHeaders } from "./cors.mjs";

const buckets = new Map();
let requestCount = 0;

const ROUTE_LIMITS = {
  leads: {
    limit: readPositiveInteger("PUBLIC_LEAD_RATE_LIMIT", 6),
    windowMs: readPositiveInteger("PUBLIC_LEAD_RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000)
  },
  bookings: {
    limit: readPositiveInteger("PUBLIC_BOOKING_RATE_LIMIT", 6),
    windowMs: readPositiveInteger("PUBLIC_BOOKING_RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000)
  },
  events: {
    limit: readPositiveInteger("PUBLIC_EVENT_RATE_LIMIT", 120),
    windowMs: readPositiveInteger("PUBLIC_EVENT_RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000)
  },
  discovery: {
    limit: readPositiveInteger("PUBLIC_DISCOVERY_RATE_LIMIT", 40),
    windowMs: readPositiveInteger("PUBLIC_DISCOVERY_RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000)
  }
};

export function requirePublicApiRateLimit(request, response, context, pathname) {
  const route = getPublicRoute(pathname);

  if (!route || !isRateLimitedMethod(route, request.method || "GET")) {
    return true;
  }

  const now = Date.now();
  const config = ROUTE_LIMITS[route];
  const key = `${route}:${getClientAddress(request)}`;
  const current = buckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + config.windowMs }
    : current;

  bucket.count += 1;
  buckets.set(key, bucket);
  requestCount += 1;

  if (requestCount % 250 === 0) {
    removeExpiredBuckets(now);
  }

  if (bucket.count <= config.limit) {
    return true;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  response.writeHead(429, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    "Content-Type": "application/json; charset=utf-8",
    "Retry-After": String(retryAfterSeconds),
    "RateLimit-Limit": String(config.limit),
    "RateLimit-Remaining": "0",
    "RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1000))
  });
  response.end(JSON.stringify({
    error: "Too many public requests. Try again later.",
    code: "public_rate_limit_exceeded",
    retryAfterSeconds
  }, null, 2));
  return false;
}

function getPublicRoute(pathname) {
  if (pathname === "/api/discovery/search") {
    return "discovery";
  }

  const match = String(pathname || "").match(/^\/api\/public\/[^/]+\/(leads|bookings|events)$/);
  return match?.[1] || "";
}

function isRateLimitedMethod(route, method) {
  if (route === "discovery") {
    return method === "GET";
  }

  return method === "POST";
}

function getClientAddress(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "")
    .split(",")
    .map((value) => value.trim())
    .find(Boolean);
  return forwarded || request.socket?.remoteAddress || "unknown";
}

function removeExpiredBuckets(now) {
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  });
}

function readPositiveInteger(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
