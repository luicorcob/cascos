const state = {
  businessId: "",
  businessName: "",
  summary: null,
  invoices: [],
  expenses: [],
  suppliers: [],
  employees: [],
  shifts: [],
  inventory: [],
  financeView: "invoices",
  financeSearch: "",
  teamSearch: "",
  inventorySearch: "",
  inventoryCategory: "",
  stockFilter: "all",
  scheduleWeekOffset: 0,
  loading: false,
  requestSequence: 0,
  entityContext: null
};

const refs = {};
const ICONS = Object.freeze({
  home: '<path d="M3 10.8 12 3l9 7.8"/><path d="M5.7 9.5V21h12.6V9.5"/><path d="M9.5 21v-6.5h5V21"/>',
  check: '<path d="M9 11.5 11.2 14 16 8.5"/><rect x="3.5" y="3.5" width="17" height="17" rx="5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M8 3v4M16 3v4M3 10h18"/>',
  bookings: '<path d="M4 4h16v15H4zM8 2v4M16 2v4M4 9h16"/><path d="m8 14 2 2 5-5"/>',
  customers: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  leads: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  proposal: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
  messages: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/>',
  document: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/>',
  support: '<path d="M4 13a8 8 0 0 1 16 0"/><path d="M4 13v5h3v-6H4M20 13v5h-3v-6h3M17 19c-1 2-3 2-5 2"/>',
  finance: '<rect x="3" y="5" width="18" height="15" rx="3"/><path d="M3 10h18M7 15h3"/>',
  expense: '<path d="M12 2v20M17 6.5h-7.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  team: '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M17 11a4 4 0 0 0 0-8M23 21v-2a4 4 0 0 0-3-3.7"/>',
  inventory: '<path d="m3 7 9-4 9 4-9 4-9-4Z"/><path d="M3 7v10l9 4 9-4V7M12 11v10"/>',
  orders: '<path d="M6 3h12l2 18H4L6 3Z"/><path d="M9 8a3 3 0 0 0 6 0"/>',
  reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  google: '<circle cx="12" cy="12" r="9"/><path d="M21 12h-9M15.5 8.5 12 12l3.5 3.5"/>',
  project: '<path d="M4 5h6l2 2h8v12H4z"/><path d="M8 12h8M8 15h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M10.3 3.8 2 18.5A2 2 0 0 0 3.7 21h16.6a2 2 0 0 0 1.7-2.5L13.7 3.8a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M8.2 15.2A7 7 0 1 1 15.8 15c-1 .7-1.3 1.4-1.3 3h-5c0-1.6-.3-2.3-1.3-2.8Z"/>',
  empty: '<path d="M4 5h16v14H4zM8 9h8M8 13h5"/>'
});

const ROLE_LABELS = Object.freeze({
  owner: "Propietario/a",
  manager: "Encargado/a",
  chef: "Chef",
  kitchen: "Cocina",
  waiter: "Camarero/a",
  bartender: "Barra",
  delivery: "Reparto",
  admin: "Administración"
});
const ACCESS_LABELS = Object.freeze({ owner: "Acceso total", manager: "Gestión", employee: "Empleado", restricted: "Acceso limitado" });
const AREA_LABELS = Object.freeze({ kitchen: "Cocina", floor: "Sala", bar: "Barra", delivery: "Reparto", admin: "Gestión" });
const EXPENSE_CATEGORY_LABELS = Object.freeze({ food: "Alimentación", drinks: "Bebidas", supplies: "Consumibles", rent: "Alquiler", utilities: "Suministros", staff: "Personal", marketing: "Marketing", maintenance: "Mantenimiento", taxes: "Impuestos", other: "Otros" });
const UNIT_LABELS = Object.freeze({ units: "ud.", kg: "kg", g: "g", l: "l", ml: "ml", boxes: "cajas", bottles: "botellas" });
const STATUS_LABELS = Object.freeze({ draft: "Borrador", sent: "Enviada", paid: "Pagada", overdue: "Vencida", cancelled: "Cancelada", pending: "Pendiente", scheduled: "Planificado", confirmed: "Confirmado", completed: "Completado", absent: "Ausente", active: "Activo" });
const MONTH_LABELS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

document.addEventListener("DOMContentLoaded", init);

function init() {
  if (document.body.classList.contains("is-access-locked")) {
    return;
  }
  collectRefs();
  installIcons();
  bindNavigation();
  bindDialogs();
  bindFinance();
  bindTeam();
  bindInventory();
  bindQuickActions();
  observeDashboard();
  updateNavigation(activeTab());
  renderAll();

  document.addEventListener("dls:business-changed", (event) => {
    state.businessId = clean(event.detail?.businessId);
    state.businessName = clean(event.detail?.businessName);
    updateNavigation(activeTab());
    loadHospitalityData();
  });
}

function collectRefs() {
  refs.sideToggle = document.querySelector("[data-side-menu-toggle]");
  refs.navigation = document.querySelector("[data-side-navigation]");
  refs.title = document.querySelector("[data-page-title]");
  refs.subtitle = document.querySelector("[data-page-subtitle]");
  refs.quickCreate = document.querySelector("[data-quick-create]");
  refs.quickDialog = document.querySelector("[data-quick-create-dialog]");
  refs.entityDialog = document.querySelector("[data-entity-dialog]");
  refs.entityForm = document.querySelector("[data-entity-form]");
  refs.entityKicker = document.querySelector("[data-entity-kicker]");
  refs.entityTitle = document.querySelector("[data-entity-title]");
  refs.entityDescription = document.querySelector("[data-entity-description]");
  refs.entityFields = document.querySelector("[data-entity-fields]");
  refs.entitySubmit = document.querySelector("[data-entity-submit]");
  refs.helpDialog = document.querySelector("[data-help-dialog]");
  refs.toastRegion = document.querySelector("[data-toast-region]");
  refs.financeNotice = document.querySelector("[data-finance-notice]");
  refs.teamNotice = document.querySelector("[data-team-notice]");
  refs.inventoryNotice = document.querySelector("[data-inventory-notice]");
  refs.cashflowChart = document.querySelector("[data-cashflow-chart]");
  refs.scheduleGrid = document.querySelector("[data-schedule-grid]");
  refs.scheduleRange = document.querySelector("[data-schedule-range]");
  refs.peopleGrid = document.querySelector("[data-people-grid]");
  refs.inventoryTable = document.querySelector("[data-inventory-table]");
  refs.inventoryCategory = document.querySelector("[data-inventory-category]");
}

