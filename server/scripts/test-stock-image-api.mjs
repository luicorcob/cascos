import assert from "node:assert/strict";
import { handleStockImageApi } from "../api/stock-image-api.mjs";

const originalFetch = globalThis.fetch;
const originalUnsplashKey = process.env.UNSPLASH_ACCESS_KEY;

try {
  process.env.UNSPLASH_ACCESS_KEY = "test-unsplash-key";
  globalThis.fetch = async (url, options = {}) => {
    const endpoint = new URL(url);
    assert.equal(endpoint.hostname, "api.unsplash.com");
    assert.match(endpoint.searchParams.get("query"), /bookstore interior/);
    assert.equal(endpoint.searchParams.get("page"), "1");
    assert.equal(endpoint.searchParams.get("per_page"), "24");
    assert.equal(options.headers.Authorization, "Client-ID test-unsplash-key");
    assert.equal(options.headers["Accept-Version"], "v1");
    return {
      ok: true,
      json: async () => ({
        total: 40,
        results: [{
          id: "abc123",
          width: 1800,
          height: 1200,
          alt_description: "Modern bookstore interior",
          urls: {
            regular: "https://images.unsplash.com/photo-bookstore?w=1080",
            small: "https://images.unsplash.com/photo-bookstore?w=520",
            raw: "https://images.unsplash.com/photo-bookstore"
          },
          user: { name: "Unsplash Author" },
          links: {
            html: "https://unsplash.com/photos/abc123",
            download_location: "https://api.unsplash.com/photos/abc123/download"
          },
          tags: [{ title: "bookstore" }, { title: "interior" }]
        }]
      })
    };
  };

  const unsplashResponse = createResponse();
  await handleStockImageApi({
    method: "GET",
    url: "/api/stock-images?q=bookstore%20interior&page=1&page_size=24"
  }, unsplashResponse, {
    baseHeaders: {},
    requestOrigin: ""
  });
  const unsplashPayload = JSON.parse(unsplashResponse.body);
  assert.equal(unsplashResponse.status, 200);
  assert.equal(unsplashResponse.headers["X-Stock-Provider"], "unsplash");
  assert.equal(unsplashPayload.results[0].provider, "Unsplash");
  assert.equal(unsplashPayload.results[0].creator, "Unsplash Author");
  assert.equal(unsplashPayload.results[0].license, "Unsplash License");
  assert.equal(unsplashPayload.results[0].foreign_landing_url, "https://unsplash.com/photos/abc123?utm_source=DLS+Studio&utm_medium=referral");
  assert.equal(unsplashPayload.results[0].download_location, "https://api.unsplash.com/photos/abc123/download");

  globalThis.fetch = async (url, options = {}) => {
    const endpoint = new URL(url);
    assert.equal(endpoint.href, "https://api.unsplash.com/photos/abc123/download");
    assert.equal(options.headers.Authorization, "Client-ID test-unsplash-key");
    assert.equal(options.headers["Accept-Version"], "v1");
    return {
      ok: true,
      json: async () => ({
        url: "https://images.unsplash.com/photo-bookstore-download"
      })
    };
  };

  const downloadResponse = createResponse();
  await handleStockImageApi(createJsonRequest({
    downloadLocation: "https://api.unsplash.com/photos/abc123/download"
  }, "/api/stock-images/download"), downloadResponse, {
    baseHeaders: {},
    requestOrigin: ""
  });
  const downloadPayload = JSON.parse(downloadResponse.body);
  assert.equal(downloadResponse.status, 200);
  assert.equal(downloadPayload.ok, true);
  assert.equal(downloadPayload.url, "https://images.unsplash.com/photo-bookstore-download");

  delete process.env.UNSPLASH_ACCESS_KEY;
  globalThis.fetch = async (url, options = {}) => {
    const endpoint = new URL(url);
    assert.equal(endpoint.hostname, "commons.wikimedia.org");
    assert.match(endpoint.searchParams.get("gsrsearch"), /bakery interior/);
    assert.match(options.headers["User-Agent"], /DLS-Studio/);
    return {
      ok: true,
      json: async () => ({
        batchcomplete: true,
        query: {
          pages: [{
            pageid: 42,
            title: "File:Modern bakery interior.jpg",
            imageinfo: [{
              thumburl: "https://upload.wikimedia.org/bakery.jpg",
              descriptionurl: "https://commons.wikimedia.org/wiki/File:Modern_bakery_interior.jpg",
              extmetadata: {
                ImageDescription: { value: "<p>Modern bakery interior</p>" },
                Artist: { value: "<a>Test author</a>" },
                LicenseShortName: { value: "CC BY-SA 4.0" },
                Categories: { value: "Bakeries|Interior design" }
              }
            }]
          }]
        }
      })
    };
  };

  const commonsResponse = createResponse();
  await handleStockImageApi({
    method: "GET",
    url: "/api/stock-images?q=bakery%20interior&page=1&page_size=24"
  }, commonsResponse, {
    baseHeaders: {},
    requestOrigin: ""
  });
  const commonsPayload = JSON.parse(commonsResponse.body);
  assert.equal(commonsResponse.status, 200);
  assert.equal(commonsResponse.headers["X-Stock-Provider"], "wikimedia-commons");
  assert.equal(commonsPayload.results[0].provider, "Wikimedia Commons");
  assert.equal(commonsPayload.results[0].creator, "Test author");
  assert.equal(commonsPayload.results[0].license, "CC BY-SA 4.0");
} finally {
  globalThis.fetch = originalFetch;
  if (originalUnsplashKey === undefined) {
    delete process.env.UNSPLASH_ACCESS_KEY;
  } else {
    process.env.UNSPLASH_ACCESS_KEY = originalUnsplashKey;
  }
}

console.log("Stock image provider API tests passed.");

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
      this.body = String(body);
    }
  };
}

function createJsonRequest(payload, url) {
  const body = Buffer.from(JSON.stringify(payload));
  return {
    method: "POST",
    url,
    headers: {},
    async *[Symbol.asyncIterator]() {
      yield body;
    }
  };
}
