import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const deliverablesDir = path.resolve(evidenceDir, "..");
const root = path.resolve(deliverablesDir, "..");
const outDir = path.join(deliverablesDir, "capturas", "originales");
const fixturePath = path.join(evidenceDir, "fixture-capturas.json");
const runtimeDir = await mkdtemp(path.join(os.tmpdir(), "dls-tfg-runtime-"));
const profileDir = await mkdtemp(path.join(os.tmpdir(), "dls-tfg-chrome-"));
const port = 5173;
const debugPort = 9637;
const baseUrl = `http://127.0.0.1:${port}`;
const chrome = await findChrome();

await mkdir(outDir, { recursive: true });

const server = spawn(process.execPath, [path.join(root, "server", "server.mjs")], {
  cwd: runtimeDir,
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    NODE_ENV: "development",
    BUSINESS_STORE: "json",
    BUSINESS_DB_DRIVER: "json",
    DATABASE_URL: "",
    POSTGRES_URL: "",
    LOCALLIFT_DATABASE_URL: "",
    BUSINESS_DB_FILE: fixturePath,
    BUSINESS_DB_BACKUPS: "false",
    GOOGLE_AUTH_DB_FILE: path.join(runtimeDir, "google-auth-db.json"),
    RADAR_LEADS_DB_FILE: path.join(runtimeDir, "radar-leads.json"),
    DEMO_PUBLISH_DIR: path.join(runtimeDir, "demos"),
    LOCALLIFT_ADMIN_TOKEN: "",
    ADMIN_API_TOKEN: "",
    CLIENT_SESSION_SECRET: "fixture-session-secret-that-is-not-used-outside-tests",
    CORS_ORIGIN: baseUrl,
    ACCESS_LOGS: "false"
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true
});

let serverLog = "";
server.stdout.on("data", (chunk) => { serverLog = appendBounded(serverLog, chunk); });
server.stderr.on("data", (chunk) => { serverLog = appendBounded(serverLog, chunk); });

let browser;
let cdp;
const results = [];

try {
  await waitForUrl(`${baseUrl}/api/health`, 20_000);
  browser = spawn(chrome, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-gpu-compositing",
    "--disable-accelerated-2d-canvas",
    "--disable-accelerated-video-decode",
    "--disable-features=UseSkiaRenderer,Vulkan,DefaultANGLEVulkan,DawnGraphite,CanvasOopRasterization,VizDisplayCompositor",
    "--disable-gpu-watchdog",
    "--in-process-gpu",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDir}`,
    `${baseUrl}/pages/privacy-demo.html`
  ], { stdio: "ignore", windowsHide: true });

  const page = await waitForPage(debugPort, 20_000);
  cdp = await createCdpClient(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  await capture({
    file: "01-intro-studio.png",
    route: "/index.html?intro=1",
    width: 1440,
    height: 1000,
    wait: "document.readyState === 'complete' && document.querySelector('#introGate')"
  });

  await evaluate("document.querySelector('#introStartButton')?.click(); true");
  await waitForExpression("document.querySelector('#introGate')?.classList.contains('is-choosing') && document.querySelector('#introHub')?.hidden === false", 10_000);
  await settle();
  await saveScreenshot("02-selector-destino.png", 1440, 1000);

  await capture({
    file: "03-studio-editor.png",
    route: "/index.html?skipIntro=1",
    width: 1440,
    height: 1000,
    wait: "document.documentElement.dataset.studioReady === 'true'"
  });

  await evaluate("document.querySelector('.viewport-button[data-size=\"mobile\"]')?.click(); true");
  await settle();
  await saveScreenshot("04-studio-preview-movil.png", 1440, 1000);

  await capture({
    file: "05-radar-modo-demostracion.png",
    route: "/pages/business-radar.html?provider=demo",
    width: 1440,
    height: 1000,
    wait: "document.readyState === 'complete' && document.querySelector('#demoButton')",
    action: "document.querySelector('#demoButton')?.click(); true",
    actionWait: "document.querySelectorAll('.business-card, [data-business-id]').length > 0"
  });

  await capture({
    file: "06-proyectos.png",
    route: `/pages/projects.html?apiBase=${encodeURIComponent(baseUrl)}`,
    width: 1440,
    height: 1000,
    wait: "document.readyState === 'complete' && document.querySelector('.project-card')"
  });

  await captureDashboard("07-portal-bandeja.png", "inbox");
  await captureDashboard("08-portal-pipeline-leads.png", "leads");
  await captureDashboard("09-portal-propuestas.png", "proposals");
  await captureDashboard("10-portal-reservas.png", "bookings");
  await captureDashboard("11-portal-reportes.png", "reports");
  await captureDashboard("12-portal-google-no-configurado.png", "google");

  await capture({
    file: "13-web-cliente.png",
    route: "/pages/client-site.html?business=biz_tfg_demo",
    width: 1440,
    height: 1000,
    wait: "document.readyState === 'complete' && document.querySelector('.generated-site')"
  });

  await capture({
    file: "14-reporte-mensual.png",
    route: "/pages/monthly-report.html?business=biz_tfg_demo&month=2026-07",
    width: 1440,
    height: 1000,
    wait: "document.readyState === 'complete' && document.querySelectorAll('.metric-card, [data-metric]').length > 0"
  });

  await capture({
    file: "15-brief-onboarding.png",
    route: "/pages/onboarding.html",
    width: 1440,
    height: 1000,
    wait: "document.readyState === 'complete' && document.querySelector('form')"
  });

  await capture({
    file: "16-web-cliente-movil.png",
    route: "/pages/client-site.html?business=biz_tfg_demo",
    width: 390,
    height: 844,
    mobile: true,
    wait: "document.readyState === 'complete' && document.querySelector('.generated-site')"
  });

  await writeFile(path.join(outDir, "capturas-ejecucion.json"), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    baseUrl,
    fixture: path.relative(root, fixturePath),
    results
  }, null, 2)}\n`, "utf8");
  console.log(`Capturas generadas: ${results.length}`);
  for (const item of results) console.log(`${item.file}\t${item.width}x${item.height}\t${item.route}`);
} finally {
  try {
    await cdp?.send("Browser.close");
  } catch {
    browser?.kill();
  }
  cdp?.close();
  server.kill();
  await delay(500);
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  await rm(runtimeDir, { recursive: true, force: true }).catch(() => {});
}

