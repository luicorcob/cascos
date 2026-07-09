import { randomUUID } from "node:crypto";

const LEVELS = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

const SENSITIVE_KEY_PATTERN = /authorization|cookie|password|passwd|secret|token|api[_-]?key|access[_-]?key|refresh[_-]?token|session|credential/i;
const REDACTED = "[REDACTED]";
const authFailureBuckets = new Map();

export function createRequestLogContext(request, requestUrl, now = Date.now()) {
  return {
    requestId: getRequestId(request),
    startedAt: now,
    method: String(request.method || "GET").toUpperCase(),
    path: sanitizePath(requestUrl?.pathname || "/"),
    ip: getClientAddress(request),
    userAgent: truncate(String(request.headers["user-agent"] || ""), 180),
    origin: sanitizeOrigin(request.headers.origin || "")
  };
}

export function attachAccessLogger(request, response, requestContext) {
  if (String(process.env.ACCESS_LOGS || "true").toLowerCase() === "false") {
    return;
  }

  let logged = false;
  const log = (event = "access") => {
    if (logged) {
      return;
    }

    logged = true;
    const durationMs = Math.max(0, Date.now() - Number(requestContext?.startedAt || Date.now()));
    const statusCode = Number(response.statusCode || 0) || 0;
    const level = event === "request_aborted" || statusCode >= 500 ? "warn" : "info";

    writeLog(level, event, {
      request: requestFields(requestContext),
      statusCode,
      durationMs
    });
  };

  response.on("finish", () => log("access"));
  response.on("close", () => {
    if (!response.writableEnded) {
      log("request_aborted");
    }
  });
}

export function logInfo(event, fields = {}) {
  writeLog("info", event, fields);
}

export function logWarn(event, fields = {}) {
  writeLog("warn", event, fields);
}

export function logError(error, fields = {}) {
  const statusCode = Number(error?.statusCode || error?.status || 0) || undefined;
  writeLog("error", "error", {
    ...fields,
    error: {
      name: error?.name || "Error",
      message: error?.message || "Unknown error",
      code: error?.code || undefined,
      statusCode,
      stack: String(process.env.LOG_STACKS || "true").toLowerCase() === "false"
        ? undefined
        : error?.stack
    }
  });
}

export function recordAuthFailure(request, reason, context = {}, details = {}) {
  const requestContext = context.requestLog || makeFallbackRequestContext(request, details.route);
  const route = sanitizePath(details.route || requestContext.path || "/");
  const now = Date.now();
  const windowMs = readPositiveInteger("AUTH_FAILURE_ALERT_WINDOW_MS", 10 * 60 * 1000);
  const threshold = readPositiveInteger("AUTH_FAILURE_ALERT_THRESHOLD", 5);
  const key = `${route}:${requestContext.ip}:${reason}`;
  const current = authFailureBuckets.get(key);
  const bucket = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : current;

  bucket.count += 1;
  authFailureBuckets.set(key, bucket);

  const payload = {
    reason,
    request: {
      ...requestFields(requestContext),
      path: route
    },
    count: bucket.count,
    threshold,
    windowMs,
    details: omitUndefined({
      authProvided: details.hasProvidedToken,
      clientRole: details.clientSessionRole,
      statusCode: details.statusCode
    })
  };

  logWarn("auth_failure", payload);

  if (bucket.count >= threshold && (bucket.count === threshold || bucket.count % threshold === 0)) {
    logWarn("auth_failure_alert", {
      ...payload,
      severity: "high",
      message: `Repeated authentication failures for ${route}`
    });
  }
}

export function clearAuthFailures(request, context = {}, details = {}) {
  const requestContext = context.requestLog || makeFallbackRequestContext(request, details.route);
  const route = sanitizePath(details.route || requestContext.path || "/");
  const prefix = `${route}:${requestContext.ip}:`;

  for (const key of authFailureBuckets.keys()) {
    if (key.startsWith(prefix)) {
      authFailureBuckets.delete(key);
    }
  }
}

export function redactForLog(value) {
  return redactValue(value);
}

export function __resetAuthFailureTrackerForTests() {
  authFailureBuckets.clear();
}

function writeLog(level, event, fields = {}) {
  if (!shouldLog(level)) {
    return;
  }

  const entry = omitUndefined({
    ts: new Date().toISOString(),
    level,
    event,
    ...redactValue(fields)
  });
  const line = JSON.stringify(entry);

  if (level === "error" || level === "warn") {
    console.error(line);
    return;
  }

  console.log(line);
}

function shouldLog(level) {
  const configured = String(process.env.LOG_LEVEL || "info").toLowerCase();
  const current = LEVELS[configured] || LEVELS.info;
  return (LEVELS[level] || LEVELS.info) >= current;
}

function getRequestId(request) {
  const provided = String(request.headers["x-request-id"] || request.headers["x-correlation-id"] || "").trim();

  if (/^[a-zA-Z0-9._:-]{1,100}$/.test(provided)) {
    return provided;
  }

  return randomUUID();
}

function makeFallbackRequestContext(request, route = "") {
  return {
    requestId: getRequestId(request),
    startedAt: Date.now(),
    method: String(request.method || "GET").toUpperCase(),
    path: sanitizePath(route || String(request.url || "/").split("?")[0] || "/"),
    ip: getClientAddress(request),
    userAgent: truncate(String(request.headers["user-agent"] || ""), 180),
    origin: sanitizeOrigin(request.headers.origin || "")
  };
}

function requestFields(requestContext = {}) {
  return omitUndefined({
    id: requestContext.requestId,
    method: requestContext.method,
    path: requestContext.path,
    ip: requestContext.ip,
    userAgent: requestContext.userAgent || undefined,
    origin: requestContext.origin || undefined
  });
}

function getClientAddress(request) {
  const forwarded = String(request.headers["x-forwarded-for"] || "")
    .split(",")
    .map((value) => value.trim())
    .find(Boolean);
  return truncate(forwarded || request.socket?.remoteAddress || "unknown", 80);
}

function sanitizePath(pathname) {
  const raw = String(pathname || "/").split("?")[0] || "/";
  return raw.length > 240 ? `${raw.slice(0, 240)}...` : raw;
}

function sanitizeOrigin(origin) {
  const value = String(origin || "").trim();

  if (!value) {
    return "";
  }

  try {
    return new URL(value).origin;
  } catch {
    return truncate(value, 160);
  }
}

function redactValue(value, key = "") {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (typeof value === "object") {
    const output = {};

    for (const [entryKey, entryValue] of Object.entries(value)) {
      output[entryKey] = SENSITIVE_KEY_PATTERN.test(entryKey)
        ? REDACTED
        : redactValue(entryValue, entryKey);
    }

    return omitUndefined(output);
  }

  return String(value);
}

function redactString(value) {
  return String(value)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]")
    .replace(/\b(password|passwd|token|secret|api[_-]?key|access[_-]?key|refresh[_-]?token|key)=([^&\s]+)/gi, "$1=[REDACTED]");
}

function omitUndefined(value) {
  const output = {};

  for (const [key, entryValue] of Object.entries(value || {})) {
    if (entryValue !== undefined) {
      output[key] = entryValue;
    }
  }

  return output;
}

function truncate(value, maxLength) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

function readPositiveInteger(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}
