-- Program-selection policy data (v1)
--
-- Run against the intended environment only, for example:
--   npx wrangler d1 execute rutgers_courses_dev --env dev --remote \
--     --file=schema/schema_program_selection_policies.sql
--
-- WHY THIS IS SEPARATE FROM double_count_policies:
-- Double-count policies govern whether one COURSE can satisfy two programs.
-- These tables govern whether a STUDENT may select a combination of programs
-- in the first place. Rutgers rules differ by a student's home school, the
-- type of program, and sometimes a named pair of programs. Do not turn these
-- rows into an application-wide maximum.

CREATE TABLE IF NOT EXISTS program_selection_limits (
  home_school_slug TEXT NOT NULL,
  program_type TEXT NOT NULL,       -- major | minor | concentration | certificate | ...
  max_selected INTEGER NOT NULL CHECK (max_selected >= 0),
  note TEXT NOT NULL,
  source_url TEXT NOT NULL,
  verified_at INTEGER NOT NULL,
  PRIMARY KEY (home_school_slug, program_type)
);

CREATE TABLE IF NOT EXISTS program_combination_policies (
  policy_key TEXT PRIMARY KEY,
  home_school_slug TEXT NOT NULL,

  -- A side can match a named program, a school, a type, or a combination of
  -- those fields. Both sides need at least one populated matcher; the Worker
  -- rejects blank policy sides defensively.
  program_a_id TEXT,
  program_a_school_slug TEXT,
  program_a_type TEXT,
  program_b_id TEXT,
  program_b_school_slug TEXT,
  program_b_type TEXT,

  -- "blocked" means the app must not save the selection. "requires_transfer"
  -- is also blocked for the current home school. "requires_approval" remains
  -- selectable but must be shown as an advising warning. "allowed" records a
  -- reviewed positive exception when a future school needs one.
  decision TEXT NOT NULL CHECK (decision IN ('allowed', 'blocked', 'requires_approval', 'requires_transfer')),
  note TEXT NOT NULL,
  source_url TEXT NOT NULL,
  verified_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_program_selection_limits_home_school
  ON program_selection_limits(home_school_slug);
CREATE INDEX IF NOT EXISTS idx_program_combination_policies_home_school
  ON program_combination_policies(home_school_slug);

-- REVIEWED RBS-NEW BRUNSWICK LIMITS (official policy checked 2026-07-19).
-- These are independent limits by program type, not a single overall cap.
INSERT INTO program_selection_limits
  (home_school_slug, program_type, max_selected, note, source_url, verified_at)
VALUES
  (
    'rbsnb', 'major', 3,
    'RBS-New Brunswick students may declare up to three majors.',
    'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/policies-procedures',
    strftime('%s','now') * 1000
  ),
  (
    'rbsnb', 'minor', 3,
    'RBS-New Brunswick students may declare up to three minors. RBS minors themselves are not permitted; see the reviewed combination policy below.',
    'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/policies-procedures',
    strftime('%s','now') * 1000
  ),
  (
    'rbsnb', 'concentration', 1,
    'RBS-New Brunswick students may declare only one concentration.',
    'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/policies-procedures',
    strftime('%s','now') * 1000
  )
ON CONFLICT(home_school_slug, program_type) DO UPDATE SET
  max_selected = excluded.max_selected,
  note = excluded.note,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at;

-- REVIEWED RBS-NEW BRUNSWICK COMBINATION RULES.
-- We seed only facts that the official policy states clearly. In particular,
-- RBS says "most" SAS/SEBS second majors are permitted, so that statement is
-- intentionally NOT represented as a blanket allow rule. Each exception will
-- be added only after its own program data and policy have been reviewed.
INSERT INTO program_combination_policies
  (policy_key, home_school_slug,
   program_a_school_slug, program_a_type,
   program_b_school_slug, program_b_type,
   decision, note, source_url, verified_at)
VALUES
  (
    'rbsnb-no-rbs-minors', 'rbsnb',
    'rbsnb', 'major',
    'rbsnb', 'minor',
    'blocked',
    'RBS-New Brunswick students may declare minors only in non-RBS subject areas; RBS Business Administration and Entrepreneurship minors are not permitted.',
    'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/policies-procedures',
    strftime('%s','now') * 1000
  ),
  (
    'rbsnb-no-soe-second-major', 'rbsnb',
    'rbsnb', 'major',
    'soe', 'major',
    'blocked',
    'RBS-New Brunswick students may not double-major with a School of Engineering program because professional-school students must be enrolled in that school to select its major.',
    'https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/policies-procedures',
    strftime('%s','now') * 1000
  )
ON CONFLICT(policy_key) DO UPDATE SET
  home_school_slug = excluded.home_school_slug,
  program_a_school_slug = excluded.program_a_school_slug,
  program_a_type = excluded.program_a_type,
  program_b_school_slug = excluded.program_b_school_slug,
  program_b_type = excluded.program_b_type,
  decision = excluded.decision,
  note = excluded.note,
  source_url = excluded.source_url,
  verified_at = excluded.verified_at;
