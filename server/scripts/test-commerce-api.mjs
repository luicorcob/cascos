import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const adminToken = "commerce-test-admin-token-32-characters";
const businessId = "biz_demo_brasa_norte";
const businessSlug = "brasa-norte";
let child;
let tempDir;
let logs = "";

async function main() {
  tempDir = await mkdtemp(path.join(root, ".tmp-commerce-test-"));
  const dbPath = path.join(tempDir, "business-db.json");
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: adminToken,
      CLIENT_SESSION_SECRET: "commerce-test-client-session-secret-32-characters",
      BUSINESS_STORE: "json",
      BUSINESS_DB_DRIVER: "json",
      DATABASE_URL: "",
      POSTGRES_URL: "",
      LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath,
      BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"),
      BUSINESS_DB_BACKUPS: "false",
      STRIPE_SECRET_KEY: "",
      STRIPE_COMMERCE_WEBHOOK_SECRET: ""
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  child.stdout.on("data", appendLog);
  child.stderr.on("data", appendLog);
  await waitForHealth(baseUrl);

  const prefix = `/api/businesses/${businessId}/commerce`;
  await request(baseUrl, `${prefix}/summary`, { expectedStatus: 401 });

  const initial = await admin(baseUrl, `${prefix}/summary`);
  assert.equal(initial.summary.business.id, businessId);
  assert.equal(initial.summary.products, 0);

  const settingsPayload = await admin(baseUrl, `${prefix}/settings`, {
    method: "PUT",
    body: {
      enabled: true,
      orderEmail: "pedidos@brasa.example",
      currency: "EUR",
      taxRatePercent: 10,
      taxIncluded: true,
      allowedCountries: ["ES", "PT"],
      shippingMethods: [
        { id: "pickup", name: "Recogida", price: 0, description: "En el local", active: true, default: true, allowedCountries: ["ES"] },
        { id: "delivery", name: "Reparto", price: 4.5, description: "Entrega local", active: true, default: false, allowedCountries: ["ES", "PT"] }
      ],
      publicBaseUrl: baseUrl
    }
  });
  assert.equal(settingsPayload.settings.enabled, true);
  assert.equal(settingsPayload.settings.shippingMethods.length, 2);
  assert.equal(settingsPayload.endpoints.products, `${baseUrl}/api/public/${businessSlug}/store/products`);

  const created = await admin(baseUrl, `${prefix}/products`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Tarjeta regalo",
      sku: "REGALO-50",
      price: 50,
      compareAtPrice: 0,
      stock: 8,
      category: "Regalos",
      description: "Crédito para disfrutar en el local.",
      active: true
    }
  });
  assert.equal(created.product.businessId, undefined);
  assert.equal(created.product.stock, 8);

  const duplicateSku = await admin(baseUrl, `${prefix}/products`, {
    method: "POST",
    expectedStatus: 409,
    body: { name: "Duplicado", sku: "REGALO-50", price: 10, stock: 1 }
  });
  assert.equal(duplicateSku.code, "commerce_product_sku_duplicate");

  const coupon = await admin(baseUrl, `${prefix}/coupons`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      code: "PORTAL10",
      type: "percent",
      value: 10,
      minSubtotal: 20,
      maxDiscount: 20,
      usageLimit: 3,
      active: true
    }
  });
  assert.equal(coupon.coupon.code, "PORTAL10");

  const publicProducts = await request(baseUrl, `/api/public/${businessSlug}/store/products`);
  assert.ok(publicProducts.products.some((item) => item.sku === "REGALO-50"));

  const publicConfig = await request(baseUrl, `/api/public/${businessSlug}/store/config`);
  assert.equal(publicConfig.settings.currency, "EUR");
  assert.equal(publicConfig.settings.shippingMethods.length, 2);
  assert.equal(publicConfig.settings.orderEmail, undefined);

  const quote = await request(baseUrl, `/api/public/${businessSlug}/store/cart/validate`, {
    method: "POST",
    body: {
      items: [{ id: created.product.id, quantity: 2 }],
      couponCode: "PORTAL10",
      shippingMethodId: "delivery"
    }
  });
  assert.equal(quote.totals.subtotal, 100);
  assert.equal(quote.totals.discount, 10);
  assert.equal(quote.totals.shipping, 4.5);
  assert.equal(quote.totals.total, 94.5);

  const checkout = await request(baseUrl, `/api/public/${businessSlug}/store/checkout`, {
    method: "POST",
    expectedStatus: 201,
    headers: { "Idempotency-Key": "commerce-test-checkout-1" },
    body: {
      customer: { name: "Cliente Demo", email: "cliente@example.com", phone: "600000000" },
      items: [{ id: created.product.id, quantity: 2 }],
      couponCode: "PORTAL10",
      shippingMethodId: "delivery"
    }
  });
  assert.match(checkout.orderId, /^commerce_order_/);
  assert.match(checkout.checkoutUrl, /development=1/);
  assert.equal(checkout.status, "paid");

  const duplicateCheckout = await request(baseUrl, `/api/public/${businessSlug}/store/checkout`, {
    method: "POST",
    headers: { "Idempotency-Key": "commerce-test-checkout-1" },
    body: {
      customer: { name: "Cliente Demo", email: "cliente@example.com" },
      items: [{ id: created.product.id, quantity: 2 }]
    }
  });
  assert.equal(duplicateCheckout.orderId, checkout.orderId);

  const publicOrder = await request(baseUrl, `/api/public/${businessSlug}/store/orders/${encodeURIComponent(checkout.orderId)}?token=${encodeURIComponent(checkout.token)}`);
  assert.equal(publicOrder.order.status, "paid");
  assert.equal(publicOrder.order.customer.email, undefined);

  const orders = await admin(baseUrl, `${prefix}/orders`);
  const order = orders.orders.find((item) => item.id === checkout.orderId);
  assert.equal(order.total, 94.5);
  assert.equal(order.status, "paid");

  const updatedOrder = await admin(baseUrl, `${prefix}/orders/${encodeURIComponent(order.id)}`, {
    method: "PATCH",
    body: { status: "ready", trackingNumber: "LOCAL-001" }
  });
  assert.equal(updatedOrder.order.status, "ready");
  assert.equal(updatedOrder.order.trackingNumber, "LOCAL-001");

  const updatedProduct = await admin(baseUrl, `${prefix}/products/${encodeURIComponent(created.product.id)}`, {
    method: "PATCH",
    body: { price: 55, active: true }
  });
  assert.equal(updatedProduct.product.price, 55);
  assert.equal(updatedProduct.product.stock, 6);

  await admin(baseUrl, `/api/businesses/${businessId}/portal-access`, {
    method: "POST",
    body: { password: "CommercePortal2026!" }
  });
  const login = await request(baseUrl, "/api/client/login", {
    method: "POST",
    body: { business: businessId, password: "CommercePortal2026!" }
  });
  const clientProducts = await request(baseUrl, `${prefix}/products`, {
    headers: { "X-LocalLift-Client-Token": login.session.token }
  });
  assert.ok(clientProducts.products.some((item) => item.id === created.product.id));

  const summary = await admin(baseUrl, `${prefix}/summary`);
  assert.equal(summary.summary.revenue, 94.5);
  assert.equal(summary.summary.paidOrders, 1);
  assert.equal(summary.summary.activeCoupons, 1);

  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  const business = persisted.businesses.find((item) => item.id === businessId);
  assert.equal(business.content.commerce.enabled, true);
  assert.ok(business.content.commerce.products.some((item) => item.sku === "REGALO-50" && item.stock === 6));
  assert.ok(business.content.commerce.orders.some((item) => item.id === checkout.orderId && item.businessId === businessId));
  assert.ok(business.content.commerce.coupons.some((item) => item.code === "PORTAL10" && item.used === 1));

  console.log("Commerce API checks passed: tenant scoping, catalog, coupons, quote, checkout, orders, portal auth and persistence.");
}

async function admin(baseUrl, pathname, options = {}) {
  return request(baseUrl, pathname, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${adminToken}` }
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
  const expectedStatus = options.expectedStatus || 200;
  if (response.status !== expectedStatus) {
    throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`);
    try { return await request(baseUrl, "/api/health"); } catch { await delay(150); }
  }
  throw new Error(`Healthcheck did not pass.\n${logs}`);
}

function freePort() {
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

function appendLog(chunk) { logs += chunk.toString(); }
function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

main()
  .catch((error) => {
    console.error(error.stack || error.message);
    if (logs) console.error(logs);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (child && child.exitCode === null) child.kill();
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });
