/**
 * Pure program-selection policy evaluator.
 *
 * This module intentionally knows nothing about RBS, SAS, Engineering, or a
 * particular catalog year. Those facts live in reviewed D1 policy rows. The
 * same evaluator is used by the public Worker endpoint and the anonymous
 * comparison fixtures, so policy behavior is not duplicated in the browser.
 */

const REJECTING_DECISIONS = new Set(["blocked", "requires_transfer"]);
const ELIGIBILITY_BLOCKING_DECISIONS = new Set(["blocked"]);
const ADVISORY_CONDITION_TYPES = new Set([
  "minimum_course_grade",
  "nb_residency_limit",
  "requires_school_approval",
  "transfer_limit",
]);
const ADVISORY_DECISIONS = new Set(["requires_approval", "information"]);

function nonEmptyText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueStrings(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((value) => nonEmptyText(value))
    .map((value) => value.trim()))];
}

function policySideMatches(program, policy, side) {
  const id = policy[`program_${side}_id`];
  const school = policy[`program_${side}_school_slug`];
  const type = policy[`program_${side}_type`];

  // A policy side must name at least one attribute. A fully blank side would
  // turn a typo in the policy table into a rule that matches every program.
  if (!nonEmptyText(id) && !nonEmptyText(school) && !nonEmptyText(type)) return false;
  if (nonEmptyText(id) && program.id !== id) return false;
  if (nonEmptyText(school) && program.school_slug !== school) return false;
  if (nonEmptyText(type) && program.type !== type) return false;
  return true;
}

function matchingPolicyPair(programs, policy) {
  const left = programs.filter((program) => policySideMatches(program, policy, "a"));
  const right = programs.filter((program) => policySideMatches(program, policy, "b"));
  const sameFamilyOnly = Number(policy?.same_program_family) === 1;
  return left.some((a) => right.some((b) => {
    if (a.id === b.id) return false;
    if (!sameFamilyOnly) return true;
    // A missing reviewed family must not silently bypass a school policy that
    // depends on the family. New reviewed SAS programs always provide one.
    if (!nonEmptyText(a.program_family_id) || !nonEmptyText(b.program_family_id)) return true;
    return a.program_family_id === b.program_family_id;
  }));
}

function policyMessage(policy) {
  return policy.note || "This combination requires a reviewed school policy.";
}

function parseConditionValue(rule) {
  try {
    const value = JSON.parse(rule?.condition_value_json || "null");
    return value === null ? {} : value;
  } catch {
    // An invalid reviewed JSON value must never quietly approve a selection.
    // Surface it to the user as an advising issue until the data row is fixed.
    return null;
  }
}

function stringList(value) {
  return Array.isArray(value) ? value.filter(nonEmptyText).map((item) => item.trim()) : [];
}

function nonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function pluralCredits(value) {
  return value === 1 ? "credit" : "credits";
}

