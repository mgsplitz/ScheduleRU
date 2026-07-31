# Course Interaction Reliability Design

**Date:** 2026-07-28  
**Branch:** `codex/systemic-planner-fixes`  
**Target:** development environment only; `main` remains untouched

## Objective

Fix the remaining course-selection, requirement-progress, panel-state, manual
placement, semester-builder, and schedule-assistant bugs documented in
`prompt-2.pdf` without starting the long-term `index.html` migration.

The separate idea to show which later courses a course unlocks is deferred.

## Root causes

The reported symptoms come from a small number of shared mechanisms:

1. Requirement choices, selector-backed catalog records, wishlist records, and
   scheduled records do not always share one canonical course identity.
2. Selector-backed requirements leave the requirement panel and use the full
   Courses page, while explicit approved lists use a modal. The two paths apply
   different selection behavior.
3. Broad rerenders replace DOM trees without preserving scroll, focus, or the
   user's expanded/collapsed state.
4. Manual semester placement validates prerequisites but has no explicit,
   auditable override workflow and does not ask before exceeding 18 credits.
5. Builder rows are rendered in upstream order, and the calendar compresses
   thirty-minute gaps enough to make them difficult to read.
6. The assistant crosses browser, Worker route, environment, secret, and OpenAI
   boundaries; its generic configuration message does not identify which
   boundary is failing.

## Design

### Canonical course identity and metadata

The public Rutgers course code, such as `01:198:425`, is the identity shared by
requirements, catalog results, wishlist entries, manual selections, and
semester placements.

A pure course-record merge helper will combine available metadata without
discarding a known value when another view provides an empty value. Official
requirement and catalog data may enrich title, credits, description,
prerequisite wording, restrictions, and reviewed eligibility. Missing data
stays labeled as unavailable; the application does not invent credits or rules.

Requirement progress will evaluate selected course codes across program tabs,
then use the existing allocation and double-count policy layers to decide where
the course applies. Selecting a course for one program therefore makes the same
course visible to every compatible requirement instead of creating unrelated
per-group copies.

### One requirement-selection workflow

The existing requirement modal becomes the only selection surface for:

- finite approved member lists; and
- reviewed selector-backed lists such as Computer Science courses numbered
  `300` through `499`.

Selector-backed lists are fetched through the existing reviewed
`GET /api/courses?selector=...` endpoint and rendered in the modal. Filtering,
pagination, details, and selection operate without navigating to the Courses
page.

When a requirement has an available slot, the first eligible course added from
that requirement's modal is selected for the requirement and also saved to the
wishlist. Once all requirement slots are filled, additional catalog courses are
wishlist-only until the user changes the selection.

Course-number level checks always parse the final three-digit component of the
canonical course code. For example, `01:198:425` is a 400-level course.

### Stable interaction state

Required-root expansion, nested requirement expansion, catalog-course
expansion, scroll position, and active input focus are state, not incidental DOM
effects.

Rerenders preserve that state. Adding or removing a course, marking completion,
locking a placement, and opening course details must not jump the page to the
top or collapse the group being edited.

Switching required-program tabs intentionally resets the shared-root expansion
to its configured default. Thus a shared Business Core may auto-collapse when
the student switches from BAIT to Finance, but not when the student edits a
course inside the currently selected program.

### Manual placement overrides

Automatic four-year generation remains strict: it never overrides
prerequisites, standing rules, locks, or the 18-credit term maximum.

Manual drag-and-drop uses explicit confirmation:

- If the placement would take a semester above 18 credits, show
  **Go back** and **Override 18-credit limit**.
- If a reviewed prerequisite or standing rule blocks placement, show
  **Go back** and **Place with override**.

An accepted override is stored on the placement with its reason and is shown on
the semester card. Moving the course revalidates the new term. Overrides are
local planning decisions and do not change official eligibility data.

### Semester-builder clarity

Section rows are sorted by numeric section number, then index number, with a
stable text fallback.

The weekday calendar uses a taller exact minute scale. Meeting blocks retain
their true start and end times, and a thirty-minute gap occupies a visibly
distinct vertical space. No meeting time is rounded into a different time.

### Schedule-assistant diagnosis

The development deployment will be checked at each boundary:

1. browser backend URL;
2. deployed `/api/schedule-assistant/interpret` route;
3. development Worker environment;
4. presence of the `OPENAI_API_KEY` secret; and
5. one minimal valid upstream request.

The key value is never logged, committed, returned to the browser, or placed in
client-side code. Tests use mocked upstream responses and do not consume API
credit. At most one live minimal request is used after the configuration path is
verified.

## Error handling

- A selector fetch failure stays inside the requirement modal and offers retry;
  it does not discard the current selection.
- A course with incomplete metadata remains selectable only when the reviewed
  selector proves it qualifies. Missing credits remain visibly unknown.
- A rejected manual override leaves the plan unchanged.
- Assistant failures distinguish local configuration, authentication/quota, and
  temporary upstream failure without exposing upstream response bodies.

## Testing

Pure and integration regressions will cover:

- selector-backed 300/400-level matching, including `01:198:425`;
- the first eligible modal wishlist action selecting an unfilled requirement;
- one course selection becoming visible to compatible requirements across
  program tabs;
- canonical metadata merging without erasing known credits or prerequisites;
- scroll, focus, and expansion state surviving relevant rerenders;
- program-tab switching resetting only the intended shared-root state;
- 18-credit and prerequisite override decisions and persisted badges;
- strict auto-generation ignoring manual override permission;
- deterministic section sorting and exact calendar positioning; and
- assistant route/configuration behavior without live API spending.

The focused tests, complete Worker test suite, and browser reproductions from
the PDF must pass before pushing to `dev`. `main` remains unchanged until the
user approves it separately.
