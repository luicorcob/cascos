const STATUS_LABELS = {
  lead: "Lead",
  onboarding: "Onboarding",
  "in-design": "Diseno",
  "in-review": "Revision",
  published: "Publicado",
  maintenance: "Mantenimiento",
  paused: "Pausado",
  archived: "Archivado"
};

const LOCAL_BACKEND_BASES = ["http://127.0.0.1:5173", "http://localhost:5173"];

const refs = {};
const state = {
  businesses: [],
  search: "",
  status: "",
  apiBase: window.LocalLiftApi?.getBase?.() || "",
  adminToken: window.LocalLiftApi?.getAdminToken?.() || "",
  loading: false,
  loadError: "",
  loadHint: "",
  localFallbackUsed: false
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  window.LocalLiftApi?.clearClientSession?.();

  refs.summary = document.querySelector("[data-project-summary]");
  refs.grid = document.querySelector("[data-project-grid]");
  refs.notice = document.querySelector("[data-notice]");
  refs.search = document.querySelector("[data-search]");
  refs.status = document.querySelector("[data-status-filter]");
  refs.refresh = document.querySelector("[data-refresh]");
  refs.apiBaseForm = document.querySelector("[data-api-base-form]");
  refs.apiBaseInput = document.querySelector("[data-api-base-input]");
  refs.apiBaseClear = document.querySelector("[data-api-base-clear]");
  refs.adminTokenForm = document.querySelector("[data-admin-token-form]");
  refs.adminTokenInput = document.querySelector("[data-admin-token-input]");
  refs.adminTokenClear = document.querySelector("[data-admin-token-clear]");

  bindControls();
  loadProjects();
}

function bindControls() {
  if (refs.apiBaseInput) {
    refs.apiBaseInput.value = state.apiBase;
  }

  refs.apiBaseForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.apiBase = window.LocalLiftApi?.setBase?.(refs.apiBaseInput?.value || "") || "";
    if (refs.apiBaseInput) {
      refs.apiBaseInput.value = state.apiBase;
    }
    showNotice(state.apiBase ? "API guardada." : "API local activada.", "info");
    loadProjects();
  });

  refs.apiBaseClear?.addEventListener("click", () => {
    state.apiBase = window.LocalLiftApi?.setBase?.("") || "";
    if (refs.apiBaseInput) {
      refs.apiBaseInput.value = "";
    }
    showNotice("API local activada.", "warn");
    loadProjects();
  });

  if (refs.adminTokenInput) {
    refs.adminTokenInput.value = state.adminToken;
  }

  refs.adminTokenForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.adminToken = refs.adminTokenInput?.value.trim() || "";
    if (state.adminToken) {
      localStorage.setItem("locallift_admin_token", state.adminToken);
      window.LocalLiftApi?.clearClientSession?.();
      showNotice("Token guardado.", "info");
    } else {
      localStorage.removeItem("locallift_admin_token");
      showNotice("Token eliminado.", "warn");
    }
    loadProjects();
  });

  refs.adminTokenClear?.addEventListener("click", () => {
    state.adminToken = "";
    localStorage.removeItem("locallift_admin_token");
    if (refs.adminTokenInput) {
      refs.adminTokenInput.value = "";
    }
    showNotice("Token eliminado.", "warn");
    loadProjects();
  });

  refs.refresh?.addEventListener("click", () => loadProjects());

  refs.search?.addEventListener("input", () => {
    state.search = refs.search.value.trim().toLowerCase();
    renderProjects();
  });

  refs.status?.addEventListener("change", () => {
    state.status = refs.status.value;
    renderProjects();
  });
}

async function loadProjects() {
  state.loading = true;
  state.loadError = "";
  state.loadHint = "";
  setLoading(true);
  showNotice("Cargando proyectos...", "info");

  try {
    state.localFallbackUsed = false;
    const payload = await getJson("/api/businesses?includeArchived=true");
    state.businesses = Array.isArray(payload.businesses) ? payload.businesses : [];
    renderProjects();
    showNotice(state.localFallbackUsed ? "API local detectada en http://127.0.0.1:5173." : "", "info");
  } catch (error) {
    const message = getLoadErrorMessage(error);
    state.businesses = [];
    state.loadError = message.title;
    state.loadHint = message.hint;
    renderProjects();
    showNotice(message.notice, "error");
  } finally {
    state.loading = false;
    setLoading(false);
  }
}

