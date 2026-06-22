await import("../../src/studio/catalog.js");
await import("../../src/studio/stock-images.js");

const { handleStockImageApi } = await import("../api/stock-image-api.mjs");
const { createStockImageSearch } = globalThis.LocalLiftStudio.stockImages;

const search = createStockImageSearch({
  catalogConcurrency: 1,
  catalogMinItems: 200,
  catalogTargetItems: 240,
  catalogPageSize: 24,
  fetcher: fetchThroughLocalApi
});
const result = await search.discover({ minItems: 200, targetItems: 240, maxPages: 3 });
const categories = Object.fromEntries(search.categories.map((category) => [
  category.id,
  result.items.filter((item) => item.category === category.id).length
]));

console.log(JSON.stringify({
  items: result.items.length,
  categoryCount: result.categoryCount,
  categories
}, null, 2));

if (result.items.length < 200 || result.categoryCount < 15) {
  throw new Error("The live stock catalogue did not reach the required coverage.");
}

async function fetchThroughLocalApi(url) {
  const parsed = new URL(url);
  const response = createResponse();
  await handleStockImageApi({
    method: "GET",
    url: `${parsed.pathname}${parsed.search}`
  }, response, {
    baseHeaders: {},
    requestOrigin: ""
  });
  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    json: async () => JSON.parse(response.body || "{}")
  };
}

function createResponse() {
  return {
    status: 0,
    body: "",
    writeHead(status) {
      this.status = status;
    },
    end(body = "") {
      this.body = String(body);
    }
  };
}
