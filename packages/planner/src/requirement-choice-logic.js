/* Deterministic classification of unresolved planner requirements. */
(function exposeRequirementChoiceLogic(root) {
  const text = (value) => String(value ?? "").trim();

  function candidatesByCode(candidates) {
    const byCode = new Map();
    (Array.isArray(candidates) ? candidates : []).forEach((candidate) => {
      const code = text(candidate?.code);
      if (!code || byCode.has(code)) return;
      byCode.set(code, {
        ...candidate,
        code,
        prerequisitePaths: Array.isArray(candidate?.prerequisitePaths)
          ? candidate.prerequisitePaths.map((path) => [...path])
          : [],
      });
    });
    return [...byCode.values()].sort((left, right) => left.code.localeCompare(right.code));
  }

  function prerequisiteSignature(candidate) {
    const paths = (candidate.prerequisitePaths || []).map((path) =>
      [...new Set(path.map(text).filter(Boolean))].sort().join(","))
      .sort();
    return JSON.stringify({
      paths,
      minimumPlanYear: Number(candidate.minimumPlanYear) || null,
      minimumPriorCredits: Number(candidate.minimumPriorCredits) || null,
    });
  }

  function classifyRequirement(group = {}, candidates = []) {
    const finite = candidatesByCode(candidates);
    if (!finite.length) {
      return (group.courseSelectors || []).length ? "guided_flexible" : "reserve_only";
    }
    if (group.sourceType === "core") return "guided_flexible";
    if (finite.length === 1) return "fixed";
    const equivalenceKeys = [...new Set(finite.map((candidate) => text(candidate.equivalenceKey)).filter(Boolean))];
    if (equivalenceKeys.length === 1 && finite.every((candidate) => text(candidate.equivalenceKey))) {
      return "fixed";
    }
    const prerequisiteSignatures = new Set(finite.map(prerequisiteSignature));
    return prerequisiteSignatures.size > 1 ? "sequence_critical" : "guided_flexible";
  }

  function planningDecisions(plannerInput = {}) {
    const grouped = new Map();
    (plannerInput.unresolvedRequirements || []).forEach((requirement) => {
      const groupId = text(requirement?.requirementGroupId);
      if (!groupId) return;
      const sourceProgram = text(requirement.sourceProgram);
      const sourceType = requirement.sourceType === "core" ? "core" : "program";
      const key = `${sourceType}\u0000${sourceProgram}\u0000${groupId}`;
      const context = requirement.candidateSelectionContext || {};
      const current = grouped.get(key) || {
        decisionId: `${sourceType}:${sourceProgram}:${groupId}`,
        requirementGroupId: groupId,
        sourceProgram,
        sourceType,
        label: text(requirement.label) || text(context.groupName) || "Course choice",
        rule: text(context.rule),
        slotCount: 0,
        candidates: [],
        courseSelectors: [...(context.courseSelectors || [])],
        sourceProgramIds: [...(context.sourceProgramIds || [])],
        allocationFamily: text(context.allocationFamily) || null,
      };
      current.slotCount += 1;
      current.candidates.push(...(context.candidatePrerequisiteSummaries || []));
      grouped.set(key, current);
    });

    return [...grouped.values()].map((decision) => {
      const candidates = candidatesByCode(decision.candidates);
      const planningMode = classifyRequirement(decision, candidates);
      return {
        ...decision,
        candidates,
        planningMode,
        canDefer: decision.sourceType === "core" && planningMode === "guided_flexible",
      };
    }).sort((left, right) =>
      left.sourceType.localeCompare(right.sourceType)
      || left.sourceProgram.localeCompare(right.sourceProgram)
      || left.requirementGroupId.localeCompare(right.requirementGroupId));
  }

  root.ScheduleRURequirementChoiceLogic = { classifyRequirement, planningDecisions };
})(globalThis);
