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
 * with zero groups or looks wrong, and adjust parseProgramText() below.
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
import { htmlToFlatText } from "./programs/scrapers/html.js";
import {
  extractBizProse,
  parseBizPageText,
  parseBizTable,
} from "./programs/scrapers/business-school-parser.js";
import { parseProgramText } from "./programs/scrapers/coursedog-program-parser.js";
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

export { parseBizTable, groupAppliesToSelection, allocationForConditions };

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

function programUrl(env, schoolSlug, programSlug) {
  return `https://${catalogBase(env)}.catalogs.rutgers.edu/schools/${schoolSlug}/degree-requirements/programs-majors-minors/${programSlug}`;
}

const FETCH_HEADERS = {
  Accept: "text/html",
  "User-Agent": "Mozilla/5.0 (compatible; RutgersDegreeNavigatorScraper/1.0; personal student project)",
};

// Rutgers publishes the New Brunswick Core Curriculum course list openly on
// the SAS Undergraduate site. This is deliberately a source URL plus a
// parser, not a hard-coded list of courses: the current catalog can change
// which courses carry each Core code, and a refresh should pick that up.
// The module is not RBS-owned: reviewed schools link to it through
// school_curriculum_modules.
const RUTGERS_NB_CORE_SOURCE_URL = "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/core?id=106&layout=blog&view=category";
const RUTGERS_NB_CORE_PROGRAM_ID = "rutgers-nb-core-curriculum";

// Rules are stable curricular structure. Course memberships are obtained at
// scrape time from the official New Brunswick Core list above.
const RUTGERS_NB_CORE_GROUPS = [
  { key: "contemporary", name: "Contemporary Challenges (2 courses)", rule: "all", children: [
    { key: "ccd", name: "Diversities and Social Inequalities [CCD]", rule: "min_courses", count: 1, tags: ["CCD"] },
    { key: "cco", name: "Our Common Future [CCO]", rule: "min_courses", count: 1, tags: ["CCO"] },
  ] },
  { key: "areas", name: "Areas of Inquiry (6 courses)", rule: "all", children: [
    { key: "ns", name: "Natural Sciences [NS]", rule: "min_courses", count: 2, tags: ["NS"] },
    { key: "hst", name: "Historical Analysis [HST]", rule: "min_courses", count: 1, tags: ["HST"] },
    { key: "scl", name: "Social Analysis [SCL]", rule: "min_courses", count: 1, tags: ["SCL"] },
    // The two Arts/Humanities courses must cover two distinct learning goals.
    // The frontend understands this explicit rule; the child groups supply
    // the goal membership used to check it.
    { key: "ah", name: "Arts and Humanities [AH] (2 distinct goals)", rule: "min_distinct_children", count: 2, tags: ["AHo", "AHp", "AHq", "AHr"], children: [
      { key: "aho", name: "Philosophical and Theoretical Issues [AHo]", rule: "all", tags: ["AHo"] },
      { key: "ahp", name: "Arts and Humanities [AHp]", rule: "all", tags: ["AHp"] },
      { key: "ahq", name: "Arts and Humanities [AHq]", rule: "all", tags: ["AHq"] },
      { key: "ahr", name: "Arts and Humanities [AHr]", rule: "all", tags: ["AHr"] },
    ] },
  ] },
  { key: "cognitive", name: "Cognitive Skills and Processes (5 courses)", rule: "all", children: [
    { key: "wc", name: "College Writing [WC]", rule: "min_courses", count: 1, tags: ["WC"] },
    { key: "wcr", name: "Revision-Based Writing and Communication [WCr]", rule: "min_courses", count: 1, tags: ["WCr"] },
    { key: "wcd", name: "Discipline-Based Writing and Communication [WCd]", rule: "min_courses", count: 1, tags: ["WCd"] },
    { key: "qq", name: "Quantitative Information [QQ]", rule: "min_courses", count: 1, tags: ["QQ"] },
    { key: "qr", name: "Formal Reasoning [QR]", rule: "min_courses", count: 1, tags: ["QR"] },
  ] },
];

