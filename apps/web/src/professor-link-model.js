/* Shared external-link rules for instructor names supplied by section data. */
(function exposeProfessorLinkModel(root) {
  const RATINGS_SEARCH_BASE = "https://www.ratemyprofessors.com/search/professors/825";
  const GENERIC_INSTRUCTOR = /^(?:staff(?:\s*\/\s*tba)?|tba|to be announced|instructor\s+tba)$/i;

  function instructorName(value) {
    if (value && typeof value === "object") value = value.name || value.fullName || value.instructor;
    const name = String(value || "").replace(/\s+/g, " ").trim();
    return name && !GENERIC_INSTRUCTOR.test(name) ? name : "";
  }

  function ratingsSearchUrl(value) {
    const name = instructorName(value);
    if (!name) return "";
    const params = new URLSearchParams({ q: name });
    return `${RATINGS_SEARCH_BASE}?${params.toString()}`;
  }

  function distinctNamedInstructors(course = {}) {
    const values = [course.instructor, ...(course.instructors || [])];
    for (const section of course.sections || []) values.push(section?.instructor);
    const names = [];
    const seen = new Set();
    for (const value of values) {
      const name = instructorName(value);
      const key = name.toLocaleLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      names.push(name);
    }
    return names;
  }

  root.ScheduleRUProfessorLinkModel = {
    distinctNamedInstructors,
    instructorName,
    ratingsSearchUrl,
  };
})(globalThis);
