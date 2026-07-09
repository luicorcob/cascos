(function (global) {
  const studio = global.LocalLiftStudio = global.LocalLiftStudio || {};

  studio.data = {
    apiUrl,
    apiHeaders,
    createBusinessDataClient,
    toApiRecordMeta
  };

  function createBusinessDataClient(options = {}) {
    const basePath = options.basePath || "/api/businesses";
    const storage = options.storage;
    const storageKey = options.storageKey || "locallift-studio-business-api-record";
    const buildPayload = options.buildPayload || ((business) => ({ business }));

    return {
      save,
      fetchOne,
      fetchFirst,
      getStoredRecord,
      storeRecord
    };

    async function save(business, activeRecord) {
      const record = activeRecord || getStoredRecord();
      const id = record?.id || record?.slug || "";
      const method = id ? "PUT" : "POST";
      const response = await fetch(id ? `${apiUrl(basePath)}/${encodeURIComponent(id)}` : apiUrl(basePath), {
        method,
        headers: apiHeaders({ json: true }),
        body: JSON.stringify(buildPayload(business, record))
      });

      const result = await readApiJson(response);
      return result.business;
    }

    async function fetchOne(idOrSlug) {
      if (!idOrSlug) {
        throw new Error("Missing business id");
      }

      const response = await fetch(`${apiUrl(basePath)}/${encodeURIComponent(idOrSlug)}`, {
        headers: apiHeaders()
      });
      const result = await readApiJson(response);
      return result.business;
    }

    async function fetchFirst() {
      const response = await fetch(`${apiUrl(basePath)}?includeArchived=false`, {
        headers: apiHeaders()
      });
      const result = await readApiJson(response);
      const [business] = result.businesses || [];

      if (!business) {
        throw new Error("No businesses available");
      }

      return fetchOne(business.id || business.slug);
    }

    function getStoredRecord() {
      try {
        const raw = storage?.getItem(storageKey);
        return raw ? JSON.parse(raw) : null;
      } catch (error) {
        return null;
      }
    }

    function storeRecord(record) {
      try {
        if (!record) {
          storage?.removeItem(storageKey);
          return;
        }

        storage?.setItem(storageKey, JSON.stringify(record));
      } catch (error) {
        // The editor remains usable when browser storage is unavailable.
      }
    }
  }

  function apiUrl(path) {
    return global.LocalLiftApi?.url(path) || path;
  }

  function apiHeaders(options = {}) {
    if (global.LocalLiftApi?.headers) {
      return global.LocalLiftApi.headers(options);
    }

    const headers = {
      Accept: "application/json"
    };

    if (options.json) {
      headers["Content-Type"] = "application/json";
    }

    let token = "";
    try {
      token = global.localStorage?.getItem("locallift_admin_token") || "";
    } catch (error) {
      token = "";
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`;
      headers["X-LocalLift-Admin-Token"] = token;
    }

    return headers;
  }

  function toApiRecordMeta(record) {
    if (!record) {
      return null;
    }

    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      plan: record.plan,
      status: record.status,
      publishedUrl: record.publishedUrl || "",
      activeDemo: record.settings?.activeDemo || record.activeDemo || null
    };
  }

  async function readApiJson(response) {
    let result = {};

    try {
      result = await response.json();
    } catch (error) {
      result = {};
    }

    if (!response.ok) {
      throw new Error(result.error || "Business API request failed");
    }

    return result;
  }
})(globalThis);
