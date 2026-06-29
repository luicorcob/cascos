const {
  parseLines,
  cloneData,
  parsePairs,
  serializeMenuItems,
  parseMenuItems,
  normalizeMenuItems,
  normalizeMenuItem,
  groupMenuItems,
  isFoodCategory,
  parsePrice,
  roundMoney,
  formatPlainPrice,
  normalizeCurrency,
  formatMoney,
  textOr,
  numberOr,
  clampNumber,
  normalizeChoice,
  normalizeSectionOrder,
  sectionBaseKey,
  splitTitleBody,
  normalizeImage,
  normalizeUrl,
  normalizeOptionalUrl,
  normalizeText,
  matchesAny,
  hasSharedToken,
  looksLikeLeadDetails,
  phoneHref,
  initials,
  slugify,
  motionMultiplier,
  escapeHtml,
  escapeAttr
} = window.LocalLiftStudio.core;
const { createHistory, createAutoSave } = window.LocalLiftStudio.state;
const { createLayoutLibrary } = window.LocalLiftStudio.layouts;
const { createMediaLibrary, fileToDataUrl, getImageInfo } = window.LocalLiftStudio.media;
const {
  apiUrl,
  apiHeaders,
  createBusinessDataClient,
  toApiRecordMeta
} = window.LocalLiftStudio.data;
const { createRenderer } = window.LocalLiftStudio.renderer;
const { createExporter } = window.LocalLiftStudio.exporter;
const { validateBusiness } = window.LocalLiftStudio.validation;
const { renderQualityControl } = window.LocalLiftStudio.qualityControl;
const { createStockImageSearch } = window.LocalLiftStudio.stockImages;
const {
  createButtonStyleEditor,
  readButtonStyles,
  normalizeButtonStyles
} = window.LocalLiftStudio.buttonStyles;
const {
  SECTION_DEFINITIONS,
  DEFAULT_SECTION_ORDER,
  BLOCK_LIBRARY,
  DEFAULT_BLOCK_VARIANTS,
  LAYOUT_RECIPES,
  QUICK_CREATIVE_DIRECTIONS,
  QUICK_ACTION_RECIPES,
  demoBusiness,
  sectorPresets,
  defaultSectorPreset,
  themePalette,
  getContrastTokens,
  designPacks,
  heroSizeMap,
  contentWidthMap,
  densityLayoutMap,
  artDirectionOptions
} = window.LocalLiftStudio.catalog;

const STORAGE_KEY = "locallift-studio-business";
const DRAFT_STORAGE_KEY = "locallift-studio-draft";
const API_RECORD_KEY = "locallift-studio-business-api-record";
const DATA_VERSION = 6;

const form = document.querySelector("#businessForm");
const sitePreview = document.querySelector("#sitePreview");
const previewTitle = document.querySelector("#previewTitle");
const previewMetrics = document.querySelector("#previewMetrics");
const deliveryStatus = document.querySelector("#deliveryStatus");
const deliveryReadiness = document.querySelector("#deliveryReadiness");
const deliveryReport = document.querySelector("#deliveryReport");
const statusLine = document.querySelector("#statusLine");
const deviceFrame = document.querySelector(".device-frame");
const cursorGlow = document.querySelector(".cursor-glow");
const introGate = document.querySelector("#introGate");
const introStartButton = document.querySelector("#introStartButton");
const introHub = document.querySelector("#introHub");
const introHubBackButton = document.querySelector("#introHubBackButton");
const importDataInput = document.querySelector("#importDataInput");
const topbarProjectName = document.querySelector("#topbarProjectName");
const frameAddress = document.querySelector("#frameAddress");
const presentationModeButton = document.querySelector("#presentationModeButton");
const prepareDeliveryButton = document.querySelector("#prepareDeliveryButton");
const directEditButton = document.querySelector("#directEditButton");
const autoSaveState = document.querySelector("#autoSaveState");
const sectionOrderList = document.querySelector("#sectionOrderList");
const blockLibrary = document.querySelector("#blockLibrary");
const heroLayoutPicker = document.querySelector("#heroLayoutPicker");
const layoutTemplateName = document.querySelector("#layoutTemplateName");
const layoutTemplateList = document.querySelector("#layoutTemplateList");
const mediaLibraryGrid = document.querySelector("#mediaLibrary");
const mediaUploadInput = document.querySelector("#mediaUploadInput");
const mediaUrlInput = document.querySelector("#mediaUrlInput");
const mediaUrlAddButton = document.querySelector("#mediaUrlAddButton");
const siteImageGenerateButton = document.querySelector("#siteImageGenerateButton");
const siteImageGenerateStatus = document.querySelector("#siteImageGenerateStatus");
const previewInspector = document.querySelector("#previewInspector");
const previewInspectorTitle = document.querySelector("#previewInspectorTitle");
const previewInspectorImage = document.querySelector("#previewInspectorImage");
const previewInspectorImageUrl = document.querySelector("#previewInspectorImageUrl");
const previewInspectorImageAlt = document.querySelector("#previewInspectorImageAlt");
const previewInspectorImagePosition = document.querySelector("#previewInspectorImagePosition");
const previewInspectorMedia = document.querySelector("#previewInspectorMedia");
const stockCategoryList = document.querySelector("#stockCategoryList");
const stockSearchInput = document.querySelector("#stockSearchInput");
const stockSearchButton = document.querySelector("#stockSearchButton");
const stockImageResults = document.querySelector("#stockImageResults");
const stockImageStatus = document.querySelector("#stockImageStatus");
const stockLoadMoreButton = document.querySelector("#stockLoadMoreButton");
const stockSiteImageButton = document.querySelector("#stockSiteImageButton");
const previewInspectorLinkLabel = document.querySelector("#previewInspectorLinkLabel");
const previewInspectorLinkUrl = document.querySelector("#previewInspectorLinkUrl");
const previewInspectorTextSample = document.querySelector("#previewInspectorTextSample");
const previewInspectorTextColor = document.querySelector("#previewInspectorTextColor");
const previewInspectorTextOpacity = document.querySelector("#previewInspectorTextOpacity");
const previewInspectorTextSize = document.querySelector("#previewInspectorTextSize");
const previewInspectorTextWeight = document.querySelector("#previewInspectorTextWeight");
const previewInspectorTextItalic = document.querySelector("#previewInspectorTextItalic");
const previewInspectorTextLetterSpacing = document.querySelector("#previewInspectorTextLetterSpacing");
const previewButtonStyleEditor = createButtonStyleEditor({
  sitePreview,
  getBusiness: businessFromForm,
  onReset: resetPreviewButtonStyle
});

let previewObserver;
const editorHistory = createHistory({ limit: 60, clone: cloneData });
const draftStore = createAutoSave({
  storage: localStorage,
  key: DRAFT_STORAGE_KEY,
  delay: 700,
  onPending: () => setAutoSaveState("Guardando..."),
  onSave: () => setAutoSaveState("Guardado automatico"),
  onError: () => setAutoSaveState("Autoguardado no disponible")
});
const businessDataClient = createBusinessDataClient({
  storage: localStorage,
  storageKey: API_RECORD_KEY,
  buildPayload: buildBusinessApiPayload
});
const mediaLibrary = createMediaLibrary({
  storage: localStorage,
  key: "locallift-studio-media-library",
  maxItems: 240,
  maxItemBytes: 900_000,
  maxTotalBytes: 2_000_000
});
const stockImageSearch = createStockImageSearch({
  pageSize: 30,
  catalogMinItems: 200,
  catalogTargetItems: 240,
  catalogPageSize: 24,
  catalogConcurrency: 1
});
const layoutLibrary = createLayoutLibrary({
  storage: localStorage,
  key: "locallift-studio-layout-library",
  maxItems: 12
});
const studioRenderer = createRenderer({
  core: window.LocalLiftStudio.core,
  demoBusiness,
  themePalette,
  getContrastTokens,
  densityLayoutMap,
  contentWidthMap,
  heroSizeMap,
  artDirectionOptions,
  withBusinessDefaults,
  normalizeCommerce,
  normalizeProducts,
  getPublicLeadEndpoint,
  getPublicBookingEndpoint,
  getCurrentBusinessRecord: () => currentBusinessRecord
});
const {
  renderSite,
  renderProductCard,
  buildTrustBadges,
  buildMapEmbedUrl
} = studioRenderer;
const studioExporter = createExporter({
  dataVersion: DATA_VERSION,
  getCurrentBusinessRecord: () => currentBusinessRecord,
  demoBusiness,
  renderSite,
  withBusinessDefaults,
  normalizeCommerce,
  buildMapEmbedUrl,
  slugify,
  splitTitleBody,
  escapeHtml,
  escapeAttr
});
let currentBusiness = withBusinessDefaults(draftStore.load() || cloneData(defaultSectorPreset));
let currentBusinessRecord = null;
let editorEditStart = null;
let renderFrame = 0;
let parallaxFrame = 0;
let directEditEnabled = false;
let activePreviewEdit = null;
let previewInspectorTarget = null;
let stockImageState = {
  category: "all",
  query: "",
  mode: "catalog",
  page: 1,
  loading: false,
  items: [],
  catalogItems: [],
  categoryCount: 0,
  hasNext: false
};
let selectedStockImage = null;
const PREVIEW_SECTION_LISTS = {
  services: "services",
  features: "features",
  gallery: "gallery",
  testimonials: "testimonials",
  faq: "faqs"
};

init();

function init() {
  if (!form || !sitePreview || !previewTitle || !previewMetrics || !statusLine || !deviceFrame) {
    document.body.innerHTML = '<main class="boot-error"><h1>No se pudo iniciar DLS Studio</h1><p>Faltan elementos esenciales de la interfaz. Revisa index.html.</p></main>';
    return;
  }

  bindTabs();
  bindViewportButtons();
  bindPresetButtons();
  bindDesignPackButtons();
  bindQuickEditor();
  bindBlockLibrary();
  bindLayoutTemplates();
  bindMediaManager();
  bindStockImageSearch();
  bindSiteImageGenerator();
  bindDirectEditing();
  bindActions();
  bindPresentationMode();
  bindCursor();
  bindIntroGate();
  fillForm(currentBusiness);
  syncSegmentedControls();
  syncDesignPackState();
  renderBlockLibrary();
  renderLayoutTemplates();
  renderMediaLibrary();
  updateHistoryButtons();
  renderFromForm();
  applyLaunchView();
  form.addEventListener("input", (event) => {
    markCustomDesignPack(event.target);
    syncSegmentedControls();
    syncDesignPackState();
    syncQuickToggleState();
    scheduleRenderFromForm();
  });
  form.addEventListener("focusin", () => {
    editorEditStart = cloneData(businessFromForm());
  });
  form.addEventListener("change", (event) => {
    editorHistory.record(editorEditStart || currentBusiness);
    editorEditStart = null;
    updateHistoryButtons();
    markCustomDesignPack(event.target);
    syncSegmentedControls();
    syncDesignPackState();
    syncQuickToggleState();
    scheduleRenderFromForm();
  });
}

function scheduleRenderFromForm() {
  if (renderFrame) {
    cancelAnimationFrame(renderFrame);
  }

  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0;
    renderFromForm();
  });
}

function bindTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach((item) => item.classList.remove("is-active"));
      document.querySelectorAll(".tab-panel").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      document.querySelector(`[data-panel="${button.dataset.tab}"]`).classList.add("is-active");
    });
  });
}

function bindViewportButtons() {
  document.querySelectorAll(".viewport-button").forEach((button) => {
    button.addEventListener("click", () => {
      setDeviceSize(button.dataset.size);
    });
  });
}

function setDeviceSize(size = "desktop") {
  document.querySelectorAll(".viewport-button").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.size === size);
  });
  if (deviceFrame) {
    deviceFrame.dataset.size = size;
  }
}

function bindPresetButtons() {
  document.querySelectorAll(".preset-button").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = sectorPresets[button.dataset.preset];

      if (!preset) {
        return;
      }

      document.querySelectorAll(".preset-button").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      currentBusinessRecord = null;
      storeApiRecord(null);
      currentBusiness = cloneData(preset);
      fillForm(currentBusiness);
      syncSegmentedControls();
      syncDesignPackState();
      syncQuickToggleState();
      renderFromForm();
      setStatus(`Demo cargada: ${currentBusiness.category}.`);
    });
  });
}

function bindDesignPackButtons() {
  document.querySelectorAll("[data-design-pack]").forEach((button) => {
    button.addEventListener("click", () => {
      applyDesignPack(button.dataset.designPack);
    });
  });
}

function applyDesignPack(packName) {
  const pack = designPacks[packName];

  if (!pack) {
    return;
  }

  runQuickMutation(() => {
    applyDesignPackValues(packName, pack);
  }, `Pack aplicado: ${pack.label}.`);

  if (packName === "mobileFirst") {
    setDeviceSize("mobile");
  }
}

function applyDesignPackValues(packName, pack) {
  setValue("designPack", packName);
  setRadioValue("artDirection", pack.artDirection || "auto");
  setRadioValue("contentMode", pack.contentMode || "visual");
  setRadioValue("theme", pack.theme);
  setRadioValue("motion", pack.motion);
  setRadioValue("typography", pack.typography);
  setRadioValue("contentDensity", pack.contentDensity);
  setRadioValue("visualShape", pack.visualShape);
  setRadioValue("heroSize", pack.heroSize);
  setRadioValue("contentWidth", pack.contentWidth);
  setRadioValue("imageRatio", pack.imageRatio);
  setValue("accent", pack.accent);
  setValue("intensity", pack.intensity);
  setValue("fontScale", pack.fontScale);
  setValue("layoutScale", pack.layoutScale);
  setChecked("premiumEffects", pack.premiumEffects);
}

function markCustomDesignPack(target) {
  if (!target?.name || target.name === "designPack") {
    return;
  }

  if (target.closest('[data-panel="style"]')) {
    setValue("designPack", "custom");
  }
}

function syncSegmentedControls() {
  document.querySelectorAll(".segmented-control label").forEach((label) => {
    const input = label.querySelector("input");
    label.classList.toggle("is-checked", Boolean(input?.checked));
  });
}

function syncDesignPackState() {
  const activePack = form.elements.designPack?.value || "custom";
  document.querySelectorAll("[data-design-pack]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.designPack === activePack);
  });
}

function syncQuickToggleState() {
  document.querySelectorAll("[data-toggle-field]").forEach((button) => {
    const field = form.elements[button.dataset.toggleField];
    button.classList.toggle("is-active", Boolean(field?.checked));
  });
}

function bindQuickEditor() {
  document.querySelectorAll("[data-quick-action]").forEach((button) => {
    button.addEventListener("click", () => {
      applyQuickAction(button.dataset.quickAction);
    });
  });

  document.querySelectorAll("[data-toggle-field]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleQuickField(button.dataset.toggleField);
    });
  });

  document.querySelector("#quickUndoButton")?.addEventListener("click", undoQuickChange);
  document.querySelector("#quickRedoButton")?.addEventListener("click", redoQuickChange);
  document.querySelector("#quickCommandButton")?.addEventListener("click", applyQuickCommand);
  document.querySelector("#quickCommandInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyQuickCommand();
    }
  });

  sectionOrderList?.addEventListener("click", (event) => {
    const moveButton = event.target.closest("[data-section-move]");
    const toggleButton = event.target.closest("[data-section-toggle]");
    const removeButton = event.target.closest("[data-section-remove]");

    if (moveButton) {
      moveSection(moveButton.dataset.sectionMove, Number(moveButton.dataset.direction || 0));
    } else if (removeButton) {
      removeSectionInstance(removeButton.dataset.sectionRemove);
    } else if (toggleButton) {
      const definition = SECTION_DEFINITIONS[sectionBaseKey(toggleButton.dataset.sectionToggle)];
      if (definition?.field) {
        toggleQuickField(definition.field);
      }
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) {
      return;
    }

    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
      return;
    }

    if (event.key.toLowerCase() === "z") {
      event.preventDefault();
      event.shiftKey ? redoQuickChange() : undoQuickChange();
    } else if (event.key.toLowerCase() === "y") {
      event.preventDefault();
      redoQuickChange();
    }
  });
}

function bindBlockLibrary() {
  const applyBlockVariant = (event) => {
    const button = event.target.closest("[data-block-section][data-block-variant]");
    if (!button) {
      return;
    }

    const section = button.dataset.blockSection;
    const variant = button.dataset.blockVariant;
    const definition = BLOCK_LIBRARY[section];
    const option = definition?.variants.find((item) => item.id === variant);
    if (!option) {
      return;
    }

    runQuickMutation(() => {
      const variants = readBlockVariants(form.elements.blockVariants?.value);
      variants[section] = variant;
      setValue("blockVariants", JSON.stringify(variants));
    }, `${definition.label}: bloque ${option.label.toLowerCase()} aplicado.`);
  };

  [blockLibrary, heroLayoutPicker].forEach((root) => root?.addEventListener("click", applyBlockVariant));
}

function renderBlockLibrary(business = businessFromForm()) {
  if (!blockLibrary) {
    return;
  }

  const active = normalizeBlockVariants(business.blockVariants);
  blockLibrary.innerHTML = Object.entries(BLOCK_LIBRARY).filter(([section]) => section !== "hero").map(([section, definition]) => `
    <section class="block-library-group">
      <strong>${escapeHtml(definition.label)}</strong>
      <div>
        ${definition.variants.map((variant) => `
          <button
            class="${active[section] === variant.id ? "is-active" : ""}"
            type="button"
            data-block-section="${escapeAttr(section)}"
            data-block-variant="${escapeAttr(variant.id)}"
            title="${escapeAttr(variant.description)}"
          >
            <span>${escapeHtml(variant.label)}</span>
            <small>${escapeHtml(variant.description)}</small>
          </button>
        `).join("")}
      </div>
    </section>
  `).join("");

  if (heroLayoutPicker) {
    heroLayoutPicker.innerHTML = BLOCK_LIBRARY.hero.variants.map(({ id, label, description }) => `
      <button class="hero-layout-option ${active.hero === id ? "is-active" : ""}" type="button"
        data-block-section="hero" data-block-variant="${escapeAttr(id)}"
        aria-pressed="${active.hero === id}" title="${escapeAttr(description)}">
        <span class="hero-layout-swatch hero-layout-swatch-${escapeAttr(id)}" aria-hidden="true"><i></i><i></i><i></i></span>
        <strong>${escapeHtml(label)}</strong>
      </button>`).join("");
  }
}

function bindLayoutTemplates() {
  document.querySelector("#layoutTemplateSave")?.addEventListener("click", () => {
    try {
      const fallbackName = `${form.elements.name?.value || "Negocio"} - composicion ${layoutLibrary.list().length + 1}`;
      const template = layoutLibrary.save(layoutTemplateName?.value || fallbackName, captureCurrentLayout());
      if (layoutTemplateName) {
        layoutTemplateName.value = "";
      }
      renderLayoutTemplates();
      setStatus(`Composicion guardada: ${template.name}.`);
    } catch (error) {
      setStatus(error?.message || "No se pudo guardar la composicion.");
    }
  });

  layoutTemplateList?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-layout-template-action][data-layout-template-id]");
    if (!button) {
      return;
    }
    const builtIn = LAYOUT_RECIPES.find((item) => item.id === button.dataset.layoutTemplateId);
    const custom = layoutLibrary.list().find((item) => item.id === button.dataset.layoutTemplateId);
    const template = builtIn || custom;
    if (!template) {
      return;
    }

    if (button.dataset.layoutTemplateAction === "apply") {
      applyLayoutTemplate(template);
    } else if (button.dataset.layoutTemplateAction === "remove" && custom) {
      layoutLibrary.remove(custom.id);
      renderLayoutTemplates();
      setStatus(`Composicion eliminada: ${custom.name}.`);
    }
  });
}

function captureCurrentLayout() {
  return {
    sectionOrder: normalizeSectionOrder(form.elements.sectionOrder?.value, DEFAULT_SECTION_ORDER),
    blockVariants: readBlockVariants(form.elements.blockVariants?.value),
    visibility: Object.fromEntries(Object.values(SECTION_DEFINITIONS)
      .map((definition) => definition.field)
      .filter(Boolean)
      .map((field) => [field, Boolean(form.elements[field]?.checked)]))
  };
}

function applyLayoutTemplate(template) {
  const layout = template.layout || {};
  runQuickMutation(() => {
    setValue("sectionOrder", normalizeSectionOrder(layout.sectionOrder, DEFAULT_SECTION_ORDER).join(","));
    setValue("blockVariants", JSON.stringify(normalizeBlockVariants(layout.blockVariants)));
    Object.entries(layout.visibility || {}).forEach(([field, visible]) => {
      if (form.elements[field] && typeof form.elements[field].checked === "boolean") {
        setChecked(field, visible);
      }
    });
  }, `Composicion aplicada: ${template.name}. Los contenidos se han conservado.`);
}

function renderLayoutTemplates() {
  if (!layoutTemplateList) {
    return;
  }
  const custom = layoutLibrary.list().map((template) => ({ ...template, custom: true }));
  layoutTemplateList.innerHTML = [...LAYOUT_RECIPES, ...custom].map((template) => `
    <article class="layout-template-card">
      <div>
        <strong>${escapeHtml(template.name)}</strong>
        <span>${escapeHtml(template.description || "Composicion guardada en este navegador.")}</span>
      </div>
      <footer>
        <button type="button" data-layout-template-action="apply" data-layout-template-id="${escapeAttr(template.id)}">Aplicar</button>
        ${template.custom ? `<button type="button" data-layout-template-action="remove" data-layout-template-id="${escapeAttr(template.id)}">Eliminar</button>` : ""}
      </footer>
    </article>
  `).join("");
}

