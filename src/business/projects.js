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

const PROJECT_STATUS_LABELS = {
  pending: "Pendiente",
  "in-design": "En diseño",
  review: "Revisión",
  published: "Publicado",
  maintenance: "Mantenimiento"
};
const PROJECT_PRIORITY_LABELS = { low: "Baja", medium: "Media", high: "Alta", urgent: "Urgente" };
const TASK_STATUS_LABELS = { pending: "Pendiente", "in-progress": "En curso", done: "Completada" };
const SUBSCRIPTION_STATUS_LABELS = { active: "Activa", paused: "Pausada", cancelled: "Cancelada", expired: "Vencida" };
const INVOICE_STATUS_LABELS = { draft: "Borrador", sent: "Enviada", paid: "Pagada", overdue: "Vencida", cancelled: "Cancelada" };
const PROPOSAL_STATUS_LABELS = { borrador: "Borrador", enviada: "Enviada", vista: "Vista", aceptada: "Aceptada", rechazada: "Rechazada", caducada: "Caducada" };
const DOCUMENT_CATEGORY_LABELS = { contract: "Contrato", quote: "Presupuesto", invoice: "Factura", "client-file": "Archivo del cliente", deliverable: "Entregable", other: "Otro" };
const SUPPORT_STATUS_LABELS = { open: "Abierta", closed: "Cerrada" };
const FREQUENCY_LABELS = { monthly: "Mensual", quarterly: "Trimestral", yearly: "Anual", custom: "Personalizada" };

const LOCAL_BACKEND_BASES = ["http://127.0.0.1:5173", "http://localhost:5173"];

