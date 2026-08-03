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
- `src/programs/services/catalog-directory-import-service.js` coordinates
  leased program-directory imports without depending on HTTP or D1.
- `src/programs/storage/catalog-directory-repository.js` owns directory-source
  leases, identity overrides, catalog listing publication, and failure state.
- `src/programs/services/requirement-import-service.js` coordinates bounded,
  polite requirement-source snapshot imports without publishing degree audits.
- `src/programs/storage/requirement-import-repository.js` owns requirement
  source lookup, immutable snapshot persistence, pending queues, and errors.
- `src/programs/services/requirement-candidate-service.js` turns immutable
  source snapshots into reviewable section candidates without publishing
  degree rules or changing program review status.
- `src/programs/storage/requirement-candidate-repository.js` owns the
  unprocessed snapshot queue and immutable candidate persistence.
- `src/programs/services/requirement-discovery-service.js` coordinates
  profile and nested official-source discovery with bounded polite waits.
- `src/programs/storage/requirement-discovery-repository.js` owns profile
  registration, discovery queues, discovered sources, and attempt evidence.
- `src/programs/services/program-scrape-service.js` coordinates legacy
  Coursedog and approved RBS source fetches, parsing, and scrape outcomes.
  RBS source identity comes from reviewed program data and is validated by the
  adapter; the service contains no program-to-URL map.
- `src/programs/storage/program-scrape-repository.js` atomically replaces
  generated requirement rows without owning source parsing or HTTP behavior.
- `src/programs/scrapers/html.js` provides the shared conservative HTML
  normalization used by source adapters.
- `src/programs/scrapers/business-school-parser.js` owns pure RBS table and
  policy-note parsing. It can be tested without routing, network, or D1.
- `src/programs/scrapers/coursedog-program-parser.js` owns generic Coursedog
  course-line and section parsing, including prerequisite-note isolation.
- Reviewed shared curricula, including the Rutgers–New Brunswick Core, are
  runtime catalog data. The API reads them through reviewed
  `school_curriculum_modules` attachments; it does not own their source URLs,
  IDs, group trees, course memberships, or refresh logic.
- Tagged curriculum refreshes belong to `tools/catalog`. They produce validated
  unreviewed draft artifacts and semantic reports without writing D1.
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
