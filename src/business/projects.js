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

  if (refs.summary) {
    refs.summary.textContent = `${state.businesses.length} negocios - ${active} activos - ${published} publicados`;
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

function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
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
