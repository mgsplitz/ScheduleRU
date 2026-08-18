(function exposePlannerStateStore(root) {
  const STORAGE_KEY = "scheduleru_planner_state_v1";
  const LEGACY_VERSIONS = new Set([1, 2, 3, 4]);
  const OBJECT_FIELDS = [
    "apOn",
    "completed",
    "schedule",
    "wishlist",
    "groupSelections",
    "creditLedger",
  ];
  const OPTIONAL_FIELDS = [
    "onboarding",
    "academicPosition",
    "academicRecords",
    "academicCalendarStartYear",
    "primaryProgramId",
    "secondaryProgramId",
    "generatedPlanPreview",
    "schedulePreferences",
    "planPlaceholders",
    "issueDismissals",
    "activeRequirementChoice",
    "choicePreferences",
  ];

  const savedObject = (value) => (
    value && typeof value === "object" && !Array.isArray(value) ? value : {}
  );

  function storageReady(storage, method) {
    return storage && typeof storage[method] === "function";
  }

  function load({ storage, currentVersion, migrate }) {
    if (!storageReady(storage, "getItem") || typeof migrate !== "function") return null;
    try {
      const saved = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) return null;
      if (!LEGACY_VERSIONS.has(saved.version) && saved.version !== currentVersion) return null;

      const selectedPrograms = Array.isArray(saved.selectedPrograms)
        ? saved.selectedPrograms.filter((id) => typeof id === "string")
        : [];
      const migratable = {
        version: saved.version,
        selectedPrograms,
        selectedProgramIds: Array.isArray(saved.selectedProgramIds)
          ? saved.selectedProgramIds
          : selectedPrograms,
        programSelectionConfirmed: saved.programSelectionConfirmed === true,
      };
      for (const field of OBJECT_FIELDS) migratable[field] = savedObject(saved[field]);
      for (const field of OPTIONAL_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(saved, field)) migratable[field] = saved[field];
      }
      const year = Number(saved.year);
      if (Number.isInteger(year) && year >= 1 && year <= 8) migratable.year = year;
      if (typeof saved.homeSchoolSlug === "string" && /^[a-z0-9-]{2,80}$/.test(saved.homeSchoolSlug)) {
        migratable.homeSchoolSlug = saved.homeSchoolSlug;
      }

      const migrated = migrate(migratable);
      for (const field of OBJECT_FIELDS) migrated[field] = savedObject(migrated[field]);
      migrated.selectedPrograms = selectedPrograms;
      return migrated;
    } catch (_error) {
      return null;
    }
  }

  function save({ storage, state, currentVersion, now = Date.now }) {
    if (!storageReady(storage, "setItem")) return false;
    try {
      const payload = {
        version: currentVersion,
        savedAt: typeof now === "function" ? now() : Number(now),
      };
      for (const field of OBJECT_FIELDS) payload[field] = state?.[field];
      payload.year = state?.year;
      payload.homeSchoolSlug = state?.homeSchoolSlug;
      payload.selectedPrograms = state?.selectedPrograms;
      for (const field of OPTIONAL_FIELDS) payload[field] = state?.[field];
      payload.programSelectionConfirmed = state?.programSelectionConfirmed === true;
      storage.setItem(STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (_error) {
      return false;
    }
  }

  function clear({ storage }) {
    if (!storageReady(storage, "removeItem")) return false;
    try {
      storage.removeItem(STORAGE_KEY);
      return true;
    } catch (_error) {
      return false;
    }
  }

  root.ScheduleRUPlannerStateStore = { STORAGE_KEY, load, save, clear };
})(globalThis);
