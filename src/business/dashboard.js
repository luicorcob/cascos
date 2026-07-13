const state = {
  activeTab: "inbox",
  calendarWeekOffset: 0,
  businesses: [],
  business: null,
  contacts: [],
  pipeline: null,
  scoreLabelFilter: "all",
  duplicateGroups: [],
  proposals: [],
  proposalLoading: false,
  proposalError: "",
  proposalFeedback: { type: "", message: "" },
  proposalDraftContactId: "",
  messageTemplates: [],
  messageTemplateTypes: [],
  messagePlaceholders: [],
  messageLoading: false,
  messageError: "",
  messageComposer: {
    contactId: "",
    templateId: "",
    preview: null,
    feedback: ""
  },
  nextActions: {
    today: [],
    overdue: [],
    missing: []
  },
  services: [],
  bookings: [],
  availability: [],
  blocks: [],
  reminderQueue: [],
  report: null,
  forecast: null,
  forecastMonth: currentMonthKey(),
  forecastLoading: false,
  forecastError: "",
  forecastRequestSequence: 0,
  sla: null,
  slaHours: 24,
  slaLoading: false,
  slaError: "",
  slaRequestSequence: 0,
  commercialDashboard: null,
  commercialDashboardLoading: false,
  commercialDashboardError: "",
  commercialDashboardRequestSequence: 0,
  inbox: null,
  inboxLoading: false,
  inboxError: "",
  inboxStaleDays: 30,
  inboxRequestSequence: 0,
  googleStatus: null,
  googleDiagnostics: null,
  apiBase: window.LocalLiftApi?.getBase?.() || "",
  adminToken: localStorage.getItem("locallift_admin_token") || "",
  clientSession: window.LocalLiftApi?.getClientSession?.() || null,
  timelineRequestSequence: 0,
  crmError: "",
  bookingError: "",
  googleError: "",
  loading: false
};

const LEAD_STATUSES = ["new", "contacted", "waiting", "reserved", "won", "lost", "customer"];
const LEAD_PRIORITIES = ["alta", "media", "baja"];
const LEAD_SCORE_LABELS = ["caliente", "templado", "frio", "perdido"];
const LOST_REASONS = ["precio", "no_responde", "ya_tiene_proveedor", "fuera_de_zona", "pospuesto", "no_encaja", "competencia"];
const NEXT_ACTION_TYPES = ["llamada", "whatsapp", "email", "reunion", "enviar_propuesta", "revisar_reserva"];
const PROPOSAL_PACKAGES = ["presencia_local", "conversion_pro", "growth_local", "custom"];
const PROPOSAL_STATUSES = ["borrador", "enviada", "vista", "aceptada", "rechazada", "caducada"];
const MESSAGE_TEMPLATE_TYPES = ["primer_contacto", "envio_demo", "seguimiento_48h", "envio_propuesta", "reactivacion_lead_frio", "solicitud_resena"];
const BOOKING_STATUSES = ["pending", "confirmed", "completed", "canceled", "no-show"];
const INBOX_STALE_DAY_OPTIONS = [14, 30, 45, 60, 90];
const SLA_HOUR_OPTIONS = [4, 8, 12, 24, 48, 72];
const INBOX_SECTION_CONFIG = Object.freeze({
  overdueActions: {
    label: "Acciones vencidas",
    kicker: "Atencion inmediata",
    empty: "No hay acciones fuera de plazo."
  },
  newLeads: {
    label: "Leads nuevos",
    kicker: "Primer contacto",
    empty: "No hay leads pendientes de primer contacto."
  },
  todayBookings: {
    label: "Reservas de hoy",
    kicker: "Agenda",
    empty: "No hay reservas activas para hoy."
  },
  pendingProposals: {
    label: "Propuestas pendientes",
    kicker: "Seguimiento comercial",
    empty: "No hay propuestas enviadas o vistas pendientes."
  },
  staleCustomers: {
    label: "Clientes sin seguimiento",
    kicker: "Retencion",
    empty: "Todos los clientes tienen seguimiento reciente."
  },
  reviewSuggestions: {
    label: "Sugerencias de resena",
    kicker: "Reputacion",
    empty: "No hay solicitudes de resena recomendadas."
  }
});
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
  refs.clientLogout = document.querySelector("[data-client-logout]");
  refs.notice = document.querySelector("[data-notice]");
  refs.sideBusiness = document.querySelector("[data-side-business]");
  refs.sideMeta = document.querySelector("[data-side-meta]");
  refs.sideStatus = document.querySelector("[data-side-status]");
  refs.pageTitle = document.querySelector("[data-page-title]");
  refs.pageSubtitle = document.querySelector("[data-page-subtitle]");
  refs.refresh = document.querySelector("[data-refresh]");
  refs.webLink = document.querySelector("[data-web-link]");
  refs.todayList = document.querySelector("[data-today-list]");
  refs.healthList = document.querySelector("[data-health-list]");
  refs.contactTimelineDialog = document.querySelector("[data-contact-timeline-dialog]");
  refs.contactTimelineTitle = document.querySelector("[data-contact-timeline-title]");
  refs.contactTimelineMeta = document.querySelector("[data-contact-timeline-meta]");
  refs.contactTimelineContent = document.querySelector("[data-contact-timeline-content]");
  refs.contactTimelineClose = document.querySelector("[data-contact-timeline-close]");
  refs.contactProposal = document.querySelector("[data-contact-proposal]");
  refs.contactMessage = document.querySelector("[data-contact-message]");

  applyPortalMode();
  bindUi();
  const requestedTab = new URLSearchParams(window.location.search).get("tab") || "";
  const validRequestedTab = Array.from(document.querySelectorAll("[data-tab]"))
    .some((button) => button.dataset.tab === requestedTab);
  setActiveTab(validRequestedTab ? requestedTab : "inbox");
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

  refs.clientLogout?.addEventListener("click", () => {
    window.LocalLiftApi?.clearClientSession?.();
    window.location.href = "../index.html";
  });

  refs.contactTimelineClose?.addEventListener("click", closeContactTimeline);
  refs.contactTimelineDialog?.addEventListener("close", () => {
    state.timelineRequestSequence += 1;
  });
  refs.contactTimelineDialog?.addEventListener("click", (event) => {
    if (event.target === refs.contactTimelineDialog) {
      closeContactTimeline();
    }
  });
  refs.contactProposal?.addEventListener("click", () => {
    const contactId = refs.contactProposal?.dataset.contactId || "";

    if (contactId) {
      startProposalForContact(contactId, { closeDialog: true });
    }
  });
  refs.contactMessage?.addEventListener("click", () => {
    const contactId = refs.contactMessage?.dataset.contactId || "";

    if (contactId) {
      startMessageForContact(contactId, { closeDialog: true });
    }
  });
}

function applyPortalMode() {
  document.body.classList.toggle("is-client-portal", Boolean(state.clientSession));

  if (refs.clientLogout) {
    refs.clientLogout.hidden = !state.clientSession;
  }
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
      resetForecastState({ keepMonth: true });
      resetSlaState({ keepHours: true });
      resetInboxState({ keepStaleDays: true });
      render();
      showNotice("No hay negocios disponibles para esta sesion.", "warn");
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
      state.pipeline = null;
      state.duplicateGroups = [];
      resetProposalState();
      resetMessageState();
      state.nextActions = emptyNextActions();
      state.services = [];
      state.bookings = [];
      state.availability = [];
      state.blocks = [];
      state.reminderQueue = [];
      state.report = null;
      resetForecastState({ keepMonth: true });
      resetSlaState({ keepHours: true });
      resetInboxState({ keepStaleDays: true });
      state.googleStatus = null;
      state.googleDiagnostics = null;
      state.crmError = "";
      state.bookingError = "";
      state.googleError = "";
      renderBusinessSelect();
      render();
      if (state.clientSession && error.status === 401) {
        window.LocalLiftApi?.clearClientSession?.();
      }

      showNotice(error.status === 401
        ? (state.clientSession ? "La sesion de cliente ha caducado. Entra de nuevo desde Start > Cliente." : "La API pide token admin. Pegalo en la barra lateral y guarda.")
        : "No se pudo conectar con la API. Ejecuta npm.cmd start y abre esta pagina desde http://127.0.0.1:5173/pages/business-dashboard.html.", "error");
  } finally {
    setLoading(false);
  }
}

async function loadBusiness(id, options = {}) {
  if (!id) {
    return;
  }

  closeContactTimeline();
  state.proposalDraftContactId = "";
  state.proposalFeedback = { type: "", message: "" };
  resetMessageComposer();
  resetForecastState({ keepMonth: true });
  resetSlaState({ keepHours: true });
  resetCommercialDashboardState();
  resetInboxState({ keepStaleDays: true });
  setLoading(true);

  try {
    const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}`);
    state.business = payload.business || null;
    const businessRef = state.business?.id || id;
    const inboxPromise = loadInbox(businessRef);
    await loadContacts(businessRef);
    await loadProposals(businessRef);
    await loadMessageTemplates(businessRef);
    await loadBookings(businessRef);
    await Promise.all([
      loadReport(businessRef),
      loadForecast(businessRef),
      loadSla(businessRef),
      loadCommercialDashboard(businessRef),
      inboxPromise
    ]);
    if (state.clientSession) {
      state.googleStatus = null;
      state.googleDiagnostics = null;
      state.googleError = "";
    } else {
      await loadGoogle(state.business?.id || id);
    }
    renderBusinessSelect();
    render();

    if (state.crmError || state.proposalError || state.messageError || state.bookingError || state.googleError) {
      showNotice([state.crmError, state.proposalError, state.messageError, state.bookingError, state.googleError].filter(Boolean).join(" "), "warn");
    } else if (!options.silent) {
      showNotice("", "info");
    }
  } catch (error) {
    const fallback = state.businesses.find((business) => business.id === id || business.slug === id);
    state.business = fallback || null;
    state.contacts = [];
    state.pipeline = null;
    state.duplicateGroups = [];
    resetProposalState();
    resetMessageState();
    state.nextActions = emptyNextActions();
    state.services = [];
    state.bookings = [];
    state.availability = [];
    state.blocks = [];
    state.reminderQueue = [];
    state.report = null;
    resetForecastState({ keepMonth: true });
    resetSlaState({ keepHours: true });
    resetCommercialDashboardState();
    resetInboxState({ keepStaleDays: true });
    state.googleStatus = null;
    state.googleDiagnostics = null;
    state.googleError = "";
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
  state.pipeline = null;
  state.duplicateGroups = [];
  state.nextActions = emptyNextActions();
  state.crmError = "";

  if (!id) {
    return;
  }

  try {
    const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}/contacts/pipeline?includeActivities=true`);
    state.pipeline = normalizePipelinePayload(payload);
    state.contacts = flattenPipelineContacts(state.pipeline);
    await loadDuplicateContacts(id);
    await loadNextActions(id);
  } catch (error) {
    state.crmError = "El CRM no respondio. El dashboard seguira con datos del negocio, pero sin contactos reales.";
  }
}

async function loadDuplicateContacts(id) {
  state.duplicateGroups = [];

  if (!id) {
    return;
  }

  const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}/contacts/duplicates`);
  state.duplicateGroups = Array.isArray(payload.groups) ? payload.groups : [];
}

async function loadProposals(id, options = {}) {
  state.proposals = [];
  state.proposalError = "";
  state.proposalLoading = true;

  if (!id) {
    state.proposalLoading = false;
    return;
  }

  renderProposalLoadingState();

  try {
    const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}/proposals`);
    state.proposals = Array.isArray(payload.proposals) ? payload.proposals : [];
  } catch (error) {
    state.proposalError = error.status === 401 || error.status === 403
      ? "No tienes permisos para consultar las propuestas de este negocio."
      : "No se pudieron cargar las propuestas comerciales.";
  } finally {
    state.proposalLoading = false;
  }

  if (options.render && state.business) {
    render();
  }
}

function renderProposalLoadingState() {
  const container = document.querySelector('[data-list="proposals"]');

  if (!container) {
    return;
  }

  container.innerHTML = `
    <section class="proposal-state proposal-loading" role="status">
      <span class="proposal-spinner" aria-hidden="true"></span>
      <div>
        <strong>Cargando propuestas</strong>
        <p>Estamos preparando el historial comercial del negocio.</p>
      </div>
    </section>
  `;
}

function resetProposalState() {
  state.proposals = [];
  state.proposalLoading = false;
  state.proposalError = "";
  state.proposalFeedback = { type: "", message: "" };
  state.proposalDraftContactId = "";
}

