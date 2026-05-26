const state = {
  activeTab: "home",
  calendarWeekOffset: 0,
  businesses: [],
  business: null,
  contacts: [],
  services: [],
  bookings: [],
  availability: [],
  blocks: [],
  reminderQueue: [],
  report: null,
  apiBase: window.LocalLiftApi?.getBase?.() || "",
  adminToken: localStorage.getItem("locallift_admin_token") || "",
  crmError: "",
  bookingError: "",
  loading: false
};

const LEAD_STATUSES = ["new", "contacted", "waiting", "reserved", "won", "lost"];
const BOOKING_STATUSES = ["pending", "confirmed", "completed", "canceled", "no-show"];
const WEEKDAYS = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miercoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sabado" },
  { value: 0, label: "Domingo" }
];

const refs = {};

document.addEventListener("DOMContentLoaded", init);

function init() {
  refs.businessSelect = document.querySelector("[data-business-select]");
  refs.apiBaseForm = document.querySelector("[data-api-base-form]");
  refs.apiBaseInput = document.querySelector("[data-api-base-input]");
  refs.apiBaseClear = document.querySelector("[data-api-base-clear]");
  refs.adminTokenForm = document.querySelector("[data-admin-token-form]");
  refs.adminTokenInput = document.querySelector("[data-admin-token-input]");
  refs.adminTokenClear = document.querySelector("[data-admin-token-clear]");
  refs.notice = document.querySelector("[data-notice]");
  refs.sideBusiness = document.querySelector("[data-side-business]");
  refs.sideMeta = document.querySelector("[data-side-meta]");
  refs.sideStatus = document.querySelector("[data-side-status]");
  refs.pageTitle = document.querySelector("[data-page-title]");
  refs.pageSubtitle = document.querySelector("[data-page-subtitle]");
  refs.refresh = document.querySelector("[data-refresh]");
  refs.todayList = document.querySelector("[data-today-list]");
  refs.healthList = document.querySelector("[data-health-list]");

  bindUi();
  loadBusinesses();
}

function bindUi() {
  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  refs.refresh?.addEventListener("click", () => loadBusinesses({ keepCurrent: true }));

  refs.businessSelect?.addEventListener("change", () => {
    const id = refs.businessSelect.value;
    if (id) {
      loadBusiness(id);
    }
  });

  if (refs.apiBaseInput) {
    refs.apiBaseInput.value = state.apiBase;
  }

  refs.apiBaseForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.apiBase = window.LocalLiftApi?.setBase?.(refs.apiBaseInput?.value || "") || "";

    if (refs.apiBaseInput) {
      refs.apiBaseInput.value = state.apiBase;
    }

    showNotice(state.apiBase ? "URL de API guardada para este navegador." : "URL de API eliminada; se usara el mismo dominio.", "info");
    loadBusinesses({ keepCurrent: true });
  });

  refs.apiBaseClear?.addEventListener("click", () => {
    state.apiBase = window.LocalLiftApi?.setBase?.("") || "";

    if (refs.apiBaseInput) {
      refs.apiBaseInput.value = "";
    }

    showNotice("URL de API eliminada; se usara el mismo dominio.", "warn");
    loadBusinesses({ keepCurrent: true });
  });

  if (refs.adminTokenInput) {
    refs.adminTokenInput.value = state.adminToken;
  }

  refs.adminTokenForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    state.adminToken = refs.adminTokenInput?.value.trim() || "";

    if (state.adminToken) {
      localStorage.setItem("locallift_admin_token", state.adminToken);
      showNotice("Token admin guardado en este navegador.", "info");
    } else {
      localStorage.removeItem("locallift_admin_token");
      showNotice("Token admin eliminado.", "warn");
    }

    loadBusinesses({ keepCurrent: true });
  });

  refs.adminTokenClear?.addEventListener("click", () => {
    state.adminToken = "";
    localStorage.removeItem("locallift_admin_token");

    if (refs.adminTokenInput) {
      refs.adminTokenInput.value = "";
    }

    showNotice("Token admin eliminado.", "warn");
    loadBusinesses({ keepCurrent: true });
  });
}

async function loadBusinesses(options = {}) {
  setLoading(true);
  showNotice("Cargando datos operativos...", "info");

  try {
    const payload = await getJson("/api/businesses?includeArchived=true");
    state.businesses = Array.isArray(payload.businesses) ? payload.businesses : [];
    renderBusinessSelect();

    if (!state.businesses.length) {
      state.business = null;
      render();
      showNotice("No hay negocios en la base local.", "warn");
      return;
    }

    const query = new URLSearchParams(window.location.search);
    const requested = query.get("business") || query.get("id") || query.get("slug");
    const current = options.keepCurrent ? state.business?.id : "";
    const selected = pickBusiness(requested || current);

    await loadBusiness(selected.id || selected.slug, { silent: true });
    showNotice("", "info");
  } catch (error) {
      state.businesses = [];
      state.business = null;
      state.contacts = [];
      state.services = [];
      state.bookings = [];
      state.availability = [];
      state.blocks = [];
      state.reminderQueue = [];
      state.report = null;
      state.crmError = "";
      state.bookingError = "";
      renderBusinessSelect();
      render();
      showNotice(error.status === 401
        ? "La API pide token admin. Pegalo en la barra lateral y guarda."
        : "No se pudo conectar con la API. Ejecuta npm.cmd start y abre esta pagina desde http://127.0.0.1:5173/pages/business-dashboard.html.", "error");
  } finally {
    setLoading(false);
  }
}

async function loadBusiness(id, options = {}) {
  if (!id) {
    return;
  }

  setLoading(true);

  try {
    const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}`);
    state.business = payload.business || null;
    await loadContacts(state.business?.id || id);
    await loadBookings(state.business?.id || id);
    await loadReport(state.business?.id || id);
    renderBusinessSelect();
    render();

    if (state.crmError || state.bookingError) {
      showNotice([state.crmError, state.bookingError].filter(Boolean).join(" "), "warn");
    } else if (!options.silent) {
      showNotice("", "info");
    }
  } catch (error) {
    const fallback = state.businesses.find((business) => business.id === id || business.slug === id);
    state.business = fallback || null;
    state.contacts = [];
    state.services = [];
    state.bookings = [];
    state.availability = [];
    state.blocks = [];
    state.reminderQueue = [];
    state.report = null;
    render();
    showNotice("Se cargo el resumen del negocio, pero falta el detalle completo.", "warn");
  } finally {
    setLoading(false);
  }
}

async function loadBookings(id) {
  state.services = [];
  state.bookings = [];
  state.availability = [];
  state.blocks = [];
  state.reminderQueue = [];
  state.bookingError = "";

  if (!id) {
    return;
  }

  try {
    const [servicesPayload, bookingsPayload, availabilityPayload, blocksPayload, remindersPayload] = await Promise.all([
      getJson(`/api/businesses/${encodeURIComponent(id)}/services`),
      getJson(`/api/businesses/${encodeURIComponent(id)}/bookings`),
      getJson(`/api/businesses/${encodeURIComponent(id)}/availability`),
      getJson(`/api/businesses/${encodeURIComponent(id)}/blocks`),
      getJson(`/api/businesses/${encodeURIComponent(id)}/reminders?hours=48`)
    ]);
    state.services = Array.isArray(servicesPayload.services) ? servicesPayload.services : [];
    state.bookings = Array.isArray(bookingsPayload.bookings) ? bookingsPayload.bookings : [];
    state.availability = Array.isArray(availabilityPayload.availability) ? availabilityPayload.availability : [];
    state.blocks = Array.isArray(blocksPayload.blocks) ? blocksPayload.blocks : [];
    state.reminderQueue = Array.isArray(remindersPayload.reminders) ? remindersPayload.reminders : [];
  } catch (error) {
    state.bookingError = "La agenda no respondio. El dashboard seguira sin reservas reales.";
  }
}

async function loadContacts(id) {
  state.contacts = [];
  state.crmError = "";

  if (!id) {
    return;
  }

  try {
    const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}/contacts?includeActivities=true`);
    state.contacts = Array.isArray(payload.contacts) ? payload.contacts : [];
  } catch (error) {
    state.crmError = "El CRM no respondio. El dashboard seguira con datos del negocio, pero sin contactos reales.";
  }
}

