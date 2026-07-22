const ROUTE_PROFILES = new Set(["foot", "bike", "car"]);
const ROUTE_MODES = new Set(["fastest", "scenic"]);
const SCENIC_CATEGORIES = new Set(["monumento", "mirador", "naturaleza"]);
const PROFILE_SPEED_METERS_SECOND = { foot: 1.35, bike: 4.2, car: 11.1 };
const DEFAULT_ENDPOINTS = {
  foot: "http://127.0.0.1:5001",
  bike: "http://127.0.0.1:5002",
  car: "http://127.0.0.1:5000"
};

export async function buildZoneRoute(input = {}, options = {}) {
  const request = normalizeRouteRequest(input);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const endpoint = clean(options.endpointByProfile?.[request.profile]) || osrmEndpoint(request.profile);
  const timeoutMs = clampNumber(options.timeoutMs ?? process.env.OSRM_ROUTE_TIMEOUT_MS, 500, 30000, 5500);
  const orderedStops = optimizeStopOrder(request.start, request.stops);
  let routedWaypoints = orderedStops.map((stop) => ({ ...stop, ghost: false }));
  let scenicStops = [];
  let scenicBaseline = null;

  try {
    if (request.mode === "scenic") {
      scenicBaseline = await requestOsrmRoute({
        endpoint,
        profile: request.profile,
        start: request.start,
        waypoints: routedWaypoints,
        alternatives: false,
        fetchImpl,
        timeoutMs
      });
      scenicStops = selectScenicStops({
        start: request.start,
        orderedStops,
        candidates: request.scenicCandidates,
        geometry: scenicBaseline.routes[0]?.geometry
      });
      routedWaypoints = insertScenicStops(orderedStops, scenicStops);
    }

    const result = await requestOsrmRoute({
      endpoint,
      profile: request.profile,
      start: request.start,
      waypoints: routedWaypoints,
      alternatives: orderedStops.length === 2,
      fetchImpl,
      timeoutMs
    });
    return routeResponse(result.routes, request, routedWaypoints, scenicStops);
  } catch (error) {
    if (scenicBaseline && scenicStops.length) {
      const baselineRoute = routeResponse(
        scenicBaseline.routes,
        request,
        orderedStops.map((stop) => ({ ...stop, ghost: false })),
        []
      );
      baselineRoute.warning = error.code === "zone_route_not_found"
        ? "No se pudo conectar el desvío panorámico; mostramos la mejor ruta disponible"
        : "El segundo cálculo panorámico no respondió; mostramos el trazado real de base";
      return baselineRoute;
    }
    if (error.code === "zone_route_not_found") {
      const unreachableStops = await diagnoseUnreachableStops({
        endpoint,
        profile: request.profile,
        start: request.start,
        orderedStops,
        fetchImpl,
        timeoutMs
      });
      throw routeError(422, "No se pudo conectar una o más paradas con el perfil elegido", "zone_route_not_found", {
        profile: request.profile,
        unreachableStops: unreachableStops.length ? unreachableStops : orderedStops.map(publicStop)
      });
    }
    if (!isOsrmUnavailable(error)) throw error;
    return approximateRouteResponse(request, orderedStops);
  }
}

export function normalizeRouteRequest(input = {}) {
  const profile = clean(input.profile).toLowerCase() || "foot";
  const mode = clean(input.mode).toLowerCase() || "fastest";
  if (!ROUTE_PROFILES.has(profile)) {
    throw routeError(422, "Perfil de transporte no válido", "zone_route_profile_invalid");
  }
  if (!ROUTE_MODES.has(mode)) {
    throw routeError(422, "Modo de ruta no válido", "zone_route_mode_invalid");
  }
  if (profile === "car" && mode === "scenic") {
    throw routeError(422, "La ruta panorámica no está disponible en coche", "zone_route_scenic_car");
  }
  const start = normalizeCoordinate(input.start, "punto de partida");
  const rawStops = Array.isArray(input.stops) ? input.stops : [];
  if (rawStops.length < 2 || rawStops.length > 6) {
    throw routeError(422, "Selecciona entre 2 y 6 paradas", "zone_route_stop_count");
  }
  const stops = rawStops.map((stop, index) => normalizeStop(stop, index, false));
  if (new Set(stops.map((stop) => stop.id)).size !== stops.length) {
    throw routeError(422, "Las paradas no pueden estar duplicadas", "zone_route_stop_duplicate");
  }
  const selectedIds = new Set(stops.map((stop) => stop.id));
  const scenicCandidates = (Array.isArray(input.scenicCandidates) ? input.scenicCandidates : [])
    .slice(0, 12)
    .map((stop, index) => normalizeStop(stop, index, true))
    .filter((stop) => SCENIC_CATEGORIES.has(normalizeCategory(stop.category)))
    .filter((stop) => !selectedIds.has(stop.id));
  return { start, stops, scenicCandidates, profile, mode };
}

