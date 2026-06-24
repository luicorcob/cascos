import { randomUUID, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Stripe from "stripe";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 8795);
const host = process.env.HOST || "127.0.0.1";
const dbPath = process.env.STORE_DB_PATH || path.join(root, "data", "store-db.json");
const corsOrigin = process.env.CORS_ORIGIN || "http://127.0.0.1:5173,http://localhost:5173";
const checkoutAllowedOrigins = process.env.CHECKOUT_ALLOWED_ORIGINS || corsOrigin;

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const adminToken = process.env.STORE_ADMIN_TOKEN || "";
const orderEmailTo = process.env.ORDER_EMAIL_TO || "";
const resendApiKey = process.env.RESEND_API_KEY || "";
const orderEmailFrom = process.env.ORDER_EMAIL_FROM || "DLS Store <orders@example.com>";
const checkoutTtlMinutes = Number(process.env.CHECKOUT_TTL_MINUTES || 45);
const maxCheckoutPerMinute = Number(process.env.CHECKOUT_RATE_LIMIT || 30);
const maxCartPerMinute = Number(process.env.CART_RATE_LIMIT || 90);
const maxAdminPerMinute = Number(process.env.ADMIN_RATE_LIMIT || 20);
const maxBodyBytes = Number(process.env.MAX_BODY_BYTES || 1_000_000);
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const allowedCorsOrigins = parseOriginList(corsOrigin);
const allowedCheckoutOrigins = parseOriginList(checkoutAllowedOrigins);
const allowAnyCorsOrigin = corsOrigin.split(",").map((item) => item.trim()).includes("*");
let dbWriteQueue = Promise.resolve();

const baseHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=15552000; includeSubDomains",
  "Origin-Agent-Cluster": "?1",
  "Cache-Control": "no-store"
};

const orderStatuses = new Set([
  "pending",
  "paid",
  "preparing",
  "ready",
  "fulfilled",
  "canceled",
  "expired",
  "failed",
  "refunded"
]);

const checkoutAttempts = new Map();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${host}:${port}`);
    setSecurityHeaders(request, response);

    if (request.headers.origin && !isAllowedCorsOrigin(request.headers.origin)) {
      sendJson(response, 403, { error: "Origin not allowed." });
      return;
    }

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, { ok: true, service: "locallift-commerce", version: 2 });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/store/config") {
      const db = await loadDb();
      await cleanupExpiredOrders(db);
      await saveDb(db);
      sendJson(response, 200, { settings: publicSettings(db.settings) });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/store/products") {
      const db = await loadDb();
      await cleanupExpiredOrders(db);
      await saveDb(db);
      sendJson(response, 200, { products: publicProducts(db.products, url.searchParams) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/store/cart/validate") {
      throttle(request, "cart", maxCartPerMinute);
      const body = await readJson(request);
      const db = await loadDb();
      await cleanupExpiredOrders(db);
      await saveDb(db);
      const quote = buildCartQuote(db, body);
      sendJson(response, 200, publicQuote(quote));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/store/checkout") {
      throttle(request, "checkout", maxCheckoutPerMinute);
      const body = await readJson(request);
      const result = await createCheckout(body, request);
      sendJson(response, 200, result);
      return;
    }

    if (request.method === "GET" && url.pathname.startsWith("/api/store/orders/")) {
      const id = decodeURIComponent(url.pathname.replace("/api/store/orders/", ""));
      const db = await loadDb();
      const order = db.orders.find((item) => item.id === id || item.orderNumber === id);
      if (!order) {
        sendJson(response, 404, { error: "Order not found" });
        return;
      }

      const token = url.searchParams.get("token") || "";
      if (!isAdmin(request) && token !== order.publicToken) {
        sendJson(response, 401, { error: "Invalid order token" });
        return;
      }

      sendJson(response, 200, { order: isAdmin(request) ? order : publicOrder(order) });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/store/webhook") {
      const rawBody = await readRaw(request);
      if (!stripe || !stripeWebhookSecret) {
        sendJson(response, 503, { error: "Stripe webhook verification is not configured." });
        return;
      }

      let event;
      try {
        event = stripe.webhooks.constructEvent(rawBody, request.headers["stripe-signature"] || "", stripeWebhookSecret);
      } catch (error) {
        sendJson(response, 400, { error: "Invalid Stripe signature." });
        return;
      }

      await handleStripeEvent(event);
      sendJson(response, 200, { received: true });
      return;
    }

    if (url.pathname.startsWith("/api/store/admin/")) {
      throttle(request, "admin", maxAdminPerMinute);
      requireAdmin(request);
      await handleAdmin(request, response, url);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/store/orders") {
      throttle(request, "admin", maxAdminPerMinute);
      requireAdmin(request);
      const db = await loadDb();
      await cleanupExpiredOrders(db);
      await saveDb(db);
      sendJson(response, 200, { orders: db.orders });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/store/products") {
      throttle(request, "admin", maxAdminPerMinute);
      requireAdmin(request);
      const body = await readJson(request);
      const db = await loadDb();
      const products = Array.isArray(body.products) ? body.products : [body];
      const saved = products.map((item) => upsertProduct(db, item, "admin"));
      await saveDb(db);
      sendJson(response, 201, { products: saved });
      return;
    }

    if (request.method === "PUT" && url.pathname.startsWith("/api/store/products/")) {
      throttle(request, "admin", maxAdminPerMinute);
      requireAdmin(request);
      const id = decodeURIComponent(url.pathname.replace("/api/store/products/", ""));
      const body = await readJson(request);
      const db = await loadDb();
      const product = upsertProduct(db, { ...body, id }, "admin");
      await saveDb(db);
      sendJson(response, 200, { product });
      return;
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/api/store/products/")) {
      throttle(request, "admin", maxAdminPerMinute);
      requireAdmin(request);
      const id = decodeURIComponent(url.pathname.replace("/api/store/products/", ""));
      const db = await loadDb();
      const product = db.products.find((item) => item.id === id || item.sku === id);
      if (!product) {
        sendJson(response, 404, { error: "Product not found" });
        return;
      }
      product.active = false;
      product.updatedAt = new Date().toISOString();
      appendAudit(db, "product.hidden", { productId: product.id, actor: "admin" });
      await saveDb(db);
      sendJson(response, 200, { product });
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, { error: error.message || "Internal error" });
  }
});

server.listen(port, host, () => {
  console.log(`DLS Commerce API running at http://${host}:${port}`);
  if (!isAdminTokenConfigured()) console.warn("SECURITY: set STORE_ADMIN_TOKEN with at least 32 characters before using admin routes.");
  if (!stripeWebhookSecret) console.warn("SECURITY: set STRIPE_WEBHOOK_SECRET before accepting Stripe webhooks.");
  if (allowAnyCorsOrigin) console.warn("SECURITY: CORS_ORIGIN=* is for local development only. Use explicit origins in production.");
  console.log("Public:  GET  /api/store/products");
  console.log("Public:  POST /api/store/cart/validate");
  console.log("Public:  POST /api/store/checkout");
  console.log("Webhook: POST /api/store/webhook");
  console.log("Admin:   GET  /api/store/admin/summary");
});

