import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const defaultRoute = "/workspace.html?presentation=true";
const defaultViewports = [
  { name: "desktop", width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false, touch: false },
  { name: "tablet", width: 768, height: 1024, deviceScaleFactor: 1, mobile: true, touch: true },
  { name: "mobile", width: 390, height: 844, deviceScaleFactor: 2, mobile: true, touch: true },
  { name: "mobile-narrow", width: 320, height: 720, deviceScaleFactor: 2, mobile: true, touch: true }
];

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

const debug = options.debug || process.env.QA_DEBUG === "1";
const outDir = path.resolve(root, options.out || process.env.QA_OUT_DIR || ".tmp-qa-visual");
const requestedPort = options.port || process.env.QA_PORT;
const requestedDebugPort = options.debugPort || process.env.QA_DEBUG_PORT;
const port = requestedPort ? Number(requestedPort) : await findAvailablePort();
const debugPort = requestedDebugPort ? Number(requestedDebugPort) : await findAvailablePort();
const route = normalizeRoute(options.path || process.env.QA_PATH || defaultRoute);
const targetUrl = options.url || process.env.QA_URL || `http://127.0.0.1:${port}${route}`;
const shouldStartServer = !options.url && !process.env.QA_URL;
const viewports = parseViewportOption(options.viewports || process.env.QA_VIEWPORTS);
const failOnWarnings = options.failOnWarnings || process.env.QA_FAIL_ON_WARNINGS === "1";

await mkdir(outDir, { recursive: true });

const chrome = await findChrome();
const profile = await mkdtemp(path.join(os.tmpdir(), "dls-qa-visual-"));
let server;
let browser;
let cdp;

try {
  if (shouldStartServer) {
    server = spawn(process.execPath, ["server/server.mjs"], {
      cwd: root,
      env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
      stdio: debug ? ["ignore", "pipe", "pipe"] : "ignore",
      windowsHide: true
    });
    server.stdout?.on("data", (chunk) => trace(`[server] ${String(chunk).trim()}`));
    server.stderr?.on("data", (chunk) => trace(`[server] ${String(chunk).trim()}`));
    await waitForUrl(targetUrl);
  }

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
    "--disable-background-networking",
    "--disable-background-timer-throttling",
    "--disable-client-side-phishing-detection",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-renderer-backgrounding",
    "--disable-sync",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    targetUrl
  ], {
    stdio: debug ? ["ignore", "pipe", "pipe"] : "ignore",
    windowsHide: true
  });
  browser.stdout?.on("data", (chunk) => trace(`[browser] ${String(chunk).trim()}`));
  browser.stderr?.on("data", (chunk) => trace(`[browser] ${String(chunk).trim()}`));

  const page = await waitForPage(debugPort, targetUrl);
  cdp = await createCdpClient(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const runs = [];
  for (const viewport of viewports) {
    console.log(`QA visual: revisando ${viewport.name} (${viewport.width}x${viewport.height})`);
    runs.push(await auditViewport(viewport));
  }

  const report = buildReport({ targetUrl, outDir, viewports: runs });
  const jsonPath = path.join(outDir, "qa-visual-report.json");
  const htmlPath = path.join(outDir, "qa-visual-report.html");
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(htmlPath, renderHtmlReport(report), "utf8");

  const blockers = report.totals.blockers;
  const warnings = report.totals.warnings;
  console.log(`QA visual completado: ${blockers} bloqueos, ${warnings} avisos.`);
  console.log(`Reporte: ${htmlPath}`);

  if (blockers > 0 || (failOnWarnings && warnings > 0)) {
    process.exitCode = 1;
  }
} finally {
  try {
    await cdp?.send("Browser.close");
  } catch (error) {
    browser?.kill();
  }
  cdp?.close();
  server?.kill();
  await delay(300);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

async function auditViewport(viewport) {
  await setViewport(viewport);
  await cdp.send("Page.navigate", { url: targetUrl });
  await waitForExpression("document.readyState === 'complete' && !!document.body", 15_000);
  await waitForStudioIfPresent();
  await settlePage();
  await stabilizePageForAudit();

  const screenshot = await captureScreenshot(viewport);
  const domAudit = await evaluateObject(browserDomAuditSource(viewport));
  const deepVisualAudit = await runDeepVisualAudit(viewport);
  const keyboardAudit = await runKeyboardAudit(viewport);

  return {
    viewport,
    screenshot,
    metrics: { ...domAudit.metrics, ...deepVisualAudit.metrics },
    passes: [...domAudit.passes, ...deepVisualAudit.passes, ...keyboardAudit.passes],
    issues: [...domAudit.issues, ...deepVisualAudit.issues, ...keyboardAudit.issues]
  };
}

async function setViewport(viewport) {
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: viewport.deviceScaleFactor,
    mobile: viewport.mobile,
    screenWidth: viewport.width,
    screenHeight: viewport.height
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: viewport.mobile });
}

async function settlePage() {
  await evaluateObject(`(() => {
    const start = Date.now();
    const imagePromises = Array.from(document.images)
      .filter((image) => !image.complete)
      .slice(0, 80)
      .map((image) => new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
        setTimeout(resolve, 1600);
      }));

    return Promise.all(imagePromises).then(() => new Promise((resolve) => {
      const wait = Math.max(250, 800 - (Date.now() - start));
      setTimeout(() => resolve(true), wait);
    }));
  })()`);
}

async function stabilizePageForAudit() {
  await evaluateObject(`(() => {
    const id = "qa-visual-stabilize";
    document.getElementById(id)?.remove();
    const style = document.createElement("style");
    style.id = id;
    style.textContent = "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }";
    document.head?.append(style);
    window.scrollTo(0, 0);
    return true;
  })()`);
  await delay(100);
}

async function waitForStudioIfPresent() {
  const hasStudioShell = await evaluateObject(`(() => Boolean(
    document.querySelector("#businessForm, #studioShell, #deliveryReport") ||
    Array.from(document.scripts).some((script) => script.src.includes("/src/app.js") || script.src.endsWith("src/app.js"))
  ))()`);

  if (!hasStudioShell) return;

  await waitForExpression(
    "document.documentElement.dataset.studioReady === 'true' || Boolean(document.documentElement.dataset.studioError)",
    18_000
  );
}

async function captureScreenshot(viewport) {
  const metrics = await cdp.send("Page.getLayoutMetrics");
  const contentHeight = Math.ceil(metrics.cssContentSize?.height || viewport.height);
  const fullHeight = Math.max(viewport.height, Math.min(contentHeight, 9000));
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: true,
    clip: {
      x: 0,
      y: 0,
      width: viewport.width,
      height: fullHeight,
      scale: 1
    }
  });
  const filename = `${safeFileName(viewport.name)}-${viewport.width}x${viewport.height}.png`;
  const screenshotPath = path.join(outDir, filename);
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
  return {
    path: screenshotPath,
    filename,
    width: viewport.width,
    height: fullHeight,
    truncated: contentHeight > fullHeight
  };
}

async function captureViewportScreenshot() {
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  return Buffer.from(screenshot.data, "base64");
}

