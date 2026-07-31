function isNonblankString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isReviewedHttpsSource(value) {
  if (!isNonblankString(value) || value !== value.trim()) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function hasAccessedTimestamp(value) {
  return Number.isInteger(value) && value > 0;
}

function validEvidenceRow(row, expected) {
  if (!row || row.entity_key !== expected.entity_key || row.entity_type !== expected.entity_type) return false;
  if (row.group_id !== expected.group_id || row.course_code !== expected.course_code) return false;
  return row.review_status === "reviewed"
    && isReviewedHttpsSource(row.source_url)
    && isNonblankString(row.source_title)
    && hasAccessedTimestamp(row.accessed_at)
    && isNonblankString(row.reviewer_note);
}

function requiredEvidenceEntries(groups, courses) {
  return [
    ...groups.map(({ id }) => ({
      entity_key: `group:${id}`,
      entity_type: "group",
      group_id: id,
      course_code: null,
    })),
    ...courses.map(({ group_id, course_code }) => ({
      entity_key: `course:${group_id}:${course_code}`,
      entity_type: "course",
      group_id,
      course_code,
    })),
  ];
}

export function missingRequirementEvidence({ groups = [], courses = [], evidence = [] } = {}) {
  const entries = requiredEvidenceEntries(Array.isArray(groups) ? groups : [], Array.isArray(courses) ? courses : []);
  const evidenceRows = Array.isArray(evidence) ? evidence : [];

  return entries
    .filter((entry) => {
      const matchingRows = evidenceRows.filter((row) => row?.entity_key === entry.entity_key);
      return matchingRows.length !== 1 || !validEvidenceRow(matchingRows[0], entry);
    })
    .map((entry) => entry.entity_key);
}

export function requirementEvidenceComplete({ required, groups = [], courses = [], evidence = [] } = {}) {
  if (!required) return true;
  return missingRequirementEvidence({ groups, courses, evidence }).length === 0;
}
