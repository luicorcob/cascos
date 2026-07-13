import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleInboxApi, isInboxApiRequest } from "../api/inbox-api.mjs";
import {
  buildCommercialInbox,
  compareInboxItems,
  normalizeInboxTimezone,
  normalizeStaleCustomerDays,
  resolveInboxTimezone,
  zonedDateKey
} from "../lib/commercial-inbox.mjs";
import { setBusinessClientPassword } from "../lib/client-auth.mjs";

const NOW = new Date("2026-07-13T08:00:00.000Z");
const TIMEZONE = "Europe/Madrid";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const ADMIN_TOKEN = "inbox-test-admin-token-32-characters";
const BUSINESS_A = {
  id: "biz_a",
  slug: "alpha",
  name: "Alpha Local",
  content: {
    google: {
      reviewUrl: "https://example.com/review/alpha"
    }
  }
};
const BUSINESS_B = { id: "biz_b", slug: "beta", name: "Beta Local" };

const db = {
  businesses: [BUSINESS_A, BUSINESS_B],
  contacts: [
    contact("lead_newest", "biz_a", {
      name: "Lead reciente (registro antiguo)",
      status: "new",
      email: "recent@example.com",
      createdAt: "2026-07-12T08:00:00.000Z",
      updatedAt: "2026-07-12T08:00:00.000Z"
    }),
    contact("lead_newest", "biz_a", {
      name: "Lead reciente",
      status: "new",
      email: "recent@example.com",
      createdAt: "2026-07-13T07:30:00.000Z",
      updatedAt: "2026-07-13T07:45:00.000Z"
    }),
    contact("lead_older", "biz_a", {
      name: "Lead anterior",
      status: "new",
      createdAt: "2026-07-12T10:00:00.000Z"
    }),
    contact("lead_merged", "biz_a", {
      name: "Lead fusionado",
      status: "new",
      merged: true,
      createdAt: "2026-07-13T07:59:00.000Z"
    }),
    contact("action_old", "biz_a", {
      name: "Acción muy vencida",
      status: "contacted",
      nextAction: {
        type: "llamada",
        dueDate: "2026-07-10T18:00:00.000Z",
        status: "pendiente",
        note: "Confirmar decisión"
      }
    }),
    contact("action_recent", "biz_a", {
      name: "Acción vencida",
      status: "waiting",
      nextAction: {
        type: "email",
        dueDate: "2026-07-12T09:00:00.000Z",
        status: "pending"
      }
    }),
    contact("action_today", "biz_a", {
      name: "Acción de hoy",
      status: "waiting",
      nextAction: {
        type: "whatsapp",
        dueDate: "2026-07-12T22:30:00.000Z",
        status: "pendiente"
      }
    }),
    contact("customer_stale", "biz_a", {
      type: "customer",
      name: "Cliente sin seguimiento",
      status: "customer",
      email: "stale@example.com",
      createdAt: "2026-04-10T08:00:00.000Z",
      updatedAt: "2026-07-12T08:00:00.000Z",
      lastInteractionAt: "2026-05-20T08:00:00.000Z"
    }),
    contact("customer_recent", "biz_a", {
      type: "customer",
      name: "Cliente reciente",
      status: "customer",
      email: "review@example.com",
      createdAt: "2026-04-10T08:00:00.000Z",
      updatedAt: "2026-07-05T08:00:00.000Z",
      lastInteractionAt: "2026-07-05T08:00:00.000Z"
    }),
    contact("tenant_b_lead", "biz_b", {
      name: "Lead de otro negocio",
      status: "new",
      createdAt: "2026-07-13T07:59:00.000Z"
    }),
    contact("tenant_b_customer", "biz_b", {
      type: "customer",
      name: "Cliente de otro negocio",
      status: "customer",
      createdAt: "2026-01-01T00:00:00.000Z"
    })
  ],
  activities: [
    {
      id: "activity_stale_latest",
      businessId: "biz_a",
      contactId: "customer_stale",
      type: "note.created",
      note: "Último seguimiento conocido",
      createdAt: "2026-06-01T08:00:00.000Z"
    },
    {
      id: "activity_future_ignored",
      businessId: "biz_a",
      contactId: "customer_stale",
      type: "note.created",
      createdAt: "2026-08-01T08:00:00.000Z"
    },
    {
      id: "activity_automation_ignored",
      businessId: "biz_a",
      contactId: "customer_stale",
      type: "automation.review_scheduled",
      source: "crm-automation",
      note: "Tarea automática sin contacto humano",
      metadata: { automated: true },
      createdAt: "2026-07-10T08:00:00.000Z"
    },
    {
      id: "activity_other_tenant",
      businessId: "biz_b",
      contactId: "tenant_b_customer",
      type: "note.created",
      createdAt: "2026-07-12T08:00:00.000Z"
    }
  ],
  bookings: [
    booking("booking_today_pending", "biz_a", {
      customerName: "Reserva madrugada",
      email: "recent@example.com",
      startsAt: "2026-07-12T22:30:00.000Z",
      endsAt: "2026-07-12T23:30:00.000Z",
      status: "pending"
    }),
    booking("booking_today_confirmed", "biz_a", {
      customerName: "Reserva confirmada",
      startsAt: "2026-07-13T07:00:00.000Z",
      endsAt: "2026-07-13T08:00:00.000Z",
      status: "confirmed"
    }),
    booking("booking_today_canceled", "biz_a", {
      customerName: "Reserva cancelada",
      startsAt: "2026-07-13T09:00:00.000Z",
      endsAt: "2026-07-13T10:00:00.000Z",
      status: "canceled"
    }),
    booking("booking_review_latest", "biz_a", {
      customerName: "Cliente reseña",
      email: "review@example.com",
      startsAt: "2026-07-12T10:00:00.000Z",
      endsAt: "2026-07-12T11:00:00.000Z",
      status: "completed",
      updatedAt: "2026-07-12T11:05:00.000Z"
    }),
    booking("booking_review_older", "biz_a", {
      customerName: "Cliente reseña",
      email: "review@example.com",
      startsAt: "2026-06-20T10:00:00.000Z",
      endsAt: "2026-06-20T11:00:00.000Z",
      status: "completed",
      updatedAt: "2026-06-20T11:05:00.000Z"
    }),
    booking("booking_other_tenant", "biz_b", {
      customerName: "Reserva de otro negocio",
      startsAt: "2026-07-13T07:30:00.000Z",
      endsAt: "2026-07-13T08:30:00.000Z",
      status: "confirmed"
    })
  ],
  proposals: [
    proposal("proposal_viewed", "biz_a", {
      contactId: "lead_newest",
      status: "vista",
      expiresAt: "2026-07-14T18:00:00.000Z",
      updatedAt: "2026-07-13T07:00:00.000Z"
    }),
    proposal("proposal_sent", "biz_a", {
      contactId: "lead_older",
      status: "enviada",
      expiresAt: "2026-07-20T18:00:00.000Z",
      updatedAt: "2026-07-12T07:00:00.000Z"
    }),
    proposal("proposal_expired", "biz_a", {
      contactId: "lead_older",
      status: "enviada",
      expiresAt: "2026-07-13T07:59:59.000Z"
    }),
    proposal("proposal_draft", "biz_a", {
      contactId: "lead_older",
      status: "borrador",
      expiresAt: "2026-07-20T18:00:00.000Z"
    }),
    proposal("proposal_other_tenant", "biz_b", {
      contactId: "tenant_b_lead",
      status: "vista",
      expiresAt: "2026-07-14T18:00:00.000Z"
    })
  ]
};

