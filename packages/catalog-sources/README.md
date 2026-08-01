# Catalog sources

This package owns validated configuration for external program-directory
imports. It keeps source URLs, parser adapters, owner labels, and stable program
identity overrides outside application code and database migrations.

It deliberately does not own imported program content, requirement data,
review queues, or import-run state. Publishing a bundle updates configuration
without clearing timestamps, hashes, errors, or active import leases.
