import { readFileSync } from "node:fs";

const snapshot = JSON.parse(
  readFileSync(
    new URL(
      "../../../reference-data/snapshots/reviewed-reference-data.v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

export function referenceDataSnapshot() {
  return snapshot;
}

export function programCombinationPolicy(policyKey) {
  const policy = snapshot.program_combination_policies.find(
    ({ policy_key }) => policy_key === policyKey,
  );
  if (!policy) throw new TypeError(`missing program combination policy: ${policyKey}`);
  return policy;
}

export function requirementCourseEquivalencies() {
  return snapshot.requirement_course_equivalencies;
}
