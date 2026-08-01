import type { ReferenceDataBundle } from "./model.ts";
import { assertReferenceDataBundle } from "./validation.ts";

export interface ReferenceDataPreparedStatement {
  bind(...values: unknown[]): ReferenceDataPreparedStatement;
}

export interface ReferenceDataDatabase {
  prepare(sql: string): ReferenceDataPreparedStatement;
  batch(statements: ReferenceDataPreparedStatement[]): Promise<unknown[]>;
}

export interface ReferenceDataPublishResult {
  row_counts: {
    school_profiles: number;
    school_curriculum_modules: number;
    program_selection_limits: number;
    program_combination_policies: number;
    double_count_rules: number;
    double_count_policies: number;
    double_count_exceptions: number;
    requirement_course_equivalencies: number;
    ap_equivalencies: number;
    course_eligibility_reviews: number;
    course_eligibility_conditions: number;
  };
  statement_count: number;
}

function statement(
  database: ReferenceDataDatabase,
  sql: string,
  ...values: unknown[]
): ReferenceDataPreparedStatement {
  return database.prepare(sql).bind(...values);
}

function ordered<T>(values: T[]): T[] {
  return [...values].sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right))
  );
}

export async function publishReferenceDataBundle(
  database: ReferenceDataDatabase,
  value: unknown,
): Promise<ReferenceDataPublishResult> {
  const bundle = assertReferenceDataBundle(value);
  const statements: ReferenceDataPreparedStatement[] = [
    statement(database, "DELETE FROM course_eligibility_conditions"),
    statement(database, "DELETE FROM course_eligibility_reviews"),
    statement(database, "DELETE FROM ap_equivalencies"),
    statement(database, "DELETE FROM requirement_course_equivalencies"),
    statement(database, "DELETE FROM double_count_exceptions"),
    statement(database, "DELETE FROM double_count_policies"),
    statement(database, "DELETE FROM double_count_rules"),
    statement(database, "DELETE FROM program_combination_policies"),
    statement(database, "DELETE FROM program_selection_limits"),
    statement(database, "DELETE FROM school_curriculum_modules"),
    statement(database, "DELETE FROM school_profiles"),
  ];

  for (const row of ordered(bundle.school_profiles)) {
    statements.push(statement(
      database,
      `INSERT INTO school_profiles (
         slug, institution_slug, campus_slug, name, short_name, catalog_year,
         configuration_json, source_url, source_title, review_status,
         reviewed_at, sort_order
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.slug,
      row.institution_slug,
      row.campus_slug,
      row.name,
      row.short_name,
      row.catalog_year,
      JSON.stringify(row.configuration),
      row.source_url,
      row.source_title,
      row.review_status,
      row.reviewed_at,
      row.sort_order,
    ));
  }
  for (const row of ordered(bundle.school_curriculum_modules)) {
    statements.push(statement(
      database,
      `INSERT INTO school_curriculum_modules (
         school_slug, module_type, curriculum_program_id, source_url,
         review_status, reviewed_at, sort_order
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      row.school_slug,
      row.module_type,
      row.curriculum_program_id,
      row.source_url,
      row.review_status,
      row.reviewed_at,
      row.sort_order,
    ));
  }
  for (const row of ordered(bundle.program_selection_limits)) {
    statements.push(statement(
      database,
      `INSERT INTO program_selection_limits (
         home_school_slug, program_type, max_selected, note, source_url,
         verified_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      row.home_school_slug,
      row.program_type,
      row.max_selected,
      row.note,
      row.source_url,
      row.verified_at,
    ));
  }
  for (const row of ordered(bundle.program_combination_policies)) {
    statements.push(statement(
      database,
      `INSERT INTO program_combination_policies (
         policy_key, home_school_slug, program_a_id, program_a_school_slug,
         program_a_type, program_b_id, program_b_school_slug, program_b_type,
         same_program_family, decision, note, source_url, verified_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.policy_key,
      row.home_school_slug,
      row.program_a_id,
      row.program_a_school_slug,
      row.program_a_type,
      row.program_b_id,
      row.program_b_school_slug,
      row.program_b_type,
      row.same_program_family ? 1 : 0,
      row.decision,
      row.note,
      row.source_url,
      row.verified_at,
    ));
  }
  for (const row of ordered(bundle.double_count_rules)) {
    statements.push(statement(
      database,
      `INSERT INTO double_count_rules (
         program_a, program_b, max_shared_credits, note
       ) VALUES (?, ?, ?, ?)`,
      row.program_a,
      row.program_b,
      row.max_shared_credits,
      row.note,
    ));
  }
  for (const row of ordered(bundle.double_count_policies)) {
    statements.push(statement(
      database,
      `INSERT INTO double_count_policies (
         school_slug, scope, max_shared_courses, note, source_url, verified_at
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      row.school_slug,
      row.scope,
      row.max_shared_courses,
      row.note,
      row.source_url,
      row.verified_at,
    ));
  }
  for (const row of ordered(bundle.double_count_exceptions)) {
    statements.push(statement(
      database,
      `INSERT INTO double_count_exceptions (
         program_a, program_b, allowed_course_codes_json, note, source_url,
         review_status, verified_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      row.program_a,
      row.program_b,
      JSON.stringify([...row.allowed_course_codes].sort()),
      row.note,
      row.source_url,
      row.review_status,
      row.verified_at,
    ));
  }
  for (const row of ordered(bundle.requirement_course_equivalencies)) {
    statements.push(statement(
      database,
      `INSERT INTO requirement_course_equivalencies (
         program_id, requirement_course_code, equivalent_course_code, note,
         source_label, review_status
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      row.program_id,
      row.requirement_course_code,
      row.equivalent_course_code,
      row.note,
      row.source_label,
      row.review_status,
    ));
  }
  for (const row of ordered(bundle.ap_equivalencies)) {
    statements.push(statement(
      database,
      `INSERT INTO ap_equivalencies (
         id, exam_name, minimum_score, maximum_score, credits,
         equivalent_course_codes_json, fulfills_requirement_ids_json,
         catalog_year, campus, source_url, review_status, reviewed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.exam_name,
      row.minimum_score,
      row.maximum_score,
      row.credits,
      JSON.stringify([...row.equivalent_course_codes].sort()),
      JSON.stringify([...row.fulfills_requirement_ids].sort()),
      row.catalog_year,
      row.campus,
      row.source_url,
      row.review_status,
      row.reviewed_at,
    ));
  }
  for (const row of ordered(bundle.course_eligibility_reviews)) {
    statements.push(statement(
      database,
      `INSERT INTO course_eligibility_reviews (
         course_code, campus_slug, catalog_year, review_status,
         no_known_conditions, source_url, source_label, source_date,
         reviewed_at, note
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.course_code,
      row.campus_slug,
      row.catalog_year,
      row.review_status,
      row.no_known_conditions ? 1 : 0,
      row.source_url,
      row.source_label,
      row.source_date,
      row.reviewed_at,
      row.note,
    ));
  }
  for (const row of ordered(bundle.course_eligibility_conditions)) {
    statements.push(statement(
      database,
      `INSERT INTO course_eligibility_conditions (
         course_code, condition_key, condition_type, condition_value_json,
         review_status, source_url, source_label, source_date, reviewed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.course_code,
      row.condition_key,
      row.condition_type,
      JSON.stringify(row.condition_value),
      row.review_status,
      row.source_url,
      row.source_label,
      row.source_date,
      row.reviewed_at,
    ));
  }

  await database.batch(statements);
  return {
    row_counts: {
      school_profiles: bundle.school_profiles.length,
      school_curriculum_modules: bundle.school_curriculum_modules.length,
      program_selection_limits: bundle.program_selection_limits.length,
      program_combination_policies: bundle.program_combination_policies.length,
      double_count_rules: bundle.double_count_rules.length,
      double_count_policies: bundle.double_count_policies.length,
      double_count_exceptions: bundle.double_count_exceptions.length,
      requirement_course_equivalencies:
        bundle.requirement_course_equivalencies.length,
      ap_equivalencies: bundle.ap_equivalencies.length,
      course_eligibility_reviews: bundle.course_eligibility_reviews.length,
      course_eligibility_conditions: bundle.course_eligibility_conditions.length,
    },
    statement_count: statements.length,
  };
}
