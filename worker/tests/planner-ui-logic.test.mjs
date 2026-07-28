import assert from "node:assert/strict";
import test from "node:test";

await import("../../planner-ui-logic.js");

const logic = globalThis.ScheduleRUPlannerUI;

test("requirement rows expose one context-sensitive action", () => {
  assert.deepEqual(logic.pickerActions({
    alreadyApplied: false,
    selected: false,
    canSelect: true,
    inWishlist: false,
  }), {
    label: "Use for requirement",
    disabled: false,
    intent: "requirement",
    selected: false,
  });

  assert.deepEqual(logic.pickerActions({
    alreadyApplied: false,
    selected: true,
    canSelect: false,
    inWishlist: true,
  }), {
    label: "Remove",
    disabled: false,
    intent: "requirement",
    selected: true,
  });

  assert.deepEqual(logic.pickerActions({
    alreadyApplied: false,
    selected: false,
    canSelect: false,
    inWishlist: false,
  }), {
    label: "Add to Wishlist",
    disabled: false,
    intent: "wishlist",
    selected: false,
  });

  assert.deepEqual(logic.pickerActions({
    alreadyApplied: false,
    selected: false,
    canSelect: false,
    inWishlist: true,
  }), {
    label: "Remove from Wishlist",
    disabled: false,
    intent: "wishlist",
    selected: true,
  });
});

test("catalog wishlist controls remain enabled and toggle in place", () => {
  assert.deepEqual(logic.catalogWishlistAction({ inWishlist: false }), {
    label: "+ Wishlist",
    remove: false,
    disabled: false,
  });
  assert.deepEqual(logic.catalogWishlistAction({ inWishlist: true }), {
    label: "Remove",
    remove: true,
    disabled: false,
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
  assert.equal(logic.placeholderDestination({
    group: null,
    candidateSelectionContext: { memberCourseCodes: ["01:750:203"], courseSelectors: [] },
  }), "requirement_picker");
  assert.equal(logic.placeholderDestination({
    group: null,
    candidateSelectionContext: { members: [], memberCourseCodes: [], courseSelectors: [{ selector_key: "subject" }] },
  }), "selector_browser");
});

test("program browsing starts with schools and filters programs only after a school is chosen", () => {
  const schools = [
    { slug: "sasnb", name: "School of Arts and Sciences" },
    { slug: "rbsnb", name: "Rutgers Business School" },
    { slug: "other", name: "Unsupported School" },
  ];
  const programs = [
    { id: "math", name: "Mathematics", school_slug: "sasnb", type: "major" },
    { id: "finance", name: "Finance", school_slug: "rbsnb", type: "major" },
  ];
  assert.deepEqual(logic.programSchoolChoices({ schools, programs }), [
    { slug: "sasnb", label: "School of Arts and Sciences" },
    { slug: "rbsnb", label: "Rutgers Business School" },
  ]);
  assert.deepEqual(logic.programsForBrowse({ programs, schoolSlug: "" }), []);
  assert.deepEqual(logic.programsForBrowse({ programs, schoolSlug: "rbsnb" }).map((program) => program.id), ["finance"]);
});

test("the real-schedule builder is available only for the active registration term", () => {
  assert.equal(logic.canOpenSemesterBuilder({
    displayedYear: 2, activeYear: 2, semester: "fall", activeSemester: "fall",
  }), true);
  assert.equal(logic.canOpenSemesterBuilder({
    displayedYear: 2, activeYear: 2, semester: "spring", activeSemester: "fall",
  }), false);
  assert.equal(logic.canOpenSemesterBuilder({
    displayedYear: 1, activeYear: 2, semester: "fall", activeSemester: "fall",
  }), false);
});

test("the active planner term follows the student's saved position instead of a stale calendar anchor", () => {
  const activeTerm = logic.activePlannerTerm({
    academicPosition: { year: 1 },
    activeSemester: "fall",
  });
  assert.deepEqual(activeTerm, { year: 1, semester: "fall" });
  assert.equal(logic.canOpenSemesterBuilder({
    displayedYear: 1,
    activeYear: activeTerm.year,
    semester: "fall",
    activeSemester: activeTerm.semester,
  }), true);
  assert.equal(logic.canOpenSemesterBuilder({
    displayedYear: 2,
    activeYear: activeTerm.year,
    semester: "fall",
    activeSemester: activeTerm.semester,
  }), false);
});

test("requirement progress counts selected and applied courses once", () => {
  assert.deepEqual(logic.requirementProgressCourseIds({
    appliedIds: ["financeA", "financeB"],
    selectedIds: ["financeB", "financeC"],
  }), ["financeA", "financeB", "financeC"]);
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
