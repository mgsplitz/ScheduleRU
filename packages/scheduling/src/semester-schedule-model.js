/*
 * Deterministic meeting-time and section-permutation logic. This module owns
 * no DOM, browser state, network access, campus data, or presentation rules.
 */
(function exposeSemesterScheduleModel(root) {
  function dayIndex(value) {
    const days = {
      M: 0, MON: 0, MONDAY: 0,
      T: 1, TU: 1, TUE: 1, TUESDAY: 1,
      W: 2, WED: 2, WEDNESDAY: 2,
      H: 3, TH: 3, THU: 3, THURSDAY: 3,
      F: 4, FRI: 4, FRIDAY: 4,
      S: 5, SA: 5, SAT: 5, SATURDAY: 5,
      U: 6, SU: 6, SUN: 6, SUNDAY: 6,
    };
    return days[String(value || "").toUpperCase().trim()];
  }

  function parseRutgersClock(value) {
    const match = String(value || "").trim().match(/^(\d{1,2})(?::?(\d{2}))?\s*([AP]M)?$/i);
    if (!match) return null;
    let hour = Number(match[1]);
    const minute = Number(match[2] || 0);
    if (!Number.isInteger(hour) || !Number.isInteger(minute)
      || hour < 1 || hour > 12 || minute > 59) return null;
    const suffix = (match[3] || "").toUpperCase();
    if (suffix) {
      if (suffix === "PM" && hour !== 12) hour += 12;
      if (suffix === "AM" && hour === 12) hour = 0;
      return { minutes: hour * 60 + minute, explicit: true };
    }
    return { hour, minute, explicit: false };
  }

  function compactRutgersMinutes(clock) {
    if (clock.explicit) return clock.minutes;
    if (clock.hour === 12) return 12 * 60 + clock.minute;
    return (clock.hour >= 8 ? clock.hour : clock.hour + 12) * 60 + clock.minute;
  }

  function meetingTimeRange(meeting) {
    const startClock = parseRutgersClock(meeting?.start_time);
    const endClock = parseRutgersClock(meeting?.end_time);
    if (!startClock || !endClock) return null;
    const start = compactRutgersMinutes(startClock);
    let end = compactRutgersMinutes(endClock);
    if (!endClock.explicit && end <= start) end += 12 * 60;
    return end > start ? { start, end } : null;
  }

  function formatClock(minutes) {
    const normalized = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hour = Math.floor(normalized / 60);
    const minute = normalized % 60;
    const displayHour = (hour % 12) || 12;
    return `${displayHour}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
  }

  function meetingsConflict(left, right) {
    const leftDay = dayIndex(left?.day_of_week);
    const rightDay = dayIndex(right?.day_of_week);
    if (leftDay == null || rightDay == null || leftDay !== rightDay) return false;
    const leftRange = meetingTimeRange(left);
    const rightRange = meetingTimeRange(right);
    if (!leftRange || !rightRange) return false;
    return leftRange.start < rightRange.end && rightRange.start < leftRange.end;
  }

  function comboConflicts(combo, section) {
    return combo.some((selected) => (selected.meetings || []).some((left) =>
      (section.meetings || []).some((right) => meetingsConflict(left, right))));
  }

  function buildPermutations(pool, maximum = 500) {
    const required = (pool || []).filter((course) => course.enabled !== false);
    if (!required.length) return { combos: [], blockers: [], required };
    const blockers = required.filter((course) =>
      course.loading
      || (course.error && !(course.sections || []).length)
      || !(course.sections || []).length
      || !course.checked
      || course.checked.size === 0);
    if (blockers.length) return { combos: [], blockers, required };

    let combos = [[]];
    for (const course of required) {
      const options = (course.sections || []).filter((item) =>
        course.checked.has(item.index_number));
      const next = [];
      for (const combo of combos) {
        for (const selected of options) {
          if (!comboConflicts(combo, selected)) {
            next.push([
              ...combo,
              {
                code: course.code,
                title: course.title,
                credits: course.credits,
                ...selected,
              },
            ]);
          }
        }
      }
      combos = next;
      if (!combos.length) break;
    }
    return {
      combos: combos.length > maximum ? combos.slice(0, maximum) : combos,
      blockers: [],
      required,
    };
  }

  root.ScheduleRUSemesterScheduleModel = {
    dayIndex,
    meetingTimeRange,
    formatClock,
    meetingsConflict,
    buildPermutations,
  };
})(globalThis);
