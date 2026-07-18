import { randomUUID } from "node:crypto";
import { corsHeaders } from "../lib/cors.mjs";
import { loadBusinessStore, saveBusinessStore } from "../lib/business-store.mjs";
import {
  createCommerceCheckoutSession,
  verifyCommercePaymentWebhook
} from "../lib/commerce-payment-provider.mjs";

const MAX_BODY_BYTES = Number(process.env.COMMERCE_API_MAX_BODY_BYTES || 512 * 1024);
const ORDER_STATUSES = new Set(["pending", "paid", "preparing", "ready", "fulfilled", "canceled", "expired", "failed", "refunded"]);
const COUPON_TYPES = new Set(["percent", "fixed"]);
const DEFAULT_SHIPPING_METHODS = Object.freeze([
  {
    id: "pickup",
    name: "Recogida en tienda",
    description: "El negocio confirma la hora de recogida.",
    price: 0,
    active: true,
    default: true,
    allowedCountries: ["ES"]
  }
]);

export function isCommerceApiRequest(pathname) {
  return /^\/api\/businesses\/[^/]+\/commerce\/(?:summary|products|orders|coupons|settings)(?:\/[^/]+)?$/.test(pathname)
    || /^\/api\/public\/[^/]+\/store\/(?:config|products|cart\/validate|checkout|orders\/[^/]+)$/.test(pathname)
    || pathname === "/api/webhooks/stripe/commerce";
}

export async function handleCommerceApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://dls.local");
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context, "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    return;
  }

  try {
    if (requestUrl.pathname === "/api/webhooks/stripe/commerce") {
      await handlePaymentWebhook(request, response, context, method);
      return;
    }

    const segments = requestUrl.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (segments[1] === "public") {
      await handlePublicCommerce({
        request,
        response,
        context,
        requestUrl,
        method,
        businessSlug: segments[2] || "",
        action: segments[4] || "",
        detail: segments[5] || ""
      });
      return;
    }

    await handleBusinessCommerce({
      request,
      response,
      context,
      requestUrl,
      method,
      businessRef: segments[2] || "",
      resource: segments[4] || "",
      resourceId: segments[5] || ""
    });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(response, status, {
      error: status >= 500 && process.env.NODE_ENV !== "test"
        ? "Internal commerce API error"
        : error.message,
      code: error.code || "commerce_error"
    }, context, error.allow ? { Allow: error.allow } : {});
  }
}

