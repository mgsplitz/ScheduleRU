# ScheduleRU

ScheduleRU is a local-first course-planning application for Rutgers–New Brunswick students. It combines reviewed degree requirements, Rutgers course and section data, deterministic planning rules, and an optional natural-language schedule assistant.

It is a planning aid, not an official Rutgers degree audit. Students should confirm requirements, transfer/AP credit, prerequisites, and graduation eligibility with Rutgers advising and Degree Navigator.

## What the application does

- Runs a five-step guest setup for AP credit, completed Rutgers coursework, home school, and programs of study.
- Displays reviewed major, minor, shared, and Core requirements with progress and source-backed advisory notes.
- Lets students drag courses into Fall and Spring terms, lock placements, move courses, maintain a wishlist, and clear or restart a plan.
- Generates a deterministic eight-term Fall/Spring plan preview. It preserves locked courses, respects supported prerequisites and credit/standing rules, balances workload, and uses typed placeholders instead of inventing unresolved electives.
- Searches a cached Rutgers course catalog and shows sections, meeting times, instructors, campuses, restrictions, and open/closed status.
- Opens a section scheduler from the red `+` button beside each semester title. It enumerates conflict-free section combinations and renders them on a weekly calendar.
- Optionally interprets preferences such as “no classes before 10” or “keep Friday light.” The language model only produces a validated preference patch; local deterministic code ranks real schedule combinations.
- Stores the student's plan in that browser. There are currently no accounts or cross-device synchronization.

Program availability is determined by the reviewed records in the connected D1 database. Unreviewed or incomplete data is not silently treated as an authoritative academic rule.

## How it works

1. A Cloudflare Worker periodically downloads the full active-term catalog from the Rutgers Schedule of Classes API.
2. The Worker writes courses, sections, and meetings to Cloudflare D1 in configurable chunks. It also serves reviewed programs, requirement trees, policies, AP equivalencies, and eligibility rules from the same database.
3. The static frontend requests those public API records and stores student-entered state in `localStorage`.
4. Plain JavaScript modules perform requirement allocation, eligibility checks, prerequisite ordering, four-year planning, conflict detection, and schedule ranking in the browser.
5. If the schedule assistant is configured, the Worker sends only the preference conversation and current preference set to the OpenAI Responses API. The browser—not the model—applies those preferences to verified schedule permutations.

The section catalog is selected by the Worker's `CURRENT_YEAR` and `CURRENT_TERM` configuration. Those values must be updated when the active Rutgers registration term changes.

## Technology

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | HTML5, CSS, vanilla JavaScript | Single-page planner, catalog, onboarding, and scheduler UI |
| Client storage | Web Storage (`localStorage`) | Versioned guest plan, preferences, and backend URL override |
| Backend | Cloudflare Workers | Public JSON API, scheduled catalog sync, admin/import routes, assistant proxy |
| Database | Cloudflare D1 / SQLite | Catalog, sections, meetings, reviewed programs, rules, policies, and provenance |
| Course source | Rutgers Schedule of Classes API | Active-term course and section data |
| Assistant | OpenAI Responses API | Strictly structured schedule-preference translation; optional |
| Hosting | Static hosting / Cloudflare Pages | Serves `index.html` and the root JavaScript modules |
| Tests | Node.js built-in test runner | Unit, integration, schema, reviewed-data, and UI contract tests |
| Operations | Wrangler CLI | Worker development, D1 migrations, secrets, cron configuration, and deployment |

## Repository layout

```text
index.html                         Static UI and integration code
course-selector-logic.js           Reviewed course-selector matching
eligibility-logic.js               Eligibility and prerequisite evaluation
four-year-planner-logic.js         Deterministic eight-term planner
planner-input-logic.js             Normalizes requirement data for planning
planner-state-logic.js             Versioned local state and migrations
requirement-group-logic.js         Requirement progress and course allocation
schedule-preference-logic.js       Deterministic preference filtering/ranking

worker/src/worker.js               Worker entry point, catalog sync, catalog API
worker/src/programs.js             Program, requirement, policy, and admin APIs
worker/src/schedule-assistant.js   OpenAI structured-output adapter
worker/src/*-import.js             Program discovery/import helpers
worker/schema/schema*.sql          Base and additive D1 schemas
worker/schema/migrate*.sql         One-time migrations for existing databases
worker/schema/review*.sql          Reviewed program/rule data
worker/schema/seed*.sql            Draft or seed data; not automatically published
worker/tests/*.test.mjs            Node test suite
worker/wrangler.toml               Worker, D1, cron, term, and dev configuration
docs/                              Design notes and implementation history
```

## Quick start: use the existing development backend

### Prerequisites

- A modern browser.
- Python 3 or another static file server.
- Node.js if you want to run the tests.

From the repository root, start a static server:

```bash
python -m http.server 8080
```

On systems where Python 3 is exposed as `python3`, use:

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

