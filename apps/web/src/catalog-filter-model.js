/* Pure catalog filter normalization and API serialization. */
(function exposeCatalogFilterModel(root) {
  function uniqueNumbers(values) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map(Number)
      .filter(Number.isFinite))].sort((left, right) => left - right);
  }

  function uniqueStrings(values) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map((value) => String(value || "").trim())
      .filter(Boolean))].sort();
  }

  function normalize(value = {}) {
    return {
      search: String(value.search || "").trim(),
      subject: String(value.subject || "").trim(),
      levels: uniqueNumbers(value.levels),
      credits: uniqueNumbers(value.credits),
      availability: value.availability === "open" ? "open" : "any",
      requirementIntentId: value.requirementIntentId
        ? String(value.requirementIntentId)
        : null,
      coreCodes: uniqueStrings(value.coreCodes),
    };
  }

  function toSearchParams(value, { limit = 25, offset = 0 } = {}) {
    const filters = normalize(value);
    const params = new URLSearchParams({
      search: filters.search,
      subject: filters.subject,
      limit: String(limit),
      offset: String(offset),
    });
    if (filters.levels.length) params.set("levels", filters.levels.join(","));
    if (filters.credits.length) params.set("credits", filters.credits.join(","));
    if (filters.availability === "open") params.set("availability", "open");
    if (filters.coreCodes.length) params.set("core", filters.coreCodes.join(","));
    return params;
  }

  function coreCodeFromLabel(label) {
    const match = String(label || "").match(/\[([A-Za-z][A-Za-z0-9]{1,7})\]/);
    return match ? match[1] : null;
  }

  root.ScheduleRUCatalogFilterModel = {
    normalize,
    toSearchParams,
    coreCodeFromLabel,
  };
})(globalThis);
