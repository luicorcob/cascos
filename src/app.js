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
const {
  SECTION_DEFINITIONS,
  DEFAULT_SECTION_ORDER,
  BLOCK_LIBRARY,
  DEFAULT_BLOCK_VARIANTS,
  LAYOUT_RECIPES,
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
const qualityScore = document.querySelector("#qualityScore");
const qualityChecklist = document.querySelector("#qualityChecklist");
const statusLine = document.querySelector("#statusLine");
const deviceFrame = document.querySelector(".device-frame");
const cursorGlow = document.querySelector(".cursor-glow");
const importDataInput = document.querySelector("#importDataInput");
const topbarProjectName = document.querySelector("#topbarProjectName");
const frameAddress = document.querySelector("#frameAddress");
const presentationModeButton = document.querySelector("#presentationModeButton");
const directEditButton = document.querySelector("#directEditButton");
const autoSaveState = document.querySelector("#autoSaveState");
const sectionOrderList = document.querySelector("#sectionOrderList");
const blockLibrary = document.querySelector("#blockLibrary");
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
const previewInspectorLinkLabel = document.querySelector("#previewInspectorLinkLabel");
const previewInspectorLinkUrl = document.querySelector("#previewInspectorLinkUrl");

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
  maxItems: 24,
  maxItemBytes: 900_000,
  maxTotalBytes: 2_000_000
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

init();

function init() {
  if (!form || !sitePreview || !previewTitle || !previewMetrics || !statusLine || !deviceFrame) {
    document.body.innerHTML = '<main class="boot-error"><h1>No se pudo iniciar LocalLift Studio</h1><p>Faltan elementos esenciales de la interfaz. Revisa index.html.</p></main>';
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
  bindDirectEditing();
  bindActions();
  bindPresentationMode();
  bindCursor();
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

    if (moveButton) {
      moveSection(moveButton.dataset.sectionMove, Number(moveButton.dataset.direction || 0));
    } else if (toggleButton) {
      const definition = SECTION_DEFINITIONS[toggleButton.dataset.sectionToggle];
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
  blockLibrary?.addEventListener("click", (event) => {
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
  });
}

function renderBlockLibrary(business = businessFromForm()) {
  if (!blockLibrary) {
    return;
  }

  const active = normalizeBlockVariants(business.blockVariants);
  blockLibrary.innerHTML = Object.entries(BLOCK_LIBRARY).map(([section, definition]) => `
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
        mergeMediaMetadata(item.url, { alt: item.alt || item.name });
      }, `"${item.name}" aplicada como portada.`);
    } else if (button.dataset.mediaAction === "gallery") {
      runQuickMutation(() => {
        const gallery = parseLines(form.elements.gallery?.value);
        if (!gallery.includes(item.url)) {
          setValue("gallery", [...gallery, item.url].slice(0, 12).join("\n"));
        }
        mergeMediaMetadata(item.url, { alt: item.alt || item.name });
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
  return escapeHtml([source, dimensions, weight].filter(Boolean).join(" - ") + warning);
}

function bindDirectEditing() {
  directEditButton?.addEventListener("click", () => {
    toggleDirectEditing();
  });
  document.querySelector("#previewInspectorClose")?.addEventListener("click", closePreviewInspector);
  document.querySelector("#previewInspectorImageApply")?.addEventListener("click", applyPreviewImageEdit);
  document.querySelector("#previewInspectorLinkApply")?.addEventListener("click", applyPreviewLinkEdit);
  previewInspectorImageUrl?.addEventListener("input", () => {
    previewInspectorImage.src = previewInspectorImageUrl.value;
  });
  previewInspectorMedia?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-inspector-media-id]");
    const item = mediaLibrary.list().find((candidate) => candidate.id === button?.dataset.inspectorMediaId);
    if (!item) {
      return;
    }
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
    ? "Edicion directa activa. Edita textos, imagenes, enlaces o el orden de las secciones."
    : "Edicion directa cerrada.");
}

function openPreviewImageInspector(element) {
  const business = businessFromForm();
  const field = element.dataset.editImageField || "";
  const list = element.dataset.editImageList || "";
  const index = Number(element.dataset.editIndex || 0);
  const url = field ? business[field] : business[list]?.[index];
  const metadata = business.mediaMetadata?.[url] || {};

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
      position: previewInspectorImagePosition.value
    });
  }, "Imagen actualizada desde la preview.");
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

  previewInspectorTarget = { type: "link", field, list, index };
  previewInspectorTitle.textContent = field === "booking" ? "Boton principal" : "Enlace";
  previewInspectorLinkLabel.value = values.label || "";
  previewInspectorLinkLabel.disabled = ["phone", "email"].includes(field);
  previewInspectorLinkUrl.value = values.url || "";
  showPreviewInspector("link");
}

function applyPreviewLinkEdit() {
  if (previewInspectorTarget?.type !== "link") {
    return;
  }
  const target = { ...previewInspectorTarget };
  const label = previewInspectorLinkLabel.value.trim();
  const url = previewInspectorLinkUrl.value.trim();
  if (!url || (!label && !["phone", "email"].includes(target.field))) {
    setStatus("El enlace necesita texto y destino.");
    return;
  }

  runQuickMutation(() => {
    if (target.field === "booking") {
      setValue("bookingLabel", label);
      setValue("bookingUrl", normalizeUrl(url));
      setChecked("showBooking", true);
    } else if (target.field === "phone" || target.field === "email") {
      setValue(target.field, url);
    } else if (target.list === "links") {
      const currentLinks = businessFromForm().links;
      const links = (currentLinks.length ? currentLinks : demoBusiness.links).map((item) => ({ ...item }));
      links[target.index] = { label, url: normalizeUrl(url) };
      setValue("links", links.map((item) => `${item.label} | ${item.url}`).join("\n"));
    }
  }, "Enlace actualizado desde la preview.");
  closePreviewInspector();
}

function showPreviewInspector(panel) {
  previewInspector.hidden = false;
  previewInspector.querySelectorAll("[data-inspector-panel]").forEach((element) => {
    element.hidden = element.dataset.inspectorPanel !== panel;
  });
  requestAnimationFrame(() => {
    previewInspector.querySelector(`[data-inspector-panel="${panel}"] input:not(:disabled)`)?.focus();
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
    const definition = SECTION_DEFINITIONS[key];
    if (!definition || section.querySelector(":scope > .preview-section-controls")) {
      return;
    }
    const index = order.indexOf(key);
    const controls = document.createElement("div");
    controls.className = "preview-section-controls";
    controls.innerHTML = `
      <strong>${escapeHtml(definition.label)}</strong>
      <button type="button" data-preview-section-action="up" data-section-key="${escapeAttr(key)}" ${index <= 0 ? "disabled" : ""}>Subir</button>
      <button type="button" data-preview-section-action="down" data-section-key="${escapeAttr(key)}" ${index < 0 || index >= order.length - 1 ? "disabled" : ""}>Bajar</button>
      ${definition.field ? `<button type="button" data-preview-section-action="hide" data-section-key="${escapeAttr(key)}">Ocultar</button>` : ""}
    `;
    section.prepend(controls);
  });
}

function handlePreviewSectionAction(button) {
  const section = button.dataset.sectionKey;
  if (button.dataset.previewSectionAction === "up") {
    moveSection(section, -1);
  } else if (button.dataset.previewSectionAction === "down") {
    moveSection(section, 1);
  } else if (button.dataset.previewSectionAction === "hide") {
    const field = SECTION_DEFINITIONS[section]?.field;
    if (field) {
      toggleQuickField(field);
    }
  }
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
    mediaMetadata: readMediaMetadata(data.get("mediaMetadata"))
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
      frameAddress.textContent = `locallift.site/${slugify(currentBusiness.name || "nuevo-negocio")}`;
    }
    renderPreviewMetrics(currentBusiness);
    renderQualityPanel(currentBusiness);
    sitePreview.innerHTML = renderSite(currentBusiness);
    attachGeneratedInteractions(sitePreview, currentBusiness);
    attachPreviewSectionControls();
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
    setStatus("Escribe un comando rapido: mas premium, vender reservas, sin mapa...");
    return;
  }

  const actions = [];

  if (matchesAny(command, ["premium", "lujo", "elegante", "caro"])) actions.push("premium");
  if (matchesAny(command, ["limpio", "minimal", "simple", "sobrio"])) actions.push("minimal");
  if (matchesAny(command, ["urgencia", "urgente", "oferta", "promocion"])) actions.push("urgent");
  if (matchesAny(command, ["confianza", "resena", "resenas", "opiniones", "google"])) actions.push("trust");
  if (matchesAny(command, ["reserva", "reservas", "cita", "agenda"])) actions.push("booking");
  if (matchesAny(command, ["pedido", "pedidos", "delivery", "comida", "whatsapp"])) actions.push("food");
  if (matchesAny(command, ["tienda", "compras", "compra online", "productos", "pagar", "stripe", "ecommerce"])) actions.push("store");
  if (matchesAny(command, ["local", "barrio", "cerca", "zona"])) actions.push("local");
  if (matchesAny(command, ["movil", "telefono", "mobile", "compacto"])) actions.push("mobile");
  if (matchesAny(command, ["letra grande", "texto grande", "mas grande", "fuente grande"])) actions.push("biggerType");
  if (matchesAny(command, ["mas aire", "mas espacio", "amplio", "dimensiones grandes"])) actions.push("moreSpace");
  if (matchesAny(command, ["fotos anchas", "imagenes anchas", "panoramico", "horizontal"])) actions.push("wideImages");

  if (matchesAny(command, ["sin mapa", "quitar mapa", "ocultar mapa"])) actions.push("hideMap");
  if (matchesAny(command, ["sin bot", "quitar bot", "ocultar bot"])) actions.push("hideBot");
  if (matchesAny(command, ["sin galeria", "quitar fotos", "menos fotos"])) actions.push("hideGallery");
  if (matchesAny(command, ["mostrar todo", "activar todo", "todo visible"])) actions.push("showAll");

  if (!actions.length) {
    setStatus("No entendi el comando. Prueba: mas premium, vender reservas, sin mapa, mostrar todo.");
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

function mutateQuickAction(action) {
  const business = businessFromForm();
  const name = business.name || "tu negocio";
  const category = business.category || "negocio local";
  const location = business.location || "tu zona";

  const actions = {
    surprise: () => {
      const packNames = Object.keys(designPacks);
      const currentPack = form.elements.designPack?.value;
      const availablePacks = packNames.filter((packName) => packName !== currentPack);
      const packName = availablePacks[Math.floor(Math.random() * availablePacks.length)] || packNames[0];
      const pack = designPacks[packName];
      const accentVariations = {
        boutique: ["#151816", "#384b44", "#8b4f42"],
        impact: ["#ff3d81", "#8c5cff", "#00a896"],
        clear: ["#2f6fed", "#16866f", "#c54a32"],
        commerce: ["#ff6a00", "#d83b27", "#19826b"],
        mobileFirst: ["#0f8f8f", "#3568a8", "#b14968"],
        localWarm: ["#cf3f2e", "#a65b2f", "#357b68"]
      };
      const accents = accentVariations[packName] || [pack.accent];

      applyDesignPackValues(packName, pack);
      setValue("accent", accents[Math.floor(Math.random() * accents.length)]);
      setChecked("showGallery", true);
      setChecked("showTrustRail", true);
      setChecked("showConversionDock", true);
    },
    premium: () => {
      setValue("designPack", "custom");
      setRadioValue("artDirection", "atelier");
      setRadioValue("contentMode", "visual");
      setRadioValue("theme", "luxe");
      setRadioValue("typography", "editorial");
      setRadioValue("motion", "cinematic");
      setRadioValue("visualShape", "clean");
      setRadioValue("contentDensity", "spacious");
      setValue("accent", "#111316");
      setValue("intensity", 82);
      setChecked("premiumEffects", true);
      setValue("tagline", `${name}: una experiencia local con presencia de marca premium`);
      setValue("servicesHeading", "Una propuesta cuidada desde el primer vistazo.");
      setValue("trustHeading", "La confianza se nota antes de llamar.");
    },
    minimal: () => {
      setValue("designPack", "custom");
      setRadioValue("artDirection", "editorial");
      setRadioValue("contentMode", "visual");
      setRadioValue("theme", "aurora");
      setRadioValue("typography", "modern");
      setRadioValue("motion", "soft");
      setRadioValue("visualShape", "sharp");
      setRadioValue("contentDensity", "compact");
      setValue("intensity", 50);
      setChecked("premiumEffects", false);
      setValue("servicesHeading", "Todo lo importante, sin ruido.");
      setValue("servicesIntro", "Servicios, horario, ubicacion y contacto quedan claros para decidir rapido.");
    },
    urgent: () => {
      setRadioValue("artDirection", "poster");
      setRadioValue("contentMode", "visual");
      setChecked("showAnnouncement", true);
      setValue("announcement", `Plazas y horarios limitados esta semana en ${name}.`);
      setValue("bookingLabel", "Reservar hoy");
      setValue("leadFormCta", "Quiero respuesta rapida");
      setValue("conversionGoal", `Generar solicitudes inmediatas para ${category} en ${location}`);
      setChecked("showLeadForm", true);
      setChecked("showConversionDock", true);
    },
    trust: () => {
      setRadioValue("artDirection", "editorial");
      setRadioValue("contentMode", "balanced");
      setChecked("showTrustRail", true);
      setChecked("showTestimonials", true);
      setChecked("showFaq", true);
      setChecked("googleEnabled", true);
      setValue("trustHeading", "Confianza clara antes de decidir.");
      setValue("trustIntro", "Opiniones, preguntas frecuentes y datos de contacto reducen dudas y acercan al cliente al siguiente paso.");
      setValue("trustBadges", [
        "Resenas y prueba social visibles",
        "Contacto directo y respuesta rapida",
        "Ubicacion verificada en mapa",
        "FAQ preparada para resolver dudas"
      ].join("\n"));
    },
    booking: () => {
      setRadioValue("artDirection", "cinematic");
      setRadioValue("contentMode", "visual");
      setChecked("showBooking", true);
      setChecked("showLeadForm", true);
      setChecked("showConversionDock", true);
      setValue("bookingLabel", "Reservar / pedir cita");
      setValue("conversionGoal", `Convertir visitas en reservas para ${name}`);
      setValue("leadFormTitle", "Pide disponibilidad sin llamadas innecesarias.");
      setValue("leadFormIntro", "Deja fecha, servicio y contacto. El negocio recibe una solicitud preparada para responder rapido.");
      setValue("leadFormCta", "Consultar disponibilidad");
    },
    food: () => {
      setValue("designPack", "custom");
      setRadioValue("artDirection", "poster");
      setRadioValue("contentMode", "visual");
      setRadioValue("theme", "neon");
      setRadioValue("motion", "bold");
      setRadioValue("contentDensity", "compact");
      setValue("accent", "#ff6a00");
      setValue("bookingLabel", "Pedir ahora");
      setValue("announcement", "Pide por WhatsApp y recoge sin esperas.");
      setChecked("showAnnouncement", true);
      setChecked("showConversionDock", true);
      setChecked("showMenu", true);
      setChecked("commerceEnabled", true);
      setValue("servicesHeading", "Menu claro para decidir rapido.");
      setValue("conversionGoal", `Pedidos, recogida y llamadas para ${name}`);
    },
    store: () => {
      setRadioValue("artDirection", "mosaic");
      setRadioValue("contentMode", "visual");
      setChecked("commerceEnabled", true);
      setChecked("showConversionDock", true);
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
      setValue("announcement", "Compra online activa con pago seguro.");
      setChecked("showAnnouncement", true);
    },
    local: () => {
      setRadioValue("artDirection", "cinematic");
      setRadioValue("contentMode", "balanced");
      setChecked("showMap", true);
      setChecked("googleEnabled", true);
      setValue("servicesIntro", `Una web pensada para que clientes de ${location} entiendan rapido que ofrece ${name}, como llegar y como contactar.`);
      setValue("directionsNote", `Ubicacion visible para llegar rapido desde ${location}, consultar ruta y evitar dudas antes de visitar.`);
      setValue("contactHeading", "Ven al local o escribe antes de pasar.");
    },
    mobile: () => {
      setRadioValue("artDirection", "poster");
      setRadioValue("contentMode", "visual");
      setRadioValue("contentDensity", "compact");
      setRadioValue("visualShape", "rounded");
      setRadioValue("heroSize", "compact");
      setRadioValue("contentWidth", "focused");
      setRadioValue("imageRatio", "square");
      setValue("fontScale", 100);
      setValue("layoutScale", 88);
      setChecked("showConversionDock", true);
      setChecked("showLeadForm", true);
      setValue("bookingLabel", "Contactar ahora");
      setDeviceSize("mobile");
    },
    biggerType: () => {
      setValue("designPack", "custom");
      setValue("fontScale", Math.min(120, numberOr(form.elements.fontScale.value, 100) + 10));
      setRadioValue("typography", "modern");
      setValue("intensity", Math.max(60, numberOr(form.elements.intensity.value, 78)));
    },
    moreSpace: () => {
      setValue("designPack", "custom");
      setRadioValue("contentDensity", "spacious");
      setRadioValue("heroSize", "immersive");
      setRadioValue("contentWidth", "wide");
      setValue("layoutScale", Math.min(120, numberOr(form.elements.layoutScale.value, 100) + 10));
    },
    wideImages: () => {
      setValue("designPack", "custom");
      setRadioValue("artDirection", "cinematic");
      setChecked("showGallery", true);
      setRadioValue("imageRatio", "wide");
      setRadioValue("contentWidth", "wide");
      setRadioValue("heroSize", "balanced");
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
    const definition = SECTION_DEFINITIONS[key];
    const field = definition.field ? form.elements[definition.field] : null;
    const active = !field || Boolean(field.checked);

    return `
      <div class="section-order-item ${active ? "is-active" : "is-hidden"}">
        <span class="section-order-index">${String(index + 1).padStart(2, "0")}</span>
        <strong>${escapeHtml(definition.label)}</strong>
        <div>
          <button type="button" data-section-move="${escapeAttr(key)}" data-direction="-1" aria-label="Subir ${escapeAttr(definition.label)}" ${index === 0 ? "disabled" : ""}>↑</button>
          <button type="button" data-section-move="${escapeAttr(key)}" data-direction="1" aria-label="Bajar ${escapeAttr(definition.label)}" ${index === order.length - 1 ? "disabled" : ""}>↓</button>
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
  }, `${SECTION_DEFINITIONS[section].label} movida ${direction < 0 ? "arriba" : "abajo"}.`);
}

function setRadioValue(name, value) {
  setRadio(name, value);
}

function quickActionLabel(action) {
  return {
    surprise: "Nueva direccion creativa generada.",
    premium: "Variante aplicada: mas premium.",
    minimal: "Variante aplicada: mas limpia.",
    urgent: "Variante aplicada: mas urgencia comercial.",
    trust: "Variante aplicada: mas confianza.",
    booking: "Variante aplicada: vender reservas.",
    food: "Variante aplicada: pedidos rapidos.",
    local: "Variante aplicada: mas local y mapa.",
    mobile: "Variante aplicada: modo movil.",
    biggerType: "Variante aplicada: letras mas grandes.",
    moreSpace: "Variante aplicada: mas aire y dimensiones amplias.",
    wideImages: "Variante aplicada: fotos panoramicas.",
    hideMap: "Mapa ocultado.",
    hideBot: "Bot ocultado.",
    hideGallery: "Galeria ocultada.",
    store: "Variante aplicada: tienda online.",
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
  if (!qualityScore || !qualityChecklist) {
    return;
  }

  const checks = getQualityChecks(business);
  const validation = validateBusiness(business);
  const checklistScore = Math.round((checks.filter((item) => item.done).length / checks.length) * 100);
  const score = Math.min(checklistScore, validation.score);
  qualityScore.textContent = `${score}%`;
  qualityChecklist.innerHTML = [
    ...validation.issues.map((issue) => `
      <span class="quality-item is-${escapeAttr(issue.severity)}" title="${escapeAttr(issue.message)}">${escapeHtml(issue.message)}</span>
    `),
    ...checks.map((item) => `<span class="quality-item ${item.done ? "is-done" : ""}">${escapeHtml(item.label)}</span>`)
  ].join("");
  applyFormValidation(validation);
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
    { label: "Mapa, ruta o resenas conectables", done: Boolean(business.google?.enabled && (business.google.mapsUrl || business.google.mapEmbedUrl || business.google.reviewUrl)) },
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
  root.style.setProperty("--scroll-progress", progress.toFixed(4));
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

  runSplitting(container);
  runVanillaTilt(container, business);
  runAtropos(container, business);
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

function downloadBusinessData(business) {
  const payload = {
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    business: withBusinessDefaults(business)
  };
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }),
    `${slugify(business.name || "locallift-datos")}.locallift.json`
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
    mediaMetadata: normalizeMediaMetadata(base.mediaMetadata)
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
    .map(([url, metadata]) => [url, {
      alt: String(metadata.alt || "").trim().slice(0, 180),
      position: allowedPositions.includes(metadata.position) ? metadata.position : "center center"
    }]));
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
