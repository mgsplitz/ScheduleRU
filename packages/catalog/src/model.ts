export const PROGRAM_TYPES = [
  "major",
  "minor",
  "concentration",
  "certificate",
] as const;

export const REVIEW_STATUSES = [
  "catalog_listed",
  "unreviewed",
  "reviewed",
  "needs_fix",
] as const;

export const REQUIREMENT_RULES = [
  "all",
  "one_of",
  "min_courses",
  "max_courses",
  "min_credits",
] as const;

export type ProgramType = (typeof PROGRAM_TYPES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type RequirementRule = (typeof REQUIREMENT_RULES)[number];

export interface ProgramIdentity {
  id: string;
  name: string;
  school_slug: string;
  program_slug: string;
  type: ProgramType;
  catalog_year: string;
  academic_program_code: string | null;
  degree_type: string | null;
  program_family_id: string | null;
  source_url: string;
  review_status: ReviewStatus;
  requirement_evidence_required: boolean;
}

export interface ProgramSourceDefinition {
  id: string;
  url: string;
  title: string;
  catalog_year: string | null;
  scope: string;
  accessed_at: number;
  note: string;
}

export interface EvidenceDefinition {
  source_id: string;
  reviewer_note: string;
  review_status: Exclude<ReviewStatus, "catalog_listed">;
}

export interface RequirementCourseDefinition {
  code: string;
  title: string | null;
  credits: number | null;
  note: string | null;
  evidence?: EvidenceDefinition;
}

export interface SubjectLevelSelector {
  version: 1;
  kind: "subject_level";
  school_codes: string[];
  subject_codes: string[];
  course_number_min: number;
  course_number_max: number;
  minimum_credits?: number;
  exclude_course_codes?: string[];
  label: string;
}

export interface FiniteListSelector {
  version: 1;
  kind: "course_codes";
  course_codes: string[];
  minimum_credits?: number;
  label: string;
}

export type CourseSelector = SubjectLevelSelector | FiniteListSelector;

export interface CourseSelectorDefinition {
  key: string;
  source_id: string;
  source_label: string;
  review_status: Exclude<ReviewStatus, "catalog_listed">;
  reviewed_at: number;
  selector: CourseSelector;
}

export interface RequirementConditionDefinition {
  type: string;
  value: unknown;
  note: string | null;
  source_id: string;
  review_status: Exclude<ReviewStatus, "catalog_listed">;
}

export interface RequirementGroupDefinition {
  id: string;
  parent_group_id: string | null;
  name: string;
  rule: RequirementRule;
  count: number | null;
  sort_order: number;
  display_family: string | null;
  display_priority: number;
  courses: RequirementCourseDefinition[];
  selectors: CourseSelectorDefinition[];
  conditions: RequirementConditionDefinition[];
  evidence?: EvidenceDefinition;
}

export interface ProgramEligibilityRuleDefinition {
  key: string;
  condition_type: string;
  condition_value: unknown;
  decision: string;
  note: string;
  source_id: string;
  review_status: Exclude<ReviewStatus, "catalog_listed">;
  verified_at: number;
}

export interface ProgramDefinition {
  contract_version: 1;
  program: ProgramIdentity;
  sources: ProgramSourceDefinition[];
  requirement_groups: RequirementGroupDefinition[];
  eligibility_rules: ProgramEligibilityRuleDefinition[];
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: ProgramDefinition; issues: [] }
  | { ok: false; issues: ValidationIssue[] };

