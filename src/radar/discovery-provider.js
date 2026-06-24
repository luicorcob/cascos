(function (global) {
  const CATEGORY_LABELS = {
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

  function createBusinessDiscoveryProvider(options = {}) {
    let mode = normalizeMode(options.mode || readConfiguredMode());
    const endpoint = options.endpoint || "/api/discovery/search";

    return {
      search,
      get mode() { return mode; },
      setMode(nextMode) { mode = normalizeMode(nextMode); }
    };

    async function search(criteria = {}) {
      const city = clean(criteria.city);
      const category = CATEGORY_LABELS[criteria.category] ? criteria.category : "all";
      const radius = clamp(Number(criteria.radius || 3000), 1000, 10000);
      if (city.length < 2) throw new Error("Escribe una localidad válida.");
      if (mode === "demo") return searchDemo({ city, category, radius });
      return searchApi({ city, category, radius, mode });
    }

    async function searchApi(criteria) {
      const params = new URLSearchParams({
        city: criteria.city,
        category: criteria.category,
        radius: String(criteria.radius),
        mode: criteria.mode
      });
      const url = global.LocalLiftApi?.url(`${endpoint}?${params}`) || `${endpoint}?${params}`;
      const headers = global.LocalLiftApi?.headers?.() || { Accept: "application/json" };
      const response = await fetch(url, { headers });
      let payload = {};
      try { payload = await response.json(); } catch (error) { payload = {}; }
      if (!response.ok) throw new Error(payload.error || "El proveedor geográfico no está disponible.");
      return {
        businesses: Array.isArray(payload.businesses) ? payload.businesses : [],
        center: payload.center || averageCenter(payload.businesses),
        provider: normalizeMode(payload.provider || criteria.mode),
        sourceLabel: payload.sourceLabel || providerLabel(payload.provider || criteria.mode),
        attribution: payload.attribution || "",
        geocodedLabel: payload.geocodedLabel || "",
        searchedAt: payload.searchedAt || new Date().toISOString()
      };
    }
  }

  async function searchDemo({ city, category }) {
    await wait(280);
    const keys = category === "all" ? Object.keys(CATEGORY_LABELS) : [category];
    const businesses = Array.from({ length: 8 }, (_, index) => {
      const categoryKey = keys[index % keys.length];
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
    return { businesses, center: null, provider: "demo", sourceLabel: "Ejemplo simulado", searchedAt: new Date().toISOString() };
  }

  function readConfiguredMode() {
    const queryMode = new URLSearchParams(global.location?.search || "").get("provider");
    return queryMode || global.DLS_RADAR_PROVIDER_MODE || document.querySelector('meta[name="dls-discovery-mode"]')?.content || "openstreetmap";
  }

  function normalizeMode(value) {
    const mode = String(value || "").toLowerCase();
    if (["osm", "openstreetmap"].includes(mode)) return "openstreetmap";
    if (mode === "places") return "places";
    if (mode === "demo") return "demo";
    return "openstreetmap";
  }

  function providerLabel(mode) {
    if (normalizeMode(mode) === "places") return "Google Places";
    if (normalizeMode(mode) === "openstreetmap") return "OpenStreetMap";
    return "Ejemplo simulado";
  }

  function averageCenter(businesses = []) {
    const points = businesses.map((item) => item.coordinates).filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng));
    if (!points.length) return null;
    return {
      lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
      lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length
    };
  }

  function clean(value) { return String(value || "").trim(); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function wait(milliseconds) { return new Promise((resolve) => setTimeout(resolve, milliseconds)); }

  global.DLSBusinessDiscovery = { createBusinessDiscoveryProvider, CATEGORY_LABELS, searchDemo };
})(globalThis);
