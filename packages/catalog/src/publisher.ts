import type {
  EvidenceDefinition,
  ProgramDefinition,
  ProgramSourceDefinition,
  RequirementGroupDefinition,
} from "./model.ts";
import { assertProgramDefinition } from "./validation.ts";

export interface CatalogPreparedStatement {
  bind(...values: unknown[]): CatalogPreparedStatement;
}

export interface CatalogDatabase {
  prepare(sql: string): CatalogPreparedStatement;
  batch(statements: CatalogPreparedStatement[]): Promise<unknown[]>;
}

export interface CatalogPublishOptions {
  published_at: number;
}

export interface CatalogPublishResult {
  program_id: string;
  sources: number;
  groups: number;
  courses: number;
  selectors: number;
  conditions: number;
  evidence: number;
  eligibility_rules: number;
  statement_count: number;
  published_at: number;
}

function statement(
  database: CatalogDatabase,
  sql: string,
  ...values: unknown[]
): CatalogPreparedStatement {
  return database.prepare(sql).bind(...values);
}

function orderedGroups(
  groups: RequirementGroupDefinition[],
): RequirementGroupDefinition[] {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const depth = (group: RequirementGroupDefinition): number => {
    let value = 0;
    let parentId = group.parent_group_id;
    while (parentId) {
      value += 1;
      parentId = byId.get(parentId)?.parent_group_id ?? null;
    }
    return value;
  };
  return [...groups].sort(
    (left, right) =>
      depth(left) - depth(right)
      || left.sort_order - right.sort_order
      || left.id.localeCompare(right.id),
  );
}

function sourceForEvidence(
  sources: Map<string, ProgramSourceDefinition>,
  evidence: EvidenceDefinition,
): ProgramSourceDefinition {
  const source = sources.get(evidence.source_id);
  if (!source) {
    throw new TypeError(`unknown evidence source: ${evidence.source_id}`);
  }
  return source;
}

function deleteStatements(
  database: CatalogDatabase,
  programId: string,
): CatalogPreparedStatement[] {
  const groupScope =
    "SELECT id FROM requirement_groups WHERE program_id = ?";
  return [
    statement(
      database,
      "DELETE FROM course_requirement_attributes WHERE program_id = ?",
      programId,
    ),
    statement(
      database,
      "DELETE FROM program_requirement_evidence WHERE program_id = ?",
      programId,
    ),
    statement(
      database,
      `DELETE FROM requirement_course_selectors WHERE group_id IN (${groupScope})`,
      programId,
    ),
    statement(
      database,
      `DELETE FROM requirement_courses WHERE group_id IN (${groupScope})`,
      programId,
    ),
    statement(
      database,
      `DELETE FROM requirement_group_conditions WHERE group_id IN (${groupScope})`,
      programId,
    ),
    statement(
      database,
      "DELETE FROM requirement_groups WHERE program_id = ?",
      programId,
    ),
    statement(
      database,
      "DELETE FROM program_eligibility_rules WHERE program_id = ?",
      programId,
    ),
    statement(
      database,
      "DELETE FROM program_sources WHERE program_id = ?",
      programId,
    ),
  ];
}

function coreAttributeCode(group: RequirementGroupDefinition): string | null {
  const match = group.name.match(/\[([A-Za-z][A-Za-z0-9]{1,7})\]/);
  return match?.[1] ?? null;
}