export function optimizeStopOrder(start, stops = []) {
  const nearest = nearestNeighborOrder(start, stops);
  return improveTwoOpt(start, nearest);
}

export function nearestNeighborOrder(start, stops = []) {
  const pending = stops.map((stop) => ({ ...stop }));
  const ordered = [];
  let cursor = start;
  while (pending.length) {
    pending.sort((left, right) => (
      haversineDistance(cursor, left) - haversineDistance(cursor, right)
      || left.id.localeCompare(right.id)
    ));
    const next = pending.shift();
    ordered.push(next);
    cursor = next;
  }
  return ordered;
}

export function improveTwoOpt(start, stops = []) {
  let best = stops.map((stop) => ({ ...stop }));
  let bestDistance = openRouteDistance(start, best);
  let improved = true;
  let passes = 0;
  while (improved && passes < 12) {
    improved = false;
    passes += 1;
    for (let left = 0; left < best.length - 1; left += 1) {
      for (let right = left + 1; right < best.length; right += 1) {
        const candidate = [
          ...best.slice(0, left),
          ...best.slice(left, right + 1).reverse(),
          ...best.slice(right + 1)
        ];
        const distance = openRouteDistance(start, candidate);
        if (distance + 0.01 < bestDistance) {
          best = candidate;
          bestDistance = distance;
          improved = true;
        }
      }
    }
  }
  return best;
}

export function distancePointToPolyline(point, geometry) {
  const coordinates = Array.isArray(geometry?.coordinates) ? geometry.coordinates : [];
  if (!coordinates.length) return Number.POSITIVE_INFINITY;
  if (coordinates.length === 1) {
    return haversineDistance(point, { lat: coordinates[0][1], lng: coordinates[0][0] });
  }
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < coordinates.length - 1; index += 1) {
    const start = { lat: coordinates[index][1], lng: coordinates[index][0] };
    const end = { lat: coordinates[index + 1][1], lng: coordinates[index + 1][0] };
    minimum = Math.min(minimum, pointToSegmentDistance(point, start, end).distanceMeters);
  }
  return minimum;
}

export function haversineDistance(left, right) {
  const lat1 = toRadians(Number(left?.lat));
  const lat2 = toRadians(Number(right?.lat));
  const deltaLat = toRadians(Number(right?.lat) - Number(left?.lat));
  const deltaLng = toRadians(Number(right?.lng) - Number(left?.lng));
  const value = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)));
}

function selectScenicStops({ start, orderedStops, candidates, geometry }) {
  const selectedCoordinates = [start, ...orderedStops];
  return candidates
    .map((candidate) => {
      const deviationMeters = distancePointToPolyline(candidate, geometry);
      let insertionSegment = 0;
      let segmentDistance = Number.POSITIVE_INFINITY;
      let segmentProgress = 0;
      for (let index = 0; index < selectedCoordinates.length - 1; index += 1) {
        const projection = pointToSegmentDistance(candidate, selectedCoordinates[index], selectedCoordinates[index + 1]);
        if (projection.distanceMeters < segmentDistance) {
          insertionSegment = index;
          segmentDistance = projection.distanceMeters;
          segmentProgress = projection.progress;
        }
      }
      return { ...candidate, ghost: true, deviationMeters, insertionSegment, segmentProgress };
    })
    .filter((candidate) => candidate.deviationMeters <= 150)
    .sort((left, right) => left.deviationMeters - right.deviationMeters || left.id.localeCompare(right.id))
    .slice(0, 2);
}

