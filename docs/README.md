# ScheduleRU documentation

This directory contains maintained technical and contributor documentation.
Short-lived implementation plans, model review artifacts, and completed task
specifications belong in issues or pull requests rather than the repository.
Their previous repository versions remain available in Git history.

## Architecture

- [`architecture/refactor-foundation.md`](architecture/refactor-foundation.md)
  defines package ownership, compatibility boundaries, and migration order.
- [`architecture/refactor-foundation-verification.md`](architecture/refactor-foundation-verification.md)
  records the foundation verification baseline.
- [`architecture/catalog-data-conversion.md`](architecture/catalog-data-conversion.md)
  explains how reviewed program data moved out of SQL.
- [`architecture/catalog-data-parity.md`](architecture/catalog-data-parity.md)
  defines catalog round-trip and parity expectations.
- [`architecture/reference-data-boundary.md`](architecture/reference-data-boundary.md)
  defines portable cross-program and school-level data.
- [`architecture/guided-smart-planning.md`](architecture/guided-smart-planning.md)
  defines the approved requirement-choice, optimization, and student-language design.
- [`architecture/guided-smart-planning-delivery.md`](architecture/guided-smart-planning-delivery.md)
  divides that design into independently testable releases and acceptance gates.
- [`architecture/complete-planning-experience.md`](architecture/complete-planning-experience.md)
  defines the canonical academic-rule and end-to-end student journey contract.

## Contributor workflows

- [`catalog-contributor/README.md`](catalog-contributor/README.md) — add or
  update a reviewed program definition.
- [`reference-data-contributor/README.md`](reference-data-contributor/README.md)
  — maintain shared policy and configuration records.
- [`catalog-sources/README.md`](catalog-sources/README.md) — maintain official
  directory endpoints, adapters, owner labels, and stable identity overrides.
- [`catalog-ingestion/README.md`](catalog-ingestion/README.md) — work with the
  non-public review backlog.
- [`requirement-source-discovery.md`](requirement-source-discovery.md) — find
  official requirement sources without publishing unreviewed rules.

Operational setup, local development, verification, and deployment commands
remain in the repository [`README.md`](../README.md).
