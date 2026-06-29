(function (global) {
  "use strict";

  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  function createBusinessDefaultsResolver(options) {
    const {
      demoBusiness, designPacks, heroSizeMap, contentWidthMap,
      isFoodCategory, normalizeMenuItems, normalizeCommerce, normalizeImage,
      textOr, normalizeOptionalUrl, normalizeChoice, numberOr, clampNumber,
      normalizeSectionOrder, normalizeBlockVariants, normalizeMediaMetadata,
      normalizeTextStyles, normalizeButtonStyles, getTrustBadges
    } = options;

    return function withBusinessDefaults(business = {}) {
      const base = { ...demoBusiness, ...business };
      const hasOwn = (key) => Object.prototype.hasOwnProperty.call(business, key);
      const grounded = Boolean(business.contentProvenance?.mode === "radar-real" || business.radarOpportunity?.provider);
      const google = grounded
        ? { ...emptyNestedConfig(demoBusiness.google), ...(business.google || {}) }
        : { ...demoBusiness.google, ...(base.google || {}) };
      const chatbot = grounded
        ? { ...emptyNestedConfig(demoBusiness.chatbot), ...(business.chatbot || {}), enabled: Boolean(business.chatbot?.enabled) }
        : { ...demoBusiness.chatbot, ...(base.chatbot || {}) };
      const commerce = normalizeCommerce(grounded
        ? { ...emptyNestedConfig(demoBusiness.commerce), ...(business.commerce || {}), enabled: Boolean(business.commerce?.enabled) }
        : { ...demoBusiness.commerce, ...(base.commerce || {}) });
      const services = Array.isArray(base.services) ? base.services : [];
      const trustBadges = hasOwn("trustBadges") && Array.isArray(business.trustBadges) && business.trustBadges.length
        ? business.trustBadges
        : getTrustBadges({ ...base, services, chatbot }, google);

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
        heroImage: grounded && hasOwn("heroImage") ? normalizeImage(business.heroImage, "") : normalizeImage(base.heroImage, demoBusiness.heroImage),
        menuTitle: textOr(base.menuTitle, demoBusiness.menuTitle),
        menuIntro: textOr(base.menuIntro, demoBusiness.menuIntro),
        menuCurrency: options.normalizeCurrency(base.menuCurrency),
        menuItems: hasOwn("menuItems")
          ? normalizeMenuItems(business.menuItems)
          : (grounded ? [] : (isFoodCategory(base.category) ? normalizeMenuItems(demoBusiness.menuItems) : [])),
        conversionGoal: hasOwn("conversionGoal")
          ? textOr(business.conversionGoal, `Reservas, consultas y contacto directo para ${base.category || "negocio local"}`)
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
        leadFormIntro: textOr(base.leadFormIntro, "Completa el formulario y el negocio tendra los datos necesarios para responder con contexto."),
        leadFormCta: textOr(base.leadFormCta, "Enviar solicitud"),
        privacyUrl: normalizeOptionalUrl(base.privacyUrl),
        designPack: normalizeChoice(base.designPack, ["custom", ...Object.keys(designPacks)], "custom"),
        artDirection: normalizeChoice(base.artDirection, ["auto", "cinematic", "editorial", "poster", "mosaic", "atelier", "kinetic"], "auto"),
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
        sectionOrder: normalizeSectionOrder(base.sectionOrder, options.defaultSectionOrder),
        blockVariants: normalizeBlockVariants(base.blockVariants),
        mediaMetadata: normalizeMediaMetadata(base.mediaMetadata),
        textStyles: normalizeTextStyles(base.textStyles),
        buttonStyles: normalizeButtonStyles(base.buttonStyles)
      };
    };
  }

  function emptyNestedConfig(template = {}) {
    return Object.fromEntries(Object.entries(template).map(([key, value]) => {
      if (typeof value === "boolean") return [key, false];
      if (typeof value === "number") return [key, 0];
      if (Array.isArray(value)) return [key, []];
      if (value && typeof value === "object") return [key, {}];
      return [key, ""];
    }));
  }

  studio.businessDefaults = { createBusinessDefaultsResolver, emptyNestedConfig };
})(globalThis);
