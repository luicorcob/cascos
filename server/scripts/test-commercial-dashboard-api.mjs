import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleReportApi, isReportApiRequest } from "../api/report-api.mjs";
import {
  buildCommercialDashboardReport,
  buildCommercialLostReasons
} from "../lib/commercial-dashboard-report.mjs";
import { buildCommercialForecast } from "../lib/commercial-forecast.mjs";
import { buildCommercialSla } from "../lib/commercial-sla.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "dls-commercial-dashboard-api-"));
const dbPath = path.join(tempDir, "business-db.json");
const fixture = fixtureDb();
const previousEnvironment = captureEnvironment([
  "BUSINESS_STORE",
  "BUSINESS_DB_DRIVER",
  "BUSINESS_DB_FILE",
  "BUSINESS_DB_BACKUPS",
  "DATABASE_URL",
  "POSTGRES_URL",
  "LOCALLIFT_DATABASE_URL",
  "NODE_ENV"
]);

try {
  process.env.BUSINESS_STORE = "json";
  process.env.BUSINESS_DB_DRIVER = "json";
  process.env.BUSINESS_DB_FILE = dbPath;
  process.env.BUSINESS_DB_BACKUPS = "false";
  process.env.DATABASE_URL = "";
  process.env.POSTGRES_URL = "";
  process.env.LOCALLIFT_DATABASE_URL = "";
  process.env.NODE_ENV = "test";

  await writeFile(dbPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  await runApiTests();
  console.log("Commercial dashboard API tests passed.");
} finally {
  restoreEnvironment(previousEnvironment);
  await rm(tempDir, { recursive: true, force: true });
}

async function runApiTests() {
  assert.equal(isReportApiRequest("/api/businesses/biz_a/reports/commercial-dashboard"), true);
  assert.equal(isReportApiRequest("/api/businesses/negocio-a/reports/commercial-dashboard"), true);
  assert.equal(isReportApiRequest("/api/businesses/biz_a/reports/commercial-dashboard/extra"), false);

  const response = await apiRequest(
    "GET",
    "/api/businesses/biz_a/reports/commercial-dashboard?month=2026-06&hours=48"
  );
  assert.equal(response.status, 200);
  const dashboard = response.payload.commercialDashboard;
  const generatedAt = new Date(dashboard.generatedAt);
  const business = fixture.businesses[0];

  assert.equal(dashboard.business.id, "biz_a");
  assert.equal(dashboard.business.slug, "negocio-a");
  assert.deepEqual(dashboard.period, {
    month: "2026-06",
    from: "2026-06-01T00:00:00.000Z",
    to: "2026-07-01T00:00:00.000Z"
  });
  assert.deepEqual(dashboard.counts, {
    contacts: 5,
    leadsCreated: 2,
    customers: 2,
    activitiesCompleted: 4,
    proposalsSent: 2,
    proposalsAccepted: 1,
    bookingsConvertedToCustomer: 4
  });
  assert.deepEqual(dashboard.leadsBySource, [
    { source: "web", count: 2, percentage: 100 }
  ]);
  assert.deepEqual(
    dashboard.conversionByStatus.map(({ status, count, percentage }) => ({ status, count, percentage })),
    [
      { status: "new", count: 1, percentage: 20 },
      { status: "contacted", count: 0, percentage: 0 },
      { status: "waiting", count: 1, percentage: 20 },
      { status: "reserved", count: 0, percentage: 0 },
      { status: "won", count: 1, percentage: 20 },
      { status: "lost", count: 1, percentage: 20 },
      { status: "customer", count: 1, percentage: 20 }
    ]
  );
  assert.equal(dashboard.activities.total, 4);
  assert.deepEqual(dashboard.proposals, { sent: 2, accepted: 1 });
  assert.deepEqual(dashboard.convertedBookings, {
    total: 4,
    linkedByContactId: 1,
    linkedByIdentity: 3
  });

  // The aggregate must remain bit-for-bit coherent with the canonical builders
  // when all of them receive the same reporting instant and options.
  assert.deepEqual(
    dashboard,
    buildCommercialDashboardReport(fixture, business, {
      month: "2026-06",
      hours: 48,
      now: generatedAt
    })
  );
  assert.deepEqual(
    dashboard.forecast,
    buildCommercialForecast(fixture, business, { month: "2026-06", now: generatedAt })
  );
  assert.deepEqual(
    dashboard.sla,
    buildCommercialSla(fixture, business, { hours: 48, now: generatedAt })
  );

  const lostReasons = await apiRequest("GET", "/api/businesses/biz_a/reports/lost-reasons");
  assert.equal(lostReasons.status, 200);
  assert.deepEqual(dashboard.lostReasons, lostReasons.payload);
  assert.deepEqual(dashboard.lostReasons, buildCommercialLostReasons(fixture, business));
  assert.equal(dashboard.lostReasons.total, 1);
  assert.equal(dashboard.lostReasons.reasons.find((item) => item.reason === "precio").count, 1);

  const bySlug = await apiRequest(
    "GET",
    "/api/businesses/negocio-a/reports/commercial-dashboard?month=2026-06&hours=48"
  );
  assert.equal(bySlug.status, 200);
  assert.deepEqual(stableDashboard(bySlug.payload.commercialDashboard), stableDashboard(dashboard));

  const tenantB = await apiRequest(
    "GET",
    "/api/businesses/biz_b/reports/commercial-dashboard?month=2026-06&hours=48"
  );
  assert.equal(tenantB.status, 200);
  assert.equal(tenantB.payload.commercialDashboard.business.slug, "negocio-b");
  assert.equal(tenantB.payload.commercialDashboard.counts.contacts, 1);
  assert.deepEqual(tenantB.payload.commercialDashboard.leadsBySource, [
    { source: "tenant-b", count: 1, percentage: 100 }
  ]);
  assert.equal(tenantB.payload.commercialDashboard.activities.total, 1);
  assert.deepEqual(tenantB.payload.commercialDashboard.proposals, { sent: 1, accepted: 0 });
  assert.equal(tenantB.payload.commercialDashboard.convertedBookings.total, 0);
  assert(tenantB.payload.commercialDashboard.sla.responses.every((item) => item.contactId === "b_lead"));

  const defaultResponse = await apiRequest("GET", "/api/businesses/biz_a/reports/commercial-dashboard");
  assert.equal(defaultResponse.status, 200);
  const current = new Date(defaultResponse.payload.commercialDashboard.generatedAt);
  const expectedMonth = `${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, "0")}`;
  assert.equal(defaultResponse.payload.commercialDashboard.period.month, expectedMonth);
  assert.equal(defaultResponse.payload.commercialDashboard.sla.thresholdHours, 24);

  for (const pathname of [
    "/api/businesses/biz_a/reports/commercial-dashboard?month=",
    "/api/businesses/biz_a/reports/commercial-dashboard?month=2026-13",
    "/api/businesses/biz_a/reports/commercial-dashboard?month=2026-6",
    "/api/businesses/biz_a/reports/commercial-dashboard?month=%202026-06%20",
    "/api/businesses/biz_a/reports/commercial-dashboard?month=2026-06&month=2026-07"
  ]) {
    const invalid = await apiRequest("GET", pathname);
    assert.equal(invalid.status, 400, `${pathname} must fail strict month validation`);
    assert.match(invalid.payload.error, /month|YYYY-MM/);
  }

  for (const pathname of [
    "/api/businesses/biz_a/reports/commercial-dashboard?hours=",
    "/api/businesses/biz_a/reports/commercial-dashboard?hours=0",
    "/api/businesses/biz_a/reports/commercial-dashboard?hours=2160.01",
    "/api/businesses/biz_a/reports/commercial-dashboard?hours=24.000",
    "/api/businesses/biz_a/reports/commercial-dashboard?hours=24&hours=48"
  ]) {
    const invalid = await apiRequest("GET", pathname);
    assert.equal(invalid.status, 400, `${pathname} must fail strict hours validation`);
    assert.match(invalid.payload.error, /hours/);
  }

  const missingBusiness = await apiRequest(
    "GET",
    "/api/businesses/missing/reports/commercial-dashboard?month=2026-06"
  );
  assert.equal(missingBusiness.status, 404);

  const invalidBeforeLookup = await apiRequest(
    "GET",
    "/api/businesses/missing/reports/commercial-dashboard?month=bad"
  );
  assert.equal(invalidBeforeLookup.status, 400);

  const wrongMethod = await apiRequest(
    "POST",
    "/api/businesses/biz_a/reports/commercial-dashboard?month=2026-06",
    {}
  );
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.Allow, "GET, OPTIONS");

  const preflight = await apiRequest("OPTIONS", "/api/businesses/biz_a/reports/commercial-dashboard");
  assert.equal(preflight.status, 204);
}

