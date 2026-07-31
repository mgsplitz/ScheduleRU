# ScheduleRU — canonical continuation handoff

**Prepared:** July 21, 2026

**Repository:** `/Users/soham/Documents/GitHub/ScheduleRU`

**Current branch:** `dev`

**Development commit:** `92c6c9035b68c046a06b3f443df631a54d32cd10`

**Production/main commit:** `9196b178c2e56f71739cdd962b78aec7881e4afb`

This is the canonical handoff for the hackathon release. It supersedes previous handoffs, repository roadmaps, and older feature plans wherever they conflict with this document or the user's current prompt. Read this file, `README.md`, and all nine pages of `/Users/soham/Downloads/prompt.pdf` before changing code.

## First instruction for the next Codex task

Continue the ScheduleRU hackathon work from `dev` at `92c6c90`. Do not spend Sol credits on implementation. Use parallel Terra agents for independent implementation tracks, keep production and `main` untouched, and make no deployment to production without explicit user approval. First confirm the working tree, reread `README.md`, this handoff, and all nine pages of `/Users/soham/Downloads/prompt.pdf`. Then create isolated `codex/` branches or worktrees as needed, add failing integration tests for the confirmed planner failures, implement against development, and return a tested dev release candidate for user review.

Do not repeat the broad repository investigation unless the repository has materially changed. The root-cause audit is recorded below.

## User priorities and binding decisions

- The goal is a polished, hackathon-ready desktop application, ideally completed within roughly eight hours of implementation time.
- Data collection is low priority. Complete the product behavior first. Additional SAS program ingestion can happen last and may use a lower-cost model if available.
- Do not build account functionality. Continue as guest and store state locally in the browser.
- Transcript/PDF/image parsing is deferred. Provide lightweight manual input instead.
- AP input should be a checklist. State clearly that scores of 4 and 5 count for reviewed credit. Where scores have different equivalencies, expose separate entries such as `Chemistry (4)` and `Chemistry (5)`.
- Remove the onboarding academic-position screen. Internally default a new plan to an incoming first-year Fall horizon; preserve an internal editable anchor if the planner needs it.
- The planner horizon is Fall/Spring only. Do not expand into summer or winter planning.
- Triple majors are not supported. Support a primary major, at most one secondary major, and minors/programs of study.
- The top-left brand should say `Rutgers`; the adjacent label should be the user's home school. Do not display `Selected programs Degree Navigator` or the old combined degree-navigator title.
- Programs is for adding/changing majors, minors, and programs of study. Home school should have a separate `Change home school` action.
- Minors should appear visually quieter/faded in Required program subtabs.
- Production and `main` may be changed only after explicit user approval. Development deployments are allowed for verification.
- Desktop quality is the priority. Mobile/tablet redesign is not required.
- Testing should be proportionate and efficient, but correctness-critical planner paths require real integration coverage.
- Use Terra rather than Sol for implementation. Parallelize independent work. A low-cost model may be used for the final data-ingestion pass if that surface is available.

## Requested product behavior

### Onboarding

1. Opening copy: `Account functionality is not enabled. Continue as a guest for now.`
2. Remove the warning/flag about accounts, transcript upload, and device storage.
3. Remove `Set your academic position` from onboarding.
4. AP credit: searchable/checkable reviewed AP awards, no free-form student name or numeric score input. Explain that 4–5 count; distinguish score-specific awards.
5. Completed coursework: course code plus search/add only. Remove title, credits, origin, grade, and term inputs from the primary workflow.
6. Programs step: choose home school and primary major, then add programs by selecting school and major/minor/program type.
7. Final step: friendly `Try out our features` summary with three strong features and a Get Started action. Remove legalistic warning blocks from this screen.

### Four-year planner