function bindMediaManager() {
  mediaUrlAddButton?.addEventListener("click", addMediaUrl);
  mediaUrlInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addMediaUrl();
    }
  });
  mediaUploadInput?.addEventListener("change", async () => {
    const files = [...(mediaUploadInput.files || [])];
    if (!files.length) {
      return;
    }

    let added = 0;
    try {
      for (const file of files) {
        const url = await fileToDataUrl(file, { maxDimension: 1600, quality: 0.82 });
        const info = await getImageInfo(url).catch(() => ({ width: 0, height: 0 }));
        mediaLibrary.add({ name: file.name, url, type: file.type, ...info });
        added += 1;
      }
      renderMediaLibrary();
      setStatus(`${added} ${added === 1 ? "imagen anadida" : "imagenes anadidas"} a la biblioteca.`);
    } catch (error) {
      renderMediaLibrary();
      setStatus(error?.message || "No se pudieron anadir las imagenes.");
    } finally {
      mediaUploadInput.value = "";
    }
  });
  mediaLibraryGrid?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-media-action][data-media-id]");
    if (!button) {
      return;
    }
    const item = mediaLibrary.list().find((candidate) => candidate.id === button.dataset.mediaId);
    if (!item) {
      renderMediaLibrary();
      return;
    }

    if (button.dataset.mediaAction === "hero") {
      runQuickMutation(() => {
        setValue("heroImage", item.url);
        mergeMediaMetadata(item.url, { alt: item.alt || item.name, ...mediaCreditMetadata(item) });
      }, `"${item.name}" aplicada como portada.`);
    } else if (button.dataset.mediaAction === "gallery") {
      runQuickMutation(() => {
        const gallery = parseLines(form.elements.gallery?.value);
        if (!gallery.includes(item.url)) {
          setValue("gallery", [...gallery, item.url].slice(0, 12).join("\n"));
        }
        mergeMediaMetadata(item.url, { alt: item.alt || item.name, ...mediaCreditMetadata(item) });
        setChecked("showGallery", true);
      }, `"${item.name}" anadida a la galeria.`);
    } else if (button.dataset.mediaAction === "metadata") {
      const altInput = mediaLibraryGrid.querySelector(`[data-media-alt="${CSS.escape(item.id)}"]`);
      const alt = altInput?.value || "";
      mediaLibrary.update(item.id, { alt });
      const business = businessFromForm();
      if (business.heroImage === item.url || business.gallery.includes(item.url)) {
        runQuickMutation(() => mergeMediaMetadata(item.url, { alt }), `Texto alternativo de "${item.name}" actualizado.`);
      } else {
        renderMediaLibrary();
        setStatus(`Texto alternativo de "${item.name}" actualizado.`);
      }
    } else if (button.dataset.mediaAction === "remove") {
      mediaLibrary.remove(item.id);
      renderMediaLibrary();
      setStatus(`"${item.name}" eliminada de la biblioteca. Las secciones que ya la usan no cambian.`);
    }
  });
}

function addMediaUrl() {
  const url = String(mediaUrlInput?.value || "").trim();
  if (!url) {
    setStatus("Pega una URL de imagen antes de anadirla.");
    return;
  }

  try {
    const item = mediaLibrary.add({ url });
    mediaUrlInput.value = "";
    renderMediaLibrary();
    setStatus(`"${item.name}" disponible en la biblioteca.`);
  } catch (error) {
    setStatus(error?.message || "No se pudo anadir esa imagen.");
  }
}

function renderMediaLibrary() {
  if (!mediaLibraryGrid) {
    return;
  }

  const items = mediaLibrary.list();
  mediaLibraryGrid.innerHTML = items.length ? items.map((item) => `
    <article class="media-library-card">
      <img src="${escapeAttr(item.url)}" alt="${escapeAttr(item.name)}" loading="lazy">
      <div>
        <strong>${escapeHtml(item.name)}</strong>
        <span>${renderMediaDetails(item)}</span>
        <input data-media-alt="${escapeAttr(item.id)}" type="text" value="${escapeAttr(item.alt || "")}" placeholder="Texto alternativo">
      </div>
      <footer>
        <button type="button" data-media-action="hero" data-media-id="${escapeAttr(item.id)}">Portada</button>
        <button type="button" data-media-action="gallery" data-media-id="${escapeAttr(item.id)}">Galeria</button>
        <button type="button" data-media-action="metadata" data-media-id="${escapeAttr(item.id)}">Guardar alt</button>
        <button type="button" data-media-action="remove" data-media-id="${escapeAttr(item.id)}" aria-label="Eliminar ${escapeAttr(item.name)}">Eliminar</button>
      </footer>
    </article>
  `).join("") : '<p class="media-library-empty">Sube imagenes o guarda URLs para reutilizarlas en esta web.</p>';
}

function renderMediaDetails(item) {
  const source = item.url.startsWith("data:") ? "Subida local" : "URL externa";
  const dimensions = item.width && item.height ? `${item.width}x${item.height}` : "dimensiones pendientes";
  const weight = item.size ? `${Math.max(1, Math.round(item.size / 1000))} KB` : "";
  const warning = item.width && item.width < 800 ? " - resolucion baja" : "";
  const license = item.license ? `${item.license}` : "";
  return escapeHtml([source, dimensions, weight, license].filter(Boolean).join(" - ") + warning);
}

function bindSiteImageGenerator() {
  siteImageGenerateButton?.addEventListener("click", generateAndApplySiteImages);
  stockSiteImageButton?.addEventListener("click", loadSiteImageCandidates);
}

async function generateAndApplySiteImages() {
  if (!siteImageGenerateButton || siteImageGenerateButton.disabled) {
    return;
  }

  setSiteImageLoading(true, "Generando imagenes del negocio...");

  try {
    const result = await requestSiteImagePack(["hero", "servicios", "galeria", "contacto"]);
    const pack = buildSiteImagePack(result);

    if (!pack.hero && !pack.gallery.length) {
      throw new Error(siteImageWarning(result) || "No llegaron imagenes nuevas. Revisa las claves de imagenes.");
    }

    runQuickMutation(() => {
      applySiteImagePack(pack);
    }, `Pack visual aplicado: ${pack.total} imagenes.`);

    const added = saveSiteImageItems(pack.items);
    renderMediaLibrary();
    setSiteImageGenerateStatus(`${pack.total} imagenes aplicadas${added ? `, ${added} guardadas` : ""}.`);
    showSiteImageItemsInInspector(pack.items);
  } catch (error) {
    const message = error?.message || "No se pudo generar el pack visual.";
    setSiteImageGenerateStatus(message);
    setStatus(message);
  } finally {
    setSiteImageLoading(false);
  }
}

async function loadSiteImageCandidates() {
  if (!stockImageResults || stockSiteImageButton?.disabled) {
    return;
  }

  setSiteImageLoading(true, "Buscando pack del negocio...");
  renderStockImageStatus("Buscando imagenes del negocio...");
  stockImageResults.innerHTML = '<p class="stock-empty">Cargando pack visual...</p>';
  if (stockLoadMoreButton) {
    stockLoadMoreButton.hidden = true;
  }

  try {
    const result = await requestSiteImagePack(["hero", "servicios", "galeria", "contacto"]);
    const pack = buildSiteImagePack(result);

    if (!pack.items.length) {
      throw new Error(siteImageWarning(result) || "No llegaron imagenes nuevas. Revisa las claves de imagenes.");
    }

    showSiteImageItemsInInspector(pack.items);
    setSiteImageGenerateStatus(`${pack.items.length} candidatas del negocio.`);
  } catch (error) {
    const catalogItems = stockImageState.catalogItems || [];
    stockImageState = {
      ...stockImageState,
      loading: false,
      mode: catalogItems.length ? "catalog" : "search",
      items: catalogItems.length ? catalogItems : []
    };
    renderStockImages();
    const message = error?.message || "No se pudo cargar el pack del negocio.";
    renderStockImageStatus(message);
    setSiteImageGenerateStatus(message);
  } finally {
    setSiteImageLoading(false);
  }
}

async function requestSiteImagePack(sections) {
  const business = businessFromForm();
  const payload = {
    negocio: {
      nombre: business.name,
      tipo: business.category,
      descripcion: [business.description, business.tagline, business.conversionGoal].filter(Boolean).join(". "),
      ubicacion: business.location || business.address,
      colores: [business.accent].filter(Boolean),
      estilo_web: [
        business.designPack,
        business.artDirection,
        business.contentMode,
        business.typography,
        business.visualShape
      ].filter(Boolean).join(" "),
      secciones: sections,
      servicios: business.services,
      testimonios: business.testimonials,
      imageRatio: business.imageRatio,
      showGallery: business.showGallery,
      showTestimonials: business.showTestimonials,
      showMap: business.showMap
    }
  };

  const response = await fetch(apiUrl("/api/site-images"), {
    method: "POST",
    headers: apiHeaders({ json: true }),
    body: JSON.stringify(payload)
  });
  let result = {};

  try {
    result = await response.json();
  } catch (error) {
    result = {};
  }

  if (!response.ok) {
    throw new Error(result.error || "API de imagenes no disponible. Levanta el servidor con npm.cmd start.");
  }

  return result;
}

function buildSiteImagePack(result = {}) {
  const images = result.imagenes || {};
  const hero = toSiteImageItem(images.hero?.principal, "Portada", "hero", 0);
  const heroAlternatives = Array.isArray(images.hero?.alternativas)
    ? images.hero.alternativas.map((item, index) => toSiteImageItem(item, `Portada alternativa ${index + 1}`, "hero-alt", index)).filter(Boolean)
    : [];
  const services = Array.isArray(images.servicios)
    ? images.servicios.map((item, index) => toSiteImageItem(item, item.label || `Servicio ${index + 1}`, "servicios", index)).filter(Boolean)
    : [];
  const gallery = Array.isArray(images.galeria)
    ? images.galeria.map((item, index) => toSiteImageItem(item, `Galeria ${index + 1}`, "galeria", index)).filter(Boolean)
    : [];
  const contact = toSiteImageItem(images.contacto, "Contacto", "contacto", 0);
  const items = uniqueSiteImageItems([hero, ...heroAlternatives, ...services, ...gallery, contact].filter(Boolean));

  return {
    hero,
    gallery,
    items,
    total: items.length,
    warnings: Array.isArray(result.meta?.advertencias) ? result.meta.advertencias : []
  };
}

function applySiteImagePack(pack) {
  if (pack.hero?.url) {
    setValue("heroImage", pack.hero.url);
    mergeMediaMetadata(pack.hero.url, mediaMetadataFromSiteImage(pack.hero));
  }

  if (pack.gallery.length) {
    const galleryUrls = pack.gallery.map((item) => item.url).filter(Boolean).slice(0, 12);
    setValue("gallery", galleryUrls.join("\n"));
    setChecked("showGallery", true);
    pack.gallery.forEach((item) => {
      mergeMediaMetadata(item.url, mediaMetadataFromSiteImage(item));
    });
  }
}

function saveSiteImageItems(items) {
  let added = 0;
  items.forEach((item) => {
    try {
      const stored = mediaLibrary.add({
        name: item.title,
        url: item.url,
        alt: item.alt,
        license: item.license,
        sourceUrl: item.sourceUrl,
        provider: item.provider,
        creator: item.creator
      });
      mediaLibrary.update(stored.id, {
        name: item.title,
        alt: item.alt,
        license: item.license,
        sourceUrl: item.sourceUrl,
        provider: item.provider,
        creator: item.creator
      });
      added += 1;
    } catch (error) {
      // A full media library should not block applying the selected images.
    }
  });
  return added;
}

function showSiteImageItemsInInspector(items) {
  if (!stockImageResults || !items.length) {
    return;
  }
  stockImageState = {
    ...stockImageState,
    mode: "site",
    query: "",
    page: 1,
    loading: false,
    items,
    hasNext: false
  };
  renderStockImages();
  renderStockImageStatus(`${items.length} imagenes del negocio`);
}

function toSiteImageItem(image, title, section, index) {
  if (!image?.url) {
    return null;
  }

  const provider = providerLabel(image.fuente);
  const sourceUrl = normalizeOptionalUrl(image.source_url || image.url_original || image.url);
  const url = normalizeImage(image.url, "");
  const thumbnail = normalizeImage(image.url_thumb || image.url, url);

  if (!url) {
    return null;
  }

  return {
    id: `site-${section}-${index}-${slugify(url).slice(0, 42)}`,
    title: String(title || image.alt || "Imagen del negocio").slice(0, 120),
    creator: String(image.credito || "").replace(/^Foto de\s+/i, "").replace(/\s+en\s+\w+$/i, "").slice(0, 80),
    provider,
    license: providerLicense(image.fuente),
    sourceUrl,
    url,
    thumbnail,
    tags: [section, image.query_usada].filter(Boolean),
    alt: String(image.alt || title || "Imagen del negocio").slice(0, 180),
    focal: image.focal || "center center",
    category: "site",
    categoryLabel: "Pack negocio",
    generated: true,
    query: image.query_usada || ""
  };
}

function uniqueSiteImageItems(items) {
  const known = new Set();
  return items.filter((item) => {
    const key = String(item.url || "").split("?")[0];
    if (!key || known.has(key)) {
      return false;
    }
    known.add(key);
    return true;
  });
}

function mediaMetadataFromSiteImage(item) {
  return {
    alt: item.alt || item.title || "",
    position: item.focal || "center center",
    ...mediaCreditMetadata({
      ...item,
      creator: item.creator,
      provider: item.provider
    })
  };
}

function providerLabel(value) {
  const provider = String(value || "").toLowerCase();
  if (provider === "unsplash") return "Unsplash";
  if (provider === "pexels") return "Pexels";
  if (provider === "pixabay") return "Pixabay";
  return provider || "Banco de imagenes";
}

function providerLicense(value) {
  const provider = String(value || "").toLowerCase();
  if (provider === "unsplash") return "Unsplash License";
  if (provider === "pexels") return "Pexels License";
  if (provider === "pixabay") return "Pixabay License";
  return "";
}

function siteImageWarning(result = {}) {
  return Array.isArray(result.meta?.advertencias)
    ? result.meta.advertencias.find(Boolean)
    : "";
}

function setSiteImageLoading(loading, message = "") {
  if (siteImageGenerateButton) {
    siteImageGenerateButton.disabled = loading;
  }
  if (stockSiteImageButton) {
    stockSiteImageButton.disabled = loading;
  }
  if (message) {
    setSiteImageGenerateStatus(message);
  }
}

function setSiteImageGenerateStatus(message) {
  if (siteImageGenerateStatus) {
    siteImageGenerateStatus.textContent = message || "";
  }
}

function bindStockImageSearch() {
  if (!stockCategoryList || !stockSearchButton || !stockImageResults) {
    return;
  }

  stockCategoryList.innerHTML = [{ id: "all", label: "Todas" }, ...stockImageSearch.categories].map((category) => `
    <button type="button" data-stock-category="${escapeAttr(category.id)}">${escapeHtml(category.label)}</button>
  `).join("");

  stockCategoryList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stock-category]");
    if (!button) {
      return;
    }
    showStockImageCategory(button.dataset.stockCategory || "all");
    syncStockCategoryButtons();
  });

  stockSearchButton.addEventListener("click", () => {
    const query = String(stockSearchInput?.value || "").trim();
    if (!query) {
      showStockImageCategory(stockImageState.category);
      return;
    }
    stockImageState = {
      ...stockImageState,
      query,
      mode: "search",
      page: 1,
      items: []
    };
    loadStockImages({ replace: true });
  });

  stockSearchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      stockSearchButton.click();
    }
  });

  stockLoadMoreButton?.addEventListener("click", () => {
    stockImageState = {
      ...stockImageState,
      page: stockImageState.page + 1
    };
    loadStockImages({ replace: false });
  });

  stockImageResults.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stock-action][data-stock-id]");
    if (!button) {
      return;
    }
    const item = stockImageState.items.find((candidate) => candidate.id === button.dataset.stockId);
    if (!item) {
      return;
    }

    if (button.dataset.stockAction === "use") {
      selectStockImage(item);
    } else if (button.dataset.stockAction === "save") {
      saveStockImage(item);
    }
  });

  syncStockCategoryButtons();
}

function showStockImageCategory(category = "all") {
  if (stockSearchInput) {
    stockSearchInput.value = "";
  }
  stockImageState = {
    ...stockImageState,
    category,
    query: "",
    mode: "catalog",
    page: 1,
    items: stockImageState.catalogItems,
    hasNext: false
  };
  syncStockCategoryButtons();

  if (stockImageState.catalogItems.length) {
    renderStockImages();
    renderStockCatalogStatus();
  } else if (!stockImageState.loading) {
    loadStockImageCatalog();
  }
}

function syncStockCategoryButtons() {
  stockCategoryList?.querySelectorAll("[data-stock-category]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.stockCategory === stockImageState.category);
  });
}

async function loadStockImageCatalog() {
  if (!stockImageResults || stockImageState.loading) {
    return;
  }

  const builtInItems = Array.isArray(stockImageSearch.builtInItems) ? stockImageSearch.builtInItems : [];
  stockImageState = {
    ...stockImageState,
    mode: "catalog",
    loading: true,
    items: builtInItems,
    catalogItems: builtInItems,
    categoryCount: new Set(builtInItems.map((item) => item.category)).size
  };
  renderStockImages();
  renderStockImageStatus(builtInItems.length
    ? `${builtInItems.length} fotos profesionales incluidas`
    : "Preparando catalogo profesional...");
  if (stockLoadMoreButton) {
    stockLoadMoreButton.hidden = true;
  }

  if (builtInItems.length >= 200) {
    stockImageState = { ...stockImageState, loading: false };
    renderStockCatalogStatus();
    return;
  }

  try {
    const result = await stockImageSearch.discover({ minItems: 200, targetItems: 240 });
    const items = mergeStockImageItems(builtInItems, result.items, 240);
    stockImageState = {
      ...stockImageState,
      loading: false,
      mode: "catalog",
      page: 1,
      items,
      catalogItems: items,
      categoryCount: new Set(items.map((item) => item.category)).size,
      hasNext: false
    };
    renderStockImages();
    renderStockCatalogStatus();
  } catch (error) {
    stockImageState = {
      ...stockImageState,
      loading: false,
      mode: "catalog",
      items: builtInItems,
      catalogItems: builtInItems,
      categoryCount: new Set(builtInItems.map((item) => item.category)).size,
      hasNext: false
    };
    renderStockImages();
    renderStockImageStatus(builtInItems.length
      ? `${builtInItems.length} fotos incluidas · ampliacion online temporalmente limitada`
      : "Banco de imagenes temporalmente no disponible");
  }
}

async function loadStockImages({ replace = true } = {}) {
  if (!stockImageResults || stockImageState.loading) {
    return;
  }

  stockImageState = { ...stockImageState, mode: "search", loading: true };
  renderStockImageStatus("Buscando imagenes libres...");
  if (replace) {
    stockImageResults.innerHTML = '<p class="stock-empty">Cargando imagenes libres...</p>';
    if (stockLoadMoreButton) {
      stockLoadMoreButton.hidden = true;
    }
  }

  try {
    const result = await stockImageSearch.search(stockImageState);
    const knownUrls = new Set(replace ? [] : stockImageState.items.map((item) => item.url));
    const items = result.items.filter((item) => !knownUrls.has(item.url));
    stockImageState = {
      ...stockImageState,
      loading: false,
      page: result.page,
      items: replace ? items : [...stockImageState.items, ...items],
      hasNext: result.hasNext
    };
    renderStockImages();
    renderStockImageStatus(`${stockImageState.items.length} de ${result.total || "muchas"} imagenes libres`);
  } catch (error) {
    const catalogItems = stockImageState.catalogItems || [];
    stockImageState = {
      ...stockImageState,
      loading: false,
      mode: catalogItems.length ? "catalog" : "search",
      items: catalogItems.length ? catalogItems : []
    };
    renderStockImages();
    if (stockLoadMoreButton) {
      stockLoadMoreButton.hidden = true;
    }
    renderStockImageStatus(catalogItems.length
      ? "Busqueda online limitada · mostrando seleccion incluida"
      : "Banco de imagenes temporalmente no disponible");
  }
}

function mergeStockImageItems(primary, secondary, limit = 240) {
  const known = new Set();
  return [...primary, ...secondary].filter((item) => {
    if (!item?.url || known.has(item.url)) {
      return false;
    }
    known.add(item.url);
    return true;
  }).slice(0, limit);
}

function renderStockImages() {
  if (!stockImageResults) {
    return;
  }

  const items = visibleStockImages();
  stockImageResults.innerHTML = items.length ? items.map((item) => `
    <article class="stock-image-card">
      <button type="button" data-stock-action="use" data-stock-id="${escapeAttr(item.id)}" aria-label="Usar ${escapeAttr(item.title)}">
        <img src="${escapeAttr(item.thumbnail)}" alt="${escapeAttr(item.alt || item.title)}" loading="lazy" decoding="async">
      </button>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <span>${escapeHtml([item.categoryLabel, item.license, item.provider].filter(Boolean).join(" - "))}</span>
      </div>
      <footer>
        <button type="button" data-stock-action="use" data-stock-id="${escapeAttr(item.id)}">Usar</button>
        <button type="button" data-stock-action="save" data-stock-id="${escapeAttr(item.id)}">Guardar</button>
      </footer>
    </article>
  `).join("") : '<p class="stock-empty">No hay resultados en esta categoria.</p>';

  if (stockLoadMoreButton) {
    stockLoadMoreButton.hidden = !stockImageState.hasNext;
  }
}

function visibleStockImages() {
  if (stockImageState.mode !== "catalog" || stockImageState.category === "all") {
    return stockImageState.items;
  }
  return stockImageState.catalogItems.filter((item) => item.category === stockImageState.category);
}

function renderStockCatalogStatus() {
  const visible = visibleStockImages();
  const category = stockImageSearch.categories.find((item) => item.id === stockImageState.category);
  if (category) {
    renderStockImageStatus(`${visible.length} de ${category.label} · ${stockImageState.catalogItems.length} en total`);
    return;
  }
  renderStockImageStatus(`${stockImageState.catalogItems.length} fotos · ${stockImageState.categoryCount} colecciones`);
}

function selectStockImage(item) {
  selectedStockImage = item;
  previewInspectorImageUrl.value = item.url;
  previewInspectorImageAlt.value = item.alt || item.title || "";
  if (item.focal && previewInspectorImagePosition) {
    previewInspectorImagePosition.value = item.focal;
  }
  previewInspectorImage.src = item.url;
  renderStockImageStatus(`${item.license} seleccionado`);
}

function saveStockImage(item) {
  try {
    const stored = mediaLibrary.add({
      name: item.title,
      url: item.url,
      alt: item.alt,
      license: item.license,
      sourceUrl: item.sourceUrl,
      provider: item.provider,
      creator: item.creator
    });
    mediaLibrary.update(stored.id, {
      name: item.title,
      alt: item.alt,
      license: item.license,
      sourceUrl: item.sourceUrl,
      provider: item.provider,
      creator: item.creator
    });
    renderMediaLibrary();
    renderStockImageStatus(`Guardada: ${stored.name}`);
    setStatus(`"${stored.name}" disponible en la biblioteca.`);
  } catch (error) {
    setStatus(error?.message || "No se pudo guardar esa imagen.");
  }
}

function resolveImageCreditMetadata(url) {
  if (selectedStockImage?.url === url) {
    return mediaCreditMetadata(selectedStockImage);
  }
  return mediaCreditMetadata(mediaLibrary.list().find((item) => item.url === url));
}

function mediaCreditMetadata(item = {}) {
  return Object.fromEntries(Object.entries({
    license: item.license,
    sourceUrl: item.sourceUrl,
    provider: item.provider,
    creator: item.creator
  }).filter(([, value]) => String(value || "").trim()));
}

function renderStockImageStatus(message) {
  if (stockImageStatus) {
    stockImageStatus.textContent = message;
  }
}

