# ScheduleRU Hackathon Release Design

**Date:** July 21, 2026  
**Status:** Approved design, pending written-spec review  
**Target branch flow:** feature work → `dev` → `main` only after explicit user approval

## 1. Outcome

The hackathon release turns ScheduleRU into a polished, local-first Rutgers–New Brunswick planning experience with four connected capabilities:

1. A guided guest onboarding flow with manual academic-history entry.
2. A deterministic eight-semester course planner with locks and unresolved-requirement placeholders.
3. An active-term section scheduler with a natural-language preference assistant that only ranks verified schedule permutations.
4. A coherent desktop interface with program-specific requirement navigation, centralized issues, reliable program selection, and a credible public repository.

The release prioritizes a trustworthy end-to-end demonstration over complete Rutgers program coverage. Additional reviewed SAS programs are a final, lower-priority track.

## 2. Product constraints

- The product remains guest-only. Student state stays in versioned browser storage.
- The primary supported experience is desktop. A mobile/tablet redesign is outside this release.
- The product is a planning assistant, not an official degree audit.
- Academic rules, prerequisite decisions, schedule conflicts, and requirement allocation remain deterministic and source-backed.
- The language model may translate natural-language schedule preferences into a structured schema. It may not invent courses, sections, eligibility, requirements, or schedule indices.
- Existing manually placed courses are preserved and locked during automatic plan generation unless the user explicitly unlocks them.
- Future semester plans contain courses and requirement placeholders, not invented section meeting times.
- The section-level `+ Build schedule` action appears only for the active registration term.
- `main` and production remain untouched until the user explicitly approves them.
- All implementation agents use GPT-5.6 Terra. The coordinating Sol agent does not write implementation code.

## 3. Architecture

The existing static frontend and Cloudflare Worker remain the delivery platform. The release avoids a framework rewrite. Instead, new deterministic behavior is extracted into small, testable JavaScript modules while `index.html` remains the integration shell.

Four implementation tracks share explicit contracts:

1. **Planner state and onboarding** owns storage migrations, academic position, AP/completed/transfer records, home school, primary/secondary program roles, and first-run progress.
2. **Four-year planning engine** consumes normalized requirements, academic history, eligibility rules, program policies, locks, and workload limits; it returns a preview plan, placeholders, assumptions, and issues.
3. **Section preference engine and assistant** owns stable schedule identities, deterministic filtering/ranking, accumulated preference state, assistant requests, and concise tradeoff responses.
4. **UI shell and repository completion** owns the header, dialogs, program subtabs, issues presentation, visual cleanup, accessibility improvements, README, and repository hygiene.

The Worker gains only the server-side model adapter and any small read-only planning contracts needed to protect the API key. Four-year plan generation and section ranking remain deterministic and testable without a model call.

## 4. Versioned local state

The browser-state schema is incremented without discarding existing saved work. Migration preserves all current scheduled courses, AP selections, requirement choices, wishlist entries, selected programs, and home-school data.

New state includes:

- onboarding completion and current step;
- academic position: current year and starting semester;
- manual AP records: exam, score, reviewed equivalency result, and applied-credit status;
- manual completed-course records: course code, title, credits, grade, completed term, and Rutgers/transfer origin;
- primary and secondary program roles;
- per-course placement locks;
- generated-plan preview separate from the accepted plan;
- per-term schedule preferences and conversation history;
- stable active-term schedule result identities;
- dismissed informational issues where dismissal is safe.

State updates that replace school/program context or accept a generated plan are transactional: validation and loading complete before the previous accepted state is replaced.

## 5. Guest onboarding

First-time visitors see a full-page guided flow:

1. **Welcome:** ScheduleRU identity and `Continue as guest`.
2. **Academic position:** current year and starting semester.
3. **AP credit:** manual exam and score entry, with skip support.
4. **Completed coursework:** manual Rutgers or transfer course entry, with skip support.
5. **Programs:** explicit home-school selection, one primary major, an optional secondary major, and policy-permitted minors/concentrations.
6. **Review:** concise summary of school, programs, AP awards, and completed coursework.
7. **Feature overview:** four-year planning, active-term schedule building, and schedule preferences, followed by `Start planning`.

Users may move backward, skip optional academic-history steps, and restart onboarding later without erasing their accepted plan.

AP behavior is explicit:

- Scores of 4 and 5 apply a reviewed equivalency when ScheduleRU has one.
- Lower scores may be recorded but are visibly marked as not applied for credit.
- The interface states that exact credit depends on the exam’s reviewed equivalency.
- File/PDF/image parsing is deferred; the flow does not imply that uploads are currently processed.