async function loadReport(id) {
  state.report = null;

  if (!id) {
    return;
  }

  try {
    const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}/reports/monthly`);
    state.report = payload.report || null;
  } catch (error) {
    state.report = null;
  }
}

function setLoading(isLoading) {
  state.loading = isLoading;
  if (refs.refresh) {
    refs.refresh.disabled = isLoading;
    refs.refresh.textContent = isLoading ? "Actualizando" : "Actualizar";
  }
}

async function getJson(url) {
  const response = await fetch(apiUrl(url), {
    headers: apiHeaders(),
    cache: "no-store"
  });

  if (!response.ok) {
    const error = new Error(`Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function patchJson(url, payload) {
  return sendJson("PATCH", url, payload);
}

async function putJson(url, payload) {
  return sendJson("PUT", url, payload);
}

async function postJson(url, payload) {
  return sendJson("POST", url, payload);
}

async function sendJson(method, url, payload) {
  const response = await fetch(apiUrl(url), {
    method,
    headers: apiHeaders({ json: true }),
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function apiHeaders(options = {}) {
  if (window.LocalLiftApi?.headers) {
    return window.LocalLiftApi.headers(options);
  }

  const headers = {
    Accept: "application/json"
  };

  if (options.json) {
    headers["Content-Type"] = "application/json";
  }

  if (state.adminToken) {
    headers.Authorization = `Bearer ${state.adminToken}`;
    headers["X-LocalLift-Admin-Token"] = state.adminToken;
  }

  return headers;
}

function apiUrl(url) {
  return window.LocalLiftApi?.url(url) || url;
}

function renderBusinessSelect() {
  if (!refs.businessSelect) {
    return;
  }

  if (!state.businesses.length) {
    refs.businessSelect.innerHTML = '<option value="">Sin negocios</option>';
    refs.businessSelect.disabled = true;
    return;
  }

  refs.businessSelect.disabled = false;
  refs.businessSelect.innerHTML = state.businesses
    .map((business) => {
      const selected = state.business && business.id === state.business.id ? " selected" : "";
      return `<option value="${escapeHtml(business.id)}"${selected}>${escapeHtml(business.name)} - ${escapeHtml(statusLabel(business.status))}</option>`;
    })
    .join("");
}

function pickBusiness(requested) {
  const active = state.businesses.filter((business) => business.status !== "archived");
  const pool = active.length ? active : state.businesses;

  if (requested) {
    const found = state.businesses.find((business) => business.id === requested || business.slug === requested);
    if (found) {
      return found;
    }
  }

  return pool.find((business) => business.status === "published")
    || pool.find((business) => business.status === "maintenance")
    || pool[0];
}

function setActiveTab(tab) {
  state.activeTab = tab;

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === tab);
  });

  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.dataset.panel === tab);
  });
}

function render() {
  const business = state.business;

  if (!business) {
    renderEmptyShell();
    return;
  }

  const model = createDashboardModel(business, {
    contacts: state.contacts,
    services: state.services,
    bookings: state.bookings,
    availability: state.availability,
    blocks: state.blocks,
    reminderQueue: state.reminderQueue,
    report: state.report
  });

  renderHeader(business, model);
  renderMetrics(model);
  renderActionStrip(business, model);
  renderHome(model);
  renderLeads(model);
  renderCustomers(model);
  renderBookings(model);
  renderOrders(model);
  renderProducts(model);
  renderReports(model);
  renderSettings(model);
  bindExportControls(model);
  bindCrmControls(model);
  bindBookingControls(model);
}

function renderEmptyShell() {
  refs.sideBusiness.textContent = "Sin negocio cargado";
  refs.sideMeta.textContent = "La API multi-negocio no ha devuelto datos.";
  refs.sideStatus.innerHTML = "";
  refs.pageTitle.textContent = "Dashboard";
  refs.pageSubtitle.textContent = "Leads, reservas, pedidos y acciones pendientes.";
  refs.todayList.innerHTML = emptyState("Sin datos", "Cuando exista un negocio en la API aparecera aqui.");
  refs.healthList.innerHTML = emptyState("Sin checklist", "Crea o carga un negocio para ver el estado operativo.");
  document.querySelectorAll("[data-list]").forEach((node) => {
    node.innerHTML = emptyState("Sin datos", "No hay informacion disponible.");
  });
  ["leads", "bookings", "orders"].forEach((metric) => {
    setMetric(metric, "0", "Sin datos");
  });
  setMetric("sales", "0 EUR", "Sin datos");
}

function renderHeader(business, model) {
  refs.sideBusiness.textContent = business.name;
  refs.sideMeta.textContent = [business.category, business.city, planLabel(business.plan)]
    .filter(Boolean)
    .join(" - ");
  refs.sideStatus.innerHTML = [
    statusPill(statusLabel(business.status), business.status),
    statusPill(model.primaryGoal || "Objetivo no definido", "neutral"),
    statusPill(`${model.healthScore}% listo`, model.healthScore >= 70 ? "ok" : "warn")
  ].join("");

  refs.pageTitle.textContent = business.name;
  refs.pageSubtitle.textContent = [business.category, business.city, business.ownerName]
    .filter(Boolean)
    .join(" - ") || "Operacion diaria";
}

function renderMetrics(model) {
  setMetric("leads", String(model.newLeads.length), model.leads.length ? `${model.leads.length} contactos en CRM` : "Sin leads reales todavia");
  setMetric("bookings", String(model.todayBookings.length), model.bookings.length ? `${model.bookings.length} reservas totales` : "Agenda sin citas");
  setMetric("orders", String(model.pendingOrders.length), model.orders.length ? `${model.orders.length} pedidos registrados` : "Tienda sin pedidos");
  setMetric("sales", formatMoney(model.monthSales, model.currency), model.orders.length ? "Pedidos pagados este mes" : "Sin pagos registrados");
}

function setMetric(name, value, note) {
  const valueNode = document.querySelector(`[data-metric="${name}"]`);
  const noteNode = document.querySelector(`[data-metric-note="${name}"]`);

  if (valueNode) {
    valueNode.textContent = value;
  }

  if (noteNode) {
    noteNode.textContent = note;
  }
}