/* ============================================================
   RBS CORE CURRICULUM — official NB list -> requirement tree
   ============================================================ */
function flattenCoreGroups(groups, parent = null, out = []) {
  for (const group of groups) {
    const row = { ...group, parent };
    out.push(row);
    if (group.children) flattenCoreGroups(group.children, row.key, out);
  }
  return out;
}

function parseCoreCourseRows(html) {
  const rows = new Map();
  const cellText = (value) => htmlToFlatText(value)
    .replace(/[\u0001\u0002]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const rowBlocks = [...html.matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)].map((match) => match[0]);
  for (const row of rowBlocks) {
    const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => cellText(match[1]));
    if (cells.length < 4) continue;
    const code = cells[0];
    const title = cells[1];
    const credits = cells[2];
    const rawTags = cells[3];
    if (!/^\d{2}:\d{3}:\d{3}$/.test(code) || !/^\d+(?:\.\d+)?$/.test(credits)) continue;
    // The New Brunswick Core page is campus-specific. This extra guard keeps
    // known Newark/Camden course-number prefixes out if they ever appear in a
    // future version of the source list.
    if (/^(21|29|50):/.test(code)) continue;
    const tags = rawTags.split(",").map((tag) => tag.trim()).filter((tag) => /^[A-Z][A-Za-z]{1,3}$/.test(tag));
    if (!tags.length) continue;
    const existing = rows.get(code);
    rows.set(code, {
      code,
      title: existing?.title || title,
      credits: existing?.credits || credits,
      tags: new Set([...(existing?.tags || []), ...tags]),
    });
  }
  return [...rows.values()];
}

function coreGroupCourseRows(group, courses) {
  const tags = new Set(group.tags || []);
  if (!tags.size) return [];
  return courses.filter((course) => [...course.tags].some((tag) => tags.has(tag)));
}

async function runD1Batches(env, statements, chunkSize = 100) {
  for (let i = 0; i < statements.length; i += chunkSize) {
    await env.DB.batch(statements.slice(i, i + chunkSize));
  }
}

