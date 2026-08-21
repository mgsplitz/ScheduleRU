const COURSE_CODE = /^\d{2}:\d{3}:\d{3}$/;

type ReviewedCondition = {
  condition_type?: string;
  condition_value_json?: string | Record<string, unknown>;
  review_status?: string;
};

type ReviewedEligibility = {
  review?: {
    course_code?: string;
    review_status?: string;
    no_known_conditions?: number | boolean;
  } | null;
  conditions?: ReviewedCondition[];
  credit_exclusions?: Array<{ policy_key?: string }>;
} | null;

export type CompiledCourseRules = {
  prerequisitePaths: string[][];
  enforceablePrerequisitePaths: string[][];
  corequisitePaths: string[][];
  minimumPlanYear: number | null;
  minimumPriorCredits: number | null;
  creditExclusionFamilies: string[];
  ruleCoverage: "reviewed" | "catalog_parsed" | "unresolved";
};

type CompileCourseRulesInput = {
  code?: string;
  catalogRecordAvailable?: boolean;
  catalogPrereqs?: string;
  catalogRestrictions?: string;
  requirementNotes?: string[];
  reviewedEligibility?: ReviewedEligibility;
};

type Token = { type: "course" | "(" | ")" | "and" | "or"; value: string };

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function deduplicatePaths(paths: string[][]): string[][] {
  const seen = new Set<string>();
  return paths.map((path) => unique(path.filter((code) => COURSE_CODE.test(code))))
    .filter((path) => {
      if (!path.length) return false;
      const key = path.join(",");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function combinePaths(left: string[][], right: string[][]): string[][] {
  if (left.length * right.length > 128) throw new Error("prerequisite expression is too large");
  return left.flatMap((leftPath) => right.map((rightPath) => unique([...leftPath, ...rightPath])));
}

function expressionTokens(raw: string): Token[] {
  return [...cleanText(raw).matchAll(/\b\d{2}:\d{3}:\d{3}\b|\(|\)|\b(?:and|or)\b(?=\s*(?:\(|\d{2}:\d{3}:\d{3}\b))/gi)]
    .map((match) => {
      const value = match[0];
      if (COURSE_CODE.test(value)) return { type: "course", value } as Token;
      if (value === "(" || value === ")") return { type: value, value } as Token;
      const type = value.toLowerCase() as "and" | "or";
      return { type, value: type };
    });
}

function parsedCatalogPaths(raw: string): string[][] {
  const tokens = expressionTokens(raw);
  if (!tokens.some((token) => token.type === "course")) return [];
  let position = 0;
  const peek = () => tokens[position];
  const take = (type: Token["type"]): Token => {
    const token = peek();
    if (!token || token.type !== type) throw new Error("unexpected prerequisite expression");
    position += 1;
    return token;
  };
  const primary = (): string[][] => {
    if (peek()?.type === "course") return [[take("course").value]];
    take("(");
    const value = disjunction();
    take(")");
    return value;
  };
  const conjunction = (): string[][] => {
    let value = primary();
    while (peek()?.type === "and") {
      take("and");
      value = combinePaths(value, primary());
    }
    return value;
  };
  const disjunction = (): string[][] => {
    let value = conjunction();
    while (peek()?.type === "or") {
      take("or");
      value = value.concat(conjunction());
    }
    return value;
  };

  try {
    const paths = disjunction();
    if (position !== tokens.length) return [];
    return deduplicatePaths(paths);
  } catch {
    return [];
  }
}

function campusForCourse(code: string): "new_brunswick" | "newark" | "camden" | "" {
  if (!COURSE_CODE.test(code)) return "";
  const school = code.slice(0, 2);
  if (["21", "25", "26", "27", "28", "29"].includes(school)) return "newark";
  if (["50", "52", "53", "56", "57"].includes(school)) return "camden";
  return "new_brunswick";
}

function campusRelevantPaths(courseCode: string, paths: string[][]): string[][] {
  const campus = campusForCourse(courseCode);
  if (!campus) return paths;
  return paths.filter((path) => path.every((code) => campusForCourse(code) === campus));
}

function conditionValue(condition: ReviewedCondition): Record<string, unknown> | null {
  try {
    const parsed = typeof condition.condition_value_json === "string"
      ? JSON.parse(condition.condition_value_json)
      : condition.condition_value_json;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function courseChoices(condition: ReviewedCondition): string[] {
  const value = conditionValue(condition);
  return unique((Array.isArray(value?.any_of_course_codes) ? value.any_of_course_codes : [])
    .map(String)
    .filter((code) => COURSE_CODE.test(code)));
}

function pathsFromReviewedConditions(conditions: ReviewedCondition[], type: string): string[][] {
  const groups = conditions.filter((condition) => condition.condition_type === type)
    .map(courseChoices)
    .filter((choices) => choices.length);
  if (!groups.length) return [];
  try {
    return deduplicatePaths(groups.reduce(
      (paths, choices) => combinePaths(paths, choices.map((choice) => [choice])),
      [[]] as string[][],
    ));
  } catch {
    return [];
  }
}

function minimumYearFromText(raw: string): number | null {
  const value = cleanText(raw).toLowerCase();
  if (/\bseniors?\s+(?:year|standing|status|only)\b|\b4th\s+year\b/.test(value)) return 4;
  if (/\bjuniors?\s*(?:\/|or|and|-)\s*seniors?\b|\bjuniors?\s+(?:year|standing|status|only)\b|\b3rd\s+year\b/.test(value)) return 3;
  if (/\ball\s+except\s+(?:1st|first)[ -]?year\b|\bnot\s+open\s+to\s+(?:1st|first)[ -]?year\b/.test(value)) return 2;
  return null;
}

function numericCondition(conditions: ReviewedCondition[], type: string, key: string): number | null {
  for (const condition of conditions) {
    if (condition.condition_type !== type) continue;
    const number = Number(conditionValue(condition)?.[key]);
    if (Number.isFinite(number) && number >= 0) return number;
  }
  return null;
}

export function compileCourseRules(input: CompileCourseRulesInput = {}): CompiledCourseRules {
  const eligibility = input.reviewedEligibility;
  const reviewed = eligibility?.review?.review_status === "reviewed";
  const conditions = (eligibility?.conditions || []).filter((condition) => condition.review_status === "reviewed");
  const reviewedPrerequisites = pathsFromReviewedConditions(conditions, "prerequisite_course");
  const reviewedCorequisites = pathsFromReviewedConditions(conditions, "corequisite_course");
  const catalogPaths = campusRelevantPaths(String(input.code || ""), parsedCatalogPaths(input.catalogPrereqs || ""));
  const restrictions = [input.catalogRestrictions, ...(input.requirementNotes || [])].map(cleanText).join(" ");
  const minimumPlanYear = numericCondition(conditions, "minimum_plan_year", "minimum_year")
    || minimumYearFromText(restrictions);
  const minimumPriorCredits = numericCondition(conditions, "minimum_prior_credits", "minimum_credits");
  const verifiedNoConditions = reviewed
    && Number(eligibility?.review?.no_known_conditions) === 1
    && conditions.length === 0;
  const prerequisitePaths = reviewedPrerequisites.length
    ? reviewedPrerequisites
    : verifiedNoConditions ? [] : catalogPaths;
  const creditExclusionFamilies = unique((eligibility?.credit_exclusions || [])
    .map((policy) => cleanText(policy.policy_key))
    .filter(Boolean))
    .sort();

  return {
    prerequisitePaths,
    enforceablePrerequisitePaths: prerequisitePaths,
    corequisitePaths: reviewedCorequisites,
    minimumPlanYear,
    minimumPriorCredits,
    creditExclusionFamilies,
    ruleCoverage: reviewed ? "reviewed" : input.catalogRecordAvailable || prerequisitePaths.length || minimumPlanYear !== null
      ? "catalog_parsed"
      : "unresolved",
  };
}
