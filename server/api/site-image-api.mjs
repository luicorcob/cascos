import { corsHeaders } from "../lib/cors.mjs";

const MAX_BODY_BYTES = Number(process.env.SITE_IMAGE_API_MAX_BODY_BYTES || 256 * 1024);
const DEFAULT_TIMEOUT_MS = Number(process.env.SITE_IMAGE_API_TIMEOUT_MS || 8000);
const CACHE_TTL_MS = Number(process.env.SITE_IMAGE_API_CACHE_TTL_MS || 30 * 60 * 1000);
const searchCache = new Map();

const SECTION_ALIASES = {
  hero: "hero",
  portada: "hero",
  servicios: "servicios",
  services: "servicios",
  servicio: "servicios",
  galeria: "galeria",
  gallery: "galeria",
  fotos: "galeria",
  equipo: "equipo",
  team: "equipo",
  staff: "equipo",
  testimonios: "testimonios",
  testimonials: "testimonios",
  resenas: "testimonios",
  reviews: "testimonios",
  contacto: "contacto",
  contact: "contacto",
  mapa: "contacto",
  map: "contacto",
  about: "about",
  nosotros: "about",
  acerca: "about",
  blog: "blog",
  articulos: "blog",
  articles: "blog"
};

const BUSINESS_VOCABULARY = [
  {
    id: "restaurant",
    categoria: "hosteleria",
    aliases: ["restaurante", "restaurant", "gastronomia", "cocina", "brasas", "tapas", "bar"],
    hero: "restaurant interior elegant dining table spain",
    service: "restaurant service dining food detail",
    gallery: "restaurant interior food table warm lighting",
    about: "restaurant team kitchen professional warm lighting",
    contact: "spanish city street restaurant exterior warm sunny",
    defaultServices: ["Menu de temporada", "Reservas para grupos", "Carta de bebidas"],
    serviceHints: [
      { terms: ["menu", "degustacion", "carta"], query: "restaurant tasting menu seasonal food plating" },
      { terms: ["parrilla", "brasa", "carne", "pescado"], query: "grill restaurant chef cooking fire fresh food" },
      { terms: ["vino", "bebida", "bar"], query: "restaurant wine table elegant dining" },
      { terms: ["reserva", "grupo", "evento"], query: "restaurant private dining table group reservation" },
      { terms: ["take away", "delivery", "recoger"], query: "restaurant takeaway food packaging premium" }
    ]
  },
  {
    id: "cafe",
    categoria: "hosteleria",
    aliases: ["cafeteria", "cafe", "coffee", "barista"],
    hero: "cozy cafe interior coffee shop spain",
    service: "coffee shop barista service detail",
    gallery: "coffee shop interior counter warm lighting",
    about: "barista coffee shop working counter",
    contact: "spanish city street cafe terrace warm sunny",
    defaultServices: ["Cafe de especialidad", "Desayunos y meriendas", "Producto para llevar"],
    serviceHints: [
      { terms: ["cafe", "espresso", "barista"], query: "barista preparing coffee espresso cafe" },
      { terms: ["desayuno", "merienda", "pastel"], query: "cafe breakfast pastry coffee table" },
      { terms: ["llevar", "take away"], query: "coffee takeaway cup cafe counter" }
    ]
  },
  {
    id: "bakery",
    categoria: "hosteleria",
    aliases: ["panaderia", "bakery", "pasteleria", "reposteria"],
    hero: "artisan bakery bread fresh pastry display",
    service: "artisan bakery bread pastry detail",
    gallery: "bakery interior fresh bread pastry display",
    about: "artisan baker working bakery kitchen",
    contact: "spanish bakery storefront street warm sunny",
    defaultServices: ["Pan artesanal", "Bolleria diaria", "Encargos y celebraciones"],
    serviceHints: [
      { terms: ["pan", "hogaza"], query: "artisan bread bakery fresh loaves" },
      { terms: ["pastel", "bolleria", "dulce"], query: "fresh pastry bakery display" },
      { terms: ["encargo", "tarta", "celebracion"], query: "bakery cake preparation professional" }
    ]
  },
  {
    id: "hair_salon",
    categoria: "belleza",
    aliases: ["peluqueria", "hair salon", "salon de belleza", "estilista"],
    hero: "hair salon interior elegant mirror styling chair",
    service: "hair salon professional stylist service",
    gallery: "beauty salon interior mirror styling chair",
    about: "hair salon stylist working professional",
    contact: "spanish city street beauty salon exterior warm sunny",
    defaultServices: ["Corte y peinado", "Coloracion profesional", "Tratamientos capilares"],
    serviceHints: [
      { terms: ["corte", "peinado", "estilo"], query: "haircut professional stylist salon" },
      { terms: ["color", "coloracion", "mechas", "tinte", "balayage"], query: "hair coloring salon professional stylist" },
      { terms: ["tratamiento", "capilar", "keratina"], query: "hair treatment salon professional care" },
      { terms: ["novia", "evento"], query: "bridal hair styling salon elegant" }
    ]
  },
  {
    id: "barbershop",
    categoria: "belleza",
    aliases: ["barberia", "barbershop", "barbero"],
    hero: "barbershop classic masculine interior chairs",
    service: "barbershop barber tools professional",
    gallery: "barbershop interior barber chair tools",
    about: "barber working barbershop professional",
    contact: "spanish city street barbershop exterior warm sunny",
    defaultServices: ["Corte masculino", "Arreglo de barba", "Afeitado clasico"],
    serviceHints: [
      { terms: ["corte"], query: "barber haircut professional barbershop" },
      { terms: ["barba"], query: "beard trim barber professional tools" },
      { terms: ["afeitado"], query: "classic shave barbershop razor towel" }
    ]
  },
  {
    id: "beauty_center",
    categoria: "belleza",
    aliases: ["centro estetica", "estetica", "beauty salon", "spa", "cosmetica"],
    hero: "beauty salon treatment room relaxing spa",
    service: "beauty treatment room professional spa",
    gallery: "beauty salon treatment room clean relaxing",
    about: "beauty therapist treatment room professional",
    contact: "spanish city street beauty clinic exterior warm sunny",
    defaultServices: ["Tratamientos faciales", "Depilacion y cuidado corporal", "Masajes relajantes"],
    serviceHints: [
      { terms: ["facial", "piel"], query: "beauty facial treatment room skincare" },
      { terms: ["corporal", "depilacion"], query: "beauty salon body treatment professional" },
      { terms: ["masaje", "relajante"], query: "spa massage treatment room relaxing" },
      { terms: ["manicura", "unas"], query: "nail salon manicure professional clean" }
    ]
  },
  {
    id: "dental",
    categoria: "salud",
    aliases: ["clinica dental", "dentista", "dental"],
    hero: "modern dental clinic clean professional",
    service: "dental clinic professional treatment clean",
    gallery: "modern dental clinic treatment room clean",
    about: "dental clinic team professional treatment room",
    contact: "spanish city street dental clinic exterior warm sunny",
    defaultServices: ["Revision dental", "Limpieza e higiene", "Ortodoncia y estetica dental"],
    serviceHints: [
      { terms: ["revision", "diagnostico"], query: "dental checkup clinic professional" },
      { terms: ["limpieza", "higiene"], query: "dental cleaning clinic professional" },
      { terms: ["ortodoncia", "brackets"], query: "orthodontics dental clinic clean" },
      { terms: ["implante"], query: "dental implant clinic professional clean" }
    ]
  },
  {
    id: "physiotherapy",
    categoria: "salud",
    aliases: ["fisioterapia", "fisio", "physiotherapy", "rehabilitacion"],
    hero: "physiotherapy clinic treatment room professional",
    service: "physiotherapy treatment professional clinic",
    gallery: "physiotherapy clinic treatment room modern",
    about: "physiotherapist working treatment room professional",
    contact: "spanish city street physiotherapy clinic exterior warm sunny",
    defaultServices: ["Fisioterapia manual", "Readaptacion y ejercicio", "Tratamiento de lesiones"],
    serviceHints: [
      { terms: ["manual", "masaje"], query: "physiotherapy manual therapy professional" },
      { terms: ["ejercicio", "readaptacion"], query: "physiotherapy rehabilitation exercise clinic" },
      { terms: ["lesion", "dolor"], query: "physical therapy injury treatment professional" }
    ]
  },
  {
    id: "pharmacy",
    categoria: "salud",
    aliases: ["farmacia", "pharmacy", "parafarmacia"],
    hero: "pharmacy interior clean modern shelves",
    service: "pharmacy service counter clean modern",
    gallery: "pharmacy shelves clean modern interior",
    about: "pharmacist working pharmacy counter professional",
    contact: "spanish city street pharmacy exterior warm sunny",
    defaultServices: ["Consejo farmaceutico", "Parafarmacia y cuidado", "Control y seguimiento"],
    serviceHints: [
      { terms: ["consejo", "consulta"], query: "pharmacy consultation counter professional" },
      { terms: ["parafarmacia", "cosmetica"], query: "pharmacy skincare products shelves" },
      { terms: ["control", "seguimiento"], query: "pharmacy health check service professional" }
    ]
  },
  {
    id: "retail",
    categoria: "comercio",
    aliases: ["tienda", "comercio", "retail", "boutique", "bazar", "zapateria"],
    hero: "retail store interior local shop modern display",
    service: "retail store product display professional",
    gallery: "local shop interior product display modern",
    about: "shop owner arranging products boutique",
    contact: "spanish city street retail storefront warm sunny",
    defaultServices: ["Venta en tienda", "Asesoramiento personalizado", "Consulta de stock"],
    serviceHints: [
      { terms: ["stock", "consulta"], query: "retail store product shelves inventory" },
      { terms: ["asesoramiento", "personalizado"], query: "boutique retail consultation customer service" },
      { terms: ["regalo", "detalle"], query: "retail gift product display boutique" },
      { terms: ["oferta", "temporada"], query: "retail seasonal products display" }
    ]
  },
  {
    id: "florist",
    categoria: "comercio",
    aliases: ["floristeria", "florist", "flores"],
    hero: "flower shop colorful floral arrangement boutique",
    service: "florist floral arrangement professional",
    gallery: "flower shop interior bouquet colorful display",
    about: "florist making bouquet flower shop",
    contact: "spanish city street flower shop exterior warm sunny",
    defaultServices: ["Ramos personalizados", "Eventos y celebraciones", "Plantas y decoracion"],
    serviceHints: [
      { terms: ["ramo", "flores"], query: "florist bouquet arrangement colorful flowers" },
      { terms: ["evento", "boda"], query: "wedding floral arrangement florist" },
      { terms: ["planta", "decoracion"], query: "plant store florist interior green" }
    ]
  },
  {
    id: "fashion",
    categoria: "comercio",
    aliases: ["moda", "ropa", "fashion", "clothing"],
    hero: "clothing boutique fashion interior modern",
    service: "clothing boutique fashion display service",
    gallery: "fashion boutique clothes rack modern interior",
    about: "fashion boutique owner arranging clothes",
    contact: "spanish city street clothing boutique exterior warm sunny",
    defaultServices: ["Moda de temporada", "Asesoramiento de estilo", "Complementos y regalos"],
    serviceHints: [
      { terms: ["temporada", "ropa"], query: "clothing boutique seasonal fashion rack" },
      { terms: ["estilo", "asesoramiento"], query: "fashion boutique styling consultation" },
      { terms: ["complemento", "regalo"], query: "fashion accessories boutique display" }
    ]
  },
  {
    id: "bookstore",
    categoria: "comercio",
    aliases: ["libreria", "bookstore", "libros", "papeleria", "copisteria"],
    hero: "bookstore cozy shelves interior warm lighting",
    service: "bookstore stationery service product display",
    gallery: "bookstore stationery shelves warm interior",
    about: "bookstore owner arranging books shelves",
    contact: "spanish city street bookstore exterior warm sunny",
    defaultServices: ["Libros y recomendaciones", "Papeleria y material", "Encargos por WhatsApp"],
    serviceHints: [
      { terms: ["libro", "lectura"], query: "bookstore shelves cozy books" },
      { terms: ["papeleria", "material"], query: "stationery store notebooks pens display" },
      { terms: ["impresion", "copias", "encuadernacion"], query: "copy shop print service paper binding" },
      { terms: ["encargo", "whatsapp"], query: "local store pickup order counter" }
    ]
  },
  {
    id: "professional",
    categoria: "servicios profesionales",
    aliases: ["abogado", "abogados", "gestoria", "asesoria", "arquitectura", "marketing", "consultoria"],
    hero: "professional office clean modern consultation desk",
    service: "professional consultation office desk",
    gallery: "professional office meeting desk modern clean",
    about: "professional team working office consultation",
    contact: "spanish city street professional office exterior warm sunny",
    defaultServices: ["Consultoria inicial", "Gestion de tramites", "Seguimiento personalizado"],
    serviceHints: [
      { terms: ["legal", "abogado", "contrato"], query: "law office professional desk formal interior" },
      { terms: ["tramite", "fiscal", "laboral"], query: "professional office documents consultation desk" },
      { terms: ["arquitectura", "plano", "proyecto"], query: "architecture studio model blueprint modern" },
      { terms: ["marketing", "marca", "web"], query: "creative agency office open space modern" }
    ]
  },
  {
    id: "construction",
    categoria: "construccion",
    aliases: ["constructora", "reforma", "reformas", "fontaneria", "electricidad", "pintura", "obra"],
    hero: "construction renovation interior professional tools clean work",
    service: "renovation professional tools clean work",
    gallery: "home renovation professional work interior tools",
    about: "construction professional team renovation work",
    contact: "spanish city street modern building exterior warm sunny",
    defaultServices: ["Reformas integrales", "Instalaciones y reparaciones", "Presupuesto y seguimiento"],
    serviceHints: [
      { terms: ["reforma", "obra"], query: "home renovation interior professional work" },
      { terms: ["fontaneria", "tuberia"], query: "plumbing professional tools pipes clean work" },
      { terms: ["electricidad", "electrico"], query: "electrician professional tools panel work" },
      { terms: ["pintura", "pared"], query: "painting renovation interior wall professional" }
    ]
  },
  {
    id: "education",
    categoria: "educacion",
    aliases: ["academia", "formacion", "escuela", "idiomas", "autoescuela", "curso"],
    hero: "language school classroom modern students",
    service: "education classroom professional learning",
    gallery: "modern classroom training room bright",
    about: "teacher classroom professional training",
    contact: "spanish city street school academy exterior warm sunny",
    defaultServices: ["Clases presenciales", "Preparacion de examenes", "Seguimiento personalizado"],
    serviceHints: [
      { terms: ["idioma", "ingles", "frances"], query: "language school classroom modern learning" },
      { terms: ["examen", "preparacion"], query: "study classroom exam preparation" },
      { terms: ["autoescuela", "conducir"], query: "driving school car road lesson professional" }
    ]
  },
  {
    id: "fitness",
    categoria: "educacion",
    aliases: ["gimnasio", "fitness", "gym", "yoga", "pilates", "deporte"],
    hero: "gym fitness center equipment modern clean",
    service: "fitness training studio equipment professional",
    gallery: "fitness studio gym equipment modern clean",
    about: "fitness trainer coaching gym professional",
    contact: "spanish city street fitness studio exterior warm sunny",
    defaultServices: ["Entrenamiento personal", "Clases dirigidas", "Plan de seguimiento"],
    serviceHints: [
      { terms: ["personal", "entrenamiento"], query: "personal trainer gym coaching professional" },
      { terms: ["clase", "grupo"], query: "fitness class studio training group" },
      { terms: ["yoga", "pilates"], query: "yoga studio calm minimal natural light" }
    ]
  },
  {
    id: "lodging",
    categoria: "alojamiento",
    aliases: ["hotel", "alojamiento", "apartamento", "apartamentos", "casa rural", "hostal"],
    hero: "hotel lobby elegant interior spain",
    service: "hotel room hospitality service interior",
    gallery: "hotel room lobby interior spain clean",
    about: "hotel reception hospitality professional",
    contact: "spanish city street hotel exterior warm sunny",
    defaultServices: ["Habitaciones y estancias", "Reservas directas", "Experiencias locales"],
    serviceHints: [
      { terms: ["habitacion", "estancia"], query: "hotel room interior clean spain" },
      { terms: ["reserva"], query: "hotel reception booking hospitality" },
      { terms: ["rural", "campo"], query: "rural house countryside spain cozy interior" }
    ]
  },
  {
    id: "generic",
    categoria: "negocio local",
    aliases: [],
    hero: "local business interior spain warm professional",
    service: "local business professional service detail",
    gallery: "local business interior product service warm",
    about: "local business owner working professional",
    contact: "spanish city street local business warm sunny",
    defaultServices: ["Servicio principal", "Atencion personalizada", "Contacto y reservas"],
    serviceHints: []
  }
];

