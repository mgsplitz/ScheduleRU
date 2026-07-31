/**
 * Rutgers course sync + API — Cloudflare Worker
 *
 * ============================================================
 * WHAT CHANGED FROM v1 (read this first)
 * ============================================================
 * The first version looped over `tracked_subjects` and called
 * courses.json once per subject, assuming `?subject=136` filtered
 * server-side. It doesn't — Rutgers' courses.json ignores that
 * param entirely and returns the FULL term catalog (~4,400+
 * courses across every subject) no matter what you pass. So v1
 * was making up to 20 redundant subrequests per cron run that all
 * returned the identical full dataset, and only ever stored the
 * subjects you'd manually tracked.
 *
 * v2 fixes both problems at once:
 *   - Fetch the full catalog ONCE per run (not per subject). Every
 *     course object already carries its own correct `subject` and
 *     `subjectDescription` fields, so we store ALL subjects, not
 *     just a tracked subset. `tracked_subjects` is gone entirely.
 *   - Writing ~4,400 courses + their sections + meeting times is
 *     15,000+ D1 rows — too many statements to safely land in one
 *     Worker invocation. So the source fetch is always fresh and
 *     full, but the WRITE is chunked: each cron run writes
 *     COURSES_PER_RUN courses (a slice of the freshly-fetched
 *     list, tracked by a cursor) and picks up where it left off
 *     next run. At COURSES_PER_RUN=400 and a 15-minute cron, a
 *     full pass over ~4,400 courses takes ~2-3 hours; any single
 *     course is never more than that many minutes stale.
 *   - POST /api/admin/sync-now?full=true bypasses the cursor and
 *     writes the entire catalog in one background pass (via
 *     ctx.waitUntil, chunked internally so it doesn't blow D1's
 *     per-batch statement limit) — use this once after first
 *     deploying instead of waiting hours for the cursor to catch up.
 *
 * VERIFY THIS AGAINST REAL DATA
 * mapCourseJson() below matches the actual field names confirmed
 * from a live response (courseString, expandedTitle, courseDescription,
 * preReqNotes, subject, subjectDescription, credits, sections[],
 * openSections, etc.) — this is no longer a guess. Every sync still
 * logs a raw sample to sync_log as a safety net; check
 * GET /api/sync-log if anything looks off after deploying.
 */

import { handleProgramsApi } from "./programs.js";
import { handleScheduleAssistantRequest } from "./schedule-assistant.js";
import { handleCatalogAdminRequest } from "./catalog-admin.js";

const RUTGERS_BASE = "https://sis.rutgers.edu/soc/api";
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function activeTermConfiguration(env) {
  const activeYear = Number(env.CURRENT_YEAR);
  const activeTerm = String(env.CURRENT_TERM || "");
  if (!Number.isInteger(activeYear) || activeYear < 2000 || activeYear > 2100
    || !["0", "1", "7", "9"].includes(activeTerm)) return null;
  const catalogStartYear = activeTerm === "9" ? activeYear : activeYear - 1;
  return { activeYear, activeTerm, catalogYear: `${catalogStartYear}-${catalogStartYear + 1}` };
}

const COURSE_CODE_PATTERN = /^\d{2}:\d{3}:\d{3}$/;

