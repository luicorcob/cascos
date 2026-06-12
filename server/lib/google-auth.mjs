import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";
import path from "node:path";
import { backupJsonStore, readJsonStore, writeJsonStore } from "./json-store.mjs";

const GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const STATE_TTL_MS = 10 * 60 * 1000;
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
const DEFAULT_DB = {
  version: 1,
  updatedAt: null,
  oauthStates: [],
  connections: [],
  placeSnapshots: [],
  auditLog: []
};

export const GOOGLE_FEATURE_SCOPES = Object.freeze({
  calendar: [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/calendar.freebusy"
  ],
  "business-profile": [
    "https://www.googleapis.com/auth/business.manage"
  ],
  workspace: [
    "https://www.googleapis.com/auth/admin.directory.user"
  ]
});

export async function createGoogleAuthorization(context, input = {}) {
  const config = requireOAuthConfig();
  requireEncryptionSecret();

  const businessId = clean(input.businessId, 120);
  const features = normalizeGoogleFeatures(input.features);

  if (!businessId) {
    throw httpError(400, "businessId is required");
  }

  if (!features.length) {
    throw httpError(400, "At least one Google feature is required");
  }

  const scopes = scopesForGoogleFeatures(features);
  const state = randomBytes(32).toString("base64url");
  const now = new Date();
  const db = await loadGoogleAuthDb(context);

  db.oauthStates = db.oauthStates
    .filter((item) => new Date(item.expiresAt).getTime() > now.getTime())
    .filter((item) => item.businessId !== businessId);
  db.oauthStates.push({
    stateHash: hashState(state),
    businessId,
    features,
    scopes,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + STATE_TTL_MS).toISOString()
  });
  appendAudit(db, "google.oauth.started", businessId, now.toISOString(), { features });
  await saveGoogleAuthDb(db, context, "google-oauth-start");

  const authorizationUrl = new URL(GOOGLE_AUTH_ENDPOINT);
  authorizationUrl.searchParams.set("client_id", config.clientId);
  authorizationUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("access_type", "offline");
  authorizationUrl.searchParams.set("include_granted_scopes", "true");
  authorizationUrl.searchParams.set("prompt", clean(process.env.GOOGLE_OAUTH_PROMPT, 40) || "consent");
  authorizationUrl.searchParams.set("scope", scopes.join(" "));
  authorizationUrl.searchParams.set("state", state);

  if (clean(input.loginHint, 320)) {
    authorizationUrl.searchParams.set("login_hint", clean(input.loginHint, 320));
  }

  return {
    authorizationUrl: authorizationUrl.toString(),
    businessId,
    features,
    scopes,
    redirectUri: config.redirectUri
  };
}

export async function completeGoogleAuthorization(context, input = {}) {
  const config = requireOAuthConfig();
  requireEncryptionSecret();

  const code = clean(input.code, 4096);
  const state = clean(input.state, 4096);

  if (!code || !state) {
    throw httpError(400, "OAuth code and state are required");
  }

  const db = await loadGoogleAuthDb(context);
  const stateHash = hashState(state);
  const stateIndex = db.oauthStates.findIndex((item) => item.stateHash === stateHash);

  if (stateIndex === -1) {
    throw httpError(400, "OAuth state is invalid or already used");
  }

  const oauthState = db.oauthStates[stateIndex];
  db.oauthStates.splice(stateIndex, 1);

  if (new Date(oauthState.expiresAt).getTime() <= Date.now()) {
    await saveGoogleAuthDb(db, context, "google-oauth-expired");
    throw httpError(400, "OAuth state expired; start the connection again");
  }

  const tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code"
    })
  });
  const tokenPayload = await parseGoogleResponse(tokenResponse);

  if (!tokenResponse.ok) {
    await saveGoogleAuthDb(db, context, "google-oauth-failed");
    throw googleHttpError(tokenResponse.status, tokenPayload, "Google rejected the OAuth authorization code");
  }

  const existingIndex = db.connections.findIndex((item) => item.businessId === oauthState.businessId);
  const existing = existingIndex >= 0 ? db.connections[existingIndex] : null;
  const existingTokens = existing ? decryptTokens(existing.encryptedTokens) : {};
  const scopes = uniqueScopes([
    ...parseScopes(existing?.scopes),
    ...parseScopes(oauthState.scopes),
    ...parseScopes(tokenPayload.scope)
  ]);
  const now = new Date().toISOString();
  const tokens = normalizeTokenPayload({
    ...existingTokens,
    ...tokenPayload,
    refresh_token: tokenPayload.refresh_token || existingTokens.refresh_token
  });
  const connection = {
    businessId: oauthState.businessId,
    encryptedTokens: encryptTokens(tokens),
    scopes,
    features: featuresForScopes(scopes),
    connectedAt: existing?.connectedAt || now,
    updatedAt: now,
    expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : "",
    lastRefreshAt: existing?.lastRefreshAt || ""
  };

  if (existingIndex >= 0) {
    db.connections[existingIndex] = connection;
  } else {
    db.connections.push(connection);
  }

  appendAudit(db, "google.oauth.connected", oauthState.businessId, now, {
    features: connection.features,
    scopes: connection.scopes
  });
  await saveGoogleAuthDb(db, context, "google-oauth-connected");
  return connectionSummary(connection);
}

