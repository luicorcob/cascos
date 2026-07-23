const {
  parseLines,
  cloneData,
  parsePairs,
  menuAllergens,
  serializeMenuItems,
  parseMenuItems,
  normalizeMenuItems,
  normalizeMenuItem,
  normalizeMenuAllergens,
  getMenuAllergen,
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
const commerceModel = window.LocalLiftStudio.commerce.createCommerceModel({
  demoBusiness,
  textOr,
  numberOr,
  parseLines,
  parsePrice,
  formatPlainPrice,
  normalizeCurrency,
  normalizeOptionalUrl,
  normalizeImage,
  slugify
});
const {
  serializeProducts,
  parseProducts,
  normalizeCommerce,
  normalizeProducts,
  toDatetimeLocalValue
} = commerceModel;
const businessModel = window.LocalLiftStudio.businessModel.createBusinessModel({
  blockLibrary: BLOCK_LIBRARY,
  contentWidthMap,
  core: window.LocalLiftStudio.core,
  defaultBlockVariants: DEFAULT_BLOCK_VARIANTS,
  defaultSectionOrder: DEFAULT_SECTION_ORDER,
  demoBusiness,
  designPacks,
  getBuildTrustBadges: () => buildTrustBadges,
  heroSizeMap,
  normalizeButtonStyles,
  normalizeCommerce
});
const {
  normalizeImportedBusiness,
  withBusinessDefaults,
  readBlockVariants,
  normalizeBlockVariants,
  readMediaMetadata,
  normalizeMediaMetadata,
  readTextStyles,
  normalizeTextStyles,
  rgbToHex
} = businessModel;
const introController = window.LocalLiftStudio.intro.createIntroController({
  storageKey: "dls-studio-intro-complete"
});
const bindIntroGate = introController.bind;

const STORAGE_KEY = "locallift-studio-business";
const DRAFT_STORAGE_KEY = "locallift-studio-draft";
const BRIEF_HANDOFF_STORAGE_KEY = "locallift-studio-brief-handoff";
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
const visualQaRunButton = document.querySelector("#visualQaRunButton");
const visualQaFixButton = document.querySelector("#visualQaFixButton");
const visualQaStatus = document.querySelector("#visualQaStatus");
const visualQaResult = document.querySelector("#visualQaResult");
const deviceFrame = document.querySelector(".device-frame");
const cursorGlow = document.querySelector(".cursor-glow");
const importDataInput = document.querySelector("#importDataInput");
const topbarProjectName = document.querySelector("#topbarProjectName");
const frameAddress = document.querySelector("#frameAddress");
const presentationModeButton = document.querySelector("#presentationModeButton");
const prepareDeliveryButton = document.querySelector("#prepareDeliveryButton");
const publishDemoButton = document.querySelector("#publishDemoButton");
const publishDemoModal = document.querySelector("#publishDemoModal");
const publishDemoBadge = document.querySelector(".publish-demo-badge");
const publishDemoTitle = document.querySelector("#publishDemoTitle");
const publishDemoUrlInput = document.querySelector("#publishDemoUrl");
const publishDemoUrlLabel = document.querySelector("#publishDemoUrlLabel");
const publishDemoExpiry = document.querySelector("#publishDemoExpiry");
const publishDemoOpenLink = document.querySelector("#publishDemoOpenLink");
const publishDemoCopyButton = document.querySelector("#publishDemoCopyButton");
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
const addMenuProductButton = document.querySelector("#addMenuProductButton");
const menuProductList = document.querySelector("#menuProductList");
const menuProductModal = document.querySelector("#menuProductModal");
const menuProductModalTitle = document.querySelector("#menuProductModalTitle");
const closeMenuProductModalButton = document.querySelector("#closeMenuProductModalButton");
const cancelMenuProductButton = document.querySelector("#cancelMenuProductButton");
const saveMenuProductButton = document.querySelector("#saveMenuProductButton");
const menuProductAllergens = document.querySelector("#menuProductAllergens");
const menuCategoryOptions = document.querySelector("#menuCategoryOptions");
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
const menuProductFields = {
  id: document.querySelector("#menuProductId"),
  name: document.querySelector("#menuProductName"),
  desc: document.querySelector("#menuProductDesc"),
  price: document.querySelector("#menuProductPrice"),
  category: document.querySelector("#menuProductCategory"),
  emoji: document.querySelector("#menuProductEmoji"),
  featured: document.querySelector("#menuProductFeatured")
};
let menuProductAllergenFields = [];

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
const publicRuntime = window.LocalLiftStudio.publicRuntime.createPublicRuntime({
  apiUrl,
  getCurrentBusinessRecord: () => currentBusinessRecord,
  slugify,
  textOr,
  toDatetimeLocalValue
});
const {
  attachLeadForms,
  attachPublicBookingForms,
  attachTracking,
  getPublicLeadEndpoint,
  getPublicBookingEndpoint
} = publicRuntime;
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
const chatbotController = window.LocalLiftStudio.chatbot.createChatbotController({
  core: window.LocalLiftStudio.core,
  runtime: publicRuntime
});
const { attachChatbot } = chatbotController;
const storefrontController = window.LocalLiftStudio.storefront.createStorefrontController({
  commerce: commerceModel,
  core: window.LocalLiftStudio.core,
  demoBusiness,
  renderProductCard,
  trackEvent: publicRuntime.trackEvent
});
const { attachStore } = storefrontController;
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
const deliveryController = window.LocalLiftStudio.delivery.createDeliveryController({
  apiHeaders,
  apiUrl,
  buildDeliveryReport,
  dataVersion: DATA_VERSION,
  defaultSectionOrder: DEFAULT_SECTION_ORDER,
  estimateDeliveryAssets,
  getCurrentBusinessRecord: () => currentBusinessRecord,
  isSectionVisible,
  normalizeSectionOrder,
  saveBusinessToApi,
  sectionBaseKey,
  setCurrentBusinessRecord: (record) => {
    currentBusinessRecord = record;
  },
  slugify,
  storeApiRecord,
  studioExporter,
  toApiRecordMeta,
  withBusinessDefaults
});
const {
  downloadSite,
  publishDemo,
  normalizeActiveDemo,
  showPublishDemoModal,
  showPublishDemoErrorModal,
  hidePublishDemoModal,
  setPublishDemoCopyState,
  getPublishErrorMessage,
  getUnshareableDemoMessage,
  rememberPublishedDemo,
  downloadDeliveryPackage,
  downloadBusinessData,
  copyTextToClipboard,
  formatDateTime
} = deliveryController;
let currentBusiness = withBusinessDefaults(draftStore.load() || cloneData(defaultSectorPreset));
let currentBusinessRecord = null;
let lastVisualQaPayload = null;
let menu = normalizeMenuItems(currentBusiness.menuItems);
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
const trackedStockDownloads = new Set();
let radarLaunchImageContext = null;
const siteImageController = window.LocalLiftStudio.siteImages.createSiteImageController({
  apiHeaders,
  apiUrl,
  businessFromForm,
  cloneData,
  core: window.LocalLiftStudio.core,
  demoBusiness,
  getRadarLaunchContext: () => radarLaunchImageContext,
  getStockImageState: () => stockImageState,
  mediaCreditMetadata,
  mediaLibrary,
  mergeMediaMetadata,
  renderMediaLibrary,
  renderStockImageStatus,
  renderStockImages,
  runQuickMutation,
  setChecked,
  setStatus,
  setStockImageState: (state) => {
    stockImageState = state;
  },
  setValue,
  trackStockImageDownload
});
const {
  bind: bindSiteImageGenerator,
  createRadarLaunchContext: createRadarLaunchImageContext,
  maybeAutoGenerateRadarSiteImages
} = siteImageController;
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
    document.body.innerHTML = '<main class="boot-error"><h1>No se pudo iniciar DLS Studio</h1><p>Faltan elementos esenciales de la interfaz. Revisa workspace.html.</p></main>';
    return;
  }

  const requestedBusinessRef = getRequestedBusinessRef();
  const briefLaunchBusiness = consumeBriefHandoff();
  if (briefLaunchBusiness) {
    currentBusinessRecord = null;
    storeApiRecord(null);
    currentBusiness = briefLaunchBusiness;
  } else if (requestedBusinessRef) {
    pinRequestedBusinessRecord(requestedBusinessRef);
  }
  radarLaunchImageContext = createRadarLaunchImageContext(currentBusiness);

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
  bindMenuProductEditor();
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
  if (briefLaunchBusiness) {
    setStatus(`Brief importado: ${currentBusiness.name}. Web generada y lista para revisar.`);
  } else if (requestedBusinessRef) {
    loadRequestedBusinessFromApi(requestedBusinessRef);
  }
  maybeAutoGenerateRadarSiteImages(radarLaunchImageContext);
  form.addEventListener("input", (event) => {
    if (event.target.closest("#menuProductModal")) {
      return;
    }
    markCustomDesignPack(event.target);
    if (event.target?.name === "menuCurrency") {
      renderMenuProductEditor();
    }
    syncSegmentedControls();
    syncDesignPackState();
    syncQuickToggleState();
    scheduleRenderFromForm();
  });
  form.addEventListener("focusin", () => {
    if (document.activeElement?.closest("#menuProductModal")) {
      return;
    }
    editorEditStart = cloneData(businessFromForm());
  });
  form.addEventListener("change", (event) => {
    if (event.target.closest("#menuProductModal")) {
      return;
    }
    editorHistory.record(editorEditStart || currentBusiness);
    editorEditStart = null;
    updateHistoryButtons();
    markCustomDesignPack(event.target);
    if (event.target?.name === "menuCurrency") {
      renderMenuProductEditor();
    }
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
    ? `${builtInItems.length} fotos incluidas - buscando nuevas online...`
    : "Preparando catalogo profesional...");
  if (stockLoadMoreButton) {
    stockLoadMoreButton.hidden = true;
  }

  try {
    const result = await stockImageSearch.discover({ minItems: 120, targetItems: 220, maxPages: 1 });
    const items = mergeStockImageItems(result.items, builtInItems, 240);
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
    trackStockImageDownload(item);
  } catch (error) {
    setStatus(error?.message || "No se pudo guardar esa imagen.");
  }
}

