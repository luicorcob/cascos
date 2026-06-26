import path from "node:path";
import { corsHeaders } from "../lib/cors.mjs";
import { readJsonStore, writeJsonStore } from "../lib/json-store.mjs";

const MAX_BODY_BYTES = Number(process.env.DISCOVERY_API_MAX_BODY_BYTES || 256 * 1024);
const SEARCH_CACHE_TTL = Number(process.env.DLS_DISCOVERY_CACHE_TTL_MS || 15 * 60 * 1000);
const NOMINATIM_URL = process.env.DLS_NOMINATIM_URL || "https://nominatim.openstreetmap.org";
const OVERPASS_URL = process.env.DLS_OVERPASS_URL || "https://overpass-api.de/api/interpreter";
const OSM_USER_AGENT = process.env.DLS_RADAR_USER_AGENT
  || "DLS-Radar/1.0 (Digital Local Sites; https://digitallocalsites.com)";
const searchCache = new Map();
const geocodeCache = new Map();
let lastNominatimRequestAt = 0;

const CATEGORY_QUERIES = {
  all: "negocios locales",
  restaurant: "restaurantes",
  bar: "bares",
  hairdresser: "peluquerías",
  clinic: "clínicas",
  dentist: "dentistas",
  workshop: "talleres mecánicos",
  store: "tiendas",
  gym: "gimnasios",
  cafe: "cafeterías",
  hotel: "hoteles",
  real_estate: "inmobiliarias"
};

const CATEGORY_LABELS = {
  all: "Negocio local",
  restaurant: "Restaurante",
  bar: "Bar",
  hairdresser: "Peluquería",
  clinic: "Clínica",
  dentist: "Dentista",
  workshop: "Taller",
  store: "Tienda",
  gym: "Gimnasio",
  cafe: "Cafetería",
  hotel: "Hotel",
  real_estate: "Inmobiliaria"
};

const OSM_FILTERS = {
  restaurant: ['["amenity"="restaurant"]'],
  bar: ['["amenity"~"^(bar|pub)$"]'],
  hairdresser: ['["shop"="hairdresser"]'],
  clinic: ['["amenity"="clinic"]'],
  dentist: ['["amenity"="dentist"]'],
  workshop: ['["shop"="car_repair"]'],
  store: ['["shop"]'],
  gym: ['["leisure"="fitness_centre"]'],
  cafe: ['["amenity"="cafe"]'],
  hotel: ['["tourism"~"^(hotel|guest_house|hostel)$"]'],
  real_estate: ['["office"="estate_agent"]']
};

const NOMINATIM_POI_TERMS = {
  all: "shop",
  restaurant: "restaurant",
  bar: "bar",
  hairdresser: "hairdresser",
  clinic: "clinic",
  dentist: "dentist",
  workshop: "car repair",
  store: "shop",
  gym: "fitness centre",
  cafe: "cafe",
  hotel: "hotel",
  real_estate: "estate agent"
};

const DEFAULT_LEADS_DB = { version: 1, updatedAt: null, leads: [] };

export function isDiscoveryApiRequest(pathname) {
  return pathname === "/api/discovery/config"
    || pathname === "/api/discovery/search"
    || pathname === "/api/leads"
    || pathname === "/api/studio/from-opportunity";
}

export async function handleDiscoveryApi(request, response, context) {
  const requestUrl = new URL(request.url || "/", "http://dls.local");
  const method = request.method || "GET";

  if (method === "OPTIONS") {
    sendEmpty(response, 204, context);
    return;
  }

  try {
    if (requestUrl.pathname === "/api/discovery/config" && method === "GET") {
      const mode = getConfiguredMode();
      const ready = mode !== "places" || Boolean(getPlacesApiKey());
      sendJson(response, 200, { mode, ready, realData: mode !== "demo" }, context);
      return;
    }
    if (requestUrl.pathname === "/api/discovery/search" && method === "GET") {
      await searchBusinesses(requestUrl, response, context);
      return;
    }
    if (requestUrl.pathname === "/api/leads" && method === "POST") {
      await createLead(request, response, context);
      return;
    }
    if (requestUrl.pathname === "/api/studio/from-opportunity" && method === "POST") {
      await createStudioBrief(request, response, context);
      return;
    }
    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "GET, POST, OPTIONS" });
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status >= 500 && !error.expose ? "Internal discovery API error" : error.message;
    sendJson(response, status, { error: message }, context);
  }
}

