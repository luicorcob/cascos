import {
  findZoneBusiness,
  getZoneSettings,
  listBusinessConnections,
  listZoneBusinesses,
  listZonePois,
  pruneBusinessConnections,
  saveBusinessZoneLocation,
  upsertBusinessConnections,
  upsertZonePois
} from "./zone-discovery-store.mjs";
import { enrichZonePoiDescriptions, enrichZonePoiDescriptionsAt, isEditorialImage } from "./zone-content-enrichment.mjs";

export const ZONE_CARD_LIMIT = 6;
export const ZONE_MINIMUM_CARDS = 3;

const CATEGORY_AFFINITY = new Map([
  [pairKey("restaurant", "icecream"), 90],
  [pairKey("restaurant", "bar"), 60],
  [pairKey("hair", "beauty"), 90],
  [pairKey("hair", "fashion"), 60],
  [pairKey("hotel", "restaurant"), 90],
  [pairKey("hotel", "tourism"), 90],
  [pairKey("cafe", "bookshop"), 90],
  [pairKey("souvenirs", "tourism"), 90],
  [pairKey("winery", "restaurant"), 90]
]);
const scheduledConnectionJobs = new Set();

export function scheduleZoneConnectionRefresh(reference) {
  const value = clean(reference);
  const postgresConfigured = clean(process.env.BUSINESS_STORE).toLowerCase() === "postgres"
    && clean(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.LOCALLIFT_DATABASE_URL);
  if (!value || !postgresConfigured || clean(process.env.ZONE_DISCOVERY_JOBS_ENABLED).toLowerCase() === "false") return;
  if (scheduledConnectionJobs.has(value)) return;
  scheduledConnectionJobs.add(value);
  const timer = setTimeout(async () => {
    try {
      await recalculateBusinessConnections(value);
      const locatedBusinesses = (await listZoneBusinesses()).filter((business) => business.coordinates && business.id !== value);
      for (const business of locatedBusinesses) await recalculateBusinessConnections(business.id);
    } catch (error) {
      console.warn(`[zone-discovery] connection refresh skipped for ${value}: ${error.code || error.message}`);
    } finally {
      scheduledConnectionJobs.delete(value);
    }
  }, 25);
  timer.unref?.();
}

export async function prepareZoneForBusiness(reference, options = {}) {
  const business = await requireBusiness(reference);
  const locatedBusiness = await ensureBusinessZoneLocation(business);
  const settings = await getZoneSettings(locatedBusiness.id);
  const importResult = await loadPoisForZone(locatedBusiness, settings.radiusMeters, options);
  const connectionResult = await recalculateBusinessConnections(locatedBusiness.id);
  return { business: locatedBusiness, settings, pois: importResult, connections: connectionResult };
}

export async function loadPoisForZone(business, radiusMeters = 1500, options = {}) {
  const located = business?.coordinates ? business : await ensureBusinessZoneLocation(business);
  const existing = (await listZonePois())
    .map((poi) => withDistance(poi, located.coordinates))
    .filter((poi) => poi.distanceMeters <= radiusMeters);
  if (existing.length >= ZONE_MINIMUM_CARDS && options.force !== true) {
    const content = await enrichZonePoiDescriptions(located.id, { limit: options.contentLimit || 80 });
    return { imported: 0, cached: true, totalInRadius: existing.length, pois: existing, content };
  }

  const fetched = await fetchOverpassPois(located.coordinates, radiusMeters);
  const stored = await upsertZonePois(fetched);
  const content = await enrichZonePoiDescriptions(located.id, { limit: options.contentLimit || 80 });
  const inRadius = (await listZonePois())
    .map((poi) => withDistance(poi, located.coordinates))
    .filter((poi) => poi.distanceMeters <= radiusMeters);
  return { imported: stored.length, cached: false, totalInRadius: inRadius.length, pois: inRadius, content };
}

