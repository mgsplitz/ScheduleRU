# Refactor Foundation

## Status

Approved on 2026-07-31 and updated on 2026-08-01. The data-boundary milestone
is complete: reviewed programs, shared reference data, program-directory source
configuration, non-public drafts, and review workflow notes are portable
contracts with exact development parity.
The application migration remains incremental so production behavior stays
available while compatibility modules are replaced.

The first application boundary is now concrete: Wrangler targets
`apps/api/src/worker.js`; the program API and catalog contributor controllers
live beside that entrypoint. Legacy `worker/src` entrypoint and program paths
are thin compatibility exports. Program policy, evidence, presentation, and
source-import helpers now live under `apps/api/src/programs`, so the canonical
API app no longer imports backward from `worker/src`. The bounded OpenAI
schedule-preference adapter also lives in `apps/api`, while deterministic
preference normalization and ranking remain in `packages/scheduling`.
Anonymous program and requirement endpoints are separated from contributor
mutations in `apps/api/src/programs/public-routes.js` and receive their
services explicitly from the compatibility controller. Their D1 reads now
live behind `apps/api/src/programs/storage/public-program-repository.js`, so
the public HTTP controller depends on a repository contract instead of the
Cloudflare database binding.
Authenticated program import, review, scraping, and requirement-contributor
endpoints are likewise isolated in `apps/api/src/programs/admin-routes.js`.
Their direct persistence operations live behind
`apps/api/src/programs/storage/admin-program-repository.js`; longer-running
import and scraping services retain their own storage temporarily.
The RBS source parser is independently testable under
`apps/api/src/programs/scrapers/business-school-parser.js`, with shared HTML
normalization in the adjacent `html.js` module.
The generic Coursedog text parser is independently testable beside it and
keeps prerequisite codes out of emitted requirement-course rows.

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
  web/                     Browser presentation and integration
  api/                     Cloudflare Worker
packages/
  academic-model/          Shared academic identifiers and types
  catalog/                 Catalog definition contract and validation
  catalog-sources/         Program-directory source configuration
  planner/                 Deterministic four-year planning
  requirements/            Requirement allocation and progress
  scheduling/              Semester schedule generation and preferences
  api-contracts/           Typed HTTP contracts
  test-fixtures/           Shared deterministic fixtures
tools/
  catalog/                 Catalog validation and publication CLI
  catalog-sources/         Source-configuration validation and development restore
  database/                Ordered structural migration tooling
docs/
  architecture/            Current architecture and decisions
  operations/              Deployment and database runbooks
  catalog-contributor/     Narrow instructions for catalog-data work
```

The current root frontend and `worker/` remain compatibility surfaces until
their replacements have passed parity checks. New domain behavior must be
implemented behind the target package boundaries.

The root HTML shell now contains semantic markup and ordered asset references;
its stylesheet and application controllers live under `apps/web`. The
deterministic browser modules live under `packages/planner`,
`packages/requirements`, and `packages/scheduling`. Presentation-only
decisions live under `apps/web`. The root `*-logic.js` files contain imports
only, while the production HTML shell loads the canonical paths directly.

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
cross-program data is owned by `packages/reference-data`; external directory
configuration is owned by `packages/catalog-sources`; mutable review notes are
owned by `packages/catalog-ingestion`; incomplete definitions are validated
under `catalog/drafts`. Content-bearing reviewed and draft program SQL has been
removed after development publication and parity checks. Production data was
not changed.

## Next application milestones

1. Split the extracted planner and guided-setup controllers into smaller
   state, API, rendering, and feature controllers behind contract tests.
2. Extract the longer-running program import and scraping workflows from the
   compatibility controller and give each workflow a focused persistence
   adapter. Public and authenticated route-level D1 operations already live
   behind their respective repositories. Retain the `worker/src`
   compatibility exports until callers have migrated.
3. Add explicit module APIs to the newly relocated planner, requirements, and
   scheduling packages, then retire their root compatibility imports.
4. Add an ordered structural migration runner, then retire compatibility files
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
