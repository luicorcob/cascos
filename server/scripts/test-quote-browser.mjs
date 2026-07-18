import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, copyFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-quote-browser-"));
const profileRoot = await mkdtemp(path.join(os.tmpdir(), "dls-quote-browser-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const webhookSecret = "quote-browser-webhook";
const chrome = await findChrome();
let server;
let logs = "";

try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  server = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test", LOCALLIFT_ADMIN_TOKEN: "", ADMIN_API_TOKEN: "", DLS_QUOTE_WEBHOOK_SECRET: webhookSecret, STRIPE_SECRET_KEY: "", STRIPE_WEBHOOK_SECRET: "",
      BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "", BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  server.stdout.on("data", appendLog); server.stderr.on("data", appendLog); await waitForHealth();
  const lead = await createLead("Vera Cierre", "vera-cierre@example.com");
  const proposal = await createProposal(lead.contact.id, "Cierre en un toque Browser", 10);
  await jsonRequest(`/api/businesses/${businessId}/proposals/${proposal.proposal.id}`, { method: "PATCH", body: { title: "Cierre en un toque Browser - final" } });
  const shared = await jsonRequest(`/api/businesses/${businessId}/proposals/${proposal.proposal.id}/share`, { method: "POST", expectedStatus: 201, body: {} });
  await jsonRequest(`/api/public/quotes/${encodeURIComponent(shared.token)}/comments`, { method: "POST", expectedStatus: 201, body: { authorName: "Vera Cierre", authorEmail: "vera-cierre@example.com", message: "Confirmad el inicio del soporte mensual." } });
  const highDiscount = await createProposal(lead.contact.id, "Descuento pendiente Browser", 30);

  for (const size of ["1440,1200", "390,844"]) {
    const dom = await browserDom(`${baseUrl}/pages/proposal.html?quote=${encodeURIComponent(shared.token)}`, size, `public-pending-${size}`);
    assert.match(dom, /Documento seguro y versionado/);
    assert.match(dom, /Cierre en un toque Browser - final/);
    assert.match(dom, /Servicios incluidos/);
    assert.match(dom, /Implantacion completa/);
    assert.match(dom, /Soporte mensual/);
    assert.match(dom, /Alcance y compromisos/);
    assert.match(dom, /Confirmad el inicio del soporte mensual/);
    assert.match(dom, /Aceptar y firmar/);
    assert.match(dom, /Solicitar cambios/);
    assert.match(dom, /Firma escrita/);
    assert.match(dom, /Hash y version registrados/);
    assert.doesNotMatch(dom, /Enlace no disponible/);
  }

  await jsonRequest(`/api/public/quotes/${encodeURIComponent(shared.token)}/decision`, { method: "POST", body: { decision: "accepted", signerName: "Vera Cierre", signerEmail: "vera-cierre@example.com", signatureType: "typed", signatureValue: "Vera Cierre", acceptedTerms: true, idempotencyKey: "browser-accept" } });
  const checkout = await jsonRequest(`/api/public/quotes/${encodeURIComponent(shared.token)}/checkout`, { method: "POST", expectedStatus: 201, body: { idempotencyKey: "browser-deposit" } });
  await signedWebhook({ id: "evt_browser_deposit", type: "checkout.session.completed", data: { providerSessionId: checkout.checkout.providerSessionId, providerPaymentId: "pi_browser_deposit", method: "development" } });

  for (const size of ["1440,1200", "390,844"]) {
    const dom = await browserDom(`${baseUrl}/pages/proposal.html?quote=${encodeURIComponent(shared.token)}`, size, `public-accepted-${size}`);
    assert.match(dom, /Propuesta aceptada y firmada/);
    assert.match(dom, /Decision registrada/);
    assert.match(dom, /Factura y calendario de pagos/);
    assert.match(dom, /Señal/);
    assert.match(dom, /Pagado/);
    assert.match(dom, /Pagar/);
    assert.match(dom, /Evidencia/);
  }

  for (const size of ["1440,1200", "390,844"]) {
    const dom = await browserDom(`${baseUrl}/pages/business-dashboard.html?business=${businessId}&tab=proposals&apiBase=same-origin`, size, `dashboard-${size}`);
    assert.match(dom, /Crear propuesta de cierre/);
    assert.match(dom, /Versionada, firmable/);
    assert.match(dom, /Cierre en un toque Browser - final/);
    assert.match(dom, /Descuento pendiente Browser/);
    assert.match(dom, /Total con impuestos/);
    assert.match(dom, /Aperturas/);
    assert.match(dom, /Versiones, firma, cobros y actividad/);
    assert.match(dom, /Quote-to-cash/);
    assert.match(dom, /Aprobar descuento/);
    assert.match(dom, /proposal-qtc-flow/);
    assert.match(dom, /proposal-payment-schedule/);
    assert.doesNotMatch(dom, /No pudimos consultar las propuestas/);
  }
  console.log("Quote browser checks passed: responsive public proposal, line items, comments, signature decision, payment schedule and responsive dashboard quote-to-cash controls.");
} finally {
  if (server && server.exitCode === null) { server.kill(); await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(2000)]); }
  await rm(tempDir, { recursive: true, force: true });
  await rm(profileRoot, { recursive: true, force: true }).catch(() => {});
}