function insertScenicStops(orderedStops, scenicStops) {
  const route = [];
  for (let index = 0; index < orderedStops.length; index += 1) {
    scenicStops
      .filter((stop) => stop.insertionSegment === index)
      .sort((left, right) => left.segmentProgress - right.segmentProgress)
      .forEach((stop) => route.push(stop));
    route.push({ ...orderedStops[index], ghost: false });
  }
  return route;
}

async function requestOsrmRoute({ endpoint, profile, start, waypoints, alternatives, fetchImpl, timeoutMs }) {
  const coordinates = [start, ...waypoints]
    .map((point) => `${Number(point.lng).toFixed(6)},${Number(point.lat).toFixed(6)}`)
    .join(";");
  const url = new URL(`${endpoint.replace(/\/+$/, "")}/route/v1/${profile}/${coordinates}`);
  url.searchParams.set("overview", "full");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("steps", "false");
  url.searchParams.set("alternatives", alternatives ? "true" : "false");
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { accept: "application/json", "user-agent": "DLS-Zone-Route/1.0" },
      signal: AbortSignal.timeout(timeoutMs)
    });
  } catch (error) {
    throw osrmUnavailable(error?.name === "TimeoutError" ? "OSRM timeout" : "OSRM unavailable");
  }
  if (!response?.ok) throw osrmUnavailable(`OSRM returned ${response?.status || "an invalid response"}`);
  let payload;
  try { payload = await response.json(); } catch { throw osrmUnavailable("OSRM returned invalid JSON"); }
  if (payload.code === "NoRoute") {
    throw routeError(422, "OSRM could not find a route", "zone_route_not_found");
  }
  if (payload.code !== "Ok" || !Array.isArray(payload.routes) || !payload.routes.length) {
    throw osrmUnavailable(`OSRM returned ${clean(payload.code) || "an empty route"}`);
  }
  return payload;
}

async function diagnoseUnreachableStops({ endpoint, profile, start, orderedStops, fetchImpl, timeoutMs }) {
  const unreachable = [];
  let cursor = start;
  for (const stop of orderedStops) {
    try {
      await requestOsrmRoute({
        endpoint,
        profile,
        start: cursor,
        waypoints: [{ ...stop, ghost: false }],
        alternatives: false,
        fetchImpl,
        timeoutMs: Math.min(timeoutMs, 3000)
      });
      cursor = stop;
    } catch (error) {
      if (error.code === "zone_route_not_found") unreachable.push(publicStop(stop));
      else break;
    }
  }
  return unreachable;
}

function routeResponse(routes, request, waypoints, scenicStops) {
  const processed = routes.slice(0, request.stops.length === 2 ? 3 : 1)
    .map((route, index) => processOsrmRoute(route, waypoints, `route-${index}`));
  const main = processed[0];
  return {
    profile: request.profile,
    mode: request.mode,
    approximate: false,
    warning: "",
    ...main,
    scenicStops: scenicStops.map((stop) => ({ ...publicStop(stop), deviationMeters: Math.round(stop.deviationMeters) })),
    alternatives: processed.slice(1)
  };
}

function processOsrmRoute(route, waypoints, id) {
  const legs = Array.isArray(route.legs) ? route.legs : [];
  let cumulativeSeconds = 0;
  const stops = [];
  waypoints.forEach((waypoint, index) => {
    cumulativeSeconds += Number(legs[index]?.duration || 0);
    if (!waypoint.ghost) {
      stops.push({ ...publicStop(waypoint), durationFromStartSeconds: Math.round(cumulativeSeconds) });
    }
  });
  const coordinates = Array.isArray(route.geometry?.coordinates)
    ? route.geometry.coordinates.map((coordinate) => [Number(coordinate[0]), Number(coordinate[1])])
    : [];
  return {
    id,
    distanceMeters: Math.round(Number(route.distance || 0)),
    durationSeconds: Math.round(Number(route.duration || 0)),
    geometry: { type: "LineString", coordinates },
    stops
  };
}

