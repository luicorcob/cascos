import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const port = 5199 + Math.floor(Math.random() * 600);
const debugPort = 9229 + Math.floor(Math.random() * 600);
const url = `http://127.0.0.1:${port}/index.html`;
const chrome = await findChrome();
const profile = await mkdtemp(path.join(os.tmpdir(), "locallift-browser-"));
const downloads = path.join(profile, "downloads");
const debug = process.env.STUDIO_BROWSER_TEST_DEBUG === "1";
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
  trace(`waiting for server ${url}`);
  await waitForUrl(url);
  trace("launching browser");
  const browserArgs = [
    "--headless=new",
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
    `--user-data-dir=${profile}`,
    url
  ];
  if (debug) {
    browserArgs.splice(4, 0, "--enable-logging=stderr", "--v=1");
  }
  browser = spawn(chrome, browserArgs, { stdio: debug ? ["ignore", "pipe", "pipe"] : "ignore", windowsHide: true });
  browser.stderr?.on("data", (chunk) => trace(String(chunk).trim()));

  const page = await waitForPage(debugPort);
  trace("devtools page ready");
  cdp = await createCdpClient(page.webSocketDebuggerUrl);
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: downloads });
  await waitForExpression('document.documentElement.dataset.studioReady === "true"');
  trace("studio ready");

  assert.equal(await evaluate('document.documentElement.dataset.studioError || ""'), "");
  assert.ok(await evaluate('document.querySelectorAll("[data-edit-field], [data-edit-list]").length > 20'));
  assert.ok(await evaluate('document.querySelectorAll("[data-edit-image-field], [data-edit-image-list]").length > 4'));
  assert.ok(await evaluate('document.querySelectorAll("[data-edit-link-field], [data-edit-link-list]").length > 3'));
  assert.ok(await evaluate('document.querySelectorAll("[data-block-section][data-block-variant]").length >= 13'));
  await evaluate('document.querySelector(\'[data-block-section="gallery"][data-block-variant="marquee"]\').click()');
  await waitForExpression('document.querySelector(".generated-site").classList.contains("block-gallery-marquee")');
  await evaluate('document.querySelector(".gallery-band").scrollIntoView({ block: "center" })');
  const galleryScrollBefore = await evaluate('document.querySelector(".gallery-track").scrollLeft');
  await delay(4500);
  const galleryScrollAfter = await evaluate('document.querySelector(".gallery-track").scrollLeft');
  assert.ok(galleryScrollAfter > galleryScrollBefore, "The mobile gallery carousel should advance automatically");
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".gallery-item.is-gallery-clone")).display'), "none");
  assert.equal(await evaluate('document.querySelectorAll("#heroLayoutPicker .hero-layout-option").length'), 5);
  await evaluate('document.querySelector(\'#heroLayoutPicker [data-block-variant="collage"]\').click()');
  await waitForExpression('document.querySelector(".generated-site").classList.contains("block-hero-collage")');
  assert.notEqual(await evaluate('getComputedStyle(document.querySelector(".hero-art")).display'), "none");
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".hero-media")).display'), "none");
  await evaluate('document.querySelector(\'#heroLayoutPicker [data-block-variant="oval"]\').click()');
  await waitForExpression('document.querySelector(".generated-site").classList.contains("block-hero-oval")');
  assert.equal(await evaluate('document.querySelector(\'#heroLayoutPicker [data-block-variant="oval"]\').getAttribute("aria-pressed")'), "true");
  assert.notEqual(await evaluate('getComputedStyle(document.querySelector(".hero-media")).display'), "none");
  assert.ok(await evaluate('document.querySelectorAll("[data-preview-section-action]").length > 10'));
  await evaluate('document.querySelector("#prepareDeliveryButton").click()');
  await waitForExpression('document.querySelector("#deliveryStatus").textContent !== "Sin preparar"');
  assert.ok(await evaluate('document.querySelector("#deliveryReport").textContent.includes("Siguiente paso")'));
  assert.ok(await evaluate('document.querySelector("#deliveryReadiness").textContent.endsWith("%")'));

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
  await evaluate('document.querySelector(\'[data-quick-action="premium"]\').click()');
  await waitForExpression('document.querySelector(".generated-site").classList.contains("block-hero-collage")');
  assert.ok(await evaluate('document.querySelector(".generated-site").classList.contains("art-atelier")'));
  assert.equal(await evaluate('document.querySelector("#businessForm").elements.fontScale.value'), "95");
  assert.equal(await evaluate('document.querySelector("#businessForm").elements.intensity.value'), "45");
  assert.equal(
    await evaluate('document.querySelector("#businessForm").elements.tagline.value'),
    "Texto editado desde preview",
    "Brand refinement must preserve the business voice"
  );
  await evaluate('document.querySelector(\'[data-quick-action="urgent"]\').click()');
  await waitForExpression('document.querySelector(".generated-site").classList.contains("block-hero-split")');
  assert.ok(await evaluate('document.querySelector(".generated-site").classList.contains("art-editorial")'));
  assert.equal(await evaluate('document.querySelector(".generated-site").classList.contains("art-poster")'), false);
  assert.equal(await evaluate('document.querySelector("#businessForm").elements.sectionOrder.value.startsWith("booking")'), true);
  assert.equal(await evaluate('document.querySelector("#businessForm").elements.showBooking.checked'), true);
  await evaluate('document.querySelector("#quickUndoButton").click()');
  await waitForExpression('document.querySelector(".generated-site").classList.contains("block-hero-collage")');
  await evaluate('document.querySelector("#quickUndoButton").click()');
  await waitForExpression('!document.querySelector(".generated-site").classList.contains("block-hero-collage")');

  const serviceCountBefore = await evaluate('document.querySelector("#businessForm").elements.services.value.trim().split(/\\n+/).filter(Boolean).length');
  await evaluate('document.querySelector(\'[data-preview-section-action="add-item"][data-section-key="services"]\').click()');
  await waitForExpression(`document.querySelector("#businessForm").elements.services.value.trim().split(/\\n+/).filter(Boolean).length === ${serviceCountBefore + 1}`);
  await evaluate('document.querySelector(\'[data-preview-item-action="duplicate"][data-preview-item-list="services"][data-preview-item-index="0"]\').click()');
  await waitForExpression(`document.querySelector("#businessForm").elements.services.value.trim().split(/\\n+/).filter(Boolean).length === ${serviceCountBefore + 2}`);
  const firstService = await evaluate('document.querySelector("#businessForm").elements.services.value.trim().split(/\\n+/)[0]');
  await evaluate('document.querySelector(\'[data-preview-item-action="down"][data-preview-item-list="services"][data-preview-item-index="0"]\').click()');
  await waitForExpression(`document.querySelector("#businessForm").elements.services.value.trim().split(/\\n+/)[1] === ${JSON.stringify(firstService)}`);
  await evaluate('document.querySelector(\'[data-preview-item-action="delete"][data-preview-item-list="services"][data-preview-item-index="1"]\').click()');
  await waitForExpression(`document.querySelector("#businessForm").elements.services.value.trim().split(/\\n+/).filter(Boolean).length === ${serviceCountBefore + 1}`);

  const testimonialCountBefore = await evaluate('document.querySelector("#businessForm").elements.testimonials.value.trim().split(/\\n+/).filter(Boolean).length');
  await evaluate('document.querySelector(\'[data-preview-section-action="add-item"][data-section-key="testimonials"]\').click()');
  await waitForExpression(`document.querySelector("#businessForm").elements.testimonials.value.trim().split(/\\n+/).filter(Boolean).length === ${testimonialCountBefore + 1}`);
  const faqCountBefore = await evaluate('document.querySelector("#businessForm").elements.faqs.value.trim().split(/\\n+/).filter(Boolean).length');
  await evaluate('document.querySelector(\'[data-preview-section-action="add-item"][data-section-key="faq"]\').click()');
  await waitForExpression(`document.querySelector("#businessForm").elements.faqs.value.trim().split(/\\n+/).filter(Boolean).length === ${faqCountBefore + 1}`);

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
  const galleryCountBefore = await evaluate('document.querySelector("#businessForm").elements.gallery.value.trim().split(/\\n+/).filter(Boolean).length');
  await evaluate('document.querySelector(\'[data-preview-section-action="add-item"][data-section-key="gallery"]\').click()');
  await waitForExpression(`document.querySelector("#businessForm").elements.gallery.value.trim().split(/\\n+/).filter(Boolean).length === ${galleryCountBefore + 1}`);

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
    document.querySelector("#previewInspectorButtonBackground").value = "#2255aa";
    document.querySelector("#previewInspectorButtonTextColor").value = "#ffffff";
    document.querySelector("#previewInspectorButtonNeon").checked = false;
    document.querySelector("#previewInspectorButtonGlow").value = "75";
    document.querySelector("#previewInspectorLinkApply").click();
    true
  `);
  await waitForExpression('document.querySelector("#businessForm").elements.bookingLabel.value === "Reservar visita"');
  assert.equal(await evaluate('document.querySelector("#businessForm").elements.bookingUrl.value'), "https://example.com/reserva");
  assert.deepEqual(
    await evaluate('JSON.parse(document.querySelector("#businessForm").elements.buttonStyles.value).primary'),
    { background: "#2255aa", textColor: "#ffffff", neon: false, glowStrength: 75 }
  );
  assert.equal(
    await evaluate('getComputedStyle(document.querySelector(".site-cta")).backgroundColor'),
    "rgb(34, 85, 170)"
  );
  assert.equal(await evaluate('getComputedStyle(document.querySelector(".site-cta")).boxShadow'), "none");

  await evaluate('document.querySelector(\'[data-preview-section-action="down"][data-section-key="services"]\').click()');
  await waitForExpression('!document.querySelector("#businessForm").elements.sectionOrder.value.startsWith("services")');
  await evaluate('document.querySelector(\'[data-preview-section-action="hide"][data-section-key="gallery"]\').click()');
  await waitForExpression('document.querySelector("#businessForm").elements.showGallery.checked === false');
  await evaluate('document.querySelector(\'[data-preview-section-action="duplicate"][data-section-key="services"]\').click()');
  await waitForExpression('document.querySelector("#businessForm").elements.sectionOrder.value.includes("services__copy1")');
  assert.equal(await evaluate('document.querySelectorAll(\'section[data-section-key="services"], section[data-section-key="services__copy1"]\').length'), 2);
  await evaluate('document.querySelector(\'section[data-section-key="services__copy1"] [data-preview-section-action="remove"]\').click()');
  await waitForExpression('!document.querySelector("#businessForm").elements.sectionOrder.value.includes("services__copy1")');

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
  await evaluate('document.querySelector(\'[data-quick-action="showcase"]\').click()');
  await waitForExpression('document.querySelector(".generated-site").classList.contains("content-visual")');
  assert.equal(await evaluate('document.querySelector("#businessForm").elements.showGallery.checked'), true);
  assert.equal(await evaluate('document.querySelector("#businessForm").elements.showFaq.checked'), false);
  assert.equal(await evaluate('document.querySelector("#businessForm").elements.showLeadForm.checked'), false);
  assert.ok(await evaluate('document.querySelectorAll(".service-card").length <= 3'));
  assert.equal(await evaluate('document.querySelector(".faq-section")'), null);
  await evaluate(`
    const tagline = document.querySelector('[data-edit-field="tagline"]');
    tagline.click();
    tagline.blur();
    document.querySelector("#previewInspectorTextColor").value = "#ff3366";
    document.querySelector("#previewInspectorTextOpacity").value = "75";
    document.querySelector("#previewInspectorTextSize").value = "120";
    document.querySelector("#previewInspectorTextWeight").value = "900";
    document.querySelector("#previewInspectorTextItalic").value = "italic";
    document.querySelector("#previewInspectorTextLetterSpacing").value = "4";
    document.querySelector("#previewInspectorTextApply").click();
    true
  `);
  await waitForExpression('JSON.parse(document.querySelector("#businessForm").elements.textStyles.value)["field:tagline"].color === "#ff3366"');
  await waitForExpression('!!document.querySelector(\'[data-text-style-key="field:tagline"]\')');

  await evaluate(`
    document.querySelector("#businessForm").elements.privacyUrl.value = "/privacidad";
    document.querySelector("#exportButton").click();
    true
  `);
  trace("html export clicked");
  const exportedFile = await waitForDownloadedFile(downloads, ".html");
  trace(`html downloaded ${path.basename(exportedFile)}`);
  const exportedHtml = await readFile(exportedFile, "utf8");
  assert.match(exportedHtml, /Portada accesible del estudio/);
  assert.match(exportedHtml, /Reservar visita/);
  assert.match(exportedHtml, /--site-primary-button-bg:#2255aa/);
  assert.match(exportedHtml, /data-primary-button-neon="off"/);
  assert.match(exportedHtml, /style="[^"]*color:#ff3366[^"]*opacity:0.75[^"]*font-size:calc\(var\(--text-base-size, 1em\) \* 1.2\)/);
  assert.doesNotMatch(exportedHtml, /preview-section-controls/);
  assert.doesNotMatch(exportedHtml, /preview-inspector/);
  assert.doesNotMatch(exportedHtml, /data-edit-/);
  assert.doesNotMatch(exportedHtml, /data-section-key/);
  assert.doesNotMatch(exportedHtml, /data-text-style-key/);

  await evaluate(`
    document.querySelector("#exportPackageButton").click();
    true
  `);
  trace("package export clicked");
  const packageFile = await waitForDownloadedFile(downloads, ".zip");
  trace(`package downloaded ${path.basename(packageFile)}`);
  const packageEntries = readStoredZipEntries(await readFile(packageFile));
  assert.deepEqual(
    packageEntries.map((entry) => entry.name).sort(),
    ["business.json", "cambios.md", "ficha-entrega.md", "index.html"]
  );
  assert.match(packageEntries.find((entry) => entry.name === "index.html").text, /Reservar visita/);
  assert.match(packageEntries.find((entry) => entry.name === "business.json").text, /"business"/);
  assert.match(packageEntries.find((entry) => entry.name === "ficha-entrega.md").text, /Ficha de entrega/);
  assert.match(packageEntries.find((entry) => entry.name === "cambios.md").text, /Cambios de entrega/);

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
    const { resolve, reject, method, params } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(`${method}: ${message.error.message}${describeCdpParams(params)}`)) : resolve(message.result);
  });
  socket.addEventListener("close", () => rejectPending("Chrome DevTools socket closed"));
  socket.addEventListener("error", () => rejectPending("Chrome DevTools socket errored"));

  return {
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, method, params });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    }
  };

  function rejectPending(message) {
    pending.forEach(({ reject, method, params }) => {
      reject(new Error(`${method}: ${message}${describeCdpParams(params)}`));
    });
    pending.clear();
  }
}

function describeCdpParams(params) {
  const expression = params?.expression;
  return expression ? `\nExpression: ${String(expression).slice(0, 220)}` : "";
}

async function evaluate(expression) {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    const details = result.exceptionDetails;
    const description = details.exception?.description || details.exception?.value || details.text || "Browser evaluation failed";
    throw new Error(description);
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

async function waitForDownloadedFile(directory, extension = ".html", timeout = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const files = await readdir(directory);
    const complete = files.find((file) => file.endsWith(extension) && !file.endsWith(".crdownload"));
    if (complete) {
      return path.join(directory, complete);
    }
    await delay(120);
  }
  throw new Error(`Timed out waiting for exported ${extension} download.`);
}

function trace(message) {
  if (debug) {
    console.log(`[browser-test] ${message}`);
  }
}

function readStoredZipEntries(buffer) {
  const entries = [];
  let offset = 0;

  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");

    assert.equal(method, 0, `${name} must use stored ZIP entries`);
    assert.equal(compressedSize, uncompressedSize, `${name} must not be compressed`);
    entries.push({
      name,
      text: buffer.subarray(dataStart, dataEnd).toString("utf8")
    });
    offset = dataEnd;
  }

  return entries;
}
