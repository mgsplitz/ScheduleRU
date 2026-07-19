const PROGRAM_TYPES = new Set(["major", "minor", "concentration", "certificate"]);

export const DEFAULT_PROGRAM_TYPE_SECTIONS = Object.freeze([
  Object.freeze({ type: "major", label: "Majors", singular: "Major" }),
  Object.freeze({ type: "minor", label: "Minors", singular: "Minor" }),
  Object.freeze({ type: "concentration", label: "Concentrations and tracks", singular: "Concentration or track" }),
  Object.freeze({ type: "certificate", label: "Certificates", singular: "Certificate" }),
]);

function nonEmptyText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeJsonObject(value) {
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function reviewedProgramTypeSections(value) {
  if (!Array.isArray(value)) return [...DEFAULT_PROGRAM_TYPE_SECTIONS];
  const byType = new Map();
  for (const item of value) {
    if (!item || typeof item !== "object" || !PROGRAM_TYPES.has(item.type) || byType.has(item.type)) continue;
    const fallback = DEFAULT_PROGRAM_TYPE_SECTIONS.find((section) => section.type === item.type);
    byType.set(item.type, {
      type: item.type,
      label: nonEmptyText(item.label, fallback.label),
      singular: nonEmptyText(item.singular, fallback.singular),
    });
  }
  return DEFAULT_PROGRAM_TYPE_SECTIONS.map((section) => byType.get(section.type) || section);
}

function reviewedReferenceTypes(value) {
  if (!Array.isArray(value)) return ["major"];
  const types = value.filter((type) => PROGRAM_TYPES.has(type));
  return types.length ? [...new Set(types)] : ["major"];
}

// Only reviewed public fields leave the Worker. This makes malformed future
// configuration fail closed to plain, generic terminology rather than
// changing the planner's behavior unexpectedly.
export function publicSchoolProfile(row) {
  const configuration = safeJsonObject(row?.configuration_json);
  return {
    slug: nonEmptyText(row?.slug),
    institution_slug: nonEmptyText(row?.institution_slug),
    campus_slug: nonEmptyText(row?.campus_slug),
    name: nonEmptyText(row?.name),
    short_name: nonEmptyText(row?.short_name, nonEmptyText(row?.name)),
    catalog_year: nonEmptyText(row?.catalog_year),
    source_url: nonEmptyText(row?.source_url),
    source_title: nonEmptyText(row?.source_title),
    context: {
      defaultProgramId: nonEmptyText(configuration.default_program_id) || null,
      advisingLabel: nonEmptyText(configuration.advising_label, "your school advising office"),
      sharedRequirementReferenceTypes: reviewedReferenceTypes(configuration.shared_requirement_reference_types),
      coreFallbackLabel: nonEmptyText(configuration.core_fallback_label, "Core Curriculum"),
      coreIntro: nonEmptyText(configuration.core_intro, "Completed, scheduled, and eligible AP-equivalent courses are allocated automatically to maximize completed curriculum goals. Click any course for details."),
      programTypeSections: reviewedProgramTypeSections(configuration.program_type_sections),
    },
  };
}
