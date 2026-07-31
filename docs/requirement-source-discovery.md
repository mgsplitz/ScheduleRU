# Source-first requirement discovery

## Purpose

Program-profile pages control the menu but are not assumed to contain degree
requirements. The importer must discover and snapshot the official
major-specific department page before attempting to create schedule rules.

The first delivery is limited to SAS majors. Existing reviewed minor data stays
in place, but no new minor discovery, parsing, or publication runs in this
phase.

## Flow

1. Select SAS catalog paths whose type is `major`; retain the official SAS
   directory and profile page as program identity.
2. Extract a profile link labelled for the major, rejecting unrelated advising
   and career links.
3. Store the discovered official HTTPS page as a requirement source and keep
   versioned source snapshots in D1.
4. Convert only unambiguous, source-proven fixed courses or bounded selectors
   into draft requirement candidates. Keep ambiguous prose as source-backed
   advising text instead of guessing an audit rule.
5. A reviewed-evidence gate remains the only path to a public automatic degree
   audit. The selector hides catalog-only and raw-source-only records; they are
   published only after their structured requirement data is ready.

## Guardrails

- No per-program course lists or requirements are added to frontend code or
  seed SQL.
- No profile recommendation is treated as a degree requirement.
- Every generated candidate carries its source URL and content hash.
- Failed, missing, or ambiguous sources remain stored for future work but are
  hidden from the public selector.
- Existing minor records and their reviewed audits are not modified.
