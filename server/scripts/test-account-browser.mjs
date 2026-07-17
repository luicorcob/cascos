import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, copyFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-account-browser-"));
const profileRoot = await mkdtemp(path.join(os.tmpdir(), "dls-account-browser-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
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

  const contact = await jsonRequest("/api/businesses/biz_demo_brasa_norte/contacts", {
    method: "POST",
    body: { name: "Marta Relacional", email: "marta-relacional@example.com" }
  });
  const account = await jsonRequest("/api/businesses/biz_demo_brasa_norte/accounts", {
    method: "POST",
    body: { name: "Grupo Horizonte", type: "company", domain: "horizonte.example", taxId: "B87654321", city: "Sevilla" }
  });
  await jsonRequest("/api/businesses/biz_demo_brasa_norte/accounts", {
    method: "POST",
    body: { name: "Grupo Horizonte SL", type: "company", domain: "www.horizonte.example", taxId: "B87654321" }
  });
  await jsonRequest("/api/businesses/biz_demo_brasa_norte/associations", {
    method: "POST",
    body: {
      fromType: "contact",
      fromId: contact.contact.id,
      toType: "account",
      toId: account.account.id,
      kind: "decision_maker",
      isPrimary: true
    }
  });
  await jsonRequest("/api/businesses/biz_demo_brasa_norte/deals", {
    method: "POST",
    body: {
      contactId: contact.contact.id,
      accountId: account.account.id,
      title: "Evento Horizonte",
      value: 3200,
      priority: "alta"
    }
  });

  for (const size of ["1440,1000", "390,844"]) {
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
      "--virtual-time-budget=9000",
      "--dump-dom",
      `${baseUrl}/pages/business-dashboard.html?business=biz_demo_brasa_norte&tab=leads&apiBase=same-origin`
    ]);
    assert.equal(result.exitCode, 0, `Chrome failed at ${size}: ${result.stderr}`);
    assert.match(result.stdout, /class="account-workspace"/);
    assert.match(result.stdout, /data-account-create-form/);
    assert.match(result.stdout, /Grupo Horizonte/);
    assert.match(result.stdout, /Marta Relacional/);
    assert.match(result.stdout, /Decisor/);
    assert.match(result.stdout, /Posibles cuentas duplicadas/);
    assert.match(result.stdout, /Evento Horizonte/);
    assert.match(result.stdout, /Cuenta: Grupo Horizonte/);
    assert.doesNotMatch(result.stdout, /Cuentas no disponibles/);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }

  console.log("Account browser checks passed: accounts, relations, duplicate warning and linked deals render responsively.");
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(2000)]);
  }
  await rm(tempDir, { recursive: true, force: true });
  await rm(profileRoot, { recursive: true, force: true }).catch(() => {});
}

async function jsonRequest(pathname, options = {}) {
  const headers = {};
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
  throw new Error("Chrome or Chromium is required for the account browser test");
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