const refs = {};
const state = {
  businesses: [],
  projects: [],
  subscriptions: [],
  invoices: [],
  proposals: [],
  documents: [],
  supportThreads: [],
  operationsSummary: null,
  operationView: "projects",
  operationSearch: "",
  operationBusiness: "",
  operationStatus: "",
  operationsLoading: false,
  operationsError: "",
  search: "",
  status: "",
  apiBase: window.LocalLiftApi?.getBase?.() || "",
  adminToken: window.LocalLiftApi?.getAdminToken?.() || "",
  loading: false,
  loadError: "",
  loadHint: "",
  localFallbackUsed: false,
  supportPollTimer: null
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
  refs.operationGrid = document.querySelector("[data-operation-grid]");
  refs.operationSearch = document.querySelector("[data-operation-search]");
  refs.operationBusiness = document.querySelector("[data-operation-business]");
  refs.operationStatus = document.querySelector("[data-operation-status]");
  refs.operationTabs = Array.from(document.querySelectorAll("[data-operation-tab]"));
  refs.projectCreate = document.querySelector("[data-project-create]");
  refs.subscriptionCreate = document.querySelector("[data-subscription-create]");
  refs.projectForm = document.querySelector("[data-project-form]");
  refs.subscriptionForm = document.querySelector("[data-subscription-form]");
  refs.projectBusiness = document.querySelector("[data-project-business]");
  refs.subscriptionBusiness = document.querySelector("[data-subscription-business]");
  refs.invoiceCreate = document.querySelector("[data-invoice-create]");
  refs.documentCreate = document.querySelector("[data-document-create]");
  refs.invoiceForm = document.querySelector("[data-invoice-form]");
  refs.documentForm = document.querySelector("[data-document-form]");
  refs.invoiceBusiness = document.querySelector("[data-invoice-business]");
  refs.documentBusiness = document.querySelector("[data-document-business]");
  refs.invoiceProject = document.querySelector("[data-invoice-project]");
  refs.documentProject = document.querySelector("[data-document-project]");

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

  refs.operationTabs.forEach((button) => {
    button.addEventListener("click", () => setOperationView(button.dataset.operationTab || "projects"));
  });
  refs.operationSearch?.addEventListener("input", () => {
    state.operationSearch = refs.operationSearch.value.trim().toLowerCase();
    renderOperations();
  });
  refs.operationBusiness?.addEventListener("change", () => {
    state.operationBusiness = refs.operationBusiness.value;
    renderOperations();
  });
  refs.operationStatus?.addEventListener("change", () => {
    state.operationStatus = refs.operationStatus.value;
    renderOperations();
  });
  refs.projectForm?.addEventListener("submit", submitProjectForm);
  refs.subscriptionForm?.addEventListener("submit", submitSubscriptionForm);
  refs.invoiceForm?.addEventListener("submit", submitInvoiceForm);
  refs.documentForm?.addEventListener("submit", submitDocumentForm);
  refs.invoiceBusiness?.addEventListener("change", () => populateOneProjectSelector(refs.invoiceProject, refs.invoiceBusiness.value, "Sin proyecto"));
  refs.documentBusiness?.addEventListener("change", () => populateOneProjectSelector(refs.documentProject, refs.documentBusiness.value, "General"));
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
    populateBusinessSelectors();
    await loadOperations();
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

async function loadOperations() {
  state.operationsLoading = true;
  state.operationsError = "";
  renderOperations();

  try {
    const [projectPayload, subscriptionPayload, invoicePayload, documentPayload, summary, communicationsPayload, proposals] = await Promise.all([
      getJson("/api/enterprise/projects"),
      getJson("/api/enterprise/subscriptions"),
      getJson("/api/enterprise/invoices"),
      getJson("/api/enterprise/documents"),
      getJson("/api/enterprise/summary"),
      getJson("/api/enterprise/communications/threads?type=support"),
      loadEnterpriseProposals()
    ]);
    state.projects = Array.isArray(projectPayload.projects) ? projectPayload.projects : [];
    state.subscriptions = Array.isArray(subscriptionPayload.subscriptions) ? subscriptionPayload.subscriptions : [];
    state.invoices = Array.isArray(invoicePayload.invoices) ? invoicePayload.invoices : [];
    state.proposals = proposals;
    state.documents = Array.isArray(documentPayload.documents) ? documentPayload.documents : [];
    state.supportThreads = Array.isArray(communicationsPayload.threads) ? communicationsPayload.threads : [];
    state.operationsSummary = summary;
    populateProjectSelectors();
    startSupportPolling();
  } catch (error) {
    state.projects = [];
    state.subscriptions = [];
    state.invoices = [];
    state.proposals = [];
    state.documents = [];
    state.supportThreads = [];
    state.operationsSummary = null;
    state.operationsError = error.status === 401 ? "Añade el token admin para gestionar operaciones." : "No se pudo cargar la gestión empresarial.";
  } finally {
    state.operationsLoading = false;
    renderOperations();
    renderProjects();
  }
}

async function loadEnterpriseProposals() {
  const payloads = await Promise.all(state.businesses.map(async (business) => {
    try {
      const payload = await getJson(`/api/businesses/${encodeURIComponent(business.id || business.slug)}/proposals`);
      return Array.isArray(payload.proposals) ? payload.proposals : [];
    } catch {
      return [];
    }
  }));
  return payloads.flat();
}

function populateBusinessSelectors() {
  const activeBusinesses = state.businesses.filter((business) => business.status !== "archived");
  const options = activeBusinesses.map((business) => (
    `<option value="${escapeAttr(business.id)}">${escapeHtml(business.name || business.slug || business.id)}</option>`
  )).join("");

  if (refs.operationBusiness) {
    refs.operationBusiness.innerHTML = `<option value="">Todos los clientes</option>${options}`;
    refs.operationBusiness.value = state.operationBusiness;
  }
  [refs.projectBusiness, refs.subscriptionBusiness, refs.invoiceBusiness, refs.documentBusiness].forEach((select) => {
    if (!select) return;
    select.innerHTML = `<option value="">Selecciona un cliente</option>${options}`;
  });
}

function populateProjectSelectors() {
  populateOneProjectSelector(refs.invoiceProject, refs.invoiceBusiness?.value || "", "Sin proyecto");
  populateOneProjectSelector(refs.documentProject, refs.documentBusiness?.value || "", "General");
  const issueDate = refs.invoiceForm?.elements.issueDate;
  const dueDate = refs.invoiceForm?.elements.dueDate;
  if (issueDate && !issueDate.value) issueDate.value = new Date().toISOString().slice(0, 10);
  if (dueDate && !dueDate.value) dueDate.value = dateInputOffset(15);
}

function populateOneProjectSelector(select, businessId, emptyLabel) {
  if (!select) return;
  const options = state.projects.filter((project) => !businessId || project.businessId === businessId)
    .map((project) => `<option value="${escapeAttr(project.id)}">${escapeHtml(project.name)}</option>`).join("");
  select.innerHTML = `<option value="">${escapeHtml(emptyLabel)}</option>${options}`;
}

function setOperationView(view) {
  state.operationView = ["projects", "proposals", "subscriptions", "invoices", "documents", "messages"].includes(view) ? view : "projects";
  state.operationStatus = "";
  refs.operationTabs.forEach((button) => {
    const active = button.dataset.operationTab === state.operationView;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  if (refs.projectCreate) refs.projectCreate.hidden = state.operationView !== "projects";
  if (refs.subscriptionCreate) refs.subscriptionCreate.hidden = state.operationView !== "subscriptions";
  if (refs.invoiceCreate) refs.invoiceCreate.hidden = state.operationView !== "invoices";
  if (refs.documentCreate) refs.documentCreate.hidden = state.operationView !== "documents";
  renderOperationStatusOptions();
  renderOperations();
  if (state.operationView === "messages") refreshSupportThreads({ markRead: true });
}

function renderOperationStatusOptions() {
  if (!refs.operationStatus) return;
  const labels = state.operationView === "projects"
    ? PROJECT_STATUS_LABELS
    : state.operationView === "proposals"
      ? PROPOSAL_STATUS_LABELS
    : state.operationView === "subscriptions"
      ? SUBSCRIPTION_STATUS_LABELS
      : state.operationView === "invoices"
        ? INVOICE_STATUS_LABELS
        : state.operationView === "documents"
          ? DOCUMENT_CATEGORY_LABELS
          : SUPPORT_STATUS_LABELS;
  refs.operationStatus.innerHTML = `<option value="">Todos</option>${Object.entries(labels).map(([value, label]) => (
    `<option value="${escapeAttr(value)}">${escapeHtml(label)}</option>`
  )).join("")}`;
  refs.operationStatus.value = state.operationStatus;
}

function renderOperations() {
  renderOperationStatusOptions();
  renderOperationMetrics();
  if (!refs.operationGrid) return;

  if (state.operationsLoading) {
    refs.operationGrid.innerHTML = renderEmptyState("Cargando operaciones...");
    return;
  }
  if (state.operationsError) {
    refs.operationGrid.innerHTML = renderEmptyState(state.operationsError, "El CRM y el Studio siguen disponibles; revisa la conexión avanzada.");
    return;
  }

  const items = getFilteredOperations();
  if (!items.length) {
    const label = ({ projects: "proyectos", proposals: "ofertas", subscriptions: "suscripciones", invoices: "facturas", documents: "documentos", messages: "consultas de soporte" })[state.operationView];
    refs.operationGrid.innerHTML = renderEmptyState(`No hay ${label} para este filtro.`, state.operationView === "messages" ? "Los mensajes enviados desde los portales aparecerán aquí." : "Crea el primero o cambia los filtros de cliente y estado.");
    return;
  }

  refs.operationGrid.innerHTML = items.map((item) => {
    if (state.operationView === "projects") return renderOperationProjectCard(item);
    if (state.operationView === "proposals") return renderProposalCard(item);
    if (state.operationView === "subscriptions") return renderSubscriptionCard(item);
    if (state.operationView === "invoices") return renderInvoiceCard(item);
    if (state.operationView === "messages") return renderSupportThreadCard(item);
    return renderDocumentCard(item);
  }).join("");
  bindOperationCards();
}

function renderOperationMetrics() {
  const summary = state.operationsSummary || {};
  setOperationMetric("projects", summary.projects || 0, `${state.businesses.filter((item) => item.status !== "archived").length} clientes disponibles`);
  setOperationMetric("overdue", summary.overdueProjects || 0);
  const openProposals = state.proposals.filter((proposal) => ["borrador", "enviada", "vista"].includes(proposal.status));
  const openProposalValue = openProposals.reduce((sum, proposal) => sum + Number(proposal.setupPrice || 0), 0);
  setOperationMetric("proposals", openProposals.length, openProposals.length ? `${formatMoney(openProposalValue)} de alta propuestos` : "Sin ofertas pendientes");
  setOperationMetric("mrr", formatMoney(summary.monthlyRecurringRevenue || 0, "EUR"));
  setOperationMetric("renewals", summary.renewalsNext30Days || 0);
  setOperationMetric("invoiced", formatMoney(summary.monthlyInvoiced || 0, "EUR"));
  setOperationMetric("outstanding", formatMoney(summary.outstandingPayments || 0, "EUR"), `${summary.overdueInvoices || 0} facturas vencidas`);
  setOperationMetric("active-subscriptions", summary.activeSubscriptions || 0);
  setOperationMetric("support-unread", state.supportThreads.reduce((sum, thread) => sum + Number(thread.unreadCount || 0), 0));
}

function setOperationMetric(name, value, note = "") {
  const node = document.querySelector(`[data-operation-metric="${name}"]`);
  if (node) node.textContent = value;
  const noteNode = document.querySelector(`[data-operation-note="${name}"]`);
  if (noteNode && note) noteNode.textContent = note;
}

function getFilteredOperations() {
  const items = ({ projects: state.projects, proposals: state.proposals, subscriptions: state.subscriptions, invoices: state.invoices, documents: state.documents, messages: state.supportThreads })[state.operationView] || [];
  return items.filter((item) => {
    if (state.operationBusiness && item.businessId !== state.operationBusiness) return false;
    if (state.operationStatus && (state.operationView === "documents" ? item.category : item.status) !== state.operationStatus) return false;
    if (!state.operationSearch) return true;
    const business = getBusiness(item.businessId);
    return [item.name, item.title, item.description, item.responsible, item.status, item.category, item.concept, item.number, item.package, item.contactName, item.business?.name, business?.name, business?.city, ...(item.messages || []).flatMap((message) => [message.senderName, message.body])]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(state.operationSearch));
  });
}

function renderProposalCard(proposal) {
  const business = getBusiness(proposal.businessId);
  const setupPrice = Number(proposal.setupPrice || 0);
  const monthlyPrice = Number(proposal.monthlyPrice || 0);
  const businessRef = business?.slug || business?.id || proposal.businessId;
  return `
    <article class="operation-card proposal-operation-card">
      <header>
        <div>
          <span class="project-status is-${escapeAttr(proposal.status)}">${escapeHtml(PROPOSAL_STATUS_LABELS[proposal.status] || proposal.status)}</span>
          <span class="project-plan">${escapeHtml(String(proposal.package || "A medida").replaceAll("_", " "))}</span>
        </div>
        <strong class="operation-alert">${escapeHtml(formatMoney(setupPrice))} alta</strong>
      </header>
      <p class="operation-client">${escapeHtml(business?.name || "Cliente no disponible")}</p>
      <h3>${escapeHtml(proposal.title || proposal.contactName || "Oferta comercial DLS")}</h3>
      <p>${escapeHtml(proposal.conditions || proposal.description || "Oferta vinculada al negocio.")}</p>
      <dl class="operation-facts">
        <div><dt>Alta</dt><dd>${escapeHtml(formatMoney(setupPrice))}</dd></div>
        <div><dt>Cuota mensual</dt><dd>${escapeHtml(formatMoney(monthlyPrice))}</dd></div>
        <div><dt>Estado</dt><dd>${escapeHtml(PROPOSAL_STATUS_LABELS[proposal.status] || proposal.status)}</dd></div>
        <div><dt>Caducidad</dt><dd>${escapeHtml(formatDate(proposal.validUntil || proposal.expiresAt))}</dd></div>
      </dl>
      <footer>
        <span>${proposal.projectId ? "Convertida en proyecto" : "Seguimiento comercial"}</span>
        <a class="operation-open-link" href="client-dashboard.html?business=${encodeURIComponent(businessRef)}&businessName=${encodeURIComponent(business?.name || "")}&tab=proposals&preview=developer">Abrir ficha comercial</a>
      </footer>
    </article>
  `;
}

function renderOperationProjectCard(project) {
  const business = getBusiness(project.businessId);
  const tasks = Array.isArray(project.tasks) ? project.tasks : [];
  const files = Array.isArray(project.files) ? project.files : [];
  const completed = tasks.filter((task) => task.status === "done").length;
  return `
    <article class="operation-card ${project.overdue ? "is-overdue" : ""}" data-operation-project="${escapeAttr(project.id)}">
      <header>
        <div>
          <span class="project-status is-${escapeAttr(project.status)}">${escapeHtml(PROJECT_STATUS_LABELS[project.status] || project.status)}</span>
          <span class="operation-priority is-${escapeAttr(project.priority)}">${escapeHtml(PROJECT_PRIORITY_LABELS[project.priority] || project.priority)}</span>
        </div>
        ${project.overdue ? `<strong class="operation-alert">Atrasado</strong>` : ""}
      </header>
      <p class="operation-client">${escapeHtml(business?.name || "Cliente no disponible")}</p>
      <h3>${escapeHtml(project.name)}</h3>
      <p>${escapeHtml(project.description || "Sin descripción añadida.")}</p>
      <dl class="operation-facts">
        <div><dt>Responsable</dt><dd>${escapeHtml(project.responsible || "Sin asignar")}</dd></div>
        <div><dt>Inicio</dt><dd>${escapeHtml(formatDate(project.startDate))}</dd></div>
        <div><dt>Entrega</dt><dd>${escapeHtml(formatDate(project.dueDate))}</dd></div>
        <div><dt>Progreso</dt><dd>${completed}/${tasks.length} tareas · ${project.progress || 0}%</dd></div>
      </dl>
      <details class="operation-detail">
        <summary>Editar proyecto</summary>
        <form data-project-edit="${escapeAttr(project.id)}">
          <label>Responsable<input name="responsible" maxlength="120" value="${escapeAttr(project.responsible || "")}"></label>
          <label>Estado<select name="status">${selectOptions(PROJECT_STATUS_LABELS, project.status)}</select></label>
          <label>Prioridad<select name="priority">${selectOptions(PROJECT_PRIORITY_LABELS, project.priority)}</select></label>
          <label>Fecha de entrega<input type="date" name="dueDate" value="${escapeAttr(project.dueDate || "")}"></label>
          <button type="submit">Guardar cambios</button>
        </form>
      </details>
      <section class="operation-children">
        <div class="operation-section-title"><strong>Tareas</strong><small>${completed} completadas</small></div>
        ${tasks.length ? `<ul class="operation-task-list">${tasks.map((task) => `
          <li>
            <span>${escapeHtml(task.title)}<small>${escapeHtml(task.assignee || "Sin asignar")}${task.dueDate ? ` · ${escapeHtml(formatDate(task.dueDate))}` : ""}</small></span>
            <select aria-label="Estado de ${escapeAttr(task.title)}" data-task-status="${escapeAttr(task.id)}" data-project-id="${escapeAttr(project.id)}">${selectOptions(TASK_STATUS_LABELS, task.status)}</select>
          </li>`).join("")}</ul>` : `<p class="operation-inline-empty">Todavía no hay tareas.</p>`}
        <form class="operation-inline-form" data-task-form="${escapeAttr(project.id)}">
          <input name="title" maxlength="240" placeholder="Nueva tarea" required>
          <input name="assignee" maxlength="120" placeholder="Responsable">
          <button type="submit">Añadir</button>
        </form>
      </section>
      <section class="operation-children">
        <div class="operation-section-title"><strong>Archivos</strong><small>${files.length} enlaces</small></div>
        ${files.length ? `<ul class="operation-file-list">${files.map((file) => `
          <li><a href="${escapeAttr(file.url)}" target="_blank" rel="noopener">${escapeHtml(file.name)}</a><span>${escapeHtml(file.category || "proyecto")}</span></li>`).join("")}</ul>` : `<p class="operation-inline-empty">Añade archivos mediante un enlace seguro.</p>`}
        <form class="operation-inline-form" data-file-form="${escapeAttr(project.id)}">
          <input name="name" maxlength="240" placeholder="Nombre del archivo" required>
          <input name="url" type="url" maxlength="2000" placeholder="https://..." required>
          <button type="submit">Vincular</button>
        </form>
      </section>
      <footer>
        ${project.proposalId ? `<span>Creado desde presupuesto</span>` : `<span>Creado manualmente</span>`}
        <button type="button" class="operation-delete" data-operation-delete="project" data-operation-id="${escapeAttr(project.id)}" data-operation-name="${escapeAttr(project.name)}">Eliminar</button>
      </footer>
    </article>
  `;
}

function renderSubscriptionCard(subscription) {
  const business = getBusiness(subscription.businessId);
  return `
    <article class="operation-card subscription-card ${subscription.renewalAlert ? "is-renewal" : ""}" data-operation-subscription="${escapeAttr(subscription.id)}">
      <header>
        <span class="project-status is-${escapeAttr(subscription.status)}">${escapeHtml(SUBSCRIPTION_STATUS_LABELS[subscription.status] || subscription.status)}</span>
        ${subscription.renewalAlert ? `<strong class="operation-alert">Aviso activo</strong>` : ""}
      </header>
      <p class="operation-client">${escapeHtml(business?.name || "Cliente no disponible")}</p>
      <h3>${escapeHtml(subscription.name)}</h3>
      <p>${escapeHtml(subscription.description || "Servicio recurrente sin descripción.")}</p>
      <strong class="subscription-price">${escapeHtml(formatMoney(subscription.price, subscription.currency))}<small> / ${escapeHtml(FREQUENCY_LABELS[subscription.frequency] || subscription.frequency).toLowerCase()}</small></strong>
      <dl class="operation-facts">
        <div><dt>Próxima renovación</dt><dd>${escapeHtml(formatDate(subscription.nextRenewal))}</dd></div>
        <div><dt>Aviso</dt><dd>${subscription.noticeDays} días antes</dd></div>
        <div><dt>Restan</dt><dd>${formatRenewalDays(subscription.daysUntilRenewal)}</dd></div>
      </dl>
      <form class="subscription-quick-edit" data-subscription-edit="${escapeAttr(subscription.id)}">
        <label>Estado<select name="status">${selectOptions(SUBSCRIPTION_STATUS_LABELS, subscription.status)}</select></label>
        <label>Próxima renovación<input type="date" name="nextRenewal" value="${escapeAttr(subscription.nextRenewal)}" required></label>
        <button type="submit">Actualizar</button>
      </form>
      <footer>
        <span>Actualizada ${escapeHtml(formatDate(subscription.updatedAt))}</span>
        <button type="button" class="operation-delete" data-operation-delete="subscription" data-operation-id="${escapeAttr(subscription.id)}" data-operation-name="${escapeAttr(subscription.name)}">Eliminar</button>
      </footer>
    </article>
  `;
}

function renderInvoiceCard(invoice) {
  const business = getBusiness(invoice.businessId);
  return `
    <article class="operation-card invoice-card ${invoice.status === "overdue" ? "is-overdue" : ""}">
      <header><div><span class="project-status is-${escapeAttr(invoice.status)}">${escapeHtml(INVOICE_STATUS_LABELS[invoice.status] || invoice.status)}</span><span class="project-plan">${escapeHtml(invoice.number)}</span></div>${invoice.balance > 0 ? `<strong class="operation-alert">${escapeHtml(formatMoney(invoice.balance, invoice.currency))} pendiente</strong>` : ""}</header>
      <p class="operation-client">${escapeHtml(business?.name || "Cliente no disponible")}</p>
      <h3>${escapeHtml(invoice.concept)}</h3>
      <strong class="subscription-price">${escapeHtml(formatMoney(invoice.total, invoice.currency))}</strong>
      <dl class="operation-facts"><div><dt>Base</dt><dd>${escapeHtml(formatMoney(invoice.subtotal, invoice.currency))}</dd></div><div><dt>IVA</dt><dd>${invoice.taxRate}%</dd></div><div><dt>Emitida</dt><dd>${escapeHtml(formatDate(invoice.issueDate))}</dd></div><div><dt>Vence</dt><dd>${escapeHtml(formatDate(invoice.dueDate))}</dd></div><div><dt>Pagado</dt><dd>${escapeHtml(formatMoney(invoice.paidAmount, invoice.currency))}</dd></div><div><dt>Saldo</dt><dd>${escapeHtml(formatMoney(invoice.balance, invoice.currency))}</dd></div></dl>
      ${invoice.status !== "cancelled" && invoice.balance > 0 ? `<form class="operation-inline-form" data-payment-form="${escapeAttr(invoice.id)}"><input type="number" name="amount" min="0.01" max="${escapeAttr(invoice.balance)}" step="0.01" value="${escapeAttr(invoice.balance)}" required><input name="reference" maxlength="240" placeholder="Referencia del pago"><button type="submit">Registrar pago</button></form>` : ""}
      ${invoice.payments?.length ? `<ul class="operation-file-list">${invoice.payments.map((payment) => `<li><span>${escapeHtml(formatMoney(payment.amount, invoice.currency))}<small>${escapeHtml(payment.method || "pago")} · ${escapeHtml(formatDate(payment.paidAt))}</small></span><span>${escapeHtml(payment.reference || "Sin referencia")}</span></li>`).join("")}</ul>` : `<p class="operation-inline-empty">Sin pagos registrados.</p>`}
      <footer><span>${invoice.projectId ? "Vinculada a proyecto" : "Factura general"}</span><button type="button" class="operation-delete" data-operation-delete="invoice" data-operation-id="${escapeAttr(invoice.id)}" data-operation-name="${escapeAttr(invoice.number)}">Eliminar</button></footer>
    </article>`;
}

function renderSupportThreadCard(thread) {
  const messages = Array.isArray(thread.messages) ? thread.messages : [];
  const business = thread.business || getBusiness(thread.businessId) || {};
  return `
    <article class="operation-card support-thread-card ${thread.unreadCount ? "has-unread" : ""}" data-support-thread="${escapeAttr(thread.id)}">
      <header>
        <div><span class="project-status is-${escapeAttr(thread.status)}">${escapeHtml(SUPPORT_STATUS_LABELS[thread.status] || thread.status)}</span>${thread.unreadCount ? `<span class="support-unread-badge">${thread.unreadCount} sin leer</span>` : ""}</div>
        <button type="button" class="support-status-button" data-support-status="${escapeAttr(thread.id)}" data-next-status="${thread.status === "closed" ? "open" : "closed"}">${thread.status === "closed" ? "Reabrir" : "Cerrar consulta"}</button>
      </header>
      <p class="operation-client">${escapeHtml(business.name || "Cliente no disponible")}</p>
      <h3>${escapeHtml(thread.title || "Atención DLS")}</h3>
      <div class="support-chat-log">
        ${messages.length ? messages.map((message) => renderSupportMessage(message)).join("") : `<p class="operation-inline-empty">La conversación está vacía.</p>`}
      </div>
      <form class="support-reply-form" data-support-reply="${escapeAttr(thread.id)}">
        <label>Firma<input name="senderName" maxlength="120" value="Equipo DLS" required></label>
        <label class="is-wide">Respuesta<textarea name="body" maxlength="5000" rows="3" placeholder="Escribe una respuesta para el cliente..."></textarea></label>
        <label>Nombre del adjunto<input name="attachmentName" maxlength="240" placeholder="Documento o captura"></label>
        <label>Enlace al adjunto<input type="url" name="attachmentUrl" maxlength="2000" placeholder="https://..."></label>
        <button type="submit">Responder</button>
      </form>
      <footer><span>${messages.length} mensajes · actualizado ${escapeHtml(formatDateTime(thread.updatedAt))}</span></footer>
    </article>`;
}

function renderSupportMessage(message) {
  const fromDls = message.senderRole === "developer";
  return `<article class="support-chat-message ${fromDls ? "is-dls" : "is-client"}">
    <header><strong>${escapeHtml(message.senderName || (fromDls ? "DLS" : "Cliente"))}</strong><time>${escapeHtml(formatDateTime(message.createdAt))}</time></header>
    ${message.body ? `<p>${escapeHtml(message.body).replaceAll("\n", "<br>")}</p>` : ""}
    ${message.attachmentUrl ? `<a href="${escapeAttr(message.attachmentUrl)}" target="_blank" rel="noopener">↗ ${escapeHtml(message.attachmentName || "Abrir adjunto")}</a>` : ""}
  </article>`;
}

function renderDocumentCard(document) {
  const business = getBusiness(document.businessId);
  return `
    <article class="operation-card document-card">
      <header><span class="project-status">${escapeHtml(DOCUMENT_CATEGORY_LABELS[document.category] || document.category)}</span><span class="operation-priority">${document.visibility === "client" ? "Visible para cliente" : "Solo DLS"}</span></header>
      <p class="operation-client">${escapeHtml(business?.name || "Cliente no disponible")}</p>
      <h3>${escapeHtml(document.name)}</h3>
      <p>${document.projectId ? "Documento vinculado a un proyecto." : "Documento general del cliente."}</p>
      <a class="document-open" href="${escapeAttr(document.url)}" target="_blank" rel="noopener">Abrir documento</a>
      <footer><span>${escapeHtml(formatDateTime(document.createdAt))}</span><button type="button" class="operation-delete" data-operation-delete="document" data-operation-id="${escapeAttr(document.id)}" data-operation-name="${escapeAttr(document.name)}">Eliminar</button></footer>
    </article>`;
}

function bindOperationCards() {
  refs.operationGrid?.querySelectorAll("[data-project-edit]").forEach((form) => form.addEventListener("submit", submitProjectEdit));
  refs.operationGrid?.querySelectorAll("[data-subscription-edit]").forEach((form) => form.addEventListener("submit", submitSubscriptionEdit));
  refs.operationGrid?.querySelectorAll("[data-task-form]").forEach((form) => form.addEventListener("submit", submitTaskForm));
  refs.operationGrid?.querySelectorAll("[data-file-form]").forEach((form) => form.addEventListener("submit", submitFileForm));
  refs.operationGrid?.querySelectorAll("[data-task-status]").forEach((select) => select.addEventListener("change", updateTaskStatus));
  refs.operationGrid?.querySelectorAll("[data-operation-delete]").forEach((button) => button.addEventListener("click", deleteOperation));
  refs.operationGrid?.querySelectorAll("[data-payment-form]").forEach((form) => form.addEventListener("submit", submitPaymentForm));
  refs.operationGrid?.querySelectorAll("[data-support-reply]").forEach((form) => form.addEventListener("submit", submitSupportReply));
  refs.operationGrid?.querySelectorAll("[data-support-status]").forEach((button) => button.addEventListener("click", updateSupportStatus));
}

async function submitProjectForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await runOperationMutation(form, async () => {
    await postJson("/api/enterprise/projects", {
      businessId: String(data.get("businessId") || ""),
      name: String(data.get("name") || ""),
      description: String(data.get("description") || ""),
      responsible: String(data.get("responsible") || ""),
      priority: String(data.get("priority") || "medium"),
      status: String(data.get("status") || "pending"),
      startDate: String(data.get("startDate") || ""),
      dueDate: String(data.get("dueDate") || "")
    });
    form.reset();
    if (refs.projectCreate) refs.projectCreate.open = false;
  }, "Proyecto creado.");
}

async function submitSubscriptionForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await runOperationMutation(form, async () => {
    await postJson("/api/enterprise/subscriptions", {
      businessId: String(data.get("businessId") || ""),
      name: String(data.get("name") || ""),
      description: String(data.get("description") || ""),
      price: Number(data.get("price")),
      currency: "EUR",
      frequency: String(data.get("frequency") || "monthly"),
      nextRenewal: String(data.get("nextRenewal") || ""),
      status: String(data.get("status") || "active"),
      noticeDays: Number(data.get("noticeDays"))
    });
    form.reset();
    if (refs.subscriptionCreate) refs.subscriptionCreate.open = false;
  }, "Suscripción creada.");
}

