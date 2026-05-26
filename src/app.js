const STORAGE_KEY = "locallift-studio-business";
const API_RECORD_KEY = "locallift-studio-business-api-record";
const BUSINESS_API_BASE = "/api/businesses";
const DATA_VERSION = 3;

const demoBusiness = {
  name: "Brasa Norte",
  category: "Restaurante de fuego lento",
  location: "Santander",
  tagline: "Cocina local con alma de brasas",
  description:
    "Un restaurante de barrio convertido en destino: producto cantabrico, parrilla vista, reservas faciles y una experiencia digital que hace que apetezca venir antes de probar el primer plato.",
  conversionGoal: "Reservas de mesa, grupos y eventos privados por WhatsApp",
  announcement: "Nueva carta de temporada y reservas de grupo abiertas esta semana",
  phone: "+34 942 000 123",
  email: "reservas@brasanorte.es",
  address: "Calle del Mercado 18, Santander",
  services: [
    "Menu degustacion de temporada",
    "Parrilla de carne y pescado",
    "Reservas para grupos",
    "Carta de vinos locales",
    "Take away premium",
    "Eventos privados"
  ],
  features: [
    "Producto de proveedores cercanos con carta que cambia cada semana",
    "Reservas conectadas a WhatsApp, Google Maps y redes sociales",
    "Galeria visual preparada para destacar platos, local y equipo",
    "Secciones modulares para escalar desde una web simple hasta una presencia completa"
  ],
  hours: [
    "Lunes cerrado",
    "Martes a jueves: 13:00-16:00 / 20:00-23:00",
    "Viernes y sabado: 13:00-00:30",
    "Domingo: 13:00-17:00"
  ],
  testimonials: [
    {
      name: "Laura M.",
      text: "La web transmite exactamente lo que se vive en el local. Reserve en dos clicks."
    },
    {
      name: "Diego R.",
      text: "Fotos, carta, ubicacion y redes en una experiencia muy limpia. Parece una marca grande."
    },
    {
      name: "Marta S.",
      text: "El movimiento al hacer scroll hace que todo se sienta cuidado, pero sigue siendo facil encontrar lo importante."
    }
  ],
  faqs: [
    {
      question: "Se puede reservar online?",
      answer: "Si. El boton principal puede apuntar a WhatsApp, CoverManager, Google Calendar o cualquier sistema de reservas."
    },
    {
      question: "La web sirve para otros sectores?",
      answer: "Si. Cambiando textos, fotos y secciones funciona para clinicas, peluquerias, gimnasios, academias, talleres o tiendas."
    },
    {
      question: "Se puede entregar como HTML?",
      answer: "Si. El exportador descarga una pagina completa con estilos y animaciones listas para subir a hosting."
    }
  ],
  trustBadges: [
    "4.8 en Google con resenas conectables",
    "Reserva en menos de un minuto",
    "Carta, ubicacion y redes siempre visibles",
    "Chatbot preparado para horarios y reservas"
  ],
  links: [
    { label: "Instagram", url: "https://instagram.com/" },
    { label: "Google Maps", url: "https://maps.google.com/" },
    { label: "TikTok", url: "https://tiktok.com/" }
  ],
  heroImage:
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1800&q=85",
  gallery: [
    "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1544148103-0773bf10d330?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=1200&q=80",
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80"
  ],
  theme: "neon",
  motion: "bold",
  accent: "#ff3d81",
  intensity: 88,
  premiumEffects: true,
  showBooking: true,
  bookingUrl: "https://wa.me/34942000123",
  bookingLabel: "Reservar ahora",
  servicesHeading: "Lo que el cliente entiende en segundos.",
  servicesIntro:
    "La web prioriza decision rapida: que haces, por que elegirte, como se reserva y que sensacion transmite el negocio.",
  trustHeading: "Confianza antes de llamar.",
  trustIntro:
    "Testimonios, preguntas frecuentes y enlaces reducen friccion para quien te descubre por primera vez.",
  contactHeading: "Ven, reserva o escribe.",
  showLeadForm: true,
  leadFormTitle: "Recibe disponibilidad y propuesta en minutos.",
  leadFormIntro:
    "Deja tus datos y el equipo recibe un lead preparado con servicio, fecha orientativa y canal de contacto.",
  leadFormCta: "Solicitar disponibilidad",
  designPack: "custom",
  typography: "modern",
  contentDensity: "balanced",
  visualShape: "clean",
  heroSize: "balanced",
  contentWidth: "standard",
  imageRatio: "portrait",
  fontScale: 100,
  layoutScale: 100,
  showAnnouncement: true,
  showResourceMarquee: true,
  showTrustRail: true,
  showGallery: true,
  showTestimonials: true,
  showFaq: true,
  showMap: true,
  showConversionDock: true,
  google: {
    enabled: true,
    workspaceEmail: "reservas@brasanorte.es",
    workspaceDomain: "brasanorte.es",
    managerEmail: "",
    placeId: "",
    mapsUrl: "https://maps.google.com/",
    mapEmbedUrl: "",
    directionsNote: "Estamos en una zona centrica, con acceso facil desde Google Maps y opciones de parking cercano.",
    reviewUrl: "https://g.page/r/",
    reviewRequestTemplate:
      "Gracias por visitar {business}. Tu opinion nos ayuda mucho. Puedes dejar una resena aqui: {reviewUrl}",
    appointmentUrl: "https://wa.me/34942000123",
    bookingRules:
      "Reservas por WhatsApp con nombre, fecha, hora y numero de personas. Confirmacion manual del equipo.",
    rating: 4.8,
    reviewCount: 248,
    calendarId: "primary",
    businessProfileAccountId: "",
    businessProfileLocationId: ""
  },
  chatbot: {
    enabled: true,
    name: "NorteBot",
    tone: "cercano",
    greeting:
      "Hola, soy NorteBot. Te ayudo con reservas, horarios, ubicacion, servicios y cualquier duda rapida de Brasa Norte.",
    quickPrompts: ["Quiero reservar", "Ver horario", "Donde estais?", "Que servicios teneis?"],
    handoffLabel: "Hablar por WhatsApp",
    endpoint: ""
  },
  commerce: {
    enabled: false,
    title: "Compra online",
    intro:
      "Productos preparados para recoger o recibir en casa. El cliente anade al carrito, deja sus datos y paga con Stripe Checkout.",
    currency: "EUR",
    taxRatePercent: 21,
    taxIncluded: true,
    checkoutEndpoint: "http://127.0.0.1:8795/api/store/checkout",
    productsEndpoint: "http://127.0.0.1:8795/api/store/products",
    successUrl: "",
    cancelUrl: "",
    termsUrl: "",
    privacyUrl: "",
    orderEmail: "reservas@brasanorte.es",
    deliveryMode: "Recogida en tienda y entrega local bajo confirmacion",
    shippingMethods: [
      {
        id: "pickup",
        name: "Recogida en tienda",
        description: "El negocio confirma la hora de recogida.",
        price: 0,
        active: true,
        default: true
      },
      {
        id: "local-delivery",
        name: "Entrega local",
        description: "Reparto local bajo confirmacion.",
        price: 4.9,
        active: true,
        default: false
      }
    ],
    products: [
      {
        id: "menu-brasa",
        sku: "menu-brasa",
        name: "Menu brasa para dos",
        price: 38,
        image:
          "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80",
        description: "Pack de temporada preparado para recoger en el local.",
        stock: 12,
        active: true
      },
      {
        id: "vino-local",
        sku: "vino-local",
        name: "Botella seleccion local",
        price: 16.5,
        image:
          "https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=900&q=80",
        description: "Recomendacion de la casa para acompanar pedidos.",
        stock: 24,
        active: true
      },
      {
        id: "tarjeta-regalo",
        sku: "tarjeta-regalo",
        name: "Tarjeta regalo",
        price: 50,
        image:
          "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=900&q=80",
        description: "Credito para comidas, eventos o regalos de empresa.",
        stock: 50,
        active: true
      }
    ]
  }
};