function bindDirectEditing() {
  directEditButton?.addEventListener("click", () => {
    toggleDirectEditing();
  });
  document.querySelector("#previewInspectorClose")?.addEventListener("click", closePreviewInspector);
  document.querySelector("#previewInspectorImageApply")?.addEventListener("click", applyPreviewImageEdit);
  document.querySelector("#previewInspectorLinkApply")?.addEventListener("click", applyPreviewLinkEdit);
  document.querySelector("#previewInspectorTextApply")?.addEventListener("click", applyPreviewTextStyle);
  document.querySelector("#previewInspectorTextReset")?.addEventListener("click", resetPreviewTextStyle);
  [
    previewInspectorTextColor,
    previewInspectorTextOpacity,
    previewInspectorTextSize,
    previewInspectorTextWeight,
    previewInspectorTextItalic,
    previewInspectorTextLetterSpacing
  ].forEach((field) => field?.addEventListener("input", updatePreviewTextSample));
  previewInspectorImageUrl?.addEventListener("input", () => {
    selectedStockImage = null;
    previewInspectorImage.src = previewInspectorImageUrl.value;
  });
  previewInspectorMedia?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-inspector-media-id]");
    const item = mediaLibrary.list().find((candidate) => candidate.id === button?.dataset.inspectorMediaId);
    if (!item) {
      return;
    }
    selectedStockImage = null;
    previewInspectorImageUrl.value = item.url;
    previewInspectorImageAlt.value = item.alt || item.name;
    previewInspectorImage.src = item.url;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && previewInspector && !previewInspector.hidden) {
      closePreviewInspector();
    }
  });

  sitePreview?.addEventListener("click", (event) => {
    if (!directEditEnabled) {
      return;
    }

    const sectionAction = event.target.closest("[data-preview-section-action]");
    if (sectionAction) {
      event.preventDefault();
      event.stopPropagation();
      handlePreviewSectionAction(sectionAction);
      return;
    }

    const itemAction = event.target.closest("[data-preview-item-action]");
    if (itemAction) {
      event.preventDefault();
      event.stopPropagation();
      handlePreviewItemAction(itemAction);
      return;
    }

    const image = event.target.closest("[data-edit-image-field], [data-edit-image-list]");
    if (image) {
      event.preventDefault();
      event.stopPropagation();
      openPreviewImageInspector(image);
      return;
    }

    const link = event.target.closest("[data-edit-link-field], [data-edit-link-list]");
    if (link) {
      event.preventDefault();
      event.stopPropagation();
      openPreviewLinkInspector(link);
      return;
    }

    const button = event.target.closest("[data-edit-button-style]");
    if (button) {
      event.preventDefault();
      event.stopPropagation();
      openPreviewButtonInspector(button);
      return;
    }

    const editable = event.target.closest("[data-edit-field], [data-edit-list]");
    if (!editable || !sitePreview.contains(editable)) {
      return;
    }
    if (activePreviewEdit?.element === editable) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (activePreviewEdit) {
      return;
    }
    beginPreviewEdit(editable);
  }, true);
}

function toggleDirectEditing(force) {
  directEditEnabled = typeof force === "boolean" ? force : !directEditEnabled;
  if (!directEditEnabled && activePreviewEdit) {
    activePreviewEdit.cancel();
  }
  if (!directEditEnabled) {
    closePreviewInspector();
  }
  sitePreview?.classList.toggle("is-direct-edit", directEditEnabled);
  directEditButton?.classList.toggle("is-active", directEditEnabled);
  directEditButton?.setAttribute("aria-pressed", String(directEditEnabled));
  setStatus(directEditEnabled
    ? "Edicion directa activa. Edita textos, imagenes, enlaces, botones o el orden de las secciones."
    : "Edicion directa cerrada.");
}

function openPreviewImageInspector(element) {
  const business = businessFromForm();
  const field = element.dataset.editImageField || "";
  const list = element.dataset.editImageList || "";
  const index = Number(element.dataset.editIndex || 0);
  const url = field ? business[field] : business[list]?.[index];
  const metadata = business.mediaMetadata?.[url] || {};

  selectedStockImage = null;
  previewInspectorTarget = { type: "image", field, list, index, originalUrl: url };
  previewInspectorTitle.textContent = field === "heroImage" ? "Imagen de portada" : `Imagen ${index + 1} de galeria`;
  previewInspectorImage.src = url || "";
  previewInspectorImageUrl.value = url || "";
  previewInspectorImageAlt.value = metadata.alt || element.alt || "";
  previewInspectorImagePosition.value = metadata.position || "center center";
  previewInspectorMedia.innerHTML = mediaLibrary.list().map((item) => `
    <button type="button" data-inspector-media-id="${escapeAttr(item.id)}" title="${escapeAttr(item.name)}">
      <img src="${escapeAttr(item.url)}" alt="">
    </button>
  `).join("") || "<span>No hay imagenes guardadas todavia.</span>";
  syncStockCategoryButtons();
  if (stockImageState.items.length) {
    renderStockImages();
    if (stockImageState.mode === "catalog") {
      renderStockCatalogStatus();
    }
  } else if (stockImageState.mode === "catalog") {
    loadStockImageCatalog();
  } else {
    loadStockImages({ replace: true });
  }
  showPreviewInspector("image");
}

function applyPreviewImageEdit() {
  if (previewInspectorTarget?.type !== "image") {
    return;
  }
  const target = { ...previewInspectorTarget };
  const url = normalizeImage(previewInspectorImageUrl.value, target.originalUrl);
  if (!url) {
    setStatus("La imagen necesita una URL valida.");
    return;
  }

  runQuickMutation(() => {
    if (target.field) {
      setValue(target.field, url);
    } else {
      const gallery = parseLines(form.elements[target.list]?.value);
      gallery[target.index] = url;
      setValue(target.list, gallery.filter(Boolean).slice(0, 12).join("\n"));
    }
    mergeMediaMetadata(url, {
      alt: previewInspectorImageAlt.value,
      position: previewInspectorImagePosition.value,
      ...resolveImageCreditMetadata(url)
    });
  }, "Imagen actualizada desde la preview.");
  selectedStockImage = null;
  closePreviewInspector();
}

function openPreviewLinkInspector(element) {
  const business = businessFromForm();
  const field = element.dataset.editLinkField || "";
  const list = element.dataset.editLinkList || "";
  const index = Number(element.dataset.editIndex || 0);
  const item = list ? business[list]?.[index] : null;
  const values = field === "booking"
    ? { label: business.bookingLabel, url: business.bookingUrl }
    : field === "phone"
      ? { label: "Llamar", url: business.phone }
      : field === "email"
        ? { label: "Email", url: business.email }
        : { label: item?.label || element.textContent, url: item?.url || element.href };

  const buttonStyle = field === "booking" || element.dataset.editButtonStyle === "primary"
    ? "primary"
    : "";
  previewInspectorTarget = { type: "link", field, list, index, buttonStyle };
  previewInspectorTitle.textContent = field === "booking" ? "Boton principal" : "Enlace";
  previewInspectorLinkLabel.value = values.label || "";
  previewInspectorLinkLabel.disabled = ["phone", "email"].includes(field);
  previewInspectorLinkUrl.disabled = false;
  previewInspectorLinkUrl.value = values.url || "";
  previewButtonStyleEditor.configure(element, {
    styleKey: buttonStyle,
    targetType: "link",
    label: values.label
  });
  showPreviewInspector("link");
}

function openPreviewButtonInspector(element) {
  const styleKey = element.dataset.editButtonStyle || "";
  if (styleKey !== "primary") {
    return;
  }
  previewInspectorTarget = { type: "button", buttonStyle: styleKey };
  previewInspectorTitle.textContent = "Botones principales";
  previewInspectorLinkLabel.disabled = true;
  previewInspectorLinkUrl.disabled = true;
  previewButtonStyleEditor.configure(element, {
    styleKey,
    targetType: "button",
    label: element.textContent
  });
  showPreviewInspector("link");
}

function applyPreviewLinkEdit() {
  if (!previewInspectorTarget || !["link", "button"].includes(previewInspectorTarget.type)) {
    return;
  }
  const target = { ...previewInspectorTarget };
  const label = previewInspectorLinkLabel.value.trim();
  const url = previewInspectorLinkUrl.value.trim();
  if (target.type === "link" && (!url || (!label && !["phone", "email"].includes(target.field)))) {
    setStatus("El enlace necesita texto y destino.");
    return;
  }

  runQuickMutation(() => {
    if (target.type === "link" && target.field === "booking") {
      setValue("bookingLabel", label);
      setValue("bookingUrl", normalizeUrl(url));
      setChecked("showBooking", true);
    } else if (target.type === "link" && (target.field === "phone" || target.field === "email")) {
      setValue(target.field, url);
    } else if (target.type === "link" && target.list === "links") {
      const currentLinks = businessFromForm().links;
      const links = (currentLinks.length ? currentLinks : demoBusiness.links).map((item) => ({ ...item }));
      links[target.index] = { label, url: normalizeUrl(url) };
      setValue("links", links.map((item) => `${item.label} | ${item.url}`).join("\n"));
    }
    if (target.buttonStyle === "primary") {
      const styles = readButtonStyles(form.elements.buttonStyles?.value);
      styles.primary = previewButtonStyleEditor.value();
      setValue("buttonStyles", JSON.stringify(normalizeButtonStyles(styles)));
    }
  }, target.buttonStyle === "primary"
    ? "Botones principales actualizados desde la preview."
    : "Enlace actualizado desde la preview.");
  closePreviewInspector();
}

function resetPreviewButtonStyle() {
  if (previewInspectorTarget?.buttonStyle !== "primary") {
    return;
  }
  runQuickMutation(() => {
    const styles = readButtonStyles(form.elements.buttonStyles?.value);
    delete styles.primary;
    setValue("buttonStyles", JSON.stringify(normalizeButtonStyles(styles)));
  }, "Estilo de botones restablecido al del tema.");
  closePreviewInspector();
}

function openPreviewTextInspector(element, options = {}) {
  const key = getPreviewTextStyleKey(element);
  if (!key) {
    return;
  }
  const styles = readTextStyles(form.elements.textStyles?.value);
  const style = styles[key] || {};
  const computed = window.getComputedStyle(element);

  previewInspectorTarget = {
    type: "text",
    key,
    label: getPreviewTextLabel(element)
  };
  previewInspectorTitle.textContent = previewInspectorTarget.label;
  previewInspectorTextSample.textContent = element.textContent.trim() || "Texto seleccionado";
  previewInspectorTextColor.value = normalizeColor(style.color) || rgbToHex(computed.color) || "#111111";
  previewInspectorTextOpacity.value = Math.round((style.opacity ?? Number(computed.opacity || 1)) * 100);
  previewInspectorTextSize.value = Math.round((style.size || 1) * 100);
  previewInspectorTextWeight.value = style.weight || "default";
  previewInspectorTextItalic.value = style.italic ? "italic" : "normal";
  previewInspectorTextLetterSpacing.value = Math.round((style.letterSpacing || 0) * 100);
  updatePreviewTextSample();
  showPreviewInspector("text", { focus: options.focus ?? true });
}

function applyPreviewTextStyle() {
  if (previewInspectorTarget?.type !== "text") {
    return;
  }
  const key = previewInspectorTarget.key;
  const nextStyle = normalizeTextStyle({
    color: previewInspectorTextColor.value,
    opacity: Number(previewInspectorTextOpacity.value || 100) / 100,
    size: Number(previewInspectorTextSize.value || 100) / 100,
    weight: previewInspectorTextWeight.value,
    italic: previewInspectorTextItalic.value === "italic",
    letterSpacing: Number(previewInspectorTextLetterSpacing.value || 0) / 100
  });

  runQuickMutation(() => {
    const styles = readTextStyles(form.elements.textStyles?.value);
    styles[key] = nextStyle;
    setValue("textStyles", JSON.stringify(normalizeTextStyles(styles)));
  }, "Estilo de texto aplicado desde la preview.");
  closePreviewInspector();
}

function resetPreviewTextStyle() {
  if (previewInspectorTarget?.type !== "text") {
    return;
  }
  const key = previewInspectorTarget.key;
  runQuickMutation(() => {
    const styles = readTextStyles(form.elements.textStyles?.value);
    delete styles[key];
    setValue("textStyles", JSON.stringify(normalizeTextStyles(styles)));
  }, "Estilo de texto restablecido.");
  closePreviewInspector();
}

function updatePreviewTextSample() {
  const style = normalizeTextStyle({
    color: previewInspectorTextColor?.value,
    opacity: Number(previewInspectorTextOpacity?.value || 100) / 100,
    size: Number(previewInspectorTextSize?.value || 100) / 100,
    weight: previewInspectorTextWeight?.value,
    italic: previewInspectorTextItalic?.value === "italic",
    letterSpacing: Number(previewInspectorTextLetterSpacing?.value || 0) / 100
  });
  applyTextStyleToElement(previewInspectorTextSample, style, "1rem");
  applyTextStyleToElement(findPreviewTextElement(previewInspectorTarget?.key), style, "var(--text-base-size, 1em)");
}

function findPreviewTextElement(key) {
  if (!key || !sitePreview || !window.CSS?.escape) {
    return null;
  }
  return sitePreview.querySelector(`[data-text-style-key="${CSS.escape(key)}"]`);
}

function applyTextStyleToElement(element, style, baseSize = "1em") {
  if (!element) {
    return;
  }
  element.style.color = style.color || "";
  element.style.opacity = style.opacity ? String(style.opacity) : "";
  element.style.fontSize = style.size ? `calc(${baseSize} * ${style.size})` : "";
  element.style.fontWeight = style.weight || "";
  element.style.fontStyle = style.italic ? "italic" : "";
  element.style.letterSpacing = style.letterSpacing ? `${style.letterSpacing}em` : "";
}

function showPreviewInspector(panel, options = {}) {
  previewInspector.hidden = false;
  previewInspector.querySelectorAll("[data-inspector-panel]").forEach((element) => {
    element.hidden = element.dataset.inspectorPanel !== panel;
  });
  if (options.focus === false) {
    return;
  }
  requestAnimationFrame(() => {
    previewInspector.querySelector(`[data-inspector-panel="${panel}"] input:not(:disabled), [data-inspector-panel="${panel}"] select:not(:disabled)`)?.focus();
  });
}

function closePreviewInspector() {
  previewInspectorTarget = null;
  if (previewInspector) {
    previewInspector.hidden = true;
  }
}

function attachPreviewSectionControls() {
  const order = normalizeSectionOrder(form.elements.sectionOrder?.value, DEFAULT_SECTION_ORDER);
  sitePreview.querySelectorAll("[data-section-key]").forEach((section) => {
    const key = section.dataset.sectionKey;
    const baseKey = sectionBaseKey(key);
    const definition = SECTION_DEFINITIONS[baseKey];
    if (!definition || section.querySelector(":scope > .preview-section-controls")) {
      return;
    }
    const index = order.indexOf(key);
    const controls = document.createElement("div");
    controls.className = "preview-section-controls";
    controls.innerHTML = `
      <strong>${escapeHtml(sectionInstanceLabel(key))}</strong>
      ${PREVIEW_SECTION_LISTS[baseKey] ? `<button type="button" data-preview-section-action="add-item" data-section-key="${escapeAttr(key)}">Anadir</button>` : ""}
      <button type="button" data-preview-section-action="duplicate" data-section-key="${escapeAttr(key)}">Duplicar</button>
      <button type="button" data-preview-section-action="up" data-section-key="${escapeAttr(key)}" ${index <= 0 ? "disabled" : ""}>Subir</button>
      <button type="button" data-preview-section-action="down" data-section-key="${escapeAttr(key)}" ${index < 0 || index >= order.length - 1 ? "disabled" : ""}>Bajar</button>
      ${key.includes("__copy") ? `<button type="button" data-preview-section-action="remove" data-section-key="${escapeAttr(key)}">Eliminar</button>` : ""}
      ${definition.field ? `<button type="button" data-preview-section-action="hide" data-section-key="${escapeAttr(key)}">Ocultar</button>` : ""}
    `;
    section.prepend(controls);
  });
}

function handlePreviewSectionAction(button) {
  const section = button.dataset.sectionKey;
  const baseKey = sectionBaseKey(section);
  if (button.dataset.previewSectionAction === "add-item") {
    addPreviewItemForSection(section);
  } else if (button.dataset.previewSectionAction === "duplicate") {
    duplicateSection(section);
  } else if (button.dataset.previewSectionAction === "up") {
    moveSection(section, -1);
  } else if (button.dataset.previewSectionAction === "down") {
    moveSection(section, 1);
  } else if (button.dataset.previewSectionAction === "remove") {
    removeSectionInstance(section);
  } else if (button.dataset.previewSectionAction === "hide") {
    const field = SECTION_DEFINITIONS[baseKey]?.field;
    if (field) {
      toggleQuickField(field);
    }
  }
}

