# ScheduleRU Implementation Roadmap

**Status:** Active implementation roadmap. The first committed milestone is a reviewed, school-aware Programs foundation; it does not claim coverage for a school until that school's data and policies are reviewed.

**Scope:** Rutgers-New Brunswick first; Rutgers-wide second; multi-institution later.

**Purpose:** Build ScheduleRU into a trustworthy, planner-first Rutgers student app. It should combine majors, minors, concentrations, general education, and term schedules without concealing policy uncertainty or making degree-audit claims it cannot support. The long-term product may serve other institutions, but Rutgers-New Brunswick is the first reviewed implementation.

## 1. The product we are building

ScheduleRU should eventually let a student:

1. Choose a home school, catalog year, and primary program.
2. Add secondary majors, minors, concentrations, certificates, and other approved programs of study.
3. See requirements, approved choices, prerequisites, restrictions, double-count rules, and remaining work in one understandable place.
4. Build or request multiple four-year plans that respect known requirements and prerequisites while leaving elective/Core choices open where the student has not chosen them.
5. Build a real term schedule from current sections and express preferences in normal language.
6. Discover eligible Core and elective courses through interests, not only through codes.
7. Later, save, compare, and access plans across devices through an account.

The product is a planning assistant, not a replacement for Rutgers Degree Navigator or academic advising. It should always explain what it knows, what it inferred, and what still needs advisor confirmation.

It should feel like a focused student tool, not a generic dashboard. The plan and schedule are the default experience; a new screen, card, or metric is added only when it helps a student make a real decision or complete a real task.

## 2. Non-negotiable product principles

### Accuracy before apparent completeness

No course, policy, equivalency, or double-count outcome should be silently invented. Every reviewed rule needs a source, catalog year, school/campus scope, review status, and test case. If a rule is uncertain, the app should say so and avoid presenting it as settled.

### Data-driven rules, never hidden course-specific behavior

The interface must not become a pile of special cases. Course alternatives, program overlaps, AP/transfer handling, eligibility, and policy exceptions belong in reviewed data and a reusable rule engine.

### Catalog year and campus are first-class facts

Requirements change. A student admitted under one catalog year may have a different program than a newer student. New Brunswick, Newark, and Camden are distinct contexts. Every program and policy must carry its applicable campus and catalog year.

### Explainable recommendations

Every plan or AI suggestion must show why it was made: requirements satisfied, prerequisites used, assumptions about course offerings, conflicts avoided, and tradeoffs accepted.

### Student control and privacy

The student owns the plan. The app must make it easy to edit assumptions, remove a recommendation, export a plan, and later delete account data. Do not scrape authenticated Degree Navigator or transcript data without explicit permission and a secure integration strategy.

### Planner-first, no dashboard bloat

The student should be able to open ScheduleRU and immediately continue planning. The default home experience may surface the current or next term and a small number of actionable suggestions, but it must not become a second dashboard that repeats information without helping the student choose a course, solve a schedule problem, or address a requirement.

### A staged rollout is safer than a broad claim

The product should expand school by school and catalog year by catalog year. “All Rutgers programs” is the destination, not a reason to publish unreviewed requirements.

## 3. Current baseline

ScheduleRU already has a useful Rutgers-New Brunswick foundation:

| Area | Current foundation | Remaining work |
|---|---|---|
| Course catalog | Current-term course/section data from the Worker and D1 | Broader historical/offering-pattern data and stronger location/eligibility coverage |
| Requirements | Reviewed RBS-New Brunswick program trees, shared requirement sets, Core display, alternatives, and some double-count logic | Complete program coverage, catalog-year versioning, broader policy grammar, and school-specific rules |
| Scheduling | Four-year plan area plus a current-term section builder and calendar | A real long-range plan generator, offering forecasts, workload balancing, and robust preference handling |
| Student state | Private same-browser/device saving for the plan, wishlist, AP credit, selected programs, and completion marks | Cross-device sync, plan history, exports, recovery, and account privacy controls |
| Course discovery | Catalog browsing and requirement pickers | Interest-aware discovery, semantic search, and transparent AI recommendations |
| School context | A safe RBS-New Brunswick home-school baseline | Reviewed, data-backed school profiles and school-specific terminology, policies, and program availability |

