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

  async function fetchJson({
    baseUrl,
    path,
    options = {},
    fetchImpl = root.fetch,
  } = {}) {
    const normalizedBase = String(baseUrl || "").trim().replace(/\/+$/, "");
    if (!normalizedBase) throw new Error("No backend URL set.");
    if (typeof fetchImpl !== "function") throw new Error("Backend requests are unavailable.");
    const response = await fetchImpl(`${normalizedBase}${path}`, options);
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status} — ${text.slice(0, 150)}`);
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Response wasn't JSON: ${text.slice(0, 150)}`);
    }
  }

  root.ScheduleRUBackendClient = { fetchJson, saveUrl, siteConfig };
})(globalThis);