async function runDeepVisualAudit(viewport) {
  const plan = await evaluateObject(deepScanPlanSource());
  const issues = [];
  const passes = [];
  const metrics = {
    deepScanCheckpoints: 0,
    renderedContrastChecked: 0,
    renderedContrastSkipped: 0,
    renderedContrastFailures: 0,
    overlayCheckpoints: 0
  };

  try {
    for (let index = 0; index < (plan.positions || []).length; index += 1) {
      const y = plan.positions[index];
      await evaluateObject(`(() => { window.scrollTo(0, ${Math.max(0, Math.round(y))}); return window.scrollY; })()`);
      await delay(80);

      const layerAudit = await evaluateObject(visibleLayerAuditSource(viewport, index));
      appendBoundedIssues(issues, layerAudit.issues, 12);
      metrics.overlayCheckpoints += 1;

      const samples = await evaluateObject(renderedTextSamplesSource());
      if (!samples.length) continue;

      const before = await captureViewportScreenshot();
      await evaluateObject(hideRenderedTextSource());
      const background = await captureViewportScreenshot();
      await evaluateObject(restoreRenderedTextSource());

      const pixelAudit = auditRenderedTextContrast({ before, background, samples, viewport, checkpoint: index + 1 });
      appendBoundedIssues(issues, pixelAudit.issues, 12);
      metrics.renderedContrastChecked += pixelAudit.checked;
      metrics.renderedContrastSkipped += pixelAudit.skipped;
      metrics.renderedContrastFailures += pixelAudit.failures;
      metrics.deepScanCheckpoints += 1;
    }
  } finally {
    await evaluateObject(restoreRenderedTextSource()).catch(() => {});
    await evaluateObject("(() => { window.scrollTo(0, 0); return true; })()").catch(() => {});
  }

  if (metrics.deepScanCheckpoints > 0) {
    passes.push(`${metrics.deepScanCheckpoints} zonas de la pagina revisadas con contraste de pixeles reales.`);
  }
  if (metrics.overlayCheckpoints > 0) {
    passes.push(`${metrics.overlayCheckpoints} posiciones de scroll revisadas contra solapes.`);
  }

  return { issues, passes, metrics };
}

function appendBoundedIssues(target, source, maxPerCode) {
  const counts = new Map(target.map((issue) => [issue.code, 0]));
  target.forEach((issue) => counts.set(issue.code, (counts.get(issue.code) || 0) + 1));
  source.forEach((issue) => {
    const count = counts.get(issue.code) || 0;
    if (count >= maxPerCode) return;
    counts.set(issue.code, count + 1);
    target.push(issue);
  });
}

function deepScanPlanSource() {
  return `(() => {
    const documentHeight = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
    const viewportHeight = Math.max(window.innerHeight || 0, 1);
    const maxScroll = Math.max(0, documentHeight - viewportHeight);
    if (maxScroll < viewportHeight * 0.55) {
      return { documentHeight, viewportHeight, positions: [0] };
    }
    const checkpointCount = Math.min(9, Math.max(3, Math.ceil(documentHeight / viewportHeight)));
    const positions = new Set([0, maxScroll]);
    for (let index = 1; index < checkpointCount - 1; index += 1) {
      positions.add(Math.round((maxScroll * index) / (checkpointCount - 1)));
    }
    return { documentHeight, viewportHeight, positions: Array.from(positions).sort((a, b) => a - b) };
  })()`;
}

function visibleLayerAuditSource(viewport, checkpoint) {
  return `(() => {
    const viewport = ${JSON.stringify(viewport)};
    const checkpoint = ${Number(checkpoint) + 1};
    const issues = [];
    const limits = new Map();
    const interactive = Array.from(document.querySelectorAll("a[href], button, input, select, textarea, summary, [tabindex], [role='button'], [role='link'], [contenteditable='true']"))
      .filter((element) => isVisible(element) && !element.disabled && element.getAttribute("aria-hidden") !== "true" && element.tabIndex !== -1)
      .filter((element) => intersectsViewport(element.getBoundingClientRect()));

    interactive.forEach((element) => {
      const blocker = coveringElement(element);
      if (blocker) {
        addIssue("blocker", "interactive-covered", "Elemento interactivo tapado en una posicion de scroll.", selectorFor(element), "Zona " + checkpoint + "; encima: " + selectorFor(blocker));
      }
    });

    Array.from(document.images)
      .filter((image) => isVisible(image) && intersectsViewport(image.getBoundingClientRect()))
      .filter((image) => !image.closest(".hero-section, .hero-media, .block-hero, .hero-collage"))
      .forEach((image) => {
        const blocker = coveringElement(image);
        if (blocker) {
          addIssue("warning", "image-covered", "Una imagen queda tapada por otra capa en esta posicion de scroll.", selectorFor(image), "Zona " + checkpoint + "; encima: " + selectorFor(blocker));
        }
      });

    const seenText = new Set();
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node.nodeValue.replace(/\\s+/g, " ").trim();
        const element = node.parentElement;
        if (!text || !element || !isVisible(element) || !intersectsViewport(element.getBoundingClientRect())) return NodeFilter.FILTER_REJECT;
        if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode()) && seenText.size < 70) {
      const element = node.parentElement;
      if (seenText.has(element)) continue;
      seenText.add(element);
      const blocker = coveringElement(element);
      if (blocker) {
        addIssue("warning", "text-covered", "Texto tapado en una posicion de scroll.", selectorFor(element), "Zona " + checkpoint + "; " + trimText(node.nodeValue) + " / encima: " + selectorFor(blocker));
      }
    }

    if (viewport.touch) {
      interactive.forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (Math.min(rect.width, rect.height) < 40) {
          addIssue("warning", "touch-target-small", "Objetivo tactil pequeno en una zona visible.", selectorFor(element), "Zona " + checkpoint + "; " + rectSummary(rect));
        }
      });
    }

    return { issues };

    function coveringElement(element) {
      const rect = element.getBoundingClientRect();
      if (rect.width < 3 || rect.height < 3) return null;
      const points = samplePoints(rect);
      let covered = 0;
      let blocker = null;
      points.forEach(([x, y]) => {
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return;
        const top = document.elementFromPoint(x, y);
        if (!top || top === element || element.contains(top) || top.contains(element) || sameControl(element, top)) return;
        covered += 1;
        blocker = top;
      });
      return covered >= Math.max(1, Math.ceil(points.length / 2)) ? blocker : null;
    }

    function samplePoints(rect) {
      const insetX = Math.min(10, rect.width / 3);
      const insetY = Math.min(10, rect.height / 3);
      return [
        [rect.left + rect.width / 2, rect.top + rect.height / 2],
        [rect.left + insetX, rect.top + rect.height / 2],
        [rect.right - insetX, rect.top + rect.height / 2],
        [rect.left + rect.width / 2, rect.top + insetY],
        [rect.left + rect.width / 2, rect.bottom - insetY]
      ];
    }

    function sameControl(a, b) {
      const aControl = a.closest("a, button, label, [role='button'], [role='link']");
      const bControl = b.closest("a, button, label, [role='button'], [role='link']");
      return aControl && bControl && aControl === bControl;
    }

    function isVisible(element) {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || inheritedOpacity(element) === 0 || element.hidden || element.closest("[hidden], [aria-hidden='true']")) return false;
      return Array.from(element.getClientRects()).some((rect) => rect.width > 0.5 && rect.height > 0.5);
    }

    function inheritedOpacity(element) {
      let opacity = 1;
      let current = element;
      while (current && current instanceof Element) {
        opacity *= Number(getComputedStyle(current).opacity || 1);
        current = current.parentElement;
      }
      return Math.max(0, Math.min(1, opacity));
    }

    function intersectsViewport(rect) {
      return rect.bottom > 0 && rect.right > 0 && rect.left < innerWidth && rect.top < innerHeight;
    }

    function addIssue(severity, code, message, selector, context) {
      const count = limits.get(code) || 0;
      if (count >= 12) return;
      limits.set(code, count + 1);
      issues.push({ severity, code, message, selector, context: String(context || "") });
    }

    function selectorFor(element) {
      if (element.id) return "#" + cssEscape(element.id);
      const parts = [];
      let current = element;
      while (current && current !== document.body && parts.length < 4) {
        let part = current.tagName.toLowerCase();
        if (current.classList.length) part += "." + Array.from(current.classList).slice(0, 2).map(cssEscape).join(".");
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
          if (siblings.length > 1) part += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
        }
        parts.unshift(part);
        current = parent;
      }
      return parts.join(" > ");
    }

    function cssEscape(value) {
      return window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\\\$&");
    }

    function rectSummary(rect) {
      return Math.round(rect.width) + "x" + Math.round(rect.height) + " en " + Math.round(rect.left) + "," + Math.round(rect.top);
    }

    function trimText(value) {
      return String(value || "").replace(/\\s+/g, " ").trim().slice(0, 80);
    }
  })()`;
}

