(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.commerce = {
    createCommerceModel
  };

  function createCommerceModel(options = {}) {
    const {
      demoBusiness,
      textOr,
      numberOr,
      parseLines,
      parsePrice,
      formatPlainPrice,
      normalizeCurrency,
      normalizeOptionalUrl,
      normalizeImage,
      slugify
    } = options;

    if (!demoBusiness?.commerce) {
      throw new Error("Commerce model requires demoBusiness.commerce defaults");
    }

    return {
      serializeProducts,
      parseProducts,
      normalizeCommerce,
      normalizeShippingMethods,
      normalizeProducts,
      normalizeProduct,
      readStoreContext,
      deriveStoreEndpoint,
      showStorePaymentNotice,
      toDatetimeLocalValue
    };

    function serializeProducts(products = []) {
      return normalizeProducts(products)
        .map((product) => [
          product.name,
          formatPlainPrice(product.price),
          product.image,
          product.description,
          product.sku,
          product.stock
        ].join(" | "))
        .join("\n");
    }

    function parseProducts(value) {
      return parseLines(value)
        .map((line, index) => {
          const [name, price, image, description, sku, stock] = line.split("|").map((part) => part.trim());
          return normalizeProduct({ name, price, image, description, sku, stock }, index);
        })
        .filter((product) => product.name && product.price > 0);
    }

    function normalizeCommerce(commerce = {}) {
      const source = { ...demoBusiness.commerce, ...(commerce || {}) };
      return {
        enabled: Boolean(source.enabled),
        title: textOr(source.title, demoBusiness.commerce.title),
        intro: textOr(source.intro, demoBusiness.commerce.intro),
        currency: normalizeCurrency(source.currency),
        taxRatePercent: numberOr(source.taxRatePercent, demoBusiness.commerce.taxRatePercent),
        taxIncluded: source.taxIncluded !== false,
        checkoutEndpoint: normalizeOptionalUrl(source.checkoutEndpoint),
        productsEndpoint: normalizeOptionalUrl(source.productsEndpoint),
        successUrl: normalizeOptionalUrl(source.successUrl),
        cancelUrl: normalizeOptionalUrl(source.cancelUrl),
        termsUrl: normalizeOptionalUrl(source.termsUrl),
        privacyUrl: normalizeOptionalUrl(source.privacyUrl),
        orderEmail: textOr(source.orderEmail, ""),
        deliveryMode: textOr(source.deliveryMode, demoBusiness.commerce.deliveryMode),
        shippingMethods: normalizeShippingMethods(source.shippingMethods),
        products: normalizeProducts(source.products).filter((product) => product.active)
      };
    }

    function normalizeShippingMethods(methods = []) {
      const source = Array.isArray(methods) && methods.length ? methods : demoBusiness.commerce.shippingMethods;
      const shippingMethods = source.map((method, index) => ({
        id: slugify(method.id || method.name || `shipping-${index + 1}`),
        name: textOr(method.name, `Envio ${index + 1}`),
        description: textOr(method.description, ""),
        price: parsePrice(method.price),
        active: method.active !== false,
        default: Boolean(method.default)
      }));

      if (!shippingMethods.some((method) => method.default) && shippingMethods[0]) {
        shippingMethods[0].default = true;
      }

      return shippingMethods.filter((method) => method.active);
    }

    function normalizeProducts(products = []) {
      if (!Array.isArray(products)) {
        return [];
      }

      return products
        .map((product, index) => normalizeProduct(product, index))
        .filter((product) => product.name && product.price > 0);
    }

    function normalizeProduct(product = {}, index = 0) {
      const name = textOr(product.name, "");
      const fallbackProducts = demoBusiness.commerce?.products || [];
      const fallbackProduct = fallbackProducts[index % Math.max(fallbackProducts.length, 1)] || {};
      const sku = slugify(product.sku || product.id || name || `producto-${index + 1}`);
      const id = slugify(product.id || sku || name || `producto-${index + 1}`);
      const price = parsePrice(product.price);
      const stock = Math.max(0, Math.floor(numberOr(product.stock, 999)));

      return {
        id,
        sku,
        name,
        price,
        image: normalizeImage(product.image, fallbackProduct.image || demoBusiness.heroImage),
        description: textOr(product.description, "Producto disponible para compra online."),
        stock,
        active: product.active !== false
      };
    }

    function readStoreContext(store) {
      try {
        return JSON.parse(store?.dataset?.storeContext || "{}");
      } catch (error) {
        return {};
      }
    }

    function deriveStoreEndpoint(endpoint, pathname) {
      const url = String(endpoint || "").trim();
      if (!url || !pathname) return "";

      try {
        const parsed = new URL(url);
        const resource = pathname.match(/\/api\/store\/(.+)$/)?.[1] || "";
        const marker = parsed.pathname.lastIndexOf("/store/");
        parsed.pathname = resource && marker >= 0
          ? `${parsed.pathname.slice(0, marker + 7)}${resource}`
          : pathname;
        parsed.search = "";
        return parsed.toString();
      } catch (error) {
        return "";
      }
    }

    function showStorePaymentNotice(target) {
      if (!target) return;

      const params = new URLSearchParams(global.location?.search || "");
      if (params.get("pedido") === "ok" || params.get("payment") === "success") {
        target.hidden = false;
        target.textContent = "Pago recibido. El negocio recibira el pedido y el comprador recibira confirmacion por email.";
      }
    }

    function toDatetimeLocalValue(date) {
      const pad = (value) => String(value).padStart(2, "0");
      return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
      ].join("-") + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }
  }
})(globalThis);
