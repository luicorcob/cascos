import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, copyFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-client-portal-browser-"));
const profileDir = await mkdtemp(path.join(os.tmpdir(), "dls-client-portal-browser-"));
const dbPath = path.join(tempDir, "business-db.json");
const businessId = "biz_demo_brasa_norte";
const port = await getFreePort();
const baseUrl = `http://127.0.0.1:${port}`;
const chrome = await findChrome();
let server;
let logs = "";

try {
  await copyFile(path.join(root, "data", "business-db.json"), dbPath);
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

  const result = await run(chrome, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${profileDir}`,
    "--window-size=1440,1100",
    "--virtual-time-budget=9000",
    "--dump-dom",
    `${baseUrl}/pages/client-dashboard.html?business=${businessId}&tab=project&projectSection=support&preview=developer&apiBase=same-origin`
  ]);

  assert.equal(result.exitCode, 0, `Chrome failed: ${result.stderr}`);
  assert.match(result.stdout, /Brasa Norte/);
  assert.match(result.stdout, /Perfecto, os lo mando hoy/);
  assert.match(result.stdout, /Diego Torres/);
  assert.match(result.stdout, /Servicio de hoy/);
  assert.match(result.stdout, /Compras y almacén/);
  assert.match(result.stdout, /Bonito del norte/);
  assert.match(result.stdout, /David Cano/);
  assert.match(result.stdout, /BN-1028/);
  assert.doesNotMatch(result.stdout, /El portal funciona, pero la mensajer/);

  const escapedBusinessId = businessId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const communicationReads = logs.match(new RegExp(`"method":"GET","path":"/api/businesses/${escapedBusinessId}/communications/threads"`, "g")) || [];
  assert.equal(communicationReads.length, 1, `Support view caused ${communicationReads.length} thread reads instead of one.\n${logs}`);

  console.log("Client portal browser checks passed: Atención DLS loads once and populated operations render in the private dashboard.");
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(2000)]);
  }
  await rm(tempDir, { recursive: true, force: true });
  await rm(profileDir, { recursive: true, force: true });
}

async function waitForHealth() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`);
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {}
    await delay(150);
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
  throw new Error("Chrome or Chromium is required for the client portal browser test");
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
