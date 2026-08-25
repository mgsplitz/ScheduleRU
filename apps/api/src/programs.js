/**
 * Degree requirements: scraper + parser + API — Cloudflare Worker module
 *
 * ============================================================
 * WHY THIS FILE EXISTS / HOW IT DIFFERS FROM worker.js's course sync
 * ============================================================
 * courses.json is a real Rutgers API with a stable JSON shape. There is no
 * equivalent for major/minor requirements — that data only exists as
 * human-readable prose on Rutgers' public Coursedog-powered catalog site
 * (catalogs.rutgers.edu). So instead of "fetch JSON, map fields," this file
 * has to "fetch HTML, flatten it to text, regex out the parts that look
 * like course requirement lines, and set aside the parts that don't."
 *
 * That last part is the key difference from the course sync: this parser
 * WILL leave things unhandled on purpose. Prose like "at most two courses
 * from the following, with adviser approval" doesn't reduce to a clean
 * {course, credits} row — it goes into requirement_raw_notes and waits for
 * a human (you, via /api/admin/review) to encode it once as a proper
 * requirement_groups row. Budget real time for that step per program.
 *
 * VERIFY THIS AGAINST REAL DATA, same as worker.js's mapCourseJson: the
 * HTML->text flattening and the course-line regex below were built from one
 * confirmed sample page (RBS/BAIT). Every scrape logs a raw text sample to
 * scrape_log — check GET /api/admin/scrape-log if a program comes back
 * with zero groups or looks wrong, and adjust the isolated parser module.
 * Coursedog's actual markup may use different wrapper tags per school
 * (tables vs <p> vs <li>) — the flattener tries to be tag-agnostic (it just
 * looks for block boundaries and bold spans) specifically so it doesn't
 * depend on guessing exact class names, but there will be edge cases.
 */

import {
  evaluateProgramSelection,
  publicEligibilityRule,
} from "./programs/selection-policy.js";
import {
  requirementEvidenceComplete,
} from "./programs/requirement-evidence.js";
import { publicSchoolProfile } from "./programs/school-profile.js";
import { handlePublicProgramRoute } from "./programs/public-routes.js";
import { handleProgramAdminRoute } from "./programs/admin-routes.js";
import {
  createPublicProgramRepository,
} from "./programs/storage/public-program-repository.js";
import {
  createAdminProgramRepository,
} from "./programs/storage/admin-program-repository.js";
import {
  parseBizTable,
} from "./programs/scrapers/business-school-parser.js";
import {
  createCatalogDirectoryImportService,
} from "./programs/services/catalog-directory-import-service.js";
import {
  createCatalogDirectoryRepository,
} from "./programs/storage/catalog-directory-repository.js";
import {
  createRequirementImportService,
  requirementSourceImportBatchLimit,
} from "./programs/services/requirement-import-service.js";
import {
  createRequirementImportRepository,
} from "./programs/storage/requirement-import-repository.js";
import {
  createRequirementCandidateService,
} from "./programs/services/requirement-candidate-service.js";
import {
  createRequirementCandidateRepository,
} from "./programs/storage/requirement-candidate-repository.js";
import {
  createRequirementDiscoveryService,
} from "./programs/services/requirement-discovery-service.js";
import {
  createRequirementDiscoveryRepository,
} from "./programs/storage/requirement-discovery-repository.js";
import {
  createProgramScrapeService,
} from "./programs/services/program-scrape-service.js";
import {
  createProgramScrapeRepository,
} from "./programs/storage/program-scrape-repository.js";
import { compileCourseRules } from "../../../packages/catalog/src/course-rule-compiler.ts";

export { parseBizTable, groupAppliesToSelection, allocationForConditions };

export function compilePublicCourseRules(row = {}, prerequisiteSubstitutions = []) {
  return compileCourseRules({
    code: row.course_code || row.equivalent_course_code,
    catalogRecordAvailable: !!(row.catalog_title || row.catalog_record_available),
    catalogPrereqs: row.catalog_prereqs,
    catalogRestrictions: row.section_restrictions || row.catalog_restrictions,
    requirementNotes: [row.note].filter(Boolean),
    reviewedEligibility: row.eligibility,
    prerequisiteSubstitutions,
  });
}

