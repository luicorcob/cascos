import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleReportApi, isReportApiRequest } from "../api/report-api.mjs";
import {
  buildDataQualityReport,
  hasPendingNextAction,
  isUsableBookingUrl
} from "../lib/data-quality-report.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "dls-data-quality-api-"));
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

  const fixture = fixtureDb();
  await writeFile(dbPath, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  testPureReport(fixture);
  await testApi();
  console.log("Data quality API tests passed.");
} finally {
  restoreEnvironment(previousEnvironment);
  await rm(tempDir, { recursive: true, force: true });
}

function testPureReport(db) {
  const businessA = db.businesses.find((business) => business.id === "biz_a");
  const report = buildDataQualityReport(db, businessA, {
    now: new Date("2026-07-13T10:00:00.000Z")
  });

  assert.equal(report.generatedAt, "2026-07-13T10:00:00.000Z");
  assert.deepEqual(report.counts, {
    totalContacts: 9,
    contactsMissingPhoneOrEmail: 4,
    contactsWithoutAnyChannel: 2,
    openLeadsWithoutPendingNextAction: 2,
    customersWithoutConsent: 2,
    businessConfigurationIssues: 0,
    totalFindings: 8
  });
  assert.deepEqual(
    ids(report.contactsMissingPhoneOrEmail),
    ["lead_lost", "lead_missing_email", "lead_missing_phone", "lead_no_channels"]
  );
  assert.deepEqual(
    report.contactsMissingPhoneOrEmail.find((contact) => contact.id === "lead_missing_phone").missingFields,
    ["phone"]
  );
  assert.deepEqual(
    report.contactsMissingPhoneOrEmail.find((contact) => contact.id === "lead_no_channels").missingFields,
    ["phone", "email"]
  );
  assert.deepEqual(ids(report.openLeadsWithoutPendingNextAction), ["lead_done_action", "lead_missing_phone"]);
  assert.deepEqual(ids(report.customersWithoutConsent), ["customer_by_type", "customer_by_won"]);
  assert.equal(report.businessConfiguration.missingReviewUrl, false);
  assert.equal(report.businessConfiguration.reviewUrl, "https://reviews.example.test/a");
  assert.equal(report.businessConfiguration.missingBookingUrl, false);
  assert.equal(report.businessConfiguration.bookingUrl, "https://calendar.example.test/a");
  assert(!report.contactsMissingPhoneOrEmail.some((contact) => contact.id === "lead_merged"));

  const businessB = db.businesses.find((business) => business.id === "biz_b");
  const reportB = buildDataQualityReport(db, businessB, {
    now: new Date("2026-07-13T10:00:00.000Z")
  });
  assert.equal(reportB.businessConfiguration.missingReviewUrl, false, "Integration review URL must be recognized");
  assert.equal(reportB.businessConfiguration.missingBookingUrl, true, "WhatsApp must not satisfy booking configuration");
  assert.equal(reportB.businessConfiguration.bookingUrl, "");
  assert.equal(reportB.counts.businessConfigurationIssues, 1);
  assert.equal(reportB.counts.totalContacts, 1);

  assert.equal(hasPendingNextAction({ status: "pendiente" }), true);
  assert.equal(hasPendingNextAction({ status: "pending" }), true);
  assert.equal(hasPendingNextAction({ status: "vencida" }), true);
  assert.equal(hasPendingNextAction({ status: "hecha" }), false);
  assert.equal(hasPendingNextAction(null), false);
  assert.equal(isUsableBookingUrl("https://wa.me/34600111222"), false);
  assert.equal(isUsableBookingUrl("https://api.whatsapp.com/send?phone=34600111222"), false);
  assert.equal(isUsableBookingUrl("whatsapp://send?phone=34600111222"), false);
  assert.equal(isUsableBookingUrl("https://calendar.example.test/reservar"), true);
  assert.equal(isUsableBookingUrl("/reservar"), true);
  assert.equal(isUsableBookingUrl("tel:+34600111222"), false);
}

