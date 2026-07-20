/*
 * Reviewed course-selector logic shared by the browser and unit tests.
 *
 * Requirement groups normally list every approved course. Some official
 * Rutgers rules instead use a source-backed range, such as “any 300/400-level
 * Political Science course.” This module supports only explicit, auditable
 * selector shapes. Unknown or malformed data never matches a course.
 */
(function exposeCourseSelectorLogic(root) {
  const COURSE_CODE = /^(\d{2}):(\d{3}):(\d{3})$/;

  function text(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function unique(values, validator) {
    return [...new Set((Array.isArray(values) ? values : [])
      .map(text)
      .filter((value) => validator(value)))];
  }

  function parseCourseCode(value) {
    const code = text(typeof value === "object" ? value?.code : value);
    const match = COURSE_CODE.exec(code);
    if (!match) return null;
    return {
      code,
      school_code: match[1],
      subject_code: match[2],
      course_number: Number(match[3]),
    };
  }

  function courseCodes(value) {
    return unique(value, (code) => COURSE_CODE.test(code));
  }

  function positiveCourseNumber(value) {
    const number = Number(value);
    return Number.isInteger(number) && number >= 0 && number <= 999 ? number : null;
  }

  function normalizeSelector(input) {
    if (!input || typeof input !== "object" || Array.isArray(input) || Number(input.version) !== 1) return null;
    const kind = text(input.kind);
    const label = text(input.label);
    const exclude_course_codes = courseCodes(input.exclude_course_codes);

    if (kind === "course_codes") {
      const include_course_codes = courseCodes(input.include_course_codes);
      if (!include_course_codes.length) return null;
      return { version: 1, kind, label, include_course_codes, exclude_course_codes };
    }

    if (kind === "subject_level") {
      const school_codes = unique(input.school_codes, (code) => /^\d{2}$/.test(code));
      const subject_codes = unique(input.subject_codes, (code) => /^\d{3}$/.test(code));
      const course_number_min = input.course_number_min === undefined ? 0 : positiveCourseNumber(input.course_number_min);
      const course_number_max = input.course_number_max === undefined ? 999 : positiveCourseNumber(input.course_number_max);
      if (!school_codes.length || !subject_codes.length || course_number_min === null || course_number_max === null || course_number_min > course_number_max) return null;
      return {
        version: 1, kind, label, school_codes, subject_codes,
        course_number_min, course_number_max, exclude_course_codes,
      };
    }

    return null;
  }

  function matchesSelector(course, rawSelector) {
    const selector = normalizeSelector(rawSelector);
    const parsed = parseCourseCode(course);
    if (!selector || !parsed || selector.exclude_course_codes.includes(parsed.code)) return false;
    if (selector.kind === "course_codes") return selector.include_course_codes.includes(parsed.code);
    return selector.school_codes.includes(parsed.school_code)
      && selector.subject_codes.includes(parsed.subject_code)
      && parsed.course_number >= selector.course_number_min
      && parsed.course_number <= selector.course_number_max;
  }

  function matchesAnySelector(course, selectors) {
    return (Array.isArray(selectors) ? selectors : []).some((selector) => matchesSelector(course, selector));
  }

  function selectorDescription(rawSelector) {
    const selector = normalizeSelector(rawSelector);
    if (!selector) return "A reviewed course rule needs correction before it can be applied.";
    if (selector.label) return selector.label;
    if (selector.kind === "course_codes") return `${selector.include_course_codes.length} specifically approved course${selector.include_course_codes.length === 1 ? "" : "s"}`;
    const level = selector.course_number_min === 0 && selector.course_number_max === 999
      ? ""
      : `${selector.course_number_min}-${selector.course_number_max} level `;
    return `Any reviewed ${level}course in subject ${selector.subject_codes.join(", ")}`;
  }

  // Used only to decide whether a nested requirement acts as a constraint on
  // its parent. If a selector cannot be proved to be a subset, return false
  // and let a reviewer encode a safer explicit relationship.
  function selectorIsSubset(rawChild, rawParent) {
    const child = normalizeSelector(rawChild);
    const parent = normalizeSelector(rawParent);
    if (!child || !parent || parent.exclude_course_codes.length) return false;
    if (child.kind === "course_codes") return child.include_course_codes.every((code) => matchesSelector(code, parent));
    if (child.kind === "subject_level" && parent.kind === "subject_level") {
      return child.school_codes.every((code) => parent.school_codes.includes(code))
        && child.subject_codes.every((code) => parent.subject_codes.includes(code))
        && child.course_number_min >= parent.course_number_min
        && child.course_number_max <= parent.course_number_max
        && !child.exclude_course_codes.length;
    }
    return false;
  }

  root.ScheduleRUCourseSelectorLogic = {
    parseCourseCode,
    normalizeSelector,
    matchesSelector,
    matchesAnySelector,
    selectorDescription,
    selectorIsSubset,
  };
})(globalThis);
