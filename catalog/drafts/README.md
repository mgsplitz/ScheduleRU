# Catalog drafts

This directory contains source-backed program definitions that are not approved
for public degree planning.

- Every JSON file must pass the generic `packages/catalog` validator.
- `program.review_status` must remain `unreviewed` or `needs_fix`.
- Requirement evidence must link to an official Rutgers source and must not be
  marked reviewed.
- Unresolved prose belongs in `catalog/ingestion/review-backlog.v1.json`, not in
  duplicate SQL or application code.
- Validate with `npm run catalog -- validate catalog/drafts/<file>.json`.
- Publish only to the development Worker with the catalog tool after setting
  `SCHEDULERU_ADMIN_SECRET` in the environment.

Moving a draft to the reviewed snapshot requires an independent academic review,
complete reviewed evidence, development D1 publication, and exact round-trip
parity.
