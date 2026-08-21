import assert from "node:assert/strict";
import test from "node:test";

await import("../../apps/web/src/user-message-model.js");

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

test("program choices stay in the picker while every Core placeholder opens the catalog", () => {
  assert.equal(logic.placeholderDestination({
    sourceType: "program",
    group: { members: ["a", "b"], courseSelectors: [{ selector_key: "ignored" }] },
  }), "requirement_picker");
  assert.equal(logic.placeholderDestination({
    sourceType: "program",
    group: { members: [], courseSelectors: [{ selector_key: "subject" }] },
  }), "requirement_picker");
  assert.equal(logic.placeholderDestination({
    group: { members: [], courseSelectors: [] },
  }), "requirement_panel");
  assert.equal(logic.placeholderDestination({
    sourceType: "program",
    group: null,
    candidateSelectionContext: { memberCourseCodes: ["01:750:203"], courseSelectors: [] },
  }), "requirement_picker");
  assert.equal(logic.placeholderDestination({
    sourceType: "program",
    group: null,
    candidateSelectionContext: { members: [], memberCourseCodes: [], courseSelectors: [{ selector_key: "subject" }] },
  }), "requirement_picker");
  assert.equal(logic.placeholderDestination({
    sourceType: "core",
    group: { members: ["a", "b"], courseSelectors: [] },
  }), "course_catalog");
  assert.equal(logic.placeholderDestination({
    sourceType: "core",
    candidateSelectionContext: { courseSelectors: [{ selector_key: "subject" }] },
  }), "course_catalog");
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

test("Finance elective progress includes scheduled and newly selected courses exactly once", () => {
  assert.deepEqual(logic.requirementProgressCourseIds({
    appliedIds: ["33:390:435"],
    selectedIds: ["33:390:331", "33:390:375"],
  }), ["33:390:435", "33:390:331", "33:390:375"]);
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
    message: "No prerequisite courses are listed for this course.",
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
    kind: "catalog_detail",
    message: "Review the official prerequisite wording below before registration.",
  });
});

test("plan generation preflight requires acknowledgement only for incomplete Core choices", () => {
  assert.equal(logic.generationPreflight({ busy: true, coreIncomplete: true }), "ignore");
  assert.equal(logic.generationPreflight({ busy: false, coreIncomplete: true }), "warn");
  assert.equal(logic.generationPreflight({ busy: false, coreIncomplete: false }), "confirm");
  assert.equal(logic.approvedGenerationPreflight({ coreIncomplete: false }), "generate");
  assert.equal(logic.approvedGenerationPreflight({ coreIncomplete: true }), "warn");
});

test("only complete generated plans can replace the accepted plan", () => {
  assert.equal(logic.canAcceptGeneratedPlan({ status: "complete", issues: [] }), true);
  assert.equal(logic.canAcceptGeneratedPlan({
    status: "partial",
    issues: [{ code: "courses_unplaced", severity: "error" }],
  }), false);
  assert.equal(logic.canAcceptGeneratedPlan({
    status: "complete",
    issues: [{ code: "locked_prerequisite_violation", severity: "error" }],
  }), false);
});

test("plan previews explain aggregate credit capacity with exact totals", () => {
  assert.deepEqual(logic.previewResult({
    status: "partial",
    issues: [{
      code: "plan_capacity_exceeded",
      severity: "error",
      requiredCredits: 151,
      availableCredits: 144,
      overByCredits: 7,
    }],
  }), {
    kind: "aggregate_capacity",
    title: "This plan needs more room",
    message: "Your selections need at least 7 more credits than the current four-year plan allows.",
  });
});

test("plan previews explain course-slot capacity independently of credits", () => {
  assert.deepEqual(logic.previewResult({
    status: "partial",
    issues: [{
      code: "plan_course_slots_exceeded",
      severity: "error",
      requiredItems: 49,
      availableItems: 48,
      overByItems: 1,
    }],
  }), {
    kind: "course_slot_capacity",
    title: "This plan has too many course slots",
    message: "The selected requirements cannot all fit within the current semester limits.",
  });
});

test("plan previews name a proven prerequisite sequencing bottleneck", () => {
  assert.deepEqual(logic.previewResult({
    status: "partial",
    issues: [{
      code: "plan_sequence_capacity_exceeded",
      severity: "error",
      courseCodes: ["01:198:108"],
      earliestTermOrdinal: 8,
      lastTermOrdinal: 7,
    }],
  }), {
    kind: "sequencing_capacity",
    title: "A course sequence needs more time",
    message: "A required prerequisite or class-standing sequence extends past the final planned semester.",
  });
});

test("plan previews report an exhausted search without declaring impossibility", () => {
  assert.deepEqual(logic.previewResult({
    status: "partial",
    issues: [{
      code: "plan_feasibility_inconclusive",
      severity: "error",
      searchedStates: 50001,
    }],
  }), {
    kind: "indeterminate",
    title: "We couldn't finish checking this plan",
    message: "The planner stopped before it could confirm a safe four-year arrangement. Your current plan has not changed.",
  });
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
