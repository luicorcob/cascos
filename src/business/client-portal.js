const PROJECT_STATUSES = { pending: "Pendiente", "in-design": "En diseño", review: "Revisión", published: "Publicado", maintenance: "Mantenimiento" };
const INVOICE_STATUSES = { draft: "Borrador", sent: "Enviada", paid: "Pagada", overdue: "Vencida", cancelled: "Cancelada" };
const PROPOSAL_STATUSES = { borrador: "Borrador", enviada: "Enviada", vista: "Vista", aceptada: "Aceptada", rechazada: "Rechazada", caducada: "Caducada" };
const SUBSCRIPTION_STATUSES = { active: "Activa", paused: "Pausada", cancelled: "Cancelada", expired: "Vencida" };
const PROJECT_SECTION_META = Object.freeze({
  projects: {
    title: "Estado del proyecto",
    subtitle: "Avance, tareas y aprobaciones del trabajo contratado a DLS."
  },
  billing: {
    title: "Facturas y pagos DLS",
    subtitle: "Presupuestos aceptados, facturas, pagos y servicios recurrentes."
  },
  documents: {
    title: "Documentos compartidos",
    subtitle: "Contratos, entregables y archivos intercambiados con DLS."
  },
  support: {
    title: "Soporte DLS",
    subtitle: "Conversación directa con el equipo que gestiona tu proyecto."
  },
  team: {
    title: "Chat del equipo",
    subtitle: "Canales privados para coordinar a las personas de tu negocio."
  }
});
const refs = {};
const state = {
  session: window.LocalLiftApi?.getClientSession?.() || null,
  business: null,
  projects: [],
  subscriptions: [],
  invoices: [],
  proposals: [],
  documents: [],
  teamMembers: [],
  communicationThreads: [],
  activeTeamThreadId: "",
  communicationsError: "",
  communicationsLoading: false,
  pollTimer: null,
  activeTab: new URLSearchParams(window.location.search).get("projectSection") || "projects",
  loading: false,
  queuedReload: false
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  refs.title = document.querySelector("[data-client-title]");
  refs.subtitle = document.querySelector("[data-client-subtitle]");
  refs.notice = document.querySelector("[data-client-notice]");
  refs.authState = document.querySelector("[data-client-auth-state]");
  refs.refresh = document.querySelector("[data-client-refresh]");
  refs.logout = document.querySelector("[data-client-logout]");
  refs.web = document.querySelector("[data-client-web]");
  refs.projects = document.querySelector("[data-client-projects]");
  refs.invoices = document.querySelector("[data-client-invoices]");
  refs.proposals = document.querySelector("[data-client-proposals]");
  refs.subscriptions = document.querySelector("[data-client-subscriptions]");
  refs.documents = document.querySelector("[data-client-documents]");
  refs.documentForm = document.querySelector("[data-client-document-form]");
  refs.documentProject = document.querySelector("[data-client-document-project]");
  refs.supportMessages = document.querySelector("[data-client-support-messages]");
  refs.supportForm = document.querySelector("[data-client-support-form]");
  refs.supportUnread = Array.from(document.querySelectorAll("[data-client-support-unread]"));
  refs.profileForm = document.querySelector("[data-client-profile-form]");
  refs.teamMembers = document.querySelector("[data-client-team-members]");
  refs.roomForm = document.querySelector("[data-client-room-form]");
  refs.teamRooms = document.querySelector("[data-client-team-rooms]");
  refs.teamTitle = document.querySelector("[data-client-team-title]");
  refs.teamMessages = document.querySelector("[data-client-team-messages]");
  refs.teamMessageForm = document.querySelector("[data-client-team-message-form]");

  document.addEventListener("dls:business-changed", syncDashboardBusiness);

  document.querySelectorAll("[data-client-tab]").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.clientTab)));
  document.querySelectorAll("[data-client-section]").forEach((button) => {
    button.addEventListener("click", () => openDashboardSection(button.dataset.clientSection, button));
  });
  refs.refresh?.addEventListener("click", loadPortal);
  refs.logout?.addEventListener("click", () => {
    window.LocalLiftApi?.clearClientSession?.();
    window.location.href = "../index.html";
  });
  refs.documentForm?.addEventListener("submit", submitDocument);
  refs.supportForm?.addEventListener("submit", submitSupportMessage);
  refs.profileForm?.addEventListener("submit", submitTeamProfile);
  refs.roomForm?.addEventListener("submit", submitTeamRoom);
  refs.teamMessageForm?.addEventListener("submit", submitTeamMessage);

  if (!state.session?.businessId) {
    const queryBusiness = new URLSearchParams(window.location.search).get("business");
    const adminToken = window.LocalLiftApi?.getAdminToken?.();
    if (!queryBusiness || !adminToken) {
      showAuthState();
      return;
    }
    state.session = { businessId: queryBusiness, businessName: "Vista de administrador", adminPreview: true };
  }
  loadPortal();
}