function renderedTextSamplesSource() {
  return `(() => {
    const marker = "data-qa-rendered-text";
    document.querySelectorAll("[" + marker + "]").forEach((element) => element.removeAttribute(marker));
    const candidates = new Map();
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const text = node.nodeValue.replace(/\\s+/g, " ").trim();
        const element = node.parentElement;
        if (text.length < 2 || !element || !(element instanceof HTMLElement) || inheritedOpacity(element) === 0 || !isVisible(element)) return NodeFilter.FILTER_REJECT;
        if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName)) return NodeFilter.FILTER_REJECT;
        const range = document.createRange();
        range.selectNodeContents(node);
        const visible = Array.from(range.getClientRects()).some(intersectsViewport);
        return visible ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    let node;
    while ((node = walker.nextNode()) && candidates.size < 70) {
      const element = node.parentElement;
      const style = getComputedStyle(element);
      const color = parseColor(style.color);
      if (!color || color.a <= 0) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rects = Array.from(range.getClientRects())
        .filter(intersectsViewport)
        .map((rect) => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }));
      if (!rects.length) continue;

      let candidate = candidates.get(element);
      if (!candidate) {
        const fontSize = parseFloat(style.fontSize) || 16;
        const fontWeight = parseInt(style.fontWeight, 10) || 400;
        const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
        candidate = {
          element,
          selector: selectorFor(element),
          text: "",
          color: { ...color, a: color.a * inheritedOpacity(element) },
          threshold: largeText ? 3 : 4.5,
          fontSize,
          rects: []
        };
        candidates.set(element, candidate);
      }
      candidate.text = (candidate.text + " " + node.nodeValue).replace(/\\s+/g, " ").trim().slice(0, 120);
      candidate.rects.push(...rects);
    }

    return Array.from(candidates.values()).map((candidate, index) => {
      candidate.element.setAttribute(marker, String(index));
      return {
        selector: candidate.selector,
        text: candidate.text,
        color: candidate.color,
        threshold: candidate.threshold,
        fontSize: candidate.fontSize,
        rects: candidate.rects.slice(0, 16)
      };
    });

    function isVisible(element) {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0 || element.hidden || element.closest("[hidden], [aria-hidden='true']")) return false;
      return Array.from(element.getClientRects()).some((rect) => rect.width > 0.5 && rect.height > 0.5);
    }

    function intersectsViewport(rect) {
      return rect.bottom > 0 && rect.right > 0 && rect.left < innerWidth && rect.top < innerHeight;
    }

    function inheritedOpacity(element) {
      let opacity = 1;
      let current = element;
      while (current && current instanceof Element) {
        opacity *= Number(getComputedStyle(current).opacity || 1);
        current = current.parentElement;
      }
      return Math.max(0, Math.min(1, opacity));
    }

    function parseColor(value) {
      const match = String(value || "").match(/rgba?\\(([^)]+)\\)/i);
      if (!match) return null;
      const parts = match[1].split(",").map((part) => Number(part.trim()));
      if (parts.length < 3 || parts.slice(0, 3).some((part) => !Number.isFinite(part))) return null;
      return { r: parts[0], g: parts[1], b: parts[2], a: Number.isFinite(parts[3]) ? parts[3] : 1 };
    }

    function selectorFor(element) {
      if (element.id) return "#" + cssEscape(element.id);
      const parts = [];
      let current = element;
      while (current && current !== document.body && parts.length < 4) {
        let part = current.tagName.toLowerCase();
        if (current.classList.length) part += "." + Array.from(current.classList).slice(0, 2).map(cssEscape).join(".");
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
          if (siblings.length > 1) part += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
        }
        parts.unshift(part);
        current = parent;
      }
      return parts.join(" > ");
    }

    function cssEscape(value) {
      return window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\\\$&");
    }
  })()`;
}

function hideRenderedTextSource() {
  return `(() => {
    const id = "qa-rendered-text-hidden";
    document.getElementById(id)?.remove();
    const style = document.createElement("style");
    style.id = id;
    style.textContent = "[data-qa-rendered-text] { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; }";
    document.head?.append(style);
    return true;
  })()`;
}

function restoreRenderedTextSource() {
  return `(() => {
    document.getElementById("qa-rendered-text-hidden")?.remove();
    document.querySelectorAll("[data-qa-rendered-text]").forEach((element) => element.removeAttribute("data-qa-rendered-text"));
    return true;
  })()`;
}

function auditRenderedTextContrast({ before, background, samples, viewport, checkpoint }) {
  const issues = [];
  let checked = 0;
  let skipped = 0;
  let failures = 0;
  let original;
  let withoutText;

  try {
    original = decodePng(before);
    withoutText = decodePng(background);
  } catch (error) {
    return {
      issues: [{
        severity: "warning",
        code: "contrast-rendered-unavailable",
        message: "No se pudo verificar el contraste contra los pixeles renderizados.",
        selector: "html",
        context: String(error.message || error).slice(0, 180)
      }],
      checked,
      skipped: samples.length,
      failures
    };
  }

  if (original.width !== withoutText.width || original.height !== withoutText.height) {
    return {
      issues: [{
        severity: "warning",
        code: "contrast-rendered-unavailable",
        message: "Las capturas de contraste no tienen las mismas dimensiones.",
        selector: "html",
        context: `Zona ${checkpoint}`
      }],
      checked,
      skipped: samples.length,
      failures
    };
  }

  const scaleX = original.width / viewport.width;
  const scaleY = original.height / viewport.height;
  samples.forEach((sample) => {
    const result = sampleRenderedTextContrast(original, withoutText, sample, scaleX, scaleY);
    if (!result) {
      skipped += 1;
      return;
    }
    checked += 1;
    if (result.ratio >= sample.threshold) return;

    failures += 1;
    const severity = result.ratio < 3 ? "blocker" : "warning";
    const confidence = result.changedPixels >= 5 ? "medido debajo de los glifos" : "texto sin diferencia visible frente al fondo";
    issues.push({
      severity,
      code: "contrast-rendered-low",
      message: "Contraste insuficiente en los pixeles renderizados.",
      selector: sample.selector,
      context: `${trimForReport(sample.text)} (${result.ratio.toFixed(2)}:1; minimo ${sample.threshold}:1; ${confidence}; zona ${checkpoint})`
    });
  });

  return { issues, checked, skipped, failures };
}

function sampleRenderedTextContrast(original, background, sample, scaleX, scaleY) {
  const allRatios = [];
  const changedRatios = [];
  let changedPixels = 0;

  sample.rects.forEach((rect) => {
    const left = clamp(Math.floor(rect.left * scaleX), 0, original.width - 1);
    const right = clamp(Math.ceil(rect.right * scaleX), 0, original.width);
    const top = clamp(Math.floor(rect.top * scaleY), 0, original.height - 1);
    const bottom = clamp(Math.ceil(rect.bottom * scaleY), 0, original.height);
    const width = Math.max(0, right - left);
    const height = Math.max(0, bottom - top);
    if (!width || !height) return;
    const stride = Math.max(1, Math.ceil(Math.sqrt((width * height) / 1800)));

    for (let y = top; y < bottom; y += stride) {
      for (let x = left; x < right; x += stride) {
        const index = (y * original.width + x) * 4;
        const under = {
          r: background.data[index],
          g: background.data[index + 1],
          b: background.data[index + 2],
          a: background.data[index + 3] / 255
        };
        const foreground = compositeColor(sample.color, under);
        const ratio = contrastRatio(foreground, under);
        allRatios.push(ratio);
        const delta = Math.abs(original.data[index] - background.data[index])
          + Math.abs(original.data[index + 1] - background.data[index + 1])
          + Math.abs(original.data[index + 2] - background.data[index + 2]);
        if (delta >= 18) {
          changedPixels += 1;
          changedRatios.push(ratio);
        }
      }
    }
  });

  const ratios = changedRatios.length >= 5 ? changedRatios : allRatios;
  if (!ratios.length) return null;
  return { ratio: percentile(ratios, 0.1), changedPixels };
}

