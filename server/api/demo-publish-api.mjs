import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { corsHeaders } from "../lib/cors.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import { applyPublishedDemoAutomation } from "../lib/crm-automation.mjs";

const DEFAULT_MAX_BODY_BYTES = 14 * 1024 * 1024;
const DEFAULT_TTL_HOURS = 7 * 24;
const SAFE_DEMO_ID = /^[a-z0-9][a-z0-9_-]{2,140}$/;

export function isDemoPublishApiRequest(pathname) {
  return pathname === "/api/demo-publish" || pathname === "/demos" || pathname.startsWith("/demos/");
}

export async function handleDemoPublishApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://locallift.local");

  if (requestUrl.pathname === "/api/demo-publish") {
    await handlePublishRequest(request, response, context);
    return;
  }

  await handleDemoPageRequest(request, response, context, requestUrl);
}

async function handlePublishRequest(request, response, context) {
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context, "POST, OPTIONS");
    return;
  }

  if (method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "POST, OPTIONS" });
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const html = String(payload.html || "");

    if (!isPublishableHtml(html)) {
      throw httpError(400, "A complete HTML document is required");
    }

    const business = normalizeBusinessMeta(payload.business || payload);
    const automationLink = readExplicitAutomationLink(payload);
    const createdAt = new Date();
    const ttlHours = readPositiveNumber(process.env.DEMO_PUBLISH_TTL_HOURS || process.env.DLS_DEMO_PUBLISH_TTL_HOURS, DEFAULT_TTL_HOURS);
    const remotePublisher = getRemotePublisherConfig();

    if (remotePublisher.endpoint) {
      const remotePayload = await publishRemoteDemo(remotePublisher, {
        html,
        business,
        ttlHours
      });
      const automation = await applyDemoPublishAutomation(automationLink, remotePayload, context);
      sendJson(response, 201, { ...remotePayload, automation }, context);
      return;
    }

    const expiresAt = new Date(createdAt.getTime() + ttlHours * 60 * 60 * 1000);
    const id = createDemoId(business.slug || business.name || "demo");
    const publishRoot = getPublishRoot(context.root);
    const demoDir = path.join(publishRoot, id);
    const metadata = {
      id,
      name: business.name,
      slug: business.slug,
      businessId: business.id,
      category: business.category,
      location: business.location,
      source: "studio",
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      bytes: Buffer.byteLength(html, "utf8")
    };

    await mkdir(demoDir, { recursive: true });
    await Promise.all([
      writeFile(path.join(demoDir, "index.html"), html, "utf8"),
      writeFile(path.join(demoDir, "meta.json"), JSON.stringify(metadata, null, 2), "utf8")
    ]);
    cleanupExpiredPublishes(context).catch(() => {});

    const demoPath = `/demos/${id}/`;
    const publicOrigin = getPublicOrigin(request);
    const demoUrl = new URL(demoPath, publicOrigin).toString();
    const shareability = describeDemoShareability(demoUrl);

    const publishPayload = {
      demo: {
        ...metadata,
        path: demoPath,
        url: demoUrl,
        publicBaseUrl: publicOrigin,
        shareable: shareability.shareable,
        shareStatus: shareability.status,
        shareMessage: shareability.message
      },
      publishedUrl: demoUrl,
      warnings: shareability.shareable ? [] : [shareability.message]
    };
    const automation = await applyDemoPublishAutomation(automationLink, publishPayload, context);

    sendJson(response, 201, { ...publishPayload, automation }, context);
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status >= 500 ? "Internal demo publish API error" : error.message;
    sendJson(response, status, { error: message }, context);
  }
}

async function applyDemoPublishAutomation(link, publishPayload, context) {
  if (!link.businessRef || !link.contactId) {
    return skippedAutomation("explicit-contact-link-required");
  }

  try {
    const dependencies = context?.demoPublishAutomation || {};
    const loadStore = typeof dependencies.loadBusinessStore === "function"
      ? dependencies.loadBusinessStore
      : loadBusinessStore;
    const saveStore = typeof dependencies.saveBusinessStore === "function"
      ? dependencies.saveBusinessStore
      : saveBusinessStore;
    const db = await loadStore(context);
    const business = db.businesses.find((item) => (
      cleanText(item?.id, 120) === link.businessRef
        || cleanText(item?.slug, 120) === link.businessRef
    ));

    if (!business) {
      return skippedAutomation("business-not-found");
    }

    const result = applyPublishedDemoAutomation(db, {
      businessId: cleanText(business.id || business.slug, 120),
      contactId: link.contactId,
      demo: publishPayload?.demo || {}
    });

    if (result.applied) {
      await saveStore(db, context, "published-demo-automation");
    }

    return result;
  } catch (error) {
    return skippedAutomation("automation-unavailable");
  }
}