function attachPreviewItemControls() {
  const seen = new Set();
  sitePreview.querySelectorAll("[data-edit-list]").forEach((element) => {
    const list = element.dataset.editList;
    const index = Number(element.dataset.editIndex || 0);
    const key = `${list}:${index}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    const container = element.closest(".service-card, .feature-card, .testimonial-card, .faq-item");
    attachPreviewItemControl(container, list, index);
  });

  sitePreview.querySelectorAll(".gallery-item:not(.is-gallery-clone) [data-edit-image-list='gallery']").forEach((element) => {
    const index = Number(element.dataset.editIndex || 0);
    attachPreviewItemControl(element.closest(".gallery-item"), "gallery", index);
  });
}

function attachPreviewItemControl(container, list, index) {
  if (!container || container.querySelector(":scope > .preview-item-controls")) {
    return;
  }

  const total = getEditableListItems(list).length;
  const controls = document.createElement("div");
  controls.className = "preview-item-controls";
  controls.innerHTML = `
    <span>${escapeHtml(previewListLabel(list))} ${index + 1}</span>
    <button type="button" data-preview-item-action="up" data-preview-item-list="${escapeAttr(list)}" data-preview-item-index="${index}" ${index <= 0 ? "disabled" : ""}>Subir</button>
    <button type="button" data-preview-item-action="down" data-preview-item-list="${escapeAttr(list)}" data-preview-item-index="${index}" ${index >= total - 1 ? "disabled" : ""}>Bajar</button>
    <button type="button" data-preview-item-action="duplicate" data-preview-item-list="${escapeAttr(list)}" data-preview-item-index="${index}" ${total >= previewListMax(list) ? "disabled" : ""}>Duplicar</button>
    <button type="button" data-preview-item-action="delete" data-preview-item-list="${escapeAttr(list)}" data-preview-item-index="${index}" ${total <= 1 ? "disabled" : ""}>Borrar</button>
  `;

  if (container.matches("details")) {
    container.insertBefore(controls, container.children[1] || null);
  } else {
    container.prepend(controls);
  }
}

function handlePreviewItemAction(button) {
  const list = button.dataset.previewItemList;
  const index = Number(button.dataset.previewItemIndex || 0);
  const action = button.dataset.previewItemAction;
  mutatePreviewList(list, (items) => {
    if (action === "up" && index > 0) {
      [items[index - 1], items[index]] = [items[index], items[index - 1]];
    } else if (action === "down" && index < items.length - 1) {
      [items[index], items[index + 1]] = [items[index + 1], items[index]];
    } else if (action === "duplicate" && items.length < previewListMax(list)) {
      items.splice(index + 1, 0, cloneData(items[index]));
    } else if (action === "delete" && items.length > 1) {
      items.splice(index, 1);
    }
  }, previewItemActionLabel(action, list));
}

function addPreviewItemForSection(section) {
  const list = PREVIEW_SECTION_LISTS[sectionBaseKey(section)];
  if (!list) {
    return;
  }

  mutatePreviewList(list, (items) => {
    if (items.length < previewListMax(list)) {
      items.push(createPreviewListItem(list));
    }
  }, `${previewListLabel(list)} anadido desde la preview.`);
}

function duplicateSection(section) {
  const baseKey = sectionBaseKey(section);
  if (!SECTION_DEFINITIONS[baseKey]) {
    return;
  }

  const order = normalizeSectionOrder(form.elements.sectionOrder?.value, DEFAULT_SECTION_ORDER);
  const sourceIndex = order.indexOf(section);
  const copyCount = order.filter((key) => sectionBaseKey(key) === baseKey && key.includes("__copy")).length;
  if (copyCount >= 2) {
    setStatus("Limite alcanzado: maximo dos copias por tipo de seccion.");
    return;
  }

  const copyKey = nextSectionCopyKey(order, baseKey);
  runQuickMutation(() => {
    const nextOrder = [...order];
    nextOrder.splice(sourceIndex >= 0 ? sourceIndex + 1 : order.length, 0, copyKey);
    setValue("sectionOrder", nextOrder.join(","));
    const field = SECTION_DEFINITIONS[baseKey]?.field;
    if (field) {
      setChecked(field, true);
    }
  }, `${SECTION_DEFINITIONS[baseKey].label} duplicada.`);
}

function removeSectionInstance(section) {
  if (!String(section || "").includes("__copy")) {
    return;
  }
  const order = normalizeSectionOrder(form.elements.sectionOrder?.value, DEFAULT_SECTION_ORDER);
  if (!order.includes(section)) {
    return;
  }

  runQuickMutation(() => {
    setValue("sectionOrder", order.filter((key) => key !== section).join(","));
  }, `${sectionInstanceLabel(section)} eliminada.`);
}

function nextSectionCopyKey(order, baseKey) {
  let index = 1;
  const used = new Set(order);
  while (used.has(`${baseKey}__copy${index}`)) {
    index += 1;
  }
  return `${baseKey}__copy${index}`;
}

function sectionInstanceLabel(key) {
  const baseKey = sectionBaseKey(key);
  const label = SECTION_DEFINITIONS[baseKey]?.label || baseKey;
  const match = String(key || "").match(/__copy(\d+)$/);
  return match ? `${label} copia ${match[1]}` : label;
}

function mutatePreviewList(list, mutator, message) {
  const items = getEditableListItems(list);
  const before = JSON.stringify(items);
  mutator(items);
  const next = items.slice(0, previewListMax(list));
  if (JSON.stringify(next) === before) {
    setStatus("No se pudo aplicar ese cambio en la lista.");
    return;
  }

  runQuickMutation(() => {
    setEditableListItems(list, next);
    const visibilityField = previewListVisibilityField(list);
    if (visibilityField) {
      setChecked(visibilityField, true);
    }
  }, message);
}

function getEditableListItems(list, business = businessFromForm()) {
  if (list === "testimonials" || list === "faqs") {
    return (business[list] || []).map((item) => ({ ...item }));
  }
  return [...(business[list] || [])];
}

function setEditableListItems(list, items) {
  if (list === "testimonials") {
    setValue("testimonials", items.map((item) => `${item.name} | ${item.text}`).join("\n"));
  } else if (list === "faqs") {
    setValue("faqs", items.map((item) => `${item.question} | ${item.answer}`).join("\n"));
  } else {
    setValue(list, items.join("\n"));
  }
}

function createPreviewListItem(list) {
  const business = businessFromForm();
  const firstMedia = mediaLibrary.list()[0]?.url;
  return {
    services: "Nuevo servicio: Describe que incluye y para quien es.",
    features: "Nuevo diferencial: Explica por que el cliente deberia elegirte.",
    gallery: firstMedia || business.heroImage || demoBusiness.gallery[0],
    testimonials: { name: "Nuevo cliente", text: "Escribe aqui una resena breve y creible." },
    faqs: { question: "Nueva pregunta frecuente", answer: "Escribe una respuesta clara y util." }
  }[list];
}

function previewListMax(list) {
  return {
    services: 9,
    features: 8,
    gallery: 12,
    testimonials: 6,
    faqs: 8
  }[list] || 8;
}

function previewListLabel(list) {
  return {
    services: "Servicio",
    features: "Diferencial",
    gallery: "Foto",
    testimonials: "Resena",
    faqs: "FAQ"
  }[list] || "Elemento";
}

function previewListVisibilityField(list) {
  return {
    gallery: "showGallery",
    testimonials: "showTestimonials",
    faqs: "showFaq"
  }[list] || "";
}

function previewItemActionLabel(action, list) {
  const label = previewListLabel(list).toLowerCase();
  return {
    up: `${previewListLabel(list)} movido arriba.`,
    down: `${previewListLabel(list)} movido abajo.`,
    duplicate: `${previewListLabel(list)} duplicado.`,
    delete: `${previewListLabel(list)} eliminado.`
  }[action] || `${label} actualizado.`;
}

function beginPreviewEdit(element) {
  const originalValue = getPreviewEditValue(element, businessFromForm());
  element.textContent = originalValue;
  element.removeAttribute("data-splitting");
  element.classList.remove("splitting");
  element.setAttribute("contenteditable", "true");
  element.setAttribute("spellcheck", "true");
  element.classList.add("is-editing");
  element.focus();
  selectElementText(element);

  let finished = false;
  const cleanup = () => {
    element.removeEventListener("blur", commit);
    element.removeEventListener("keydown", onKeydown);
    activePreviewEdit = null;
  };
  const cancel = () => {
    if (finished) return;
    finished = true;
    cleanup();
    renderFromForm();
    setStatus("Edicion directa cancelada.");
  };
  const commit = () => {
    if (finished) return;
    finished = true;
    const value = element.textContent.replace(/\s+/g, " ").trim();
    cleanup();
    if (!value || value === originalValue) {
      renderFromForm();
      setStatus(value ? "El texto no cambio." : "El texto no puede quedar vacio.");
      return;
    }
    commitPreviewEdit(element, value);
  };
  const onKeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    } else if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      element.blur();
    }
  };

  activePreviewEdit = { element, commit, cancel };
  element.addEventListener("blur", commit);
  element.addEventListener("keydown", onKeydown);
  openPreviewTextInspector(element, { focus: false });
}

function getPreviewEditValue(element, business) {
  if (element.dataset.editField) {
    return String(business[element.dataset.editField] || element.textContent || "");
  }

  const list = business[element.dataset.editList] || [];
  const item = list[Number(element.dataset.editIndex || 0)];
  if (typeof item === "string") {
    return String(splitTitleBody(item)[element.dataset.editPart] || "");
  }
  return String(item?.[element.dataset.editPart] || "");
}

function commitPreviewEdit(element, value) {
  editorHistory.record(businessFromForm());
  if (element.dataset.editField) {
    setValue(element.dataset.editField, value);
  } else {
    updatePreviewListField(element, value);
  }
  renderFromForm();
  updateHistoryButtons();
  setStatus("Texto actualizado desde la preview.");
}

function updatePreviewListField(element, value) {
  const field = element.dataset.editList;
  const index = Number(element.dataset.editIndex || 0);
  const part = element.dataset.editPart;
  const business = businessFromForm();

  if (field === "services" || field === "features") {
    const items = [...business[field]];
    const parts = splitTitleBody(items[index] || "");
    parts[part] = value;
    items[index] = parts.body ? `${parts.title}: ${parts.body}` : parts.title;
    setValue(field, items.join("\n"));
  } else if (field === "testimonials") {
    const items = business.testimonials.map((item) => ({ ...item }));
    items[index] = { ...items[index], [part]: value };
    setValue(field, items.map((item) => `${item.name} | ${item.text}`).join("\n"));
  } else if (field === "faqs") {
    const items = business.faqs.map((item) => ({ ...item }));
    items[index] = { ...items[index], [part]: value };
    setValue(field, items.map((item) => `${item.question} | ${item.answer}`).join("\n"));
  }
}

function getPreviewTextStyleKey(element) {
  if (element.dataset.textStyleKey) {
    return element.dataset.textStyleKey;
  }
  if (element.dataset.editField) {
    return `field:${element.dataset.editField}`;
  }
  if (element.dataset.editList) {
    return `list:${element.dataset.editList}:${Number(element.dataset.editIndex || 0)}:${element.dataset.editPart || "text"}`;
  }
  return "";
}

function getPreviewTextLabel(element) {
  if (element.dataset.editField) {
    return {
      name: "Nombre en logo",
      announcement: "Anuncio superior",
      tagline: "Titular principal",
      description: "Descripcion",
      conversionGoal: "Objetivo de conversion",
      servicesHeading: "Titular de servicios",
      servicesIntro: "Intro de servicios",
      trustHeading: "Titular de confianza",
      trustIntro: "Intro de confianza",
      contactHeading: "Titular de contacto",
      address: "Direccion"
    }[element.dataset.editField] || "Texto";
  }

  const listLabel = previewListLabel(element.dataset.editList || "").toLowerCase();
  const part = {
    title: "titulo",
    body: "texto",
    text: "texto",
    name: "autor",
    question: "pregunta",
    answer: "respuesta"
  }[element.dataset.editPart] || "texto";
  return `${listLabel || "Texto"} - ${part}`;
}

function selectElementText(element) {
  const selection = window.getSelection?.();
  if (!selection || !document.createRange) {
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

function bindPresentationMode() {
  presentationModeButton?.addEventListener("click", () => {
    togglePresentationMode();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("is-presentation")) {
      togglePresentationMode(false);
    }
  });
}

function bindIntroGate() {
  if (!introGate) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const skipIntro = ["1", "true", "yes"].includes(String(params.get("skipIntro") || "").toLowerCase());
  const presentationLaunch = ["1", "true", "yes"].includes(String(params.get("presentation") || "").toLowerCase());
  const automatedLaunch = navigator.webdriver === true;

  if (skipIntro || presentationLaunch || automatedLaunch) {
    introGate.hidden = true;
    document.body.classList.add("is-intro-complete");
    return;
  }

  document.body.classList.add("is-intro-active");

  const showDestinationHub = () => {
    if (!introHub) {
      enterStudio();
      return;
    }

    introHub.hidden = false;
    introGate.classList.add("is-choosing");
    introGate.querySelector(".intro-gate-content")?.setAttribute("aria-hidden", "true");
    (introHub.querySelector(".intro-destination-card") || introHub.querySelector("button"))?.focus({ preventScroll: true });
  };

  const showLogoIntro = () => {
    if (!introHub) {
      return;
    }

    introGate.classList.remove("is-choosing");
    introGate.querySelector(".intro-gate-content")?.removeAttribute("aria-hidden");
    window.setTimeout(() => {
      if (!introGate.classList.contains("is-choosing")) {
        introHub.hidden = true;
        introStartButton?.focus({ preventScroll: true });
      }
    }, 260);
  };

  const enterStudio = () => {
    if (introGate.hidden || introGate.classList.contains("is-closing")) {
      return;
    }

    introGate.classList.add("is-closing");
    document.body.classList.remove("is-intro-active");
    document.body.classList.add("is-intro-complete");

    let fallbackTimer = 0;
    const finish = () => {
      window.clearTimeout(fallbackTimer);
      introGate.hidden = true;
      document.querySelector("#studioWorkspace")?.focus({ preventScroll: true });
    };

    const finishOnAnimation = (event) => {
      if (event.target !== introGate) {
        return;
      }

      introGate.removeEventListener("animationend", finishOnAnimation);
      finish();
    };

    introGate.addEventListener("animationend", finishOnAnimation);
    fallbackTimer = window.setTimeout(finish, 900);
  };

  introStartButton?.addEventListener("click", showDestinationHub);
  introHubBackButton?.addEventListener("click", showLogoIntro);
  introHub?.querySelector('[data-intro-destination="studio"]')?.addEventListener("click", (event) => {
    event.preventDefault();
    enterStudio();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("is-intro-active")) {
      if (introGate.classList.contains("is-choosing")) {
        showLogoIntro();
        return;
      }

      showDestinationHub();
    }
  });
}

function applyLaunchView() {
  const params = new URLSearchParams(window.location.search);
  const requestedView = params.get("view");

  if (["desktop", "tablet", "mobile"].includes(requestedView)) {
    setDeviceSize(requestedView);
  }

  if (["1", "true", "yes"].includes(String(params.get("presentation") || "").toLowerCase())) {
    togglePresentationMode(true);
  }
}

function togglePresentationMode(force) {
  const nextState = typeof force === "boolean"
    ? force
    : !document.body.classList.contains("is-presentation");

  document.body.classList.toggle("is-presentation", nextState);
  presentationModeButton?.setAttribute("aria-pressed", String(nextState));
  setStatus(nextState ? "Modo presentacion activo. Pulsa Esc para volver al Studio." : "Modo presentacion cerrado.");
}

function bindActions() {
  document.querySelector("#saveButton").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;

    try {
      currentBusiness = businessFromForm();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentBusiness));
      draftStore.schedule(currentBusiness);
      draftStore.flush();
      setStatus("Datos guardados en este navegador. Sincronizando API local...");

      try {
        const record = await saveBusinessToApi(currentBusiness);
        currentBusinessRecord = toApiRecordMeta(record);
        storeApiRecord(currentBusinessRecord);
        setStatus(`Guardado local y API: ${record.name}.`);
      } catch (apiError) {
        setStatus("Datos guardados en navegador. API local no disponible; levanta npm.cmd start para sincronizar.");
      }
    } catch (error) {
      setStatus("No se pudo guardar. Revisa permisos del navegador o espacio disponible.");
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("#loadButton").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;

    try {
      const storedRecord = getStoredApiRecord();

      if (storedRecord) {
        try {
          applyBusinessRecord(await fetchBusinessFromApi(storedRecord.id || storedRecord.slug));
          setStatus("Datos cargados desde la API local.");
          return;
        } catch (apiError) {
          // If the local API is offline, keep the existing browser fallback useful.
        }
      }

      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        currentBusinessRecord = storedRecord;
        currentBusiness = normalizeImportedBusiness(JSON.parse(saved));
        fillForm(currentBusiness);
        syncSegmentedControls();
        syncDesignPackState();
        syncQuickToggleState();
        renderFromForm();
        setStatus("Datos cargados desde este navegador.");
        return;
      }

      try {
        applyBusinessRecord(await fetchFirstBusinessFromApi());
        setStatus("Demo cargada desde la API local.");
      } catch (apiError) {
        setStatus("No hay datos guardados todavia.");
      }
    } catch (error) {
      setStatus("No se pudieron cargar los datos guardados.");
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("#resetButton").addEventListener("click", () => {
    currentBusinessRecord = null;
    storeApiRecord(null);
    currentBusiness = cloneData(defaultSectorPreset);
    fillForm(currentBusiness);
    syncSegmentedControls();
    syncDesignPackState();
    syncQuickToggleState();
    renderFromForm();
    setStatus("Demo restaurada.");
  });

  prepareDeliveryButton?.addEventListener("click", () => {
    currentBusiness = businessFromForm();
    renderQualityPanel(currentBusiness);
    renderDeliveryReport(currentBusiness);
  });

  document.querySelector("#exportButton").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;

    try {
      currentBusiness = businessFromForm();
      const validation = validateBusiness(currentBusiness);
      if (!validation.ok) {
        renderQualityPanel(currentBusiness);
        setStatus(`Exportacion bloqueada: corrige ${validation.errors.length} error(es) de entrega.`);
        return;
      }
      setStatus("Preparando HTML completo con estilos, scripts y datos incrustados...");
      await downloadSite(currentBusiness);
      setStatus("HTML completo exportado. Listo para abrir o subir a hosting.");
    } catch (error) {
      setStatus("No se pudo exportar el HTML. La vista previa sigue disponible para corregir datos.");
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("#exportDataButton")?.addEventListener("click", () => {
    try {
      currentBusiness = businessFromForm();
      downloadBusinessData(currentBusiness);
      setStatus("Datos exportados en JSON para reutilizar o versionar.");
    } catch (error) {
      setStatus("No se pudieron exportar los datos.");
    }
  });

  document.querySelector("#exportPackageButton")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;

    try {
      currentBusiness = businessFromForm();
      const validation = validateBusiness(currentBusiness);
      if (!validation.ok) {
        renderQualityPanel(currentBusiness);
        renderDeliveryReport(currentBusiness);
        setStatus(`Paquete bloqueado: corrige ${validation.errors.length} error(es) de entrega.`);
        return;
      }
      setStatus("Preparando paquete con HTML, JSON, ficha de entrega y cambios...");
      await downloadDeliveryPackage(currentBusiness);
      setStatus("Paquete de entrega exportado. Incluye HTML, business.json, ficha y cambios.");
    } catch (error) {
      setStatus("No se pudo exportar el paquete. Revisa los datos y vuelve a intentarlo.");
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("#importDataButton")?.addEventListener("click", () => {
    importDataInput?.click();
  });

  importDataInput?.addEventListener("change", async () => {
    const [file] = importDataInput.files || [];

    if (!file) {
      return;
    }

    try {
      const imported = JSON.parse(await file.text());
      currentBusinessRecord = null;
      storeApiRecord(null);
      currentBusiness = normalizeImportedBusiness(imported);
      fillForm(currentBusiness);
      syncSegmentedControls();
      syncDesignPackState();
      syncQuickToggleState();
      renderFromForm();
      setStatus(`Datos importados: ${currentBusiness.name}.`);
    } catch (error) {
      setStatus("No se pudo importar el JSON. Revisa el formato.");
    } finally {
      importDataInput.value = "";
    }
  });
}

function bindCursor() {
  window.addEventListener("pointermove", (event) => {
    const x = `${Math.round((event.clientX / window.innerWidth) * 100)}%`;
    const y = `${Math.round((event.clientY / window.innerHeight) * 100)}%`;
    cursorGlow.style.setProperty("--cursor-x", x);
    cursorGlow.style.setProperty("--cursor-y", y);
  });
}

function fillForm(business) {
  const resolved = withBusinessDefaults(business);
  const chatbot = { ...demoBusiness.chatbot, ...(resolved.chatbot || {}) };
  const google = { ...demoBusiness.google, ...(resolved.google || {}) };
  const commerce = { ...demoBusiness.commerce, ...(resolved.commerce || {}) };
  setValue("name", resolved.name);
  setValue("category", resolved.category);
  setValue("location", resolved.location);
  setValue("tagline", resolved.tagline);
  setValue("description", resolved.description);
  setValue("conversionGoal", resolved.conversionGoal);
  setValue("announcement", resolved.announcement);
  setValue("phone", resolved.phone);
  setValue("email", resolved.email);
  setValue("address", resolved.address);
  setValue("services", resolved.services.join("\n"));
  setValue("features", resolved.features.join("\n"));
  setValue("hours", resolved.hours.join("\n"));
  setValue(
    "testimonials",
    resolved.testimonials.map((item) => `${item.name} | ${item.text}`).join("\n")
  );
  setValue("faqs", resolved.faqs.map((item) => `${item.question} | ${item.answer}`).join("\n"));
  setValue("trustBadges", resolved.trustBadges.join("\n"));
  setValue("heroImage", resolved.heroImage);
  setValue("gallery", resolved.gallery.join("\n"));
  setValue("links", resolved.links.map((item) => `${item.label} | ${item.url}`).join("\n"));
  setValue("servicesHeading", resolved.servicesHeading);
  setValue("servicesIntro", resolved.servicesIntro);
  setValue("trustHeading", resolved.trustHeading);
  setValue("trustIntro", resolved.trustIntro);
  setValue("contactHeading", resolved.contactHeading);
  setChecked("showLeadForm", resolved.showLeadForm);
  setValue("leadFormTitle", resolved.leadFormTitle);
  setValue("leadFormIntro", resolved.leadFormIntro);
  setValue("leadFormCta", resolved.leadFormCta);
  setValue("privacyUrl", resolved.privacyUrl);
  setValue("designPack", resolved.designPack);
  setRadio("artDirection", resolved.artDirection);
  setRadio("contentMode", resolved.contentMode);
  setValue("accent", resolved.accent);
  setValue("intensity", resolved.intensity);
  setValue("fontScale", resolved.fontScale);
  setValue("layoutScale", resolved.layoutScale);
  setValue("bookingUrl", resolved.bookingUrl);
  setValue("bookingLabel", resolved.bookingLabel);
  setChecked("premiumEffects", resolved.premiumEffects);
  setChecked("showBooking", resolved.showBooking);
  setRadio("theme", resolved.theme);
  setRadio("motion", resolved.motion);
  setRadio("typography", resolved.typography);
  setRadio("contentDensity", resolved.contentDensity);
  setRadio("visualShape", resolved.visualShape);
  setRadio("heroSize", resolved.heroSize);
  setRadio("contentWidth", resolved.contentWidth);
  setRadio("imageRatio", resolved.imageRatio);
  setChecked("showAnnouncement", resolved.showAnnouncement);
  setChecked("showResourceMarquee", resolved.showResourceMarquee);
  setChecked("showTrustRail", resolved.showTrustRail);
  setChecked("showGallery", resolved.showGallery);
  setChecked("showTestimonials", resolved.showTestimonials);
  setChecked("showFaq", resolved.showFaq);
  setChecked("showMap", resolved.showMap);
  setChecked("showConversionDock", resolved.showConversionDock);
  setChecked("showMenu", resolved.showMenu);
  setValue("menuTitle", resolved.menuTitle);
  setValue("menuIntro", resolved.menuIntro);
  setValue("menuCurrency", resolved.menuCurrency);
  setValue("menuItems", serializeMenuItems(resolved.menuItems));
  setChecked("googleEnabled", google.enabled);
  setValue("googleWorkspaceEmail", google.workspaceEmail);
  setValue("googleWorkspaceDomain", google.workspaceDomain);
  setValue("googleManagerEmail", google.managerEmail);
  setValue("googlePlaceId", google.placeId);
  setValue("googleMapsUrl", google.mapsUrl);
  setValue("mapEmbedUrl", google.mapEmbedUrl);
  setValue("directionsNote", google.directionsNote);
  setValue("googleReviewUrl", google.reviewUrl);
  setValue("googleReviewRequestTemplate", google.reviewRequestTemplate);
  setValue("googleAppointmentUrl", google.appointmentUrl);
  setValue("googleBookingRules", google.bookingRules);
  setValue("googleRating", google.rating);
  setValue("googleReviewCount", google.reviewCount);
  setValue("googleCalendarId", google.calendarId);
  setValue("googleBusinessProfileAccountId", google.businessProfileAccountId);
  setValue("googleBusinessProfileLocationId", google.businessProfileLocationId);
  setChecked("chatbotEnabled", chatbot.enabled);
  setValue("chatbotName", chatbot.name);
  setValue("chatbotHandoffLabel", chatbot.handoffLabel);
  setValue("chatbotGreeting", chatbot.greeting);
  setValue("chatbotQuickPrompts", chatbot.quickPrompts.join("\n"));
  setValue("chatbotEndpoint", chatbot.endpoint);
  setRadio("chatbotTone", chatbot.tone);
  setChecked("commerceEnabled", commerce.enabled);
  setValue("commerceTitle", commerce.title);
  setValue("commerceIntro", commerce.intro);
  setValue("commerceCurrency", commerce.currency);
  setValue("commerceOrderEmail", commerce.orderEmail);
  setValue("commerceCheckoutEndpoint", commerce.checkoutEndpoint);
  setValue("commerceProductsEndpoint", commerce.productsEndpoint);
  setValue("commerceSuccessUrl", commerce.successUrl);
  setValue("commerceCancelUrl", commerce.cancelUrl);
  setValue("commerceTermsUrl", commerce.termsUrl);
  setValue("commercePrivacyUrl", commerce.privacyUrl);
  setValue("commerceDeliveryMode", commerce.deliveryMode);
  setValue("commerceProducts", serializeProducts(commerce.products));
  setValue("sectionOrder", normalizeSectionOrder(resolved.sectionOrder, DEFAULT_SECTION_ORDER).join(","));
  setValue("blockVariants", JSON.stringify(normalizeBlockVariants(resolved.blockVariants)));
  setValue("mediaMetadata", JSON.stringify(normalizeMediaMetadata(resolved.mediaMetadata)));
  setValue("textStyles", JSON.stringify(normalizeTextStyles(resolved.textStyles)));
  setValue("buttonStyles", JSON.stringify(normalizeButtonStyles(resolved.buttonStyles)));
}

function setValue(name, value) {
  const field = form.elements[name];
  if (field) {
    field.value = value ?? "";
  }
}

function setChecked(name, value) {
  const field = form.elements[name];
  if (field && typeof field.checked === "boolean") {
    field.checked = Boolean(value);
  }
}

function setRadio(name, value) {
  const option = form.querySelector(`[name="${name}"][value="${value}"]`);

  if (option) {
    option.checked = true;
  }
}

function businessFromForm() {
  const data = new FormData(form);
  return {
    name: textOr(data.get("name"), demoBusiness.name),
    category: textOr(data.get("category"), "Negocio local"),
    location: textOr(data.get("location"), ""),
    tagline: textOr(data.get("tagline"), "Una experiencia local que merece verse online"),
    description: textOr(data.get("description"), ""),
    conversionGoal: textOr(data.get("conversionGoal"), ""),
    announcement: textOr(data.get("announcement"), ""),
    phone: textOr(data.get("phone"), ""),
    email: textOr(data.get("email"), ""),
    address: textOr(data.get("address"), ""),
    services: parseLines(data.get("services")).slice(0, 9),
    features: parseLines(data.get("features")).slice(0, 8),
    hours: parseLines(data.get("hours")).slice(0, 8),
    testimonials: parsePairs(data.get("testimonials"), "Cliente", "Una experiencia excelente").slice(0, 6)
      .map(([name, text]) => ({ name, text })),
    faqs: parsePairs(data.get("faqs"), "Pregunta", "Respuesta").slice(0, 8)
      .map(([question, answer]) => ({ question, answer })),
    trustBadges: parseLines(data.get("trustBadges")).slice(0, 6),
    links: parsePairs(data.get("links"), "Enlace", "#").slice(0, 8).map(([label, url]) => ({
      label,
      url: normalizeUrl(url)
    })),
    servicesHeading: textOr(data.get("servicesHeading"), demoBusiness.servicesHeading),
    servicesIntro: textOr(data.get("servicesIntro"), demoBusiness.servicesIntro),
    trustHeading: textOr(data.get("trustHeading"), demoBusiness.trustHeading),
    trustIntro: textOr(data.get("trustIntro"), demoBusiness.trustIntro),
    contactHeading: textOr(data.get("contactHeading"), demoBusiness.contactHeading),
    showLeadForm: data.get("showLeadForm") === "on",
    leadFormTitle: textOr(data.get("leadFormTitle"), demoBusiness.leadFormTitle),
    leadFormIntro: textOr(data.get("leadFormIntro"), demoBusiness.leadFormIntro),
    leadFormCta: textOr(data.get("leadFormCta"), demoBusiness.leadFormCta),
    privacyUrl: normalizeOptionalUrl(data.get("privacyUrl")),
    designPack: textOr(data.get("designPack"), "custom"),
    artDirection: textOr(data.get("artDirection"), "auto"),
    contentMode: textOr(data.get("contentMode"), "visual"),
    heroImage: normalizeImage(data.get("heroImage"), demoBusiness.heroImage),
    gallery: parseLines(data.get("gallery"))
      .map((url) => normalizeImage(url, ""))
      .filter(Boolean)
      .slice(0, 12),
    theme: textOr(data.get("theme"), "aurora"),
    motion: textOr(data.get("motion"), "cinematic"),
    typography: textOr(data.get("typography"), "modern"),
    contentDensity: textOr(data.get("contentDensity"), "balanced"),
    visualShape: textOr(data.get("visualShape"), "clean"),
    heroSize: textOr(data.get("heroSize"), "balanced"),
    contentWidth: textOr(data.get("contentWidth"), "standard"),
    imageRatio: textOr(data.get("imageRatio"), "portrait"),
    fontScale: Number(data.get("fontScale") || 100),
    layoutScale: Number(data.get("layoutScale") || 100),
    showAnnouncement: data.get("showAnnouncement") === "on",
    showResourceMarquee: data.get("showResourceMarquee") === "on",
    showTrustRail: data.get("showTrustRail") === "on",
    showGallery: data.get("showGallery") === "on",
    showTestimonials: data.get("showTestimonials") === "on",
    showFaq: data.get("showFaq") === "on",
    showMap: data.get("showMap") === "on",
    showConversionDock: data.get("showConversionDock") === "on",
    showMenu: data.get("showMenu") === "on",
    menuTitle: textOr(data.get("menuTitle"), demoBusiness.menuTitle),
    menuIntro: textOr(data.get("menuIntro"), demoBusiness.menuIntro),
    menuCurrency: normalizeCurrency(data.get("menuCurrency")),
    menuItems: parseMenuItems(data.get("menuItems")).slice(0, 60),
    accent: textOr(data.get("accent"), "#cf3f2e"),
    intensity: Number(data.get("intensity") || 78),
    premiumEffects: data.get("premiumEffects") === "on",
    showBooking: data.get("showBooking") === "on",
    bookingUrl: normalizeUrl(data.get("bookingUrl") || "#contacto"),
    bookingLabel: textOr(data.get("bookingLabel"), demoBusiness.bookingLabel),
    google: {
      enabled: data.get("googleEnabled") === "on",
      workspaceEmail: textOr(data.get("googleWorkspaceEmail"), ""),
      workspaceDomain: textOr(data.get("googleWorkspaceDomain"), ""),
      managerEmail: textOr(data.get("googleManagerEmail"), ""),
      placeId: textOr(data.get("googlePlaceId"), ""),
      mapsUrl: normalizeOptionalUrl(data.get("googleMapsUrl")),
      mapEmbedUrl: normalizeOptionalUrl(data.get("mapEmbedUrl")),
      directionsNote: textOr(data.get("directionsNote"), ""),
      reviewUrl: normalizeOptionalUrl(data.get("googleReviewUrl")),
      reviewRequestTemplate: textOr(data.get("googleReviewRequestTemplate"), ""),
      appointmentUrl: normalizeOptionalUrl(data.get("googleAppointmentUrl")),
      bookingRules: textOr(data.get("googleBookingRules"), ""),
      rating: numberOr(data.get("googleRating"), 0),
      reviewCount: numberOr(data.get("googleReviewCount"), 0),
      calendarId: textOr(data.get("googleCalendarId"), ""),
      businessProfileAccountId: textOr(data.get("googleBusinessProfileAccountId"), ""),
      businessProfileLocationId: textOr(data.get("googleBusinessProfileLocationId"), "")
    },
    chatbot: {
      enabled: data.get("chatbotEnabled") === "on",
      name: textOr(data.get("chatbotName"), `${textOr(data.get("name"), demoBusiness.name)}Bot`),
      tone: textOr(data.get("chatbotTone"), "cercano"),
      greeting: textOr(
        data.get("chatbotGreeting"),
        "Hola. Te ayudo con horarios, reservas, ubicacion, servicios y contacto."
      ),
      quickPrompts: parseLines(data.get("chatbotQuickPrompts")).slice(0, 6),
      handoffLabel: textOr(data.get("chatbotHandoffLabel"), "Hablar con el negocio"),
      endpoint: normalizeOptionalUrl(data.get("chatbotEndpoint"))
    },
    commerce: {
      enabled: data.get("commerceEnabled") === "on",
      title: textOr(data.get("commerceTitle"), demoBusiness.commerce.title),
      intro: textOr(data.get("commerceIntro"), demoBusiness.commerce.intro),
      currency: normalizeCurrency(data.get("commerceCurrency")),
      orderEmail: textOr(data.get("commerceOrderEmail"), textOr(data.get("email"), "")),
      checkoutEndpoint: normalizeOptionalUrl(data.get("commerceCheckoutEndpoint")),
      productsEndpoint: normalizeOptionalUrl(data.get("commerceProductsEndpoint")),
      successUrl: normalizeOptionalUrl(data.get("commerceSuccessUrl")),
      cancelUrl: normalizeOptionalUrl(data.get("commerceCancelUrl")),
      termsUrl: normalizeOptionalUrl(data.get("commerceTermsUrl")),
      privacyUrl: normalizeOptionalUrl(data.get("commercePrivacyUrl")),
      deliveryMode: textOr(data.get("commerceDeliveryMode"), demoBusiness.commerce.deliveryMode),
      products: parseProducts(data.get("commerceProducts")).slice(0, 24)
    },
    sectionOrder: normalizeSectionOrder(data.get("sectionOrder"), DEFAULT_SECTION_ORDER),
    blockVariants: readBlockVariants(data.get("blockVariants")),
    mediaMetadata: readMediaMetadata(data.get("mediaMetadata")),
    textStyles: readTextStyles(data.get("textStyles")),
    buttonStyles: readButtonStyles(data.get("buttonStyles"))
  };
}

function renderFromForm() {
  try {
    currentBusiness = businessFromForm();
    previewTitle.textContent = currentBusiness.name;
    if (topbarProjectName) {
      topbarProjectName.textContent = currentBusiness.name;
    }
    if (frameAddress) {
      frameAddress.textContent = `digitallocalsites.com/${slugify(currentBusiness.name || "nuevo-negocio")}`;
    }
    renderPreviewMetrics(currentBusiness);
    renderQualityPanel(currentBusiness);
    sitePreview.innerHTML = renderSite(currentBusiness);
    attachGeneratedInteractions(sitePreview, currentBusiness);
    attachPreviewSectionControls();
    attachPreviewItemControls();
    sitePreview.classList.toggle("is-direct-edit", directEditEnabled);
    syncQuickToggleState();
    renderSectionManager(currentBusiness);
    renderBlockLibrary(currentBusiness);
    draftStore.schedule(currentBusiness);
    document.documentElement.dataset.studioReady = "true";
    delete document.documentElement.dataset.studioError;
  } catch (error) {
    if (previewObserver) {
      previewObserver.disconnect();
    }

    sitePreview.innerHTML = renderPreviewError(error);
    document.documentElement.dataset.studioReady = "false";
    document.documentElement.dataset.studioError = error?.message || "unknown";
    sitePreview.querySelector("[data-preview-reset]")?.addEventListener("click", () => {
      currentBusiness = cloneData(defaultSectorPreset);
      fillForm(currentBusiness);
      syncSegmentedControls();
      syncDesignPackState();
      syncQuickToggleState();
      renderFromForm();
      setStatus("Demo segura restaurada.");
    });
    setStatus("La vista previa encontro un dato incompatible. Revisa los campos recientes.");
  }
}

function renderPreviewError(error) {
  const message = error?.message || "Error desconocido";

  return `
    <section class="preview-error" role="alert">
      <h2>No se pudo pintar la vista previa</h2>
      <p>${escapeHtml(message)}</p>
      <button type="button" data-preview-reset>Restaurar demo segura</button>
    </section>
  `;
}

function renderPreviewMetrics(business) {
  const score = calculateConversionScore(business);
  const channels = [
    business.phone,
    business.email,
    business.bookingUrl && business.bookingUrl !== "#contacto",
    business.links.length,
    business.showLeadForm,
    business.chatbot?.enabled,
    business.commerce?.enabled
  ].filter(Boolean).length;
  const assets = business.gallery.length + (business.heroImage ? 1 : 0) + (business.commerce?.products?.length || 0);

  previewMetrics.innerHTML = [
    renderMetricChip(score, "score"),
    renderMetricChip(channels, "canales"),
    renderMetricChip(assets, "assets")
  ].join("");
}

function applyQuickCommand() {
  const input = document.querySelector("#quickCommandInput");
  const command = normalizeText(input?.value || "");

  if (!command) {
    setStatus("Escribe un comando rapido: refina la marca, prioriza reservas, sin mapa...");
    return;
  }

  const actions = [];

  if (matchesAny(command, ["premium", "lujo", "elegante", "caro", "refinar", "refina", "marca cuidada"])) actions.push("premium");
  if (matchesAny(command, ["limpio", "minimal", "simple", "sobrio", "simplificar", "simplifica"])) actions.push("minimal");
  if (matchesAny(command, ["urgencia", "urgente", "oferta", "promocion", "acelerar", "decision rapida"])) actions.push("urgent");
  if (matchesAny(command, ["confianza", "resena", "resenas", "opiniones", "google"])) actions.push("trust");
  if (matchesAny(command, ["reserva", "reservas", "cita", "agenda"])) actions.push("booking");
  if (matchesAny(command, ["pedido", "pedidos", "delivery", "comida", "whatsapp"])) actions.push("food");
  if (matchesAny(command, ["tienda", "compras", "compra online", "productos", "pagar", "stripe", "ecommerce"])) actions.push("store");
  if (matchesAny(command, ["local", "barrio", "cerca", "zona"])) actions.push("local");
  if (matchesAny(command, ["movil", "telefono", "mobile", "compacto"])) actions.push("mobile");
  if (matchesAny(command, ["menos texto", "menos letras", "mas visual", "muy visual", "escaparate", "poco texto"])) actions.push("showcase");
  if (matchesAny(command, ["letra grande", "texto grande", "mas grande", "fuente grande"])) actions.push("biggerType");
  if (matchesAny(command, ["mas aire", "mas espacio", "amplio", "dimensiones grandes"])) actions.push("moreSpace");
  if (matchesAny(command, ["fotos anchas", "imagenes anchas", "panoramico", "horizontal"])) actions.push("wideImages");

  if (matchesAny(command, ["sin mapa", "quitar mapa", "ocultar mapa"])) actions.push("hideMap");
  if (matchesAny(command, ["sin bot", "quitar bot", "ocultar bot"])) actions.push("hideBot");
  if (matchesAny(command, ["sin galeria", "quitar fotos", "menos fotos"])) actions.push("hideGallery");
  if (matchesAny(command, ["mostrar todo", "activar todo", "todo visible"])) actions.push("showAll");

  if (!actions.length) {
    setStatus("No entendi el comando. Prueba: refina la marca, prioriza reservas, sin mapa, mostrar todo.");
    return;
  }

  runQuickMutation(() => {
    actions.forEach((action) => mutateQuickAction(action));
  }, `Comando aplicado: ${input.value}`);
  input.value = "";
}

function applyQuickAction(action) {
  runQuickMutation(() => mutateQuickAction(action), quickActionLabel(action));
}

function applyQuickRecipe({ values = {}, radios = {}, checks = {}, blocks = {}, sectionOrder } = {}) {
  setValue("designPack", "custom");
  Object.entries(values).forEach(([field, value]) => setValue(field, value));
  Object.entries(radios).forEach(([field, value]) => setRadioValue(field, value));
  Object.entries(checks).forEach(([field, value]) => setChecked(field, value));

  if (Object.keys(blocks).length) {
    const currentBlocks = readBlockVariants(form.elements.blockVariants?.value);
    setValue("blockVariants", JSON.stringify({ ...currentBlocks, ...blocks }));
  }

  if (Array.isArray(sectionOrder) && sectionOrder.length) {
    setValue("sectionOrder", sectionOrder.join(","));
  }
}

function mutateQuickAction(action) {
  const business = businessFromForm();
  const name = business.name || "tu negocio";
  const category = business.category || "negocio local";
  const location = business.location || "tu zona";

  const actions = {
    surprise: () => {
      applyQuickRecipe(QUICK_CREATIVE_DIRECTIONS[Math.floor(Math.random() * QUICK_CREATIVE_DIRECTIONS.length)]);
    },
    premium: () => {
      applyQuickRecipe(QUICK_ACTION_RECIPES.premium);
    },
    minimal: () => {
      applyQuickRecipe(QUICK_ACTION_RECIPES.minimal);
    },
    urgent: () => {
      applyQuickRecipe({
        values: {
          announcement: `Disponibilidad actualizada esta semana en ${name}.`,
          bookingLabel: "Consultar disponibilidad",
          leadFormCta: "Recibir respuesta",
          conversionGoal: `Facilitar una decision rapida para ${category} en ${location}`,
          intensity: 50,
          fontScale: 95,
          layoutScale: 95
        },
        radios: {
          artDirection: "editorial", contentMode: "balanced", typography: "modern", motion: "soft",
          contentDensity: "compact", heroSize: "compact", contentWidth: "standard", imageRatio: "wide"
        },
        checks: {
          showAnnouncement: true, showBooking: true, showLeadForm: true, showConversionDock: true,
          showTrustRail: true, showTestimonials: true, showResourceMarquee: false, premiumEffects: false
        },
        blocks: { hero: "split", services: "list", gallery: "grid", testimonials: "quotes", contact: "banner" },
        sectionOrder: ["booking", "services", "testimonials", "lead", "gallery", "features", "faq", "map", "menu", "store"]
      });
    },
    trust: () => {
      applyQuickRecipe(QUICK_ACTION_RECIPES.trust);
    },
    booking: () => {
      applyQuickRecipe({
        values: {
          bookingLabel: "Consultar disponibilidad",
          conversionGoal: `Convertir visitas en reservas para ${name}`,
          leadFormCta: "Consultar disponibilidad",
          intensity: 50,
          fontScale: 95,
          layoutScale: 95
        },
        radios: {
          artDirection: "editorial", contentMode: "balanced", typography: "modern", motion: "soft",
          contentDensity: "compact", heroSize: "compact", contentWidth: "standard", imageRatio: "wide"
        },
        checks: {
          showBooking: true, showLeadForm: true, showConversionDock: true,
          showTrustRail: true, showTestimonials: true, showResourceMarquee: false
        },
        blocks: { hero: "split", services: "list", gallery: "grid", testimonials: "quotes", contact: "banner" },
        sectionOrder: ["services", "booking", "testimonials", "lead", "gallery", "features", "faq", "map", "menu", "store"]
      });
    },
    food: () => {
      applyQuickRecipe({
        values: {
          bookingLabel: "Hacer un pedido",
          announcement: "Carta y disponibilidad actualizadas para pedidos.",
          conversionGoal: `Pedidos, recogida y consultas para ${name}`,
          intensity: 55,
          fontScale: 95,
          layoutScale: 95
        },
        radios: {
          artDirection: "mosaic", contentMode: "balanced", typography: "modern", motion: "cinematic",
          contentDensity: "compact", heroSize: "balanced", contentWidth: "wide", imageRatio: "wide"
        },
        checks: {
          showAnnouncement: true, showBooking: true, showConversionDock: true, showMenu: true,
          commerceEnabled: true, showGallery: true, showResourceMarquee: false, premiumEffects: true
        },
        blocks: { hero: "collage", services: "list", gallery: "mosaic", testimonials: "cards", contact: "compact" },
        sectionOrder: ["menu", "services", "gallery", "testimonials", "booking", "lead", "map", "features", "faq", "store"]
      });
    },
    store: () => {
      applyQuickRecipe({
        values: { intensity: 50, fontScale: 95, layoutScale: 95 },
        radios: {
          artDirection: "mosaic", contentMode: "balanced", typography: "modern", motion: "soft",
          contentDensity: "compact", heroSize: "balanced", contentWidth: "wide", imageRatio: "square"
        },
        checks: {
          commerceEnabled: true, showConversionDock: true, showGallery: true,
          showTrustRail: true, showResourceMarquee: false
        },
        blocks: { hero: "split", services: "cards", gallery: "grid", testimonials: "cards", contact: "compact" },
        sectionOrder: ["store", "services", "testimonials", "gallery", "features", "faq", "map", "booking", "lead", "menu"]
      });
      setValue("commerceTitle", "Compra online");
      setValue(
        "commerceIntro",
        "Productos con carrito, checkout seguro con Stripe y pedido registrado para seguimiento."
      );
      setValue("commerceOrderEmail", business.email || demoBusiness.commerce.orderEmail);
      if (!form.elements.commerceProducts.value.trim()) {
        setValue("commerceProducts", serializeProducts(demoBusiness.commerce.products));
      }
      setValue("conversionGoal", `Vender productos online para ${name}`);
      setValue("announcement", "Catalogo disponible con compra online.");
      setChecked("showAnnouncement", true);
    },
    local: () => {
      applyQuickRecipe(QUICK_ACTION_RECIPES.local);
    },
    mobile: () => {
      applyQuickRecipe(QUICK_ACTION_RECIPES.mobile);
      setDeviceSize("mobile");
    },
    showcase: () => {
      applyQuickRecipe(QUICK_ACTION_RECIPES.showcase);
    },
    biggerType: () => {
      setValue("designPack", "custom");
      setValue("fontScale", Math.min(110, numberOr(form.elements.fontScale.value, 100) + 5));
      setRadioValue("contentMode", "balanced");
    },
    moreSpace: () => {
      applyQuickRecipe({
        values: { layoutScale: Math.min(110, numberOr(form.elements.layoutScale.value, 100) + 5) },
        radios: { contentDensity: "balanced", heroSize: "balanced", contentWidth: "standard" }
      });
    },
    wideImages: () => {
      applyQuickRecipe(QUICK_ACTION_RECIPES.wideImages);
    },
    hideMap: () => setChecked("showMap", false),
    hideBot: () => setChecked("chatbotEnabled", false),
    hideGallery: () => setChecked("showGallery", false),
    showAll: () => {
      [
        "showAnnouncement",
        "showResourceMarquee",
        "showTrustRail",
        "showGallery",
        "showTestimonials",
        "showFaq",
        "showMap",
        "showLeadForm",
        "showMenu",
        "chatbotEnabled",
        "commerceEnabled",
        "showConversionDock"
      ].forEach((field) => setChecked(field, true));
      if (!form.elements.announcement.value.trim()) {
        setValue("announcement", `Nueva version de ${name} lista para recibir clientes.`);
      }
    }
  };

  actions[action]?.();
}

function toggleQuickField(fieldName) {
  const field = form.elements[fieldName];

  if (!field || typeof field.checked !== "boolean") {
    return;
  }

  runQuickMutation(() => {
    field.checked = !field.checked;
    if (fieldName === "showAnnouncement" && field.checked && !form.elements.announcement.value.trim()) {
      setValue("announcement", `Nueva version de ${form.elements.name.value || "tu negocio"} lista para recibir clientes.`);
    }
    if (fieldName === "showMap" && field.checked) {
      setChecked("googleEnabled", true);
    }
    if (fieldName === "commerceEnabled" && field.checked && !form.elements.commerceProducts.value.trim()) {
      setValue("commerceProducts", serializeProducts(demoBusiness.commerce.products));
    }
  }, `${field.checked ? "Ocultado" : "Activado"}: ${quickToggleLabel(fieldName)}`);
}

function runQuickMutation(mutator, label) {
  editorHistory.record(businessFromForm());
  mutator();
  syncSegmentedControls();
  syncDesignPackState();
  syncQuickToggleState();
  renderFromForm();
  updateHistoryButtons();
  setStatus(label);
}

function undoQuickChange() {
  const snapshot = editorHistory.undo(businessFromForm());
  if (!snapshot) {
    setStatus("No hay cambios que deshacer.");
    return;
  }

  restoreQuickSnapshot(snapshot, "Cambio deshecho.");
}

function redoQuickChange() {
  const snapshot = editorHistory.redo(businessFromForm());
  if (!snapshot) {
    setStatus("No hay cambios que rehacer.");
    return;
  }

  restoreQuickSnapshot(snapshot, "Cambio rehecho.");
}

function restoreQuickSnapshot(snapshot, message) {
  currentBusiness = withBusinessDefaults(snapshot);
  fillForm(currentBusiness);
  syncSegmentedControls();
  syncDesignPackState();
  syncQuickToggleState();
  renderFromForm();
  updateHistoryButtons();
  setStatus(message);
}

function updateHistoryButtons() {
  const undoButton = document.querySelector("#quickUndoButton");
  const redoButton = document.querySelector("#quickRedoButton");
  if (undoButton) undoButton.disabled = !editorHistory.canUndo;
  if (redoButton) redoButton.disabled = !editorHistory.canRedo;
}

function setAutoSaveState(message) {
  if (autoSaveState) {
    autoSaveState.textContent = message;
  }
}

function renderSectionManager(business = businessFromForm()) {
  if (!sectionOrderList) {
    return;
  }

  const order = normalizeSectionOrder(business.sectionOrder, DEFAULT_SECTION_ORDER);
  sectionOrderList.innerHTML = order.map((key, index) => {
    const definition = SECTION_DEFINITIONS[sectionBaseKey(key)];
    const field = definition.field ? form.elements[definition.field] : null;
    const active = !field || Boolean(field.checked);

    return `
      <div class="section-order-item ${active ? "is-active" : "is-hidden"}">
        <span class="section-order-index">${String(index + 1).padStart(2, "0")}</span>
        <strong>${escapeHtml(sectionInstanceLabel(key))}</strong>
        <div>
          <button type="button" data-section-move="${escapeAttr(key)}" data-direction="-1" aria-label="Subir ${escapeAttr(definition.label)}" ${index === 0 ? "disabled" : ""}>↑</button>
          <button type="button" data-section-move="${escapeAttr(key)}" data-direction="1" aria-label="Bajar ${escapeAttr(definition.label)}" ${index === order.length - 1 ? "disabled" : ""}>↓</button>
          ${key.includes("__copy") ? `<button type="button" data-section-remove="${escapeAttr(key)}">Eliminar</button>` : ""}
          ${definition.field ? `<button type="button" data-section-toggle="${escapeAttr(key)}">${active ? "Ocultar" : "Mostrar"}</button>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

function moveSection(section, direction) {
  if (!section || !direction) {
    return;
  }

  const order = normalizeSectionOrder(form.elements.sectionOrder?.value, DEFAULT_SECTION_ORDER);
  const currentIndex = order.indexOf(section);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= order.length) {
    return;
  }

  runQuickMutation(() => {
    [order[currentIndex], order[nextIndex]] = [order[nextIndex], order[currentIndex]];
    setValue("sectionOrder", order.join(","));
  }, `${sectionInstanceLabel(section)} movida ${direction < 0 ? "arriba" : "abajo"}.`);
}

function setRadioValue(name, value) {
  setRadio(name, value);
}

function quickActionLabel(action) {
  return {
    surprise: "Nueva direccion creativa, con ritmo y escala contenidos.",
    premium: "Marca refinada con jerarquia editorial y contraste sereno.",
    minimal: "Composicion simplificada sin perder informacion util.",
    urgent: "Decision acelerada mediante orden, disponibilidad y CTA; sin gritar.",
    trust: "Confianza reforzada con prueba social, FAQ y ubicacion.",
    booking: "Reservas priorizadas en el recorrido de la pagina.",
    food: "Pedidos y carta situados antes en el recorrido.",
    local: "Cercania y ubicacion ganan protagonismo.",
    mobile: "Experiencia optimizada para movil.",
    showcase: "Las imagenes lideran la composicion.",
    biggerType: "Lectura mejorada con un ajuste tipografico moderado.",
    moreSpace: "Ritmo y respiracion ajustados sin sobredimensionar.",
    wideImages: "Composicion adaptada a fotografia panoramica.",
    hideMap: "Mapa ocultado.",
    hideBot: "Bot ocultado.",
    hideGallery: "Galeria ocultada.",
    store: "Tienda y catalogo priorizados en el recorrido.",
    showAll: "Todas las secciones clave activadas."
  }[action] || "Cambio rapido aplicado.";
}

function quickToggleLabel(fieldName) {
  return {
    showAnnouncement: "Anuncio",
    showResourceMarquee: "Beneficios",
    showTrustRail: "Confianza",
    showGallery: "Galeria",
    showTestimonials: "Resenas",
    showFaq: "FAQ",
    showMap: "Mapa",
    showLeadForm: "Lead",
    chatbotEnabled: "Bot",
    commerceEnabled: "Tienda",
    showConversionDock: "Dock"
  }[fieldName] || fieldName;
}

function renderMetricChip(value, label) {
  return `<div class="metric-chip"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function calculateConversionScore(business) {
  const checks = [
    business.name,
    business.category,
    business.description,
    business.conversionGoal,
    business.phone || business.email,
    business.address || business.location,
    business.bookingUrl && business.bookingUrl !== "#contacto",
    business.services.length >= 3,
    business.gallery.length >= 3,
    business.faqs.length >= 2,
    business.trustBadges.length >= 2,
    business.testimonials.length >= 2,
    business.showLeadForm,
    business.chatbot?.enabled,
    ...(business.commerce?.enabled ? [business.commerce?.products?.length >= 1 && business.commerce?.checkoutEndpoint] : [])
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function renderQualityPanel(business) {
  const checks = getQualityChecks(business);
  const validation = validateBusiness(business);
  renderQualityControl(checks, validation);
  applyFormValidation(validation);
}

function renderDeliveryReport(business) {
  if (!deliveryStatus || !deliveryReadiness || !deliveryReport) {
    return;
  }

  const report = buildDeliveryReport(business);
  deliveryStatus.textContent = report.ready ? "Lista para entregar" : "Bloqueada";
  deliveryReadiness.textContent = `${report.score}%`;
  deliveryReadiness.className = report.ready ? "is-ready" : "is-blocked";
  deliveryReport.innerHTML = `
    <div class="delivery-summary ${report.ready ? "is-ready" : "is-blocked"}">
      <strong>${escapeHtml(report.title)}</strong>
      <span>${escapeHtml(report.summary)}</span>
    </div>
    <div class="delivery-grid">
      ${report.groups.map((group) => `
        <article class="delivery-group">
          <h3>${escapeHtml(group.label)}</h3>
          ${group.items.map((item) => `
            <span class="delivery-item is-${escapeAttr(item.status)}">
              ${escapeHtml(item.label)}
            </span>
          `).join("")}
        </article>
      `).join("")}
    </div>
    <div class="delivery-next">
      <strong>Siguiente paso</strong>
      <span>${escapeHtml(report.nextStep)}</span>
    </div>
  `;
  setStatus(report.ready
    ? "Entrega Pro preparada: la web puede exportarse con informe limpio."
    : `Entrega Pro bloqueada: corrige ${report.validation.errors.length} error(es) critico(s).`);
}

function buildDeliveryReport(business) {
  const validation = validateBusiness(business);
  const qualityChecks = getQualityChecks(business);
  const assets = estimateDeliveryAssets(business);
  const visibleSections = normalizeSectionOrder(business.sectionOrder, DEFAULT_SECTION_ORDER)
    .filter((key) => isSectionVisible(sectionBaseKey(key), business));
  const sectionCopies = visibleSections.filter((key) => key.includes("__copy")).length;
  const checklistScore = Math.round((qualityChecks.filter((item) => item.done).length / qualityChecks.length) * 100);
  const score = Math.min(checklistScore, validation.score);
  const ready = validation.ok && score >= 82;
  const warnings = validation.warnings.length + qualityChecks.filter((item) => !item.done).length;

  return {
    ready,
    score,
    validation,
    title: ready ? "Entrega preparada" : "Entrega no lista",
    summary: ready
      ? "La web supera los bloqueos criticos y puede exportarse para revision final."
      : "Hay bloqueos o carencias que conviene resolver antes de mandar nada al cliente.",
    nextStep: ready
      ? "Exporta el HTML y guarda el JSON del negocio para poder mantener esta entrega."
      : validation.errors[0]?.message || "Completa los puntos pendientes del checklist de entrega.",
    groups: [
      {
        label: "Bloqueos",
        items: validation.errors.length
          ? validation.errors.map((issue) => ({ status: "error", label: issue.message }))
          : [{ status: "done", label: "Sin errores criticos de entrega" }]
      },
      {
        label: "Avisos",
        items: validation.warnings.length
          ? validation.warnings.map((issue) => ({ status: "warning", label: issue.message }))
          : [{ status: "done", label: "Sin avisos tecnicos principales" }]
      },
      {
        label: "Contenido",
        items: qualityChecks.map((item) => ({
          status: item.done ? "done" : "pending",
          label: item.label
        }))
      },
      {
        label: "Paquete",
        items: [
          { status: "info", label: `${visibleSections.length} secciones visibles (${sectionCopies} copias)` },
          { status: assets.gallery >= 3 ? "done" : "warning", label: `${assets.gallery} fotos de galeria` },
          { status: business.textStyles && Object.keys(business.textStyles).length ? "info" : "pending", label: `${Object.keys(business.textStyles || {}).length} estilos tipograficos personalizados` },
          { status: assets.localMediaCount ? "warning" : "done", label: assets.localMediaCount ? `${assets.localMediaCount} imagenes embebidas en base64` : "Sin imagenes locales pesadas detectadas" },
          { status: warnings ? "warning" : "done", label: warnings ? `${warnings} punto(s) a revisar antes de enviar` : "Checklist sin puntos pendientes" }
        ]
      }
    ]
  };
}

function estimateDeliveryAssets(business) {
  const images = [business.heroImage, ...(business.gallery || [])].filter(Boolean);
  return {
    gallery: (business.gallery || []).length,
    imageCount: images.length,
    localMediaCount: images.filter((url) => String(url).startsWith("data:image/")).length
  };
}

function isSectionVisible(section, business) {
  const field = SECTION_DEFINITIONS[section]?.field;
  if (!field) {
    return true;
  }
  if (field === "commerceEnabled") {
    return Boolean(business.commerce?.enabled);
  }
  return Boolean(business[field]);
}

function applyFormValidation(validation) {
  form.querySelectorAll("[aria-invalid='true']").forEach((field) => {
    field.removeAttribute("aria-invalid");
    field.removeAttribute("data-validation-message");
    field.removeAttribute("title");
  });

  validation.errors.forEach((issue) => {
    const field = form.elements[issue.field];
    if (field?.setAttribute) {
      field.setAttribute("aria-invalid", "true");
      field.setAttribute("data-validation-message", issue.message);
      field.setAttribute("title", issue.message);
    }
  });
}

function getQualityChecks(business) {
  const checks = [
    { label: "Marca, categoria y ciudad definidas", done: Boolean(business.name && business.category && business.location) },
    { label: "Objetivo de conversion claro", done: Boolean(business.conversionGoal) },
    { label: "CTA principal con enlace real", done: Boolean(business.bookingUrl && business.bookingUrl !== "#contacto") },
    { label: "Minimo 3 servicios y 3 fotos", done: business.services.length >= 3 && business.gallery.length >= 3 },
    { label: "Prueba social y confianza visibles", done: business.testimonials.length >= 2 && business.trustBadges.length >= 2 },
    { label: "FAQ preparada para reducir llamadas", done: business.faqs.length >= 2 },
    { label: "Mapa, ruta o resenas visibles", done: Boolean(business.google?.enabled && (business.google.mapsUrl || business.google.mapEmbedUrl || business.google.reviewUrl)) },
    { label: "Chatbot o formulario de lead activo", done: Boolean(business.chatbot?.enabled || business.showLeadForm) },
    { label: "Privacidad enlazada para formularios", done: Boolean((!business.showLeadForm && !business.showBooking) || business.privacyUrl) }
  ];

  if (business.commerce?.enabled) {
    checks.push({
      label: "Tienda online lista para checkout",
      done: Boolean(business.commerce?.checkoutEndpoint && business.commerce?.products?.length)
    });
  }

  return checks;
}

function runSplitting(container) {
  if (typeof window.Splitting !== "function") {
    return;
  }

  try {
    window.Splitting({
      target: container.querySelectorAll("[data-splitting]")
    });
  } catch (error) {
    container.querySelectorAll("[data-splitting]").forEach((item) => item.removeAttribute("data-splitting"));
  }
}

function runVanillaTilt(container, business) {
  if (
    typeof window.VanillaTilt !== "function"
    || !business.premiumEffects
    || container.clientWidth < 680
    || window.matchMedia("(pointer: coarse)").matches
  ) {
    return;
  }

  try {
    window.VanillaTilt.init(container.querySelectorAll(".tilt-card"), {
      max: Math.max(4, Math.min(12, business.intensity / 8)),
      speed: 650,
      glare: true,
      "max-glare": 0.18,
      scale: 1.01,
      gyroscope: false
    });
  } catch (error) {
    // Vendor effects are optional; the site remains fully usable without tilt.
  }
}

function runAtropos(container, business) {
  if (
    typeof window.Atropos !== "function"
    || !business.premiumEffects
    || container.clientWidth < 680
    || window.matchMedia("(pointer: coarse)").matches
  ) {
    return;
  }

  container.querySelectorAll("[data-atropos-root]").forEach((element) => {
    try {
      window.Atropos({
        el: element,
        activeOffset: 18,
        rotateXMax: 5,
        rotateYMax: 7,
        duration: 700,
        shadow: false,
        highlight: false
      });
    } catch (error) {
      // The collage remains fully visible when enhanced parallax is unavailable.
    }
  });
}

function updateScrollProgress(container, root) {
  if (!root) {
    return;
  }

  const max = container.scrollHeight - container.clientHeight;
  const progress = max > 0 ? container.scrollTop / max : 0;
  container.style.setProperty("--preview-viewport-height", `${container.clientHeight}px`);
  root.style.setProperty("--scroll-progress", progress.toFixed(4));
  root.style.setProperty("--preview-viewport-height", `${container.clientHeight}px`);
}

function fixPreviewFloatingControls(container, root) {
  const controls = root.querySelectorAll(":scope > .conversion-dock, :scope > .chatbot-widget");

  if (!controls.length) {
    return;
  }

  const layer = document.createElement("div");
  layer.className = "preview-floating-layer";
  const rootStyle = root.getAttribute("style");
  if (rootStyle) {
    layer.setAttribute("style", rootStyle);
  }
  controls.forEach((control) => layer.appendChild(control));
  container.prepend(layer);
}

function updatePreviewParallax(container, business) {
  const images = container.querySelectorAll(".parallax-media img");
  const disableParallax =
    container.clientWidth < 680
    || window.matchMedia("(pointer: coarse)").matches
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (disableParallax) {
    images.forEach((image) => image.style.setProperty("--parallax-y", "0px"));
    return;
  }

  const viewport = container.getBoundingClientRect();
  const viewportCenter = viewport.top + viewport.height / 2;
  const range = Math.max(1, viewport.height / 2);
  const maxShift = 22 * motionMultiplier(business.motion);

  images.forEach((image) => {
    const frame = image.closest(".parallax-media")?.getBoundingClientRect();
    if (!frame || frame.bottom < viewport.top - viewport.height || frame.top > viewport.bottom + viewport.height) {
      return;
    }

    const center = frame.top + frame.height / 2;
    const normalized = Math.max(-1, Math.min(1, (center - viewportCenter) / range));
    image.style.setProperty("--parallax-y", `${(-normalized * maxShift).toFixed(2)}px`);
  });
}

function attachChatbot(container) {
  const widget = container.querySelector(".chatbot-widget");

  if (!widget) {
    return;
  }

  const context = readChatbotContext(widget);
  const messages = widget.querySelector("[data-chatbot-messages]");
  const form = widget.querySelector("[data-chatbot-form]");
  const input = form?.elements.message;
  const history = [];

  widget.querySelector(".chatbot-launcher")?.addEventListener("click", () => {
    widget.classList.add("is-open");
    widget.querySelector(".chatbot-launcher")?.setAttribute("aria-expanded", "true");
    trackLocalLiftEvent("chatbot_open", { business: context.business?.name || "" });
    input?.focus();
  });

  widget.querySelector(".chatbot-close")?.addEventListener("click", () => {
    widget.classList.remove("is-open");
    widget.querySelector(".chatbot-launcher")?.setAttribute("aria-expanded", "false");
  });

  widget.querySelectorAll("[data-chatbot-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      trackLocalLiftEvent("chatbot_prompt", { prompt: button.dataset.chatbotPrompt || "" });
      submitChatbotMessage(button.dataset.chatbotPrompt || "", { messages, input, context, history });
    });
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    trackLocalLiftEvent("chatbot_message", { business: context.business?.name || "" });
    submitChatbotMessage(input?.value || "", { messages, input, context, history });
  });
}

function attachLeadForms(container, business) {
  container.querySelectorAll("[data-lead-form]").forEach((leadForm) => {
    leadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(leadForm);
      const lead = {
        business: business.name,
        name: textOr(data.get("leadName"), "Lead sin nombre"),
        contact: textOr(data.get("leadContact"), ""),
        message: textOr(data.get("leadMessage"), ""),
        privacyAccepted: data.get("privacyAccepted") === "true",
        privacyAcceptedAt: new Date().toISOString(),
        privacyPolicyUrl: business.privacyUrl || "",
        source: "form",
        timestamp: new Date().toISOString()
      };

      window.localLiftLeads = window.localLiftLeads || [];
      window.localLiftLeads.push(lead);
      trackLocalLiftEvent("lead_form_submit", { business: business.name });
      const status = leadForm.querySelector("[data-lead-status]");

      try {
        await syncLeadToCrm(leadForm.dataset.leadEndpoint || getPublicLeadEndpoint(business), lead);
        if (status) {
          status.textContent = "Lead guardado en el CRM.";
        }
      } catch (error) {
        if (status) {
          status.textContent = "Lead guardado en esta sesion. La API CRM no esta disponible.";
        }
      }

      leadForm.reset();
    });
  });
}

function attachPublicBookingForms(container, business) {
  container.querySelectorAll("[data-public-booking-form]").forEach((bookingForm) => {
    const startsAt = bookingForm.elements.startsAt;

    if (startsAt && !startsAt.min) {
      startsAt.min = toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
    }

    bookingForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(bookingForm);
      const booking = {
        business: business.name,
        serviceName: textOr(data.get("serviceName"), "Reserva"),
        customerName: textOr(data.get("customerName"), "Cliente sin nombre"),
        contact: textOr(data.get("contact"), ""),
        startsAt: data.get("startsAt") ? new Date(String(data.get("startsAt"))).toISOString() : "",
        notes: textOr(data.get("notes"), ""),
        privacyAccepted: data.get("privacyAccepted") === "true",
        privacyAcceptedAt: new Date().toISOString(),
        privacyPolicyUrl: business.privacyUrl || "",
        source: "public-widget",
        timestamp: new Date().toISOString()
      };
      const status = bookingForm.querySelector("[data-booking-status]");

      window.localLiftBookings = window.localLiftBookings || [];
      window.localLiftBookings.push(booking);
      trackLocalLiftEvent("public_booking_submit", { business: business.name, service: booking.serviceName });

      try {
        await syncBookingToAgenda(bookingForm.dataset.bookingEndpoint || getPublicBookingEndpoint(business), booking);
        if (status) {
          status.textContent = "Reserva enviada a la agenda. El negocio confirmara el hueco.";
        }
      } catch (error) {
        if (status) {
          status.textContent = error.status === 409
            ? "Ese hueco no esta disponible. Prueba otra hora."
            : "Reserva guardada en esta sesion. La agenda no esta disponible.";
        }
      }

      bookingForm.reset();

      if (startsAt) {
        startsAt.min = toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
      }
    });
  });
}

