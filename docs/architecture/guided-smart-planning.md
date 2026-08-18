# Guided Smart Planning

## Outcome

ScheduleRU will guide a student from reviewed academic history to a transparent, efficient four-year plan without requiring the student to understand degree-audit terminology. The system will choose future courses only after the student either expresses an interest or explicitly delegates the choice, and every recommendation will explain the requirement coverage and prerequisite tradeoff that caused it.

## Product principles

1. One obvious next action is visible at a time.
2. Raw HTTP, database, parser, and solver language is never shown to a student.
3. A message starts with the consequence, gives one recommended action, and hides technical detail behind an optional disclosure.
4. A course chosen for a requirement immediately resolves that requirement placeholder.
5. Future degree-specific electives cannot remain anonymous when their prerequisite paths affect the four-year plan.
6. Students may delegate choices, but delegated recommendations remain concrete and require approval.
7. The optimizer maximizes only policy-permitted overlap; it never assumes that two requirements may double-count.
8. Curriculum facts are catalog-year scoped and source-backed. Conflicts remain visible to reviewers without overwhelming students.

## Requirement-choice model

Every unresolved requirement receives a planning mode:

- `fixed`: the requirement names a mandatory course or deterministic reviewed alternative.
- `sequence_critical`: candidate courses differ materially in prerequisites, standing, or offering cadence. A decision is required during generation.
- `guided_flexible`: the planner may recommend a concrete course using overlap and interests. SAS Core choices may be deferred.
- `reserve_only`: no reviewed finite choice can be made safely; the planner reserves credits and clearly marks the slot as unresolved.

A sequence-critical decision is resolved by either ranked interest or `recommend_for_me`. Ranked interest uses `interested`, `maybe`, and `avoid` buckets rather than forcing a total ordering. `Avoid` is a soft preference, not a feasibility constraint: a gateway elective may still be selected when its reviewed prerequisite closure is necessary to reach the student's intended electives. When that happens, the recommendation explains why the gateway is unavoidable. A delegated choice produces a concrete recommendation with an explanation and requires approval before the plan is accepted.

Business and degree-specific electives are presented first during generation and cannot be deferred. SAS Core choices follow and offer `I'll do this later`. Deferred Core slots remain visible reserves and do not pretend to have a verified prerequisite sequence.

## Choice transaction

Opening a placeholder creates a `RequirementChoiceIntent` containing the requirement group, source program, candidate selector, and return location. The Courses page renders the intent as a persistent filter chip while retaining normal search, subject, level, credit, Core-code, and availability filters.

Selecting `Use this course` validates the course against the reviewed candidate set, stores the group selection, removes the matching placeholder, and returns to the plan. While a requirement choice is active, this context-specific action replaces Wishlist so the row has one obvious next step. Outside requirement choice mode, Wishlist remains independent and never resolves a requirement. The newly changed planner card receives a short, non-persistent highlight after the return transition.

## Optimization pipeline

Four-year generation becomes a staged pipeline:

1. Build unresolved requirement slots and classify planning mode.
2. Collect interests and delegated choices in the generation dialog.
3. Build candidate coverage: requirements, equivalencies, Core attributes, prerequisite closure, offering evidence, and policy restrictions.
4. Select a concrete candidate set using lexicographic objectives: mandatory coverage, legal allocation, minimum additional credits, maximum overlap, user interest, minimum prerequisite burden, and offering feasibility.
5. Present delegated recommendations and tradeoffs for approval.
6. Pass the approved concrete course set and allowed deferred Core reserves to the existing semester sequencer.
7. Present a plan preview using plain-language issue summaries.

The optimizer is deterministic. The same reviewed inputs and preferences produce the same recommendations.

## Requirements workspace

After onboarding, the right-side Requirements workspace retains the primary `Required`, `Core`, and `Wishlist` navigation. `Required` contains compact program subtabs: shared school requirements first, then the primary major, secondary major, and minors. Minor tabs use quieter styling but remain accessible. SAS Core remains under `Core` because its goal-based behavior and deferrable choices differ from program requirements.

A compact `Next up` summary sits above the program subtabs and shows at most three actionable items. It is not another full destination.

## Onboarding

The five-step flow becomes:

1. Welcome: disabled `Create account` with `Coming soon`, plus active `Continue locally`.
2. Home school and programs.
3. Completed coursework: transcript entry/import entry point and verified manual catalog search.
4. AP credit.
5. Review and enter the planner.

Account creation and transcript parsing are not fabricated. Upload controls may identify unsupported formats or route to manual entry until a parser is deliberately implemented.

## User-language issue system

Domain modules continue emitting structured codes and context. A browser presentation model maps them to:

- a short title describing the consequence;
- one plain-language sentence;
- one primary recovery action;
- optional secondary action;
- optional collapsed technical detail for diagnostics.

Unknown failures receive a safe generic message and a retry action. Raw response bodies and stack traces never reach the normal interface. Related issues are grouped by the action needed, not dumped as independent warnings.

## Curriculum freshness

Programs and shared curricula are versioned by catalog/admission year. A source observation stores the URL, source kind, authority, access time, content fingerprint, and effective year. Lightweight checks compare fingerprints and enqueue extraction only for changed sources.

When Degree Navigator conflicts with a public page, both assertions are retained and the active reviewed decision records its evidence. Degree Navigator may enter through a reviewed manual observation when authenticated automation is unavailable. Shared curricula such as RBS Core are published once and referenced by applicable programs.

## Deferred scope

- Real account authentication and cloud persistence.
- Automated transcript or AP-report parsing.
- Scraping or storing RateMyProfessors data; the application will use external links only.
- Student organizations, events, and club-time scheduling constraints.
- Production deployment and production D1 changes without explicit approval.

## Success criteria

- Choosing a course removes the associated placeholder immediately.
- A sequence-critical elective is never scheduled anonymously.
- Delegated electives are concrete, explained, and approved.
- A legal overlapping course is preferred over redundant courses when all higher-priority constraints are equal.
- Students can defer eligible SAS Core choices but not degree-specific elective decisions.
- No ordinary error surface exposes HTTP status text, JSON, parser terminology, or solver terminology.
- Requirements remain readable with two majors and multiple minors.
- Curriculum changes can be detected and reviewed without reprocessing every unchanged program.
