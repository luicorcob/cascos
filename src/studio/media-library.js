(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.media = {
    createMediaLibrary,
    fileToDataUrl,
    getImageInfo
  };

  function createMediaLibrary(options = {}) {
    const storage = options.storage;
    const key = String(options.key || "locallift-studio-media-library");
    const maxItems = Math.max(1, Number(options.maxItems || 24));
    const maxItemBytes = Math.max(1024, Number(options.maxItemBytes || 1_500_000));
    const maxTotalBytes = Math.max(maxItemBytes, Number(options.maxTotalBytes || 8_000_000));

    return {
      list,
      add,
      update,
      remove,
      clear
    };

    function list() {
      if (!storage) {
        return [];
      }

      try {
        const parsed = JSON.parse(storage.getItem(key) || "[]");
        return Array.isArray(parsed) ? parsed.filter(isValidItem) : [];
      } catch (error) {
        return [];
      }
    }

    function add(input = {}) {
      const url = String(input.url || "").trim();
      if (!isSupportedUrl(url)) {
        throw new Error("La imagen debe usar una URL http(s) o un archivo local compatible.");
      }

      const items = list();
      const existing = items.find((item) => item.url === url);
      if (existing) {
        return existing;
      }

      if (items.length >= maxItems) {
        throw new Error(`La biblioteca admite un maximo de ${maxItems} imagenes.`);
      }

      const size = Math.max(0, Number(input.size || estimateBytes(url)));
      if (size > maxItemBytes) {
        throw new Error(`La imagen supera el limite de ${formatMb(maxItemBytes)} MB.`);
      }

      if (items.reduce((total, item) => total + Number(item.size || 0), 0) + size > maxTotalBytes) {
        throw new Error(`La biblioteca supera el limite total de ${formatMb(maxTotalBytes)} MB.`);
      }

      const item = {
        id: createId(url),
        name: String(input.name || inferName(url)).trim().slice(0, 80) || "Imagen",
        url,
        type: String(input.type || inferType(url)),
        size,
        width: Math.max(0, Number(input.width || 0)),
        height: Math.max(0, Number(input.height || 0)),
        alt: String(input.alt || "").trim().slice(0, 180),
        createdAt: new Date().toISOString()
      };
      persist([...items, item]);
      return item;
    }

    function update(id, changes = {}) {
      const items = list();
      const index = items.findIndex((item) => item.id === id);
      if (index < 0) {
        return null;
      }

      items[index] = {
        ...items[index],
        name: String(changes.name ?? items[index].name).trim().slice(0, 80) || items[index].name,
        alt: String(changes.alt ?? items[index].alt ?? "").trim().slice(0, 180),
        width: Math.max(0, Number(changes.width ?? items[index].width ?? 0)),
        height: Math.max(0, Number(changes.height ?? items[index].height ?? 0)),
        updatedAt: new Date().toISOString()
      };
      persist(items);
      return items[index];
    }

    function remove(id) {
      const items = list();
      const next = items.filter((item) => item.id !== id);
      persist(next);
      return next.length !== items.length;
    }

    function clear() {
      if (!storage) {
        return;
      }
      storage.removeItem(key);
    }

    function persist(items) {
      if (!storage) {
        throw new Error("El almacenamiento local no esta disponible.");
      }
      storage.setItem(key, JSON.stringify(items));
    }
  }

  async function fileToDataUrl(file, options = {}) {
    const source = await readFileAsDataUrl(file);
    if (
      !/^image\/(jpeg|png|webp)$/i.test(String(file.type || ""))
      || typeof document === "undefined"
      || typeof Image === "undefined"
    ) {
      return source;
    }

    try {
      const image = await loadImage(source);
      const maxDimension = Math.max(320, Number(options.maxDimension || 1600));
      const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const context = canvas.getContext("2d");
      if (!context) {
        return source;
      }
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL("image/webp", Number(options.quality || 0.82));
      return compressed.length < source.length ? compressed : source;
    } catch (error) {
      return source;
    }
  }

  async function getImageInfo(source) {
    const image = await loadImage(source);
    return {
      width: Math.max(0, Number(image.naturalWidth || 0)),
      height: Math.max(0, Number(image.naturalHeight || 0))
    };
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      if (!file || !String(file.type || "").startsWith("image/")) {
        reject(new Error("Selecciona un archivo de imagen."));
        return;
      }
      if (typeof FileReader === "undefined") {
        reject(new Error("Este entorno no permite leer archivos locales."));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
      reader.readAsDataURL(file);
    });
  }

  function loadImage(source) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("No se pudo preparar la imagen."));
      image.src = source;
    });
  }

  function isSupportedUrl(url) {
    return /^https?:\/\/\S+$/i.test(url) || /^data:image\/[a-z0-9.+-]+;base64,/i.test(url);
  }

  function isValidItem(item) {
    return Boolean(item && item.id && isSupportedUrl(String(item.url || "")));
  }

  function estimateBytes(value) {
    return new TextEncoder().encode(String(value || "")).length;
  }

  function inferName(url) {
    if (url.startsWith("data:")) {
      return "Imagen subida";
    }
    try {
      const parsed = new URL(url);
      return decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || parsed.hostname);
    } catch (error) {
      return "Imagen";
    }
  }

  function inferType(url) {
    return url.startsWith("data:image/") ? url.slice(5, url.indexOf(";")) : "image/url";
  }

  function createId(seed) {
    let hash = 2166136261;
    const source = `${seed}:${Date.now()}`;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `media_${(hash >>> 0).toString(36)}`;
  }

  function formatMb(bytes) {
    return (bytes / 1_000_000).toFixed(1);
  }
})(globalThis);
