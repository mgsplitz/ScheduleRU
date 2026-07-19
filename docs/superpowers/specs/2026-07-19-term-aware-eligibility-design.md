# Term-Aware Eligibility Design

**Date:** 2026-07-19  
**Status:** Approved design; implementation plan pending user review  
**Scope:** Rutgers–New Brunswick local-first planner. This design does not add SAS program data, accounts, AI scheduling, or automatic eight-semester generation.

## Purpose

ScheduleRU must not place a course in a semester where its prerequisite, standing, or credit threshold has not been met. It must also let a student build a realistic multi-term plan without claiming that a future planned course is already completed.

The feature distinguishes official, present eligibility from a valid future-plan assumption. It applies to every reviewed program rather than to RBS or SAS specifically.

## Decisions

1. The active expansion scope is reviewed Rutgers–New Brunswick undergraduate programs only. Newark and Camden are not supported choices in this release.
2. A course scheduled in the same or a later term never unlocks another course.
3. A course in an earlier planned term may unlock a course in a later planned term only as an explicit successful-completion assumption.
4. Accepted AP and transfer credit count toward reviewed credit/standing gates even when they do not satisfy a degree requirement.
5. A completed course may satisfy a degree requirement, unlock eligibility, both, or neither; those are separate determinations.
6. Only an official, reviewed co-requisite rule may allow simultaneous enrollment. A generic planned-course rule must not imply co-requisite permission.
7. Unknown, malformed, stale, or unreviewed restrictions cannot support an automatic “eligible” result. The app must report that the condition needs review.

## Architecture

### 1. Academic credit ledger

The browser-local plan state gains an additive, backward-compatible credit ledger. Each entry records:

- stable entry identifier;
- source (`ap`, `transfer`, `rutgers_completed`, or `manual_reviewed`);
- accepted credit amount;
- associated course/equivalency code when known;
- completion status and effective completed-before term when applicable;
- optional provenance/note for manual entries.

Existing AP, completed-course, and schedule state remain readable during migration. The ledger is derived or backfilled from them without discarding existing saved plans. An existing explicit completion mark is treated as confirmed work completed before the saved plan's visible planning horizon; a merely scheduled course is never backfilled as completed.

`wishlist` entries and unscheduled courses never appear in the ledger. A scheduled course is not a confirmed ledger entry unless the student records it as completed.

### 2. Term ordering

A pure helper gives every planner term a stable ordinal: Fall Year 1 is `0`, Spring Year 1 is `1`, Fall Year 2 is `2`, Spring Year 2 is `3`, and so on. It rejects invalid years or semesters instead of guessing.

For a target term, the evaluator can identify only earlier terms. This enforces the “previous semesters only” rule for prerequisites and minimum-credit gates.

### 3. Reviewed eligibility rules

Eligibility is represented in reviewed data, not inferred from raw catalog wording. The first supported condition types are:

- prerequisite course or reviewed equivalent/family;
- co-requisite course, when explicitly recorded;
- minimum previously completed credits;
- academic-standing condition already represented by reviewed data.

Every stored condition carries a source URL, source label/date as available, campus, catalog-year applicability, and review status. A reviewed “no known eligibility condition” marker is required before the absence of a condition can produce an automatic eligible result. The app does not add minimum-credit rules by regular-expression parsing of catalog restrictions.

### 4. Two evaluators, one explanation format

`evaluateCurrentEligibility(course, studentFacts)` uses confirmed ledger entries only. It answers whether the student can be treated as eligible for the active/current term.

`evaluatePlannedEligibility(course, targetTerm, studentFacts, plan)` uses confirmed ledger entries plus qualifying planned courses from strictly earlier terms. It reports those future assumptions separately; it never treats them as confirmed eligibility.

Both evaluators return the same structured result:

- `status`: `eligible_now`, `planned_assumption`, `blocked`, or `needs_review`;
- satisfied conditions and the evidence for each;
- missing conditions;
- prerequisite/credit assumptions, if any;
- an earliest feasible planning term when it can be calculated safely;
- the reviewed rule/source identifiers used.

## User experience

Course cards and details use concise status language rather than raw policy text:

- **Green — Eligible now:** all reviewed conditions have confirmed evidence.
- **Blue — Works in this plan:** only earlier planned-term course completion is assumed. The card names the assumption.
- **Gray — Not yet available:** concise reason and, when known, earliest feasible term.
- **Neutral warning — Needs review:** the app lacks a reviewed rule or cannot evaluate it safely.

Example: A student has 44 confirmed credits before Fall Year 2 and plans 15 credits in that fall. A course requiring 45 previously completed credits is gray in Fall Year 2. It is blue for Spring Year 2 with the note, “Assumes 15 Fall Year 2 credits are completed successfully.” It does not become green until those credits are recorded as completed.

Degree-requirement cards continue to show where a course applies. Eligibility labels do not change degree allocation and degree allocation does not silently change eligibility.

## Data flow

1. Saved AP, transfer, completed-course, and schedule data are loaded.
2. The app derives confirmed-credit facts and potential earlier-term planning facts.
3. For each displayed course and target term, it retrieves only reviewed eligibility conditions.
4. The appropriate evaluator returns a structured result.
5. Requirement cards, the course catalog, and scheduling controls render the concise status and explanation from that result.
6. The future automatic scheduler can consume the same result without reimplementing prerequisite or credit logic.

## Failure handling and safety

- Invalid term data, a negative credit value, an unknown source type, or a malformed eligibility rule returns `needs_review`; it does not silently count credit or allow placement.
- A repeated stable ledger-entry identifier cannot add credit twice. Separate AP, transfer, and course records are never merged solely because their codes look similar; reconciliation requires a reviewed equivalency rule or explicit student correction.
- A student can still inspect a blocked or needs-review course. The system must not hide information merely because it cannot automatically approve it.
- No current-term UI may imply WebReg registration approval; ScheduleRU remains a planning aid and directs unclear cases to official Rutgers/advising confirmation.

## Tests and acceptance criteria

Pure, browser-testable logic tests must cover at least:

1. 44 confirmed credits do not meet a 45-credit condition.
2. 45 confirmed credits do meet it.
3. A Fall planned course does not unlock another Fall course.
4. A Fall planned course can unlock a Spring course only as `planned_assumption`.
5. A future Spring course cannot unlock a prior Fall course.
6. AP/transfer credits count toward eligibility even when no requirement group applies them.
7. Wishlist courses do not count toward any gate.
8. An explicit reviewed co-requisite is distinguishable from a prerequisite.
9. Malformed/unreviewed restrictions fail to `needs_review`.
10. Existing saved local state remains usable after migration.

Before development deployment, the relevant unit, integration, and existing regression suites must pass. The development build must be manually checked for a clear blocked state, a planned-assumption state, and no regression in RBS requirement allocation. Production remains unchanged until the reviewed RBS + SAS release gate is met.

## Explicit non-goals

- Importing or exposing unreviewed SAS programs.
- Determining a student’s official graduation audit result.
- Inferring Rutgers policy from private Degree Navigator data.
- Building the automatic eight-semester scheduler now.
- Adding accounts, transcript upload, or AI scheduling.

## Future compatibility

This evaluator is the dependency for a future automatic eight-semester scheduler. That scheduler will preserve student-locked courses, respect reviewed constraints, offer alternatives and tradeoffs, keep unchosen Core/elective slots open, and treat summer/online and Honors preferences as visible inputs. It is intentionally deferred until reviewed Rutgers–New Brunswick program and eligibility coverage is broad enough to support it responsibly.
