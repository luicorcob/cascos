import assert from "node:assert/strict";

await import("../../src/studio/core-utils.js");
await import("../../src/studio/button-style-editor.js");
await import("../../src/studio/renderer.js");
await import("../../src/studio/exporter.js");

const core = globalThis.LocalLiftStudio.core;
const { createRenderer } = globalThis.LocalLiftStudio.renderer;
const { createExporter } = globalThis.LocalLiftStudio.exporter;
const { readButtonStyles } = globalThis.LocalLiftStudio.buttonStyles;

assert.deepEqual(readButtonStyles(JSON.stringify({
  primary: { background: "#2255AA", textColor: "#FFFFFF", neon: false, glowStrength: 130 }
})), {
  primary: { background: "#2255aa", textColor: "#ffffff", neon: false, glowStrength: 100 }
});

const demoBusiness = {
  name: "Luma Studio",
  category: "Belleza",
  location: "Sevilla",
  tagline: "Belleza <sin filtros>",
  description: "Un estudio local.",
  conversionGoal: "Conseguir reservas",
  announcement: "Agenda abierta",
  phone: "+34 600 000 000",
  email: "hola@example.com",
  address: "Calle Demo 1",
  services: ["Corte: Personalizado", "Color: A medida", "Peinado: Para eventos"],
  features: ["Atencion: Cercana"],
  hours: ["Lunes a viernes: 10:00-20:00"],
  testimonials: [{ name: "Ana", text: "Muy bien" }],
  faqs: [{ question: "Como reservo?", answer: "Desde la web." }],
  trustBadges: ["Profesionales"],
  links: [{ label: "Instagram", url: "https://example.com" }],
  gallery: ["https://example.com/1.jpg"],
  heroImage: "https://example.com/hero.jpg",
  mediaMetadata: {
    "https://example.com/hero.jpg": {
      alt: "Interior accesible de Luma Studio",
      position: "center top"
    }
  },
  bookingUrl: "#reservas",
  bookingLabel: "Reservar",
  privacyUrl: "/privacidad",
  servicesHeading: "Servicios",
  servicesIntro: "Seleccion cuidada",
  trustHeading: "Confianza",
  trustIntro: "Opiniones reales",
  contactHeading: "Hablemos",
  leadFormTitle: "Pide informacion",
  leadFormIntro: "Te respondemos pronto",
  leadFormCta: "Enviar",
  showLeadForm: true,
  showBooking: true,
  showAnnouncement: true,
  showResourceMarquee: true,
  showTrustRail: true,
  showGallery: true,
  showTestimonials: true,
  showFaq: true,
  showMap: true,
  showConversionDock: true,
  showMenu: false,
  menuItems: [],
  menuTitle: "Carta",
  menuIntro: "",
  menuCurrency: "EUR",
  artDirection: "editorial",
  contentMode: "balanced",
  theme: "aurora",
  motion: "soft",
  typography: "modern",
  contentDensity: "balanced",
  visualShape: "clean",
  imageRatio: "portrait",
  contentWidth: "standard",
  heroSize: "balanced",
  fontScale: 100,
  layoutScale: 100,
  accent: "#cf3f2e",
  intensity: 75,
  premiumEffects: false,
  blockVariants: {
    hero: "split",
    services: "list",
    gallery: "grid",
    testimonials: "quotes",
    contact: "banner"
  },
  chatbot: {
    enabled: true,
    name: "LumaBot",
    tone: "cercano",
    greeting: "Hola",
    quickPrompts: ["Quiero reservar"],
    handoffLabel: "Hablar",
    endpoint: ""
  },
  google: {
    enabled: true,
    mapsUrl: "https://maps.example.com",
    mapEmbedUrl: "https://maps.example.com/embed",
    rating: 4.8,
    reviewCount: 25
  },
  commerce: {
    enabled: false,
    currency: "EUR",
    products: [],
    shippingMethods: []
  }
};