async function searchBusinesses(requestUrl, response, context) {
  const city = cleanText(requestUrl.searchParams.get("city"), 100);
  const category = normalizeCategory(requestUrl.searchParams.get("category"));
  const radius = clamp(Number(requestUrl.searchParams.get("radius") || 3000), 1000, 10000);
  const requestedMode = normalizeMode(requestUrl.searchParams.get("mode"));
  const mode = requestedMode || getConfiguredMode();

  if (city.length < 2) throw httpError(400, "Escribe una localidad válida.");

  const cacheKey = `${mode}:${normalize(city)}:${category}:${radius}`;
  const cached = readCache(cacheKey);
  if (cached) {
    sendJson(response, 200, { ...cached, cached: true }, context);
    return;
  }

  let result;
  if (mode === "places") result = await searchGooglePlaces({ city, category, radius });
  else if (mode === "openstreetmap") result = await searchOpenStreetMap({ city, category, radius });
  else result = buildDemoResult({ city, category, radius });

  const payload = { ...result, searchedAt: new Date().toISOString(), cached: false };
  writeCache(cacheKey, payload);
  sendJson(response, 200, payload, context);
}

async function searchGooglePlaces({ city, category, radius }) {
  const apiKey = getPlacesApiKey();
  if (!apiKey) {
    throw httpError(503, "Configura GOOGLE_PLACES_API_KEY para activar Google Places.", true);
  }

  const center = await geocodeGoogleCity(city, apiKey);
  const response = await fetchWithTimeout("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": [
        "places.id", "places.displayName", "places.formattedAddress", "places.location",
        "places.rating", "places.userRatingCount", "places.internationalPhoneNumber",
        "places.nationalPhoneNumber", "places.websiteUri", "places.googleMapsUri",
        "places.primaryType", "places.types", "places.businessStatus",
        "places.regularOpeningHours"
      ].join(",")
    },
    body: JSON.stringify({
      textQuery: `${CATEGORY_QUERIES[category]} en ${city}`,
      languageCode: "es",
      maxResultCount: 20,
      locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius } }
    })
  }, 18_000);

  const payload = await readRemoteJson(response);
  if (!response.ok) {
    throw httpError(response.status >= 500 ? 502 : 400, payload?.error?.message || "Google Places no pudo completar la búsqueda.", true);
  }

  const businesses = (payload.places || []).map((place) => {
    const website = cleanText(place.websiteUri, 500);
    return {
      id: `places_${place.id}`,
      providerId: place.id,
      name: cleanText(place.displayName?.text || "Negocio local", 180),
      category: category === "all" ? humanizeType(place.primaryType) : CATEGORY_LABELS[category],
      categoryKey: category === "all" ? place.primaryType || "local" : category,
      city,
      address: cleanText(place.formattedAddress, 360),
      phone: cleanText(place.internationalPhoneNumber || place.nationalPhoneNumber, 80),
      rating: Number(place.rating || 0),
      reviews: Number(place.userRatingCount || 0),
      websiteStatus: website ? "website" : "none",
      websiteEvidence: website ? "declared" : "not_declared",
      website,
      socialUrl: "",
      alternativeUrl: "",
      coordinates: place.location ? { lat: Number(place.location.latitude), lng: Number(place.location.longitude) } : null,
      mapsUrl: cleanText(place.googleMapsUri, 500),
      openingHours: cleanTextList(place.regularOpeningHours?.weekdayDescriptions, 14, 180),
      businessStatus: cleanText(place.businessStatus, 80),
      sourceLabel: "Google Places",
      provider: "places"
    };
  }).filter((business) => business.coordinates);

  return { businesses, center, provider: "places", sourceLabel: "Google Places" };
}