function createLead(name, email) { return jsonRequest("/api/public/brasa-norte/leads", { method: "POST", expectedStatus: 201, body: { name, email, message: "Quiero cerrar", privacyAccepted: true, privacyAcceptedAt: new Date().toISOString(), privacyPolicyUrl: "https://example.com/privacidad" } }); }
function createProposal(contactId, title, discountPercent) { return jsonRequest(`/api/businesses/${businessId}/proposals`, { method: "POST", expectedStatus: 201, body: { contactId, package: "custom", title, setupPrice: 1000, monthlyPrice: 100, currency: "EUR", conditions: "Entrega en treinta dias con soporte y calendario verificable.", expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(), status: "borrador", signatureRequired: true, deposit: { mode: "percent", value: 40 }, lineItems: [{ description: "Implantacion completa", quantity: 1, unitPrice: 1000, discountPercent, taxRate: 21, billing: "one_time" }, { description: "Soporte mensual", quantity: 1, unitPrice: 100, discountPercent: 0, taxRate: 21, billing: "recurring" }] } }); }
async function signedWebhook(body) { const raw = JSON.stringify(body); const signature = `sha256=${createHmac("sha256", webhookSecret).update(raw).digest("hex")}`; return jsonRequest("/api/webhooks/stripe/quotes", { method: "POST", rawBody: raw, headers: { "Content-Type": "application/json", "x-dls-signature": signature } }); }
async function jsonRequest(pathname, options = {}) { const headers = { ...options.headers }; const init = { method: options.method || "GET", headers }; if (options.rawBody !== undefined) init.body = options.rawBody; else if (options.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); } const response = await fetch(`${baseUrl}${pathname}`, init); const text = await response.text(); const expectedStatus = options.expectedStatus || 200; if (response.status !== expectedStatus) throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}`); return text ? JSON.parse(text) : {}; }
async function browserDom(url, size, label) { const profile = `${profileRoot}-${label.replace(/[^A-Za-z0-9_-]/g, "-")}`; const result = await run(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${profile}`, `--window-size=${size}`, "--virtual-time-budget=18000", "--dump-dom", url]); assert.equal(result.exitCode, 0, `Chrome failed for ${label}: ${result.stderr}`); await rm(profile, { recursive: true, force: true }).catch(() => {}); return result.stdout; }
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (server.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
async function findChrome() { const candidates = process.platform === "win32" ? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")] : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]; for (const candidate of candidates) { try { await access(candidate); return candidate; } catch {} } throw new Error("Chrome or Chromium is required for the quote browser test"); }
function run(command, args) { return new Promise((resolve, reject) => { const processChild = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; processChild.stdout.on("data", (chunk) => { stdout += String(chunk); }); processChild.stderr.on("data", (chunk) => { stderr += String(chunk); }); processChild.on("error", reject); processChild.on("close", (exitCode) => resolve({ exitCode, stdout, stderr })); }); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