export function hasUsableSourceUrl(value) {
  if (!nonEmptyText(value)) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function isAdvisoryEligibilityCondition(conditionType) {
  return ADVISORY_CONDITION_TYPES.has(conditionType);
}

export function isAdvisoryEligibilityDecision(decision) {
  return ADVISORY_DECISIONS.has(decision);
}

/**
 * Creates concise, action-oriented wording for policy facts that ScheduleRU
 * cannot evaluate from a planned-course selection. It deliberately returns
 * null for malformed values so callers can fail safely rather than inventing
 * a conclusion from incomplete reviewed data.
 */
export function advisoryMessageForEligibilityRule(rule) {
  if (!isAdvisoryEligibilityCondition(rule?.condition_type)) return null;
  const value = parseConditionValue(rule);
  if (value === null || Array.isArray(value) || typeof value !== "object") return null;

  switch (rule.condition_type) {
    case "minimum_course_grade": {
      const courseCode = nonEmptyText(value.course_code) ? value.course_code.trim() : null;
      const minimumGrade = nonEmptyText(value.minimum_grade) ? value.minimum_grade.trim() : null;
      return courseCode && minimumGrade
        ? `Confirm that you earned ${minimumGrade} or better in ${courseCode} before relying on this plan.`
        : null;
    }
    case "nb_residency_limit": {
      const maximum = nonNegativeNumber(value.maximum_outside_nb_credits);
      return maximum === null
        ? null
        : `Confirm that no more than ${maximum} ${pluralCredits(maximum)} for this program were completed outside Rutgers–New Brunswick before relying on this plan.`;
    }
    case "requires_school_approval": {
      const school = nonEmptyText(value.school) ? value.school.trim() : null;
      const action = nonEmptyText(value.action) ? value.action.trim() : null;
      return school && action
        ? `Ask ${school} for approval to ${action} before relying on this plan.`
        : null;
    }
    case "transfer_limit": {
      const maximum = nonNegativeNumber(value.maximum_transfer_credits);
      return maximum === null
        ? null
        : `Confirm that no more than ${maximum} transfer ${pluralCredits(maximum)} apply to this program before relying on this plan.`;
    }
    default:
      return null;
  }
}

export function publicEligibilityRule(rule) {
  const advisoryCondition = isAdvisoryEligibilityCondition(rule?.condition_type);
  const advisory = advisoryCondition
    && isAdvisoryEligibilityDecision(rule?.decision)
    && hasUsableSourceUrl(rule?.source_url);
  const advisoryMessage = advisory ? advisoryMessageForEligibilityRule(rule) : null;
  return {
    ...rule,
    advisory,
    advisory_message: advisoryMessage || (advisoryCondition
      ? "A reviewed program policy needs data correction before this planning notice can be shown."
      : null),
  };
}

function eligibilityFailure(rule, homeSchoolSlug, selectedProgramIds) {
  const value = parseConditionValue(rule);
  if (value === null) return { failed: true, dataError: true };
  const values = stringList(value);
  const selected = new Set(selectedProgramIds);
  switch (rule.condition_type) {
    case "home_school_must_be_one_of":
      return { failed: !values.includes(homeSchoolSlug) };
    case "home_school_must_not_be_one_of":
      return { failed: values.includes(homeSchoolSlug) };
    case "selected_program_must_include_one_of":
      return { failed: !values.some((id) => selected.has(id)) };
    case "selected_program_must_not_include_any":
      return { failed: values.some((id) => selected.has(id)) };
    // These conditions are material to formal declaration but cannot be
    // verified from a program selection alone. The caller should explain
    // them instead of pretending browser state proves eligibility.
    case "minimum_total_credits":
    case "minimum_gpa":
    case "course_completion_or_placement":
    case "application_required":
    case "advisor_confirmation":
      return { failed: true, needsAdvising: true };
    case "minimum_course_grade":
    case "nb_residency_limit":
    case "requires_school_approval":
    case "transfer_limit":
      return advisoryMessageForEligibilityRule(rule)
        ? { failed: true, needsAdvising: true, advisory: true }
        : { failed: true, dataError: true };
    default:
      return { failed: true, dataError: true };
  }
}

function eligibilityMessage(rule, failure) {
  if (failure.advisoryDataError) return "A reviewed advisory policy needs data correction before this selection can be confirmed.";
  if (failure.dataError) return "A reviewed program eligibility rule needs data correction before this selection can be confirmed.";
  if (failure.advisory) return advisoryMessageForEligibilityRule(rule);
  return rule.note || "This program has a formal eligibility condition to confirm with advising.";
}

/**
 * Evaluate a proposed list of program ids against reviewed policy rows.
 *
 * `programs` may be a D1 result set or a small fixture list. Unknown ids are
 * always rejected rather than silently discarded, because silently changing a
 * student's saved plan would be confusing and unsafe.
 */
export function evaluateProgramSelection({
  homeSchoolSlug,
  selectedProgramIds,
  programs,
  limits,
  combinationPolicies,
  eligibilityRules,
}) {
  const ids = uniqueStrings(selectedProgramIds);
  const allPrograms = Array.isArray(programs) ? programs : [];
  const byId = new Map(allPrograms.map((program) => [program.id, program]));
  const selected = ids.map((id) => byId.get(id)).filter(Boolean);
  const errors = [];
  const warnings = [];

  if (!ids.length) {
    errors.push({
      code: "empty_selection",
      kind: "selection",
      message: "Choose at least one reviewed program.",
    });
  }

  const unknownIds = ids.filter((id) => !byId.has(id));
  if (unknownIds.length) {
    errors.push({
      code: "unknown_program",
      kind: "selection",
      program_ids: unknownIds,
      message: "One or more selected programs are not currently reviewed and available.",
    });
  }

  const matchingLimits = (Array.isArray(limits) ? limits : [])
    .filter((limit) => limit.home_school_slug === homeSchoolSlug);
  for (const limit of matchingLimits) {
    const selectedCount = selected.filter((program) => program.type === limit.program_type).length;
    const maxSelected = Number(limit.max_selected);
    if (Number.isFinite(maxSelected) && selectedCount > maxSelected) {
      errors.push({
        code: `limit:${homeSchoolSlug}:${limit.program_type}`,
        kind: "limit",
        program_type: limit.program_type,
        selected_count: selectedCount,
        max_selected: maxSelected,
        note: limit.note || null,
        source_url: limit.source_url || null,
        message: `This school allows up to ${maxSelected} ${limit.program_type}${maxSelected === 1 ? "" : "s"}.`,
      });
    }
  }

  const matchingCombinations = (Array.isArray(combinationPolicies) ? combinationPolicies : [])
    .filter((policy) => policy.home_school_slug === homeSchoolSlug)
    .filter((policy) => matchingPolicyPair(selected, policy));
  for (const policy of matchingCombinations) {
    const issue = {
      code: `combination:${policy.policy_key}`,
      kind: "combination",
      decision: policy.decision,
      note: policy.note || null,
      source_url: policy.source_url || null,
      message: policyMessage(policy),
    };
    if (REJECTING_DECISIONS.has(policy.decision)) errors.push(issue);
    else if (policy.decision === "requires_approval") warnings.push(issue);
  }

  const selectedIds = selected.map((program) => program.id);
  const matchingEligibilityRules = (Array.isArray(eligibilityRules) ? eligibilityRules : [])
    .filter((rule) => selectedIds.includes(rule.program_id));
  for (const rule of matchingEligibilityRules) {
    const failure = eligibilityFailure(rule, homeSchoolSlug, selectedIds);
    if (!failure.failed) continue;
    // Advisory conditions are not determinate from a course plan. A reviewed
    // row that marks one as blocking is a data/configuration error, not proof
    // that the student failed the policy.
    const advisoryDataError = failure.advisory && (
      !isAdvisoryEligibilityDecision(rule.decision) || !hasUsableSourceUrl(rule.source_url)
    );
    const issueFailure = advisoryDataError ? { ...failure, dataError: true, advisoryDataError } : failure;
    const issue = {
      code: `eligibility:${rule.rule_key}`,
      kind: "eligibility",
      decision: rule.decision,
      program_id: rule.program_id,
      condition_type: rule.condition_type,
      note: rule.note || null,
      source_url: rule.source_url || null,
      advisory: Boolean(issueFailure.advisory && !issueFailure.dataError),
      message: eligibilityMessage(rule, issueFailure),
    };
    if (ELIGIBILITY_BLOCKING_DECISIONS.has(rule.decision) || issueFailure.dataError) errors.push(issue);
    else warnings.push(issue);
  }

  return {
    allowed: errors.length === 0,
    selected_program_ids: ids,
    errors,
    warnings,
    limits: matchingLimits,
    combination_policies: matchingCombinations,
    eligibility_rules: matchingEligibilityRules,
  };
}
