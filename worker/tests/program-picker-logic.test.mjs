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