async function searchOpenStreetMap({ city, category, radius }) {
  const geocoded = await geocodeOpenStreetMapCity(city);
  const center = { lat: geocoded.lat, lng: geocoded.lng };
  let businesses = await searchNominatimPois({ center, city, category, radius });
  if (!businesses.length) businesses = await searchOverpassPois({ center, city, category, radius });

  return {
    businesses,
    center,
    provider: "openstreetmap",
    sourceLabel: "OpenStreetMap",
    attribution: "© OpenStreetMap contributors",
    geocodedLabel: geocoded.label
  };
}

async function searchNominatimPois({ center, city, category, radius }) {
  const latDelta = radius / 111_320;
  const lngDelta = radius / (111_320 * Math.max(.2, Math.cos(center.lat * Math.PI / 180)));
  const viewbox = [
    center.lng - lngDelta,
    center.lat + latDelta,
    center.lng + lngDelta,
    center.lat - latDelta
  ].map((value) => value.toFixed(6)).join(",");
  const terms = category === "all"
    ? ["restaurant", "cafe", "hairdresser", "supermarket"]
    : [NOMINATIM_POI_TERMS[category] || NOMINATIM_POI_TERMS.all];
  const items = [];

  for (const term of terms) {
    const url = new URL("/search", NOMINATIM_URL);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("q", term);
    url.searchParams.set("limit", category === "all" ? "20" : "40");
    url.searchParams.set("bounded", "1");
    url.searchParams.set("dedupe", "1");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("extratags", "1");
    url.searchParams.set("namedetails", "1");
    url.searchParams.set("accept-language", "es");
    url.searchParams.set("viewbox", viewbox);

    try {
      const response = await fetchNominatim(url, 14_000);
      const payload = await readRemoteJson(response);
      if (response.ok && Array.isArray(payload)) items.push(...payload);
    } catch (error) {
      if (!items.length && terms.length === 1) {
        throw httpError(502, "No se pudo consultar el directorio geográfico ahora mismo.", true);
      }
    }
  }

  const seen = new Set();
  return items
    .map((item) => normalizeNominatimBusiness(item, city, category))
    .filter(Boolean)
    .filter((business) => distanceMeters(center, business.coordinates) <= radius)
    .filter((business) => {
      if (seen.has(business.id)) return false;
      seen.add(business.id);
      return true;
    });
}

async function searchOverpassPois({ center, city, category, radius }) {
  const query = buildOverpassQuery(category, radius, center.lat, center.lng);
  try {
    const response = await fetchWithTimeout(OVERPASS_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "User-Agent": OSM_USER_AGENT
      },
      body: new URLSearchParams({ data: query }).toString()
    }, 12_000);
    const payload = await readRemoteJson(response);
    if (!response.ok || !Array.isArray(payload.elements)) return [];
    return payload.elements.map((element) => normalizeOsmBusiness(element, city, category)).filter(Boolean).slice(0, 120);
  } catch (error) {
    return [];
  }
}

async function geocodeOpenStreetMapCity(city) {
  const key = normalize(city);
  const cached = geocodeCache.get(key);
  if (cached && Date.now() - cached.savedAt < 24 * 60 * 60 * 1000) return cached.value;

  const url = new URL("/search", NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", city);
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "es");

  let response;
  try {
    response = await fetchNominatim(url, 12_000);
  } catch (error) {
    throw httpError(502, "No se pudo conectar con el servicio de geocodificación.", true);
  }

  const payload = await readRemoteJson(response);
  const match = Array.isArray(payload) ? payload[0] : null;
  if (!response.ok || !match) throw httpError(404, `No se ha podido localizar “${city}”.`, true);

  const value = {
    lat: Number(match.lat),
    lng: Number(match.lon),
    label: cleanText(match.display_name, 500)
  };
  geocodeCache.set(key, { savedAt: Date.now(), value });
  return value;
}

