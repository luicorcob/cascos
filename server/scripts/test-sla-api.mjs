import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleReportApi, isReportApiRequest } from "../api/report-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "dls-sla-api-"));
const dbPath = path.join(tempDir, "business-db.json");
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

  await writeFile(dbPath, `${JSON.stringify(fixtureDb(), null, 2)}\n`, "utf8");
  await runApiTests();
  console.log("SLA API tests passed.");
} finally {
  restoreEnvironment(previousEnvironment);
  await rm(tempDir, { recursive: true, force: true });
}

async function runApiTests() {
  assert.equal(isReportApiRequest("/api/businesses/biz_a/reports/sla"), true);
  assert.equal(isReportApiRequest("/api/businesses/negocio-a/reports/sla"), true);
  assert.equal(isReportApiRequest("/api/businesses/biz_a/reports/sla/extra"), false);

  const defaultResponse = await apiRequest("GET", "/api/businesses/biz_a/reports/sla");
  assert.equal(defaultResponse.status, 200);
  const sla = defaultResponse.payload.sla;
  assert.equal(sla.business.id, "biz_a");
  assert.equal(sla.business.name, "Negocio A");
  assert.equal(sla.thresholdHours, 24);
  assert.equal(sla.totalContacts, 3, "Other tenants, merged contacts and invalid dates must be excluded");
  assert.equal(sla.responded, 1);
  assert.equal(sla.notResponded, 2);
  assert.equal(sla.withinSla, 1);
  assert.equal(sla.complianceRate, 100);
  assert.equal(sla.averageFirstResponseMinutes, 120);
  assert.equal(sla.medianFirstResponseMinutes, 120);
  assert.equal(sla.responses[0].contactId, "lead_responded");
  assert.equal(sla.responses[0].activityType, "contact.status_changed");
  assert.deepEqual(sla.untouched.map((contact) => contact.id), ["lead_untouched"]);

  const customThreshold = await apiRequest("GET", "/api/businesses/negocio-a/reports/sla?hours=48");
  assert.equal(customThreshold.status, 200);
  assert.equal(customThreshold.payload.sla.thresholdHours, 48);
  assert.equal(customThreshold.payload.sla.untouchedTotal, 0);
  assert.equal(customThreshold.payload.sla.business.id, "biz_a");

  const shortThreshold = await apiRequest("GET", "/api/businesses/biz_a/reports/sla?hours=1");
  assert.equal(shortThreshold.status, 200);
  assert.equal(shortThreshold.payload.sla.withinSla, 0);
  assert.equal(shortThreshold.payload.sla.complianceRate, 0);
  assert.deepEqual(
    shortThreshold.payload.sla.untouched.map((contact) => contact.id).sort(),
    ["lead_recent", "lead_untouched"]
  );

  const decimalThreshold = await apiRequest("GET", "/api/businesses/biz_a/reports/sla?hours=12.5");
  assert.equal(decimalThreshold.status, 200);
  assert.equal(decimalThreshold.payload.sla.thresholdHours, 12.5);

  const maximumThreshold = await apiRequest("GET", "/api/businesses/biz_a/reports/sla?hours=2160");
  assert.equal(maximumThreshold.status, 200);
  assert.equal(maximumThreshold.payload.sla.thresholdHours, 2160);

  const tenantB = await apiRequest("GET", "/api/businesses/biz_b/reports/sla");
  assert.equal(tenantB.status, 200);
  assert.equal(tenantB.payload.sla.totalContacts, 1);
  assert.equal(tenantB.payload.sla.responded, 0);
  assert(tenantB.payload.sla.untouched.every((contact) => contact.businessId === "biz_b"));

  for (const pathname of [
    "/api/businesses/biz_a/reports/sla?hours=",
    "/api/businesses/biz_a/reports/sla?hours=0",
    "/api/businesses/biz_a/reports/sla?hours=-1",
    "/api/businesses/biz_a/reports/sla?hours=2160.01",
    "/api/businesses/biz_a/reports/sla?hours=24.000",
    "/api/businesses/biz_a/reports/sla?hours=1e2",
    "/api/businesses/biz_a/reports/sla?hours=abc",
    "/api/businesses/biz_a/reports/sla?hours=%2024%20",
    "/api/businesses/biz_a/reports/sla?hours=24&hours=48"
  ]) {
    const invalid = await apiRequest("GET", pathname);
    assert.equal(invalid.status, 400, `${pathname} must fail strict hours validation`);
    assert.match(invalid.payload.error, /hours/);
  }

  const missingBusiness = await apiRequest("GET", "/api/businesses/missing/reports/sla");
  assert.equal(missingBusiness.status, 404);

  const invalidBeforeLookup = await apiRequest("GET", "/api/businesses/missing/reports/sla?hours=bad");
  assert.equal(invalidBeforeLookup.status, 400);

  const wrongMethod = await apiRequest("POST", "/api/businesses/biz_a/reports/sla", {});
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.Allow, "GET, OPTIONS");

  const preflight = await apiRequest("OPTIONS", "/api/businesses/biz_a/reports/sla");
  assert.equal(preflight.status, 204);
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
  const now = Date.now();
  const respondedCreatedAt = new Date(now - hours(30)).toISOString();
  const responseAt = new Date(now - hours(28)).toISOString();
  const untouchedCreatedAt = new Date(now - hours(30)).toISOString();
  const recentCreatedAt = new Date(now - hours(10)).toISOString();
  const tenantBCreatedAt = new Date(now - hours(40)).toISOString();

  return {
    version: 1,
    updatedAt: null,
    businesses: [
      { id: "biz_a", slug: "negocio-a", name: "Negocio A", status: "published" },
      { id: "biz_b", slug: "negocio-b", name: "Negocio B", status: "published" }
    ],
    contacts: [
      contact("lead_responded", "biz_a", respondedCreatedAt),
      contact("lead_untouched", "biz_a", untouchedCreatedAt),
      contact("lead_recent", "biz_a", recentCreatedAt),
      contact("lead_other_tenant", "biz_b", tenantBCreatedAt),
      contact("lead_merged", "biz_a", untouchedCreatedAt, { merged: true }),
      contact("lead_invalid", "biz_a", "not-a-date")
    ],
    activities: [
      activity("created", "biz_a", "lead_responded", "lead.created", respondedCreatedAt, "web"),
      activity("booking", "biz_a", "lead_responded", "booking.created", new Date(now - hours(29)).toISOString(), "booking"),
      activity("responded", "biz_a", "lead_responded", "contact.status_changed", responseAt, "dashboard"),
      activity("later", "biz_a", "lead_responded", "note", new Date(now - hours(20)).toISOString(), "dashboard"),
      activity("wrong_tenant", "biz_b", "lead_untouched", "note", new Date(now - hours(29)).toISOString(), "dashboard"),
      activity("automated", "biz_a", "lead_untouched", "note", new Date(now - hours(29)).toISOString(), "crm-automation", { metadata: { automated: true } })
    ],
    services: [],
    bookings: [],
    bookingReminders: [],
    businessEvents: [],
    auditLog: []
  };
}

function contact(id, businessId, createdAt, overrides = {}) {
  return {
    id,
    businessId,
    type: "lead",
    status: "new",
    name: id,
    phone: "+34 600 123 123",
    email: `${id}@example.com`,
    source: "web",
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

function hours(value) {
  return value * 60 * 60 * 1000;
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
