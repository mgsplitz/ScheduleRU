import type {
  CourseSelector,
  EvidenceDefinition,
  ProgramDefinition,
  ProgramEligibilityRuleDefinition,
  ProgramSourceDefinition,
  RequirementConditionDefinition,
  RequirementCourseDefinition,
  RequirementGroupDefinition,
  RequirementRule,
  ValidationIssue,
} from "./model.ts";
import { validateProgramDefinition } from "./validation.ts";

type Row = Record<string, unknown>;

export interface CatalogReadPreparedStatement {
  bind(...values: unknown[]): CatalogReadPreparedStatement;
  first<T = Row>(): Promise<T | null>;
  all<T = Row>(): Promise<{ results?: T[] } | T[]>;
}

export interface CatalogReadDatabase {
  prepare(sql: string): CatalogReadPreparedStatement;
}

export class CatalogExportValidationError extends TypeError {
  readonly issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super(
      issues
        .map((issue) => `${issue.path} [${issue.code}]: ${issue.message}`)
        .join("; "),
    );
    this.name = "CatalogExportValidationError";
    this.issues = issues;
  }
}

interface SourceSeed {
  url: string;
  title: string;
  catalog_year: string | null;
  scope: string;
  accessed_at: number;
  note: string;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function integerValue(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function timestampValue(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function parseCredits(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseStoredJson(value: unknown, path: string): unknown {
  if (typeof value !== "string") {
    throw new TypeError(`${path}: invalid JSON`);
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new TypeError(`${path}: invalid JSON`);
  }
}

async function allRows(
  database: CatalogReadDatabase,
  sql: string,
  ...values: unknown[]
): Promise<Row[]> {
  const result = await database.prepare(sql).bind(...values).all<Row>();
  if (Array.isArray(result)) return result;
  return Array.isArray(result.results) ? result.results : [];
}

function sourceSeed(
  row: Row,
  defaults: Partial<SourceSeed> = {},
): SourceSeed | null {
  const url = stringValue(row.source_url ?? defaults.url);
  if (!url) return null;
  return {
    url,
    title:
      stringValue(row.source_title ?? defaults.title)
      || "Official Rutgers catalog source",
    catalog_year:
      nullableString(row.source_catalog_year)
      ?? defaults.catalog_year
      ?? null,
    scope:
      stringValue(row.source_scope ?? defaults.scope)
      || "program_requirements",
    accessed_at: timestampValue(row.accessed_at ?? defaults.accessed_at),
    note:
      stringValue(row.note ?? defaults.note)
      || "Exported from reviewed catalog data.",
  };
}

function mergeSource(
  sources: Map<string, SourceSeed>,
  candidate: SourceSeed | null,
): void {
  if (!candidate) return;
  const current = sources.get(candidate.url);
  if (!current) {
    sources.set(candidate.url, candidate);
    return;
  }
  sources.set(candidate.url, {
    url: current.url,
    title:
      current.title === "Official Rutgers catalog source"
        ? candidate.title
        : current.title,
    catalog_year: current.catalog_year ?? candidate.catalog_year,
    scope: current.scope || candidate.scope,
    accessed_at: Math.max(current.accessed_at, candidate.accessed_at),
    note:
      current.note === "Exported from reviewed catalog data."
        ? candidate.note
        : current.note,
  });
}

function buildSources(
  program: Row,
  sourceRows: Row[],
  evidenceRows: Row[],
  selectorRows: Row[],
  conditionRows: Row[],
  eligibilityRows: Row[],
): {
  definitions: ProgramSourceDefinition[];
  idsByUrl: Map<string, string>;
} {
  const seeds = new Map<string, SourceSeed>();
  for (const row of sourceRows) mergeSource(seeds, sourceSeed(row));
  for (const row of evidenceRows) mergeSource(seeds, sourceSeed(row));
  for (const row of selectorRows) {
    mergeSource(
      seeds,
      sourceSeed(row, {
        title: stringValue(row.source_label),
        accessed_at: timestampValue(row.reviewed_at),
      }),
    );
  }
  for (const row of conditionRows) mergeSource(seeds, sourceSeed(row));
  for (const row of eligibilityRows) {
    mergeSource(
      seeds,
      sourceSeed(row, { accessed_at: timestampValue(row.verified_at) }),
    );
  }
  mergeSource(
    seeds,
    sourceSeed(program, {
      title: `${stringValue(program.name)} requirements`,
      catalog_year: nullableString(program.catalog_year),
      accessed_at: timestampValue(program.last_scraped_at),
    }),
  );

  const idsByUrl = new Map<string, string>();
  const definitions = [...seeds.values()]
    .sort((left, right) => left.url.localeCompare(right.url))
    .map((seed, index) => {
      const id = `source-${String(index + 1).padStart(3, "0")}`;
      idsByUrl.set(seed.url, id);
      return { id, ...seed };
    });
  return { definitions, idsByUrl };
}

function sourceId(idsByUrl: Map<string, string>, row: Row, path: string): string {
  const url = stringValue(row.source_url);
  const id = idsByUrl.get(url);
  if (!id) throw new TypeError(`${path}: source URL was not exported`);
  return id;
}

function evidenceFromRow(
  row: Row | undefined,
  idsByUrl: Map<string, string>,
  path: string,
): EvidenceDefinition | undefined {
  if (!row) return undefined;
  return {
    source_id: sourceId(idsByUrl, row, `${path}.source_id`),
    reviewer_note: stringValue(row.reviewer_note),
    review_status: stringValue(row.review_status) as EvidenceDefinition["review_status"],
  };
}

function normalizedRule(value: unknown): RequirementRule {
  return (value === "max" ? "max_courses" : stringValue(value)) as RequirementRule;
}

export async function listReviewedProgramIds(
  database: CatalogReadDatabase,
): Promise<string[]> {
  const rows = await allRows(
    database,
    `/* catalog-export:reviewed-programs */
     SELECT id
     FROM programs
     WHERE review_status = 'reviewed'
     ORDER BY id`,
  );
  return rows
    .map((row) => stringValue(row.id))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

export async function exportProgramDefinition(
  database: CatalogReadDatabase,
  programId: string,
): Promise<ProgramDefinition> {
  const program = await database.prepare(
    `/* catalog-export:programs */
     SELECT id, name, school_slug, program_slug, type, catalog_year,
            academic_program_code, degree_type, program_family_id, source_url,
            review_status, last_scraped_at, requirement_evidence_required
     FROM programs
     WHERE id = ? AND review_status = 'reviewed'`,
  ).bind(programId).first<Row>();
  if (!program) throw new TypeError(`reviewed program not found: ${programId}`);

  const [
    sourceRows,
    groupRows,
    courseRows,
    selectorRows,
    conditionRows,
    evidenceRows,
    eligibilityRows,
  ] = await Promise.all([
    allRows(
      database,
      `/* catalog-export:sources */
       SELECT source_url, source_title, source_catalog_year, source_scope,
              accessed_at, note
       FROM program_sources
       WHERE program_id = ?
       ORDER BY source_url`,
      programId,
    ),
    allRows(
      database,
      `/* catalog-export:groups */
       SELECT id, parent_group_id, name, rule, count, sort_order,
              display_family, display_priority
       FROM requirement_groups
       WHERE program_id = ?
       ORDER BY sort_order, id`,
      programId,
    ),
    allRows(
      database,
      `/* catalog-export:courses */
       SELECT course.group_id, course.course_code, course.note,
              course.source_title, course.source_credits
       FROM requirement_courses course
       JOIN requirement_groups requirement ON requirement.id = course.group_id
       WHERE requirement.program_id = ?
       ORDER BY course.group_id, course.course_code`,
      programId,
    ),
    allRows(
      database,
      `/* catalog-export:selectors */
       SELECT selector.group_id, selector.selector_key, selector.selector_json,
              selector.source_url, selector.source_label,
              selector.review_status, selector.reviewed_at
       FROM requirement_course_selectors selector
       JOIN requirement_groups requirement ON requirement.id = selector.group_id
       WHERE requirement.program_id = ?
       ORDER BY selector.group_id, selector.selector_key`,
      programId,
    ),
    allRows(
      database,
      `/* catalog-export:conditions */
       SELECT condition.group_id, condition.condition_type,
              condition.condition_value_json, condition.note,
              condition.source_url, condition.review_status
       FROM requirement_group_conditions condition
       JOIN requirement_groups requirement ON requirement.id = condition.group_id
       WHERE requirement.program_id = ?
       ORDER BY condition.group_id, condition.condition_type, condition.id`,
      programId,
    ),
    allRows(
      database,
      `/* catalog-export:evidence */
       SELECT entity_type, group_id, course_code, source_url, source_title,
              source_catalog_year, accessed_at, reviewer_note, review_status
       FROM program_requirement_evidence
       WHERE program_id = ?
       ORDER BY entity_type, group_id, course_code`,
      programId,
    ),
    allRows(
      database,
      `/* catalog-export:eligibility */
       SELECT rule_key, condition_type, condition_value_json, decision, note,
              source_url, review_status, verified_at
       FROM program_eligibility_rules
       WHERE program_id = ?
       ORDER BY rule_key`,
      programId,
    ),
  ]);

  const { definitions: sources, idsByUrl } = buildSources(
    program,
    sourceRows,
    evidenceRows,
    selectorRows,
    conditionRows,
    eligibilityRows,
  );
  const evidenceByEntity = new Map(
    evidenceRows.map((row) => [
      `${stringValue(row.entity_type)}:${stringValue(row.group_id)}:${stringValue(row.course_code)}`,
      row,
    ]),
  );
  const coursesByGroup = new Map<string, RequirementCourseDefinition[]>();
  courseRows.forEach((row, index) => {
    const groupId = stringValue(row.group_id);
    const courseCode = stringValue(row.course_code);
    const courses = coursesByGroup.get(groupId) ?? [];
    const evidence = evidenceFromRow(
      evidenceByEntity.get(`course:${groupId}:${courseCode}`),
      idsByUrl,
      `courses[${index}].evidence`,
    );
    courses.push({
      code: courseCode,
      title: nullableString(row.source_title),
      credits: parseCredits(row.source_credits),
      note: row.note === null ? null : stringValue(row.note),
      ...(evidence ? { evidence } : {}),
    });
    coursesByGroup.set(groupId, courses);
  });

  const selectorsByGroup = new Map<string, RequirementGroupDefinition["selectors"]>();
  selectorRows.forEach((row, index) => {
    const groupId = stringValue(row.group_id);
    const selectors = selectorsByGroup.get(groupId) ?? [];
    selectors.push({
      key: stringValue(row.selector_key),
      source_id: sourceId(idsByUrl, row, `selectors[${index}].source_id`),
      source_label: stringValue(row.source_label) || "Official Rutgers catalog source",
      review_status: stringValue(row.review_status) as RequirementGroupDefinition["selectors"][number]["review_status"],
      reviewed_at: timestampValue(row.reviewed_at),
      selector: parseStoredJson(
        row.selector_json,
        `selectors[${index}].selector_json`,
      ) as CourseSelector,
    });
    selectorsByGroup.set(groupId, selectors);
  });

  const conditionsByGroup = new Map<string, RequirementConditionDefinition[]>();
  conditionRows.forEach((row, index) => {
    const groupId = stringValue(row.group_id);
    const conditions = conditionsByGroup.get(groupId) ?? [];
    conditions.push({
      type: stringValue(row.condition_type),
      value: parseStoredJson(
        row.condition_value_json,
        `conditions[${index}].condition_value_json`,
      ),
      note: row.note === null ? null : stringValue(row.note),
      source_id: sourceId(idsByUrl, row, `conditions[${index}].source_id`),
      review_status: stringValue(row.review_status) as RequirementConditionDefinition["review_status"],
    });
    conditionsByGroup.set(groupId, conditions);
  });

  const requirementGroups: RequirementGroupDefinition[] = groupRows.map((row) => {
    const groupId = stringValue(row.id);
    const evidence = evidenceFromRow(
      evidenceByEntity.get(`group:${groupId}:`),
      idsByUrl,
      `requirement_groups.${groupId}.evidence`,
    );
    return {
      id: groupId,
      parent_group_id: nullableString(row.parent_group_id),
      name: stringValue(row.name),
      rule: normalizedRule(row.rule),
      count: row.count === null ? null : integerValue(row.count),
      sort_order: integerValue(row.sort_order),
      display_family: nullableString(row.display_family),
      display_priority: integerValue(row.display_priority),
      courses: coursesByGroup.get(groupId) ?? [],
      selectors: selectorsByGroup.get(groupId) ?? [],
      conditions: conditionsByGroup.get(groupId) ?? [],
      ...(evidence ? { evidence } : {}),
    };
  });

  const eligibilityRules: ProgramEligibilityRuleDefinition[] =
    eligibilityRows.map((row, index) => ({
      key: stringValue(row.rule_key),
      condition_type: stringValue(row.condition_type),
      condition_value: parseStoredJson(
        row.condition_value_json,
        `eligibility[${index}].condition_value_json`,
      ),
      decision: stringValue(row.decision),
      note: stringValue(row.note),
      source_id: sourceId(idsByUrl, row, `eligibility[${index}].source_id`),
      review_status: stringValue(row.review_status) as ProgramEligibilityRuleDefinition["review_status"],
      verified_at: timestampValue(row.verified_at),
    }));

  const definition = {
    contract_version: 1,
    program: {
      id: stringValue(program.id),
      name: stringValue(program.name),
      school_slug: stringValue(program.school_slug),
      program_slug: stringValue(program.program_slug),
      type: stringValue(program.type),
      catalog_year: stringValue(program.catalog_year),
      academic_program_code: nullableString(program.academic_program_code),
      degree_type: nullableString(program.degree_type),
      program_family_id: nullableString(program.program_family_id),
      source_url: stringValue(program.source_url),
      review_status: stringValue(program.review_status),
      requirement_evidence_required:
        Number(program.requirement_evidence_required) === 1,
    },
    sources,
    requirement_groups: requirementGroups,
    eligibility_rules: eligibilityRules,
  };
  const result = validateProgramDefinition(definition);
  if (!result.ok) {
    throw new CatalogExportValidationError(result.issues);
  }
  return result.value;
}
