const state = {
  businessId: "",
  businessName: "",
  publishedUrl: "",
  summary: null,
  products: [],
  orders: [],
  coupons: [],
  settings: null,
  endpoints: null,
  commerce: null,
  activeView: "overview",
  productSearch: "",
  orderSearch: "",
  orderStatus: "",
  loading: false,
  requestSequence: 0
};

const refs = {};
const ORDER_STATUS_LABELS = Object.freeze({
  pending: "Pendiente",
  paid: "Pagado",
  preparing: "Preparando",
  ready: "Listo",
  fulfilled: "Completado",
  canceled: "Cancelado",
  expired: "Caducado",
  failed: "Fallido",
  refunded: "Reembolsado"
});

document.addEventListener("DOMContentLoaded", init);

function init() {
  if (document.body.classList.contains("is-access-locked")) return;
  collectRefs();
  bindViews();
  bindProducts();
  bindOrders();
  bindCoupons();
  bindSettings();
  bindDialogs();
  renderAll();

  document.addEventListener("dls:business-changed", (event) => {
    state.businessId = clean(event.detail?.businessId);
    state.businessName = clean(event.detail?.businessName);
    state.publishedUrl = clean(event.detail?.publishedUrl);
    loadCommerceData();
  });

  document.addEventListener("dls:commerce-add-product", () => openProductDialog());
}

function collectRefs() {
  refs.module = document.querySelector(".commerce-module");
  refs.notice = document.querySelector("[data-commerce-notice]");
  refs.latestOrders = document.querySelector("[data-commerce-latest-orders]");
  refs.products = document.querySelector("[data-commerce-products]");
  refs.orders = document.querySelector("[data-commerce-orders]");
  refs.coupons = document.querySelector("[data-commerce-coupons]");
  refs.productSearch = document.querySelector("[data-commerce-product-search]");
  refs.orderSearch = document.querySelector("[data-commerce-order-search]");
  refs.orderFilter = document.querySelector("[data-commerce-order-filter]");
  refs.settingsForm = document.querySelector("[data-commerce-settings-form]");
  refs.productDialog = document.querySelector("[data-commerce-product-dialog]");
  refs.productForm = document.querySelector("[data-commerce-product-form]");
  refs.productError = document.querySelector("[data-commerce-product-error]");
  refs.productDialogTitle = document.querySelector("[data-commerce-product-dialog-title]");
  refs.couponDialog = document.querySelector("[data-commerce-coupon-dialog]");
  refs.couponForm = document.querySelector("[data-commerce-coupon-form]");
  refs.couponError = document.querySelector("[data-commerce-coupon-error]");
  refs.couponDialogTitle = document.querySelector("[data-commerce-coupon-dialog-title]");
  refs.publicLink = document.querySelector("[data-commerce-public-link]");
  refs.alert = document.querySelector("[data-commerce-alert]");
}

function bindViews() {
  document.querySelectorAll("[data-commerce-tab]").forEach((button) => {
    button.addEventListener("click", () => setCommerceView(button.dataset.commerceTab));
  });
  document.querySelectorAll("[data-commerce-go]").forEach((button) => {
    button.addEventListener("click", () => setCommerceView(button.dataset.commerceGo));
  });
}

function bindProducts() {
  document.querySelectorAll("[data-commerce-add-product]").forEach((button) => {
    button.addEventListener("click", () => openProductDialog());
  });
  refs.productSearch?.addEventListener("input", (event) => {
    state.productSearch = clean(event.target.value).toLowerCase();
    renderProducts();
  });
  refs.products?.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-commerce-edit-product]");
    if (edit) {
      const product = state.products.find((item) => item.id === edit.dataset.commerceEditProduct);
      openProductDialog(product);
      return;
    }
    const hide = event.target.closest("[data-commerce-hide-product]");
    if (!hide) return;
    const product = state.products.find((item) => item.id === hide.dataset.commerceHideProduct);
    if (!product || !window.confirm(`¿Ocultar “${product.name}” de la tienda?`)) return;
    hide.disabled = true;
    try {
      const payload = await apiRequest(resourcePath("products", product.id), { method: "DELETE" });
      applyCommercePayload(payload.commerce);
      showNotice("Producto ocultado del catálogo.");
      await loadCommerceData({ quiet: true });
    } catch (error) {
      showNotice(readableError(error), "error");
      hide.disabled = false;
    }
  });
  refs.productForm?.addEventListener("submit", saveProduct);
}