async function handleAdmin(request, response, url) {
  const pathname = url.pathname.replace("/api/store/admin", "");
  const db = await loadDb();
  await cleanupExpiredOrders(db);

  if (request.method === "GET" && pathname === "/summary") {
    await saveDb(db);
    sendJson(response, 200, { summary: buildSummary(db) });
    return;
  }

  if (request.method === "GET" && pathname === "/settings") {
    sendJson(response, 200, { settings: db.settings });
    return;
  }

  if (request.method === "PUT" && pathname === "/settings") {
    const body = await readJson(request);
    db.settings = normalizeSettings({ ...db.settings, ...body });
    appendAudit(db, "settings.updated", { actor: "admin" });
    await saveDb(db);
    sendJson(response, 200, { settings: db.settings });
    return;
  }

  if (request.method === "GET" && pathname === "/products") {
    await saveDb(db);
    sendJson(response, 200, { products: db.products });
    return;
  }

  if (request.method === "GET" && pathname === "/orders") {
    await saveDb(db);
    sendJson(response, 200, { orders: filterOrders(db.orders, url.searchParams) });
    return;
  }

  if (request.method === "PATCH" && pathname.startsWith("/orders/")) {
    const id = decodeURIComponent(pathname.replace("/orders/", "").replace("/status", ""));
    const body = await readJson(request);
    const order = updateOrderStatus(db, id, body);
    await saveDb(db);
    await maybeSendStatusEmail(order, body);
    sendJson(response, 200, { order });
    return;
  }

  if (request.method === "GET" && pathname === "/coupons") {
    sendJson(response, 200, { coupons: db.coupons });
    return;
  }

  if (request.method === "POST" && pathname === "/coupons") {
    const body = await readJson(request);
    const coupon = upsertCoupon(db, body);
    await saveDb(db);
    sendJson(response, 201, { coupon });
    return;
  }

  if (request.method === "PUT" && pathname.startsWith("/coupons/")) {
    const code = decodeURIComponent(pathname.replace("/coupons/", ""));
    const body = await readJson(request);
    const coupon = upsertCoupon(db, { ...body, code });
    await saveDb(db);
    sendJson(response, 200, { coupon });
    return;
  }

  if (request.method === "DELETE" && pathname.startsWith("/coupons/")) {
    const code = normalizeCouponCode(decodeURIComponent(pathname.replace("/coupons/", "")));
    const coupon = db.coupons.find((item) => item.code === code);
    if (!coupon) {
      sendJson(response, 404, { error: "Coupon not found" });
      return;
    }
    coupon.active = false;
    coupon.updatedAt = new Date().toISOString();
    appendAudit(db, "coupon.disabled", { code, actor: "admin" });
    await saveDb(db);
    sendJson(response, 200, { coupon });
    return;
  }

  if (request.method === "GET" && pathname === "/audit") {
    sendJson(response, 200, { auditLog: db.auditLog || [] });
    return;
  }

  sendJson(response, 404, { error: "Admin route not found" });
}