async function handleBusinessCommerce(input) {
  const { request, response, context, requestUrl, method, businessRef, resource, resourceId } = input;
  const db = await loadBusinessStore(context);
  const business = requireBusiness(db, businessRef);
  const commerce = ensureCommerce(business);

  if (resource === "summary") {
    if (method !== "GET") throw methodNotAllowed("GET, OPTIONS");
    sendJson(response, 200, { summary: buildSummary(business, commerce), commerce: commercePayload(business, commerce) }, context);
    return;
  }

  if (resource === "products") {
    if (!resourceId && method === "GET") {
      const products = listProducts(commerce.products, requestUrl.searchParams);
      sendJson(response, 200, { products, items: products, total: products.length }, context);
      return;
    }

    if (!resourceId && method === "POST") {
      const source = requireObject(await readJsonBody(request));
      const now = new Date().toISOString();
      const product = normalizeProduct(source.product || source, null, commerce.products, now);
      commerce.products.push(product);
      touchCommerce(business, commerce, "commerce.product_created", product.id, now);
      await saveBusinessStore(db, context, "commerce-product-create");
      sendJson(response, 201, { product, commerce: commercePayload(business, commerce) }, context);
      return;
    }

    const product = commerce.products.find((item) => item.id === resourceId || item.sku === resourceId);
    if (!product) throw apiError(404, "Product not found", "commerce_product_not_found");

    if (method === "PATCH" || method === "PUT") {
      const source = requireObject(await readJsonBody(request));
      const now = new Date().toISOString();
      Object.assign(product, normalizeProduct(source.product || source, product, commerce.products, now));
      touchCommerce(business, commerce, "commerce.product_updated", product.id, now);
      await saveBusinessStore(db, context, "commerce-product-update");
      sendJson(response, 200, { product, commerce: commercePayload(business, commerce) }, context);
      return;
    }

    if (method === "DELETE") {
      const now = new Date().toISOString();
      product.active = false;
      product.updatedAt = now;
      touchCommerce(business, commerce, "commerce.product_hidden", product.id, now);
      await saveBusinessStore(db, context, "commerce-product-hide");
      sendJson(response, 200, { product, deleted: true, commerce: commercePayload(business, commerce) }, context);
      return;
    }

    throw methodNotAllowed("GET, POST, PUT, PATCH, DELETE, OPTIONS");
  }

  if (resource === "orders") {
    if (!resourceId && method === "GET") {
      const orders = listOrders(commerce.orders, requestUrl.searchParams);
      sendJson(response, 200, { orders, items: orders, total: orders.length }, context);
      return;
    }

    const order = commerce.orders.find((item) => item.id === resourceId || item.orderNumber === resourceId);
    if (!order) throw apiError(404, "Order not found", "commerce_order_not_found");

    if (method === "PATCH") {
      const source = requireObject(await readJsonBody(request));
      const nextStatus = enumValue(source.status ?? order.status, ORDER_STATUSES, "status");
      const now = new Date().toISOString();
      applyOrderStatus(commerce, order, nextStatus, now);
      if (source.trackingNumber !== undefined) order.trackingNumber = optionalText(source.trackingNumber, 160);
      if (source.internalNote !== undefined) order.internalNote = optionalText(source.internalNote, 2000);
      if (source.customerNote !== undefined) order.customerNote = optionalText(source.customerNote, 2000);
      order.updatedAt = now;
      order.events = Array.isArray(order.events) ? order.events : [];
      order.events.push({ type: "order.updated", at: now, actor: "business" });
      touchCommerce(business, commerce, "commerce.order_updated", order.id, now);
      await saveBusinessStore(db, context, "commerce-order-update");
      sendJson(response, 200, { order, commerce: commercePayload(business, commerce) }, context);
      return;
    }

    throw methodNotAllowed("GET, PATCH, OPTIONS");
  }

  if (resource === "coupons") {
    if (!resourceId && method === "GET") {
      const coupons = listCoupons(commerce.coupons, requestUrl.searchParams);
      sendJson(response, 200, { coupons, items: coupons, total: coupons.length }, context);
      return;
    }

    if (!resourceId && method === "POST") {
      const source = requireObject(await readJsonBody(request));
      const now = new Date().toISOString();
      const coupon = normalizeCoupon(source.coupon || source, null, commerce.coupons, now);
      commerce.coupons.push(coupon);
      touchCommerce(business, commerce, "commerce.coupon_created", coupon.code, now);
      await saveBusinessStore(db, context, "commerce-coupon-create");
      sendJson(response, 201, { coupon, commerce: commercePayload(business, commerce) }, context);
      return;
    }

    const coupon = commerce.coupons.find((item) => item.id === resourceId || item.code === resourceId.toUpperCase());
    if (!coupon) throw apiError(404, "Coupon not found", "commerce_coupon_not_found");

    if (method === "PATCH" || method === "PUT") {
      const source = requireObject(await readJsonBody(request));
      const now = new Date().toISOString();
      Object.assign(coupon, normalizeCoupon(source.coupon || source, coupon, commerce.coupons, now));
      touchCommerce(business, commerce, "commerce.coupon_updated", coupon.code, now);
      await saveBusinessStore(db, context, "commerce-coupon-update");
      sendJson(response, 200, { coupon, commerce: commercePayload(business, commerce) }, context);
      return;
    }

    if (method === "DELETE") {
      const now = new Date().toISOString();
      coupon.active = false;
      coupon.updatedAt = now;
      touchCommerce(business, commerce, "commerce.coupon_disabled", coupon.code, now);
      await saveBusinessStore(db, context, "commerce-coupon-disable");
      sendJson(response, 200, { coupon, deleted: true, commerce: commercePayload(business, commerce) }, context);
      return;
    }

    throw methodNotAllowed("GET, POST, PUT, PATCH, DELETE, OPTIONS");
  }

  if (resource === "settings") {
    if (method === "GET") {
      sendJson(response, 200, {
        settings: commerceSettings(business, commerce),
        endpoints: commerceEndpoints(business, commerce),
        commerce: commercePayload(business, commerce)
      }, context);
      return;
    }

    if (method === "PUT" || method === "PATCH") {
      const source = requireObject(await readJsonBody(request));
      const now = new Date().toISOString();
      updateCommerceSettings(business, commerce, source.settings || source, now);
      touchCommerce(business, commerce, "commerce.settings_updated", business.id, now);
      await saveBusinessStore(db, context, "commerce-settings-update");
      sendJson(response, 200, {
        settings: commerceSettings(business, commerce),
        endpoints: commerceEndpoints(business, commerce),
        commerce: commercePayload(business, commerce)
      }, context);
      return;
    }

    throw methodNotAllowed("GET, PUT, PATCH, OPTIONS");
  }

  throw apiError(404, "Commerce resource not found", "commerce_resource_not_found");
}

async function handlePublicCommerce(input) {
  const { request, response, context, requestUrl, method, businessSlug, action, detail } = input;
  const db = await loadBusinessStore(context);
  const business = requirePublishedBusiness(db, businessSlug);
  const commerce = ensureCommerce(business);

  if (action === "config" && method === "GET") {
    sendJson(response, 200, { settings: publicSettings(business, commerce) }, context, publicCacheHeaders());
    return;
  }

  if (action === "products" && method === "GET") {
    const products = listProducts(commerce.products, requestUrl.searchParams).filter((item) => item.active !== false);
    sendJson(response, 200, { products }, context, publicCacheHeaders());
    return;
  }

  if (action === "cart" && detail === "validate" && method === "POST") {
    const quote = buildCartQuote(commerce, requireObject(await readJsonBody(request)));
    sendJson(response, 200, publicQuote(quote), context);
    return;
  }

  if (action === "checkout" && method === "POST") {
    const source = requireObject(await readJsonBody(request));
    const result = await createCheckout({ db, business, commerce, source, request, context });
    sendJson(response, result.duplicate ? 200 : 201, result.payload, context);
    return;
  }

  if (action === "orders" && detail && method === "GET") {
    const order = commerce.orders.find((item) => item.id === detail || item.orderNumber === detail);
    if (!order) throw apiError(404, "Order not found", "commerce_order_not_found");
    if (clean(requestUrl.searchParams.get("token")) !== clean(order.publicToken)) {
      throw apiError(401, "Invalid order token", "commerce_order_token_invalid");
    }
    sendJson(response, 200, { order: publicOrder(order) }, context);
    return;
  }

  throw methodNotAllowed("GET, POST, OPTIONS");
}