function compositeColor(foreground, background) {
  const alpha = clamp(Number(foreground.a ?? 1), 0, 1);
  return {
    r: foreground.r * alpha + background.r * (1 - alpha),
    g: foreground.g * alpha + background.g * (1 - alpha),
    b: foreground.b * alpha + background.b * (1 - alpha),
    a: 1
  };
}

function contrastRatio(a, b) {
  const light = Math.max(colorLuminance(a), colorLuminance(b));
  const dark = Math.min(colorLuminance(a), colorLuminance(b));
  return (light + 0.05) / (dark + 0.05);
}

function colorLuminance(color) {
  const channels = [color.r, color.g, color.b].map((channel) => {
    const value = clamp(Number(channel), 0, 255) / 255;
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function percentile(values, value) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(Math.floor((sorted.length - 1) * value), 0, sorted.length - 1);
  return sorted[index];
}

function decodePng(buffer) {
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) throw new Error("La captura no es PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idat = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) throw new Error("PNG incompleto");
    const chunk = buffer.subarray(dataStart, dataEnd);
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
      if (chunk[12] !== 0) throw new Error("PNG entrelazado no compatible");
    } else if (type === "IDAT") {
      idat.push(chunk);
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4;
  }

  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType];
  if (!width || !height || bitDepth !== 8 || !channels) throw new Error("Formato PNG de captura no compatible");
  const bytesPerPixel = channels;
  const rowLength = width * bytesPerPixel;
  const source = inflateSync(Buffer.concat(idat));
  if (source.length < (rowLength + 1) * height) throw new Error("Datos PNG incompletos");
  const raw = Buffer.alloc(rowLength * height);
  let sourceOffset = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = source[sourceOffset++];
    const rowOffset = y * rowLength;
    const previousOffset = rowOffset - rowLength;
    for (let x = 0; x < rowLength; x += 1) {
      const value = source[sourceOffset++];
      const left = x >= bytesPerPixel ? raw[rowOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? raw[previousOffset + x] : 0;
      const upLeft = y > 0 && x >= bytesPerPixel ? raw[previousOffset + x - bytesPerPixel] : 0;
      if (filter === 0) raw[rowOffset + x] = value;
      else if (filter === 1) raw[rowOffset + x] = (value + left) & 255;
      else if (filter === 2) raw[rowOffset + x] = (value + up) & 255;
      else if (filter === 3) raw[rowOffset + x] = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) raw[rowOffset + x] = (value + paeth(left, up, upLeft)) & 255;
      else throw new Error("Filtro PNG no compatible");
    }
  }

  const data = Buffer.alloc(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const input = pixel * channels;
    const output = pixel * 4;
    if (colorType === 6) {
      raw.copy(data, output, input, input + 4);
    } else if (colorType === 2) {
      data[output] = raw[input];
      data[output + 1] = raw[input + 1];
      data[output + 2] = raw[input + 2];
      data[output + 3] = 255;
    } else if (colorType === 4) {
      data[output] = data[output + 1] = data[output + 2] = raw[input];
      data[output + 3] = raw[input + 1];
    } else {
      data[output] = data[output + 1] = data[output + 2] = raw[input];
      data[output + 3] = 255;
    }
  }
  return { width, height, data };
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function trimForReport(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 90);
}

async function runKeyboardAudit(viewport) {
  const issues = [];
  const passes = [];
  await evaluateObject(`(() => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    document.body?.focus?.();
    window.scrollTo(0, 0);
    return true;
  })()`);

  const seen = new Set();
  const focusSteps = [];
  for (let index = 0; index < 24; index += 1) {
    await pressTab();
    await delay(80);
    const focus = await evaluateObject(focusStateSource());
    if (!focus.selector || focus.selector === "body") break;

    const signature = `${focus.selector}:${focus.text}`;
    if (seen.has(signature) && focusSteps.length > 2) break;
    seen.add(signature);
    focusSteps.push(focus);

    if (!focus.inViewport) {
      addIssue(issues, "warning", "focus-offscreen", "El foco de teclado queda fuera de la ventana visible.", focus.selector, focus.text);
    }

    if (!focus.focusVisible) {
      addIssue(issues, "blocker", "focus-not-visible", "Un elemento alcanzable con Tab no muestra foco visible.", focus.selector, focus.text);
    }
  }

  if (focusSteps.length === 0) {
    addIssue(issues, "warning", "keyboard-no-focusables", "No se encontro ningun elemento alcanzable con Tab.", "", "");
  } else {
    passes.push(`${focusSteps.length} pasos de teclado revisados en ${viewport.name}.`);
  }

  return { issues, passes };
}

async function pressTab() {
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    windowsVirtualKeyCode: 9,
    nativeVirtualKeyCode: 9,
    key: "Tab",
    code: "Tab"
  });
  await cdp.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    windowsVirtualKeyCode: 9,
    nativeVirtualKeyCode: 9,
    key: "Tab",
    code: "Tab"
  });
}