// The browser sends only selector shapes that came from a reviewed program
// rule. Validate them again here so catalog filtering stays fail-closed and
// can never turn query parameters into SQL syntax.
function parseCourseSelectorFilter(rawValue) {
  let raw;
  try {
    raw = JSON.parse(rawValue);
  } catch (_) {
    return null;
  }
  const values = Array.isArray(raw) ? raw : [raw];
  if (!values.length || values.length > 12) return null;
  const unique = (items, pattern, limit) => [...new Set((Array.isArray(items) ? items : [])
    .map((item) => String(item || "").trim())
    .filter((item) => pattern.test(item)))].slice(0, limit);
  const selectors = [];
  for (const value of values) {
    if (!value || typeof value !== "object" || Array.isArray(value) || Number(value.version) !== 1) return null;
    const exclude_course_codes = unique(value.exclude_course_codes, COURSE_CODE_PATTERN, 400);
    if (value.kind === "course_codes") {
      const include_course_codes = unique(value.include_course_codes, COURSE_CODE_PATTERN, 400);
      if (!include_course_codes.length) return null;
      selectors.push({ kind: "course_codes", include_course_codes, exclude_course_codes });
      continue;
    }
    if (value.kind === "subject_level") {
      const school_codes = unique(value.school_codes, /^\d{2}$/, 8);
      const subject_codes = unique(value.subject_codes, /^\d{3}$/, 12);
      const course_number_min = value.course_number_min === undefined ? 0 : Number(value.course_number_min);
      const course_number_max = value.course_number_max === undefined ? 999 : Number(value.course_number_max);
      const minimum_credits = value.minimum_credits === undefined ? 0 : Number(value.minimum_credits);
      if (!school_codes.length || !subject_codes.length
        || !Number.isInteger(course_number_min) || !Number.isInteger(course_number_max)
        || course_number_min < 0 || course_number_max > 999 || course_number_min > course_number_max
        || !Number.isFinite(minimum_credits) || minimum_credits < 0 || minimum_credits > 99) return null;
      selectors.push({
        kind: "subject_level", school_codes, subject_codes,
        course_number_min, course_number_max, minimum_credits, exclude_course_codes,
      });
      continue;
    }
    return null;
  }
  return selectors;
}

function selectorWhereClause(selectors) {
  const catalogCode = "c.school || ':' || c.subject_code || ':' || c.course_number";
  const binds = [];
  const placeholders = (values) => values.map(() => "?").join(",");
  const clauses = selectors.map((selector) => {
    if (selector.kind === "course_codes") {
      const parts = [`${catalogCode} IN (SELECT value FROM json_each(?))`];
      binds.push(JSON.stringify(selector.include_course_codes));
      if (selector.exclude_course_codes.length) {
        parts.push(`${catalogCode} NOT IN (SELECT value FROM json_each(?))`);
        binds.push(JSON.stringify(selector.exclude_course_codes));
      }
      return `(${parts.join(" AND ")})`;
    }
    const parts = [
      `c.school IN (${placeholders(selector.school_codes)})`,
      `c.subject_code IN (${placeholders(selector.subject_codes)})`,
      "CAST(c.course_number AS INTEGER) BETWEEN ? AND ?",
    ];
    binds.push(...selector.school_codes, ...selector.subject_codes, selector.course_number_min, selector.course_number_max);
    if (selector.minimum_credits > 0) {
      parts.push("CAST(c.credits AS REAL) >= ?");
      binds.push(selector.minimum_credits);
    }
    if (selector.exclude_course_codes.length) {
      parts.push(`${catalogCode} NOT IN (SELECT value FROM json_each(?))`);
      binds.push(JSON.stringify(selector.exclude_course_codes));
    }
    return `(${parts.join(" AND ")})`;
  });
  return { sql: `(${clauses.join(" OR ")})`, binds };
}

/* ============================================================
   FETCH FROM RUTGERS (source of truth — always full & fresh)
   ============================================================ */
async function fetchFullCatalog(env) {
  const url = `${RUTGERS_BASE}/courses.json?year=${env.CURRENT_YEAR}&term=${env.CURRENT_TERM}&campus=NB`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 (compatible; RutgersCourseSync/2.0)" },
  });
  const text = await res.text();
  const trimmed = text.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    throw new Error(`Non-JSON response (HTTP ${res.status}): ${trimmed.slice(0, 300)}`);
  }
  const list = JSON.parse(trimmed);
  if (!Array.isArray(list)) throw new Error("Response was JSON but not an array");
  return list;
}

