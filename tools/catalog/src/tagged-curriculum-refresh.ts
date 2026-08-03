import {
  validateProgramDefinition,
  type ProgramDefinition,
  type RequirementCourseDefinition,
  type RequirementGroupDefinition,
} from "@scheduleru/catalog";
import type {
  TaggedCurriculumCourse,
} from "./adapters/tagged-curriculum-source.ts";

export interface CurriculumAssignmentChange {
  group_id: string;
  course_code: string;
}

export interface TaggedCurriculumRefreshReport {
  program_id: string;
  source_url: string;
  accessed_at: number;
  previous_assignment_count: number;
  generated_assignment_count: number;
  added: CurriculumAssignmentChange[];
  removed: CurriculumAssignmentChange[];
}

function terminalTag(name: string): string | null {
  const match = name.match(/\[([A-Z][A-Za-z]{1,3})\](?:\s|$)/);
  return match?.[1] ?? null;
}

function normalizedCourse(
  course: TaggedCurriculumCourse,
): RequirementCourseDefinition {
  return {
    code: course.code,
    title: course.title,
    credits: course.credits,
    note: null,
  };
}

function assignmentRows(
  definition: ProgramDefinition,
): CurriculumAssignmentChange[] {
  return definition.requirement_groups
    .flatMap((group) => group.courses.map((course) => ({
      group_id: group.id,
      course_code: course.code,
    })))
    .sort((left, right) =>
      left.group_id.localeCompare(right.group_id)
      || left.course_code.localeCompare(right.course_code)
    );
}

function assignmentDifference(
  left: CurriculumAssignmentChange[],
  right: CurriculumAssignmentChange[],
): CurriculumAssignmentChange[] {
  const rightKeys = new Set(right.map(({ group_id, course_code }) =>
    `${group_id}\u0000${course_code}`
  ));
  return left.filter(({ group_id, course_code }) =>
    !rightKeys.has(`${group_id}\u0000${course_code}`)
  );
}

function unreviewGroup(group: RequirementGroupDefinition): RequirementGroupDefinition {
  return {
    ...group,
    courses: group.courses.map((course) => ({
      ...course,
      ...(course.evidence
        ? { evidence: { ...course.evidence, review_status: "unreviewed" as const } }
        : {}),
    })),
    selectors: group.selectors.map((selector) => ({
      ...selector,
      review_status: "unreviewed",
    })),
    conditions: group.conditions.map((condition) => ({
      ...condition,
      review_status: "unreviewed",
    })),
    ...(group.evidence
      ? { evidence: { ...group.evidence, review_status: "unreviewed" as const } }
      : {}),
  };
}

export function buildTaggedCurriculumDraft(
  reviewed: ProgramDefinition,
  courses: TaggedCurriculumCourse[],
  accessedAt: number,
): { definition: ProgramDefinition; report: TaggedCurriculumRefreshReport } {
  if (reviewed.program.type !== "core_curriculum") {
    throw new Error("tagged curriculum source must be a core_curriculum definition");
  }
  if (!Number.isFinite(accessedAt) || accessedAt < 0) {
    throw new Error("accessedAt must be a non-negative timestamp");
  }
  const sourceMatches = reviewed.sources.filter(({ url }) =>
    url === reviewed.program.source_url
  );
  if (sourceMatches.length !== 1) {
    throw new Error("program source URL must match exactly one declared source");
  }

  const children = new Map<string, string[]>();
  for (const group of reviewed.requirement_groups) {
    if (group.parent_group_id) {
      const siblings = children.get(group.parent_group_id) || [];
      siblings.push(group.id);
      children.set(group.parent_group_id, siblings);
    }
  }
  const tagToGroup = new Map<string, RequirementGroupDefinition>();
  for (const group of reviewed.requirement_groups) {
    const isLeaf = !(children.get(group.id)?.length);
    if (!isLeaf) continue;
    const tag = terminalTag(group.name);
    if (!tag) {
      if (group.courses.length) {
        throw new Error(`populated leaf group ${group.id} has no source tag`);
      }
      continue;
    }
    if (tagToGroup.has(tag)) {
      throw new Error(`tag ${tag} is assigned to multiple leaf groups`);
    }
    tagToGroup.set(tag, group);
  }
  if (!tagToGroup.size) {
    throw new Error("definition contains no tagged leaf groups");
  }

  const coursesByTag = new Map<string, TaggedCurriculumCourse[]>();
  for (const course of courses) {
    for (const tag of course.tags) {
      if (!tagToGroup.has(tag)) {
        throw new Error(`source tag ${tag} has no matching tagged leaf group`);
      }
      const tagged = coursesByTag.get(tag) || [];
      tagged.push(course);
      coursesByTag.set(tag, tagged);
    }
  }
  for (const [tag, group] of tagToGroup) {
    if (!(coursesByTag.get(tag)?.length)) {
      throw new Error(`tagged group ${group.id} received no source courses`);
    }
  }

  const generatedCourses = new Map<string, RequirementCourseDefinition[]>();
  for (const [tag, group] of tagToGroup) {
    generatedCourses.set(
      group.id,
      (coursesByTag.get(tag) || [])
        .map(normalizedCourse)
        .sort((left, right) => left.code.localeCompare(right.code)),
    );
  }

  const descendantCourses = (
    groupId: string,
    path = new Set<string>(),
  ): RequirementCourseDefinition[] => {
    if (path.has(groupId)) throw new Error(`requirement cycle at ${groupId}`);
    const direct = generatedCourses.get(groupId);
    if (direct) return direct;
    const nextPath = new Set(path).add(groupId);
    const rows = (children.get(groupId) || [])
      .flatMap((childId) => descendantCourses(childId, nextPath));
    const unique = new Map(rows.map((course) => [course.code, course]));
    return [...unique.values()].sort((left, right) => left.code.localeCompare(right.code));
  };

  const groups = reviewed.requirement_groups.map((original) => {
    let group = structuredClone(original);
    if (generatedCourses.has(group.id)) {
      group.courses = generatedCourses.get(group.id) || [];
    } else if ((children.get(group.id)?.length) && original.courses.length) {
      const aggregate = descendantCourses(group.id);
      if (!aggregate.length) {
        throw new Error(`populated aggregate group ${group.id} has no tagged descendants`);
      }
      group.courses = aggregate;
    }
    return unreviewGroup(group);
  });

  const definition: ProgramDefinition = {
    ...structuredClone(reviewed),
    program: {
      ...structuredClone(reviewed.program),
      review_status: "unreviewed",
    },
    sources: reviewed.sources.map((source) => ({
      ...structuredClone(source),
      ...(source.url === reviewed.program.source_url
        ? { accessed_at: accessedAt }
        : {}),
    })),
    requirement_groups: groups,
    eligibility_rules: reviewed.eligibility_rules.map((rule) => ({
      ...structuredClone(rule),
      review_status: "unreviewed",
    })),
  };
  const validation = validateProgramDefinition(definition);
  if (!validation.ok) {
    throw new Error(validation.issues
      .map((issue) => `${issue.path || "<root>"}: ${issue.message}`)
      .join("; "));
  }

  const previous = assignmentRows(reviewed);
  const generated = assignmentRows(validation.value);
  return {
    definition: validation.value,
    report: {
      program_id: validation.value.program.id,
      source_url: validation.value.program.source_url,
      accessed_at: accessedAt,
      previous_assignment_count: previous.length,
      generated_assignment_count: generated.length,
      added: assignmentDifference(generated, previous),
      removed: assignmentDifference(previous, generated),
    },
  };
}