async function loadMessageTemplates(id, options = {}) {
  state.messageTemplates = [];
  state.messageTemplateTypes = [];
  state.messagePlaceholders = [];
  state.messageError = "";
  state.messageLoading = true;

  if (!id) {
    state.messageLoading = false;
    return;
  }

  try {
    const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}/message-templates`);
    state.messageTemplates = Array.isArray(payload.templates) ? payload.templates : [];
    state.messageTemplateTypes = Array.isArray(payload.types) ? payload.types : [];
    state.messagePlaceholders = Array.isArray(payload.placeholders) ? payload.placeholders : [];

    const selectedExists = state.messageTemplates.some((template) => template.id === state.messageComposer.templateId);
    if (!selectedExists) {
      state.messageComposer.templateId = state.messageTemplates[0]?.id || "";
    }
  } catch (error) {
    state.messageError = error.status === 401 || error.status === 403
      ? "No tienes permisos para consultar las plantillas de este negocio."
      : "No se pudieron cargar las plantillas de seguimiento.";
  } finally {
    state.messageLoading = false;
  }

  if (options.render && state.business) {
    render();
  }
}

function resetMessageState() {
  state.messageTemplates = [];
  state.messageTemplateTypes = [];
  state.messagePlaceholders = [];
  state.messageLoading = false;
  state.messageError = "";
  resetMessageComposer();
}

function resetMessageComposer() {
  state.messageComposer = {
    contactId: "",
    templateId: "",
    preview: null,
    feedback: ""
  };
}

async function loadNextActions(id) {
  state.nextActions = emptyNextActions();

  if (!id) {
    return;
  }

  const [todayPayload, overduePayload, missingPayload] = await Promise.all([
    getJson(`/api/businesses/${encodeURIComponent(id)}/next-actions?filter=hoy`),
    getJson(`/api/businesses/${encodeURIComponent(id)}/next-actions?filter=vencidas`),
    getJson(`/api/businesses/${encodeURIComponent(id)}/next-actions?filter=sin-accion`)
  ]);

  state.nextActions = {
    today: Array.isArray(todayPayload.actions) ? todayPayload.actions : [],
    overdue: Array.isArray(overduePayload.actions) ? overduePayload.actions : [],
    missing: Array.isArray(missingPayload.actions) ? missingPayload.actions : []
  };
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

async function loadForecast(id, options = {}) {
  const month = normalizeForecastMonth(options.month || state.forecastMonth);
  const requestSequence = ++state.forecastRequestSequence;
  state.forecastMonth = month;
  state.forecast = null;
  state.forecastError = "";
  state.forecastLoading = Boolean(id);

  if (options.render && state.business) {
    render();
  }

  if (!id) {
    state.forecastLoading = false;
    return;
  }

  try {
    const payload = await getJson(
      `/api/businesses/${encodeURIComponent(id)}/reports/forecast?month=${encodeURIComponent(month)}`
    );

    if (requestSequence !== state.forecastRequestSequence) {
      return;
    }

    state.forecast = payload.forecast && typeof payload.forecast === "object"
      ? payload.forecast
      : null;
    state.forecastMonth = normalizeForecastMonth(state.forecast?.month || month);
  } catch (error) {
    if (requestSequence !== state.forecastRequestSequence) {
      return;
    }

    state.forecast = null;
    state.forecastError = error.status === 401 || error.status === 403
      ? "No tienes permisos para consultar el forecast de este negocio."
      : "No se pudo cargar el forecast comercial. Revisa la conexion e intentalo de nuevo.";
  } finally {
    if (requestSequence !== state.forecastRequestSequence) {
      return;
    }

    state.forecastLoading = false;
    if (options.render && state.business) {
      render();
    }
  }
}

function resetForecastState(options = {}) {
  state.forecastRequestSequence += 1;
  state.forecast = null;
  state.forecastLoading = false;
  state.forecastError = "";

  if (!options.keepMonth) {
    state.forecastMonth = currentMonthKey();
  }
}

async function loadSla(id, options = {}) {
  const hours = normalizeSlaHours(options.hours ?? state.slaHours);
  const requestSequence = ++state.slaRequestSequence;
  state.slaHours = hours;
  state.sla = null;
  state.slaError = "";
  state.slaLoading = Boolean(id);

  if (options.render && state.business) {
    render();
  }

  if (!id) {
    state.slaLoading = false;
    return;
  }

  try {
    const payload = await getJson(
      `/api/businesses/${encodeURIComponent(id)}/reports/sla?hours=${encodeURIComponent(String(hours))}`
    );

    if (requestSequence !== state.slaRequestSequence) {
      return;
    }

    state.sla = payload.sla && typeof payload.sla === "object"
      ? payload.sla
      : null;
    state.slaHours = normalizeSlaHours(state.sla?.thresholdHours ?? hours);
  } catch (error) {
    if (requestSequence !== state.slaRequestSequence) {
      return;
    }

    state.sla = null;
    state.slaError = error.status === 401 || error.status === 403
      ? "No tienes permisos para consultar el SLA comercial de este negocio."
      : "No se pudo cargar el SLA comercial. Revisa la conexion e intentalo de nuevo.";
  } finally {
    if (requestSequence !== state.slaRequestSequence) {
      return;
    }

    state.slaLoading = false;
    if (options.render && state.business) {
      render();
    }
  }
}

function resetSlaState(options = {}) {
  state.slaRequestSequence += 1;
  state.sla = null;
  state.slaLoading = false;
  state.slaError = "";

  if (!options.keepHours) {
    state.slaHours = 24;
  }
}

async function loadCommercialDashboard(id, options = {}) {
  const month = normalizeForecastMonth(options.month || state.forecastMonth);
  const hours = normalizeSlaHours(options.hours ?? state.slaHours);
  const requestSequence = ++state.commercialDashboardRequestSequence;
  state.commercialDashboard = null;
  state.commercialDashboardError = "";
  state.commercialDashboardLoading = Boolean(id);

  if (options.render && state.business) {
    render();
  }

  if (!id) {
    state.commercialDashboardLoading = false;
    return;
  }

  try {
    const payload = await getJson(
      `/api/businesses/${encodeURIComponent(id)}/reports/commercial-dashboard?month=${encodeURIComponent(month)}&hours=${encodeURIComponent(String(hours))}`
    );

    if (requestSequence !== state.commercialDashboardRequestSequence) {
      return;
    }

    state.commercialDashboard = payload.commercialDashboard && typeof payload.commercialDashboard === "object"
      ? payload.commercialDashboard
      : null;
  } catch (error) {
    if (requestSequence !== state.commercialDashboardRequestSequence) {
      return;
    }

    state.commercialDashboard = null;
    state.commercialDashboardError = error.status === 401 || error.status === 403
      ? "No tienes permisos para consultar el resumen comercial de este negocio."
      : "No se pudo cargar el resumen comercial. Revisa la conexion e intentalo de nuevo.";
  } finally {
    if (requestSequence !== state.commercialDashboardRequestSequence) {
      return;
    }

    state.commercialDashboardLoading = false;
    if (options.render && state.business) {
      render();
    }
  }
}

function resetCommercialDashboardState() {
  state.commercialDashboardRequestSequence += 1;
  state.commercialDashboard = null;
  state.commercialDashboardLoading = false;
  state.commercialDashboardError = "";
}

async function loadInbox(id, options = {}) {
  const staleDays = normalizeInboxStaleDays(options.staleDays ?? state.inboxStaleDays);
  const requestSequence = ++state.inboxRequestSequence;
  state.inbox = null;
  state.inboxError = "";
  state.inboxLoading = Boolean(id);
  state.inboxStaleDays = staleDays;

  if (options.render && state.business) {
    render();
  } else {
    renderInboxLoadingState();
  }

  if (!id) {
    state.inboxLoading = false;
    return;
  }

  try {
    const payload = await getJson(
      `/api/businesses/${encodeURIComponent(id)}/inbox?staleDays=${encodeURIComponent(staleDays)}`
    );

    if (requestSequence !== state.inboxRequestSequence) {
      return;
    }

    if (!payload.inbox || typeof payload.inbox !== "object") {
      throw new Error("Inbox payload is missing");
    }

    state.inbox = payload.inbox;
    state.inboxStaleDays = normalizeInboxStaleDays(payload.inbox.staleCustomerDays || staleDays);
  } catch (error) {
    if (requestSequence !== state.inboxRequestSequence) {
      return;
    }

    state.inbox = null;
    state.inboxError = error.status === 401 || error.status === 403
      ? "No tienes permisos para consultar la bandeja de este negocio."
      : "No se pudo cargar la bandeja diaria. Revisa la conexion e intentalo de nuevo.";
  } finally {
    if (requestSequence !== state.inboxRequestSequence) {
      return;
    }

    state.inboxLoading = false;
    if (options.render && state.business) {
      render();
    }
  }
}

function renderInboxLoadingState() {
  const container = document.querySelector('[data-list="inbox"]');
  if (!container || !state.inboxLoading) {
    return;
  }

  container.innerHTML = `
    <div class="inbox-state inbox-state-loading" role="status">
      <span class="inbox-spinner" aria-hidden="true"></span>
      <div>
        <strong>Preparando la bandeja</strong>
        <p>Ordenando prioridades, reservas y seguimientos del negocio.</p>
      </div>
    </div>
  `;
}

function resetInboxState(options = {}) {
  state.inboxRequestSequence += 1;
  state.inbox = null;
  state.inboxLoading = false;
  state.inboxError = "";

  if (!options.keepStaleDays) {
    state.inboxStaleDays = 30;
  }
}

async function loadGoogle(id) {
  state.googleStatus = null;
  state.googleDiagnostics = null;
  state.googleError = "";

  if (!id) {
    return;
  }

  try {
    state.googleStatus = await getJson(`/api/businesses/${encodeURIComponent(id)}/google`);
  } catch (error) {
    state.googleError = "La integracion Google no respondio.";
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
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || `Request failed: ${response.status}`);
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

async function deleteJson(url) {
  const response = await fetch(apiUrl(url), {
    method: "DELETE",
    headers: apiHeaders(),
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error || `Request failed: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.status === 204 ? {} : response.json();
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

  if (state.clientSession?.token) {
    headers["X-LocalLift-Client-Token"] = state.clientSession.token;
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

  if (state.clientSession && state.businesses.length) {
    const business = state.businesses[0];
    refs.businessSelect.innerHTML = `<option value="${escapeHtml(business.id)}">${escapeHtml(business.name)}</option>`;
    refs.businessSelect.disabled = true;
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
    pipeline: state.pipeline,
    duplicateGroups: state.duplicateGroups,
    proposals: state.proposals,
    nextActions: state.nextActions,
    services: state.services,
    bookings: state.bookings,
    availability: state.availability,
    blocks: state.blocks,
    reminderQueue: state.reminderQueue,
    report: state.report,
    forecast: state.forecast,
    sla: state.sla,
    commercialDashboard: state.commercialDashboard,
    inbox: state.inbox
  });

  renderHeader(business, model);
  renderMetrics(model);
  renderActionStrip(business, model);
  renderInbox(model);
  renderHome(model);
  renderNextActions(model);
  renderLeads(model);
  renderProposals(model);
  renderMessages(model);
  renderCustomers(model);
  renderBookings(model);
  renderOrders(model);
  renderProducts(model);
  renderGoogle(model);
  renderReports(model);
  renderSettings(model);
  bindExportControls(model);
  bindCrmControls(model);
  bindProposalControls(model);
  bindMessageControls(model);
  bindBookingControls(model);
  bindInboxControls();
  bindReportControls();
  bindGoogleControls();
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

  if (refs.webLink) {
    const businessRef = business.slug || business.id || "";
    const url = `client-site.html?business=${encodeURIComponent(businessRef)}`;
    refs.webLink.textContent = state.clientSession ? "Mi web" : "Editar web";
    refs.webLink.href = state.clientSession ? url : "../index.html";
    refs.webLink.toggleAttribute("aria-disabled", state.clientSession && !businessRef);
  }
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

function renderInbox(model) {
  const container = document.querySelector('[data-list="inbox"]');
  if (!container) {
    return;
  }

  const staleDays = normalizeInboxStaleDays(state.inboxStaleDays);
  const staleOptions = Array.from(new Set([...INBOX_STALE_DAY_OPTIONS, staleDays])).sort((left, right) => left - right);
  const inbox = model.inbox;
  const generatedAt = inbox?.generatedAt
    ? `Actualizada ${formatInboxDateTime(inbox.generatedAt, inbox.timezone)}`
    : "Prioridades consolidadas en una sola vista";

  container.innerHTML = `
    <div class="inbox-toolbar">
      <div>
        <strong>Tu siguiente mejor accion, primero</strong>
        <p>${escapeHtml(generatedAt)}${inbox?.timezone ? ` · ${escapeHtml(inbox.timezone)}` : ""}</p>
      </div>
      <form class="inbox-stale-filter" data-inbox-stale-form>
        <label for="inboxStaleDays">Cliente sin seguimiento</label>
        <div>
          <select id="inboxStaleDays" name="staleDays" data-inbox-stale-days ${state.inboxLoading ? "disabled" : ""}>
            ${staleOptions.map((days) => `<option value="${days}"${days === staleDays ? " selected" : ""}>${days} dias</option>`).join("")}
          </select>
          <button type="submit" ${state.inboxLoading ? "disabled" : ""}>Aplicar</button>
        </div>
      </form>
    </div>
    <div class="inbox-live-region" aria-busy="${state.inboxLoading ? "true" : "false"}">
      ${renderInboxContent(model)}
    </div>
  `;
}

function renderInboxContent(model) {
  if (state.inboxLoading) {
    return `
      <div class="inbox-state inbox-state-loading" role="status">
        <span class="inbox-spinner" aria-hidden="true"></span>
        <div>
          <strong>Preparando la bandeja</strong>
          <p>Ordenando prioridades, reservas y seguimientos del negocio.</p>
        </div>
      </div>
    `;
  }

  if (state.inboxError) {
    return `
      <div class="inbox-state inbox-state-error" role="alert">
        <span class="inbox-state-icon" aria-hidden="true">!</span>
        <div>
          <strong>Bandeja no disponible</strong>
          <p>${escapeHtml(state.inboxError)}</p>
        </div>
        <button type="button" data-inbox-retry>Reintentar</button>
      </div>
    `;
  }

  const inbox = model.inbox;
  if (!inbox || typeof inbox !== "object") {
    return `
      <div class="inbox-state inbox-state-empty">
        <span class="inbox-state-icon" aria-hidden="true">0</span>
        <div>
          <strong>Sin bandeja calculada</strong>
          <p>Actualiza el negocio para reunir las prioridades comerciales de hoy.</p>
        </div>
      </div>
    `;
  }

  const sections = normalizeInboxSections(inbox.sections);
  const total = sections.reduce((sum, section) => sum + section.items.length, 0);

  if (!total) {
    return `
      <div class="inbox-state inbox-state-empty">
        <span class="inbox-state-icon inbox-state-success" aria-hidden="true">OK</span>
        <div>
          <strong>Todo al dia</strong>
          <p>No hay acciones vencidas ni oportunidades pendientes para los criterios actuales.</p>
        </div>
      </div>
    `;
  }

  return `
    ${renderInboxKpis(sections, total)}
    <div class="inbox-section-grid">
      ${sections.map((section) => renderInboxSection(section, model)).join("")}
    </div>
  `;
}

function renderInboxKpis(sections, total) {
  const count = (key) => sections.find((section) => section.key === key)?.items.length || 0;
  const highPriority = sections.reduce(
    (sum, section) => sum + section.items.filter((item) => Number(item?.urgency || 0) >= 500).length,
    0
  );

  return `
    <div class="inbox-kpi-grid" role="group" aria-label="Resumen de prioridades de la bandeja">
      ${renderInboxKpi("Pendientes totales", total, "Trabajo comercial consolidado", "total")}
      ${renderInboxKpi("Prioridad alta", highPriority, "Vencidas y leads sin primer contacto", "urgent")}
      ${renderInboxKpi("Reservas de hoy", count("todayBookings"), "Citas activas en agenda", "booking")}
      ${renderInboxKpi("Seguimientos", count("pendingProposals") + count("staleCustomers"), "Propuestas y clientes a reactivar", "follow-up")}
    </div>
  `;
}

function renderInboxKpi(label, value, note, tone) {
  return `
    <article class="inbox-kpi inbox-kpi-${escapeAttr(tone)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(inboxWholeNumber(value)))}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `;
}

function normalizeInboxSections(value) {
  const source = Array.isArray(value) ? value : [];
  const sections = [];
  const seen = new Set();

  source.forEach((section) => {
    const key = clean(section?.key);
    if (!INBOX_SECTION_CONFIG[key] || seen.has(key)) {
      return;
    }
    seen.add(key);
    sections.push({
      key,
      items: Array.isArray(section?.items) ? section.items : []
    });
  });

  Object.keys(INBOX_SECTION_CONFIG).forEach((key) => {
    if (!seen.has(key)) {
      sections.push({ key, items: [] });
    }
  });
  return sections;
}

function renderInboxSection(section, model) {
  const config = INBOX_SECTION_CONFIG[section.key];
  const headingId = `inboxSection-${section.key}`;

  return `
    <section class="inbox-section" data-inbox-section="${escapeAttr(section.key)}" aria-labelledby="${escapeAttr(headingId)}">
      <header class="inbox-section-header">
        <div>
          <p class="eyebrow">${escapeHtml(config.kicker)}</p>
          <h3 id="${escapeAttr(headingId)}">${escapeHtml(config.label)}</h3>
        </div>
        <span class="inbox-section-count" aria-label="${escapeAttr(`${section.items.length} elementos`)}">${escapeHtml(String(section.items.length))}</span>
      </header>
      <div class="inbox-item-list">
        ${section.items.length
          ? section.items.map((item) => renderInboxItem(item, section.key, model)).join("")
          : `<p class="inbox-section-empty">${escapeHtml(config.empty)}</p>`}
      </div>
    </section>
  `;
}

function renderInboxItem(item, sectionKey, model) {
  const urgency = inboxUrgency(item?.urgency);
  const status = clean(item?.status);
  const meta = inboxItemMeta(item, sectionKey, model.inbox?.timezone, model.currency);

  return `
    <article class="inbox-item inbox-item-${escapeAttr(urgency.tone)}">
      <header class="inbox-item-header">
        <div>
          <strong>${escapeHtml(item?.title || "Pendiente sin titulo")}</strong>
          ${status ? `<span class="inbox-item-status">${escapeHtml(statusLabel(status))}</span>` : ""}
        </div>
        <span class="inbox-urgency inbox-urgency-${escapeAttr(urgency.tone)}">${escapeHtml(urgency.label)}</span>
      </header>
      ${item?.summary ? `<p class="inbox-item-summary">${escapeHtml(item.summary)}</p>` : ""}
      ${meta.length ? `<ul class="inbox-item-meta">${meta.map((entry) => `<li>${escapeHtml(entry)}</li>`).join("")}</ul>` : ""}
      ${renderInboxItemActions(item, sectionKey)}
    </article>
  `;
}

function inboxUrgency(value) {
  const urgency = Number(value || 0);
  if (urgency >= 600) return { tone: "critical", label: "Critica" };
  if (urgency >= 500) return { tone: "high", label: "Alta" };
  if (urgency >= 400) return { tone: "medium", label: "Media" };
  return { tone: "planned", label: "Planificada" };
}

function inboxItemMeta(item, sectionKey, timezone, currency) {
  const details = item?.details && typeof item.details === "object" ? item.details : {};
  const entries = [];

  if (sectionKey === "overdueActions") {
    const days = inboxWholeNumber(details.overdueDays);
    if (days) entries.push(`${days} dia${days === 1 ? "" : "s"} de retraso`);
    if (details.dueDate || item?.date) entries.push(`Vencio ${formatInboxDate(details.dueDate || item.date, timezone)}`);
  } else if (sectionKey === "newLeads") {
    if (item?.date) entries.push(`Alta ${formatInboxDateTime(item.date, timezone)}`);
  } else if (sectionKey === "todayBookings") {
    if (details.startsAt || item?.date) entries.push(`Hora ${formatInboxTime(details.startsAt || item.date, timezone)}`);
    if (details.serviceName) entries.push(clean(details.serviceName));
  } else if (sectionKey === "pendingProposals") {
    if (details.expiresAt) entries.push(`Caduca ${formatInboxDate(details.expiresAt, timezone)}`);
    const days = inboxWholeNumber(details.daysUntilExpiry);
    entries.push(days === 0 ? "Caduca hoy" : `${days} dia${days === 1 ? "" : "s"} restantes`);
    const hasSetupPrice = details.setupPrice !== null && details.setupPrice !== undefined && details.setupPrice !== "";
    const hasMonthlyPrice = details.monthlyPrice !== null && details.monthlyPrice !== undefined && details.monthlyPrice !== "";
    if ((hasSetupPrice && Number.isFinite(Number(details.setupPrice))) || (hasMonthlyPrice && Number.isFinite(Number(details.monthlyPrice)))) {
      const setup = formatForecastMoney(details.setupPrice, currency);
      const monthly = formatForecastMoney(details.monthlyPrice, currency);
      entries.push(`${setup} alta · ${monthly}/mes`);
    }
  } else if (sectionKey === "staleCustomers") {
    const days = details.daysWithoutFollowUp;
    if (days !== null && days !== undefined && days !== "" && Number.isFinite(Number(days))) {
      entries.push(`${inboxWholeNumber(days)} dias sin seguimiento`);
    } else {
      entries.push("Sin historial de seguimiento");
    }
    if (details.lastInteractionAt) entries.push(`Ultimo contacto ${formatInboxDate(details.lastInteractionAt, timezone)}`);
  } else if (sectionKey === "reviewSuggestions") {
    if (details.serviceName) entries.push(clean(details.serviceName));
    if (details.completedAt || item?.date) entries.push(`Completada ${formatInboxDate(details.completedAt || item.date, timezone)}`);
  }

  return entries.filter(Boolean).slice(0, 3);
}

function renderInboxItemActions(item, sectionKey) {
  const contactId = clean(item?.contactId);
  const contactAvailable = Boolean(contactId && state.contacts.some((contact) => contact.id === contactId));
  const actions = [];
  const addButton = (label, attribute, value, primary = false) => {
    actions.push(`<button class="${primary ? "is-primary" : ""}" type="button" ${attribute}="${escapeAttr(value)}">${escapeHtml(label)}</button>`);
  };

  if (sectionKey === "pendingProposals" && item?.refId) {
    addButton("Ver propuesta", "data-inbox-open-proposal", clean(item.refId), true);
  } else if (sectionKey === "todayBookings") {
    addButton("Ver agenda", "data-inbox-open-tab", "bookings", true);
  } else if (sectionKey === "reviewSuggestions") {
    const reviewUrl = safeHttpUrl(item?.details?.reviewUrl);
    if (reviewUrl) {
      actions.push(`<a class="is-primary" href="${escapeAttr(reviewUrl)}" target="_blank" rel="noopener noreferrer">Abrir resenas</a>`);
    }
  }

  if (contactAvailable) {
    addButton("Abrir ficha", "data-inbox-open-contact", contactId, !actions.length);
    addButton("Preparar mensaje", "data-inbox-message-contact", contactId);
  }

  if (sectionKey === "newLeads" && contactAvailable) {
    addButton("Crear propuesta", "data-inbox-proposal-contact", contactId);
  }

  if (!actions.length && (sectionKey === "newLeads" || sectionKey === "overdueActions" || sectionKey === "staleCustomers")) {
    addButton("Ver CRM", "data-inbox-open-tab", "leads", true);
  }

  return actions.length ? `<div class="inbox-item-actions">${actions.join("")}</div>` : "";
}

function bindInboxControls() {
  const staleForm = document.querySelector("[data-inbox-stale-form]");
  const staleSelect = staleForm?.querySelector("[data-inbox-stale-days]");

  staleForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const businessRef = state.business?.id || state.business?.slug || "";
    if (businessRef) {
      await loadInbox(businessRef, {
        staleDays: normalizeInboxStaleDays(staleSelect?.value),
        render: true
      });
    }
  });

  staleSelect?.addEventListener("change", () => staleForm?.requestSubmit());

  document.querySelector("[data-inbox-retry]")?.addEventListener("click", async () => {
    const businessRef = state.business?.id || state.business?.slug || "";
    if (businessRef) {
      await loadInbox(businessRef, { staleDays: state.inboxStaleDays, render: true });
    }
  });

  document.querySelectorAll("[data-inbox-open-contact]").forEach((button) => {
    button.addEventListener("click", () => openContactTimeline(button.dataset.inboxOpenContact || ""));
  });

  document.querySelectorAll("[data-inbox-message-contact]").forEach((button) => {
    button.addEventListener("click", () => startMessageForContact(button.dataset.inboxMessageContact || ""));
  });

  document.querySelectorAll("[data-inbox-proposal-contact]").forEach((button) => {
    button.addEventListener("click", () => startProposalForContact(button.dataset.inboxProposalContact || ""));
  });

  document.querySelectorAll("[data-inbox-open-proposal]").forEach((button) => {
    button.addEventListener("click", () => {
      setActiveTab("proposals");
      focusProposalCard(button.dataset.inboxOpenProposal || "");
    });
  });

  document.querySelectorAll("[data-inbox-open-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = clean(button.dataset.inboxOpenTab);
      if (!["leads", "bookings"].includes(tab)) {
        return;
      }
      setActiveTab(tab);
      document.querySelector(`[data-tab="${tab}"]`)?.focus();
    });
  });
}

