import type {
  DoubleCountException,
  DoubleCountRule,
  ProgramCombinationPolicy,
  ProgramSelectionLimit,
  ReferenceDataBundle,
  RequirementCourseEquivalency,
  SchoolCurriculumModule,
  SchoolProfile,
  ValidationIssue,
} from "./model.ts";
import { validateReferenceDataBundle } from "./validation.ts";

type Row = Record<string, unknown>;

export interface ReferenceDataReadPreparedStatement {
  bind(...values: unknown[]): ReferenceDataReadPreparedStatement;
  all<T = Row>(): Promise<{ results?: T[] } | T[]>;
}

export interface ReferenceDataReadDatabase {
  prepare(sql: string): ReferenceDataReadPreparedStatement;
}

export class ReferenceDataExportValidationError extends TypeError {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(
      issues
        .map((issue) => `${issue.path} [${issue.code}]: ${issue.message}`)
        .join("; "),
    );
    this.name = "ReferenceDataExportValidationError";
    this.issues = issues;
  }
}

async function allRows(
  database: ReferenceDataReadDatabase,
  sql: string,
): Promise<Row[]> {
  const result = await database.prepare(sql).bind().all<Row>();
  return Array.isArray(result)
    ? result
    : (Array.isArray(result.results) ? result.results : []);
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function integerValue(value: unknown): number {
  const result = Number(value);
  return Number.isInteger(result) ? result : 0;
}

function parseJson(value: unknown, path: string): unknown {
  if (typeof value !== "string") {
    throw new TypeError(`${path}: invalid JSON`);
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new TypeError(`${path}: invalid JSON`);
  }
}

export async function exportReferenceDataBundle(
  database: ReferenceDataReadDatabase,
): Promise<ReferenceDataBundle> {
  const [
    profileRows,
    moduleRows,
    limitRows,
    policyRows,
    doubleCountRuleRows,
    doubleCountExceptionRows,
    equivalencyRows,
  ] = await Promise.all([
    allRows(
      database,
      `/* reference-data-export:school-profiles */
       SELECT slug, institution_slug, campus_slug, name, short_name,
              catalog_year, configuration_json, source_url, source_title,
              review_status, reviewed_at, sort_order
       FROM school_profiles
       ORDER BY slug`,
    ),
    allRows(
      database,
      `/* reference-data-export:curriculum-modules */
       SELECT school_slug, module_type, curriculum_program_id, source_url,
              review_status, reviewed_at, sort_order
       FROM school_curriculum_modules
       ORDER BY school_slug, module_type`,
    ),
    allRows(
      database,
      `/* reference-data-export:selection-limits */
       SELECT home_school_slug, program_type, max_selected, note, source_url,
              verified_at
       FROM program_selection_limits
       ORDER BY home_school_slug, program_type`,
    ),
    allRows(
      database,
      `/* reference-data-export:combination-policies */
       SELECT policy_key, home_school_slug, program_a_id,
              program_a_school_slug, program_a_type, program_b_id,
              program_b_school_slug, program_b_type, same_program_family,
              decision, note, source_url, verified_at
       FROM program_combination_policies
       ORDER BY policy_key`,
    ),
    allRows(
      database,
      `/* reference-data-export:double-count-rules */
       SELECT program_a, program_b, max_shared_credits, note
       FROM double_count_rules
       ORDER BY program_a, program_b`,
    ),
    allRows(
      database,
      `/* reference-data-export:double-count-exceptions */
       SELECT program_a, program_b, allowed_course_codes_json, note,
              source_url, review_status, verified_at
       FROM double_count_exceptions
       ORDER BY program_a, program_b`,
    ),
    allRows(
      database,
      `/* reference-data-export:equivalencies */
       SELECT program_id, requirement_course_code, equivalent_course_code,
              note, source_label, review_status
       FROM requirement_course_equivalencies
       ORDER BY program_id, requirement_course_code, equivalent_course_code`,
    ),
  ]);

  const schoolProfiles: SchoolProfile[] = profileRows.map((row, index) => ({
    slug: stringValue(row.slug),
    institution_slug: stringValue(row.institution_slug),
    campus_slug: stringValue(row.campus_slug),
    name: stringValue(row.name),
    short_name: stringValue(row.short_name),
    catalog_year: nullableString(row.catalog_year),
    configuration: parseJson(
      row.configuration_json,
      `school_profiles[${index}].configuration_json`,
    ) as Record<string, unknown>,
    source_url: stringValue(row.source_url),
    source_title: stringValue(row.source_title),
    review_status: stringValue(row.review_status) as SchoolProfile["review_status"],
    reviewed_at: nullableNumber(row.reviewed_at),
    sort_order: integerValue(row.sort_order),
  }));
  const modules: SchoolCurriculumModule[] = moduleRows.map((row) => ({
    school_slug: stringValue(row.school_slug),
    module_type: stringValue(row.module_type) as "core_curriculum",
    curriculum_program_id: stringValue(row.curriculum_program_id),
    source_url: stringValue(row.source_url),
    review_status: stringValue(row.review_status) as SchoolCurriculumModule["review_status"],
    reviewed_at: nullableNumber(row.reviewed_at),
    sort_order: integerValue(row.sort_order),
  }));
  const limits: ProgramSelectionLimit[] = limitRows.map((row) => ({
    home_school_slug: stringValue(row.home_school_slug),
    program_type: stringValue(row.program_type),
    max_selected: integerValue(row.max_selected),
    note: stringValue(row.note),
    source_url: stringValue(row.source_url),
    verified_at: integerValue(row.verified_at),
  }));
  const policies: ProgramCombinationPolicy[] = policyRows.map((row) => ({
    policy_key: stringValue(row.policy_key),
    home_school_slug: stringValue(row.home_school_slug),
    program_a_id: nullableString(row.program_a_id),
    program_a_school_slug: nullableString(row.program_a_school_slug),
    program_a_type: nullableString(row.program_a_type),
    program_b_id: nullableString(row.program_b_id),
    program_b_school_slug: nullableString(row.program_b_school_slug),
    program_b_type: nullableString(row.program_b_type),
    same_program_family: Number(row.same_program_family) === 1,
    decision: stringValue(row.decision) as ProgramCombinationPolicy["decision"],
    note: stringValue(row.note),
    source_url: stringValue(row.source_url),
    verified_at: integerValue(row.verified_at),
  }));
  const doubleCountRules: DoubleCountRule[] = doubleCountRuleRows.map((row) => ({
    program_a: stringValue(row.program_a),
    program_b: stringValue(row.program_b),
    max_shared_credits: nullableNumber(row.max_shared_credits),
    note: nullableString(row.note),
  }));
  const doubleCountExceptions: DoubleCountException[] =
    doubleCountExceptionRows.map((row, index) => ({
      program_a: stringValue(row.program_a),
      program_b: stringValue(row.program_b),
      allowed_course_codes: parseJson(
        row.allowed_course_codes_json,
        `double_count_exceptions[${index}].allowed_course_codes_json`,
      ) as string[],
      note: nullableString(row.note),
      source_url: nullableString(row.source_url),
      review_status: stringValue(row.review_status) as DoubleCountException["review_status"],
      verified_at: nullableNumber(row.verified_at),
    }));
  const equivalencies: RequirementCourseEquivalency[] = equivalencyRows.map(
    (row) => ({
      program_id: stringValue(row.program_id),
      requirement_course_code: stringValue(row.requirement_course_code),
      equivalent_course_code: stringValue(row.equivalent_course_code),
      note: nullableString(row.note),
      source_label: nullableString(row.source_label),
      review_status: stringValue(row.review_status) as RequirementCourseEquivalency["review_status"],
    }),
  );

  const value = {
    contract_version: 1,
    school_profiles: schoolProfiles,
    school_curriculum_modules: modules,
    program_selection_limits: limits,
    program_combination_policies: policies,
    double_count_rules: doubleCountRules,
    double_count_exceptions: doubleCountExceptions,
    requirement_course_equivalencies: equivalencies,
  };
  const result = validateReferenceDataBundle(value);
  if (!result.ok) throw new ReferenceDataExportValidationError(result.issues);
  return result.value;
}
