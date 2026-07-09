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
  },
  clientLogin: {
    limit: readPositiveInteger("CLIENT_LOGIN_RATE_LIMIT", 10),
    windowMs: readPositiveInteger("CLIENT_LOGIN_RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000)
  },
  siteImages: {
    limit: readPositiveInteger("SITE_IMAGE_RATE_LIMIT", 20),
    windowMs: readPositiveInteger("SITE_IMAGE_RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000)
  },
  stockImages: {
    limit: readPositiveInteger("STOCK_IMAGE_RATE_LIMIT", 60),
    windowMs: readPositiveInteger("STOCK_IMAGE_RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000)
  },
  stockDownload: {
    limit: readPositiveInteger("STOCK_IMAGE_DOWNLOAD_RATE_LIMIT", 120),
    windowMs: readPositiveInteger("STOCK_IMAGE_DOWNLOAD_RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000)
  },
  demoPublish: {
    limit: readPositiveInteger("DEMO_PUBLISH_RATE_LIMIT", 12),
    windowMs: readPositiveInteger("DEMO_PUBLISH_RATE_LIMIT_WINDOW_MS", 60 * 60 * 1000)
  },
  qaVisual: {
    limit: readPositiveInteger("QA_VISUAL_RATE_LIMIT", 10),
    windowMs: readPositiveInteger("QA_VISUAL_RATE_LIMIT_WINDOW_MS", 60 * 60 * 1000)
  },
  googleApi: {
    limit: readPositiveInteger("GOOGLE_API_RATE_LIMIT", 60),
    windowMs: readPositiveInteger("GOOGLE_API_RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000)
  },
  radarWrite: {
    limit: readPositiveInteger("RADAR_WRITE_RATE_LIMIT", 30),
    windowMs: readPositiveInteger("RADAR_WRITE_RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000)
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
    error: "Too many requests. Try again later.",
    code: "rate_limit_exceeded",
    retryAfterSeconds
  }, null, 2));
  return false;
}

function getPublicRoute(pathname) {
  if (pathname === "/api/discovery/search") {
    return "discovery";
  }

  if (pathname === "/api/client/login") {
    return "clientLogin";
  }

  if (pathname === "/api/site-images") {
    return "siteImages";
  }

  if (pathname === "/api/stock-images") {
    return "stockImages";
  }

  if (pathname === "/api/stock-images/download") {
    return "stockDownload";
  }

  if (pathname === "/api/demo-publish") {
    return "demoPublish";
  }

  if (pathname === "/api/qa-visual") {
    return "qaVisual";
  }

  if (pathname === "/api/leads" || pathname === "/api/studio/from-opportunity") {
    return "radarWrite";
  }

  if (String(pathname || "").startsWith("/api/google/") && pathname !== "/api/google/oauth/callback") {
    return "googleApi";
  }

  const match = String(pathname || "").match(/^\/api\/public\/[^/]+\/(leads|bookings|events)$/);
  return match?.[1] || "";
}

function isRateLimitedMethod(route, method) {
  if (route === "discovery") {
    return method === "GET";
  }

  if (route === "stockImages") {
    return method === "GET";
  }

  if (route === "googleApi") {
    return method !== "OPTIONS";
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
