# Catalog package

This package owns the versioned, program-neutral catalog contract.

- Accept unknown input only through the runtime validator.
- Fail closed; do not silently repair academic data.
- Keep identifiers stable and errors path-addressable.
- Do not add logic for a named Rutgers program.
- Publication must be deterministic, idempotent, and program-scoped.
- Every behavior change starts with a failing package test.
