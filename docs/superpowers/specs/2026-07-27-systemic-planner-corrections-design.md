# Systemic Planner Corrections Design

**Date:** 2026-07-27  
**Branch:** `codex/systemic-planner-fixes`  
**Target:** development environment only until user approval

## Objective

Correct the reported requirement, academic-credit, program-tab, plan-generation,
and schedule-assistant failures at their shared system boundaries. Course-specific
facts remain data; the browser must not gain one-off checks for individual course
codes.

## Architecture

### Canonical academic-credit closure

Introduce a pure academic-credit resolver that starts with confirmed course codes
and repeatedly applies reviewed requirement equivalencies from every loaded
requirement tree. The resulting closure is the single source of truth for:

- requirement completion;
- prerequisite-path evaluation;
- course-detail status;
- four-year planner inputs; and
- suppression of already-satisfied canonical courses.

The reviewed data will record that `01:198:111` satisfies the RBS foundational
`01:198:170` requirement and that the AP Statistics award `01:960:211` satisfies
the RBS `01:960:285` requirement. The resolver itself remains generic and supports
future equivalencies without code changes.

### Requirement provenance

Requirement-family deduplication will retain the complete set of owning selected
program IDs on the chosen representative root. The normalized tree will propagate
that ownership to groups. Program-tab filtering will use this ownership set, so a
shared Business or Foundational Core remains visible under every program that
requires it while still appearing only once in the combined planner input.

When two majors share a Core family, that family starts collapsed in the Required
panel to reduce repetition. This changes presentation only; completion and planner
logic use the same singular normalized group.

### Picker and placeholder behavior

Requirement-picker rows expose independent actions:

- use/remove for the active requirement; and
- add/remove from Wishlist.

Wishlist state is visible immediately and persists through the existing local
planner state.

Generated-plan placeholders retain their full candidate-selection context. Choosing
a placeholder switches to the correct requirement context and opens the appropriate
requirement picker directly. Selector-backed groups continue to open the existing
catalog browser because they do not have a finite candidate list.

### Course paths

Every course-details view renders a Course path section after its on-demand
eligibility lookup:

- reviewed or safely parsed prerequisite paths;
- official prerequisite references that cannot be safely automated;
- a verified no-prerequisite state; or
- an explicit not-yet-machine-readable state.

The UI never converts ambiguous prose into blocking prerequisite logic.

### Programs and home school

The program selector loads every published supported program, then applies reviewed
eligibility policies using the unchanged home-school value. Selecting another area
of study does not replace the home school or its Core curriculum. Existing count,
combination, and advising policies remain authoritative.

### Generation preflight

The Generate plan button runs one guarded asynchronous flow:

1. ensure the home-school Core is loaded;
2. calculate Core completeness;
3. show the incomplete-Core warning when necessary;
4. generate only after the user explicitly continues;
5. show a preview; and
6. mutate the accepted eight-semester plan only after **Use this plan**.

Repeated clicks while preflight is active are ignored. No preview can appear before
the warning decision.

### Schedule assistant and secret handling

The existing Worker-side structured-output translator remains the only OpenAI
integration. The API key is stored only as the encrypted `OPENAI_API_KEY`
Cloudflare secret. Requests keep `store: false`, use the cost-oriented Luna model at
low reasoning, and gain a tight output-token ceiling. Tests inject a fake upstream
fetch and never call the paid API.

## Verification

Focused regression tests will prove:

- transitive, tree-driven equivalencies affect every consumer consistently;
- shared display families retain all owner programs;
- Wishlist actions are independent from requirement selection;
- placeholders dispatch to finite pickers or selector browsers;
- course paths always render an honest state;
- all-school program loading preserves home-school policy checks;
- generation cannot run before incomplete-Core acknowledgement; and
- assistant request bounds and secret handling remain intact.

After focused tests pass, run the complete Node test suite and one local browser
smoke pass. Apply database migrations and the secret only to the development
environment, deploy the development Worker and Pages build, and wait for user
approval before any main-branch or production action.
