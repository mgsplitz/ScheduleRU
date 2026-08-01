# Reference-data boundary

## Decision

Cross-program policy and school configuration belong to a versioned,
program-neutral reference-data bundle. They do not belong in individual
program definitions, application code, or structural migrations.

The bundle owns:

- school profiles and their reviewed UI configuration;
- school-to-curriculum-module links;
- per-school program-selection limits;
- pairwise program-combination policies;
- program overlap rules and reviewed exceptions; and
- reviewed requirement-course equivalencies;
- reviewed AP score bands and course/requirement equivalencies;
- reviewed course-eligibility decisions; and
- source-backed prerequisite and corequisite conditions.

`requirement_raw_notes` is deliberately excluded. Those rows are mutable
ingestion backlog owned by `packages/catalog-ingestion`, not reviewed runtime
reference data.

## Contract properties

- one complete bundle is validated before any write is prepared;
- identifiers and course codes use the same canonical forms as catalog data;
- stored JSON is represented as typed JSON, never double-encoded strings;
- official policy claims retain Rutgers source URLs and review timestamps;
- arrays are canonicalized by stable natural keys for reproducible snapshots;
- restore replaces the managed datasets transactionally and idempotently; and
- development HTTP and CLI operations remain unavailable in production.

## Migration sequence

1. Introduce the package contract, validator, canonical snapshot, D1 exporter,
   and transactional publisher.
2. Add authenticated development-only export and restore endpoints.
3. Snapshot the current development dataset and prove API parity across a
   destructive development round trip.
4. Remove content inserts from structural schema files.
5. Extract the separate ingestion backlog and remove its seed SQL.
6. Move reviewed course-eligibility and AP-equivalency facts into the same
   portable boundary and remove their content SQL.

## Completed checkpoint

The original seven-dataset development bundle was exported, digest-verified,
restored, and compared across the affected public APIs. The portable snapshot
now covers ten reference datasets and 64 rows, including reviewed course
eligibility and 37 reviewed AP score bands. Its local digest and contract are
verified. AP output is included in parity capture. A fresh development round
trip must be recorded after deploying the expanded development-only admin
endpoint; until then no parity report is kept beside the newer snapshot.