function stableDashboard(dashboard) {
  return {
    ...dashboard,
    generatedAt: "",
    forecast: { ...dashboard.forecast, generatedAt: "" },
    sla: {
      ...dashboard.sla,
      generatedAt: "",
      untouched: dashboard.sla.untouched.map((contact) => ({
        ...contact,
        ageMs: 0,
        ageHours: 0
      }))
    }
  };
}

async function apiRequest(method, pathname, body = undefined) {
  const response = createResponse();
  await handleReportApi(createRequest(method, pathname, body), response, {
    root,
    baseHeaders: {},
    requestOrigin: ""
  });

  return {
    status: response.status,
    headers: response.headers,
    payload: response.body ? JSON.parse(response.body) : null
  };
}

function createRequest(method, url, payload) {
  const body = payload === undefined ? null : Buffer.from(JSON.stringify(payload));
  return {
    method,
    url,
    headers: { host: "studio.test" },
    async *[Symbol.asyncIterator]() {
      if (body) {
        yield body;
      }
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

function fixtureDb() {
  return {
    version: 1,
    updatedAt: null,
    businesses: [
      {
        id: "biz_a",
        slug: "negocio-a",
        name: "Negocio A",
        status: "published",
        content: { commerce: { currency: "EUR" } }
      },
      {
        id: "biz_b",
        slug: "negocio-b",
        name: "Negocio B",
        status: "published"
      }
    ],
    contacts: [
      contact("a_new", "biz_a", "new", "2026-06-02T08:00:00.000Z", {
        source: "Web",
        email: "new@example.com"
      }),
      contact("a_lost", "biz_a", "lost", "2026-06-03T08:00:00.000Z", {
        source: "web",
        lostReason: "precio"
      }),
      contact("a_waiting", "biz_a", "waiting", "2026-05-10T08:00:00.000Z", {
        source: "referral"
      }),
      contact("a_customer", "biz_a", "customer", "2026-05-01T08:00:00.000Z", {
        email: "CUSTOMER@EXAMPLE.COM",
        phone: "+34 600 111 222"
      }),
      contact("a_won", "biz_a", "won", "2026-05-02T08:00:00.000Z", {
        phone: "+34 611 222 333"
      }),
      contact("a_merged", "biz_a", "new", "2026-06-04T08:00:00.000Z", {
        merged: true,
        source: "must-not-appear"
      }),
      contact("b_lead", "biz_b", "new", "2026-06-02T08:00:00.000Z", {
        source: "tenant-b"
      })
    ],
    activities: [
      activity("a_created", "biz_a", "a_new", "lead.created", "2026-06-02T08:00:00.000Z", "web"),
      activity("a_note", "biz_a", "a_new", "note", "2026-06-02T10:00:00.000Z", "dashboard"),
      activity("a_next_done", "biz_a", "a_lost", "next_action.completed", "2026-06-03T10:00:00.000Z", "dashboard"),
      activity("a_proposal_sent", "biz_a", "a_customer", "proposal.status_changed", "2026-06-12T10:00:00.000Z", "crm-proposals", {
        metadata: { proposalId: "p_sent", previousStatus: "borrador", status: "enviada" }
      }),
      activity("a_proposal_accepted", "biz_a", "a_won", "proposal.status_changed", "2026-06-15T10:00:00.000Z", "crm-proposals", {
        metadata: { proposalId: "p_accepted", previousStatus: "enviada", status: "aceptada" }
      }),
      activity("a_automated", "biz_a", "a_waiting", "note", "2026-06-05T10:00:00.000Z", "crm-automation", {
        metadata: { automated: true }
      }),
      activity("a_outside", "biz_a", "a_waiting", "note", "2026-05-05T10:00:00.000Z", "dashboard"),
      activity("b_note", "biz_b", "b_lead", "note", "2026-06-02T09:00:00.000Z", "dashboard")
    ],
    proposals: [
      proposal("p_sent", "biz_a", "a_customer", "enviada", "2026-06-12T10:00:00.000Z"),
      proposal("p_accepted", "biz_a", "a_won", "aceptada", "2026-06-15T10:00:00.000Z"),
      proposal("p_legacy_sent", "biz_a", "a_waiting", "enviada", "2026-06-20T10:00:00.000Z"),
      proposal("p_outside", "biz_a", "a_waiting", "enviada", "2026-05-20T10:00:00.000Z"),
      proposal("p_tenant_b", "biz_b", "b_lead", "enviada", "2026-06-09T10:00:00.000Z")
    ],
    services: [],
    bookings: [
      booking("book_direct", "biz_a", "2026-06-06T09:00:00.000Z", { contactId: "a_customer" }),
      booking("book_direct_lead", "biz_a", "2026-06-07T09:00:00.000Z", {
        contactId: "a_new",
        email: "customer@example.com"
      }),
      booking("book_email", "biz_a", "2026-06-08T09:00:00.000Z", {
        email: " customer@example.com "
      }),
      booking("book_missing_direct", "biz_a", "2026-06-08T10:00:00.000Z", {
        contactId: "missing_contact",
        email: "customer@example.com"
      }),
      booking("book_phone", "biz_a", "2026-06-09T09:00:00.000Z", {
        phone: "+34 (611) 222-333"
      }),
      booking("book_unknown", "biz_a", "2026-06-10T09:00:00.000Z", {
        email: "unknown@example.com"
      }),
      booking("book_outside", "biz_a", "2026-07-01T00:00:00.000Z", {
        contactId: "a_customer"
      }),
      booking("book_tenant_b", "biz_b", "2026-06-10T09:00:00.000Z", {
        contactId: "b_lead"
      })
    ],
    bookingReminders: [],
    businessEvents: [],
    auditLog: []
  };
}

function contact(id, businessId, status, createdAt, overrides = {}) {
  return {
    id,
    businessId,
    type: "lead",
    status,
    name: id,
    phone: "",
    email: "",
    source: "manual",
    valueEstimate: 100,
    createdAt,
    ...overrides
  };
}

function activity(id, businessId, contactId, type, createdAt, source, overrides = {}) {
  return {
    id,
    businessId,
    contactId,
    type,
    title: type,
    note: type,
    source,
    createdAt,
    ...overrides
  };
}

function proposal(id, businessId, contactId, status, updatedAt) {
  return {
    id,
    businessId,
    contactId,
    package: "presencia_local",
    setupPrice: 500,
    monthlyPrice: 100,
    conditions: "Condiciones de prueba",
    expiresAt: "2026-08-01T00:00:00.000Z",
    status,
    createdAt: updatedAt,
    updatedAt
  };
}

function booking(id, businessId, startsAt, overrides = {}) {
  return {
    id,
    businessId,
    contactId: "",
    email: "",
    phone: "",
    startsAt,
    status: "confirmed",
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

function captureEnvironment(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnvironment(environment) {
  Object.entries(environment).forEach(([key, value]) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  });
}