async function loadPortal() {
  if (!state.session?.businessId) return;
  if (state.loading) {
    state.queuedReload = true;
    return;
  }
  state.loading = true;
  state.queuedReload = false;
  showPortalState();
  setLoading(true);
  showNotice("Actualizando tu portal...", "info");
  const ref = encodeURIComponent(state.session.businessId);
  try {
    const [businessPayload, projectPayload, subscriptionPayload, invoicePayload, proposalPayload, documentPayload] = await Promise.all([
      getJson(`/api/businesses/${ref}`),
      getJson(`/api/businesses/${ref}/projects`),
      getJson(`/api/businesses/${ref}/subscriptions`),
      getJson(`/api/businesses/${ref}/invoices`),
      getJson(`/api/businesses/${ref}/proposals`),
      getJson(`/api/businesses/${ref}/documents`)
    ]);
    state.business = businessPayload.business || null;
    state.projects = projectPayload.projects || [];
    state.subscriptions = subscriptionPayload.subscriptions || [];
    state.invoices = invoicePayload.invoices || [];
    state.proposals = proposalPayload.proposals || [];
    state.documents = documentPayload.documents || [];
    await loadCommunications({ silent: true });
    render();
    showNotice(state.communicationsError ? "El portal funciona, pero la mensajería no está disponible ahora mismo." : "", state.communicationsError ? "error" : "info");
    startCommunicationsPolling();
  } catch (error) {
    if (error.status === 401) {
      window.LocalLiftApi?.clearClientSession?.();
      showAuthState("Tu sesión ha caducado.");
    } else {
      showNotice(portalErrorMessage(error), "error");
    }
  } finally {
    state.loading = false;
    setLoading(false);
    if (state.queuedReload) {
      state.queuedReload = false;
      loadPortal();
    }
  }
}

function syncDashboardBusiness(event) {
  const businessId = String(event.detail?.businessId || "").trim();
  if (!businessId || (state.session?.token && !state.session?.adminPreview)) return;

  state.session = {
    businessId,
    businessName: String(event.detail?.businessName || "Vista de administrador"),
    adminPreview: true
  };
  loadPortal();
}

function render() {
  const name = state.business?.name || state.session?.businessName || "tu negocio";
  refs.title.textContent = `Proyecto de ${name}`;
  refs.subtitle.textContent = "Avance, aprobaciones, documentos, facturas y pagos en un solo lugar.";
  if (refs.web) {
    refs.web.href = state.business?.publishedUrl || `client-site.html?business=${encodeURIComponent(state.business?.slug || state.business?.id || "")}`;
  }
  renderMetrics();
  renderProjects();
  renderBilling();
  renderDocuments();
  renderCommunications();
}