function trackStockImageDownload(item = {}) {
  const downloadLocation = normalizeOptionalUrl(item.downloadLocation || item.download_location);
  const provider = String(item.provider || "").toLowerCase();

  if (!downloadLocation || provider !== "unsplash" || trackedStockDownloads.has(downloadLocation)) {
    return;
  }

  trackedStockDownloads.add(downloadLocation);
  fetch(apiUrl("/api/stock-images/download"), {
    method: "POST",
    headers: apiHeaders({ json: true }),
    body: JSON.stringify({ downloadLocation })
  }).catch(() => {
    trackedStockDownloads.delete(downloadLocation);
  });
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
  trackStockImageDownload(selectedStockImage);
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
      conversionGoal: "Objetivo principal",
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

function consumeBriefHandoff() {
  const params = new URLSearchParams(window.location.search);
  const fromBrief = ["1", "true", "yes"].includes(String(params.get("fromBrief") || "").toLowerCase());

  if (!fromBrief) {
    return null;
  }

  try {
    const raw = localStorage.getItem(BRIEF_HANDOFF_STORAGE_KEY);
    localStorage.removeItem(BRIEF_HANDOFF_STORAGE_KEY);

    if (!raw) {
      setStatus("No se encontro un brief para importar. Se mantiene la demo actual.");
      return null;
    }

    const payload = JSON.parse(raw);
    return normalizeImportedBusiness(payload.business || payload);
  } catch (error) {
    setStatus("No se pudo importar el brief. Se mantiene la demo actual.");
    return null;
  }
}

function getRequestedBusinessRef() {
  const params = new URLSearchParams(window.location.search);
  return ["business", "project", "id", "slug"]
    .map((key) => String(params.get(key) || "").trim())
    .find(Boolean) || "";
}

function pinRequestedBusinessRecord(ref) {
  currentBusinessRecord = {
    id: ref,
    slug: "",
    name: "",
    plan: "",
    status: "",
    publishedUrl: "",
    activeDemo: null
  };
  storeApiRecord(currentBusinessRecord);
}

async function loadRequestedBusinessFromApi(ref) {
  setStatus(`Cargando proyecto: ${ref}...`);

  try {
    applyBusinessRecord(await fetchBusinessFromApi(ref));
    setStatus(`Proyecto cargado: ${currentBusinessRecord?.name || ref}. Los cambios se guardaran en este mismo proyecto.`);
  } catch (error) {
    pinRequestedBusinessRecord(ref);
    setStatus("No se pudo cargar el proyecto desde la API. No se creara una copia; al guardar se intentara actualizar ese mismo proyecto.");
  }
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
  publishDemoModal?.querySelectorAll("[data-publish-demo-close]").forEach((button) => {
    button.addEventListener("click", hidePublishDemoModal);
  });

  publishDemoUrlInput?.addEventListener("focus", () => {
    publishDemoUrlInput.select();
  });

  publishDemoCopyButton?.addEventListener("click", async () => {
    const url = publishDemoUrlInput?.value || "";

    if (!url) {
      return;
    }

    const copied = await copyTextToClipboard(url);
    setPublishDemoCopyState(copied ? "Copiado" : "No se pudo copiar");
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !publishDemoModal?.hidden) {
      hidePublishDemoModal();
    }
  });

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

  visualQaRunButton?.addEventListener("click", runVisualQaFromStudio);
  visualQaFixButton?.addEventListener("click", applyVisualQaAutoFixes);

  publishDemoButton?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;

    try {
      currentBusiness = businessFromForm();
      const validation = validateBusiness(currentBusiness);
      if (!validation.ok) {
        renderQualityPanel(currentBusiness);
        renderDeliveryReport(currentBusiness);
        setStatus(`Publicacion bloqueada: corrige ${validation.errors.length} error(es) de entrega.`);
        return;
      }

      setStatus("Publicando demo temporal en el servidor...");
      const demo = await publishDemo(currentBusiness);
      const activeDemo = normalizeActiveDemo(demo);
      const expiresText = activeDemo.expiresAt ? ` Caduca: ${formatDateTime(activeDemo.expiresAt)}.` : "";

      if (!activeDemo.shareable) {
        const message = getUnshareableDemoMessage(activeDemo);
        setStatus(message, {
          href: activeDemo.url,
          label: activeDemo.url
        });
        showPublishDemoModal(activeDemo, false);
        return;
      }

      setStatus(`Demo publicada. URL lista para enviar.${expiresText}`, {
        href: activeDemo.url,
        label: activeDemo.url
      });
      showPublishDemoModal(activeDemo, false);

      rememberPublishedDemo(currentBusiness, activeDemo)
        .then(() => {
          setStatus(`Demo publicada. URL guardada en Proyectos.${expiresText}`, {
            href: activeDemo.url,
            label: activeDemo.url
          });
        })
        .catch(() => {
          setStatus(`Demo publicada. No se pudo guardar en Proyectos, pero el enlace funciona.${expiresText}`, {
            href: activeDemo.url,
            label: activeDemo.url
          });
        });
    } catch (error) {
      const endpoint = apiUrl("/api/demo-publish");
      const message = getPublishErrorMessage(error, endpoint);
      setStatus(message);
      showPublishDemoErrorModal(message, endpoint);
    } finally {
      button.disabled = false;
    }
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
  if (
    !cursorGlow
    || window.getComputedStyle(cursorGlow).display === "none"
    || window.matchMedia("(pointer: coarse), (prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  let cursorFrame = 0;
  let cursorX = window.innerWidth / 2;
  let cursorY = window.innerHeight * 0.2;

  const paintCursor = () => {
    cursorFrame = 0;
    cursorGlow.style.setProperty("--cursor-x", `${Math.round((cursorX / window.innerWidth) * 100)}%`);
    cursorGlow.style.setProperty("--cursor-y", `${Math.round((cursorY / window.innerHeight) * 100)}%`);
  };

  window.addEventListener("pointermove", (event) => {
    cursorX = event.clientX;
    cursorY = event.clientY;
    if (!cursorFrame) {
      cursorFrame = window.requestAnimationFrame(paintCursor);
    }
  }, { passive: true });
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
  menu = normalizeMenuItems(resolved.menuItems);
  setValue("menuItems", serializeMenuItems(menu));
  renderMenuProductEditor();
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

function bindMenuProductEditor() {
  if (!menuProductList || !addMenuProductButton || !menuProductModal) {
    return;
  }

  renderMenuProductAllergenOptions();
  setMenuProductFieldsDisabled(true);

  addMenuProductButton.addEventListener("click", () => openMenuProductModal());
  closeMenuProductModalButton?.addEventListener("click", closeMenuProductModal);
  cancelMenuProductButton?.addEventListener("click", closeMenuProductModal);
  saveMenuProductButton?.addEventListener("click", saveMenuProduct);
  menuProductModal.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && event.target?.tagName !== "TEXTAREA") {
      event.preventDefault();
      saveMenuProduct();
    }
  });

  menuProductList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-menu-action]");
    if (!button) {
      return;
    }

    const item = menu.find((dish) => dish.id === button.dataset.menuId);
    if (button.dataset.menuAction === "edit" && item) {
      openMenuProductModal(item);
    }

    if (button.dataset.menuAction === "delete" && item) {
      deleteMenuProduct(item);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !menuProductModal.hidden) {
      closeMenuProductModal();
    }
  });
}