function bindOrders() {
  refs.orderSearch?.addEventListener("input", (event) => {
    state.orderSearch = clean(event.target.value).toLowerCase();
    renderOrders();
  });
  refs.orderFilter?.addEventListener("change", (event) => {
    state.orderStatus = clean(event.target.value);
    renderOrders();
  });
  refs.orders?.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-commerce-order-form]");
    if (!form) return;
    event.preventDefault();
    const button = form.querySelector("button[type='submit']");
    if (button) button.disabled = true;
    const data = new FormData(form);
    try {
      const payload = await apiRequest(resourcePath("orders", form.dataset.commerceOrderForm), {
        method: "PATCH",
        body: {
          status: clean(data.get("status")),
          trackingNumber: clean(data.get("trackingNumber"))
        }
      });
      applyCommercePayload(payload.commerce);
      showNotice("Pedido actualizado.");
      await loadCommerceData({ quiet: true });
    } catch (error) {
      showNotice(readableError(error), "error");
      if (button) button.disabled = false;
    }
  });
}

function bindCoupons() {
  document.querySelector("[data-commerce-add-coupon]")?.addEventListener("click", () => openCouponDialog());
  refs.coupons?.addEventListener("click", async (event) => {
    const edit = event.target.closest("[data-commerce-edit-coupon]");
    if (edit) {
      const coupon = state.coupons.find((item) => item.id === edit.dataset.commerceEditCoupon);
      openCouponDialog(coupon);
      return;
    }
    const disable = event.target.closest("[data-commerce-disable-coupon]");
    if (!disable) return;
    const coupon = state.coupons.find((item) => item.id === disable.dataset.commerceDisableCoupon);
    if (!coupon || !window.confirm(`¿Desactivar el cupón ${coupon.code}?`)) return;
    disable.disabled = true;
    try {
      const payload = await apiRequest(resourcePath("coupons", coupon.id), { method: "DELETE" });
      applyCommercePayload(payload.commerce);
      showNotice("Cupón desactivado.");
      await loadCommerceData({ quiet: true });
    } catch (error) {
      showNotice(readableError(error), "error");
      disable.disabled = false;
    }
  });
  refs.couponForm?.addEventListener("submit", saveCoupon);
}

function bindSettings() {
  refs.settingsForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = refs.settingsForm.querySelector("button[type='submit']");
    if (button) {
      button.disabled = true;
      button.textContent = "Guardando…";
    }
    const data = new FormData(refs.settingsForm);
    try {
      const payload = await apiRequest(resourcePath("settings"), {
        method: "PUT",
        body: {
          enabled: refs.settingsForm.elements.enabled.checked,
          orderEmail: clean(data.get("orderEmail")),
          currency: clean(data.get("currency")).toUpperCase(),
          taxRatePercent: Number(data.get("taxRatePercent") || 0),
          taxIncluded: refs.settingsForm.elements.taxIncluded.checked,
          successUrl: clean(data.get("successUrl")),
          cancelUrl: clean(data.get("cancelUrl")),
          termsUrl: clean(data.get("termsUrl")),
          privacyUrl: clean(data.get("privacyUrl")),
          allowedCountries: clean(data.get("allowedCountries")).split(",").map(clean).filter(Boolean),
          shippingMethods: parseShippingMethods(data.get("shippingMethods")),
          publicBaseUrl: apiPublicBase()
        }
      });
      state.settings = payload.settings || state.settings;
      state.endpoints = payload.endpoints || state.endpoints;
      applyCommercePayload(payload.commerce);
      fillSettings();
      renderOverview();
      showNotice("Configuración de la tienda guardada.");
    } catch (error) {
      showNotice(readableError(error), "error");
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = "Guardar configuración";
      }
    }
  });
}

function bindDialogs() {
  document.querySelectorAll("[data-commerce-dialog-close]").forEach((button) => {
    button.addEventListener("click", () => button.closest("dialog")?.close());
  });
  [refs.productDialog, refs.couponDialog].forEach((dialog) => {
    dialog?.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close();
    });
  });
}

