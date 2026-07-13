import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { handleDemoPublishApi, isDemoPublishApiRequest } from "../api/demo-publish-api.mjs";

const originalPublishDir = process.env.DEMO_PUBLISH_DIR;
const originalTtl = process.env.DEMO_PUBLISH_TTL_HOURS;
const originalDemoPublicBaseUrl = process.env.DEMO_PUBLIC_BASE_URL;
const originalPublicBaseUrl = process.env.PUBLIC_BASE_URL;
const originalLocalliftPublicBaseUrl = process.env.LOCALLIFT_PUBLIC_BASE_URL;
const originalRemotePublishUrl = process.env.DEMO_REMOTE_PUBLISH_URL;
const originalRemotePublishToken = process.env.DEMO_REMOTE_PUBLISH_TOKEN;
const originalBusinessStore = process.env.BUSINESS_STORE;
const originalBusinessDbDriver = process.env.BUSINESS_DB_DRIVER;
const originalBusinessDbFile = process.env.BUSINESS_DB_FILE;
const originalBusinessDbBackups = process.env.BUSINESS_DB_BACKUPS;
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalPostgresUrl = process.env.POSTGRES_URL;
const originalLocalliftDatabaseUrl = process.env.LOCALLIFT_DATABASE_URL;
const originalFetch = globalThis.fetch;
const tempDir = await mkdtemp(path.join(os.tmpdir(), "dls-demo-publish-"));
const dbPath = path.join(tempDir, "business-db.json");

