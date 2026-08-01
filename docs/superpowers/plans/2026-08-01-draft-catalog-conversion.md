# Draft Catalog Conversion Plan

## Goal

Remove the final content-bearing SQL seeds without publishing incomplete academic
rules. Store each genuine draft as a portable, validated catalog definition and
keep review workflow notes in the catalog-ingestion contract.

## Boundaries

- `packages/catalog` continues to own the program-definition schema.
- `catalog/drafts` stores source-backed definitions whose status is
  `unreviewed` or `needs_fix`.
- `catalog/ingestion` stores mutable review notes, not duplicate course trees.
- `worker/schema` keeps structural database changes only.
- Publishing remains development-only through `tools/catalog`.

## Conversion

1. Add contract tests that enumerate every draft file, validate it with the
   generic catalog validator, and reject reviewed or catalog-listed content.
2. Convert the Fixed Income and Credit Analysis concentration only; the other
   ten RBS programs in the legacy seed already exist in the reviewed snapshot.
3. Convert the 63 finite PPE course candidates with unreviewed evidence and
   preserve the unresolved source limitations in the review backlog.
4. Delete both legacy draft SQL files and migrate their SQL-parsing tests to the
   draft contract.
5. Run the complete test suite, type checking, and whitespace validation.
6. Merge the verified checkpoint into `dev`; do not deploy production or change
   production D1.

## Acceptance Criteria

- Exactly two portable draft definitions exist.
- Neither draft is publicly reviewed.
- Every requirement group and finite course has source-linked unreviewed
  evidence.
- Fixed Income preserves six required courses, one unresolved elective slot,
  and its three declaration rules.
- PPE preserves five groups and exactly 63 finite course candidates without
  inventing `01:730:105` or `01:730:106`.
- No content-bearing draft or reviewed SQL remains under `worker/schema`.
