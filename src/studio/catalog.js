(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  const SECTION_DEFINITIONS = {
    services: { label: "Servicios" },
    menu: { label: "Carta", field: "showMenu" },
    store: { label: "Tienda", field: "commerceEnabled" },
    gallery: { label: "Galeria", field: "showGallery" },
    features: { label: "Ventajas" },
    testimonials: { label: "Resenas", field: "showTestimonials" },
    faq: { label: "FAQ", field: "showFaq" },
    map: { label: "Mapa", field: "showMap" },
    booking: { label: "Reservas", field: "showBooking" },
    lead: { label: "Formulario", field: "showLeadForm" }
  };
  const DEFAULT_SECTION_ORDER = Object.keys(SECTION_DEFINITIONS);
  const BLOCK_LIBRARY = {
    hero: {
      label: "Portada",
      variants: [
        { id: "cinematic", label: "Fondo + texto", description: "Una imagen ocupa toda la portada con el texto encima." },
        { id: "split", label: "Imagen lateral", description: "Texto a un lado y una imagen rectangular al otro." },
        { id: "collage", label: "3 flotantes", description: "Tres imagenes superpuestas forman una composicion visual." },
        { id: "oval", label: "Imagen ovalada", description: "Una imagen protagonista recortada en forma de ovalo." },
        { id: "minimal", label: "Sin imagen", description: "Portada tipografica centrada, sin fotografias." }
      ]
    },
    services: {
      label: "Servicios",
      variants: [
        { id: "cards", label: "Tarjetas", description: "Servicios en una cuadricula equilibrada." },
        { id: "list", label: "Lista", description: "Lectura rapida y orden editorial." },
        { id: "spotlight", label: "Destacado", description: "El primer servicio gana protagonismo." }
      ]
    },
    gallery: {
      label: "Galeria",
      variants: [
        { id: "marquee", label: "Carrusel", description: "Galeria continua con movimiento." },
        { id: "grid", label: "Cuadricula", description: "Todas las fotos visibles de un vistazo." },
        { id: "mosaic", label: "Mosaico", description: "Composicion visual con ritmos distintos." }
      ]
    },
    testimonials: {
      label: "Resenas",
      variants: [
        { id: "cards", label: "Tarjetas", description: "Opiniones separadas y faciles de leer." },
        { id: "quotes", label: "Citas", description: "Testimonios grandes con aire editorial." }
      ]
    },
    contact: {
      label: "Contacto",
      variants: [
        { id: "split", label: "Dividido", description: "Datos y descripcion en dos columnas." },
        { id: "banner", label: "Banner", description: "Cierre contundente centrado en la accion." },
        { id: "compact", label: "Compacto", description: "Contacto corto para webs directas." }
      ]
    }
  };
  const DEFAULT_BLOCK_VARIANTS = {
    hero: "cinematic",
    services: "cards",
    gallery: "marquee",
    testimonials: "cards",
    contact: "split"
  };
  const LAYOUT_RECIPES = [
    {
      id: "conversion",
      name: "Conversion directa",
      description: "Servicios, confianza y reserva antes de la galeria.",
      layout: {
        sectionOrder: ["services", "testimonials", "booking", "lead", "gallery", "features", "faq", "map", "menu", "store"],
        blockVariants: { hero: "split", services: "list", gallery: "grid", testimonials: "quotes", contact: "banner" },
        visibility: { showGallery: true, showTestimonials: true, showFaq: true, showMap: true, showBooking: true, showLeadForm: true }
      }
    },
    {
      id: "visual",
      name: "Escaparate visual",
      description: "Portada y galeria dominan la experiencia.",
      layout: {
        sectionOrder: ["gallery", "services", "features", "testimonials", "map", "booking", "lead", "faq", "menu", "store"],
        blockVariants: { hero: "cinematic", services: "spotlight", gallery: "mosaic", testimonials: "cards", contact: "split" },
        visibility: { showGallery: true, showTestimonials: true, showFaq: false, showMap: true, showBooking: true, showLeadForm: false }
      }
    },
    {
      id: "compact",
      name: "Local compacto",
      description: "Una web corta para contacto y visita rapida.",
      layout: {
        sectionOrder: ["services", "map", "testimonials", "gallery", "features", "booking", "lead", "faq", "menu", "store"],
        blockVariants: { hero: "minimal", services: "list", gallery: "grid", testimonials: "quotes", contact: "compact" },
        visibility: { showGallery: false, showTestimonials: true, showFaq: false, showMap: true, showBooking: true, showLeadForm: false }
      }
    }
  ];

  const QUICK_CREATIVE_DIRECTIONS = [
    {
      values: { intensity: 45, fontScale: 95, layoutScale: 100 },
      radios: {
        artDirection: "editorial", contentMode: "balanced", theme: "editorial", typography: "editorial",
        motion: "soft", contentDensity: "balanced", visualShape: "sharp", heroSize: "balanced",
        contentWidth: "standard", imageRatio: "portrait"
      },
      checks: { premiumEffects: true, showGallery: true, showTrustRail: true, showTestimonials: true },
      blocks: { hero: "oval", services: "list", gallery: "grid", testimonials: "quotes", contact: "split" }
    },
    {
      values: { intensity: 55, fontScale: 95, layoutScale: 100 },
      radios: {
        artDirection: "mosaic", contentMode: "balanced", theme: "aurora", typography: "modern",
        motion: "cinematic", contentDensity: "balanced", visualShape: "rounded", heroSize: "balanced",
        contentWidth: "wide", imageRatio: "square"
      },
      checks: { premiumEffects: true, showGallery: true, showTrustRail: true, showTestimonials: true },
      blocks: { hero: "collage", services: "spotlight", gallery: "mosaic", testimonials: "cards", contact: "compact" }
    },
    {
      values: { intensity: 40, fontScale: 95, layoutScale: 105 },
      radios: {
        artDirection: "atelier", contentMode: "balanced", theme: "luxe", typography: "editorial",
        motion: "cinematic", contentDensity: "balanced", visualShape: "clean", heroSize: "balanced",
        contentWidth: "focused", imageRatio: "wide"
      },
      checks: { premiumEffects: true, showGallery: true, showTrustRail: true, showTestimonials: true },
      blocks: { hero: "split", services: "list", gallery: "marquee", testimonials: "quotes", contact: "split" }
    }
  ];

  const QUICK_ACTION_RECIPES = {
    premium: {
      values: { intensity: 45, fontScale: 95, layoutScale: 100 },
      radios: {
        artDirection: "atelier", contentMode: "balanced", theme: "luxe", typography: "editorial",
        motion: "cinematic", visualShape: "clean", contentDensity: "balanced", heroSize: "balanced",
        contentWidth: "standard", imageRatio: "portrait"
      },
      checks: {
        premiumEffects: true, showGallery: true, showTrustRail: true, showTestimonials: true,
        showResourceMarquee: false
      },
      blocks: { hero: "collage", services: "list", gallery: "mosaic", testimonials: "quotes", contact: "split" },
      sectionOrder: ["services", "gallery", "features", "testimonials", "booking", "lead", "faq", "map", "menu", "store"]
    },
    minimal: {
      values: { intensity: 35, fontScale: 95, layoutScale: 95 },
      radios: {
        artDirection: "editorial", contentMode: "balanced", theme: "aurora", typography: "modern",
        motion: "soft", visualShape: "sharp", contentDensity: "compact", heroSize: "compact",
        contentWidth: "standard", imageRatio: "wide"
      },
      checks: { premiumEffects: false, showResourceMarquee: false },
      blocks: { hero: "split", services: "list", gallery: "grid", testimonials: "quotes", contact: "compact" }
    },
    trust: {
      values: { intensity: 40, fontScale: 95, layoutScale: 100 },
      radios: {
        artDirection: "editorial", contentMode: "balanced", typography: "editorial", motion: "soft",
        contentDensity: "balanced", heroSize: "balanced", contentWidth: "standard", imageRatio: "portrait"
      },
      checks: {
        showTrustRail: true, showTestimonials: true, showFaq: true, showMap: true,
        googleEnabled: true, showResourceMarquee: false
      },
      blocks: { hero: "oval", services: "list", gallery: "grid", testimonials: "quotes", contact: "split" },
      sectionOrder: ["services", "testimonials", "faq", "map", "booking", "lead", "gallery", "features", "menu", "store"]
    },
    local: {
      values: { intensity: 45, fontScale: 95, layoutScale: 100 },
      radios: {
        artDirection: "editorial", contentMode: "balanced", typography: "editorial", motion: "soft",
        contentDensity: "balanced", heroSize: "balanced", contentWidth: "standard", imageRatio: "portrait"
      },
      checks: {
        showMap: true, googleEnabled: true, showTrustRail: true,
        showTestimonials: true, showResourceMarquee: false
      },
      blocks: { hero: "oval", services: "list", gallery: "grid", testimonials: "quotes", contact: "split" },
      sectionOrder: ["services", "map", "gallery", "testimonials", "features", "booking", "lead", "faq", "menu", "store"]
    },
    mobile: {
      values: { bookingLabel: "Contactar", intensity: 40, fontScale: 95, layoutScale: 90 },
      radios: {
        artDirection: "editorial", contentMode: "balanced", typography: "modern", motion: "soft",
        contentDensity: "compact", visualShape: "rounded", heroSize: "compact",
        contentWidth: "focused", imageRatio: "square"
      },
      checks: {
        showConversionDock: true, showLeadForm: true, showResourceMarquee: false,
        premiumEffects: false
      },
      blocks: { hero: "split", services: "list", gallery: "grid", testimonials: "cards", contact: "compact" }
    },
    showcase: {
      values: { intensity: 55, fontScale: 95, layoutScale: 100 },
      radios: {
        artDirection: "mosaic", contentMode: "visual", typography: "modern", motion: "cinematic",
        contentDensity: "balanced", imageRatio: "wide", contentWidth: "wide", heroSize: "balanced"
      },
      checks: {
        premiumEffects: true, showGallery: true, showTrustRail: true, showTestimonials: true,
        showResourceMarquee: false, showFaq: false, showLeadForm: false, showConversionDock: true
      },
      blocks: { hero: "collage", services: "spotlight", gallery: "mosaic", testimonials: "quotes", contact: "compact" },
      sectionOrder: ["gallery", "services", "testimonials", "features", "map", "booking", "lead", "faq", "menu", "store"]
    },
    wideImages: {
      radios: { artDirection: "editorial", imageRatio: "wide", contentWidth: "wide", heroSize: "balanced" },
      checks: { showGallery: true },
      blocks: { hero: "split", gallery: "grid" }
    }
  };

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
    privacyUrl: "",
    designPack: "custom",
    artDirection: "auto",
    contentMode: "visual",
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
    showMenu: true,
    sectionOrder: DEFAULT_SECTION_ORDER,
    blockVariants: DEFAULT_BLOCK_VARIANTS,
    mediaMetadata: {},
    menuTitle: "Carta de temporada",
    menuIntro: "Producto local, fuego lento y platos pensados para compartir.",
    menuCurrency: "EUR",
    menuItems: [
      {
        category: "Para empezar",
        name: "Croquetas de vaca tudanca",
        price: 12,
        description: "Bechamel cremosa, carne guisada y jugo de asado."
      },
      {
        category: "Para empezar",
        name: "Puerro a la brasa",
        price: 11.5,
        description: "Avellana tostada, queso ahumado y vinagreta de hierbas."
      },
      {
        category: "Brasas",
        name: "Costilla glaseada",
        price: 24,
        description: "Cocinada a baja temperatura, lacada al fuego y acompanada de patata."
      },
      {
        category: "Brasas",
        name: "Pescado del Cantabrico",
        price: 26,
        description: "Pieza diaria, verduras de temporada y salsa de sus espinas."
      },
      {
        category: "Postres",
        name: "Tarta de queso ahumada",
        price: 8,
        description: "Cremosa, poco dulce y terminada junto a las brasas."
      },
      {
        category: "Postres",
        name: "Chocolate, sal y aceite",
        price: 7.5,
        description: "Chocolate intenso, escamas de sal y aceite de oliva."
      }
    ],
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
      location: "Sevilla",
      tagline: "Belleza con agenda llena, experiencia cuidada y reserva facil",
      description:
        "Un estudio de belleza con servicios claros, fotos aspiracionales, reservas por WhatsApp y chatbot para resolver dudas de tratamientos.",
      phone: "+34 954 000 781",
      email: "citas@lumastudio.es",
      address: "Zona Nervion, Sevilla",
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
      bookingUrl: "https://wa.me/34954000781",
      privacyUrl: "pages/privacy-demo.html",
      google: {
        enabled: true,
        placeId: "",
        mapsUrl: "https://maps.google.com/",
        reviewUrl: "https://g.page/r/",
        appointmentUrl: "https://wa.me/34954000781",
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

  const defaultSectorPreset = sectorPresets.beauty;

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
      paper: "#1b1a17",
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
      bg: "#f3f1ea",
      paper: "#fbfaf6",
      ink: "#272a28",
      muted: "#6d706c",
      accent2: "#7f8f84"
    }
  };

  function hexToRgb(color) {
    const normalized = String(color || "").trim().replace(/^#/, "");
    const value = normalized.length === 3
      ? normalized.split("").map((part) => `${part}${part}`).join("")
      : normalized;

    if (!/^[0-9a-f]{6}$/i.test(value)) {
      return null;
    }

    const integer = Number.parseInt(value, 16);
    return {
      r: (integer >> 16) & 255,
      g: (integer >> 8) & 255,
      b: integer & 255
    };
  }

  function relativeLuminance(color) {
    const rgb = hexToRgb(color);

    if (!rgb) {
      return 0;
    }

    const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
      const value = channel / 255;
      return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });

    return (0.2126 * channels[0]) + (0.7152 * channels[1]) + (0.0722 * channels[2]);
  }

  function contrastRatio(colorA, colorB) {
    const lighter = Math.max(relativeLuminance(colorA), relativeLuminance(colorB));
    const darker = Math.min(relativeLuminance(colorA), relativeLuminance(colorB));
    return (lighter + 0.05) / (darker + 0.05);
  }

  function highestContrast(background, colors) {
    return colors.reduce((best, color) => (
      contrastRatio(background, color) > contrastRatio(background, best) ? color : best
    ), colors[0]);
  }

  function getContrastTokens(accent, palette) {
    const neutralCandidates = [palette.ink, palette.paper, "#111316", "#ffffff"];
    const solid = relativeLuminance(palette.bg) < 0.35 ? palette.bg : palette.ink;
    const onSolid = highestContrast(solid, neutralCandidates);
    const onAccent = highestContrast(accent, ["#111316", "#ffffff"]);
    const accentReadable = Math.min(
      contrastRatio(accent, palette.bg),
      contrastRatio(accent, palette.paper)
    ) >= 4.5
      ? accent
      : highestContrast(palette.bg, [palette.ink, palette.paper]);
    const accentOnSolid = contrastRatio(accent, solid) >= 3 ? accent : onSolid;

    return { solid, onSolid, onAccent, accentReadable, accentOnSolid };
  }

  const designPacks = {
    boutique: {
      label: "Boutique",
      artDirection: "atelier",
      contentMode: "visual",
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
      artDirection: "kinetic",
      contentMode: "visual",
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
      artDirection: "editorial",
      contentMode: "balanced",
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
      artDirection: "mosaic",
      contentMode: "visual",
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
      artDirection: "poster",
      contentMode: "visual",
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
      artDirection: "cinematic",
      contentMode: "balanced",
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

  const artDirectionOptions = ["cinematic", "editorial", "poster", "mosaic", "atelier", "kinetic"];

  studio.catalog = {
    SECTION_DEFINITIONS,
    DEFAULT_SECTION_ORDER,
    BLOCK_LIBRARY,
    DEFAULT_BLOCK_VARIANTS,
    LAYOUT_RECIPES,
    QUICK_CREATIVE_DIRECTIONS,
    QUICK_ACTION_RECIPES,
    demoBusiness,
    sectorPresets,
    defaultSectorPreset,
    themePalette,
    getContrastTokens,
    designPacks,
    heroSizeMap,
    contentWidthMap,
    densityLayoutMap,
    artDirectionOptions
  };
})(globalThis);
