const refs = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  refs.title = document.querySelector("[data-report-title]");
  refs.subtitle = document.querySelector("[data-report-subtitle]");
  refs.notice = document.querySelector("[data-report-notice]");
  refs.metrics = document.querySelector("[data-report-metrics]");
  refs.funnel = document.querySelector("[data-report-funnel]");
  refs.recommendations = document.querySelector("[data-report-recommendations]");
  refs.activity = document.querySelector("[data-report-activity]");
  refs.dashboardLink = document.querySelector("[data-dashboard-link]");
  document.querySelector("[data-print]")?.addEventListener("click", () => window.print());

  const query = new URLSearchParams(window.location.search);
  const businessId = query.get("business") || query.get("id") || query.get("slug") || "biz_demo_brasa_norte";
  const month = query.get("month") || "";

  if (refs.dashboardLink) {
    const params = new URLSearchParams({ business: businessId });
    const apiBase = window.LocalLiftApi?.getBase?.() || "";

    if (apiBase) {
      params.set("apiBase", apiBase);
    }

    refs.dashboardLink.href = `business-dashboard.html?${params.toString()}`;
  }

  try {
    const url = `/api/businesses/${encodeURIComponent(businessId)}/reports/monthly${month ? `?month=${encodeURIComponent(month)}` : ""}`;
    const payload = await getJson(url);
    renderReport(payload.report);
  } catch (error) {
    showNotice("No se pudo cargar el reporte. Arranca el servidor local y revisa el identificador del negocio.", "error");
  }
}

async function getJson(url) {
  const response = await fetch(apiUrl(url), {
    headers: apiHeaders(),
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

function apiUrl(url) {
  return window.LocalLiftApi?.url(url) || url;
}

function apiHeaders() {
  return window.LocalLiftApi?.headers?.() || { Accept: "application/json" };
}

function renderReport(report) {
  if (!report) {
    showNotice("Reporte no disponible.", "error");
    return;
  }

  const metrics = report.metrics || {};
  const business = report.business || {};

  document.title = `Reporte ${business.name || "DLS"} - ${report.period?.month || ""}`;
  refs.title.textContent = business.name || "Reporte mensual";
  refs.subtitle.textContent = [
    report.period?.month ? `Periodo ${report.period.month}` : "",
    business.category,
    business.city
  ].filter(Boolean).join(" - ");

  refs.metrics.innerHTML = [
    metricCard("Contactos nuevos", metrics.newContacts ?? 0, "Leads captados este mes"),
    metricCard("Reservas", metrics.bookings ?? 0, `${metrics.confirmedBookings ?? 0} confirmadas`),
    metricCard("Recordatorios", metrics.remindersPrepared ?? 0, "Preparados para WhatsApp/email"),
    metricCard("Ingresos", formatMoney(metrics.revenue ?? 0, report.currency), `${metrics.paidOrders ?? 0} pedido(s) pagados`)
  ].join("");

  refs.funnel.innerHTML = renderFunnel(
    report.funnel || [],
    report.topSources || [],
    report.bookingStatus || [],
    report.eventBreakdown || [],
    report.eventSources || []
  );
  refs.recommendations.innerHTML = (report.recommendations || [])
    .map((item) => `
      <article>
        <span>${escapeHtml(statusLabel(item.priority || "media"))}</span>
        <strong>${escapeHtml(item.title || "Recomendacion")}</strong>
        <p>${escapeHtml(item.text || "")}</p>
      </article>
    `)
    .join("");
  refs.activity.innerHTML = (report.recentActivity || []).length
    ? report.recentActivity.map((item) => `
      <article>
        <strong>${escapeHtml(item.title || statusLabel(item.type))}</strong>
        <span>${escapeHtml(formatDateTime(item.createdAt))} - ${escapeHtml(statusLabel(item.source || item.type))}</span>
      </article>
    `).join("")
    : emptyState("Sin actividad registrada en el periodo.");
}

function renderFunnel(funnel, sources, bookingStatus, eventBreakdown, eventSources) {
  return [
    listBlock("Embudo", funnel),
    listBlock("Fuentes", sources.length ? sources : [{ label: "Sin datos", value: 0 }]),
    listBlock("Estado reservas", bookingStatus.length ? bookingStatus.map((item) => ({ ...item, label: statusLabel(item.label) })) : [{ label: "Sin reservas", value: 0 }]),
    listBlock("Conversiones", eventBreakdown.length ? eventBreakdown.map((item) => ({ ...item, label: statusLabel(item.label) })) : [{ label: "Sin eventos", value: 0 }]),
    listBlock("Fuentes de eventos", eventSources.length ? eventSources.map((item) => ({ ...item, label: statusLabel(item.label) })) : [{ label: "Sin eventos", value: 0 }])
  ].join("");
}

function metricCard(label, value, note) {
  return `
    <article class="metric-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      <small>${escapeHtml(note)}</small>
    </article>
  `;
}

function listBlock(title, items) {
  return `
    <article class="list-block">
      <h3>${escapeHtml(title)}</h3>
      <dl>
        ${items.map((item) => `
          <div>
            <dt>${escapeHtml(item.label)}</dt>
            <dd>${escapeHtml(String(item.value))}</dd>
          </div>
        `).join("")}
      </dl>
    </article>
  `;
}

function emptyState(text) {
  return `<p class="empty-state">${escapeHtml(text)}</p>`;
}

function showNotice(message, type) {
  if (!refs.notice) {
    return;
  }

  refs.notice.hidden = !message;
  refs.notice.textContent = message || "";
  refs.notice.dataset.type = type || "info";
}

function formatDateTime(value) {
  const parsed = new Date(value || "");
  return Number.isNaN(parsed.getTime())
    ? "-"
    : parsed.toLocaleString("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatMoney(value, currency) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: Number(value || 0) % 1 === 0 ? 0 : 2
  }).format(Number(value || 0));
}

function statusLabel(value) {
  const labels = {
    alta: "Alta",
    media: "Media",
    baja: "Baja",
    web: "Web",
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
    dashboard: "Dashboard",
    "automatic-dry-run": "Automatico dry-run",
    pending: "Pendiente",
    confirmed: "Confirmada",
    completed: "Completada",
    canceled: "Cancelada"
  };

  return labels[value] || String(value || "Dato").replace(/-/g, " ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