async function createCheckout({ db, business, commerce, source, request, context }) {
  const idempotencyKey = optionalText(request.headers["idempotency-key"] || source.idempotencyKey, 200);
  if (idempotencyKey) {
    const existing = commerce.orders.find((item) => item.idempotencyKey === idempotencyKey && !["failed", "expired", "canceled"].includes(item.status));
    if (existing?.checkoutUrl) {
      return {
        duplicate: true,
        payload: checkoutPayload(existing)
      };
    }
  }

  const customer = normalizeCustomer(source.customer || {});
  if (!customer.email) throw apiError(400, "Customer email is required", "commerce_customer_email_required");
  const quote = buildCartQuote(commerce, source);
  if (quote.totals.total <= 0) throw apiError(400, "Order total must be greater than zero", "commerce_total_invalid");

  const now = new Date().toISOString();
  const order = {
    id: `commerce_order_${randomUUID()}`,
    orderNumber: nextOrderNumber(commerce.orders, now),
    publicToken: randomUUID(),
    idempotencyKey,
    status: "pending",
    businessId: business.id,
    businessSlug: business.slug || "",
    businessName: business.name || "",
    customer,
    currency: quote.currency,
    items: quote.items.map((item) => ({
      id: item.product.id,
      sku: item.product.sku,
      name: item.product.name,
      description: item.product.description,
      image: item.product.image,
      price: item.product.price,
      quantity: item.quantity,
      lineSubtotal: item.lineSubtotal,
      lineDiscount: item.lineDiscount,
      lineTotal: item.lineTotal
    })),
    coupon: quote.coupon ? { code: quote.coupon.code, type: quote.coupon.type, value: quote.coupon.value } : null,
    shippingMethod: quote.shippingMethod,
    totals: quote.totals,
    total: quote.totals.total,
    taxIncluded: quote.taxIncluded,
    inventoryReserved: true,
    paymentEventIds: [],
    events: [{ type: "order.created", at: now, actor: "system" }],
    createdAt: now,
    updatedAt: now
  };

  reserveStock(commerce, order.items);
  commerce.orders.unshift(order);
  touchCommerce(business, commerce, "commerce.order_created", order.id, now);
  await saveBusinessStore(db, context, "commerce-order-create");

  try {
    const redirects = checkoutRedirects(request, business, commerce);
    const providerItems = quote.items.map((item) => ({
      name: item.quantity > 1
        ? `${item.product.name} × ${item.quantity}`
        : item.product.name,
      description: item.product.description,
      image: item.product.image,
      sku: item.product.sku,
      quantity: 1,
      unitAmount: item.lineTotal
    }));
    if (quote.totals.shipping > 0) {
      providerItems.push({
        name: quote.shippingMethod.name,
        description: quote.shippingMethod.description,
        quantity: 1,
        unitAmount: quote.totals.shipping
      });
    }
    if (!quote.taxIncluded && quote.totals.tax > 0) {
      providerItems.push({
        name: `Impuestos (${quote.totals.taxRatePercent}%)`,
        quantity: 1,
        unitAmount: quote.totals.tax
      });
    }

    const provider = await createCommerceCheckoutSession({
      orderId: order.id,
      orderNumber: order.orderNumber,
      businessId: business.id,
      businessSlug: business.slug || "",
      customerEmail: order.customer.email,
      currency: order.currency,
      items: providerItems,
      successUrl: redirects.successUrl,
      cancelUrl: redirects.cancelUrl,
      idempotencyKey: idempotencyKey || order.id
    }, { env: process.env });

    order.paymentProvider = provider.provider;
    order.providerSessionId = provider.providerSessionId;
    order.checkoutUrl = provider.checkoutUrl;
    order.expiresAt = provider.expiresAt;
    order.updatedAt = new Date().toISOString();
    order.events.push({ type: "checkout.created", at: order.updatedAt, actor: provider.provider, sessionId: provider.providerSessionId });

    if (provider.provider === "development") {
      markOrderPaid(commerce, order, {
        id: `development:${provider.providerSessionId}`,
        providerPaymentId: provider.providerSessionId,
        paidAt: order.updatedAt
      });
    }

    touchCommerce(business, commerce, "commerce.checkout_created", order.id, order.updatedAt);
    await saveBusinessStore(db, context, "commerce-checkout-create");
    return { duplicate: false, payload: checkoutPayload(order) };
  } catch (error) {
    releaseStock(commerce, order.items);
    order.inventoryReserved = false;
    order.status = "failed";
    order.updatedAt = new Date().toISOString();
    order.events.push({ type: "checkout.failed", at: order.updatedAt, actor: "payment-provider", message: clean(error.message) });
    touchCommerce(business, commerce, "commerce.checkout_failed", order.id, order.updatedAt);
    await saveBusinessStore(db, context, "commerce-checkout-failed");
    throw error;
  }
}

async function handlePaymentWebhook(request, response, context, method) {
  if (method !== "POST") throw methodNotAllowed("POST, OPTIONS");
  const rawBody = await readRawBody(request);
  const event = await verifyCommercePaymentWebhook(rawBody, request.headers, { env: process.env });
  if (event.ignored) {
    sendJson(response, 200, { received: true, ignored: true, type: event.type }, context);
    return;
  }

  const db = await loadBusinessStore(context);
  let found = null;

  for (const business of db.businesses) {
    const commerce = ensureCommerce(business);
    const order = commerce.orders.find((item) => item.providerSessionId === event.providerSessionId);
    if (!order) continue;
    found = { business, commerce, order };
    break;
  }

  if (!found) throw apiError(404, "Commerce checkout not found", "commerce_checkout_not_found");
  const duplicate = (found.order.paymentEventIds || []).includes(event.id);
  if (!duplicate) {
    markOrderPaid(found.commerce, found.order, event);
    touchCommerce(found.business, found.commerce, "commerce.payment_received", found.order.id, event.paidAt);
    await saveBusinessStore(db, context, "commerce-payment-webhook");
  }

  sendJson(response, 200, {
    received: true,
    duplicate,
    orderId: found.order.id,
    status: found.order.status
  }, context);
}