## 6. Program selection and requirement navigation

The top header displays only:

`Rutgers | [Home School]`

It does not display selected-program names or the phrase `Degree Navigator`.

The Programs dialog is solely for selecting and assigning programs. The first selected major becomes primary by default, and the user may change primary/secondary roles later without deleting program data. The explicit home school remains unchanged when a cross-school secondary program is selected.

Applying programs is a single deliberate flow:

- If validation succeeds without warnings, one click accepts the draft.
- If reviewed policies produce warnings, one click opens an explicit confirmation dialog with `Apply anyway` and `Go back`.
- Blocking policy failures remain blocking.
- A failed load leaves the previous accepted program state intact.

Within the Required pane, a smaller second row of subtabs filters requirements by selected program:

- primary major first;
- secondary major second;
- minors/concentrations afterward;
- minors use lower visual emphasis while remaining legible and accessible.

Core and Wishlist remain top-level siblings of Required. Changing the visible requirement subtab never changes the selected program set.

## 7. Four-year automatic planner

### Inputs

The deterministic planner consumes:

- eight Fall/Spring plan terms beginning at the user’s academic position;
- selected reviewed program requirement trees;
- selected and unresolved Rutgers Core requirements;
- completed, AP, and transfer records;
- existing planned placements and locks;
- reviewed prerequisite and eligibility rules;
- requirement allocation and double-count policies;
- a target workload of 14–16 credits and a hard automatic maximum of 18 credits;
- deterministic tie-break rules.

### Generation behavior

Generation begins with a confirmation surface that states: `Courses already placed will stay where you put them.` Existing placements are locked by default.

The engine then:

1. Removes requirements already satisfied by completed/AP/transfer records.
2. Preserves locked placements and validates them without silently moving them.
3. Builds prerequisite-safe ordering for reviewed rules.
4. Places required sequences before flexible requirements.
5. Balances credits toward 14–16 per term, using 17–18 only when needed.
6. Adds descriptive placeholders for unresolved Core areas, electives, or incomplete requirement choices.
7. Produces issues and assumptions alongside the proposed plan.

A placeholder contains a stable identifier, source program or Core module, requirement-group identifier, human label, estimated credits, and candidate-selection context. A placeholder is not a fake course and does not satisfy prerequisites.

If all work cannot fit into eight terms, the engine returns the best valid partial plan. It never overfills a term or violates a reviewed prerequisite merely to appear complete. The preview explains what did not fit and why.

The generated plan is a preview. `Use this plan` is the only action that replaces the accepted plan. Regeneration never destroys the current plan automatically.

### Incomplete Core warning

When Core choices remain unresolved, clicking Generate opens a warning stating that accuracy improves when Core choices are completed. The primary action is `I understand`; the secondary action is `Go back`. Continuing produces typed Core placeholders.

## 8. Active-term section scheduler

Only the active registration term exposes `+ Build schedule`. The active year/term comes from backend configuration rather than frontend constants.

The section scheduler:

- loads sections only for that active term;
- excludes closed sections by default;
- provides an `Include closed sections` toggle;
- generates conflict-free permutations with stable identities;
- keeps the original stable index when results are filtered or ranked;
- shows no more than 500 permutations;
- permits direct numeric navigation.

The counter reads `Schedule [editable index] of [total]`. Clicking the index changes it into a bounded numeric input. Enter navigates, Escape cancels, and invalid values produce a concise inline error. Suggested schedule numbers are buttons that navigate directly to those stable results.

## 9. Schedule preference assistant

A small persistent `Schedule assistant` control sits near the schedule navigator and opens a right-side drawer without obscuring the calendar.

The initial message gives concrete examples of useful preferences. Conversation state is local and scoped to the active term. New preferences accumulate until the user changes, undoes, or clears them.

The deterministic preference schema supports:

- earliest/latest start and end times;
- requested or avoided days;
- minimum/maximum classes on a day;
- light-day preferences;
- one or more requested time-window exceptions;
- campus, modality, open-section, gap, and compactness preferences where meeting data supports them;
- hard versus soft strength;
- explicit priority ordering when the user states it.

The Worker model adapter receives the user’s preference conversation plus normalized schedule facts. It returns validated structured preferences and concise response intent. It does not receive transcript grades or AP history, and the API key stays in a Cloudflare secret.

