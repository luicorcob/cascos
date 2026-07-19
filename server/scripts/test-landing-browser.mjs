import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const port = 6400 + Math.floor(Math.random() * 500);
const debugPort = 9400 + Math.floor(Math.random() * 500);
const baseUrl = `http://127.0.0.1:${port}`;
const landingUrl = `${baseUrl}/index.html`;
const profile = await mkdtemp(path.join(os.tmpdir(), "dls-landing-browser-"));
const screenshotDirectory = process.env.LANDING_BROWSER_SCREENSHOTS
  ? path.resolve(process.env.LANDING_BROWSER_SCREENSHOTS)
  : "";
const chrome = await findChrome();
const server = spawn(process.execPath, ["server/server.mjs"], {
  cwd: root,
  env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
  stdio: "ignore",
  windowsHide: true
});

let browser;
let cdp;

try {
  if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true });
  await waitForUrl(landingUrl);
  await assertStaticDelivery();

  browser = spawn(
    chrome,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-background-timer-throttling",
      "--disable-renderer-backgrounding",
      "--no-first-run",
      "--no-default-browser-check",
      "--use-angle=swiftshader",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      "about:blank"
    ],
    { stdio: "ignore", windowsHide: true }
  );

  const page = await waitForPage(debugPort);
  cdp = await createCdpClient(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `
      try {
        Object.defineProperty(navigator, "hardwareConcurrency", { configurable: true, get: () => 8 });
        Object.defineProperty(navigator, "deviceMemory", { configurable: true, get: () => 8 });
      } catch {}
      window.__dlsLandingErrors = [];
      window.addEventListener("error", (event) => {
        window.__dlsLandingErrors.push(String(event.error?.stack || event.message || "window error"));
      });
      window.addEventListener("unhandledrejection", (event) => {
        window.__dlsLandingErrors.push(String(event.reason?.stack || event.reason || "unhandled rejection"));
      });
    `
  });

  await auditDesktop();
  await auditDesktopProcess();
  await auditMobile();
  await auditMobileProcess();
  await auditReducedMotion();
  await auditWorkspaceEntry();

  console.log("Landing browser checks passed: desktop, anchors, mobile, reduced motion and Studio entry.");
} finally {
  try {
    await cdp?.send("Browser.close");
  } catch {
    browser?.kill();
  }
  cdp?.close();
  server.kill();
  await delay(250);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
}

async function assertStaticDelivery() {
  const htmlResponse = await fetch(landingUrl, {
    headers: { "Accept-Encoding": "br, gzip" }
  });
  assert.equal(htmlResponse.status, 200);
  assert.equal(htmlResponse.headers.get("content-encoding"), "br");
  assert.match(htmlResponse.headers.get("cache-control") || "", /no-cache/);
  await htmlResponse.arrayBuffer();

  const scriptResponse = await fetch(`${baseUrl}/src/landing-experience.js`, {
    headers: { "Accept-Encoding": "br, gzip" }
  });
  assert.equal(scriptResponse.status, 200);
  assert.equal(scriptResponse.headers.get("content-encoding"), "br");
  assert.match(scriptResponse.headers.get("cache-control") || "", /max-age=86400/);
  await scriptResponse.arrayBuffer();

  const frameResponse = await fetch(`${baseUrl}/assets/landing/sequence/frame-090.webp`);
  assert.equal(frameResponse.status, 200);
  assert.match(frameResponse.headers.get("cache-control") || "", /immutable/);
  assert.equal(frameResponse.headers.get("content-type"), "image/webp");
  await frameResponse.arrayBuffer();
}