function renderMenuProductEditor() {
  if (!menuProductList) {
    return;
  }

  menu = normalizeMenuItems(menu);
  syncMenuProductField();
  renderMenuCategoryOptions();

  if (!menu.length) {
    menuProductList.innerHTML = '<p class="menu-product-empty" role="listitem">Todavia no hay platos. Anade el primero para activar la carta.</p>';
    return;
  }

  menuProductList.innerHTML = menu.map((item) => {
    const allergenBadges = renderMenuProductAllergenBadges(item.allergens, "menu-product-allergen-list");
    return `
    <article class="menu-product-row" role="listitem">
      <span class="menu-product-icon" aria-hidden="true">${escapeHtml(item.emoji)}</span>
      <div class="menu-product-copy">
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.category)}${item.featured ? " · Destacado" : ""}</p>
        <span>${escapeHtml(item.description)}</span>
        ${allergenBadges}
      </div>
      <strong class="menu-product-price">${escapeHtml(formatMoney(item.price, form.elements.menuCurrency?.value || "EUR"))}</strong>
      <div class="menu-product-row-actions" aria-label="Acciones de ${escapeAttr(item.name)}">
        <button class="menu-icon-button" type="button" data-menu-action="edit" data-menu-id="${escapeAttr(item.id)}" aria-label="Editar ${escapeAttr(item.name)}">✎</button>
        <button class="menu-icon-button is-danger" type="button" data-menu-action="delete" data-menu-id="${escapeAttr(item.id)}" aria-label="Eliminar ${escapeAttr(item.name)}">×</button>
      </div>
    </article>
  `;
  }).join("");
}

