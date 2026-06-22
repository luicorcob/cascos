(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  const STOCK_IMAGE_CATEGORIES = [
    { id: "food", label: "Gastronomia", query: "restaurant interior", fallbackQueries: ["restaurant food", "dining table"], keywords: ["restaurant", "food", "dining", "chef", "kitchen", "meal", "table"] },
    { id: "coffee", label: "Cafe", query: "coffee shop", fallbackQueries: ["barista cafe", "coffee counter"], keywords: ["coffee", "cafe", "barista", "espresso", "cup", "counter"] },
    { id: "bakery", label: "Panaderia", query: "artisan bakery", fallbackQueries: ["bread shop", "pastry display"], keywords: ["bakery", "bread", "pastry", "cake", "artisan", "display"] },
    { id: "beauty", label: "Belleza", query: "hair salon interior", fallbackQueries: ["beauty salon", "cosmetic studio"], keywords: ["beauty", "salon", "hair", "cosmetic", "makeup", "spa"], minimumScore: 2 },
    { id: "fashion", label: "Moda", query: "fashion boutique", fallbackQueries: ["clothing store", "clothes rack"], keywords: ["fashion", "boutique", "clothing", "clothes", "apparel", "rack"] },
    { id: "retail", label: "Comercio", query: "retail store", fallbackQueries: ["local shop", "store interior"], keywords: ["retail", "store", "shop", "storefront", "counter", "display"] },
    { id: "health", label: "Salud", query: "modern clinic", fallbackQueries: ["wellness center", "physical therapy"], keywords: ["clinic", "health", "wellness", "therapy", "medical", "care"] },
    { id: "fitness", label: "Deporte", query: "fitness studio", fallbackQueries: ["modern gym", "yoga studio"], keywords: ["fitness", "gym", "yoga", "training", "exercise", "studio"] },
    { id: "home", label: "Interiores", query: "furniture showroom", fallbackQueries: ["modern living room", "interior design studio"], keywords: ["interior", "furniture", "decor", "room", "design", "showroom"], minimumScore: 2 },
    { id: "events", label: "Eventos", query: "event venue", fallbackQueries: ["wedding venue", "event decoration"], keywords: ["event", "venue", "wedding", "decoration", "celebration", "table"] },
    { id: "office", label: "Trabajo", query: "coworking workspace", fallbackQueries: ["office interior desk", "creative workspace"], keywords: ["office", "workspace", "coworking", "desk", "team", "meeting"], minimumScore: 2 },
    { id: "travel", label: "Hoteles", query: "hotel interior", fallbackQueries: ["hotel lobby", "hotel room"], keywords: ["hotel", "lobby", "room", "resort", "hospitality", "travel"] },
    { id: "product", label: "Producto", query: "product packaging photography", fallbackQueries: ["handmade product display", "commercial product studio"], keywords: ["product", "packaging", "handmade", "studio", "display", "brand"], minimumScore: 2 },
    { id: "architecture", label: "Fachadas", query: "shop storefront", fallbackQueries: ["business facade exterior", "retail shop exterior"], keywords: ["storefront", "facade", "shop", "business", "exterior", "building"], minimumScore: 2 },
    { id: "nature", label: "Flores y plantas", query: "florist flower shop", fallbackQueries: ["plant store garden", "garden center plants"], keywords: ["plant", "flower", "florist", "garden", "green", "store"], minimumScore: 2 },
    { id: "technology", label: "Tecnologia", query: "computer workspace", fallbackQueries: ["technology office laptop", "digital studio computer"], keywords: ["computer", "technology", "digital", "workspace", "laptop", "device"], minimumScore: 2 },
    { id: "art", label: "Arte y oficios", query: "creative art studio", fallbackQueries: ["ceramic workshop", "art gallery interior"], keywords: ["art", "studio", "ceramic", "workshop", "gallery", "creative"], minimumScore: 2 },
    { id: "education", label: "Libros y formacion", query: "bookstore interior", fallbackQueries: ["library books", "study desk"], keywords: ["book", "bookstore", "library", "study", "desk", "education"] },
    { id: "mobility", label: "Motor y bicis", query: "auto repair shop", fallbackQueries: ["bicycle shop", "car workshop"], keywords: ["auto", "car", "bicycle", "bike", "repair", "workshop"] },
    { id: "pets", label: "Mascotas", query: "dog grooming salon", fallbackQueries: ["veterinary clinic dog", "pet store animals"], keywords: ["pet", "dog", "cat", "grooming", "veterinary", "shop"], minimumScore: 2 }
  ];

  const BLOCKED_STOCK_TERMS = [
    "baby", "babies", "child", "children", "kid", "kids", "toddler", "infant", "boy", "girl", "teenager", "minor",
    "dead", "death", "deceased", "corpse", "carcass", "cadaver", "skull", "skeleton", "bone", "bones", "mummy", "mummified", "fossil", "blood", "bloody", "gore", "wound", "injured",
    "surgery", "operation", "autopsy", "pathology", "disease", "specimen", "x-ray", "xray",
    "bat", "bats", "murcielago", "tuk tuk", "tuk-tuk", "tuktuk", "rickshaw",
    "gun", "weapon", "rifle", "pistol", "war", "military", "violence", "accident", "disaster", "crime", "police",
    "nude", "naked", "erotic", "insect", "spider", "snake", "taxidermy",
    "archive", "historical", "museum", "funeral", "cemetery", "grave", "wildlife", "zoo",
    "artwork", "artworks", "painting", "engraving", "drawing", "manuscript", "author died",
    "pet shop boys", "power plant", "sewage", "beetle", "fishermen", "shell collection",
    "church", "chapel", "cathedral", "mosque", "temple", "historic", "19th century", "18th century",
    "attack", "assassination", "zamachu", "charities photographs"
  ];

  studio.stockImages = {
    STOCK_IMAGE_CATEGORIES,
    createStockImageSearch,
    normalizeStockImageResult
  };

  function createStockImageSearch(options = {}) {
    const fetcher = options.fetcher || global.fetch?.bind(global);
    const endpoints = normalizeEndpoints(options.endpoint || options.endpoints);
    const pageSize = Math.max(6, Math.min(48, Number(options.pageSize || 18)));
    const timeoutMs = Math.max(1500, Number(options.timeoutMs || 6000));
    const licenses = String(options.licenses || "cc0").trim() || "cc0";
    const catalogMinItems = Math.max(1, Number(options.catalogMinItems || 200));
    const catalogTargetItems = Math.max(catalogMinItems, Number(options.catalogTargetItems || 240));
    const catalogPageSize = Math.max(6, Math.min(48, Number(options.catalogPageSize || 12)));
    const catalogConcurrency = Math.max(1, Math.min(8, Number(options.catalogConcurrency || 4)));
    const builtInItems = buildBuiltInStockItems();

    return {
      categories: STOCK_IMAGE_CATEGORIES,
      builtInItems,
      search,
      discover
    };

    async function search(params = {}) {
      if (!fetcher) {
        throw new Error("La busqueda de imagenes necesita fetch disponible.");
      }

      const page = Math.max(1, Number(params.page || 1));
      const requestedPageSize = Math.max(6, Math.min(48, Number(params.pageSize || pageSize)));
      const terms = buildQuery(params);
      let lastError = null;

      for (const endpoint of endpoints) {
        try {
          const url = buildOpenverseUrl(endpoint, { terms, page, pageSize: requestedPageSize, licenses });
          const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
          const timeout = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
          let response;
          try {
            response = await fetcher(url.toString(), {
              headers: { accept: "application/json" },
              signal: controller?.signal
            });
          } finally {
            if (timeout) clearTimeout(timeout);
          }

          if (!response.ok) {
            throw new Error(`Openverse respondio ${response.status}`);
          }

          const payload = await response.json();
          const results = Array.isArray(payload.results) ? payload.results : [];
          return {
            query: terms,
            page,
            total: Math.max(0, Number(payload.result_count || 0)),
            hasNext: Boolean(payload.next),
            items: results.map(normalizeStockImageResult).filter(Boolean).filter(isSafeStockItem)
          };
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error("No se pudieron cargar imagenes libres.");
    }

    async function discover(params = {}) {
      if (!fetcher) {
        throw new Error("La galeria de imagenes necesita fetch disponible.");
      }

      const requestedIds = new Set(Array.isArray(params.categoryIds) ? params.categoryIds : []);
      const categories = requestedIds.size
        ? STOCK_IMAGE_CATEGORIES.filter((category) => requestedIds.has(category.id))
        : STOCK_IMAGE_CATEGORIES;
      const minItems = Math.max(1, Number(params.minItems || catalogMinItems));
      const targetItems = Math.max(minItems, Number(params.targetItems || catalogTargetItems));
      const batchSize = Math.max(6, Math.min(48, Number(params.pageSize || catalogPageSize)));
      const maxPages = Math.max(1, Math.min(5, Number(params.maxPages || 3)));
      const concurrency = Math.max(1, Math.min(8, Number(params.concurrency || catalogConcurrency)));
      const perCategoryTarget = Math.max(1, Math.ceil(targetItems / Math.max(1, categories.length)));
      const initial = await mapWithConcurrency(categories, concurrency, (category) => (
        collectCategory(category, perCategoryTarget, batchSize)
      ));
      let total = initial.reduce((sum, result) => sum + result.total, 0);
      let items = appendRoundRobin([], initial.map((result) => result.items), targetItems);

      for (let page = 2; page <= maxPages && items.length < targetItems; page += 1) {
        const supplements = await mapWithConcurrency(categories, concurrency, (category) => (
          searchCategoryPage(category, page, batchSize)
        ));
        const previousLength = items.length;
        total += supplements.reduce((sum, result) => sum + result.total, 0);
        items = appendRoundRobin(items, supplements.map((result) => result.items), targetItems);
        if (items.length === previousLength) {
          break;
        }
      }

      if (!items.length) {
        throw new Error("No se pudo preparar la galeria libre.");
      }

      return {
        query: "",
        page: 1,
        total,
        hasNext: false,
        categoryCount: new Set(items.map((item) => item.category)).size,
        items
      };
    }

    async function collectCategory(category, limit, batchSize) {
      const terms = [category.query, ...(category.fallbackQueries || [])];
      let items = [];
      let total = 0;

      for (const query of terms) {
        if (items.length >= limit) {
          break;
        }
        const result = await safeSearch({ query, page: 1, pageSize: batchSize });
        total += result.total;
        items = appendUnique(items, prepareCategoryItems(result.items, category), limit);
      }

      return { total, items };
    }

    async function searchCategoryPage(category, page, batchSize) {
      const result = await safeSearch({ query: category.query, page, pageSize: batchSize });
      return {
        total: result.total,
        items: prepareCategoryItems(result.items, category)
      };
    }

    async function safeSearch(params) {
      try {
        return await search(params);
      } catch (error) {
        return { total: 0, items: [], hasNext: false };
      }
    }
  }

  function normalizeEndpoints(value) {
    const fallback = [
      "/api/stock-images"
    ];

    if (Array.isArray(value)) {
      return [...value, ...fallback].filter(Boolean).map(String);
    }

    return [value, ...fallback].filter(Boolean).map(String);
  }

  function buildQuery(params = {}) {
    const category = STOCK_IMAGE_CATEGORIES.find((item) => item.id === params.category);
    const custom = String(params.query || "").trim();
    return [custom, category?.query].filter(Boolean).join(" ").trim() || "local business storefront";
  }

  function buildOpenverseUrl(endpoint, { terms, page, pageSize, licenses }) {
    const url = new URL(endpoint, global.location?.origin || "http://localhost");
    url.searchParams.set("q", terms);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(pageSize));
    url.searchParams.set("license", licenses);
    url.searchParams.set("extension", "jpg");
    url.searchParams.set("mature", "false");
    return url;
  }

  function normalizeStockImageResult(item = {}) {
    const url = firstHttp(item.url, item.foreign_landing_url);
    const thumbnail = firstHttp(item.thumbnail, item.url);

    if (!url || !thumbnail) {
      return null;
    }

    const title = String(item.title || "Imagen libre").trim();
    const creator = String(item.creator || "").trim();
    const provider = String(item.provider || item.source || "Openverse").trim();
    const license = String(item.license || "").trim().toUpperCase() || "CC0/PDM";
    const sourceUrl = firstHttp(item.foreign_landing_url, item.detail_url, item.url);

    return {
      id: String(item.id || url),
      title: title.slice(0, 120),
      creator: creator.slice(0, 80),
      provider: provider.slice(0, 80),
      license,
      sourceUrl,
      url,
      thumbnail,
      tags: normalizeTags(item.tags),
      alt: [title, creator].filter(Boolean).join(" - ").slice(0, 180)
    };
  }

  function firstHttp(...values) {
    return values
      .map((value) => String(value || "").trim())
      .find((value) => /^https?:\/\/\S+$/i.test(value)) || "";
  }

  function normalizeTags(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((tag) => typeof tag === "string" ? tag : tag?.name)
      .map((tag) => String(tag || "").trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 30);
  }

  function isSafeStockItem(item) {
    const text = normalizeSearchText([item.title, item.alt, ...(item.tags || [])].join(" "));
    return !BLOCKED_STOCK_TERMS.some((term) => hasSearchTerm(text, term));
  }

  async function mapWithConcurrency(items, limit, mapper) {
    const results = new Array(items.length);
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index], index);
      }
    }

    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
    return results;
  }

  function appendRoundRobin(existing, groups, limit) {
    const items = [...existing];
    const known = new Set(items.map((item) => item.url));
    const maxGroupLength = Math.max(0, ...groups.map((group) => group.length));

    for (let index = 0; index < maxGroupLength && items.length < limit; index += 1) {
      for (const group of groups) {
        const item = group[index];
        if (!item || known.has(item.url)) {
          continue;
        }
        known.add(item.url);
        items.push(item);
        if (items.length >= limit) {
          break;
        }
      }
    }

    return items;
  }

  function appendUnique(existing, candidates, limit) {
    const items = [...existing];
    const known = new Set(items.map((item) => item.url));
    for (const item of candidates) {
      if (!item || known.has(item.url)) {
        continue;
      }
      known.add(item.url);
      items.push(item);
      if (items.length >= limit) {
        break;
      }
    }
    return items;
  }

  function prepareCategoryItems(items, category) {
    return items
      .map((item, index) => ({
        item,
        index,
        text: normalizeSearchText([item.title, item.alt, ...(item.tags || [])].join(" "))
      }))
      .filter((candidate) => isSafeStockItem(candidate.item))
      .map((candidate) => ({
        ...candidate,
        score: (category.keywords || []).reduce((score, keyword) => (
          score + (hasSearchTerm(candidate.text, keyword) ? 1 : 0)
        ), 0)
      }))
      .filter((candidate) => candidate.score >= Math.max(1, Number(category.minimumScore || 1)))
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .map(({ item }) => ({
        ...item,
        category: category.id,
        categoryLabel: category.label
      }));
  }

  function normalizeSearchText(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function hasSearchTerm(text, term) {
    const normalized = normalizeSearchText(term);
    if (normalized.includes(" ") || normalized.includes("-")) {
      return text.includes(normalized);
    }
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalized)}([^a-z0-9]|$)`, "i").test(text);
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function buildBuiltInStockItems() {
    const catalog = studio.catalog || {};
    const curated = Array.isArray(studio.curatedStockItems)
      ? studio.curatedStockItems.filter(isSafeStockItem)
      : [];
    const presets = catalog.sectorPresets || {};
    const categoryByPreset = {
      restaurant: "food",
      clinic: "health",
      beauty: "beauty",
      gym: "fitness",
      bar: "coffee",
      stationery: "education",
      kebab: "food",
      bazaar: "retail"
    };
    const known = new Set(curated.map((item) => String(item.url || "").split("?")[0]));
    const items = [...curated];

    Object.entries(presets).forEach(([presetId, preset]) => {
      const categoryId = categoryByPreset[presetId] || "retail";
      const category = STOCK_IMAGE_CATEGORIES.find((entry) => entry.id === categoryId) || STOCK_IMAGE_CATEGORIES[0];
      const productImages = Array.isArray(preset.commerce?.products)
        ? preset.commerce.products.map((product) => product.image)
        : [];
      const urls = [preset.heroImage, ...(preset.gallery || []), ...productImages].filter(Boolean);

      urls.forEach((url, index) => {
        const identity = String(url).split("?")[0];
        if (!/^https:\/\/images\.unsplash\.com\//i.test(url) || known.has(identity)) {
          return;
        }
        known.add(identity);
        items.push({
          id: `builtin-${presetId}-${index}`,
          title: `${preset.name || category.label} · seleccion profesional ${index + 1}`,
          creator: "",
          provider: "Unsplash",
          license: "Unsplash License",
          sourceUrl: "https://unsplash.com/license",
          url,
          thumbnail: withImageWidth(url, 520),
          tags: [category.query, ...(category.keywords || [])],
          alt: `${preset.name || category.label} para negocio local`,
          category: category.id,
          categoryLabel: category.label,
          builtIn: true
        });
      });
    });

    return items;
  }

  function withImageWidth(url, width) {
    try {
      const parsed = new URL(url);
      parsed.searchParams.set("w", String(width));
      parsed.searchParams.set("q", "72");
      parsed.searchParams.set("auto", "format");
      parsed.searchParams.set("fit", "crop");
      return parsed.toString();
    } catch (error) {
      return url;
    }
  }
})(globalThis);
