import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { access, copyFile, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const tempDir = await mkdtemp(path.join(root, ".tmp-task-browser-"));
const profileRoot = await mkdtemp(path.join(os.tmpdir(), "dls-task-browser-"));
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
      PORT: String(port), HOST: "127.0.0.1", NODE_ENV: "test",
      LOCALLIFT_ADMIN_TOKEN: "", ADMIN_API_TOKEN: "",
      CLIENT_SESSION_SECRET: "task-browser-session-secret-32-characters",
      BUSINESS_STORE: "json", BUSINESS_DB_DRIVER: "json", DATABASE_URL: "", POSTGRES_URL: "", LOCALLIFT_DATABASE_URL: "",
      BUSINESS_DB_FILE: dbPath, BUSINESS_DB_BACKUP_DIR: path.join(tempDir, "backups"), BUSINESS_DB_BACKUPS: "false"
    },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true
  });
  server.stdout.on("data", appendLog);
  server.stderr.on("data", appendLog);
  await waitForHealth();

  await jsonRequest(`/api/businesses/${businessId}/portal-access`, { method: "POST", body: { password: "TaskBrowser2026!" } });
  const login = await jsonRequest("/api/client/login", { method: "POST", body: { business: businessId, password: "TaskBrowser2026!" } });
  const clientHeaders = { "X-LocalLift-Client-Token": login.session.token };
  const member = await jsonRequest(`/api/businesses/${businessId}/communications/members`, {
    method: "POST", headers: clientHeaders, body: { name: "Nora Responsable", role: "manager" }
  });
  const contact = await jsonRequest(`/api/businesses/${businessId}/contacts`, {
    method: "POST", body: { name: "Cliente Agenda Maestra", email: "agenda@example.com" }
  });
  await jsonRequest(`/api/businesses/${businessId}/deals`, {
    method: "POST", body: { contactId: contact.contact.id, title: "Oportunidad sin dueño", value: 2750 }
  });
  await jsonRequest(`/api/businesses/${businessId}/tasks`, {
    method: "POST",
    body: {
      title: "Confirmar propuesta magistral", type: "call", priority: "high", ownerId: member.member.id,
      dueAt: todayAt(17), reminderAt: todayAt(16), recurrence: "weekly",
      links: [{ type: "contact", id: contact.contact.id, kind: "related", isPrimary: true }]
    }
  });
  await jsonRequest(`/api/businesses/${businessId}/tasks`, {
    method: "POST",
    body: { title: "Seguimiento vencido visible", type: "follow_up", priority: "urgent", dueAt: yesterdayAt(9) }
  });

  for (const size of ["1440,1000", "390,844"]) {
    const profile = `${profileRoot}-${size.replace(",", "x")}`;
    const result = await run(chrome, [
      "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
      `--user-data-dir=${profile}`, `--window-size=${size}`, "--virtual-time-budget=9000", "--dump-dom",
      `${baseUrl}/pages/business-dashboard.html?business=${businessId}&tab=today&apiBase=same-origin`
    ]);
    assert.equal(result.exitCode, 0, `Chrome failed at ${size}: ${result.stderr}`);
    assert.match(result.stdout, /class="task-workspace"/);
    assert.match(result.stdout, /data-task-create-form/);
    assert.match(result.stdout, /Confirmar propuesta magistral/);
    assert.match(result.stdout, /Seguimiento vencido visible/);
    assert.match(result.stdout, /Nora Responsable/);
    assert.match(result.stdout, /Oportunidades sin responsable/);
    assert.match(result.stdout, /Oportunidad sin dueño/);
    assert.match(result.stdout, /data-task-queue="today"/);
    assert.match(result.stdout, /data-task-queue="overdue"/);
    assert.match(result.stdout, /data-task-queue="unassigned"/);
    assert.match(result.stdout, /data-task-queue="mine"/);
    assert.match(result.stdout, /data-task-queue="team"/);
    assert.match(result.stdout, /data-deal-owner/);
    assert.doesNotMatch(result.stdout, /Tareas no disponibles/);
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
  console.log("Task browser checks passed: responsive creation, five queues, owners, overdue work and unowned deals.");
} finally {
  if (server && server.exitCode === null) { server.kill(); await Promise.race([new Promise((resolve) => server.once("exit", resolve)), delay(2000)]); }
  await rm(tempDir, { recursive: true, force: true });
  await rm(profileRoot, { recursive: true, force: true }).catch(() => {});
}

function todayAt(hour) { const date = new Date(); date.setHours(hour, 0, 0, 0); return date.toISOString(); }
function yesterdayAt(hour) { const date = new Date(); date.setDate(date.getDate() - 1); date.setHours(hour, 0, 0, 0); return date.toISOString(); }
async function jsonRequest(pathname, options = {}) { const headers = { ...options.headers }; const init = { method: options.method || "GET", headers }; if (options.body !== undefined) { headers["Content-Type"] = "application/json"; init.body = JSON.stringify(options.body); } const response = await fetch(`${baseUrl}${pathname}`, init); const text = await response.text(); if (!response.ok) throw new Error(`${init.method} ${pathname} returned ${response.status}: ${text}`); return text ? JSON.parse(text) : {}; }
async function waitForHealth() { const deadline = Date.now() + 15000; while (Date.now() < deadline) { if (server.exitCode !== null) throw new Error(`Server exited before healthcheck passed.\n${logs}`); try { return await jsonRequest("/api/health"); } catch { await delay(150); } } throw new Error(`Healthcheck did not pass.\n${logs}`); }
async function findChrome() { const candidates = process.platform === "win32" ? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe", path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe")] : ["/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser"]; for (const candidate of candidates) { try { await access(candidate); return candidate; } catch {} } throw new Error("Chrome or Chromium is required for the task browser test"); }
function run(command, args) { return new Promise((resolve, reject) => { const processChild = spawn(command, args, { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }); let stdout = ""; let stderr = ""; processChild.stdout.on("data", (chunk) => { stdout += String(chunk); }); processChild.stderr.on("data", (chunk) => { stderr += String(chunk); }); processChild.on("error", reject); processChild.on("close", (exitCode) => resolve({ exitCode, stdout, stderr })); }); }
function getFreePort() { return new Promise((resolve, reject) => { const listener = createServer(); listener.unref(); listener.on("error", reject); listener.listen(0, "127.0.0.1", () => { const address = listener.address(); listener.close(() => resolve(address.port)); }); }); }
function appendLog(chunk) { logs += String(chunk); }
function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