function ensureCommerce(business) {
  business.content = isPlainObject(business.content) ? business.content : {};
  const legacy = isPlainObject(business.commerce) ? business.commerce : {};
  const current = isPlainObject(business.content.commerce) ? business.content.commerce : {};
  const commerce = {
    ...legacy,
    ...current
  };

  commerce.products = uniqueById(arrayFrom(current.products, legacy.products, business.products));
  commerce.orders = uniqueById(arrayFrom(current.orders, legacy.orders, business.orders));
  commerce.coupons = uniqueByCode(arrayFrom(current.coupons, legacy.coupons));
  commerce.auditLog = Array.isArray(current.auditLog) ? current.auditLog : [];
  business.content.commerce = commerce;
  return commerce;
}

function commercePayload(business, commerce) {
  return {
    ...commerce,
    settings: commerceSettings(business, commerce),
    endpoints: commerceEndpoints(business, commerce)
  };
}

function commerceSettings(business, commerce) {
  const settings = isPlainObject(commerce.settings) ? commerce.settings : {};
  return {
    enabled: commerce.enabled === true,
    businessName: clean(settings.businessName || commerce.businessName || business.name),
    orderEmail: clean(settings.orderEmail || commerce.orderEmail || business.ownerEmail || business.content?.email),
    currency: normalizeCurrency(settings.currency || commerce.currency || business.content?.currency || "EUR"),
    taxRatePercent: percentage(settings.taxRatePercent ?? commerce.taxRatePercent ?? 21, "taxRatePercent"),
    taxIncluded: (settings.taxIncluded ?? commerce.taxIncluded) !== false,
    successUrl: optionalUrl(settings.successUrl || commerce.successUrl),
    cancelUrl: optionalUrl(settings.cancelUrl || commerce.cancelUrl),
    termsUrl: optionalUrl(settings.termsUrl || commerce.termsUrl),
    privacyUrl: optionalUrl(settings.privacyUrl || commerce.privacyUrl),
    allowedCountries: normalizeCountries(settings.allowedCountries || commerce.allowedCountries || ["ES"]),
    shippingMethods: normalizeShippingMethods(settings.shippingMethods || commerce.shippingMethods)
  };
}

function updateCommerceSettings(business, commerce, source, now) {
  const current = commerceSettings(business, commerce);
  const publicBaseUrl = source.publicBaseUrl === undefined ? "" : optionalUrl(source.publicBaseUrl);
  const next = {
    enabled: source.enabled === undefined ? current.enabled : Boolean(source.enabled),
    businessName: source.businessName === undefined ? current.businessName : optionalText(source.businessName, 160) || business.name,
    orderEmail: source.orderEmail === undefined ? current.orderEmail : optionalEmail(source.orderEmail),
    currency: source.currency === undefined ? current.currency : normalizeCurrency(source.currency),
    taxRatePercent: source.taxRatePercent === undefined ? current.taxRatePercent : percentage(source.taxRatePercent, "taxRatePercent"),
    taxIncluded: source.taxIncluded === undefined ? current.taxIncluded : Boolean(source.taxIncluded),
    successUrl: source.successUrl === undefined ? current.successUrl : optionalUrl(source.successUrl),
    cancelUrl: source.cancelUrl === undefined ? current.cancelUrl : optionalUrl(source.cancelUrl),
    termsUrl: source.termsUrl === undefined ? current.termsUrl : optionalUrl(source.termsUrl),
    privacyUrl: source.privacyUrl === undefined ? current.privacyUrl : optionalUrl(source.privacyUrl),
    allowedCountries: source.allowedCountries === undefined ? current.allowedCountries : normalizeCountries(source.allowedCountries),
    shippingMethods: source.shippingMethods === undefined ? current.shippingMethods : normalizeShippingMethods(source.shippingMethods)
  };

  commerce.settings = next;
  Object.assign(commerce, next, { updatedAt: now });

  if (publicBaseUrl) {
    const base = publicBaseUrl.replace(/\/+$/, "");
    const slug = encodeURIComponent(business.slug || business.id);
    commerce.productsEndpoint = `${base}/api/public/${slug}/store/products`;
    commerce.checkoutEndpoint = `${base}/api/public/${slug}/store/checkout`;
  }
}

function commerceEndpoints(business, commerce) {
  const slug = encodeURIComponent(business.slug || business.id);
  return {
    products: commerce.productsEndpoint || `/api/public/${slug}/store/products`,
    checkout: commerce.checkoutEndpoint || `/api/public/${slug}/store/checkout`,
    config: endpointFor(commerce.productsEndpoint || commerce.checkoutEndpoint, `/api/public/${slug}/store/config`),
    webhook: "/api/webhooks/stripe/commerce"
  };
}

function publicSettings(business, commerce) {
  const settings = commerceSettings(business, commerce);
  return {
    businessName: settings.businessName,
    currency: settings.currency,
    taxRatePercent: settings.taxRatePercent,
    taxIncluded: settings.taxIncluded,
    termsUrl: settings.termsUrl,
    privacyUrl: settings.privacyUrl,
    allowedCountries: settings.allowedCountries,
    shippingMethods: settings.shippingMethods.filter((item) => item.active !== false)
  };
}

