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

import { evaluateProgramSelection } from "./program-selection-policy.js";

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
const RBS_CORE_SOURCE_URL = "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/core?id=106&layout=blog&view=category";
const RBS_CORE_PROGRAM_ID = "rbsnb-core-curriculum";

// Rules are stable curricular structure. Course memberships are obtained at
// scrape time from the official New Brunswick Core list above.
const RBS_CORE_GROUPS = [
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
   HTML -> flat text, tag-agnostic
   ============================================================
   Coursedog's public catalog is server-rendered (confirmed: a plain fetch
   returns full text, no headless browser needed) but we don't have a
   confirmed DOM structure across every school's pages. Rather than write
   selectors that only work for one page, this flattens ANY html into text
   while preserving two things that matter for parsing:
     - block boundaries (p/li/div/tr/h1-6/br) become newlines
     - bold spans (strong/b/h1-6) are wrapped in \u0001...\u0002 sentinels
       so the parser can tell "this line is a heading" from "this line is
       a course row that happens to have a bolded word in it."
*/
function htmlToFlatText(html) {
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Mark bold/heading spans before stripping tags.
  s = s.replace(/<(strong|b|h[1-6])(\s[^>]*)?>/gi, "\u0001");
  s = s.replace(/<\/(strong|b|h[1-6])>/gi, "\u0002");
  // Block boundaries -> newline.
  s = s.replace(/<(\/p|\/li|\/div|\/tr|\/h[1-6]|br\s*\/?)>/gi, "\n");
  s = s.replace(/<li(\s[^>]*)?>/gi, "\n• ");
  // Strip everything else.
  s = s.replace(/<[^>]+>/g, "");
  // Minimal entity decode.
  const entities = {
    "&amp;": "&", "&quot;": '"', "&#x27;": "'", "&#39;": "'", "&apos;": "'",
    "&nbsp;": " ", "&mdash;": "—", "&ndash;": "–", "&lt;": "<", "&gt;": ">",
  };
  s = s.replace(/&#x27;|&#39;|&amp;|&quot;|&apos;|&nbsp;|&mdash;|&ndash;|&lt;|&gt;/g, (m) => entities[m] || m);
  s = s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
  return s;
}

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
  const source = program.source_url || RBS_CORE_SOURCE_URL;
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

  const flatGroups = flattenCoreGroups(RBS_CORE_GROUPS);
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
   TEXT -> {sections, rawNotes} intermediate representation
   ============================================================ */
const CODE_RE = /\d{2}:\d{2,3}:\d{3}/g;
const CREDIT_RE = /\((\d+(?:\.\d+)?)\)/g;
// Global variant used to strip note parens out BEFORE course-code
// segmentation — notes like "(prerequisite: 33:010:272)" contain a course
// code themselves, which would otherwise get misread as an extra
// requirement item. Segmenting the cleaned line first, then re-attaching
// the extracted note text, avoids that.
const PREREQ_NOTE_RE_G = /\(([^()]*(?:prerequisite|required if|pre-?req|score|grade of)[^()]*)\)/gi;

function looksLikeHeading(text) {
  const t = text.trim();
  if (!t) return false;
  if (t.length > 90) return false;
  if (/\d{2}:\d{2,3}:\d{3}/.test(t)) return false; // has a course code -> not a heading
  return true;
}

// Segments a line by course code rather than by a single "code title (credits)"
// regex, because Rutgers frequently writes alternatives as
// "CODE_A Title A OR CODE_B Title B (3)" — ONE trailing credit shared by
// both codes, not one per code. Splitting on code position first, then
// looking for the nearest "(N)" (falling back to the line's last "(N)" if
// a segment doesn't have its own), handles both the shared and per-code
// cases correctly.
function parseCourseLine(line) {
  const codeMatches = [...line.matchAll(CODE_RE)];
  if (!codeMatches.length) return null;
  const creditMatches = [...line.matchAll(CREDIT_RE)];
  const trailingCredit = creditMatches.length ? creditMatches[creditMatches.length - 1][1] : "";

  const items = codeMatches.map((cm, idx) => {
    const codeEnd = cm.index + cm[0].length;
    const nextStart = idx + 1 < codeMatches.length ? codeMatches[idx + 1].index : line.length;
    const segment = line.slice(codeEnd, nextStart);
    const title = segment.split(/\(|\bOR\b/i)[0].trim().replace(/[,.]$/, "");
    const ownCredit = creditMatches.find((cr) => cr.index >= codeEnd && cr.index < nextStart);
    return { code: cm[0], title, credits: ownCredit ? ownCredit[1] : trailingCredit };
  });

  const isAlternative = items.length > 1 && /\bOR\b/i.test(line);
  return { items, isAlternative };
}

function parseProgramText(flatText, programName) {
  const lines = flatText.split("\n").map((l) => l.trim()).filter(Boolean);

  const sections = []; // { name, courseItems: [{code,title,credits,note}], orGroups: [[{code,title,credits}]], prose: [] }
  let current = { name: programName || "Requirements", courseItems: [], orGroups: [], prose: [] };
  sections.push(current);

  for (let rawLine of lines) {
    let line = rawLine;

    // Peel off a leading bold span and decide if it's a heading.
    if (line.startsWith("\u0001")) {
      const end = line.indexOf("\u0002");
      if (end !== -1) {
        const boldSpan = line.slice(1, end);
        const rest = line.slice(end + 1).trim();
        if (looksLikeHeading(boldSpan)) {
          current = { name: boldSpan.trim(), courseItems: [], orGroups: [], prose: [] };
          sections.push(current);
          line = rest; // anything trailing the bold heading on the same line still gets parsed below
        }
      }
    }
    // Strip any remaining sentinels (mid-line bold that wasn't treated as a heading).
    line = line.replace(/\u0001/g, "").replace(/\u0002/g, "");
    if (!line) continue;

    // Pull note parens (which may contain their own course codes, e.g.
    // "(prerequisite: 33:010:272)") out BEFORE segmenting by course code,
    // so those embedded codes don't get misread as extra requirement items.
    const noteTexts = [];
    const cleanedLine = line.replace(PREREQ_NOTE_RE_G, (_, inner) => {
      noteTexts.push(inner.trim());
      return "";
    });

    const parsed = parseCourseLine(cleanedLine);
    if (!parsed) {
      // No course code on this line at all -> prose/footnote, human review needed.
      current.prose.push(line);
      continue;
    }

    if (parsed.isAlternative) {
      current.orGroups.push(parsed.items);
    } else {
      const note = noteTexts.join("; ");
      for (const it of parsed.items) {
        current.courseItems.push({ ...it, note });
      }
    }
  }

  return sections.filter((s) => s.courseItems.length || s.orGroups.length || s.prose.length);
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
const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

// RBS also uses bold text for headings placed immediately before tables.
// Keep this heading detection shared by the table and prose parsers.
function readBizHeadingLine(line) {
  if (!line.startsWith("\u0001")) return { heading: "", rest: line };
  const end = line.indexOf("\u0002");
  if (end === -1) return { heading: "", rest: line };
  const boldSpan = line.slice(1, end).trim();
  if (!looksLikeHeading(boldSpan)) return { heading: "", rest: line };
  return { heading: boldSpan, rest: line.slice(end + 1).trim() };
}

function findLatestBizHeading(html, currentHeading = "") {
  let heading = currentHeading;
  const lines = htmlToFlatText(html).split("\n").map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const found = readBizHeadingLine(line).heading;
    if (found) heading = found;
  }
  return heading;
}

function isBizColumnHeader(cells) {
  const words = cells.join(" ").toLowerCase().match(/[a-z]+/g) || [];
  const headerWords = new Set(["course", "courses", "credit", "credits", "note", "notes", "and", "prerequisite", "prerequisites"]);
  return words.length > 0 && words.includes("course") && words.every((word) => headerWords.has(word));
}

// Turns one <table>...</table> block into a section. Row 0 is a caption
// spanning the table ("Business Core", "At most TWO courses from the
// following electives", ...); row 1 is usually the Course/Credits/Notes
// header (skipped); everything after is data rows. A "Credit Total" row
// and any row with no course code in its first cell (e.g. the placeholder
// "BAIT elective" rows inside the Required-Courses table — real options
// for those live in the separate Elective-Courses table below) are
// skipped rather than mis-recorded as real requirements.
function parseBizTable(tableHtml, precedingHeading = "") {
  const rows = [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  if (!rows.length) return null;
  const cellsOf = (row) =>
    [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      htmlToFlatText(c[1]).replace(/[\u0001\u0002]/g, "").replace(/\s*\n\s*/g, "; ").trim()
    );

  let idx = 0;
  const captionCells = cellsOf(rows[idx]); idx++;
  // Captions are almost always wrapped in <strong>/<b>/<th><b> in the source
  // HTML, so htmlToFlatText's bold-sentinel markers (\u0001...\u0002 — used
  // elsewhere to detect headings, e.g. in extractBizProse) are still attached
  // here. Strip them before using the caption as either the group's display
  // name OR the target of the rule regex below — leaving them in silently
  // broke both: names rendered with literal \u0001/\u0002 characters, and
  // "at least/at most" never matched because the string started with \u0001,
  // not "A".
  const caption = (captionCells.find((c) => c) || "").replace(/[\u0001\u0002]/g, "").trim();
  const needsHeadingFallback = !caption || isBizColumnHeader(captionCells);
  const sectionName = needsHeadingFallback ? precedingHeading : caption;
  if (!sectionName) return null; // unrecognized table shape — let the caller log it and skip

  if (rows[idx]) {
    const hdr = cellsOf(rows[idx]).join(" ").toLowerCase();
    if (hdr.includes("course") && hdr.includes("credit")) idx++; // skip literal column-header row
  }

  // A heading outside a Course/Credits/Notes table confirms this is a
  // selectable-course group, but does not reliably state how many to choose.
  const section = {
    name: sectionName,
    sourceHeading: precedingHeading,
    courseItems: [],
    orGroups: [],
    subgroups: [],
    prose: [],
    placeholderElectiveCount: 0,
    rule: needsHeadingFallback ? "min_courses" : "all",
    count: null,
  };
  if (!needsHeadingFallback) {
    const atLeast = caption.match(/^at least (\w+)/i);
    const atMost = caption.match(/^at most (\w+)/i);
    if (atLeast) {
      section.rule = "min_courses";
      section.count = WORD_NUM[atLeast[1].toLowerCase()] || parseInt(atLeast[1], 10) || 1;
    } else if (atMost) {
      section.rule = "max_courses";
      section.count = WORD_NUM[atMost[1].toLowerCase()] || parseInt(atMost[1], 10) || 1;
    }
  }

  for (; idx < rows.length; idx++) {
    const cells = cellsOf(rows[idx]);
    if (!cells.length) continue;
    const courseCell = cells[0] || "";
    const creditCell = cells[1] || "";
    const noteCell = cells[2] || "";
    if (/credit total/i.test(courseCell)) continue;
    const codeMatches = [...courseCell.matchAll(CODE_RE)];
    if (!codeMatches.length) {
      // Some RBS pages state the required number of electives as repeated
      // placeholders in the required-course table (for example, four rows
      // reading "Finance elective"), then list the actual choices in the
      // next "Elective Courses" table. Retain the count instead of silently
      // dropping the requirement just because this particular row has no
      // course code.
      if (/\belective\b/i.test(courseCell)) section.placeholderElectiveCount++;
      continue;
    }

    const items = codeMatches.map((cm, i) => {
      const segStart = cm.index + cm[0].length;
      const nextStart = i + 1 < codeMatches.length ? codeMatches[i + 1].index : courseCell.length;
      const title = courseCell.slice(segStart, nextStart).replace(/\bOR\b/gi, "").trim().replace(/[,.]$/, "");
      return { code: cm[0], title, credits: (creditCell.match(/[\d.]+/) || [""])[0] };
    });
    const note = noteCell;
    // Some official RBS tables repeat a course in a major-specific section
    // only to say it is already fulfilled by the Business Core. It is a
    // cross-reference, not a second requirement or additional credit. Keep
    // the source statement as reviewable prose but do not render a duplicate
    // course card outside the Core.
    if (
      !/business core/i.test(section.name) &&
      /\bfulfilled in (?:the )?business core requirements?\b/i.test(note)
    ) {
      section.prose.push(`${items.map((item) => `${item.code} ${item.title}`.trim()).join(" / ")}: ${note}`);
      continue;
    }
    if (items.length > 1) {
      section.orGroups.push(items.map((it) => ({ ...it, note })));
    } else {
      section.courseItems.push({ ...items[0], note });
    }
  }
  return section.courseItems.length || section.orGroups.length ? section : null;
}

export { parseBizTable };

function isLegacyBizCurriculum(section) {
  // The app currently represents the active catalog path for a program.
  // Rutgers labels older tables explicitly (for example, "students admitted
  // prior to Fall 2022"), so excluding those tables prevents students from
  // being shown both old and current requirements as if they were cumulative.
  const heading = String(section.sourceHeading || "");
  return /\bstudents?\b[\s\S]{0,70}\b(?:admitted|entered)\b[\s\S]{0,70}\b(?:prior|before|earlier)\b/i.test(heading);
}

function linkBizElectivePlaceholders(sections) {
  for (let index = 0; index < sections.length; index++) {
    const source = sections[index];
    if (!source.placeholderElectiveCount) continue;

    // RBS places the selectable course list immediately after the required
    // course table. Only infer a count for a plainly titled generic elective
    // table; headings that already say "at least" or "at most" own their
    // rule and must not be overwritten.
    const target = sections.slice(index + 1).find((candidate) =>
      /^elective courses?$/i.test(String(candidate.name || "").trim()) && candidate.count == null
    );
    if (!target) continue;
    target.rule = "min_courses";
    target.count = source.placeholderElectiveCount;
  }
}

function bizNumber(value) {
  return WORD_NUM[String(value || "").toLowerCase()] || parseInt(value, 10) || 0;
}

function applyBizElectiveMixPolicies(sections, html) {
  const text = htmlToFlatText(html).replace(/\s+/g, " ");
  const policyRe = /at least\s+(\w+)\s+of your\s+(\w+)\s+major electives[\s\S]{0,140}?must come from the\s+(\d{3})\/([^\.]+?)\s+major code\.\s*no more than\s+(\w+)\s+major elective may come from other departments/gi;

  for (const match of text.matchAll(policyRe)) {
    const [, minimumText, totalText, subjectCode, subjectName, maximumOutsideText] = match;
    const minimum = bizNumber(minimumText);
    const total = bizNumber(totalText);
    const maximumOutside = bizNumber(maximumOutsideText);
    if (!minimum || !total || !maximumOutside) continue;

    const electiveSection = sections.find((section) =>
      /^elective courses?$/i.test(String(section.name || "").trim()) &&
      section.courseItems.some((item) => item.code.startsWith(`33:${subjectCode}:`))
    );
    if (!electiveSection) continue;

    const subjectItems = electiveSection.courseItems.filter((item) => item.code.startsWith(`33:${subjectCode}:`));
    const outsideItems = electiveSection.courseItems.filter((item) => !item.code.startsWith(`33:${subjectCode}:`));
    if (!subjectItems.length || !outsideItems.length) continue;

    electiveSection.rule = "min_courses";
    electiveSection.count = total;
    electiveSection.subgroups.push(
      {
        name: `At least ${minimum} ${subjectName.trim()} elective${minimum === 1 ? "" : "s"}`,
        rule: "min_courses",
        count: minimum,
        courseItems: subjectItems,
      },
      {
        name: `Up to ${maximumOutside} approved elective${maximumOutside === 1 ? "" : "s"} from other departments`,
        rule: "max_courses",
        count: maximumOutside,
        courseItems: outsideItems,
      }
    );
  }
}

function finalizeBizSections(sections, html) {
  const activeCatalogSections = sections.filter((section) => !isLegacyBizCurriculum(section));
  linkBizElectivePlaceholders(activeCatalogSections);
  applyBizElectiveMixPolicies(activeCatalogSections, html);
  return activeCatalogSections;
}

function parseBizPageText(html) {
  const sections = [];
  let currentHeading = "";
  let lastTableEnd = 0;
  for (const match of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    currentHeading = findLatestBizHeading(html.slice(lastTableEnd, match.index), currentHeading);
    const section = parseBizTable(match[0], currentHeading);
    if (section) sections.push(section);
    lastTableEnd = match.index + match[0].length;
  }
  return finalizeBizSections(sections, html);
}

// parseBizTable/parseBizPageText only ever look INSIDE <table> elements.
// Real policy text — e.g. "BAIT Major Special Notes" (the double-count cap,
// the Accounting-major substitution rule) and footnotes like "*01:640:151
// or 01:640:130 also acceptable" — lives in a <ul>/<li> or a stray <p>
// between tables, not in one, so it was previously never seen at all.
//
// IMPORTANT — bullet capture is heading-gated on purpose. These pages are
// full of OTHER bullet lists that have nothing to do with requirements:
// nav menus ("Ancillary", "Academic Programs", "Areas of Study"), "Key
// Facts", "Sample Occupations", footer links. Capturing every bullet
// on the page (an earlier version of this function did) pulled in menu
// items right alongside real policy notes — confirmed against a real
// fetch of the BAIT page, which has 4 genuine Special Notes bullets
// buried among 100+ irrelevant ones. So bullets only get pushed while
// currentHeading matches /special notes/i — every RBS major page so far
// follows the same "{Major} Major Special Notes" heading, so this should
// generalize across all 6 without hardcoding each major's exact heading
// text. Footnote lines (a bare line starting with "*") are NOT
// heading-gated — they're rare and distinctive enough on their own not
// to need it, and gating them would lose the Business Core footnote,
// which sits right after that table, before any heading at all.
function extractBizProse(html) {
  const gapsHtml = html.split(/<table[\s\S]*?<\/table>/gi);
  const notes = [];
  let currentHeading = "";

  for (const gap of gapsHtml) {
    const text = htmlToFlatText(gap);
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    for (let line of lines) {
      const headingLine = readBizHeadingLine(line);
      if (headingLine.heading) {
        currentHeading = headingLine.heading;
        line = headingLine.rest; // fall through in case a bullet trails the heading on the same line
        if (!line) continue;
      }
      line = line.replace(/\u0001/g, "").replace(/\u0002/g, "");
      if (line.startsWith("• ")) {
        // Confirmed against a real scrape: the "Special Notes" heading is
        // sometimes immediately followed by an unrelated "Quick Links" list
        // (resource titles like "BAIT Curriculum Guidesheet") with no
        // heading of its own in between to reset currentHeading. Real
        // policy notes are written as full sentences and end in a period;
        // link titles are short labels that don't. This one extra check
        // filtered out exactly the 3 junk entries and none of the 5 real
        // ones in that test run.
        const bulletText = line.slice(2).trim();
        if (/special notes/i.test(currentHeading) && /[.!?]$/.test(bulletText)) {
          notes.push({ section_name: currentHeading, raw_text: bulletText });
        }
        // else: not under a Special Notes heading, or looks like a link
        // title rather than a policy sentence — skip either way.
      } else if (/policy on .*electives/i.test(currentHeading) && /\b(?:at least|at most|no more than|must)\b/i.test(line)) {
        // A small number of majors state a qualifying elective mix in prose
        // rather than in a table. Save that wording for review instead of
        // pretending that a plain elective list fully captures the rule.
        notes.push({ section_name: currentHeading, raw_text: line });
      } else if (/^\*\S/.test(line) && line.length > 8) {
        notes.push({ section_name: currentHeading || "Footnote", raw_text: line });
      }
    }
  }
  return notes;
}

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
async function getRequirementTree(env, programId) {
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
  const { results: courses } = await env.DB.prepare(
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
     WHERE rc.group_id IN (SELECT id FROM requirement_groups WHERE program_id IN (${placeholders}))`
  ).bind(...ownerIds).all();

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
    (byGroup[c.group_id] ||= []).push(c);
  }
  const byId = {};
  for (const g of groups) byId[g.id] = { ...g, courses: byGroup[g.id] || [], children: [] };
  const roots = [];
  for (const g of groups) {
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
  const { results } = await env.DB.prepare(
    `SELECT rule_key, program_id, condition_type, condition_value_json,
            decision, note, source_url
     FROM program_eligibility_rules
     WHERE review_status = 'reviewed'
       AND program_id IN (${ids.map(() => "?").join(",")})
     ORDER BY program_id, rule_key`
  ).bind(...ids).all();
  return results || [];
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
  // ---- Public reads ----
  if (path === "/api/programs" && request.method === "GET") {
    const school = url.searchParams.get("school");
    const type = url.searchParams.get("type");
    // Public program lists intentionally exclude scraped data until a human
    // has reviewed it. Admin routes below remain the review/debug path.
    // Shared sets and school-level Core curricula have their own public
    // routes; neither is a student-selectable major/minor program.
    let where = " WHERE review_status = 'reviewed' AND type NOT IN ('shared_requirement_set', 'core_curriculum')", binds = [];
    if (school) { where += " AND school_slug = ?"; binds.push(school); }
    if (type) { where += " AND type = ?"; binds.push(type); }
    const { results } = await env.DB.prepare(`SELECT * FROM programs${where} ORDER BY name`).bind(...binds).all();
    const eligibilityRules = await getProgramEligibilityRules(env, (results || []).map((program) => program.id));
    const rulesByProgram = {};
    for (const rule of eligibilityRules) (rulesByProgram[rule.program_id] ||= []).push(rule);
    return json({
      programs: (results || []).map((program) => ({
        ...program,
        eligibility_rules: rulesByProgram[program.id] || [],
      })),
    });
  }

  if (path === "/api/core-curricula" && request.method === "GET") {
    const school = url.searchParams.get("school");
    let where = " WHERE review_status = 'reviewed' AND type = 'core_curriculum'", binds = [];
    if (school) { where += " AND school_slug = ?"; binds.push(school); }
    const { results } = await env.DB.prepare(`SELECT * FROM programs${where} ORDER BY name`).bind(...binds).all();
    return json({ curricula: results });
  }

  if (path.match(/^\/api\/programs\/[^/]+\/requirements$/) && request.method === "GET") {
    const programId = decodeURIComponent(path.split("/")[3]);
    // Treat unreviewed programs exactly like unknown ids to avoid exposing
    // unreviewed requirements through the public endpoint.
    const program = await env.DB.prepare(
      `SELECT * FROM programs WHERE id = ? AND review_status = 'reviewed'`
    ).bind(programId).first();
    if (!program) return json({ error: "not found" }, 404);
    const [tree, eligibilityRules] = await Promise.all([
      getRequirementTree(env, programId),
      getProgramEligibilityRules(env, [programId]),
    ]);
    return json({ program, requirements: tree, eligibility_rules: eligibilityRules });
  }

  if (path === "/api/requirements" && request.method === "GET") {
    const ids = (url.searchParams.get("programs") || "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return json({ error: "pass ?programs=id1,id2" }, 400);
    const out = {};
    const { results: reviewedPrograms } = await env.DB.prepare(
      `SELECT id FROM programs WHERE review_status = 'reviewed' AND id IN (${ids.map(() => "?").join(",")})`
    ).bind(...ids).all();
    const reviewedIds = new Set(reviewedPrograms.map((program) => program.id));
    const visibleIds = ids.filter((id) => reviewedIds.has(id));

    // Silently omit unknown or unreviewed ids, keeping the response useful
    // for any reviewed programs requested alongside them.
    for (const id of visibleIds) out[id] = await getRequirementTree(env, id);

    let doubleCounts = [];
    if (visibleIds.length) {
      const { results } = await env.DB.prepare(
        `SELECT * FROM double_count_rules WHERE program_a IN (${visibleIds.map(() => "?").join(",")}) OR program_b IN (${visibleIds.map(() => "?").join(",")})`
      ).bind(...visibleIds, ...visibleIds).all();
      doubleCounts = results;
    }
    const eligibilityRules = await getProgramEligibilityRules(env, visibleIds);
    return json({ requirements: out, double_count_rules: doubleCounts, eligibility_rules: eligibilityRules });
  }

  // School-scoped double-count caps (e.g. "RBS majors may share at most 1
  // course total across all declared majors"). See
  // schema_double_count_policies.sql for why this is separate from the
  // pairwise double_count_rules table above. Public read, same as the
  // routes above it — this is planning info, not admin/scrape machinery.
  if (path === "/api/double-count-policies" && request.method === "GET") {
    const school = url.searchParams.get("school");
    let where = "", binds = [];
    if (school) { where = " WHERE school_slug = ?"; binds.push(school); }
    const { results } = await env.DB.prepare(`SELECT * FROM double_count_policies${where}`).bind(...binds).all();
    return json({ policies: results });
  }

  // Program selection is governed by a student's home school, program type,
  // and occasionally by a specific cross-school combination. This read route
  // lets the UI show the currently reviewed limits without copying policy
  // numbers into index.html.
  if (path === "/api/program-selection-policies" && request.method === "GET") {
    const homeSchoolSlug = url.searchParams.get("home_school") || "";
    if (!isSafeHomeSchoolSlug(homeSchoolSlug)) {
      return json({ error: "pass a valid ?home_school=..." }, 400);
    }
    return json({ home_school_slug: homeSchoolSlug, ...(await getProgramSelectionPolicies(env, homeSchoolSlug)) });
  }

  // Stateless validation before the browser saves a selection. It only reads
  // reviewed program/policy data, so it is deliberately public and contains
  // no student data or admin secret.
  if (path === "/api/program-selection-check" && request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "body must be JSON" }, 400);
    }
    const homeSchoolSlug = body?.home_school;
    const programIds = Array.isArray(body?.program_ids) ? body.program_ids : null;
    if (!isSafeHomeSchoolSlug(homeSchoolSlug)) {
      return json({ error: "body.home_school must be a valid school slug" }, 400);
    }
    if (!programIds || programIds.length > 20 || programIds.some((id) => !isSafeProgramId(id))) {
      return json({ error: "body.program_ids must contain up to 20 valid program ids" }, 400);
    }
    const ids = [...new Set(programIds)];
    let programs = [];
    if (ids.length) {
      const { results } = await env.DB.prepare(
        `SELECT id, school_slug, type
         FROM programs
         WHERE review_status = 'reviewed' AND type NOT IN ('shared_requirement_set', 'core_curriculum')
           AND id IN (${ids.map(() => "?").join(",")})`
      ).bind(...ids).all();
      programs = results || [];
    }
    const [policyData, eligibilityRules] = await Promise.all([
      getProgramSelectionPolicies(env, homeSchoolSlug),
      getProgramEligibilityRules(env, programs.map((program) => program.id)),
    ]);
    return json(evaluateProgramSelection({
      homeSchoolSlug,
      selectedProgramIds: ids,
      programs,
      limits: policyData.limits,
      combinationPolicies: policyData.combination_policies,
      eligibilityRules,
    }));
  }

  // ---- Admin: everything below requires ?secret= ----
  if (path.startsWith("/api/admin/") && (path.startsWith("/api/admin/programs") || path.startsWith("/api/admin/scrape") || path.startsWith("/api/admin/review") || path.startsWith("/api/admin/requirement"))) {
    if (!checkAdmin(url)) return json({ error: "bad secret" }, 403);

    // Seed a program by hand — the reliable path, always works regardless
    // of whether index-page discovery finds anything for that school.
    if (path === "/api/admin/programs/seed" && request.method === "POST") {
      const body = await request.json();
      const items = Array.isArray(body) ? body : [body];
      const stmts = items.map((p) =>
        env.DB.prepare(
          `INSERT INTO programs (id, name, school_slug, program_slug, type, catalog_year, source_url)
           VALUES (?,?,?,?,?,?,?)
           ON CONFLICT(id) DO UPDATE SET name=excluded.name, school_slug=excluded.school_slug,
             program_slug=excluded.program_slug, type=excluded.type, catalog_year=excluded.catalog_year`
        ).bind(p.id, p.name, p.school_slug, p.program_slug, p.type, p.catalog_year || null, p.source_url || null)
      );
      await env.DB.batch(stmts);
      return json({ ok: true, seeded: items.length });
    }

    // Best-effort auto-discovery of program slugs from a school's index page.
    if (path === "/api/admin/programs/discover" && request.method === "POST") {
      const schoolSlug = url.searchParams.get("school");
      const indexPath = url.searchParams.get("index_path"); // e.g. /schools/rbsnb/degree-requirements/programs-majors-minors
      if (!schoolSlug || !indexPath) return json({ error: "pass ?school=...&index_path=..." }, 400);
      const result = await discoverPrograms(env, schoolSlug, indexPath);
      return json(result);
    }

    // Scrape one program (?program=id) or every program that hasn't been
    // scraped yet / is due for a refresh (no query param).
    // Scrape one program from the OLD Coursedog catalog source (prose-heavy,
    // no reliable elective lists — see the big comment above
    // scrapeProgramFromBizSite). Kept for Business Core / required-course
    // sections, which that source does parse fine.
    if (path === "/api/admin/scrape-programs" && request.method === "POST") {
      const singleId = url.searchParams.get("program");
      let targets;
      if (singleId) {
        const p = await env.DB.prepare(`SELECT * FROM programs WHERE id = ?`).bind(singleId).first();
        if (!p) return json({ error: "unknown program id" }, 404);
        targets = [p];
      } else {
        const { results } = await env.DB.prepare(`SELECT * FROM programs`).all();
        targets = results;
      }
      const run = async () => {
        const results = [];
        for (const p of targets) {
          results.push({ id: p.id, ...(await scrapeProgram(env, p)) });
          // Be polite to a public site — small gap between requests.
          await new Promise((r) => setTimeout(r, 300));
        }
        return results;
      };
      if (targets.length > 1) {
        ctx.waitUntil(run());
        return json({ ok: true, mode: "background", programs: targets.length, note: "poll GET /api/admin/scrape-log" });
      }
      const results = await run();
      return json({ ok: true, mode: "sync", results });
    }

    if (path === "/api/admin/scrape-log" && request.method === "GET") {
      const limit = Math.min(Number(url.searchParams.get("limit") || 30), 100);
      const { results } = await env.DB.prepare(`SELECT * FROM scrape_log ORDER BY id DESC LIMIT ?`).bind(limit).all();
      return json({ log: results });
    }

    // Scrape one program from www.business.rutgers.edu instead of the
    // Coursedog catalog — see the big comment above scrapeProgramFromBizSite
    // for why. Deliberately single-program-only (no bulk "scrape everything"
    // mode like /api/admin/scrape-programs has) until the table parsing has
    // been checked against a real scrape-log sample for at least one
    // program — this table markup was inferred from rendered page text,
    // not confirmed against Rutgers' literal HTML.
    if (path === "/api/admin/scrape-programs-biz" && request.method === "POST") {
      const programId = url.searchParams.get("program");
      if (!programId) return json({ error: "pass ?program=id — this endpoint is single-program-only until you've checked its output once" }, 400);
      const p = await env.DB.prepare(`SELECT * FROM programs WHERE id = ?`).bind(programId).first();
      if (!p) return json({ error: "unknown program id" }, 404);
      const result = await scrapeProgramFromBizSite(env, p);
      return json({ ok: result.ok, program: programId, ...result });
    }

    // School-level Core Curriculum is separate from a major by design. It
    // uses the public New Brunswick Core list and remains unreviewed until a
    // human explicitly marks the parsed result reviewed.
    if (path === "/api/admin/scrape-core-curriculum" && request.method === "POST") {
      const programId = url.searchParams.get("program") || RBS_CORE_PROGRAM_ID;
      const p = await env.DB.prepare(`SELECT * FROM programs WHERE id = ? AND type = 'core_curriculum'`).bind(programId).first();
      if (!p) return json({ error: "unknown Core Curriculum id" }, 404);
      const result = await scrapeCoreCurriculum(env, p);
      return json({ ok: result.ok, program: programId, ...result });
    }

    // Review queue: programs that are unreviewed, or that still have
    // unresolved prose notes worth a human's attention.
    if (path === "/api/admin/review" && request.method === "GET") {
      const { results: programs } = await env.DB.prepare(
        `SELECT * FROM programs WHERE review_status != 'reviewed' OR id IN (SELECT DISTINCT program_id FROM requirement_raw_notes WHERE resolved = 0) ORDER BY name`
      ).all();
      const out = [];
      for (const p of programs) {
        const tree = await getRequirementTree(env, p.id);
        const { results: notes } = await env.DB.prepare(
          `SELECT * FROM requirement_raw_notes WHERE program_id = ? AND resolved = 0`
        ).bind(p.id).all();
        out.push({ program: p, requirements: tree, unresolved_notes: notes });
      }
      return json({ review_queue: out });
    }

    if (path === "/api/admin/programs/review-status" && request.method === "POST") {
      const { program_id, status } = await request.json();
      await env.DB.prepare(`UPDATE programs SET review_status = ? WHERE id = ?`).bind(status, program_id).run();
      return json({ ok: true });
    }

    // Hand-add/edit a requirement group (how you encode the prose rules
    // that requirement_raw_notes surfaced — e.g. "3 BAIT electives, at
    // least 1 from dept 136" becomes a min_courses/min_credits group here).
    if (path === "/api/admin/requirement-groups" && request.method === "POST") {
      const g = await request.json();
      const id = g.id || `${g.program_id}-manual-${Date.now()}`;
      await env.DB.prepare(
        `INSERT INTO requirement_groups (id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated)
         VALUES (?,?,?,?,?,?,?,0)
         ON CONFLICT(id) DO UPDATE SET name=excluded.name, rule=excluded.rule, count=excluded.count, parent_group_id=excluded.parent_group_id`
      ).bind(id, g.program_id, g.parent_group_id || null, g.name, g.rule, g.count ?? null, g.sort_order ?? 0).run();
      if (Array.isArray(g.courses)) {
        const stmts = g.courses.map((code) =>
          env.DB.prepare(`INSERT OR REPLACE INTO requirement_courses (group_id, course_code, note) VALUES (?,?,?)`)
            .bind(id, code, "")
        );
        if (stmts.length) await env.DB.batch(stmts);
      }
      return json({ ok: true, id });
    }

    if (path.match(/^\/api\/admin\/requirement-notes\/\d+\/resolve$/) && request.method === "POST") {
      const noteId = Number(path.split("/")[4]);
      await env.DB.prepare(`UPDATE requirement_raw_notes SET resolved = 1 WHERE id = ?`).bind(noteId).run();
      return json({ ok: true });
    }

    // Delete a hand-added requirement group (and its course rows + any
    // children). Only ever needed for manual (auto_generated=0) groups —
    // scraped groups get cleaned up automatically by re-scraping instead.
    // Added to clean up stray/never-finished manual groups (e.g. an
    // early "rbsnb-bait-manual-..." placeholder with one dummy course)
    // left behind from a review session that didn't get closed out.
    if (path.match(/^\/api\/admin\/requirement-groups\/[^/]+$/) && request.method === "DELETE") {
      const groupId = decodeURIComponent(path.split("/")[4]);
      const g = await env.DB.prepare(`SELECT * FROM requirement_groups WHERE id = ?`).bind(groupId).first();
      if (!g) return json({ error: "not found" }, 404);
      if (g.auto_generated) {
        return json({ error: "refusing to delete an auto_generated group — re-scrape the program instead, or edit it via POST if you really mean to hand-override it" }, 400);
      }
      const { results: childIds } = await env.DB.prepare(`SELECT id FROM requirement_groups WHERE parent_group_id = ?`).bind(groupId).all();
      const allIds = [groupId, ...childIds.map((c) => c.id)];
      const stmts = allIds.flatMap((id) => [
        env.DB.prepare(`DELETE FROM requirement_courses WHERE group_id = ?`).bind(id),
        env.DB.prepare(`DELETE FROM requirement_groups WHERE id = ?`).bind(id),
      ]);
      await env.DB.batch(stmts);
      return json({ ok: true, deleted: allIds });
    }

    return json({ error: "not found under /api/admin" }, 404);
  }

  return null; // not a programs-related route — let worker.js fall through
}
