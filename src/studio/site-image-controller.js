(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.siteImages = {
    createSiteImageController
  };

  function createSiteImageController(options = {}) {
    const {
      apiHeaders,
      apiUrl,
      businessFromForm,
      cloneData,
      demoBusiness,
      getRadarLaunchContext,
      getStockImageState,
      mediaCreditMetadata,
      mediaLibrary,
      mergeMediaMetadata,
      renderMediaLibrary,
      renderStockImageStatus,
      renderStockImages,
      runQuickMutation,
      setChecked,
      setStatus,
      setStockImageState,
      setValue,
      trackStockImageDownload
    } = options;
    const {
      normalizeImage,
      normalizeOptionalUrl,
      parseLines,
      slugify
    } = options.core || {};
    const generateButton = document.querySelector("#siteImageGenerateButton");
    const generateStatus = document.querySelector("#siteImageGenerateStatus");
    const siteCandidatesButton = document.querySelector("#stockSiteImageButton");
    const stockResults = document.querySelector("#stockImageResults");
    const stockLoadMoreButton = document.querySelector("#stockLoadMoreButton");

    return {
      bind,
      createRadarLaunchContext,
      maybeAutoGenerateRadarSiteImages,
      buildSiteImagePack,
      collectSiteImageKeywords
    };

    function bind() {
      generateButton?.addEventListener("click", generateAndApplySiteImages);
      siteCandidatesButton?.addEventListener("click", loadSiteImageCandidates);
    }

    async function generateAndApplySiteImages() {
      if (!generateButton || generateButton.disabled) {
        return;
      }

      try {
        await fetchAndApplySiteImages("Generando imagenes del negocio...");
      } catch (error) {
        const message = error?.message || "No se pudo generar el pack visual.";
        setGenerateStatus(message);
        setStatus(message);
      }
    }

    async function fetchAndApplySiteImages(loadingMessage = "Generando imagenes del negocio...") {
      setLoading(true, loadingMessage);

      try {
        const result = await requestSiteImagePack(["hero", "servicios", "galeria", "contacto"]);
        const pack = buildSiteImagePack(result);

        if (!pack.hero && !pack.gallery.length) {
          throw new Error(siteImageWarning(result) || "No llegaron imagenes nuevas. Revisa las claves de imagenes.");
        }

        runQuickMutation(() => {
          applySiteImagePack(pack);
        }, `Pack visual aplicado: ${pack.total} imagenes.`);

        const added = saveSiteImageItems(pack.items);
        renderMediaLibrary();
        setGenerateStatus(`${pack.total} imagenes aplicadas${added ? `, ${added} guardadas` : ""}.`);
        showSiteImageItemsInInspector(pack.items);
        return { result, pack, added };
      } finally {
        setLoading(false);
      }
    }

    async function loadSiteImageCandidates() {
      if (!stockResults || siteCandidatesButton?.disabled) {
        return;
      }

      setLoading(true, "Buscando pack del negocio...");
      renderStockImageStatus("Buscando imagenes del negocio...");
      stockResults.innerHTML = '<p class="stock-empty">Cargando pack visual...</p>';
      if (stockLoadMoreButton) {
        stockLoadMoreButton.hidden = true;
      }

      try {
        const result = await requestSiteImagePack(["hero", "servicios", "galeria", "contacto"]);
        const pack = buildSiteImagePack(result);

        if (!pack.items.length) {
          throw new Error(siteImageWarning(result) || "No llegaron imagenes nuevas. Revisa las claves de imagenes.");
        }

        showSiteImageItemsInInspector(pack.items);
        setGenerateStatus(`${pack.items.length} candidatas del negocio.`);
      } catch (error) {
        const stockState = getStockImageState();
        const catalogItems = stockState.catalogItems || [];
        setStockImageState({
          ...stockState,
          loading: false,
          mode: catalogItems.length ? "catalog" : "search",
          items: catalogItems.length ? catalogItems : []
        });
        renderStockImages();
        const message = error?.message || "No se pudo cargar el pack del negocio.";
        renderStockImageStatus(message);
        setGenerateStatus(message);
      } finally {
        setLoading(false);
      }
    }

    async function requestSiteImagePack(sections) {
      const business = businessFromForm();
      const imageKeywords = collectSiteImageKeywords(business);
      const payload = {
        negocio: {
          nombre: business.name,
          tipo: business.category,
          descripcion: [business.description, business.tagline, business.conversionGoal]
            .filter(Boolean)
            .join(". "),
          ubicacion: business.location || business.address,
          colores: [business.accent].filter(Boolean),
          estilo_web: [
            business.designPack,
            business.artDirection,
            business.contentMode,
            business.typography,
            business.visualShape
          ].filter(Boolean).join(" "),
          source: getRadarLaunchContext() ? "radar" : "studio",
          imageSearchKeywords: imageKeywords,
          palabras_clave_ingles: imageKeywords,
          galleryTarget: getRadarLaunchContext() ? 6 : business.gallery.length,
          secciones: sections,
          servicios: business.services,
          testimonios: business.testimonials,
          imageRatio: business.imageRatio,
          showGallery: business.showGallery,
          showTestimonials: business.showTestimonials,
          showMap: business.showMap
        }
      };

      const response = await fetch(apiUrl("/api/site-images"), {
        method: "POST",
        headers: apiHeaders({ json: true }),
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "API de imagenes no disponible. Levanta el servidor con npm.cmd start.");
      }

      return result;
    }

    async function maybeAutoGenerateRadarSiteImages(context) {
      if (!shouldAutoGenerateRadarSiteImages(context)) {
        return;
      }

      setStatus("Radar: buscando imagenes personalizadas de Unsplash para este negocio...");

      try {
        const { pack } = await fetchAndApplySiteImages(
          "Buscando imagenes de Unsplash para este negocio..."
        );
        rememberRadarAutoImages(context);
        setStatus(`Radar: ${pack.total} imagenes personalizadas aplicadas al borrador.`);
      } catch (error) {
        setStatus(error?.message || "Radar: no se pudo aplicar el pack visual automaticamente.");
      }
    }

    function shouldAutoGenerateRadarSiteImages(context) {
      if (!context?.isRadarLaunch || !generateButton) {
        return false;
      }

      if (hasProvidedBusinessImages(context.initialBusiness)) {
        return false;
      }

      try {
        return global.sessionStorage?.getItem(radarAutoImageKey(context)) !== "done";
      } catch (error) {
        return true;
      }
    }

    function rememberRadarAutoImages(context) {
      try {
        global.sessionStorage?.setItem(radarAutoImageKey(context), "done");
      } catch (error) {
        // Repeating the automatic search is harmless if session storage is blocked.
      }
    }

    function radarAutoImageKey(context) {
      return `dls-radar-site-images:${context.opportunityId || slugify(context.businessName || "negocio")}`;
    }

    function createRadarLaunchContext(business = {}) {
      const params = new URLSearchParams(global.location.search);
      const isRadarLaunch = String(params.get("source") || "").toLowerCase() === "radar";

      if (!isRadarLaunch) {
        return null;
      }

      const opportunity = business.radarOpportunity || {};
      const sourceData = business.sourceData || opportunity.sourceData || {};
      const keywords = normalizeImageKeywordList(
        business.imageSearchKeywords,
        business.visualKeywords,
        opportunity.imageSearchKeywords,
        opportunity.visualKeywords,
        sourceData.imageSearchKeywords,
        sourceData.serviceTypes,
        categoryImageKeywords(business.category || opportunity.category || sourceData.category),
        business.location ? `${business.location} spain` : "",
        "authentic local business",
        "warm professional"
      );

      return {
        isRadarLaunch,
        opportunityId: String(
          params.get("opportunity") || opportunity.id || sourceData.id || ""
        ).trim(),
        businessName: business.name || opportunity.businessName || sourceData.name || "",
        keywords,
        sourceData,
        initialBusiness: cloneData(business)
      };
    }

    function collectSiteImageKeywords(business) {
      const context = getRadarLaunchContext();
      return normalizeImageKeywordList(
        context?.keywords,
        business.imageSearchKeywords,
        business.visualKeywords,
        categoryImageKeywords(business.category),
        business.location ? `${business.location} spain` : "spain",
        "authentic local business",
        "warm professional"
      ).slice(0, 14);
    }

    function categoryImageKeywords(category) {
      const text = normalizeKeywordText(category);
      const profiles = [
        { terms: ["restaurant", "restaurante", "bar", "tapas"], keywords: ["restaurant interior", "dining table", "food service"] },
        { terms: ["cafe", "cafeteria", "coffee"], keywords: ["coffee shop", "barista", "cafe interior"] },
        { terms: ["panaderia", "pasteleria", "bakery"], keywords: ["artisan bakery", "fresh pastry", "bread display"] },
        { terms: ["peluqueria", "hairdresser", "hair salon"], keywords: ["hair salon", "professional stylist", "beauty salon"] },
        { terms: ["barberia", "barber"], keywords: ["barbershop", "barber chair", "beard trim"] },
        { terms: ["estetica", "beauty", "spa"], keywords: ["beauty treatment room", "spa", "skincare"] },
        { terms: ["dentista", "dental"], keywords: ["dental clinic", "dentist office", "clean medical interior"] },
        { terms: ["clinica", "clinic"], keywords: ["medical clinic", "consultation room", "healthcare professional"] },
        { terms: ["farmacia", "pharmacy"], keywords: ["pharmacy interior", "health products", "pharmacist counter"] },
        { terms: ["gimnasio", "gym", "fitness", "pilates", "yoga"], keywords: ["fitness studio", "gym equipment", "personal trainer"] },
        { terms: ["taller", "workshop", "mechanic"], keywords: ["auto repair workshop", "mechanic tools", "garage service"] },
        { terms: ["tienda", "store", "retail", "boutique"], keywords: ["local shop interior", "retail display", "boutique"] },
        { terms: ["floristeria", "florist"], keywords: ["flower shop", "floral arrangement", "bouquet"] },
        { terms: ["inmobiliaria", "real estate"], keywords: ["real estate office", "property consultation", "modern office"] },
        { terms: ["hotel", "alojamiento"], keywords: ["hotel lobby", "hospitality", "guest room"] }
      ];
      return profiles.find((profile) => profile.terms.some((term) => text.includes(term)))?.keywords
        || ["local business interior", "professional service", "customer service"];
    }

    function normalizeKeywordText(value) {
      return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    }

    function hasProvidedBusinessImages(business = {}) {
      const demoHero = normalizeImage(demoBusiness.heroImage, "");
      const demoGallery = new Set(
        (demoBusiness.gallery || []).map((item) => normalizeImage(item, "")).filter(Boolean)
      );
      const hero = normalizeImage(business.heroImage, "");
      const gallery = Array.isArray(business.gallery)
        ? business.gallery
        : parseLines(business.gallery);
      const sourcePhotos = Array.isArray(business.sourceData?.photos)
        ? business.sourceData.photos
        : Array.isArray(business.radarOpportunity?.photos)
          ? business.radarOpportunity.photos
          : [];

      return [hero, ...gallery, ...sourcePhotos]
        .map((item) => normalizeImage(typeof item === "string" ? item : item?.url, ""))
        .some((url) => url && url !== demoHero && !demoGallery.has(url));
    }

    function normalizeImageKeywordList(...values) {
      const items = [];
      values.forEach(visitKeywordValue);

      return [...new Set(items
        .map((item) => String(item || "").trim())
        .filter(Boolean))]
        .slice(0, 18);

      function visitKeywordValue(value) {
        if (!value) return;
        if (Array.isArray(value)) {
          value.forEach(visitKeywordValue);
          return;
        }
        if (typeof value === "object") {
          visitKeywordValue(value.label || value.name || value.keyword || value.term || value.title);
          return;
        }
        String(value).split(/\r?\n|,/).forEach((item) => items.push(item));
      }
    }

    function buildSiteImagePack(result = {}) {
      const images = result.imagenes || {};
      const hero = toSiteImageItem(images.hero?.principal, "Portada", "hero", 0);
      const heroAlternatives = Array.isArray(images.hero?.alternativas)
        ? images.hero.alternativas
          .map((item, index) => toSiteImageItem(
            item,
            `Portada alternativa ${index + 1}`,
            "hero-alt",
            index
          ))
          .filter(Boolean)
        : [];
      const services = Array.isArray(images.servicios)
        ? images.servicios
          .map((item, index) => toSiteImageItem(
            item,
            item.label || `Servicio ${index + 1}`,
            "servicios",
            index
          ))
          .filter(Boolean)
        : [];
      const gallery = Array.isArray(images.galeria)
        ? images.galeria
          .map((item, index) => toSiteImageItem(item, `Galeria ${index + 1}`, "galeria", index))
          .filter(Boolean)
        : [];
      const contact = toSiteImageItem(images.contacto, "Contacto", "contacto", 0);
      const items = uniqueSiteImageItems(
        [hero, ...heroAlternatives, ...services, ...gallery, contact].filter(Boolean)
      );

      return {
        hero,
        gallery,
        items,
        total: items.length,
        warnings: Array.isArray(result.meta?.advertencias) ? result.meta.advertencias : []
      };
    }

    function applySiteImagePack(pack) {
      if (pack.hero?.url) {
        setValue("heroImage", pack.hero.url);
        mergeMediaMetadata(pack.hero.url, mediaMetadataFromSiteImage(pack.hero));
        trackStockImageDownload(pack.hero);
      }

      if (pack.gallery.length) {
        const galleryUrls = pack.gallery.map((item) => item.url).filter(Boolean).slice(0, 12);
        setValue("gallery", galleryUrls.join("\n"));
        setChecked("showGallery", true);
        pack.gallery.forEach((item) => {
          mergeMediaMetadata(item.url, mediaMetadataFromSiteImage(item));
          trackStockImageDownload(item);
        });
      }
    }

    function saveSiteImageItems(items) {
      let added = 0;
      items.forEach((item) => {
        try {
          const stored = mediaLibrary.add({
            name: item.title,
            url: item.url,
            alt: item.alt,
            license: item.license,
            sourceUrl: item.sourceUrl,
            provider: item.provider,
            creator: item.creator
          });
          mediaLibrary.update(stored.id, {
            name: item.title,
            alt: item.alt,
            license: item.license,
            sourceUrl: item.sourceUrl,
            provider: item.provider,
            creator: item.creator
          });
          added += 1;
        } catch (error) {
          // A full media library should not block applying the selected images.
        }
      });
      return added;
    }

    function showSiteImageItemsInInspector(items) {
      if (!stockResults || !items.length) {
        return;
      }
      setStockImageState({
        ...getStockImageState(),
        mode: "site",
        query: "",
        page: 1,
        loading: false,
        items,
        hasNext: false
      });
      renderStockImages();
      renderStockImageStatus(`${items.length} imagenes del negocio`);
    }

    function toSiteImageItem(image, title, section, index) {
      if (!image?.url) {
        return null;
      }

      const provider = providerLabel(image.fuente);
      const sourceUrl = normalizeOptionalUrl(image.source_url || image.url_original || image.url);
      const url = normalizeImage(image.url, "");
      const thumbnail = normalizeImage(image.url_thumb || image.url, url);

      if (!url) {
        return null;
      }

      return {
        id: `site-${section}-${index}-${slugify(url).slice(0, 42)}`,
        title: String(title || image.alt || "Imagen del negocio").slice(0, 120),
        creator: String(image.credito || "")
          .replace(/^Foto de\s+/i, "")
          .replace(/\s+en\s+\w+$/i, "")
          .slice(0, 80),
        provider,
        license: providerLicense(image.fuente),
        sourceUrl,
        downloadLocation: normalizeOptionalUrl(image.download_location),
        url,
        thumbnail,
        tags: [section, image.query_usada].filter(Boolean),
        alt: String(image.alt || title || "Imagen del negocio").slice(0, 180),
        focal: image.focal || "center center",
        category: "site",
        categoryLabel: "Pack negocio",
        generated: true,
        query: image.query_usada || ""
      };
    }

    function uniqueSiteImageItems(items) {
      const known = new Set();
      return items.filter((item) => {
        const key = String(item.url || "").split("?")[0];
        if (!key || known.has(key)) return false;
        known.add(key);
        return true;
      });
    }

    function mediaMetadataFromSiteImage(item) {
      return {
        alt: item.alt || item.title || "",
        position: item.focal || "center center",
        ...mediaCreditMetadata({
          ...item,
          creator: item.creator,
          provider: item.provider
        })
      };
    }

    function providerLabel(value) {
      const provider = String(value || "").toLowerCase();
      if (provider === "unsplash") return "Unsplash";
      if (provider === "pexels") return "Pexels";
      if (provider === "pixabay") return "Pixabay";
      return provider || "Banco de imagenes";
    }

    function providerLicense(value) {
      const provider = String(value || "").toLowerCase();
      if (provider === "unsplash") return "Unsplash License";
      if (provider === "pexels") return "Pexels License";
      if (provider === "pixabay") return "Pixabay License";
      return "";
    }

    function siteImageWarning(result = {}) {
      return Array.isArray(result.meta?.advertencias)
        ? result.meta.advertencias.find(Boolean)
        : "";
    }

    function setLoading(loading, message = "") {
      if (generateButton) generateButton.disabled = loading;
      if (siteCandidatesButton) siteCandidatesButton.disabled = loading;
      if (message) setGenerateStatus(message);
    }

    function setGenerateStatus(message) {
      if (generateStatus) {
        generateStatus.textContent = message || "";
      }
    }
  }
})(globalThis);