function attachStore(container, business) {
  container.querySelectorAll("[data-store]").forEach((store) => {
    const context = readStoreContext(store);
    const commerce = normalizeCommerce(context.commerce || {});
    let products = commerce.products.length ? commerce.products : demoBusiness.commerce.products;
    let shippingMethods = commerce.shippingMethods.length ? commerce.shippingMethods : demoBusiness.commerce.shippingMethods;
    let selectedShippingId = shippingMethods.find((method) => method.default)?.id || shippingMethods[0]?.id || "pickup";
    let quoteSeq = 0;
    const cart = new Map();
    const productsTarget = store.querySelector("[data-store-products]");
    const itemsTarget = store.querySelector("[data-cart-items]");
    const totalTarget = store.querySelector("[data-cart-total]");
    const summaryTarget = store.querySelector("[data-order-summary]");
    const shippingTarget = store.querySelector("[data-shipping-options]");
    const statusTarget = store.querySelector("[data-store-status]");
    const paymentNotice = store.querySelector("[data-store-payment-notice]");
    const checkoutForm = store.querySelector("[data-store-checkout]");
    const couponInput = checkoutForm?.elements.couponCode;
    const mobileCartBar = store.querySelector("[data-mobile-cart-bar]");
    const mobileCartTotal = store.querySelector("[data-mobile-cart-total]");
    const siteRoot = store.closest(".generated-site");

    const setStatus = (message) => {
      if (statusTarget) statusTarget.textContent = message;
    };

    const cartLines = () => Array.from(cart.entries())
      .map(([id, quantity]) => ({ product: products.find((item) => item.id === id), quantity }))
      .filter((item) => item.product && item.quantity > 0);

    const quotePayload = () => ({
      currency: commerce.currency,
      shippingMethodId: selectedShippingId,
      couponCode: textOr(couponInput?.value, ""),
      items: cartLines().map(({ product, quantity }) => ({
        id: product.id,
        sku: product.sku,
        quantity
      }))
    });

    const bindProductButtons = () => {
      store.querySelectorAll("[data-add-product]").forEach((button) => {
        button.addEventListener("click", () => {
          const productId = button.dataset.addProduct || "";
          const product = products.find((item) => item.id === productId);

          if (!product) return;

          cart.set(productId, (cart.get(productId) || 0) + 1);
          renderCart();
          refreshQuote();
          setStatus(`${product.name} anadido al carrito.`);
          trackLocalLiftEvent("store_add_to_cart", { business: business.name, product: product.name });
        });
      });
    };

    const renderProducts = () => {
      if (!productsTarget) return;
      productsTarget.innerHTML = products.map((product) => renderProductCard(product, commerce.currency)).join("");
      productsTarget.querySelectorAll(".reveal").forEach((item) => item.classList.add("is-visible"));
      bindProductButtons();
    };

    const renderCart = () => {
      const lines = cartLines();

      if (!itemsTarget) return;
      if (!lines.length) {
        itemsTarget.innerHTML = '<p class="store-empty">Anade productos para empezar.</p>';
        renderSummary(localQuote());
        return;
      }

      itemsTarget.innerHTML = lines.map(({ product, quantity }) => `
        <div class="cart-line">
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <span>${escapeHtml(formatMoney(product.price, commerce.currency))} x ${quantity}</span>
          </div>
          <div class="cart-line-actions">
            <button type="button" data-cart-dec="${escapeAttr(product.id)}">-</button>
            <span>${quantity}</span>
            <button type="button" data-cart-inc="${escapeAttr(product.id)}">+</button>
          </div>
        </div>
      `).join("");

      itemsTarget.querySelectorAll("[data-cart-dec]").forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.dataset.cartDec || "";
          const next = (cart.get(id) || 0) - 1;
          if (next > 0) cart.set(id, next);
          else cart.delete(id);
          renderCart();
          refreshQuote();
        });
      });

      itemsTarget.querySelectorAll("[data-cart-inc]").forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.dataset.cartInc || "";
          cart.set(id, (cart.get(id) || 0) + 1);
          renderCart();
          refreshQuote();
        });
      });
    };

    const renderShippingMethods = () => {
      if (!shippingTarget) return;
      shippingTarget.innerHTML = `
        <legend>Entrega</legend>
        ${shippingMethods.map((method) => `
          <label class="store-shipping-option">
            <input type="radio" name="shippingMethodId" value="${escapeAttr(method.id)}" ${method.id === selectedShippingId ? "checked" : ""}>
            <span>
              <strong>${escapeHtml(method.name)}</strong>
              <small>${escapeHtml(method.description || "")}</small>
            </span>
            <em>${escapeHtml(formatMoney(method.price, commerce.currency))}</em>
          </label>
        `).join("")}
      `;
      shippingTarget.querySelectorAll("input[name='shippingMethodId']").forEach((input) => {
        input.addEventListener("change", () => {
          selectedShippingId = input.value;
          refreshQuote();
        });
      });
    };

    const renderSummary = (quote) => {
      const totals = quote.totals || {};
      const hasItems = cartLines().length > 0;
      if (totalTarget) totalTarget.textContent = formatMoney(totals.total || 0, quote.currency || commerce.currency);
      if (mobileCartTotal) mobileCartTotal.textContent = formatMoney(totals.total || 0, quote.currency || commerce.currency);
      if (mobileCartBar) mobileCartBar.hidden = !hasItems;
      siteRoot?.classList.toggle("has-mobile-cart", hasItems);
      if (!summaryTarget) return;
      summaryTarget.innerHTML = [
        ["Subtotal", totals.subtotal || 0],
        ["Descuento", totals.discount ? -Math.abs(totals.discount) : 0],
        ["Envio", totals.shipping || 0],
        [quote.taxIncluded ? "Impuestos incluidos" : "Impuestos", totals.tax || 0],
        ["Total", totals.total || 0, true]
      ].map(([label, value, strong]) => `
        <div class="${strong ? "is-total" : ""}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(formatMoney(value, quote.currency || commerce.currency))}</strong>
        </div>
      `).join("");
    };

    const localQuote = () => {
      const lines = cartLines();
      const subtotal = roundMoney(lines.reduce((sum, item) => sum + item.product.price * item.quantity, 0));
      const shipping = shippingMethods.find((method) => method.id === selectedShippingId)?.price || 0;
      const taxableBase = Math.max(0, subtotal + shipping);
      const taxRatePercent = commerce.taxRatePercent || 0;
      const tax = commerce.taxIncluded
        ? roundMoney(taxableBase - taxableBase / (1 + taxRatePercent / 100))
        : roundMoney(taxableBase * (taxRatePercent / 100));
      const total = commerce.taxIncluded ? roundMoney(taxableBase) : roundMoney(taxableBase + tax);
      return {
        currency: commerce.currency,
        taxIncluded: commerce.taxIncluded,
        totals: { subtotal, discount: 0, shipping, tax, taxRatePercent, total }
      };
    };

    const refreshQuote = async () => {
      const seq = ++quoteSeq;
      const lines = cartLines();
      if (!lines.length) {
        renderSummary(localQuote());
        return;
      }

      renderSummary(localQuote());
      const validateEndpoint = deriveStoreEndpoint(commerce.checkoutEndpoint || commerce.productsEndpoint, "/api/store/cart/validate");
      if (!validateEndpoint) return;

      try {
        const response = await fetch(validateEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(quotePayload())
        });
        const quote = await response.json();
        if (seq !== quoteSeq) return;
        if (!response.ok) throw new Error(quote.error || "No se pudo validar el carrito");
        renderSummary(quote);
        setStatus(quote.coupon ? `Cupon ${quote.coupon.code} aplicado.` : "");
      } catch (error) {
        if (seq === quoteSeq && couponInput?.value.trim()) {
          setStatus(error.message || "No se pudo aplicar el cupon.");
        }
      }
    };

    const loadProducts = async () => {
      if (!commerce.productsEndpoint) return;

      try {
        const response = await fetch(commerce.productsEndpoint);
        if (!response.ok) return;
        const data = await response.json();
        const remoteProducts = normalizeProducts(data.products || data);
        if (!remoteProducts.length) return;
        products = remoteProducts;
        commerce.products = remoteProducts;
        renderProducts();
        renderCart();
        refreshQuote();
        setStatus("Catalogo sincronizado con la base de datos.");
      } catch (error) {
        // The embedded catalog keeps the preview and exported page usable without the API running.
      }
    };

    const loadConfig = async () => {
      const configEndpoint = deriveStoreEndpoint(commerce.productsEndpoint || commerce.checkoutEndpoint, "/api/store/config");
      if (!configEndpoint) return;

      try {
        const response = await fetch(configEndpoint);
        if (!response.ok) return;
        const data = await response.json();
        const settings = data.settings || {};
        if (settings.currency) commerce.currency = normalizeCurrency(settings.currency);
        commerce.taxRatePercent = numberOr(settings.taxRatePercent, commerce.taxRatePercent);
        commerce.taxIncluded = settings.taxIncluded !== false;
        if (Array.isArray(settings.shippingMethods) && settings.shippingMethods.length) {
          shippingMethods = normalizeShippingMethods(settings.shippingMethods);
          selectedShippingId = shippingMethods.find((method) => method.default)?.id || shippingMethods[0]?.id || selectedShippingId;
          renderShippingMethods();
          refreshQuote();
        }
      } catch (error) {
        // Local checkout settings remain available without API config.
      }
    };

    couponInput?.addEventListener("input", () => {
      window.clearTimeout(couponInput.dataset.timer);
      couponInput.dataset.timer = window.setTimeout(refreshQuote, 350);
    });

    checkoutForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const lines = cartLines();

      if (!lines.length) {
        setStatus("Anade al menos un producto antes de pagar.");
        return;
      }

      if (!commerce.checkoutEndpoint) {
        setStatus("Falta configurar el endpoint de checkout Stripe.");
        return;
      }

      const data = new FormData(checkoutForm);
      const fallbackUrl = `${window.location.origin}${window.location.pathname}`;
      const payload = {
        businessName: context.business?.name || business.name,
        orderEmail: commerce.orderEmail || business.email,
        currency: commerce.currency,
        successUrl: commerce.successUrl || `${fallbackUrl}?pedido=ok`,
        cancelUrl: commerce.cancelUrl || `${fallbackUrl}#tienda`,
        shippingMethodId: selectedShippingId,
        couponCode: textOr(data.get("couponCode"), ""),
        customer: {
          name: textOr(data.get("customerName"), ""),
          email: textOr(data.get("customerEmail"), ""),
          phone: textOr(data.get("customerPhone"), ""),
          address: textOr(data.get("customerAddress"), "")
        },
        items: lines.map(({ product, quantity }) => ({
          id: product.id,
          sku: product.sku,
          quantity
        }))
      };

      setStatus("Creando pago seguro...");
      trackLocalLiftEvent("store_checkout_start", { business: business.name, items: lines.length });

      try {
        const response = await fetch(commerce.checkoutEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok || !(result.url || result.checkoutUrl)) {
          throw new Error(result.error || "Checkout failed");
        }

        window.location.href = result.url || result.checkoutUrl;
      } catch (error) {
        setStatus("No se pudo iniciar el pago. Revisa la API de tienda y las claves de Stripe.");
      }
    });

    renderShippingMethods();
    bindProductButtons();
    renderCart();
    refreshQuote();
    showStorePaymentNotice(paymentNotice);
    loadConfig();
    loadProducts();
  });
}