async function loadCommerceData(options = {}) {
  if (!state.businessId) return;
  const sequence = ++state.requestSequence;
  state.loading = true;
  setLoading(true);
  if (!options.quiet) showNotice("Cargando la tienda…", "info");

  try {
    const base = resourcePath("");
    const [summary, products, orders, coupons, settings] = await Promise.all([
      apiRequest(`${base}/summary`),
      apiRequest(`${base}/products`),
      apiRequest(`${base}/orders`),
      apiRequest(`${base}/coupons`),
      apiRequest(`${base}/settings`)
    ]);
    if (sequence !== state.requestSequence) return;
    state.summary = summary.summary || null;
    state.products = arrayPayload(products, "products");
    state.orders = arrayPayload(orders, "orders");
    state.coupons = arrayPayload(coupons, "coupons");
    state.settings = settings.settings || null;
    state.endpoints = settings.endpoints || null;
    applyCommercePayload(settings.commerce || summary.commerce);
    showNotice("", "info");
    renderAll();
  } catch (error) {
    if (sequence !== state.requestSequence) return;
    showNotice(
      error.status === 401 || error.status === 403
        ? "Necesitas permisos de gestión para administrar la tienda."
        : readableError(error),
      "error"
    );
  } finally {
    if (sequence === state.requestSequence) {
      state.loading = false;
      setLoading(false);
    }
  }
}

function renderAll() {
  renderKpis();
  renderOverview();
  renderProducts();
  renderOrders();
  renderCoupons();
  fillSettings();
  updatePublicLink();
}

function renderKpis() {
  const summary = state.summary || {};
  setText('[data-commerce-kpi="revenue"]', formatMoney(summary.revenue || 0, summary.currency || state.settings?.currency));
  setText('[data-commerce-kpi="pending"]', String(summary.pendingOrders || 0));
  setText('[data-commerce-kpi="products"]', String(summary.products || 0));
  setText('[data-commerce-kpi="lowStock"]', String(summary.lowStock || 0));
  setText("[data-commerce-kpi-note='revenue']", summary.paidOrders
    ? `${summary.paidOrders} ${plural(summary.paidOrders, "pedido cobrado", "pedidos cobrados")}`
    : "Sin pedidos pagados");
  if (refs.alert) refs.alert.hidden = Number(summary.pendingOrders || 0) === 0;
}

function renderOverview() {
  if (refs.latestOrders) {
    refs.latestOrders.innerHTML = state.orders.length
      ? `<table class="commerce-table"><thead><tr><th>Pedido</th><th>Cliente</th><th>Estado</th><th>Total</th></tr></thead><tbody>${state.orders.slice(0, 5).map((order) => `<tr>
          <td><strong>${escapeHtml(order.orderNumber || order.id)}</strong><br><small>${escapeHtml(formatDate(order.createdAt))}</small></td>
          <td>${escapeHtml(order.customer?.name || "Cliente")}</td>
          <td>${statusPill(order.status)}</td>
          <td><strong>${escapeHtml(formatMoney(order.total || order.totals?.total || 0, order.currency))}</strong></td>
        </tr>`).join("")}</tbody></table>`
      : emptyState("Todavía no hay pedidos", "Cuando un cliente compre desde la web, aparecerá aquí para prepararlo.");
  }

  const ready = Boolean(state.settings?.enabled && state.products.some((item) => item.active !== false));
  document.querySelector("[data-commerce-status-mark]")?.classList.toggle("is-ready", ready);
  setText("[data-commerce-status-title]", ready ? "Tienda preparada" : "Preparando la tienda");
  setText("[data-commerce-status-copy]", ready
    ? `El catálogo tiene ${state.products.filter((item) => item.active !== false).length} ${plural(state.products.filter((item) => item.active !== false).length, "producto publicado", "productos publicados")}.`
    : "Activa la tienda y publica al menos un producto para empezar a vender.");
}

