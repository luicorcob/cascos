(function () {
  const API_BASE_KEY = "locallift_api_base";
  const ADMIN_TOKEN_KEY = "locallift_admin_token";

  syncApiBaseFromQuery();

  window.LocalLiftApi = {
    url,
    headers,
    getBase,
    setBase,
    getAdminToken
  };

  function url(path) {
    if (!path || isAbsoluteUrl(path) || path.startsWith("#") || path.startsWith("mailto:") || path.startsWith("tel:")) {
      return path;
    }

    const base = getBase();
    if (!base) {
      return path;
    }

    return `${base}${path.startsWith("/") ? path : `/${path}`}`;
  }

  function headers(options = {}) {
    const result = {
      Accept: "application/json"
    };

    if (options.json) {
      result["Content-Type"] = "application/json";
    }

    const token = getAdminToken();
    if (token) {
      result.Authorization = `Bearer ${token}`;
      result["X-LocalLift-Admin-Token"] = token;
    }

    return result;
  }

  function getBase() {
    return cleanBase(window.LOCALLIFT_API_BASE)
      || cleanBase(document.querySelector('meta[name="locallift-api-base"]')?.content)
      || cleanBase(localStorage.getItem(API_BASE_KEY));
  }

  function setBase(value) {
    const base = cleanBase(value);

    if (base) {
      localStorage.setItem(API_BASE_KEY, base);
    } else {
      localStorage.removeItem(API_BASE_KEY);
    }

    return base;
  }

  function getAdminToken() {
    return String(localStorage.getItem(ADMIN_TOKEN_KEY) || "").trim();
  }

  function syncApiBaseFromQuery() {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("apiBase")) {
      return;
    }

    setBase(params.get("apiBase"));
  }

  function cleanBase(value) {
    const base = String(value || "").trim();

    if (!base || ["same-origin", "local", "none"].includes(base.toLowerCase())) {
      return "";
    }

    return base.replace(/\/+$/, "");
  }

  function isAbsoluteUrl(value) {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(String(value || ""));
  }
})();