function renderMetrics() {
  const tasks = state.projects.flatMap((project) => project.tasks || []);
  const completed = tasks.filter((task) => task.status === "done").length;
  const progress = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const balance = state.invoices.filter((invoice) => !["cancelled", "paid"].includes(invoice.status)).reduce((sum, invoice) => sum + Number(invoice.balance || 0), 0);
  const activeSubscriptions = state.subscriptions.filter((subscription) => subscription.status === "active").sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal));
  metric("projects", state.projects.length, state.projects.length ? "Vinculados a tu cuenta" : "Sin proyectos");
  metric("progress", `${progress}%`);
  metric("balance", money(balance, "EUR"));
  metric("renewal", activeSubscriptions[0] ? date(activeSubscriptions[0].nextRenewal) : "—", activeSubscriptions[0]?.name || "Sin servicios activos");
}

function renderProjects() {
  if (!refs.projects) return;
  if (!state.projects.length) {
    refs.projects.innerHTML = empty("Aún no hay un proyecto activo.", "Cuando aceptes un presupuesto aparecerá aquí automáticamente.");
    return;
  }
  refs.projects.innerHTML = state.projects.map((project) => {
    const tasks = project.tasks || [];
    const comments = project.comments || [];
    const approvals = project.approvals || [];
    const lastApproval = approvals[0];
    return `
      <article class="client-project-card">
        <header><span class="client-status is-${escapeAttr(project.status)}">${escapeHtml(PROJECT_STATUSES[project.status] || project.status)}</span><strong>${project.progress || 0}%</strong></header>
        <h3>${escapeHtml(project.name)}</h3>
        <p>${escapeHtml(project.description || "Proyecto en seguimiento por el equipo DLS.")}</p>
        <dl><div><dt>Responsable</dt><dd>${escapeHtml(project.responsible || "Equipo DLS")}</dd></div><div><dt>Entrega</dt><dd>${escapeHtml(date(project.dueDate))}</dd></div></dl>
        <div class="client-progress"><span style="width:${Number(project.progress || 0)}%"></span></div>
        <ul class="client-task-list">${tasks.length ? tasks.map((task) => `<li class="is-${escapeAttr(task.status)}"><span>${task.status === "done" ? "✓" : "○"}</span>${escapeHtml(task.title)}</li>`).join("") : "<li>Sin tareas publicadas todavía.</li>"}</ul>
        <section class="client-approval-box">
          <strong>Aprobación de diseño</strong>
          <p>${lastApproval ? `${lastApproval.decision === "approved" ? "Diseño aprobado" : "Cambios solicitados"} · ${dateTime(lastApproval.createdAt)}` : "No has enviado una decisión todavía."}</p>
          ${state.session.adminPreview ? "" : `<form data-client-approval-form="${escapeAttr(project.id)}"><textarea name="note" maxlength="2000" rows="2" placeholder="Comentario opcional"></textarea><div><button type="submit" name="decision" value="approved">Aprobar diseño</button><button type="submit" name="decision" value="changes-requested">Solicitar cambios</button></div></form>`}
        </section>
        <section class="client-comments">
          <strong>Comentarios</strong>
          ${comments.length ? `<ul>${comments.map((comment) => `<li><span>${comment.actorRole === "client" ? "Tú" : "DLS"} · ${dateTime(comment.createdAt)}</span>${escapeHtml(comment.message)}</li>`).join("")}</ul>` : "<p>No hay comentarios todavía.</p>"}
          ${state.session.adminPreview ? "" : `<form data-client-comment-form="${escapeAttr(project.id)}"><input name="message" maxlength="4000" required placeholder="Escribe un comentario para el equipo"><button type="submit">Enviar</button></form>`}
        </section>
      </article>`;
  }).join("");
  refs.projects.querySelectorAll("[data-client-comment-form]").forEach((form) => form.addEventListener("submit", submitComment));
  refs.projects.querySelectorAll("[data-client-approval-form]").forEach((form) => form.addEventListener("submit", submitApproval));
}