async function auditDesktop() {
  await setViewport(1440, 1000, false);
  await cdp.send("Emulation.setEmulatedMedia", { media: "", features: [] });
  await navigateAndWait(landingUrl);
  await waitForExpression(`
    document.querySelector("#dlsLanding")?.classList.contains("is-motion-ready") ||
    document.querySelector("#dlsLanding")?.classList.contains("is-motion-fallback")
  `);
  await waitForExpression(`
    document.querySelector("#demostracion")?.classList.contains("is-story-ready") ||
    document.querySelector("#demostracion")?.classList.contains("is-story-fallback")
  `, 25_000);

  const layout = await evaluateObject(`(() => {
    const root = document.querySelector("#dlsLanding");
    const scroller = document.querySelector(".dls-landing-scroll");
    const title = document.querySelector("[data-hero-title]").getBoundingClientRect();
    const story = document.querySelector("#demostracion");
    return {
      errors: window.__dlsLandingErrors,
      widthOverflow: scroller.scrollWidth - scroller.clientWidth,
      scrollRatio: scroller.scrollHeight / scroller.clientHeight,
      titleLeft: title.left,
      titleRight: title.right,
      titleText: (
        document.querySelector("[data-hero-title]").getAttribute("aria-label") ||
        document.querySelector("[data-hero-title]").textContent
      ).replace(/\\s+/g, " ").trim(),
      storyReady: story.classList.contains("is-story-ready"),
      storyFallback: story.classList.contains("is-story-fallback"),
      developerHref: document.querySelector('[href*="mode=developer"]').getAttribute("href"),
      clientHref: document.querySelector('[href*="mode=client"]').getAttribute("href"),
      hasWebglOrFallback:
        root.classList.contains("has-webgl") || root.classList.contains("is-webgl-fallback")
    };
  })()`);

  assert.deepEqual(layout.errors, []);
  if (process.env.LANDING_BROWSER_DEBUG) {
    console.log("Desktop landing state:", layout);
  }
  assert.ok(layout.widthOverflow <= 1, `Desktop horizontal overflow: ${layout.widthOverflow}px`);
  assert.ok(layout.scrollRatio > 8, `Landing is unexpectedly short: ${layout.scrollRatio.toFixed(1)} viewports`);
  assert.ok(layout.titleLeft >= 0 && layout.titleRight <= 1440);
  assert.equal(layout.titleText, "Creamos, alojamos y hacemos crecer tu negocio local");
  assert.ok(layout.storyReady || layout.storyFallback);
  assert.equal(layout.developerHref, "workspace.html?hub=1&mode=developer");
  assert.equal(layout.clientHref, "workspace.html?hub=1&mode=client");
  assert.equal(layout.hasWebglOrFallback, true);

  if (layout.storyReady) {
    const hostingTop = await clickStoryAnchor("#hosting");
    const hostingFrame = await currentStoryFrame();
    const crmTop = await clickStoryAnchor("#crm");
    const crmFrame = await currentStoryFrame();
    const pinnedStory = await evaluateObject(`(() => {
      const stage = document.querySelector(".dls-story-stage").getBoundingClientRect();
      const stageElement = document.querySelector(".dls-story-stage");
      const visual = document.querySelector(".dls-story-visual").getBoundingClientRect();
      const active = document.querySelector(".dls-story-step.is-active")?.getBoundingClientRect();
      const spacerElement = stageElement.parentElement;
      const spacer = spacerElement.getBoundingClientRect();
      const trigger = window.ScrollTrigger?.getById?.("dls-landing-story");
      return {
        scrollTop: document.querySelector(".dls-landing-scroll").scrollTop,
        stageTop: stage.top,
        stageBottom: stage.bottom,
        stagePosition: getComputedStyle(stageElement).position,
        stageTransform: getComputedStyle(stageElement).transform,
        stageInline: stageElement.getAttribute("style"),
        spacerTop: spacer.top,
        spacerBottom: spacer.bottom,
        spacerInline: spacerElement.getAttribute("style"),
        visualTop: visual.top,
        visualBottom: visual.bottom,
        activeTop: active?.top,
        activeBottom: active?.bottom,
        triggerStart: trigger?.start,
        triggerEnd: trigger?.end,
        triggerProgress: trigger?.progress,
        triggerActive: trigger?.isActive
      };
    })()`);
    if (process.env.LANDING_BROWSER_DEBUG) console.log("Pinned story state:", pinnedStory);
    assert.ok(crmTop > hostingTop + 500, "CRM and Hosting anchors must land at distinct story moments");
    assert.ok(hostingFrame >= 28 && hostingFrame <= 46, `Unexpected Hosting frame: ${hostingFrame}`);
    assert.ok(crmFrame >= 56 && crmFrame <= 78, `Unexpected CRM frame: ${crmFrame}`);
    assert.equal(pinnedStory.triggerActive, true);
    assert.ok(
      pinnedStory.visualTop < 500 && pinnedStory.visualBottom > 500,
      "The pinned story visual must remain meaningfully inside the viewport"
    );
    assert.ok(
      pinnedStory.activeTop < 850 && pinnedStory.activeBottom > 100,
      "The active story copy must remain visible while scrubbing"
    );
    await captureScreenshot("desktop-crm");
  }
}