const STYLE_HINTS = [
  { terms: ["elegante", "elegant", "premium", "lujoso", "luxe"], words: "elegant refined premium" },
  { terms: ["femenino", "soft"], words: "soft warm bright" },
  { terms: ["moderno", "modern", "actual"], words: "modern clean bright" },
  { terms: ["artesanal", "artisan", "hecho a mano"], words: "artisan warm authentic" },
  { terms: ["familiar", "cercano", "local"], words: "warm local welcoming" },
  { terms: ["profesional", "professional", "clinico"], words: "professional clean trustworthy" },
  { terms: ["minimal", "minimalista"], words: "minimal bright clean" }
];

const GLOBAL_SERVICE_HINTS = [
  { terms: ["reserva", "booking", "cita"], query: "booking consultation professional local business" },
  { terms: ["whatsapp", "contacto"], query: "local business customer service counter" },
  { terms: ["tienda", "venta", "producto"], query: "local shop product display professional" },
  { terms: ["asesoramiento", "consulta"], query: "professional consultation customer service" }
];

const BLOCKED_IMAGE_TERMS = [
  "watermark", "logo", "text overlay", "banner", "poster", "billboard", "menu board",
  "american flag", "police", "military", "weapon", "gun", "war", "accident",
  "nude", "erotic", "blood", "gore", "funeral", "cemetery"
];

