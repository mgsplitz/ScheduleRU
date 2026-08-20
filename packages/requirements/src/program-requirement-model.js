(function exposeProgramRequirementModel(root) {
  const requirementLogic = root.ScheduleRURequirementLogic;

  function collectCourseCodes(group, into = new Set()) {
    for (const item of group?.courses || []) {
      if (item?.course_code) into.add(item.course_code);
    }
    for (const child of group?.children || []) collectCourseCodes(child, into);
    return into;
  }

  function collectSelectorSignatures(group, into = []) {
    for (const selector of group?.course_selectors || []) {
      const raw = typeof selector?.selector_json === "string"
        ? selector.selector_json
        : JSON.stringify(selector?.selector_json || {});
      if (raw) into.push(raw);
    }
    for (const child of group?.children || []) collectSelectorSignatures(child, into);
    return into;
  }

  function normalizedName(name) {
    return String(name || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function rootSignature(requirementRoot) {
    const codes = [...collectCourseCodes(requirementRoot)].sort();
    const selectors = collectSelectorSignatures(requirementRoot).sort();
    return JSON.stringify([
      normalizedName(requirementRoot?.name),
      requirementRoot?.rule || "",
      requirementRoot?.count ?? null,
      codes,
      selectors,
    ]);
  }

  function rootCourseCodes(requirementRoot) {
    return (requirementRoot?.courses || [])
      .map((item) => item?.course_code)
      .filter(Boolean);
  }

  function sharedCoreBaselines(referenceTrees) {
    const candidates = new Map();
    for (const roots of Object.values(referenceTrees || {})) {
      for (const requirementRoot of roots || []) {
        const key = normalizedName(requirementRoot?.name);
        const codes = rootCourseCodes(requirementRoot);
        if (!key
          || requirementRoot?.rule !== "all"
          || (requirementRoot?.children || []).length
          || codes.length < 4
          || !/(business|foundational|common|core)/i.test(requirementRoot?.name || "")) continue;
        const rows = candidates.get(key) || [];
        rows.push(requirementRoot);
        candidates.set(key, rows);
      }
    }

    const baselines = new Map();
    for (const [key, roots] of candidates) {
      if (roots.length < 2) continue;
      const shared = roots.slice(1).reduce((codes, requirementRoot) => {
        const available = new Set(rootCourseCodes(requirementRoot));
        return codes.filter((code) => available.has(code));
      }, rootCourseCodes(roots[0]));
      if (shared.length >= 4) {
        baselines.set(key, { template: roots[0], codes: new Set(shared) });
      }
    }
    return baselines;
  }

  function normalizeProgramTrees({
    requirementTrees,
    programIds,
    referenceRequirementTrees,
    availablePrograms,
  }) {
    const references = Object.keys(referenceRequirementTrees || {}).length
      ? referenceRequirementTrees
      : requirementTrees;
    const baselines = sharedCoreBaselines(references);
    if (!baselines.size) return requirementTrees;

    const normalized = {};
    for (const programId of programIds || []) {
      const roots = requirementTrees?.[programId] || [];
      normalized[programId] = roots.flatMap((requirementRoot) => {
        const baseline = baselines.get(normalizedName(requirementRoot?.name));
        const codes = rootCourseCodes(requirementRoot);
        if (!baseline
          || requirementRoot?.rule !== "all"
          || (requirementRoot?.children || []).length
          || !codes.length) return [requirementRoot];

        const byCode = new Map(
          (requirementRoot.courses || []).map((item) => [item.course_code, item]),
        );
        const sharedCourses = [...baseline.codes]
          .map((code) => byCode.get(code)
            || baseline.template.courses?.find((item) => item.course_code === code))
          .filter(Boolean);
        const sharedRoot = {
          ...requirementRoot,
          id: `${requirementRoot.id}-shared-base`,
          courses: sharedCourses,
        };
        const residualCourses = (requirementRoot.courses || []).filter((item) => {
          if (baseline.codes.has(item.course_code)) return false;
          return !roots.some((other) => other !== requirementRoot
            && rootCourseCodes(other).includes(item.course_code));
        });
        if (!residualCourses.length) return [sharedRoot];
        const program = (availablePrograms || []).find((item) => item.id === programId);
        return [sharedRoot, {
          ...requirementRoot,
          id: `${requirementRoot.id}-program-additions`,
          name: `${program?.name || "Program"}-specific additions to ${requirementRoot.name}`,
          courses: residualCourses,
        }];
      });
    }
    return normalized;
  }

  function requirementsForDisplay({ requirementTrees, programIds }) {
    return requirementLogic.requirementsForDisplay(
      requirementTrees,
      programIds,
      rootSignature,
    );
  }

  function computeDoubleCount({
    requirementTrees,
    programIds,
    availablePrograms,
    doubleCountExceptions,
    doubleCountPolicies,
  }) {
    const shared = requirementLogic.sharedRequirementGroups(
      requirementTrees,
      programIds,
      rootSignature,
    );
    const sharedKeys = new Set(shared.map((entry) => entry.key));
    const programsById = Object.fromEntries(
      (availablePrograms || []).map((program) => [program.id, program]),
    );
    const coursePrograms = new Map();
    for (const programId of programIds || []) {
      const codes = new Set();
      for (const requirementRoot of requirementTrees?.[programId] || []) {
        const key = requirementLogic.sharedRequirementRootKey(
          requirementRoot,
          rootSignature,
        );
        if (sharedKeys.has(key)) continue;
        collectCourseCodes(requirementRoot, codes);
      }
      for (const code of codes) {
        const owners = coursePrograms.get(code) || new Set();
        owners.add(programId);
        coursePrograms.set(code, owners);
      }
    }

    const overlaps = [...coursePrograms.entries()]
      .filter(([, owners]) => owners.size > 1)
      .map(([code, owners]) => ({ code, programs: [...owners] }))
      .sort((left, right) => left.code.localeCompare(right.code));
    const partition = requirementLogic.partitionDoubleCountOverlaps(
      overlaps,
      programsById,
      doubleCountExceptions || [],
    );
    const scopeResults = ["major_major", "major_concentration"].map((scope) => {
      const policy = (doubleCountPolicies || []).find((item) => item.scope === scope);
      const codes = partition.scopes[scope] || [];
      const cap = policy?.max_shared_courses === null
        || policy?.max_shared_courses === undefined
        ? null
        : Number(policy.max_shared_courses);
      return { scope, policy, codes, cap, violates: cap !== null && codes.length > cap };
    });
    return {
      shared,
      overlaps,
      scopeResults,
      unscoped: partition.unscoped || [],
      exceptions: partition.exceptions || [],
    };
  }

  function requirementTabs({ homeSchool, programs, sharedRoots } = {}) {
    const rows = Array.isArray(programs) ? programs : [];
    const roleRank = { primary: 0, secondary: 1 };
    const majors = rows
      .filter((program) => program?.type === "major")
      .map((program, index) => ({ program, index }))
      .sort((left, right) => {
        const leftRank = roleRank[left.program?.role] ?? 2;
        const rightRank = roleRank[right.program?.role] ?? 2;
        return leftRank - rightRank || left.index - right.index;
      })
      .map(({ program }) => program);
    const minors = rows.filter((program) => program?.type === "minor");
    const other = rows.filter((program) => !["major", "minor"].includes(program?.type));
    const tabs = [];
    if ((sharedRoots || []).length) {
      const slug = String(homeSchool?.slug || "school").trim() || "school";
      tabs.push({
        id: `school:${slug}`,
        label: homeSchool?.core_label || homeSchool?.coreLabel || "Shared requirements",
        kind: "shared",
        minor: false,
      });
    }
    for (const program of [...majors, ...other, ...minors]) {
      tabs.push({
        id: program.id,
        label: program.name || "Program",
        kind: "program",
        minor: program.type === "minor",
      });
    }
    return tabs;
  }

  function nextActions(progress) {
    return (progress || [])
      .map((item, index) => ({ ...item, _index: index }))
      .filter((item) => item?.id && item?.label && item.complete !== true)
      .sort((left, right) => (Number(left.priority) || 0) - (Number(right.priority) || 0)
        || left._index - right._index)
      .slice(0, 3)
      .map(({ _index, ...item }) => item);
  }

  root.ScheduleRUProgramRequirementModel = {
    rootSignature,
    normalizeProgramTrees,
    requirementsForDisplay,
    computeDoubleCount,
    requirementTabs,
    nextActions,
  };
})(globalThis);
