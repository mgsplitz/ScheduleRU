# Planner Feasibility Results Design

**Date:** 2026-07-28  
**Branch:** `codex/systemic-planner-fixes`  
**Target:** development environment only; `main` remains untouched

## Objective

Replace the generic “unresolved slots could not fit” result with an honest,
systemic explanation. A plan below 144 aggregate credits can still be impossible
within eight semesters when prerequisite chains, standing rules, locks, or term
limits force too much work into particular parts of the timeline.

## Approaches considered

1. **Classify the existing greedy failure.** This is small, but it cannot prove
   whether rearranging earlier placements would succeed.
2. **Run a bounded deterministic feasibility search after generation.**
   This is the selected approach because it can separate proven infeasibility
   from ordinary greedy-search failure without adding a runtime dependency.
3. **Add an external SAT/constraint-solver package.** This can produce strong
   proofs, but it adds bundle, deployment, and maintenance cost that is not
   justified for eight fixed Fall/Spring terms.

## Design

The pure four-year planner will expose a feasibility result alongside its draft.
The analysis evaluates required concrete courses and unresolved requirement slots
together across the same eight terms.

It enforces:

- locked placements;
- reviewed prerequisite alternatives and strict earlier-term ordering;
- reviewed co-requisites;
- minimum plan year and minimum prior-credit conditions;
- the 18-credit hard limit; and
- the configured per-term course-count limit.

Optional Wishlist courses never make a required plan infeasible.

The result has one of four states:

- `complete`: every required item has a valid placement;
- `aggregate_capacity`: required credits alone exceed available term credits;
- `sequencing_capacity`: the search proves that prerequisite, standing, or
  locked-term constraints make the eight-term horizon infeasible; or
- `indeterminate`: the bounded search cannot prove either feasibility or
  infeasibility within its state budget.

An `indeterminate` result must not claim the student’s program combination is
impossible. The UI explains that the automatic search could not finish and keeps
the current accepted plan unchanged.

## Evidence and messages

Aggregate results include required, available, and excess credits.

Sequencing results include the smallest stable set of blocked course codes or
requirement labels that the search can substantiate, plus the relevant eligible
term range when available. The UI says that these constraints cannot all fit
within eight semesters; it does not suggest removing a specific program unless
the data proves that relationship.

Greedy drafts remain previews. **Use this plan** appears only for a complete,
constraint-valid result.

## Testing

Tests will cover:

- aggregate credits above the horizon;
- credits below the horizon but an impossible prerequisite chain;
- a feasible case that requires rearranging a greedy draft;
- standing and locked-placement bottlenecks;
- search-budget exhaustion returning `indeterminate`; and
- UI wording and acceptance behavior for every result state.

The complete Node suite and the reported BAIT/Finance plus CS/Math/Philosophy
combination will be verified before pushing to `dev`.
