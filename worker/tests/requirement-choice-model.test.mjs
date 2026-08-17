import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/requirement-choice-model.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);

const model = () => {
  assert.ok(
    context.globalThis.ScheduleRURequirementChoiceModel,
    "requirement-choice-model.js must expose ScheduleRURequirementChoiceModel",
  );
  return context.globalThis.ScheduleRURequirementChoiceModel;
};
const plain = (value) => JSON.parse(JSON.stringify(value));

test("a planner placeholder becomes a small persistent requirement-choice intent", () => {
  const intent = model().createIntent({
    placeholder: {
      id: "choice:core:wcr:0",
      label: "Revision-Based Writing [WCr]",
      sourceType: "core",
      sourceProgram: "rutgers-nb-core",
      requirementGroupId: "core-wcr",
      year: 2,
      sem: "fall",
      candidateSelectionContext: {
        memberCourseCodes: ["01:355:201"],
        courseSelectors: [{ version: 1, kind: "subject_level", school_codes: ["01"], subject_codes: ["355"], course_number_min: 200, course_number_max: 499 }],
      },
    },
    group: { id: "core-wcr", name: "Revision-Based Writing [WCr]" },
    returnPage: "nav",
  });

  assert.deepEqual(plain(intent), {
    version: 1,
    placeholderId: "choice:core:wcr:0",
    requirementGroupId: "core-wcr",
    sourceType: "core",
    sourceProgram: "rutgers-nb-core",
    label: "Revision-Based Writing [WCr]",
    memberCourseCodes: ["01:355:201"],
    selectors: [{ version: 1, kind: "subject_level", school_codes: ["01"], subject_codes: ["355"], course_number_min: 200, course_number_max: 499 }],
    returnPage: "nav",
    returnPlacement: { year: 2, sem: "fall" },
  });
});

test("only a reviewed member or selector match can resolve an intent", () => {
  const intent = {
    memberCourseCodes: ["01:355:201"],
    selectors: [{ version: 1, kind: "subject_level" }],
  };
  const selectorLogic = {
    matchesAnySelector: (course) => course.code === "01:355:302",
  };

  assert.equal(model().courseMatchesIntent({ code: "01:355:201" }, intent, selectorLogic), true);
  assert.equal(model().courseMatchesIntent({ code: "01:355:302" }, intent, selectorLogic), true);
  assert.equal(model().courseMatchesIntent({ code: "01:198:111" }, intent, selectorLogic), false);
});

test("committing a choice updates only its requirement and leaves caller state immutable", () => {
  const selections = { other: ["course-a"], "core-wcr": ["old-choice"] };
  const result = model().commitChoice({
    intent: {
      placeholderId: "choice:core:wcr:0",
      requirementGroupId: "core-wcr",
      returnPage: "nav",
      returnPlacement: { year: 2, sem: "fall" },
    },
    courseId: "course-b",
    groupSelections: selections,
  });

  assert.deepEqual(plain(result), {
    groupSelections: { other: ["course-a"], "core-wcr": ["old-choice", "course-b"] },
    resolvedPlaceholderId: "choice:core:wcr:0",
    returnPage: "nav",
    returnPlacement: { year: 2, sem: "fall" },
  });
  assert.deepEqual(selections, { other: ["course-a"], "core-wcr": ["old-choice"] });
});