async function submitChatbotMessage(rawMessage, state) {
  const message = rawMessage.trim();

  if (!message) {
    return;
  }

  addChatMessage(state.messages, message, "user");
  state.history.push({ role: "user", content: message });

  if (state.input) {
    state.input.value = "";
  }

  const loading = addChatMessage(state.messages, "Pensando...", "bot is-loading");

  try {
    const reply = state.context.chatbot.endpoint
      ? await askChatbotEndpoint(message, state.context, state.history)
      : generateLocalChatbotReply(message, state.context, state.history);

    loading.remove();
    addChatMessage(state.messages, reply, "bot");
    state.history.push({ role: "assistant", content: reply });
  } catch (error) {
    loading.remove();
    const fallback = generateLocalChatbotReply(message, state.context, state.history);
    addChatMessage(state.messages, fallback, "bot");
    state.history.push({ role: "assistant", content: fallback });
  }
}

function addChatMessage(messages, text, type) {
  const message = document.createElement("div");
  message.className = `chat-message is-${type}`;
  message.textContent = text;
  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
  return message;
}

async function askChatbotEndpoint(message, context, history) {
  const response = await fetch(context.chatbot.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      history: history.slice(-8),
      business: context.business,
      services: context.services,
      hours: context.hours,
      faqs: context.faqs,
      links: context.links,
      google: context.google,
      tone: context.chatbot.tone
    })
  });

  if (!response.ok) {
    throw new Error("Chatbot endpoint failed");
  }

  const data = await response.json();
  return String(data.reply || data.message || "Ahora mismo no tengo una respuesta clara.");
}

