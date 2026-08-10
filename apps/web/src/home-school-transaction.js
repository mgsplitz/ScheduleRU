(function exposeHomeSchoolTransaction(root) {
  const SNAPSHOT_FIELDS = [
    "homeSchoolSlug",
    "availablePrograms",
    "programSelectionPolicies",
    "selectedPrograms",
    "primaryProgramId",
    "secondaryProgramId",
    "requiredProgramTab",
    "groupSelections",
    "requirementTrees",
    "referenceRequirementTrees",
    "majorRequirementTree",
    "catalogListedProgramIds",
    "doubleCountPolicies",
    "doubleCountRules",
    "doubleCountExceptions",
    "programEligibilityRules",
    "activeProgram",
    "doubleCount",
    "requirementsError",
    "coreCurricula",
    "activeCoreCurriculum",
    "coreRequirementTree",
    "coreError",
  ];

  function create({
    getState,
    loadCandidate,
    applyRequirementTree,
    saveState,
    onCommitted,
    onRolledBack,
    onLoadingChange,
  } = {}) {
    function state() {
      return getState?.() || {};
    }

    function snapshot() {
      const current = state();
      return Object.fromEntries(SNAPSHOT_FIELDS.map((field) => [field, current[field]]));
    }

    function apply(values) {
      Object.assign(state(), values);
      applyRequirementTree?.(state().majorRequirementTree);
    }

    function restore(accepted) {
      apply(accepted);
    }

    function commit(candidate) {
      apply(candidate);
    }

    async function execute(nextSchool) {
      const current = state();
      const generation = (current.homeSchoolChangeGeneration || 0) + 1;
      const accepted = snapshot();
      current.homeSchoolChangeGeneration = generation;
      current.requirementsLoading = true;
      onLoadingChange?.(true);

      try {
        const candidate = await loadCandidate(nextSchool);
        if (generation !== state().homeSchoolChangeGeneration) return { status: "stale" };
        commit(candidate);
        saveState?.();
        onCommitted?.(candidate);
        return { status: "committed", candidate };
      } catch (error) {
        if (generation !== state().homeSchoolChangeGeneration) return { status: "stale" };
        restore(accepted);
        onRolledBack?.(error);
        return { status: "rolled_back", error };
      } finally {
        if (generation === state().homeSchoolChangeGeneration) {
          state().requirementsLoading = false;
          onLoadingChange?.(false);
        }
      }
    }

    return { snapshot, restore, commit, execute };
  }

  root.ScheduleRUHomeSchoolTransaction = { create };
})(globalThis);