export async function recalculateBusinessConnections(reference) {
  const host = await requireBusiness(reference);
  const locatedHost = await ensureBusinessZoneLocation(host);
  const settings = await getZoneSettings(locatedHost.id);
  const existing = await listBusinessConnections(locatedHost.id);
  const maxClicks = Math.max(0, ...existing.map((item) => item.clicksGenerated));
  const clicksByTarget = new Map(existing.map((item) => [item.businessBId, item.clicksGenerated]));
  const candidates = (await listZoneBusinesses())
    .filter((candidate) => candidate.id !== locatedHost.id && candidate.coordinates)
    .map((candidate) => ({
      candidate,
      distanceMeters: Math.round(haversineDistance(locatedHost.coordinates, candidate.coordinates))
    }))
    .filter((item) => item.distanceMeters <= settings.radiusMeters)
    .map(({ candidate, distanceMeters }) => {
      const connectionType = getConnectionType(locatedHost.category, candidate.category);
      const categoryWeight = getCategoryAffinity(locatedHost.category, candidate.category, connectionType);
      const distanceWeight = Math.max(0, 100 - (distanceMeters / settings.radiusMeters * 100));
      const clicks = Number(clicksByTarget.get(candidate.id) || 0);
      const interactionWeight = maxClicks > 0 ? Math.min(100, clicks / maxClicks * 100) : 0;
      return {
        businessAId: locatedHost.id,
        businessBId: candidate.id,
        connectionType,
        affinityScore: calculateAffinityScore({ categoryWeight, distanceWeight, interactionWeight }),
        distanceMeters
      };
    });

  const stored = await upsertBusinessConnections(candidates);
  await pruneBusinessConnections(locatedHost.id, candidates.map((item) => item.businessBId));
  return { total: stored.length, connections: stored };
}

export async function buildZoneRecommendations(reference, options = {}) {
  const business = await requireBusiness(reference);
  const settings = await getZoneSettings(business.id);
  if (!settings.isEnabled && options.includeDisabled !== true) {
    return emptyZonePayload(business, settings);
  }
  if (!business.coordinates) {
    return emptyZonePayload(business, settings, "missing_coordinates");
  }

  const excludedBusinesses = new Set(settings.excludedBusinessIds);
  const excludedPois = new Set(settings.excludedPoiIds);
  const connections = (await listBusinessConnections(business.id))
    .filter((item) => item.connectionType !== "competidor")
    .filter((item) => item.targetZoneEnabled)
    .filter((item) => item.distanceMeters <= settings.radiusMeters)
    .filter((item) => !excludedBusinesses.has(item.businessBId))
    .filter((item) => item.target.coordinates)
    .slice(0, 3);

  const businessCards = connections.map(toBusinessCard);
  const poiSlots = ZONE_CARD_LIMIT - businessCards.length;
  const poiCandidates = (await listZonePois())
    .filter((poi) => !excludedPois.has(poi.id))
    .map((poi) => withDistance(poi, business.coordinates))
    .filter((poi) => poi.distanceMeters <= settings.radiusMeters);
  const poiCards = selectVariedPois(poiCandidates, poiSlots, settings.radiusMeters).map(toPoiCard);
  const recommendations = [...businessCards, ...poiCards];
  return {
    enabled: settings.isEnabled,
    available: recommendations.length >= ZONE_MINIMUM_CARDS,
    reason: recommendations.length >= ZONE_MINIMUM_CARDS ? "" : "insufficient_recommendations",
    zone: business.zone || business.city || "la zona",
    host: toHostMarker(business),
    settings,
    recommendations,
    total: recommendations.length
  };
}

export async function buildZonePreview(input = {}) {
  const coordinates = normalizePreviewCoordinates(input.coordinates || input);
  const radiusMeters = clampNumber(input.radiusMeters, 250, 10000, 1500);
  let nearby = (await listZonePois())
    .map((poi) => withDistance(poi, coordinates))
    .filter((poi) => poi.distanceMeters <= radiusMeters);
  let imported = 0;

  if (input.force === true || nearby.length < ZONE_MINIMUM_CARDS) {
    const fetched = await fetchOverpassPois(coordinates, radiusMeters);
    imported = (await upsertZonePois(fetched)).length;
  }

  const content = await enrichZonePoiDescriptionsAt(coordinates, radiusMeters, {
    limit: input.contentLimit || 80
  });
  nearby = (await listZonePois())
    .map((poi) => withDistance(poi, coordinates))
    .filter((poi) => poi.distanceMeters <= radiusMeters);
  const recommendations = selectVariedPois(nearby, ZONE_CARD_LIMIT, radiusMeters).map(toPoiCard);

  return {
    enabled: true,
    available: recommendations.length >= ZONE_MINIMUM_CARDS,
    reason: recommendations.length >= ZONE_MINIMUM_CARDS ? "" : "insufficient_recommendations",
    preview: true,
    zone: clean(input.zone) || "Ubicación elegida",
    host: {
      id: "developer-zone-preview",
      name: "Tu ubicación de prueba",
      latitude: coordinates.lat,
      longitude: coordinates.lng,
      accent: "#18d9ff"
    },
    settings: {
      isEnabled: true,
      radiusMeters,
      excludedBusinessIds: [],
      excludedPoiIds: []
    },
    recommendations,
    total: recommendations.length,
    diagnostics: {
      imported,
      nearby: nearby.length,
      enriched: content.enriched,
      coordinates
    }
  };
}