function browserDomAuditSource(viewport) {
  return `(() => {
    const viewport = ${JSON.stringify(viewport)};
    const issues = [];
    const passes = [];
    const limits = new Map();
    const maxPerCode = 24;
    const visibleElements = Array.from(document.body ? document.body.querySelectorAll("*") : []);

    const metrics = {
      title: document.title,
      url: location.href,
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body?.scrollWidth || 0),
      documentHeight: Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0),
      forms: 0,
      formControls: 0,
      focusables: 0,
      contrastChecked: 0,
      contrastSkipped: 0,
      overlapChecked: 0,
      imagesChecked: 0,
      imageLoadFailures: 0,
      imageSeverelyCropped: 0,
      textChecked: 0,
      textTooSmall: 0,
      textClipped: 0
    };

    auditBoot();
    auditHorizontalOverflow();
    auditNamesAndForms();
    auditImages();
    auditTextLegibility();
    auditTextClipping();
    auditTouchTargets();
    auditOverlapAndOcclusion();
    auditTextContrast();

    return { issues, passes, metrics };

    function auditBoot() {
      const bootError = document.documentElement.dataset.studioError || "";
      if (bootError) {
        addIssue("blocker", "studio-boot-error", "La aplicacion informa de un error de arranque.", "html", bootError);
      } else if (document.documentElement.dataset.studioReady === "true") {
        passes.push("Studio cargado sin error de arranque.");
      }
    }

    function auditHorizontalOverflow() {
      const overflow = metrics.scrollWidth - metrics.clientWidth;
      if (overflow > 2) {
        addIssue("blocker", "horizontal-overflow", "El documento desborda horizontalmente la ventana.", "html", metrics.scrollWidth + "px frente a " + metrics.clientWidth + "px");
        visibleElements.filter(isVisible).forEach((element) => {
          const rect = element.getBoundingClientRect();
          if (rect.width < 2 || rect.height < 2) return;
          if (rect.right > metrics.clientWidth + 2 || rect.left < -2) {
            addIssue("warning", "horizontal-overflow-source", "Elemento visible fuera del ancho de la ventana.", selectorFor(element), rectSummary(rect));
          }
        });
      } else {
        passes.push("Sin overflow horizontal del documento.");
      }
    }

    function auditNamesAndForms() {
      const interactive = getInteractiveElements();
      metrics.focusables = interactive.filter((element) => element.tabIndex >= 0).length;
      interactive.forEach((element) => {
        const role = element.tagName.toLowerCase();
        const name = accessibleName(element);
        if (!name) {
          addIssue("blocker", "interactive-name-missing", "Elemento interactivo sin nombre accesible.", selectorFor(element), role);
        }
        if (element.tagName === "A" && element.getAttribute("href") === "#") {
          addIssue("warning", "link-empty-target", "Enlace con destino generico '#'.", selectorFor(element), name);
        }
      });

      const forms = Array.from(document.forms).filter(isVisible);
      metrics.forms = forms.length;
      forms.forEach((form) => {
        const controls = Array.from(form.querySelectorAll("input, select, textarea"))
          .filter((control) => isVisible(control) && !["hidden", "submit", "button", "reset", "image"].includes((control.type || "").toLowerCase()));
        metrics.formControls += controls.length;

        controls.forEach((control) => {
          const name = accessibleName(control);
          const selector = selectorFor(control);
          if (!name) {
            addIssue("blocker", "form-control-name-missing", "Campo de formulario sin etiqueta o nombre accesible.", selector, control.type || control.tagName.toLowerCase());
          } else if (name === control.getAttribute("placeholder")) {
            addIssue("warning", "form-control-placeholder-label", "El campo usa placeholder como unico nombre visible.", selector, name);
          }

          const purpose = [control.name, control.id, name, control.getAttribute("placeholder")]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          if (/email|correo|mail/.test(purpose) && (control.type || "").toLowerCase() !== "email") {
            addIssue("warning", "email-input-type", "Campo de correo sin type='email'.", selector, name);
          }
          if (/tel|telefono|phone|whatsapp/.test(purpose) && (control.type || "").toLowerCase() !== "tel") {
            addIssue("warning", "phone-input-type", "Campo de telefono sin type='tel'.", selector, name);
          }
        });

        const submitters = Array.from(form.querySelectorAll("button, input[type='submit']"))
          .filter((button) => isVisible(button) && !button.disabled);
        if (controls.length > 0 && submitters.length === 0) {
          addIssue("blocker", "form-submit-missing", "Formulario visible sin boton de envio.", selectorFor(form), "");
        }
      });
    }

    function auditImages() {
      Array.from(document.images).filter(isVisible).forEach((image) => {
        metrics.imagesChecked += 1;
        const alt = image.getAttribute("alt");
        const role = image.getAttribute("role");
        if (alt === null && role !== "presentation") {
          addIssue("warning", "image-alt-missing", "Imagen visible sin atributo alt.", selectorFor(image), image.currentSrc || image.src || "");
        }

        const rect = image.getBoundingClientRect();
        const selector = selectorFor(image);
        if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
          metrics.imageLoadFailures += 1;
          addIssue("blocker", "image-load-failed", "Una imagen visible no se ha podido cargar o no tiene dimensiones.", selector, image.currentSrc || image.src || "");
          return;
        }

        const clipping = visibleRectWithinClippingAncestors(image, rect);
        const exposed = rect.width * rect.height ? (clipping.width * clipping.height) / (rect.width * rect.height) : 1;
        if (rect.width * rect.height > 1800 && exposed < 0.35) {
          addIssue("blocker", "image-mostly-clipped", "La mayor parte de una imagen queda recortada por el layout.", selector, Math.round(exposed * 100) + "% visible; " + rectSummary(rect));
        } else if (rect.width * rect.height > 1800 && exposed < 0.65) {
          addIssue("warning", "image-partially-clipped", "Una imagen queda recortada de forma notable por el layout.", selector, Math.round(exposed * 100) + "% visible; " + rectSummary(rect));
        }

        const style = getComputedStyle(image);
        const sourceRatio = image.naturalWidth / image.naturalHeight;
        const boxRatio = rect.width / Math.max(rect.height, 1);
        const retained = Math.min(sourceRatio / boxRatio, boxRatio / sourceRatio);
        if (style.objectFit === "cover" && rect.width * rect.height > 2500 && retained < 0.18) {
          metrics.imageSeverelyCropped += 1;
          addIssue("warning", "image-cover-severe-crop", "El encuadre 'cover' elimina una parte excesiva de la imagen.", selector, Math.round(retained * 100) + "% del encuadre de origen retenido; " + rectSummary(rect));
        }

        const requiredWidth = rect.width * (viewport.deviceScaleFactor || 1) * 0.75;
        if (image.naturalWidth < requiredWidth && rect.width >= 160) {
          addIssue("warning", "image-resolution-low", "La resolucion de imagen es baja para su tamano renderizado.", selector, image.naturalWidth + "px de origen para " + Math.round(rect.width) + "px renderizados");
        }
      });

      if (metrics.imagesChecked > 0) passes.push(metrics.imagesChecked + " imagenes comprobadas: carga, resolucion, recorte y encuadre.");
    }

    function auditTextLegibility() {
      const checkedElements = new Set();
      const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const text = node.nodeValue.replace(/\\s+/g, " ").trim();
          const element = node.parentElement;
          if (text.length < 2 || !element || !isVisible(element) || ["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      let node;
      while ((node = walker.nextNode()) && checkedElements.size < 240) {
        const element = node.parentElement;
        if (checkedElements.has(element)) continue;
        checkedElements.add(element);
        metrics.textChecked += 1;
        const style = getComputedStyle(element);
        const fontSize = parseFloat(style.fontSize) || 16;
        const text = node.nodeValue.replace(/\\s+/g, " ").trim();
        const selector = selectorFor(element);
        const mobileMinimum = viewport.mobile ? 14 : viewport.name === "tablet" ? 13 : 12;

        if (fontSize < 10 && text.length > 3) {
          metrics.textTooSmall += 1;
          addIssue("blocker", "text-size-critical", "Texto demasiado pequeno para leerse con seguridad.", selector, trimText(text) + " (" + fontSize.toFixed(1) + "px; minimo " + mobileMinimum + "px)");
        } else if (fontSize < mobileMinimum && text.length > 3) {
          metrics.textTooSmall += 1;
          addIssue("warning", "text-size-small", "Texto por debajo del tamano recomendado para esta pantalla.", selector, trimText(text) + " (" + fontSize.toFixed(1) + "px; recomendado " + mobileMinimum + "px)");
        }

        const opacity = inheritedOpacity(element);
        if (opacity < 0.38) {
          addIssue("blocker", "text-opacity-critical", "La opacidad hace que el texto sea dificil de leer.", selector, trimText(text) + " (opacidad " + opacity.toFixed(2) + ")");
        } else if (opacity < 0.62) {
          addIssue("warning", "text-opacity-low", "La opacidad reduce demasiado la legibilidad del texto.", selector, trimText(text) + " (opacidad " + opacity.toFixed(2) + ")");
        }

        const lineHeight = parseFloat(style.lineHeight);
        if (Number.isFinite(lineHeight) && text.length > 28 && fontSize < 28) {
          const ratio = lineHeight / Math.max(fontSize, 1);
          if (ratio < 1.08) {
            addIssue("blocker", "line-height-critical", "Interlineado demasiado cerrado para un bloque de texto.", selector, trimText(text) + " (" + ratio.toFixed(2) + ")");
          } else if (ratio < 1.22) {
            addIssue("warning", "line-height-tight", "Interlineado ajustado que puede dificultar la lectura.", selector, trimText(text) + " (" + ratio.toFixed(2) + ")");
          }
        }

        const letterSpacing = parseFloat(style.letterSpacing);
        if (Number.isFinite(letterSpacing) && letterSpacing < -0.65 && text.length > 10 && fontSize < 28) {
          addIssue("warning", "letter-spacing-tight", "Espaciado de letras demasiado cerrado para lectura continua.", selector, trimText(text) + " (" + letterSpacing.toFixed(2) + "px)");
        }
      }
      if (metrics.textChecked > 0) passes.push(metrics.textChecked + " bloques de texto revisados: tamano, opacidad e interlineado.");
    }

    function auditTextClipping() {
      const seen = new Set();
      collectTextBlocks().forEach(({ element, text }) => {
        if (seen.has(element)) return;
        seen.add(element);
        const style = getComputedStyle(element);
        const selector = selectorFor(element);
        const isClipped = /hidden|clip/.test(style.overflowX + " " + style.overflowY);
        if (isClipped && (element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2)) {
          metrics.textClipped += 1;
          addIssue("blocker", "text-clipped", "El contenedor oculta parte de un texto visible.", selector, trimText(text) + "; contenido " + element.scrollWidth + "x" + element.scrollHeight + " frente a caja " + element.clientWidth + "x" + element.clientHeight);
        }

        const rect = element.getBoundingClientRect();
        const clipping = visibleRectWithinClippingAncestors(element, rect);
        const exposed = rect.width * rect.height ? (clipping.width * clipping.height) / (rect.width * rect.height) : 1;
        if (rect.width * rect.height > 420 && exposed < 0.45) {
          metrics.textClipped += 1;
          addIssue("blocker", "text-mostly-clipped", "Un bloque de texto queda mayoritariamente oculto por el layout.", selector, trimText(text) + "; " + Math.round(exposed * 100) + "% visible");
        }
      });
    }

    function auditTouchTargets() {
      if (!viewport.touch) return;
      getInteractiveElements().forEach((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) return;
        const minSize = Math.min(rect.width, rect.height);
        if (minSize < 40) {
          addIssue("warning", "touch-target-small", "Objetivo tactil pequeno para movil.", selectorFor(element), rectSummary(rect));
        }
      });
    }

    function auditOverlapAndOcclusion() {
      const interactive = getInteractiveElements()
        .filter((element) => intersectsViewport(element.getBoundingClientRect()));
      interactive.forEach((element) => {
        metrics.overlapChecked += 1;
        const blocker = coveringElement(element);
        if (blocker) {
          addIssue("blocker", "interactive-covered", "Elemento interactivo posiblemente tapado por otro elemento.", selectorFor(element), "Encima: " + selectorFor(blocker));
        }
      });

      const textBlocks = collectTextBlocks().slice(0, 140);
      textBlocks.forEach(({ element, text }) => {
        const rect = element.getBoundingClientRect();
        if (!intersectsViewport(rect)) return;
        const blocker = coveringElement(element);
        if (blocker) {
          addIssue("warning", "text-covered", "Texto posiblemente tapado por otro elemento.", selectorFor(element), trimText(text) + " / encima: " + selectorFor(blocker));
        }
      });
    }

    function auditTextContrast() {
      const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const text = node.nodeValue.replace(/\\s+/g, " ").trim();
          if (text.length < 2) return NodeFilter.FILTER_REJECT;
          const element = node.parentElement;
          if (!element || !isVisible(element)) return NodeFilter.FILTER_REJECT;
          if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });

      let node;
      let checked = 0;
      while ((node = walker.nextNode()) && checked < 240) {
        const element = node.parentElement;
        const style = getComputedStyle(element);
        const textColor = parseColor(style.color);
        const background = effectiveBackground(element);
        if (!textColor || !background) {
          metrics.contrastSkipped += 1;
          continue;
        }

        const ratio = contrastRatio(textColor, background);
        const fontSize = parseFloat(style.fontSize) || 16;
        const fontWeight = parseInt(style.fontWeight, 10) || 400;
        const largeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
        const threshold = largeText ? 3 : 4.5;
        checked += 1;

        if (ratio < threshold) {
          addIssue(ratio < 3 ? "blocker" : "warning", "contrast-low", "Contraste de texto por debajo de WCAG AA.", selectorFor(element), trimText(node.nodeValue) + " (" + ratio.toFixed(2) + ":1, minimo " + threshold + ":1)");
        }
      }

      metrics.contrastChecked = checked;
      if (checked > 0) passes.push(checked + " muestras de contraste revisadas.");
    }

    function getInteractiveElements() {
      return Array.from(document.querySelectorAll("a[href], button, input, select, textarea, summary, [tabindex], [role='button'], [role='link'], [contenteditable='true']"))
        .filter((element) => isVisible(element) && !element.disabled && element.getAttribute("aria-hidden") !== "true" && element.tabIndex !== -1);
    }

    function collectTextBlocks() {
      const blocks = [];
      const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const text = node.nodeValue.replace(/\\s+/g, " ").trim();
          if (text.length < 4) return NodeFilter.FILTER_REJECT;
          const element = node.parentElement;
          if (!element || !isVisible(element)) return NodeFilter.FILTER_REJECT;
          if (["SCRIPT", "STYLE", "NOSCRIPT"].includes(element.tagName)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      });
      let node;
      while ((node = walker.nextNode()) && blocks.length < 180) {
        blocks.push({ element: node.parentElement, text: node.nodeValue });
      }
      return blocks;
    }

    function coveringElement(element) {
      const rect = element.getBoundingClientRect();
      if (rect.width < 3 || rect.height < 3) return null;
      const points = samplePoints(rect);
      let covered = 0;
      let blocker = null;

      points.forEach(([x, y]) => {
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return;
        const top = document.elementFromPoint(x, y);
        if (!top) return;
        if (top === element || element.contains(top) || top.contains(element)) return;
        if (sameControl(element, top)) return;
        covered += 1;
        blocker = top;
      });

      return covered >= Math.max(1, Math.ceil(points.length / 2)) ? blocker : null;
    }

    function samplePoints(rect) {
      const insetX = Math.min(10, rect.width / 3);
      const insetY = Math.min(10, rect.height / 3);
      return [
        [rect.left + rect.width / 2, rect.top + rect.height / 2],
        [rect.left + insetX, rect.top + rect.height / 2],
        [rect.right - insetX, rect.top + rect.height / 2],
        [rect.left + rect.width / 2, rect.top + insetY],
        [rect.left + rect.width / 2, rect.bottom - insetY]
      ];
    }

    function sameControl(a, b) {
      const aControl = a.closest("a, button, label, [role='button'], [role='link']");
      const bControl = b.closest("a, button, label, [role='button'], [role='link']");
      return aControl && bControl && aControl === bControl;
    }

    function isVisible(element) {
      if (!element || !(element instanceof Element)) return false;
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden" || inheritedOpacity(element) === 0) return false;
      if (element.hidden || element.closest("[hidden], [aria-hidden='true']")) return false;
      const rects = element.getClientRects();
      return Array.from(rects).some((rect) => rect.width > 0.5 && rect.height > 0.5);
    }

    function visibleRectWithinClippingAncestors(element, rect) {
      let left = rect.left;
      let top = rect.top;
      let right = rect.right;
      let bottom = rect.bottom;
      let current = element.parentElement;
      while (current && current !== document.documentElement) {
        const style = getComputedStyle(current);
        if (/hidden|clip|scroll|auto/.test(style.overflow + " " + style.overflowX + " " + style.overflowY)) {
          const parent = current.getBoundingClientRect();
          left = Math.max(left, parent.left);
          top = Math.max(top, parent.top);
          right = Math.min(right, parent.right);
          bottom = Math.min(bottom, parent.bottom);
          if (right <= left || bottom <= top) return { width: 0, height: 0 };
        }
        current = current.parentElement;
      }
      return { width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
    }

    function inheritedOpacity(element) {
      let opacity = 1;
      let current = element;
      while (current && current instanceof Element) {
        opacity *= Number(getComputedStyle(current).opacity || 1);
        current = current.parentElement;
      }
      return Math.max(0, Math.min(1, opacity));
    }

    function intersectsViewport(rect) {
      return rect.bottom > 0 && rect.right > 0 && rect.left < innerWidth && rect.top < innerHeight;
    }

    function accessibleName(element) {
      const aria = element.getAttribute("aria-label");
      if (aria && aria.trim()) return aria.trim();

      const labelledBy = element.getAttribute("aria-labelledby");
      if (labelledBy) {
        const label = labelledBy.split(/\\s+/)
          .map((id) => document.getElementById(id)?.textContent || "")
          .join(" ")
          .replace(/\\s+/g, " ")
          .trim();
        if (label) return label;
      }

      if (element.id) {
        const label = document.querySelector("label[for='" + cssEscape(element.id) + "']");
        if (label?.textContent.trim()) return label.textContent.replace(/\\s+/g, " ").trim();
      }

      const wrappingLabel = element.closest("label");
      if (wrappingLabel?.textContent.trim()) return wrappingLabel.textContent.replace(/\\s+/g, " ").trim();

      const alt = element.getAttribute("alt");
      if (alt && alt.trim()) return alt.trim();

      const title = element.getAttribute("title");
      if (title && title.trim()) return title.trim();

      const text = element.textContent?.replace(/\\s+/g, " ").trim();
      if (text) return text;

      const placeholder = element.getAttribute("placeholder");
      if (placeholder && placeholder.trim()) return placeholder.trim();

      return "";
    }

    function effectiveBackground(element) {
      let current = element;
      while (current && current instanceof Element) {
        const style = getComputedStyle(current);
        const color = parseColor(style.backgroundColor);
        if (color && color.a >= 0.85) return color;
        if (style.backgroundImage && style.backgroundImage !== "none" && !style.backgroundImage.startsWith("linear-gradient")) {
          return null;
        }
        current = current.parentElement;
      }
      return { r: 255, g: 255, b: 255, a: 1 };
    }

    function parseColor(value) {
      if (!value || value === "transparent") return null;
      const match = value.match(/rgba?\\(([^)]+)\\)/i);
      if (!match) return null;
      const parts = match[1].split(",").map((part) => part.trim());
      if (parts.length < 3) return null;
      return {
        r: Number(parts[0]),
        g: Number(parts[1]),
        b: Number(parts[2]),
        a: parts.length > 3 ? Number(parts[3]) : 1
      };
    }

    function contrastRatio(a, b) {
      const light = Math.max(luminance(a), luminance(b));
      const dark = Math.min(luminance(a), luminance(b));
      return (light + 0.05) / (dark + 0.05);
    }

    function luminance(color) {
      const channels = [color.r, color.g, color.b].map((channel) => {
        const value = channel / 255;
        return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    }

    function addIssue(severity, code, message, selector, context) {
      const count = limits.get(code) || 0;
      if (count >= maxPerCode) return;
      limits.set(code, count + 1);
      issues.push({ severity, code, message, selector, context: String(context || "") });
    }

    function selectorFor(element) {
      if (!element || !(element instanceof Element)) return "";
      if (element.id) return "#" + cssEscape(element.id);
      const dataId = element.getAttribute("data-testid") || element.getAttribute("data-section-key") || element.getAttribute("name");
      if (dataId) return element.tagName.toLowerCase() + "[" + (element.getAttribute("data-testid") ? "data-testid" : element.getAttribute("data-section-key") ? "data-section-key" : "name") + "='" + dataId.replace(/'/g, "\\\\'") + "']";

      const parts = [];
      let current = element;
      while (current && current !== document.body && parts.length < 4) {
        let part = current.tagName.toLowerCase();
        if (current.classList.length) {
          part += "." + Array.from(current.classList).slice(0, 2).map(cssEscape).join(".");
        }
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
          if (siblings.length > 1) part += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
        }
        parts.unshift(part);
        current = parent;
      }
      return parts.join(" > ");
    }

    function cssEscape(value) {
      return window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\\\$&");
    }

    function rectSummary(rect) {
      return Math.round(rect.width) + "x" + Math.round(rect.height) + " en " + Math.round(rect.left) + "," + Math.round(rect.top);
    }

    function trimText(value) {
      return String(value || "").replace(/\\s+/g, " ").trim().slice(0, 90);
    }
  })()`;
}

