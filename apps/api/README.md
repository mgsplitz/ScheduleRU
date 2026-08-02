# ScheduleRU API

This application owns the Cloudflare Worker entrypoint, HTTP routing, and
Cloudflare-facing request controllers.

## Current boundary

- `src/worker.js` is the canonical Worker entrypoint used by Wrangler.
- `src/programs.js` is the canonical program, requirement, policy, and
  contributor API controller.
- `src/programs/public-routes.js` owns anonymous program reads, requirement
  reads, course eligibility, and program-selection validation. It receives a
  public repository and contains no D1 statements.
- `src/programs/storage/public-program-repository.js` owns D1 reads used by
  anonymous program endpoints and enforces reviewed-record visibility.
- `src/programs/admin-routes.js` owns authenticated program import, review,
  scraping, and requirement-contributor endpoints. It receives a contributor
  repository and contains no D1 statements.
- `src/programs/storage/admin-program-repository.js` owns D1 reads and writes
  performed directly by authenticated program contributor endpoints.
- `src/programs/` owns the controller's pure policy/evidence helpers,
  response presentation, and conservative source-import adapters.
- `src/schedule-assistant.js` owns the bounded OpenAI request adapter; the
  deterministic preference contract remains in `packages/scheduling`.
- `src/catalog-admin.js`, `src/reference-data-admin.js`, and
  `src/catalog-ingestion-admin.js` own the authenticated development-only
  contributor routes.
- `worker/src/worker.js`, `worker/src/programs.js`, and the legacy admin paths
  are compatibility exports. New code must import from `apps/api`.
- The corresponding `worker/src` program and schedule-assistant paths are
  compatibility exports.

The API app may compose domain packages, but it must not own reviewed catalog
content, requirement evaluation, planner decisions, or scheduling rules.
