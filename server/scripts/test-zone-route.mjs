import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildZoneRoute,
  distancePointToPolyline,
  haversineDistance,
  improveTwoOpt,
  nearestNeighborOrder,
  normalizeRouteRequest,
  optimizeStopOrder
} from "../lib/zone-route-service.mjs";
import { isZoneDiscoveryApiRequest } from "../api/zone-discovery-api.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const start = { lat: 43.462586, lng: -3.809988 };
const mixedStops = [
  { id: "catedral", name: "Catedral", category: "monumento", type: "poi", lat: 43.460491, lng: -3.807933 },
  { id: "jardines", name: "Jardines", category: "naturaleza", type: "poi", lat: 43.464671, lng: -3.803913 },
  { id: "mirador", name: "Mirador", category: "mirador", type: "poi", lat: 43.466151, lng: -3.807112 },
  { id: "restaurante", name: "Restaurante local", category: "gastronomía", type: "business", lat: 43.461834, lng: -3.812431 }
];
const scenicCandidates = [
  { id: "monumento-paso", name: "Monumento de paso", category: "monumento", type: "poi", lat: 43.46355, lng: -3.8069 },
  { id: "tienda-fuera", name: "Tienda fuera", category: "comercio", type: "business", lat: 43.49, lng: -3.84 }
];

const nearest = nearestNeighborOrder(start, mixedStops);
const improved = improveTwoOpt(start, nearest);
assert.equal(optimizeStopOrder(start, mixedStops).length, 4);
assert.ok(openDistance(improved) <= openDistance(nearest) + 0.01);
assert.deepEqual(new Set(improved.map((stop) => stop.id)), new Set(mixedStops.map((stop) => stop.id)));

assert.ok(distancePointToPolyline(
  { lat: 43.4626, lng: -3.808 },
  { type: "LineString", coordinates: [[-3.81, 43.4626], [-3.806, 43.4626]] }
) < 5);

const fastestCalls = [];
const fastest = await buildZoneRoute({ start, stops: mixedStops, profile: "foot", mode: "fastest" }, {
  endpointByProfile: { foot: "http://osrm-foot.test" },
  fetchImpl: fakeOsrm(fastestCalls)
});
assert.equal(fastestCalls.length, 1);
assert.equal(fastest.approximate, false);
assert.equal(fastest.stops.length, 4);
assert.equal(fastest.alternatives.length, 0);
assert.ok(fastest.distanceMeters > 0);
assert.equal(fastestCalls[0].searchParams.get("alternatives"), "false");

const scenicCalls = [];
const scenic = await buildZoneRoute({
  start,
  stops: mixedStops,
  scenicCandidates,
  profile: "bike",
  mode: "scenic"
}, {
  endpointByProfile: { bike: "http://osrm-bike.test" },
  fetchImpl: fakeOsrm(scenicCalls)
});
assert.equal(scenicCalls.length, 2);
assert.equal(scenic.stops.length, 4);
assert.ok(scenic.scenicStops.length > 0 && scenic.scenicStops.length <= 2);
assert.ok(scenic.scenicStops.every((stop) => stop.category === "monumento"));

const scenicFallbackCalls = [];
const scenicBaselineFetch = fakeOsrm(scenicFallbackCalls);
let scenicFallbackCall = 0;
const scenicFallback = await buildZoneRoute({
  start,
  stops: mixedStops,
  scenicCandidates,
  profile: "foot",
  mode: "scenic"
}, {
  endpointByProfile: { foot: "http://osrm-foot.test" },
  fetchImpl: async (...args) => {
    scenicFallbackCall += 1;
    if (scenicFallbackCall === 1) return scenicBaselineFetch(...args);
    return new Response(JSON.stringify({ code: "NoRoute", routes: [] }), { status: 200 });
  }
});
assert.equal(scenicFallback.approximate, false);
assert.equal(scenicFallback.scenicStops.length, 0);
assert.match(scenicFallback.warning, /desvío panorámico/);

const alternativeCalls = [];
const withAlternatives = await buildZoneRoute({
  start,
  stops: mixedStops.slice(0, 2),
  profile: "car",
  mode: "fastest"
}, {
  endpointByProfile: { car: "http://osrm-car.test" },
  fetchImpl: fakeOsrm(alternativeCalls, { alternatives: 3 })
});
assert.equal(alternativeCalls[0].searchParams.get("alternatives"), "true");
assert.equal(withAlternatives.alternatives.length, 2);

const approximate = await buildZoneRoute({ start, stops: mixedStops, profile: "foot", mode: "fastest" }, {
  endpointByProfile: { foot: "http://osrm-down.test" },
  fetchImpl: async () => { throw new TypeError("connection refused"); }
});
assert.equal(approximate.approximate, true);
assert.match(approximate.warning, /Ruta aproximada/);
assert.equal(approximate.geometry.coordinates.length, 5);

