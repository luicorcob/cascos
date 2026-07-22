import {
  findZoneBusiness,
  getZoneSettings,
  listZonePois,
  updateZonePoiDescription
} from "./zone-discovery-store.mjs";

export async function enrichZonePoiDescriptions(reference, options = {}) {
  const business = await findZoneBusiness(reference);
  if (!business) throw contentError(404, "Business not found", "zone_business_not_found");
  if (!business.coordinates) throw contentError(422, "Business coordinates are required", "zone_location_missing");
  const settings = await getZoneSettings(business.id);
  return enrichZonePoiDescriptionsAt(business.coordinates, settings.radiusMeters, {
    ...options,
    businessId: business.id
  });
}

export async function enrichZonePoiDescriptionsAt(coordinates, radiusMeters = 1500, options = {}) {
  const center = normalizeCoordinates(coordinates);
  if (!center) throw contentError(422, "Valid coordinates are required", "zone_location_invalid");
  const limit = clampNumber(options.limit, 1, 100, 80);
  const discoveryLimit = clampNumber(options.discoveryLimit || process.env.ZONE_MEDIA_DISCOVERY_LIMIT, 1, 40, 24);
  const nearby = (await listZonePois())
    .filter((poi) => !poi.descriptionShort || !poi.descriptionLong || !isEditorialImage(poi.imageUrl))
    .map((poi) => ({
      ...poi,
      distanceMeters: distanceMeters(center, { lat: poi.latitude, lng: poi.longitude })
    }))
    .filter((poi) => poi.distanceMeters <= clampNumber(radiusMeters, 250, 10000, 1500))
    .sort((a, b) => contentPriority(b) - contentPriority(a) || a.distanceMeters - b.distanceMeters);
  const linked = nearby.filter(hasDocumentaryLink);
  const discoverable = nearby.filter((poi) => !hasDocumentaryLink(poi)).slice(0, discoveryLimit);
  const candidates = [...linked, ...discoverable]
    .filter((poi, index, items) => items.findIndex((item) => item.id === poi.id) === index)
    .slice(0, limit);

  const results = await mapWithConcurrency(candidates, clampNumber(options.concurrency, 1, 8, 4), async (poi) => {
    try {
      const source = await resolvePoiSource(poi, options);
      const hasNewText = Boolean(source.extract);
      const hasNewImage = Boolean(isEditorialImage(source.imageUrl) && source.imageUrl !== poi.imageUrl);
      if (!hasNewText && !hasNewImage) return { id: poi.id, status: "unavailable", source: poi.source };
      const descriptionLong = hasNewText ? truncateAtSentence(source.extract, 90) : poi.descriptionLong;
      const descriptionShort = hasNewText ? truncateAtWord(source.extract, 140) : poi.descriptionShort;
      await updateZonePoiDescription(poi.id, {
        descriptionShort,
        descriptionLong,
        imageUrl: source.imageUrl,
        clearImage: Boolean(poi.imageUrl && !isEditorialImage(poi.imageUrl) && !source.imageUrl),
        source: source.source,
        externalRef: source.externalRef
      });
      return { id: poi.id, status: "enriched", source: source.source, externalRef: source.externalRef };
    } catch (error) {
      return { id: poi.id, status: "failed", source: poi.source, code: error.code || "zone_content_failed" };
    }
  });

  return {
    businessId: clean(options.businessId),
    requested: candidates.length,
    enriched: results.filter((result) => result.status === "enriched").length,
    unavailable: results.filter((result) => result.status === "unavailable").length,
    failed: results.filter((result) => result.status === "failed").length,
    results
  };
}

function normalizeCoordinates(value) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export async function resolvePoiSource(poi, options = {}) {
  if (poi.source === "wikipedia") {
    const wikipedia = await fetchWikipediaSummary(poi.externalRef, options);
    return addCommonsFallback(wikipedia, poi, options);
  }
  if (poi.source !== "wikidata" || !/^Q\d+$/i.test(poi.externalRef)) {
    if (!hasCoordinates(poi)) return emptySource(poi);
    const nearbyWikipedia = await fetchNearbyWikipediaMatch(poi, options);
    if (nearbyWikipedia.extract || nearbyWikipedia.imageUrl) return addCommonsFallback(nearbyWikipedia, poi, options);
    return fetchNearbyCommonsImage(poi, options);
  }
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(`https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(poi.externalRef)}.json`, requestOptions(options));
  if (!response.ok) return emptySource(poi);
  const payload = await response.json();
  const entity = payload?.entities?.[poi.externalRef] || {};
  const wikipediaTitle = clean(entity.sitelinks?.eswiki?.title);
  if (wikipediaTitle) {
    const wikipedia = await fetchWikipediaSummary(wikipediaTitle, options);
    if (wikipedia.extract || wikipedia.imageUrl) return addCommonsFallback(wikipedia, poi, options);
  }
  const description = clean(entity.descriptions?.es?.value || entity.descriptions?.en?.value);
  const imageName = clean(entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value);
  const wikidata = {
    extract: description,
    imageUrl: imageName && isEditorialImage(imageName) ? commonsImageUrl(imageName) : poi.imageUrl,
    source: "wikidata",
    externalRef: poi.externalRef
  };
  if (wikidata.extract || wikidata.imageUrl || !hasCoordinates(poi)) return addCommonsFallback(wikidata, poi, options);
  const nearbyWikipedia = await fetchNearbyWikipediaMatch(poi, options);
  if (nearbyWikipedia.extract || nearbyWikipedia.imageUrl) return addCommonsFallback(nearbyWikipedia, poi, options);
  return fetchNearbyCommonsImage(poi, options);
}

