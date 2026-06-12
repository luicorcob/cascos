(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.layouts = { createLayoutLibrary };

  function createLayoutLibrary(options = {}) {
    const storage = options.storage;
    const key = String(options.key || "locallift-studio-layouts");
    const maxItems = Math.max(1, Number(options.maxItems || 12));

    return {
      list,
      save,
      remove,
      clear
    };

    function list() {
      if (!storage) {
        return [];
      }
      try {
        const parsed = JSON.parse(storage.getItem(key) || "[]");
        return Array.isArray(parsed) ? parsed.filter(isValidTemplate) : [];
      } catch (error) {
        return [];
      }
    }

    function save(name, layout) {
      const cleanName = String(name || "").trim().slice(0, 60);
      if (!cleanName) {
        throw new Error("Pon un nombre a la composicion.");
      }
      if (!layout || typeof layout !== "object") {
        throw new Error("La composicion no contiene datos validos.");
      }

      const items = list();
      const template = {
        id: createId(cleanName),
        name: cleanName,
        layout: clone(layout),
        createdAt: new Date().toISOString()
      };
      persist([...items.slice(-(maxItems - 1)), template]);
      return template;
    }

    function remove(id) {
      const items = list();
      const next = items.filter((item) => item.id !== id);
      persist(next);
      return next.length !== items.length;
    }

    function clear() {
      storage?.removeItem(key);
    }

    function persist(items) {
      if (!storage) {
        throw new Error("El almacenamiento local no esta disponible.");
      }
      storage.setItem(key, JSON.stringify(items));
    }
  }

  function isValidTemplate(template) {
    return Boolean(template?.id && template?.name && template?.layout && typeof template.layout === "object");
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createId(seed) {
    let hash = 2166136261;
    const source = `${seed}:${Date.now()}:${Math.random()}`;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `layout_${(hash >>> 0).toString(36)}`;
  }
})(globalThis);
