import {
  PROGRAM_TYPES,
  REQUIREMENT_RULES,
  REVIEW_STATUSES,
  type ProgramDefinition,
  type ValidationIssue,
  type ValidationResult,
} from "./model.ts";

const IDENTIFIER_RE = /^[a-z0-9][a-z0-9-]{2,119}$/;
const COURSE_CODE_RE = /^\d{2}:\d{3}:\d{3}$/;
const COUNT_RULES = new Set(["min_courses", "max_courses", "min_credits"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isRutgersHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && (url.hostname === "rutgers.edu" || url.hostname.endsWith(".rutgers.edu"));
  } catch {
    return false;
  }
}

class DefinitionValidator {
  readonly issues: ValidationIssue[] = [];
  private readonly sourceIds = new Set<string>();
  private readonly groupIds = new Set<string>();

  issue(path: string, code: string, message: string): void {
    this.issues.push({ path, code, message });
  }

  string(value: unknown, path: string): value is string {
    if (isNonEmptyString(value)) return true;
    this.issue(path, "invalid_string", "must be a non-empty string");
    return false;
  }

  identifier(value: unknown, path: string): value is string {
    if (typeof value === "string" && IDENTIFIER_RE.test(value)) return true;
    this.issue(path, "invalid_identifier", "must be a lowercase, URL-safe identifier");
    return false;
  }

  timestamp(value: unknown, path: string): value is number {
    if (isFiniteNonNegative(value)) return true;
    this.issue(path, "invalid_timestamp", "must be a non-negative millisecond timestamp");
    return false;
  }

  sourceUrl(value: unknown, path: string): value is string {
    if (isRutgersHttpsUrl(value)) return true;
    this.issue(path, "invalid_source_url", "must be an official Rutgers HTTPS URL");
    return false;
  }

  validateProgram(value: unknown): void {
    if (!isRecord(value)) {
      this.issue("program", "invalid_object", "must be an object");
      return;
    }
    this.identifier(value.id, "program.id");
    this.string(value.name, "program.name");
    this.identifier(value.school_slug, "program.school_slug");
    this.identifier(value.program_slug, "program.program_slug");
    if (!PROGRAM_TYPES.includes(value.type as never)) {
      this.issue("program.type", "invalid_program_type", "must be a supported program type");
    }
    this.string(value.catalog_year, "program.catalog_year");
    if (value.academic_program_code !== null && value.academic_program_code !== undefined) {
      this.string(value.academic_program_code, "program.academic_program_code");
    }
    if (value.degree_type !== null) this.string(value.degree_type, "program.degree_type");
    if (value.program_family_id !== null) {
      this.identifier(value.program_family_id, "program.program_family_id");
    }
    this.sourceUrl(value.source_url, "program.source_url");
    if (!REVIEW_STATUSES.includes(value.review_status as never)) {
      this.issue("program.review_status", "invalid_review_status", "must be a supported review status");
    }
    if (typeof value.requirement_evidence_required !== "boolean") {
      this.issue(
        "program.requirement_evidence_required",
        "invalid_boolean",
        "must be a boolean",
      );
    }
  }

  validateSources(value: unknown): void {
    if (!Array.isArray(value) || value.length === 0) {
      this.issue("sources", "invalid_sources", "must contain at least one source");
      return;
    }
    value.forEach((source, index) => {
      const path = `sources[${index}]`;
      if (!isRecord(source)) {
        this.issue(path, "invalid_object", "must be an object");
        return;
      }
      if (this.identifier(source.id, `${path}.id`)) {
        if (this.sourceIds.has(source.id)) {
          this.issue(`${path}.id`, "duplicate_source_id", "must be unique");
        }
        this.sourceIds.add(source.id);
      }
      this.sourceUrl(source.url, `${path}.url`);
      this.string(source.title, `${path}.title`);
      if (source.catalog_year !== null) {
        this.string(source.catalog_year, `${path}.catalog_year`);
      }
      this.string(source.scope, `${path}.scope`);
      this.timestamp(source.accessed_at, `${path}.accessed_at`);
      this.string(source.note, `${path}.note`);
    });
  }

