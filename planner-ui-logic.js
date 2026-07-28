/*
 * Pure UI decisions for planner workflows. Keeping these branches outside the
 * DOM handlers makes the same behavior testable without browser or network
 * fixtures.
 */
(function exposePlannerUILogic(root) {
  function pickerActions({
    alreadyApplied = false,
    selected = false,
    canSelect = false,
    inWishlist = false,
  } = {}) {
    if (alreadyApplied) {
      return { label: "In schedule", disabled: true, intent: "none", selected: true };
    }
    if (selected) {
      return { label: "Remove", disabled: false, intent: "requirement", selected: true };
    }
    if (canSelect) {
      return { label: "Use for requirement", disabled: false, intent: "requirement", selected: false };
    }
    return {
      label: inWishlist ? "Remove from Wishlist" : "Add to Wishlist",
      disabled: false,
      intent: "wishlist",
      selected: inWishlist,
    };
  }

  function catalogWishlistAction({ inWishlist = false } = {}) {
    return {
      label: inWishlist ? "Remove" : "+ Wishlist",
      remove: inWishlist === true,
      disabled: false,
    };
  }

  function placeholderDestination({ group, candidateSelectionContext } = {}) {
    const context = group || candidateSelectionContext || {};
    if ((context.members || []).length || (context.memberCourseCodes || []).length) return "requirement_picker";
    if ((context.courseSelectors || []).length) return "requirement_picker";
    return "requirement_panel";
  }

  function programSchoolChoices({ schools = [], programs = [] } = {}) {
    const supported = new Set((programs || []).map((program) => program?.school_slug).filter(Boolean));
    return (schools || []).filter((school) => supported.has(school?.slug)).map((school) => ({
      slug: school.slug,
      label: school.name || school.short_name || school.slug,
    }));
  }

  function programsForBrowse({ programs = [], schoolSlug = "", query = "" } = {}) {
    if (!schoolSlug) return [];
    const search = String(query || "").trim().toLowerCase();
    return (programs || []).filter((program) => program?.school_slug === schoolSlug).filter((program) => {
      if (!search) return true;
      return [program.name, program.degree_type, program.type, program.academic_program_code]
        .join(" ").toLowerCase().includes(search);
    });
  }

  function canOpenSemesterBuilder({
    displayedYear,
    activeYear,
    semester,
    activeSemester,
  } = {}) {
    return Number(displayedYear) === Number(activeYear)
      && (semester === "fall" || semester === "spring")
      && semester === activeSemester;
  }

  function activePlannerTerm({ academicPosition = {}, activeSemester = "fall" } = {}) {
    const savedYear = Number(academicPosition?.year);
    return {
      year: Number.isInteger(savedYear) && savedYear >= 1 ? savedYear : 1,
      semester: activeSemester === "spring" ? "spring" : "fall",
    };
  }

  function requirementProgressCourseIds({ appliedIds = [], selectedIds = [] } = {}) {
    return [...new Set([...appliedIds, ...selectedIds].filter(Boolean))];
  }

  function coursePathState({
    plan,
    verifiedNoPrerequisites = false,
    catalogRecordAvailable = false,
    catalogPrerequisites = "",
  } = {}) {
    if ((plan?.paths || []).length) return { kind: "paths" };
    if ((plan?.references || []).length) return { kind: "references" };
    if (verifiedNoPrerequisites) {
      return {
        kind: "none",
        message: "No reviewed prerequisite is recorded for this course.",
      };
    }
    if (catalogRecordAvailable && !String(catalogPrerequisites || "").trim()) {
      return {
        kind: "none",
        message: "No prerequisite is listed in the current Rutgers catalog record.",
      };
    }
    return {
      kind: "unreviewed",
      message: "A machine-readable prerequisite path is not available yet. Verify the official catalog before registration.",
    };
  }

  function generationPreflight({ busy = false, coreIncomplete = false } = {}) {
    if (busy) return "ignore";
    return coreIncomplete ? "warn" : "confirm";
  }

  function canAcceptGeneratedPlan(preview = {}) {
    return preview?.status === "complete"
      && !(preview?.issues || []).some((issue) => issue?.severity === "error");
  }

  function previewResult(preview = {}) {
    const issues = Array.isArray(preview?.issues) ? preview.issues : [];
    const aggregate = issues.find((issue) => issue?.code === "plan_capacity_exceeded");
    if (aggregate) {
      return {
        kind: "aggregate_capacity",
        title: "Plan exceeds four-year credit capacity",
        message: `These selections need about ${aggregate.requiredCredits} remaining credits, but the available semesters hold at most ${aggregate.availableCredits}. Reduce the plan by at least ${aggregate.overByCredits} credits, apply completed/AP credit, or plan additional terms.`,
      };
    }
    const courseSlots = issues.find((issue) => issue?.code === "plan_course_slots_exceeded");
    if (courseSlots) {
      return {
        kind: "course_slot_capacity",
        title: "Plan exceeds four-year course capacity",
        message: `These selections need ${courseSlots.requiredItems} required course slots, but the available semesters allow ${courseSlots.availableItems}. Reduce the plan by at least ${courseSlots.overByItems} course slot${courseSlots.overByItems === 1 ? "" : "s"}, apply completed/AP credit, or plan additional terms.`,
      };
    }
    const sequencing = issues.find((issue) => issue?.code === "plan_sequence_capacity_exceeded");
    if (sequencing) {
      const blockers = [...(sequencing.courseCodes || []), ...(sequencing.requirementLabels || [])].slice(0, 6);
      return {
        kind: "sequencing_capacity",
        title: "Required sequence extends beyond four years",
        message: blockers.length
          ? `The prerequisite or standing sequence ending with ${blockers.join(", ")} extends beyond the final planned semester.`
          : "Prerequisite, standing, locked-term, and semester-capacity constraints cannot all fit within the current eight-semester horizon.",
      };
    }
    if (issues.some((issue) => issue?.code === "plan_feasibility_inconclusive")) {
      return {
        kind: "indeterminate",
        title: "Planner could not finish the feasibility check",
        message: "The automatic search reached its safety limit before it could prove whether a complete eight-semester arrangement exists. Your current plan was not changed.",
      };
    }
    if (canAcceptGeneratedPlan(preview)) {
      return {
        kind: "complete",
        title: "Generated plan preview",
        message: "Every required course and unresolved requirement slot fits within the current planning constraints.",
      };
    }
    return {
      kind: "incomplete",
      title: "Plan needs changes",
      message: "The planner could not place every required item. Review the blocking details below before changing your current plan.",
    };
  }

  function shouldAutoCollapseSharedGroup({ group, selectedMajorIds = [] } = {}) {
    const selected = new Set(selectedMajorIds || []);
    const sharedMajorCount = [...new Set(group?.sourceProgramIds || [])]
      .filter((programId) => selected.has(programId)).length;
    const coreFamily = Boolean(String(group?.display_family || "").trim())
      || /\b(?:business|foundational|pre-?business|common)\s+core\b/i.test(String(group?.name || ""));
    return coreFamily && sharedMajorCount > 1;
  }

  root.ScheduleRUPlannerUI = {
    pickerActions,
    catalogWishlistAction,
    placeholderDestination,
    programSchoolChoices,
    programsForBrowse,
    canOpenSemesterBuilder,
    activePlannerTerm,
    requirementProgressCourseIds,
    coursePathState,
    generationPreflight,
    canAcceptGeneratedPlan,
    previewResult,
    shouldAutoCollapseSharedGroup,
  };
})(globalThis);