The most important architectural advantage is that the current requirements are already represented as data: programs, requirement groups, course rows, shared sets, reviewed alternatives, and policy records. We should extend that model instead of replacing it.

## 4. Target experience

### Program setup

The student starts with a lightweight academic profile:

- Campus and school.
- Catalog/admission year.
- Primary major.
- Optional secondary majors.
- Optional minors, concentrations, certificates, and honors programs.
- AP, transfer, completed, and in-progress courses.

“Primary major” matters later for policies, graduation ownership, and account organization. It does not need to restrict a student from adding multiple programs now.

The Programs modal is the initial home for school and program setup. It should first identify the student's reviewed Rutgers school, then show only the program types and wording that apply there. For example, RBS can say "Concentrations" while a future school can use "Tracks" only if that is its actual terminology. The same modal can later offer cross-school programs only when a reviewed policy explicitly permits the combination.

The Programs selector should use separate, clearly labeled sections or tabs when they help scanning:

1. Majors.
2. Minors.
3. Concentrations/tracks.
4. Certificates and special programs.

The selector should be driven by program type and school data, not by a hard-coded three-major limit. The product can impose school-specific limits only when a reviewed policy requires one. A school must never appear as selectable merely because its name is known; it appears after its program data and support boundary are reviewed.

### Home and onboarding (future account era)

Accounts are not needed for the current local-first planner. When they are introduced, onboarding should be short and purposeful:

1. Choose campus, school, catalog/admission year, and programs.
2. Enter AP, transfer, completed, and in-progress work manually, with an optional transcript upload/import path only after its privacy and review design is approved.
3. Continue into a planner-first home showing the current or next term, unfinished planning work, and useful suggestions.

Uploaded transcripts must not become an opaque source of truth. Imported course decisions need to be visible, correctable, and attributable, and raw files need a defined retention and deletion policy before upload is offered.

### Degree map

The student sees requirements grouped by source:

- University/Core curriculum.
- School requirements.
- Shared program requirements.
- Primary-major requirements.
- Secondary-major requirements.
- Minor/concentration requirements.
- Policies and items needing confirmation.

Courses that are completed or placed in a term should appear within every relevant requirement group. When a course can be used in more than one valid place, the evaluator should choose the most favorable valid allocation and explain it.

### Four-year plan

The four-year planner should never pretend it chose a student’s Core/elective preferences when it did not. It should:

- Place known required courses in a plausible prerequisite order.
- Reserve clear placeholders such as “Choose 3-credit Arts & Humanities course” or “Major elective, approved list” when the exact course is not selected.
- Treat current-term section availability as certain only for the active term; future offerings are forecasts and must be labeled as such.
- Offer several plans, not one supposedly perfect answer.
- Explain credit load, prerequisite bottlenecks, summer use, and tradeoffs.

### Term schedule builder

For a selected term, the user should choose actual sections and see:

- A WebReg-like weekly calendar.
- Conflicts, travel/campus implications, modality, waitlist/open status, and enrollment restrictions.
- Multiple valid combinations rather than one opaque result.
- A plain-language explanation when no schedule can satisfy all selected preferences.

### AI-assisted discovery and filtering

Students can say things such as “I want morning CS sections,” “avoid Livingston,” or “show philosophy courses with a STEM connection.” The AI should translate that request into explicit, inspectable filters and then call deterministic search/scheduling tools. It should not be allowed to invent a course, policy, section, or availability result.

## 5. Future architecture

The target system has five layers:

```text
Student experience
  Programs | Degree map | Four-year plan | Term scheduler | Course discovery

Planning and policy engine
  Requirement evaluation | Prerequisite graph | Allocation | Double-count policy | Explanations

Reviewed academic data
  Institutions | campuses | schools | catalog years | programs | requirements | policies | provenance

Live catalog data
  Courses | sections | meetings | seats | locations | term availability

Optional AI services
  Preference interpretation | ranking | course discovery | explanation
```

### 5.1 Academic data model

The data model needs the following reusable concepts before broad expansion:

| Concept | Why it is needed |
|---|---|
| Institution, campus, school, catalog year | Prevents Rutgers-New Brunswick rules from leaking into Newark, Camden, or another university |
| School profile | Supplies reviewed school labels, available program categories, curriculum context, advising language, and default starting state without embedding them in the interface |
| Program and program type | Supports majors, minors, concentrations, tracks, certificates, and future special programs |
| Curriculum module | Lets multiple schools share a Core while allowing another school, such as Engineering, to use a different general-education structure |
| Requirement expression | Represents all/any/minimum/distinct-credit/choice/conditional rules without UI-only exceptions |
| Course relationship | Stores equivalents, substitutions, cross-listed courses, prerequisites, co-requisites, AP/transfer mappings, and exclusions |
| Policy | Stores double-count caps, residency rules, grade minima, school-pair rules, and exceptions with sources and review status |
| Provenance | Records the source page, source date, catalog year, reviewer, review date, and test cases for every significant rule |

The existing requirements tables are a start. The next evolution should make ownership and applicability explicit rather than assuming `rbsnb` in API paths or UI labels.

### 5.2 Requirement and policy engine

The evaluator should return more than a green check. For every requirement it should return:

- Status: satisfied, planned, incomplete, blocked, or needs review.
- Exact course/AP/transfer items applied.
- Why each item was eligible.
- Why a competing allocation was not used.
- The source rule and catalog year.
- Any assumption or policy that needs advisor confirmation.

Required rule types to support over time include:

- All listed courses.
- Choose one or more from a list.
- Choose a number of credits.
- Choose courses across distinct learning-goal subgroups.
- One-of-two alternative paths.
- A course family/equivalency.
- Conditional requirements based on another program, school, catalog year, or degree type.
- A cap on courses or credits that can double count.
- Grade, residency, standing, and departmental-permission conditions.

### 5.3 Student plan data

Until accounts exist, browser storage remains appropriate for a private prototype. When accounts are introduced, create a separate student-plan data area rather than mixing personal data with public catalog data.

Account-era plan records should include:

- Profile and program selections.
- AP/transfer/completion entries, including source and confidence.
- Four-year plan versions and named scenarios.
- Term plans and chosen sections.
- Wishlist, preferences, and optional saved AI preferences.
- A revision history so a student can recover from a bad edit.
- Export/import capability.

Raw transcript files, if eventually supported, should be stored separately from the normalized academic-plan records and never be required for ongoing planning after a student confirms the imported entries.

## 6. Rollout plan

The phases below are ordered by dependency, not by calendar date. Each phase should have a written acceptance checklist before the next one begins.

### Phase 0: Stabilize the Rutgers-New Brunswick foundation

**Goal:** Make the current RBS experience an auditable reference implementation.

Work:

1. Inventory every existing RBS rule, source, catalog year, and review status.
2. Build a library of anonymous Degree Navigator comparison cases for majors, double majors, AP credit, alternatives, junior/senior restrictions, and electives.
3. Resolve remaining known data gaps before claiming broad RBS coverage.
4. Replace remaining RBS-specific UI assumptions with reviewed school/curriculum configuration, beginning with the Programs modal and category wording.
5. Define the copy used whenever the app is a planning aid rather than an official audit.

Exit gate:

- Each reviewed RBS program has a source and catalog year.
- Known test cases have expected requirement allocations.
- New requirement data can be added without editing frontend logic.
- A reviewed school can define its own terminology and planner context without a duplicate page.

### Phase 1: Complete program selection and multi-program planning for RBS

**Goal:** Make all reviewed RBS majors, minors, and concentrations selectable in a coherent program model.

Work:

1. Replace the “up to three majors” concept with a generic program collection.
2. Organize the selector by the reviewed school-specific labels for Majors, Minors, Concentrations/Tracks, and Certificates.
3. Add the RBS programs one batch at a time through reviewed source data.
4. Show shared requirements once while preserving program-specific exceptions.
5. Extend double-count policies from simple overlap warnings to reviewed, explainable outcomes where the policy is sufficiently clear.
6. Add scenario tests for a major plus minor, two majors, three majors, and accounting-specific cases.

Exit gate:

- A user can combine supported RBS program types without duplicate shared requirements.
- The app clearly flags cases where an advisor decision is still required.
- Every policy result has an explanation and a source.

### Phase 2: Add SAS, then Engineering as separate curriculum modules

