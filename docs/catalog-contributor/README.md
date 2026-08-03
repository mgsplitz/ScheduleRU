# Catalog contributor workflow

This is the narrow interface for a work window that adds or updates program
data. Catalog work must not require edits to the web app, planner, requirement
engine, Worker routes, or structural migrations.

## Current boundary

- Contract and validation: `packages/catalog`
- Contributor command: `tools/catalog`
- Development publication endpoint:
  `PUT /api/admin/catalog/program-definitions/:programId`
- Production publication: intentionally unavailable through this endpoint

Reviewed and draft program content is fully outside structural SQL. Reviewed
definitions are recoverable from `catalog/snapshots`; incomplete definitions
live in `catalog/drafts`; unresolved review prose lives in
`catalog/ingestion/review-backlog.v1.json`.

## Allowed work

A catalog-only task may:

- research an official Rutgers program;
- prepare a contract-version-1 JSON definition;
- validate the definition locally;
- publish the definition to the development Worker;
- verify the resulting public program and requirement API responses;
- report ambiguous or unsupported requirements.

An incomplete definition must remain `unreviewed` or `needs_fix` under
`catalog/drafts`. Publishing that file to development does not make it public;
public routes continue to require reviewed evidence.

It may not:

- edit planner, frontend, scheduling, or requirement-allocation code;
- create program-specific SQL migrations;
- alter the generic contract to accommodate one named program;
- publish to production;
- guess unsupported academic rules or omit provenance.

## Commands

Install the locked workspace dependencies once:

```bash
npm install
```

Validate a definition:

```bash
npm run catalog -- validate /absolute/path/to/program.json
```

Publish to a local development Worker:

```bash
SCHEDULERU_ADMIN_SECRET="<development secret>" \
  npm run catalog -- publish /absolute/path/to/program.json \
  --api http://127.0.0.1:8787
```

Publish to the deployed development Worker by supplying its HTTPS `-dev`
hostname. The secret is read only from `SCHEDULERU_ADMIN_SECRET`; never put it
in a command argument, definition, document, commit, or chat handoff.

## Definition requirements

Every definition contains:

- `contract_version: 1`;
- one stable `program` identity;
- one or more official Rutgers HTTPS `sources`;
- a generic `requirement_groups` tree;
- fixed courses, selectors, conditions, and reviewed evidence where relevant;
- source-backed `eligibility_rules`.

Validation fails closed. It rejects unsafe IDs, unofficial sources, malformed
course codes and selectors, duplicate or cyclic groups, invalid rule/count
combinations, and missing reviewed evidence. Do not work around validation by
weakening the contract for one program.

The supported requirement rules are:

- `all` and `one_of`, with `count: null`;
- `min_courses`, `max_courses`, `min_credits`, `max_credits`, and
  `min_distinct_children`, with a positive integer `count`.

Course selectors are generic finite course-code lists or bounded
school/subject/level ranges. If an official rule cannot be represented without
guessing, stop and record the exact source language as a blocker.

## Draft and review-backlog workflow

Validate a draft with the same program-neutral command:

```bash
npm run catalog -- validate catalog/drafts/<program>.v1.json
```

Draft files must not duplicate a program already present in the reviewed
snapshot. Put unresolved source wording in the review-backlog contract and
validate or restore it through `npm run catalog-ingestion`. The backlog is
portable workflow state; it must not contain duplicate course trees or
program-specific executable logic.

## Refresh a tagged curriculum into a draft

Tagged curriculum pages such as the Rutgers–New Brunswick Core are refreshed
locally from their reviewed definition. The command reads the official source
URL from reviewed catalog data; application code contains no curriculum URL,
program ID, group tree, or course list.

```bash
npm run catalog -- refresh-tagged-curriculum \
  --snapshot catalog/snapshots/reviewed-programs.v1.jsonl \
  --manifest catalog/snapshots/reviewed-programs.v1.manifest.json \
  --program <core-curriculum-program-id> \
  --output catalog/drafts/<core-curriculum-program-id>.v1.json \
  --report tmp/<core-curriculum-program-id>-refresh-report.json
```

The command:

- verifies the snapshot manifest and digest before fetching;
- fetches only the official Rutgers HTTPS source declared by the definition;
- maps source tags onto the existing generic requirement-group structure;
- preserves group IDs, hierarchy, rules, counts, selectors, and conditions;
- validates the complete generated definition;
- always marks the result `unreviewed`;
- writes no D1 data and has no publication option;
- reports deterministic added and removed group/course assignments.

Review both artifacts. Resolve unexplained additions, removals, empty tags, or
source ambiguity before using the existing development-only publication
command. A refresh never changes the reviewed snapshot or public application
by itself.

## Reviewed snapshot and recovery

Export every reviewed definition from development:

```bash
SCHEDULERU_ADMIN_SECRET="<development secret>" \
  npm run catalog -- snapshot \
  --api https://<development-worker-host> \
  --output catalog/snapshots/reviewed-programs.v1.jsonl
```

The command writes a matching `.manifest.json` with the program inventory and
SHA-256 digest. Restore validates the entire snapshot and digest before the
first publication:

```bash
SCHEDULERU_ADMIN_SECRET="<development secret>" \
  npm run catalog -- restore \
  --api https://<development-worker-host> \
  --snapshot catalog/snapshots/reviewed-programs.v1.jsonl \
  --manifest catalog/snapshots/reviewed-programs.v1.manifest.json
```

Both commands reject production API targets.

## Review handoff

Return:

1. program ID, name, type, school, and catalog year;
2. every official source URL and access date;
3. validation command and result;
4. development publication result;
5. public API comparison result;
6. unresolved wording or advising-only rules;
7. the branch and commit containing any reviewed definition artifact.

## Reusable task brief

> Work only within ScheduleRU's catalog contributor boundary. Research the
> assigned Rutgers programs from official Rutgers sources, express each as a
> contract-version-1 generic program definition, run the catalog validator,
> and publish only to the development API. Do not edit application packages,
> planner logic, frontend code, Worker routing, structural migrations, or
> production data. Do not create program-specific SQL. Preserve source
> provenance, fail closed on ambiguity, and return the review handoff described
> in `docs/catalog-contributor/README.md`.