function renderProducts() {
  if (!refs.products) return;
  const products = state.products.filter((product) => {
    if (!state.productSearch) return true;
    return [product.name, product.sku, product.category, ...(product.tags || [])]
      .map(clean)
      .join(" ")
      .toLowerCase()
      .includes(state.productSearch);
  });
  refs.products.innerHTML = products.length
    ? `<table class="commerce-table"><thead><tr><th>Producto</th><th>Precio</th><th>Stock</th><th>Estado</th><th></th></tr></thead><tbody>${products.map((product) => `<tr>
        <td><div class="commerce-product-cell">${product.image ? `<img src="${escapeAttr(product.image)}" alt="" loading="lazy">` : '<span class="commerce-product-placeholder" aria-hidden="true"></span>'}<span><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.sku || product.category || "Sin SKU")}</small></span></div></td>
        <td><strong>${escapeHtml(formatMoney(product.price, state.settings?.currency))}</strong>${Number(product.compareAtPrice || 0) > Number(product.price || 0) ? `<br><small><s>${escapeHtml(formatMoney(product.compareAtPrice, state.settings?.currency))}</s></small>` : ""}</td>
        <td>${escapeHtml(String(product.stock ?? 0))}${Number(product.stock || 0) <= 5 ? '<br><small>Stock bajo</small>' : ""}</td>
        <td>${product.active === false ? '<span class="commerce-status is-canceled">Oculto</span>' : '<span class="commerce-status is-paid">Visible</span>'}</td>
        <td><div class="commerce-row-actions"><button type="button" data-commerce-edit-product="${escapeAttr(product.id)}">Editar</button>${product.active === false ? "" : `<button class="is-danger" type="button" data-commerce-hide-product="${escapeAttr(product.id)}">Ocultar</button>`}</div></td>
      </tr>`).join("")}</tbody></table>`
    : emptyState(
        state.productSearch ? "No hay coincidencias" : "Tu catálogo está vacío",
        state.productSearch ? "Prueba con otro nombre, SKU o categoría." : "Añade el primer producto que quieras vender desde la web.",
        state.productSearch ? "" : '<button class="primary-action" type="button" data-commerce-inline-add-product>Añadir primer producto</button>'
      );
  refs.products.querySelector("[data-commerce-inline-add-product]")?.addEventListener("click", () => openProductDialog());
}

function renderOrders() {
  if (!refs.orders) return;
  const orders = state.orders.filter((order) => {
    if (state.orderStatus && order.status !== state.orderStatus) return false;
    if (!state.orderSearch) return true;
    return [order.orderNumber, order.id, order.customer?.name, order.customer?.email, order.customer?.phone]
      .map(clean)
      .join(" ")
      .toLowerCase()
      .includes(state.orderSearch);
  });
  refs.orders.innerHTML = orders.length
    ? orders.map((order) => `<article class="commerce-order-card">
        <div><span>Pedido</span><strong>${escapeHtml(order.orderNumber || order.id)}</strong><small>${escapeHtml(formatDateTime(order.createdAt))}</small></div>
        <div><span>Cliente</span><strong>${escapeHtml(order.customer?.name || "Cliente")}</strong><small>${escapeHtml(order.customer?.email || order.customer?.phone || "Sin contacto")}</small></div>
        <div><span>Total</span><strong>${escapeHtml(formatMoney(order.total || order.totals?.total || 0, order.currency))}</strong>${statusPill(order.status)}</div>
        <form data-commerce-order-form="${escapeAttr(order.id)}">
          <select name="status" aria-label="Estado del pedido">${orderStatusOptions(order.status)}</select>
          <input name="trackingNumber" type="text" value="${escapeAttr(order.trackingNumber || "")}" placeholder="Seguimiento">
          <button class="secondary-action compact" type="submit">Guardar</button>
        </form>
      </article>`).join("")
    : emptyState("No hay pedidos con estos filtros", "Los pedidos nuevos aparecerán aquí con el estado y los datos del comprador.");
}

