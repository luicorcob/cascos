(function () {
  "use strict";

  const MODE_STORAGE_KEY = "dls-studio-compact-mode";
  const VIEWPORT_STORAGE_KEY = "dls-studio-preview-viewport";
  const VALID_MODES = ["edit", "view", "publish"];
  const VALID_VIEWPORTS = ["desktop", "tablet", "mobile"];
  const compactQuery = window.matchMedia("(max-width: 1100px)");
  const mobileQuery = window.matchMedia("(max-width: 899px)");

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initStudioExperience, { once: true });
  } else {
    initStudioExperience();
  }

  function initStudioExperience() {
    const root = document.documentElement;
    const topbar = document.querySelector(".studio-topbar");
    const shell = document.querySelector("#studioWorkspace");
    const editorPanel = shell?.querySelector(".control-panel");
    const previewPanel = shell?.querySelector(".preview-stage");
    const statusLine = document.querySelector("#statusLine");

    if (!root || !topbar || !shell || !editorPanel || !previewPanel || !statusLine) {
      return;
    }

    if (document.querySelector("#studioExperienceSwitcher")) {
      return;
    }

    editorPanel.id ||= "studioEditorPanel";
    previewPanel.id ||= "studioPreviewPanel";

    const switcher = buildModeSwitcher();
    const publishPanel = buildPublishPanel();
    topbar.insertAdjacentElement("afterend", switcher);
    shell.append(publishPanel);

    // Keep product feedback independent from whichever responsive workspace is visible.
    // Moving the existing live region preserves its ID/listeners while allowing inactive
    // panels to leave the layout completely instead of creating hidden-page overflow.
    document.body.append(statusLine);

    const modeButtons = Array.from(switcher.querySelectorAll("[data-studio-mode]"));
    const modeAnnouncer = switcher.querySelector("[data-studio-mode-announcer]");
    let currentMode = resolveInitialMode();

    modeButtons.forEach((button, index) => {
      button.addEventListener("click", () => {
        setMode(button.dataset.studioMode, { persist: true, announce: true });
      });

      button.addEventListener("keydown", (event) => {
        const lastIndex = modeButtons.length - 1;
        let nextIndex = index;

        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          nextIndex = index === lastIndex ? 0 : index + 1;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          nextIndex = index === 0 ? lastIndex : index - 1;
        } else if (event.key === "Home") {
          nextIndex = 0;
        } else if (event.key === "End") {
          nextIndex = lastIndex;
        } else {
          return;
        }

        event.preventDefault();
        const nextButton = modeButtons[nextIndex];
        setMode(nextButton.dataset.studioMode, { persist: true, announce: true });
        nextButton.focus();
      });
    });

    publishPanel.addEventListener("click", (event) => {
      const proxy = event.target.closest("[data-studio-action-target]");
      if (!proxy) {
        return;
      }

      const target = document.querySelector(proxy.dataset.studioActionTarget || "");
      if (!(target instanceof HTMLButtonElement) || target.disabled) {
        return;
      }

      proxy.setAttribute("aria-busy", "true");
      target.click();
      window.setTimeout(() => {
        syncPublishActions(publishPanel);
        proxy.removeAttribute("aria-busy");
      }, 0);
    });

    const publishSources = [
      "#prepareDeliveryButton",
      "#publishDemoButton",
      "#exportButton",
      "#exportPackageButton",
      "#exportDataButton"
    ].map((selector) => document.querySelector(selector)).filter(Boolean);

    publishSources.forEach((button) => {
      new MutationObserver(() => syncPublishActions(publishPanel))
        .observe(button, { attributes: true, attributeFilter: ["disabled"] });
    });

    const publishStateSources = [
      "#qualityScore",
      "#qualityState",
      "#deliveryStatus",
      "#deliveryReadiness",
      "#autoSaveState"
    ].map((selector) => document.querySelector(selector)).filter(Boolean);

    publishStateSources.forEach((element) => {
      new MutationObserver(() => syncPublishPanel(publishPanel))
        .observe(element, { childList: true, subtree: true, characterData: true, attributes: true });
    });

    function setMode(nextMode, options = {}) {
      if (!VALID_MODES.includes(nextMode)) {
        return;
      }

      currentMode = nextMode;
      root.dataset.studioMode = nextMode;

      modeButtons.forEach((button) => {
        const active = button.dataset.studioMode === nextMode;
        button.classList.toggle("is-active", active);
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
      });

      if (options.persist) {
        writeStorage(MODE_STORAGE_KEY, nextMode);
      }

      updatePanelAccessibility();

      if (nextMode === "publish") {
        syncPublishPanel(publishPanel);
        syncPublishActions(publishPanel);
        document.querySelector("#prepareDeliveryButton")?.click();
      }

      if (options.announce && modeAnnouncer) {
        modeAnnouncer.textContent = {
          edit: "Modo edicion activo.",
          view: "Vista previa activa.",
          publish: "Centro de publicación activo."
        }[nextMode];
      }
    }

    function updatePanelAccessibility() {
      const compact = compactQuery.matches;
      const editorActive = !compact || currentMode === "edit";
      const previewActive = !compact || currentMode === "view";
      const publishActive = compact && currentMode === "publish";

      Array.from(editorPanel.children).forEach((child) => {
        child.setAttribute("aria-hidden", String(!editorActive));
      });
      statusLine.removeAttribute("aria-hidden");
      previewPanel.setAttribute("aria-hidden", String(!previewActive));
      publishPanel.setAttribute("aria-hidden", String(!publishActive));
    }

    function applyResponsiveMode() {
      if (compactQuery.matches) {
        const storedMode = readStorage(MODE_STORAGE_KEY);
        const responsiveDefault = mobileQuery.matches ? "view" : "edit";
        setMode(VALID_MODES.includes(storedMode) ? storedMode : responsiveDefault);
      } else {
        updatePanelAccessibility();
      }
    }

    compactQuery.addEventListener?.("change", applyResponsiveMode);
    mobileQuery.addEventListener?.("change", () => {
      if (compactQuery.matches && !VALID_MODES.includes(readStorage(MODE_STORAGE_KEY))) {
        setMode(mobileQuery.matches ? "view" : "edit");
      }
    });

    installStatusToast(statusLine);
    enhanceViewportControls();
    enhancePrimaryActions();
    syncPublishPanel(publishPanel);
    syncPublishActions(publishPanel);
    setMode(currentMode);
    applyResponsiveMode();
    root.dataset.studioExperienceReady = "true";
  }

  function buildModeSwitcher() {
    const switcher = document.createElement("nav");
    switcher.id = "studioExperienceSwitcher";
    switcher.className = "studio-experience-switcher";
    switcher.setAttribute("aria-label", "Modo de trabajo del Studio");
    switcher.setAttribute("role", "tablist");
    switcher.innerHTML = `
      ${modeButton("edit", "studioEditorPanel", "Editar", editIcon())}
      ${modeButton("view", "studioPreviewPanel", "Vista", viewIcon())}
      ${modeButton("publish", "studioPublishPanel", "Publicar", publishIcon())}
      <span class="sr-only" data-studio-mode-announcer aria-live="polite" aria-atomic="true"></span>
    `;
    return switcher;
  }

  function modeButton(mode, controls, label, icon) {
    return `
      <button
        class="studio-experience-mode"
        type="button"
        role="tab"
        data-studio-mode="${mode}"
        aria-controls="${controls}"
        aria-selected="false"
        tabindex="-1"
      >
        <span class="studio-experience-mode-icon" aria-hidden="true">${icon}</span>
        <span>${label}</span>
      </button>
    `;
  }

  function buildPublishPanel() {
    const panel = document.createElement("section");
    panel.id = "studioPublishPanel";
    panel.className = "studio-publish-surface";
    panel.setAttribute("aria-labelledby", "studioPublishTitle");
    panel.setAttribute("aria-hidden", "true");
    panel.innerHTML = `
      <div class="studio-publish-card">
        <header class="studio-publish-head">
          <div>
            <p class="studio-publish-kicker">Centro de entrega</p>
            <h2 id="studioPublishTitle">Convierte el borrador en una entrega.</h2>
            <p>Revisa la preparacion, publica una demo compartible o descarga los archivos finales.</p>
          </div>
          <span class="studio-publish-save-state" data-studio-publish-save>Guardando estado...</span>
        </header>

        <div class="studio-publish-summary" aria-label="Estado de la entrega">
          <article>
            <span>Calidad</span>
            <strong data-studio-publish-quality>0%</strong>
            <small data-studio-publish-quality-state>Analizando</small>
          </article>
          <article>
            <span>Entrega Pro</span>
            <strong data-studio-publish-delivery>Sin preparar</strong>
            <small data-studio-publish-readiness>Pendiente</small>
          </article>
        </div>

        <div class="studio-publish-primary-actions">
          <button class="studio-publish-action is-publish" type="button" data-studio-action-target="#publishDemoButton">
            <span aria-hidden="true">${publishIcon()}</span>
            <span><strong>Publicar demo</strong><small>Genera un enlace temporal para compartir</small></span>
          </button>
          <button class="studio-publish-action is-export" type="button" data-studio-action-target="#exportButton">
            <span aria-hidden="true">${downloadIcon()}</span>
            <span><strong>Exportar web</strong><small>Descarga el HTML listo para hosting</small></span>
          </button>
        </div>

        <div class="studio-publish-secondary-actions">
          <button type="button" data-studio-action-target="#prepareDeliveryButton">Preparar entrega</button>
          <button type="button" data-studio-action-target="#exportPackageButton">Descargar paquete</button>
          <button type="button" data-studio-action-target="#exportDataButton">Exportar datos</button>
        </div>

        <p class="studio-publish-footnote">
          Publicar crea una demo; exportar no cambia el estado online del proyecto.
        </p>
      </div>
    `;
    return panel;
  }

  function syncPublishPanel(panel) {
    setText(panel.querySelector("[data-studio-publish-quality]"), textOf("#qualityScore", "0%"));
    setText(panel.querySelector("[data-studio-publish-quality-state]"), textOf("#qualityState", "Analizando"));
    setText(panel.querySelector("[data-studio-publish-delivery]"), textOf("#deliveryStatus", "Sin preparar"));
    setText(panel.querySelector("[data-studio-publish-readiness]"), textOf("#deliveryReadiness", "Pendiente"));
    setText(panel.querySelector("[data-studio-publish-save]"), textOf("#autoSaveState", "Cambios en vivo"));
  }

  function syncPublishActions(panel) {
    panel.querySelectorAll("[data-studio-action-target]").forEach((proxy) => {
      const source = document.querySelector(proxy.dataset.studioActionTarget || "");
      proxy.disabled = !(source instanceof HTMLButtonElement) || source.disabled;
    });
  }

  function installStatusToast(statusLine) {
    let dismissTimer = 0;

    statusLine.setAttribute("aria-live", "polite");
    statusLine.setAttribute("aria-atomic", "true");
    setToastFocusable(false);

    const dismiss = (delay = 0) => {
      window.clearTimeout(dismissTimer);
      dismissTimer = window.setTimeout(() => {
        statusLine.classList.remove("is-experience-toast-visible");
        setToastFocusable(false);
      }, delay);
    };

    const reveal = () => {
      const message = String(statusLine.textContent || "").trim();
      if (!message || document.body.classList.contains("is-intro-active")) {
        setToastFocusable(false);
        return;
      }

      statusLine.dataset.toastTone = statusTone(message);
      setToastFocusable(true);
      statusLine.classList.remove("is-experience-toast-visible");
      window.requestAnimationFrame(() => {
        statusLine.classList.add("is-experience-toast-visible");
      });
      dismiss(statusLine.querySelector("a") ? 10000 : 5600);
    };

    new MutationObserver(reveal).observe(statusLine, {
      childList: true,
      subtree: true,
      characterData: true
    });

    statusLine.addEventListener("pointerenter", () => window.clearTimeout(dismissTimer));
    statusLine.addEventListener("pointerleave", () => dismiss(1800));
    statusLine.addEventListener("focusin", () => window.clearTimeout(dismissTimer));
    statusLine.addEventListener("focusout", () => dismiss(1800));

    function setToastFocusable(active) {
      const focusables = statusLine.querySelectorAll("a, button, input, select, textarea, [tabindex]");
      focusables.forEach((element) => {
        if (active) {
          if (!element.hasAttribute("data-experience-tabindex")) return;
          const previous = element.getAttribute("data-experience-tabindex");
          if (previous) element.setAttribute("tabindex", previous);
          else element.removeAttribute("tabindex");
          element.removeAttribute("data-experience-tabindex");
          return;
        }

        if (!element.hasAttribute("data-experience-tabindex")) {
          element.setAttribute("data-experience-tabindex", element.getAttribute("tabindex") || "");
        }
        element.setAttribute("tabindex", "-1");
      });
    }
  }

  function enhanceViewportControls() {
    const switcher = document.querySelector(".viewport-switcher");
    const frame = document.querySelector(".device-frame");
    const buttons = Array.from(document.querySelectorAll(".viewport-button[data-size]"));
    if (!switcher || !frame || !buttons.length) {
      return;
    }

    switcher.setAttribute("role", "group");
    switcher.setAttribute("aria-label", "Tamano de la vista previa");

    const syncPressedState = () => {
      buttons.forEach((button) => {
        const active = button.dataset.size === frame.dataset.size;
        button.setAttribute("aria-pressed", String(active));
        button.title = `Vista ${button.textContent.trim()}`;
      });
    };

    let applyingInitialViewport = false;
    switcher.addEventListener("click", (event) => {
      const button = event.target.closest(".viewport-button[data-size]");
      if (!button || !VALID_VIEWPORTS.includes(button.dataset.size)) {
        return;
      }
      if (!applyingInitialViewport) {
        writeStorage(VIEWPORT_STORAGE_KEY, button.dataset.size);
      }
      window.setTimeout(syncPressedState, 0);
    });

    new MutationObserver(syncPressedState).observe(frame, {
      attributes: true,
      attributeFilter: ["data-size"]
    });

    const params = new URLSearchParams(window.location.search);
    const explicitViewport = params.get("view");
    const storedViewport = readStorage(VIEWPORT_STORAGE_KEY);
    let initialViewport = "";

    if (!VALID_VIEWPORTS.includes(explicitViewport)) {
      if (VALID_VIEWPORTS.includes(storedViewport)) {
        initialViewport = storedViewport;
      } else if (window.innerWidth > 1100) {
        initialViewport = "desktop";
      }
    }

    if (initialViewport) {
      const button = buttons.find((item) => item.dataset.size === initialViewport);
      if (button) {
        applyingInitialViewport = true;
        button.click();
        applyingInitialViewport = false;
      }
    }

    syncPressedState();
  }

  function enhancePrimaryActions() {
    const publishButton = document.querySelector("#publishDemoButton");
    const exportButton = document.querySelector("#exportButton");
    publishButton?.setAttribute("aria-label", "Publicar demo online");
    exportButton?.setAttribute("aria-label", "Exportar web como HTML");
    publishButton?.setAttribute("data-compact-label", "Publicar");
    exportButton?.setAttribute("data-compact-label", "Exportar");
  }

  function resolveInitialMode() {
    const storedMode = readStorage(MODE_STORAGE_KEY);
    if (VALID_MODES.includes(storedMode)) {
      return storedMode;
    }
    return mobileQuery.matches ? "view" : "edit";
  }

  function statusTone(message) {
    const normalized = message.toLowerCase();
    if (/no se pudo|bloquead|error|incompatible|no disponible|corrige/.test(normalized)) {
      return "error";
    }
    if (/publicad|exportad|guardad|lista|listo|completad|actualizad|aplicad/.test(normalized)) {
      return "success";
    }
    if (/preparando|publicando|analizando|cargando|sincronizando|guardando/.test(normalized)) {
      return "progress";
    }
    return "info";
  }

  function textOf(selector, fallback) {
    return String(document.querySelector(selector)?.textContent || fallback).trim();
  }

  function setText(element, value) {
    if (element && element.textContent !== value) {
      element.textContent = value;
    }
  }

  function readStorage(key) {
    try {
      return window.localStorage.getItem(key) || "";
    } catch (error) {
      return "";
    }
  }

  function writeStorage(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      // The experience remains fully usable when storage is unavailable.
    }
  }

  function icon(path) {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  }

  function editIcon() {
    return icon('<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>');
  }

  function viewIcon() {
    return icon('<path d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>');
  }

  function publishIcon() {
    return icon('<path d="M12 16V3"/><path d="m7 8 5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>');
  }

  function downloadIcon() {
    return icon('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>');
  }
})();