export async function fetchWikipediaSummary(title, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(
    `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean(title).replace(/ /g, "_"))}`,
    requestOptions(options)
  );
  if (!response.ok) return { extract: "", imageUrl: "", source: "wikipedia", externalRef: clean(title) };
  const payload = await response.json();
  return {
    extract: clean(payload.extract),
    imageUrl: editorialImage(payload.originalimage?.source || payload.thumbnail?.source),
    source: "wikipedia",
    externalRef: clean(payload.title || title)
  };
}

export async function fetchNearbyWikipediaMatch(poi, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const url = new URL("https://es.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    generator: "geosearch",
    ggscoord: `${Number(poi.latitude)}|${Number(poi.longitude)}`,
    ggsradius: String(clampNumber(options.wikipediaRadiusMeters, 100, 1000, 450)),
    ggslimit: "12",
    ggsnamespace: "0",
    prop: "coordinates|extracts|pageimages",
    exintro: "1",
    explaintext: "1",
    piprop: "original|thumbnail",
    pithumbsize: "1400",
    format: "json",
    formatversion: "2",
    origin: "*"
  }).toString();
  const response = await fetchImpl(url, requestOptions(options));
  if (!response.ok) return emptySource(poi);
  const payload = await response.json();
  const pages = normalizePages(payload?.query?.pages)
    .map((page) => ({
      page,
      match: nameMatchScore(poi.name, page.title),
      distance: pageDistance(poi, page)
    }))
    .filter((candidate) => candidate.match >= 0.72 && candidate.distance <= 500)
    .sort((a, b) => b.match - a.match || a.distance - b.distance);
  const match = pages[0]?.page;
  if (!match) return emptySource(poi);
  return {
    extract: clean(match.extract),
    imageUrl: editorialImage(match.original?.source || match.thumbnail?.source || poi.imageUrl),
    source: "wikipedia",
    externalRef: clean(match.title)
  };
}

export async function fetchNearbyCommonsImage(poi, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    generator: "geosearch",
    ggscoord: `${Number(poi.latitude)}|${Number(poi.longitude)}`,
    ggsradius: String(clampNumber(options.commonsRadiusMeters, 50, 500, 220)),
    ggslimit: "20",
    ggsnamespace: "6",
    prop: "coordinates|imageinfo",
    iiprop: "url",
    iiurlwidth: "1400",
    format: "json",
    formatversion: "2",
    origin: "*"
  }).toString();
  const response = await fetchImpl(url, requestOptions(options));
  if (!response.ok) return emptySource(poi);
  const payload = await response.json();
  const images = normalizePages(payload?.query?.pages)
    .map((page) => ({
      page,
      match: nameMatchScore(poi.name, clean(page.title).replace(/^File:/i, "").replace(/\.[^.]+$/, "")),
      distance: pageDistance(poi, page)
    }))
    .filter((candidate) => candidate.match >= 0.62 && candidate.distance <= 260)
    .filter((candidate) => isEditorialImage(candidate.page?.imageinfo?.[0]?.thumburl || candidate.page?.imageinfo?.[0]?.url))
    .sort((a, b) => b.match - a.match || a.distance - b.distance);
  const imageInfo = images[0]?.page?.imageinfo?.[0];
  return {
    extract: "",
    imageUrl: editorialImage(imageInfo?.thumburl || imageInfo?.url || poi.imageUrl),
    source: poi.source,
    externalRef: poi.externalRef
  };
}

export function truncateAtWord(value, maxCharacters = 140) {
  const text = normalizeWhitespace(value);
  if ([...text].length <= maxCharacters) return text;
  const chars = [...text].slice(0, maxCharacters + 1).join("");
  const boundary = chars.slice(0, maxCharacters).replace(/\s+\S*$/, "").trim();
  return boundary || [...text].slice(0, maxCharacters).join("").trim();
}

export function truncateAtSentence(value, maxWords = 90) {
  const text = normalizeWhitespace(value);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  const sentences = segmentSentences(text);
  const selected = [];
  let count = 0;
  for (const sentence of sentences) {
    const sentenceWords = sentence.split(/\s+/).filter(Boolean).length;
    if (selected.length && count + sentenceWords > maxWords) break;
    selected.push(sentence);
    count += sentenceWords;
    if (count >= maxWords) break;
  }
  return selected.join(" ").trim();
}