async function fetchOpenSections(env) {
  try {
    const res = await fetch(`${RUTGERS_BASE}/openSections.json?year=${env.CURRENT_YEAR}&term=${env.CURRENT_TERM}&campus=NB`);
    const list = await res.json();
    return new Set((Array.isArray(list) ? list : []).map(String));
  } catch (err) {
    return new Set(); // non-fatal — sections just show as closed until next run
  }
}

/* ============================================================
   MAP + WRITE
   ============================================================ */
function mapCourseJson(course, env, openSet, now) {
  const school = course.offeringUnitCode || course.school || "01";
  const subj = String(course.subject || "").padStart(3, "0");
  const num = course.courseNumber || (course.courseString ? course.courseString.split(":").pop() : "");
  const year = Number(env.CURRENT_YEAR);
  const term = env.CURRENT_TERM;
  const courseId = `${school}:${subj}:${num}:${year}:${term}`;

  const sections = (course.sections || []).map((s) => {
    const index = String(s.index || s.indexNumber || "");
    const sectionId = `${courseId}:${index}`;
    const open = s.openStatus === true || openSet.has(index) ? 1 : 0;
    const meetings = (s.meetingTimes || []).map((m) => ({
      day_of_week: m.meetingDay || m.day || "",
      start_time: m.startTime || m.startTimeMilitary || "",
      end_time: m.endTime || m.endTimeMilitary || "",
      building: m.buildingCode || m.building || "",
      room: m.roomNumber || m.room || "",
      mode: m.meetingModeDesc || m.mode || "",
    }));

    // comments[] is an array of {code, description} — join the human-readable
    // descriptions (e.g. "Go to http://canvas.rutgers.edu").
    const commentsText = (Array.isArray(s.comments) ? s.comments : [])
      .map((c) => c.description || c.text || c.code || "")
      .filter(Boolean)
      .join("; ");

    // There's no single confirmed "restrictions" field in the live sample —
    // Rutgers appears to compose it from a few different places depending on
    // the section (class-level eligibility text, restricted majors/minors).
    // Best-effort join of whichever of these are non-empty; if this ends up
    // blank for a section you know has a restriction shown on CSP, check
    // GET /api/sync-log's raw_sample for that section and adjust here.
    const restrictionParts = [];
    if (s.sectionEligibility) restrictionParts.push(s.sectionEligibility);
    if (Array.isArray(s.majors) && s.majors.length)
      restrictionParts.push(s.majors.map((m) => m.description || m.major || m.code || "").filter(Boolean).join(", "));
    if (Array.isArray(s.minors) && s.minors.length)
      restrictionParts.push(s.minors.map((m) => m.description || m.minor || m.code || "").filter(Boolean).join(", "));
    if (Array.isArray(s.unitMajors) && s.unitMajors.length)
      restrictionParts.push(s.unitMajors.map((m) => m.description || m.code || "").filter(Boolean).join(", "));

    return {
      id: sectionId,
      course_id: courseId,
      index_number: index,
      section_number: s.number || s.sectionNumber || "",
      instructor:
        s.instructorsText ||
        (Array.isArray(s.instructors) ? s.instructors.map((i) => i.name).join(", ") : "") ||
        "",
      open_status: open,
      campus: s.campusCode || "NB",
      notes: s.sectionNotes || "",
      restrictions: restrictionParts.filter(Boolean).join(" · "),
      comments: commentsText,
      open_to: s.openToText || "",
      synced_at: now,
      meetings,
    };
  });

  return {
    course: {
      id: courseId,
      school,
      subject_code: subj,
      subject_description: course.subjectDescription || "",
      course_number: num,
      year,
      term,
      // Rutgers supplies a short display label and, for many courses, a
      // complete expanded title. Prefer the latter so the catalog and degree
      // requirements use understandable names instead of abbreviations.
      title: course.expandedTitle || course.title || "(untitled)",
      credits: String(course.credits ?? course.creditsObject?.value ?? ""),
      description: course.courseDescription || "",
      prereqs: course.preReqNotes || "",
      subject_notes: course.subjectNotes || course.subjectGroupNotes || "",
      synced_at: now,
    },
    sections,
  };
}

