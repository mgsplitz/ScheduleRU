import assert from "node:assert/strict";
import test from "node:test";

await import("../../planner-ui-logic.js");

const logic = globalThis.ScheduleRUPlannerUI;

test("requirement selection and Wishlist expose independent row actions", () => {
  assert.deepEqual(logic.pickerActions({
    alreadyApplied: false,
    selected: false,
    canSelect: true,
    inWishlist: false,
  }), {
    requirementLabel: "Use for requirement",
    requirementDisabled: false,
    wishlistLabel: "Add to Wishlist",
    wishlistSelected: false,
  });

  assert.deepEqual(logic.pickerActions({
    alreadyApplied: false,
    selected: true,
    canSelect: false,
    inWishlist: true,
  }), {
    requirementLabel: "Remove",
    requirementDisabled: false,
    wishlistLabel: "Remove from Wishlist",
    wishlistSelected: true,
  });
});

test("placeholder destinations use finite pickers before selector browsers", () => {
  assert.equal(logic.placeholderDestination({
    group: { members: ["a", "b"], courseSelectors: [{ selector_key: "ignored" }] },
  }), "requirement_picker");
  assert.equal(logic.placeholderDestination({
    group: { members: [], courseSelectors: [{ selector_key: "subject" }] },
  }), "selector_browser");
  assert.equal(logic.placeholderDestination({
    group: { members: [], courseSelectors: [] },
  }), "requirement_panel");
});

test("every course resolves to an honest path presentation state", () => {
  assert.equal(logic.coursePathState({
    plan: { paths: [["01:198:111"]], references: [] },
  }).kind, "paths");
  assert.equal(logic.coursePathState({
    plan: { paths: [], references: [{ course_code: "01:198:111" }] },
  }).kind, "references");
  assert.deepEqual(logic.coursePathState({
    plan: { paths: [], references: [] },
    verifiedNoPrerequisites: true,
    catalogRecordAvailable: false,
    catalogPrerequisites: "",
  }), {
    kind: "none",
    message: "No reviewed prerequisite is recorded for this course.",
  });
  assert.deepEqual(logic.coursePathState({
    plan: { paths: [], references: [] },
    catalogRecordAvailable: true,
    catalogPrerequisites: "",
  }), {
    kind: "none",
    message: "No prerequisite is listed in the current Rutgers catalog record.",
  });
  assert.deepEqual(logic.coursePathState({
    plan: { paths: [], references: [] },
    catalogRecordAvailable: false,
    catalogPrerequisites: "",
  }), {
    kind: "unreviewed",
    message: "A machine-readable prerequisite path is not available yet. Verify the official catalog before registration.",
  });
});

test("plan generation preflight requires acknowledgement only for incomplete Core choices", () => {
  assert.equal(logic.generationPreflight({ busy: true, coreIncomplete: true }), "ignore");
  assert.equal(logic.generationPreflight({ busy: false, coreIncomplete: true }), "warn");
  assert.equal(logic.generationPreflight({ busy: false, coreIncomplete: false }), "confirm");
});

test("only Core families shared by multiple selected majors auto-collapse", () => {
  assert.equal(logic.shouldAutoCollapseSharedGroup({
    group: {
      name: "Business Core",
      display_family: "rbsnb-business-core",
      sourceProgramIds: ["bait", "finance"],
    },
    selectedMajorIds: ["bait", "finance"],
  }), true);
  assert.equal(logic.shouldAutoCollapseSharedGroup({
    group: {
      name: "Business Core",
      display_family: "rbsnb-business-core",
      sourceProgramIds: ["finance"],
    },
    selectedMajorIds: ["bait", "finance"],
  }), false);
  assert.equal(logic.shouldAutoCollapseSharedGroup({
    group: {
      name: "Shared electives",
      sourceProgramIds: ["bait", "finance"],
    },
    selectedMajorIds: ["bait", "finance"],
  }), false);
});