**Recommended order:** RBS completion -> SAS -> School of Engineering.

SAS is the best next school because it shares the Rutgers-New Brunswick Core model, so the initial work validates reusable curriculum modules instead of inventing a new visual system. Engineering is the first major test of a genuinely different school curriculum.

Before either pilot becomes visible in Programs, create a reviewed school profile with its exact public name, campus, catalog-year support boundary, program-category labels, curriculum module, and links to the reviewed sources. The Programs modal remains one interface; it does not gain a separate SAS or Engineering page.

#### SAS pilot

Work:

1. Create a shared Rutgers-New Brunswick Core curriculum module rather than labeling it as RBS-only.
2. Attach it to SAS and RBS where officially applicable.
3. Pilot one SAS major, one SAS minor, and one cross-school combination before importing all SAS programs.
4. Record SAS residency, double-count, and major/minor policy rules with sources.
5. Add SAS to the Programs school selector only after the pilot's acceptance checks pass.

Progress note (development, 2026-07-19): item 1 is implemented as the reviewed `rutgers-nb-core-curriculum` module and is attached to RBS through reviewed school-to-module data. SAS is deliberately **not** attached or visible yet; its catalog-year compatibility and its own program/policy pilot still need review.

The program model now also carries an official academic-program code, degree type, and program-family identifier. This allows a future B.A. and B.S. path to have independently reviewed requirements rather than being presented as one ambiguous major.

#### Engineering pilot

Work:

1. Model the common first-year Engineering curriculum separately from SAS Core.
2. Model approved Humanities/Social Science electives as a reviewed rule/list, not as SAS Core choices.
3. Add one Engineering major end-to-end, including technical electives, departmental electives, and major-specific prerequisites.
4. Test a cross-school combination involving Engineering and another school only after the relevant official policy is reviewed.
5. Add Engineering to the Programs school selector only after the pilot's acceptance checks pass.

Exit gate for each school:

- One fully verified pilot program, one minor/concentration example where applicable, and a source-backed policy set.
- No unresolved school-specific rule is presented as automatic.
- The same interface works without a school-specific duplicate page.

### Phase 3: Build the four-year plan generator

**Goal:** Turn selected programs into explainable long-range plan options.

This phase should begin only after the prerequisite graph and program data are reliable enough to evaluate a plan.

Work:

1. Build a prerequisite/co-requisite dependency graph for reviewed program courses.
2. Store course availability history or planning assumptions separately from current-term sections.
3. Add term capacity rules: credits, expected workload, summer use, standing restrictions, and user-selected constraints.
4. Keep unselected Core and elective requirements as placeholders rather than choosing courses without consent.
5. Generate multiple plans, for example:
   - fastest path;
   - balanced workload;
   - no-summer path;
   - double-major-friendly path.
6. Explain every bottleneck, unsatisfied prerequisite, and assumption.
7. Let the user lock a course or term and regenerate the remainder around that decision.
8. Keep Core/elective choices as explicit placeholders until the student chooses them or asks for reviewed recommendations.

Exit gate:

- A generated plan is valid against the reviewed rule set under clearly stated assumptions.
- Removing or locking a course produces an understandable re-plan.
- Future offerings are visibly labeled as estimates unless confirmed by an official term schedule.

### Phase 4: Strengthen the current-term scheduler

**Goal:** Make section selection reliable enough to complement the four-year plan.

Work:

1. Finish meeting/location normalization and campus mapping with verified sources.
2. Improve conflict detection for meetings, recitations, labs, asynchronous work, and travel/campus preferences.
3. Apply eligibility checks before presenting a section as a viable recommendation.
4. Preserve multiple valid schedules and describe why each differs.
5. Keep a clear link between a long-range planned course and the chosen current-term section.
6. Add a “cannot satisfy all preferences” explanation instead of returning an empty or misleading calendar.

Exit gate:

- Every recommended schedule is meeting-conflict-free.
- A student can inspect the exact data and assumptions behind each schedule.
- The user can save one schedule to a named plan version.

### Phase 5: Add AI as a controlled planning assistant

**Goal:** Let students use normal language while keeping course and policy results deterministic and inspectable.

