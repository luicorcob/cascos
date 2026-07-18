import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-hospitality-dashboard-"));
const profileRoot = await mkdtemp(path.join(os.tmpdir(), "dls-hospitality-dashboard-"));
const dbPath = path.join(tempDir, "business-db.json");
const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const chrome = await findChrome();
const fixtures = [];
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
      CLIENT_SESSION_SECRET: "hospitality-dashboard-browser-secret-32-characters",
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

  await jsonRequest("/api/businesses/biz_demo_brasa_norte/portal-access", {
    method: "POST",
    body: { password: "HospitalityBrowser2026!" }
  });
  const login = await jsonRequest("/api/client/login", {
    method: "POST",
    body: { business: "biz_demo_brasa_norte", password: "HospitalityBrowser2026!" }
  });

  const cases = [
    {
      tab: "bookings",
      title: "Reservas",
      contentPattern: /data-booking-form=""/,
      contentLabel: /Disponibilidad semanal/
    },
    {
      tab: "today",
      title: "Tareas de hoy",
      contentPattern: /data-task-workspace=""/,
      contentLabel: /Tareas y responsables/
    }
  ];

  for (const [index, testCase] of cases.entries()) {
    const fixtureName = `.tmp-hospitality-dashboard-${testCase.tab}-${Date.now().toString(36)}.html`;
    const fixturePath = path.join(root, fixtureName);
    fixtures.push(fixturePath);
    await writeFile(
      fixturePath,
      `<!doctype html><meta charset="utf-8"><script>localStorage.setItem("locallift_client_session", ${JSON.stringify(JSON.stringify(login.session))});location.replace("/pages/business-dashboard.html?apiBase=same-origin&tab=${testCase.tab}")<\/script>`,
      "utf8"
    );

    const result = await run(chrome, [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${profileRoot}-${index}`,
      "--window-size=1440,1000",
      "--virtual-time-budget=7000",
      "--dump-dom",
      `${baseUrl}/${fixtureName}`
    ]);

    assert.equal(result.exitCode, 0, `Chrome failed for ${testCase.tab}: ${result.stderr}`);
    assert.match(result.stdout, new RegExp(`data-page-title="">${testCase.title}<`));
    assert.match(result.stdout, new RegExp(`class="tab-panel is-active" data-panel="${testCase.tab}"`));
    assert.match(result.stdout, testCase.contentPattern, `${testCase.title} must render its own controls`);
    assert.match(result.stdout, testCase.contentLabel, `${testCase.title} must render its own content`);
    assert.match(result.stdout, /class="tab-panel" data-panel="home" hidden=""/);
  }

  console.log("Hospitality dashboard browser checks passed: section-specific content is visible and summary metrics stay inside Resumen.");
} finally {
  if (server && server.exitCode === null) {
    server.kill();
    await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(2000)]);
  }
  await rm(tempDir, { recursive: true, force: true });
  await rm(profileRoot, { recursive: true, force: true }).catch(() => {});
  await Promise.all(fixtures.map((fixture) => rm(fixture, { force: true }).catch(() => {})));
  for (let index = 0; index < 2; index += 1) {
    await rm(`${profileRoot}-${index}`, { recursive: true, force: true }).catch(() => {});
  }
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
  throw new Error("Chrome or Chromium is required for the hospitality dashboard browser test");
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

function freePort() {
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