const renderer = createRenderer({
  core,
  demoBusiness,
  themePalette: {
    aurora: {
      accent2: "#0f8f8f",
      bg: "#ffffff",
      paper: "#ffffff",
      ink: "#111111",
      muted: "#666666"
    }
  },
  getContrastTokens: () => ({
    solid: "#111111",
    onSolid: "#ffffff",
    onAccent: "#ffffff",
    accentReadable: "#cf3f2e",
    accentOnSolid: "#cf3f2e"
  }),
  densityLayoutMap: {
    balanced: {
      section: [50, 8, 100],
      gallery: [40, 6, 80],
      card: 220,
      feature: 160,
      testimonial: 220
    }
  },
  contentWidthMap: { standard: 1160 },
  heroSizeMap: { balanced: "760px" },
  artDirectionOptions: ["editorial"],
  withBusinessDefaults: (business) => ({ ...demoBusiness, ...business }),
  normalizeCommerce: (commerce) => ({ ...demoBusiness.commerce, ...commerce }),
  normalizeProducts: (products) => products || [],
  getPublicLeadEndpoint: () => "/api/public/luma/leads",
  getPublicBookingEndpoint: () => "/api/public/luma/bookings",
  getCurrentBusinessRecord: () => ({ id: "biz_luma", slug: "luma" })
});

