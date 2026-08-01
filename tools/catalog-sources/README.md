# Catalog-source contributor commands

Use the root `npm run catalog-sources -- ...` command to validate a local
bundle, snapshot development configuration, or restore a reviewed snapshot to
development. The command rejects production-looking API targets.

Set `SCHEDULERU_ADMIN_SECRET` in the environment for API operations. Never add
the secret to a repository file or command transcript.
