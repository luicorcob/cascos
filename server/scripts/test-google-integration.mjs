import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  completeGoogleAuthorization,
  createGoogleAuthorization,
  disconnectGoogle,
  getGoogleAccessToken,
  getGoogleConnectionStatus,
  saveGooglePlaceSnapshot
} from "../lib/google-auth.mjs";

const root = await mkdtemp(path.join(os.tmpdir(), "locallift-google-test-"));
const context = { root };
const originalFetch = globalThis.fetch;
let authorizationCodeExchanges = 0;
let refreshExchanges = 0;

process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client-id";
process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_OAUTH_REDIRECT_URI = "http://127.0.0.1:5173/api/google/oauth/callback";
process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "test-encryption-key-with-more-than-32-characters";
process.env.GOOGLE_AUTH_DB_FILE = "google-auth-db.json";
process.env.BUSINESS_DB_BACKUPS = "false";

globalThis.fetch = async (url, options = {}) => {
  assert.equal(String(url), "https://oauth2.googleapis.com/token");
  const body = new URLSearchParams(options.body);

  if (body.get("grant_type") === "authorization_code") {
    authorizationCodeExchanges += 1;
    return Response.json({
      access_token: "initial-access-token",
      refresh_token: "persistent-refresh-token",
      expires_in: 1,
      token_type: "Bearer",
      scope: [
        "https://www.googleapis.com/auth/calendar.events",
        "https://www.googleapis.com/auth/calendar.freebusy",
        "https://www.googleapis.com/auth/business.manage",
        "https://www.googleapis.com/auth/admin.directory.user"
      ].join(" ")
    });
  }

  if (body.get("grant_type") === "refresh_token") {
    refreshExchanges += 1;
    assert.equal(body.get("refresh_token"), "persistent-refresh-token");
    return Response.json({
      access_token: "refreshed-access-token",
      expires_in: 3600,
      token_type: "Bearer"
    });
  }

  return Response.json({ error: "unexpected_request" }, { status: 400 });
};

try {
  const authorization = await createGoogleAuthorization(context, {
    businessId: "biz_google_test",
    features: ["calendar", "business-profile", "workspace"]
  });
  const state = new URL(authorization.authorizationUrl).searchParams.get("state");

  assert.ok(state);
  assert.equal(authorization.features.length, 3);

  const connection = await completeGoogleAuthorization(context, {
    code: "authorization-code",
    state
  });
  assert.equal(authorizationCodeExchanges, 1);
  assert.deepEqual(connection.features.sort(), ["business-profile", "calendar", "workspace"]);

  const accessToken = await getGoogleAccessToken(context, "biz_google_test", "calendar");
  assert.equal(accessToken, "refreshed-access-token");
  assert.equal(refreshExchanges, 1);

  await saveGooglePlaceSnapshot(context, "biz_google_test", {
    placeId: "ChIJ-test",
    name: "Google Test"
  });
  const status = await getGoogleConnectionStatus(context, "biz_google_test");
  assert.equal(status.connected.calendar, true);
  assert.equal(status.connected.businessProfile, true);
  assert.equal(status.connected.workspace, true);
  assert.equal(status.placeSnapshot.placeId, "ChIJ-test");

  const disconnected = await disconnectGoogle(context, "biz_google_test");
  assert.equal(disconnected.disconnected, true);
  assert.equal((await getGoogleConnectionStatus(context, "biz_google_test")).connection, null);

  console.log("Google integration auth, encryption, refresh, snapshot and disconnect checks passed.");
} finally {
  globalThis.fetch = originalFetch;
  await rm(root, { recursive: true, force: true });
}