export async function getReviewedPrerequisiteSubstitutions(env) {
  const { results } = await env.DB.prepare(
    `SELECT required_course_code, satisfying_course_code, campus_slug,
            catalog_year, note, source_url, source_label, source_date,
            review_status, reviewed_at
     FROM course_prerequisite_substitutions
     WHERE review_status = 'reviewed'
     ORDER BY required_course_code, satisfying_course_code`
  ).bind().all();
  return results || [];
}

function normalizedCatalogText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizedDegreeType(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z]/g, "");
}

function reviewedProgramMatchesCatalog(reviewed, catalog) {
  if (!reviewed || !catalog || reviewed.type !== catalog.type) return false;
  if (reviewed.id === catalog.id) return true;
  const catalogDegree = normalizedDegreeType(catalog.degree_type);
  const reviewedDegree = normalizedDegreeType(reviewed.degree_type);
  const degreesMatch = !catalogDegree || !reviewedDegree
    || catalogDegree === reviewedDegree
    || catalogDegree.includes(reviewedDegree);
  if (!degreesMatch) return false;
  return reviewed.program_slug === catalog.program_slug
    || normalizedCatalogText(reviewed.name) === normalizedCatalogText(catalog.name);
}

function reviewedProgramForCatalog(catalog, reviewedPrograms) {
  return (reviewedPrograms || []).find((reviewed) => reviewedProgramMatchesCatalog(reviewed, catalog)) || null;
}

// An official catalog listing is sufficient to let a student identify a
// program they intend to pursue; it is never sufficient to present a degree
// audit. Reviewed records replace their catalog counterpart when available.
export function publishedCatalogPrograms(catalogPrograms = [], reviewedPrograms = []) {
  const seenReviewedIds = new Set();
  const programs = (catalogPrograms || []).map((catalog) => {
    const reviewed = reviewedProgramForCatalog(catalog, reviewedPrograms);
    if (!reviewed) {
      return {
        ...catalog,
        coverage_status: "catalog_listed",
        requirements_available: false,
        requirements_notice: "Catalog-listed program: its program-specific requirements are still being reviewed. Use the official program source and advising to confirm degree progress.",
      };
    }
    seenReviewedIds.add(reviewed.id);
    return {
      ...reviewed,
      // Preserve the catalog identity that this reviewed row replaces.  The
      // browser uses it to upgrade a saved catalog-only selection on the
      // next refresh, so students do not have to remove and re-add a program
      // simply because its audited path has become available.
      catalog_program_id: catalog.id,
      coverage_status: "reviewed",
      requirements_available: true,
      requirements_notice: null,
    };
  });

  for (const reviewed of reviewedPrograms) {
    if (!seenReviewedIds.has(reviewed.id)) {
      programs.push({
        ...reviewed,
        coverage_status: "reviewed",
        requirements_available: true,
        requirements_notice: null,
      });
    }
  }
  return programs.sort((a, b) => a.name.localeCompare(b.name)
    || a.type.localeCompare(b.type)
    || String(a.degree_type || "").localeCompare(String(b.degree_type || "")));
}

/* ============================================================
   CONFIG
   ============================================================ */
function catalogBase(env) {
  // e.g. "newbrunswick-undergrad-25-26" — the subdomain Rutgers/Coursedog
  // uses for this campus+catalog-year. Changes annually when the new
  // catalog year publishes; override via CATALOG_SUBDOMAIN in wrangler.toml
  // rather than editing this file each year.
  return env.CATALOG_SUBDOMAIN || "newbrunswick-undergrad-25-26";
}

async function logScrape(env, programId, status, counts, message, rawSample) {
  await env.DB.prepare(
    `INSERT INTO scrape_log (program_id, status, groups_written, courses_written, notes_written, message, raw_sample, scraped_at)
     VALUES (?,?,?,?,?,?,?,?)`
  ).bind(
    programId, status, counts?.groupsWritten ?? 0, counts?.coursesWritten ?? 0, counts?.notesWritten ?? 0,
    message, rawSample, Date.now()
  ).run();
}

