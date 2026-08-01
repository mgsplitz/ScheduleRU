# ScheduleRU API

This application owns the Cloudflare Worker entrypoint, HTTP routing, and
Cloudflare-facing request controllers.

## Current boundary

- `src/worker.js` is the canonical Worker entrypoint used by Wrangler.
- `src/catalog-admin.js`, `src/reference-data-admin.js`, and
  `src/catalog-ingestion-admin.js` own the authenticated development-only
  contributor routes.
- `worker/src/worker.js` and the three legacy admin paths are compatibility
  exports. New code must import from `apps/api`.
- The large `worker/src/programs.js` route/scraping module and
  `worker/src/schedule-assistant.js` remain compatibility dependencies while
  they are split into narrower API and package contracts.

The API app may compose domain packages, but it must not own reviewed catalog
content, requirement evaluation, planner decisions, or scheduling rules.
