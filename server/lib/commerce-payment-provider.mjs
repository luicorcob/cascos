import { randomUUID } from "node:crypto";

export async function createCommerceCheckoutSession(input, options = {}) {
  const env = options.env || process.env;
  const secretKey = clean(env.STRIPE_SECRET_KEY);

  if (!secretKey) {
    if (env.NODE_ENV === "production") {
      throw providerError(503, "STRIPE_SECRET_KEY is not configured", "stripe_not_configured");
    }

    const providerSessionId = `cs_commerce_dev_${randomUUID()}`;
    return {
      provider: "development",
      providerSessionId,
      checkoutUrl: appendParams(input.successUrl, {
        pedido: "ok",
        order: input.orderId,
        checkout_session: providerSessionId,
        development: "1"
      }),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };
  }

  const Stripe = (await import("stripe")).default;
  const stripe = options.stripe || new Stripe(secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: input.orderId,
    customer_email: clean(input.customerEmail) || undefined,
    success_url: appendParams(input.successUrl, { pedido: "ok", order: input.orderId }),
    cancel_url: appendParams(input.cancelUrl, { pedido: "cancelado", order: input.orderId }),
    submit_type: "pay",
    line_items: (input.items || []).map((item) => ({
      quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
      price_data: {
        currency: String(input.currency || "EUR").toLowerCase(),
        unit_amount: Math.round(Number(item.unitAmount || item.price || 0) * 100),
        product_data: {
          name: clean(item.name) || "Producto",
          description: clean(item.description).slice(0, 500) || undefined,
          images: /^https?:\/\//i.test(clean(item.image)) ? [clean(item.image)] : undefined,
          metadata: clean(item.sku) ? { sku: clean(item.sku) } : undefined
        }
      }
    })),
    metadata: {
      orderId: input.orderId,
      orderNumber: input.orderNumber,
      businessId: input.businessId,
      businessSlug: input.businessSlug
    },
    payment_intent_data: {
      metadata: {
        orderId: input.orderId,
        orderNumber: input.orderNumber,
        businessId: input.businessId
      }
    }
  }, {
    idempotencyKey: clean(input.idempotencyKey) || input.orderId
  });

  return {
    provider: "stripe",
    providerSessionId: session.id,
    checkoutUrl: session.url,
    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : ""
  };
}

export async function verifyCommercePaymentWebhook(rawBody, headers, options = {}) {
  const env = options.env || process.env;
  const stripeSecret = clean(env.STRIPE_SECRET_KEY);
  const endpointSecret = clean(env.STRIPE_COMMERCE_WEBHOOK_SECRET || env.STRIPE_WEBHOOK_SECRET);

  if (stripeSecret && endpointSecret) {
    const Stripe = (await import("stripe")).default;
    const stripe = options.stripe || new Stripe(stripeSecret);
    const event = stripe.webhooks.constructEvent(rawBody, headers["stripe-signature"], endpointSecret);
    const session = event.data?.object || {};

    if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) {
      return { id: event.id, type: event.type, ignored: true };
    }

    return {
      id: event.id,
      type: event.type,
      providerSessionId: clean(session.id),
      providerPaymentId: typeof session.payment_intent === "string"
        ? session.payment_intent
        : clean(session.payment_intent?.id),
      paidAt: new Date((event.created || Math.floor(Date.now() / 1000)) * 1000).toISOString()
    };
  }

  if (env.NODE_ENV === "production") {
    throw providerError(503, "Stripe commerce webhook is not configured", "stripe_webhook_not_configured");
  }

  const secret = clean(env.DLS_COMMERCE_WEBHOOK_SECRET);
  if (!secret) {
    throw providerError(503, "DLS_COMMERCE_WEBHOOK_SECRET is not configured", "development_webhook_not_configured");
  }

  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const provided = clean(headers["x-dls-signature"]);
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);

  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw providerError(401, "Invalid commerce webhook signature", "invalid_signature");
  }

  const payload = JSON.parse(rawBody);
  return {
    id: clean(payload.id) || `evt_commerce_dev_${randomUUID()}`,
    type: clean(payload.type),
    providerSessionId: clean(payload.data?.providerSessionId || payload.providerSessionId),
    providerPaymentId: clean(payload.data?.providerPaymentId || payload.providerPaymentId),
    paidAt: payload.data?.paidAt || payload.paidAt || new Date().toISOString()
  };
}

function appendParams(value, params) {
  const url = new URL(value);
  Object.entries(params).forEach(([key, item]) => {
    if (item !== undefined && item !== null && item !== "") url.searchParams.set(key, String(item));
  });
  return url.toString();
}

function providerError(statusCode, message, code) {
  return Object.assign(new Error(message), { statusCode, code });
}

function clean(value) {
  return String(value ?? "").trim();
}
