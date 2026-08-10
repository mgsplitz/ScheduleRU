(function exposeProgramPickerLogic(root) {
  const SUPPORTED_PROGRAM_TYPES = new Set(["major", "minor", "concentration", "certificate"]);

  function availableProgramIds(programs = []) {
    return new Set((Array.isArray(programs) ? programs : []).map((program) => program?.id).filter(Boolean));
  }

  function initialProgramIds({
    restoredIds = [],
    programs = [],
    onboardingCompleted = false,
    selectionConfirmed = false,
    defaultProgramId = null,
  } = {}) {
    const available = availableProgramIds(programs);
    const restored = [...new Set((Array.isArray(restoredIds) ? restoredIds : []).filter((id) => available.has(id)))];
    if (!onboardingCompleted && !selectionConfirmed) return [];
    if (restored.length) return restored;
    const rows = Array.isArray(programs) ? programs : [];
    const reviewed = rows.filter((program) => program?.requirements_available !== false);
    const fallback = reviewed.find((program) => program.id === defaultProgramId)
      || reviewed.find((program) => program.type === "major")
      || reviewed[0]
      || rows.find((program) => program.type === "major")
      || rows[0];
    return fallback?.id ? [fallback.id] : [];
  }

  function programDraftView({ draftIds = [], primaryId = null, programs = [] } = {}) {
    const byId = new Map((Array.isArray(programs) ? programs : []).map((program) => [program?.id, program]));
    const selectedIds = [...new Set((Array.isArray(draftIds) ? draftIds : []).filter((id) => byId.has(id)))];
    const majorIds = selectedIds.filter((id) => byId.get(id)?.type === "major");
    const normalizedPrimaryId = majorIds.includes(primaryId) ? primaryId : majorIds[0] || null;
    return {
      selectedIds,
      majorIds,
      primaryId: normalizedPrimaryId,
      secondaryId: majorIds.find((id) => id !== normalizedPrimaryId) || null,
    };
  }

  function eligibilityRuleValues(rule) {
    try {
      const parsed = JSON.parse(rule?.condition_value_json || "[]");
      return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
    } catch (_error) {
      return [];
    }
  }

  function programIsAvailableForSchool(program, homeSchoolSlug) {
    return !(program?.eligibility_rules || []).some((rule) => {
      if (rule.decision !== "blocked") return false;
      const values = eligibilityRuleValues(rule);
      if (rule.condition_type === "home_school_must_be_one_of") {
        return !values.includes(homeSchoolSlug);
      }
      if (rule.condition_type === "home_school_must_not_be_one_of") {
        return values.includes(homeSchoolSlug);
      }
      return false;
    });
  }

  function availableProgramsForSchool(programs = [], homeSchoolSlug = "") {
    return (Array.isArray(programs) ? programs : [])
      .filter((program) => SUPPORTED_PROGRAM_TYPES.has(program?.type))
      .filter((program) => programIsAvailableForSchool(program, homeSchoolSlug));
  }

  function programRoles(ids = [], programs = []) {
    const selectedIds = Array.isArray(ids) ? ids : [];
    const rows = Array.isArray(programs) ? programs : [];
    const majors = selectedIds.filter(
      (id) => rows.find((program) => program?.id === id)?.type === "major",
    );
    return {
      primaryProgramId: majors[0] || null,
      secondaryProgramId: majors[1] || null,
      requiredProgramTab: majors[0] || selectedIds[0] || "",
    };
  }

  root.ScheduleRUProgramPickerLogic = {
    initialProgramIds,
    programDraftView,
    eligibilityRuleValues,
    programIsAvailableForSchool,
    availableProgramsForSchool,
    programRoles,
  };
})(globalThis);
