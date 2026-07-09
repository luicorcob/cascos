import { corsHeaders } from "./cors.mjs";

const JSON_BODY_METHODS = new Set(["POST", "PUT", "PATCH"]);
const DEFAULT_MAX_API_BODY_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_API_URL_BYTES = 8192;

export function requireApiRequestGuards(request, response, context, pathname) {
  if (!String(pathname || "").startsWith("/api/")) {
    return true;
  }

  const method = String(request.method || "GET").toUpperCase();

  if (method === "OPTIONS") {
    return true;
  }

  if (method === "TRACE") {
    sendJsonError(response, 405, "Method not allowed", context, {
      code: "method_not_allowed",
      Allow: "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS"
    });
    return false;
  }

  if (Buffer.byteLength(String(request.url || ""), "utf8") > maxUrlBytes()) {
    sendJsonError(response, 414, "Request URL is too long", context, {
      code: "url_too_long"
    });
    return false;
  }

  const declaredLength = readContentLength(request);
  if (declaredLength > maxBodyBytes()) {
    sendJsonError(response, 413, "Request body is too large", context, {
      code: "body_too_large"
    });
    return false;
  }

  if (JSON_BODY_METHODS.has(method) && expectsJsonBody(pathname)) {
    const contentType = String(request.headers["content-type"] || "").toLowerCase();

    if (!contentType.includes("application/json")) {
      sendJsonError(response, 415, "Content-Type must be application/json", context, {
        code: "unsupported_media_type"
      });
      return false;
    }
  }

  return true;
}

function expectsJsonBody(pathname) {
  return String(pathname || "").startsWith("/api/");
}

function readContentLength(request) {
  const raw = String(request.headers["content-length"] || "").trim();

  if (!raw) {
    return 0;
  }

  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function maxBodyBytes() {
  return readPositiveInteger("API_MAX_BODY_BYTES", DEFAULT_MAX_API_BODY_BYTES);
}

function maxUrlBytes() {
  return readPositiveInteger("API_MAX_URL_BYTES", DEFAULT_MAX_API_URL_BYTES);
}

function readPositiveInteger(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function sendJsonError(response, status, message, context, extra = {}) {
  const { code, ...extraHeaders } = extra;
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  response.end(JSON.stringify({
    error: message,
    code: code || "request_rejected"
  }, null, 2));
}
