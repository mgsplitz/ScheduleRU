/*
 * Deterministic schedule-preference logic shared by the browser and unit
 * tests. This module deliberately makes no DOM, storage, or model calls.
 */
(function exposeScheduleRUPreferenceLogic(root) {
  const KINDS = new Set([
    "earliest_start", "latest_end", "avoid_day", "preferred_day",
    "light_day", "time_window_exception", "compact_schedule",
    "maximum_gap", "campus", "modality", "open_sections",
  ]);
  const DAYS = new Set(["M", "T", "W", "R", "F", "S", "U"]);
  const strengths = new Set(["hard", "soft"]);

  const text = (value) => typeof value === "string" ? value.trim() : "";
  const day = (value) => typeof value === "string" && DAYS.has(value) ? value : null;
  const minutes = (value) => {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 24 * 60 ? value : null;
  };
  const count = (value) => {
    return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100 ? value : null;
  };
  const stableIndex = (schedule, fallback) => {
    const value = schedule?.stableIndex;
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
  };
  const hasOnlyFields = (raw, fields) => {
    const allowed = new Set(["kind", "strength", ...fields]);
    return Object.keys(raw).every((key) => allowed.has(key));
  };

  function normalizeConstraint(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || !KINDS.has(raw.kind)) return null;
    if (!strengths.has(raw.strength)) return null;
    const strength = raw.strength;
    const base = { kind: raw.kind, strength };
    if (raw.kind === "earliest_start" || raw.kind === "latest_end" || raw.kind === "maximum_gap") {
      if (!hasOnlyFields(raw, ["minutes"])) return null;
      const value = minutes(raw.minutes);
      return value === null ? null : { ...base, minutes: value };
    }
    if (raw.kind === "avoid_day" || raw.kind === "preferred_day") {
      if (!hasOnlyFields(raw, ["day"])) return null;
      const value = day(raw.day);
      return value === null ? null : { ...base, day: value };
    }
    if (raw.kind === "light_day") {
      if (!hasOnlyFields(raw, ["day", "maximumClasses"])) return null;
      const value = day(raw.day);
      const maximumClasses = count(raw.maximumClasses);
      return value === null || maximumClasses === null ? null : { ...base, day: value, maximumClasses };
    }
    if (raw.kind === "time_window_exception") {
      if (!hasOnlyFields(raw, ["day", "startMinutes", "endMinutes", "minimumClasses", "maximumClasses"])) return null;
      const startMinutes = minutes(raw.startMinutes);
      const endMinutes = minutes(raw.endMinutes);
      const normalizedDay = raw.day === undefined ? null : day(raw.day);
      const minimumClasses = raw.minimumClasses === undefined ? null : count(raw.minimumClasses);
      const maximumClasses = raw.maximumClasses === undefined ? null : count(raw.maximumClasses);
      if (startMinutes === null || endMinutes === null || startMinutes >= endMinutes
        || (raw.day !== undefined && normalizedDay === null)
        || (raw.minimumClasses !== undefined && minimumClasses === null)
        || (raw.maximumClasses !== undefined && maximumClasses === null)
        || (minimumClasses !== null && maximumClasses !== null && minimumClasses > maximumClasses)) return null;
      return {
        ...base,
        ...(normalizedDay ? { day: normalizedDay } : {}),
        startMinutes,
        endMinutes,
        ...(minimumClasses === null ? {} : { minimumClasses }),
        ...(maximumClasses === null ? {} : { maximumClasses }),
      };
    }
    if (raw.kind === "compact_schedule") return hasOnlyFields(raw, []) ? base : null;
    if (raw.kind === "campus" || raw.kind === "modality") {
      if (!hasOnlyFields(raw, ["value"])) return null;
      const value = text(raw.value);
      return value ? { ...base, value } : null;
    }
    if (raw.kind === "open_sections") {
      if (!hasOnlyFields(raw, ["value"])) return null;
      return typeof raw.value === "boolean" ? { ...base, value: raw.value } : null;
    }
    return null;
  }

  function normalizePreferenceSet(raw = {}) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.version !== 1) {
      return { version: 1, constraints: [] };
    }
    return {
      version: 1,
      constraints: (Array.isArray(raw.constraints) ? raw.constraints : []).map(normalizeConstraint).filter(Boolean),
    };
  }

  function mergePreferencePatch(current, patch = {}) {
    const baseline = normalizePreferenceSet(current);
    const additions = normalizePreferenceSet({ version: 1, constraints: patch?.constraints }).constraints;
    return { version: 1, constraints: [...baseline.constraints, ...additions] };
  }

  function meetingsFor(schedule) {
    const meetings = Array.isArray(schedule?.meetings) ? schedule.meetings : [];
    return meetings.map((meeting) => {
      const start = minutes(meeting?.start);
      const end = minutes(meeting?.end);
      const meetingDay = day(meeting?.day);
      return start === null || end === null || end <= start || !meetingDay ? null : {
        day: meetingDay, start, end,
        campus: text(meeting.campus), modality: text(meeting.modality),
        open: typeof meeting.open === "boolean" ? meeting.open : null,
      };
    }).filter(Boolean);
  }

  function scheduleMetrics(schedule) {
    const meetings = meetingsFor(schedule);
    const classesByDay = {};
    const gapsByDay = {};
    let earliestStart = null;
    let latestEnd = null;
    let maximumGap = 0;
    for (const meeting of meetings) {
      classesByDay[meeting.day] = (classesByDay[meeting.day] || 0) + 1;
      earliestStart = earliestStart === null ? meeting.start : Math.min(earliestStart, meeting.start);
      latestEnd = latestEnd === null ? meeting.end : Math.max(latestEnd, meeting.end);
    }
    for (const meetingDay of Object.keys(classesByDay)) {
      const ordered = meetings.filter((meeting) => meeting.day === meetingDay).sort((a, b) => a.start - b.start || a.end - b.end);
      gapsByDay[meetingDay] = [];
      for (let index = 1; index < ordered.length; index += 1) {
        const gap = Math.max(0, ordered[index].start - ordered[index - 1].end);
        gapsByDay[meetingDay].push(gap);
        maximumGap = Math.max(maximumGap, gap);
      }
    }
    return {
      meetings, classesByDay, gapsByDay, earliestStart, latestEnd, maximumGap,
      campuses: [...new Set(meetings.map((meeting) => meeting.campus).filter(Boolean))].sort(),
      modalities: [...new Set(meetings.map((meeting) => meeting.modality).filter(Boolean))].sort(),
      allOpen: meetings.length > 0 && meetings.every((meeting) => meeting.open !== null)
        ? meetings.every((meeting) => meeting.open === true) : null,
    };
  }

  function violation(constraint, metrics) {
    const meetings = metrics.meetings;
    if (constraint.kind === "earliest_start") return metrics.earliestStart !== null && metrics.earliestStart < constraint.minutes ? constraint.minutes - metrics.earliestStart : 0;
    if (constraint.kind === "latest_end") return metrics.latestEnd !== null && metrics.latestEnd > constraint.minutes ? metrics.latestEnd - constraint.minutes : 0;
    if (constraint.kind === "avoid_day") return metrics.classesByDay[constraint.day] || 0;
    if (constraint.kind === "preferred_day") return (metrics.classesByDay[constraint.day] || 0) > 0 ? 0 : 1;
    if (constraint.kind === "light_day") return Math.max(0, (metrics.classesByDay[constraint.day] || 0) - constraint.maximumClasses);
    if (constraint.kind === "time_window_exception") {
      const classesInWindow = meetings.filter((meeting) => (!constraint.day || meeting.day === constraint.day)
        && meeting.start >= constraint.startMinutes && meeting.end <= constraint.endMinutes).length;
      return Math.max(0, (constraint.minimumClasses ?? 0) - classesInWindow)
        + Math.max(0, classesInWindow - (constraint.maximumClasses ?? Number.POSITIVE_INFINITY));
    }
    if (constraint.kind === "compact_schedule") return metrics.maximumGap;
    if (constraint.kind === "maximum_gap") return Math.max(0, metrics.maximumGap - constraint.minutes);
    if (constraint.kind === "campus") return metrics.campuses.includes(constraint.value) ? 0 : 1;
    if (constraint.kind === "modality") return metrics.modalities.includes(constraint.value) ? 0 : 1;
    if (constraint.kind === "open_sections") return metrics.allOpen !== null && constraint.value === metrics.allOpen ? 0 : 1;
    return 0;
  }

  function evaluate(schedule, preferences, fallback) {
    const metrics = scheduleMetrics(schedule);
    const violatedHardConstraints = [];
    let hardMagnitude = 0;
    let softPenalty = 0;
    for (const constraint of preferences.constraints) {
      const amount = violation(constraint, metrics);
      if (!amount) continue;
      if (constraint.strength === "hard") {
        violatedHardConstraints.push(constraint.kind);
        hardMagnitude += amount;
      } else softPenalty += amount;
    }
    return {
      ...schedule, stableIndex: stableIndex(schedule, fallback), metrics,
      softPenalty, hardMagnitude, violatedHardConstraints,
    };
  }

  function sortRanked(entries, includeHard = true) {
    return [...entries].sort((a, b) => {
      if (includeHard && a.violatedHardConstraints.length !== b.violatedHardConstraints.length) return a.violatedHardConstraints.length - b.violatedHardConstraints.length;
      if (includeHard && a.hardMagnitude !== b.hardMagnitude) return a.hardMagnitude - b.hardMagnitude;
      if (a.softPenalty !== b.softPenalty) return a.softPenalty - b.softPenalty;
      return a.stableIndex - b.stableIndex;
    });
  }

  function rankSchedules(schedules, rawPreferences) {
    const preferences = normalizePreferenceSet(rawPreferences);
    const evaluated = (Array.isArray(schedules) ? schedules : []).map((schedule, index) => evaluate(schedule, preferences, index + 1));
    return sortRanked(evaluated.filter((item) => item.violatedHardConstraints.length === 0), false);
  }

  function recommendSchedules(schedules, rawPreferences) {
    const preferences = normalizePreferenceSet(rawPreferences);
    const evaluated = (Array.isArray(schedules) ? schedules : []).map((schedule, index) => evaluate(schedule, preferences, index + 1));
    const matches = sortRanked(evaluated.filter((item) => item.violatedHardConstraints.length === 0), false).slice(0, 3);
    if (matches.length) return { matches, tradeoffs: [], conflictSummary: null };
    if (!evaluated.length) return { matches: [], tradeoffs: [], conflictSummary: { impossible: true, constraints: [] } };
    const tradeoffs = sortRanked(evaluated, true).slice(0, 3);
    const constraints = [...new Set(tradeoffs.flatMap((item) => item.violatedHardConstraints))];
    return {
      matches: [], tradeoffs,
      conflictSummary: { impossible: true, constraints, message: "No schedule satisfies every hard constraint." },
    };
  }

  root.ScheduleRUPreferenceLogic = { normalizePreferenceSet, mergePreferencePatch, scheduleMetrics, rankSchedules, recommendSchedules };
})(globalThis);
