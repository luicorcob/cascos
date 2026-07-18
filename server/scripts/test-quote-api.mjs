import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-quote-api-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const otherBusinessId = "biz_demo_luz_habitat";
const adminToken = "quote-admin-token";
const webhookSecret = "quote-payment-webhook-secret";
let child;
let logs = "";

try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: adminToken, ADMIN_API_TOKEN: adminToken,
      CLIENT_SESSION_SECRET: "quote-client-session-secret-32",
      DLS_QUOTE_WEBHOOK_SECRET: webhookSecret, STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "", STRIPE_QUOTE_WEBHOOK_SECRET: "",
      BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  child.stdout.on("data", appendLog); child.stderr.on("data", appendLog); await waitForHealth();

  const lead = await jsonRequest("/api/public/brasa-norte/leads", { method: "POST", expectedStatus: 201, body: { name: "Elena Firma", email: "elena-quote@example.com", message: "Quiero cerrar el proyecto", privacyAccepted: true, privacyAcceptedAt: new Date().toISOString(), privacyPolicyUrl: "https://example.com/privacidad" } });
  const created = await adminJson(`/api/businesses/${businessId}/proposals`, {
    method: "POST", expectedStatus: 201,
    body: {
      contactId: lead.contact.id, package: "custom", title: "Cierre en un toque", setupPrice: 1200, monthlyPrice: 100, currency: "EUR",
      conditions: "Entrega en treinta dias. La firma acepta el alcance y el calendario de pagos.", expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), status: "borrador", signatureRequired: true,
      lineItems: [{ description: "Implantacion completa", quantity: 1, unitPrice: 1200, discountPercent: 10, taxRate: 21, billing: "one_time" }, { description: "Soporte mensual", quantity: 1, unitPrice: 100, discountPercent: 0, taxRate: 21, billing: "recurring" }],
      deposit: { mode: "percent", value: 40 }
    }
  });
  const proposalId = created.proposal.id;
  assert.equal(created.proposal.versions.length, 1);
  assert.equal(created.proposal.total, 1427.8);
  await adminJson(`/api/businesses/${businessId}/proposals/${proposalId}`, { method: "PATCH", body: { title: "Cierre en un toque - final", conditions: "Entrega en treinta dias. Version final aceptable mediante firma digital." } });
  assert.equal((await adminJson(`/api/businesses/${businessId}/proposals/${proposalId}/versions`)).versions.length, 2);

  const shared = await adminJson(`/api/businesses/${businessId}/proposals/${proposalId}/share`, { method: "POST", expectedStatus: 201, body: {} });
  assert.ok(shared.token.length > 30);
  assert.match(shared.url, new RegExp(`^${baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/pages/proposal.html\\?quote=`));
  const tokenPath = encodeURIComponent(shared.token);
  let publicQuote = await jsonRequest(`/api/public/quotes/${tokenPath}`);
  assert.equal(publicQuote.proposal.status, "vista");
  assert.equal(publicQuote.proposal.revision, 2);
  assert.equal(publicQuote.proposal.lineItems.length, 2);
  await jsonRequest(`/api/public/quotes/${tokenPath}/comments`, { method: "POST", expectedStatus: 201, body: { authorName: "Elena Firma", authorEmail: "elena-quote@example.com", message: "Confirmad que el soporte empieza tras la entrega." } });
  const decision = await jsonRequest(`/api/public/quotes/${tokenPath}/decision`, { method: "POST", body: { decision: "accepted", signerName: "Elena Firma", signerEmail: "elena-quote@example.com", signatureType: "typed", signatureValue: "Elena Firma", acceptedTerms: true, idempotencyKey: "quote-api-accept-1" } });
  assert.equal(decision.decision.decision, "accepted");
  assert.ok(decision.outputs.project);
  assert.ok(decision.outputs.invoice);
  assert.ok(decision.outputs.subscription);
  assert.equal(decision.proposal.proposal.status, "aceptada");

  const checkout = await jsonRequest(`/api/public/quotes/${tokenPath}/checkout`, { method: "POST", expectedStatus: 201, body: { idempotencyKey: "quote-deposit-checkout" } });
  assert.equal(checkout.checkout.provider, "development");
  assert.ok(checkout.checkout.providerSessionId.startsWith("cs_dev_"));
  assert.ok(checkout.checkout.checkoutUrl.includes("payment=success"));
  const paymentEvent = { id: "evt_quote_paid_1", type: "checkout.session.completed", data: { providerSessionId: checkout.checkout.providerSessionId, providerPaymentId: "pi_quote_paid_1", method: "development", paidAt: new Date().toISOString() } };
  const webhook = await signedWebhook("/api/webhooks/stripe/quotes", paymentEvent);
  assert.equal(webhook.completed, true);
  assert.equal((await signedWebhook("/api/webhooks/stripe/quotes", paymentEvent)).duplicate, true);
  publicQuote = await jsonRequest(`/api/public/quotes/${tokenPath}`);
  assert.ok(publicQuote.invoice.paidAmount > 0);
  assert.equal(publicQuote.paymentSchedule[0].status, "paid");

  const highDiscount = await adminJson(`/api/businesses/${businessId}/proposals`, { method: "POST", expectedStatus: 201, body: { contactId: lead.contact.id, package: "custom", setupPrice: 1000, monthlyPrice: 0, title: "Descuento controlado", currency: "EUR", conditions: "Requiere aprobacion interna.", expiresAt: new Date(Date.now() + 20 * 86400000).toISOString(), lineItems: [{ description: "Proyecto", quantity: 1, unitPrice: 1000, discountPercent: 30, taxRate: 21, billing: "one_time" }] } });
  await adminJson(`/api/businesses/${businessId}/proposals/${highDiscount.proposal.id}/share`, { method: "POST", expectedStatus: 409, body: {} });
  await adminJson(`/api/businesses/${businessId}/proposals/${highDiscount.proposal.id}/approval`, { method: "POST", body: { approved: true, actorId: "director_financiero", note: "Margen validado" } });
  const approvedShare = await adminJson(`/api/businesses/${businessId}/proposals/${highDiscount.proposal.id}/share`, { method: "POST", expectedStatus: 201, body: {} });
  await adminJson(`/api/businesses/${businessId}/proposals/${highDiscount.proposal.id}/share/${approvedShare.share.id}`, { method: "DELETE" });
  await jsonRequest(`/api/public/quotes/${encodeURIComponent(approvedShare.token)}`, { expectedStatus: 404 });

  await adminJson(`/api/businesses/${businessId}/portal-access`, { method: "POST", body: { password: "QuotePortal2026!" } });
  const login = await jsonRequest("/api/client/login", { method: "POST", body: { business: businessId, password: "QuotePortal2026!" } });
  const clientHeaders = { "X-LocalLift-Client-Token": login.session.token };
  assert.equal((await jsonRequest(`/api/businesses/${businessId}/proposals/${proposalId}/timeline`, { headers: clientHeaders })).proposal.id, proposalId);
  await jsonRequest(`/api/businesses/${businessId}/proposals/${proposalId}/share`, { method: "POST", headers: clientHeaders, expectedStatus: 403, body: {} });
  await jsonRequest(`/api/businesses/${otherBusinessId}/proposals/${proposalId}/timeline`, { headers: clientHeaders, expectedStatus: 403 });

  const persisted = JSON.parse(await readFile(dbPath, "utf8"));
  assert.ok(persisted.proposalVersions.length >= 3);
  assert.ok(persisted.proposalViews.length >= 2);
  assert.ok(persisted.proposalComments.some((item) => item.message.includes("soporte")));
  assert.ok(persisted.proposalDecisions.some((item) => item.evidenceHash));
  assert.equal(persisted.projects.filter((item) => item.proposalId === proposalId).length, 1);
  assert.equal(persisted.invoices.filter((item) => item.proposalId === proposalId).length, 1);
  assert.equal(persisted.subscriptions.filter((item) => item.proposalId === proposalId).length, 1);
  assert.ok(persisted.payments.some((item) => item.reference === "pi_quote_paid_1"));
  console.log("Quote API checks passed: advanced proposal, immutable versions, secure public link, views, comments, signature evidence, discount approval, idempotent outputs, checkout/webhook payment, revocation, tenancy and client read-only access.");
} finally {
  if (child && child.exitCode === null) { child.kill(); await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(2000)]); }
  await rm(tempDir, { recursive: true, force: true });
}

function adminJson(pathname, options = {}) { return jsonRequest(pathname, { ...options, headers: { ...options.headers, Authorization: `Bearer ${adminToken}` } }); }
async function signedWebhook(pathname, body) { const raw = JSON.stringify(body); const signature = `sha256=${createHmac("sha256", webhookSecret).update(raw).digest("hex")}`; return jsonRequest(pathname, { method: "POST", rawBody: raw, headers: { "Content-Type": "application/json", "x-dls-signature": signature } }); }
async function jsonRequest(pathname, options = {}) { const headers = { ...options.headers }; const init = { method: options.method || "GET", headers }; if (options.rawBody !== undefined) init.body = options.rawBody; else if (options.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); } const response = await fetch(`${baseUrl}${pathname}`, init); const text = await response.text(); const expectedStatus = options.expectedStatus || 200; if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`); return text ? JSON.parse(text) : {}; }
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (child.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
