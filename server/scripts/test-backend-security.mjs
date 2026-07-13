import assert from "node:assert/strict";

process.env.CLIENT_LOGIN_RATE_LIMIT = "1";
process.env.CLIENT_LOGIN_RATE_LIMIT_WINDOW_MS = "60000";

const { requireApiRequestGuards } = await import("../lib/request-guards.mjs");
const { requireAdminApiAuth } = await import("../lib/admin-auth.mjs");
const { requirePublicApiRateLimit } = await import("../lib/public-rate-limit.mjs");
const { isClientApiAccessPath } = await import("../lib/client-auth.mjs");
const { corsHeaders } = await import("../lib/cors.mjs");
const { securityHeaders } = await import("../lib/security-headers.mjs");
const {
  __resetAuthFailureTrackerForTests,
  recordAuthFailure,
  redactForLog
} = await import("../lib/structured-logger.mjs");

const context = {
  baseHeaders: { "X-Content-Type-Options": "nosniff" },
  requestOrigin: ""
};

{
  const session = {
    role: "client",
    businessId: "biz_a",
    businessSlug: "negocio-a"
  };

  assert.equal(isClientApiAccessPath("/api/businesses/biz_a/inbox", session), true);
  assert.equal(isClientApiAccessPath("/api/businesses/negocio-a/inbox", session), true);
  assert.equal(isClientApiAccessPath("/api/businesses/biz_a/next-actions", session), true);
  assert.equal(isClientApiAccessPath("/api/businesses/negocio-a/next-actions", session), true);
  assert.equal(isClientApiAccessPath("/api/businesses/biz_b/inbox", session), false);
  assert.equal(isClientApiAccessPath("/api/businesses/biz_a/inbox/extra", session), false);
  assert.equal(isClientApiAccessPath("/api/businesses/biz_a/next-actions/extra", session), false);
  assert.equal(isClientApiAccessPath("/api/businesses/biz_a/inbox-other", session), false);
}

{
  const response = mockResponse();
  const allowed = requireApiRequestGuards(
    mockRequest({ method: "POST", url: "/api/businesses", headers: {} }),
    response,
    context,
    "/api/businesses"
  );

  assert.equal(allowed, false);
  assert.equal(response.status, 415);
  assert.match(response.body, /unsupported_media_type/);
}

{
  const first = mockResponse();
  const second = mockResponse();
  const request = () => mockRequest({
    method: "POST",
    url: "/api/client/login",
    headers: { "content-type": "application/json" },
    remoteAddress: "192.0.2.10"
  });

  assert.equal(requirePublicApiRateLimit(request(), first, context, "/api/client/login"), true);
  assert.equal(requirePublicApiRateLimit(request(), second, context, "/api/client/login"), false);
  assert.equal(second.status, 429);
}

{
  const previousNodeEnv = process.env.NODE_ENV;
  const previousToken = process.env.LOCALLIFT_ADMIN_TOKEN;
  const previousLegacyToken = process.env.ADMIN_API_TOKEN;
  const previousLogLevel = process.env.LOG_LEVEL;

  process.env.NODE_ENV = "production";
  process.env.LOG_LEVEL = "error";
  delete process.env.LOCALLIFT_ADMIN_TOKEN;
  delete process.env.ADMIN_API_TOKEN;

  const response = mockResponse();
  const allowed = await requireAdminApiAuth(
    mockRequest({ method: "GET", url: "/api/businesses", headers: {} }),
    response,
    context,
    "/api/businesses"
  );

  assert.equal(allowed, false);
  assert.equal(response.status, 503);
  assert.match(response.body, /admin_auth_not_configured/);

  restoreEnv("NODE_ENV", previousNodeEnv);
  restoreEnv("LOCALLIFT_ADMIN_TOKEN", previousToken);
  restoreEnv("ADMIN_API_TOKEN", previousLegacyToken);
  restoreEnv("LOG_LEVEL", previousLogLevel);
}

