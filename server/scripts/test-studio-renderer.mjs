import assert from "node:assert/strict";

await import("../../src/studio/core-utils.js");
await import("../../src/studio/renderer.js");
await import("../../src/studio/exporter.js");

const core = globalThis.LocalLiftStudio.core;
const { createRenderer } = globalThis.LocalLiftStudio.renderer;
const { createExporter } = globalThis.LocalLiftStudio.exporter;

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
assert.match(html, /data-edit-link-list="links" data-edit-index="0"/);
assert.match(html, /data-section-key="services"/);

const reorderedHtml = renderer.renderSite({
  ...demoBusiness,
  sectionOrder: ["faq", "services", "gallery", "features", "testimonials", "map", "booking", "lead"]
});
assert.ok(
  reorderedHtml.indexOf("faq-section") < reorderedHtml.indexOf('id="servicios"'),
  "Configured section order must be reflected in generated HTML"
);

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