function renderMenuCategoryOptions() {
  if (!menuCategoryOptions) {
    return;
  }

  const categories = [...new Set(menu.map((item) => item.category).filter(Boolean))];
  menuCategoryOptions.innerHTML = categories
    .map((category) => `<option value="${escapeAttr(category)}"></option>`)
    .join("");
}

function renderMenuProductAllergenOptions() {
  if (!menuProductAllergens) {
    return;
  }

  menuProductAllergens.innerHTML = (menuAllergens || []).map((allergen) => `
    <label class="menu-allergen-option" title="${escapeAttr(allergen.label)}">
      <input type="checkbox" value="${escapeAttr(allergen.id)}" data-menu-allergen-field disabled>
      <span class="menu-allergen-symbol" aria-hidden="true">
        ${allergen.icon
          ? `<img class="menu-allergen-icon" src="${escapeAttr(allergen.icon)}" alt="" loading="lazy">`
          : escapeHtml(allergen.symbol)}
      </span>
      <span class="menu-allergen-label">${escapeHtml(allergen.label)}</span>
    </label>
  `).join("");
  menuProductAllergenFields = Array.from(menuProductAllergens.querySelectorAll("[data-menu-allergen-field]"));
}

function renderMenuProductAllergenBadges(value, className = "menu-product-allergen-list") {
  const allergens = normalizeMenuAllergens(value)
    .map((id) => getMenuAllergen(id))
    .filter(Boolean);

  if (!allergens.length) {
    return "";
  }

  const label = allergens.map((allergen) => allergen.label).join(", ");
  return `
    <div class="${escapeAttr(className)}" aria-label="Alergenos: ${escapeAttr(label)}">
      ${allergens.map((allergen) => `
        <span class="menu-allergen-badge" title="${escapeAttr(allergen.label)}" aria-label="${escapeAttr(allergen.label)}">
          ${allergen.icon
            ? `<img class="menu-allergen-icon" src="${escapeAttr(allergen.icon)}" alt="" loading="lazy">`
            : `<span aria-hidden="true">${escapeHtml(allergen.symbol)}</span>`}
          <span class="sr-only">${escapeHtml(allergen.label)}</span>
        </span>
      `).join("")}
    </div>
  `;
}

