(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.exporter = { createExporter };

  function createExporter(dependencies = {}) {
    const {
      dataVersion: DATA_VERSION,
      getCurrentBusinessRecord,
      demoBusiness,
      renderSite,
      withBusinessDefaults,
      normalizeCommerce,
      buildMapEmbedUrl,
      slugify,
      splitTitleBody,
      escapeHtml,
      escapeAttr
    } = dependencies;

    return {
      buildExportDocument,
      buildLocalBusinessSchema
    };

    async function buildExportDocument(business) {
      business = withBusinessDefaults(business);
      const title = escapeHtml(`${business.name} - ${business.category}`);
      const description = escapeAttr(business.description || business.tagline);
      const content = stripStudioMetadata(renderSite(business));
      const [exportCss, vendor] = await Promise.all([fetchExportCss(), fetchVendorResources()]);
      const schema = JSON.stringify(buildLocalBusinessSchema(business), null, 2).replace(/</g, "\\u003c");
      const runtimeData = JSON.stringify(buildExportRuntimeData(business), null, 2).replace(/</g, "\\u003c");

      return `<!doctype html>
    <html lang="es" class="no-js">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>${title}</title>
        <meta name="description" content="${description}">
        ${window.LocalLiftApi?.getBase?.() ? `<meta name="locallift-api-base" content="${escapeAttr(window.LocalLiftApi.getBase())}">` : ""}
        <meta property="og:title" content="${escapeAttr(business.name)}">
        <meta property="og:description" content="${description}">
        <meta property="og:image" content="${escapeAttr(business.heroImage)}">
        <script type="application/ld+json">
    ${schema}
        </script>
        <style>
    ${exportCss}
    ${vendor.css}
        </style>
      </head>
      <body>
    ${content}
        <script id="locallift-export-data" type="application/json">
    ${runtimeData}
        </script>
        <script>
    ${vendor.js}
    ${getExportScript()}
        </script>
      </body>
    </html>`;
    }

    function buildExportRuntimeData(business) {
      const currentBusinessRecord = getCurrentBusinessRecord?.() || null;
      return {
        version: DATA_VERSION,
        exportedAt: new Date().toISOString(),
        business: {
          id: currentBusinessRecord?.id || business.id || "",
          slug: currentBusinessRecord?.slug || business.slug || slugify(business.name || ""),
          name: business.name,
          category: business.category,
          location: business.location,
          privacyUrl: business.privacyUrl || ""
        }
      };
    }

    function stripStudioMetadata(html) {
      return String(html || "").replace(/\sdata-(?:edit-[a-z-]+|section-key|text-style-key)="[^"]*"/g, "");
    }

    function buildLocalBusinessSchema(business) {
      business = withBusinessDefaults(business);
      const services = business.services?.length ? business.services : demoBusiness.services;
      const gallery = business.gallery?.length ? business.gallery : demoBusiness.gallery;
      const google = business.google || {};
      const commerce = normalizeCommerce(business.commerce);

      return {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: business.name,
        slogan: business.tagline,
        description: business.description,
        image: [business.heroImage, ...gallery].filter(Boolean).slice(0, 6),
        telephone: business.phone,
        email: business.email,
        address: business.address,
        areaServed: business.location,
        hasMap: google.mapsUrl || buildMapEmbedUrl(business, google),
        url: business.bookingUrl && business.bookingUrl !== "#contacto" ? business.bookingUrl : undefined,
        sameAs: (business.links || []).map((link) => link.url).filter(Boolean),
        openingHours: business.hours || [],
        aggregateRating: google.rating
          ? {
              "@type": "AggregateRating",
              ratingValue: google.rating,
              reviewCount: google.reviewCount || 1
            }
          : undefined,
        makesOffer: [
          ...services.map((service) => ({
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name: splitTitleBody(service).title
            }
          })),
          ...(commerce.enabled ? commerce.products : []).map((product) => ({
            "@type": "Offer",
            price: product.price,
            priceCurrency: commerce.currency,
            availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
            itemOffered: {
              "@type": "Product",
              name: product.name,
              image: product.image,
              sku: product.sku,
              description: product.description
            }
          }))
        ]
      };
    }

    async function fetchVendorResources() {
      const [openProps, atroposCss, lenis, splitting, vanillaTilt, atropos] = await Promise.all([
        fetchText("assets/vendor/open-props-animations.min.css"),
        fetchText("assets/vendor/atropos.min.css"),
        fetchText("assets/vendor/lenis.min.js"),
        fetchText("assets/vendor/splitting.min.js"),
        fetchText("assets/vendor/vanilla-tilt.min.js"),
        fetchText("assets/vendor/atropos.min.js")
      ]);

      return {
        css: [
          openProps ? `\n/* Open Props animations */\n${openProps}` : "",
          atroposCss ? `\n/* Atropos touch parallax */\n${atroposCss}` : ""
        ].filter(Boolean).join("\n"),
        js: [lenis, splitting, vanillaTilt, atropos]
          .filter(Boolean)
          .map((source, index) => `\n/* Vendor motion resource ${index + 1} */\n${source}`)
          .join("\n")
      };
    }

    async function fetchText(url) {
      try {
        const response = await fetch(url);

        if (!response.ok) {
          return "";
        }

        return await response.text();
      } catch (error) {
        return "";
      }
    }

    async function fetchExportCss() {
      const [sourceCss, responsiveCss] = await Promise.all([
        fetchText("src/styles.css"),
        fetchText("src/generated-responsive.css")
      ]);
      const css = sourceCss || getExportCss();

      return `${css}
    ${responsiveCss}
    ${getStandaloneExportCss()}`.trim();
    }

    function getStandaloneExportCss() {
      return `
    html {
      background: #fbf7ef;
    }

    body {
      margin: 0;
      min-height: 100vh;
      min-height: 100dvh;
      overflow-x: hidden;
      background: #fbf7ef;
    }

    body > .generated-site {
      min-height: 100vh;
      min-height: 100dvh;
    }

    body > .generated-site .conversion-dock {
      position: fixed;
    }

    body > .generated-site .chatbot-widget {
      position: fixed;
    }

    .generated-site[data-primary-button-custom="true"] .primary-site-action {
      background: var(--site-primary-button-bg);
      color: var(--site-primary-button-text);
      box-shadow: none;
    }

    .generated-site[data-primary-button-custom="true"][data-primary-button-neon="on"] .primary-site-action {
      box-shadow: 0 0 var(--site-primary-button-glow-size, 28px) color-mix(in srgb, var(--site-primary-button-bg), transparent var(--site-primary-button-glow-fade, 48%));
    }

    .generated-site[data-primary-button-custom="true"] .primary-site-action:hover {
      background: color-mix(in srgb, var(--site-primary-button-bg), #000000 10%);
      color: var(--site-primary-button-text);
    }

    .generated-site .gallery-track {
      animation-duration: 36s;
    }

    @media (max-width: 760px) {
      .generated-site .gallery-item.is-gallery-clone {
        display: none !important;
      }
    }

    html.no-js .generated-site .reveal,
    html.no-js .generated-site .kinetic-title .char {
      opacity: 1 !important;
      transform: none !important;
      animation: none !important;
    }
    `.trim();
    }

    function getExportCss() {
      const liveCss = collectLiveCss();

      if (liveCss) {
        return liveCss;
      }

      const fallbackCss = `
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#fbf7ef;color:#171513;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}.generated-site{--accent:var(--site-accent,#cf3f2e);--accent-2:var(--site-accent-2,#0f8f8f);--ink:var(--site-ink,#171513);--muted:var(--site-muted,#6d675e);--paper:var(--site-paper,#fffaf0);--bg:var(--site-bg,#fbf7ef);--line:color-mix(in srgb,var(--ink),transparent 86%);min-height:100vh;background:var(--bg);color:var(--ink)}.generated-site a{color:inherit}.site-nav{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:68px;padding:0 clamp(18px,4vw,54px);border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--paper),transparent 12%);backdrop-filter:blur(18px)}.site-logo{display:flex;align-items:center;gap:10px;min-width:0;font-weight:900;text-decoration:none}.site-logo-mark{display:grid;place-items:center;width:36px;height:36px;border-radius:8px;background:var(--ink);color:var(--paper);flex:0 0 auto;font-size:.78rem}.site-nav-links{display:flex;align-items:center;gap:18px;color:var(--muted);font-size:.88rem;font-weight:800}.site-nav-links a{text-decoration:none}.site-nav-links a:hover{color:var(--accent)}.site-cta{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;border-radius:8px;background:var(--ink);color:var(--paper);font-weight:900;text-decoration:none;transition:transform .18s ease,background .18s ease}.site-cta:hover{transform:translateY(-2px);background:var(--accent)}.hero-section{position:relative;display:grid;min-height:min(820px,calc(100vh - 68px));overflow:hidden;isolation:isolate}.hero-media{position:absolute;inset:0;z-index:-2}.hero-media img{width:100%;height:100%;object-fit:cover;transform:scale(1.06);filter:saturate(1.05) contrast(1.02)}.hero-section:after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,color-mix(in srgb,var(--ink),transparent 8%),transparent 70%),linear-gradient(0deg,color-mix(in srgb,var(--ink),transparent 24%),transparent 48%)}.hero-content{align-self:end;width:min(980px,100%);padding:clamp(72px,13vw,170px) clamp(18px,5vw,72px) clamp(42px,8vw,92px);color:#fffaf0}.hero-kicker{display:inline-flex;align-items:center;min-height:32px;padding:0 10px;margin-bottom:16px;border:1px solid rgba(255,250,240,.28);border-radius:999px;background:rgba(255,250,240,.12);font-size:.78rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.hero-content h1{max-width:900px;margin:0;font-size:clamp(3rem,9vw,7.8rem);line-height:.9;letter-spacing:0}.hero-content p{max-width:680px;margin:22px 0 0;color:rgba(255,250,240,.84);font-size:clamp(1rem,1.8vw,1.35rem);line-height:1.55}.hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}.ghost-link{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;border:1px solid rgba(255,250,240,.32);border-radius:8px;color:#fffaf0;font-weight:900;text-decoration:none;transition:transform .18s ease,background .18s ease}.ghost-link:hover{transform:translateY(-2px);background:rgba(255,250,240,.12)}.site-section{padding:clamp(56px,9vw,128px) clamp(18px,5vw,72px)}.section-inner{width:min(1160px,100%);margin:0 auto}.section-heading{display:grid;grid-template-columns:minmax(0,.95fr) minmax(280px,.55fr);gap:clamp(24px,5vw,72px);align-items:end;margin-bottom:clamp(28px,5vw,62px)}.section-heading h2{margin:0;font-size:clamp(2.2rem,5.6vw,5.4rem);line-height:.95;letter-spacing:0}.section-heading p{margin:0;color:var(--muted);font-size:1rem;line-height:1.7}.proof-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-block:1px solid var(--line);background:var(--paper)}.proof-item{min-height:150px;padding:clamp(20px,4vw,42px);border-right:1px solid var(--line)}.proof-item:last-child{border-right:0}.proof-number{display:block;margin-bottom:8px;color:var(--accent);font-size:clamp(2rem,5vw,4rem);font-weight:950;line-height:.9}.proof-label{color:var(--muted);font-weight:800}.services-grid,.feature-grid,.testimonial-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.service-card,.feature-card,.testimonial-card,.faq-item,.contact-panel{border:1px solid var(--line);border-radius:8px;background:color-mix(in srgb,var(--paper),transparent 5%)}.service-card,.feature-card,.testimonial-card{min-height:220px;padding:clamp(20px,3vw,30px);transition:transform .24s ease,border-color .24s ease,box-shadow .24s ease}.service-card:hover,.feature-card:hover,.testimonial-card:hover{border-color:color-mix(in srgb,var(--accent),transparent 45%);box-shadow:0 18px 46px color-mix(in srgb,var(--ink),transparent 88%)}.card-index{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;margin-bottom:28px;border-radius:8px;background:color-mix(in srgb,var(--accent),transparent 88%);color:var(--accent);font-weight:950}.service-card h3,.feature-card h3{margin:0 0 12px;font-size:clamp(1.22rem,2vw,1.7rem);line-height:1.05}.service-card p,.feature-card p,.testimonial-card p{margin:0;color:var(--muted);line-height:1.65}.gallery-band{padding:clamp(48px,8vw,92px) 0;overflow:hidden;background:var(--ink);color:var(--paper)}.gallery-track{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(260px,34vw);gap:14px;width:max-content;animation:galleryMove var(--gallery-duration,48s) linear infinite}.gallery-track:hover{animation-play-state:paused}.gallery-item{width:100%;aspect-ratio:4/5;overflow:hidden;border-radius:8px;background:color-mix(in srgb,var(--paper),transparent 88%)}.gallery-item img{width:100%;height:100%;object-fit:cover;transition:transform .6s ease}.gallery-item:hover img{transform:scale(1.08)}@keyframes galleryMove{from{transform:translateX(0)}to{transform:translateX(calc(-50% - 7px))}}.split-section{display:grid;grid-template-columns:minmax(0,.9fr) minmax(320px,.7fr);gap:clamp(24px,5vw,72px);align-items:stretch}.image-panel{min-height:560px;overflow:hidden;border-radius:8px;background:var(--ink)}.image-panel img{width:100%;height:100%;object-fit:cover;transform:scale(1.04)}.feature-stack{display:grid;gap:14px;align-content:center}.feature-card{min-height:154px}.hours-grid{display:grid;gap:10px;color:var(--muted);font-weight:800;line-height:1.5}.testimonial-card{min-height:230px}.quote-mark{display:block;margin-bottom:18px;color:var(--accent);font-size:2.5rem;font-weight:950;line-height:.7}.testimonial-author{display:block;margin-top:22px;color:var(--ink);font-weight:950}.faq-list{display:grid;gap:10px}.faq-item{padding:18px 20px}.faq-item summary{cursor:pointer;color:var(--ink);font-weight:950}.faq-item p{margin:12px 0 0;color:var(--muted);line-height:1.65}.contact-section{background:var(--paper)}.contact-panel{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.6fr);gap:clamp(20px,5vw,72px);padding:clamp(24px,5vw,58px)}.contact-panel h2{margin:0;font-size:clamp(2rem,5vw,4.8rem);line-height:.95}.contact-panel p{color:var(--muted);line-height:1.7}.contact-links,.social-links{display:flex;flex-wrap:wrap;gap:10px}.contact-links a,.social-links a{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 12px;border:1px solid var(--line);border-radius:8px;color:var(--ink);font-weight:900;text-decoration:none;transition:transform .18s ease,border-color .18s ease,color .18s ease}.contact-links a:hover,.social-links a:hover{transform:translateY(-2px);border-color:var(--accent);color:var(--accent)}.site-footer{display:flex;justify-content:space-between;gap:18px;padding:24px clamp(18px,5vw,72px);border-top:1px solid var(--line);color:var(--muted);font-size:.88rem}.reveal{opacity:0;transform:translateY(calc(24px * var(--motion-scale,1)));transition:opacity .7s ease,transform .7s cubic-bezier(.21,.72,.22,1)}.reveal.is-visible{opacity:1;transform:translateY(0)}.tilt-card{transform:perspective(900px) rotateX(calc(var(--tilt-y,0) * -1deg)) rotateY(calc(var(--tilt-x,0) * 1deg)) translateY(var(--lift,0))}.theme-carbon{--site-bg:#11110f;--site-paper:#f7efe1;--site-ink:#f6efe4;--site-muted:#b9b0a4;color-scheme:dark}.theme-carbon .site-nav,.theme-carbon .service-card,.theme-carbon .feature-card,.theme-carbon .testimonial-card,.theme-carbon .faq-item,.theme-carbon .contact-panel{background:rgba(247,239,225,.07)}.theme-carbon .contact-section{background:#181714}.theme-carbon .site-logo-mark,.theme-carbon .site-cta{background:var(--site-accent,#cf3f2e);color:#fffaf0}.theme-editorial{--site-bg:#f7f2e6;--site-paper:#fffdf6;--site-ink:#251f1a;--site-muted:#776b5d;font-family:Georgia,"Times New Roman",serif}.theme-editorial .site-nav,.theme-editorial .site-cta,.theme-editorial .ghost-link,.theme-editorial .contact-links a,.theme-editorial .social-links a{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.theme-editorial .hero-content h1,.theme-editorial .section-heading h2,.theme-editorial .contact-panel h2{font-weight:500}.motion-soft{--motion-scale:.75}.motion-cinematic{--motion-scale:1.15}.motion-bold{--motion-scale:1.55}@media(max-width:760px){.section-heading,.proof-strip,.services-grid,.feature-grid,.testimonial-grid,.split-section,.contact-panel{grid-template-columns:1fr}.site-nav{align-items:flex-start;flex-direction:column;min-height:0;padding-block:14px}.site-nav-links{width:100%;overflow-x:auto;padding-bottom:4px}.hero-section{min-height:720px}.hero-content h1{font-size:clamp(2.8rem,18vw,4.8rem)}.proof-item{border-right:0;border-bottom:1px solid var(--line)}.proof-item:last-child{border-bottom:0}.gallery-track{grid-auto-columns:minmax(240px,72vw)}.image-panel{min-height:390px}.site-footer{flex-direction:column}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}.reveal{opacity:1;transform:none}}
      `.trim();

      return `${fallbackCss}
    .generated-site{font-size:calc(16px * var(--site-font-scale,1))}.generated-site img{display:block;max-width:100%}.section-inner{width:min(var(--site-content-width,1160px),100%)}.hero-content{width:min(var(--site-hero-content-width,980px),100%)}.form-consent{grid-template-columns:auto minmax(0,1fr)!important;align-items:start!important;font-size:.76rem!important;line-height:1.45}.form-consent input{width:18px!important;min-height:18px!important;margin-top:1px;accent-color:var(--accent)}.form-consent a{text-decoration:underline}.gallery-band{--gallery-gap:clamp(10px,1.4vw,16px);--gallery-card-width:clamp(240px,32vw,430px);--gallery-card-ratio:4/5;overflow:hidden}.gallery-track{grid-auto-columns:var(--gallery-card-width);gap:var(--gallery-gap);align-items:stretch;will-change:transform}.gallery-item{min-width:0;aspect-ratio:var(--gallery-card-ratio);margin:0}.gallery-item img,.image-panel img,.product-card img{display:block;object-position:center}.image-panel{min-height:clamp(360px,48vw,560px);aspect-ratio:4/5}.image-ratio-square{--gallery-card-ratio:1/1}.image-ratio-square .image-panel{aspect-ratio:1/1}.image-ratio-wide{--gallery-card-ratio:16/10;--gallery-card-width:clamp(280px,42vw,560px)}.image-ratio-wide .image-panel{aspect-ratio:16/10}@keyframes galleryMove{from{transform:translateX(0)}to{transform:translateX(calc(-50% - (var(--gallery-gap) / 2)))}}@media(max-width:760px){.gallery-track{display:flex;width:100%;max-width:100%;gap:12px;padding:0 clamp(14px,4vw,20px);overflow-x:auto;scroll-padding-inline:clamp(14px,4vw,20px);scroll-snap-type:x mandatory;scrollbar-width:none;animation:none;will-change:auto;-webkit-overflow-scrolling:touch}.gallery-track::-webkit-scrollbar{display:none}.gallery-item{flex:0 0 min(82vw,360px);aspect-ratio:4/3;scroll-snap-align:center}.gallery-item.is-gallery-clone{display:none}.block-gallery-marquee .gallery-track{scroll-snap-type:none}.block-gallery-marquee .gallery-item.is-gallery-clone{display:block}.image-panel{min-height:0;aspect-ratio:4/3}}
    `.trim();
    }

    function collectLiveCss() {
      return Array.from(document.styleSheets)
        .map((sheet) => {
          try {
            return Array.from(sheet.cssRules).map((rule) => rule.cssText).join("\n");
          } catch (error) {
            return "";
          }
        })
        .filter(Boolean)
        .join("\n");
    }

    function getExportScript() {
      return `
    (() => {
      document.documentElement.classList.remove("no-js");
      document.documentElement.classList.add("js");
      const site = document.querySelector(".generated-site");
      const apiBase = resolveApiBase();
      const exportData = readExportData();
      const business = exportData.business || {};
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const compactViewport = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;
      if (typeof window.Splitting === "function") {
        window.Splitting();
      }
      if (typeof window.VanillaTilt === "function" && site?.dataset.premiumEffects === "true" && !compactViewport) {
        window.VanillaTilt.init(document.querySelectorAll(".tilt-card"), {
          max: 9,
          speed: 650,
          glare: true,
          "max-glare": 0.18,
          scale: 1.01,
          gyroscope: false
        });
      }
      if (typeof window.Atropos === "function" && site?.dataset.premiumEffects === "true" && !compactViewport) {
        document.querySelectorAll("[data-atropos-root]").forEach((element) => {
          window.Atropos({
            el: element,
            activeOffset: 18,
            rotateXMax: 5,
            rotateYMax: 7,
            duration: 700,
            shadow: false,
            highlight: false
          });
        });
      }
      if (typeof window.Lenis === "function" && !prefersReducedMotion && !compactViewport) {
        const lenis = new window.Lenis({ lerp: 0.085, smoothWheel: true, anchors: true });
        const raf = (time) => {
          lenis.raf(time);
          requestAnimationFrame(raf);
        };
        requestAnimationFrame(raf);
      }
      const revealItems = document.querySelectorAll(".reveal");
      const premiumEnabled = site?.dataset.premiumEffects === "true";
      if (!("IntersectionObserver" in window)) {
        revealItems.forEach((item) => item.classList.add("is-visible"));
      } else {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) entry.target.classList.add("is-visible");
          });
        }, { threshold: 0.18 });

        revealItems.forEach((item, index) => {
          item.style.transitionDelay = Math.min(index * 45, 260) + "ms";
          observer.observe(item);
        });
      }

      const updateProgress = () => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const progress = max > 0 ? window.scrollY / max : 0;
        site?.style.setProperty("--scroll-progress", progress.toFixed(4));
      };
      const updateParallax = () => {
        const images = document.querySelectorAll(".parallax-media img");
        if (compactViewport || prefersReducedMotion) {
          images.forEach((image) => image.style.setProperty("--parallax-y", "0px"));
          return;
        }
        const viewportCenter = window.innerHeight / 2;
        const range = Math.max(1, window.innerHeight / 2);
        images.forEach((image) => {
          const frame = image.closest(".parallax-media")?.getBoundingClientRect();
          if (!frame || frame.bottom < -window.innerHeight || frame.top > window.innerHeight * 2) return;
          const center = frame.top + frame.height / 2;
          const normalized = Math.max(-1, Math.min(1, (center - viewportCenter) / range));
          image.style.setProperty("--parallax-y", (-normalized * 22).toFixed(2) + "px");
        });
      };
      let scrollFrame = 0;
      const updateScrollEffects = () => {
        if (scrollFrame) return;
        scrollFrame = requestAnimationFrame(() => {
          scrollFrame = 0;
          updateProgress();
          updateParallax();
        });
      };
      updateScrollEffects();
      window.addEventListener("scroll", updateScrollEffects, { passive: true });
      window.addEventListener("resize", updateScrollEffects, { passive: true });

      if (site?.classList.contains("block-gallery-marquee") && !prefersReducedMotion) {
        document.querySelectorAll(".gallery-track").forEach((track) => {
          const items = Array.from(track.querySelectorAll(".gallery-item:not(.is-gallery-clone)"));
          if (items.length < 2) return;

          let activeIndex = 0;
          let resumeAt = 0;
          let interacting = false;
          const resumeSoon = () => {
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
            resumeSoon();
          }, { passive: true });
          track.addEventListener("pointercancel", resumeSoon, { passive: true });
          track.addEventListener("wheel", () => {
            updateActiveIndex();
            resumeSoon();
          }, { passive: true });

          const advanceGallery = () => {
            const styles = window.getComputedStyle(track);
            const usesNativeScroll = styles.animationName === "none"
              && ["auto", "scroll"].includes(styles.overflowX)
              && track.scrollWidth > track.clientWidth;
            const rect = track.getBoundingClientRect();
            const isVisible = rect.bottom > 0 && rect.top < window.innerHeight;

            if (usesNativeScroll && isVisible && !interacting
              && performance.now() >= resumeAt && !document.hidden) {
              activeIndex = (activeIndex + 1) % items.length;
              track.scrollTo({
                left: itemScrollLeft(items[activeIndex]),
                behavior: "smooth"
              });
            }

            window.setTimeout(advanceGallery, 4200);
          };

          window.setTimeout(advanceGallery, 4200);
        });
      }

      window.addEventListener("pointermove", (event) => {
        if (!premiumEnabled) return;
        site?.style.setProperty("--pointer-x", event.clientX + "px");
        site?.style.setProperty("--pointer-y", event.clientY + "px");
        if (typeof window.VanillaTilt === "function") return;
        const card = event.target.closest(".tilt-card");
        document.querySelectorAll(".tilt-card").forEach((item) => {
          if (item !== card) {
            item.style.setProperty("--tilt-x", 0);
            item.style.setProperty("--tilt-y", 0);
            item.style.setProperty("--lift", "0px");
          }
        });
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const localX = (event.clientX - rect.left) / rect.width - 0.5;
        const localY = (event.clientY - rect.top) / rect.height - 0.5;
        card.style.setProperty("--tilt-x", (localX * 7).toFixed(2));
        card.style.setProperty("--tilt-y", (localY * 7).toFixed(2));
        card.style.setProperty("--lift", "-3px");
      });

      document.querySelectorAll("[data-track]").forEach((element) => {
        element.addEventListener("click", () => track(element.dataset.track, {}));
      });

      document.querySelectorAll("[data-lead-form]").forEach((leadForm) => {
        leadForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          const data = new FormData(leadForm);
          const lead = {
            name: String(data.get("leadName") || "Lead sin nombre").trim(),
            contact: String(data.get("leadContact") || "").trim(),
            message: String(data.get("leadMessage") || "").trim(),
            privacyAccepted: data.get("privacyAccepted") === "true",
            privacyAcceptedAt: new Date().toISOString(),
            privacyPolicyUrl: business.privacyUrl || "",
            source: "form",
            timestamp: new Date().toISOString()
          };
          window.localLiftLeads = window.localLiftLeads || [];
          window.localLiftLeads.push(lead);
          track("lead_form_submit", { contact: lead.contact, source: lead.source });
          const status = leadForm.querySelector("[data-lead-status]");
          try {
            await syncLead(leadForm.dataset.leadEndpoint || "", lead);
            if (status) status.textContent = "Solicitud guardada en el CRM.";
          } catch (error) {
            if (status) status.textContent = "Solicitud recibida en esta sesion. El CRM no esta disponible.";
          }
          leadForm.reset();
        });
      });

      document.querySelectorAll("[data-public-booking-form]").forEach((bookingForm) => {
        const startsAt = bookingForm.elements.startsAt;
        if (startsAt && !startsAt.min) startsAt.min = datetimeLocal(new Date(Date.now() + 60 * 60 * 1000));
        bookingForm.addEventListener("submit", async (event) => {
          event.preventDefault();
          const data = new FormData(bookingForm);
          const booking = {
            serviceName: String(data.get("serviceName") || "Reserva").trim(),
            customerName: String(data.get("customerName") || "Cliente sin nombre").trim(),
            contact: String(data.get("contact") || "").trim(),
            startsAt: data.get("startsAt") ? new Date(String(data.get("startsAt"))).toISOString() : "",
            notes: String(data.get("notes") || "").trim(),
            privacyAccepted: data.get("privacyAccepted") === "true",
            privacyAcceptedAt: new Date().toISOString(),
            privacyPolicyUrl: business.privacyUrl || "",
            source: "public-widget",
            timestamp: new Date().toISOString()
          };
          window.localLiftBookings = window.localLiftBookings || [];
          window.localLiftBookings.push(booking);
          track("public_booking_submit", { service: booking.serviceName, contact: booking.contact, source: booking.source });
          const status = bookingForm.querySelector("[data-booking-status]");
          try {
            await syncBooking(bookingForm.dataset.bookingEndpoint || "", booking);
            if (status) status.textContent = "Reserva enviada a la agenda. El negocio confirmara el hueco.";
          } catch (error) {
            if (status) status.textContent = error.status === 409 ? "Ese hueco no esta disponible. Prueba otra hora." : "Reserva guardada en esta sesion. La agenda no esta disponible.";
          }
          bookingForm.reset();
          if (startsAt) startsAt.min = datetimeLocal(new Date(Date.now() + 60 * 60 * 1000));
        });
      });

      document.querySelectorAll("[data-store]").forEach((store) => {
        const context = readStore(store);
        const commerce = normalizeStoreCommerce(context.commerce || {});
        let products = commerce.products || [];
        let shippingMethods = commerce.shippingMethods || [];
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

        const status = (message) => {
          if (statusTarget) statusTarget.textContent = message;
        };
        const cartLines = () => Array.from(cart.entries())
          .map(([id, quantity]) => ({ product: products.find((item) => item.id === id), quantity }))
          .filter((item) => item.product && item.quantity > 0);
        const quotePayload = () => ({
          currency: commerce.currency,
          shippingMethodId: selectedShippingId,
          couponCode: String(couponInput?.value || "").trim(),
          items: cartLines().map(({ product, quantity }) => ({ id: product.id, sku: product.sku, quantity }))
        });

        const bindProducts = () => {
          store.querySelectorAll("[data-add-product]").forEach((button) => {
            button.addEventListener("click", () => {
              const product = products.find((item) => item.id === button.dataset.addProduct);
              if (!product) return;
              cart.set(product.id, (cart.get(product.id) || 0) + 1);
              renderCart();
              refreshQuote();
              status(product.name + " anadido al carrito.");
              track("store_add_to_cart", { product: product.name });
            });
          });
        };

        const renderProducts = () => {
          if (!productsTarget) return;
          productsTarget.innerHTML = products.map((product) => productHtml(product, commerce.currency)).join("");
          productsTarget.querySelectorAll(".reveal").forEach((item) => item.classList.add("is-visible"));
          bindProducts();
        };

        const renderCart = () => {
          const lines = cartLines();
          if (!itemsTarget) return;
          if (!lines.length) {
            itemsTarget.innerHTML = '<p class="store-empty">Anade productos para empezar.</p>';
            renderSummary(localQuote());
            return;
          }
          itemsTarget.innerHTML = lines.map(({ product, quantity }) =>
            '<div class="cart-line"><div><strong>' + esc(product.name) + '</strong><span>' +
            esc(money(product.price, commerce.currency)) + ' x ' + quantity +
            '</span></div><div class="cart-line-actions"><button type="button" data-cart-dec="' + esc(product.id) +
            '">-</button><span>' + quantity + '</span><button type="button" data-cart-inc="' + esc(product.id) +
            '">+</button></div></div>'
          ).join("");
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

        const renderShipping = () => {
          if (!shippingTarget) return;
          shippingTarget.innerHTML = '<legend>Entrega</legend>' + shippingMethods.map((method) =>
            '<label class="store-shipping-option"><input type="radio" name="shippingMethodId" value="' + esc(method.id) + '"' +
            (method.id === selectedShippingId ? ' checked' : '') + '><span><strong>' + esc(method.name) +
            '</strong><small>' + esc(method.description || '') + '</small></span><em>' + esc(money(method.price, commerce.currency)) + '</em></label>'
          ).join("");
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
          if (totalTarget) totalTarget.textContent = money(totals.total || 0, quote.currency || commerce.currency);
          if (mobileCartTotal) mobileCartTotal.textContent = money(totals.total || 0, quote.currency || commerce.currency);
          if (mobileCartBar) mobileCartBar.hidden = !hasItems;
          siteRoot?.classList.toggle("has-mobile-cart", hasItems);
          if (!summaryTarget) return;
          summaryTarget.innerHTML = [
            ["Subtotal", totals.subtotal || 0],
            ["Descuento", totals.discount ? -Math.abs(totals.discount) : 0],
            ["Envio", totals.shipping || 0],
            [quote.taxIncluded ? "Impuestos incluidos" : "Impuestos", totals.tax || 0],
            ["Total", totals.total || 0, true]
          ].map(([label, value, strong]) =>
            '<div class="' + (strong ? 'is-total' : '') + '"><span>' + esc(label) + '</span><strong>' + esc(money(value, quote.currency || commerce.currency)) + '</strong></div>'
          ).join("");
        };

        const localQuote = () => {
          const lines = cartLines();
          const subtotal = round(lines.reduce((sum, item) => sum + item.product.price * item.quantity, 0));
          const shipping = shippingMethods.find((method) => method.id === selectedShippingId)?.price || 0;
          const taxableBase = Math.max(0, subtotal + shipping);
          const tax = commerce.taxIncluded ? round(taxableBase - taxableBase / (1 + commerce.taxRatePercent / 100)) : round(taxableBase * (commerce.taxRatePercent / 100));
          const total = commerce.taxIncluded ? round(taxableBase) : round(taxableBase + tax);
          return { currency: commerce.currency, taxIncluded: commerce.taxIncluded, totals: { subtotal, discount: 0, shipping, tax, taxRatePercent: commerce.taxRatePercent, total } };
        };

        const refreshQuote = async () => {
          const seq = ++quoteSeq;
          if (!cartLines().length) {
            renderSummary(localQuote());
            return;
          }
          renderSummary(localQuote());
          const validateEndpoint = deriveEndpoint(commerce.checkoutEndpoint || commerce.productsEndpoint, "/api/store/cart/validate");
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
            status(quote.coupon ? "Cupon " + quote.coupon.code + " aplicado." : "");
          } catch (error) {
            if (seq === quoteSeq && couponInput?.value.trim()) status(error.message || "No se pudo aplicar el cupon.");
          }
        };

        if (commerce.productsEndpoint) {
          fetch(commerce.productsEndpoint)
            .then((response) => response.ok ? response.json() : null)
            .then((data) => {
              const remoteProducts = normalizeStoreProducts(data?.products || data || []);
              if (!remoteProducts.length) return;
              products = remoteProducts;
              renderProducts();
              renderCart();
              refreshQuote();
              status("Catalogo sincronizado con la base de datos.");
            })
            .catch(() => {});
        }

        const configEndpoint = deriveEndpoint(commerce.productsEndpoint || commerce.checkoutEndpoint, "/api/store/config");
        if (configEndpoint) {
          fetch(configEndpoint)
            .then((response) => response.ok ? response.json() : null)
            .then((data) => {
              const settings = data?.settings || {};
              if (settings.currency) commerce.currency = currency(settings.currency);
              commerce.taxRatePercent = Number(settings.taxRatePercent || commerce.taxRatePercent || 0);
              commerce.taxIncluded = settings.taxIncluded !== false;
              if (Array.isArray(settings.shippingMethods) && settings.shippingMethods.length) {
                shippingMethods = normalizeStoreShipping(settings.shippingMethods);
                selectedShippingId = shippingMethods.find((method) => method.default)?.id || shippingMethods[0]?.id || selectedShippingId;
                renderShipping();
                refreshQuote();
              }
            })
            .catch(() => {});
        }

        couponInput?.addEventListener("input", () => {
          window.clearTimeout(couponInput.dataset.timer);
          couponInput.dataset.timer = window.setTimeout(refreshQuote, 350);
        });

        checkoutForm?.addEventListener("submit", async (event) => {
          event.preventDefault();
          const lines = cartLines();
          if (!lines.length) {
            status("Anade al menos un producto antes de pagar.");
            return;
          }
          if (!commerce.checkoutEndpoint) {
            status("Falta configurar el endpoint de checkout Stripe.");
            return;
          }
          const data = new FormData(checkoutForm);
          const fallbackUrl = window.location.origin === "null" ? window.location.href.split("#")[0] : window.location.origin + window.location.pathname;
          const payload = {
            businessName: context.business?.name || "",
            orderEmail: commerce.orderEmail || context.business?.email || "",
            currency: commerce.currency,
            successUrl: commerce.successUrl || fallbackUrl + "?pedido=ok",
            cancelUrl: commerce.cancelUrl || fallbackUrl + "#tienda",
            shippingMethodId: selectedShippingId,
            couponCode: String(data.get("couponCode") || "").trim(),
            customer: {
              name: String(data.get("customerName") || "").trim(),
              email: String(data.get("customerEmail") || "").trim(),
              phone: String(data.get("customerPhone") || "").trim(),
              address: String(data.get("customerAddress") || "").trim()
            },
            items: lines.map(({ product, quantity }) => ({ id: product.id, sku: product.sku, quantity }))
          };
          status("Creando pago seguro...");
          track("store_checkout_start", { items: lines.length });
          try {
            const response = await fetch(commerce.checkoutEndpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !(result.url || result.checkoutUrl)) throw new Error(result.error || "Checkout failed");
            window.location.href = result.url || result.checkoutUrl;
          } catch (error) {
            status("No se pudo iniciar el pago. Revisa la API de tienda y las claves de Stripe.");
          }
        });

        bindProducts();
        renderShipping();
        renderCart();
        refreshQuote();
        showPaymentNotice(paymentNotice);
      });

      document.querySelectorAll(".chatbot-widget").forEach((widget) => {
        const context = readContext(widget);
        const messages = widget.querySelector("[data-chatbot-messages]");
        const form = widget.querySelector("[data-chatbot-form]");
        const input = form?.elements.message;
        const history = [];

        widget.querySelector(".chatbot-launcher")?.addEventListener("click", () => {
          widget.classList.add("is-open");
          widget.querySelector(".chatbot-launcher")?.setAttribute("aria-expanded", "true");
          track("chatbot_open", { business: context.business?.name || "" });
          input?.focus();
        });

        widget.querySelector(".chatbot-close")?.addEventListener("click", () => {
          widget.classList.remove("is-open");
          widget.querySelector(".chatbot-launcher")?.setAttribute("aria-expanded", "false");
        });

        widget.querySelectorAll("[data-chatbot-prompt]").forEach((button) => {
          button.addEventListener("click", () => {
            track("chatbot_prompt", { prompt: button.dataset.chatbotPrompt || "" });
            submit(button.dataset.chatbotPrompt || "");
          });
        });

        form?.addEventListener("submit", (event) => {
          event.preventDefault();
          track("chatbot_message", { business: context.business?.name || "" });
          submit(input?.value || "");
        });

        async function submit(raw) {
          const message = raw.trim();
          if (!message) return;
          addMessage(messages, message, "user");
          history.push({ role: "user", content: message });
          if (input) input.value = "";
          const loading = addMessage(messages, "Pensando...", "bot is-loading");

          try {
            const reply = context.chatbot.endpoint
              ? await askEndpoint(message, context, history)
              : localReply(message, context, history);
            loading.remove();
            addMessage(messages, reply, "bot");
            history.push({ role: "assistant", content: reply });
          } catch (error) {
            loading.remove();
            const reply = localReply(message, context, history);
            addMessage(messages, reply, "bot");
            history.push({ role: "assistant", content: reply });
          }
        }
      });

      function addMessage(messages, text, type) {
        const message = document.createElement("div");
        message.className = "chat-message is-" + type;
        message.textContent = text;
        messages.appendChild(message);
        messages.scrollTop = messages.scrollHeight;
        return message;
      }

      async function askEndpoint(message, context, history) {
        const response = await fetch(context.chatbot.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
        if (!response.ok) throw new Error("Chatbot endpoint failed");
        const data = await response.json();
        return String(data.reply || data.message || "Ahora mismo no tengo una respuesta clara.");
      }

      function localReply(message, context, history) {
        const text = normalize(message);
        const business = context.business || {};
        const lead = extractLead(message, context, history || []);
        if (lead) {
          return "Perfecto, he dejado una solicitud preparada para " + business.name + ".\\n\\nResumen:\\n- Nombre: " + lead.name + "\\n- Contacto: " + lead.contact + "\\n- Necesidad: " + lead.message + "\\n\\n" + nextStep(context);
        }
        const faq = (context.faqs || []).find((item) => sharedToken(text, item.question));
        if (faq) return faq.answer + "\\n\\n" + softLeadPrompt(context) + "\\n\\n" + contactLine(context);
        if (any(text, ["horario", "hora", "abierto", "abrir", "cerrado", "cuando"])) {
          return (context.hours || []).length
            ? "El horario de " + business.name + " es:\\n" + context.hours.map((line) => "- " + line).join("\\n") + "\\n\\n" + softLeadPrompt(context) + "\\n\\n" + contactLine(context)
            : "Todavia no hay horario detallado publicado. " + contactLine(context);
        }
        if (any(text, ["reserv", "cita", "mesa", "turno", "agenda", "booking"])) {
          if (/(\\+?\\d[\\d\\s().-]{7,})/.test(text)) {
            const quickLead = storeLead({ business: business.name || "", name: "Lead desde chatbot", contact: contactFrom(message), message, source: "chatbot", leadEndpoint: context.chatbot?.leadEndpoint || "" });
            return "Perfecto. Hemos recibido los datos de reserva.\\n\\nResumen recibido: " + quickLead.message + "\\n\\n" + nextStep(context) + "\\n\\n" + contactLine(context);
          }
          return business.bookingUrl && business.bookingUrl !== "#contacto"
            ? "Puedes reservar desde aqui: " + business.bookingUrl + "\\n\\nSi prefieres, dime nombre, dia, hora y telefono para que podamos responderte con disponibilidad."
            : "Para reservar, dime nombre, dia/hora y telefono. Tambien puedes contactar directamente:\\n" + contactLine(context);
        }
        if (any(text, ["donde", "direccion", "ubicacion", "mapa", "llegar", "localizacion"])) {
          return (business.address || business.location || "La direccion aun no esta publicada.") + (context.google?.directionsNote ? "\\n" + context.google.directionsNote : "") + (business.mapsLink ? "\\nMapa: " + business.mapsLink : "") + "\\n\\n" + contactLine(context);
        }
        if (context.commerce?.enabled && any(text, ["tienda", "comprar", "compra", "carrito", "producto", "pago", "precio"])) {
          const products = context.commerce.products || [];
          return products.length
            ? "Puedes comprar desde la seccion Tienda. Productos destacados:\\n" + products.slice(0, 5).map((item) => "- " + item.name + ": " + money(item.price, context.commerce.currency)).join("\\n") + "\\n\\nEl pago se abre en Stripe Checkout cuando confirmas el carrito."
            : "La tienda esta activa, pero todavia no hay productos publicados.";
        }
        if (any(text, ["servicio", "menu", "carta", "tratamiento", "producto", "precio", "ofrece"])) {
          return (context.services || []).length
            ? "Estos son algunos servicios destacados:\\n" + context.services.map((item) => "- " + String(item).split(":")[0]).join("\\n") + "\\n\\n" + softLeadPrompt(context) + "\\n\\n" + contactLine(context)
            : "Todavia no hay servicios detallados publicados. " + contactLine(context);
        }
        if (any(text, ["telefono", "llamar", "email", "correo", "contacto", "whatsapp"])) return contactLine(context);
        if (any(text, ["instagram", "redes", "tiktok", "facebook", "fotos", "galeria"])) {
          return (context.links || []).length
            ? "Puedes ver mas aqui:\\n" + context.links.map((link) => "- " + link.label + ": " + link.url).join("\\n")
            : "Ahora mismo no hay redes enlazadas, pero puedes usar el contacto principal.";
        }
        if (any(text, ["resena", "resenas", "reseña", "reseñas", "opinion", "opiniones", "rating", "valoracion"])) {
          const google = context.google || {};
          const rating = google.rating ? "Rating Google: " + google.rating + "/5 con " + (google.reviewCount || 0) + " resenas." : "Todavia no hay rating conectado en esta demo.";
          const reviewUrl = google.reviewUrl ? "\\nDejar resena: " + google.reviewUrl : "";
          return (rating + reviewUrl + "\\n\\n" + softLeadPrompt(context) + "\\n\\n" + contactLine(context)).trim();
        }
        return "Soy el asistente de " + business.name + ". Puedo ayudarte con horarios, reservas, ubicacion, servicios y contacto.\\n\\n" + softLeadPrompt(context) + "\\n\\n" + contactLine(context);
      }

      function softLeadPrompt(context) {
        const business = context.business || {};
        return "Si quieres que " + business.name + " te responda con contexto, escribe: \\"Me llamo [nombre], mi contacto es [telefono/email] y necesito [detalle]\\".";
      }

      function nextStep(context) {
        const business = context.business || {};
        return business.bookingUrl && business.bookingUrl !== "#contacto"
          ? "Siguiente paso recomendado: usar " + business.bookingUrl + " o esperar respuesta del negocio."
          : "Siguiente paso recomendado: el negocio puede contactar con esta persona desde el lead guardado.";
      }

      function extractLead(message, context, history) {
        const contact = contactFrom(message);
        const name = nameFrom(message);
        if (!contact || !name || String(message).length < 18) return null;
        return storeLead({
          business: context.business?.name || "",
          name,
          contact,
          message,
          source: "chatbot",
          leadEndpoint: context.chatbot?.leadEndpoint || "",
          previousIntent: (history || []).slice(-3).map((item) => item.content).join(" | ")
        });
      }

      function storeLead(lead) {
        const stored = { ...lead, timestamp: new Date().toISOString() };
        window.localLiftLeads = window.localLiftLeads || [];
        window.localLiftLeads.push(stored);
        syncLead(lead.leadEndpoint || "", stored).catch(() => {});
        track("chatbot_lead_captured", { business: stored.business || "", contact: stored.contact || "", source: stored.source || "chatbot" });
        return stored;
      }

      function contactFrom(message) {
        const email = String(message).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/i)?.[0];
        const phone = String(message).match(/(\\+?\\d[\\d\\s().-]{7,})/)?.[0];
        return email || phone || "";
      }

      function nameFrom(message) {
        const explicit = String(message).match(/(?:me llamo|soy|nombre es)\\s+([a-zA-ZÀ-ÿ\\s]{2,40})/i)?.[1];
        return explicit ? explicit.trim().replace(/\\s+(mi|y|con|para).*$/i, "") : "Lead desde chatbot";
      }

      function contactLine(context) {
        const business = context.business || {};
        const parts = [];
        if (business.phone) parts.push("Telefono: " + business.phone);
        if (business.email) parts.push("Email: " + business.email);
        if (business.bookingUrl && business.bookingUrl !== "#contacto") parts.push((context.chatbot.handoffLabel || "Hablar con el negocio") + ": " + business.bookingUrl);
        return parts.length ? parts.join("\\n") : "Puedes usar los enlaces de contacto de esta web.";
      }

      function readStore(store) {
        try { return JSON.parse(store.dataset.storeContext || "{}"); }
        catch (error) { return {}; }
      }

      function showPaymentNotice(target) {
        if (!target) return;
        const params = new URLSearchParams(window.location.search);
        if (params.get("pedido") === "ok" || params.get("payment") === "success") {
          target.hidden = false;
          target.textContent = "Pago recibido. El negocio recibira el pedido y el comprador recibira confirmacion por email.";
        }
      }

      function normalizeStoreCommerce(commerce) {
        commerce = commerce || {};
        return {
          currency: currency(commerce.currency),
          taxRatePercent: Number(commerce.taxRatePercent || 0),
          taxIncluded: commerce.taxIncluded !== false,
          checkoutEndpoint: String(commerce.checkoutEndpoint || "").trim(),
          productsEndpoint: String(commerce.productsEndpoint || "").trim(),
          successUrl: String(commerce.successUrl || "").trim(),
          cancelUrl: String(commerce.cancelUrl || "").trim(),
          orderEmail: String(commerce.orderEmail || "").trim(),
          shippingMethods: normalizeStoreShipping(commerce.shippingMethods || []),
          products: normalizeStoreProducts(commerce.products || [])
        };
      }

      function normalizeStoreShipping(methods) {
        const source = Array.isArray(methods) && methods.length ? methods : [{ id: "pickup", name: "Recogida en tienda", description: "", price: 0, active: true, default: true }];
        const result = source.map((method, index) => ({
          id: slug(method.id || method.name || "shipping-" + (index + 1)),
          name: String(method.name || "Entrega").trim(),
          description: String(method.description || "").trim(),
          price: Number(method.price || 0),
          active: method.active !== false,
          default: Boolean(method.default)
        })).filter((method) => method.active);
        if (!result.some((method) => method.default) && result[0]) result[0].default = true;
        return result;
      }

      function normalizeStoreProducts(products) {
        return Array.isArray(products)
          ? products.map((product, index) => {
            const name = String(product.name || "").trim();
            const id = slug(product.id || product.sku || name || "producto-" + (index + 1));
            const sku = slug(product.sku || id);
            const price = Number(product.price || 0);
            return {
              id,
              sku,
              name,
              price: Number.isFinite(price) ? Math.max(0, Math.round(price * 100) / 100) : 0,
              image: String(product.image || "").trim(),
              description: String(product.description || "Producto disponible para compra online.").trim()
            };
          }).filter((product) => product.name && product.price > 0)
          : [];
      }

      function productHtml(product, currencyCode) {
        return '<article class="product-card reveal tilt-card" data-product-id="' + esc(product.id) + '">' +
          '<figure><img src="' + esc(product.image) + '" alt="' + esc(product.name) + '" loading="lazy" decoding="async" sizes="(max-width: 760px) calc(100vw - 28px), 33vw"></figure>' +
          '<div class="product-card-body"><div><p class="product-sku">' + esc(product.sku) + '</p>' +
          '<h3>' + esc(product.name) + '</h3><p>' + esc(product.description) + '</p></div>' +
          '<div class="product-card-bottom"><strong>' + esc(money(product.price, currencyCode)) + '</strong>' +
          '<button type="button" data-add-product="' + esc(product.id) + '">Anadir</button></div></div></article>';
      }

      function money(value, currencyCode) {
        try {
          return new Intl.NumberFormat("es-ES", { style: "currency", currency: currency(currencyCode) }).format(Number(value || 0));
        } catch (error) {
          return String(Number(value || 0).toFixed(2)) + " " + currency(currencyCode);
        }
      }

      function currency(value) {
        const code = String(value || "EUR").trim().toUpperCase().replace(/[^A-Z]/g, "");
        return code.length === 3 ? code : "EUR";
      }

      function slug(value) {
        return String(value || "producto").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64);
      }

      function round(value) {
        return Math.round(Number(value || 0) * 100) / 100;
      }

      function deriveEndpoint(endpoint, pathname) {
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

      function esc(value) {
        return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      }

      function readContext(widget) {
        try { return JSON.parse(widget.dataset.chatbotContext || "{}"); }
        catch (error) { return {}; }
      }
      function readExportData() {
        try { return JSON.parse(document.getElementById("locallift-export-data")?.textContent || "{}"); }
        catch (error) { return {}; }
      }
      function normalize(value) {
        return String(value || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase();
      }
      function any(text, terms) {
        return terms.some((term) => text.includes(term));
      }
      function sharedToken(message, candidate) {
        return normalize(candidate).split(/[^a-z0-9]+/).filter((token) => token.length > 3).some((token) => message.includes(token));
      }
      async function syncLead(endpoint, lead) {
        if (!endpoint) return null;
        const response = await fetch(apiUrl(endpoint), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lead })
        });
        if (!response.ok) throw new Error("Lead CRM request failed");
        return response.json();
      }
      async function syncBooking(endpoint, booking) {
        if (!endpoint) return null;
        const response = await fetch(apiUrl(endpoint), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
      function datetimeLocal(date) {
        const pad = (value) => String(value).padStart(2, "0");
        return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-") + "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
      }
      function track(name, detail) {
        window.localLiftEvents = window.localLiftEvents || [];
        const event = { name, detail: { business: business.name || "", category: business.category || "", ...detail }, timestamp: new Date().toISOString() };
        window.localLiftEvents.push(event);
        window.dataLayer?.push({ event: "locallift_" + name, ...event.detail });
        syncEvent(publicEventEndpoint(), event).catch(() => {});
      }
      function publicEventEndpoint() {
        const identifier = business.slug || business.id || "";
        return identifier ? apiUrl("/api/public/" + encodeURIComponent(identifier) + "/events") : "";
      }
      async function syncEvent(endpoint, event) {
        if (!endpoint) return null;
        const response = await fetch(apiUrl(endpoint), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: { ...event, page: location.pathname, referrer: document.referrer, userAgent: navigator.userAgent } })
        });
        if (!response.ok) throw new Error("Event API request failed");
        return response.json();
      }
      function apiUrl(path) {
        if (!path || /^[a-z][a-z0-9+.-]*:\\/\\//i.test(String(path))) return path;
        return apiBase ? apiBase + (path.startsWith("/") ? path : "/" + path) : path;
      }
      function resolveApiBase() {
        const query = new URLSearchParams(window.location.search);
        const fromQuery = query.get("apiBase");
        if (fromQuery !== null) {
          const clean = cleanApiBase(fromQuery);
          if (clean) localStorage.setItem("locallift_api_base", clean);
          else localStorage.removeItem("locallift_api_base");
          return clean;
        }
        return cleanApiBase(window.LOCALLIFT_API_BASE)
          || cleanApiBase(document.querySelector('meta[name="locallift-api-base"]')?.content)
          || cleanApiBase(localStorage.getItem("locallift_api_base"));
      }
      function cleanApiBase(value) {
        const base = String(value || "").trim();
        if (!base || ["same-origin", "local", "none"].includes(base.toLowerCase())) return "";
        return base.replace(/\\/+$/, "");
      }
    })();
      `.trim();
    }

  }
})(globalThis);
