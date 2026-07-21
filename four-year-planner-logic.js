/*
 * Deterministic, browser-safe four-year planning rules. This module owns no
 * state: callers supply reviewed inputs and decide whether to accept a plan.
 */
(function exposeFourYearPlanner(root) {
  const DEFAULT_TARGET = 16;
  const DEFAULT_MAX = 18;

  function termOrdinal(term) {
    const year = Number(term?.year);
    const sem = String(term?.sem || "").toLowerCase();
    if (!Number.isInteger(year) || year < 1 || (sem !== "fall" && sem !== "spring")) return null;
    return (year - 1) * 2 + (sem === "fall" ? 0 : 1);
  }

  function termKey(term) {
    return `${Number(term.year)}:${String(term.sem).toLowerCase()}`;
  }

  function courseCode(value) {
    const code = String(value || "").trim();
    return code || null;
  }

  function nonNegativeNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : fallback;
  }

  function stableText(value) {
    return String(value || "").trim();
  }

  function normalizePlannerInput(input = {}) {
    const termsByKey = new Map();
    (Array.isArray(input.terms) ? input.terms : []).forEach((term) => {
      const ordinal = termOrdinal(term);
      if (ordinal === null) return;
      const normalized = { year: Number(term.year), sem: String(term.sem).toLowerCase(), ordinal };
      termsByKey.set(termKey(normalized), normalized);
    });
    const terms = [...termsByKey.values()].sort((left, right) => left.ordinal - right.ordinal || termKey(left).localeCompare(termKey(right)));

    const courseCandidates = (Array.isArray(input.courses) ? input.courses : [])
      .map((course) => ({
        code: courseCode(course?.code),
        credits: nonNegativeNumber(course?.credits, 0),
        title: stableText(course?.title),
      }))
      .filter((course) => course.code)
      .sort((left, right) => left.code.localeCompare(right.code) || left.credits - right.credits || left.title.localeCompare(right.title));
    const coursesByCode = new Map();
    courseCandidates.forEach((course) => {
      if (!coursesByCode.has(course.code)) coursesByCode.set(course.code, course);
    });
    const courses = [...coursesByCode.values()];

    const completedCourseCodes = new Set((Array.isArray(input.completedCourseCodes) ? input.completedCourseCodes : [])
      .map(courseCode)
      .filter(Boolean));

    const prerequisitePathsByCode = {};
    Object.keys(input.prerequisitePathsByCode || {}).map(courseCode).filter(Boolean).sort().forEach((code) => {
      const rawPaths = input.prerequisitePathsByCode[code];
      if (!Array.isArray(rawPaths)) return;
      const unique = new Map();
      rawPaths.filter(Array.isArray).forEach((path) => {
        const normalized = [...new Set(path.map(courseCode).filter(Boolean))].sort();
        unique.set(normalized.join("\u0000"), normalized);
      });
      prerequisitePathsByCode[code] = [...unique.values()].sort((left, right) => left.join("\u0000").localeCompare(right.join("\u0000")));
    });

    const lockedPlacements = {};
    Object.keys(input.lockedPlacements || {}).map(courseCode).filter(Boolean).sort().forEach((code) => {
      const placement = input.lockedPlacements[code];
      const ordinal = termOrdinal(placement);
      lockedPlacements[code] = {
        code,
        year: Number(placement?.year),
        sem: String(placement?.sem || "").toLowerCase(),
        ordinal,
        credits: nonNegativeNumber(coursesByCode.get(code)?.credits ?? placement?.credits, 0),
      };
    });

    const unresolvedRequirements = (Array.isArray(input.unresolvedRequirements) ? input.unresolvedRequirements : [])
      .map((requirement) => ({
        id: stableText(requirement?.id),
        label: stableText(requirement?.label) || "Unresolved requirement",
        credits: nonNegativeNumber(requirement?.credits, 3),
        sourceType: stableText(requirement?.sourceType) || "requirement",
        sourceProgram: stableText(requirement?.sourceProgram || requirement?.programId),
        requirementGroupId: stableText(requirement?.requirementGroupId || requirement?.groupId || requirement?.id),
        candidateSelectionContext: requirement?.candidateSelectionContext ?? requirement?.candidateContext ?? null,
      }))
      .sort((left, right) => left.sourceType.localeCompare(right.sourceType)
        || left.id.localeCompare(right.id)
        || left.label.localeCompare(right.label)
        || left.credits - right.credits)
      .map((requirement, index) => ({ ...requirement, inputOrdinal: index }));

    const suppliedMaximum = nonNegativeNumber(input.maxCredits, DEFAULT_MAX);
    const maxCredits = Math.min(suppliedMaximum, DEFAULT_MAX);
    const targetCredits = Math.min(nonNegativeNumber(input.targetCredits, DEFAULT_TARGET), maxCredits);
    return { terms, courses, completedCourseCodes, lockedPlacements, prerequisitePathsByCode, unresolvedRequirements, targetCredits, maxCredits };
  }

  function createPlaceholder(requirement = {}, ordinal) {
    const sourceType = stableText(requirement.sourceType) || "requirement";
    const requirementId = stableText(requirement.id) || "unresolved";
    const inputOrdinal = Number.isInteger(requirement.inputOrdinal) ? requirement.inputOrdinal : 0;
    return {
      id: `placeholder:${sourceType}:${requirementId}:${Number(ordinal)}:${inputOrdinal}`,
      kind: "requirement_placeholder",
      sourceType,
      sourceProgram: stableText(requirement.sourceProgram),
      requirementGroupId: stableText(requirement.requirementGroupId) || requirementId,
      label: stableText(requirement.label) || "Unresolved requirement",
      estimatedCredits: nonNegativeNumber(requirement.credits, 3),
      credits: nonNegativeNumber(requirement.credits, 3),
      candidateSelectionContext: requirement.candidateSelectionContext ?? null,
      termOrdinal: Number(ordinal),
    };
  }

  function issue(code, severity, details = {}) {
    return { code, severity, ...details };
  }

  function prerequisitePathsFor(input, code) {
    return Object.prototype.hasOwnProperty.call(input.prerequisitePathsByCode, code)
      ? input.prerequisitePathsByCode[code]
      : [[]];
  }

  function pathPlacementOrdinal(path, completedCourseCodes, schedule) {
    let latest = -1;
    for (const prerequisite of path) {
      if (completedCourseCodes.has(prerequisite)) continue;
      const placement = schedule[prerequisite];
      if (!placement) return null;
      latest = Math.max(latest, placement.ordinal);
    }
    return latest;
  }

  function cyclicCourseCodes(codes, normalized) {
    const remaining = new Set(codes);
    const edges = new Map(codes.map((code) => [code, new Set()]));
    codes.forEach((code) => {
      prerequisitePathsFor(normalized, code).forEach((path) => {
        if (path.every((prerequisite) => remaining.has(prerequisite))) {
          path.forEach((prerequisite) => edges.get(code).add(prerequisite));
        }
      });
    });

    const indices = new Map();
    const lowLinks = new Map();
    const stack = [];
    const onStack = new Set();
    const cyclic = new Set();
    let index = 0;
    function visit(code) {
      indices.set(code, index);
      lowLinks.set(code, index);
      index += 1;
      stack.push(code);
      onStack.add(code);
      [...edges.get(code)].sort().forEach((next) => {
        if (!indices.has(next)) {
          visit(next);
          lowLinks.set(code, Math.min(lowLinks.get(code), lowLinks.get(next)));
        } else if (onStack.has(next)) {
          lowLinks.set(code, Math.min(lowLinks.get(code), indices.get(next)));
        }
      });
      if (lowLinks.get(code) !== indices.get(code)) return;
      const component = [];
      let next;
      do {
        next = stack.pop();
        onStack.delete(next);
        component.push(next);
      } while (next !== code);
      if (component.length > 1 || edges.get(code).has(code)) component.forEach((member) => cyclic.add(member));
    }
    codes.slice().sort().forEach((code) => { if (!indices.has(code)) visit(code); });
    return [...cyclic].sort();
  }

  function generatePlan(input = {}) {
    const normalized = normalizePlannerInput(input);
    const schedule = {};
    const termCredits = Object.fromEntries(normalized.terms.map((term) => [termKey(term), 0]));
    const issues = [];
    const termsByKey = new Map(normalized.terms.map((term) => [termKey(term), term]));

    Object.keys(normalized.lockedPlacements).sort().forEach((code) => {
      const locked = normalized.lockedPlacements[code];
      const term = locked.ordinal === null ? null : termsByKey.get(`${locked.year}:${locked.sem}`);
      if (!term) {
        issues.push(issue("invalid_locked_placement", "error", { courseCode: code }));
        return;
      }
      schedule[code] = { code, credits: locked.credits, year: term.year, sem: term.sem, ordinal: term.ordinal, locked: true };
      termCredits[termKey(term)] += locked.credits;
    });

    normalized.terms.forEach((term) => {
      if (termCredits[termKey(term)] > normalized.maxCredits) {
        issues.push(issue("locked_credit_cap_exceeded", "error", { term: termKey(term), maxCredits: normalized.maxCredits }));
      }
    });

    Object.keys(schedule).sort().forEach((code) => {
      const paths = prerequisitePathsFor(normalized, code);
      if (paths.length && !paths.some((path) => {
        const prerequisiteOrdinal = pathPlacementOrdinal(path, normalized.completedCourseCodes, schedule);
        return prerequisiteOrdinal !== null && prerequisiteOrdinal < schedule[code].ordinal;
      })) {
        issues.push(issue("locked_prerequisite_violation", "error", { courseCode: code }));
      }
    });

    const pending = new Map(normalized.courses
      .filter((course) => !normalized.completedCourseCodes.has(course.code) && !schedule[course.code])
      .map((course) => [course.code, course]));

    let placedInPass = true;
    while (pending.size && placedInPass) {
      placedInPass = false;
      [...pending.keys()].sort().forEach((code) => {
        if (!pending.has(code)) return;
        const course = pending.get(code);
        const choices = prerequisitePathsFor(normalized, code).flatMap((path) => {
          const prerequisiteOrdinal = pathPlacementOrdinal(path, normalized.completedCourseCodes, schedule);
          if (prerequisiteOrdinal === null) return [];
          return normalized.terms
            .filter((term) => term.ordinal > prerequisiteOrdinal && termCredits[termKey(term)] + course.credits <= normalized.maxCredits)
            .map((term) => ({ term, prerequisiteOrdinal }));
        });
        choices.sort((left, right) => left.term.ordinal - right.term.ordinal
          || termCredits[termKey(left.term)] - termCredits[termKey(right.term)]
          || code.localeCompare(code));
        const choice = choices[0];
        if (!choice) return;
        const term = choice.term;
        schedule[code] = { code, credits: course.credits, year: term.year, sem: term.sem, ordinal: term.ordinal, locked: false };
        termCredits[termKey(term)] += course.credits;
        pending.delete(code);
        placedInPass = true;
      });
    }

    const unplacedCourses = [...pending.keys()].sort();
    const cyclic = cyclicCourseCodes(unplacedCourses, normalized);
    if (cyclic.length) issues.push(issue("cyclic_prerequisite", "error", { courseCodes: cyclic }));
    if (unplacedCourses.length) issues.push(issue("courses_unplaced", "error", { courseCodes: unplacedCourses }));

    const placeholders = [];
    const unplacedRequirements = [];
    normalized.unresolvedRequirements.forEach((requirement) => {
      const candidates = normalized.terms
        .filter((term) => termCredits[termKey(term)] + requirement.credits <= normalized.maxCredits)
        .sort((left, right) => termCredits[termKey(left)] - termCredits[termKey(right)]
          || left.ordinal - right.ordinal || termKey(left).localeCompare(termKey(right)));
      const term = candidates[0];
      if (!term) {
        unplacedRequirements.push(requirement.id || requirement.label);
        return;
      }
      const placeholder = createPlaceholder(requirement, term.ordinal);
      placeholder.year = term.year;
      placeholder.sem = term.sem;
      placeholders.push(placeholder);
      termCredits[termKey(term)] += placeholder.estimatedCredits;
    });
    if (unplacedRequirements.length) issues.push(issue("requirements_unplaced", "error", { requirementIds: unplacedRequirements.sort() }));

    const resultSchedule = {};
    Object.keys(schedule).sort().forEach((code) => {
      const { ordinal, ...placement } = schedule[code];
      resultSchedule[code] = placement;
    });
    return {
      status: issues.some((entry) => entry.severity === "error") ? "partial" : "complete",
      schedule: resultSchedule,
      placeholders,
      issues,
      assumptions: [
        "Only supplied reviewed prerequisite paths are used for automatic placement.",
        `Automatic planning uses a ${normalized.maxCredits}-credit hard cap per term.`,
        `Automatic planning targets ${normalized.targetCredits} credits per term.`,
      ],
      termCredits,
    };
  }

  root.ScheduleRUFourYearPlanner = { generatePlan, normalizePlannerInput, createPlaceholder };
})(globalThis);