async function submitInvoiceForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await runOperationMutation(form, async () => {
    await postJson("/api/enterprise/invoices", {
      businessId: String(data.get("businessId") || ""), projectId: String(data.get("projectId") || ""), concept: String(data.get("concept") || ""),
      subtotal: Number(data.get("subtotal")), taxRate: Number(data.get("taxRate")), currency: "EUR", issueDate: String(data.get("issueDate") || ""),
      dueDate: String(data.get("dueDate") || ""), status: String(data.get("status") || "draft")
    });
    form.reset();
    if (refs.invoiceCreate) refs.invoiceCreate.open = false;
  }, "Factura creada.");
}

async function submitDocumentForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await runOperationMutation(form, async () => {
    await postJson("/api/enterprise/documents", {
      businessId: String(data.get("businessId") || ""), projectId: String(data.get("projectId") || ""), name: String(data.get("name") || ""),
      category: String(data.get("category") || "other"), url: String(data.get("url") || ""), visibility: String(data.get("visibility") || "client")
    });
    form.reset();
    if (refs.documentCreate) refs.documentCreate.open = false;
  }, "Documento guardado.");
}

async function submitSupportReply(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const body = String(data.get("body") || "").trim();
  const attachmentUrl = String(data.get("attachmentUrl") || "").trim();
  if (!body && !attachmentUrl) {
    showNotice("Escribe una respuesta o añade un enlace.", "error");
    return;
  }
  await runOperationMutation(form, () => postJson(`/api/enterprise/communications/threads/${encodeURIComponent(form.dataset.supportReply)}/messages`, {
    senderName: String(data.get("senderName") || "Equipo DLS").trim(),
    body,
    attachmentName: String(data.get("attachmentName") || "").trim(),
    attachmentUrl
  }), "Respuesta enviada al cliente.");
}

