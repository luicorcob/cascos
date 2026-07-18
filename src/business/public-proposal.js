const app = document.querySelector("[data-quote-app]");
const params = new URLSearchParams(window.location.search);
const token = params.get("quote") || "";
let payload = null;

boot();

async function boot() {
  if (!token) return renderError("Enlace incompleto", "Falta el identificador seguro de la propuesta.");
  try {
    payload = await request(`/api/public/quotes/${encodeURIComponent(token)}`);
    render();
  } catch (error) {
    renderError(error.status === 410 ? "Propuesta caducada" : "Enlace no disponible", error.message || "Solicita un enlace nuevo al negocio.");
  }
}

function render() {
  const proposal = payload.proposal || {};
  const business = payload.business || {};
  const customer = payload.customer || {};
  const invoice = payload.invoice;
  const schedule = Array.isArray(payload.paymentSchedule) ? payload.paymentSchedule : [];
  const decisions = Array.isArray(payload.decisions) ? payload.decisions : [];
  const finalDecision = decisions.find((item) => ["accepted", "rejected"].includes(item.decision));
  const accepted = proposal.status === "aceptada";
  const paid = invoice?.status === "paid";
  const paymentMessage = params.get("payment") === "success" ? '<p class="quote-notice is-success">Pago iniciado correctamente. El estado se actualizara al confirmarlo el proveedor.</p>' : params.get("payment") === "cancelled" ? '<p class="quote-notice">El pago se cancelo sin realizar cargos.</p>' : "";
  document.title = `${proposal.title || "Propuesta"} · ${business.name || "DLS"}`;
  app.innerHTML = `
    <header class="quote-brand"><div class="quote-brand-mark">${escapeHtml(initials(business.name || "DLS"))}</div><div><strong>${escapeHtml(business.name || "Propuesta digital")}</strong><small>Documento seguro y versionado</small></div><span class="quote-status status-${escapeAttr(statusKey(proposal.status, paid))}">${escapeHtml(statusLabel(proposal.status, paid))}</span></header>
    ${paymentMessage}
    <section class="quote-hero">
      <div><p class="eyebrow">Propuesta v${escapeHtml(String(proposal.revision || 1))}</p><h1>${escapeHtml(proposal.title || "Propuesta personalizada")}</h1><p>Preparada para ${escapeHtml(customer.name || "cliente")}${customer.company ? ` · ${escapeHtml(customer.company)}` : ""}</p></div>
      <dl><div><dt>Total inicial</dt><dd>${money(proposal.total, proposal.currency)}</dd></div><div><dt>Valida hasta</dt><dd>${date(proposal.expiresAt)}</dd></div><div><dt>Identidad</dt><dd>Hash y version registrados</dd></div></dl>
    </section>
    <section class="quote-card quote-lines"><header><div><p class="eyebrow">Alcance economico</p><h2>Servicios incluidos</h2></div><span>${escapeHtml(String(proposal.lineItems?.length || 0))} linea(s)</span></header>${renderLineItems(proposal)}</section>
    <section class="quote-grid">
      <article class="quote-card quote-conditions"><p class="eyebrow">Condiciones</p><h2>Alcance y compromisos</h2><p>${escapeHtml(proposal.conditions || "Sin condiciones adicionales.")}</p><dl><div><dt>Firma</dt><dd>${proposal.signatureRequired ? "Obligatoria para aceptar" : "Opcional"}</dd></div><div><dt>Señal</dt><dd>${proposal.deposit?.amount ? money(proposal.deposit.amount, proposal.currency) : "Sin señal"}</dd></div><div><dt>Version</dt><dd>v${escapeHtml(String(proposal.revision || 1))}</dd></div></dl></article>
      <article class="quote-card quote-activity"><p class="eyebrow">Conversacion</p><h2>Comentarios</h2>${renderComments(payload.comments)}${!finalDecision ? `<form data-quote-comment-form><label>Tu nombre<input name="authorName" value="${escapeAttr(customer.name || "")}" required maxlength="160"></label><label>Email<input name="authorEmail" type="email" value="${escapeAttr(customer.email || "")}" maxlength="320"></label><label>Comentario<textarea name="message" required maxlength="4000" rows="3" placeholder="Pregunta o solicita un cambio"></textarea></label><button type="submit">Enviar comentario</button></form>` : ""}</article>
    </section>
    ${finalDecision ? renderDecision(finalDecision, proposal) : renderDecisionForm(proposal, customer)}
    ${accepted ? renderPaymentCenter(invoice, schedule, proposal, paid) : ""}
    <footer class="quote-footer"><span>Enlace privado · No lo compartas fuera de tu equipo</span><span>${escapeHtml(business.email || business.phone || "")}</span></footer>
  `;
  bind();
}