try {
  process.env.DEMO_PUBLISH_DIR = tempDir;
  process.env.DEMO_PUBLISH_TTL_HOURS = "1";
  delete process.env.DEMO_PUBLIC_BASE_URL;
  delete process.env.PUBLIC_BASE_URL;
  delete process.env.LOCALLIFT_PUBLIC_BASE_URL;
  delete process.env.DEMO_REMOTE_PUBLISH_URL;
  delete process.env.DEMO_REMOTE_PUBLISH_TOKEN;
  process.env.BUSINESS_STORE = "json";
  process.env.BUSINESS_DB_DRIVER = "json";
  process.env.BUSINESS_DB_FILE = dbPath;
  process.env.BUSINESS_DB_BACKUPS = "false";
  process.env.DATABASE_URL = "";
  process.env.POSTGRES_URL = "";
  process.env.LOCALLIFT_DATABASE_URL = "";
  await writeFile(dbPath, `${JSON.stringify(createBusinessFixture(), null, 2)}\n`, "utf8");

  assert.equal(isDemoPublishApiRequest("/api/demo-publish"), true);
  assert.equal(isDemoPublishApiRequest("/demos/demo-id/"), true);
  assert.equal(isDemoPublishApiRequest("/api/businesses"), false);

  const publishResponse = createResponse();
  await handleDemoPublishApi(createJsonRequest({
    html: "<!doctype html><html lang=\"es\"><head><title>Demo</title></head><body><main>Hola cliente</main></body></html>",
    business: {
      name: "Clinica Aurea",
      slug: "clinica-aurea",
      category: "clinica",
      location: "Sevilla"
    }
  }), publishResponse, createContext());

  assert.equal(publishResponse.status, 201);
  const payload = JSON.parse(publishResponse.body);
  assert.match(payload.demo.id, /^clinica-aurea-/);
  assert.match(payload.demo.url, /^https:\/\/studio\.test\/demos\/clinica-aurea-/);
  assert.equal(payload.publishedUrl, payload.demo.url);
  assert.equal(payload.demo.shareable, true);
  assert.equal(payload.demo.shareStatus, "public-https");
  assert.ok(payload.demo.expiresAt);
  assert.equal(payload.automation.applied, false);
  assert.equal(payload.automation.reason, "explicit-contact-link-required");
  const untouchedStore = await readFile(dbPath, "utf8");
  assert.equal(untouchedStore, `${JSON.stringify(createBusinessFixture(), null, 2)}\n`, "Unlinked publication must not touch the CRM store");

  const pageResponse = createResponse();
  await handleDemoPublishApi({
    method: "GET",
    url: payload.demo.path,
    headers: { host: "studio.test" }
  }, pageResponse, createContext());

  assert.equal(pageResponse.status, 200);
  assert.equal(pageResponse.headers["Content-Type"], "text/html; charset=utf-8");
  assert.equal(pageResponse.headers["X-Robots-Tag"], "noindex, nofollow");
  assert.match(pageResponse.body, /Hola cliente/);

  const missingResponse = createResponse();
  await handleDemoPublishApi({
    method: "GET",
    url: "/demos/nope/index.html",
    headers: { host: "studio.test" }
  }, missingResponse, createContext());
  assert.equal(missingResponse.status, 404);

  const linkedPublishResponse = createResponse();
  const linkedRequest = {
    html: "<!doctype html><html lang=\"es\"><head><title>Demo vinculada</title></head><body><main>Seguimiento comercial</main></body></html>",
    business: {
      name: "Clinica Aurea",
      slug: "clinica-aurea",
      category: "clinica",
      location: "Sevilla",
      contactId: "contact_linked"
    }
  };
  await handleDemoPublishApi(createJsonRequest(linkedRequest), linkedPublishResponse, createContext());

  assert.equal(linkedPublishResponse.status, 201);
  const linkedPayload = JSON.parse(linkedPublishResponse.body);
  assert.equal(linkedPayload.automation.applied, true);
  assert.equal(linkedPayload.automation.reason, "created");
  assert.equal(linkedPayload.automation.contactId, "contact_linked");
  assert.equal(linkedPayload.automation.nextAction.type, "email");
  assert.equal(
    Date.parse(linkedPayload.automation.nextAction.dueDate) - Date.parse(linkedPayload.demo.createdAt),
    48 * 60 * 60 * 1000,
    "Published demo follow-up must be due exactly 48 hours after publication"
  );
  const linkedStore = JSON.parse(await readFile(dbPath, "utf8"));
  const linkedContact = linkedStore.contacts.find((contact) => contact.id === "contact_linked" && contact.businessId === "biz_a");
  assert.deepEqual(linkedContact.nextAction, linkedPayload.automation.nextAction);
  assert.equal(linkedStore.activities.length, 1);
  assert.equal(linkedStore.activities[0].metadata.demoId, linkedPayload.demo.id);
  assert.equal(linkedStore.activities[0].metadata.demoUrl, linkedPayload.demo.url);

  const beforeLocalRetry = await readFile(dbPath, "utf8");
  const localRetryResponse = createResponse();
  await handleDemoPublishApi(createJsonRequest(linkedRequest), localRetryResponse, createContext());
  const localRetryPayload = JSON.parse(localRetryResponse.body);
  assert.equal(localRetryPayload.automation.applied, false);
  assert.equal(localRetryPayload.automation.reason, "existing-next-action");
  assert.equal(await readFile(dbPath, "utf8"), beforeLocalRetry, "Idempotent retry must not persist a second CRM mutation");

  const manualBefore = await readFile(dbPath, "utf8");
  const manualActionBefore = JSON.stringify(JSON.parse(manualBefore).contacts.find((contact) => contact.id === "contact_manual").nextAction);
  const manualPublishResponse = createResponse();
  await handleDemoPublishApi(createJsonRequest({
    html: "<!doctype html><html lang=\"es\"><head><title>Demo manual</title></head><body><main>Accion manual protegida</main></body></html>",
    business: {
      id: "biz_a",
      name: "Clinica Aurea",
      contactId: "contact_manual"
    }
  }), manualPublishResponse, createContext());
  const manualPayload = JSON.parse(manualPublishResponse.body);
  assert.equal(manualPayload.automation.reason, "existing-next-action");
  assert.equal(await readFile(dbPath, "utf8"), manualBefore, "Manual nextAction must not be overwritten or cause a save");
  const manualAfter = JSON.parse(await readFile(dbPath, "utf8")).contacts.find((contact) => contact.id === "contact_manual");
  assert.equal(JSON.stringify(manualAfter.nextAction), manualActionBefore);

  const noInferenceBefore = await readFile(dbPath, "utf8");
  const noInferenceResponse = createResponse();
  await handleDemoPublishApi(createJsonRequest({
    html: "<!doctype html><html lang=\"es\"><head><title>Sin inferencia</title></head><body><main>No resolver por email</main></body></html>",
    business: {
      id: "biz_a",
      name: "Clinica Aurea",
      email: "linked@example.test"
    }
  }), noInferenceResponse, createContext());
  const noInferencePayload = JSON.parse(noInferenceResponse.body);
  assert.equal(noInferencePayload.automation.reason, "explicit-contact-link-required");
  assert.equal(await readFile(dbPath, "utf8"), noInferenceBefore, "Email without explicit contactId must never touch the CRM store");

  const crossTenantBefore = await readFile(dbPath, "utf8");
  const crossTenantResponse = createResponse();
  await handleDemoPublishApi(createJsonRequest({
    html: "<!doctype html><html lang=\"es\"><head><title>Tenant</title></head><body><main>Tenant isolation</main></body></html>",
    business: {
      id: "biz_b",
      name: "Otro negocio",
      contactId: "contact_linked"
    }
  }), crossTenantResponse, createContext());
  const crossTenantPayload = JSON.parse(crossTenantResponse.body);
  assert.equal(crossTenantPayload.automation.reason, "contact-not-found");
  assert.equal(await readFile(dbPath, "utf8"), crossTenantBefore, "Cross-tenant contact link must not persist changes");

  const failedLoadResponse = createResponse();
  await handleDemoPublishApi(createJsonRequest({
    html: "<!doctype html><html lang=\"es\"><head><title>Fail open</title></head><body><main>CRM no disponible</main></body></html>",
    business: {
      id: "biz_a",
      name: "Clinica Aurea",
      contactId: "contact_linked"
    }
  }), failedLoadResponse, createContext({
    demoPublishAutomation: {
      loadBusinessStore: async () => {
        throw new Error("secret-load-failure");
      }
    }
  }));
  assert.equal(failedLoadResponse.status, 201, "A CRM load failure must not invalidate an already published demo");
  const failedLoadPayload = JSON.parse(failedLoadResponse.body);
  assert.equal(failedLoadPayload.automation.applied, false);
  assert.equal(failedLoadPayload.automation.reason, "automation-unavailable");
  assert.doesNotMatch(failedLoadResponse.body, /secret-load-failure/);
  const failedLoadPageResponse = createResponse();
  await handleDemoPublishApi({
    method: "GET",
    url: failedLoadPayload.demo.path,
    headers: { host: "studio.test" }
  }, failedLoadPageResponse, createContext());
  assert.equal(failedLoadPageResponse.status, 200, "Fail-open response must point to the demo that was already published");

  let failedSaveCalls = 0;
  const failedSaveResponse = createResponse();
  await handleDemoPublishApi(createJsonRequest({
    html: "<!doctype html><html lang=\"es\"><head><title>Fail open save</title></head><body><main>CRM no escribible</main></body></html>",
    business: {
      id: "biz_a",
      name: "Clinica Aurea",
      contactId: "contact_linked"
    }
  }), failedSaveResponse, createContext({
    demoPublishAutomation: {
      loadBusinessStore: async () => structuredClone(createBusinessFixture()),
      saveBusinessStore: async () => {
        failedSaveCalls += 1;
        throw new Error("secret-save-failure");
      }
    }
  }));
  assert.equal(failedSaveResponse.status, 201, "A CRM save failure must not invalidate an already published demo");
  const failedSavePayload = JSON.parse(failedSaveResponse.body);
  assert.equal(failedSaveCalls, 1);
  assert.equal(failedSavePayload.automation.applied, false);
  assert.equal(failedSavePayload.automation.reason, "automation-unavailable");
  assert.doesNotMatch(failedSaveResponse.body, /secret-save-failure/);

  const localPublishResponse = createResponse();
  await handleDemoPublishApi(createJsonRequest({
    html: "<!doctype html><html lang=\"es\"><head><title>Demo</title></head><body><main>Hola local</main></body></html>",
    business: {
      name: "Bar Local",
      slug: "bar-local",
      category: "bar",
      location: "Sevilla"
    }
  }, {
    host: "127.0.0.1:5173",
    "x-forwarded-proto": "http"
  }), localPublishResponse, createContext());

  assert.equal(localPublishResponse.status, 201);
  const localPayload = JSON.parse(localPublishResponse.body);
  assert.match(localPayload.demo.url, /^http:\/\/127\.0\.0\.1:5173\/demos\/bar-local-/);
  assert.equal(localPayload.demo.shareable, false);
  assert.equal(localPayload.demo.shareStatus, "local-machine");
  assert.equal(localPayload.warnings.length, 1);

  let remoteRequestSeen = false;
  const remotePublishedAt = "2026-07-13T12:00:00.000Z";
  process.env.DEMO_REMOTE_PUBLISH_URL = "https://demos.example.com";
  process.env.DEMO_REMOTE_PUBLISH_TOKEN = "remote-token";
  globalThis.fetch = async (url, options = {}) => {
    remoteRequestSeen = true;
    assert.equal(String(url), "https://demos.example.com/api/demo-publish");
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Authorization, "Bearer remote-token");
    assert.equal(options.headers["X-DLS-Publish-Token"], "remote-token");
    const body = JSON.parse(options.body);
    assert.match(body.html, /Hola remoto/);
    assert.equal(body.business.slug, "demo-remota");
    assert.equal(body.ttlHours, 1);

    return new Response(JSON.stringify({
      demo: {
        id: "demo-remota-remote",
        path: "/demos/demo-remota-remote/",
        url: "https://demos.example.com/demos/demo-remota-remote/",
        source: "cloudflare-kv",
        shareable: true,
        shareStatus: "public-https",
        createdAt: remotePublishedAt,
        expiresAt: new Date(Date.now() + 3600000).toISOString()
      },
      publishedUrl: "https://demos.example.com/demos/demo-remota-remote/",
      warnings: []
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  };

  const remotePublishResponse = createResponse();
  await handleDemoPublishApi(createJsonRequest({
    html: "<!doctype html><html lang=\"es\"><head><title>Demo</title></head><body><main>Hola remoto</main></body></html>",
    business: {
      id: "biz_a",
      name: "Demo Remota",
      slug: "demo-remota",
      category: "clinica",
      location: "Sevilla",
      contactId: "contact_remote"
    }
  }), remotePublishResponse, createContext());

  assert.equal(remoteRequestSeen, true);
  assert.equal(remotePublishResponse.status, 201);
  const remotePayload = JSON.parse(remotePublishResponse.body);
  assert.equal(remotePayload.demo.url, "https://demos.example.com/demos/demo-remota-remote/");
  assert.equal(remotePayload.demo.source, "cloudflare-kv");
  assert.equal(remotePayload.automation.applied, true);
  assert.equal(remotePayload.automation.contactId, "contact_remote");
  assert.equal(remotePayload.automation.nextAction.dueDate, "2026-07-15T12:00:00.000Z");

  const beforeRemoteRetry = await readFile(dbPath, "utf8");
  const remoteRetryResponse = createResponse();
  await handleDemoPublishApi(createJsonRequest({
    html: "<!doctype html><html lang=\"es\"><head><title>Demo</title></head><body><main>Hola remoto</main></body></html>",
    business: {
      id: "biz_a",
      name: "Demo Remota",
      slug: "demo-remota",
      contactId: "contact_remote"
    }
  }), remoteRetryResponse, createContext());
  const remoteRetryPayload = JSON.parse(remoteRetryResponse.body);
  assert.equal(remoteRetryPayload.automation.reason, "existing-next-action");
  assert.equal(await readFile(dbPath, "utf8"), beforeRemoteRetry, "Remote retry with an active action must not save again");

  const replayStore = JSON.parse(beforeRemoteRetry);
  replayStore.contacts.find((contact) => contact.id === "contact_remote").nextAction = null;
  await writeFile(dbPath, `${JSON.stringify(replayStore, null, 2)}\n`, "utf8");
  const beforeClearedReplay = await readFile(dbPath, "utf8");
  const clearedReplayResponse = createResponse();
  await handleDemoPublishApi(createJsonRequest({
    html: "<!doctype html><html lang=\"es\"><head><title>Demo</title></head><body><main>Hola remoto</main></body></html>",
    business: {
      id: "biz_a",
      name: "Demo Remota",
      slug: "demo-remota",
      contactId: "contact_remote"
    }
  }), clearedReplayResponse, createContext());
  const clearedReplayPayload = JSON.parse(clearedReplayResponse.body);
  assert.equal(clearedReplayPayload.automation.reason, "already-applied");
  assert.equal(await readFile(dbPath, "utf8"), beforeClearedReplay, "Cleared automatic action must not be recreated on an idempotent replay");
} finally {
  globalThis.fetch = originalFetch;

  if (originalPublishDir === undefined) {
    delete process.env.DEMO_PUBLISH_DIR;
  } else {
    process.env.DEMO_PUBLISH_DIR = originalPublishDir;
  }

  if (originalTtl === undefined) {
    delete process.env.DEMO_PUBLISH_TTL_HOURS;
  } else {
    process.env.DEMO_PUBLISH_TTL_HOURS = originalTtl;
  }

  if (originalDemoPublicBaseUrl === undefined) {
    delete process.env.DEMO_PUBLIC_BASE_URL;
  } else {
    process.env.DEMO_PUBLIC_BASE_URL = originalDemoPublicBaseUrl;
  }

  if (originalPublicBaseUrl === undefined) {
    delete process.env.PUBLIC_BASE_URL;
  } else {
    process.env.PUBLIC_BASE_URL = originalPublicBaseUrl;
  }

  if (originalLocalliftPublicBaseUrl === undefined) {
    delete process.env.LOCALLIFT_PUBLIC_BASE_URL;
  } else {
    process.env.LOCALLIFT_PUBLIC_BASE_URL = originalLocalliftPublicBaseUrl;
  }

  if (originalRemotePublishUrl === undefined) {
    delete process.env.DEMO_REMOTE_PUBLISH_URL;
  } else {
    process.env.DEMO_REMOTE_PUBLISH_URL = originalRemotePublishUrl;
  }

  if (originalRemotePublishToken === undefined) {
    delete process.env.DEMO_REMOTE_PUBLISH_TOKEN;
  } else {
    process.env.DEMO_REMOTE_PUBLISH_TOKEN = originalRemotePublishToken;
  }

  restoreEnvironment("BUSINESS_STORE", originalBusinessStore);
  restoreEnvironment("BUSINESS_DB_DRIVER", originalBusinessDbDriver);
  restoreEnvironment("BUSINESS_DB_FILE", originalBusinessDbFile);
  restoreEnvironment("BUSINESS_DB_BACKUPS", originalBusinessDbBackups);
  restoreEnvironment("DATABASE_URL", originalDatabaseUrl);
  restoreEnvironment("POSTGRES_URL", originalPostgresUrl);
  restoreEnvironment("LOCALLIFT_DATABASE_URL", originalLocalliftDatabaseUrl);

  await rm(tempDir, { recursive: true, force: true });
}

console.log("Demo publish API tests passed.");

function createBusinessFixture() {
  const createdAt = "2026-07-01T09:00:00.000Z";
  return {
    version: 1,
    updatedAt: null,
    businesses: [
      { id: "biz_a", slug: "clinica-aurea", name: "Clinica Aurea" },
      { id: "biz_b", slug: "otro-negocio", name: "Otro negocio" }
    ],
    contacts: [
      {
        id: "contact_linked",
        businessId: "biz_a",
        type: "lead",
        status: "contacted",
        name: "Contacto vinculado",
        email: "linked@example.test",
        phone: "",
        nextAction: null,
        merged: false,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "contact_manual",
        businessId: "biz_a",
        type: "lead",
        status: "contacted",
        name: "Contacto manual",
        email: "manual@example.test",
        phone: "",
        nextAction: {
          type: "reunion",
          dueDate: "2026-07-20T09:00:00.000Z",
          status: "pendiente",
          note: "Accion definida por una persona",
          createdAt,
          updatedAt: createdAt
        },
        merged: false,
        createdAt,
        updatedAt: createdAt
      },
      {
        id: "contact_remote",
        businessId: "biz_a",
        type: "lead",
        status: "waiting",
        name: "Contacto remoto",
        email: "",
        phone: "+34 600 123 456",
        nextAction: null,
        merged: false,
        createdAt,
        updatedAt: createdAt
      }
    ],
    activities: [],
    proposals: [],
    messageTemplates: [],
    services: [],
    bookings: [],
    availability: [],
    bookingBlocks: [],
    bookingReminders: [],
    businessEvents: [],
    auditLog: []
  };
}

function restoreEnvironment(key, value) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function createContext(overrides = {}) {
  return {
    root: process.cwd(),
    baseHeaders: {},
    requestOrigin: "",
    ...overrides
  };
}

function createJsonRequest(payload, headers = {
  host: "studio.test",
  "x-forwarded-proto": "https"
}) {
  const body = Buffer.from(JSON.stringify(payload));
  return {
    method: "POST",
    url: "/api/demo-publish",
    headers,
    async *[Symbol.asyncIterator]() {
      yield body;
    }
  };
}

function createResponse() {
  return {
    status: 0,
    headers: {},
    body: "",
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body = "") {
      this.body = Buffer.isBuffer(body) ? body.toString("utf8") : String(body || "");
    }
  };
}