testDateAndOptionHelpers();
testPureBuilder();
await testHttpHandler();
await testRegisteredRouteAndAuthorization();

console.log("Inbox API tests passed");

function testDateAndOptionHelpers() {
  assert.equal(zonedDateKey("2026-07-12T22:30:00.000Z", TIMEZONE), "2026-07-13");
  assert.equal(zonedDateKey("invalid", TIMEZONE), "");
  assert.equal(normalizeInboxTimezone("Atlantic/Canary"), "Atlantic/Canary");
  assert.equal(normalizeInboxTimezone("Invalid/Timezone"), TIMEZONE);
  assert.equal(resolveInboxTimezone({ CRM_TIMEZONE: "Atlantic/Canary", TZ: "UTC" }), "Atlantic/Canary");
  assert.equal(resolveInboxTimezone({ CRM_TIMEZONE: "Invalid/Timezone" }), TIMEZONE);
  assert.equal(normalizeStaleCustomerDays(undefined), 30);
  assert.equal(normalizeStaleCustomerDays("45"), 45);
  assert.throws(() => normalizeStaleCustomerDays(0), /between 1 and 3650/);
  assert.throws(() => normalizeStaleCustomerDays("1.5"), /between 1 and 3650/);
}

function testPureBuilder() {
  const snapshot = JSON.stringify(db);
  const inbox = buildCommercialInbox(db, BUSINESS_A, {
    now: NOW,
    timezone: TIMEZONE
  });

  assert.equal(JSON.stringify(db), snapshot, "Inbox aggregation must not mutate the store");
  assert.deepEqual(inbox.business, { id: "biz_a", slug: "alpha", name: "Alpha Local" });
  assert.equal(inbox.generatedAt, NOW.toISOString());
  assert.equal(inbox.timezone, TIMEZONE);
  assert.equal(inbox.staleCustomerDays, 30);
  assert.deepEqual(
    new Set(inbox.sections.map((item) => item.key)),
    new Set(["newLeads", "overdueActions", "todayBookings", "pendingProposals", "staleCustomers", "reviewSuggestions"])
  );

  const newLeads = section(inbox, "newLeads");
  assert.deepEqual(newLeads.items.map((item) => item.refId), ["lead_newest", "lead_older"]);
  assert.equal(newLeads.items[0].title, "Lead reciente", "The newest duplicate record must win");

  const overdueActions = section(inbox, "overdueActions");
  assert.deepEqual(overdueActions.items.map((item) => item.refId), ["action_old", "action_recent"]);
  assert.equal(overdueActions.items[0].details.overdueDays, 3);
  assert.ok(!overdueActions.items.some((item) => item.refId === "action_today"));

  const todayBookings = section(inbox, "todayBookings");
  assert.deepEqual(todayBookings.items.map((item) => item.refId), ["booking_today_pending", "booking_today_confirmed"]);
  assert.ok(!todayBookings.items.some((item) => item.refId === "booking_today_canceled"));

  const pendingProposals = section(inbox, "pendingProposals");
  assert.deepEqual(pendingProposals.items.map((item) => item.refId), ["proposal_viewed", "proposal_sent"]);
  assert.equal(pendingProposals.items[0].status, "vista");

  const staleCustomers = section(inbox, "staleCustomers");
  assert.deepEqual(staleCustomers.items.map((item) => item.refId), ["customer_stale"]);
  assert.equal(staleCustomers.items[0].details.lastInteractionAt, "2026-06-01T08:00:00.000Z");
  assert.equal(staleCustomers.items[0].details.daysWithoutFollowUp, 42);

  const reviewSuggestions = section(inbox, "reviewSuggestions");
  assert.deepEqual(reviewSuggestions.items.map((item) => item.refId), ["booking_review_latest"]);
  assert.equal(reviewSuggestions.items[0].contactId, "customer_recent");
  assert.equal(reviewSuggestions.items[0].details.reviewUrl, "https://example.com/review/alpha");

  const sectionUrgencies = inbox.sections.map((item) => item.items[0]?.urgency ?? item.priority);
  assertDescending(sectionUrgencies, "Sections must be ordered by urgency");
  inbox.sections.forEach((item) => {
    assert.equal(item.count, item.items.length);
    assert.equal(new Set(item.items.map((entry) => entry.id)).size, item.items.length, `${item.key} must be deduplicated`);
    for (let index = 1; index < item.items.length; index += 1) {
      assert.ok(compareInboxItems(item.items[index - 1], item.items[index]) <= 0, `${item.key} must be sorted`);
    }
  });
  assert.equal(inbox.total, inbox.sections.reduce((total, item) => total + item.items.length, 0));
  assert.ok(!JSON.stringify(inbox).includes("other_tenant"), "Tenant B data must not leak into tenant A");

  const tenantB = buildCommercialInbox(db, BUSINESS_B, { now: NOW, timezone: TIMEZONE });
  assert.deepEqual(section(tenantB, "newLeads").items.map((item) => item.refId), ["tenant_b_lead"]);
  assert.ok(!JSON.stringify(tenantB).includes("lead_newest"));

  const empty = buildCommercialInbox({}, BUSINESS_A, { now: NOW, timezone: TIMEZONE });
  assert.equal(empty.sections.length, 6);
  assert.equal(empty.total, 0);
  assert.ok(empty.sections.every((item) => item.count === 0));

  const threshold = buildCommercialInbox({
    contacts: [
      { id: "customer_day_30", businessId: "biz_a", type: "customer", status: "customer", createdAt: "2026-06-13T08:00:00.000Z" },
      { id: "customer_day_29", businessId: "biz_a", type: "customer", status: "customer", createdAt: "2026-06-14T08:00:00.000Z" },
      { id: "customer_no_history", businessId: "biz_a", type: "customer", status: "customer" }
    ]
  }, BUSINESS_A, { now: NOW, timezone: TIMEZONE });
  const thresholdItems = section(threshold, "staleCustomers").items;
  assert.deepEqual(new Set(thresholdItems.map((item) => item.refId)), new Set(["customer_day_30", "customer_no_history"]));
  const noHistory = thresholdItems.find((item) => item.refId === "customer_no_history");
  assert.equal(noHistory.details.daysWithoutFollowUp, null);
  assert.equal(noHistory.summary, "Sin seguimiento registrado");
}

