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
    const automatic = typeof options?.appliedCourseIds === "function"
      ? options.appliedCourseIds(group)
      : [];
    return [...new Set([
      ...(group?.members || []).filter((id) => completed(id)),
      ...(Array.isArray(automatic) ? automatic : []),
    ].filter(Boolean))];
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
    const completedCount = applied.length;

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
      : completedCount <= g.count;
    if (!ownRequirementMet) return false;

    // Nested children are constraints only when each child is a subset of the
    // parent's approved list.  This leaves normal "all" requirement trees
    // unchanged while supporting a reusable "total plus subset" rule.
    return (g.children || [])
      .filter((childId) => isConstraint(groups[childId]))
      .every((childId) => groupFulfilled(childId, groups, options));
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
    requirementsForDisplay,
    sharedRequirementRootKey,
    sharedRequirementGroups,
    normalizedPairKey,
    partitionDoubleCountOverlaps,
  };
})(globalThis);
