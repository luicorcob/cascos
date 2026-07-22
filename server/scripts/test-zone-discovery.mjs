import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import {
  buildZonePreview,
  buildZoneOverpassQuery,
  calculateAffinityScore,
  calculatePoiRelevance,
  getConnectionType,
  normalizeOverpassPoi,
  optimizeWikimediaImageUrl,
  selectVariedPois,
  walkingMinutes
} from "../lib/zone-discovery-service.mjs";
import {
  isEditorialImage,
  nameMatchScore,
  resolvePoiSource,
  truncateAtSentence,
  truncateAtWord
} from "../lib/zone-content-enrichment.mjs";
import { isZoneDiscoveryApiRequest } from "../api/zone-discovery-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

assert.equal(calculateAffinityScore({ categoryWeight: 90, distanceWeight: 80, interactionWeight: 0 }), 69);
assert.equal(getConnectionType("Restaurante", "Restaurante de fuego lento"), "competidor");
assert.equal(getConnectionType("Hotel", "Restaurante"), "complementario");
assert.equal(walkingMinutes(320), 4);

const query = buildZoneOverpassQuery({ lat: 43.462586, lng: -3.809988 }, 1500);
assert.match(query, /historic/);
assert.match(query, /tourism/);
assert.match(query, /leisure"~"\^\(park\|nature_reserve\|garden\)\$/);
assert.match(query, /man_made"="lighthouse/);

const wikidataPoi = normalizeOverpassPoi({
  id: 44,
  type: "node",
  lat: 43.46,
  lon: -3.81,
  tags: { name: "Lugar documentado", tourism: "museum", wikidata: "Q123" }
});
assert.equal(wikidataPoi.source, "wikidata");
assert.equal(wikidataPoi.externalRef, "Q123");
assert.equal(wikidataPoi.category, "cultura");
assert.equal(wikidataPoi.verified, true);

const wikipediaPoi = normalizeOverpassPoi({
  id: 45,
  type: "way",
  center: { lat: 43.461, lon: -3.811 },
  tags: { name: "Plaza documentada", place: "square", wikipedia: "es:Plaza documentada" }
});
assert.equal(wikipediaPoi.source, "wikipedia");
assert.equal(wikipediaPoi.externalRef, "Plaza documentada");

const documented = { ...wikidataPoi, id: "documented", distanceMeters: 700, imageUrl: "https://upload.wikimedia.org/place.jpg", descriptionShort: "Resumen", descriptionLong: "Historia documentada." };
const genericNearby = { ...wikipediaPoi, id: "generic", source: "osm", verified: false, distanceMeters: 20, imageUrl: "", descriptionShort: "", descriptionLong: "" };
assert.ok(calculatePoiRelevance(documented) > calculatePoiRelevance(genericNearby));
assert.equal(selectVariedPois([genericNearby, documented], 1)[0].id, "documented");
assert.ok(
  calculatePoiRelevance({ ...documented, name: "Catedral de la ciudad" })
  > calculatePoiRelevance({ ...documented, name: "Iglesia del barrio" })
);
assert.equal(nameMatchScore("Iglesia de la AnunciaciÃ³n", "Iglesia de la AnunciaciÃ³n (Santander)"), 1);
assert.equal(nameMatchScore("Parque Recadero", "Catedral de Santander"), 0);
assert.equal(isEditorialImage("https://upload.wikimedia.org/place.jpg"), true);
assert.equal(isEditorialImage("https://upload.wikimedia.org/Centro_Botin_Logo.svg/langes-1280px-Centro_Botin_Logo.svg.png"), false);
assert.equal(
  optimizeWikimediaImageUrl("https://upload.wikimedia.org/wikipedia/commons/a/a9/Lugar.jpg"),
  "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Lugar.jpg/1280px-Lugar.jpg"
);
assert.equal(
  optimizeWikimediaImageUrl("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Lugar.jpg/3840px-Lugar.jpg"),
  "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/Lugar.jpg/1280px-Lugar.jpg"
);

const exactShort = truncateAtWord("Una descripción documental que no debe cortar la última palabra aunque alcance el límite configurado para la tarjeta pública.", 70);
assert.ok(exactShort.length <= 70);
assert.ok(!exactShort.endsWith("últ"));

const longExtract = Array.from({ length: 4 }, (_, index) => `La frase ${index + 1} conserva su final completo y aporta contexto documental suficiente para la prueba automática.`).join(" ");
const sentenceCut = truncateAtSentence(longExtract, 25);
assert.match(sentenceCut, /\.$/);
assert.ok(sentenceCut.split(/\s+/).length <= 25 || sentenceCut.split(/\s+/).length === longExtract.split(/\s+/)[0]);