{
  const previousNodeEnv = process.env.NODE_ENV;
  const previousCorsOrigin = process.env.CORS_ORIGIN;

  process.env.NODE_ENV = "production";
  process.env.CORS_ORIGIN = "https://app.example.com,https://www.example.com";

  const allowed = corsHeaders({ requestOrigin: "https://app.example.com" });
  assert.equal(allowed["Access-Control-Allow-Origin"], "https://app.example.com");
  assert.match(allowed["Access-Control-Allow-Headers"], /X-LocalLift-Client-Token/);

  const blocked = corsHeaders({ requestOrigin: "https://evil.example" });
  assert.equal(blocked["Access-Control-Allow-Origin"], undefined);

  delete process.env.CORS_ORIGIN;
  const missing = corsHeaders({ requestOrigin: "https://app.example.com" });
  assert.equal(missing["Access-Control-Allow-Origin"], undefined);

  restoreEnv("NODE_ENV", previousNodeEnv);
  restoreEnv("CORS_ORIGIN", previousCorsOrigin);
}

{
  const headers = securityHeaders({ NODE_ENV: "production" });

  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "SAMEORIGIN");
  assert.match(headers["Content-Security-Policy"], /frame-ancestors 'self'/);
  assert.match(headers["Content-Security-Policy"], /object-src 'none'/);
  assert.match(headers["Strict-Transport-Security"], /max-age=\d+; includeSubDomains/);
  assert.match(headers["Permissions-Policy"], /camera=\(\)/);
}

{
  const redacted = redactForLog({
    authorization: "Bearer secret-admin-token",
    nested: {
      password: "Portal2026!",
      callback: "https://example.com/callback?token=secret-token&ok=1"
    }
  });

  assert.equal(redacted.authorization, "[REDACTED]");
  assert.equal(redacted.nested.password, "[REDACTED]");
  assert.equal(redacted.nested.callback, "https://example.com/callback?token=[REDACTED]&ok=1");
}

{
  const previousThreshold = process.env.AUTH_FAILURE_ALERT_THRESHOLD;
  const previousWindow = process.env.AUTH_FAILURE_ALERT_WINDOW_MS;
  const previousLogLevel = process.env.LOG_LEVEL;
  const previousConsoleError = console.error;
  const lines = [];

  process.env.AUTH_FAILURE_ALERT_THRESHOLD = "2";
  process.env.AUTH_FAILURE_ALERT_WINDOW_MS = "60000";
  process.env.LOG_LEVEL = "warn";
  console.error = (line) => lines.push(String(line));

  try {
    __resetAuthFailureTrackerForTests();
    const request = mockRequest({
      method: "GET",
      url: "/api/businesses",
      headers: {
        authorization: "Bearer should-not-appear",
        "user-agent": "security-test"
      },
      remoteAddress: "192.0.2.55"
    });

    recordAuthFailure(request, "admin_token_invalid_or_missing", context, {
      route: "/api/businesses",
      hasProvidedToken: true,
      statusCode: 401
    });
    recordAuthFailure(request, "admin_token_invalid_or_missing", context, {
      route: "/api/businesses",
      hasProvidedToken: true,
      statusCode: 401
    });
  } finally {
    console.error = previousConsoleError;
    restoreEnv("AUTH_FAILURE_ALERT_THRESHOLD", previousThreshold);
    restoreEnv("AUTH_FAILURE_ALERT_WINDOW_MS", previousWindow);
    restoreEnv("LOG_LEVEL", previousLogLevel);
    __resetAuthFailureTrackerForTests();
  }

  assert.ok(lines.some((line) => line.includes('"event":"auth_failure_alert"')));
  assert.equal(lines.some((line) => line.includes("should-not-appear")), false);
}

console.log("Backend security checks passed.");

function mockRequest({ method, url, headers, remoteAddress = "127.0.0.1" }) {
  return {
    method,
    url,
    headers,
    socket: { remoteAddress }
  };
}

function mockResponse() {
  return {
    status: 0,
    headers: {},
    body: "",
    writeHead(status, headers = {}) {
      this.status = status;
      this.headers = headers;
    },
    end(chunk = "") {
      this.body = String(chunk || "");
    }
  };
}

function restoreEnv(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
