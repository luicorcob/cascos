import { corsHeaders } from "../lib/cors.mjs";

const UNSPLASH_ENDPOINT = "https://api.unsplash.com/search/photos";
const WIKIMEDIA_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_BODY_BYTES = 16 * 1024;
const cache = new Map();

export function isStockImageApiRequest(pathname) {
  return pathname === "/api/stock-images" || pathname === "/api/stock-images/download";
}

export async function handleStockImageApi(request, response, context) {
  const method = request.method || "GET";
  const requestUrl = new URL(request.url || "/", "http://localhost");

  if (method === "OPTIONS") {
    response.writeHead(204, { ...context.baseHeaders, ...corsHeaders(context), Allow: "GET, POST, OPTIONS" });
    response.end();
    return;
  }

  if (requestUrl.pathname === "/api/stock-images/download") {
    await handleStockImageDownload(request, response, context);
    return;
  }

  if (method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "GET, OPTIONS" });
    return;
  }

  const query = String(requestUrl.searchParams.get("q") || "").trim().slice(0, 100);
  const page = clampInteger(requestUrl.searchParams.get("page"), 1, 5, 1);
  const pageSize = clampInteger(requestUrl.searchParams.get("page_size"), 6, 48, 24);

  if (query.length < 2) {
    sendJson(response, 400, { error: "A search query is required" }, context);
    return;
  }

  const key = `${stockProviderCacheKey(process.env)}:${query.toLowerCase()}:${page}:${pageSize}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    sendJson(response, 200, cached.payload, context, { "X-Stock-Cache": "HIT" });
    return;
  }

  try {
    const { payload, provider } = await fetchStockPayload(query, page, pageSize, process.env);
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

async function handleStockImageDownload(request, response, context) {
  if (request.method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "POST, OPTIONS" });
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const downloadLocation = firstHttp(payload.downloadLocation, payload.download_location);
    const accessKey = cleanText(process.env.UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_API_KEY, 500);

    if (!accessKey) {
      sendJson(response, 400, { error: "UNSPLASH_ACCESS_KEY is required" }, context);
      return;
    }

    if (!isUnsplashDownloadLocation(downloadLocation)) {
      sendJson(response, 400, { error: "A valid Unsplash download_location is required" }, context);
      return;
    }

    const result = await fetchJson(new URL(downloadLocation), {
      Accept: "application/json",
      "Accept-Version": "v1",
      Authorization: `Client-ID ${accessKey}`
    });

    sendJson(response, 200, { ok: true, url: firstHttp(result?.url) }, context);
  } catch (error) {
    sendJson(response, error.statusCode || 502, {
      error: error.message || "Could not track Unsplash download",
      code: "stock_download_tracking_failed"
    }, context);
  }
}

async function fetchStockPayload(query, page, pageSize, env = process.env) {
  const providers = [];
  const unsplashKey = cleanText(env?.UNSPLASH_ACCESS_KEY || env?.UNSPLASH_API_KEY, 500);

  if (unsplashKey) {
    providers.push({
      id: "unsplash",
      search: () => fetchUnsplash(query, page, pageSize, unsplashKey)
    });
  }

  providers.push({
    id: "wikimedia-commons",
    search: () => fetchWikimedia(query, page, pageSize)
  });

  let emptyResult = null;
  let lastError = null;

  for (const provider of providers) {
    try {
      const payload = await provider.search();
      const hasResults = Array.isArray(payload.results) && payload.results.length > 0;

      if (hasResults) {
        return { payload, provider: provider.id };
      }

      emptyResult ||= { payload, provider: provider.id };
    } catch (error) {
      lastError = error;
    }
  }

  if (emptyResult) {
    return emptyResult;
  }

  throw lastError || new Error("No stock image provider available");
}

async function fetchUnsplash(query, page, pageSize, accessKey) {
  const perPage = Math.max(6, Math.min(30, pageSize));
  const endpoint = new URL(UNSPLASH_ENDPOINT);
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("page", String(page));
  endpoint.searchParams.set("per_page", String(perPage));
  endpoint.searchParams.set("content_filter", "high");
  endpoint.searchParams.set("order_by", "relevant");

  const payload = await fetchJson(endpoint, {
    Accept: "application/json",
    "Accept-Version": "v1",
    Authorization: `Client-ID ${accessKey}`
  });
  const results = Array.isArray(payload.results) ? payload.results.map((photo) => normalizeUnsplashItem(photo, query)).filter(Boolean) : [];
  const total = Math.max(results.length, Number(payload.total || 0));

  return {
    result_count: total,
    next: page * perPage < total ? "next" : null,
    results
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

function normalizeUnsplashItem(photo, query) {
  const raw = firstHttp(photo.urls?.raw, photo.urls?.full, photo.urls?.regular);
  const regular = firstHttp(photo.urls?.regular, photo.urls?.full, raw);
  const thumbnail = firstHttp(photo.urls?.small, photo.urls?.thumb, regular);

  if (!regular || !thumbnail) {
    return null;
  }

  const title = cleanText(photo.alt_description || photo.description || "Foto para negocio local", 160);
  const creator = cleanText(photo.user?.name, 100);
  const sourceUrl = addUnsplashUtm(firstHttp(photo.links?.html, photo.user?.links?.html, "https://unsplash.com"));
  const tags = normalizeUnsplashTags(photo, query);

  return {
    id: `unsplash-${cleanText(photo.id, 120) || regular}`,
    title,
    creator,
    provider: "Unsplash",
    license: "Unsplash License",
    url: regular,
    thumbnail,
    foreign_landing_url: sourceUrl,
    detail_url: sourceUrl,
    tags,
    width: Number(photo.width || 0),
    height: Number(photo.height || 0),
    download_location: firstHttp(photo.links?.download_location)
  };
}

function normalizeUnsplashTags(photo, query) {
  const tags = Array.isArray(photo.tags) ? photo.tags : [];
  const providerTags = tags
    .map((tag) => cleanText(tag?.title || tag?.source?.title || tag, 60))
    .filter(Boolean)
    .slice(0, 20);
  return [query, ...providerTags]
    .map((name) => cleanText(name, 80))
    .filter(Boolean)
    .map((name) => ({ name }));
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

function firstHttp(...values) {
  return values
    .map((value) => cleanText(value, 1000))
    .find((value) => /^https?:\/\/\S+$/i.test(value)) || "";
}

function isUnsplashDownloadLocation(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && url.hostname === "api.unsplash.com"
      && /^\/photos\/[^/]+\/download$/i.test(url.pathname);
  } catch (error) {
    return false;
  }
}

function addUnsplashUtm(value) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    if (/(\.|^)unsplash\.com$/i.test(url.hostname)) {
      url.searchParams.set("utm_source", "DLS Studio");
      url.searchParams.set("utm_medium", "referral");
    }
    return url.toString();
  } catch (error) {
    return value;
  }
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
  } catch (error) {
    throw httpError(400, "Invalid JSON body");
  }
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function cleanText(value, maxLength = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function stockProviderCacheKey(env) {
  return cleanText(env?.UNSPLASH_ACCESS_KEY || env?.UNSPLASH_API_KEY) ? "unsplash" : "wikimedia";
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
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