const calls = [];
const fakeFetch = async (url) => {
  calls.push(String(url));
  if (String(url).includes("wikidata.org")) {
    return new Response(JSON.stringify({ entities: { Q123: { sitelinks: { eswiki: { title: "Lugar documentado" } } } } }), { status: 200 });
  }
  return new Response(JSON.stringify({
    title: "Lugar documentado",
    extract: "Resumen directo de Wikipedia. Conserva información verificable y una segunda frase completa.",
    originalimage: { source: "https://upload.wikimedia.org/example.jpg" }
  }), { status: 200 });
};
const resolved = await resolvePoiSource(wikidataPoi, { fetchImpl: fakeFetch, timeoutMs: 5000 });
assert.equal(resolved.source, "wikipedia");
assert.equal(resolved.externalRef, "Lugar documentado");
assert.equal(calls.length, 2);

assert.equal(isZoneDiscoveryApiRequest("/api/public/brasa-norte/zone"), true);
assert.equal(isZoneDiscoveryApiRequest("/api/public/brasa-norte/zone/events"), true);
assert.equal(isZoneDiscoveryApiRequest("/api/businesses/biz_demo/zone/settings"), true);
assert.equal(isZoneDiscoveryApiRequest("/api/zone-discovery/preview"), true);
await assert.rejects(
  () => buildZonePreview({ coordinates: { lat: 120, lng: 0 } }),
  (error) => error.code === "zone_preview_coordinates_invalid" && error.statusCode === 422
);

const executableFiles = [
  "server/lib/zone-content-enrichment.mjs",
  "server/lib/zone-discovery-service.mjs",
  "server/api/zone-discovery-api.mjs",
  "src/business/zone-discovery.js",
  "src/developer/zone-playground.js"
];
const executableText = (await Promise.all(executableFiles.map((file) => readFile(path.join(root, file), "utf8")))).join("\n");
assert.doesNotMatch(executableText, /api\.anthropic|ANTHROPIC_API_KEY|claude-sonnet/i);
assert.match(executableText, /Fuente: Wikipedia/);

const publicUi = await readFile(path.join(root, "src/business/zone-discovery.js"), "utf8");
const publicCss = await readFile(path.join(root, "src/styles/zone-discovery.css"), "utf8");
const adminUi = await readFile(path.join(root, "src/business/zone-admin.js"), "utf8");
const playgroundUi = await readFile(path.join(root, "src/developer/zone-playground.js"), "utf8");
const apiConfig = await readFile(path.join(root, "src/shared/api-config.js"), "utf8");
const playgroundPage = await readFile(path.join(root, "pages/zone-playground.html"), "utf8");
const workspace = await readFile(path.join(root, "workspace.html"), "utf8");
assert.match(publicUi, /basemaps\.cartocdn\.com\/light_all/);
assert.match(publicUi, /data-zone-directions/);
assert.match(publicCss, /flex:\s*0 0 40%/);
assert.match(adminUi, /Activar Descubre tu zona/);
assert.match(adminUi, /visita potencial/);
assert.match(playgroundUi, /navigator\.geolocation\.getCurrentPosition/);
assert.match(playgroundUi, /\/api\/zone-discovery\/preview/);
assert.match(playgroundUi, /map\.on\("click"/);
assert.match(playgroundUi, /No se pudo conectar con el backend DLS/);
assert.match(apiConfig, /protocol === "file:"/);
const localStorageValues = new Map();
const fileWindow = {
  location: { protocol: "file:", hostname: "", port: "", search: "", href: "file:///pages/zone-playground.html" },
  LOCALLIFT_API_BASE: ""
};
fileWindow.window = fileWindow;
runInNewContext(apiConfig, {
  window: fileWindow,
  document: { querySelector: () => null },
  localStorage: {
    getItem: (key) => localStorageValues.get(key) || null,
    setItem: (key, value) => localStorageValues.set(key, String(value)),
    removeItem: (key) => localStorageValues.delete(key)
  },
  URL,
  URLSearchParams
});
assert.equal(fileWindow.LocalLiftApi.url("/api/zone-discovery/preview"), "http://127.0.0.1:5173/api/zone-discovery/preview");
assert.match(playgroundPage, /Probar esta ubicación/);
assert.match(workspace, /pages\/zone-playground\.html/);

console.log("Descubre tu zona checks passed: affinity, Overpass, source enrichment, API routes, public UI, client controls and developer playground.");
