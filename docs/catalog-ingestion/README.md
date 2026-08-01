# Catalog-ingestion workflow

This boundary owns mutable discovery and human-review state. It is separate
from reviewed program definitions (`packages/catalog`) and shared policy data
(`packages/reference-data`).

## Current scope

- Review-note contract and validation: `packages/catalog-ingestion`
- Contributor commands: `tools/catalog-ingestion`
- Development endpoint:
  `GET|PUT /api/admin/catalog-ingestion/review-backlog`
- Signed snapshot: `catalog/ingestion/review-backlog.v1.json`
- Production export/publication: intentionally unavailable

D1 note IDs are operational and are not portable. Notes are keyed by program,
section, and source text. Both resolved and unresolved notes are preserved.

## Commands

```bash
npm run catalog-ingestion -- validate /absolute/path/to/backlog.json
```

```bash
SCHEDULERU_ADMIN_SECRET="<development secret>" \
  npm run catalog-ingestion -- snapshot \
  --api https://<development-worker-host> \
  --output catalog/ingestion/review-backlog.v1.json
```

```bash
SCHEDULERU_ADMIN_SECRET="<development secret>" \
  npm run catalog-ingestion -- round-trip \
  --api https://<development-worker-host> \
  --snapshot catalog/ingestion/review-backlog.v1.json \
  --manifest catalog/ingestion/review-backlog.v1.manifest.json \
  --report catalog/ingestion/review-backlog.v1.parity.json
```

All remote commands reject production targets and read the secret only from
the environment.