function renderProjects() {
  const projects = getFilteredProjects();
  const active = state.businesses.filter((business) => business.status !== "archived").length;
  const published = state.businesses.filter((business) => business.status === "published").length;
  const demoStates = state.businesses.map(getDemoState);
  const activeDemos = demoStates.filter((demoState) => ["active", "outdated"].includes(demoState.status)).length;
  const outdatedDemos = demoStates.filter((demoState) => demoState.status === "outdated").length;

  if (refs.summary) {
    refs.summary.textContent = `${state.businesses.length} negocios - ${active} activos - ${published} publicados - ${activeDemos} demos activas${outdatedDemos ? ` - ${outdatedDemos} desactualizadas` : ""}`;
  }

  if (!refs.grid) {
    return;
  }

  if (!state.businesses.length && state.loading) {
    refs.grid.innerHTML = `<article class="project-empty"><strong>Cargando proyectos...</strong></article>`;
    return;
  }

  if (state.loadError) {
    refs.grid.innerHTML = renderEmptyState(state.loadError, state.loadHint);
    return;
  }

  if (!projects.length) {
    refs.grid.innerHTML = state.businesses.length
      ? renderEmptyState("No hay proyectos para este filtro.")
      : renderEmptyState(
        "No hay proyectos todavia.",
        "En Render con PostgreSQL nuevo, el bootstrap inicial debe cargar el JSON o puedes crear el primer negocio desde el Studio."
      );
    return;
  }

  refs.grid.innerHTML = projects.map(renderProjectCard).join("");
  bindProjectForms();
}

function renderEmptyState(title, hint = "") {
  return `
    <article class="project-empty">
      <strong>${escapeHtml(title)}</strong>
      ${hint ? `<small>${escapeHtml(hint)}</small>` : ""}
    </article>
  `;
}

function getLoadErrorMessage(error) {
  if (!error.status) {
    return {
      title: "No se pudo conectar con la API local.",
      hint: "Arranca el backend con npm.cmd start y abre Proyectos desde http://127.0.0.1:5173/pages/projects.html. Si estabas usando otra API guardada, pulsa Limpiar en el campo API.",
      notice: "No se pudo conectar con la API."
    };
  }

  if (error.status === 401) {
    return {
      title: "Token admin requerido.",
      hint: "Copia LOCALLIFT_ADMIN_TOKEN desde Render > Environment y pegalo en el campo Token de esta pagina.",
      notice: "La API pide token admin."
    };
  }

  if (error.status === 403) {
    return {
      title: "Ese acceso no puede ver la lista de proyectos.",
      hint: "Usa el token admin del backend, no una sesion de cliente.",
      notice: "Acceso rechazado para proyectos."
    };
  }

  return {
    title: "No se pudieron cargar los proyectos.",
    hint: "Comprueba /api/health en Render y que la API base apunte al servicio correcto.",
    notice: "No se pudo cargar proyectos."
  };
}

function getFilteredProjects() {
  return state.businesses.filter((business) => {
    if (state.status && business.status !== state.status) {
      return false;
    }

    if (!state.search) {
      return true;
    }

    return [
      business.name,
      business.slug,
      business.category,
      business.city,
      business.ownerName,
      business.ownerEmail,
      business.plan
    ].filter(Boolean).some((value) => String(value).toLowerCase().includes(state.search));
  });
}