async function updateSupportStatus(event) {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await patchJson(`/api/enterprise/communications/threads/${encodeURIComponent(button.dataset.supportStatus)}`, { status: button.dataset.nextStatus });
    await refreshSupportThreads({ markRead: true });
    showNotice(button.dataset.nextStatus === "closed" ? "Consulta cerrada." : "Consulta reabierta.", "info");
  } catch (error) {
    showNotice(operationErrorMessage(error), "error");
  } finally {
    button.disabled = false;
  }
}

async function refreshSupportThreads({ markRead = false } = {}) {
  try {
    const payload = await getJson(`/api/enterprise/communications/threads?type=support${markRead ? "&markRead=true" : ""}`);
    state.supportThreads = Array.isArray(payload.threads) ? payload.threads : [];
    if (markRead) state.supportThreads.forEach((thread) => { thread.unreadCount = 0; });
    renderOperations();
  } catch (error) {
    if (state.operationView === "messages") showNotice(operationErrorMessage(error), "error");
  }
}

function startSupportPolling() {
  if (state.supportPollTimer) return;
  state.supportPollTimer = window.setInterval(() => {
    if (!document.hidden && state.operationView === "messages") refreshSupportThreads({ markRead: true });
  }, 15000);
}

async function submitPaymentForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await runOperationMutation(form, () => postJson(`/api/enterprise/invoices/${encodeURIComponent(form.dataset.paymentForm)}/payments`, {
    amount: Number(data.get("amount")), method: "manual", reference: String(data.get("reference") || "")
  }), "Pago registrado.");
}

