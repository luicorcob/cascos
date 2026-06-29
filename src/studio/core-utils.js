(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};
  const ALLERGEN_ICON_BASE = "Alergenos/";
  const MENU_ALLERGENS = Object.freeze([
    { id: "gluten", label: "Gluten", symbol: "GL", icon: `${ALLERGEN_ICON_BASE}IconoAlergenoGluten-Gluten_icon-icons.com_67600.png` },
    { id: "crustaceos", label: "Crustaceos", symbol: "CR", icon: `${ALLERGEN_ICON_BASE}IconoAlergenoCrustaceo-Crustaceans_icon-icons.com_67603.png` },
    { id: "huevos", label: "Huevos", symbol: "HU", icon: `${ALLERGEN_ICON_BASE}IconoAlergenoHuevo-Egg_icon-icons.com_67598.png` },
    { id: "pescado", label: "Pescado", symbol: "PE", icon: `${ALLERGEN_ICON_BASE}Fish_icon-icons.com_67594.png` },
    { id: "cacahuetes", label: "Cacahuetes", symbol: "CA", icon: `${ALLERGEN_ICON_BASE}IconoAlergenoCacahuete-Peanuts_icon-icons.com_67604.png` },
    { id: "soja", label: "Soja", symbol: "SO", icon: `${ALLERGEN_ICON_BASE}Soy_icon-icons.com_67593.png` },
    { id: "leche", label: "Leche / lactosa", symbol: "LA", icon: `${ALLERGEN_ICON_BASE}IconoAlergenoLacteos-DairyProducts_icon-icons.com_67597.png` },
    { id: "frutos-cascara", label: "Frutos de cascara", symbol: "FC", icon: `${ALLERGEN_ICON_BASE}IconoAlergenoFrutosCascaraPeelFruits_icon-icons.com_67601.png` },
    { id: "apio", label: "Apio", symbol: "AP", icon: `${ALLERGEN_ICON_BASE}IconoAlergenoApio-Celery_icon-icons.com_67605.png` },
    { id: "mostaza", label: "Mostaza", symbol: "MO", icon: `${ALLERGEN_ICON_BASE}IconoAlergenoMostaza-Mustard_icon-icons.com_67595.png` },
    { id: "sesamo", label: "Sesamo", symbol: "SE", icon: `${ALLERGEN_ICON_BASE}IconoAlergenoGranosSesamo-SesameGrains_icon-icons.com_67599.png` },
    { id: "sulfitos", label: "Sulfitos", symbol: "SO2", icon: `${ALLERGEN_ICON_BASE}IconoAlergenoDioxidoAzufreSulfitosSulfurDioxideSulphites_icon-icons.com_67602.png` },
    { id: "altramuces", label: "Altramuces", symbol: "AL", icon: `${ALLERGEN_ICON_BASE}IconoAlergenoAltramuces-Lupins_icon-icons.com_67606.png` },
    { id: "moluscos", label: "Moluscos", symbol: "ML", icon: `${ALLERGEN_ICON_BASE}IconoAlergenoMoluscos-Mollusks_icon-icons.com_67596.png` }
  ].map(Object.freeze));
  const MENU_ALLERGEN_IDS = new Set(MENU_ALLERGENS.map((allergen) => allergen.id));
  const MENU_ALLERGEN_ALIASES = buildMenuAllergenAliases();

  studio.core = {
    parseLines,
    cloneData,
    parsePairs,
    menuAllergens: MENU_ALLERGENS,
    serializeMenuItems,
    parseMenuItems,
    normalizeMenuItems,
    normalizeMenuItem,
    normalizeMenuAllergens,
    normalizeMenuAllergenId,
    getMenuAllergen,
    groupMenuItems,
    isFoodCategory,
    parsePrice,
    roundMoney,
    formatPlainPrice,
    normalizeCurrency,
    formatMoney,
    textOr,
    numberOr,
    clampNumber,
    normalizeChoice,
    normalizeSectionOrder,
    sectionBaseKey,
    splitTitleBody,
    normalizeImage,
    normalizeUrl,
    normalizeOptionalUrl,
    normalizeText,
    matchesAny,
    hasSharedToken,
    looksLikeLeadDetails,
    phoneHref,
    initials,
    slugify,
    motionMultiplier,
    escapeHtml,
    escapeAttr
  };

  function parseLines(value) {
    return String(value || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
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

  function serializeMenuItems(items = []) {
    return JSON.stringify(
      normalizeMenuItems(items).map((item) => ({
        id: item.id,
        name: item.name,
        desc: item.description,
        precio: item.price,
        cat: item.category,
        emoji: item.emoji,
        allergens: item.allergens,
        featured: item.featured
      })),
      null,
      2
    );
  }

  function parseMenuItems(value) {
    if (Array.isArray(value)) {
      return normalizeMenuItems(value);
    }

    const source = String(value || "").trim();
    if (!source) {
      return [];
    }

    if (source.startsWith("[")) {
      try {
        const parsed = JSON.parse(source);
        return normalizeMenuItems(parsed);
      } catch (error) {
        return [];
      }
    }

    return parseLines(value)
      .map((line, index) => {
        const [category, name, price, description = "", emoji = "", featured = "", allergens = ""] = line.split("|").map((part) => part.trim());
        return normalizeMenuItem({ category, name, price, description, emoji, featured, allergens }, index);
      })
      .filter((item) => item.name && item.price > 0);
  }

  function normalizeMenuItems(items = []) {
    if (!Array.isArray(items)) {
      return [];
    }

    const seenIds = new Set();

    return items
      .map((item, index) => normalizeMenuItem(item, index))
      .filter((item) => item.name && item.price > 0)
      .map((item, index) => {
        const fallbackId = slugify(`${item.category}-${item.name}`) || `plato-${index + 1}`;
        const baseId = slugify(item.id || fallbackId) || fallbackId;
        let id = baseId;
        let suffix = 2;

        while (seenIds.has(id)) {
          id = `${baseId}-${suffix}`;
          suffix += 1;
        }

        seenIds.add(id);
        return { ...item, id };
      });
  }

  function normalizeMenuItem(item = {}, index = 0) {
    const category = textOr(item.category ?? item.cat, "Carta");
    const description = textOr(item.description ?? item.desc, "");
    const price = parsePrice(item.price ?? item.precio);
    const name = textOr(item.name, "");
    const id = textOr(item.id, slugify(`${category}-${name}`) || `plato-${index + 1}`);
    const emoji = textOr(item.emoji ?? item.icon, "🍽");
    const allergens = normalizeMenuAllergens(item.allergens ?? item.alergenos ?? item.allergenos ?? item.allergensIds ?? item.allergenIds ?? item.traces);
    const featured = item.featured === true
      || item.featured === "true"
      || item.featured === "on"
      || item.featured === "1"
      || item.destacado === true;

    return {
      id,
      category,
      cat: category,
      name,
      price,
      precio: price,
      description,
      desc: description,
      emoji,
      allergens,
      featured
    };
  }

  function normalizeMenuAllergens(value = []) {
    let source = [];

    if (Array.isArray(value)) {
      source = value;
    } else if (value && typeof value === "object") {
      source = [value];
    } else {
      const text = String(value || "").trim();
      if (!text) {
        return [];
      }

      if (text.startsWith("[")) {
        try {
          return normalizeMenuAllergens(JSON.parse(text));
        } catch (error) {
          return [];
        }
      }

      source = text.split(/\s*[,;|]\s*/).filter(Boolean);
    }

    const selected = new Set(source.map(normalizeMenuAllergenId).filter(Boolean));
    return MENU_ALLERGENS.map((allergen) => allergen.id).filter((id) => selected.has(id));
  }

  function normalizeMenuAllergenId(value) {
    const raw = value && typeof value === "object"
      ? value.id ?? value.allergen ?? value.key ?? value.label ?? value.name
      : value;
    const key = menuAllergenAliasKey(raw);
    return MENU_ALLERGEN_ALIASES[key] || (MENU_ALLERGEN_IDS.has(key) ? key : "");
  }

  function getMenuAllergen(value) {
    const id = normalizeMenuAllergenId(value);
    return MENU_ALLERGENS.find((allergen) => allergen.id === id) || null;
  }

  function buildMenuAllergenAliases() {
    const aliases = {};
    const add = (alias, id) => {
      const key = menuAllergenAliasKey(alias);
      if (key && MENU_ALLERGEN_IDS.has(id)) {
        aliases[key] = id;
      }
    };

    MENU_ALLERGENS.forEach((allergen) => {
      add(allergen.id, allergen.id);
      add(allergen.label, allergen.id);
      add(allergen.symbol, allergen.id);
    });

    Object.entries({
      "cereales": "gluten",
      "cereales con gluten": "gluten",
      "trigo": "gluten",
      "centeno": "gluten",
      "cebada": "gluten",
      "avena": "gluten",
      "espelta": "gluten",
      "kamut": "gluten",
      "crustaceo": "crustaceos",
      "marisco": "crustaceos",
      "mariscos": "crustaceos",
      "huevo": "huevos",
      "egg": "huevos",
      "fish": "pescado",
      "cacahuete": "cacahuetes",
      "mani": "cacahuetes",
      "soya": "soja",
      "lactosa": "leche",
      "lacteo": "leche",
      "lacteos": "leche",
      "frutos secos": "frutos-cascara",
      "fruto seco": "frutos-cascara",
      "frutos con cascara": "frutos-cascara",
      "nueces": "frutos-cascara",
      "almendras": "frutos-cascara",
      "avellanas": "frutos-cascara",
      "pistachos": "frutos-cascara",
      "ajonjoli": "sesamo",
      "dioxido de azufre": "sulfitos",
      "dioxido de azufre y sulfitos": "sulfitos",
      "so2": "sulfitos",
      "sulphites": "sulfitos",
      "sulfites": "sulfitos",
      "altramuz": "altramuces",
      "lupino": "altramuces",
      "lupin": "altramuces",
      "molusco": "moluscos"
    }).forEach(([alias, id]) => add(alias, id));

    return aliases;
  }

  function menuAllergenAliasKey(value) {
    return normalizeText(value)
      .replace(/&/g, " y ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function groupMenuItems(items = []) {
    const groups = new Map();

    normalizeMenuItems(items).forEach((item) => {
      if (!groups.has(item.category)) {
        groups.set(item.category, []);
      }
      groups.get(item.category).push(item);
    });

    return Array.from(groups, ([category, groupItems]) => ({ category, items: groupItems }));
  }

  function isFoodCategory(category) {
    return matchesAny(normalizeText(category), [
      "restaurante",
      "bar",
      "cafeteria",
      "cafe",
      "kebab",
      "comida",
      "cocina",
      "pizzeria",
      "panaderia"
    ]);
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

  function normalizeSectionOrder(value, allowed = []) {
    const source = Array.isArray(value)
      ? value
      : String(value || "").split(/[\s,|]+/);
    const valid = new Set(allowed);
    const seenTokens = new Set();
    const seenBases = new Set();
    const ordered = source
      .map((item) => String(item || "").trim())
      .filter((item) => {
        const base = sectionBaseKey(item);
        if (!valid.has(base) || seenTokens.has(item)) {
          return false;
        }
        seenTokens.add(item);
        seenBases.add(base);
        return true;
      });

    allowed.forEach((item) => {
      if (!seenBases.has(item)) {
        ordered.push(item);
      }
    });

    return ordered;
  }

  function sectionBaseKey(value) {
    return String(value || "").trim().split("__copy")[0];
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
      body: serviceBodyForTitle(text)
    };
  }

  function serviceBodyForTitle(value) {
    const title = textOr(value, "Servicio");
    const key = normalizeText(title);
    const exact = {
      "carta y especialidades": "Platos de temporada, raciones para compartir y sugerencias de la casa explicadas sin rodeos.",
      "reservas": "Escribenos con dia, hora y numero de personas; te confirmamos la mesa en cuanto revisemos disponibilidad.",
      "menus para grupos": "Preparamos menus cerrados para comidas de empresa, cumpleanos y reuniones con antelacion.",
      "eventos": "Abrimos el espacio para celebraciones privadas, copas y reuniones con menu acordado.",
      "opciones especiales": "Si vienes con alergias o preferencias, avisanos y te orientamos con la carta.",
      "primera consulta": "Revisamos tu caso con calma y te indicamos el siguiente paso antes de empezar cualquier tratamiento.",
      "tratamientos y especialidades": "Te explicamos cada tratamiento, duracion aproximada y cuidados necesarios antes de reservar.",
      "tratamientos": "Trabajamos el tratamiento que necesitas con diagnostico previo y seguimiento cercano.",
      "seguimiento": "Acompanamos la evolucion con revisiones claras y pautas faciles de seguir en casa.",
      "cita previa": "Reserva tu hora por telefono o WhatsApp y ven sin esperas innecesarias.",
      "atencion personalizada": "Te atendemos con tiempo, escuchando lo que necesitas y ajustando el servicio a tu caso.",
      "corte y peinado": "Corte adaptado a tu pelo, tu rutina y el acabado que quieres llevar cada dia.",
      "coloracion": "Color, mechas o matiz con prueba de tono y cuidado para mantener el brillo.",
      "novias y eventos": "Peinados y preparacion para bodas, fiestas y citas senaladas con reserva anticipada.",
      "reserva de cita": "Mandanos el servicio que quieres y buscamos el hueco que mejor encaje contigo.",
      "mantenimiento": "Revisamos puntos clave del vehiculo y te avisamos antes de hacer cualquier trabajo extra.",
      "diagnostico": "Comprobamos la averia con herramientas de taller y te damos una explicacion clara.",
      "reparaciones": "Trabajamos frenos, motor, electricidad y desgaste habitual con presupuesto previo.",
      "neumaticos": "Cambio, equilibrado y revision de presion segun uso, medida y temporada.",
      "presupuesto sin compromiso": "Cuentanos que necesitas y te orientamos con precio y plazo antes de empezar.",
      "venta de propiedades": "Preparamos la vivienda, filtramos visitas y acompanamos la venta hasta la firma.",
      "alquiler": "Gestionamos visitas, documentacion y condiciones para alquilar con tranquilidad.",
      "valoracion": "Valoramos tu inmueble con datos de la zona y estado real de la vivienda.",
      "captacion": "Si quieres vender, revisamos tu caso y te decimos como podemos ayudarte.",
      "asesoramiento": "Resolvemos dudas de precio, plazos y documentacion antes de tomar una decision.",
      "servicio principal": "Cuida lo que necesitas con atencion directa, explicacion clara y trato cercano.",
      "presupuesto": "Te damos una orientacion de precio y plazo antes de confirmar el encargo.",
      "contacto directo": "Llama o escribe por WhatsApp y te respondemos en cuanto estemos disponibles."
    };

    if (exact[key]) return exact[key];
    if (key.includes("carta") || key.includes("menu")) return "Consulta platos, precios y sugerencias antes de venir o pedir para llevar.";
    if (key.includes("reserva") || key.includes("cita")) return "Escribenos con el dia que prefieres y te confirmamos disponibilidad cuanto antes.";
    if (key.includes("grupo")) return "Organizamos mesas y menus para grupos con aviso previo y trato directo.";
    if (key.includes("whatsapp")) return "Mandanos los datos por WhatsApp y te respondemos con la opcion mas practica.";
    if (key.includes("delivery") || key.includes("recoger") || key.includes("pedido")) return "Preparamos tu pedido para recoger o enviar segun disponibilidad del dia.";
    if (key.includes("stock")) return "Consultanos disponibilidad antes de desplazarte y te confirmamos si lo tenemos en tienda.";
    if (key.includes("color") || key.includes("balayage")) return "Revisamos tu base, el tono que buscas y el mantenimiento antes de aplicar color.";
    if (key.includes("impres") || key.includes("copia")) return "Imprimimos en blanco y negro o color, con opciones para trabajos, apuntes y oficina.";

    return `Trabajamos ${title.toLowerCase()} con atencion directa, tiempos claros y cuidado en cada detalle.`;
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
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

    if (/^(https?:|mailto:|tel:|sms:|whatsapp:)/i.test(url) || url.startsWith("#") || /^(\/|\.\/|\.\.\/)/.test(url) || /^[a-z0-9_-]+(?:\/[a-z0-9_.-]+)+$/i.test(url)) {
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
})(globalThis);
