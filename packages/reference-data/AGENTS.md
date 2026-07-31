# Reference-data package

This package owns reviewed cross-program policy and school configuration.

- Keep the contract program-neutral and versioned.
- Do not include transient scrape/import backlog.
- Parse stored JSON into contract values; never expose encoded JSON strings.
- Validate the entire bundle before preparing writes.
- Publication must be deterministic, transactional, and idempotent.
- Every behavior change starts with a failing package test.
