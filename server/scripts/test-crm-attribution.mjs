import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const adminToken = "crm-attribution-admin-token-32-characters";
const businessId = "biz_demo_brasa_norte";
const businessSlug = "brasa-norte";
let child;
let tempDir;
let logs = "";

async function main() {
  await testBrowserAttributionContracts();

  tempDir = await mkdtemp(path.join(os.tmpdir(), "locallift-crm-attribution-"));
  const dbPath = path.join(tempDir, "business-db.json");
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: adminToken,
      CLIENT_SESSION_SECRET: "crm-attribution-client-session-secret-32-characters",
      BUSINESS_STORE: "json",
      BUSINESS_DB_DRIVER: "json",
      BUSINESS_DB_FILE: dbPath,
      BUSINESS_DB_BACKUPS: "false",
      DATABASE_URL: "",
      POSTGRES_URL: "",
      LOCALLIFT_DATABASE_URL: "",
      PUBLIC_LEAD_RATE_LIMIT: "100",
      PUBLIC_BOOKING_RATE_LIMIT: "100",
      PUBLIC_EVENT_RATE_LIMIT: "100"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);

  await waitForHealth(baseUrl);
  await testContactAttribution(baseUrl);
  await testMergeAttribution(baseUrl);
  await testBookingAttribution(baseUrl);
  await testEventAttribution(baseUrl);
  await testPersistenceBoundary(dbPath);

  console.log("CRM attribution checks passed: first-touch contacts, merge, bookings, events and browser runtimes.");
}

async function testContactAttribution(baseUrl) {
  const campaign = "campaign-" + "x".repeat(280);
  const created = await request(baseUrl, `/api/public/${businessSlug}/leads`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Atribucion principal",
      email: "crm-attribution-primary@example.test",
      message: "Solicitud con first touch",
      utm_source: "  Google   Ads  ",
      utm_medium: " paid   social ",
      utm_campaign: campaign,
      utmTerm: "must-not-be-stored",
      attributionExtra: "must-not-be-stored"
    }
  });

  assert.equal(created.contact.utmSource, "Google Ads");
  assert.equal(created.contact.utmMedium, "paid social");
  assert.equal(created.contact.utmCampaign, campaign.slice(0, 240));
  assert.equal(created.contact.utmCampaign.length, 240);
  assert.equal(Object.hasOwn(created.contact, "utmTerm"), false);
  assert.equal(Object.hasOwn(created.contact, "attributionExtra"), false);

  const duplicate = await request(baseUrl, `/api/public/${businessSlug}/leads`, {
    method: "POST",
    expectedStatus: 200,
    body: {
      name: "Atribucion posterior",
      email: "crm-attribution-primary@example.test",
      utmSource: "newsletter",
      utmMedium: "email",
      utmCampaign: "later-campaign"
    }
  });
  assert.equal(duplicate.mergedWithExisting, true);
  assert.equal(duplicate.contact.id, created.contact.id);
  assertAttribution(duplicate.contact, {
    utmSource: "Google Ads",
    utmMedium: "paid social",
    utmCampaign: campaign.slice(0, 240)
  });

  const patched = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/${created.contact.id}`, {
    method: "PATCH",
    body: {
      utm_source: "overwrite-source",
      utm_medium: "overwrite-medium",
      utm_campaign: "overwrite-campaign"
    }
  });
  assertAttribution(patched.contact, {
    utmSource: "Google Ads",
    utmMedium: "paid social",
    utmCampaign: campaign.slice(0, 240)
  });

  const backfillCreated = await request(baseUrl, `/api/public/${businessSlug}/leads`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Atribucion parcial",
      email: "crm-attribution-backfill@example.test",
      utm_source: "referral"
    }
  });
  const backfilled = await request(baseUrl, `/api/public/${businessSlug}/leads`, {
    method: "POST",
    expectedStatus: 200,
    body: {
      name: "Atribucion parcial actualizada",
      email: "crm-attribution-backfill@example.test",
      utm_source: "later-source",
      utm_medium: "partner",
      utm_campaign: "partner-launch"
    }
  });
  assert.equal(backfilled.contact.id, backfillCreated.contact.id);
  assertAttribution(backfilled.contact, {
    utmSource: "referral",
    utmMedium: "partner",
    utmCampaign: "partner-launch"
  });

  const listed = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts`);
  const listedContact = listed.contacts.find((contact) => contact.id === created.contact.id);
  assert(listedContact, "Existing contact list must return the attributed contact");
  assert.equal(listedContact.utmSource, "Google Ads");
  assert(listed.contacts.every((contact) => contact.businessId === businessId), "Contact list must preserve tenant isolation");
}