function renderActionStrip(business, model) {
  const links = {
    primary: model.bookingUrl || model.whatsappUrl || model.phoneHref || "#",
    phone: model.phoneHref || "#",
    maps: model.mapsUrl || "#",
    reviews: model.reviewUrl || "#"
  };

  const labels = {
    primary: model.primaryActionLabel,
    phone: "Llamar",
    maps: "Mapa",
    reviews: "Resenas"
  };

  document.querySelectorAll("[data-business-action]").forEach((link) => {
    const key = link.dataset.businessAction;
    link.textContent = labels[key] || "Abrir";
    link.setAttribute("href", links[key] || "#");
    link.toggleAttribute("aria-disabled", !links[key] || links[key] === "#");
  });
}

function renderHome(model) {
  const tasks = [];

  if (model.newLeads.length) {
    tasks.push(taskItem("Responder leads nuevos", `${model.newLeads.length} contacto(s) esperan gestion.`, "leads"));
  }

  if (model.todayBookings.length) {
    tasks.push(taskItem("Revisar reservas de hoy", `${model.todayBookings.length} cita(s) en agenda.`, "bookings"));
  }

  if (model.pendingOrders.length) {
    tasks.push(taskItem("Preparar pedidos pendientes", `${model.pendingOrders.length} pedido(s) abiertos.`, "orders"));
  }

  if (!tasks.length) {
    tasks.push(taskItem("Sin urgencias", "El negocio no tiene tareas operativas abiertas en la base local.", "ok"));
  }

  refs.todayList.innerHTML = tasks.join("");
  refs.healthList.innerHTML = model.healthItems.map((item) => checklistItem(item)).join("");
}

function renderLeads(model) {
  const container = document.querySelector('[data-list="leads"]');

  if (!model.leads.length) {
    container.innerHTML = emptyState("Sin leads reales", "El formulario web y el chatbot ya pueden guardar aqui los nuevos contactos.");
    return;
  }

  container.innerHTML = `
    ${renderExportToolbar("leads", model.leads.length, "Exportar leads")}
    <div class="pipeline-grid">
      ${LEAD_STATUSES.map((status) => {
        const leads = model.leads.filter((lead) => String(lead.status || "new") === status);
        return `
          <section class="pipeline-column">
            <header>
              <strong>${escapeHtml(statusLabel(status))}</strong>
              <span>${escapeHtml(String(leads.length))}</span>
            </header>
            <div class="pipeline-stack">
              ${leads.length ? leads.map((lead) => renderLeadCard(lead)).join("") : '<p class="pipeline-empty">Sin contactos</p>'}
            </div>
          </section>
        `;
      }).join("")}
    </div>
  `;
}

function renderCustomers(model) {
  const container = document.querySelector('[data-list="customers"]');

  if (!model.customers.length) {
    container.innerHTML = emptyState("Sin clientes guardados", "Cuando un lead pase a cliente quedara listado aqui.");
    return;
  }

  container.innerHTML = `
    ${renderExportToolbar("customers", model.customers.length, "Exportar clientes")}
    ${renderTable(
    ["Cliente", "Telefono", "Email", "Ultima actividad"],
    model.customers.map((customer) => [
      contactName(customer),
      clean(customer.phone || "-"),
      clean(customer.email || "-"),
      formatDate(customer.lastInteractionAt || customer.createdAt)
    ])
  )}
  `;
}

function renderBookings(model) {
  const container = document.querySelector('[data-list="bookings"]');
  const form = renderBookingForm(model);
  const agendaTools = renderAgendaTools(model);
  const calendar = renderBookingCalendar(model);

  if (!model.bookings.length) {
    container.innerHTML = `${form}${agendaTools}${calendar}${emptyState("Sin reservas", "Crea una cita manual o usa el endpoint publico para recibir reservas desde la web.")}`;
    return;
  }

  container.innerHTML = `
    ${form}
    ${agendaTools}
    ${calendar}
    ${renderExportToolbar("bookings", model.bookings.length, "Exportar reservas")}
    <div class="item-grid">
      ${model.bookings.map((booking) => renderBookingCard(booking)).join("")}
    </div>
  `;
}

function renderExportToolbar(type, count, label) {
  return `
    <div class="export-toolbar">
      <span>${escapeHtml(String(count))} registro(s)</span>
      <button class="inline-action" type="button" data-export-csv="${escapeAttr(type)}">${escapeHtml(label)}</button>
    </div>
  `;
}

function renderOrders(model) {
  const container = document.querySelector('[data-list="orders"]');

  if (!model.orders.length) {
    container.innerHTML = emptyState("Sin pedidos", "La tienda ya tiene panel propio; aqui apareceran pedidos cuando la API los unifique por negocio.");
    return;
  }

  container.innerHTML = renderTable(
    ["Pedido", "Cliente", "Estado", "Total"],
    model.orders.map((order) => [
      clean(order.id || order.reference || "-"),
      clean(order.customer?.name || order.customerName || "-"),
      statusLabel(order.status || "pending"),
      formatMoney(Number(order.total || order.amount || 0), model.currency)
    ])
  );
}

function renderProducts(model) {
  const container = document.querySelector('[data-list="products"]');

  if (!model.products.length) {
    container.innerHTML = emptyState("Sin productos", "El negocio no tiene catalogo activo en los datos cargados.");
    return;
  }

  container.innerHTML = renderTable(
    ["Producto", "Precio", "Stock", "Estado"],
    model.products.map((product) => [
      clean(product.name || product.title || "-"),
      formatMoney(Number(product.price || 0), model.currency),
      String(product.stock ?? "-"),
      product.active === false ? "Oculto" : "Visible"
    ])
  );
}

function renderReports(model) {
  const container = document.querySelector('[data-list="reports"]');
  const report = model.report;
  const metrics = report?.metrics || {};
  const recommendations = buildRecommendations(model);
  const reportRecommendations = Array.isArray(report?.recommendations) && report.recommendations.length
    ? report.recommendations
    : recommendations;

  container.innerHTML = `
    <div class="report-toolbar">
      <a class="primary-action" href="${escapeAttr(getMonthlyReportUrl(model))}" target="_blank" rel="noreferrer">Abrir reporte imprimible</a>
    </div>
    <div class="report-grid">
      <article class="report-block">
        <span>Leads nuevos</span>
        <strong>${escapeHtml(String(metrics.newContacts ?? model.newLeads.length))}</strong>
        <small>${escapeHtml(report ? `Periodo ${report.period.month}` : "Datos calculados en cliente")}</small>
      </article>
      <article class="report-block">
        <span>Reservas</span>
        <strong>${escapeHtml(String(metrics.bookings ?? model.bookings.length))}</strong>
        <small>${escapeHtml(String(metrics.remindersPrepared ?? 0))} recordatorio(s) preparados</small>
      </article>
      <article class="report-block">
        <span>Ingresos</span>
        <strong>${escapeHtml(formatMoney(Number(metrics.revenue ?? model.monthSales), report?.currency || model.currency))}</strong>
        <small>${escapeHtml(String(metrics.paidOrders ?? 0))} pedido(s) pagados</small>
      </article>
    </div>
    ${report ? renderReportFunnel(report) : ""}
    <div class="recommendation-list">
      ${reportRecommendations.map((item) => `<article><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></article>`).join("")}
    </div>
  `;
}

