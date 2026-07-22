(function () {
  const root = document.querySelector("#clientSiteRoot");
  const title = document.querySelector("[data-site-title]");
  const dashboardLink = document.querySelector("[data-dashboard-link]");
  const logout = document.querySelector("[data-client-logout]");
  const core = window.LocalLiftStudio?.core || {};
  const catalog = window.LocalLiftStudio?.catalog || {};
  const rendererFactory = window.LocalLiftStudio?.renderer?.createRenderer;
  let currentBusinessRecord = null;
  let revealObserver = null;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const requestedBusiness = params.get("business") || params.get("id") || params.get("slug") || "";
    logout?.addEventListener("click", () => {
      window.LocalLiftApi?.clearClientSession?.();
      window.location.href = "../index.html";
    });

    const session = window.LocalLiftApi?.getClientSession?.();
    if (logout) {
      logout.hidden = !session;
    }

    if (!session && !requestedBusiness) {
      renderState("Sesion requerida", "Entra desde Start > Cliente para ver la web de tu negocio.");
      return;
    }

    try {
      const businessRef = requestedBusiness || session.businessSlug || session.businessId;
      const payload = await getJson(`/api/businesses/${encodeURIComponent(businessRef)}`);
      currentBusinessRecord = payload.business;
      const business = toSiteBusiness(payload.business);
      renderSite(business, { session });
    } catch (error) {
      renderState("No se pudo cargar la web", getLoadErrorMessage(error, session));
    }
  }

  function renderSite(business, options = {}) {
    if (!rendererFactory) {
      renderState("Renderer no disponible", "Falta el modulo visual de DLS.");
      return;
    }

    const renderer = rendererFactory({
      core,
      demoBusiness: catalog.demoBusiness,
      themePalette: catalog.themePalette,
      getContrastTokens: catalog.getContrastTokens,
      densityLayoutMap: catalog.densityLayoutMap,
      contentWidthMap: catalog.contentWidthMap,
      heroSizeMap: catalog.heroSizeMap,
      artDirectionOptions: catalog.artDirectionOptions,
      withBusinessDefaults,
      normalizeCommerce,
      normalizeProducts,
      getPublicLeadEndpoint,
      getPublicBookingEndpoint,
      getCurrentBusinessRecord: () => currentBusinessRecord
    });

    if (title) {
      title.textContent = business.name || "Mi web";
    }

    if (dashboardLink) {
      const businessRef = currentBusinessRecord?.slug || currentBusinessRecord?.id || "";
      dashboardLink.textContent = options.session ? "Portal del cliente" : "Control DLS";
      dashboardLink.href = options.session
        ? `client-dashboard.html?business=${encodeURIComponent(businessRef)}`
        : "admin-dashboard.html";
    }

    root.innerHTML = renderer.renderSite(business);
    attachGeneratedSiteInteractions(root);
    attachLeadForms(root, business);
    attachPublicBookingForms(root, business);
    window.DlsZoneDiscovery?.mount?.({
      container: root,
      reference: currentBusinessRecord?.slug || currentBusinessRecord?.id || business.slug || business.id,
      accent: business.accent,
      businessName: business.name
    });
  }

  function getLoadErrorMessage(error, session) {
    if (session && error.status === 401) {
      window.LocalLiftApi?.clearClientSession?.();
      return "La sesion ha caducado. Entra de nuevo desde Start > Cliente.";
    }

    if (error.status === 401) {
      return "Falta el token admin para previsualizar esta web.";
    }

    if (error.status === 403) {
      return session ? "Tu sesion solo puede abrir la web de tu negocio." : "No tienes acceso a este proyecto.";
    }

    return "Actualiza la pagina o vuelve al portal.";
  }

  function toSiteBusiness(record) {
    const content = isPlainObject(record?.content) ? record.content : {};
    const brand = isPlainObject(record?.brand) ? record.brand : {};
    const integrations = isPlainObject(record?.integrations) ? record.integrations : {};
    const google = {
      ...(isPlainObject(content.google) ? content.google : {}),
      ...(isPlainObject(integrations.google) ? integrations.google : {})
    };

    return {
      ...content,
      id: record.id,
      slug: record.slug,
      name: content.name || record.name,
      category: content.category || record.category,
      location: content.location || record.city,
      phone: content.phone || record.ownerPhone,
      email: content.email || record.ownerEmail,
      theme: content.theme || brand.theme || "editorial",
      accent: content.accent || brand.accent || "#cf3f2e",
      typography: content.typography || brand.typography || "modern",
      bookingUrl: content.bookingUrl || integrations.whatsapp?.url || "",
      google,
      showBooking: content.showBooking ?? Boolean(content.bookingUrl || integrations.whatsapp?.url),
      showLeadForm: content.showLeadForm ?? true,
      showMap: content.showMap ?? Boolean(content.address || google.mapsUrl),
      premiumEffects: false
    };
  }

  function withBusinessDefaults(business = {}) {
    const demo = catalog.demoBusiness || {};
    const base = { ...demo, ...business };
    const has = (key) => Object.prototype.hasOwnProperty.call(business, key);
    const services = Array.isArray(base.services) ? base.services : [];
    const google = { ...(demo.google || {}), ...(base.google || {}) };

    return {
      ...base,
      google,
      chatbot: { ...(demo.chatbot || {}), ...(base.chatbot || {}), enabled: false },
      commerce: normalizeCommerce(base.commerce),
      services,
      features: Array.isArray(base.features) ? base.features : [],
      hours: Array.isArray(base.hours) ? base.hours : [],
      testimonials: Array.isArray(base.testimonials) ? base.testimonials : [],
      faqs: Array.isArray(base.faqs) ? base.faqs : [],
      links: Array.isArray(base.links) ? base.links : [],
      gallery: Array.isArray(base.gallery) ? base.gallery : [],
      trustBadges: Array.isArray(base.trustBadges) && base.trustBadges.length ? base.trustBadges : buildTrustBadges(base, google),
      menuItems: Array.isArray(base.menuItems) ? base.menuItems : [],
      menuTitle: textOr(base.menuTitle, demo.menuTitle),
      menuIntro: textOr(base.menuIntro, demo.menuIntro),
      menuCurrency: core.normalizeCurrency?.(base.menuCurrency) || "EUR",
      bookingLabel: textOr(base.bookingLabel, demo.bookingLabel),
      servicesHeading: textOr(base.servicesHeading, demo.servicesHeading),
      servicesIntro: textOr(base.servicesIntro, demo.servicesIntro),
      trustHeading: textOr(base.trustHeading, demo.trustHeading),
      trustIntro: textOr(base.trustIntro, demo.trustIntro),
      contactHeading: textOr(base.contactHeading, demo.contactHeading),
      leadFormTitle: textOr(base.leadFormTitle, `Pide informacion a ${base.name || "este negocio"}.`),
      leadFormIntro: textOr(base.leadFormIntro, "Completa el formulario y el negocio tendra los datos necesarios para responder con contexto."),
      leadFormCta: textOr(base.leadFormCta, "Enviar solicitud"),
      conversionGoal: textOr(base.conversionGoal, `Reservas, consultas y contacto directo para ${base.category || "negocio local"}`),
      designPack: choice(base.designPack, ["custom", ...Object.keys(catalog.designPacks || {})], "custom"),
      artDirection: choice(base.artDirection, ["auto", "cinematic", "editorial", "poster", "mosaic", "atelier", "kinetic"], "auto"),
      contentMode: choice(base.contentMode, ["visual", "balanced", "detailed"], "balanced"),
      typography: choice(base.typography, ["modern", "editorial", "compact"], "modern"),
      contentDensity: choice(base.contentDensity, ["compact", "balanced", "spacious"], "balanced"),
      visualShape: choice(base.visualShape, ["sharp", "clean", "rounded"], "clean"),
      heroSize: choice(base.heroSize, Object.keys(catalog.heroSizeMap || {}), "balanced"),
      contentWidth: choice(base.contentWidth, Object.keys(catalog.contentWidthMap || {}), "standard"),
      imageRatio: choice(base.imageRatio, ["portrait", "square", "wide"], "portrait"),
      fontScale: clamp(Number(base.fontScale || 100), 85, 120),
      layoutScale: clamp(Number(base.layoutScale || 100), 85, 120),
      showAnnouncement: base.showAnnouncement ?? false,
      showResourceMarquee: base.showResourceMarquee ?? true,
      showTrustRail: base.showTrustRail ?? true,
      showGallery: base.showGallery ?? Boolean(base.gallery?.length),
      showTestimonials: base.showTestimonials ?? Boolean(base.testimonials?.length),
      showFaq: base.showFaq ?? Boolean(base.faqs?.length),
      showMenu: has("showMenu") ? Boolean(base.showMenu) : false,
      showConversionDock: base.showConversionDock ?? true,
      sectionOrder: normalizeSectionOrder(base.sectionOrder),
      blockVariants: normalizeBlockVariants(base.blockVariants),
      mediaMetadata: isPlainObject(base.mediaMetadata) ? base.mediaMetadata : {},
      textStyles: isPlainObject(base.textStyles) ? base.textStyles : {},
      buttonStyles: isPlainObject(base.buttonStyles) ? base.buttonStyles : {}
    };
  }

  function buildTrustBadges(business, google) {
    return [
      google?.rating ? `${google.rating}/5 en Google` : "",
      business.phone ? "Contacto directo" : "",
      business.bookingUrl ? "Reserva online" : "",
      business.location ? `Negocio local en ${business.location}` : ""
    ].filter(Boolean);
  }

  function normalizeCommerce(commerce = {}) {
    const demo = catalog.demoBusiness?.commerce || {};
    const source = { ...demo, ...(commerce || {}) };
    return {
      ...source,
      enabled: Boolean(source.enabled),
      currency: core.normalizeCurrency?.(source.currency) || "EUR",
      products: normalizeProducts(source.products).filter((product) => product.active)
    };
  }

  function normalizeProducts(products = []) {
    if (!Array.isArray(products)) {
      return [];
    }

    return products.map((product, index) => {
      const name = textOr(product.name, "");
      const id = slugify(product.id || product.sku || name || `producto-${index + 1}`);
      return {
        id,
        sku: slugify(product.sku || id),
        name,
        price: Number(product.price || 0),
        image: product.image || catalog.demoBusiness?.heroImage || "",
        description: textOr(product.description, "Producto disponible para compra online."),
        stock: Math.max(0, Number(product.stock || 999)),
        active: product.active !== false
      };
    }).filter((product) => product.name && product.price > 0);
  }

  function normalizeSectionOrder(value) {
    const allowed = new Set(Object.keys(catalog.SECTION_DEFINITIONS || {}));
    const source = Array.isArray(value) ? value : catalog.DEFAULT_SECTION_ORDER || [];
    const result = source.map((key) => String(key || "").trim()).filter((key) => allowed.has(key));
    Object.keys(catalog.SECTION_DEFINITIONS || {}).forEach((key) => {
      if (!result.includes(key)) {
        result.push(key);
      }
    });
    return result;
  }

  function normalizeBlockVariants(value = {}) {
    const variants = catalog.BLOCK_LIBRARY || {};
    const defaults = catalog.DEFAULT_BLOCK_VARIANTS || {};
    return Object.fromEntries(Object.entries(variants).map(([section, definition]) => {
      const allowed = definition.variants.map((variant) => variant.id);
      return [section, allowed.includes(value?.[section]) ? value[section] : defaults[section]];
    }));
  }

  function attachGeneratedSiteInteractions(container) {
    if (revealObserver) {
      revealObserver.disconnect();
      revealObserver = null;
    }

    const revealItems = container.querySelectorAll(".reveal");
    if (!revealItems.length) {
      return;
    }

    if (!("IntersectionObserver" in window)) {
      revealItems.forEach(showRevealItem);
      return;
    }

    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          showRevealItem(entry.target);
        }
      });
    }, { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.12 });

    revealItems.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index * 45, 260)}ms`;
      revealObserver.observe(item);
    });

    requestAnimationFrame(() => {
      revealItems.forEach((item) => {
        const rect = item.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.98 && rect.bottom > 0) {
          showRevealItem(item);
        }
      });
    });
  }

  function showRevealItem(item) {
    item.classList.add("is-visible");
    revealObserver?.unobserve?.(item);
  }

  function attachLeadForms(container, business) {
    container.querySelectorAll("[data-lead-form]").forEach((form) => {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const status = form.querySelector("[data-lead-status]");
        try {
          await postJson(form.dataset.leadEndpoint || getPublicLeadEndpoint(business), {
            name: textOr(data.get("leadName"), "Lead sin nombre"),
            contact: textOr(data.get("leadContact"), ""),
            notes: textOr(data.get("leadMessage"), ""),
            privacyAccepted: data.get("privacyAccepted") === "true",
            privacyAcceptedAt: new Date().toISOString(),
            source: "client-site"
          });
          if (status) status.textContent = "Solicitud enviada.";
          form.reset();
        } catch (error) {
          if (status) status.textContent = "No se pudo enviar. Intentalo de nuevo.";
        }
      });
    });
  }

  function attachPublicBookingForms(container, business) {
    container.querySelectorAll("[data-public-booking-form]").forEach((form) => {
      const startsAt = form.elements.startsAt;
      if (startsAt && !startsAt.min) {
        startsAt.min = toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
      }
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const status = form.querySelector("[data-booking-status]");
        try {
          await postJson(form.dataset.bookingEndpoint || getPublicBookingEndpoint(business), {
            serviceName: textOr(data.get("serviceName"), "Reserva"),
            customerName: textOr(data.get("customerName"), "Cliente sin nombre"),
            contact: textOr(data.get("contact"), ""),
            startsAt: data.get("startsAt") ? new Date(String(data.get("startsAt"))).toISOString() : "",
            notes: textOr(data.get("notes"), ""),
            privacyAccepted: data.get("privacyAccepted") === "true",
            privacyAcceptedAt: new Date().toISOString(),
            source: "client-site"
          });
          if (status) status.textContent = "Reserva enviada. Te confirmaran el hueco.";
          form.reset();
        } catch (error) {
          if (status) status.textContent = error.status === 409 ? "Ese hueco no esta disponible." : "No se pudo enviar la reserva.";
        }
      });
    });
  }

  async function getJson(url) {
    const response = await fetch(window.LocalLiftApi?.url?.(url) || url, {
      headers: window.LocalLiftApi?.headers?.() || { Accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) {
      const error = new Error(`Request failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  async function postJson(url, payload) {
    const response = await fetch(window.LocalLiftApi?.url?.(url) || url, {
      method: "POST",
      headers: window.LocalLiftApi?.headers?.({ json: true }) || { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const error = new Error(`Request failed: ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return response.json();
  }

  function getPublicLeadEndpoint(business = {}) {
    const id = currentBusinessRecord?.slug || currentBusinessRecord?.id || business.slug || business.id || slugify(business.name);
    return id ? `/api/public/${encodeURIComponent(id)}/leads` : "";
  }

  function getPublicBookingEndpoint(business = {}) {
    const id = currentBusinessRecord?.slug || currentBusinessRecord?.id || business.slug || business.id || slugify(business.name);
    return id ? `/api/public/${encodeURIComponent(id)}/bookings` : "";
  }

  function renderState(heading, text = "") {
    root.innerHTML = `<section class="client-site-state"><strong>${escapeHtml(heading)}</strong>${text ? `<p>${escapeHtml(text)}</p>` : ""}</section>`;
  }

  function toDatetimeLocalValue(date) {
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 16);
  }

  function choice(value, allowed, fallback) {
    return allowed.includes(value) ? value : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
  }

  function textOr(value, fallback) {
    return core.textOr ? core.textOr(value, fallback) : String(value || fallback || "").trim();
  }

  function slugify(value) {
    return core.slugify ? core.slugify(value) : String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function escapeHtml(value) {
    return core.escapeHtml ? core.escapeHtml(value) : String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
  }

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
})();
