import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { evaluateProgramSelection } from "../src/program-selection-policy.js";

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, "../fixtures/program-selection-comparison-cases.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

for (const comparisonCase of fixture.cases) {
  test(comparisonCase.id, () => {
    const result = evaluateProgramSelection({
      homeSchoolSlug: fixture.policy_snapshot.home_school_slug,
      selectedProgramIds: comparisonCase.selected_program_ids,
      programs: fixture.programs,
      limits: fixture.policy_snapshot.limits,
      combinationPolicies: fixture.policy_snapshot.combination_policies,
    });
    assert.equal(result.allowed, comparisonCase.expected.allowed);
    assert.deepEqual(result.errors.map((issue) => issue.code).sort(), [...comparisonCase.expected.error_codes].sort());
  });
}

test("unknown program ids are rejected instead of being silently dropped", () => {
  const result = evaluateProgramSelection({
    homeSchoolSlug: fixture.policy_snapshot.home_school_slug,
    selectedProgramIds: ["rbsnb-bait", "not-a-reviewed-program"],
    programs: fixture.programs,
    limits: fixture.policy_snapshot.limits,
    combinationPolicies: fixture.policy_snapshot.combination_policies,
  });
  assert.equal(result.allowed, false);
  assert.deepEqual(result.errors.map((issue) => issue.code), ["unknown_program"]);
});