function focusStateSource() {
  return `(() => {
    const element = document.activeElement;
    if (!element || element === document.documentElement) return { selector: "", text: "", focusVisible: false, inViewport: false };
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const outlineWidth = parseFloat(style.outlineWidth) || 0;
    const outlineVisible = style.outlineStyle !== "none" && outlineWidth >= 1 && !isTransparent(style.outlineColor);
    const shadowVisible = style.boxShadow && style.boxShadow !== "none" && !/rgba\\(0, 0, 0, 0\\)/.test(style.boxShadow);
    const filterVisible = style.filter && style.filter !== "none";
    const focusVisible = outlineVisible || shadowVisible || filterVisible;
    return {
      selector: selectorFor(element),
      text: accessibleName(element).slice(0, 90),
      focusVisible,
      inViewport: rect.bottom > 0 && rect.right > 0 && rect.left < innerWidth && rect.top < innerHeight,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    };

    function accessibleName(target) {
      const aria = target.getAttribute("aria-label");
      if (aria && aria.trim()) return aria.trim();
      const labelledBy = target.getAttribute("aria-labelledby");
      if (labelledBy) {
        const label = labelledBy.split(/\\s+/)
          .map((id) => document.getElementById(id)?.textContent || "")
          .join(" ")
          .replace(/\\s+/g, " ")
          .trim();
        if (label) return label;
      }
      if (target.id) {
        const label = document.querySelector("label[for='" + cssEscape(target.id) + "']");
        if (label?.textContent.trim()) return label.textContent.replace(/\\s+/g, " ").trim();
      }
      const text = target.textContent?.replace(/\\s+/g, " ").trim();
      if (text) return text;
      return target.getAttribute("title") || target.getAttribute("placeholder") || target.tagName.toLowerCase();
    }

    function selectorFor(target) {
      if (target.id) return "#" + cssEscape(target.id);
      const name = target.getAttribute("name");
      if (name) return target.tagName.toLowerCase() + "[name='" + name.replace(/'/g, "\\\\'") + "']";
      const parts = [];
      let current = target;
      while (current && current !== document.body && parts.length < 4) {
        let part = current.tagName.toLowerCase();
        if (current.classList.length) part += "." + Array.from(current.classList).slice(0, 2).map(cssEscape).join(".");
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter((child) => child.tagName === current.tagName);
          if (siblings.length > 1) part += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
        }
        parts.unshift(part);
        current = parent;
      }
      return parts.join(" > ") || target.tagName.toLowerCase();
    }

    function cssEscape(value) {
      return window.CSS?.escape ? CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\\\$&");
    }

    function isTransparent(value) {
      return !value || value === "transparent" || /rgba\\([^)]*,\\s*0\\)/.test(value);
    }
  })()`;
}