function readExplicitAutomationLink(payload) {
  const source = isPlainObject(payload) ? payload : {};
  const business = isPlainObject(source.business) ? source.business : source;
  const contactReference = source.contactId ?? source.contact
    ?? business.contactId ?? business.contact;
  const contactId = cleanExplicitReference(contactReference);
  const businessRef = cleanText(
    source.businessId || source.businessSlug
      || business.businessId || business.id || business.slug,
    120
  );

  return { businessRef, contactId };
}

function cleanExplicitReference(value) {
  if (isPlainObject(value)) {
    return cleanText(value.id || value.contactId || "", 120);
  }

  return (typeof value === "string" || typeof value === "number")
    ? cleanText(value, 120)
    : "";
}

function skippedAutomation(reason) {
  return {
    rule: "published-demo-follow-up",
    applied: false,
    reason,
    contactId: "",
    nextAction: null,
    activity: null
  };
}

async function publishRemoteDemo(remotePublisher, payload) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json"
  };

  if (remotePublisher.token) {
    headers.Authorization = `Bearer ${remotePublisher.token}`;
    headers["X-DLS-Publish-Token"] = remotePublisher.token;
  }

  let response;

  try {
    response = await fetch(remotePublisher.endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw httpError(502, "Remote demo publisher is not reachable");
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw httpError(response.status >= 500 ? 502 : response.status, result.error || "Remote demo publisher rejected the demo");
  }

  if (!result?.demo?.url) {
    throw httpError(502, "Remote demo publisher did not return a demo URL");
  }

  return result;
}

async function handleDemoPageRequest(request, response, context, requestUrl) {
  const method = request.method || "GET";

  if (!["GET", "HEAD"].includes(method)) {
    sendText(response, 405, "Method not allowed", context, { Allow: "GET, HEAD" });
    return;
  }

  let segments;

  try {
    segments = requestUrl.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  } catch (error) {
    sendText(response, 400, "Bad request", context);
    return;
  }

  const demoId = segments[1] || "";
  const rest = segments.slice(2).join("/");

  if (segments[0] !== "demos" || !SAFE_DEMO_ID.test(demoId) || (rest && rest !== "index.html")) {
    sendText(response, 404, "Demo not found", context);
    return;
  }

  const demoDir = path.join(getPublishRoot(context.root), demoId);

  try {
    const metadata = JSON.parse(await readFile(path.join(demoDir, "meta.json"), "utf8"));

    if (isExpired(metadata)) {
      await rm(demoDir, { recursive: true, force: true });
      sendText(response, 410, "Demo expired", context);
      return;
    }

    const html = await readFile(path.join(demoDir, "index.html"));
    response.writeHead(200, {
      ...context.baseHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow"
    });
    response.end(method === "HEAD" ? undefined : html);
  } catch (error) {
    sendText(response, 404, "Demo not found", context);
  }
}

async function cleanupExpiredPublishes(context) {
  const publishRoot = getPublishRoot(context.root);
  let entries = [];

  try {
    entries = await readdir(publishRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && SAFE_DEMO_ID.test(entry.name))
    .map(async (entry) => {
      const demoDir = path.join(publishRoot, entry.name);

      try {
        const metadata = JSON.parse(await readFile(path.join(demoDir, "meta.json"), "utf8"));

        if (isExpired(metadata)) {
          await rm(demoDir, { recursive: true, force: true });
        }
      } catch (error) {
        // Keep unknown folders untouched; only well-formed expired publishes are removed.
      }
    }));
}