function getMonthlyReportUrl(model) {
  const id = model.business?.id || model.business?.slug || "";
  const month = model.report?.period?.month || currentMonthKey();
  const params = new URLSearchParams({
    business: id,
    month
  });
  const apiBase = window.LocalLiftApi?.getBase?.() || "";

  if (apiBase) {
    params.set("apiBase", apiBase);
  }

  return `monthly-report.html?${params.toString()}`;
}

function renderReportFunnel(report) {
  const funnel = Array.isArray(report.funnel) ? report.funnel : [];
  const sources = Array.isArray(report.topSources) ? report.topSources : [];
  const eventBreakdown = Array.isArray(report.eventBreakdown) ? report.eventBreakdown : [];
  const eventSources = Array.isArray(report.eventSources) ? report.eventSources : [];

  return `
    <div class="report-detail-grid">
      <article class="settings-block">
        <h3>Embudo operativo</h3>
        <dl>
          ${funnel.map((item) => `
            <div>
              <dt>${escapeHtml(item.label)}</dt>
              <dd>${escapeHtml(String(item.value))}</dd>
            </div>
          `).join("")}
        </dl>
      </article>
      <article class="settings-block">
        <h3>Fuentes principales</h3>
        <dl>
          ${sources.length ? sources.map((item) => `
            <div>
              <dt>${escapeHtml(statusLabel(item.label))}</dt>
              <dd>${escapeHtml(String(item.value))}</dd>
            </div>
          `).join("") : "<div><dt>Sin datos</dt><dd>0</dd></div>"}
        </dl>
      </article>
      <article class="settings-block">
        <h3>Conversiones por accion</h3>
        <dl>
          ${eventBreakdown.length ? eventBreakdown.map((item) => `
            <div>
              <dt>${escapeHtml(statusLabel(item.label))}</dt>
              <dd>${escapeHtml(String(item.value))}</dd>
            </div>
          `).join("") : "<div><dt>Sin eventos</dt><dd>0</dd></div>"}
        </dl>
      </article>
      <article class="settings-block">
        <h3>Eventos por fuente</h3>
        <dl>
          ${eventSources.length ? eventSources.map((item) => `
            <div>
              <dt>${escapeHtml(statusLabel(item.label))}</dt>
              <dd>${escapeHtml(String(item.value))}</dd>
            </div>
          `).join("") : "<div><dt>Sin eventos</dt><dd>0</dd></div>"}
        </dl>
      </article>
    </div>
  `;
}

function renderSettings(model) {
  const container = document.querySelector('[data-list="settings"]');
  const business = model.business;

  container.innerHTML = `
    <div class="settings-grid">
      ${settingsBlock("Datos base", [
        ["Plan", planLabel(business.plan)],
        ["Estado", statusLabel(business.status)],
        ["Sector", business.category || "-"],
        ["Ciudad", business.city || "-"]
      ])}
      ${settingsBlock("Contacto", [
        ["Responsable", business.ownerName || "-"],
        ["Email", business.ownerEmail || model.email || "-"],
        ["Telefono", business.ownerPhone || model.phone || "-"],
        ["URL publicada", business.publishedUrl || "-"]
      ])}
      ${settingsBlock("Integraciones", [
        ["Google", model.googleEnabled ? "Activo" : "Pendiente"],
        ["WhatsApp", model.whatsappUrl ? "Activo" : "Pendiente"],
        ["Stripe", model.stripeEnabled ? "Activo" : "Pendiente"],
        ["Tienda", model.products.length ? "Con catalogo" : "Sin catalogo"]
      ])}
    </div>
  `;
}

function createDashboardModel(business, crm = {}) {
  const content = business.content || {};
  const commerce = content.commerce || {};
  const google = content.google || {};
  const integrations = business.integrations || {};

  const contacts = arrayFrom(crm.contacts, content.contacts, business.contacts);
  const leads = arrayFrom(
    content.leads,
    business.leads,
    contacts.filter((contact) => contact.type !== "customer" && !["customer"].includes(String(contact.status || "")))
  );
  const customers = arrayFrom(
    content.customers,
    business.customers,
    contacts.filter((contact) => contact.type === "customer" || ["customer", "won"].includes(String(contact.status || "")))
  );
  const services = arrayFrom(crm.services, content.bookableServices, business.services);
  const bookings = arrayFrom(crm.bookings, content.bookings, business.bookings);
  const availability = arrayFrom(crm.availability, content.availability, business.availability);
  const blocks = arrayFrom(crm.blocks, content.bookingBlocks, business.bookingBlocks);
  const reminderQueue = arrayFrom(crm.reminderQueue, content.reminderQueue, business.reminderQueue);
  const report = crm.report || null;
  const orders = arrayFrom(content.orders, commerce.orders, business.orders);
  const products = arrayFrom(content.products, commerce.products, business.products);
  const events = arrayFrom(content.metricEvents, business.metricEvents, content.events);
  const today = new Date();
  const currency = commerce.currency || content.currency || "EUR";
  const primaryGoal = business.settings?.primaryGoal || content.conversionGoal || "Reservas y contactos";
  const bookingUrl = content.bookingUrl || google.appointmentUrl || "";
  const whatsappUrl = integrations.whatsapp?.url || content.whatsappUrl || "";
  const mapsUrl = google.mapsUrl || integrations.google?.mapsUrl || content.mapsUrl || "";
  const reviewUrl = google.reviewUrl || integrations.google?.reviewUrl || "";
  const phone = business.ownerPhone || content.phone || "";
  const email = business.ownerEmail || content.email || "";

  const todayBookings = bookings.filter((booking) => sameDay(booking.startsAt || booking.date, today) && !["canceled", "cancelled"].includes(String(booking.status || "").toLowerCase()));
  const pendingOrders = orders.filter((order) => ["pending", "paid", "preparing", "ready"].includes(String(order.status || "pending").toLowerCase()));
  const newLeads = leads.filter((lead) => ["new", "nuevo", "unread"].includes(String(lead.status || "new").toLowerCase()));
  const monthSales = orders
    .filter((order) => ["paid", "preparing", "ready", "fulfilled"].includes(String(order.status || "").toLowerCase()))
    .filter((order) => sameMonth(order.paidAt || order.createdAt || order.updatedAt, today))
    .reduce((sum, order) => sum + Number(order.total || order.amount || 0), 0);

  const healthItems = buildHealthItems({
    business,
    content,
    google,
    commerce,
    integrations,
    leads,
    bookings,
    orders,
    products
  });
  const healthScore = Math.round((healthItems.filter((item) => item.done).length / healthItems.length) * 100);

  return {
    business,
    leads,
    customers,
    services,
    bookings,
    availability,
    blocks,
    reminderQueue,
    report,
    orders,
    products,
    conversionEvents: events.filter((event) => String(event.type || "").includes("click") || String(event.type || "").includes("lead")),
    newLeads,
    todayBookings,
    pendingOrders,
    monthSales,
    currency,
    primaryGoal,
    primaryActionLabel: content.bookingLabel || (bookingUrl ? "Reservar" : "Contactar"),
    bookingUrl,
    whatsappUrl,
    mapsUrl,
    reviewUrl,
    phone,
    phoneHref: phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "",
    email,
    googleEnabled: Boolean(integrations.google?.enabled || google.enabled || mapsUrl),
    stripeEnabled: Boolean(integrations.stripe?.enabled || commerce.checkoutEndpoint),
    healthItems,
    healthScore
  };
}