export async function getGoogleConnectionStatus(context, businessId) {
  const db = await loadGoogleAuthDb(context);
  const connection = db.connections.find((item) => item.businessId === businessId) || null;
  const snapshot = db.placeSnapshots.find((item) => item.businessId === businessId) || null;

  return {
    configured: {
      oauth: Boolean(clean(process.env.GOOGLE_OAUTH_CLIENT_ID) && clean(process.env.GOOGLE_OAUTH_CLIENT_SECRET) && clean(process.env.GOOGLE_OAUTH_REDIRECT_URI)),
      tokenEncryption: Boolean(clean(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY).length >= 32),
      placesApi: Boolean(clean(process.env.GOOGLE_MAPS_API_KEY)),
      legacyCalendarToken: Boolean(clean(process.env.GOOGLE_CALENDAR_ACCESS_TOKEN)),
      legacyBusinessProfileToken: Boolean(clean(process.env.GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN)),
      legacyWorkspaceToken: Boolean(clean(process.env.GOOGLE_WORKSPACE_ADMIN_ACCESS_TOKEN))
    },
    connection: connection ? connectionSummary(connection) : null,
    connected: {
      calendar: hasFeatureOrLegacy(connection, "calendar", "GOOGLE_CALENDAR_ACCESS_TOKEN"),
      businessProfile: hasFeatureOrLegacy(connection, "business-profile", "GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN"),
      workspace: hasFeatureOrLegacy(connection, "workspace", "GOOGLE_WORKSPACE_ADMIN_ACCESS_TOKEN")
    },
    placeSnapshot: snapshot ? snapshot.snapshot : null,
    placeSnapshotAt: snapshot?.updatedAt || ""
  };
}

export async function disconnectGoogle(context, businessId) {
  const db = await loadGoogleAuthDb(context);
  const before = db.connections.length;
  db.connections = db.connections.filter((item) => item.businessId !== businessId);
  db.oauthStates = db.oauthStates.filter((item) => item.businessId !== businessId);
  const disconnected = db.connections.length !== before;
  const now = new Date().toISOString();

  if (disconnected) {
    appendAudit(db, "google.oauth.disconnected", businessId, now);
  }

  await saveGoogleAuthDb(db, context, "google-disconnect");
  return { businessId, disconnected };
}