function syncMenuProductField() {
  setValue("menuItems", serializeMenuItems(menu));
}

function getMenuProductControls() {
  return [
    ...Object.values(menuProductFields),
    ...menuProductAllergenFields
  ].filter(Boolean);
}

function setMenuProductFieldsDisabled(disabled) {
  getMenuProductControls().forEach((field) => {
    if (field) {
      field.disabled = disabled;
    }
  });
}

function openMenuProductModal(item = null) {
  if (!menuProductModal) {
    return;
  }

  setMenuProductFieldsDisabled(false);
  menuProductModal.hidden = false;
  menuProductModalTitle.textContent = item ? "Editar plato" : "Anadir plato";
  menuProductFields.id.value = item?.id || "";
  menuProductFields.name.value = item?.name || "";
  menuProductFields.desc.value = item?.description || item?.desc || "";
  menuProductFields.price.value = item ? formatPlainPrice(item.price) : "";
  menuProductFields.category.value = item?.category || item?.cat || "";
  menuProductFields.emoji.value = item?.emoji || "🍽";
  menuProductFields.featured.checked = Boolean(item?.featured);
  const selectedAllergens = normalizeMenuAllergens(item?.allergens);
  menuProductAllergenFields.forEach((field) => {
    field.checked = selectedAllergens.includes(field.value);
  });
  menuProductModal.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => menuProductFields.name?.focus(), 120);
}

function closeMenuProductModal() {
  if (!menuProductModal) {
    return;
  }

  menuProductModal.hidden = true;
  getMenuProductControls().forEach((field) => {
    if (!field) return;
    if (field.type === "checkbox") {
      field.checked = false;
    } else {
      field.value = "";
    }
  });
  setMenuProductFieldsDisabled(true);
  addMenuProductButton?.focus();
}

function saveMenuProduct() {
  const requiredFields = [
    menuProductFields.name,
    menuProductFields.desc,
    menuProductFields.price,
    menuProductFields.category,
    menuProductFields.emoji
  ];
  const invalidField = requiredFields.find((field) => !field?.checkValidity());

  if (invalidField) {
    invalidField.reportValidity();
    return;
  }

  editorHistory.record(businessFromForm());

  const idBase = slugify(`${menuProductFields.category.value}-${menuProductFields.name.value}`) || "plato";
  const id = menuProductFields.id.value || `${idBase}-${Date.now().toString(36)}`;
  const dish = normalizeMenuItem({
    id,
    name: menuProductFields.name.value,
    desc: menuProductFields.desc.value,
    precio: parsePrice(menuProductFields.price.value),
    cat: menuProductFields.category.value,
    emoji: menuProductFields.emoji.value,
    allergens: menuProductAllergenFields
      .filter((field) => field.checked)
      .map((field) => field.value),
    featured: menuProductFields.featured.checked
  }, menu.length);
  const existingIndex = menu.findIndex((item) => item.id === dish.id);

  if (existingIndex >= 0) {
    menu[existingIndex] = dish;
  } else {
    menu.push(dish);
  }

  menu = normalizeMenuItems(menu);
  syncMenuProductField();
  renderMenuProductEditor();
  closeMenuProductModal();
  renderFromForm();
  updateHistoryButtons();
  setStatus(`Carta actualizada: ${dish.name}.`);
}

