import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  handleMessageTemplateApi,
  isMessageTemplateApiRequest
} from "../api/message-template-api.mjs";
import {
  MESSAGE_TEMPLATE_TYPES,
  buildMessageLinks,
  renderMessageTemplate
} from "../lib/message-template-renderer.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(os.tmpdir(), "dls-message-templates-"));
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

  testPureRenderer();
  await testApi();

  console.log("Message template API tests passed.");
} finally {
  restoreEnvironment(previousEnvironment);
  await rm(tempDir, { recursive: true, force: true });
}

function testPureRenderer() {
  const rendered = renderMessageTemplate({
    subject: "Hola {{ nombre }} - {{sin_catalogar}}",
    body: "Demo: {{demo_url}}. Campo seguro sin dato: {{email}}. No ejecutar: {{constructor.constructor}}."
  }, {
    nombre: "Ana",
    demo_url: "https://demo.example.test/ana"
  });

  assert.equal(rendered.subject, "Hola Ana - {{sin_catalogar}}");
  assert(rendered.message.includes("https://demo.example.test/ana"));
  assert(rendered.message.includes("{{email}}"), "Known placeholders without values must remain visible");
  assert(rendered.message.includes("{{constructor.constructor}}"), "Unknown placeholders must remain visible");
  assert.deepEqual(rendered.unknownPlaceholders.sort(), ["constructor.constructor", "sin_catalogar"]);
  assert.deepEqual(rendered.missingPlaceholders, ["email"]);

  const links = buildMessageLinks({
    phone: "+34 600 111 222",
    email: "ana@example.com",
    subject: "Asunto de prueba",
    message: "Mensaje con espacios y ñ"
  });
  assert(links.whatsappUrl.startsWith("https://wa.me/34600111222?text="));
  assert(links.mailtoUrl.startsWith("mailto:ana%40example.com?subject="));

  const invalidLinks = buildMessageLinks({ phone: "123", email: "not-an-email", message: "No link" });
  assert.deepEqual(invalidLinks, { whatsappUrl: "", mailtoUrl: "" });
}