function renderCoupons() {
  if (!refs.coupons) return;
  refs.coupons.innerHTML = state.coupons.length
    ? `<table class="commerce-table"><thead><tr><th>Código</th><th>Descuento</th><th>Uso</th><th>Estado</th><th></th></tr></thead><tbody>${state.coupons.map((coupon) => `<tr>
        <td><strong>${escapeHtml(coupon.code)}</strong>${coupon.expiresAt ? `<br><small>Hasta ${escapeHtml(formatDate(coupon.expiresAt))}</small>` : ""}</td>
        <td>${coupon.type === "fixed" ? escapeHtml(formatMoney(coupon.value, state.settings?.currency)) : `${escapeHtml(String(coupon.value))}%`}${Number(coupon.minSubtotal || 0) > 0 ? `<br><small>Mínimo ${escapeHtml(formatMoney(coupon.minSubtotal, state.settings?.currency))}</small>` : ""}</td>
        <td>${escapeHtml(String(coupon.used || 0))}${Number(coupon.usageLimit || 0) > 0 ? ` / ${escapeHtml(String(coupon.usageLimit))}` : ""}</td>
        <td>${couponActive(coupon) ? '<span class="commerce-status is-paid">Activo</span>' : '<span class="commerce-status is-canceled">Inactivo</span>'}</td>
        <td><div class="commerce-row-actions"><button type="button" data-commerce-edit-coupon="${escapeAttr(coupon.id)}">Editar</button>${coupon.active === false ? "" : `<button class="is-danger" type="button" data-commerce-disable-coupon="${escapeAttr(coupon.id)}">Desactivar</button>`}</div></td>
      </tr>`).join("")}</tbody></table>`
    : emptyState("No hay promociones", "Crea un cupón cuando quieras lanzar una campaña o premiar a tus clientes.");
}

function fillSettings() {
  const form = refs.settingsForm;
  const settings = state.settings;
  if (!form || !settings) return;
  form.elements.enabled.checked = settings.enabled === true;
  form.elements.orderEmail.value = settings.orderEmail || "";
  form.elements.currency.value = settings.currency || "EUR";
  form.elements.taxRatePercent.value = settings.taxRatePercent ?? 21;
  form.elements.taxIncluded.checked = settings.taxIncluded !== false;
  form.elements.successUrl.value = settings.successUrl || "";
  form.elements.cancelUrl.value = settings.cancelUrl || "";
  form.elements.termsUrl.value = settings.termsUrl || "";
  form.elements.privacyUrl.value = settings.privacyUrl || "";
  form.elements.allowedCountries.value = (settings.allowedCountries || []).join(", ");
  form.elements.shippingMethods.value = serializeShippingMethods(settings.shippingMethods || []);
  ["products", "checkout", "webhook"].forEach((key) => {
    setText(`[data-commerce-endpoint="${key}"]`, absoluteEndpoint(state.endpoints?.[key] || ""));
  });
}

function openProductDialog(product = null) {
  if (!refs.productDialog || !refs.productForm) return;
  refs.productForm.reset();
  refs.productForm.elements.id.value = product?.id || "";
  refs.productForm.elements.name.value = product?.name || "";
  refs.productForm.elements.sku.value = product?.sku || "";
  refs.productForm.elements.category.value = product?.category || "General";
  refs.productForm.elements.price.value = product?.price ?? "";
  refs.productForm.elements.compareAtPrice.value = product?.compareAtPrice || "";
  refs.productForm.elements.stock.value = product?.stock ?? 0;
  refs.productForm.elements.image.value = product?.image || "";
  refs.productForm.elements.description.value = product?.description || "";
  refs.productForm.elements.tags.value = (product?.tags || []).join(", ");
  refs.productForm.elements.active.checked = product?.active !== false;
  refs.productDialogTitle.textContent = product ? "Editar producto" : "Añadir producto";
  hideFormError(refs.productError);
  openDialog(refs.productDialog);
  window.setTimeout(() => refs.productForm.elements.name.focus(), 30);
}

async function saveProduct(event) {
  event.preventDefault();
  const form = refs.productForm;
  const data = new FormData(form);
  const id = clean(data.get("id"));
  const button = form.querySelector("button[type='submit']");
  if (button) button.disabled = true;
  hideFormError(refs.productError);
  try {
    const payload = await apiRequest(resourcePath("products", id), {
      method: id ? "PATCH" : "POST",
      body: {
        name: clean(data.get("name")),
        sku: clean(data.get("sku")),
        category: clean(data.get("category")),
        price: Number(data.get("price") || 0),
        compareAtPrice: Number(data.get("compareAtPrice") || 0),
        stock: Number(data.get("stock") || 0),
        image: clean(data.get("image")),
        description: clean(data.get("description")),
        tags: clean(data.get("tags")).split(",").map(clean).filter(Boolean),
        active: form.elements.active.checked
      }
    });
    refs.productDialog.close();
    applyCommercePayload(payload.commerce);
    showNotice(id ? "Producto actualizado." : "Producto añadido al catálogo.");
    await loadCommerceData({ quiet: true });
    setCommerceView("products");
  } catch (error) {
    showFormError(refs.productError, readableError(error));
  } finally {
    if (button) button.disabled = false;
  }
}

