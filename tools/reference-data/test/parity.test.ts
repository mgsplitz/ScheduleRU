import assert from "node:assert/strict";
import test from "node:test";

import {
  compareReferenceDataCaptures,
  type ReferenceDataApiCapture,
} from "../src/parity.ts";

function capture(id: number): ReferenceDataApiCapture {
  return {
    schools: { schools: [] },
    programs: { programs: [] },
    core_curricula: { curricula: [] },
    selection_policies: {},
    individual_requirements: {},
    batch_requirements: [{
      double_count_exceptions: [{
        id,
        program_a: "example-major",
        program_b: "example-minor",
        allowed_course_codes_json: "[\"01:999:301\"]",
      }],
    }],
  };
}

test("ignores only the internal overlap-exception row id", async () => {
  const report = await compareReferenceDataCaptures(
    capture(1),
    capture(99),
    1,
  );
  assert.equal(report.ok, true);
  const changed = capture(99);
  const batch = changed.batch_requirements[0] as {
    double_count_exceptions: Array<Record<string, unknown>>;
  };
  batch.double_count_exceptions[0]!.allowed_course_codes_json = "[]";
  const failed = await compareReferenceDataCaptures(capture(1), changed, 1);
  assert.equal(failed.ok, false);
  assert.ok(failed.differences.length > 0);
});
