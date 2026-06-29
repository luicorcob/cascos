(function (global) {
  "use strict";

  const GENERIC_PLACE_TYPES = new Set([
    "establishment", "point_of_interest", "food", "store", "health", "premise",
    "locality", "political", "geocode"
  ]);

  function normalizeBusiness(source = {}) {
    const rating = clampNumber(source.rating, 0, 5);
    const reviewCount = Math.max(0, Math.round(number(source.reviews ?? source.reviewCount, 0)));
    const coordinates = normalizeCoordinates(source.coordinates);
    const reviewItems = array(source.reviewItems || source.reviewDetails || source.realReviews)
      .map(normalizeReview)
      .filter((item) => item.text)
      .slice(0, 3);
    const openingHours = normalizeLines(source.openingHours || source.hours);
    const photos = array(source.photos)
      .map((photo) => typeof photo === "string" ? photo : photo?.url)
      .map(clean)
      .filter(isUsableUrl)
      .slice(0, 8);
    const types = array(source.serviceTypes || source.types)
      .map((item) => typeof item === "string" ? item : item?.label || item?.name)
      .map(clean)
      .filter((item) => item && !GENERIC_PLACE_TYPES.has(normalize(item)))
      .slice(0, 8);
    const mapsUrl = url(source.mapsUrl);
    const website = url(source.website);
    const socialUrl = url(source.socialUrl);
    const alternativeUrl = url(source.alternativeUrl);
    const reservationUrl = url(source.reservationUrl || source.bookingUrl);
    const publicLinks = dedupeLinks([
      ...array(source.publicLinks),
      mapsUrl ? { label: source.provider === "places" ? "Google Maps" : "Mapa", url: mapsUrl } : null,
      website ? { label: "Web", url: website } : null,
      socialUrl ? { label: "Red social", url: socialUrl } : null,
      alternativeUrl ? { label: "Enlace público", url: alternativeUrl } : null,
      reservationUrl ? { label: "Reservas", url: reservationUrl } : null
    ]);

    return {
      id: clean(source.id),
      providerId: clean(source.providerId),
      provider: clean(source.provider),
      sourceLabel: clean(source.sourceLabel) || providerLabel(source.provider),
      name: clean(source.name || source.businessName) || "Negocio local",
      category: clean(source.category) || "Negocio local",
      categoryKey: clean(source.categoryKey),
      city: clean(source.city),
      province: clean(source.province),
      postalCode: clean(source.postalCode),
      street: clean(source.street),
      streetNumber: clean(source.streetNumber),
      address: clean(source.address || source.formattedAddress),
      phone: clean(source.phone),
      callUrl: clean(source.phone) ? `tel:${phoneHref(source.phone)}` : "",
      mapsUrl,
      coordinates,
      rating,
      reviewCount,
      reviewItems,
      reviewSummary: clean(source.reviewSummary),
      openingHours,
      openNow: typeof source.openNow === "boolean" ? source.openNow : null,
      websiteStatus: normalizeWebsiteStatus(source.websiteStatus),
      websiteEvidence: clean(source.websiteEvidence),
      website,
      socialUrl,
      alternativeUrl,
      reservationUrl,
      photos,
      serviceTypes: types,
      localKeywords: normalizeLines(source.localKeywords),
      publicLinks,
      opportunityScore: Math.round(clampNumber(source.opportunityScore, 0, 100)),
      searchedAt: clean(source.searchedAt)
    };
  }

  function buildHandoff(source = {}, preparedDraft = null) {
    const business = normalizeBusiness(source);
    const brief = buildBrief(business);
    return {
      version: 2,
      opportunityId: business.id,
      createdAt: new Date().toISOString(),
      detected: business,
      missing: getMissingFields(business),
      brief,
      draft: preparedDraft ? mergePreparedDraft(preparedDraft, business, brief) : buildStudioBusiness(business, brief)
    };
  }

  function buildBrief(source = {}) {
    const business = normalizeBusiness(source);
    const place = business.city || business.province || "su zona";
    return {
      businessName: business.name,
      city: business.city,
      province: business.province,
      postalCode: business.postalCode,
      street: business.street,
      streetNumber: business.streetNumber,
      category: business.category,
      address: business.address,
      phone: business.phone,
      callUrl: business.callUrl,
      rating: business.rating,
      reviews: business.reviewCount,
      reviewItems: business.reviewItems,
      reviewSummary: business.reviewSummary,
      openingHours: business.openingHours,
      openNow: business.openNow,
      websiteStatus: business.websiteStatus,
      mapsUrl: business.mapsUrl,
      coordinates: business.coordinates,
      photos: business.photos,
      serviceTypes: business.serviceTypes,
      localKeywords: business.localKeywords,
      publicLinks: business.publicLinks,
      opportunityScore: business.opportunityScore,
      provider: business.provider,
      sourceLabel: business.sourceLabel,
      suggestedPositioning: business.city ? `${business.name} en ${business.city}` : business.name,
      suggestedSections: ["Información", "Actividad", "Reputación", "Horario", "Mapa", "Contacto"],
      suggestedCTA: primaryAction(business).label,
      localSeo: buildLocalSeo(business),
      dataNotice: "Revisa direccion, telefono, horario y servicios antes de enviar nada al cliente.",
      summary: `${business.category} en ${place}`
    };
  }

  function buildStudioBusiness(source = {}, suppliedBrief = null) {
    const business = normalizeBusiness(source);
    const brief = suppliedBrief || buildBrief(business);
    const action = primaryAction(business);
    const place = business.city || business.province || "su zona";
    const hasRealPhotos = business.photos.length > 0;
    const hasRealServices = business.serviceTypes.length > 0;
    const reviews = buildTestimonials(business);
    const features = buildReputationFacts(business);
    const trustBadges = buildTrustBadges(business);
    const mapLabel = business.provider === "places" ? "Google Maps" : "Mapa";
    const hours = business.openingHours.length
      ? business.openingHours
      : ["Confirma el horario antes de venir."];
    const services = hasRealServices
      ? business.serviceTypes.map((item) => `${humanize(item)}: contacta con ${business.name} para confirmar disponibilidad, horarios y condiciones.`)
      : [`Servicios de ${business.category}: llamanos o escribenos y te orientamos con la opcion que mejor encaje contigo.`];
    const galleryMetadata = Object.fromEntries(business.photos.map((photo, index) => [photo, {
      alt: `${business.name} · foto pública ${index + 1}`,
      position: "center center",
      provider: business.sourceLabel
    }]));

    return {
      name: business.name,
      category: business.category,
      location: business.city || business.province,
      tagline: business.city ? `${business.name} en ${business.city}` : business.name,
      description: `En ${business.name} te atendemos en ${place} con servicios de ${business.category} y contacto directo para resolver lo que necesitas.`,
      conversionGoal: action.label === "Contactar"
        ? `Contactar con ${business.name} para confirmar horario y disponibilidad`
        : `${action.label} con ${business.name}`,
      announcement: `Antes de venir, confirma horario, ubicacion y disponibilidad con ${business.name}.`,
      phone: business.phone,
      email: "",
      address: business.address,
      services,
      features,
      hours,
      testimonials: reviews,
      faqs: [],
      trustBadges,
      links: business.publicLinks,
      heroImage: business.photos[0] || "",
      gallery: business.photos,
      mediaMetadata: galleryMetadata,
      bookingLabel: action.label,
      bookingUrl: action.url,
      bookingMode: "link",
      showBooking: Boolean(action.url),
      showMap: Boolean(business.address || business.coordinates || business.mapsUrl),
      showGallery: hasRealPhotos,
      showTestimonials: true,
      showLeadForm: false,
      showFaq: false,
      showMenu: false,
      showConversionDock: true,
      showAnnouncement: true,
      showTrustRail: true,
      showResourceMarquee: false,
      sectionOrder: ["services", "testimonials", "features", "map", "gallery", "booking", "lead", "faq", "menu", "store"],
      blockVariants: {
        hero: hasRealPhotos ? "split" : "minimal",
        services: "list",
        gallery: "grid",
        testimonials: "quotes",
        contact: "split"
      },
      servicesHeading: hasRealServices ? "Actividad del negocio" : "Servicios principales",
      servicesIntro: hasRealServices
        ? "Estas son las areas de actividad que trabajamos. Si tienes una duda concreta, escribenos antes de venir."
        : "Cuentanos que necesitas y te diremos si podemos ayudarte, cuanto tardamos y como reservar.",
      trustHeading: business.reviewItems.length ? "Lo que dicen sus clientes" : "Reputación del negocio",
      trustIntro: reputationIntro(business),
      contactHeading: business.phone ? "Llama o encuentra el negocio" : "Encuentra el negocio",
      theme: "aurora",
      artDirection: "editorial",
      contentMode: "detailed",
      premiumEffects: true,
      google: {
        enabled: Boolean(business.mapsUrl || business.coordinates || business.rating),
        placeId: business.providerId,
        mapsUrl: business.mapsUrl,
        mapEmbedUrl: buildMapEmbedUrl(business),
        directionsNote: business.address
          ? `Puedes encontrar ${business.name} en ${business.address}. Abre la ubicación en el mapa para calcular la ruta.`
          : "Contacta antes de venir y te indicamos como llegar.",
        reviewUrl: business.mapsUrl,
        rating: business.rating,
        reviewCount: business.reviewCount,
        appointmentUrl: business.reservationUrl
      },
      localSeo: brief.localSeo || buildLocalSeo(business),
      sourceData: business,
      contentProvenance: {
        mode: "radar-real",
        provider: business.provider,
        sourceLabel: business.sourceLabel,
        capturedAt: new Date().toISOString(),
        missing: getMissingFields(business),
        notice: brief.dataNotice
      },
      radarOpportunity: brief
    };
  }

  function mergePreparedDraft(preparedDraft, business, brief) {
    const grounded = buildStudioBusiness(business, brief);
    return {
      ...preparedDraft,
      ...grounded,
      google: { ...(preparedDraft.google || {}), ...grounded.google },
      blockVariants: { ...(preparedDraft.blockVariants || {}), ...grounded.blockVariants }
    };
  }

  function buildTestimonials(business) {
    if (business.reviewItems.length) {
      return business.reviewItems.map((review) => ({
        name: [review.author, review.relativeDate].filter(Boolean).join(" · ") || "Cliente",
        text: review.text
      }));
    }
    if (business.rating && business.reviewCount) {
      return [{
        name: business.sourceLabel || "Ficha pública",
        text: `Este negocio cuenta con una valoración de ${formatRating(business.rating)} sobre 5 basada en ${business.reviewCount} reseñas.`
      }];
    }
    return [{
      name: business.name || "Clientes",
      text: "Quienes vienen valoran recibir una respuesta clara antes de desplazarse."
    }];
  }

  function buildReputationFacts(business) {
    const facts = [];
    if (business.rating) facts.push(`Valoración pública: ${formatRating(business.rating)} sobre 5${business.reviewCount ? ` con ${business.reviewCount} reseñas` : ""}.`);
    if (business.mapsUrl) facts.push(`Presencia en el mapa: ficha disponible en ${business.provider === "places" ? "Google Maps" : business.sourceLabel || "un mapa público"}.`);
    if (business.address) facts.push(`Ubicación física: ${business.address}.`);
    if (business.phone) facts.push(`Teléfono de contacto: ${business.phone}.`);
    if (business.openingHours.length) facts.push("Horario público: disponible en la ficha del negocio.");
    if (!facts.length) facts.push("Llama o escribe para confirmar los datos antes de venir.");
    return facts;
  }

  function buildTrustBadges(business) {
    const badges = [];
    if (business.rating) badges.push(`${formatRating(business.rating)}/5 en ${business.sourceLabel}`);
    if (business.reviewCount) badges.push(`${business.reviewCount} reseñas públicas`);
    if (business.mapsUrl) badges.push(`Presencia en ${business.provider === "places" ? "Google Maps" : "mapa público"}`);
    if (business.address) badges.push("Ubicación disponible");
    if (business.phone) badges.push("Teléfono disponible");
    if (business.openingHours.length) badges.push("Horario disponible");
    return badges.length ? badges.slice(0, 6) : ["Contacto directo"];
  }

  function reputationIntro(business) {
    if (business.rating && business.reviewCount) {
      return `${business.name} tiene una valoración de ${formatRating(business.rating)} sobre 5 basada en ${business.reviewCount} reseñas. Solo se muestran opiniones textuales cuando la fuente las proporciona.`;
    }
    if (business.mapsUrl || business.phone || business.address) {
      return `Esta sección organiza las señales reales disponibles de ${business.name}: ubicación, contacto y presencia en la ficha pública.`;
    }
    return "Si tienes dudas, contacta antes de venir y te orientamos con la informacion disponible.";
  }

  function buildLocalSeo(business) {
    const keywords = [
      business.city ? `${business.name} en ${business.city}` : business.name,
      business.category && business.city ? `${business.category} en ${business.city}` : business.category,
      business.category && business.street ? `${business.category} cerca de ${business.street}` : "",
      business.phone ? `Teléfono de ${business.name}` : "",
      business.mapsUrl || business.coordinates ? `Cómo llegar a ${business.name}` : "",
      ...business.localKeywords
    ].filter(Boolean);
    return {
      title: business.city ? `${business.name} en ${business.city}` : business.name,
      description: `${business.category}${business.city ? ` en ${business.city}` : ""}. Consulta ubicación, contacto, horario y reseñas reales disponibles.`,
      keywords: [...new Set(keywords)]
    };
  }

  function getMissingFields(source = {}) {
    const business = normalizeBusiness(source);
    return [
      !business.phone ? "Teléfono" : "",
      !business.address ? "Dirección" : "",
      !business.openingHours.length ? "Horario" : "",
      !business.reviewItems.length ? "Reseñas textuales" : "",
      !business.serviceTypes.length ? "Servicios reales" : "",
      !business.photos.length ? "Fotos del negocio" : ""
    ].filter(Boolean);
  }

  function primaryAction(business) {
    if (business.reservationUrl) return { label: "Reservar", url: business.reservationUrl };
    if (business.phone) return { label: "Llamar ahora", url: business.callUrl };
    if (business.mapsUrl) return { label: "Cómo llegar", url: business.mapsUrl };
    return { label: "Contactar", url: "#contacto" };
  }

  function buildMapEmbedUrl(business) {
    const query = business.coordinates
      ? `${business.coordinates.lat},${business.coordinates.lng}`
      : business.address || [business.name, business.city].filter(Boolean).join(", ");
    return query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : "";
  }

  function normalizeReview(review = {}) {
    return {
      author: clean(review.author || review.name || review.authorName),
      relativeDate: clean(review.relativeDate || review.relativePublishTimeDescription || review.date),
      text: clean(review.text?.text || review.text),
      rating: clampNumber(review.rating, 0, 5),
      sourceUrl: url(review.sourceUrl || review.url)
    };
  }

  function normalizeCoordinates(value) {
    const lat = number(value?.lat ?? value?.latitude, NaN);
    const lng = number(value?.lng ?? value?.longitude, NaN);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function normalizeLines(value) {
    if (Array.isArray(value)) return value.map(clean).filter(Boolean).slice(0, 12);
    const text = clean(value);
    return text ? text.split(/\r?\n/).map(clean).filter(Boolean).slice(0, 12) : [];
  }

  function dedupeLinks(items) {
    const seen = new Set();
    return array(items).map((item) => ({
      label: clean(item?.label || item?.name) || "Enlace público",
      url: url(item?.url || item?.href)
    })).filter((item) => {
      if (!item.url || seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    }).slice(0, 10);
  }

  function normalizeWebsiteStatus(value) {
    const status = normalize(value);
    if (["none", "website", "social", "unverified"].includes(status)) return status;
    return "unverified";
  }

  function providerLabel(provider) {
    if (provider === "places") return "Google Places";
    if (provider === "openstreetmap") return "OpenStreetMap";
    return "Ficha pública";
  }

  function humanize(value) {
    return clean(value).replace(/_/g, " ").replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase("es"));
  }

  function formatRating(value) { return number(value, 0).toLocaleString("es-ES", { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }
  function phoneHref(value) { return clean(value).replace(/[^\d+]/g, ""); }
  function normalize(value) { return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
  function number(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : fallback; }
  function clampNumber(value, min, max) { return Math.min(max, Math.max(min, number(value, min))); }
  function array(value) { return Array.isArray(value) ? value : []; }
  function clean(value) { return String(value ?? "").trim(); }
  function isUsableUrl(value) { return /^(https?:|data:image\/)/i.test(value); }
  function url(value) { const text = clean(value); return /^(https?:|tel:|mailto:|#)/i.test(text) ? text : ""; }

  global.DLSRadarStudioHandoff = {
    normalizeBusiness,
    buildHandoff,
    buildBrief,
    buildStudioBusiness,
    getMissingFields,
    buildLocalSeo
  };
})(globalThis);
