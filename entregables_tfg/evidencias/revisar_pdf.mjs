import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const evidenceDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(evidenceDir, "..");
const pdfPath = path.join(outputDir, "memoria_tfg.pdf");
const reviewDir = path.join(outputDir, "revision_pdf");
const pdf = await readFile(pdfPath);
const counts = [...pdf.toString("latin1").matchAll(/\/Count\s+(\d+)/g)].map((match) => Number(match[1]));
const pageCount = Math.max(...counts.filter(Number.isFinite));
if (!pageCount) throw new Error("No se pudo determinar el número de páginas.");

await mkdir(reviewDir, { recursive: true });
const chrome = await findChrome();
const profile = await mkdtemp(path.join(os.tmpdir(), "dls-tfg-review-"));
const debugPort = 9851 + Math.floor(Math.random() * 80);
const fileUrl = pathToFileURL(pdfPath).href;
const browser = spawn(chrome, [
  "--headless=new",
  "--no-sandbox",
  "--disable-gpu",
  "--disable-dev-shm-usage",
  "--disable-extensions",
  "--no-first-run",
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${profile}`,
  `${fileUrl}#page=1&zoom=page-fit`
], { stdio: "ignore", windowsHide: true });

let cdp;
try {
  const page = await waitForPage(debugPort, 20_000);
  cdp = await createCdpClient(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1080,
    height: 1240,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: 1080,
    screenHeight: 1240
  });

  if (process.env.PDF_DOM_DEBUG === "1") {
    await delay(2500);
    const diagnostic = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const rows = [];
        const walk = (root, depth = 0) => {
          if (!root || depth > 7) return;
          for (const node of root.querySelectorAll('*')) {
            if (node.id || /^(PDF-|VIEWER-|CR-|INPUT|EMBED)/.test(node.tagName)) {
              rows.push({ depth, tag: node.tagName, id: node.id || '', cls: String(node.className || '').slice(0, 80), type: node.type || '', value: node.value || '' });
            }
            if (node.shadowRoot) walk(node.shadowRoot, depth + 1);
          }
        };
        walk(document);
        return { href: location.href, title: document.title, html: document.documentElement?.outerHTML?.slice(0, 2000) || '', rows: rows.slice(0, 300) };
      })()`,
      returnByValue: true
    });
    console.log(JSON.stringify(diagnostic.result?.value || [], null, 2));
  } else {

  for (let number = 1; number <= pageCount; number += 1) {
    await cdp.send("Page.navigate", { url: `${fileUrl}#page=${number}&zoom=page-fit` });
    await delay(number === 1 ? 1800 : 700);
    const screenshot = await cdp.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false
    });
    const filename = `pagina-${String(number).padStart(3, "0")}.png`;
    await writeFile(path.join(reviewDir, filename), Buffer.from(screenshot.data, "base64"));
    if (number % 10 === 0 || number === pageCount) console.log(`Revisión renderizada: ${number}/${pageCount}`);
  }

  await writeFile(path.join(reviewDir, "revision-metadata.json"), `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: path.relative(outputDir, pdfPath),
    pageCount,
    viewport: { width: 1080, height: 1240 },
    note: "Imágenes de revisión del PDF; no son figuras de la memoria."
  }, null, 2)}\n`, "utf8");
  }
} finally {
  try { await cdp?.send("Browser.close"); } catch { browser.kill(); }
  cdp?.close();
  browser.kill();
  await delay(300);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch {}
  }
  throw new Error("No se encontró Chrome o Edge.");
}

async function waitForPage(port, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
      const page = pages.find((item) => item.type === "page");
      if (page) return page;
    } catch {}
    await delay(120);
  }
  throw new Error("Chrome no expuso el visor PDF por CDP.");
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
