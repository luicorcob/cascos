const DEFAULT_TTL_HOURS = 24;
const DEFAULT_MAX_HTML_BYTES = 14 * 1024 * 1024;
const SAFE_DEMO_ID = /^[a-z0-9][a-z0-9_-]{2,140}$/;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return emptyResponse(204, corsHeaders(request, env));
    }

    if (url.pathname === "/api/health") {
      return jsonResponse({
        ok: true,
        service: "dls-demo-publisher",
        storage: Boolean(env.DEMOS),
        ttlHours: readPositiveNumber(env.DEMO_TTL_HOURS, DEFAULT_TTL_HOURS)
      }, 200, env, {}, request);
    }

    if (url.pathname === "/api/demo-publish") {
      return handlePublishRequest(request, env, url);
    }

    if (url.pathname === "/demos" || url.pathname.startsWith("/demos/")) {
      return handleDemoRequest(request, env, url);
    }

    return textResponse("Not found", 404, env, {}, request);
  }
};

async function handlePublishRequest(request, env, url) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405, env, { Allow: "POST, OPTIONS" }, request);
  }

  if (!isAuthorized(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401, env, {}, request);
  }

  if (!env.DEMOS) {
    return jsonResponse({ error: "KV namespace DEMOS is not configured" }, 500, env, {}, request);
  }

  try {
    const payload = await request.json();
    const html = String(payload.html || "");

    if (!isPublishableHtml(html)) {
      return jsonResponse({ error: "A complete HTML document is required" }, 400, env, {}, request);
    }

    const bytes = byteLength(html);
    const maxBytes = readPositiveNumber(env.DEMO_MAX_HTML_BYTES, DEFAULT_MAX_HTML_BYTES);

    if (bytes > maxBytes) {
      return jsonResponse({ error: "Demo publish payload is too large" }, 413, env, {}, request);
    }

    const business = normalizeBusinessMeta(payload.business || payload);
    const ttlHours = readPositiveNumber(payload.ttlHours || env.DEMO_TTL_HOURS, DEFAULT_TTL_HOURS);
    const ttlSeconds = Math.max(60, Math.round(ttlHours * 60 * 60));
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + ttlSeconds * 1000);
    const id = createDemoId(business.slug || business.name || "demo");
    const demoPath = `/demos/${id}/`;
    const demoUrl = new URL(demoPath, url.origin).toString();
    const metadata = {
      id,
      name: business.name,
      slug: business.slug,
      businessId: business.id,
      category: business.category,
      location: business.location,
      source: "cloudflare-kv",
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      bytes
    };

    await Promise.all([
      env.DEMOS.put(htmlKey(id), html, { expirationTtl: ttlSeconds }),
      env.DEMOS.put(metaKey(id), JSON.stringify(metadata), { expirationTtl: ttlSeconds })
    ]);

    return jsonResponse({
      demo: {
        ...metadata,
        path: demoPath,
        url: demoUrl,
        publicBaseUrl: url.origin,
        shareable: true,
        shareStatus: "public-https",
        shareMessage: "Demo stored on Cloudflare Workers KV with automatic expiration."
      },
      publishedUrl: demoUrl,
      warnings: []
    }, 201, env, {}, request);
  } catch (error) {
    return jsonResponse({ error: "Invalid demo publish request" }, 400, env, {}, request);
  }
}

async function handleDemoRequest(request, env, url) {
  if (!["GET", "HEAD"].includes(request.method)) {
    return textResponse("Method not allowed", 405, env, { Allow: "GET, HEAD" }, request);
  }

  if (!env.DEMOS) {
    return textResponse("Demo storage unavailable", 500, env, {}, request);
  }

  let segments;

  try {
    segments = url.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  } catch (error) {
    return textResponse("Bad request", 400, env, {}, request);
  }

  const demoId = segments[1] || "";
  const rest = segments.slice(2).join("/");

  if (segments[0] !== "demos" || !SAFE_DEMO_ID.test(demoId) || (rest && rest !== "index.html")) {
    return textResponse("Demo not found", 404, env, {}, request);
  }

  const [html, metadata] = await Promise.all([
    env.DEMOS.get(htmlKey(demoId)),
    env.DEMOS.get(metaKey(demoId), { type: "json" })
  ]);

  if (!html) {
    return textResponse("Demo not found or expired", 404, env, {}, request);
  }

  if (isExpired(metadata)) {
    await Promise.all([
      env.DEMOS.delete(htmlKey(demoId)),
      env.DEMOS.delete(metaKey(demoId))
    ]);
    return textResponse("Demo expired", 410, env, {}, request);
  }

  return new Response(request.method === "HEAD" ? null : html, {
    status: 200,
    headers: {
      ...securityHeaders(),
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow"
    }
  });
}

