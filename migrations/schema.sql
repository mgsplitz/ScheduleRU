-- Rutgers course catalog — D1 schema (v2)
-- Run with: wrangler d1 execute rutgers_courses --file=../migrations/schema.sql --remote
--
-- CHANGED FROM v1:
--   - tracked_subjects is GONE. Rutgers' courses.json ignores the subject
--     filter and always returns the full catalog, so there's nothing to
--     "track" — every course in every subject gets stored, and /api/subjects
--     now derives its list live from whatever's actually in `courses`.
--   - courses gained subject_description, description, prereqs — the
--     frontend's course-detail modal reads these directly instead of
--     needing a live call back to Rutgers.
--   - sync_cursor (subject_index) is replaced by sync_state (course_cursor),
--     which walks through the *course list itself* in chunks each cron run
--     instead of walking through a subject list making redundant calls.
--
-- MIGRATING AN EXISTING DEPLOYMENT (don't lose synced data):
--   wrangler d1 execute rutgers_courses --remote --command "ALTER TABLE courses ADD COLUMN subject_description TEXT"
--   wrangler d1 execute rutgers_courses --remote --command "ALTER TABLE courses ADD COLUMN description TEXT"
--   wrangler d1 execute rutgers_courses --remote --command "ALTER TABLE courses ADD COLUMN prereqs TEXT"
--   wrangler d1 execute rutgers_courses --remote --command "ALTER TABLE courses ADD COLUMN subject_notes TEXT"
--   wrangler d1 execute rutgers_courses --remote --command "ALTER TABLE sections ADD COLUMN notes TEXT"
--   wrangler d1 execute rutgers_courses --remote --command "ALTER TABLE sections ADD COLUMN restrictions TEXT"
--   wrangler d1 execute rutgers_courses --remote --command "ALTER TABLE sections ADD COLUMN comments TEXT"
--   wrangler d1 execute rutgers_courses --remote --command "ALTER TABLE sections ADD COLUMN open_to TEXT"
--   wrangler d1 execute rutgers_courses --remote --command "DROP TABLE IF EXISTS tracked_subjects"
--   wrangler d1 execute rutgers_courses --remote --command "DROP TABLE IF EXISTS sync_cursor"
--   wrangler d1 execute rutgers_courses --remote --command "CREATE TABLE IF NOT EXISTS sync_state (id INTEGER PRIMARY KEY CHECK (id=1), course_cursor INTEGER DEFAULT 0, total_courses INTEGER DEFAULT 0, last_fetch_at INTEGER, last_full_sync_at INTEGER)"
--   wrangler d1 execute rutgers_courses --remote --command "INSERT OR IGNORE INTO sync_state (id) VALUES (1)"
-- If you'd rather start clean (fine — cron/full-sync repopulates everything
-- within minutes), just drop everything and re-run this whole file instead.

CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,          -- "{school}:{subject}:{courseNumber}:{year}:{term}"
  school TEXT,
  subject_code TEXT,
  subject_description TEXT,
  course_number TEXT,
  year INTEGER,
  term TEXT,                    -- "0" Winter, "1" Spring, "7" Summer, "9" Fall
  title TEXT,
  credits TEXT,
  description TEXT,
  prereqs TEXT,
  subject_notes TEXT,           -- e.g. "NO SPECIAL PERMISSION WILL BE GRANTED FOR..." (subjectNotes field)
  synced_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_courses_subject ON courses(subject_code, year, term);
CREATE INDEX IF NOT EXISTS idx_courses_title ON courses(title);
CREATE INDEX IF NOT EXISTS idx_courses_number ON courses(course_number);

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,          -- "{course_id}:{index_number}"
  course_id TEXT,
  index_number TEXT,
  section_number TEXT,
  instructor TEXT,
  open_status INTEGER,          -- 1 = open, 0 = closed
  campus TEXT,
  notes TEXT,                   -- sectionNotes, e.g. "REQUIRED FACULTY PROCTOR PERMISSION..."
  restrictions TEXT,            -- derived from sectionEligibility / majors / minors / unitMajors
  comments TEXT,                -- comments[].description joined, e.g. "Go to http://canvas.rutgers.edu"
  open_to TEXT,                 -- openToText
  synced_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sections_course ON sections(course_id);

CREATE TABLE IF NOT EXISTS meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id TEXT,
  day_of_week TEXT,
  start_time TEXT,
  end_time TEXT,
  building TEXT,
  room TEXT,
  mode TEXT                     -- e.g. "LECTURE", "ONLINE"
);
CREATE INDEX IF NOT EXISTS idx_meetings_section ON meetings(section_id);

-- Every sync attempt is logged (success or failure) with a raw JSON sample,
-- so failures are diagnosable by querying GET /api/sync-log rather than
-- needing to watch a cron run live.
CREATE TABLE IF NOT EXISTS sync_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_code TEXT,            -- repurposed as a free-text label, e.g. "__catalog__" or "__full_sync__"
  status TEXT,                  -- "ok" | "error" | "empty"
  course_count INTEGER,
  message TEXT,
  raw_sample TEXT,
  synced_at INTEGER
);

-- Single-row cursor into the freshly-fetched course list, so each 15-minute
-- cron run writes the next COURSES_PER_RUN courses instead of re-writing
-- everything (or nothing) every time.
CREATE TABLE IF NOT EXISTS sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  course_cursor INTEGER DEFAULT 0,
  total_courses INTEGER DEFAULT 0,
  last_fetch_at INTEGER,
  last_full_sync_at INTEGER
);
INSERT OR IGNORE INTO sync_state (id, course_cursor, total_courses) VALUES (1, 0, 0);