/* ============================================================
   READ: nested requirement tree for one or more programs
   ============================================================ */
function conditionProgramIds(condition) {
  try {
    const values = JSON.parse(condition?.condition_value_json || "[]");
    return Array.isArray(values) ? new Set(values.filter(isSafeProgramId)) : new Set();
  } catch {
    return new Set();
  }
}

function allocationForConditions(conditions) {
  let family = null;
  let maxUses = null;
  let hasAllocationCondition = false;
  for (const condition of conditions || []) {
    if (condition?.condition_type !== "allocation_family" && condition?.condition_type !== "max_uses") continue;
    hasAllocationCondition = true;
    let value;
    try {
      value = JSON.parse(condition.condition_value_json || "{}");
    } catch {
      return null;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (condition.condition_type === "allocation_family") {
      const candidate = typeof value.allocation_family === "string" ? value.allocation_family.trim() : "";
      if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/.test(candidate) || (family && family !== candidate)) return null;
      family = candidate;
      continue;
    }
    const candidate = Number(value.max_uses);
    if (!Number.isInteger(candidate) || candidate < 1 || (maxUses !== null && maxUses !== candidate)) return null;
    maxUses = candidate;
  }
  return hasAllocationCondition && family && maxUses !== null
    ? { allocation_family: family, max_uses: maxUses }
    : null;
}

function groupAppliesToSelection(groupId, conditionsByGroup, selectedProgramIds) {
  const selected = new Set((selectedProgramIds || []).filter(isSafeProgramId));
  const conditions = conditionsByGroup[groupId] || [];
  const hasAllocationCondition = conditions.some((condition) =>
    condition?.condition_type === "allocation_family" || condition?.condition_type === "max_uses"
  );
  // A partial or malformed reviewed allocation must not silently lift a
  // no-double-count rule. It remains invisible until the reviewed data has a
  // complete family and positive usage cap.
  if (hasAllocationCondition && !allocationForConditions(conditions)) return false;
  for (const condition of conditions) {
    if (condition.condition_type === "allocation_family" || condition.condition_type === "max_uses") continue;
    const expected = conditionProgramIds(condition);
    if (condition.condition_type === "selected_program_must_include_one_of") {
      if (![...expected].some((id) => selected.has(id))) return false;
      continue;
    }
    if (condition.condition_type === "selected_program_must_not_include_any") {
      if ([...expected].some((id) => selected.has(id))) return false;
      continue;
    }
    // An unrecognized condition must never expose a path that has not been
    // deliberately implemented and tested.
    return false;
  }
  return true;
}

const COURSE_ELIGIBILITY_CODE = /^\d{2}:\d{3}:\d{3}$/;
// D1 accepts at most 100 bind variables per statement. The Core curriculum
// contains more course rows than that, so lookup batches must not exceed it.
const COURSE_ELIGIBILITY_BATCH_SIZE = 100;

function reviewedCourseCodes(values) {
  return [...new Set((values || [])
    .map((value) => String(value || "").trim())
    .filter((code) => COURSE_ELIGIBILITY_CODE.test(code)))];
}