const sectorPresets = {
  restaurant: demoBusiness,
  clinic: {
    name: "Clinica Alba",
    category: "Clinica de salud y bienestar",
    location: "Valencia",
    tagline: "Atencion medica cercana, clara y sin esperas innecesarias",
    description:
      "Una clinica privada con reserva online, especialidades visibles, equipo humano y un asistente que resuelve dudas frecuentes antes de llamar.",
    phone: "+34 960 000 245",
    email: "hola@clinicaalba.es",
    address: "Avenida del Turia 42, Valencia",
    services: [
      "Medicina general",
      "Fisioterapia y rehabilitacion",
      "Analiticas y revisiones",
      "Nutricion clinica",
      "Psicologia",
      "Teleconsulta"
    ],
    features: [
      "Reservas rapidas por especialidad y profesional",
      "Preguntas frecuentes para reducir llamadas repetidas",
      "Confianza visual con equipo, instalaciones y protocolos",
      "Contacto directo para pacientes nuevos y recurrentes"
    ],
    hours: [
      "Lunes a viernes: 08:00-21:00",
      "Sabado: 09:00-14:00",
      "Urgencias concertadas bajo cita"
    ],
    testimonials: [
      { name: "Paciente verificado", text: "Encontre la especialidad, pedi cita y llegue con todo claro." },
      { name: "Ana P.", text: "La informacion esta ordenada y transmite mucha confianza." },
      { name: "Carlos G.", text: "El asistente me resolvio horarios y ubicacion al momento." }
    ],
    faqs: [
      { question: "Puedo pedir cita online?", answer: "Si. Puedes usar el boton de reserva o escribir por WhatsApp." },
      { question: "Aceptais seguros?", answer: "Depende de la especialidad. Contacta con la clinica para confirmarlo." },
      { question: "Hay teleconsulta?", answer: "Si, algunas especialidades tienen consulta online." }
    ],
    links: [
      { label: "Google Maps", url: "https://maps.google.com/" },
      { label: "Instagram", url: "https://instagram.com/" },
      { label: "Doctoralia", url: "https://www.doctoralia.es/" }
    ],
    heroImage:
      "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1800&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=1200&q=80"
    ],
    theme: "luxe",
    motion: "cinematic",
    accent: "#0f8f8f",
    intensity: 74,
    premiumEffects: true,
    showBooking: true,
    bookingUrl: "https://wa.me/34960000245",
    google: {
      enabled: true,
      placeId: "",
      mapsUrl: "https://maps.google.com/",
      reviewUrl: "https://g.page/r/",
      appointmentUrl: "https://wa.me/34960000245",
      rating: 4.9,
      reviewCount: 312,
      calendarId: "primary",
      businessProfileAccountId: "",
      businessProfileLocationId: ""
    },
    chatbot: {
      enabled: true,
      name: "AlbaBot",
      tone: "premium",
      greeting: "Hola, soy AlbaBot. Puedo ayudarte con citas, horarios, especialidades y ubicacion.",
      quickPrompts: ["Pedir cita", "Ver especialidades", "Horario", "Donde estais?"],
      handoffLabel: "Contactar con recepcion",
      endpoint: ""
    }
  },
  beauty: {
    name: "Luma Studio",
    category: "Peluqueria y belleza",
    location: "Madrid",
    tagline: "Belleza con agenda llena, experiencia cuidada y reserva facil",
    description:
      "Un estudio de belleza con servicios claros, fotos aspiracionales, reservas por WhatsApp y chatbot para resolver dudas de tratamientos.",
    phone: "+34 910 000 781",
    email: "citas@lumastudio.es",
    address: "Calle Primavera 9, Madrid",
    services: [
      "Coloracion y balayage",
      "Corte y styling",
      "Tratamientos capilares",
      "Manicura premium",
      "Maquillaje social",
      "Novias y eventos"
    ],
    features: [
      "Galeria antes/despues preparada para redes y conversion",
      "Reserva en un toque desde movil",
      "FAQ de duracion, cuidados y preparacion",
      "Estetica premium sin perder claridad comercial"
    ],
    hours: ["Martes a viernes: 10:00-20:00", "Sabado: 09:30-15:00", "Domingo y lunes cerrado"],
    testimonials: [
      { name: "Sara L.", text: "Reserve balayage desde el movil y llegue sabiendo precio orientativo y duracion." },
      { name: "Irene M.", text: "La web se siente igual de cuidada que el salon." },
      { name: "Paula C.", text: "El bot respondio mis dudas antes de pedir cita." }
    ],
    faqs: [
      { question: "Como reservo?", answer: "Puedes reservar por WhatsApp desde el boton principal." },
      { question: "Cuanto dura una coloracion?", answer: "Depende del servicio, pero suele estar entre 2 y 4 horas." },
      { question: "Haceis novias?", answer: "Si. Se recomienda escribir con fecha y referencias." }
    ],
    links: [
      { label: "Instagram", url: "https://instagram.com/" },
      { label: "Google Maps", url: "https://maps.google.com/" },
      { label: "TikTok", url: "https://tiktok.com/" }
    ],
    heroImage:
      "https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1800&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1200&q=80"
    ],
    theme: "editorial",
    motion: "cinematic",
    accent: "#b2477b",
    intensity: 82,
    premiumEffects: true,
    showBooking: true,
    bookingUrl: "https://wa.me/34910000781",
    google: {
      enabled: true,
      placeId: "",
      mapsUrl: "https://maps.google.com/",
      reviewUrl: "https://g.page/r/",
      appointmentUrl: "https://wa.me/34910000781",
      rating: 4.7,
      reviewCount: 186,
      calendarId: "primary",
      businessProfileAccountId: "",
      businessProfileLocationId: ""
    },
    chatbot: {
      enabled: true,
      name: "LumaBot",
      tone: "cercano",
      greeting: "Hola, soy LumaBot. Te ayudo con citas, servicios, horarios y cuidados antes de venir.",
      quickPrompts: ["Reservar cita", "Servicios", "Horario", "Cuanto dura?"],
      handoffLabel: "Escribir por WhatsApp",
      endpoint: ""
    }
  },
  gym: {
    name: "Distrito Fit",
    category: "Gimnasio boutique",
    location: "Bilbao",
    tagline: "Entrenamiento de alto impacto con comunidad y seguimiento real",
    description:
      "Un gimnasio boutique con clases, entrenadores, horarios, prueba gratuita y chatbot para convertir curiosos en leads.",
    phone: "+34 944 000 618",
    email: "hola@distritofit.es",
    address: "Plaza Nueva 7, Bilbao",
    services: [
      "Entrenamiento funcional",
      "Fuerza en grupos reducidos",
      "Plan personal",
      "Nutricion deportiva",
      "Prueba gratuita",
      "Clases early morning"
    ],
    features: [
      "Captura de leads con prueba gratuita",
      "Horarios y clases explicados sin friccion",
      "Prueba social con comunidad y resultados",
      "Chatbot para resolver dudas antes de visitar"
    ],
    hours: ["Lunes a viernes: 06:30-22:00", "Sabado: 08:00-14:00", "Domingo: clases especiales"],
    testimonials: [
      { name: "Javi R.", text: "Vi horarios, probe una clase y me apunte esa semana." },
      { name: "Nerea S.", text: "La web explica perfecto el metodo y transmite energia." },
      { name: "Unai T.", text: "El bot me ayudo a elegir clase inicial." }
    ],
    faqs: [
      { question: "Hay prueba gratis?", answer: "Si. Puedes reservar una clase de prueba desde el boton principal." },
      { question: "Necesito experiencia?", answer: "No. Las clases se adaptan por nivel." },
      { question: "Hay entrenamientos personales?", answer: "Si, puedes solicitar plan personal y seguimiento." }
    ],
    links: [
      { label: "Instagram", url: "https://instagram.com/" },
      { label: "Google Maps", url: "https://maps.google.com/" },
      { label: "YouTube", url: "https://youtube.com/" }
    ],
    heroImage:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1800&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1549060279-7e168fcee0c2?auto=format&fit=crop&w=1200&q=80"
    ],
    theme: "neon",
    motion: "bold",
    accent: "#ffbf3c",
    intensity: 92,
    premiumEffects: true,
    showBooking: true,
    bookingUrl: "https://wa.me/34944000618",
    google: {
      enabled: true,
      placeId: "",
      mapsUrl: "https://maps.google.com/",
      reviewUrl: "https://g.page/r/",
      appointmentUrl: "https://wa.me/34944000618",
      rating: 4.9,
      reviewCount: 421,
      calendarId: "primary",
      businessProfileAccountId: "",
      businessProfileLocationId: ""
    },
    chatbot: {
      enabled: true,
      name: "FitBot",
      tone: "directo",
      greeting: "Soy FitBot. Te ayudo a reservar prueba, ver horarios, clases y ubicacion.",
      quickPrompts: ["Prueba gratis", "Horarios", "Clases", "Ubicacion"],
      handoffLabel: "Reservar prueba",
      endpoint: ""
    }
  },
  bar: {
    name: "Bar La Esquina",
    category: "Bar de tapas y copas",
    location: "Sevilla",
    tagline: "Tapas, tardeo y reservas de grupo sin perder una mesa",
    description:
      "Un bar de barrio con agenda movida: tapas, copas, eventos deportivos, reservas para grupos y llamadas directas desde movil.",
    phone: "+34 954 000 442",
    email: "hola@barlaesquina.es",
    address: "Calle Feria 32, Sevilla",
    services: [
      "Tapas de temporada: carta corta con producto local y precios claros",
      "Canas y vinos: seleccion para aperitivo y tardeo",
      "Copas de autor: combinados y cocteles para noches con ambiente",
      "Reservas de grupo: mesas para cumpleanos, empresa y previas",
      "Menu mediodia: platos rapidos para gente de la zona",
      "Eventos deportivos: pantalla, horarios y promociones"
    ],
    features: [
      "Carta, horario y ubicacion visibles desde el primer pantallazo",
      "Boton directo para reservar mesa o escribir por WhatsApp",
      "Promos de tardeo y eventos destacadas sin rehacer la web",
      "Fotos del local, barra y platos para vender ambiente antes de llegar"
    ],
    hours: ["Lunes a jueves: 12:00-00:00", "Viernes y sabado: 12:00-02:30", "Domingo: 12:00-18:00"],
    testimonials: [
      { name: "Rocio M.", text: "Vimos la promo de tapas y reservamos mesa para ocho en un minuto." },
      { name: "Alvaro C.", text: "La web deja claro el ambiente, la carta y como llegar." },
      { name: "Mesa 14", text: "El bot nos confirmo horario del partido y contacto directo." }
    ],
    faqs: [
      { question: "Se puede reservar mesa?", answer: "Si. Usa el boton principal o escribe por WhatsApp con dia, hora y personas." },
      { question: "Teneis terraza?", answer: "Si, hay terraza sujeta a disponibilidad y clima." },
      { question: "Poneis partidos?", answer: "Si, los eventos deportivos se anuncian en la web y redes." }
    ],
    links: [
      { label: "Instagram", url: "https://instagram.com/" },
      { label: "Google Maps", url: "https://maps.google.com/" },
      { label: "Carta digital", url: "https://example.com/carta" }
    ],
    heroImage:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1800&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1200&q=80"
    ],
    theme: "carbon",
    motion: "bold",
    accent: "#d66a2c",
    intensity: 86,
    premiumEffects: true,
    showBooking: true,
    bookingUrl: "https://wa.me/34954000442",
    bookingLabel: "Reservar mesa",
    servicesHeading: "Carta, promos y reservas en primer plano.",
    servicesIntro:
      "Para bares conviene ensenar rapido que se puede tomar, cuando ir, que ambiente hay y como reservar sin llamar.",
    trustHeading: "Ambiente probado antes de entrar.",
    trustIntro:
      "Fotos, opiniones y dudas frecuentes convierten busquedas de ultima hora en visitas reales.",
    contactHeading: "Reserva mesa o ven directo.",
    typography: "compact",
    contentDensity: "compact",
    visualShape: "sharp",
    google: {
      enabled: true,
      placeId: "",
      mapsUrl: "https://maps.google.com/",
      reviewUrl: "https://g.page/r/",
      appointmentUrl: "https://wa.me/34954000442",
      rating: 4.6,
      reviewCount: 539,
      calendarId: "primary",
      businessProfileAccountId: "",
      businessProfileLocationId: ""
    },
    chatbot: {
      enabled: true,
      name: "EsquinaBot",
      tone: "directo",
      greeting: "Soy EsquinaBot. Te ayudo con reservas, horario, terraza, carta y partidos.",
      quickPrompts: ["Reservar mesa", "Ver carta", "Hay terraza?", "Horario"],
      handoffLabel: "Escribir al bar",
      endpoint: ""
    }
  },
  stationery: {
    name: "Papeleria Punto Azul",
    category: "Papeleria y copisteria",
    location: "Zaragoza",
    tagline: "Material escolar, impresiones y encargos listos cuando los necesitas",
    description:
      "Una papeleria de proximidad con servicios de copisteria, material escolar, encargos por WhatsApp y horarios claros para familias, estudiantes y negocios.",
    phone: "+34 976 000 384",
    email: "pedidos@puntoazul.es",
    address: "Calle San Miguel 21, Zaragoza",
    services: [
      "Impresion y copias: blanco y negro, color y formatos para oficina",
      "Encuadernacion: trabajos, apuntes, dosieres y presentaciones",
      "Material escolar: mochilas, cuadernos, agendas y escritura",
      "Papeleria tecnica: cartulinas, laminas, rotuladores y archivo",
      "Encargos por WhatsApp: envia archivos y recoge sin esperas",
      "Regalo y detalle: tarjetas, envoltorio y pequenos accesorios"
    ],
    features: [
      "Servicios explicados para que el cliente sepa si puede resolverlo alli",
      "WhatsApp preparado para pedir impresiones o consultar stock",
      "Secciones adaptables para campana escolar, navidad o vuelta a clase",
      "SEO local para busquedas de copisteria, papeleria y material escolar"
    ],
    hours: ["Lunes a viernes: 09:00-14:00 / 17:00-20:30", "Sabado: 10:00-14:00", "Domingo cerrado"],
    testimonials: [
      { name: "Marta V.", text: "Mande los apuntes por WhatsApp y los recogi encuadernados." },
      { name: "Colegio cercano", text: "La lista de material esta clara y actualizada." },
      { name: "Luis F.", text: "Encontre horario, ubicacion y servicios sin llamar." }
    ],
    faqs: [
      { question: "Puedo enviar archivos antes de ir?", answer: "Si. Envia el archivo por WhatsApp e indica formato, copias y hora de recogida." },
      { question: "Haceis encuadernaciones?", answer: "Si, con varias opciones segun disponibilidad." },
      { question: "Teneis material escolar todo el ano?", answer: "Si, y se pueden destacar campanas concretas en la web." }
    ],
    links: [
      { label: "WhatsApp", url: "https://wa.me/34976000384" },
      { label: "Google Maps", url: "https://maps.google.com/" },
      { label: "Instagram", url: "https://instagram.com/" }
    ],
    heroImage:
      "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1800&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80"
    ],
    theme: "aurora",
    motion: "soft",
    accent: "#2f6fed",
    intensity: 64,
    premiumEffects: true,
    showBooking: true,
    bookingUrl: "https://wa.me/34976000384",
    bookingLabel: "Pedir encargo",
    servicesHeading: "Servicios cotidianos explicados sin vueltas.",
    servicesIntro:
      "La web convierte dudas repetidas en acciones: imprimir, reservar material, consultar stock o llegar al local.",
    trustHeading: "Cercania para familias y negocios.",
    trustIntro:
      "Resenas y preguntas frecuentes reducen llamadas y ayudan a preparar encargos antes de pasar por tienda.",
    contactHeading: "Envia el archivo o ven a tienda.",
    typography: "modern",
    contentDensity: "balanced",
    visualShape: "clean",
    google: {
      enabled: true,
      placeId: "",
      mapsUrl: "https://maps.google.com/",
      reviewUrl: "https://g.page/r/",
      appointmentUrl: "https://wa.me/34976000384",
      rating: 4.8,
      reviewCount: 167,
      calendarId: "primary",
      businessProfileAccountId: "",
      businessProfileLocationId: ""
    },
    chatbot: {
      enabled: true,
      name: "PuntoBot",
      tone: "cercano",
      greeting: "Hola, soy PuntoBot. Te ayudo con impresiones, encargos, material, horario y ubicacion.",
      quickPrompts: ["Enviar archivo", "Horario", "Material escolar", "Donde estais?"],
      handoffLabel: "Enviar WhatsApp",
      endpoint: ""
    }
  },
  kebab: {
    name: "Anatolia Kebab",
    category: "Kebab y comida rapida",
    location: "Murcia",
    tagline: "Pedidos rapidos, menu claro y clientes con hambre a un toque",
    description:
      "Un local de kebab con carta directa, fotos de platos, horarios amplios, pedidos por WhatsApp y enlaces a delivery para vender desde busqueda local.",
    phone: "+34 868 000 719",
    email: "pedidos@anatoliakebab.es",
    address: "Avenida Libertad 14, Murcia",
    services: [
      "Kebab clasico: pollo, ternera o mixto con salsa a elegir",
      "Durum y lahmacun: opciones rapidas para comer alli o llevar",
      "Menus completos: bebida, patatas y extra por precio cerrado",
      "Platos combinados: raciones grandes para comida o cena",
      "Pedidos para recoger: WhatsApp directo con hora estimada",
      "Delivery externo: enlaces a plataformas y telefono visible"
    ],
    features: [
      "Carta sencilla con productos estrella y precios faciles de actualizar",
      "Botones de pedido para WhatsApp, llamada o plataforma delivery",
      "Fotos apetecibles para convertir visitas desde Google Maps",
      "Horario nocturno destacado para captar busquedas de ultima hora"
    ],
    hours: ["Lunes a jueves: 12:00-01:00", "Viernes y sabado: 12:00-03:00", "Domingo: 13:00-01:00"],
    testimonials: [
      { name: "Nico A.", text: "Vi el menu, escribi por WhatsApp y lo recogi en 15 minutos." },
      { name: "Claudia S.", text: "La carta es clara y el horario nocturno se ve al instante." },
      { name: "Mesa dos", text: "El bot nos dijo opciones y contacto sin tener que llamar." }
    ],
    faqs: [
      { question: "Puedo pedir para recoger?", answer: "Si. Escribe por WhatsApp con el pedido y la hora aproximada." },
      { question: "Teneis opciones vegetarianas?", answer: "Si, se pueden destacar falafel, ensaladas y platos sin carne." },
      { question: "Repartis a domicilio?", answer: "La web puede enlazar telefono, WhatsApp o plataformas de delivery." }
    ],
    links: [
      { label: "WhatsApp", url: "https://wa.me/34868000719" },
      { label: "Google Maps", url: "https://maps.google.com/" },
      { label: "Delivery", url: "https://example.com/delivery" }
    ],
    heroImage:
      "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=1800&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80"
    ],
    theme: "neon",
    motion: "bold",
    accent: "#ff6a00",
    intensity: 94,
    premiumEffects: true,
    showBooking: true,
    bookingUrl: "https://wa.me/34868000719",
    bookingLabel: "Pedir ahora",
    servicesHeading: "Menu claro para decidir rapido.",
    servicesIntro:
      "En comida rapida la conversion depende de ver carta, precio, horario y boton de pedido sin friccion.",
    trustHeading: "Antojo, prueba social y contacto.",
    trustIntro:
      "Las resenas y FAQs resuelven dudas de alergenos, recogida y delivery antes de que el cliente se marche.",
    contactHeading: "Pide, recoge o llama.",
    typography: "compact",
    contentDensity: "compact",
    visualShape: "rounded",
    google: {
      enabled: true,
      placeId: "",
      mapsUrl: "https://maps.google.com/",
      reviewUrl: "https://g.page/r/",
      appointmentUrl: "https://wa.me/34868000719",
      rating: 4.5,
      reviewCount: 694,
      calendarId: "primary",
      businessProfileAccountId: "",
      businessProfileLocationId: ""
    },
    chatbot: {
      enabled: true,
      name: "AnatoliaBot",
      tone: "directo",
      greeting: "Soy AnatoliaBot. Te ayudo con menu, pedidos, horarios, recogida y delivery.",
      quickPrompts: ["Pedir ahora", "Ver menu", "Horario", "Delivery"],
      handoffLabel: "Enviar pedido",
      endpoint: ""
    }
  },
  bazaar: {
    name: "Bazar Central",
    category: "Bazar multiproducto",
    location: "Alicante",
    tagline: "Ofertas, hogar y pequenos imprescindibles organizados para vender mas",
    description:
      "Un bazar local con categorias visibles, ofertas semanales, ubicacion clara y contacto para consultar stock antes de desplazarse.",
    phone: "+34 965 000 527",
    email: "info@bazarcentral.es",
    address: "Rambla Mendez Nunez 45, Alicante",
    services: [
      "Hogar y cocina: menaje, orden, limpieza y pequenos accesorios",
      "Ferreteria basica: herramientas, pilas, cables y reparacion rapida",
      "Temporada: playa, navidad, carnaval, vuelta al cole y jardin",
      "Papeleria y regalo: detalles, bolsas, tarjetas y celebraciones",
      "Ofertas semanales: productos destacados y promociones visibles",
      "Consulta de stock: preguntas rapidas por WhatsApp antes de venir"
    ],
    features: [
      "Categorias ordenadas para que un surtido amplio parezca facil de comprar",
      "Bloques de temporada que se cambian sin redisenar toda la web",
      "Contacto directo para preguntar stock y ahorrar desplazamientos",
      "SEO local para captar busquedas de bazar, hogar, ferreteria y regalos"
    ],
    hours: ["Lunes a sabado: 09:30-21:00", "Domingo: 10:30-14:00", "Festivos: consultar en Google"],
    testimonials: [
      { name: "Elena P.", text: "Pregunte si tenian el producto y pase a recogerlo." },
      { name: "Ruben D.", text: "La web ordena muy bien todo lo que venden." },
      { name: "Cliente local", text: "Las ofertas y horarios se ven rapido desde el movil." }
    ],
    faqs: [
      { question: "Puedo consultar stock?", answer: "Si. Envia foto o descripcion por WhatsApp y el equipo confirma disponibilidad." },
      { question: "Actualizais ofertas?", answer: "Si, las secciones se pueden adaptar por temporada o campana." },
      { question: "Abreis domingos?", answer: "Depende de la semana. La web puede enlazar el horario actualizado de Google." }
    ],
    links: [
      { label: "WhatsApp", url: "https://wa.me/34965000527" },
      { label: "Google Maps", url: "https://maps.google.com/" },
      { label: "Instagram", url: "https://instagram.com/" }
    ],
    heroImage:
      "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=1800&q=85",
    gallery: [
      "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1534723452862-4c874018d66d?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1481437156560-3205f6a55735?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1491933382434-500287f9b54b?auto=format&fit=crop&w=1200&q=80"
    ],
    theme: "luxe",
    motion: "cinematic",
    accent: "#2454d8",
    intensity: 72,
    premiumEffects: true,
    showBooking: true,
    bookingUrl: "https://wa.me/34965000527",
    bookingLabel: "Consultar stock",
    servicesHeading: "Categorias amplias, compra sencilla.",
    servicesIntro:
      "Un bazar necesita ordenar mucho surtido, destacar temporada y facilitar consultas de stock desde el movil.",
    trustHeading: "Disponibilidad antes de desplazarse.",
    trustIntro:
      "Las preguntas frecuentes y enlaces directos evitan viajes en falso y convierten busquedas cercanas.",
    contactHeading: "Pregunta stock o ven al local.",
    typography: "modern",
    contentDensity: "balanced",
    visualShape: "clean",
    google: {
      enabled: true,
      placeId: "",
      mapsUrl: "https://maps.google.com/",
      reviewUrl: "https://g.page/r/",
      appointmentUrl: "https://wa.me/34965000527",
      rating: 4.4,
      reviewCount: 288,
      calendarId: "primary",
      businessProfileAccountId: "",
      businessProfileLocationId: ""
    },
    chatbot: {
      enabled: true,
      name: "CentralBot",
      tone: "cercano",
      greeting: "Hola, soy CentralBot. Te ayudo con categorias, ofertas, horario, ubicacion y stock.",
      quickPrompts: ["Consultar stock", "Ofertas", "Horario", "Como llegar"],
      handoffLabel: "Preguntar por WhatsApp",
      endpoint: ""
    }
  }
};

const themePalette = {
  aurora: {
    bg: "#fbf7ef",
    paper: "#fffaf0",
    ink: "#171513",
    muted: "#6d675e",
    accent2: "#0f8f8f"
  },
  carbon: {
    bg: "#11110f",
    paper: "#f7efe1",
    ink: "#f6efe4",
    muted: "#b9b0a4",
    accent2: "#f0b247"
  },
  editorial: {
    bg: "#f7f2e6",
    paper: "#fffdf6",
    ink: "#251f1a",
    muted: "#776b5d",
    accent2: "#2c7a7b"
  },
  neon: {
    bg: "#07080c",
    paper: "#10131d",
    ink: "#f8fbff",
    muted: "#aab4c5",
    accent2: "#23d5ab"
  },
  luxe: {
    bg: "#f8f6ee",
    paper: "#ffffff",
    ink: "#111316",
    muted: "#5c626a",
    accent2: "#0f8f8f"
  }
};

const designPacks = {
  boutique: {
    label: "Boutique",
    theme: "luxe",
    motion: "cinematic",
    typography: "editorial",
    contentDensity: "spacious",
    visualShape: "clean",
    accent: "#111316",
    intensity: 78,
    fontScale: 105,
    layoutScale: 108,
    heroSize: "immersive",
    contentWidth: "focused",
    imageRatio: "portrait",
    premiumEffects: true
  },
  impact: {
    label: "Impacto",
    theme: "neon",
    motion: "bold",
    typography: "modern",
    contentDensity: "compact",
    visualShape: "rounded",
    accent: "#ff3d81",
    intensity: 95,
    fontScale: 110,
    layoutScale: 96,
    heroSize: "immersive",
    contentWidth: "wide",
    imageRatio: "wide",
    premiumEffects: true
  },
  clear: {
    label: "Claro",
    theme: "aurora",
    motion: "soft",
    typography: "modern",
    contentDensity: "compact",
    visualShape: "sharp",
    accent: "#2f6fed",
    intensity: 52,
    fontScale: 95,
    layoutScale: 90,
    heroSize: "compact",
    contentWidth: "standard",
    imageRatio: "square",
    premiumEffects: false
  },
  commerce: {
    label: "Comercial",
    theme: "carbon",
    motion: "bold",
    typography: "compact",
    contentDensity: "compact",
    visualShape: "clean",
    accent: "#ff6a00",
    intensity: 88,
    fontScale: 100,
    layoutScale: 94,
    heroSize: "balanced",
    contentWidth: "wide",
    imageRatio: "wide",
    premiumEffects: true
  },
  mobileFirst: {
    label: "Mobile first",
    theme: "aurora",
    motion: "soft",
    typography: "compact",
    contentDensity: "compact",
    visualShape: "rounded",
    accent: "#0f8f8f",
    intensity: 60,
    fontScale: 100,
    layoutScale: 88,
    heroSize: "compact",
    contentWidth: "focused",
    imageRatio: "square",
    premiumEffects: false
  },
  localWarm: {
    label: "Local cercano",
    theme: "editorial",
    motion: "cinematic",
    typography: "editorial",
    contentDensity: "balanced",
    visualShape: "rounded",
    accent: "#cf3f2e",
    intensity: 72,
    fontScale: 102,
    layoutScale: 102,
    heroSize: "balanced",
    contentWidth: "standard",
    imageRatio: "portrait",
    premiumEffects: true
  }
};

const heroSizeMap = {
  compact: "min(620px, calc(100dvh - 68px))",
  balanced: "min(820px, calc(100dvh - 68px))",
  immersive: "min(940px, calc(100dvh - 68px))"
};

const contentWidthMap = {
  focused: 1040,
  standard: 1160,
  wide: 1320
};

const densityLayoutMap = {
  compact: {
    section: [42, 7, 94],
    gallery: [34, 6, 70],
    card: 178,
    feature: 132,
    testimonial: 188
  },
  balanced: {
    section: [56, 9, 128],
    gallery: [48, 8, 92],
    card: 220,
    feature: 154,
    testimonial: 230
  },
  spacious: {
    section: [72, 11, 152],
    gallery: [64, 9, 116],
    card: 248,
    feature: 182,
    testimonial: 260
  }
};

