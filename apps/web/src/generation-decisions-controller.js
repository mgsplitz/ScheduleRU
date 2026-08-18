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
    const decisionKey = (decision) => decision.decisionId || decision.requirementGroupId;
    const known = new Map(ordered.map((decision) => [
      decisionKey(decision),
      new Set((decision.candidates || []).map((candidate) => candidate.code)),
    ]));
    const preferences = {};

    ordered.forEach((decision) => {
      const key = decisionKey(decision);
      const saved = initialPreferences?.[key] || initialPreferences?.[decision.requirementGroupId] || {};
      const candidateCodes = known.get(key);
      const preference = { interested: [], maybe: [], avoid: [], mode: "ranked" };
      BUCKETS.forEach((bucket) => {
        preference[bucket] = [...new Set((saved[bucket] || []).filter((code) => candidateCodes.has(code)))];
      });
      if (saved.mode === "recommend_for_me") preference.mode = "recommend_for_me";
      if (saved.mode === "deferred" && decision.canDefer) preference.mode = "deferred";
      preferences[key] = preference;
    });

    const emit = () => onChange?.(copy(preferences));
    function resolveKey(identifier) {
      if (preferences[identifier]) return identifier;
      const matches = ordered.filter((item) => item.requirementGroupId === identifier);
      return matches.length === 1 ? decisionKey(matches[0]) : null;
    }
    function setInterest(identifier, courseCode, bucket) {
      const key = resolveKey(identifier);
      const preference = preferences[key];
      if (!preference || !BUCKETS.includes(bucket) || !known.get(key)?.has(courseCode)) return false;
      BUCKETS.forEach((name) => {
        preference[name] = preference[name].filter((code) => code !== courseCode);
      });
      preference[bucket].push(courseCode);
      preference.mode = "ranked";
      emit();
      return true;
    }
    function chooseForMe(identifier) {
      const key = resolveKey(identifier);
      if (!preferences[key]) return false;
      preferences[key].mode = "recommend_for_me";
      emit();
      return true;
    }
    function defer(identifier) {
      const key = resolveKey(identifier);
      const decision = ordered.find((item) => decisionKey(item) === key);
      if (!decision?.canDefer || !preferences[key]) return false;
      preferences[key].mode = "deferred";
      emit();
      return true;
    }
    function canAdvance(identifier) {
      const key = resolveKey(identifier);
      const preference = preferences[key];
      if (!preference) return false;
      if (preference.mode === "recommend_for_me") return true;
      if (preference.mode === "deferred") {
        return ordered.find((item) => decisionKey(item) === key)?.canDefer === true;
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