const CITY_ALIASES = {
  sevilla: "seville spain",
  malaga: "malaga spain",
  cadiz: "cadiz spain",
  cordoba: "cordoba spain",
  zaragoza: "zaragoza spain",
  murcia: "murcia spain",
  alicante: "alicante spain",
  santander: "santander spain",
  madrid: "madrid spain",
  barcelona: "barcelona spain",
  valencia: "valencia spain",
  bilbao: "bilbao spain",
  granada: "granada spain"
};

export function isSiteImageApiRequest(pathname) {
  return pathname === "/api/site-images";
}

export async function handleSiteImageApi(request, response, context) {
  const method = request.method || "POST";

  if (method === "OPTIONS") {
    response.writeHead(204, {
      ...context.baseHeaders,
      ...corsHeaders(context),
      Allow: "POST, OPTIONS"
    });
    response.end();
    return;
  }

  if (method !== "POST") {
    sendJson(response, 405, { error: "Method not allowed" }, context, { Allow: "POST, OPTIONS" });
    return;
  }

  try {
    const payload = await readJsonBody(request);
    const result = await createSiteImageSelection(payload, {
      fetcher: globalThis.fetch?.bind(globalThis),
      env: process.env
    });
    sendJson(response, 200, result, context);
  } catch (error) {
    const status = error.statusCode || 500;
    const message = status >= 500 ? "Internal site image API error" : error.message;
    sendJson(response, status, { error: message }, context);
  }
}