async function testHttpHandler() {
  assert.equal(isInboxApiRequest("/api/businesses/biz_a/inbox"), true);
  assert.equal(isInboxApiRequest("/api/businesses/biz_a/inbox/extra"), false);
  assert.equal(isInboxApiRequest("/api/businesses/biz_a/reports/inbox"), false);

  const success = await invoke("/api/businesses/alpha/inbox?staleDays=40");
  assert.equal(success.status, 200);
  assert.equal(success.headers["Cache-Control"], "no-store");
  assert.equal(success.body.inbox.business.id, "biz_a");
  assert.equal(success.body.inbox.staleCustomerDays, 40);
  assert.equal(success.body.inbox.timezone, TIMEZONE);

  const defaultDays = await invoke("/api/businesses/biz_a/inbox");
  assert.equal(defaultDays.status, 200);
  assert.equal(defaultDays.body.inbox.staleCustomerDays, 30);

  const alias = await invoke("/api/businesses/biz_a/inbox?days=14");
  assert.equal(alias.status, 200);
  assert.equal(alias.body.inbox.staleCustomerDays, 14);

  for (const pathname of [
    "/api/businesses/biz_a/inbox?staleDays=",
    "/api/businesses/biz_a/inbox?staleDays=0",
    "/api/businesses/biz_a/inbox?staleDays=01",
    "/api/businesses/biz_a/inbox?staleDays=30.0",
    "/api/businesses/biz_a/inbox?staleDays=1e2",
    "/api/businesses/biz_a/inbox?staleDays=%2030%20",
    "/api/businesses/biz_a/inbox?staleDays=3651",
    "/api/businesses/biz_a/inbox?staleDays=30&staleDays=40",
    "/api/businesses/biz_a/inbox?days=30&days=40",
    "/api/businesses/biz_a/inbox?staleDays=30&days=30"
  ]) {
    const invalidDays = await invoke(pathname);
    assert.equal(invalidDays.status, 400, `${pathname} must fail strict stale-day validation`);
    assert.match(invalidDays.body.error, /between 1 and 3650/);
  }

  const maximumDays = await invoke("/api/businesses/biz_a/inbox?days=3650");
  assert.equal(maximumDays.status, 200);
  assert.equal(maximumDays.body.inbox.staleCustomerDays, 3650);

  const missingBusiness = await invoke("/api/businesses/missing/inbox");
  assert.equal(missingBusiness.status, 404);
  assert.equal(missingBusiness.body.error, "Business not found");

  const invalidBeforeLookup = await invoke("/api/businesses/missing/inbox?staleDays=bad");
  assert.equal(invalidBeforeLookup.status, 400);

  const wrongRoute = await invoke("/api/businesses/biz_a/inbox/extra");
  assert.equal(wrongRoute.status, 404);

  const wrongMethod = await invoke("/api/businesses/biz_a/inbox", "POST");
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.Allow, "GET, OPTIONS");

  const preflight = await invoke("/api/businesses/biz_a/inbox", "OPTIONS");
  assert.equal(preflight.status, 204);
  assert.equal(preflight.rawBody, "");

  const internalFailure = await invoke("/api/businesses/biz_a/inbox", "GET", async () => {
    throw new Error("sensitive storage detail");
  });
  assert.equal(internalFailure.status, 500);
  assert.equal(internalFailure.body.error, "Internal inbox API error");
}