function renderLineItems(proposal) {
  const items = Array.isArray(proposal.lineItems) ? proposal.lineItems : [];
  return `<div class="quote-table-wrap"><table><thead><tr><th>Concepto</th><th>Cantidad</th><th>Precio</th><th>Descuento</th><th>Impuesto</th><th>Total</th></tr></thead><tbody>${items.map((item) => `<tr><td><strong>${escapeHtml(item.description)}</strong><small>${item.billing === "recurring" ? "Recurrente mensual" : "Pago unico"}</small></td><td>${escapeHtml(String(item.quantity))}</td><td>${money(item.unitPrice, proposal.currency)}</td><td>${escapeHtml(String(item.discountPercent || 0))}%</td><td>${escapeHtml(String(item.taxRate || 0))}%</td><td>${money(item.total, proposal.currency)}</td></tr>`).join("")}</tbody></table></div><dl class="quote-totals"><div><dt>Subtotal</dt><dd>${money(proposal.subtotal, proposal.currency)}</dd></div><div><dt>Descuentos</dt><dd>-${money(proposal.discountAmount, proposal.currency)}</dd></div><div><dt>Impuestos</dt><dd>${money(proposal.taxAmount, proposal.currency)}</dd></div><div class="is-total"><dt>Total</dt><dd>${money(proposal.total, proposal.currency)}</dd></div>${proposal.recurringTotal ? `<div><dt>Incluye recurrencia</dt><dd>${money(proposal.recurringTotal, proposal.currency)}/mes</dd></div>` : ""}</dl>`;
}

function renderComments(comments) { const items = Array.isArray(comments) ? comments : []; return items.length ? `<ol class="quote-comments">${items.map((item) => `<li><span><strong>${escapeHtml(item.authorName)}</strong><time>${dateTime(item.createdAt)}</time></span><p>${escapeHtml(item.message)}</p></li>`).join("")}</ol>` : '<p class="quote-empty">Aun no hay comentarios.</p>'; }

function renderDecisionForm(proposal, customer) {
  if (["caducada", "rechazada"].includes(proposal.status)) return `<section class="quote-card quote-final"><h2>${proposal.status === "caducada" ? "Esta propuesta ha caducado" : "Propuesta rechazada"}</h2><p>Contacta con el negocio si necesitas una nueva version.</p></section>`;
  return `<section class="quote-card quote-decision"><div><p class="eyebrow">Cierre verificable</p><h2>Aceptar, firmar o solicitar cambios</h2><p>La decision queda vinculada a esta version exacta, junto con fecha y evidencia tecnica.</p></div><form data-quote-decision-form><label>Nombre del firmante<input name="signerName" value="${escapeAttr(customer.name || "")}" required maxlength="160"></label><label>Email<input name="signerEmail" type="email" value="${escapeAttr(customer.email || "")}" maxlength="320"></label><label class="quote-signature">Firma escrita<input name="signatureValue" placeholder="Escribe tu nombre completo" ${proposal.signatureRequired ? "required" : ""} maxlength="500"><small>Actua como firma electronica simple vinculada a esta version.</small></label><label class="quote-terms"><input name="acceptedTerms" type="checkbox" required><span>He revisado el alcance, precios, impuestos, calendario y condiciones de esta propuesta.</span></label><label class="quote-note">Nota opcional<textarea name="note" rows="2" maxlength="2000"></textarea></label><div class="quote-decision-actions"><button type="submit" name="decision" value="accepted">Aceptar y firmar</button><button type="submit" name="decision" value="changes_requested">Solicitar cambios</button><button type="submit" name="decision" value="rejected" class="is-danger">Rechazar</button></div></form></section>`;
}

function renderDecision(decision, proposal) { const accepted = decision.decision === "accepted"; return `<section class="quote-card quote-final ${accepted ? "is-accepted" : "is-rejected"}"><span aria-hidden="true">${accepted ? "✓" : "×"}</span><div><p class="eyebrow">Decision registrada</p><h2>${accepted ? "Propuesta aceptada y firmada" : "Propuesta rechazada"}</h2><p>${escapeHtml(decision.signerName)} · ${dateTime(decision.occurredAt)}</p><small>Evidencia ${escapeHtml((decision.evidenceHash || "").slice(0, 18))}… · version ${escapeHtml(String(proposal.revision || 1))}</small></div></section>`; }

