/*
 * Pure term-aware eligibility logic shared by the planner and Node tests.
 * It deliberately depends on neither the DOM nor Worker state, so every
 * placement decision has a small, repeatable input and result.
 */
(function exposeEligibilityLogic(root) {
  const COURSE_CODE = /^\d{2}:\d{3}:\d{3}$/;
  const SOURCES = new Set(["ap", "transfer", "rutgers_completed", "manual_reviewed"]);
  const TYPES = new Set(["prerequisite_course", "corequisite_course", "minimum_prior_credits", "minimum_plan_year"]);

  function termOrdinal(term) {
    const year = Number(term?.year);
    const sem = String(term?.sem || "").toLowerCase();
    if (!Number.isInteger(year) || year < 1 || (sem !== "fall" && sem !== "spring")) return null;
    return (year - 1) * 2 + (sem === "fall" ? 0 : 1);
  }

  function normalizeReview(value) {
    if (!value || value.review_status !== "reviewed" || !COURSE_CODE.test(String(value.course_code || ""))) return null;
    return {
      course_code: String(value.course_code),
      review_status: "reviewed",
      no_known_conditions: Number(value.no_known_conditions) === 1,
    };
  }

  function normalizeCondition(value) {
    if (!value || value.review_status !== "reviewed" || !TYPES.has(value.condition_type)) return null;
    let data;
    try {
      data = typeof value.condition_value_json === "string"
        ? JSON.parse(value.condition_value_json)
        : value.condition_value_json;
    } catch {
      return null;
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    if (value.condition_type === "minimum_prior_credits") {
      const minimum = Number(data.minimum_credits);
      return Number.isFinite(minimum) && minimum >= 0
        ? { type: value.condition_type, minimum_credits: minimum }
        : null;
    }
    if (value.condition_type === "minimum_plan_year") {
      const minimum = Number(data.minimum_year);
      return Number.isInteger(minimum) && minimum >= 1 && minimum <= 8
        ? { type: value.condition_type, minimum_year: minimum }
        : null;
    }
    const codes = [...new Set((Array.isArray(data.any_of_course_codes) ? data.any_of_course_codes : [])
      .map((code) => String(code))
      .filter((code) => COURSE_CODE.test(code)))];
    return codes.length ? { type: value.condition_type, any_of_course_codes: codes } : null;
  }

  function confirmedCreditEntries(entries) {
    const seen = new Set();
    return (Array.isArray(entries) ? entries : []).filter((entry) => {
      const id = String(entry?.id || "");
      const credits = Number(entry?.credits);
      if (!id || seen.has(id) || !SOURCES.has(entry?.source) || !Number.isFinite(credits) || credits < 0) return false;
      seen.add(id);
      return true;
    }).map((entry) => ({
      ...entry,
      credits: Number(entry.credits),
      course_code: String(entry.course_code || ""),
    }));
  }

  function plannedCreditEntriesBefore(targetTerm, entries) {
    const target = termOrdinal(targetTerm);
    if (target === null) return [];
    return (Array.isArray(entries) ? entries : []).filter((entry) => {
      const ordinal = termOrdinal(entry);
      return ordinal !== null && ordinal < target;
    });
  }

  function normalizedCatalogText(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();
  }

  function catalogCourseReferences(rawText) {
    const text = normalizedCatalogText(rawText);
    const matches = [...text.matchAll(/\b\d{2}:\d{3}:\d{3}\b/g)];
    const references = new Map();
    for (let index = 0; index < matches.length; index++) {
      const match = matches[index];
      const code = match[0];
      const nextIndex = matches[index + 1]?.index ?? text.length;
      let title = text.slice(match.index + code.length, nextIndex)
        .split(")")[0]
        .replace(/^\s*[-–—:]?\s*/, "")
        .replace(/\s+(?:and|or)\s*$/i, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!title || /^(?:and|or)$/i.test(title)) title = "";
      if (!references.has(code)) references.set(code, { course_code: code, title });
    }
    return [...references.values()];
  }

  function prerequisiteExpressionTokens(text) {
    return [...normalizedCatalogText(text).matchAll(/\b\d{2}:\d{3}:\d{3}\b|\(|\)|\b(?:and|or)\b/gi)]
      .map((match) => {
        const value = match[0];
        if (COURSE_CODE.test(value)) return { type: "course", value };
        if (value === "(" || value === ")") return { type: value, value };
        return { type: value.toLowerCase(), value: value.toLowerCase() };
      });
  }

  function deduplicatePaths(paths) {
    const seen = new Set();
    return paths.map((path) => [...new Set(path)]).filter((path) => {
      const key = path.join(",");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function combinePaths(left, right) {
    if (left.length * right.length > 64) throw new Error("too many prerequisite alternatives");
    return left.flatMap((leftPath) => right.map((rightPath) => [...new Set(leftPath.concat(rightPath))]));
  }

  function parseCatalogPrerequisitePaths(rawText) {
    const text = normalizedCatalogText(rawText);
    const references = catalogCourseReferences(text);
    if (!references.length) return { reviewable: false, paths: [], references };

    // These catalog phrases need academic interpretation (for example,
    // placement-level equivalencies) and must never be converted into a
    // falsely strict requirement by the planner.
    if (/\b(?:equal\s+or\s+greater|permission|consent|placement|major|minor|standing|gpa|grade|credits?|co-?requisite)\b/i.test(text)) {
      return { reviewable: false, paths: [], references };
    }

    const tokens = prerequisiteExpressionTokens(text);
    let position = 0;
    const peek = () => tokens[position];
    const take = (type) => {
      if (peek()?.type !== type) throw new Error("unexpected prerequisite expression");
      return tokens[position++];
    };
    const primary = () => {
      if (peek()?.type === "course") return [[take("course").value]];
      take("(");
      const value = disjunction();
      take(")");
      return value;
    };
    const conjunction = () => {
      let value = primary();
      while (peek()?.type === "and") {
        take("and");
        value = combinePaths(value, primary());
      }
      return value;
    };
    const disjunction = () => {
      let value = conjunction();
      while (peek()?.type === "or") {
        take("or");
        value = value.concat(conjunction());
      }
      return value;
    };

    try {
      const paths = disjunction();
      if (position !== tokens.length || !paths.length) throw new Error("incomplete prerequisite expression");
      return { reviewable: true, paths: deduplicatePaths(paths), references };
    } catch (_) {
      return { reviewable: false, paths: [], references };
    }
  }

  function normalizePrerequisitePaths(paths) {
    return deduplicatePaths((Array.isArray(paths) ? paths : [])
      .filter(Array.isArray)
      .map((path) => [...new Set(path.map((code) => String(code)).filter((code) => COURSE_CODE.test(code)))])
      .filter((path) => path.length));
  }

  function prerequisitePathsFromConditions(conditions) {
    const prerequisiteGroups = (Array.isArray(conditions) ? conditions : [])
      .map(normalizeCondition)
      .filter((condition) => condition?.type === "prerequisite_course")
      .map((condition) => condition.any_of_course_codes);
    if (!prerequisiteGroups.length) return [];
    try {
      return normalizePrerequisitePaths(prerequisiteGroups.reduce(
        (paths, choices) => combinePaths(paths, choices.map((choice) => [choice])),
        [[]]
      ));
    } catch (_) {
      return [];
    }
  }

  function evaluatePrerequisitePaths(input = {}) {
    const target = termOrdinal(input.targetTerm);
    const paths = normalizePrerequisitePaths(input.paths);
    if (target === null || !paths.length) {
      return { status: "needs_review", paths: [], recommendedPath: null };
    }

    const confirmed = new Set((Array.isArray(input.confirmedCourseCodes) ? input.confirmedCourseCodes : [])
      .map((code) => String(code))
      .filter((code) => COURSE_CODE.test(code)));
    const scheduled = (Array.isArray(input.scheduledEntries) ? input.scheduledEntries : [])
      .map((entry) => ({ course_code: String(entry?.course_code || ""), ordinal: termOrdinal(entry) }))
      .filter((entry) => COURSE_CODE.test(entry.course_code) && entry.ordinal !== null);

    const evaluatedPaths = paths.map((required) => {
      const courseStates = required.map((course_code) => {
        if (confirmed.has(course_code)) return { course_code, state: "completed" };
        const ordinals = scheduled.filter((entry) => entry.course_code === course_code).map((entry) => entry.ordinal);
        if (ordinals.some((ordinal) => ordinal < target)) return { course_code, state: "planned_earlier" };
        if (ordinals.some((ordinal) => ordinal === target)) return { course_code, state: "same_term" };
        if (ordinals.some((ordinal) => ordinal > target)) return { course_code, state: "later_term" };
        return { course_code, state: "missing" };
      });
      const missing = courseStates.filter((course) => !["completed", "planned_earlier"].includes(course.state))
        .map((course) => ({ ...course, reason: course.state }));
      return { required, courseStates, missing };
    });
    const eligible = evaluatedPaths.find((path) => !path.missing.length);
    if (eligible) {
      const usesPlanned = eligible.courseStates.some((course) => course.state === "planned_earlier");
      return {
        status: usesPlanned ? "planned_assumption" : "eligible_now",
        paths: evaluatedPaths,
        recommendedPath: eligible,
      };
    }
    const recommendedPath = [...evaluatedPaths].sort((left, right) => left.missing.length - right.missing.length)[0] || null;
    return { status: "blocked", paths: evaluatedPaths, recommendedPath };
  }

  function needsReview() {
    return {
      status: "needs_review",
      satisfied: [],
      missing: [],
      assumptions: [],
      creditTotals: { confirmed: 0, planned: 0 },
    };
  }

  function evaluateEligibility(input = {}) {
    const review = normalizeReview(input.review);
    const target = termOrdinal(input.targetTerm);
    const conditions = (Array.isArray(input.conditions) ? input.conditions : []).map(normalizeCondition);
    if (!review || target === null || conditions.some((condition) => !condition)) return needsReview();
    if ((review.no_known_conditions && conditions.length) || (!review.no_known_conditions && !conditions.length)) return needsReview();

    const confirmed = confirmedCreditEntries(input.confirmedEntries);
    const planned = input.mode === "plan"
      ? plannedCreditEntriesBefore(input.targetTerm, input.scheduledEntries)
      : [];
    const evidence = confirmed.concat(planned);
    const confirmedCredits = confirmed.reduce((total, entry) => total + entry.credits, 0);
    const plannedCredits = planned.reduce((total, entry) => total + Number(entry.credits || 0), 0);
    const satisfied = [];
    const missing = [];
    const assumptions = [];

    for (const condition of conditions) {
      if (condition.type === "minimum_prior_credits") {
        const available = confirmedCredits + plannedCredits;
        if (available < condition.minimum_credits) {
          missing.push({ type: condition.type, minimum_credits: condition.minimum_credits, available_credits: available });
        } else {
          satisfied.push(condition);
          if (confirmedCredits < condition.minimum_credits) assumptions.push(condition);
        }
      } else if (condition.type === "minimum_plan_year") {
        if (input.targetTerm.year < condition.minimum_year) missing.push(condition);
        else satisfied.push(condition);
      } else if (condition.type === "corequisite_course") {
        const sameTerm = (Array.isArray(input.scheduledEntries) ? input.scheduledEntries : [])
          .filter((entry) => termOrdinal(entry) === target);
        const match = evidence.concat(sameTerm)
          .find((entry) => condition.any_of_course_codes.includes(entry.course_code));
        if (!match) missing.push(condition);
        else satisfied.push(condition);
      } else {
        const match = evidence.find((entry) => condition.any_of_course_codes.includes(entry.course_code));
        if (!match) missing.push(condition);
        else {
          satisfied.push(condition);
          if (planned.includes(match)) assumptions.push(condition);
        }
      }
    }

    return {
      status: missing.length ? "blocked" : assumptions.length ? "planned_assumption" : "eligible_now",
      satisfied,
      missing,
      assumptions,
      creditTotals: { confirmed: confirmedCredits, planned: plannedCredits },
    };
  }

  root.ScheduleRUEligibilityLogic = {
    termOrdinal,
    normalizeReview,
    normalizeCondition,
    confirmedCreditEntries,
    plannedCreditEntriesBefore,
    catalogCourseReferences,
    parseCatalogPrerequisitePaths,
    prerequisitePathsFromConditions,
    evaluatePrerequisitePaths,
    evaluateEligibility,
  };
})(globalThis);