async function submitProjectEdit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await runOperationMutation(form, () => patchJson(`/api/enterprise/projects/${encodeURIComponent(form.dataset.projectEdit)}`, {
    responsible: String(data.get("responsible") || ""),
    status: String(data.get("status") || "pending"),
    priority: String(data.get("priority") || "medium"),
    dueDate: String(data.get("dueDate") || "")
  }), "Proyecto actualizado.");
}

async function submitSubscriptionEdit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await runOperationMutation(form, () => patchJson(`/api/enterprise/subscriptions/${encodeURIComponent(form.dataset.subscriptionEdit)}`, {
    status: String(data.get("status") || "active"),
    nextRenewal: String(data.get("nextRenewal") || "")
  }), "Suscripción actualizada.");
}

async function submitTaskForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await runOperationMutation(form, () => postJson(`/api/enterprise/projects/${encodeURIComponent(form.dataset.taskForm)}/tasks`, {
    title: String(data.get("title") || ""),
    assignee: String(data.get("assignee") || "")
  }), "Tarea añadida.");
}

async function submitFileForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await runOperationMutation(form, () => postJson(`/api/enterprise/projects/${encodeURIComponent(form.dataset.fileForm)}/files`, {
    name: String(data.get("name") || ""),
    url: String(data.get("url") || ""),
    category: "project"
  }), "Archivo vinculado.");
}