function courseAttributeStatements(
  database: CatalogDatabase,
  definition: ProgramDefinition,
  groups: RequirementGroupDefinition[],
): CatalogPreparedStatement[] {
  if (
    definition.program.type !== "core_curriculum"
    || definition.program.review_status !== "reviewed"
  ) return [];
  const rows: unknown[][] = [];
  const seen = new Set<string>();
  const parentGroupIds = new Set(groups.map((group) => group.parent_group_id).filter(Boolean));
  for (const group of groups) {
    if (parentGroupIds.has(group.id)) continue;
    const attributeCode = coreAttributeCode(group);
    if (!attributeCode) continue;
    const courseCodes = [
      ...group.courses.map((course) => course.code),
      ...group.selectors.flatMap((selector) =>
        selector.selector.kind === "course_codes"
          ? selector.selector.include_course_codes
          : []
      ),
    ];
    for (const courseCode of courseCodes) {
      const key = `${group.id}\u0000${courseCode}\u0000${attributeCode}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push([definition.program.id, group.id, courseCode, attributeCode]);
    }
  }
  return insertRows(
    database,
    "course_requirement_attributes",
    ["program_id", "group_id", "course_code", "attribute_code"],
    rows,
  );
}

function programStatement(
  database: CatalogDatabase,
  definition: ProgramDefinition,
  publishedAt: number,
): CatalogPreparedStatement {
  const program = definition.program;
  return statement(
    database,
    `INSERT INTO programs (
       id, name, school_slug, program_slug, type, catalog_year,
       academic_program_code, degree_type, program_family_id, source_url,
       review_status, last_scraped_at, requirement_evidence_required
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       school_slug = excluded.school_slug,
       program_slug = excluded.program_slug,
       type = excluded.type,
       catalog_year = excluded.catalog_year,
       academic_program_code = excluded.academic_program_code,
       degree_type = excluded.degree_type,
       program_family_id = excluded.program_family_id,
       source_url = excluded.source_url,
       review_status = excluded.review_status,
       last_scraped_at = excluded.last_scraped_at,
       requirement_evidence_required = excluded.requirement_evidence_required`,
    program.id,
    program.name,
    program.school_slug,
    program.program_slug,
    program.type,
    program.catalog_year,
    program.academic_program_code,
    program.degree_type,
    program.program_family_id,
    program.source_url,
    program.review_status,
    publishedAt,
    program.requirement_evidence_required ? 1 : 0,
  );
}

function insertRows(
  database: CatalogDatabase,
  table: string,
  columns: string[],
  rows: unknown[][],
): CatalogPreparedStatement[] {
  if (rows.length === 0) return [];
  const rowsPerStatement = Math.max(1, Math.floor(100 / columns.length));
  const statements: CatalogPreparedStatement[] = [];
  for (let offset = 0; offset < rows.length; offset += rowsPerStatement) {
    const chunk = rows.slice(offset, offset + rowsPerStatement);
    const placeholders = chunk
      .map(() => `(${columns.map(() => "?").join(", ")})`)
      .join(", ");
    statements.push(statement(
      database,
      `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${placeholders}`,
      ...chunk.flat(),
    ));
  }
  return statements;
}

function sourceStatements(
  database: CatalogDatabase,
  definition: ProgramDefinition,
): CatalogPreparedStatement[] {
  return insertRows(
    database,
    "program_sources",
    [
      "program_id",
      "source_url",
      "source_title",
      "source_catalog_year",
      "source_scope",
      "accessed_at",
      "note",
    ],
    definition.sources.map((source) => [
      definition.program.id,
      source.url,
      source.title,
      source.catalog_year,
      source.scope,
      source.accessed_at,
      source.note,
    ]),
  );
}

function groupStatements(
  database: CatalogDatabase,
  programId: string,
  groups: RequirementGroupDefinition[],
): CatalogPreparedStatement[] {
  return insertRows(
    database,
    "requirement_groups",
    [
      "id",
      "program_id",
      "parent_group_id",
      "name",
      "display_family",
      "display_priority",
      "rule",
      "count",
      "sort_order",
      "auto_generated",
    ],
    groups.map((group) => [
      group.id,
      programId,
      group.parent_group_id,
      group.name,
      group.display_family,
      group.display_priority,
      group.rule,
      group.count,
      group.sort_order,
      0,
    ]),
  );
}

function evidenceRow(
  definition: ProgramDefinition,
  sources: Map<string, ProgramSourceDefinition>,
  group: RequirementGroupDefinition,
  evidence: EvidenceDefinition,
  courseCode: string | null,
): unknown[] {
  const source = sourceForEvidence(sources, evidence);
  const entityType = courseCode ? "course" : "group";
  const entityKey = courseCode
    ? `course:${group.id}:${courseCode}`
    : `group:${group.id}`;
  return [
    entityKey,
    definition.program.id,
    entityType,
    group.id,
    courseCode,
    source.url,
    source.title,
    source.catalog_year,
    source.accessed_at,
    evidence.reviewer_note,
    evidence.review_status,
  ];
}

interface GroupContentRows {
  courses: unknown[][];
  selectors: unknown[][];
  conditions: unknown[][];
  evidence: unknown[][];
}

function groupContentRows(
  definition: ProgramDefinition,
  sources: Map<string, ProgramSourceDefinition>,
  groups: RequirementGroupDefinition[],
): GroupContentRows {
  const rows: GroupContentRows = {
    courses: [],
    selectors: [],
    conditions: [],
    evidence: [],
  };
  for (const group of groups) {
    for (const course of group.courses) {
      rows.courses.push([
        group.id,
        course.code,
        course.note,
        course.title,
        course.credits === null ? null : String(course.credits),
      ]);
      if (course.evidence) {
        rows.evidence.push(
          evidenceRow(
          definition,
          sources,
          group,
          course.evidence,
          course.code,
          ),
        );
      }
    }
    for (const selector of group.selectors) {
      const source = sources.get(selector.source_id);
      if (!source) throw new TypeError(`unknown selector source: ${selector.source_id}`);
      rows.selectors.push([
        group.id,
        selector.key,
        JSON.stringify(selector.selector),
        source.url,
        selector.source_label,
        selector.review_status,
        selector.reviewed_at,
      ]);
    }
    for (const condition of group.conditions) {
      const source = sources.get(condition.source_id);
      if (!source) throw new TypeError(`unknown condition source: ${condition.source_id}`);
      rows.conditions.push([
        group.id,
        condition.type,
        JSON.stringify(condition.value),
        condition.note,
        source.url,
        condition.review_status,
      ]);
    }
    if (group.evidence) {
      rows.evidence.push(
        evidenceRow(
        definition,
        sources,
        group,
        group.evidence,
        null,
        ),
      );
    }
  }
  return rows;
}

function groupContentStatements(
  database: CatalogDatabase,
  rows: GroupContentRows,
): CatalogPreparedStatement[] {
  return [
    ...insertRows(
      database,
      "requirement_courses",
      ["group_id", "course_code", "note", "source_title", "source_credits"],
      rows.courses,
    ),
    ...insertRows(
      database,
      "requirement_course_selectors",
      [
        "group_id",
        "selector_key",
        "selector_json",
        "source_url",
        "source_label",
        "review_status",
        "reviewed_at",
      ],
      rows.selectors,
    ),
    ...insertRows(
      database,
      "requirement_group_conditions",
      [
        "group_id",
        "condition_type",
        "condition_value_json",
        "note",
        "source_url",
        "review_status",
      ],
      rows.conditions,
    ),
    ...insertRows(
      database,
      "program_requirement_evidence",
      [
        "entity_key",
        "program_id",
        "entity_type",
        "group_id",
        "course_code",
        "source_url",
        "source_title",
        "source_catalog_year",
        "accessed_at",
        "reviewer_note",
        "review_status",
      ],
      rows.evidence,
    ),
  ];
}

function eligibilityStatements(
  database: CatalogDatabase,
  definition: ProgramDefinition,
  sources: Map<string, ProgramSourceDefinition>,
): CatalogPreparedStatement[] {
  const rows = definition.eligibility_rules.map((rule) => {
    const source = sources.get(rule.source_id);
    if (!source) throw new TypeError(`unknown eligibility source: ${rule.source_id}`);
    return [
      rule.key,
      definition.program.id,
      rule.condition_type,
      JSON.stringify(rule.condition_value),
      rule.decision,
      rule.note,
      source.url,
      rule.review_status,
      rule.verified_at,
    ];
  });
  return insertRows(
    database,
    "program_eligibility_rules",
    [
      "rule_key",
      "program_id",
      "condition_type",
      "condition_value_json",
      "decision",
      "note",
      "source_url",
      "review_status",
      "verified_at",
    ],
    rows,
  );
}

function successfulBatchResult(value: unknown): boolean {
  return !(
    typeof value === "object"
    && value !== null
    && "success" in value
    && (value as { success?: unknown }).success === false
  );
}

export async function publishProgramDefinition(
  database: CatalogDatabase,
  value: unknown,
  options: CatalogPublishOptions,
): Promise<CatalogPublishResult> {
  const definition = assertProgramDefinition(value);
  if (!Number.isFinite(options.published_at) || options.published_at < 0) {
    throw new TypeError("published_at must be a non-negative millisecond timestamp");
  }

  const sources = new Map(
    definition.sources.map((source) => [source.id, source]),
  );
  const groups = orderedGroups(definition.requirement_groups);
  const statements = [
    ...deleteStatements(database, definition.program.id),
    programStatement(database, definition, options.published_at),
    ...sourceStatements(database, definition),
    ...groupStatements(database, definition.program.id, groups),
  ];
  const contentRows = groupContentRows(definition, sources, groups);
  statements.push(...groupContentStatements(database, contentRows));
  statements.push(...courseAttributeStatements(database, definition, groups));
  statements.push(...eligibilityStatements(database, definition, sources));

  const batchResult = await database.batch(statements);
  if (
    batchResult.length !== statements.length
    || batchResult.some((result) => !successfulBatchResult(result))
  ) {
    throw new Error("catalog publication batch did not complete successfully");
  }

  return {
    program_id: definition.program.id,
    sources: definition.sources.length,
    groups: groups.length,
    courses: groups.reduce((sum, group) => sum + group.courses.length, 0),
    selectors: groups.reduce((sum, group) => sum + group.selectors.length, 0),
    conditions: groups.reduce((sum, group) => sum + group.conditions.length, 0),
    evidence: groups.reduce(
      (sum, group) =>
        sum
        + (group.evidence ? 1 : 0)
        + group.courses.filter((course) => course.evidence).length,
      0,
    ),
    eligibility_rules: definition.eligibility_rules.length,
    statement_count: statements.length,
    published_at: options.published_at,
  };
}
