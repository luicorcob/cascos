(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.validation = {
    validateBusiness
  };

  function validateBusiness(business = {}) {
    const issues = [];
    const add = (severity, code, field, message) => issues.push({ severity, code, field, message });
    const commerce = business.commerce || {};
    const google = business.google || {};

    if (!clean(business.name)) {
      add("error", "missing_name", "name", "Define el nombre del negocio.");
    }
    if (!clean(business.category)) {
      add("warning", "missing_category", "category", "Define una categoria para mejorar textos y SEO.");
    }
    if (!clean(business.phone) && !clean(business.email) && !realUrl(business.bookingUrl)) {
      add("error", "missing_contact", "phone", "Anade telefono, email o una URL real de reserva.");
    }
    if (!Array.isArray(business.services) || business.services.length < 3) {
      add("warning", "few_services", "services", "Incluye al menos tres servicios claros.");
    }
    if (!realImage(business.heroImage)) {
      add("warning", "missing_hero", "heroImage", "Usa una imagen principal HTTPS o embebida.");
    } else if (!clean(business.mediaMetadata?.[business.heroImage]?.alt)) {
      add("warning", "missing_hero_alt", "heroImage", "Describe la imagen principal para accesibilidad y SEO.");
    }
    if ((business.showLeadForm || business.showBooking) && !realUrl(business.privacyUrl)) {
      add("error", "missing_privacy", "privacyUrl", "Enlaza privacidad antes de publicar formularios.");
    }
    if (business.showBooking && !realUrl(business.bookingUrl) && business.bookingUrl !== "#reservas") {
      add("warning", "booking_fallback", "bookingUrl", "Configura una reserva real o usa la agenda integrada.");
    }
    if (business.showMap && !clean(business.address) && !clean(business.location) && !realUrl(google.mapsUrl)) {
      add("warning", "missing_location", "address", "Completa una ubicacion para que el mapa tenga contexto.");
    }
    if (commerce.enabled && !realUrl(commerce.checkoutEndpoint)) {
      add("error", "missing_checkout", "commerceCheckoutEndpoint", "La tienda necesita un endpoint de checkout.");
    }
    if (commerce.enabled && (!Array.isArray(commerce.products) || !commerce.products.length)) {
      add("error", "missing_products", "commerceProducts", "La tienda necesita al menos un producto valido.");
    }

    const errors = issues.filter((issue) => issue.severity === "error");
    const warnings = issues.filter((issue) => issue.severity === "warning");
    const score = Math.max(0, 100 - (errors.length * 18) - (warnings.length * 6));

    return {
      ok: errors.length === 0,
      score,
      issues,
      errors,
      warnings
    };
  }

  function clean(value) {
    return String(value || "").trim();
  }

  function realUrl(value) {
    const url = clean(value);
    return /^(https?:\/\/|\/(?!\/)|\.{1,2}\/|[a-z0-9_-]+(?:\/[a-z0-9_.-]+)+)/i.test(url);
  }

  function realImage(value) {
    return /^(https?:\/\/|data:image\/)/i.test(clean(value));
  }
})(globalThis);