const html = renderer.renderSite(demoBusiness);
assert.match(html, /class="generated-site/);
assert.match(html, /Belleza &lt;sin filtros&gt;/);
assert.match(html, /data-lead-endpoint="\/api\/public\/luma\/leads"/);
assert.match(html, /data-booking-endpoint="\/api\/public\/luma\/bookings"/);
assert.match(html, /politica de privacidad/);
assert.match(html, /block-hero-split/);
assert.match(html, /block-services-list/);
assert.match(html, /block-gallery-grid/);
assert.match(html, /data-edit-field="tagline"/);
assert.match(html, /data-edit-list="services" data-edit-index="0" data-edit-part="title"/);
assert.match(html, /data-edit-image-field="heroImage"/);
assert.match(html, /alt="Interior accesible de Luma Studio"/);
assert.match(html, /object-position:center top/);
assert.match(html, /data-edit-link-field="booking"/);
assert.match(html, /data-edit-button-style="primary"/);
assert.match(html, /data-edit-link-list="links" data-edit-index="0"/);
assert.match(html, /data-section-key="services"/);

for (const heroVariant of ["cinematic", "split", "collage", "oval", "minimal"]) {
  const variantHtml = renderer.renderSite({
    ...demoBusiness,
    blockVariants: { ...demoBusiness.blockVariants, hero: heroVariant }
  });
  assert.match(variantHtml, new RegExp(`block-hero-${heroVariant}`), `Hero layout ${heroVariant} must be rendered explicitly`);
}

const collageHtml = renderer.renderSite({
  ...demoBusiness,
  blockVariants: { ...demoBusiness.blockVariants, hero: "collage" }
});
assert.match(collageHtml, /aria-label="Galeria destacada de portada"/);
assert.match(collageHtml, /data-edit-image-field="heroImage"/);
assert.match(collageHtml, /data-edit-image-list="gallery" data-edit-index="0"/);
assert.doesNotMatch(collageHtml, /class="hero-art-monogram"/, "The floating collage omits oversized initials");
assert.match(collageHtml, /class="site-logo-mark">LS<\/span>/, "The small navigation logo remains visible");

const clinicCollageHtml = renderer.renderSite({
  ...demoBusiness,
  name: "Clínica Alba",
  blockVariants: { ...demoBusiness.blockVariants, hero: "collage" }
});
assert.doesNotMatch(clinicCollageHtml, /class="hero-art-monogram"/, "The floating collage omits oversized initials for every business");
assert.match(clinicCollageHtml, /class="site-logo-mark">CA<\/span>/, "The small navigation logo remains visible");

const customButtonHtml = renderer.renderSite({
  ...demoBusiness,
  buttonStyles: {
    primary: {
      background: "#2255aa",
      textColor: "#ffffff",
      neon: false,
      glowStrength: 75
    }
  }
});
assert.match(customButtonHtml, /data-primary-button-custom="true"/);
assert.match(customButtonHtml, /data-primary-button-neon="off"/);
assert.match(customButtonHtml, /--site-primary-button-bg:#2255aa/);
assert.match(customButtonHtml, /--site-primary-button-text:#ffffff/);
assert.match(customButtonHtml, /class="site-cta magnetic primary-site-action"/);

const styledHtml = renderer.renderSite({
  ...demoBusiness,
  textStyles: {
    "field:tagline": {
      color: "#ff3366",
      opacity: 0.75,
      size: 1.2,
      weight: "900",
      italic: true,
      letterSpacing: 0.04
    },
    "list:services:0:title": {
      color: "#123456",
      size: 1.1
    }
  }
});
assert.match(styledHtml, /data-text-style-key="field:tagline" style="[^"]*color:#ff3366[^"]*opacity:0.75[^"]*font-size:calc\(var\(--text-base-size, 1em\) \* 1.2\)[^"]*font-weight:900[^"]*font-style:italic[^"]*letter-spacing:0.04em/);
assert.match(styledHtml, /data-text-style-key="list:services:0:title" style="[^"]*color:#123456[^"]*font-size:calc\(var\(--text-base-size, 1em\) \* 1.1\)/);

const visualHtml = renderer.renderSite({
  ...demoBusiness,
  contentMode: "visual",
  description: "Uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince.",
  servicesIntro: "Uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece.",
  trustIntro: "Uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece.",
  services: [
    "Servicio uno: Texto descriptivo",
    "Servicio dos: Texto descriptivo",
    "Servicio tres: Texto descriptivo",
    "Servicio cuatro: Texto descriptivo",
    "Servicio cinco: Texto descriptivo"
  ],
  features: [
    "Diferencial uno: Texto descriptivo",
    "Diferencial dos: Texto descriptivo",
    "Diferencial tres: Texto descriptivo"
  ],
  faqs: [
    { question: "Pregunta uno?", answer: "Respuesta" },
    { question: "Pregunta dos?", answer: "Respuesta" },
    { question: "Pregunta tres?", answer: "Respuesta" }
  ]
});
assert.equal((visualHtml.match(/class="service-card/g) || []).length, 3);
assert.doesNotMatch(visualHtml, /data-edit-list="services" data-edit-index="3"/);
assert.doesNotMatch(visualHtml, /data-edit-list="features" data-edit-index="2"/);
assert.doesNotMatch(visualHtml, /data-edit-list="faqs" data-edit-index="2"/);
assert.match(visualHtml, /Uno dos tres cuatro cinco seis siete ocho nueve diez once doce\.\.\./);
assert.match(visualHtml, /25 resenas/);
assert.doesNotMatch(visualHtml, /rating Google con 25 resenas conectables/);

const reorderedHtml = renderer.renderSite({
  ...demoBusiness,
  sectionOrder: ["faq", "services", "gallery", "features", "testimonials", "map", "booking", "lead"]
});
assert.ok(
  reorderedHtml.indexOf("faq-section") < reorderedHtml.indexOf('id="servicios"'),
  "Configured section order must be reflected in generated HTML"
);

const duplicatedSectionHtml = renderer.renderSite({
  ...demoBusiness,
  sectionOrder: ["services", "services__copy1", "gallery", "features", "testimonials", "faq", "map", "booking", "lead"]
});
assert.equal((duplicatedSectionHtml.match(/data-section-key="services"/g) || []).length, 1);
assert.equal((duplicatedSectionHtml.match(/data-section-key="services__copy1"/g) || []).length, 1);
assert.match(duplicatedSectionHtml, /id="servicios-services__copy1"/);

const exporter = createExporter({
  dataVersion: 6,
  getCurrentBusinessRecord: () => ({ id: "biz_luma", slug: "luma" }),
  demoBusiness,
  renderSite: renderer.renderSite,
  withBusinessDefaults: (business) => ({ ...demoBusiness, ...business }),
  normalizeCommerce: (commerce) => ({ ...demoBusiness.commerce, ...commerce }),
  buildMapEmbedUrl: renderer.buildMapEmbedUrl,
  slugify: core.slugify,
  splitTitleBody: core.splitTitleBody,
  escapeHtml: core.escapeHtml,
  escapeAttr: core.escapeAttr
});
const schema = exporter.buildLocalBusinessSchema(demoBusiness);
assert.equal(schema["@type"], "LocalBusiness");
assert.equal(schema.name, "Luma Studio");
assert.equal(schema.makesOffer.length, 3);

console.log("Studio renderer and exporter contract tests passed.");