export async function getReviewedCourseEligibility(env, rawCodes) {
  const codes = reviewedCourseCodes(rawCodes);
  const output = {};
  for (let offset = 0; offset < codes.length; offset += COURSE_ELIGIBILITY_BATCH_SIZE) {
    const batch = codes.slice(offset, offset + COURSE_ELIGIBILITY_BATCH_SIZE);
    const placeholders = batch.map(() => "?").join(",");
    const [reviews, conditions, creditExclusions] = await env.DB.batch([
      env.DB.prepare(
        `SELECT course_code, review_status, no_known_conditions, source_url, source_label, source_date
         FROM course_eligibility_reviews
         WHERE review_status = 'reviewed' AND course_code IN (${placeholders})`
      ).bind(...batch),
      env.DB.prepare(
        `SELECT course_code, condition_key, condition_type, condition_value_json, review_status, source_url, source_label, source_date
         FROM course_eligibility_conditions
         WHERE review_status = 'reviewed' AND course_code IN (${placeholders})
         ORDER BY course_code, condition_key`
      ).bind(...batch),
      env.DB.prepare(
        `SELECT member.course_code, policy.policy_key, policy.max_courses,
                policy.note, policy.source_url, policy.source_label,
                policy.source_date
         FROM course_credit_exclusion_members member
         INNER JOIN course_credit_exclusion_policies policy
           ON policy.policy_key = member.policy_key
         WHERE policy.review_status = 'reviewed'
           AND member.course_code IN (${placeholders})
         ORDER BY member.course_code, policy.policy_key`
      ).bind(...batch),
    ]);
    for (const review of reviews.results || []) {
      output[review.course_code] = { review, conditions: [], credit_exclusions: [] };
    }
    for (const condition of conditions.results || []) {
      if (output[condition.course_code]) output[condition.course_code].conditions.push(condition);
    }
    for (const exclusion of creditExclusions.results || []) {
      const course = output[exclusion.course_code] ||= {
        review: null,
        conditions: [],
        credit_exclusions: [],
      };
      course.credit_exclusions.push({
        policy_key: exclusion.policy_key,
        max_courses: exclusion.max_courses,
        note: exclusion.note,
        source_url: exclusion.source_url,
        source_label: exclusion.source_label,
        source_date: exclusion.source_date,
      });
    }
  }
  return output;
}

export function programRequirementStructureComplete({ groups = [], courses = [], selectors = [] } = {}) {
  if (!groups.length) return false;
  const parentIds = new Set(groups.map((group) => group.parent_group_id).filter(Boolean));
  const leafIds = groups.map((group) => group.id).filter((id) => id && !parentIds.has(id));
  if (!leafIds.length) return false;
  const candidateGroupIds = new Set([
    ...courses.map((course) => course.group_id),
    ...selectors.map((selector) => selector.group_id),
  ].filter(Boolean));
  return leafIds.every((id) => candidateGroupIds.has(id));
}

export async function programHasCompleteRequirementEvidence(env, program) {
  const [groupsResult, selectorsResult, coursesResult, evidenceResult] = await env.DB.batch([
    env.DB.prepare(
      "SELECT id, parent_group_id FROM requirement_groups WHERE program_id = ?"
    ).bind(program.id),
    env.DB.prepare(
      `SELECT selector.group_id
       FROM requirement_course_selectors selector
       INNER JOIN requirement_groups group_row ON group_row.id = selector.group_id
       WHERE group_row.program_id = ? AND selector.review_status = 'reviewed'`
    ).bind(program.id),
    env.DB.prepare(
      `SELECT rc.group_id, rc.course_code
       FROM requirement_courses rc
       INNER JOIN requirement_groups g ON g.id = rc.group_id
       WHERE g.program_id = ?`
    ).bind(program.id),
    env.DB.prepare(
      `SELECT entity_key, entity_type, group_id, course_code, source_url,
              source_title, source_catalog_year, accessed_at, reviewer_note, review_status
       FROM program_requirement_evidence
       WHERE program_id = ?`
    ).bind(program.id),
  ]);
  const structureComplete = programRequirementStructureComplete({
    groups: groupsResult.results || [],
    courses: coursesResult.results || [],
    selectors: selectorsResult.results || [],
  });
  if (!structureComplete) return false;
  if (Number(program?.requirement_evidence_required) !== 1) return true;
  return requirementEvidenceComplete({
    required: true,
    groups: groupsResult.results || [],
    courses: coursesResult.results || [],
    evidence: evidenceResult.results || [],
  });
}