const form = document.querySelector("#businessForm");
const sitePreview = document.querySelector("#sitePreview");
const previewTitle = document.querySelector("#previewTitle");
const previewMetrics = document.querySelector("#previewMetrics");
const qualityScore = document.querySelector("#qualityScore");
const qualityChecklist = document.querySelector("#qualityChecklist");
const statusLine = document.querySelector("#statusLine");
const deviceFrame = document.querySelector(".device-frame");
const cursorGlow = document.querySelector(".cursor-glow");
const importDataInput = document.querySelector("#importDataInput");

let previewObserver;
let currentBusiness = cloneData(demoBusiness);
let currentBusinessRecord = null;
let quickHistory = [];
let quickFuture = [];
let renderFrame = 0;

init();

function init() {
  if (!form || !sitePreview || !previewTitle || !previewMetrics || !statusLine || !deviceFrame) {
    document.body.innerHTML = '<main class="boot-error"><h1>No se pudo iniciar LocalLift Studio</h1><p>Faltan elementos esenciales de la interfaz. Revisa index.html.</p></main>';
    return;
  }

  bindTabs();
  bindViewportButtons();
  bindPresetButtons();
  bindDesignPackButtons();
  bindQuickEditor();
  bindActions();
  bindCursor();
  fillForm(currentBusiness);
  syncSegmentedControls();
  syncDesignPackState();
  renderFromForm();
  form.addEventListener("input", (event) => {
    markCustomDesignPack(event.target);
    syncSegmentedControls();
    syncDesignPackState();
    syncQuickToggleState();
    scheduleRenderFromForm();
  });
  form.addEventListener("change", (event) => {
    markCustomDesignPack(event.target);
    syncSegmentedControls();
    syncDesignPackState();
    syncQuickToggleState();
    scheduleRenderFromForm();
  });
}

function scheduleRenderFromForm() {
  if (renderFrame) {
    cancelAnimationFrame(renderFrame);
  }

  renderFrame = requestAnimationFrame(() => {
    renderFrame = 0;
    renderFromForm();
  });
}

function bindTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach((item) => item.classList.remove("is-active"));
      document.querySelectorAll(".tab-panel").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      document.querySelector(`[data-panel="${button.dataset.tab}"]`).classList.add("is-active");
    });
  });
}

function bindViewportButtons() {
  document.querySelectorAll(".viewport-button").forEach((button) => {
    button.addEventListener("click", () => {
      setDeviceSize(button.dataset.size);
    });
  });
}

function setDeviceSize(size = "desktop") {
  document.querySelectorAll(".viewport-button").forEach((item) => {
    item.classList.toggle("is-active", item.dataset.size === size);
  });
  if (deviceFrame) {
    deviceFrame.dataset.size = size;
  }
}

function bindPresetButtons() {
  document.querySelectorAll(".preset-button").forEach((button) => {
    button.addEventListener("click", () => {
      const preset = sectorPresets[button.dataset.preset];

      if (!preset) {
        return;
      }

      document.querySelectorAll(".preset-button").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      currentBusinessRecord = null;
      storeApiRecord(null);
      currentBusiness = cloneData(preset);
      fillForm(currentBusiness);
      syncSegmentedControls();
      syncDesignPackState();
      syncQuickToggleState();
      renderFromForm();
      setStatus(`Demo cargada: ${currentBusiness.category}.`);
    });
  });
}

function bindDesignPackButtons() {
  document.querySelectorAll("[data-design-pack]").forEach((button) => {
    button.addEventListener("click", () => {
      applyDesignPack(button.dataset.designPack);
    });
  });
}

function applyDesignPack(packName) {
  const pack = designPacks[packName];

  if (!pack) {
    return;
  }

  runQuickMutation(() => {
    applyDesignPackValues(packName, pack);
  }, `Pack aplicado: ${pack.label}.`);

  if (packName === "mobileFirst") {
    setDeviceSize("mobile");
  }
}

function applyDesignPackValues(packName, pack) {
  setValue("designPack", packName);
  setRadioValue("theme", pack.theme);
  setRadioValue("motion", pack.motion);
  setRadioValue("typography", pack.typography);
  setRadioValue("contentDensity", pack.contentDensity);
  setRadioValue("visualShape", pack.visualShape);
  setRadioValue("heroSize", pack.heroSize);
  setRadioValue("contentWidth", pack.contentWidth);
  setRadioValue("imageRatio", pack.imageRatio);
  setValue("accent", pack.accent);
  setValue("intensity", pack.intensity);
  setValue("fontScale", pack.fontScale);
  setValue("layoutScale", pack.layoutScale);
  setChecked("premiumEffects", pack.premiumEffects);
}

function markCustomDesignPack(target) {
  if (!target?.name || target.name === "designPack") {
    return;
  }

  if (target.closest('[data-panel="style"]')) {
    setValue("designPack", "custom");
  }
}

function syncSegmentedControls() {
  document.querySelectorAll(".segmented-control label").forEach((label) => {
    const input = label.querySelector("input");
    label.classList.toggle("is-checked", Boolean(input?.checked));
  });
}

function syncDesignPackState() {
  const activePack = form.elements.designPack?.value || "custom";
  document.querySelectorAll("[data-design-pack]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.designPack === activePack);
  });
}

function syncQuickToggleState() {
  document.querySelectorAll("[data-toggle-field]").forEach((button) => {
    const field = form.elements[button.dataset.toggleField];
    button.classList.toggle("is-active", Boolean(field?.checked));
  });
}

function bindQuickEditor() {
  document.querySelectorAll("[data-quick-action]").forEach((button) => {
    button.addEventListener("click", () => {
      applyQuickAction(button.dataset.quickAction);
    });
  });

  document.querySelectorAll("[data-toggle-field]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleQuickField(button.dataset.toggleField);
    });
  });

  document.querySelector("#quickUndoButton")?.addEventListener("click", undoQuickChange);
  document.querySelector("#quickRedoButton")?.addEventListener("click", redoQuickChange);
  document.querySelector("#quickCommandButton")?.addEventListener("click", applyQuickCommand);
  document.querySelector("#quickCommandInput")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyQuickCommand();
    }
  });
}

function bindActions() {
  document.querySelector("#saveButton").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;

    try {
      currentBusiness = businessFromForm();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentBusiness));
      setStatus("Datos guardados en este navegador. Sincronizando API local...");

      try {
        const record = await saveBusinessToApi(currentBusiness);
        currentBusinessRecord = toApiRecordMeta(record);
        storeApiRecord(currentBusinessRecord);
        setStatus(`Guardado local y API: ${record.name}.`);
      } catch (apiError) {
        setStatus("Datos guardados en navegador. API local no disponible; levanta npm.cmd start para sincronizar.");
      }
    } catch (error) {
      setStatus("No se pudo guardar. Revisa permisos del navegador o espacio disponible.");
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("#loadButton").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;

    try {
      const storedRecord = getStoredApiRecord();

      if (storedRecord) {
        try {
          applyBusinessRecord(await fetchBusinessFromApi(storedRecord.id || storedRecord.slug));
          setStatus("Datos cargados desde la API local.");
          return;
        } catch (apiError) {
          // If the local API is offline, keep the existing browser fallback useful.
        }
      }

      const saved = localStorage.getItem(STORAGE_KEY);

      if (saved) {
        currentBusinessRecord = storedRecord;
        currentBusiness = normalizeImportedBusiness(JSON.parse(saved));
        fillForm(currentBusiness);
        syncSegmentedControls();
        syncDesignPackState();
        syncQuickToggleState();
        renderFromForm();
        setStatus("Datos cargados desde este navegador.");
        return;
      }

      try {
        applyBusinessRecord(await fetchFirstBusinessFromApi());
        setStatus("Demo cargada desde la API local.");
      } catch (apiError) {
        setStatus("No hay datos guardados todavia.");
      }
    } catch (error) {
      setStatus("No se pudieron cargar los datos guardados.");
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("#resetButton").addEventListener("click", () => {
    currentBusinessRecord = null;
    storeApiRecord(null);
    currentBusiness = cloneData(demoBusiness);
    fillForm(currentBusiness);
    syncSegmentedControls();
    syncDesignPackState();
    syncQuickToggleState();
    renderFromForm();
    setStatus("Demo restaurada.");
  });

  document.querySelector("#exportButton").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;

    try {
      currentBusiness = businessFromForm();
      setStatus("Preparando HTML con recursos premium incrustados...");
      await downloadSite(currentBusiness);
      setStatus("HTML exportado. Listo para subir a hosting.");
    } catch (error) {
      setStatus("No se pudo exportar el HTML. La vista previa sigue disponible para corregir datos.");
    } finally {
      button.disabled = false;
    }
  });

  document.querySelector("#exportDataButton")?.addEventListener("click", () => {
    try {
      currentBusiness = businessFromForm();
      downloadBusinessData(currentBusiness);
      setStatus("Datos exportados en JSON para reutilizar o versionar.");
    } catch (error) {
      setStatus("No se pudieron exportar los datos.");
    }
  });

  document.querySelector("#importDataButton")?.addEventListener("click", () => {
    importDataInput?.click();
  });

  importDataInput?.addEventListener("change", async () => {
    const [file] = importDataInput.files || [];

    if (!file) {
      return;
    }

    try {
      const imported = JSON.parse(await file.text());
      currentBusinessRecord = null;
      storeApiRecord(null);
      currentBusiness = normalizeImportedBusiness(imported);
      fillForm(currentBusiness);
      syncSegmentedControls();
      syncDesignPackState();
      syncQuickToggleState();
      renderFromForm();
      setStatus(`Datos importados: ${currentBusiness.name}.`);
    } catch (error) {
      setStatus("No se pudo importar el JSON. Revisa el formato.");
    } finally {
      importDataInput.value = "";
    }
  });
}

function bindCursor() {
  window.addEventListener("pointermove", (event) => {
    const x = `${Math.round((event.clientX / window.innerWidth) * 100)}%`;
    const y = `${Math.round((event.clientY / window.innerHeight) * 100)}%`;
    cursorGlow.style.setProperty("--cursor-x", x);
    cursorGlow.style.setProperty("--cursor-y", y);
  });
}

function fillForm(business) {
  const resolved = withBusinessDefaults(business);
  const chatbot = { ...demoBusiness.chatbot, ...(resolved.chatbot || {}) };
  const google = { ...demoBusiness.google, ...(resolved.google || {}) };
  const commerce = { ...demoBusiness.commerce, ...(resolved.commerce || {}) };
  setValue("name", resolved.name);
  setValue("category", resolved.category);
  setValue("location", resolved.location);
  setValue("tagline", resolved.tagline);
  setValue("description", resolved.description);
  setValue("conversionGoal", resolved.conversionGoal);
  setValue("announcement", resolved.announcement);
  setValue("phone", resolved.phone);
  setValue("email", resolved.email);
  setValue("address", resolved.address);
  setValue("services", resolved.services.join("\n"));
  setValue("features", resolved.features.join("\n"));
  setValue("hours", resolved.hours.join("\n"));
  setValue(
    "testimonials",
    resolved.testimonials.map((item) => `${item.name} | ${item.text}`).join("\n")
  );
  setValue("faqs", resolved.faqs.map((item) => `${item.question} | ${item.answer}`).join("\n"));
  setValue("trustBadges", resolved.trustBadges.join("\n"));
  setValue("heroImage", resolved.heroImage);
  setValue("gallery", resolved.gallery.join("\n"));
  setValue("links", resolved.links.map((item) => `${item.label} | ${item.url}`).join("\n"));
  setValue("servicesHeading", resolved.servicesHeading);
  setValue("servicesIntro", resolved.servicesIntro);
  setValue("trustHeading", resolved.trustHeading);
  setValue("trustIntro", resolved.trustIntro);
  setValue("contactHeading", resolved.contactHeading);
  setChecked("showLeadForm", resolved.showLeadForm);
  setValue("leadFormTitle", resolved.leadFormTitle);
  setValue("leadFormIntro", resolved.leadFormIntro);
  setValue("leadFormCta", resolved.leadFormCta);
  setValue("designPack", resolved.designPack);
  setValue("accent", resolved.accent);
  setValue("intensity", resolved.intensity);
  setValue("fontScale", resolved.fontScale);
  setValue("layoutScale", resolved.layoutScale);
  setValue("bookingUrl", resolved.bookingUrl);
  setValue("bookingLabel", resolved.bookingLabel);
  setChecked("premiumEffects", resolved.premiumEffects);
  setChecked("showBooking", resolved.showBooking);
  setRadio("theme", resolved.theme);
  setRadio("motion", resolved.motion);
  setRadio("typography", resolved.typography);
  setRadio("contentDensity", resolved.contentDensity);
  setRadio("visualShape", resolved.visualShape);
  setRadio("heroSize", resolved.heroSize);
  setRadio("contentWidth", resolved.contentWidth);
  setRadio("imageRatio", resolved.imageRatio);
  setChecked("showAnnouncement", resolved.showAnnouncement);
  setChecked("showResourceMarquee", resolved.showResourceMarquee);
  setChecked("showTrustRail", resolved.showTrustRail);
  setChecked("showGallery", resolved.showGallery);
  setChecked("showTestimonials", resolved.showTestimonials);
  setChecked("showFaq", resolved.showFaq);
  setChecked("showMap", resolved.showMap);
  setChecked("showConversionDock", resolved.showConversionDock);
  setChecked("googleEnabled", google.enabled);
  setValue("googleWorkspaceEmail", google.workspaceEmail);
  setValue("googleWorkspaceDomain", google.workspaceDomain);
  setValue("googleManagerEmail", google.managerEmail);
  setValue("googlePlaceId", google.placeId);
  setValue("googleMapsUrl", google.mapsUrl);
  setValue("mapEmbedUrl", google.mapEmbedUrl);
  setValue("directionsNote", google.directionsNote);
  setValue("googleReviewUrl", google.reviewUrl);
  setValue("googleReviewRequestTemplate", google.reviewRequestTemplate);
  setValue("googleAppointmentUrl", google.appointmentUrl);
  setValue("googleBookingRules", google.bookingRules);
  setValue("googleRating", google.rating);
  setValue("googleReviewCount", google.reviewCount);
  setValue("googleCalendarId", google.calendarId);
  setValue("googleBusinessProfileAccountId", google.businessProfileAccountId);
  setValue("googleBusinessProfileLocationId", google.businessProfileLocationId);
  setChecked("chatbotEnabled", chatbot.enabled);
  setValue("chatbotName", chatbot.name);
  setValue("chatbotHandoffLabel", chatbot.handoffLabel);
  setValue("chatbotGreeting", chatbot.greeting);
  setValue("chatbotQuickPrompts", chatbot.quickPrompts.join("\n"));
  setValue("chatbotEndpoint", chatbot.endpoint);
  setRadio("chatbotTone", chatbot.tone);
  setChecked("commerceEnabled", commerce.enabled);
  setValue("commerceTitle", commerce.title);
  setValue("commerceIntro", commerce.intro);
  setValue("commerceCurrency", commerce.currency);
  setValue("commerceOrderEmail", commerce.orderEmail);
  setValue("commerceCheckoutEndpoint", commerce.checkoutEndpoint);
  setValue("commerceProductsEndpoint", commerce.productsEndpoint);
  setValue("commerceSuccessUrl", commerce.successUrl);
  setValue("commerceCancelUrl", commerce.cancelUrl);
  setValue("commerceTermsUrl", commerce.termsUrl);
  setValue("commercePrivacyUrl", commerce.privacyUrl);
  setValue("commerceDeliveryMode", commerce.deliveryMode);
  setValue("commerceProducts", serializeProducts(commerce.products));
}

function setValue(name, value) {
  const field = form.elements[name];
  if (field) {
    field.value = value ?? "";
  }
}

function setChecked(name, value) {
  const field = form.elements[name];
  if (field && typeof field.checked === "boolean") {
    field.checked = Boolean(value);
  }
}

function setRadio(name, value) {
  const option = form.querySelector(`[name="${name}"][value="${value}"]`);

  if (option) {
    option.checked = true;
  }
}

