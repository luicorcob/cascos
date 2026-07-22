import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const port = 6800 + Math.floor(Math.random() * 300);
const debugPort = 9800 + Math.floor(Math.random() * 300);
const fixtureName = `.tmp-zone-route-browser-${process.pid}.html`;
const fixturePath = path.join(root, fixtureName);
const fixtureUrl = `http://127.0.0.1:${port}/${fixtureName}`;
const profile = await mkdtemp(path.join(os.tmpdir(), "dls-zone-route-browser-"));
const screenshotDirectory = process.env.ZONE_ROUTE_BROWSER_SCREENSHOTS
  ? path.resolve(process.env.ZONE_ROUTE_BROWSER_SCREENSHOTS)
  : "";
const chrome = await findChrome();

await writeFile(fixturePath, fixtureHtml(), "utf8");
const server = spawn(process.execPath, ["server/server.mjs"], {
  cwd: root,
  env: {
    ...process.env,
    HOST: "127.0.0.1",
    PORT: String(port),
    OSRM_ROUTE_TIMEOUT_MS: "500",
    OSRM_FOOT_URL: "http://127.0.0.1:1",
    OSRM_BIKE_URL: "http://127.0.0.1:1",
    OSRM_CAR_URL: "http://127.0.0.1:1"
  },
  stdio: "ignore",
  windowsHide: true
});
let browser;
let cdp;

try {
  if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true });
  await waitForUrl(fixtureUrl);
  await assertServerRouteFallback();
  browser = spawn(chrome, [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-background-networking",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    "about:blank"
  ], { stdio: "ignore", windowsHide: true });
  const page = await waitForPage(debugPort);
  cdp = await createCdpClient(page.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  await setViewport(1365, 900, false);
  await cdp.send("Page.navigate", { url: fixtureUrl });
  await waitForExpression('document.querySelector("[data-zone-open]")');
  await evaluate('document.querySelector("[data-zone-open]").click()');
  await waitForExpression('document.querySelector(".zone-discovery-modal").classList.contains("is-open")');
  await waitForExpression('window.__leafletMap');
  await evaluate(`
    [...document.querySelectorAll("[data-route-toggle]")].slice(0, 4).forEach((button) => button.click());
  `);
  assert.equal(await evaluate('document.querySelector("[data-route-count]").textContent'), "4");
  assert.equal(await evaluate('document.querySelector("[data-route-launch-bar]").hidden'), false);

  await evaluate('document.querySelector("[data-route-launch]").click()');
  assert.equal(await evaluate('document.querySelector("[data-route-consent]").hidden'), false);
  assert.equal(await evaluate('window.__geolocationRequests'), 0, "Geolocation must not run before contextual consent");
  await evaluate('document.querySelector("[data-route-use-manual]").click()');
  assert.equal(await evaluate('document.querySelector("[data-route-manual]").hidden'), false);
  await evaluate('window.__leafletMap.fire("click", { latlng: { lat: 43.462586, lng: -3.809988 } })');
  assert.equal(await evaluate('document.querySelector("[data-route-confirm-start]").disabled'), false);
  await evaluate('document.querySelector("[data-route-confirm-start]").click()');
  assert.equal(await evaluate('document.querySelector("[data-route-calculate]").disabled'), false);
  await evaluate('document.querySelector("[data-route-calculate]").click()');
  await waitForExpression('!document.querySelector("[data-route-summary]").hidden');
  assert.equal(await evaluate('document.querySelectorAll(".zone-route-stop-list li").length'), 4);
  assert.match(await evaluate('document.querySelector("[data-route-summary]").textContent'), /Google Maps/);
  assert.equal(await evaluate('window.__routeRequests'), 1);

  await evaluate(`document.querySelector('[data-route-profile="bike"]').click()`);
  await waitForExpression('window.__routeRequests === 2');
  assert.equal(await evaluate(`document.querySelector('[data-route-profile="bike"]').getAttribute("aria-pressed")`), "true");
  await evaluate(`document.querySelector('[data-route-profile="car"]').click()`);
  await waitForExpression('window.__routeRequests === 3');
  assert.equal(await evaluate(`document.querySelector('[data-route-mode="scenic"]').disabled`), true);
  assert.equal(await evaluate(`document.querySelector('[data-route-mode="scenic"]').title`), "No disponible en coche");
  await captureScreenshot("desktop");

  await setViewport(390, 844, true);
  assert.equal(await evaluate('getComputedStyle(document.querySelector("[data-route-workspace]")).position'), "fixed");
  assert.ok(await evaluate('document.querySelector("[data-route-workspace]").getBoundingClientRect().height <= innerHeight * .61'));
  const mobileLayout = await evaluate('({ panelTop: document.querySelector("[data-route-workspace]").getBoundingClientRect().top, mapBottom: document.querySelector(".zone-map-panel").getBoundingClientRect().bottom, viewport: innerHeight })');
  assert.ok(mobileLayout.panelTop >= mobileLayout.mapBottom - 2, JSON.stringify(mobileLayout));
  await captureScreenshot("mobile");

  assert.deepEqual(await evaluate('window.__zoneErrors'), []);
  console.log("Modo Ruta browser checks passed: contextual consent, four selections, manual pin, recalculation, car/scenic rule, desktop and mobile summary.");
} finally {
  try { await cdp?.send("Browser.close"); } catch { browser?.kill(); }
  cdp?.close();
  server.kill();
  await delay(250);
  await rm(profile, { recursive: true, force: true }).catch(() => {});
  await rm(fixturePath, { force: true }).catch(() => {});
}

