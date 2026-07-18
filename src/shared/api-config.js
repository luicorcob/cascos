(function () {
  const API_BASE_KEY = "locallift_api_base";
  const ADMIN_TOKEN_KEY = "locallift_admin_token";
  const CLIENT_SESSION_KEY = "locallift_client_session";
  const BUSINESS_USER_TOKEN_KEY = "locallift_business_user_token";

  syncApiBaseFromQuery();

  window.LocalLiftApi = {
    url,
    headers,
    getBase,
    setBase,
    getAdminToken,
    getClientSession,
    setClientSession,
    clearClientSession,
    isClientMode
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

    const adminToken = getAdminToken();
    if (adminToken) {
      result.Authorization = `Bearer ${adminToken}`;
      result["X-LocalLift-Admin-Token"] = adminToken;
      return result;
    }

    const clientSession = getClientSession();
    if (clientSession?.token) {
      result["X-LocalLift-Client-Token"] = clientSession.token;
      return result;
    }

    const businessUserToken = String(localStorage.getItem(BUSINESS_USER_TOKEN_KEY) || "").trim();
    if (businessUserToken) {
      result["X-LocalLift-User-Token"] = businessUserToken;
    }

    return result;
  }

  function getBase() {
    const queryBase = new URLSearchParams(window.location.search).get("apiBase");
    if (String(queryBase || "").trim().toLowerCase() === "same-origin") {
      return "";
    }

    const configured = cleanBase(window.LOCALLIFT_API_BASE)
      || cleanBase(document.querySelector('meta[name="locallift-api-base"]')?.content)
      || cleanBase(localStorage.getItem(API_BASE_KEY));

    return rewriteLocalStaticBase(configured)
      || inferLocalBackendBase();
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

  function getClientSession() {
    try {
      const session = JSON.parse(localStorage.getItem(CLIENT_SESSION_KEY) || "null");

      if (!session?.token) {
        return null;
      }

      if (session.exp && Number(session.exp) * 1000 < Date.now()) {
        clearClientSession();
        return null;
      }

      return session;
    } catch (error) {
      clearClientSession();
      return null;
    }
  }

  function setClientSession(session) {
    if (session?.token) {
      localStorage.setItem(CLIENT_SESSION_KEY, JSON.stringify(session));
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      localStorage.removeItem(BUSINESS_USER_TOKEN_KEY);
      return session;
    }

    clearClientSession();
    return null;
  }

  function clearClientSession() {
    localStorage.removeItem(CLIENT_SESSION_KEY);
  }

  function isClientMode() {
    return Boolean(getClientSession());
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

  function inferLocalBackendBase() {
    const { protocol, hostname, port } = window.location;

    if (
      protocol !== "http:"
      || !["127.0.0.1", "localhost"].includes(hostname)
      || !port
      || port === "5173"
    ) {
      return "";
    }

    return `http://${hostname}:5173`;
  }

  function rewriteLocalStaticBase(base) {
    if (!base) {
      return "";
    }

    try {
      const parsed = new URL(base);
      const isLocal = ["127.0.0.1", "localhost"].includes(parsed.hostname);
      const isCurrentStaticOrigin = parsed.origin === window.location.origin && window.location.port !== "5173";

      if (isLocal && isCurrentStaticOrigin) {
        return `http://${parsed.hostname}:5173`;
      }
    } catch (error) {
      return base;
    }

    return base;
  }
})();
