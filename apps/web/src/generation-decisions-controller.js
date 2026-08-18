/* Pure state machine for the focused elective decision flow. */
(function exposeGenerationDecisionsController(root) {
  const BUCKETS = ["interested", "maybe", "avoid"];
  const copy = (value, fallback = {}) => {
    try { return JSON.parse(JSON.stringify(value ?? fallback)); } catch (_error) { return fallback; }
  };

  function create({ decisions = [], programs = [], initialPreferences = {}, onChange } = {}) {
    const programById = new Map((programs || []).map((program) => [program.id, program]));
    const ordered = (decisions || [])
      .filter((decision) => ["sequence_critical", "guided_flexible"].includes(decision?.planningMode))
      .map((decision) => copy(decision))
      .sort((left, right) => {
        const priority = (decision) => {
          if (decision.sourceType === "core") return 2;
          return programById.get(decision.sourceProgram)?.school_slug === "rbsnb" ? 0 : 1;
        };
        return priority(left) - priority(right)
          || String(left.label || "").localeCompare(String(right.label || ""))
          || String(left.requirementGroupId || "").localeCompare(String(right.requirementGroupId || ""));
      });
    const known = new Map(ordered.map((decision) => [
      decision.requirementGroupId,
      new Set((decision.candidates || []).map((candidate) => candidate.code)),
    ]));
    const preferences = {};

    ordered.forEach((decision) => {
      const saved = initialPreferences?.[decision.requirementGroupId] || {};
      const candidateCodes = known.get(decision.requirementGroupId);
      const preference = { interested: [], maybe: [], avoid: [], mode: "ranked" };
      BUCKETS.forEach((bucket) => {
        preference[bucket] = [...new Set((saved[bucket] || []).filter((code) => candidateCodes.has(code)))];
      });
      if (saved.mode === "recommend_for_me") preference.mode = "recommend_for_me";
      if (saved.mode === "deferred" && decision.canDefer) preference.mode = "deferred";
      preferences[decision.requirementGroupId] = preference;
    });

    const emit = () => onChange?.(copy(preferences));
    function setInterest(groupId, courseCode, bucket) {
      const preference = preferences[groupId];
      if (!preference || !BUCKETS.includes(bucket) || !known.get(groupId)?.has(courseCode)) return false;
      BUCKETS.forEach((name) => {
        preference[name] = preference[name].filter((code) => code !== courseCode);
      });
      preference[bucket].push(courseCode);
      preference.mode = "ranked";
      emit();
      return true;
    }
    function chooseForMe(groupId) {
      if (!preferences[groupId]) return false;
      preferences[groupId].mode = "recommend_for_me";
      emit();
      return true;
    }
    function defer(groupId) {
      const decision = ordered.find((item) => item.requirementGroupId === groupId);
      if (!decision?.canDefer || !preferences[groupId]) return false;
      preferences[groupId].mode = "deferred";
      emit();
      return true;
    }
    function canAdvance(groupId) {
      const preference = preferences[groupId];
      if (!preference) return false;
      if (preference.mode === "recommend_for_me") return true;
      if (preference.mode === "deferred") {
        return ordered.find((item) => item.requirementGroupId === groupId)?.canDefer === true;
      }
      return BUCKETS.some((bucket) => preference[bucket].length > 0);
    }

    return {
      decisions: () => copy(ordered, []),
      preferences: () => copy(preferences),
      setInterest,
      chooseForMe,
      defer,
      canAdvance,
    };
  }

  root.ScheduleRUGenerationDecisionsController = { create };
})(globalThis);
