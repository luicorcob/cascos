import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, copyFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-deal-browser-"));
const profileRoot = await mkdtemp(path.join(os.tmpdir(), "dls-deal-browser-"));
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
    body: { name: "Laura Multiopportunity", email: "laura@example.com", phone: "+34954000000", valueEstimate: 1800 }
  });
  await jsonRequest("/api/businesses/biz_demo_brasa_norte/deals", {
    method: "POST",
    body: { contactId: contact.contact.id, title: "Web corporativa visible", value: 1250, priority: "alta" }
  });
  await jsonRequest("/api/businesses/biz_demo_brasa_norte/deals", {
    method: "POST",
    body: { contactId: contact.contact.id, title: "Campana local visible", value: 550, priority: "media" }
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
    assert.match(result.stdout, /data-deal-workspace/);
    assert.match(result.stdout, /data-deal-create-form/);
    assert.match(result.stdout, /Web corporativa visible/);
    assert.match(result.stdout, /Campana local visible/);
    assert.match(result.stdout, /Laura Multiopportunity/);
    assert.match(result.stdout, /Contactos y seguimiento heredado/);
    assert.equal((result.stdout.match(/data-deal-card/g) || []).length, 2);
    assert.doesNotMatch(result.stdout, /No pudimos consultar las oportunidades/);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }

  console.log("Deal browser checks passed: opportunity workspace and legacy CRM render at desktop and mobile widths.");
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
  throw new Error("Chrome or Chromium is required for the deal browser test");
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

function appendLog(chunk) {
  logs += String(chunk);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