async function getRequirementTree(env, programId, selectedProgramIds = [programId]) {
  // A major can inherit one or more reusable requirement sets. For example,
  // every RBS-New Brunswick major links to the single RBS Foundational Core
  // (formerly Pre-Business) set. The set owns its own groups/course rows, so
  // they are stored once and appear once when a single major is loaded.
  const { results: sharedSets } = await env.DB.prepare(
    `SELECT requirement_set_id
     FROM program_requirement_sets
     WHERE program_id = ?
     ORDER BY sort_order, requirement_set_id`
  ).bind(programId).all();
  const ownerIds = [...sharedSets.map((row) => row.requirement_set_id), programId];
  const placeholders = ownerIds.map(() => "?").join(",");
  const { results: groups } = await env.DB.prepare(
    `SELECT * FROM requirement_groups
     WHERE program_id IN (${placeholders})
     ORDER BY CASE WHEN program_id = ? THEN 1 ELSE 0 END, sort_order, id`
  ).bind(...ownerIds, programId).all();
  const groupIds = groups.map((group) => group.id);
  const conditionsByGroup = {};
  if (groupIds.length) {
    const { results: conditions } = await env.DB.prepare(
      `SELECT group_id, condition_type, condition_value_json
       FROM requirement_group_conditions
       WHERE review_status = 'reviewed'
         AND group_id IN (${groupIds.map(() => "?").join(",")})`
    ).bind(...groupIds).all();
    for (const condition of conditions || []) (conditionsByGroup[condition.group_id] ||= []).push(condition);
  }
  const eligibleGroupIds = new Set(groups
    .filter((group) => groupAppliesToSelection(group.id, conditionsByGroup, selectedProgramIds))
    .map((group) => group.id));
  const visibleGroups = groups.filter((group) => {
    if (!eligibleGroupIds.has(group.id)) return false;
    let parentId = group.parent_group_id;
    while (parentId) {
      if (!eligibleGroupIds.has(parentId)) return false;
      parentId = groups.find((candidate) => candidate.id === parentId)?.parent_group_id || null;
    }
    return true;
  });
  const visibleGroupIds = visibleGroups.map((group) => group.id);
  const selectorsByGroup = {};
  if (visibleGroupIds.length) {
    const { results: selectors } = await env.DB.prepare(
      `SELECT group_id, selector_key, selector_json, source_url, source_label
       FROM requirement_course_selectors
       WHERE review_status = 'reviewed'
         AND group_id IN (${visibleGroupIds.map(() => "?").join(",")})
       ORDER BY group_id, selector_key`
    ).bind(...visibleGroupIds).all();
    for (const selector of selectors || []) (selectorsByGroup[selector.group_id] ||= []).push(selector);
  }
  const { results: courses } = visibleGroupIds.length ? await env.DB.prepare(
    `SELECT rc.*, g.program_id as owner_program_id,
            COALESCE(cr.title, c.title) as catalog_title,
            COALESCE(NULLIF(cr.credits, ''), c.credits) as catalog_credits,
            c.description as catalog_description,
            cr.catalog_prereqs as catalog_prereqs,
            c.subject_notes as catalog_subject_notes,
            COALESCE(NULLIF(cr.catalog_restrictions, ''), (
              SELECT GROUP_CONCAT(DISTINCT s.restrictions)
              FROM sections s
              WHERE s.course_id = c.id AND NULLIF(TRIM(s.restrictions), '') IS NOT NULL
            )) as section_restrictions
     FROM requirement_courses rc
     INNER JOIN requirement_groups g ON g.id = rc.group_id
     LEFT JOIN course_reference cr ON cr.course_code = rc.course_code
     LEFT JOIN courses c ON c.id = (
       SELECT c2.id
       FROM courses c2
       WHERE c2.school || ':' || c2.subject_code || ':' || c2.course_number = rc.course_code
       ORDER BY c2.year DESC, CAST(c2.term AS INTEGER) DESC
       LIMIT 1
     )
     WHERE rc.group_id IN (${visibleGroupIds.map(() => "?").join(",")})`
  ).bind(...visibleGroupIds).all() : { results: [] };
  // Alternatives are scoped to the requirement-set/program that owns the
  // course row. This lets Degree Navigator-only families be entered once as
  // reviewed data and avoids a frontend exception for any particular course.
  const { results: alternatives } = await env.DB.prepare(
    `SELECT e.*, cr.title as catalog_title, cr.credits as catalog_credits,
            cr.catalog_prereqs as catalog_prereqs,
            cr.catalog_restrictions as catalog_restrictions
     FROM requirement_course_equivalencies e
     LEFT JOIN course_reference cr ON cr.course_code = e.equivalent_course_code
     WHERE e.program_id IN (${placeholders}) AND e.review_status = 'reviewed'`
  ).bind(...ownerIds).all();
  const prerequisiteSubstitutions = await getReviewedPrerequisiteSubstitutions(env);
  const eligibilityByCode = await getReviewedCourseEligibility(env, [
    ...courses.map((course) => course.course_code),
    ...alternatives.map((course) => course.equivalent_course_code),
  ]);
  const alternativesByRequirement = {};
  for (const alternative of alternatives) {
    alternative.eligibility = eligibilityByCode[alternative.equivalent_course_code] || null;
    alternative.compiled_rules = compilePublicCourseRules(alternative, prerequisiteSubstitutions);
    const key = `${alternative.program_id}::${alternative.requirement_course_code}`;
    (alternativesByRequirement[key] ||= []).push(alternative);
  }

  const byGroup = {};
  for (const c of courses) {
    c.alternatives = alternativesByRequirement[`${c.owner_program_id}::${c.course_code}`] || [];
    c.eligibility = eligibilityByCode[c.course_code] || null;
    c.compiled_rules = compilePublicCourseRules(c, prerequisiteSubstitutions);
    (byGroup[c.group_id] ||= []).push(c);
  }
  const allocationsByGroup = Object.fromEntries(visibleGroups.map((group) => [
    group.id,
    allocationForConditions(conditionsByGroup[group.id]),
  ]));
  const familyMaxUses = new Map();
  for (const allocation of Object.values(allocationsByGroup)) {
    if (!allocation) continue;
    const current = familyMaxUses.get(allocation.allocation_family);
    familyMaxUses.set(allocation.allocation_family, current === undefined
      ? allocation.max_uses
      : Math.min(current, allocation.max_uses));
  }
  const byId = {};
  for (const g of visibleGroups) byId[g.id] = {
    ...g,
    allocation: allocationsByGroup[g.id] && {
      ...allocationsByGroup[g.id],
      max_uses: familyMaxUses.get(allocationsByGroup[g.id].allocation_family),
    },
    courses: byGroup[g.id] || [], course_selectors: selectorsByGroup[g.id] || [], children: [],
  };
  const roots = [];
  for (const g of visibleGroups) {
    if (g.parent_group_id && byId[g.parent_group_id]) byId[g.parent_group_id].children.push(byId[g.id]);
    else roots.push(byId[g.id]);
  }
  return roots;
}