async function updateTaskStatus(event) {
  const select = event.currentTarget;
  select.disabled = true;
  try {
    await patchJson(`/api/enterprise/projects/${encodeURIComponent(select.dataset.projectId)}/tasks/${encodeURIComponent(select.dataset.taskStatus)}`, { status: select.value });
    await loadOperations();
    showNotice("Tarea actualizada.", "info");
  } catch (error) {
    select.disabled = false;
    showNotice(operationErrorMessage(error), "error");
  }
}

async function deleteOperation(event) {
  const button = event.currentTarget;
  const type = button.dataset.operationDelete;
  const name = button.dataset.operationName || "este elemento";
  if (!window.confirm(`Eliminar "${name}"?`)) return;
  button.disabled = true;
  try {
    const resource = ({ project: "projects", subscription: "subscriptions", invoice: "invoices", document: "documents" })[type];
    await deleteJson(`/api/enterprise/${resource}/${encodeURIComponent(button.dataset.operationId)}`);
    await loadOperations();
    showNotice(`${({ project: "Proyecto", subscription: "Suscripción", invoice: "Factura", document: "Documento" })[type]} eliminado.`, "warn");
  } catch (error) {
    button.disabled = false;
    showNotice(operationErrorMessage(error), "error");
  }
}

async function runOperationMutation(form, mutation, successMessage) {
  const button = form.querySelector("button[type='submit']");
  if (button) button.disabled = true;
  try {
    await mutation();
    await loadOperations();
    showNotice(successMessage, "info");
  } catch (error) {
    showNotice(operationErrorMessage(error), "error");
  } finally {
    if (button) button.disabled = false;
  }
}

