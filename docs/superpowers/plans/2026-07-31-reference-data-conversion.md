# Reference-data conversion implementation plan

**Goal:** Move reviewed cross-program configuration out of legacy SQL into a
validated, reproducible snapshot/restore workflow without changing public
behavior.

## Tasks

1. Add `@scheduleru/reference-data` types and fail-closed validation.
2. Add deterministic serialization and digest-checked parsing.
3. Add a generic D1 exporter and transactional whole-bundle publisher.
4. Add package tests covering invalid input, JSON decoding, stable ordering,
   idempotent writes, and failed batches.
5. Add development-only authenticated Worker routes.
6. Add contributor CLI commands for validate, snapshot, restore, and
   round-trip parity.
7. Export the live development bundle, restore it, and compare all affected
   public API responses.
8. Remove reference-data content from structural SQL only after parity passes.
9. Document the remaining ingestion-backlog boundary.