1. Generate exactly eight consecutive Fall/Spring terms.
2. Warn when Core choices are incomplete. Actions: highlighted `I understand` and smaller `Go back`.
3. Unresolved Core requirements must become visible, typed schedule placeholders and remain visible after accepting the plan.
4. Incorporate wishlist courses as optional candidates.
5. Preserve only explicitly user-locked placements during regeneration.
6. Generated courses must be unlocked by default.
7. Regeneration replaces unlocked plan content rather than accumulating courses.
8. Add Clear Schedule with a confirmation appropriate to the amount of data removed.
9. Allow scheduled courses to move between semesters when they are not locked.
10. Preserve course titles and credits everywhere.
11. Enforce prerequisites, alternative prerequisite paths, co-requisites, minimum prior credits, minimum plan year, and standing restrictions.
12. Understand AP awards, completed courses, reviewed equivalents, and approved requirement substitutions.
13. Preserve `choose one`, minimum-credit, elective, and alternative-course semantics. Present an either/or selection where user choice is required.
14. Scheduled and generated courses must update the Required panel through the same allocation engine.
15. Balance business and non-business coursework only after every hard academic constraint is satisfied.

### Semester scheduler and assistant

- Keep deterministic enumeration of valid section schedules.
- Make the current schedule number clickable/editable, supporting `Schedule __ out of 406`-style direct navigation.
- Show the assistant unobtrusively within the semester scheduler.
- Opening suggestion should invite preferences such as no early classes, a light Friday, or only one late class.
- Preferences accumulate across messages. Provide undo/reset behavior.
- The language model may only translate language into a validated preference schema. Deterministic local code ranks verified schedule permutations.
- Recommend no more than three schedule numbers.
- If preferences conflict, concisely identify the conflict, offer the closest tradeoff, and ask which preference matters most.
- Do not let the model invent sections, courses, requirements, or schedule indices.

### Required panel and general UI

- Required contains smaller program subtabs, one for each selected program.
- Minor subtabs are visually subdued.
- Programs changes should apply once, never reset unrelated student state, and not require a second click.
- Put planning problems behind an `Issues` button next to the subtabs. The modal should group concise, bulleted issues.
- Remove large red headers, repeated legalistic warnings, walls of text, and copy that looks machine-generated.
- Show course name with course code consistently.
- Preserve an honest `planning aid, not an official degree audit` disclaimer without repeating it throughout the interface.

## Current repository and deployment state

- Local `dev` and `origin/dev` both point to `92c6c90` (`merge: prepare ScheduleRU hackathon release`).
- Local `main` and `origin/main` both point to `9196b17`.
- The only pre-existing untracked item observed during the audit was `.DS_Store`; preserve or ignore it unless the user asks for cleanup.
- Development Pages preview for the current release commit: `https://364276c7.scheduleru-9fb.pages.dev`
- Development Worker: `https://rutgers-course-sync-dev.housselllaura.workers.dev`
- Development Worker version last recorded: `063d5b63-5cda-4844-b743-aba84a0c83e1`
- Development D1 database: `rutgers_courses_dev`
- Development AP migration is applied and `/api/ap-equivalencies` returns 37 reviewed rows.
- Development Pages content was hash-checked against the local `index.html` during the audit.
- Production Worker did not have the new config/AP/assistant routes, and production Pages differed from development. Production was not modified.
- Numerous completed local feature branches remain. `dev` is the consolidated release branch; do not re-merge them blindly.

Useful branch families already merged into `dev` include:

- `codex/hackathon-planning`
- `codex/hackathon-ui`
- `codex/hackathon-polish`
- `codex/assistant-worker`
- `codex/four-year-engine`
- `codex/planner-state`
- `codex/schedule-preferences`
- `codex/release-fixes`
- `codex/release-ui-fixes`
- `codex/release-assistant-fixes`
- `codex/release-ap-runbook`

## Confirmed architectural root causes

### 1. Manual placement and automatic generation use different rule systems

Manual placement calls reviewed term eligibility logic. Automatic generation receives a stripped course record containing approximately code, title, credits, and one partial prerequisite path.

The generator does not receive or enforce:

- reviewed alternative prerequisite paths;
- minimum plan year;
- junior/senior or not-first-year restrictions;
- minimum prior credits;
- co-requisites;
- the same reviewed equivalency/allocation results used by Required.

Missing prerequisite mappings default to an empty path, effectively unrestricted. The generator's term-ordinal comparison works when valid prerequisite paths are supplied; the failure is missing/flattened input, not term ordering itself.

Primary evidence:

- `index.html:1274` and `index.html:1634` — manual placement eligibility.
- `index.html:2183-2191` — narrow prerequisite extraction rejects complex/OR text.
- `index.html:3511-3522` — lossy planner input construction.
- `four-year-planner-logic.js:136-150` and `339-355` — generator enforcement.

### 2. Eligibility coverage is not sufficient for automatic planning

The requirement evidence gate verifies that requirement membership is source-backed. It does not ensure that every course has complete credits, title, prerequisite paths, standing rules, or co-requisite rules.

During the live development audit of Economics + Computer Science BS + Mathematics minor:

- 235 requirement-course rows were returned.
- Only 2 rows carried reviewed eligibility.
- 60 rows had missing credits.
- 62 had zero/invalid credits.
- 56 had missing titles.

The repository's reviewed eligibility seed contains only two reviewed course records. Missing academic facts must therefore fail closed to typed placeholders; they must never mean `unrestricted`.

### 3. Missing credits are converted to zero

`index.html:3521` uses `course.credits || 0`. The engine accepts zero and enforces only a credit ceiling, with no course-count safety cap. Fifteen zero-credit courses can therefore be placed in one term without violating the nominal 18-credit limit.

### 4. Required and planner satisfaction diverge

The Required UI recognizes AP fulfillment and approved alternatives around `index.html:806-827`. Planner extraction uses exact known course codes around `index.html:3511-3513` and does not reuse the same allocation/equivalency result.

This explains reported cases such as:

- AP Statistics satisfying Required but Intro to Statistics being scheduled again;
- Intro to Computer Science satisfying an approved business alternative while Computer Applications for Business is still scheduled;
- alternative courses satisfying the visible requirement but not the generator prerequisite closure.

The correct fix is one canonical requirement-allocation result shared by Required, manual placement, and automatic generation—not isolated exceptions.

### 5. Requirement semantics are flattened

`choose one`, `minimum credits`, alternatives, electives, and `all` groups are converted into flat course lists or fixed three-credit placeholders. The engine cannot preserve user choices or calculate minimum-credit groups accurately.

Introduce typed planner requirements containing rule kind, required count/credits, candidate set, selected choice, provenance, and explicit coverage state.

### 6. Accepted plan state is lossy and lock semantics are conflated

- Placeholders exist in `preview.placeholders` but `withAcceptedPlan()` copies only `preview.schedule`.
- Generated output does not reliably preserve canonical titles.
- New manual placements default locked.
- Builder-confirmed courses default locked.
- Accepted generated courses are forcibly marked locked.
- Regeneration replaces the entire schedule rather than replacing only unlocked placements.
- Wishlist is absent from normalized planner input.

Separate `userPinned` from generated/manual provenance. Preserve only explicit user pins during regeneration. Persist typed placeholders and canonical course metadata in accepted state.

### 7. Integration tests miss the broken boundary

The focused planner/UI/state/eligibility suite passed 54/54 during the audit. The tests exercise pure modules and source hooks separately but do not run a realistic requirements payload through:

```text
Worker requirements API
  → frontend normalization
  → requirement allocation/equivalency
  → planner generation
  → accepted state
  → Required/Core rendering
```

Some source-pattern tests encode behavior now known to be wrong, such as default-locking placements. Add scenario-level tests before changing the architecture.

## Confirmed direct defects

