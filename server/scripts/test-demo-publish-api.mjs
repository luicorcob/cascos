import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
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
const originalFetch = globalThis.fetch;
const tempDir = await mkdtemp(path.join(os.tmpdir(), "dls-demo-publish-"));

try {
  process.env.DEMO_PUBLISH_DIR = tempDir;
  process.env.DEMO_PUBLISH_TTL_HOURS = "1";
  delete process.env.DEMO_PUBLIC_BASE_URL;
  delete process.env.PUBLIC_BASE_URL;
  delete process.env.LOCALLIFT_PUBLIC_BASE_URL;
  delete process.env.DEMO_REMOTE_PUBLISH_URL;
  delete process.env.DEMO_REMOTE_PUBLISH_TOKEN;

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
        createdAt: new Date().toISOString(),
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
      name: "Demo Remota",
      slug: "demo-remota",
      category: "clinica",
      location: "Sevilla"
    }
  }), remotePublishResponse, createContext());

  assert.equal(remoteRequestSeen, true);
  assert.equal(remotePublishResponse.status, 201);
  const remotePayload = JSON.parse(remotePublishResponse.body);
  assert.equal(remotePayload.demo.url, "https://demos.example.com/demos/demo-remota-remote/");
  assert.equal(remotePayload.demo.source, "cloudflare-kv");
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

  await rm(tempDir, { recursive: true, force: true });
}

console.log("Demo publish API tests passed.");

function createContext() {
  return {
    root: process.cwd(),
    baseHeaders: {},
    requestOrigin: ""
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