function businessFromForm() {
  const data = new FormData(form);
  return {
    name: textOr(data.get("name"), demoBusiness.name),
    category: textOr(data.get("category"), "Negocio local"),
    location: textOr(data.get("location"), ""),
    tagline: textOr(data.get("tagline"), "Una experiencia local que merece verse online"),
    description: textOr(data.get("description"), ""),
    conversionGoal: textOr(data.get("conversionGoal"), ""),
    announcement: textOr(data.get("announcement"), ""),
    phone: textOr(data.get("phone"), ""),
    email: textOr(data.get("email"), ""),
    address: textOr(data.get("address"), ""),
    services: parseLines(data.get("services")).slice(0, 9),
    features: parseLines(data.get("features")).slice(0, 8),
    hours: parseLines(data.get("hours")).slice(0, 8),
    testimonials: parsePairs(data.get("testimonials"), "Cliente", "Una experiencia excelente").slice(0, 6)
      .map(([name, text]) => ({ name, text })),
    faqs: parsePairs(data.get("faqs"), "Pregunta", "Respuesta").slice(0, 8)
      .map(([question, answer]) => ({ question, answer })),
    trustBadges: parseLines(data.get("trustBadges")).slice(0, 6),
    links: parsePairs(data.get("links"), "Enlace", "#").slice(0, 8).map(([label, url]) => ({
      label,
      url: normalizeUrl(url)
    })),
    servicesHeading: textOr(data.get("servicesHeading"), demoBusiness.servicesHeading),
    servicesIntro: textOr(data.get("servicesIntro"), demoBusiness.servicesIntro),
    trustHeading: textOr(data.get("trustHeading"), demoBusiness.trustHeading),
    trustIntro: textOr(data.get("trustIntro"), demoBusiness.trustIntro),
    contactHeading: textOr(data.get("contactHeading"), demoBusiness.contactHeading),
    showLeadForm: data.get("showLeadForm") === "on",
    leadFormTitle: textOr(data.get("leadFormTitle"), demoBusiness.leadFormTitle),
    leadFormIntro: textOr(data.get("leadFormIntro"), demoBusiness.leadFormIntro),
    leadFormCta: textOr(data.get("leadFormCta"), demoBusiness.leadFormCta),
    designPack: textOr(data.get("designPack"), "custom"),
    heroImage: normalizeImage(data.get("heroImage"), demoBusiness.heroImage),
    gallery: parseLines(data.get("gallery"))
      .map((url) => normalizeImage(url, ""))
      .filter(Boolean)
      .slice(0, 12),
    theme: textOr(data.get("theme"), "aurora"),
    motion: textOr(data.get("motion"), "cinematic"),
    typography: textOr(data.get("typography"), "modern"),
    contentDensity: textOr(data.get("contentDensity"), "balanced"),
    visualShape: textOr(data.get("visualShape"), "clean"),
    heroSize: textOr(data.get("heroSize"), "balanced"),
    contentWidth: textOr(data.get("contentWidth"), "standard"),
    imageRatio: textOr(data.get("imageRatio"), "portrait"),
    fontScale: Number(data.get("fontScale") || 100),
    layoutScale: Number(data.get("layoutScale") || 100),
    showAnnouncement: data.get("showAnnouncement") === "on",
    showResourceMarquee: data.get("showResourceMarquee") === "on",
    showTrustRail: data.get("showTrustRail") === "on",
    showGallery: data.get("showGallery") === "on",
    showTestimonials: data.get("showTestimonials") === "on",
    showFaq: data.get("showFaq") === "on",
    showMap: data.get("showMap") === "on",
    showConversionDock: data.get("showConversionDock") === "on",
    accent: textOr(data.get("accent"), "#cf3f2e"),
    intensity: Number(data.get("intensity") || 78),
    premiumEffects: data.get("premiumEffects") === "on",
    showBooking: data.get("showBooking") === "on",
    bookingUrl: normalizeUrl(data.get("bookingUrl") || "#contacto"),
    bookingLabel: textOr(data.get("bookingLabel"), demoBusiness.bookingLabel),
    google: {
      enabled: data.get("googleEnabled") === "on",
      workspaceEmail: textOr(data.get("googleWorkspaceEmail"), ""),
      workspaceDomain: textOr(data.get("googleWorkspaceDomain"), ""),
      managerEmail: textOr(data.get("googleManagerEmail"), ""),
      placeId: textOr(data.get("googlePlaceId"), ""),
      mapsUrl: normalizeOptionalUrl(data.get("googleMapsUrl")),
      mapEmbedUrl: normalizeOptionalUrl(data.get("mapEmbedUrl")),
      directionsNote: textOr(data.get("directionsNote"), ""),
      reviewUrl: normalizeOptionalUrl(data.get("googleReviewUrl")),
      reviewRequestTemplate: textOr(data.get("googleReviewRequestTemplate"), ""),
      appointmentUrl: normalizeOptionalUrl(data.get("googleAppointmentUrl")),
      bookingRules: textOr(data.get("googleBookingRules"), ""),
      rating: numberOr(data.get("googleRating"), 0),
      reviewCount: numberOr(data.get("googleReviewCount"), 0),
      calendarId: textOr(data.get("googleCalendarId"), ""),
      businessProfileAccountId: textOr(data.get("googleBusinessProfileAccountId"), ""),
      businessProfileLocationId: textOr(data.get("googleBusinessProfileLocationId"), "")
    },
    chatbot: {
      enabled: data.get("chatbotEnabled") === "on",
      name: textOr(data.get("chatbotName"), `${textOr(data.get("name"), demoBusiness.name)}Bot`),
      tone: textOr(data.get("chatbotTone"), "cercano"),
      greeting: textOr(
        data.get("chatbotGreeting"),
        "Hola. Te ayudo con horarios, reservas, ubicacion, servicios y contacto."
      ),
      quickPrompts: parseLines(data.get("chatbotQuickPrompts")).slice(0, 6),
      handoffLabel: textOr(data.get("chatbotHandoffLabel"), "Hablar con el negocio"),
      endpoint: normalizeOptionalUrl(data.get("chatbotEndpoint"))
    },
    commerce: {
      enabled: data.get("commerceEnabled") === "on",
      title: textOr(data.get("commerceTitle"), demoBusiness.commerce.title),
      intro: textOr(data.get("commerceIntro"), demoBusiness.commerce.intro),
      currency: normalizeCurrency(data.get("commerceCurrency")),
      orderEmail: textOr(data.get("commerceOrderEmail"), textOr(data.get("email"), "")),
      checkoutEndpoint: normalizeOptionalUrl(data.get("commerceCheckoutEndpoint")),
      productsEndpoint: normalizeOptionalUrl(data.get("commerceProductsEndpoint")),
      successUrl: normalizeOptionalUrl(data.get("commerceSuccessUrl")),
      cancelUrl: normalizeOptionalUrl(data.get("commerceCancelUrl")),
      termsUrl: normalizeOptionalUrl(data.get("commerceTermsUrl")),
      privacyUrl: normalizeOptionalUrl(data.get("commercePrivacyUrl")),
      deliveryMode: textOr(data.get("commerceDeliveryMode"), demoBusiness.commerce.deliveryMode),
      products: parseProducts(data.get("commerceProducts")).slice(0, 24)
    }
  };
}

function renderFromForm() {
  try {
    currentBusiness = businessFromForm();
    previewTitle.textContent = currentBusiness.name;
    renderPreviewMetrics(currentBusiness);
    renderQualityPanel(currentBusiness);
    sitePreview.innerHTML = renderSite(currentBusiness);
    attachGeneratedInteractions(sitePreview, currentBusiness);
    syncQuickToggleState();
  } catch (error) {
    if (previewObserver) {
      previewObserver.disconnect();
    }

    sitePreview.innerHTML = renderPreviewError(error);
    sitePreview.querySelector("[data-preview-reset]")?.addEventListener("click", () => {
      currentBusiness = cloneData(demoBusiness);
      fillForm(currentBusiness);
      syncSegmentedControls();
      syncDesignPackState();
      syncQuickToggleState();
      renderFromForm();
      setStatus("Demo segura restaurada.");
    });
    setStatus("La vista previa encontro un dato incompatible. Revisa los campos recientes.");
  }
}

function renderPreviewError(error) {
  const message = error?.message || "Error desconocido";

  return `
    <section class="preview-error" role="alert">
      <h2>No se pudo pintar la vista previa</h2>
      <p>${escapeHtml(message)}</p>
      <button type="button" data-preview-reset>Restaurar demo segura</button>
    </section>
  `;
}

function renderPreviewMetrics(business) {
  const score = calculateConversionScore(business);
  const channels = [
    business.phone,
    business.email,
    business.bookingUrl && business.bookingUrl !== "#contacto",
    business.links.length,
    business.showLeadForm,
    business.chatbot?.enabled,
    business.commerce?.enabled
  ].filter(Boolean).length;
  const assets = business.gallery.length + (business.heroImage ? 1 : 0) + (business.commerce?.products?.length || 0);

  previewMetrics.innerHTML = [
    renderMetricChip(score, "score"),
    renderMetricChip(channels, "canales"),
    renderMetricChip(assets, "assets")
  ].join("");
}

function applyQuickCommand() {
  const input = document.querySelector("#quickCommandInput");
  const command = normalizeText(input?.value || "");

  if (!command) {
    setStatus("Escribe un comando rapido: mas premium, vender reservas, sin mapa...");
    return;
  }

  const actions = [];

  if (matchesAny(command, ["premium", "lujo", "elegante", "caro"])) actions.push("premium");
  if (matchesAny(command, ["limpio", "minimal", "simple", "sobrio"])) actions.push("minimal");
  if (matchesAny(command, ["urgencia", "urgente", "oferta", "promocion"])) actions.push("urgent");
  if (matchesAny(command, ["confianza", "resena", "resenas", "opiniones", "google"])) actions.push("trust");
  if (matchesAny(command, ["reserva", "reservas", "cita", "agenda"])) actions.push("booking");
  if (matchesAny(command, ["pedido", "pedidos", "delivery", "comida", "whatsapp"])) actions.push("food");
  if (matchesAny(command, ["tienda", "compras", "compra online", "productos", "pagar", "stripe", "ecommerce"])) actions.push("store");
  if (matchesAny(command, ["local", "barrio", "cerca", "zona"])) actions.push("local");
  if (matchesAny(command, ["movil", "telefono", "mobile", "compacto"])) actions.push("mobile");
  if (matchesAny(command, ["letra grande", "texto grande", "mas grande", "fuente grande"])) actions.push("biggerType");
  if (matchesAny(command, ["mas aire", "mas espacio", "amplio", "dimensiones grandes"])) actions.push("moreSpace");
  if (matchesAny(command, ["fotos anchas", "imagenes anchas", "panoramico", "horizontal"])) actions.push("wideImages");

  if (matchesAny(command, ["sin mapa", "quitar mapa", "ocultar mapa"])) actions.push("hideMap");
  if (matchesAny(command, ["sin bot", "quitar bot", "ocultar bot"])) actions.push("hideBot");
  if (matchesAny(command, ["sin galeria", "quitar fotos", "menos fotos"])) actions.push("hideGallery");
  if (matchesAny(command, ["mostrar todo", "activar todo", "todo visible"])) actions.push("showAll");

  if (!actions.length) {
    setStatus("No entendi el comando. Prueba: mas premium, vender reservas, sin mapa, mostrar todo.");
    return;
  }

  runQuickMutation(() => {
    actions.forEach((action) => mutateQuickAction(action));
  }, `Comando aplicado: ${input.value}`);
  input.value = "";
}

function applyQuickAction(action) {
  runQuickMutation(() => mutateQuickAction(action), quickActionLabel(action));
}

function mutateQuickAction(action) {
  const business = businessFromForm();
  const name = business.name || "tu negocio";
  const category = business.category || "negocio local";
  const location = business.location || "tu zona";

  const actions = {
    premium: () => {
      setValue("designPack", "custom");
      setRadioValue("theme", "luxe");
      setRadioValue("typography", "editorial");
      setRadioValue("motion", "cinematic");
      setRadioValue("visualShape", "clean");
      setRadioValue("contentDensity", "spacious");
      setValue("accent", "#111316");
      setValue("intensity", 82);
      setChecked("premiumEffects", true);
      setValue("tagline", `${name}: una experiencia local con presencia de marca premium`);
      setValue("servicesHeading", "Una propuesta cuidada desde el primer vistazo.");
      setValue("trustHeading", "La confianza se nota antes de llamar.");
    },
    minimal: () => {
      setValue("designPack", "custom");
      setRadioValue("theme", "aurora");
      setRadioValue("typography", "modern");
      setRadioValue("motion", "soft");
      setRadioValue("visualShape", "sharp");
      setRadioValue("contentDensity", "compact");
      setValue("intensity", 50);
      setChecked("premiumEffects", false);
      setValue("servicesHeading", "Todo lo importante, sin ruido.");
      setValue("servicesIntro", "Servicios, horario, ubicacion y contacto quedan claros para decidir rapido.");
    },
    urgent: () => {
      setChecked("showAnnouncement", true);
      setValue("announcement", `Plazas y horarios limitados esta semana en ${name}.`);
      setValue("bookingLabel", "Reservar hoy");
      setValue("leadFormCta", "Quiero respuesta rapida");
      setValue("conversionGoal", `Generar solicitudes inmediatas para ${category} en ${location}`);
      setChecked("showLeadForm", true);
      setChecked("showConversionDock", true);
    },
    trust: () => {
      setChecked("showTrustRail", true);
      setChecked("showTestimonials", true);
      setChecked("showFaq", true);
      setChecked("googleEnabled", true);
      setValue("trustHeading", "Confianza clara antes de decidir.");
      setValue("trustIntro", "Opiniones, preguntas frecuentes y datos de contacto reducen dudas y acercan al cliente al siguiente paso.");
      setValue("trustBadges", [
        "Resenas y prueba social visibles",
        "Contacto directo y respuesta rapida",
        "Ubicacion verificada en mapa",
        "FAQ preparada para resolver dudas"
      ].join("\n"));
    },
    booking: () => {
      setChecked("showBooking", true);
      setChecked("showLeadForm", true);
      setChecked("showConversionDock", true);
      setValue("bookingLabel", "Reservar / pedir cita");
      setValue("conversionGoal", `Convertir visitas en reservas para ${name}`);
      setValue("leadFormTitle", "Pide disponibilidad sin llamadas innecesarias.");
      setValue("leadFormIntro", "Deja fecha, servicio y contacto. El negocio recibe una solicitud preparada para responder rapido.");
      setValue("leadFormCta", "Consultar disponibilidad");
    },
    food: () => {
      setValue("designPack", "custom");
      setRadioValue("theme", "neon");
      setRadioValue("motion", "bold");
      setRadioValue("contentDensity", "compact");
      setValue("accent", "#ff6a00");
      setValue("bookingLabel", "Pedir ahora");
      setValue("announcement", "Pide por WhatsApp y recoge sin esperas.");
      setChecked("showAnnouncement", true);
      setChecked("showConversionDock", true);
      setChecked("commerceEnabled", true);
      setValue("servicesHeading", "Menu claro para decidir rapido.");
      setValue("conversionGoal", `Pedidos, recogida y llamadas para ${name}`);
    },
    store: () => {
      setChecked("commerceEnabled", true);
      setChecked("showConversionDock", true);
      setValue("commerceTitle", "Compra online");
      setValue(
        "commerceIntro",
        "Productos con carrito, checkout seguro con Stripe y pedido registrado para seguimiento."
      );
      setValue("commerceOrderEmail", business.email || demoBusiness.commerce.orderEmail);
      if (!form.elements.commerceProducts.value.trim()) {
        setValue("commerceProducts", serializeProducts(demoBusiness.commerce.products));
      }
      setValue("conversionGoal", `Vender productos online para ${name}`);
      setValue("announcement", "Compra online activa con pago seguro.");
      setChecked("showAnnouncement", true);
    },
    local: () => {
      setChecked("showMap", true);
      setChecked("googleEnabled", true);
      setValue("servicesIntro", `Una web pensada para que clientes de ${location} entiendan rapido que ofrece ${name}, como llegar y como contactar.`);
      setValue("directionsNote", `Ubicacion visible para llegar rapido desde ${location}, consultar ruta y evitar dudas antes de visitar.`);
      setValue("contactHeading", "Ven al local o escribe antes de pasar.");
    },
    mobile: () => {
      setRadioValue("contentDensity", "compact");
      setRadioValue("visualShape", "rounded");
      setRadioValue("heroSize", "compact");
      setRadioValue("contentWidth", "focused");
      setRadioValue("imageRatio", "square");
      setValue("fontScale", 100);
      setValue("layoutScale", 88);
      setChecked("showConversionDock", true);
      setChecked("showLeadForm", true);
      setValue("bookingLabel", "Contactar ahora");
      setDeviceSize("mobile");
    },
    biggerType: () => {
      setValue("designPack", "custom");
      setValue("fontScale", Math.min(120, numberOr(form.elements.fontScale.value, 100) + 10));
      setRadioValue("typography", "modern");
      setValue("intensity", Math.max(60, numberOr(form.elements.intensity.value, 78)));
    },
    moreSpace: () => {
      setValue("designPack", "custom");
      setRadioValue("contentDensity", "spacious");
      setRadioValue("heroSize", "immersive");
      setRadioValue("contentWidth", "wide");
      setValue("layoutScale", Math.min(120, numberOr(form.elements.layoutScale.value, 100) + 10));
    },
    wideImages: () => {
      setValue("designPack", "custom");
      setChecked("showGallery", true);
      setRadioValue("imageRatio", "wide");
      setRadioValue("contentWidth", "wide");
      setRadioValue("heroSize", "balanced");
    },
    hideMap: () => setChecked("showMap", false),
    hideBot: () => setChecked("chatbotEnabled", false),
    hideGallery: () => setChecked("showGallery", false),
    showAll: () => {
      [
        "showAnnouncement",
        "showResourceMarquee",
        "showTrustRail",
        "showGallery",
        "showTestimonials",
        "showFaq",
        "showMap",
        "showLeadForm",
        "chatbotEnabled",
        "commerceEnabled",
        "showConversionDock"
      ].forEach((field) => setChecked(field, true));
      if (!form.elements.announcement.value.trim()) {
        setValue("announcement", `Nueva version de ${name} lista para recibir clientes.`);
      }
    }
  };

  actions[action]?.();
}

function toggleQuickField(fieldName) {
  const field = form.elements[fieldName];

  if (!field || typeof field.checked !== "boolean") {
    return;
  }

  runQuickMutation(() => {
    field.checked = !field.checked;
    if (fieldName === "showAnnouncement" && field.checked && !form.elements.announcement.value.trim()) {
      setValue("announcement", `Nueva version de ${form.elements.name.value || "tu negocio"} lista para recibir clientes.`);
    }
    if (fieldName === "showMap" && field.checked) {
      setChecked("googleEnabled", true);
    }
    if (fieldName === "commerceEnabled" && field.checked && !form.elements.commerceProducts.value.trim()) {
      setValue("commerceProducts", serializeProducts(demoBusiness.commerce.products));
    }
  }, `${field.checked ? "Ocultado" : "Activado"}: ${quickToggleLabel(fieldName)}`);
}

function runQuickMutation(mutator, label) {
  quickHistory.push(cloneData(businessFromForm()));
  quickFuture = [];
  mutator();
  syncSegmentedControls();
  syncDesignPackState();
  syncQuickToggleState();
  renderFromForm();
  setStatus(label);
}

function undoQuickChange() {
  if (!quickHistory.length) {
    setStatus("No hay cambios rapidos que deshacer.");
    return;
  }

  quickFuture.push(cloneData(businessFromForm()));
  restoreQuickSnapshot(quickHistory.pop(), "Cambio deshecho.");
}

function redoQuickChange() {
  if (!quickFuture.length) {
    setStatus("No hay cambios rapidos que rehacer.");
    return;
  }

  quickHistory.push(cloneData(businessFromForm()));
  restoreQuickSnapshot(quickFuture.pop(), "Cambio rehecho.");
}

