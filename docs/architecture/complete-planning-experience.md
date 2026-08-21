# Complete Planning Experience

## Purpose

This document defines the student-facing and technical contract for a complete
ScheduleRU planning journey. The release replaces isolated planner patches with
one canonical academic-rule pipeline and one globally optimized course-selection
and four-year sequencing flow.

## Release standard

- Every published course choice has a title and complete planning facts.
- The catalog, guided choices, recommendation engine, and four-year planner use
  the same canonical course facts.
- No student-facing journey exposes implementation-status language such as
  "under review," "not ready," or "coming later."
- Preference changes preserve focus and viewport position.
- All selected majors and minors participate in guided decisions and global
  optimization.
- The plan ends at fourth-year spring and never invents additional academic
  years.
- Accuracy takes priority over query reduction. A separate abridged planner
  dataset is explicitly out of scope.

## Canonical academic-rule contract

`course_reference` and reviewed reference-data policies remain the persistent
source of truth. A shared compiler converts those records into a planner-safe
contract containing:

- prerequisite alternatives expressed as AND/OR course-code paths;
- co-requisite paths;
- minimum plan year and minimum prior credits;
- equivalent-course aliases and credit-exclusion families;
- requirement and Core attributes;
- canonical title and credits; and
- the official source text retained for course details.

The compiler is generic. Application code must not name Finance, Philosophy,
Computer Science, Mathematics, College Writing, or Differential Equations in
order to produce correct behavior. Reviewed exception and exclusion data belongs
in portable reference data, never UI code or structural migrations.

The API returns the compiled contract at the same boundary used by the catalog
and requirement tree. The planner consumes compiled facts and does not rederive a
different interpretation. Publication validation fails when a published choice
lacks a title or cannot produce a safe planning contract.

## Globally smart course selection

Plan generation optimizes the complete unresolved course set, not only choices
delegated through a "Choose for me" button. Objective order is:

1. satisfy mandatory program and school requirements;
2. obey prerequisite, standing, equivalent-course, credit-exclusion, and
   double-count policy;
3. maximize legal overlap across Core, majors, and minors;
4. prefer gateway courses that unlock later required or preferred work;
5. respect Interested, Maybe, and Avoid preferences;
6. minimize redundant credits and prerequisite burden; and
7. use stable course-code tie-breaking.

Avoid is a soft preference. A prerequisite gateway may override Avoid only when
it is necessary for a legal selected path, and the review screen explains why.
Completed or equivalent coursework is never scheduled again. Mutually exclusive
courses and equivalent alternatives cannot both enter one plan.

## Guided decision journey

The sequence is:

1. RBS and other nondeferrable major choices;
2. every selected minor choice;
3. one consolidated Core strategy choice;
4. one recommendation review; and
5. the generated four-year plan preview.

Each decision uses its requirement-group and program metadata to create a
semantic title, such as "Choose four finance electives." Slot counters are
progress metadata, not the requirement name. Generic "Choose 1" and "Course 1
of 4 for Elective Courses" labels are prohibited.

Long candidate lists show eight ranked matches and a search field. The action to
reveal all remaining courses appears below the ranked results. Candidate lists
do not create a nested visible scrollbar. Preference buttons update their local
card and navigation state without replacing the dialog DOM. A course rated in
one decision is omitted from later decisions while its preference and potential
coverage remain globally available.

Alternative families such as equivalent Differential Equations paths receive a
dedicated choose-at-most-one step. The delegated state is visibly persistent.
Degree-specific decisions cannot be deferred. Only user-directed Core selection
may be postponed.

## Core strategy and allocation

The Core step asks how ScheduleRU should handle Core courses:

- **Optimize them for me** maximizes overlap with selected programs and is the
  default.
- **Let me choose** opens one consolidated Core preference experience.

Repeated per-goal Core decision screens and a separate Core-only recommendation
review are removed. Allocation continues to enforce distinct families such as
WCr/WCd and the Arts and Humanities subgoals. Only leaf Core attributes such as
AHo, AHp, WCr, WCd, CCD, and CCO are displayed and filterable; aggregate AH is
not a course badge.

## Academic position and remaining terms

Onboarding asks for the student's current academic year and whether the next
planned term is fall or spring. Remaining terms are generated through
fourth-year spring only. Examples:

- first-year fall: eight terms;
- first-year spring: seven terms;
- sophomore fall: six terms;
- junior spring: three terms; and
- senior spring: one term.

Completed-course entry does not require a term label to influence planning.
Existing local guest data migrates to first-year fall when no position was
previously saved.

## Requirements workspace

The first visit after onboarding opens Shared requirements with all root sections
expanded. Program tabs remain ordered shared requirements, primary major,
secondary major, remaining majors, then visually quieter minors.

"Next up" is a single actionable link to the next incomplete requirement area or
program tab, for example "Next up: required finance courses." Following it opens
the correct tab and focuses the relevant section. The chain continues until all
visible requirements are complete.

## Semester schedule presentation

The semester builder retains the wide ScheduleRU calendar while improving the
day/time hierarchy, campus legend, event-card readability, and placement of
course title, index, time, location, campus, instructor, and status. Manual
schedule-number entry and the schedule assistant remain unchanged functionally.

## Verification contract

Automated tests cover canonical-rule parity, prerequisite alternatives,
standing, completed equivalents, credit exclusions, multi-program allocation,
semantic labels, repeated preference suppression, Core strategy, remaining-term
calculation, requirement navigation, and accepted recommendations entering the
four-year plan.

A rendered desktop journey verifies preference stability, absence of nested
scrollbars, complete major/minor sequencing, Core optimization, all remaining
terms, requirement navigation, and semester schedule readability. Before merge,
run `npm test`, `npm run typecheck`, and `git diff --check`.
