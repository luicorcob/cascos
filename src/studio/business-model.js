(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.businessModel = {
    createBusinessModel
  };

  function createBusinessModel(options = {}) {
    const {
      blockLibrary,
      defaultBlockVariants,
      defaultSectionOrder,
      demoBusiness,
      designPacks,
      getBuildTrustBadges,
      heroSizeMap,
      contentWidthMap,
      normalizeButtonStyles,
      normalizeCommerce
    } = options;
    const {
      clampNumber,
      isFoodCategory,
      normalizeChoice,
      normalizeCurrency,
      normalizeImage,
      normalizeMenuItems,
      normalizeOptionalUrl,
      normalizeSectionOrder,
      numberOr,
      textOr
    } = options.core || {};

    return {
      normalizeImportedBusiness,
      withBusinessDefaults,
      readBlockVariants,
      normalizeBlockVariants,
      readMediaMetadata,
      normalizeMediaMetadata,
      readTextStyles,
      normalizeTextStyles,
      normalizeTextStyle,
      normalizeColor,
      rgbToHex
    };

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
      const trustBadges = hasOwn("trustBadges")
        && Array.isArray(business.trustBadges)
        && business.trustBadges.length
        ? business.trustBadges
        : getBuildTrustBadges()({ ...base, services, chatbot }, google);

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
          ? textOr(
              business.conversionGoal,
              `Reservas, consultas y contacto directo para ${base.category || "negocio local"}`
            )
          : `Reservas, consultas y contacto directo para ${base.category || "negocio local"}`,
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
        sectionOrder: normalizeSectionOrder(base.sectionOrder, defaultSectionOrder),
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
      return Object.fromEntries(Object.entries(blockLibrary).map(([section, definition]) => {
        const allowed = definition.variants.map((variant) => variant.id);
        const selected = allowed.includes(value?.[section])
          ? value[section]
          : defaultBlockVariants[section];
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
      const allowedPositions = [
        "center center",
        "center top",
        "center bottom",
        "left center",
        "right center"
      ];
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
      const weight = ["400", "700", "900"].includes(String(style.weight))
        ? String(style.weight)
        : "";

      if (color) normalized.color = color;
      if (Math.abs(opacity - 1) > 0.001) normalized.opacity = Number(opacity.toFixed(2));
      if (Math.abs(size - 1) > 0.001) normalized.size = Number(size.toFixed(2));
      if (weight) normalized.weight = weight;
      if (style.italic === true) normalized.italic = true;
      if (Math.abs(letterSpacing) > 0.001) {
        normalized.letterSpacing = Number(letterSpacing.toFixed(3));
      }

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
  }
})(globalThis);