function restoreQuickSnapshot(snapshot, message) {
  currentBusiness = withBusinessDefaults(snapshot);
  fillForm(currentBusiness);
  syncSegmentedControls();
  syncDesignPackState();
  syncQuickToggleState();
  renderFromForm();
  setStatus(message);
}

function setRadioValue(name, value) {
  setRadio(name, value);
}

function quickActionLabel(action) {
  return {
    premium: "Variante aplicada: mas premium.",
    minimal: "Variante aplicada: mas limpia.",
    urgent: "Variante aplicada: mas urgencia comercial.",
    trust: "Variante aplicada: mas confianza.",
    booking: "Variante aplicada: vender reservas.",
    food: "Variante aplicada: pedidos rapidos.",
    local: "Variante aplicada: mas local y mapa.",
    mobile: "Variante aplicada: modo movil.",
    biggerType: "Variante aplicada: letras mas grandes.",
    moreSpace: "Variante aplicada: mas aire y dimensiones amplias.",
    wideImages: "Variante aplicada: fotos panoramicas.",
    hideMap: "Mapa ocultado.",
    hideBot: "Bot ocultado.",
    hideGallery: "Galeria ocultada.",
    store: "Variante aplicada: tienda online.",
    showAll: "Todas las secciones clave activadas."
  }[action] || "Cambio rapido aplicado.";
}

function quickToggleLabel(fieldName) {
  return {
    showAnnouncement: "Anuncio",
    showResourceMarquee: "Beneficios",
    showTrustRail: "Confianza",
    showGallery: "Galeria",
    showTestimonials: "Resenas",
    showFaq: "FAQ",
    showMap: "Mapa",
    showLeadForm: "Lead",
    chatbotEnabled: "Bot",
    commerceEnabled: "Tienda",
    showConversionDock: "Dock"
  }[fieldName] || fieldName;
}

function renderMetricChip(value, label) {
  return `<div class="metric-chip"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function calculateConversionScore(business) {
  const checks = [
    business.name,
    business.category,
    business.description,
    business.conversionGoal,
    business.phone || business.email,
    business.address || business.location,
    business.bookingUrl && business.bookingUrl !== "#contacto",
    business.services.length >= 3,
    business.gallery.length >= 3,
    business.faqs.length >= 2,
    business.trustBadges.length >= 2,
    business.testimonials.length >= 2,
    business.showLeadForm,
    business.chatbot?.enabled,
    ...(business.commerce?.enabled ? [business.commerce?.products?.length >= 1 && business.commerce?.checkoutEndpoint] : [])
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function renderQualityPanel(business) {
  if (!qualityScore || !qualityChecklist) {
    return;
  }

  const checks = getQualityChecks(business);
  const score = Math.round((checks.filter((item) => item.done).length / checks.length) * 100);
  qualityScore.textContent = `${score}%`;
  qualityChecklist.innerHTML = checks
    .map((item) => `<span class="quality-item ${item.done ? "is-done" : ""}">${escapeHtml(item.label)}</span>`)
    .join("");
}

function getQualityChecks(business) {
  const checks = [
    { label: "Marca, categoria y ciudad definidas", done: Boolean(business.name && business.category && business.location) },
    { label: "Objetivo de conversion claro", done: Boolean(business.conversionGoal) },
    { label: "CTA principal con enlace real", done: Boolean(business.bookingUrl && business.bookingUrl !== "#contacto") },
    { label: "Minimo 3 servicios y 3 fotos", done: business.services.length >= 3 && business.gallery.length >= 3 },
    { label: "Prueba social y confianza visibles", done: business.testimonials.length >= 2 && business.trustBadges.length >= 2 },
    { label: "FAQ preparada para reducir llamadas", done: business.faqs.length >= 2 },
    { label: "Mapa, ruta o resenas conectables", done: Boolean(business.google?.enabled && (business.google.mapsUrl || business.google.mapEmbedUrl || business.google.reviewUrl)) },
    { label: "Chatbot o formulario de lead activo", done: Boolean(business.chatbot?.enabled || business.showLeadForm) }
  ];

  if (business.commerce?.enabled) {
    checks.push({
      label: "Tienda online lista para checkout",
      done: Boolean(business.commerce?.checkoutEndpoint && business.commerce?.products?.length)
    });
  }

  return checks;
}

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

function renderSite(business) {
  business = withBusinessDefaults(business);
  const palette = themePalette[business.theme] || themePalette.aurora;
  const gallery = business.gallery.length ? business.gallery : demoBusiness.gallery;
  const services = business.services.length ? business.services : demoBusiness.services;
  const features = business.features.length ? business.features : demoBusiness.features;
  const testimonials = business.testimonials.length ? business.testimonials : demoBusiness.testimonials;
  const faqs = business.faqs.length ? business.faqs : demoBusiness.faqs;
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
  const trustBadges = business.trustBadges.length ? business.trustBadges : buildTrustBadges(business, google);
  const styleVars = [
    `--site-accent:${escapeAttr(business.accent)}`,
    `--site-accent-2:${palette.accent2}`,
    `--site-bg:${palette.bg}`,
    `--site-paper:${palette.paper}`,
    `--site-ink:${palette.ink}`,
    `--site-muted:${palette.muted}`,
    `--site-intensity:${business.intensity}`,
    `--site-glow-opacity:${Math.min(0.88, Math.max(0.24, business.intensity / 130)).toFixed(2)}`,
    `--site-spotlight-opacity:${Math.min(0.78, Math.max(0.18, business.intensity / 150)).toFixed(2)}`,
    ...getPersonalizationStyleVars(business)
  ].join(";");
  const bookingButton = business.showBooking
    ? `<a class="site-cta magnetic" href="${escapeAttr(business.bookingUrl)}" data-track="booking_click">${escapeHtml(bookingLabel)}</a>`
    : "";
  const resourcePills = buildResourcePills(business, services, links);

  return `
    <article class="generated-site theme-${escapeAttr(business.theme)} motion-${escapeAttr(business.motion)} typography-${escapeAttr(business.typography)} density-${escapeAttr(business.contentDensity)} shape-${escapeAttr(business.visualShape)} image-ratio-${escapeAttr(business.imageRatio)}" style="${styleVars}" data-premium-effects="${business.premiumEffects}">
      ${business.premiumEffects ? '<div class="cursor-spotlight" aria-hidden="true"></div>' : ""}
      <div class="site-progress" aria-hidden="true"></div>
      ${business.showAnnouncement && business.announcement ? `<div class="site-announcement">${escapeHtml(business.announcement)}</div>` : ""}
      <nav class="site-nav">
        <a class="site-logo" href="#inicio" aria-label="${escapeAttr(business.name)}">
          <span class="site-logo-mark">${escapeHtml(initials(business.name))}</span>
          <span>${escapeHtml(business.name)}</span>
        </a>
        <div class="site-nav-links">
          <a href="#servicios">Servicios</a>
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
          <img src="${escapeAttr(heroImage)}" alt="${escapeAttr(business.name)}" loading="eager" fetchpriority="high" decoding="async" sizes="100vw">
        </picture>
        <div class="hero-atmosphere" aria-hidden="true">
          <span class="mesh-field"></span>
          <span class="mesh-field"></span>
          <span class="mesh-field"></span>
        </div>
        <div class="hero-content">
          <span class="hero-kicker reveal">${escapeHtml(categoryLine || business.category)}</span>
          <h1 class="reveal kinetic-title" data-splitting>${escapeHtml(business.tagline || business.name)}</h1>
          <p class="reveal">${escapeHtml(business.description)}</p>
          <div class="hero-actions reveal">
            ${bookingButton}
            <a class="ghost-link magnetic" href="#contacto">Ver contacto</a>
          </div>
          <div class="hero-conversion reveal" aria-label="Resumen de conversion">
            <span>${escapeHtml(business.conversionGoal)}</span>
            ${google.enabled && google.rating ? `<strong>${escapeHtml(Number(google.rating).toFixed(1))}/5 Google</strong>` : `<strong>${escapeHtml(services.length)} servicios</strong>`}
          </div>
        </div>
      </header>

      <section class="proof-strip" aria-label="Datos destacados">
        <div class="proof-item reveal">
          <span class="proof-number">${services.length}</span>
          <span class="proof-label">servicios preparados para convertir visitas en clientes</span>
        </div>
        <div class="proof-item reveal">
          <span class="proof-number">${gallery.length}</span>
          <span class="proof-label">imagenes para mostrar producto, local y experiencia</span>
        </div>
        <div class="proof-item reveal">
          <span class="proof-number">24/7</span>
          <span class="proof-label">presencia digital lista para reservas, mapas y redes</span>
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

      <section class="site-section" id="servicios">
        <div class="section-inner">
          <div class="section-heading">
            <h2 class="reveal kinetic-title" data-splitting>${escapeHtml(servicesHeading)}</h2>
            <p class="reveal">${escapeHtml(servicesIntro)}</p>
          </div>
          <div class="services-grid">
            ${services.map((service, index) => renderServiceCard(service, index)).join("")}
          </div>
        </div>
      </section>

      ${commerce.enabled ? renderStoreSection(business, commerce) : ""}

      ${business.showGallery ? `<section class="gallery-band" id="galeria" aria-label="Galeria de fotos">
        <div class="gallery-track">
          ${[...gallery, ...gallery].map((image, index) => renderGalleryItem(image, index % gallery.length, business.name, index >= gallery.length)).join("")}
        </div>
      </section>` : ""}

      <section class="site-section">
        <div class="section-inner split-section">
          <div class="image-panel parallax-media reveal">
            <img src="${escapeAttr(gallery[0] || heroImage)}" alt="${escapeAttr(`${business.name} destacado`)}" loading="lazy" decoding="async" sizes="(max-width: 760px) calc(100vw - 28px), 44vw">
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
      </section>

      ${business.showTestimonials ? `<section class="site-section">
        <div class="section-inner">
          <div class="section-heading">
            <h2 class="reveal kinetic-title" data-splitting>${escapeHtml(trustHeading)}</h2>
            <p class="reveal">${escapeHtml(trustIntro)}</p>
          </div>
          <div class="testimonial-grid">
            ${testimonials.map((testimonial) => renderTestimonial(testimonial)).join("")}
          </div>
        </div>
      </section>` : ""}

      ${business.showFaq ? `<section class="site-section">
        <div class="section-inner">
          <div class="section-heading">
            <h2 class="reveal kinetic-title" data-splitting>Preguntas que venden por ti.</h2>
            <p class="reveal">Cada respuesta evita mensajes repetidos y acerca al cliente al siguiente paso.</p>
          </div>
          <div class="faq-list">
            ${faqs.map((faq) => renderFaq(faq)).join("")}
          </div>
        </div>
      </section>` : ""}

      ${business.showMap ? renderLocationSection(business, google) : ""}

      ${business.showBooking ? renderBookingSection(business, services) : ""}

      ${business.showLeadForm ? renderLeadSection(business) : ""}

      <section class="site-section contact-section" id="contacto">
        <div class="section-inner contact-panel reveal">
          <div>
            <h2>${escapeHtml(contactHeading)}</h2>
            <p>${escapeHtml(business.address || business.location || "Direccion pendiente de confirmar.")}</p>
            <div class="contact-links">
              ${business.phone ? `<a href="tel:${escapeAttr(phoneHref(business.phone))}" data-track="phone_click">Llamar</a>` : ""}
              ${business.email ? `<a href="mailto:${escapeAttr(business.email)}" data-track="email_click">Email</a>` : ""}
              ${google.enabled && google.mapsUrl ? `<a href="${escapeAttr(google.mapsUrl)}" target="_blank" rel="noreferrer" data-track="google_maps_click">Mapa</a>` : ""}
              ${google.enabled && google.reviewUrl ? `<a href="${escapeAttr(google.reviewUrl)}" target="_blank" rel="noreferrer" data-track="google_review_click">Dejar resena</a>` : ""}
              ${bookingButton}
            </div>
          </div>
          <div>
            <p>${escapeHtml(business.description)}</p>
            <div class="social-links">
              ${links.map((link) => `<a href="${escapeAttr(link.url)}" target="_blank" rel="noreferrer" data-track="outbound_${escapeAttr(slugify(link.label))}">${escapeHtml(link.label)}</a>`).join("")}
            </div>
          </div>
        </div>
      </section>

      <footer class="site-footer">
        <span>${escapeHtml(business.name)} - ${escapeHtml(business.location || "Negocio local")}</span>
        <span>Web generada con LocalLift Studio</span>
      </footer>
      ${business.showConversionDock ? renderConversionDock(business, google) : ""}
      ${renderChatbotWidget(business, { services, features, hours, faqs, links, chatbot, google, commerce })}
    </article>
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
    <section class="site-section store-section" id="tienda" data-store data-store-context="${escapeAttr(JSON.stringify(context))}">
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
      <h3>${escapeHtml(parts.title)}</h3>
      <p>${escapeHtml(parts.body)}</p>
    </article>
  `;
}

function renderFeatureCard(feature, index) {
  const parts = splitTitleBody(feature);
  return `
    <article class="feature-card reveal tilt-card">
      <span class="card-index">${String.fromCharCode(65 + index)}</span>
      <h3>${escapeHtml(parts.title)}</h3>
      <p>${escapeHtml(parts.body)}</p>
    </article>
  `;
}

function renderGalleryItem(image, index, name, isClone = false) {
  const cloneClass = isClone ? " is-gallery-clone" : "";
  const ariaHidden = isClone ? ' aria-hidden="true"' : "";
  const alt = isClone ? "" : `${name} foto ${index + 1}`;

  return `
    <figure class="gallery-item${cloneClass}"${ariaHidden}>
      <img src="${escapeAttr(image)}" alt="${escapeAttr(alt)}" loading="lazy" decoding="async" sizes="(max-width: 760px) 82vw, 32vw">
    </figure>
  `;
}

function renderTestimonial(testimonial) {
  return `
    <article class="testimonial-card reveal tilt-card">
      <span class="quote-mark">"</span>
      <p>${escapeHtml(testimonial.text)}</p>
      <strong class="testimonial-author">${escapeHtml(testimonial.name)}</strong>
    </article>
  `;
}

function renderFaq(faq) {
  return `
    <details class="faq-item reveal">
      <summary>${escapeHtml(faq.question)}</summary>
      <p>${escapeHtml(faq.answer)}</p>
    </details>
  `;
}

function renderLeadSection(business) {
  const leadEndpoint = getPublicLeadEndpoint(business);

  return `
    <section class="site-section lead-section" id="lead">
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
    <section class="site-section lead-section booking-section" id="reservas">
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
          <button type="submit">Solicitar reserva</button>
          <span class="lead-status" data-booking-status aria-live="polite"></span>
        </form>
      </div>
    </section>
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
    <section class="site-section location-section" id="ubicacion">
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

function runSplitting(container) {
  if (typeof window.Splitting !== "function") {
    return;
  }

  try {
    window.Splitting({
      target: container.querySelectorAll("[data-splitting]")
    });
  } catch (error) {
    container.querySelectorAll("[data-splitting]").forEach((item) => item.removeAttribute("data-splitting"));
  }
}

function runVanillaTilt(container, business) {
  if (typeof window.VanillaTilt !== "function" || !business.premiumEffects) {
    return;
  }

  try {
    window.VanillaTilt.init(container.querySelectorAll(".tilt-card"), {
      max: Math.max(4, Math.min(12, business.intensity / 8)),
      speed: 650,
      glare: true,
      "max-glare": 0.18,
      scale: 1.01,
      gyroscope: false
    });
  } catch (error) {
    // Vendor effects are optional; the site remains fully usable without tilt.
  }
}

function updateScrollProgress(container, root) {
  if (!root) {
    return;
  }

  const max = container.scrollHeight - container.clientHeight;
  const progress = max > 0 ? container.scrollTop / max : 0;
  root.style.setProperty("--scroll-progress", progress.toFixed(4));
}

function attachChatbot(container) {
  const widget = container.querySelector(".chatbot-widget");

  if (!widget) {
    return;
  }

  const context = readChatbotContext(widget);
  const messages = widget.querySelector("[data-chatbot-messages]");
  const form = widget.querySelector("[data-chatbot-form]");
  const input = form?.elements.message;
  const history = [];

  widget.querySelector(".chatbot-launcher")?.addEventListener("click", () => {
    widget.classList.add("is-open");
    widget.querySelector(".chatbot-launcher")?.setAttribute("aria-expanded", "true");
    trackLocalLiftEvent("chatbot_open", { business: context.business?.name || "" });
    input?.focus();
  });

  widget.querySelector(".chatbot-close")?.addEventListener("click", () => {
    widget.classList.remove("is-open");
    widget.querySelector(".chatbot-launcher")?.setAttribute("aria-expanded", "false");
  });

  widget.querySelectorAll("[data-chatbot-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      trackLocalLiftEvent("chatbot_prompt", { prompt: button.dataset.chatbotPrompt || "" });
      submitChatbotMessage(button.dataset.chatbotPrompt || "", { messages, input, context, history });
    });
  });

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    trackLocalLiftEvent("chatbot_message", { business: context.business?.name || "" });
    submitChatbotMessage(input?.value || "", { messages, input, context, history });
  });
}

function attachLeadForms(container, business) {
  container.querySelectorAll("[data-lead-form]").forEach((leadForm) => {
    leadForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(leadForm);
      const lead = {
        business: business.name,
        name: textOr(data.get("leadName"), "Lead sin nombre"),
        contact: textOr(data.get("leadContact"), ""),
        message: textOr(data.get("leadMessage"), ""),
        source: "form",
        timestamp: new Date().toISOString()
      };

      window.localLiftLeads = window.localLiftLeads || [];
      window.localLiftLeads.push(lead);
      trackLocalLiftEvent("lead_form_submit", { business: business.name });
      const status = leadForm.querySelector("[data-lead-status]");

      try {
        await syncLeadToCrm(leadForm.dataset.leadEndpoint || getPublicLeadEndpoint(business), lead);
        if (status) {
          status.textContent = "Lead guardado en el CRM.";
        }
      } catch (error) {
        if (status) {
          status.textContent = "Lead guardado en esta sesion. La API CRM no esta disponible.";
        }
      }

      leadForm.reset();
    });
  });
}