export async function createSiteImageSelection(payload, options = {}) {
  const source = extractBusinessPayload(payload);
  const business = normalizeBusinessInput(source);
  const vocabulary = inferVocabulary(business.category, business.description);
  const sections = normalizeSections(business.sections, business);
  const warnings = [];
  const selectedImages = [];
  const providerState = {
    fetcher: options.fetcher || globalThis.fetch?.bind(globalThis),
    env: options.env || process.env,
    timeoutMs: Math.max(1500, Number(options.timeoutMs || DEFAULT_TIMEOUT_MS)),
    cache: options.cache || searchCache,
    warnings,
    usedUrls: new Set()
  };

  if (!providerState.fetcher) {
    warnings.push("La seleccion de imagenes necesita fetch disponible en el servidor.");
  }

  const availableProviders = getAvailableProviders(providerState.env);
  if (!availableProviders.length) {
    warnings.push("Configura UNSPLASH_ACCESS_KEY, PEXELS_API_KEY o PIXABAY_API_KEY para devolver URLs reales.");
  }

  const imagenes = {};

  if (sections.includes("hero")) {
    imagenes.hero = await buildHeroImages(business, vocabulary, providerState, selectedImages);
  }

  if (sections.includes("servicios")) {
    imagenes.servicios = await buildServiceImages(business, vocabulary, providerState, selectedImages);
  }

  if (sections.includes("galeria")) {
    imagenes.galeria = await buildGalleryImages(business, vocabulary, providerState, selectedImages);
  }

  if (sections.includes("equipo")) {
    imagenes.equipo = await buildTeamImages(business, vocabulary, providerState, selectedImages);
  }

  if (sections.includes("testimonios")) {
    imagenes.testimonios = await buildTestimonialImages(business, providerState, selectedImages);
  }

  if (sections.includes("about")) {
    imagenes.about = await buildAboutImages(business, vocabulary, providerState, selectedImages);
  }

  if (sections.includes("blog")) {
    imagenes.blog = await buildBlogImages(business, vocabulary, providerState, selectedImages);
  }

  if (sections.includes("contacto")) {
    imagenes.contacto = await buildContactImage(business, vocabulary, providerState, selectedImages);
  }

  const fuentesUsadas = [...new Set(selectedImages.map((image) => image.fuente).filter(Boolean))];

  return {
    negocio: business.name,
    fuente_principal: getMainSource(selectedImages),
    imagenes,
    meta: {
      total_imagenes: selectedImages.length,
      fuentes_usadas: fuentesUsadas,
      advertencias: [...new Set(warnings)]
    }
  };
}

async function buildHeroImages(business, vocabulary, providerState, selectedImages) {
  const query = buildQuery([
    vocabulary.hero,
    getAtmosphereWords(business.style),
    locationSearchHint(business.location)
  ]);
  const picks = await findImages({
    section: "hero",
    queries: [query, buildQuery([vocabulary.gallery, getAtmosphereWords(business.style), "spain"])],
    orientation: "landscape",
    count: 3,
    minWidth: 1200,
    width: 1920,
    thumbWidth: 400,
    focal: "center center",
    business,
    providerState,
    selectedImages,
    altFactory: () => `Imagen principal de ${business.category} para ${business.name}`
  });

  return {
    principal: picks[0] || null,
    alternativas: picks.slice(1, 3).map(compactAlternative)
  };
}

async function buildServiceImages(business, vocabulary, providerState, selectedImages) {
  const services = normalizeServiceList(business.services, vocabulary.defaultServices).slice(0, 9);
  const minimum = Math.max(3, Math.min(services.length, 9));
  const outputServices = services.length >= minimum
    ? services
    : normalizeServiceList([...services, ...vocabulary.defaultServices], vocabulary.defaultServices).slice(0, minimum);

  const serviceImages = [];

  for (const [index, service] of outputServices.slice(0, Math.max(3, outputServices.length)).entries()) {
    const query = buildServiceQuery(service.label, vocabulary, business);
    const picks = await findImages({
      section: "servicios",
      queries: [query],
      orientation: business.imageRatio === "square" ? "square" : "landscape",
      count: 1,
      minWidth: 800,
      width: 900,
      thumbWidth: 360,
      focal: "center center",
      business,
      providerState,
      selectedImages,
      altFactory: () => `${service.label} en ${business.category} profesional`
    });

    const image = {
      id: service.id || slugify(service.label || `servicio-${index + 1}`),
      label: service.label,
      ...(picks[0] || nullImageFields(query, "center center"))
    };
    serviceImages.push(image);
  }

  return serviceImages;
}

async function buildGalleryImages(business, vocabulary, providerState, selectedImages) {
  const target = clampInteger(business.galleryTarget || business.gallery?.length || 6, 6, 9, 6);
  const queries = [
    buildQuery([vocabulary.gallery, getAtmosphereWords(business.style), locationSearchHint(business.location)]),
    buildQuery([vocabulary.service, "details authentic", getAtmosphereWords(business.style)]),
    buildQuery([vocabulary.hero, "interior details"])
  ];
  return findImages({
    section: "galeria",
    queries,
    orientation: "square",
    count: target,
    minWidth: 800,
    width: 900,
    thumbWidth: 360,
    focal: "center center",
    business,
    providerState,
    selectedImages,
    altFactory: (_item, index) => `Foto ${index + 1} de ambiente y trabajo de ${business.name}`
  });
}

