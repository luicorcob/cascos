import assert from "node:assert/strict";
import worker from "../../cloudflare/demo-publisher-worker.js";

function demoHtml(text) {
  return `<!doctype html><html lang="es"><head><title>Demo</title></head><body><main>${text}</main></body></html>`;
}

class MemoryKv {
  constructor() {
    this.records = new Map();
  }

  async put(key, value, options = {}) {
    this.records.set(key, {
      value: String(value),
      expiresAt: options.expirationTtl ? Date.now() + Number(options.expirationTtl) * 1000 : 0
    });
  }

  async get(key, options = {}) {
    const record = this.records.get(key);

    if (!record) {
      return null;
    }

    if (record.expiresAt && record.expiresAt <= Date.now()) {
      this.records.delete(key);
      return null;
    }

    if (options.type === "json") {
      return JSON.parse(record.value);
    }

    return record.value;
  }

  async delete(key) {
    this.records.delete(key);
  }
}

const env = {
  DEMOS: new MemoryKv(),
  DEMO_PUBLISH_TOKEN: "test-publish-token",
  DEMO_TTL_HOURS: "1",
  CORS_ORIGIN: "https://studio.example.com,http://127.0.0.1:5173"
};

const allowedPreflight = await worker.fetch(new Request("https://demos.example.com/api/demo-publish", {
  method: "OPTIONS",
  headers: { Origin: "https://studio.example.com" }
}), env);
assert.equal(allowedPreflight.status, 204);
assert.equal(allowedPreflight.headers.get("Access-Control-Allow-Origin"), "https://studio.example.com");

const blockedPreflight = await worker.fetch(new Request("https://demos.example.com/api/demo-publish", {
  method: "OPTIONS",
  headers: { Origin: "https://evil.example" }
}), env);
assert.equal(blockedPreflight.status, 204);
assert.equal(blockedPreflight.headers.get("Access-Control-Allow-Origin"), null);

const unauthorized = await worker.fetch(new Request("https://demos.example.com/api/demo-publish", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "https://studio.example.com" },
  body: JSON.stringify({
    html: demoHtml("No entra"),
    business: { name: "Sin token" }
  })
}), env);

assert.equal(unauthorized.status, 401);

const publish = await worker.fetch(new Request("https://demos.example.com/api/demo-publish", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer test-publish-token",
    Origin: "https://studio.example.com"
  },
  body: JSON.stringify({
    html: demoHtml("Hola desde Cloudflare"),
    business: {
      name: "Clinica Aurea",
      slug: "clinica-aurea",
      category: "clinica",
      location: "Sevilla"
    },
    ttlHours: 1
  })
}), env);

assert.equal(publish.status, 201);
assert.equal(publish.headers.get("Access-Control-Allow-Origin"), "https://studio.example.com");
assert.match(publish.headers.get("Content-Security-Policy"), /object-src 'none'/);
const payload = await publish.json();
assert.match(payload.demo.id, /^clinica-aurea-/);
assert.match(payload.demo.url, /^https:\/\/demos\.example\.com\/demos\/clinica-aurea-/);
assert.equal(payload.demo.shareable, true);
assert.equal(payload.demo.source, "cloudflare-kv");
assert.equal(payload.warnings.length, 0);

const demo = await worker.fetch(new Request(payload.demo.url), env);
assert.equal(demo.status, 200);
assert.equal(demo.headers.get("Content-Type"), "text/html; charset=utf-8");
assert.equal(demo.headers.get("X-Robots-Tag"), "noindex, nofollow");
assert.equal(demo.headers.get("X-Frame-Options"), "SAMEORIGIN");
assert.match(demo.headers.get("Strict-Transport-Security"), /includeSubDomains/);
assert.match(await demo.text(), /Hola desde Cloudflare/);

const head = await worker.fetch(new Request(payload.demo.url, { method: "HEAD" }), env);
assert.equal(head.status, 200);
assert.equal(await head.text(), "");

console.log("Demo publisher Worker tests passed.");