async function scrapeCoreCurriculum(env, program) {
  const source = program.source_url || RUTGERS_NB_CORE_SOURCE_URL;
  const continuation = source.includes("?") ? `${source}&start=5` : `${source}?start=5`;
  let pages;
  try {
    pages = await Promise.all([source, continuation].map(async (url) => {
      const res = await fetch(url, { headers: FETCH_HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
      return res.text();
    }));
  } catch (err) {
    await logScrape(env, program.id, "error", null, `Core source fetch failed: ${err.message}`, "");
    return { ok: false, error: err.message };
  }

  const courses = pages.flatMap(parseCoreCourseRows);
  const merged = new Map();
  for (const course of courses) {
    const existing = merged.get(course.code);
    merged.set(course.code, {
      code: course.code,
      title: existing?.title || course.title,
      credits: existing?.credits || course.credits,
      tags: new Set([...(existing?.tags || []), ...course.tags]),
    });
  }
  const coreCourses = [...merged.values()];
  if (!coreCourses.length) {
    await logScrape(env, program.id, "empty", null, "Core source parsed zero course rows", pages.join("\n").slice(0, 1500));
    return { ok: false, error: "no Core course rows parsed" };
  }

  const flatGroups = flattenCoreGroups(RUTGERS_NB_CORE_GROUPS);
  const statements = [
    env.DB.prepare(`DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id = ? AND auto_generated = 1)`).bind(program.id),
    env.DB.prepare(`DELETE FROM requirement_groups WHERE program_id = ? AND auto_generated = 1`).bind(program.id),
    env.DB.prepare(`DELETE FROM requirement_raw_notes WHERE program_id = ?`).bind(program.id),
  ];
  let coursesWritten = 0;
  for (let index = 0; index < flatGroups.length; index++) {
    const group = flatGroups[index];
    const groupId = `${program.id}-${group.key}`;
    const parentId = group.parent ? `${program.id}-${group.parent}` : null;
    statements.push(env.DB.prepare(
      `INSERT INTO requirement_groups (id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated)
       VALUES (?,?,?,?,?,?,?,1)`
    ).bind(groupId, program.id, parentId, group.name, group.rule, group.count ?? null, index));
    for (const course of coreGroupCourseRows(group, coreCourses)) {
      statements.push(env.DB.prepare(
        `INSERT OR REPLACE INTO requirement_courses (group_id, course_code, note, source_title, source_credits)
         VALUES (?,?,?,?,?)`
      ).bind(groupId, course.code, "", course.title, course.credits));
      coursesWritten++;
    }
  }
  statements.push(env.DB.prepare(
    `UPDATE programs SET last_scraped_at = ?, review_status = 'unreviewed', source_url = ? WHERE id = ?`
  ).bind(Date.now(), source, program.id));

  try {
    await runD1Batches(env, statements);
  } catch (err) {
    await logScrape(env, program.id, "error", { groupsWritten: flatGroups.length, coursesWritten, notesWritten: 0 }, `Core D1 write failed: ${err.message}`, pages.join("\n").slice(0, 1500));
    return { ok: false, error: err.message };
  }
  const counts = { groupsWritten: flatGroups.length, coursesWritten, notesWritten: 0 };
  await logScrape(env, program.id, "ok", counts, `scraped official New Brunswick Core Curriculum: ${source}`, pages.join("\n").slice(0, 1500));
  return { ok: true, parsed_courses: coreCourses.length, ...counts };
}

/* ============================================================
   sections -> DB rows
   ============================================================ */
function sectionsToStatements(env, program, sections) {
  const stmts = [];
  let groupCounter = 0;
  let groupsWritten = 0, coursesWritten = 0, notesWritten = 0;

  // Clear previous scrape's rows for this program so re-scraping doesn't
  // duplicate/orphan groups. Manual (auto_generated=0) groups added by a
  // human during review are preserved.
  stmts.push(env.DB.prepare(`DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id = ? AND auto_generated = 1)`).bind(program.id));
  stmts.push(env.DB.prepare(`DELETE FROM requirement_groups WHERE program_id = ? AND auto_generated = 1`).bind(program.id));
  stmts.push(env.DB.prepare(`DELETE FROM requirement_raw_notes WHERE program_id = ?`).bind(program.id));

  for (const section of sections) {
    groupCounter++;
    const groupId = `${program.id}-g${groupCounter}`;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO requirement_groups (id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated)
         VALUES (?,?,?,?,?,?,?,1)`
      ).bind(groupId, program.id, null, section.name, section.rule || "all", section.count ?? null, groupCounter)
    );
    groupsWritten++;

    for (const item of section.courseItems) {
      stmts.push(
        env.DB.prepare(
          `INSERT OR REPLACE INTO requirement_courses
             (group_id, course_code, note, source_title, source_credits)
           VALUES (?,?,?,?,?)`
        ).bind(groupId, item.code, item.note || "", item.title || "", item.credits || "")
      );
      coursesWritten++;
    }

    let subgroupCounter = 0;
    for (const subgroup of section.subgroups || []) {
      subgroupCounter++;
      const subgroupId = `${groupId}-sub${subgroupCounter}`;
      stmts.push(
        env.DB.prepare(
          `INSERT INTO requirement_groups (id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated)
           VALUES (?,?,?,?,?,?,?,1)`
        ).bind(subgroupId, program.id, groupId, subgroup.name, subgroup.rule || "all", subgroup.count ?? null, subgroupCounter)
      );
      groupsWritten++;
      for (const item of subgroup.courseItems || []) {
        stmts.push(
          env.DB.prepare(
            `INSERT OR REPLACE INTO requirement_courses
               (group_id, course_code, note, source_title, source_credits)
             VALUES (?,?,?,?,?)`
          ).bind(subgroupId, item.code, item.note || "", item.title || "", item.credits || "")
        );
        coursesWritten++;
      }
    }

    let orCounter = 0;
    for (const orGroup of section.orGroups) {
      orCounter++;
      const orGroupId = `${groupId}-or${orCounter}`;
      stmts.push(
        env.DB.prepare(
          `INSERT INTO requirement_groups (id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated)
           VALUES (?,?,?,?,?,?,?,1)`
        ).bind(orGroupId, program.id, groupId, `Choose 1`, "min_courses", 1, orCounter)
      );
      groupsWritten++;
      for (const item of orGroup) {
        stmts.push(
          env.DB.prepare(
            `INSERT OR REPLACE INTO requirement_courses
               (group_id, course_code, note, source_title, source_credits)
             VALUES (?,?,?,?,?)`
          ).bind(orGroupId, item.code, item.note || "", item.title || "", item.credits || "")
        );
        coursesWritten++;
      }
    }

    for (const prose of section.prose) {
      stmts.push(
        env.DB.prepare(`INSERT INTO requirement_raw_notes (program_id, section_name, raw_text, resolved) VALUES (?,?,?,0)`)
          .bind(program.id, section.name, prose)
      );
      notesWritten++;
    }
  }

  return { stmts, groupsWritten, coursesWritten, notesWritten };
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
   SCRAPE one program
   ============================================================ */
async function scrapeProgram(env, program) {
  const url = program.source_url || programUrl(env, program.school_slug, program.program_slug);
  let html;
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    await logScrape(env, program.id, "error", null, `fetch failed: ${err.message}`, "");
    return { ok: false, error: err.message };
  }

  const flat = htmlToFlatText(html);
  const sections = parseProgramText(flat, program.name);

  if (!sections.length) {
    await logScrape(env, program.id, "empty", null, "parsed zero sections — page structure may not match parseProgramText's assumptions", flat.slice(0, 1500));
    return { ok: false, error: "no sections parsed" };
  }

  const { stmts, groupsWritten, coursesWritten, notesWritten } = sectionsToStatements(env, program, sections);
  stmts.push(
    env.DB.prepare(`UPDATE programs SET last_scraped_at = ?, review_status = 'unreviewed', source_url = ? WHERE id = ?`)
      .bind(Date.now(), url, program.id)
  );

  try {
    // D1 batches are capped in size; a single program's requirement set is
    // small (dozens of statements) so one batch is safe, unlike the course
    // sync which has to chunk across thousands of rows.
    await env.DB.batch(stmts);
  } catch (err) {
    await logScrape(env, program.id, "error", { groupsWritten, coursesWritten, notesWritten }, `D1 write failed: ${err.message}`, flat.slice(0, 1500));
    return { ok: false, error: err.message };
  }

  await logScrape(env, program.id, "ok", { groupsWritten, coursesWritten, notesWritten }, `scraped ${url}`, flat.slice(0, 1500));
  return { ok: true, groupsWritten, coursesWritten, notesWritten };
}

/* ============================================================
   SOURCE 2: www.business.rutgers.edu (clean HTML tables)
   ============================================================
   catalogs.rutgers.edu (Coursedog) is free-text prose for anything beyond
   a program's required courses, and — confirmed by hand, see the chat that
   led to this — some of that prose is straight-up copy-pasted between
   majors' pages (a BAIT-page paragraph literally talks about "the Finance
   department"). It never reliably had elective lists to scrape.
   www.business.rutgers.edu (RBS's own marketing/advising site, NOT
   Coursedog) publishes actual maintained HTML tables per major:
     "RBS Core Courses"   -> a "Business Core" table, everyone required
     "Required Courses"   -> a "Required <Major> Courses" table, all required
     "Elective Courses"   -> one or two tables captioned literally
                             "At least ONE course from the following
                             electives" / "At most TWO courses from the
                             following electives" — which map directly onto
                             requirement_groups' min_courses/max_courses.
   This is the real source of truth (and almost certainly where the old
   hand-written v16 COURSES/GROUPS constants originally came from).
   CONFIRM TABLE MARKUP AGAINST A REAL SCRAPE-LOG SAMPLE before trusting
   this at scale: this was written from the *rendered* text of two pages
   (bait, finance), not the literal raw HTML source, so the exact tag
   soup (whether captions are <th colspan> vs a lone <td>, whether OR-pairs
   sit in one <td> or two, etc.) is inferred, not confirmed byte-for-byte.
   Run it for ONE program first (?program=rbsnb-bait) and check
   GET /api/admin/scrape-log's raw_sample / groups_written before trusting
   it for all six.
*/
const BIZ_SITE_BASE = "https://www.business.rutgers.edu/undergraduate-new-brunswick";
// The slug on this site doesn't always match the Coursedog program_slug
// (e.g. "bait" vs "business-analytics-information-technology") — confirmed
// from this site's own "Areas of Study" nav menu, not guessed.
const BIZ_SLUG_MAP = {
  "rbsnb-bait": "business-analytics-information-technology",
  "rbsnb-accounting": "accounting",
  "rbsnb-finance": "finance",
  "rbsnb-leadership-management": "leadership-management",
  "rbsnb-marketing": "marketing",
  "rbsnb-supply-chain-management": "supply-chain-management",
};
async function scrapeProgramFromBizSite(env, program) {
  const slug = BIZ_SLUG_MAP[program.id];
  if (!slug) {
    return { ok: false, error: `no BIZ_SLUG_MAP entry for ${program.id} — add one before scraping this program from business.rutgers.edu` };
  }
  const url = `${BIZ_SITE_BASE}/${slug}`;
  let html;
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    await logScrape(env, program.id, "error", null, `biz-site fetch failed: ${err.message}`, "");
    return { ok: false, error: err.message };
  }

  const sections = parseBizPageText(html);
  if (!sections.length) {
    await logScrape(env, program.id, "empty", null, "biz-site parse found zero usable tables — table markup may not match parseBizTable's assumptions, check raw_sample", html.slice(0, 2000));
    return { ok: false, error: "no sections parsed from biz site" };
  }

  const { stmts, groupsWritten, coursesWritten, notesWritten: groupNotesWritten } = sectionsToStatements(env, program, sections);

  // Raw prose notes (bullets/footnotes from outside any table) don't belong
  // to a specific requirement_groups row the way section.prose does, so
  // they're inserted directly. sectionsToStatements already queued a
  // DELETE FROM requirement_raw_notes for this program above, so these
  // inserts land on a clean slate, not on top of stale rows.
  const prose = extractBizProse(html);
  for (const note of prose) {
    stmts.push(
      env.DB.prepare(`INSERT INTO requirement_raw_notes (program_id, section_name, raw_text, resolved) VALUES (?,?,?,0)`)
        .bind(program.id, note.section_name, note.raw_text)
    );
  }
  const notesWritten = groupNotesWritten + prose.length;

  stmts.push(
    env.DB.prepare(`UPDATE programs SET last_scraped_at = ?, review_status = 'unreviewed', source_url = ? WHERE id = ?`)
      .bind(Date.now(), url, program.id)
  );

  try {
    await env.DB.batch(stmts);
  } catch (err) {
    await logScrape(env, program.id, "error", { groupsWritten, coursesWritten, notesWritten }, `biz-site D1 write failed: ${err.message}`, html.slice(0, 2000));
    return { ok: false, error: err.message };
  }

  await logScrape(env, program.id, "ok", { groupsWritten, coursesWritten, notesWritten }, `scraped (biz site) ${url}`, html.slice(0, 2000));
  return { ok: true, groupsWritten, coursesWritten, notesWritten };
}

/* ============================================================
   DISCOVER program slugs from a school's index page (best effort)
   ============================================================
   This is the fragile half — index-page markup is more likely to vary by
   school than the program pages themselves. If it comes back empty for a
   school, don't fight it: use POST /api/admin/programs/seed to add that
   school's programs by hand (you only need to do this once per school).
*/
async function discoverPrograms(env, schoolSlug, indexPath) {
  const url = `https://${catalogBase(env)}.catalogs.rutgers.edu${indexPath}`;
  let html;
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (err) {
    return { ok: false, error: err.message, found: [] };
  }

  const linkRe = /href="[^"]*\/schools\/([a-z0-9-]+)\/degree-requirements\/programs-majors-minors\/([a-z0-9-]+)"[^>]*>([^<]*)</gi;
  const found = [];
  const seen = new Set();
  let m;
  while ((m = linkRe.exec(html))) {
    const [, foundSchool, programSlug, linkText] = m;
    const key = `${foundSchool}:${programSlug}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ school_slug: foundSchool, program_slug: programSlug, name: linkText.trim() || programSlug });
  }
  return { ok: true, found };
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

async function getReviewedCourseEligibility(env, rawCodes) {
  const codes = reviewedCourseCodes(rawCodes);
  const output = {};
  for (let offset = 0; offset < codes.length; offset += COURSE_ELIGIBILITY_BATCH_SIZE) {
    const batch = codes.slice(offset, offset + COURSE_ELIGIBILITY_BATCH_SIZE);
    const placeholders = batch.map(() => "?").join(",");
    const [reviews, conditions] = await env.DB.batch([
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
    ]);
    for (const review of reviews.results || []) output[review.course_code] = { review, conditions: [] };
    for (const condition of conditions.results || []) {
      if (output[condition.course_code]) output[condition.course_code].conditions.push(condition);
    }
  }
  return output;
}

async function programHasCompleteRequirementEvidence(env, program) {
  if (Number(program?.requirement_evidence_required) !== 1) return true;
  const [groupsResult, coursesResult, evidenceResult] = await env.DB.batch([
    env.DB.prepare(
      "SELECT id FROM requirement_groups WHERE program_id = ?"
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
    `SELECT rc.*, g.program_id as owner_program_id, c.title as catalog_title, c.credits as catalog_credits,
            c.description as catalog_description, c.prereqs as catalog_prereqs,
            c.subject_notes as catalog_subject_notes,
            (
              SELECT GROUP_CONCAT(DISTINCT s.restrictions)
              FROM sections s
              WHERE s.course_id = c.id AND NULLIF(TRIM(s.restrictions), '') IS NOT NULL
            ) as section_restrictions
     FROM requirement_courses rc
     INNER JOIN requirement_groups g ON g.id = rc.group_id
     LEFT JOIN courses c ON c.school || ':' || c.subject_code || ':' || c.course_number = rc.course_code
     WHERE rc.group_id IN (${visibleGroupIds.map(() => "?").join(",")})`
  ).bind(...visibleGroupIds).all() : { results: [] };
  const eligibilityByCode = await getReviewedCourseEligibility(env, courses.map((course) => course.course_code));

  // Alternatives are scoped to the requirement-set/program that owns the
  // course row. This lets Degree Navigator-only families be entered once as
  // reviewed data and avoids a frontend exception for any particular course.
  const { results: alternatives } = await env.DB.prepare(
    `SELECT e.*, c.title as catalog_title, c.credits as catalog_credits
     FROM requirement_course_equivalencies e
     LEFT JOIN courses c ON c.school || ':' || c.subject_code || ':' || c.course_number = e.equivalent_course_code
     WHERE e.program_id IN (${placeholders}) AND e.review_status = 'reviewed'`
  ).bind(...ownerIds).all();
  const alternativesByRequirement = {};
  for (const alternative of alternatives) {
    const key = `${alternative.program_id}::${alternative.requirement_course_code}`;
    (alternativesByRequirement[key] ||= []).push(alternative);
  }

  const byGroup = {};
  for (const c of courses) {
    c.alternatives = alternativesByRequirement[`${c.owner_program_id}::${c.course_code}`] || [];
    c.eligibility = eligibilityByCode[c.course_code] || null;
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
      RUTGERS_NB_CORE_PROGRAM_ID,
      discoverMajorRequirementSources: (profileSources) =>
        requirementDiscoveryService.discoverProfiles(profileSources),
      discoverNestedRequirementDetailSources: (parentSources) =>
        requirementDiscoveryService.discoverNestedDetails(parentSources),
      discoverPrograms,
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
      scrapeCoreCurriculum,
      scrapeProgram,
      scrapeProgramFromBizSite,
      repository: createAdminProgramRepository(env),
    },
  });
  if (adminResponse) return adminResponse;

  return null; // not a programs-related route — let worker.js fall through
}
