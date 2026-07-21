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
  const day = (value) => {
    const normalized = text(value).toUpperCase();
    return DAYS.has(normalized) ? normalized : null;
  };
  const minutes = (value) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 && number < 24 * 60 ? number : null;
  };
  const count = (value) => {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 && number <= 100 ? number : null;
  };
  const stableIndex = (schedule, fallback) => {
    const value = Number(schedule?.stableIndex);
    return Number.isInteger(value) && value > 0 ? value : fallback;
  };

  function normalizeConstraint(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || !KINDS.has(raw.kind)) return null;
    if (raw.strength !== undefined && !strengths.has(raw.strength)) return null;
    const strength = raw.strength || "soft";
    const base = { kind: raw.kind, strength };
    if (raw.kind === "earliest_start" || raw.kind === "latest_end") {
      const value = minutes(raw.minutes);
      return value === null ? null : { ...base, minutes: value };
    }
    if (raw.kind === "avoid_day" || raw.kind === "preferred_day") {
      const value = day(raw.day);
      return value === null ? null : { ...base, day: value };
    }
    if (raw.kind === "light_day") {
      const value = day(raw.day);
      const maximumClasses = count(raw.maximumClasses);
      return value === null || maximumClasses === null ? null : { ...base, day: value, maximumClasses };
    }
    if (raw.kind === "time_window_exception") {
      const start = minutes(raw.start ?? raw.startMinutes);
      const end = minutes(raw.end ?? raw.endMinutes);
      const value = raw.day === undefined ? null : day(raw.day);
      return start === null || end === null || start >= end || (raw.day !== undefined && value === null)
        ? null : { ...base, start, end, ...(value ? { day: value } : {}) };
    }
    if (raw.kind === "compact_schedule" || raw.kind === "maximum_gap") {
      const maximumGap = minutes(raw.maximumGap ?? raw.minutes);
      return maximumGap === null ? null : { ...base, maximumGap };
    }
    if (raw.kind === "campus") {
      const campus = text(raw.campus);
      return campus ? { ...base, campus } : null;
    }
    if (raw.kind === "modality") {
      const modality = text(raw.modality);
      return modality ? { ...base, modality } : null;
    }
    if (raw.kind === "open_sections") {
      const open = raw.open ?? raw.required;
      return typeof open === "boolean" ? { ...base, open } : null;
    }
    return null;
  }

  function normalizePreferenceSet(raw = {}) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || Number(raw.version) !== 1) {
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
        open: meeting.open === undefined ? null : Boolean(meeting.open),
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
      allOpen: meetings.length > 0 && meetings.every((meeting) => meeting.open === true),
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
      return meetings.filter((meeting) => (!constraint.day || meeting.day === constraint.day)
        && (meeting.start < constraint.start || meeting.end > constraint.end)).length;
    }
    if (constraint.kind === "compact_schedule" || constraint.kind === "maximum_gap") return Math.max(0, metrics.maximumGap - constraint.maximumGap);
    if (constraint.kind === "campus") return metrics.campuses.includes(constraint.campus) ? 0 : 1;
    if (constraint.kind === "modality") return metrics.modalities.includes(constraint.modality) ? 0 : 1;
    if (constraint.kind === "open_sections") return constraint.open === metrics.allOpen ? 0 : 1;
    return 0;
  }

  function evaluate(schedule, preferences, fallback) {
    const metrics = scheduleMetrics(schedule);
    const violatedHardConstraints = [];
    let hardMagnitude = 0;
    let totalPenalty = 0;
    for (const constraint of preferences.constraints) {
      const amount = violation(constraint, metrics);
      if (!amount) continue;
      if (constraint.strength === "hard") {
        violatedHardConstraints.push(constraint.kind);
        hardMagnitude += amount;
      } else totalPenalty += amount;
    }
    return {
      ...schedule, stableIndex: stableIndex(schedule, fallback), metrics,
      totalPenalty, hardMagnitude, violatedHardConstraints,
    };
  }

  function sortRanked(entries, includeHard = true) {
    return [...entries].sort((a, b) => {
      if (includeHard && a.violatedHardConstraints.length !== b.violatedHardConstraints.length) return a.violatedHardConstraints.length - b.violatedHardConstraints.length;
      if (a.totalPenalty !== b.totalPenalty) return a.totalPenalty - b.totalPenalty;
      return a.stableIndex - b.stableIndex;
    });
  }

  function rankSchedules(schedules, rawPreferences) {
    const preferences = normalizePreferenceSet(rawPreferences);
    return sortRanked((Array.isArray(schedules) ? schedules : []).map((schedule, index) => evaluate(schedule, preferences, index + 1)));
  }

  function recommendSchedules(schedules, rawPreferences) {
    const ranked = rankSchedules(schedules, rawPreferences);
    const matches = ranked.filter((item) => item.violatedHardConstraints.length === 0).slice(0, 3);
    if (matches.length) return { matches, tradeoffs: [], conflictSummary: null };
    if (!ranked.length) return { matches: [], tradeoffs: [], conflictSummary: { impossible: true, constraints: [] } };
    const fewestViolations = ranked[0].violatedHardConstraints.length;
    const tradeoffs = ranked.filter((item) => item.violatedHardConstraints.length === fewestViolations).slice(0, 3);
    const constraints = [...new Set(tradeoffs.flatMap((item) => item.violatedHardConstraints))];
    return {
      matches: [], tradeoffs,
      conflictSummary: { impossible: true, constraints, message: "No schedule satisfies every hard constraint." },
    };
  }

  root.ScheduleRUPreferenceLogic = { normalizePreferenceSet, mergePreferencePatch, scheduleMetrics, rankSchedules, recommendSchedules };
})(globalThis);