function approximateRouteResponse(request, orderedStops) {
  const points = [request.start, ...orderedStops];
  const speed = PROFILE_SPEED_METERS_SECOND[request.profile];
  let distanceMeters = 0;
  let durationSeconds = 0;
  const stops = [];
  for (let index = 1; index < points.length; index += 1) {
    distanceMeters += haversineDistance(points[index - 1], points[index]);
    durationSeconds = distanceMeters / speed;
    stops.push({ ...publicStop(orderedStops[index - 1]), durationFromStartSeconds: Math.round(durationSeconds) });
  }
  return {
    profile: request.profile,
    mode: request.mode,
    approximate: true,
    warning: "Ruta aproximada, no se pudo calcular el trazado real",
    id: "route-approximate",
    distanceMeters: Math.round(distanceMeters),
    durationSeconds: Math.round(durationSeconds),
    geometry: {
      type: "LineString",
      coordinates: points.map((point) => [point.lng, point.lat])
    },
    stops,
    scenicStops: [],
    alternatives: []
  };
}

function normalizeStop(stop, index, scenic) {
  const coordinates = normalizeCoordinate(stop, scenic ? `punto panorámico ${index + 1}` : `parada ${index + 1}`);
  return {
    id: safeText(stop?.id, 120) || `${scenic ? "scenic" : "stop"}-${index + 1}`,
    name: safeText(stop?.name, 160) || `${scenic ? "Punto panorámico" : "Parada"} ${index + 1}`,
    category: safeText(stop?.category, 60) || "otro",
    type: safeText(stop?.type, 30) || "poi",
    ...coordinates
  };
}

function normalizeCoordinate(value, label) {
  const lat = Number(value?.lat ?? value?.latitude);
  const lng = Number(value?.lng ?? value?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw routeError(422, `Coordenadas no válidas para ${label}`, "zone_route_coordinates_invalid");
  }
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

function pointToSegmentDistance(point, start, end) {
  const referenceLatitude = toRadians((Number(start.lat) + Number(end.lat) + Number(point.lat)) / 3);
  const metersPerDegreeLat = 111320;
  const metersPerDegreeLng = Math.max(1, Math.cos(referenceLatitude) * 111320);
  const ax = Number(start.lng) * metersPerDegreeLng;
  const ay = Number(start.lat) * metersPerDegreeLat;
  const bx = Number(end.lng) * metersPerDegreeLng;
  const by = Number(end.lat) * metersPerDegreeLat;
  const px = Number(point.lng) * metersPerDegreeLng;
  const py = Number(point.lat) * metersPerDegreeLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const progress = lengthSquared ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)) : 0;
  return {
    distanceMeters: Math.hypot(px - (ax + progress * dx), py - (ay + progress * dy)),
    progress
  };
}

function openRouteDistance(start, stops) {
  let cursor = start;
  return stops.reduce((total, stop) => {
    const distance = haversineDistance(cursor, stop);
    cursor = stop;
    return total + distance;
  }, 0);
}

function osrmEndpoint(profile) {
  const envName = { foot: "OSRM_FOOT_URL", bike: "OSRM_BIKE_URL", car: "OSRM_CAR_URL" }[profile];
  return clean(process.env[envName]) || DEFAULT_ENDPOINTS[profile];
}

function publicStop(stop) {
  return { id: stop.id, name: stop.name, category: stop.category, type: stop.type, lat: stop.lat, lng: stop.lng };
}

function normalizeCategory(value) {
  return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function osrmUnavailable(message) {
  const error = new Error(message);
  error.code = "zone_route_osrm_unavailable";
  return error;
}

function isOsrmUnavailable(error) {
  return error?.code === "zone_route_osrm_unavailable" || error?.name === "AbortError" || error?.name === "TimeoutError";
}

function routeError(statusCode, message, code, details = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}

function safeText(value, maxLength) { return clean(value).slice(0, maxLength); }
function clean(value) { return String(value ?? "").trim(); }
function toRadians(value) { return value * Math.PI / 180; }
function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}
