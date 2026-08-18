# Progressive Guided Planning Design

## Goal

Make four-year-plan guidance complete, non-repetitive, and manageable for large
elective pools while preserving reviewed prerequisites and double-count rules.

## Confirmed failures

1. A requirement containing explicit courses and a reviewed selector is treated
   as already hydrated. The Mathematics minor therefore exposes only 244 and
   252 and drops the 28 current 300–499 Mathematics candidates returned by its
   selector. Four required slots cannot be filled from two candidates.
2. Preferences are stored per decision. The same course appearing in a narrow
   subgroup and a broad total must be rated again.
3. Prerequisite-only optimizer results can contain only a course code. If the
   course is absent from the active-term catalog, recommendation cards repeat
   the code as the title.
4. Recommendation approval routes through a second general confirmation rather
   than starting generation. This makes “Use these courses” appear ineffective.
5. Large finite pools render every course at once and require excessive review.

## Architecture

### Candidate hydration

`planning-decision-loader.js` always evaluates reviewed selectors. It merges
selector results with explicit requirement courses by canonical course code;
explicit records retain requirement evidence while richer catalog fields fill
missing titles, credits, attributes, and prerequisites. Selector failure remains
fail-closed and never discards explicit choices.

After initial candidates are normalized, the loader collects every prerequisite
closure code and requests canonical metadata in one batch. A stable
`course_reference` table stores one reviewed title and credit record per course
code independently of semester offerings. Normal course sync and reviewed
catalog publication update that table generically. The API resolves from this
canonical table rather than from program-specific branches. Catalog content is
published as data, not embedded in application code or migrations.

### Progressive decision model

The decision controller owns a global course-preference ledger keyed by
canonical course code. A rating made in one decision applies everywhere.
Subsequent decisions exclude rated courses from their cards and report how many
already-considered courses also cover the current requirement.

Decisions are ordered by containment and constraint: sequence-critical and
narrow/subset pools precede broad totals; RBS requirements still precede other
programs, and Core remains last. This lets upper-level courses contribute to a
program total without asking twice.

### Large-pool presentation

Every decision calculates a deterministic shortlist of at most eight unrated
candidates. Ranking favors multi-requirement coverage, prerequisite unlockers,
lower prerequisite burden, offering evidence, and stable course-code order.
The user can expand “Show all N options” and search the full pool. Unmarked
courses remain neutral and available to the optimizer; users never need to rate
the entire pool. “Choose for me” remains available.

### Optimization and approval

The coverage graph consumes the global ledger. Its lexicographic priorities are:

1. satisfy all mandatory requirements;
2. obey prerequisite and double-count constraints;
3. maximize legal cross-requirement coverage;
4. prefer Interested, then Maybe, neutral, and Avoid;
5. minimize extra courses and prerequisite overhead.

Recommendation cards show friendly titles for selected and prerequisite-only
courses. Clicking “Use these courses” generates the four-year preview
immediately when Core is complete. If Core is incomplete, it shows only the
existing accuracy warning and generates after “I understand.”

## Error handling

- If a selector request fails, retain explicit candidates and explain that the
  complete reviewed pool could not be loaded.
- If candidate capacity is genuinely insufficient, preserve the current
  student-friendly recommendation message.
- If prerequisite metadata has no title after canonical lookup, show
  “Course title unavailable” with the code rather than duplicating the code.
- Never silently ignore a reviewed selector or double-count conflict.

## Verification

- Contract test: explicit Mathematics courses merge with all selector matches.
- Controller tests: global ratings disappear from later cards and restrictive
  decisions precede broad totals.
- View tests: eight-card shortlist, expansion, and neutral unmarked behavior.
- Metadata tests: prerequisite-only cards receive canonical titles regardless
  of selected program or active-term offering.
- Integration test: “Use these courses” calls plan generation directly, except
  for the incomplete-Core warning.
- Browser test: Finance plus CS, Mathematics, and Philosophy minors reaches an
  eight-semester preview without duplicate rating or unresolved Math capacity.