async function testApi() {
  assert.equal(isMessageTemplateApiRequest("/api/businesses/biz_a/message-templates"), true);
  assert.equal(isMessageTemplateApiRequest("/api/businesses/biz_a/message-templates/default_envio_demo/render"), true);
  assert.equal(isMessageTemplateApiRequest("/api/businesses/biz_a/proposals"), false);

  const defaults = await apiRequest("GET", "/api/businesses/negocio-a/message-templates");
  assert.equal(defaults.status, 200);
  assert.equal(defaults.payload.total, 6);
  assert.deepEqual(defaults.payload.types, MESSAGE_TEMPLATE_TYPES);
  assert(defaults.payload.templates.every((template) => template.virtual === true));
  assert(defaults.payload.templates.every((template) => template.businessId === "biz_a"));

  const defaultDemo = defaults.payload.templates.find((template) => template.type === "envio_demo");
  assert(defaultDemo);
  const fetchedDefault = await apiRequest("GET", `/api/businesses/biz_a/message-templates/${defaultDemo.id}`);
  assert.equal(fetchedDefault.status, 200);
  assert.equal(fetchedDefault.payload.template.type, "envio_demo");

  const renderedDefault = await apiRequest("POST", "/api/businesses/biz_a/message-templates/render", {
    type: "envio_demo",
    contactId: "contact_a",
    demoUrl: "https://demo.example.test/negocio-a"
  });
  assert.equal(renderedDefault.status, 200);
  assert(renderedDefault.payload.subject.includes("Negocio A"));
  assert(renderedDefault.payload.message.includes("Alicia"));
  assert(renderedDefault.payload.message.includes("https://demo.example.test/negocio-a"));
  assert.equal(renderedDefault.payload.unknownPlaceholders.length, 0);
  assert(renderedDefault.payload.links.whatsappUrl.startsWith("https://wa.me/34600111222"));
  assert(renderedDefault.payload.links.mailtoUrl.startsWith("mailto:alicia%40example.com"));

  const invalidDemoUrl = await apiRequest("POST", "/api/businesses/biz_a/message-templates/render", {
    type: "envio_demo",
    contactId: "contact_a",
    demoUrl: "javascript:alert(1)"
  });
  assert.equal(invalidDemoUrl.status, 200);
  assert(invalidDemoUrl.payload.message.includes("{{demo_url}}"));
  assert(invalidDemoUrl.payload.missingPlaceholders.includes("demo_url"));
  assert(!invalidDemoUrl.payload.message.includes("javascript:"));

  const created = await apiRequest("POST", "/api/businesses/biz_a/message-templates", {
    template: {
      type: "primer_contacto",
      label: "Primer contacto personalizado",
      subject: "Hola {{nombre}} desde {{negocio}}",
      body: "Telefono: {{telefono}}. Dato futuro: {{campo_futuro}}. Texto literal: <script>alert('no')</script>."
    }
  });
  assert.equal(created.status, 201);
  assert.equal(created.payload.template.businessId, "biz_a");
  assert.equal(created.payload.template.isOverride, true);
  const overrideId = created.payload.template.id;

  const effective = await apiRequest("GET", "/api/businesses/biz_a/message-templates");
  assert.equal(effective.status, 200);
  assert.equal(effective.payload.total, 6, "An override must replace, not duplicate, its global default");
  assert.equal(effective.payload.templates.filter((template) => template.type === "primer_contacto").length, 1);
  assert.equal(effective.payload.templates.find((template) => template.type === "primer_contacto").id, overrideId);

  const renderedOverride = await apiRequest(
    "POST",
    `/api/businesses/biz_a/message-templates/${overrideId}/render`,
    { contactId: "contact_a" }
  );
  assert.equal(renderedOverride.status, 200);
  assert(renderedOverride.payload.message.includes("{{campo_futuro}}"));
  assert(renderedOverride.payload.unknownPlaceholders.includes("campo_futuro"));
  assert(renderedOverride.payload.message.includes("<script>alert('no')</script>"), "Rendering is textual and must not evaluate content");

  const duplicateType = await apiRequest("POST", "/api/businesses/biz_a/message-templates", {
    type: "primer_contacto",
    body: "Segundo override no permitido"
  });
  assert.equal(duplicateType.status, 409);

  const otherTenantCannotRead = await apiRequest("GET", `/api/businesses/biz_b/message-templates/${overrideId}`);
  assert.equal(otherTenantCannotRead.status, 404);
  const otherTenantCanOverrideSameType = await apiRequest("POST", "/api/businesses/biz_b/message-templates", {
    type: "primer contacto",
    label: "Override B",
    body: "Hola {{nombre}}, mensaje de {{negocio}}."
  });
  assert.equal(otherTenantCanOverrideSameType.status, 201);

  const crossTenantContact = await apiRequest(
    "POST",
    `/api/businesses/biz_a/message-templates/${overrideId}/render`,
    { contactId: "contact_b" }
  );
  assert.equal(crossTenantContact.status, 404);

  const updated = await apiRequest("PATCH", `/api/businesses/biz_a/message-templates/${overrideId}`, {
    subject: "Asunto actualizado para {{nombre}}",
    body: "Mensaje actualizado de {{negocio}} para {{nombre}}."
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.payload.template.createdAt, created.payload.template.createdAt);
  assert.equal(updated.payload.template.subject, "Asunto actualizado para {{nombre}}");

  const invalidType = await apiRequest("POST", "/api/businesses/biz_a/message-templates", {
    type: "plantilla_arbitraria",
    body: "No valida"
  });
  assert.equal(invalidType.status, 400);

  const reservedId = await apiRequest("POST", "/api/businesses/biz_a/message-templates", {
    id: "default_envio_demo",
    type: "envio_demo",
    body: "No debe ocupar el id virtual"
  });
  assert.equal(reservedId.status, 400);

  const emptyBody = await apiRequest("PATCH", `/api/businesses/biz_a/message-templates/${overrideId}`, {
    body: ""
  });
  assert.equal(emptyBody.status, 400);

  const cannotDeleteDefault = await apiRequest("DELETE", "/api/businesses/biz_a/message-templates/default_envio_demo");
  assert.equal(cannotDeleteDefault.status, 409);

  const deleted = await apiRequest("DELETE", `/api/businesses/biz_a/message-templates/${overrideId}`);
  assert.equal(deleted.status, 200);
  assert.equal(deleted.payload.deleted, true);
  assert.equal(deleted.payload.fallback.virtual, true);

  const afterDelete = await apiRequest("GET", "/api/businesses/biz_a/message-templates");
  const restoredDefault = afterDelete.payload.templates.find((template) => template.type === "primer_contacto");
  assert.equal(restoredDefault.virtual, true);

  const stored = JSON.parse(await readFile(dbPath, "utf8"));
  assert(stored.messageTemplates.some((template) => template.businessId === "biz_b"));
  assert(!stored.messageTemplates.some((template) => template.id === overrideId));
  assert(stored.auditLog.some((entry) => entry.type === "message_template.created" && entry.businessId === "biz_a"));
  assert(stored.auditLog.some((entry) => entry.type === "message_template.deleted" && entry.templateId === overrideId));
}

async function apiRequest(method, pathname, body = undefined) {
  const response = createResponse();
  await handleMessageTemplateApi(createRequest(method, pathname, body), response, {
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
        publishedUrl: "https://demo.example.test/current",
        settings: { activeDemo: { url: "https://demo.example.test/current" } },
        integrations: { google: { reviewUrl: "https://reviews.example.test/a" } },
        content: {}
      },
      {
        id: "biz_b",
        slug: "negocio-b",
        name: "Negocio B",
        status: "published",
        content: {}
      }
    ],
    contacts: [
      {
        id: "contact_a",
        businessId: "biz_a",
        name: "Alicia",
        phone: "+34 600 111 222",
        email: "alicia@example.com",
        status: "contacted"
      },
      {
        id: "contact_b",
        businessId: "biz_b",
        name: "Bruno",
        phone: "+34 600 333 444",
        email: "bruno@example.com",
        status: "new"
      }
    ],
    messageTemplates: [],
    auditLog: []
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