async function auditMobile() {
  await setViewport(390, 844, true);
  await cdp.send("Emulation.setEmulatedMedia", { media: "", features: [] });
  await navigateAndWait(landingUrl);
  await waitForExpression(`
    document.querySelector("#dlsLanding")?.classList.contains("is-motion-ready") &&
    document.querySelector("[data-hero-title]")?.classList.contains("is-title-revealed") &&
    (
      document.querySelector("#demostracion")?.classList.contains("is-story-ready") ||
      document.querySelector("#demostracion")?.classList.contains("is-story-fallback")
    )
  `, 25_000);

  const state = await evaluateObject(`(() => {
    const scroller = document.querySelector(".dls-landing-scroll");
    const primary = document.querySelector(".dls-hero-actions .dls-button-primary").getBoundingClientRect();
    const product = document.querySelector(".dls-hero-product").getBoundingClientRect();
    const story = document.querySelector("#demostracion");
    const title = document.querySelector("[data-hero-title]");
    return {
      errors: window.__dlsLandingErrors,
      widthOverflow: scroller.scrollWidth - scroller.clientWidth,
      scrollRatio: scroller.scrollHeight / scroller.clientHeight,
      desktopStory: getComputedStyle(document.querySelector(".dls-story-desktop")).display,
      mobileStory: getComputedStyle(document.querySelector(".dls-story-mobile")).display,
      storyReady: story.classList.contains("is-story-ready"),
      canvasHidden: document.querySelector("#dlsStoryCanvas").hidden,
      productDisplay: getComputedStyle(document.querySelector(".dls-hero-product")).display,
      productLeft: product.left,
      productRight: product.right,
      primaryHeight: primary.height,
      primaryWidth: primary.width,
      titleRevealed: title.classList.contains("is-title-revealed"),
      titleLineOverflow: Array.from(title.querySelectorAll(".dls-hero-line"))
        .map((line) => getComputedStyle(line).overflow),
      heavyFramesRequested: performance.getEntriesByType("resource")
        .filter((entry) => /sequence\\/frame-\\d{3}\\.webp/.test(entry.name)).length
    };
  })()`);

  assert.deepEqual(state.errors, []);
  assert.ok(state.widthOverflow <= 1, `Mobile horizontal overflow: ${state.widthOverflow}px`);
  assert.ok(state.scrollRatio > 10);
  assert.equal(state.storyReady, true);
  assert.notEqual(state.desktopStory, "none");
  assert.equal(state.mobileStory, "none");
  assert.equal(state.canvasHidden, false);
  assert.notEqual(state.productDisplay, "none");
  assert.ok(state.productLeft >= 0 && state.productRight <= 390);
  assert.ok(state.primaryHeight >= 44 && state.primaryWidth >= 44);
  assert.equal(state.titleRevealed, true);
  assert.ok(
    state.titleLineOverflow.length > 0 &&
      state.titleLineOverflow.every((overflow) => overflow === "visible"),
    `Mobile title lines still clip their text: ${state.titleLineOverflow.join(", ")}`
  );
  assert.ok(
    state.heavyFramesRequested >= 85,
    `Mobile loaded only ${state.heavyFramesRequested} frames from the full story sequence`
  );
  await captureScreenshot("mobile-hero");

  const storyRange = await evaluateObject(`(() => {
    const trigger = window.ScrollTrigger.getById("dls-landing-story");
    return { start: trigger.start, end: trigger.end };
  })()`);
  await evaluateObject(`(() => {
    const scroller = document.querySelector(".dls-landing-scroll");
    scroller.scrollTop = ${storyRange.start} + (${storyRange.end} - ${storyRange.start}) * 0.56;
    window.ScrollTrigger.update();
    return scroller.scrollTop;
  })()`);
  await delay(700);

  const storyProgress = await evaluateObject(`(() => {
    const visual = document.querySelector(".dls-story-visual").getBoundingClientRect();
    const frame = Number(document.querySelector("[data-story-frame]").textContent.match(/\\d+/)?.[0] || 0);
    return {
      frame,
      visualTop: visual.top,
      visualBottom: visual.bottom,
      activeStep: Array.from(document.querySelectorAll("[data-story-step]"))
        .findIndex((step) => step.classList.contains("is-active"))
    };
  })()`);
  assert.ok(
    storyProgress.frame >= 45 && storyProgress.frame <= 58,
    `Mobile story did not scrub to the expected frame: ${storyProgress.frame}`
  );
  assert.ok(storyProgress.activeStep >= 2 && storyProgress.activeStep <= 3);
  assert.ok(
    storyProgress.visualTop < 600 && storyProgress.visualBottom > 72,
    "The mobile story canvas must remain visible while scrubbing"
  );
  await captureScreenshot("mobile-story");
}