async function createCheckout(body, request) {
  if (!stripeSecretKey) {
    const error = new Error("Set STRIPE_SECRET_KEY before creating real payments.");
    error.statusCode = 503;
    throw error;
  }

  const db = await loadDb();
  await cleanupExpiredOrders(db);

  const idempotencyKey = cleanText(request.headers["idempotency-key"] || body.idempotencyKey || "");
  if (idempotencyKey) {
    const existing = db.orders.find((order) => order.idempotencyKey === idempotencyKey && order.status === "pending");
    if (existing?.checkoutUrl) {
      sendAuditForExistingCheckout(db, existing);
      await saveDb(db);
      return { orderId: existing.id, orderNumber: existing.orderNumber, token: existing.publicToken, url: existing.checkoutUrl };
    }
  }

  const customer = normalizeCustomer(body.customer || {});
  if (!customer.email) {
    const error = new Error("Customer email is required for Stripe Checkout receipts.");
    error.statusCode = 400;
    throw error;
  }

  const quote = buildCartQuote(db, body);
  if (quote.totals.total <= 0) {
    const error = new Error("Order total must be greater than zero for Stripe Checkout.");
    error.statusCode = 400;
    throw error;
  }
  const now = new Date();
  const order = {
    id: `ord_${randomUUID()}`,
    orderNumber: nextOrderNumber(db),
    publicToken: randomUUID(),
    idempotencyKey,
    status: "pending",
    businessName: cleanText(body.businessName || db.settings.businessName || "Pedido online"),
    orderEmail: cleanText(body.orderEmail || db.settings.orderEmail || orderEmailTo),
    customer,
    currency: quote.currency,
    items: quote.items.map(({ product, quantity, lineSubtotal, lineDiscount, lineTotal }) => ({
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      image: product.image,
      price: product.price,
      quantity,
      lineSubtotal,
      lineDiscount,
      lineTotal
    })),
    coupon: quote.coupon ? { code: quote.coupon.code, type: quote.coupon.type, value: quote.coupon.value } : null,
    shippingMethod: quote.shippingMethod,
    totals: quote.totals,
    total: quote.totals.total,
    taxIncluded: quote.taxIncluded,
    inventoryReserved: true,
    events: [{ type: "order.created", at: now.toISOString(), actor: "system" }],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + checkoutTtlMinutes * 60_000).toISOString()
  };

  reserveStock(db, order.items);
  db.orders.unshift(order);
  appendAudit(db, "order.created", { orderId: order.id, orderNumber: order.orderNumber });
  await saveDb(db);

  try {
    const session = await createStripeSession({
      order,
      successUrl: cleanCheckoutRedirectUrl(body.successUrl || db.settings.successUrl || "http://127.0.0.1:5173/?pedido=ok"),
      cancelUrl: cleanCheckoutRedirectUrl(body.cancelUrl || db.settings.cancelUrl || "http://127.0.0.1:5173/#tienda")
    });

    order.stripeCheckoutSessionId = session.id;
    order.checkoutUrl = session.url;
    order.updatedAt = new Date().toISOString();
    order.events.push({ type: "checkout.created", at: order.updatedAt, actor: "stripe", sessionId: session.id });
    appendAudit(db, "checkout.created", { orderId: order.id, sessionId: session.id });
    await saveDb(db);

    return { orderId: order.id, orderNumber: order.orderNumber, token: order.publicToken, url: session.url };
  } catch (error) {
    releaseStock(db, order.items);
    order.inventoryReserved = false;
    order.status = "failed";
    order.updatedAt = new Date().toISOString();
    order.events.push({ type: "checkout.failed", at: order.updatedAt, actor: "stripe", message: error.message });
    await saveDb(db);
    throw error;
  }
}

async function createStripeSession({ order, successUrl, cancelUrl }) {
  if (!stripe) {
    const error = new Error("Set STRIPE_SECRET_KEY before creating real payments.");
    error.statusCode = 503;
    throw error;
  }

  const success = appendOrderParams(successUrl, order);
  const cancel = appendOrderParams(cancelUrl, order);
  const lineItems = buildStripeLineItems(order);

  try {
    return await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: success,
      cancel_url: cancel,
      customer_email: order.customer.email,
      client_reference_id: order.id,
      metadata: {
        order_id: order.id,
        order_number: order.orderNumber,
        business_name: order.businessName.slice(0, 500)
      },
      payment_intent_data: {
        metadata: {
          order_id: order.id,
          order_number: order.orderNumber
        }
      },
      invoice_creation: { enabled: true },
      line_items: lineItems.map((line) => ({
        quantity: 1,
        price_data: {
          currency: order.currency.toLowerCase(),
          unit_amount: line.amountCents,
          product_data: {
            name: line.name,
            description: line.description || line.name,
            images: /^https?:\/\//i.test(line.image || "") ? [line.image] : undefined,
            metadata: line.sku ? { sku: line.sku } : undefined
          }
        }
      })),
      shipping_address_collection: {
        allowed_countries: order.shippingMethod.allowedCountries.slice(0, 20)
      }
    }, {
      idempotencyKey: order.idempotencyKey || order.id
    });
  } catch (stripeError) {
    const error = new Error(stripeError.message || "Stripe Checkout failed.");
    error.statusCode = 502;
    throw error;
  }
}

function buildCartQuote(db, body) {
  const settings = normalizeSettings(db.settings || {});
  const currency = normalizeCurrency(body.currency || settings.currency);
  const requestedItems = Array.isArray(body.items) ? body.items.slice(0, 100) : [];
  const items = requestedItems.map((item) => buildOrderItem(db.products, item)).filter(Boolean);

  if (!items.length) {
    const error = new Error("No valid products in cart.");
    error.statusCode = 400;
    throw error;
  }

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.product.price * item.quantity, 0));
  const coupon = resolveCoupon(db.coupons, body.couponCode, subtotal);
  const discount = coupon ? calculateCouponDiscount(coupon, subtotal) : 0;
  allocateDiscount(items, discount);
  const shippingMethod = resolveShippingMethod(settings, body.shippingMethodId);
  const shipping = shippingMethod.price;
  const taxRatePercent = Number(settings.taxRatePercent || 0);
  const taxableBase = roundMoney(Math.max(0, subtotal - discount + shipping));
  const tax = settings.taxIncluded
    ? roundMoney(taxableBase - taxableBase / (1 + taxRatePercent / 100))
    : roundMoney(taxableBase * (taxRatePercent / 100));
  const total = settings.taxIncluded ? taxableBase : roundMoney(taxableBase + tax);

  return {
    currency,
    taxIncluded: settings.taxIncluded,
    items,
    coupon,
    shippingMethod,
    totals: {
      subtotal,
      discount,
      shipping,
      tax,
      taxRatePercent,
      total
    }
  };
}

function buildOrderItem(products, requested) {
  const id = cleanText(requested.id || "");
  const sku = cleanText(requested.sku || "");
  const product = products.find((item) => item.active !== false && (item.id === id || item.sku === sku));
  if (!product) return null;

  const quantity = Math.max(1, Math.min(99, Number.parseInt(requested.quantity || 1, 10)));
  if (Number.isFinite(product.stock) && product.stock >= 0 && quantity > product.stock) {
    const error = new Error(`Not enough stock for ${product.name}.`);
    error.statusCode = 409;
    throw error;
  }

  return {
    product,
    quantity,
    lineSubtotal: roundMoney(product.price * quantity),
    lineDiscount: 0,
    lineTotal: roundMoney(product.price * quantity)
  };
}