function bindNavigation() {
  refs.sideToggle?.addEventListener("click", () => {
    const open = !document.body.classList.contains("is-side-menu-open");
    document.body.classList.toggle("is-side-menu-open", open);
    refs.sideToggle.setAttribute("aria-expanded", String(open));
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      updateNavigation(button.dataset.tab);
      closeSideMenu();
    });
  });

  document.querySelectorAll("[data-go-tab]").forEach((button) => {
    button.addEventListener("click", () => goToTab(button.dataset.goTab));
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 900) closeSideMenu();
  });
}

function bindDialogs() {
  refs.quickCreate?.addEventListener("click", () => {
    const contextualAction = clean(refs.quickCreate?.dataset.contextAction);
    if (contextualAction) handleQuickAction(contextualAction);
    else openDialog(refs.quickDialog);
  });
  document.querySelector("[data-help-open]")?.addEventListener("click", () => openDialog(refs.helpDialog));
  document.querySelectorAll("[data-dialog-close]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog")?.close());
  });
  [refs.quickDialog, refs.entityDialog, refs.helpDialog].forEach((dialog) => {
    dialog?.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
  refs.entityForm?.addEventListener("submit", submitEntityForm);
  document.querySelectorAll("[data-open-form]").forEach((button) => {
    button.addEventListener("click", () => openEntityForm(button.dataset.openForm));
  });
}

function bindQuickActions() {
  document.querySelectorAll("[data-quick-action]").forEach((button) => {
    button.addEventListener("click", () => handleQuickAction(button.dataset.quickAction));
  });
}

function bindFinance() {
  document.querySelectorAll("[data-finance-view]").forEach((button) => {
    button.addEventListener("click", () => setFinanceView(button.dataset.financeView));
  });
  document.querySelector("[data-finance-search]")?.addEventListener("input", (event) => {
    state.financeSearch = clean(event.target.value).toLowerCase();
    renderFinanceRecords();
  });
  document.querySelector("[data-finance-context-action]")?.addEventListener("click", () => {
    openEntityForm(state.financeView === "suppliers" ? "supplier" : state.financeView === "invoices" ? "invoice" : "expense");
  });
  document.querySelector("[data-export-finance]")?.addEventListener("click", exportFinanceCsv);
  document.querySelector("[data-panel=\"finance\"]")?.addEventListener("click", handleFinanceAction);
}

function bindTeam() {
  document.querySelectorAll("[data-week-direction]").forEach((button) => {
    button.addEventListener("click", () => {
      state.scheduleWeekOffset += Number(button.dataset.weekDirection || 0);
      renderSchedule();
    });
  });
  document.querySelector("[data-week-today]")?.addEventListener("click", () => {
    state.scheduleWeekOffset = 0;
    renderSchedule();
  });
  document.querySelector("[data-team-search]")?.addEventListener("input", (event) => {
    state.teamSearch = clean(event.target.value).toLowerCase();
    renderPeople();
  });
  document.querySelector("[data-panel=\"team\"]")?.addEventListener("click", handleTeamAction);
}

function bindInventory() {
  document.querySelectorAll("[data-stock-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.stockFilter = button.dataset.stockFilter;
      document.querySelectorAll("[data-stock-filter]").forEach((item) => item.classList.toggle("is-active", item === button));
      renderInventoryTable();
    });
  });
  document.querySelector("[data-inventory-search]")?.addEventListener("input", (event) => {
    state.inventorySearch = clean(event.target.value).toLowerCase();
    renderInventoryTable();
  });
  refs.inventoryCategory?.addEventListener("change", (event) => {
    state.inventoryCategory = event.target.value;
    renderInventoryTable();
  });
  document.querySelector("[data-inventory-count]")?.addEventListener("click", () => {
    if (!state.inventory.length) openEntityForm("inventory");
    else {
      showToast("Usa “Editar” junto a cada producto para ajustar su cantidad.");
      refs.inventoryTable?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
  document.querySelector("[data-panel=\"inventory\"]")?.addEventListener("click", handleInventoryAction);
}

function observeDashboard() {
  const metricGrid = document.querySelector(".metric-grid");
  if (!metricGrid) return;
  const observer = new MutationObserver(() => updateHomeOverview());
  observer.observe(metricGrid, { childList: true, subtree: true, characterData: true });
}

async function loadHospitalityData() {
  if (!state.businessId) return;
  state.loading = true;
  const sequence = ++state.requestSequence;
  setModuleLoading(true);

  try {
    const base = `/api/businesses/${encodeURIComponent(state.businessId)}/hospitality`;
    const [summary, invoices, expenses, suppliers, employees, shifts, inventory] = await Promise.all([
      apiRequest(`${base}/summary`),
      apiRequest(`${base}/invoices`),
      apiRequest(`${base}/expenses`),
      apiRequest(`${base}/suppliers?active=true`),
      apiRequest(`${base}/employees?active=true`),
      apiRequest(`${base}/shifts`),
      apiRequest(`${base}/inventory?active=true`)
    ]);
    if (sequence !== state.requestSequence) return;
    state.summary = summary;
    state.invoices = arrayPayload(invoices, "hospitalityInvoices");
    state.expenses = arrayPayload(expenses, "hospitalityExpenses");
    state.suppliers = arrayPayload(suppliers, "hospitalitySuppliers");
    state.employees = arrayPayload(employees, "hospitalityEmployees");
    state.shifts = arrayPayload(shifts, "hospitalityShifts");
    state.inventory = arrayPayload(inventory, "hospitalityInventory");
    clearModuleNotices();
    renderAll();
  } catch (error) {
    if (sequence !== state.requestSequence) return;
    const message = error.status === 401
      ? "Necesitas acceso de gestión para consultar estos datos."
      : "No se pudieron cargar los datos de gestión. El resto del panel sigue disponible.";
    showModuleNotice(refs.financeNotice, message, "error");
    showModuleNotice(refs.teamNotice, message, "error");
    showModuleNotice(refs.inventoryNotice, message, "error");
  } finally {
    if (sequence === state.requestSequence) {
      state.loading = false;
      setModuleLoading(false);
    }
  }
}

function renderAll() {
  renderFinance();
  renderTeam();
  renderInventory();
  updateHomeOverview();
}

function renderFinance() {
  const finance = state.summary?.finance || {};
  setText('[data-finance-kpi="income"]', formatMoney(finance.income));
  setText('[data-finance-kpi="expenses"]', formatMoney(finance.expenses));
  setText('[data-finance-kpi="profit"]', formatMoney(finance.profit));
  setText('[data-finance-kpi="pending"]', formatMoney(finance.outstanding));
  setText('[data-finance-note="income"]', finance.invoiceCount ? `${finance.invoiceCount} ${plural(finance.invoiceCount, "factura", "facturas")} emitidas` : "Sin facturas este mes");
  setText('[data-finance-note="expenses"]', finance.expenseCount ? `${finance.expenseCount} ${plural(finance.expenseCount, "gasto", "gastos")} registrados` : "Sin gastos registrados");
  setText('[data-finance-note="profit"]', Number(finance.profit || 0) >= 0 ? "Resultado positivo antes de ajustes" : "Los gastos superan lo facturado");
  setText('[data-finance-note="pending"]', Number(finance.outstanding || 0) > 0 ? "Revisa las facturas sin cobrar" : "Todo cobrado");
  setText('[data-record-count="invoices"]', state.invoices.length);
  setText('[data-record-count="expenses"]', state.expenses.length);
  setText('[data-record-count="suppliers"]', state.suppliers.length);
  renderCashflow(finance.monthlySeries || []);
  renderFinanceChecklist(finance);
  renderFinanceRecords();
}

function renderCashflow(series) {
  if (!refs.cashflowChart) return;
  const rows = series.length ? series : lastSixMonthKeys().map((month) => ({ month, income: 0, expenses: 0 }));
  const max = Math.max(1, ...rows.flatMap((row) => [Number(row.income || 0), Number(row.expenses || 0)]));
  refs.cashflowChart.innerHTML = rows.map((row) => {
    const monthIndex = Number(String(row.month).slice(5, 7)) - 1;
    return `<div class="cashflow-month" title="${escapeAttr(formatMoney(row.income))} facturados · ${escapeAttr(formatMoney(row.expenses))} en gastos">
      <i class="cashflow-bar is-income" style="--bar-height:${Math.max(2, Number(row.income || 0) / max * 100)}%"></i>
      <i class="cashflow-bar is-expense" style="--bar-height:${Math.max(2, Number(row.expenses || 0) / max * 100)}%"></i>
      <span>${MONTH_LABELS[monthIndex] || "—"}</span>
    </div>`;
  }).join("");
}

function renderFinanceChecklist(finance) {
  document.querySelector('[data-check="invoices"]')?.classList.toggle("is-done", Number(finance.invoiceCount || 0) > 0);
  document.querySelector('[data-check="expenses"]')?.classList.toggle("is-done", Number(finance.expenseCount || 0) > 0);
  document.querySelector('[data-check="pending"]')?.classList.toggle("is-done", Number(finance.outstanding || 0) === 0);
}

function setFinanceView(view) {
  state.financeView = view;
  document.querySelectorAll("[data-finance-view]").forEach((button) => {
    const active = button.dataset.financeView === view;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-finance-records]").forEach((panel) => {
    const active = panel.dataset.financeRecords === view;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
  const action = document.querySelector("[data-finance-context-action]");
  if (action) action.innerHTML = `<span aria-hidden="true">+</span> ${view === "invoices" ? "Nueva factura" : view === "expenses" ? "Añadir gasto" : "Añadir proveedor"}`;
  renderFinanceRecords();
}

function renderFinanceRecords() {
  const invoiceContainer = document.querySelector('[data-finance-records="invoices"]');
  const expenseContainer = document.querySelector('[data-finance-records="expenses"]');
  const supplierContainer = document.querySelector('[data-finance-records="suppliers"]');
  if (!invoiceContainer || !expenseContainer || !supplierContainer) return;

  const invoices = filterSearch(state.invoices, ["number", "customerName", "concept", "status"], state.financeSearch);
  invoiceContainer.innerHTML = invoices.length ? `<table class="data-table"><thead><tr><th>Factura</th><th>Cliente</th><th>Fecha</th><th>Estado</th><th>Total</th><th></th></tr></thead><tbody>${invoices.map((invoice) => `<tr>
    <td><strong>${escapeHtml(invoice.number || "—")}</strong><small>${escapeHtml(invoice.concept || "Sin concepto")}</small></td>
    <td><strong>${escapeHtml(invoice.customerName || "Cliente")}</strong><small>${escapeHtml(invoice.customerTaxId || "Sin NIF/CIF")}</small></td>
    <td>${formatDate(invoice.issueDate)}<small>Vence ${formatDate(invoice.dueDate)}</small></td>
    <td>${statusPill(invoiceStatus(invoice), invoiceStatus(invoice))}</td>
    <td class="amount-cell">${formatMoney(invoice.total)}</td>
    <td><button class="table-action" type="button" data-edit-invoice="${escapeAttr(invoice.id)}">Editar</button>${!["paid", "cancelled"].includes(invoice.status) ? ` <button class="table-action" type="button" data-pay-invoice="${escapeAttr(invoice.id)}">Marcar cobrada</button>` : ""}</td>
  </tr>`).join("")}</tbody></table>` : emptyState("finance", "Todavía no hay facturas", "Crea la primera cuando factures un evento, grupo o servicio.", "Crear factura");

  const expenses = filterSearch(state.expenses, ["concept", "supplierName", "category", "status"], state.financeSearch);
  expenseContainer.innerHTML = expenses.length ? `<table class="data-table"><thead><tr><th>Gasto</th><th>Proveedor</th><th>Fecha</th><th>Categoría</th><th>Estado</th><th>Total</th><th></th></tr></thead><tbody>${expenses.map((expense) => `<tr>
    <td><strong>${escapeHtml(expense.concept)}</strong><small>${expense.deductible ? "Marcado como deducible" : "No deducible"}</small></td>
    <td>${escapeHtml(expense.supplierName || "Sin proveedor")}</td>
    <td>${formatDate(expense.date)}</td>
    <td>${escapeHtml(EXPENSE_CATEGORY_LABELS[expense.category] || expense.category)}</td>
    <td>${statusPill(expense.status, expense.status)}</td>
    <td class="amount-cell">${formatMoney(expense.total)}</td>
    <td><button class="table-action" type="button" data-edit-expense="${escapeAttr(expense.id)}">Editar</button></td>
  </tr>`).join("")}</tbody></table>` : emptyState("expense", "Todavía no hay gastos", "Registra tickets, compras y recibos para conocer el resultado real.", "Añadir gasto");

  const suppliers = filterSearch(state.suppliers, ["name", "taxId", "category", "email", "phone"], state.financeSearch);
  supplierContainer.innerHTML = suppliers.length ? `<table class="data-table"><thead><tr><th>Proveedor</th><th>Categoría</th><th>NIF/CIF</th><th>Contacto</th><th>Estado</th><th></th></tr></thead><tbody>${suppliers.map((supplier) => `<tr>
    <td><strong>${escapeHtml(supplier.name)}</strong></td>
    <td>${escapeHtml(supplier.category || "General")}</td>
    <td>${escapeHtml(supplier.taxId || "—")}</td>
    <td>${escapeHtml(supplier.phone || supplier.email || "—")}<small>${supplier.phone && supplier.email ? escapeHtml(supplier.email) : ""}</small></td>
    <td>${statusPill(supplier.active === false ? "inactive" : "active", supplier.active === false ? "Inactivo" : "Activo")}</td>
    <td><button class="table-action" type="button" data-edit-supplier="${escapeAttr(supplier.id)}">Editar</button></td>
  </tr>`).join("")}</tbody></table>` : emptyState("customers", "Todavía no hay proveedores", "Guarda sus datos una vez y selecciónalos al registrar gastos o productos.", "Añadir proveedor");

  installIcons(invoiceContainer);
  installIcons(expenseContainer);
  installIcons(supplierContainer);
}

function handleFinanceAction(event) {
  const invoiceId = event.target.closest("[data-edit-invoice]")?.dataset.editInvoice;
  const payInvoiceId = event.target.closest("[data-pay-invoice]")?.dataset.payInvoice;
  const expenseId = event.target.closest("[data-edit-expense]")?.dataset.editExpense;
  const supplierId = event.target.closest("[data-edit-supplier]")?.dataset.editSupplier;
  const emptyAction = event.target.closest("[data-empty-action]")?.dataset.emptyAction;
  if (invoiceId) openEntityForm("invoice", state.invoices.find((item) => item.id === invoiceId));
  else if (expenseId) openEntityForm("expense", state.expenses.find((item) => item.id === expenseId));
  else if (supplierId) openEntityForm("supplier", state.suppliers.find((item) => item.id === supplierId));
  else if (emptyAction) openEntityForm(emptyAction);
  else if (payInvoiceId) markInvoicePaid(payInvoiceId);
}

async function markInvoicePaid(id) {
  const invoice = state.invoices.find((item) => item.id === id);
  if (!invoice) return;
  try {
    await apiRequest(resourcePath("invoices", id), { method: "PATCH", body: { status: "paid" } });
    showToast(`Factura ${invoice.number} marcada como cobrada.`);
    await loadHospitalityData();
  } catch (error) {
    showToast(readableError(error), "error");
  }
}

function renderTeam() {
  const team = state.summary?.team || {};
  setText('[data-team-kpi="active"]', team.activeEmployees || state.employees.length);
  setText('[data-team-kpi="today"]', team.workingToday || 0);
  setText('[data-team-kpi="hours"]', `${formatNumber(team.weeklyHours || 0)} h`);
  setText('[data-team-kpi="uncovered"]', team.uncoveredShifts || 0);
  renderSchedule();
  renderPeople();
}

function renderSchedule() {
  if (!refs.scheduleGrid) return;
  const start = weekStart(new Date(), state.scheduleWeekOffset);
  const dates = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const today = localDateValue(new Date());
  const end = dates[6];
  if (refs.scheduleRange) refs.scheduleRange.textContent = `${formatDayMonth(dates[0])} – ${formatDayMonth(end)}`;

  const employees = state.employees.filter((employee) => employee.active !== false);
  const unassigned = state.shifts.some((shift) => !shift.employeeId && dates.includes(shift.date));
  const rows = unassigned ? [...employees, { id: "", name: "Sin asignar", role: "manager" }] : employees;
  const header = `<div class="schedule-cell is-header">Equipo</div>${dates.map((date, index) => `<div class="schedule-cell is-header${date === today ? " is-today" : ""}">${DAY_LABELS[index]}<strong>${String(Number(date.slice(-2)))}</strong></div>`).join("")}`;

  if (!rows.length) {
    refs.scheduleGrid.innerHTML = `${header}<div class="schedule-cell" style="grid-column:1/-1;min-height:130px">${emptyState("team", "Añade a tu equipo", "Después podrás organizar sus turnos sobre este cuadrante.", "Añadir persona")}</div>`;
    installIcons(refs.scheduleGrid);
    return;
  }

  refs.scheduleGrid.innerHTML = header + rows.map((employee) => {
    const person = `<div class="schedule-cell"><div class="schedule-person"><span class="person-avatar">${initials(employee.name)}</span><div><strong>${escapeHtml(employee.name)}</strong><small>${escapeHtml(ROLE_LABELS[employee.role] || "Sin rol")}</small></div></div></div>`;
    const cells = dates.map((date) => {
      const shifts = state.shifts.filter((shift) => shift.date === date && clean(shift.employeeId) === clean(employee.id));
      return `<div class="schedule-cell">${shifts.length ? shifts.map((shift) => `<button class="shift-chip is-${escapeAttr(shift.area)}" type="button" data-edit-shift="${escapeAttr(shift.id)}"><strong>${escapeHtml(shift.startTime)}–${escapeHtml(shift.endTime)}</strong><small>${escapeHtml(AREA_LABELS[shift.area] || shift.area)}</small></button>`).join("") : `<button class="schedule-empty" type="button" data-new-shift-date="${date}" data-new-shift-employee="${escapeAttr(employee.id)}">+ Turno</button>`}</div>`;
    }).join("");
    return person + cells;
  }).join("");
}

function renderPeople() {
  if (!refs.peopleGrid) return;
  const people = filterSearch(state.employees.filter((item) => item.active !== false), ["name", "email", "phone", "role", "accessLevel"], state.teamSearch);
  refs.peopleGrid.innerHTML = people.length ? people.map((person) => `<article class="person-card">
    <span class="person-avatar" style="background:${escapeAttr(colorWithAlpha(person.color || "#5262d9", 0.12))};color:${escapeAttr(person.color || "#5262d9")}">${initials(person.name)}</span>
    <div><strong>${escapeHtml(person.name)}</strong><p>${escapeHtml(ROLE_LABELS[person.role] || person.role)} · ${escapeHtml(ACCESS_LABELS[person.accessLevel] || person.accessLevel)}</p></div>
    <button type="button" data-edit-employee="${escapeAttr(person.id)}" aria-label="Editar a ${escapeAttr(person.name)}">•••</button>
  </article>`).join("") : emptyState("team", "Todavía no has añadido personas", "Crea perfiles con su puesto y nivel de acceso.", "Añadir persona");
  installIcons(refs.peopleGrid);
}

function handleTeamAction(event) {
  const employeeId = event.target.closest("[data-edit-employee]")?.dataset.editEmployee;
  const shiftId = event.target.closest("[data-edit-shift]")?.dataset.editShift;
  const newShift = event.target.closest("[data-new-shift-date]");
  const emptyAction = event.target.closest("[data-empty-action]")?.dataset.emptyAction;
  if (employeeId) openEntityForm("employee", state.employees.find((item) => item.id === employeeId));
  else if (shiftId) openEntityForm("shift", state.shifts.find((item) => item.id === shiftId));
  else if (newShift) openEntityForm("shift", null, { date: newShift.dataset.newShiftDate, employeeId: newShift.dataset.newShiftEmployee });
  else if (emptyAction) openEntityForm(emptyAction);
}

function renderInventory() {
  const inventory = state.summary?.inventory || {};
  setText('[data-inventory-kpi="value"]', formatMoney(inventory.value));
  setText('[data-inventory-kpi="items"]', inventory.activeItems ?? state.inventory.length);
  setText('[data-inventory-kpi="low"]', inventory.lowStock || 0);
  setText('[data-inventory-kpi="suppliers"]', inventory.activeSuppliers ?? state.suppliers.length);
  document.querySelectorAll("[data-stock-alert]").forEach((element) => { element.hidden = !(Number(inventory.lowStock || 0) > 0); });
  renderInventoryCategories();
  renderInventoryTable();
}

function renderInventoryCategories() {
  if (!refs.inventoryCategory) return;
  const categories = [...new Set(state.inventory.map((item) => clean(item.category)).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es"));
  refs.inventoryCategory.innerHTML = `<option value="">Todas las categorías</option>${categories.map((category) => `<option value="${escapeAttr(category)}"${category === state.inventoryCategory ? " selected" : ""}>${escapeHtml(category)}</option>`).join("")}`;
}

function renderInventoryTable() {
  if (!refs.inventoryTable) return;
  const items = state.inventory
    .filter((item) => state.stockFilter === "all" || (state.stockFilter === "low" ? item.lowStock : !item.lowStock))
    .filter((item) => !state.inventoryCategory || item.category === state.inventoryCategory);
  const filtered = filterSearch(items, ["name", "category", "supplierName", "unit"], state.inventorySearch);

  refs.inventoryTable.innerHTML = filtered.length ? `<div class="record-view"><table class="data-table"><thead><tr><th>Producto</th><th>Categoría</th><th>Existencias</th><th>Mínimo</th><th>Coste</th><th>Proveedor</th><th>Estado</th><th></th></tr></thead><tbody>${filtered.map((item) => {
    const ratio = Number(item.minStock || 0) > 0 ? Math.min(100, Number(item.currentStock || 0) / Number(item.minStock) * 70) : 100;
    return `<tr>
      <td><strong>${escapeHtml(item.name)}</strong><small>${formatMoney(item.stockValue)} en stock</small></td>
      <td>${escapeHtml(item.category || "General")}</td>
      <td><div class="stock-control"><div class="stock-bar${item.lowStock ? " is-low" : ""}"><span style="--stock-width:${Math.max(4, ratio)}%"></span></div><span class="stock-number">${formatNumber(item.currentStock)} ${escapeHtml(UNIT_LABELS[item.unit] || item.unit)}</span></div></td>
      <td>${formatNumber(item.minStock)} ${escapeHtml(UNIT_LABELS[item.unit] || item.unit)}</td>
      <td class="amount-cell">${formatMoney(item.costPerUnit)}<small>por ${escapeHtml(UNIT_LABELS[item.unit] || item.unit)}</small></td>
      <td>${escapeHtml(item.supplierName || "Sin proveedor")}</td>
      <td>${statusPill(item.lowStock ? "low" : "ok", item.lowStock ? "Hay que reponer" : "Stock correcto")}</td>
      <td><button class="table-action" type="button" data-edit-inventory="${escapeAttr(item.id)}">Editar</button></td>
    </tr>`;
  }).join("")}</tbody></table></div>` : emptyState("inventory", state.inventory.length ? "No hay productos con este filtro" : "Todavía no controlas existencias", state.inventory.length ? "Prueba con otro término o selecciona “Todos”." : "Añade los productos clave para recibir avisos antes de que se terminen.", state.inventory.length ? "" : "Añadir producto");
  installIcons(refs.inventoryTable);
}

function handleInventoryAction(event) {
  const id = event.target.closest("[data-edit-inventory]")?.dataset.editInventory;
  const emptyAction = event.target.closest("[data-empty-action]")?.dataset.emptyAction;
  if (id) openEntityForm("inventory", state.inventory.find((item) => item.id === id));
  else if (emptyAction) openEntityForm(emptyAction);
}

function updateHomeOverview() {
  const name = clean(state.businessName || document.querySelector("[data-side-business]")?.textContent);
  setText("[data-greeting-name]", name && !/sin negocio/i.test(name) ? name.split(/\s+/)[0] : "equipo");
  const bookings = metricNumber("bookings");
  const leads = metricNumber("leads");
  const orders = metricNumber("orders");
  const lowStock = Number(state.summary?.inventory?.lowStock || 0);
  const concerns = Number(leads > 0) + Number(orders > 0) + Number(lowStock > 0);
  const readiness = Math.max(35, 100 - concerns * 17);
  const ring = document.querySelector(".readiness-ring");
  if (ring) ring.style.setProperty("--progress", `${readiness}%`);
  setText("[data-readiness-value]", `${readiness}%`);
  setText("[data-readiness-copy]", concerns ? `${concerns} ${plural(concerns, "punto", "puntos")} por revisar` : "No hay avisos importantes");
  const brief = bookings
    ? `Tienes ${bookings} ${plural(bookings, "reserva", "reservas")} para hoy${lowStock ? ` y ${lowStock} ${plural(lowStock, "producto", "productos")} por reponer` : ""}.`
    : lowStock
      ? `No hay reservas registradas hoy. Revisa ${lowStock} ${plural(lowStock, "producto", "productos")} con stock bajo.`
      : "Revisa las prioridades y deja el servicio preparado.";
  setText("[data-daily-brief]", brief);
  setText('[data-nav-count="inbox"]', leads + orders);
}

function updateNavigation(tab) {
  const button = document.querySelector(`[data-tab="${cssEscape(tab || "home")}"]`);
  if (!button) return;
  const projectSection = new URLSearchParams(window.location.search).get("projectSection") || "projects";
  const contextualButton = tab === "project"
    ? document.querySelector(`[data-client-section="${cssEscape(projectSection)}"]`)
    : null;
  const navigationButton = contextualButton || button;
  if (refs.title) refs.title.textContent = navigationButton.dataset.navTitle || navigationButton.textContent.trim();
  if (refs.subtitle) refs.subtitle.textContent = navigationButton.dataset.navSubtitle || "Gestión clara para tu negocio.";
  const primaryActions = {
    bookings: { label: "Nueva reserva", action: "booking" },
    finance: { label: "Nueva factura", action: "invoice" },
    team: { label: "Añadir persona", action: "employee" },
    inventory: { label: "Añadir producto", action: "inventory" },
    commerce: { label: "Añadir producto", action: "commerce-product" }
  };
  const primary = primaryActions[tab] || { label: "Crear", action: "" };
  if (refs.quickCreate) {
    refs.quickCreate.hidden = tab === "project";
    refs.quickCreate.dataset.contextAction = primary.action;
    refs.quickCreate.innerHTML = `<span aria-hidden="true">+</span> ${escapeHtml(primary.label)}`;
  }
  document.body.dataset.currentArea = tab;
}

function handleQuickAction(action) {
  refs.quickDialog?.close();
  if (action === "booking") {
    goToTab("bookings");
    window.setTimeout(() => {
      const form = document.querySelector("[data-booking-form]");
      form?.scrollIntoView({ behavior: "smooth", block: "center" });
      form?.querySelector("input, select")?.focus();
    }, 80);
    return;
  }
  if (action === "commerce-product") {
    document.dispatchEvent(new CustomEvent("dls:commerce-add-product"));
    return;
  }
  openEntityForm(action);
}

function goToTab(tab) {
  document.querySelector(`[data-tab="${cssEscape(tab)}"]`)?.click();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openEntityForm(type, entity = null, defaults = {}) {
  if (!refs.entityDialog || !refs.entityFields) return;
  const config = formConfig(type, entity, defaults);
  if (!config) return;
  state.entityContext = { type, entity, config };
  refs.entityKicker.textContent = entity ? "Editar registro" : config.kicker;
  refs.entityTitle.textContent = entity ? config.editTitle : config.title;
  refs.entityDescription.textContent = config.description;
  refs.entitySubmit.textContent = entity ? "Guardar cambios" : config.submitLabel;
  refs.entityFields.innerHTML = config.fields.map(renderFormField).join("");
  openDialog(refs.entityDialog);
  window.setTimeout(() => refs.entityFields.querySelector("input:not([type=hidden]), select, textarea")?.focus(), 40);
}

function formConfig(type, entity, defaults) {
  const today = localDateValue(new Date());
  const nextWeek = addDays(today, 7);
  const value = (key, fallback = "") => entity?.[key] ?? defaults[key] ?? fallback;
  const supplierOptions = optionList(state.suppliers, "id", "name");
  const employeeOptions = optionList(state.employees, "id", "name");

  if (type === "invoice") return {
    resource: "invoices", singular: "invoice", kicker: "Nuevo ingreso", title: "Crear una factura", editTitle: "Editar factura", submitLabel: "Guardar factura",
    description: "Registra el cliente, el concepto y el importe. El número se asigna automáticamente.",
    numberFields: ["subtotal", "taxRate"], booleanFields: [],
    fields: [
      field("customerName", "Cliente o empresa", "text", value("customerName"), { required: true, placeholder: "Ej. Eventos Costa Norte" }),
      field("customerTaxId", "NIF/CIF", "text", value("customerTaxId"), { placeholder: "Opcional" }),
      field("concept", "Concepto", "text", value("concept"), { required: true, wide: true, placeholder: "Ej. Menú de grupo para 20 personas" }),
      field("issueDate", "Fecha de emisión", "date", value("issueDate", today), { required: true }),
      field("dueDate", "Fecha de cobro", "date", value("dueDate", nextWeek), { required: true }),
      field("subtotal", "Base sin IVA (€)", "number", value("subtotal", 0), { required: true, min: 0, step: "0.01" }),
      field("taxRate", "IVA", "select", value("taxRate", 21), { options: [["0", "0 %"], ["4", "4 %"], ["10", "10 %"], ["21", "21 %"]] }),
      field("status", "Estado", "select", value("status", "draft"), { options: [["draft", "Borrador"], ["sent", "Enviada"], ["paid", "Pagada"], ["overdue", "Vencida"], ["cancelled", "Cancelada"]] }),
      field("paymentMethod", "Forma de cobro", "select", value("paymentMethod", "transfer"), { options: paymentOptions() }),
      field("notes", "Notas", "textarea", value("notes"), { wide: true, placeholder: "Información interna opcional" })
    ]
  };

  if (type === "expense") return {
    resource: "expenses", singular: "expense", kicker: "Nueva salida de dinero", title: "Añadir un gasto", editTitle: "Editar gasto", submitLabel: "Guardar gasto",
    description: "Añade el importe del ticket o factura y, si quieres, asócialo a un proveedor.",
    numberFields: ["subtotal", "taxRate"], booleanFields: ["deductible"],
    fields: [
      field("concept", "Qué has pagado", "text", value("concept"), { required: true, wide: true, placeholder: "Ej. Compra de pescado" }),
      field("supplierId", "Proveedor", "select", value("supplierId"), { options: [["", "Sin proveedor"], ...supplierOptions] }),
      field("category", "Categoría", "select", value("category", "food"), { options: Object.entries(EXPENSE_CATEGORY_LABELS) }),
      field("date", "Fecha", "date", value("date", today), { required: true }),
      field("subtotal", "Base sin IVA (€)", "number", value("subtotal", 0), { required: true, min: 0, step: "0.01" }),
      field("taxRate", "IVA", "select", value("taxRate", 10), { options: [["0", "0 %"], ["4", "4 %"], ["10", "10 %"], ["21", "21 %"]] }),
      field("paymentMethod", "Cómo se pagó", "select", value("paymentMethod", "card"), { options: paymentOptions() }),
      field("status", "Estado", "select", value("status", "paid"), { options: [["paid", "Pagado"], ["pending", "Pendiente"]] }),
      field("deductible", "Marcar como gasto deducible", "checkbox", value("deductible", true)),
      field("notes", "Notas", "textarea", value("notes"), { wide: true, placeholder: "Opcional" })
    ]
  };

  if (type === "supplier") return {
    resource: "suppliers", singular: "supplier", kicker: "Nuevo contacto", title: "Añadir proveedor", editTitle: "Editar proveedor", submitLabel: "Guardar proveedor",
    description: "Guarda sus datos para reutilizarlos en gastos e inventario.", numberFields: [], booleanFields: ["active"],
    fields: [
      field("name", "Nombre del proveedor", "text", value("name"), { required: true, wide: true, placeholder: "Ej. Pescados del Cantábrico" }),
      field("taxId", "NIF/CIF", "text", value("taxId"), { placeholder: "Opcional" }),
      field("category", "Qué suministra", "text", value("category", "General"), { placeholder: "Ej. Pescado y marisco" }),
      field("phone", "Teléfono", "tel", value("phone"), { placeholder: "+34…" }),
      field("email", "Correo", "email", value("email"), { placeholder: "pedidos@proveedor.es" }),
      field("active", "Proveedor activo", "checkbox", value("active", true))
    ]
  };

  if (type === "employee") return {
    resource: "employees", singular: "employee", kicker: "Nuevo integrante", title: "Añadir una persona", editTitle: "Editar integrante", submitLabel: "Añadir al equipo",
    description: "Indica su puesto y el nivel de acceso. Podrás cambiarlo en cualquier momento.", numberFields: ["hourlyRate"], booleanFields: ["active"],
    fields: [
      field("name", "Nombre y apellidos", "text", value("name"), { required: true, wide: true, placeholder: "Ej. Laura Martín" }),
      field("role", "Puesto", "select", value("role", "waiter"), { options: Object.entries(ROLE_LABELS) }),
      field("accessLevel", "Permisos", "select", value("accessLevel", "employee"), { options: Object.entries(ACCESS_LABELS), help: "Empleado ve su trabajo; Gestión puede organizar; Acceso total controla todo." }),
      field("phone", "Teléfono", "tel", value("phone"), { placeholder: "+34…" }),
      field("email", "Correo", "email", value("email"), { placeholder: "persona@negocio.es" }),
      field("hourlyRate", "Coste por hora (€)", "number", value("hourlyRate", 0), { min: 0, step: "0.01", help: "Opcional. Solo visible para gestión." }),
      field("color", "Color en el cuadrante", "color", value("color", "#5262d9")),
      field("active", "Persona activa", "checkbox", value("active", true))
    ]
  };

  if (type === "shift") return {
    resource: "shifts", singular: "shift", kicker: "Organizar el servicio", title: "Añadir un turno", editTitle: "Editar turno", submitLabel: "Guardar turno",
    description: "Selecciona quién trabaja, cuándo y en qué zona del local.", numberFields: [], booleanFields: [],
    fields: [
      field("employeeId", "Persona", "select", value("employeeId"), { options: [["", "Sin asignar"], ...employeeOptions] }),
      field("area", "Zona", "select", value("area", "floor"), { options: Object.entries(AREA_LABELS) }),
      field("date", "Día", "date", value("date", today), { required: true }),
      field("status", "Estado", "select", value("status", "scheduled"), { options: [["scheduled", "Planificado"], ["confirmed", "Confirmado"], ["completed", "Completado"], ["absent", "Ausencia"]] }),
      field("startTime", "Empieza", "time", value("startTime", "12:00"), { required: true }),
      field("endTime", "Termina", "time", value("endTime", "17:00"), { required: true }),
      field("notes", "Notas del turno", "textarea", value("notes"), { wide: true, placeholder: "Ej. Preparar terraza" })
    ]
  };

  if (type === "inventory") return {
    resource: "inventory", singular: "item", kicker: "Control de existencias", title: "Añadir un producto", editTitle: "Editar producto", submitLabel: "Guardar producto",
    description: "Define cuánto tienes y a partir de qué cantidad quieres recibir un aviso.", numberFields: ["currentStock", "minStock", "costPerUnit"], booleanFields: ["active"],
    fields: [
      field("name", "Nombre del producto", "text", value("name"), { required: true, wide: true, placeholder: "Ej. Lomo alto de vaca" }),
      field("category", "Categoría", "text", value("category", "Alimentos"), { required: true, placeholder: "Ej. Carnes" }),
      field("unit", "Unidad", "select", value("unit", "kg"), { options: Object.entries(UNIT_LABELS) }),
      field("currentStock", "Cantidad actual", "number", value("currentStock", 0), { required: true, min: 0, step: "0.001" }),
      field("minStock", "Avisar cuando quede", "number", value("minStock", 0), { required: true, min: 0, step: "0.001", help: "Esta es la cantidad mínima para no quedarte sin producto." }),
      field("costPerUnit", "Coste por unidad (€)", "number", value("costPerUnit", 0), { min: 0, step: "0.01" }),
      field("supplierId", "Proveedor habitual", "select", value("supplierId"), { options: [["", "Sin proveedor"], ...supplierOptions] }),
      field("active", "Producto activo", "checkbox", value("active", true)),
      field("notes", "Notas", "textarea", value("notes"), { wide: true, placeholder: "Marca, formato de compra, conservación…" })
    ]
  };

  return null;
}

function field(name, label, type, value, options = {}) {
  return { name, label, type, value, ...options };
}

function renderFormField(input) {
  if (input.type === "checkbox") {
    return `<label class="form-field-checkbox"><input type="checkbox" name="${escapeAttr(input.name)}"${input.value ? " checked" : ""}> <span>${escapeHtml(input.label)}</span></label>`;
  }
  const attributes = [
    input.required ? "required" : "",
    input.placeholder ? `placeholder="${escapeAttr(input.placeholder)}"` : "",
    input.min !== undefined ? `min="${escapeAttr(input.min)}"` : "",
    input.step ? `step="${escapeAttr(input.step)}"` : ""
  ].filter(Boolean).join(" ");
  let control;
  if (input.type === "select") {
    control = `<select name="${escapeAttr(input.name)}" ${attributes}>${(input.options || []).map(([optionValue, label]) => `<option value="${escapeAttr(optionValue)}"${String(optionValue) === String(input.value) ? " selected" : ""}>${escapeHtml(label)}</option>`).join("")}</select>`;
  } else if (input.type === "textarea") {
    control = `<textarea name="${escapeAttr(input.name)}" ${attributes}>${escapeHtml(input.value)}</textarea>`;
  } else {
    control = `<input type="${escapeAttr(input.type)}" name="${escapeAttr(input.name)}" value="${escapeAttr(input.value)}" ${attributes}>`;
  }
  return `<label class="form-field${input.wide ? " is-wide" : ""}"><span>${escapeHtml(input.label)}</span>${control}${input.help ? `<small>${escapeHtml(input.help)}</small>` : ""}</label>`;
}

async function submitEntityForm(event) {
  event.preventDefault();
  const context = state.entityContext;
  if (!context || !state.businessId) return;
  const data = Object.fromEntries(new FormData(refs.entityForm).entries());
  context.config.numberFields.forEach((fieldName) => { data[fieldName] = Number(data[fieldName] || 0); });
  context.config.booleanFields.forEach((fieldName) => { data[fieldName] = Boolean(refs.entityForm.elements[fieldName]?.checked); });
  refs.entityFields.querySelector(".form-error")?.remove();
  refs.entitySubmit.disabled = true;
  refs.entitySubmit.textContent = "Guardando…";

  try {
    const path = resourcePath(context.config.resource, context.entity?.id);
    await apiRequest(path, { method: context.entity ? "PATCH" : "POST", body: data });
    refs.entityDialog.close();
    showToast(context.entity ? "Cambios guardados correctamente." : "Registro añadido correctamente.");
    await loadHospitalityData();
  } catch (error) {
    refs.entityFields.insertAdjacentHTML("afterbegin", `<p class="form-error">${escapeHtml(readableError(error))}</p>`);
  } finally {
    refs.entitySubmit.disabled = false;
    refs.entitySubmit.textContent = context.entity ? "Guardar cambios" : context.config.submitLabel;
  }
}

function exportFinanceCsv() {
  const rows = [
    ["Tipo", "Número/Concepto", "Cliente/Proveedor", "Fecha", "Estado", "Base", "IVA", "Total"],
    ...state.invoices.map((item) => ["Factura", item.number, item.customerName, item.issueDate, invoiceStatus(item), item.subtotal, item.taxAmount, item.total]),
    ...state.expenses.map((item) => ["Gasto", item.concept, item.supplierName, item.date, item.status, item.subtotal, item.taxAmount, item.total])
  ];
  const csv = rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `resumen-contable-${slugify(state.businessName || "negocio")}-${localDateValue(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  showToast("Resumen preparado para descargar.");
}

async function apiRequest(path, options = {}) {
  const response = await fetch(window.LocalLiftApi?.url?.(path) || path, {
    method: options.method || "GET",
    headers: window.LocalLiftApi?.headers?.({ json: options.body !== undefined }) || { Accept: "application/json", ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch { payload = {}; }
  if (!response.ok) {
    const error = new Error(payload.error || `La petición devolvió ${response.status}`);
    error.status = response.status;
    error.code = payload.code || "";
    throw error;
  }
  return payload;
}

function resourcePath(resource, id = "") {
  return `/api/businesses/${encodeURIComponent(state.businessId)}/hospitality/${resource}${id ? `/${encodeURIComponent(id)}` : ""}`;
}

function arrayPayload(payload, key) {
  if (Array.isArray(payload?.items)) return payload.items;
  return Array.isArray(payload?.[key]) ? payload[key] : [];
}

function setModuleLoading(loading) {
  document.querySelectorAll(".hospitality-module").forEach((module) => module.setAttribute("aria-busy", String(loading)));
}

function clearModuleNotices() {
  [refs.financeNotice, refs.teamNotice, refs.inventoryNotice].forEach((notice) => {
    if (!notice) return;
    notice.hidden = true;
    notice.textContent = "";
    notice.className = "module-notice";
  });
}

function showModuleNotice(element, message, tone = "") {
  if (!element) return;
  element.hidden = false;
  element.textContent = message;
  element.className = `module-notice${tone ? ` is-${tone}` : ""}`;
}

function showToast(message, tone = "success") {
  if (!refs.toastRegion) return;
  const toast = document.createElement("div");
  toast.className = `hospitality-toast${tone === "error" ? " is-error" : ""}`;
  toast.textContent = message;
  refs.toastRegion.append(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function openDialog(dialog) {
  if (!dialog) return;
  if (typeof dialog.showModal === "function") dialog.showModal();
  else dialog.setAttribute("open", "");
}

function closeSideMenu() {
  document.body.classList.remove("is-side-menu-open");
  refs.sideToggle?.setAttribute("aria-expanded", "false");
}

function activeTab() {
  return document.querySelector("[data-tab].is-active")?.dataset.tab || new URLSearchParams(window.location.search).get("tab") || "home";
}

function emptyState(icon, title, copy, actionLabel) {
  const actionType = icon === "finance" ? "invoice" : icon === "customers" ? "supplier" : icon === "team" ? "employee" : icon;
  return `<div class="empty-module-state"><div><span data-icon="${escapeAttr(icon || "empty")}" aria-hidden="true"></span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p>${actionLabel ? `<button class="primary-action" type="button" data-empty-action="${escapeAttr(actionType)}">${escapeHtml(actionLabel)}</button>` : ""}</div></div>`;
}

function statusPill(status, label = "") {
  return `<span class="status-pill is-${escapeAttr(status)}">${escapeHtml(label || STATUS_LABELS[status] || status || "—")}</span>`;
}

function invoiceStatus(invoice) {
  if (invoice.status === "sent" && invoice.dueDate && invoice.dueDate < localDateValue(new Date())) return "overdue";
  return invoice.status || "draft";
}

function paymentOptions() {
  return [["cash", "Efectivo"], ["card", "Tarjeta"], ["transfer", "Transferencia"], ["direct-debit", "Domiciliación"], ["other", "Otro"]];
}

function optionList(items, valueKey, labelKey) {
  return items.filter((item) => item.active !== false).map((item) => [String(item[valueKey]), String(item[labelKey])]);
}

function installIcons(root = document) {
  root.querySelectorAll?.("[data-icon]").forEach((element) => {
    if (element.dataset.iconReady === "true") return;
    element.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[element.dataset.icon] || ICONS.empty}</svg>`;
    element.dataset.iconReady = "true";
  });
}

function filterSearch(items, fields, search) {
  if (!search) return items;
  return items.filter((item) => fields.some((fieldName) => clean(item[fieldName]).toLowerCase().includes(search)));
}

function metricNumber(name) {
  const value = document.querySelector(`[data-metric="${cssEscape(name)}"]`)?.textContent || "0";
  const match = value.replace(/\./g, "").replace(",", ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = String(value ?? "");
}

function weekStart(date, offset = 0) {
  const result = new Date(date);
  const day = result.getDay() || 7;
  result.setHours(12, 0, 0, 0);
  result.setDate(result.getDate() - day + 1 + offset * 7);
  return localDateValue(result);
}

function addDays(dateValue, days) {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return localDateValue(date);
}

function localDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function lastSixMonthKeys() {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function formatDayMonth(value) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(date);
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 3 }).format(Number(value || 0));
}

function initials(name) {
  return clean(name).split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase() || "?";
}

function colorWithAlpha(color, alpha) {
  const hex = clean(color).replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "rgba(82,98,217,.12)";
  const values = [0, 2, 4].map((index) => parseInt(hex.slice(index, index + 2), 16));
  return `rgba(${values.join(",")},${alpha})`;
}

function readableError(error) {
  const message = clean(error?.message);
  const translations = [
    [/customerName is required/i, "Indica el nombre del cliente."],
    [/concept is required/i, "Indica el concepto."],
    [/name is required/i, "Indica un nombre."],
    [/endTime must be after startTime/i, "La hora de fin debe ser posterior a la de inicio."],
    [/dueDate cannot be before issueDate/i, "La fecha de cobro no puede ser anterior a la emisión."],
    [/email must be valid/i, "Revisa el formato del correo."],
    [/client session cannot access/i, "Tu sesión no permite modificar estos datos."],
    [/admin.*required/i, "Necesitas acceso de gestión para guardar cambios."]
  ];
  return translations.find(([pattern]) => pattern.test(message))?.[1] || message || "No se pudo guardar. Revisa los datos e inténtalo de nuevo.";
}

function plural(value, singular, pluralValue) { return Number(value) === 1 ? singular : pluralValue; }
function clean(value) { return String(value ?? "").trim(); }
function cssEscape(value) { return window.CSS?.escape ? window.CSS.escape(String(value)) : String(value).replace(/[^a-zA-Z0-9_-]/g, ""); }
function slugify(value) { return clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "negocio"; }
function csvCell(value) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]); }
function escapeAttr(value) { return escapeHtml(value); }