function generateLocalChatbotReply(message, context, history = []) {
  const text = normalizeText(message);
  const business = context.business;
  const contact = buildContactLine(context);
  const lead = extractLeadFromMessage(message, context, history);
  const matchedFaq = context.faqs.find((faq) => hasSharedToken(text, faq.question));

  if (lead) {
    return `Perfecto, he dejado una solicitud preparada para ${business.name}.\n\nResumen:\n- Nombre: ${lead.name}\n- Contacto: ${lead.contact}\n- Necesidad: ${lead.message}\n\n${buildNextStepLine(context)}`;
  }

  if (matchedFaq) {
    return `${matchedFaq.answer}\n\n${buildSoftLeadPrompt(context)}\n\n${contact}`;
  }

  if (matchesAny(text, ["horario", "hora", "abierto", "abrir", "cerrado", "cuando"])) {
    return context.hours.length
      ? `El horario de ${business.name} es:\n${context.hours.map((line) => `- ${line}`).join("\n")}\n\n${buildSoftLeadPrompt(context)}\n\n${contact}`
      : `Todavia no hay horario detallado publicado. ${contact}`;
  }

  if (matchesAny(text, ["reserv", "cita", "mesa", "turno", "agenda", "booking"])) {
    if (looksLikeLeadDetails(text)) {
      const quickLead = storeChatLead({
        business: business.name,
        name: "Lead desde chatbot",
        contact: extractContact(message) || "",
        message,
        source: "chatbot",
        leadEndpoint: context.chatbot?.leadEndpoint || ""
      });
      return `Perfecto. He detectado datos de reserva y los dejo preparados para el negocio.\n\nResumen recibido: ${quickLead.message}\n\n${buildNextStepLine(context)}\n\n${contact}`;
    }

    return business.bookingUrl && business.bookingUrl !== "#contacto"
      ? `Puedes reservar desde aqui: ${business.bookingUrl}\n\nSi quieres, dime nombre, dia/hora y telefono, y dejo el lead preparado para el negocio.`
      : `Para reservar, dime nombre, dia/hora y telefono. Tambien puedes contactar directamente:\n${contact}`;
  }

  if (matchesAny(text, ["donde", "direccion", "ubicacion", "mapa", "llegar", "localizacion"])) {
    const map = business.mapsLink ? `\nMapa: ${business.mapsLink}` : "";
    const note = context.google?.directionsNote ? `\n${context.google.directionsNote}` : "";
    return `${business.address || business.location || "La direccion aun no esta publicada."}${note}${map}\n\n${contact}`;
  }

  if (context.commerce?.enabled && matchesAny(text, ["tienda", "comprar", "compra", "carrito", "producto", "pago", "precio"])) {
    const products = context.commerce.products || [];
    return products.length
      ? `Puedes comprar desde la seccion Tienda. Productos destacados:\n${products.slice(0, 5).map((item) => `- ${item.name}: ${formatMoney(item.price, context.commerce.currency)}`).join("\n")}\n\nEl pago se abre en Stripe Checkout cuando confirmas el carrito.`
      : "La tienda esta activa, pero todavia no hay productos publicados.";
  }

  if (matchesAny(text, ["servicio", "menu", "carta", "tratamiento", "producto", "precio", "ofrece"])) {
    return context.services.length
      ? `Estos son algunos servicios destacados:\n${context.services.map((item) => `- ${splitTitleBody(item).title}`).join("\n")}\n\n${buildSoftLeadPrompt(context)}\n\n${contact}`
      : `Todavia no hay servicios detallados en la web. ${contact}`;
  }

  if (matchesAny(text, ["telefono", "llamar", "email", "correo", "contacto", "whatsapp"])) {
    return contact;
  }

  if (matchesAny(text, ["instagram", "redes", "tiktok", "facebook", "fotos", "galeria"])) {
    return context.links.length
      ? `Puedes ver mas aqui:\n${context.links.map((link) => `- ${link.label}: ${link.url}`).join("\n")}`
      : "Ahora mismo no hay redes enlazadas, pero puedes usar el contacto principal de la web.";
  }

  if (matchesAny(text, ["resena", "reseña", "opinion", "opiniones", "rating", "valoracion", "valoración"])) {
    const google = context.google || {};
    const rating = google.rating ? `Rating Google: ${google.rating}/5 con ${google.reviewCount || 0} resenas.` : "";
    const reviewUrl = google.reviewUrl ? `\nDejar resena: ${google.reviewUrl}` : "";
    return `${rating || "Todavia no hay rating conectado en esta demo."}${reviewUrl}\n\n${buildSoftLeadPrompt(context)}\n\n${contact}`.trim();
  }

  return buildDefaultChatbotReply(context);
}

function buildDefaultChatbotReply(context) {
  const business = context.business;
  const options = [
    "horarios",
    business.bookingUrl && business.bookingUrl !== "#contacto" ? "reservas" : "contacto",
    business.address ? "ubicacion" : "",
    context.commerce?.enabled ? "tienda online" : "",
    context.services.length ? "servicios" : "",
    context.faqs.length ? "preguntas frecuentes" : ""
  ].filter(Boolean);

  return `Soy el asistente de ${business.name}. Puedo ayudarte con ${options.join(", ")}.\n\n${buildSoftLeadPrompt(context)}\n\n${buildContactLine(context)}`;
}

function buildSoftLeadPrompt(context) {
  const business = context.business;
  return `Si quieres que ${business.name} te responda con contexto, escribe: "Me llamo [nombre], mi contacto es [telefono/email] y necesito [detalle]".`;
}

function buildNextStepLine(context) {
  const business = context.business;
  return business.bookingUrl && business.bookingUrl !== "#contacto"
    ? `Siguiente paso recomendado: usar ${business.bookingUrl} o esperar respuesta del negocio.`
    : "Siguiente paso recomendado: el negocio puede contactar con esta persona desde el lead guardado.";
}

function extractLeadFromMessage(message, context, history) {
  const contact = extractContact(message);
  const name = extractName(message);

  if (!contact || !name || message.length < 18) {
    return null;
  }

  return storeChatLead({
    business: context.business?.name || "",
    name,
    contact,
    message,
    source: "chatbot",
    leadEndpoint: context.chatbot?.leadEndpoint || "",
    previousIntent: history.slice(-3).map((item) => item.content).join(" | ")
  });
}

function storeChatLead(lead) {
  const storedLead = {
    ...lead,
    timestamp: new Date().toISOString()
  };
  window.localLiftLeads = window.localLiftLeads || [];
  window.localLiftLeads.push(storedLead);
  syncLeadToCrm(lead.leadEndpoint || "", storedLead).catch(() => {});
  trackLocalLiftEvent("chatbot_lead_captured", { business: storedLead.business || "" });
  return storedLead;
}

function extractContact(message) {
  const email = String(message).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = String(message).match(/(\+?\d[\d\s().-]{7,})/)?.[0];
  return email || phone || "";
}

function extractName(message) {
  const explicit = String(message).match(/(?:me llamo|soy|nombre es)\s+([a-zA-ZÀ-ÿ\s]{2,40})/i)?.[1];

  if (explicit) {
    return explicit.trim().replace(/\s+(mi|y|con|para).*$/i, "");
  }

  return "Lead desde chatbot";
}

function buildContactLine(context) {
  const business = context.business;
  const parts = [];
  const reviewTemplate = context.google?.reviewRequestTemplate;

  if (business.phone) {
    parts.push(`Telefono: ${business.phone}`);
  }

  if (business.email) {
    parts.push(`Email: ${business.email}`);
  }

  if (business.bookingUrl && business.bookingUrl !== "#contacto") {
    parts.push(`${context.chatbot.handoffLabel}: ${business.bookingUrl}`);
  }

  if (reviewTemplate && context.google?.reviewUrl) {
    parts.push(`Pedir resena: ${reviewTemplate.replaceAll("{business}", business.name).replaceAll("{reviewUrl}", context.google.reviewUrl)}`);
  }

  return parts.length ? parts.join("\n") : "Puedes usar el formulario o enlaces de contacto de esta web.";
}

function readChatbotContext(widget) {
  try {
    return JSON.parse(widget.dataset.chatbotContext || "{}");
  } catch (error) {
    return {};
  }
}

function attachGeneratedInteractions(container, business) {
  if (previewObserver) {
    previewObserver.disconnect();
  }

  const root = container.querySelector(".generated-site");
  if (!root) {
    return;
  }

  fixPreviewFloatingControls(container, root);
  runSplitting(container);
  runVanillaTilt(container, business);
  runAtropos(container, business);
  attachGalleryAutoplay(container, root);
  attachStore(container, business);
  attachChatbot(container);
  attachPublicBookingForms(container, business);
  attachLeadForms(container, business);
  attachTracking(container, business);

  const revealItems = container.querySelectorAll(".reveal");
  const premiumEnabled = root?.dataset.premiumEffects === "true";
  const hasExternalTilt = Boolean(window.VanillaTilt);

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
  previewObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    {
      root: container,
      threshold: 0.18
    }
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 45, 260)}ms`;
    previewObserver.observe(item);
  });
  }

  container.onscroll = () => {
    if (parallaxFrame) {
      return;
    }

    parallaxFrame = requestAnimationFrame(() => {
      parallaxFrame = 0;
      updateScrollProgress(container, root);
      updatePreviewParallax(container, business);
    });
  };
  updateScrollProgress(container, root);
  updatePreviewParallax(container, business);

  container.onpointermove = (event) => {
    if (!premiumEnabled) {
      return;
    }

    root?.style.setProperty("--pointer-x", `${event.clientX}px`);
    root?.style.setProperty("--pointer-y", `${event.clientY}px`);

    if (hasExternalTilt) {
      return;
    }

    const card = event.target.closest(".tilt-card");
    container.querySelectorAll(".tilt-card").forEach((item) => {
      if (item !== card) {
        item.style.setProperty("--tilt-x", 0);
        item.style.setProperty("--tilt-y", 0);
        item.style.setProperty("--lift", "0px");
      }
    });

    if (!card) {
      return;
    }

    const cardRect = card.getBoundingClientRect();
    const localX = (event.clientX - cardRect.left) / cardRect.width - 0.5;
    const localY = (event.clientY - cardRect.top) / cardRect.height - 0.5;
    const intensity = Math.max(3, Math.min(9, business.intensity / 12));
    card.style.setProperty("--tilt-x", (localX * intensity).toFixed(2));
    card.style.setProperty("--tilt-y", (localY * intensity).toFixed(2));
    card.style.setProperty("--lift", "-3px");
  };

  container.onpointerleave = () => {
    container.querySelectorAll(".tilt-card").forEach((card) => {
      card.style.setProperty("--tilt-x", 0);
      card.style.setProperty("--tilt-y", 0);
      card.style.setProperty("--lift", "0px");
    });
  };
}

function attachGalleryAutoplay(container, root) {
  if (!root.classList.contains("block-gallery-marquee")
    || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    return;
  }

  container.querySelectorAll(".gallery-track").forEach((track) => {
    const items = Array.from(track.querySelectorAll(".gallery-item:not(.is-gallery-clone)"));
    if (items.length < 2) {
      return;
    }

    let activeIndex = 0;
    let resumeAt = 0;
    let interacting = false;

    const pauseBriefly = () => {
      interacting = false;
      resumeAt = performance.now() + 5000;
    };
    const itemScrollLeft = (item) => {
      const trackRect = track.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const paddingLeft = Number.parseFloat(window.getComputedStyle(track).paddingLeft) || 0;
      return track.scrollLeft + itemRect.left - trackRect.left - paddingLeft;
    };
    const updateActiveIndex = () => {
      activeIndex = items.reduce((closestIndex, item, index) => (
        Math.abs(itemScrollLeft(item) - track.scrollLeft)
          < Math.abs(itemScrollLeft(items[closestIndex]) - track.scrollLeft)
          ? index
          : closestIndex
      ), 0);
    };

    track.addEventListener("pointerdown", () => {
      interacting = true;
    }, { passive: true });
    track.addEventListener("pointerup", () => {
      updateActiveIndex();
      pauseBriefly();
    }, { passive: true });
    track.addEventListener("pointercancel", pauseBriefly, { passive: true });
    track.addEventListener("wheel", () => {
      updateActiveIndex();
      pauseBriefly();
    }, { passive: true });

    const advance = () => {
      if (!track.isConnected) {
        return;
      }

      const styles = window.getComputedStyle(track);
      const usesNativeScroll = styles.animationName === "none"
        && ["auto", "scroll"].includes(styles.overflowX)
        && track.scrollWidth > track.clientWidth;
      const trackRect = track.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const isVisible = trackRect.bottom > containerRect.top && trackRect.top < containerRect.bottom;

      if (usesNativeScroll && isVisible && !interacting
        && performance.now() >= resumeAt && !document.hidden) {
        activeIndex = (activeIndex + 1) % items.length;
        track.scrollTo({
          left: itemScrollLeft(items[activeIndex]),
          behavior: "smooth"
        });
      }

      window.setTimeout(advance, 4200);
    };

    window.setTimeout(advance, 4200);
  });
}

function attachTracking(container, business) {
  container.querySelectorAll("[data-track]").forEach((element) => {
    element.addEventListener("click", () => {
      trackLocalLiftEvent(element.dataset.track, {
        business: business.name,
        category: business.category
      });
    });
  });
}

function trackLocalLiftEvent(name, detail = {}) {
  window.localLiftEvents = window.localLiftEvents || [];
  const event = {
    name,
    detail,
    timestamp: new Date().toISOString()
  };
  window.localLiftEvents.push(event);
  window.dataLayer?.push({ event: `locallift_${name}`, ...detail });
  syncEventToMetrics(getPublicEventEndpoint(), {
    ...event,
    page: window.location?.pathname || "",
    referrer: document.referrer || "",
    userAgent: navigator.userAgent || ""
  }).catch(() => {});
}

function getPublicLeadEndpoint(business = {}) {
  const identifier = currentBusinessRecord?.slug
    || currentBusinessRecord?.id
    || business.slug
    || business.id
    || slugify(business.name || "");

  return identifier ? apiUrl(`/api/public/${encodeURIComponent(identifier)}/leads`) : "";
}

function getPublicBookingEndpoint(business = {}) {
  const identifier = currentBusinessRecord?.slug
    || currentBusinessRecord?.id
    || business.slug
    || business.id
    || slugify(business.name || "");

  return identifier ? apiUrl(`/api/public/${encodeURIComponent(identifier)}/bookings`) : "";
}

function getPublicEventEndpoint(business = {}) {
  const identifier = currentBusinessRecord?.slug
    || currentBusinessRecord?.id
    || business.slug
    || business.id
    || slugify(business.name || "");

  return identifier ? apiUrl(`/api/public/${encodeURIComponent(identifier)}/events`) : "";
}

async function syncLeadToCrm(endpoint, lead) {
  if (!endpoint) {
    return null;
  }

  const response = await fetch(apiUrl(endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ lead })
  });

  if (!response.ok) {
    throw new Error("Lead CRM request failed");
  }

  return response.json();
}

async function syncBookingToAgenda(endpoint, booking) {
  if (!endpoint) {
    return null;
  }

  const response = await fetch(apiUrl(endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ booking })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error("Booking API request failed");
    error.status = response.status;
    error.apiMessage = payload.error || "";
    throw error;
  }

  return response.json();
}

async function syncEventToMetrics(endpoint, event) {
  if (!endpoint) {
    return null;
  }

  const response = await fetch(apiUrl(endpoint), {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ event })
  });

  if (!response.ok) {
    throw new Error("Event API request failed");
  }

  return response.json();
}

async function downloadSite(business) {
  const html = await studioExporter.buildExportDocument(business);
  const filename = slugify(business.name || "negocio-local");
  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${filename}.html`);
}