function allocateDiscount(items, discount) {
  if (!discount) return;

  const subtotal = items.reduce((sum, item) => sum + item.lineSubtotal, 0);
  let allocated = 0;
  items.forEach((item, index) => {
    const share = index === items.length - 1
      ? roundMoney(discount - allocated)
      : roundMoney(discount * (item.lineSubtotal / subtotal));
    item.lineDiscount = Math.min(item.lineSubtotal, share);
    item.lineTotal = roundMoney(item.lineSubtotal - item.lineDiscount);
    allocated = roundMoney(allocated + item.lineDiscount);
  });
}

function buildStripeLineItems(order) {
  const lines = order.items.map((item) => ({
    name: `${item.name} x ${item.quantity}`,
    description: item.lineDiscount ? `${item.description} - descuento aplicado` : item.description,
    sku: item.sku,
    image: item.image,
    amountCents: toCents(item.lineTotal)
  }));

  if (order.totals.shipping > 0) {
    lines.push({
      name: `Envio: ${order.shippingMethod.name}`,
      description: order.shippingMethod.description || "Servicio de entrega",
      amountCents: toCents(order.totals.shipping)
    });
  }

  if (!order.taxIncluded && order.totals.tax > 0) {
    lines.push({
      name: `Impuestos (${order.totals.taxRatePercent}%)`,
      description: "Impuestos calculados por DLS Commerce",
      amountCents: toCents(order.totals.tax)
    });
  }

  return lines.filter((line) => line.amountCents > 0);
}

async function handleStripeEvent(event) {
  if (!event || !event.type) return;

  if (event.type === "checkout.session.completed") {
    const session = event.data?.object || {};
    const orderId = session.metadata?.order_id || session.client_reference_id;
    if (!orderId) return;

    const db = await loadDb();
    const order = db.orders.find((item) => item.id === orderId);
    if (!order) return;

    order.status = "paid";
    order.paidAt = new Date().toISOString();
    order.updatedAt = order.paidAt;
    order.stripePaymentIntentId = session.payment_intent || "";
    order.stripeCustomerId = session.customer || "";
    order.amountPaid = roundMoney((session.amount_total || toCents(order.total)) / 100);
    order.events.push({ type: "payment.paid", at: order.paidAt, actor: "stripe" });
    incrementCouponUsage(db, order.coupon?.code);
    appendAudit(db, "payment.paid", { orderId: order.id, orderNumber: order.orderNumber });

    await saveDb(db);
    await sendOrderEmails(order);
  }

  if (event.type === "checkout.session.expired" || event.type === "payment_intent.payment_failed") {
    const session = event.data?.object || {};
    const orderId = session.metadata?.order_id || session.client_reference_id;
    if (!orderId) return;
    const db = await loadDb();
    const order = db.orders.find((item) => item.id === orderId);
    if (!order || order.status === "paid") return;
    releaseStock(db, order.items);
    order.inventoryReserved = false;
    order.status = event.type === "checkout.session.expired" ? "expired" : "failed";
    order.updatedAt = new Date().toISOString();
    order.events.push({ type: order.status, at: order.updatedAt, actor: "stripe" });
    appendAudit(db, `order.${order.status}`, { orderId: order.id, orderNumber: order.orderNumber });
    await saveDb(db);
  }

  if (event.type === "charge.refunded") {
    const charge = event.data?.object || {};
    const paymentIntent = charge.payment_intent || "";
    const db = await loadDb();
    const order = db.orders.find((item) => item.stripePaymentIntentId === paymentIntent);
    if (!order) return;
    order.status = "refunded";
    order.refundedAt = new Date().toISOString();
    order.updatedAt = order.refundedAt;
    order.events.push({ type: "payment.refunded", at: order.refundedAt, actor: "stripe" });
    appendAudit(db, "payment.refunded", { orderId: order.id, orderNumber: order.orderNumber });
    await saveDb(db);
  }
}

function updateOrderStatus(db, id, body) {
  const order = db.orders.find((item) => item.id === id || item.orderNumber === id);
  if (!order) {
    const error = new Error("Order not found.");
    error.statusCode = 404;
    throw error;
  }

  const status = cleanText(body.status || "");
  if (!orderStatuses.has(status)) {
    const error = new Error("Invalid order status.");
    error.statusCode = 400;
    throw error;
  }

  if ((status === "canceled" || status === "expired" || status === "failed") && order.inventoryReserved) {
    releaseStock(db, order.items);
    order.inventoryReserved = false;
  }

  if (status === "refunded" && body.restock === true) {
    releaseStock(db, order.items);
    order.inventoryReserved = false;
  }

  order.status = status;
  order.trackingNumber = cleanText(body.trackingNumber || order.trackingNumber || "");
  order.internalNote = cleanText(body.internalNote || order.internalNote || "");
  order.customerNote = cleanText(body.customerNote || "");
  order.updatedAt = new Date().toISOString();
  order.events.push({
    type: `order.${status}`,
    at: order.updatedAt,
    actor: "admin",
    note: order.customerNote || order.internalNote || ""
  });
  appendAudit(db, `order.${status}`, { orderId: order.id, orderNumber: order.orderNumber, actor: "admin" });
  return order;
}

function reserveStock(db, orderItems) {
  orderItems.forEach((line) => {
    const product = db.products.find((item) => item.id === line.id || item.sku === line.sku);
    if (product && Number.isFinite(product.stock)) {
      product.stock = Math.max(0, product.stock - line.quantity);
      product.updatedAt = new Date().toISOString();
    }
  });
}

function releaseStock(db, orderItems) {
  orderItems.forEach((line) => {
    const product = db.products.find((item) => item.id === line.id || item.sku === line.sku);
    if (product && Number.isFinite(product.stock)) {
      product.stock += line.quantity;
      product.updatedAt = new Date().toISOString();
    }
  });
}