async function auditDesktopProcess() {
  await setViewport(1440, 1000, false);
  await cdp.send("Emulation.setEmulatedMedia", { media: "", features: [] });
  await navigateAndWait(`${landingUrl}?process=desktop`);
  await waitForExpression(`
    document.querySelector("#dlsLanding")?.classList.contains("is-motion-ready") &&
    Boolean(window.ScrollTrigger?.getById?.("dls-landing-timeline")) &&
    (
      document.querySelector("#demostracion")?.classList.contains("is-story-ready") ||
      document.querySelector("#demostracion")?.classList.contains("is-story-fallback")
    )
  `);
  await evaluateObject(`document.querySelector('a[href="#como-funciona"]').click()`);
  await waitForExpression(`window.location.hash === "#como-funciona"`);
  await delay(2200);
  await evaluateObject(
    `(() => {
      window.ScrollTrigger.getById("dls-landing-timeline").animation.progress(0.12);
      return true;
    })()`
  );
  const early = await readProcessState();

  await evaluateObject(
    `(() => {
      window.ScrollTrigger.getById("dls-landing-timeline").animation.progress(0.9);
      return true;
    })()`
  );
  const late = await readProcessState();

  assert.deepEqual(late.errors, []);
  assert.equal(late.phaseCount, 4);
  assert.ok(late.widthOverflow <= 1, `Desktop process overflow: ${late.widthOverflow}px`);
  assert.ok(late.stageLeft >= 0 && late.stageRight <= 1440);
  assert.ok(late.pathLength > 500);
  assert.ok(early.activeIndex <= 1, `Unexpected early process phase: ${early.activeIndex}`);
  assert.ok(late.activeIndex >= 2, `Process did not advance: ${late.activeIndex}`);
  assert.ok(
    late.dashOffset < early.dashOffset,
    `Process route did not draw: ${early.dashOffset} -> ${late.dashOffset}`
  );
  assert.notEqual(late.signalTransform, "");
  await captureScreenshot("desktop-process");
}

async function auditMobileProcess() {
  await setViewport(390, 844, true);
  await cdp.send("Emulation.setEmulatedMedia", { media: "", features: [] });
  await navigateAndWait(`${landingUrl}?process=mobile#como-funciona`);
  await waitForExpression(`
    document.querySelector("#dlsLanding")?.classList.contains("is-motion-ready") &&
    Boolean(window.ScrollTrigger?.getById?.("dls-landing-timeline"))
  `);

  const range = await evaluateObject(`(() => {
    const trigger = window.ScrollTrigger.getById("dls-landing-timeline");
    return { start: trigger.start, end: trigger.end };
  })()`);
  await evaluateObject(`(() => {
    const scroller = document.querySelector(".dls-landing-scroll");
    scroller.scrollTop = ${range.start} + (${range.end} - ${range.start}) * 0.74;
    window.ScrollTrigger.update();
    window.ScrollTrigger.getById("dls-landing-timeline").animation.progress(0.74);
    return scroller.scrollTop;
  })()`);
  await delay(1000);
  await evaluateObject(
    `(() => {
      window.ScrollTrigger.getById("dls-landing-timeline").animation.progress(0.74);
      return true;
    })()`
  );

  const state = await readProcessState();
  const mobile = await evaluateObject(`(() => {
    const route = document.querySelector(".dls-process-route");
    const compact = document.querySelector(".dls-process-compact-route");
    const module = document.querySelector(".dls-process-module").getBoundingClientRect();
    return {
      routeDisplay: getComputedStyle(route).display,
      compactDisplay: getComputedStyle(compact).display,
      moduleLeft: module.left,
      moduleRight: module.right
    };
  })()`);

  assert.deepEqual(state.errors, []);
  assert.ok(state.widthOverflow <= 1, `Mobile process overflow: ${state.widthOverflow}px`);
  assert.equal(state.phaseCount, 4);
  assert.ok(state.activeIndex >= 1);
  assert.equal(mobile.routeDisplay, "none");
  assert.notEqual(mobile.compactDisplay, "none");
  assert.ok(mobile.moduleLeft >= 0 && mobile.moduleRight <= 390);
  await captureScreenshot("mobile-process");
}