function renderHome(model) {
  const tasks = [];

  if (model.nextActions.overdue.length) {
    tasks.push(taskItem("Resolver acciones vencidas", `${model.nextActions.overdue.length} seguimiento(s) fuera de fecha.`, "warn"));
  }

  if (model.nextActions.today.length) {
    tasks.push(taskItem("Completar seguimientos de hoy", `${model.nextActions.today.length} accion(es) programadas.`, "leads"));
  }

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

function renderNextActions(model) {
  const container = document.querySelector('[data-list="next-actions"]');

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="next-actions-grid">
      ${renderNextActionList("Hoy", "Acciones con fecha de hoy.", model.nextActions.today, "today")}
      ${renderNextActionList("Vencidas", "Seguimientos pendientes con fecha pasada.", model.nextActions.overdue, "overdue")}
      ${renderNextActionList("Sin proxima accion", "Leads abiertos que necesitan siguiente paso.", model.nextActions.missing, "missing")}
    </div>
  `;
}

function renderNextActionList(title, subtitle, items, type) {
  return `
    <section class="next-action-panel ${escapeAttr(type)}">
      <header>
        <span>
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(subtitle)}</small>
        </span>
        <span>${escapeHtml(String(items.length))}</span>
      </header>
      <div class="next-action-list">
        ${items.length
          ? items.map((item) => renderNextActionItem(item, type)).join("")
          : `<p class="pipeline-empty">${escapeHtml(type === "missing" ? "Todos los leads abiertos tienen seguimiento." : "Sin acciones en esta lista.")}</p>`}
      </div>
    </section>
  `;
}

function renderNextActionItem(item, type) {
  const contact = item.contact || {};
  const nextAction = item.nextAction || null;
  const contactDetail = [contact.phone, contact.email].filter(Boolean).join(" / ") || "Sin contacto";

  return `
    <article class="next-action-item">
      <header>
        <strong>${escapeHtml(contactName(contact))}</strong>
        <div class="lead-card-badges">
          ${scorePill(contact)}
          ${priorityPill(contact.priority)}
        </div>
      </header>
      <p>${escapeHtml(contactDetail)}</p>
      ${nextAction ? `<p>${escapeHtml(`${nextActionTypeLabel(nextAction.type)} - ${formatDate(nextAction.dueDate)}`)}</p>` : '<p>Crear seguimiento desde la tarjeta del lead.</p>'}
      <div class="next-action-item-footer">
        <span class="pill ${escapeAttr(contact.status || "new")}">${escapeHtml(statusLabel(contact.status || "new"))}</span>
        ${type !== "missing" ? `<button type="button" data-next-action-done data-contact-id="${escapeAttr(contact.id)}">Hecha</button>` : ""}
      </div>
    </article>
  `;
}

function renderLeads(model) {
  const container = document.querySelector('[data-list="leads"]');

  if (!model.leads.length) {
    container.innerHTML = emptyState("Sin leads reales", "El formulario web y el chatbot ya pueden guardar aqui los nuevos contactos.");
    return;
  }

  const filteredLeads = filterLeadsByScore(model.leads);
  const pipeline = state.scoreLabelFilter === "all"
    ? (model.pipeline || buildPipelineModel(model.leads))
    : buildPipelineModel(filteredLeads);

  container.innerHTML = `
    ${renderExportToolbar("leads", model.leads.length, "Exportar leads")}
    ${renderDuplicateGroups(model.duplicateGroups)}
    ${renderLeadScoreFilter(model.leads.length, pipeline.total)}
    ${pipeline.total ? `
    <div class="pipeline-grid">
      ${pipeline.columns.map((column) => {
        const leads = Array.isArray(column.contacts) ? column.contacts : [];
        return `
          <section class="pipeline-column" data-pipeline-column="${escapeAttr(column.status)}">
            <header>
              <span>
                <strong>${escapeHtml(statusLabel(column.status))}</strong>
                <small>${escapeHtml(formatMoney(column.totalValueEstimate || 0, model.currency))}</small>
              </span>
              <span>${escapeHtml(String(column.count || leads.length))}</span>
            </header>
            <div class="pipeline-stack" data-pipeline-dropzone data-status="${escapeAttr(column.status)}">
              ${leads.length ? leads.map((lead) => renderLeadCard(lead)).join("") : '<p class="pipeline-empty">Sin contactos</p>'}
            </div>
          </section>
        `;
      }).join("")}
    </div>
    ` : emptyState("Sin leads en este filtro", "Cambia la temperatura para volver a ver el pipeline completo.")}
  `;
}

function renderProposals(model) {
  const container = document.querySelector('[data-list="proposals"]');

  if (!container) {
    return;
  }

  if (state.proposalLoading) {
    renderProposalLoadingState();
    return;
  }

  const contacts = proposalContactOptions(model);
  const selectedContactId = contacts.some((contact) => contact.id === state.proposalDraftContactId)
    ? state.proposalDraftContactId
    : (contacts[0]?.id || "");

  container.innerHTML = `
    ${state.proposalError ? renderProposalError(state.proposalError) : ""}
    ${contacts.length
      ? renderProposalForm(contacts, selectedContactId, model.currency)
      : renderProposalContactEmpty()}
    ${renderProposalList(model.proposals, contacts, model.currency)}
  `;
}

function renderProposalError(message) {
  return `
    <section class="proposal-state proposal-error" role="alert">
      <span class="proposal-state-icon" aria-hidden="true">!</span>
      <div>
        <strong>No pudimos consultar las propuestas</strong>
        <p>${escapeHtml(message)}</p>
      </div>
      <button type="button" data-proposals-retry>Reintentar</button>
    </section>
  `;
}

function renderProposalContactEmpty() {
  return `
    <section class="proposal-state proposal-contact-empty">
      <span class="proposal-state-icon" aria-hidden="true">+</span>
      <div>
        <strong>Primero necesitas un contacto</strong>
        <p>Crea o recupera un lead del CRM para poder vincularle una propuesta comercial.</p>
      </div>
      <button type="button" data-proposals-go-leads>Ir a Leads</button>
    </section>
  `;
}

function renderProposalForm(contacts, selectedContactId, currency) {
  const feedback = state.proposalFeedback || {};
  const minimumExpiry = dateInputValue(new Date());
  const defaultExpiry = dateInputValue(addDays(new Date(), 14));

  return `
    <section class="proposal-compose" aria-labelledby="proposalFormTitle">
      <header>
        <div>
          <p class="eyebrow">Nueva oportunidad</p>
          <h3 id="proposalFormTitle">Crear propuesta</h3>
          <p>Prepara precios, condiciones y vigencia sin salir de la ficha comercial.</p>
        </div>
        <span class="proposal-compose-currency">${escapeHtml(currency || "EUR")}</span>
      </header>
      <form class="proposal-form" data-proposal-form>
        <label class="proposal-field proposal-field-contact" for="proposalContactId">
          Contacto
          <select id="proposalContactId" name="contactId" required>
            ${contacts.map((contact) => `
              <option value="${escapeAttr(contact.id)}"${contact.id === selectedContactId ? " selected" : ""}>
                ${escapeHtml(contactName(contact))}${contact.email ? ` - ${escapeHtml(contact.email)}` : ""}
              </option>
            `).join("")}
          </select>
        </label>
        <label class="proposal-field" for="proposalPackage">
          Paquete
          <select id="proposalPackage" name="package" required>
            ${PROPOSAL_PACKAGES.map((item) => `<option value="${escapeAttr(item)}">${escapeHtml(proposalPackageLabel(item))}</option>`).join("")}
          </select>
        </label>
        <label class="proposal-field" for="proposalSetupPrice">
          Puesta en marcha
          <span class="proposal-money-input">
            <input id="proposalSetupPrice" name="setupPrice" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00" required>
            <span aria-hidden="true">${escapeHtml(currency || "EUR")}</span>
          </span>
        </label>
        <label class="proposal-field" for="proposalMonthlyPrice">
          Cuota mensual
          <span class="proposal-money-input">
            <input id="proposalMonthlyPrice" name="monthlyPrice" type="number" min="0" step="0.01" inputmode="decimal" placeholder="0,00" required>
            <span aria-hidden="true">${escapeHtml(currency || "EUR")}</span>
          </span>
        </label>
        <label class="proposal-field" for="proposalExpiresAt">
          Valida hasta
          <input id="proposalExpiresAt" name="expiresAt" type="date" min="${escapeAttr(minimumExpiry)}" value="${escapeAttr(defaultExpiry)}" required>
        </label>
        <label class="proposal-field" for="proposalStatus">
          Estado inicial
          <select id="proposalStatus" name="status" required>
            ${PROPOSAL_STATUSES.map((status) => `<option value="${escapeAttr(status)}"${status === "borrador" ? " selected" : ""}>${escapeHtml(statusLabel(status))}</option>`).join("")}
          </select>
        </label>
        <label class="proposal-field proposal-field-conditions" for="proposalConditions">
          Condiciones
          <textarea id="proposalConditions" name="conditions" rows="4" maxlength="20000" placeholder="Alcance, forma de pago, entregables y condiciones de servicio" required></textarea>
        </label>
        <footer class="proposal-form-footer">
          <p class="proposal-feedback${feedback.type ? ` is-${escapeAttr(feedback.type)}` : ""}" data-proposal-feedback role="status" aria-live="polite">
            ${feedback.message ? escapeHtml(feedback.message) : "La propuesta quedara vinculada al contacto seleccionado."}
          </p>
          <button type="submit">Crear propuesta</button>
        </footer>
      </form>
    </section>
  `;
}

function renderProposalList(proposals, contacts, currency) {
  const items = Array.isArray(proposals)
    ? [...proposals].sort(compareProposals)
    : [];

  return `
    <section class="proposal-list" aria-labelledby="proposalListTitle">
      <header class="proposal-list-heading">
        <div>
          <p class="eyebrow">Seguimiento</p>
          <h3 id="proposalListTitle">Propuestas del negocio</h3>
        </div>
        <span>${escapeHtml(String(items.length))} ${items.length === 1 ? "propuesta" : "propuestas"}</span>
      </header>
      ${items.length
        ? `<div class="proposal-grid">${items.map((proposal) => renderProposalCard(proposal, contacts, currency)).join("")}</div>`
        : `
          <section class="proposal-empty">
            <span aria-hidden="true">01</span>
            <div>
              <strong>Aun no hay propuestas</strong>
              <p>Selecciona un contacto, define la oferta y crea la primera propuesta comercial.</p>
            </div>
          </section>
        `}
    </section>
  `;
}

function renderProposalCard(proposal, contacts, currency) {
  const proposalId = clean(proposal?.id || "");
  const status = normalizeProposalStatus(proposal?.status);
  const contact = contacts.find((item) => item.id === proposal?.contactId) || proposal?.contact || null;
  const contactLabel = contact ? contactName(contact) : clean(proposal?.contactName || proposal?.contactId || "Contacto no disponible");
  const conditions = String(proposal?.conditions || "Sin condiciones adicionales.").trim();
  const createdAt = proposal?.createdAt || proposal?.updatedAt || "";

  return `
    <article class="proposal-card" data-proposal-card="${escapeAttr(proposalId)}" tabindex="-1">
      <header>
        <div>
          <span>${escapeHtml(proposalPackageLabel(proposal?.package))}</span>
          <h4>${escapeHtml(contactLabel)}</h4>
          <small>${createdAt ? `Creada ${escapeHtml(formatDate(createdAt))}` : "Propuesta comercial"}</small>
        </div>
        <span class="pill proposal-status ${escapeAttr(status)}">${escapeHtml(statusLabel(status))}</span>
      </header>
      <div class="proposal-value-grid">
        <span>
          <small>Puesta en marcha</small>
          <strong>${escapeHtml(formatMoney(Number(proposal?.setupPrice || 0), currency))}</strong>
        </span>
        <span>
          <small>Mensual</small>
          <strong>${escapeHtml(formatMoney(Number(proposal?.monthlyPrice || 0), currency))}</strong>
        </span>
      </div>
      <div class="proposal-expiry">
        <span>Vigencia</span>
        <strong>${escapeHtml(proposal?.expiresAt ? formatDate(proposal.expiresAt) : "Sin fecha")}</strong>
      </div>
      <p class="proposal-conditions">${escapeHtml(conditions)}</p>
      <footer>
        <label class="proposal-status-field">
          Actualizar estado
          <select data-proposal-status data-proposal-id="${escapeAttr(proposalId)}" data-current-status="${escapeAttr(status)}" aria-label="Estado de la propuesta para ${escapeAttr(contactLabel)}">
            ${PROPOSAL_STATUSES.map((item) => `<option value="${escapeAttr(item)}"${item === status ? " selected" : ""}>${escapeHtml(statusLabel(item))}</option>`).join("")}
          </select>
        </label>
        <div class="proposal-export-actions" role="group" aria-label="Exportar propuesta para ${escapeAttr(contactLabel)}">
          <button type="button" data-proposal-export="html" data-proposal-id="${escapeAttr(proposalId)}">HTML</button>
          <button type="button" data-proposal-export="pdf" data-proposal-id="${escapeAttr(proposalId)}">PDF</button>
        </div>
      </footer>
    </article>
  `;
}

function proposalContactOptions(model) {
  const byId = new Map();

  [model?.contacts, model?.leads, model?.customers]
    .filter(Array.isArray)
    .flat()
    .forEach((contact) => {
      const id = clean(contact?.id || "");
      if (id && !contact?.merged && !byId.has(id)) {
        byId.set(id, contact);
      }
    });

  return Array.from(byId.values())
    .sort((left, right) => contactName(left).localeCompare(contactName(right), "es", { sensitivity: "base" }));
}

function compareProposals(left, right) {
  const leftTime = Date.parse(left?.updatedAt || left?.createdAt || left?.expiresAt || "");
  const rightTime = Date.parse(right?.updatedAt || right?.createdAt || right?.expiresAt || "");
  const timeDifference = (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);

  return timeDifference || String(right?.id || "").localeCompare(String(left?.id || ""));
}

function normalizeProposalStatus(value) {
  const status = clean(value).toLowerCase();
  return PROPOSAL_STATUSES.includes(status) ? status : "borrador";
}

function proposalPackageLabel(value) {
  const labels = {
    presencia_local: "Presencia Local",
    conversion_pro: "Conversion Pro",
    growth_local: "Growth Local",
    custom: "A medida"
  };

  return labels[clean(value)] || clean(value || "Propuesta a medida");
}

function renderMessages(model) {
  const container = document.querySelector('[data-list="messages"]');

  if (!container) {
    return;
  }

  if (state.messageLoading) {
    container.innerHTML = `
      <section class="message-state" role="status">
        <span class="message-spinner" aria-hidden="true"></span>
        <div><strong>Cargando plantillas</strong><p>Preparando los mensajes comerciales del negocio.</p></div>
      </section>
    `;
    return;
  }

  const contacts = proposalContactOptions(model);
  const templates = Array.isArray(state.messageTemplates) ? state.messageTemplates : [];
  const selectedContactId = contacts.some((contact) => contact.id === state.messageComposer.contactId)
    ? state.messageComposer.contactId
    : (contacts[0]?.id || "");
  const selectedTemplate = templates.find((template) => template.id === state.messageComposer.templateId)
    || templates[0]
    || null;

  container.innerHTML = `
    ${state.messageError ? renderMessageError(state.messageError) : ""}
    ${contacts.length && selectedTemplate
      ? renderMessageComposer(contacts, selectedContactId, templates, selectedTemplate)
      : renderMessageEmpty(contacts.length, templates.length)}
  `;
}

function renderMessageError(message) {
  return `
    <section class="message-state message-state-error" role="alert">
      <span class="message-state-icon" aria-hidden="true">!</span>
      <div><strong>No pudimos cargar las plantillas</strong><p>${escapeHtml(message)}</p></div>
      <button type="button" data-message-retry>Reintentar</button>
    </section>
  `;
}

function renderMessageEmpty(contactCount, templateCount) {
  const missingContacts = contactCount === 0;
  return `
    <section class="message-state message-state-empty">
      <span class="message-state-icon" aria-hidden="true">${missingContacts ? "+" : "01"}</span>
      <div>
        <strong>${escapeHtml(missingContacts ? "Primero necesitas un contacto" : "No hay plantillas disponibles")}</strong>
        <p>${escapeHtml(missingContacts
          ? "Crea un lead para preparar mensajes personalizados y seguros."
          : `Se esperaban ${MESSAGE_TEMPLATE_TYPES.length} plantillas comerciales. Reintenta la carga.`)}</p>
      </div>
      <button type="button" ${missingContacts ? "data-message-go-leads" : "data-message-retry"}>${missingContacts ? "Ir a Leads" : "Reintentar"}</button>
    </section>
  `;
}

function renderMessageComposer(contacts, selectedContactId, templates, selectedTemplate) {
  const preview = state.messageComposer.preview;
  const templateKind = selectedTemplate.virtual ? "Plantilla base" : "Personalizada";
  const placeholders = state.messagePlaceholders.length ? state.messagePlaceholders : ["nombre"];

  return `
    <div class="message-workspace">
      <section class="message-compose" aria-labelledby="messageComposeTitle">
        <header>
          <div>
            <p class="eyebrow">Contacto y contexto</p>
            <h3 id="messageComposeTitle">Preparar seguimiento</h3>
            <p>Genera la vista previa antes de copiar o abrir el canal de envio.</p>
          </div>
          <span>${escapeHtml(templateKind)}</span>
        </header>
        <form class="message-render-form" data-message-render-form>
          <label class="message-field">
            Contacto
            <select name="contactId" required>
              ${contacts.map((contact) => `<option value="${escapeAttr(contact.id)}"${contact.id === selectedContactId ? " selected" : ""}>${escapeHtml(contactName(contact))}${contact.email ? ` - ${escapeHtml(contact.email)}` : ""}</option>`).join("")}
            </select>
          </label>
          <label class="message-field">
            Plantilla
            <select name="templateId" required>
              ${templates.map((template) => `<option value="${escapeAttr(template.id)}"${template.id === selectedTemplate.id ? " selected" : ""}>${escapeHtml(template.label || messageTemplateTypeLabel(template.type))}${template.virtual ? " - base" : " - personalizada"}</option>`).join("")}
            </select>
          </label>
          <label class="message-field">
            URL de demo <span>(opcional)</span>
            <input name="demoUrl" type="url" inputmode="url" placeholder="https://...">
          </label>
          <label class="message-field">
            URL de propuesta <span>(opcional)</span>
            <input name="proposalUrl" type="url" inputmode="url" placeholder="https://...">
          </label>
          <label class="message-field">
            URL de resena <span>(opcional)</span>
            <input name="reviewUrl" type="url" inputmode="url" placeholder="https://...">
          </label>
          <div class="message-render-submit">
            <small>Variables admitidas: ${placeholders.map((item) => `<code>{{${escapeHtml(item)}}}</code>`).join(" ")}</small>
            <button type="submit">Generar vista previa</button>
          </div>
        </form>
        ${state.messageComposer.feedback ? `<p class="message-feedback" role="status">${escapeHtml(state.messageComposer.feedback)}</p>` : ""}
      </section>

      ${renderMessagePreview(preview)}
    </div>
    ${renderMessageTemplateEditor(selectedTemplate)}
  `;
}

function renderMessagePreview(preview) {
  if (!preview) {
    return `
      <section class="message-preview message-preview-empty">
        <span aria-hidden="true">Aa</span>
        <div>
          <strong>Vista previa pendiente</strong>
          <p>Selecciona contacto y plantilla. Nada se enviara sin tu confirmacion.</p>
        </div>
      </section>
    `;
  }

  const links = preview.links && typeof preview.links === "object" ? preview.links : {};
  const whatsappUrl = safeMessageActionUrl(links.whatsappUrl, ["https:"]);
  const mailtoUrl = safeMessageActionUrl(links.mailtoUrl, ["mailto:"]);
  const missing = Array.isArray(preview.missingPlaceholders) ? preview.missingPlaceholders : [];
  const unknown = Array.isArray(preview.unknownPlaceholders) ? preview.unknownPlaceholders : [];
  const warnings = [
    missing.length ? `Faltan datos para: ${missing.map((item) => `{{${item}}}`).join(", ")}.` : "",
    unknown.length ? `Variables no reconocidas: ${unknown.map((item) => `{{${item}}}`).join(", ")}.` : ""
  ].filter(Boolean);

  return `
    <section class="message-preview" aria-labelledby="messagePreviewTitle" tabindex="-1">
      <header>
        <div><p class="eyebrow">Revision final</p><h3 id="messagePreviewTitle">Vista previa</h3></div>
        <span>${escapeHtml(preview.template?.label || "Mensaje personalizado")}</span>
      </header>
      <div class="message-preview-subject"><small>Asunto</small><strong>${escapeHtml(preview.subject || "Sin asunto")}</strong></div>
      <div class="message-preview-body">${escapeHtml(preview.message || "").replace(/\n/g, "<br>")}</div>
      ${warnings.length ? `<div class="message-preview-warning" role="alert">${warnings.map((warning) => `<p>${escapeHtml(warning)}</p>`).join("")}</div>` : ""}
      <footer>
        <button type="button" data-message-copy>Copiar mensaje</button>
        ${whatsappUrl ? `<a href="${escapeAttr(whatsappUrl)}" target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>` : '<span class="message-action-disabled">Sin telefono</span>'}
        ${mailtoUrl ? `<a href="${escapeAttr(mailtoUrl)}">Abrir email</a>` : '<span class="message-action-disabled">Sin email</span>'}
      </footer>
    </section>
  `;
}

function renderMessageTemplateEditor(template) {
  const isOverride = Boolean(template && !template.virtual);

  return `
    <details class="message-template-editor">
      <summary>Personalizar plantilla: ${escapeHtml(template.label || messageTemplateTypeLabel(template.type))}</summary>
      <form data-message-template-form data-template-id="${escapeAttr(template.id)}" data-template-type="${escapeAttr(template.type)}" data-template-override="${isOverride ? "true" : "false"}">
        <label>Nombre<input name="label" type="text" maxlength="160" value="${escapeAttr(template.label || "")}" required></label>
        <label>Asunto<input name="subject" type="text" maxlength="500" value="${escapeAttr(template.subject || "")}"></label>
        <label class="message-template-body">Mensaje<textarea name="body" rows="6" maxlength="12000" required>${escapeHtml(template.body || "")}</textarea></label>
        <div>
          <p>${isOverride ? "Esta version sustituye la plantilla base para este negocio." : "Al guardar se creara una version propia sin alterar la plantilla global."}</p>
          ${isOverride ? '<button class="message-template-reset" type="button" data-message-template-reset>Restaurar base</button>' : ""}
          <button type="submit">${isOverride ? "Guardar cambios" : "Personalizar"}</button>
        </div>
      </form>
    </details>
  `;
}

function messageTemplateTypeLabel(value) {
  const labels = {
    primer_contacto: "Primer contacto",
    envio_demo: "Envio de demo",
    seguimiento_48h: "Seguimiento 48 h",
    envio_propuesta: "Envio de propuesta",
    reactivacion_lead_frio: "Reactivacion de lead frio",
    solicitud_resena: "Solicitud de resena"
  };
  return labels[clean(value)] || clean(value || "Mensaje");
}

function safeMessageActionUrl(value, protocols) {
  const url = clean(value);

  if (!url) {
    return "";
  }

  try {
    const parsed = new URL(url);
    return protocols.includes(parsed.protocol) ? url : "";
  } catch {
    return "";
  }
}

function renderDuplicateGroups(groups = []) {
  if (!groups.length) {
    return "";
  }

  return `
    <section class="duplicate-panel">
      <header>
        <span>
          <strong>Posibles duplicados</strong>
          <small>${escapeHtml(String(groups.length))} grupo(s)</small>
        </span>
      </header>
      <div class="duplicate-list">
        ${groups.map((group) => renderDuplicateGroup(group)).join("")}
      </div>
    </section>
  `;
}

function renderDuplicateGroup(group) {
  const contacts = Array.isArray(group.contacts) ? group.contacts : [];

  if (contacts.length < 2) {
    return "";
  }

  return `
    <article class="duplicate-card" data-duplicate-group="${escapeAttr(group.id)}">
      <div class="duplicate-contacts">
        ${contacts.map((contact) => `
          <span>
            <strong>${escapeHtml(contactName(contact))}</strong>
            <small>${escapeHtml([contact.phone, contact.email].filter(Boolean).join(" / ") || "Sin contacto")}</small>
          </span>
        `).join("")}
      </div>
      <div class="duplicate-actions">
        <label>
          Mantener
          <select data-merge-survivor data-group-id="${escapeAttr(group.id)}">
            ${contacts.map((contact) => `<option value="${escapeAttr(contact.id)}">${escapeHtml(contactName(contact))}</option>`).join("")}
          </select>
        </label>
        <button type="button" data-merge-duplicates data-group-id="${escapeAttr(group.id)}">Fusionar</button>
      </div>
    </article>
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
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Telefono</th>
            <th>Email</th>
            <th>Ultima actividad</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${model.customers.map((customer) => `
            <tr>
              <td>${escapeHtml(contactName(customer))}</td>
              <td>${escapeHtml(clean(customer.phone || "-"))}</td>
              <td>${escapeHtml(clean(customer.email || "-"))}</td>
              <td>${escapeHtml(formatDate(customer.lastInteractionAt || customer.createdAt))}</td>
              <td>
                ${customer.id && state.contacts.some((contact) => contact.id === customer.id) ? `
                  <div class="contact-row-actions">
                    <button class="message-contact-button compact" type="button" data-prepare-message-for-contact data-contact-id="${escapeAttr(customer.id)}">
                      Preparar mensaje
                    </button>
                    <button class="proposal-contact-button compact" type="button" data-create-proposal-for-contact data-contact-id="${escapeAttr(customer.id)}">
                      Crear propuesta
                    </button>
                    <button class="timeline-open-button compact" type="button" data-contact-timeline data-contact-id="${escapeAttr(customer.id)}" aria-haspopup="dialog">
                      Ver historial
                    </button>
                  </div>
                ` : '<span class="timeline-unavailable">No disponible</span>'}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderBookings(model) {
  const container = document.querySelector('[data-list="bookings"]');
  const form = renderBookingForm(model);
  const agendaTools = renderAgendaTools(model);
  const calendar = renderBookingCalendar(model);

  if (!model.bookings.length) {
    container.innerHTML = `${form}${agendaTools}${calendar}${emptyState("Sin reservas", "Crea una cita manual o usa el endpoint publico para recibir reservas.")}`;
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
    ${renderCommercialDashboardPanel(model)}
    ${renderForecastPanel(model)}
    ${renderSlaPanel(model)}
    <div class="recommendation-list">
      ${reportRecommendations.map((item) => `<article><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></article>`).join("")}
    </div>
  `;
}

function renderCommercialDashboardPanel(model) {
  const loading = state.commercialDashboardLoading;

  return `
    <section class="commercial-dashboard forecast-panel" aria-labelledby="commercialDashboardTitle" aria-busy="${loading ? "true" : "false"}">
      <header class="commercial-dashboard-header forecast-panel-header">
        <div class="forecast-panel-copy">
          <p class="eyebrow">Vision ejecutiva</p>
          <h3 id="commercialDashboardTitle">Resumen comercial</h3>
          <p>Una lectura unificada de captacion, avance del pipeline y resultados del periodo.</p>
        </div>
        <div class="commercial-dashboard-period" aria-label="Filtros aplicados">
          <span>${escapeHtml(formatForecastMonth(state.forecastMonth))}</span>
          <span>SLA ${escapeHtml(formatSlaThreshold(state.slaHours))}</span>
        </div>
      </header>
      <div aria-live="polite" aria-atomic="false">
        ${renderCommercialDashboardContent(model)}
      </div>
    </section>
  `;
}

function renderCommercialDashboardContent(model) {
  if (state.commercialDashboardLoading) {
    return `
      <div class="forecast-state forecast-state-loading" role="status">
        <span class="forecast-spinner" aria-hidden="true"></span>
        <div><strong>Preparando el resumen comercial</strong><p>Estamos consolidando captacion, actividad y conversion.</p></div>
      </div>
    `;
  }

  if (state.commercialDashboardError) {
    return `
      <div class="forecast-state forecast-state-error" role="alert">
        <span class="forecast-state-icon" aria-hidden="true">!</span>
        <div><strong>Resumen no disponible</strong><p>${escapeHtml(state.commercialDashboardError)}</p></div>
        <button type="button" data-commercial-dashboard-retry>Reintentar</button>
      </div>
    `;
  }

  const dashboard = model.commercialDashboard;
  if (!dashboard || typeof dashboard !== "object") {
    return `
      <div class="forecast-state forecast-state-empty">
        <span class="forecast-state-icon" aria-hidden="true">0</span>
        <div><strong>Sin resumen calculado</strong><p>Los indicadores apareceran cuando haya datos comerciales disponibles.</p></div>
      </div>
    `;
  }

  const counts = dashboard.counts && typeof dashboard.counts === "object" ? dashboard.counts : {};
  const contacts = forecastWholeNumber(counts.contacts);
  const customers = forecastWholeNumber(counts.customers);
  const converted = forecastWholeNumber(counts.bookingsConvertedToCustomer);
  const bookingDetail = dashboard.convertedBookings && typeof dashboard.convertedBookings === "object"
    ? dashboard.convertedBookings
    : {};

  if (!contacts
    && !forecastWholeNumber(counts.leadsCreated)
    && !forecastWholeNumber(counts.activitiesCompleted)
    && !forecastWholeNumber(counts.proposalsSent)
    && !forecastWholeNumber(counts.proposalsAccepted)
    && !forecastWholeNumber(dashboard.lostReasons?.total)
    && !converted) {
    return `
      <div class="forecast-state forecast-state-empty">
        <span class="forecast-state-icon" aria-hidden="true">0</span>
        <div><strong>Sin actividad comercial</strong><p>No hay contactos, acciones ni conversiones para ${escapeHtml(formatForecastMonth(dashboard.period?.month || state.forecastMonth))}.</p></div>
      </div>
    `;
  }

  return `
    <div class="commercial-dashboard-kpis" role="group" aria-label="Indicadores del resumen comercial">
      ${renderCommercialKpi("Leads del mes", counts.leadsCreated, "Captados en el periodo")}
      ${renderCommercialKpi("Actividades", counts.activitiesCompleted, "Acciones comerciales realizadas")}
      ${renderCommercialKpi("Propuestas enviadas", counts.proposalsSent, `${forecastWholeNumber(counts.proposalsAccepted)} aceptada(s)`)}
      ${renderCommercialKpi("Reservas convertidas", converted, `${forecastWholeNumber(bookingDetail.linkedByContactId)} por contacto, ${forecastWholeNumber(bookingDetail.linkedByIdentity)} por identidad`)}
      ${renderCommercialKpi("Clientes", customers, `${contacts} contacto(s) en cartera`)}
    </div>
    <div class="commercial-dashboard-breakdowns">
      ${renderCommercialBreakdown("Leads por fuente", dashboard.leadsBySource, "source")}
      ${renderCommercialBreakdown("Conversion por estado", dashboard.conversionByStatus, "status")}
      ${renderCommercialBreakdown("Actividad realizada", dashboard.activities?.byType, "type", dashboard.activities?.total)}
      ${renderCommercialLostReasons(dashboard.lostReasons)}
    </div>
  `;
}

function renderCommercialKpi(label, value, note) {
  return `
    <article class="report-block">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(forecastWholeNumber(value)))}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `;
}

function renderCommercialBreakdown(title, items, labelKey, total = null) {
  const rows = Array.isArray(items) ? items.filter((item) => forecastWholeNumber(item?.count) > 0) : [];
  const denominator = forecastWholeNumber(total) || rows.reduce((sum, item) => sum + forecastWholeNumber(item?.count), 0);

  return `
    <article class="commercial-breakdown-card settings-block">
      <h4>${escapeHtml(title)}</h4>
      ${rows.length ? `<ul class="commercial-breakdown-list">
        ${rows.map((item) => {
          const count = forecastWholeNumber(item?.count);
          const percentage = commercialPercentage(item?.percentage, count, denominator);
          const rawLabel = item?.[labelKey] || "sin-dato";
          return `<li>
            <div><strong>${escapeHtml(statusLabel(rawLabel))}</strong><small>${escapeHtml(formatSlaPercent(percentage))}</small></div>
            <b>${escapeHtml(String(count))}</b>
            <progress value="${escapeAttr(String(percentage))}" max="100" aria-label="${escapeAttr(`${statusLabel(rawLabel)}: ${count}`)}"></progress>
          </li>`;
        }).join("")}
      </ul>` : `<p class="commercial-breakdown-empty">Sin datos en el periodo.</p>`}
    </article>
  `;
}

function renderCommercialLostReasons(report) {
  const reasons = Array.isArray(report?.reasons)
    ? report.reasons.filter((item) => forecastWholeNumber(item?.count) > 0)
    : [];
  const legacyMissing = forecastWholeNumber(report?.legacyMissing);
  const rows = legacyMissing
    ? [...reasons, { reason: "sin_motivo", label: "Sin motivo registrado", count: legacyMissing }]
    : reasons;
  return renderCommercialBreakdown(
    "Motivos de perdida",
    rows.map((item) => ({ ...item, source: item?.label || lostReasonLabel(item?.reason) })),
    "source",
    report?.total
  );
}

function commercialPercentage(value, count, total) {
  const supplied = Number(value);
  const percentage = Number.isFinite(supplied) ? supplied : (total ? (count / total) * 100 : 0);
  return Math.min(100, Math.max(0, Math.round(percentage * 10) / 10));
}

function renderForecastPanel(model) {
  const month = normalizeForecastMonth(state.forecastMonth || model.forecast?.month);
  const loading = state.forecastLoading;

  return `
    <section class="forecast-panel" aria-labelledby="forecastPanelTitle" aria-busy="${loading ? "true" : "false"}">
      <header class="forecast-panel-header">
        <div class="forecast-panel-copy">
          <p class="eyebrow">Pipeline de ventas</p>
          <h3 id="forecastPanelTitle">Forecast comercial</h3>
          <p>Prioriza oportunidades con una proyeccion ajustada por la probabilidad de cada etapa.</p>
        </div>
        <form class="forecast-month-form" data-forecast-form>
          <label for="forecastMonth">Mes de analisis</label>
          <div>
            <input
              id="forecastMonth"
              name="month"
              type="month"
              min="2000-01"
              value="${escapeAttr(month)}"
              aria-describedby="forecastMonthHint"
              data-forecast-month
              required
              ${loading ? "disabled" : ""}
            >
            <button type="submit" ${loading ? "disabled" : ""}>${loading ? "Actualizando..." : "Actualizar"}</button>
          </div>
          <small id="forecastMonthHint">La foto refleja el estado disponible al cierre del mes.</small>
        </form>
      </header>
      <div class="forecast-live-region" aria-live="polite" aria-atomic="false">
        ${renderForecastContent(model)}
      </div>
    </section>
  `;
}

function renderForecastContent(model) {
  if (state.forecastLoading) {
    return `
      <div class="forecast-state forecast-state-loading" role="status">
        <span class="forecast-spinner" aria-hidden="true"></span>
        <div>
          <strong>Calculando forecast</strong>
          <p>Estamos ponderando el pipeline para el periodo seleccionado.</p>
        </div>
      </div>
    `;
  }

  if (state.forecastError) {
    return `
      <div class="forecast-state forecast-state-error" role="alert">
        <span class="forecast-state-icon" aria-hidden="true">!</span>
        <div>
          <strong>Forecast no disponible</strong>
          <p>${escapeHtml(state.forecastError)}</p>
        </div>
        <button type="button" data-forecast-retry>Reintentar</button>
      </div>
    `;
  }

  const forecast = model.forecast;
  if (!forecast || typeof forecast !== "object") {
    return `
      <div class="forecast-state forecast-state-empty">
        <span class="forecast-state-icon" aria-hidden="true">0</span>
        <div>
          <strong>Sin forecast calculado</strong>
          <p>Selecciona un mes para consultar la proyeccion comercial.</p>
        </div>
      </div>
    `;
  }

  const contacts = forecastWholeNumber(forecast.contacts);
  if (contacts === 0) {
    return `
      <div class="forecast-state forecast-state-empty">
        <span class="forecast-state-icon" aria-hidden="true">0</span>
        <div>
          <strong>Sin oportunidades en este periodo</strong>
          <p>No hay contactos disponibles al cierre de ${escapeHtml(formatForecastMonth(forecast.month || state.forecastMonth))}. Los importes apareceran cuando el pipeline tenga oportunidades.</p>
        </div>
      </div>
    `;
  }

  const currency = forecastCurrency(forecast.currency, model.currency);
  const rows = Array.isArray(forecast.byStatus) ? forecast.byStatus : [];

  return `
    <div class="forecast-summary" role="group" aria-label="Indicadores principales del forecast">
      ${renderForecastKpi(
        "Forecast ponderado",
        formatForecastMoney(forecast.weightedForecast, currency),
        "Valor total ajustado por probabilidad",
        "weighted"
      )}
      ${renderForecastKpi(
        "Pipeline abierto",
        formatForecastMoney(forecast.openWeightedForecast, currency),
        "Ponderado de etapas aun negociables",
        "open"
      )}
      ${renderForecastKpi(
        "Valor bruto",
        formatForecastMoney(forecast.totalValueEstimate, currency),
        `${contacts} oportunidad${contacts === 1 ? "" : "es"} en la foto`,
        "gross"
      )}
      ${renderForecastKpi(
        "Cerrado ganado",
        formatForecastMoney(forecast.closedWonValue, currency),
        "Valor ganado y clientes consolidados",
        "won"
      )}
    </div>
    <section class="forecast-breakdown" aria-labelledby="forecastBreakdownTitle">
      <header>
        <div>
          <p class="eyebrow">Detalle por etapa</p>
          <h4 id="forecastBreakdownTitle">Conversion y valor esperado</h4>
        </div>
        <span>${escapeHtml(formatForecastMonth(forecast.month || state.forecastMonth))}</span>
      </header>
      ${rows.length ? renderForecastRows(rows, currency) : `
        <div class="forecast-breakdown-empty">
          <strong>Sin desglose disponible</strong>
          <p>El resumen existe, pero la API no ha devuelto etapas para este periodo.</p>
        </div>
      `}
    </section>
  `;
}

function renderForecastKpi(label, value, note, tone) {
  return `
    <article class="forecast-kpi forecast-kpi-${escapeAttr(tone)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `;
}

function renderForecastRows(rows, currency) {
  return `
    <div class="forecast-table-scroll" tabindex="0" aria-label="Desglose desplazable del forecast">
      <table class="forecast-table">
        <thead>
          <tr>
            <th scope="col">Estado</th>
            <th scope="col">Oportunidades</th>
            <th scope="col">Probabilidad</th>
            <th scope="col">Valor bruto</th>
            <th scope="col">Valor ponderado</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => {
            const status = clean(row?.status || "new").toLowerCase();
            const probability = forecastProbability(row?.probability);
            const probabilityLabel = formatForecastProbability(probability);
            const label = statusLabel(status);

            return `
              <tr>
                <th scope="row"><span class="forecast-stage">${escapeHtml(label)}</span></th>
                <td>${escapeHtml(String(forecastWholeNumber(row?.count)))}</td>
                <td>
                  <div class="forecast-probability">
                    <progress value="${escapeAttr(String(probability * 100))}" max="100" aria-label="${escapeAttr(`Probabilidad de ${label}: ${probabilityLabel}`)}"></progress>
                    <span>${escapeHtml(probabilityLabel)}</span>
                  </div>
                </td>
                <td>${escapeHtml(formatForecastMoney(row?.totalValueEstimate, currency))}</td>
                <td><strong>${escapeHtml(formatForecastMoney(row?.weightedValue, currency))}</strong></td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderSlaPanel(model) {
  const hours = normalizeSlaHours(state.slaHours || model.sla?.thresholdHours);
  const loading = state.slaLoading;
  const hourOptions = Array.from(new Set([...SLA_HOUR_OPTIONS, hours]))
    .sort((left, right) => left - right);

  return `
    <section class="sla-panel forecast-panel" aria-labelledby="slaPanelTitle" aria-busy="${loading ? "true" : "false"}">
      <header class="sla-panel-header forecast-panel-header">
        <div class="sla-panel-copy forecast-panel-copy">
          <p class="eyebrow">Velocidad comercial</p>
          <h3 id="slaPanelTitle">SLA de primera respuesta</h3>
          <p>Mide cuanto tarda el equipo en responder y detecta leads abiertos que siguen sin una interaccion humana.</p>
        </div>
        <form class="sla-hours-form forecast-month-form" data-sla-form>
          <label for="slaHours">Umbral sin respuesta</label>
          <div>
            <select
              id="slaHours"
              name="hours"
              aria-describedby="slaHoursHint"
              data-sla-hours
              required
              ${loading ? "disabled" : ""}
            >
              ${hourOptions.map((option) => `
                <option value="${escapeAttr(String(option))}"${option === hours ? " selected" : ""}>${escapeHtml(formatSlaThreshold(option))}</option>
              `).join("")}
            </select>
            <button type="submit" ${loading ? "disabled" : ""}>${loading ? "Actualizando..." : "Actualizar"}</button>
          </div>
          <small id="slaHoursHint">Un lead aparece sin tocar cuando supera este umbral sin actividad humana.</small>
        </form>
      </header>
      <div class="sla-live-region forecast-live-region" aria-live="polite" aria-atomic="false">
        ${renderSlaContent(model)}
      </div>
    </section>
  `;
}

function renderSlaContent(model) {
  if (state.slaLoading) {
    return `
      <div class="sla-state sla-state-loading forecast-state forecast-state-loading" role="status">
        <span class="sla-spinner forecast-spinner" aria-hidden="true"></span>
        <div>
          <strong>Calculando tiempos de respuesta</strong>
          <p>Estamos revisando la primera interaccion humana de cada contacto.</p>
        </div>
      </div>
    `;
  }

  if (state.slaError) {
    return `
      <div class="sla-state sla-state-error forecast-state forecast-state-error" role="alert">
        <span class="sla-state-icon forecast-state-icon" aria-hidden="true">!</span>
        <div>
          <strong>SLA no disponible</strong>
          <p>${escapeHtml(state.slaError)}</p>
        </div>
        <button type="button" data-sla-retry>Reintentar</button>
      </div>
    `;
  }

  const sla = model.sla;
  if (!sla || typeof sla !== "object") {
    return `
      <div class="sla-state sla-state-empty forecast-state forecast-state-empty">
        <span class="sla-state-icon forecast-state-icon" aria-hidden="true">0</span>
        <div>
          <strong>Sin SLA calculado</strong>
          <p>Selecciona un umbral para consultar los tiempos de primera respuesta.</p>
        </div>
      </div>
    `;
  }

  const totalContacts = slaWholeNumber(sla.totalContacts);
  if (totalContacts === 0) {
    return `
      <div class="sla-state sla-state-empty forecast-state forecast-state-empty">
        <span class="sla-state-icon forecast-state-icon" aria-hidden="true">0</span>
        <div>
          <strong>Sin contactos medibles</strong>
          <p>Los indicadores apareceran cuando el CRM tenga contactos con una fecha de alta valida.</p>
        </div>
      </div>
    `;
  }

  const thresholdHours = normalizeSlaHours(sla.thresholdHours ?? state.slaHours);
  const responded = slaWholeNumber(sla.responded);
  const withinSla = Math.min(responded, slaWholeNumber(sla.withinSla));
  const untouched = Array.isArray(sla.untouched) ? sla.untouched : [];
  const untouchedTotal = Math.max(untouched.length, slaWholeNumber(sla.untouchedTotal));
  const generatedAt = formatSlaGeneratedAt(sla.generatedAt);

  return `
    <div class="sla-summary forecast-summary" role="group" aria-label="Indicadores principales del SLA comercial">
      ${renderSlaKpi(
        "Tiempo medio",
        responded ? formatSlaDuration(sla.averageFirstResponseMinutes) : "--",
        "Promedio hasta la primera respuesta humana",
        "average"
      )}
      ${renderSlaKpi(
        "Mediana",
        responded ? formatSlaDuration(sla.medianFirstResponseMinutes) : "--",
        "Valor central, menos sensible a casos extremos",
        "median"
      )}
      ${renderSlaKpi(
        "Respondidos",
        String(responded),
        `${withinSla} dentro de ${formatSlaThreshold(thresholdHours)} (${formatSlaPercent(sla.complianceRate)})`,
        "responded"
      )}
      ${renderSlaKpi(
        "Sin tocar",
        String(untouchedTotal),
        `Leads abiertos con mas de ${formatSlaThreshold(thresholdHours)}`,
        untouchedTotal ? "untouched" : "clear"
      )}
    </div>
    ${renderSlaUntouchedList(untouched, untouchedTotal, thresholdHours, generatedAt)}
  `;
}

function renderSlaKpi(label, value, note, tone) {
  return `
    <article class="sla-kpi sla-kpi-${escapeAttr(tone)} forecast-kpi forecast-kpi-${escapeAttr(tone)}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `;
}

function renderSlaUntouchedList(contacts, total, thresholdHours, generatedAt) {
  return `
    <section class="sla-untouched" aria-labelledby="slaUntouchedTitle">
      <header>
        <div>
          <p class="eyebrow">Requieren seguimiento</p>
          <h4 id="slaUntouchedTitle">Leads sin tocar</h4>
          <p>Contactos abiertos sin una primera respuesta humana tras ${escapeHtml(formatSlaThreshold(thresholdHours))}.</p>
        </div>
        <div class="sla-untouched-meta">
          <strong aria-label="${escapeAttr(`${total} leads sin tocar`)}">${escapeHtml(String(total))}</strong>
          <span>${escapeHtml(generatedAt)}</span>
        </div>
      </header>
      ${contacts.length ? `
        <ul class="sla-lead-list" aria-label="Leads que han superado el umbral sin respuesta">
          ${contacts.map(renderSlaUntouchedContact).join("")}
        </ul>
      ` : `
        <div class="sla-untouched-empty" role="status">
          <span aria-hidden="true">OK</span>
          <div>
            <strong>Ningun lead fuera de plazo</strong>
            <p>Todos los contactos abiertos estan respondidos o dentro del umbral seleccionado.</p>
          </div>
        </div>
      `}
    </section>
  `;
}

function renderSlaUntouchedContact(contact) {
  const name = clean(contact?.name || contact?.email || contact?.phone || "Contacto sin nombre");
  const status = statusLabel(clean(contact?.status || "new"));
  const source = clean(contact?.source || "manual");
  const contactLine = [clean(contact?.phone), clean(contact?.email)].filter(Boolean).join(" · ") || "Sin telefono ni email";
  const createdAt = normalizeSlaDate(contact?.createdAt);

  return `
    <li>
      <article class="sla-lead-card">
        <header>
          <div>
            <strong>${escapeHtml(name)}</strong>
            <p>${escapeHtml(contactLine)}</p>
          </div>
          <span>${escapeHtml(status)}</span>
        </header>
        <dl>
          <div>
            <dt>Sin respuesta</dt>
            <dd>${escapeHtml(formatSlaAge(contact?.ageHours))}</dd>
          </div>
          <div>
            <dt>Origen</dt>
            <dd>${escapeHtml(source)}</dd>
          </div>
          <div>
            <dt>Alta</dt>
            <dd>${createdAt ? `<time datetime="${escapeAttr(createdAt)}">${escapeHtml(formatDateTime(createdAt))}</time>` : "-"}</dd>
          </div>
        </dl>
      </article>
    </li>
  `;
}

function bindReportControls() {
  const form = document.querySelector("[data-forecast-form]");
  const monthInput = form?.querySelector("[data-forecast-month]");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const month = clean(monthInput?.value);

    if (!/^[1-9]\d{3}-(?:0[1-9]|1[0-2])$/.test(month)) {
      monthInput?.setCustomValidity("Selecciona un mes valido.");
      monthInput?.reportValidity();
      return;
    }

    monthInput?.setCustomValidity("");
    const businessRef = state.business?.id || state.business?.slug || "";
    if (businessRef) {
      await Promise.all([
        loadForecast(businessRef, { month, render: true }),
        loadCommercialDashboard(businessRef, { month, hours: state.slaHours, render: true })
      ]);
    }
  });

  monthInput?.addEventListener("input", () => {
    monthInput.setCustomValidity("");
  });

  monthInput?.addEventListener("change", () => {
    if (monthInput.value && !state.forecastLoading) {
      form?.requestSubmit();
    }
  });

  document.querySelector("[data-forecast-retry]")?.addEventListener("click", async () => {
    const businessRef = state.business?.id || state.business?.slug || "";
    if (businessRef) {
      await loadForecast(businessRef, { month: state.forecastMonth, render: true });
    }
  });

  const slaForm = document.querySelector("[data-sla-form]");
  const slaHoursSelect = slaForm?.querySelector("[data-sla-hours]");

  slaForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const rawHours = clean(slaHoursSelect?.value);
    const hours = Number(rawHours);

    if (!isValidSlaHours(hours) || String(hours) !== rawHours) {
      slaHoursSelect?.setCustomValidity("Selecciona un umbral valido.");
      slaHoursSelect?.reportValidity();
      return;
    }

    slaHoursSelect?.setCustomValidity("");
    const businessRef = state.business?.id || state.business?.slug || "";
    if (businessRef) {
      await Promise.all([
        loadSla(businessRef, { hours, render: true }),
        loadCommercialDashboard(businessRef, { month: state.forecastMonth, hours, render: true })
      ]);
    }
  });

  slaHoursSelect?.addEventListener("change", () => {
    slaHoursSelect.setCustomValidity("");
    if (slaHoursSelect.value && !state.slaLoading) {
      slaForm?.requestSubmit();
    }
  });

  document.querySelector("[data-sla-retry]")?.addEventListener("click", async () => {
    const businessRef = state.business?.id || state.business?.slug || "";
    if (businessRef) {
      await loadSla(businessRef, { hours: state.slaHours, render: true });
    }
  });

  document.querySelector("[data-commercial-dashboard-retry]")?.addEventListener("click", async () => {
    const businessRef = state.business?.id || state.business?.slug || "";
    if (businessRef) {
      await loadCommercialDashboard(businessRef, {
        month: state.forecastMonth,
        hours: state.slaHours,
        render: true
      });
    }
  });
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

function renderGoogle(model) {
  const container = document.querySelector('[data-list="google"]');

  if (!container) {
    return;
  }

  if (state.clientSession) {
    container.innerHTML = emptyState("Modulo interno", "Google Ops lo gestiona el equipo DLS.");
    return;
  }

  if (state.googleError) {
    container.innerHTML = emptyState("Google Ops no disponible", state.googleError);
    return;
  }

  const status = state.googleStatus;

  if (!status) {
    container.innerHTML = emptyState("Cargando Google Ops", "Actualiza el dashboard para consultar la conexion.");
    return;
  }

  const connected = status.connected || {};
  const configured = status.configured || {};
  const settings = status.settings || {};
  const snapshot = status.placeSnapshot || null;
  const diagnostics = state.googleDiagnostics?.checks || [];
  const setupItems = [
    ["OAuth web-server", configured.oauth],
    ["Cifrado de tokens", configured.tokenEncryption],
    ["Places API", configured.placesApi]
  ];
  const connectionItems = [
    ["Calendar", connected.calendar, "calendar"],
    ["Business Profile", connected.businessProfile, "business-profile"],
    ["Workspace", connected.workspace, "workspace"]
  ];

  container.innerHTML = `
    <div class="google-actions">
      <button type="button" data-google-connect="calendar">Conectar Calendar</button>
      <button type="button" data-google-connect="business-profile">Conectar Business Profile</button>
      <button type="button" data-google-connect="workspace">Conectar Workspace</button>
      <button type="button" data-google-connect="calendar,business-profile,workspace">Conectar todo</button>
      <button type="button" data-google-refresh>Actualizar estado</button>
      <button type="button" data-google-diagnostics>Probar conexiones</button>
      ${status.connection ? '<button type="button" data-google-disconnect>Desconectar OAuth</button>' : ""}
    </div>

    <div class="google-feature-grid">
      <article class="google-ops-card">
        <p class="eyebrow">Backend</p>
        <h3>Preparacion tecnica</h3>
        <div class="google-check-list">
          ${setupItems.map(([label, done]) => `
            <span class="${done ? "is-ready" : "is-pending"}"><strong>${done ? "OK" : "!"}</strong>${escapeHtml(label)}</span>
          `).join("")}
        </div>
      </article>

      <article class="google-ops-card">
        <p class="eyebrow">OAuth por negocio</p>
        <h3>Servicios conectados</h3>
        <div class="google-check-list">
          ${connectionItems.map(([label, done]) => `
            <span class="${done ? "is-ready" : "is-pending"}"><strong>${done ? "OK" : "!"}</strong>${escapeHtml(label)}</span>
          `).join("")}
        </div>
        <small>${escapeHtml(status.connection?.updatedAt ? `Ultima conexion: ${formatDateTime(status.connection.updatedAt)}` : "Sin OAuth persistente guardado")}</small>
      </article>

      <article class="google-ops-card">
        <p class="eyebrow">Configuracion</p>
        <h3>IDs operativos</h3>
        <dl>
          <div><dt>Place ID</dt><dd>${escapeHtml(settings.placeId || "Pendiente")}</dd></div>
          <div><dt>Calendar ID</dt><dd>${escapeHtml(settings.calendarId || "primary")}</dd></div>
          <div><dt>Cuenta GBP</dt><dd>${escapeHtml(settings.businessProfileAccountId || "Pendiente")}</dd></div>
          <div><dt>Ubicacion GBP</dt><dd>${escapeHtml(settings.businessProfileLocationId || "Pendiente")}</dd></div>
        </dl>
      </article>

      <article class="google-ops-card">
        <p class="eyebrow">Places snapshot</p>
        <h3>${escapeHtml(snapshot?.name || model.business.name)}</h3>
        ${snapshot ? `
          <strong>${escapeHtml(String(snapshot.rating || 0))}/5 - ${escapeHtml(String(snapshot.reviewCount || 0))} resenas</strong>
          <p>${escapeHtml(snapshot.address || "Sin direccion devuelta")}</p>
          <small>Sincronizado: ${escapeHtml(formatDateTime(status.placeSnapshotAt))}</small>
        ` : "<p>Sin snapshot. Configura Place ID y sincroniza para contrastar datos publicos.</p>"}
        <button type="button" data-google-sync-place${settings.placeId && configured.placesApi ? "" : " disabled"}>Sincronizar Places</button>
      </article>
    </div>

    <section class="google-ops-note">
      <strong>Politica operativa</strong>
      <p>Las reservas se sincronizan con Calendar al crearlas o cambiarlas. Las respuestas a resenas, cambios de Business Profile y altas de Workspace requieren confirmacion explicita en la API.</p>
    </section>
    ${diagnostics.length ? `
      <section class="google-ops-note">
        <strong>Diagnostico real</strong>
        <div class="google-check-list">
          ${diagnostics.map((check) => `
            <span class="${check.ok ? "is-ready" : "is-pending"}"><strong>${check.ok ? "OK" : check.skipped ? "-" : "!"}</strong>${escapeHtml(`${check.name}: ${check.ok ? "conexion verificada" : check.message || "pendiente"}`)}</span>
          `).join("")}
        </div>
      </section>
    ` : ""}
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
  const nextActions = normalizeNextActionsModel(crm.nextActions);
  const report = crm.report || null;
  const forecast = crm.forecast || null;
  const sla = crm.sla || null;
  const commercialDashboard = crm.commercialDashboard || null;
  const inbox = crm.inbox || null;
  const orders = arrayFrom(content.orders, commerce.orders, business.orders);
  const products = arrayFrom(content.products, commerce.products, business.products);
  const events = arrayFrom(content.metricEvents, business.metricEvents, content.events);
  const today = new Date();
  const currency = commerce.currency || content.currency || "EUR";
  const pipeline = crm.pipeline ? normalizePipelinePayload(crm.pipeline) : buildPipelineModel(contacts);
  const duplicateGroups = Array.isArray(crm.duplicateGroups) ? crm.duplicateGroups : [];
  const proposals = Array.isArray(crm.proposals) ? crm.proposals : [];
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
    contacts,
    leads,
    pipeline,
    duplicateGroups,
    proposals,
    customers,
    services,
    bookings,
    availability,
    blocks,
    reminderQueue,
    nextActions,
    report,
    forecast,
    sla,
    commercialDashboard,
    inbox,
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

function bindCrmControls(model) {
  bindPipelineControls(model);

  document.querySelectorAll("[data-merge-duplicates]").forEach((button) => {
    button.addEventListener("click", async () => {
      const groupId = button.dataset.groupId || "";
      const group = model.duplicateGroups.find((item) => item.id === groupId);
      const survivorId = button.closest("[data-duplicate-group]")?.querySelector("[data-merge-survivor]")?.value || "";
      const duplicateIds = (group?.contacts || [])
        .map((contact) => contact.id)
        .filter((id) => id && id !== survivorId);

      if (!state.business || !survivorId || !duplicateIds.length) {
        return;
      }

      button.disabled = true;

      try {
        await postJson(
          `/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/contacts/merge`,
          { survivorId, duplicateIds }
        );
        await loadContacts(state.business.id || state.business.slug);
        showNotice("Contactos fusionados.", "info");
        render();
      } catch (error) {
        showNotice("No se pudieron fusionar los contactos.", "error");
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-contact-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      const contactId = select.dataset.contactId || "";
      const status = select.value;
      const previous = state.contacts.find((contact) => contact.id === contactId) || null;

      if (!contactId || !state.business || !previous) {
        return;
      }

      const lostReason = await requestLostReasonForTransition(previous, status);

      if (lostReason === null) {
        select.value = previous.status || "new";
        return;
      }

      select.disabled = true;

      try {
        const result = await patchJson(
          `/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/contacts/${encodeURIComponent(contactId)}`,
          lostReason ? { status, lostReason } : { status }
        );
        mergeContactResult(contactId, result.contact, result.activity);
        showNotice("Estado del lead actualizado.", "info");
        render();
      } catch (error) {
        showNotice("No se pudo actualizar el estado del lead.", "error");
        select.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-score-label-filter]").forEach((select) => {
    select.addEventListener("change", () => {
      state.scoreLabelFilter = normalizeScoreFilter(select.value);
      render();
    });
  });

  document.querySelectorAll("[data-contact-timeline]").forEach((button) => {
    button.addEventListener("click", () => {
      const contactId = button.dataset.contactId || "";

      if (contactId) {
        openContactTimeline(contactId);
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
        mergeContactResult(contactId, result.contact, result.activity);
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

  document.querySelectorAll("[data-next-action-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const contactId = form.dataset.contactId || "";
      const data = new FormData(form);
      const payload = {
        type: clean(data.get("type")),
        dueDate: dateInputToIso(data.get("dueDate")),
        note: clean(data.get("note"))
      };

      if (!contactId || !payload.type || !payload.dueDate || !state.business) {
        return;
      }

      const button = form.querySelector("button[type='submit']");
      if (button) {
        button.disabled = true;
      }

      try {
        const result = await postJson(
          `/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/contacts/${encodeURIComponent(contactId)}/next-action`,
          payload
        );
        mergeContactResult(contactId, result.contact, result.activity);
        await loadNextActions(state.business.id || state.business.slug);
        showNotice("Proxima accion guardada.", "info");
        render();
      } catch (error) {
        showNotice("No se pudo guardar la proxima accion.", "error");
        if (button) {
          button.disabled = false;
        }
      }
    });
  });

  document.querySelectorAll("[data-next-action-done]").forEach((button) => {
    button.addEventListener("click", async () => {
      const contactId = button.dataset.contactId || "";

      if (!contactId || !state.business) {
        return;
      }

      button.disabled = true;

      try {
        const result = await patchJson(
          `/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/contacts/${encodeURIComponent(contactId)}/next-action`,
          { status: "hecha" }
        );
        mergeContactResult(contactId, result.contact, result.activity);
        await loadNextActions(state.business.id || state.business.slug);
        showNotice("Proxima accion marcada como hecha.", "info");
        render();
      } catch (error) {
        showNotice("No se pudo completar la proxima accion.", "error");
        button.disabled = false;
      }
    });
  });
}

function bindProposalControls(model) {
  document.querySelectorAll("[data-create-proposal-for-contact]").forEach((button) => {
    button.addEventListener("click", () => {
      const contactId = button.dataset.contactId || "";

      if (contactId) {
        startProposalForContact(contactId);
      }
    });
  });

  document.querySelector("[data-proposals-retry]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    const businessRef = state.business?.id || state.business?.slug || "";

    if (!businessRef) {
      return;
    }

    button.disabled = true;
    await loadProposals(businessRef, { render: true });

    if (state.proposalError) {
      showNotice(state.proposalError, "error");
    } else {
      showNotice("Propuestas actualizadas.", "info");
    }
  });

  document.querySelector("[data-proposals-go-leads]")?.addEventListener("click", () => {
    setActiveTab("leads");
    document.querySelector('[data-tab="leads"]')?.focus();
  });

  const form = document.querySelector("[data-proposal-form]");
  form?.addEventListener("change", (event) => {
    if (event.target?.name === "contactId") {
      state.proposalDraftContactId = clean(event.target.value);
    }
  });
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await createProposalFromForm(form);
  });

  document.querySelectorAll("[data-proposal-status]").forEach((select) => {
    select.addEventListener("change", async () => {
      await updateProposalStatus(select);
    });
  });

  document.querySelectorAll("[data-proposal-export]").forEach((button) => {
    button.addEventListener("click", async () => {
      const proposalId = button.dataset.proposalId || "";
      const format = button.dataset.proposalExport || "html";

      if (proposalId) {
        await exportProposal(proposalId, format, button);
      }
    });
  });
}

async function createProposalFromForm(form) {
  const businessRef = state.business?.id || state.business?.slug || "";
  const data = new FormData(form);
  const setupPrice = Number(data.get("setupPrice"));
  const monthlyPrice = Number(data.get("monthlyPrice"));
  const payload = {
    contactId: clean(data.get("contactId")),
    package: clean(data.get("package")),
    setupPrice,
    monthlyPrice,
    conditions: String(data.get("conditions") || "").trim(),
    expiresAt: dateInputToEndOfDayIso(data.get("expiresAt")),
    status: normalizeProposalStatus(data.get("status"))
  };

  if (!businessRef || !payload.contactId || !PROPOSAL_PACKAGES.includes(payload.package)
    || !Number.isFinite(setupPrice) || setupPrice < 0
    || !Number.isFinite(monthlyPrice) || monthlyPrice < 0
    || !payload.conditions || !payload.expiresAt) {
    setProposalFormFeedback("Revisa los campos obligatorios y los importes.", "error");
    form.reportValidity?.();
    return;
  }

  const submit = form.querySelector('button[type="submit"]');
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Creando...";
  }
  form.setAttribute("aria-busy", "true");
  setProposalFormFeedback("Guardando la propuesta comercial...", "info");

  try {
    const result = await postJson(
      `/api/businesses/${encodeURIComponent(businessRef)}/proposals`,
      payload
    );

    if (!result?.proposal) {
      throw new Error("Proposal response is missing");
    }

    mergeProposal(result.proposal);
    if (result.proposal.status === "aceptada") {
      await loadContacts(businessRef);
    }
    state.proposalDraftContactId = payload.contactId;
    state.proposalFeedback = { type: "success", message: "Propuesta creada correctamente." };
    showNotice("Propuesta comercial creada.", "info");
    render();
    focusProposalCard(result.proposal.id);
  } catch (error) {
    state.proposalFeedback = { type: "error", message: "No se pudo crear la propuesta. Revisa los datos e intentalo de nuevo." };
    setProposalFormFeedback(state.proposalFeedback.message, "error");
    showNotice("No se pudo crear la propuesta comercial.", "error");
    if (submit) {
      submit.disabled = false;
      submit.textContent = "Crear propuesta";
    }
    form.removeAttribute("aria-busy");
  }
}

async function updateProposalStatus(select) {
  const proposalId = select.dataset.proposalId || "";
  const previousStatus = normalizeProposalStatus(select.dataset.currentStatus);
  const status = normalizeProposalStatus(select.value);
  const businessRef = state.business?.id || state.business?.slug || "";
  const card = select.closest("[data-proposal-card]");

  if (!businessRef || !proposalId || status === previousStatus) {
    return;
  }

  select.disabled = true;
  card?.setAttribute("aria-busy", "true");

  try {
    const result = await patchJson(
      `/api/businesses/${encodeURIComponent(businessRef)}/proposals/${encodeURIComponent(proposalId)}`,
      { status }
    );

    if (!result?.proposal) {
      throw new Error("Proposal response is missing");
    }

    mergeProposal(result.proposal);
    if (result.proposal.status === "aceptada") {
      await loadContacts(businessRef);
    }
    state.proposalFeedback = { type: "success", message: `Estado actualizado a ${statusLabel(result.proposal.status || status)}.` };
    showNotice("Estado de la propuesta actualizado.", "info");
    render();
    focusProposalCard(proposalId);
  } catch (error) {
    select.value = previousStatus;
    state.proposalFeedback = { type: "error", message: "No se pudo actualizar el estado de la propuesta." };
    showNotice(state.proposalFeedback.message, "error");
    render();
    focusProposalCard(proposalId);
  }
}

async function exportProposal(proposalId, format, button) {
  const businessRef = state.business?.id || state.business?.slug || "";
  const normalizedFormat = format === "pdf" ? "pdf" : "html";

  if (!businessRef || !proposalId) {
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Preparando...";
  button.setAttribute("aria-busy", "true");

  try {
    const response = await fetch(
      apiUrl(`/api/businesses/${encodeURIComponent(businessRef)}/proposals/${encodeURIComponent(proposalId)}/export?format=${encodeURIComponent(normalizedFormat)}`),
      {
        headers: {
          ...apiHeaders(),
          Accept: normalizedFormat === "pdf" ? "application/pdf" : "text/html"
        },
        cache: "no-store"
      }
    );

    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.error || `Request failed: ${response.status}`);
    }

    const blob = await response.blob();
    const filename = proposalExportFilename(response, proposalId, normalizedFormat);
    downloadBlob(blob, filename);
    state.proposalFeedback = { type: "success", message: `Exportacion ${normalizedFormat.toUpperCase()} preparada.` };
    setProposalFormFeedback(state.proposalFeedback.message, "success");
    showNotice(`Propuesta exportada en ${normalizedFormat.toUpperCase()}.`, "info");
  } catch (error) {
    state.proposalFeedback = { type: "error", message: `No se pudo exportar la propuesta en ${normalizedFormat.toUpperCase()}.` };
    setProposalFormFeedback(state.proposalFeedback.message, "error");
    showNotice(state.proposalFeedback.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = originalText;
    button.removeAttribute("aria-busy");
  }
}

function startProposalForContact(contactId, options = {}) {
  const contact = state.contacts.find((item) => item.id === contactId);

  if (!contact) {
    showNotice("No se encontro el contacto para crear la propuesta.", "error");
    return;
  }

  if (options.closeDialog) {
    closeContactTimeline();
  }

  state.proposalDraftContactId = contactId;
  state.proposalFeedback = { type: "info", message: `Preparando una propuesta para ${contactName(contact)}.` };
  setActiveTab("proposals");
  render();

  window.requestAnimationFrame(() => {
    const select = document.querySelector('[data-proposal-form] select[name="contactId"]');
    const packageField = document.querySelector('[data-proposal-form] select[name="package"]');
    if (select) {
      select.value = contactId;
    }
    packageField?.focus({ preventScroll: true });
    document.querySelector(".proposal-compose")?.scrollIntoView({ block: "start", behavior: "auto" });
  });
}

function setProposalFormFeedback(message, type = "") {
  const node = document.querySelector("[data-proposal-feedback]");

  if (!node) {
    return;
  }

  node.textContent = message || "";
  node.className = `proposal-feedback${type ? ` is-${type}` : ""}`;
}

function mergeProposal(proposal) {
  const proposalId = clean(proposal?.id || "");

  if (!proposalId) {
    return;
  }

  const index = state.proposals.findIndex((item) => item.id === proposalId);
  if (index >= 0) {
    state.proposals[index] = { ...state.proposals[index], ...proposal };
  } else {
    state.proposals = [proposal, ...state.proposals];
  }
}

function focusProposalCard(proposalId) {
  window.requestAnimationFrame(() => {
    Array.from(document.querySelectorAll("[data-proposal-card]"))
      .find((card) => card.dataset.proposalCard === proposalId)
      ?.focus({ preventScroll: false });
  });
}

function proposalExportFilename(response, proposalId, format) {
  const disposition = response.headers.get("Content-Disposition") || "";
  const encodedMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  let filename = encodedMatch?.[1] || plainMatch?.[1] || `propuesta-${proposalId}.${format}`;

  try {
    filename = decodeURIComponent(filename);
  } catch (error) {
    filename = `propuesta-${proposalId}.${format}`;
  }

  return filename.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function bindMessageControls() {
  document.querySelectorAll("[data-prepare-message-for-contact]").forEach((button) => {
    button.addEventListener("click", () => {
      const contactId = button.dataset.contactId || "";
      if (contactId) {
        startMessageForContact(contactId);
      }
    });
  });

  document.querySelectorAll("[data-message-retry]").forEach((button) => {
    button.addEventListener("click", async () => {
      const businessRef = state.business?.id || state.business?.slug || "";
      if (!businessRef) {
        return;
      }
      button.disabled = true;
      await loadMessageTemplates(businessRef, { render: true });
      showNotice(state.messageError || "Plantillas actualizadas.", state.messageError ? "error" : "info");
    });
  });

  document.querySelector("[data-message-go-leads]")?.addEventListener("click", () => {
    setActiveTab("leads");
    document.querySelector('[data-tab="leads"]')?.focus();
  });

  const renderForm = document.querySelector("[data-message-render-form]");
  renderForm?.addEventListener("change", (event) => {
    if (event.target?.name === "contactId") {
      state.messageComposer.contactId = clean(event.target.value);
      state.messageComposer.preview = null;
      state.messageComposer.feedback = "";
      render();
      return;
    }

    if (event.target?.name === "templateId") {
      state.messageComposer.templateId = clean(event.target.value);
      state.messageComposer.preview = null;
      state.messageComposer.feedback = "";
      render();
    }
  });
  renderForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await renderSelectedMessage(renderForm);
  });

  document.querySelector("[data-message-copy]")?.addEventListener("click", async (event) => {
    const preview = state.messageComposer.preview;
    const text = [preview?.subject, preview?.message].filter(Boolean).join("\n\n");

    if (!text) {
      return;
    }

    const copied = await copyTextToClipboard(text);
    state.messageComposer.feedback = copied ? "Mensaje copiado al portapapeles." : "No se pudo copiar automaticamente; selecciona el texto de la vista previa.";
    showNotice(state.messageComposer.feedback, copied ? "info" : "warn");
    render();
    document.querySelector("[data-message-copy]")?.focus();
  });

  const templateForm = document.querySelector("[data-message-template-form]");
  templateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveMessageTemplate(templateForm);
  });
  templateForm?.querySelector("[data-message-template-reset]")?.addEventListener("click", async (event) => {
    await restoreDefaultMessageTemplate(templateForm, event.currentTarget);
  });
}

async function renderSelectedMessage(form) {
  const businessRef = state.business?.id || state.business?.slug || "";
  const data = new FormData(form);
  const contactId = clean(data.get("contactId"));
  const templateId = clean(data.get("templateId"));
  const submit = form.querySelector('button[type="submit"]');

  if (!businessRef || !contactId || !templateId) {
    state.messageComposer.feedback = "Selecciona contacto y plantilla.";
    render();
    return;
  }

  form.setAttribute("aria-busy", "true");
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Generando...";
  }

  try {
    const preview = await postJson(
      `/api/businesses/${encodeURIComponent(businessRef)}/message-templates/${encodeURIComponent(templateId)}/render`,
      {
        contactId,
        demoUrl: clean(data.get("demoUrl")),
        proposalUrl: clean(data.get("proposalUrl")),
        reviewUrl: clean(data.get("reviewUrl"))
      }
    );
    state.messageComposer = {
      contactId,
      templateId,
      preview,
      feedback: "Vista previa generada. Revisa el contenido antes de usar un canal."
    };
    render();
    document.querySelector(".message-preview:not(.message-preview-empty)")?.focus?.({ preventScroll: false });
  } catch (error) {
    state.messageComposer.contactId = contactId;
    state.messageComposer.templateId = templateId;
    state.messageComposer.preview = null;
    state.messageComposer.feedback = error.message || "No se pudo renderizar la plantilla.";
    showNotice(state.messageComposer.feedback, "error");
    render();
  }
}

async function saveMessageTemplate(form) {
  const businessRef = state.business?.id || state.business?.slug || "";
  const templateId = clean(form.dataset.templateId);
  const type = clean(form.dataset.templateType);
  const isOverride = form.dataset.templateOverride === "true";
  const data = new FormData(form);
  const submit = form.querySelector('button[type="submit"]');
  const payload = {
    type,
    label: clean(data.get("label")),
    subject: String(data.get("subject") || "").trim(),
    body: String(data.get("body") || "").trim()
  };

  if (!businessRef || !type || !payload.label || !payload.body) {
    form.reportValidity?.();
    return;
  }

  form.setAttribute("aria-busy", "true");
  if (submit) {
    submit.disabled = true;
    submit.textContent = "Guardando...";
  }

  try {
    const result = isOverride
      ? await patchJson(`/api/businesses/${encodeURIComponent(businessRef)}/message-templates/${encodeURIComponent(templateId)}`, payload)
      : await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/message-templates`, payload);
    state.messageComposer.templateId = result.template?.id || templateId;
    state.messageComposer.preview = null;
    state.messageComposer.feedback = "Plantilla personalizada guardada.";
    await loadMessageTemplates(businessRef, { render: true });
    showNotice("Plantilla de seguimiento guardada.", "info");
  } catch (error) {
    state.messageComposer.feedback = error.message || "No se pudo guardar la plantilla.";
    showNotice(state.messageComposer.feedback, "error");
    render();
  }
}

async function restoreDefaultMessageTemplate(form, button) {
  const businessRef = state.business?.id || state.business?.slug || "";
  const templateId = clean(form.dataset.templateId);
  const type = clean(form.dataset.templateType);

  if (!businessRef || !templateId || form.dataset.templateOverride !== "true") {
    return;
  }

  if (!window.confirm("Se eliminara la personalizacion y volvera la plantilla base. Continuar?")) {
    return;
  }

  button.disabled = true;
  try {
    const result = await deleteJson(`/api/businesses/${encodeURIComponent(businessRef)}/message-templates/${encodeURIComponent(templateId)}`);
    state.messageComposer.templateId = result.fallback?.id || `default_${type}`;
    state.messageComposer.preview = null;
    state.messageComposer.feedback = "Plantilla base restaurada.";
    await loadMessageTemplates(businessRef, { render: true });
    showNotice("Plantilla base restaurada.", "info");
  } catch (error) {
    state.messageComposer.feedback = error.message || "No se pudo restaurar la plantilla base.";
    showNotice(state.messageComposer.feedback, "error");
    render();
  }
}

function startMessageForContact(contactId, options = {}) {
  const contact = state.contacts.find((item) => item.id === contactId);

  if (!contact) {
    showNotice("No se encontro el contacto para preparar el mensaje.", "error");
    return;
  }

  if (options.closeDialog) {
    closeContactTimeline();
  }

  state.messageComposer = {
    contactId,
    templateId: state.messageComposer.templateId || state.messageTemplates[0]?.id || "",
    preview: null,
    feedback: `Preparando un mensaje para ${contactName(contact)}.`
  };
  setActiveTab("messages");
  render();
  window.requestAnimationFrame(() => {
    document.querySelector('[data-message-render-form] select[name="templateId"]')?.focus({ preventScroll: true });
    document.querySelector(".message-compose")?.scrollIntoView({ block: "start", behavior: "auto" });
  });
}

async function copyTextToClipboard(value) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

async function openContactTimeline(contactId) {
  const businessRef = state.business?.id || state.business?.slug || "";
  const contact = state.contacts.find((item) => item.id === contactId) || null;
  const requestSequence = ++state.timelineRequestSequence;

  if (!businessRef || !contact || !refs.contactTimelineDialog) {
    return;
  }

  refs.contactTimelineTitle.textContent = contactName(contact);
  if (refs.contactProposal) {
    refs.contactProposal.hidden = false;
    refs.contactProposal.dataset.contactId = contactId;
    refs.contactProposal.setAttribute("aria-label", `Crear propuesta para ${contactName(contact)}`);
  }
  if (refs.contactMessage) {
    refs.contactMessage.hidden = false;
    refs.contactMessage.dataset.contactId = contactId;
    refs.contactMessage.setAttribute("aria-label", `Preparar mensaje para ${contactName(contact)}`);
  }
  refs.contactTimelineMeta.textContent = [
    statusLabel(contact.status || "new"),
    contact.phone,
    contact.email
  ].filter(Boolean).join(" - ") || "Actividad comercial unificada";
  refs.contactTimelineContent.innerHTML = `
    <div class="contact-timeline-loading" role="status">
      <span aria-hidden="true"></span>
      <p>Cargando el historial completo...</p>
    </div>
  `;
  showContactTimelineDialog();

  try {
    const payload = await getJson(
      `/api/businesses/${encodeURIComponent(businessRef)}/contacts/${encodeURIComponent(contactId)}/timeline`
    );

    if (requestSequence !== state.timelineRequestSequence) {
      return;
    }

    const timeline = Array.isArray(payload) ? payload : (Array.isArray(payload.timeline) ? payload.timeline : []);
    refs.contactTimelineMeta.textContent = [
      statusLabel(contact.status || "new"),
      `${timeline.length} hito${timeline.length === 1 ? "" : "s"}`,
      contact.phone,
      contact.email
    ].filter(Boolean).join(" - ");
    refs.contactTimelineContent.innerHTML = renderContactTimeline(timeline);
  } catch (error) {
    if (requestSequence !== state.timelineRequestSequence) {
      return;
    }

    refs.contactTimelineContent.innerHTML = `
      <section class="contact-timeline-empty" role="alert">
        <strong>No se pudo cargar el historial</strong>
        <p>Comprueba la conexion con la API y vuelve a intentarlo.</p>
        <button type="button" data-contact-timeline-retry>Reintentar</button>
      </section>
    `;
    refs.contactTimelineContent.querySelector("[data-contact-timeline-retry]")?.addEventListener("click", () => {
      openContactTimeline(contactId);
    });
  }
}

function showContactTimelineDialog() {
  const dialog = refs.contactTimelineDialog;

  if (!dialog) {
    return;
  }

  if (typeof dialog.showModal === "function") {
    if (!dialog.open) {
      dialog.showModal();
    }
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeContactTimeline() {
  const dialog = refs.contactTimelineDialog;
  state.timelineRequestSequence += 1;

  if (refs.contactProposal) {
    refs.contactProposal.hidden = true;
    refs.contactProposal.dataset.contactId = "";
    refs.contactProposal.removeAttribute("aria-label");
  }
  if (refs.contactMessage) {
    refs.contactMessage.hidden = true;
    refs.contactMessage.dataset.contactId = "";
    refs.contactMessage.removeAttribute("aria-label");
  }

  if (!dialog) {
    return;
  }

  if (typeof dialog.close === "function" && dialog.open) {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

function renderContactTimeline(timeline) {
  if (!timeline.length) {
    return `
      <section class="contact-timeline-empty">
        <strong>Sin actividad registrada</strong>
        <p>Las notas, reservas, pedidos, mensajes y cambios comerciales apareceran aqui.</p>
      </section>
    `;
  }

  return `
    <ol class="contact-timeline-list">
      ${timeline.map((item) => renderContactTimelineItem(item)).join("")}
    </ol>
  `;
}

function renderContactTimelineItem(item) {
  const type = clean(item?.type || "activity");
  const date = clean(item?.date || "");
  const summary = clean(item?.summary || "Actividad registrada");
  const category = timelineCategory(type);

  return `
    <li class="contact-timeline-item" data-timeline-category="${escapeAttr(category)}">
      <span class="contact-timeline-marker" aria-hidden="true"></span>
      <article>
        <header>
          <strong>${escapeHtml(statusLabel(type))}</strong>
          <time datetime="${escapeAttr(date)}">${escapeHtml(formatDateTime(date))}</time>
        </header>
        <p>${escapeHtml(summary)}</p>
      </article>
    </li>
  `;
}

function timelineCategory(type) {
  const value = String(type || "").toLowerCase();

  if (value.includes("booking") || value.includes("reserva")) return "booking";
  if (value.includes("order") || value.includes("pedido") || value.includes("store")) return "order";
  if (value.includes("chatbot") || value.includes("message")) return "chatbot";
  if (value.includes("status") || value.includes("lost") || value.includes("won")) return "status";
  if (value.includes("next_action") || value.includes("task") || value.includes("reminder")) return "action";
  if (value.includes("note") || value.includes("activity") || value.includes("lead") || value.includes("contact")) return "note";
  return "event";
}

function bindPipelineControls(model) {
  const pipeline = model?.pipeline || buildPipelineModel(state.contacts);

  document.querySelectorAll("[data-lead-card]").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      const contactId = card.dataset.contactId || "";

      if (!contactId || event.target.closest("button, input, select, textarea, label, form")) {
        event.preventDefault();
        return;
      }

      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", contactId);
    });

    card.addEventListener("dragend", () => {
      document.querySelectorAll(".is-dragging, .is-drag-over").forEach((node) => {
        node.classList.remove("is-dragging", "is-drag-over");
      });
    });
  });

  document.querySelectorAll("[data-pipeline-dropzone]").forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      zone.classList.add("is-drag-over");
    });

    zone.addEventListener("dragleave", (event) => {
      if (!zone.contains(event.relatedTarget)) {
        zone.classList.remove("is-drag-over");
      }
    });

    zone.addEventListener("drop", async (event) => {
      event.preventDefault();
      zone.classList.remove("is-drag-over");

      const contactId = event.dataTransfer.getData("text/plain");
      const status = normalizeLeadStatus(zone.dataset.status || "new");

      if (!contactId || !state.business) {
        return;
      }

      const order = calculatePipelineOrder(pipeline, contactId, status, zone, event.clientY);
      await moveContactInPipeline(contactId, status, order);
    });
  });
}

function calculatePipelineOrder(pipeline, contactId, status, zone, clientY) {
  const column = (pipeline.columns.find((item) => item.status === status)?.contacts || [])
    .filter((contact) => contact.id !== contactId)
    .sort(comparePipelineContacts);
  const afterCard = getDropAfterCard(zone, clientY);

  if (afterCard) {
    const afterIndex = column.findIndex((contact) => contact.id === afterCard.dataset.contactId);
    const next = column[afterIndex] || null;
    const previous = afterIndex > 0 ? column[afterIndex - 1] : null;
    return midpointOrder(previous?.order, next?.order);
  }

  return midpointOrder(column.at(-1)?.order, null);
}

function getDropAfterCard(zone, clientY) {
  return Array.from(zone.querySelectorAll("[data-lead-card]:not(.is-dragging)"))
    .find((card) => {
      const box = card.getBoundingClientRect();
      return clientY < box.top + (box.height / 2);
    }) || null;
}

function midpointOrder(previous, next) {
  const previousOrder = Number(previous);
  const nextOrder = Number(next);

  if (Number.isFinite(previousOrder) && Number.isFinite(nextOrder)) {
    return previousOrder === nextOrder ? nextOrder - 0.5 : previousOrder + ((nextOrder - previousOrder) / 2);
  }

  if (Number.isFinite(nextOrder)) {
    return nextOrder - 1;
  }

  if (Number.isFinite(previousOrder)) {
    return previousOrder + 1;
  }

  return Date.now();
}

async function moveContactInPipeline(contactId, status, order) {
  const businessRef = state.business?.id || state.business?.slug || "";
  const previous = state.contacts.find((contact) => contact.id === contactId);

  if (!businessRef || !previous) {
    return;
  }

  const lostReason = await requestLostReasonForTransition(previous, status);

  if (lostReason === null) {
    return;
  }

  try {
    const payload = lostReason ? { status, order, lostReason } : { status, order };
    const result = await patchJson(
      `/api/businesses/${encodeURIComponent(businessRef)}/contacts/${encodeURIComponent(contactId)}/pipeline`,
      payload
    );
    mergeContactResult(contactId, result.contact, result.activity);
    showNotice(previous.status === status ? "Orden del pipeline actualizado." : `Lead movido a ${statusLabel(status)}.`, "info");
    render();
  } catch (error) {
    showNotice("No se pudo mover el lead en el pipeline.", "error");
  }
}

function mergeContactResult(contactId, updatedContact, activity) {
  state.contacts = state.contacts.map((contact) => {
    if (contact.id !== contactId) {
      return contact;
    }

    const activities = activity
      ? [activity, ...(contact.activities || [])]
      : (updatedContact?.activities || contact.activities || []);
    const timeline = activity
      ? [activityToTimelineItem(activity), ...(contact.timeline || [])]
      : (updatedContact?.timeline || contact.timeline || []);

    return normalizePipelineContact({
      ...contact,
      ...updatedContact,
      activities,
      timeline
    });
  });
  state.pipeline = buildPipelineModel(state.contacts);
}

async function requestLostReasonForTransition(contact, status) {
  const normalizedStatus = normalizeLeadStatus(status);

  if (normalizedStatus !== "lost" || normalizeLeadStatus(contact?.status) === "lost") {
    return "";
  }

  return showLostReasonDialog(contact);
}

function showLostReasonDialog(contact) {
  if (typeof HTMLDialogElement === "undefined" || typeof document.createElement("dialog").showModal !== "function") {
    const value = window.prompt(`Motivo de perdida para ${contactName(contact)}: precio, no_responde, ya_tiene_proveedor, fuera_de_zona, pospuesto, no_encaja, competencia`) || "";
    const reason = normalizeLostReason(value);
    return Promise.resolve(reason || null);
  }

  return new Promise((resolve) => {
    const dialog = document.createElement("dialog");
    dialog.className = "lost-reason-dialog";
    dialog.innerHTML = `
      <form method="dialog">
        <header>
          <strong>${escapeHtml(contactName(contact))}</strong>
          <button type="button" value="cancel" aria-label="Cerrar" data-lost-reason-cancel>x</button>
        </header>
        <label>
          Motivo
          <select name="lostReason" required>
            <option value="">Seleccionar</option>
            ${LOST_REASONS.map((reason) => `<option value="${escapeAttr(reason)}">${escapeHtml(lostReasonLabel(reason))}</option>`).join("")}
          </select>
        </label>
        <menu>
          <button type="button" data-lost-reason-cancel>Cancelar</button>
          <button type="submit" value="confirm">Confirmar</button>
        </menu>
      </form>
    `;

    const form = dialog.querySelector("form");
    const select = dialog.querySelector("select");
    const close = (value) => {
      dialog.close(value || "");
    };

    dialog.querySelectorAll("[data-lost-reason-cancel]").forEach((button) => {
      button.addEventListener("click", () => close("cancel"));
    });

    form?.addEventListener("submit", (event) => {
      const reason = normalizeLostReason(select?.value || "");

      if (!reason) {
        event.preventDefault();
        select?.focus();
        return;
      }
    });

    dialog.addEventListener("close", () => {
      const reason = normalizeLostReason(select?.value || "");
      const confirmed = dialog.returnValue === "confirm" && reason;
      dialog.remove();
      resolve(confirmed ? reason : null);
    });

    document.body.append(dialog);
    dialog.showModal();
    select?.focus();
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
        const synced = await syncBookingToGoogle(bookingId);
        showNotice(synced ? "Reserva actualizada y sincronizada con Google Calendar." : "Reserva actualizada.", "info");
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
          ? state.contacts.map((contact) => contact.id === result.contact.id ? normalizePipelineContact({ ...contact, ...result.contact }) : contact)
          : [normalizePipelineContact(result.contact), ...state.contacts];
        state.pipeline = buildPipelineModel(state.contacts);
      }
      const synced = await syncBookingToGoogle(result.booking.id);
      showNotice(synced ? "Reserva creada, vinculada al CRM y sincronizada con Google Calendar." : "Reserva creada y vinculada al CRM.", "info");
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

function bindGoogleControls() {
  if (state.clientSession) {
    return;
  }

  document.querySelectorAll("[data-google-connect]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!state.business) {
        return;
      }

      button.disabled = true;

      try {
        const features = button.dataset.googleConnect || "calendar";
        const result = await getJson(`/api/google/oauth/start?businessId=${encodeURIComponent(state.business.id)}&features=${encodeURIComponent(features)}`);
        window.open(result.authorizationUrl, "locallift-google-oauth", "popup,width=680,height=760");
        showNotice("Completa el consentimiento de Google en la ventana abierta y despues actualiza el estado.", "info");
      } catch (error) {
        showNotice(error.message || "No se pudo iniciar la conexion con Google.", "error");
        button.disabled = false;
      }
    });
  });

  document.querySelector("[data-google-refresh]")?.addEventListener("click", async (event) => {
    event.currentTarget.disabled = true;
    await loadGoogle(state.business?.id || "");
    render();
    showNotice("Estado Google actualizado.", "info");
  });

  document.querySelector("[data-google-diagnostics]")?.addEventListener("click", async (event) => {
    if (!state.business) {
      return;
    }

    const button = event.currentTarget;
    button.disabled = true;

    try {
      state.googleDiagnostics = await getJson(`/api/businesses/${encodeURIComponent(state.business.id)}/google/diagnostics`);
      render();
      showNotice(state.googleDiagnostics.ok ? "Todas las conexiones Google disponibles responden." : "Diagnostico Google completado con conexiones pendientes.", state.googleDiagnostics.ok ? "info" : "warn");
    } catch (error) {
      showNotice(error.message || "No se pudo ejecutar el diagnostico Google.", "error");
      button.disabled = false;
    }
  });

  document.querySelector("[data-google-sync-place]")?.addEventListener("click", async (event) => {
    if (!state.business) {
      return;
    }

    const button = event.currentTarget;
    button.disabled = true;

    try {
      await postJson(`/api/businesses/${encodeURIComponent(state.business.id)}/google/place/sync`, { applyToBusiness: false });
      await loadGoogle(state.business.id);
      render();
      showNotice("Datos publicos de Places sincronizados.", "info");
    } catch (error) {
      showNotice(error.message || "No se pudo sincronizar Places.", "error");
      button.disabled = false;
    }
  });

  document.querySelector("[data-google-disconnect]")?.addEventListener("click", async (event) => {
    if (!state.business || !window.confirm("Se eliminara la conexion OAuth cifrada de este negocio. Continuar?")) {
      return;
    }

    const button = event.currentTarget;
    button.disabled = true;

    try {
      await postJson(`/api/businesses/${encodeURIComponent(state.business.id)}/google/disconnect`, {});
      await loadGoogle(state.business.id);
      render();
      showNotice("Conexion OAuth de Google eliminada.", "info");
    } catch (error) {
      showNotice("No se pudo desconectar Google.", "error");
      button.disabled = false;
    }
  });

  document.querySelectorAll("[data-google-booking-sync]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const synced = await syncBookingToGoogle(button.dataset.bookingId || "", { notifyFailure: true });
      if (synced) {
        showNotice("Reserva sincronizada con Google Calendar.", "info");
        render();
      } else {
        button.disabled = false;
      }
    });
  });
}