  validateEvidence(
    value: unknown,
    path: string,
    required: boolean,
  ): void {
    if (!isRecord(value)) {
      if (required) {
        this.issue(path, "missing_reviewed_evidence", "reviewed data requires evidence");
      }
      return;
    }
    if (this.identifier(value.source_id, `${path}.source_id`)
      && !this.sourceIds.has(value.source_id)) {
      this.issue(
        `${path}.source_id`,
        "unknown_evidence_source",
        "must reference a declared source",
      );
    }
    this.string(value.reviewer_note, `${path}.reviewer_note`);
    if (!["unreviewed", "reviewed", "needs_fix"].includes(String(value.review_status))) {
      this.issue(`${path}.review_status`, "invalid_review_status", "must be a review status");
    }
  }

  validateCourse(value: unknown, path: string, evidenceRequired: boolean): string | null {
    if (!isRecord(value)) {
      this.issue(path, "invalid_object", "must be an object");
      return null;
    }
    const code = typeof value.code === "string" ? value.code : "";
    if (!COURSE_CODE_RE.test(code)) {
      this.issue(`${path}.code`, "invalid_course_code", "must use NN:NNN:NNN");
    }
    if (value.title !== null) this.string(value.title, `${path}.title`);
    if (
      value.credits !== null
      && (typeof value.credits !== "number"
        || !Number.isFinite(value.credits)
        || value.credits <= 0)
    ) {
      this.issue(`${path}.credits`, "invalid_credits", "must be a positive number or null");
    }
    if (value.note !== null && typeof value.note !== "string") {
      this.issue(`${path}.note`, "invalid_string", "must be a string or null");
    }
    this.validateEvidence(value.evidence, `${path}.evidence`, evidenceRequired);
    return code || null;
  }

  validateSelector(value: unknown, path: string): void {
    if (!isRecord(value)) {
      this.issue(path, "invalid_object", "must be an object");
      return;
    }
    this.identifier(value.key, `${path}.key`);
    if (
      this.identifier(value.source_id, `${path}.source_id`)
      && !this.sourceIds.has(value.source_id)
    ) {
      this.issue(`${path}.source_id`, "unknown_evidence_source", "must reference a declared source");
    }
    this.string(value.source_label, `${path}.source_label`);
    if (!["unreviewed", "reviewed", "needs_fix"].includes(String(value.review_status))) {
      this.issue(`${path}.review_status`, "invalid_review_status", "must be a review status");
    }
    this.timestamp(value.reviewed_at, `${path}.reviewed_at`);
    if (!isRecord(value.selector)) {
      this.issue(`${path}.selector`, "invalid_selector", "must be a selector object");
      return;
    }
    const selector = value.selector;
    if (selector.version !== 1) {
      this.issue(`${path}.selector.version`, "invalid_selector", "must be version 1");
    }
    this.string(selector.label, `${path}.selector.label`);
    if (selector.kind === "course_codes") {
      if (!Array.isArray(selector.course_codes) || selector.course_codes.length === 0) {
        this.issue(`${path}.selector.course_codes`, "invalid_selector", "must contain course codes");
      } else {
        selector.course_codes.forEach((code, index) => {
          if (typeof code !== "string" || !COURSE_CODE_RE.test(code)) {
            this.issue(
              `${path}.selector.course_codes[${index}]`,
              "invalid_course_code",
              "must use NN:NNN:NNN",
            );
          }
        });
      }
    } else if (selector.kind === "subject_level") {
      const stringArrayFields = ["school_codes", "subject_codes"] as const;
      for (const field of stringArrayFields) {
        if (
          !Array.isArray(selector[field])
          || selector[field].length === 0
          || selector[field].some((item) => !isNonEmptyString(item))
        ) {
          this.issue(`${path}.selector.${field}`, "invalid_selector", "must contain strings");
        }
      }
      const min = selector.course_number_min;
      const max = selector.course_number_max;
      if (!Number.isInteger(min) || !Number.isInteger(max) || Number(min) > Number(max)) {
        this.issue(
          `${path}.selector`,
          "invalid_selector_range",
          "course number minimum must not exceed maximum",
        );
      }
    } else {
      this.issue(`${path}.selector.kind`, "invalid_selector", "must use a supported selector kind");
    }
  }