async function auditReducedMotion() {
  await setViewport(1440, 1000, false);
  await cdp.send("Emulation.setEmulatedMedia", {
    media: "",
    features: [{ name: "prefers-reduced-motion", value: "reduce" }]
  });
  await navigateAndWait(`${landingUrl}?motion=reduce`);
  await waitForExpression(`document.querySelector("#dlsLanding")?.classList.contains("is-motion-reduced")`);

  const state = await evaluateObject(`(() => ({
    errors: window.__dlsLandingErrors,
    reduced: document.querySelector("#dlsLanding").classList.contains("is-motion-reduced"),
    canvasHidden: document.querySelector("#dlsStoryCanvas").hidden,
    mobileStory: getComputedStyle(document.querySelector(".dls-story-mobile")).display,
    threeRequested: performance.getEntriesByType("resource")
      .some((entry) => entry.name.includes("three.module.min.js"))
  }))()`);

  assert.deepEqual(state.errors, []);
  assert.equal(state.reduced, true);
  assert.equal(state.canvasHidden, true);
  assert.notEqual(state.mobileStory, "none");
  assert.equal(state.threeRequested, false);
}

async function auditWorkspaceEntry() {
  await setViewport(1440, 1000, false);
  await cdp.send("Emulation.setEmulatedMedia", { media: "", features: [] });
  await navigateAndWait(`${baseUrl}/workspace.html?hub=1&mode=developer`);
  await waitForExpression(`
    document.documentElement.dataset.studioReady === "true" ||
    Boolean(document.documentElement.dataset.studioError)
  `, 25_000);

  const state = await evaluateObject(`(() => ({
    errors: window.__dlsLandingErrors,
    ready: document.documentElement.dataset.studioReady,
    studioError: document.documentElement.dataset.studioError || "",
    gateHidden: document.querySelector("#introGate").hidden,
    hubHidden: document.querySelector("#introHub").hidden,
    developerSelected:
      document.querySelector('[data-intro-mode="developer"]').getAttribute("aria-selected"),
    developerPanelHidden: document.querySelector('[data-intro-mode-panel="developer"]').hidden,
    startButtonMissing: document.querySelector("#introStartButton") === null,
    legacyIntroMissing: document.querySelector(".intro-gate-content") === null,
    logoInsideHelp:
      document.querySelector("[data-intro-help-logo] .intro-logo-stage") !== null
  }))()`);

  assert.deepEqual(state.errors, []);
  assert.equal(state.ready, "true");
  assert.equal(state.studioError, "");
  assert.equal(state.gateHidden, false);
  assert.equal(state.hubHidden, false);
  assert.equal(state.developerSelected, "true");
  assert.equal(state.developerPanelHidden, false);
  assert.equal(state.startButtonMissing, true);
  assert.equal(state.legacyIntroMissing, true);
  assert.equal(state.logoInsideHelp, true);

  await evaluateObject(`document.querySelector("#introHelpButton").click()`);
  await waitForExpression(`document.querySelector("#introHelpModal").hidden === false`);
  const help = await evaluateObject(`(() => {
    const modal = document.querySelector("#introHelpModal");
    const showcase = modal.querySelector("[data-intro-help-logo]");
    const stage = showcase.querySelector(".intro-logo-stage");
    const firstCommand = modal.querySelector(".intro-help-command-group");
    const tube = stage.querySelector(".intro-tube");
    const rect = stage.getBoundingClientRect();
    return {
      modalHidden: modal.hidden,
      stageWidth: rect.width,
      stageHeight: rect.height,
      logoBeforeCommands: Boolean(
        showcase.compareDocumentPosition(firstCommand) & Node.DOCUMENT_POSITION_FOLLOWING
      ),
      animationName: getComputedStyle(tube).animationName
    };
  })()`);
  assert.equal(help.modalHidden, false);
  assert.ok(help.stageWidth > 300 && help.stageHeight > 200);
  assert.equal(help.logoBeforeCommands, true);
  assert.match(help.animationName, /introTubeDraw/);
  await captureScreenshot("workspace-info");

  await evaluateObject(`
    document.querySelector("[data-intro-help-close]").click();
    document.querySelector('[data-intro-mode="client"]').click();
  `);
  const clientMode = await evaluateObject(`(() => ({
    selected: document.querySelector('[data-intro-mode="client"]').getAttribute("aria-selected"),
    panelHidden: document.querySelector('[data-intro-mode-panel="client"]').hidden
  }))()`);
  assert.equal(clientMode.selected, "true");
  assert.equal(clientMode.panelHidden, false);
}