async function getProgramSelectionPolicies(env, homeSchoolSlug) {
  const [limitsResult, combinationsResult] = await env.DB.batch([
    env.DB.prepare(
      `SELECT * FROM program_selection_limits WHERE home_school_slug = ? ORDER BY program_type`
    ).bind(homeSchoolSlug),
    env.DB.prepare(
      `SELECT * FROM program_combination_policies WHERE home_school_slug = ? ORDER BY policy_key`
    ).bind(homeSchoolSlug),
  ]);
  return {
    limits: limitsResult.results || [],
    combination_policies: combinationsResult.results || [],
  };
}

async function getProgramEligibilityRules(env, programIds) {
  const ids = [...new Set((Array.isArray(programIds) ? programIds : []).filter(isSafeProgramId))];
  if (!ids.length) return [];
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    const { results } = await env.DB.prepare(
      `SELECT rule_key, program_id, condition_type, condition_value_json,
              decision, note, source_url
       FROM program_eligibility_rules
       WHERE review_status = 'reviewed'
         AND program_id IN (${batch.map(() => "?").join(",")})
       ORDER BY program_id, rule_key`
    ).bind(...batch).all();
    rows.push(...(results || []));
  }
  return rows.map(publicEligibilityRule);
}

function isSafeHomeSchoolSlug(value) {
  return typeof value === "string" && /^[a-z0-9-]{2,80}$/.test(value);
}

