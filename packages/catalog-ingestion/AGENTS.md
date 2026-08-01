# Catalog-ingestion package

This package owns mutable catalog discovery and human-review workflow state.

- Do not duplicate reviewed program definitions or reference-data policies.
- Exclude operational D1 row IDs from portable contracts.
- Validate the complete backlog before preparing writes.
- Publication must be deterministic, transactional, and development-only.
- Every behavior change starts with a failing package test.
