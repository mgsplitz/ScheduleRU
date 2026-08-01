(function exposeProgramPickerLogic(root) {
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

  root.ScheduleRUProgramPickerLogic = { initialProgramIds, programDraftView };
})(globalThis);
