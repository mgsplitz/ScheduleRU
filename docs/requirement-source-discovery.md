# Source-first requirement discovery

## Purpose

Program-profile pages control the menu but are not assumed to contain degree
requirements. The importer must discover and snapshot the official
major-specific or minor-specific department page before attempting to create
schedule rules.

## Flow

1. Import the official SAS directory and profile page as program identity.
2. Extract profile links labelled for the selected program type (Major or
   Minor), rejecting unrelated advising and career links.
3. Store the discovered official HTTPS page as a requirement source and keep
   versioned source snapshots in D1.
4. Convert only unambiguous, source-proven fixed courses or bounded selectors
   into draft requirement candidates. Keep ambiguous prose as source-backed
   advising text instead of guessing an audit rule.
5. A reviewed-evidence gate remains the only path to a public automatic degree
   audit. The UI can always link to the actual official source.

## Guardrails

- No per-program course lists or requirements are added to frontend code or
  seed SQL.
- No profile recommendation is treated as a degree requirement.
- Every generated candidate carries its source URL and content hash.
- Failed, missing, or ambiguous sources remain selectable but are never shown
  as completed requirements.
