(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.delivery = {
    createDeliveryController,
    inferDemoShareability
  };

  function createDeliveryController(options = {}) {
    const {
      apiHeaders,
      apiUrl,
      buildDeliveryReport,
      dataVersion,
      defaultSectionOrder,
      estimateDeliveryAssets,
      getCurrentBusinessRecord,
      isSectionVisible,
      normalizeSectionOrder,
      saveBusinessToApi,
      sectionBaseKey,
      setCurrentBusinessRecord,
      slugify,
      storeApiRecord,
      studioExporter,
      toApiRecordMeta,
      withBusinessDefaults
    } = options;
    const createZipBlob = studio.zipArchive.createZipBlob;
    const publishUi = queryPublishUi();

    return {
      downloadSite,
      publishDemo,
      normalizeActiveDemo,
      showPublishDemoModal,
      showPublishDemoErrorModal,
      hidePublishDemoModal,
      setPublishDemoCopyState,
      getPublishErrorMessage,
      getUnshareableDemoMessage,
      rememberPublishedDemo,
      downloadDeliveryPackage,
      buildDeliveryPackageFiles,
      downloadBusinessData,
      copyTextToClipboard,
      formatDateTime
    };

    async function downloadSite(business) {
      const html = await studioExporter.buildExportDocument(business);
      const filename = slugify(business.name || "negocio-local");
      downloadBlob(new Blob([html], { type: "text/html;charset=utf-8" }), `${filename}.html`);
    }

    async function publishDemo(business) {
      const resolved = withBusinessDefaults(business);
      const html = await studioExporter.buildExportDocument(resolved);
      const contactId = getExplicitPublishContactId(resolved);
      const currentRecord = getCurrentBusinessRecord();
      const response = await fetch(apiUrl("/api/demo-publish"), {
        method: "POST",
        headers: apiHeaders({ json: true }),
        body: JSON.stringify({
          html,
          business: {
            id: currentRecord?.id || resolved.id || "",
            slug: currentRecord?.slug || resolved.slug || slugify(resolved.name || ""),
            name: resolved.name,
            category: resolved.category,
            location: resolved.location || resolved.address || "",
            ...(contactId ? { contactId } : {})
          }
        })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Demo publish failed");
      }

      const demo = payload.demo || {};
      if (!demo.url) {
        throw new Error("Demo publish response did not include a URL");
      }

      return demo;
    }

    function getExplicitPublishContactId(business = {}) {
      const params = new URLSearchParams(global.location.search);
      const currentRecord = getCurrentBusinessRecord();
      const candidates = [
        params.get("contactId"),
        params.get("contact"),
        currentRecord?.contactId,
        currentRecord?.contact,
        business.contactId,
        business.contact
      ];

      return candidates
        .map(readExplicitContactReference)
        .find(Boolean) || "";
    }

    function readExplicitContactReference(value) {
      const reference = value && typeof value === "object" && !Array.isArray(value)
        ? value.id || value.contactId
        : value;

      return (typeof reference === "string" || typeof reference === "number")
        ? String(reference).replace(/\s+/g, " ").trim().slice(0, 120)
        : "";
    }

    function normalizeActiveDemo(demo) {
      const url = String(demo.url || "").trim();
      const shareability = inferDemoShareability(url, global.location?.href);

      return {
        id: String(demo.id || "").trim(),
        url,
        path: String(demo.path || "").trim(),
        createdAt: String(demo.createdAt || new Date().toISOString()),
        expiresAt: String(demo.expiresAt || ""),
        publicBaseUrl: String(demo.publicBaseUrl || "").trim(),
        shareable: typeof demo.shareable === "boolean" ? demo.shareable : shareability.shareable,
        shareStatus: String(demo.shareStatus || shareability.status || "").trim(),
        shareMessage: String(demo.shareMessage || shareability.message || "").trim(),
        source: "studio"
      };
    }

    function showPublishDemoModal(activeDemo, copied = false) {
      if (!publishUi.modal || !activeDemo?.url) {
        return;
      }

      const canShare = activeDemo.shareable !== false;
      publishUi.modal.dataset.shareStatus = canShare ? "shareable" : "blocked";
      setText(publishUi.badge, canShare ? "Publicada correctamente" : "No enviar al cliente");
      setText(publishUi.title, canShare ? "Demo lista para enviar" : "Demo creada solo local");
      setText(publishUi.urlLabel, canShare ? "Enlace de cliente" : "Enlace local de diagnostico");

      if (publishUi.urlInput) {
        publishUi.urlInput.value = activeDemo.url;
      }

      if (publishUi.openLink) {
        publishUi.openLink.href = activeDemo.url;
        publishUi.openLink.hidden = false;
      }

      if (publishUi.expiry) {
        const remaining = formatRemainingTime(activeDemo.expiresAt);
        publishUi.expiry.textContent = canShare
          ? activeDemo.expiresAt
            ? `Activa hasta ${formatDateTime(activeDemo.expiresAt)}${remaining ? ` (${remaining})` : ""}.`
            : "Enlace temporal activo."
          : getUnshareableDemoMessage(activeDemo);
      }

      setPublishDemoCopyState(copied ? "Copiado" : canShare ? "Copiar enlace" : "Copiar enlace local");
      publishUi.modal.hidden = false;
      requestAnimationFrame(() => publishUi.urlInput?.select());
    }

    function showPublishDemoErrorModal(message, endpoint) {
      if (!publishUi.modal) {
        return;
      }

      publishUi.modal.dataset.shareStatus = "error";
      setText(publishUi.badge, "No publicada");
      setText(publishUi.title, "No se pudo publicar");
      setText(publishUi.expiry, message);
      setText(publishUi.urlLabel, "Endpoint que no respondio");

      if (publishUi.urlInput) {
        publishUi.urlInput.value = endpoint || "";
      }

      if (publishUi.openLink) {
        publishUi.openLink.hidden = true;
      }

      setPublishDemoCopyState("Copiar diagnostico");
      publishUi.modal.hidden = false;
      requestAnimationFrame(() => publishUi.urlInput?.select());
    }

    function hidePublishDemoModal() {
      if (publishUi.modal) {
        publishUi.modal.hidden = true;
        delete publishUi.modal.dataset.shareStatus;
      }
    }

    function setPublishDemoCopyState(label) {
      setText(publishUi.copyButton, label);
    }

    function getPublishErrorMessage(error, endpoint) {
      if (error?.name === "TypeError" || /fetch|failed|network|load/i.test(error?.message || "")) {
        return `No se pudo conectar con la API de publicacion en ${endpoint}. Arranca npm.cmd start o abre el Studio desde el puerto donde este vivo el servidor.`;
      }

      return error?.message || "No se pudo publicar la demo. Revisa la API y vuelve a intentarlo.";
    }

    function getUnshareableDemoMessage(activeDemo) {
      if (activeDemo?.shareStatus === "local-network") {
        return "Demo creada, pero ese enlace solo funciona dentro de tu red local. Para mandarla a un movil fuera de esa red o a un cliente, publica el backend en Render/Railway o configura DEMO_PUBLIC_BASE_URL con un dominio HTTPS.";
      }

      return "Demo creada, pero ese enlace apunta a este ordenador. En un movil 127.0.0.1/localhost apunta al propio movil y falla. Publica el backend en Render/Railway o configura DEMO_PUBLIC_BASE_URL antes de enviarla.";
    }

    async function rememberPublishedDemo(business, activeDemo) {
      const studioUpdatedAt = new Date().toISOString();
      const record = await saveBusinessToApi({
        ...business,
        status: getCurrentBusinessRecord()?.status || "in-review",
        publishedUrl: activeDemo.url,
        activeDemo: {
          ...activeDemo,
          updatedFromStudioAt: studioUpdatedAt
        },
        updatedFromStudioAt: studioUpdatedAt
      });
      const recordMeta = toApiRecordMeta(record);
      setCurrentBusinessRecord(recordMeta);
      storeApiRecord(recordMeta);
      return record;
    }

    async function downloadDeliveryPackage(business) {
      const resolved = withBusinessDefaults(business);
      const exportedAt = new Date().toISOString();
      const html = await studioExporter.buildExportDocument(resolved);
      const filename = slugify(resolved.name || "negocio-local");
      const files = buildDeliveryPackageFiles(resolved, html, exportedAt);
      downloadBlob(createZipBlob(files), `${filename}-entrega.zip`);
    }

    function buildDeliveryPackageFiles(business, html, exportedAt) {
      const report = buildDeliveryReport(business);
      const payload = {
        version: dataVersion,
        exportedAt,
        business: withBusinessDefaults(business)
      };

      return [
        { name: "index.html", content: html },
        { name: "business.json", content: JSON.stringify(payload, null, 2) },
        { name: "ficha-entrega.md", content: buildDeliveryBrief(business, report, exportedAt) },
        { name: "cambios.md", content: buildDeliveryChangelog(business, report, exportedAt) }
      ];
    }

    function buildDeliveryBrief(business, report, exportedAt) {
      const lines = [
        `# Ficha de entrega - ${markdownText(business.name)}`,
        "",
        `Fecha: ${exportedAt}`,
        `Estado: ${report.ready ? "Lista para revision final" : "Pendiente de correcciones"}`,
        `Score de entrega: ${report.score}%`,
        `Categoria: ${markdownText(business.category)}`,
        `Ubicacion: ${markdownText(business.location || business.address || "Sin ubicacion definida")}`,
        "",
        "## Archivos incluidos",
        "",
        "- `index.html`: web standalone lista para abrir o subir a hosting.",
        "- `business.json`: datos completos del negocio para mantenimiento futuro.",
        "- `ficha-entrega.md`: resumen de preparacion y siguiente paso.",
        "- `cambios.md`: cambios principales aplicados en esta entrega.",
        "",
        "## Siguiente paso",
        "",
        report.nextStep,
        "",
        "## Checklist",
        ""
      ];

      report.groups.forEach((group) => {
        lines.push(`### ${markdownText(group.label)}`, "");
        group.items.forEach((item) => {
          lines.push(`- [${item.status === "done" ? "x" : " "}] ${markdownText(item.label)} (${item.status})`);
        });
        lines.push("");
      });

      return lines.join("\n").trim() + "\n";
    }

    function buildDeliveryChangelog(business, report, exportedAt) {
      const visibleSections = normalizeSectionOrder(business.sectionOrder, defaultSectionOrder)
        .filter((key) => isSectionVisible(sectionBaseKey(key), business));
      const assets = estimateDeliveryAssets(business);
      const integrations = [
        business.showBooking ? "reservas" : "",
        business.showLeadForm ? "formulario de lead" : "",
        business.chatbot?.enabled ? "chatbot" : "",
        business.commerce?.enabled ? "tienda online" : "",
        business.google?.enabled ? "Google" : ""
      ].filter(Boolean);

      return [
        `# Cambios de entrega - ${markdownText(business.name)}`,
        "",
        `Fecha: ${exportedAt}`,
        "",
        "- Web standalone generada desde el renderizador compartido de preview y exportacion.",
        `- ${visibleSections.length} secciones visibles preparadas: ${visibleSections.map(sectionBaseKey).join(", ")}.`,
        `- Direccion visual: ${business.theme}, ${business.artDirection}, contenido ${business.contentMode}.`,
        `- Activos principales: ${assets.imageCount} imagen(es), ${assets.gallery} en galeria, ${assets.localMediaCount} embebida(s) en base64.`,
        `- Integraciones activas: ${integrations.length ? integrations.join(", ") : "sin integraciones activas"}.`,
        `- Estado Entrega Pro: ${report.ready ? "listo" : "pendiente"} con score ${report.score}%.`,
        "",
        "## Avisos abiertos",
        "",
        ...(report.validation.warnings.length
          ? report.validation.warnings.map((issue) => `- ${markdownText(issue.message)}`)
          : ["- Sin avisos tecnicos principales."])
      ].join("\n").trim() + "\n";
    }

    function downloadBusinessData(business) {
      const payload = {
        version: dataVersion,
        exportedAt: new Date().toISOString(),
        business: withBusinessDefaults(business)
      };
      downloadBlob(
        new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" }),
        `${slugify(business.name || "dls-datos")}.dls.json`
      );
    }
  }

  function inferDemoShareability(url, baseUrl = "http://localhost/") {
    let parsed;

    try {
      parsed = new URL(url, baseUrl);
    } catch (error) {
      return {
        shareable: false,
        status: "invalid-url",
        message: "La URL de demo no se pudo validar."
      };
    }

    const hostname = parsed.hostname.toLowerCase();

    if (isLocalDemoHostname(hostname)) {
      return {
        shareable: false,
        status: "local-machine",
        message: "La URL apunta a este ordenador."
      };
    }

    if (isPrivateNetworkDemoHostname(hostname)) {
      return {
        shareable: false,
        status: "local-network",
        message: "La URL solo es accesible desde la red local."
      };
    }

    return {
      shareable: true,
      status: parsed.protocol === "https:" ? "public-https" : "public",
      message: "URL publica."
    };
  }

  function isLocalDemoHostname(hostname) {
    return hostname === "localhost"
      || hostname === "0.0.0.0"
      || hostname === "::1"
      || hostname === "[::1]"
      || hostname.startsWith("127.");
  }

  function isPrivateNetworkDemoHostname(hostname) {
    const parts = hostname.split(".").map((part) => Number(part));

    if (parts.length === 4 && parts.every(
      (part) => Number.isInteger(part) && part >= 0 && part <= 255
    )) {
      return parts[0] === 10
        || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
        || (parts[0] === 192 && parts[1] === 168)
        || (parts[0] === 169 && parts[1] === 254);
    }

    return hostname.endsWith(".local") || hostname.endsWith(".lan");
  }

  function queryPublishUi() {
    return {
      modal: document.querySelector("#publishDemoModal"),
      badge: document.querySelector(".publish-demo-badge"),
      title: document.querySelector("#publishDemoTitle"),
      urlInput: document.querySelector("#publishDemoUrl"),
      urlLabel: document.querySelector("#publishDemoUrlLabel"),
      expiry: document.querySelector("#publishDemoExpiry"),
      openLink: document.querySelector("#publishDemoOpenLink"),
      copyButton: document.querySelector("#publishDemoCopyButton")
    };
  }

  function setText(element, value) {
    if (element) element.textContent = value;
  }

  function markdownText(value) {
    return String(value ?? "")
      .replace(/\r?\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
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

  async function copyTextToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (error) {
      // Fall back to a temporary textarea below.
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand("copy");
    } catch (error) {
      return false;
    } finally {
      textarea.remove();
    }
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat("es-ES", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(date);
  }

  function formatRemainingTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const ms = date.getTime() - Date.now();
    if (ms <= 0) {
      return "caducada";
    }

    const hours = Math.ceil(ms / 36e5);
    const days = Math.floor(hours / 24);
    const restHours = hours % 24;

    if (days >= 1 && restHours >= 1) {
      return `quedan ${days} d ${restHours} h`;
    }

    if (days >= 1) {
      return `quedan ${days} dia${days === 1 ? "" : "s"}`;
    }

    return `quedan ${hours} h`;
  }
})(globalThis);