let visualRouteNetworkCalls = 0;
const visualRoute = await buildZoneRoute({
  start,
  stops: mixedStops,
  profile: "foot",
  mode: "fastest",
  visualOnly: true
}, {
  endpointByProfile: { foot: "http://osrm-must-not-run.test" },
  fetchImpl: async () => {
    visualRouteNetworkCalls += 1;
    throw new Error("Visual itineraries must not call a routing provider");
  }
});
assert.equal(visualRouteNetworkCalls, 0);
assert.equal(visualRoute.visualOnly, true);
assert.equal(visualRoute.id, "itinerary-visual");
assert.equal(visualRoute.stops.length, 4);
assert.match(visualRoute.warning, /arcos indican el orden/);

await assert.rejects(
  () => buildZoneRoute({ start, stops: mixedStops, profile: "foot", mode: "fastest" }, {
    endpointByProfile: { foot: "http://osrm-noroute.test" },
    fetchImpl: async () => new Response(JSON.stringify({ code: "NoRoute", routes: [] }), { status: 200 })
  }),
  (error) => error.code === "zone_route_not_found" && error.statusCode === 422 && error.details.unreachableStops.length === 4
);

assert.throws(
  () => normalizeRouteRequest({ start, stops: mixedStops, profile: "car", mode: "scenic" }),
  (error) => error.code === "zone_route_scenic_car"
);
assert.throws(
  () => normalizeRouteRequest({ start, stops: mixedStops.slice(0, 1), profile: "foot", mode: "fastest" }),
  (error) => error.code === "zone_route_stop_count"
);
assert.equal(isZoneDiscoveryApiRequest("/api/zone/route"), true);

const publicUi = await readFile(path.join(root, "src/business/zone-discovery.js"), "utf8");
const publicCss = await readFile(path.join(root, "src/styles/zone-discovery.css"), "utf8");
const api = await readFile(path.join(root, "server/api/zone-discovery-api.mjs"), "utf8");
const compose = await readFile(path.join(root, "infra/osrm/docker-compose.yml"), "utf8");
assert.match(publicUi, /data-route-toggle/);
assert.match(publicUi, /navigator\.geolocation\.getCurrentPosition/);
assert.match(publicUi, /Toca el mapa para marcar tu punto de partida/);
assert.match(publicUi, /routeProfileButton\("foot", "A pie"\)/);
assert.doesNotMatch(publicUi, /data-route-mode="scenic"/);
assert.match(publicUi, /recorrido real en Google Maps/);
assert.match(publicUi, /visualOnly: true/);
assert.match(publicUi, /zone-itinerary-overlay/);
assert.doesNotMatch(publicUi, /addRouteLine|zone-route-line-active/);
assert.match(publicCss, /zoneItineraryFlight/);
assert.match(publicCss, /#e07a3f/i);
assert.match(publicCss, /#a87c3d/i);
assert.match(publicCss, /#4a7a5e/i);
assert.match(publicCss, /#3d6b87/i);
assert.match(api, /buildZoneRoute/);
assert.doesNotMatch(api + publicUi, /directions\.googleapis|api\.mapbox\.com/i);
assert.match(compose, /spain-foot\.osrm/);
assert.match(compose, /spain-bike\.osrm/);
assert.match(compose, /spain-car\.osrm/);

console.log("Modo Ruta checks passed: visual itinerary without provider calls, four mixed stops, nearest-neighbor + 2-opt, legacy OSRM compatibility and animated public UI.");

function fakeOsrm(calls, options = {}) {
  return async (input) => {
    const url = new URL(String(input));
    calls.push(url);
    const encodedCoordinates = url.pathname.split("/").at(-1);
    const coordinates = decodeURIComponent(encodedCoordinates).split(";").map((value) => value.split(",").map(Number));
    const legs = [];
    let distance = 0;
    for (let index = 1; index < coordinates.length; index += 1) {
      const segment = haversineDistance(
        { lng: coordinates[index - 1][0], lat: coordinates[index - 1][1] },
        { lng: coordinates[index][0], lat: coordinates[index][1] }
      );
      distance += segment;
      legs.push({ distance: segment, duration: segment / 1.35 });
    }
    const route = {
      distance,
      duration: distance / 1.35,
      geometry: { type: "LineString", coordinates },
      legs
    };
    const count = url.searchParams.get("alternatives") === "true" ? Number(options.alternatives || 1) : 1;
    return new Response(JSON.stringify({
      code: "Ok",
      routes: Array.from({ length: count }, (_, index) => ({
        ...route,
        distance: route.distance * (1 + index * 0.08),
        duration: route.duration * (1 + index * 0.06)
      }))
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
}

function openDistance(stops) {
  let cursor = start;
  return stops.reduce((sum, stop) => {
    const value = haversineDistance(cursor, stop);
    cursor = stop;
    return sum + value;
  }, 0);
}