AI should be introduced as a translator and explainer, not as the source of academic truth. It can interpret a request and rank valid results, but the deterministic requirement and scheduling engines remain responsible for eligibility, conflicts, and policy results.

#### 5.1 Scheduling preferences

Example request: “Find CS courses in the morning, avoid Friday, prefer Busch, and tell me the tradeoffs.”

Flow:

1. AI converts the request into a visible preference object, such as days, start time, campus, modality, course subject, and strength of preference.
2. The deterministic section-search engine finds eligible sections and builds valid schedules.
3. AI explains the results and tradeoffs using the actual result data.
4. The student can edit the interpreted preferences before applying them.

The AI must not claim a section is available, a policy is satisfied, or a schedule is conflict-free without calling the corresponding data/evaluation tool.

The result should make every tradeoff visible: for example, a preferred morning schedule might require a Friday class, a different campus, or a waitlist. The student should be able to revise the interpreted preferences and rerun the search without accepting an opaque recommendation.

#### 5.2 Interest-based course discovery

Example request: “Show cool philosophy courses with roots in STEM.”

Start with catalog titles, descriptions, subject metadata, Core attributes, prerequisites, and course notes. A first version can combine structured filters with keyword/rule-based ranking. A later version can add semantic retrieval over reviewed course descriptions and tags.

Every recommendation should display:

- why it matched the student’s interests;
- what requirement(s) it can fulfill;
- its current-term availability, if any;
- prerequisites and restrictions;
- a direct path to course details.

Course-sniping or automated enrollment monitoring is a later, separate capability. It must not be implied by the first natural-language filtering feature.

#### 5.3 AI safety and evaluation

Before broad release, create a prompt test set covering:

- ambiguous preferences;
- contradictory schedule requests;
- course-policy questions;
- unsupported schools/programs;
- invented courses or sections;
- sensitive personal-information requests.

Track whether the system used tools, cited data, asked for clarification when needed, and avoided unsupported conclusions.

Exit gate:

- The AI only recommends from retrieved, reviewed course and schedule data.
- The user can see and correct the filters the AI derived.
- An unsupported request produces an honest limitation, not a fabricated answer.

### Phase 6: Add accounts and cross-device plans

**Goal:** Let students safely access plans on multiple devices and retain plan history.

Recommendation: use a managed authentication provider rather than building custom passwords. The decision can be made later based on cost, Rutgers sign-in possibilities, and desired user experience.

Work:

1. Choose authentication and define a minimal privacy policy.
2. Create a separate personal-plan database area with user IDs, plan IDs, version history, and deletion controls.
3. Migrate a user’s existing local plan only after they explicitly approve it.
4. Add account recovery, export, delete-account, and data-retention behavior.
5. Treat optional AP/college transcript upload and import as a separate security project, not a shortcut; manual entry stays available.
6. Keep raw uploads separate from normal plan data, with explicit retention, export, correction, and deletion behavior.

Exit gate:

- A user can sign in, save multiple named plans, restore a previous version, export data, and delete data.
- Local-only use remains available for users who do not want an account.

### Phase 7: Expand from Rutgers to other institutions

**Goal:** Reuse the planner engine while treating each institution’s catalog and policy data as a dedicated adapter.

Work:

1. Make institution/campus/school/catalog year explicit throughout the data model and APIs.
2. Define an adapter contract for catalog ingestion, section data, requirements, policies, and source provenance.
3. Pilot exactly one additional institution before advertising multi-school support.
4. Keep institution-specific policy expressions in data/configuration, not in shared frontend code.
5. Build a source-review pipeline for each new institution.

Exit gate:

- Rutgers data cannot be mixed with another institution’s program or policy data.
- Each institution has a documented source, review workflow, and support boundary.

## 7. Policy and data-review operating model

The hard part of this product is not drawing cards or calendars. It is maintaining academic rules safely.

Every new school/program/policy should follow this workflow:

1. **Collect:** Capture the official public source, applicable campus, catalog year, and source date.
2. **Model:** Express the rule using the shared requirement/policy schema.
3. **Review:** A person checks the transformed data against the source.
4. **Test:** Add representative test cases, including an expected allocation when courses overlap.
5. **Publish:** Mark reviewed data available to students.
6. **Monitor:** Re-check on catalog changes; show a review warning if the source is stale.

