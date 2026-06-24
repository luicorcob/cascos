(function () {
  "use strict";

  const SCORE = window.DLSRadarScore;
  const PITCH = window.DLSRadarPitch;
  const DISCOVERY = window.DLSBusinessDiscovery;
  const CACHE_KEY = "dls-radar-search-cache-v2";
  const RECENT_KEY = "dls-radar-recent-searches-v1";
  const LEADS_KEY = "dls-radar-leads";
  const BRIEF_KEY = "dls-radar-studio-brief";
  const STUDIO_DRAFT_KEY = "locallift-studio-draft";
  const CACHE_TTL = 20 * 60 * 1000;

  if (!SCORE || !PITCH || !DISCOVERY) return;

  const elements = {
    form: document.querySelector("#radarSearchForm"),
    city: document.querySelector("#cityInput"),
    category: document.querySelector("#categorySelect"),
    radius: document.querySelector("#radiusSelect"),
    searchButton: document.querySelector("#searchButton"),
    demoButton: document.querySelector("#demoButton"),
    emptyDemoButton: document.querySelector("#emptyDemoButton"),
    retryButton: document.querySelector("#retryButton"),
    formError: document.querySelector("#formError"),
    recentSearches: document.querySelector("#recentSearches"),
    providerLabel: document.querySelector("#providerLabel"),
    providerPill: document.querySelector("#providerPill"),
    metrics: document.querySelector("#metricsGrid"),
    initial: document.querySelector("#initialState"),
    loading: document.querySelector("#loadingState"),
    empty: document.querySelector("#emptyState"),
    error: document.querySelector("#errorState"),
    errorMessage: document.querySelector("#errorMessage"),
    backendHelp: document.querySelector("#backendHelp"),
    loadingCopy: document.querySelector("#loadingCopy"),
    results: document.querySelector("#resultsArea"),
    recommendations: document.querySelector("#recommendationsGrid"),
    businessList: document.querySelector("#businessList"),
    listEmpty: document.querySelector("#listEmpty"),
    priorityToggle: document.querySelector("#priorityToggle"),
    sort: document.querySelector("#sortSelect"),
    visibleCount: document.querySelector("#visibleCount"),
    resultCity: document.querySelector("#resultCity"),
    map: document.querySelector("#opportunityMap"),
    mapDataNotice: document.querySelector("#mapDataNotice"),
    mapSourceNote: document.querySelector("#mapSourceNote"),
    mapAreaLabel: document.querySelector("#mapAreaLabel"),
    toast: document.querySelector("#toast"),
    metricFound: document.querySelector("#metricFound"),
    metricNoWeb: document.querySelector("#metricNoWeb"),
    metricPhone: document.querySelector("#metricPhone"),
    metricHot: document.querySelector("#metricHot"),
    metricAverage: document.querySelector("#metricAverage")
  };

  const provider = DISCOVERY.createBusinessDiscoveryProvider();
  const demoProvider = DISCOVERY.createBusinessDiscoveryProvider({ mode: "demo" });
  const state = {
    businesses: [],
    center: null,
    city: "",
    radius: 3000,
    provider: provider.mode,
    sourceLabel: "",
    attribution: "",
    geocodedLabel: "",
    hasSearched: false,
    requestId: 0,
    selectedId: "",
    mapInstance: null,
    mapMarkersLayer: null,
    mapAreaLayer: null,
    markerById: new Map(),
    backendConnected: false
  };
  let debounceTimer = 0;
  let toastTimer = 0;

  init();

  async function init() {
    updateProviderBadge(provider.mode);
    renderRecentSearches();
    bindEvents();

    await syncConfiguredProvider();

    const params = new URLSearchParams(location.search);
    const city = params.get("city");
    if (city) {
      elements.city.value = city;
      if (params.get("category")) elements.category.value = params.get("category");
      runSearch();
    }
  }

  async function syncConfiguredProvider() {
    const configuredUrl = window.LocalLiftApi?.url("/api/discovery/config") || "/api/discovery/config";
    const candidates = [configuredUrl];
    const isLocalStaticServer = ["127.0.0.1", "localhost"].includes(location.hostname) && location.port !== "5173";
    if (isLocalStaticServer) {
      candidates.push(`http://${location.hostname}:5173/api/discovery/config`);
      candidates.push(`http://${location.hostname === "localhost" ? "127.0.0.1" : "localhost"}:5173/api/discovery/config`);
    }

    for (const url of [...new Set(candidates)]) {
      try {
        const headers = window.LocalLiftApi?.headers?.() || { Accept: "application/json" };
        const response = await fetch(url, { headers, signal: AbortSignal.timeout(2200) });
        const contentType = response.headers.get("content-type") || "";
        if (!response.ok || !contentType.includes("application/json")) continue;
        const config = await response.json();
        if (!config.mode) continue;

        if (/^https?:\/\//i.test(url)) {
          window.LocalLiftApi?.setBase?.(new URL(url).origin);
        }
        if (!new URLSearchParams(location.search).has("provider")) provider.setMode(config.mode);
        state.backendConnected = true;
        elements.backendHelp.hidden = true;
        updateProviderBadge(provider.mode);
        elements.providerPill.title = config.mode === "places" && !config.ready
          ? "Places seleccionado; falta configurar la credencial del servidor"
          : "Servidor DLS conectado";
        return true;
      } catch (error) {
        // Try the next local/configured endpoint.
      }
    }

    state.backendConnected = false;
    updateProviderBadge("offline");
    return false;
  }

  function bindEvents() {
    elements.form.addEventListener("submit", (event) => {
      event.preventDefault();
      runSearch();
    });
    elements.demoButton.addEventListener("click", loadDemo);
    elements.emptyDemoButton.addEventListener("click", loadDemo);
    elements.retryButton.addEventListener("click", () => runSearch({ bypassCache: true }));
    elements.city.addEventListener("input", () => {
      clearFormError();
      if (state.hasSearched) scheduleSearch(650);
    });
    elements.category.addEventListener("change", () => state.hasSearched && scheduleSearch(120));
    elements.radius.addEventListener("change", () => state.hasSearched && scheduleSearch(120));
    elements.priorityToggle.addEventListener("change", renderExplorer);
    elements.sort.addEventListener("change", renderExplorer);
    elements.businessList.addEventListener("click", handleActionClick);
    elements.recommendations.addEventListener("click", handleActionClick);
    elements.map.addEventListener("click", handleActionClick);
    elements.recentSearches.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-city]");
      if (!button) return;
      elements.city.value = button.dataset.city;
      if (button.dataset.category) elements.category.value = button.dataset.category;
      if (button.dataset.radius) elements.radius.value = button.dataset.radius;
      runSearch();
    });
  }

  function scheduleSearch(delay) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => runSearch({ quietValidation: true }), delay);
  }

  function loadDemo() {
    elements.city.value = "Santander";
    elements.category.value = "all";
    elements.radius.value = "3000";
    runSearch({ forceDemo: true, bypassCache: true });
  }

  async function runSearch(options = {}) {
    clearTimeout(debounceTimer);
    const criteria = readCriteria();
    if (criteria.city.length < 2) {
      if (!options.quietValidation) showFormError("Escribe una ciudad, pueblo o barrio para iniciar el radar.");
      return;
    }

    clearFormError();
    const requestId = ++state.requestId;
    showState("loading");
    elements.searchButton.disabled = true;
    elements.loadingCopy.textContent = `Rastreando ${criteria.category === "all" ? "negocios locales" : categoryLabel(criteria.category).toLowerCase()} en ${criteria.city}...`;

    try {
      if (!options.forceDemo && provider.mode !== "demo" && !state.backendConnected) {
        const connected = await syncConfiguredProvider();
        if (!connected) {
          const error = new Error("Estás abriendo la interfaz sin el servidor DLS. Inícialo para consultar negocios reales.");
          error.code = "backend_unavailable";
          throw error;
        }
      }
      const cacheKey = buildCacheKey(criteria, options.forceDemo ? "demo" : provider.mode);
      let result = !options.bypassCache ? readCachedResult(cacheKey) : null;
      if (!result) {
        result = await (options.forceDemo ? demoProvider : provider).search(criteria);
        cacheResult(cacheKey, result);
      }
      if (requestId !== state.requestId) return;

      const businesses = result.businesses.map((business) => enrichBusiness(business, criteria.city));
      state.businesses = businesses.sort((a, b) => b.opportunityScore - a.opportunityScore);
      state.center = result.center || averageCenter(state.businesses);
      state.city = criteria.city;
      state.radius = criteria.radius;
      state.provider = result.provider || (options.forceDemo ? "demo" : provider.mode);
      state.sourceLabel = result.sourceLabel || "";
      state.attribution = result.attribution || "";
      state.geocodedLabel = result.geocodedLabel || "";
      state.hasSearched = true;
      state.selectedId = state.businesses.find((business) => business.coordinates)?.id || state.businesses[0]?.id || "";
      rememberSearch(criteria);
      updateProviderBadge(state.provider);

      if (!state.businesses.length) {
        showState("empty");
        return;
      }

      showState("results");
      renderResults();
    } catch (error) {
      if (requestId !== state.requestId) return;
      elements.errorMessage.textContent = cleanError(error);
      elements.backendHelp.hidden = error?.code !== "backend_unavailable";
      showState("error");
    } finally {
      if (requestId === state.requestId) elements.searchButton.disabled = false;
    }
  }

  function enrichBusiness(business, fallbackCity) {
    const normalized = {
      ...business,
      id: String(business.id || `business_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
      name: String(business.name || "Negocio local"),
      category: String(business.category || "Negocio local"),
      categoryKey: String(business.categoryKey || business.category || "local"),
      city: String(business.city || fallbackCity),
      address: String(business.address || ""),
      phone: String(business.phone || ""),
      rating: Number(business.rating || 0),
      reviews: Number(business.reviews || business.userRatingCount || 0),
      websiteStatus: SCORE.normalizeStatus(business.websiteStatus),
      coordinates: business.coordinates || null
    };
    normalized.opportunityScore = SCORE.calculateOpportunityScore(normalized);
    normalized.opportunityLevel = SCORE.getOpportunityLevel(normalized.opportunityScore);
    normalized.scoreReasons = SCORE.getScoreReasons(normalized);
    return normalized;
  }

  function renderResults() {
    renderMetrics();
    renderRecommendations();
    renderExplorer();
    elements.resultCity.textContent = state.city;
    elements.mapAreaLabel.textContent = `Radio ${formatRadius(state.radius)}`;
  }

  function renderMetrics() {
    const total = state.businesses.length;
    const noWeb = state.businesses.filter((item) => ["none", "social"].includes(item.websiteStatus)).length;
    const phone = state.businesses.filter((item) => item.phone).length;
    const hot = state.businesses.filter((item) => item.opportunityScore >= 80).length;
    const average = total ? Math.round(state.businesses.reduce((sum, item) => sum + item.opportunityScore, 0) / total) : 0;
    elements.metricFound.textContent = total;
    elements.metricNoWeb.textContent = noWeb;
    elements.metricPhone.textContent = phone;
    elements.metricHot.textContent = hot;
    elements.metricAverage.textContent = average;
  }

  function renderRecommendations() {
    const picks = state.businesses
      .filter((item) => ["none", "social"].includes(item.websiteStatus))
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 3);
    elements.recommendations.innerHTML = picks.map((business, index) => `
      <article class="recommendation-card ${index === 0 ? "is-best" : ""}" data-card-id="${escapeAttr(business.id)}">
        <div class="recommendation-topline">
          <span class="top-badge">Top oportunidad ${index + 1}</span>
          <span class="score-ring score-${business.opportunityLevel.key}"><strong>${business.opportunityScore}</strong><small>/100</small></span>
        </div>
        <p class="recommendation-category">${escapeHtml(business.category)} · ${escapeHtml(business.city)}</p>
        <h3>${escapeHtml(business.name)}</h3>
        <p class="recommendation-reason">${escapeHtml(business.scoreReasons.join(" · ") || "Buena oportunidad de presencia digital")}</p>
        <div class="recommendation-actions">
          <button class="compact-primary" type="button" data-action="proposal" data-id="${escapeAttr(business.id)}">Crear propuesta</button>
          <button class="compact-ghost" type="button" data-action="pitch" data-id="${escapeAttr(business.id)}">Copiar pitch</button>
        </div>
      </article>
    `).join("");
  }

  function renderExplorer() {
    const visible = getVisibleBusinesses();
    elements.visibleCount.textContent = visible.length;
    elements.listEmpty.hidden = visible.length > 0;
    elements.businessList.innerHTML = visible.map(renderBusinessCard).join("");
    renderMap(visible);
  }

  function getVisibleBusinesses() {
    let visible = elements.priorityToggle.checked
      ? state.businesses.filter((item) => ["none", "social"].includes(item.websiteStatus))
      : [...state.businesses];
    const sort = elements.sort.value;
    visible.sort((a, b) => {
      if (sort === "reviews") return b.reviews - a.reviews;
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "name") return a.name.localeCompare(b.name, "es");
      return b.opportunityScore - a.opportunityScore;
    });
    return visible;
  }

  function renderBusinessCard(business) {
    const website = websiteMeta(business);
    const isAdded = readLeads().some((lead) => lead.id === business.id);
    const reputation = business.rating
      ? `<span class="rating"><b>★</b> ${business.rating.toFixed(1)} <small>(${business.reviews} reseñas)</small></span>`
      : `<span class="source-fact">Ficha real · ${escapeHtml(business.sourceLabel || state.sourceLabel || "fuente geográfica")}</span>`;
    return `
      <article class="business-card ${state.selectedId === business.id ? "is-selected" : ""}" data-card-id="${escapeAttr(business.id)}">
        <div class="business-card-main">
          <div class="business-heading">
            <div class="business-avatar">${escapeHtml(initials(business.name))}</div>
            <div>
              <p>${escapeHtml(business.category)}</p>
              <h3>${escapeHtml(business.name)}</h3>
            </div>
            <span class="website-badge website-${website.key}">${website.label}</span>
          </div>
          <p class="business-address"><span aria-hidden="true">⌖</span> ${escapeHtml(business.address || business.city)}</p>
          <div class="business-facts">
            ${reputation}
            <span>${business.phone ? `<a href="tel:${escapeAttr(phoneHref(business.phone))}">${escapeHtml(business.phone)}</a>` : "Sin teléfono visible"}</span>
          </div>
        </div>
        <div class="business-score score-${business.opportunityLevel.key}">
          <span>Score DLS</span><strong>${business.opportunityScore}</strong><small>${business.opportunityLevel.label}</small>
          <i><b style="width:${business.opportunityScore}%"></b></i>
        </div>
        <div class="business-actions">
          <button class="create-button" type="button" data-action="create" data-id="${escapeAttr(business.id)}">Crear web</button>
          <button type="button" data-action="lead" data-id="${escapeAttr(business.id)}" ${isAdded ? "disabled" : ""}>${isAdded ? "Lead añadido" : "Añadir a leads"}</button>
          <button type="button" data-action="map" data-id="${escapeAttr(business.id)}">Ver en mapa</button>
          <button type="button" data-action="pitch" data-id="${escapeAttr(business.id)}">Copiar pitch</button>
        </div>
      </article>
    `;
  }

  function renderMap(visible = getVisibleBusinesses()) {
    if (!initializeMap()) return;

    state.mapMarkersLayer.clearLayers();
    state.mapAreaLayer.clearLayers();
    state.markerById.clear();

    if (state.provider === "demo") {
      showMapNotice("Vista de ejemplo", "Los negocios de demostración no están geolocalizados y no incluyen enlaces externos.");
      state.mapInstance.setView([40.4168, -3.7038], 5);
      elements.mapSourceNote.textContent = "Modo ejemplo: nombres, direcciones y datos son ficticios. Realiza una búsqueda normal para consultar negocios reales.";
      return;
    }

    const points = visible.filter((business) => Number.isFinite(business.coordinates?.lat) && Number.isFinite(business.coordinates?.lng));
    if (!points.length) {
      showMapNotice("Sin coordenadas disponibles", "La fuente no ha devuelto ubicaciones válidas para este filtro.");
      return;
    }

    hideMapNotice();
    const center = state.center || averageCenter(points);
    if (center) {
      window.L.circle([center.lat, center.lng], {
        radius: state.radius,
        color: "#6078ff",
        weight: 1,
        opacity: 0.46,
        fillColor: "#6078ff",
        fillOpacity: 0.035,
        interactive: false
      }).addTo(state.mapAreaLayer);
    }

    const bounds = [];
    points.forEach((business) => {
      const markerClass = business.opportunityScore >= 80
        ? "marker-hot"
        : ["none", "social"].includes(business.websiteStatus) ? "marker-no-web" : "marker-low";
      const icon = window.L.divIcon({
        className: "dls-map-icon-shell",
        html: `<span class="dls-map-icon ${markerClass}"><b>${business.opportunityScore}</b></span>`,
        iconSize: [42, 48],
        iconAnchor: [21, 45],
        popupAnchor: [0, -40]
      });
      const marker = window.L.marker([business.coordinates.lat, business.coordinates.lng], {
        icon,
        title: business.name,
        riseOnHover: true
      });
      marker.bindPopup(buildMapPopup(business), { className: "dls-leaflet-popup", maxWidth: 340, minWidth: 280 });
      marker.on("click", () => selectBusiness(business.id, { scrollCard: false, openPopup: false }));
      marker.addTo(state.mapMarkersLayer);
      state.markerById.set(business.id, marker);
      bounds.push([business.coordinates.lat, business.coordinates.lng]);
    });

    if (bounds.length === 1) state.mapInstance.setView(bounds[0], 16);
    else state.mapInstance.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });

    elements.mapSourceNote.textContent = state.provider === "places"
      ? "Ubicaciones y fichas servidas por Google Places. La ausencia de web se refiere al campo web de la ficha."
      : "Mapa y datos © OpenStreetMap contributors. “Web no declarada” significa que la ficha no incluye ese dato; no es una verificación absoluta.";
    setTimeout(() => state.mapInstance?.invalidateSize(), 0);
  }

  function initializeMap() {
    if (state.mapInstance) return true;
    if (!window.L) {
      showMapNotice("No se pudo cargar el mapa", "Comprueba la conexión necesaria para descargar la librería cartográfica.");
      return false;
    }
    state.mapInstance = window.L.map(elements.map, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: true
    });
    window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
    }).addTo(state.mapInstance);
    state.mapAreaLayer = window.L.layerGroup().addTo(state.mapInstance);
    state.mapMarkersLayer = typeof window.L.markerClusterGroup === "function"
      ? window.L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 46,
        spiderfyOnMaxZoom: true,
        iconCreateFunction(cluster) {
          return window.L.divIcon({
            className: "dls-cluster-shell",
            html: `<span class="dls-cluster-icon"><b>${cluster.getChildCount()}</b><small>negocios</small></span>`,
            iconSize: [58, 58]
          });
        }
      }).addTo(state.mapInstance)
      : window.L.layerGroup().addTo(state.mapInstance);
    state.mapInstance.setView([40.4168, -3.7038], 5);
    return true;
  }

  function buildMapPopup(business) {
    const website = websiteMeta(business);
    const sourceUrl = safeExternalUrl(business.mapsUrl);
    const webUrl = safeExternalUrl(business.website);
    return `
      <article class="leaflet-business-popup">
        <p class="popup-category">${escapeHtml(business.category)} · ${escapeHtml(business.sourceLabel || state.sourceLabel)}</p>
        <h3>${escapeHtml(business.name)}</h3>
        <span class="website-badge website-${website.key}">${website.label}</span>
        <p class="popup-address">${escapeHtml(business.address)}</p>
        <div class="popup-score"><span>Score de oportunidad</span><strong>${business.opportunityScore}/100</strong></div>
        <div class="popup-actions">
          <button class="compact-primary" type="button" data-action="proposal" data-id="${escapeAttr(business.id)}">Crear propuesta</button>
          ${sourceUrl ? `<a href="${escapeAttr(sourceUrl)}" target="_blank" rel="noreferrer">Abrir ficha original ↗</a>` : ""}
          ${webUrl ? `<a href="${escapeAttr(webUrl)}" target="_blank" rel="noreferrer">Ver web ↗</a>` : ""}
        </div>
      </article>
    `;
  }

  function showMapNotice(title, message) {
    elements.mapDataNotice.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(message)}</span>`;
    elements.mapDataNotice.hidden = false;
  }

  function hideMapNotice() {
    elements.mapDataNotice.hidden = true;
  }

  function selectBusiness(id, options = {}) {
    const business = state.businesses.find((item) => item.id === id);
    if (!business) return;
    state.selectedId = id;
    document.querySelectorAll(".business-card").forEach((card) => card.classList.toggle("is-selected", card.dataset.cardId === id));
    if (options.openPopup !== false) {
      const marker = state.markerById.get(id);
      if (marker && typeof state.mapMarkersLayer?.zoomToShowLayer === "function") {
        state.mapMarkersLayer.zoomToShowLayer(marker, () => marker.openPopup());
      } else {
        marker?.openPopup();
      }
    }
    if (options.scrollCard !== false) {
      document.querySelector(`[data-card-id="${cssEscape(id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  async function handleActionClick(event) {
    const actionTarget = event.target.closest("[data-action]");
    if (!actionTarget) return;
    const action = actionTarget.dataset.action;
    const business = state.businesses.find((item) => item.id === actionTarget.dataset.id);
    if (!business) return;
    if (action === "pitch") await copyPitch(business, actionTarget);
    if (action === "lead") await addLead(business, actionTarget);
    if (action === "map") {
      selectBusiness(business.id, { scrollCard: false });
      elements.map.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (action === "create" || action === "proposal") await createWebsite(business, actionTarget);
  }

  async function copyPitch(business, button) {
    const pitch = PITCH.generatePitch(business);
    try {
      await copyText(pitch);
      pulseButton(button, "Pitch copiado");
      showToast("Pitch personalizado copiado al portapapeles.", "success");
    } catch (error) {
      showToast("No se pudo copiar automáticamente. Revisa los permisos del navegador.", "error");
    }
  }

  async function addLead(business, button) {
    const leads = readLeads();
    if (leads.some((lead) => lead.id === business.id)) {
      pulseButton(button, "Lead añadido");
      return;
    }
    const lead = {
      id: business.id,
      businessName: business.name,
      category: business.category,
      city: business.city,
      address: business.address,
      phone: business.phone,
      rating: business.rating,
      reviews: business.reviews,
      websiteStatus: business.websiteStatus,
      opportunityScore: business.opportunityScore,
      source: "Radar de Negocios",
      sourceProvider: business.provider,
      status: "Nuevo",
      createdAt: new Date().toISOString()
    };
    leads.unshift(lead);
    localStorage.setItem(LEADS_KEY, JSON.stringify(leads.slice(0, 500)));
    button.disabled = true;
    button.textContent = "Lead añadido";
    showToast(`${business.name} se ha añadido a leads.`, "success");
    syncLead(lead).catch(() => showToast("Lead guardado en este navegador; la API no está disponible.", "neutral"));
  }

  async function syncLead(lead) {
    const url = window.LocalLiftApi?.url("/api/leads") || "/api/leads";
    const headers = window.LocalLiftApi?.headers?.({ json: true }) || { "Content-Type": "application/json", Accept: "application/json" };
    const response = await fetch(url, { method: "POST", headers, body: JSON.stringify(lead) });
    if (!response.ok) throw new Error("Lead API unavailable");
  }

  async function createWebsite(business, button) {
    const originalLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Preparando Studio...";
    const brief = buildStudioBrief(business);
    let studioBusiness = buildStudioBusiness(business, brief);

    try {
      const url = window.LocalLiftApi?.url("/api/studio/from-opportunity") || "/api/studio/from-opportunity";
      const headers = window.LocalLiftApi?.headers?.({ json: true }) || { "Content-Type": "application/json", Accept: "application/json" };
      const response = await fetch(url, { method: "POST", headers, body: JSON.stringify({ ...business, brief }) });
      if (response.ok) {
        const payload = await response.json();
        studioBusiness = payload.studioBusiness || studioBusiness;
      }
    } catch (error) {
      // The local bridge below keeps the workflow operational without a server.
    }

    try {
      const previousDraft = localStorage.getItem(STUDIO_DRAFT_KEY);
      if (previousDraft) localStorage.setItem("dls-radar-previous-studio-draft", previousDraft);
      localStorage.setItem(BRIEF_KEY, JSON.stringify(brief));
      localStorage.setItem(STUDIO_DRAFT_KEY, JSON.stringify(studioBusiness));
      location.href = `../index.html?source=radar&opportunity=${encodeURIComponent(business.id)}`;
    } catch (error) {
      button.disabled = false;
      button.textContent = originalLabel;
      showToast("No se pudo preparar el borrador del Studio.", "error");
    }
  }

  function buildStudioBrief(business) {
    return {
      businessName: business.name,
      city: business.city,
      category: business.category,
      address: business.address,
      phone: business.phone,
      rating: business.rating,
      reviews: business.reviews,
      websiteStatus: business.websiteStatus,
      opportunityScore: business.opportunityScore,
      provider: business.provider,
      sourceLabel: business.sourceLabel,
      suggestedPositioning: PITCH.getSuggestedPositioning(business),
      suggestedSections: PITCH.getSuggestedSections(business),
      suggestedCTA: PITCH.getSuggestedCTA(business)
    };
  }

  function buildStudioBusiness(business, brief) {
    const category = normalize(business.categoryKey || business.category);
    const isFood = includesAny(category, ["restaurant", "restaurante", "bar", "cafe", "cafeteria"]);
    const isAppointment = includesAny(category, ["clinic", "clinica", "dentist", "dentista", "hairdresser", "peluqueria", "gym", "gimnasio"]);
    const services = serviceSuggestions(category);
    const sourceLabel = business.sourceLabel || (business.provider === "places" ? "Google Places" : "OpenStreetMap");
    const reputationFeature = business.rating
      ? `Reputación local: ${business.rating.toFixed(1)} estrellas y ${business.reviews} reseñas`
      : `Presencia verificada en ${sourceLabel}`;
    return {
      name: business.name,
      category: business.category,
      location: business.city,
      tagline: brief.suggestedPositioning,
      description: `${business.name} es un negocio local de ${business.category.toLowerCase()} en ${business.city}. Esta propuesta convierte su reputación local en una experiencia digital clara, fiable y orientada a contacto.`,
      conversionGoal: `${brief.suggestedCTA} y convertir búsquedas locales en clientes`,
      announcement: "Nueva web en preparación · propuesta creada desde DLS Radar",
      phone: business.phone,
      email: "",
      address: business.address,
      services,
      features: [
        reputationFeature,
        "Contacto y ubicación visibles desde cualquier dispositivo",
        `${brief.suggestedCTA} como acción principal de la experiencia`,
        "Contenido preparado para posicionamiento y confianza local"
      ],
      testimonials: [],
      trustBadges: business.rating ? [`${business.rating.toFixed(1)} en Google`, `${business.reviews} reseñas locales`, "Contacto directo", `Ubicación en ${business.city}`] : [`Ficha en ${sourceLabel}`, "Ubicación real", `Presencia en ${business.city}`],
      links: business.mapsUrl ? [{ label: business.provider === "places" ? "Google Maps" : "OpenStreetMap", url: business.mapsUrl }] : [],
      bookingLabel: brief.suggestedCTA,
      bookingUrl: business.phone ? `https://wa.me/${business.phone.replace(/\D/g, "")}` : "#contacto",
      showBooking: isFood || isAppointment || Boolean(business.phone),
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
        enabled: business.provider === "places",
        mapsUrl: business.mapsUrl || "",
        rating: business.rating,
        reviewCount: business.reviews,
        appointmentUrl: business.phone ? `https://wa.me/${business.phone.replace(/\D/g, "")}` : ""
      },
      radarOpportunity: brief
    };
  }

  function serviceSuggestions(category) {
    if (includesAny(category, ["restaurant", "bar", "cafe", "cafeteria"])) return ["Carta y especialidades", "Reservas", "Menús para grupos", "Eventos", "Opciones especiales"];
    if (includesAny(category, ["clinic", "clinica", "dentist", "dentista"])) return ["Primera consulta", "Tratamientos y especialidades", "Seguimiento", "Cita previa", "Atención personalizada"];
    if (includesAny(category, ["hairdresser", "peluqueria"])) return ["Corte y peinado", "Coloración", "Tratamientos", "Eventos", "Reserva de cita"];
    if (includesAny(category, ["workshop", "taller"])) return ["Mantenimiento", "Diagnóstico", "Reparaciones", "Neumáticos", "Presupuesto sin compromiso"];
    if (includesAny(category, ["real_estate", "inmobiliaria"])) return ["Venta de propiedades", "Alquiler", "Valoración", "Captación", "Asesoramiento"];
    return ["Servicio principal", "Atención personalizada", "Presupuesto", "Asesoramiento", "Contacto directo"];
  }

  function showState(next) {
    elements.initial.hidden = next !== "initial";
    elements.loading.hidden = next !== "loading";
    elements.empty.hidden = next !== "empty";
    elements.error.hidden = next !== "error";
    elements.results.hidden = next !== "results";
    elements.metrics.hidden = next !== "results";
    document.body.dataset.radarState = next;
  }

  function readCriteria() {
    return {
      city: String(elements.city.value || "").trim(),
      category: elements.category.value,
      radius: Number(elements.radius.value || 3000)
    };
  }

  function rememberSearch(criteria) {
    const recent = readJson(RECENT_KEY, []);
    const key = `${normalize(criteria.city)}:${criteria.category}:${criteria.radius}`;
    const next = [{ ...criteria, key }, ...recent.filter((item) => item.key !== key)].slice(0, 5);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    renderRecentSearches();
  }

  function renderRecentSearches() {
    const recent = readJson(RECENT_KEY, []);
    elements.recentSearches.innerHTML = recent.length
      ? `<span>Recientes</span>${recent.map((item) => `<button type="button" data-city="${escapeAttr(item.city)}" data-category="${escapeAttr(item.category)}" data-radius="${escapeAttr(item.radius)}">${escapeHtml(item.city)}</button>`).join("")}`
      : "";
  }

  function buildCacheKey(criteria, mode) {
    return `${mode}:${normalize(criteria.city)}:${criteria.category}:${criteria.radius}`;
  }

  function readCachedResult(key) {
    const cache = readJson(CACHE_KEY, {});
    const entry = cache[key];
    if (!entry || Date.now() - entry.savedAt > CACHE_TTL) return null;
    return entry.result;
  }

  function cacheResult(key, result) {
    const cache = readJson(CACHE_KEY, {});
    cache[key] = { savedAt: Date.now(), result };
    const entries = Object.entries(cache).sort((a, b) => b[1].savedAt - a[1].savedAt).slice(0, 12);
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  }

  function readLeads() { return readJson(LEADS_KEY, []); }
  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
    catch (error) { return fallback; }
  }

  function updateProviderBadge(mode) {
    if (mode === "offline") {
      elements.providerLabel.textContent = "Servidor DLS no conectado";
      elements.providerPill.classList.remove("is-live", "is-demo");
      elements.providerPill.classList.add("is-offline");
      return;
    }
    const places = mode === "places";
    const osm = mode === "openstreetmap";
    elements.providerLabel.textContent = places
      ? "Datos reales · Google Places"
      : osm ? "Datos reales · OpenStreetMap" : "Ejemplo · datos simulados";
    elements.providerPill.classList.toggle("is-live", places || osm);
    elements.providerPill.classList.toggle("is-demo", mode === "demo");
    elements.providerPill.classList.remove("is-offline");
  }

  function showFormError(message) {
    elements.formError.textContent = message;
    elements.formError.hidden = false;
    elements.city.setAttribute("aria-invalid", "true");
    elements.city.focus();
  }

  function clearFormError() {
    elements.formError.hidden = true;
    elements.city.removeAttribute("aria-invalid");
  }

  function websiteMeta(business) {
    const status = business.websiteStatus;
    if (status === "none" && business.provider === "openstreetmap") return { key: "none", label: "Web no declarada" };
    if (status === "none" && business.provider === "places") return { key: "none", label: "Sin web en ficha" };
    if (status === "none" && business.provider === "demo") return { key: "unverified", label: "Ejemplo: sin web" };
    if (status === "none") return { key: "none", label: "Web no declarada" };
    if (status === "website") return { key: "website", label: "Tiene web" };
    if (status === "social") return { key: "social", label: "Solo redes" };
    return { key: "unverified", label: "No verificado" };
  }

  function categoryLabel(key) { return DISCOVERY.CATEGORY_LABELS[key] || "Todos los negocios"; }
  function formatRadius(radius) { return radius >= 1000 ? `${radius / 1000} km` : `${radius} m`; }
  function averageCenter(items) {
    const points = items.map((item) => item.coordinates).filter((point) => Number.isFinite(point?.lat) && Number.isFinite(point?.lng));
    if (!points.length) return null;
    return { lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length, lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length };
  }

  function pulseButton(button, text) {
    const previous = button.textContent;
    button.textContent = text;
    button.classList.add("is-confirmed");
    setTimeout(() => { button.textContent = previous; button.classList.remove("is-confirmed"); }, 1700);
  }

  function showToast(message, kind) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.dataset.kind = kind;
    elements.toast.hidden = false;
    requestAnimationFrame(() => elements.toast.classList.add("is-visible"));
    toastTimer = setTimeout(() => {
      elements.toast.classList.remove("is-visible");
      setTimeout(() => { elements.toast.hidden = true; }, 220);
    }, 3200);
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    if (!copied) throw new Error("Copy failed");
  }

  function cleanError(error) {
    const message = String(error?.message || "").trim();
    if (message && !/fetch|network/i.test(message)) return message;
    return "No se pudo consultar el proveedor geográfico. Revisa la conexión y vuelve a intentarlo.";
  }

  function phoneHref(value) { return String(value || "").replace(/[^\d+]/g, ""); }
  function safeExternalUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
    } catch (error) {
      return "";
    }
  }
  function initials(value) { return String(value || "DLS").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
  function normalize(value) { return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function includesAny(value, candidates) { return candidates.some((candidate) => value.includes(candidate)); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function cssEscape(value) { return window.CSS?.escape ? window.CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&"); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }
  function escapeAttr(value) { return escapeHtml(value); }
})();