function normalizeNominatimBusiness(item, fallbackCity, requestedCategory) {
  const extra = item.extratags || {};
  const namedetails = item.namedetails || {};
  const addressParts = item.address || {};
  const name = firstText(namedetails.name, namedetails["name:es"], item.name, String(item.display_name || "").split(",")[0]);
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const type = normalizeOsmType(item.osm_type);
  const categoryKey = requestedCategory === "all" ? classifyNominatimCategory(item) : requestedCategory;
  const website = firstText(extra.website, extra["contact:website"], extra.url, extra["contact:url"]);
  const socialUrl = getOsmSocialUrl(extra);
  const phone = firstText(extra.phone, extra["contact:phone"], extra.mobile, extra["contact:mobile"]);
  const city = firstText(addressParts.city, addressParts.town, addressParts.village, addressParts.municipality, fallbackCity);

  return {
    id: `osm_${type}_${item.osm_id}`,
    providerId: `${type}/${item.osm_id}`,
    name,
    category: CATEGORY_LABELS[categoryKey] || "Negocio local",
    categoryKey,
    city,
    address: formatNominatimAddress(addressParts, item.display_name, city),
    phone,
    rating: 0,
    reviews: 0,
    websiteStatus: website ? "website" : socialUrl ? "social" : "none",
    websiteEvidence: website ? "declared" : socialUrl ? "social_only" : "not_declared",
    website,
    socialUrl,
    alternativeUrl: socialUrl,
    coordinates: { lat, lng },
    mapsUrl: `https://www.openstreetmap.org/${type}/${item.osm_id}`,
    openingHours: cleanText(extra.opening_hours, 300),
    sourceLabel: "OpenStreetMap",
    provider: "openstreetmap"
  };
}

function classifyNominatimCategory(item) {
  const type = normalize(item.type);
  if (type === "restaurant") return "restaurant";
  if (["bar", "pub"].includes(type)) return "bar";
  if (type === "cafe") return "cafe";
  if (type === "clinic") return "clinic";
  if (type === "dentist") return "dentist";
  if (type === "hairdresser") return "hairdresser";
  if (type === "car_repair") return "workshop";
  if (type === "fitness_centre") return "gym";
  if (["hotel", "guest_house", "hostel"].includes(type)) return "hotel";
  if (type === "estate_agent") return "real_estate";
  return "store";
}

function formatNominatimAddress(address, displayName, fallbackCity) {
  const road = firstText(address.road, address.pedestrian, address.footway, address.square, address.neighbourhood);
  const number = cleanText(address.house_number, 40);
  const postcode = cleanText(address.postcode, 20);
  const city = firstText(address.city, address.town, address.village, address.municipality, fallbackCity);
  const concise = [[road, number].filter(Boolean).join(" "), postcode, city].filter(Boolean).join(", ");
  return concise || cleanText(displayName, 360);
}

function normalizeOsmType(value) {
  const type = normalize(value);
  if (["node", "way", "relation"].includes(type)) return type;
  if (type === "n") return "node";
  if (type === "w") return "way";
  if (type === "r") return "relation";
  return "node";
}

async function geocodeGoogleCity(city, apiKey) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", city);
  url.searchParams.set("language", "es");
  url.searchParams.set("key", apiKey);
  const response = await fetchWithTimeout(url, {}, 12_000);
  const payload = await readRemoteJson(response);
  const location = payload.results?.[0]?.geometry?.location;
  if (!response.ok || !location) throw httpError(400, "No se pudo localizar la ciudad indicada.", true);
  return { lat: Number(location.lat), lng: Number(location.lng) };
}

export function buildOverpassQuery(category, radius, lat, lng) {
  const categories = category === "all" ? Object.keys(OSM_FILTERS) : [category];
  const around = `(around:${Math.round(radius)},${Number(lat).toFixed(6)},${Number(lng).toFixed(6)})`;
  const selectors = categories.flatMap((key) => (OSM_FILTERS[key] || []).map((filter) => `nwr["name"]${filter}${around};`));
  return `[out:json][timeout:25];\n(\n${selectors.join("\n")}\n);\nout center 120;`;
}