function openCouponDialog(coupon = null) {
  if (!refs.couponDialog || !refs.couponForm) return;
  refs.couponForm.reset();
  refs.couponForm.elements.id.value = coupon?.id || "";
  refs.couponForm.elements.code.value = coupon?.code || "";
  refs.couponForm.elements.code.readOnly = Boolean(coupon);
  refs.couponForm.elements.type.value = coupon?.type || "percent";
  refs.couponForm.elements.value.value = coupon?.value ?? "";
  refs.couponForm.elements.minSubtotal.value = coupon?.minSubtotal || "";
  refs.couponForm.elements.maxDiscount.value = coupon?.maxDiscount || "";
  refs.couponForm.elements.usageLimit.value = coupon?.usageLimit || "";
  refs.couponForm.elements.expiresAt.value = toDateTimeLocal(coupon?.expiresAt);
  refs.couponForm.elements.active.checked = coupon?.active !== false;
  refs.couponDialogTitle.textContent = coupon ? `Editar ${coupon.code}` : "Nuevo cupón";
  hideFormError(refs.couponError);
  openDialog(refs.couponDialog);
  window.setTimeout(() => refs.couponForm.elements.code.focus(), 30);
}

async function saveCoupon(event) {
  event.preventDefault();
  const form = refs.couponForm;
  const data = new FormData(form);
  const id = clean(data.get("id"));
  const button = form.querySelector("button[type='submit']");
  if (button) button.disabled = true;
  hideFormError(refs.couponError);
  try {
    const payload = await apiRequest(resourcePath("coupons", id), {
      method: id ? "PATCH" : "POST",
      body: {
        code: clean(data.get("code")).toUpperCase(),
        type: clean(data.get("type")),
        value: Number(data.get("value") || 0),
        minSubtotal: Number(data.get("minSubtotal") || 0),
        maxDiscount: Number(data.get("maxDiscount") || 0),
        usageLimit: Number(data.get("usageLimit") || 0),
        expiresAt: clean(data.get("expiresAt")) ? new Date(String(data.get("expiresAt"))).toISOString() : "",
        active: form.elements.active.checked
      }
    });
    refs.couponDialog.close();
    applyCommercePayload(payload.commerce);
    showNotice(id ? "Cupón actualizado." : "Cupón creado.");
    await loadCommerceData({ quiet: true });
    setCommerceView("coupons");
  } catch (error) {
    showFormError(refs.couponError, readableError(error));
  } finally {
    if (button) button.disabled = false;
  }
}

function setCommerceView(view) {
  state.activeView = view || "overview";
  document.querySelectorAll("[data-commerce-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.commerceTab === state.activeView);
  });
  document.querySelectorAll("[data-commerce-view]").forEach((panel) => {
    const active = panel.dataset.commerceView === state.activeView;
    panel.classList.toggle("is-active", active);
    panel.hidden = !active;
  });
}

function applyCommercePayload(commerce) {
  if (!commerce || typeof commerce !== "object") return;
  state.commerce = commerce;
  document.dispatchEvent(new CustomEvent("dls:commerce-updated", {
    detail: { businessId: state.businessId, commerce }
  }));
}

function updatePublicLink() {
  if (!refs.publicLink) return;
  const url = state.publishedUrl;
  refs.publicLink.hidden = !url;
  refs.publicLink.href = url ? `${url.replace(/#.*$/, "")}#tienda` : "#";
}

