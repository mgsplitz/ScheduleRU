/*
 * Pure, serializable coverage graph for unresolved requirement decisions.
 * It joins reviewed equivalencies and double-count policy facts without
 * mutating requirement trees or deciding which semester a course belongs in.
 */
(function exposeCandidateCoverageModel(root) {
  const text = (value) => String(value ?? "").trim();
  const uniqueSorted = (values) => [...new Set(values.filter(Boolean))].sort();
  const pairKey = (left, right) => [left, right].filter(Boolean).sort().join("|");

  function reviewedEquivalencies(equivalencies) {
    return (Array.isArray(equivalencies) ? equivalencies : []).filter((item) =>
      item?.review_status === "reviewed"
      && text(item.requirement_course_code)
      && text(item.equivalent_course_code));
  }

  function equivalenceFamilies(codes, equivalencies) {
    const parent = new Map();
    const find = (code) => {
      if (!parent.has(code)) parent.set(code, code);
      const current = parent.get(code);
      if (current !== code) parent.set(code, find(current));
      return parent.get(code);
    };
    const union = (left, right) => {
      const a = find(left);
      const b = find(right);
      if (a === b) return;
      const [first, second] = [a, b].sort();
      parent.set(second, first);
    };
    codes.forEach(find);
    reviewedEquivalencies(equivalencies).forEach((item) => {
      const required = text(item.requirement_course_code);
      const equivalent = text(item.equivalent_course_code);
      find(required);
      find(equivalent);
      union(required, equivalent);
    });
    return { canonical: (code) => find(text(code)) };
  }

  function normalizedRequirement(decision, index) {
    const id = text(decision?.decisionId)
      || `${text(decision?.sourceType) || "program"}:${text(decision?.sourceProgram)}:${text(decision?.requirementGroupId) || index}`;
    return {
      id,
      requirementGroupId: text(decision?.requirementGroupId) || id,
      sourceProgram: text(decision?.sourceProgram),
      sourceType: decision?.sourceType === "core" ? "core" : "program",
      label: text(decision?.label) || "Course requirement",
      slotCount: Math.max(1, Number(decision?.slotCount) || 1),
      mandatory: true,
      canDefer: decision?.canDefer === true,
      allocationFamily: text(decision?.allocationFamily) || null,
      coreAttribute: text(decision?.coreAttribute) || null,
      distinctAttributes: uniqueSorted(decision?.distinctAttributes || []),
    };
  }

  function allowedException(exception, candidateCodes) {
    if (exception?.review_status && exception.review_status !== "reviewed") return false;
    const raw = exception?.allowed_course_codes ?? exception?.allowed_course_codes_json;
    let codes = raw;
    if (typeof raw === "string") {
      try { codes = JSON.parse(raw); } catch (_error) { codes = []; }
    }
    const allowed = new Set(Array.isArray(codes) ? codes.map(text) : []);
    return candidateCodes.some((code) => allowed.has(code));
  }

  function programScope(left, right) {
    const types = [left?.type, right?.type].sort();
    if (types[0] === "major" && types[1] === "major") return "major_major";
    if (types[0] === "concentration" && types[1] === "major") return "major_concentration";
    return null;
  }

  function doubleCountConflict(candidate, leftId, rightId, policies) {
    if ((candidate.reviewedEquivalentRequirementIds || []).some((id) =>
      [leftId, rightId].includes(candidate.requirementPrograms?.[id]))) return null;
    const programs = new Map((policies?.programs || []).map((item) => [item.id, item]));
    const pair = pairKey(leftId, rightId);
    const exceptions = (policies?.doubleCountExceptions || []).filter((item) =>
      pairKey(item?.program_a, item?.program_b) === pair);
    if (exceptions.some((item) => allowedException(item, candidate.equivalentCourseCodes))) return null;

    const directRule = (policies?.doubleCountRules || []).find((item) =>
      pairKey(item?.program_a, item?.program_b) === pair);
    if (directRule) {
      return {
        type: "double_count_credit_cap",
        candidateCode: candidate.code,
        programIds: [leftId, rightId].sort(),
        maxSharedCredits: Math.max(0, Number(directRule.max_shared_credits) || 0),
      };
    }

    const left = programs.get(leftId);
    const right = programs.get(rightId);
    const scope = programScope(left, right);
    const school = left?.school_slug && left.school_slug === right?.school_slug
      ? left.school_slug
      : null;
    const policy = (policies?.doubleCountPolicies || []).find((item) =>
      item?.scope === scope && (!item.school_slug || item.school_slug === school));
    if (policy) {
      return {
        type: "double_count_cap",
        candidateCode: candidate.code,
        programIds: [leftId, rightId].sort(),
        scope,
        maxSharedCourses: Math.max(0, Number(policy.max_shared_courses) || 0),
      };
    }
    return {
      type: "double_count_unknown",
      candidateCode: candidate.code,
      programIds: [leftId, rightId].sort(),
    };
  }

  function buildCoverageGraph({ decisions = [], equivalencies = [], policies = {} } = {}) {
    const requirements = decisions.map(normalizedRequirement)
      .sort((left, right) => left.id.localeCompare(right.id));
    const requirementById = new Map(requirements.map((item) => [item.id, item]));
    const allCodes = decisions.flatMap((decision) =>
      (decision?.candidates || []).map((candidate) => text(candidate?.code)).filter(Boolean));
    const families = equivalenceFamilies(allCodes, equivalencies);
    const byCanonical = new Map();

    decisions.flatMap((decision) => decision?.prerequisiteCourses || []).forEach((record) => {
      const code = text(record?.code);
      if (!code || byCanonical.has(code)) return;
      byCanonical.set(code, {
        code,
        title: text(record?.title) || "Course title unavailable",
        credits: Number(record?.credits) > 0 ? Number(record.credits) : 3,
        creditsEstimated: !(Number(record?.credits) > 0),
        equivalentCourseCodes: [code],
        coverageRequirementIds: [],
        reviewedEquivalentRequirementIds: [],
        prerequisitePaths: [],
        enforceablePrerequisitePaths: [],
        prerequisiteClosure: [],
        attributes: [],
        offeringEvidence: null,
        minimumPlanYear: null,
        minimumPriorCredits: null,
      });
    });

    decisions.forEach((decision, index) => {
      const requirement = normalizedRequirement(decision, index);
      (decision?.candidates || []).forEach((record) => {
        const code = text(record?.code);
        if (!code) return;
        const canonical = families.canonical(code);
        const current = byCanonical.get(canonical) || {
          code: canonical,
          title: text(record?.title) || canonical,
          credits: Number(record?.credits) > 0 ? Number(record.credits) : 3,
          creditsEstimated: record?.creditsEstimated === true,
          equivalentCourseCodes: [],
          coverageRequirementIds: [],
          reviewedEquivalentRequirementIds: [],
          prerequisitePaths: [],
          enforceablePrerequisitePaths: [],
          prerequisiteClosure: [],
          attributes: [],
          offeringEvidence: null,
          minimumPlanYear: Number(record?.minimumPlanYear) || null,
          minimumPriorCredits: Number(record?.minimumPriorCredits) || null,
        };
        current.equivalentCourseCodes.push(code);
        current.coverageRequirementIds.push(requirement.id);
        if (text(record?.equivalentFor)) current.reviewedEquivalentRequirementIds.push(requirement.id);
        (record?.prerequisitePaths || []).forEach((path) => {
          const normalized = uniqueSorted((path || []).map(text));
          if (normalized.length) current.prerequisitePaths.push(normalized);
          current.prerequisiteClosure.push(...normalized);
        });
        (record?.enforceablePrerequisitePaths || []).forEach((path) => {
          const normalized = uniqueSorted((path || []).map(text));
          if (normalized.length) current.enforceablePrerequisitePaths.push(normalized);
        });
        current.attributes.push(...(record?.attributes || []).map(text));
        current.offeringEvidence ||= record?.offeringEvidence || null;
        current.minimumPlanYear ||= Number(record?.minimumPlanYear) || null;
        current.minimumPriorCredits ||= Number(record?.minimumPriorCredits) || null;
        if (code === canonical && text(record?.title)) current.title = text(record.title);
        current.credits = Math.min(current.credits, Number(record?.credits) > 0 ? Number(record.credits) : 3);
        current.creditsEstimated &&= record?.creditsEstimated === true;
        byCanonical.set(canonical, current);
      });
    });

    // Equivalency rows may introduce an alias that occurs only in a different
    // decision. Merge all records whose canonical family is the same.
    const merged = new Map();
    for (const candidate of byCanonical.values()) {
      const canonical = families.canonical(candidate.code);
      const current = merged.get(canonical) || { ...candidate, code: canonical };
      if (current !== candidate) {
        current.equivalentCourseCodes.push(...candidate.equivalentCourseCodes);
        current.coverageRequirementIds.push(...candidate.coverageRequirementIds);
        current.reviewedEquivalentRequirementIds.push(...candidate.reviewedEquivalentRequirementIds);
        current.prerequisitePaths.push(...candidate.prerequisitePaths);
        current.enforceablePrerequisitePaths.push(...candidate.enforceablePrerequisitePaths);
        current.prerequisiteClosure.push(...candidate.prerequisiteClosure);
        current.attributes.push(...candidate.attributes);
        current.credits = Math.min(current.credits, candidate.credits);
      }
      merged.set(canonical, current);
    }

    const candidates = [...merged.values()].map((candidate) => ({
      ...candidate,
      equivalentCourseCodes: uniqueSorted([
        ...candidate.equivalentCourseCodes,
        ...reviewedEquivalencies(equivalencies).flatMap((item) =>
          families.canonical(item.requirement_course_code) === candidate.code
            ? [item.requirement_course_code, item.equivalent_course_code]
            : []),
      ]),
      coverageRequirementIds: uniqueSorted(candidate.coverageRequirementIds),
      reviewedEquivalentRequirementIds: uniqueSorted(candidate.reviewedEquivalentRequirementIds),
      prerequisitePaths: uniqueSorted(candidate.prerequisitePaths.map((path) => path.join("\u0000")))
        .map((path) => path.split("\u0000")),
      enforceablePrerequisitePaths: uniqueSorted(candidate.enforceablePrerequisitePaths.map((path) => path.join("\u0000")))
        .map((path) => path.split("\u0000")),
      prerequisiteClosure: uniqueSorted(candidate.prerequisiteClosure),
      attributes: uniqueSorted(candidate.attributes),
      requirementPrograms: Object.fromEntries(uniqueSorted(candidate.coverageRequirementIds)
        .map((id) => [id, requirementById.get(id)?.sourceProgram || ""])),
    })).sort((left, right) => left.code.localeCompare(right.code));

    const conflicts = [];
    candidates.forEach((candidate) => {
      const covered = candidate.coverageRequirementIds.map((id) => requirementById.get(id)).filter(Boolean);
      const byFamily = new Map();
      covered.filter((item) => item.sourceType === "core" && item.allocationFamily)
        .forEach((item) => {
          const ids = byFamily.get(item.allocationFamily) || [];
          ids.push(item.id);
          byFamily.set(item.allocationFamily, ids);
        });
      for (const [allocationFamily, ids] of byFamily) {
        if (ids.length > 1) conflicts.push({
          type: "allocation_family",
          candidateCode: candidate.code,
          requirementIds: ids.sort(),
          allocationFamily,
        });
      }

      const programIds = uniqueSorted(covered
        .filter((item) => item.sourceType === "program")
        .map((item) => item.sourceProgram));
      for (let index = 0; index < programIds.length; index += 1) {
        for (let other = index + 1; other < programIds.length; other += 1) {
          const conflict = doubleCountConflict(candidate, programIds[index], programIds[other], policies);
          if (conflict) conflicts.push(conflict);
        }
      }
    });

    conflicts.sort((left, right) =>
      left.candidateCode.localeCompare(right.candidateCode)
      || left.type.localeCompare(right.type)
      || JSON.stringify(left).localeCompare(JSON.stringify(right)));
    return { requirements, candidates, conflicts };
  }

  root.ScheduleRUCandidateCoverageModel = { buildCoverageGraph };
})(globalThis);