async function cleanupExpiredOrders(db) {
  const now = Date.now();
  let changed = false;
  db.orders.forEach((order) => {
    if (order.status !== "pending" || !order.expiresAt) return;
    if (new Date(order.expiresAt).getTime() > now) return;
    if (order.inventoryReserved) {
      releaseStock(db, order.items || []);
      order.inventoryReserved = false;
    }
    order.status = "expired";
    order.updatedAt = new Date().toISOString();
    order.events = order.events || [];
    order.events.push({ type: "order.expired", at: order.updatedAt, actor: "system" });
    appendAudit(db, "order.expired", { orderId: order.id, orderNumber: order.orderNumber });
    changed = true;
  });
  return changed;
}

function resolveShippingMethod(settings, requestedId) {
  const methods = settings.shippingMethods.filter((method) => method.active !== false);
  const selected =
    methods.find((method) => method.id === requestedId) ||
    methods.find((method) => method.default) ||
    methods[0] ||
    defaultSettings().shippingMethods[0];
  return {
    id: selected.id,
    name: selected.name,
    description: selected.description,
    price: parsePrice(selected.price),
    allowedCountries: normalizeCountries(selected.allowedCountries || settings.allowedCountries)
  };
}

function resolveCoupon(coupons, couponCode, subtotal) {
  const code = normalizeCouponCode(couponCode);
  if (!code) return null;
  const coupon = coupons.find((item) => item.code === code && item.active !== false);
  if (!coupon) {
    const error = new Error("Coupon not found.");
    error.statusCode = 404;
    throw error;
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() < Date.now()) {
    const error = new Error("Coupon expired.");
    error.statusCode = 409;
    throw error;
  }
  if (coupon.usageLimit && (coupon.used || 0) >= coupon.usageLimit) {
    const error = new Error("Coupon usage limit reached.");
    error.statusCode = 409;
    throw error;
  }
  if (coupon.minSubtotal && subtotal < coupon.minSubtotal) {
    const error = new Error(`Coupon requires minimum subtotal ${coupon.minSubtotal}.`);
    error.statusCode = 409;
    throw error;
  }
  return coupon;
}

function calculateCouponDiscount(coupon, subtotal) {
  const raw = coupon.type === "percent"
    ? subtotal * (Number(coupon.value || 0) / 100)
    : Number(coupon.value || 0);
  const capped = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
  return roundMoney(Math.min(subtotal, Math.max(0, capped)));
}

function incrementCouponUsage(db, code) {
  if (!code) return;
  const coupon = db.coupons.find((item) => item.code === normalizeCouponCode(code));
  if (!coupon) return;
  coupon.used = (coupon.used || 0) + 1;
  coupon.updatedAt = new Date().toISOString();
}

function upsertCoupon(db, rawCoupon) {
  const coupon = normalizeCoupon(rawCoupon);
  const index = db.coupons.findIndex((item) => item.code === coupon.code);
  const now = new Date().toISOString();
  const next = {
    ...(index >= 0 ? db.coupons[index] : {}),
    ...coupon,
    used: index >= 0 ? db.coupons[index].used || 0 : 0,
    updatedAt: now,
    createdAt: index >= 0 ? db.coupons[index].createdAt : now
  };

  if (index >= 0) db.coupons[index] = next;
  else db.coupons.unshift(next);
  appendAudit(db, "coupon.saved", { code: next.code, actor: "admin" });
  return next;
}

function normalizeCoupon(rawCoupon = {}) {
  const code = normalizeCouponCode(rawCoupon.code);
  const type = rawCoupon.type === "fixed" ? "fixed" : "percent";
  const value = type === "percent"
    ? Math.min(100, Math.max(0, Number(rawCoupon.value || 0)))
    : parsePrice(rawCoupon.value);
  if (!code || value <= 0) {
    const error = new Error("Coupon requires code and positive value.");
    error.statusCode = 400;
    throw error;
  }
  return {
    code,
    type,
    value,
    minSubtotal: parsePrice(rawCoupon.minSubtotal || 0),
    maxDiscount: rawCoupon.maxDiscount ? parsePrice(rawCoupon.maxDiscount) : 0,
    usageLimit: rawCoupon.usageLimit ? Math.max(0, Number.parseInt(rawCoupon.usageLimit, 10)) : 0,
    expiresAt: cleanText(rawCoupon.expiresAt || ""),
    active: rawCoupon.active !== false
  };
}

function upsertProduct(db, rawProduct, actor = "system") {
  const product = normalizeProduct(rawProduct);
  const existingIndex = db.products.findIndex((item) => item.id === product.id || item.sku === product.sku);
  const now = new Date().toISOString();
  const next = {
    ...(existingIndex >= 0 ? db.products[existingIndex] : {}),
    ...product,
    updatedAt: now,
    createdAt: existingIndex >= 0 ? db.products[existingIndex].createdAt : now
  };

  if (existingIndex >= 0) db.products[existingIndex] = next;
  else db.products.unshift(next);
  appendAudit(db, "product.saved", { productId: next.id, actor });
  return next;
}

function normalizeProduct(rawProduct = {}) {
  const name = cleanText(rawProduct.name);
  const sku = slugify(rawProduct.sku || rawProduct.id || name);
  const id = slugify(rawProduct.id || sku || name);
  const price = parsePrice(rawProduct.price);
  if (!name || !id || price <= 0) {
    const error = new Error("Product requires name and price.");
    error.statusCode = 400;
    throw error;
  }
  return {
    id,
    sku,
    name,
    price,
    compareAtPrice: rawProduct.compareAtPrice ? parsePrice(rawProduct.compareAtPrice) : 0,
    image: cleanUrl(rawProduct.image),
    description: cleanText(rawProduct.description || "Producto disponible para compra online."),
    category: cleanText(rawProduct.category || ""),
    tags: normalizeTags(rawProduct.tags),
    stock: Math.max(0, Number.parseInt(rawProduct.stock ?? 999, 10)),
    active: rawProduct.active !== false
  };
}