async function apiRequest(path, options = {}) {
  const response = await fetch(window.LocalLiftApi?.url?.(path) || path, {
    method: options.method || "GET",
    headers: window.LocalLiftApi?.headers?.({ json: options.body !== undefined })
      || { Accept: "application/json", ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok) {
    const error = new Error(payload.error || `La petición devolvió ${response.status}`);
    error.status = response.status;
    error.code = payload.code || "";
    throw error;
  }
  return payload;
}

function resourcePath(resource, id = "") {
  const base = `/api/businesses/${encodeURIComponent(state.businessId)}/commerce`;
  return `${base}${resource ? `/${resource}` : ""}${id ? `/${encodeURIComponent(id)}` : ""}`;
}

function apiPublicBase() {
  const configured = clean(window.LocalLiftApi?.getBase?.());
  return configured || window.location.origin;
}

function absoluteEndpoint(value) {
  if (!value) return "—";
  try { return new URL(value, apiPublicBase()).toString(); } catch { return value; }
}

function arrayPayload(payload, key) {
  if (Array.isArray(payload?.items)) return payload.items;
  return Array.isArray(payload?.[key]) ? payload[key] : [];
}

function parseShippingMethods(value) {
  const rows = clean(value).split(/\r?\n/).map(clean).filter(Boolean);
  return rows.map((row, index) => {
    const [id, name, price, description] = row.split("|").map(clean);
    return {
      id: id || `shipping-${index + 1}`,
      name: name || id || `Entrega ${index + 1}`,
      price: Number(price || 0),
      description: description || "",
      active: true,
      default: index === 0,
      allowedCountries: clean(refs.settingsForm?.elements.allowedCountries?.value).split(",").map(clean).filter(Boolean)
    };
  });
}

function serializeShippingMethods(methods) {
  return methods
    .filter((item) => item.active !== false)
    .map((item) => [item.id, item.name, Number(item.price || 0), item.description || ""].join(" | "))
    .join("\n");
}

function orderStatusOptions(selected) {
  return Object.entries(ORDER_STATUS_LABELS)
    .map(([value, label]) => `<option value="${escapeAttr(value)}"${value === selected ? " selected" : ""}>${escapeHtml(label)}</option>`)
    .join("");
}

function statusPill(status) {
  return `<span class="commerce-status is-${escapeAttr(status || "pending")}">${escapeHtml(ORDER_STATUS_LABELS[status] || status || "Pendiente")}</span>`;
}

function couponActive(coupon) {
  if (coupon.active === false) return false;
  if (coupon.expiresAt && Date.parse(coupon.expiresAt) <= Date.now()) return false;
  if (Number(coupon.usageLimit || 0) > 0 && Number(coupon.used || 0) >= Number(coupon.usageLimit || 0)) return false;
  return true;
}

function emptyState(title, copy, action = "") {
  return `<div class="commerce-empty"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p>${action}</div>`;
}

function setLoading(value) {
  refs.module?.setAttribute("aria-busy", String(Boolean(value)));
}

function showNotice(message, tone = "success") {
  if (!refs.notice) return;
  refs.notice.hidden = !message;
  refs.notice.textContent = message || "";
  refs.notice.className = `module-notice${message && tone ? ` is-${tone}` : ""}`;
}

function showFormError(element, message) {
  if (!element) return;
  element.hidden = false;
  element.textContent = message;
}

function hideFormError(element) {
  if (!element) return;
  element.hidden = true;
  element.textContent = "";
}

function openDialog(dialog) {
  if (typeof dialog?.showModal === "function") dialog.showModal();
  else dialog?.setAttribute("open", "");
}

function readableError(error) {
  if (error?.code === "commerce_product_sku_duplicate") return "Ya existe otro producto con ese SKU.";
  if (error?.code === "commerce_coupon_duplicate") return "Ya existe un cupón con ese código.";
  if (error?.code === "commerce_stock_insufficient") return "No hay stock suficiente para completar la acción.";
  return error?.message || "No se pudo completar la acción.";
}

function setText(selector, value) {
  const element = document.querySelector(selector);
  if (element) element.textContent = value;
}

function formatMoney(value, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: /^[A-Z]{3}$/.test(clean(currency).toUpperCase()) ? clean(currency).toUpperCase() : "EUR"
  }).format(Number(value || 0));
}

function formatDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(date)
    : "—";
}

function formatDateTime(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date)
    : "—";
}

function toDateTimeLocal(value) {
  const date = new Date(value || "");
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function plural(value, singular, pluralValue) {
  return Number(value) === 1 ? singular : pluralValue;
}

function escapeHtml(value) {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function clean(value) {
  return String(value ?? "").trim();
}