async function testRegisteredRouteAndAuthorization() {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "dls-inbox-route-"));
  const dbPath = path.join(tempDir, "business-db.json");
  let child = null;
  let logs = "";

  try {
    const fixture = liveFixtureDb();
    await setBusinessClientPassword(fixture.businesses[0], "PortalInbox2026!", NOW.toISOString());
    await writeFile(dbPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");

    const port = await getFreePort();
    const baseUrl = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, ["server/server.mjs"], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(port),
        HOST: "127.0.0.1",
        NODE_ENV: "test",
        LOG_LEVEL: "error",
        LOCALLIFT_ADMIN_TOKEN: ADMIN_TOKEN,
        CLIENT_SESSION_SECRET: "inbox-test-client-session-secret-32-characters",
        CLIENT_LOGIN_RATE_LIMIT: "20",
        BUSINESS_STORE: "json",
        BUSINESS_DB_DRIVER: "json",
        DATABASE_URL: "",
        POSTGRES_URL: "",
        LOCALLIFT_DATABASE_URL: "",
        BUSINESS_DB_FILE: dbPath,
        BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"),
        BUSINESS_DB_BACKUPS: "false",
        CRM_TIMEZONE: TIMEZONE,
        TZ: "UTC"
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    child.stdout.on("data", (chunk) => { logs += String(chunk); });
    child.stderr.on("data", (chunk) => { logs += String(chunk); });
    await waitForHealth(baseUrl, child, () => logs);

    const unauthenticated = await liveJson(baseUrl, "/api/businesses/biz_a/inbox", { expectedStatus: 401 });
    assert.equal(unauthenticated.payload.code, "admin_auth_required");

    const adminHeaders = { Authorization: `Bearer ${ADMIN_TOKEN}` };
    const byId = await liveJson(baseUrl, "/api/businesses/biz_a/inbox", { headers: adminHeaders });
    assert.equal(byId.payload.inbox.business.id, "biz_a");
    assert.equal(byId.payload.inbox.staleCustomerDays, 30);
    assert.equal(byId.payload.inbox.timezone, TIMEZONE);
    assert.equal(byId.headers.get("cache-control"), "no-store");

    const bySlug = await liveJson(baseUrl, "/api/businesses/alpha/inbox?days=45", { headers: adminHeaders });
    assert.equal(bySlug.payload.inbox.business.id, "biz_a");
    assert.equal(bySlug.payload.inbox.staleCustomerDays, 45);

    const tenantB = await liveJson(baseUrl, "/api/businesses/biz_b/inbox", { headers: adminHeaders });
    assert.equal(tenantB.payload.inbox.business.id, "biz_b");
    assert.equal(JSON.stringify(tenantB.payload).includes("lead_newest"), false);

    await liveJson(baseUrl, "/api/businesses/biz_a/inbox?staleDays=30&days=30", {
      headers: adminHeaders,
      expectedStatus: 400
    });

    const login = await liveJson(baseUrl, "/api/client/login", {
      method: "POST",
      body: { business: "alpha", password: "PortalInbox2026!" }
    });
    const clientHeaders = { "X-LocalLift-Client-Token": login.payload.session.token };
    const clientById = await liveJson(baseUrl, "/api/businesses/biz_a/inbox", { headers: clientHeaders });
    const clientBySlug = await liveJson(baseUrl, "/api/businesses/alpha/inbox", { headers: clientHeaders });
    assert.equal(clientById.payload.inbox.business.id, "biz_a");
    assert.equal(clientBySlug.payload.inbox.business.id, "biz_a");

    const nextActions = await liveJson(baseUrl, "/api/businesses/biz_a/next-actions?filter=hoy", { headers: clientHeaders });
    assert.ok(Array.isArray(nextActions.payload.actions), "Client portal must retain access to next-actions");

    const forbiddenTenant = await liveJson(baseUrl, "/api/businesses/biz_b/inbox", {
      headers: clientHeaders,
      expectedStatus: 403
    });
    assert.equal(forbiddenTenant.payload.code, "client_forbidden");

    await liveJson(baseUrl, "/api/businesses/biz_a/inbox", {
      method: "POST",
      headers: clientHeaders,
      body: {},
      expectedStatus: 405
    });
    const preflight = await liveJson(baseUrl, "/api/businesses/biz_a/inbox", {
      method: "OPTIONS",
      expectedStatus: 204
    });
    assert.equal(preflight.text, "");
  } finally {
    if (child && child.exitCode === null) {
      child.kill();
      await Promise.race([
        new Promise((resolve) => child.once("exit", resolve)),
        delay(2000)
      ]);
    }
    if (path.basename(tempDir).startsWith("dls-inbox-route-")) {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}

function liveFixtureDb() {
  return {
    version: 1,
    updatedAt: NOW.toISOString(),
    businesses: JSON.parse(JSON.stringify(db.businesses)).map((business) => ({
      ...business,
      status: "published",
      settings: business.settings || {}
    })),
    contacts: JSON.parse(JSON.stringify(db.contacts)),
    activities: JSON.parse(JSON.stringify(db.activities)),
    proposals: JSON.parse(JSON.stringify(db.proposals)),
    messageTemplates: [],
    services: [],
    bookings: JSON.parse(JSON.stringify(db.bookings)),
    availability: [],
    bookingBlocks: [],
    bookingReminders: [],
    businessEvents: [],
    auditLog: []
  };
}

async function liveJson(baseUrl, pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  const init = { method: options.method || "GET", headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  const expectedStatus = options.expectedStatus ?? 200;
  assert.equal(response.status, expectedStatus, `${init.method} ${pathname}: ${text}`);
  return {
    status: response.status,
    headers: response.headers,
    text,
    payload: text ? JSON.parse(text) : null
  };
}

async function waitForHealth(baseUrl, child, getLogs) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before inbox routing tests.\n${getLogs()}`);
    }
    try {
      await liveJson(baseUrl, "/api/health");
      return;
    } catch {
      await delay(150);
    }
  }
  throw new Error(`Inbox routing healthcheck timed out.\n${getLogs()}`);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createNetServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function section(inbox, key) {
  const value = inbox.sections.find((item) => item.key === key);
  assert.ok(value, `Missing section: ${key}`);
  return value;
}

function assertDescending(values, message) {
  for (let index = 1; index < values.length; index += 1) {
    assert.ok(values[index - 1] >= values[index], message);
  }
}

async function invoke(url, method = "GET", loader = async () => db) {
  const capture = responseCapture();
  await handleInboxApi({ url, method }, capture.response, {
    baseHeaders: { "X-Test": "inbox" },
    env: { CRM_TIMEZONE: TIMEZONE },
    inboxNow: NOW,
    loadBusinessStore: loader
  });
  return capture.result();
}

function responseCapture() {
  let status = 0;
  let headers = {};
  let rawBody = "";

  return {
    response: {
      writeHead(nextStatus, nextHeaders) {
        status = nextStatus;
        headers = nextHeaders || {};
      },
      end(chunk = "") {
        rawBody += chunk ? String(chunk) : "";
      }
    },
    result() {
      return {
        status,
        headers,
        rawBody,
        body: rawBody ? JSON.parse(rawBody) : null
      };
    }
  };
}

function contact(id, businessId, overrides = {}) {
  return {
    id,
    businessId,
    type: "lead",
    name: id,
    status: "contacted",
    email: "",
    phone: "",
    source: "manual",
    nextAction: null,
    merged: false,
    createdAt: "2026-06-01T08:00:00.000Z",
    updatedAt: "2026-06-01T08:00:00.000Z",
    ...overrides
  };
}

function booking(id, businessId, overrides = {}) {
  return {
    id,
    businessId,
    contactId: "",
    serviceId: "service_1",
    serviceName: "Consulta",
    customerName: id,
    email: "",
    phone: "",
    startsAt: "2026-07-01T08:00:00.000Z",
    endsAt: "2026-07-01T09:00:00.000Z",
    status: "confirmed",
    createdAt: "2026-06-01T08:00:00.000Z",
    updatedAt: "2026-06-01T08:00:00.000Z",
    ...overrides
  };
}

function proposal(id, businessId, overrides = {}) {
  return {
    id,
    businessId,
    contactId: "lead_newest",
    package: "conversion_pro",
    setupPrice: 900,
    monthlyPrice: 250,
    conditions: "Condiciones de prueba",
    expiresAt: "2026-07-20T18:00:00.000Z",
    status: "enviada",
    createdAt: "2026-07-01T08:00:00.000Z",
    updatedAt: "2026-07-01T08:00:00.000Z",
    ...overrides
  };
}
