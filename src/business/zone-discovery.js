(function (global) {
  const mounted = new WeakMap();
  const ROUTE_PROFILES = new Set(["foot", "bike", "car"]);
  let activeModal = null;
  let previousOverflow = "";

  global.DlsZoneDiscovery = { mount };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoMount, { once: true });
  } else {
    queueMicrotask(autoMount);
  }

  async function mount(options = {}) {
    const container = options.container || document.querySelector(".generated-site") || document.body;
    const reference = clean(options.reference) || exportedBusinessReference();
    if (!container || !reference) return null;
    const previous = mounted.get(container);
    previous?.entry?.remove();
    previous?.modal?.remove();
    try {
      const payload = await getJson(`/api/public/${encodeURIComponent(reference)}/zone`);
      const zone = payload.zone || {};
      if (!zone.enabled || !zone.available || !Array.isArray(zone.recommendations) || zone.recommendations.length < 3) {
        mounted.set(container, { zone });
        return zone;
      }
      const entry = renderEntry(zone, options);
      const modal = renderModal(zone);
      const slot = container.querySelector("[data-zone-discovery-slot]");
      const footer = container.querySelector(".site-footer");
      if (slot) slot.replaceChildren(entry);
      else if (footer) footer.before(entry);
      else container.append(entry);
      document.body.append(modal);
      attachModal(entry, modal, zone);
      mounted.set(container, { zone, entry, modal });
      return zone;
    } catch {
      return null;
    }
  }

  function autoMount() {
    const reference = exportedBusinessReference();
    const container = document.querySelector(".generated-site");
    if (reference && container) mount({ container, reference });
  }

  function renderEntry(zone, options) {
    const section = document.createElement("section");
    section.className = "zone-discovery-entry";
    section.style.setProperty("--zone-accent", safeColor(options.accent || zone.host?.accent));
    section.setAttribute("aria-labelledby", "zoneEntryTitle");
    section.innerHTML = `
      <div class="zone-entry-atmosphere" aria-hidden="true"></div>
      <div class="zone-entry-inner">
        <p class="zone-entry-kicker">Una selección alrededor de ${escapeHtml(options.businessName || zone.host?.name || "este lugar")}</p>
        <h2 id="zoneEntryTitle">Descubre ${escapeHtml(zone.zone)}</h2>
        <p>Seis lugares elegidos para entender el barrio caminando, con contexto cultural y recomendaciones locales.</p>
        <button class="zone-entry-cta" type="button" data-zone-open>
          <span class="zone-compass" aria-hidden="true">⌖</span>
          <span>Explorar la zona</span>
        </button>
      </div>`;
    return section;
  }

  function renderModal(zone) {
    const modal = document.createElement("div");
    modal.className = "zone-discovery-modal";
    modal.hidden = true;
    modal.style.setProperty("--zone-accent", safeColor(zone.host?.accent));
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "zoneModalTitle");
    modal.innerHTML = `
      <div class="zone-modal-shell">
        <header class="zone-modal-header">
          <button class="zone-modal-close" type="button" data-zone-close aria-label="Cerrar Descubre ${escapeAttr(zone.zone)}">× <span>Cerrar</span></button>
          <div><p>Selección local documentada</p><h2 id="zoneModalTitle">Descubre ${escapeHtml(zone.zone)}</h2></div>
          <span class="zone-modal-count">${zone.recommendations.length} imprescindibles</span>
        </header>
        <div class="zone-modal-layout">
          <section class="zone-card-panel" aria-label="Recomendaciones de la zona">
            <div class="zone-route-workspace" data-route-workspace hidden>
              <div class="zone-route-workspace-head">
                <button type="button" class="zone-route-back" data-route-back>← Lugares</button>
                <p><span data-route-selected-count>0</span> paradas elegidas</p>
              </div>
              <div class="zone-route-notice" data-route-notice role="status" hidden></div>
              <fieldset class="zone-route-fieldset">
                <legend>Cómo te mueves</legend>
                <div class="zone-route-chips" data-route-profiles>
                  ${routeProfileButton("foot", "A pie")}
                  ${routeProfileButton("bike", "Bicicleta")}
                  ${routeProfileButton("car", "Coche")}
                </div>
              </fieldset>
              <fieldset class="zone-route-fieldset">
                <legend>Qué ruta prefieres</legend>
                <div class="zone-route-chips" data-route-modes>
                  <button type="button" class="zone-route-chip is-active" data-route-mode="fastest" aria-pressed="true">Más rápida</button>
                  <button type="button" class="zone-route-chip" data-route-mode="scenic" aria-pressed="false" title="Prioriza monumentos, miradores y naturaleza">Panorámica</button>
                </div>
              </fieldset>
              <div class="zone-route-start-row">
                <span data-route-start-label>Punto de partida pendiente</span>
                <button type="button" data-route-adjust-start>Ajustar en mapa</button>
              </div>
              <button type="button" class="zone-route-calculate" data-route-calculate disabled>Calcular ruta</button>
              <div class="zone-route-summary" data-route-summary hidden></div>
            </div>
            <div class="zone-card-list" data-zone-card-list>
              ${zone.recommendations.map(renderCard).join("")}
            </div>
            <div class="zone-route-launch" data-route-launch-bar hidden>
              <span><strong data-route-count>0</strong> de 6 paradas</span>
              <button type="button" data-route-launch>Planear ruta</button>
            </div>
          </section>
          <section class="zone-map-panel" aria-label="Mapa interactivo de ${escapeAttr(zone.zone)}">
            <div class="zone-map" data-zone-map></div>
            <p class="zone-map-fallback" data-zone-map-fallback hidden>El mapa no está disponible ahora mismo. Las recomendaciones siguen accesibles.</p>
            <div class="zone-manual-start" data-route-manual hidden>
              <p>Toca el mapa para marcar tu punto de partida.</p>
              <button type="button" data-route-confirm-start disabled>Confirmar punto de partida</button>
            </div>
          </section>
        </div>
        <div class="zone-location-consent" data-route-consent hidden>
          <div class="zone-location-consent-card" role="document">
            <span class="zone-location-icon" aria-hidden="true">${categorySvg("start")}</span>
            <p class="zone-location-eyebrow">Tu ubicación, solo durante esta sesión</p>
            <h3>¿Desde dónde empezamos?</h3>
            <p>La usamos para ordenar las paradas y dibujar el itinerario. No se guarda en DLS ni en Supabase.</p>
            <button type="button" class="zone-location-primary" data-route-use-location>Usar mi ubicación</button>
            <button type="button" class="zone-location-secondary" data-route-use-manual>Elegir punto en el mapa</button>
            <button type="button" class="zone-location-cancel" data-route-cancel>Ahora no</button>
          </div>
        </div>
      </div>`;
    return modal;
  }

  function routeProfileButton(profile, label) {
    return `<button type="button" class="zone-route-chip${profile === "foot" ? " is-active" : ""}" data-route-profile="${profile}" aria-pressed="${profile === "foot"}">
      <span aria-hidden="true">${transportSvg(profile)}</span>${label}
    </button>`;
  }

  function renderCard(item, index) {
    const image = item.imageUrl
      ? `<img src="${escapeAttr(item.imageUrl)}" alt="${escapeAttr(item.name)}" loading="lazy" decoding="async"><span class="zone-card-image-symbol zone-card-image-fallback" aria-hidden="true">${categorySvg(item.type === "business" ? "business" : item.category)}</span>`
      : `<span class="zone-card-image-symbol" aria-hidden="true">${categorySvg(item.type === "business" ? "business" : item.category)}</span>`;
    const longDescription = item.hasLongDescription && item.descriptionLong
      ? `<div class="zone-card-long" data-zone-card-long><p>${escapeHtml(item.descriptionLong)}</p></div>`
      : "";
    const attribution = item.attribution?.label
      ? `<a class="zone-card-attribution" href="${escapeAttr(item.attribution.url)}" target="_blank" rel="noreferrer" data-zone-attribution>${escapeHtml(item.attribution.label)}</a>`
      : "";
    return `
      <article class="zone-card" tabindex="0" aria-expanded="false" aria-label="Centrar ${escapeAttr(item.name)} en el mapa"
        data-zone-card data-card-id="${escapeAttr(item.id)}" style="--zone-card-delay:${index * 70}ms;--poi-color:${categoryColor(item.type === "business" ? "business" : item.category)}">
        <figure class="zone-card-image zone-card-image-${escapeAttr(item.category)}">
          ${image}
          <span class="zone-card-badge">${escapeHtml(item.badge)}</span>
          <span class="zone-card-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>
          <button class="zone-card-route-toggle" type="button" data-route-toggle aria-pressed="false" aria-label="Añadir ${escapeAttr(item.name)} a mi ruta"><span aria-hidden="true">+</span></button>
        </figure>
        <div class="zone-card-body">
          <div class="zone-card-heading">
            <div><p>${escapeHtml(item.category)}</p><h3>${escapeHtml(item.name)}</h3></div>
            <span class="zone-card-distance">a ${Number(item.walkingMinutes || 1)} min andando</span>
          </div>
          ${item.descriptionShort ? `<p class="zone-card-short">${escapeHtml(item.descriptionShort)}</p>` : ""}
          ${longDescription}
          <div class="zone-card-footer">
            ${attribution}
            <a class="zone-card-directions" href="${escapeAttr(item.directionsUrl)}" target="_blank" rel="noreferrer" data-zone-directions>Cómo llegar <span aria-hidden="true">↗</span></a>
          </div>
        </div>
      </article>`;
  }

  function attachModal(entry, modal, zone) {
    const open = entry.querySelector("[data-zone-open]");
    const close = modal.querySelector("[data-zone-close]");
    const routeState = {
      selectedIds: new Set(),
      start: null,
      manualDraft: null,
      profile: "foot",
      mode: "fastest",
      result: null,
      activeRouteId: "",
      requestSerial: 0
    };
    let mapState = null;
    let lastFocused = null;

    modal.querySelectorAll(".zone-card-image img").forEach((image) => {
      const reveal = () => image.parentElement?.classList.add("is-loaded");
      const fallback = () => image.parentElement?.classList.add("is-missing");
      if (image.complete) reveal();
      else image.addEventListener("load", reveal, { once: true });
      image.addEventListener("error", fallback, { once: true });
    });

    open.addEventListener("click", () => {
      lastFocused = document.activeElement;
      modal.hidden = false;
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      requestAnimationFrame(() => modal.classList.add("is-open"));
      close.focus();
      if (!mapState) {
        mapState = createMap(modal, zone);
      } else if (mapState) {
        setTimeout(() => mapState.map?.invalidateSize?.(), 320);
      }
      trackZoneEvent(zone, { eventType: "opened" });
      activeModal = { modal, close: closeModal };
    });
    close.addEventListener("click", closeModal);
    modal.addEventListener("mousedown", (event) => {
      if (event.target === modal) closeModal();
    });

    modal.querySelectorAll("[data-zone-card]").forEach((card) => {
      const item = zone.recommendations.find((candidate) => candidate.id === card.dataset.cardId);
      const select = () => {
        modal.querySelectorAll("[data-zone-card]").forEach((node) => node.classList.toggle("is-selected", node === card));
        if (item?.hasLongDescription) {
          const expanded = card.getAttribute("aria-expanded") !== "true";
          card.setAttribute("aria-expanded", String(expanded));
        }
        mapState?.focus?.(item);
        trackZoneEvent(zone, eventFor(item, "card_clicked"));
      };
      card.addEventListener("click", (event) => {
        if (event.target.closest("a, button")) return;
        select();
      });
      card.addEventListener("keydown", (event) => {
        if (["Enter", " "].includes(event.key) && !event.target.closest("a, button")) {
          event.preventDefault();
          select();
        }
      });
      card.querySelector("[data-zone-directions]")?.addEventListener("click", () => {
        trackZoneEvent(zone, eventFor(item, "directions_clicked"));
      });
      card.querySelector("[data-route-toggle]")?.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleRouteStop(card, item);
      });
    });

    modal.querySelector("[data-route-launch]")?.addEventListener("click", openLocationConsent);
    modal.querySelector("[data-route-use-location]")?.addEventListener("click", requestLocation);
    modal.querySelector("[data-route-use-manual]")?.addEventListener("click", beginManualStart);
    modal.querySelector("[data-route-cancel]")?.addEventListener("click", closeLocationConsent);
    modal.querySelector("[data-route-confirm-start]")?.addEventListener("click", confirmManualStart);
    modal.querySelector("[data-route-adjust-start]")?.addEventListener("click", beginManualStart);
    modal.querySelector("[data-route-back]")?.addEventListener("click", leaveRouteMode);
    modal.querySelector("[data-route-calculate]")?.addEventListener("click", calculateRoute);
    modal.querySelectorAll("[data-route-profile]").forEach((button) => button.addEventListener("click", () => setProfile(button.dataset.routeProfile)));
    modal.querySelectorAll("[data-route-mode]").forEach((button) => button.addEventListener("click", () => setMode(button.dataset.routeMode)));

    function toggleRouteStop(card, item) {
      if (!item) return;
      const toggle = card.querySelector("[data-route-toggle]");
      if (routeState.selectedIds.has(item.id)) routeState.selectedIds.delete(item.id);
      else if (routeState.selectedIds.size < 6) routeState.selectedIds.add(item.id);
      const selected = routeState.selectedIds.has(item.id);
      card.classList.toggle("is-route-selected", selected);
      toggle?.setAttribute("aria-pressed", String(selected));
      toggle?.setAttribute("aria-label", `${selected ? "Quitar" : "Añadir"} ${item.name} ${selected ? "de" : "a"} mi ruta`);
      if (toggle) toggle.querySelector("span").textContent = selected ? "✓" : "+";
      updateSelectionUi();
      if (routeState.result) clearCalculatedRoute("La selección cambió. Calcula de nuevo la ruta.");
    }

    function updateSelectionUi() {
      const count = routeState.selectedIds.size;
      modal.querySelectorAll("[data-route-count], [data-route-selected-count]").forEach((node) => { node.textContent = String(count); });
      modal.querySelector("[data-route-launch-bar]").hidden = count < 2;
      modal.querySelector("[data-route-calculate]").disabled = !routeState.start || count < 2;
    }

    function openLocationConsent() {
      if (routeState.selectedIds.size < 2) return;
      modal.querySelector("[data-route-consent]").hidden = false;
      modal.querySelector("[data-route-use-location]")?.focus();
    }

    function closeLocationConsent() {
      modal.querySelector("[data-route-consent]").hidden = true;
      modal.querySelector("[data-route-launch]")?.focus();
    }

    function requestLocation() {
      closeLocationConsent();
      enterRouteMode();
      setRouteNotice("Solicitando tu ubicación…", "info");
      if (!navigator.geolocation?.getCurrentPosition) {
        beginManualStart();
        return;
      }
      navigator.geolocation.getCurrentPosition((position) => {
        const point = { lat: position.coords.latitude, lng: position.coords.longitude };
        routeState.start = point;
        routeState.manualDraft = null;
        mapState?.setStart?.(point, position.coords.accuracy);
        applyDistanceProfile(point);
        updateStartUi(position.coords.accuracy);
        updateSelectionUi();
      }, () => {
        setRouteNotice("No pudimos acceder a tu ubicación. Elige el punto de partida en el mapa.", "warning");
        beginManualStart();
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    }

    function beginManualStart() {
      closeLocationConsent();
      enterRouteMode();
      routeState.manualDraft = null;
      modal.querySelector("[data-route-manual]").hidden = false;
      const confirm = modal.querySelector("[data-route-confirm-start]");
      confirm.disabled = true;
      setRouteNotice("Toca el mapa para marcar tu punto de partida. Después puedes arrastrar el marcador.", "info");
      if (!mapState?.enableManualStart) {
        setRouteNotice("El mapa no está disponible para elegir el punto manualmente.", "error");
        return;
      }
      mapState.enableManualStart((point) => {
        routeState.manualDraft = point;
        confirm.disabled = false;
      });
    }

    function confirmManualStart() {
      if (!routeState.manualDraft) return;
      if (routeState.result) clearCalculatedRoute("El punto de partida cambió. Calcula de nuevo la ruta.");
      routeState.start = { ...routeState.manualDraft };
      mapState?.setStart?.(routeState.start, 0);
      mapState?.confirmManualStart?.();
      modal.querySelector("[data-route-manual]").hidden = true;
      applyDistanceProfile(routeState.start);
      updateStartUi(0);
      updateSelectionUi();
    }

    function applyDistanceProfile(point) {
      const host = { lat: Number(zone.host?.latitude), lng: Number(zone.host?.longitude) };
      if (Number.isFinite(host.lat) && Number.isFinite(host.lng) && distanceMeters(point, host) > 20000) {
        setProfile("car", false);
        setRouteNotice("Estás a más de 20 km de la zona. Hemos preseleccionado coche.", "warning");
      }
    }

    function updateStartUi(accuracy) {
      const label = modal.querySelector("[data-route-start-label]");
      label.textContent = accuracy > 100 ? `Ubicación aproximada (±${Math.round(accuracy)} m)` : "Punto de partida listo";
      if (accuracy > 100) {
        setRouteNotice("La precisión es baja. Puedes ajustar el punto manualmente antes de calcular.", "warning");
      } else {
        clearRouteNotice();
      }
    }

    function enterRouteMode() {
      modal.classList.add("is-route-mode");
      modal.querySelector("[data-route-workspace]").hidden = false;
      setTimeout(() => mapState?.map?.invalidateSize?.(), 0);
    }

    function leaveRouteMode() {
      modal.classList.remove("is-route-mode");
      modal.querySelector("[data-route-workspace]").hidden = true;
      modal.querySelector("[data-route-manual]").hidden = true;
      mapState?.disableManualStart?.();
      setTimeout(() => mapState?.map?.invalidateSize?.(), 0);
    }

    function setProfile(profile, recalculate = true) {
      if (!ROUTE_PROFILES.has(profile)) return;
      routeState.profile = profile;
      modal.querySelectorAll("[data-route-profile]").forEach((button) => {
        const active = button.dataset.routeProfile === profile;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      const scenic = modal.querySelector('[data-route-mode="scenic"]');
      scenic.disabled = profile === "car";
      scenic.title = profile === "car" ? "No disponible en coche" : "Prioriza monumentos, miradores y naturaleza";
      if (profile === "car" && routeState.mode === "scenic") setMode("fastest", false);
      if (recalculate && routeState.result) calculateRoute();
    }

    function setMode(mode, recalculate = true) {
      if (!["fastest", "scenic"].includes(mode) || (mode === "scenic" && routeState.profile === "car")) return;
      routeState.mode = mode;
      modal.querySelectorAll("[data-route-mode]").forEach((button) => {
        const active = button.dataset.routeMode === mode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-pressed", String(active));
      });
      if (recalculate && routeState.result) calculateRoute();
    }

    async function calculateRoute() {
      if (!routeState.start || routeState.selectedIds.size < 2) return;
      const selected = selectedStops(zone, routeState.selectedIds);
      const scenicCandidates = zone.recommendations
        .filter((item) => !routeState.selectedIds.has(item.id))
        .map(routeStopPayload);
      const requestSerial = ++routeState.requestSerial;
      const calculate = modal.querySelector("[data-route-calculate]");
      calculate.disabled = true;
      calculate.textContent = "Calculando…";
      setRouteNotice("Optimizando el orden y trazando la ruta real…", "info");
      try {
        const payload = await postJson("/api/zone/route", {
          start: routeState.start,
          stops: selected.map(routeStopPayload),
          scenicCandidates,
          profile: routeState.profile,
          mode: routeState.mode
        });
        if (requestSerial !== routeState.requestSerial) return;
        routeState.result = payload.route;
        routeState.activeRouteId = payload.route.id;
        renderRouteSummary(payload.route);
        mapState?.drawRoute?.(payload.route, routeState.activeRouteId, safeColor(zone.host?.accent), promoteAlternative);
        if (payload.route.approximate || payload.route.warning) setRouteNotice(payload.route.warning, "warning");
        else if (payload.route.scenicStops?.length) setRouteNotice(`Ruta panorámica con ${payload.route.scenicStops.length} punto${payload.route.scenicStops.length === 1 ? "" : "s"} de interés de paso.`, "success");
        else clearRouteNotice();
      } catch (error) {
        if (requestSerial !== routeState.requestSerial) return;
        routeState.result = null;
        mapState?.clearRoute?.();
        renderRouteError(error.payload || {});
      } finally {
        if (requestSerial === routeState.requestSerial) {
          calculate.disabled = !routeState.start || routeState.selectedIds.size < 2;
          calculate.textContent = "Recalcular ruta";
        }
      }
    }

    function promoteAlternative(routeId) {
      if (!routeState.result) return;
      routeState.activeRouteId = routeId;
      const active = activeRoute(routeState.result, routeId);
      renderRouteSummary(routeState.result, active);
      mapState?.drawRoute?.(routeState.result, routeId, safeColor(zone.host?.accent), promoteAlternative);
    }

    function renderRouteSummary(result, selectedRoute = result) {
      const summary = modal.querySelector("[data-route-summary]");
      const route = selectedRoute || result;
      const googleUrl = googleMapsRouteUrl(routeState.start, route.stops, routeState.profile);
      const appleUrl = appleMapsRouteUrl(routeState.start, route.stops.at(-1), routeState.profile);
      summary.hidden = false;
      summary.innerHTML = `
        <div class="zone-route-totals">
          <div><strong>${formatDistance(route.distanceMeters)}</strong><span>distancia</span></div>
          <div><strong>${formatDuration(route.durationSeconds)}</strong><span>tiempo estimado</span></div>
        </div>
        ${result.alternatives?.length ? `<p class="zone-route-alternative-note">Toca una línea gris del mapa para elegir una alternativa.</p>` : ""}
        <ol class="zone-route-stop-list">
          ${route.stops.map((stop, index) => {
            const iconCategory = categoryGroup(stop.type === "business" ? "business" : stop.category);
            return `<li><span class="zone-route-stop-icon zone-route-stop-icon-${iconCategory}" aria-hidden="true">${categorySvg(iconCategory)}</span><div><strong>${index + 1}. ${escapeHtml(stop.name)}</strong><span>${formatDuration(stop.durationFromStartSeconds)} hasta aquí</span></div></li>`;
          }).join("")}
        </ol>
        <div class="zone-route-export">
          <a href="${escapeAttr(googleUrl)}" target="_blank" rel="noreferrer">Abrir en Google Maps ↗</a>
          <a href="${escapeAttr(appleUrl)}" target="_blank" rel="noreferrer">Abrir destino en Apple Maps ↗</a>
        </div>`;
    }

    function renderRouteError(payload) {
      const summary = modal.querySelector("[data-route-summary]");
      const unreachable = Array.isArray(payload.unreachableStops) ? payload.unreachableStops : [];
      summary.hidden = false;
      summary.innerHTML = `
        <div class="zone-route-error">
          <strong>No hemos podido completar esta ruta.</strong>
          ${unreachable.length ? `<ul>${unreachable.map((stop) => `<li>No se pudo calcular ruta ${profileLabel(routeState.profile).toLowerCase()} hasta ${escapeHtml(stop.name)}. <button type="button" data-route-exclude="${escapeAttr(stop.id)}">Excluir y recalcular</button></li>`).join("")}</ul>` : `<p>${escapeHtml(payload.error || "Prueba con otro perfil de transporte.")}</p>`}
        </div>`;
      summary.querySelectorAll("[data-route-exclude]").forEach((button) => button.addEventListener("click", () => {
        const id = button.dataset.routeExclude;
        routeState.selectedIds.delete(id);
        const card = [...modal.querySelectorAll("[data-zone-card]")].find((node) => node.dataset.cardId === id);
        card?.classList.remove("is-route-selected");
        const toggle = card?.querySelector("[data-route-toggle]");
        toggle?.setAttribute("aria-pressed", "false");
        if (toggle) toggle.querySelector("span").textContent = "+";
        updateSelectionUi();
        if (routeState.selectedIds.size >= 2) calculateRoute();
        else setRouteNotice("Elige al menos dos paradas para volver a calcular.", "warning");
      }));
      setRouteNotice(payload.error || "Prueba con otro perfil o excluye la parada sin conexión.", "error");
    }

    function clearCalculatedRoute(message) {
      routeState.result = null;
      routeState.activeRouteId = "";
      routeState.requestSerial += 1;
      modal.querySelector("[data-route-summary]").hidden = true;
      mapState?.clearRoute?.();
      if (message) setRouteNotice(message, "info");
    }

    function setRouteNotice(message, type) {
      const notice = modal.querySelector("[data-route-notice]");
      notice.hidden = false;
      notice.className = `zone-route-notice is-${type}`;
      notice.textContent = message;
    }

    function clearRouteNotice() {
      const notice = modal.querySelector("[data-route-notice]");
      notice.hidden = true;
      notice.textContent = "";
    }

    function closeModal() {
      modal.classList.remove("is-open");
      modal.querySelector("[data-route-consent]").hidden = true;
      mapState?.disableManualStart?.();
      setTimeout(() => { modal.hidden = true; }, 300);
      document.body.style.overflow = previousOverflow;
      lastFocused?.focus?.();
      if (activeModal?.modal === modal) activeModal = null;
    }
  }

  function createMap(modal, zone) {
    const mapNode = modal.querySelector("[data-zone-map]");
    const fallback = modal.querySelector("[data-zone-map-fallback]");
    if (!global.L || !Number.isFinite(Number(zone.host?.latitude)) || !Number.isFinite(Number(zone.host?.longitude))) {
      fallback.hidden = false;
      return { map: null, focus() {}, clearRoute() {} };
    }
    const map = global.L.map(mapNode, {
      zoomControl: true,
      scrollWheelZoom: true,
      preferCanvas: false,
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false
    });
    global.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      subdomains: "abcd",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    const markers = new Map();
    const points = [];
    const hostPoint = [Number(zone.host.latitude), Number(zone.host.longitude)];
    let startMarker = null;
    let accuracyCircle = null;
    let manualHandler = null;
    let manualCallback = null;
    let routeLayers = [];

    global.L.marker(hostPoint, { icon: markerIcon("host"), zIndexOffset: 1000 })
      .addTo(map)
      .bindTooltip(escapeHtml(zone.host.name), { direction: "top", offset: [0, -17] });
    points.push(hostPoint);
    zone.recommendations.forEach((item, index) => {
      const point = [Number(item.latitude), Number(item.longitude)];
      if (!point.every(Number.isFinite)) return;
      const marker = global.L.marker(point, { icon: markerIcon(item.type === "business" ? "business" : item.category, index + 1) })
        .addTo(map)
        .bindTooltip(escapeHtml(item.name), { direction: "top", offset: [0, -17] });
      markers.set(item.id, marker);
      points.push(point);
    });
    const bounds = global.L.latLngBounds(points).pad(0.16);
    map.setView(hostPoint, 15, { animate: false });
    const fitVisibleMap = () => {
      map.invalidateSize({ animate: false });
      map.fitBounds(bounds, { maxZoom: 16, animate: false });
    };
    requestAnimationFrame(() => requestAnimationFrame(fitVisibleMap));
    setTimeout(fitVisibleMap, 350);

    function setStart(point, accuracy = 0, draggable = false) {
      const latLng = [Number(point.lat), Number(point.lng)];
      if (!startMarker) {
        startMarker = global.L.marker(latLng, { icon: markerIcon("start"), draggable, zIndexOffset: 1500 }).addTo(map);
      } else {
        startMarker.setLatLng(latLng);
        if (draggable) startMarker.dragging?.enable?.();
        else startMarker.dragging?.disable?.();
      }
      accuracyCircle?.remove?.();
      accuracyCircle = null;
      if (Number(accuracy) > 100) {
        accuracyCircle = global.L.circle(latLng, {
          radius: Number(accuracy), color: "#2b2b2b", fillColor: "#2b2b2b", fillOpacity: 0.1, weight: 1
        }).addTo(map);
      }
      return startMarker;
    }

    function disableManualStart() {
      if (manualHandler) map.off("click", manualHandler);
      if (startMarker && manualCallback) startMarker.off("dragend", manualCallback);
      manualHandler = null;
      manualCallback = null;
      mapNode.classList.remove("is-placing-start");
    }

    function enableManualStart(callback) {
      disableManualStart();
      mapNode.classList.add("is-placing-start");
      const notify = () => {
        const point = startMarker.getLatLng();
        callback({ lat: Number(point.lat.toFixed(6)), lng: Number(point.lng.toFixed(6)) });
      };
      manualHandler = (event) => {
        setStart({ lat: event.latlng.lat, lng: event.latlng.lng }, 0, true);
        startMarker.off("dragend");
        startMarker.on("dragend", notify);
        manualCallback = notify;
        notify();
      };
      map.on("click", manualHandler);
      if (startMarker) {
        startMarker.dragging?.enable?.();
        startMarker.off("dragend");
        startMarker.on("dragend", notify);
        manualCallback = notify;
        notify();
      }
    }

    function clearRoute() {
      routeLayers.forEach((layer) => layer.remove?.());
      routeLayers = [];
    }

    function drawRoute(result, activeId, accent, onAlternative) {
      clearRoute();
      const routes = [result, ...(Array.isArray(result.alternatives) ? result.alternatives : [])];
      routes
        .filter((route) => route.id !== activeId)
        .forEach((route) => addRouteLine(route, false, accent, onAlternative));
      const active = routes.find((route) => route.id === activeId) || result;
      addRouteLine(active, true, accent, onAlternative);
      addDirectionArrows(active.geometry, accent);
      const routePoints = geometryLatLngs(active.geometry);
      if (startMarker) routePoints.push(startMarker.getLatLng());
      if (routePoints.length) map.fitBounds(global.L.latLngBounds(routePoints).pad(0.12), { maxZoom: 17, animate: false });
    }

    function addRouteLine(route, active, accent, onAlternative) {
      const latLngs = geometryLatLngs(route.geometry);
      if (latLngs.length < 2) return;
      const line = global.L.polyline(latLngs, {
        color: active ? accent : "#b0b0b0",
        weight: active ? 5 : 3,
        opacity: active ? 0.96 : 0.85,
        dashArray: active ? "14 12" : null,
        className: active ? "zone-route-line zone-route-line-active" : "zone-route-line zone-route-line-alternative",
        interactive: !active
      }).addTo(map);
      if (!active) {
        line.on("click", () => onAlternative?.(route.id));
        line.bindTooltip(`${formatDistance(route.distanceMeters)} · ${formatDuration(route.durationSeconds)} — elegir alternativa`, { sticky: true });
      }
      routeLayers.push(line);
    }

    function addDirectionArrows(geometry, color) {
      sampleRouteArrows(geometry, 150).forEach((arrow) => {
        const icon = global.L.divIcon({
          className: "zone-route-arrow-icon",
          html: `<span class="zone-route-arrow" style="--route-arrow-angle:${arrow.bearing}deg;--route-arrow-color:${escapeAttr(color)}"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M1 10 6 1l5 9-5-2Z"/></svg></span>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });
        routeLayers.push(global.L.marker([arrow.lat, arrow.lng], { icon, interactive: false, keyboard: false }).addTo(map));
      });
    }

    return {
      map,
      focus(item) {
        if (!item) return;
        const marker = markers.get(item.id);
        if (!marker) return;
        modal.querySelectorAll(".zone-map-marker").forEach((node) => node.classList.remove("is-highlighted"));
        marker.getElement()?.querySelector(".zone-map-marker")?.classList.add("is-highlighted");
        map.flyTo([Number(item.latitude), Number(item.longitude)], 17, { duration: 0.8 });
        marker.openTooltip();
      },
      setStart,
      enableManualStart,
      disableManualStart,
      confirmManualStart() {
        disableManualStart();
        startMarker?.dragging?.disable?.();
      },
      drawRoute,
      clearRoute
    };
  }

  function markerIcon(type, index = 0) {
    const normalized = categoryGroup(type);
    return global.L.divIcon({
      className: "zone-map-icon",
      html: `<span class="zone-map-marker zone-map-marker-${normalized}"><span class="zone-map-marker-glyph">${categorySvg(normalized)}</span>${index ? `<b>${index}</b>` : ""}</span>`,
      iconSize: normalized === "start" ? [32, 32] : [46, 46],
      iconAnchor: normalized === "start" ? [16, 16] : [23, 23],
      tooltipAnchor: normalized === "start" ? [0, -18] : [0, -25]
    });
  }

  function selectedStops(zone, selectedIds) {
    return zone.recommendations.filter((item) => selectedIds.has(item.id));
  }

  function routeStopPayload(item) {
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      type: item.type,
      lat: Number(item.latitude ?? item.lat),
      lng: Number(item.longitude ?? item.lng)
    };
  }

  function activeRoute(result, routeId) {
    return [result, ...(result.alternatives || [])].find((route) => route.id === routeId) || result;
  }

  function geometryLatLngs(geometry) {
    return (Array.isArray(geometry?.coordinates) ? geometry.coordinates : [])
      .map((coordinate) => [Number(coordinate[1]), Number(coordinate[0])])
      .filter((coordinate) => coordinate.every(Number.isFinite));
  }

  function sampleRouteArrows(geometry, intervalMeters) {
    const points = geometryLatLngs(geometry);
    if (points.length < 2) return [];
    const samples = [];
    let remaining = intervalMeters;
    for (let index = 1; index < points.length && samples.length < 80; index += 1) {
      const from = { lat: points[index - 1][0], lng: points[index - 1][1] };
      const to = { lat: points[index][0], lng: points[index][1] };
      const segment = distanceMeters(from, to);
      if (!segment) continue;
      while (segment >= remaining && samples.length < 80) {
        const ratio = remaining / segment;
        samples.push({
          lat: from.lat + (to.lat - from.lat) * ratio,
          lng: from.lng + (to.lng - from.lng) * ratio,
          bearing: bearingDegrees(from, to)
        });
        remaining += intervalMeters;
      }
      remaining -= segment;
      if (remaining <= 0) remaining = intervalMeters;
    }
    return samples;
  }

  function googleMapsRouteUrl(start, stops, profile) {
    const ordered = Array.isArray(stops) ? stops : [];
    const destination = ordered.at(-1) || start;
    const params = new URLSearchParams({
      api: "1",
      origin: `${start.lat},${start.lng}`,
      destination: `${destination.lat},${destination.lng}`,
      travelmode: { foot: "walking", bike: "bicycling", car: "driving" }[profile] || "walking"
    });
    if (ordered.length > 1) params.set("waypoints", ordered.slice(0, -1).map((stop) => `${stop.lat},${stop.lng}`).join("|"));
    return `https://www.google.com/maps/dir/?${params}`;
  }

  function appleMapsRouteUrl(start, destination, profile) {
    const target = destination || start;
    const params = new URLSearchParams({
      saddr: `${start.lat},${start.lng}`,
      daddr: `${target.lat},${target.lng}`,
      dirflg: { foot: "w", bike: "w", car: "d" }[profile] || "w"
    });
    return `https://maps.apple.com/?${params}`;
  }

  function categorySvg(category) {
    const group = categoryGroup(category);
    const paths = {
      gastronomy: '<path d="M6 3v7M9 3v7M6 7h3M7.5 10v11M16 3v18M16 3c3 2 3 7 0 9"/>',
      monument: '<path d="m4 8 8-5 8 5M5 9h14M7 10v7M12 10v7M17 10v7M4 18h16M3 21h18"/>',
      nature: '<path d="M20 4C10 4 5 9 5 15c0 3 2 5 5 5 6 0 10-6 10-16ZM4 21c3-5 7-8 13-12"/>',
      viewpoint: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
      business: '<path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z"/><path d="M9 8h3a4 4 0 0 1 0 8H9V8Zm0 4h3"/>',
      host: '<path d="m12 3 7 4v10l-7 4-7-4V7l7-4Z"/><circle cx="12" cy="12" r="3"/>',
      start: '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="3" fill="#fff" stroke="none"/>',
      other: '<circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[group] || paths.other}</svg>`;
  }

  function transportSvg(profile) {
    const paths = {
      foot: '<circle cx="13" cy="4" r="2"/><path d="m10 21 2-7-3-3 2-4 4 3 3 1M15 21l-2-7"/>',
      bike: '<circle cx="6" cy="17" r="4"/><circle cx="18" cy="17" r="4"/><path d="m6 17 4-8 4 8m-8 0h8l4-8h-5M9 6h4"/>',
      car: '<path d="m4 16-1-3 2-5h14l2 5-1 3H4Z"/><path d="M6 8l2-4h8l2 4M6 16v3M18 16v3"/><circle cx="7" cy="13" r="1" fill="currentColor"/><circle cx="17" cy="13" r="1" fill="currentColor"/>'
    };
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[profile]}</svg>`;
  }

  function categoryGroup(value) {
    const category = clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (["start", "host", "business"].includes(category)) return category;
    if (/restaur|gastr|bar|caf|comida|food/.test(category)) return "gastronomy";
    if (/monument|historic|cultur|muse|igles|arquitect/.test(category)) return "monument";
    if (/natur|parque|playa|jardin|sender/.test(category)) return "nature";
    if (/mirador|plaza|viewpoint/.test(category)) return "viewpoint";
    return "other";
  }

  function categoryColor(value) {
    return ({
      gastronomy: "#e07a3f",
      monument: "#a87c3d",
      nature: "#4a7a5e",
      viewpoint: "#3d6b87",
      business: "var(--zone-accent, #5265d8)",
      host: "#151b25",
      start: "#151b25",
      other: "#687386"
    })[categoryGroup(value)] || "#687386";
  }

  async function getJson(path) {
    const response = await fetch(apiUrl(path), { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!response.ok) throw new Error(`Zone request failed: ${response.status}`);
    return response.json();
  }

  async function postJson(path, body) {
    const response = await fetch(apiUrl(path), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    let payload = {};
    try { payload = await response.json(); } catch { payload = {}; }
    if (!response.ok) {
      const error = new Error(payload.error || `Zone route request failed: ${response.status}`);
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  function trackZoneEvent(zone, payload) {
    if (!payload?.eventType) return;
    fetch(apiUrl(`/api/public/${encodeURIComponent(zone.host.id)}/zone/events`), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    }).catch(() => {});
  }

  function eventFor(item, eventType) {
    return item?.type === "business"
      ? { eventType, targetBusinessId: item.targetBusinessId }
      : { eventType, targetPoiId: item?.targetPoiId };
  }

  function exportedBusinessReference() {
    try {
      const payload = JSON.parse(document.querySelector("#locallift-export-data")?.textContent || "{}");
      return clean(payload.business?.slug || payload.business?.id);
    } catch { return ""; }
  }

  function apiUrl(path) {
    if (!path || /^[a-z][a-z0-9+.-]*:\/\//i.test(path)) return path;
    const fromShared = global.LocalLiftApi?.url?.(path);
    if (fromShared && fromShared !== path) return fromShared;
    const metaBase = clean(document.querySelector('meta[name="locallift-api-base"]')?.content);
    const base = metaBase || clean(global.LOCALLIFT_API_BASE) || clean(localStorage.getItem("locallift_api_base"));
    return base ? `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}` : path;
  }

  function distanceMeters(left, right) {
    const lat1 = toRadians(Number(left.lat));
    const lat2 = toRadians(Number(right.lat));
    const deltaLat = toRadians(Number(right.lat) - Number(left.lat));
    const deltaLng = toRadians(Number(right.lng) - Number(left.lng));
    const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  }

  function bearingDegrees(from, to) {
    const lat1 = toRadians(from.lat);
    const lat2 = toRadians(to.lat);
    const deltaLng = toRadians(to.lng - from.lng);
    const y = Math.sin(deltaLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  function formatDistance(meters) {
    const value = Number(meters || 0);
    return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace(".", ",")} km` : `${Math.round(value)} m`;
  }

  function formatDuration(seconds) {
    const minutes = Math.max(1, Math.round(Number(seconds || 0) / 60));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
  }

  function profileLabel(profile) { return ({ foot: "A pie", bike: "En bicicleta", car: "En coche" })[profile] || ""; }
  function safeColor(value) { const color = clean(value); return /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color) ? color : "#9b6238"; }
  function clean(value) { return String(value ?? "").trim(); }
  function escapeHtml(value) { return clean(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]); }
  function escapeAttr(value) { return escapeHtml(value); }
  function toRadians(value) { return Number(value) * Math.PI / 180; }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeModal) activeModal.close();
  });
})(globalThis);