async function setViewport(width, height, mobile) {
  await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
}

async function captureScreenshot(name) {
  if (!screenshotDirectory) return;
  const screenshot = await cdp.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await writeFile(path.join(screenshotDirectory, `zone-route-${name}.png`), Buffer.from(screenshot.data, "base64"));
}

async function evaluate(expression) {
  const result = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "Browser evaluation failed");
  return result.result.value;
}

async function waitForExpression(expression, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await delay(80);
  }
  throw new Error(`Timed out waiting for: ${expression}`);
}

async function waitForUrl(url, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await delay(100);
  }
  throw new Error(`Server did not answer at ${url}`);
}

async function assertServerRouteFallback() {
  const response = await fetch(`http://127.0.0.1:${port}/api/zone/route`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      start: { lat: 43.462586, lng: -3.809988 },
      profile: "foot",
      mode: "fastest",
      stops: [
        { id: "catedral", name: "Catedral", category: "monumento", lat: 43.460491, lng: -3.807933 },
        { id: "jardines", name: "Jardines", category: "naturaleza", lat: 43.464671, lng: -3.803913 },
        { id: "mirador", name: "Mirador", category: "mirador", lat: 43.466151, lng: -3.807112 },
        { id: "restaurante", name: "Restaurante local", category: "gastronomía", lat: 43.461834, lng: -3.812431 }
      ]
    }),
    signal: AbortSignal.timeout(5000)
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.route.approximate, true);
  assert.equal(payload.route.stops.length, 4);
  assert.match(payload.route.warning, /Ruta aproximada/);
}

async function waitForPage(portNumber, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const pages = await fetch(`http://127.0.0.1:${portNumber}/json`).then((response) => response.json());
      const page = pages.find((item) => item.type === "page");
      if (page) return page;
    } catch {}
    await delay(100);
  }
  throw new Error("Chrome DevTools endpoint did not become ready");
}

async function createCdpClient(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  let sequence = 0;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id || !pending.has(message.id)) return;
    const task = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error.message));
    else task.resolve(message.result || {});
  });
  return {
    send(method, params = {}) {
      const id = ++sequence;
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
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium"
  ];
  for (const candidate of candidates) {
    try { await access(candidate); return candidate; } catch {}
  }
  throw new Error("Chrome or Chromium is required for the Modo Ruta browser test");
}