function operationErrorMessage(error) {
  if (error.status === 400) return "Revisa los campos y las fechas del formulario.";
  if (error.status === 401) return "Token admin requerido para modificar operaciones.";
  if (error.status === 403) return "Este acceso es de solo lectura.";
  return "No se pudo guardar el cambio.";
}

function selectOptions(labels, selected) {
  return Object.entries(labels).map(([value, label]) => (
    `<option value="${escapeAttr(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`
  )).join("");
}

function getBusiness(id) {
  return state.businesses.find((business) => business.id === id || business.slug === id) || null;
}

function formatRenewalDays(value) {
  const days = Number(value);
  if (!Number.isFinite(days)) return "Sin calcular";
  if (days < 0) return `${Math.abs(days)} días vencida`;
  if (days === 0) return "Renueva hoy";
  return `${days} días`;
}

function formatMoney(value, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(value || 0));
}

function dateInputOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
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
      hint: "Arranca el backend con npm.cmd start y abre Control DLS desde http://127.0.0.1:5173/pages/admin-dashboard.html. Si estabas usando otra API guardada, pulsa Limpiar en el campo API.",
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
  const proposals = state.proposals.filter((proposal) => proposal.businessId === business.id);
  const accepted = proposals.filter((proposal) => proposal.status === "aceptada");
  const contractedSetup = accepted.reduce((sum, proposal) => sum + Number(proposal.setupPrice || 0), 0);
  const contractedMonthly = accepted.reduce((sum, proposal) => sum + Number(proposal.monthlyPrice || 0), 0);

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
        <div>
          <dt>Relación comercial DLS</dt>
          <dd>${proposals.length} oferta(s) · ${escapeHtml(formatMoney(contractedSetup))} alta · ${escapeHtml(formatMoney(contractedMonthly))}/mes aceptados</dd>
        </div>
      </dl>
      ${renderDemoPanel(demoState)}
      <div class="project-links">
        <a href="client-dashboard.html?business=${encodeURIComponent(ref)}&businessName=${encodeURIComponent(business.name || "")}&preview=developer">Vista portal cliente</a>
        <a href="client-site.html?business=${encodeURIComponent(ref)}&preview=developer">Web</a>
        <a href="../workspace.html?skipIntro=1&business=${encodeURIComponent(ref)}">Studio</a>
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

async function patchJson(path, payload) {
  const response = await fetch(window.LocalLiftApi?.url?.(path) || path, {
    method: "PATCH",
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
    refs.refresh.textContent = isLoading ? "Sincronizando" : "Sincronizar";
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
