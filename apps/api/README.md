# ScheduleRU API

This application owns the Cloudflare Worker entrypoint, HTTP routing, and
Cloudflare-facing request controllers.

## Current boundary

- `src/worker.js` is the canonical Worker entrypoint used by Wrangler.
- `src/programs.js` is the canonical program, requirement, policy, and
  contributor API controller.
- `src/catalog-admin.js`, `src/reference-data-admin.js`, and
  `src/catalog-ingestion-admin.js` own the authenticated development-only
  contributor routes.
- `worker/src/worker.js`, `worker/src/programs.js`, and the legacy admin paths
  are compatibility exports. New code must import from `apps/api`.
- The program controller still consumes the legacy import and policy helpers
  under `worker/src` until those helpers move behind narrower API/storage
  contracts. `worker/src/schedule-assistant.js` is also a compatibility
  dependency pending the scheduling-adapter migration.

The API app may compose domain packages, but it must not own reviewed catalog
content, requirement evaluation, planner decisions, or scheduling rules.