function courseStatements(env, mapped) {
  const c = mapped.course;
  const stmts = [
    env.DB.prepare(
      `INSERT INTO courses (id, school, subject_code, subject_description, course_number, year, term, title, credits, description, prereqs, subject_notes, synced_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         subject_description=excluded.subject_description, title=excluded.title,
         credits=excluded.credits, description=excluded.description,
         prereqs=excluded.prereqs, subject_notes=excluded.subject_notes, synced_at=excluded.synced_at`
    ).bind(c.id, c.school, c.subject_code, c.subject_description, c.course_number, c.year, c.term, c.title, c.credits, c.description, c.prereqs, c.subject_notes, c.synced_at),
  ];
  for (const sec of mapped.sections) {
    stmts.push(
      env.DB.prepare(
        `INSERT INTO sections (id, course_id, index_number, section_number, instructor, open_status, campus, notes, restrictions, comments, open_to, synced_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(id) DO UPDATE SET instructor=excluded.instructor, open_status=excluded.open_status,
           notes=excluded.notes, restrictions=excluded.restrictions, comments=excluded.comments,
           open_to=excluded.open_to, synced_at=excluded.synced_at`
      ).bind(sec.id, sec.course_id, sec.index_number, sec.section_number, sec.instructor, sec.open_status, sec.campus, sec.notes, sec.restrictions, sec.comments, sec.open_to, sec.synced_at)
    );
    stmts.push(env.DB.prepare(`DELETE FROM meetings WHERE section_id = ?`).bind(sec.id));
    for (const m of sec.meetings) {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO meetings (section_id, day_of_week, start_time, end_time, building, room, mode) VALUES (?,?,?,?,?,?,?)`
        ).bind(sec.id, m.day_of_week, m.start_time, m.end_time, m.building, m.room, m.mode)
      );
    }
  }
  return stmts;
}

// Writes `courses` (a slice of the full list) to D1 in small batches so no
// single .batch() call has an unbounded number of statements (a course with
// many sections/meetings can generate 20-30 statements on its own).
async function writeCourses(env, courses, openSet, now) {
  const MAX_STMTS_PER_BATCH = 400;
  let buffer = [];
  let written = 0;

  async function flush() {
    if (!buffer.length) return;
    await env.DB.batch(buffer);
    buffer = [];
  }

  for (const raw of courses) {
    const mapped = mapCourseJson(raw, env, openSet, now);
    const stmts = courseStatements(env, mapped);
    if (buffer.length + stmts.length > MAX_STMTS_PER_BATCH) await flush();
    buffer.push(...stmts);
    written++;
  }
  await flush();
  return written;
}

async function logSync(env, label, status, courseCount, message, rawSample) {
  await env.DB.prepare(
    `INSERT INTO sync_log (subject_code, status, course_count, message, raw_sample, synced_at) VALUES (?,?,?,?,?,?)`
  ).bind(label, status, courseCount, message, rawSample, Date.now()).run();
}

/* ============================================================
   CRON: chunked cursor pass over a fresh full fetch
   ============================================================ */
async function runScheduledSync(env) {
  const chunkSize = Number(env.COURSES_PER_RUN || 400);
  const now = Date.now();

  let list, openSet;
  try {
    [list, openSet] = await Promise.all([fetchFullCatalog(env), fetchOpenSections(env)]);
  } catch (err) {
    await logSync(env, "__catalog__", "error", 0, `Full catalog fetch failed: ${err.message}`, "");
    return;
  }

  if (!list.length) {
    await logSync(env, "__catalog__", "empty", 0, "Rutgers returned zero courses for this term/year", "");
    return;
  }

  const stateRow = await env.DB.prepare(`SELECT course_cursor FROM sync_state WHERE id = 1`).first();
  let cursor = stateRow ? stateRow.course_cursor : 0;
  if (cursor >= list.length) cursor = 0;

  const slice = list.slice(cursor, cursor + chunkSize);
  let written = 0;
  try {
    written = await writeCourses(env, slice, openSet, now);
  } catch (err) {
    await logSync(env, "__write__", "error", 0, `D1 write failed at cursor ${cursor}: ${err.message}`, JSON.stringify(slice[0] || {}).slice(0, 500));
    return;
  }

  const nextCursor = (cursor + slice.length) % list.length;
  await env.DB.prepare(
    `UPDATE sync_state SET course_cursor=?, total_courses=?, last_fetch_at=? WHERE id = 1`
  ).bind(nextCursor, list.length, now).run();

  await logSync(env, "__catalog__", "ok", written, `wrote courses ${cursor}-${cursor + written} of ${list.length}`, JSON.stringify(list[0]).slice(0, 800));
}

// Full, non-cursor resync — call via POST /api/admin/sync-now?full=true.
// Runs in the background (ctx.waitUntil) since writing everything can take
// well over the ~50ms a fetch handler normally gets to respond.
async function runFullSync(env) {
  const now = Date.now();
  let list, openSet;
  try {
    [list, openSet] = await Promise.all([fetchFullCatalog(env), fetchOpenSections(env)]);
  } catch (err) {
    await logSync(env, "__full_sync__", "error", 0, `Full catalog fetch failed: ${err.message}`, "");
    return;
  }
  let written = 0;
  try {
    written = await writeCourses(env, list, openSet, now);
  } catch (err) {
    await logSync(env, "__full_sync__", "error", written, `D1 write failed partway: ${err.message}`, "");
    return;
  }
  await env.DB.prepare(
    `UPDATE sync_state SET course_cursor=0, total_courses=?, last_fetch_at=?, last_full_sync_at=? WHERE id = 1`
  ).bind(list.length, now, now).run();
  await logSync(env, "__full_sync__", "ok", written, `full manual resync — wrote all ${written} courses`, JSON.stringify(list[0]).slice(0, 800));
}

function checkAdmin(url, env) {
  return url.searchParams.get("secret") === env.ADMIN_SECRET;
}

/* ============================================================
   HTTP API (fetch) — reads only from D1, never calls Rutgers directly
   ============================================================ */
async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (request.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  if (path === "/api/schedule-assistant/interpret") {
    if (request.method !== "POST") return json({ error: "method not allowed" }, 405);
    const response = await handleScheduleAssistantRequest(request, env);
    for (const [header, value] of Object.entries(CORS_HEADERS)) response.headers.set(header, value);
    return response;
  }

  const catalogAdminResult = await handleCatalogAdminRequest(request, env);
  if (catalogAdminResult) return catalogAdminResult;

  if (path === "/api/config") {
    const configuration = activeTermConfiguration(env);
    if (!configuration) return json({ error: "invalid active term configuration" }, 500);
    return json({ activeYear: configuration.activeYear, activeTerm: configuration.activeTerm });
  }

  if (path === "/api/ap-equivalencies") {
    const configuration = activeTermConfiguration(env);
    if (!configuration) return json({ error: "invalid active term configuration" }, 500);
    try {
      const { results } = await env.DB.prepare(
        `SELECT id, exam_name, minimum_score, maximum_score, credits,
                equivalent_course_codes_json, fulfills_requirement_ids_json,
                catalog_year, campus, source_url, reviewed_at
         FROM ap_equivalencies
         WHERE review_status = 'reviewed' AND catalog_year = ? AND campus = ?
         ORDER BY exam_name, minimum_score, id`
      ).bind(configuration.catalogYear, "NB").all();
      return json({ equivalencies: results });
    } catch (_) {
      return json({ error: "AP equivalencies unavailable" }, 503);
    }
  }

  if (path === "/api/courses") {
    const q = (url.searchParams.get("search") || "").trim();
    const subject = (url.searchParams.get("subject") || "").trim();
    const selectorValue = url.searchParams.get("selector");
    const limit = Math.min(Number(url.searchParams.get("limit") || 25), 100);
    const offset = Number(url.searchParams.get("offset") || 0);

    // Rutgers uses some official catalog abbreviations (for example,
    // "INTRO COMPUTER SCI"). Search each meaningful word and its familiar
    // expansion so students can still find it by typing the full name.
    const searchAliases = {
      intro: ["introduction"], introduction: ["intro"],
      sci: ["science"], science: ["sci"],
      comp: ["computer"], computer: ["comp"],
      info: ["information"], information: ["info"],
      math: ["mathematics"], mathematics: ["math"],
      mgmt: ["management"], management: ["mgmt"],
    };
    const meaningfulTerms = q.toLowerCase().match(/[a-z0-9]+/g)?.filter((term) => !["and", "of", "the", "to", "for"].includes(term)) || [];
    let where = ` WHERE 1=1`;
    const binds = [];
    if (subject) { where += ` AND subject_code = ?`; binds.push(subject.padStart(3, "0")); }
    if (q) {
      const tokenClauses = meaningfulTerms.map((term) => {
        const variants = [...new Set([term, ...(searchAliases[term] || [])])];
        const fields = variants.flatMap(() => ["LOWER(title) LIKE ?", "LOWER(course_number) LIKE ?", "LOWER(subject_code) LIKE ?", "LOWER(id) LIKE ?"]);
        for (const variant of variants) for (let i = 0; i < 4; i++) binds.push(`%${variant}%`);
        return `(${fields.join(" OR ")})`;
      });
      // Preserve direct course-code searches (01:198:111) as one exact
      // substring match while natural-language searches use every word.
      where += ` AND (LOWER(id) LIKE ?${tokenClauses.length ? ` OR (${tokenClauses.join(" AND ")})` : ""})`;
      binds.splice(subject ? 1 : 0, 0, `%${q.toLowerCase()}%`);
    }
    if (selectorValue !== null) {
      const selectors = parseCourseSelectorFilter(selectorValue);
      if (!selectors) return json({ error: "invalid course selector" }, 400);
      const selector = selectorWhereClause(selectors);
      where += ` AND ${selector.sql}`;
      binds.push(...selector.binds);
    }

    const countRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM courses c${where}`).bind(...binds).first();
    const total = countRow ? countRow.n : 0;

    const sql = `SELECT c.*,
                   (SELECT COUNT(*) FROM sections s WHERE s.course_id = c.id) as section_count,
                   (SELECT COUNT(*) FROM sections s WHERE s.course_id = c.id AND s.open_status = 1) as open_count
                 FROM courses c${where} ORDER BY subject_code, course_number LIMIT ? OFFSET ?`;
    const { results } = await env.DB.prepare(sql).bind(...binds, limit, offset).all();
    return json({ courses: results, count: results.length, total, limit, offset });
  }

  if (path.match(/^\/api\/courses\/[^/]+$/)) {
    const courseId = decodeURIComponent(path.split("/")[3]);
    const course = await env.DB.prepare(`SELECT * FROM courses WHERE id = ?`).bind(courseId).first();
    if (!course) return json({ error: "not found" }, 404);
    return json({ course });
  }

  if (path.match(/^\/api\/courses\/[^/]+\/sections$/)) {
    const courseId = decodeURIComponent(path.split("/")[3]);
    const { results: sections } = await env.DB.prepare(`SELECT * FROM sections WHERE course_id = ?`).bind(courseId).all();
    for (const s of sections) {
      const { results: meetings } = await env.DB.prepare(
        `SELECT day_of_week, start_time, end_time, building, room, mode FROM meetings WHERE section_id = ?`
      ).bind(s.id).all();
      s.meetings = meetings;
    }
    return json({ sections });
  }

  if (path === "/api/subjects") {
    // Derived live from whatever's actually in the DB — no manual tracking list to maintain.
    const { results } = await env.DB.prepare(
      `SELECT subject_code as code, MAX(subject_description) as description, COUNT(*) as course_count
       FROM courses GROUP BY subject_code ORDER BY subject_code`
    ).all();
    return json({ subjects: results });
  }

  if (path === "/api/sync-status") {
    const state = await env.DB.prepare(`SELECT * FROM sync_state WHERE id = 1`).first();
    const countRow = await env.DB.prepare(`SELECT COUNT(*) as n FROM courses`).first();
    return json({
      course_cursor: state?.course_cursor ?? 0,
      total_courses_last_fetch: state?.total_courses ?? 0,
      courses_in_db: countRow?.n ?? 0,
      last_fetch_at: state?.last_fetch_at ?? null,
      last_full_sync_at: state?.last_full_sync_at ?? null,
      courses_per_run: Number(env.COURSES_PER_RUN || 400),
    });
  }

  if (path === "/api/sync-log") {
    const limit = Math.min(Number(url.searchParams.get("limit") || 30), 100);
    const { results } = await env.DB.prepare(`SELECT * FROM sync_log ORDER BY id DESC LIMIT ?`).bind(limit).all();
    return json({ log: results });
  }

  if (path === "/api/admin/sync-now" && request.method === "POST") {
    if (!checkAdmin(url, env)) return json({ error: "bad secret" }, 403);
    if (url.searchParams.get("full") === "true") {
      ctx.waitUntil(runFullSync(env));
      return json({ ok: true, mode: "full", note: "running in background — poll GET /api/sync-status or /api/sync-log" });
    }
    await runScheduledSync(env);
    return json({ ok: true, mode: "chunk" });
  }

  // Programs/requirements routes (majors, minors, degree-requirement trees)
  // live in programs.js — this stays here only to keep worker.js from
  // growing into one giant file. Returns null (falls through to 404 below)
  // if the path doesn't match anything it owns.
  const programsResult = await handleProgramsApi(request, env, ctx, path, url, json, (u) => checkAdmin(u, env));
  if (programsResult) return programsResult;

  return json(
    {
      error: "not found",
      available: [
        "GET /api/courses?search=&subject=&limit=&offset=",
        "GET /api/courses/:id",
        "GET /api/courses/:id/sections",
        "GET /api/subjects",
        "GET /api/sync-status",
        "GET /api/sync-log",
        "POST /api/admin/sync-now?secret=...            (writes one cursor chunk)",
        "POST /api/admin/sync-now?secret=...&full=true  (background full resync)",
        "--- programs / degree requirements ---",
        "GET /api/schools",
        "GET /api/programs?school=&type=",
        "GET /api/core-curricula?school=",
        "GET /api/programs/:id/requirements",
        "GET /api/requirements?programs=id1,id2",
        "GET /api/double-count-policies?school=",
        "GET /api/program-selection-policies?home_school=",
        "POST /api/program-selection-check               (body: {home_school, program_ids:[...]})",
        "POST /api/admin/programs/seed?secret=...            (body: {id,name,school_slug,program_slug,type,catalog_year} or an array)",
        "POST /api/admin/programs/discover?secret=...&school=&index_path=  (best-effort slug discovery)",
        "POST /api/admin/scrape-programs?secret=...[&program=id]",
        "POST /api/admin/scrape-core-curriculum?secret=...[&program=id]",
        "GET /api/admin/scrape-log?secret=...",
        "GET /api/admin/review?secret=...",
        "POST /api/admin/programs/review-status?secret=...   (body: {program_id, status})",
        "POST /api/admin/requirement-groups?secret=...       (body: {program_id, name, rule, count, courses:[...]})",
        "POST /api/admin/requirement-notes/:id/resolve?secret=...",
      ],
    },
    404
  );
}

export default {
  async fetch(request, env, ctx) {
    try {
      return await handleApi(request, env, ctx);
    } catch (err) {
      return json({ error: "internal error", detail: String(err) }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledSync(env));
  },
};
