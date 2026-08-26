/* Deterministic, bounded optimizer for policy-valid unresolved course choices. */
(function exposeCourseSetOptimizer(root) {
  const text = (value) => String(value ?? "").trim();
  const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort();
  const normalizedPaths = (value) => uniqueSorted((Array.isArray(value) ? value : [])
    .map((path) => uniqueSorted(Array.isArray(path) ? path.map(text) : []).join("\u0000"))
    .filter(Boolean)).map((path) => path.split("\u0000"));
  const pairKey = (left, right) => [left, right].filter(Boolean).sort().join("|");

  function preferenceFor(requirement, preferences) {
    const local = preferences?.[requirement.id]
      || preferences?.[requirement.requirementGroupId]
      || {};
    const global = preferences?.__global || {};
    return {
      ...local,
      interested: [...new Set([...(global.interested || []), ...(local.interested || [])])],
      maybe: [...new Set([...(global.maybe || []), ...(local.maybe || [])])],
      avoid: [...new Set([...(global.avoid || []), ...(local.avoid || [])])],
    };
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
    const completedCourseCodes = new Set((graph.completedCourseCodes || []).map(text).filter(Boolean));
    const plannedCourseCodes = new Set((graph.plannedCourseCodes || []).map(text).filter(Boolean));
    const completedCreditExclusionFamilies = new Set(
      (graph.completedCreditExclusionFamilies || []).map(text).filter(Boolean),
    );
    const allCandidates = [...(graph.candidates || [])].map((candidate) => ({
      ...candidate,
      equivalentCourseCodes: uniqueSorted(candidate.equivalentCourseCodes || [candidate.code]),
      coverageRequirementIds: uniqueSorted(candidate.coverageRequirementIds || []),
      prerequisitePaths: normalizedPaths(candidate.prerequisitePaths),
      enforceablePrerequisitePaths: normalizedPaths(candidate.enforceablePrerequisitePaths),
      prerequisiteClosure: uniqueSorted(candidate.prerequisiteClosure || []),
      creditExclusionFamilies: uniqueSorted(candidate.creditExclusionFamilies || []),
    })).filter((candidate) =>
      !candidate.equivalentCourseCodes.some((code) => completedCourseCodes.has(code))
      && !candidate.creditExclusionFamilies.some((family) => completedCreditExclusionFamilies.has(family)))
      .sort((left, right) => left.code.localeCompare(right.code));
    const requirementById = new Map(requirements.map((item) => [item.id, item]));
    const unlockCounts = new Map();
    allCandidates.forEach((candidate) => (candidate.prerequisiteClosure || []).forEach((code) => {
      unlockCounts.set(code, (unlockCounts.get(code) || 0) + 1);
    }));
    function candidateBehavior(candidate) {
      const conflictFacts = (graph.conflicts || []).filter((item) => item.candidateCode === candidate.code)
        .map(({ candidateCode: _candidateCode, ...fact }) => fact)
        .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
      return JSON.stringify({
        coverage: candidate.coverageRequirementIds,
        conflicts: conflictFacts,
        credits: Number(candidate.credits) || 3,
        prerequisitePaths: candidate.prerequisitePaths,
        enforceablePrerequisitePaths: candidate.enforceablePrerequisitePaths,
        prerequisiteClosure: candidate.prerequisiteClosure,
        minimumPlanYear: Number(candidate.minimumPlanYear) || null,
        minimumPriorCredits: Number(candidate.minimumPriorCredits) || null,
        offering: candidate.offeringEvidence ? 1 : 0,
        optionFamily: candidate.optionFamily || null,
        creditExclusionFamilies: candidate.creditExclusionFamilies,
        distinctAttributes: uniqueSorted(candidate.coverageRequirementIds.flatMap((id) => {
          const allowed = requirementById.get(id)?.distinctAttributes || [];
          return (candidate.attributes || []).filter((attribute) => allowed.includes(attribute));
        })),
        preference: candidate.coverageRequirementIds.map((id) =>
          preferenceRank(candidate, requirementById.get(id), preferences)),
      });
    }
    const behaviorGroups = new Map();
    allCandidates.forEach((candidate) => {
      if (!candidate.coverageRequirementIds.length) return;
      const key = candidateBehavior(candidate);
      const rows = behaviorGroups.get(key) || [];
      rows.push(candidate);
      behaviorGroups.set(key, rows);
    });
    const candidates = [
      ...allCandidates.filter((candidate) => !candidate.coverageRequirementIds.length),
      ...[...behaviorGroups.values()].flatMap((rows) => {
        const capacity = Math.max(1, ...rows[0].coverageRequirementIds.map((id) =>
          Number(requirementById.get(id)?.slotCount) || 1));
        return rows.slice(0, capacity);
      }),
    ].sort((left, right) => left.code.localeCompare(right.code));
    const candidateByAlias = new Map();
    allCandidates.forEach((candidate) => candidate.equivalentCourseCodes.forEach((code) => {
      if (!candidateByAlias.has(code)) candidateByAlias.set(code, candidate);
    }));
    const deferredRequirements = deferredIds(requirements, preferences);
    const deferred = new Set(deferredRequirements);
    const needed = new Map(requirements.filter((item) => !deferred.has(item.id))
      .map((item) => [item.id, Math.max(1, Number(item.slotCount) || 1)]));
    if (options.component !== true && needed.size > 1) {
      const adjacency = new Map([...needed.keys()].map((id) => [id, new Set()]));
      const connect = (ids) => ids.forEach((id) => ids.forEach((other) => {
        if (id !== other) adjacency.get(id)?.add(other);
      }));
      allCandidates.forEach((candidate) => connect(candidate.coverageRequirementIds.filter((id) => needed.has(id))));
      const exclusionRequirements = new Map();
      allCandidates.forEach((candidate) => (candidate.creditExclusionFamilies || []).forEach((family) => {
        const ids = exclusionRequirements.get(family) || [];
        ids.push(...candidate.coverageRequirementIds.filter((id) => needed.has(id)));
        exclusionRequirements.set(family, ids);
      }));
      exclusionRequirements.forEach((ids) => connect(uniqueSorted(ids)));
      const prerequisiteConsumers = new Map();
      allCandidates.forEach((candidate) => (candidate.prerequisiteClosure || []).forEach((code) => {
        const ids = prerequisiteConsumers.get(code) || [];
        ids.push(...candidate.coverageRequirementIds.filter((id) => needed.has(id)));
        prerequisiteConsumers.set(code, ids);
      }));
      prerequisiteConsumers.forEach((ids, code) => {
        const prerequisite = candidateByAlias.get(code);
        connect(uniqueSorted([...ids, ...(prerequisite?.coverageRequirementIds || []).filter((id) => needed.has(id))]));
      });
      const components = [];
      const unseen = new Set(needed.keys());
      while (unseen.size) {
        const start = [...unseen].sort()[0];
        const component = [];
        const queue = [start];
        unseen.delete(start);
        while (queue.length) {
          const id = queue.shift();
          component.push(id);
          [...(adjacency.get(id) || [])].sort().forEach((other) => {
            if (unseen.delete(other)) queue.push(other);
          });
        }
        components.push(component.sort());
      }
      if (components.length > 1) {
        const parts = components.map((ids) => {
          const idSet = new Set(ids);
          const componentCandidates = allCandidates.filter((candidate) =>
            candidate.coverageRequirementIds.some((id) => idSet.has(id))
            || candidate.equivalentCourseCodes.some((code) => plannedCourseCodes.has(code)));
          const includedCodes = new Set(componentCandidates.flatMap((candidate) => candidate.equivalentCourseCodes || [candidate.code]));
          const supportingCandidates = [];
          const prerequisiteQueue = componentCandidates
            .flatMap((candidate) => candidate.prerequisiteClosure || []);
          while (prerequisiteQueue.length) {
            const prerequisiteCode = prerequisiteQueue.shift();
            const supporting = candidateByAlias.get(prerequisiteCode);
            if (!supporting || includedCodes.has(supporting.code)) continue;
            supportingCandidates.push(supporting);
            (supporting.equivalentCourseCodes || [supporting.code]).forEach((code) => includedCodes.add(code));
            prerequisiteQueue.push(...(supporting.prerequisiteClosure || []));
          }
          const scopedCandidates = [...componentCandidates, ...supportingCandidates].map((candidate) => ({
            ...candidate,
            // A planned or prerequisite-supporting course can be present in
            // more than one disconnected component. Keep only coverage that
            // belongs to this component so the recursive graph remains
            // internally referentially complete.
            coverageRequirementIds: (candidate.coverageRequirementIds || [])
              .filter((id) => idSet.has(id)),
          }));
          const candidateCodes = new Set(scopedCandidates.map((candidate) => candidate.code));
          return optimizeCourseSet({
            requirements: requirements.filter((item) => idSet.has(item.id)),
            candidates: scopedCandidates,
            conflicts: (graph.conflicts || []).filter((item) => candidateCodes.has(item.candidateCode)),
            completedCourseCodes: [...completedCourseCodes],
            plannedCourseCodes: [...plannedCourseCodes],
            completedCreditExclusionFamilies: [...completedCreditExclusionFamilies],
          }, preferences, { ...options, component: true });
        });
        if (parts.some((part) => part.status === "indeterminate")) return {
          status: "indeterminate", selectedCourses: [], deferredRequirements, explanations: [],
          issues: parts.flatMap((part) => part.issues || []),
        };
        const selectedByCode = new Map();
        parts.flatMap((part) => part.selectedCourses || []).forEach((course) => {
          const current = selectedByCode.get(course.code);
          if (!current) selectedByCode.set(course.code, { ...course });
          else current.coverageRequirementIds = uniqueSorted([
            ...(current.coverageRequirementIds || []), ...(course.coverageRequirementIds || []),
          ]);
        });
        return {
          status: parts.every((part) => part.status === "complete") ? "complete" : "incomplete",
          selectedCourses: [...selectedByCode.values()].sort((left, right) => left.code.localeCompare(right.code)),
          deferredRequirements,
          explanations: parts.flatMap((part) => part.explanations || [])
            .sort((left, right) => left.courseCode.localeCompare(right.courseCode) || left.type.localeCompare(right.type)),
          issues: parts.flatMap((part) => part.issues || []),
        };
      }
    }
    const candidateByRequirement = new Map(requirements.map((item) => [item.id, []]));
    candidates.forEach((candidate) => candidate.coverageRequirementIds.forEach((id) => {
      if (candidateByRequirement.has(id)) candidateByRequirement.get(id).push(candidate);
    }));
    const optionsByConstraintFamily = new Map();
    candidateByRequirement.forEach((requirementCandidates, requirementId) => {
      requirementCandidates.forEach((candidate) => {
        const families = [
          ...(candidate.optionFamily ? [`option:${candidate.optionFamily}`] : []),
          ...(candidate.creditExclusionFamilies || []).map((family) => `exclusion:${family}`),
        ];
        families.forEach((family) => {
          if (!optionsByConstraintFamily.has(family)) optionsByConstraintFamily.set(family, new Map());
          const optionsByRequirement = optionsByConstraintFamily.get(family);
          if (!optionsByRequirement.has(requirementId)) optionsByRequirement.set(requirementId, new Set());
          optionsByRequirement.get(requirementId).add(candidate.code);
        });
      });
    });
    const constraintCountsByCandidate = new Map(candidates.map((candidate) => {
      const constrainedByRequirement = new Map();
      const families = [
        ...(candidate.optionFamily ? [`option:${candidate.optionFamily}`] : []),
        ...(candidate.creditExclusionFamilies || []).map((family) => `exclusion:${family}`),
      ];
      families.forEach((family) => {
        (optionsByConstraintFamily.get(family) || new Map()).forEach((codes, requirementId) => {
          if (!constrainedByRequirement.has(requirementId)) {
            constrainedByRequirement.set(requirementId, new Set());
          }
          codes.forEach((code) => {
            if (code !== candidate.code) constrainedByRequirement.get(requirementId).add(code);
          });
        });
      });
      return [candidate.code, new Map([...constrainedByRequirement]
        .map(([requirementId, codes]) => [requirementId, codes.size]))];
    }));
    const nodeLimit = options.nodeLimit === undefined ? 10000 : Math.max(0, Number(options.nodeLimit) || 0);
    const refinementNodeLimit = options.refinementNodeLimit === undefined
      ? Math.min(500, nodeLimit)
      : Math.max(0, Number(options.refinementNodeLimit) || 0);
    if (nodeLimit === 0) return {
      status: "indeterminate", selectedCourses: [], deferredRequirements, explanations: [],
      issues: [{ type: "optimizer_limit", nodeLimit }],
    };

    let nodes = 0;
    let exhausted = false;
    let refinementStopped = false;
    let completeAtNode = null;
    let best = null;
    const seenStates = new Set();

    function stateKey(state) {
      return JSON.stringify({
        counts: [...state.counts].sort(([left], [right]) => left.localeCompare(right)),
        selected: [...state.selected].sort(),
        shared: [...state.sharedCounts].sort(([left], [right]) => left.localeCompare(right)),
        distinct: [...state.distinctUsed].sort(([left], [right]) => left.localeCompare(right))
          .map(([id, values]) => [id, [...values].sort()]),
      });
    }

    function remainingSlots(counts) {
      return [...counts.values()].reduce((sum, count) => sum + Math.max(0, count), 0);
    }

    function candidateIsCompleted(candidate, code) {
      return (candidate?.equivalentCourseCodes || [code]).some((alias) => completedCourseCodes.has(alias));
    }

    function candidateIsPlanned(candidate, code) {
      return (candidate?.equivalentCourseCodes || [code]).some((alias) => plannedCourseCodes.has(alias));
    }

    function creditExclusionConflictCount(codes) {
      const familyCounts = new Map();
      [...codes].forEach((code) => {
        const candidate = candidateByAlias.get(code);
        (candidate?.creditExclusionFamilies || []).forEach((family) => {
          familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
        });
      });
      return [...familyCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
    }

    function selectedWithPrerequisites(selectedCodes) {
      const result = new Set();
      function expandCandidate(candidate, code, ancestors, selected, forceSelected = false, fixedRoot = false) {
        const selectedCode = candidate?.code || code;
        if (!selectedCode || candidateIsCompleted(candidate, selectedCode)) return;
        if (!forceSelected && candidateIsPlanned(candidate, selectedCode)) return;
        selected.add(selectedCode);
        if (!candidate || ancestors.has(selectedCode)) return;
        const nextAncestors = new Set(ancestors);
        nextAncestors.add(selectedCode);
        const authoritativePaths = candidate.enforceablePrerequisitePaths?.length
          ? candidate.enforceablePrerequisitePaths
          : candidate.prerequisitePaths;
        // A fixed degree course may have a catalog prerequisite whose published
        // text omits a placement, permission, or other non-course route. Those
        // catalog paths still order courses that are already in the student's
        // plan, but only reviewed academic facts may introduce additional
        // preparation on behalf of a fixed course. User-selected electives keep
        // their complete prerequisite expansion so necessary gateways are added.
        const fixedCatalogFact = fixedRoot && candidate.ruleCoverage !== "reviewed";
        const explicitPaths = fixedCatalogFact
          ? (authoritativePaths || []).filter((path) => path.every((prerequisiteCode) => {
            const prerequisite = candidateByAlias.get(prerequisiteCode);
            return candidateIsCompleted(prerequisite, prerequisiteCode)
              || candidateIsPlanned(prerequisite, prerequisiteCode);
          }))
          : authoritativePaths;
        const paths = explicitPaths?.length
          ? explicitPaths
          : fixedCatalogFact ? []
            : candidate.prerequisiteClosure?.length ? [candidate.prerequisiteClosure] : [];
        if (!paths.length) return;
        const options = paths.map((path, index) => {
          const expanded = new Set(selected);
          path.forEach((prerequisiteCode) => {
            const prerequisite = candidateByAlias.get(prerequisiteCode);
            const canonical = prerequisite?.code || prerequisiteCode;
            expandCandidate(prerequisite, canonical, nextAncestors, expanded, false, fixedRoot);
          });
          const additions = [...expanded].filter((candidateCode) => !selected.has(candidateCode));
          return {
            path,
            index,
            expanded,
            additions: uniqueSorted(additions),
            exclusionConflicts: creditExclusionConflictCount(expanded),
            unresolved: uniqueSorted(additions).filter((prerequisiteCode) =>
              !candidateByAlias.has(prerequisiteCode)).length,
            unrequestedHonors: uniqueSorted(additions).filter((prerequisiteCode) => {
              const record = candidateByAlias.get(prerequisiteCode);
              return /\bHONORS?\b/i.test(text(record?.title)) && globalPreferenceRank(prerequisiteCode) >= 2;
            }).length,
            credits: uniqueSorted(additions).reduce((sum, prerequisiteCode) =>
              sum + (Number(candidateByAlias.get(prerequisiteCode)?.credits) || 3), 0),
          };
        }).sort((left, right) =>
          left.exclusionConflicts - right.exclusionConflicts
          || left.unresolved - right.unresolved
          || left.unrequestedHonors - right.unrequestedHonors
          || left.additions.length - right.additions.length
          || left.credits - right.credits
          || left.path.length - right.path.length
          || left.path.join("\u0000").localeCompare(right.path.join("\u0000"))
          || left.index - right.index);
        options[0]?.expanded?.forEach((candidateCode) => selected.add(candidateCode));
      }
      const plannedCanonicalCodes = new Set();
      [...plannedCourseCodes].sort().forEach((code) => {
        const candidate = candidateByAlias.get(code);
        const canonical = candidate?.code || code;
        plannedCanonicalCodes.add(canonical);
      });
      plannedCanonicalCodes.forEach((code) => result.add(code));
      const selectedCanonicalCodes = [...selectedCodes].sort().map((code) =>
        candidateByAlias.get(code)?.code || code);
      selectedCanonicalCodes.forEach((code) => result.add(code));
      [...plannedCourseCodes].sort().forEach((code) => {
        const candidate = candidateByAlias.get(code);
        expandCandidate(candidate, candidate?.code || code, new Set(), result, true, true);
      });
      plannedCanonicalCodes.forEach((code) => result.delete(code));
      selectedCanonicalCodes.forEach((code) => {
        const candidate = candidateByAlias.get(code);
        if (candidateIsPlanned(candidate, code)) return;
        expandCandidate(candidate, candidate?.code || code, new Set(), result, true, false);
      });
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
      const records = [...completeCodes].map((code) => candidateByAlias.get(code)).filter((candidate) =>
        candidate && !candidateIsPlanned(candidate, candidate.code));
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
        -records.reduce((sum, item) => sum + (unlockCounts.get(item.code) || 0), 0),
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
      if (creditExclusionConflictCount(selectedWithPrerequisites(state.selected)) > 0) return;
      const candidate = { state, score: score(state) };
      if (!best || compareScore(candidate.score, best.score) < 0) best = candidate;
      if (remainingSlots(state.counts) === 0 && completeAtNode === null) completeAtNode = nodes;
    }

    function candidateCanCoverRequirement(candidate, requirement, state) {
      if (state.selected.has(candidate.code)) return false;
      if (candidate.optionFamily && [...state.selected].some((code) =>
        candidateByAlias.get(code)?.optionFamily === candidate.optionFamily)) return false;
      if ((candidate.creditExclusionFamilies || []).some((family) =>
        [...state.selected].some((code) =>
          (candidateByAlias.get(code)?.creditExclusionFamilies || []).includes(family)))) return false;
      const allowed = requirement.distinctAttributes || [];
      if (!allowed.length) return true;
      const used = state.distinctUsed.get(requirement.id) || new Set();
      return (candidate.attributes || []).some((attribute) =>
        allowed.includes(attribute) && !used.has(attribute));
    }

    function candidateConstraintPressure(candidate, activeRequirement, state) {
      return [...(constraintCountsByCandidate.get(candidate.code) || new Map())]
        .reduce((pressure, [requirementId, count]) =>
          requirementId !== activeRequirement.id && (state.counts.get(requirementId) || 0) > 0
            ? pressure + count
            : pressure, 0);
    }

    function nextRequirement(state) {
      return requirements.filter((item) => (state.counts.get(item.id) || 0) > 0)
        .sort((left, right) => {
          const optionsFor = (requirement) => (candidateByRequirement.get(requirement.id) || [])
            .filter((candidate) => candidateCanCoverRequirement(candidate, requirement, state)).length;
          return optionsFor(left) - optionsFor(right) || left.id.localeCompare(right.id);
        })[0];
    }

    function visit(state) {
      const key = stateKey(state);
      if (seenStates.has(key)) return;
      seenStates.add(key);
      nodes += 1;
      if (nodes > nodeLimit) { exhausted = true; return; }
      if (completeAtNode !== null && nodes > completeAtNode + refinementNodeLimit) {
        refinementStopped = true;
        return;
      }
      const requirement = nextRequirement(state);
      if (!requirement) { consider(state); return; }
      const available = (candidateByRequirement.get(requirement.id) || [])
        .filter((candidate) => candidateCanCoverRequirement(candidate, requirement, state));
      const constraintPressure = new Map(available.map((candidate) => [
        candidate.code, candidateConstraintPressure(candidate, requirement, state),
      ]));
      available.sort((left, right) =>
          Number(!candidateIsPlanned(left, left.code)) - Number(!candidateIsPlanned(right, right.code))
          || right.coverageRequirementIds.filter((id) => (state.counts.get(id) || 0) > 0).length
            - left.coverageRequirementIds.filter((id) => (state.counts.get(id) || 0) > 0).length
          || constraintPressure.get(left.code) - constraintPressure.get(right.code)
          || preferenceRank(left, requirement, preferences) - preferenceRank(right, requirement, preferences)
          || (unlockCounts.get(right.code) || 0) - (unlockCounts.get(left.code) || 0)
          || left.prerequisiteClosure.length - right.prerequisiteClosure.length
          || (Number(left.credits) || 3) - (Number(right.credits) || 3)
          || Number(!left.offeringEvidence) - Number(!right.offeringEvidence)
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
          let distinctOptions = [{ used: new Map([...state.distinctUsed].map(([id, values]) => [id, new Set(values)])) }];
          coverageIds.forEach((id) => {
            const allowed = requirementById.get(id)?.distinctAttributes || [];
            if (!allowed.length) return;
            distinctOptions = distinctOptions.flatMap((option) => {
              const used = option.used.get(id) || new Set();
              return uniqueSorted((candidate.attributes || []).filter((attribute) =>
                allowed.includes(attribute) && !used.has(attribute))).map((attribute) => {
                const next = new Map([...option.used].map(([key, values]) => [key, new Set(values)]));
                const values = new Set(next.get(id) || []);
                values.add(attribute);
                next.set(id, values);
                return { used: next };
              });
            });
          });
          for (const distinctOption of distinctOptions) {
            const counts = new Map(state.counts);
            coverageIds.forEach((id) => counts.set(id, Math.max(0, (counts.get(id) || 0) - 1)));
            const selected = new Set(state.selected);
            selected.add(candidate.code);
            const allocations = new Map(state.allocations);
            allocations.set(candidate.code, coverageIds);
            const sharedCounts = new Map(state.sharedCounts);
            sharedPairs.forEach((item) => sharedCounts.set(item.key, (sharedCounts.get(item.key) || 0) + 1));
            visit({ counts, selected, allocations, sharedCounts, distinctUsed: distinctOption.used });
            if (exhausted || refinementStopped) return;
          }
        }
      }
    }

    visit({
      counts: needed,
      selected: new Set(),
      allocations: new Map(),
      sharedCounts: new Map(),
      distinctUsed: new Map(),
    });
    const bestIsComplete = best && remainingSlots(best.state.counts) === 0;
    if (exhausted && !bestIsComplete) return {
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
    }).filter((candidate) => !candidateIsPlanned(candidate, candidate.code));
    const explanations = [];
    selectedCourses.filter((item) => item.prerequisiteOnly).forEach((item) => {
      const aliases = item.equivalentCourseCodes || [item.code];
      const avoided = aliases.some((code) => globalPreferenceRank(code) === 3);
      if (!avoided) return;
      const unlocks = selectedCourses.filter((course) =>
        !course.prerequisiteOnly
        && [...selectedWithPrerequisites([course.code])].some((code) => aliases.includes(code)))
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
      issues: unresolved.length
        ? [{ type: "unresolved_requirements", requirements: unresolved }]
        : (exhausted ? [{ type: "optimizer_limit_reached_after_complete_result", nodeLimit }] : []),
    };
  }

  root.ScheduleRUCourseSetOptimizer = { optimizeCourseSet };
})(globalThis);