function renderBilling() {
  refs.invoices.innerHTML = state.invoices.length ? state.invoices.map((invoice) => `
    <article class="client-list-card"><header><strong>${escapeHtml(invoice.number)}</strong><span class="client-status is-${escapeAttr(invoice.status)}">${escapeHtml(INVOICE_STATUSES[invoice.status] || invoice.status)}</span></header><p>${escapeHtml(invoice.concept)}</p><dl><div><dt>Total</dt><dd>${escapeHtml(money(invoice.total, invoice.currency))}</dd></div><div><dt>Pagado</dt><dd>${escapeHtml(money(invoice.paidAmount, invoice.currency))}</dd></div><div><dt>Pendiente</dt><dd>${escapeHtml(money(invoice.balance, invoice.currency))}</dd></div><div><dt>Vence</dt><dd>${escapeHtml(date(invoice.dueDate))}</dd></div></dl>${invoice.payments?.length ? `<small>${invoice.payments.length} pago(s) registrado(s)</small>` : ""}</article>`).join("") : empty("No hay facturas.");
  const accepted = state.proposals.filter((proposal) => proposal.status === "aceptada");
  refs.proposals.innerHTML = accepted.length ? accepted.map((proposal) => `<article class="client-list-card"><header><strong>${escapeHtml(proposal.package.replaceAll("_", " "))}</strong><span class="client-status">${escapeHtml(PROPOSAL_STATUSES[proposal.status])}</span></header><p>Alta: ${escapeHtml(money(proposal.setupPrice, "EUR"))} · Mensual: ${escapeHtml(money(proposal.monthlyPrice, "EUR"))}</p></article>`).join("") : empty("No hay presupuestos aceptados.");
  refs.subscriptions.innerHTML = state.subscriptions.length ? state.subscriptions.map((subscription) => `<article class="client-list-card"><header><strong>${escapeHtml(subscription.name)}</strong><span class="client-status is-${escapeAttr(subscription.status)}">${escapeHtml(SUBSCRIPTION_STATUSES[subscription.status] || subscription.status)}</span></header><p>${escapeHtml(money(subscription.price, subscription.currency))} · Próxima renovación ${escapeHtml(date(subscription.nextRenewal))}</p></article>`).join("") : empty("No hay servicios recurrentes.");
}

function renderDocuments() {
  if (refs.documentProject) {
    refs.documentProject.innerHTML = `<option value="">General</option>${state.projects.map((project) => `<option value="${escapeAttr(project.id)}">${escapeHtml(project.name)}</option>`).join("")}`;
  }
  refs.documents.innerHTML = state.documents.length ? state.documents.map((document) => `<article><span>${escapeHtml(document.category.replaceAll("-", " "))}</span><strong>${escapeHtml(document.name)}</strong><small>${escapeHtml(dateTime(document.createdAt))} · ${document.uploadedBy === "client" ? "Enviado por ti" : "Compartido por DLS"}</small><a href="${escapeAttr(document.url)}" target="_blank" rel="noopener">Abrir archivo</a></article>`).join("") : empty("No hay documentos compartidos.", "Puedes enviar un archivo mediante un enlace seguro.");
  if (refs.documentForm) refs.documentForm.hidden = Boolean(state.session.adminPreview);
}

async function loadCommunications({ markRead = false, silent = false } = {}) {
  if (!state.session?.businessId || state.communicationsLoading) return;
  state.communicationsLoading = true;
  const ref = encodeURIComponent(state.session.businessId);
  try {
    const [threadPayload, memberPayload] = await Promise.all([
      getJson(`/api/businesses/${ref}/communications/threads${markRead ? "?markRead=true" : ""}`),
      getJson(`/api/businesses/${ref}/communications/members`)
    ]);
    state.communicationThreads = threadPayload.threads || [];
    state.teamMembers = memberPayload.members || [];
    state.communicationsError = "";
    const teamThreads = state.communicationThreads.filter((thread) => thread.type === "team");
    if (!teamThreads.some((thread) => thread.id === state.activeTeamThreadId)) {
      state.activeTeamThreadId = teamThreads[0]?.id || "";
    }
    renderCommunications();
  } catch (error) {
    state.communicationsError = "No se pudo cargar la mensajería.";
    if (!silent) showNotice(portalErrorMessage(error), "error");
  } finally {
    state.communicationsLoading = false;
  }
}

