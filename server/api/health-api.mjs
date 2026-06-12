import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { corsHeaders } from "../lib/cors.mjs";

const DEFAULT_DB = {
  businesses: [],
  contacts: [],
  bookings: [],
  bookingReminders: [],
  businessEvents: [],
  auditLog: []
};

export function isHealthApiRequest(pathname) {
  return pathname === "/api/health";
}

export async function handleHealthApi(request, response, context) {
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  if (method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "GET, OPTIONS" });
    return;
  }

  const startedAt = Date.now();
  const dbPath = getDbPath(context.root);
  const db = await readHealthDb(dbPath);
  const checks = await buildChecks(dbPath, db);
  const google = await readGoogleHealth(context.root);
  const ok = checks.databaseReadable && checks.databaseWritable;

  sendJson(response, ok ? 200 : 503, {
    ok,
    service: "locallift-studio",
    version: process.env.npm_package_version || "1.0.0",
    environment: process.env.NODE_ENV || "development",
    uptimeSeconds: Math.round(process.uptime()),
    latencyMs: Date.now() - startedAt,
    database: {
      path: path.relative(context.root, dbPath),
      readable: checks.databaseReadable,
      writable: checks.databaseWritable,
      error: checks.error
    },
    counts: {
      businesses: db.businesses.length,
      contacts: db.contacts.length,
      bookings: db.bookings.length,
      reminders: db.bookingReminders.length,
      events: db.businessEvents.length,
      auditLog: db.auditLog.length
    },
    google
  }, context);
}

async function readHealthDb(dbPath) {
  try {
    const raw = await readFile(dbPath, "utf8");
    const db = JSON.parse(raw);

    return {
      businesses: Array.isArray(db.businesses) ? db.businesses : [],
      contacts: Array.isArray(db.contacts) ? db.contacts : [],
      bookings: Array.isArray(db.bookings) ? db.bookings : [],
      bookingReminders: Array.isArray(db.bookingReminders) ? db.bookingReminders : [],
      businessEvents: Array.isArray(db.businessEvents) ? db.businessEvents : [],
      auditLog: Array.isArray(db.auditLog) ? db.auditLog : []
    };
  } catch (error) {
    return { ...DEFAULT_DB, error: error.message };
  }
}

async function buildChecks(dbPath, db) {
  const checks = {
    databaseReadable: !db.error,
    databaseWritable: false,
    error: db.error || ""
  };

  try {
    await access(dbPath, constants.W_OK);
    checks.databaseWritable = true;
  } catch (error) {
    checks.error = checks.error || error.message;
  }

  return checks;
}

async function readGoogleHealth(root) {
  const authDbPath = process.env.GOOGLE_AUTH_DB_FILE
    ? path.resolve(root, process.env.GOOGLE_AUTH_DB_FILE)
    : path.join(root, "data", "google-auth-db.json");
  let connections = 0;
  let placeSnapshots = 0;

  try {
    const db = JSON.parse(await readFile(authDbPath, "utf8"));
    connections = Array.isArray(db.connections) ? db.connections.length : 0;
    placeSnapshots = Array.isArray(db.placeSnapshots) ? db.placeSnapshots.length : 0;
  } catch (error) {
    if (error.code !== "ENOENT") {
      return {
        oauthConfigured: googleOAuthConfigured(),
        tokenEncryptionConfigured: googleEncryptionConfigured(),
        placesConfigured: Boolean(clean(process.env.GOOGLE_MAPS_API_KEY)),
        connections,
        placeSnapshots,
        authStoreReadable: false
      };
    }
  }

  return {
    oauthConfigured: googleOAuthConfigured(),
    tokenEncryptionConfigured: googleEncryptionConfigured(),
    placesConfigured: Boolean(clean(process.env.GOOGLE_MAPS_API_KEY)),
    connections,
    placeSnapshots,
    authStoreReadable: true
  };
}

function googleOAuthConfigured() {
  return Boolean(
    clean(process.env.GOOGLE_OAUTH_CLIENT_ID)
      && clean(process.env.GOOGLE_OAUTH_CLIENT_SECRET)
      && clean(process.env.GOOGLE_OAUTH_REDIRECT_URI)
  );
}

function googleEncryptionConfigured() {
  return clean(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY).length >= 32;
}

function getDbPath(root) {
  return process.env.BUSINESS_DB_FILE
    ? path.resolve(root, process.env.BUSINESS_DB_FILE)
    : path.join(root, "data", "business-db.json");
}

function clean(value) {
  return String(value || "").trim();
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

function sendEmpty(response, status, context) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    Allow: "GET, OPTIONS"
  });
  response.end();
}