function bindCrmControls() {
  document.querySelectorAll("[data-contact-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      const contactId = select.dataset.contactId || "";
      const status = select.value;

      if (!contactId || !state.business) {
        return;
      }

      select.disabled = true;

      try {
        const result = await patchJson(
          `/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/contacts/${encodeURIComponent(contactId)}`,
          { status }
        );
        state.contacts = state.contacts.map((contact) => (
          contact.id === contactId ? { ...contact, ...result.contact, activities: result.contact.activities || contact.activities } : contact
        ));
        showNotice("Estado del lead actualizado.", "info");
        render();
      } catch (error) {
        showNotice("No se pudo actualizar el estado del lead.", "error");
        select.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-contact-note-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const contactId = form.dataset.contactId || "";
      const input = form.elements.note;
      const note = clean(input?.value || "");

      if (!contactId || !note || !state.business) {
        return;
      }

      const button = form.querySelector("button");
      if (button) {
        button.disabled = true;
      }

      try {
        const result = await postJson(
          `/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/contacts/${encodeURIComponent(contactId)}/activities`,
          {
            type: "task",
            title: "Nota / tarea",
            note,
            source: "dashboard"
          }
        );
        state.contacts = state.contacts.map((contact) => (
          contact.id === contactId
            ? { ...contact, activities: [result.activity, ...(contact.activities || [])], lastInteractionAt: result.contact?.lastInteractionAt || contact.lastInteractionAt }
            : contact
        ));
        showNotice("Nota guardada en el historial del lead.", "info");
        render();
      } catch (error) {
        showNotice("No se pudo guardar la nota del lead.", "error");
        if (button) {
          button.disabled = false;
        }
      }
    });
  });
}

function bindExportControls(model) {
  document.querySelectorAll("[data-export-csv]").forEach((button) => {
    button.addEventListener("click", () => {
      const type = button.dataset.exportCsv || "";
      const rows = getCsvRows(type, model);

      if (!rows.length) {
        showNotice("No hay registros para exportar.", "warn");
        return;
      }

      downloadCsv(buildCsvFilename(type, model.business), rows);
      showNotice("CSV exportado.", "info");
    });
  });
}

function bindBookingControls() {
  document.querySelectorAll("[data-booking-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      const bookingId = select.dataset.bookingId || "";
      const status = select.value;

      if (!bookingId || !state.business) {
        return;
      }

      select.disabled = true;

      try {
        const result = await patchJson(
          `/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/bookings/${encodeURIComponent(bookingId)}`,
          { status }
        );
        state.bookings = state.bookings.map((booking) => booking.id === bookingId ? result.booking : booking);
        showNotice("Reserva actualizada.", "info");
        render();
      } catch (error) {
        showNotice("No se pudo actualizar la reserva.", "error");
        select.disabled = false;
      }
    });
  });

  document.querySelector("[data-booking-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.business) {
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      serviceId: clean(data.get("serviceId")),
      customerName: clean(data.get("customerName")),
      contact: clean(data.get("contact")),
      startsAt: data.get("startsAt") ? new Date(String(data.get("startsAt"))).toISOString() : "",
      notes: clean(data.get("notes")),
      status: "confirmed",
      source: "dashboard"
    };
    const button = form.querySelector("button");

    if (button) {
      button.disabled = true;
    }

    try {
      const result = await postJson(`/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/bookings`, payload);
      state.bookings = [...state.bookings, result.booking].sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
      if (result.contact) {
        const exists = state.contacts.some((contact) => contact.id === result.contact.id);
        state.contacts = exists
          ? state.contacts.map((contact) => contact.id === result.contact.id ? { ...contact, ...result.contact } : contact)
          : [result.contact, ...state.contacts];
      }
      showNotice("Reserva creada y vinculada al CRM.", "info");
      form.reset();
      render();
    } catch (error) {
      showNotice(error.status === 409 ? "Ese hueco no esta disponible." : "No se pudo crear la reserva.", "error");
      if (button) {
        button.disabled = false;
      }
    }
  });

  document.querySelectorAll("[data-calendar-shift]").forEach((button) => {
    button.addEventListener("click", () => {
      const shift = Number(button.dataset.calendarShift || 0);
      state.calendarWeekOffset = shift === 0 ? 0 : state.calendarWeekOffset + shift;
      render();
    });
  });

  document.querySelectorAll("[data-booking-reminder]").forEach((button) => {
    button.addEventListener("click", async () => {
      const bookingId = button.dataset.bookingId || "";
      const channel = button.dataset.channel || "manual";

      if (!bookingId || !state.business) {
        return;
      }

      button.disabled = true;

      try {
        const result = await postJson(
          `/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/bookings/${encodeURIComponent(bookingId)}/reminders`,
          { channel, source: "dashboard" }
        );
        state.bookings = state.bookings.map((booking) => booking.id === bookingId ? { ...booking, ...result.booking } : booking);
        openReminderAction(result.actions, channel);
        showNotice("Recordatorio preparado y registrado en el CRM.", "info");
        render();
      } catch (error) {
        showNotice("No se pudo preparar el recordatorio.", "error");
        button.disabled = false;
      }
    });
  });

  document.querySelector("[data-reminder-batch]")?.addEventListener("click", async (event) => {
    if (!state.business) {
      return;
    }

    const button = event.currentTarget;
    button.disabled = true;

    try {
      const result = await postJson(
        `/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/reminders`,
        { hours: 48, limit: 25 }
      );
      const updates = Array.isArray(result.reminders) ? result.reminders : [];
      state.bookings = state.bookings.map((booking) => {
        const found = updates.find((item) => item.booking?.id === booking.id);
        return found ? { ...booking, ...found.booking } : booking;
      });
      state.reminderQueue = [];
      showNotice(`${updates.length} recordatorio(s) preparados en modo dry-run.`, "info");
      render();
    } catch (error) {
      showNotice("No se pudo preparar el lote de recordatorios.", "error");
      button.disabled = false;
    }
  });

  document.querySelector("[data-availability-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.business) {
      return;
    }

    const form = event.currentTarget;
    const availability = WEEKDAYS.map((day) => ({
      id: clean(form.elements[`id-${day.value}`]?.value || ""),
      weekday: day.value,
      active: Boolean(form.elements[`active-${day.value}`]?.checked),
      startTime: clean(form.elements[`startTime-${day.value}`]?.value || "10:00"),
      endTime: clean(form.elements[`endTime-${day.value}`]?.value || "18:00")
    }));
    const button = form.querySelector("button");

    if (button) {
      button.disabled = true;
    }

    try {
      const result = await putJson(
        `/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/availability`,
        { availability }
      );
      state.availability = Array.isArray(result.availability) ? result.availability : availability;
      showNotice("Horario de reservas actualizado.", "info");
      render();
    } catch (error) {
      showNotice("No se pudo guardar el horario.", "error");
      if (button) {
        button.disabled = false;
      }
    }
  });

  document.querySelector("[data-block-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.business) {
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      startsAt: data.get("startsAt") ? new Date(String(data.get("startsAt"))).toISOString() : "",
      endsAt: data.get("endsAt") ? new Date(String(data.get("endsAt"))).toISOString() : "",
      reason: clean(data.get("reason") || "Bloqueo manual"),
      active: true
    };
    const button = form.querySelector("button");

    if (button) {
      button.disabled = true;
    }

    try {
      const result = await postJson(`/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/blocks`, payload);
      state.blocks = [...state.blocks, result.block].sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
      showNotice("Bloqueo anadido a la agenda.", "info");
      form.reset();
      render();
    } catch (error) {
      showNotice("No se pudo crear el bloqueo.", "error");
      if (button) {
        button.disabled = false;
      }
    }
  });

  document.querySelectorAll("[data-block-toggle]").forEach((button) => {
    button.addEventListener("click", async () => {
      const blockId = button.dataset.blockId || "";

      if (!blockId || !state.business) {
        return;
      }

      button.disabled = true;

      try {
        const result = await patchJson(
          `/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/blocks/${encodeURIComponent(blockId)}`,
          { active: false }
        );
        state.blocks = state.blocks.map((block) => block.id === blockId ? result.block : block);
        showNotice("Bloqueo desactivado.", "info");
        render();
      } catch (error) {
        showNotice("No se pudo desactivar el bloqueo.", "error");
        button.disabled = false;
      }
    });
  });
}