function renderProjectCard(business) {
  const ref = business.slug || business.id;
  const status = business.status || "lead";
  const portalAccess = business.portalAccess || {};
  const portalLabel = portalAccess.passwordSet ? "Acceso cliente activo" : "Acceso cliente pendiente";
  const portalClass = portalAccess.passwordSet ? "ok" : "warn";
  const owner = business.ownerName || business.ownerEmail || business.ownerPhone || "Sin responsable";
  const demoState = getDemoState(business);

  return `
    <article class="project-card" data-project-card="${escapeHtml(ref)}">
      <header>
        <span class="project-status is-${escapeHtml(status)}">${escapeHtml(STATUS_LABELS[status] || status)}</span>
        <span class="project-plan">${escapeHtml(business.plan || "Sin plan")}</span>
      </header>
      <h2>${escapeHtml(business.name || "Proyecto sin nombre")}</h2>
      <p>${escapeHtml([business.category, business.city].filter(Boolean).join(" - ") || "Sin sector")}</p>
      <dl>
        <div>
          <dt>Cliente</dt>
          <dd>${escapeHtml(owner)}</dd>
        </div>
        <div>
          <dt>Actualizado</dt>
          <dd>${escapeHtml(formatDate(business.updatedAt || business.createdAt))}</dd>
        </div>
        <div>
          <dt>Portal</dt>
          <dd><span class="project-mini-status is-${portalClass}">${escapeHtml(portalLabel)}</span></dd>
        </div>
      </dl>
      ${renderDemoPanel(demoState)}
      <div class="project-links">
        <a href="business-dashboard.html?business=${encodeURIComponent(ref)}">Portal</a>
        <a href="client-site.html?business=${encodeURIComponent(ref)}&preview=developer">Web</a>
        <a href="../index.html?skipIntro=1&business=${encodeURIComponent(ref)}">Studio</a>
      </div>
      <form class="project-password-form" data-portal-password-form data-business-id="${escapeHtml(ref)}">
        <label>
          Contrasena cliente
          <input type="password" minlength="8" autocomplete="new-password" placeholder="Nueva contrasena" required>
        </label>
        <button type="submit">Guardar acceso</button>
        <small data-card-status></small>
      </form>
      <div class="project-danger-zone">
        <button class="project-delete-button" type="button" data-project-delete="${escapeHtml(ref)}" data-project-name="${escapeAttr(business.name || "Proyecto sin nombre")}">Eliminar proyecto</button>
      </div>
    </article>
  `;
}

function bindProjectForms() {
  refs.grid?.querySelectorAll("[data-copy-demo-url]").forEach((button) => {
    button.addEventListener("click", async () => {
      const copied = await copyTextToClipboard(button.dataset.copyDemoUrl || "");
      button.textContent = copied ? "Copiado" : "No copiado";
    });
  });

  refs.grid?.querySelectorAll("[data-project-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const businessId = button.dataset.projectDelete || "";
      const businessName = button.dataset.projectName || "este proyecto";
      const confirmed = window.confirm(`Eliminar "${businessName}"? Esta accion quitara tambien sus datos operativos.`);

      if (!confirmed) {
        return;
      }

      button.disabled = true;
      button.textContent = "Eliminando";

      try {
        await deleteJson(`/api/businesses/${encodeURIComponent(businessId)}`);
        state.businesses = state.businesses.filter((business) => business.id !== businessId && business.slug !== businessId);
        showNotice(`Proyecto eliminado: ${businessName}.`, "warn");
        renderProjects();
      } catch (error) {
        button.disabled = false;
        button.textContent = "Eliminar proyecto";
        showNotice(getDeleteErrorMessage(error), "error");
      }
    });
  });

  refs.grid?.querySelectorAll("[data-portal-password-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const businessId = form.dataset.businessId || "";
      const input = form.querySelector("input");
      const status = form.querySelector("[data-card-status]");
      const password = input?.value.trim() || "";

      if (password.length < 8) {
        setCardStatus(status, "Minimo 8 caracteres.", "error");
        return;
      }

      setCardStatus(status, "Guardando...", "info");
      form.querySelector("button")?.setAttribute("disabled", "");

      try {
        const payload = await postJson(`/api/businesses/${encodeURIComponent(businessId)}/portal-access`, { password });
        state.businesses = state.businesses.map((business) => {
          if (business.id !== businessId && business.slug !== businessId) {
            return business;
          }

          return {
            ...business,
            portalAccess: payload.portalAccess,
            updatedAt: new Date().toISOString()
          };
        });
        input.value = "";
        showNotice("Acceso cliente actualizado.", "info");
        renderProjects();
      } catch (error) {
        setCardStatus(status, error.status === 401 ? "Token admin requerido." : "No se pudo guardar.", "error");
      } finally {
        form.querySelector("button")?.removeAttribute("disabled");
      }
    });
  });
}