async function sendOrderEmails(order) {
  await Promise.all([
    sendEmail({
      to: order.orderEmail || orderEmailTo,
      subject: `Nuevo pedido pagado: ${order.orderNumber}`,
      text: orderEmailText(order, "owner")
    }),
    sendEmail({
      to: order.customer.email,
      subject: `Confirmacion de pedido ${order.orderNumber}`,
      text: orderEmailText(order, "customer")
    })
  ]);
}

async function maybeSendStatusEmail(order, body) {
  if (!body.notifyCustomer || !order.customer?.email) return;
  await sendEmail({
    to: order.customer.email,
    subject: `Actualizacion de pedido ${order.orderNumber}`,
    text: orderStatusEmailText(order)
  });
}

async function sendEmail({ to, subject, text }) {
  if (!to) return;
  const html = `<pre style="font-family:Inter,Arial,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`;

  if (!resendApiKey) {
    console.log("Email not sent. Configure RESEND_API_KEY.");
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(text);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from: orderEmailFrom, to: [to], subject, html, text })
  });

  if (!response.ok) {
    console.error("Resend email failed:", await response.text());
  }
}

function orderEmailText(order, audience) {
  const header = audience === "customer"
    ? [`Gracias por tu compra en ${order.businessName}.`, `Pedido: ${order.orderNumber}`]
    : [`Pedido pagado: ${order.orderNumber}`, `ID interno: ${order.id}`];
  return [
    ...header,
    `Estado: ${order.status}`,
    `Total: ${order.total.toFixed(2)} ${order.currency}`,
    `Envio: ${order.shippingMethod?.name || ""}`,
    "",
    "Cliente",
    `Nombre: ${order.customer.name}`,
    `Email: ${order.customer.email}`,
    `Telefono: ${order.customer.phone}`,
    `Direccion/notas: ${order.customer.address}`,
    "",
    "Productos",
    ...order.items.map((item) => `- ${item.name} (${item.sku}) x ${item.quantity}: ${item.lineTotal.toFixed(2)} ${order.currency}`),
    "",
    "Totales",
    `Subtotal: ${order.totals.subtotal.toFixed(2)} ${order.currency}`,
    `Descuento: ${order.totals.discount.toFixed(2)} ${order.currency}`,
    `Envio: ${order.totals.shipping.toFixed(2)} ${order.currency}`,
    `Impuestos: ${order.totals.tax.toFixed(2)} ${order.currency}`,
    `Total: ${order.totals.total.toFixed(2)} ${order.currency}`
  ].join("\n");
}

function orderStatusEmailText(order) {
  return [
    `Tu pedido ${order.orderNumber} ahora esta en estado: ${order.status}.`,
    order.customerNote ? `Nota: ${order.customerNote}` : "",
    order.trackingNumber ? `Seguimiento: ${order.trackingNumber}` : "",
    "",
    `Total: ${order.total.toFixed(2)} ${order.currency}`
  ].filter(Boolean).join("\n");
}

async function loadDb() {
  try {
    const data = JSON.parse(await readFile(dbPath, "utf8"));
    return normalizeDb(data);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const db = normalizeDb({});
    await saveDb(db);
    return db;
  }
}

async function saveDb(db) {
  db.auditLog = (db.auditLog || []).slice(0, 500);
  const payload = `${JSON.stringify(db, null, 2)}\n`;
  const directory = path.dirname(dbPath);
  const tempPath = path.join(directory, `.store-db-${process.pid}-${randomUUID()}.tmp`);
  const write = dbWriteQueue.catch(() => {}).then(async () => {
    await mkdir(directory, { recursive: true });
    await writeFile(tempPath, payload, { encoding: "utf8", flag: "wx" });
    await rename(tempPath, dbPath);
  });
  dbWriteQueue = write;
  await write;
}

function normalizeDb(data) {
  return {
    settings: normalizeSettings(data.settings || {}),
    products: Array.isArray(data.products) && data.products.length ? data.products : starterProducts(),
    orders: Array.isArray(data.orders) ? data.orders : [],
    coupons: Array.isArray(data.coupons) ? data.coupons : starterCoupons(),
    auditLog: Array.isArray(data.auditLog) ? data.auditLog : []
  };
}

function defaultSettings() {
  return {
    businessName: "DLS Store",
    orderEmail: orderEmailTo,
    currency: normalizeCurrency(process.env.STORE_CURRENCY || "EUR"),
    taxRatePercent: Number(process.env.STORE_TAX_RATE || 21),
    taxIncluded: String(process.env.STORE_TAX_INCLUDED || "true") !== "false",
    successUrl: "",
    cancelUrl: "",
    termsUrl: "",
    privacyUrl: "",
    allowedCountries: normalizeCountries(process.env.STRIPE_ALLOWED_COUNTRIES || "ES"),
    shippingMethods: [
      {
        id: "pickup",
        name: "Recogida en tienda",
        description: "El negocio confirma la hora de recogida.",
        price: 0,
        active: true,
        default: true,
        allowedCountries: ["ES"]
      },
      {
        id: "local-delivery",
        name: "Entrega local",
        description: "Reparto local bajo confirmacion del negocio.",
        price: 4.9,
        active: true,
        default: false,
        allowedCountries: ["ES"]
      }
    ]
  };
}

