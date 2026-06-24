(function (global) {
  function generatePitch(business = {}) {
    const name = clean(business.name) || "vuestro negocio";
    const category = normalize(business.categoryKey || business.category);
    const proof = buildProof(business);
    const value = getCategoryValue(category);

    return `Hola, he visto ${name} en Google Maps y me ha llamado la atención que todavía no tengáis una web propia. ${proof} Una web sencilla con ${value} podría ayudaros a convertir más búsquedas locales en clientes. Puedo prepararos una demo visual sin compromiso.`;
  }

  function getSuggestedPositioning(business = {}) {
    const city = clean(business.city) || "la zona";
    const category = normalize(business.categoryKey || business.category);
    if (includesAny(category, ["restaurant", "restaurante", "bar", "cafe", "cafeteria"])) {
      return `El lugar de ${city} que convierte búsquedas de “dónde comer” en reservas directas.`;
    }
    if (includesAny(category, ["clinic", "clinica", "dentist", "dentista"])) {
      return `Atención profesional y cercana en ${city}, con servicios claros y cita fácil.`;
    }
    if (includesAny(category, ["hairdresser", "peluqueria", "beauty"])) {
      return `Resultados que se ven, confianza local y reserva de cita sin fricción.`;
    }
    if (includesAny(category, ["workshop", "taller"])) {
      return `El taller de confianza en ${city}: servicios transparentes y contacto rápido.`;
    }
    if (includesAny(category, ["hotel"])) {
      return `Una estancia con personalidad local que empieza antes de la llegada.`;
    }
    if (includesAny(category, ["real_estate", "inmobiliaria"])) {
      return `Experiencia inmobiliaria local para captar propietarios y compradores en ${city}.`;
    }
    return `Una referencia local en ${city}, fácil de descubrir, entender y contactar.`;
  }

  function getSuggestedSections(business = {}) {
    const category = normalize(business.categoryKey || business.category);
    if (includesAny(category, ["restaurant", "restaurante", "bar", "cafe", "cafeteria"])) {
      return ["Hero", "Carta", "Reservas", "Galería", "Mapa", "Reseñas", "Contacto"];
    }
    if (includesAny(category, ["clinic", "clinica", "dentist", "dentista"])) {
      return ["Hero", "Servicios", "Equipo", "Citas", "Reseñas", "Mapa", "Contacto"];
    }
    if (includesAny(category, ["hairdresser", "peluqueria", "beauty"])) {
      return ["Hero", "Servicios", "Precios", "Reservar cita", "Galería", "Reseñas", "Contacto"];
    }
    if (includesAny(category, ["workshop", "taller"])) {
      return ["Hero", "Servicios", "Marcas", "Pedir presupuesto", "Reseñas", "Mapa", "Contacto"];
    }
    if (includesAny(category, ["hotel"])) {
      return ["Hero", "Habitaciones", "Reservas", "Galería", "Entorno", "Reseñas", "Contacto"];
    }
    if (includesAny(category, ["real_estate", "inmobiliaria"])) {
      return ["Hero", "Propiedades", "Servicios", "Valoración", "Reseñas", "Zona", "Contacto"];
    }
    return ["Hero", "Servicios", "Galería", "Reseñas", "Mapa", "Contacto"];
  }

  function getSuggestedCTA(business = {}) {
    const category = normalize(business.categoryKey || business.category);
    if (includesAny(category, ["restaurant", "restaurante", "bar", "cafe", "cafeteria"])) return "Reservar mesa";
    if (includesAny(category, ["clinic", "clinica", "dentist", "dentista", "hairdresser", "peluqueria"])) return "Reservar cita";
    if (includesAny(category, ["hotel"])) return "Consultar disponibilidad";
    if (includesAny(category, ["real_estate", "inmobiliaria"])) return "Solicitar valoración";
    return "Pedir información";
  }

  function getCategoryValue(category) {
    if (includesAny(category, ["restaurant", "restaurante", "bar", "cafe", "cafeteria"])) return "carta, reservas, mapa y reseñas";
    if (includesAny(category, ["clinic", "clinica", "dentist", "dentista"])) return "servicios, equipo, citas y reseñas";
    if (includesAny(category, ["hairdresser", "peluqueria", "beauty"])) return "servicios, precios, galería y reserva de cita";
    if (includesAny(category, ["workshop", "taller"])) return "servicios, presupuestos, mapa y contacto rápido";
    if (includesAny(category, ["hotel"])) return "habitaciones, galería, reservas y recomendaciones de la zona";
    if (includesAny(category, ["real_estate", "inmobiliaria"])) return "propiedades, captación, valoraciones y contacto";
    return "servicios, reseñas, mapa y contacto directo";
  }

  function buildProof(business) {
    const rating = Number(business.rating || 0);
    const reviews = Number(business.reviews || 0);
    if (rating > 4 && reviews >= 20) return `Tenéis una presencia local muy buena, con ${rating.toFixed(1)} estrellas y ${reviews} reseñas.`;
    if (reviews >= 10) return `Ya contáis con ${reviews} reseñas, una señal clara de interés local.`;
    return "Ya tenéis visibilidad local y una propuesta que merece un escaparate propio.";
  }

  function includesAny(value, candidates) {
    return candidates.some((candidate) => value.includes(candidate));
  }

  function normalize(value) {
    return clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function clean(value) {
    return String(value || "").trim();
  }

  global.DLSRadarPitch = {
    generatePitch,
    getSuggestedPositioning,
    getSuggestedSections,
    getSuggestedCTA
  };
})(globalThis);
