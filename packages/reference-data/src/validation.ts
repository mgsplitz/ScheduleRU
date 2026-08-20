import {
  PROGRAM_SELECTION_DECISIONS,
  REVIEW_STATUSES,
  type ReferenceDataBundle,
  type ValidationIssue,
  type ValidationResult,
} from "./model.ts";

const IDENTIFIER_RE = /^[a-z0-9][a-z0-9-]{1,119}$/;
const COURSE_CODE_RE = /^\d{2}:\d{3}:\d{3}$/;
const REQUIREMENT_ID_RE = /^\d{8}$/;
const CAMPUS_CODE_RE = /^[A-Z]{2,10}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const COURSE_ELIGIBILITY_STATUSES = ["draft", "reviewed", "stale"];
const COURSE_ELIGIBILITY_CONDITION_TYPES = [
  "prerequisite_course",
  "corequisite_course",
  "minimum_prior_credits",
  "minimum_plan_year",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class Validator {
  readonly issues: ValidationIssue[] = [];

  issue(path: string, code: string, message: string): void {
    this.issues.push({ path, code, message });
  }

  string(value: unknown, path: string): value is string {
    if (typeof value === "string" && value.trim().length > 0) return true;
    this.issue(path, "invalid_string", "must be a non-empty string");
    return false;
  }

  nullableString(value: unknown, path: string): void {
    if (value !== null) this.string(value, path);
  }

  identifier(value: unknown, path: string): value is string {
    if (typeof value === "string" && IDENTIFIER_RE.test(value)) return true;
    this.issue(path, "invalid_identifier", "must be a lowercase URL-safe identifier");
    return false;
  }

  nullableIdentifier(value: unknown, path: string): value is string | null {
    if (value === null) return true;
    return this.identifier(value, path);
  }

  integer(value: unknown, path: string, minimum = 0): value is number {
    if (Number.isInteger(value) && Number(value) >= minimum) return true;
    this.issue(path, "invalid_integer", `must be an integer of at least ${minimum}`);
    return false;
  }

  number(value: unknown, path: string, minimum = 0): value is number {
    if (typeof value === "number" && Number.isFinite(value) && value >= minimum) {
      return true;
    }
    this.issue(path, "invalid_number", `must be a number of at least ${minimum}`);
    return false;
  }

  score(value: unknown, path: string): value is number {
    if (Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 5) {
      return true;
    }
    this.issue(path, "invalid_score", "must be an integer from 1 through 5");
    return false;
  }

  timestamp(value: unknown, path: string, nullable = false): void {
    if (nullable && value === null) return;
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return;
    this.issue(path, "invalid_timestamp", "must be a non-negative millisecond timestamp");
  }

  sourceUrl(value: unknown, path: string, nullable = false): void {
    if (nullable && value === null) return;
    if (typeof value === "string") {
      try {
        const url = new URL(value);
        if (
          url.protocol === "https:"
          && !url.username
          && !url.password
          && (url.hostname === "rutgers.edu" || url.hostname.endsWith(".rutgers.edu"))
        ) return;
      } catch {
        // Fall through to a path-addressed issue.
      }
    }
    this.issue(path, "invalid_source_url", "must be an official Rutgers HTTPS URL");
  }

  reviewStatus(value: unknown, path: string): void {
    if (REVIEW_STATUSES.includes(value as never)) return;
    this.issue(path, "invalid_review_status", "must be a supported review status");
  }

  array(
    value: unknown,
    path: string,
    visit: (row: Record<string, unknown>, rowPath: string) => string | null,
  ): void {
    if (!Array.isArray(value)) {
      this.issue(path, "invalid_array", "must be an array");
      return;
    }
    const keys = new Set<string>();
    value.forEach((row, index) => {
      const rowPath = `${path}[${index}]`;
      if (!isRecord(row)) {
        this.issue(rowPath, "invalid_object", "must be an object");
        return;
      }
      const key = visit(row, rowPath);
      if (key && keys.has(key)) {
        this.issue(rowPath, "duplicate_key", `duplicates natural key ${key}`);
      }
      if (key) keys.add(key);
    });
  }

  validate(value: Record<string, unknown>): void {
    this.array(value.school_profiles, "school_profiles", (row, path) => {
      const key = this.identifier(row.slug, `${path}.slug`) ? String(row.slug) : null;
      this.identifier(row.institution_slug, `${path}.institution_slug`);
      this.identifier(row.campus_slug, `${path}.campus_slug`);
      this.string(row.name, `${path}.name`);
      this.string(row.short_name, `${path}.short_name`);
      this.nullableString(row.catalog_year, `${path}.catalog_year`);
      if (!isRecord(row.configuration)) {
        this.issue(
          `${path}.configuration`,
          "invalid_object",
          "must be a decoded JSON object",
        );
      }
      this.sourceUrl(row.source_url, `${path}.source_url`);
      this.string(row.source_title, `${path}.source_title`);
      this.reviewStatus(row.review_status, `${path}.review_status`);
      this.timestamp(row.reviewed_at, `${path}.reviewed_at`, true);
      this.integer(row.sort_order, `${path}.sort_order`);
      return key;
    });

    this.array(
      value.school_curriculum_modules,
      "school_curriculum_modules",
      (row, path) => {
        const school = this.identifier(row.school_slug, `${path}.school_slug`)
          ? String(row.school_slug)
          : "";
        if (row.module_type !== "core_curriculum") {
          this.issue(
            `${path}.module_type`,
            "invalid_module_type",
            "must be core_curriculum",
          );
        }
        this.identifier(row.curriculum_program_id, `${path}.curriculum_program_id`);
        this.sourceUrl(row.source_url, `${path}.source_url`);
        this.reviewStatus(row.review_status, `${path}.review_status`);
        this.timestamp(row.reviewed_at, `${path}.reviewed_at`, true);
        this.integer(row.sort_order, `${path}.sort_order`);
        return school ? `${school}:${String(row.module_type)}` : null;
      },
    );

    this.array(
      value.program_selection_limits,
      "program_selection_limits",
      (row, path) => {
        const school = this.identifier(
          row.home_school_slug,
          `${path}.home_school_slug`,
        ) ? String(row.home_school_slug) : "";
        const type = this.string(row.program_type, `${path}.program_type`)
          ? String(row.program_type)
          : "";
        this.integer(row.max_selected, `${path}.max_selected`);
        this.string(row.note, `${path}.note`);
        this.sourceUrl(row.source_url, `${path}.source_url`);
        this.timestamp(row.verified_at, `${path}.verified_at`);
        return school && type ? `${school}:${type}` : null;
      },
    );

    this.array(
      value.program_combination_policies,
      "program_combination_policies",
      (row, path) => {
        const key = this.identifier(row.policy_key, `${path}.policy_key`)
          ? String(row.policy_key)
          : null;
        this.identifier(row.home_school_slug, `${path}.home_school_slug`);
        const a = [
          this.nullableIdentifier(row.program_a_id, `${path}.program_a_id`)
            ? row.program_a_id
            : null,
          this.nullableIdentifier(
            row.program_a_school_slug,
            `${path}.program_a_school_slug`,
          ) ? row.program_a_school_slug : null,
          row.program_a_type === null
            ? null
            : (this.string(row.program_a_type, `${path}.program_a_type`)
              ? row.program_a_type
              : null),
        ];
        const b = [
          this.nullableIdentifier(row.program_b_id, `${path}.program_b_id`)
            ? row.program_b_id
            : null,
          this.nullableIdentifier(
            row.program_b_school_slug,
            `${path}.program_b_school_slug`,
          ) ? row.program_b_school_slug : null,
          row.program_b_type === null
            ? null
            : (this.string(row.program_b_type, `${path}.program_b_type`)
              ? row.program_b_type
              : null),
        ];
        if (!a.some(Boolean) || !b.some(Boolean)) {
          this.issue(
            path,
            "missing_policy_matcher",
            "both policy sides must contain at least one matcher",
          );
        }
        if (typeof row.same_program_family !== "boolean") {
          this.issue(
            `${path}.same_program_family`,
            "invalid_boolean",
            "must be a boolean",
          );
        }
        if (!PROGRAM_SELECTION_DECISIONS.includes(row.decision as never)) {
          this.issue(
            `${path}.decision`,
            "invalid_decision",
            "must be a supported selection decision",
          );
        }
        this.string(row.note, `${path}.note`);
        this.sourceUrl(row.source_url, `${path}.source_url`);
        this.timestamp(row.verified_at, `${path}.verified_at`);
        return key;
      },
    );

    this.array(value.double_count_rules, "double_count_rules", (row, path) => {
      const a = this.identifier(row.program_a, `${path}.program_a`)
        ? String(row.program_a)
        : "";
      const b = this.identifier(row.program_b, `${path}.program_b`)
        ? String(row.program_b)
        : "";
      if (row.max_shared_credits !== null) {
        this.integer(row.max_shared_credits, `${path}.max_shared_credits`);
      }
      if (row.note !== null) this.string(row.note, `${path}.note`);
      return a && b ? `${a}:${b}` : null;
    });

    this.array(
      value.double_count_policies,
      "double_count_policies",
      (row, path) => {
        const school = this.identifier(row.school_slug, `${path}.school_slug`)
          ? String(row.school_slug)
          : "";
        const scope = String(row.scope);
        if (!["major_major", "major_concentration"].includes(scope)) {
          this.issue(
            `${path}.scope`,
            "invalid_scope",
            "must be major_major or major_concentration",
          );
        }
        if (row.max_shared_courses !== null) {
          this.integer(row.max_shared_courses, `${path}.max_shared_courses`);
        }
        this.string(row.note, `${path}.note`);
        this.sourceUrl(row.source_url, `${path}.source_url`);
        this.timestamp(row.verified_at, `${path}.verified_at`);
        return school && ["major_major", "major_concentration"].includes(scope)
          ? `${school}:${scope}`
          : null;
      },
    );

    this.array(
      value.double_count_exceptions,
      "double_count_exceptions",
      (row, path) => {
        const a = this.identifier(row.program_a, `${path}.program_a`)
          ? String(row.program_a)
          : "";
        const b = this.identifier(row.program_b, `${path}.program_b`)
          ? String(row.program_b)
          : "";
        if (
          !Array.isArray(row.allowed_course_codes)
          || row.allowed_course_codes.length === 0
        ) {
          this.issue(
            `${path}.allowed_course_codes`,
            "invalid_course_codes",
            "must contain at least one course code",
          );
        } else {
          row.allowed_course_codes.forEach((code, index) => {
            if (typeof code !== "string" || !COURSE_CODE_RE.test(code)) {
              this.issue(
                `${path}.allowed_course_codes[${index}]`,
                "invalid_course_code",
                "must use NN:NNN:NNN",
              );
            }
          });
        }
        if (row.note !== null) this.string(row.note, `${path}.note`);
        this.sourceUrl(row.source_url, `${path}.source_url`, true);
        this.reviewStatus(row.review_status, `${path}.review_status`);
        this.timestamp(row.verified_at, `${path}.verified_at`, true);
        return a && b ? `${a}:${b}` : null;
      },
    );

    this.array(
      value.requirement_course_equivalencies,
      "requirement_course_equivalencies",
      (row, path) => {
        const program = this.identifier(row.program_id, `${path}.program_id`)
          ? String(row.program_id)
          : "";
        for (const field of [
          "requirement_course_code",
          "equivalent_course_code",
        ] as const) {
          if (
            typeof row[field] !== "string"
            || !COURSE_CODE_RE.test(row[field])
          ) {
            this.issue(
              `${path}.${field}`,
              "invalid_course_code",
              "must use NN:NNN:NNN",
            );
          }
        }
        if (row.note !== null) this.string(row.note, `${path}.note`);
        if (row.source_label !== null) {
          this.string(row.source_label, `${path}.source_label`);
        }
        if (!["reviewed", "needs_review"].includes(String(row.review_status))) {
          this.issue(
            `${path}.review_status`,
            "invalid_review_status",
            "must be reviewed or needs_review",
          );
        }
        return program
          ? `${program}:${String(row.requirement_course_code)}:${String(row.equivalent_course_code)}`
          : null;
      },
    );

    this.array(value.ap_equivalencies, "ap_equivalencies", (row, path) => {
      const id = this.identifier(row.id, `${path}.id`) ? String(row.id) : "";
      this.string(row.exam_name, `${path}.exam_name`);
      const minimumValid = this.score(row.minimum_score, `${path}.minimum_score`);
      const maximumValid = this.score(row.maximum_score, `${path}.maximum_score`);
      if (
        minimumValid
        && maximumValid
        && Number(row.maximum_score) < Number(row.minimum_score)
      ) {
        this.issue(
          `${path}.maximum_score`,
          "invalid_score_range",
          "must be greater than or equal to minimum_score",
        );
      }
      this.number(row.credits, `${path}.credits`);
      if (!Array.isArray(row.equivalent_course_codes)) {
        this.issue(
          `${path}.equivalent_course_codes`,
          "invalid_array",
          "must be an array",
        );
      } else {
        row.equivalent_course_codes.forEach((code, index) => {
          if (typeof code !== "string" || !COURSE_CODE_RE.test(code)) {
            this.issue(
              `${path}.equivalent_course_codes[${index}]`,
              "invalid_course_code",
              "must use NN:NNN:NNN",
            );
          }
        });
      }
      if (!Array.isArray(row.fulfills_requirement_ids)) {
        this.issue(
          `${path}.fulfills_requirement_ids`,
          "invalid_array",
          "must be an array",
        );
      } else {
        row.fulfills_requirement_ids.forEach((requirementId, index) => {
          if (
            typeof requirementId !== "string"
            || !REQUIREMENT_ID_RE.test(requirementId)
          ) {
            this.issue(
              `${path}.fulfills_requirement_ids[${index}]`,
              "invalid_requirement_id",
              "must use the compact eight-digit Rutgers requirement ID",
            );
          }
        });
      }
      const catalogYear = this.string(row.catalog_year, `${path}.catalog_year`)
        ? String(row.catalog_year)
        : "";
      const campus =
        typeof row.campus === "string" && CAMPUS_CODE_RE.test(row.campus)
          ? row.campus
          : "";
      if (!campus) {
        this.issue(
          `${path}.campus`,
          "invalid_campus",
          "must be an uppercase campus code",
        );
      }
      this.sourceUrl(row.source_url, `${path}.source_url`);
      if (!["draft", "reviewed", "retired"].includes(String(row.review_status))) {
        this.issue(
          `${path}.review_status`,
          "invalid_review_status",
          "must be draft, reviewed, or retired",
        );
      }
      if (
        row.reviewed_at !== null
        && (typeof row.reviewed_at !== "string" || !ISO_DATE_RE.test(row.reviewed_at))
      ) {
        this.issue(
          `${path}.reviewed_at`,
          "invalid_date",
          "must be an ISO date or null",
        );
      }
      return id && catalogYear && campus ? `${id}:${catalogYear}:${campus}` : null;
    });

    const noConditionCourses = new Set<string>();
    this.array(
      value.course_eligibility_reviews,
      "course_eligibility_reviews",
      (row, path) => {
        const code =
          typeof row.course_code === "string" && COURSE_CODE_RE.test(row.course_code)
            ? row.course_code
            : "";
        if (!code) {
          this.issue(`${path}.course_code`, "invalid_course_code", "must use NN:NNN:NNN");
        }
        this.identifier(row.campus_slug, `${path}.campus_slug`);
        this.nullableString(row.catalog_year, `${path}.catalog_year`);
        if (!COURSE_ELIGIBILITY_STATUSES.includes(String(row.review_status))) {
          this.issue(`${path}.review_status`, "invalid_review_status", "must be draft, reviewed, or stale");
        }
        if (typeof row.no_known_conditions !== "boolean") {
          this.issue(`${path}.no_known_conditions`, "invalid_boolean", "must be a boolean");
        } else if (row.no_known_conditions && code) {
          noConditionCourses.add(code);
        }
        this.sourceUrl(row.source_url, `${path}.source_url`);
        this.string(row.source_label, `${path}.source_label`);
        this.nullableString(row.source_date, `${path}.source_date`);
        this.timestamp(row.reviewed_at, `${path}.reviewed_at`, true);
        if (row.note !== null) this.string(row.note, `${path}.note`);
        return code || null;
      },
    );

    const reviewedCourses = new Set(
      Array.isArray(value.course_eligibility_reviews)
        ? value.course_eligibility_reviews
          .filter(isRecord)
          .map((row) => String(row.course_code))
        : [],
    );
    this.array(
      value.course_eligibility_conditions,
      "course_eligibility_conditions",
      (row, path) => {
        const code =
          typeof row.course_code === "string" && COURSE_CODE_RE.test(row.course_code)
            ? row.course_code
            : "";
        if (!code) {
          this.issue(`${path}.course_code`, "invalid_course_code", "must use NN:NNN:NNN");
        } else if (!reviewedCourses.has(code)) {
          this.issue(`${path}.course_code`, "missing_review", "must reference a course eligibility review");
        } else if (noConditionCourses.has(code)) {
          this.issue(path, "condition_conflict", "a no-known-conditions review cannot have conditions");
        }
        const conditionKey = this.identifier(
          row.condition_key,
          `${path}.condition_key`,
        ) ? String(row.condition_key) : "";
        const conditionType = String(row.condition_type);
        if (!COURSE_ELIGIBILITY_CONDITION_TYPES.includes(conditionType)) {
          this.issue(`${path}.condition_type`, "invalid_condition_type", "must be a supported eligibility condition");
        }
        if (!isRecord(row.condition_value)) {
          this.issue(`${path}.condition_value`, "invalid_object", "must be a decoded JSON object");
        } else if (
          conditionType === "prerequisite_course"
          || conditionType === "corequisite_course"
        ) {
          const codes = row.condition_value.any_of_course_codes;
          if (
            !Array.isArray(codes)
            || codes.length === 0
            || codes.some((item) => typeof item !== "string" || !COURSE_CODE_RE.test(item))
          ) {
            this.issue(
              `${path}.condition_value.any_of_course_codes`,
              "invalid_course_codes",
              "must contain valid Rutgers course codes",
            );
          }
        } else if (conditionType === "minimum_prior_credits") {
          this.integer(
            row.condition_value.minimum_credits,
            `${path}.condition_value.minimum_credits`,
            1,
          );
        } else if (conditionType === "minimum_plan_year") {
          if (
            !this.integer(
              row.condition_value.minimum_year,
              `${path}.condition_value.minimum_year`,
              1,
            )
            || Number(row.condition_value.minimum_year) > 4
          ) {
            if (Number(row.condition_value.minimum_year) > 4) {
              this.issue(
                `${path}.condition_value.minimum_year`,
                "invalid_plan_year",
                "must not exceed year 4",
              );
            }
          }
        }
        if (!COURSE_ELIGIBILITY_STATUSES.includes(String(row.review_status))) {
          this.issue(`${path}.review_status`, "invalid_review_status", "must be draft, reviewed, or stale");
        }
        this.sourceUrl(row.source_url, `${path}.source_url`);
        this.string(row.source_label, `${path}.source_label`);
        this.nullableString(row.source_date, `${path}.source_date`);
        this.timestamp(row.reviewed_at, `${path}.reviewed_at`, true);
        return code && conditionKey ? `${code}:${conditionKey}` : null;
      },
    );

    const creditExclusionPolicies = new Set<string>();
    this.array(
      value.course_credit_exclusion_policies,
      "course_credit_exclusion_policies",
      (row, path) => {
        const policyKey = this.identifier(row.policy_key, `${path}.policy_key`)
          ? String(row.policy_key)
          : "";
        if (policyKey) creditExclusionPolicies.add(policyKey);
        this.identifier(row.campus_slug, `${path}.campus_slug`);
        this.nullableString(row.catalog_year, `${path}.catalog_year`);
        this.integer(row.max_courses, `${path}.max_courses`, 1);
        this.string(row.note, `${path}.note`);
        this.sourceUrl(row.source_url, `${path}.source_url`);
        this.string(row.source_label, `${path}.source_label`);
        this.nullableString(row.source_date, `${path}.source_date`);
        if (!COURSE_ELIGIBILITY_STATUSES.includes(String(row.review_status))) {
          this.issue(`${path}.review_status`, "invalid_review_status", "must be draft, reviewed, or stale");
        }
        this.timestamp(row.reviewed_at, `${path}.reviewed_at`, true);
        return policyKey || null;
      },
    );
    this.array(
      value.course_credit_exclusion_members,
      "course_credit_exclusion_members",
      (row, path) => {
        const policyKey = typeof row.policy_key === "string" ? row.policy_key : "";
        if (!creditExclusionPolicies.has(policyKey)) {
          this.issue(`${path}.policy_key`, "missing_policy", "must reference a credit-exclusion policy");
        }
        const courseCode = typeof row.course_code === "string" && COURSE_CODE_RE.test(row.course_code)
          ? row.course_code
          : "";
        if (!courseCode) {
          this.issue(`${path}.course_code`, "invalid_course_code", "must use NN:NNN:NNN");
        }
        return policyKey && courseCode ? `${policyKey}:${courseCode}` : null;
      },
    );
    const exclusionPolicies = value.course_credit_exclusion_policies;
    const exclusionMembers = value.course_credit_exclusion_members;
    if (Array.isArray(exclusionPolicies) && Array.isArray(exclusionMembers)) {
      exclusionPolicies.forEach((policy, index) => {
        if (!isRecord(policy) || typeof policy.policy_key !== "string") return;
        const memberCodes = new Set(
          exclusionMembers
            .filter(isRecord)
            .filter((member) => member.policy_key === policy.policy_key)
            .map((member) => member.course_code)
            .filter((code): code is string => typeof code === "string"),
        );
        if (
          typeof policy.max_courses === "number"
          && memberCodes.size <= policy.max_courses
        ) {
          this.issue(
            `course_credit_exclusion_policies[${index}]`,
            "incomplete_credit_exclusion",
            "must contain more distinct member courses than the allowed maximum",
          );
        }
      });
    }
  }
}

export function validateReferenceDataBundle(value: unknown): ValidationResult {
  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [{
        path: "",
        code: "invalid_object",
        message: "reference data must be an object",
      }],
    };
  }
  const validator = new Validator();
  if (value.contract_version !== 1) {
    validator.issue(
      "contract_version",
      "unsupported_contract_version",
      "must be version 1",
    );
  }
  validator.validate(value);
  if (validator.issues.length > 0) {
    return { ok: false, issues: validator.issues };
  }
  return { ok: true, value: value as unknown as ReferenceDataBundle, issues: [] };
}

export function assertReferenceDataBundle(value: unknown): ReferenceDataBundle {
  const result = validateReferenceDataBundle(value);
  if (!result.ok) {
    throw new TypeError(
      result.issues
        .map((issue) => `${issue.path} [${issue.code}]: ${issue.message}`)
        .join("; "),
    );
  }
  return result.value;
}
