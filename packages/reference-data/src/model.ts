export const REVIEW_STATUSES = ["unreviewed", "reviewed", "needs_fix"] as const;
export const PROGRAM_SELECTION_DECISIONS = [
  "allowed",
  "blocked",
  "requires_approval",
  "requires_transfer",
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type ProgramSelectionDecision =
  (typeof PROGRAM_SELECTION_DECISIONS)[number];

export interface SchoolProfile {
  slug: string;
  institution_slug: string;
  campus_slug: string;
  name: string;
  short_name: string;
  catalog_year: string | null;
  configuration: Record<string, unknown>;
  source_url: string;
  source_title: string;
  review_status: ReviewStatus;
  reviewed_at: number | null;
  sort_order: number;
}

export interface SchoolCurriculumModule {
  school_slug: string;
  module_type: "core_curriculum";
  curriculum_program_id: string;
  source_url: string;
  review_status: ReviewStatus;
  reviewed_at: number | null;
  sort_order: number;
}

export interface ProgramSelectionLimit {
  home_school_slug: string;
  program_type: string;
  max_selected: number;
  note: string;
  source_url: string;
  verified_at: number;
}

export interface ProgramCombinationPolicy {
  policy_key: string;
  home_school_slug: string;
  program_a_id: string | null;
  program_a_school_slug: string | null;
  program_a_type: string | null;
  program_b_id: string | null;
  program_b_school_slug: string | null;
  program_b_type: string | null;
  same_program_family: boolean;
  decision: ProgramSelectionDecision;
  note: string;
  source_url: string;
  verified_at: number;
}

export interface DoubleCountRule {
  program_a: string;
  program_b: string;
  max_shared_credits: number | null;
  note: string | null;
}

export interface DoubleCountException {
  program_a: string;
  program_b: string;
  allowed_course_codes: string[];
  note: string | null;
  source_url: string | null;
  review_status: ReviewStatus;
  verified_at: number | null;
}

export interface RequirementCourseEquivalency {
  program_id: string;
  requirement_course_code: string;
  equivalent_course_code: string;
  note: string | null;
  source_label: string | null;
  review_status: "reviewed" | "needs_review";
}

export type CourseEligibilityReviewStatus = "draft" | "reviewed" | "stale";
export type CourseEligibilityConditionType =
  | "prerequisite_course"
  | "corequisite_course"
  | "minimum_prior_credits"
  | "minimum_plan_year";

export interface CourseEligibilityReview {
  course_code: string;
  campus_slug: string;
  catalog_year: string | null;
  review_status: CourseEligibilityReviewStatus;
  no_known_conditions: boolean;
  source_url: string;
  source_label: string;
  source_date: string | null;
  reviewed_at: number | null;
  note: string | null;
}

export interface CourseEligibilityCondition {
  course_code: string;
  condition_key: string;
  condition_type: CourseEligibilityConditionType;
  condition_value: Record<string, unknown>;
  review_status: CourseEligibilityReviewStatus;
  source_url: string;
  source_label: string;
  source_date: string | null;
  reviewed_at: number | null;
}

export interface ReferenceDataBundle {
  contract_version: 1;
  school_profiles: SchoolProfile[];
  school_curriculum_modules: SchoolCurriculumModule[];
  program_selection_limits: ProgramSelectionLimit[];
  program_combination_policies: ProgramCombinationPolicy[];
  double_count_rules: DoubleCountRule[];
  double_count_exceptions: DoubleCountException[];
  requirement_course_equivalencies: RequirementCourseEquivalency[];
  course_eligibility_reviews: CourseEligibilityReview[];
  course_eligibility_conditions: CourseEligibilityCondition[];
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export type ValidationResult =
  | { ok: true; value: ReferenceDataBundle; issues: [] }
  | { ok: false; issues: ValidationIssue[] };
