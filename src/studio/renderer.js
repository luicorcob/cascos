(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.renderer = { createRenderer };

  function createRenderer(dependencies = {}) {
    const {
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
      getCurrentBusinessRecord
    } = dependencies;
    const {
      groupMenuItems,
      formatMoney,
      splitTitleBody,
      textOr,
      phoneHref,
      initials,
      slugify,
      escapeHtml,
      escapeAttr
    } = dependencies.core || {};

    return {
      renderSite,
      renderProductCard,
      buildTrustBadges,
      buildMapEmbedUrl
    };

    function getPersonalizationStyleVars(business) {
      const density = densityLayoutMap[business.contentDensity] || densityLayoutMap.balanced;
      const scale = business.layoutScale / 100;
      const width = contentWidthMap[business.contentWidth] || contentWidthMap.standard;

      return [
        `--site-font-scale:${(business.fontScale / 100).toFixed(2)}`,
        `--site-content-width:${width}px`,
        `--site-hero-content-width:${Math.round(Math.min(width, 1180) * 0.86)}px`,
        `--hero-min-height:${heroSizeMap[business.heroSize] || heroSizeMap.balanced}`,
        `--section-pad-y:${scaledClamp(density.section, scale)}`,
        `--gallery-pad-y:${scaledClamp(density.gallery, scale)}`,
        `--card-min-height:${scalePixels(density.card, scale)}px`,
        `--feature-card-min-height:${scalePixels(density.feature, scale)}px`,
        `--testimonial-card-min-height:${scalePixels(density.testimonial, scale)}px`
      ];
    }

    function scaledClamp([min, vw, max], scale) {
      return `clamp(${scalePixels(min, scale)}px, ${vw}vw, ${scalePixels(max, scale)}px)`;
    }

    function scalePixels(value, scale) {
      return Math.round(value * scale);
    }

    function resolveArtDirection(business) {
      if (business.artDirection && business.artDirection !== "auto") {
        return business.artDirection;
      }

      const fingerprint = [
        business.name,
        business.category,
        business.location,
        business.accent,
        business.designPack
      ].join("|");
      return artDirectionOptions[stableHash(fingerprint) % artDirectionOptions.length];
    }

    function getCreativeStyleVars(business, artDirection) {
      const seed = stableHash(`${business.name}|${business.category}|${business.location}|${artDirection}`);
      const shift = 12 + (seed % 31);
      const angle = (seed % 11) - 5;
      const radius = [0, 6, 18, 999][seed % 4];
      const columns = 2 + (seed % 2);

      return [
        `--creative-shift:${shift}%`,
        `--creative-angle:${angle}deg`,
        `--creative-radius:${radius}px`,
        `--creative-columns:${columns}`,
        `--creative-seed:${seed % 100}`
      ];
    }

    function stableHash(value) {
      return Array.from(String(value || "")).reduce((hash, character) => {
        return ((hash << 5) - hash + character.charCodeAt(0)) >>> 0;
      }, 2166136261);
    }

    function visualList(items, mode, visualCount, balancedCount) {
      const limit = mode === "visual" ? visualCount : mode === "balanced" ? balancedCount : items.length;
      return items.slice(0, Math.max(1, limit));
    }

    function compactText(value, mode, visualWords = 20, balancedWords = 38) {
      const text = String(value || "").trim();
      if (!text || mode === "detailed") {
        return text;
      }

      const words = text.split(/\s+/);
      const limit = mode === "visual" ? visualWords : balancedWords;
      return words.length > limit ? `${words.slice(0, limit).join(" ")}...` : text;
    }

    function renderSite(business) {
      business = withBusinessDefaults(business);
      const artDirection = resolveArtDirection(business);
      const contentMode = business.contentMode || "visual";
      const palette = themePalette[business.theme] || themePalette.aurora;
      const contrast = getContrastTokens(business.accent, palette);
      const gallery = business.gallery.length ? business.gallery : demoBusiness.gallery;
      const allServices = business.services.length ? business.services : demoBusiness.services;
      const allFeatures = business.features.length ? business.features : demoBusiness.features;
      const allTestimonials = business.testimonials.length ? business.testimonials : demoBusiness.testimonials;
      const allFaqs = business.faqs.length ? business.faqs : demoBusiness.faqs;
      const services = visualList(allServices, contentMode, 4, 6);
      const features = visualList(allFeatures, contentMode, 3, 4);
      const testimonials = visualList(allTestimonials, contentMode, 2, 3);
      const faqs = visualList(allFaqs, contentMode, 3, 5);
      const hours = business.hours.length ? business.hours : demoBusiness.hours;
      const links = business.links.length ? business.links : demoBusiness.links;
      const heroImage = business.heroImage || demoBusiness.heroImage;
      const chatbot = { ...demoBusiness.chatbot, ...(business.chatbot || {}) };
      const google = { ...demoBusiness.google, ...(business.google || {}) };
      const commerce = normalizeCommerce(business.commerce);
      const categoryLine = [business.category, business.location].filter(Boolean).join(" en ");
      const bookingLabel = textOr(business.bookingLabel, demoBusiness.bookingLabel);
      const servicesHeading = textOr(business.servicesHeading, demoBusiness.servicesHeading);
      const servicesIntro = textOr(business.servicesIntro, demoBusiness.servicesIntro);
      const trustHeading = textOr(business.trustHeading, demoBusiness.trustHeading);
      const trustIntro = textOr(business.trustIntro, demoBusiness.trustIntro);
      const contactHeading = textOr(business.contactHeading, demoBusiness.contactHeading);
      const blockVariants = business.blockVariants || {};
      const heroMeta = getMediaMeta(business, heroImage, business.name);
      const trustBadges = visualList(
        business.trustBadges.length ? business.trustBadges : buildTrustBadges(business, google),
        contentMode,
        3,
        5
      );
      const heroDescription = compactText(business.description, contentMode);
      const styleVars = [
        `--site-accent:${escapeAttr(business.accent)}`,
        `--site-accent-2:${palette.accent2}`,
        `--site-bg:${palette.bg}`,
        `--site-paper:${palette.paper}`,
        `--site-ink:${palette.ink}`,
        `--site-muted:${palette.muted}`,
        `--site-solid:${contrast.solid}`,
        `--site-on-solid:${contrast.onSolid}`,
        `--site-on-accent:${contrast.onAccent}`,
        `--site-accent-readable:${contrast.accentReadable}`,
        `--site-accent-on-solid:${contrast.accentOnSolid}`,
        `--solid:${contrast.solid}`,
        `--on-solid:${contrast.onSolid}`,
        `--on-accent:${contrast.onAccent}`,
        `--accent-readable:${contrast.accentReadable}`,
        `--accent-on-solid:${contrast.accentOnSolid}`,
        `--site-intensity:${business.intensity}`,
        `--site-glow-opacity:${Math.min(0.88, Math.max(0.24, business.intensity / 130)).toFixed(2)}`,
        `--site-spotlight-opacity:${Math.min(0.78, Math.max(0.18, business.intensity / 150)).toFixed(2)}`,
        ...getCreativeStyleVars(business, artDirection),
        ...getPersonalizationStyleVars(business)
      ].join(";");
      const bookingButton = business.showBooking
        ? `<a class="site-cta magnetic" href="${escapeAttr(business.bookingUrl)}" data-track="booking_click" data-edit-link-field="booking">${escapeHtml(bookingLabel)}</a>`
        : "";
      const resourcePills = buildResourcePills(business, services, links);
      const sectionBlocks = {
        services: `
          <section class="site-section" id="servicios" data-section-key="services">
            <div class="section-inner">
              <div class="section-heading">
                <h2 class="reveal kinetic-title" data-splitting data-edit-field="servicesHeading">${escapeHtml(servicesHeading)}</h2>
                <p class="reveal" data-edit-field="servicesIntro">${escapeHtml(compactText(servicesIntro, contentMode, 13, 28))}</p>
              </div>
              <div class="services-grid">
                ${services.map((service, index) => renderServiceCard(service, index)).join("")}
              </div>
            </div>
          </section>`,
        menu: business.showMenu && business.menuItems.length ? renderMenuSection(business) : "",
        store: commerce.enabled ? renderStoreSection(business, commerce) : "",
        gallery: business.showGallery ? `
          <section class="gallery-band" id="galeria" aria-label="Galeria de fotos" data-section-key="gallery">
            <div class="gallery-track">
              ${[...gallery, ...gallery].map((image, index) => renderGalleryItem(image, index % gallery.length, business.name, business, index >= gallery.length)).join("")}
            </div>
          </section>` : "",
        features: `
          <section class="site-section feature-section" data-section-key="features">
            <div class="section-inner split-section">
              <div class="image-panel parallax-media reveal">
                ${renderEditableImage(business, gallery[0] || heroImage, `${business.name} destacado`, {
                  list: "gallery",
                  index: 0,
                  loading: "lazy",
                  sizes: "(max-width: 760px) calc(100vw - 28px), 44vw"
                })}
              </div>
              <div class="feature-stack">
                ${features.map((feature, index) => renderFeatureCard(feature, index)).join("")}
                <div class="feature-card reveal tilt-card">
                  <span class="card-index">H</span>
                  <h3>Horario y ritmo real</h3>
                  <div class="hours-grid">
                    ${hours.map((line) => `<span>${escapeHtml(line)}</span>`).join("")}
                  </div>
                </div>
              </div>
            </div>
          </section>`,
        testimonials: business.showTestimonials ? `
          <section class="site-section testimonial-section" data-section-key="testimonials">
            <div class="section-inner">
              <div class="section-heading">
                <h2 class="reveal kinetic-title" data-splitting data-edit-field="trustHeading">${escapeHtml(trustHeading)}</h2>
                <p class="reveal" data-edit-field="trustIntro">${escapeHtml(compactText(trustIntro, contentMode, 13, 28))}</p>
              </div>
              <div class="testimonial-grid">
                ${testimonials.map((testimonial, index) => renderTestimonial(testimonial, index)).join("")}
              </div>
            </div>
          </section>` : "",
        faq: business.showFaq ? `
          <section class="site-section faq-section" data-section-key="faq">
            <div class="section-inner">
              <div class="section-heading">
                <h2 class="reveal kinetic-title" data-splitting>Preguntas que venden por ti.</h2>
                <p class="reveal">Cada respuesta evita mensajes repetidos y acerca al cliente al siguiente paso.</p>
              </div>
              <div class="faq-list">
                ${faqs.map((faq, index) => renderFaq(faq, index)).join("")}
              </div>
            </div>
          </section>` : "",
        map: business.showMap ? renderLocationSection(business, google) : "",
        booking: business.showBooking ? renderBookingSection(business, services) : "",
        lead: business.showLeadForm ? renderLeadSection(business) : ""
      };
      const requestedOrder = Array.isArray(business.sectionOrder) ? business.sectionOrder : [];
      const sectionOrder = [...requestedOrder, ...Object.keys(sectionBlocks)]
        .filter((key, index, items) => sectionBlocks[key] !== undefined && items.indexOf(key) === index);
      const orderedSections = sectionOrder.map((key) => sectionBlocks[key]).join("");

      return `
        <article class="generated-site art-${escapeAttr(artDirection)} content-${escapeAttr(contentMode)} theme-${escapeAttr(business.theme)} motion-${escapeAttr(business.motion)} typography-${escapeAttr(business.typography)} density-${escapeAttr(business.contentDensity)} shape-${escapeAttr(business.visualShape)} image-ratio-${escapeAttr(business.imageRatio)} block-hero-${escapeAttr(blockVariants.hero || "cinematic")} block-services-${escapeAttr(blockVariants.services || "cards")} block-gallery-${escapeAttr(blockVariants.gallery || "marquee")} block-testimonials-${escapeAttr(blockVariants.testimonials || "cards")} block-contact-${escapeAttr(blockVariants.contact || "split")}" style="${styleVars}" data-premium-effects="${business.premiumEffects}" data-art-direction="${escapeAttr(artDirection)}">
          ${business.premiumEffects ? '<div class="cursor-spotlight" aria-hidden="true"></div>' : ""}
          <div class="site-progress" aria-hidden="true"></div>
          ${business.showAnnouncement && business.announcement ? `<div class="site-announcement" data-edit-field="announcement">${escapeHtml(business.announcement)}</div>` : ""}
          <a class="site-skip-link" href="#servicios">Saltar al contenido</a>
          <nav class="site-nav" aria-label="Navegacion principal">
            <a class="site-logo" href="#inicio" aria-label="${escapeAttr(business.name)}">
              <span class="site-logo-mark">${escapeHtml(initials(business.name))}</span>
              <span data-edit-field="name">${escapeHtml(business.name)}</span>
            </a>
            <div class="site-nav-links">
              <a href="#servicios">Servicios</a>
              ${business.showMenu && business.menuItems.length ? '<a href="#carta">Carta</a>' : ""}
              ${commerce.enabled ? '<a href="#tienda">Tienda</a>' : ""}
              ${business.showGallery ? '<a href="#galeria">Galeria</a>' : ""}
              ${business.showMap ? '<a href="#ubicacion">Mapa</a>' : ""}
              ${business.showBooking ? '<a href="#reservas">Reservar</a>' : ""}
              <a href="#contacto">Contacto</a>
              ${bookingButton}
            </div>
          </nav>

          <header class="hero-section" id="inicio">
            <picture class="hero-media parallax-media">
              <img src="${escapeAttr(heroImage)}" alt="${escapeAttr(heroMeta.alt)}" style="object-position:${escapeAttr(heroMeta.position)}" data-edit-image-field="heroImage" loading="eager" fetchpriority="high" decoding="async" sizes="100vw">
            </picture>
            ${renderHeroArt(business, gallery, artDirection)}
            <div class="hero-atmosphere" aria-hidden="true">
              <span class="mesh-field"></span>
              <span class="mesh-field"></span>
              <span class="mesh-field"></span>
            </div>
            <div class="hero-content">
              <span class="hero-kicker reveal">${escapeHtml(categoryLine || business.category)}</span>
              <h1 class="reveal kinetic-title" data-splitting data-edit-field="tagline">${escapeHtml(business.tagline || business.name)}</h1>
              <p class="reveal" data-edit-field="description">${escapeHtml(heroDescription)}</p>
              <div class="hero-actions reveal">
                ${bookingButton}
                <a class="ghost-link magnetic" href="#contacto">Ver contacto</a>
              </div>
              <div class="hero-conversion reveal" aria-label="Resumen de conversion">
                <span data-edit-field="conversionGoal">${escapeHtml(business.conversionGoal)}</span>
                ${google.enabled && google.rating ? `<strong>${escapeHtml(Number(google.rating).toFixed(1))}/5 Google</strong>` : `<strong>${escapeHtml(services.length)} servicios</strong>`}
              </div>
            </div>
          </header>

          <section class="proof-strip" aria-label="Datos destacados">
            <div class="proof-item reveal">
              <span class="proof-number">${services.length}</span>
              <span class="proof-label">servicios clave</span>
            </div>
            <div class="proof-item reveal">
              <span class="proof-number">${gallery.length}</span>
              <span class="proof-label">momentos visuales</span>
            </div>
            <div class="proof-item reveal">
              <span class="proof-number">24/7</span>
              <span class="proof-label">abierto digitalmente</span>
            </div>
            ${commerce.enabled ? `
            <div class="proof-item reveal">
              <span class="proof-number">${escapeHtml(commerce.products.length)}</span>
              <span class="proof-label">productos listos para carrito, pago seguro y gestion de pedidos</span>
            </div>` : ""}
            ${google.enabled && google.rating ? `
            <div class="proof-item reveal">
              <span class="proof-number">${escapeHtml(google.rating.toFixed ? google.rating.toFixed(1) : google.rating)}</span>
              <span class="proof-label">rating Google con ${escapeHtml(google.reviewCount || 0)} resenas conectables</span>
            </div>` : ""}
          </section>

          ${business.showResourceMarquee ? `<section class="resource-marquee" aria-label="Recursos digitales incluidos">
            <div class="resource-marquee-track">
              ${[...resourcePills, ...resourcePills].map((item) => `<span class="resource-pill">${escapeHtml(item)}</span>`).join("")}
            </div>
          </section>` : ""}

          ${business.showTrustRail ? `<section class="trust-rail" aria-label="Pruebas de confianza">
            ${trustBadges.map((badge) => `<span class="trust-badge reveal">${escapeHtml(badge)}</span>`).join("")}
          </section>` : ""}

          ${orderedSections}

          <section class="site-section contact-section" id="contacto">
            <div class="section-inner contact-panel reveal">
              <div>
                <h2 data-edit-field="contactHeading">${escapeHtml(contactHeading)}</h2>
                <p data-edit-field="address">${escapeHtml(business.address || business.location || "Direccion pendiente de confirmar.")}</p>
                <div class="contact-links">
                  ${business.phone ? `<a href="tel:${escapeAttr(phoneHref(business.phone))}" data-track="phone_click" data-edit-link-field="phone">Llamar</a>` : ""}
                  ${business.email ? `<a href="mailto:${escapeAttr(business.email)}" data-track="email_click" data-edit-link-field="email">Email</a>` : ""}
                  ${google.enabled && google.mapsUrl ? `<a href="${escapeAttr(google.mapsUrl)}" target="_blank" rel="noreferrer" data-track="google_maps_click">Mapa</a>` : ""}
                  ${google.enabled && google.reviewUrl ? `<a href="${escapeAttr(google.reviewUrl)}" target="_blank" rel="noreferrer" data-track="google_review_click">Dejar resena</a>` : ""}
                  ${bookingButton}
                </div>
              </div>
              <div>
                <p data-edit-field="description">${escapeHtml(compactText(business.description, contentMode, 16, 30))}</p>
                <div class="social-links">
                  ${links.map((link, index) => `<a href="${escapeAttr(link.url)}" target="_blank" rel="noreferrer" data-track="outbound_${escapeAttr(slugify(link.label))}" data-edit-link-list="links" data-edit-index="${index}">${escapeHtml(link.label)}</a>`).join("")}
                </div>
              </div>
            </div>
          </section>

          <footer class="site-footer">
            <span>${escapeHtml(business.name)} - ${escapeHtml(business.location || "Negocio local")}</span>
            <span>Web generada con LocalLift Studio</span>
          </footer>
          ${business.showConversionDock ? renderConversionDock(business, google) : ""}
          ${renderChatbotWidget(business, { services: allServices, features: allFeatures, hours, faqs: allFaqs, links, chatbot, google, commerce })}
        </article>
      `;
    }

    function renderHeroArt(business, gallery, artDirection) {
      const images = [
        gallery[0] || business.heroImage,
        gallery[1] || business.heroImage,
        gallery[2] || business.heroImage
      ];

      return `
        <div class="hero-art atropos hero-art-${escapeAttr(artDirection)}" data-atropos-root aria-hidden="true">
          <div class="atropos-scale">
            <div class="atropos-rotate">
              <div class="atropos-inner hero-art-inner">
                <figure class="hero-art-card hero-art-card-primary" data-atropos-offset="-2">
                  <img src="${escapeAttr(images[0])}" alt="" loading="eager" decoding="async">
                </figure>
                <figure class="hero-art-card hero-art-card-secondary" data-atropos-offset="5">
                  <img src="${escapeAttr(images[1])}" alt="" loading="lazy" decoding="async">
                </figure>
                <figure class="hero-art-card hero-art-card-tertiary" data-atropos-offset="9">
                  <img src="${escapeAttr(images[2])}" alt="" loading="lazy" decoding="async">
                </figure>
                <span class="hero-art-monogram" data-atropos-offset="12">${escapeHtml(initials(business.name))}</span>
                <span class="hero-art-label" data-atropos-offset="7">${escapeHtml(business.location || business.category)}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="creative-signature" aria-hidden="true">
          <span>${escapeHtml(artDirection)}</span>
          <strong>${escapeHtml(business.name)}</strong>
        </div>
      `;
    }

    function renderStoreSection(business, commerce) {
      const products = commerce.products.length ? commerce.products : demoBusiness.commerce.products;
        const context = {
        business: {
          name: business.name,
          email: business.email,
          phone: business.phone
        },
        commerce: {
          ...commerce,
          products
        }
      };
      const termsText = [
        commerce.termsUrl ? `<a href="${escapeAttr(commerce.termsUrl)}" target="_blank" rel="noreferrer">terminos</a>` : "condiciones del pedido",
        commerce.privacyUrl ? `<a href="${escapeAttr(commerce.privacyUrl)}" target="_blank" rel="noreferrer">privacidad</a>` : ""
      ].filter(Boolean).join(" y ");

      return `
        <section class="site-section store-section" id="tienda" data-section-key="store" data-store data-store-context="${escapeAttr(JSON.stringify(context))}">
          <div class="section-inner">
            <div class="section-heading">
              <h2 class="reveal kinetic-title" data-splitting>${escapeHtml(commerce.title)}</h2>
              <p class="reveal">${escapeHtml(commerce.intro)}</p>
            </div>
            <div class="store-payment-notice" data-store-payment-notice hidden></div>
            <div class="store-layout">
              <div class="store-products" data-store-products>
                ${products.map((product) => renderProductCard(product, commerce.currency)).join("")}
              </div>
              <aside class="store-cart reveal" id="carrito" aria-label="Carrito de compra">
                <div class="store-cart-head">
                  <div>
                    <p class="hero-kicker">Pedido online</p>
                    <h3>Carrito</h3>
                  </div>
                  <strong data-cart-total>${escapeHtml(formatMoney(0, commerce.currency))}</strong>
                </div>
                <div class="store-cart-items" data-cart-items>
                  <p class="store-empty">Anade productos para empezar.</p>
                </div>
                <div class="store-summary" data-order-summary>
                  <div><span>Subtotal</span><strong>${escapeHtml(formatMoney(0, commerce.currency))}</strong></div>
                  <div><span>Descuento</span><strong>${escapeHtml(formatMoney(0, commerce.currency))}</strong></div>
                  <div><span>Envio</span><strong>${escapeHtml(formatMoney(0, commerce.currency))}</strong></div>
                  <div><span>Impuestos</span><strong>${escapeHtml(formatMoney(0, commerce.currency))}</strong></div>
                </div>
                <form class="store-checkout-form" data-store-checkout>
                  <label>
                    Nombre
                    <input name="customerName" type="text" autocomplete="name" required>
                  </label>
                  <label>
                    Email
                    <input name="customerEmail" type="email" autocomplete="email" required>
                  </label>
                  <label>
                    Telefono
                    <input name="customerPhone" type="tel" autocomplete="tel" required>
                  </label>
                  <label>
                    Direccion o indicaciones
                    <textarea name="customerAddress" rows="3" placeholder="${escapeAttr(commerce.deliveryMode)}"></textarea>
                  </label>
                  <fieldset class="store-shipping-options" data-shipping-options>
                    <legend>Entrega</legend>
                  </fieldset>
                  <label>
                    Cupon
                    <input name="couponCode" type="text" autocomplete="off" placeholder="BIENVENIDA10">
                  </label>
                  <label class="store-terms">
                    <input name="acceptTerms" type="checkbox" required>
                    <span>Acepto ${termsText}</span>
                  </label>
                  <button type="submit">Pagar pedido</button>
                  <span class="store-status" data-store-status aria-live="polite"></span>
                </form>
                <p class="store-small">${escapeHtml(commerce.deliveryMode)}</p>
              </aside>
            </div>
            <a class="mobile-cart-bar" href="#carrito" data-mobile-cart-bar hidden>
              <span>Ver carrito</span>
              <strong data-mobile-cart-total>${escapeHtml(formatMoney(0, commerce.currency))}</strong>
            </a>
          </div>
        </section>
      `;
    }

    function renderMenuSection(business) {
      const groups = groupMenuItems(business.menuItems);

      return `
        <section class="site-section menu-section" id="carta" data-section-key="menu">
          <div class="section-inner">
            <div class="section-heading menu-heading">
              <div>
                <span class="menu-eyebrow">Carta / ${escapeHtml(groups.length)} secciones</span>
                <h2 class="reveal kinetic-title" data-splitting>${escapeHtml(business.menuTitle)}</h2>
              </div>
              <p class="reveal">${escapeHtml(business.menuIntro)}</p>
            </div>
            <div class="menu-category-grid">
              ${groups.map((group) => `
                <section class="menu-category reveal" aria-labelledby="menu-${escapeAttr(slugify(group.category))}">
                  <h3 id="menu-${escapeAttr(slugify(group.category))}">${escapeHtml(group.category)}</h3>
                  <div class="menu-items">
                    ${group.items.map((item) => `
                      <article class="menu-item">
                        <div>
                          <h4>${escapeHtml(item.name)}</h4>
                          ${item.description ? `<p>${escapeHtml(item.description)}</p>` : ""}
                        </div>
                        <strong>${escapeHtml(formatMoney(item.price, business.menuCurrency))}</strong>
                      </article>
                    `).join("")}
                  </div>
                </section>
              `).join("")}
            </div>
          </div>
        </section>
      `;
    }

    function renderProductCard(product, currency) {
      return `
        <article class="product-card reveal tilt-card" data-product-id="${escapeAttr(product.id)}">
          <figure>
            <img src="${escapeAttr(product.image)}" alt="${escapeAttr(product.name)}" loading="lazy" decoding="async" sizes="(max-width: 760px) calc(100vw - 28px), 33vw">
          </figure>
          <div class="product-card-body">
            <div>
              <p class="product-sku">${escapeHtml(product.sku || product.id)}</p>
              <h3>${escapeHtml(product.name)}</h3>
              <p>${escapeHtml(product.description)}</p>
            </div>
            <div class="product-card-bottom">
              <strong>${escapeHtml(formatMoney(product.price, currency))}</strong>
              <button type="button" data-add-product="${escapeAttr(product.id)}">Anadir</button>
            </div>
          </div>
        </article>
      `;
    }

    function renderServiceCard(service, index) {
      const parts = splitTitleBody(service);
      return `
        <article class="service-card reveal tilt-card">
          <span class="card-index">${String(index + 1).padStart(2, "0")}</span>
          <h3 data-edit-list="services" data-edit-index="${index}" data-edit-part="title">${escapeHtml(parts.title)}</h3>
          <p data-edit-list="services" data-edit-index="${index}" data-edit-part="body">${escapeHtml(parts.body)}</p>
        </article>
      `;
    }

    function renderFeatureCard(feature, index) {
      const parts = splitTitleBody(feature);
      return `
        <article class="feature-card reveal tilt-card">
          <span class="card-index">${String.fromCharCode(65 + index)}</span>
          <h3 data-edit-list="features" data-edit-index="${index}" data-edit-part="title">${escapeHtml(parts.title)}</h3>
          <p data-edit-list="features" data-edit-index="${index}" data-edit-part="body">${escapeHtml(parts.body)}</p>
        </article>
      `;
    }

    function renderGalleryItem(image, index, name, business, isClone = false) {
      const cloneClass = isClone ? " is-gallery-clone" : "";
      const ariaHidden = isClone ? ' aria-hidden="true"' : "";
      const alt = isClone ? "" : `${name} foto ${index + 1}`;
      const meta = getMediaMeta(isClone ? {} : business, image, alt);

      return `
        <figure class="gallery-item${cloneClass}"${ariaHidden}>
          <img src="${escapeAttr(image)}" alt="${escapeAttr(meta.alt)}" style="object-position:${escapeAttr(meta.position)}" data-edit-image-list="gallery" data-edit-index="${index}" loading="lazy" decoding="async" sizes="(max-width: 760px) 82vw, 32vw">
        </figure>
      `;
    }

    function renderTestimonial(testimonial, index) {
      return `
        <article class="testimonial-card reveal tilt-card">
          <span class="quote-mark">"</span>
          <p data-edit-list="testimonials" data-edit-index="${index}" data-edit-part="text">${escapeHtml(testimonial.text)}</p>
          <strong class="testimonial-author" data-edit-list="testimonials" data-edit-index="${index}" data-edit-part="name">${escapeHtml(testimonial.name)}</strong>
        </article>
      `;
    }

    function renderEditableImage(business, url, fallbackAlt, options = {}) {
      const meta = getMediaMeta(business, url, fallbackAlt);
      const editTarget = options.field
        ? `data-edit-image-field="${escapeAttr(options.field)}"`
        : `data-edit-image-list="${escapeAttr(options.list || "gallery")}" data-edit-index="${Number(options.index || 0)}"`;
      return `<img src="${escapeAttr(url)}" alt="${escapeAttr(meta.alt)}" style="object-position:${escapeAttr(meta.position)}" ${editTarget} loading="${escapeAttr(options.loading || "lazy")}" decoding="async" sizes="${escapeAttr(options.sizes || "100vw")}">`;
    }

    function getMediaMeta(business, url, fallbackAlt) {
      const meta = business?.mediaMetadata?.[url] || {};
      const allowedPositions = ["center center", "center top", "center bottom", "left center", "right center"];
      return {
        alt: textOr(meta.alt, fallbackAlt),
        position: allowedPositions.includes(meta.position) ? meta.position : "center center"
      };
    }

    function renderFaq(faq, index) {
      return `
        <details class="faq-item reveal">
          <summary data-edit-list="faqs" data-edit-index="${index}" data-edit-part="question">${escapeHtml(faq.question)}</summary>
          <p data-edit-list="faqs" data-edit-index="${index}" data-edit-part="answer">${escapeHtml(faq.answer)}</p>
        </details>
      `;
    }

    function renderLeadSection(business) {
      const leadEndpoint = getPublicLeadEndpoint(business);

      return `
        <section class="site-section lead-section" id="lead" data-section-key="lead">
          <div class="section-inner lead-panel reveal">
            <div>
              <p class="hero-kicker">Lead listo para seguimiento</p>
              <h2>${escapeHtml(business.leadFormTitle)}</h2>
              <p>${escapeHtml(business.leadFormIntro)}</p>
            </div>
            <form class="lead-form" data-lead-form data-lead-endpoint="${escapeAttr(leadEndpoint)}">
              <label>
                Nombre
                <input name="leadName" type="text" autocomplete="name" required>
              </label>
              <label>
                Telefono o email
                <input name="leadContact" type="text" autocomplete="tel" required>
              </label>
              <label>
                Que necesitas?
                <textarea name="leadMessage" rows="4" required></textarea>
              </label>
              ${renderPrivacyConsent(business)}
              <button type="submit">${escapeHtml(business.leadFormCta)}</button>
              <span class="lead-status" data-lead-status aria-live="polite"></span>
            </form>
          </div>
        </section>
      `;
    }

    function renderBookingSection(business, services) {
      const bookingEndpoint = getPublicBookingEndpoint(business);
      const bookableServices = services.length ? services : demoBusiness.services;

      return `
        <section class="site-section lead-section booking-section" id="reservas" data-section-key="booking">
          <div class="section-inner lead-panel reveal">
            <div>
              <p class="hero-kicker">Reserva visible</p>
              <h2>Elige servicio y deja tus datos.</h2>
              <p>La solicitud entra en la agenda del negocio si la API esta activa. Si no, queda guardada en esta sesion para no perder el contacto.</p>
            </div>
            <form class="lead-form" data-public-booking-form data-booking-endpoint="${escapeAttr(bookingEndpoint)}">
              <label>
                Servicio
                <input name="serviceName" list="booking-service-options" type="text" value="${escapeAttr(splitTitleBody(bookableServices[0] || "Reserva").title)}" required>
                <datalist id="booking-service-options">
                  ${bookableServices.map((service) => `<option value="${escapeAttr(splitTitleBody(service).title)}"></option>`).join("")}
                </datalist>
              </label>
              <label>
                Fecha y hora
                <input name="startsAt" type="datetime-local" required>
              </label>
              <label>
                Nombre
                <input name="customerName" type="text" autocomplete="name" required>
              </label>
              <label>
                Telefono o email
                <input name="contact" type="text" autocomplete="tel" required>
              </label>
              <label>
                Nota
                <textarea name="notes" rows="3" placeholder="Personas, preferencia horaria o contexto"></textarea>
              </label>
              ${renderPrivacyConsent(business)}
              <button type="submit">Solicitar reserva</button>
              <span class="lead-status" data-booking-status aria-live="polite"></span>
            </form>
          </div>
        </section>
      `;
    }

    function renderPrivacyConsent(business) {
      const privacyLabel = business.privacyUrl
        ? `<a href="${escapeAttr(business.privacyUrl)}" target="_blank" rel="noreferrer">politica de privacidad</a>`
        : "informacion de privacidad";

      return `
        <label class="form-consent">
          <input name="privacyAccepted" type="checkbox" value="true" required>
          <span>Acepto que ${escapeHtml(business.name)} use mis datos para responder a esta solicitud y he leido la ${privacyLabel}.</span>
        </label>
      `;
    }

    function renderLocationSection(business, google) {
      const hasLocation = business.address || business.location || google.mapsUrl || google.mapEmbedUrl;

      if (!hasLocation) {
        return "";
      }

      const mapUrl = google.mapEmbedUrl || buildMapEmbedUrl(business, google);
      const directionsNote = textOr(
        google.directionsNote,
        "Ubicacion visible para llegar rapido, calcular ruta y reducir dudas antes de visitar."
      );

      return `
        <section class="site-section location-section" id="ubicacion" data-section-key="map">
          <div class="section-inner location-panel reveal">
            <div class="location-copy">
              <p class="hero-kicker">Ubicacion y llegada</p>
              <h2>Encuentra ${escapeHtml(business.name)} sin perder tiempo.</h2>
              <p>${escapeHtml(business.address || business.location || "Ubicacion pendiente de confirmar.")}</p>
              <p>${escapeHtml(directionsNote)}</p>
              <div class="contact-links">
                ${google.mapsUrl ? `<a href="${escapeAttr(google.mapsUrl)}" target="_blank" rel="noreferrer" data-track="location_map_click">Abrir Google Maps</a>` : ""}
                ${business.phone ? `<a href="tel:${escapeAttr(phoneHref(business.phone))}" data-track="location_phone_click">Llamar</a>` : ""}
              </div>
            </div>
            <div class="map-frame">
              <iframe title="Mapa de ${escapeAttr(business.name)}" src="${escapeAttr(mapUrl)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
            </div>
          </div>
        </section>
      `;
    }

    function renderConversionDock(business, google) {
      const commerce = normalizeCommerce(business.commerce || {});
      const actions = [
        commerce.enabled ? { label: "Comprar", url: "#tienda", track: "dock_store_click" } : null,
        business.showBooking
          ? { label: textOr(business.bookingLabel, "Reservar"), url: "#reservas", track: "dock_booking_click" }
          : null,
        business.phone ? { label: "Llamar", url: `tel:${phoneHref(business.phone)}`, track: "dock_phone_click" } : null,
        google.enabled && google.mapsUrl ? { label: "Mapa", url: google.mapsUrl, track: "dock_maps_click" } : null
      ].filter(Boolean);

      if (!actions.length) {
        return "";
      }

      return `
        <aside class="conversion-dock" aria-label="Acciones rapidas">
          ${actions.map((action) => `<a href="${escapeAttr(action.url)}" data-track="${escapeAttr(action.track)}">${escapeHtml(action.label)}</a>`).join("")}
        </aside>
      `;
    }

    function renderChatbotWidget(business, resolved) {
      const chatbot = resolved.chatbot;

      if (!chatbot.enabled) {
        return "";
      }

      const quickPrompts = chatbot.quickPrompts.length
        ? chatbot.quickPrompts
        : demoBusiness.chatbot.quickPrompts;
      const context = getChatbotContext(business, resolved);

      return `
        <aside class="chatbot-widget" data-chatbot-context="${escapeAttr(JSON.stringify(context))}" aria-label="Asistente virtual">
          <button class="chatbot-launcher" type="button" aria-expanded="false">
            <span class="chatbot-pulse" aria-hidden="true"></span>
            <span>
              <strong>${escapeHtml(chatbot.name)}</strong>
              <small>Atencion instantanea</small>
            </span>
          </button>
          <div class="chatbot-panel" role="dialog" aria-label="${escapeAttr(chatbot.name)}">
            <header class="chatbot-header">
              <div>
                <strong>${escapeHtml(chatbot.name)}</strong>
                <span>${escapeHtml(toneLabel(chatbot.tone))}</span>
              </div>
              <button class="chatbot-close" type="button" aria-label="Cerrar asistente">x</button>
            </header>
            <div class="chatbot-messages" data-chatbot-messages>
              <div class="chat-message is-bot">${escapeHtml(chatbot.greeting)}</div>
            </div>
            <div class="chatbot-prompts" aria-label="Preguntas rapidas">
              ${quickPrompts.map((prompt) => `<button type="button" data-chatbot-prompt="${escapeAttr(prompt)}">${escapeHtml(prompt)}</button>`).join("")}
            </div>
            <form class="chatbot-form" data-chatbot-form>
              <input name="message" type="text" autocomplete="off" placeholder="Escribe una pregunta...">
              <button type="submit">Enviar</button>
            </form>
          </div>
        </aside>
      `;
    }

    function getChatbotContext(business, resolved) {
      const currentBusinessRecord = getCurrentBusinessRecord?.() || null;
      const bookingUrl = business.showBooking ? business.bookingUrl : "#contacto";
      const mapsLink =
        resolved.google?.mapsUrl ||
        resolved.links.find((link) => /map|maps|google/i.test(link.label))?.url ||
        "";
      const appointmentUrl = resolved.google?.appointmentUrl || bookingUrl;
      return {
        business: {
          id: currentBusinessRecord?.id || business.id || "",
          slug: currentBusinessRecord?.slug || business.slug || slugify(business.name || ""),
          name: business.name,
          category: business.category,
          location: business.location,
          description: business.description,
          phone: business.phone,
          email: business.email,
          address: business.address,
          bookingUrl: appointmentUrl,
          mapsLink
        },
        services: resolved.services,
        features: resolved.features,
        hours: resolved.hours,
        faqs: resolved.faqs,
        links: resolved.links,
        commerce: {
          enabled: resolved.commerce?.enabled || false,
          title: resolved.commerce?.title || "",
          currency: resolved.commerce?.currency || "EUR",
          products: normalizeProducts(resolved.commerce?.products || []).slice(0, 12)
        },
        google: {
          enabled: resolved.google?.enabled || false,
          workspaceEmail: resolved.google?.workspaceEmail || "",
          workspaceDomain: resolved.google?.workspaceDomain || "",
          managerEmail: resolved.google?.managerEmail || "",
          placeId: resolved.google?.placeId || "",
          mapsUrl: resolved.google?.mapsUrl || "",
          mapEmbedUrl: resolved.google?.mapEmbedUrl || "",
          directionsNote: resolved.google?.directionsNote || "",
          reviewUrl: resolved.google?.reviewUrl || "",
          reviewRequestTemplate: resolved.google?.reviewRequestTemplate || "",
          appointmentUrl: resolved.google?.appointmentUrl || "",
          bookingRules: resolved.google?.bookingRules || "",
          rating: resolved.google?.rating || 0,
          reviewCount: resolved.google?.reviewCount || 0,
          calendarId: resolved.google?.calendarId || "",
          businessProfileAccountId: resolved.google?.businessProfileAccountId || "",
          businessProfileLocationId: resolved.google?.businessProfileLocationId || ""
        },
        chatbot: {
          name: resolved.chatbot.name,
          tone: resolved.chatbot.tone,
          greeting: resolved.chatbot.greeting,
          handoffLabel: resolved.chatbot.handoffLabel,
          endpoint: resolved.chatbot.endpoint,
          leadEndpoint: getPublicLeadEndpoint(business)
        }
      };
    }

    function toneLabel(tone) {
      return {
        directo: "Rapido y claro",
        cercano: "Cercano y util",
        premium: "Atencion premium"
      }[tone] || "Cercano y util";
    }

    function buildResourcePills(business, services, links) {
      const basics = [
        business.showBooking ? "Reserva directa" : "Contacto claro",
        business.phone ? "Llamada en un toque" : "CTA principal",
        business.address ? "Mapa y direccion" : business.location || "Zona destacada",
        business.google?.mapEmbedUrl || business.address ? "Mapa embebido" : "",
        business.commerce?.enabled ? "Tienda online" : "",
        business.commerce?.checkoutEndpoint ? "Checkout Stripe" : "",
        "Galeria viva",
        "SEO local",
        "Animacion premium",
        "Mobile first",
        "Carga rapida"
      ];
      const servicePills = services.slice(0, 3).map((item) => splitTitleBody(item).title);
      const linkPills = links.slice(0, 2).map((item) => item.label);
      return [...basics, ...servicePills, ...linkPills].filter(Boolean);
    }

    function buildTrustBadges(business, google) {
      return [
        google?.rating ? `${Number(google.rating).toFixed(1)}/5 en Google` : "",
        business.bookingUrl && business.bookingUrl !== "#contacto" ? "CTA directo activo" : "",
        business.chatbot?.enabled ? "Asistente instantaneo" : "",
        business.commerce?.enabled ? "Pago online preparado" : "",
        business.showLeadForm ? "Captura de leads" : "",
        business.gallery.length >= 3 ? "Galeria preparada" : ""
      ].filter(Boolean).slice(0, 5);
    }

    function buildMapEmbedUrl(business, google = {}) {
      if (google.placeId) {
        return `https://www.google.com/maps?q=place_id:${encodeURIComponent(google.placeId)}&output=embed`;
      }

      const query = [business.address, business.location, business.name].filter(Boolean).join(", ");
      return `https://www.google.com/maps?q=${encodeURIComponent(query || business.name || "negocio local")}&output=embed`;
    }

  }
})(globalThis);