Deterministic code applies the structured result. Successful responses recommend at most three stable indices, such as `Try #10, #15, or #19.` If no schedule satisfies all hard constraints, the response names the conflicting constraint, offers the closest verified tradeoffs, and asks which preference matters most. The assistant does not produce unverified free-form schedule claims.

## 10. Visual system and issue handling

The desktop visual direction combines Rutgers identity with a softer student-product treatment:

- Rutgers scarlet and charcoal remain anchors;
- warm neutral backgrounds replace harsh white expanses;
- spacing, card radius, and restrained elevation create hierarchy;
- typography remains practical and readable rather than decorative;
- red is reserved for identity, primary actions, and genuine errors;
- requirement-group headings use consistent sentence-style labels rather than oversized all-caps red banners.

Planning messages are centralized:

- `Issues · N` appears near the requirement/program navigation when actionable issues exist.
- Its dialog groups blocking errors, planning warnings, and advising information.
- Immediate action failures remain next to the failed action.
- Repeated policy caveats move out of the scrolling requirement list.
- A short persistent disclaimer states that ScheduleRU is a planning aid and not an official degree audit.

Dialogs gain consistent semantics, focus handling, Escape/backdrop behavior, and clear primary/secondary actions. Existing native `alert()` and `confirm()` usage in the affected flows is removed.

## 11. Data and repository completion

The release does not rewrite applied migration history. Existing reviewed SQL remains as historical migration evidence. New program coverage follows the generic official-source → snapshot → conservative draft → human review → publish pipeline.

Repository cleanup includes:

- replacing the one-line README with a clear product, architecture, local-development, testing, data-integrity, and deployment guide;
- describing how Codex and GPT-5.6 Terra/Sol were used, without implying that AI is an academic authority;
- adding a scoped ignore for generated Wrangler state;
- removing or archiving obsolete handoff/roadmap artifacts only after confirming they contain no unique operational knowledge;
- documenting branch and deployment safety;
- retiring already-merged worktrees/branches only after read-only verification;
- leaving the unmerged SAS discovery fallback isolated until its own verification/integration decision.

Additional SAS selection coverage is last. Popular programs with complete official sources are preferred. Incomplete audits remain hidden.

## 12. Error handling and safety

- Storage migration failures preserve the original serialized state and offer a reset/export path.
- Program changes are transactional and roll back on API failure.
- Planner failures return typed issues rather than partial silent mutations.
- Unsupported or missing academic rules fail closed for automatic claims and remain visible as assumptions/advising issues.
- Assistant output is schema-validated; invalid model output does not alter preferences and receives one bounded retry before a concise failure message.
- Model/network failure leaves deterministic schedule browsing fully usable.
- Admin secrets and the OpenAI key never enter the client bundle, repository, logs, or chat transcript.

## 13. Verification and acceptance

Implementation follows test-first development for each pure module and affected integration seam.

Required automated coverage includes:

- state migration and preservation of existing local plans;
- onboarding navigation, skipping, restart, and summary;
- AP score application and completed/transfer records;
- transactional program application and confirmation warnings;
- program-specific requirement filtering;
- prerequisite-safe generation, locks, deterministic ordering, workload bounds, placeholders, and partial-plan failure;
- active-term selection and removal of the Fall-2026 frontend constant;
- stable section indices, closed-section toggle, numeric navigation, and ranking;
- preference accumulation, undo/clear, hard/soft constraints, impossible requests, and at-most-three recommendations;
- model-schema validation and deterministic fallback;
- centralized issue severity and counts.

Final acceptance requires:

1. The full existing Node suite passes.
2. New focused tests pass.
3. `git diff --check` passes.
4. A desktop browser walkthrough covers the complete guest-to-plan-to-active-schedule workflow.
5. Existing saved planner state survives the release migration.
6. No secret, generated deployment state, or unrelated user file is staged.
7. The user reviews the development result before any merge to `main` or production deployment.

## 14. Implementation sequencing

1. Establish shared state, planner-result, placeholder, issue, stable-schedule, and preference contracts.
2. Run three Terra implementation tracks in parallel: onboarding/state, four-year engine, and section preference engine.
3. Merge contracts and pure engines before integrating UI surfaces.
4. Run a second parallel wave: onboarding/UI shell, planner preview, and assistant Worker/drawer integration.
5. Complete program subtabs, Issues dialog, header, and desktop polish through a single UI integrator to avoid `index.html` conflicts.
6. Run full verification and Terra review.
7. Complete README/repository hygiene.
8. Expand reviewed SAS coverage only after the primary release is stable.