export async function getGoogleAccessToken(context, businessId, feature) {
  const normalizedFeature = normalizeGoogleFeatures([feature])[0];
  const requiredScopes = GOOGLE_FEATURE_SCOPES[normalizedFeature] || [];
  const db = await loadGoogleAuthDb(context);
  const index = db.connections.findIndex((item) => item.businessId === businessId);
  const connection = index >= 0 ? db.connections[index] : null;

  if (!connection) {
    const legacy = getLegacyToken(normalizedFeature);
    if (legacy) {
      return legacy;
    }

    throw setupError(`Connect Google ${normalizedFeature} for this business first`);
  }

  const grantedScopes = parseScopes(connection.scopes);
  const missingScopes = requiredScopes.filter((scope) => !grantedScopes.includes(scope));

  if (missingScopes.length) {
    throw setupError(`Reconnect Google and grant the required ${normalizedFeature} permissions`, {
      missingScopes
    });
  }

  const tokens = decryptTokens(connection.encryptedTokens);

  if (tokens.access_token && Number(tokens.expiry_date || 0) > Date.now() + TOKEN_REFRESH_MARGIN_MS) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    throw setupError("Google access expired and no refresh token is stored; reconnect the business");
  }

  const config = requireOAuthConfig();
  const refreshResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token"
    })
  });
  const refreshPayload = await parseGoogleResponse(refreshResponse);

  if (!refreshResponse.ok) {
    throw googleHttpError(refreshResponse.status, refreshPayload, "Google token refresh failed");
  }

  const refreshedTokens = normalizeTokenPayload({
    ...tokens,
    ...refreshPayload,
    refresh_token: tokens.refresh_token
  });
  const now = new Date().toISOString();
  db.connections[index] = {
    ...connection,
    encryptedTokens: encryptTokens(refreshedTokens),
    scopes: uniqueScopes([...grantedScopes, ...parseScopes(refreshPayload.scope)]),
    features: featuresForScopes(uniqueScopes([...grantedScopes, ...parseScopes(refreshPayload.scope)])),
    expiresAt: refreshedTokens.expiry_date ? new Date(refreshedTokens.expiry_date).toISOString() : "",
    lastRefreshAt: now,
    updatedAt: now
  };
  appendAudit(db, "google.oauth.refreshed", businessId, now, { feature: normalizedFeature });
  await saveGoogleAuthDb(db, context, "google-token-refresh");
  return refreshedTokens.access_token;
}

export async function saveGooglePlaceSnapshot(context, businessId, snapshot) {
  const db = await loadGoogleAuthDb(context);
  const now = new Date().toISOString();
  const index = db.placeSnapshots.findIndex((item) => item.businessId === businessId);
  const record = {
    businessId,
    snapshot,
    updatedAt: now
  };

  if (index >= 0) {
    db.placeSnapshots[index] = record;
  } else {
    db.placeSnapshots.push(record);
  }

  appendAudit(db, "google.place.synced", businessId, now, { placeId: snapshot.placeId || "" });
  await saveGoogleAuthDb(db, context, "google-place-sync");
  return record;
}

export async function googleJsonRequest(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await parseGoogleResponse(response);

  if (!response.ok) {
    throw googleHttpError(response.status, payload, "Google API request failed");
  }

  return payload;
}

export function normalizeGoogleFeatures(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || "").split(",");
  const aliases = {
    business: "business-profile",
    businessprofile: "business-profile",
    profile: "business-profile",
    gbp: "business-profile",
    calendar: "calendar",
    workspace: "workspace",
    admin: "workspace"
  };

  return Array.from(new Set(values
    .map((item) => clean(item, 80).toLowerCase())
    .map((item) => aliases[item] || item)
    .filter((item) => GOOGLE_FEATURE_SCOPES[item])));
}

export function scopesForGoogleFeatures(features) {
  return uniqueScopes(normalizeGoogleFeatures(features).flatMap((feature) => GOOGLE_FEATURE_SCOPES[feature]));
}

export function setupError(message, details = {}) {
  const error = httpError(503, message);
  error.code = "google_setup_required";
  error.details = details;
  return error;
}

export function googleHttpError(statusCode, payload, fallback) {
  const message = clean(
    payload?.error?.message
      || payload?.error_description
      || (typeof payload?.error === "string" ? payload.error : "")
      || fallback,
    1000
  );
  const error = httpError(statusCode || 502, message || fallback);
  error.code = clean(payload?.error?.status || payload?.error || "google_api_error", 120);
  error.details = payload?.error?.details || {};
  return error;
}

function requireOAuthConfig() {
  const clientId = clean(process.env.GOOGLE_OAUTH_CLIENT_ID, 1000);
  const clientSecret = clean(process.env.GOOGLE_OAUTH_CLIENT_SECRET, 1000);
  const redirectUri = clean(process.env.GOOGLE_OAUTH_REDIRECT_URI, 2000);

  if (!clientId || !clientSecret || !redirectUri) {
    throw setupError("Set GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI");
  }

  return { clientId, clientSecret, redirectUri };
}

function requireEncryptionSecret() {
  const secret = clean(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY, 4096);

  if (secret.length < 32) {
    throw setupError("Set GOOGLE_TOKEN_ENCRYPTION_KEY to a random secret with at least 32 characters");
  }

  return secret;
}

function encryptTokens(tokens) {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(tokens), "utf8"),
    cipher.final()
  ]);

  return {
    version: 1,
    algorithm: "aes-256-gcm",
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url")
  };
}