- Existing scheduled cards are marked draggable but do not publish the required `cid` drag payload from the schedule card itself; moving scheduled courses does nothing. Locked courses should remain immovable until unlocked.
- Restart only reopens onboarding by setting `{completed:false, step:0}`. It does not warn or clear schedule, programs, AP/completed records, wishlist, locks, preferences, or persisted state.
- No Clear Schedule control exists.
- Wishlist courses are not passed to four-year generation.
- Core placeholders disappear after plan acceptance.
- Some generated titles fall back to course codes because requirement metadata is missing and the active-term catalog join cannot backfill courses not offered that term.
- Chemistry has distinct reviewed score-4 and score-5 awards, but the current UI labels both only as `Chemistry` and still asks for a numeric score.
- Program switching performs blocking request waterfalls with no useful client cache. `/api/requirements` builds selected program trees sequentially and each tree performs multiple D1 reads.
- The onboarding simplifications in the current PDF are not implemented.
- Clear course-name-plus-code presentation is inconsistent where metadata is missing.
- Required-tab refresh exists for straightforward scheduled courses; the reported failure is most likely allocation/equivalency/group semantics, not the absence of `renderAll()`.

## Assistant status, billing, and security

The architecture is directionally correct: OpenAI translates natural language into a strict preference patch, while deterministic local logic ranks real schedules. The deployed development request currently returns a generic 502 because a secure direct diagnostic returned OpenAI `insufficient_quota`.

Important facts:

- ChatGPT Plus and Codex credits do not fund OpenAI API usage.
- The user pasted an API key into the prior task. Treat it as compromised and rotate it before any production use. Never copy it into this file, source, logs, or a future prompt.
- The prior command used the API key as the Wrangler secret name. The correct secret name is `OPENAI_API_KEY`.
- Correct development pattern:

```bash
cd /Users/soham/Documents/GitHub/ScheduleRU/worker
npx wrangler secret put OPENAI_API_KEY --env dev
```

Enter a newly rotated value only through Wrangler's secure interactive prompt. Do not inspect or print existing secret values.

Before enabling a paid key publicly, fix these risks:

- `/api/schedule-assistant/interpret` is unauthenticated.
- CORS is `*`.
- No rate limiter, Turnstile, per-session allowance, or aggregate spending circuit breaker exists.
- A request may make up to two billable upstream calls.
- The endpoint buffers `request.text()` before enforcing its stated 20 KB limit.
- Upstream configuration errors are intentionally generic, which is safe for users but requires a bounded internal dev health check.

Also audit admin-secret handling. Current admin auth accepts a secret in the URL query string, which can leak into history/logs. `wrangler.toml` contains an example `wrangler secret put ADMIN_SECRET` without `--env dev`; do not run it casually because an omitted environment can target production configuration.

## Minimal-risk implementation order

### Track A — planner correctness (highest priority)

1. Add failing end-to-end fixtures for:
   - AP Statistics fulfillment;
   - Intro CS approved substitution;
   - junior/senior or minimum-plan-year gating;
   - alternative prerequisite paths;
   - physics prerequisite ordering;
   - missing-credit overload;
   - Core placeholder persistence;
   - Econ + CS + Math reported combination.
2. Add an immediate fail-closed gate: a generated plan cannot be accepted if a placed course has unknown credits or required eligibility coverage.
3. Create a canonical planner-facts contract containing canonical metadata, typed prerequisite alternatives, co-requisites, standing/credit gates, reviewed coverage, source program/family, and equivalents.
4. Create one shared allocation/equivalency result for Required and the planner.
5. Make unknown data generate typed unresolved placeholders, never zero-credit or unrestricted courses.
6. Add a course-count safety limit in addition to credit limits.
7. Enforce every hard condition before workload balancing.

### Track B — state and primary UX

1. Separate explicit user pins from generated/manual provenance.
2. Preserve user-pinned courses and replace only unlocked content during regeneration.
3. Keep generated courses unlocked.
4. Persist placeholders and canonical titles in accepted plans.
5. Integrate wishlist candidates.
6. Fix scheduled-course dragging.
7. Add Clear Schedule and full Restart confirmation/reset.
8. Implement the simplified onboarding and AP/course/program input flows.
9. Finish Required subtabs, concise Issues modal, and visual polish.

