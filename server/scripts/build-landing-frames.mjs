import { access, mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const FRAME_COUNT = 90;
const WIDTH = 1280;
const HEIGHT = 720;
const WEBP_QUALITY = 0.68;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const OUTPUT_DIR = path.join(PROJECT_ROOT, "assets", "landing", "sequence");
const SITE_HERO_SOURCE = path.join(PROJECT_ROOT, "assets", "landing", "lumen-premium-hero.png");
const STAGING_DIR = path.join(OUTPUT_DIR, ".landing-frames-build");
const FRAME_NAME = /^frame-(\d{3})\.webp$/;
const VERIFY_ONLY = process.argv.includes("--verify-only");

let browser;
let cdp;
let profileDir;
let browserLog = "";

try {
  if (VERIFY_ONLY) {
    const report = await validateFrames(OUTPUT_DIR);
    printReport(report, "Secuencia validada");
    process.exitCode = 0;
  } else {
    await buildFrames();
  }
} catch (error) {
  console.error(`\nNo se pudo generar la secuencia: ${error.message}`);
  if (browserLog.trim()) {
    console.error(`\nÚltima salida de Chrome:\n${browserLog.trim().slice(-2_000)}`);
  }
  process.exitCode = 1;
} finally {
  try {
    await cdp?.send("Browser.close");
  } catch {
    browser?.kill();
  }
  cdp?.close();
  if (browser && browser.exitCode === null) browser.kill();
  await rm(profileDir, { recursive: true, force: true }).catch(() => {});
  if (process.exitCode) await rm(STAGING_DIR, { recursive: true, force: true }).catch(() => {});
}

async function buildFrames() {
  assertSafeOutputPath();
  await mkdir(OUTPUT_DIR, { recursive: true });
  await rm(STAGING_DIR, { recursive: true, force: true });
  await mkdir(STAGING_DIR, { recursive: true });

  const chromePath = await findChrome();
  const debugPort = await getAvailablePort();
  profileDir = await mkdtemp(path.join(tmpdir(), "dls-landing-frames-"));
  browser = launchChrome(chromePath, debugPort, profileDir);

  const page = await waitForPage(debugPort);
  cdp = await createCdpClient(page.webSocketDebuggerUrl);
  await cdp.send("Runtime.enable");
  const siteHeroSource = await readFile(SITE_HERO_SOURCE);
  const siteHeroDataUrl = `data:image/png;base64,${siteHeroSource.toString("base64")}`;

  const setup = await evaluate(
    `(${installLandingFrameRenderer.toString()})(${JSON.stringify({
      width: WIDTH,
      height: HEIGHT,
      quality: WEBP_QUALITY,
      siteHeroDataUrl
    })})`
  );
  if (!setup?.ready || setup.width !== WIDTH || setup.height !== HEIGHT) {
    throw new Error("El renderer de Canvas no se inicializó con las dimensiones esperadas.");
  }

  console.log(`Generando ${FRAME_COUNT} frames ${WIDTH}x${HEIGHT} a WebP q=${WEBP_QUALITY}…`);
  for (let index = 1; index <= FRAME_COUNT; index += 1) {
    const dataUrl = await evaluate(`globalThis.__renderDlsLandingFrame(${index}, ${FRAME_COUNT})`);
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/webp;base64,")) {
      throw new Error(`Chrome no devolvió WebP para el frame ${index}.`);
    }

    const frame = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
    const fileName = formatFrameName(index);
    await writeFile(path.join(STAGING_DIR, fileName), frame);
    if (index === 1 || index % 10 === 0 || index === FRAME_COUNT) {
      console.log(`  ${String(index).padStart(2, "0")}/${FRAME_COUNT} · ${fileName}`);
    }
  }

  await validateFrames(STAGING_DIR);
  await replaceFinalFrames();
  const report = await validateFrames(OUTPUT_DIR);
  printReport(report, "Secuencia generada");
}

function launchChrome(chromePath, debugPort, userDataDir) {
  const child = spawn(
    chromePath,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-features=Translate,OptimizationHints,MediaRouter",
      "--disable-sync",
      "--force-color-profile=srgb",
      "--font-render-hinting=none",
      "--hide-scrollbars",
      "--metrics-recording-only",
      "--no-first-run",
      "--no-default-browser-check",
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${userDataDir}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      "about:blank"
    ],
    {
      stdio: ["ignore", "ignore", "pipe"],
      windowsHide: true
    }
  );

  child.stderr.setEncoding("utf8");
  child.stderr.on("data", (chunk) => {
    browserLog = `${browserLog}${chunk}`.slice(-8_000);
  });
  return child;
}

async function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Keep looking through the known local installations.
    }
  }
  throw new Error("No se encontró Chrome/Chromium. Define CHROME_PATH para indicar su ejecutable.");
}

async function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });
}

async function waitForPage(port, timeout = 15_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (browser?.exitCode !== null) {
      throw new Error(`Chrome terminó antes de abrir DevTools (código ${browser.exitCode}).`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page");
        if (page?.webSocketDebuggerUrl) return page;
      }
    } catch {
      // Chrome is still booting.
    }
    await delay(100);
  }
  throw new Error("Chrome no expuso una página de DevTools dentro del tiempo esperado.");
}

async function createCdpClient(socketUrl) {
  const socket = new WebSocket(socketUrl);
  const pending = new Map();
  let nextId = 0;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Tiempo agotado al conectar con Chrome DevTools.")), 10_000);
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timeout);
        resolve();
      },
      { once: true }
    );
    socket.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
        reject(new Error("Chrome DevTools rechazó la conexión WebSocket."));
      },
      { once: true }
    );
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const request = pending.get(message.id);
    pending.delete(message.id);
    clearTimeout(request.timeout);
    if (message.error) {
      request.reject(new Error(`${request.method}: ${message.error.message}`));
    } else {
      request.resolve(message.result);
    }
  });
  socket.addEventListener("close", () => rejectPending("Chrome DevTools cerró la conexión."));
  socket.addEventListener("error", () => rejectPending("Error en la conexión con Chrome DevTools."));

  return {
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`${method}: tiempo de espera agotado.`));
        }, 30_000);
        pending.set(id, { resolve, reject, method, timeout });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      if (socket.readyState === WebSocket.OPEN) socket.close();
    }
  };

  function rejectPending(message) {
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error(`${request.method}: ${message}`));
    }
    pending.clear();
  }
}

async function evaluate(expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (response.exceptionDetails) {
    const details = response.exceptionDetails;
    const description =
      details.exception?.description || details.exception?.value || details.text || "Falló una evaluación en Canvas.";
    throw new Error(description);
  }
  return response.result.value;
}

async function replaceFinalFrames() {
  const entries = await readdir(OUTPUT_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && FRAME_NAME.test(entry.name)) {
      await rm(path.join(OUTPUT_DIR, entry.name), { force: true });
    }
  }
  for (let index = 1; index <= FRAME_COUNT; index += 1) {
    const name = formatFrameName(index);
    await rename(path.join(STAGING_DIR, name), path.join(OUTPUT_DIR, name));
  }
  await rm(STAGING_DIR, { recursive: true, force: true });
}