function normalizeProduct(source, existing, products, now) {
  const name = requiredText(valueOf(source, existing, "name"), "name", 180);
  const sku = optionalText(valueOf(source, existing, "sku"), 100);
  const id = existing?.id || uniqueProductId(source.id || sku || name, products);
  const duplicateSku = sku && products.some((item) => item !== existing && clean(item.sku).toLowerCase() === sku.toLowerCase());
  if (duplicateSku) throw apiError(409, "Another product already uses this SKU", "commerce_product_sku_duplicate");

  return {
    id,
    sku,
    name,
    price: money(valueOf(source, existing, "price", 0), "price"),
    compareAtPrice: money(valueOf(source, existing, "compareAtPrice", 0), "compareAtPrice"),
    image: optionalUrl(valueOf(source, existing, "image")),
    description: optionalText(valueOf(source, existing, "description"), 2000),
    category: optionalText(valueOf(source, existing, "category", "General"), 100) || "General",
    tags: normalizeTags(valueOf(source, existing, "tags", [])),
    stock: quantity(valueOf(source, existing, "stock", 0), "stock"),
    active: Boolean(valueOf(source, existing, "active", true)),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function normalizeCoupon(source, existing, coupons, now) {
  const code = requiredText(valueOf(source, existing, "code"), "code", 40).toUpperCase().replace(/[^A-Z0-9_-]/g, "");
  if (!code) throw apiError(400, "Coupon code is invalid", "commerce_coupon_code_invalid");
  if (coupons.some((item) => item !== existing && item.code === code)) {
    throw apiError(409, "Coupon code already exists", "commerce_coupon_duplicate");
  }

  const type = enumValue(valueOf(source, existing, "type", "percent"), COUPON_TYPES, "type");
  const value = money(valueOf(source, existing, "value", 0), "value");
  if (type === "percent" && value > 100) throw apiError(400, "Percent coupon cannot exceed 100", "commerce_coupon_percent_invalid");

  return {
    id: existing?.id || `commerce_coupon_${randomUUID()}`,
    code,
    type,
    value,
    minSubtotal: money(valueOf(source, existing, "minSubtotal", 0), "minSubtotal"),
    maxDiscount: money(valueOf(source, existing, "maxDiscount", 0), "maxDiscount"),
    usageLimit: integer(valueOf(source, existing, "usageLimit", 0), "usageLimit"),
    used: integer(valueOf(source, existing, "used", 0), "used"),
    expiresAt: optionalDateTime(valueOf(source, existing, "expiresAt")),
    active: Boolean(valueOf(source, existing, "active", true)),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };
}

function buildCartQuote(commerce, source) {
  const settings = commerceSettings({ name: commerce.businessName || "", content: {} }, commerce);
  const requested = Array.isArray(source.items) ? source.items.slice(0, 100) : [];
  const items = requested.map((item) => {
    const product = commerce.products.find((candidate) => (
      candidate.active !== false
      && (candidate.id === clean(item.id) || (clean(item.sku) && candidate.sku === clean(item.sku)))
    ));
    if (!product) throw apiError(400, "Cart contains an unavailable product", "commerce_product_unavailable");
    const quantityValue = integer(item.quantity || 1, "quantity");
    if (quantityValue < 1 || quantityValue > 99) throw apiError(400, "Product quantity must be between 1 and 99", "commerce_quantity_invalid");
    if (Number(product.stock || 0) < quantityValue) throw apiError(409, `${product.name} does not have enough stock`, "commerce_stock_insufficient");
    return {
      product,
      quantity: quantityValue,
      lineSubtotal: roundMoney(Number(product.price || 0) * quantityValue),
      lineDiscount: 0,
      lineTotal: roundMoney(Number(product.price || 0) * quantityValue)
    };
  });

  if (!items.length) throw apiError(400, "No valid products in cart", "commerce_cart_empty");
  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineSubtotal, 0));
  const coupon = resolveCoupon(commerce.coupons, source.couponCode, subtotal);
  const discount = coupon ? couponDiscount(coupon, subtotal) : 0;
  allocateDiscount(items, discount, subtotal);
  const shippingMethod = resolveShippingMethod(settings.shippingMethods, source.shippingMethodId);
  const shipping = shippingMethod.price;
  const taxableBase = roundMoney(Math.max(0, subtotal - discount + shipping));
  const tax = settings.taxIncluded
    ? roundMoney(taxableBase - taxableBase / (1 + settings.taxRatePercent / 100))
    : roundMoney(taxableBase * settings.taxRatePercent / 100);
  const total = settings.taxIncluded ? taxableBase : roundMoney(taxableBase + tax);

  return {
    currency: settings.currency,
    taxIncluded: settings.taxIncluded,
    items,
    coupon,
    shippingMethod,
    totals: {
      subtotal,
      discount,
      shipping,
      tax,
      taxRatePercent: settings.taxRatePercent,
      total
    }
  };
}

function publicQuote(quote) {
  return {
    currency: quote.currency,
    taxIncluded: quote.taxIncluded,
    coupon: quote.coupon ? { code: quote.coupon.code, type: quote.coupon.type, value: quote.coupon.value } : null,
    shippingMethod: quote.shippingMethod,
    totals: quote.totals,
    items: quote.items.map((item) => ({
      id: item.product.id,
      sku: item.product.sku,
      name: item.product.name,
      price: item.product.price,
      quantity: item.quantity,
      lineSubtotal: item.lineSubtotal,
      lineDiscount: item.lineDiscount,
      lineTotal: item.lineTotal
    }))
  };
}