function isSafeProgramId(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,119}$/.test(value);
}

/* ============================================================
   ROUTES
   ============================================================ */
export async function handleProgramsApi(request, env, ctx, path, url, json, checkAdmin) {
  const catalogDirectoryImportService = createCatalogDirectoryImportService({
    repository: createCatalogDirectoryRepository(env),
    recordScrape: (...args) => logScrape(env, ...args),
  });
  const requirementImportService = createRequirementImportService({
    repository: createRequirementImportRepository(env),
    recordScrape: (...args) => logScrape(env, ...args),
  });
  const requirementCandidateService = createRequirementCandidateService({
    repository: createRequirementCandidateRepository(env),
    recordScrape: (...args) => logScrape(env, ...args),
  });
  const requirementDiscoveryService = createRequirementDiscoveryService({
    repository: createRequirementDiscoveryRepository(env),
    recordScrape: (...args) => logScrape(env, ...args),
  });
  const programScrapeService = createProgramScrapeService({
    repository: createProgramScrapeRepository(env),
    recordScrape: (...args) => logScrape(env, ...args),
    catalogSubdomain: catalogBase(env),
  });
  const publicResponse = await handlePublicProgramRoute({
    request,
    env,
    path,
    url,
    json,
    services: {
      evaluateProgramSelection,
      getProgramEligibilityRules,
      getProgramSelectionPolicies,
      getRequirementTree,
      getReviewedCourseEligibility,
      isSafeHomeSchoolSlug,
      isSafeProgramId,
      programHasCompleteRequirementEvidence,
      publicSchoolProfile,
      publishedCatalogPrograms,
      reviewedCourseCodes,
      repository: createPublicProgramRepository(env),
    },
  });
  if (publicResponse) return publicResponse;

  const adminResponse = await handleProgramAdminRoute({
    request,
    env,
    ctx,
    path,
    url,
    json,
    checkAdmin,
    services: {
      discoverMajorRequirementSources: (profileSources) =>
        requirementDiscoveryService.discoverProfiles(profileSources),
      discoverNestedRequirementDetailSources: (parentSources) =>
        requirementDiscoveryService.discoverNestedDetails(parentSources),
      discoverPrograms: (schoolSlug, indexPath) =>
        programScrapeService.discoverPrograms(schoolSlug, indexPath),
      extractRequirementCandidateBatch: (snapshots) =>
        requirementCandidateService.extractBatch(snapshots),
      getRequirementTree,
      importCatalogDirectorySource: (sourceId) =>
        catalogDirectoryImportService.importSource(sourceId),
      importRequirementSource: (sourceId) =>
        requirementImportService.importSource(sourceId),
      importRequirementSourceBatch: (sources) =>
        requirementImportService.importBatch(sources),
      isSafeHomeSchoolSlug,
      pendingMajorProfileSources: (schoolSlug, batchLimit) =>
        requirementDiscoveryService.listPendingProfiles(schoolSlug, batchLimit),
      pendingNestedRequirementDetailSources: (schoolSlug, batchLimit) =>
        requirementDiscoveryService.listPendingNestedDetails(schoolSlug, batchLimit),
      pendingRequirementCandidateSnapshots: (schoolSlug, batchLimit) =>
        requirementCandidateService.listPendingSnapshots(schoolSlug, batchLimit),
      pendingRequirementSourceIds: (schoolSlug, batchLimit) =>
        requirementImportService.listPendingSources(schoolSlug, batchLimit),
      registerRequirementSourcesForSchool: (schoolSlug) =>
        requirementDiscoveryService.registerSchool(schoolSlug),
      requirementSourceImportBatchLimit,
      scrapeProgram: (program) => programScrapeService.scrapeCatalogProgram(program),
      scrapeProgramFromBizSite: (program) =>
        programScrapeService.scrapeBusinessProgram(program),
      repository: createAdminProgramRepository(env),
    },
  });
  if (adminResponse) return adminResponse;

  return null; // not a programs-related route — let worker.js fall through
}
