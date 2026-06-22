import assert from "node:assert/strict";

await import("../../src/studio/catalog.js");
await import("../../src/studio/curated-stock-images.js");
await import("../../src/studio/stock-images.js");

const { STOCK_IMAGE_CATEGORIES, createStockImageSearch } = globalThis.LocalLiftStudio.stockImages;
let requestedUrl = "";
const search = createStockImageSearch({
  endpoint: "https://example.test/v1/images/",
  pageSize: 9,
  fetcher: async (url) => {
    requestedUrl = url;
    return {
      ok: true,
      json: async () => ({
        result_count: 1200,
        next: "https://example.test/v1/images/?page=2",
        results: [
          {
            id: "one",
            title: "Local storefront",
            creator: "Creator",
            provider: "Wikimedia Commons",
            license: "cc0",
            url: "https://images.example.test/store.jpg",
            thumbnail: "https://images.example.test/store-thumb.jpg",
            foreign_landing_url: "https://commons.example.test/store"
          },
          {
            id: "bad",
            title: "Missing image",
            url: "ftp://example.test/file.jpg"
          }
        ]
      })
    };
  }
});

const result = await search.search({ category: "retail", query: "zapateria sevilla", page: 2 });
const params = new URL(requestedUrl).searchParams;

assert.equal(params.get("license"), "cc0");
assert.equal(params.get("page_size"), "9");
assert.equal(params.get("page"), "2");
assert.match(params.get("q"), /zapateria sevilla/);
assert.match(params.get("q"), /retail store/);
assert.equal(result.total, 1200);
assert.equal(result.hasNext, true);
assert.equal(result.items.length, 1);
assert.equal(result.items[0].license, "CC0");
assert.equal(result.items[0].url, "https://images.example.test/store.jpg");
assert.equal(result.items[0].sourceUrl, "https://commons.example.test/store");
assert.ok(search.builtInItems.length >= 200, "A curated built-in gallery should remain available offline");
assert.ok(search.builtInItems.every((item) => item.builtIn && item.category && item.thumbnail));

assert.ok(STOCK_IMAGE_CATEGORIES.length >= 20, "The gallery should cover at least 20 distinct collections");

let discoveryRequest = 0;
const discovery = createStockImageSearch({
  endpoint: "https://example.test/v1/images/",
  catalogMinItems: 3,
  catalogTargetItems: 3,
  fetcher: async (url) => {
    discoveryRequest += 1;
    const id = `discovery-${discoveryRequest}`;
    const query = new URL(url).searchParams.get("q");
    return {
      ok: true,
      json: async () => ({
        result_count: 100,
        next: null,
        results: [{
          id,
          title: `Varied image ${discoveryRequest}`,
          tags: [{ name: query }],
          provider: "Test provider",
          license: "cc0",
          url: `https://images.example.test/${id}.jpg`,
          thumbnail: `https://images.example.test/${id}-thumb.jpg`
        }]
      })
    };
  }
});
const gallery = await discovery.discover({
  categoryIds: ["food", "technology", "pets"],
  minItems: 3,
  targetItems: 3,
  maxPages: 1
});

assert.equal(gallery.items.length, 3);
assert.equal(gallery.categoryCount, 3);
assert.deepEqual(new Set(gallery.items.map((item) => item.category)), new Set(["food", "technology", "pets"]));
assert.ok(gallery.items.every((item) => item.categoryLabel), "Discovered images should retain their category");

let partialRequest = 0;
const partialDiscovery = createStockImageSearch({
  endpoint: "https://example.test/v1/images/",
  fetcher: async (url) => {
    partialRequest += 1;
    const request = partialRequest;
    const query = new URL(url).searchParams.get("q");
    return {
      ok: true,
      json: async () => ({
        result_count: 2,
        next: null,
        results: Array.from({ length: 2 }, (_, index) => ({
          id: `partial-${request}-${index}`,
          title: `Partial ${request}-${index}`,
          tags: [{ name: query }],
          license: "cc0",
          url: `https://images.example.test/partial-${request}-${index}.jpg`,
          thumbnail: `https://images.example.test/partial-${request}-${index}-thumb.jpg`
        }))
      })
    };
  }
});
const completedCategory = await partialDiscovery.discover({
  categoryIds: ["food"],
  minItems: 6,
  targetItems: 6,
  maxPages: 1
});

assert.equal(completedCategory.items.length, 6, "Fallback queries should complete sparse categories");
assert.equal(partialRequest, 3);

const curatedDiscovery = createStockImageSearch({
  endpoint: "https://example.test/v1/images/",
  fetcher: async () => ({
    ok: true,
    json: async () => ({
      result_count: 3,
      next: null,
      results: [
        {
          id: "tagged-dead-bat",
          title: "Pet shop archive",
          tags: [{ name: "dead bat" }, { name: "specimen" }],
          license: "cc0",
          url: "https://images.example.test/dead-bat.jpg",
          thumbnail: "https://images.example.test/dead-bat-thumb.jpg"
        },
        {
          id: "child-with-dog",
          title: "Child with dog",
          license: "cc0",
          url: "https://images.example.test/child.jpg",
          thumbnail: "https://images.example.test/child-thumb.jpg"
        },
        {
          id: "pet-shop",
          title: "Modern pet shop interior",
          tags: [{ name: "store" }, { name: "pet" }],
          license: "cc0",
          url: "https://images.example.test/pet-shop.jpg",
          thumbnail: "https://images.example.test/pet-shop-thumb.jpg"
        }
      ]
    })
  })
});
const curatedGallery = await curatedDiscovery.discover({
  categoryIds: ["pets"],
  minItems: 1,
  targetItems: 1,
  maxPages: 1
});

assert.equal(curatedGallery.items.length, 1);
assert.equal(curatedGallery.items[0].id, "pet-shop", "Unsafe or irrelevant tagged images should be rejected");

let abundantRequest = 0;
const abundantDiscovery = createStockImageSearch({
  endpoint: "https://example.test/v1/images/",
  fetcher: async (url) => {
    abundantRequest += 1;
    const request = abundantRequest;
    const query = new URL(url).searchParams.get("q");
    return {
      ok: true,
      json: async () => ({
        result_count: 500,
        next: null,
        results: Array.from({ length: 12 }, (_, index) => {
          const id = `catalog-${request}-${index}`;
          return {
            id,
            title: `Catalog image ${id}`,
            tags: [{ name: query }],
            provider: "Test provider",
            license: "cc0",
            url: `https://images.example.test/${id}.jpg`,
            thumbnail: `https://images.example.test/${id}-thumb.jpg`
          };
        })
      })
    };
  }
});
const abundantGallery = await abundantDiscovery.discover({ maxPages: 1 });

assert.ok(abundantGallery.items.length >= 200, "The default gallery should contain at least 200 images");
assert.equal(abundantGallery.items.length, 240);
assert.equal(abundantGallery.categoryCount, STOCK_IMAGE_CATEGORIES.length);

console.log("Studio stock image search tests passed.");