function fixtureHtml() {
  const recommendations = [
    ["catedral", "Catedral", "monumento", 43.460491, -3.807933],
    ["jardines", "Jardines", "naturaleza", 43.464671, -3.803913],
    ["mirador", "Mirador", "mirador", 43.466151, -3.807112],
    ["restaurante", "Restaurante local", "gastronomía", 43.461834, -3.812431],
    ["plaza", "Plaza", "plaza", 43.4632, -3.811],
    ["museo", "Museo", "cultura", 43.464, -3.805]
  ].map(([id, name, category, latitude, longitude], index) => ({
    id: `poi:${id}`,
    targetPoiId: `00000000-0000-4000-8000-0000000000${String(index + 1).padStart(2, "0")}`,
    type: index === 3 ? "business" : "poi",
    targetBusinessId: index === 3 ? "00000000-0000-4000-8000-000000000099" : undefined,
    name,
    category,
    badge: "Selección local",
    descriptionShort: "Un lugar de prueba para validar el itinerario.",
    descriptionLong: "",
    hasLongDescription: false,
    imageUrl: "",
    latitude,
    longitude,
    walkingMinutes: index + 2,
    directionsUrl: "https://www.google.com/maps"
  }));
  const zone = {
    enabled: true,
    available: true,
    zone: "Santander",
    host: { id: "fixture", name: "Negocio anfitrión", latitude: 43.462586, longitude: -3.809988, accent: "#8f5935" },
    recommendations
  };
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles/zone-discovery.css"><style>html,body{margin:0;font-family:Arial,sans-serif}.generated-site{min-height:100vh;background:#eee}.leaflet-control-container{display:none}</style></head><body>
    <main class="generated-site"><div data-zone-discovery-slot></div></main>
    <script id="locallift-export-data" type="application/json">{"business":{"id":"fixture","slug":"fixture"}}</script>
    <script>
      window.__zoneErrors=[]; window.__routeRequests=0; window.__geolocationRequests=0;
      addEventListener("error",event=>window.__zoneErrors.push(String(event.message||event.error)));
      addEventListener("unhandledrejection",event=>window.__zoneErrors.push(String(event.reason)));
      navigator.geolocation.getCurrentPosition=()=>{window.__geolocationRequests+=1};
      const layer=point=>({point,events:{},dragging:{enable(){},disable(){}},addTo(){return this},bindTooltip(){return this},bindTooltip(){return this},openTooltip(){},setLatLng(next){this.point=Array.isArray(next)?{lat:next[0],lng:next[1]}:next;return this},getLatLng(){return this.point?.lat!==undefined?this.point:{lat:this.point[0],lng:this.point[1]}},setRadius(){return this},on(name,fn){this.events[name]=fn;return this},off(name){if(name)delete this.events[name];else this.events={};return this},remove(){},getElement(){return null}});
      window.L={
        map(){const map={events:{},setView(){return this},invalidateSize(){return this},fitBounds(){return this},flyTo(){return this},on(name,fn){this.events[name]=fn;return this},off(name){delete this.events[name];return this},fire(name,event){this.events[name]?.(event)}};window.__leafletMap=map;return map},
        tileLayer(){return {addTo(){return this}}},marker(point){return layer({lat:Number(point[0]),lng:Number(point[1])})},circle(point){return layer({lat:Number(point[0]),lng:Number(point[1])})},polyline(){return layer({lat:0,lng:0})},divIcon(value){return value},
        latLngBounds(){return {pad(){return this}}}
      };
      const zone=${JSON.stringify(zone)};
      const originalFetch=window.fetch.bind(window);
      window.fetch=async(url,options={})=>{
        const target=String(url);
        if(target.includes("/api/public/fixture/zone/events"))return new Response("{}",{status:201,headers:{"content-type":"application/json"}});
        if(target.includes("/api/public/fixture/zone"))return new Response(JSON.stringify({zone}),{status:200,headers:{"content-type":"application/json"}});
        if(target.includes("/api/zone/route")){
          window.__routeRequests+=1; const request=JSON.parse(options.body); let elapsed=0;
          const stops=request.stops.map((stop,index)=>{elapsed+=(index+1)*240;return {...stop,durationFromStartSeconds:elapsed}});
          const coordinates=[[request.start.lng,request.start.lat],...stops.map(stop=>[stop.lng,stop.lat])];
          return new Response(JSON.stringify({route:{id:"route-0",profile:request.profile,mode:request.mode,approximate:false,warning:"",distanceMeters:2750,durationSeconds:elapsed,geometry:{type:"LineString",coordinates},stops,scenicStops:[],alternatives:[]}}),{status:200,headers:{"content-type":"application/json"}})
        }
        return originalFetch(url,options)
      };
    </script><script src="/src/business/zone-discovery.js"></script></body></html>`;
}

function delay(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }
