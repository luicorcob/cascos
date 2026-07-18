const pageParams = new URLSearchParams(window.location.search);
const isDedicatedClientWorkspace = document.body?.dataset.dashboardScope === "client";
const isDeveloperPreview = isDedicatedClientWorkspace
  && (pageParams.get("preview") === "developer" || pageParams.get("adminPreview") === "1");
const requestedBusinessName = String(pageParams.get("businessName") || "").trim();

const state = {
  activeTab: "inbox",
  calendarWeekOffset: 0,
  businesses: [],
  business: null,
  contacts: [],
  pipeline: null,
  accounts: [],
  accountDuplicateGroups: [],
  accountLoading: false,
  accountError: "",
  pipelines: [],
  deals: [],
  dealPipeline: null,
  dealPipelineId: "",
  dealLoading: false,
  dealError: "",
  scoreLabelFilter: "all",
  duplicateGroups: [],
  proposals: [],
  proposalLoading: false,
  proposalError: "",
  proposalFeedback: { type: "", message: "" },
  proposalDraftContactId: "",
  proposalShareLinks: {},
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
  taskQueues: emptyTaskQueues(),
  taskMembers: [],
  taskOwnerId: "",
  taskLoading: false,
  taskError: "",
  consentCenter: { contactId: "", data: null, loading: false, error: "" },
  customer360: null,
  customer360Loading: false,
  customer360Error: "",
  customerSegmentFilter: "",
  customerSearch: "",
  services: [],
  bookings: [],
  availability: [],
  blocks: [],
  reminderQueue: [],
  bookingResources: [],
  bookingWaitlist: [],
  bookingResourceSummary: null,
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
  dataQuality: null,
  dataQualityLoading: false,
  dataQualityError: "",
  dataQualityRequestSequence: 0,
  inbox: null,
  inboxLoading: false,
  inboxError: "",
  inboxStaleDays: 30,
  inboxRequestSequence: 0,
  channelInbox: null,
  channelInboxLoading: false,
  channelInboxError: "",
  channelInboxRequestSequence: 0,
  channelFilter: "",
  channelStatusFilter: "open",
  channelSearch: "",
  channelSelectedConversationId: "",
  channelActorId: "",
  automationCenter: null,
  automationRuns: [],
  automationLoading: false,
  automationError: "",
  automationSelectedId: "",
  automationFeedback: "",
  automationRequestSequence: 0,
  campaignCenter: null,
  campaignLoading: false,
  campaignError: "",
  campaignSelectedId: "",
  campaignPreview: null,
  campaignFeedback: "",
  campaignRequestSequence: 0,
  googleStatus: null,
  googleDiagnostics: null,
  reputationCenter: null,
  reputationLoading: false,
  reputationError: "",
  reputationFeedback: "",
  reputationRequestSequence: 0,
  securityCenter: null,
  securityLoading: false,
  securityError: "",
  securityFeedback: "",
  moneyCenter: null,
  moneyLoading: false,
  moneyError: "",
  moneyFeedback: "",
  crmConfigCenter: null,
  crmConfigLoading: false,
  crmConfigError: "",
  crmConfigFeedback: "",
  loyaltyCenter: null,
  loyaltyLoading: false,
  loyaltyError: "",
  loyaltyFeedback: "",
  verticalOperationsCenter: null,
  verticalOperationsLoading: false,
  verticalOperationsError: "",
  verticalOperationsFeedback: "",
  intelligenceCenter: null,
  intelligenceLoading: false,
  intelligenceError: "",
  intelligenceFeedback: "",
  intelligenceQueryResult: null,
  apiBase: window.LocalLiftApi?.getBase?.() || "",
  adminToken: isDedicatedClientWorkspace && !isDeveloperPreview ? "" : (localStorage.getItem("locallift_admin_token") || ""),
  businessUserToken: isDedicatedClientWorkspace && !isDeveloperPreview ? "" : (localStorage.getItem("locallift_business_user_token") || ""),
  businessUserSession: null,
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
  refs.businessUserLoginForm = document.querySelector("[data-business-user-login-form]");
  refs.businessUserLogout = document.querySelector("[data-business-user-logout]");
  refs.businessUserSession = document.querySelector("[data-business-user-session]");
  refs.clientLogout = document.querySelector("[data-client-logout]");
  refs.clientAccessGate = document.querySelector("[data-client-access-gate]");
  refs.portalContext = document.querySelector("[data-portal-context]");
  refs.workspaceLabel = document.querySelector("[data-workspace-label]");
  refs.sideBrandBusiness = document.querySelector("[data-side-brand-business]");
  refs.notice = document.querySelector("[data-notice]");
  refs.sideBusiness = document.querySelector("[data-side-business]");
  refs.sideMeta = document.querySelector("[data-side-meta]");
  refs.sideStatus = document.querySelector("[data-side-status]");
  refs.pageTitle = document.querySelector("[data-page-title]");
  refs.pageSubtitle = document.querySelector("[data-page-subtitle]");
  refs.refresh = document.querySelector("[data-refresh]");
  refs.webLink = document.querySelector("[data-web-link]");
  refs.quickCreate = document.querySelector("[data-quick-create]");
  refs.todayList = document.querySelector("[data-today-list]");
  refs.healthList = document.querySelector("[data-health-list]");
  refs.contactTimelineDialog = document.querySelector("[data-contact-timeline-dialog]");
  refs.contactTimelineTitle = document.querySelector("[data-contact-timeline-title]");
  refs.contactTimelineMeta = document.querySelector("[data-contact-timeline-meta]");
  refs.contactTimelineContent = document.querySelector("[data-contact-timeline-content]");
  refs.contactTimelineClose = document.querySelector("[data-contact-timeline-close]");
  refs.contactProposal = document.querySelector("[data-contact-proposal]");
  refs.contactMessage = document.querySelector("[data-contact-message]");

  arrangeClientNavigation();
  applyPortalMode();
  if (isDedicatedClientWorkspace && !state.clientSession && !isDeveloperPreview) {
    showClientAccessGate();
    return;
  }
  bindUi();
  document.addEventListener("dls:commerce-updated", (event) => {
    if (!state.business || event.detail?.businessId !== state.business.id || !event.detail?.commerce) return;
    state.business.content = state.business.content && typeof state.business.content === "object"
      ? state.business.content
      : {};
    state.business.content.commerce = event.detail.commerce;
    render();
  });
  const requestedTab = new URLSearchParams(window.location.search).get("tab") || "";
  const validRequestedTab = Array.from(document.querySelectorAll("[data-tab]"))
    .some((button) => button.dataset.tab === requestedTab);
  setActiveTab(validRequestedTab ? requestedTab : (state.clientSession ? "home" : "inbox"));
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

  refs.businessUserLoginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(refs.businessUserLoginForm);
    try {
      const payload = await postJson("/api/business-users/login", {
        business: clean(form.get("business")),
        email: clean(form.get("email")),
        password: String(form.get("password") || "")
      });
      state.businessUserToken = payload.session?.token || "";
      state.businessUserSession = payload.session || null;
      if (!state.businessUserToken) {
        throw new Error("La API no devolvió una sesión válida.");
      }
      localStorage.setItem("locallift_business_user_token", state.businessUserToken);
      refs.businessUserLoginForm.reset();
      updateBusinessUserSessionLabel();
      showNotice(`Sesión iniciada como ${payload.session?.user?.name || payload.session?.user?.email || "usuario del equipo"}.`, "info");
      await loadBusinesses();
    } catch (error) {
      showNotice(error.message || "No se pudo iniciar la sesión del equipo.", "error");
    }
  });

  refs.businessUserLogout?.addEventListener("click", () => {
    state.businessUserToken = "";
    state.businessUserSession = null;
    localStorage.removeItem("locallift_business_user_token");
    updateBusinessUserSessionLabel();
    showNotice("Sesión del equipo cerrada.", "warn");
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

  updateBusinessUserSessionLabel();
}

function updateBusinessUserSessionLabel() {
  if (!refs.businessUserSession) {
    return;
  }
  const user = state.businessUserSession?.user;
  refs.businessUserSession.textContent = state.businessUserToken
    ? `Sesión activa${user ? `: ${user.name || user.email} · ${statusLabel(user.role)}` : ""}`
    : "Sin sesión de equipo";
}

function arrangeClientNavigation() {
  if (!isDedicatedClientWorkspace) {
    return;
  }
  const navigation = document.querySelector("[data-side-navigation]");
  const dlsNavigation = navigation?.querySelector("[data-dls-navigation]");
  const firstGroup = navigation?.querySelector(".nav-group");
  if (dlsNavigation && firstGroup && dlsNavigation !== firstGroup) {
    firstGroup.after(dlsNavigation);
  }
}

function applyPortalMode() {
  document.body.classList.toggle("is-client-portal", Boolean(state.clientSession) || isDedicatedClientWorkspace);
  document.body.classList.toggle("is-developer-preview", isDeveloperPreview);
  const initialBusinessName = state.clientSession?.businessName || requestedBusinessName;

  if (refs.clientLogout) {
    refs.clientLogout.hidden = !state.clientSession;
  }
  if (refs.portalContext) {
    refs.portalContext.textContent = isDeveloperPreview ? "DLS · Vista previa del cliente" : "DLS · Portal del cliente";
  }
  if (refs.workspaceLabel) {
    refs.workspaceLabel.textContent = isDeveloperPreview
      ? (initialBusinessName ? `Vista previa · ${initialBusinessName}` : "Vista del local desde Control DLS")
      : (initialBusinessName || "Área privada del negocio");
  }
  if (initialBusinessName && refs.sideBrandBusiness) {
    refs.sideBrandBusiness.textContent = initialBusinessName;
  }
  if (initialBusinessName && refs.sideBusiness) {
    refs.sideBusiness.textContent = initialBusinessName;
  }
  if (initialBusinessName && refs.sideMeta) {
    refs.sideMeta.textContent = isDeveloperPreview
      ? "Vista previa abierta desde Control DLS"
      : "Negocio de tu sesión";
  }
}

function showClientAccessGate() {
  document.body.classList.add("is-access-locked");
  if (refs.clientAccessGate) {
    refs.clientAccessGate.hidden = false;
  }
  if (refs.pageTitle) {
    refs.pageTitle.textContent = "Portal del cliente";
  }
  if (refs.pageSubtitle) {
    refs.pageSubtitle.textContent = "Acceso privado para gestionar un único negocio.";
  }
}

async function loadBusinesses(options = {}) {
  setLoading(true);
  showNotice("Cargando datos operativos...", "info");

  try {
    if (state.businessUserToken && !state.businessUserSession) {
      const sessionPayload = await getJson("/api/business-users/session");
      state.businessUserSession = sessionPayload.session || null;
      updateBusinessUserSessionLabel();
    }
    const payload = await getJson("/api/businesses?includeArchived=true");
    state.businesses = Array.isArray(payload.businesses) ? payload.businesses : [];
    renderBusinessSelect();

    if (!state.businesses.length) {
      state.business = null;
      resetDealState();
      resetTaskState({ keepOwner: true });
      resetConsentCenter();
      resetCustomer360();
      resetForecastState({ keepMonth: true });
      resetSlaState({ keepHours: true });
      resetCommercialDashboardState();
      resetDataQualityState();
      resetInboxState({ keepStaleDays: true });
      resetFoundationState();
      resetGrowthOperationsState();
      resetIntelligenceState();
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
      resetDealState();
      state.duplicateGroups = [];
      resetProposalState();
      resetMessageState();
      state.nextActions = emptyNextActions();
      resetTaskState({ keepOwner: true });
      resetCustomer360();
      state.services = [];
      state.bookings = [];
      state.availability = [];
      state.blocks = [];
      state.reminderQueue = [];
      state.bookingResources = [];
      state.bookingWaitlist = [];
      state.bookingResourceSummary = null;
      state.report = null;
      resetForecastState({ keepMonth: true });
      resetSlaState({ keepHours: true });
      resetCommercialDashboardState();
      resetDataQualityState();
      resetInboxState({ keepStaleDays: true });
      state.googleStatus = null;
      state.googleDiagnostics = null;
      resetReputationState();
      resetFoundationState();
      resetGrowthOperationsState();
      resetIntelligenceState();
      state.crmError = "";
      state.bookingError = "";
      state.googleError = "";
      renderBusinessSelect();
      render();
      if (state.clientSession && error.status === 401) {
        window.LocalLiftApi?.clearClientSession?.();
      }
      if (state.businessUserToken && error.status === 401) {
        state.businessUserToken = "";
        state.businessUserSession = null;
        localStorage.removeItem("locallift_business_user_token");
        updateBusinessUserSessionLabel();
      }

      showNotice(error.status === 401
        ? (state.clientSession ? "La sesion de cliente ha caducado. Entra de nuevo desde Start > Cliente." : "La API pide token admin. Pegalo en la barra lateral y guarda.")
        : "No se pudo conectar con la API. Ejecuta npm.cmd start y abre esta pagina desde http://127.0.0.1:5173/pages/client-dashboard.html.", "error");
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
  resetDealState();
  resetTaskState({ keepOwner: true });
  resetConsentCenter({ keepContact: true });
  resetCustomer360({ keepFilters: true });
  resetForecastState({ keepMonth: true });
  resetSlaState({ keepHours: true });
  resetCommercialDashboardState();
  resetDataQualityState();
  resetInboxState({ keepStaleDays: true });
  resetChannelInboxState({ keepFilters: true });
  resetAutomationState({ keepSelection: true });
  resetCampaignState({ keepSelection: true });
  resetReputationState();
  resetFoundationState();
  resetGrowthOperationsState();
  resetIntelligenceState();
  setLoading(true);

  try {
    const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}`);
    state.business = payload.business || null;
    const businessRef = state.business?.id || id;
    const inboxPromise = loadInbox(businessRef);
    const channelInboxPromise = loadChannelInbox(businessRef);
    const automationPromise = loadAutomationCenter(businessRef);
    const campaignPromise = loadCampaignCenter(businessRef);
    const reputationPromise = loadReputationCenter(businessRef);
    const foundationPromise = loadFoundationCenters(businessRef);
    const growthOperationsPromise = loadGrowthOperationsCenters(businessRef);
    const intelligencePromise = loadIntelligenceCenter(businessRef);
    await loadContacts(businessRef);
    await loadConsentCenter(businessRef, state.consentCenter.contactId || state.contacts.find((contact) => !contact.merged)?.id || "");
    await loadAccounts(businessRef);
    await loadDeals(businessRef);
    await loadTasks(businessRef);
    await loadProposals(businessRef);
    await loadMessageTemplates(businessRef);
    await loadBookings(businessRef);
    await Promise.all([
      loadReport(businessRef),
      loadForecast(businessRef),
      loadSla(businessRef),
      loadCommercialDashboard(businessRef),
      loadDataQuality(businessRef),
      loadCustomer360(businessRef),
      inboxPromise,
      channelInboxPromise,
      automationPromise,
      campaignPromise,
      reputationPromise,
      foundationPromise,
      growthOperationsPromise,
      intelligencePromise
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
    document.dispatchEvent(new CustomEvent("dls:business-changed", {
      detail: {
        businessId: state.business?.id || id,
        businessName: state.business?.name || "",
        publishedUrl: state.business?.publishedUrl || ""
      }
    }));

    if (state.crmError || state.accountError || state.dealError || state.taskError || state.proposalError || state.messageError || state.bookingError || state.customer360Error || state.channelInboxError || state.automationError || state.campaignError || state.reputationError || state.googleError) {
      showNotice([state.crmError, state.accountError, state.dealError, state.taskError, state.proposalError, state.messageError, state.bookingError, state.customer360Error, state.channelInboxError, state.automationError, state.campaignError, state.reputationError, state.googleError].filter(Boolean).join(" "), "warn");
    } else if (!options.silent) {
      showNotice("", "info");
    }
  } catch (error) {
    const fallback = state.businesses.find((business) => business.id === id || business.slug === id);
    state.business = fallback || null;
    state.contacts = [];
    state.pipeline = null;
    resetDealState();
    state.duplicateGroups = [];
    resetProposalState();
    resetMessageState();
    state.nextActions = emptyNextActions();
    resetTaskState({ keepOwner: true });
    resetConsentCenter();
    resetCustomer360();
    state.services = [];
    state.bookings = [];
    state.availability = [];
    state.blocks = [];
    state.reminderQueue = [];
    state.bookingResources = [];
    state.bookingWaitlist = [];
    state.bookingResourceSummary = null;
    state.report = null;
    resetForecastState({ keepMonth: true });
    resetSlaState({ keepHours: true });
    resetCommercialDashboardState();
    resetDataQualityState();
    resetInboxState({ keepStaleDays: true });
    resetChannelInboxState({ keepFilters: true });
    resetAutomationState({ keepSelection: true });
    resetCampaignState({ keepSelection: true });
    resetReputationState();
    resetFoundationState();
    resetGrowthOperationsState();
    resetIntelligenceState();
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
  state.bookingResources = [];
  state.bookingWaitlist = [];
  state.bookingResourceSummary = null;
  state.bookingError = "";

  if (!id) {
    return;
  }

  try {
    const [servicesPayload, bookingsPayload, availabilityPayload, blocksPayload, remindersPayload, resourcesPayload, waitlistPayload] = await Promise.all([
      getJson(`/api/businesses/${encodeURIComponent(id)}/services`),
      getJson(`/api/businesses/${encodeURIComponent(id)}/bookings`),
      getJson(`/api/businesses/${encodeURIComponent(id)}/availability`),
      getJson(`/api/businesses/${encodeURIComponent(id)}/blocks`),
      getJson(`/api/businesses/${encodeURIComponent(id)}/reminders?hours=48`),
      getJson(`/api/businesses/${encodeURIComponent(id)}/resources`),
      getJson(`/api/businesses/${encodeURIComponent(id)}/waitlist`)
    ]);
    state.services = Array.isArray(servicesPayload.services) ? servicesPayload.services : [];
    state.bookings = Array.isArray(bookingsPayload.bookings) ? bookingsPayload.bookings : [];
    state.availability = Array.isArray(availabilityPayload.availability) ? availabilityPayload.availability : [];
    state.blocks = Array.isArray(blocksPayload.blocks) ? blocksPayload.blocks : [];
    state.reminderQueue = Array.isArray(remindersPayload.reminders) ? remindersPayload.reminders : [];
    state.bookingResources = Array.isArray(resourcesPayload.resources) ? resourcesPayload.resources : [];
    state.bookingWaitlist = Array.isArray(waitlistPayload.entries) ? waitlistPayload.entries : [];
    state.bookingResourceSummary = resourcesPayload.summary || waitlistPayload.summary || null;
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

async function loadDeals(id, options = {}) {
  state.dealLoading = true;
  state.dealError = "";

  if (!id) {
    state.dealLoading = false;
    return;
  }

  try {
    const pipelinePayload = await getJson(`/api/businesses/${encodeURIComponent(id)}/pipelines`);
    state.pipelines = Array.isArray(pipelinePayload.pipelines) ? pipelinePayload.pipelines : [];
    const requestedPipelineId = options.pipelineId || state.dealPipelineId;
    const selectedPipeline = state.pipelines.find((pipeline) => pipeline.id === requestedPipelineId)
      || state.pipelines.find((pipeline) => pipeline.isDefault)
      || state.pipelines[0]
      || null;
    state.dealPipelineId = selectedPipeline?.id || "";
    const query = state.dealPipelineId ? `?pipelineId=${encodeURIComponent(state.dealPipelineId)}` : "";
    const dealPayload = await getJson(`/api/businesses/${encodeURIComponent(id)}/deals/pipeline${query}`);
    state.dealPipeline = normalizeDealPipelinePayload(dealPayload);
    state.deals = state.dealPipeline.columns.flatMap((column) => column.deals);
  } catch (error) {
    state.deals = [];
    state.dealPipeline = null;
    state.dealError = error.status === 401 || error.status === 403
      ? "No tienes permisos para consultar las oportunidades."
      : "No se pudieron cargar las oportunidades comerciales.";
  } finally {
    state.dealLoading = false;
  }
}

async function loadTasks(id, options = {}) {
  state.taskLoading = true;
  state.taskError = "";
  if (!id) {
    state.taskLoading = false;
    return;
  }
  try {
    const ownerQuery = state.taskOwnerId ? `?ownerId=${encodeURIComponent(state.taskOwnerId)}` : "";
    const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}/tasks/queues${ownerQuery}`);
    state.taskMembers = Array.isArray(payload.members) ? payload.members : [];
    if (!state.taskMembers.some((member) => member.id === state.taskOwnerId)) {
      state.taskOwnerId = state.taskMembers[0]?.id || "";
    }
    state.taskQueues = normalizeTaskQueues(payload.queues);
    if (state.taskOwnerId && !ownerQuery) {
      state.taskQueues.mine = state.taskQueues.team.filter((task) => task.ownerId === state.taskOwnerId);
    }
    state.taskQueues.unownedDeals = Array.isArray(payload.unownedDeals) ? payload.unownedDeals : [];
  } catch (error) {
    state.taskQueues = emptyTaskQueues();
    state.taskMembers = [];
    state.taskError = error.status === 401 || error.status === 403
      ? "No tienes permisos para consultar las tareas."
      : "No se pudieron cargar las tareas y colas de trabajo.";
  } finally {
    state.taskLoading = false;
  }
  if (options.render && state.business) render();
}

function resetTaskState(options = {}) {
  state.taskQueues = emptyTaskQueues();
  state.taskMembers = [];
  if (!options.keepOwner) state.taskOwnerId = "";
  state.taskLoading = false;
  state.taskError = "";
}

async function loadConsentCenter(id, contactId, options = {}) {
  state.consentCenter.loading = true;
  state.consentCenter.error = "";
  state.consentCenter.contactId = contactId || "";
  if (!id || !contactId) {
    state.consentCenter.data = null;
    state.consentCenter.loading = false;
    return;
  }
  try {
    state.consentCenter.data = await getJson(`/api/businesses/${encodeURIComponent(id)}/contacts/${encodeURIComponent(contactId)}/consents`);
  } catch (error) {
    state.consentCenter.data = null;
    state.consentCenter.error = error.status === 401 || error.status === 403 ? "No tienes permisos para consultar consentimientos." : "No se pudo cargar el centro de preferencias.";
  } finally {
    state.consentCenter.loading = false;
  }
  if (options.render && state.business) render();
}

function resetConsentCenter(options = {}) {
  state.consentCenter = { contactId: options.keepContact ? state.consentCenter?.contactId || "" : "", data: null, loading: false, error: "" };
}

async function loadCustomer360(id, options = {}) {
  state.customer360Loading = true;
  state.customer360Error = "";

  if (!id) {
    state.customer360 = null;
    state.customer360Loading = false;
    return;
  }

  try {
    state.customer360 = await getJson(`/api/businesses/${encodeURIComponent(id)}/customers/360?limit=500&timelineLimit=8`);
  } catch (error) {
    state.customer360 = null;
    state.customer360Error = error.status === 401 || error.status === 403
      ? "No tienes permisos para consultar Cliente 360."
      : "No se pudo calcular Cliente 360; se mostrara la cartera basica.";
  } finally {
    state.customer360Loading = false;
  }

  if (options.render && state.business) render();
}

function resetCustomer360(options = {}) {
  state.customer360 = null;
  state.customer360Loading = false;
  state.customer360Error = "";

  if (!options.keepFilters) {
    state.customerSegmentFilter = "";
    state.customerSearch = "";
  }
}

async function loadAccounts(id) {
  state.accountLoading = true;
  state.accountError = "";
  state.accounts = [];
  state.accountDuplicateGroups = [];
  if (!id) {
    state.accountLoading = false;
    return;
  }
  try {
    const [accountsPayload, duplicatesPayload] = await Promise.all([
      getJson(`/api/businesses/${encodeURIComponent(id)}/accounts?includeRelations=true`),
      getJson(`/api/businesses/${encodeURIComponent(id)}/accounts/duplicates`)
    ]);
    state.accounts = Array.isArray(accountsPayload.accounts) ? accountsPayload.accounts : [];
    state.accountDuplicateGroups = Array.isArray(duplicatesPayload.groups) ? duplicatesPayload.groups : [];
  } catch (error) {
    state.accountError = error.status === 401 || error.status === 403
      ? "No tienes permisos para consultar las cuentas."
      : "No se pudieron cargar las cuentas y sus relaciones.";
  } finally {
    state.accountLoading = false;
  }
}

function resetDealState() {
  state.accounts = [];
  state.accountDuplicateGroups = [];
  state.accountLoading = false;
  state.accountError = "";
  state.pipelines = [];
  state.deals = [];
  state.dealPipeline = null;
  state.dealPipelineId = "";
  state.dealLoading = false;
  state.dealError = "";
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
  state.proposalShareLinks = {};
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

async function loadDataQuality(id, options = {}) {
  const requestSequence = ++state.dataQualityRequestSequence;
  state.dataQuality = null;
  state.dataQualityError = "";
  state.dataQualityLoading = Boolean(id);

  if (options.render && state.business) {
    render();
  }

  if (!id) {
    state.dataQualityLoading = false;
    return;
  }

  try {
    const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}/reports/data-quality`);

    if (requestSequence !== state.dataQualityRequestSequence) {
      return;
    }

    state.dataQuality = payload.dataQuality && typeof payload.dataQuality === "object"
      ? payload.dataQuality
      : null;
  } catch (error) {
    if (requestSequence !== state.dataQualityRequestSequence) {
      return;
    }

    state.dataQuality = null;
    state.dataQualityError = error.status === 401 || error.status === 403
      ? "No tienes permisos para consultar la calidad de datos de este negocio."
      : "No se pudo cargar la calidad de datos. Revisa la conexion e intentalo de nuevo.";
  } finally {
    if (requestSequence !== state.dataQualityRequestSequence) {
      return;
    }

    state.dataQualityLoading = false;
    if (options.render && state.business) {
      render();
    }
  }
}

function resetDataQualityState() {
  state.dataQualityRequestSequence += 1;
  state.dataQuality = null;
  state.dataQualityLoading = false;
  state.dataQualityError = "";
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

async function loadChannelInbox(id, options = {}) {
  const requestSequence = ++state.channelInboxRequestSequence;
  if (Object.prototype.hasOwnProperty.call(options, "channel")) state.channelFilter = clean(options.channel);
  if (Object.prototype.hasOwnProperty.call(options, "status")) state.channelStatusFilter = clean(options.status);
  if (Object.prototype.hasOwnProperty.call(options, "search")) state.channelSearch = clean(options.search);
  state.channelInbox = null;
  state.channelInboxError = "";
  state.channelInboxLoading = Boolean(id);

  if (options.render && state.business) render();
  if (!id) {
    state.channelInboxLoading = false;
    return;
  }

  try {
    const params = new URLSearchParams();
    if (state.channelFilter) params.set("channel", state.channelFilter);
    if (state.channelStatusFilter) params.set("status", state.channelStatusFilter);
    if (state.channelSearch) params.set("search", state.channelSearch);
    const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}/channels/inbox${params.size ? `?${params}` : ""}`);
    if (requestSequence !== state.channelInboxRequestSequence) return;
    if (!payload.inbox || typeof payload.inbox !== "object") throw new Error("Channel inbox payload is missing");
    state.channelInbox = payload.inbox;
    const conversations = Array.isArray(payload.inbox.conversations) ? payload.inbox.conversations : [];
    if (!conversations.some((item) => item.id === state.channelSelectedConversationId)) {
      state.channelSelectedConversationId = conversations[0]?.id || "";
    }
    const members = Array.isArray(payload.inbox.members) ? payload.inbox.members : [];
    if (!members.some((member) => member.id === state.channelActorId)) {
      const selected = conversations.find((item) => item.id === state.channelSelectedConversationId) || conversations[0];
      state.channelActorId = selected?.assignedToId || members[0]?.id || "";
    }
  } catch (error) {
    if (requestSequence !== state.channelInboxRequestSequence) return;
    state.channelInbox = null;
    state.channelInboxError = error.status === 401 || error.status === 403
      ? "No tienes permisos para consultar las conversaciones de este negocio."
      : "No se pudo cargar la bandeja omnicanal. Revisa la conexion e intentalo de nuevo.";
  } finally {
    if (requestSequence !== state.channelInboxRequestSequence) return;
    state.channelInboxLoading = false;
    if (options.render && state.business) render();
  }
}

function resetChannelInboxState(options = {}) {
  state.channelInboxRequestSequence += 1;
  state.channelInbox = null;
  state.channelInboxLoading = false;
  state.channelInboxError = "";
  state.channelSelectedConversationId = "";
  state.channelActorId = "";
  if (!options.keepFilters) {
    state.channelFilter = "";
    state.channelStatusFilter = "open";
    state.channelSearch = "";
  }
}

async function loadAutomationCenter(id, options = {}) {
  const requestSequence = ++state.automationRequestSequence;
  state.automationLoading = Boolean(id);
  state.automationError = "";
  if (options.clearFeedback) state.automationFeedback = "";
  if (options.render && state.business) render();
  if (!id) {
    state.automationLoading = false;
    return;
  }
  try {
    const [automationPayload, enrollmentPayload] = await Promise.all([
      getJson(`/api/businesses/${encodeURIComponent(id)}/automations`),
      getJson(`/api/businesses/${encodeURIComponent(id)}/sequences/enrollments`)
    ]);
    if (requestSequence !== state.automationRequestSequence) return;
    const automations = Array.isArray(automationPayload.automations) ? automationPayload.automations : [];
    state.automationCenter = {
      automations,
      recipes: Array.isArray(automationPayload.recipes) ? automationPayload.recipes : [],
      enrollments: Array.isArray(enrollmentPayload.enrollments) ? enrollmentPayload.enrollments : []
    };
    if (!automations.some((item) => item.id === state.automationSelectedId)) state.automationSelectedId = automations[0]?.id || "";
    if (state.automationSelectedId) {
      const runsPayload = await getJson(`/api/businesses/${encodeURIComponent(id)}/automations/${encodeURIComponent(state.automationSelectedId)}/runs`);
      if (requestSequence !== state.automationRequestSequence) return;
      state.automationRuns = Array.isArray(runsPayload.runs) ? runsPayload.runs : [];
    } else {
      state.automationRuns = [];
    }
  } catch (error) {
    if (requestSequence !== state.automationRequestSequence) return;
    state.automationCenter = null;
    state.automationRuns = [];
    state.automationError = error.status === 401 || error.status === 403
      ? "No tienes permisos para consultar las automatizaciones."
      : "No se pudo cargar el estudio de automatizaciones.";
  } finally {
    if (requestSequence !== state.automationRequestSequence) return;
    state.automationLoading = false;
    if (options.render && state.business) render();
  }
}

async function loadAutomationRuns(id, automationId, options = {}) {
  if (!id || !automationId) return;
  state.automationSelectedId = automationId;
  try {
    const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}/automations/${encodeURIComponent(automationId)}/runs`);
    state.automationRuns = Array.isArray(payload.runs) ? payload.runs : [];
    state.automationError = "";
  } catch (error) {
    state.automationRuns = [];
    state.automationError = "No se pudieron cargar las ejecuciones de esta automatizacion.";
  }
  if (options.render && state.business) render();
}

function resetAutomationState(options = {}) {
  state.automationRequestSequence += 1;
  state.automationCenter = null;
  state.automationRuns = [];
  state.automationLoading = false;
  state.automationError = "";
  state.automationFeedback = "";
  if (!options.keepSelection) state.automationSelectedId = "";
}

async function loadCampaignCenter(id, options = {}) {
  const requestSequence = ++state.campaignRequestSequence;
  state.campaignLoading = Boolean(id);
  state.campaignError = "";
  if (options.clearFeedback) state.campaignFeedback = "";
  if (options.render && state.business) render();
  if (!id) {
    state.campaignLoading = false;
    return;
  }
  try {
    const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}/campaigns`);
    if (requestSequence !== state.campaignRequestSequence) return;
    const campaigns = Array.isArray(payload.campaigns) ? payload.campaigns : [];
    state.campaignCenter = { campaigns, templates: Array.isArray(payload.templates) ? payload.templates : [] };
    if (!campaigns.some((item) => item.id === state.campaignSelectedId)) state.campaignSelectedId = campaigns[0]?.id || "";
  } catch (error) {
    if (requestSequence !== state.campaignRequestSequence) return;
    state.campaignCenter = null;
    state.campaignError = error.status === 401 || error.status === 403
      ? "No tienes permisos para consultar campanas."
      : "No se pudo cargar el centro de campanas.";
  } finally {
    if (requestSequence !== state.campaignRequestSequence) return;
    state.campaignLoading = false;
    if (options.render && state.business) render();
  }
}

function resetCampaignState(options = {}) {
  state.campaignRequestSequence += 1;
  state.campaignCenter = null;
  state.campaignLoading = false;
  state.campaignError = "";
  state.campaignPreview = null;
  state.campaignFeedback = "";
  if (!options.keepSelection) state.campaignSelectedId = "";
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

async function loadReputationCenter(id, options = {}) {
  const requestSequence = ++state.reputationRequestSequence;
  state.reputationCenter = null;
  state.reputationError = "";
  state.reputationLoading = Boolean(id);
  if (!options.keepFeedback) state.reputationFeedback = "";
  if (!id) return;
  try {
    const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}/reputation`);
    if (requestSequence !== state.reputationRequestSequence) return;
    state.reputationCenter = payload.center && typeof payload.center === "object" ? payload.center : null;
  } catch (error) {
    if (requestSequence !== state.reputationRequestSequence) return;
    state.reputationError = error.status === 401 || error.status === 403
      ? "No tienes permisos para consultar la reputacion de este negocio."
      : "No se pudo cargar el Centro de reputacion.";
  } finally {
    if (requestSequence !== state.reputationRequestSequence) return;
    state.reputationLoading = false;
    if (options.render && state.business) render();
  }
}

function resetReputationState() {
  state.reputationRequestSequence += 1;
  state.reputationCenter = null;
  state.reputationLoading = false;
  state.reputationError = "";
  state.reputationFeedback = "";
}

async function loadFoundationCenters(id, options = {}) {
  resetFoundationState({ keepFeedback: options.keepFeedback });
  if (!id || state.clientSession) {
    if (options.render && state.business) render();
    return;
  }
  state.securityLoading = true;
  state.moneyLoading = true;
  state.crmConfigLoading = true;
  if (options.render && state.business) render();
  const encodedId = encodeURIComponent(id);
  const [securityResult, moneyResult, configResult] = await Promise.allSettled([
    getJson(`/api/businesses/${encodedId}/security`),
    getJson(`/api/businesses/${encodedId}/money`),
    getJson(`/api/businesses/${encodedId}/crm-config`)
  ]);

  applyFoundationResult("security", securityResult, (payload) => payload);
  applyFoundationResult("money", moneyResult, (payload) => payload.center || null);
  applyFoundationResult("crmConfig", configResult, (payload) => payload.center || null);
  state.securityLoading = false;
  state.moneyLoading = false;
  state.crmConfigLoading = false;
  if (options.render && state.business) render();
}

function applyFoundationResult(key, result, select) {
  const centerKey = `${key}Center`;
  const errorKey = `${key}Error`;
  if (result.status === "fulfilled") {
    state[centerKey] = select(result.value);
    state[errorKey] = "";
    return;
  }
  state[centerKey] = null;
  state[errorKey] = [401, 403].includes(result.reason?.status)
    ? "No disponible para tu rol."
    : "No se pudo cargar.";
}

function resetFoundationState(options = {}) {
  state.securityCenter = null;
  state.securityLoading = false;
  state.securityError = "";
  state.moneyCenter = null;
  state.moneyLoading = false;
  state.moneyError = "";
  state.crmConfigCenter = null;
  state.crmConfigLoading = false;
  state.crmConfigError = "";
  if (!options.keepFeedback) {
    state.securityFeedback = "";
    state.moneyFeedback = "";
    state.crmConfigFeedback = "";
  }
}

async function loadGrowthOperationsCenters(id, options = {}) {
  resetGrowthOperationsState({ keepFeedback: options.keepFeedback });
  if (!id || state.clientSession) {
    if (options.render && state.business) render();
    return;
  }
  state.loyaltyLoading = true;
  state.verticalOperationsLoading = true;
  if (options.render && state.business) render();
  const encodedId = encodeURIComponent(id);
  const [loyaltyResult, verticalResult] = await Promise.allSettled([
    getJson(`/api/businesses/${encodedId}/loyalty`),
    getJson(`/api/businesses/${encodedId}/vertical`)
  ]);
  applyGrowthOperationsResult("loyalty", loyaltyResult);
  applyGrowthOperationsResult("verticalOperations", verticalResult);
  state.loyaltyLoading = false;
  state.verticalOperationsLoading = false;
  if (options.render && state.business) render();
}

function applyGrowthOperationsResult(key, result) {
  const centerKey = `${key}Center`;
  const errorKey = `${key}Error`;
  if (result.status === "fulfilled") {
    state[centerKey] = result.value.center || null;
    state[errorKey] = "";
    return;
  }
  state[centerKey] = null;
  state[errorKey] = [401, 403].includes(result.reason?.status)
    ? "No disponible para tu rol."
    : "No se pudo cargar.";
}

function resetGrowthOperationsState(options = {}) {
  state.loyaltyCenter = null;
  state.loyaltyLoading = false;
  state.loyaltyError = "";
  state.verticalOperationsCenter = null;
  state.verticalOperationsLoading = false;
  state.verticalOperationsError = "";
  if (!options.keepFeedback) {
    state.loyaltyFeedback = "";
    state.verticalOperationsFeedback = "";
  }
}

async function loadIntelligenceCenter(id, options = {}) {
  resetIntelligenceState({ keepFeedback: options.keepFeedback, keepQuery: options.keepQuery });
  if (!id || state.clientSession) {
    if (options.render && state.business) render();
    return;
  }
  state.intelligenceLoading = true;
  if (options.render && state.business) render();
  try {
    const payload = await getJson(`/api/businesses/${encodeURIComponent(id)}/intelligence`);
    state.intelligenceCenter = payload.center || null;
    state.intelligenceError = "";
  } catch (error) {
    state.intelligenceCenter = null;
    state.intelligenceError = [401, 403].includes(error.status)
      ? "No disponible para tu rol."
      : "No se pudo cargar la inteligencia operativa.";
  } finally {
    state.intelligenceLoading = false;
    if (options.render && state.business) render();
  }
}

function resetIntelligenceState(options = {}) {
  state.intelligenceCenter = null;
  state.intelligenceLoading = false;
  state.intelligenceError = "";
  if (!options.keepFeedback) state.intelligenceFeedback = "";
  if (!options.keepQuery) state.intelligenceQueryResult = null;
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
  const headers = window.LocalLiftApi?.headers
    ? { ...window.LocalLiftApi.headers(options) }
    : { Accept: "application/json" };

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

  if (state.businessUserToken) {
    headers["X-LocalLift-User-Token"] = state.businessUserToken;
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
  document.body.classList.toggle("is-project-view", tab === "project");

  document.querySelectorAll("[data-tab]").forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });

  document.querySelectorAll("[data-panel]").forEach((panel) => {
    const active = panel.dataset.panel === tab;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
  if (tab !== "project") {
    document.querySelectorAll("[data-client-section]").forEach((button) => {
      button.classList.remove("is-active");
      button.setAttribute("aria-current", "false");
    });
  }
  if (refs.quickCreate) {
    refs.quickCreate.hidden = tab === "project";
  }

  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
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
    accounts: state.accounts,
    accountDuplicateGroups: state.accountDuplicateGroups,
    pipelines: state.pipelines,
    deals: state.deals,
    dealPipeline: state.dealPipeline,
    duplicateGroups: state.duplicateGroups,
    proposals: state.proposals,
    nextActions: state.nextActions,
    taskQueues: state.taskQueues,
    taskMembers: state.taskMembers,
    taskOwnerId: state.taskOwnerId,
    consentCenter: state.consentCenter,
    customer360: state.customer360,
    services: state.services,
    bookings: state.bookings,
    availability: state.availability,
    blocks: state.blocks,
    reminderQueue: state.reminderQueue,
    bookingResources: state.bookingResources,
    bookingWaitlist: state.bookingWaitlist,
    bookingResourceSummary: state.bookingResourceSummary,
    report: state.report,
    forecast: state.forecast,
    sla: state.sla,
    commercialDashboard: state.commercialDashboard,
    dataQuality: state.dataQuality,
    inbox: state.inbox,
    channelInbox: state.channelInbox,
    campaignCenter: state.campaignCenter
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
  bindTaskControls(model);
  bindConsentControls();
  bindCustomer360Controls(model);
  bindCampaignControls(model);
  bindProposalControls(model);
  bindMessageControls(model);
  bindBookingControls(model);
  bindChannelInboxControls(model);
  bindInboxControls();
  bindAutomationControls(model);
  bindReportControls();
  bindGoogleControls();
  bindReputationControls(model);
  bindFoundationControls(model);
  bindGrowthOperationsControls(model);
  bindIntelligenceControls(model);
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
  if (refs.sideBrandBusiness) {
    refs.sideBrandBusiness.textContent = business.name;
  }
  if (refs.workspaceLabel) {
    refs.workspaceLabel.textContent = isDeveloperPreview
      ? `Vista previa · ${business.name}`
      : business.name;
  }
  refs.sideMeta.textContent = [business.category, business.city, planLabel(business.plan)]
    .filter(Boolean)
    .join(" - ");
  refs.sideStatus.innerHTML = [
    statusPill(statusLabel(business.status), business.status),
    statusPill(model.primaryGoal || "Objetivo no definido", "neutral"),
    statusPill(`${model.healthScore}% listo`, model.healthScore >= 70 ? "ok" : "warn")
  ].join("");

  const activeNavigation = Array.from(document.querySelectorAll("[data-tab]"))
    .find((button) => button.dataset.tab === (state.activeTab || "home"));
  refs.pageTitle.textContent = activeNavigation?.dataset.navTitle || business.name;
  refs.pageSubtitle.textContent = activeNavigation?.dataset.navSubtitle || [business.category, business.city, business.ownerName]
    .filter(Boolean)
    .join(" - ") || "Operacion diaria";

  if (refs.webLink) {
    const businessRef = business.slug || business.id || "";
    const url = `client-site.html?business=${encodeURIComponent(businessRef)}`;
    refs.webLink.textContent = state.clientSession ? "Mi web" : "Editar web";
    refs.webLink.href = state.clientSession ? url : "../workspace.html?hub=1&mode=developer";
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
    ${renderChannelInbox(model)}
    <div class="commercial-inbox-divider">
      <div>
        <p class="eyebrow">Centro de trabajo</p>
        <h3>Prioridades comerciales de hoy</h3>
      </div>
      <span>CRM + agenda + propuestas</span>
    </div>
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

function renderChannelInbox(model) {
  if (state.channelInboxLoading) {
    return `
      <section class="channel-inbox-workspace" data-channel-inbox aria-busy="true">
        <div class="inbox-state inbox-state-loading" role="status">
          <span class="inbox-spinner" aria-hidden="true"></span>
          <div><strong>Sincronizando conversaciones</strong><p>Reuniendo email, WhatsApp, entregas y responsables.</p></div>
        </div>
      </section>
    `;
  }

  if (state.channelInboxError) {
    return `
      <section class="channel-inbox-workspace" data-channel-inbox>
        <div class="inbox-state inbox-state-error" role="alert">
          <span class="inbox-state-icon" aria-hidden="true">!</span>
          <div><strong>Bandeja omnicanal no disponible</strong><p>${escapeHtml(state.channelInboxError)}</p></div>
          <button type="button" data-channel-inbox-retry>Reintentar</button>
        </div>
      </section>
    `;
  }

  const inbox = model.channelInbox;
  if (!inbox || typeof inbox !== "object") {
    return `
      <section class="channel-inbox-workspace" data-channel-inbox>
        <div class="inbox-state inbox-state-empty">
          <span class="inbox-state-icon" aria-hidden="true">0</span>
          <div><strong>Sin conversaciones sincronizadas</strong><p>Activa Email o WhatsApp para recibir y responder desde el CRM.</p></div>
        </div>
      </section>
    `;
  }

  const connections = Array.isArray(inbox.connections) ? inbox.connections : [];
  const conversations = Array.isArray(inbox.conversations) ? inbox.conversations : [];
  const members = Array.isArray(inbox.members) ? inbox.members : [];
  const summary = inbox.summary || {};
  const selected = conversations.find((item) => item.id === state.channelSelectedConversationId) || conversations[0] || null;
  const actorId = members.some((member) => member.id === state.channelActorId)
    ? state.channelActorId
    : (selected?.assignedToId || members[0]?.id || "");
  const actor = members.find((member) => member.id === actorId) || null;

  return `
    <section class="channel-inbox-workspace" data-channel-inbox aria-labelledby="channelInboxTitle">
      <header class="channel-inbox-header">
        <div>
          <p class="eyebrow">Conversaciones reales</p>
          <h2 id="channelInboxTitle">Bandeja omnicanal</h2>
          <p>Email y WhatsApp con identidad unica, entregas, consentimiento, SLA y trabajo en equipo.</p>
        </div>
        <div class="channel-connection-list" aria-label="Estado de conexiones">
          ${connections.map(renderChannelConnectionBadge).join("")}
        </div>
      </header>
      ${!state.clientSession ? renderChannelConnectionSettings(connections) : ""}
      <div class="channel-summary-grid" aria-label="Resumen de conversaciones">
        ${renderChannelSummary("Abiertas", summary.open, "open")}
        ${renderChannelSummary("Sin leer", summary.unread, "unread")}
        ${renderChannelSummary("Sin asignar", summary.unassigned, "unassigned")}
        ${renderChannelSummary("SLA vencido", summary.slaBreached, "breached")}
        ${renderChannelSummary("1a respuesta", formatChannelDuration(summary.averageFirstResponseMinutes), "response")}
      </div>
      <form class="channel-inbox-filters" data-channel-filter-form>
        <label><span>Buscar</span><input name="search" type="search" value="${escapeAttr(state.channelSearch)}" placeholder="Nombre, email, telefono o mensaje"></label>
        <label><span>Canal</span><select name="channel">
          <option value=""${state.channelFilter ? "" : " selected"}>Todos</option>
          <option value="email"${state.channelFilter === "email" ? " selected" : ""}>Email</option>
          <option value="whatsapp"${state.channelFilter === "whatsapp" ? " selected" : ""}>WhatsApp</option>
        </select></label>
        <label><span>Estado</span><select name="status">
          <option value=""${state.channelStatusFilter ? "" : " selected"}>Todos</option>
          <option value="open"${state.channelStatusFilter === "open" ? " selected" : ""}>Abiertas</option>
          <option value="closed"${state.channelStatusFilter === "closed" ? " selected" : ""}>Cerradas</option>
        </select></label>
        <button type="submit">Filtrar</button>
      </form>
      <div class="channel-inbox-layout${selected ? "" : " is-empty"}">
        <div class="channel-conversation-list" role="list" aria-label="Conversaciones">
          ${conversations.length
            ? conversations.map((conversation) => renderChannelConversationCard(conversation, selected?.id)).join("")
            : `<div class="channel-empty"><strong>No hay conversaciones</strong><p>Prueba otros filtros o espera al siguiente mensaje entrante.</p></div>`}
        </div>
        ${selected ? renderChannelConversationDetail(selected, members, actor) : `
          <div class="channel-empty channel-empty-detail">
            <span aria-hidden="true">@</span><strong>Selecciona una conversacion</strong><p>Aqui apareceran mensajes, entregas, notas, responsable y SLA.</p>
          </div>`}
      </div>
    </section>
  `;
}

function renderChannelConnectionBadge(connection) {
  const ready = Boolean(connection?.active && connection?.credentialsReady);
  const warning = Boolean(connection?.active && !connection?.credentialsReady);
  const tone = ready ? "ready" : warning ? "warning" : "inactive";
  const label = connection?.channel === "whatsapp" ? "WhatsApp" : "Email";
  const stateLabel = ready ? (connection.mode === "live" ? "En vivo" : "Demo activa") : warning ? "Falta configurar" : "Inactivo";
  return `<span class="channel-connection channel-connection-${tone}" data-channel-connection="${escapeAttr(connection?.channel || "")}"><i aria-hidden="true"></i><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(stateLabel)}</small></span></span>`;
}

function renderChannelConnectionSettings(connections) {
  return `
    <details class="channel-settings">
      <summary>Configurar canales y SLA</summary>
      <div class="channel-settings-grid">
        ${connections.map((connection) => {
          const isEmail = connection.channel === "email";
          return `
            <form data-channel-connection-form="${escapeAttr(connection.channel)}">
              <div><strong>${isEmail ? "Email" : "WhatsApp"}</strong><small>Las credenciales se leen de variables seguras del servidor.</small></div>
              <label><span>Proveedor</span><select name="provider">
                <option value="development"${connection.provider === "development" ? " selected" : ""}>Desarrollo</option>
                <option value="${isEmail ? "resend" : "whatsapp-cloud"}"${connection.provider !== "development" ? " selected" : ""}>${isEmail ? "Resend" : "WhatsApp Cloud"}</option>
              </select></label>
              <label><span>${isEmail ? "Remitente" : "Phone number ID"}</span><input name="senderId" value="${escapeAttr(connection.senderId || "")}" placeholder="${isEmail ? "equipo@dominio.com" : "ID de Meta"}"></label>
              <label><span>SLA primera respuesta</span><input name="firstResponseTargetMinutes" type="number" min="5" max="10080" value="${escapeAttr(connection.firstResponseTargetMinutes || 60)}"></label>
              <label class="channel-toggle"><input name="active" type="checkbox"${connection.active ? " checked" : ""}><span>Canal activo</span></label>
              ${connection.missingConfiguration?.length ? `<p class="channel-config-warning">Pendiente: ${escapeHtml(connection.missingConfiguration.join(", "))}</p>` : ""}
              <button type="submit">Guardar ${isEmail ? "email" : "WhatsApp"}</button>
            </form>
          `;
        }).join("")}
      </div>
    </details>
  `;
}

function renderChannelSummary(label, value, tone) {
  const normalized = value === null || value === undefined ? "--" : String(value);
  return `<article class="channel-summary channel-summary-${escapeAttr(tone)}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(normalized)}</strong></article>`;
}

function renderChannelConversationCard(conversation, selectedId) {
  const contact = conversation.contact || {};
  const lastMessage = conversation.lastMessage || {};
  const title = contact.name || contact.email || contact.phone || conversation.title || "Contacto";
  const preview = clean(lastMessage.body || conversation.subject || "Conversacion sin texto");
  const selected = conversation.id === selectedId;
  return `
    <button class="channel-conversation-card${selected ? " is-selected" : ""}${conversation.unreadCount ? " is-unread" : ""}" type="button" data-channel-conversation="${escapeAttr(conversation.id)}" role="listitem" aria-pressed="${selected}">
      <span class="channel-avatar channel-avatar-${escapeAttr(conversation.channel)}" aria-hidden="true">${conversation.channel === "whatsapp" ? "WA" : "EM"}</span>
      <span class="channel-conversation-copy">
        <span class="channel-conversation-line"><strong>${escapeHtml(title)}</strong><time>${escapeHtml(formatInboxDateTime(conversation.lastMessageAt || conversation.updatedAt, modelTimezone()))}</time></span>
        <span class="channel-conversation-preview">${lastMessage.direction === "outbound" ? "Tu: " : ""}${escapeHtml(preview)}</span>
        <span class="channel-conversation-meta">
          <i>${escapeHtml(conversation.assignedTo?.name || "Sin asignar")}</i>
          ${conversation.sla?.breached ? `<i class="is-breached">SLA vencido</i>` : ""}
          ${conversation.status === "closed" ? `<i>Cerrada</i>` : ""}
        </span>
      </span>
      ${conversation.unreadCount ? `<span class="channel-unread">${escapeHtml(String(conversation.unreadCount))}</span>` : ""}
    </button>
  `;
}

function renderChannelConversationDetail(conversation, members, actor) {
  const contact = conversation.contact || {};
  const channelLabel = conversation.channel === "whatsapp" ? "WhatsApp" : "Email";
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  const connection = state.channelInbox?.connections?.find((item) => item.channel === conversation.channel);
  const canSend = Boolean(connection?.active && connection?.credentialsReady);
  const lock = conversation.lock;
  const ownsLock = Boolean(lock && actor && lock.actorId === actor.id);
  return `
    <article class="channel-conversation-detail" data-channel-detail="${escapeAttr(conversation.id)}">
      <header class="channel-detail-header">
        <div>
          <span class="channel-avatar channel-avatar-${escapeAttr(conversation.channel)}" aria-hidden="true">${conversation.channel === "whatsapp" ? "WA" : "EM"}</span>
          <div><p>${escapeHtml(channelLabel)} · ${escapeHtml(conversation.status === "closed" ? "Cerrada" : "Abierta")}</p><h3>${escapeHtml(contact.name || contact.email || contact.phone || "Contacto")}</h3><small>${escapeHtml(contact.email || contact.phone || "Identidad vinculada al CRM")}</small></div>
        </div>
        <div class="channel-detail-actions">
          ${conversation.unreadCount ? `<button type="button" data-channel-mark-read>Marcar leida</button>` : ""}
          <button type="button" data-channel-toggle-status="${conversation.status === "closed" ? "open" : "closed"}">${conversation.status === "closed" ? "Reabrir" : "Cerrar"}</button>
        </div>
      </header>
      <div class="channel-collaboration-bar">
        <label><span>Responsable</span><select data-channel-assignee>
          <option value=""${conversation.assignedToId ? "" : " selected"}>Sin asignar</option>
          ${members.map((member) => `<option value="${escapeAttr(member.id)}"${conversation.assignedToId === member.id ? " selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}
        </select></label>
        <label><span>Estoy operando como</span><select data-channel-actor>
          ${members.length ? members.map((member) => `<option value="${escapeAttr(member.id)}"${actor?.id === member.id ? " selected" : ""}>${escapeHtml(member.name)}</option>`).join("") : `<option value="">Sin miembros</option>`}
        </select></label>
        <div class="channel-lock-control">
          <span>Edicion</span>
          ${lock
            ? `<strong class="${ownsLock ? "is-owned" : "is-blocked"}">${ownsLock ? "Tu tienes el turno" : `${escapeHtml(lock.actorName)} esta respondiendo`}</strong>${ownsLock ? `<button type="button" data-channel-unlock>Soltar</button>` : ""}`
            : `<button type="button" data-channel-lock${actor ? "" : " disabled"}>Tomar conversacion</button>`}
        </div>
        <div class="channel-sla-indicator${conversation.sla?.breached ? " is-breached" : ""}"><span>SLA</span><strong>${conversation.sla?.breached ? "Vencido" : "En plazo"}</strong><small>${formatChannelDuration(conversation.sla?.waitingMinutes)} / ${formatChannelDuration(conversation.sla?.targetMinutes)}</small></div>
      </div>
      <div class="channel-message-stream" aria-label="Historial de mensajes">
        ${messages.length ? messages.map(renderChannelMessage).join("") : `<p class="channel-empty">Todavia no hay mensajes en esta conversacion.</p>`}
      </div>
      ${!canSend ? `<p class="channel-send-warning">Activa y completa la conexion de ${escapeHtml(channelLabel)} antes de responder.</p>` : ""}
      <form class="channel-reply-form" data-channel-reply-form>
        <div class="channel-compose-heading"><strong>Responder por ${escapeHtml(channelLabel)}</strong><span>El consentimiento se valida antes del envio.</span></div>
        ${conversation.channel === "email" ? `<label><span>Asunto</span><input name="subject" value="${escapeAttr(conversation.subject || "")}" maxlength="500"></label>` : ""}
        <label><span>Mensaje</span><textarea name="body" rows="4" maxlength="20000" required placeholder="Escribe una respuesta clara y personal..."></textarea></label>
        <div class="channel-compose-footer">
          <label><span>Finalidad</span><select name="purpose"><option value="service">Servicio</option><option value="marketing">Marketing</option><option value="reviews">Resenas</option></select></label>
          <button type="submit"${canSend && actor ? "" : " disabled"}>Enviar ${escapeHtml(channelLabel)}</button>
        </div>
      </form>
      <form class="channel-note-form" data-channel-note-form>
        <div class="channel-compose-heading"><strong>Nota interna</strong><span>Visible solo para el equipo; admite menciones.</span></div>
        <label><span>Nota</span><textarea name="body" rows="2" maxlength="10000" required placeholder="Contexto, decision o siguiente paso..."></textarea></label>
        ${members.length ? `<fieldset><legend>Mencionar</legend>${members.map((member) => `<label><input type="checkbox" name="mentions" value="${escapeAttr(member.id)}"><span>@${escapeHtml(member.name)}</span></label>`).join("")}</fieldset>` : ""}
        <button type="submit"${actor ? "" : " disabled"}>Guardar nota</button>
      </form>
    </article>
  `;
}

function renderChannelMessage(message) {
  const direction = ["inbound", "outbound", "internal"].includes(message.direction) ? message.direction : "inbound";
  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  return `
    <div class="channel-message channel-message-${escapeAttr(direction)}">
      <div class="channel-message-meta"><strong>${escapeHtml(direction === "internal" ? `Nota · ${message.senderName || "Equipo"}` : message.senderName || (direction === "outbound" ? "Equipo" : "Contacto"))}</strong><time>${escapeHtml(formatInboxDateTime(message.occurredAt || message.createdAt, modelTimezone()))}</time></div>
      ${message.subject ? `<small class="channel-message-subject">${escapeHtml(message.subject)}</small>` : ""}
      <p>${escapeHtml(message.body || "Mensaje sin texto")}</p>
      ${attachments.length ? `<div class="channel-attachments">${attachments.map((attachment) => attachment.url ? `<a href="${escapeAttr(attachment.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(attachment.name || "Adjunto")}</a>` : `<span>${escapeHtml(attachment.name || "Adjunto")}</span>`).join("")}</div>` : ""}
      <div class="channel-message-status">
        ${direction === "outbound" ? `<span class="delivery-${escapeAttr(message.deliveryStatus || "queued")}">${escapeHtml(channelDeliveryLabel(message.deliveryStatus))}</span>` : ""}
        ${direction === "internal" && message.mentions?.length ? `<span>${escapeHtml(`${message.mentions.length} mencion(es)`)}</span>` : ""}
        ${message.deliveryError ? `<span class="delivery-error">${escapeHtml(message.deliveryError)}</span>` : ""}
      </div>
    </div>
  `;
}

function channelDeliveryLabel(status) {
  return ({ queued: "En cola", sent: "Enviado", delivered: "Entregado", read: "Leido", failed: "Fallido", bounced: "Rebotado", complained: "Marcado como spam", internal: "Interno" })[clean(status)] || "Registrado";
}

function formatChannelDuration(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return "--";
  if (minutes < 60) return `${Math.max(0, Math.round(minutes))} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function modelTimezone() {
  return state.business?.timezone || state.channelInbox?.timezone || "Europe/Madrid";
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

function bindChannelInboxControls() {
  const businessRef = state.business?.id || state.business?.slug || "";
  const selectedId = state.channelSelectedConversationId;
  const refresh = async () => {
    if (businessRef) await loadChannelInbox(businessRef, { render: true });
  };

  document.querySelector("[data-channel-inbox-retry]")?.addEventListener("click", refresh);

  document.querySelector("[data-channel-filter-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await loadChannelInbox(businessRef, {
      channel: form.get("channel"),
      status: form.get("status"),
      search: form.get("search"),
      render: true
    });
  });

  document.querySelectorAll("[data-channel-conversation]").forEach((button) => {
    button.addEventListener("click", () => {
      state.channelSelectedConversationId = clean(button.dataset.channelConversation);
      const conversation = state.channelInbox?.conversations?.find((item) => item.id === state.channelSelectedConversationId);
      if (conversation?.assignedToId) state.channelActorId = conversation.assignedToId;
      render();
    });
  });

  document.querySelectorAll("[data-channel-connection-form]").forEach((formNode) => {
    formNode.addEventListener("submit", async (event) => {
      event.preventDefault();
      const channel = clean(formNode.dataset.channelConnectionForm);
      const form = new FormData(formNode);
      try {
        await putJson(`/api/businesses/${encodeURIComponent(businessRef)}/channels/connections/${encodeURIComponent(channel)}`, {
          provider: form.get("provider"),
          senderId: form.get("senderId"),
          active: form.get("active") === "on",
          firstResponseTargetMinutes: Number(form.get("firstResponseTargetMinutes") || 60)
        });
        showNotice(`${channel === "email" ? "Email" : "WhatsApp"} actualizado.`, "info");
        await refresh();
      } catch (error) {
        showNotice(error.message || "No se pudo guardar la conexion.", "error");
      }
    });
  });

  const actorSelect = document.querySelector("[data-channel-actor]");
  actorSelect?.addEventListener("change", () => {
    state.channelActorId = clean(actorSelect.value);
    render();
  });

  document.querySelector("[data-channel-assignee]")?.addEventListener("change", async (event) => {
    if (!selectedId) return;
    try {
      await patchJson(`/api/businesses/${encodeURIComponent(businessRef)}/channels/conversations/${encodeURIComponent(selectedId)}`, {
        assignedToId: event.currentTarget.value
      });
      showNotice(event.currentTarget.value ? "Conversacion asignada." : "Conversacion sin responsable.", "info");
      await refresh();
    } catch (error) {
      showNotice(error.message || "No se pudo asignar la conversacion.", "error");
    }
  });

  document.querySelector("[data-channel-toggle-status]")?.addEventListener("click", async (event) => {
    if (!selectedId) return;
    const status = clean(event.currentTarget.dataset.channelToggleStatus);
    try {
      await patchJson(`/api/businesses/${encodeURIComponent(businessRef)}/channels/conversations/${encodeURIComponent(selectedId)}`, { status });
      showNotice(status === "closed" ? "Conversacion cerrada." : "Conversacion reabierta.", "info");
      await refresh();
    } catch (error) {
      showNotice(error.message || "No se pudo cambiar el estado.", "error");
    }
  });

  document.querySelector("[data-channel-mark-read]")?.addEventListener("click", async () => {
    if (!selectedId) return;
    try {
      await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/channels/conversations/${encodeURIComponent(selectedId)}/read`, {});
      showNotice("Conversacion marcada como leida.", "info");
      await refresh();
    } catch (error) {
      showNotice(error.message || "No se pudo marcar como leida.", "error");
    }
  });

  document.querySelector("[data-channel-lock]")?.addEventListener("click", async () => {
    if (!selectedId || !state.channelActorId) return;
    const actor = state.channelInbox?.members?.find((member) => member.id === state.channelActorId);
    try {
      await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/channels/conversations/${encodeURIComponent(selectedId)}/lock`, {
        actorId: state.channelActorId,
        actorName: actor?.name || state.channelActorId,
        ttlSeconds: 300
      });
      showNotice("Conversacion reservada durante 5 minutos.", "info");
      await refresh();
    } catch (error) {
      showNotice(error.message || "Otro miembro ya esta trabajando en esta conversacion.", "warn");
      await refresh();
    }
  });

  document.querySelector("[data-channel-unlock]")?.addEventListener("click", async () => {
    if (!selectedId || !state.channelActorId) return;
    try {
      await deleteJson(`/api/businesses/${encodeURIComponent(businessRef)}/channels/conversations/${encodeURIComponent(selectedId)}/lock?actorId=${encodeURIComponent(state.channelActorId)}`);
      showNotice("Turno de conversacion liberado.", "info");
      await refresh();
    } catch (error) {
      showNotice(error.message || "No se pudo liberar la conversacion.", "error");
    }
  });

  document.querySelector("[data-channel-reply-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedId || !state.channelActorId) return;
    const formNode = event.currentTarget;
    const form = new FormData(formNode);
    const actor = state.channelInbox?.members?.find((member) => member.id === state.channelActorId);
    const submit = formNode.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/channels/conversations/${encodeURIComponent(selectedId)}/messages`, {
        body: form.get("body"),
        subject: form.get("subject") || "",
        purpose: form.get("purpose") || "service",
        actorId: state.channelActorId,
        senderName: actor?.name || "Equipo",
        idempotencyKey: `dashboard_${selectedId}_${globalThis.crypto?.randomUUID?.() || Date.now()}`
      });
      formNode.reset();
      showNotice("Mensaje enviado y trazado en el historial.", "info");
      await refresh();
    } catch (error) {
      showNotice(error.message || "No se pudo enviar el mensaje.", error.status === 409 ? "warn" : "error");
      if (submit) submit.disabled = false;
    }
  });

  document.querySelector("[data-channel-note-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedId || !state.channelActorId) return;
    const formNode = event.currentTarget;
    const form = new FormData(formNode);
    const actor = state.channelInbox?.members?.find((member) => member.id === state.channelActorId);
    try {
      await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/channels/conversations/${encodeURIComponent(selectedId)}/notes`, {
        body: form.get("body"),
        mentions: form.getAll("mentions"),
        senderName: actor?.name || "Equipo"
      });
      formNode.reset();
      showNotice("Nota interna guardada.", "info");
      await refresh();
    } catch (error) {
      showNotice(error.message || "No se pudo guardar la nota.", "error");
    }
  });
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
    tasks.push(taskItem("Preparar pedidos pendientes", `${model.pendingOrders.length} pedido(s) abiertos.`, "commerce"));
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

  const queues = model.taskQueues || emptyTaskQueues();
  const members = model.taskMembers || [];
  const linkOptions = taskLinkOptions(model);
  const dependencyOptions = queues.team || [];
  container.innerHTML = `
    <section class="task-workspace" data-task-workspace>
      <header class="task-workspace-header">
        <div>
          <p class="eyebrow">Trabajo coordinado</p>
          <h3>Tareas y responsables</h3>
          <p>Varias tareas por cliente u oportunidad, con vencimientos, recordatorios, recurrencia y trazabilidad.</p>
        </div>
        <div class="task-workspace-metrics">
          <span><strong>${escapeHtml(String(queues.today.length))}</strong> hoy</span>
          <span><strong>${escapeHtml(String(queues.overdue.length))}</strong> vencidas</span>
          <span><strong>${escapeHtml(String(queues.unassigned.length))}</strong> sin asignar</span>
        </div>
      </header>

      ${state.taskError ? `<div class="task-state task-state-error" role="alert"><strong>Tareas no disponibles</strong><span>${escapeHtml(state.taskError)}</span><button type="button" data-tasks-retry>Reintentar</button></div>` : ""}

      <form class="task-create-form" data-task-create-form>
        <div class="task-create-intro"><strong>Nueva tarea</strong><small>Relaciona el trabajo con el registro que le da contexto.</small></div>
        <label class="task-title-field">Titulo<input name="title" maxlength="240" required placeholder="Ej. Confirmar alcance y siguiente paso"></label>
        <label>Tipo<select name="type"><option value="follow_up">Seguimiento</option><option value="call">Llamada</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="meeting">Reunion</option><option value="proposal">Propuesta</option><option value="booking">Reserva</option><option value="admin">Administrativa</option><option value="other">Otra</option></select></label>
        <label>Prioridad<select name="priority"><option value="normal">Normal</option><option value="high">Alta</option><option value="urgent">Urgente</option><option value="low">Baja</option></select></label>
        <label>Responsable<select name="ownerId"><option value="">Sin asignar</option>${members.map((member) => `<option value="${escapeAttr(member.id)}">${escapeHtml(member.name)}</option>`).join("")}</select></label>
        <label>Vence<input name="dueAt" type="datetime-local" value="${escapeAttr(dateTimeLocalValue(addHours(new Date(), 1)))}"></label>
        <label>Recordar<input name="reminderAt" type="datetime-local"></label>
        <label>Recurrencia<select name="recurrence"><option value="none">No se repite</option><option value="daily">Diaria</option><option value="weekly">Semanal</option><option value="monthly">Mensual</option><option value="yearly">Anual</option></select></label>
        <label>Relacion<select name="link"><option value="">Sin relacion</option>${linkOptions}</select></label>
        <label>Participantes<select name="participantIds" multiple size="3">${members.map((member) => `<option value="${escapeAttr(member.id)}">${escapeHtml(member.name)}</option>`).join("")}</select></label>
        <label>Depende de<select name="dependencyIds" multiple size="3">${dependencyOptions.map((task) => `<option value="${escapeAttr(task.id)}">${escapeHtml(task.title)}</option>`).join("")}</select></label>
        <label class="task-description-field">Detalle<textarea name="description" rows="2" maxlength="10000" placeholder="Contexto, entregable o criterio de cierre"></textarea></label>
        <button type="submit">Crear tarea</button>
      </form>

      ${members.length ? `
        <div class="task-owner-filter">
          <label>Vista «Mias»<select data-task-owner-filter>${members.map((member) => `<option value="${escapeAttr(member.id)}"${member.id === model.taskOwnerId ? " selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}</select></label>
          <small>La seleccion solo cambia la cola personal; la vista de equipo conserva todo el trabajo activo.</small>
        </div>
      ` : '<p class="task-member-empty">Añade integrantes desde el portal de cliente para asignar responsables y participantes.</p>'}

      ${renderUnownedDeals(queues.unownedDeals, members, model.currency)}
      ${state.taskLoading ? '<div class="task-state" role="status"><strong>Cargando tareas...</strong></div>' : `
        <div class="task-queue-grid">
          ${renderTaskQueue("Hoy", "Vencen durante el dia.", queues.today, "today", members)}
          ${renderTaskQueue("Vencidas", "Fuera de plazo y aun abiertas.", queues.overdue, "overdue", members)}
          ${renderTaskQueue("Sin asignar", "Necesitan un responsable.", queues.unassigned, "unassigned", members)}
          ${renderTaskQueue("Mias", model.taskOwnerId ? "Trabajo del responsable seleccionado." : "Selecciona un responsable.", queues.mine, "mine", members)}
          ${renderTaskQueue("Equipo", "Todo el trabajo activo, sin ocultar tareas.", queues.team, "team", members)}
        </div>
      `}
    </section>
  `;
}

function renderTaskQueue(title, subtitle, tasks, kind, members) {
  return `
    <section class="task-queue task-queue-${escapeAttr(kind)}" data-task-queue="${escapeAttr(kind)}">
      <header><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle)}</small></span><b>${escapeHtml(String(tasks.length))}</b></header>
      <div class="task-list">${tasks.length ? tasks.map((task) => renderTaskCard(task, members)).join("") : '<p class="pipeline-empty">Sin tareas en esta cola.</p>'}</div>
    </section>
  `;
}

function renderTaskCard(task, members) {
  const relations = Array.isArray(task.relations) ? task.relations.filter((relation) => relation.related) : [];
  const ownerName = task.owner?.name || "Sin asignar";
  return `
    <article class="task-card${task.isOverdue ? " is-overdue" : ""}" data-task-card data-task-id="${escapeAttr(task.id)}">
      <header><strong>${escapeHtml(task.title || "Tarea")}</strong><span class="task-priority task-priority-${escapeAttr(task.priority || "normal")}">${escapeHtml(taskPriorityLabel(task.priority))}</span></header>
      ${task.description ? `<p>${escapeHtml(task.description)}</p>` : ""}
      <div class="task-card-meta">
        <span>${escapeHtml(taskTypeLabel(task.type))}</span>
        <span>${task.dueAt ? escapeHtml(formatDateTime(task.dueAt)) : "Sin vencimiento"}</span>
        ${task.reminderAt ? `<span>Recordatorio ${escapeHtml(formatDateTime(task.reminderAt))}</span>` : ""}
        ${task.recurrence && task.recurrence !== "none" ? `<span>${escapeHtml(taskRecurrenceLabel(task.recurrence))}</span>` : ""}
      </div>
      ${relations.length ? `<div class="task-relations">${relations.slice(0, 3).map((relation) => `<span>${escapeHtml(`${entityTypeLabel(relation.related.type)}: ${relation.related.name}`)}</span>`).join("")}</div>` : ""}
      ${task.dependencies?.length ? `<small class="task-dependencies">Depende de: ${escapeHtml(task.dependencies.map((item) => item.title).join(", "))}</small>` : ""}
      <label class="task-owner-control">Responsable<select data-task-owner data-task-id="${escapeAttr(task.id)}"><option value="">Sin asignar</option>${members.map((member) => `<option value="${escapeAttr(member.id)}"${member.id === task.ownerId ? " selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}</select></label>
      <footer><small>${escapeHtml(ownerName)}</small><span>${task.status === "pending" ? `<button type="button" data-task-start data-task-id="${escapeAttr(task.id)}">En curso</button>` : ""}<button type="button" data-task-complete data-task-id="${escapeAttr(task.id)}">Completar</button><button class="task-archive" type="button" data-task-archive data-task-id="${escapeAttr(task.id)}">Archivar</button></span></footer>
    </article>
  `;
}

function renderUnownedDeals(deals, members, currency) {
  if (!deals.length) return "";
  return `
    <section class="unowned-deals" data-unowned-deals>
      <header><div><strong>Oportunidades sin responsable</strong><small>Asignarlas evita ventas abiertas sin dueño.</small></div><span>${escapeHtml(String(deals.length))}</span></header>
      <div>${deals.map((deal) => `<article><span><strong>${escapeHtml(deal.title || "Oportunidad")}</strong><small>${escapeHtml(formatMoney(deal.value || 0, currency))}</small></span><select data-unowned-deal-owner data-deal-id="${escapeAttr(deal.id)}"><option value="">Asignar...</option>${members.map((member) => `<option value="${escapeAttr(member.id)}">${escapeHtml(member.name)}</option>`).join("")}</select></article>`).join("")}</div>
    </section>
  `;
}

function taskLinkOptions(model) {
  const groups = [
    ["deal", model.deals, (item) => item.title],
    ["contact", model.contacts.filter((item) => !item.merged), (item) => contactName(item)],
    ["account", model.accounts, (item) => item.name],
    ["proposal", model.proposals, (item) => item.title || item.package || item.id],
    ["booking", model.bookings, (item) => item.customerName || item.serviceName || item.id]
  ];
  return groups.flatMap(([type, items, label]) => items.map((item) => `<option value="${escapeAttr(`${type}:${item.id}`)}">${escapeHtml(`${entityTypeLabel(type)} · ${label(item)}`)}</option>`)).join("");
}

function renderLeads(model) {
  const container = document.querySelector('[data-list="leads"]');

  if (!container) {
    return;
  }

  if (!model.contacts.length && !model.deals.length && !state.dealError) {
    container.innerHTML = emptyState("Sin contactos ni oportunidades", "El formulario web y el chatbot guardaran aqui las personas; despues podras abrir una o varias oportunidades para cada una.");
    return;
  }

  container.innerHTML = `
    ${renderDealWorkspace(model)}
    ${renderConsentCenter(model)}
    ${model.leads.length ? `
      <details class="legacy-crm-panel"${model.deals.length ? "" : " open"}>
        <summary>
          <span>
            <strong>Contactos y seguimiento heredado</strong>
            <small>Compatibilidad temporal: estado, scoring, proxima accion, notas y timeline de la persona.</small>
          </span>
          <span>${escapeHtml(String(model.leads.length))}</span>
        </summary>
        <div class="legacy-crm-content">
          ${renderLegacyContactPipeline(model)}
        </div>
      </details>
    ` : ""}
  `;
}

function renderConsentCenter(model) {
  const contacts = model.contacts.filter((contact) => !contact.merged);
  if (!contacts.length) return "";
  const center = model.consentCenter || {};
  const selectedId = contacts.some((contact) => contact.id === center.contactId) ? center.contactId : contacts[0].id;
  const data = center.data || {};
  const preferences = data.preferences || {};
  const enabled = (channel, purpose) => preferences[channel]?.[purpose]?.allowed === true && preferences[channel]?.[purpose]?.suppressed !== true;
  const events = Array.isArray(data.events) ? data.events.slice(0, 5) : [];
  return `
    <section class="consent-center" data-consent-center>
      <header><div><p class="eyebrow">Privacidad demostrable</p><h3>Consentimientos y preferencias</h3><p>El aviso de privacidad no activa marketing. Cada permiso, retirada y supresion queda como evento inmutable.</p></div><span>${escapeHtml(String(data.total || 0))} evento(s)</span></header>
      ${center.error ? `<div class="task-state task-state-error"><span>${escapeHtml(center.error)}</span><button type="button" data-consent-retry>Reintentar</button></div>` : ""}
      <div class="consent-center-grid">
        <form data-consent-form data-contact-id="${escapeAttr(selectedId)}">
          <label>Contacto<select data-consent-contact>${contacts.map((contact) => `<option value="${escapeAttr(contact.id)}"${contact.id === selectedId ? " selected" : ""}>${escapeHtml(contactName(contact))}</option>`).join("")}</select></label>
          <label class="consent-toggle"><input type="checkbox" name="emailMarketing"${enabled("email", "marketing") ? " checked" : ""}>Email comercial</label>
          <label class="consent-toggle"><input type="checkbox" name="whatsappMarketing"${enabled("whatsapp", "marketing") ? " checked" : ""}>WhatsApp comercial</label>
          <label class="consent-toggle"><input type="checkbox" name="emailReviews"${enabled("email", "reviews") ? " checked" : ""}>Solicitudes de reseña por email</label>
          <label class="consent-toggle consent-suppression"><input type="checkbox" name="globalSuppressed"${data.globalSuppressed ? " checked" : ""}>Supresion global: no contactar</label>
          <button type="submit"${center.loading ? " disabled" : ""}>Guardar preferencias</button>
        </form>
        <div class="consent-ledger">
          <header><strong>Ledger reciente</strong><small>${data.lastNotice ? `Aviso ${escapeHtml(data.lastNotice.textVersion || "registrado")}` : "Sin aviso registrado"}</small></header>
          ${center.loading ? '<p class="pipeline-empty">Cargando preferencias...</p>' : events.length ? events.map((event) => `<article><span><strong>${escapeHtml(consentActionLabel(event.action))}</strong><small>${escapeHtml(`${consentScopeLabel(event.channel, event.purpose)} · ${event.source || "sistema"}`)}</small></span><time datetime="${escapeAttr(event.occurredAt || event.createdAt || "")}">${escapeHtml(formatDateTime(event.occurredAt || event.createdAt))}</time></article>`).join("") : '<p class="pipeline-empty">Todavia no hay evidencias de consentimiento.</p>'}
        </div>
      </div>
    </section>
  `;
}

function renderLegacyContactPipeline(model) {
  const filteredLeads = filterLeadsByScore(model.leads);
  const pipeline = state.scoreLabelFilter === "all"
    ? (model.pipeline || buildPipelineModel(model.leads))
    : buildPipelineModel(filteredLeads);

  return `
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

function renderDealWorkspace(model) {
  const board = model.dealPipeline || normalizeDealPipelinePayload({});
  const selectedPipeline = board.pipeline || model.pipelines.find((pipeline) => pipeline.id === state.dealPipelineId) || model.pipelines[0] || null;
  const contacts = model.contacts.filter((contact) => !contact.merged);

  return `
    <section class="deal-workspace" data-deal-workspace>
      <header class="deal-workspace-header">
        <span>
          <p class="eyebrow">Pipeline relacional</p>
          <h3>Oportunidades</h3>
          <small>Una persona puede tener varias ventas con etapa, valor y cierre independientes.</small>
        </span>
        <div class="deal-workspace-metrics" aria-label="Resumen de oportunidades">
          <span><strong>${escapeHtml(String(board.total || 0))}</strong> activas</span>
          <span><strong>${escapeHtml(formatMoney(board.totalValue || 0, model.currency))}</strong> valor</span>
        </div>
      </header>

      ${state.dealError ? `
        <div class="deal-state deal-state-error" role="alert">
          <strong>No pudimos consultar las oportunidades</strong>
          <span>${escapeHtml(state.dealError)}</span>
          <button type="button" data-deals-retry>Reintentar</button>
        </div>
      ` : ""}

      ${renderAccountWorkspace(model)}

      ${contacts.length && model.pipelines.length ? `
        <form class="deal-create-form" data-deal-create-form>
          <div>
            <strong>Nueva oportunidad</strong>
            <small>Crea otra venta sin duplicar la persona.</small>
          </div>
          <label>Nombre<input name="title" maxlength="180" required placeholder="Ej. Web y captacion local"></label>
          <label>Persona<select name="contactId" required>${contacts.map((contact) => `<option value="${escapeAttr(contact.id)}">${escapeHtml(contactName(contact))}</option>`).join("")}</select></label>
          <label>Cuenta<select name="accountId"><option value="">Sin cuenta</option>${model.accounts.map((account) => `<option value="${escapeAttr(account.id)}">${escapeHtml(account.name)}</option>`).join("")}</select></label>
          <label>Pipeline<select name="pipelineId" required>${model.pipelines.map((pipeline) => `<option value="${escapeAttr(pipeline.id)}"${pipeline.id === selectedPipeline?.id ? " selected" : ""}>${escapeHtml(pipeline.name || "Ventas")}</option>`).join("")}</select></label>
          <label>Valor<input name="value" type="number" min="0" max="100000000" step="0.01" value="0" required></label>
          <label>Prioridad<select name="priority"><option value="alta">Alta</option><option value="media" selected>Media</option><option value="baja">Baja</option></select></label>
          <label>Responsable<select name="ownerId"><option value="">Sin asignar</option>${model.taskMembers.map((member) => `<option value="${escapeAttr(member.id)}">${escapeHtml(member.name)}</option>`).join("")}</select></label>
          <label>Cierre previsto<input name="expectedCloseAt" type="date"></label>
          <button type="submit">Crear oportunidad</button>
        </form>
      ` : contacts.length ? '<p class="pipeline-empty">Configura un pipeline para poder crear oportunidades.</p>' : '<p class="pipeline-empty">Primero crea o captura una persona en el CRM.</p>'}

      ${model.pipelines.length > 1 ? `
        <div class="deal-pipeline-toolbar">
          <label>Pipeline
            <select data-deal-pipeline-select>
              ${model.pipelines.map((pipeline) => `<option value="${escapeAttr(pipeline.id)}"${pipeline.id === selectedPipeline?.id ? " selected" : ""}>${escapeHtml(pipeline.name || "Ventas")}</option>`).join("")}
            </select>
          </label>
        </div>
      ` : ""}

      ${state.dealLoading ? '<div class="deal-state" role="status"><strong>Cargando oportunidades...</strong></div>' : renderDealBoard(board, model.currency)}
    </section>
  `;
}

function renderAccountWorkspace(model) {
  const contacts = model.contacts.filter((contact) => !contact.merged);
  return `
    <details class="account-workspace"${model.accounts.length ? "" : " open"}>
      <summary>
        <span>
          <strong>Cuentas y relaciones</strong>
          <small>Empresas, hogares o grupos conectados con personas, oportunidades y operaciones.</small>
        </span>
        <span>${escapeHtml(String(model.accounts.length))}</span>
      </summary>
      <div class="account-workspace-content">
        ${state.accountError ? `<div class="deal-state deal-state-error" role="alert"><strong>Cuentas no disponibles</strong><span>${escapeHtml(state.accountError)}</span><button type="button" data-accounts-retry>Reintentar</button></div>` : ""}
        <form class="account-create-form" data-account-create-form>
          <div><strong>Nueva cuenta</strong><small>No duplica a la persona; la agrupa.</small></div>
          <label>Nombre<input name="name" maxlength="180" required placeholder="Ej. Acme Sevilla"></label>
          <label>Tipo<select name="type"><option value="company">Empresa</option><option value="household">Hogar</option><option value="group">Grupo</option></select></label>
          <label>Dominio<input name="domain" maxlength="240" placeholder="empresa.com"></label>
          <label>NIF / CIF<input name="taxId" maxlength="80"></label>
          <label>Ciudad<input name="city" maxlength="160"></label>
          <button type="submit">Crear cuenta</button>
        </form>
        ${renderAccountDuplicateGroups(model.accountDuplicateGroups)}
        <div class="account-grid">
          ${state.accountLoading
            ? '<div class="deal-state" role="status"><strong>Cargando cuentas...</strong></div>'
            : model.accounts.length
              ? model.accounts.map((account) => renderAccountCard(account, contacts)).join("")
              : '<p class="pipeline-empty">Aun no hay cuentas. Puedes trabajar con personas individuales o crear la primera empresa o grupo.</p>'}
        </div>
      </div>
    </details>
  `;
}

function renderAccountDuplicateGroups(groups) {
  if (!Array.isArray(groups) || !groups.length) return "";
  return `
    <section class="account-duplicate-panel">
      <header><strong>Posibles cuentas duplicadas</strong><span>${escapeHtml(String(groups.length))}</span></header>
      ${groups.map((group) => `
        <article data-account-duplicate-group="${escapeAttr(group.id)}">
          <label>Conservar
            <select data-account-merge-survivor>
              ${(group.accounts || []).map((account) => `<option value="${escapeAttr(account.id)}">${escapeHtml(account.name)}</option>`).join("")}
            </select>
          </label>
          <small>${escapeHtml((group.accounts || []).map((account) => account.domain || account.taxId || account.name).join(" · "))}</small>
          <button type="button" data-account-merge data-group-id="${escapeAttr(group.id)}">Fusionar sin borrar historial</button>
        </article>
      `).join("")}
    </section>
  `;
}

function renderAccountCard(account, contacts) {
  const relations = Array.isArray(account.relations) ? account.relations : [];
  return `
    <article class="account-card" data-account-card data-account-id="${escapeAttr(account.id)}">
      <header>
        <span><strong>${escapeHtml(account.name)}</strong><small>${escapeHtml(accountTypeLabel(account.type))}${account.city ? ` · ${escapeHtml(account.city)}` : ""}</small></span>
        <span>${escapeHtml(String(relations.length))} relaciones</span>
      </header>
      <p>${escapeHtml([account.domain, account.taxId, account.phone, account.email].filter(Boolean).join(" · ") || "Sin identificadores adicionales")}</p>
      ${relations.length ? `
        <ul class="account-relation-list">
          ${relations.map((relation) => `
            <li>
              <span><strong>${escapeHtml(relation.related?.name || "Registro relacionado")}</strong><small>${escapeHtml(`${associationTypeLabel(relation.related?.type)} · ${associationKindLabel(relation.kind)}`)}</small></span>
              <button type="button" data-association-archive data-association-id="${escapeAttr(relation.id)}" aria-label="Quitar relacion con ${escapeAttr(relation.related?.name || "registro")}">Quitar</button>
            </li>
          `).join("")}
        </ul>
      ` : '<p class="account-empty-relations">Sin relaciones todavia.</p>'}
      ${contacts.length ? `
        <form class="account-link-form" data-account-link-form data-account-id="${escapeAttr(account.id)}">
          <label>Vincular persona<select name="contactId">${contacts.map((contact) => `<option value="${escapeAttr(contact.id)}">${escapeHtml(contactName(contact))}</option>`).join("")}</select></label>
          <label>Relacion<select name="kind"><option value="member">Miembro</option><option value="decision_maker">Decisor</option><option value="billing">Facturacion</option><option value="owner">Propietario</option><option value="related">Relacionada</option></select></label>
          <button type="submit">Vincular</button>
        </form>
      ` : ""}
      <button class="account-archive-button" type="button" data-account-archive data-account-id="${escapeAttr(account.id)}">Archivar cuenta</button>
    </article>
  `;
}

function renderDealBoard(board, fallbackCurrency) {
  if (!board.pipeline || !board.columns.length) {
    return '<p class="pipeline-empty">El pipeline aparecera aqui cuando este disponible.</p>';
  }

  return `
    <div class="pipeline-grid deal-pipeline-grid" data-deal-board data-pipeline-id="${escapeAttr(board.pipeline.id)}">
      ${board.columns.map((column) => `
        <section class="pipeline-column deal-pipeline-column" data-deal-pipeline-column="${escapeAttr(column.stageId)}">
          <header>
            <span>
              <strong>${escapeHtml(column.stage?.name || column.stageId)}</strong>
              <small>${escapeHtml(formatMoney(column.totalValue || 0, fallbackCurrency))} · ${escapeHtml(String(column.stage?.probability ?? 0))}%</small>
            </span>
            <span>${escapeHtml(String(column.count || column.deals.length))}</span>
          </header>
          <div class="pipeline-stack" data-deal-dropzone data-stage-id="${escapeAttr(column.stageId)}">
            ${column.deals.length
              ? column.deals.map((deal) => renderDealCard(deal, board.pipeline, fallbackCurrency)).join("")
              : '<p class="pipeline-empty">Sin oportunidades</p>'}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

function renderDealCard(deal, pipeline, fallbackCurrency) {
  const contact = deal.contact || state.contacts.find((item) => item.id === deal.contactId) || {};
  const stages = Array.isArray(pipeline?.stages) ? pipeline.stages.slice().sort((left, right) => Number(left.order || 0) - Number(right.order || 0)) : [];
  const detail = [contact.phone, contact.email].filter(Boolean).join(" / ") || "Sin contacto directo";

  return `
    <article class="lead-card deal-card" draggable="true" data-deal-card data-deal-id="${escapeAttr(deal.id)}" data-stage-id="${escapeAttr(deal.stageId)}" data-order="${escapeAttr(deal.order ?? "")}">
      <header>
        <strong>${escapeHtml(deal.title || "Oportunidad")}</strong>
        <div class="lead-card-badges">
          ${priorityPill(deal.priority)}
          <span class="pill neutral">${escapeHtml(`${deal.probability || 0}%`)}</span>
        </div>
      </header>
      <p class="deal-contact-name">${escapeHtml(contactName(contact))}</p>
      ${deal.account ? `<p class="deal-account-name">Cuenta: ${escapeHtml(deal.account.name)}</p>` : ""}
      <div class="lead-card-meta">
        <span>${escapeHtml(deal.source || "dashboard")}</span>
        <strong>${escapeHtml(formatMoney(deal.value || 0, deal.currency || fallbackCurrency))}</strong>
      </div>
      <p>${escapeHtml(detail)}</p>
      ${deal.expectedCloseAt ? `<small>Cierre previsto: ${escapeHtml(formatDate(deal.expectedCloseAt))}</small>` : ""}
      <label class="status-field">Responsable
        <select data-deal-owner data-deal-id="${escapeAttr(deal.id)}">
          <option value="">Sin asignar</option>
          ${state.taskMembers.map((member) => `<option value="${escapeAttr(member.id)}"${member.id === deal.ownerId ? " selected" : ""}>${escapeHtml(member.name)}</option>`).join("")}
        </select>
      </label>
      ${deal.status === "lost" && deal.lostReason ? `<span class="lost-reason-chip">Motivo: ${escapeHtml(lostReasonLabel(deal.lostReason))}</span>` : ""}
      <label class="status-field">Etapa
        <select data-deal-stage data-deal-id="${escapeAttr(deal.id)}">
          ${stages.map((stage) => `<option value="${escapeAttr(stage.id)}"${stage.id === deal.stageId ? " selected" : ""}>${escapeHtml(stage.name || stage.id)}</option>`).join("")}
        </select>
      </label>
      <div class="lead-card-actions">
        ${contact.id ? `
          <button class="message-contact-button" type="button" data-prepare-message-for-contact data-contact-id="${escapeAttr(contact.id)}" draggable="false">Preparar mensaje</button>
          <button class="proposal-contact-button" type="button" data-create-proposal-for-contact data-contact-id="${escapeAttr(contact.id)}" draggable="false">Crear propuesta</button>
          <button class="timeline-open-button" type="button" data-contact-timeline data-contact-id="${escapeAttr(contact.id)}" draggable="false">Ver persona</button>
        ` : ""}
        <button class="deal-archive-button" type="button" data-deal-archive data-deal-id="${escapeAttr(deal.id)}" draggable="false">Archivar</button>
      </div>
    </article>
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
          <h3 id="proposalFormTitle">Crear propuesta de cierre</h3>
          <p>Versionada, firmable, con impuestos, señal, pago y conversion automatica.</p>
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
        <label class="proposal-field proposal-field-title" for="proposalTitle">
          Titulo publico
          <input id="proposalTitle" name="title" maxlength="240" placeholder="Ej. Transformacion digital completa" required>
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
        <label class="proposal-field" for="proposalSetupDiscount">
          Descuento alta
          <span class="proposal-money-input"><input id="proposalSetupDiscount" name="setupDiscount" type="number" min="0" max="100" step="0.01" value="0"><span aria-hidden="true">%</span></span>
        </label>
        <label class="proposal-field" for="proposalMonthlyDiscount">
          Descuento mensual
          <span class="proposal-money-input"><input id="proposalMonthlyDiscount" name="monthlyDiscount" type="number" min="0" max="100" step="0.01" value="0"><span aria-hidden="true">%</span></span>
        </label>
        <label class="proposal-field" for="proposalTaxRate">
          Impuesto
          <span class="proposal-money-input"><input id="proposalTaxRate" name="taxRate" type="number" min="0" max="100" step="0.01" value="21"><span aria-hidden="true">%</span></span>
        </label>
        <label class="proposal-field" for="proposalDepositMode">
          Cobro inicial
          <select id="proposalDepositMode" name="depositMode"><option value="none">Sin señal</option><option value="percent">Porcentaje</option><option value="fixed">Importe fijo</option><option value="full">Pago completo</option></select>
        </label>
        <label class="proposal-field" for="proposalDepositValue">
          Valor señal
          <input id="proposalDepositValue" name="depositValue" type="number" min="0" step="0.01" value="0">
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
        <label class="proposal-field proposal-field-signature"><input name="signatureRequired" type="checkbox" checked><span>Exigir firma electronica para aceptar</span></label>
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
  const quoteStage = clean(proposal?.quoteStage || status);
  const proposalCurrency = proposal?.currency || currency;
  const contact = contacts.find((item) => item.id === proposal?.contactId) || proposal?.contact || null;
  const contactLabel = contact ? contactName(contact) : clean(proposal?.contactName || proposal?.contactId || "Contacto no disponible");
  const conditions = String(proposal?.conditions || "Sin condiciones adicionales.").trim();
  const createdAt = proposal?.createdAt || proposal?.updatedAt || "";
  const versions = Array.isArray(proposal?.versions) ? proposal.versions : [];
  const comments = Array.isArray(proposal?.comments) ? proposal.comments : [];
  const decisions = Array.isArray(proposal?.decisions) ? proposal.decisions : [];
  const paymentSchedule = Array.isArray(proposal?.paymentSchedule) ? proposal.paymentSchedule : [];
  const invoice = proposal?.invoice || null;
  const canManage = !state.clientSession;
  const generatedShare = state.proposalShareLinks?.[proposalId] || "";

  return `
    <article class="proposal-card proposal-qtc-card" data-proposal-card="${escapeAttr(proposalId)}" tabindex="-1">
      <header>
        <div>
          <span>${escapeHtml(proposalPackageLabel(proposal?.package))} · v${escapeHtml(String(proposal?.revision || versions[0]?.number || 1))}</span>
          <h4>${escapeHtml(proposal?.title || contactLabel)}</h4>
          <small>${escapeHtml(contactLabel)} · ${createdAt ? `creada ${escapeHtml(formatDate(createdAt))}` : "propuesta comercial"}</small>
        </div>
        <span class="pill proposal-status ${escapeAttr(status)}">${escapeHtml(quoteStageLabel(quoteStage))}</span>
      </header>
      <div class="proposal-value-grid">
        <span>
          <small>Total con impuestos</small>
          <strong>${escapeHtml(formatMoney(Number(proposal?.total || proposal?.setupPrice || 0), proposalCurrency))}</strong>
        </span>
        <span>
          <small>Recurrente</small>
          <strong>${escapeHtml(formatMoney(Number(proposal?.recurringTotal || proposal?.monthlyPrice || 0), proposalCurrency))}</strong>
        </span>
        <span><small>Aperturas</small><strong>${escapeHtml(String(proposal?.views?.count || proposal?.publicState?.viewCount || 0))}</strong></span>
        <span><small>Pendiente</small><strong>${escapeHtml(formatMoney(Number(invoice?.balance ?? proposal?.total ?? 0), proposalCurrency))}</strong></span>
      </div>
      <div class="proposal-qtc-flow" aria-label="Flujo de cierre">${["draft", "sent", "viewed", "accepted", "paid"].map((stage) => `<span class="${quoteStageReached(quoteStage, stage) ? "is-done" : ""}${quoteStage === stage ? " is-current" : ""}">${escapeHtml(quoteStageLabel(stage))}</span>`).join("")}</div>
      <div class="proposal-expiry">
        <span>Vigencia · ${escapeHtml(String(proposal?.lineItems?.length || 0))} linea(s) · ${proposal?.signatureRequired === false ? "firma opcional" : "firma requerida"}</span>
        <strong>${escapeHtml(proposal?.expiresAt ? formatDate(proposal.expiresAt) : "Sin fecha")}</strong>
      </div>
      <p class="proposal-conditions">${escapeHtml(conditions)}</p>
      <footer>
        ${canManage ? `<label class="proposal-status-field">
          Actualizar estado
          <select data-proposal-status data-proposal-id="${escapeAttr(proposalId)}" data-current-status="${escapeAttr(status)}" aria-label="Estado de la propuesta para ${escapeAttr(contactLabel)}">
            ${PROPOSAL_STATUSES.map((item) => `<option value="${escapeAttr(item)}"${item === status ? " selected" : ""}>${escapeHtml(statusLabel(item))}</option>`).join("")}
          </select>
        </label>` : `<span class="proposal-readonly-label">Vista de cliente</span>`}
        <div class="proposal-export-actions" role="group" aria-label="Exportar propuesta para ${escapeAttr(contactLabel)}">
          <button type="button" data-proposal-export="html" data-proposal-id="${escapeAttr(proposalId)}">HTML</button>
          <button type="button" data-proposal-export="pdf" data-proposal-id="${escapeAttr(proposalId)}">PDF</button>
          ${canManage && proposal?.approval?.required && proposal.approval.status !== "approved" ? `<button type="button" data-proposal-approve data-proposal-id="${escapeAttr(proposalId)}">Aprobar descuento</button>` : ""}
          ${canManage && !["aceptada", "rechazada", "caducada"].includes(status) ? `<button type="button" class="proposal-share-button" data-proposal-share data-proposal-id="${escapeAttr(proposalId)}">Crear enlace seguro</button>` : ""}
          ${canManage && status === "aceptada" && !invoice ? `<button type="button" data-proposal-outputs data-proposal-id="${escapeAttr(proposalId)}">Reconciliar cobro</button>` : ""}
        </div>
      </footer>
      ${generatedShare ? `<div class="proposal-share-result"><span>Enlace nuevo listo</span><a href="${escapeAttr(generatedShare)}" target="_blank" rel="noopener">Abrir propuesta publica</a><button type="button" data-copy-text="${escapeAttr(generatedShare)}">Copiar enlace</button></div>` : ""}
      <details class="proposal-qtc-detail">
        <summary>Versiones, firma, cobros y actividad</summary>
        <div class="proposal-qtc-detail-grid">
          <section><h5>Documento</h5><dl><div><dt>Versiones</dt><dd>${escapeHtml(String(versions.length || 1))}</dd></div><div><dt>Descuento maximo</dt><dd>${escapeHtml(String(proposal?.approval?.maxDiscountPercent || 0))}%</dd></div><div><dt>Aprobacion</dt><dd>${escapeHtml(proposalApprovalLabel(proposal?.approval))}</dd></div><div><dt>Señal</dt><dd>${escapeHtml(formatMoney(Number(proposal?.deposit?.amount || 0), proposalCurrency))}</dd></div></dl></section>
          <section><h5>Cliente</h5><dl><div><dt>Primera apertura</dt><dd>${proposal?.views?.firstAt ? escapeHtml(formatDateTime(proposal.views.firstAt)) : "Sin abrir"}</dd></div><div><dt>Ultima apertura</dt><dd>${proposal?.views?.lastAt ? escapeHtml(formatDateTime(proposal.views.lastAt)) : "-"}</dd></div><div><dt>Comentarios</dt><dd>${escapeHtml(String(comments.length))}</dd></div><div><dt>Decision</dt><dd>${escapeHtml(decisions[0] ? quoteDecisionLabel(decisions[0].decision) : "Pendiente")}</dd></div></dl></section>
          <section><h5>Quote-to-cash</h5><dl><div><dt>Proyecto</dt><dd>${proposal?.projectId ? "Creado" : "Pendiente"}</dd></div><div><dt>Factura</dt><dd>${invoice ? `${escapeHtml(invoice.number)} · ${escapeHtml(invoice.status)}` : "Pendiente"}</dd></div><div><dt>Suscripcion</dt><dd>${proposal?.subscription ? escapeHtml(proposal.subscription.status) : "No aplica o pendiente"}</dd></div><div><dt>Pagado</dt><dd>${escapeHtml(formatMoney(Number(invoice?.paidAmount || 0), proposalCurrency))}</dd></div></dl></section>
        </div>
        ${paymentSchedule.length ? `<ol class="proposal-payment-schedule">${paymentSchedule.map((item) => `<li class="is-${escapeAttr(item.status)}"><span>${item.status === "paid" ? "✓" : item.order}</span><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(formatMoney(item.amount, item.currency || proposalCurrency))} · ${escapeHtml(formatDateTime(item.dueAt))}</small></li>`).join("")}</ol>` : ""}
        ${comments.length ? `<ul class="proposal-public-comments">${comments.slice(0, 4).map((item) => `<li><strong>${escapeHtml(item.authorName)}</strong><span>${escapeHtml(item.message)}</span><small>${escapeHtml(formatDateTime(item.createdAt))}</small></li>`).join("")}</ul>` : ""}
      </details>
    </article>
  `;
}

function quoteStageLabel(value) { return ({ draft: "Borrador", sent: "Enviada", viewed: "Vista", accepted: "Aceptada", partially_paid: "Pago parcial", paid: "Pagada", rejected: "Rechazada", expired: "Caducada", borrador: "Borrador", enviada: "Enviada", vista: "Vista", aceptada: "Aceptada", rechazada: "Rechazada", caducada: "Caducada" })[clean(value)] || clean(value) || "Propuesta"; }
function quoteStageReached(current, target) { const order = ["draft", "sent", "viewed", "accepted", "partially_paid", "paid"]; const currentIndex = order.indexOf(clean(current)); const targetIndex = order.indexOf(target); return currentIndex >= 0 && targetIndex >= 0 && currentIndex >= targetIndex; }
function proposalApprovalLabel(approval) { if (!approval?.required) return "No necesaria"; return ({ pending: "Pendiente", approved: "Aprobada", rejected: "Rechazada" })[approval.status] || approval.status || "Pendiente"; }
function quoteDecisionLabel(value) { return ({ accepted: "Aceptada y firmada", rejected: "Rechazada", changes_requested: "Cambios solicitados" })[value] || value || "Pendiente"; }

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
  const customer360 = model.customer360;
  const campaignCenter = renderCampaignCenter(model);
  const loyaltyCenter = renderLoyaltyCenter(model);

  if (state.customer360Loading && !customer360) {
    container.innerHTML = `<section class="customer-360-state" role="status"><strong>Construyendo Cliente 360...</strong><p>Uniendo reservas, ingresos, oportunidades, conversaciones y consentimiento.</p></section>${campaignCenter}${loyaltyCenter}`;
    return;
  }

  if (!customer360) {
    if (state.customer360Error && model.customers.length) {
      container.innerHTML = `<section class="customer-360-state is-warning"><strong>Vista 360 temporalmente no disponible</strong><p>${escapeHtml(state.customer360Error)}</p></section>${renderLegacyCustomers(model)}${campaignCenter}${loyaltyCenter}`;
      return;
    }
    container.innerHTML = `${emptyState("Sin clientes guardados", "Cuando un lead pase a cliente quedara listado aqui.")}${campaignCenter}${loyaltyCenter}`;
    return;
  }

  const search = clean(state.customerSearch).toLowerCase();
  const segment = clean(state.customerSegmentFilter);
  const allProfiles = Array.isArray(customer360.customers) ? customer360.customers : [];
  const profiles = allProfiles.filter((profile) => {
    const matchesSegment = !segment || (profile.segments || []).includes(segment);
    const matchesSearch = !search || [
      profile.contact?.name,
      profile.contact?.email,
      profile.contact?.phone,
      profile.account?.name,
      profile.primarySegment,
      ...(profile.segments || []),
      ...(profile.metrics?.favoriteServices || []).map((item) => item.name)
    ].map(clean).join(" ").toLowerCase().includes(search);
    return matchesSegment && matchesSearch;
  });
  const summary = customer360.summary || {};
  const segments = (customer360.segments || []).filter((item) => item.count > 0);

  container.innerHTML = `
    <section class="customer-360-workspace" data-customer-360-workspace>
      <header class="customer-360-hero">
        <div>
          <p class="eyebrow">Guestbook inteligente</p>
          <h3>Cliente 360 accionable</h3>
          <p>Cada ficha explica valor, recurrencia, riesgo, consentimiento y el siguiente paso recomendado.</p>
        </div>
        <div class="customer-360-generated"><strong>${escapeHtml(String(summary.customers || 0))}</strong><span>perfiles unidos</span><small>${escapeHtml(formatDateTime(customer360.generatedAt))}</small></div>
      </header>

      <div class="customer-360-kpis">
        ${renderCustomer360Kpi("Ingresos unidos", formatMoney(summary.revenue || 0, summary.currency || model.currency), `${summary.completedVisits || 0} visitas completadas`)}
        ${renderCustomer360Kpi("Ticket medio", formatMoney(summary.averageTicket || 0, summary.currency || model.currency), `${summary.upcomingBookings || 0} con proxima reserva`)}
        ${renderCustomer360Kpi("LTV estimado", formatMoney(summary.estimatedLtv || 0, summary.currency || model.currency), "Historico + recurrencia proyectada")}
        ${renderCustomer360Kpi("En riesgo", String(summary.atRisk || 0), `${summary.vip || 0} VIP · ${summary.marketingReachable || 0} contactables`)}
        ${renderCustomer360Kpi("Saldo pendiente", formatMoney(summary.outstandingBalance || 0, summary.currency || model.currency), "Facturas generales y operativas")}
      </div>

      <form class="customer-360-toolbar" data-customer-360-filter-form>
        <label>Buscar<input name="search" type="search" value="${escapeAttr(state.customerSearch)}" placeholder="Nombre, email, servicio o cuenta"></label>
        <label>Segmento<select name="segment"><option value="">Todos los segmentos</option>${segments.map((item) => `<option value="${escapeAttr(item.id)}"${segment === item.id ? " selected" : ""}>${escapeHtml(item.label)} (${item.count})</option>`).join("")}</select></label>
        <button type="submit">Aplicar</button>
        <button type="button" data-customer-filter-reset>Limpiar</button>
        <span>${escapeHtml(String(profiles.length))} resultado(s)</span>
      </form>

      ${renderExportToolbar("customers", profiles.length, "Exportar clientes")}
      ${state.customer360Error ? `<section class="customer-360-state is-warning"><strong>Datos parciales</strong><p>${escapeHtml(state.customer360Error)}</p></section>` : ""}
      <div class="customer-360-grid">
        ${profiles.length ? profiles.map((profile) => renderCustomer360Card(profile, model)).join("") : '<section class="customer-360-state"><strong>Sin coincidencias</strong><p>Cambia la busqueda o el segmento para ampliar la muestra.</p></section>'}
      </div>
    </section>
    ${campaignCenter}
    ${loyaltyCenter}
  `;
}

function renderLegacyCustomers(model) {
  return `
    ${renderExportToolbar("customers", model.customers.length, "Exportar clientes")}
    <div class="table-wrap"><table><thead><tr><th>Cliente</th><th>Telefono</th><th>Email</th><th>Ultima actividad</th><th>Acciones</th></tr></thead><tbody>
      ${model.customers.map((customer) => `<tr><td>${escapeHtml(contactName(customer))}</td><td>${escapeHtml(clean(customer.phone || "-"))}</td><td>${escapeHtml(clean(customer.email || "-"))}</td><td>${escapeHtml(formatDate(customer.lastInteractionAt || customer.createdAt))}</td><td>${renderCustomerActions(customer.id)}</td></tr>`).join("")}
    </tbody></table></div>
  `;
}

function renderLoyaltyCenter(model) {
  if (state.clientSession) return "";
  if (state.loyaltyLoading) return '<section class="loyalty-center loyalty-state" data-loyalty-center><strong>Cargando fidelización...</strong><p>Calculando saldos, niveles, recompensas y referidos.</p></section>';
  const center = state.loyaltyCenter;
  if (!center) return `<section class="loyalty-center loyalty-state" data-loyalty-center><strong>Fidelización no disponible</strong><p>${escapeHtml(state.loyaltyError || "Configura el programa para empezar.")}</p></section>`;
  const program = center.program || {};
  const accounts = Array.isArray(center.accounts) ? center.accounts : [];
  const rewards = Array.isArray(center.rewards) ? center.rewards : [];
  const codes = Array.isArray(center.referralCodes) ? center.referralCodes : [];
  const referrals = Array.isArray(center.referrals) ? center.referrals : [];
  const unit = program.unitLabel || "puntos";
  return `
    <section class="loyalty-center" data-loyalty-center aria-labelledby="loyaltyCenterTitle">
      <header class="loyalty-center-header">
        <div><p class="eyebrow">Retención medible</p><h3 id="loyaltyCenterTitle">${escapeHtml(program.name || "Club de fidelidad")}</h3><p>Saldos y movimientos inmutables, recompensas con stock y referidos limitados con señales antiabuso.</p></div>
        <span><strong>${escapeHtml(program.mode || "points")}</strong><small>${escapeHtml(unit)}</small></span>
      </header>
      ${state.loyaltyFeedback ? `<p class="loyalty-feedback">${escapeHtml(state.loyaltyFeedback)}</p>` : ""}
      <div class="loyalty-kpis">
        ${renderLoyaltyKpi(center.summary?.members || 0, "miembros")}
        ${renderLoyaltyKpi(center.summary?.available || 0, `${unit} disponibles`)}
        ${renderLoyaltyKpi(center.summary?.rewardsIssued || 0, "recompensas")}
        ${renderLoyaltyKpi(center.summary?.referralsConverted || 0, "referidos convertidos")}
      </div>
      <div class="loyalty-layout">
        <div class="loyalty-configuration">
          <details>
            <summary>Configurar programa</summary>
            <form data-loyalty-program-form class="loyalty-form">
              <label>Nombre<input name="name" value="${escapeAttr(program.name || "Club de fidelidad")}" required></label>
              <label>Modelo<select name="mode">${["points", "balance", "bonus"].map((item) => `<option value="${item}"${program.mode === item ? " selected" : ""}>${escapeHtml(statusLabel(item))}</option>`).join("")}</select></label>
              <label>Unidad<input name="unitLabel" value="${escapeAttr(unit)}" required></label>
              <label>Caducidad (días)<input name="expirationDays" type="number" min="0" max="3650" value="${escapeAttr(String(program.expirationDays ?? 365))}"></label>
              <label>Premio referente<input name="referrerReward" type="number" min="0.01" step="0.01" value="${escapeAttr(String(program.referral?.referrerReward ?? 100))}"></label>
              <label>Premio referido<input name="referredReward" type="number" min="0.01" step="0.01" value="${escapeAttr(String(program.referral?.referredReward ?? 50))}"></label>
              <label>Límite por referente<input name="maxConversionsPerReferrer" type="number" min="1" value="${escapeAttr(String(program.referral?.maxConversionsPerReferrer ?? 20))}"></label>
              <button type="submit">Guardar programa</button>
            </form>
          </details>
          <details>
            <summary>Añadir movimiento o corrección</summary>
            <form data-loyalty-movement-form class="loyalty-form">
              <label>Cliente<select name="contactId" required>${model.contacts.filter((item) => !item.merged).map((contact) => `<option value="${escapeAttr(contact.id)}">${escapeHtml(contactName(contact))}</option>`).join("")}</select></label>
              <label>Tipo<select name="type"><option value="earn">Sumar</option><option value="redeem">Canjear</option><option value="correction">Corrección firmada</option></select></label>
              <label>Importe<input name="amount" type="number" step="0.01" required></label>
              <label>Motivo<input name="reason" required maxlength="300"></label>
              <button type="submit">Registrar</button>
            </form>
          </details>
          <details>
            <summary>Nueva recompensa</summary>
            <form data-loyalty-reward-form class="loyalty-form">
              <label>Nombre<input name="name" required></label>
              <label>Coste<input name="cost" type="number" min="0.01" step="0.01" required></label>
              <label>Stock<input name="stock" type="number" min="0" value="0"></label>
              <label class="loyalty-checkbox"><input name="unlimited" type="checkbox"> Sin límite</label>
              <button type="submit">Crear recompensa</button>
            </form>
          </details>
          <details>
            <summary>Atribuir referido</summary>
            <form data-referral-attribution-form class="loyalty-form">
              <label>Código<input name="code" required maxlength="20"></label>
              <label>Nuevo cliente<select name="referredContactId" required>${model.contacts.filter((item) => !item.merged).map((contact) => `<option value="${escapeAttr(contact.id)}">${escapeHtml(contactName(contact))}</option>`).join("")}</select></label>
              <label>Referencia antiabuso<input name="fingerprint" placeholder="Pedido, dispositivo o sesión"></label>
              <button type="submit">Atribuir</button>
            </form>
          </details>
        </div>
        <div class="loyalty-members">
          <header><strong>Miembros y saldo</strong><span>${accounts.length}</span></header>
          <div class="loyalty-account-list">
            ${accounts.length ? accounts.map((account) => {
              const code = codes.find((item) => item.contactId === account.contactId);
              return `<article>
                <div><strong>${escapeHtml(account.contactName || account.contactId)}</strong><small>${escapeHtml(account.level || "Base")} · ${escapeHtml(String(account.balance || 0))} ${escapeHtml(unit)}${account.nextExpirationAt ? ` · caduca ${escapeHtml(formatDate(account.nextExpirationAt))}` : ""}</small></div>
                <div class="loyalty-account-actions">
                  ${code ? `<span>${escapeHtml(code.code)} · ${escapeHtml(String(code.uses || 0))} usos</span>` : `<button type="button" data-referral-code-contact="${escapeAttr(account.contactId)}">Crear código</button>`}
                  ${rewards.map((reward) => `<button type="button" data-loyalty-redeem data-account-id="${escapeAttr(account.id)}" data-reward-id="${escapeAttr(reward.id)}"${Number(account.balance || 0) < Number(reward.cost || 0) || (!reward.unlimited && reward.stock <= 0) ? " disabled" : ""}>${escapeHtml(reward.name)} · ${escapeHtml(String(reward.cost))}</button>`).join("")}
                </div>
              </article>`;
            }).join("") : '<p class="loyalty-empty">Registra un movimiento para crear el primer saldo.</p>'}
          </div>
          <details class="loyalty-referrals">
            <summary>Referidos (${referrals.length})</summary>
            <div>${referrals.length ? referrals.map((item) => `<article><span><strong>${escapeHtml(item.referrerContactId)}</strong><small>→ ${escapeHtml(item.referredContactId)} · ${escapeHtml(statusLabel(item.status))}</small></span>${item.status === "attributed" ? `<button type="button" data-referral-convert="${escapeAttr(item.id)}">Confirmar conversión</button>` : ""}</article>`).join("") : '<p class="loyalty-empty">Todavía no hay atribuciones.</p>'}</div>
          </details>
        </div>
      </div>
    </section>
  `;
}

function renderLoyaltyKpi(value, label) {
  return `<article><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></article>`;
}

function renderCampaignCenter(model) {
  const center = model.campaignCenter;
  const canManage = !state.clientSession;
  if (state.campaignLoading && !center) return '<section class="campaign-center campaign-state" data-campaign-center role="status"><strong>Cargando campanas y lifecycle...</strong><p>Calculando audiencias, exclusiones y resultados atribuidos.</p></section>';
  if (!center) return `<section class="campaign-center campaign-state${state.campaignError ? " is-warning" : ""}" data-campaign-center><strong>Centro de campanas no disponible</strong><p>${escapeHtml(state.campaignError || "Todavia no hay datos de campanas para este negocio.")}</p></section>`;
  const campaigns = Array.isArray(center.campaigns) ? center.campaigns : [];
  const templates = Array.isArray(center.templates) ? center.templates : [];
  const selected = campaigns.find((item) => item.id === state.campaignSelectedId) || campaigns[0] || null;
  const totals = campaigns.reduce((result, campaign) => ({
    sent: result.sent + Number(campaign.metrics?.sent || 0),
    delivered: result.delivered + Number(campaign.metrics?.delivered || 0),
    responded: result.responded + Number(campaign.metrics?.responded || 0),
    converted: result.converted + Number(campaign.metrics?.converted || 0),
    revenue: result.revenue + Number(campaign.metrics?.attributedRevenue || 0)
  }), { sent: 0, delivered: 0, responded: 0, converted: 0, revenue: 0 });
  return `
    <section class="campaign-center" data-campaign-center aria-labelledby="campaignCenterTitle">
      <header class="campaign-center-header">
        <div><p class="eyebrow">Lifecycle y retencion</p><h3 id="campaignCenterTitle">Campanas medibles de principio a ingreso</h3><p>Segmenta Cliente 360, comprueba consentimiento, programa envios y atribuye respuestas, reservas y ventas.</p></div>
        <span class="campaign-center-count"><strong>${escapeHtml(String(campaigns.length))}</strong><small>campanas</small></span>
      </header>
      <div class="campaign-kpis">
        ${renderCampaignKpi("Enviados", totals.sent, `${campaignPercent(totals.delivered, totals.sent)}% entregados`)}
        ${renderCampaignKpi("Entregados", totals.delivered, `${campaignPercent(totals.responded, totals.delivered)}% respondieron`)}
        ${renderCampaignKpi("Respuestas", totals.responded, `${campaignPercent(totals.converted, totals.responded)}% convirtieron`)}
        ${renderCampaignKpi("Conversiones", totals.converted, "Reserva o propuesta aceptada")}
        ${renderCampaignKpi("Ingreso atribuido", formatMoney(totals.revenue, model.currency), "Ventana configurable por campana")}
      </div>
      ${state.campaignFeedback ? `<p class="campaign-feedback" role="status">${escapeHtml(state.campaignFeedback)}</p>` : ""}
      ${state.campaignError ? `<p class="campaign-feedback is-error" role="alert">${escapeHtml(state.campaignError)}</p>` : ""}
      <div class="campaign-template-strip" aria-label="Recetas lifecycle">
        ${templates.map((template) => `<article><span>${escapeHtml(campaignTemplateIcon(template.key))}</span><div><strong>${escapeHtml(template.name)}</strong><small>${escapeHtml(campaignSegmentLabel(template.segmentKey))} · ${escapeHtml(template.purpose)}</small></div>${canManage ? `<button type="button" data-campaign-template="${escapeAttr(template.key)}">Usar</button>` : ""}</article>`).join("")}
      </div>
      ${canManage ? `
        <details class="campaign-create-panel"${campaigns.length ? "" : " open"}>
          <summary>Nueva campana segura</summary>
          <form data-campaign-create-form>
            <label>Receta<select name="templateKey"><option value="">Personalizada</option>${templates.map((template) => `<option value="${escapeAttr(template.key)}">${escapeHtml(template.name)}</option>`).join("")}</select></label>
            <label>Nombre<input name="name" required maxlength="180" placeholder="Ej. Reactivacion julio"></label>
            <label>Canal<select name="channel"><option value="email">Email</option><option value="whatsapp">WhatsApp</option></select></label>
            <label>Objetivo<select name="purpose"><option value="marketing">Marketing</option><option value="reviews">Resenas</option></select></label>
            <label>Segmento<select name="segmentKey">${campaignSegmentOptions("marketing_reachable")}</select></label>
            <label>Asunto<input name="subject" maxlength="500" placeholder="Hola {{contact.name}}"></label>
            <label class="campaign-field-wide">Mensaje<textarea name="body" rows="4" maxlength="20000" placeholder="Escribe el mensaje o elige una receta"></textarea></label>
            <label>Asunto variante B<input name="variantBSubject" maxlength="500" placeholder="Opcional: prueba A/B"></label>
            <label class="campaign-field-wide">Mensaje variante B<textarea name="variantBBody" rows="3" maxlength="20000" placeholder="Si lo completas, la audiencia se divide de forma determinista"></textarea></label>
            <label>Frecuencia minima<input name="frequencyCapDays" type="number" min="0" max="365" value="7"><small>dias entre impactos</small></label>
            <label>Lote<input name="batchSize" type="number" min="1" max="500" value="50"><small>destinatarios por ejecucion</small></label>
            <button type="submit">Crear borrador</button>
          </form>
        </details>` : '<p class="campaign-readonly">Vista de cliente: resultados visibles; la edicion y los envios requieren acceso administrador.</p>'}
      <div class="campaign-layout${selected ? "" : " is-empty"}">
        <nav class="campaign-list" aria-label="Campanas">
          ${campaigns.length ? campaigns.map((campaign) => renderCampaignListItem(campaign, campaign.id === selected?.id)).join("") : '<p class="campaign-empty">Aun no hay campanas. Empieza con una receta lifecycle.</p>'}
        </nav>
        ${selected ? renderCampaignDetail(selected, model, canManage) : '<section class="campaign-detail campaign-empty"><strong>Todo listo para crecer</strong><p>Crea la primera campana para ver preview, destinatarios y atribucion.</p></section>'}
      </div>
    </section>
  `;
}

function renderCampaignKpi(label, value, note) { return `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(note)}</small></article>`; }

function renderCampaignListItem(campaign, selected) {
  const metrics = campaign.metrics || {};
  return `<button type="button" class="campaign-list-item${selected ? " is-selected" : ""}" data-campaign-select="${escapeAttr(campaign.id)}"><span><strong>${escapeHtml(campaign.name)}</strong><small>${escapeHtml(campaignStatusLabel(campaign.status))} · v${escapeHtml(String(campaign.revision || 1))}</small></span><span><b>${escapeHtml(String(metrics.sent || 0))}</b><small>envios</small></span><span><b>${escapeHtml(String(metrics.converted || 0))}</b><small>conv.</small></span></button>`;
}

function renderCampaignDetail(campaign, model, canManage) {
  const metrics = campaign.metrics || {};
  const recipients = Array.isArray(campaign.recipients) ? campaign.recipients : [];
  const preview = state.campaignPreview?.campaignId === campaign.id ? state.campaignPreview : null;
  const isDraft = campaign.status === "draft";
  const canProcess = ["scheduled", "running"].includes(campaign.status);
  return `
    <article class="campaign-detail" data-campaign-detail="${escapeAttr(campaign.id)}">
      <header><div><span class="campaign-status status-${escapeAttr(campaign.status)}">${escapeHtml(campaignStatusLabel(campaign.status))}</span><h4>${escapeHtml(campaign.name)}</h4><p>${escapeHtml(campaign.description || campaignTemplateLabel(campaign.templateKey) || "Campana personalizada")}</p></div><div class="campaign-detail-meta"><strong>v${escapeHtml(String(campaign.revision || 1))}</strong><small>${escapeHtml(campaign.channel)} · ${escapeHtml(campaign.purpose)}</small></div></header>
      <div class="campaign-detail-kpis">
        <span><small>Elegibles</small><strong>${escapeHtml(String(metrics.eligible || 0))}</strong></span>
        <span><small>Bloqueados</small><strong>${escapeHtml(String(metrics.blocked || 0))}</strong></span>
        <span><small>Entrega</small><strong>${campaignPercent(metrics.delivered, metrics.sent)}%</strong></span>
        <span><small>Respuesta</small><strong>${campaignPercent(metrics.responded, metrics.delivered)}%</strong></span>
        <span><small>Conversion</small><strong>${campaignPercent(metrics.converted, metrics.sent)}%</strong></span>
        <span><small>Ingreso</small><strong>${escapeHtml(formatMoney(metrics.attributedRevenue || 0, model.currency))}</strong></span>
      </div>
      ${metrics.variants?.length ? `<section class="campaign-variant-results"><header><strong>Experimento A/B</strong><small>Asignacion estable por contacto</small></header>${metrics.variants.map((variant) => `<span><b>${escapeHtml(variant.variantKey)}</b><small>${escapeHtml(String(variant.sent))} envios · ${campaignPercent(variant.responded, variant.delivered)}% respuesta · ${escapeHtml(formatMoney(variant.attributedRevenue || 0, model.currency))}</small></span>`).join("")}</section>` : ""}
      <dl class="campaign-rules"><div><dt>Audiencia</dt><dd>${escapeHtml(campaign.audience?.type === "static" ? `${campaign.audience.contactIds?.length || 0} contactos fijos` : campaignSegmentLabel(campaign.audience?.segmentKey))}</dd></div><div><dt>Quiet hours</dt><dd>${campaign.quietHours?.enabled ? `${escapeHtml(campaign.quietHours.start)}–${escapeHtml(campaign.quietHours.end)} · ${escapeHtml(campaign.timezone)}` : "Desactivadas"}</dd></div><div><dt>Frecuencia</dt><dd>${escapeHtml(String(campaign.frequencyCapDays || 0))} dias</dd></div><div><dt>Programacion</dt><dd>${campaign.scheduledAt ? escapeHtml(formatDateTime(campaign.scheduledAt)) : "Sin programar"}</dd></div></dl>
      ${canManage && isDraft ? `
        <form class="campaign-edit-form" data-campaign-edit-form data-campaign-id="${escapeAttr(campaign.id)}">
          <label>Nombre<input name="name" value="${escapeAttr(campaign.name)}" required></label>
          <label>Segmento<select name="segmentKey">${campaignSegmentOptions(campaign.audience?.segmentKey)}</select></label>
          <label>Asunto<input name="subject" value="${escapeAttr(campaign.subject || "")}"></label>
          <label class="campaign-field-wide">Mensaje<textarea name="body" rows="4" required>${escapeHtml(campaign.body)}</textarea></label>
          <button type="submit">Guardar nueva revision</button>
        </form>` : `<section class="campaign-message-preview"><small>Contenido congelado</small><strong>${escapeHtml(campaign.snapshot?.subject || campaign.subject || "Sin asunto")}</strong><p>${escapeHtml(campaign.snapshot?.body || campaign.body)}</p></section>`}
      ${canManage ? `<div class="campaign-actions">
        <button type="button" data-campaign-preview="${escapeAttr(campaign.id)}">Comprobar audiencia</button>
        ${isDraft ? `<form data-campaign-schedule-form data-campaign-id="${escapeAttr(campaign.id)}"><input name="scheduledAt" type="datetime-local" aria-label="Fecha de envio"><button type="submit">Programar</button></form>` : ""}
        ${canProcess ? `<button type="button" data-campaign-process="${escapeAttr(campaign.id)}">Procesar lote</button><button type="button" data-campaign-status="paused" data-campaign-id="${escapeAttr(campaign.id)}">Pausar</button>` : ""}
        ${campaign.status === "paused" ? `<button type="button" data-campaign-status="scheduled" data-campaign-id="${escapeAttr(campaign.id)}">Reanudar</button>` : ""}
        ${!["completed", "cancelled"].includes(campaign.status) ? `<button type="button" class="is-danger" data-campaign-cancel="${escapeAttr(campaign.id)}">Cancelar</button>` : ""}
      </div>` : ""}
      ${preview ? renderCampaignPreview(preview) : ""}
      <section class="campaign-recipient-table"><header><h5>Destinatarios y resultados</h5><span>${escapeHtml(String(recipients.length))} visibles</span></header>${recipients.length ? `<div class="table-wrap"><table><thead><tr><th>Contacto</th><th>Estado</th><th>Envio</th><th>Ingreso</th></tr></thead><tbody>${recipients.map((recipient) => `<tr><td>${escapeHtml(contactName(model.contacts.find((item) => item.id === recipient.contactId) || { name: recipient.contactId }))}</td><td><span class="campaign-recipient-status status-${escapeAttr(recipient.status)}">${escapeHtml(campaignRecipientStatusLabel(recipient.status))}</span>${recipient.reason ? `<small>${escapeHtml(recipient.reason)}</small>` : ""}</td><td>${recipient.sentAt ? escapeHtml(formatDateTime(recipient.sentAt)) : "-"}</td><td>${escapeHtml(formatMoney(recipient.attributedRevenue || 0, model.currency))}</td></tr>`).join("")}</tbody></table></div>` : '<p class="campaign-empty">Programa la campana para congelar destinatarios y motivos de exclusion.</p>'}</section>
    </article>
  `;
}

function renderCampaignPreview(preview) {
  const reasons = Object.entries(preview.blockedReasons || {});
  return `<section class="campaign-audience-preview" data-campaign-audience-preview><header><div><small>Preview seguro v${escapeHtml(String(preview.revision || 1))}</small><h5>${escapeHtml(String(preview.eligible?.length || 0))} elegibles · ${escapeHtml(String(preview.blocked?.length || 0))} bloqueados</h5></div><span>${escapeHtml(formatDateTime(preview.generatedAt))}</span></header><div>${reasons.length ? reasons.map(([reason, count]) => `<span><strong>${escapeHtml(String(count))}</strong>${escapeHtml(campaignBlockReasonLabel(reason))}</span>`).join("") : '<span><strong>0</strong>sin bloqueos</span>'}</div>${preview.sample?.length ? `<ol>${preview.sample.slice(0, 5).map((item) => `<li><strong>${escapeHtml(item.contact.name || item.contact.email || item.contact.id)}</strong><small>${escapeHtml(item.rendered?.subject || "Mensaje listo")}</small></li>`).join("")}</ol>` : ""}</section>`;
}

function campaignSegmentOptions(selected = "") { return [["marketing_reachable", "Contactables"], ["new", "Nuevos"], ["recurring", "Recurrentes"], ["vip", "VIP"], ["at_risk", "En riesgo"], ["inactive_30", "Inactivos 30 dias"], ["inactive_60", "Inactivos 60 dias"], ["inactive_90", "Inactivos 90 dias"], ["no_show", "Con no-show"], ["open_balance", "Saldo pendiente"]].map(([value, label]) => `<option value="${value}"${value === selected ? " selected" : ""}>${label}</option>`).join(""); }
function campaignPercent(value, total) { return total > 0 ? Math.round((Number(value || 0) / Number(total)) * 100) : 0; }
function campaignStatusLabel(value) { return ({ draft: "Borrador", scheduled: "Programada", running: "En curso", paused: "Pausada", completed: "Completada", cancelled: "Cancelada" })[value] || value || "Sin estado"; }
function campaignRecipientStatusLabel(value) { return ({ queued: "En cola", blocked: "Bloqueado", sent: "Enviado", delivered: "Entregado", responded: "Respondio", converted: "Convirtio", unsubscribed: "Baja", failed: "Fallido", bounced: "Rebotado", complained: "Queja" })[value] || value || "Sin estado"; }
function campaignBlockReasonLabel(value) { return ({ missing_email: "sin email", missing_phone: "sin telefono", no_grant: "sin consentimiento", withdrawn: "consentimiento retirado", global_suppression: "supresion global", channel_or_purpose_suppression: "canal suprimido", excluded_tag: "etiqueta excluida", frequency_cap: "limite de frecuencia", inactive_contact: "contacto inactivo" })[value] || value.replaceAll("_", " "); }
function campaignSegmentLabel(value) { return ({ marketing_reachable: "Contactables", new: "Nuevos", recurring: "Recurrentes", vip: "VIP", at_risk: "En riesgo", inactive_30: "Inactivos 30 dias", inactive_60: "Inactivos 60 dias", inactive_90: "Inactivos 90 dias", no_show: "Con no-show", open_balance: "Saldo pendiente" })[value] || value || "Audiencia personalizada"; }
function campaignTemplateLabel(value) { return ({ welcome: "Bienvenida", "reactivation-30": "Reactivacion 30 dias", "post-visit-review": "Opinion tras la visita", "win-back-90": "Win-back 90 dias" })[value] || ""; }
function campaignTemplateIcon(value) { return ({ welcome: "01", "reactivation-30": "30", "post-visit-review": "★", "win-back-90": "90" })[value] || "+"; }

function renderCustomer360Kpi(label, value, note) {
  return `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(note)}</small></article>`;
}

function renderCustomer360Card(profile, model) {
  const contact = profile.contact || {};
  const metrics = profile.metrics || {};
  const commercial = profile.commercial || {};
  const finance = profile.finance || {};
  const consent = profile.consent || {};
  const risk = profile.risk || { score: 0, level: "low", reasons: [] };
  const rfm = profile.rfm || { recency: 1, frequency: 1, monetary: 1, score: "111" };
  const action = profile.nextBestAction || {};
  const favoriteServices = (metrics.favoriteServices || []).map((item) => `${item.name} (${item.count})`).join(", ") || "Sin preferencia calculada";
  const allowedChannels = (consent.marketingChannels || []).map(customerChannelLabel).join(", ") || "Sin marketing permitido";
  const timeline = Array.isArray(profile.timeline) ? profile.timeline : [];

  return `
    <details class="customer-360-card risk-${escapeAttr(risk.level || "low")}" data-customer-360-card data-contact-id="${escapeAttr(contact.id || "")}">
      <summary>
        <span class="customer-360-identity"><strong>${escapeHtml(contact.name || "Cliente sin nombre")}</strong><small>${escapeHtml([contact.email, contact.phone, profile.account?.name].filter(Boolean).join(" · ") || "Sin datos de contacto")}</small></span>
        <span class="customer-360-segment segment-${escapeAttr(profile.primarySegment || "occasional")}">${escapeHtml(customerSegmentLabel(profile.primarySegment))}</span>
        <span class="customer-360-value"><strong>${escapeHtml(formatMoney(metrics.totalSpent || 0, profile.currency || model.currency))}</strong><small>gasto historico</small></span>
        <span class="customer-360-risk"><strong>${escapeHtml(String(risk.score || 0))}/100</strong><small>riesgo ${escapeHtml(customerRiskLabel(risk.level))}</small></span>
      </summary>

      <div class="customer-360-body">
        <div class="customer-360-metric-grid">
          <span><small>RFM</small><strong>${escapeHtml(rfm.score || "111")}</strong><em>R${rfm.recency} · F${rfm.frequency} · M${rfm.monetary}</em></span>
          <span><small>Visitas</small><strong>${escapeHtml(String(metrics.completedVisits || 0))}</strong><em>${metrics.frequencyDays ? `cada ${escapeHtml(String(metrics.frequencyDays))} dias` : "sin frecuencia"}</em></span>
          <span><small>Ticket medio</small><strong>${escapeHtml(formatMoney(metrics.averageTicket || 0, profile.currency || model.currency))}</strong><em>${escapeHtml(String(metrics.transactionCount || 0))} transacciones</em></span>
          <span><small>LTV estimado</small><strong>${escapeHtml(formatMoney(metrics.estimatedLtv || 0, profile.currency || model.currency))}</strong><em>${escapeHtml(metrics.ltvMethod || "estimacion")}</em></span>
          <span><small>Ultima visita</small><strong>${escapeHtml(metrics.lastVisit ? formatDate(metrics.lastVisit) : "Sin visita")}</strong><em>${metrics.daysSinceLastVisit === null ? "sin recencia" : `hace ${escapeHtml(String(metrics.daysSinceLastVisit))} dias`}</em></span>
          <span><small>Proxima visita</small><strong>${escapeHtml(metrics.nextVisit ? formatDateTime(metrics.nextVisit) : "Sin reserva")}</strong><em>${escapeHtml(favoriteServices)}</em></span>
        </div>

        <section class="customer-next-action priority-${escapeAttr(action.priority || "low")}">
          <div><p class="eyebrow">Siguiente mejor accion</p><strong>${escapeHtml(action.label || "Completar perfil")}</strong><p>${escapeHtml(action.reason || "Faltan señales suficientes.")}</p></div>
          <span>${escapeHtml(customerChannelLabel(action.channel))}</span>
        </section>

        <div class="customer-360-detail-grid">
          <section><h4>Relacion y riesgo</h4><dl><div><dt>Segmentos</dt><dd>${(profile.segments || []).map((item) => `<span class="customer-tag">${escapeHtml(customerSegmentLabel(item))}</span>`).join("")}</dd></div><div><dt>Motivos</dt><dd>${escapeHtml((risk.reasons || []).join(" · ") || "Relacion estable")}</dd></div><div><dt>Cancelaciones / no-show</dt><dd>${escapeHtml(`${metrics.cancellations || 0} / ${metrics.noShows || 0}`)}</dd></div></dl></section>
          <section><h4>Comercial</h4><dl><div><dt>Oportunidades</dt><dd>${escapeHtml(`${commercial.openDeals || 0} abiertas · ${formatMoney(commercial.openDealValue || 0, profile.currency || model.currency)}`)}</dd></div><div><dt>Propuestas</dt><dd>${escapeHtml(`${commercial.openProposals || 0} abiertas · ${formatMoney(commercial.openProposalValue || 0, profile.currency || model.currency)}`)}</dd></div><div><dt>Proyectos / conversaciones</dt><dd>${escapeHtml(`${commercial.activeProjects || 0} activos · ${commercial.openConversations || 0} abiertas`)}</dd></div></dl></section>
          <section><h4>Ingresos</h4><dl><div><dt>Facturado</dt><dd>${escapeHtml(formatMoney(finance.invoiced || 0, profile.currency || model.currency))}</dd></div><div><dt>Pendiente</dt><dd>${escapeHtml(formatMoney(finance.outstandingBalance || 0, profile.currency || model.currency))}</dd></div><div><dt>Vencido</dt><dd>${escapeHtml(`${formatMoney(finance.overdueBalance || 0, profile.currency || model.currency)} · ${finance.overdueInvoices || 0} factura(s)`)}</dd></div></dl></section>
          <section><h4>Preferencias</h4><dl><div><dt>Marketing</dt><dd>${escapeHtml(allowedChannels)}</dd></div><div><dt>Supresion global</dt><dd>${consent.globalSuppressed ? "Activa" : "No"}</dd></div><div><dt>Evidencias</dt><dd>${escapeHtml(String(consent.eventCount || 0))}</dd></div></dl></section>
        </div>

        <section class="customer-360-timeline"><h4>Timeline unificado</h4>${timeline.length ? `<ol>${timeline.map((item) => `<li><span><strong>${escapeHtml(item.title || customerTimelineTypeLabel(item.type))}</strong><small>${escapeHtml(`${customerTimelineTypeLabel(item.type)}${item.note ? ` · ${item.note}` : ""}`)}</small></span><time datetime="${escapeAttr(item.at || "")}">${escapeHtml(formatDateTime(item.at))}</time></li>`).join("")}</ol>` : '<p>Sin actividad vinculada.</p>'}</section>
        ${renderCustomerActions(contact.id)}
      </div>
    </details>
  `;
}

function renderCustomerActions(contactId) {
  if (!contactId || !state.contacts.some((contact) => contact.id === contactId)) return '<span class="timeline-unavailable">No disponible</span>';
  return `<div class="contact-row-actions customer-360-actions"><button class="message-contact-button compact" type="button" data-prepare-message-for-contact data-contact-id="${escapeAttr(contactId)}">Preparar mensaje</button><button class="proposal-contact-button compact" type="button" data-create-proposal-for-contact data-contact-id="${escapeAttr(contactId)}">Crear propuesta</button><button class="timeline-open-button compact" type="button" data-contact-timeline data-contact-id="${escapeAttr(contactId)}" aria-haspopup="dialog">Historial completo</button></div>`;
}

function bindCustomer360Controls() {
  const form = document.querySelector("[data-customer-360-filter-form]");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    state.customerSearch = clean(data.get("search"));
    state.customerSegmentFilter = clean(data.get("segment"));
    render();
  });
  form?.querySelector('select[name="segment"]')?.addEventListener("change", () => form.requestSubmit());
  document.querySelector("[data-customer-filter-reset]")?.addEventListener("click", () => {
    state.customerSearch = "";
    state.customerSegmentFilter = "";
    render();
  });
}

function customerSegmentLabel(value) {
  const normalized = clean(value);
  if (normalized.startsWith("manual_")) return `Manual · ${normalized.slice(7).replace(/[_-]+/g, " ")}`;
  return ({ vip: "VIP", recurring: "Recurrente", new: "Nuevo", at_risk: "En riesgo", inactive_30: "Inactivo 30d", inactive_60: "Inactivo 60d", inactive_90: "Inactivo 90d", high_value: "Alto valor", no_show: "Con no-show", open_balance: "Saldo pendiente", open_proposal: "Propuesta abierta", upcoming_booking: "Proxima reserva", marketing_reachable: "Contactable", occasional: "Ocasional" })[normalized] || normalized || "Ocasional";
}

function customerRiskLabel(value) { return ({ high: "alto", medium: "medio", low: "bajo" })[clean(value)] || "bajo"; }
function customerChannelLabel(value) { return ({ whatsapp: "WhatsApp", email: "Email", sms: "SMS", phone: "Telefono", task: "Tarea interna" })[clean(value)] || "Tarea interna"; }
function customerTimelineTypeLabel(value) { return ({ booking: "Reserva", order: "Pedido", deal: "Oportunidad", proposal: "Propuesta", project: "Proyecto", invoice: "Factura", conversation: "Conversacion", task: "Tarea" })[clean(value)] || "Actividad"; }

function renderBookings(model) {
  const container = document.querySelector('[data-list="bookings"]');
  const form = renderBookingForm(model);
  const agendaTools = renderAgendaTools(model);
  const resourceCenter = renderBookingResourceCenter(model);
  const verticalCenter = renderVerticalOperationsCenter(model);
  const calendar = renderBookingCalendar(model);

  if (!model.bookings.length) {
    container.innerHTML = `${form}${resourceCenter}${verticalCenter}${agendaTools}${calendar}${emptyState("Sin reservas", "Crea una cita manual o usa el endpoint publico para recibir reservas.")}`;
    return;
  }

  container.innerHTML = `
    ${form}
    ${resourceCenter}
    ${verticalCenter}
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
  if (!container) return;

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
  if (!container) return;

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
    ${renderIntelligenceCenter(model)}
    ${renderCommercialDashboardPanel(model)}
    ${renderForecastPanel(model)}
    ${renderSlaPanel(model)}
    ${renderDataQualityPanel(model)}
    <div class="recommendation-list">
      ${reportRecommendations.map((item) => `<article><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></article>`).join("")}
    </div>
  `;
}

function renderIntelligenceCenter(model) {
  if (state.clientSession) return "";
  if (state.intelligenceLoading) return '<section class="intelligence-center intelligence-state" data-intelligence-center><strong>Construyendo inteligencia explicable...</strong><p>Uniendo ciclo comercial, recurrencia, riesgos y evidencias.</p></section>';
  const center = state.intelligenceCenter;
  if (!center) return `<section class="intelligence-center intelligence-state" data-intelligence-center><strong>Inteligencia no disponible</strong><p>${escapeHtml(state.intelligenceError || "Aún no se ha calculado.")}</p></section>`;
  const analytics = center.analytics || {};
  const predictions = center.predictions || {};
  const copilot = center.copilot || {};
  const metrics = Array.isArray(analytics.metrics) ? analytics.metrics : [];
  const funnels = Array.isArray(analytics.funnels) ? analytics.funnels : [];
  const goals = Array.isArray(analytics.goals) ? analytics.goals : [];
  const cohorts = analytics.cohorts || { rows: [], summary: {} };
  const revenue = analytics.revenue || {};
  const canConfigure = canConfigureIntelligence();
  return `
    <section class="intelligence-center" data-intelligence-center aria-labelledby="intelligenceTitle">
      <header class="intelligence-header">
        <div><p class="eyebrow">Analítica e IA segura</p><h3 id="intelligenceTitle">Cada recomendación explica por qué</h3><p>Embudo, cohortes, ingresos, objetivos y riesgos enlazan al registro fuente. El copiloto prepara borradores, nunca actúa en silencio.</p></div>
        <div><span>${predictions.enabled ? "Modelo activo" : "Regla base"}</span><small>${escapeHtml(formatDateTime(center.generatedAt))}</small></div>
      </header>
      ${state.intelligenceFeedback ? `<p class="intelligence-feedback">${escapeHtml(state.intelligenceFeedback)}</p>` : ""}
      <div class="intelligence-metric-grid" aria-label="Diccionario de métricas">
        ${metrics.map((item) => `<a href="${escapeAttr(item.sourceUrl)}" title="${escapeAttr(item.description)}"><span>${escapeHtml(item.label)}</span><strong>${item.key === "revenue.total" ? escapeHtml(formatMoney(item.value, model.currency)) : escapeHtml(String(item.value))}</strong><small>${escapeHtml(item.description)}</small><em>${escapeHtml(item.sourceCollection)} →</em></a>`).join("")}
      </div>
      <div class="intelligence-analytics-grid">
        <section class="intelligence-panel intelligence-funnels">
          <header><div><p class="eyebrow">Conversión</p><h4>Embudos configurables</h4></div><span>${funnels.length}</span></header>
          ${funnels.map((funnel) => `<article><div class="funnel-title"><strong>${escapeHtml(funnel.name)}</strong><small>${escapeHtml(String(funnel.totalConversion))}% extremo a extremo</small></div><div class="intelligence-funnel-steps">${(funnel.steps || []).map((step, index) => `<a href="${escapeAttr(step.sourceUrl)}"><span>${escapeHtml(step.label)}</span><strong>${escapeHtml(String(step.contacts))}</strong><small>${index ? `${escapeHtml(String(step.conversionFromPrevious))}% · ${step.medianTransitionHours === null ? "sin tiempo" : `${escapeHtml(String(step.medianTransitionHours))} h`}` : "entrada"}</small></a>`).join("")}</div></article>`).join("")}
          ${canConfigure ? `<details><summary>Nuevo embudo</summary><form data-intelligence-funnel-form class="intelligence-form"><label>Nombre<input name="name" required></label><label>Etiquetas (coma)<input name="labels" value="Contacto, Oportunidad, Visita, Cobro" required></label><label>Entidades (coma)<input name="entities" value="contact, deal, booking, money" required></label><button type="submit">Crear embudo</button></form></details>` : ""}
        </section>
        <section class="intelligence-panel intelligence-cohorts">
          <header><div><p class="eyebrow">Retención</p><h4>Cohortes de primera visita</h4></div><span>${escapeHtml(String(cohorts.summary?.repeatRate || 0))}% repite</span></header>
          <div class="cohort-table"><div class="cohort-row is-head"><span>Cohorte</span><span>Clientes</span><span>M0</span><span>M1</span><span>M2</span><span>M3</span></div>${(cohorts.rows || []).length ? cohorts.rows.map((row) => `<a class="cohort-row" href="${escapeAttr(row.sourceUrl)}"><strong>${escapeHtml(row.cohort)}</strong><span>${escapeHtml(String(row.customers))}</span>${(row.retention || []).map((item) => `<span title="${escapeAttr(`${item.retained} retenidos`)}">${escapeHtml(String(item.rate))}%</span>`).join("")}</a>`).join("") : '<p class="intelligence-empty">Aún no hay visitas completadas suficientes.</p>'}</div>
          <p class="cohort-summary">${escapeHtml(String(cohorts.summary?.repeated || 0))} recurrentes · ${escapeHtml(String(cohorts.summary?.churned || 0))} con churn por inactividad</p>
        </section>
        <section class="intelligence-panel intelligence-revenue">
          <header><div><p class="eyebrow">Atribución</p><h4>Ingresos de ciclo completo</h4></div><strong>${escapeHtml(formatMoney(revenue.total || 0, revenue.currency || model.currency))}</strong></header>
          <div class="revenue-breakdown-grid">
            ${renderRevenueBreakdown("Canal", revenue.byChannel)}
            ${renderRevenueBreakdown("Campaña", revenue.byCampaign)}
            ${renderRevenueBreakdown("Servicio", revenue.byService)}
            ${renderRevenueBreakdown("Oportunidad", revenue.byDeal)}
            ${renderRevenueBreakdown("Cliente", revenue.byCustomer)}
          </div>
        </section>
        <section class="intelligence-panel intelligence-goals">
          <header><div><p class="eyebrow">Objetivos</p><h4>Negocio, equipo y persona</h4></div><span>${goals.length}</span></header>
          <div>${goals.length ? goals.map((goal) => `<a class="goal-card status-${escapeAttr(goal.status)}" href="${escapeAttr(goal.sourceUrl)}"><span><strong>${escapeHtml(goal.name)}</strong><small>${escapeHtml(statusLabel(goal.scope))}${goal.scopeId ? ` · ${escapeHtml(goal.scopeId)}` : ""}</small></span><span><b>${escapeHtml(String(goal.progressPercent))}%</b><small>${escapeHtml(String(goal.current))}/${escapeHtml(String(goal.target))}</small></span><i style="--goal-progress:${escapeAttr(String(goal.progressPercent))}%"></i></a>`).join("") : '<p class="intelligence-empty">Crea el primer objetivo medible.</p>'}</div>
          ${canConfigure ? `<details><summary>Nuevo objetivo</summary><form data-intelligence-goal-form class="intelligence-form"><label>Nombre<input name="name" required></label><label>Métrica<select name="metricKey">${metrics.map((item) => `<option value="${escapeAttr(item.key)}">${escapeHtml(item.label)}</option>`).join("")}</select></label><label>Meta<input name="target" type="number" min="0.01" step="0.01" required></label><label>Ámbito<select name="scope"><option value="business">Negocio</option><option value="team">Equipo</option><option value="user">Persona</option></select></label><label>ID ámbito<input name="scopeId" placeholder="Opcional"></label><label>Desde<input name="periodStart" type="date" value="${escapeAttr(`${currentMonthKey()}-01`)}"></label><label>Hasta<input name="periodEnd" type="date" value="${escapeAttr(lastDayOfMonthValue())}"></label><button type="submit">Crear objetivo</button></form></details>` : ""}
        </section>
      </div>
      ${renderPredictionCenter(predictions, canConfigure)}
      ${renderCopilotCenter(copilot, canConfigure)}
    </section>
  `;
}

function renderRevenueBreakdown(label, items) {
  const rows = Array.isArray(items) ? items : [];
  return `<section><h5>${escapeHtml(label)}</h5>${rows.length ? rows.slice(0, 6).map((item) => `<a href="${escapeAttr(item.sourceUrl)}"><span>${escapeHtml(statusLabel(item.key))}</span><strong>${escapeHtml(formatMoney(item.revenue, state.business?.content?.currency || "EUR"))}</strong></a>`).join("") : '<p>Sin atribución</p>'}</section>`;
}

function renderPredictionCenter(predictions, canConfigure) {
  const stages = Array.isArray(predictions.closeProbability) ? predictions.closeProbability : [];
  const churn = Array.isArray(predictions.churn) ? predictions.churn : [];
  const noShow = Array.isArray(predictions.noShow) ? predictions.noShow : [];
  const stock = Array.isArray(predictions.stock) ? predictions.stock : [];
  return `
    <section class="prediction-center" data-prediction-center>
      <header><div><p class="eyebrow">Predicción explicable</p><h4>Modelo comparado con la regla simple</h4><p>${escapeHtml(predictions.comparison?.explanation || "")}</p></div>${canConfigure ? `<form data-prediction-settings-form><label><input name="enabled" type="checkbox"${predictions.enabled ? " checked" : ""}> Activar calibración</label><label>Muestra mínima<input name="minSampleSize" type="number" min="1" value="${escapeAttr(String(predictions.settings?.minSampleSize || 10))}"></label><button type="submit">Guardar</button></form>` : ""}</header>
      <div class="prediction-stage-grid">${stages.map((stage) => `<article><span><strong>${escapeHtml(stage.stageName)}</strong><small>${escapeHtml(stage.pipelineName || "")}</small></span><span><b>${escapeHtml(String(stage.calibratedProbability))}%</b><small>base ${escapeHtml(String(stage.baselineProbability))}%</small></span><p>${escapeHtml(stage.explanation)}</p><em class="${stage.reliable ? "is-reliable" : "is-baseline"}">${escapeHtml(stage.modelUsed)} · n=${escapeHtml(String(stage.sampleSize))}</em></article>`).join("")}</div>
      <div class="prediction-risk-grid">
        ${renderPredictionRiskList("Riesgo de abandono", churn, "contactName")}
        ${renderPredictionRiskList("Riesgo de no-show", noShow, "customerName")}
        ${renderPredictionRiskList("Riesgo de stock", stock, "name")}
      </div>
    </section>
  `;
}

function renderPredictionRiskList(title, items, labelKey) {
  return `<section><header><strong>${escapeHtml(title)}</strong><span>${items.filter((item) => item.modelRisk).length}</span></header>${items.length ? items.slice(0, 8).map((item) => `<a href="${escapeAttr(item.sourceUrl)}" class="risk-${escapeAttr(item.level || (item.modelRisk ? "high" : "low"))}"><span><strong>${escapeHtml(item[labelKey] || item.contactId || item.bookingId || item.inventoryItemId)}</strong><small>modelo ${item.modelRisk ? "riesgo" : "normal"} · base ${item.baselineRisk ? "riesgo" : "normal"}</small></span><b>${escapeHtml(String(item.score ?? item.projectedStock ?? 0))}${item.score !== undefined ? "/100" : ""}</b><ul>${(item.factors || []).map((factor) => `<li>${escapeHtml(factor.label)}: ${escapeHtml(String(factor.value))}</li>`).join("")}</ul></a>`).join("") : '<p class="intelligence-empty">Sin registros evaluables.</p>'}</section>`;
}

function renderCopilotCenter(copilot, canConfigure) {
  const brief = copilot.brief || { priorities: [] };
  const summaries = Array.isArray(copilot.conversationSummaries) ? copilot.conversationSummaries : [];
  const suggestions = Array.isArray(copilot.suggestedDrafts) ? copilot.suggestedDrafts : [];
  const drafts = Array.isArray(copilot.drafts) ? copilot.drafts : [];
  return `
    <section class="copilot-center" data-copilot-center>
      <header><div><p class="eyebrow">Copiloto operativo</p><h4>Brief y borradores con citas</h4><p>${escapeHtml(brief.headline || "")}</p></div><span>Humano al mando</span></header>
      <p class="copilot-safety">${escapeHtml(copilot.safety?.statement || "")}</p>
      <div class="copilot-layout">
        <section class="copilot-brief"><h5>Prioridades de hoy</h5>${(brief.priorities || []).length ? brief.priorities.map((item) => `<article class="severity-${escapeAttr(item.severity)}"><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.reason)}</p></div><div class="copilot-citations">${(item.citations || []).map((citation) => `<a href="${escapeAttr(citation.sourceUrl)}">${escapeHtml(citation.sourceType)} #${escapeHtml(citation.sourceId)}</a>`).join("")}</div></article>`).join("") : '<p class="intelligence-empty">Sin incidencias críticas.</p>'}</section>
        <section class="copilot-summaries"><h5>Conversaciones resumidas</h5>${summaries.length ? summaries.map((item) => `<article><p>${escapeHtml(item.summary)}</p><div class="copilot-citations">${(item.citations || []).map((citation) => `<a href="${escapeAttr(citation.sourceUrl)}">${escapeHtml(citation.label || citation.sourceId)}</a>`).join("")}</div></article>`).join("") : '<p class="intelligence-empty">Sin conversaciones que resumir.</p>'}</section>
        <section class="copilot-drafts"><h5>Borradores revisables</h5>${suggestions.map((item, index) => `<article><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.content)}</p>${canConfigure ? `<button type="button" data-copilot-create-suggestion="${escapeAttr(String(index))}">Guardar borrador</button>` : ""}</article>`).join("")}${drafts.map((draft) => `<article class="status-${escapeAttr(draft.status)}"><strong>${escapeHtml(draft.title)}</strong><p>${escapeHtml(draft.content)}</p><small>${escapeHtml(draft.status)} · ${escapeHtml(draft.targetType)} #${escapeHtml(draft.targetId)}</small>${canConfigure && draft.status === "draft" && ["send", "delete", "charge", "publish", "change_permissions"].includes(draft.suggestedAction) ? `<button type="button" data-copilot-confirm-draft="${escapeAttr(draft.id)}" data-action="${escapeAttr(draft.suggestedAction)}">Confirmar ${escapeHtml(copilotActionLabel(draft.suggestedAction))}</button>` : ""}</article>`).join("")}</section>
      </div>
      <form class="copilot-query" data-copilot-query-form><label>Pregunta sobre métricas autorizadas<input name="question" placeholder="¿Cuántas reservas tenemos?" required></label><button type="submit">Consultar</button></form>
      ${state.intelligenceQueryResult ? `<article class="copilot-query-result"><strong>${escapeHtml(state.intelligenceQueryResult.answer || "")}</strong>${(state.intelligenceQueryResult.citations || []).map((item) => `<a href="${escapeAttr(item.sourceUrl)}">${escapeHtml(item.metricKey || item.sourceCollection)} · ver registros</a>`).join("")}${state.intelligenceQueryResult.suggestions?.length ? `<small>${escapeHtml(state.intelligenceQueryResult.suggestions.join(" · "))}</small>` : ""}</article>` : ""}
    </section>
  `;
}

function canConfigureIntelligence() {
  const role = state.businessUserSession?.user?.role;
  return !role || ["owner", "manager"].includes(role);
}

function copilotActionLabel(value) {
  return ({ send: "envío", delete: "borrado", charge: "cobro", publish: "publicación", change_permissions: "cambio de permisos" })[value] || value;
}

function lastDayOfMonthValue() {
  const [year, month] = currentMonthKey().split("-").map(Number);
  return new Date(year, month, 0).toISOString().slice(0, 10);
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

function renderDataQualityPanel(model) {
  const loading = state.dataQualityLoading;

  return `
    <section class="data-quality-panel forecast-panel" aria-labelledby="dataQualityTitle" aria-busy="${loading ? "true" : "false"}">
      <header class="forecast-panel-header">
        <div class="forecast-panel-copy">
          <p class="eyebrow">Higiene del CRM</p>
          <h3 id="dataQualityTitle">Avisos de calidad de datos</h3>
          <p>Corrige los datos que bloquean el seguimiento comercial y la operacion del negocio.</p>
        </div>
      </header>
      <div aria-live="polite" aria-atomic="false">
        ${renderDataQualityContent(model)}
      </div>
    </section>
  `;
}

function renderDataQualityContent(model) {
  if (state.dataQualityLoading) {
    return `
      <div class="forecast-state forecast-state-loading" role="status">
        <span class="forecast-spinner" aria-hidden="true"></span>
        <div><strong>Revisando calidad de datos</strong><p>Estamos comprobando contactos, seguimientos y configuracion.</p></div>
      </div>
    `;
  }

  if (state.dataQualityError) {
    return `
      <div class="forecast-state forecast-state-error" role="alert">
        <span class="forecast-state-icon" aria-hidden="true">!</span>
        <div><strong>Avisos no disponibles</strong><p>${escapeHtml(state.dataQualityError)}</p></div>
        <button type="button" data-quality-retry>Reintentar</button>
      </div>
    `;
  }

  const quality = model.dataQuality;
  if (!quality || typeof quality !== "object") {
    return `
      <div class="forecast-state forecast-state-empty">
        <span class="forecast-state-icon" aria-hidden="true">0</span>
        <div><strong>Sin revision calculada</strong><p>Actualiza el negocio para comprobar la calidad de sus datos.</p></div>
      </div>
    `;
  }

  const counts = quality.counts && typeof quality.counts === "object" ? quality.counts : {};
  const totalFindings = forecastWholeNumber(counts.totalFindings);
  if (!totalFindings) {
    return `
      <div class="forecast-state forecast-state-empty data-quality-clean" role="status">
        <span class="forecast-state-icon" aria-hidden="true">OK</span>
        <div><strong>Datos en buen estado</strong><p>No hay avisos de contacto, seguimiento, consentimiento o configuracion.</p></div>
      </div>
    `;
  }

  const configuration = quality.businessConfiguration && typeof quality.businessConfiguration === "object"
    ? quality.businessConfiguration
    : {};
  const missingConfiguration = [
    configuration.missingReviewUrl ? "enlace de resenas" : "",
    configuration.missingBookingUrl ? "enlace de reserva" : ""
  ].filter(Boolean).join(" y ") || "Configuracion operativa completa";
  const categories = [
    {
      title: "Telefono o email incompleto",
      count: counts.contactsMissingPhoneOrEmail,
      note: `${forecastWholeNumber(counts.contactsWithoutAnyChannel)} contacto(s) sin ningun canal`,
      target: "leads",
      action: "Abrir CRM"
    },
    {
      title: "Leads sin proxima accion",
      count: counts.openLeadsWithoutPendingNextAction,
      note: "Contactos abiertos sin seguimiento pendiente",
      target: "leads",
      action: "Abrir CRM"
    },
    {
      title: "Clientes sin consentimiento",
      count: counts.customersWithoutConsent,
      note: "Clientes que requieren revisar su consentimiento",
      target: "customers",
      action: "Ver clientes"
    },
    {
      title: "Configuracion del negocio",
      count: counts.businessConfigurationIssues,
      note: missingConfiguration,
      target: "settings",
      action: "Abrir Ajustes"
    }
  ];

  return `
    <div class="data-quality-summary">
      <strong>${escapeHtml(String(totalFindings))}</strong>
      <span>aviso${totalFindings === 1 ? "" : "s"} por resolver</span>
    </div>
    <div class="data-quality-grid" role="list" aria-label="Categorias de avisos de calidad de datos">
      ${categories.map((category) => renderDataQualityCategory(category)).join("")}
    </div>
  `;
}

function renderDataQualityCategory(category) {
  const count = forecastWholeNumber(category.count);
  return `
    <article class="data-quality-card${count ? " has-findings" : " is-clear"}" role="listitem">
      <span aria-label="${escapeAttr(`${count} avisos`)}">${escapeHtml(String(count))}</span>
      <div><h4>${escapeHtml(category.title)}</h4><p>${escapeHtml(category.note)}</p></div>
      <button type="button" data-quality-target="${escapeAttr(category.target)}">${escapeHtml(category.action)}</button>
    </article>
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

  document.querySelector("[data-quality-retry]")?.addEventListener("click", async () => {
    const businessRef = state.business?.id || state.business?.slug || "";
    if (businessRef) {
      await loadDataQuality(businessRef, { render: true });
    }
  });

  document.querySelectorAll("[data-quality-target]").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = clean(button.dataset.qualityTarget);
      if (!["leads", "customers", "settings"].includes(tab)) {
        return;
      }

      setActiveTab(tab);
      document.querySelector(`[data-tab="${tab}"]`)?.focus();
    });
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
    ${renderFoundationCenters(model)}
    ${renderAutomationStudio(model)}
  `;
}

function renderFoundationCenters(model) {
  if (state.clientSession) {
    return "";
  }
  return `
    <section class="foundation-center" data-foundation-center aria-labelledby="foundationCenterTitle">
      <header class="foundation-center-header">
        <div>
          <p class="eyebrow">Base operativa auditable</p>
          <h2 id="foundationCenterTitle">Seguridad, CRM y dinero</h2>
          <p>Roles aplicados en servidor, campos configurables y una vista financiera normalizada sin perder los datos heredados.</p>
        </div>
        ${state.businessUserSession?.user ? `<span class="foundation-session-pill">${escapeHtml(state.businessUserSession.user.name || state.businessUserSession.user.email)} · ${escapeHtml(statusLabel(state.businessUserSession.user.role))}</span>` : ""}
      </header>
      <div class="foundation-module-grid">
        ${renderSecurityCenter()}
        ${renderMoneyCenter(model)}
        ${renderCrmConfigCenter()}
      </div>
    </section>
  `;
}

function renderSecurityCenter() {
  if (state.securityLoading) {
    return foundationLoadingCard("Accesos y auditoría");
  }
  if (!state.securityCenter) {
    return foundationUnavailableCard("Accesos y auditoría", state.securityError || "Centro pendiente de cargar.");
  }
  const center = state.securityCenter;
  const roles = Array.isArray(center.roles) ? center.roles : [];
  const users = Array.isArray(center.users) ? center.users : [];
  const audit = Array.isArray(center.audit) ? center.audit : [];
  return `
    <article class="foundation-module security-center" data-security-center>
      <div class="foundation-module-heading">
        <div><p class="eyebrow">RBAC real</p><h3>Accesos y auditoría</h3></div>
        <span>${escapeHtml(String(center.summary?.activeUsers || 0))} activos</span>
      </div>
      ${state.securityFeedback ? `<p class="foundation-feedback">${escapeHtml(state.securityFeedback)}</p>` : ""}
      <div class="foundation-kpis">
        <div><strong>${escapeHtml(String(users.length))}</strong><span>Usuarios</span></div>
        <div><strong>${escapeHtml(String(roles.length))}</strong><span>Roles</span></div>
        <div><strong>${escapeHtml(String(center.summary?.sensitiveEvents || audit.length))}</strong><span>Eventos</span></div>
      </div>
      <details class="foundation-create-panel">
        <summary>Crear usuario del equipo</summary>
        <form data-security-user-form class="foundation-form">
          <label>Nombre<input name="name" required maxlength="120"></label>
          <label>Email<input name="email" type="email" required></label>
          <label>Rol<select name="role">${roles.map((role) => `<option value="${escapeAttr(role.id)}">${escapeHtml(role.name)}</option>`).join("")}</select></label>
          <label>Contraseña<input name="password" type="password" minlength="10" required></label>
          <button type="submit">Crear usuario</button>
        </form>
      </details>
      <div class="foundation-list" aria-label="Usuarios del negocio">
        ${users.length ? users.map((user) => `
          <article>
            <div><strong>${escapeHtml(user.name || user.email)}</strong><small>${escapeHtml(user.email)} · ${escapeHtml(statusLabel(user.role))}</small></div>
            <div class="foundation-row-actions">
              <span class="${user.active === false ? "is-off" : "is-on"}">${user.active === false ? "Desactivado" : "Activo"}</span>
              ${user.active === false ? "" : `<button type="button" data-security-disable-user="${escapeAttr(user.id)}">Desactivar</button>`}
            </div>
          </article>
        `).join("") : `<p class="foundation-empty">Crea el primer propietario para activar inicios de sesión independientes.</p>`}
      </div>
      <details class="foundation-audit">
        <summary>Últimos eventos auditados (${audit.length})</summary>
        <div class="foundation-list">
          ${audit.length ? audit.slice(0, 12).map((event) => `<article><div><strong>${escapeHtml(statusLabel(event.action))}</strong><small>${escapeHtml(event.actorId)} · ${escapeHtml(formatDateTime(event.createdAt))}</small></div><span>${escapeHtml(event.resource)}</span></article>`).join("") : `<p class="foundation-empty">Aún no hay eventos.</p>`}
        </div>
      </details>
    </article>
  `;
}

function renderMoneyCenter(model) {
  if (state.moneyLoading) {
    return foundationLoadingCard("Centro de dinero");
  }
  if (!state.moneyCenter) {
    return foundationUnavailableCard("Centro de dinero", state.moneyError || "Centro pendiente de cargar.");
  }
  const center = state.moneyCenter;
  const records = Array.isArray(center.records) ? center.records : [];
  const currencySummary = Array.isArray(center.summary?.byCurrency) ? center.summary.byCurrency : [];
  return `
    <article class="foundation-module money-center" data-money-center>
      <div class="foundation-module-heading">
        <div><p class="eyebrow">Modelo financiero único</p><h3>Centro de dinero</h3></div>
        <button type="button" data-money-reconcile>Reconciliar</button>
      </div>
      ${state.moneyFeedback ? `<p class="foundation-feedback">${escapeHtml(state.moneyFeedback)}</p>` : ""}
      <div class="foundation-kpis">
        <div><strong>${escapeHtml(String(center.summary?.total || 0))}</strong><span>Documentos</span></div>
        <div><strong>${escapeHtml(String(center.summary?.open || 0))}</strong><span>Abiertos</span></div>
        <div><strong>${escapeHtml(String(center.summary?.overdue || 0))}</strong><span>Vencidos</span></div>
      </div>
      ${currencySummary.map((summary) => `<div class="money-summary-line"><span>${escapeHtml(summary.currency)}</span><strong>${escapeHtml(formatMoney(summary.paid, summary.currency))} cobrados</strong><small>${escapeHtml(formatMoney(summary.outstanding, summary.currency))} pendientes</small></div>`).join("")}
      <div class="foundation-list money-record-list">
        ${records.length ? records.slice(0, 20).map((record) => `
          <article>
            <div>
              <strong>${escapeHtml(record.number || record.id)} · ${escapeHtml(record.customerName || "Cliente sin asociar")}</strong>
              <small>${escapeHtml(statusLabel(record.status))} · ${escapeHtml(formatMoney(record.total, record.currency))} · saldo ${escapeHtml(formatMoney(record.balance, record.currency))}</small>
              <small>${record.contactId ? `Contacto ${escapeHtml(record.contactId)}` : record.legacyCustomerNamePreserved ? "Nombre heredado preservado" : "Sin contacto asociado"}</small>
            </div>
            ${Number(record.balance || 0) > 0 ? `
              <form data-money-payment-form data-record-id="${escapeAttr(record.id)}" class="money-payment-form">
                <label><span class="sr-only">Importe</span><input name="amount" type="number" min="0.01" step="0.01" max="${escapeAttr(String(record.balance))}" value="${escapeAttr(String(record.balance))}" required></label>
                <button type="submit">Registrar cobro</button>
              </form>
            ` : `<span class="is-on">Pagado</span>`}
          </article>
        `).join("") : `<p class="foundation-empty">No hay facturas que normalizar todavía.</p>`}
      </div>
      <small class="foundation-note">Las líneas, impuestos, divisa, vencimiento, enlaces y pagos quedan en el registro normalizado; el origen se conserva y sincroniza.</small>
    </article>
  `;
}

function renderCrmConfigCenter() {
  if (state.crmConfigLoading) {
    return foundationLoadingCard("Configuración CRM");
  }
  if (!state.crmConfigCenter) {
    return foundationUnavailableCard("Configuración CRM", state.crmConfigError || "Centro pendiente de cargar.");
  }
  const center = state.crmConfigCenter;
  const fields = Array.isArray(center.fieldDefinitions) ? center.fieldDefinitions : [];
  const views = Array.isArray(center.savedViews) ? center.savedViews : [];
  const rules = Array.isArray(center.pipelineRules) ? center.pipelineRules : [];
  const pipelines = Array.isArray(center.pipelines) ? center.pipelines : [];
  const pipelineOptions = pipelines.flatMap((pipeline) => (pipeline.stages || []).map((stage) => ({
    pipelineId: pipeline.id,
    pipelineName: pipeline.name || "Pipeline",
    stageId: stage.id,
    stageName: stage.name || stage.label || stage.id
  })));
  return `
    <article class="foundation-module crm-config-center" data-crm-config-center>
      <div class="foundation-module-heading">
        <div><p class="eyebrow">Sin código</p><h3>Configuración CRM</h3></div>
        <span>${fields.length + views.length + rules.length} reglas</span>
      </div>
      ${state.crmConfigFeedback ? `<p class="foundation-feedback">${escapeHtml(state.crmConfigFeedback)}</p>` : ""}
      <div class="foundation-kpis">
        <div><strong>${fields.length}</strong><span>Campos</span></div>
        <div><strong>${views.length}</strong><span>Vistas</span></div>
        <div><strong>${rules.length}</strong><span>Etapas</span></div>
      </div>
      <details class="foundation-create-panel">
        <summary>Nuevo campo tipado</summary>
        <form data-crm-field-form class="foundation-form">
          <label>Entidad<select name="entityType">${["contact", "account", "deal", "task", "proposal", "booking", "project", "invoice"].map((item) => `<option value="${item}">${escapeHtml(statusLabel(item))}</option>`).join("")}</select></label>
          <label>Etiqueta<input name="label" required maxlength="120"></label>
          <label>Tipo<select name="type">${["text", "textarea", "number", "currency", "date", "datetime", "boolean", "select", "multiselect", "email", "phone", "url"].map((item) => `<option value="${item}">${escapeHtml(statusLabel(item))}</option>`).join("")}</select></label>
          <label>Opciones (separadas por coma)<input name="options" placeholder="vip, recurrente, nuevo"></label>
          <label class="foundation-checkbox"><input name="required" type="checkbox"> Obligatorio</label>
          <button type="submit">Crear campo</button>
        </form>
      </details>
      <details class="foundation-create-panel">
        <summary>Nueva vista compuesta</summary>
        <form data-crm-view-form class="foundation-form">
          <label>Nombre<input name="name" required maxlength="120"></label>
          <label>Entidad<select name="entityType">${["contact", "account", "deal", "task", "proposal", "booking", "project", "invoice"].map((item) => `<option value="${item}">${escapeHtml(statusLabel(item))}</option>`).join("")}</select></label>
          <label>Campo del filtro<input name="filterField" placeholder="status" required></label>
          <label>Operador<select name="operator">${["eq", "neq", "contains", "gt", "gte", "lt", "lte", "empty", "not_empty"].map((item) => `<option value="${item}">${item}</option>`).join("")}</select></label>
          <label>Valor<input name="value"></label>
          <label>Columnas<input name="columns" placeholder="name, status, ownerId"></label>
          <button type="submit">Guardar vista</button>
        </form>
      </details>
      ${pipelineOptions.length ? `
        <details class="foundation-create-panel">
          <summary>Regla de etapa</summary>
          <form data-crm-pipeline-rule-form class="foundation-form">
            <label>Etapa<select name="pipelineStage">${pipelineOptions.map((item) => `<option value="${escapeAttr(`${item.pipelineId}|${item.stageId}`)}">${escapeHtml(item.pipelineName)} · ${escapeHtml(item.stageName)}</option>`).join("")}</select></label>
            <label>Probabilidad<input name="probability" type="number" min="0" max="100" value="50" required></label>
            <label>Tarea automática<input name="taskTitle" placeholder="Llamar al cliente"></label>
            <label>Plazo (horas)<input name="dueInHours" type="number" min="0" value="24"></label>
            <label>Requisito de salida<input name="exitField" placeholder="nextActionAt"></label>
            <button type="submit">Guardar regla</button>
          </form>
        </details>
      ` : ""}
      <div class="foundation-list crm-config-list">
        ${fields.map((field) => `<article><div><strong>${escapeHtml(field.label)}</strong><small>${escapeHtml(statusLabel(field.entityType))} · ${escapeHtml(statusLabel(field.type))}${field.required ? " · obligatorio" : ""}</small></div><button type="button" data-crm-config-delete="fields" data-config-id="${escapeAttr(field.id)}">Archivar</button></article>`).join("")}
        ${views.map((view) => `<article><div><strong>${escapeHtml(view.name)}</strong><small>Vista ${escapeHtml(statusLabel(view.entityType))} · ${(view.filters?.conditions || []).length} filtros</small></div><button type="button" data-crm-config-delete="views" data-config-id="${escapeAttr(view.id)}">Archivar</button></article>`).join("")}
        ${rules.map((rule) => `<article><div><strong>Etapa ${escapeHtml(rule.stageId)}</strong><small>${escapeHtml(String(rule.probability))}% · ${(rule.automaticTasks || []).length} tareas automáticas</small></div><button type="button" data-crm-config-delete="pipeline-rules" data-config-id="${escapeAttr(rule.id)}">Archivar</button></article>`).join("")}
        ${fields.length + views.length + rules.length ? "" : `<p class="foundation-empty">Añade campos, vistas o reglas de etapa para adaptar el CRM.</p>`}
      </div>
    </article>
  `;
}

function foundationLoadingCard(title) {
  return `<article class="foundation-module is-loading"><p class="eyebrow">Cargando</p><h3>${escapeHtml(title)}</h3><p>Preparando datos y permisos.</p></article>`;
}

function foundationUnavailableCard(title, message) {
  return `<article class="foundation-module is-unavailable"><p class="eyebrow">Acceso controlado</p><h3>${escapeHtml(title)}</h3><p>${escapeHtml(message)}</p></article>`;
}

function bindFoundationControls(model) {
  const businessRef = model.business?.id || model.business?.slug || "";
  if (!businessRef || state.clientSession) {
    return;
  }
  const base = `/api/businesses/${encodeURIComponent(businessRef)}`;

  document.querySelector("[data-security-user-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runFoundationMutation("security", async () => {
      const payload = await postJson(`${base}/security/users`, {
        name: clean(form.get("name")),
        email: clean(form.get("email")),
        role: clean(form.get("role")),
        password: String(form.get("password") || "")
      });
      state.securityCenter = payload.center || state.securityCenter;
      event.currentTarget.reset();
    }, "Usuario creado y permisos aplicados en servidor.");
  });

  document.querySelectorAll("[data-security-disable-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("¿Desactivar este usuario? Sus sesiones quedarán invalidadas.")) {
        return;
      }
      await runFoundationMutation("security", async () => {
        const payload = await deleteJson(`${base}/security/users/${encodeURIComponent(button.dataset.securityDisableUser)}`);
        state.securityCenter = payload.center || state.securityCenter;
      }, "Usuario desactivado y evento auditado.");
    });
  });

  document.querySelector("[data-money-reconcile]")?.addEventListener("click", async () => {
    await runFoundationMutation("money", async () => {
      const payload = await postJson(`${base}/money/reconcile`, {});
      state.moneyCenter = payload.center || state.moneyCenter;
    }, "Facturas reconciliadas de forma idempotente.");
  });

  document.querySelectorAll("[data-money-payment-form]").forEach((formElement) => {
    formElement.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(formElement);
      const amount = Number(form.get("amount"));
      if (!window.confirm(`¿Registrar un cobro manual de ${formatMoney(amount, model.currency || "EUR")}?`)) {
        return;
      }
      await runFoundationMutation("money", async () => {
        const payload = await postJson(`${base}/money/${encodeURIComponent(formElement.dataset.recordId)}/payments`, {
          amount,
          provider: "manual",
          status: "paid",
          paidAt: new Date().toISOString()
        });
        state.moneyCenter = payload.center || state.moneyCenter;
      }, "Cobro registrado, saldo recalculado y origen sincronizado.");
    });
  });

  document.querySelector("[data-crm-field-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const type = clean(form.get("type"));
    const options = clean(form.get("options")).split(",").map((item) => item.trim()).filter(Boolean);
    await runFoundationMutation("crmConfig", async () => {
      const payload = await postJson(`${base}/crm-config/fields`, {
        entityType: clean(form.get("entityType")),
        label: clean(form.get("label")),
        type,
        required: form.get("required") === "on",
        options: ["select", "multiselect"].includes(type) ? options : []
      });
      state.crmConfigCenter = payload.center || state.crmConfigCenter;
      event.currentTarget.reset();
    }, "Campo tipado creado y listo para validar datos.");
  });

  document.querySelector("[data-crm-view-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const operator = clean(form.get("operator"));
    await runFoundationMutation("crmConfig", async () => {
      const payload = await postJson(`${base}/crm-config/views`, {
        name: clean(form.get("name")),
        entityType: clean(form.get("entityType")),
        visibility: "team",
        filters: {
          combinator: "and",
          conditions: [{
            field: clean(form.get("filterField")),
            operator,
            value: ["empty", "not_empty"].includes(operator) ? null : clean(form.get("value"))
          }]
        },
        columns: clean(form.get("columns")).split(",").map((item) => item.trim()).filter(Boolean),
        bulkActions: ["assign", "tag", "export"]
      });
      state.crmConfigCenter = payload.center || state.crmConfigCenter;
      event.currentTarget.reset();
    }, "Vista compuesta guardada para el equipo.");
  });

  document.querySelector("[data-crm-pipeline-rule-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const [pipelineId, stageId] = clean(form.get("pipelineStage")).split("|");
    const taskTitle = clean(form.get("taskTitle"));
    const exitField = clean(form.get("exitField"));
    await runFoundationMutation("crmConfig", async () => {
      const payload = await postJson(`${base}/crm-config/pipeline-rules`, {
        pipelineId,
        stageId,
        probability: Number(form.get("probability")),
        entryConditions: { combinator: "and", conditions: [] },
        exitRequirements: exitField ? [{ field: exitField, operator: "not_empty" }] : [],
        automaticTasks: taskTitle ? [{
          title: taskTitle,
          dueInHours: Number(form.get("dueInHours") || 0),
          ownerStrategy: "deal_owner"
        }] : []
      });
      state.crmConfigCenter = payload.center || state.crmConfigCenter;
      event.currentTarget.reset();
    }, "Regla de pipeline guardada con probabilidad y automatización.");
  });

  document.querySelectorAll("[data-crm-config-delete]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("¿Archivar esta configuración? Los datos existentes no se borrarán.")) {
        return;
      }
      await runFoundationMutation("crmConfig", async () => {
        const payload = await deleteJson(`${base}/crm-config/${encodeURIComponent(button.dataset.crmConfigDelete)}/${encodeURIComponent(button.dataset.configId)}`);
        state.crmConfigCenter = payload.center || state.crmConfigCenter;
      }, "Configuración archivada sin borrar datos existentes.");
    });
  });
}

async function runFoundationMutation(area, operation, successMessage) {
  const feedbackKey = `${area}Feedback`;
  try {
    state[feedbackKey] = "Guardando...";
    render();
    await operation();
    state[feedbackKey] = successMessage;
    render();
  } catch (error) {
    state[feedbackKey] = error.message || "No se pudo completar la acción.";
    render();
  }
}

function bindGrowthOperationsControls(model) {
  const businessRef = model.business?.id || model.business?.slug || "";
  if (!businessRef || state.clientSession) return;
  const base = `/api/businesses/${encodeURIComponent(businessRef)}`;

  document.querySelector("[data-loyalty-program-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runGrowthOperation("loyalty", async () => {
      const payload = await putJson(`${base}/loyalty/program`, {
        name: clean(form.get("name")),
        mode: clean(form.get("mode")),
        unitLabel: clean(form.get("unitLabel")),
        earnPerCurrency: 1,
        expirationDays: Number(form.get("expirationDays")),
        referral: {
          enabled: true,
          referrerReward: Number(form.get("referrerReward")),
          referredReward: Number(form.get("referredReward")),
          maxConversionsPerReferrer: Number(form.get("maxConversionsPerReferrer")),
          attributionDays: 30
        }
      });
      state.loyaltyCenter = payload.center || state.loyaltyCenter;
    }, "Programa guardado con caducidad, niveles y límites de referido.");
  });

  document.querySelector("[data-loyalty-movement-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runGrowthOperation("loyalty", async () => {
      const payload = await postJson(`${base}/loyalty/movements`, {
        contactId: clean(form.get("contactId")),
        type: clean(form.get("type")),
        amount: Number(form.get("amount")),
        reason: clean(form.get("reason")),
        sourceType: "dashboard"
      });
      state.loyaltyCenter = payload.center || state.loyaltyCenter;
      event.currentTarget.reset();
    }, "Movimiento inmutable registrado con autor y motivo.");
  });

  document.querySelector("[data-loyalty-reward-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runGrowthOperation("loyalty", async () => {
      const payload = await postJson(`${base}/loyalty/rewards`, {
        name: clean(form.get("name")),
        cost: Number(form.get("cost")),
        stock: Number(form.get("stock") || 0),
        unlimited: form.get("unlimited") === "on"
      });
      state.loyaltyCenter = payload.center || state.loyaltyCenter;
      event.currentTarget.reset();
    }, "Recompensa creada con coste y disponibilidad.");
  });

  document.querySelectorAll("[data-referral-code-contact]").forEach((button) => {
    button.addEventListener("click", async () => {
      await runGrowthOperation("loyalty", async () => {
        const payload = await postJson(`${base}/loyalty/referrals/codes`, { contactId: button.dataset.referralCodeContact });
        state.loyaltyCenter = payload.center || state.loyaltyCenter;
      }, "Código único de referido creado.");
    });
  });

  document.querySelectorAll("[data-loyalty-redeem]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("¿Canjear esta recompensa? El movimiento no se podrá borrar; una corrección quedaría auditada.")) return;
      await runGrowthOperation("loyalty", async () => {
        const payload = await postJson(`${base}/loyalty/rewards/${encodeURIComponent(button.dataset.rewardId)}/redeem`, {
          accountId: button.dataset.accountId,
          idempotencyKey: `dashboard:${button.dataset.accountId}:${button.dataset.rewardId}:${Date.now()}`
        });
        state.loyaltyCenter = payload.center || state.loyaltyCenter;
      }, "Recompensa emitida y saldo actualizado.");
    });
  });

  document.querySelector("[data-referral-attribution-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runGrowthOperation("loyalty", async () => {
      const payload = await postJson(`${base}/loyalty/referrals/attribute`, {
        code: clean(form.get("code")),
        referredContactId: clean(form.get("referredContactId")),
        fingerprint: clean(form.get("fingerprint")),
        source: "dashboard"
      });
      state.loyaltyCenter = payload.center || state.loyaltyCenter;
      event.currentTarget.reset();
    }, "Referido atribuido tras validar duplicados y señales antiabuso.");
  });

  document.querySelectorAll("[data-referral-convert]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("¿Confirmar que este referido convirtió y emitir ambos premios?")) return;
      await runGrowthOperation("loyalty", async () => {
        const payload = await postJson(`${base}/loyalty/referrals/${encodeURIComponent(button.dataset.referralConvert)}/convert`, {});
        state.loyaltyCenter = payload.center || state.loyaltyCenter;
      }, "Conversión confirmada y premios emitidos una sola vez.");
    });
  });

  document.querySelector("[data-vertical-zone-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runGrowthOperation("verticalOperations", async () => {
      const payload = await postJson(`${base}/vertical/zones`, {
        name: clean(form.get("name")),
        capacity: Number(form.get("capacity")),
        resourceIds: form.getAll("resourceIds").map(clean).filter(Boolean)
      });
      state.verticalOperationsCenter = payload.center || state.verticalOperationsCenter;
      event.currentTarget.reset();
    }, "Zona creada y recursos vinculados.");
  });

  document.querySelector("[data-vertical-combination-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runGrowthOperation("verticalOperations", async () => {
      const payload = await postJson(`${base}/vertical/combinations`, {
        name: clean(form.get("name")),
        zoneId: clean(form.get("zoneId")),
        tableResourceIds: form.getAll("tableResourceIds").map(clean).filter(Boolean),
        minGuests: Number(form.get("minGuests")),
        maxGuests: Number(form.get("maxGuests"))
      });
      state.verticalOperationsCenter = payload.center || state.verticalOperationsCenter;
      event.currentTarget.reset();
    }, "Combinación explícita de mesas guardada.");
  });

  document.querySelector("[data-vertical-shift-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runGrowthOperation("verticalOperations", async () => {
      const payload = await postJson(`${base}/vertical/shifts`, {
        name: clean(form.get("name")),
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        startTime: clean(form.get("startTime")),
        endTime: clean(form.get("endTime")),
        expectedDurationMinutes: Number(form.get("expectedDurationMinutes")),
        turnoverBufferMinutes: Number(form.get("turnoverBufferMinutes")),
        maxCovers: Number(form.get("maxCovers"))
      });
      state.verticalOperationsCenter = payload.center || state.verticalOperationsCenter;
      event.currentTarget.reset();
    }, "Turno operativo creado con duración y rotación previstas.");
  });

  document.querySelector("[data-vertical-policy-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runGrowthOperation("verticalOperations", async () => {
      const payload = await postJson(`${base}/vertical/policies`, {
        name: clean(form.get("name")),
        version: clean(form.get("version")),
        visibleText: clean(form.get("visibleText")),
        cancellationHours: Number(form.get("cancellationHours")),
        refundPercentBeforeDeadline: Number(form.get("refundPercentBeforeDeadline")),
        refundPercentAfterDeadline: Number(form.get("refundPercentAfterDeadline")),
        noShowDepositTreatment: "review",
        disputeInstructions: clean(form.get("disputeInstructions"))
      });
      state.verticalOperationsCenter = payload.center || state.verticalOperationsCenter;
      event.currentTarget.reset();
    }, "Política visible versionada y lista para consentimiento.");
  });

  document.querySelector("[data-vertical-experience-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const inventoryItemId = clean(form.get("inventoryItemId"));
    const depositMode = clean(form.get("depositMode"));
    const zoneId = clean(form.get("zoneId"));
    const serviceShiftId = clean(form.get("serviceShiftId"));
    await runGrowthOperation("verticalOperations", async () => {
      const payload = await postJson(`${base}/vertical/experiences`, {
        name: clean(form.get("name")),
        type: clean(form.get("type")),
        serviceId: clean(form.get("serviceId")),
        policyId: clean(form.get("policyId")),
        zoneIds: zoneId ? [zoneId] : [],
        serviceShiftIds: serviceShiftId ? [serviceShiftId] : [],
        minGuests: 1,
        maxGuests: Number(form.get("capacity")),
        capacity: Number(form.get("capacity")),
        durationMinutes: Number(form.get("durationMinutes")),
        inventoryRules: inventoryItemId ? [{ inventoryItemId, quantityPerGuest: Number(form.get("quantityPerGuest")) }] : [],
        depositRules: depositMode === "none" ? [] : [{
          mode: depositMode,
          value: Number(form.get("depositValue")),
          validFrom: clean(form.get("validFrom")),
          validTo: clean(form.get("validTo")),
          segments: clean(form.get("segments")).split(",").map((item) => item.trim()).filter(Boolean),
          priority: 10
        }]
      });
      state.verticalOperationsCenter = payload.center || state.verticalOperationsCenter;
      event.currentTarget.reset();
    }, "Experiencia creada con aforo, stock y regla de señal.");
  });

  document.querySelector("[data-vertical-refresh]")?.addEventListener("click", async () => {
    await runGrowthOperation("verticalOperations", async () => {
      const payload = await getJson(`${base}/vertical`);
      state.verticalOperationsCenter = payload.center || state.verticalOperationsCenter;
    }, "Planificación recalculada con los datos actuales.");
  });

  document.querySelectorAll("[data-booking-combination-form]").forEach((formElement) => {
    formElement.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(formElement);
      await runGrowthOperation("verticalOperations", async () => {
        const payload = await postJson(`${base}/vertical/bookings/${encodeURIComponent(formElement.dataset.bookingId)}/combination`, {
          combinationId: clean(form.get("combinationId"))
        });
        state.bookings = state.bookings.map((item) => item.id === payload.booking.id ? { ...item, ...payload.booking } : item);
        const centerPayload = await getJson(`${base}/vertical`);
        state.verticalOperationsCenter = centerPayload.center || state.verticalOperationsCenter;
      }, "Combinación de mesas asignada explícitamente a la reserva.");
    });
  });

  document.querySelectorAll("[data-booking-policy-accept-form]").forEach((formElement) => {
    formElement.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(formElement);
      await runGrowthOperation("verticalOperations", async () => {
        await postJson(`${base}/vertical/bookings/${encodeURIComponent(formElement.dataset.bookingId)}/policy-acceptance`, {
          policyId: clean(form.get("policyId")),
          accepted: form.get("accepted") === "on",
          channel: "dashboard"
        });
        const payload = await getJson(`${base}/vertical`);
        state.verticalOperationsCenter = payload.center || state.verticalOperationsCenter;
        state.bookings = state.bookings.map((item) => item.id === formElement.dataset.bookingId ? { ...item, policyAcceptedAt: new Date().toISOString() } : item);
      }, "Consentimiento explícito y texto de política archivados.");
    });
  });

  document.querySelectorAll("[data-booking-public-confirmation]").forEach((button) => {
    button.addEventListener("click", async () => {
      await runGrowthOperation("verticalOperations", async () => {
        const payload = await postJson(`${base}/vertical/bookings/${encodeURIComponent(button.dataset.bookingPublicConfirmation)}/reminder-confirmations`, { expiresInHours: 48 });
        if (payload.publicUrl) await copyTextToClipboard(new URL(payload.publicUrl, window.location.origin).toString());
        const centerPayload = await getJson(`${base}/vertical`);
        state.verticalOperationsCenter = centerPayload.center || state.verticalOperationsCenter;
      }, "Enlace público confirmable copiado; caduca en 48 horas.");
    });
  });

  document.querySelectorAll("[data-booking-policy-event]").forEach((button) => {
    button.addEventListener("click", async () => {
      const type = button.dataset.eventType;
      const reason = window.prompt(type === "dispute_opened" ? "Motivo de la disputa" : "Motivo de la solicitud de devolución");
      if (!clean(reason) || !window.confirm("¿Registrar esta acción sensible? Quedará auditada y no se borrará.")) return;
      await runGrowthOperation("verticalOperations", async () => {
        await postJson(`${base}/vertical/bookings/${encodeURIComponent(button.dataset.bookingPolicyEvent)}/policy-events`, {
          type,
          amount: 0,
          currency: model.currency || "EUR",
          reason: clean(reason)
        });
        const payload = await getJson(`${base}/vertical`);
        state.verticalOperationsCenter = payload.center || state.verticalOperationsCenter;
      }, "Evento de política registrado con autor, motivo y evidencia.");
    });
  });
}

async function runGrowthOperation(area, operation, successMessage) {
  const feedbackKey = `${area}Feedback`;
  try {
    state[feedbackKey] = "Guardando...";
    render();
    await operation();
    state[feedbackKey] = successMessage;
    render();
  } catch (error) {
    state[feedbackKey] = error.message || "No se pudo completar la acción.";
    render();
  }
}

function bindIntelligenceControls(model) {
  const businessRef = model.business?.id || model.business?.slug || "";
  if (!businessRef || state.clientSession) return;
  const base = `/api/businesses/${encodeURIComponent(businessRef)}/intelligence`;

  document.querySelector("[data-intelligence-funnel-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const labels = clean(form.get("labels")).split(",").map((item) => item.trim()).filter(Boolean);
    const entities = clean(form.get("entities")).split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
    if (labels.length !== entities.length || labels.length < 2) {
      state.intelligenceFeedback = "Etiquetas y entidades deben tener la misma longitud (mínimo dos).";
      render();
      return;
    }
    await runIntelligenceOperation(async () => {
      const payload = await postJson(`${base}/funnels`, {
        name: clean(form.get("name")),
        steps: entities.map((entity, index) => ({
          id: `${entity}_${index + 1}`,
          label: labels[index],
          entity,
          statuses: entity === "proposal" ? ["accepted", "aceptada"] : entity === "booking" ? ["completed"] : entity === "money" ? ["paid", "partially_paid"] : []
        }))
      });
      state.intelligenceCenter = payload.center || state.intelligenceCenter;
      event.currentTarget.reset();
    }, "Embudo guardado con drilldowns y tiempos de transición.");
  });

  document.querySelector("[data-intelligence-goal-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runIntelligenceOperation(async () => {
      const payload = await postJson(`${base}/goals`, {
        name: clean(form.get("name")),
        metricKey: clean(form.get("metricKey")),
        target: Number(form.get("target")),
        scope: clean(form.get("scope")),
        scopeId: clean(form.get("scopeId")),
        periodStart: clean(form.get("periodStart")),
        periodEnd: clean(form.get("periodEnd"))
      });
      state.intelligenceCenter = payload.center || state.intelligenceCenter;
      event.currentTarget.reset();
    }, "Objetivo creado con progreso y alerta calculados.");
  });

  document.querySelector("[data-prediction-settings-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await runIntelligenceOperation(async () => {
      const payload = await putJson(`${base}/predictions/settings`, {
        enabled: form.get("enabled") === "on",
        minSampleSize: Number(form.get("minSampleSize")),
        compareBaseline: true
      });
      state.intelligenceCenter = payload.center || state.intelligenceCenter;
    }, form.get("enabled") === "on" ? "Calibración activada; la muestra insuficiente conserva la regla base." : "Predicción desactivada; solo se usa la regla base.");
  });

  document.querySelector("[data-copilot-query-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector("button");
    if (button) button.disabled = true;
    try {
      const payload = await postJson(`${base}/query`, { question: clean(form.get("question")) });
      state.intelligenceQueryResult = payload.result || null;
      state.intelligenceFeedback = payload.result?.answered ? "Consulta respondida desde el diccionario autorizado." : "No se encontró una métrica autorizada.";
      render();
    } catch (error) {
      state.intelligenceFeedback = error.message || "No se pudo responder la consulta.";
      render();
    }
  });

  document.querySelectorAll("[data-copilot-create-suggestion]").forEach((button) => {
    button.addEventListener("click", async () => {
      const suggestion = state.intelligenceCenter?.copilot?.suggestedDrafts?.[Number(button.dataset.copilotCreateSuggestion)];
      if (!suggestion) return;
      await runIntelligenceOperation(async () => {
        const payload = await postJson(`${base}/copilot/drafts`, suggestion);
        state.intelligenceCenter = payload.center || state.intelligenceCenter;
      }, "Borrador guardado para revisión; todavía no se ha enviado nada.");
    });
  });

  document.querySelectorAll("[data-copilot-confirm-draft]").forEach((button) => {
    button.addEventListener("click", async () => {
      const action = clean(button.dataset.action);
      if (!window.confirm(`¿Confirmar ${copilotActionLabel(action)}? Se registrarán autor, objetivo y confirmación explícita.`)) return;
      await runIntelligenceOperation(async () => {
        const payload = await postJson(`${base}/copilot/actions/confirm`, {
          draftId: button.dataset.copilotConfirmDraft,
          action,
          confirm: true,
          confirmationText: `Confirmación explícita desde dashboard: ${copilotActionLabel(action)}`,
          idempotencyKey: `dashboard:${button.dataset.copilotConfirmDraft}:${action}`
        });
        state.intelligenceCenter = payload.center || state.intelligenceCenter;
      }, "Acción sensible confirmada y auditada por la persona usuaria.");
    });
  });
}

async function runIntelligenceOperation(operation, successMessage) {
  try {
    state.intelligenceFeedback = "Guardando...";
    render();
    await operation();
    state.intelligenceFeedback = successMessage;
    render();
  } catch (error) {
    state.intelligenceFeedback = error.message || "No se pudo completar la acción.";
    render();
  }
}

function renderAutomationStudio(model) {
  if (state.automationLoading) {
    return `<section class="automation-studio" data-automation-studio><div class="inbox-state inbox-state-loading"><span class="inbox-spinner" aria-hidden="true"></span><div><strong>Cargando automatizaciones</strong><p>Preparando recetas, versiones, secuencias y ejecuciones.</p></div></div></section>`;
  }
  if (state.automationError && !state.automationCenter) {
    return `<section class="automation-studio" data-automation-studio><div class="inbox-state inbox-state-error"><span class="inbox-state-icon">!</span><div><strong>Estudio no disponible</strong><p>${escapeHtml(state.automationError)}</p></div><button type="button" data-automation-retry>Reintentar</button></div></section>`;
  }
  const center = state.automationCenter || { automations: [], recipes: [], enrollments: [] };
  const automations = Array.isArray(center.automations) ? center.automations : [];
  const recipes = Array.isArray(center.recipes) ? center.recipes : [];
  const enrollments = Array.isArray(center.enrollments) ? center.enrollments : [];
  const selected = automations.find((item) => item.id === state.automationSelectedId) || automations[0] || null;
  const active = automations.filter((item) => item.status === "published").length;
  const waiting = automations.reduce((sum, item) => sum + Number(item.metrics?.waiting || 0), 0);
  const failed = automations.reduce((sum, item) => sum + Number(item.metrics?.failed || 0), 0);
  const activeEnrollments = enrollments.filter((item) => item.status === "active").length;
  return `
    <section class="automation-studio" data-automation-studio aria-labelledby="automationStudioTitle">
      <header class="automation-studio-header">
        <div><p class="eyebrow">Crecimiento sin trabajo repetitivo</p><h2 id="automationStudioTitle">Estudio de automatizaciones</h2><p>Diseña, prueba, publica y audita flujos. Los envios respetan consentimiento, horarios y limites.</p></div>
        ${!state.clientSession ? `<button type="button" data-automation-seed-recipes>Importar recetas base</button>` : ""}
      </header>
      ${state.automationFeedback ? `<p class="automation-feedback">${escapeHtml(state.automationFeedback)}</p>` : ""}
      <div class="automation-kpi-grid">
        ${renderAutomationKpi("Flujos", automations.length, "Definiciones versionadas")}
        ${renderAutomationKpi("Publicados", active, "Activos para eventos reales")}
        ${renderAutomationKpi("En espera", waiting, "Quiet hours o demoras")}
        ${renderAutomationKpi("Secuencias activas", activeEnrollments, "Contactos inscritos")}
        ${renderAutomationKpi("Fallos", failed, "Con log y reintento")}
      </div>
      ${!state.clientSession ? renderAutomationCreateForm() : ""}
      <div class="automation-studio-layout">
        <aside class="automation-catalog">
          <div class="automation-section-heading"><div><p class="eyebrow">Biblioteca</p><h3>Flujos y secuencias</h3></div><span>${automations.length}</span></div>
          <div class="automation-card-list">
            ${automations.length ? automations.map((item) => renderAutomationCard(item, selected?.id)).join("") : `<div class="automation-empty"><strong>Sin automatizaciones</strong><p>Importa las recetas base o crea tu primer flujo.</p></div>`}
          </div>
          <details class="automation-recipe-library">
            <summary>Ver ${recipes.length} recetas disponibles</summary>
            <div>${recipes.map((recipe) => `<article><strong>${escapeHtml(recipe.name)}</strong><p>${escapeHtml(recipe.description)}</p><span>${escapeHtml(recipe.kind === "sequence" ? "Secuencia" : "Automatizacion")}</span></article>`).join("")}</div>
          </details>
        </aside>
        <div class="automation-detail-shell">
          ${selected ? renderAutomationDetail(selected, model, enrollments) : `<div class="automation-empty automation-empty-detail"><span aria-hidden="true">↯</span><strong>Selecciona o crea un flujo</strong><p>Aqui veras el diagrama, versiones, pruebas y ejecuciones.</p></div>`}
        </div>
      </div>
    </section>
  `;
}

function renderAutomationKpi(label, value, note) {
  return `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(note)}</small></article>`;
}

function renderAutomationCreateForm() {
  return `
    <details class="automation-create-panel">
      <summary>Crear flujo personalizado</summary>
      <form data-automation-create-form>
        <label><span>Nombre</span><input name="name" required maxlength="180" placeholder="Ej. Seguimiento tras presupuesto"></label>
        <label><span>Tipo</span><select name="kind"><option value="automation">Automatizacion</option><option value="sequence">Secuencia comercial</option></select></label>
        <label><span>Disparador</span><select name="triggerType"><option value="manual">Manual</option><option value="record.created">Registro creado</option><option value="record.updated">Registro actualizado</option><option value="event">Evento</option><option value="message.received">Mensaje recibido</option><option value="webhook">Webhook</option></select></label>
        <label><span>Entidad/evento</span><input name="triggerValue" maxlength="180" placeholder="contact, booking, proposal.accepted..."></label>
        <label><span>Espera inicial</span><input name="waitMinutes" type="number" min="0" max="525600" value="0"></label>
        <label><span>Primera accion</span><select name="action"><option value="create_task">Crear tarea</option><option value="add_tag">Añadir etiqueta</option><option value="send_message">Enviar mensaje</option><option value="update_contact">Actualizar contacto</option><option value="internal_note">Nota interna</option></select></label>
        <label class="is-wide"><span>Contenido de la accion</span><input name="actionValue" maxlength="1000" placeholder="Titulo, etiqueta o cuerpo del mensaje"></label>
        <button type="submit">Crear borrador</button>
      </form>
    </details>
  `;
}

function renderAutomationCard(automation, selectedId) {
  const status = automation.status || "draft";
  return `
    <button class="automation-card${automation.id === selectedId ? " is-selected" : ""}" type="button" data-automation-select="${escapeAttr(automation.id)}">
      <span class="automation-kind automation-kind-${escapeAttr(automation.kind)}">${automation.kind === "sequence" ? "SEQ" : "AUT"}</span>
      <span><strong>${escapeHtml(automation.name)}</strong><small>${escapeHtml(automation.description || "Sin descripcion")}</small><i><b class="automation-status automation-status-${escapeAttr(status)}">${escapeHtml(automationStatusLabel(status))}</b> v${escapeHtml(String(automation.publishedVersion || automation.draftVersion || 1))} · ${escapeHtml(String(automation.metrics?.runs || 0))} ejecuciones</i></span>
      ${automation.metrics?.failed ? `<em>${escapeHtml(String(automation.metrics.failed))} fallo(s)</em>` : ""}
    </button>
  `;
}

function renderAutomationDetail(automation, model, enrollments) {
  const definition = automation.draftDefinition || automation.publishedDefinition || {};
  const nodes = Array.isArray(definition.nodes) ? definition.nodes : [];
  const runs = Array.isArray(state.automationRuns) ? state.automationRuns : [];
  const sequenceEnrollments = enrollments.filter((item) => item.automationId === automation.id);
  const editableJson = JSON.stringify({ trigger: definition.trigger, nodes, quietHours: definition.quietHours, stopConditions: definition.stopConditions, limits: definition.limits }, null, 2);
  return `
    <article class="automation-detail" data-automation-detail="${escapeAttr(automation.id)}">
      <header class="automation-detail-header">
        <div><p>${automation.kind === "sequence" ? "Secuencia comercial" : "Automatizacion"} · ${escapeHtml(automationStatusLabel(automation.status))}</p><h3>${escapeHtml(automation.name)}</h3><span>${escapeHtml(automation.description || "Añade una descripcion para que el equipo entienda por que existe.")}</span></div>
        ${!state.clientSession ? `<div class="automation-detail-actions">
          <button type="button" data-automation-test>Probar</button>
          <button type="button" data-automation-publish${automation.status === "archived" ? " disabled" : ""}>Publicar v${escapeHtml(String(automation.draftVersion || 1))}</button>
          ${automation.publishedVersionId ? `<button type="button" data-automation-status="${automation.status === "paused" ? "published" : "paused"}">${automation.status === "paused" ? "Reactivar" : "Pausar"}</button>` : ""}
        </div>` : ""}
      </header>
      <div class="automation-version-strip">
        <span><strong>Borrador v${escapeHtml(String(automation.draftVersion || 1))}</strong> editable</span>
        <span><strong>${automation.publishedVersion ? `Publicada v${automation.publishedVersion}` : "Sin publicar"}</strong> ${automation.status === "published" ? "activa" : automation.status}</span>
        <span><strong>${escapeHtml(String(automation.metrics?.runs || 0))} ejecuciones</strong> ${escapeHtml(String(automation.metrics?.failed || 0))} fallos</span>
      </div>
      <section class="automation-flow" aria-label="Diagrama del flujo">
        ${nodes.length ? nodes.map((nodeValue, index) => `${renderAutomationNode(nodeValue)}${index < nodes.length - 1 ? `<span class="automation-flow-arrow" aria-hidden="true">↓</span>` : ""}`).join("") : `<p>Sin nodos.</p>`}
      </section>
      ${!state.clientSession ? `
        <div class="automation-control-grid">
          <form class="automation-test-form" data-automation-test-form>
            <div><strong>Modo prueba</strong><p>Simula condiciones, esperas y acciones sin enviar ni crear registros.</p></div>
            <label><span>Contacto de ejemplo</span><select name="contactId"><option value="">Sin contacto</option>${model.contacts.filter((contact) => !contact.merged).map((contact) => `<option value="${escapeAttr(contact.id)}">${escapeHtml(contact.name || contact.email || contact.phone || contact.id)}</option>`).join("")}</select></label>
            <button type="submit">Ejecutar simulacion</button>
          </form>
          ${automation.kind === "sequence" && automation.status === "published" ? renderSequenceEnrollmentForm(automation, model) : `<div class="automation-safety-note"><strong>Control de seguridad</strong><p>Publicar fija una version inmutable. Las ediciones posteriores permanecen en el siguiente borrador hasta volver a publicar.</p></div>`}
        </div>
        <details class="automation-json-editor">
          <summary>Editar definicion avanzada</summary>
          <form data-automation-draft-form>
            <label><span>Nombre</span><input name="name" maxlength="180" required value="${escapeAttr(automation.name)}"></label>
            <label><span>Descripcion</span><input name="description" maxlength="1000" value="${escapeAttr(automation.description || "")}"></label>
            <label class="is-wide"><span>Definicion JSON validada</span><textarea name="definition" rows="18" spellcheck="false">${escapeHtml(editableJson)}</textarea></label>
            <button type="submit">Guardar borrador v${escapeHtml(String(automation.draftVersion || 1))}</button>
          </form>
        </details>
      ` : ""}
      ${automation.kind === "sequence" ? renderSequenceEnrollments(sequenceEnrollments) : ""}
      ${renderAutomationRuns(runs)}
    </article>
  `;
}

function renderAutomationNode(nodeValue) {
  const type = clean(nodeValue.type || "action");
  return `<article class="automation-node automation-node-${escapeAttr(type)}"><span>${escapeHtml(automationNodeTypeLabel(type))}</span><strong>${escapeHtml(nodeValue.label || type)}</strong><p>${escapeHtml(automationNodeSummary(nodeValue))}</p></article>`;
}

function automationNodeSummary(nodeValue) {
  const config = nodeValue.config || {};
  if (nodeValue.type === "trigger") return `${config.type || "manual"}${config.entity ? ` · ${config.entity}` : config.event ? ` · ${config.event}` : ""}`;
  if (nodeValue.type === "condition" || nodeValue.type === "goal") return `${config.field || "campo"} ${config.operator || "equals"} ${Array.isArray(config.value) ? config.value.join(", ") : config.value ?? ""}`;
  if (nodeValue.type === "wait") return formatChannelDuration(Number(config.minutes || 0));
  if (nodeValue.type === "action") return ({ create_task: "Crear tarea", add_tag: `Etiqueta: ${config.tag || "-"}`, send_message: `Enviar ${config.channel || "email"}`, update_contact: "Actualizar contacto", internal_note: "Nota interna" })[config.action] || config.action || "Accion";
  return config.outcome || "Finalizar";
}

function renderSequenceEnrollmentForm(automation, model) {
  return `<form class="sequence-enroll-form" data-sequence-enroll-form><div><strong>Inscribir contactos</strong><p>Selecciona uno o varios. Previsualiza elegibles, bloqueados, pasos, quiet hours y paradas antes de activar.</p></div><label><span>Contactos</span><select name="contactIds" required multiple size="5">${model.contacts.filter((contact) => !contact.merged).map((contact) => `<option value="${escapeAttr(contact.id)}">${escapeHtml(contact.name || contact.email || contact.phone || contact.id)}</option>`).join("")}</select></label><input type="hidden" name="automationId" value="${escapeAttr(automation.id)}"><div class="sequence-enroll-actions"><button type="button" data-sequence-preview>Previsualizar</button><button type="submit">Inscribir elegibles</button></div></form>`;
}

function renderSequenceEnrollments(enrollments) {
  return `<section class="sequence-enrollment-section"><div class="automation-section-heading"><div><p class="eyebrow">Audiencia individual y masiva</p><h3>Inscripciones y resultados</h3></div><span>${enrollments.length}</span></div>${enrollments.length ? `<div class="sequence-enrollment-list">${enrollments.slice(0, 12).map((item) => `<article><div><strong>${escapeHtml(item.contact?.name || item.contact?.email || item.contactId)}</strong><span>${escapeHtml(automationStatusLabel(item.status))} · ${escapeHtml(formatInboxDateTime(item.enrolledAt, modelTimezone()))}</span></div><div class="sequence-metrics"><span>${escapeHtml(String(item.metrics?.sent || 0))} envios</span><span>${escapeHtml(String(item.metrics?.delivered || 0))} entregas</span><span>${escapeHtml(String(item.metrics?.responses || 0))} respuestas</span><span>${escapeHtml(String(item.metrics?.meetings || 0))} reuniones</span><span>${escapeHtml(String(item.metrics?.conversions || 0))} conversiones</span></div><p>${item.stoppedBy ? `Salida: ${escapeHtml(item.stoppedBy)}` : `Paradas: ${escapeHtml((item.stopConditions || []).join(", ") || "manual")}`}</p>${!state.clientSession && ["active", "paused"].includes(item.status) ? `<button type="button" data-sequence-enrollment-action="${item.status === "active" ? "pause" : "resume"}" data-enrollment-id="${escapeAttr(item.id)}">${item.status === "active" ? "Pausar" : "Reanudar"}</button><button type="button" data-sequence-enrollment-action="stop" data-enrollment-id="${escapeAttr(item.id)}">Detener</button>` : ""}</article>`).join("")}</div>` : `<p class="automation-empty">Todavia no hay contactos inscritos.</p>`}</section>`;
}

function renderAutomationRuns(runs) {
  return `<section class="automation-run-section"><div class="automation-section-heading"><div><p class="eyebrow">Trazabilidad</p><h3>Ejecuciones recientes</h3></div><span>${runs.length}</span></div>${runs.length ? `<div class="automation-run-list">${runs.slice(0, 10).map((run) => `<details><summary><span class="automation-run-status automation-run-status-${escapeAttr(run.status)}">${escapeHtml(automationStatusLabel(run.status))}</span><strong>${escapeHtml(run.testMode ? "Prueba" : run.event?.type || "Ejecucion")}</strong><time>${escapeHtml(formatInboxDateTime(run.createdAt, modelTimezone()))}</time><i>${escapeHtml(String(run.actionsExecuted || 0))} acciones</i></summary><div>${run.error ? `<p class="automation-run-error">${escapeHtml(run.error)}</p>` : ""}${(run.logs || []).map((log) => `<article><span>${escapeHtml(log.event)}</span><strong>${escapeHtml(log.status)}</strong><time>${escapeHtml(formatInboxDateTime(log.createdAt, modelTimezone()))}</time>${log.data?.label ? `<p>${escapeHtml(log.data.label)}</p>` : ""}</article>`).join("")}</div></details>`).join("")}</div>` : `<p class="automation-empty">Sin ejecuciones. Usa el modo prueba antes de publicar.</p>`}</section>`;
}

function automationStatusLabel(status) {
  return ({ draft: "Borrador", published: "Publicada", paused: "Pausada", archived: "Archivada", active: "Activa", stopped: "Detenida", completed: "Completada", failed: "Fallida", waiting: "En espera", running: "En curso", cancelled: "Cancelada", test_completed: "Prueba correcta" })[clean(status)] || statusLabel(status);
}

function automationNodeTypeLabel(type) {
  return ({ trigger: "Disparador", condition: "Condicion", wait: "Espera", action: "Accion", goal: "Objetivo", exit: "Salida" })[type] || type;
}

function renderReputationCenter() {
  if (state.reputationLoading) {
    return `<section class="reputation-center" data-reputation-center><div class="inbox-state inbox-state-loading"><span class="inbox-spinner" aria-hidden="true"></span><div><strong>Cargando reputacion</strong><p>Sincronizando cola, SLA y solicitudes.</p></div></div></section>`;
  }
  if (state.reputationError && !state.reputationCenter) {
    return `<section class="reputation-center" data-reputation-center><div class="inbox-state inbox-state-error"><span class="inbox-state-icon">!</span><div><strong>Centro de reputacion no disponible</strong><p>${escapeHtml(state.reputationError)}</p></div><button type="button" data-reputation-retry>Reintentar</button></div></section>`;
  }
  const center = state.reputationCenter || { summary: {}, reviews: [], requests: [], eligibleRequests: [], topics: [] };
  const summary = center.summary || {};
  const reviews = Array.isArray(center.reviews) ? center.reviews : [];
  const requests = Array.isArray(center.requests) ? center.requests : [];
  const eligible = Array.isArray(center.eligibleRequests) ? center.eligibleRequests : [];
  const topics = Array.isArray(center.topics) ? center.topics : [];
  const canManage = !state.clientSession;
  return `
    <section class="reputation-center" data-reputation-center>
      <header class="reputation-header">
        <div><p class="eyebrow">Reputacion operativa</p><h3>Resenas, respuestas y solicitudes con trazabilidad</h3><p>Prioriza incidencias por urgencia y SLA, revisa cada respuesta antes de publicarla y mide que solicitudes generan resenas.</p></div>
        <div class="reputation-header-actions">
          ${center.lastSync ? `<small>Ultima sincronizacion<br><strong>${escapeHtml(formatDateTime(center.lastSync.completedAt || center.lastSync.createdAt))}</strong></small>` : "<small>Sin sincronizaciones registradas</small>"}
          ${canManage ? '<button type="button" data-reputation-sync>Sincronizar Google</button>' : '<span class="pill neutral">Solo lectura</span>'}
        </div>
      </header>
      <div class="reputation-kpis">
        ${renderReputationKpi("Nota media", `${Number(summary.averageRating || 0).toFixed(2)}/5`, `${summary.total || 0} resenas`)}
        ${renderReputationKpi("Respuesta", `${Number(summary.responseRate || 0).toFixed(1)}%`, `${Number(summary.averageResponseHours || 0).toFixed(1)} h de media`)}
        ${renderReputationKpi("Pendientes", summary.pending || 0, `${summary.overdue || 0} fuera de SLA`)}
        ${renderReputationKpi("Solicitudes", summary.requestsSent || 0, `${summary.requestClicks || 0} clics`)}
        ${renderReputationKpi("Atribuidas", summary.reviewsAttributed || 0, "resenas vinculadas")}
      </div>
      ${state.reputationFeedback ? `<p class="reputation-feedback" role="status">${escapeHtml(state.reputationFeedback)}</p>` : ""}
      ${topics.length ? `<div class="reputation-topic-strip" aria-label="Temas recurrentes">${topics.slice(0, 8).map((topic) => `<span><strong>${escapeHtml(String(topic.count))}</strong>${escapeHtml(reputationTopicLabel(topic.topic))}</span>`).join("")}</div>` : ""}
      <div class="reputation-layout">
        <section class="reputation-review-queue">
          <header><div><h4>Cola de resenas</h4><p>Las criticas urgentes y vencidas aparecen primero visualmente.</p></div><span>${escapeHtml(String(reviews.length))}</span></header>
          ${reviews.length ? reviews.map((review) => renderReputationReview(review, canManage)).join("") : '<div class="reputation-empty"><strong>Sin resenas sincronizadas</strong><p>Conecta Business Profile y sincroniza para crear la cola operativa.</p></div>'}
        </section>
        <aside class="reputation-request-panel">
          <section>
            <header><div><h4>Experiencias elegibles</h4><p>Solo reservas completadas, con consentimiento y sin solicitud reciente.</p></div><span>${escapeHtml(String(eligible.length))}</span></header>
            ${eligible.length ? eligible.map((entry) => renderEligibleReviewRequest(entry, canManage)).join("") : '<p class="reputation-empty">No hay experiencias elegibles ahora.</p>'}
          </section>
          <section>
            <header><div><h4>Solicitudes recientes</h4><p>Envio, clic y atribucion sin incentivos.</p></div><span>${escapeHtml(String(requests.length))}</span></header>
            ${requests.length ? requests.slice(0, 12).map(renderReviewRequestRecord).join("") : '<p class="reputation-empty">Todavia no se han creado solicitudes.</p>'}
          </section>
        </aside>
      </div>
    </section>
  `;
}

function renderReputationKpi(label, value, note) {
  return `<article><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value))}</strong><small>${escapeHtml(note)}</small></article>`;
}

function renderReputationReview(review, canManage) {
  const reply = review.reply || null;
  const breached = Boolean(review.sla?.breached);
  const status = reply?.status || (review.providerReply?.comment ? "published" : "pending");
  return `
    <article class="reputation-review urgency-${escapeAttr(review.urgency || "normal")}${breached ? " is-overdue" : ""}" data-reputation-review="${escapeAttr(review.id)}">
      <header>
        <div><strong>${escapeHtml(review.reviewerName || "Cliente de Google")}</strong><span class="reputation-stars" aria-label="${escapeAttr(`${review.rating || 0} de 5 estrellas`)}">${escapeHtml("★".repeat(Math.max(0, Math.min(5, Number(review.rating || 0)))))}</span></div>
        <div><span class="pill ${breached ? "danger" : "neutral"}">${escapeHtml(breached ? "SLA vencido" : reputationUrgencyLabel(review.urgency))}</span><time>${escapeHtml(formatDateTime(review.reviewedAt))}</time></div>
      </header>
      <p>${escapeHtml(review.comment || "Resena sin comentario.")}</p>
      <div class="reputation-review-meta">
        <span>${escapeHtml(reputationSentimentLabel(review.sentiment))}</span>
        <span>${escapeHtml(review.sla?.dueAt ? `SLA ${formatDateTime(review.sla.dueAt)}` : "Sin SLA")}</span>
        ${(review.topics || []).map((topic) => `<span>${escapeHtml(reputationTopicLabel(topic))}</span>`).join("")}
      </div>
      ${reply || review.providerReply?.comment ? renderReputationReply(reply || { status: "published", comment: review.providerReply.comment, publishedAt: review.providerReply.updateTime }, review, canManage) : canManage ? `
        <form class="reputation-reply-form" data-reputation-reply-form data-review-id="${escapeAttr(review.id)}">
          <label><span>Borrador revisable</span><textarea name="comment" rows="3" maxlength="4096" placeholder="Escribe una respuesta o deja el campo vacio para usar la sugerencia explicable."></textarea></label>
          <button type="submit">Crear borrador</button>
        </form>` : '<p class="reputation-readonly-note">Respuesta pendiente del equipo.</p>'}
    </article>
  `;
}

function renderReputationReply(reply, review, canManage) {
  return `<section class="reputation-reply status-${escapeAttr(reply.status || "draft")}"><header><strong>${escapeHtml(reputationReplyStatusLabel(reply.status))}</strong>${reply.updatedAt || reply.publishedAt ? `<time>${escapeHtml(formatDateTime(reply.updatedAt || reply.publishedAt))}</time>` : ""}</header><p>${escapeHtml(reply.comment || "")}</p>${canManage ? `<div>${reply.status === "draft" ? `<button type="button" data-reputation-approve data-review-id="${escapeAttr(review.id)}" data-reply-id="${escapeAttr(reply.id)}">Aprobar</button>` : ""}${reply.status === "approved" ? `<button type="button" data-reputation-publish data-review-id="${escapeAttr(review.id)}" data-reply-id="${escapeAttr(reply.id)}">Publicar en Google</button>` : ""}</div>` : ""}</section>`;
}

function renderEligibleReviewRequest(entry, canManage) {
  return `<article class="eligible-review-request"><div><strong>${escapeHtml(entry.customerName || "Cliente")}</strong><span>${escapeHtml(entry.serviceName || "Experiencia completada")}</span><small>${escapeHtml(formatDateTime(entry.completedAt))}</small></div>${canManage ? `<form data-review-request-form data-booking-id="${escapeAttr(entry.bookingId)}" data-contact-id="${escapeAttr(entry.contactId)}"><select name="channel" aria-label="Canal">${(entry.channels || []).map((channel) => `<option value="${escapeAttr(channel)}"${channel === entry.recommendedChannel ? " selected" : ""}>${escapeHtml(channel === "whatsapp" ? "WhatsApp" : "Email")}</option>`).join("")}</select><button type="submit">Crear y enviar</button></form>` : `<span>${escapeHtml((entry.channels || []).join(", "))}</span>`}</article>`;
}

function renderReviewRequestRecord(request) {
  return `<article class="review-request-record"><div><strong>${escapeHtml(reputationRequestStatusLabel(request.status))}</strong><span>${escapeHtml(request.channel === "whatsapp" ? "WhatsApp" : "Email")}</span></div><small>${escapeHtml(formatDateTime(request.sentAt || request.createdAt))}</small>${request.clickedAt ? '<span class="pill neutral">Clic</span>' : ""}${request.reviewedAt ? '<span class="pill success">Resena atribuida</span>' : ""}</article>`;
}

function reputationUrgencyLabel(value) { return ({ critical: "Critica · 2 h", high: "Alta · 4 h", medium: "Media · 24 h", normal: "Normal · 72 h" })[value] || "Normal"; }
function reputationSentimentLabel(value) { return ({ positive: "Sentimiento positivo", neutral: "Sentimiento neutral", negative: "Sentimiento negativo" })[value] || "Sin sentimiento"; }
function reputationTopicLabel(value) { return ({ service: "Servicio", quality: "Calidad", speed: "Rapidez", price: "Precio", cleanliness: "Limpieza", booking: "Reservas", ambience: "Ambiente" })[value] || value || "Otro"; }
function reputationReplyStatusLabel(value) { return ({ draft: "Borrador pendiente", approved: "Aprobada para publicar", published: "Publicada" })[value] || "Respuesta"; }
function reputationRequestStatusLabel(value) { return ({ draft: "Borrador", sent: "Enviada", clicked: "Enlace abierto", reviewed: "Resena atribuida", failed: "Error" })[value] || value || "Solicitud"; }

function renderGoogle(model) {
  const container = document.querySelector('[data-list="google"]');

  if (!container) {
    return;
  }

  const reputation = renderReputationCenter();

  if (state.clientSession) {
    container.innerHTML = reputation;
    return;
  }

  if (state.googleError) {
    container.innerHTML = `${reputation}${emptyState("Google Ops no disponible", state.googleError)}`;
    return;
  }

  const status = state.googleStatus;

  if (!status) {
    container.innerHTML = `${reputation}${emptyState("Cargando Google Ops", "Actualiza el dashboard para consultar la conexion.")}`;
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
    ${reputation}
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
  const bookingResources = arrayFrom(crm.bookingResources, content.bookingResources, business.bookingResources);
  const bookingWaitlist = arrayFrom(crm.bookingWaitlist, content.bookingWaitlist, business.bookingWaitlist);
  const bookingResourceSummary = crm.bookingResourceSummary && typeof crm.bookingResourceSummary === "object" ? crm.bookingResourceSummary : null;
  const nextActions = normalizeNextActionsModel(crm.nextActions);
  const taskQueues = normalizeTaskQueues(crm.taskQueues);
  const taskMembers = Array.isArray(crm.taskMembers) ? crm.taskMembers : [];
  const consentCenter = crm.consentCenter && typeof crm.consentCenter === "object" ? crm.consentCenter : { contactId: "", data: null, loading: false, error: "" };
  const customer360 = crm.customer360 && typeof crm.customer360 === "object" ? crm.customer360 : null;
  const report = crm.report || null;
  const forecast = crm.forecast || null;
  const sla = crm.sla || null;
  const commercialDashboard = crm.commercialDashboard || null;
  const dataQuality = crm.dataQuality || null;
  const inbox = crm.inbox || null;
  const channelInbox = crm.channelInbox || null;
  const campaignCenter = crm.campaignCenter || null;
  const orders = arrayFrom(content.orders, commerce.orders, business.orders);
  const products = arrayFrom(content.products, commerce.products, business.products);
  const events = arrayFrom(content.metricEvents, business.metricEvents, content.events);
  const today = new Date();
  const currency = commerce.currency || content.currency || "EUR";
  const pipeline = crm.pipeline ? normalizePipelinePayload(crm.pipeline) : buildPipelineModel(contacts);
  const pipelines = Array.isArray(crm.pipelines) ? crm.pipelines : [];
  const accounts = Array.isArray(crm.accounts) ? crm.accounts : [];
  const accountDuplicateGroups = Array.isArray(crm.accountDuplicateGroups) ? crm.accountDuplicateGroups : [];
  const deals = Array.isArray(crm.deals) ? crm.deals : [];
  const dealPipeline = crm.dealPipeline ? normalizeDealPipelinePayload(crm.dealPipeline) : normalizeDealPipelinePayload({});
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
    accounts,
    accountDuplicateGroups,
    pipelines,
    deals,
    dealPipeline,
    duplicateGroups,
    proposals,
    customers,
    services,
    bookings,
    availability,
    blocks,
    reminderQueue,
    bookingResources,
    bookingWaitlist,
    bookingResourceSummary,
    nextActions,
    taskQueues,
    taskMembers,
    taskOwnerId: crm.taskOwnerId || "",
    consentCenter,
    customer360,
    report,
    forecast,
    sla,
    commercialDashboard,
    dataQuality,
    inbox,
    channelInbox,
    campaignCenter,
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

function bindAutomationControls() {
  const businessRef = state.business?.id || state.business?.slug || "";
  const selectedId = state.automationSelectedId;
  const refresh = async (feedback = "") => {
    state.automationFeedback = feedback;
    await loadAutomationCenter(businessRef, { render: true });
  };

  document.querySelector("[data-automation-retry]")?.addEventListener("click", () => loadAutomationCenter(businessRef, { render: true }));
  document.querySelectorAll("[data-automation-select]").forEach((button) => {
    button.addEventListener("click", async () => {
      await loadAutomationRuns(businessRef, clean(button.dataset.automationSelect), { render: true });
    });
  });

  document.querySelector("[data-automation-seed-recipes]")?.addEventListener("click", async () => {
    try {
      const result = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/automations/recipes/seed`, {});
      await refresh(result.created?.length ? `${result.created.length} receta(s) importadas como borrador.` : "Las recetas base ya estaban importadas.");
    } catch (error) {
      showNotice(error.message || "No se pudieron importar las recetas.", "error");
    }
  });

  document.querySelector("[data-automation-create-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const triggerType = clean(form.get("triggerType") || "manual");
    const triggerValue = clean(form.get("triggerValue"));
    const trigger = { type: triggerType };
    if (triggerType === "event") trigger.event = triggerValue || "custom.event";
    else if (["record.created", "record.updated"].includes(triggerType)) trigger.entity = triggerValue || "contact";
    const action = clean(form.get("action") || "create_task");
    const actionValue = clean(form.get("actionValue"));
    const actionConfig = { action };
    if (action === "create_task") Object.assign(actionConfig, { title: actionValue || "Seguimiento automatizado", taskType: "follow_up", priority: "normal" });
    if (action === "add_tag") actionConfig.tag = actionValue || "automatizado";
    if (action === "send_message") Object.assign(actionConfig, { channel: "email", purpose: "service", subject: "Seguimiento", body: actionValue || "Hola {{contact.name}}, queremos ayudarte con tu solicitud." });
    if (action === "update_contact") actionConfig.status = actionValue || "contacted";
    if (action === "internal_note") actionConfig.body = actionValue || "Nota creada por automatizacion";
    const nodes = [{ id: "trigger", type: "trigger", label: "Inicio", config: trigger }];
    const waitMinutes = Math.max(0, Number(form.get("waitMinutes") || 0));
    if (waitMinutes) nodes.push({ id: "wait", type: "wait", label: "Espera", config: { minutes: waitMinutes } });
    nodes.push({ id: "action", type: "action", label: "Primera accion", config: actionConfig }, { id: "exit", type: "exit", label: "Fin", config: { outcome: "completed" } });
    try {
      const payload = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/automations`, {
        name: form.get("name"), kind: form.get("kind"), trigger, nodes,
        quietHours: { enabled: action === "send_message", timezone: state.business?.timezone || "Europe/Madrid", start: "09:00", end: "20:00", days: [1, 2, 3, 4, 5] },
        stopConditions: form.get("kind") === "sequence" ? ["reply", "booking", "proposal_accepted", "unsubscribe"] : []
      });
      state.automationSelectedId = payload.automation.id;
      await refresh("Borrador creado. Pruebalo y publicalo cuando este listo.");
    } catch (error) {
      showNotice(error.message || "No se pudo crear la automatizacion.", "error");
    }
  });

  document.querySelector("[data-automation-publish]")?.addEventListener("click", async () => {
    if (!selectedId) return;
    try {
      const payload = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/automations/${encodeURIComponent(selectedId)}/publish`, {});
      await refresh(`Version ${payload.automation.publishedVersion} publicada y nuevo borrador abierto.`);
    } catch (error) {
      showNotice(error.message || "No se pudo publicar la automatizacion.", "error");
    }
  });

  document.querySelector("[data-automation-status]")?.addEventListener("click", async (event) => {
    if (!selectedId) return;
    const status = clean(event.currentTarget.dataset.automationStatus);
    try {
      await patchJson(`/api/businesses/${encodeURIComponent(businessRef)}/automations/${encodeURIComponent(selectedId)}`, { status });
      await refresh(status === "paused" ? "Automatizacion pausada: no aceptara eventos nuevos." : "Automatizacion reactivada.");
    } catch (error) {
      showNotice(error.message || "No se pudo cambiar el estado.", "error");
    }
  });

  document.querySelector("[data-automation-test]")?.addEventListener("click", () => document.querySelector("[data-automation-test-form]")?.requestSubmit());
  document.querySelector("[data-automation-test-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedId) return;
    const form = new FormData(event.currentTarget);
    const contactId = clean(form.get("contactId"));
    const contact = state.contacts.find((item) => item.id === contactId) || null;
    try {
      const payload = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/automations/${encodeURIComponent(selectedId)}/test`, {
        contactId,
        event: { id: `dashboard_test_${Date.now()}`, type: "manual", entity: contact ? "contact" : "", entityId: contactId, contactId },
        context: { contact: contact || {} }
      });
      state.automationRuns = [payload.run, ...state.automationRuns.filter((run) => run.id !== payload.run.id)];
      await refresh(`Prueba completada: ${payload.run.actionsExecuted || 0} accion(es) simuladas, sin efectos reales.`);
    } catch (error) {
      showNotice(error.message || "La prueba no pudo completarse.", "error");
    }
  });

  document.querySelector("[data-automation-draft-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!selectedId) return;
    const form = new FormData(event.currentTarget);
    let definition;
    try {
      definition = JSON.parse(String(form.get("definition") || "{}"));
    } catch {
      showNotice("La definicion JSON no es valida.", "error");
      return;
    }
    try {
      await patchJson(`/api/businesses/${encodeURIComponent(businessRef)}/automations/${encodeURIComponent(selectedId)}`, { name: form.get("name"), description: form.get("description"), ...definition });
      await refresh("Borrador guardado y validado. La version publicada no se ha modificado.");
    } catch (error) {
      showNotice(error.message || "No se pudo guardar el borrador.", "error");
    }
  });

  document.querySelector("[data-sequence-enroll-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const payload = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/sequences/enrollments`, { automationId: form.get("automationId"), contactIds: form.getAll("contactIds"), source: "dashboard" });
      await refresh(payload.enrollments?.length ? `${payload.enrollments.length} contacto(s) inscritos con trazabilidad y paradas automaticas.` : "No habia contactos elegibles para inscribir.");
    } catch (error) {
      showNotice(error.message || "No se pudo inscribir el contacto.", "error");
    }
  });

  document.querySelector("[data-sequence-preview]")?.addEventListener("click", async () => {
    const formNode = document.querySelector("[data-sequence-enroll-form]");
    if (!formNode) return;
    const form = new FormData(formNode);
    try {
      const payload = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/sequences/preview`, { automationId: form.get("automationId"), contactIds: form.getAll("contactIds") });
      const preview = payload.preview || {};
      state.automationFeedback = `Previsualizacion: ${preview.eligible?.length || 0} elegible(s), ${preview.blocked?.length || 0} bloqueado(s), ${preview.steps?.length || 0} pasos. Paradas: ${(preview.stopConditions || []).join(", ") || "manual"}.`;
      render();
    } catch (error) {
      showNotice(error.message || "No se pudo previsualizar la inscripcion.", "error");
    }
  });

  document.querySelectorAll("[data-sequence-enrollment-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const enrollmentId = clean(button.dataset.enrollmentId);
      const action = clean(button.dataset.sequenceEnrollmentAction);
      try {
        await patchJson(`/api/businesses/${encodeURIComponent(businessRef)}/sequences/enrollments/${encodeURIComponent(enrollmentId)}`, { action, signal: action === "stop" ? "manual" : "" });
        await refresh(action === "stop" ? "Secuencia detenida." : action === "pause" ? "Inscripcion pausada." : "Inscripcion reanudada.");
      } catch (error) {
        showNotice(error.message || "No se pudo actualizar la inscripcion.", "error");
      }
    });
  });
}

function bindCrmControls(model) {
  bindDealControls(model);
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
        await loadDeals(state.business.id || state.business.slug, { pipelineId: state.dealPipelineId });
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

function bindTaskControls() {
  document.querySelector("[data-tasks-retry]")?.addEventListener("click", async () => {
    const businessRef = state.business?.id || state.business?.slug || "";
    if (!businessRef) return;
    await loadTasks(businessRef, { render: true });
  });

  document.querySelector("[data-task-create-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const businessRef = state.business?.id || state.business?.slug || "";
    const data = new FormData(form);
    const dueAt = dateTimeLocalToIso(data.get("dueAt"));
    const reminderAt = dateTimeLocalToIso(data.get("reminderAt"));
    const payload = {
      title: clean(data.get("title")),
      description: clean(data.get("description")),
      type: clean(data.get("type")) || "follow_up",
      priority: clean(data.get("priority")) || "normal",
      ownerId: clean(data.get("ownerId")),
      participantIds: data.getAll("participantIds").map(clean).filter(Boolean),
      dependencyIds: data.getAll("dependencyIds").map(clean).filter(Boolean),
      dueAt,
      reminderAt,
      recurrence: clean(data.get("recurrence")) || "none",
      source: "dashboard"
    };
    const link = clean(data.get("link"));
    if (link) {
      const separator = link.indexOf(":");
      if (separator > 0) payload.links = [{ type: link.slice(0, separator), id: link.slice(separator + 1), kind: "related", isPrimary: true }];
    }
    if (!payload.ownerId) delete payload.ownerId;
    if (!payload.dueAt) delete payload.dueAt;
    if (!payload.reminderAt) delete payload.reminderAt;
    if (!businessRef || !payload.title) return;
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/tasks`, payload);
      await Promise.all([loadTasks(businessRef), loadDeals(businessRef, { pipelineId: state.dealPipelineId })]);
      showNotice("Tarea creada con su contexto, responsable y vencimiento.", "info");
      render();
    } catch (error) {
      showNotice(error.message || "No se pudo crear la tarea.", "error");
      if (button) button.disabled = false;
    }
  });

  document.querySelector("[data-task-owner-filter]")?.addEventListener("change", async (event) => {
    const businessRef = state.business?.id || state.business?.slug || "";
    state.taskOwnerId = event.currentTarget.value || "";
    if (!businessRef) return;
    await loadTasks(businessRef, { render: true });
  });

  document.querySelectorAll("[data-task-owner]").forEach((select) => {
    select.addEventListener("change", async () => {
      const businessRef = state.business?.id || state.business?.slug || "";
      const taskId = select.dataset.taskId || "";
      if (!businessRef || !taskId) return;
      select.disabled = true;
      try {
        await patchJson(`/api/businesses/${encodeURIComponent(businessRef)}/tasks/${encodeURIComponent(taskId)}`, { ownerId: select.value || "" });
        await Promise.all([loadTasks(businessRef), loadDeals(businessRef, { pipelineId: state.dealPipelineId })]);
        showNotice("Responsable de la tarea actualizado.", "info");
        render();
      } catch (error) {
        showNotice(error.message || "No se pudo reasignar la tarea.", "error");
        select.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-task-start], [data-task-complete]").forEach((button) => {
    button.addEventListener("click", async () => {
      const businessRef = state.business?.id || state.business?.slug || "";
      const taskId = button.dataset.taskId || "";
      const status = button.hasAttribute("data-task-complete") ? "completed" : "in_progress";
      if (!businessRef || !taskId) return;
      button.disabled = true;
      try {
        const result = await patchJson(`/api/businesses/${encodeURIComponent(businessRef)}/tasks/${encodeURIComponent(taskId)}`, { status });
        await loadTasks(businessRef);
        showNotice(result.recurringTask ? "Tarea completada y siguiente recurrencia creada." : (status === "completed" ? "Tarea completada." : "Tarea puesta en curso."), "info");
        render();
      } catch (error) {
        showNotice(error.message || "No se pudo actualizar la tarea.", "error");
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-task-archive]").forEach((button) => {
    button.addEventListener("click", async () => {
      const businessRef = state.business?.id || state.business?.slug || "";
      const taskId = button.dataset.taskId || "";
      if (!businessRef || !taskId || !window.confirm("Archivar esta tarea? Se conservara en auditoria.")) return;
      button.disabled = true;
      try {
        await deleteJson(`/api/businesses/${encodeURIComponent(businessRef)}/tasks/${encodeURIComponent(taskId)}`);
        await loadTasks(businessRef);
        showNotice("Tarea archivada sin borrar su historial.", "info");
        render();
      } catch (error) {
        showNotice(error.message || "No se pudo archivar la tarea.", "error");
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-unowned-deal-owner]").forEach((select) => {
    select.addEventListener("change", async () => {
      const businessRef = state.business?.id || state.business?.slug || "";
      const dealId = select.dataset.dealId || "";
      if (!businessRef || !dealId || !select.value) return;
      select.disabled = true;
      try {
        await patchJson(`/api/businesses/${encodeURIComponent(businessRef)}/deals/${encodeURIComponent(dealId)}`, { ownerId: select.value });
        await Promise.all([loadDeals(businessRef, { pipelineId: state.dealPipelineId }), loadTasks(businessRef)]);
        showNotice("Oportunidad asignada a un responsable.", "info");
        render();
      } catch (error) {
        showNotice(error.message || "No se pudo asignar la oportunidad.", "error");
        select.disabled = false;
      }
    });
  });
}

function bindConsentControls() {
  document.querySelector("[data-consent-contact]")?.addEventListener("change", async (event) => {
    const businessRef = state.business?.id || state.business?.slug || "";
    if (!businessRef || !event.currentTarget.value) return;
    await loadConsentCenter(businessRef, event.currentTarget.value, { render: true });
  });
  document.querySelector("[data-consent-retry]")?.addEventListener("click", async () => {
    const businessRef = state.business?.id || state.business?.slug || "";
    if (!businessRef || !state.consentCenter.contactId) return;
    await loadConsentCenter(businessRef, state.consentCenter.contactId, { render: true });
  });
  document.querySelector("[data-consent-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const businessRef = state.business?.id || state.business?.slug || "";
    const contactId = form.dataset.contactId || "";
    const data = new FormData(form);
    if (!businessRef || !contactId) return;
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      await putJson(`/api/businesses/${encodeURIComponent(businessRef)}/contacts/${encodeURIComponent(contactId)}/preferences`, {
        globalSuppressed: data.get("globalSuppressed") === "on",
        source: "dashboard-preference-center",
        textVersion: "crm-preferences-v1",
        textSnapshot: "Preferencias de comunicaciones seleccionadas por el contacto o por un operador autorizado.",
        actorType: state.clientSession ? "contact" : "operator",
        actorId: contactId,
        evidence: { surface: "business-dashboard" },
        preferences: [
          { channel: "email", purpose: "marketing", allowed: data.get("emailMarketing") === "on" },
          { channel: "whatsapp", purpose: "marketing", allowed: data.get("whatsappMarketing") === "on" },
          { channel: "email", purpose: "reviews", allowed: data.get("emailReviews") === "on" }
        ]
      });
      await loadConsentCenter(businessRef, contactId);
      showNotice("Preferencias guardadas con evidencia inmutable.", "info");
      render();
    } catch (error) {
      showNotice(error.message || "No se pudieron guardar las preferencias.", "error");
      if (button) button.disabled = false;
    }
  });
}

function bindCampaignControls() {
  const businessRef = state.business?.id || state.business?.slug || "";
  document.querySelectorAll("[data-campaign-select]").forEach((button) => {
    button.addEventListener("click", () => {
      state.campaignSelectedId = button.dataset.campaignSelect || "";
      state.campaignPreview = null;
      render();
    });
  });

  const createForm = document.querySelector("[data-campaign-create-form]");
  const applyTemplate = (templateKey) => {
    if (!createForm) return;
    const template = state.campaignCenter?.templates?.find((item) => item.key === templateKey);
    if (!template) return;
    createForm.elements.templateKey.value = template.key;
    createForm.elements.name.value = template.name;
    createForm.elements.segmentKey.value = template.segmentKey;
    createForm.elements.purpose.value = template.purpose;
    createForm.elements.subject.value = template.subject || "";
    createForm.elements.body.value = template.body || "";
    createForm.closest("details")?.setAttribute("open", "");
    createForm.elements.name.focus();
  };
  document.querySelectorAll("[data-campaign-template]").forEach((button) => button.addEventListener("click", () => applyTemplate(button.dataset.campaignTemplate || "")));
  createForm?.elements.templateKey?.addEventListener("change", (event) => applyTemplate(event.currentTarget.value));
  createForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!businessRef) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      templateKey: clean(data.get("templateKey")), name: clean(data.get("name")), channel: clean(data.get("channel")) || "email", purpose: clean(data.get("purpose")) || "marketing",
      segmentKey: clean(data.get("segmentKey")) || "marketing_reachable", subject: clean(data.get("subject")), body: clean(data.get("body")),
      frequencyCapDays: Number(data.get("frequencyCapDays") || 7), batchSize: Number(data.get("batchSize") || 50)
    };
    const variantBBody = clean(data.get("variantBBody"));
    if (variantBBody) payload.variants = [
      { key: "A", name: "Control", weight: 50, subject: payload.subject, body: payload.body },
      { key: "B", name: "Variante B", weight: 50, subject: clean(data.get("variantBSubject")) || payload.subject, body: variantBBody }
    ];
    if (!payload.templateKey && !payload.body) { state.campaignFeedback = "Escribe un mensaje o elige una receta."; render(); return; }
    if (payload.templateKey && !payload.body) delete payload.body;
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      const result = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/campaigns`, payload);
      state.campaignSelectedId = result.campaign?.id || "";
      state.campaignPreview = null;
      state.campaignFeedback = "Borrador creado. Revisa audiencia y contenido antes de programar.";
      await loadCampaignCenter(businessRef);
      render();
    } catch (error) {
      state.campaignFeedback = error.message || "No se pudo crear la campana.";
      render();
    }
  });

  document.querySelector("[data-campaign-edit-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const campaignId = form.dataset.campaignId || "";
    const data = new FormData(form);
    if (!businessRef || !campaignId) return;
    try {
      await patchJson(`/api/businesses/${encodeURIComponent(businessRef)}/campaigns/${encodeURIComponent(campaignId)}`, { name: clean(data.get("name")), segmentKey: clean(data.get("segmentKey")), subject: clean(data.get("subject")), body: clean(data.get("body")) });
      state.campaignPreview = null;
      state.campaignFeedback = "Nueva revision guardada; el envio anterior, si existe, no cambia.";
      await loadCampaignCenter(businessRef);
      render();
    } catch (error) { state.campaignFeedback = error.message || "No se pudo guardar la revision."; render(); }
  });

  document.querySelectorAll("[data-campaign-preview]").forEach((button) => button.addEventListener("click", async () => {
    const campaignId = button.dataset.campaignPreview || "";
    if (!businessRef || !campaignId) return;
    button.disabled = true;
    try {
      const result = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/campaigns/${encodeURIComponent(campaignId)}/preview`, {});
      state.campaignPreview = result.preview;
      state.campaignFeedback = `${result.preview.eligible.length} elegibles y ${result.preview.blocked.length} bloqueados antes de enviar.`;
    } catch (error) { state.campaignFeedback = error.message || "No se pudo comprobar la audiencia."; }
    render();
  }));

  document.querySelector("[data-campaign-schedule-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const campaignId = form.dataset.campaignId || "";
    const scheduledAt = dateTimeLocalToIso(new FormData(form).get("scheduledAt"));
    if (!businessRef || !campaignId) return;
    try {
      const result = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/campaigns/${encodeURIComponent(campaignId)}/schedule`, scheduledAt ? { scheduledAt } : {});
      state.campaignPreview = result.preview;
      state.campaignFeedback = `Campana programada con ${result.preview.eligible.length} destinatarios y snapshot inmutable.`;
      await loadCampaignCenter(businessRef);
      render();
    } catch (error) { state.campaignFeedback = error.message || "No se pudo programar la campana."; render(); }
  });

  document.querySelectorAll("[data-campaign-process]").forEach((button) => button.addEventListener("click", async () => {
    const campaignId = button.dataset.campaignProcess || "";
    if (!businessRef || !campaignId) return;
    button.disabled = true;
    try {
      const result = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/campaigns/${encodeURIComponent(campaignId)}/process`, {});
      state.campaignFeedback = result.waitingForQuietHours ? `Envio aplazado por quiet hours hasta ${formatDateTime(result.nextProcessAt)}.` : `Lote procesado: ${result.processed} destinatarios; quedan ${result.remaining || 0}.`;
      await loadCampaignCenter(businessRef);
      render();
    } catch (error) { state.campaignFeedback = error.message || "No se pudo procesar el lote."; render(); }
  }));

  document.querySelectorAll("[data-campaign-status]").forEach((button) => button.addEventListener("click", async () => {
    const campaignId = button.dataset.campaignId || "";
    const status = button.dataset.campaignStatus || "";
    if (!businessRef || !campaignId || !status) return;
    try {
      await patchJson(`/api/businesses/${encodeURIComponent(businessRef)}/campaigns/${encodeURIComponent(campaignId)}/status`, { status });
      state.campaignFeedback = status === "paused" ? "Campana pausada sin perder la cola." : "Campana reanudada.";
      await loadCampaignCenter(businessRef);
      render();
    } catch (error) { state.campaignFeedback = error.message || "No se pudo cambiar el estado."; render(); }
  }));

  document.querySelectorAll("[data-campaign-cancel]").forEach((button) => button.addEventListener("click", async () => {
    const campaignId = button.dataset.campaignCancel || "";
    if (!businessRef || !campaignId || !window.confirm("Cancelar esta campana? El historial y sus resultados se conservaran.")) return;
    try {
      await deleteJson(`/api/businesses/${encodeURIComponent(businessRef)}/campaigns/${encodeURIComponent(campaignId)}`);
      state.campaignFeedback = "Campana cancelada; auditoria y resultados conservados.";
      await loadCampaignCenter(businessRef);
      render();
    } catch (error) { state.campaignFeedback = error.message || "No se pudo cancelar la campana."; render(); }
  }));
}

function bindDealControls(model) {
  bindAccountControls(model);
  document.querySelector("[data-deal-create-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const businessRef = state.business?.id || state.business?.slug || "";
    const expectedCloseAt = clean(data.get("expectedCloseAt"));
    const payload = {
      title: clean(data.get("title")),
      contactId: clean(data.get("contactId")),
      pipelineId: clean(data.get("pipelineId")),
      value: Number(data.get("value") || 0),
      priority: clean(data.get("priority")) || "media"
    };
    const accountId = clean(data.get("accountId"));
    const ownerId = clean(data.get("ownerId"));
    if (accountId) payload.accountId = accountId;
    if (ownerId) payload.ownerId = ownerId;
    if (expectedCloseAt) payload.expectedCloseAt = dateInputToIso(expectedCloseAt);
    if (!businessRef || !payload.title || !payload.contactId || !payload.pipelineId || !Number.isFinite(payload.value)) return;

    const button = form.querySelector("button[type='submit']");
    if (button) button.disabled = true;
    try {
      const result = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/deals`, payload);
      state.dealPipelineId = result.deal?.pipelineId || payload.pipelineId;
      await loadAccounts(businessRef);
      await loadDeals(businessRef, { pipelineId: state.dealPipelineId });
      showNotice("Oportunidad creada sin duplicar el contacto.", "info");
      render();
    } catch (error) {
      showNotice(error.message || "No se pudo crear la oportunidad.", "error");
      if (button) button.disabled = false;
    }
  });

  document.querySelector("[data-deal-pipeline-select]")?.addEventListener("change", async (event) => {
    const businessRef = state.business?.id || state.business?.slug || "";
    if (!businessRef) return;
    state.dealPipelineId = event.currentTarget.value;
    state.dealLoading = true;
    render();
    await loadDeals(businessRef, { pipelineId: state.dealPipelineId });
    render();
  });

  document.querySelector("[data-deals-retry]")?.addEventListener("click", async () => {
    const businessRef = state.business?.id || state.business?.slug || "";
    if (!businessRef) return;
    await loadDeals(businessRef, { pipelineId: state.dealPipelineId });
    render();
  });

  document.querySelectorAll("[data-deal-stage]").forEach((select) => {
    select.addEventListener("change", async () => {
      const dealId = select.dataset.dealId || "";
      const deal = state.deals.find((item) => item.id === dealId);
      if (!deal) return;
      select.disabled = true;
      const moved = await moveDealInPipeline(dealId, select.value, deal.order);
      if (!moved) {
        select.value = deal.stageId;
        select.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-deal-owner]").forEach((select) => {
    select.addEventListener("change", async () => {
      const businessRef = state.business?.id || state.business?.slug || "";
      const dealId = select.dataset.dealId || "";
      if (!businessRef || !dealId) return;
      select.disabled = true;
      try {
        await patchJson(`/api/businesses/${encodeURIComponent(businessRef)}/deals/${encodeURIComponent(dealId)}`, { ownerId: select.value || "" });
        await Promise.all([loadDeals(businessRef, { pipelineId: state.dealPipelineId }), loadTasks(businessRef)]);
        showNotice(select.value ? "Responsable de la oportunidad actualizado." : "Oportunidad marcada sin responsable.", "info");
        render();
      } catch (error) {
        showNotice(error.message || "No se pudo reasignar la oportunidad.", "error");
        select.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-deal-archive]").forEach((button) => {
    button.addEventListener("click", async () => {
      const dealId = button.dataset.dealId || "";
      const deal = state.deals.find((item) => item.id === dealId);
      const businessRef = state.business?.id || state.business?.slug || "";
      if (!deal || !businessRef || !window.confirm(`Archivar la oportunidad "${deal.title}"? Se conserva en el historial.`)) return;
      button.disabled = true;
      try {
        await deleteJson(`/api/businesses/${encodeURIComponent(businessRef)}/deals/${encodeURIComponent(dealId)}`);
        await loadDeals(businessRef, { pipelineId: state.dealPipelineId });
        showNotice("Oportunidad archivada; los datos y la auditoria se conservan.", "info");
        render();
      } catch (error) {
        showNotice("No se pudo archivar la oportunidad.", "error");
        button.disabled = false;
      }
    });
  });

  bindDealPipelineControls(model);
}

function bindAccountControls(model) {
  document.querySelector("[data-accounts-retry]")?.addEventListener("click", async () => {
    const businessRef = state.business?.id || state.business?.slug || "";
    if (!businessRef) return;
    await loadAccounts(businessRef);
    render();
  });

  document.querySelector("[data-account-create-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const businessRef = state.business?.id || state.business?.slug || "";
    const payload = {
      name: clean(data.get("name")),
      type: clean(data.get("type")) || "company",
      domain: clean(data.get("domain")),
      taxId: clean(data.get("taxId")),
      city: clean(data.get("city"))
    };
    if (!businessRef || !payload.name) return;
    const button = form.querySelector("button[type='submit']");
    if (button) button.disabled = true;
    try {
      await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/accounts`, payload);
      await loadAccounts(businessRef);
      showNotice("Cuenta creada y disponible para relacionarla.", "info");
      render();
    } catch (error) {
      showNotice(error.message || "No se pudo crear la cuenta.", "error");
      if (button) button.disabled = false;
    }
  });

  document.querySelectorAll("[data-account-link-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const businessRef = state.business?.id || state.business?.slug || "";
      const accountId = form.dataset.accountId || "";
      const data = new FormData(form);
      const contactId = clean(data.get("contactId"));
      const kind = clean(data.get("kind")) || "member";
      if (!businessRef || !accountId || !contactId) return;
      const button = form.querySelector("button[type='submit']");
      if (button) button.disabled = true;
      try {
        await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/associations`, {
          fromType: "contact",
          fromId: contactId,
          toType: "account",
          toId: accountId,
          kind,
          isPrimary: kind === "decision_maker" || kind === "owner"
        });
        await loadAccounts(businessRef);
        showNotice("Persona vinculada a la cuenta.", "info");
        render();
      } catch (error) {
        showNotice(error.message || "No se pudo crear la relacion.", "error");
        if (button) button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-association-archive]").forEach((button) => {
    button.addEventListener("click", async () => {
      const businessRef = state.business?.id || state.business?.slug || "";
      const associationId = button.dataset.associationId || "";
      if (!businessRef || !associationId) return;
      button.disabled = true;
      try {
        await deleteJson(`/api/businesses/${encodeURIComponent(businessRef)}/associations/${encodeURIComponent(associationId)}`);
        await Promise.all([loadAccounts(businessRef), loadDeals(businessRef, { pipelineId: state.dealPipelineId })]);
        showNotice("Relacion retirada; el registro de auditoria se conserva.", "info");
        render();
      } catch (error) {
        showNotice("No se pudo retirar la relacion.", "error");
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-account-merge]").forEach((button) => {
    button.addEventListener("click", async () => {
      const businessRef = state.business?.id || state.business?.slug || "";
      const group = model.accountDuplicateGroups.find((item) => item.id === button.dataset.groupId);
      const survivorId = button.closest("[data-account-duplicate-group]")?.querySelector("[data-account-merge-survivor]")?.value || "";
      const duplicateIds = (group?.accounts || []).map((account) => account.id).filter((id) => id && id !== survivorId);
      if (!businessRef || !survivorId || !duplicateIds.length) return;
      button.disabled = true;
      try {
        await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/accounts/merge`, { survivorId, duplicateIds });
        await Promise.all([loadAccounts(businessRef), loadDeals(businessRef, { pipelineId: state.dealPipelineId })]);
        showNotice("Cuentas fusionadas sin perder relaciones.", "info");
        render();
      } catch (error) {
        showNotice(error.message || "No se pudieron fusionar las cuentas.", "error");
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-account-archive]").forEach((button) => {
    button.addEventListener("click", async () => {
      const businessRef = state.business?.id || state.business?.slug || "";
      const accountId = button.dataset.accountId || "";
      const account = model.accounts.find((item) => item.id === accountId);
      if (!businessRef || !account || !window.confirm(`Archivar la cuenta "${account.name}"?`)) return;
      button.disabled = true;
      try {
        await deleteJson(`/api/businesses/${encodeURIComponent(businessRef)}/accounts/${encodeURIComponent(accountId)}`);
        await loadAccounts(businessRef);
        showNotice("Cuenta archivada; sus datos siguen disponibles en auditoria.", "info");
        render();
      } catch (error) {
        showNotice(error.message || "No se pudo archivar la cuenta.", "error");
        button.disabled = false;
      }
    });
  });
}

