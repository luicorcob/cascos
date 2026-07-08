import assert from "node:assert/strict";
import { createSiteImageSelection, handleSiteImageApi } from "../api/site-image-api.mjs";

const originalFetch = globalThis.fetch;
const originalUnsplashKey = process.env.UNSPLASH_ACCESS_KEY;
const requests = [];

try {
  const env = {
    UNSPLASH_ACCESS_KEY: "test-unsplash-key",
    PEXELS_API_KEY: "",
    PIXABAY_API_KEY: ""
  };
  const fetcher = async (url, options = {}) => {
    const endpoint = new URL(url);
    requests.push({ endpoint, options });
    assert.equal(endpoint.hostname, "api.unsplash.com");
    assert.match(options.headers.Authorization, /^Client-ID test-unsplash-key$/);
    assert.equal(options.headers["Accept-Version"], "v1");
    assert.match(endpoint.searchParams.get("page"), /^[1-3]$/);
    return {
      ok: true,
      json: async () => makeUnsplashPayload(endpoint)
    };
  };

  const payload = {
    negocio: {
      nombre: "Peluqueria Lucia",
      tipo: "peluqueria",
      descripcion: "Salon de belleza para mujer en el centro de Sevilla",
      ubicacion: "Sevilla, Espana",
      colores: ["#2C3E50", "#E8C5A0"],
      estilo_web: "elegante y femenino",
      secciones: ["hero", "servicios", "galeria", "contacto"],
      servicios: ["Corte de pelo", "Coloracion profesional", "Tratamientos capilares"]
    }
  };

  const result = await createSiteImageSelection(payload, {
    env,
    fetcher,
    cache: new Map()
  });

  assert.equal(result.negocio, "Peluqueria Lucia");
  assert.equal(result.fuente_principal, "unsplash");
  assert.equal(result.meta.fuentes_usadas[0], "unsplash");
  assert.equal(result.imagenes.servicios.length, 3);
  assert.equal(result.imagenes.galeria.length, 6);
  assert.ok(result.imagenes.hero.principal.url.includes("w=1920"));
  assert.ok(result.imagenes.hero.principal.url_thumb.includes("w=400"));
  assert.match(result.imagenes.hero.principal.download_location, /^https:\/\/api\.unsplash\.com\/photos\//);
  assert.match(result.imagenes.hero.principal.credito, /Unsplash/);
  assert.doesNotMatch(result.imagenes.hero.principal.query_usada, /peluquer/i);
  assert.match(result.imagenes.hero.principal.query_usada, /hair salon/);
  assert.match(result.imagenes.contacto.query_usada, /seville spain/);

  const urls = collectUrls(result.imagenes);
  assert.equal(urls.length, new Set(urls).size, "Images should not repeat across sections");
  assert.equal(result.meta.total_imagenes, urls.length);

  const withoutKeys = await createSiteImageSelection({
    negocio: {
      nombre: "Tienda sin claves",
      tipo: "tienda",
      secciones: ["hero"]
    }
  }, {
    env: {},
    fetcher,
    cache: new Map()
  });

  assert.equal(withoutKeys.fuente_principal, null);
  assert.equal(withoutKeys.imagenes.hero.principal, null);
  assert.match(withoutKeys.meta.advertencias.join(" "), /UNSPLASH_ACCESS_KEY/);

  globalThis.fetch = fetcher;
  process.env.UNSPLASH_ACCESS_KEY = "test-unsplash-key";
  const response = createResponse();
  await handleSiteImageApi(createJsonRequest(payload), response, {
    baseHeaders: {},
    requestOrigin: ""
  });
  const apiPayload = JSON.parse(response.body);

  assert.equal(response.status, 200);
  assert.equal(apiPayload.negocio, "Peluqueria Lucia");
  assert.equal(apiPayload.imagenes.hero.principal.fuente, "unsplash");
} finally {
  globalThis.fetch = originalFetch;
  if (originalUnsplashKey === undefined) {
    delete process.env.UNSPLASH_ACCESS_KEY;
  } else {
    process.env.UNSPLASH_ACCESS_KEY = originalUnsplashKey;
  }
}

console.log("Site image module API tests passed.");

function makeUnsplashPayload(endpoint) {
  const query = endpoint.searchParams.get("query") || "local business";
  const orientation = endpoint.searchParams.get("orientation") || "landscape";
  const page = endpoint.searchParams.get("page") || "1";
  const perPage = Number(endpoint.searchParams.get("per_page") || 5);
  return {
    results: Array.from({ length: perPage }, (_, index) => {
      const id = `${slugify(query)}-${orientation}-p${page}-${index}`;
      const portrait = orientation === "portrait";
      const square = orientation === "squarish";
      const width = portrait ? 1200 : square ? 1200 : 1800;
      const height = portrait ? 1800 : square ? 1200 : 1100;
      return {
        id,
        width,
        height,
        alt_description: `${query} sample ${index}`,
        description: `${query} sample ${index}`,
        urls: {
          raw: `https://images.unsplash.com/photo-${id}?ixid=test`,
          full: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1800&q=90`,
          regular: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1080&q=80`,
          small: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=520&q=75`,
          thumb: `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=200&q=60`
        },
        user: { name: `Author ${index}` },
        links: {
          html: `https://unsplash.com/photos/${id}`,
          download_location: `https://api.unsplash.com/photos/${id}/download`
        }
      };
    })
  };
}

function collectUrls(value) {
  const urls = [];
  visit(value);
  return urls;

  function visit(node) {
    if (!node || typeof node !== "object") {
      return;
    }

    if (typeof node.url === "string" && node.url) {
      urls.push(node.url);
    }

    Object.values(node).forEach(visit);
  }
}

function createJsonRequest(payload) {
  const body = Buffer.from(JSON.stringify(payload));
  return {
    method: "POST",
    url: "/api/site-images",
    headers: {},
    async *[Symbol.asyncIterator]() {
      yield body;
    }
  };
}

function createResponse() {
  return {
    status: 0,
    headers: {},
    body: "",
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
    },
    end(body = "") {
      this.body = String(body);
    }
  };
}

function slugify(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
