# Catalog-source contributor boundaries

- Treat the snapshot as reviewed configuration, not scraped catalog content.
- Keep import runtime state out of the contract.
- Add adapters to the explicit allowlist before using them in source data.
- Validate the full bundle before preparing any database writes.
- Never publish this package directly to production.
