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
    return {
      requirementLabel: alreadyApplied
        ? "In schedule"
        : selected
          ? "Remove"
          : canSelect
            ? "Use for requirement"
            : "Requirement filled",
      requirementDisabled: alreadyApplied || (!selected && !canSelect),
      wishlistLabel: inWishlist ? "Remove from Wishlist" : "Add to Wishlist",
      wishlistSelected: inWishlist,
    };
  }

  function placeholderDestination({ group } = {}) {
    if ((group?.members || []).length) return "requirement_picker";
    if ((group?.courseSelectors || []).length) return "selector_browser";
    return "requirement_panel";
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
    placeholderDestination,
    coursePathState,
    generationPreflight,
    shouldAutoCollapseSharedGroup,
  };
})(globalThis);
