-- Double-count policies — D1 schema addition (v2)
-- Run with: wrangler d1 execute rutgers_courses --file=schema_double_count_policies.sql --remote
--
-- WHY THIS TABLE EXISTS (don't skip this if you're re-deriving the schema):
-- The original plan was to model double-counting purely with
-- `double_count_rules` (schema_programs.sql), keyed on a specific pair of
-- program ids. That works for one-off agreements between two named
-- programs, but real Rutgers policy on this is stated per SCHOOL, not per
-- pair of majors — e.g. "RBS students may double-count one course, total,
-- across ALL their RBS majors" is a cap on the whole set of majors a
-- student holds in that school, not a per-pair rule. A pairwise table
-- can't represent "one course total across N majors" without enumerating
-- every pair, which breaks down as more programs get seeded.
--
-- CONFIRMED SO FAR (as of this migration) — do not assume any of this
-- generalizes to a school not listed here. Every school needs its own
-- verified source before you add a row:
--   rbsnb (RBS-New Brunswick): major-vs-major double count capped at ONE
--     course, one time, across a student's entire degree — not one per
--     pair of majors. Also: majors and concentrations may NEVER share a
--     course (cap of 0), which is a distinct rule from major-vs-major.
--   sas: no equivalent cap found. SAS's own Data Science program states
--     explicitly "no restriction for double counting courses for other
--     RUNB majors" — only restriction found is within a single major's
--     own requirements (can't reuse one course for two requirements
--     inside the SAME major), which isn't a cross-major rule at all.
--   soe (Engineering): no cap found; one example (math minor guidance)
--     implies overlap between a major's technical electives and a minor
--     is expected/allowed.
-- Treat "no row for this school" as UNRESTRICTED, not "unknown/zero" —
-- absence of a found policy is not the same as a policy of zero.

CREATE TABLE IF NOT EXISTS double_count_policies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  school_slug TEXT NOT NULL,        -- matches programs.school_slug, e.g. 'rbsnb'
  scope TEXT NOT NULL DEFAULT 'major_major',  -- 'major_major' | 'major_concentration'
  max_shared_courses INTEGER,       -- total courses a student may double-count under this
                                     -- scope, counted ONCE across their whole degree — not
                                     -- per pair of programs. 0 = never allowed. NULL/no row
                                     -- = no policy found = treat as unrestricted.
  note TEXT,
  source_url TEXT,
  verified_at INTEGER,              -- when a human last confirmed this against the source
  UNIQUE(school_slug, scope)
);
CREATE INDEX IF NOT EXISTS idx_dcpolicies_school ON double_count_policies(school_slug);

-- Seed the two confirmed RBS-New Brunswick rules.
INSERT INTO double_count_policies (school_slug, scope, max_shared_courses, note, source_url, verified_at)
VALUES
  (
    'rbsnb',
    'major_major',
    1,
    'Students with 2+ RBS majors may double-count exactly ONE course, ONE TIME, across their entire Bachelor''s degree. This is a per-student cap across all their RBS majors combined -- not one course per pair of majors.',
    'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/seniors',
    strftime('%s','now') * 1000
  ),
  (
    'rbsnb',
    'major_concentration',
    0,
    'No course may ever be double-counted between an RBS major and an RBS concentration. Concentration courses must be entirely on top of the major''s required courses.',
    'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/policies-procedures',
    strftime('%s','now') * 1000
  )
ON CONFLICT(school_slug, scope) DO UPDATE SET
  max_shared_courses = excluded.max_shared_courses,
  note = excluded.note,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at;

-- NOTE: `double_count_rules` (from schema_programs.sql) is NOT removed by
-- this migration. Keep it for genuine pairwise special cases that override
-- a school-wide policy (e.g. a specific articulation agreement between two
-- named programs). Read-side logic should check double_count_rules for the
-- specific pair FIRST, and fall back to double_count_policies for the
-- programs' shared school_slug if no specific pair row exists.
