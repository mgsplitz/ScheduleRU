# Catalog data conversion

## Purpose

Convert every reviewed program from hand-maintained SQL content scripts into
the generic catalog contract while preserving public API behavior.

The development database measured on 2026-07-31 contains:

- 49 reviewed programs;
- 265 reviewed requirement groups;
- 4,814 reviewed fixed-course rows;
- 46 reviewed selectors;
- 4 reviewed group conditions;
- 74 reviewed source records;
- 840 reviewed evidence rows;
- 61 reviewed eligibility rules.

The conversion must operate on those records generically. Program names and
course lists may appear in exported data, never in conversion code.

## Source of truth

D1 remains the operational source of truth. A generated, versioned JSON Lines
snapshot provides reproducible development/test restoration after legacy SQL
content scripts are removed. The snapshot is produced by tooling and is never
edited manually.

Structural migrations remain SQL. Catalog content does not.

## Conversion flow

1. Export every reviewed program through a D1 repository adapter.
2. Convert rows to contract-version-1 definitions.
3. Validate every definition with the shared catalog validator.
4. Capture normalized public program and requirement responses.
5. Republish definitions to development through the generic publisher.
6. Capture responses again and require exact normalized parity.
7. Generate the reviewed JSON Lines snapshot and manifest.
8. Update data tests to read definitions instead of SQL source text.
9. Remove program-specific reviewed and seed SQL only after parity.

## Generic compatibility

The contract must represent every rule already consumed by the application:

- `all`
- `one_of`
- `min_courses`
- `max_courses`
- `min_credits`
- `max_credits`
- `min_distinct_children`

Legacy `max` is normalized to `max_courses` at export. No named program
translation is permitted.

Shared curricula with large fixed-course sets use the same definition shape.
Statement generation chunks rows by D1's bound-parameter limit and keeps each
program replacement transactional.

## Snapshot

The generated snapshot contains:

- a format version and generation metadata;
- one canonical JSON object per line, ordered by program ID;
- a SHA-256 digest in a small manifest;
- only reviewed catalog definitions;
- no credentials, student data, course sections, or assistant conversations.

Import validates the entire snapshot before preparing any database write.

## Parity

Parity ignores only operational timestamps that are not part of academic
behavior. It compares:

- program identity and selection metadata;
- requirement group hierarchy, rules, counts, and display families;
- fixed courses and durable course metadata;
- selectors and allocation conditions;
- evidence and source-backed eligibility rules;
- public multi-program requirement responses.

Any mismatch blocks SQL removal.

