(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.core = {
    parseLines,
    cloneData,
    parsePairs,
    serializeMenuItems,
    parseMenuItems,
    normalizeMenuItems,
    normalizeMenuItem,
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
        const [category, name, price, description = "", emoji = "", featured = ""] = line.split("|").map((part) => part.trim());
        return normalizeMenuItem({ category, name, price, description, emoji, featured }, index);
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
      featured
    };
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
