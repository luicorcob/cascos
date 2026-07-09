const DEFAULT_HSTS_SECONDS = 15552000;

export function securityHeaders(env = process.env) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Security-Policy": contentSecurityPolicy(),
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "Cache-Control": "no-store"
  };

  if (isProduction(env)) {
    headers["Strict-Transport-Security"] = `max-age=${hstsMaxAge(env)}; includeSubDomains`;
  }

  return headers;
}

function contentSecurityPolicy() {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: http: https:",
    "font-src 'self' data:",
    "connect-src 'self' http: https: ws: wss:",
    "media-src 'self' data: blob: http: https:",
    "frame-src 'self' https://www.google.com https://maps.google.com https://www.youtube.com https://youtube.com",
    "worker-src 'self' blob:"
  ].join("; ");
}

function hstsMaxAge(env) {
  const value = Number(env.SECURITY_HSTS_MAX_AGE_SECONDS || env.HSTS_MAX_AGE_SECONDS);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_HSTS_SECONDS;
}

function isProduction(env) {
  return String(env.NODE_ENV || "").trim() === "production";
}
