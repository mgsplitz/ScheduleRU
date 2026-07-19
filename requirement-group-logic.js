/*
 * Pure requirement-group completion logic shared by the browser and tests.
 *
 * A group may have nested constraints.  For example, a program can require
 * two electives in total while also requiring that at least one of those two
 * comes from a named primary-elective subset.  The parent owns the complete
 * approved list; its nested children restrict how that list may be used.
 */
(function exposeRequirementGroupLogic(root) {
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
    const completedCount = members.filter((id) => completed(id)).length;

    if (g.rule === "all") {
      return members.every((id) => completed(id))
        && (g.children || []).every((childId) => groupFulfilled(childId, groups, options));
    }

    if (g.rule === "distinct") {
      const applied = new Set([
        ...selected(g.id),
        ...members.filter((id) => completed(id)),
      ]);
      const distinct = (g.children || []).map((childId) => groups[childId]).filter(Boolean)
        .filter((child) => (child.members || []).some((id) => applied.has(id))).length;
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

  root.ScheduleRURequirementLogic = {
    groupFulfilled,
    requirementsForDisplay,
    sharedRequirementRootKey,
    sharedRequirementGroups,
  };
})(globalThis);
