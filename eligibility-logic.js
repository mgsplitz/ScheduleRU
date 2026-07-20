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
    evaluateEligibility,
  };
})(globalThis);
