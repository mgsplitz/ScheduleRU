-- Programs / Degree Requirements — D1 schema addition (v1)
-- Lives in the SAME database as schema.sql (rutgers_courses) — no new D1
-- instance needed. This just adds tables so the requirements side can JOIN
-- against `courses` (e.g. "does this course id satisfy this requirement row").
--
-- Run with: wrangler d1 execute rutgers_courses --file=schema_programs.sql --remote
--
-- SOURCE OF THIS DATA: unlike courses.json (a real Rutgers API), there is no
-- public requirements API. This data is scraped from the public Coursedog-
-- powered catalog site (catalogs.rutgers.edu) and is inherently messier —
-- some of it parses cleanly into rows, some of it is free-text prose that
-- needs a human to encode into requirement_groups by hand once per program
-- per catalog year. See requirement_raw_notes below and worker.js's
-- /api/admin/review endpoint.

CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY,              -- e.g. "rbsnb-bait" — you choose this when seeding
  name TEXT NOT NULL,
  school_slug TEXT NOT NULL,        -- catalog URL segment, e.g. "rbsnb"
  program_slug TEXT NOT NULL,       -- catalog URL segment, e.g. "bait"
  type TEXT NOT NULL,               -- 'major' | 'minor' | 'concentration' | 'certificate'
  catalog_year TEXT,                -- e.g. "25-26", informational
  source_url TEXT,
  review_status TEXT DEFAULT 'unreviewed',  -- 'unreviewed' | 'reviewed' | 'needs_fix'
  last_scraped_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_programs_school ON programs(school_slug);
CREATE INDEX IF NOT EXISTS idx_programs_type ON programs(type);

-- A tree: parent_group_id lets groups nest so you can express AND-of-groups
-- and OR-of-groups instead of one flat bucket per program.
CREATE TABLE IF NOT EXISTS requirement_groups (
  id TEXT PRIMARY KEY,              -- generated, e.g. "rbsnb-bait-g3"
  program_id TEXT NOT NULL REFERENCES programs(id),
  parent_group_id TEXT REFERENCES requirement_groups(id),
  name TEXT,                        -- e.g. "Business Core", "Law/Ethics (choose 1)"
  display_family TEXT,              -- optional shared display family, e.g. 'rbsnb-business-core'
  display_priority INTEGER DEFAULT 0, -- higher reviewed variant replaces lower variants in one family
  rule TEXT NOT NULL,               -- 'all' | 'min_courses' | 'max_courses' | 'min_credits'
  count INTEGER,                    -- N for min/max_courses, credit count for min_credits
  sort_order INTEGER DEFAULT 0,
  auto_generated INTEGER DEFAULT 1  -- 1 = came from the scraper, 0 = you hand-added it
);
CREATE INDEX IF NOT EXISTS idx_reqgroups_program ON requirement_groups(program_id);
CREATE INDEX IF NOT EXISTS idx_reqgroups_parent ON requirement_groups(parent_group_id);

-- A reviewed group can apply only in a particular program combination. This
-- keeps path-specific requirements in data (for example, a Finance-major
-- path) instead of introducing a frontend exception for every school.
CREATE TABLE IF NOT EXISTS requirement_group_conditions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL REFERENCES requirement_groups(id),
  condition_type TEXT NOT NULL,     -- selected_program_must_include_one_of | selected_program_must_not_include_any
  condition_value_json TEXT NOT NULL,
  note TEXT,
  source_url TEXT,
  review_status TEXT DEFAULT 'unreviewed',
  UNIQUE(group_id, condition_type, condition_value_json)
);
CREATE INDEX IF NOT EXISTS idx_reqgroupconditions_group ON requirement_group_conditions(group_id);

CREATE TABLE IF NOT EXISTS requirement_courses (
  group_id TEXT NOT NULL REFERENCES requirement_groups(id),
  course_code TEXT NOT NULL,        -- "33:136:370" — matches courses.subject_code/course_number combined
  note TEXT,                        -- e.g. "required if double-majoring in Accounting"
  PRIMARY KEY (group_id, course_code)
);

-- Anything the scraper's regex parser couldn't confidently turn into a
-- clean requirement_group (prose rules, footnotes, cross-references) lands
-- here instead of being silently dropped. resolved flips to 1 once a human
-- has hand-encoded the rule into requirement_groups via the review UI.
CREATE TABLE IF NOT EXISTS requirement_raw_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id TEXT NOT NULL REFERENCES programs(id),
  section_name TEXT,
  raw_text TEXT,
  resolved INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rawnotes_program ON requirement_raw_notes(program_id);
CREATE INDEX IF NOT EXISTS idx_rawnotes_resolved ON requirement_raw_notes(resolved);

-- University-level (or your own) rules about how many credits can satisfy
-- two programs at once. Populate by hand from SAS/RBS policy pages — this
-- isn't something the per-program catalog pages state consistently.
CREATE TABLE IF NOT EXISTS double_count_rules (
  program_a TEXT NOT NULL,
  program_b TEXT NOT NULL,
  max_shared_credits INTEGER,
  note TEXT,
  PRIMARY KEY (program_a, program_b)
);

-- Narrow published exceptions to a school-wide double-count policy. Every
-- exception names both programs and the exact course codes it permits, so a
-- special case never silently opens the door to unrelated overlaps.
CREATE TABLE IF NOT EXISTS double_count_exceptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_a TEXT NOT NULL REFERENCES programs(id),
  program_b TEXT NOT NULL REFERENCES programs(id),
  allowed_course_codes_json TEXT NOT NULL,
  note TEXT,
  source_url TEXT,
  review_status TEXT DEFAULT 'unreviewed',
  verified_at INTEGER,
  UNIQUE(program_a, program_b)
);
CREATE INDEX IF NOT EXISTS idx_doublecountexceptions_program_a ON double_count_exceptions(program_a);
CREATE INDEX IF NOT EXISTS idx_doublecountexceptions_program_b ON double_count_exceptions(program_b);

-- Mirrors sync_log's role for the course sync — every scrape attempt logged
-- with a raw text sample, so parsing failures are diagnosable via
-- GET /api/admin/scrape-log instead of needing to reproduce them live.
CREATE TABLE IF NOT EXISTS scrape_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  program_id TEXT,
  status TEXT,                      -- "ok" | "error" | "empty"
  groups_written INTEGER,
  courses_written INTEGER,
  notes_written INTEGER,
  message TEXT,
  raw_sample TEXT,
  scraped_at INTEGER
);
