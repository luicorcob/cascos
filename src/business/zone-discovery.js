(function (global) {
  const mounted = new WeakMap();
  const ROUTE_PROFILES = new Set(["foot", "bike", "car"]);
  const ITINERARY_COLORS = ["#5368e8", "#ef7d52", "#1c9d86", "#8d5bd1", "#d09a32", "#e0527e"];
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
    const signals = zoneFeatureSignals(zone);
    const localMix = naturalList(signals.map((signal) => shortCategoryLabel(signal.group).toLowerCase()));
    section.className = "zone-discovery-entry";
    section.style.setProperty("--zone-accent", safeColor(options.accent || zone.host?.accent));
    section.setAttribute("aria-labelledby", "zoneEntryTitle");
    section.innerHTML = `
      <div class="zone-entry-atmosphere" aria-hidden="true"></div>
      <div class="zone-entry-inner">
        <p class="zone-entry-kicker">Una guía local desde ${escapeHtml(options.businessName || zone.host?.name || "este lugar")}</p>
        <h2 id="zoneEntryTitle">Lo mejor de ${escapeHtml(zone.zone)}, a un paseo.</h2>
        <p>${escapeHtml(capitalize(localMix || "Lugares con historia"))}, contrastados en fuentes abiertas y ordenados para descubrirlos caminando.</p>
        <div class="zone-entry-signals" aria-label="Qué encontrarás en la zona">
          ${signals.map((signal) => `<span><i aria-hidden="true">${categorySvg(signal.group)}</i>${escapeHtml(signal.label)}</span>`).join("")}
        </div>
        <div class="zone-entry-proof" aria-label="Resumen de la guía">
          <span><strong>${zone.recommendations.length}</strong> lugares</span>
          <span><strong>${signals.length}</strong> tipos de plan</span>
          <span><strong>4</strong> fuentes abiertas</span>
        </div>
        <button class="zone-entry-cta" type="button" data-zone-open>
          <span class="zone-compass" aria-hidden="true">${compassSvg()}</span>
          <span>Abrir el mapa vivo</span>
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
          <div><p><span class="zone-source-pulse" aria-hidden="true"></span>OpenStreetMap · Wikidata · Wikipedia</p><h2 id="zoneModalTitle">Descubre ${escapeHtml(zone.zone)}</h2></div>
          <span class="zone-modal-count">${zone.recommendations.length} lugares · ${escapeHtml(formatRadius(zone.settings?.radiusMeters))}</span>
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
              <div class="zone-route-start-row">
                <span data-route-start-label>Punto de partida pendiente</span>
                <button type="button" data-route-adjust-start>Ajustar en mapa</button>
              </div>
              <button type="button" class="zone-route-calculate" data-route-calculate disabled>Crear recorrido visual</button>
              <div class="zone-route-summary" data-route-summary hidden></div>
            </div>
            <div class="zone-card-list" data-zone-card-list>
              ${zone.recommendations.map(renderCard).join("")}
            </div>
            <div class="zone-route-launch" data-route-launch-bar hidden>
              <span><strong data-route-count>0</strong> de 6 paradas</span>
              <button type="button" data-route-launch>Crear recorrido</button>
            </div>
          </section>
          <section class="zone-map-panel" aria-label="Mapa interactivo de ${escapeAttr(zone.zone)}">
            <div class="zone-map" data-zone-map></div>
            <div class="zone-map-context">
              <span><i aria-hidden="true"></i> Guía local verificada</span>
              <strong>${escapeHtml(formatRadius(zone.settings?.radiusMeters))} alrededor de ti</strong>
            </div>
            <div class="zone-map-legend" aria-label="Leyenda del mapa">
              ${renderMapLegend(zone)}
            </div>
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
            <p>La usamos para ordenar las paradas y crear una vista orientativa. No se guarda en DLS ni en Supabase.</p>
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
            <div><p>${escapeHtml(categoryLabel(item.type === "business" ? "business" : item.category))}</p><h3>${escapeHtml(item.name)}</h3></div>
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
      card.addEventListener("mouseenter", () => mapState?.preview?.(item));
      card.addEventListener("mouseleave", () => {
        if (!card.classList.contains("is-selected")) mapState?.clearHighlight?.();
      });
      card.addEventListener("focusin", () => mapState?.preview?.(item));
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
      if (recalculate && routeState.result) calculateRoute();
    }

    async function calculateRoute() {
      if (!routeState.start || routeState.selectedIds.size < 2) return;
      const selected = selectedStops(zone, routeState.selectedIds);
      const requestSerial = ++routeState.requestSerial;
      const calculate = modal.querySelector("[data-route-calculate]");
      calculate.disabled = true;
      calculate.textContent = "Preparando…";
      setRouteNotice("Ordenando las paradas y dando vida al recorrido…", "info");
      try {
        const payload = await postJson("/api/zone/route", {
          start: routeState.start,
          stops: selected.map(routeStopPayload),
          profile: routeState.profile,
          mode: "fastest",
          visualOnly: true
        });
        if (requestSerial !== routeState.requestSerial) return;
        routeState.result = payload.route;
        routeState.activeRouteId = payload.route.id;
        renderRouteSummary(payload.route);
        mapState?.drawRoute?.(payload.route, routeState.start, safeColor(zone.host?.accent));
        setRouteNotice(payload.route.warning || "Vista orientativa creada. Abre Google Maps para seguir el recorrido real.", "info");
      } catch (error) {
        if (requestSerial !== routeState.requestSerial) return;
        routeState.result = null;
        mapState?.clearRoute?.();
        renderRouteError(error.payload || {});
      } finally {
        if (requestSerial === routeState.requestSerial) {
          calculate.disabled = !routeState.start || routeState.selectedIds.size < 2;
          calculate.textContent = "Volver a animar";
        }
      }
    }

    function renderRouteSummary(result) {
      const summary = modal.querySelector("[data-route-summary]");
      const route = result;
      const googleUrl = googleMapsRouteUrl(routeState.start, route.stops, routeState.profile);
      const appleUrl = appleMapsRouteUrl(routeState.start, route.stops.at(-1), routeState.profile);
      summary.hidden = false;
      summary.innerHTML = `
        <div class="zone-route-visual-intro">
          <span>Vista orientativa · ${escapeHtml(profileLabel(routeState.profile))}</span>
          <strong>${route.stops.length} paradas, un plan de un vistazo</strong>
          <p>Los arcos de colores muestran el orden, no las calles. Consulta el recorrido real antes de salir.</p>
        </div>
        <ol class="zone-route-stop-list">
          ${route.stops.map((stop, index) => {
            const iconCategory = categoryGroup(stop.type === "business" ? "business" : stop.category);
            const color = itineraryColor(index, safeColor(zone.host?.accent));
            return `<li style="--route-segment-color:${color}"><span class="zone-route-stop-icon zone-route-stop-icon-${iconCategory}" aria-hidden="true">${categorySvg(iconCategory)}</span><div><strong>${escapeHtml(stop.name)}</strong><span>Tramo ${waypointLetter(index)} → ${waypointLetter(index + 1)}</span></div></li>`;
          }).join("")}
        </ol>
        <div class="zone-route-export">
          <a class="zone-route-export-primary" href="${escapeAttr(googleUrl)}" target="_blank" rel="noreferrer">Ver recorrido real en Google Maps ↗</a>
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
    const labelPane = map.createPane?.("zoneLabels");
    if (labelPane) {
      labelPane.style.zIndex = "450";
      labelPane.style.pointerEvents = "none";
    }
    global.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      subdomains: "abcd",
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);
    global.L.tileLayer("https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png", {
      maxZoom: 20,
      subdomains: "abcd",
      pane: labelPane ? "zoneLabels" : "tilePane"
    }).addTo(map);
    const markers = new Map();
    const points = [];
    const hostPoint = [Number(zone.host.latitude), Number(zone.host.longitude)];
    let startMarker = null;
    let accuracyCircle = null;
    let manualHandler = null;
    let manualCallback = null;
    let itineraryOverlay = null;
    let itineraryPoints = [];
    let itineraryAccent = safeColor(zone.host?.accent);

    global.L.circle(hostPoint, {
      radius: Math.min(2200, Math.max(350, Number(zone.settings?.radiusMeters || 1500))),
      color: safeColor(zone.host?.accent),
      fillColor: safeColor(zone.host?.accent),
      fillOpacity: 0.035,
      opacity: 0.28,
      weight: 1,
      dashArray: "5 10",
      interactive: false,
      className: "zone-map-discovery-radius"
    }).addTo(map);

    global.L.marker(hostPoint, {
      icon: hostMarkerIcon(zone.host),
      zIndexOffset: 1000,
      riseOnHover: true,
      title: `${zone.host.name}, estás aquí`,
      alt: `${zone.host.name}, estás aquí`
    })
      .addTo(map)
      .bindTooltip(`Estás aquí · ${escapeHtml(zone.host.name)}`, { direction: "top", offset: [0, -30] });
    points.push(hostPoint);
    zone.recommendations.forEach((item, index) => {
      const point = [Number(item.latitude), Number(item.longitude)];
      if (!point.every(Number.isFinite)) return;
      const marker = global.L.marker(point, {
        icon: markerIcon(item.type === "business" ? "business" : item.category, index + 1),
        riseOnHover: true,
        title: `${index + 1}. ${item.name}`,
        alt: `${index + 1}. ${item.name}`
      })
        .addTo(map)
        .bindTooltip(escapeHtml(item.name), { direction: "top", offset: [0, -17] });
      marker.on("click", () => selectCardFromMap(item));
      marker.on("mouseover", () => highlightMarker(marker));
      marker.on("mouseout", () => {
        const card = modal.querySelector(`[data-card-id="${cssEscape(item.id)}"]`);
        if (!card?.classList.contains("is-selected")) clearHighlight();
      });
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
      itineraryPoints = [];
      if (itineraryOverlay) itineraryOverlay.replaceChildren();
    }

    function drawRoute(result, start, accent) {
      clearRoute();
      itineraryAccent = safeColor(accent);
      itineraryPoints = [start, ...(Array.isArray(result?.stops) ? result.stops : [])]
        .map((point) => ({ lat: Number(point?.lat), lng: Number(point?.lng) }))
        .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
      if (itineraryPoints.length < 2) return;
      map.fitBounds(global.L.latLngBounds(itineraryPoints.map((point) => [point.lat, point.lng])).pad(0.18), { maxZoom: 16, animate: false });
      requestAnimationFrame(syncItineraryOverlay);
    }

    function ensureItineraryOverlay() {
      if (itineraryOverlay) return itineraryOverlay;
      itineraryOverlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      itineraryOverlay.classList.add("zone-itinerary-overlay");
      itineraryOverlay.setAttribute("aria-hidden", "true");
      mapNode.append(itineraryOverlay);
      return itineraryOverlay;
    }

    function syncItineraryOverlay() {
      if (itineraryPoints.length < 2 || typeof map.latLngToContainerPoint !== "function") return;
      const overlay = ensureItineraryOverlay();
      const size = typeof map.getSize === "function" ? map.getSize() : { x: mapNode.clientWidth, y: mapNode.clientHeight };
      const width = Math.max(1, Number(size?.x || mapNode.clientWidth || 1));
      const height = Math.max(1, Number(size?.y || mapNode.clientHeight || 1));
      overlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
      overlay.setAttribute("width", String(width));
      overlay.setAttribute("height", String(height));
      const segments = itineraryPoints.slice(1).map((point, index) => {
        const from = map.latLngToContainerPoint(itineraryPoints[index]);
        const to = map.latLngToContainerPoint(point);
        return itineraryArcMarkup(from, to, index, itineraryAccent);
      }).join("");
      overlay.innerHTML = `<g class="zone-itinerary-arcs">${segments}</g>`;
    }

    ["move", "zoom", "resize"].forEach((eventName) => map.on(eventName, syncItineraryOverlay));

    function clearHighlight() {
      modal.querySelectorAll(".zone-map-marker").forEach((node) => node.classList.remove("is-highlighted"));
    }

    function highlightMarker(marker) {
      clearHighlight();
      marker?.getElement?.()?.querySelector(".zone-map-marker")?.classList.add("is-highlighted");
    }

    function selectCardFromMap(item) {
      const card = modal.querySelector(`[data-card-id="${cssEscape(item.id)}"]`);
      if (!card) return;
      modal.querySelectorAll("[data-zone-card]").forEach((node) => node.classList.toggle("is-selected", node === card));
      highlightMarker(markers.get(item.id));
      card.scrollIntoView?.({ behavior: "smooth", block: "center" });
      card.focus?.({ preventScroll: true });
      trackZoneEvent(zone, eventFor(item, "card_clicked"));
    }

    function focusItem(item, shouldFly) {
      if (!item) return;
      const marker = markers.get(item.id);
      if (!marker) return;
      highlightMarker(marker);
      if (shouldFly) map.flyTo([Number(item.latitude), Number(item.longitude)], 17, { duration: 0.8 });
      marker.openTooltip();
    }

    return {
      map,
      focus(item) {
        focusItem(item, true);
      },
      preview(item) { focusItem(item, false); },
      clearHighlight,
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

  function hostMarkerIcon(host = {}) {
    const initials = mapInitials(host.name);
    const accent = safeColor(host.accent);
    return global.L.divIcon({
      className: "zone-map-icon zone-map-host-icon",
      html: `<span class="zone-map-marker zone-map-marker-host" style="--host-accent:${escapeAttr(accent)}">
        <span class="zone-host-orbit" aria-hidden="true"></span>
        <span class="zone-host-pin"><span class="zone-host-monogram">${escapeHtml(initials)}</span></span>
        <span class="zone-host-label"><small>Estás aquí</small><strong>${escapeHtml(host.name || "Tu punto de partida")}</strong></span>
      </span>`,
      iconSize: [64, 64],
      iconAnchor: [32, 32],
      tooltipAnchor: [0, -34]
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

  function itineraryArcMarkup(from, to, index, accent) {
    const start = { x: Number(from?.x), y: Number(from?.y) };
    const end = { x: Number(to?.x), y: Number(to?.y) };
    if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) return "";
    const distance = Math.hypot(end.x - start.x, end.y - start.y);
    const lift = Math.min(138, Math.max(52, 34 + distance * 0.2));
    const control = {
      x: (start.x + end.x) / 2,
      y: Math.min(start.y, end.y) - lift
    };
    const label = {
      x: (start.x + 2 * control.x + end.x) / 4,
      y: (start.y + 2 * control.y + end.y) / 4 - 8
    };
    const color = itineraryColor(index, accent);
    const path = `M ${fixed(start.x)} ${fixed(start.y)} Q ${fixed(control.x)} ${fixed(control.y)} ${fixed(end.x)} ${fixed(end.y)}`;
    const arrowAngle = Math.atan2(end.y - control.y, end.x - control.x) * 180 / Math.PI;
    const delay = (index * 0.42).toFixed(2);
    const flightDelay = (index * 0.42 + 0.7).toFixed(2);
    return `<g class="zone-itinerary-segment" style="--segment-color:${color};--segment-delay:${delay}s;--flight-delay:${flightDelay}s">
      <path class="zone-itinerary-shadow" d="${path}" pathLength="1"/>
      <path class="zone-itinerary-arc" d="${path}" pathLength="1"/>
      <path class="zone-itinerary-highlight" d="${path}" pathLength="1"/>
      <path class="zone-itinerary-flight" d="${path}" pathLength="1"/>
      <g class="zone-itinerary-arrow" transform="translate(${fixed(end.x)} ${fixed(end.y)}) rotate(${fixed(arrowAngle)})"><path d="M -15 -7 L 0 0 L -15 7 L -10 0 z"/></g>
      <g class="zone-itinerary-label" transform="translate(${fixed(label.x)} ${fixed(label.y)})">
        <rect x="-21" y="-10" width="42" height="20" rx="10"/>
        <text x="0" y=".5">${waypointLetter(index)}→${waypointLetter(index + 1)}</text>
      </g>
    </g>`;
  }

  function itineraryColor(index, accent) {
    const first = safeColor(accent);
    if (index === 0) return first;
    const remaining = ITINERARY_COLORS.filter((color) => color.toLowerCase() !== first.toLowerCase());
    return remaining[(index - 1) % remaining.length];
  }

  function waypointLetter(index) { return String.fromCharCode(65 + Math.max(0, Math.min(25, Number(index) || 0))); }
  function fixed(value) { return Number(value).toFixed(1); }

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
      landmark: '<path d="m4 8 8-5 8 5M5 9h14M7 10v7M12 10v7M17 10v7M4 18h16M3 21h18"/>',
      culture: '<path d="M4 5h16v14H4zM8 9h8M8 13h5M8 17h8"/><path d="m6 5 2-2h8l2 2"/>',
      beach: '<circle cx="17" cy="6" r="2.5"/><path d="M3 14c2.3-2 4.7-2 7 0s4.7 2 7 0 3.7-2 5-1M3 19c2.3-2 4.7-2 7 0s4.7 2 7 0 3.7-2 5-1"/>',
      nature: '<path d="M20 4C10 4 5 9 5 15c0 3 2 5 5 5 6 0 10-6 10-16ZM4 21c3-5 7-8 13-12"/>',
      park: '<path d="M8 20v-5M16 20v-7M5 15h6L8 9l3 1-3-7-3 7 3-1-3 6ZM12 13h8l-4-5 3 1-3-6-3 6 3-1-4 5Z"/>',
      square: '<path d="M5 5h14v14H5zM9 9h6v6H9z"/><path d="M2 12h3M19 12h3M12 2v3M12 19v3"/>',
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
    if (["start", "host", "business", "gastronomy", "landmark", "culture", "beach", "nature", "park", "square", "viewpoint", "other"].includes(category)) return category;
    if (/restaur|gastr|bar|caf|comida|food/.test(category)) return "gastronomy";
    if (/playa|beach|arenal/.test(category)) return "beach";
    if (/monument|historic|igles|arquitect|edificio|patrimonio/.test(category)) return "landmark";
    if (/cultur|muse|teatro|galeria|arte/.test(category)) return "culture";
    if (/parque|jardin/.test(category)) return "park";
    if (/plaza/.test(category)) return "square";
    if (/natur|sender|reserva/.test(category)) return "nature";
    if (/mirador|viewpoint/.test(category)) return "viewpoint";
    return "other";
  }

  function categoryColor(value) {
    return ({
      gastronomy: "#e07a3f",
      landmark: "#a76a42",
      culture: "#7559b8",
      beach: "#168caf",
      nature: "#3c805b",
      park: "#5d8c42",
      square: "#b77a30",
      viewpoint: "#386f94",
      business: "var(--zone-accent, #5265d8)",
      host: "#151b25",
      start: "#151b25",
      other: "#687386"
    })[categoryGroup(value)] || "#687386";
  }

  function categoryLabel(value) {
    return ({
      gastronomy: "Gastronomía",
      landmark: "Arquitectura y patrimonio",
      culture: "Arte y cultura",
      beach: "Playa y costa",
      nature: "Naturaleza",
      park: "Parques y jardines",
      square: "Plazas con vida",
      viewpoint: "Miradores",
      business: "Recomendación local",
      host: "Estás aquí",
      other: "Lugar con historia"
    })[categoryGroup(value)] || "Lugar con historia";
  }

  function zoneFeatureSignals(zone) {
    const groups = [...new Set((zone.recommendations || []).map((item) => categoryGroup(item.type === "business" ? "business" : item.category)))];
    const priority = ["beach", "landmark", "culture", "viewpoint", "park", "nature", "square", "gastronomy", "business", "other"];
    return priority
      .filter((group) => groups.includes(group))
      .slice(0, 4)
      .map((group) => ({ group, label: categoryLabel(group) }));
  }

  function renderMapLegend(zone) {
    return zoneFeatureSignals(zone)
      .map((signal) => `<span style="--legend-color:${categoryColor(signal.group)}"><i aria-hidden="true">${categorySvg(signal.group)}</i>${escapeHtml(shortCategoryLabel(signal.group))}</span>`)
      .join("");
  }

  function shortCategoryLabel(value) {
    return ({ landmark: "Arquitectura", culture: "Cultura", beach: "Playas", park: "Parques", square: "Plazas", viewpoint: "Miradores", nature: "Naturaleza", gastronomy: "Gastronomía", business: "Locales", other: "Otros" })[categoryGroup(value)] || "Otros";
  }

  function naturalList(items) {
    const values = items.filter(Boolean);
    if (values.length < 2) return values[0] || "";
    return `${values.slice(0, -1).join(", ")} y ${values.at(-1)}`;
  }

  function capitalize(value) {
    const text = clean(value);
    return text ? text[0].toUpperCase() + text.slice(1) : "";
  }

  function formatRadius(value) {
    const meters = Number(value || 1500);
    if (meters >= 1000) return `${Number((meters / 1000).toFixed(meters % 1000 ? 1 : 0))} km`;
    return `${Math.round(meters)} m`;
  }

  function mapInitials(value) {
    const parts = clean(value).split(/\s+/).filter(Boolean);
    return (parts.length > 1 ? `${parts[0][0]}${parts.at(-1)[0]}` : parts[0]?.slice(0, 2) || "·").toUpperCase();
  }

  function compassSvg() {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z"/></svg>';
  }

  function cssEscape(value) {
    if (global.CSS?.escape) return global.CSS.escape(String(value));
    return String(value).replace(/["\\]/g, "\\$&");
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