function isAuthorized(request, env) {
  const expected = cleanText(env.DEMO_PUBLISH_TOKEN || env.PUBLISH_TOKEN || "", 500);

  if (!expected) {
    return false;
  }

  const authorization = request.headers.get("Authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const header = request.headers.get("X-DLS-Publish-Token") || request.headers.get("X-LocalLift-Publish-Token") || "";
  return [bearer, header].some((value) => cleanText(value, 500) === expected);
}

function isPublishableHtml(html) {
  const normalized = html.trim().toLowerCase();
  return html.length >= 80 && normalized.includes("<!doctype html") && normalized.includes("<html");
}

function normalizeBusinessMeta(source) {
  return {
    id: cleanText(source.id || source.businessId || "", 120),
    slug: slugify(source.slug || source.handle || source.name || ""),
    name: cleanText(source.name || source.businessName || "Demo temporal", 180),
    category: cleanText(source.category || source.sector || "", 120),
    location: cleanText(source.location || source.city || source.address || "", 180)
  };
}

function htmlKey(id) {
  return `demo:${id}:html`;
}

function metaKey(id) {
  return `demo:${id}:meta`;
}

function createDemoId(value) {
  const base = slugify(value) || "demo";
  return `${base.slice(0, 70)}-${Date.now().toString(36)}-${randomHex(6)}`;
}

function randomHex(size) {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isExpired(metadata) {
  const expiresAt = new Date(metadata?.expiresAt || "");
  return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now();
}

function readPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function byteLength(value) {
  return new TextEncoder().encode(String(value || "")).byteLength;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function cleanText(value, maxLength = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function jsonResponse(payload, status, env, extraHeaders = {}, request = null) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      ...securityHeaders(),
      ...corsHeaders(request, env),
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

function textResponse(message, status, env, extraHeaders = {}, request = null) {
  return new Response(message, {
    status,
    headers: {
      ...securityHeaders(),
      ...corsHeaders(request, env),
      "Content-Type": "text/plain; charset=utf-8",
      ...extraHeaders
    }
  });
}

function emptyResponse(status, headers = {}) {
  return new Response(null, {
    status,
    headers: {
      ...securityHeaders(),
      ...headers
    }
  });
}

function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Security-Policy": [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: http: https:",
      "font-src 'self' data:",
      "connect-src 'self' http: https:",
      "media-src 'self' data: blob: http: https:",
      "frame-src 'self' https://www.google.com https://maps.google.com https://www.youtube.com https://youtube.com",
      "worker-src 'self' blob:"
    ].join("; "),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Strict-Transport-Security": "max-age=15552000; includeSubDomains"
  };
}

function corsHeaders(request, env) {
  const origins = cleanText(env.CORS_ORIGIN || "", 1000)
    .split(",")
    .map((origin) => cleanText(origin, 300))
    .filter((origin) => origin && origin !== "*");
  const requestOrigin = cleanText(request?.headers?.get?.("Origin") || "", 300);
  const allowOrigin = requestOrigin
    ? origins.find((origin) => origin === requestOrigin)
    : origins[0];

  return cleanHeaders({
    "Access-Control-Allow-Origin": allowOrigin || null,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-DLS-Publish-Token, X-LocalLift-Publish-Token",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  });
}

function cleanHeaders(headers) {
  return Object.fromEntries(
    Object.entries(headers).filter(([, value]) => value !== null && value !== undefined && value !== "")
  );
}