function renderBookingForm(model) {
  if (!model.services.length) {
    return emptyState("Sin servicios reservables", "Crea servicios en la API o guarda servicios del negocio para activar la agenda.");
  }

  return `
    <form class="booking-form" data-booking-form>
      <label>
        Servicio
        <select name="serviceId" required>
          ${model.services.map((service) => `<option value="${escapeAttr(service.id)}">${escapeHtml(service.name)} (${escapeHtml(String(service.durationMinutes || 60))} min)</option>`).join("")}
        </select>
      </label>
      <label>
        Cliente
        <input name="customerName" type="text" autocomplete="name" required>
      </label>
      <label>
        Telefono o email
        <input name="contact" type="text" autocomplete="tel" required>
      </label>
      <label>
        Fecha y hora
        <input name="startsAt" type="datetime-local" required>
      </label>
      <label class="wide-field">
        Nota
        <input name="notes" type="text" placeholder="Preferencias, personas, contexto...">
      </label>
      <button type="submit">Crear reserva</button>
    </form>
  `;
}

function renderAgendaTools(model) {
  return `
    <div class="agenda-tools">
      <section class="agenda-panel">
        <header>
          <h3>Disponibilidad semanal</h3>
          <span>${escapeHtml(String(model.availability.filter((rule) => rule.active !== false).length))} tramo(s) activos</span>
        </header>
        <form class="availability-form" data-availability-form>
          ${getAvailabilityRows(model.availability).map((row) => renderAvailabilityRow(row)).join("")}
          <button type="submit">Guardar horario</button>
        </form>
      </section>
      <section class="agenda-panel">
        <header>
          <h3>Bloqueos manuales</h3>
          <span>${escapeHtml(String(model.blocks.filter((block) => block.active !== false).length))} activo(s)</span>
        </header>
        <form class="block-form" data-block-form>
          <label>
            Inicio
            <input name="startsAt" type="datetime-local" required>
          </label>
          <label>
            Fin
            <input name="endsAt" type="datetime-local" required>
          </label>
          <label>
            Motivo
            <input name="reason" type="text" placeholder="Cierre, evento, descanso...">
          </label>
          <button type="submit">Bloquear</button>
        </form>
        <div class="block-list">
          ${model.blocks.length ? model.blocks.map((block) => renderBlockCard(block)).join("") : '<p class="pipeline-empty">Sin bloqueos</p>'}
        </div>
      </section>
    </div>
    ${renderReminderQueue(model)}
  `;
}

function renderReminderQueue(model) {
  return `
    <section class="reminder-panel">
      <header>
        <div>
          <h3>Recordatorios proximos</h3>
          <span>${escapeHtml(String(model.reminderQueue.length))} pendiente(s) en 48h</span>
        </div>
        <button type="button" data-reminder-batch${model.reminderQueue.length ? "" : " disabled"}>Preparar lote</button>
      </header>
      <div class="reminder-list">
        ${model.reminderQueue.length
          ? model.reminderQueue.slice(0, 6).map((item) => renderReminderQueueItem(item)).join("")
          : '<p class="pipeline-empty">No hay reservas proximas sin recordatorio.</p>'}
      </div>
    </section>
  `;
}

function renderReminderQueueItem(item) {
  const booking = item.booking || {};

  return `
    <article class="reminder-item">
      <div>
        <strong>${escapeHtml(clean(booking.customerName || "Cliente"))}</strong>
        <span>${escapeHtml(formatDateTime(booking.startsAt))} - ${escapeHtml(clean(booking.serviceName || "Reserva"))}</span>
      </div>
      <span class="pill neutral">${escapeHtml(statusLabel(item.channel || "manual"))}</span>
    </article>
  `;
}

function renderAvailabilityRow(row) {
  return `
    <label class="availability-row">
      <input name="active-${escapeAttr(row.weekday)}" type="checkbox"${row.active ? " checked" : ""}>
      <span>${escapeHtml(row.label)}</span>
      <input name="id-${escapeAttr(row.weekday)}" type="hidden" value="${escapeAttr(row.id)}">
      <input name="startTime-${escapeAttr(row.weekday)}" type="time" value="${escapeAttr(row.startTime)}" required>
      <input name="endTime-${escapeAttr(row.weekday)}" type="time" value="${escapeAttr(row.endTime)}" required>
    </label>
  `;
}

function renderBlockCard(block) {
  const active = block.active !== false;

  return `
    <article class="block-card${active ? "" : " is-inactive"}">
      <div>
        <strong>${escapeHtml(clean(block.reason || "Bloqueo manual"))}</strong>
        <span>${escapeHtml(formatDateTimeRange(block.startsAt, block.endsAt))}</span>
      </div>
      ${active
        ? `<button type="button" data-block-toggle data-block-id="${escapeAttr(block.id)}">Desactivar</button>`
        : '<span class="pill neutral">Inactivo</span>'}
    </article>
  `;
}

function renderBookingCalendar(model) {
  const days = getCalendarDays(state.calendarWeekOffset);
  const rangeLabel = `${formatDate(days[0])} - ${formatDate(days[days.length - 1])}`;

  return `
    <section class="booking-calendar">
      <header>
        <div>
          <h3>Calendario semanal</h3>
          <span>${escapeHtml(rangeLabel)}</span>
        </div>
        <div class="calendar-actions">
          <button type="button" data-calendar-shift="-1">Anterior</button>
          <button type="button" data-calendar-shift="0">Hoy</button>
          <button type="button" data-calendar-shift="1">Siguiente</button>
        </div>
      </header>
      <div class="calendar-grid">
        ${days.map((day) => renderCalendarDay(day, model.bookings)).join("")}
      </div>
    </section>
  `;
}

function renderCalendarDay(day, bookings) {
  const items = bookings
    .filter((booking) => sameDay(booking.startsAt || booking.date, day))
    .sort((a, b) => String(a.startsAt || "").localeCompare(String(b.startsAt || "")));

  return `
    <article class="calendar-day">
      <header>
        <strong>${escapeHtml(day.toLocaleDateString("es-ES", { weekday: "short" }))}</strong>
        <span>${escapeHtml(day.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }))}</span>
      </header>
      <div class="calendar-events">
        ${items.length ? items.map((booking) => renderCalendarEvent(booking)).join("") : '<p class="pipeline-empty">Sin reservas</p>'}
      </div>
    </article>
  `;
}

