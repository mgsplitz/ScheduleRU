# Refactor Foundation

## Status

Approved on 2026-07-31 and updated on 2026-08-01. The data-boundary milestone
is complete: reviewed programs, shared reference data, non-public drafts, and
review workflow notes are portable contracts with exact development parity.
The application migration remains incremental so production behavior stays
available while compatibility modules are replaced.

## Goals

- Make frontend, API, planning, requirements, scheduling, and catalog work
  independently editable.
- Replace program-specific SQL content scripts with a generic, versioned
  catalog definition and publication boundary.
- Keep structural database migrations separate from catalog content.
- Preserve all current user-facing behavior while modules move.
- Give future catalog-only work a narrow interface that cannot require planner
  or UI changes.

## Target repository

```text
apps/
  web/                     React/Vite frontend
  api/                     Cloudflare Worker
packages/
  academic-model/          Shared academic identifiers and types
  catalog/                 Catalog definition contract and validation
  planner/                 Deterministic four-year planning
  requirements/            Requirement allocation and progress
  scheduling/              Semester schedule generation and preferences
  api-contracts/           Typed HTTP contracts
  test-fixtures/           Shared deterministic fixtures
tools/
  catalog/                 Catalog validation and publication CLI
  database/                Ordered structural migration tooling
docs/
  architecture/            Current architecture and decisions
  operations/              Deployment and database runbooks
  catalog-contributor/     Narrow instructions for catalog-data work
```

The current root frontend and `worker/` remain compatibility surfaces until
their replacements have passed parity checks. New domain behavior must be
implemented behind the target package boundaries.

## Dependency rules

- `apps/web` may depend on domain packages and `api-contracts`; it may not
  depend on database or Worker implementation details.
- `apps/api` may depend on domain packages and storage adapters; it may not
  contain program-specific academic rules.
- `packages/catalog` owns the versioned program-definition contract.
- `packages/planner` and `packages/requirements` consume normalized catalog
  contracts and do not query D1 directly.
- Structural migrations contain no Rutgers program content.
- Catalog publication is transactional, idempotent, and restricted to the
  development environment unless production is explicitly approved.

## Catalog definition

A program definition is a versioned data object containing:

- stable program identity, school, type, degree, family, and catalog version;
- official source records and review metadata;
- a tree of generic requirement groups;
- fixed courses and bounded course selectors;
- program eligibility rules and group allocation conditions;
- evidence attached to reviewed requirement entities.

Nested academic logic is expressed through generic rule kinds (`all`,
`one_of`, `min_courses`, `max_courses`, and `min_credits`) rather than custom
columns or program-specific code.

The publication boundary validates a complete definition before opening a
transaction. It replaces one program version atomically, leaving unrelated
programs untouched. Replaying an identical definition produces the same
database state.

## Completed data foundation

The first milestone creates:

1. npm workspaces and shared TypeScript configuration;
2. the typed catalog definition and runtime validator;
3. a D1 publication service using generic statements;
4. an authenticated development admin route for validation/publication;
5. a catalog CLI for local validation and controlled API publication;
6. ownership and contributor documentation;
7. compatibility tests proving the existing 333-test baseline remains green.

The reviewed catalog now contains 49 validated definitions. Shared school and
cross-program data is owned by `packages/reference-data`; mutable review notes
are owned by `packages/catalog-ingestion`; incomplete definitions are validated
under `catalog/drafts`. Content-bearing reviewed and draft program SQL has been
removed after development publication and parity checks. Production data was
not changed.

## Next application milestones

1. Move the 4,067-line root frontend into `apps/web` behind browser-state and
   HTTP adapters.
2. Split the 2,375-line compatibility program router into `apps/api` route and
   Cloudflare-storage modules.
3. Move root deterministic planner, requirements, and scheduling modules into
   their named packages while retaining compatibility exports.
4. Convert the remaining reviewed course-eligibility content into a portable
   contract, leaving `worker/schema` structural-only.
5. Add an ordered structural migration runner, then retire compatibility files
   only after contract and public-behavior parity.

## Verification gates

- Existing test suite remains green.
- New catalog contract tests fail closed on malformed or incomplete reviewed
  definitions.
- Publisher tests use a D1-compatible fake and verify ordered, transactional,
  program-scoped replacement.
- The Worker route rejects unauthorized and production publication attempts.
- Repository formatting and type-checking pass.
- No secret value or program-specific rule is added to application code.
