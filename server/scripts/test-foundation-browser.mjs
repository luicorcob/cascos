import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, copyFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-foundation-browser-"));
const profileRoot = await mkdtemp(path.join(os.tmpdir(), "dls-foundation-browser-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const chrome = await findChrome();
let server;
let logs = "";

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
      BUSINESS_USER_SESSION_SECRET: "foundation-browser-session-secret-32",
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

  await jsonRequest(`/api/businesses/${businessId}/security/users`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Olivia Owner",
      email: "owner-browser@example.com",
      role: "owner",
      password: "OwnerBrowser2026!"
    }
  });
  await jsonRequest(`/api/businesses/${businessId}/security/users`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      name: "Oscar Operaciones",
      email: "operations-browser@example.com",
      role: "operations",
      password: "OperationsBrowser2026!"
    }
  });
  await jsonRequest(`/api/businesses/${businessId}/crm-config/fields`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      entityType: "contact",
      label: "Idioma preferido",
      type: "select",
      options: ["Espanol", "English"]
    }
  });
  await jsonRequest(`/api/businesses/${businessId}/crm-config/views`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      entityType: "deal",
      name: "Eventos de alto valor",
      filters: {
        combinator: "and",
        conditions: [{ field: "value", operator: "gte", value: 2000 }]
      },
      columns: ["title", "value", "stageId"],
      bulkActions: ["assign", "stage", "export"]
    }
  });
  const pipelinePayload = await jsonRequest(`/api/businesses/${businessId}/pipelines`);
  const pipeline = pipelinePayload.pipelines[0];
  await jsonRequest(`/api/businesses/${businessId}/crm-config/pipeline-rules`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      pipelineId: pipeline.id,
      stageId: pipeline.stages[0].id,
      probability: 20,
      exitRequirements: [{ field: "nextActionAt", operator: "not_empty" }],
      automaticTasks: [{ title: "Cualificar evento", dueInHours: 4 }]
    }
  });
  await jsonRequest(`/api/businesses/${businessId}/hospitality/invoices`, {
    method: "POST",
    expectedStatus: 201,
    body: {
      customerName: "Cliente historico visible",
      concept: "Evento privado",
      issueDate: "2026-07-18",
      dueDate: "2026-08-18",
      subtotal: 500,
      taxRate: 10,
      status: "sent"
    }
  });
  await jsonRequest(`/api/businesses/${businessId}/money/reconcile`, { method: "POST", body: {} });

  for (const size of ["1440,1200", "390,844"]) {
    const profile = `${profileRoot}-${size.replace(",", "x")}`;
    const result = await run(chrome, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profile}`,
      `--window-size=${size}`,
      "--virtual-time-budget=22000",
      "--dump-dom",
      `${baseUrl}/pages/business-dashboard.html?business=${businessId}&tab=settings&apiBase=same-origin`
    ]);
    assert.equal(result.exitCode, 0, `Chrome failed at ${size}: ${result.stderr}`);
    assert.match(result.stdout, /data-foundation-center/);
    assert.match(result.stdout, /Seguridad, CRM y dinero/);
    assert.match(result.stdout, /data-security-center/);
    assert.match(result.stdout, /Olivia Owner/);
    assert.match(result.stdout, /Oscar Operaciones/);
    assert.match(result.stdout, /data-security-user-form/);
    assert.match(result.stdout, /data-money-center/);
    assert.match(result.stdout, /Cliente historico visible/);
    assert.match(result.stdout, /Nombre heredado preservado/);
    assert.match(result.stdout, /data-money-payment-form/);
    assert.match(result.stdout, /data-crm-config-center/);
    assert.match(result.stdout, /Idioma preferido/);
    assert.match(result.stdout, /Eventos de alto valor/);
    assert.match(result.stdout, /Cualificar evento|tareas automáticas/);
    assert.match(result.stdout, /data-crm-field-form/);
    assert.match(result.stdout, /data-crm-view-form/);
    assert.match(result.stdout, /data-crm-pipeline-rule-form/);
    assert.doesNotMatch(result.stdout, /No se pudo cargar/);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  console.log("Foundation browser checks passed: responsive security, audit, normalized money, payment controls, typed fields, compound views and pipeline rules.");
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(2000)]);
  }
  await rm(tempDir, { recursive: true, force: true });
  await rm(profileRoot, { recursive: true, force: true }).catch(() => {});
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
  const expectedStatus = options.expectedStatus || 200;
  if (response.status !== expectedStatus) {
    throw new Error(`${init.method} ${pathname} returned ${response.status}, expected ${expectedStatus}: ${text}\n${logs}`);
  }
  return text ? JSON.parse(text) : {};
}

async function waitForHealth() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`);
    try {
      return await jsonRequest("/api/health");
    } catch {
      await delay(150);
    }
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
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("Chrome or Chromium is required for the foundation browser test");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const processChild = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    processChild.stdout.on("data", (chunk) => { stdout += String(chunk); });
    processChild.stderr.on("data", (chunk) => { stderr += String(chunk); });
    processChild.on("error", reject);
    processChild.on("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
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