function renderCalendarEvent(booking) {
  const reminderMeta = booking.lastReminderAt
    ? `Ultimo recordatorio: ${formatDateTime(booking.lastReminderAt)}`
    : "Sin recordatorio";

  return `
    <article class="calendar-event">
      <span class="pill ${escapeHtml(booking.status || "pending")}">${escapeHtml(statusLabel(booking.status || "pending"))}</span>
      <strong>${escapeHtml(formatTime(booking.startsAt || booking.date))} - ${escapeHtml(clean(booking.customerName || booking.name || "Cliente"))}</strong>
      <span>${escapeHtml(clean(booking.serviceName || booking.service || "Reserva"))}</span>
      <small>${escapeHtml(reminderMeta)}</small>
      <button type="button" data-booking-reminder data-booking-id="${escapeAttr(booking.id)}" data-channel="${escapeAttr(preferredReminderChannel(booking))}">Recordar</button>
    </article>
  `;
}

function renderBookingCard(booking) {
  return `
    <article class="item-card booking-card">
      <span class="pill ${escapeHtml(booking.status || "pending")}">${escapeHtml(statusLabel(booking.status || "pending"))}</span>
      <h3>${escapeHtml(clean(booking.serviceName || booking.service || "Reserva"))}</h3>
      <p>${escapeHtml(clean(booking.customerName || booking.name || "Cliente sin nombre"))}</p>
      <p>${escapeHtml(clean([booking.phone, booking.email].filter(Boolean).join(" / ") || booking.notes || ""))}</p>
      <strong>${escapeHtml(formatDateTime(booking.startsAt || booking.date))}</strong>
      <p>${escapeHtml(booking.lastReminderAt ? `Recordatorio: ${formatDateTime(booking.lastReminderAt)}` : "Sin recordatorio enviado")}</p>
      <label class="status-field">
        Estado
        <select data-booking-status data-booking-id="${escapeAttr(booking.id)}">
          ${BOOKING_STATUSES.map((status) => `<option value="${escapeAttr(status)}"${String(booking.status || "pending") === status ? " selected" : ""}>${escapeHtml(statusLabel(status))}</option>`).join("")}
        </select>
      </label>
      <button class="inline-action" type="button" data-booking-reminder data-booking-id="${escapeAttr(booking.id)}" data-channel="${escapeAttr(preferredReminderChannel(booking))}">Preparar recordatorio</button>
    </article>
  `;
}

function renderLeadCard(lead) {
  const activities = Array.isArray(lead.activities) ? lead.activities.slice(0, 2) : [];
  const contact = [lead.phone, lead.email].filter(Boolean).join(" / ") || "Sin contacto";
  const notes = clean(lead.notes || "");

  return `
    <article class="lead-card">
      <header>
        <strong>${escapeHtml(contactName(lead))}</strong>
        <span>${escapeHtml(clean(lead.source || "web"))}</span>
      </header>
      <p>${escapeHtml(contact)}</p>
      ${notes ? `<p>${escapeHtml(notes)}</p>` : ""}
      <label class="status-field">
        Estado
        <select data-contact-status data-contact-id="${escapeAttr(lead.id)}">
          ${LEAD_STATUSES.map((status) => `<option value="${escapeAttr(status)}"${String(lead.status || "new") === status ? " selected" : ""}>${escapeHtml(statusLabel(status))}</option>`).join("")}
        </select>
      </label>
      <div class="activity-trail">
        ${activities.length
          ? activities.map((activity) => `<span>${escapeHtml(activity.title || statusLabel(activity.type))} - ${escapeHtml(formatDate(activity.createdAt))}</span>`).join("")
          : "<span>Sin historial todavia</span>"}
      </div>
      <form class="note-form" data-contact-note-form data-contact-id="${escapeAttr(lead.id)}">
        <input name="note" type="text" placeholder="Nota o tarea rapida">
        <button type="submit">Guardar</button>
      </form>
    </article>
  `;
}

function buildHealthItems(input) {
  const { business, content, google, commerce, integrations, products } = input;

  return [
    {
      title: "Datos del negocio",
      text: [business.name, business.category, business.city].filter(Boolean).join(" - "),
      done: Boolean(business.name && business.category && business.city)
    },
    {
      title: "Contacto principal",
      text: business.ownerPhone || content.phone || business.ownerEmail || content.email || "Sin telefono ni email",
      done: Boolean(business.ownerPhone || content.phone || business.ownerEmail || content.email)
    },
    {
      title: "Accion principal",
      text: content.bookingUrl || google.appointmentUrl || integrations.whatsapp?.url || "Sin enlace principal",
      done: Boolean(content.bookingUrl || google.appointmentUrl || integrations.whatsapp?.url)
    },
    {
      title: "Google local",
      text: google.mapsUrl || integrations.google?.mapsUrl || "Mapa pendiente",
      done: Boolean(google.mapsUrl || integrations.google?.mapsUrl)
    },
    {
      title: "Resenas",
      text: google.reviewUrl || integrations.google?.reviewUrl || "Enlace pendiente",
      done: Boolean(google.reviewUrl || integrations.google?.reviewUrl)
    },
    {
      title: "Catalogo",
      text: products.length ? `${products.length} producto(s)` : "Sin catalogo",
      done: products.length > 0 || commerce.enabled === false
    }
  ];
}

function buildRecommendations(model) {
  const recommendations = [];

  if (!model.leads.length) {
    recommendations.push({
      title: "Conectar CRM de leads",
      text: "El formulario y el chatbot deben guardar contactos reales en la siguiente fase."
    });
  }

  if (!model.bookings.length && String(model.primaryGoal).toLowerCase().includes("reserva")) {
    recommendations.push({
      title: "Activar reservas MVP",
      text: "El objetivo principal pide agenda, pero todavia no hay citas ni disponibilidad en datos."
    });
  }

  if (!model.reviewUrl) {
    recommendations.push({
      title: "Completar enlace de resenas",
      text: "La solicitud de resenas es una accion mensual de alto valor para negocios locales."
    });
  }

  if (!model.products.length && model.business.plan === "comercio-local") {
    recommendations.push({
      title: "Cargar catalogo inicial",
      text: "El plan comercial necesita productos visibles para empezar a medir pedidos."
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      title: "Preparado para reporte",
      text: "Los datos base, Google y acciones principales estan listos para seguimiento mensual."
    });
  }

  return recommendations;
}

function getAvailabilityRows(availability) {
  const rules = Array.isArray(availability) ? availability : [];

  return WEEKDAYS.map((day) => {
    const dayRules = rules.filter((rule) => Number(rule.weekday) === day.value);
    const selected = dayRules.find((rule) => rule.active !== false) || dayRules[0] || null;
    const isWeekday = day.value >= 1 && day.value <= 5;

    return {
      weekday: day.value,
      label: day.label,
      id: selected?.id || "",
      active: selected ? selected.active !== false : isWeekday,
      startTime: selected?.startTime || "10:00",
      endTime: selected?.endTime || "18:00"
    };
  });
}