Use an HTTP server instead of opening `index.html` through `file://`; the application fetches remote API data and relies on normal browser-origin behavior.

`localhost`, `127.0.0.1`, and `::1` automatically use the deployed development Worker:

```text
https://rutgers-course-sync-dev.housselllaura.workers.dev
```

The production hostname uses:

```text
https://rutgers-course-sync.housselllaura.workers.dev
```

You can override the API URL from the Course Catalog connection bar. The override is saved per browser origin. This is also how to point the frontend at a locally running Worker.

### First-time application flow

1. Continue as a guest.
2. Select any reviewed AP awards that apply.
3. Search for and add completed Rutgers coursework.
4. Choose a home school and available programs of study.
5. Use the Required, Core, and Wishlist panels to build a plan or generate a preview.
6. Select a year and click the red `+` beside Fall or Spring to open the section scheduler.

The default planning horizon begins at first-year Fall and contains eight consecutive Fall/Spring terms. `Restart setup` clears locally stored academic and planning state after confirmation.

## Run the Worker

You only need this section if you are developing the API, using your own Cloudflare account, or changing the database.

### Prerequisites

- Node.js and `npx`.
- A Cloudflare account with Workers and D1 access.
- Wrangler authentication (`npx wrangler login`).
- An OpenAI API key only if the optional schedule assistant should work.

The repository does not pin a Wrangler version. `npx wrangler ...` will use a locally cached CLI or download one on demand.

### Existing Cloudflare project

`worker/wrangler.toml` contains separate production and development Worker/D1 bindings. The checked-in database IDs work only for collaborators who have access to the corresponding Cloudflare account.

Run the development Worker against its configured remote development database:

```bash
cd worker
npx wrangler dev --env dev --remote
```

Wrangler normally serves it at `http://localhost:8787`. In the frontend, open Courses and replace the backend URL with that address.

### A new Cloudflare account

Create a D1 database and replace the matching database name and ID under `env.dev.d1_databases` in `worker/wrangler.toml`:

```bash
cd worker
npx wrangler login
npx wrangler d1 create rutgers_courses_dev
```

Initialize the catalog tables:

```bash
npx wrangler d1 execute rutgers_courses_dev --env dev --remote --file=schema/schema.sql
```

Initialize the base program/requirement tables:

```bash
npx wrangler d1 execute rutgers_courses_dev --env dev --remote --file=schema/schema_programs.sql
```

Apply the reviewed AP-equivalency migration to development before deploying the Worker or frontend:

```bash
npx wrangler d1 execute rutgers_courses_dev --env dev --remote --file=schema/schema_ap_equivalencies.sql
```

Until this migration is applied, onboarding has no reviewed AP equivalency choices to offer. The script uses `CREATE TABLE IF NOT EXISTS` and an `ON CONFLICT ... DO UPDATE` upsert, so it can refresh its reviewed rows safely.

After deploying the development Worker, smoke-test that route with the real development URL:

```bash
DEV_WORKER_URL="https://rutgers-course-sync-dev.<your-workers-subdomain>.workers.dev"
curl --fail --silent --show-error "$DEV_WORKER_URL/api/ap-equivalencies"
```

The equivalent production migration is approval-only. Do not run it until the production change has been explicitly approved:

```bash
npx wrangler d1 execute rutgers_courses --remote --file=schema/schema_ap_equivalencies.sql
```

Important: the repository currently has no consolidated migration runner. The full planner data model was built through additive `schema_*.sql` and `migrate_*.sql` files, and the reviewed catalog was built through `review_*.sql` files. Their headers state their dependencies and whether they are safe to rerun. A new database needs the relevant additive schemas in dependency order before selected reviewed-data scripts are applied. Do not blindly execute every SQL file: some are one-time `ALTER TABLE` migrations, and `seed_*.sql` files may contain unpublished draft data.

At minimum, `schema.sql` is required for the course catalog API. The planner's program, Core, eligibility, policy, and AP features require their corresponding schemas and reviewed records.

### Worker configuration

The important non-secret values are in `worker/wrangler.toml`:

| Setting | Meaning |
| --- | --- |
| `CURRENT_YEAR` | Rutgers calendar year used for active section IDs |
| `CURRENT_TERM` | `0` Winter, `1` Spring, `7` Summer, or `9` Fall |
| `COURSES_PER_RUN` | Number of courses written during each cursor-based sync |
| `CATALOG_SUBDOMAIN` | Rutgers catalog site used by program import tooling |
| `SCHEDULE_ASSISTANT_MODEL` | Model name sent to the OpenAI Responses API |
| `DB` | D1 binding expected by the Worker code |

Development values are repeated under `env.dev` because Wrangler environments do not inherit all top-level bindings and variables.

### Secrets

For development:

```bash
cd worker
npx wrangler secret put ADMIN_SECRET --env dev
npx wrangler secret put OPENAI_API_KEY --env dev
```

