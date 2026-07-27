# PDF Regression Fixes Implementation Plan

1. Add failing planner-adapter tests for completed/AP choice counts and scheduled
   alternatives, then unify the academic-state input path.
2. Add failing UI-decision tests for placeholder context fallback, filled-requirement
   Wishlist actions, school browsing, and active registration-term controls; implement
   the pure helpers and wire them into the page.
3. Add failing assistant/ranker tests for supported model configuration, diagnostic
   categories, course identity, clarification, and 30/45/60-minute course-pair gaps;
   implement the Worker and browser integration.
4. Run focused suites, then the complete Node test suite.
5. Perform a local browser smoke test. Prepare a development-only deployment and do
   not merge to `main` without user approval.
