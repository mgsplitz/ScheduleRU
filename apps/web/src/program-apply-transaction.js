(function exposeProgramApplyTransaction(root) {
  function validationFeedback(ids, programs) {
    const selected = new Set(ids);
    const majors = (Array.isArray(programs) ? programs : [])
      .filter((program) => selected.has(program?.id) && program?.type === "major");
    if (!majors.length) {
      return { errors: [{ message: "Choose one primary major before applying programs." }] };
    }
    if (majors.length > 2) {
      return { errors: [{ message: "Choose one primary major and, if needed, one secondary major. Three majors are not supported." }] };
    }
    return null;
  }

  function create({
    getState,
    checkSelection,
    loadCandidate,
    programDraftView,
    applyRequirementTree,
    saveState,
    onPendingChange,
    onLoadingChange,
    onFeedback,
    onWarnings,
    onCommitted,
  } = {}) {
    function state() {
      return getState?.() || {};
    }

    function setPending(value) {
      state().programApplyPending = Boolean(value);
      onPendingChange?.(Boolean(value));
    }

    function setLoading(value) {
      state().requirementsLoading = Boolean(value);
      onLoadingChange?.(Boolean(value));
    }

    async function accept({ ids, primaryId, generation }) {
      if (generation !== state().programApplyGeneration) return { status: "stale" };
      if (state().programApplyPending) return { status: "busy" };
      setPending(true);
      setLoading(true);
      try {
        const candidate = await loadCandidate(ids);
        if (generation !== state().programApplyGeneration) return { status: "stale" };
        // The candidate may contain only programs with reviewed requirement
        // trees. The accepted selection still retains catalog-listed programs
        // whose requirements are explicitly marked as under review.
        const selectedIds = ids;
        const draft = programDraftView({
          draftIds: selectedIds,
          primaryId,
          programs: state().availablePrograms || [],
        });
        Object.assign(state(), candidate, {
          selectedPrograms: draft.selectedIds,
          primaryProgramId: draft.primaryId,
          secondaryProgramId: draft.secondaryId,
          requiredProgramTab: draft.primaryId || draft.selectedIds[0] || "",
          programSelectionConfirmed: true,
          requirementsError: "",
        });
        applyRequirementTree?.(state().majorRequirementTree);
        saveState?.();
        onCommitted?.(candidate);
        return { status: "committed", candidate };
      } catch (error) {
        if (generation !== state().programApplyGeneration) return { status: "stale" };
        onFeedback?.({
          errors: [{ message: `Programs were not changed: ${error?.message || "requirements could not load"}.` }],
        });
        return { status: "rolled_back", error };
      } finally {
        if (generation === state().programApplyGeneration) {
          setLoading(false);
          setPending(false);
        }
      }
    }

    async function execute({ ids = [], primaryId = null } = {}) {
      if (state().programApplyPending) return { status: "busy" };
      const selectedIds = [...new Set((Array.isArray(ids) ? ids : []).filter(Boolean))];
      const invalid = validationFeedback(selectedIds, state().availablePrograms || []);
      if (invalid) {
        onFeedback?.(invalid);
        return { status: "invalid" };
      }

      const generation = (state().programApplyGeneration || 0) + 1;
      state().programApplyGeneration = generation;
      setPending(true);
      let check;
      try {
        check = await checkSelection(selectedIds);
      } catch (_error) {
        if (generation === state().programApplyGeneration) {
          onFeedback?.({
            errors: [{ message: "Program policy checks could not be loaded. Your saved programs were not changed." }],
          });
        }
        return { status: "check_failed" };
      } finally {
        if (generation === state().programApplyGeneration) setPending(false);
      }

      if (generation !== state().programApplyGeneration) return { status: "stale" };
      if (!check?.allowed) {
        onFeedback?.(check || { errors: [{ message: "This program selection is not allowed." }] });
        return { status: "blocked" };
      }
      if (check.warnings?.length) {
        onWarnings?.({
          warnings: check.warnings,
          proceed: () => accept({ ids: selectedIds, primaryId, generation }),
        });
        return { status: "warnings" };
      }
      onFeedback?.(check);
      return accept({ ids: selectedIds, primaryId, generation });
    }

    return { execute };
  }

  root.ScheduleRUProgramApplyTransaction = { create, validationFeedback };
})(globalThis);