Degree Navigator-only information should be stored as separately labeled, project-owner-confirmed or advisor-confirmed data unless an official public source later verifies it. It must not be presented as a public-catalog rule without that provenance.

## 8. Double majors, minors, concentrations, and Core overlap

### What is already reusable

- Shared requirement sets.
- Course alternatives/equivalencies.
- Dynamic allocation within the Core.
- Program overlap detection.
- School-scoped double-count policy records.

### What needs to be expanded

- Policies that depend on home school, program type, catalog year, degree, and direction of the combination.
- Credit-based rather than course-count-only caps.
- “May count” versus “must not count” versus “advisor approval required” outcomes.
- Double-count consumption: one approved overlap may exhaust a student’s allowance elsewhere.
- Minor/concentration-specific restrictions and exclusions.
- A user-facing policy explanation that distinguishes a verified result from an advisor-confirmation flag.

The rule engine should optimize for the student only inside the allowed policy space. It should never maximize completion by applying one course to two requirements when the school does not permit that overlap.

## 9. Quality gates and release standards

No expansion should be considered complete until it passes all applicable checks:

| Gate | Required evidence |
|---|---|
| Source accuracy | Official source URL/document, source date, catalog year, reviewer, and review status |
| Requirement evaluation | Test cases for standard completion, alternatives, AP/transfer, and incomplete states |
| Overlap policy | Test cases for allowed, prohibited, capped, and advisor-confirmation scenarios |
| Scheduling | Conflict-free section combinations, meeting normalization, eligibility behavior, and campus/location checks |
| AI | Tool-grounded responses, corrected-filter visibility, prompt evaluation cases, and no fabricated catalog claims |
| Privacy | Clear local/account data boundary, export/delete behavior, and no secret or authenticated student data exposure |
| Accessibility and UX | Keyboard-friendly controls, readable error states, mobile review, and clear nontechnical language |

## 10. Decisions to make before implementation resumes

These decisions shape the next build phase and should be made deliberately:

1. **Initial coverage promise:** “All reviewed Rutgers-New Brunswick programs” is safer than “all Rutgers” until each school is verified.
2. **Rollout order:** Approve RBS completion -> SAS pilot -> Engineering pilot.
3. **Catalog-year behavior:** Decide whether new users choose an admission/catalog year, are guided through a default, or both.
4. **Policy stance:** Confirm that uncertain cross-school cases remain visible as “needs advisor confirmation” rather than receiving a forced answer.
5. **Account timing:** Keep browser-local saving for now; start accounts only once multi-device sharing or named-plan history becomes a real user requirement.
6. **AI launch boundary:** Start with deterministic filters and explanations, then add natural-language interpretation; do not begin with a free-form chatbot that can answer policy questions without tools.
7. **Source-review ownership:** Identify who approves new requirement data and how catalog updates are re-reviewed.

## 11. Recommended next implementation milestone

**Milestone: School-aware Rutgers-New Brunswick Academic Model v1.**

This is the correct place to start, before accounts or AI.

Deliverables:

1. A formal program/curriculum taxonomy: institution, campus, school, catalog year, major, minor, concentration, and certificate.
2. Reviewed school profiles that drive Programs-modal school labels, program-category wording, curriculum context, and safe starting state.
3. A source inventory for all intended RBS programs and their policies.
4. A reusable requirement/policy schema gap analysis.
5. A reviewed RBS program-import plan, in small batches with test cases.
6. A Programs selector specification that uses each reviewed school's exact Majors, Minors, Concentrations/Tracks, and Certificates wording.
7. A test matrix for shared requirements, double counts, course alternatives, AP/transfer equivalencies, and standing restrictions.

Only after that milestone should we add SAS or Engineering data. Only after the prerequisite/policy engine is proven across more than one school should we build the automatic four-year planner. AI and accounts should build on those dependable foundations rather than compensate for missing data.

## 12. Definition of success

ScheduleRU succeeds when a student can truthfully say:

> “I can add my academic programs, understand exactly why each requirement is or is not satisfied, compare several realistic plans, build a schedule around my preferences, and know when I need an advisor instead of being misled by the app.”

That standard is more valuable than claiming unsupported coverage quickly.