function renderCommunications() {
  const supportThread = state.communicationThreads.find((thread) => thread.type === "support");
  const unread = Number(supportThread?.unreadCount || 0);
  refs.supportUnread.forEach((node) => {
    node.hidden = unread === 0;
    node.textContent = unread > 99 ? "99+" : String(unread);
  });
  if (refs.supportMessages) {
    refs.supportMessages.innerHTML = supportThread?.messages?.length
      ? supportThread.messages.map((message) => renderChatMessage(message, message.senderRole === "client")).join("")
      : empty("Empieza una conversación con DLS.", "Tu primer mensaje abrirá automáticamente una consulta privada.");
  }

  const profile = getTeamProfile();
  if (refs.profileForm) {
    const nameInput = refs.profileForm.elements.name;
    const roleInput = refs.profileForm.elements.role;
    if (nameInput && !nameInput.value) nameInput.value = profile.name || "";
    if (roleInput && profile.role) roleInput.value = profile.role;
  }
  const supportName = refs.supportForm?.elements.senderName;
  if (supportName && !supportName.value) supportName.value = profile.name || "";

  if (refs.teamMembers) {
    refs.teamMembers.innerHTML = state.teamMembers.length
      ? state.teamMembers.map((member) => `<span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(teamRoleLabel(member.role))}</small></span>`).join("")
      : `<p>Aún no hay personas registradas.</p>`;
  }
  const rooms = state.communicationThreads.filter((thread) => thread.type === "team");
  if (refs.teamRooms) {
    refs.teamRooms.innerHTML = rooms.length
      ? rooms.map((thread) => `<button type="button" class="${thread.id === state.activeTeamThreadId ? "is-active" : ""}" data-client-team-room="${escapeAttr(thread.id)}"><strong>${escapeHtml(thread.title)}</strong><small>${thread.messageCount || 0} mensajes</small></button>`).join("")
      : `<p>No hay canales. Crea el primero.</p>`;
    refs.teamRooms.querySelectorAll("[data-client-team-room]").forEach((button) => button.addEventListener("click", () => {
      state.activeTeamThreadId = button.dataset.clientTeamRoom || "";
      renderCommunications();
    }));
  }
  const activeRoom = rooms.find((thread) => thread.id === state.activeTeamThreadId);
  if (refs.teamTitle) refs.teamTitle.textContent = activeRoom?.title || "Selecciona un canal";
  if (refs.teamMessages) {
    refs.teamMessages.innerHTML = activeRoom?.messages?.length
      ? activeRoom.messages.map((message) => renderChatMessage(message, message.senderName === profile.name)).join("")
      : empty(activeRoom ? "Este canal está vacío." : "Crea o selecciona un canal.", activeRoom ? "Envía el primer mensaje al equipo." : "Los canales solo son visibles para tu negocio.");
  }
  if (refs.teamMessageForm) {
    refs.teamMessageForm.querySelectorAll("textarea, input, button").forEach((control) => { control.disabled = !activeRoom; });
  }
}

function renderChatMessage(message, own) {
  const attachment = message.attachmentUrl
    ? `<a href="${escapeAttr(message.attachmentUrl)}" target="_blank" rel="noopener">↗ ${escapeHtml(message.attachmentName || "Abrir adjunto")}</a>`
    : "";
  return `<article class="client-chat-message ${own ? "is-own" : ""}">
    <header><strong>${escapeHtml(message.senderName || "Usuario")}</strong><time>${escapeHtml(dateTime(message.createdAt))}</time></header>
    ${message.body ? `<p>${escapeHtml(message.body).replaceAll("\n", "<br>")}</p>` : ""}${attachment}
  </article>`;
}

