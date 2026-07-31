import assert from "node:assert/strict";
import test from "node:test";

await import("../../course-interaction-logic.js");

const logic = globalThis.ScheduleRUCourseInteractionLogic;

test("canonical record merging keeps known metadata from every course view", () => {
  assert.deepEqual(logic.mergeCourseRecords([
    {
      code: "01:198:425",
      title: "BRAIN-INSPIRED COMPUTING",
      credits: 4,
      catalogPrereqs: "",
    },
    {
      code: "01:198:425",
      title: "",
      credits: "",
      catalogPrereqs: "01:198:112",
      description: "Computing inspired by neural systems.",
    },
  ]), {
    code: "01:198:425",
    title: "BRAIN-INSPIRED COMPUTING",
    credits: 4,
    catalogPrereqs: "01:198:112",
    description: "Computing inspired by neural systems.",
  });
  assert.deepEqual(logic.mergeCourseRecords([
    {
      code: "01:198:425",
      title: "01:198:425",
      fullTitle: "01:198:425",
    },
    {
      code: "01:198:425",
      title: "BRAIN-INSPIRED COMPUTING",
      fullTitle: "BRAIN-INSPIRED COMPUTING",
    },
  ]), {
    code: "01:198:425",
    title: "BRAIN-INSPIRED COMPUTING",
    fullTitle: "BRAIN-INSPIRED COMPUTING",
  });
});

test("course levels come from the canonical Rutgers course code", () => {
  assert.equal(logic.courseNumber("01:198:425"), 425);
  assert.equal(logic.courseNumber({ code: "01:198:301" }), 301);
  assert.equal(logic.courseNumber("01:198:42"), null);
});

test("selected course codes deduplicate the same course across requirement groups", () => {
  const records = {
    bait: { code: "01:198:425" },
    cs: { code: "01:198:425" },
    finance: { code: "33:390:400" },
  };
  assert.deepEqual(logic.selectedCourseCodes({
    baitElective: ["bait"],
    csElective: ["cs"],
    financeElective: ["finance"],
  }, (id) => records[id]), ["01:198:425", "33:390:400"]);
});

test("the first eligible wishlist action also fills an open requirement slot", () => {
  assert.deepEqual(logic.requirementSelectionAction({
    eligible: true,
    selected: false,
    openSlots: 1,
    inWishlist: false,
  }), {
    select: true,
    wishlist: true,
    removeSelection: false,
    removeWishlist: false,
  });
  assert.deepEqual(logic.requirementSelectionAction({
    eligible: true,
    selected: false,
    openSlots: 0,
    inWishlist: false,
  }), {
    select: false,
    wishlist: true,
    removeSelection: false,
    removeWishlist: false,
  });
});

test("stored expansion choices override defaults without losing an explicit closed state", () => {
  assert.equal(logic.expansionOpen({ stored: undefined, defaultOpen: true }), true);
  assert.equal(logic.expansionOpen({ stored: undefined, defaultOpen: false }), false);
  assert.equal(logic.expansionOpen({ stored: false, defaultOpen: true }), false);
  assert.equal(logic.expansionOpen({ stored: true, defaultOpen: false }), true);
});

test("catalog rerender state restores scroll while focusing only the field that was active", () => {
  assert.deepEqual(logic.catalogViewState({
    scrollLeft: 12,
    scrollTop: 840,
    activeElementId: "cpSearch",
    selectionStart: 4,
    selectionEnd: 7,
  }), {
    scrollLeft: 12,
    scrollTop: 840,
    restoreSearchFocus: true,
    selectionStart: 4,
    selectionEnd: 7,
  });
  assert.deepEqual(logic.catalogViewState({
    scrollLeft: 0,
    scrollTop: 500,
    activeElementId: "",
  }), {
    scrollLeft: 0,
    scrollTop: 500,
    restoreSearchFocus: false,
    selectionStart: null,
    selectionEnd: null,
  });
});