function deleteMenuProduct(item) {
  if (!window.confirm(`Eliminar "${item.name}" de la carta?`)) {
    return;
  }

  editorHistory.record(businessFromForm());
  menu = menu.filter((dish) => dish.id !== item.id);
  syncMenuProductField();
  renderMenuProductEditor();
  renderFromForm();
  updateHistoryButtons();
  setStatus(`Plato eliminado: ${item.name}.`);
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
          conversionGoal: `Disponibilidad y contacto directo para ${category} en ${location}`,
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
          conversionGoal: `Reservas y consultas por WhatsApp para ${name}`,
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
      setValue("conversionGoal", `Compra online y consultas de producto para ${name}`);
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

async function runVisualQaFromStudio(event) {
  const button = event?.currentTarget || visualQaRunButton;
  if (button) {
    button.disabled = true;
    button.textContent = "Analizando...";
  }
  if (visualQaFixButton) {
    visualQaFixButton.disabled = true;
  }

  try {
    currentBusiness = businessFromForm();
    renderQualityPanel(currentBusiness);
    renderVisualQaPending("Analizando web actual...");
    setStatus("QA visual profundo en marcha: desktop, tablet y movil a 390/320 px.");

    const resolved = withBusinessDefaults(currentBusiness);
    const html = await studioExporter.buildExportDocument(resolved);
    const response = await fetch(apiUrl("/api/qa-visual"), {
      method: "POST",
      headers: apiHeaders({ json: true }),
      body: JSON.stringify({
        html,
        business: {
          id: currentBusinessRecord?.id || resolved.id || "",
          slug: currentBusinessRecord?.slug || resolved.slug || slugify(resolved.name || ""),
          name: resolved.name,
          category: resolved.category,
          location: resolved.location || resolved.address || ""
        },
        viewports: ["desktop", "tablet", "mobile"]
      })
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.error || payload.detail || "Visual QA request failed");
    }

    lastVisualQaPayload = payload;
    renderVisualQaPayload(payload);

    const totals = payload.report?.totals || {};
    setStatus(`QA visual completada: ${totals.blockers || 0} bloqueos y ${totals.warnings || 0} avisos.`);
  } catch (error) {
    lastVisualQaPayload = null;
    renderVisualQaError(getVisualQaErrorMessage(error));
    setStatus(getVisualQaErrorMessage(error));
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Analizar QA visual";
    }
    if (visualQaFixButton) {
      visualQaFixButton.disabled = false;
    }
  }
}

function applyVisualQaAutoFixes(event) {
  const button = event?.currentTarget || visualQaFixButton;
  if (button) {
    button.disabled = true;
    button.textContent = "Corrigiendo...";
  }

  try {
    const report = lastVisualQaPayload?.report || null;
    const issues = getVisualQaIssues(report);
    const codes = new Set(issues.map((issue) => issue.code));
    const hadReport = Boolean(report);
    const snapshot = businessFromForm();
    const validation = validateBusiness(snapshot);
    const applied = [];

    editorHistory.record(snapshot);

    if (!hadReport || hasAnyVisualQaCode(codes, [
      "horizontal-overflow",
      "horizontal-overflow-source",
      "interactive-covered",
      "text-covered",
      "touch-target-small",
      "image-mostly-clipped",
      "image-partially-clipped",
      "image-cover-severe-crop",
      "image-covered",
      "text-clipped",
      "text-mostly-clipped",
      "text-size-critical"
    ])) {
      setValue("designPack", "custom");
      setRadioValue("contentDensity", "compact");
      setRadioValue("heroSize", "compact");
      setRadioValue("contentWidth", "focused");
      setRadioValue("imageRatio", "square");
      setRadioValue("typography", "compact");
      setRadioValue("motion", "soft");
      setValue("fontScale", Math.min(100, numberOr(form.elements.fontScale?.value, 100)));
      setValue("layoutScale", Math.min(88, numberOr(form.elements.layoutScale?.value, 100)));
      setChecked("premiumEffects", false);
      applied.push("Layout compacto para movil y sin efectos pesados.");
    }

    if (hasAnyVisualQaCode(codes, ["interactive-covered", "text-covered", "horizontal-overflow"]) && form.elements.showConversionDock?.checked) {
      setChecked("showConversionDock", false);
      applied.push("Dock flotante ocultado para evitar solapes.");
    }

    if (!hadReport || hasAnyVisualQaCode(codes, ["contrast-low", "contrast-rendered-low", "focus-not-visible"])) {
      applyHighContrastPrimaryButton();
      applied.push("Boton principal con contraste alto y sin neon.");
    }

    const updatedImageAlts = ensureVisualQaImageMetadata(snapshot);
    if (updatedImageAlts > 0) {
      applied.push(`${updatedImageAlts} texto(s) alternativo(s) de imagen completados.`);
    }

    if (validation.errors.some((issue) => issue.code === "missing_privacy") && !form.elements.privacyUrl?.value.trim()) {
      setValue("privacyUrl", "pages/privacy-demo.html");
      applied.push("Privacidad enlazada a la plantilla demo.");
    }

    if (!applied.length) {
      renderVisualQaFixResult(["No habia correcciones automaticas seguras para aplicar."]);
      setStatus("QA visual: no habia correcciones automaticas seguras para aplicar.");
      return;
    }

    syncSegmentedControls();
    syncDesignPackState();
    syncQuickToggleState();
    renderFromForm();
    updateHistoryButtons();
    lastVisualQaPayload = null;
    renderVisualQaFixResult(applied);
    setStatus(`Correccion automatica aplicada: ${applied.length} ajuste(s). Ejecuta de nuevo QA visual para confirmar.`);
  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Corregir automatico";
    }
  }
}

