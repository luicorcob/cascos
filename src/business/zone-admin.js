const root = document.querySelector("[data-zone-admin-root]");
let businessId = "";
let data = null;
let busy = false;

document.addEventListener("dls:business-changed", (event) => {
  const nextId = clean(event.detail?.businessId);
  if (!nextId || nextId === businessId) return;
  businessId = nextId;
  loadZone();
});

root?.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-zone-settings-form]");
  if (!form) return;
  event.preventDefault();
  const values = new FormData(form);
  await mutate(async () => {
    data = await request(`/api/businesses/${encodeURIComponent(businessId)}/zone/settings`, {
      method: "PUT",
      body: JSON.stringify({
        isEnabled: values.get("isEnabled") === "on",
        radiusMeters: Number(values.get("radiusMeters") || 1500),
        excludedBusinessIds: values.getAll("excludedBusinessIds"),
        excludedPoiIds: values.getAll("excludedPoiIds")
      })
    });
  }, "Preferencias guardadas.");
});

root?.addEventListener("click", async (event) => {
  const refresh = event.target.closest("[data-zone-refresh]");
  if (!refresh || busy) return;
  await mutate(async () => {
    await request(`/api/businesses/${encodeURIComponent(businessId)}/zone/refresh`, { method: "POST", body: "{}" });
    data = await request(`/api/businesses/${encodeURIComponent(businessId)}/zone`);
  }, "Zona actualizada desde las fuentes geográficas.");
});

async function loadZone() {
  if (!root || !businessId) return;
  root.innerHTML = `<section class="zone-admin-state"><span class="zone-admin-spinner" aria-hidden="true"></span><strong>Preparando tu zona…</strong><p>Consultando recomendaciones, control y visitas generadas.</p></section>`;
  try {
    data = await request(`/api/businesses/${encodeURIComponent(businessId)}/zone`);
    render();
  } catch (error) {
    root.innerHTML = `<section class="zone-admin-state zone-admin-state-error"><strong>No se pudo cargar Tu zona</strong><p>${escapeHtml(error.message || "Vuelve a intentarlo en unos segundos.")}</p></section>`;
  }
}

async function mutate(action, successMessage) {
  if (busy) return;
  busy = true;
  setFeedback("Guardando…", "info");
  setDisabled(true);
  try {
    await action();
    render();
    setFeedback(successMessage, "success");
  } catch (error) {
    setFeedback(error.message || "No se pudo guardar el cambio.", "error");
  } finally {
    busy = false;
    setDisabled(false);
  }
}