async function submitSupportMessage(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const senderName = String(data.get("senderName") || "").trim();
  const body = String(data.get("body") || "").trim();
  const attachmentUrl = String(data.get("attachmentUrl") || "").trim();
  if (!senderName || (!body && !attachmentUrl)) {
    showNotice("Indica tu nombre y escribe un mensaje o añade un enlace.", "error");
    return;
  }
  await runCommunicationMutation(form, async () => {
    saveTeamProfile({ ...getTeamProfile(), name: senderName });
    let thread = state.communicationThreads.find((item) => item.type === "support");
    if (!thread) {
      const created = await postJson(communicationsPath("threads"), { type: "support" });
      thread = created.thread;
    }
    await postJson(communicationsPath(`threads/${encodeURIComponent(thread.id)}/messages`), {
      senderName,
      body,
      attachmentName: String(data.get("attachmentName") || "").trim(),
      attachmentUrl
    });
    form.elements.body.value = "";
    form.elements.attachmentName.value = "";
    form.elements.attachmentUrl.value = "";
    await loadCommunications({ markRead: true, silent: true });
    showNotice("Mensaje enviado a DLS.", "success");
  });
}

async function submitTeamProfile(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const profile = { name: String(data.get("name") || "").trim(), role: String(data.get("role") || "employee") };
  await runCommunicationMutation(form, async () => {
    const result = await postJson(communicationsPath("members"), profile);
    if (!result.created && result.member.role !== profile.role) {
      await patchJson(communicationsPath(`members/${encodeURIComponent(result.member.id)}`), { role: profile.role });
    }
    saveTeamProfile(profile);
    await loadCommunications({ silent: true });
    showNotice("Perfil de equipo guardado.", "success");
  });
}

async function submitTeamRoom(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const profile = getTeamProfile();
  if (!profile.name) {
    showNotice("Guarda primero tu perfil de empleado.", "error");
    refs.profileForm?.elements.name?.focus();
    return;
  }
  const data = new FormData(form);
  await runCommunicationMutation(form, async () => {
    const result = await postJson(communicationsPath("threads"), { type: "team", title: String(data.get("title") || "").trim() });
    state.activeTeamThreadId = result.thread.id;
    form.reset();
    await loadCommunications({ silent: true });
    showNotice("Canal privado creado.", "success");
  });
}

async function submitTeamMessage(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const profile = getTeamProfile();
  if (!profile.name) {
    showNotice("Guarda primero tu perfil de empleado.", "error");
    return;
  }
  if (!state.activeTeamThreadId) return;
  const data = new FormData(form);
  const body = String(data.get("body") || "").trim();
  const attachmentUrl = String(data.get("attachmentUrl") || "").trim();
  if (!body && !attachmentUrl) {
    showNotice("Escribe un mensaje o añade un enlace.", "error");
    return;
  }
  await runCommunicationMutation(form, async () => {
    await postJson(communicationsPath(`threads/${encodeURIComponent(state.activeTeamThreadId)}/messages`), {
      senderName: profile.name,
      body,
      attachmentName: String(data.get("attachmentName") || "").trim(),
      attachmentUrl
    });
    form.reset();
    await loadCommunications({ silent: true });
    showNotice("Mensaje enviado al equipo.", "success");
  });
}

async function runCommunicationMutation(form, action) {
  form.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  try {
    await action();
  } catch (error) {
    showNotice(error.status === 403 ? "Tu sesión no permite esta acción." : "No se pudo enviar. Revisa los datos y vuelve a intentarlo.", "error");
  } finally {
    form.querySelectorAll("button").forEach((button) => { button.disabled = false; });
  }
}

function communicationsPath(resource) {
  return `/api/businesses/${encodeURIComponent(state.session.businessId)}/communications/${resource}`;
}

function getTeamProfile() {
  try {
    return JSON.parse(localStorage.getItem(`dls_team_profile_${state.session?.businessId || "portal"}`) || "{}") || {};
  } catch {
    return {};
  }
}

