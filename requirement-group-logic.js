/*
 * Pure requirement-group completion logic shared by the browser and tests.
 *
 * A group may have nested constraints.  For example, a program can require
 * two electives in total while also requiring that at least one of those two
 * comes from a named primary-elective subset.  The parent owns the complete
 * approved list; its nested children restrict how that list may be used.
 */
(function exposeRequirementGroupLogic(root) {
  function appliedCourseIds(group, completed, options) {
    const allocated = typeof options?.allocatedCourseIds === "function"
      ? options.allocatedCourseIds(group)
      : undefined;
    if (Array.isArray(allocated)) return [...new Set(allocated.filter(Boolean))];
    const automatic = typeof options?.appliedCourseIds === "function"
      ? options.appliedCourseIds(group)
      : [];
    return [...new Set([
      ...(group?.members || []).filter((id) => completed(id)),
      ...(Array.isArray(automatic) ? automatic : []),
    ].filter(Boolean))];
  }

  function groupProgress(group, completed, options) {
    const applied = appliedCourseIds(group, completed, options);
    const courseCredits = typeof options?.courseCredits === "function"
      ? options.courseCredits
      : () => 0;
    const credits = applied.reduce((total, courseId) => {
      const value = Number(courseCredits(courseId));
      return total + (Number.isFinite(value) ? value : 0);
    }, 0);
    return { courses: applied.length, credits };
  }

  function groupFulfilled(groupId, groups, options) {
    const g = groups?.[groupId];
    if (!g) return false;

    const completed = typeof options?.isCompleted === "function" ? options.isCompleted : () => false;
    const selected = typeof options?.selectedRequirementCourses === "function"
      ? options.selectedRequirementCourses
      : () => [];
    const isConstraint = typeof options?.isConstraintGroup === "function"
      ? options.isConstraintGroup
      : () => false;
    const members = g.members || [];
    const applied = appliedCourseIds(g, completed, options);
    const progress = groupProgress(g, completed, options);
    const completedCount = progress.courses;

    if (g.rule === "all") {
      // A selector describes a set, not a fixed every-course checklist. A
      // reviewed selector-only group must therefore use a counted rule; do
      // not silently treat it as complete because its explicit list is empty.
      if (!members.length && (g.courseSelectors || []).length) return false;
      return members.every((id) => applied.includes(id))
        && (g.children || []).every((childId) => groupFulfilled(childId, groups, options));
    }

    if (g.rule === "distinct") {
      const applied = new Set([
        ...selected(g.id),
        ...appliedCourseIds(g, completed, options),
      ]);
      const distinct = (g.children || []).map((childId) => groups[childId]).filter(Boolean)
        .filter((child) => appliedCourseIds(child, completed, options).some((id) => applied.has(id))).length;
      return applied.size >= g.count && distinct >= g.count;
    }

    const ownRequirementMet = g.rule === "min"
      ? completedCount >= g.count
      : g.rule === "min_credits"
        ? progress.credits >= g.count
        : g.rule === "max_credits"
          ? progress.credits <= g.count
          : completedCount <= g.count;
    if (!ownRequirementMet) return false;

    // Nested children are constraints only when each child is a subset of the
    // parent's approved list.  This leaves normal "all" requirement trees
    // unchanged while supporting a reusable "total plus subset" rule.
    return (g.children || [])
      .filter((childId) => isConstraint(groups[childId]))
      .every((childId) => groupFulfilled(childId, groups, options));
  }

  function normalizedAllocation(group) {
    const family = typeof group?.allocation?.allocation_family === "string"
      ? group.allocation.allocation_family.trim()
      : "";
    const maxUses = Number(group?.allocation?.max_uses);
    if (!family || !Number.isInteger(maxUses) || maxUses < 1) return null;
    return { allocation_family: family, max_uses: maxUses };
  }

  function allocationScore(groups, options) {
    const isConstraint = typeof options?.isConstraintGroup === "function"
      ? options.isConstraintGroup
      : () => false;
    let required = 0;
    let completed = 0;
    for (const group of Object.values(groups || {})) {
      if (!group || isConstraint(group)) continue;
      if (!groupFulfilled(group.id, groups, options)) continue;
      completed += 1;
      if (group.rule === "all") required += 1;
    }
    return { required, completed };
  }

  function compareAllocationResults(left, right) {
    if (!right) return -1;
    if (left.required !== right.required) return right.required - left.required;
    if (left.completed !== right.completed) return right.completed - left.completed;
    return left.signature.localeCompare(right.signature);
  }

  function allocationChoices(groupIds, maxUses) {
    const choices = [];
    function visit(index, selected) {
      if (selected.length > maxUses) return;
      if (index === groupIds.length) {
        choices.push([...selected]);
        return;
      }
      selected.push(groupIds[index]);
      visit(index + 1, selected);
      selected.pop();
      visit(index + 1, selected);
    }
    visit(0, []);
    return choices.sort((a, b) => {
      const aKey = a.length ? a.join("\u0000") : "\uffff";
      const bKey = b.length ? b.join("\u0000") : "\uffff";
      return aKey.localeCompare(bKey);
    });
  }

  function hasNonMonotonicAllocationRule(groupId, groups, seen = new Set()) {
    if (!groupId || seen.has(groupId)) return false;
    seen.add(groupId);
    const group = groups?.[groupId];
    if (!group) return false;
    if (group.rule === "max" || group.rule === "max_credits") return true;
    return (group.children || []).some((childId) => hasNonMonotonicAllocationRule(childId, groups, seen));
  }

  // Allocation is opt-in reviewed data. A family limits how many times a
  // completed course can be applied among the groups in that family, without
  // changing how the same course is treated by groups outside the family.
  // The exhaustive, deterministic search is intentionally scoped to courses
  // that a reviewed family names; normal requirement evaluation is unchanged.
  function allocateRequirementCourses(groups, options) {
    const completed = typeof options?.isCompleted === "function" ? options.isCompleted : () => false;
    const configured = Object.values(groups || {})
      .map((group) => ({ group, allocation: normalizedAllocation(group) }))
      .filter((entry) => entry.group && entry.allocation)
      .sort((a, b) => String(a.group.id).localeCompare(String(b.group.id)));
    const appliedByGroup = Object.fromEntries(configured.map(({ group }) => [group.id, []]));
    const families = new Map();
    for (const entry of configured) {
      const members = appliedCourseIds(entry.group, completed, options);
      const family = families.get(entry.allocation.allocation_family) || [];
      family.push({ ...entry, members });
      families.set(entry.allocation.allocation_family, family);
    }
    const candidates = [];
    for (const [familyName, entries] of families) {
      const courses = new Map();
      const maxUses = Math.min(...entries.map((entry) => entry.allocation.max_uses));
      for (const entry of entries) {
        for (const courseId of entry.members) {
          const groupIds = courses.get(courseId) || [];
          groupIds.push(entry.group.id);
          courses.set(courseId, groupIds);
        }
      }
      for (const courseId of [...courses.keys()].sort()) {
        candidates.push({
          key: `${familyName}:${courseId}`,
          courseId,
          groupIds: [...new Set(courses.get(courseId) || [])].sort(),
          maxUses,
        });
      }
    }
    candidates.sort((a, b) => a.key.localeCompare(b.key));
    let best = null;
    const working = Object.fromEntries(configured.map(({ group }) => [group.id, []]));
    const isConstraint = typeof options?.isConstraintGroup === "function" ? options.isConstraintGroup : () => false;
    const scoredGroups = Object.values(groups || {}).filter((group) => group && !isConstraint(group));
    const maximumRequired = scoredGroups.filter((group) => group.rule === "all").length;
    const maximumCompleted = scoredGroups.length;

    function scoreForAllocation(allocatedCourseIds) {
      return allocationScore(groups, {
        ...options,
        isCompleted: completed,
        allocatedCourseIds: (group) => Object.prototype.hasOwnProperty.call(allocatedCourseIds, group?.id)
          ? allocatedCourseIds[group.id]
          : undefined,
      });
    }

    function scoreCurrent() {
      const score = scoreForAllocation(working);
      const signature = candidates.map((candidate) => {
        const selected = Object.entries(working)
          .filter(([, courseList]) => courseList.includes(candidate.courseId))
          .map(([groupId]) => groupId)
          .filter((groupId) => candidate.groupIds.includes(groupId))
          .sort();
        return `${candidate.key}:${selected.length ? selected.join(",") : "~"}`;
      }).join("|");
      return { ...score, signature };
    }

    function allocationUpperBound(candidateIndex) {
      const potential = Object.fromEntries(Object.entries(working).map(([groupId, values]) => [groupId, [...values]]));
      for (const candidate of candidates.slice(candidateIndex)) {
        for (const groupId of candidate.groupIds) {
          if (!potential[groupId].includes(candidate.courseId)) potential[groupId].push(candidate.courseId);
        }
      }
      const bound = scoreForAllocation(potential);
      for (const group of scoredGroups) {
        if (!hasNonMonotonicAllocationRule(group.id, groups) || groupFulfilled(group.id, groups, {
          ...options,
          isCompleted: completed,
          allocatedCourseIds: (candidate) => Object.prototype.hasOwnProperty.call(potential, candidate?.id)
            ? potential[candidate.id]
            : undefined,
        })) continue;
        bound.completed += 1;
        if (group.rule === "all") bound.required += 1;
      }
      return bound;
    }

    function visit(candidateIndex) {
      if (best) {
        const bound = allocationUpperBound(candidateIndex);
        if (bound.required < best.required || (bound.required === best.required && bound.completed <= best.completed)) return false;
      }
      if (candidateIndex === candidates.length) {
        const candidate = scoreCurrent();
        if (compareAllocationResults(candidate, best) < 0) {
          best = { ...candidate, appliedByGroup: Object.fromEntries(Object.entries(working).map(([id, values]) => [id, [...values]])) };
        }
        // Choices are traversed in the same stable order used by the
        // signature. Once every scoreable group is complete, no later branch
        // can improve the score or its deterministic tie-break.
        return candidate.required === maximumRequired && candidate.completed === maximumCompleted;
      }
      const candidate = candidates[candidateIndex];
      for (const choice of allocationChoices(candidate.groupIds, candidate.maxUses)) {
        choice.forEach((groupId) => working[groupId].push(candidate.courseId));
        const optimal = visit(candidateIndex + 1);
        choice.forEach((groupId) => working[groupId].pop());
        if (optimal) return true;
      }
      return false;
    }

    visit(0);
    for (const groupId of Object.keys(appliedByGroup)) appliedByGroup[groupId] = best?.appliedByGroup[groupId] || [];
    const allocationByCourse = Object.fromEntries(candidates.map((candidate) => [
      candidate.key,
      Object.entries(best?.appliedByGroup || {})
        .filter(([, courseList]) => courseList.includes(candidate.courseId))
        .map(([groupId]) => groupId)
        .filter((groupId) => candidate.groupIds.includes(groupId))
        .sort(),
    ]));

    const finalScore = allocationScore(groups, {
      ...options,
      isCompleted: completed,
      allocatedCourseIds: (group) => Object.prototype.hasOwnProperty.call(appliedByGroup, group?.id)
        ? appliedByGroup[group.id]
        : undefined,
    });
    return { appliedByGroup, allocationByCourse, completedRequirements: finalScore.completed };
  }

  function asDisplayPriority(root) {
    const value = Number(root?.display_priority);
    return Number.isFinite(value) ? value : 0;
  }

  function requirementsForDisplay(requirementTrees, programIds, signatureForRoot) {
    const signature = typeof signatureForRoot === "function"
      ? signatureForRoot
      : (root) => JSON.stringify(root || {});
    const roots = [];
    const seenSignatures = new Set();
    const familyIndexes = new Map();

    for (const programId of programIds || []) {
      for (const root of requirementTrees?.[programId] || []) {
        const family = typeof root?.display_family === "string" ? root.display_family.trim() : "";
        if (!family) {
          const rootSignature = signature(root);
          if (seenSignatures.has(rootSignature)) continue;
          seenSignatures.add(rootSignature);
          roots.push(root);
          continue;
        }

        const existingIndex = familyIndexes.get(family);
        if (existingIndex === undefined) {
          familyIndexes.set(family, roots.length);
          roots.push(root);
          continue;
        }

        if (asDisplayPriority(root) > asDisplayPriority(roots[existingIndex])) {
          roots[existingIndex] = root;
        }
      }
    }
    return roots;
  }

  function sharedRequirementRootKey(root, signatureForRoot) {
    const family = typeof root?.display_family === "string" ? root.display_family.trim() : "";
    if (family) return `family:${family}`;
    const signature = typeof signatureForRoot === "function"
      ? signatureForRoot(root)
      : JSON.stringify(root || {});
    return `signature:${signature}`;
  }

  function sharedRequirementGroups(requirementTrees, programIds, signatureForRoot) {
    const found = new Map();
    for (const programId of programIds || []) {
      for (const root of requirementTrees?.[programId] || []) {
        const key = sharedRequirementRootKey(root, signatureForRoot);
        const entry = found.get(key) || { key, name: root?.name || "Shared requirement", programs: new Set() };
        entry.programs.add(programId);
        found.set(key, entry);
      }
    }
    return [...found.values()].filter((entry) => entry.programs.size > 1);
  }

  function normalizedPairKey(programA, programB) {
    return [programA, programB].filter(Boolean).sort().join("|");
  }

  function allowedCourseCodes(exception) {
    const raw = exception?.allowed_course_codes_json;
    if (Array.isArray(raw)) return new Set(raw.filter(Boolean));
    try {
      const parsed = JSON.parse(raw || "[]");
      return new Set(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
    } catch {
      return new Set();
    }
  }

  function overlapScope(programA, programB, programsById) {
    const types = [programsById?.[programA]?.type, programsById?.[programB]?.type].sort();
    if (types[0] === "major" && types[1] === "major") return "major_major";
    if (types[0] === "concentration" && types[1] === "major") return "major_concentration";
    return null;
  }

  // A course-specific exception is deliberately separate from a school-wide
  // cap. It permits only the named course(s) for one named program pair.
  // This accommodates published exceptions without weakening the policy for
  // every other course or every other major/concentration combination.
  function partitionDoubleCountOverlaps(overlaps, programsById, exceptions) {
    const exceptionByPair = new Map();
    for (const exception of exceptions || []) {
      const key = normalizedPairKey(exception?.program_a, exception?.program_b);
      if (key) exceptionByPair.set(key, exception);
    }
    const genericByScope = new Map();
    const exceptionMatches = new Map();
    const unscoped = new Map();

    function add(map, key, code, programIds, exception) {
      const entry = map.get(key) || { ...(exception || {}), programs: new Set(), courses: new Map() };
      programIds.forEach((id) => entry.programs.add(id));
      const course = entry.courses.get(code) || { code, programs: new Set() };
      programIds.forEach((id) => course.programs.add(id));
      entry.courses.set(code, course);
      map.set(key, entry);
    }

    for (const overlap of overlaps || []) {
      const programIds = [...new Set(overlap?.programs || [])].sort();
      for (let index = 0; index < programIds.length; index += 1) {
        for (let otherIndex = index + 1; otherIndex < programIds.length; otherIndex += 1) {
          const pair = [programIds[index], programIds[otherIndex]];
          const pairKey = normalizedPairKey(...pair);
          const exception = exceptionByPair.get(pairKey);
          if (exception && allowedCourseCodes(exception).has(overlap.code)) {
            add(exceptionMatches, pairKey, overlap.code, pair, exception);
            continue;
          }
          const scope = overlapScope(pair[0], pair[1], programsById);
          if (scope) add(genericByScope, scope, overlap.code, pair);
          else add(unscoped, pairKey, overlap.code, pair);
        }
      }
    }

    function serialize(entries) {
      return [...entries.values()].map((entry) => ({
        ...entry,
        programs: [...entry.programs],
        courses: [...entry.courses.values()].map((course) => ({ ...course, programs: [...course.programs] })),
      }));
    }

    const scopes = {};
    for (const [scope, entry] of genericByScope) scopes[scope] = serialize(new Map([[scope, entry]]))[0].courses;
    return { scopes, exceptions: serialize(exceptionMatches), unscoped: serialize(unscoped).flatMap((entry) => entry.courses) };
  }

  root.ScheduleRURequirementLogic = {
    groupFulfilled,
    appliedCourseIds,
    groupProgress,
    allocateRequirementCourses,
    requirementsForDisplay,
    sharedRequirementRootKey,
    sharedRequirementGroups,
    normalizedPairKey,
    partitionDoubleCountOverlaps,
  };
})(globalThis);
