import { corsHeaders } from "../lib/cors.mjs";

const WIKIMEDIA_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map();

export function isStockImageApiRequest(pathname) {
  return pathname === "/api/stock-images";
}

export async function handleStockImageApi(request, response, context) {
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    response.writeHead(204, { ...context.baseHeaders, ...corsHeaders(context) });
    response.end();
    return;
  }

  if (method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "GET, OPTIONS" });
    return;
  }

  const requestUrl = new URL(request.url || "/", "http://localhost");
  const query = String(requestUrl.searchParams.get("q") || "").trim().slice(0, 100);
  const page = clampInteger(requestUrl.searchParams.get("page"), 1, 5, 1);
  const pageSize = clampInteger(requestUrl.searchParams.get("page_size"), 6, 48, 24);

  if (query.length < 2) {
    sendJson(response, 400, { error: "A search query is required" }, context);
    return;
  }

  const key = `${query.toLowerCase()}:${page}:${pageSize}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    sendJson(response, 200, cached.payload, context, { "X-Stock-Cache": "HIT" });
    return;
  }

  try {
    const { payload, provider } = await fetchStockPayload(query, page, pageSize);
    cache.set(key, { payload, expiresAt: Date.now() + CACHE_TTL_MS });
    pruneCache();
    sendJson(response, 200, payload, context, {
      "X-Stock-Cache": "MISS",
      "X-Stock-Provider": provider
    });
  } catch (error) {
    sendJson(response, 502, {
      error: "The external image provider is temporarily unavailable",
      code: "stock_provider_unavailable"
    }, context);
  }
}

async function fetchStockPayload(query, page, pageSize) {
  return {
    payload: await fetchWikimedia(query, page, pageSize),
    provider: "wikimedia-commons"
  };
}

async function fetchWikimedia(query, page, pageSize) {
  const limit = Math.min(50, Math.max(24, pageSize * 2));
  const endpoint = new URL(WIKIMEDIA_ENDPOINT);
  endpoint.searchParams.set("action", "query");
  endpoint.searchParams.set("generator", "search");
  endpoint.searchParams.set("gsrsearch", `${query} filetype:bitmap`);
  endpoint.searchParams.set("gsrnamespace", "6");
  endpoint.searchParams.set("gsrlimit", String(limit));
  endpoint.searchParams.set("gsroffset", String((page - 1) * limit));
  endpoint.searchParams.set("prop", "imageinfo");
  endpoint.searchParams.set("iiprop", "url|extmetadata");
  endpoint.searchParams.set("iiurlwidth", "1200");
  endpoint.searchParams.set("format", "json");
  endpoint.searchParams.set("formatversion", "2");
  const payload = await fetchJson(endpoint, {
    Accept: "application/json",
    "User-Agent": "DLS-Studio/1.0 image-catalog"
  });
  const pages = Array.isArray(payload.query?.pages) ? payload.query.pages : [];
  const results = pages.map((item) => normalizeWikimediaItem(item, query)).filter(Boolean);

  return {
    result_count: results.length,
    next: payload.continue ? "next" : null,
    results
  };
}

function normalizeWikimediaItem(item, query) {
  const info = item.imageinfo?.[0];
  const metadata = info?.extmetadata || {};
  const license = stripHtml(metadata.LicenseShortName?.value || metadata.UsageTerms?.value);
  const url = String(info?.thumburl || info?.url || "");
  const thumbnail = String(info?.thumburl || info?.url || "");
  const categories = stripHtml(metadata.Categories?.value).split("|").filter(Boolean);

  if (!/^https:\/\//i.test(url) || !/\.(?:jpe?g|png|webp)(?:$|\?)/i.test(url)) {
    return null;
  }
  if (!/(?:CC0|CC BY|CC-BY|PUBLIC DOMAIN)/i.test(license)) {
    return null;
  }

  return {
    id: `commons-${item.pageid}`,
    title: stripHtml(metadata.ImageDescription?.value || metadata.ObjectName?.value || item.title).replace(/^File:/i, "").slice(0, 160),
    creator: stripHtml(metadata.Artist?.value).slice(0, 100),
    provider: "Wikimedia Commons",
    license,
    url,
    thumbnail,
    foreign_landing_url: info.descriptionurl || info.descriptionshorturl || "https://commons.wikimedia.org",
    tags: categories.map((name) => ({ name }))
  };
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchJson(endpoint, headers) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  let response;
  try {
    response = await fetch(endpoint, { headers, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Image provider responded ${response.status}`);
  }
  return response.json();
}

function sendJson(response, status, payload, context, extraHeaders = {}) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    ...extraHeaders,
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function pruneCache() {
  if (cache.size <= 300) {
    return;
  }
  const now = Date.now();
  cache.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  });
}
