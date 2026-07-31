# Planner Feasibility Results Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Explain incomplete four-year plans with proof-based aggregate, course-slot, and prerequisite-sequencing results instead of one generic failure.

**Architecture:** Extend the pure planner with a deterministic feasibility analyzer. It first applies arithmetic proofs, then derives earliest legal terms from reviewed prerequisite alternatives and standing gates, and finally returns an inconclusive result rather than claiming impossibility when no proof applies.

**Tech Stack:** Browser JavaScript, Node test runner, existing pure planner/UI modules.

## Global Constraints

- Production logic remains program- and course-agnostic.
- Eight Fall/Spring terms, 18 credits per term, and the configured course-count limit remain hard constraints.
- Optional Wishlist courses never make required coursework infeasible.
- A bounded or incomplete analysis never claims a plan is impossible.
- No external solver dependency and no agent delegation.

---

### Task 1: Proof-based feasibility classifications

**Files:**
- Modify: `four-year-planner-logic.js`
- Test: `worker/tests/four-year-planner-logic.test.mjs`

**Interfaces:**
- Consumes: normalized courses, prerequisites, placeholders, terms, credit limit, and course-count limit.
- Produces: issues `plan_capacity_exceeded`, `plan_course_slots_exceeded`, `plan_sequence_capacity_exceeded`, or `plan_feasibility_inconclusive`.

- [x] Add a failing test where 49 one-credit required items exceed 48 available course slots without exceeding 144 credits.
- [x] Add a failing test where a nine-course strict prerequisite chain cannot fit into eight terms despite using only nine credits.
- [x] Add a failing test where an incomplete greedy draft with no mathematical proof returns `plan_feasibility_inconclusive`.
- [x] Run the focused planner test and confirm all three fail for missing classifications.
- [x] Implement generic arithmetic and earliest-term/suffix-capacity proofs.
- [x] Replace an unproven generic placement failure with the inconclusive classification while preserving stable blocked-item details.
- [x] Run the focused planner tests and confirm they pass.

### Task 2: User-facing results and acceptance behavior

**Files:**
- Modify: `planner-ui-logic.js`
- Modify: `index.html`
- Test: `worker/tests/planner-ui-logic.test.mjs`
- Test: `worker/tests/hackathon-ui-integration.test.mjs`

**Interfaces:**
- Consumes: planner feasibility issues and preview status.
- Produces: result-specific titles/messages and permits acceptance only for complete previews.

- [x] Add failing UI tests for aggregate, course-slot, sequencing, and inconclusive result presentation.
- [x] Run focused UI tests and confirm failure for missing presentation contracts.
- [x] Add a pure preview-result helper returning the modal title and primary explanation.
- [x] Render the helper output in the preview while keeping **Use this plan** exclusive to complete plans.
- [x] Run focused UI tests and confirm they pass.

### Task 3: Verification and development delivery

**Files:**
- Verify all modified source and test files.

- [x] Run `node --test worker/tests/four-year-planner-logic.test.mjs worker/tests/planner-ui-logic.test.mjs worker/tests/hackathon-ui-integration.test.mjs`.
- [x] Run `node --test worker/tests/*.test.mjs`.
- [x] Run `git diff --check` and inspect the complete diff.
- [x] Reproduce the multi-program preview locally and verify that its result names the proven constraint or reports an inconclusive search without declaring impossibility.
- [ ] Commit the implementation and fast-forward `dev`; leave `main` untouched.