function getCalendarDays(offset) {
  const start = startOfWeek(addDays(new Date(), offset * 7));
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function startOfWeek(date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function preferredReminderChannel(booking) {
  if (cleanPhone(booking.phone).length >= 6) {
    return "whatsapp";
  }

  if (clean(booking.email)) {
    return "email";
  }

  return "manual";
}

function cleanPhone(value) {
  return clean(value).replace(/[^\d+]/g, "").replace(/^\+/, "");
}

function openReminderAction(actions, channel) {
  const url = channel === "email" ? actions?.mailtoUrl : actions?.whatsappUrl;

  if (url) {
    window.open(url, "_blank", "noopener");
  }
}

function taskItem(title, text, type) {
  return `
    <article class="task-item">
      <span class="task-dot ${escapeHtml(type)}"></span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(text)}</p>
      </div>
    </article>
  `;
}

function checklistItem(item) {
  return `
    <article class="check-item ${item.done ? "is-done" : "is-pending"}">
      <span>${item.done ? "OK" : "!"}</span>
      <div>
        <strong>${escapeHtml(item.title)}</strong>
        <p>${escapeHtml(item.text)}</p>
      </div>
    </article>
  `;
}

function settingsBlock(title, rows) {
  return `
    <article class="settings-block">
      <h3>${escapeHtml(title)}</h3>
      <dl>
        ${rows.map(([key, value]) => `
          <div>
            <dt>${escapeHtml(key)}</dt>
            <dd>${escapeHtml(clean(value))}</dd>
          </div>
        `).join("")}
      </dl>
    </article>
  `;
}

function renderTable(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr>${row.map((cell) => `<td>${escapeHtml(clean(cell))}</td>`).join("")}</tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function emptyState(title, text) {
  return `
    <section class="empty-state">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(text)}</p>
    </section>
  `;
}

function getCsvRows(type, model) {
  if (type === "leads") {
    return model.leads.map(contactToCsvRow);
  }

  if (type === "customers") {
    return model.customers.map(contactToCsvRow);
  }

  if (type === "bookings") {
    return model.bookings.map(bookingToCsvRow);
  }

  return [];
}

function contactToCsvRow(contact) {
  return {
    Nombre: contactName(contact),
    Telefono: clean(contact.phone || ""),
    Email: clean(contact.email || ""),
    Estado: statusLabel(contact.status || "new"),
    Fuente: statusLabel(contact.source || "manual"),
    Etiquetas: Array.isArray(contact.tags) ? contact.tags.join(", ") : clean(contact.tags || ""),
    Valor: Number(contact.valueEstimate || 0),
    Notas: clean(contact.notes || ""),
    "Ultima actividad": formatDateTime(contact.lastInteractionAt || contact.updatedAt || contact.createdAt),
    Creado: formatDateTime(contact.createdAt)
  };
}

function bookingToCsvRow(booking) {
  return {
    Servicio: clean(booking.serviceName || booking.service || ""),
    Cliente: clean(booking.customerName || booking.name || ""),
    Telefono: clean(booking.phone || ""),
    Email: clean(booking.email || ""),
    Contacto: clean(booking.contact || booking.customerContact || ""),
    Estado: statusLabel(booking.status || "pending"),
    Inicio: formatDateTime(booking.startsAt || booking.date),
    Fin: formatDateTime(booking.endsAt || ""),
    Notas: clean(booking.notes || ""),
    "Ultimo recordatorio": formatDateTime(booking.lastReminderAt || ""),
    Creado: formatDateTime(booking.createdAt)
  };
}

function downloadCsv(filename, rows) {
  const csv = rowsToCsv(rows);
  const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
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

function rowsToCsv(rows) {
  const headers = Object.keys(rows[0] || {});
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n");
}

function csvCell(value) {
  const text = clean(value).replace(/"/g, '""');
  return /[",\n\r]/.test(text) ? `"${text}"` : text;
}

function buildCsvFilename(type, business) {
  const slug = cleanSlug(business?.slug || business?.name || "negocio") || "negocio";
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}-${type}-${date}.csv`;
}

function statusPill(label, status) {
  return `<span class="pill ${escapeHtml(status || "neutral")}">${escapeHtml(label)}</span>`;
}

function showNotice(message, type) {
  if (!refs.notice) {
    return;
  }

  refs.notice.hidden = !message;
  refs.notice.textContent = message || "";
  refs.notice.dataset.type = type || "info";
}

function arrayFrom(...values) {
  const arrays = values.filter((value) => Array.isArray(value));
  return arrays.find((value) => value.length) || arrays[0] || [];
}

function contactName(contact) {
  return clean(contact.name || contact.fullName || contact.customerName || contact.email || contact.phone || "Contacto sin nombre");
}

function sameDay(value, date) {
  const parsed = parseDate(value);
  return Boolean(parsed)
    && parsed.getFullYear() === date.getFullYear()
    && parsed.getMonth() === date.getMonth()
    && parsed.getDate() === date.getDate();
}

function sameMonth(value, date) {
  const parsed = parseDate(value);
  return Boolean(parsed)
    && parsed.getFullYear() === date.getFullYear()
    && parsed.getMonth() === date.getMonth();
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const parsed = parseDate(value);
  return parsed ? parsed.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "-";
}

function formatDateTime(value) {
  const parsed = parseDate(value);
  return parsed
    ? parsed.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : "-";
}

function formatTime(value) {
  const parsed = parseDate(value);
  return parsed ? parsed.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }) : "--:--";
}

function formatDateTimeRange(start, end) {
  return `${formatDateTime(start)} - ${formatDateTime(end)}`;
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMoney(value, currency) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: value % 1 === 0 ? 0 : 2
  }).format(Number(value || 0));
}

function planLabel(value) {
  const labels = {
    "presencia-local": "Presencia Local",
    "operacion-local": "Operacion Local",
    "comercio-local": "Comercio Local",
    "digitalizacion-total": "Digitalizacion Total"
  };

  return labels[value] || clean(value || "Sin plan");
}

function statusLabel(value) {
  const labels = {
    lead: "Lead",
    onboarding: "Onboarding",
    "in-design": "En diseno",
    "in-review": "En revision",
    published: "Publicado",
    maintenance: "Mantenimiento",
    paused: "Pausado",
    archived: "Archivado",
    new: "Nuevo",
    contacted: "Contactado",
    waiting: "Esperando",
    reserved: "Reservado",
    won: "Ganado",
    lost: "Perdido",
    customer: "Cliente",
    pending: "Pendiente",
    manual: "Manual",
    whatsapp: "WhatsApp",
    email: "Email",
    phone: "Telefono",
    phone_click: "Click telefono",
    email_click: "Click email",
    booking_click: "Click reserva",
    public_booking_submit: "Reserva enviada",
    lead_form_submit: "Lead enviado",
    chatbot_open: "Chat abierto",
    chatbot_message: "Mensaje chatbot",
    chatbot_lead_captured: "Lead chatbot",
    google_maps_click: "Click mapa",
    google_review_click: "Click resena",
    confirmed: "Confirmada",
    completed: "Completada",
    "no-show": "No asistio",
    paid: "Pagado",
    preparing: "Preparando",
    ready: "Listo",
    fulfilled: "Entregado",
    canceled: "Cancelado",
    cancelled: "Cancelado",
    ok: "OK"
  };

  return labels[value] || clean(value || "Pendiente");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanSlug(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
