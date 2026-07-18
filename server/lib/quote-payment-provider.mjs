import { randomUUID } from "node:crypto";

export async function createQuoteCheckoutSession(input, options = {}) {
  const env = options.env || process.env;
  const secretKey = clean(env.STRIPE_SECRET_KEY);
  if (!secretKey) {
    if (env.NODE_ENV === "production") throw providerError(503, "STRIPE_SECRET_KEY is not configured", "stripe_not_configured");
    const providerSessionId = `cs_dev_${randomUUID()}`;
    return { provider: "development", providerSessionId, checkoutUrl: `${input.successUrl}${input.successUrl.includes("?") ? "&" : "?"}checkout_session=${encodeURIComponent(providerSessionId)}&development=1`, expiresAt: new Date(Date.now() + 24 * 3600000).toISOString() };
  }
  const Stripe = (await import("stripe")).default;
  const stripe = options.stripe || new Stripe(secretKey);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    client_reference_id: input.proposalId,
    customer_email: clean(input.customerEmail) || undefined,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    submit_type: "pay",
    line_items: [{ price_data: { currency: String(input.currency || "EUR").toLowerCase(), unit_amount: Math.round(Number(input.amount) * 100), product_data: { name: clean(input.name) || "Pago de propuesta", description: clean(input.description).slice(0, 500) || undefined } }, quantity: 1 }],
    metadata: { checkoutId: input.checkoutId, proposalId: input.proposalId, invoiceId: input.invoiceId, businessId: input.businessId }
  }, { idempotencyKey: input.idempotencyKey });
  return { provider: "stripe", providerSessionId: session.id, checkoutUrl: session.url, expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : "" };
}

export async function verifyQuotePaymentWebhook(rawBody, headers, options = {}) {
  const env = options.env || process.env;
  const stripeSecret = clean(env.STRIPE_SECRET_KEY);
  const endpointSecret = clean(env.STRIPE_QUOTE_WEBHOOK_SECRET || env.STRIPE_WEBHOOK_SECRET);
  if (stripeSecret && endpointSecret) {
    const Stripe = (await import("stripe")).default;
    const stripe = options.stripe || new Stripe(stripeSecret);
    const event = stripe.webhooks.constructEvent(rawBody, headers["stripe-signature"], endpointSecret);
    return normalizeStripeEvent(event);
  }
  if (env.NODE_ENV === "production") throw providerError(503, "Stripe quote webhook is not configured", "stripe_webhook_not_configured");
  const secret = clean(env.DLS_QUOTE_WEBHOOK_SECRET);
  if (!secret) throw providerError(503, "DLS_QUOTE_WEBHOOK_SECRET is not configured", "development_webhook_not_configured");
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const provided = clean(headers["x-dls-signature"]);
  const left = Buffer.from(expected); const right = Buffer.from(provided);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw providerError(401, "Invalid quote payment webhook signature", "invalid_signature");
  const payload = JSON.parse(rawBody);
  return { id: clean(payload.id) || `evt_dev_${randomUUID()}`, type: clean(payload.type), providerSessionId: clean(payload.data?.providerSessionId || payload.providerSessionId), providerPaymentId: clean(payload.data?.providerPaymentId || payload.providerPaymentId), paidAt: payload.data?.paidAt || payload.paidAt || new Date().toISOString(), method: clean(payload.data?.method || payload.method) || "development" };
}

function normalizeStripeEvent(event) { const session = event.data?.object || {}; if (event.type !== "checkout.session.completed" && event.type !== "checkout.session.async_payment_succeeded") return { id: event.id, type: event.type, ignored: true }; return { id: event.id, type: event.type, providerSessionId: session.id, providerPaymentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "", paidAt: new Date((event.created || Math.floor(Date.now() / 1000)) * 1000).toISOString(), method: "stripe" }; }
function providerError(statusCode, message, code) { return Object.assign(new Error(message), { statusCode, code }); }
function clean(value) { return String(value ?? "").trim(); }