async function readJsonBody(request) {
  const maxBytes = readPositiveNumber(process.env.DEMO_PUBLISH_MAX_BODY_BYTES || process.env.DLS_DEMO_PUBLISH_MAX_BODY_BYTES, DEFAULT_MAX_BODY_BYTES);
  let size = 0;
  let raw = "";

  for await (const chunk of request) {
    size += chunk.length;

    if (size > maxBytes) {
      throw httpError(413, "Demo publish payload is too large");
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

function getPublishRoot(root) {
  const configured = cleanText(process.env.DEMO_PUBLISH_DIR || process.env.DLS_DEMO_PUBLISH_DIR || "", 500);
  return configured ? path.resolve(root, configured) : path.join(root, "data", "demo-publishes");
}

function getPublicOrigin(request) {
  const configured = getConfiguredPublicOrigin();

  if (configured) {
    return configured;
  }

  const protocol = firstHeader(request.headers["x-forwarded-proto"]) || (request.socket?.encrypted ? "https" : "http");
  const host = firstHeader(request.headers["x-forwarded-host"]) || firstHeader(request.headers.host) || "127.0.0.1:5173";
  return `${protocol}://${host}`;
}

function getConfiguredPublicOrigin() {
  const configured = cleanText(process.env.DEMO_PUBLIC_BASE_URL || process.env.PUBLIC_BASE_URL || process.env.LOCALLIFT_PUBLIC_BASE_URL || "", 500);
  return configured ? configured.replace(/\/+$/, "") : "";
}

function getRemotePublisherConfig() {
  const raw = cleanText(process.env.DEMO_REMOTE_PUBLISH_URL || process.env.DLS_DEMO_REMOTE_PUBLISH_URL || "", 500);

  if (!raw) {
    return { endpoint: "", token: "" };
  }

  let endpoint;

  try {
    const parsed = new URL(raw);

    if (!/\/api\/demo-publish\/?$/i.test(parsed.pathname)) {
      parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/api/demo-publish`;
    }

    parsed.search = "";
    parsed.hash = "";
    endpoint = parsed.toString();
  } catch (error) {
    return { endpoint: "", token: "" };
  }

  return {
    endpoint,
    token: cleanText(process.env.DEMO_REMOTE_PUBLISH_TOKEN || process.env.DLS_DEMO_REMOTE_PUBLISH_TOKEN || "", 500)
  };
}

function describeDemoShareability(url) {
  let parsed;

  try {
    parsed = new URL(url);
  } catch (error) {
    return {
      shareable: false,
      status: "invalid-url",
      message: "The demo URL could not be validated."
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (isLocalHostname(hostname)) {
    return {
      shareable: false,
      status: "local-machine",
      message: "This demo URL points to the local machine. Publish from a public HTTPS backend or configure DEMO_PUBLIC_BASE_URL before sending it to a phone or client."
    };
  }

  if (isPrivateNetworkHostname(hostname)) {
    return {
      shareable: false,
      status: "local-network",
      message: "This demo URL is only reachable from the current local network. Use a public HTTPS domain before sending it to a client."
    };
  }

  return {
    shareable: true,
    status: parsed.protocol === "https:" ? "public-https" : "public",
    message: "Demo URL is public enough to share."
  };
}

function isLocalHostname(hostname) {
  return hostname === "localhost"
    || hostname === "0.0.0.0"
    || hostname === "::1"
    || hostname === "[::1]"
    || hostname.startsWith("127.");
}

function isPrivateNetworkHostname(hostname) {
  const parts = hostname.split(".").map((part) => Number(part));

  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    return parts[0] === 10
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || (parts[0] === 169 && parts[1] === 254);
  }

  return hostname.endsWith(".local") || hostname.endsWith(".lan");
}

function firstHeader(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return cleanText(String(raw || "").split(",")[0] || "", 300);
}

function createDemoId(value) {
  const base = slugify(value) || "demo";
  return `${base.slice(0, 70)}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

function isExpired(metadata) {
  const expiresAt = new Date(metadata?.expiresAt || "");
  return Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() <= Date.now();
}

function readPositiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
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

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sendJson(response, status, payload, context, extraHeaders = {}) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendText(response, status, message, context, extraHeaders = {}) {
  response.writeHead(status, {
    ...context.baseHeaders,
    "Content-Type": "text/plain; charset=utf-8",
    ...extraHeaders
  });
  response.end(message);
}

function sendEmpty(response, status, context, allow) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    Allow: allow
  });
  response.end();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