function render() {
  if (!root || !data) return;
  const zone = data.zone || {};
  const settings = zone.settings || {};
  const metrics = data.metrics || {};
  const exclusions = data.exclusions || { businesses: [], pois: [] };
  const received = Number(metrics.visitsReceivedWeek || 0);
  root.innerHTML = `
    <div class="zone-admin-shell">
      <section class="zone-value-card">
        <div>
          <p class="eyebrow">Valor generado por la red</p>
          <h3>Esta semana recibiste ${received} ${received === 1 ? "visita potencial" : "visitas potenciales"} gracias a negocios vecinos en DLS Studio.</h3>
          <p>El módulo conecta tu web con una selección cuidada de lugares cercanos sin mostrar competidores directos.</p>
        </div>
        <span class="zone-status-pill ${settings.isEnabled ? "is-enabled" : ""}">${settings.isEnabled ? "Activo" : "Desactivado"}</span>
      </section>

      <section class="zone-metric-grid" aria-label="Rendimiento de Descubre tu zona">
        ${metric("Aperturas esta semana", metrics.opensWeek, "Interés reciente en la guía")}
        ${metric("Aperturas este mes", metrics.opensMonth, "Uso acumulado del módulo")}
        ${metric("Visitas recibidas", metrics.visitsReceivedMonth, "Desde webs DLS este mes")}
      </section>

      <form class="zone-settings-card" data-zone-settings-form>
        <header>
          <div><p class="eyebrow">Control del negocio</p><h3>Descubre ${escapeHtml(zone.zone || "tu zona")}</h3><p>La activación siempre es voluntaria. Puedes ocultar cualquier conexión sin justificar el motivo.</p></div>
          <label class="zone-toggle">
            <input type="checkbox" name="isEnabled"${settings.isEnabled ? " checked" : ""}>
            <span aria-hidden="true"></span>
            <strong>Activar Descubre tu zona</strong>
          </label>
        </header>

        <div class="zone-settings-row">
          <label>Radio de búsqueda
            <span><input type="range" name="radiusMeters" min="250" max="10000" step="250" value="${escapeAttr(String(settings.radiusMeters || 1500))}" data-zone-radius> <output data-zone-radius-output>${formatDistance(settings.radiusMeters || 1500)}</output></span>
          </label>
          <div class="zone-preview-summary">
            <strong>${Number(zone.total || 0)} recomendaciones disponibles</strong>
            <small>${zone.available ? "La experiencia pública supera el mínimo de calidad." : "El CTA seguirá oculto hasta disponer de 3 lugares."}</small>
          </div>
        </div>

        <div class="zone-exclusion-grid">
          ${exclusionGroup("Negocios conectados", "Oculta conexiones concretas", "excludedBusinessIds", exclusions.businesses, "business")}
          ${exclusionGroup("Lugares de interés", "Decide con qué lugares se asocia tu marca", "excludedPoiIds", exclusions.pois, "poi")}
        </div>

        <footer>
          <p data-zone-feedback role="status"></p>
          <div><button class="zone-secondary-action" type="button" data-zone-refresh>Actualizar zona</button><button class="zone-primary-action" type="submit">Guardar preferencias</button></div>
        </footer>
      </form>
    </div>`;
  const radius = root.querySelector("[data-zone-radius]");
  const output = root.querySelector("[data-zone-radius-output]");
  radius?.addEventListener("input", () => { output.textContent = formatDistance(radius.value); });
}

function exclusionGroup(title, subtitle, inputName, items, kind) {
  return `
    <details class="zone-exclusion-card">
      <summary><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(subtitle)}</small></span><b>${items.filter((item) => item.excluded).length} ocultos</b></summary>
      <div class="zone-exclusion-list">
        ${items.length ? items.map((item) => `
          <label>
            <input type="checkbox" name="${inputName}" value="${escapeAttr(item.id)}"${item.excluded ? " checked" : ""}>
            <span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.category)} · ${formatDistance(item.distanceMeters)}</small></span>
            <em>${kind === "business" && item.connectionType === "competidor" ? "Competidor · ya excluido" : "Ocultar"}</em>
          </label>`).join("") : `<p>No hay opciones dentro del radio actual.</p>`}
      </div>
    </details>`;
}

function metric(label, value, note) {
  return `<article><span>${escapeHtml(label)}</span><strong>${Number(value || 0)}</strong><small>${escapeHtml(note)}</small></article>`;
}

async function request(path, options = {}) {
  const response = await fetch(window.LocalLiftApi?.url?.(path) || path, {
    ...options,
    headers: {
      ...(window.LocalLiftApi?.headers?.({ json: Boolean(options.body) }) || { Accept: "application/json" }),
      ...(options.headers || {})
    },
    cache: options.method ? "no-store" : "no-store"
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Error ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function setFeedback(message, tone) {
  const node = root?.querySelector("[data-zone-feedback]");
  if (!node) return;
  node.textContent = message;
  node.dataset.tone = tone;
}
function setDisabled(disabled) { root?.querySelectorAll("button, input").forEach((node) => { node.disabled = disabled; }); }
function formatDistance(value) { const meters = Number(value || 0); return meters >= 1000 ? `${(meters / 1000).toLocaleString("es-ES", { maximumFractionDigits: 2 })} km` : `${Math.round(meters)} m`; }
function clean(value) { return String(value ?? "").trim(); }
function escapeHtml(value) { return clean(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]); }
function escapeAttr(value) { return escapeHtml(value); }