function renderVisualQaPending(message) {
  if (visualQaStatus) {
    visualQaStatus.textContent = "Analizando";
    visualQaStatus.className = "is-running";
  }
  if (visualQaResult) {
    visualQaResult.innerHTML = `<p class="visual-qa-muted">${escapeHtml(message)}</p>`;
  }
}

function renderVisualQaPayload(payload) {
  if (!visualQaStatus || !visualQaResult) {
    return;
  }

  const report = payload.report || {};
  const totals = report.totals || {};
  const blockers = totals.blockers || 0;
  const warnings = totals.warnings || 0;
  const issues = getVisualQaIssues(report);
  const tone = blockers ? "blocked" : warnings ? "warning" : "ready";
  const label = blockers ? `${blockers} bloqueo${blockers === 1 ? "" : "s"}` : warnings ? `${warnings} aviso${warnings === 1 ? "" : "s"}` : "QA limpio";
  const topIssues = prioritizeVisualQaIssues(issues).slice(0, 5);
  const reportLink = payload.reportUrl
    ? `<a href="${escapeAttr(payload.reportUrl)}" target="_blank" rel="noopener">Abrir reporte completo</a>`
    : "";

  visualQaStatus.textContent = label;
  visualQaStatus.className = `is-${tone}`;
  visualQaResult.innerHTML = `
    <div class="visual-qa-summary is-${tone}">
      <span><b>${blockers}</b> bloqueos</span>
      <span><b>${warnings}</b> avisos</span>
      <span><b>${totals.viewports || 0}</b> vistas</span>
    </div>
    ${topIssues.length ? `
      <div class="visual-qa-issues">
        ${topIssues.map(renderVisualQaIssue).join("")}
      </div>
    ` : '<p class="visual-qa-muted">Sin incidencias detectadas.</p>'}
    ${reportLink ? `<div class="visual-qa-report-link">${reportLink}</div>` : ""}
  `;
}

function renderVisualQaIssue(issue) {
  return `
    <article class="visual-qa-issue is-${escapeAttr(issue.severity)}">
      <strong>${escapeHtml(issue.viewport || "vista")} - ${escapeHtml(issue.code)}</strong>
      <span>${escapeHtml(issue.message)}</span>
      ${issue.selector ? `<code>${escapeHtml(issue.selector)}</code>` : ""}
    </article>
  `;
}

function renderVisualQaFixResult(items) {
  if (visualQaStatus) {
    visualQaStatus.textContent = "Correcciones aplicadas";
    visualQaStatus.className = "is-warning";
  }
  if (visualQaResult) {
    visualQaResult.innerHTML = `
      <div class="visual-qa-issues">
        ${items.map((item) => `
          <article class="visual-qa-issue is-info">
            <strong>Ajuste</strong>
            <span>${escapeHtml(item)}</span>
          </article>
        `).join("")}
      </div>
    `;
  }
}

function renderVisualQaError(message) {
  if (visualQaStatus) {
    visualQaStatus.textContent = "No disponible";
    visualQaStatus.className = "is-blocked";
  }
  if (visualQaResult) {
    visualQaResult.innerHTML = `
      <article class="visual-qa-issue is-blocker">
        <strong>QA visual</strong>
        <span>${escapeHtml(message)}</span>
      </article>
    `;
  }
}

function getVisualQaIssues(report) {
  return (report?.viewports || []).flatMap((run) => {
    const viewport = run.viewport?.name || "";
    return (run.issues || []).map((issue) => ({ ...issue, viewport }));
  });
}