function renderDemoPanel(demoState) {
  if (demoState.status === "none") {
    return `
      <section class="project-demo-state is-empty">
        <div>
          <span>Demo</span>
          <strong>Sin demo activa</strong>
          <small>Publica desde el Studio cuando este lista.</small>
        </div>
      </section>
    `;
  }

  if (demoState.status === "expired") {
    return `
      <section class="project-demo-state is-expired">
        <div>
          <span>Demo caducada</span>
          <strong>${escapeHtml(demoState.expiredLabel)}</strong>
          <small>${escapeHtml(demoState.expiresLabel)}</small>
        </div>
      </section>
    `;
  }

  if (demoState.status === "local") {
    return `
      <section class="project-demo-state is-expired is-local">
        <div>
          <span>Demo solo local</span>
          <strong>${escapeHtml(demoState.expiredLabel)}</strong>
          <small>${escapeHtml(demoState.expiresLabel)}</small>
        </div>
        <div class="project-demo-actions">
          <a href="${escapeAttr(demoState.url)}" target="_blank" rel="noopener">Abrir local</a>
        </div>
      </section>
    `;
  }

  if (demoState.status === "outdated") {
    return `
      <section class="project-demo-state is-outdated">
        <div>
          <span>Demo desactualizada</span>
          <strong>Hay cambios sin publicar</strong>
          <small>${escapeHtml(demoState.expiresLabel)}</small>
        </div>
        <div class="project-demo-actions">
          <a href="${escapeAttr(demoState.url)}" target="_blank" rel="noopener">Abrir</a>
          <button type="button" data-copy-demo-url="${escapeAttr(demoState.url)}">Copiar</button>
        </div>
      </section>
    `;
  }

  return `
    <section class="project-demo-state is-active">
      <div>
        <span>Demo activa</span>
        <strong>${escapeHtml(demoState.remainingLabel)}</strong>
        <small>${escapeHtml(demoState.expiresLabel)}</small>
      </div>
      <div class="project-demo-actions">
        <a href="${escapeAttr(demoState.url)}" target="_blank" rel="noopener">Abrir</a>
        <button type="button" data-copy-demo-url="${escapeAttr(demoState.url)}">Copiar</button>
      </div>
    </section>
  `;
}

function getDemoState(business) {
  const demo = business.activeDemo || {};
  const url = String(demo.url || business.publishedUrl || "").trim();

  if (!url) {
    return { status: "none" };
  }

  const shareability = inferProjectDemoShareability(url);

  if (!shareability.shareable) {
    return {
      status: "local",
      url,
      expiredLabel: shareability.status === "local-network" ? "Solo red local" : "No sirve para movil",
      expiresLabel: "Republica desde un backend publico HTTPS antes de enviarla."
    };
  }

  const expiresAt = parseDate(demo.expiresAt);

  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    return {
      status: "expired",
      url,
      expiredLabel: "Necesita republicarse",
      expiresLabel: `Caduco el ${formatDateTime(expiresAt)}`
    };
  }

  if (isDemoOutdated(business, demo)) {
    const editedAt = parseDate(business.contentUpdatedAt || business.updatedFromStudioAt || business.updatedAt);
    const expiry = expiresAt ? ` Caduca el ${formatDateTime(expiresAt)}.` : "";

    return {
      status: "outdated",
      url,
      remainingLabel: "Hay cambios sin publicar",
      expiresLabel: `${editedAt ? `Ultima edicion: ${formatDateTime(editedAt)}.` : "El proyecto cambio despues de publicar."}${expiry} Republica desde Studio.`
    };
  }

  return {
    status: "active",
    url,
    remainingLabel: expiresAt ? formatRemaining(expiresAt) : "Activa sin caducidad",
    expiresLabel: expiresAt ? `Caduca el ${formatDateTime(expiresAt)}` : "Enlace publicado sin fecha de caducidad"
  };
}

function isDemoOutdated(business, demo) {
  const latestEdit = parseDate(business.contentUpdatedAt || business.updatedFromStudioAt || business.updatedAt);
  const demoSnapshot = parseDate(
    demo.updatedFromStudioAt
    || demo.contentUpdatedAt
    || demo.businessUpdatedAt
    || demo.createdAt
  );

  if (!latestEdit || !demoSnapshot) {
    return false;
  }

  return latestEdit.getTime() - demoSnapshot.getTime() > 5000;
}

