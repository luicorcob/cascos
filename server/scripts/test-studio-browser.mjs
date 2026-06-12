import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const port = 5199;
const debugPort = 9229;
const url = `http://127.0.0.1:${port}/index.html`;
const chrome = await findChrome();
const profile = await mkdtemp(path.join(os.tmpdir(), "locallift-browser-"));
const downloads = path.join(profile, "downloads");
await mkdir(downloads);
const server = spawn(process.execPath, ["server/server.mjs"], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: "ignore",
  windowsHide: true
});
let browser;
let cdp;

try {
  await waitForUrl(url);
  browser = spawn(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    url
  ], { stdio: "ignore", windowsHide: true });

  const page = await waitForPage(debugPort);
  cdp = await createCdpClient(page.webSocketDebuggerUrl);
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  await waitForExpression('document.documentElement.dataset.studioReady === "true"');

  assert.equal(await evaluate('document.documentElement.dataset.studioError || ""'), "");
  assert.ok(await evaluate('document.querySelectorAll("[data-edit-field], [data-edit-list]").length > 20'));
  assert.ok(await evaluate('document.querySelectorAll("[data-edit-image-field], [data-edit-image-list]").length > 4'));
  assert.ok(await evaluate('document.querySelectorAll("[data-edit-link-field], [data-edit-link-list]").length > 3'));
  assert.ok(await evaluate('document.querySelectorAll("[data-block-section][data-block-variant]").length >= 13'));
  assert.ok(await evaluate('document.querySelectorAll("[data-preview-section-action]").length > 10'));

  await evaluate(`
    document.querySelector("#directEditButton").click();
    document.querySelector('[data-edit-field="tagline"]').click();
    document.querySelector('[data-edit-field="tagline"]').textContent = "Texto editado desde preview";
    document.querySelector('[data-edit-field="tagline"]').blur();
    true
  `);
  await waitForExpression('document.querySelector("#businessForm").elements.tagline.value === "Texto editado desde preview"');
  assert.ok(await evaluate('document.querySelector(".generated-site").textContent.includes("Texto editado desde preview")'));
  await evaluate('document.querySelector("#quickUndoButton").click()');
  await waitForExpression('document.querySelector("#businessForm").elements.tagline.value !== "Texto editado desde preview"');
  await evaluate('document.querySelector("#quickRedoButton").click()');
  await waitForExpression('document.querySelector("#businessForm").elements.tagline.value === "Texto editado desde preview"');

  await evaluate('document.querySelector(\'[data-block-section="services"][data-block-variant="list"]\').click()');
  await waitForExpression('document.querySelector(".generated-site").classList.contains("block-services-list")');
  assert.equal(
    await evaluate('JSON.parse(document.querySelector("#businessForm").elements.blockVariants.value).services'),
    "list"
  );

  await evaluate(`
    document.querySelector("#mediaUrlInput").value = "https://example.com/studio-test.jpg";
    document.querySelector("#mediaUrlAddButton").click();
    true
  `);
  await waitForExpression('document.querySelectorAll(".media-library-card").length === 1');
  await evaluate(`
    (() => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>';
      const file = new File([svg], "muestra.svg", { type: "image/svg+xml" });
      const transfer = new DataTransfer();
      transfer.items.add(file);
      const input = document.querySelector("#mediaUploadInput");
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()
  `);
  await waitForExpression('document.querySelectorAll(".media-library-card").length === 2');
  await evaluate('document.querySelector(\'[data-media-action="hero"]\').click()');
  await waitForExpression('document.querySelector("#businessForm").elements.heroImage.value === "https://example.com/studio-test.jpg"');
  assert.equal(
    await evaluate('document.querySelector(".hero-media img").getAttribute("src")'),
    "https://example.com/studio-test.jpg"
  );

  await evaluate(`
    document.querySelector('[data-edit-image-field="heroImage"]').click();
    document.querySelector("#previewInspectorImageAlt").value = "Portada accesible del estudio";
    document.querySelector("#previewInspectorImagePosition").value = "center top";
    document.querySelector("#previewInspectorImageApply").click();
    true
  `);
  await waitForExpression('document.querySelector(".hero-media img").alt === "Portada accesible del estudio"');
  assert.equal(
    await evaluate('JSON.parse(document.querySelector("#businessForm").elements.mediaMetadata.value)["https://example.com/studio-test.jpg"].position'),
    "center top"
  );

  await evaluate(`
    document.querySelector('[data-edit-link-field="booking"]').click();
    document.querySelector("#previewInspectorLinkLabel").value = "Reservar visita";
    document.querySelector("#previewInspectorLinkUrl").value = "https://example.com/reserva";
    document.querySelector("#previewInspectorLinkApply").click();
    true
  `);
  await waitForExpression('document.querySelector("#businessForm").elements.bookingLabel.value === "Reservar visita"');
  assert.equal(await evaluate('document.querySelector("#businessForm").elements.bookingUrl.value'), "https://example.com/reserva");

  await evaluate('document.querySelector(\'[data-preview-section-action="down"][data-section-key="services"]\').click()');
  await waitForExpression('!document.querySelector("#businessForm").elements.sectionOrder.value.startsWith("services")');
  await evaluate('document.querySelector(\'[data-preview-section-action="hide"][data-section-key="gallery"]\').click()');
  await waitForExpression('document.querySelector("#businessForm").elements.showGallery.checked === false');

  await evaluate(`
    document.querySelector("#layoutTemplateName").value = "Mi composicion";
    document.querySelector("#layoutTemplateSave").click();
    true
  `);
  await waitForExpression('document.querySelectorAll(".layout-template-card").length === 4');
  await evaluate('document.querySelector(\'[data-layout-template-action="apply"][data-layout-template-id="compact"]\').click()');
  await waitForExpression('document.querySelector(".generated-site").classList.contains("block-hero-minimal")');
  assert.equal(
    await evaluate('document.querySelector("#businessForm").elements.tagline.value'),
    "Texto editado desde preview",
    "Applying a layout must preserve business content"
  );

  await evaluate(`
    document.querySelector("#businessForm").elements.privacyUrl.value = "/privacidad";
    document.querySelector("#exportButton").click();
    true
  `);
  const exportedFile = await waitForDownloadedFile(downloads);
  const exportedHtml = await readFile(exportedFile, "utf8");
  assert.match(exportedHtml, /Portada accesible del estudio/);
  assert.match(exportedHtml, /Reservar visita/);
  assert.doesNotMatch(exportedHtml, /preview-section-controls/);
  assert.doesNotMatch(exportedHtml, /preview-inspector/);
  assert.doesNotMatch(exportedHtml, /data-edit-/);
  assert.doesNotMatch(exportedHtml, /data-section-key/);

  console.log("Studio browser interaction checks passed.");
} finally {
  try {
    await cdp?.send("Browser.close");
  } catch (error) {
    browser?.kill();
  }
  cdp?.close();
  server.kill();
  await delay(500);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium"
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      // Try the next common browser path.
    }
  }
  throw new Error("Chrome or Edge is required for the Studio browser test.");
}

async function waitForUrl(target, timeout = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(target);
      if (response.ok) return;
    } catch (error) {
      // Server is still starting.
    }
    await delay(120);
  }
  throw new Error(`Timed out waiting for ${target}`);
}

async function waitForPage(portNumber, timeout = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const pages = await fetch(`http://127.0.0.1:${portNumber}/json`).then((response) => response.json());
      const page = pages.find((item) => item.type === "page" && item.url.includes("index.html"));
      if (page) return page;
    } catch (error) {
      // Browser is still starting.
    }
    await delay(120);
  }
  throw new Error("Timed out waiting for the Chrome DevTools page.");
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
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  });

  return {
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    }
  };
}

async function evaluate(expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Browser evaluation failed");
  }
  return result.result.value;
}

async function waitForExpression(expression, timeout = 8_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await evaluate(expression)) return;
    await delay(80);
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForDownloadedFile(directory, timeout = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const files = await readdir(directory);
    const complete = files.find((file) => file.endsWith(".html") && !file.endsWith(".crdownload"));
    if (complete) {
      return path.join(directory, complete);
    }
    await delay(120);
  }
  throw new Error("Timed out waiting for the exported HTML download.");
}