async function buildTeamImages(business, vocabulary, providerState, selectedImages) {
  const team = normalizePeopleList(business.team, ["Equipo profesional"]);
  providerState.warnings.push("Revisa manualmente las fotos de equipo si el negocio no ha aportado imagenes propias.");

  const teamImages = [];

  for (const [index, person] of team.slice(0, 6).entries()) {
    const query = buildQuery([
      vocabulary.about,
      "professional team working natural light side view",
      getAtmosphereWords(business.style)
    ]);
    const picks = await findImages({
      section: "equipo",
      queries: [query],
      orientation: "portrait",
      count: 1,
      minWidth: 800,
      width: 900,
      thumbWidth: 360,
      focal: "center top",
      business,
      providerState,
      selectedImages,
      altFactory: () => `${person.label} trabajando en ${business.category}`
    });

    const image = {
      id: person.id || slugify(person.label || `equipo-${index + 1}`),
      label: person.label,
      ...(picks[0] || nullImageFields(query, "center top"))
    };
    teamImages.push(image);
  }

  return teamImages;
}

async function buildTestimonialImages(business, providerState, selectedImages) {
  const testimonials = normalizePeopleList(business.testimonials, ["Cliente"]);
  providerState.warnings.push("Los avatares de testimonios deben revisarse para evitar rostros demasiado identificables.");

  const testimonialImages = [];

  for (const [index, testimonial] of testimonials.slice(0, 6).entries()) {
    const query = "neutral professional portrait natural light plain background";
    const picks = await findImages({
      section: "testimonios",
      queries: [query],
      orientation: "square",
      count: 1,
      minWidth: 800,
      width: 520,
      thumbWidth: 240,
      focal: "center top",
      business,
      providerState,
      selectedImages,
      altFactory: () => `Avatar generico para testimonio de ${testimonial.label}`
    });

    const image = {
      id: testimonial.id || slugify(testimonial.label || `testimonio-${index + 1}`),
      label: testimonial.label,
      ...(picks[0] || nullImageFields(query, "center top"))
    };
    testimonialImages.push(image);
  }

  return testimonialImages;
}

async function buildAboutImages(business, vocabulary, providerState, selectedImages) {
  const query = buildQuery([
    vocabulary.about,
    getAtmosphereWords(business.style),
    locationSearchHint(business.location)
  ]);
  return findImages({
    section: "about",
    queries: [query],
    orientation: "landscape",
    count: 2,
    minWidth: 1000,
    width: 1200,
    thumbWidth: 400,
    focal: "center center",
    business,
    providerState,
    selectedImages,
    altFactory: (_item, index) => `Imagen ${index + 1} sobre ${business.name} y su equipo`
  });
}

async function buildBlogImages(business, vocabulary, providerState, selectedImages) {
  const articles = normalizeArticleList(business.blogArticles);

  const blogImages = [];

  for (const [index, article] of articles.slice(0, 6).entries()) {
    const query = buildQuery([
      englishTopicHint(article.label),
      vocabulary.service,
      getAtmosphereWords(business.style)
    ]);
    const picks = await findImages({
      section: "blog",
      queries: [query],
      orientation: "landscape",
      count: 1,
      minWidth: 800,
      width: 900,
      thumbWidth: 360,
      focal: "center center",
      business,
      providerState,
      selectedImages,
      altFactory: () => `Imagen para articulo sobre ${article.label}`
    });

    const image = {
      id: article.id || slugify(article.label || `articulo-${index + 1}`),
      label: article.label,
      ...(picks[0] || nullImageFields(query, "center center"))
    };
    blogImages.push(image);
  }

  return blogImages;
}

async function buildContactImage(business, vocabulary, providerState, selectedImages) {
  const query = buildQuery([
    locationSearchHint(business.location),
    vocabulary.contact,
    "street architecture warm sunny"
  ]);
  const picks = await findImages({
    section: "contacto",
    queries: [query],
    orientation: "landscape",
    count: 1,
    minWidth: 1000,
    width: 1200,
    thumbWidth: 400,
    focal: "center bottom",
    business,
    providerState,
    selectedImages,
    altFactory: () => `Entorno local de ${business.location || business.name} para contactar con ${business.name}`
  });

  return picks[0] || null;
}

async function findImages(config) {
  const results = [];

  for (const query of config.queries) {
    if (results.length >= config.count) {
      break;
    }

    const desired = Math.max(5, config.count + 2);
    const candidates = await searchProviders(query, config.orientation, desired, config.providerState);
    const picked = selectCandidates(candidates, {
      ...config,
      query,
      remaining: config.count - results.length
    });

    results.push(...picked);
  }

  if (results.length < config.count) {
    config.providerState.warnings.push(`No se encontraron suficientes imagenes para ${config.section}.`);
  }

  return results;
}

function selectCandidates(candidates, config) {
  const scored = candidates
    .filter((item) => item.width >= config.minWidth || item.provider === "unsplash")
    .filter((item) => !config.providerState.usedUrls.has(urlIdentity(item.urlOriginal || item.url)))
    .filter((item) => isSafeImageItem(item, config.business))
    .map((item, index) => ({
      item,
      score: scoreImage(item, config) - index * 0.05
    }))
    .sort((left, right) => right.score - left.score);
  const picked = [];

  for (const entry of scored) {
    if (picked.length >= config.remaining) {
      break;
    }

    const image = formatSelectedImage(entry.item, {
      section: config.section,
      query: config.query,
      width: config.width,
      thumbWidth: config.thumbWidth,
      focal: config.focal,
      alt: config.altFactory(entry.item, picked.length)
    });
    config.providerState.usedUrls.add(urlIdentity(entry.item.urlOriginal || entry.item.url));
    config.selectedImages.push(image);
    picked.push(image);
  }

  return picked;
}