function prioritizeVisualQaIssues(issues) {
  const severityPriority = { blocker: 0, warning: 1, info: 2 };
  const viewportPriority = {
    "mobile-narrow": 0,
    mobile: 1,
    tablet: 2,
    desktop: 3
  };

  return [...issues].sort((left, right) => {
    const severity = (severityPriority[left.severity] ?? 9) - (severityPriority[right.severity] ?? 9);
    if (severity) return severity;
    const viewport = (viewportPriority[left.viewport] ?? 9) - (viewportPriority[right.viewport] ?? 9);
    if (viewport) return viewport;
    return String(left.code || "").localeCompare(String(right.code || ""), "es");
  });
}

function hasAnyVisualQaCode(codes, expected) {
  return expected.some((code) => codes.has(code));
}

function applyHighContrastPrimaryButton() {
  const styles = readButtonStyles(form.elements.buttonStyles?.value);
  styles.primary = {
    ...(styles.primary || {}),
    background: "#111316",
    textColor: "#ffffff",
    neon: false,
    glowStrength: 0
  };
  setValue("buttonStyles", JSON.stringify(normalizeButtonStyles(styles)));
}

function ensureVisualQaImageMetadata(business) {
  const metadata = readMediaMetadata(form.elements.mediaMetadata?.value);
  const name = textOr(business.name, "este negocio");
  const category = textOr(business.category, "negocio local");
  const images = [
    { url: normalizeImage(form.elements.heroImage?.value, ""), alt: `Portada de ${name}, ${category}` },
    ...parseLines(form.elements.gallery?.value).map((url, index) => ({
      url: normalizeImage(url, ""),
      alt: `Imagen ${index + 1} de ${name}`
    }))
  ].filter((item) => item.url);
  let updated = 0;

  images.forEach((item) => {
    const current = metadata[item.url] || {};
    if (!String(current.alt || "").trim()) {
      metadata[item.url] = {
        ...current,
        alt: item.alt,
        position: current.position || "center center"
      };
      updated += 1;
    }
  });

  if (updated > 0) {
    setValue("mediaMetadata", JSON.stringify(normalizeMediaMetadata(metadata)));
  }

  return updated;
}

function getVisualQaErrorMessage(error) {
  const message = error?.message || "";

  if (/chrome|edge/i.test(message)) {
    return "Chrome o Edge no esta disponible para ejecutar el QA visual headless.";
  }

  if (/fetch|failed|network|load/i.test(message)) {
    return "No se pudo conectar con /api/qa-visual. Abre el Studio desde npm.cmd start.";
  }

  if (/timed out|timeout/i.test(message)) {
    return "El QA visual tardo demasiado. Prueba otra vez o usa npm.cmd run qa:visual.";
  }

  return message || "No se pudo ejecutar el QA visual.";
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
      ? "La entrega supera los bloqueos criticos y puede exportarse para revision final."
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
    { label: "Objetivo principal claro", done: Boolean(business.conversionGoal) },
    { label: "CTA principal con enlace real", done: Boolean(business.bookingUrl && business.bookingUrl !== "#contacto") },
    { label: "Minimo 3 servicios y 3 fotos", done: business.services.length >= 3 && business.gallery.length >= 3 },
    { label: "Resenas y confianza visibles", done: business.testimonials.length >= 2 && business.trustBadges.length >= 2 },
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
  const studioUpdatedAt = business.updatedFromStudioAt || new Date().toISOString();
  const activeDemo = normalizeActiveDemoForApiPayload(
    business.activeDemo || record?.activeDemo || null,
    studioUpdatedAt,
    Boolean(business.activeDemo)
  );

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
      status: business.status || record?.status || "in-design",
      publishedUrl: business.publishedUrl || record?.publishedUrl || "",
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
        activeDemo,
        source: "studio",
        updatedFromStudioAt: studioUpdatedAt
      },
      content: withBusinessDefaults(business)
    }
  };
}

function normalizeActiveDemoForApiPayload(activeDemo, studioUpdatedAt, isFreshPublish) {
  if (!activeDemo) {
    return null;
  }

  const demo = { ...activeDemo };

  if (isFreshPublish && !demo.updatedFromStudioAt) {
    demo.updatedFromStudioAt = studioUpdatedAt;
  }

  return demo;
}

function getStoredApiRecord() {
  return businessDataClient.getStoredRecord();
}

function storeApiRecord(record) {
  businessDataClient.storeRecord(record);
}

function mergeMediaMetadata(url, changes = {}) {
  const metadata = readMediaMetadata(form.elements.mediaMetadata?.value);
  metadata[url] = {
    ...(metadata[url] || {}),
    ...changes
  };
  setValue("mediaMetadata", JSON.stringify(normalizeMediaMetadata(metadata)));
}

function setStatus(message, action = {}) {
  statusLine.textContent = "";
  const text = document.createElement("span");
  text.textContent = message;
  statusLine.appendChild(text);

  if (action.href) {
    const separator = document.createTextNode(" ");
    const link = document.createElement("a");
    link.href = action.href;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = action.label || action.href;
    statusLine.append(separator, link);
  }
}
