import assert from "node:assert/strict";
import test from "node:test";

await import("../../program-picker-logic.js");

const logic = globalThis.ScheduleRUProgramPickerLogic;
const programs = [
  { id: "rbsnb-bait", type: "major", requirements_available: true },
  { id: "rbsnb-finance", type: "major", requirements_available: true },
  { id: "sasnb-philosophy-minor", type: "minor", requirements_available: true },
];

test("a new incomplete onboarding does not silently select the school default", () => {
  assert.deepEqual(logic.initialProgramIds({
    restoredIds: [],
    programs,
    onboardingCompleted: false,
    selectionConfirmed: false,
    defaultProgramId: "rbsnb-bait",
  }), []);
  assert.deepEqual(logic.initialProgramIds({
    restoredIds: ["rbsnb-bait"],
    programs,
    onboardingCompleted: false,
    selectionConfirmed: false,
    defaultProgramId: "rbsnb-bait",
  }), []);
});

test("confirmed and completed selections survive reload while legacy completed setups retain a fallback", () => {
  assert.deepEqual(logic.initialProgramIds({
    restoredIds: ["rbsnb-finance"],
    programs,
    onboardingCompleted: false,
    selectionConfirmed: true,
    defaultProgramId: "rbsnb-bait",
  }), ["rbsnb-finance"]);
  assert.deepEqual(logic.initialProgramIds({
    restoredIds: [],
    programs,
    onboardingCompleted: true,
    selectionConfirmed: false,
    defaultProgramId: "rbsnb-bait",
  }), ["rbsnb-bait"]);
});

test("program role controls always derive from the latest draft", () => {
  assert.deepEqual(logic.programDraftView({
    draftIds: ["rbsnb-bait", "rbsnb-finance", "sasnb-philosophy-minor"],
    primaryId: "rbsnb-bait",
    programs,
  }), {
    selectedIds: ["rbsnb-bait", "rbsnb-finance", "sasnb-philosophy-minor"],
    majorIds: ["rbsnb-bait", "rbsnb-finance"],
    primaryId: "rbsnb-bait",
    secondaryId: "rbsnb-finance",
  });
  assert.equal(logic.programDraftView({
    draftIds: ["rbsnb-finance"],
    primaryId: "rbsnb-bait",
    programs,
  }).primaryId, "rbsnb-finance");
});

test("reviewed home-school eligibility rules filter only blocked program combinations", () => {
  const rows = [
    { id: "rbs-major", type: "major", eligibility_rules: [] },
    {
      id: "sas-only",
      type: "minor",
      eligibility_rules: [{
        decision: "blocked",
        condition_type: "home_school_must_be_one_of",
        condition_value_json: JSON.stringify(["sasnb"]),
      }],
    },
    {
      id: "not-rbs",
      type: "certificate",
      eligibility_rules: [{
        decision: "blocked",
        condition_type: "home_school_must_not_be_one_of",
        condition_value_json: JSON.stringify(["rbsnb"]),
      }],
    },
    { id: "unsupported", type: "graduate_program", eligibility_rules: [] },
  ];

  assert.deepEqual(
    logic.availableProgramsForSchool(rows, "rbsnb").map((program) => program.id),
    ["rbs-major"],
  );
  assert.deepEqual(
    logic.availableProgramsForSchool(rows, "sasnb").map((program) => program.id),
    ["rbs-major", "sas-only", "not-rbs"],
  );
  assert.deepEqual(logic.eligibilityRuleValues({ condition_value_json: "invalid" }), []);
});

test("accepted program roles follow selected major order and fall back to any selected program tab", () => {
  assert.deepEqual(logic.programRoles(
    ["minor", "finance", "bait"],
    [
      { id: "bait", type: "major" },
      { id: "finance", type: "major" },
      { id: "minor", type: "minor" },
    ],
  ), {
    primaryProgramId: "finance",
    secondaryProgramId: "bait",
    requiredProgramTab: "finance",
  });
  assert.deepEqual(logic.programRoles(["minor"], [{ id: "minor", type: "minor" }]), {
    primaryProgramId: null,
    secondaryProgramId: null,
    requiredProgramTab: "minor",
  });
});