async function downloadDeliveryPackage(business) {
  const resolved = withBusinessDefaults(business);
  const exportedAt = new Date().toISOString();
  const html = await studioExporter.buildExportDocument(resolved);
  const filename = slugify(resolved.name || "negocio-local");
  const files = buildDeliveryPackageFiles(resolved, html, exportedAt);
  downloadBlob(createZipBlob(files), `${filename}-entrega.zip`);
}

function buildDeliveryPackageFiles(business, html, exportedAt) {
  const report = buildDeliveryReport(business);
  const payload = {
    version: DATA_VERSION,
    exportedAt,
    business: withBusinessDefaults(business)
  };

  return [
    { name: "index.html", content: html },
    { name: "business.json", content: JSON.stringify(payload, null, 2) },
    { name: "ficha-entrega.md", content: buildDeliveryBrief(business, report, exportedAt) },
    { name: "cambios.md", content: buildDeliveryChangelog(business, report, exportedAt) }
  ];
}

function buildDeliveryBrief(business, report, exportedAt) {
  const lines = [
    `# Ficha de entrega - ${markdownText(business.name)}`,
    "",
    `Fecha: ${exportedAt}`,
    `Estado: ${report.ready ? "Lista para revision final" : "Pendiente de correcciones"}`,
    `Score de entrega: ${report.score}%`,
    `Categoria: ${markdownText(business.category)}`,
    `Ubicacion: ${markdownText(business.location || business.address || "Sin ubicacion definida")}`,
    "",
    "## Archivos incluidos",
    "",
    "- `index.html`: web standalone lista para abrir o subir a hosting.",
    "- `business.json`: datos completos del negocio para mantenimiento futuro.",
    "- `ficha-entrega.md`: resumen de preparacion y siguiente paso.",
    "- `cambios.md`: cambios principales aplicados en esta entrega.",
    "",
    "## Siguiente paso",
    "",
    report.nextStep,
    "",
    "## Checklist",
    ""
  ];

  report.groups.forEach((group) => {
    lines.push(`### ${markdownText(group.label)}`, "");
    group.items.forEach((item) => {
      lines.push(`- [${item.status === "done" ? "x" : " "}] ${markdownText(item.label)} (${item.status})`);
    });
    lines.push("");
  });

  return lines.join("\n").trim() + "\n";
}

function buildDeliveryChangelog(business, report, exportedAt) {
  const visibleSections = normalizeSectionOrder(business.sectionOrder, DEFAULT_SECTION_ORDER)
    .filter((key) => isSectionVisible(sectionBaseKey(key), business));
  const assets = estimateDeliveryAssets(business);
  const integrations = [
    business.showBooking ? "reservas" : "",
    business.showLeadForm ? "formulario de lead" : "",
    business.chatbot?.enabled ? "chatbot" : "",
    business.commerce?.enabled ? "tienda online" : "",
    business.google?.enabled ? "Google" : ""
  ].filter(Boolean);

  return [
    `# Cambios de entrega - ${markdownText(business.name)}`,
    "",
    `Fecha: ${exportedAt}`,
    "",
    "- Web standalone generada desde el renderizador compartido de preview y exportacion.",
    `- ${visibleSections.length} secciones visibles preparadas: ${visibleSections.map(sectionBaseKey).join(", ")}.`,
    `- Direccion visual: ${business.theme}, ${business.artDirection}, contenido ${business.contentMode}.`,
    `- Activos principales: ${assets.imageCount} imagen(es), ${assets.gallery} en galeria, ${assets.localMediaCount} embebida(s) en base64.`,
    `- Integraciones activas: ${integrations.length ? integrations.join(", ") : "sin integraciones activas"}.`,
    `- Estado Entrega Pro: ${report.ready ? "listo" : "pendiente"} con score ${report.score}%.`,
    "",
    "## Avisos abiertos",
    "",
    ...(report.validation.warnings.length
      ? report.validation.warnings.map((issue) => `- ${markdownText(issue.message)}`)
      : ["- Sin avisos tecnicos principales."])
  ].join("\n").trim() + "\n";
}

function markdownText(value) {
  return String(value ?? "")
    .replace(/\r?\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createZipBlob(files) {
  const chunks = [];
  const centralDirectory = [];
  const now = new Date();
  const dos = toDosDateTime(now);
  let offset = 0;

  files.forEach((file) => {
    const nameBytes = encodeUtf8(file.name);
    const contentBytes = encodeUtf8(file.content);
    const crc = crc32(contentBytes);
    const localHeader = concatBytes(
      u32(0x04034b50),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(dos.time),
      u16(dos.date),
      u32(crc),
      u32(contentBytes.length),
      u32(contentBytes.length),
      u16(nameBytes.length),
      u16(0)
    );

    chunks.push(localHeader, nameBytes, contentBytes);
    centralDirectory.push({ nameBytes, crc, size: contentBytes.length, offset });
    offset += localHeader.length + nameBytes.length + contentBytes.length;
  });

  const centralOffset = offset;
  centralDirectory.forEach((entry) => {
    const header = concatBytes(
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0x0800),
      u16(0),
      u16(dos.time),
      u16(dos.date),
      u32(entry.crc),
      u32(entry.size),
      u32(entry.size),
      u16(entry.nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(entry.offset)
    );
    chunks.push(header, entry.nameBytes);
    offset += header.length + entry.nameBytes.length;
  });

  const centralSize = offset - centralOffset;
  chunks.push(concatBytes(
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(centralDirectory.length),
    u16(centralDirectory.length),
    u32(centralSize),
    u32(centralOffset),
    u16(0)
  ));

  return new Blob(chunks, { type: "application/zip" });
}

function encodeUtf8(value) {
  return new TextEncoder().encode(String(value ?? ""));
}

function concatBytes(...parts) {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const bytes = new Uint8Array(size);
  let offset = 0;

  parts.forEach((part) => {
    bytes.set(part, offset);
    offset += part.length;
  });

  return bytes;
}

function u16(value) {
  const bytes = new Uint8Array(2);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, value, true);
  return bytes;
}

function u32(value) {
  const bytes = new Uint8Array(4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, value >>> 0, true);
  return bytes;
}

function toDosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function crc32(bytes) {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function downloadBusinessData(business) {
  const payload = {
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    business: withBusinessDefaults(business)
  };
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }),
    `${slugify(business.name || "dls-datos")}.dls.json`
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}

async function saveBusinessToApi(business) {
  return businessDataClient.save(business, currentBusinessRecord);
}

async function fetchBusinessFromApi(idOrSlug) {
  return businessDataClient.fetchOne(idOrSlug);
}

async function fetchFirstBusinessFromApi() {
  return businessDataClient.fetchFirst();
}

function applyBusinessRecord(record) {
  currentBusinessRecord = toApiRecordMeta(record);
  storeApiRecord(currentBusinessRecord);
  currentBusiness = normalizeImportedBusiness(record.content || record);
  fillForm(currentBusiness);
  syncSegmentedControls();
  syncDesignPackState();
  syncQuickToggleState();
  renderFromForm();
}

function buildBusinessApiPayload(business, record) {
  return {
    business: {
      id: record?.id,
      slug: record?.slug,
      name: business.name,
      category: business.category,
      city: business.location,
      ownerEmail: business.email,
      ownerPhone: business.phone,
      plan: record?.plan || "presencia-local",
      status: record?.status || "in-design",
      publishedUrl: record?.publishedUrl || "",
      brand: {
        theme: business.theme,
        accent: business.accent,
        typography: business.typography,
        designPack: business.designPack,
        artDirection: business.artDirection,
        contentMode: business.contentMode
      },
      integrations: {
        google: {
          enabled: Boolean(business.google?.enabled),
          mapsUrl: business.google?.mapsUrl || "",
          reviewUrl: business.google?.reviewUrl || "",
          appointmentUrl: business.google?.appointmentUrl || business.bookingUrl || ""
        },
        stripe: {
          enabled: Boolean(business.commerce?.enabled && business.commerce?.checkoutEndpoint)
        },
        whatsapp: {
          enabled: Boolean(business.bookingUrl),
          url: business.bookingUrl || ""
        }
      },
      settings: {
        primaryGoal: business.conversionGoal,
        source: "studio",
        updatedFromStudioAt: new Date().toISOString()
      },
      content: withBusinessDefaults(business)
    }
  };
}

function getStoredApiRecord() {
  return businessDataClient.getStoredRecord();
}

function storeApiRecord(record) {
  businessDataClient.storeRecord(record);
}

function normalizeImportedBusiness(imported) {
  const raw = imported?.business || imported;
  return withBusinessDefaults({
    ...raw,
    google: { ...demoBusiness.google, ...(raw?.google || {}) },
    chatbot: { ...demoBusiness.chatbot, ...(raw?.chatbot || {}) },
    commerce: { ...demoBusiness.commerce, ...(raw?.commerce || {}) }
  });
}

function withBusinessDefaults(business = {}) {
  const base = { ...demoBusiness, ...business };
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(business, key);
  const google = { ...demoBusiness.google, ...(base.google || {}) };
  const chatbot = { ...demoBusiness.chatbot, ...(base.chatbot || {}) };
  const commerce = normalizeCommerce({ ...demoBusiness.commerce, ...(base.commerce || {}) });
  const services = Array.isArray(base.services) ? base.services : [];
  const trustBadges = hasOwn("trustBadges") && Array.isArray(business.trustBadges) && business.trustBadges.length
    ? business.trustBadges
    : buildTrustBadges({ ...base, services, chatbot }, google);

  return {
    ...base,
    google,
    chatbot,
    commerce,
    services,
    features: Array.isArray(base.features) ? base.features : [],
    hours: Array.isArray(base.hours) ? base.hours : [],
    testimonials: Array.isArray(base.testimonials) ? base.testimonials : [],
    faqs: Array.isArray(base.faqs) ? base.faqs : [],
    links: Array.isArray(base.links) ? base.links : [],
    gallery: Array.isArray(base.gallery) ? base.gallery : [],
    menuTitle: textOr(base.menuTitle, demoBusiness.menuTitle),
    menuIntro: textOr(base.menuIntro, demoBusiness.menuIntro),
    menuCurrency: normalizeCurrency(base.menuCurrency),
    menuItems: hasOwn("menuItems")
      ? normalizeMenuItems(business.menuItems)
      : (isFoodCategory(base.category) ? normalizeMenuItems(demoBusiness.menuItems) : []),
    conversionGoal: hasOwn("conversionGoal")
      ? textOr(business.conversionGoal, `Convertir visitas en clientes para ${base.category || "negocio local"}`)
      : `Convertir visitas en clientes para ${base.category || "negocio local"}`,
    announcement: hasOwn("announcement") ? String(business.announcement || "").trim() : "",
    trustBadges,
    bookingLabel: textOr(base.bookingLabel, demoBusiness.bookingLabel),
    servicesHeading: textOr(base.servicesHeading, demoBusiness.servicesHeading),
    servicesIntro: textOr(base.servicesIntro, demoBusiness.servicesIntro),
    trustHeading: textOr(base.trustHeading, demoBusiness.trustHeading),
    trustIntro: textOr(base.trustIntro, demoBusiness.trustIntro),
    contactHeading: textOr(base.contactHeading, demoBusiness.contactHeading),
    showLeadForm: base.showLeadForm ?? true,
    leadFormTitle: textOr(base.leadFormTitle, `Pide informacion a ${base.name || "este negocio"}.`),
    leadFormIntro: textOr(
      base.leadFormIntro,
      "Completa el formulario y el negocio tendra los datos necesarios para responder con contexto."
    ),
    leadFormCta: textOr(base.leadFormCta, "Enviar solicitud"),
    privacyUrl: normalizeOptionalUrl(base.privacyUrl),
    designPack: normalizeChoice(base.designPack, ["custom", ...Object.keys(designPacks)], "custom"),
    artDirection: normalizeChoice(
      base.artDirection,
      ["auto", "cinematic", "editorial", "poster", "mosaic", "atelier", "kinetic"],
      "auto"
    ),
    contentMode: normalizeChoice(base.contentMode, ["visual", "balanced", "detailed"], "visual"),
    typography: normalizeChoice(base.typography, ["modern", "editorial", "compact"], "modern"),
    contentDensity: normalizeChoice(base.contentDensity, ["compact", "balanced", "spacious"], "balanced"),
    visualShape: normalizeChoice(base.visualShape, ["sharp", "clean", "rounded"], "clean"),
    heroSize: normalizeChoice(base.heroSize, Object.keys(heroSizeMap), "balanced"),
    contentWidth: normalizeChoice(base.contentWidth, Object.keys(contentWidthMap), "standard"),
    imageRatio: normalizeChoice(base.imageRatio, ["portrait", "square", "wide"], "portrait"),
    fontScale: clampNumber(numberOr(base.fontScale, 100), 85, 120),
    layoutScale: clampNumber(numberOr(base.layoutScale, 100), 85, 120),
    showAnnouncement: base.showAnnouncement ?? true,
    showResourceMarquee: base.showResourceMarquee ?? true,
    showTrustRail: base.showTrustRail ?? true,
    showGallery: base.showGallery ?? true,
    showTestimonials: base.showTestimonials ?? true,
    showFaq: base.showFaq ?? true,
    showMap: base.showMap ?? true,
    showConversionDock: base.showConversionDock ?? true,
    showMenu: hasOwn("showMenu") ? Boolean(business.showMenu) : isFoodCategory(base.category),
    sectionOrder: normalizeSectionOrder(base.sectionOrder, DEFAULT_SECTION_ORDER),
    blockVariants: normalizeBlockVariants(base.blockVariants),
    mediaMetadata: normalizeMediaMetadata(base.mediaMetadata),
    textStyles: normalizeTextStyles(base.textStyles),
    buttonStyles: normalizeButtonStyles(base.buttonStyles)
  };
}

function readBlockVariants(value) {
  if (value && typeof value === "object") {
    return normalizeBlockVariants(value);
  }

  try {
    return normalizeBlockVariants(JSON.parse(String(value || "{}")));
  } catch (error) {
    return normalizeBlockVariants({});
  }
}

function normalizeBlockVariants(value = {}) {
  return Object.fromEntries(Object.entries(BLOCK_LIBRARY).map(([section, definition]) => {
    const allowed = definition.variants.map((variant) => variant.id);
    const selected = allowed.includes(value?.[section])
      ? value[section]
      : DEFAULT_BLOCK_VARIANTS[section];
    return [section, selected];
  }));
}

function readMediaMetadata(value) {
  if (value && typeof value === "object") {
    return normalizeMediaMetadata(value);
  }
  try {
    return normalizeMediaMetadata(JSON.parse(String(value || "{}")));
  } catch (error) {
    return {};
  }
}

function normalizeMediaMetadata(value = {}) {
  const allowedPositions = ["center center", "center top", "center bottom", "left center", "right center"];
  return Object.fromEntries(Object.entries(value || {})
    .filter(([url, metadata]) => normalizeImage(url, "") && metadata && typeof metadata === "object")
    .slice(0, 40)
    .map(([url, metadata]) => {
      const normalized = {
        alt: String(metadata.alt || "").trim().slice(0, 180),
        position: allowedPositions.includes(metadata.position) ? metadata.position : "center center"
      };
      const license = String(metadata.license || "").trim().slice(0, 40);
      const sourceUrl = normalizeOptionalUrl(metadata.sourceUrl);
      const provider = String(metadata.provider || "").trim().slice(0, 80);
      const creator = String(metadata.creator || "").trim().slice(0, 80);
      if (license) normalized.license = license;
      if (sourceUrl) normalized.sourceUrl = sourceUrl;
      if (provider) normalized.provider = provider;
      if (creator) normalized.creator = creator;
      return [url, normalized];
    }));
}

function readTextStyles(value) {
  if (value && typeof value === "object") {
    return normalizeTextStyles(value);
  }
  try {
    return normalizeTextStyles(JSON.parse(String(value || "{}")));
  } catch (error) {
    return {};
  }
}

function normalizeTextStyles(value = {}) {
  return Object.fromEntries(Object.entries(value || {})
    .filter(([key, style]) => isTextStyleKey(key) && style && typeof style === "object")
    .slice(0, 120)
    .map(([key, style]) => [key, normalizeTextStyle(style)])
    .filter(([, style]) => Object.keys(style).length));
}

function normalizeTextStyle(style = {}) {
  const normalized = {};
  const color = normalizeColor(style.color);
  const opacity = clampNumber(numberOr(style.opacity, 1), 0.35, 1);
  const size = clampNumber(numberOr(style.size, 1), 0.8, 1.45);
  const letterSpacing = clampNumber(numberOr(style.letterSpacing, 0), -0.02, 0.08);
  const weight = ["400", "700", "900"].includes(String(style.weight)) ? String(style.weight) : "";

  if (color) normalized.color = color;
  if (Math.abs(opacity - 1) > 0.001) normalized.opacity = Number(opacity.toFixed(2));
  if (Math.abs(size - 1) > 0.001) normalized.size = Number(size.toFixed(2));
  if (weight) normalized.weight = weight;
  if (style.italic === true) normalized.italic = true;
  if (Math.abs(letterSpacing) > 0.001) normalized.letterSpacing = Number(letterSpacing.toFixed(3));

  return normalized;
}

function isTextStyleKey(key) {
  return /^(field|list):[a-zA-Z0-9:_-]+$/.test(String(key || ""));
}

function normalizeColor(value) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "";
}

function rgbToHex(value) {
  const match = String(value || "").match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) {
    return normalizeColor(value);
  }
  return `#${[match[1], match[2], match[3]]
    .map((part) => Number(part).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mergeMediaMetadata(url, changes = {}) {
  const metadata = readMediaMetadata(form.elements.mediaMetadata?.value);
  metadata[url] = {
    ...(metadata[url] || {}),
    ...changes
  };
  setValue("mediaMetadata", JSON.stringify(normalizeMediaMetadata(metadata)));
}

function serializeProducts(products = []) {
  return normalizeProducts(products)
    .map((product) => [
      product.name,
      formatPlainPrice(product.price),
      product.image,
      product.description,
      product.sku,
      product.stock
    ].join(" | "))
    .join("\n");
}

function parseProducts(value) {
  return parseLines(value)
    .map((line, index) => {
      const [name, price, image, description, sku, stock] = line.split("|").map((part) => part.trim());
      return normalizeProduct({ name, price, image, description, sku, stock }, index);
    })
    .filter((product) => product.name && product.price > 0);
}

function normalizeCommerce(commerce = {}) {
  const source = { ...demoBusiness.commerce, ...(commerce || {}) };
  return {
    enabled: Boolean(source.enabled),
    title: textOr(source.title, demoBusiness.commerce.title),
    intro: textOr(source.intro, demoBusiness.commerce.intro),
    currency: normalizeCurrency(source.currency),
    taxRatePercent: numberOr(source.taxRatePercent, demoBusiness.commerce.taxRatePercent),
    taxIncluded: source.taxIncluded !== false,
    checkoutEndpoint: normalizeOptionalUrl(source.checkoutEndpoint),
    productsEndpoint: normalizeOptionalUrl(source.productsEndpoint),
    successUrl: normalizeOptionalUrl(source.successUrl),
    cancelUrl: normalizeOptionalUrl(source.cancelUrl),
    termsUrl: normalizeOptionalUrl(source.termsUrl),
    privacyUrl: normalizeOptionalUrl(source.privacyUrl),
    orderEmail: textOr(source.orderEmail, ""),
    deliveryMode: textOr(source.deliveryMode, demoBusiness.commerce.deliveryMode),
    shippingMethods: normalizeShippingMethods(source.shippingMethods),
    products: normalizeProducts(source.products).filter((product) => product.active)
  };
}

function normalizeShippingMethods(methods = []) {
  const source = Array.isArray(methods) && methods.length ? methods : demoBusiness.commerce.shippingMethods;
  const shippingMethods = source.map((method, index) => ({
    id: slugify(method.id || method.name || `shipping-${index + 1}`),
    name: textOr(method.name, `Envio ${index + 1}`),
    description: textOr(method.description, ""),
    price: parsePrice(method.price),
    active: method.active !== false,
    default: Boolean(method.default)
  }));

  if (!shippingMethods.some((method) => method.default) && shippingMethods[0]) {
    shippingMethods[0].default = true;
  }

  return shippingMethods.filter((method) => method.active);
}

function normalizeProducts(products = []) {
  if (!Array.isArray(products)) {
    return [];
  }

  return products
    .map((product, index) => normalizeProduct(product, index))
    .filter((product) => product.name && product.price > 0);
}

function normalizeProduct(product = {}, index = 0) {
  const name = textOr(product.name, "");
  const fallbackProduct = demoBusiness.commerce?.products?.[index % demoBusiness.commerce.products.length] || {};
  const sku = slugify(product.sku || product.id || name || `producto-${index + 1}`);
  const id = slugify(product.id || sku || name || `producto-${index + 1}`);
  const price = parsePrice(product.price);
  const stock = Math.max(0, Math.floor(numberOr(product.stock, 999)));

  return {
    id,
    sku,
    name,
    price,
    image: normalizeImage(product.image, fallbackProduct.image || demoBusiness.heroImage),
    description: textOr(product.description, "Producto disponible para compra online."),
    stock,
    active: product.active !== false
  };
}

function readStoreContext(store) {
  try {
    return JSON.parse(store.dataset.storeContext || "{}");
  } catch (error) {
    return {};
  }
}

function deriveStoreEndpoint(endpoint, pathname) {
  const url = String(endpoint || "").trim();
  if (!url || !pathname) return "";

  try {
    const parsed = new URL(url);
    parsed.pathname = pathname;
    parsed.search = "";
    return parsed.toString();
  } catch (error) {
    return "";
  }
}

function showStorePaymentNotice(target) {
  if (!target) return;

  const params = new URLSearchParams(window.location.search);
  if (params.get("pedido") === "ok" || params.get("payment") === "success") {
    target.hidden = false;
    target.textContent = "Pago recibido. El negocio recibira el pedido y el comprador recibira confirmacion por email.";
  }
}

function toDatetimeLocalValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function setStatus(message) {
  statusLine.textContent = message;
}
