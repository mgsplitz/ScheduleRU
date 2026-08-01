# Catalog-source configuration

Program-directory source configuration is portable reviewed data. It is
validated by `packages/catalog-sources`, edited in
`catalog-sources/snapshots`, and published through the authenticated
development-only admin route.

The contract includes:

- the official Rutgers directory URL and program-profile path;
- the allowlisted importer adapter;
- source ownership labels;
- explicit enabled state;
- stable identity overrides for program IDs referenced elsewhere.

It excludes imported programs, requirements, review queues, import timestamps,
hashes, errors, and source leases.

## Contributor workflow

Validate the checked-in bundle:

```sh
npm run catalog-sources -- validate \
  catalog-sources/snapshots/reviewed-catalog-sources.v1.json
```

Snapshot or restore development configuration with
`SCHEDULERU_ADMIN_SECRET` set in the local environment:

```sh
npm run catalog-sources -- snapshot \
  --api https://<development-api> \
  --output catalog-sources/snapshots/reviewed-catalog-sources.v1.json

npm run catalog-sources -- restore \
  --api https://<development-api> \
  --snapshot catalog-sources/snapshots/reviewed-catalog-sources.v1.json \
  --manifest catalog-sources/snapshots/reviewed-catalog-sources.v1.manifest.json
```

The command rejects production-looking targets. Production publication remains
a separately approved operational action.