function bindDealPipelineControls(model) {
  const board = model?.dealPipeline || state.dealPipeline;
  if (!board?.pipeline) return;

  document.querySelectorAll("[data-deal-card]").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      const dealId = card.dataset.dealId || "";
      if (!dealId || event.target.closest("button, input, select, textarea, label, form")) {
        event.preventDefault();
        return;
      }
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", `deal:${dealId}`);
    });
    card.addEventListener("dragend", () => {
      document.querySelectorAll(".is-dragging, .is-drag-over").forEach((node) => node.classList.remove("is-dragging", "is-drag-over"));
    });
  });

  document.querySelectorAll("[data-deal-dropzone]").forEach((zone) => {
    zone.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      zone.classList.add("is-drag-over");
    });
    zone.addEventListener("dragleave", (event) => {
      if (!zone.contains(event.relatedTarget)) zone.classList.remove("is-drag-over");
    });
    zone.addEventListener("drop", async (event) => {
      event.preventDefault();
      zone.classList.remove("is-drag-over");
      const transfer = event.dataTransfer.getData("text/plain");
      const dealId = transfer.startsWith("deal:") ? transfer.slice(5) : "";
      const stageId = zone.dataset.stageId || "";
      if (!dealId || !stageId) return;
      const order = calculateDealOrder(board, dealId, stageId, zone, event.clientY);
      await moveDealInPipeline(dealId, stageId, order);
    });
  });
}

function calculateDealOrder(board, dealId, stageId, zone, clientY) {
  const column = (board.columns.find((item) => item.stageId === stageId)?.deals || [])
    .filter((deal) => deal.id !== dealId)
    .sort(compareDealCards);
  const afterCard = Array.from(zone.querySelectorAll("[data-deal-card]:not(.is-dragging)"))
    .find((card) => {
      const box = card.getBoundingClientRect();
      return clientY < box.top + (box.height / 2);
    }) || null;
  if (afterCard) {
    const index = column.findIndex((deal) => deal.id === afterCard.dataset.dealId);
    return midpointOrder(index > 0 ? column[index - 1]?.order : undefined, column[index]?.order);
  }
  return midpointOrder(column.at(-1)?.order, null);
}