async function testApi() {
  assert.equal(isReportApiRequest("/api/businesses/biz_a/reports/data-quality"), true);
  assert.equal(isReportApiRequest("/api/businesses/negocio-a/reports/data-quality"), true);
  assert.equal(isReportApiRequest("/api/businesses/biz_a/reports/data-quality/extra"), false);

  const response = await apiRequest("GET", "/api/businesses/biz_a/reports/data-quality");
  assert.equal(response.status, 200);
  assert.equal(response.payload.dataQuality.business.id, "biz_a");
  assert.equal(response.payload.dataQuality.counts.totalContacts, 9);
  assert.equal(response.payload.dataQuality.counts.contactsWithoutAnyChannel, 2);

  const bySlug = await apiRequest("GET", "/api/businesses/negocio-a/reports/data-quality");
  assert.equal(bySlug.status, 200);
  assert.deepEqual(stableReport(bySlug.payload.dataQuality), stableReport(response.payload.dataQuality));

  const tenantB = await apiRequest("GET", "/api/businesses/biz_b/reports/data-quality");
  assert.equal(tenantB.status, 200);
  assert.equal(tenantB.payload.dataQuality.business.id, "biz_b");
  assert.equal(tenantB.payload.dataQuality.counts.totalContacts, 1);
  assert(tenantB.payload.dataQuality.contactsMissingPhoneOrEmail.every((contact) => contact.businessId === "biz_b"));
  assert.equal(tenantB.payload.dataQuality.businessConfiguration.missingBookingUrl, true);

  const missingBusiness = await apiRequest("GET", "/api/businesses/missing/reports/data-quality");
  assert.equal(missingBusiness.status, 404);

  const wrongMethod = await apiRequest("POST", "/api/businesses/biz_a/reports/data-quality", {});
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.Allow, "GET, OPTIONS");

  const preflight = await apiRequest("OPTIONS", "/api/businesses/biz_a/reports/data-quality");
  assert.equal(preflight.status, 204);
}

function stableReport(report) {
  const { generatedAt, ...stable } = report;
  return stable;
}

function ids(contacts) {
  return contacts.map((contact) => contact.id).sort();
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
  const createdAt = "2026-06-01T08:00:00.000Z";
  return {
    version: 1,
    updatedAt: null,
    businesses: [
      {
        id: "biz_a",
        slug: "negocio-a",
        name: "Negocio A",
        integrations: {
          booking: { url: "https://calendar.example.test/a" }
        },
        content: {
          bookingUrl: "https://wa.me/34600111222",
          google: { reviewUrl: "https://reviews.example.test/a" }
        }
      },
      {
        id: "biz_b",
        slug: "negocio-b",
        name: "Negocio B",
        integrations: {
          google: {
            reviewUrl: "https://reviews.example.test/b",
            appointmentUrl: "https://api.whatsapp.com/send?phone=34600999888"
          }
        },
        content: { bookingUrl: "https://wa.me/34600999888" }
      }
    ],
    contacts: [
      contact("lead_complete", "biz_a", "lead", "new", {
        phone: "+34 600 100 001",
        email: "complete@example.com",
        nextAction: { status: "pendiente", type: "llamada" }
      }, createdAt),
      contact("lead_missing_phone", "biz_a", "lead", "contacted", {
        email: "missing-phone@example.com",
        nextAction: null
      }, createdAt),
      contact("lead_missing_email", "biz_a", "lead", "waiting", {
        phone: "+34 600 100 003",
        nextAction: { status: "pending", type: "email" }
      }, createdAt),
      contact("lead_no_channels", "biz_a", "lead", "reserved", {
        nextAction: { status: "vencida", type: "whatsapp" }
      }, createdAt),
      contact("lead_done_action", "biz_a", "lead", "new", {
        phone: "+34 600 100 005",
        email: "done@example.com",
        nextAction: { status: "hecha", type: "llamada" }
      }, createdAt),
      contact("customer_by_type", "biz_a", "customer", "new", {
        phone: "+34 600 100 006",
        email: "type-customer@example.com",
        privacyAccepted: false
      }, createdAt),
      contact("customer_by_won", "biz_a", "lead", "won", {
        phone: "+34 600 100 007",
        email: "won@example.com"
      }, createdAt),
      contact("customer_with_consent", "biz_a", "lead", "customer", {
        phone: "+34 600 100 008",
        email: "consent@example.com",
        privacyAccepted: true
      }, createdAt),
      contact("lead_lost", "biz_a", "lead", "lost", {}, createdAt),
      contact("lead_merged", "biz_a", "lead", "new", {
        merged: true,
        privacyAccepted: false
      }, createdAt),
      contact("other_tenant", "biz_b", "lead", "new", {
        nextAction: null
      }, createdAt)
    ],
    activities: [],
    services: [],
    bookings: [],
    bookingReminders: [],
    businessEvents: [],
    auditLog: []
  };
}

function contact(id, businessId, type, status, overrides, createdAt) {
  return {
    id,
    businessId,
    type,
    status,
    name: id,
    phone: "",
    email: "",
    source: "manual",
    privacyAccepted: false,
    nextAction: null,
    createdAt,
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