  validateCondition(value: unknown, path: string): void {
    if (!isRecord(value)) {
      this.issue(path, "invalid_object", "must be an object");
      return;
    }
    this.string(value.type, `${path}.type`);
    if (value.note !== null && typeof value.note !== "string") {
      this.issue(`${path}.note`, "invalid_string", "must be a string or null");
    }
    if (
      this.identifier(value.source_id, `${path}.source_id`)
      && !this.sourceIds.has(value.source_id)
    ) {
      this.issue(`${path}.source_id`, "unknown_evidence_source", "must reference a declared source");
    }
    if (!["unreviewed", "reviewed", "needs_fix"].includes(String(value.review_status))) {
      this.issue(`${path}.review_status`, "invalid_review_status", "must be a review status");
    }
  }

  validateGroups(value: unknown, evidenceRequired: boolean): void {
    if (!Array.isArray(value) || value.length === 0) {
      this.issue("requirement_groups", "invalid_groups", "must contain requirement groups");
      return;
    }

    value.forEach((group, index) => {
      if (!isRecord(group)) return;
      if (this.identifier(group.id, `requirement_groups[${index}].id`)) {
        if (this.groupIds.has(group.id)) {
          this.issue(
            `requirement_groups[${index}].id`,
            "duplicate_group_id",
            "must be unique",
          );
        }
        this.groupIds.add(group.id);
      }
    });

    value.forEach((group, index) => {
      const path = `requirement_groups[${index}]`;
      if (!isRecord(group)) {
        this.issue(path, "invalid_object", "must be an object");
        return;
      }
      if (group.parent_group_id !== null) {
        if (!this.identifier(group.parent_group_id, `${path}.parent_group_id`)) {
          // identifier adds the issue
        } else if (!this.groupIds.has(group.parent_group_id)) {
          this.issue(
            `${path}.parent_group_id`,
            "missing_parent_group",
            "must reference a group in this definition",
          );
        }
      }
      this.string(group.name, `${path}.name`);
      const rule = String(group.rule);
      if (!REQUIREMENT_RULES.includes(rule as never)) {
        this.issue(`${path}.rule`, "unsupported_rule", "must use a supported rule");
      }
      const expectsCount = COUNT_RULES.has(rule);
      if (
        (expectsCount && !isPositiveInteger(group.count))
        || (!expectsCount && group.count !== null)
      ) {
        this.issue(
          `${path}.count`,
          "invalid_rule_count",
          expectsCount
            ? "must be a positive integer for this rule"
            : "must be null for this rule",
        );
      }
      if (!Number.isInteger(group.sort_order)) {
        this.issue(`${path}.sort_order`, "invalid_integer", "must be an integer");
      }
      if (group.display_family !== null) {
        this.identifier(group.display_family, `${path}.display_family`);
      }
      if (!Number.isInteger(group.display_priority)) {
        this.issue(`${path}.display_priority`, "invalid_integer", "must be an integer");
      }
      const seenCourses = new Set<string>();
      if (!Array.isArray(group.courses)) {
        this.issue(`${path}.courses`, "invalid_array", "must be an array");
      } else {
        group.courses.forEach((course, courseIndex) => {
          const code = this.validateCourse(
            course,
            `${path}.courses[${courseIndex}]`,
            evidenceRequired,
          );
          if (code && seenCourses.has(code)) {
            this.issue(
              `${path}.courses[${courseIndex}].code`,
              "duplicate_course_code",
              "must be unique inside a requirement group",
            );
          }
          if (code) seenCourses.add(code);
        });
      }
      if (!Array.isArray(group.selectors)) {
        this.issue(`${path}.selectors`, "invalid_array", "must be an array");
      } else {
        group.selectors.forEach((selector, selectorIndex) => {
          this.validateSelector(selector, `${path}.selectors[${selectorIndex}]`);
        });
      }
      if (!Array.isArray(group.conditions)) {
        this.issue(`${path}.conditions`, "invalid_array", "must be an array");
      } else {
        group.conditions.forEach((condition, conditionIndex) => {
          this.validateCondition(condition, `${path}.conditions[${conditionIndex}]`);
        });
      }
      this.validateEvidence(group.evidence, `${path}.evidence`, evidenceRequired);
    });

    this.validateGroupCycles(value);
  }

