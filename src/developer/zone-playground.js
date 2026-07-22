(function () {
  const DEFAULT_POINT = { lat: 43.462586, lng: -3.809988 };
  const refs = {
    form: document.querySelector("#zonePreviewForm"),
    latitude: document.querySelector("#zoneLatitude"),
    longitude: document.querySelector("#zoneLongitude"),
    radius: document.querySelector("#zoneRadius"),
    radiusOutput: document.querySelector("#zoneRadiusOutput"),
    locate: document.querySelector("#zoneUseLocation"),
    submit: document.querySelector("#zonePreviewSubmit"),
    status: document.querySelector("#zonePreviewStatus"),
    loading: document.querySelector("#zonePreviewLoading"),
    mapHint: document.querySelector("#zoneMapHint"),
    coordinatePill: document.querySelector("#zoneCoordinatePill"),
    cards: document.querySelector("#zonePreviewCards"),
    empty: document.querySelector("#zoneResultsEmpty"),
    count: document.querySelector("#zoneResultCount")
  };
  if (!refs.form || !globalThis.L) return;

  const map = L.map("zonePlaygroundMap", { zoomControl: true, preferCanvas: true }).setView([DEFAULT_POINT.lat, DEFAULT_POINT.lng], 14);
  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    subdomains: "abcd",
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
  }).addTo(map);

  const resultsLayer = L.layerGroup().addTo(map);
  const resultMarkers = new Map();
  let positionMarker = null;
  let radiusCircle = null;
  let busy = false;

  setPoint(DEFAULT_POINT, { pan: false, used: false });
  refs.radius.addEventListener("input", updateRadius);
  refs.latitude.addEventListener("change", setPointFromInputs);
  refs.longitude.addEventListener("change", setPointFromInputs);
  map.on("click", (event) => setPoint(event.latlng, { pan: false, used: true }));
  refs.locate.addEventListener("click", useCurrentLocation);
  refs.form.addEventListener("submit", runPreview);

  function setPoint(point, options = {}) {
    const lat = Number(point?.lat);
    const lng = Number(point?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const normalized = { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
    refs.latitude.value = normalized.lat.toFixed(6);
    refs.longitude.value = normalized.lng.toFixed(6);
    refs.coordinatePill.textContent = `${normalized.lat.toFixed(6)}, ${normalized.lng.toFixed(6)}`;
    if (!positionMarker) {
      positionMarker = L.marker([normalized.lat, normalized.lng], {
        draggable: true,
        zIndexOffset: 1200,
        icon: L.divIcon({ className: "zplay-position-icon", html: '<span class="zplay-position-marker"></span>', iconSize: [38, 38], iconAnchor: [19, 19] })
      }).addTo(map);
      positionMarker.bindTooltip("Tu ubicación de prueba", { direction: "top", offset: [0, -16] });
      positionMarker.on("dragend", () => setPoint(positionMarker.getLatLng(), { pan: false, used: true }));
    } else {
      positionMarker.setLatLng([normalized.lat, normalized.lng]);
    }
    if (!radiusCircle) {
      radiusCircle = L.circle([normalized.lat, normalized.lng], radiusStyle()).addTo(map);
    } else {
      radiusCircle.setLatLng([normalized.lat, normalized.lng]);
    }
    radiusCircle.setRadius(Number(refs.radius.value));
    if (options.pan !== false) map.flyTo([normalized.lat, normalized.lng], Math.max(map.getZoom(), 14), { duration: .65 });
    if (options.used !== false) {
      refs.mapHint.classList.add("is-used");
      setStatus("Punto colocado", "Pulsa “Probar esta ubicación” para consultar los lugares reales.", "ready");
    }
  }

  function setPointFromInputs() {
    if (!refs.latitude.checkValidity() || !refs.longitude.checkValidity()) return;
    setPoint({ lat: refs.latitude.value, lng: refs.longitude.value }, { pan: true, used: true });
  }

  function updateRadius() {
    const value = Number(refs.radius.value);
    refs.radiusOutput.value = `${new Intl.NumberFormat("es-ES").format(value)} m`;
    radiusCircle?.setRadius(value);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setStatus("Ubicación no disponible", "Este navegador no ofrece geolocalización. Puedes pulsar directamente en el mapa.", "error");
      return;
    }
    refs.locate.disabled = true;
    setStatus("Buscando tu ubicación…", "Acepta el permiso del navegador para colocar el punto automáticamente.", "loading");
    navigator.geolocation.getCurrentPosition((position) => {
      refs.locate.disabled = false;
      setPoint({ lat: position.coords.latitude, lng: position.coords.longitude }, { pan: true, used: true });
      map.setZoom(16);
      setStatus("Ubicación encontrada", `Precisión aproximada: ${Math.round(position.coords.accuracy || 0)} m. Ya puedes ejecutar la prueba.`, "ready");
    }, (error) => {
      refs.locate.disabled = false;
      const denied = error.code === error.PERMISSION_DENIED;
      setStatus("No pudimos usar tu ubicación", denied ? "El permiso fue rechazado. Pulsa el punto que quieras directamente en el mapa." : "Comprueba el GPS o selecciona manualmente un punto en el mapa.", "error");
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }

  async function runPreview(event) {
    event.preventDefault();
    if (busy || !refs.form.reportValidity()) return;
    busy = true;
    setBusy(true);
    setStatus("Explorando la zona…", "Consultando puntos de interés y contenido documental.", "loading");
    try {
      const response = await fetch(apiUrl("/api/zone-discovery/preview"), {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify({
          coordinates: { lat: Number(refs.latitude.value), lng: Number(refs.longitude.value) },
          radiusMeters: Number(refs.radius.value)
        })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(apiErrorMessage(response.status, payload));
      renderZone(payload.zone || {});
      const total = Number(payload.zone?.total || 0);
      setStatus(total ? "Previsualización lista" : "No hay suficientes lugares", total ? `${total} recomendaciones reales preparadas para esta ubicación.` : "Prueba con un radio mayor o selecciona otro punto.", total ? "ready" : "error");
    } catch (error) {
      renderZone({ recommendations: [], total: 0 });
      setStatus("No se pudo generar la prueba", requestErrorMessage(error), "error");
    } finally {
      busy = false;
      setBusy(false);
    }
  }

  function renderZone(zone) {
    const items = Array.isArray(zone.recommendations) ? zone.recommendations : [];
    refs.count.textContent = items.length ? `${items.length} lugares` : "Sin resultados";
    refs.empty.hidden = items.length > 0;
    refs.cards.innerHTML = items.map(renderCard).join("");
    resultsLayer.clearLayers();
    resultMarkers.clear();
    const bounds = [[Number(refs.latitude.value), Number(refs.longitude.value)]];
    items.forEach((item, index) => {
      const lat = Number(item.latitude);
      const lng = Number(item.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const marker = L.marker([lat, lng], { icon: resultIcon(index + 1, item.category) })
        .addTo(resultsLayer)
        .bindTooltip(escapeHtml(item.name), { direction: "top", offset: [0, -15] });
      marker.on("click", () => selectCard(item.id, false));
      resultMarkers.set(item.id, marker);
      bounds.push([lat, lng]);
    });
    refs.cards.querySelectorAll(".zone-card-image img").forEach((image) => {
      const reveal = () => image.parentElement?.classList.add("is-loaded");
      const fallback = () => image.parentElement?.classList.add("is-missing");
      if (image.complete) reveal();
      else image.addEventListener("load", reveal, { once: true });
      image.addEventListener("error", fallback, { once: true });
    });
    refs.cards.querySelectorAll("[data-preview-card]").forEach((card) => {
      card.addEventListener("click", (clickEvent) => {
        if (clickEvent.target.closest("a")) return;
        const item = items.find((candidate) => candidate.id === card.dataset.previewCard);
        if (!item) return;
        card.setAttribute("aria-expanded", String(item.hasLongDescription && card.getAttribute("aria-expanded") !== "true"));
        selectCard(item.id, true);
      });
      card.addEventListener("keydown", (keyEvent) => {
        if (!["Enter", " "].includes(keyEvent.key)) return;
        keyEvent.preventDefault();
        card.click();
      });
    });
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
  }

  function renderCard(item, index) {
    const image = item.imageUrl
      ? `<img src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(item.name)}" loading="lazy" decoding="async"><span class="zone-card-image-symbol zone-card-image-fallback" aria-hidden="true">${categorySymbol(item.category)}</span>`
      : `<span class="zone-card-image-symbol" aria-hidden="true">${categorySymbol(item.category)}</span>`;
    const longDescription = item.hasLongDescription && item.descriptionLong
      ? `<div class="zone-card-long"><p>${escapeHtml(item.descriptionLong)}</p></div>`
      : "";
    const attribution = item.attribution?.label
      ? `<a class="zone-card-attribution" href="${escapeAttr(item.attribution.url)}" target="_blank" rel="noreferrer">${escapeHtml(item.attribution.label)}</a>`
      : "";
    return `<article class="zone-card" tabindex="0" aria-expanded="false" data-preview-card="${escapeAttr(item.id)}" style="--zone-card-delay:${index * 55}ms;--poi-color:${categoryColor(item.category)}">
      <figure class="zone-card-image zone-card-image-${escapeAttr(item.category)}">${image}<span class="zone-card-badge">${escapeHtml(item.badge)}</span><span class="zone-card-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span></figure>
      <div class="zone-card-body">
        <div class="zone-card-heading"><div><p>${escapeHtml(item.category)}</p><h3>${escapeHtml(item.name)}</h3></div><span class="zone-card-distance">a ${Number(item.walkingMinutes || 1)} min andando</span></div>
        ${item.descriptionShort ? `<p class="zone-card-short">${escapeHtml(item.descriptionShort)}</p>` : ""}
        ${longDescription}
        <div class="zone-card-footer">${attribution}<a class="zone-card-directions" href="${escapeAttr(item.directionsUrl)}" target="_blank" rel="noreferrer">Cómo llegar <span aria-hidden="true">↗</span></a></div>
      </div>
    </article>`;
  }

  function selectCard(id, moveMap) {
    refs.cards.querySelectorAll("[data-preview-card]").forEach((card) => card.classList.toggle("is-selected", card.dataset.previewCard === id));
    resultMarkers.forEach((marker, markerId) => marker.getElement()?.querySelector(".zplay-result-marker")?.classList.toggle("is-active", markerId === id));
    const marker = resultMarkers.get(id);
    if (marker && moveMap) map.flyTo(marker.getLatLng(), 17, { duration: .65 });
    marker?.openTooltip();
  }

  function setBusy(value) {
    refs.loading.hidden = !value;
    refs.submit.disabled = value;
    refs.locate.disabled = value;
  }

  function setStatus(title, message, state) {
    refs.status.dataset.state = state;
    refs.status.querySelector("strong").textContent = title;
    refs.status.querySelector("span").textContent = message;
  }

  function apiHeaders() {
    return globalThis.LocalLiftApi?.headers?.({ json: true }) || { Accept: "application/json", "Content-Type": "application/json" };
  }
  function apiUrl(path) { return globalThis.LocalLiftApi?.url?.(path) || path; }
  function apiErrorMessage(status, payload) {
    if (status === 401) return "El servidor requiere el token de desarrollador. Accede primero al centro DLS con tus credenciales.";
    if (status === 422) return payload.error || "Las coordenadas seleccionadas no son válidas.";
    return payload.error || `El servidor respondió con el estado ${status}.`;
  }
  function requestErrorMessage(error) {
    const message = clean(error?.message);
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      const endpoint = apiUrl("/api/zone-discovery/preview");
      const backend = (() => {
        try { return new URL(endpoint, window.location.href).origin; } catch { return "http://127.0.0.1:5173"; }
      })();
      return `No se pudo conectar con el backend DLS en ${backend}. Abre el laboratorio desde ese servidor o arráncalo con npm run start.`;
    }
    return message || "Comprueba la conexión con el servidor DLS.";
  }
  function radiusStyle() { return { radius: Number(refs.radius.value), color: "#5368e8", weight: 1, opacity: .6, fillColor: "#5368e8", fillOpacity: .06, interactive: false }; }
  function resultIcon(number, category) {
    return L.divIcon({
      className: "zplay-result-icon",
      html: `<span class="zplay-result-marker zplay-result-marker-${categoryGroup(category)}"><span>${number}</span></span>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      tooltipAnchor: [0, -24]
    });
  }
  function categorySymbol(category) { return ({ monumento: "M", naturaleza: "N", cultura: "C", mirador: "◇", plaza: "P", playa: "≈", parque: "♧" })[category] || "·"; }
  function categoryGroup(category) {
    const value = clean(category).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (/monument|historic|cultur|muse|igles|arquitect/.test(value)) return "monument";
    if (/natur|parque|playa|jardin|sender/.test(value)) return "nature";
    if (/mirador|plaza|viewpoint/.test(value)) return "viewpoint";
    return "other";
  }
  function categoryColor(category) {
    return ({ monument: "#a87c3d", nature: "#4a7a5e", viewpoint: "#3d6b87", other: "#687386" })[categoryGroup(category)] || "#687386";
  }
  function clean(value) { return String(value ?? "").trim(); }
  function escapeHtml(value) { return clean(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]); }
  function escapeAttr(value) { return escapeHtml(value); }
})();