async function searchProviders(query, orientation, perPage, providerState) {
  if (!providerState.fetcher) {
    return [];
  }

  const providers = getAvailableProviders(providerState.env);
  if (!providers.length) {
    return [];
  }

  for (const provider of providers) {
    const cacheKey = `${provider.id}:${query}:${orientation}:${perPage}`.toLowerCase();
    const cached = providerState.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.items;
    }

    try {
      const items = await searchProvider(provider, query, orientation, perPage, providerState);
      const safeItems = items.filter((item) => item.url && item.urlThumb && isSafeImageItem(item, {}));
      providerState.cache.set(cacheKey, { items: safeItems, expiresAt: Date.now() + CACHE_TTL_MS });
      pruneCache(providerState.cache);

      if (safeItems.length) {
        return safeItems;
      }
    } catch (error) {
      providerState.warnings.push(`${provider.label} no respondio para "${query}".`);
    }
  }

  providerState.warnings.push(`Sin resultados validos para "${query}".`);
  return [];
}

async function searchProvider(provider, query, orientation, perPage, providerState) {
  if (provider.id === "unsplash") {
    return searchUnsplash(provider, query, orientation, perPage, providerState);
  }

  if (provider.id === "pexels") {
    return searchPexels(provider, query, orientation, perPage, providerState);
  }

  return searchPixabay(provider, query, orientation, perPage, providerState);
}

async function searchUnsplash(provider, query, orientation, perPage, providerState) {
  const endpoint = new URL("https://api.unsplash.com/search/photos");
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("orientation", mapUnsplashOrientation(orientation));
  endpoint.searchParams.set("per_page", String(Math.max(5, Math.min(30, perPage))));
  endpoint.searchParams.set("content_filter", "high");

  const payload = await fetchJson(providerState.fetcher, endpoint, {
    headers: {
      Accept: "application/json",
      Authorization: `Client-ID ${provider.key}`
    },
    timeoutMs: providerState.timeoutMs
  });
  const results = Array.isArray(payload.results) ? payload.results : [];

  return results.map((photo) => {
    const raw = firstHttp(photo.urls?.raw, photo.urls?.full, photo.urls?.regular);
    const regular = firstHttp(photo.urls?.regular, photo.urls?.full, raw);
    const thumb = firstHttp(photo.urls?.small, photo.urls?.thumb, regular);
    const creator = cleanText(photo.user?.name, 100);
    return {
      provider: "unsplash",
      providerLabel: "Unsplash",
      id: cleanText(photo.id, 120),
      title: cleanText(photo.alt_description || photo.description || query, 180),
      creator,
      sourceUrl: firstHttp(photo.links?.html, "https://unsplash.com"),
      url: regular,
      urlOriginal: regular,
      urlRaw: raw,
      urlThumb: thumb,
      width: Number(photo.width || 0),
      height: Number(photo.height || 0),
      credit: creator ? `Foto de ${creator} en Unsplash` : "Foto en Unsplash"
    };
  });
}

async function searchPexels(provider, query, orientation, perPage, providerState) {
  const endpoint = new URL("https://api.pexels.com/v1/search");
  endpoint.searchParams.set("query", query);
  endpoint.searchParams.set("orientation", orientation);
  endpoint.searchParams.set("per_page", String(Math.max(5, Math.min(30, perPage))));

  const payload = await fetchJson(providerState.fetcher, endpoint, {
    headers: {
      Accept: "application/json",
      Authorization: provider.key
    },
    timeoutMs: providerState.timeoutMs
  });
  const photos = Array.isArray(payload.photos) ? payload.photos : [];

  return photos.map((photo) => {
    const original = firstHttp(photo.src?.original, photo.src?.large2x, photo.src?.large, photo.url);
    const large = firstHttp(photo.src?.large2x, photo.src?.large, original);
    const thumb = firstHttp(photo.src?.medium, photo.src?.small, large);
    const creator = cleanText(photo.photographer, 100);
    return {
      provider: "pexels",
      providerLabel: "Pexels",
      id: cleanText(photo.id, 120),
      title: cleanText(photo.alt || query, 180),
      creator,
      sourceUrl: firstHttp(photo.url, photo.photographer_url, "https://www.pexels.com"),
      url: large,
      urlOriginal: original,
      urlRaw: original,
      urlThumb: thumb,
      width: Number(photo.width || 0),
      height: Number(photo.height || 0),
      credit: creator ? `Foto de ${creator} en Pexels` : "Foto en Pexels"
    };
  });
}

async function searchPixabay(provider, query, orientation, perPage, providerState) {
  const endpoint = new URL("https://pixabay.com/api/");
  endpoint.searchParams.set("key", provider.key);
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("image_type", "photo");
  endpoint.searchParams.set("orientation", mapPixabayOrientation(orientation));
  endpoint.searchParams.set("per_page", String(Math.max(5, Math.min(30, perPage))));
  endpoint.searchParams.set("safesearch", "true");

  const payload = await fetchJson(providerState.fetcher, endpoint, {
    headers: { Accept: "application/json" },
    timeoutMs: providerState.timeoutMs
  });
  const hits = Array.isArray(payload.hits) ? payload.hits : [];

  return hits.map((hit) => {
    const original = firstHttp(hit.largeImageURL, hit.webformatURL);
    const thumb = firstHttp(hit.previewURL, hit.webformatURL, original);
    const creator = cleanText(hit.user, 100);
    return {
      provider: "pixabay",
      providerLabel: "Pixabay",
      id: cleanText(hit.id, 120),
      title: cleanText(hit.tags || query, 180),
      creator,
      sourceUrl: firstHttp(hit.pageURL, "https://pixabay.com"),
      url: original,
      urlOriginal: original,
      urlRaw: original,
      urlThumb: thumb,
      width: Number(hit.imageWidth || hit.webformatWidth || 0),
      height: Number(hit.imageHeight || hit.webformatHeight || 0),
      credit: creator ? `Foto de ${creator} en Pixabay` : "Foto en Pixabay"
    };
  });
}

function formatSelectedImage(item, config) {
  return {
    url: optimizedImageUrl(item, config.width, 80),
    url_original: item.urlOriginal || item.url,
    url_thumb: optimizedImageUrl({ ...item, urlRaw: item.urlThumb || item.urlRaw, url: item.urlThumb || item.url }, config.thumbWidth, 70),
    alt: cleanText(config.alt, 220),
    focal: config.focal,
    credito: item.credit,
    fuente: item.provider,
    source_url: item.sourceUrl,
    query_usada: config.query
  };
}

function compactAlternative(image) {
  if (!image) {
    return null;
  }

  return {
    url: image.url,
    url_original: image.url_original,
    url_thumb: image.url_thumb,
    alt: image.alt,
    focal: image.focal,
    credito: image.credito,
    fuente: image.fuente,
    source_url: image.source_url,
    query_usada: image.query_usada
  };
}

