(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.storefront = {
    createStorefrontController
  };

  function createStorefrontController(options = {}) {
    const {
      demoBusiness,
      renderProductCard,
      trackEvent
    } = options;
    const {
      escapeAttr,
      escapeHtml,
      formatMoney,
      normalizeCurrency,
      numberOr,
      roundMoney,
      textOr
    } = options.core || {};
    const {
      deriveStoreEndpoint,
      normalizeCommerce,
      normalizeProducts,
      normalizeShippingMethods,
      readStoreContext,
      showStorePaymentNotice
    } = options.commerce || {};

    return {
      attachStore
    };

    function attachStore(container, business) {
      container.querySelectorAll("[data-store]").forEach((store) => {
        bindStore(store, business);
      });
    }

    function bindStore(store, business) {
      const context = readStoreContext(store);
      const commerce = normalizeCommerce(context.commerce || {});
      let products = commerce.products.length ? commerce.products : demoBusiness.commerce.products;
      let shippingMethods = commerce.shippingMethods.length
        ? commerce.shippingMethods
        : demoBusiness.commerce.shippingMethods;
      let selectedShippingId = shippingMethods.find((method) => method.default)?.id
        || shippingMethods[0]?.id
        || "pickup";
      let quoteSeq = 0;
      const cart = new Map();
      const productsTarget = store.querySelector("[data-store-products]");
      const itemsTarget = store.querySelector("[data-cart-items]");
      const totalTarget = store.querySelector("[data-cart-total]");
      const summaryTarget = store.querySelector("[data-order-summary]");
      const shippingTarget = store.querySelector("[data-shipping-options]");
      const statusTarget = store.querySelector("[data-store-status]");
      const paymentNotice = store.querySelector("[data-store-payment-notice]");
      const checkoutForm = store.querySelector("[data-store-checkout]");
      const couponInput = checkoutForm?.elements.couponCode;
      const mobileCartBar = store.querySelector("[data-mobile-cart-bar]");
      const mobileCartTotal = store.querySelector("[data-mobile-cart-total]");
      const siteRoot = store.closest(".generated-site");

      const setStatus = (message) => {
        if (statusTarget) statusTarget.textContent = message;
      };

      const cartLines = () => Array.from(cart.entries())
        .map(([id, quantity]) => ({ product: products.find((item) => item.id === id), quantity }))
        .filter((item) => item.product && item.quantity > 0);

      const quotePayload = () => ({
        currency: commerce.currency,
        shippingMethodId: selectedShippingId,
        couponCode: textOr(couponInput?.value, ""),
        items: cartLines().map(({ product, quantity }) => ({
          id: product.id,
          sku: product.sku,
          quantity
        }))
      });

      const bindProductButtons = () => {
        store.querySelectorAll("[data-add-product]").forEach((button) => {
          button.addEventListener("click", () => {
            const productId = button.dataset.addProduct || "";
            const product = products.find((item) => item.id === productId);

            if (!product) return;

            cart.set(productId, (cart.get(productId) || 0) + 1);
            renderCart();
            refreshQuote();
            setStatus(`${product.name} anadido al carrito.`);
            trackEvent("store_add_to_cart", { business: business.name, product: product.name });
          });
        });
      };

      const renderProducts = () => {
        if (!productsTarget) return;
        productsTarget.innerHTML = products
          .map((product) => renderProductCard(product, commerce.currency))
          .join("");
        productsTarget.querySelectorAll(".reveal").forEach((item) => item.classList.add("is-visible"));
        bindProductButtons();
      };

      const renderCart = () => {
        const lines = cartLines();

        if (!itemsTarget) return;
        if (!lines.length) {
          itemsTarget.innerHTML = '<p class="store-empty">Anade productos para empezar.</p>';
          renderSummary(localQuote());
          return;
        }

        itemsTarget.innerHTML = lines.map(({ product, quantity }) => `
          <div class="cart-line">
            <div>
              <strong>${escapeHtml(product.name)}</strong>
              <span>${escapeHtml(formatMoney(product.price, commerce.currency))} x ${quantity}</span>
            </div>
            <div class="cart-line-actions">
              <button type="button" data-cart-dec="${escapeAttr(product.id)}">-</button>
              <span>${quantity}</span>
              <button type="button" data-cart-inc="${escapeAttr(product.id)}">+</button>
            </div>
          </div>
        `).join("");

        itemsTarget.querySelectorAll("[data-cart-dec]").forEach((button) => {
          button.addEventListener("click", () => {
            const id = button.dataset.cartDec || "";
            const next = (cart.get(id) || 0) - 1;
            if (next > 0) cart.set(id, next);
            else cart.delete(id);
            renderCart();
            refreshQuote();
          });
        });

        itemsTarget.querySelectorAll("[data-cart-inc]").forEach((button) => {
          button.addEventListener("click", () => {
            const id = button.dataset.cartInc || "";
            cart.set(id, (cart.get(id) || 0) + 1);
            renderCart();
            refreshQuote();
          });
        });
      };

      const renderShippingMethods = () => {
        if (!shippingTarget) return;
        shippingTarget.innerHTML = `
          <legend>Entrega</legend>
          ${shippingMethods.map((method) => `
            <label class="store-shipping-option">
              <input type="radio" name="shippingMethodId" value="${escapeAttr(method.id)}" ${method.id === selectedShippingId ? "checked" : ""}>
              <span>
                <strong>${escapeHtml(method.name)}</strong>
                <small>${escapeHtml(method.description || "")}</small>
              </span>
              <em>${escapeHtml(formatMoney(method.price, commerce.currency))}</em>
            </label>
          `).join("")}
        `;
        shippingTarget.querySelectorAll("input[name='shippingMethodId']").forEach((input) => {
          input.addEventListener("change", () => {
            selectedShippingId = input.value;
            refreshQuote();
          });
        });
      };

      const renderSummary = (quote) => {
        const totals = quote.totals || {};
        const hasItems = cartLines().length > 0;
        if (totalTarget) totalTarget.textContent = formatMoney(totals.total || 0, quote.currency || commerce.currency);
        if (mobileCartTotal) mobileCartTotal.textContent = formatMoney(totals.total || 0, quote.currency || commerce.currency);
        if (mobileCartBar) mobileCartBar.hidden = !hasItems;
        siteRoot?.classList.toggle("has-mobile-cart", hasItems);
        if (!summaryTarget) return;
        summaryTarget.innerHTML = [
          ["Subtotal", totals.subtotal || 0],
          ["Descuento", totals.discount ? -Math.abs(totals.discount) : 0],
          ["Envio", totals.shipping || 0],
          [quote.taxIncluded ? "Impuestos incluidos" : "Impuestos", totals.tax || 0],
          ["Total", totals.total || 0, true]
        ].map(([label, value, strong]) => `
          <div class="${strong ? "is-total" : ""}">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(formatMoney(value, quote.currency || commerce.currency))}</strong>
          </div>
        `).join("");
      };

      const localQuote = () => {
        const lines = cartLines();
        const subtotal = roundMoney(lines.reduce(
          (sum, item) => sum + item.product.price * item.quantity,
          0
        ));
        const shipping = shippingMethods.find((method) => method.id === selectedShippingId)?.price || 0;
        const taxableBase = Math.max(0, subtotal + shipping);
        const taxRatePercent = commerce.taxRatePercent || 0;
        const tax = commerce.taxIncluded
          ? roundMoney(taxableBase - taxableBase / (1 + taxRatePercent / 100))
          : roundMoney(taxableBase * (taxRatePercent / 100));
        const total = commerce.taxIncluded ? roundMoney(taxableBase) : roundMoney(taxableBase + tax);
        return {
          currency: commerce.currency,
          taxIncluded: commerce.taxIncluded,
          totals: { subtotal, discount: 0, shipping, tax, taxRatePercent, total }
        };
      };

      const refreshQuote = async () => {
        const seq = ++quoteSeq;
        const lines = cartLines();
        if (!lines.length) {
          renderSummary(localQuote());
          return;
        }

        renderSummary(localQuote());
        const validateEndpoint = deriveStoreEndpoint(
          commerce.checkoutEndpoint || commerce.productsEndpoint,
          "/api/store/cart/validate"
        );
        if (!validateEndpoint) return;

        try {
          const response = await fetch(validateEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(quotePayload())
          });
          const quote = await response.json();
          if (seq !== quoteSeq) return;
          if (!response.ok) throw new Error(quote.error || "No se pudo validar el carrito");
          renderSummary(quote);
          setStatus(quote.coupon ? `Cupon ${quote.coupon.code} aplicado.` : "");
        } catch (error) {
          if (seq === quoteSeq && couponInput?.value.trim()) {
            setStatus(error.message || "No se pudo aplicar el cupon.");
          }
        }
      };

      const loadProducts = async () => {
        if (!commerce.productsEndpoint) return;

        try {
          const response = await fetch(commerce.productsEndpoint);
          if (!response.ok) return;
          const data = await response.json();
          const remoteProducts = normalizeProducts(data.products || data);
          if (!remoteProducts.length) return;
          products = remoteProducts;
          commerce.products = remoteProducts;
          renderProducts();
          renderCart();
          refreshQuote();
          setStatus("Catalogo sincronizado con la base de datos.");
        } catch (error) {
          // The embedded catalog keeps the preview and exported page usable offline.
        }
      };

      const loadConfig = async () => {
        const configEndpoint = deriveStoreEndpoint(
          commerce.productsEndpoint || commerce.checkoutEndpoint,
          "/api/store/config"
        );
        if (!configEndpoint) return;

        try {
          const response = await fetch(configEndpoint);
          if (!response.ok) return;
          const data = await response.json();
          const settings = data.settings || {};
          if (settings.currency) commerce.currency = normalizeCurrency(settings.currency);
          commerce.taxRatePercent = numberOr(settings.taxRatePercent, commerce.taxRatePercent);
          commerce.taxIncluded = settings.taxIncluded !== false;
          if (Array.isArray(settings.shippingMethods) && settings.shippingMethods.length) {
            shippingMethods = normalizeShippingMethods(settings.shippingMethods);
            selectedShippingId = shippingMethods.find((method) => method.default)?.id
              || shippingMethods[0]?.id
              || selectedShippingId;
            renderShippingMethods();
            refreshQuote();
          }
        } catch (error) {
          // Local checkout settings remain available without API config.
        }
      };

      couponInput?.addEventListener("input", () => {
        global.clearTimeout(couponInput.dataset.timer);
        couponInput.dataset.timer = global.setTimeout(refreshQuote, 350);
      });

      checkoutForm?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const lines = cartLines();

        if (!lines.length) {
          setStatus("Anade al menos un producto antes de pagar.");
          return;
        }

        if (!commerce.checkoutEndpoint) {
          setStatus("Falta configurar el endpoint de checkout Stripe.");
          return;
        }

        const data = new FormData(checkoutForm);
        const fallbackUrl = `${global.location.origin}${global.location.pathname}`;
        const payload = {
          businessId: context.business?.id || business.id || "",
          businessSlug: context.business?.slug || business.slug || "",
          businessName: context.business?.name || business.name,
          orderEmail: commerce.orderEmail || business.email,
          currency: commerce.currency,
          successUrl: commerce.successUrl || `${fallbackUrl}?pedido=ok`,
          cancelUrl: commerce.cancelUrl || `${fallbackUrl}#tienda`,
          shippingMethodId: selectedShippingId,
          couponCode: textOr(data.get("couponCode"), ""),
          customer: {
            name: textOr(data.get("customerName"), ""),
            email: textOr(data.get("customerEmail"), ""),
            phone: textOr(data.get("customerPhone"), ""),
            address: textOr(data.get("customerAddress"), "")
          },
          items: lines.map(({ product, quantity }) => ({
            id: product.id,
            sku: product.sku,
            quantity
          }))
        };

        setStatus("Creando pago seguro...");
        trackEvent("store_checkout_start", {
          business: business.name,
          items: lines.length,
          contact: payload.customer.email || payload.customer.phone || ""
        });

        try {
          const response = await fetch(commerce.checkoutEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });
          const result = await response.json().catch(() => ({}));

          if (!response.ok || !(result.url || result.checkoutUrl)) {
            throw new Error(result.error || "Checkout failed");
          }

          global.location.href = result.url || result.checkoutUrl;
        } catch (error) {
          setStatus("No se pudo iniciar el pago. Revisa la API de tienda y las claves de Stripe.");
        }
      });

      renderShippingMethods();
      bindProductButtons();
      renderCart();
      refreshQuote();
      showStorePaymentNotice(paymentNotice);
      loadConfig();
      loadProducts();
    }
  }
})(globalThis);
