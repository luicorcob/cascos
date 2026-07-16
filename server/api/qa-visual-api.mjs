import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { corsHeaders } from "../lib/cors.mjs";

const MAX_BODY_BYTES = Number(process.env.QA_VISUAL_API_MAX_BODY_BYTES || 16 * 1024 * 1024);
const DEFAULT_TIMEOUT_MS = 150_000;
const DEFAULT_KEEP_HOURS = 24;
const SAFE_RUN_ID = /^[a-z0-9][a-z0-9_-]{8,160}$/;

export function isQaVisualApiRequest(pathname) {
  return pathname === "/api/qa-visual";
}

export async function handleQaVisualApi(request, response, context) {
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  if (method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "POST, OPTIONS" });
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const html = String(payload.html || "");

    if (!isAuditableHtml(html)) {
      throw httpError(400, "A complete HTML document is required for visual QA");
    }

    const business = normalizeBusinessMeta(payload.business || {});
    const runId = createRunId(business.slug || business.name || "qa");
    const publicRunBase = `/.tmp-qa-visual/studio-runs/${runId}`;
    const runRoot = path.join(getRunsRoot(context.root), runId);
    const pageDir = path.join(runRoot, "page");
    const outDir = path.join(runRoot, "report");
    const pagePath = path.join(pageDir, "index.html");
    const targetUrl = new URL(`${publicRunBase}/page/index.html`, getRequestOrigin(request)).toString();

    await mkdir(pageDir, { recursive: true });
    await mkdir(outDir, { recursive: true });
    await writeFile(pagePath, html, "utf8");

    const scriptResult = await runQaScript({
      root: context.root,
      targetUrl,
      outDir,
      viewports: normalizeViewports(payload.viewports)
    });

    const reportPath = path.join(outDir, "qa-visual-report.json");
    const reportSource = await readFile(reportPath, "utf8").catch(() => "");

    if (!reportSource) {
      throw httpError(500, cleanText(scriptResult.stderr || scriptResult.stdout || "Visual QA did not produce a report", 1000));
    }

    const report = JSON.parse(reportSource);
    const reportUrl = `${publicRunBase}/report/qa-visual-report.html`;
    const normalizedReport = attachPublicArtifactUrls(report, `${publicRunBase}/report`);

    cleanupOldRuns(context.root).catch(() => {});

    sendJson(response, 200, {
      ok: normalizedReport.totals.blockers === 0,
      runId,
      targetUrl,
      reportUrl,
      outputBaseUrl: `${publicRunBase}/report`,
      exitCode: scriptResult.exitCode,
      signal: scriptResult.signal,
      stdout: scriptResult.stdout,
      stderr: scriptResult.stderr,
      report: normalizedReport
    }, context);
  } catch (error) {
    const status = error.statusCode || 500;
    const message = error.statusCode ? error.message : "Internal visual QA API error";
    sendJson(response, status, {
      error: message,
      detail: status >= 500 ? cleanText(error.message, 1000) : undefined
    }, context);
  }
}

async function runQaScript({ root, targetUrl, outDir, viewports }) {
  const args = [
    path.join(root, "server", "scripts", "qa-visual-accessibility.mjs"),
    "--url",
    targetUrl,
    "--out",
    outDir
  ];

  if (viewports) {
    args.push("--viewports", viewports);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(httpError(504, "Visual QA timed out. Try again or run npm.cmd run qa:visual manually."));
    }, readPositiveInteger("QA_VISUAL_API_TIMEOUT_MS", DEFAULT_TIMEOUT_MS));

    child.stdout?.on("data", (chunk) => {
      stdout = appendBounded(stdout, chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr = appendBounded(stderr, chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer);
      resolve({ exitCode, signal, stdout, stderr });
    });
  });
}

function attachPublicArtifactUrls(report, publicBase) {
  return {
    ...report,
    viewports: (report.viewports || []).map((run) => ({
      ...run,
      screenshot: {
        ...(run.screenshot || {}),
        url: run.screenshot?.filename ? `${publicBase}/${encodeURIComponent(run.screenshot.filename)}` : ""
      }
    }))
  };
}

async function readJsonBody(request) {
  let size = 0;
  let raw = "";

  for await (const chunk of request) {
    size += chunk.length;

    if (size > MAX_BODY_BYTES) {
      throw httpError(413, "Visual QA payload is too large");
    }

    raw += chunk;
  }

  if (!raw.trim()) {
    throw httpError(400, "JSON body is required");
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw httpError(400, "Invalid JSON body");
  }
}

function normalizeViewports(value) {
  const allowed = new Set(["desktop", "tablet", "mobile"]);
  const viewports = Array.isArray(value)
    ? value
    : String(value || "").split(",");
  const selected = viewports
    .map((item) => String(item || "").trim().toLowerCase())
    .filter((item) => allowed.has(item));

  return selected.length && selected.length < allowed.size ? selected.join(",") : "";
}

function isAuditableHtml(html) {
  const normalized = html.trim().toLowerCase();
  return html.length >= 80 && normalized.includes("<!doctype html") && normalized.includes("<html");
}

function normalizeBusinessMeta(source) {
  return {
    name: cleanText(source.name || "Web generada", 180),
    slug: slugify(source.slug || source.name || "web-generada"),
    category: cleanText(source.category || "", 120),
    location: cleanText(source.location || source.city || "", 180)
  };
}

function getRunsRoot(root) {
  return path.join(root, ".tmp-qa-visual", "studio-runs");
}

function getRequestOrigin(request) {
  const protocol = firstHeader(request.headers["x-forwarded-proto"])
    || (request.socket?.encrypted ? "https" : "http");
  const host = firstHeader(request.headers["x-forwarded-host"])
    || firstHeader(request.headers.host)
    || `127.0.0.1:${process.env.PORT || 5173}`;

  try {
    return new URL(`${protocol}://${host}`).origin;
  } catch (error) {
    return `http://127.0.0.1:${process.env.PORT || 5173}`;
  }
}

async function cleanupOldRuns(root) {
  const runsRoot = getRunsRoot(root);
  const keepMs = readPositiveInteger("QA_VISUAL_KEEP_HOURS", DEFAULT_KEEP_HOURS) * 60 * 60 * 1000;
  const cutoff = Date.now() - keepMs;
  let entries = [];

  try {
    entries = await readdir(runsRoot, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  await Promise.all(entries
    .filter((entry) => entry.isDirectory() && SAFE_RUN_ID.test(entry.name))
    .map(async (entry) => {
      const runPath = path.join(runsRoot, entry.name);
      const info = await stat(runPath).catch(() => null);
      if (info && info.mtimeMs < cutoff) {
        await rm(runPath, { recursive: true, force: true });
      }
    }));
}

function createRunId(value) {
  const base = slugify(value) || "qa";
  return `${base.slice(0, 70)}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

function appendBounded(current, chunk) {
  const next = `${current}${String(chunk)}`;
  return next.length > 12_000 ? next.slice(-12_000) : next;
}

function firstHeader(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return cleanText(String(raw || "").split(",")[0] || "", 300);
}

function readPositiveInteger(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function cleanText(value, maxLength = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function sendJson(response, status, payload, context, extraHeaders = {}) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendEmpty(response, status, context) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    Allow: "POST, OPTIONS"
  });
  response.end();
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
