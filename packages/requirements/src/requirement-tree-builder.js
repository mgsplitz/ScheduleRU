/*
 * Converts API requirement roots into the normalized course/group tree used
 * by planner and requirement engines. This module has no browser or network
 * dependencies and does not mutate the reviewed API payload.
 */
(function exposeRequirementTreeBuilder(root) {
  function cleanText(raw) {
    if (!raw) return "";
    return String(raw)
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, "\"")
      .replace(/&#0?39;/gi, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function requirementCourseId(code) {
    return String(code || "").replace(/[^0-9A-Za-z]/g, "");
  }

  function prerequisiteIds(row, courseId, availableCourses) {
    const text = String(row?.note || "").trim();
    if (!/^pre-reqs?:/i.test(text) || /;|\bor\b/i.test(text)) return [];
    const codes = text.match(/\b\d{2}:\d{3}:\d{3}\b/g) || [];
    return [...new Set(codes.map(requirementCourseId))]
      .filter((id) => id && id !== courseId && availableCourses[id]);
  }

  function normalizeRule(rule) {
    const rules = {
      min_courses: "min",
      max_courses: "max",
      min_credits: "min_credits",
      max_credits: "max_credits",
      min_distinct_children: "distinct",
      one_of: "one_of",
    };
    return rules[rule] || "all";
  }

  function build(requirements) {
    const courses = {};
    const groups = {};
    const roots = [];
    const courseRows = [];

    function addGroup(raw, parentId = null, inheritedSourceProgramIds = []) {
      const sourceProgramIds = [...new Set([
        ...(Array.isArray(raw?.sourceProgramIds) ? raw.sourceProgramIds : []),
        ...inheritedSourceProgramIds,
      ].filter(Boolean))];
      const group = {
        id: raw.id,
        name: raw.name,
        rule: normalizeRule(raw.rule),
        count: raw.count,
        parentId,
        members: [],
        children: [],
        sourceProgramId: raw.program_id,
        sourceProgramIds,
        display_family: cleanText(raw.display_family),
        display_priority: Number(raw.display_priority) || 0,
        allocation: raw.allocation,
        courseSelectors: Array.isArray(raw.course_selectors) ? raw.course_selectors : [],
      };
      groups[group.id] = group;

      for (const row of raw.courses || []) {
        const id = requirementCourseId(row.course_code);
        if (!id) continue;
        const existing = courses[id];
        const sourceTitle = cleanText(row.source_title);
        const catalogTitle = cleanText(row.catalog_title);
        const sourceCredits = cleanText(row.source_credits);
        const note = cleanText(row.note);
        const alternatives = [
          ...(existing?.alternatives || []),
          ...(row.alternatives || []).map((alternative) => ({
            code: cleanText(alternative.equivalent_course_code) || cleanText(alternative.code),
            title: cleanText(alternative.catalog_title) || cleanText(alternative.source_title),
            credits: cleanText(alternative.catalog_credits),
            note: cleanText(alternative.note),
            sourceLabel: cleanText(alternative.source_label),
          })),
        ];
        courses[id] = {
          ...existing,
          code: row.course_code,
          title: catalogTitle || sourceTitle || existing?.title || row.course_code,
          fullTitle: catalogTitle || sourceTitle || existing?.fullTitle || row.course_code,
          credits: sourceCredits || cleanText(row.catalog_credits) || existing?.credits || "",
          description: cleanText(row.catalog_description) || existing?.description || "",
          catalogPrereqs: cleanText(row.catalog_prereqs) || existing?.catalogPrereqs || "",
          subjectNotes: cleanText(row.catalog_subject_notes) || existing?.subjectNotes || "",
          restrictions: cleanText(row.section_restrictions) || existing?.restrictions || "",
          catalogRecordAvailable: !!(
            catalogTitle
            || row.catalog_description
            || row.catalog_prereqs
            || row.catalog_subject_notes
          ),
          requirementNotes: [...new Set([
            ...(existing?.requirementNotes || []),
            note,
          ].filter(Boolean))],
          prereqs: existing?.prereqs || [],
          eligibility: row.eligibility || existing?.eligibility || null,
          alternatives: [...new Map(
            alternatives.filter((alternative) => alternative.code)
              .map((alternative) => [alternative.code, alternative]),
          ).values()],
        };
        group.members.push(id);
        courseRows.push({ id, row });
      }

      for (const child of raw.children || []) {
        group.children.push(addGroup(child, group.id, sourceProgramIds));
      }
      return group.id;
    }

    for (const requirementRoot of requirements || []) roots.push(addGroup(requirementRoot));
    for (const { id, row } of courseRows) {
      courses[id].prereqs = [...new Set([
        ...(courses[id].prereqs || []),
        ...prerequisiteIds(row, id, courses),
      ])];
    }
    return { courses, groups, roots };
  }

  root.ScheduleRURequirementTreeBuilder = {
    requirementCourseId,
    build,
  };
})(globalThis);
