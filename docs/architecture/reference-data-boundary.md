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
- reviewed requirement-course equivalencies.

`requirement_raw_notes` is deliberately excluded. Those rows are mutable
ingestion backlog, not reviewed runtime reference data. They need a separate
export/restore boundary before their remaining seed SQL can be removed.

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
5. Extract the separate ingestion backlog, then remove the remaining mixed
   review/seed SQL files once all owned datasets have recovery coverage.

## Completed checkpoint

The reviewed development bundle has been exported, digest-verified, restored,
and compared across the affected public APIs. Content inserts were removed
from the school-profile, curriculum-module, and program-selection structural
schema files. Mixed review SQL remains until the ingestion-backlog boundary is
implemented.
