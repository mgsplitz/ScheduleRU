# SAS Pilot Design

**Date:** 2026-07-19  
**Status:** Approved scope; implementation plan pending review  
**Scope:** Rutgers–New Brunswick only. This is a source-reviewed pilot for the School of Arts and Sciences (SAS), not a bulk SAS import.

## Purpose

ScheduleRU needs one real SAS path before it can responsibly offer SAS in the Programs modal. The pilot will validate the shared Rutgers–New Brunswick Core, SAS-specific completion rules, complex requirement constraints, and a cross-school outcome without copying RBS behavior or pretending that a partial course list is a degree audit.

The pilot programs are:

- Political Science B.A. (official program code 790).
- Philosophy, Politics, and Economics (PPE) minor (official program code 792).
- One RBS-plus-SAS selection scenario shown as requiring advisor confirmation unless a program-specific official policy permits a stronger result.

## Public-source boundary

Every selectable program, requirement group, selector, restriction, and policy must carry a current public Rutgers–New Brunswick source URL, review status, and catalog-year boundary. Degree Navigator and scraped catalog prose may inform a review, but neither becomes an automatic rule by itself.

Primary public sources for the pilot:

- Political Science: https://newbrunswick-undergrad-25-26.catalogs.rutgers.edu/pages/ynUq3QFcA7oYr9vlEryG and https://polisci.rutgers.edu/academics/undergraduate/major-in-political-science
- PPE: https://philosophy.rutgers.edu/minor-in-philosophy-politics-and-economics and https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/1746-philosophy-politics-and-economics-ppe
- SAS degree and combination rules: https://sasundergrad.rutgers.edu/majors-and-core-curriculum/degree-requirements, https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/completion-of-a-major-and-a-minor, and https://www.sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-restrictions

## Product behavior

### School and program selection

The existing Programs modal stays a single interface. Once the pilot passes its checks, it adds the reviewed SAS school profile using SAS terminology: Majors and Minors. It does not create a separate SAS page and does not expose an unreviewed concentration, track, or certificate.

The canonical `rutgers-nb-core-curriculum` module is attached to SAS only after its source/curriculum-year compatibility is explicitly reviewed. RBS retains its existing reviewed attachment.

### Requirement evaluation

The pilot must represent the actual rule shape, not flatten it into a misleading list:

- Political Science must support named core/research/seminar requirements, reviewed area membership, elective-credit totals, upper-level-credit minimums, and published caps.
- PPE must support its three departmental components, required economics introductions, Philosophy-level distribution, one-course-only cross-list treatment, and per-field course counts.
- When ScheduleRU cannot verify a grade, transfer, residency, or an incompletely published category, it shows a short advising/review notice and leaves the outcome incomplete. It never silently completes the group.
- A scheduled or completed course is automatically considered for every compatible reviewed group; users never need to select it through a particular browse button first.

### Combination outcomes

The published Political Science-to-PPE overlap permission is stored as a specific reviewed policy, not inferred from a general SAS statement. Named SAS incompatible major/minor pairs are separate reviewed policy records.

The initial RBS-plus-SAS scenario is selectable only with a concise advisor-confirmation notice. It is not presented as an automatic approval, transfer requirement, or double-count promise until a source names the precise combination.

## Data and implementation boundaries

1. Extend the rule engine only for reusable rule types required by this pilot: reviewed category membership, credit/level caps, mutually exclusive cross-listed credit, and advisory-only grade/residency checks.
2. Store school profile, program, requirement, selector, and policy facts in existing reviewed D1 structures. No frontend-only SAS exceptions.
3. Add pure comparison fixtures before any SAS record is made visible.
4. Keep all changes on development until the full regression suite and source comparisons pass. Production is unchanged without explicit approval.
5. Do not add accounts, automatic eight-semester scheduling, course recommendations, or other schools in this pilot.

## Comparison cases

The pilot is not visible until these scenarios pass:

1. A Political Science student meets each named Political Science foundation/research/seminar requirement with reviewed courses and must still meet upper-level/elective-credit limits.
2. An ineligible lower-level, mini-course, internship, independent-study, thesis, or non-New-Brunswick entry cannot silently satisfy a capped requirement.
3. A PPE student needs all three components, cannot reuse a cross-listed course twice, and cannot bypass the required economics introductions.
4. A scheduled or completed matching course applies automatically to its reviewed group.
5. A Political Science major plus PPE minor receives the specific reviewed overlap outcome.
6. A same-program or named prohibited SAS major/minor pair is blocked with an explanation and source.
7. A second SAS major activates the minor-waiver result only when the school-level rule and exception are present.
8. The reviewed RBS-plus-SAS scenario remains an advisor-confirmation notice, not a false approval.
9. Existing RBS selections, Core allocation, wishlist, persistence, and term-aware eligibility tests remain unchanged.

## Acceptance criteria

- SAS appears in Programs only after all pilot comparison cases and source reviews pass.
- Each student-facing restriction has concise wording, an official source link, and no raw catalog-text wall.
- Unreviewed or malformed data fails closed and is not shown as a completed degree rule.
- The pilot uses no Newark or Camden course/policy data.
- Development deployment succeeds while retaining existing secrets; no production service or database changes occur.

## Explicit non-goals

- Importing every SAS major, minor, concentration, or certificate.
- Certifying official graduation, admission, transfer, or registration eligibility.
- Treating unknown cross-school policies as allowed or disallowed.
- Creating an auto-scheduler or user accounts.