export async function listZoneExclusionOptions(reference) {
  const business = await requireBusiness(reference);
  const settings = await getZoneSettings(business.id);
  if (!business.coordinates) return { businesses: [], pois: [] };
  const businesses = (await listBusinessConnections(business.id))
    .filter((item) => item.distanceMeters <= settings.radiusMeters)
    .map((item) => ({
      id: item.businessBId,
      name: item.target.name,
      category: item.target.category,
      connectionType: item.connectionType,
      distanceMeters: item.distanceMeters,
      excluded: settings.excludedBusinessIds.includes(item.businessBId)
    }));
  const pois = (await listZonePois())
    .map((poi) => withDistance(poi, business.coordinates))
    .filter((poi) => poi.distanceMeters <= settings.radiusMeters)
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .map((poi) => ({
      id: poi.id,
      name: poi.name,
      category: poi.category,
      distanceMeters: poi.distanceMeters,
      excluded: settings.excludedPoiIds.includes(poi.id)
    }));
  return { businesses, pois };
}

export async function ensureBusinessZoneLocation(business) {
  if (business?.coordinates) return business;
  const query = [business?.address, business?.city].filter(Boolean).join(", ");
  if (!query) throw zoneError(422, "Business address or city is required", "zone_location_missing");
  const geocoded = await geocodeLocation(query);
  return saveBusinessZoneLocation(business.id, geocoded.coordinates, geocoded.zone || business.city);
}

export async function fetchOverpassPois(center, radiusMeters = 1500) {
  const endpoint = clean(process.env.DLS_OVERPASS_URL) || "https://overpass-api.de/api/interpreter";
  const query = buildZoneOverpassQuery(center, radiusMeters);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "user-agent": clean(process.env.DLS_RADAR_USER_AGENT) || "DLS-Zone-Discovery/1.0"
    },
    body: new URLSearchParams({ data: query }).toString(),
    signal: AbortSignal.timeout(clampNumber(process.env.ZONE_OVERPASS_TIMEOUT_MS, 5000, 60000, 30000))
  });
  if (!response.ok) throw zoneError(502, `Overpass returned ${response.status}`, "zone_overpass_failed");
  const payload = await response.json();
  return (Array.isArray(payload.elements) ? payload.elements : [])
    .map(normalizeOverpassPoi)
    .filter(Boolean)
    .map((poi) => ({ ...poi, distanceMeters: haversineDistance(center, { lat: poi.latitude, lng: poi.longitude }) }))
    .filter((poi) => poi.distanceMeters <= radiusMeters)
    .sort((a, b) => calculatePoiRelevance(b, radiusMeters) - calculatePoiRelevance(a, radiusMeters) || a.distanceMeters - b.distanceMeters)
    .slice(0, 160)
    .map(({ distanceMeters, ...poi }) => poi);
}

export function buildZoneOverpassQuery(center, radiusMeters = 1500) {
  const lat = Number(center?.lat).toFixed(6);
  const lng = Number(center?.lng).toFixed(6);
  const around = `(around:${clampNumber(radiusMeters, 250, 10000, 1500)},${lat},${lng})`;
  return `[out:json][timeout:25];(
    nwr["historic"]${around};
    nwr["heritage"]${around};
    nwr["tourism"~"^(attraction|museum|viewpoint|artwork|gallery|zoo|aquarium)$"]${around};
    nwr["natural"]${around};
    nwr["leisure"~"^(park|nature_reserve|garden)$"]${around};
    nwr["place"="square"]${around};
    nwr["amenity"~"^(arts_centre|theatre)$"]${around};
    nwr["man_made"="lighthouse"]${around};
  );out center tags;`;
}

