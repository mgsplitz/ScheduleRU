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

  function placeholderDestination({ sourceType, group, candidateSelectionContext } = {}) {
    if (sourceType === "core") return "course_catalog";
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
      kind: "catalog_detail",
      message: "Review the official prerequisite wording below before registration.",
    };
  }

  function generationPreflight({ busy = false, coreIncomplete = false } = {}) {
    if (busy) return "ignore";
    return coreIncomplete ? "warn" : "confirm";
  }

  function approvedGenerationPreflight({ coreIncomplete = false } = {}) {
    return coreIncomplete ? "warn" : "generate";
  }

  function canAcceptGeneratedPlan(preview = {}) {
    return preview?.status === "complete"
      && !(preview?.issues || []).some((issue) => issue?.severity === "error");
  }

  function previewResult(preview = {}) {
    const issues = Array.isArray(preview?.issues) ? preview.issues : [];
    const aggregate = issues.find((issue) => issue?.code === "plan_capacity_exceeded");
    if (aggregate) {
      const shown = root.ScheduleRUUserMessageModel.presentIssue(aggregate);
      return {
        kind: "aggregate_capacity",
        title: shown.title,
        message: shown.message,
      };
    }
    const courseSlots = issues.find((issue) => issue?.code === "plan_course_slots_exceeded");
    if (courseSlots) {
      const shown = root.ScheduleRUUserMessageModel.presentIssue(courseSlots);
      return {
        kind: "course_slot_capacity",
        title: shown.title,
        message: shown.message,
      };
    }
    const sequencing = issues.find((issue) => issue?.code === "plan_sequence_capacity_exceeded");
    if (sequencing) {
      const shown = root.ScheduleRUUserMessageModel.presentIssue(sequencing);
      return {
        kind: "sequencing_capacity",
        title: shown.title,
        message: shown.message,
      };
    }
    const inconclusive = issues.find((issue) => issue?.code === "plan_feasibility_inconclusive");
    if (inconclusive) {
      const shown = root.ScheduleRUUserMessageModel.presentIssue(inconclusive);
      return {
        kind: "indeterminate",
        title: shown.title,
        message: shown.message,
      };
    }
    if (canAcceptGeneratedPlan(preview)) {
      return {
        kind: "complete",
        title: "Generated plan preview",
        message: "Every required course and unresolved requirement slot fits within the current planning constraints.",
      };
    }
    const shown = root.ScheduleRUUserMessageModel.presentIssue({ code: "requirements_unplaced" });
    return {
      kind: "incomplete",
      title: shown.title,
      message: shown.message,
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
    approvedGenerationPreflight,
    canAcceptGeneratedPlan,
    previewResult,
    shouldAutoCollapseSharedGroup,
  };
})(globalThis);