async function clickStoryAnchor(hash) {
  await evaluateObject(`document.querySelector('a[href="${hash}"]').click()`);
  await waitForExpression(`window.location.hash === "${hash}"`);
  await delay(1500);
  return evaluateObject(`document.querySelector(".dls-landing-scroll").scrollTop`);
}

async function currentStoryFrame() {
  const label = await evaluateObject(`document.querySelector("[data-story-frame]").textContent`);
  return Number(String(label).match(/\d+/)?.[0] || 0);
}

async function readProcessState() {
  return evaluateObject(`(() => {
    const scroller = document.querySelector(".dls-landing-scroll");
    const stage = document.querySelector("[data-process-stage]").getBoundingClientRect();
    const path = document.querySelector("[data-timeline-path]");
    const phases = [...document.querySelectorAll("[data-process-step]")];
    return {
      errors: window.__dlsLandingErrors,
      widthOverflow: scroller.scrollWidth - scroller.clientWidth,
      phaseCount: phases.length,
      activeIndex: phases.findIndex((phase) => phase.classList.contains("is-active")),
      stageLeft: stage.left,
      stageRight: stage.right,
      pathLength: path.getTotalLength(),
      dashOffset: Number.parseFloat(getComputedStyle(path).strokeDashoffset),
      signalTransform:
        document.querySelector("[data-process-signal]").getAttribute("transform") || ""
    };
  })()`);
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

async function navigateAndWait(url) {
  await cdp.send("Page.navigate", { url });
  await waitForExpression(`document.readyState === "complete" && !!document.body`, 15_000);
}

async function captureScreenshot(name) {
  if (!screenshotDirectory) return;
  const screenshot = await cdp.send("Page.captureScreenshot", {
    format: "png",
    fromSurface: true,
    captureBeyondViewport: false
  });
  await writeFile(
    path.join(screenshotDirectory, `${name}.png`),
    Buffer.from(screenshot.data, "base64")
  );
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium"
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next installed browser.
    }
  }
  throw new Error("Chrome or Edge is required for the landing browser test.");
}

async function waitForUrl(url, timeout = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The local server is still starting.
    }
    await delay(120);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function waitForPage(portNumber, timeout = 12_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      const pages = await fetch(`http://127.0.0.1:${portNumber}/json`).then((response) => response.json());
      const page = pages.find((candidate) => candidate.type === "page");
      if (page) return page;
    } catch {
      // Chrome DevTools is still starting.
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
    const { resolve, reject, method } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(`${method}: ${message.error.message}`));
    else resolve(message.result);
  });
  socket.addEventListener("close", () => rejectPending("Chrome DevTools socket closed"));
  socket.addEventListener("error", () => rejectPending("Chrome DevTools socket errored"));

  return {
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, method });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    }
  };

  function rejectPending(message) {
    pending.forEach(({ reject, method }) => reject(new Error(`${method}: ${message}`)));
    pending.clear();
  }
}

async function evaluateObject(expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (response.exceptionDetails) {
    throw new Error(
      response.exceptionDetails.exception?.description ||
        response.exceptionDetails.text ||
        "Browser evaluation failed"
    );
  }
  return response.result.value;
}

async function waitForExpression(expression, timeout = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try {
      if (await evaluateObject(expression)) return;
    } catch {
      // The page may be between navigations.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}`);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