async function syncBookingToGoogle(bookingId, options = {}) {
  if (!bookingId || !state.business || !state.googleStatus?.connected?.calendar) {
    return false;
  }

  try {
    const result = await postJson(
      `/api/businesses/${encodeURIComponent(state.business.id)}/google/calendar/sync-booking/${encodeURIComponent(bookingId)}`,
      {}
    );
    state.bookings = state.bookings.map((booking) => booking.id === bookingId ? result.booking : booking);
    return true;
  } catch (error) {
    if (options.notifyFailure) {
      showNotice(error.message || "La reserva se guardo localmente, pero Calendar no pudo sincronizarla.", "error");
    }
    return false;
  }
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
  const googleSync = state.googleStatus?.connected?.calendar
    ? `<button class="inline-action" type="button" data-google-booking-sync data-booking-id="${escapeAttr(booking.id)}">${booking.google?.eventId ? "Actualizar Google Calendar" : "Enviar a Google Calendar"}</button>`
    : "";

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
      ${googleSync}
    </article>
  `;
}

function renderLeadCard(lead) {
  const activities = Array.isArray(lead.activities) ? lead.activities.slice(0, 2) : [];
  const timelinePreview = activities.map(activityToTimelineItem);
  const contact = [lead.phone, lead.email].filter(Boolean).join(" / ") || "Sin contacto";
  const notes = clean(lead.notes || "");
  const lostReason = normalizeLostReason(lead.lostReason);
  const valueEstimate = Number(lead.valueEstimate || 0);

  return `
    <article class="lead-card" draggable="true" data-lead-card data-contact-id="${escapeAttr(lead.id)}" data-status="${escapeAttr(lead.status || "new")}" data-order="${escapeAttr(lead.order ?? "")}">
      <header>
        <strong>${escapeHtml(contactName(lead))}</strong>
        <div class="lead-card-badges">
          ${scorePill(lead)}
          ${priorityPill(lead.priority)}
        </div>
      </header>
      <div class="lead-card-meta">
        <span>${escapeHtml(clean(lead.source || "web"))}</span>
        <strong>${escapeHtml(formatMoney(valueEstimate, state.business?.content?.commerce?.currency || state.business?.content?.currency || "EUR"))}</strong>
      </div>
      <p>${escapeHtml(contact)}</p>
      ${renderNextActionChip(lead.nextAction)}
      ${normalizeLeadStatus(lead.status) === "lost" && lostReason ? `<span class="lost-reason-chip">Motivo: ${escapeHtml(lostReasonLabel(lostReason))}</span>` : ""}
      ${notes ? `<p>${escapeHtml(notes)}</p>` : ""}
      ${renderNextActionForm(lead)}
      <label class="status-field">
        Estado
        <select data-contact-status data-contact-id="${escapeAttr(lead.id)}">
          ${LEAD_STATUSES.map((status) => `<option value="${escapeAttr(status)}"${String(lead.status || "new") === status ? " selected" : ""}>${escapeHtml(statusLabel(status))}</option>`).join("")}
        </select>
      </label>
      <div class="activity-trail">
        ${timelinePreview.length
          ? timelinePreview.map((item) => renderTimelineItem(item)).join("")
          : "<span>Sin historial todavia</span>"}
      </div>
      <div class="lead-card-actions">
        ${lead.id && state.contacts.some((contact) => contact.id === lead.id) ? `
          <button class="message-contact-button" type="button" data-prepare-message-for-contact data-contact-id="${escapeAttr(lead.id)}" draggable="false">
            Preparar mensaje
          </button>
          <button class="proposal-contact-button" type="button" data-create-proposal-for-contact data-contact-id="${escapeAttr(lead.id)}" draggable="false">
            Crear propuesta
          </button>
        ` : ""}
        <button class="timeline-open-button" type="button" data-contact-timeline data-contact-id="${escapeAttr(lead.id)}" aria-haspopup="dialog" draggable="false">
          <span>Ver ficha completa</span>
          <span aria-hidden="true">&rarr;</span>
        </button>
      </div>
      <form class="note-form" data-contact-note-form data-contact-id="${escapeAttr(lead.id)}">
        <input name="note" type="text" placeholder="Nota o tarea rapida">
        <button type="submit">Guardar</button>
      </form>
    </article>
  `;
}

function renderTimelineItem(item) {
  const title = statusLabel(item.type || "activity");
  const date = formatDate(item.date || item.createdAt);
  const detail = clean(item.summary || item.title || item.note || "");

  return `<span><strong>${escapeHtml(title)}</strong> - ${escapeHtml(date)}${detail ? ` - ${escapeHtml(detail)}` : ""}</span>`;
}

function activityToTimelineItem(activity) {
  const lostReason = normalizeLostReason(activity?.metadata?.lostReason || "");
  const detail = clean(activity?.note || "") || (lostReason ? `Motivo: ${lostReasonLabel(lostReason)}` : "");

  return {
    type: activity?.type || "activity",
    date: activity?.createdAt || "",
    summary: [activity?.title || "", detail].filter(Boolean).join(": "),
    refId: activity?.id || ""
  };
}

function renderNextActionForm(lead) {
  const nextAction = lead.nextAction || null;
  const type = nextAction?.type || "llamada";
  const dueDate = dateInputValue(nextAction?.dueDate) || dateInputValue(new Date());
  const note = nextAction?.note || "";

  return `
    <div class="next-action-controls">
      <form class="next-action-form" data-next-action-form data-contact-id="${escapeAttr(lead.id)}">
        <label>
          Accion
          <select name="type">
            ${NEXT_ACTION_TYPES.map((item) => `<option value="${escapeAttr(item)}"${item === type ? " selected" : ""}>${escapeHtml(nextActionTypeLabel(item))}</option>`).join("")}
          </select>
        </label>
        <label>
          Fecha
          <input name="dueDate" type="date" value="${escapeAttr(dueDate)}" required>
        </label>
        <input name="note" type="text" value="${escapeAttr(note)}" placeholder="Nota breve">
        <button type="submit">Guardar</button>
      </form>
      ${nextAction ? `<button class="next-action-done" type="button" data-next-action-done data-contact-id="${escapeAttr(lead.id)}">Marcar hecha</button>` : ""}
    </div>
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
    "Motivo perdida": lostReasonLabel(contact.lostReason),
    Score: normalizeLeadScore(contact.score),
    Temperatura: scoreLabel(contact.scoreLabel),
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

function priorityPill(priority) {
  const normalized = normalizeLeadPriority(priority);
  const labels = {
    alta: "Alta",
    media: "Media",
    baja: "Baja"
  };

  return `<span class="pill priority-${escapeHtml(normalized)}">${escapeHtml(labels[normalized] || "Media")}</span>`;
}

function scorePill(contact) {
  const label = normalizeLeadScoreLabel(contact?.scoreLabel, normalizeLeadStatus(contact?.status) === "lost" ? "perdido" : "frio");
  const score = normalizeLeadScore(contact?.score);

  return `<span class="pill score-${escapeHtml(label)}">${escapeHtml(`${scoreLabel(label)} ${score}`)}</span>`;
}

function renderLeadScoreFilter(total, filtered) {
  const selected = normalizeScoreFilter(state.scoreLabelFilter);

  return `
    <div class="lead-filter-toolbar">
      <span>${escapeHtml(selected === "all" ? `${total} lead(s)` : `${filtered} de ${total} lead(s)`)}</span>
      <label>
        Temperatura
        <select data-score-label-filter>
          <option value="all"${selected === "all" ? " selected" : ""}>Todos</option>
          ${LEAD_SCORE_LABELS.map((label) => `<option value="${escapeAttr(label)}"${selected === label ? " selected" : ""}>${escapeHtml(scoreLabel(label))}</option>`).join("")}
        </select>
      </label>
    </div>
  `;
}

function renderNextActionChip(nextAction) {
  if (!nextAction || typeof nextAction !== "object") {
    return '<span class="next-action-chip is-empty">Sin proxima accion</span>';
  }

  const status = nextActionStatus(nextAction);
  const type = nextActionTypeLabel(nextAction.type);
  const date = nextAction.dueDate ? formatDate(nextAction.dueDate) : "Sin fecha";

  return `<span class="next-action-chip ${escapeHtml(status)}">${escapeHtml(`${type} - ${date}`)}</span>`;
}

function nextActionStatus(nextAction) {
  const status = clean(nextAction.status).toLowerCase();

  if (status === "hecha") {
    return "done";
  }

  if (status === "vencida") {
    return "overdue";
  }

  const due = parseDate(nextAction.dueDate);
  if (due && due < startOfToday()) {
    return "overdue";
  }

  return "pending";
}

function nextActionTypeLabel(value) {
  const labels = {
    llamada: "Llamada",
    whatsapp: "WhatsApp",
    email: "Email",
    reunion: "Reunion",
    enviar_propuesta: "Enviar propuesta",
    revisar_reserva: "Revisar reserva"
  };

  return labels[clean(value)] || statusLabel(value || "accion");
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
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

function emptyNextActions() {
  return {
    today: [],
    overdue: [],
    missing: []
  };
}

function normalizeNextActionsModel(value) {
  const source = value && typeof value === "object" ? value : {};

  return {
    today: Array.isArray(source.today) ? source.today : [],
    overdue: Array.isArray(source.overdue) ? source.overdue : [],
    missing: Array.isArray(source.missing) ? source.missing : []
  };
}

function normalizePipelinePayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const sourceColumns = Array.isArray(source.columns)
    ? source.columns
    : LEAD_STATUSES.map((status) => source.pipeline?.[status]).filter(Boolean);
  const byStatus = new Map(sourceColumns.map((column) => [normalizeLeadStatus(column.status), column]));
  const columns = LEAD_STATUSES.map((status) => {
    const column = byStatus.get(status) || {};
    const contacts = Array.isArray(column.contacts)
      ? column.contacts.map((contact) => normalizePipelineContact(contact, status)).sort(comparePipelineContacts)
      : [];
    const totalValueEstimate = Number.isFinite(Number(column.totalValueEstimate))
      ? Number(column.totalValueEstimate)
      : contacts.reduce((sum, contact) => sum + Number(contact.valueEstimate || 0), 0);

    return {
      status,
      count: Number.isFinite(Number(column.count)) ? Number(column.count) : contacts.length,
      totalValueEstimate,
      contacts
    };
  });

  return {
    statuses: LEAD_STATUSES,
    columns,
    total: columns.reduce((sum, column) => sum + column.contacts.length, 0),
    totalValueEstimate: columns.reduce((sum, column) => sum + Number(column.totalValueEstimate || 0), 0)
  };
}

function buildPipelineModel(contacts = []) {
  return normalizePipelinePayload({
    columns: LEAD_STATUSES.map((status) => {
      const columnContacts = contacts
        .map((contact) => normalizePipelineContact(contact))
        .filter((contact) => contact.status === status)
        .sort(comparePipelineContacts);

      return {
        status,
        count: columnContacts.length,
        totalValueEstimate: columnContacts.reduce((sum, contact) => sum + Number(contact.valueEstimate || 0), 0),
        contacts: columnContacts
      };
    })
  });
}

function flattenPipelineContacts(pipeline) {
  return normalizePipelinePayload(pipeline).columns.flatMap((column) => column.contacts);
}

function normalizePipelineContact(contact, fallbackStatus = "new") {
  const source = contact && typeof contact === "object" ? contact : {};
  const status = normalizeLeadStatus(source.status || fallbackStatus);

  return {
    ...source,
    status,
    lostReason: status === "lost" ? normalizeLostReason(source.lostReason) : "",
    priority: normalizeLeadPriority(source.priority),
    score: normalizeLeadScore(source.score),
    scoreLabel: normalizeLeadScoreLabel(source.scoreLabel, status === "lost" ? "perdido" : "frio"),
    order: normalizeLeadOrder(source.order, fallbackLeadOrder(source))
  };
}

function filterLeadsByScore(leads) {
  const filter = normalizeScoreFilter(state.scoreLabelFilter);

  if (filter === "all") {
    return leads;
  }

  return leads.filter((lead) => normalizeLeadScoreLabel(lead.scoreLabel, normalizeLeadStatus(lead.status) === "lost" ? "perdido" : "frio") === filter);
}

function normalizeLeadStatus(value) {
  const status = clean(value).toLowerCase();
  const aliases = {
    nuevo: "new",
    contactado: "contacted",
    "esperando respuesta": "waiting",
    reservado: "reserved",
    ganada: "won",
    ganado: "won",
    perdida: "lost",
    perdido: "lost",
    cliente: "customer"
  };
  const normalized = aliases[status] || status || "new";
  return LEAD_STATUSES.includes(normalized) ? normalized : "new";
}

function normalizeLeadPriority(value) {
  const priority = clean(value).toLowerCase();
  const aliases = {
    high: "alta",
    medium: "media",
    low: "baja"
  };
  const normalized = aliases[priority] || priority || "media";
  return LEAD_PRIORITIES.includes(normalized) ? normalized : "media";
}

function normalizeLostReason(value) {
  const reason = clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const aliases = {
    "no responde": "no_responde",
    "ya tiene proveedor": "ya_tiene_proveedor",
    "fuera de zona": "fuera_de_zona",
    "no encaja": "no_encaja"
  };
  const normalized = aliases[reason] || reason;
  return LOST_REASONS.includes(normalized) ? normalized : "";
}

function lostReasonLabel(value) {
  const labels = {
    precio: "Precio",
    no_responde: "No responde",
    ya_tiene_proveedor: "Ya tiene proveedor",
    fuera_de_zona: "Fuera de zona",
    pospuesto: "Pospuesto",
    no_encaja: "No encaja",
    competencia: "Competencia"
  };

  return labels[normalizeLostReason(value)] || "";
}

function normalizeScoreFilter(value) {
  const label = normalizeLeadScoreLabel(value, "all");
  return label === "all" || LEAD_SCORE_LABELS.includes(label) ? label : "all";
}

function normalizeLeadScoreLabel(value, fallback = "frio") {
  const label = clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (LEAD_SCORE_LABELS.includes(label) || label === "all") {
    return label;
  }

  return fallback;
}

function normalizeLeadScore(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.min(100, Math.max(0, Math.round(number)));
}

function normalizeLeadOrder(value, fallback = 0) {
  const number = Number(value);

  if (Number.isFinite(number)) {
    return number;
  }

  const fallbackNumber = Number(fallback);
  return Number.isFinite(fallbackNumber) ? fallbackNumber : 0;
}

function fallbackLeadOrder(contact) {
  const parsed = Date.parse(contact?.createdAt || contact?.updatedAt || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function comparePipelineContacts(left, right) {
  const order = normalizeLeadOrder(left.order, fallbackLeadOrder(left)) - normalizeLeadOrder(right.order, fallbackLeadOrder(right));

  if (Math.abs(order) > Number.EPSILON) {
    return order;
  }

  return String(left.createdAt || "").localeCompare(String(right.createdAt || ""));
}

function contactName(contact) {
  return clean(contact.name || contact.fullName || contact.customerName || contact.email || contact.phone || "Contacto sin nombre");
}

function dateInputValue(value) {
  const parsed = value instanceof Date ? value : parseDate(value);

  if (!parsed) {
    return "";
  }

  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
}

function dateInputToIso(value) {
  const text = clean(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return "";
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0).toISOString();
}

function dateInputToEndOfDayIso(value) {
  const text = clean(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);

  if (!match) {
    return "";
  }

  const [, year, month, day] = match;
  return new Date(Number(year), Number(month) - 1, Number(day), 23, 59, 59, 999).toISOString();
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

function normalizeInboxStaleDays(value) {
  const days = Number(value);
  return Number.isInteger(days) && days >= 1 && days <= 3650 ? days : 30;
}

function inboxWholeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function formatInboxDate(value, timezone) {
  return formatInboxTemporal(value, timezone, { day: "2-digit", month: "short", year: "numeric" });
}

function formatInboxDateTime(value, timezone) {
  return formatInboxTemporal(value, timezone, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatInboxTime(value, timezone) {
  return formatInboxTemporal(value, timezone, { hour: "2-digit", minute: "2-digit" });
}

function formatInboxTemporal(value, timezone, options) {
  const parsed = parseDate(value);
  if (!parsed) {
    return "-";
  }

  const candidate = clean(timezone);
  try {
    return new Intl.DateTimeFormat("es-ES", {
      ...options,
      ...(candidate ? { timeZone: candidate } : {})
    }).format(parsed);
  } catch {
    return new Intl.DateTimeFormat("es-ES", options).format(parsed);
  }
}

function safeHttpUrl(value) {
  const text = clean(value);
  if (!text) {
    return "";
  }

  try {
    const url = new URL(text, window.location.origin);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
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

function normalizeForecastMonth(value) {
  const month = clean(value);
  return /^[1-9]\d{3}-(?:0[1-9]|1[0-2])$/.test(month) ? month : currentMonthKey();
}

function formatForecastMonth(value) {
  const month = normalizeForecastMonth(value);
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function forecastWholeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function forecastNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function forecastProbability(value) {
  return Math.min(1, forecastNumber(value));
}

function formatForecastProbability(value) {
  return new Intl.NumberFormat("es-ES", {
    style: "percent",
    maximumFractionDigits: 1
  }).format(forecastProbability(value));
}

function forecastCurrency(value, fallback) {
  const candidates = [value, fallback, "EUR"]
    .map((candidate) => clean(candidate).toUpperCase())
    .filter((candidate) => /^[A-Z]{3}$/.test(candidate));

  return candidates.find((candidate) => {
    try {
      new Intl.NumberFormat("es-ES", { style: "currency", currency: candidate }).format(0);
      return true;
    } catch {
      return false;
    }
  }) || "EUR";
}

function formatForecastMoney(value, currency) {
  return formatMoney(forecastNumber(value), forecastCurrency(currency, "EUR"));
}

function normalizeSlaHours(value) {
  const hours = Number(value);
  return isValidSlaHours(hours)
    ? Math.round(hours * 100) / 100
    : 24;
}

function isValidSlaHours(value) {
  return Number.isFinite(value) && value > 0 && value <= 24 * 90;
}

function slaWholeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.trunc(number)) : 0;
}

function formatSlaThreshold(value) {
  const hours = normalizeSlaHours(value);
  const label = new Intl.NumberFormat("es-ES", {
    maximumFractionDigits: 2
  }).format(hours);
  return `${label} h`;
}

function formatSlaDuration(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes < 0) {
    return "--";
  }

  const rounded = Math.round(minutes);
  if (rounded < 60) {
    return `${rounded} min`;
  }

  const days = Math.floor(rounded / (24 * 60));
  const remainingMinutes = rounded % (24 * 60);
  const hours = Math.floor(remainingMinutes / 60);
  const restMinutes = remainingMinutes % 60;

  if (days) {
    return `${days} d${hours ? ` ${hours} h` : ""}`;
  }

  return `${hours} h${restMinutes ? ` ${restMinutes} min` : ""}`;
}

function formatSlaAge(value) {
  const hours = Number(value);
  return Number.isFinite(hours) && hours >= 0
    ? formatSlaDuration(hours * 60)
    : "--";
}

function formatSlaPercent(value) {
  const number = Number(value);
  const percent = Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0;
  return `${new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(percent)}%`;
}

function normalizeSlaDate(value) {
  const date = new Date(value || "");
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function formatSlaGeneratedAt(value) {
  const generatedAt = normalizeSlaDate(value);
  return generatedAt ? `Actualizado ${formatDateTime(generatedAt)}` : "Actualizacion reciente";
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
    pendiente: "Pendiente",
    hecha: "Hecha",
    vencida: "Vencida",
    llamada: "Llamada",
    reunion: "Reunion",
    enviar_propuesta: "Enviar propuesta",
    revisar_reserva: "Revisar reserva",
    pending: "Pendiente",
    activity: "Actividad",
    task: "Tarea",
    note: "Nota",
    order: "Pedido",
    booking: "Reserva",
    "booking.reminder": "Recordatorio",
    "booking.created": "Reserva creada",
    "booking.updated": "Reserva actualizada",
    "lead.created": "Lead creado",
    "lead.updated": "Lead actualizado",
    "contact.created": "Lead creado",
    "contact.updated": "Lead actualizado",
    "contact.merged": "Contactos fusionados",
    "contact.status_changed": "Cambio de estado",
    "next_action.created": "Proxima accion",
    "next_action.completed": "Accion completada",
    borrador: "Borrador",
    enviada: "Enviada",
    vista: "Vista",
    aceptada: "Aceptada",
    rechazada: "Rechazada",
    caducada: "Caducada",
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
    chatbot_prompt: "Opcion del chatbot",
    chatbot_message: "Mensaje chatbot",
    chatbot_lead_captured: "Lead chatbot",
    store_add_to_cart: "Producto al carrito",
    store_checkout_start: "Inicio de compra",
    google_maps_click: "Click mapa",
    google_review_click: "Click resena",
    caliente: "Caliente",
    templado: "Templado",
    frio: "Frio",
    perdido: "Perdido",
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

function scoreLabel(value) {
  return statusLabel(normalizeLeadScoreLabel(value));
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