function buildSummary(business, commerce) {
  const settings = commerceSettings(business, commerce);
  const paidStatuses = new Set(["paid", "preparing", "ready", "fulfilled"]);
  const pendingStatuses = new Set(["pending", "paid", "preparing", "ready"]);
  const paidOrders = commerce.orders.filter((order) => paidStatuses.has(order.status));
  const pendingOrders = commerce.orders.filter((order) => pendingStatuses.has(order.status));
  return {
    business: { id: business.id, slug: business.slug || "", name: business.name || "" },
    enabled: settings.enabled,
    currency: settings.currency,
    revenue: roundMoney(paidOrders.reduce((sum, order) => sum + Number(order.total || order.totals?.total || 0), 0)),
    paidOrders: paidOrders.length,
    pendingOrders: pendingOrders.length,
    products: commerce.products.filter((item) => item.active !== false).length,
    lowStock: commerce.products.filter((item) => item.active !== false && Number(item.stock || 0) <= 5).length,
    activeCoupons: commerce.coupons.filter(isActiveCoupon).length,
    latestOrders: commerce.orders.slice().sort(compareNewest).slice(0, 5)
  };
}

function listProducts(products, searchParams) {
  const search = clean(searchParams.get("q") || searchParams.get("search")).toLowerCase();
  const category = clean(searchParams.get("category")).toLowerCase();
  const active = clean(searchParams.get("active"));
  return products
    .filter((item) => !search || [item.name, item.sku, item.category, ...(item.tags || [])].map(clean).join(" ").toLowerCase().includes(search))
    .filter((item) => !category || clean(item.category).toLowerCase() === category)
    .filter((item) => active === "" || Boolean(item.active !== false) === parseBoolean(active))
    .sort((left, right) => clean(left.name).localeCompare(clean(right.name), "es", { sensitivity: "base" }));
}

function listOrders(orders, searchParams) {
  const search = clean(searchParams.get("q") || searchParams.get("search")).toLowerCase();
  const status = clean(searchParams.get("status")).toLowerCase();
  return orders
    .filter((item) => !status || item.status === status)
    .filter((item) => !search || [
      item.orderNumber,
      item.id,
      item.customer?.name,
      item.customer?.email,
      item.customer?.phone
    ].map(clean).join(" ").toLowerCase().includes(search))
    .sort(compareNewest);
}

function listCoupons(coupons, searchParams) {
  const search = clean(searchParams.get("q") || searchParams.get("search")).toLowerCase();
  const active = clean(searchParams.get("active"));
  return coupons
    .filter((item) => !search || item.code.toLowerCase().includes(search))
    .filter((item) => active === "" || Boolean(item.active !== false) === parseBoolean(active))
    .sort((left, right) => left.code.localeCompare(right.code));
}

function applyOrderStatus(commerce, order, nextStatus, now) {
  const previous = order.status;
  const closesInventory = ["canceled", "expired", "failed", "refunded"].includes(nextStatus);
  const restoresInventory = ["paid", "preparing", "ready", "fulfilled"].includes(nextStatus);

  if (closesInventory && order.inventoryReserved) {
    releaseStock(commerce, order.items || []);
    order.inventoryReserved = false;
  } else if (restoresInventory && !order.inventoryReserved && ["canceled", "expired", "failed", "refunded"].includes(previous)) {
    reserveStock(commerce, order.items || []);
    order.inventoryReserved = true;
  }

  order.status = nextStatus;
  if (nextStatus === "fulfilled" && !order.fulfilledAt) order.fulfilledAt = now;
  if (nextStatus === "refunded" && !order.refundedAt) order.refundedAt = now;
  if (nextStatus === "canceled" && !order.canceledAt) order.canceledAt = now;
}

function markOrderPaid(commerce, order, event) {
  order.paymentEventIds = Array.isArray(order.paymentEventIds) ? order.paymentEventIds : [];
  if (event.id && order.paymentEventIds.includes(event.id)) return;
  if (event.id) order.paymentEventIds.push(event.id);
  order.status = "paid";
  order.providerPaymentId = event.providerPaymentId || order.providerPaymentId || "";
  order.paidAt = event.paidAt || new Date().toISOString();
  order.updatedAt = order.paidAt;
  order.events = Array.isArray(order.events) ? order.events : [];
  order.events.push({ type: "payment.paid", at: order.paidAt, actor: order.paymentProvider || "payment-provider" });
  const coupon = order.coupon?.code
    ? commerce.coupons.find((item) => item.code === order.coupon.code)
    : null;
  if (coupon && !order.couponUsageRecorded) {
    coupon.used = Number(coupon.used || 0) + 1;
    coupon.updatedAt = order.paidAt;
    order.couponUsageRecorded = true;
  }
}

function reserveStock(commerce, lines) {
  for (const line of lines) {
    const product = commerce.products.find((item) => item.id === line.id || (line.sku && item.sku === line.sku));
    if (!product || Number(product.stock || 0) < Number(line.quantity || 0)) {
      throw apiError(409, `${product?.name || line.name || "Product"} does not have enough stock`, "commerce_stock_insufficient");
    }
  }
  const now = new Date().toISOString();
  for (const line of lines) {
    const product = commerce.products.find((item) => item.id === line.id || (line.sku && item.sku === line.sku));
    product.stock = Math.max(0, Number(product.stock || 0) - Number(line.quantity || 0));
    product.updatedAt = now;
  }
}

function releaseStock(commerce, lines) {
  const now = new Date().toISOString();
  for (const line of lines) {
    const product = commerce.products.find((item) => item.id === line.id || (line.sku && item.sku === line.sku));
    if (!product) continue;
    product.stock = Number(product.stock || 0) + Number(line.quantity || 0);
    product.updatedAt = now;
  }
}