function normalizeSettings(settings = {}) {
  const fallback = defaultSettings();
  return {
    ...fallback,
    ...settings,
    businessName: cleanText(settings.businessName || fallback.businessName),
    orderEmail: cleanText(settings.orderEmail || fallback.orderEmail),
    currency: normalizeCurrency(settings.currency || fallback.currency),
    taxRatePercent: Number.isFinite(Number(settings.taxRatePercent)) ? Number(settings.taxRatePercent) : fallback.taxRatePercent,
    taxIncluded: settings.taxIncluded !== false,
    successUrl: cleanUrl(settings.successUrl || ""),
    cancelUrl: cleanUrl(settings.cancelUrl || ""),
    termsUrl: cleanUrl(settings.termsUrl || ""),
    privacyUrl: cleanUrl(settings.privacyUrl || ""),
    allowedCountries: normalizeCountries(settings.allowedCountries || fallback.allowedCountries),
    shippingMethods: normalizeShippingMethods(settings.shippingMethods || fallback.shippingMethods)
  };
}

function normalizeShippingMethods(methods) {
  const normalized = Array.isArray(methods) ? methods : [];
  const result = normalized.map((method, index) => ({
    id: slugify(method.id || method.name || `shipping-${index + 1}`),
    name: cleanText(method.name || `Envio ${index + 1}`),
    description: cleanText(method.description || ""),
    price: parsePrice(method.price || 0),
    active: method.active !== false,
    default: Boolean(method.default),
    allowedCountries: normalizeCountries(method.allowedCountries || "ES")
  }));
  if (!result.some((method) => method.default) && result[0]) result[0].default = true;
  return result.length ? result : defaultSettings().shippingMethods;
}

function starterProducts() {
  const now = new Date().toISOString();
  return [
    {
      id: "tarjeta-regalo",
      sku: "tarjeta-regalo",
      name: "Tarjeta regalo",
      price: 50,
      compareAtPrice: 0,
      image: "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=900&q=80",
      description: "Credito para usar en tienda o local.",
      category: "Regalos",
      tags: ["regalo"],
      stock: 50,
      active: true,
      createdAt: now,
      updatedAt: now
    }
  ];
}

function starterCoupons() {
  const now = new Date().toISOString();
  return [
    {
      code: "BIENVENIDA10",
      type: "percent",
      value: 10,
      minSubtotal: 20,
      maxDiscount: 15,
      usageLimit: 100,
      used: 0,
      expiresAt: "",
      active: true,
      createdAt: now,
      updatedAt: now
    }
  ];
}

function buildSummary(db) {
  const paid = db.orders.filter((order) => ["paid", "preparing", "ready", "fulfilled"].includes(order.status));
  const pending = db.orders.filter((order) => order.status === "pending");
  const revenue = paid.reduce((sum, order) => sum + (order.total || 0), 0);
  const lowStock = db.products.filter((product) => product.active !== false && product.stock <= 5);
  return {
    revenue: roundMoney(revenue),
    paidOrders: paid.length,
    pendingOrders: pending.length,
    products: db.products.length,
    lowStock: lowStock.length,
    latestOrders: db.orders.slice(0, 8)
  };
}

function filterOrders(orders, params) {
  const status = params.get("status");
  const q = normalizeSearch(params.get("q") || "");
  return orders.filter((order) => {
    if (status && order.status !== status) return false;
    if (!q) return true;
    return normalizeSearch([order.orderNumber, order.customer?.name, order.customer?.email, order.customer?.phone].join(" ")).includes(q);
  });
}

function publicSettings(settings) {
  return {
    businessName: settings.businessName,
    currency: settings.currency,
    taxRatePercent: settings.taxRatePercent,
    taxIncluded: settings.taxIncluded,
    termsUrl: settings.termsUrl,
    privacyUrl: settings.privacyUrl,
    shippingMethods: settings.shippingMethods.filter((method) => method.active !== false).map((method) => ({
      id: method.id,
      name: method.name,
      description: method.description,
      price: method.price,
      default: method.default
    }))
  };
}

function publicProducts(products, params) {
  const category = normalizeSearch(params.get("category") || "");
  const q = normalizeSearch(params.get("q") || "");
  return products
    .filter((product) => product.active !== false)
    .filter((product) => !category || normalizeSearch(product.category).includes(category))
    .filter((product) => !q || normalizeSearch([product.name, product.description, product.category, ...(product.tags || [])].join(" ")).includes(q))
    .map(publicProduct);
}

function publicProduct(product) {
  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    price: product.price,
    compareAtPrice: product.compareAtPrice || 0,
    image: product.image,
    description: product.description,
    category: product.category || "",
    tags: product.tags || [],
    stock: product.stock,
    active: product.active !== false
  };
}

function publicQuote(quote) {
  return {
    currency: quote.currency,
    taxIncluded: quote.taxIncluded,
    items: quote.items.map(({ product, quantity, lineSubtotal, lineDiscount, lineTotal }) => ({
      product: publicProduct(product),
      quantity,
      lineSubtotal,
      lineDiscount,
      lineTotal
    })),
    coupon: quote.coupon ? { code: quote.coupon.code, type: quote.coupon.type, value: quote.coupon.value } : null,
    shippingMethod: quote.shippingMethod,
    totals: quote.totals
  };
}

function publicOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    businessName: order.businessName,
    customer: {
      name: order.customer?.name || "",
      email: order.customer?.email || ""
    },
    items: order.items,
    shippingMethod: order.shippingMethod,
    totals: order.totals,
    currency: order.currency,
    trackingNumber: order.trackingNumber || "",
    customerNote: order.customerNote || "",
    events: (order.events || []).map((event) => ({ type: event.type, at: event.at }))
  };
}

function appendOrderParams(url, order) {
  const next = new URL(url);
  next.searchParams.set("pedido", "ok");
  next.searchParams.set("order", order.orderNumber);
  next.searchParams.set("token", order.publicToken);
  return next.toString();
}

function nextOrderNumber(db) {
  const year = new Date().getFullYear();
  const prefix = `LL-${year}-`;
  const max = db.orders
    .map((order) => String(order.orderNumber || ""))
    .filter((number) => number.startsWith(prefix))
    .map((number) => Number(number.replace(prefix, "")))
    .filter(Number.isFinite)
    .reduce((current, value) => Math.max(current, value), 0);
  return `${prefix}${String(max + 1).padStart(5, "0")}`;
}

