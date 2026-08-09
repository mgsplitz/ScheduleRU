/*
 * Pure requirement-progress orchestration shared by the browser and tests.
 * Browser state and course hydration remain caller-owned; this model only
 * coordinates deterministic progress and reviewed allocation calculations.
 */
(function exposeRequirementProgressModel(root) {
  const requirementLogic = root.ScheduleRURequirementLogic;

  function allocationFingerprint({
    groups,
    completed,
    apOn,
    schedule,
    groupSelections,
  }) {
    return JSON.stringify([
      Object.keys(groups || {}).sort().map((id) => [
        id,
        groups[id]?.allocation,
        groups[id]?.members,
        groups[id]?.rule,
        groups[id]?.count,
        groups[id]?.children,
        groups[id]?.parentId,
        groups[id]?.courseSelectors,
      ]),
      Object.keys(completed || {}).filter((id) => completed[id]).sort(),
      Object.keys(apOn || {}).filter((id) => apOn[id]).sort(),
      Object.values(schedule || {}).map((entry) => entry?.code).filter(Boolean).sort(),
      Object.keys(groupSelections || {}).sort().map((id) => [id, groupSelections[id]]),
    ]);
  }

  function create({
    getGroups,
    getState,
    isCompleted,
    selectedRequirementCourses,
    isConstraintGroup,
    baseAppliedCourseIds,
    courseCredits,
  }) {
    let allocationCache = { key: "", value: null };

    function baseOptions() {
      return {
        isCompleted,
        selectedRequirementCourses,
        isConstraintGroup,
        appliedCourseIds: baseAppliedCourseIds,
        courseCredits,
      };
    }

    function allocation() {
      if (!requirementLogic?.allocateRequirementCourses) return null;
      const groups = getGroups() || {};
      const key = allocationFingerprint({ groups, ...(getState() || {}) });
      if (allocationCache.key === key) return allocationCache.value;
      const value = requirementLogic.allocateRequirementCourses(groups, baseOptions());
      allocationCache = { key, value };
      return value;
    }

    function groupAppliedCourseIds(group) {
      if (!group?.allocation) return baseAppliedCourseIds(group);
      const allocated = allocation()?.appliedByGroup?.[group.id];
      return Array.isArray(allocated) ? allocated : baseAppliedCourseIds(group);
    }

    function progressOptions() {
      return {
        ...baseOptions(),
        appliedCourseIds: groupAppliedCourseIds,
      };
    }

    function groupProgress(group) {
      return requirementLogic.groupProgress(group, isCompleted, progressOptions());
    }

    function groupFulfilled(groupId) {
      return requirementLogic.groupFulfilled(groupId, getGroups() || {}, progressOptions());
    }

    return {
      allocation,
      groupAppliedCourseIds,
      groupProgress,
      groupFulfilled,
    };
  }

  root.ScheduleRURequirementProgressModel = {
    allocationFingerprint,
    create,
  };
})(globalThis);