function attachPublicBookingForms(container, business) {
  container.querySelectorAll("[data-public-booking-form]").forEach((bookingForm) => {
    const startsAt = bookingForm.elements.startsAt;

    if (startsAt && !startsAt.min) {
      startsAt.min = toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
    }

    bookingForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(bookingForm);
      const booking = {
        business: business.name,
        serviceName: textOr(data.get("serviceName"), "Reserva"),
        customerName: textOr(data.get("customerName"), "Cliente sin nombre"),
        contact: textOr(data.get("contact"), ""),
        startsAt: data.get("startsAt") ? new Date(String(data.get("startsAt"))).toISOString() : "",
        notes: textOr(data.get("notes"), ""),
        source: "public-widget",
        timestamp: new Date().toISOString()
      };
      const status = bookingForm.querySelector("[data-booking-status]");

      window.localLiftBookings = window.localLiftBookings || [];
      window.localLiftBookings.push(booking);
      trackLocalLiftEvent("public_booking_submit", { business: business.name, service: booking.serviceName });

      try {
        await syncBookingToAgenda(bookingForm.dataset.bookingEndpoint || getPublicBookingEndpoint(business), booking);
        if (status) {
          status.textContent = "Reserva enviada a la agenda. El negocio confirmara el hueco.";
        }
      } catch (error) {
        if (status) {
          status.textContent = error.status === 409
            ? "Ese hueco no esta disponible. Prueba otra hora."
            : "Reserva guardada en esta sesion. La agenda no esta disponible.";
        }
      }

      bookingForm.reset();

      if (startsAt) {
        startsAt.min = toDatetimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
      }
    });
  });
}

function attachStore(container, business) {
  container.querySelectorAll("[data-store]").forEach((store) => {
    const context = readStoreContext(store);
    const commerce = normalizeCommerce(context.commerce || {});
    let products = commerce.products.length ? commerce.products : demoBusiness.commerce.products;
    let shippingMethods = commerce.shippingMethods.length ? commerce.shippingMethods : demoBusiness.commerce.shippingMethods;
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

    const setStatus = (message) => {
      if (statusTarget) statusTarget.textContent = message;
    };

    const cartLines = () => Array.from(cart.entries())
      .map(([id, quantity]) => ({ product: products.find((item) => item.id === id), quantity }))
      .filter((item) => item.product && item.quantity > 0);

    const quotePayload = () => ({
      currency: commerce.currency,
      shippingMethodId: selectedShippingId,
      couponCode: textOr(couponInput?.value, ""),
      items: cartLines().map(({ product, quantity }) => ({
        id: product.id,
        sku: product.sku,
        quantity
      }))
    });

    const bindProductButtons = () => {
      store.querySelectorAll("[data-add-product]").forEach((button) => {
        button.addEventListener("click", () => {
          const productId = button.dataset.addProduct || "";
          const product = products.find((item) => item.id === productId);

          if (!product) return;

          cart.set(productId, (cart.get(productId) || 0) + 1);
          renderCart();
          refreshQuote();
          setStatus(`${product.name} anadido al carrito.`);
          trackLocalLiftEvent("store_add_to_cart", { business: business.name, product: product.name });
        });
      });
    };

    const renderProducts = () => {
      if (!productsTarget) return;
      productsTarget.innerHTML = products.map((product) => renderProductCard(product, commerce.currency)).join("");
      productsTarget.querySelectorAll(".reveal").forEach((item) => item.classList.add("is-visible"));
      bindProductButtons();
    };

    const renderCart = () => {
      const lines = cartLines();

      if (!itemsTarget) return;
      if (!lines.length) {
        itemsTarget.innerHTML = '<p class="store-empty">Anade productos para empezar.</p>';
        renderSummary(localQuote());
        return;
      }

      itemsTarget.innerHTML = lines.map(({ product, quantity }) => `
        <div class="cart-line">
          <div>
            <strong>${escapeHtml(product.name)}</strong>
            <span>${escapeHtml(formatMoney(product.price, commerce.currency))} x ${quantity}</span>
          </div>
          <div class="cart-line-actions">
            <button type="button" data-cart-dec="${escapeAttr(product.id)}">-</button>
            <span>${quantity}</span>
            <button type="button" data-cart-inc="${escapeAttr(product.id)}">+</button>
          </div>
        </div>
      `).join("");

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

    const renderShippingMethods = () => {
      if (!shippingTarget) return;
      shippingTarget.innerHTML = `
        <legend>Entrega</legend>
        ${shippingMethods.map((method) => `
          <label class="store-shipping-option">
            <input type="radio" name="shippingMethodId" value="${escapeAttr(method.id)}" ${method.id === selectedShippingId ? "checked" : ""}>
            <span>
              <strong>${escapeHtml(method.name)}</strong>
              <small>${escapeHtml(method.description || "")}</small>
            </span>
            <em>${escapeHtml(formatMoney(method.price, commerce.currency))}</em>
          </label>
        `).join("")}
      `;
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
      if (totalTarget) totalTarget.textContent = formatMoney(totals.total || 0, quote.currency || commerce.currency);
      if (mobileCartTotal) mobileCartTotal.textContent = formatMoney(totals.total || 0, quote.currency || commerce.currency);
      if (mobileCartBar) mobileCartBar.hidden = !hasItems;
      siteRoot?.classList.toggle("has-mobile-cart", hasItems);
      if (!summaryTarget) return;
      summaryTarget.innerHTML = [
        ["Subtotal", totals.subtotal || 0],
        ["Descuento", totals.discount ? -Math.abs(totals.discount) : 0],
        ["Envio", totals.shipping || 0],
        [quote.taxIncluded ? "Impuestos incluidos" : "Impuestos", totals.tax || 0],
        ["Total", totals.total || 0, true]
      ].map(([label, value, strong]) => `
        <div class="${strong ? "is-total" : ""}">
          <span>${escapeHtml(label)}</span>
          <strong>${escapeHtml(formatMoney(value, quote.currency || commerce.currency))}</strong>
        </div>
      `).join("");
    };

    const localQuote = () => {
      const lines = cartLines();
      const subtotal = roundMoney(lines.reduce((sum, item) => sum + item.product.price * item.quantity, 0));
      const shipping = shippingMethods.find((method) => method.id === selectedShippingId)?.price || 0;
      const taxableBase = Math.max(0, subtotal + shipping);
      const taxRatePercent = commerce.taxRatePercent || 0;
      const tax = commerce.taxIncluded
        ? roundMoney(taxableBase - taxableBase / (1 + taxRatePercent / 100))
        : roundMoney(taxableBase * (taxRatePercent / 100));
      const total = commerce.taxIncluded ? roundMoney(taxableBase) : roundMoney(taxableBase + tax);
      return {
        currency: commerce.currency,
        taxIncluded: commerce.taxIncluded,
        totals: { subtotal, discount: 0, shipping, tax, taxRatePercent, total }
      };
    };

    const refreshQuote = async () => {
      const seq = ++quoteSeq;
      const lines = cartLines();
      if (!lines.length) {
        renderSummary(localQuote());
        return;
      }

      renderSummary(localQuote());
      const validateEndpoint = deriveStoreEndpoint(commerce.checkoutEndpoint || commerce.productsEndpoint, "/api/store/cart/validate");
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
        setStatus(quote.coupon ? `Cupon ${quote.coupon.code} aplicado.` : "");
      } catch (error) {
        if (seq === quoteSeq && couponInput?.value.trim()) {
          setStatus(error.message || "No se pudo aplicar el cupon.");
        }
      }
    };

    const loadProducts = async () => {
      if (!commerce.productsEndpoint) return;

      try {
        const response = await fetch(commerce.productsEndpoint);
        if (!response.ok) return;
        const data = await response.json();
        const remoteProducts = normalizeProducts(data.products || data);
        if (!remoteProducts.length) return;
        products = remoteProducts;
        commerce.products = remoteProducts;
        renderProducts();
        renderCart();
        refreshQuote();
        setStatus("Catalogo sincronizado con la base de datos.");
      } catch (error) {
        // The embedded catalog keeps the preview and exported page usable without the API running.
      }
    };

    const loadConfig = async () => {
      const configEndpoint = deriveStoreEndpoint(commerce.productsEndpoint || commerce.checkoutEndpoint, "/api/store/config");
      if (!configEndpoint) return;

      try {
        const response = await fetch(configEndpoint);
        if (!response.ok) return;
        const data = await response.json();
        const settings = data.settings || {};
        if (settings.currency) commerce.currency = normalizeCurrency(settings.currency);
        commerce.taxRatePercent = numberOr(settings.taxRatePercent, commerce.taxRatePercent);
        commerce.taxIncluded = settings.taxIncluded !== false;
        if (Array.isArray(settings.shippingMethods) && settings.shippingMethods.length) {
          shippingMethods = normalizeShippingMethods(settings.shippingMethods);
          selectedShippingId = shippingMethods.find((method) => method.default)?.id || shippingMethods[0]?.id || selectedShippingId;
          renderShippingMethods();
          refreshQuote();
        }
      } catch (error) {
        // Local checkout settings remain available without API config.
      }
    };

    couponInput?.addEventListener("input", () => {
      window.clearTimeout(couponInput.dataset.timer);
      couponInput.dataset.timer = window.setTimeout(refreshQuote, 350);
    });

    checkoutForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const lines = cartLines();

      if (!lines.length) {
        setStatus("Anade al menos un producto antes de pagar.");
        return;
      }

      if (!commerce.checkoutEndpoint) {
        setStatus("Falta configurar el endpoint de checkout Stripe.");
        return;
      }

      const data = new FormData(checkoutForm);
      const fallbackUrl = `${window.location.origin}${window.location.pathname}`;
      const payload = {
        businessName: context.business?.name || business.name,
        orderEmail: commerce.orderEmail || business.email,
        currency: commerce.currency,
        successUrl: commerce.successUrl || `${fallbackUrl}?pedido=ok`,
        cancelUrl: commerce.cancelUrl || `${fallbackUrl}#tienda`,
        shippingMethodId: selectedShippingId,
        couponCode: textOr(data.get("couponCode"), ""),
        customer: {
          name: textOr(data.get("customerName"), ""),
          email: textOr(data.get("customerEmail"), ""),
          phone: textOr(data.get("customerPhone"), ""),
          address: textOr(data.get("customerAddress"), "")
        },
        items: lines.map(({ product, quantity }) => ({
          id: product.id,
          sku: product.sku,
          quantity
        }))
      };

      setStatus("Creando pago seguro...");
      trackLocalLiftEvent("store_checkout_start", { business: business.name, items: lines.length });

      try {
        const response = await fetch(commerce.checkoutEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const result = await response.json().catch(() => ({}));

        if (!response.ok || !(result.url || result.checkoutUrl)) {
          throw new Error(result.error || "Checkout failed");
        }

        window.location.href = result.url || result.checkoutUrl;
      } catch (error) {
        setStatus("No se pudo iniciar el pago. Revisa la API de tienda y las claves de Stripe.");
      }
    });

    renderShippingMethods();
    bindProductButtons();
    renderCart();
    refreshQuote();
    showStorePaymentNotice(paymentNotice);
    loadConfig();
    loadProducts();
  });
}

async function submitChatbotMessage(rawMessage, state) {
  const message = rawMessage.trim();

  if (!message) {
    return;
  }

  addChatMessage(state.messages, message, "user");
  state.history.push({ role: "user", content: message });

  if (state.input) {
    state.input.value = "";
  }

  const loading = addChatMessage(state.messages, "Pensando...", "bot is-loading");

  try {
    const reply = state.context.chatbot.endpoint
      ? await askChatbotEndpoint(message, state.context, state.history)
      : generateLocalChatbotReply(message, state.context, state.history);

    loading.remove();
    addChatMessage(state.messages, reply, "bot");
    state.history.push({ role: "assistant", content: reply });
  } catch (error) {
    loading.remove();
    const fallback = generateLocalChatbotReply(message, state.context, state.history);
    addChatMessage(state.messages, fallback, "bot");
    state.history.push({ role: "assistant", content: fallback });
  }
}

function addChatMessage(messages, text, type) {
  const message = document.createElement("div");
  message.className = `chat-message is-${type}`;
  message.textContent = text;
  messages.appendChild(message);
  messages.scrollTop = messages.scrollHeight;
  return message;
}

async function askChatbotEndpoint(message, context, history) {
  const response = await fetch(context.chatbot.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
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

  if (!response.ok) {
    throw new Error("Chatbot endpoint failed");
  }

  const data = await response.json();
  return String(data.reply || data.message || "Ahora mismo no tengo una respuesta clara.");
}

function generateLocalChatbotReply(message, context, history = []) {
  const text = normalizeText(message);
  const business = context.business;
  const contact = buildContactLine(context);
  const lead = extractLeadFromMessage(message, context, history);
  const matchedFaq = context.faqs.find((faq) => hasSharedToken(text, faq.question));

  if (lead) {
    return `Perfecto, he dejado una solicitud preparada para ${business.name}.\n\nResumen:\n- Nombre: ${lead.name}\n- Contacto: ${lead.contact}\n- Necesidad: ${lead.message}\n\n${buildNextStepLine(context)}`;
  }

  if (matchedFaq) {
    return `${matchedFaq.answer}\n\n${buildSoftLeadPrompt(context)}\n\n${contact}`;
  }

  if (matchesAny(text, ["horario", "hora", "abierto", "abrir", "cerrado", "cuando"])) {
    return context.hours.length
      ? `El horario de ${business.name} es:\n${context.hours.map((line) => `- ${line}`).join("\n")}\n\n${buildSoftLeadPrompt(context)}\n\n${contact}`
      : `Todavia no hay horario detallado publicado. ${contact}`;
  }

  if (matchesAny(text, ["reserv", "cita", "mesa", "turno", "agenda", "booking"])) {
    if (looksLikeLeadDetails(text)) {
      const quickLead = storeChatLead({
        business: business.name,
        name: "Lead desde chatbot",
        contact: extractContact(message) || "",
        message,
        source: "chatbot",
        leadEndpoint: context.chatbot?.leadEndpoint || ""
      });
      return `Perfecto. He detectado datos de reserva y los dejo preparados para el negocio.\n\nResumen recibido: ${quickLead.message}\n\n${buildNextStepLine(context)}\n\n${contact}`;
    }

    return business.bookingUrl && business.bookingUrl !== "#contacto"
      ? `Puedes reservar desde aqui: ${business.bookingUrl}\n\nSi quieres, dime nombre, dia/hora y telefono, y dejo el lead preparado para el negocio.`
      : `Para reservar, dime nombre, dia/hora y telefono. Tambien puedes contactar directamente:\n${contact}`;
  }

  if (matchesAny(text, ["donde", "direccion", "ubicacion", "mapa", "llegar", "localizacion"])) {
    const map = business.mapsLink ? `\nMapa: ${business.mapsLink}` : "";
    const note = context.google?.directionsNote ? `\n${context.google.directionsNote}` : "";
    return `${business.address || business.location || "La direccion aun no esta publicada."}${note}${map}\n\n${contact}`;
  }

  if (context.commerce?.enabled && matchesAny(text, ["tienda", "comprar", "compra", "carrito", "producto", "pago", "precio"])) {
    const products = context.commerce.products || [];
    return products.length
      ? `Puedes comprar desde la seccion Tienda. Productos destacados:\n${products.slice(0, 5).map((item) => `- ${item.name}: ${formatMoney(item.price, context.commerce.currency)}`).join("\n")}\n\nEl pago se abre en Stripe Checkout cuando confirmas el carrito.`
      : "La tienda esta activa, pero todavia no hay productos publicados.";
  }

  if (matchesAny(text, ["servicio", "menu", "carta", "tratamiento", "producto", "precio", "ofrece"])) {
    return context.services.length
      ? `Estos son algunos servicios destacados:\n${context.services.map((item) => `- ${splitTitleBody(item).title}`).join("\n")}\n\n${buildSoftLeadPrompt(context)}\n\n${contact}`
      : `Todavia no hay servicios detallados en la web. ${contact}`;
  }

  if (matchesAny(text, ["telefono", "llamar", "email", "correo", "contacto", "whatsapp"])) {
    return contact;
  }

  if (matchesAny(text, ["instagram", "redes", "tiktok", "facebook", "fotos", "galeria"])) {
    return context.links.length
      ? `Puedes ver mas aqui:\n${context.links.map((link) => `- ${link.label}: ${link.url}`).join("\n")}`
      : "Ahora mismo no hay redes enlazadas, pero puedes usar el contacto principal de la web.";
  }

  if (matchesAny(text, ["resena", "reseña", "opinion", "opiniones", "rating", "valoracion", "valoración"])) {
    const google = context.google || {};
    const rating = google.rating ? `Rating Google: ${google.rating}/5 con ${google.reviewCount || 0} resenas.` : "";
    const reviewUrl = google.reviewUrl ? `\nDejar resena: ${google.reviewUrl}` : "";
    return `${rating || "Todavia no hay rating conectado en esta demo."}${reviewUrl}\n\n${buildSoftLeadPrompt(context)}\n\n${contact}`.trim();
  }

  return buildDefaultChatbotReply(context);
}

function buildDefaultChatbotReply(context) {
  const business = context.business;
  const options = [
    "horarios",
    business.bookingUrl && business.bookingUrl !== "#contacto" ? "reservas" : "contacto",
    business.address ? "ubicacion" : "",
    context.commerce?.enabled ? "tienda online" : "",
    context.services.length ? "servicios" : "",
    context.faqs.length ? "preguntas frecuentes" : ""
  ].filter(Boolean);

  return `Soy el asistente de ${business.name}. Puedo ayudarte con ${options.join(", ")}.\n\n${buildSoftLeadPrompt(context)}\n\n${buildContactLine(context)}`;
}

function buildSoftLeadPrompt(context) {
  const business = context.business;
  return `Si quieres que ${business.name} te responda con contexto, escribe: "Me llamo [nombre], mi contacto es [telefono/email] y necesito [detalle]".`;
}

function buildNextStepLine(context) {
  const business = context.business;
  return business.bookingUrl && business.bookingUrl !== "#contacto"
    ? `Siguiente paso recomendado: usar ${business.bookingUrl} o esperar respuesta del negocio.`
    : "Siguiente paso recomendado: el negocio puede contactar con esta persona desde el lead guardado.";
}

function extractLeadFromMessage(message, context, history) {
  const contact = extractContact(message);
  const name = extractName(message);

  if (!contact || !name || message.length < 18) {
    return null;
  }

  return storeChatLead({
    business: context.business?.name || "",
    name,
    contact,
    message,
    source: "chatbot",
    leadEndpoint: context.chatbot?.leadEndpoint || "",
    previousIntent: history.slice(-3).map((item) => item.content).join(" | ")
  });
}

function storeChatLead(lead) {
  const storedLead = {
    ...lead,
    timestamp: new Date().toISOString()
  };
  window.localLiftLeads = window.localLiftLeads || [];
  window.localLiftLeads.push(storedLead);
  syncLeadToCrm(lead.leadEndpoint || "", storedLead).catch(() => {});
  trackLocalLiftEvent("chatbot_lead_captured", { business: storedLead.business || "" });
  return storedLead;
}

function extractContact(message) {
  const email = String(message).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];
  const phone = String(message).match(/(\+?\d[\d\s().-]{7,})/)?.[0];
  return email || phone || "";
}