test("manual placement warns only when the resulting semester exceeds 18 credits", () => {
  assert.deepEqual(logic.manualPlacementWarnings({
    currentCredits: 15,
    incomingCredits: 3,
  }), []);
  assert.deepEqual(logic.manualPlacementWarnings({
    currentCredits: 16,
    incomingCredits: 3,
  }), [{
    kind: "credit_limit",
    reason: "This placement would bring the semester to 19 credits, above the standard 18-credit limit.",
  }]);
});

test("manual placement reports every reviewed rule the student must override", () => {
  assert.deepEqual(logic.manualPlacementWarnings({
    currentCredits: 18,
    incomingCredits: 3,
    prerequisiteBlocked: true,
    prerequisiteReason: "Complete 01:198:112 first.",
    standingBlocked: true,
    standingReason: "Junior standing required.",
  }), [
    {
      kind: "credit_limit",
      reason: "This placement would bring the semester to 21 credits, above the standard 18-credit limit.",
    },
    { kind: "prerequisite", reason: "Complete 01:198:112 first." },
    { kind: "standing", reason: "Junior standing required." },
  ]);
});

test("builder sections sort by numeric section and then index number", () => {
  const sections = [
    { section_number: "10", index_number: "20001" },
    { section_number: "02", index_number: "30000" },
    { section_number: "02", index_number: "10000" },
    { section_number: "A1", index_number: "40000" },
  ];
  assert.deepEqual(logic.sortSections(sections), [
    { section_number: "02", index_number: "10000" },
    { section_number: "02", index_number: "30000" },
    { section_number: "10", index_number: "20001" },
    { section_number: "A1", index_number: "40000" },
  ]);
  assert.equal(sections[0].section_number, "10");
});

test("calendar geometry preserves exact minutes and a visible thirty-minute gap", () => {
  assert.deepEqual(logic.calendarBlockGeometry({
    startMinute: 540,
    endMinute: 620,
    dayStartMinute: 480,
    pixelsPerMinute: 0.8,
  }), { top: 48, height: 64 });
  const later = logic.calendarBlockGeometry({
    startMinute: 650,
    endMinute: 730,
    dayStartMinute: 480,
    pixelsPerMinute: 0.8,
  });
  assert.equal(later.top - (48 + 64), 24);
});

test("onboarding course search ranks an exact off-page Rutgers code first", () => {
  const courses = [
    { code: "33:011:301", title: "FOUNDATIONS FOR YOUR CAREER JOURNEY" },
    { code: "33:011:100", title: "INTRO TO BUSINESS" },
  ];
  assert.equal(
    logic.rankOnboardingCourseMatches(courses, "33:011:100")[0]?.code,
    "33:011:100"
  );
});

test("onboarding course search tolerates partial titles and common misspellings", () => {
  const courses = [
    { code: "01:198:111", title: "INTRODUCTION TO COMPUTER SCIENCE" },
    { code: "01:198:170", title: "COMPUTER APPLICATIONS FOR BUSINESS" },
    { code: "33:011:100", title: "INTRO TO BUSINESS" },
  ];
  assert.equal(
    logic.rankOnboardingCourseMatches(courses, "computer sci")[0]?.code,
    "01:198:111"
  );
  assert.equal(
    logic.rankOnboardingCourseMatches(courses, "introduction to compter science")[0]?.code,
    "01:198:111"
  );
  assert.equal(
    logic.rankOnboardingCourseMatches(courses, "intro buisness")[0]?.code,
    "33:011:100"
  );
});

test("onboarding search creates bounded catalog fallbacks without accepting invented courses", () => {
  assert.deepEqual(
    logic.onboardingCatalogSearchTerms("introduction to compter science"),
    ["introduction to compter science", "introduction", "science", "compter"]
  );
  assert.deepEqual(logic.onboardingCatalogSearchTerms("33:011:100"), ["33:011:100"]);
  assert.equal(logic.verifiedOnboardingCourse([], "Imaginary Studies"), null);
  assert.equal(
    logic.verifiedOnboardingCourse(
      [{ code: "33:011:100", title: "INTRO TO BUSINESS" }],
      "33:011:100"
    )?.code,
    "33:011:100"
  );
});