function saveTeamProfile(profile) {
  localStorage.setItem(`dls_team_profile_${state.session?.businessId || "portal"}`, JSON.stringify({ name: profile.name || "", role: profile.role || "employee" }));
}

function teamRoleLabel(role) {
  return ({ owner: "Propietario", manager: "Responsable", employee: "Empleado" })[role] || "Empleado";
}

function startCommunicationsPolling() {
  if (state.pollTimer) return;
  state.pollTimer = window.setInterval(() => {
    if (!document.hidden && state.session?.businessId) loadCommunications({ markRead: state.activeTab === "support", silent: true });
  }, 15000);
}

async function submitComment(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await mutate(form, `/api/businesses/${encodeURIComponent(state.session.businessId)}/projects/${encodeURIComponent(form.dataset.clientCommentForm)}/comments`, { message: String(data.get("message") || "") }, "Comentario enviado.");
}

async function submitApproval(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitter = event.submitter;
  const data = new FormData(form);
  await mutate(form, `/api/businesses/${encodeURIComponent(state.session.businessId)}/projects/${encodeURIComponent(form.dataset.clientApprovalForm)}/approvals`, { decision: submitter?.value || "approved", note: String(data.get("note") || "") }, "Decisión registrada.");
}

async function submitDocument(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  await mutate(form, `/api/businesses/${encodeURIComponent(state.session.businessId)}/documents`, { projectId: String(data.get("projectId") || ""), name: String(data.get("name") || ""), url: String(data.get("url") || "") }, "Archivo enviado.");
}

async function mutate(form, path, body, success) {
  form.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  try {
    await postJson(path, body);
    form.reset();
    await loadPortal();
    showNotice(success, "success");
  } catch (error) {
    showNotice(error.status === 403 ? "Este acceso no puede realizar la acción." : "No se pudo enviar. Revisa los campos.", "error");
  } finally {
    form.querySelectorAll("button").forEach((button) => { button.disabled = false; });
  }
}

function setTab(tab) {
  state.activeTab = ["projects", "billing", "documents", "support", "team"].includes(tab) ? tab : "projects";
  document.querySelectorAll("[data-client-tab]").forEach((button) => {
    const active = button.dataset.clientTab === state.activeTab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-client-panel]").forEach((panel) => {
    const active = panel.dataset.clientPanel === state.activeTab;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  });
  const metrics = document.querySelector(".client-project-hub .client-metrics");
  if (metrics) metrics.hidden = state.activeTab !== "projects";
  syncDashboardSectionNavigation();
  const url = new URL(window.location.href);
  url.searchParams.set("projectSection", state.activeTab);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  if (state.activeTab === "support") loadCommunications({ markRead: true, silent: true });
}