async function moveDealInPipeline(dealId, stageId, order) {
  const businessRef = state.business?.id || state.business?.slug || "";
  const deal = state.deals.find((item) => item.id === dealId);
  const pipeline = state.dealPipeline?.pipeline;
  const stage = pipeline?.stages?.find((item) => item.id === stageId);
  if (!businessRef || !deal || !pipeline || !stage) return false;

  let lostReason = "";
  if (stage.type === "lost") {
    lostReason = deal.status === "lost" && deal.lostReason
      ? deal.lostReason
      : await showLostReasonDialog({ name: deal.title });
    if (!lostReason) return false;
  }

  try {
    await patchJson(`/api/businesses/${encodeURIComponent(businessRef)}/deals/${encodeURIComponent(dealId)}/pipeline`, {
      pipelineId: pipeline.id,
      stageId,
      order,
      ...(lostReason ? { lostReason } : {})
    });
    await loadDeals(businessRef, { pipelineId: pipeline.id });
    showNotice(deal.stageId === stageId ? "Orden de oportunidades actualizado." : `Oportunidad movida a ${stage.name}.`, "info");
    render();
    return true;
  } catch (error) {
    showNotice(error.message || "No se pudo mover la oportunidad.", "error");
    return false;
  }
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

  document.querySelectorAll("[data-proposal-share]").forEach((button) => {
    button.addEventListener("click", async () => {
      const proposalId = button.dataset.proposalId || "";
      const businessRef = state.business?.id || state.business?.slug || "";
      if (!businessRef || !proposalId) return;
      button.disabled = true;
      button.textContent = "Creando enlace...";
      try {
        const result = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/proposals/${encodeURIComponent(proposalId)}/share`, {});
        state.proposalShareLinks[proposalId] = result.url;
        mergeProposal(result.proposal);
        const copied = await copyTextToClipboard(result.url);
        state.proposalFeedback = { type: "success", message: copied ? "Enlace seguro creado y copiado." : "Enlace seguro creado; puedes abrirlo desde la tarjeta." };
        showNotice(state.proposalFeedback.message, "info");
        render();
        focusProposalCard(proposalId);
      } catch (error) {
        state.proposalFeedback = { type: "error", message: error.message || "No se pudo crear el enlace seguro." };
        showNotice(state.proposalFeedback.message, "error");
        render();
      }
    });
  });

  document.querySelectorAll("[data-proposal-approve]").forEach((button) => {
    button.addEventListener("click", async () => {
      const proposalId = button.dataset.proposalId || "";
      const businessRef = state.business?.id || state.business?.slug || "";
      if (!businessRef || !proposalId || !window.confirm("Aprobar el descuento de esta version para permitir su envio?")) return;
      button.disabled = true;
      try {
        const result = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/proposals/${encodeURIComponent(proposalId)}/approval`, { approved: true, actorId: "dashboard-admin", note: "Aprobado desde dashboard" });
        mergeProposal(result.proposal);
        state.proposalFeedback = { type: "success", message: "Descuento aprobado; ya puedes compartir la propuesta." };
        render();
        focusProposalCard(proposalId);
      } catch (error) { showNotice(error.message || "No se pudo aprobar el descuento.", "error"); render(); }
    });
  });

  document.querySelectorAll("[data-proposal-outputs]").forEach((button) => {
    button.addEventListener("click", async () => {
      const proposalId = button.dataset.proposalId || "";
      const businessRef = state.business?.id || state.business?.slug || "";
      if (!businessRef || !proposalId) return;
      button.disabled = true;
      try {
        const result = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/proposals/${encodeURIComponent(proposalId)}/outputs`, {});
        mergeProposal(result.proposal);
        state.proposalFeedback = { type: "success", message: "Proyecto, factura, suscripcion y calendario reconciliados sin duplicados." };
        render();
        focusProposalCard(proposalId);
      } catch (error) { showNotice(error.message || "No se pudo reconciliar quote-to-cash.", "error"); render(); }
    });
  });

  document.querySelectorAll("[data-copy-text]").forEach((button) => button.addEventListener("click", async () => {
    const copied = await copyTextToClipboard(button.dataset.copyText || "");
    showNotice(copied ? "Enlace copiado al portapapeles." : "No se pudo copiar automaticamente.", copied ? "info" : "warn");
  }));
}

async function createProposalFromForm(form) {
  const businessRef = state.business?.id || state.business?.slug || "";
  const data = new FormData(form);
  const setupPrice = Number(data.get("setupPrice"));
  const monthlyPrice = Number(data.get("monthlyPrice"));
  const setupDiscount = Number(data.get("setupDiscount") || 0);
  const monthlyDiscount = Number(data.get("monthlyDiscount") || 0);
  const taxRate = Number(data.get("taxRate") || 0);
  const depositMode = clean(data.get("depositMode")) || "none";
  const depositValue = Number(data.get("depositValue") || 0);
  const payload = {
    contactId: clean(data.get("contactId")),
    package: clean(data.get("package")),
    title: clean(data.get("title")),
    setupPrice,
    monthlyPrice,
    currency: state.business?.content?.currency || state.business?.commerce?.currency || "EUR",
    conditions: String(data.get("conditions") || "").trim(),
    expiresAt: dateInputToEndOfDayIso(data.get("expiresAt")),
    status: normalizeProposalStatus(data.get("status")),
    signatureRequired: data.get("signatureRequired") === "on",
    deposit: { mode: depositMode, value: depositValue },
    lineItems: [
      { description: `Puesta en marcha · ${proposalPackageLabel(data.get("package"))}`, quantity: 1, unitPrice: setupPrice, discountPercent: setupDiscount, taxRate, billing: "one_time" },
      ...(monthlyPrice > 0 ? [{ description: `Cuota mensual · ${proposalPackageLabel(data.get("package"))}`, quantity: 1, unitPrice: monthlyPrice, discountPercent: monthlyDiscount, taxRate, billing: "recurring" }] : [])
    ]
  };

  if (!businessRef || !payload.contactId || !PROPOSAL_PACKAGES.includes(payload.package)
    || !Number.isFinite(setupPrice) || setupPrice < 0
    || !Number.isFinite(monthlyPrice) || monthlyPrice < 0 || !payload.title
    || ![setupDiscount, monthlyDiscount, taxRate, depositValue].every(Number.isFinite)
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
      resourceIds: clean(data.get("resourceId")) ? [clean(data.get("resourceId"))] : [],
      partySize: Number(data.get("partySize") || 1),
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

  document.querySelector("[data-booking-resource-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.business) return;
    const form = event.currentTarget; const data = new FormData(form); const button = form.querySelector("button"); if (button) button.disabled = true;
    try {
      const payload = { name: clean(data.get("name")), type: clean(data.get("type")), capacity: Number(data.get("capacity") || 1), simultaneousCapacity: Number(data.get("simultaneousCapacity") || 1), bufferBeforeMinutes: Number(data.get("bufferBeforeMinutes") || 0), bufferAfterMinutes: Number(data.get("bufferAfterMinutes") || 0), location: clean(data.get("location")), color: clean(data.get("color")), serviceIds: data.getAll("serviceIds").map(clean).filter(Boolean), active: true };
      const result = await postJson(`/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/resources`, payload);
      const schedule = WEEKDAYS.map((day) => ({ weekday: day.value, startTime: clean(data.get("startTime") || "09:00"), endTime: clean(data.get("endTime") || "18:00"), active: day.value >= 1 && day.value <= 5 }));
      const scheduled = await putJson(`/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/resources/${encodeURIComponent(result.resource.id)}/schedule`, { schedule });
      state.bookingResources = [...state.bookingResources, { ...result.resource, schedule: scheduled.schedule }]; state.bookingResourceSummary = result.summary || state.bookingResourceSummary;
      form.reset(); showNotice("Recurso creado con horario laboral inicial.", "info"); render();
    } catch (error) { showNotice(error.message || "No se pudo crear el recurso.", "error"); if (button) button.disabled = false; }
  });

  document.querySelectorAll("[data-resource-schedule-form]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault(); if (!state.business) return; const resourceId = form.dataset.resourceId || ""; const button = form.querySelector("button"); if (button) button.disabled = true;
    const schedule = WEEKDAYS.map((day) => ({ id: clean(form.elements[`id-${day.value}`]?.value), weekday: day.value, active: Boolean(form.elements[`active-${day.value}`]?.checked), startTime: clean(form.elements[`startTime-${day.value}`]?.value || "09:00"), endTime: clean(form.elements[`endTime-${day.value}`]?.value || "18:00") }));
    try { const result = await putJson(`/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/resources/${encodeURIComponent(resourceId)}/schedule`, { schedule }); state.bookingResources = state.bookingResources.map((item) => item.id === resourceId ? { ...item, schedule: result.schedule } : item); showNotice("Horario del recurso actualizado.", "info"); render(); } catch (error) { showNotice(error.message || "No se pudo guardar el horario.", "error"); if (button) button.disabled = false; }
  }));

  document.querySelectorAll("[data-resource-exception-form]").forEach((form) => form.addEventListener("submit", async (event) => {
    event.preventDefault(); if (!state.business) return; const resourceId = form.dataset.resourceId || ""; const data = new FormData(form); const button = form.querySelector("button"); if (button) button.disabled = true;
    try { const result = await postJson(`/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/resources/${encodeURIComponent(resourceId)}/exceptions`, { startsAt: new Date(String(data.get("startsAt"))).toISOString(), endsAt: new Date(String(data.get("endsAt"))).toISOString(), mode: clean(data.get("mode")), reason: clean(data.get("reason")), active: true }); state.bookingResources = state.bookingResources.map((item) => item.id === resourceId ? { ...item, exceptions: [...(item.exceptions || []), result.exception] } : item); showNotice("Excepcion añadida al recurso.", "info"); render(); } catch (error) { showNotice(error.message || "No se pudo añadir la excepcion.", "error"); if (button) button.disabled = false; }
  }));

  document.querySelectorAll("[data-resource-toggle]").forEach((button) => button.addEventListener("click", async () => {
    if (!state.business) return; const resourceId = button.dataset.resourceId || ""; button.disabled = true;
    try { const result = await patchJson(`/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/resources/${encodeURIComponent(resourceId)}`, { active: button.dataset.active === "false" }); state.bookingResources = state.bookingResources.map((item) => item.id === resourceId ? result.resource : item); showNotice("Estado del recurso actualizado.", "info"); render(); } catch (error) { showNotice(error.message || "No se pudo actualizar el recurso.", "error"); button.disabled = false; }
  }));

  document.querySelector("[data-booking-waitlist-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault(); if (!state.business) return; const form = event.currentTarget; const data = new FormData(form); const contact = clean(data.get("contact")); const button = form.querySelector("button"); if (button) button.disabled = true;
    try { const result = await postJson(`/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/waitlist`, { serviceId: clean(data.get("serviceId")), customerName: clean(data.get("customerName")), phone: contact.includes("@") ? "" : contact, email: contact.includes("@") ? contact : "", desiredStartsAt: new Date(String(data.get("desiredStartsAt"))).toISOString(), partySize: Number(data.get("partySize") || 1), flexibleMinutes: Number(data.get("flexibleMinutes") || 0), source: "dashboard" }); state.bookingWaitlist = [...state.bookingWaitlist, result.entry]; form.reset(); showNotice("Cliente añadido a la lista de espera.", "info"); render(); } catch (error) { showNotice(error.message || "No se pudo añadir a la lista de espera.", "error"); if (button) button.disabled = false; }
  });

  document.querySelectorAll("[data-waitlist-offer]").forEach((button) => button.addEventListener("click", async () => {
    if (!state.business) return; const entry = state.bookingWaitlist.find((item) => item.id === button.dataset.waitlistId); if (!entry) return; button.disabled = true;
    try { const result = await postJson(`/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/waitlist/offer`, { entryId: entry.id, serviceId: entry.serviceId, startsAt: entry.desiredStartsAt, endsAt: entry.desiredEndsAt, expiresInMinutes: 30 }); state.bookingWaitlist = state.bookingWaitlist.map((item) => item.id === entry.id ? result.entry : item); await copyTextToClipboard(result.publicUrl); showNotice("Oferta de 30 minutos creada y enlace copiado.", "info"); render(); } catch (error) { showNotice(error.message || "No se pudo ofertar el hueco.", "error"); button.disabled = false; }
  }));

  document.querySelectorAll("[data-waitlist-convert]").forEach((button) => button.addEventListener("click", async () => {
    if (!state.business) return; const entry = state.bookingWaitlist.find((item) => item.id === button.dataset.waitlistId); if (!entry) return; button.disabled = true;
    try { const result = await postJson(`/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/bookings`, { serviceId: entry.serviceId, customerName: entry.customerName, phone: entry.phone, email: entry.email, startsAt: entry.desiredStartsAt, endsAt: entry.desiredEndsAt, partySize: entry.partySize, notes: entry.notes, waitlistEntryId: entry.id, status: "confirmed", source: "waitlist" }); state.bookings = [...state.bookings, result.booking].sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt))); state.bookingWaitlist = state.bookingWaitlist.map((item) => item.id === entry.id ? { ...item, status: "booked", bookingId: result.booking.id, bookedAt: new Date().toISOString() } : item); showNotice("Lista de espera convertida en reserva.", "info"); render(); } catch (error) { showNotice(error.status === 409 ? "El hueco ya no esta disponible." : error.message || "No se pudo crear la reserva.", "error"); button.disabled = false; }
  }));

  document.querySelectorAll("[data-booking-deposit]").forEach((button) => button.addEventListener("click", async () => {
    if (!state.business) return; const bookingId = button.dataset.bookingId || ""; button.disabled = true;
    try { const result = await postJson(`/api/businesses/${encodeURIComponent(state.business.id || state.business.slug)}/bookings/${encodeURIComponent(bookingId)}/deposit-checkout`, { returnUrl: window.location.href.split("#")[0], idempotencyKey: `dashboard:${bookingId}:deposit` }); state.bookings = state.bookings.map((item) => item.id === bookingId ? { ...item, ...result.booking } : item); await copyTextToClipboard(result.checkout.checkoutUrl); showNotice("Enlace de señal copiado para enviarlo al cliente.", "info"); render(); } catch (error) { showNotice(error.message || "No se pudo crear el enlace de señal.", "error"); button.disabled = false; }
  }));
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

function bindReputationControls() {
  const businessRef = state.business?.id || state.business?.slug || "";
  if (!businessRef) return;

  document.querySelector("[data-reputation-retry]")?.addEventListener("click", async () => {
    await loadReputationCenter(businessRef, { render: true, keepFeedback: true });
  });

  document.querySelector("[data-reputation-sync]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const result = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/reputation/sync`, {});
      state.reputationCenter = result.center || state.reputationCenter;
      state.reputationFeedback = `Sincronizacion completada: ${result.run?.created || 0} nuevas y ${result.run?.updated || 0} actualizadas.`;
      render();
    } catch (error) {
      showNotice(error.message || "No se pudieron sincronizar las resenas.", "error");
      button.disabled = false;
    }
  });

  document.querySelectorAll("[data-reputation-reply-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button");
      if (button) button.disabled = true;
      const data = new FormData(form);
      try {
        const result = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/reputation/reviews/${encodeURIComponent(form.dataset.reviewId || "")}/replies`, { comment: clean(data.get("comment")) || "Gracias por compartir tu experiencia. Hemos revisado tu comentario y lo tendremos en cuenta para mejorar." });
        state.reputationCenter = result.center || state.reputationCenter;
        state.reputationFeedback = "Borrador creado. Revisalo antes de aprobar.";
        render();
      } catch (error) {
        showNotice(error.message || "No se pudo crear el borrador.", "error");
        if (button) button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-reputation-approve]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const result = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/reputation/reviews/${encodeURIComponent(button.dataset.reviewId || "")}/replies/${encodeURIComponent(button.dataset.replyId || "")}/approve`, { actorId: "dashboard-admin" });
        state.reputationCenter = result.center || state.reputationCenter;
        state.reputationFeedback = "Respuesta aprobada. La publicacion sigue requiriendo confirmacion.";
        render();
      } catch (error) {
        showNotice(error.message || "No se pudo aprobar la respuesta.", "error");
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-reputation-publish]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.confirm("Publicar esta respuesta en Google Business Profile? Esta accion queda auditada.")) return;
      button.disabled = true;
      try {
        const result = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/reputation/reviews/${encodeURIComponent(button.dataset.reviewId || "")}/replies/${encodeURIComponent(button.dataset.replyId || "")}/publish`, { confirm: true });
        state.reputationCenter = result.center || state.reputationCenter;
        state.reputationFeedback = "Respuesta publicada y registrada.";
        render();
      } catch (error) {
        showNotice(error.message || "No se pudo publicar la respuesta.", "error");
        button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-review-request-form]").forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button");
      if (button) button.disabled = true;
      const data = new FormData(form);
      try {
        const result = await postJson(`/api/businesses/${encodeURIComponent(businessRef)}/reputation/review-requests`, {
          bookingId: form.dataset.bookingId,
          contactId: form.dataset.contactId,
          channel: clean(data.get("channel")),
          send: true
        });
        state.reputationCenter = result.center || state.reputationCenter;
        state.reputationFeedback = "Solicitud enviada con consentimiento y tracking.";
        render();
      } catch (error) {
        showNotice(error.message || "No se pudo enviar la solicitud.", "error");
        if (button) button.disabled = false;
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
      <label>
        Recurso
        <select name="resourceId">
          <option value="">Asignacion automatica</option>
          ${model.bookingResources.filter((resource) => resource.active !== false).map((resource) => `<option value="${escapeAttr(resource.id)}">${escapeHtml(resource.name)} · ${escapeHtml(bookingResourceTypeLabel(resource.type))}</option>`).join("")}
        </select>
      </label>
      <label>
        Personas / aforo
        <input name="partySize" type="number" min="1" max="10000" value="1" required>
      </label>
      <label class="wide-field">
        Nota
        <input name="notes" type="text" placeholder="Preferencias, personas, contexto...">
      </label>
      <button type="submit">Crear reserva</button>
    </form>
  `;
}

function renderBookingResourceCenter(model) {
  const summary = model.bookingResourceSummary || {};
  return `
    <section class="booking-resource-center">
      <header class="booking-resource-header">
        <div>
          <span class="eyebrow">Reservas inteligentes</span>
          <h3>Recursos, aforo y lista de espera</h3>
          <p>Asigna profesionales, mesas, salas o equipos sin bloquear toda la agenda.</p>
        </div>
        <div class="booking-resource-kpis">
          ${renderBookingResourceKpi(summary.activeResources ?? model.bookingResources.filter((item) => item.active !== false).length, "recursos activos")}
          ${renderBookingResourceKpi(summary.waiting ?? model.bookingWaitlist.filter((item) => item.status === "waiting").length, "en espera")}
          ${renderBookingResourceKpi(summary.depositsPending ?? model.bookings.filter((item) => item.depositStatus === "pending").length, "señales pendientes")}
          ${renderBookingResourceKpi(summary.noShows ?? model.bookings.filter((item) => item.status === "no-show").length, "no-shows")}
        </div>
      </header>
      <div class="booking-resource-layout">
        <section class="agenda-panel booking-resource-builder">
          <header><div><h3>Nuevo recurso</h3><span>Capacidad y buffers incluidos</span></div></header>
          <form data-booking-resource-form class="resource-form">
            <label>Nombre<input name="name" required placeholder="Laura, Mesa 4, Cabina A..."></label>
            <label>Tipo<select name="type"><option value="professional">Profesional</option><option value="table">Mesa</option><option value="room">Sala</option><option value="cabin">Cabina</option><option value="equipment">Equipo</option><option value="capacity">Aforo compartido</option><option value="other">Otro</option></select></label>
            <label>Capacidad<input name="capacity" type="number" min="1" value="1" required></label>
            <label>Simultaneidad<input name="simultaneousCapacity" type="number" min="1" value="1" required></label>
            <label>Buffer antes (min)<input name="bufferBeforeMinutes" type="number" min="0" value="0"></label>
            <label>Buffer despues (min)<input name="bufferAfterMinutes" type="number" min="0" value="0"></label>
            <label>Ubicacion<input name="location" placeholder="Planta, zona o direccion"></label>
            <label>Color<input name="color" type="color" value="#2563eb"></label>
            <label class="wide-field">Servicios<select name="serviceIds" multiple>${model.services.map((service) => `<option value="${escapeAttr(service.id)}">${escapeHtml(service.name)}</option>`).join("")}</select><small>Sin seleccionar = sirve para todos.</small></label>
            <label>Horario inicial<input name="startTime" type="time" value="09:00"></label>
            <label>Fin inicial<input name="endTime" type="time" value="18:00"></label>
            <button type="submit">Crear recurso</button>
          </form>
        </section>
        <section class="agenda-panel booking-waitlist-panel">
          <header><div><h3>Lista de espera</h3><span>${escapeHtml(String(model.bookingWaitlist.length))} solicitud(es)</span></div></header>
          <form data-booking-waitlist-form class="waitlist-form">
            <label>Servicio<select name="serviceId" required>${model.services.map((service) => `<option value="${escapeAttr(service.id)}">${escapeHtml(service.name)}</option>`).join("")}</select></label>
            <label>Cliente<input name="customerName" required></label>
            <label>Telefono o email<input name="contact" required></label>
            <label>Hueco deseado<input name="desiredStartsAt" type="datetime-local" required></label>
            <label>Personas<input name="partySize" type="number" min="1" value="1"></label>
            <label>Flexibilidad (min)<input name="flexibleMinutes" type="number" min="0" value="0"></label>
            <button type="submit">Añadir a espera</button>
          </form>
          <div class="waitlist-list">${model.bookingWaitlist.length ? model.bookingWaitlist.map(renderBookingWaitlistCard).join("") : '<p class="pipeline-empty">No hay clientes esperando hueco.</p>'}</div>
        </section>
      </div>
      <div class="resource-card-grid">${model.bookingResources.length ? model.bookingResources.map((resource) => renderBookingResourceCard(resource, model)).join("") : '<p class="pipeline-empty booking-resource-empty">Crea el primer profesional, mesa, sala o recurso para activar la asignacion inteligente.</p>'}</div>
    </section>
  `;
}

function renderVerticalOperationsCenter(model) {
  if (state.clientSession) return "";
  if (state.verticalOperationsLoading) return '<section class="vertical-operations-center vertical-state" data-vertical-operations-center><strong>Cargando planificación vertical...</strong><p>Calculando zonas, experiencias, demanda, personal y stock.</p></section>';
  const center = state.verticalOperationsCenter;
  if (!center) return `<section class="vertical-operations-center vertical-state" data-vertical-operations-center><strong>Operación vertical no disponible</strong><p>${escapeHtml(state.verticalOperationsError || "Configura zonas y turnos para comenzar.")}</p></section>`;
  const zones = Array.isArray(center.zones) ? center.zones : [];
  const combinations = Array.isArray(center.tableCombinations) ? center.tableCombinations : [];
  const shifts = Array.isArray(center.serviceShifts) ? center.serviceShifts : [];
  const experiences = Array.isArray(center.experiences) ? center.experiences : [];
  const policies = Array.isArray(center.policies) ? center.policies : [];
  const planning = center.planning || { summary: {}, daily: [], stock: [], alerts: [] };
  const tables = model.bookingResources.filter((item) => item.type === "table" && item.active !== false);
  return `
    <section class="vertical-operations-center" data-vertical-operations-center aria-labelledby="verticalOperationsTitle">
      <header class="vertical-operations-header">
        <div><p class="eyebrow">Restauración y experiencias</p><h3 id="verticalOperationsTitle">Capacidad y servicio explicados</h3><p>Zonas, mesas combinables, turnos, menús/eventos, políticas y una previsión enlazada a reservas, equipo y stock.</p></div>
        <button type="button" data-vertical-refresh>Recalcular planificación</button>
      </header>
      ${state.verticalOperationsFeedback ? `<p class="vertical-feedback">${escapeHtml(state.verticalOperationsFeedback)}</p>` : ""}
      <div class="vertical-planning-kpis">
        ${renderVerticalKpi(`${planning.summary?.averageOccupancyPercent || 0}%`, "ocupación media")}
        ${renderVerticalKpi(planning.summary?.forecastCovers || 0, "cubiertos previstos")}
        ${renderVerticalKpi(`${planning.summary?.staffGapHours || 0} h`, "déficit de personal")}
        ${renderVerticalKpi(planning.summary?.criticalStockItems || 0, "stocks críticos")}
        ${renderVerticalKpi(planning.summary?.alerts || 0, "alertas accionables")}
      </div>
      <div class="vertical-alert-list">
        ${(planning.alerts || []).length ? planning.alerts.map((alert) => `<a class="vertical-alert severity-${escapeAttr(alert.severity)}" href="${escapeAttr(alert.sourceUrl || "#")}"><span><strong>${escapeHtml(alert.title)}</strong><small>${escapeHtml(alert.reason)}</small></span><b>Ver origen →</b></a>`).join("") : '<p class="vertical-empty">Sin alertas para el periodo calculado.</p>'}
      </div>
      <div class="vertical-daily-grid">
        ${(planning.daily || []).map((day) => `<article><span>${escapeHtml(formatDate(day.date))}</span><strong>${escapeHtml(String(day.occupancyPercent))}%</strong><small>${escapeHtml(String(day.covers))}/${escapeHtml(String(day.capacity))} cubiertos · rotación ${escapeHtml(String(day.expectedRotationMinutes))} min</small><small>${escapeHtml(String(day.scheduledStaffHours))}/${escapeHtml(String(day.requiredStaffHours))} h personal</small></article>`).join("")}
      </div>
      <div class="vertical-layout">
        <div class="vertical-setup">
          <details>
            <summary>Nueva zona</summary>
            <form data-vertical-zone-form class="vertical-form">
              <label>Nombre<input name="name" required></label>
              <label>Aforo<input name="capacity" type="number" min="1" value="20"></label>
              <label class="vertical-wide">Mesas/recursos<select name="resourceIds" multiple required>${model.bookingResources.filter((item) => ["table", "room", "capacity"].includes(item.type) && item.active !== false).map((item) => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(String(item.capacity || 1))}</option>`).join("")}</select></label>
              <button type="submit">Crear zona</button>
            </form>
          </details>
          <details>
            <summary>Combinar mesas explícitamente</summary>
            <form data-vertical-combination-form class="vertical-form">
              <label>Nombre<input name="name" required></label>
              <label>Zona<select name="zoneId" required>${zones.map((item) => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.name)}</option>`).join("")}</select></label>
              <label>Desde personas<input name="minGuests" type="number" min="1" value="4"></label>
              <label>Hasta personas<input name="maxGuests" type="number" min="1" value="8"></label>
              <label class="vertical-wide">Mesas<select name="tableResourceIds" multiple required>${tables.map((item) => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(String(item.capacity || 1))}</option>`).join("")}</select></label>
              <button type="submit"${zones.length && tables.length >= 2 ? "" : " disabled"}>Guardar combinación</button>
            </form>
          </details>
          <details>
            <summary>Turno y duración prevista</summary>
            <form data-vertical-shift-form class="vertical-form">
              <label>Nombre<input name="name" required placeholder="Comida"></label>
              <label>Inicio<input name="startTime" type="time" value="13:00" required></label>
              <label>Fin<input name="endTime" type="time" value="16:30" required></label>
              <label>Duración (min)<input name="expectedDurationMinutes" type="number" min="15" value="90"></label>
              <label>Buffer rotación<input name="turnoverBufferMinutes" type="number" min="0" value="15"></label>
              <label>Aforo turno<input name="maxCovers" type="number" min="1" value="60"></label>
              <button type="submit">Crear turno</button>
            </form>
          </details>
          <details>
            <summary>Política visible y reembolsos</summary>
            <form data-vertical-policy-form class="vertical-form">
              <label>Nombre<input name="name" required></label>
              <label>Versión<input name="version" value="${new Date().toISOString().slice(0, 7)}" required></label>
              <label>Cancelación previa (h)<input name="cancellationHours" type="number" min="0" value="24"></label>
              <label>% devolución previa<input name="refundPercentBeforeDeadline" type="number" min="0" max="100" value="100"></label>
              <label>% devolución tardía<input name="refundPercentAfterDeadline" type="number" min="0" max="100" value="0"></label>
              <label class="vertical-wide">Texto visible<textarea name="visibleText" rows="4" required></textarea></label>
              <label class="vertical-wide">Instrucciones de disputa<textarea name="disputeInstructions" rows="2"></textarea></label>
              <button type="submit">Publicar política</button>
            </form>
          </details>
          <details>
            <summary>Experiencia, menú o evento</summary>
            <form data-vertical-experience-form class="vertical-form">
              <label>Nombre<input name="name" required></label>
              <label>Tipo<select name="type"><option value="experience">Experiencia</option><option value="menu">Menú</option><option value="event">Evento</option></select></label>
              <label>Servicio<select name="serviceId">${model.services.map((item) => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.name)}</option>`).join("")}</select></label>
              <label>Política<select name="policyId"><option value="">Sin política</option>${policies.map((item) => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.name)} · ${escapeHtml(item.version)}</option>`).join("")}</select></label>
              <label>Zona<select name="zoneId"><option value="">Sin zona</option>${zones.map((item) => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.name)}</option>`).join("")}</select></label>
              <label>Turno<select name="serviceShiftId"><option value="">Sin turno</option>${shifts.map((item) => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.name)}</option>`).join("")}</select></label>
              <label>Capacidad<input name="capacity" type="number" min="1" value="20"></label>
              <label>Duración<input name="durationMinutes" type="number" min="15" value="90"></label>
              <label>Stock vinculado<select name="inventoryItemId"><option value="">Sin consumo</option>${(planning.stock || []).map((item) => `<option value="${escapeAttr(item.inventoryItemId)}">${escapeHtml(item.name)}</option>`).join("")}</select></label>
              <label>Consumo/persona<input name="quantityPerGuest" type="number" min="0.001" step="0.001" value="1"></label>
              <label>Señal<select name="depositMode"><option value="none">Sin señal</option><option value="fixed">Fija</option><option value="percent">Porcentaje</option><option value="full">Completa</option></select></label>
              <label>Importe/%<input name="depositValue" type="number" min="0" step="0.01" value="0"></label>
              <label>Válida desde<input name="validFrom" type="date"></label>
              <label>Válida hasta<input name="validTo" type="date"></label>
              <label>Segmentos<input name="segments" placeholder="vip, recurring"></label>
              <button type="submit">Crear experiencia</button>
            </form>
          </details>
        </div>
        <div class="vertical-records">
          <section><header><strong>Zonas y combinaciones</strong><span>${zones.length}/${combinations.length}</span></header>${zones.map((zone) => `<article><div><strong>${escapeHtml(zone.name)}</strong><small>${escapeHtml(String(zone.capacity))} plazas · ${escapeHtml(String(zone.resourceIds?.length || 0))} recursos</small></div></article>`).join("")}${combinations.map((item) => `<article><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(String(item.minGuests))}–${escapeHtml(String(item.maxGuests))} personas · ${escapeHtml(String(item.tableResourceIds?.length || 0))} mesas</small></div></article>`).join("")}</section>
          <section><header><strong>Experiencias y reglas</strong><span>${experiences.length}</span></header>${experiences.length ? experiences.map((item) => `<article><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(statusLabel(item.type))} · ${escapeHtml(String(item.capacity))} plazas · ${escapeHtml(String(item.durationMinutes))} min</small><small>${escapeHtml(String(item.inventoryRules?.length || 0))} consumos · ${escapeHtml(String(item.depositRules?.length || 0))} reglas de señal</small></div></article>`).join("") : '<p class="vertical-empty">Aún no hay experiencias configuradas.</p>'}</section>
          <section><header><strong>Confirmación y política por reserva</strong><span>${model.bookings.length}</span></header>${model.bookings.slice(0, 12).map((booking) => `
            <article class="vertical-booking-policy">
              <div><strong>${escapeHtml(booking.customerName || "Cliente")}</strong><small>${escapeHtml(formatDateTime(booking.startsAt))} · ${escapeHtml(booking.customerConfirmationStatus || "sin confirmar")}</small></div>
              <div>
                ${combinations.length ? `<form data-booking-combination-form data-booking-id="${escapeAttr(booking.id)}"><select name="combinationId">${combinations.map((item) => `<option value="${escapeAttr(item.id)}"${booking.tableCombinationId === item.id ? " selected" : ""}>${escapeHtml(item.name)} · ${escapeHtml(String(item.minGuests))}–${escapeHtml(String(item.maxGuests))}</option>`).join("")}</select><button type="submit">Asignar mesas</button></form>` : ""}
                ${policies.length && !booking.policyAcceptedAt ? `<form data-booking-policy-accept-form data-booking-id="${escapeAttr(booking.id)}"><select name="policyId">${policies.map((item) => `<option value="${escapeAttr(item.id)}">${escapeHtml(item.name)}</option>`).join("")}</select><label><input name="accepted" type="checkbox" required> Consentimiento explícito</label><button type="submit">Registrar</button></form>` : ""}
                <button type="button" data-booking-public-confirmation="${escapeAttr(booking.id)}">Crear enlace confirmable</button>
                ${booking.depositStatus && !["not_required", "refunded"].includes(booking.depositStatus) ? `<button type="button" data-booking-policy-event="${escapeAttr(booking.id)}" data-event-type="refund_requested">Solicitar devolución</button><button type="button" data-booking-policy-event="${escapeAttr(booking.id)}" data-event-type="dispute_opened">Abrir disputa</button>` : ""}
              </div>
            </article>
          `).join("")}</section>
        </div>
      </div>
    </section>
  `;
}

function renderVerticalKpi(value, label) {
  return `<article><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></article>`;
}

function renderBookingResourceKpi(value, label) { return `<span><strong>${escapeHtml(String(value || 0))}</strong><small>${escapeHtml(label)}</small></span>`; }

function renderBookingResourceCard(resource, model) {
  const serviceNames = resource.serviceIds?.length ? resource.serviceIds.map((id) => model.services.find((item) => item.id === id)?.name || id).join(", ") : "Todos los servicios";
  return `
    <article class="booking-resource-card${resource.active === false ? " is-inactive" : ""}" style="--resource-color:${escapeAttr(resource.color || "#2563eb")}">
      <header><span class="resource-color" aria-hidden="true"></span><div><strong>${escapeHtml(resource.name)}</strong><small>${escapeHtml(bookingResourceTypeLabel(resource.type))} · aforo ${escapeHtml(String(resource.capacity || 1))}</small></div><button type="button" data-resource-toggle data-resource-id="${escapeAttr(resource.id)}" data-active="${resource.active === false ? "false" : "true"}">${resource.active === false ? "Activar" : "Pausar"}</button></header>
      <p>${escapeHtml(serviceNames)}</p>
      <div class="resource-meta"><span>${escapeHtml(String(resource.simultaneousCapacity || 1))} simultanea(s)</span><span>${escapeHtml(String(resource.bufferBeforeMinutes || 0))}/${escapeHtml(String(resource.bufferAfterMinutes || 0))} min buffer</span><span>${escapeHtml(String(resource.activeAssignments || 0))} asignada(s)</span></div>
      <details>
        <summary>Horario del recurso</summary>
        <form data-resource-schedule-form data-resource-id="${escapeAttr(resource.id)}" class="resource-schedule-form">
          ${getResourceScheduleRows(resource.schedule).map(renderResourceScheduleRow).join("")}
          <button type="submit">Guardar horario</button>
        </form>
      </details>
      <details>
        <summary>Excepciones</summary>
        <form data-resource-exception-form data-resource-id="${escapeAttr(resource.id)}" class="resource-exception-form">
          <label>Inicio<input name="startsAt" type="datetime-local" required></label><label>Fin<input name="endsAt" type="datetime-local" required></label>
          <label>Modo<select name="mode"><option value="blocked">Bloqueado</option><option value="available">Disponible extra</option></select></label><label>Motivo<input name="reason" placeholder="Vacaciones, turno extra..."></label>
          <button type="submit">Añadir excepcion</button>
        </form>
        <div class="resource-exception-list">${resource.exceptions?.length ? resource.exceptions.slice(-4).map((item) => `<span class="${item.active === false ? "is-inactive" : ""}"><strong>${escapeHtml(item.mode === "available" ? "Extra" : "Bloqueo")}</strong>${escapeHtml(formatDateTimeRange(item.startsAt, item.endsAt))}</span>`).join("") : "<small>Sin excepciones.</small>"}</div>
      </details>
    </article>
  `;
}

function getResourceScheduleRows(schedule) {
  const rules = Array.isArray(schedule) ? schedule : [];
  return WEEKDAYS.map((day) => { const rule = rules.find((item) => Number(item.weekday) === Number(day.value)); return { weekday: day.value, label: day.label, id: rule?.id || "", active: rule?.active !== false && Boolean(rule), startTime: rule?.startTime || "09:00", endTime: rule?.endTime || "18:00" }; });
}

function renderResourceScheduleRow(row) { return `<label class="availability-row"><input name="active-${escapeAttr(row.weekday)}" type="checkbox"${row.active ? " checked" : ""}><span>${escapeHtml(row.label)}</span><input name="id-${escapeAttr(row.weekday)}" type="hidden" value="${escapeAttr(row.id)}"><input name="startTime-${escapeAttr(row.weekday)}" type="time" value="${escapeAttr(row.startTime)}"><input name="endTime-${escapeAttr(row.weekday)}" type="time" value="${escapeAttr(row.endTime)}"></label>`; }

function renderBookingWaitlistCard(entry) {
  return `<article class="waitlist-card"><div><strong>${escapeHtml(entry.customerName || "Cliente")}</strong><span>${escapeHtml(entry.serviceName || "Reserva")} · ${escapeHtml(formatDateTime(entry.desiredStartsAt))} · ${escapeHtml(String(entry.partySize || 1))} persona(s)</span><small>${escapeHtml(entry.phone || entry.email || "")}</small></div><span class="pill neutral">${escapeHtml(waitlistStatusLabel(entry.status))}</span>${["waiting", "offered", "accepted"].includes(entry.status) ? `<button type="button" data-waitlist-convert data-waitlist-id="${escapeAttr(entry.id)}">Reservar hueco</button>` : ""}${entry.status === "waiting" ? `<button type="button" data-waitlist-offer data-waitlist-id="${escapeAttr(entry.id)}">Ofertar</button>` : ""}</article>`;
}

function bookingResourceTypeLabel(value) { return ({ professional: "Profesional", table: "Mesa", room: "Sala", cabin: "Cabina", equipment: "Equipo", capacity: "Aforo compartido", other: "Otro" })[clean(value)] || "Recurso"; }
function waitlistStatusLabel(value) { return ({ waiting: "En espera", offered: "Ofertado", accepted: "Aceptado", booked: "Reservado", canceled: "Cancelado", expired: "Caducado" })[clean(value)] || clean(value); }

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
  const resourceNames = Array.isArray(booking.resources) ? booking.resources.map((item) => item.name).filter(Boolean).join(", ") : "";
  const risk = booking.noShowRisk || {};
  const deposit = booking.deposit || { required: booking.depositRequired, amount: booking.depositAmount, status: booking.depositStatus, currency: booking.currency };

  return `
    <article class="item-card booking-card">
      <span class="pill ${escapeHtml(booking.status || "pending")}">${escapeHtml(statusLabel(booking.status || "pending"))}</span>
      <h3>${escapeHtml(clean(booking.serviceName || booking.service || "Reserva"))}</h3>
      <p>${escapeHtml(clean(booking.customerName || booking.name || "Cliente sin nombre"))}</p>
      <p>${escapeHtml(clean([booking.phone, booking.email].filter(Boolean).join(" / ") || booking.notes || ""))}</p>
      <strong>${escapeHtml(formatDateTime(booking.startsAt || booking.date))}</strong>
      <p>${escapeHtml(resourceNames ? `${resourceNames} · ${booking.partySize || 1} persona(s)` : `${booking.partySize || 1} persona(s) · sin recurso asignado`)}</p>
      <div class="booking-risk-row"><span class="pill ${escapeHtml(risk.level || "low")}">Riesgo ${escapeHtml(customerRiskLabel(risk.level || "low"))} · ${escapeHtml(String(risk.score || 0))}</span>${deposit.required ? `<span class="pill neutral">Señal ${escapeHtml(formatMoney(deposit.amount || 0, deposit.currency || booking.currency || "EUR"))} · ${escapeHtml(depositStatusLabel(deposit.status))}</span>` : ""}</div>
      <p>${escapeHtml(booking.lastReminderAt ? `Recordatorio: ${formatDateTime(booking.lastReminderAt)}` : "Sin recordatorio enviado")}</p>
      <label class="status-field">
        Estado
        <select data-booking-status data-booking-id="${escapeAttr(booking.id)}">
          ${BOOKING_STATUSES.map((status) => `<option value="${escapeAttr(status)}"${String(booking.status || "pending") === status ? " selected" : ""}>${escapeHtml(statusLabel(status))}</option>`).join("")}
        </select>
      </label>
      <button class="inline-action" type="button" data-booking-reminder data-booking-id="${escapeAttr(booking.id)}" data-channel="${escapeAttr(preferredReminderChannel(booking))}">Preparar recordatorio</button>
      ${deposit.required && !["paid", "forfeited"].includes(deposit.status) ? `<button class="inline-action" type="button" data-booking-deposit data-booking-id="${escapeAttr(booking.id)}">Crear enlace de señal</button>` : ""}
      ${googleSync}
    </article>
  `;
}

function depositStatusLabel(value) { return ({ pending: "pendiente", paid: "pagada", forfeited: "retenida", refunded: "devuelta", not_required: "no requerida" })[clean(value)] || clean(value || "pendiente"); }

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

function addHours(date, hours) {
  const copy = new Date(date);
  copy.setHours(copy.getHours() + hours);
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

function emptyTaskQueues() {
  return {
    today: [],
    overdue: [],
    unassigned: [],
    mine: [],
    team: [],
    unownedDeals: []
  };
}

function normalizeTaskQueues(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    today: Array.isArray(source.today) ? source.today : [],
    overdue: Array.isArray(source.overdue) ? source.overdue : [],
    unassigned: Array.isArray(source.unassigned) ? source.unassigned : [],
    mine: Array.isArray(source.mine) ? source.mine : [],
    team: Array.isArray(source.team) ? source.team : [],
    unownedDeals: Array.isArray(source.unownedDeals) ? source.unownedDeals : []
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

function normalizeDealPipelinePayload(payload) {
  const source = payload && typeof payload === "object" ? payload : {};
  const pipeline = source.pipeline && typeof source.pipeline === "object" ? source.pipeline : null;
  const sourceColumns = Array.isArray(source.columns) ? source.columns : [];
  const stages = Array.isArray(pipeline?.stages) ? pipeline.stages : sourceColumns.map((column) => column.stage).filter(Boolean);
  const byStage = new Map(sourceColumns.map((column) => [clean(column.stageId || column.stage?.id), column]));
  const columns = stages
    .slice()
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .map((stage) => {
      const column = byStage.get(stage.id) || {};
      const deals = Array.isArray(column.deals)
        ? column.deals.map(normalizeDeal).sort(compareDealCards)
        : [];
      return {
        stage: { ...stage },
        stageId: stage.id,
        count: Number.isFinite(Number(column.count)) ? Number(column.count) : deals.length,
        totalValue: Number.isFinite(Number(column.totalValue))
          ? Number(column.totalValue)
          : deals.reduce((sum, deal) => sum + Number(deal.value || 0), 0),
        deals
      };
    });

  return {
    pipeline,
    columns,
    total: columns.reduce((sum, column) => sum + column.deals.length, 0),
    totalValue: columns.reduce((sum, column) => sum + Number(column.totalValue || 0), 0)
  };
}

function normalizeDeal(value) {
  const deal = value && typeof value === "object" ? value : {};
  return {
    ...deal,
    value: Number.isFinite(Number(deal.value)) ? Number(deal.value) : 0,
    probability: Number.isFinite(Number(deal.probability)) ? Number(deal.probability) : 0,
    order: Number.isFinite(Number(deal.order)) ? Number(deal.order) : Date.parse(deal.createdAt || "") || Date.now(),
    priority: normalizeLeadPriority(deal.priority),
    status: ["open", "won", "lost"].includes(clean(deal.status)) ? clean(deal.status) : "open"
  };
}

function compareDealCards(left, right) {
  return Number(left.order || 0) - Number(right.order || 0)
    || String(left.title || "").localeCompare(String(right.title || ""), "es");
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

function dateTimeLocalValue(value) {
  const parsed = value instanceof Date ? value : parseDate(value);
  if (!parsed) return "";
  return `${dateInputValue(parsed)}T${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
}

function dateTimeLocalToIso(value) {
  const text = clean(value);
  if (!text) return "";
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
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

function accountTypeLabel(value) {
  return ({ company: "Empresa", household: "Hogar", group: "Grupo" })[clean(value)] || "Cuenta";
}

function associationTypeLabel(value) {
  return ({
    contact: "Persona",
    account: "Cuenta",
    deal: "Oportunidad",
    task: "Tarea",
    proposal: "Propuesta",
    booking: "Reserva",
    invoice: "Factura",
    hospitalityInvoice: "Factura operativa",
    project: "Proyecto",
    conversation: "Conversacion"
  })[clean(value)] || "Registro";
}

function entityTypeLabel(value) {
  return associationTypeLabel(value);
}

function taskTypeLabel(value) {
  return ({ call: "Llamada", whatsapp: "WhatsApp", email: "Email", meeting: "Reunion", proposal: "Propuesta", booking: "Reserva", follow_up: "Seguimiento", admin: "Administrativa", other: "Otra" })[clean(value)] || "Tarea";
}

function taskPriorityLabel(value) {
  return ({ low: "Baja", normal: "Normal", high: "Alta", urgent: "Urgente" })[clean(value)] || "Normal";
}

function taskRecurrenceLabel(value) {
  return ({ daily: "Se repite a diario", weekly: "Se repite cada semana", monthly: "Se repite cada mes", yearly: "Se repite cada año" })[clean(value)] || "";
}

function consentActionLabel(value) {
  return ({ acknowledged: "Aviso aceptado", granted: "Permiso concedido", withdrawn: "Permiso retirado", suppressed: "Supresion activada", unsuppressed: "Supresion retirada" })[clean(value)] || "Evento";
}

function consentScopeLabel(channel, purpose) {
  const channels = { any: "Todos los canales", email: "Email", whatsapp: "WhatsApp", sms: "SMS", phone: "Telefono" };
  const purposes = { any: "todos los propositos", service: "servicio", marketing: "marketing", reviews: "reseñas", profiling: "perfilado" };
  return `${channels[clean(channel)] || channel} · ${purposes[clean(purpose)] || purpose}`;
}

function associationKindLabel(value) {
  return ({
    related: "Relacionada",
    primary: "Principal",
    member: "Miembro",
    decision_maker: "Decisor",
    billing: "Facturacion",
    owner: "Propietario",
    guest: "Invitado",
    customer: "Cliente",
    supplier: "Proveedor",
    participant: "Participante"
  })[clean(value)] || clean(value || "Relacionada");
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