function inferProjectDemoShareability(url) {
  let parsed;

  try {
    parsed = new URL(url, window.location.href);
  } catch (error) {
    return { shareable: false, status: "invalid-url" };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (isLocalDemoHostname(hostname)) {
    return { shareable: false, status: "local-machine" };
  }

  if (isPrivateNetworkDemoHostname(hostname)) {
    return { shareable: false, status: "local-network" };
  }

  return { shareable: true, status: parsed.protocol === "https:" ? "public-https" : "public" };
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

  if (parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) {
    return parts[0] === 10
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || (parts[0] === 169 && parts[1] === 254);
  }

  return hostname.endsWith(".local") || hostname.endsWith(".lan");
}

async function getJson(path) {
  const headers = window.LocalLiftApi?.headers?.() || { Accept: "application/json" };
  const url = window.LocalLiftApi?.url?.(path) || path;

  try {
    return await fetchJson(url, { headers, cache: "no-store" });
  } catch (error) {
    const fallback = await tryLocalBackendFallback(path, { headers, cache: "no-store" }, url);

    if (fallback.ok) {
      return fallback.payload;
    }

    throw error;
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);

  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status}`);
    error.status = response.status;
    error.url = url;
    throw error;
  }

  return response.json();
}

async function tryLocalBackendFallback(path, options, firstUrl) {
  if (!shouldTryLocalBackendFallback()) {
    return { ok: false };
  }

  for (const base of LOCAL_BACKEND_BASES) {
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

    if (isSameRequestUrl(url, firstUrl)) {
      continue;
    }

    try {
      const payload = await fetchJson(url, options);
      rememberLocalBackendBase(base);
      return { ok: true, payload };
    } catch (error) {
      // Try the next local hostname.
    }
  }

  return { ok: false };
}

function shouldTryLocalBackendFallback() {
  const { protocol, hostname } = window.location;
  return protocol === "file:" || hostname === "127.0.0.1" || hostname === "localhost";
}

function rememberLocalBackendBase(base) {
  state.localFallbackUsed = true;
  state.apiBase = window.LocalLiftApi?.setBase?.(base) || base;

  if (refs.apiBaseInput) {
    refs.apiBaseInput.value = state.apiBase;
  }
}

function isSameRequestUrl(left, right) {
  try {
    return new URL(left, window.location.href).href === new URL(right, window.location.href).href;
  } catch (error) {
    return left === right;
  }
}

async function postJson(path, payload) {
  const response = await fetch(window.LocalLiftApi?.url?.(path) || path, {
    method: "POST",
    headers: window.LocalLiftApi?.headers?.({ json: true }) || { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function deleteJson(path) {
  const response = await fetch(window.LocalLiftApi?.url?.(path) || path, {
    method: "DELETE",
    headers: window.LocalLiftApi?.headers?.() || { Accept: "application/json" }
  });
  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function getDeleteErrorMessage(error) {
  if (error.status === 401) {
    return "Token admin requerido para eliminar proyectos.";
  }

  if (error.status === 403) {
    return "Ese acceso no puede eliminar proyectos.";
  }

  return "No se pudo eliminar el proyecto.";
}

function showNotice(message, type = "info") {
  if (!refs.notice) {
    return;
  }

  refs.notice.hidden = !message;
  refs.notice.textContent = message;
  refs.notice.dataset.type = type;
}

function setLoading(isLoading) {
  if (refs.refresh) {
    refs.refresh.disabled = isLoading;
    refs.refresh.textContent = isLoading ? "Cargando" : "Actualizar";
  }
}

function setCardStatus(node, message, type) {
  if (!node) {
    return;
  }

  node.textContent = message;
  node.dataset.type = type;
}

async function copyTextToClipboard(text) {
  if (!text) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // Use the textarea fallback below.
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

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const date = parseDate(value);
  if (!date) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function formatDateTime(value) {
  const date = value instanceof Date ? value : parseDate(value);

  if (!date) {
    return "sin fecha";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatRemaining(date) {
  const ms = date.getTime() - Date.now();

  if (ms <= 0) {
    return "Caducada";
  }

  const hours = Math.ceil(ms / 36e5);
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;

  if (days >= 1 && restHours >= 1) {
    return `Quedan ${days} d ${restHours} h`;
  }

  if (days >= 1) {
    return `Quedan ${days} dia${days === 1 ? "" : "s"}`;
  }

  return `Quedan ${hours} h`;
}

function parseDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value);
}
