import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedCustomer360Fixture } from "./customer-360-fixture.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-customer-360-browser-"));
const profileRoot = await mkdtemp(path.join(os.tmpdir(), "dls-customer-360-browser-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const businessId = "biz_demo_brasa_norte";
const chrome = await findChrome();
let server;
let logs = "";

try {
  await copyFile(path.join(root, "data", "business-db.example.json"), dbPath);
  const db = JSON.parse(await readFile(dbPath, "utf8"));
  seedCustomer360Fixture(db, { businessId, now: new Date().toISOString() });
  await writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
  server = spawn(process.execPath, ["server/server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: "", ADMIN_API_TOKEN: "",
      BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  server.stdout.on("data", appendLog);
  server.stderr.on("data", appendLog);
  await waitForHealth();

  for (const size of ["1440,1100", "390,844"]) {
    const profile = `${profileRoot}-${size.replace(",", "x")}`;
    const result = await run(chrome, [
      "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${profile}`, `--window-size=${size}`, "--virtual-time-budget=11000", "--dump-dom",
      `${baseUrl}/pages/business-dashboard.html?business=${businessId}&tab=customers&apiBase=same-origin`
    ]);
    assert.equal(result.exitCode, 0, `Chrome failed at ${size}: ${result.stderr}`);
    assert.match(result.stdout, /data-customer-360-workspace/);
    assert.match(result.stdout, /Guestbook inteligente/);
    assert.match(result.stdout, /Cliente 360 accionable/);
    assert.match(result.stdout, /Clara VIP 360/);
    assert.match(result.stdout, /Ramon Riesgo 360/);
    assert.match(result.stdout, /Familia Clara 360/);
    assert.match(result.stdout, /segment-vip/);
    assert.match(result.stdout, />RFM</);
    assert.match(result.stdout, /Siguiente mejor accion/);
    assert.match(result.stdout, /Timeline unificado/);
    assert.match(result.stdout, /Saldo pendiente/);
    assert.match(result.stdout, /data-customer-360-filter-form/);
    assert.doesNotMatch(result.stdout, /Vista 360 temporalmente no disponible/);
    assert.doesNotMatch(result.stdout, /No se pudo calcular Cliente 360/);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  console.log("Customer 360 browser checks passed: responsive workspace, KPIs, RFM, segments, risk, action and unified timeline.");
} finally {
  if (server && server.exitCode === null) { server.kill(); await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(2000)]); }
  await rm(tempDir, { recursive: true, force: true });
  await rm(profileRoot, { recursive: true, force: true }).catch(() => {});
}

async function jsonRequest(pathname) { const response = await fetch(`${baseUrl}${pathname}`); const text = await response.text(); if (!response.ok) throw new Error(`GET ${pathname} returned ${response.status}: ${text}`); return text ? JSON.parse(text) : {}; }
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (server.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
async function findChrome() { const candidates = process.platform === "win32" ? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")] : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]; for (const candidate of candidates) { try { await access(candidate); return candidate; } catch {} } throw new Error("Chrome or Chromium is required for the customer 360 browser test"); }
function run(command, args) { return new Promise((resolve, reject) => { const processChild = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; processChild.stdout.on("data", (chunk) => { stdout += String(chunk); }); processChild.stderr.on("data", (chunk) => { stderr += String(chunk); }); processChild.on("error", reject); processChild.on("close", (exitCode) => resolve({ exitCode, stdout, stderr })); }); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
