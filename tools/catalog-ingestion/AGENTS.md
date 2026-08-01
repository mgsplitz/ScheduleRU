# Catalog-ingestion contributor tooling

- Never accept a production API target.
- Read secrets from environment variables, not arguments or files.
- Validate complete snapshots before publication.
- Do not import planner, frontend, or Worker implementation modules.