### Track C — assistant, performance, and release integration

1. Add rate limiting/session allowance, origin control or Turnstile, bounded body ingestion, upstream timeout, and budget/circuit-breaker behavior.
2. Validate required secret presence/shape without logging values.
3. Replace URL-query admin authentication with a header-based constant-time comparison.
4. Batch/cache program requirement loading and remove network waterfalls.
5. Add direct schedule-number navigation and finish assistant presentation.
6. Run scenario tests, visual desktop smoke tests, and development deployment verification.

Suggested coordination: three Terra agents working these independent tracks in isolated `codex/` branches/worktrees, followed by a Terra integration/review pass. Avoid Sol for implementation. Merge into `dev` only after focused review; merge into `main` only after the user tests and explicitly approves.

## Expected time

With parallel Terra agents:

- 2–3 hours: catastrophic planner protections, canonical facts plumbing, AP/substitution consistency, and regression tests.
- 2–3 additional hours: locks/regeneration, placeholders, wishlist, dragging, clear/reset, and primary onboarding behavior.
- 1–2 additional hours: program performance, Required/general polish, assistant presentation/security.
- About 1 hour: integrated testing, development deployment, visual verification, and release-candidate corrections.

A strong hackathon-ready development build is realistically a 6–8 hour target. Complete reviewed prerequisite coverage for all SAS programs is separate and can take days; do not block the product release on exhaustive SAS ingestion.

## Verification commands

Run from the repository root unless noted:

```bash
git status --short --branch
node --test worker/tests/*.test.mjs
git diff --check
```

Focused current suite:

```bash
node --test \
  worker/tests/four-year-planner-logic.test.mjs \
  worker/tests/planner-state-logic.test.mjs \
  worker/tests/eligibility-logic.test.mjs \
  worker/tests/hackathon-ui-integration.test.mjs
```

The focused suite passed 54/54 at handoff. Passing it is necessary but not sufficient until real cross-layer scenarios are added.

Development AP smoke check:

```bash
curl --fail --silent --show-error \
  https://rutgers-course-sync-dev.housselllaura.workers.dev/api/ap-equivalencies
```

Follow the dev-only deployment instructions in `README.md`. Always use `--env dev` and preserve existing bindings/secrets. Do not infer production authorization from permission to deploy development.

## Repository hygiene after the release candidate

- Update `README.md` if implementation changes make its architecture or guarantees inaccurate. It currently overstates automatic planner enforcement and fail-closed behavior.
- Preserve the existing `Built with Codex and GPT-5.6` section, correcting model-role claims if actual execution differs.
- Consolidate or archive obsolete roadmap/spec artifacts only after verifying nothing still links to them.
- Prune merged local branches only after the user approves cleanup; do not delete branches as part of feature implementation.
- Move repeated reviewed SQL data toward structured imports/migrations over time, but do not spend the hackathon window rewriting all data infrastructure.

## Non-negotiable safety boundaries

- Never place OpenAI or admin secrets in source, commits, Markdown, logs, screenshots, or chat.
- Rotate the previously pasted OpenAI key before production use.
- Never inspect, print, or replace the existing admin secret without explicit authorization.
- Do not mutate production Worker, D1, Pages, secrets, or `main` without explicit user approval.
- Preserve unrelated dirty files and user work.
- Academic uncertainty must be visible and fail closed. Do not invent requirements to make a generated schedule look complete.
- AI may interpret preferences; deterministic reviewed code must decide academic eligibility and schedule validity.

## What the next task does not need to ask again

- Yes, implementation may proceed on development.
- Yes, independent tasks may be parallelized with multiple agents.
- Use Terra for implementation rather than Sol.
- Main/production require explicit approval after the user reviews development.
- Desktop-only polish is acceptable.
- Parsing/transcript uploads and exhaustive SAS ingestion are deferred.
- Fall/Spring only is acceptable.
- Triple majors are out of scope.
- The user has already approved the recommended implementation direction.
