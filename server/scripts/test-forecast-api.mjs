import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleReportApi, isReportApiRequest } from "../api/report-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "dls-forecast-api-"));
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
  console.log("Forecast API tests passed.");
} finally {
  restoreEnvironment(previousEnvironment);
  await rm(tempDir, { recursive: true, force: true });
}

async function runApiTests() {
  assert.equal(isReportApiRequest("/api/businesses/biz_a/reports/forecast"), true);
  assert.equal(isReportApiRequest("/api/businesses/negocio-a/reports/forecast"), true);
  assert.equal(isReportApiRequest("/api/businesses/biz_a/reports/forecast/extra"), false);

  const response = await apiRequest("GET", "/api/businesses/biz_a/reports/forecast?month=2026-07");
  assert.equal(response.status, 200);
  const forecast = response.payload.forecast;
  assert.equal(forecast.business.id, "biz_a");
  assert.equal(forecast.business.name, "Negocio A");
  assert.equal(forecast.month, "2026-07");
  assert.equal(forecast.snapshotThrough, "2026-07-31T23:59:59.999Z");
  assert.equal(forecast.currency, "GBP");
  assert.equal(forecast.contacts, 7, "Other tenants, merged contacts and later contacts must be excluded");
  assert.equal(forecast.totalValueEstimate, 2800);
  assert.equal(forecast.weightedForecast, 1620);
  assert.equal(forecast.openWeightedForecast, 420);
  assert.equal(forecast.closedWonValue, 1200);
  assert.deepEqual(
    forecast.byStatus.map((row) => row.status),
    ["new", "contacted", "waiting", "reserved", "won", "lost", "customer"]
  );
  assert.deepEqual(forecast.byStatus.map((row) => row.weightedValue), [10, 50, 120, 240, 500, 0, 700]);
  assert.deepEqual(forecast.probabilities, {
    new: 0.1,
    contacted: 0.25,
    waiting: 0.4,
    reserved: 0.6,
    won: 1,
    lost: 0,
    customer: 1
  });

  const bySlug = await apiRequest("GET", "/api/businesses/negocio-a/reports/forecast?month=2026-07");
  assert.equal(bySlug.status, 200);
  assert.deepEqual(stableForecast(bySlug.payload.forecast), stableForecast(forecast));

  const tenantB = await apiRequest("GET", "/api/businesses/biz_b/reports/forecast?month=2026-07");
  assert.equal(tenantB.status, 200);
  assert.equal(tenantB.payload.forecast.contacts, 1);
  assert.equal(tenantB.payload.forecast.totalValueEstimate, 900);
  assert.equal(tenantB.payload.forecast.weightedForecast, 90);

  for (const pathname of [
    "/api/businesses/biz_a/reports/forecast",
    "/api/businesses/biz_a/reports/forecast?month=",
    "/api/businesses/biz_a/reports/forecast?month=2026-13",
    "/api/businesses/biz_a/reports/forecast?month=2026-7",
    "/api/businesses/biz_a/reports/forecast?month=07-2026",
    "/api/businesses/biz_a/reports/forecast?month=%202026-07%20",
    "/api/businesses/biz_a/reports/forecast?month=0000-07",
    "/api/businesses/biz_a/reports/forecast?month=2026-07&month=2026-08"
  ]) {
    const invalid = await apiRequest("GET", pathname);
    assert.equal(invalid.status, 400, `${pathname} must fail strict month validation`);
    assert.match(invalid.payload.error, /YYYY-MM/);
  }

  const missingBusiness = await apiRequest("GET", "/api/businesses/missing/reports/forecast?month=2026-07");
  assert.equal(missingBusiness.status, 404);

  const invalidBeforeLookup = await apiRequest("GET", "/api/businesses/missing/reports/forecast?month=bad");
  assert.equal(invalidBeforeLookup.status, 400);

  const wrongMethod = await apiRequest("POST", "/api/businesses/biz_a/reports/forecast?month=2026-07", {});
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.Allow, "GET, OPTIONS");

  const preflight = await apiRequest("OPTIONS", "/api/businesses/biz_a/reports/forecast");
  assert.equal(preflight.status, 204);
}

function stableForecast(forecast) {
  const { generatedAt, ...stable } = forecast;
  return stable;
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
        content: { commerce: { currency: "gbp" } }
      },
      {
        id: "biz_b",
        slug: "negocio-b",
        name: "Negocio B",
        status: "published",
        content: { currency: "usd" }
      }
    ],
    contacts: [
      contact("a_new", "biz_a", "new", 100),
      contact("a_contacted", "biz_a", "contacted", 200),
      contact("a_waiting", "biz_a", "waiting", 300),
      contact("a_reserved", "biz_a", "reserved", 400),
      contact("a_won", "biz_a", "won", 500),
      contact("a_lost", "biz_a", "lost", 600),
      contact("a_customer", "biz_a", "customer", 700, { type: "customer" }),
      contact("b_new", "biz_b", "new", 900),
      contact("a_merged", "biz_a", "new", 1000, { merged: true }),
      contact("a_later", "biz_a", "new", 1100, { createdAt: "2026-08-01T00:00:00.000Z" })
    ],
    activities: [],
    services: [],
    bookings: [],
    bookingReminders: [],
    businessEvents: [],
    auditLog: []
  };
}

function contact(id, businessId, status, valueEstimate, overrides = {}) {
  return {
    id,
    businessId,
    type: "lead",
    status,
    valueEstimate,
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
