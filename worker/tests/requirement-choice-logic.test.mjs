import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../packages/planner/src/requirement-choice-logic.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);

function logic() {
  assert.ok(
    context.globalThis.ScheduleRURequirementChoiceLogic,
    "requirement-choice-logic.js must expose ScheduleRURequirementChoiceLogic",
  );
  return context.globalThis.ScheduleRURequirementChoiceLogic;
}
const plain = (value) => JSON.parse(JSON.stringify(value));

test("finite program electives with different prerequisite closures are sequence-critical", () => {
  const mode = logic().classifyRequirement(
    { sourceType: "program", rule: "min_courses" },
    [
      { code: "01:198:314", prerequisitePaths: [["01:198:211"]] },
      { code: "01:198:336", prerequisitePaths: [["01:198:112", "01:198:205"]] },
    ],
  );

  assert.equal(mode, "sequence_critical");
});

test("a deterministic reviewed option or one equivalence family is fixed", () => {
  assert.equal(logic().classifyRequirement(
    { sourceType: "program" },
    [{ code: "01:198:111", prerequisitePaths: [] }],
  ), "fixed");
  assert.equal(logic().classifyRequirement(
    { sourceType: "program" },
    [
      { code: "01:640:151", equivalenceKey: "calculus-1", prerequisitePaths: [] },
      { code: "01:640:135", equivalenceKey: "calculus-1", prerequisitePaths: [] },
    ],
  ), "fixed");
});

test("finite Core pools are guided-flexible and may be deferred", () => {
  const decisions = logic().planningDecisions({
    unresolvedRequirements: [{
      requirementGroupId: "core-ah",
      sourceType: "core",
      sourceProgram: "rutgers-nb-core",
      label: "Arts and Humanities [AH]",
      candidateSelectionContext: {
        rule: "min_courses",
        candidatePrerequisiteSummaries: [
          { code: "01:082:105", prerequisitePaths: [] },
          { code: "01:730:103", prerequisitePaths: [] },
        ],
      },
    }],
  });

  assert.equal(decisions[0].planningMode, "guided_flexible");
  assert.equal(decisions[0].canDefer, true);
});

test("an unreviewed open requirement is reserve-only", () => {
  assert.equal(logic().classifyRequirement(
    { sourceType: "program", rule: "min_courses" },
    [],
  ), "reserve_only");
});

test("planning decisions consolidate repeated slots and keep candidate prerequisite facts", () => {
  const placeholder = {
    requirementGroupId: "cs-electives",
    sourceType: "program",
    sourceProgram: "sasnb-computer-science-minor",
    label: "Six approved Computer Science courses",
    candidateSelectionContext: {
      rule: "min_courses",
      candidatePrerequisiteSummaries: [
        { code: "01:198:111", title: "Intro Computer Science", prerequisitePaths: [] },
        { code: "01:198:213", title: "Software Methodology", prerequisitePaths: [["01:198:112"]] },
      ],
    },
  };

  const decisions = logic().planningDecisions({
    unresolvedRequirements: [placeholder, { ...placeholder, id: "slot-2" }],
  });

  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].slotCount, 2);
  assert.equal(decisions[0].planningMode, "sequence_critical");
  assert.equal(decisions[0].canDefer, false);
  assert.deepEqual(plain(decisions[0].candidates.map((candidate) => candidate.code)), [
    "01:198:111",
    "01:198:213",
  ]);
});