function resolveCoupon(coupons, value, subtotal) {
  const code = clean(value).toUpperCase();
  if (!code) return null;
  const coupon = coupons.find((item) => item.code === code);
  if (!coupon || !isActiveCoupon(coupon)) throw apiError(400, "Coupon is not valid", "commerce_coupon_invalid");
  if (subtotal < Number(coupon.minSubtotal || 0)) throw apiError(400, "Cart does not reach the coupon minimum", "commerce_coupon_minimum");
  return coupon;
}

function isActiveCoupon(coupon) {
  if (coupon.active === false) return false;
  if (coupon.expiresAt && Date.parse(coupon.expiresAt) <= Date.now()) return false;
  if (Number(coupon.usageLimit || 0) > 0 && Number(coupon.used || 0) >= Number(coupon.usageLimit || 0)) return false;
  return true;
}

function couponDiscount(coupon, subtotal) {
  const raw = coupon.type === "fixed"
    ? Number(coupon.value || 0)
    : subtotal * Number(coupon.value || 0) / 100;
  const capped = Number(coupon.maxDiscount || 0) > 0 ? Math.min(raw, Number(coupon.maxDiscount)) : raw;
  return roundMoney(Math.min(subtotal, Math.max(0, capped)));
}

function allocateDiscount(items, discount, subtotal) {
  let assigned = 0;
  items.forEach((item, index) => {
    const share = index === items.length - 1
      ? roundMoney(discount - assigned)
      : roundMoney(discount * item.lineSubtotal / subtotal);
    item.lineDiscount = share;
    item.lineTotal = roundMoney(item.lineSubtotal - share);
    assigned = roundMoney(assigned + share);
  });
}

function resolveShippingMethod(methods, value) {
  const active = methods.filter((item) => item.active !== false);
  const method = active.find((item) => item.id === clean(value))
    || active.find((item) => item.default)
    || active[0];
  if (!method) throw apiError(400, "No shipping method is available", "commerce_shipping_unavailable");
  return { ...method };
}

function normalizeShippingMethods(value) {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_SHIPPING_METHODS;
  const methods = source.slice(0, 20).map((item, index) => ({
    id: slugify(item.id || item.name || `shipping-${index + 1}`),
    name: requiredText(item.name || "Entrega", "shipping name", 120),
    description: optionalText(item.description, 500),
    price: money(item.price || 0, "shipping price"),
    active: item.active !== false,
    default: item.default === true,
    allowedCountries: normalizeCountries(item.allowedCountries || ["ES"])
  }));
  if (!methods.some((item) => item.active !== false)) methods[0].active = true;
  if (!methods.some((item) => item.default && item.active !== false)) {
    const first = methods.find((item) => item.active !== false);
    if (first) first.default = true;
  }
  let foundDefault = false;
  methods.forEach((item) => {
    if (item.default && item.active !== false && !foundDefault) foundDefault = true;
    else if (item.default) item.default = false;
  });
  return methods;
}

function normalizeCustomer(source) {
  return {
    name: requiredText(source.name, "customer name", 160),
    email: optionalEmail(source.email),
    phone: optionalText(source.phone, 60),
    address: optionalText(source.address, 500)
  };
}

function publicOrder(order) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    customer: { name: order.customer?.name || "" },
    currency: order.currency,
    items: order.items,
    shippingMethod: order.shippingMethod,
    totals: order.totals,
    total: order.total,
    trackingNumber: order.trackingNumber || "",
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paidAt: order.paidAt || "",
    fulfilledAt: order.fulfilledAt || ""
  };
}

function checkoutPayload(order) {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    token: order.publicToken,
    status: order.status,
    url: order.checkoutUrl,
    checkoutUrl: order.checkoutUrl
  };
}

function checkoutRedirects(request, business, commerce) {
  const settings = commerceSettings(business, commerce);
  const origin = safeOrigin(request.headers.origin);
  const published = optionalUrl(business.publishedUrl || business.content?.publishedUrl);
  const fallback = published || origin || requestBaseUrl(request);
  return {
    successUrl: settings.successUrl || fallback,
    cancelUrl: settings.cancelUrl || fallback
  };
}

function touchCommerce(business, commerce, type, subjectId, now) {
  commerce.updatedAt = now;
  commerce.auditLog = Array.isArray(commerce.auditLog) ? commerce.auditLog : [];
  commerce.auditLog.unshift({
    id: `commerce_audit_${randomUUID()}`,
    type,
    subjectId,
    createdAt: now
  });
  commerce.auditLog = commerce.auditLog.slice(0, 500);
  business.updatedAt = now;
}

