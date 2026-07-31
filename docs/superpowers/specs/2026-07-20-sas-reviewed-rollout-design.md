# SAS Reviewed Rollout Design

**Date:** 2026-07-20
**Status:** Approved for planning
**Scope:** Rutgers–New Brunswick School of Arts and Sciences (SAS) majors and minors that SAS itself owns. This replaces the narrow Political Science/PPE pilot as the delivery roadmap; the existing PPE draft remains non-public until its source gaps are resolved.

## Goal

Make every source-complete SAS-owned major and minor selectable in ScheduleRU, in reviewed releases, without representing an incomplete academic page as an official degree audit. The public UI will continue to be one Programs modal. Production remains unchanged until the user explicitly approves a release.

The official SAS list describes more than 100 major/minor offerings and also lists programs owned by partner schools. This rollout supports only entries whose school is SAS. Partner-school programs remain outside this scope even if an SAS student may pursue them.

## Delivery model

### 1. SAS foundation

Add one reviewed SAS school profile, attach the already canonical Rutgers–New Brunswick Core only after confirming its SAS source boundary, and encode the reviewed SAS-wide policies that apply to every selection:

- a major and minor are normally required;
- multiple majors and credit-intensive-major cases can waive the minor requirement;
- a major and minor cannot come from the same academic program;
- published prohibited program combinations are blocked; and
- a course may overlap major, minor, and Core work only when the relevant program does not prohibit it.

The profile becomes public only after it has a reviewed default program. The UI uses SAS labels (Majors and Minors) and a short advising notice for conditions ScheduleRU cannot verify, such as grades, residency, transfer equivalencies, declaration approval, or external admission.

### 2. Reviewed program batches

Each SAS-owned program progresses through these states:

1. **Inventory:** official name, type, program code, degree type, source URLs, and owning school are recorded; it is not public.
2. **Evidence complete:** every group, listed course, selector/category, restriction, and exception has an official HTTPS source, support boundary, retrieval timestamp, and reviewer note.
3. **Reviewed:** pure requirement and selection-comparison tests pass; the program becomes selectable on development.
4. **Released:** the reviewed development batch is manually checked and explicitly approved for production.

The first batch is the Economics program family, beginning with the source-ready Economics degree path and Quantitative Economics minor. Political Science and PPE stay in the inventory/draft lane until their published area maps and cross-list conditions can be represented without guessing. Later batches group programs by department so shared selector and policy evidence is reviewed once and reused safely.

### 3. Public behavior

Only reviewed, evidence-complete programs are returned by public program, requirement, and selection-comparison endpoints. An unreviewed item never appears as a selectable path and cannot contribute satisfied requirements. This is deliberately incremental: the SAS menu grows as batches pass instead of showing every name with misleading progress.

Course membership comes from reviewed requirement rows or reviewed selector definitions, never from title matching, subject-prefix guesses, or a current-term course feed. A course can be allocated automatically to every compatible reviewed requirement, while an explicit exclusivity/cross-list rule prevents invalid double use within the same requirement family.

## Architecture and data boundaries

- Reuse the existing `school_profiles`, `school_curriculum_modules`, `programs`, requirement tree, selector, policy, and `program_requirement_evidence` tables. No SAS-specific frontend rules.
- Keep `requirement_evidence_required = 1` for newly imported SAS programs; public routes retain their fail-closed evidence gate.
- Represent finite course lists as reviewed `requirement_courses`; represent published categories as selectors only when their exact membership and exclusions are source-backed.
- Keep catalog wording that cannot be safely evaluated as an advising notice, not an automatic pass or block.
- Store all school-wide and named program-pair policies with the official SAS source URL. Do not infer cross-school combinations from general SAS language.
- Use Rutgers–New Brunswick course codes only. A cross-campus course is never substituted as an equivalent without a reviewed Rutgers equivalency rule.

## Error handling and safety

- Missing, malformed, stale, or unreviewed evidence fails closed: the program is invisible from public endpoints.
- A source that names an elective level but not its complete membership is not converted to a finite course list. It remains in the evidence queue.
- Grade thresholds, departmental approval, GPA, residency, declaration timing, and transfer-credit decisions are advisory unless a reusable reviewed evaluator can prove the condition from student data.
- The application may help plan courses; it does not certify graduation, admission, registration, or transfer eligibility.
- Development database/data changes and `dev` pushes are allowed for reviewed batches. No production deployment or production D1 change occurs without explicit approval.

## Verification

Every batch must add or update:

1. source/evidence fixtures covering every visible group and course;
2. pure requirement-allocation cases for required courses, alternatives, credit/level thresholds, and excluded courses;
3. school-policy comparison cases for same-program, prohibited-pair, and minor-waiver outcomes;
4. Worker integration tests proving incomplete programs are absent from all public routes; and
5. the full Worker test suite, frontend syntax check, clean diff check, and manual development UI check.

Existing RBS programs, Core allocation, course prerequisite planning, wishlist persistence, and the development Worker must continue to pass unchanged.

## Completion definition

“All SAS selectable” is complete only when every currently listed SAS-owned major and minor has reached the reviewed state above, its official source boundary is recorded, and the full regression suite passes. Program names owned by SEBS, Bloustein, Mason Gross, SC&I, Social Work, or another school are not counted toward this SAS scope.

## Non-goals

- Bulk publishing program names without complete requirement evidence.
- Concentrations, certificates, graduate programs, Newark, Camden, or partner-school programs.
- Automatic schedules, accounts, degree certification, or automatic resolution of advisor-only policies.
