(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};
  const { clampNumber, numberOr } = studio.core || {};

  studio.buttonStyles = {
    createButtonStyleEditor,
    readButtonStyles,
    normalizeButtonStyles,
    normalizeButtonStyle
  };

  function createButtonStyleEditor(options = {}) {
    const { sitePreview, getBusiness } = options;
    const doc = options.document || global.document;
    const byId = (id) => doc.querySelector(`#${id}`);
    const linkFields = byId("previewInspectorLinkFields");
    const optionsPanel = byId("previewInspectorButtonOptions");
    const sample = byId("previewInspectorButtonSample");
    const backgroundInput = byId("previewInspectorButtonBackground");
    const textColorInput = byId("previewInspectorButtonTextColor");
    const neonInput = byId("previewInspectorButtonNeon");
    const glowInput = byId("previewInspectorButtonGlow");
    const glowLabel = byId("previewInspectorButtonGlowLabel");
    const glowValue = byId("previewInspectorButtonGlowValue");
    const resetButton = byId("previewInspectorButtonReset");
    const labelInput = byId("previewInspectorLinkLabel");
    let targetType = "button";
    let fallbackLabel = "Accion principal";

    [backgroundInput, textColorInput, neonInput, glowInput, labelInput]
      .forEach((field) => field?.addEventListener("input", updateSample));
    resetButton?.addEventListener("click", () => options.onReset?.());

    return { configure, updateSample, value: readValue };

    function configure(element, config = {}) {
      const enabled = config.styleKey === "primary";
      targetType = config.targetType || "button";
      fallbackLabel = String(config.label || element?.textContent || "Accion principal").trim();
      linkFields.hidden = targetType === "button";
      optionsPanel.hidden = !enabled;
      resetButton.hidden = !enabled;
      if (!enabled) return;

      const business = getBusiness();
      const style = business.buttonStyles?.primary || {};
      const reference = sitePreview.querySelector('[data-edit-link-field="booking"]') || element;
      const computed = global.getComputedStyle(reference);
      backgroundInput.value = normalizeColor(style.background)
        || rgbToHex(computed.backgroundColor)
        || business.accent;
      textColorInput.value = normalizeColor(style.textColor)
        || rgbToHex(computed.color)
        || "#ffffff";
      neonInput.checked = typeof style.neon === "boolean" ? style.neon : business.theme === "neon";
      glowInput.value = String(Number.isFinite(Number(style.glowStrength)) ? style.glowStrength : 60);
      updateSample();
    }

    function updateSample() {
      if (!sample || optionsPanel?.hidden) return;
      const background = normalizeColor(backgroundInput?.value) || "#111111";
      const textColor = normalizeColor(textColorInput?.value) || "#ffffff";
      const glowStrength = clamp(numberOrSafe(glowInput?.value, 60), 0, 100);
      const neon = Boolean(neonInput?.checked);
      const glowSize = Math.round(8 + glowStrength * 0.34);
      const glowOpacity = Math.min(0.86, 0.18 + glowStrength * 0.0065);

      sample.textContent = targetType === "link"
        ? (labelInput?.value.trim() || fallbackLabel)
        : fallbackLabel;
      sample.style.background = background;
      sample.style.color = textColor;
      sample.style.boxShadow = neon ? `0 0 ${glowSize}px ${hexToRgba(background, glowOpacity)}` : "none";
      glowInput.disabled = !neon;
      glowLabel.classList.toggle("is-disabled", !neon);
      glowValue.value = `${Math.round(glowStrength)}%`;
      glowValue.textContent = `${Math.round(glowStrength)}%`;
    }

    function readValue() {
      return normalizeButtonStyle({
        background: backgroundInput.value,
        textColor: textColorInput.value,
        neon: neonInput.checked,
        glowStrength: Number(glowInput.value || 0)
      });
    }
  }

  function readButtonStyles(value) {
    if (value && typeof value === "object") return normalizeButtonStyles(value);
    try {
      return normalizeButtonStyles(JSON.parse(String(value || "{}")));
    } catch (error) {
      return {};
    }
  }

  function normalizeButtonStyles(value = {}) {
    const primary = normalizeButtonStyle(value?.primary);
    return Object.keys(primary).length ? { primary } : {};
  }

  function normalizeButtonStyle(style = {}) {
    if (!style || typeof style !== "object") return {};
    const normalized = {};
    const background = normalizeColor(style.background);
    const textColor = normalizeColor(style.textColor);
    if (background) normalized.background = background;
    if (textColor) normalized.textColor = textColor;
    if (typeof style.neon === "boolean") normalized.neon = style.neon;
    if (style.glowStrength !== undefined && style.glowStrength !== null && style.glowStrength !== "") {
      normalized.glowStrength = Math.round(clamp(numberOrSafe(style.glowStrength, 60), 0, 100));
    }
    return normalized;
  }

  function normalizeColor(value) {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "";
  }

  function rgbToHex(value) {
    const match = String(value || "").match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return normalizeColor(value);
    return `#${[match[1], match[2], match[3]]
      .map((part) => Number(part).toString(16).padStart(2, "0"))
      .join("")}`;
  }

  function hexToRgba(value, opacity = 1) {
    const color = normalizeColor(value);
    if (!color) return `rgba(17, 17, 17, ${opacity})`;
    const channels = [1, 3, 5].map((index) => Number.parseInt(color.slice(index, index + 2), 16));
    return `rgba(${channels.join(", ")}, ${Number(opacity).toFixed(2)})`;
  }

  function numberOrSafe(value, fallback) {
    return typeof numberOr === "function" ? numberOr(value, fallback) : (Number(value) || fallback);
  }

  function clamp(value, min, max) {
    return typeof clampNumber === "function"
      ? clampNumber(value, min, max)
      : Math.min(max, Math.max(min, Number(value) || min));
  }
})(typeof window !== "undefined" ? window : globalThis);
