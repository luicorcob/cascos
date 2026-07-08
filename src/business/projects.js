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

const refs = {};
const state = {
  businesses: [],
  search: "",
  status: "",
  apiBase: window.LocalLiftApi?.getBase?.() || "",
  adminToken: window.LocalLiftApi?.getAdminToken?.() || "",
  loading: false
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
  setLoading(true);
  showNotice("Cargando proyectos...", "info");

  try {
    const payload = await getJson("/api/businesses?includeArchived=true");
    state.businesses = Array.isArray(payload.businesses) ? payload.businesses : [];
    renderProjects();
    showNotice("", "info");
  } catch (error) {
    state.businesses = [];
    renderProjects();
    showNotice(error.status === 401 ? "La API pide token admin." : "No se pudo cargar proyectos.", "error");
  } finally {
    state.loading = false;
    setLoading(false);
  }
}

function renderProjects() {
  const projects = getFilteredProjects();
  const active = state.businesses.filter((business) => business.status !== "archived").length;
  const published = state.businesses.filter((business) => business.status === "published").length;
  const activeDemos = state.businesses.filter((business) => getDemoState(business).status === "active").length;

  if (refs.summary) {
    refs.summary.textContent = `${state.businesses.length} negocios - ${active} activos - ${published} publicados - ${activeDemos} demos activas`;
  }

  if (!refs.grid) {
    return;
  }

  if (!state.businesses.length && state.loading) {
    refs.grid.innerHTML = `<article class="project-empty"><strong>Cargando proyectos...</strong></article>`;
    return;
  }

  if (!projects.length) {
    refs.grid.innerHTML = `<article class="project-empty"><strong>No hay proyectos para este filtro.</strong></article>`;
    return;
  }

  refs.grid.innerHTML = projects.map(renderProjectCard).join("");
  bindProjectForms();
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
        <a href="../index.html?skipIntro=1">Studio</a>
      </div>
      <form class="project-password-form" data-portal-password-form data-business-id="${escapeHtml(ref)}">
        <label>
          Contrasena cliente
          <input type="password" minlength="8" autocomplete="new-password" placeholder="Nueva contrasena" required>
        </label>
        <button type="submit">Guardar acceso</button>
        <small data-card-status></small>
      </form>
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

  return {
    status: "active",
    url,
    remainingLabel: expiresAt ? formatRemaining(expiresAt) : "Activa sin caducidad",
    expiresLabel: expiresAt ? `Caduca el ${formatDateTime(expiresAt)}` : "Enlace publicado sin fecha de caducidad"
  };
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
  const response = await fetch(window.LocalLiftApi?.url?.(path) || path, {
    headers: window.LocalLiftApi?.headers?.() || { Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
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
