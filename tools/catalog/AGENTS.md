# Catalog contributor tooling

This tool may validate and publish generic catalog definitions to development.

- Never accept a production API target.
- Read secrets from environment variables, not arguments or files.
- Validate locally before sending a request.
- Do not import planner, UI, or Worker implementation modules.
- Keep command output useful for a catalog-only work window.
