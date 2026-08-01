import assert from "node:assert/strict";
import test from "node:test";
import {
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";

test("the Philosophy minor snapshot preserves course and upper-level thresholds", () => {
  const id = "sasnb-philosophy-minor";
  const program = programDefinition(id);
  assert.equal(program.program.program_family_id, "sasnb-philosophy-730");
  const total = requirementGroup(id, `${id}-total`);
  const upper = requirementGroup(id, `${id}-upper-level`);
  assert.deepEqual([total.rule, total.count], ["min_courses", 6]);
  assert.deepEqual([upper.rule, upper.count], ["min_courses", 3]);
  assert.deepEqual(
    [
      total.selectors[0].selector.course_number_min,
      total.selectors[0].selector.course_number_max,
      total.selectors[0].selector.minimum_credits,
    ],
    [100, 499, 3],
  );
  assert.match(program.sources[0].url, /philosophy\.rutgers\.edu/);
});
