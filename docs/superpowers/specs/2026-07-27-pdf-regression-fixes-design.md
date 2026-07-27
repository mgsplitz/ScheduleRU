# PDF Regression Fixes Design

**Date:** 2026-07-27
**Branch:** `codex/systemic-planner-fixes`
**Target:** development only until user approval

## Goal

Fix the eight regressions reported in the July 27 PDF without adding course-specific
browser exceptions. The broader `index.html` migration is intentionally deferred;
new decision logic should live in focused modules so the future migration can reuse it.

## Design

### One academic-state model

The planner adapter will evaluate requirement groups against the same transitive
academic-credit closure used by the Required panel. Completed Rutgers courses, AP
awards, reviewed alternatives, and already planned courses retain their provenance.

- A completed or AP-satisfied member reduces the remaining count of a choice group.
- A planned approved alternative satisfies the canonical requirement without adding
  a duplicate canonical course.
- Regeneration preserves the actual approved alternative already in the plan.
- Prerequisite evaluation receives the same equivalent course closure.

### Reliable placeholder routing

Generated placeholders already retain candidate-selection context. Routing will use
the live requirement group when available and fall back to that stored context.
Finite candidate lists open the requirement picker; selector-backed groups open the
catalog browser; only truly unresolved groups fall back to the Required panel.

### Programs, picker actions, and term controls

- Opening Programs shows school choices first. Selecting a school reveals that
  school's majors and minors without changing the user's home school.
- A filled requirement uses its single remaining action for Wishlist add/remove.
  The redundant separate Wishlist button is removed.
- The semester-builder `+` control appears only on the current registration term.

### Schedule assistant

The Worker will use a supported, cost-oriented OpenAI API model rather than the
Codex/Bedrock-only Luna identifier. Structured Outputs, `store: false`, bounded
history, and a tight output-token limit remain.

Simple supported requests apply immediately. An ambiguous named-course spacing
request returns a concise clarification offering 30, 45, or 60 minutes and asks
whether the courses should stay on the same campus or may change campuses. No
preference is changed until the user answers. Schedule facts include course identity,
and the deterministic ranker enforces the selected course-pair gap and campus rule.
The client distinguishes unavailable/upstream failures without exposing secrets.

## Deferred architecture migration

After functional stability, migrate the monolithic page incrementally into an app
store, API layer, domain modules, feature modules, shared UI components, and split
styles. This release does not perform a framework rewrite.

## Verification

Focused tests cover AP/completed choice counts, planned alternatives, placeholder
fallback routing, school-first program browsing, Wishlist action multiplexing,
active-term controls, supported API model configuration, spacing clarification, and
named-course schedule ranking. The full Node suite and a development browser smoke
test must pass before any deployment.
