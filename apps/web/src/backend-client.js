(function exposeBackendClient(root) {
  const PRODUCTION_BACKEND_URL = "https://rutgers-course-sync.housselllaura.workers.dev";
  const DEVELOPMENT_BACKEND_URL = "https://rutgers-course-sync-dev.housselllaura.workers.dev";
  const LOCAL_DEVELOPMENT_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
  const PRODUCTION_PAGES_HOST = "scheduleru-9fb.pages.dev";

  function normalizedHostname(value) {
    return String(value || "").trim().toLowerCase();
  }

  function siteConfig({ hostname = "", storage = null } = {}) {
    const host = normalizedHostname(hostname);
    const development = LOCAL_DEVELOPMENT_HOSTS.has(host)
      || (host.endsWith(`.${PRODUCTION_PAGES_HOST}`) && host !== PRODUCTION_PAGES_HOST);
    const storageKey = development ? "scheduleru_dev_backend_url" : "bait_backend_url";
    const defaultUrl = development ? DEVELOPMENT_BACKEND_URL : PRODUCTION_BACKEND_URL;
    let initialUrl = defaultUrl;
    try {
      initialUrl = storage?.getItem(storageKey) || defaultUrl;
    } catch {
      // Browser privacy settings can make local storage unavailable.
    }
    return { defaultUrl, initialUrl, storageKey };
  }

  function saveUrl({ storage = null, storageKey, value } = {}) {
    const normalized = String(value || "").trim().replace(/\/+$/, "");
    try {
      storage?.setItem(storageKey, normalized);
    } catch {
      // A usable in-memory URL is still valuable when persistence is blocked.
    }
    return normalized;
  }

  function requestError({ code, status = null, retryable = false, detail = null }) {
    const error = new Error(code);
    error.name = "ScheduleRURequestError";
    error.code = code;
    error.status = status;
    error.retryable = retryable;
    error.detail = detail;
    return error;
  }

  async function fetchJson({
    baseUrl,
    path,
    options = {},
    fetchImpl = root.fetch,
  } = {}) {
    const normalizedBase = String(baseUrl || "").trim().replace(/\/+$/, "");
    if (!normalizedBase) throw requestError({ code: "backend_not_configured" });
    if (typeof fetchImpl !== "function") throw requestError({ code: "backend_unavailable", retryable: true });
    let response;
    try {
      response = await fetchImpl(`${normalizedBase}${path}`, options);
    } catch (error) {
      throw requestError({
        code: "backend_unavailable",
        retryable: true,
        detail: String(error?.message || error || "Network request failed"),
      });
    }
    const text = await response.text();
    if (!response.ok) throw requestError({
      code: response.status === 404 ? "backend_not_found" : "backend_http_error",
      status: response.status,
      retryable: response.status === 408 || response.status === 429 || response.status >= 500,
      detail: text.slice(0, 1000),
    });
    try {
      return JSON.parse(text);
    } catch {
      throw requestError({
        code: "invalid_response",
        status: response.status || 200,
        retryable: true,
        detail: text.slice(0, 1000),
      });
    }
  }

  root.ScheduleRUBackendClient = { fetchJson, saveUrl, siteConfig };
})(globalThis);