function normalizeOsmBusiness(element, fallbackCity, requestedCategory) {
  const tags = element.tags || {};
  const name = cleanText(tags.name || tags.brand, 180);
  const lat = Number(element.lat ?? element.center?.lat);
  const lng = Number(element.lon ?? element.center?.lon);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const categoryKey = requestedCategory === "all" ? classifyOsmCategory(tags) : requestedCategory;
  const website = firstText(tags.website, tags["contact:website"], tags.url, tags["contact:url"]);
  const socialUrl = getOsmSocialUrl(tags);
  const phone = firstText(tags.phone, tags["contact:phone"], tags.mobile, tags["contact:mobile"]);
  const address = formatOsmAddress(tags, fallbackCity);
  const type = ["node", "way", "relation"].includes(element.type) ? element.type : "node";

  return {
    id: `osm_${type}_${element.id}`,
    providerId: `${type}/${element.id}`,
    name,
    category: CATEGORY_LABELS[categoryKey] || "Negocio local",
    categoryKey,
    city: firstText(tags["addr:city"], tags["addr:place"], fallbackCity),
    address,
    phone,
    rating: 0,
    reviews: 0,
    websiteStatus: website ? "website" : socialUrl ? "social" : "none",
    websiteEvidence: website ? "declared" : socialUrl ? "social_only" : "not_declared",
    website,
    socialUrl,
    alternativeUrl: socialUrl,
    coordinates: { lat, lng },
    mapsUrl: `https://www.openstreetmap.org/${type}/${element.id}`,
    openingHours: cleanText(tags.opening_hours, 300),
    sourceLabel: "OpenStreetMap",
    provider: "openstreetmap"
  };
}

function classifyOsmCategory(tags) {
  const amenity = normalize(tags.amenity);
  const shop = normalize(tags.shop);
  const tourism = normalize(tags.tourism);
  const leisure = normalize(tags.leisure);
  const office = normalize(tags.office);
  if (amenity === "restaurant") return "restaurant";
  if (["bar", "pub"].includes(amenity)) return "bar";
  if (amenity === "cafe") return "cafe";
  if (amenity === "clinic") return "clinic";
  if (amenity === "dentist") return "dentist";
  if (shop === "hairdresser") return "hairdresser";
  if (shop === "car_repair") return "workshop";
  if (shop) return "store";
  if (leisure === "fitness_centre") return "gym";
  if (["hotel", "guest_house", "hostel"].includes(tourism)) return "hotel";
  if (office === "estate_agent") return "real_estate";
  return "all";
}

function formatOsmAddress(tags, fallbackCity) {
  const full = cleanText(tags["addr:full"], 360);
  if (full) return full;
  const street = firstText(tags["addr:street"], tags["addr:place"]);
  const number = cleanText(tags["addr:housenumber"], 40);
  const postcode = cleanText(tags["addr:postcode"], 20);
  const city = firstText(tags["addr:city"], tags["addr:town"], tags["addr:village"], fallbackCity);
  const firstLine = [street, number].filter(Boolean).join(" ");
  return [firstLine, postcode, city].filter(Boolean).join(", ") || city;
}