async function testMergeAttribution(baseUrl) {
  const first = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Primer contacto merge",
      email: "crm-attribution-merge-first@example.test",
      utmSource: "organic-search",
      utmCampaign: "first-campaign"
    }
  });
  await delay(20);
  const survivor = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Superviviente merge",
      email: "crm-attribution-merge-survivor@example.test",
      utmSource: "partner-later",
      utmMedium: "affiliate",
      utmCampaign: "later-campaign"
    }
  });

  const merged = await adminRequest(baseUrl, `/api/businesses/${businessId}/contacts/merge`, {
    method: "POST",
    body: {
      survivorId: survivor.contact.id,
      duplicateIds: [first.contact.id]
    }
  });
  assertAttribution(merged.contact, {
    utmSource: "organic-search",
    utmMedium: "affiliate",
    utmCampaign: "first-campaign"
  });
  assert.equal(merged.merged[0].utmSource, "organic-search");
}

async function testBookingAttribution(baseUrl) {
  const services = await adminRequest(baseUrl, `/api/businesses/${businessId}/services`);
  const availability = await adminRequest(baseUrl, `/api/businesses/${businessId}/availability`);
  const service = services.services.find((item) => item.active !== false);
  const rule = availability.availability.find((item) => item.active !== false);
  assert(service && rule, "Booking fixture must expose an active service and availability rule");

  const startsAt = nextAvailableStart(rule, service.durationMinutes);
  const booking = await request(baseUrl, `/api/public/${businessSlug}/bookings`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      serviceId: service.id,
      startsAt: startsAt.toISOString(),
      customerName: "Reserva atribuida",
      email: "crm-attribution-booking@example.test",
      notes: "Reserva desde campana",
      utm_source: "instagram",
      utm_medium: "paid-social",
      utm_campaign: "booking-summer",
      utmContent: "must-not-be-stored"
    }
  });
  assertAttribution(booking.booking, {
    utmSource: "instagram",
    utmMedium: "paid-social",
    utmCampaign: "booking-summer"
  });
  assertAttribution(booking.contact, {
    utmSource: "instagram",
    utmMedium: "paid-social",
    utmCampaign: "booking-summer"
  });
  assert.equal(Object.hasOwn(booking.contact, "utmContent"), false);

  const existing = await request(baseUrl, `/api/public/${businessSlug}/leads`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Contacto antes de reservar",
      email: "crm-attribution-existing-booking@example.test",
      utm_source: "seo",
      utm_campaign: "evergreen"
    }
  });
  const laterStart = new Date(startsAt);
  laterStart.setHours(laterStart.getHours() + 3);
  const existingBooking = await request(baseUrl, `/api/public/${businessSlug}/bookings`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      serviceId: service.id,
      startsAt: laterStart.toISOString(),
      customerName: "Contacto antes de reservar",
      email: "crm-attribution-existing-booking@example.test",
      utm_source: "retargeting",
      utm_medium: "display",
      utm_campaign: "later-booking"
    }
  });
  assert.equal(existingBooking.contact.id, existing.contact.id);
  assertAttribution(existingBooking.contact, {
    utmSource: "seo",
    utmMedium: "display",
    utmCampaign: "evergreen"
  });
}

async function testEventAttribution(baseUrl) {
  const created = await request(baseUrl, `/api/public/${businessSlug}/events`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      event: {
        name: "lead_form_submit",
        utm_source: "  LinkedIn  ",
        utmMedium: " paid   social ",
        utmTerm: "must-not-be-promoted",
        detail: {
          utm_campaign: " Summer   Launch ",
          conversion: "lead"
        }
      }
    }
  });
  assert.equal(created.total, 1);
  assertAttribution(created.events[0], {
    utmSource: "LinkedIn",
    utmMedium: "paid social",
    utmCampaign: "Summer Launch"
  });
  assert.equal(Object.hasOwn(created.events[0], "utmTerm"), false);

  const listed = await adminRequest(baseUrl, `/api/businesses/${businessId}/events`);
  const event = listed.events.find((item) => item.id === created.events[0].id);
  assert(event, "Existing event endpoint must return attributed business events");
  assert.equal(event.utmCampaign, "Summer Launch");
  assert(listed.events.every((item) => item.businessId === businessId), "Event list must preserve tenant isolation");
}

async function testPersistenceBoundary(dbPath) {
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  const contact = db.contacts.find((item) => item.email === "crm-attribution-primary@example.test");
  const event = db.businessEvents.find((item) => item.name === "lead_form_submit" && item.utmSource === "LinkedIn");
  assert(contact && event, "Attribution must be persisted in contacts and businessEvents");
  assert.equal(Object.hasOwn(contact, "utmTerm"), false);
  assert.equal(Object.hasOwn(contact, "attributionExtra"), false);
  assert.equal(Object.hasOwn(event, "utmTerm"), false);
}

