/* Deterministic, bounded optimizer for policy-valid unresolved course choices. */
(function exposeCourseSetOptimizer(root) {
  const text = (value) => String(value ?? "").trim();
  const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort();
  const pairKey = (left, right) => [left, right].filter(Boolean).sort().join("|");

  function preferenceFor(requirement, preferences) {
    return preferences?.[requirement.id]
      || preferences?.[requirement.requirementGroupId]
      || {};
  }

  function preferenceRank(candidate, requirement, preferences) {
    const preference = preferenceFor(requirement, preferences);
    const codes = new Set(candidate.equivalentCourseCodes || [candidate.code]);
    if ((preference.interested || []).some((code) => codes.has(code))) return 0;
    if ((preference.maybe || []).some((code) => codes.has(code))) return 1;
    if ((preference.avoid || []).some((code) => codes.has(code))) return 3;
    return 2;
  }

  function deferredIds(requirements, preferences) {
    return requirements.filter((item) =>
      item.canDefer === true && preferenceFor(item, preferences).mode === "deferred")
      .map((item) => item.id).sort();
  }

  function incompatiblePairs(candidate, conflicts, requirements) {
    const pairs = new Set();
    const byId = new Map(requirements.map((item) => [item.id, item]));
    const addAllPairs = (left, right) => {
      left.forEach((a) => right.forEach((b) => {
        if (a !== b) pairs.add(pairKey(a, b));
      }));
    };
    (conflicts || []).filter((item) => item.candidateCode === candidate.code).forEach((conflict) => {
      if (conflict.type === "allocation_family") {
        const ids = conflict.requirementIds || [];
        for (let index = 0; index < ids.length; index += 1) {
          for (let other = index + 1; other < ids.length; other += 1) {
            pairs.add(pairKey(ids[index], ids[other]));
          }
        }
      }
      const forbidsOverlap = conflict.type === "double_count_unknown"
        || (conflict.type === "double_count_cap" && Number(conflict.maxSharedCourses) === 0)
        || (conflict.type === "double_count_credit_cap" && Number(conflict.maxSharedCredits) === 0);
      if (forbidsOverlap) {
        const [leftProgram, rightProgram] = conflict.programIds || [];
        addAllPairs(
          candidate.coverageRequirementIds.filter((id) => byId.get(id)?.sourceProgram === leftProgram),
          candidate.coverageRequirementIds.filter((id) => byId.get(id)?.sourceProgram === rightProgram),
        );
      }
    });
    return pairs;
  }

  function maximalCoverageOptions(candidate, availableIds, conflicts, requirements, targetId) {
    const incompatible = incompatiblePairs(candidate, conflicts, requirements);
    let options = [new Set(uniqueSorted(availableIds))];
    for (const key of incompatible) {
      const [left, right] = key.split("|");
      options = options.flatMap((option) => {
        if (!option.has(left) || !option.has(right)) return [option];
        const withoutLeft = new Set(option);
        const withoutRight = new Set(option);
        withoutLeft.delete(left);
        withoutRight.delete(right);
        return [withoutLeft, withoutRight];
      });
    }
    const serialized = new Map();
    options.filter((option) => option.has(targetId)).forEach((option) => {
      const ids = [...option].sort();
      serialized.set(ids.join("\u0000"), ids);
    });
    const rows = [...serialized.values()];
    return rows.filter((row) => !rows.some((other) =>
      other.length > row.length && row.every((id) => other.includes(id))))
      .sort((left, right) => right.length - left.length || left.join("\u0000").localeCompare(right.join("\u0000")));
  }

  function sharedProgramPairs(candidate, coverageIds, conflicts, requirements) {
    const byId = new Map(requirements.map((item) => [item.id, item]));
    const coveredPrograms = new Set(coverageIds.map((id) => byId.get(id))
      .filter((item) => item?.sourceType === "program").map((item) => item.sourceProgram));
    return (conflicts || []).filter((item) =>
      item.candidateCode === candidate.code
      && item.type === "double_count_cap"
      && Number(item.maxSharedCourses) > 0
      && (item.programIds || []).every((id) => coveredPrograms.has(id)))
      .map((item) => ({ key: pairKey(...item.programIds), cap: Number(item.maxSharedCourses) }));
  }

  function optimizeCourseSet(graph = {}, preferences = {}, options = {}) {
    const requirements = [...(graph.requirements || [])].sort((left, right) => left.id.localeCompare(right.id));
    const candidates = [...(graph.candidates || [])].map((candidate) => ({
      ...candidate,
      equivalentCourseCodes: uniqueSorted(candidate.equivalentCourseCodes || [candidate.code]),
      coverageRequirementIds: uniqueSorted(candidate.coverageRequirementIds || []),
      prerequisiteClosure: uniqueSorted(candidate.prerequisiteClosure || []),
    })).sort((left, right) => left.code.localeCompare(right.code));
    const candidateByAlias = new Map();
    candidates.forEach((candidate) => candidate.equivalentCourseCodes.forEach((code) => {
      if (!candidateByAlias.has(code)) candidateByAlias.set(code, candidate);
    }));
    const deferredRequirements = deferredIds(requirements, preferences);
    const deferred = new Set(deferredRequirements);
    const needed = new Map(requirements.filter((item) => !deferred.has(item.id))
      .map((item) => [item.id, Math.max(1, Number(item.slotCount) || 1)]));
    const requirementById = new Map(requirements.map((item) => [item.id, item]));
    const candidateByRequirement = new Map(requirements.map((item) => [item.id, []]));
    candidates.forEach((candidate) => candidate.coverageRequirementIds.forEach((id) => {
      if (candidateByRequirement.has(id)) candidateByRequirement.get(id).push(candidate);
    }));
    const nodeLimit = options.nodeLimit === undefined ? 50000 : Math.max(0, Number(options.nodeLimit) || 0);
    if (nodeLimit === 0) return {
      status: "indeterminate", selectedCourses: [], deferredRequirements, explanations: [],
      issues: [{ type: "optimizer_limit", nodeLimit }],
    };

    let nodes = 0;
    let exhausted = false;
    let best = null;

    function remainingSlots(counts) {
      return [...counts.values()].reduce((sum, count) => sum + Math.max(0, count), 0);
    }

    function selectedWithPrerequisites(selectedCodes) {
      const result = new Set(selectedCodes);
      const queue = [...selectedCodes];
      while (queue.length) {
        const current = candidateByAlias.get(queue.shift());
        (current?.prerequisiteClosure || []).forEach((code) => {
          const prerequisite = candidateByAlias.get(code);
          const selectedCode = prerequisite?.code || code;
          if (!result.has(selectedCode)) {
            result.add(selectedCode);
            queue.push(selectedCode);
          }
        });
      }
      return result;
    }

    function globalPreferenceRank(code) {
      let rank = 2;
      requirements.forEach((requirement) => {
        const preference = preferenceFor(requirement, preferences);
        if ((preference.interested || []).includes(code)) rank = Math.min(rank, 0);
        else if ((preference.maybe || []).includes(code)) rank = Math.min(rank, 1);
        else if ((preference.avoid || []).includes(code) && rank === 2) rank = 3;
      });
      return rank;
    }

    function score(state) {
      const completeCodes = selectedWithPrerequisites(state.selected);
      const records = [...completeCodes].map((code) => candidateByAlias.get(code)).filter(Boolean);
      const credits = records.reduce((sum, item) => sum + (Number(item.credits) || 3), 0);
      const coverageUnits = [...state.allocations.values()].reduce((sum, ids) => sum + ids.length, 0);
      let interest = 0;
      for (const [code, ids] of state.allocations) {
        const candidate = candidateByAlias.get(code);
        ids.forEach((id) => { interest += preferenceRank(candidate, requirementById.get(id), preferences); });
      }
      const prerequisiteCount = Math.max(0, completeCodes.size - state.selected.size);
      const unavailable = records.filter((item) => !item.offeringEvidence).length;
      return [
        remainingSlots(state.counts),
        credits,
        -(coverageUnits - state.selected.size),
        interest,
        prerequisiteCount,
        unavailable,
        [...completeCodes].sort().join("\u0000"),
      ];
    }

    function compareScore(left, right) {
      for (let index = 0; index < left.length; index += 1) {
        if (left[index] === right[index]) continue;
        return left[index] < right[index] ? -1 : 1;
      }
      return 0;
    }

    function consider(state) {
      const candidate = { state, score: score(state) };
      if (!best || compareScore(candidate.score, best.score) < 0) best = candidate;
    }

    function nextRequirement(counts, selected) {
      return requirements.filter((item) => (counts.get(item.id) || 0) > 0)
        .sort((left, right) => {
          const optionsFor = (requirement) => (candidateByRequirement.get(requirement.id) || [])
            .filter((candidate) => !selected.has(candidate.code)).length;
          return optionsFor(left) - optionsFor(right) || left.id.localeCompare(right.id);
        })[0];
    }

    function visit(state) {
      nodes += 1;
      if (nodes > nodeLimit) { exhausted = true; return; }
      const requirement = nextRequirement(state.counts, state.selected);
      if (!requirement) { consider(state); return; }
      const available = (candidateByRequirement.get(requirement.id) || [])
        .filter((candidate) => !state.selected.has(candidate.code))
        .sort((left, right) =>
          preferenceRank(left, requirement, preferences) - preferenceRank(right, requirement, preferences)
          || left.code.localeCompare(right.code));
      if (!available.length) { consider(state); return; }

      for (const candidate of available) {
        const eligibleIds = candidate.coverageRequirementIds.filter((id) => (state.counts.get(id) || 0) > 0);
        const coverageOptions = maximalCoverageOptions(
          candidate, eligibleIds, graph.conflicts || [], requirements, requirement.id,
        );
        for (const coverageIds of coverageOptions) {
          const sharedPairs = sharedProgramPairs(candidate, coverageIds, graph.conflicts || [], requirements);
          if (sharedPairs.some((item) => (state.sharedCounts.get(item.key) || 0) >= item.cap)) continue;
          const counts = new Map(state.counts);
          coverageIds.forEach((id) => counts.set(id, Math.max(0, (counts.get(id) || 0) - 1)));
          const selected = new Set(state.selected);
          selected.add(candidate.code);
          const allocations = new Map(state.allocations);
          allocations.set(candidate.code, coverageIds);
          const sharedCounts = new Map(state.sharedCounts);
          sharedPairs.forEach((item) => sharedCounts.set(item.key, (sharedCounts.get(item.key) || 0) + 1));
          visit({ counts, selected, allocations, sharedCounts });
          if (exhausted) return;
        }
      }
    }

    visit({ counts: needed, selected: new Set(), allocations: new Map(), sharedCounts: new Map() });
    if (exhausted) return {
      status: "indeterminate", selectedCourses: [], deferredRequirements, explanations: [],
      issues: [{ type: "optimizer_limit", nodeLimit }],
    };
    const chosen = best?.state || { selected: new Set(), allocations: new Map(), counts: needed };
    const completeCodes = selectedWithPrerequisites(chosen.selected);
    const selectedCourses = [...completeCodes].sort().map((code) => {
      const candidate = candidateByAlias.get(code) || { code, title: code, credits: 3, equivalentCourseCodes: [code] };
      return {
        ...candidate,
        coverageRequirementIds: [...(chosen.allocations.get(candidate.code) || [])].sort(),
        prerequisiteOnly: !chosen.selected.has(candidate.code),
      };
    });
    const explanations = [];
    selectedCourses.filter((item) => item.prerequisiteOnly).forEach((item) => {
      const aliases = item.equivalentCourseCodes || [item.code];
      const avoided = aliases.some((code) => globalPreferenceRank(code) === 3);
      if (!avoided) return;
      const unlocks = selectedCourses.filter((course) =>
        !course.prerequisiteOnly
        && (course.prerequisiteClosure || []).some((code) => aliases.includes(code)))
        .map((course) => course.code).sort();
      explanations.push({
        type: "preference_override",
        courseCode: item.code,
        reason: "prerequisite",
        unlocksCourseCodes: unlocks,
      });
    });
    selectedCourses.filter((item) => item.coverageRequirementIds.length > 1).forEach((item) => {
      explanations.push({
        type: "multi_requirement_coverage",
        courseCode: item.code,
        requirementIds: [...item.coverageRequirementIds],
      });
    });
    explanations.sort((left, right) => left.courseCode.localeCompare(right.courseCode) || left.type.localeCompare(right.type));
    const unresolved = requirements.filter((item) => (chosen.counts.get(item.id) || 0) > 0)
      .map((item) => ({ requirementId: item.id, remainingSlots: chosen.counts.get(item.id) })).sort((a, b) => a.requirementId.localeCompare(b.requirementId));
    return {
      status: unresolved.length ? "incomplete" : "complete",
      selectedCourses,
      deferredRequirements,
      explanations,
      issues: unresolved.length ? [{ type: "unresolved_requirements", requirements: unresolved }] : [],
    };
  }

  root.ScheduleRUCourseSetOptimizer = { optimizeCourseSet };
})(globalThis);
