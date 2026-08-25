/* Pure state machine for the focused elective decision flow. */
(function exposeGenerationDecisionsController(root) {
  const BUCKETS = ["interested", "maybe", "avoid"];
  const copy = (value, fallback = {}) => {
    try { return JSON.parse(JSON.stringify(value ?? fallback)); } catch (_error) { return fallback; }
  };

  function create({ decisions = [], programs = [], initialPreferences = {}, onChange } = {}) {
    const programById = new Map((programs || []).map((program) => [program.id, program]));
    const numberWord = (value) => ({
      1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six",
      7: "seven", 8: "eight", 9: "nine", 10: "ten", 11: "eleven", 12: "twelve",
    })[Number(value)] || String(value);
    function semanticLabel(decision) {
      const label = String(decision?.label || "")
        .replace(/[.]+$/, "")
        .replace(/^course\s+\d+\s+of\s+\d+\s+for\s+/i, "")
        .trim();
      if (decision?.sourceType === "core") return label;
      const programName = String(programById.get(decision?.sourceProgram)?.name || "").trim();
      const generic = /^(?:course\s+\d+\s+of\s+\d+\s+for\s+)?(?:elective courses?|choose\s+\d+|courses?)$/i.test(label);
      if (!generic || !programName) return label;
      const candidates = decision?.candidates || [];
      if (Number(decision?.slotCount) === 1 && candidates.length === 2) {
        return `Choose ${candidates.map((candidate) => candidate.title || candidate.code).join(" or ")}`;
      }
      const count = Math.max(1, Number(decision?.slotCount) || 1);
      return `${numberWord(count)[0].toUpperCase()}${numberWord(count).slice(1)} ${programName} elective${count === 1 ? "" : "s"}`;
    }
    function sharedCoursePhrase(candidates) {
      const tokenRows = (candidates || []).map((candidate) => String(candidate.title || "")
        .match(/[A-Za-z]+/g) || []);
      if (tokenRows.length < 2 || tokenRows.some((row) => !row.length)) return "";
      const first = tokenRows[0];
      for (let size = Math.min(4, first.length); size >= 2; size -= 1) {
        for (let start = 0; start <= first.length - size; start += 1) {
          const phrase = first.slice(start, start + size);
          const key = phrase.join(" ").toLowerCase();
          if (tokenRows.slice(1).every((row) => row.join(" ").toLowerCase().includes(key))) {
            return phrase.map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase()).join(" ");
          }
        }
      }
      return "";
    }
    const publicationReadyDecisions = (decisions || []).map((decision) => ({
      ...decision,
      candidates: (decision.candidates || []).filter((candidate) => candidate?.ruleCoverage !== "unresolved"),
    }));
    const expanded = publicationReadyDecisions.flatMap((decision) => {
      const families = new Map();
      (decision.candidates || []).forEach((candidate) => {
        const family = candidate.optionFamily
          || [...(candidate.creditExclusionFamilies || [])].filter(Boolean).sort()[0];
        if (!family) return;
        const rows = families.get(family) || [];
        rows.push(candidate);
        families.set(family, rows);
      });
      const familyCandidates = new Set([...families.values()].flat().map((candidate) => candidate.code));
      const stages = [...families].filter(([, candidates]) => candidates.length > 1).map(([family, candidates]) => ({
        ...decision,
        decisionId: `${decision.decisionId || decision.requirementGroupId}:option:${family}`,
        label: sharedCoursePhrase(candidates)
          ? `Choose one ${sharedCoursePhrase(candidates)} course`
          : `Choose one option for ${semanticLabel(decision) || "this requirement"}`,
        slotCount: 1,
        candidates,
        guidanceOnly: true,
        canSkip: true,
        canDefer: false,
      }));
      const remaining = (decision.candidates || []).filter((candidate) => !familyCandidates.has(candidate.code));
      return [...stages, ...(remaining.length ? [{ ...decision, candidates: remaining }] : [])];
    }).map((decision) => ({ ...decision, label: semanticLabel(decision) }));
    const sorted = expanded
      .filter((decision) => ["sequence_critical", "guided_flexible"].includes(decision?.planningMode))
      .map((decision) => copy(decision))
      .sort((left, right) => {
        const priority = (decision) => {
          if (decision.sourceType === "core") return 2;
          return programById.get(decision.sourceProgram)?.school_slug === "rbsnb" ? 0 : 1;
        };
        return priority(left) - priority(right)
          || Number(right.guidanceOnly === true) - Number(left.guidanceOnly === true)
          || (left.sourceProgram === right.sourceProgram
            ? (left.candidates || []).length - (right.candidates || []).length
            : 0)
          || String(left.label || "").localeCompare(String(right.label || ""))
          || String(left.requirementGroupId || "").localeCompare(String(right.requirementGroupId || ""));
      });
    const firstCoreIndex = sorted.findIndex((decision) => decision.sourceType === "core");
    const coreStrategy = firstCoreIndex < 0 ? null : {
      decisionId: "core-strategy",
      requirementGroupId: "core-strategy",
      sourceProgram: "core",
      sourceType: "core",
      coreStrategy: true,
      label: "How should we handle Core courses?",
      planningMode: "guided_flexible",
      candidates: [],
    };
    const ordered = coreStrategy
      ? [...sorted.slice(0, firstCoreIndex), coreStrategy, ...sorted.slice(firstCoreIndex)]
      : sorted;
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
      if (decision.coreStrategy && saved.mode !== "ranked") preference.mode = "recommend_for_me";
      preferences[key] = preference;
    });
    const globalPreference = { interested: [], maybe: [], avoid: [] };
    BUCKETS.forEach((bucket) => {
      globalPreference[bucket] = [...new Set([
        ...(initialPreferences?.__global?.[bucket] || []),
        ...Object.values(preferences).flatMap((preference) => preference[bucket] || []),
      ])];
    });
    preferences.__global = globalPreference;

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
        preferences.__global[name] = preferences.__global[name].filter((code) => code !== courseCode);
        Object.entries(preferences).filter(([otherKey]) => otherKey !== "__global" && otherKey !== key)
          .forEach(([, other]) => { other[name] = other[name].filter((code) => code !== courseCode); });
        preference[name] = preference[name].filter((code) => code !== courseCode);
      });
      preference[bucket].push(courseCode);
      preferences.__global[bucket].push(courseCode);
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
    function setMode(identifier, mode) {
      const key = resolveKey(identifier);
      const decision = ordered.find((item) => decisionKey(item) === key);
      if (!decision?.coreStrategy || !["ranked", "recommend_for_me"].includes(mode)) return false;
      preferences[key].mode = mode;
      emit();
      return true;
    }
    function defer(identifier) {
      const key = resolveKey(identifier);
      const decision = ordered.find((item) => decisionKey(item) === key);
      if (!(decision?.canDefer || decision?.canSkip) || !preferences[key]) return false;
      preferences[key].mode = "deferred";
      emit();
      return true;
    }
    function canAdvance(identifier) {
      const key = resolveKey(identifier);
      const preference = preferences[key];
      if (!preference) return false;
      const decision = ordered.find((item) => decisionKey(item) === key);
      if (decision?.coreStrategy) return true;
      if (preference.mode === "recommend_for_me") return true;
      if (preference.mode === "deferred") {
        return decision?.canDefer === true || decision?.canSkip === true;
      }
      if (BUCKETS.some((bucket) => preference[bucket].length > 0)) return true;
      const candidateCodes = new Set((decision?.candidates || []).map((candidate) => candidate.code));
      return BUCKETS.some((bucket) => (preferences.__global[bucket] || []).some((code) => candidateCodes.has(code)));
    }
    function unratedCandidates(identifier) {
      const key = resolveKey(identifier);
      const decision = ordered.find((item) => decisionKey(item) === key);
      if (!decision) return [];
      const rated = new Set(BUCKETS.flatMap((bucket) => preferences.__global[bucket] || []));
      const local = new Set(BUCKETS.flatMap((bucket) => preferences[key]?.[bucket] || []));
      return copy((decision.candidates || []).filter((candidate) => !rated.has(candidate.code) || local.has(candidate.code)), []);
    }

    return {
      decisions: () => copy(ordered, []),
      preferences: () => copy(preferences),
      setInterest,
      chooseForMe,
      setMode,
      defer,
      canAdvance,
      unratedCandidates,
    };
  }

  root.ScheduleRUGenerationDecisionsController = { create };
})(globalThis);