function buildReport({ targetUrl: url, outDir: outputDirectory, viewports: runs }) {
  const allIssues = runs.flatMap((run) => run.issues);
  return {
    generatedAt: new Date().toISOString(),
    targetUrl: url,
    outputDirectory,
    totals: {
      viewports: runs.length,
      blockers: allIssues.filter((issue) => issue.severity === "blocker").length,
      warnings: allIssues.filter((issue) => issue.severity === "warning").length,
      info: allIssues.filter((issue) => issue.severity === "info").length
    },
    viewports: runs
  };
}

function renderHtmlReport(report) {
  const issueRows = report.viewports.map((run) => {
    const rows = run.issues.length
      ? run.issues.map((issue) => `
          <tr>
            <td><span class="pill ${escapeHtml(issue.severity)}">${escapeHtml(issue.severity)}</span></td>
            <td><code>${escapeHtml(issue.code)}</code></td>
            <td>${escapeHtml(issue.message)}</td>
            <td><code>${escapeHtml(issue.selector)}</code></td>
            <td>${escapeHtml(issue.context)}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="5" class="empty">Sin incidencias detectadas.</td></tr>`;

    const passes = run.passes.length
      ? `<ul>${run.passes.map((pass) => `<li>${escapeHtml(pass)}</li>`).join("")}</ul>`
      : `<p class="muted">Sin comprobaciones positivas registradas.</p>`;

    return `
      <section>
        <h2>${escapeHtml(run.viewport.name)} ${run.viewport.width}x${run.viewport.height}</h2>
        <div class="screenshot">
          <img src="${escapeHtml(run.screenshot.filename)}" alt="Captura ${escapeHtml(run.viewport.name)}">
        </div>
        <div class="grid">
          <div>
            <h3>Resumen</h3>
            <p><strong>${run.issues.filter((issue) => issue.severity === "blocker").length}</strong> bloqueos,
            <strong>${run.issues.filter((issue) => issue.severity === "warning").length}</strong> avisos.</p>
            <p class="muted">Ancho documento: ${run.metrics.scrollWidth}px / ventana: ${run.metrics.clientWidth}px. Contraste CSS: ${run.metrics.contrastChecked} muestras; contraste sobre pixeles: ${run.metrics.renderedContrastChecked || 0}; zonas recorridas: ${run.metrics.deepScanCheckpoints || 0}.</p>
            ${passes}
          </div>
          <div>
            <h3>Incidencias</h3>
            <table>
              <thead>
                <tr><th>Severidad</th><th>Codigo</th><th>Mensaje</th><th>Selector</th><th>Contexto</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>
      </section>
    `;
  }).join("");

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>QA visual y accesibilidad</title>
  <style>
    :root { color-scheme: light; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #17202a; background: #f6f7f9; }
    body { margin: 0; padding: 32px; }
    header, section { max-width: 1180px; margin: 0 auto 28px; }
    h1, h2, h3 { margin: 0 0 12px; line-height: 1.15; letter-spacing: 0; }
    p { margin: 0 0 12px; }
    code { background: #eef1f5; border-radius: 4px; padding: 2px 5px; }
    .summary { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 18px; }
    .metric { background: #fff; border: 1px solid #dfe4ea; border-radius: 8px; padding: 14px 16px; min-width: 150px; }
    .metric strong { display: block; font-size: 28px; }
    .grid { display: grid; grid-template-columns: minmax(220px, 0.7fr) minmax(0, 1.3fr); gap: 18px; align-items: start; }
    .screenshot { background: #fff; border: 1px solid #dfe4ea; border-radius: 8px; padding: 10px; margin: 14px 0; max-height: 760px; overflow: auto; }
    .screenshot img { display: block; max-width: 100%; height: auto; }
    table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #dfe4ea; border-radius: 8px; overflow: hidden; }
    th, td { padding: 9px 10px; border-bottom: 1px solid #edf0f3; text-align: left; vertical-align: top; font-size: 14px; }
    th { background: #f0f3f6; }
    .pill { display: inline-block; border-radius: 999px; padding: 3px 8px; font-size: 12px; font-weight: 700; }
    .blocker { background: #ffe4e0; color: #8f1d10; }
    .warning { background: #fff2c9; color: #6f4d00; }
    .info { background: #dff3ff; color: #0f5275; }
    .muted, .empty { color: #667085; }
    @media (max-width: 820px) {
      body { padding: 18px; }
      .grid { grid-template-columns: 1fr; }
      table { display: block; overflow-x: auto; }
    }
  </style>
</head>
<body>
  <header>
    <h1>QA visual y accesibilidad</h1>
    <p>URL auditada: <code>${escapeHtml(report.targetUrl)}</code></p>
    <p class="muted">Generado: ${escapeHtml(report.generatedAt)}</p>
    <div class="summary">
      <div class="metric"><strong>${report.totals.viewports}</strong> viewports</div>
      <div class="metric"><strong>${report.totals.blockers}</strong> bloqueos</div>
      <div class="metric"><strong>${report.totals.warnings}</strong> avisos</div>
    </div>
  </header>
  ${issueRows}
</body>
</html>
`;
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch (error) {
      // Try the next common browser path.
    }
  }
  throw new Error("Chrome or Edge is required for visual/accessibility QA. Set CHROME_PATH if needed.");
}

async function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const selectedPort = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(selectedPort));
    });
  });
}

async function waitForUrl(url, timeout = 14_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (error) {
      // Server is still starting.
    }
    await delay(120);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForPage(portNumber, target = "", timeout = 12_000) {
  const started = Date.now();
  const targetPath = target ? new URL(target).pathname : "";
  while (Date.now() - started < timeout) {
    try {
      const pages = await fetch(`http://127.0.0.1:${portNumber}/json`).then((response) => response.json());
      const page = pages.find((item) => {
        if (item.type !== "page") return false;
        return !targetPath || item.url === target || item.url.includes(targetPath);
      }) || pages.find((item) => item.type === "page");
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
    const { resolve, reject, method, params, timer } = pending.get(message.id);
    clearTimeout(timer);
    pending.delete(message.id);
    message.error ? reject(new Error(`${method}: ${message.error.message}${describeCdpParams(params)}`)) : resolve(message.result);
  });
  socket.addEventListener("close", () => rejectPending("Chrome DevTools socket closed"));
  socket.addEventListener("error", () => rejectPending("Chrome DevTools socket errored"));

  return {
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!pending.has(id)) return;
          pending.delete(id);
          reject(new Error(`${method}: timed out waiting for Chrome DevTools${describeCdpParams(params)}`));
        }, 15_000);
        pending.set(id, { resolve, reject, method, params, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    }
  };

  function rejectPending(message) {
    pending.forEach(({ reject, method, params, timer }) => {
      clearTimeout(timer);
      reject(new Error(`${method}: ${message}${describeCdpParams(params)}`));
    });
    pending.clear();
  }
}

async function evaluateObject(expression) {
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
    if (await evaluateObject(expression)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}`);
}

function parseArgs(args) {
  const parsed = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
    } else if (arg === "--debug") {
      parsed.debug = true;
    } else if (arg === "--fail-on-warnings") {
      parsed.failOnWarnings = true;
    } else if (arg.startsWith("--")) {
      const [key, inlineValue] = arg.slice(2).split("=", 2);
      const value = inlineValue ?? args[index + 1];
      if (inlineValue === undefined) index += 1;
      parsed[toCamelCase(key)] = value;
    }
  }
  return parsed;
}

function parseViewportOption(value) {
  if (!value) return defaultViewports;
  const names = String(value).split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  const presets = new Map(defaultViewports.map((viewport) => [viewport.name, viewport]));
  const selected = names.flatMap((name) => name === "mobile"
    ? [presets.get("mobile"), presets.get("mobile-narrow")]
    : [presets.get(name)]).filter(Boolean);
  return selected.length ? selected : defaultViewports;
}

function normalizeRoute(value) {
  const route = String(value || defaultRoute);
  return route.startsWith("/") ? route : `/${route}`;
}

function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function addIssue(issues, severity, code, message, selector, context) {
  issues.push({ severity, code, message, selector, context: String(context || "") });
}

function safeFileName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-|-$/g, "") || "viewport";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function describeCdpParams(params) {
  const expression = params?.expression;
  return expression ? `\nExpression: ${String(expression).slice(0, 260)}` : "";
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trace(message) {
  if (debug) console.log(message);
}

function printHelp() {
  console.log(`QA visual y accesibilidad

Uso:
  npm.cmd run qa:visual
  npm.cmd run qa:visual -- --url=http://127.0.0.1:5173/workspace.html?presentation=true
  npm.cmd run qa:visual -- --path=/pages/business-dashboard.html --viewports=desktop,tablet,mobile

Opciones:
  --url URL               Audita una URL ya levantada. Si no se pasa, arranca server/server.mjs.
  --path RUTA             Ruta local para auditar con servidor automatico. Default: ${defaultRoute}
  --out DIR               Carpeta de capturas y reporte. Default: .tmp-qa-visual
  --viewports LISTA       Presets separados por coma: desktop,tablet,mobile
  --fail-on-warnings      Devuelve codigo 1 tambien con avisos.
  --debug                 Muestra logs del servidor y navegador.
`);
}