function renderPaymentCenter(invoice, schedule, proposal, paid) {
  if (!invoice) return '<section class="quote-card quote-payment"><h2>Preparando factura y calendario</h2><p>Actualiza la pagina en unos instantes.</p></section>';
  const next = schedule.find((item) => item.status === "pending");
  return `<section class="quote-card quote-payment"><header><div><p class="eyebrow">Pago seguro</p><h2>${paid ? "Contrato pagado" : "Factura y calendario de pagos"}</h2></div><span class="quote-status status-${paid ? "paid" : "accepted"}">${paid ? "Pagado" : money(invoice.balance, invoice.currency) + " pendiente"}</span></header><div class="quote-payment-grid"><dl><div><dt>Factura</dt><dd>${escapeHtml(invoice.number || invoice.id)}</dd></div><div><dt>Total</dt><dd>${money(invoice.total, invoice.currency)}</dd></div><div><dt>Pagado</dt><dd>${money(invoice.paidAmount, invoice.currency)}</dd></div><div><dt>Pendiente</dt><dd>${money(invoice.balance, invoice.currency)}</dd></div></dl><ol>${schedule.map((item) => `<li class="is-${escapeAttr(item.status)}"><span>${item.status === "paid" ? "✓" : item.order}</span><div><strong>${escapeHtml(item.label)}</strong><small>${dateTime(item.dueAt)}</small></div><b>${money(item.amount, item.currency)}</b></li>`).join("")}</ol></div>${next && !paid ? `<button type="button" class="quote-pay-button" data-quote-checkout data-schedule-id="${escapeAttr(next.id)}">Pagar ${money(next.amount, next.currency)} de forma segura</button>` : '<p class="quote-paid-message">Todos los pagos previstos estan confirmados.</p>'}</section>`;
}

function bind() {
  document.querySelector("[data-quote-comment-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setBusy(form, true);
    try { const result = await request(`/api/public/quotes/${encodeURIComponent(token)}/comments`, { method: "POST", body: { authorName: data.get("authorName"), authorEmail: data.get("authorEmail"), message: data.get("message") } }); payload = result.proposal; render(); } catch (error) { notice(form, error.message); setBusy(form, false); }
  });
  document.querySelector("[data-quote-decision-form]")?.addEventListener("submit", async (event) => {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); const submitter = event.submitter; setBusy(form, true);
    try { const result = await request(`/api/public/quotes/${encodeURIComponent(token)}/decision`, { method: "POST", body: { decision: submitter?.value || "accepted", signerName: data.get("signerName"), signerEmail: data.get("signerEmail"), signatureType: data.get("signatureValue") ? "typed" : "none", signatureValue: data.get("signatureValue"), acceptedTerms: data.get("acceptedTerms") === "on", note: data.get("note"), idempotencyKey: `public-${payload.proposal.id}-${payload.proposal.revision}-${submitter?.value || "accepted"}` } }); payload = result.proposal; render(); } catch (error) { notice(form, error.message); setBusy(form, false); }
  });
  document.querySelector("[data-quote-checkout]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget; button.disabled = true; button.textContent = "Preparando pago seguro...";
    try { const result = await request(`/api/public/quotes/${encodeURIComponent(token)}/checkout`, { method: "POST", body: { scheduleId: button.dataset.scheduleId, idempotencyKey: `public-checkout-${payload.proposal.id}-${button.dataset.scheduleId}` } }); window.location.assign(result.checkout.checkoutUrl); } catch (error) { button.disabled = false; button.textContent = error.message || "No se pudo iniciar el pago"; }
  });
}

async function request(pathname, options = {}) { const response = await fetch(pathname, { method: options.method || "GET", headers: options.body ? { "Content-Type": "application/json" } : {}, body: options.body ? JSON.stringify(options.body) : undefined, cache: "no-store" }); const text = await response.text(); const data = text ? JSON.parse(text) : {}; if (!response.ok) { const error = new Error(data.error || `Error ${response.status}`); error.status = response.status; throw error; } return data; }
function setBusy(form, busy) { form.querySelectorAll("button,input,textarea,select").forEach((node) => { node.disabled = busy; }); }
function notice(form, message) { let node = form.querySelector("[data-form-error]"); if (!node) { node = document.createElement("p"); node.dataset.formError = ""; node.className = "quote-form-error"; form.append(node); } node.textContent = message; }
function renderError(title, message) { app.innerHTML = `<section class="quote-error"><span>!</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p></section>`; }
function statusKey(status, paid) { if (paid) return "paid"; return ({ borrador: "draft", enviada: "sent", vista: "viewed", aceptada: "accepted", rechazada: "rejected", caducada: "expired" })[status] || "draft"; }
function statusLabel(status, paid) { if (paid) return "Pagada"; return ({ borrador: "Borrador", enviada: "Enviada", vista: "Vista", aceptada: "Aceptada", rechazada: "Rechazada", caducada: "Caducada" })[status] || status || "Propuesta"; }
function money(value, currency = "EUR") { return new Intl.NumberFormat("es-ES", { style: "currency", currency: currency || "EUR" }).format(Number(value || 0)); }
function date(value) { const parsed = new Date(value || ""); return Number.isNaN(parsed.getTime()) ? "-" : new Intl.DateTimeFormat("es-ES", { dateStyle: "medium" }).format(parsed); }
function dateTime(value) { const parsed = new Date(value || ""); return Number.isNaN(parsed.getTime()) ? "-" : new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(parsed); }
function initials(value) { return String(value || "DLS").split(/\s+/).filter(Boolean).slice(0, 2).map((item) => item[0]).join("").toUpperCase(); }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]); }
function escapeAttr(value) { return escapeHtml(value).replace(/'/g, "&#39;"); }