function openDashboardSection(section, sourceButton) {
  const projectButton = document.querySelector('[data-tab="project"]');
  if (projectButton && sourceButton !== projectButton) {
    projectButton.click();
  }
  setTab(section);
  window.queueMicrotask(syncDashboardSectionNavigation);
  document.body.classList.remove("is-side-menu-open");
  document.querySelector("[data-side-menu-toggle]")?.setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function syncDashboardSectionNavigation() {
  const projectPanel = document.querySelector('[data-panel="project"]');
  const projectAreaActive = Boolean(projectPanel && !projectPanel.hidden);
  const quickCreate = document.querySelector("[data-quick-create]");
  if (quickCreate) quickCreate.hidden = projectAreaActive;
  document.querySelectorAll("[data-client-section]").forEach((button) => {
    const active = projectAreaActive && button.dataset.clientSection === state.activeTab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-current", active ? "page" : "false");
  });
  if (!projectAreaActive) return;
  const meta = PROJECT_SECTION_META[state.activeTab] || PROJECT_SECTION_META.projects;
  const pageTitle = document.querySelector("[data-page-title]");
  const pageSubtitle = document.querySelector("[data-page-subtitle]");
  if (pageTitle) pageTitle.textContent = meta.title;
  if (pageSubtitle) pageSubtitle.textContent = meta.subtitle;
}

function showAuthState(message = "") {
  if (refs.authState) refs.authState.hidden = false;
  if (refs.refresh) refs.refresh.hidden = true;
  document.querySelectorAll(".client-metrics, .client-tabs, .client-panel").forEach((node) => { node.hidden = true; });
  if (!document.body.classList.contains("is-access-locked")) {
    syncDashboardSectionNavigation();
    window.queueMicrotask(syncDashboardSectionNavigation);
  }
  if (message) showNotice(message, "error");
}

function showPortalState() {
  if (refs.authState) refs.authState.hidden = true;
  if (refs.refresh) refs.refresh.hidden = false;
  document.querySelectorAll(".client-metrics, .client-tabs").forEach((node) => { node.hidden = false; });
  setTab(state.activeTab);
}

function metric(name, value, note = "") {
  const node = document.querySelector(`[data-client-metric="${name}"]`);
  if (node) node.textContent = value;
  const noteNode = document.querySelector(`[data-client-note="${name}"]`);
  if (noteNode && note) noteNode.textContent = note;
}

function showNotice(message, type) {
  if (!refs.notice) return;
  refs.notice.hidden = !message;
  refs.notice.textContent = message;
  refs.notice.dataset.type = type;
}

function setLoading(loading) {
  if (!refs.refresh) return;
  refs.refresh.disabled = loading;
  refs.refresh.textContent = loading ? "Actualizando..." : "Actualizar";
}

async function getJson(path) {
  const response = await fetch(window.LocalLiftApi?.url?.(path) || path, { headers: window.LocalLiftApi?.headers?.() || { Accept: "application/json" }, cache: "no-store" });
  if (!response.ok) { const error = new Error("Request failed"); error.status = response.status; error.path = path; throw error; }
  return response.json();
}

async function postJson(path, body) {
  const response = await fetch(window.LocalLiftApi?.url?.(path) || path, { method: "POST", headers: window.LocalLiftApi?.headers?.({ json: true }) || { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) { const error = new Error("Request failed"); error.status = response.status; throw error; }
  return response.json();
}

async function patchJson(path, body) {
  const response = await fetch(window.LocalLiftApi?.url?.(path) || path, { method: "PATCH", headers: window.LocalLiftApi?.headers?.({ json: true }) || { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) { const error = new Error("Request failed"); error.status = response.status; throw error; }
  return response.json();
}

function empty(title, text = "") { return `<div class="client-empty"><strong>${escapeHtml(title)}</strong>${text ? `<p>${escapeHtml(text)}</p>` : ""}</div>`; }
function portalErrorMessage(error) {
  if ([404, 405].includes(error.status)) return "El backend está desactualizado. Reinicia DLS y vuelve a pulsar Actualizar.";
  if (error.status === 403) return "La sesión no tiene permiso para consultar estos datos.";
  if (String(error.path || "").includes("/projects")) return "No se pudieron cargar los proyectos. Inténtalo de nuevo.";
  if (String(error.path || "").includes("/invoices")) return "No se pudieron cargar las facturas. Inténtalo de nuevo.";
  if (String(error.path || "").includes("/documents")) return "No se pudieron cargar los documentos. Inténtalo de nuevo.";
  if (String(error.path || "").includes("/communications")) return "No se pudo cargar la mensajería. Inténtalo de nuevo.";
  return "No se pudo actualizar el portal. Inténtalo de nuevo.";
}
function money(value, currency = "EUR") { return new Intl.NumberFormat("es-ES", { style: "currency", currency }).format(Number(value || 0)); }
function date(value) { const parsed = new Date(value ? `${String(value).slice(0, 10)}T12:00:00` : ""); return Number.isNaN(parsed.getTime()) ? "Sin fecha" : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(parsed); }
function dateTime(value) { const parsed = new Date(value || ""); return Number.isNaN(parsed.getTime()) ? "Sin fecha" : new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(parsed); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]); }
function escapeAttr(value) { return escapeHtml(value); }