async function testBrowserAttributionContracts() {
  const [previewSource, exporterSource] = await Promise.all([
    readFile(path.join(root, "src", "app.js"), "utf8"),
    readFile(path.join(root, "src", "studio", "exporter.js"), "utf8")
  ]);
  const helperSource = previewSource.match(/function getUrlAttribution\(\) \{[\s\S]*?\n\}/)?.[0];
  assert(helperSource, "Preview runtime must expose its URL attribution helper");
  const sandbox = {
    URLSearchParams,
    window: {
      location: {
        search: "?utm_source=Google%20Ads&utm_medium=paid%20%20social&utm_campaign=Launch%20Plan&utm_term=ignored"
      }
    },
    result: null
  };
  vm.runInNewContext(`${helperSource}\nresult = getUrlAttribution();`, sandbox);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.result)), {
    utmSource: "Google Ads",
    utmMedium: "paid social",
    utmCampaign: "Launch Plan"
  });
  assert((previewSource.match(/\.\.\.getUrlAttribution\(\)/g) || []).length >= 3, "Preview forms and chatbot must attach URL attribution");
  assert.match(previewSource, /const attribution = getUrlAttribution\(\);/);
  assert((exporterSource.match(/\.\.\.getUrlAttribution\(\)/g) || []).length >= 3, "Exported forms and chatbot must attach URL attribution");
  assert.match(exporterSource, /\["utmCampaign", "utm_campaign", 240\]/);

  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousFetch = globalThis.fetch;
  try {
    globalThis.window = { LocalLiftApi: { getBase: () => "" } };
    globalThis.document = { styleSheets: [] };
    globalThis.fetch = async () => ({ ok: false, text: async () => "" });
    await import("../../src/studio/exporter.js");
    const { createExporter } = globalThis.LocalLiftStudio.exporter;
    const defaults = {
      id: "biz_runtime",
      slug: "runtime",
      name: "Runtime",
      category: "Servicios",
      tagline: "Runtime test",
      description: "Runtime test",
      heroImage: "",
      gallery: [],
      services: [],
      links: [],
      hours: [],
      google: {},
      commerce: { enabled: false, products: [] }
    };
    const exporter = createExporter({
      dataVersion: 1,
      getCurrentBusinessRecord: () => ({ id: defaults.id, slug: defaults.slug }),
      demoBusiness: defaults,
      renderSite: () => '<main class="generated-site"></main>',
      withBusinessDefaults: (business) => ({ ...defaults, ...business }),
      normalizeCommerce: () => ({ enabled: false, products: [], currency: "EUR" }),
      buildMapEmbedUrl: () => "",
      slugify: (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      splitTitleBody: (value) => ({ title: String(value || ""), body: "" }),
      escapeHtml: (value) => String(value || ""),
      escapeAttr: (value) => String(value || "")
    });
    const html = await exporter.buildExportDocument(defaults);
    const scripts = Array.from(html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g));
    const runtime = scripts.at(-1)?.[1] || "";
    assert.match(runtime, /function getUrlAttribution\(\)/);
    assert.match(runtime, /utm_source/);
    new vm.Script(runtime, { filename: "generated-export-runtime.js" });
  } finally {
    restoreGlobal("window", previousWindow);
    restoreGlobal("document", previousDocument);
    restoreGlobal("fetch", previousFetch);
  }
}

function assertAttribution(record, expected) {
  assert.equal(record.utmSource, expected.utmSource);
  assert.equal(record.utmMedium, expected.utmMedium);
  assert.equal(record.utmCampaign, expected.utmCampaign);
}

async function adminRequest(baseUrl, pathname, options = {}) {
  return request(baseUrl, pathname, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${adminToken}`
    }
  });
}

async function request(baseUrl, pathname, options = {}) {
  const headers = { ...options.headers };
  const init = { method: options.method || "GET", headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  const expectedStatus = options.expectedStatus ?? 200;
  if (response.status !== expectedStatus) {
    throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited before healthcheck passed.\n${logs}`);
    }
    try {
      return await request(baseUrl, "/api/health");
    } catch {
      await delay(150);
    }
  }
  throw new Error(`Healthcheck did not pass within 15 seconds.\n${logs}`);
}

function nextAvailableStart(rule, durationMinutes) {
  const [startHour, startMinute] = String(rule.startTime).split(":").map(Number);
  const [endHour, endMinute] = String(rule.endTime).split(":").map(Number);
  const duration = Number(durationMinutes || 60);
  if ((endHour * 60 + endMinute) - (startHour * 60 + startMinute) < duration + 180) {
    throw new Error("Availability rule is too short for the attribution booking checks");
  }
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  for (let offset = 0; offset < 14; offset += 1) {
    const candidate = new Date(date);
    candidate.setDate(date.getDate() + offset);
    if (candidate.getDay() === Number(rule.weekday)) {
      candidate.setHours(startHour, startMinute, 0, 0);
      return candidate;
    }
  }
  throw new Error("Could not find the next available booking date");
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function restoreGlobal(key, value) {
  if (value === undefined) {
    delete globalThis[key];
  } else {
    globalThis[key] = value;
  }
}

function appendLog(chunk) {
  logs += String(chunk);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function cleanup() {
  if (child && child.exitCode === null) {
    child.kill();
    await Promise.race([
      new Promise((resolve) => child.once("exit", resolve)),
      delay(2000)
    ]);
  }
  if (tempDir && path.basename(tempDir).startsWith("locallift-crm-attribution-")) {
    await rm(tempDir, { recursive: true, force: true });
  }
}

main()
  .catch((error) => {
    console.error(`CRM attribution checks failed: ${error.stack || error.message}`);
    process.exitCode = 1;
  })
  .finally(cleanup);