async function captureDashboard(file, tab) {
  await capture({
    file,
    route: `/pages/business-dashboard.html?business=biz_tfg_demo&tab=${encodeURIComponent(tab)}`,
    width: 1440,
    height: 1000,
    wait: "document.readyState === 'complete' && document.querySelector('[data-business-select] option[value=\"biz_tfg_demo\"]')",
    action: `document.querySelector('[data-tab="${tab}"]')?.click(); true`,
    actionWait: `document.querySelector('[data-tab="${tab}"]')?.classList.contains('is-active')`
  });
}

async function capture({ file, route, width, height, mobile = false, wait, action = "", actionWait = "" }) {
  await setViewport(width, height, mobile);
  const url = `${baseUrl}${route}`;
  await cdp.send("Page.navigate", { url });
  await waitForExpression(wait, 25_000);
  await settle();
  if (action) {
    await evaluate(action);
    if (actionWait) await waitForExpression(actionWait, 15_000);
    await settle();
  }
  await saveScreenshot(file, width, height, route);
}

async function saveScreenshot(file, width, height, route = "interaction") {
  await evaluate("window.scrollTo(0, 0); true");
  await delay(150);
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  await writeFile(path.join(outDir, file), Buffer.from(screenshot.data, "base64"));
  results.push({ file, route, width, height });
}

async function setViewport(width, height, mobile) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: mobile ? 2 : 1,
    mobile,
    screenWidth: width,
    screenHeight: height
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
}

async function settle() {
  await evaluate(`(() => Promise.all(Array.from(document.images).filter((image) => !image.complete).slice(0, 50).map((image) => new Promise((resolve) => {
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', resolve, { once: true });
    setTimeout(resolve, 1800);
  }))).then(() => new Promise((resolve) => setTimeout(resolve, 700))))()`);
}

async function evaluate(expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed");
  return result.result?.value;
}

async function waitForExpression(expression, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if (await evaluate(`Boolean(${expression})`)) return;
    } catch {}
    await delay(150);
  }
  throw new Error(`Timeout esperando: ${expression}`);
}

async function waitForUrl(url, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (server.exitCode !== null) throw new Error(`El servidor terminó antes de tiempo.\n${serverLog}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(150);
  }
  throw new Error(`El servidor no respondió en ${url}.\n${serverLog}`);
}

async function waitForPage(portNumber, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const pages = await fetch(`http://127.0.0.1:${portNumber}/json`).then((response) => response.json());
      const page = pages.find((item) => item.type === "page");
      if (page) return page;
    } catch {}
    await delay(150);
  }
  throw new Error("Chrome no expuso una página de depuración.");
}

async function createCdpClient(socketUrl) {
  const socket = new WebSocket(socketUrl);
  const pending = new Map();
  let nextId = 0;
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const item = pending.get(message.id);
    pending.delete(message.id);
    message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
  });
  socket.addEventListener("close", () => {
    for (const item of pending.values()) item.reject(new Error("Chrome cerró la conexión CDP"));
    pending.clear();
  });
  return {
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() { socket.close(); }
  };
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {}
  }
  throw new Error("No se encontró Chrome o Edge.");
}

function appendBounded(current, chunk) {
  const next = `${current}${String(chunk)}`;
  return next.length > 12_000 ? next.slice(-12_000) : next;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
