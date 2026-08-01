# Reference-data contributor workflow

This boundary owns reviewed school configuration and policies shared across
programs. A reference-data task must not edit the frontend, planner,
requirement engine, program catalog definitions, or structural migrations.

## Ownership

- Contract, validation, export, and publication: `packages/reference-data`
- Development contributor commands: `tools/reference-data`
- Signed recovery snapshot:
  `reference-data/snapshots/reviewed-reference-data.v1.json`
- Development endpoint: `GET|PUT /api/admin/reference-data`
- Production export/publication: intentionally unavailable

The bundle contains school profiles, curriculum-module attachments, selection
limits, combination policies, overlap rules/exceptions, reviewed
requirement-course equivalencies, and reviewed course-eligibility conditions.
Transient `requirement_raw_notes` are owned by the catalog-ingestion boundary.

## Commands

Validate a bundle:

```bash
npm run reference-data -- validate /absolute/path/to/reference-data.json
```

Export development:

```bash
SCHEDULERU_ADMIN_SECRET="<development secret>" \
  npm run reference-data -- snapshot \
  --api https://<development-worker-host> \
  --output reference-data/snapshots/reviewed-reference-data.v1.json
```

Restore development:

```bash
SCHEDULERU_ADMIN_SECRET="<development secret>" \
  npm run reference-data -- restore \
  --api https://<development-worker-host> \
  --snapshot reference-data/snapshots/reviewed-reference-data.v1.json \
  --manifest reference-data/snapshots/reviewed-reference-data.v1.manifest.json
```

Run a restore while comparing all affected public APIs:

```bash
SCHEDULERU_ADMIN_SECRET="<development secret>" \
  npm run reference-data -- round-trip \
  --api https://<development-worker-host> \
  --snapshot reference-data/snapshots/reviewed-reference-data.v1.json \
  --manifest reference-data/snapshots/reviewed-reference-data.v1.manifest.json \
  --report reference-data/snapshots/reviewed-reference-data.v1.parity.json
```

All remote commands reject production targets and read the secret only from
the environment.

## Current recovery proof

The version-1 snapshot contains 66 rows across eleven datasets, including the
reviewed AP equivalency catalog and school-wide double-count policies. The snapshot is
contract-validated and digest-protected. The earlier seven-dataset parity
report was removed when eligibility data entered the contract so it cannot be
mistaken for proof of the expanded snapshot. After the development Worker is
deployed, run the round-trip command above and commit the newly generated
report. The comparison ignores only existing operational timestamps/flags and
the internal autoincrement ID on overlap exceptions.
