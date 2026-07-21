# ScheduleRU

ScheduleRU is a local-first course-planning assistant for Rutgers–New Brunswick students. It helps a student turn reviewed program requirements and course data into an understandable plan, then build a conflict-free schedule for the active registration term. It is a planning aid, not an official degree audit.

## Demo workflow

1. Continue as a guest and enter an academic position, completed or transfer coursework, AP results, home school, and programs.
2. Review requirements and let the deterministic planner produce an eight-semester preview. Existing placements are preserved as locks unless the student unlocks them.
3. Inspect assumptions, unresolved requirement placeholders, and issues; accept a preview only when it looks right.
4. For the active term, choose course sections and build conflict-free schedule permutations.
5. Tell the Schedule assistant preferences such as “no classes before 10” or “keep Friday light.” It translates the request into validated preferences; deterministic ranking then recommends verified schedule indices.

## What it does—and how it stays trustworthy

- Keeps guest planning data in browser storage, so students can try the planner without an account.
- Supports reviewed AP equivalencies, completed coursework, transfer records, program selection, requirement navigation, and prerequisite-aware planning.
- Balances an eight-term preview toward 14–16 credits, with an automatic ceiling of 18, and uses clearly labeled placeholders when an elective, Core choice, or rule is not resolved.
- Builds active-term section schedules from real section and meeting data, excludes closed sections by default, and retains stable schedule identities while filtering or ranking.
- Treats academic rules as deterministic, source-backed data. Missing, stale, malformed, or unreviewed information fails closed for automatic claims and appears as an assumption or advising issue instead of a made-up answer.
- Keeps language-model work bounded: the model may translate schedule preferences into a validated schema, but cannot invent courses, sections, requirements, eligibility, or schedule results.

## Architecture

The frontend is a framework-free static application. `index.html` is the integration shell, while small JavaScript modules hold deterministic, testable logic. A Cloudflare Worker provides the course/program API and scheduled catalog synchronization; Cloudflare D1 stores the catalog and reviewed requirement data.

```text
index.html                         Static desktop planning UI
planner-state-logic.js             Versioned local planner state and migrations
four-year-planner-logic.js         Deterministic multi-term planning
schedule-preference-logic.js       Deterministic schedule preference ranking
eligibility-logic.js               Reviewed eligibility and prerequisite decisions
requirement-group-logic.js         Requirement allocation and display logic
course-selector-logic.js           Reviewed course-selector matching
worker/src/                        Cloudflare Worker API and import logic
worker/schema/                     Schema, migrations, reviewed program data
worker/tests/                      Node test suite
worker/wrangler.toml               Worker, D1, active-term, and dev environment config
```

## Run locally

The static UI has no build step:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`. For local Worker development, use Wrangler from the `worker` directory:

```bash
cd worker
npx wrangler dev
```

The production and deployed development frontends use their configured Worker URLs. The development Pages host is deliberately paired with the separate `rutgers-course-sync-dev` Worker and `rutgers_courses_dev` D1 database; local Worker behavior depends on your Wrangler authentication and local/remote binding choices.

## Verify

Run the complete Node suite from the repository root:

```bash
node --test worker/tests/*.test.mjs
git diff --check
```

## Deployment safety

Development and production are intentionally separate. Use the dev environment while testing so catalog writes and reviewed-requirement data go only to the dev Worker and dev D1 database:

### Required: apply reviewed AP equivalencies first

Apply the reviewed AP-equivalency migration to development before deploying the Worker or frontend. Until this migration is applied, onboarding has no reviewed AP equivalency choices to offer. Run this from `worker/` against the configured development database:

```bash
cd worker
npx wrangler d1 execute rutgers_courses_dev --env dev --remote --file=schema/schema_ap_equivalencies.sql
```

The schema uses `CREATE TABLE IF NOT EXISTS` and an `ON CONFLICT ... DO UPDATE` upsert, so rerunning the command is idempotent and refreshes the reviewed rows.

After the dev Worker is deployed, smoke-check the public route before deploying the frontend. Set the deployed dev Worker URL for your Cloudflare account, then confirm the response is JSON with a nonzero reviewed-equivalency count:

```bash
DEV_WORKER_URL="https://rutgers-course-sync-dev.<your-workers-subdomain>.workers.dev"
curl --fail --silent --show-error "$DEV_WORKER_URL/api/ap-equivalencies" | jq '.equivalencies | length'
```

Production is approval-only. Do not run this command without explicit approval:

```bash
npx wrangler d1 execute rutgers_courses --remote --file=schema/schema_ap_equivalencies.sql
```

```bash
cd worker
npx wrangler deploy --env dev --keep-vars
```

Do not deploy the production Worker or D1 database without explicit approval. Preserve existing encrypted secrets with `--keep-vars`; never put secrets such as `ADMIN_SECRET` or an OpenAI API key in `wrangler.toml`, the frontend bundle, logs, or the repository. Deploy Pages from a deliberately minimal public directory—never from a directory containing Worker configuration, generated state, or secret files.

## Data provenance and review

ScheduleRU separates discovery from publication. Program and requirement data follows this pipeline:

1. Start with an official Rutgers school, department, or catalog source.
2. Capture a source snapshot and form a conservative draft.
3. Review requirements, selectors, prerequisites, eligibility, and policy constraints against the source.
4. Publish only reviewed data; leave incomplete or ambiguous coverage unavailable for automatic planning.

The Worker stores provenance and review evidence alongside program data. A course or program not covered by reviewed data is not silently promoted into an academic claim.

## Built with Codex and GPT-5.6

ScheduleRU’s release work used Codex with GPT-5.6 in deliberately separated roles. Terra implementation agents built and tested bounded code tracks. Sol coordinated integration and performed review rather than acting as an academic authority. Luna is the cost-sensitive runtime preference translator: it turns a student’s schedule-language request into a validated structured preference patch. Deterministic code then filters, ranks, and recommends only verified schedule permutations.

## Current limitations

- ScheduleRU is a planning aid, not an official Rutgers degree audit.
- Automatic planning is limited to reviewed program and rule coverage.
- Student state is local to the browser; there are no accounts or cross-device sync.
- The current experience targets desktop screens.
- Transcript, PDF, and image parsing are not supported; academic history is entered manually.

## Contributing

Keep changes small and verifiable. Add or update focused tests for deterministic logic, run the full Node suite, and run `git diff --check` before proposing a deployment. Keep production untouched until the change and its deployment have been explicitly approved.