  validateGroupCycles(groups: unknown[]): void {
    const parents = new Map<string, string | null>();
    for (const group of groups) {
      if (!isRecord(group) || typeof group.id !== "string") continue;
      parents.set(
        group.id,
        typeof group.parent_group_id === "string" ? group.parent_group_id : null,
      );
    }
    const reported = new Set<string>();
    for (const id of parents.keys()) {
      const path = new Set<string>();
      let cursor: string | null | undefined = id;
      while (cursor && parents.has(cursor)) {
        if (path.has(cursor)) {
          if (!reported.has(cursor)) {
            this.issue(
              `requirement_groups.${cursor}`,
              "requirement_cycle",
              "requirement parent relationships must be acyclic",
            );
            reported.add(cursor);
          }
          break;
        }
        path.add(cursor);
        cursor = parents.get(cursor);
      }
    }
  }

  validateEligibilityRules(value: unknown): void {
    if (!Array.isArray(value)) {
      this.issue("eligibility_rules", "invalid_array", "must be an array");
      return;
    }
    const keys = new Set<string>();
    value.forEach((rule, index) => {
      const path = `eligibility_rules[${index}]`;
      if (!isRecord(rule)) {
        this.issue(path, "invalid_object", "must be an object");
        return;
      }
      if (this.identifier(rule.key, `${path}.key`)) {
        if (keys.has(rule.key)) {
          this.issue(`${path}.key`, "duplicate_rule_key", "must be unique");
        }
        keys.add(rule.key);
      }
      this.string(rule.condition_type, `${path}.condition_type`);
      this.string(rule.decision, `${path}.decision`);
      this.string(rule.note, `${path}.note`);
      if (
        this.identifier(rule.source_id, `${path}.source_id`)
        && !this.sourceIds.has(rule.source_id)
      ) {
        this.issue(`${path}.source_id`, "unknown_evidence_source", "must reference a declared source");
      }
      if (!["unreviewed", "reviewed", "needs_fix"].includes(String(rule.review_status))) {
        this.issue(`${path}.review_status`, "invalid_review_status", "must be a review status");
      }
      this.timestamp(rule.verified_at, `${path}.verified_at`);
    });
  }
}

export function validateProgramDefinition(value: unknown): ValidationResult {
  const validator = new DefinitionValidator();
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [{ path: "", code: "invalid_object", message: "definition must be an object" }],
    };
  }
  if (value.contract_version !== 1) {
    validator.issue(
      "contract_version",
      "unsupported_version",
      "must be the supported contract version 1",
    );
  }
  validator.validateProgram(value.program);
  validator.validateSources(value.sources);
  const program = isRecord(value.program) ? value.program : {};
  const evidenceRequired =
    program.review_status === "reviewed"
    && program.requirement_evidence_required === true;
  validator.validateGroups(value.requirement_groups, evidenceRequired);
  validator.validateEligibilityRules(value.eligibility_rules);

  if (validator.issues.length > 0) {
    return { ok: false, issues: validator.issues };
  }
  return { ok: true, value: value as unknown as ProgramDefinition, issues: [] };
}

export function assertProgramDefinition(value: unknown): ProgramDefinition {
  const result = validateProgramDefinition(value);
  if (result.ok) return result.value;
  throw new TypeError(
    result.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; "),
  );
}