function getOsmSocialUrl(tags) {
  const explicit = firstText(tags["contact:instagram"], tags.instagram, tags["contact:facebook"], tags.facebook, tags["contact:tiktok"], tags["contact:twitter"]);
  if (!explicit) return "";
  if (/^https?:\/\//i.test(explicit)) return explicit;
  if (explicit.startsWith("@")) return `https://instagram.com/${explicit.slice(1)}`;
  return explicit.includes(".") ? `https://${explicit.replace(/^\/+/, "")}` : "";
}

function buildDemoResult({ city, category }) {
  const categoryKeys = category === "all" ? Object.keys(CATEGORY_LABELS).filter((key) => key !== "all") : [category];
  const businesses = Array.from({ length: 8 }, (_, index) => {
    const categoryKey = categoryKeys[index % categoryKeys.length];
    return {
      id: `demo_sample_${index}`,
      name: `Negocio de ejemplo ${index + 1}`,
      category: CATEGORY_LABELS[categoryKey],
      categoryKey,
      city,
      address: "Dirección ficticia — solo demostración",
      phone: index % 3 ? "+34 900 000 000" : "",
      rating: 0,
      reviews: 0,
      websiteStatus: index % 4 === 0 ? "website" : "none",
      websiteEvidence: "demo",
      website: "",
      socialUrl: "",
      alternativeUrl: "",
      coordinates: null,
      mapsUrl: "",
      sourceLabel: "Ejemplo simulado",
      provider: "demo"
    };
  });
  return { businesses, center: null, provider: "demo", sourceLabel: "Ejemplo simulado" };
}

async function createLead(request, response, context) {
  const source = await readJsonBody(request);
  const lead = normalizeLead(source);
  const dbPath = path.resolve(context.root, process.env.RADAR_LEADS_DB_FILE || "data/radar-leads.json");
  const db = await readJsonStore(dbPath, DEFAULT_LEADS_DB);
  const duplicateIndex = db.leads.findIndex((item) => item.id === lead.id || (
    normalize(item.businessName) === normalize(lead.businessName) && normalize(item.city) === normalize(lead.city)
  ));

  if (duplicateIndex >= 0) db.leads[duplicateIndex] = { ...db.leads[duplicateIndex], ...lead, createdAt: db.leads[duplicateIndex].createdAt };
  else db.leads.unshift(lead);
  db.updatedAt = new Date().toISOString();
  await writeJsonStore(dbPath, db);
  sendJson(response, duplicateIndex >= 0 ? 200 : 201, { lead, duplicate: duplicateIndex >= 0 }, context);
}

async function createStudioBrief(request, response, context) {
  const source = await readJsonBody(request);
  const businessName = cleanText(source.businessName || source.name, 180) || "Negocio local";
  const city = cleanText(source.city, 100);
  const category = cleanText(source.category, 120) || "Negocio local";
  const phone = cleanText(source.phone, 80);
  const brief = normalizeBrief(source.brief || source, { businessName, city, category });
  const categoryKey = normalize(source.categoryKey || category);
  const isFood = includesAny(categoryKey, ["restaurant", "restaurante", "bar", "cafe", "cafeteria"]);
  const isAppointment = includesAny(categoryKey, ["clinic", "clinica", "dentist", "dentista", "hairdresser", "peluqueria", "gym", "gimnasio"]);
  const openingHours = cleanTextList(source.openingHours || source.hours, 14, 180);
  const studioBusiness = {
    name: businessName,
    category,
    location: city,
    tagline: brief.suggestedPositioning,
    description: `${businessName} es un negocio local de ${category.toLowerCase()} en ${city}. Esta propuesta convierte su presencia local en una experiencia digital clara y orientada a contacto.`,
    conversionGoal: `${brief.suggestedCTA} y convertir búsquedas locales en clientes`,
    announcement: "Nueva web en preparación · propuesta creada desde DLS Radar",
    phone,
    address: cleanText(source.address, 360),
    hours: openingHours,
    services: suggestedServices(categoryKey),
    features: [
      source.reviews ? `Reputación local con ${Number(source.reviews)} reseñas` : "Presencia verificada en un directorio geográfico",
      "Contacto y ubicación visibles desde cualquier dispositivo",
      `${brief.suggestedCTA} como acción principal`,
      "Contenido preparado para confianza y búsqueda local"
    ],
    bookingLabel: brief.suggestedCTA,
    bookingUrl: phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : "#contacto",
    showBooking: Boolean(phone) || isFood || isAppointment,
    showMap: true,
    showGallery: true,
    showTestimonials: true,
    showLeadForm: true,
    showFaq: true,
    showMenu: isFood,
    showConversionDock: true,
    showAnnouncement: true,
    showTrustRail: true,
    showResourceMarquee: false,
    sectionOrder: isFood
      ? ["menu", "booking", "gallery", "testimonials", "map", "services", "features", "faq", "lead", "store"]
      : ["services", "booking", "testimonials", "gallery", "map", "features", "faq", "lead", "menu", "store"],
    theme: isAppointment ? "luxe" : "aurora",
    artDirection: isFood ? "cinematic" : "editorial",
    contentMode: "balanced",
    premiumEffects: true,
    google: {
      enabled: source.provider === "places",
      mapsUrl: cleanText(source.mapsUrl, 500),
      rating: Number(source.rating || 0),
      reviewCount: Number(source.reviews || 0),
      appointmentUrl: phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : ""
    },
    radarOpportunity: brief
  };
  sendJson(response, 200, { brief, studioBusiness }, context);
}

function normalizeLead(source = {}) {
  const businessName = cleanText(source.businessName || source.name, 180);
  if (!businessName) throw httpError(400, "businessName is required");
  const now = new Date().toISOString();
  return {
    id: cleanId(source.id) || `radar_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    businessName,
    category: cleanText(source.category, 120),
    city: cleanText(source.city, 100),
    address: cleanText(source.address, 360),
    phone: cleanText(source.phone, 80),
    openingHours: cleanTextList(source.openingHours || source.hours, 14, 180),
    website: cleanText(source.website, 500),
    socialUrl: cleanText(source.socialUrl || source.alternativeUrl, 500),
    mapsUrl: cleanText(source.mapsUrl, 500),
    providerId: cleanText(source.providerId, 180),
    rating: clamp(Number(source.rating || 0), 0, 5),
    reviews: Math.max(0, Math.round(Number(source.reviews || 0))),
    websiteStatus: cleanText(source.websiteStatus, 30) || "unverified",
    opportunityScore: clamp(Math.round(Number(source.opportunityScore || 0)), 0, 100),
    source: "Radar de Negocios",
    sourceProvider: cleanText(source.provider, 40),
    status: cleanText(source.status, 40) || "Nuevo",
    createdAt: cleanText(source.createdAt, 80) || now,
    updatedAt: now
  };
}

function normalizeBrief(source, fallback) {
  return {
    businessName: cleanText(source.businessName || fallback.businessName, 180),
    city: cleanText(source.city || fallback.city, 100),
    category: cleanText(source.category || fallback.category, 120),
    address: cleanText(source.address, 360),
    phone: cleanText(source.phone, 80),
    openingHours: cleanTextList(source.openingHours || source.hours, 14, 180),
    website: cleanText(source.website, 500),
    socialUrl: cleanText(source.socialUrl || source.alternativeUrl, 500),
    mapsUrl: cleanText(source.mapsUrl, 500),
    providerId: cleanText(source.providerId, 180),
    businessStatus: cleanText(source.businessStatus, 80),
    rating: Number(source.rating || 0),
    reviews: Math.max(0, Math.round(Number(source.reviews || 0))),
    websiteStatus: cleanText(source.websiteStatus, 30) || "unverified",
    opportunityScore: clamp(Math.round(Number(source.opportunityScore || 0)), 0, 100),
    suggestedPositioning: cleanText(source.suggestedPositioning, 500) || `${fallback.businessName}, una referencia local en ${fallback.city}.`,
    suggestedSections: Array.isArray(source.suggestedSections) ? source.suggestedSections.map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 12) : ["Hero", "Servicios", "Reseñas", "Mapa", "Contacto"],
    suggestedCTA: cleanText(source.suggestedCTA, 100) || "Pedir información"
  };
}

function suggestedServices(category) {
  if (includesAny(category, ["restaurant", "restaurante", "bar", "cafe"])) return ["Carta y especialidades", "Reservas", "Menús para grupos", "Eventos", "Opciones especiales"];
  if (includesAny(category, ["clinic", "clinica", "dentist", "dentista"])) return ["Primera consulta", "Tratamientos", "Seguimiento", "Cita previa", "Atención personalizada"];
  if (includesAny(category, ["hairdresser", "peluqueria"])) return ["Corte y peinado", "Coloración", "Tratamientos", "Eventos", "Reserva de cita"];
  if (includesAny(category, ["workshop", "taller"])) return ["Mantenimiento", "Diagnóstico", "Reparaciones", "Neumáticos", "Presupuesto"];
  return ["Servicio principal", "Atención personalizada", "Presupuesto", "Asesoramiento", "Contacto directo"];
}

function getConfiguredMode() {
  return normalizeMode(process.env.DLS_DISCOVERY_PROVIDER) || "openstreetmap";
}

function normalizeMode(value) {
  const mode = cleanText(value, 30).toLowerCase();
  if (["osm", "openstreetmap"].includes(mode)) return "openstreetmap";
  if (mode === "places") return "places";
  if (mode === "demo") return "demo";
  return "";
}

function getPlacesApiKey() {
  return cleanText(process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY, 500);
}

function readCache(key) {
  const entry = searchCache.get(key);
  if (!entry || Date.now() - entry.savedAt > SEARCH_CACHE_TTL) {
    searchCache.delete(key);
    return null;
  }
  return entry.value;
}

function writeCache(key, value) {
  searchCache.set(key, { savedAt: Date.now(), value });
  if (searchCache.size > 80) searchCache.delete(searchCache.keys().next().value);
}

async function fetchWithTimeout(url, options, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchNominatim(url, timeout) {
  const elapsed = Date.now() - lastNominatimRequestAt;
  if (elapsed < 1_050) await new Promise((resolve) => setTimeout(resolve, 1_050 - elapsed));
  lastNominatimRequestAt = Date.now();
  return fetchWithTimeout(url, {
    headers: { Accept: "application/json", "User-Agent": OSM_USER_AGENT }
  }, timeout);
}

async function readJsonBody(request) {
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw httpError(413, "Request body too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch (error) { throw httpError(400, "Invalid JSON body"); }
}

async function readRemoteJson(response) {
  try { return await response.json(); }
  catch (error) { return {}; }
}

function normalizeCategory(value) {
  const key = cleanText(value || "all", 40).toLowerCase();
  return Object.prototype.hasOwnProperty.call(CATEGORY_QUERIES, key) ? key : "all";
}

function humanizeType(value) {
  return cleanText(value, 100).replace(/_/g, " ").replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase("es")) || "Negocio local";
}

function firstText(...values) {
  return values.map((value) => cleanText(value, 500)).find(Boolean) || "";
}

function cleanTextList(values, maxItems = 12, maxText = 180) {
  if (Array.isArray(values)) return values.map((value) => cleanText(value, maxText)).filter(Boolean).slice(0, maxItems);
  const text = cleanText(values, maxItems * maxText);
  return text ? text.split(/\s*;\s*/).map((value) => cleanText(value, maxText)).filter(Boolean).slice(0, maxItems) : [];
}

function distanceMeters(left, right) {
  const toRadians = (value) => value * Math.PI / 180;
  const lat1 = toRadians(Number(left.lat));
  const lat2 = toRadians(Number(right.lat));
  const latDelta = lat2 - lat1;
  const lngDelta = toRadians(Number(right.lng) - Number(left.lng));
  const a = Math.sin(latDelta / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(lngDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function cleanId(value) { return cleanText(value, 180).replace(/[^a-zA-Z0-9_-]/g, ""); }
function cleanText(value, max = 500) { return String(value ?? "").trim().slice(0, max); }
function normalize(value) { return cleanText(value, 500).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function includesAny(value, candidates) { return candidates.some((candidate) => value.includes(candidate)); }
function clamp(value, min, max) { return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)); }
function httpError(statusCode, message, expose = false) { const error = new Error(message); error.statusCode = statusCode; error.expose = expose; return error; }

function sendJson(response, status, payload, context, extraHeaders = {}) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    ...extraHeaders,
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function sendEmpty(response, status, context) {
  response.writeHead(status, { ...context.baseHeaders, ...corsHeaders(context) });
  response.end();
}
