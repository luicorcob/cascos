import assert from "node:assert/strict";

await import("../../src/studio/commerce-model.js");
await import("../../src/studio/business-model.js");
await import("../../src/studio/public-runtime.js");
await import("../../src/studio/chatbot-controller.js");
await import("../../src/studio/storefront-controller.js");
await import("../../src/studio/site-image-controller.js");
await import("../../src/studio/intro-controller.js");
await import("../../src/studio/zip-archive.js");
await import("../../src/studio/delivery-controller.js");

const studio = globalThis.LocalLiftStudio;

assert.equal(typeof studio.commerce?.createCommerceModel, "function");
assert.equal(typeof studio.businessModel?.createBusinessModel, "function");
assert.equal(typeof studio.publicRuntime?.createPublicRuntime, "function");
assert.equal(typeof studio.chatbot?.createChatbotController, "function");
assert.equal(typeof studio.storefront?.createStorefrontController, "function");
assert.equal(typeof studio.siteImages?.createSiteImageController, "function");
assert.equal(typeof studio.intro?.createIntroController, "function");
assert.equal(typeof studio.delivery?.createDeliveryController, "function");

const demoBusiness = {
  heroImage: "https://example.com/default.webp",
  commerce: {
    title: "Tienda",
    intro: "Catalogo",
    currency: "EUR",
    taxRatePercent: 21,
    taxIncluded: true,
    deliveryMode: "pickup",
    shippingMethods: [{ id: "pickup", name: "Recogida", price: 0, default: true }],
    products: [{
      id: "demo",
      sku: "demo",
      name: "Demo",
      price: 10,
      image: "https://example.com/demo.webp",
      description: "Demo",
      stock: 5,
      active: true
    }]
  }
};
const clean = (value) => String(value || "").trim();
const commerce = studio.commerce.createCommerceModel({
  demoBusiness,
  textOr: (value, fallback) => clean(value) || fallback,
  numberOr: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
  parseLines: (value) => String(value || "").split(/\r?\n/).map(clean).filter(Boolean),
  parsePrice: (value) => Number(String(value || "").replace(",", ".")) || 0,
  formatPlainPrice: (value) => Number(value).toFixed(2),
  normalizeCurrency: (value) => clean(value).toUpperCase() || "EUR",
  normalizeOptionalUrl: clean,
  normalizeImage: (value, fallback) => clean(value) || fallback,
  slugify: (value) => clean(value).toLowerCase().replace(/\s+/g, "-")
});

const normalized = commerce.normalizeCommerce({
  currency: "usd",
  products: [{ name: "Producto", price: "12,50", stock: "3" }]
});
assert.equal(normalized.currency, "USD");
assert.equal(normalized.products[0].price, 12.5);
assert.equal(normalized.products[0].stock, 3);
assert.equal(
  commerce.deriveStoreEndpoint(
    "https://shop.example/api/store/checkout/session?draft=1",
    "/api/store/cart/validate"
  ),
  "https://shop.example/api/store/cart/validate"
);

assert.deepEqual(
  studio.delivery.inferDemoShareability("http://127.0.0.1:5173/demo"),
  {
    shareable: false,
    status: "local-machine",
    message: "La URL apunta a este ordenador."
  }
);
assert.equal(
  studio.delivery.inferDemoShareability("https://demo.example/client").shareable,
  true
);

const zip = studio.zipArchive.createZipBlob([
  { name: "index.html", content: "<h1>DLS</h1>" }
], new Date("2026-07-23T12:00:00Z"));
const signature = new Uint8Array(await zip.slice(0, 4).arrayBuffer());
assert.deepEqual(Array.from(signature), [0x50, 0x4b, 0x03, 0x04]);

console.log("Studio modular boundary tests passed.");