function nullImageFields(query, focal) {
  return {
    url: null,
    url_original: null,
    url_thumb: null,
    alt: "",
    focal,
    credito: "",
    fuente: "",
    source_url: "",
    query_usada: query
  };
}

function optimizedImageUrl(item, width, quality) {
  const url = item.urlRaw || item.url || item.urlOriginal || "";

  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);

    if (item.provider === "unsplash" || /images\.unsplash\.com$/i.test(parsed.hostname)) {
      parsed.searchParams.set("w", String(width));
      parsed.searchParams.set("q", String(quality));
      parsed.searchParams.set("auto", "format");
      parsed.searchParams.set("fit", "crop");
      return parsed.toString();
    }

    if (item.provider === "pexels" || /images\.pexels\.com$/i.test(parsed.hostname)) {
      parsed.searchParams.set("auto", "compress");
      parsed.searchParams.set("cs", "tinysrgb");
      parsed.searchParams.set("w", String(width));
      return parsed.toString();
    }

    return parsed.toString();
  } catch (error) {
    return url;
  }
}

function scoreImage(item, config) {
  const landscape = item.width >= item.height;
  const portrait = item.height > item.width;
  const resolutionScore = Math.min(4, Math.max(item.width, item.height) / 800);
  const title = normalizeSearchText(item.title);
  const queryWords = normalizeSearchText(config.query).split(/\s+/).filter((word) => word.length > 3);
  const relevance = queryWords.reduce((score, word) => score + (title.includes(word) ? 0.4 : 0), 0);
  const orientationScore = config.orientation === "landscape" && landscape
    ? 1.4
    : config.orientation === "portrait" && portrait
      ? 1.4
      : config.orientation === "square" && Math.abs(item.width - item.height) < Math.max(item.width, item.height) * 0.28
        ? 1
        : 0;
  const providerScore = item.provider === "unsplash" ? 0.5 : item.provider === "pexels" ? 0.35 : 0.2;

  return resolutionScore + relevance + orientationScore + providerScore;
}

function isSafeImageItem(item, business = {}) {
  const text = normalizeSearchText([item.title, item.creator, item.sourceUrl].join(" "));
  const hasBlockedTerm = BLOCKED_IMAGE_TERMS.some((term) => hasSearchTerm(text, term));

  if (hasBlockedTerm) {
    return false;
  }

  if (locationSearchHint(business.location).includes("spain")) {
    const americanTerms = ["united states", "usa", "new york", "california", "texas"];
    if (americanTerms.some((term) => text.includes(term))) {
      return false;
    }
  }

  return /^https:\/\//i.test(item.url || item.urlOriginal || "");
}

function getAvailableProviders(env) {
  const providers = [
    { id: "unsplash", label: "Unsplash", key: cleanText(env?.UNSPLASH_ACCESS_KEY || env?.UNSPLASH_API_KEY) },
    { id: "pexels", label: "Pexels", key: cleanText(env?.PEXELS_API_KEY) },
    { id: "pixabay", label: "Pixabay", key: cleanText(env?.PIXABAY_API_KEY) }
  ];

  return providers.filter((provider) => provider.key);
}

async function fetchJson(fetcher, endpoint, options = {}) {
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeout = controller ? setTimeout(() => controller.abort(), options.timeoutMs || DEFAULT_TIMEOUT_MS) : null;
  let response;

  try {
    response = await fetcher(endpoint.toString(), {
      headers: options.headers || {},
      signal: controller?.signal
    });
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }

  if (!response?.ok) {
    throw new Error(`Image provider responded ${response?.status || "without status"}`);
  }

  return response.json();
}

function normalizeBusinessInput(source) {
  const brand = isPlainObject(source.brand) ? source.brand : {};
  const name = cleanText(source.nombre || source.name || source.businessName || source.title, 160);

  if (!name) {
    throw httpError(400, "Business name is required");
  }

  return {
    name,
    category: cleanText(source.tipo || source.category || source.sector || "negocio local", 120),
    description: cleanText(source.descripcion || source.description || source.tagline || "", 800),
    location: cleanText(source.ubicacion || source.location || source.city || source.address || "", 180),
    colors: normalizeColors(source.colores || source.colors || brand.colors || source.palette || source.accent),
    style: cleanText(source.estilo_web || source.webStyle || source.style || [source.designPack, source.artDirection, source.contentMode].filter(Boolean).join(" "), 240),
    sections: source.secciones || source.sections || source.sectionOrder,
    services: source.servicios || source.services || [],
    gallery: source.gallery || source.galeria || [],
    galleryTarget: source.galleryTarget || source.gallery_count || source.numero_galeria,
    team: source.equipo || source.team || source.staff || [],
    testimonials: source.testimonios || source.testimonials || source.reviews || [],
    blogArticles: source.blog || source.articulos || source.articles || [],
    imageRatio: cleanText(source.imageRatio || source.ratioImagen || "", 40),
    showGallery: source.showGallery,
    showTestimonials: source.showTestimonials,
    showMap: source.showMap,
    showLeadForm: source.showLeadForm
  };
}

function extractBusinessPayload(payload) {
  if (!isPlainObject(payload)) {
    throw httpError(400, "JSON body must be an object");
  }

  if (isPlainObject(payload.negocio)) {
    return payload.negocio;
  }

  if (isPlainObject(payload.business)) {
    return payload.business;
  }

  return payload;
}

function normalizeSections(value, business) {
  const raw = Array.isArray(value) && value.length
    ? value
    : ["hero", "servicios", ...(business.showGallery === false ? [] : ["galeria"]), ...(business.showTestimonials ? ["testimonios"] : []), "contacto"];
  const sections = raw
    .map((section) => SECTION_ALIASES[normalizeSearchText(section)] || "")
    .filter(Boolean);

  if (!sections.includes("hero")) {
    sections.unshift("hero");
  }

  return [...new Set(sections)];
}

function inferVocabulary(category, description) {
  const haystack = normalizeSearchText(`${category} ${description}`);
  return BUSINESS_VOCABULARY.find((entry) => (
    entry.id !== "generic" && entry.aliases.some((alias) => hasSearchTerm(haystack, alias))
  )) || BUSINESS_VOCABULARY.find((entry) => entry.id === "generic");
}