function decryptTokens(encrypted) {
  if (!encrypted?.iv || !encrypted?.tag || !encrypted?.ciphertext) {
    throw setupError("Stored Google tokens are missing or invalid");
  }

  try {
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(encrypted.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(encrypted.tag, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encrypted.ciphertext, "base64url")),
      decipher.final()
    ]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch (error) {
    throw setupError("Stored Google tokens cannot be decrypted; verify GOOGLE_TOKEN_ENCRYPTION_KEY");
  }
}

function encryptionKey() {
  return createHash("sha256").update(requireEncryptionSecret(), "utf8").digest();
}

function normalizeTokenPayload(payload) {
  const expiresIn = Number(payload.expires_in || 0);
  return {
    access_token: clean(payload.access_token, 8192),
    refresh_token: clean(payload.refresh_token, 8192),
    scope: clean(payload.scope, 8192),
    token_type: clean(payload.token_type, 120) || "Bearer",
    expiry_date: expiresIn > 0 ? Date.now() + expiresIn * 1000 : Number(payload.expiry_date || 0)
  };
}

function featuresForScopes(scopes) {
  const granted = parseScopes(scopes);
  return Object.entries(GOOGLE_FEATURE_SCOPES)
    .filter(([, required]) => required.every((scope) => granted.includes(scope)))
    .map(([feature]) => feature);
}

function hasFeatureOrLegacy(connection, feature, envKey) {
  return Boolean(connection?.features?.includes(feature) || clean(process.env[envKey]));
}

function getLegacyToken(feature) {
  const envKeys = {
    calendar: "GOOGLE_CALENDAR_ACCESS_TOKEN",
    "business-profile": "GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN",
    workspace: "GOOGLE_WORKSPACE_ADMIN_ACCESS_TOKEN"
  };
  return clean(process.env[envKeys[feature]] || "", 8192);
}

function connectionSummary(connection) {
  return {
    businessId: connection.businessId,
    scopes: parseScopes(connection.scopes),
    features: normalizeGoogleFeatures(connection.features),
    connectedAt: connection.connectedAt || "",
    updatedAt: connection.updatedAt || "",
    expiresAt: connection.expiresAt || "",
    lastRefreshAt: connection.lastRefreshAt || ""
  };
}

async function loadGoogleAuthDb(context) {
  const db = await readJsonStore(getDbPath(context.root), DEFAULT_DB);
  db.version = Number(db.version || 1);
  db.oauthStates = Array.isArray(db.oauthStates) ? db.oauthStates : [];
  db.connections = Array.isArray(db.connections) ? db.connections : [];
  db.placeSnapshots = Array.isArray(db.placeSnapshots) ? db.placeSnapshots : [];
  db.auditLog = Array.isArray(db.auditLog) ? db.auditLog : [];
  return db;
}

async function saveGoogleAuthDb(db, context, backupLabel) {
  const dbPath = getDbPath(context.root);
  db.updatedAt = new Date().toISOString();

  if (process.env.BUSINESS_DB_BACKUPS !== "false") {
    await backupJsonStore(dbPath, getBackupDir(context.root), backupLabel);
  }

  await writeJsonStore(dbPath, db);
}

function getDbPath(root) {
  return process.env.GOOGLE_AUTH_DB_FILE
    ? path.resolve(root, process.env.GOOGLE_AUTH_DB_FILE)
    : path.join(root, "data", "google-auth-db.json");
}

function getBackupDir(root) {
  return process.env.BUSINESS_DB_BACKUP_DIR
    ? path.resolve(root, process.env.BUSINESS_DB_BACKUP_DIR)
    : path.join(root, "data", "backups");
}

function appendAudit(db, type, businessId, createdAt, metadata = {}) {
  db.auditLog.push({
    id: `google_audit_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    businessId,
    metadata,
    createdAt
  });
  db.auditLog = db.auditLog.slice(-1000);
}

async function parseGoogleResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return { error: text };
  }
}

function parseScopes(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/\s+/);
  return uniqueScopes(values);
}

function uniqueScopes(values) {
  return Array.from(new Set(values.map((value) => clean(value, 1000)).filter(Boolean)));
}

function hashState(value) {
  return createHash("sha256").update(value, "utf8").digest("base64url");
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function clean(value, maxLength = 500) {
  return String(value || "").trim().slice(0, maxLength);
}
