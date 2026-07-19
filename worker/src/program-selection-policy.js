/**
 * Pure program-selection policy evaluator.
 *
 * This module intentionally knows nothing about RBS, SAS, Engineering, or a
 * particular catalog year. Those facts live in reviewed D1 policy rows. The
 * same evaluator is used by the public Worker endpoint and the anonymous
 * comparison fixtures, so policy behavior is not duplicated in the browser.
 */

const REJECTING_DECISIONS = new Set(["blocked", "requires_transfer"]);

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
  return left.some((a) => right.some((b) => a.id !== b.id));
}

function policyMessage(policy) {
  return policy.note || "This combination requires a reviewed school policy.";
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

  return {
    allowed: errors.length === 0,
    selected_program_ids: ids,
    errors,
    warnings,
    limits: matchingLimits,
    combination_policies: matchingCombinations,
  };
}