function extractName(message) {
  const explicit = String(message).match(/(?:me llamo|soy|nombre es)\s+([a-zA-ZÀ-ÿ\s]{2,40})/i)?.[1];

  if (explicit) {
    return explicit.trim().replace(/\s+(mi|y|con|para).*$/i, "");
  }

  return "Lead desde chatbot";
}

function buildContactLine(context) {
  const business = context.business;
  const parts = [];
  const reviewTemplate = context.google?.reviewRequestTemplate;

  if (business.phone) {
    parts.push(`Telefono: ${business.phone}`);
  }

  if (business.email) {
    parts.push(`Email: ${business.email}`);
  }

  if (business.bookingUrl && business.bookingUrl !== "#contacto") {
    parts.push(`${context.chatbot.handoffLabel}: ${business.bookingUrl}`);
  }

  if (reviewTemplate && context.google?.reviewUrl) {
    parts.push(`Pedir resena: ${reviewTemplate.replaceAll("{business}", business.name).replaceAll("{reviewUrl}", context.google.reviewUrl)}`);
  }

  return parts.length ? parts.join("\n") : "Puedes usar el formulario o enlaces de contacto de esta web.";
}

function readChatbotContext(widget) {
  try {
    return JSON.parse(widget.dataset.chatbotContext || "{}");
  } catch (error) {
    return {};
  }
}

function attachGeneratedInteractions(container, business) {
  if (previewObserver) {
    previewObserver.disconnect();
  }

  const root = container.querySelector(".generated-site");
  if (!root) {
    return;
  }

  runSplitting(container);
  runVanillaTilt(container, business);
  attachStore(container, business);
  attachChatbot(container);
  attachPublicBookingForms(container, business);
  attachLeadForms(container, business);
  attachTracking(container, business);

  const revealItems = container.querySelectorAll(".reveal");
  const premiumEnabled = root?.dataset.premiumEffects === "true";
  const hasExternalTilt = Boolean(window.VanillaTilt);

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  } else {
  previewObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    {
      root: container,
      threshold: 0.18
    }
  );

  revealItems.forEach((item, index) => {
    item.style.transitionDelay = `${Math.min(index * 45, 260)}ms`;
    previewObserver.observe(item);
  });
  }

  container.onscroll = () => {
    updateScrollProgress(container, root);
    const amount = container.scrollTop * 0.08 * motionMultiplier(business.motion);
    container.querySelectorAll(".parallax-media img").forEach((image) => {
      image.style.transform = `translateY(${amount}px) scale(1.08)`;
    });
  };
  updateScrollProgress(container, root);

  container.onpointermove = (event) => {
    if (!premiumEnabled) {
      return;
    }

    root?.style.setProperty("--pointer-x", `${event.clientX}px`);
    root?.style.setProperty("--pointer-y", `${event.clientY}px`);

    if (hasExternalTilt) {
      return;
    }

    const card = event.target.closest(".tilt-card");
    container.querySelectorAll(".tilt-card").forEach((item) => {
      if (item !== card) {
        item.style.setProperty("--tilt-x", 0);
        item.style.setProperty("--tilt-y", 0);
        item.style.setProperty("--lift", "0px");
      }
    });

    if (!card) {
      return;
    }

    const cardRect = card.getBoundingClientRect();
    const localX = (event.clientX - cardRect.left) / cardRect.width - 0.5;
    const localY = (event.clientY - cardRect.top) / cardRect.height - 0.5;
    const intensity = Math.max(3, Math.min(9, business.intensity / 12));
    card.style.setProperty("--tilt-x", (localX * intensity).toFixed(2));
    card.style.setProperty("--tilt-y", (localY * intensity).toFixed(2));
    card.style.setProperty("--lift", "-3px");
  };

  container.onpointerleave = () => {
    container.querySelectorAll(".tilt-card").forEach((card) => {
      card.style.setProperty("--tilt-x", 0);
      card.style.setProperty("--tilt-y", 0);
      card.style.setProperty("--lift", "0px");
    });
  };
}

function attachTracking(container, business) {
  container.querySelectorAll("[data-track]").forEach((element) => {
    element.addEventListener("click", () => {
      trackLocalLiftEvent(element.dataset.track, {
        business: business.name,
        category: business.category
      });
    });
  });
}

function trackLocalLiftEvent(name, detail = {}) {
  window.localLiftEvents = window.localLiftEvents || [];
  const event = {
    name,
    detail,
    timestamp: new Date().toISOString()
  };
  window.localLiftEvents.push(event);
  window.dataLayer?.push({ event: `locallift_${name}`, ...detail });
  syncEventToMetrics(getPublicEventEndpoint(), {
    ...event,
    page: window.location?.pathname || "",
    referrer: document.referrer || "",
    userAgent: navigator.userAgent || ""
  }).catch(() => {});
}

function getPublicLeadEndpoint(business = {}) {
  const identifier = currentBusinessRecord?.slug
    || currentBusinessRecord?.id
    || business.slug
    || business.id
    || slugify(business.name || "");

  return identifier ? `/api/public/${encodeURIComponent(identifier)}/leads` : "";
}

function getPublicBookingEndpoint(business = {}) {
  const identifier = currentBusinessRecord?.slug
    || currentBusinessRecord?.id
    || business.slug
    || business.id
    || slugify(business.name || "");

  return identifier ? `/api/public/${encodeURIComponent(identifier)}/bookings` : "";
}

function getPublicEventEndpoint(business = {}) {
  const identifier = currentBusinessRecord?.slug
    || currentBusinessRecord?.id
    || business.slug
    || business.id
    || slugify(business.name || "");

  return identifier ? `/api/public/${encodeURIComponent(identifier)}/events` : "";
}

async function syncLeadToCrm(endpoint, lead) {
  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ lead })
  });

  if (!response.ok) {
    throw new Error("Lead CRM request failed");
  }

  return response.json();
}

async function syncBookingToAgenda(endpoint, booking) {
  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
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

async function syncEventToMetrics(endpoint, event) {
  if (!endpoint) {
    return null;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ event })
  });

  if (!response.ok) {
    throw new Error("Event API request failed");
  }

  return response.json();
}