export function normalizeOverpassPoi(element = {}) {
  const tags = element.tags || {};
  const name = clean(tags.name || tags["name:es"]);
  const latitude = Number(element.lat ?? element.center?.lat);
  const longitude = Number(element.lon ?? element.center?.lon);
  if (!name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const wikidata = clean(tags.wikidata);
  const wikipedia = clean(tags.wikipedia);
  const wikipediaTitle = wikipedia.includes(":") ? wikipedia.split(":").slice(1).join(":") : wikipedia;
  return {
    name,
    category: classifyPoi(tags),
    descriptionShort: "",
    descriptionLong: "",
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    imageUrl: normalizeImageUrl(tags.image || tags.wikimedia_commons),
    source: wikidata ? "wikidata" : wikipediaTitle ? "wikipedia" : "osm",
    externalRef: wikidata || wikipediaTitle || `${clean(element.type)}/${clean(element.id)}`,
    verified: Boolean(wikidata || wikipediaTitle || tags.heritage || tags["ref:whc"])
  };
}

export function calculateAffinityScore({ categoryWeight = 0, distanceWeight = 0, interactionWeight = 0 } = {}) {
  const score = Number(categoryWeight) * 0.5 + Number(distanceWeight) * 0.3 + Number(interactionWeight) * 0.2;
  return Number(Math.min(100, Math.max(0, score)).toFixed(2));
}

export function getConnectionType(categoryA, categoryB) {
  const groupA = categoryGroup(categoryA);
  const groupB = categoryGroup(categoryB);
  if (groupA !== "general" && groupA === groupB) return "competidor";
  return CATEGORY_AFFINITY.has(pairKey(groupA, groupB)) ? "complementario" : "neutro";
}

export function getCategoryAffinity(categoryA, categoryB, connectionType = getConnectionType(categoryA, categoryB)) {
  if (connectionType === "competidor") return 0;
  return CATEGORY_AFFINITY.get(pairKey(categoryGroup(categoryA), categoryGroup(categoryB))) || 20;
}

export function haversineDistance(left, right) {
  const lat1 = toRadians(Number(left?.lat));
  const lat2 = toRadians(Number(right?.lat));
  const deltaLat = toRadians(Number(right?.lat) - Number(left?.lat));
  const deltaLng = toRadians(Number(right?.lng) - Number(left?.lng));
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function walkingMinutes(distanceMeters) {
  return Math.max(1, Math.round(Number(distanceMeters || 0) / (5000 / 60)));
}

export function calculatePoiRelevance(poi, radiusMeters = 1500) {
  const categoryWeight = ({
    cultura: 25,
    monumento: 24,
    mirador: 23,
    playa: 22,
    naturaleza: 20,
    parque: 15,
    plaza: 12,
    otro: 4
  })[poi.category] || 8;
  const sourceWeight = poi.source === "wikipedia" ? 45 : poi.source === "wikidata" ? 14 : 0;
  const descriptionLength = clean(poi.descriptionLong).length;
  const descriptionWeight = descriptionLength >= 160 ? 28 : descriptionLength >= 80 ? 18 : descriptionLength >= 55 ? 8 : 0;
  const contentWeight = Number(isEditorialImage(poi.imageUrl)) * 27
    + descriptionWeight
    + Number(clean(poi.descriptionShort).length >= 80) * 4;
  const distance = Math.max(0, Number(poi.distanceMeters || 0));
  const proximityWeight = Math.max(0, 18 * (1 - distance / Math.max(250, Number(radiusMeters || 1500))));
  return Number((Number(poi.verified) * 6 + sourceWeight + contentWeight + categoryWeight + landmarkWeight(poi.name) + proximityWeight).toFixed(2));
}

export function selectVariedPois(pois, limit, radiusMeters = 1500) {
  const bestByName = new Map();
  [...pois].forEach((poi) => {
    const key = normalizeText(poi.name);
    const current = bestByName.get(key);
    if (!current || calculatePoiRelevance(poi, radiusMeters) > calculatePoiRelevance(current, radiusMeters)) bestByName.set(key, poi);
  });
  const pool = [...bestByName.values()];
  const selected = [];
  while (selected.length < limit && pool.length) {
    const usedCategories = new Map();
    selected.forEach((item) => usedCategories.set(item.category, (usedCategories.get(item.category) || 0) + 1));
    pool.sort((a, b) => {
      const score = (poi) => calculatePoiRelevance(poi, radiusMeters) - (usedCategories.get(poi.category) || 0) * 14;
      return score(b) - score(a) || a.distanceMeters - b.distanceMeters;
    });
    selected.push(pool.shift());
  }
  return selected;
}

function toBusinessCard(connection) {
  const target = connection.target;
  return {
    id: `business:${target.id}`,
    type: "business",
    targetBusinessId: target.id,
    name: target.name,
    category: target.category,
    badge: "Recomendado por la zona",
    descriptionShort: "",
    descriptionLong: "",
    hasLongDescription: false,
    imageUrl: businessImage(target),
    latitude: target.coordinates.lat,
    longitude: target.coordinates.lng,
    distanceMeters: connection.distanceMeters,
    walkingMinutes: walkingMinutes(connection.distanceMeters),
    directionsUrl: directionsUrl(target.coordinates),
    url: clean(target.publishedUrl || target.integrations?.google?.mapsUrl)
  };
}

function toPoiCard(poi) {
  const editorialImageUrl = isEditorialImage(poi.imageUrl) ? optimizeWikimediaImageUrl(poi.imageUrl) : "";
  const wikipediaAttribution = poi.source === "wikipedia" ? {
    label: "Fuente: Wikipedia",
    url: `https://es.wikipedia.org/wiki/${encodeURIComponent(poi.externalRef.replace(/ /g, "_"))}`
  } : null;
  const commonsAttribution = !wikipediaAttribution && /(?:upload\.wikimedia\.org|commons\.wikimedia\.org)/i.test(editorialImageUrl) ? {
    label: "Imagen: Wikimedia Commons",
    url: editorialImageUrl
  } : null;
  return {
    id: `poi:${poi.id}`,
    type: "poi",
    targetPoiId: poi.id,
    name: poi.name,
    category: poi.category,
    badge: poiBadge(poi.category),
    descriptionShort: poi.descriptionShort,
    descriptionLong: poi.descriptionLong,
    hasLongDescription: Boolean(poi.descriptionLong),
    attribution: wikipediaAttribution || commonsAttribution,
    imageUrl: editorialImageUrl,
    latitude: poi.latitude,
    longitude: poi.longitude,
    distanceMeters: poi.distanceMeters,
    walkingMinutes: walkingMinutes(poi.distanceMeters),
    directionsUrl: directionsUrl({ lat: poi.latitude, lng: poi.longitude }),
    url: ""
  };
}

function toHostMarker(business) {
  return {
    id: business.id,
    name: business.name,
    latitude: business.coordinates?.lat ?? null,
    longitude: business.coordinates?.lng ?? null,
    accent: clean(business.brand?.accent) || "#9b6238"
  };
}

function emptyZonePayload(business, settings, reason = "disabled") {
  return {
    enabled: settings.isEnabled,
    available: false,
    reason,
    zone: business.zone || business.city || "la zona",
    host: toHostMarker(business),
    settings,
    recommendations: [],
    total: 0
  };
}

async function requireBusiness(reference) {
  const business = await findZoneBusiness(reference);
  if (!business) throw zoneError(404, "Business not found", "zone_business_not_found");
  return business;
}

async function geocodeLocation(query) {
  const endpoint = clean(process.env.DLS_NOMINATIM_URL) || "https://nominatim.openstreetmap.org";
  const url = new URL("/search", endpoint);
  url.search = new URLSearchParams({ q: query, format: "jsonv2", addressdetails: "1", limit: "1" }).toString();
  const response = await fetch(url, {
    headers: { "user-agent": clean(process.env.DLS_RADAR_USER_AGENT) || "DLS-Zone-Discovery/1.0" },
    signal: AbortSignal.timeout(clampNumber(process.env.ZONE_GEOCODE_TIMEOUT_MS, 3000, 30000, 12000))
  });
  if (!response.ok) throw zoneError(502, `Nominatim returned ${response.status}`, "zone_geocode_failed");
  const [match] = await response.json();
  const lat = Number(match?.lat);
  const lng = Number(match?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw zoneError(422, "Business location was not found", "zone_location_not_found");
  const address = match.address || {};
  return {
    coordinates: { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) },
    zone: clean(address.neighbourhood || address.suburb || address.quarter || address.city_district || address.city || address.town)
  };
}

function withDistance(poi, center) {
  return { ...poi, distanceMeters: Math.round(haversineDistance(center, { lat: poi.latitude, lng: poi.longitude })) };
}

function normalizePreviewCoordinates(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw zoneError(422, "Valid latitude and longitude are required", "zone_preview_coordinates_invalid");
  }
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

function classifyPoi(tags = {}) {
  if (tags.historic) return "monumento";
  if (tags.man_made === "lighthouse") return "monumento";
  if (tags.tourism === "viewpoint") return "mirador";
  if (["museum", "gallery", "artwork", "zoo", "aquarium"].includes(tags.tourism)) return "cultura";
  if (["arts_centre", "theatre"].includes(tags.amenity)) return "cultura";
  if (tags.natural === "beach") return "playa";
  if (["park", "garden"].includes(tags.leisure)) return "parque";
  if (tags.leisure === "nature_reserve") return "naturaleza";
  if (tags.place === "square") return "plaza";
  if (tags.natural) return "naturaleza";
  return tags.tourism ? "cultura" : "otro";
}

function normalizeImageUrl(value) {
  const image = clean(value);
  if (!image) return "";
  if (/^https?:\/\//i.test(image)) return image;
  if (/^(?:Category|Categor\u00eda):/i.test(image)) return "";
  const file = image.replace(/^File:/i, "");
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(file)}`;
}

export function optimizeWikimediaImageUrl(value) {
  const image = clean(value);
  if (!/^https:\/\/upload\.wikimedia\.org\//i.test(image)) return image;
  try {
    const url = new URL(image);
    if (url.pathname.includes("/thumb/")) {
      const parts = url.pathname.split("/");
      parts[parts.length - 1] = parts.at(-1).replace(/^\d+px-/, "1280px-");
      url.pathname = parts.join("/");
      return url.toString();
    }
    const match = url.pathname.match(/^(\/wikipedia\/commons\/)([^/]+\/[^/]+\/)([^/]+\.(?:jpe?g|png|webp))$/i);
    if (!match) return image;
    url.pathname = `${match[1]}thumb/${match[2]}${match[3]}/1280px-${match[3]}`;
    return url.toString();
  } catch {
    return image;
  }
}

function categoryGroup(category) {
  const value = normalizeText(category);
  if (/restaur|comida|gastronom|tapas|asador|brasa/.test(value)) return "restaurant";
  if (/helad|gelat/.test(value)) return "icecream";
  if (/bar|copas|pub|coctel/.test(value)) return "bar";
  if (/peluquer|barber/.test(value)) return "hair";
  if (/estetic|belleza|spa|manicur/.test(value)) return "beauty";
  if (/ropa|moda|boutique/.test(value)) return "fashion";
  if (/hotel|hostal|alojamiento|apartamento/.test(value)) return "hotel";
  if (/monumento|turismo|museo|galeria|cultura/.test(value)) return "tourism";
  if (/cafeter|cafe|coffee/.test(value)) return "cafe";
  if (/librer/.test(value)) return "bookshop";
  if (/souvenir|recuerdo/.test(value)) return "souvenirs";
  if (/bodega|vinoteca|vino/.test(value)) return "winery";
  return "general";
}

function landmarkWeight(name) {
  const value = normalizeText(name);
  let weight = 0;
  if (/catedral|basilica|alcazar|castillo/.test(value)) weight += 16;
  else if (/casa museo|museo|palacio/.test(value)) weight += 12;
  else if (/mercado|jardines|faro|mirador|parque nacional|reserva/.test(value)) weight += 10;
  else if (/centro|teatro|auditorio/.test(value)) weight += 7;
  else if (/iglesia|convento|biblioteca/.test(value)) weight += 3;
  if (/^(?:monumento a|estatua|fuente de|busto)/.test(value)) weight -= 8;
  if (/^\p{Lu}{3,7}$/u.test(clean(name))) weight -= 5;
  return weight;
}

function pairKey(left, right) { return [left, right].sort().join(":"); }
function businessImage(business) {
  return clean(
    business.content?.heroImage || business.content?.imageUrl || business.content?.logoUrl
    || business.brand?.heroImage || business.imageUrl
  );
}
function directionsUrl(coordinates) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${coordinates.lat},${coordinates.lng}`)}&travelmode=walking`;
}
function poiBadge(category) {
  return ({
    monumento: "Monumento", naturaleza: "Naturaleza", cultura: "Cultura", mirador: "Mirador",
    plaza: "Plaza", playa: "Playa", parque: "Parque", otro: "Lugar de interés"
  })[category] || "Lugar de interés";
}
function toRadians(value) { return value * Math.PI / 180; }
function normalizeText(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function clean(value) { return String(value ?? "").trim(); }
function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}
function zoneError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