function normalizeServiceList(value, fallback) {
  const items = Array.isArray(value) ? value : splitLines(value);
  const normalized = items.map((item, index) => {
    if (isPlainObject(item)) {
      const label = cleanText(item.label || item.name || item.title || item.service, 140);
      return label ? { id: cleanId(item.id) || slugify(label), label } : null;
    }

    const label = cleanText(item, 140);
    return label ? { id: slugify(label) || `servicio-${index + 1}`, label } : null;
  }).filter(Boolean);

  if (normalized.length) {
    return normalized;
  }

  return fallback.map((label, index) => ({
    id: slugify(label) || `servicio-${index + 1}`,
    label
  }));
}

function normalizePeopleList(value, fallback) {
  const items = Array.isArray(value) ? value : splitLines(value);
  const normalized = items.map((item, index) => {
    if (isPlainObject(item)) {
      const label = cleanText(item.label || item.name || item.title || item.role, 140);
      return label ? { id: cleanId(item.id) || slugify(label), label } : null;
    }

    const label = cleanText(item, 140);
    return label ? { id: slugify(label) || `persona-${index + 1}`, label } : null;
  }).filter(Boolean);

  if (normalized.length) {
    return normalized;
  }

  return fallback.map((label, index) => ({ id: slugify(label) || `persona-${index + 1}`, label }));
}

function normalizeArticleList(value) {
  const items = Array.isArray(value) ? value : splitLines(value);
  return items.map((item, index) => {
    if (isPlainObject(item)) {
      const label = cleanText(item.title || item.label || item.name, 160);
      return label ? { id: cleanId(item.id) || slugify(label), label } : null;
    }

    const label = cleanText(item, 160);
    return label ? { id: slugify(label) || `articulo-${index + 1}`, label } : null;
  }).filter(Boolean);
}

function buildServiceQuery(label, vocabulary, business) {
  const text = normalizeSearchText(label);
  const hints = [...(vocabulary.serviceHints || []), ...GLOBAL_SERVICE_HINTS];
  const match = hints.find((hint) => hint.terms.some((term) => hasSearchTerm(text, term)));
  return buildQuery([
    match?.query || vocabulary.service,
    getAtmosphereWords(business.style),
    business.location ? "spain" : ""
  ]);
}

function englishTopicHint(value) {
  const text = normalizeSearchText(value);

  if (hasSearchTerm(text, "consejo") || hasSearchTerm(text, "tips")) {
    return "professional tips guide";
  }

  if (hasSearchTerm(text, "temporada")) {
    return "seasonal local business detail";
  }

  if (hasSearchTerm(text, "reserva") || hasSearchTerm(text, "cita")) {
    return "booking appointment professional service";
  }

  return "local business service detail";
}

function getAtmosphereWords(style) {
  const text = normalizeSearchText(style);
  const matches = STYLE_HINTS
    .filter((hint) => hint.terms.some((term) => hasSearchTerm(text, term)))
    .map((hint) => hint.words);

  return matches.length ? [...new Set(matches.join(" ").split(/\s+/))].slice(0, 5).join(" ") : "warm professional authentic";
}

function locationSearchHint(location) {
  const text = normalizeSearchText(location).replace(/\bespana\b/g, "spain");

  if (!text) {
    return "spain";
  }

  const city = Object.keys(CITY_ALIASES).find((key) => hasSearchTerm(text, key));
  if (city) {
    return CITY_ALIASES[city];
  }

  return text.includes("spain") ? text : `${text} spain`;
}

function buildQuery(parts) {
  return [...new Set(parts
    .join(" ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean))]
    .join(" ")
    .slice(0, 140);
}

function mapUnsplashOrientation(value) {
  return value === "square" ? "squarish" : value === "portrait" ? "portrait" : "landscape";
}

function mapPixabayOrientation(value) {
  return value === "portrait" ? "vertical" : value === "square" ? "all" : "horizontal";
}

function getMainSource(images) {
  if (!images.length) {
    return null;
  }

  const counts = images.reduce((map, image) => {
    map.set(image.fuente, (map.get(image.fuente) || 0) + 1);
    return map;
  }, new Map());

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
}

function normalizeColors(value) {
  const items = Array.isArray(value) ? value : [value];
  return items
    .map((item) => cleanText(item, 40))
    .filter((item) => /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(item))
    .slice(0, 6);
}

function splitLines(value) {
  return cleanText(value, 4000)
    .split(/\r?\n|,/)
    .map((item) => cleanText(item, 160))
    .filter(Boolean);
}

function firstHttp(...values) {
  return values
    .map((value) => cleanText(value, 1000))
    .find((value) => /^https?:\/\/\S+$/i.test(value)) || "";
}

function urlIdentity(value) {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.toLowerCase();
  } catch (error) {
    return cleanText(value).split("?")[0].toLowerCase();
  }
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasSearchTerm(text, term) {
  const normalizedText = normalizeSearchText(text);
  const normalizedTerm = normalizeSearchText(term);

  if (!normalizedTerm) {
    return false;
  }

  if (normalizedTerm.includes(" ") || normalizedTerm.includes("-")) {
    return normalizedText.includes(normalizedTerm);
  }

  return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedTerm)}([^a-z0-9]|$)`, "i").test(normalizedText);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function readJsonBody(request) {
  let size = 0;
  let raw = "";

  for await (const chunk of request) {
    size += chunk.length;

    if (size > MAX_BODY_BYTES) {
      throw httpError(413, "JSON body is too large");
    }

    raw += chunk;
  }

  if (!raw.trim()) {
    throw httpError(400, "JSON body is required");
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw httpError(400, "Invalid JSON body");
  }
}

function sendJson(response, status, payload, context, extraHeaders = {}) {
  response.writeHead(status, {
    ...context.baseHeaders,
    ...corsHeaders(context),
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders
  });
  response.end(JSON.stringify(payload, null, 2));
}

function pruneCache(cache) {
  if (cache.size <= 300) {
    return;
  }

  const now = Date.now();
  cache.forEach((entry, key) => {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  });
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  return Number.isInteger(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function cleanId(value) {
  return cleanText(value, 80).replace(/[^a-z0-9_-]/gi, "_").replace(/^_+|_+$/g, "");
}

function slugify(value) {
  return normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function cleanText(value, maxLength = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