function appendAudit(db, type, detail = {}) {
  db.auditLog = db.auditLog || [];
  db.auditLog.unshift({ id: `evt_${randomUUID()}`, type, detail, at: new Date().toISOString() });
  db.auditLog = db.auditLog.slice(0, 500);
}

function sendAuditForExistingCheckout(db, order) {
  appendAudit(db, "checkout.reused", { orderId: order.id, orderNumber: order.orderNumber });
}

function requireAdmin(request) {
  if (!isAdminTokenConfigured()) {
    const error = new Error("Set STORE_ADMIN_TOKEN with at least 32 characters before using admin routes.");
    error.statusCode = 503;
    throw error;
  }

  if (!isAdmin(request)) {
    const error = new Error("Invalid admin token.");
    error.statusCode = 401;
    throw error;
  }
}

function isAdmin(request) {
  if (!isAdminTokenConfigured()) return false;
  const token = request.headers["x-store-admin-token"] || String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return safeEqual(token, adminToken);
}

function isAdminTokenConfigured() {
  return adminToken.length >= 32 && !["change-me", "cambia-este-token"].includes(adminToken.toLowerCase());
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function throttle(request, scope, limit = maxCheckoutPerMinute) {
  const now = Date.now();
  const ip = String(request.headers["x-forwarded-for"] || request.socket.remoteAddress || "local").split(",")[0].trim();
  const key = `${scope}:${ip}`;
  const bucket = checkoutAttempts.get(key) || [];
  const fresh = bucket.filter((timestamp) => now - timestamp < 60_000);
  if (fresh.length >= limit) {
    const error = new Error("Too many requests. Try again in a minute.");
    error.statusCode = 429;
    throw error;
  }
  fresh.push(now);
  checkoutAttempts.set(key, fresh);
}

function readRaw(request) {
  return new Promise((resolve, reject) => {
    const contentLength = Number(request.headers["content-length"] || 0);
    if (contentLength > maxBodyBytes) {
      reject(Object.assign(new Error("Request body too large."), { statusCode: 413 }));
      return;
    }

    const chunks = [];
    let size = 0;
    request.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxBodyBytes) {
        reject(Object.assign(new Error("Request body too large."), { statusCode: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks)));
    request.on("error", reject);
  });
}

async function readJson(request) {
  const contentType = String(request.headers["content-type"] || "");
  if (request.method !== "GET" && contentType && !contentType.toLowerCase().includes("application/json")) {
    const error = new Error("Content-Type must be application/json.");
    error.statusCode = 415;
    throw error;
  }

  const raw = await readRaw(request);
  if (!raw.length) return {};

  try {
    return JSON.parse(raw.toString("utf8"));
  } catch (error) {
    const parseError = new Error("Invalid JSON body.");
    parseError.statusCode = 400;
    throw parseError;
  }
}

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data, null, 2));
}

function setSecurityHeaders(request, response) {
  Object.entries(baseHeaders).forEach(([key, value]) => response.setHeader(key, value));
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Store-Admin-Token,Stripe-Signature,Idempotency-Key");
  response.setHeader("Access-Control-Max-Age", "86400");
  response.setHeader("Vary", "Origin");

  const origin = request.headers.origin;
  if (origin && isAllowedCorsOrigin(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
  }
}

function isAllowedCorsOrigin(origin) {
  if (!origin) return false;
  if (allowAnyCorsOrigin && process.env.NODE_ENV !== "production") return true;
  try {
    return allowedCorsOrigins.has(new URL(origin).origin);
  } catch (error) {
    return false;
  }
}

function parseOriginList(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item && item !== "*")
      .map((item) => {
        try {
          return new URL(item).origin;
        } catch (error) {
          return "";
        }
      })
      .filter(Boolean)
  );
}

function isAllowedCheckoutUrl(value) {
  if (!value) return false;
  try {
    const origin = new URL(value).origin;
    if (allowAnyCorsOrigin && process.env.NODE_ENV !== "production") return true;
    return allowedCheckoutOrigins.has(origin) || allowedCorsOrigins.has(origin);
  } catch (error) {
    return false;
  }
}

function cleanCheckoutRedirectUrl(value) {
  const url = cleanUrl(value);
  if (isAllowedCheckoutUrl(url)) return url;

  const fallbackOrigin = [...allowedCheckoutOrigins, ...allowedCorsOrigins][0] || "http://127.0.0.1:5173";
  return `${fallbackOrigin}/`;
}

function normalizeCustomer(customer) {
  const email = cleanText(customer.email || "").toLowerCase();
  return {
    name: cleanText(customer.name || "Cliente"),
    email: isEmail(email) ? email : "",
    phone: cleanText(customer.phone || ""),
    address: cleanText(customer.address || "")
  };
}

function normalizeTags(value) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).slice(0, 12);
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function normalizeCountries(value) {
  const raw = Array.isArray(value) ? value : String(value || "ES").split(",");
  const countries = raw.map((item) => String(item).trim().toUpperCase().replace(/[^A-Z]/g, "")).filter((item) => item.length === 2);
  return countries.length ? countries : ["ES"];
}

function normalizeCouponCode(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
}

function normalizeSearch(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function parsePrice(value) {
  const number = Number(String(value ?? "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(number) ? roundMoney(Math.max(0, number)) : 0;
}

function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function normalizeCurrency(value) {
  const currency = String(value || "EUR").trim().toUpperCase().replace(/[^A-Z]/g, "");
  return currency.length === 3 ? currency : "EUR";
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2000);
}

function cleanUrl(value) {
  const url = cleanText(value);
  return /^https?:\/\//i.test(url) ? url : "";
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(value || ""));
}

function slugify(value) {
  return String(value || "item")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