async function downloadSite(business) {
  const html = await buildExportDocument(business);
  const filename = slugify(business.name || "negocio-local");
  downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${filename}.html`);
}

function downloadBusinessData(business) {
  const payload = {
    version: DATA_VERSION,
    exportedAt: new Date().toISOString(),
    business: withBusinessDefaults(business)
  };
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }),
    `${slugify(business.name || "locallift-datos")}.locallift.json`
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  try {
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    URL.revokeObjectURL(url);
  }
}

async function saveBusinessToApi(business) {
  const record = currentBusinessRecord || getStoredApiRecord();
  const payload = buildBusinessApiPayload(business, record);
  const id = record?.id || record?.slug || "";
  const method = id ? "PUT" : "POST";
  const response = await fetch(id ? `${BUSINESS_API_BASE}/${encodeURIComponent(id)}` : BUSINESS_API_BASE, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  if (!response.ok && method === "PUT" && response.status === 404) {
    storeApiRecord(null);
    currentBusinessRecord = null;
    return saveBusinessToApi(business);
  }

  const result = await readApiJson(response);
  return result.business;
}

async function fetchBusinessFromApi(idOrSlug) {
  if (!idOrSlug) {
    throw new Error("Missing business id");
  }

  const response = await fetch(`${BUSINESS_API_BASE}/${encodeURIComponent(idOrSlug)}`);
  const result = await readApiJson(response);
  return result.business;
}

async function fetchFirstBusinessFromApi() {
  const response = await fetch(`${BUSINESS_API_BASE}?includeArchived=false`);
  const result = await readApiJson(response);
  const [business] = result.businesses || [];

  if (!business) {
    throw new Error("No businesses available");
  }

  return fetchBusinessFromApi(business.id || business.slug);
}

async function readApiJson(response) {
  let result = {};

  try {
    result = await response.json();
  } catch (error) {
    result = {};
  }

  if (!response.ok) {
    throw new Error(result.error || "Business API request failed");
  }

  return result;
}

function applyBusinessRecord(record) {
  currentBusinessRecord = toApiRecordMeta(record);
  storeApiRecord(currentBusinessRecord);
  currentBusiness = normalizeImportedBusiness(record.content || record);
  fillForm(currentBusiness);
  syncSegmentedControls();
  syncDesignPackState();
  syncQuickToggleState();
  renderFromForm();
}

function buildBusinessApiPayload(business, record) {
  return {
    business: {
      id: record?.id,
      slug: record?.slug,
      name: business.name,
      category: business.category,
      city: business.location,
      ownerEmail: business.email,
      ownerPhone: business.phone,
      plan: record?.plan || "presencia-local",
      status: record?.status || "in-design",
      publishedUrl: record?.publishedUrl || "",
      brand: {
        theme: business.theme,
        accent: business.accent,
        typography: business.typography,
        designPack: business.designPack
      },
      integrations: {
        google: {
          enabled: Boolean(business.google?.enabled),
          mapsUrl: business.google?.mapsUrl || "",
          reviewUrl: business.google?.reviewUrl || "",
          appointmentUrl: business.google?.appointmentUrl || business.bookingUrl || ""
        },
        stripe: {
          enabled: Boolean(business.commerce?.enabled && business.commerce?.checkoutEndpoint)
        },
        whatsapp: {
          enabled: Boolean(business.bookingUrl),
          url: business.bookingUrl || ""
        }
      },
      settings: {
        primaryGoal: business.conversionGoal,
        source: "studio",
        updatedFromStudioAt: new Date().toISOString()
      },
      content: withBusinessDefaults(business)
    }
  };
}

function toApiRecordMeta(record) {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    plan: record.plan,
    status: record.status,
    publishedUrl: record.publishedUrl || ""
  };
}

function getStoredApiRecord() {
  try {
    const raw = localStorage.getItem(API_RECORD_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

function storeApiRecord(record) {
  try {
    if (!record) {
      localStorage.removeItem(API_RECORD_KEY);
      return;
    }

    localStorage.setItem(API_RECORD_KEY, JSON.stringify(record));
  } catch (error) {
    // Browser storage can be unavailable in private modes; the editor still works without this cache.
  }
}

function normalizeImportedBusiness(imported) {
  const raw = imported?.business || imported;
  return withBusinessDefaults({
    ...raw,
    google: { ...demoBusiness.google, ...(raw?.google || {}) },
    chatbot: { ...demoBusiness.chatbot, ...(raw?.chatbot || {}) },
    commerce: { ...demoBusiness.commerce, ...(raw?.commerce || {}) }
  });
}

async function buildExportDocument(business) {
  business = withBusinessDefaults(business);
  const title = escapeHtml(`${business.name} - ${business.category}`);
  const description = escapeAttr(business.description || business.tagline);
  const content = renderSite(business);
  const vendor = await fetchVendorResources();
  const schema = JSON.stringify(buildLocalBusinessSchema(business), null, 2).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <meta property="og:title" content="${escapeAttr(business.name)}">
    <meta property="og:description" content="${description}">
    <meta property="og:image" content="${escapeAttr(business.heroImage)}">
    <script type="application/ld+json">
${schema}
    </script>
    <style>
${getExportCss()}
${vendor.css}
    </style>
  </head>
  <body>
${content}
    <script>
${vendor.js}
${getExportScript()}
    </script>
  </body>
</html>`;
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
  const [openProps, lenis, splitting, vanillaTilt] = await Promise.all([
    fetchText("assets/vendor/open-props-animations.min.css"),
    fetchText("assets/vendor/lenis.min.js"),
    fetchText("assets/vendor/splitting.min.js"),
    fetchText("assets/vendor/vanilla-tilt.min.js")
  ]);

  return {
    css: openProps ? `\n/* Open Props animations */\n${openProps}` : "",
    js: [lenis, splitting, vanillaTilt]
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

function getExportCss() {
  const liveCss = collectLiveCss();

  if (liveCss) {
    return liveCss;
  }

  const fallbackCss = `
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#fbf7ef;color:#171513;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:0}.generated-site{--accent:var(--site-accent,#cf3f2e);--accent-2:var(--site-accent-2,#0f8f8f);--ink:var(--site-ink,#171513);--muted:var(--site-muted,#6d675e);--paper:var(--site-paper,#fffaf0);--bg:var(--site-bg,#fbf7ef);--line:color-mix(in srgb,var(--ink),transparent 86%);min-height:100vh;background:var(--bg);color:var(--ink)}.generated-site a{color:inherit}.site-nav{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:18px;min-height:68px;padding:0 clamp(18px,4vw,54px);border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--paper),transparent 12%);backdrop-filter:blur(18px)}.site-logo{display:flex;align-items:center;gap:10px;min-width:0;font-weight:900;text-decoration:none}.site-logo-mark{display:grid;place-items:center;width:36px;height:36px;border-radius:8px;background:var(--ink);color:var(--paper);flex:0 0 auto;font-size:.78rem}.site-nav-links{display:flex;align-items:center;gap:18px;color:var(--muted);font-size:.88rem;font-weight:800}.site-nav-links a{text-decoration:none}.site-nav-links a:hover{color:var(--accent)}.site-cta{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;border-radius:8px;background:var(--ink);color:var(--paper);font-weight:900;text-decoration:none;transition:transform .18s ease,background .18s ease}.site-cta:hover{transform:translateY(-2px);background:var(--accent)}.hero-section{position:relative;display:grid;min-height:min(820px,calc(100vh - 68px));overflow:hidden;isolation:isolate}.hero-media{position:absolute;inset:0;z-index:-2}.hero-media img{width:100%;height:100%;object-fit:cover;transform:scale(1.06);filter:saturate(1.05) contrast(1.02)}.hero-section:after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(90deg,color-mix(in srgb,var(--ink),transparent 8%),transparent 70%),linear-gradient(0deg,color-mix(in srgb,var(--ink),transparent 24%),transparent 48%)}.hero-content{align-self:end;width:min(980px,100%);padding:clamp(72px,13vw,170px) clamp(18px,5vw,72px) clamp(42px,8vw,92px);color:#fffaf0}.hero-kicker{display:inline-flex;align-items:center;min-height:32px;padding:0 10px;margin-bottom:16px;border:1px solid rgba(255,250,240,.28);border-radius:999px;background:rgba(255,250,240,.12);font-size:.78rem;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.hero-content h1{max-width:900px;margin:0;font-size:clamp(3rem,9vw,7.8rem);line-height:.9;letter-spacing:0}.hero-content p{max-width:680px;margin:22px 0 0;color:rgba(255,250,240,.84);font-size:clamp(1rem,1.8vw,1.35rem);line-height:1.55}.hero-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:26px}.ghost-link{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 16px;border:1px solid rgba(255,250,240,.32);border-radius:8px;color:#fffaf0;font-weight:900;text-decoration:none;transition:transform .18s ease,background .18s ease}.ghost-link:hover{transform:translateY(-2px);background:rgba(255,250,240,.12)}.site-section{padding:clamp(56px,9vw,128px) clamp(18px,5vw,72px)}.section-inner{width:min(1160px,100%);margin:0 auto}.section-heading{display:grid;grid-template-columns:minmax(0,.95fr) minmax(280px,.55fr);gap:clamp(24px,5vw,72px);align-items:end;margin-bottom:clamp(28px,5vw,62px)}.section-heading h2{margin:0;font-size:clamp(2.2rem,5.6vw,5.4rem);line-height:.95;letter-spacing:0}.section-heading p{margin:0;color:var(--muted);font-size:1rem;line-height:1.7}.proof-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-block:1px solid var(--line);background:var(--paper)}.proof-item{min-height:150px;padding:clamp(20px,4vw,42px);border-right:1px solid var(--line)}.proof-item:last-child{border-right:0}.proof-number{display:block;margin-bottom:8px;color:var(--accent);font-size:clamp(2rem,5vw,4rem);font-weight:950;line-height:.9}.proof-label{color:var(--muted);font-weight:800}.services-grid,.feature-grid,.testimonial-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.service-card,.feature-card,.testimonial-card,.faq-item,.contact-panel{border:1px solid var(--line);border-radius:8px;background:color-mix(in srgb,var(--paper),transparent 5%)}.service-card,.feature-card,.testimonial-card{min-height:220px;padding:clamp(20px,3vw,30px);transition:transform .24s ease,border-color .24s ease,box-shadow .24s ease}.service-card:hover,.feature-card:hover,.testimonial-card:hover{border-color:color-mix(in srgb,var(--accent),transparent 45%);box-shadow:0 18px 46px color-mix(in srgb,var(--ink),transparent 88%)}.card-index{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;margin-bottom:28px;border-radius:8px;background:color-mix(in srgb,var(--accent),transparent 88%);color:var(--accent);font-weight:950}.service-card h3,.feature-card h3{margin:0 0 12px;font-size:clamp(1.22rem,2vw,1.7rem);line-height:1.05}.service-card p,.feature-card p,.testimonial-card p{margin:0;color:var(--muted);line-height:1.65}.gallery-band{padding:clamp(48px,8vw,92px) 0;overflow:hidden;background:var(--ink);color:var(--paper)}.gallery-track{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(260px,34vw);gap:14px;width:max-content;animation:galleryMove 36s linear infinite}.gallery-track:hover{animation-play-state:paused}.gallery-item{width:100%;aspect-ratio:4/5;overflow:hidden;border-radius:8px;background:color-mix(in srgb,var(--paper),transparent 88%)}.gallery-item img{width:100%;height:100%;object-fit:cover;transition:transform .6s ease}.gallery-item:hover img{transform:scale(1.08)}@keyframes galleryMove{from{transform:translateX(0)}to{transform:translateX(calc(-50% - 7px))}}.split-section{display:grid;grid-template-columns:minmax(0,.9fr) minmax(320px,.7fr);gap:clamp(24px,5vw,72px);align-items:stretch}.image-panel{min-height:560px;overflow:hidden;border-radius:8px;background:var(--ink)}.image-panel img{width:100%;height:100%;object-fit:cover;transform:scale(1.04)}.feature-stack{display:grid;gap:14px;align-content:center}.feature-card{min-height:154px}.hours-grid{display:grid;gap:10px;color:var(--muted);font-weight:800;line-height:1.5}.testimonial-card{min-height:230px}.quote-mark{display:block;margin-bottom:18px;color:var(--accent);font-size:2.5rem;font-weight:950;line-height:.7}.testimonial-author{display:block;margin-top:22px;color:var(--ink);font-weight:950}.faq-list{display:grid;gap:10px}.faq-item{padding:18px 20px}.faq-item summary{cursor:pointer;color:var(--ink);font-weight:950}.faq-item p{margin:12px 0 0;color:var(--muted);line-height:1.65}.contact-section{background:var(--paper)}.contact-panel{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.6fr);gap:clamp(20px,5vw,72px);padding:clamp(24px,5vw,58px)}.contact-panel h2{margin:0;font-size:clamp(2rem,5vw,4.8rem);line-height:.95}.contact-panel p{color:var(--muted);line-height:1.7}.contact-links,.social-links{display:flex;flex-wrap:wrap;gap:10px}.contact-links a,.social-links a{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 12px;border:1px solid var(--line);border-radius:8px;color:var(--ink);font-weight:900;text-decoration:none;transition:transform .18s ease,border-color .18s ease,color .18s ease}.contact-links a:hover,.social-links a:hover{transform:translateY(-2px);border-color:var(--accent);color:var(--accent)}.site-footer{display:flex;justify-content:space-between;gap:18px;padding:24px clamp(18px,5vw,72px);border-top:1px solid var(--line);color:var(--muted);font-size:.88rem}.reveal{opacity:0;transform:translateY(calc(24px * var(--motion-scale,1)));transition:opacity .7s ease,transform .7s cubic-bezier(.21,.72,.22,1)}.reveal.is-visible{opacity:1;transform:translateY(0)}.tilt-card{transform:perspective(900px) rotateX(calc(var(--tilt-y,0) * -1deg)) rotateY(calc(var(--tilt-x,0) * 1deg)) translateY(var(--lift,0))}.theme-carbon{--site-bg:#11110f;--site-paper:#f7efe1;--site-ink:#f6efe4;--site-muted:#b9b0a4;color-scheme:dark}.theme-carbon .site-nav,.theme-carbon .service-card,.theme-carbon .feature-card,.theme-carbon .testimonial-card,.theme-carbon .faq-item,.theme-carbon .contact-panel{background:rgba(247,239,225,.07)}.theme-carbon .contact-section{background:#181714}.theme-carbon .site-logo-mark,.theme-carbon .site-cta{background:var(--site-accent,#cf3f2e);color:#fffaf0}.theme-editorial{--site-bg:#f7f2e6;--site-paper:#fffdf6;--site-ink:#251f1a;--site-muted:#776b5d;font-family:Georgia,"Times New Roman",serif}.theme-editorial .site-nav,.theme-editorial .site-cta,.theme-editorial .ghost-link,.theme-editorial .contact-links a,.theme-editorial .social-links a{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.theme-editorial .hero-content h1,.theme-editorial .section-heading h2,.theme-editorial .contact-panel h2{font-weight:500}.motion-soft{--motion-scale:.75}.motion-cinematic{--motion-scale:1.15}.motion-bold{--motion-scale:1.55}@media(max-width:760px){.section-heading,.proof-strip,.services-grid,.feature-grid,.testimonial-grid,.split-section,.contact-panel{grid-template-columns:1fr}.site-nav{align-items:flex-start;flex-direction:column;min-height:0;padding-block:14px}.site-nav-links{width:100%;overflow-x:auto;padding-bottom:4px}.hero-section{min-height:720px}.hero-content h1{font-size:clamp(2.8rem,18vw,4.8rem)}.proof-item{border-right:0;border-bottom:1px solid var(--line)}.proof-item:last-child{border-bottom:0}.gallery-track{grid-auto-columns:minmax(240px,72vw)}.image-panel{min-height:390px}.site-footer{flex-direction:column}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}.reveal{opacity:1;transform:none}}
  `.trim();

  return `${fallbackCss}
.generated-site{font-size:calc(16px * var(--site-font-scale,1))}.generated-site img{display:block;max-width:100%}.section-inner{width:min(var(--site-content-width,1160px),100%)}.hero-content{width:min(var(--site-hero-content-width,980px),100%)}.gallery-band{--gallery-gap:clamp(10px,1.4vw,16px);--gallery-card-width:clamp(240px,32vw,430px);--gallery-card-ratio:4/5;overflow:hidden}.gallery-track{grid-auto-columns:var(--gallery-card-width);gap:var(--gallery-gap);align-items:stretch;will-change:transform}.gallery-item{min-width:0;aspect-ratio:var(--gallery-card-ratio);margin:0}.gallery-item img,.image-panel img,.product-card img{display:block;object-position:center}.image-panel{min-height:clamp(360px,48vw,560px);aspect-ratio:4/5}.image-ratio-square{--gallery-card-ratio:1/1}.image-ratio-square .image-panel{aspect-ratio:1/1}.image-ratio-wide{--gallery-card-ratio:16/10;--gallery-card-width:clamp(280px,42vw,560px)}.image-ratio-wide .image-panel{aspect-ratio:16/10}@keyframes galleryMove{from{transform:translateX(0)}to{transform:translateX(calc(-50% - (var(--gallery-gap) / 2)))}}@media(max-width:760px){.gallery-track{display:flex;width:100%;max-width:100%;gap:12px;padding:0 clamp(14px,4vw,20px);overflow-x:auto;scroll-padding-inline:clamp(14px,4vw,20px);scroll-snap-type:x mandatory;scrollbar-width:none;animation:none;will-change:auto;-webkit-overflow-scrolling:touch}.gallery-track::-webkit-scrollbar{display:none}.gallery-item{flex:0 0 min(82vw,360px);aspect-ratio:4/3;scroll-snap-align:center}.gallery-item.is-gallery-clone{display:none}.image-panel{min-height:0;aspect-ratio:4/3}}
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
  const site = document.querySelector(".generated-site");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (typeof window.Splitting === "function") {
    window.Splitting();
  }
  if (typeof window.VanillaTilt === "function" && site?.dataset.premiumEffects === "true") {
    window.VanillaTilt.init(document.querySelectorAll(".tilt-card"), {
      max: 9,
      speed: 650,
      glare: true,
      "max-glare": 0.18,
      scale: 1.01,
      gyroscope: false
    });
  }
  if (typeof window.Lenis === "function" && !prefersReducedMotion) {
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
  updateProgress();

  window.addEventListener("scroll", () => {
    updateProgress();
    const amount = window.scrollY * 0.08;
    document.querySelectorAll(".parallax-media img").forEach((image) => {
      image.style.transform = "translateY(" + amount + "px) scale(1.08)";
    });
  }, { passive: true });

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
        source: "form",
        timestamp: new Date().toISOString()
      };
      window.localLiftLeads = window.localLiftLeads || [];
      window.localLiftLeads.push(lead);
      track("lead_form_submit", {});
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
        source: "public-widget",
        timestamp: new Date().toISOString()
      };
      window.localLiftBookings = window.localLiftBookings || [];
      window.localLiftBookings.push(booking);
      track("public_booking_submit", { service: booking.serviceName });
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
      if (/(\+?\d[\d\s().-]{7,})/.test(text)) {
        const quickLead = storeLead({ business: business.name || "", name: "Lead desde chatbot", contact: contactFrom(message), message, source: "chatbot", leadEndpoint: context.chatbot?.leadEndpoint || "" });
        return "Perfecto. He detectado datos de reserva y los dejo preparados para el negocio.\\n\\nResumen recibido: " + quickLead.message + "\\n\\n" + nextStep(context) + "\\n\\n" + contactLine(context);
      }
      return business.bookingUrl && business.bookingUrl !== "#contacto"
        ? "Puedes reservar desde aqui: " + business.bookingUrl + "\\n\\nSi quieres, dime nombre, dia/hora y telefono, y dejo el lead preparado para el negocio."
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
        : "Todavia no hay servicios detallados en la web. " + contactLine(context);
    }
    if (any(text, ["telefono", "llamar", "email", "correo", "contacto", "whatsapp"])) return contactLine(context);
    if (any(text, ["instagram", "redes", "tiktok", "facebook", "fotos", "galeria"])) {
      return (context.links || []).length
        ? "Puedes ver mas aqui:\\n" + context.links.map((link) => "- " + link.label + ": " + link.url).join("\\n")
        : "Ahora mismo no hay redes enlazadas, pero puedes usar el contacto principal de la web.";
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
    track("chatbot_lead_captured", { business: stored.business || "" });
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
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead })
    });
    if (!response.ok) throw new Error("Lead CRM request failed");
    return response.json();
  }
  async function syncBooking(endpoint, booking) {
    if (!endpoint) return null;
    const response = await fetch(endpoint, {
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
    const event = { name, detail, timestamp: new Date().toISOString() };
    window.localLiftEvents.push(event);
    window.dataLayer?.push({ event: "locallift_" + name, ...detail });
    syncEvent(publicEventEndpoint(), event).catch(() => {});
  }
  function publicEventEndpoint() {
    return business.slug || business.id ? "/api/public/" + encodeURIComponent(business.slug || business.id) + "/events" : "";
  }
  async function syncEvent(endpoint, event) {
    if (!endpoint) return null;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: { ...event, page: location.pathname, referrer: document.referrer, userAgent: navigator.userAgent } })
    });
    if (!response.ok) throw new Error("Event API request failed");
    return response.json();
  }
})();
  `.trim();
}

function parseLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function withBusinessDefaults(business = {}) {
  const base = { ...demoBusiness, ...business };
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(business, key);
  const google = { ...demoBusiness.google, ...(base.google || {}) };
  const chatbot = { ...demoBusiness.chatbot, ...(base.chatbot || {}) };
  const commerce = normalizeCommerce({ ...demoBusiness.commerce, ...(base.commerce || {}) });
  const services = Array.isArray(base.services) ? base.services : [];
  const trustBadges = hasOwn("trustBadges") && Array.isArray(business.trustBadges) && business.trustBadges.length
    ? business.trustBadges
    : buildTrustBadges({ ...base, services, chatbot }, google);

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
    conversionGoal: hasOwn("conversionGoal")
      ? textOr(business.conversionGoal, `Convertir visitas en clientes para ${base.category || "negocio local"}`)
      : `Convertir visitas en clientes para ${base.category || "negocio local"}`,
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
    designPack: normalizeChoice(base.designPack, ["custom", ...Object.keys(designPacks)], "custom"),
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
    showConversionDock: base.showConversionDock ?? true
  };
}

function parsePairs(value, fallbackA, fallbackB) {
  const lines = parseLines(value);
  if (!lines.length) {
    return [[fallbackA, fallbackB]];
  }

  return lines.map((line) => {
    const [first, ...rest] = line.split("|");
    return [textOr(first, fallbackA), textOr(rest.join("|"), fallbackB)];
  });
}

function serializeProducts(products = []) {
  return normalizeProducts(products)
    .map((product) => [
      product.name,
      formatPlainPrice(product.price),
      product.image,
      product.description,
      product.sku,
      product.stock
    ].join(" | "))
    .join("\n");
}

function parseProducts(value) {
  return parseLines(value)
    .map((line, index) => {
      const [name, price, image, description, sku, stock] = line.split("|").map((part) => part.trim());
      return normalizeProduct({ name, price, image, description, sku, stock }, index);
    })
    .filter((product) => product.name && product.price > 0);
}

function normalizeCommerce(commerce = {}) {
  const source = { ...demoBusiness.commerce, ...(commerce || {}) };
  return {
    enabled: Boolean(source.enabled),
    title: textOr(source.title, demoBusiness.commerce.title),
    intro: textOr(source.intro, demoBusiness.commerce.intro),
    currency: normalizeCurrency(source.currency),
    taxRatePercent: numberOr(source.taxRatePercent, demoBusiness.commerce.taxRatePercent),
    taxIncluded: source.taxIncluded !== false,
    checkoutEndpoint: normalizeOptionalUrl(source.checkoutEndpoint),
    productsEndpoint: normalizeOptionalUrl(source.productsEndpoint),
    successUrl: normalizeOptionalUrl(source.successUrl),
    cancelUrl: normalizeOptionalUrl(source.cancelUrl),
    termsUrl: normalizeOptionalUrl(source.termsUrl),
    privacyUrl: normalizeOptionalUrl(source.privacyUrl),
    orderEmail: textOr(source.orderEmail, ""),
    deliveryMode: textOr(source.deliveryMode, demoBusiness.commerce.deliveryMode),
    shippingMethods: normalizeShippingMethods(source.shippingMethods),
    products: normalizeProducts(source.products).filter((product) => product.active)
  };
}

function normalizeShippingMethods(methods = []) {
  const source = Array.isArray(methods) && methods.length ? methods : demoBusiness.commerce.shippingMethods;
  const shippingMethods = source.map((method, index) => ({
    id: slugify(method.id || method.name || `shipping-${index + 1}`),
    name: textOr(method.name, `Envio ${index + 1}`),
    description: textOr(method.description, ""),
    price: parsePrice(method.price),
    active: method.active !== false,
    default: Boolean(method.default)
  }));

  if (!shippingMethods.some((method) => method.default) && shippingMethods[0]) {
    shippingMethods[0].default = true;
  }

  return shippingMethods.filter((method) => method.active);
}

function normalizeProducts(products = []) {
  if (!Array.isArray(products)) {
    return [];
  }

  return products
    .map((product, index) => normalizeProduct(product, index))
    .filter((product) => product.name && product.price > 0);
}

function normalizeProduct(product = {}, index = 0) {
  const name = textOr(product.name, "");
  const fallbackProduct = demoBusiness.commerce?.products?.[index % demoBusiness.commerce.products.length] || {};
  const sku = slugify(product.sku || product.id || name || `producto-${index + 1}`);
  const id = slugify(product.id || sku || name || `producto-${index + 1}`);
  const price = parsePrice(product.price);
  const stock = Math.max(0, Math.floor(numberOr(product.stock, 999)));

  return {
    id,
    sku,
    name,
    price,
    image: normalizeImage(product.image, fallbackProduct.image || demoBusiness.heroImage),
    description: textOr(product.description, "Producto disponible para compra online."),
    stock,
    active: product.active !== false
  };
}

function parsePrice(value) {
  const normalized = String(value ?? "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? Math.max(0, Math.round(number * 100) / 100) : 0;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatPlainPrice(value) {
  return parsePrice(value).toFixed(2).replace(/\.00$/, "");
}

function normalizeCurrency(value) {
  const currency = String(value || "EUR").trim().toUpperCase().replace(/[^A-Z]/g, "");
  return currency.length === 3 ? currency : "EUR";
}

function formatMoney(value, currency = "EUR") {
  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: normalizeCurrency(currency)
    }).format(Number(value || 0));
  } catch (error) {
    return `${formatPlainPrice(value)} ${normalizeCurrency(currency)}`;
  }
}

function readStoreContext(store) {
  try {
    return JSON.parse(store.dataset.storeContext || "{}");
  } catch (error) {
    return {};
  }
}

function deriveStoreEndpoint(endpoint, pathname) {
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

function showStorePaymentNotice(target) {
  if (!target) return;

  const params = new URLSearchParams(window.location.search);
  if (params.get("pedido") === "ok" || params.get("payment") === "success") {
    target.hidden = false;
    target.textContent = "Pago recibido. El negocio recibira el pedido y el comprador recibira confirmacion por email.";
  }
}

function toDatetimeLocalValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function textOr(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function normalizeChoice(value, options, fallback) {
  return options.includes(String(value || "")) ? String(value) : fallback;
}

function splitTitleBody(value) {
  const text = String(value || "").trim();
  const [title, ...body] = text.split(":");

  if (body.length) {
    return {
      title: textOr(title, "Servicio"),
      body: textOr(body.join(":").trim(), "Una propuesta clara y facil de entender.")
    };
  }

  return {
    title: text,
    body: "Presentado con texto breve, visual y enfocado a que el cliente de el siguiente paso."
  };
}

function normalizeImage(value, fallback) {
  const url = String(value || "").trim();
  if (!url) {
    return fallback;
  }

  if (/^(https?:|data:image\/)/i.test(url)) {
    return url;
  }

  return fallback;
}

function normalizeUrl(value) {
  const url = String(value || "").trim();
  if (!url) {
    return "#";
  }

  if (/^(https?:|mailto:|tel:|sms:|whatsapp:)/i.test(url) || url.startsWith("#")) {
    return url;
  }

  return `https://${url}`;
}

function normalizeOptionalUrl(value) {
  const url = String(value || "").trim();
  return url ? normalizeUrl(url) : "";
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function hasSharedToken(message, candidate) {
  const tokens = normalizeText(candidate)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3);
  return tokens.some((token) => message.includes(token));
}

function looksLikeLeadDetails(text) {
  return /(\+?\d[\d\s().-]{7,})/.test(text);
}

function phoneHref(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function initials(value) {
  return String(value || "LL")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function slugify(value) {
  return String(value || "negocio-local")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function motionMultiplier(value) {
  return {
    soft: 0.75,
    cinematic: 1,
    bold: 1.35
  }[value] || 1;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function setStatus(message) {
  statusLine.textContent = message;
}