function segmentSentences(text) {
  if (typeof Intl?.Segmenter === "function") {
    return [...new Intl.Segmenter("es", { granularity: "sentence" }).segment(text)]
      .map((entry) => entry.segment.trim())
      .filter(Boolean);
  }
  return text.match(/[^.!?]+[.!?]+(?:[”"']|$)|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) || [text];
}

function requestOptions(options) {
  return {
    headers: {
      accept: "application/json",
      "user-agent": clean(process.env.DLS_RADAR_USER_AGENT) || "DLS-Zone-Discovery/1.0"
    },
    signal: AbortSignal.timeout(clampNumber(options.timeoutMs || process.env.ZONE_WIKIPEDIA_TIMEOUT_MS, 3000, 60000, 15000))
  };
}

async function mapWithConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

async function addCommonsFallback(documentary, poi, options) {
  if (isEditorialImage(documentary.imageUrl) || !hasCoordinates(poi)) return documentary;
  const commons = await fetchNearbyCommonsImage(poi, options);
  return { ...documentary, imageUrl: commons.imageUrl || "" };
}

export function isEditorialImage(value) {
  const image = clean(value);
  if (!image) return false;
  const normalized = image.toLowerCase();
  return !/(?:logo|logotipo|escudo|coat[_ -]?of[_ -]?arms|icono|pictogram)/i.test(normalized)
    && !/\.svg(?:[/?#]|$)/i.test(normalized);
}

function editorialImage(value) {
  const image = clean(value);
  return isEditorialImage(image) ? image : "";
}

function hasDocumentaryLink(poi) {
  return (poi.source === "wikidata" && /^Q\d+$/i.test(poi.externalRef))
    || (poi.source === "wikipedia" && Boolean(poi.externalRef));
}

function contentPriority(poi) {
  return Number(poi.verified) * 80
    + Number(hasDocumentaryLink(poi)) * 55
    + Number(!poi.imageUrl) * 24
    + Number(!poi.descriptionLong) * 18
    + Math.max(0, 16 - Number(poi.distanceMeters || 0) / 100);
}

function hasCoordinates(poi) {
  return Number.isFinite(Number(poi?.latitude)) && Number.isFinite(Number(poi?.longitude));
}

function normalizePages(pages) {
  if (Array.isArray(pages)) return pages;
  return pages && typeof pages === "object" ? Object.values(pages) : [];
}

function pageDistance(poi, page) {
  const coordinate = Array.isArray(page?.coordinates) ? page.coordinates[0] : null;
  const lat = Number(coordinate?.lat);
  const lng = Number(coordinate?.lon ?? coordinate?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Number.POSITIVE_INFINITY;
  return distanceMeters(
    { lat: Number(poi.latitude), lng: Number(poi.longitude) },
    { lat, lng }
  );
}

export function nameMatchScore(left, right) {
  const leftText = normalizeName(left);
  const rightText = normalizeName(right);
  if (!leftText || !rightText) return 0;
  if (leftText === rightText) return 1;
  const leftTokens = significantTokens(leftText);
  const rightTokens = significantTokens(rightText);
  if (!leftTokens.length || !rightTokens.length) return 0;
  const overlap = leftTokens.filter((token) => rightTokens.includes(token)).length;
  const coverage = overlap / Math.min(leftTokens.length, rightTokens.length);
  const containment = leftText.includes(rightText) || rightText.includes(leftText);
  return Math.min(1, coverage * 0.82 + (containment ? 0.18 : 0));
}

const NAME_STOP_WORDS = new Set([
  "a", "al", "de", "del", "el", "en", "la", "las", "los", "y",
  "iglesia", "jardin", "jardines", "monumento", "museo", "parque", "plaza", "mirador"
]);

function significantTokens(value) {
  return [...new Set(value.split(" ").filter((token) => token.length > 2 && !NAME_STOP_WORDS.has(token)))];
}

function normalizeName(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:file|archivo)\b/gi, " ")
    .replace(/[^a-z0-9]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function emptySource(poi) {
  return { extract: "", imageUrl: poi.imageUrl, source: poi.source, externalRef: poi.externalRef };
}
function commonsImageUrl(file) {
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(clean(file).replace(/^File:/i, ""))}`;
}
function distanceMeters(left, right) {
  const lat1 = radians(Number(left?.lat));
  const lat2 = radians(Number(right?.lat));
  const deltaLat = radians(Number(right?.lat) - Number(left?.lat));
  const deltaLng = radians(Number(right?.lng) - Number(left?.lng));
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function radians(value) { return value * Math.PI / 180; }
function normalizeWhitespace(value) { return clean(value).replace(/\s+/g, " "); }
function clean(value) { return String(value ?? "").trim(); }
function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
}
function contentError(statusCode, message, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}
