/* Pure ordering and labeling rules for the local guest onboarding flow. */
(function exposeOnboardingFlowModel(root) {
  const STEP_IDS = Object.freeze(["welcome", "programs", "position", "coursework", "ap", "review"]);
  const COURSEWORK_TERMS = Object.freeze(["Fall", "Spring", "Summer", "Winter"]);

  function steps() { return [...STEP_IDS]; }
  function courseworkTerms() { return [...COURSEWORK_TERMS]; }
  function normalizedIndex(index) {
    return Math.max(0, Math.min(STEP_IDS.length - 1, Number(index) || 0));
  }
  function stepAt(index) { return STEP_IDS[normalizedIndex(index)]; }
  function move(index, direction) {
    return normalizedIndex(normalizedIndex(index) + (direction === "back" ? -1 : 1));
  }
  function programRoleRows({ programs, primaryId, secondaryId } = {}) {
    return (programs || []).map((program) => ({
      id: program.id,
      name: program.name || "Program",
      role: program.type === "minor"
        ? "Minor"
        : program.id === primaryId
          ? "Primary major"
          : program.id === secondaryId ? "Secondary major" : "Major",
    }));
  }

  root.ScheduleRUOnboardingFlowModel = {
    steps,
    stepAt,
    move,
    programRoleRows,
    courseworkTerms,
  };
})(globalThis);