function nextOrderNumber(orders, now) {
  const year = now.slice(0, 4);
  const prefix = `WEB-${year}-`;
  const next = orders.reduce((max, order) => {
    const match = clean(order.orderNumber).match(/^WEB-\d{4}-(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

function endpointFor(endpoint, fallback) {
  if (!endpoint) return fallback;
  try {
    const parsed = new URL(endpoint);
    const marker = parsed.pathname.lastIndexOf("/store/");
    parsed.pathname = marker >= 0 ? `${parsed.pathname.slice(0, marker + 7)}config` : fallback;
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return fallback;
  }
}

function uniqueProductId(value, products) {
  const base = slugify(value) || `product-${randomUUID().slice(0, 8)}`;
  let candidate = base;
  let suffix = 2;
  while (products.some((item) => item.id === candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const key = clean(item.id || item.orderNumber || item.sku || JSON.stringify(item));
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function uniqueByCode(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item || typeof item !== "object") return false;
    const key = clean(item.code || item.id).toUpperCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function arrayFrom(...values) {
  return values.find((value) => Array.isArray(value) && value.length) || [];
}

function valueOf(source, existing, key, fallback = "") {
  if (source[key] !== undefined) return source[key];
  if (existing?.[key] !== undefined) return existing[key];
  return fallback;
}

function requireBusiness(db, ref) {
  const business = db.businesses.find((item) => item.id === ref || item.slug === ref);
  if (!business) throw apiError(404, "Business not found", "business_not_found");
  return business;
}

function requirePublishedBusiness(db, slug) {
  const business = db.businesses.find((item) => item.slug === slug || item.id === slug);
  if (!business || business.status === "archived") throw apiError(404, "Store not found", "commerce_store_not_found");
  const commerce = ensureCommerce(business);
  if (commerce.enabled !== true && process.env.NODE_ENV === "production") {
    throw apiError(404, "Store not found", "commerce_store_not_found");
  }
  return business;
}

function requireObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw apiError(400, "JSON body must be an object", "invalid_json_object");
  }
  return value;
}

async function readJsonBody(request) {
  const raw = await readRawBody(request);
  try {
    return JSON.parse(raw);
  } catch {
    throw apiError(400, "Invalid JSON body", "invalid_json");
  }
}

async function readRawBody(request) {
  let raw = "";
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw apiError(413, "Commerce payload is too large", "commerce_payload_too_large");
    raw += chunk.toString("utf8");
  }
  if (!raw.trim()) throw apiError(400, "JSON body is required", "json_body_required");
  return raw;
}

function sendJson(response, status, payload, context, extra = {}) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extra
  });
  response.end(JSON.stringify(payload));
}

function sendEmpty(response, status, context, allow) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    Allow: allow
  });
  response.end();
}

function publicCacheHeaders() {
  return { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" };
}

function methodNotAllowed(allow) {
  const error = apiError(405, "Method not allowed", "method_not_allowed");
  error.allow = allow;
  return error;
}

function apiError(statusCode, message, code = "commerce_error") {
  return Object.assign(new Error(message), { statusCode, code });
}

function requiredText(value, field, maxLength) {
  const result = clean(value);
  if (!result) throw apiError(400, `${field} is required`, `commerce_${slugify(field)}_required`);
  if (result.length > maxLength) throw apiError(400, `${field} is too long`, `commerce_${slugify(field)}_too_long`);
  return result;
}

function optionalText(value, maxLength) {
  const result = clean(value);
  if (result.length > maxLength) throw apiError(400, "Text value is too long", "commerce_text_too_long");
  return result;
}

function optionalEmail(value) {
  const result = clean(value).toLowerCase();
  if (!result) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw apiError(400, "Email is invalid", "commerce_email_invalid");
  return result;
}

function optionalUrl(value) {
  const result = clean(value);
  if (!result) return "";
  try {
    const parsed = new URL(result);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("protocol");
    return parsed.toString();
  } catch {
    throw apiError(400, "URL is invalid", "commerce_url_invalid");
  }
}

function optionalDateTime(value) {
  const result = clean(value);
  if (!result) return "";
  const timestamp = Date.parse(result);
  if (!Number.isFinite(timestamp)) throw apiError(400, "Date is invalid", "commerce_date_invalid");
  return new Date(timestamp).toISOString();
}

function money(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100000000) {
    throw apiError(400, `${field} must be a positive amount`, `commerce_${slugify(field)}_invalid`);
  }
  return roundMoney(number);
}

function quantity(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100000000) {
    throw apiError(400, `${field} must be a positive quantity`, `commerce_${slugify(field)}_invalid`);
  }
  return Math.floor(number);
}

function integer(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > Number.MAX_SAFE_INTEGER) {
    throw apiError(400, `${field} must be a positive integer`, `commerce_${slugify(field)}_invalid`);
  }
  return Math.floor(number);
}

function percentage(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 100) {
    throw apiError(400, `${field} must be between 0 and 100`, `commerce_${slugify(field)}_invalid`);
  }
  return roundMoney(number);
}

function enumValue(value, allowed, field) {
  const result = clean(value).toLowerCase();
  if (!allowed.has(result)) throw apiError(400, `${field} is invalid`, `commerce_${slugify(field)}_invalid`);
  return result;
}

function normalizeCurrency(value) {
  const result = clean(value).toUpperCase();
  if (!/^[A-Z]{3}$/.test(result)) throw apiError(400, "Currency must use an ISO three-letter code", "commerce_currency_invalid");
  return result;
}

function normalizeCountries(value) {
  const source = Array.isArray(value) ? value : clean(value).split(",");
  const countries = [...new Set(source.map((item) => clean(item).toUpperCase()).filter((item) => /^[A-Z]{2}$/.test(item)))].slice(0, 20);
  return countries.length ? countries : ["ES"];
}

function normalizeTags(value) {
  const source = Array.isArray(value) ? value : clean(value).split(",");
  return [...new Set(source.map((item) => optionalText(item, 60)).filter(Boolean))].slice(0, 30);
}

function safeOrigin(value) {
  const result = clean(value);
  if (!result) return "";
  try {
    const parsed = new URL(result);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.origin : "";
  } catch {
    return "";
  }
}

function requestBaseUrl(request) {
  const protocol = clean(request.headers["x-forwarded-proto"] || "http").split(",")[0];
  const host = clean(request.headers["x-forwarded-host"] || request.headers.host || "127.0.0.1").split(",")[0];
  return `${protocol}://${host}`;
}

function parseBoolean(value) {
  return ["1", "true", "yes", "on"].includes(clean(value).toLowerCase());
}

function compareNewest(left, right) {
  return String(right.createdAt || right.updatedAt || "").localeCompare(String(left.createdAt || left.updatedAt || ""));
}

function roundMoney(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function slugify(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clean(value) {
  return String(value ?? "").trim();
}
