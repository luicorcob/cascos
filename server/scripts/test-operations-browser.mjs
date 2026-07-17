import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:net";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-operations-browser-"));
const profile = await mkdtemp(path.join(os.tmpdir(), "dls-operations-browser-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const chrome = await findChrome();
let server;
let logs = "";
const fixtureName = `.tmp-client-portal-${Date.now().toString(36)}.html`;
const fixturePath = path.join(root, fixtureName);

try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  server = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: "",
      ADMIN_API_TOKEN: "",
      BUSINESS_STORE: "json",
      BUSINESS_DB_DRIVER: "json",
      DATABASE_URL: "",
      POSTGRES_URL: "",
      LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath,
      BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"),
      BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true
  });
  server.stdout.on("data", appendLog);
  server.stderr.on("data", appendLog);
  await waitForHealth();

  await jsonRequest("/api/enterprise/projects", {
    method: "POST",
    body: {
      businessId: "biz_demo_brasa_norte",
      name: "Proyecto visible en navegador",
      responsible: "Equipo de prueba",
      priority: "urgent",
      status: "review",
      startDate: "2026-07-01",
      dueDate: "2026-07-31"
    }
  });
  await jsonRequest("/api/enterprise/subscriptions", {
    method: "POST",
    body: {
      businessId: "biz_demo_brasa_norte",
      name: "Mantenimiento visible",
      price: 59,
      currency: "EUR",
      frequency: "monthly",
      nextRenewal: "2026-08-01",
      status: "active",
      noticeDays: 30
    }
  });
  const invoice = await jsonRequest("/api/enterprise/invoices", {
    method: "POST",
    body: {
      businessId: "biz_demo_brasa_norte",
      projectId: (await jsonRequest("/api/enterprise/projects")).projects[0].id,
      concept: "Factura visible en portal",
      issueDate: dateOffset(0),
      dueDate: dateOffset(14),
      subtotal: 200,
      taxRate: 21,
      currency: "EUR",
      status: "sent"
    }
  });
  await jsonRequest("/api/enterprise/documents", {
    method: "POST",
    body: { businessId: "biz_demo_brasa_norte", name: "Documento visible en portal", category: "contract", url: "https://files.example.com/contract.pdf", visibility: "client" }
  });
  await jsonRequest("/api/businesses/biz_demo_brasa_norte/portal-access", { method: "POST", body: { password: "PortalBrowser2026!" } });
  const login = await jsonRequest("/api/client/login", { method: "POST", body: { business: "biz_demo_brasa_norte", password: "PortalBrowser2026!" } });
  const clientHeaders = { "X-LocalLift-Client-Token": login.session.token };
  await jsonRequest("/api/businesses/biz_demo_brasa_norte/communications/members", { method: "POST", headers: clientHeaders, body: { name: "Ana Navegador", role: "owner" } });
  const support = await jsonRequest("/api/businesses/biz_demo_brasa_norte/communications/threads", { method: "POST", headers: clientHeaders, body: { type: "support" } });
  await jsonRequest(`/api/businesses/biz_demo_brasa_norte/communications/threads/${support.thread.id}/messages`, { method: "POST", headers: clientHeaders, body: { senderName: "Ana Navegador", body: "Mensaje de soporte visible" } });
  const teamRoom = await jsonRequest("/api/businesses/biz_demo_brasa_norte/communications/threads", { method: "POST", headers: clientHeaders, body: { type: "team", title: "Canal navegador" } });
  await jsonRequest(`/api/businesses/biz_demo_brasa_norte/communications/threads/${teamRoom.thread.id}/messages`, { method: "POST", headers: clientHeaders, body: { senderName: "Ana Navegador", body: "Mensaje interno visible" } });

  for (const size of ["1440,1000", "390,844"]) {
    const result = await run(chrome, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}-${size.replace(",", "x")}`,
      `--window-size=${size}`,
      "--virtual-time-budget=7000",
      "--dump-dom",
      `${baseUrl}/pages/projects.html?apiBase=same-origin`
    ]);
    assert.equal(result.exitCode, 0, `Chrome failed at ${size}: ${result.stderr}`);
    assert.match(result.stdout, /Proyecto visible en navegador/);
    assert.match(result.stdout, /Equipo de prueba/);
    assert.match(result.stdout, /data-operation-metric="mrr">59,00&nbsp;€/);
    assert.match(result.stdout, /data-operation-metric="support-unread">1</);
    assert.match(result.stdout, /data-operation-tab="messages">Mensajería/);
    assert.doesNotMatch(result.stdout, /Cargando operaciones\.\.\.<\/strong>/);
    assert.doesNotMatch(result.stdout, /No se pudo cargar la gestión empresarial/);
  }

  await writeFile(fixturePath, `<!doctype html><meta charset="utf-8"><script>localStorage.setItem("locallift_client_session", ${JSON.stringify(JSON.stringify(login.session))});location.replace("/pages/client-portal.html?apiBase=same-origin")<\/script>`, "utf8");
  const portalResult = await run(chrome, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
    `--user-data-dir=${profile}-portal`, "--window-size=390,844", "--virtual-time-budget=7000", "--dump-dom", `${baseUrl}/${fixtureName}`
  ]);
  assert.equal(portalResult.exitCode, 0, portalResult.stderr);
  assert.match(portalResult.stdout, /Proyecto de Brasa Norte/);
  assert.match(portalResult.stdout, /Proyecto visible en navegador/);
  assert.match(portalResult.stdout, /Factura visible en portal/);
  assert.match(portalResult.stdout, new RegExp(invoice.invoice.number));
  assert.match(portalResult.stdout, /Documento visible en portal/);
  assert.match(portalResult.stdout, /Atención DLS/);
  assert.match(portalResult.stdout, /Equipo privado/);
  assert.match(portalResult.stdout, /Mensaje de soporte visible/);
  assert.match(portalResult.stdout, /Canal navegador/);
  assert.match(portalResult.stdout, /Mensaje interno visible/);
  assert.match(portalResult.stdout, /class="client-auth-state" data-client-auth-state="" hidden=""/);

  console.log("Operations browser checks passed: admin and private client portal render real API data at responsive widths.");
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(2000)]);
  }
  await rm(tempDir, { recursive: true, force: true });
  await rm(profile, { recursive: true, force: true }).catch(() => {});
  await rm(`${profile}-1440x1000`, { recursive: true, force: true }).catch(() => {});
  await rm(`${profile}-390x844`, { recursive: true, force: true }).catch(() => {});
  await rm(`${profile}-portal`, { recursive: true, force: true }).catch(() => {});
  await rm(fixturePath, { force: true }).catch(() => {});
}

async function jsonRequest(pathname, options = {}) {
  const headers = { ...options.headers };
  const init = { method: options.method || "GET", headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const text = await response.text();
  if (!response.ok) throw new Error(`${init.method} ${pathname} returned ${response.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function waitForHealth() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`);
    try { return await jsonRequest("/api/health"); } catch { await delay(150); }
  }
  throw new Error(`Healthcheck did not pass.\n${logs}`);
}

async function findChrome() {
  const candidates = process.platform === "win32"
    ? [
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
        path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")
      ]
    : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"];
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch {}
  }
  throw new Error("Chrome or Chromium is required for the operations browser test");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
  });
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const listener = createServer();
    listener.unref();
    listener.on("error", reject);
    listener.listen(0, "127.0.0.1", () => {
      const address = listener.address();
      listener.close(() => resolve(address.port));
    });
  });
}

function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

function dateOffset(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