async function validateFrames(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const frames = entries
    .filter((entry) => entry.isFile() && FRAME_NAME.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const expected = Array.from({ length: FRAME_COUNT }, (_, index) => formatFrameName(index + 1));

  if (frames.length !== FRAME_COUNT) {
    throw new Error(`Se esperaban exactamente ${FRAME_COUNT} WebP y se encontraron ${frames.length} en ${directory}.`);
  }
  for (let index = 0; index < FRAME_COUNT; index += 1) {
    if (frames[index] !== expected[index]) {
      throw new Error(`Secuencia incompleta: se esperaba ${expected[index]} y se encontró ${frames[index] || "nada"}.`);
    }
  }

  let totalBytes = 0;
  let minBytes = Number.POSITIVE_INFINITY;
  let maxBytes = 0;
  for (const frame of frames) {
    const filePath = path.join(directory, frame);
    const [buffer, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
    const dimensions = parseWebpDimensions(buffer);
    if (dimensions.width !== WIDTH || dimensions.height !== HEIGHT) {
      throw new Error(`${frame} mide ${dimensions.width}x${dimensions.height}; se esperaba ${WIDTH}x${HEIGHT}.`);
    }
    if (fileStat.size < 1_024) throw new Error(`${frame} parece vacío o corrupto (${fileStat.size} bytes).`);
    totalBytes += fileStat.size;
    minBytes = Math.min(minBytes, fileStat.size);
    maxBytes = Math.max(maxBytes, fileStat.size);
  }

  return { count: frames.length, width: WIDTH, height: HEIGHT, totalBytes, minBytes, maxBytes };
}

function parseWebpDimensions(buffer) {
  if (
    buffer.length < 30 ||
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WEBP"
  ) {
    throw new Error("Uno de los archivos no contiene una cabecera WebP válida.");
  }

  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3)
    };
  }
  if (chunk === "VP8 ") {
    if (buffer.toString("hex", 23, 26) !== "9d012a") throw new Error("Cabecera VP8 inesperada.");
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff
    };
  }
  if (chunk === "VP8L") {
    if (buffer[20] !== 0x2f) throw new Error("Cabecera VP8L inesperada.");
    const bits = buffer.readUInt32LE(21);
    return {
      width: 1 + (bits & 0x3fff),
      height: 1 + ((bits >> 14) & 0x3fff)
    };
  }
  throw new Error(`Códec WebP no reconocido: ${chunk}.`);
}

function formatFrameName(index) {
  return `frame-${String(index).padStart(3, "0")}.webp`;
}

function printReport(report, title) {
  console.log(`\n${title}:`);
  console.log(`  ${report.count} archivos WebP · ${report.width}x${report.height}`);
  console.log(`  Total: ${formatBytes(report.totalBytes)}`);
  console.log(`  Por frame: ${formatBytes(report.minBytes)}–${formatBytes(report.maxBytes)}`);
  console.log(`  Destino: ${OUTPUT_DIR}`);
}