- `ADMIN_SECRET` protects manual sync and program import/review endpoints. It is optional for public read-only routes and scheduled cron syncs.
- `OPENAI_API_KEY` is optional. Without it, the rest of ScheduleRU works, but `/api/schedule-assistant/interpret` returns `503` and the assistant UI reports that it could not update preferences.

The current admin API accepts `ADMIN_SECRET` as a URL query parameter. Treat any such URL as sensitive because query strings can appear in browser history and request logs.

### Catalog synchronization

The Worker fetches the full Rutgers active-term catalog once per sync, then writes a cursor-sized slice to D1. Production runs every 15 minutes; the development environment runs daily according to `wrangler.toml`.

Useful status endpoints:

```text
GET /api/sync-status
GET /api/sync-log
```

An administrator can request a cursor chunk or full background resync:

```text
POST /api/admin/sync-now?secret=<ADMIN_SECRET>
POST /api/admin/sync-now?secret=<ADMIN_SECRET>&full=true
```

Poll `/api/sync-status` or `/api/sync-log` after starting a full background sync.

## Public API overview

The frontend primarily uses these routes:

```text
GET  /api/config
GET  /api/ap-equivalencies
GET  /api/schools
GET  /api/programs
GET  /api/core-curricula
GET  /api/programs/:id/requirements
GET  /api/requirements
GET  /api/course-eligibility
GET  /api/double-count-policies
GET  /api/program-selection-policies
POST /api/program-selection-check
GET  /api/courses
GET  /api/courses/:id
GET  /api/courses/:id/sections
GET  /api/subjects
GET  /api/sync-status
POST /api/schedule-assistant/interpret
```

The Worker sends permissive CORS headers for the public API so the static frontend can be hosted separately.

## Testing

Run the complete suite from the repository root:

```bash
node --test worker/tests/*.test.mjs
git diff --check
```

The tests use Node's built-in test runner and require no package installation or network access. They cover deterministic logic, Worker request handlers, schema contracts, reviewed SQL data, frontend integration hooks, and planner regressions.

To run one file:

```bash
node --test worker/tests/hackathon-ui-integration.test.mjs
```

## Deployment

Deploy the development Worker first:

```bash
cd worker
npx wrangler deploy --env dev --keep-vars
```

Production and development use separate Workers and D1 databases. Confirm the target environment before applying SQL, setting secrets, running admin imports, or deploying. Omitting `--env dev` targets the top-level production configuration.

The frontend is static. A deployment must include:

```text
index.html
course-selector-logic.js
eligibility-logic.js
four-year-planner-logic.js
planner-input-logic.js
planner-state-logic.js
requirement-group-logic.js
schedule-preference-logic.js
```

Deploy only those public assets to a static host or Cloudflare Pages. Do not publish `worker/`, local Wrangler state, SQL files, admin credentials, or other repository internals as website assets.

Hostname-based backend selection is implemented in `index.html`. `localhost` and development `*.scheduleru-9fb.pages.dev` hosts use the development Worker; other hostnames default to the production Worker unless the user sets a browser-local override in the Course Catalog connection bar.

## Privacy and trust boundaries

- Academic records, selected programs, course placements, locks, wishlist entries, and preferences are stored in browser `localStorage` under `scheduleru_planner_state_v1`.
- Clearing site data removes the local plan. `Restart setup` removes the planner state after confirmation.
- There is no account database and no transcript upload/parser.
- Catalog and requirement requests go to the configured Worker.
- The optional assistant sends the recent preference conversation and current normalized preference constraints to OpenAI through the Worker. It does not send the student's AP history, completed-course record, or degree plan.
- Deterministic code—not the model—decides which real schedules match and recommends at most three stable schedule numbers.
- Reviewed academic data includes provenance and review status. Unsupported or ambiguous rules should surface as unresolved or advising issues instead of being guessed.

## Troubleshooting

- **The catalog is empty:** open `<backend-url>/api/sync-status`. A new database needs `schema.sql` and an initial catalog sync.
- **Programs or requirements do not load:** verify the program-related schemas and reviewed SQL records exist in the same D1 database, then inspect the failing API response.
- **No AP choices appear:** verify `schema_ap_equivalencies.sql` was applied and that its reviewed rows match the catalog year derived from `CURRENT_YEAR` and `CURRENT_TERM`.
- **The semester scheduler has no sections:** verify the requested courses exist for the configured active year/term and that the catalog sync has completed.
- **The schedule assistant fails:** verify `OPENAI_API_KEY`, `SCHEDULE_ASSISTANT_MODEL`, API access/quota, and the Worker logs. The planner and scheduler do not require the assistant.
- **Local changes appear to use the wrong API:** check the Course Catalog connection bar and the origin-specific backend URL saved in `localStorage`.
- **Saved state behaves unexpectedly after schema/UI changes:** use `Restart setup` or clear the site's local storage, understanding that this deletes the local plan.