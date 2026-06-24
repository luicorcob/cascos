import assert from "node:assert/strict";
import { handleStockImageApi } from "../api/stock-image-api.mjs";

const originalFetch = globalThis.fetch;

try {
  globalThis.fetch = async (url, options = {}) => {
    const endpoint = new URL(url);
    assert.equal(endpoint.hostname, "commons.wikimedia.org");
    assert.match(endpoint.searchParams.get("gsrsearch"), /bookstore interior/);
    assert.match(options.headers["User-Agent"], /DLS-Studio/);
    return {
      ok: true,
      json: async () => ({
        batchcomplete: true,
        query: {
          pages: [{
            pageid: 42,
            title: "File:Modern bookstore interior.jpg",
            imageinfo: [{
              thumburl: "https://upload.wikimedia.org/bookstore.jpg",
              descriptionurl: "https://commons.wikimedia.org/wiki/File:Modern_bookstore_interior.jpg",
              extmetadata: {
                ImageDescription: { value: "<p>Modern bookstore interior</p>" },
                Artist: { value: "<a>Test author</a>" },
                LicenseShortName: { value: "CC BY-SA 4.0" },
                Categories: { value: "Bookstores|Interior design" }
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
    url: "/api/stock-images?q=bookstore%20interior&page=1&page_size=24"
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
