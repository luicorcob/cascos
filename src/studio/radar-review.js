(function (global) {
  "use strict";

  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  function createRadarReviewController(options = {}) {
    const handoffApi = options.handoffApi;
    const storage = options.storage || global.localStorage;
    const storageKey = options.storageKey || "dls-radar-studio-brief";
    const parseLines = options.parseLines || ((value) => String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
    const escapeHtml = options.escapeHtml || ((value) => String(value ?? ""));
    const layer = document.querySelector("#radarReviewLayer");
    const form = document.querySelector("#radarReviewForm");
    const sourceLabel = document.querySelector("#radarReviewSource");
    const coordinates = document.querySelector("#radarReviewCoordinates");
    const quotes = document.querySelector("#radarReviewQuotes");
    const missingList = document.querySelector("#radarMissingList");

    return { openIfNeeded, close };

    function openIfNeeded() {
      const params = new URLSearchParams(global.location.search);
      if (params.get("source") !== "radar" || !handoffApi || !layer || !form) return false;
      let handoff;
      try {
        const stored = JSON.parse(storage.getItem(storageKey) || "null");
        if (!stored) return false;
        handoff = stored.version === 2 && stored.detected
          ? stored
          : handoffApi.buildHandoff(stored.detected || stored, stored.draft || stored.studioBusiness || null);
      } catch (error) {
        options.onStatus?.("No se pudo leer la ficha enviada desde Radar.");
        return false;
      }

      populate(handoff);
      layer.hidden = false;
      document.body.classList.add("has-radar-review");
      form.addEventListener("input", () => refreshMissing(readBusiness(handoff.detected)));
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        options.onCreate?.(handoffApi.buildHandoff(readBusiness(handoff.detected)));
        storage.removeItem(storageKey);
        close();
        cleanLaunchUrl();
      }, { once: true });
      requestAnimationFrame(() => form.elements.name?.focus());
      return true;
    }

    function populate(handoff) {
      const detected = handoffApi.normalizeBusiness(handoff.detected || {});
      const setValue = (name, value) => { if (form.elements[name]) form.elements[name].value = value ?? ""; };
      setValue("name", detected.name);
      setValue("category", detected.category);
      setValue("address", detected.address);
      setValue("city", detected.city);
      setValue("province", detected.province);
      setValue("postalCode", detected.postalCode);
      setValue("phone", detected.phone);
      setValue("rating", detected.rating || "");
      setValue("reviewCount", detected.reviewCount || "");
      setValue("websiteStatus", detected.websiteStatus);
      setValue("mapsUrl", detected.mapsUrl);
      setValue("openingHours", detected.openingHours.join("\n"));
      sourceLabel.textContent = `${detected.sourceLabel || "Ficha pública"} · ${detected.category}${detected.city ? ` en ${detected.city}` : ""}`;
      coordinates.textContent = detected.coordinates
        ? `${detected.coordinates.lat.toFixed(6)}, ${detected.coordinates.lng.toFixed(6)}`
        : "Sin coordenadas disponibles";
      quotes.innerHTML = detected.reviewItems.length
        ? detected.reviewItems.map((review) => `
            <blockquote class="radar-review-quote">${escapeHtml(review.text)}
              <small>${escapeHtml([review.author, review.relativeDate].filter(Boolean).join(" · ") || "Autor no disponible")}</small>
            </blockquote>`).join("")
        : `<p class="radar-review-quote">${detected.rating && detected.reviewCount
          ? "Hay rating y número de reseñas, pero la fuente no ha devuelto textos publicables."
          : "No se han encontrado reseñas textuales reales. El bloque quedará pendiente de completar."}</p>`;
      refreshMissing(detected);
    }

    function readBusiness(original = {}) {
      const data = new FormData(form);
      return {
        ...original,
        name: String(data.get("name") || "").trim(),
        category: String(data.get("category") || "").trim(),
        address: String(data.get("address") || "").trim(),
        city: String(data.get("city") || "").trim(),
        province: String(data.get("province") || "").trim(),
        postalCode: String(data.get("postalCode") || "").trim(),
        phone: String(data.get("phone") || "").trim(),
        rating: Number(data.get("rating") || 0),
        reviews: Number(data.get("reviewCount") || 0),
        websiteStatus: String(data.get("websiteStatus") || "unverified"),
        mapsUrl: String(data.get("mapsUrl") || "").trim(),
        openingHours: parseLines(data.get("openingHours"))
      };
    }

    function refreshMissing(business) {
      const missing = handoffApi.getMissingFields(business);
      missingList.innerHTML = missing.length
        ? missing.map((item) => `<span>${escapeHtml(item)} pendiente</span>`).join("")
        : '<span class="is-complete">Ficha completa para la primera versión</span>';
    }

    function close() {
      if (layer) layer.hidden = true;
      document.body.classList.remove("has-radar-review");
    }

    function cleanLaunchUrl() {
      const cleanUrl = new URL(global.location.href);
      cleanUrl.searchParams.delete("source");
      cleanUrl.searchParams.delete("opportunity");
      global.history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
    }
  }

  studio.radarReview = { createRadarReviewController };
})(globalThis);