function formatBytes(bytes) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KiB`;
  return `${(bytes / 1_048_576).toFixed(2)} MiB`;
}

function assertSafeOutputPath() {
  const relative = path.relative(PROJECT_ROOT, OUTPUT_DIR);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Ruta de salida insegura: ${OUTPUT_DIR}`);
  }
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function installLandingFrameRenderer({ width, height, quality, siteHeroDataUrl }) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.setAttribute("aria-label", "Secuencia cinematográfica DLS Studio");
  document.documentElement.style.cssText = "margin:0;background:#05070d";
  document.body.style.cssText = "margin:0;overflow:hidden;background:#05070d";
  document.body.append(canvas);
  const ctx = canvas.getContext("2d", { alpha: false, desynchronized: false });

  const C = {
    bg: "#05070d",
    ink: "#f5f7ff",
    muted: "#8f9ab3",
    faint: "#5d6880",
    panel: "#0c111d",
    panel2: "#111827",
    panel3: "#151d2d",
    line: "rgba(151, 166, 199, 0.15)",
    lineStrong: "rgba(151, 166, 199, 0.25)",
    violet: "#7c5cff",
    violet2: "#a797ff",
    cyan: "#35d7f0",
    green: "#55e6a5",
    orange: "#ffb766",
    red: "#ff6f7e"
  };
  const shell = { x: 70, y: 38, w: 1140, h: 644, r: 30 };
  const view = { x: 96, y: 126, w: 1088, h: 520, r: 20 };
  const stages = [
    { label: "Brief", start: 0 },
    { label: "Web", start: 14 },
    { label: "Hosting", start: 30 },
    { label: "Radar", start: 43 },
    { label: "CRM", start: 58 },
    { label: "IA", start: 74 }
  ];
  const siteHeroImage = new Image();
  siteHeroImage.src = siteHeroDataUrl;
  await siteHeroImage.decode();

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  globalThis.__renderDlsLandingFrame = (frameNumber, totalFrames) => {
    if (!Number.isInteger(frameNumber) || frameNumber < 1 || frameNumber > totalFrames) {
      throw new Error(`Frame fuera de rango: ${frameNumber}/${totalFrames}`);
    }
    const frame = frameNumber - 1;
    const progress = frame / Math.max(1, totalFrames - 1);
    const activeStage = getActiveStage(frame);

    drawBackground(progress, activeStage);
    drawShellBase(activeStage);

    ctx.save();
    roundedPath(view.x, view.y, view.w, view.h, view.r);
    ctx.clip();
    drawSceneLayer(frame, 0, 18, drawBriefScene);
    drawSceneLayer(frame, 14, 34, drawBuildScene);
    drawSceneLayer(frame, 30, 47, drawHostingScene);
    drawSceneLayer(frame, 43, 62, drawRadarScene);
    drawSceneLayer(frame, 58, 77, drawCrmScene);
    drawSceneLayer(frame, 74, totalFrames - 1, drawAiScene);
    ctx.restore();

    drawShellOverlay(progress, activeStage);
    return canvas.toDataURL("image/webp", quality);
  };

  return { ready: true, width: canvas.width, height: canvas.height };

  function drawBackground(progress, stageIndex) {
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, width, height);

    const palette = [
      [124, 92, 255],
      [88, 104, 255],
      [53, 215, 240],
      [53, 215, 240],
      [124, 92, 255],
      [167, 151, 255]
    ][stageIndex];
    const orbX = 210 + Math.sin(progress * Math.PI * 1.4) * 70;
    const orbY = 85 + Math.cos(progress * Math.PI * 1.1) * 40;
    const glow = ctx.createRadialGradient(orbX, orbY, 0, orbX, orbY, 430);
    glow.addColorStop(0, `rgba(${palette[0]},${palette[1]},${palette[2]},0.20)`);
    glow.addColorStop(0.45, `rgba(${palette[0]},${palette[1]},${palette[2]},0.07)`);
    glow.addColorStop(1, `rgba(${palette[0]},${palette[1]},${palette[2]},0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    const glow2 = ctx.createRadialGradient(1110, 650, 0, 1110, 650, 500);
    glow2.addColorStop(0, "rgba(53,215,240,0.10)");
    glow2.addColorStop(1, "rgba(53,215,240,0)");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(154, 169, 202, 0.035)";
    ctx.lineWidth = 1;
    for (let x = 0.5; x < width; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 15.5; y < height; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    for (let index = 0; index < 95; index += 1) {
      const x = ((index * 173 + 43) % width) + Math.sin(progress * 2 + index) * 1.5;
      const y = (index * 97 + 61) % height;
      const alpha = 0.035 + ((index * 17) % 5) * 0.008;
      ctx.fillStyle = `rgba(235,240,255,${alpha})`;
      ctx.fillRect(x, y, index % 7 === 0 ? 1.5 : 1, index % 7 === 0 ? 1.5 : 1);
    }
  }

  function drawShellBase(activeStage) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.62)";
    ctx.shadowBlur = 55;
    ctx.shadowOffsetY = 24;
    fillRound(shell.x, shell.y, shell.w, shell.h, shell.r, "rgba(9,13,23,0.97)");
    ctx.restore();

    const shellGradient = ctx.createLinearGradient(shell.x, shell.y, shell.x + shell.w, shell.y + shell.h);
    shellGradient.addColorStop(0, "rgba(18,25,41,0.96)");
    shellGradient.addColorStop(0.5, "rgba(10,15,26,0.98)");
    shellGradient.addColorStop(1, "rgba(8,12,21,0.99)");
    fillRound(shell.x, shell.y, shell.w, shell.h, shell.r, shellGradient, "rgba(183,197,228,0.16)");
    fillRound(view.x, view.y, view.w, view.h, view.r, "#0a0f1a", "rgba(183,197,228,0.12)");

    fillRound(92, 61, 122, 42, 14, "rgba(255,255,255,0.045)", "rgba(255,255,255,0.08)");
    drawBrandMark(112, 82);
    drawText("DLS", 136, 87, 14, 700, C.ink);
    drawText("STUDIO", 169, 87, 9, 700, C.muted);

    const activeColor = activeStage === 2 || activeStage === 3 ? C.cyan : C.violet2;
    stages.forEach((stage, index) => {
      const x = 493 + index * 106;
      const isPast = index < activeStage;
      const isActive = index === activeStage;
      if (index > 0) {
        ctx.strokeStyle = index <= activeStage ? hexAlpha(activeColor, 0.55) : "rgba(155,170,200,0.13)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x - 79, 81);
        ctx.lineTo(x - 19, 81);
        ctx.stroke();
      }
      if (isActive) {
        ctx.fillStyle = hexAlpha(activeColor, 0.12);
        ctx.beginPath();
        ctx.arc(x, 81, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = isActive ? activeColor : isPast ? hexAlpha(activeColor, 0.72) : "#3c465c";
      ctx.beginPath();
      ctx.arc(x, 81, isActive ? 4.2 : 3.2, 0, Math.PI * 2);
      ctx.fill();
      drawText(stage.label, x, 103, 9, isActive ? 700 : 500, isActive ? C.ink : C.faint, "center");
    });
  }

  function drawShellOverlay(progress, activeStage) {
    const barX = 96;
    const barY = 666;
    const barW = 1088;
    ctx.strokeStyle = "rgba(150,165,198,0.10)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(barX, barY);
    ctx.lineTo(barX + barW, barY);
    ctx.stroke();

    const active = activeStage === 2 || activeStage === 3 ? C.cyan : C.violet2;
    const endX = barX + barW * progress;
    const gradient = ctx.createLinearGradient(barX, 0, endX || barX + 1, 0);
    gradient.addColorStop(0, hexAlpha(C.violet, 0.42));
    gradient.addColorStop(1, active);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(barX, barY);
    ctx.lineTo(endX, barY);
    ctx.stroke();
    ctx.shadowColor = active;
    ctx.shadowBlur = 10;
    ctx.fillStyle = active;
    ctx.beginPath();
    ctx.arc(endX, barY, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawSceneLayer(frame, start, end, drawScene) {
    const fade = 4;
    let alpha = 1;
    if (start > 0) alpha *= smoothstep(start, start + fade, frame);
    if (end < 89) alpha *= 1 - smoothstep(end - fade, end, frame);
    if (alpha <= 0.001) return;

    const t = clamp((frame - start) / Math.max(1, end - start));
    const entering = smoothstep(0, 0.2, t);
    const leaving = smoothstep(0.82, 1, t);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate((1 - entering) * 24 - leaving * 16, (1 - entering) * 7 - leaving * 4);
    drawScene(t);
    ctx.restore();
  }

  function sceneBackdrop(colorA, colorB) {
    const gradient = ctx.createLinearGradient(view.x, view.y, view.x + view.w, view.y + view.h);
    gradient.addColorStop(0, colorA);
    gradient.addColorStop(1, colorB);
    ctx.fillStyle = gradient;
    ctx.fillRect(view.x - 30, view.y - 20, view.w + 60, view.h + 40);
  }

  function drawBriefScene(t) {
    sceneBackdrop("#0d1220", "#080d17");
    const typeProgress = smoothstep(0.08, 0.68, t);
    const buttonProgress = smoothstep(0.7, 0.93, t);
    const previewReveal = smoothstep(0.38, 0.88, t);

    drawPill(140, 164, 116, 28, "NUEVO PROYECTO", C.violet2, "rgba(124,92,255,0.10)");
    drawText("Tu negocio, listo", 140, 221, 34, 700, C.ink);
    drawText("para crecer online.", 140, 260, 34, 700, C.ink);
    drawText("Empieza por lo esencial. La plataforma se ocupa del resto.", 140, 290, 13, 500, C.muted);

    fillRound(140, 323, 535, 238, 22, "rgba(18,25,41,0.88)", "rgba(169,184,218,0.15)");
    drawText("NOMBRE DEL NEGOCIO", 166, 359, 10, 700, C.muted);
    fillRound(164, 374, 487, 58, 14, "#0b111d", typeProgress > 0.1 ? hexAlpha(C.violet2, 0.5) : C.lineStrong);
    const businessName = "LUMEN CAFÉ";
    const visibleChars = Math.min(businessName.length, Math.floor(typeProgress * (businessName.length + 1)));
    const typed = businessName.slice(0, visibleChars);
    drawText(typed, 186, 410, 17, 700, C.ink);
    const cursorX = 186 + ctx.measureText(typed).width + 3;
    ctx.fillStyle = hexAlpha(C.violet2, 0.45 + 0.5 * Math.abs(Math.sin(t * Math.PI * 8)));
    ctx.fillRect(cursorX, 390, 1.5, 22);

    fillRound(164, 450, 487, 70, 15, buttonProgress > 0.55 ? C.violet : "#151d2d");
    drawText(buttonProgress > 0.82 ? "Creando tu espacio…" : "Crear mi web", 193, 492, 14, 700, C.ink);
    drawArrow(615, 485, 0.65 + buttonProgress * 0.35, C.ink);
    if (buttonProgress > 0.45) {
      const pulse = smoothstep(0.45, 1, buttonProgress);
      ctx.strokeStyle = hexAlpha(C.violet2, (1 - pulse) * 0.45);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(622, 484, 16 + pulse * 28, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.save();
    ctx.globalAlpha *= 0.22 + previewReveal * 0.78;
    ctx.translate(0, (1 - previewReveal) * 18);
    drawMiniWebsite(734, 177, 376, 382, previewReveal, false);
    ctx.restore();

    drawText("01", 1118, 608, 11, 700, hexAlpha(C.violet2, 0.75), "right");
  }

  function drawBuildScene(t) {
    sceneBackdrop("#0a1020", "#080d17");
    drawPill(136, 158, 126, 28, "CONSTRUYENDO", C.violet2, "rgba(124,92,255,0.10)");
    drawText("Tu web cobra vida.", 136, 211, 31, 700, C.ink);
    drawText("Cada bloque se compone en segundos.", 136, 240, 13, 500, C.muted);

    const steps = [
      ["Identidad visual", 0.08],
      ["Estructura y secciones", 0.28],
      ["Contenido inicial", 0.5],
      ["Optimización móvil", 0.72]
    ];
    ctx.strokeStyle = "rgba(151,166,199,0.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(152, 293);
    ctx.lineTo(152, 478);
    ctx.stroke();
    steps.forEach(([label, threshold], index) => {
      const y = 290 + index * 62;
      const done = smoothstep(threshold, threshold + 0.12, t);
      ctx.fillStyle = done > 0.92 ? C.green : done > 0.05 ? C.violet2 : "#293247";
      ctx.beginPath();
      ctx.arc(152, y, 8, 0, Math.PI * 2);
      ctx.fill();
      if (done > 0.72) drawCheck(152, y, 0.72, "#07120d");
      drawText(label, 177, y + 5, 13, done > 0.08 ? 700 : 500, done > 0.08 ? C.ink : C.muted);
      if (done > 0.04 && done < 0.92) {
        drawText("EN CURSO", 354, y + 4, 9, 700, C.violet2, "right");
      } else if (done >= 0.92) {
        drawText("LISTO", 354, y + 4, 9, 700, C.green, "right");
      }
    });

    fillRound(405, 152, 736, 448, 22, "rgba(14,20,34,0.96)", "rgba(170,185,219,0.16)");
    fillRound(421, 168, 704, 34, 10, "#090e18");
    [["#ff6f7e", 441], ["#ffb766", 457], ["#55e6a5", 473]].forEach(([color, x]) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, 185, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
    fillRound(498, 176, 458, 18, 7, "rgba(255,255,255,0.045)");
    drawText("lumencafe.es", 727, 189, 9, 500, C.faint, "center");

    ctx.save();
    roundedPath(421, 214, 704, 369, 14);
    ctx.clip();
    ctx.fillStyle = "#070b0f";
    ctx.fillRect(421, 214, 704, 369);
    reveal(t, 0.04, () => {
      ctx.fillStyle = "#070a0d";
      ctx.fillRect(421, 214, 704, 46);
      ctx.fillStyle = "#ff715b";
      ctx.fillRect(447, 229, 12, 12);
      drawText("LUMEN", 469, 243, 11, 700, "#f7f8f4");
      drawText("EL CAFÉ", 914, 242, 8, 700, "#c9ced2");
      drawText("EL ESPACIO", 975, 242, 8, 700, "#c9ced2");
      fillRound(1050, 224, 54, 26, 13, "#f2f4ee");
      drawText("VISITAR", 1077, 241, 7, 700, "#090d10", "center");
    });
    reveal(t, 0.18, () => {
      drawImageCover(siteHeroImage, 421, 260, 704, 255);
      const shade = ctx.createLinearGradient(421, 260, 955, 260);
      shade.addColorStop(0, "rgba(4,8,11,0.96)");
      shade.addColorStop(0.5, "rgba(4,8,11,0.58)");
      shade.addColorStop(0.78, "rgba(4,8,11,0.10)");
      shade.addColorStop(1, "rgba(4,8,11,0)");
      ctx.fillStyle = shade;
      ctx.fillRect(421, 260, 704, 255);
      const floorShade = ctx.createLinearGradient(0, 390, 0, 515);
      floorShade.addColorStop(0, "rgba(3,7,10,0)");
      floorShade.addColorStop(1, "rgba(3,7,10,0.68)");
      ctx.fillStyle = floorShade;
      ctx.fillRect(421, 390, 704, 125);
    });
    reveal(t, 0.34, () => {
      drawText("CAFÉ DE ESPECIALIDAD  ·  MADRID", 453, 298, 8, 700, "#8ef0db");
      drawText("CAFÉ, DISEÑO", 452, 351, 31, 700, "#f7f8f4");
      drawText("Y CULTURA.", 452, 385, 31, 700, "#f7f8f4");
      drawText("Origen consciente. Arquitectura para quedarse.", 453, 413, 9, 500, "#c8ced1");
      fillRound(452, 438, 118, 36, 18, "#ff715b");
      drawText("DESCUBRIR LUMEN", 511, 461, 7, 700, "#101010", "center");
      ctx.strokeStyle = "rgba(247,248,244,0.42)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(1090, 478, 18, 0, Math.PI * 2);
      ctx.stroke();
      drawArrow(1096, 478, 0.65, "#f7f8f4");
    });
    reveal(t, 0.52, () => {
      ctx.fillStyle = "#080c10";
      ctx.fillRect(421, 515, 704, 68);
      drawText("4.9", 452, 546, 18, 700, "#f7f8f4");
      drawText("VALORACIÓN LOCAL", 452, 562, 7, 700, "#6f7c84");
      drawText("06:30—20:00", 633, 546, 14, 700, "#f7f8f4");
      drawText("CADA DÍA", 633, 562, 7, 700, "#6f7c84");
      drawText("CHAMBERÍ", 840, 546, 14, 700, "#f7f8f4");
      drawText("MADRID", 840, 562, 7, 700, "#6f7c84");
      fillRound(1037, 533, 66, 28, 14, "rgba(142,240,219,0.12)", "rgba(142,240,219,0.28)");
      drawText("ABIERTO", 1070, 551, 7, 700, "#8ef0db", "center");
    });
    if (t < 0.76) {
      const shimmerX = 421 + (704 + 180) * smoothstep(0.04, 0.78, t) - 180;
      const shimmer = ctx.createLinearGradient(shimmerX, 0, shimmerX + 180, 0);
      shimmer.addColorStop(0, "rgba(255,255,255,0)");
      shimmer.addColorStop(0.5, "rgba(255,255,255,0.16)");
      shimmer.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = shimmer;
      ctx.fillRect(shimmerX, 214, 180, 369);
    }
    ctx.restore();

    const overall = smoothstep(0.04, 0.86, t);
    drawText(`${Math.round(overall * 100)}%`, 1105, 578, 10, 700, overall > 0.96 ? C.green : C.violet2, "right");
    drawText("02", 1150, 616, 11, 700, hexAlpha(C.violet2, 0.75), "right");
  }

  function drawHostingScene(t) {
    sceneBackdrop("#08131c", "#080d17");
    drawPill(136, 158, 116, 28, "PUBLICACIÓN", C.cyan, "rgba(53,215,240,0.09)");
    drawText("De borrador a online.", 136, 211, 31, 700, C.ink);
    drawText("Dominio, SSL y hosting, coordinados.", 136, 240, 13, 500, C.muted);

    ctx.save();
    ctx.translate(0, (1 - smoothstep(0, 0.22, t)) * 12);
    drawMiniWebsite(136, 273, 554, 286, 1, true);
    ctx.restore();

    const transfer = smoothstep(0.08, 0.7, t);
    ctx.strokeStyle = hexAlpha(C.cyan, 0.17);
    ctx.setLineDash([4, 7]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(690, 415);
    ctx.bezierCurveTo(720, 415, 720, 370, 752, 370);
    ctx.stroke();
    ctx.setLineDash([]);
    for (let index = 0; index < 3; index += 1) {
      const dotProgress = (transfer * 1.35 + index * 0.24) % 1;
      const x = lerp(690, 752, dotProgress);
      const y = 415 - Math.sin(dotProgress * Math.PI) * 45;
      ctx.fillStyle = hexAlpha(C.cyan, 0.35 + dotProgress * 0.55);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    fillRound(752, 174, 386, 385, 22, "rgba(15,23,37,0.97)", "rgba(164,181,214,0.17)");
    drawCloud(786, 211, C.cyan);
    drawText("DLS CLOUD", 815, 216, 10, 700, C.muted);
    drawText("Desplegando lumencafe.es", 780, 255, 17, 700, C.ink);
    fillRound(780, 274, 330, 42, 12, "#0a111d", "rgba(151,166,199,0.13)");
    drawLock(800, 295, transfer > 0.66 ? C.green : C.faint);
    drawText("https://lumencafe.es", 820, 299, 11, 500, transfer > 0.66 ? C.ink : C.muted);

    const logs = [
      ["Preparando archivos", 0.08],
      ["Conectando dominio", 0.27],
      ["Activando certificado SSL", 0.48],
      ["Distribuyendo en la red", 0.66]
    ];
    logs.forEach(([label, threshold], index) => {
      const revealProgress = smoothstep(threshold, threshold + 0.12, t);
      const y = 351 + index * 39;
      ctx.fillStyle = revealProgress > 0.9 ? C.green : revealProgress > 0.05 ? C.cyan : "#303a50";
      ctx.beginPath();
      ctx.arc(789, y - 3, 3.2, 0, Math.PI * 2);
      ctx.fill();
      drawText(label, 804, y, 11, 500, revealProgress > 0.05 ? C.ink : C.faint);
      drawText(
        revealProgress > 0.9 ? "HECHO" : revealProgress > 0.05 ? "…" : "—",
        1098,
        y,
        9,
        700,
        revealProgress > 0.9 ? C.green : C.faint,
        "right"
      );
    });

    const online = smoothstep(0.76, 0.96, t);
    ctx.save();
    ctx.globalAlpha *= online;
    ctx.translate(0, (1 - online) * 12);
    fillRound(780, 505, 330, 38, 12, "rgba(85,230,165,0.10)", "rgba(85,230,165,0.28)");
    ctx.fillStyle = C.green;
    ctx.beginPath();
    ctx.arc(797, 524, 4, 0, Math.PI * 2);
    ctx.fill();
    drawText("SITIO ONLINE", 812, 528, 10, 700, C.green);
    drawText("Ver web ↗", 1090, 528, 10, 700, C.ink, "right");
    ctx.restore();
    drawText("03", 1150, 616, 11, 700, hexAlpha(C.cyan, 0.75), "right");
  }

  function drawRadarScene(t) {
    sceneBackdrop("#07131a", "#080d17");
    fillRound(118, 148, 715, 458, 22, "#0d1720", "rgba(135,203,218,0.16)");
    ctx.save();
    roundedPath(119, 149, 713, 456, 21);
    ctx.clip();
    ctx.translate((t - 0.5) * -10, Math.sin(t * Math.PI) * 4);

    ctx.fillStyle = "#0c1821";
    ctx.fillRect(108, 137, 740, 480);
    const blocks = [
      [138, 170, 142, 72],
      [303, 160, 106, 116],
      [440, 168, 156, 82],
      [625, 155, 170, 108],
      [128, 289, 110, 125],
      [267, 302, 168, 77],
      [465, 281, 108, 135],
      [607, 302, 182, 88],
      [146, 453, 160, 118],
      [338, 423, 121, 153],
      [493, 457, 166, 106],
      [686, 431, 118, 141]
    ];
    blocks.forEach(([x, y, w, h], index) => {
      fillRound(x, y, w, h, 8, index % 3 === 0 ? "#12232b" : "#101f28", "rgba(91,139,151,0.08)");
      if (index % 2 === 0) {
        ctx.fillStyle = "rgba(85,230,165,0.035)";
        ctx.fillRect(x + 12, y + 12, Math.max(12, w - 24), 4);
      }
    });

    ctx.strokeStyle = "rgba(134,171,183,0.20)";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    const roads = [
      [[98, 270], [250, 258], [410, 286], [570, 261], [860, 284]],
      [[224, 126], [248, 270], [245, 430], [276, 640]],
      [[579, 120], [565, 270], [590, 421], [575, 640]],
      [[92, 425], [272, 409], [465, 438], [625, 412], [860, 418]]
    ];
    roads.forEach((points) => {
      ctx.beginPath();
      points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    });
    ctx.strokeStyle = "rgba(53,215,240,0.12)";
    ctx.lineWidth = 1.5;
    roads.forEach((points) => {
      ctx.beginPath();
      points.forEach(([x, y], index) => (index ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    });

    drawText("CHAMBERÍ", 160, 217, 9, 700, "rgba(143,181,193,0.38)");
    drawText("MALASAÑA", 632, 478, 9, 700, "rgba(143,181,193,0.38)");
    drawText("CENTRO", 368, 350, 9, 700, "rgba(143,181,193,0.38)");

    const radarX = 462;
    const radarY = 377;
    const scan = (t * 2.15) % 1;
    for (let ring = 0; ring < 3; ring += 1) {
      const phase = (scan + ring / 3) % 1;
      ctx.strokeStyle = hexAlpha(C.cyan, (1 - phase) * 0.22);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(radarX, radarY, 28 + phase * 150, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(radarX, radarY);
    ctx.rotate(t * Math.PI * 3.2 - Math.PI / 2);
    const sweep = ctx.createLinearGradient(0, 0, 170, 0);
    sweep.addColorStop(0, "rgba(53,215,240,0.36)");
    sweep.addColorStop(1, "rgba(53,215,240,0)");
    ctx.fillStyle = sweep;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 170, -0.16, 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = C.cyan;
    ctx.beginPath();
    ctx.arc(radarX, radarY, 4, 0, Math.PI * 2);
    ctx.fill();

    const pins = [
      [356, 286, 0.12, "94"],
      [655, 356, 0.3, "88"],
      [307, 486, 0.47, "82"],
      [694, 219, 0.63, "79"],
      [526, 491, 0.72, "76"]
    ];
    pins.forEach(([x, y, threshold, score], index) => {
      const revealProgress = smoothstep(threshold, threshold + 0.14, t);
      drawMapPin(x, y, revealProgress, index < 3 ? C.green : C.cyan, score);
    });
    ctx.restore();

    fillRound(854, 148, 304, 458, 22, "rgba(13,21,34,0.97)", "rgba(165,181,213,0.15)");
    drawPill(878, 172, 91, 25, "RADAR LIVE", C.cyan, "rgba(53,215,240,0.09)");
    drawText("Oportunidades cerca", 878, 232, 20, 700, C.ink);
    drawText(`${Math.round(lerp(2, 18, smoothstep(0.05, 0.86, t)))} detectadas`, 878, 256, 11, 500, C.muted);
    [
      ["Studio Norte", "Sin web · 350 m", "94", 0.18],
      ["Casa Verde", "Web desactualizada", "88", 0.4],
      ["Lumbre Cocina", "Sin reservas online", "82", 0.61]
    ].forEach(([name, detail, score, threshold], index) => {
      const revealProgress = smoothstep(threshold, threshold + 0.13, t);
      ctx.save();
      ctx.globalAlpha *= revealProgress;
      ctx.translate((1 - revealProgress) * 18, 0);
      const y = 284 + index * 88;
      fillRound(874, y, 264, 72, 14, index === 0 ? "rgba(53,215,240,0.075)" : "#111a29", C.line);
      ctx.fillStyle = index === 0 ? C.cyan : C.green;
      ctx.beginPath();
      ctx.arc(895, y + 23, 4, 0, Math.PI * 2);
      ctx.fill();
      drawText(name, 909, y + 27, 12, 700, C.ink);
      drawText(detail, 895, y + 51, 9, 500, C.muted);
      fillRound(1091, y + 17, 32, 24, 10, "rgba(85,230,165,0.10)");
      drawText(score, 1107, y + 33, 9, 700, C.green, "center");
      ctx.restore();
    });
    drawText("04", 1150, 616, 11, 700, hexAlpha(C.cyan, 0.75), "right");
  }

  function drawCrmScene(t) {
    sceneBackdrop("#0c101d", "#080d17");
    drawPill(132, 154, 91, 27, "CRM DLS", C.violet2, "rgba(124,92,255,0.10)");
    drawText("El pipeline avanza solo.", 132, 213, 28, 700, C.ink);
    drawText("Cada oportunidad, en el momento correcto.", 132, 240, 12, 500, C.muted);
    fillRound(949, 166, 196, 61, 16, "rgba(124,92,255,0.075)", "rgba(167,151,255,0.17)");
    drawText("PIPELINE ACTIVO", 969, 189, 9, 700, C.muted);
    drawText(`${Math.round(lerp(8.4, 12.84, smoothstep(0.18, 0.88, t)) * 1000).toLocaleString("es-ES")} €`, 969, 214, 17, 700, C.ink);

    const columnXs = [126, 384, 642, 900];
    const labels = ["NUEVOS", "CONTACTADOS", "PROPUESTA", "GANADO"];
    const colors = [C.cyan, C.violet2, C.orange, C.green];
    columnXs.forEach((x, index) => {
      fillRound(x, 271, 240, 300, 17, "rgba(16,23,38,0.94)", "rgba(154,170,202,0.12)");
      ctx.fillStyle = hexAlpha(colors[index], 0.8);
      ctx.beginPath();
      ctx.arc(x + 18, 298, 3.5, 0, Math.PI * 2);
      ctx.fill();
      drawText(labels[index], x + 31, 302, 10, 700, C.muted);
      const counts = index === 0 ? (t < 0.22 ? 4 : 3) : index === 1 ? (t < 0.62 ? 2 : 1) : index === 2 ? (t < 0.62 ? 1 : 2) : 3;
      fillRound(x + 199, 286, 24, 22, 9, "rgba(255,255,255,0.045)");
      drawText(String(counts), x + 211, 301, 9, 700, C.muted, "center");
    });

    drawDealCard(142, 326, 208, "Studio Norte", "2.400 €", C.cyan, 0.84);
    drawDealCard(142, 412, 208, "Lumbre Cocina", "1.850 €", C.cyan, 0.72);
    drawDealCard(400, 326, 208, "Áurea Dental", "3.200 €", C.violet2, 0.9);
    drawDealCard(658, 412, 208, "Marea Yoga", "1.690 €", C.orange, 0.76);
    drawDealCard(916, 326, 208, "Nido Estudio", "2.800 €", C.green, 1);
    drawDealCard(916, 412, 208, "Brasa Local", "2.100 €", C.green, 0.82);

    const firstMove = smoothstep(0.12, 0.48, t);
    const secondMove = smoothstep(0.54, 0.88, t);
    const xA = 142;
    const xB = 400;
    const xC = 658;
    const movingX = secondMove > 0 ? lerp(xB, xC, easeInOut(secondMove)) : lerp(xA, xB, easeInOut(firstMove));
    const arc = secondMove > 0 ? Math.sin(secondMove * Math.PI) : Math.sin(firstMove * Math.PI);
    const movingY = 498 - arc * 28;
    const movingColor = secondMove > 0.96 ? C.orange : firstMove > 0.96 ? C.violet2 : C.cyan;

    if (firstMove > 0.03) {
      fillRound(142, 498, 208, 62, 13, "rgba(53,215,240,0.025)", "rgba(53,215,240,0.12)");
    }
    if (secondMove > 0.03) {
      fillRound(400, 498, 208, 62, 13, "rgba(167,151,255,0.025)", "rgba(167,151,255,0.12)");
    }
    ctx.save();
    ctx.shadowColor = hexAlpha(movingColor, 0.25);
    ctx.shadowBlur = arc * 22;
    ctx.shadowOffsetY = arc * 12;
    drawDealCard(movingX, movingY, 208, "Casa Verde", "2.600 €", movingColor, 1, true);
    ctx.restore();

    if (secondMove > 0.9) {
      const done = smoothstep(0.9, 1, secondMove);
      ctx.save();
      ctx.globalAlpha *= done;
      fillRound(681, 518, 77, 22, 9, "rgba(255,183,102,0.11)");
      drawText("PROPUESTA", 719, 533, 8, 700, C.orange, "center");
      ctx.restore();
    }
    drawText("05", 1150, 616, 11, 700, hexAlpha(C.violet2, 0.75), "right");
  }

  function drawAiScene(t) {
    sceneBackdrop("#0c1020", "#090d18");
    drawPill(132, 154, 101, 27, "CONTENIDO IA", C.violet2, "rgba(124,92,255,0.10)");
    drawText("La voz de tu marca, escrita.", 132, 213, 28, 700, C.ink);
    drawText("Contenido listo para revisar y publicar.", 132, 240, 12, 500, C.muted);

    fillRound(128, 272, 686, 316, 20, "rgba(15,22,36,0.97)", "rgba(166,181,214,0.15)");
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(128, 318);
    ctx.lineTo(814, 318);
    ctx.stroke();
    drawText("INICIO / HISTORIA", 151, 300, 9, 700, C.faint);
    ["H1", "B", "I", "↗"].forEach((label, index) => {
      fillRound(671 + index * 31, 284, 24, 22, 7, index === 0 ? "rgba(124,92,255,0.13)" : "rgba(255,255,255,0.035)");
      drawText(label, 683 + index * 31, 299, 8, 700, index === 0 ? C.violet2 : C.muted, "center");
    });

    const title = "Un café con luz propia";
    const titleProgress = smoothstep(0.08, 0.43, t);
    const visibleTitle = title.slice(0, Math.floor(title.length * titleProgress));
    drawText(visibleTitle, 158, 365, 25, 700, C.ink);
    const titleCursorX = 158 + ctx.measureText(visibleTitle).width + 3;
    if (titleProgress < 0.995) {
      ctx.fillStyle = hexAlpha(C.violet2, 0.5 + 0.45 * Math.abs(Math.sin(t * Math.PI * 10)));
      ctx.fillRect(titleCursorX, 342, 2, 29);
    }

    const copy =
      "En Lumen creemos que una buena taza cambia el ritmo del día. Seleccionamos café de origen, lo tostamos cerca y lo servimos sin prisa, en un espacio pensado para quedarse.";
    const copyProgress = smoothstep(0.32, 0.84, t);
    const visibleCopy = copy.slice(0, Math.floor(copy.length * copyProgress));
    drawWrappedText(visibleCopy, 158, 407, 610, 21, 12, 500, "#aeb7ca");
    if (copyProgress > 0.04 && copyProgress < 0.995) {
      const lines = wrapLines(visibleCopy, 610, 12, 500);
      const lastLine = lines.at(-1) || "";
      const cursorX = 158 + measure(lastLine, 12, 500);
      const cursorY = 407 + (lines.length - 1) * 21;
      ctx.fillStyle = C.violet2;
      ctx.fillRect(cursorX + 2, cursorY - 13, 1.5, 16);
    }

    const tagsReveal = smoothstep(0.66, 0.87, t);
    ctx.save();
    ctx.globalAlpha *= tagsReveal;
    ctx.translate(0, (1 - tagsReveal) * 9);
    drawPill(158, 528, 84, 26, "CERCANÍA", C.cyan, "rgba(53,215,240,0.07)");
    drawPill(251, 528, 97, 26, "CAFÉ LOCAL", C.green, "rgba(85,230,165,0.07)");
    drawPill(357, 528, 89, 26, "ARTESANO", C.orange, "rgba(255,183,102,0.07)");
    ctx.restore();

    fillRound(838, 272, 312, 316, 20, "rgba(18,24,42,0.98)", "rgba(167,151,255,0.18)");
    const halo = 0.5 + Math.sin(t * Math.PI * 4) * 0.08;
    ctx.fillStyle = hexAlpha(C.violet, 0.11 * halo);
    ctx.beginPath();
    ctx.arc(994, 341, 49, 0, Math.PI * 2);
    ctx.fill();
    drawSparkle(994, 341, 1, C.violet2);
    drawText("ASISTENTE DE MARCA", 994, 401, 9, 700, C.muted, "center");
    drawText("Tono cálido y cercano", 994, 426, 15, 700, C.ink, "center");
    drawText("Claro · Local · Humano", 994, 449, 10, 500, C.muted, "center");

    const suggestions = [
      ["Titular optimizado", 0.3],
      ["Texto de marca", 0.58],
      ["SEO local incluido", 0.78]
    ];
    suggestions.forEach(([label, threshold], index) => {
      const done = smoothstep(threshold, threshold + 0.13, t);
      const y = 478 + index * 31;
      ctx.fillStyle = done > 0.88 ? C.green : "#30384d";
      ctx.beginPath();
      ctx.arc(888, y - 3, 7, 0, Math.PI * 2);
      ctx.fill();
      if (done > 0.88) drawCheck(888, y - 3, 0.66, "#07120d");
      drawText(label, 904, y + 1, 10, 500, done > 0.08 ? C.ink : C.faint);
    });

    const ready = smoothstep(0.84, 1, t);
    ctx.save();
    ctx.globalAlpha *= ready;
    ctx.translate(0, (1 - ready) * 12);
    fillRound(870, 552, 248, 42, 13, ready > 0.86 ? C.violet : "#252e44");
    drawText("Contenido listo", 896, 578, 11, 700, C.ink);
    drawCheck(1092, 573, 0.84, C.ink);
    ctx.restore();
    drawText("06", 1150, 616, 11, 700, hexAlpha(C.violet2, 0.75), "right");
  }

  function drawMiniWebsite(x, y, w, h, revealProgress, compact) {
    fillRound(x, y, w, h, 19, "rgba(17,24,39,0.97)", "rgba(164,180,214,0.16)");
    fillRound(x + 13, y + 13, w - 26, 28, 8, "#090e18");
    ["#ff6f7e", "#ffb766", "#55e6a5"].forEach((color, index) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 28 + index * 13, y + 27, 2.7, 0, Math.PI * 2);
      ctx.fill();
    });
    drawText(compact ? "lumencafe.es" : "Vista previa", x + w / 2, y + 30, 8, 500, C.faint, "center");

    const innerX = x + 13;
    const innerY = y + 52;
    const innerW = w - 26;
    const innerH = h - 65;
    ctx.save();
    roundedPath(innerX, innerY, innerW, innerH, 11);
    ctx.clip();
    ctx.fillStyle = "#080c10";
    ctx.fillRect(innerX, innerY, innerW, innerH);
    const navH = compact ? 35 : 43;
    const heroY = innerY + navH;
    const heroH = innerH - navH;
    drawImageCover(siteHeroImage, innerX, heroY, innerW, heroH);
    const shade = ctx.createLinearGradient(innerX, heroY, innerX + innerW * 0.82, heroY);
    shade.addColorStop(0, "rgba(3,7,10,0.98)");
    shade.addColorStop(0.55, "rgba(3,7,10,0.63)");
    shade.addColorStop(1, "rgba(3,7,10,0)");
    ctx.fillStyle = shade;
    ctx.fillRect(innerX, heroY, innerW, heroH);
    const floorShade = ctx.createLinearGradient(0, heroY + heroH * 0.54, 0, heroY + heroH);
    floorShade.addColorStop(0, "rgba(3,7,10,0)");
    floorShade.addColorStop(1, "rgba(3,7,10,0.86)");
    ctx.fillStyle = floorShade;
    ctx.fillRect(innerX, heroY, innerW, heroH);

    ctx.fillStyle = "rgba(5,9,12,0.94)";
    ctx.fillRect(innerX, innerY, innerW, navH);
    ctx.fillStyle = "#ff715b";
    ctx.fillRect(innerX + 17, innerY + (compact ? 11 : 14), compact ? 9 : 11, compact ? 9 : 11);
    drawText("LUMEN", innerX + (compact ? 34 : 39), innerY + (compact ? 23 : 28), compact ? 8 : 10, 700, "#f7f8f4");
    drawText(
      "MADRID  ·  ES",
      innerX + innerW - 17,
      innerY + (compact ? 23 : 28),
      compact ? 6 : 7,
      700,
      "#849098",
      "right"
    );

    const textX = innerX + (compact ? 22 : 24);
    drawText("CAFÉ DE ESPECIALIDAD", textX, heroY + (compact ? 28 : 40), compact ? 6 : 7, 700, "#8ef0db");
    drawText("CAFÉ, DISEÑO", textX, heroY + (compact ? 57 : 79), compact ? 17 : 21, 700, "#f7f8f4");
    drawText("Y CULTURA.", textX, heroY + (compact ? 78 : 103), compact ? 17 : 21, 700, "#f7f8f4");
    drawText(
      "Origen consciente. Espacios con carácter.",
      textX,
      heroY + (compact ? 99 : 129),
      compact ? 6 : 7,
      500,
      "#c7ced1"
    );
    fillRound(
      textX,
      heroY + (compact ? 112 : 147),
      compact ? 76 : 92,
      compact ? 23 : 28,
      14,
      "#ff715b"
    );
    drawText(
      "DESCUBRIR",
      textX + (compact ? 38 : 46),
      heroY + (compact ? 127 : 165),
      compact ? 6 : 7,
      700,
      "#101010",
      "center"
    );
    drawText("4.9  ·  CHAMBERÍ  ·  ABIERTO", textX, heroY + heroH - 14, compact ? 6 : 7, 700, "#f7f8f4");
    ctx.restore();

    if (revealProgress < 0.96 && !compact) {
      ctx.save();
      ctx.globalAlpha *= 1 - revealProgress;
      for (let index = 0; index < 4; index += 1) {
        fillRound(x + 32, y + 78 + index * 54, w - 64, 34, 9, "rgba(255,255,255,0.055)");
      }
      ctx.restore();
    }
  }

  function drawDealCard(x, y, w, name, value, color, confidence, moving = false) {
    fillRound(
      x,
      y,
      w,
      62,
      13,
      moving ? "rgba(27,34,53,0.99)" : "rgba(22,29,45,0.96)",
      moving ? hexAlpha(color, 0.42) : "rgba(154,170,202,0.11)"
    );
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + 17, y + 20, 3.5, 0, Math.PI * 2);
    ctx.fill();
    drawText(name, x + 29, y + 24, 11, 700, C.ink);
    drawText(value, x + 16, y + 48, 9, 700, color);
    drawText(`${Math.round(confidence * 100)}%`, x + w - 15, y + 48, 8, 700, C.faint, "right");
  }

  function drawMapPin(x, y, revealProgress, color, score) {
    if (revealProgress <= 0) return;
    const scale = 0.35 + easeOutBack(revealProgress) * 0.65;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.shadowColor = hexAlpha(color, 0.4);
    ctx.shadowBlur = 14;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, -8, 10, Math.PI, 0);
    ctx.lineTo(0, 10);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#071118";
    ctx.beginPath();
    ctx.arc(0, -8, 3.4, 0, Math.PI * 2);
    ctx.fill();
    fillRound(11, -23, 28, 18, 7, "rgba(7,17,24,0.92)", hexAlpha(color, 0.32));
    drawText(score, 25, -10, 7, 700, color, "center");
    ctx.restore();
  }

  function drawPill(x, y, w, h, label, color, background) {
    fillRound(x, y, w, h, h / 2, background, hexAlpha(color, 0.18));
    drawText(label, x + w / 2, y + h / 2 + 3.5, 8, 700, color, "center");
  }

  function drawBrandMark(x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = C.violet2;
    fillRound(-7, -7, 14, 14, 4, C.violet2);
    ctx.fillStyle = "#101522";
    ctx.fillRect(-2, -7, 4, 14);
    ctx.restore();
  }

  function drawCloud(x, y, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.arc(x, y, 8, Math.PI * 0.9, Math.PI * 1.9);
    ctx.arc(x + 11, y - 4, 10, Math.PI, Math.PI * 1.9);
    ctx.arc(x + 22, y + 1, 7, Math.PI * 1.3, Math.PI * 0.4);
    ctx.lineTo(x, y + 8);
    ctx.stroke();
    ctx.restore();
  }

  function drawLock(x, y, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x - 5, y - 1, 10, 8);
    ctx.beginPath();
    ctx.arc(x, y - 1, 4, Math.PI, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawCheck(x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-1, 3);
    ctx.lineTo(5, -4);
    ctx.stroke();
    ctx.restore();
  }

  function drawArrow(x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(7, 0);
    ctx.moveTo(2, -5);
    ctx.lineTo(7, 0);
    ctx.lineTo(2, 5);
    ctx.stroke();
    ctx.restore();
  }

  function drawSparkle(x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.quadraticCurveTo(2, -2, 15, 0);
    ctx.quadraticCurveTo(2, 2, 0, 17);
    ctx.quadraticCurveTo(-2, 2, -15, 0);
    ctx.quadraticCurveTo(-2, -2, 0, -17);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(20, -15);
    ctx.lineTo(20, -7);
    ctx.moveTo(16, -11);
    ctx.lineTo(24, -11);
    ctx.stroke();
    ctx.restore();
  }

  function reveal(t, threshold, draw) {
    const amount = smoothstep(threshold, threshold + 0.16, t);
    if (amount <= 0) return;
    ctx.save();
    ctx.globalAlpha *= amount;
    ctx.translate(0, (1 - amount) * 13);
    draw();
    ctx.restore();
  }

  function drawImageCover(image, x, y, w, h) {
    const imageRatio = image.naturalWidth / image.naturalHeight;
    const targetRatio = w / h;
    let sourceX = 0;
    let sourceY = 0;
    let sourceW = image.naturalWidth;
    let sourceH = image.naturalHeight;
    if (imageRatio > targetRatio) {
      sourceW = image.naturalHeight * targetRatio;
      sourceX = (image.naturalWidth - sourceW) / 2;
    } else {
      sourceH = image.naturalWidth / targetRatio;
      sourceY = (image.naturalHeight - sourceH) / 2;
    }
    ctx.drawImage(image, sourceX, sourceY, sourceW, sourceH, x, y, w, h);
  }

  function drawText(text, x, y, size, weight, color, align = "left") {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  function drawWrappedText(text, x, y, maxWidth, lineHeight, size, weight, color) {
    const lines = wrapLines(text, maxWidth, size, weight);
    lines.forEach((line, index) => drawText(line, x, y + index * lineHeight, size, weight, color));
  }

  function wrapLines(text, maxWidth, size, weight) {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    const words = text.split(" ");
    const lines = [];
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  function measure(text, size, weight) {
    ctx.font = `${weight} ${size}px Arial, sans-serif`;
    return ctx.measureText(text).width;
  }

  function fillRound(x, y, w, h, radius, fill, stroke) {
    roundedPath(x, y, w, h, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function roundedPath(x, y, w, h, radius) {
    const r = Math.max(0, Math.min(radius, Math.abs(w) / 2, Math.abs(h) / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function getActiveStage(frame) {
    let active = 0;
    for (let index = 1; index < stages.length; index += 1) {
      if (frame >= stages[index].start) active = index;
    }
    return active;
  }

  function clamp(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * clamp(amount);
  }

  function smoothstep(edge0, edge1, value) {
    const amount = clamp((value - edge0) / Math.max(0.000001, edge1 - edge0));
    return amount * amount * (3 - 2 * amount);
  }

  function easeInOut(value) {
    const amount = clamp(value);
    return amount < 0.5 ? 4 * amount * amount * amount : 1 - Math.pow(-2 * amount + 2, 3) / 2;
  }

  function easeOutBack(value) {
    const amount = clamp(value);
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(amount - 1, 3) + c1 * Math.pow(amount - 1, 2);
  }

  function hexAlpha(hex, alpha) {
    const clean = hex.replace("#", "");
    const value = Number.parseInt(clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean, 16);
    const red = (value >> 16) & 255;
    const green = (value >> 8) & 255;
    const blue = value & 255;
    return `rgba(${red},${green},${blue},${clamp(alpha)})`;
  }
}
