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

Legacy program-specific SQL remains temporarily while existing data is
converted and compared. Do not add another program-specific SQL file.

## Allowed work

A catalog-only task may:

- research an official Rutgers program;
- prepare a contract-version-1 JSON definition;
- validate the definition locally;
- publish the definition to the development Worker;
- verify the resulting public program and requirement API responses;
- report ambiguous or unsupported requirements.

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
- `min_courses`, `max_courses`, and `min_credits`, with a positive integer
  `count`.

Course selectors are generic finite course-code lists or bounded
school/subject/level ranges. If an official rule cannot be represented without
guessing, stop and record the exact source language as a blocker.

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
