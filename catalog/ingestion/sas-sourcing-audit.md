# SAS Program Sourcing Audit

Working audit for the ScheduleRU SAS catalog expansion. This file is a sourcing/review aid, not canonical published catalog data.

## Status meanings

- `REVIEWED_EXISTING` — already present in the reviewed catalog snapshot on the `dev` baseline.
- `DRAFT_UNREVIEWED` — an unreviewed contract-v1 draft exists on `data/program-sourcing`; it still requires local validation, tests, and independent academic review.
- `DRAFT_SOURCE_VERIFIED` — official Rutgers sources have been reconciled and automated source-verification coverage exists; the definition is still unreviewed and non-public.
- `BLOCKED_CONTRACT` — official Rutgers requirements are sufficiently understood, but catalog contract/runtime data cannot represent them faithfully.
- `BLOCKED_DYNAMIC_APPROVAL` — valid completion can depend on adviser/director-approved courses, external study, semantic classifications, or other unbounded choices that cannot be safely frozen into a finite selector.
- `BLOCKED_SOURCE` — current official Rutgers sources conflict, are incomplete, or do not establish the current rule strongly enough.
- `BLOCKED_VERSIONING` — multiple active curricula/catalog cohorts require explicit catalog-year/version treatment.
- `NEEDS_RESEARCH` — not yet classified deeply enough.

## New drafts on data/program-sourcing

| Program | Code | Status | Draft |
|---|---:|---|---|
| Africana Studies minor | 014 | DRAFT_UNREVIEWED | `catalog/drafts/sasnb-africana-studies-minor.v1.json` |
| Anthropology — General minor | 070 | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-anthropology-general-minor.v1.json` |
| Anthropology — Cultural minor | 070C | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-anthropology-cultural-minor.v1.json` |
| Anthropology — Evolutionary minor | 071 | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-anthropology-evolutionary-minor.v1.json` |
| Arabic minor | 013 | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-arabic-minor.v1.json` |
| Chemistry Education minor | — | DRAFT_UNREVIEWED | `catalog/drafts/sasnb-chemistry-education-minor.v1.json` |
| Chinese major | 165 | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-chinese-major.v1.json` |
| Chinese minor | 165 | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-chinese-minor.v1.json` |
| Classics — Greek major | — | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-classics-greek-major.v1.json` |
| Classics — Greek and Latin major | — | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-classics-greek-latin-major.v1.json` |
| Classics — Latin major | — | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-classics-latin-major.v1.json` |
| Comparative Literature minor | — | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-comparative-literature-minor.v1.json` |
| Creative Writing minor | 351 | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-creative-writing-minor.v1.json` |
| Hindi minor | 013 | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-hindi-minor.v1.json` |
| History — STEM in Society minor | 519 | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-history-stem-society-minor.v1.json` |
| Japanese major | 565 | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-japanese-major.v1.json` |
| Japanese minor | 565 | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-japanese-minor.v1.json` |
| Korean major | 574 | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-korean-major.v1.json` |
| Korean minor | 574 | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-korean-minor.v1.json` |
| Language and Culture of Ancient Israel minor | 583 | DRAFT_UNREVIEWED | `catalog/drafts/sasnb-language-culture-ancient-israel-minor.v1.json` |
| Latino and Caribbean Studies minor | 595 | DRAFT_UNREVIEWED | `catalog/drafts/sasnb-latino-caribbean-studies-minor.v1.json` |
| Military Science — Aerospace Science track minor | 693N | DRAFT_UNREVIEWED | `catalog/drafts/sasnb-military-science-aerospace-minor.v1.json` |
| Sexualities Studies minor | — | DRAFT_UNREVIEWED | `catalog/drafts/sasnb-sexualities-studies-minor.v1.json` |
| Statistics/Mathematics major | 961 | DRAFT_UNREVIEWED | `catalog/drafts/sasnb-statistics-mathematics-major.v1.json` |

## Defined blockers discovered so far

| Program | Status | Exact blocker / review issue |
|---|---|---|
| Actuarial Mathematics major (640L) | BLOCKED_CONTRACT | Rutgers permits a passed Society of Actuaries FM exam to excuse 01:640:285. Contract v1 has no executable external-credential substitution path. |
| African Languages minor | BLOCKED_SOURCE | Current AMESALL page includes Yoruba and a two-300-level-language-course pathway, while the current public course inventory does not expose a complete matching sequence for every listed language. |
| American Studies | BLOCKED_SOURCE | Current live requirements contain conflicting wording about whether outside-department courses may satisfy the program; additional dynamic approval rules also appear. |
| Anthropology minor(s) | DRAFT_SOURCE_VERIFIED | Current department pages now separately establish General at 19 credits, Cultural at 18 credits, and Evolutionary at 20 credits; schema-valid source-verified drafts preserve each structure. Runtime support for their grade/grading-basis conditions remains a publication gate. |
| Archaeology minor | BLOCKED_DYNAMIC_APPROVAL | Practicum may be an approved non-Rutgers field school, internship, or other approved advanced/graduate hands-on course, not a finite static Rutgers course set. |
| Architectural Studies minor | BLOCKED_DYNAMIC_APPROVAL | Current department overview and catalog agree that the minor requires three electives, resolving the numeric conflict. The live elective page permits petitions, study abroad, outside-university courses, and internships, leaving a genuine dynamic-approval boundary. |
| Asian American Studies | BLOCKED_DYNAMIC_APPROVAL | Approved elective list is updated yearly and the public requirements page does not expose a stable complete current pool. |
| Asian Studies | BLOCKED_DYNAMIC_APPROVAL | Requirements rely on semantically defined/approved Asian Studies courses across departments without a complete bounded current public pool. |
| Astrobiology minor | BLOCKED_CONTRACT | Rutgers prohibits reuse of a course between the student's major and this minor; contract v1 lacks cross-program exclusive allocation. |
| Biological Sciences | BLOCKED_CONTRACT | Requirements contain major/minor overlap limits, non-reusable substitutions, approved life-science elective sets, and adviser-approved substitutions that cannot be faithfully encoded by v1. |
| Biomathematics | BLOCKED_SOURCE | Current Mathematics page itself warns that its convenient requirements summary may not reflect current Degree Navigator requirements. |
| Business & Technical Writing minor | BLOCKED_CONTRACT | A course may satisfy only one of five skill areas and at least 12/18 credits must be Writing Program credits. Runtime allocation exists, but contract v1 cannot declare allocation families/exclusive use. |
| Cell Biology & Neuroscience | BLOCKED_DYNAMIC_APPROVAL | Additional lecture/lab courses may be accepted by individual adviser approval beyond the preapproved lists. |
| Chinese major | DRAFT_SOURCE_VERIFIED | Current ALC titles and descriptions explicitly classify 165:321/322 and 165:419/420 as Classical Chinese; the complete major structure is preserved in a schema-valid draft. |
| Cinema Studies | BLOCKED_DYNAMIC_APPROVAL | Elective pool changes by preregistration cycle; five courses must be outside the major and production-course use is capped. |
| Cognitive Science minor | BLOCKED_CONTRACT | Same course cannot satisfy both formal/analytic and elective buckets, with additional department distribution caps; exclusive allocation is not exposed by contract v1. |
| Critical Intelligence Studies | BLOCKED_CONTRACT | Track curricula include overlap limits with Political Science major/minor that require cross-program allocation. |
| Data Science | BLOCKED_CONTRACT | At least one current track expressly forbids required track courses from simultaneously satisfying the domain-course requirement; v1 cannot encode exclusive allocation. |
| Earth & Planetary Sciences — General B.A. | BLOCKED_DYNAMIC_APPROVAL | Valid electives/field methods can include director-approved courses/equivalents outside a fixed list. |
| Earth & Planetary Sciences — Environmental Geology B.S. | BLOCKED_DYNAMIC_APPROVAL | Field geology may be an external/equivalent approved field camp and other approvals are not a finite selector. |
| Earth & Planetary Sciences — Geological Sciences B.S. | BLOCKED_DYNAMIC_APPROVAL | External field geology and director-approved non-460 electives are valid completion paths. |
| English minor | BLOCKED_SOURCE | Current requirement uses a historically designated 300/400-level literature category without publishing the complete current designation set on the public page. |
| Environmental Studies minor | BLOCKED_CONTRACT | Rutgers states no course may be used to satisfy more than one degree requirement; cross-program exclusive allocation is unavailable in contract v1. |
| European Studies | BLOCKED_SOURCE | Current center page says 15 credits while its listed requirements sum to 18; catalog materials indicate 18. |
| Exercise Science | BLOCKED_VERSIONING | Rutgers is transitioning to a Fall 2026 curriculum while already-declared students remain on prior Degree Navigator curricula. One timeless definition would be wrong. |
| French minor | BLOCKED_CONTRACT | Requirements cap English-taught courses and require courses taught in French; language of instruction is not represented by v1 selectors. |
| Geography | BLOCKED_DYNAMIC_APPROVAL | Independent study/honors and similar courses can be assigned to different tracks based on content/director approval. |
| Global Humanities | BLOCKED_DYNAMIC_APPROVAL | Study abroad/other Rutgers courses with significant AMESALL regional content may count; the valid set is semantic and approval-based. |
| Global Medieval Studies | BLOCKED_DYNAMIC_APPROVAL | Approved cognates and seminar substitutions are not a stable finite public course set, with additional outside-discipline distribution rules. |
| Health & Society | BLOCKED_CONTRACT | Elective overlap with the major and department-level distribution caps require cross-program/course allocation. |
| History major | BLOCKED_DYNAMIC_APPROVAL | Degree Navigator categories, selected 506 courses, historical-period designations, residency, and overlap constraints are not fully represented by a stable finite public list. |
| Holocaust Studies minor | BLOCKED_DYNAMIC_APPROVAL | Approved independent study, internship, honors, transfer, and cross-department courses make the valid elective universe dynamic. |
| Hungarian minor (535) | BLOCKED_SOURCE | SAS currently lists the minor, while the current REELL page says Rutgers no longer offers in-person Hungarian and frames BTAA Hungarian within Slavic & East European Studies; current completion path for 535 needs clarification. |
| Individualized Major (555) | BLOCKED_DYNAMIC_APPROVAL | Program is intentionally student-specific: bespoke faculty-sponsored plan, 36+ credits, level/distribution rules, and individualized capstone. It is not a static program curriculum. |
| International & Global Studies minor | BLOCKED_DYNAMIC_APPROVAL | Region/language mappings and detailed approved course lists depend on Degree Navigator/dynamic classifications. |
| Italian minor | BLOCKED_DYNAMIC_APPROVAL | Cross-department Italian Studies courses and placement-dependent/director-approved replacement courses are valid paths. |
| Jewish Studies | BLOCKED_CONTRACT | Max-two-course double-count rule with another major/minor requires cross-program allocation. |
| Law & History | BLOCKED_DYNAMIC_APPROVAL | Anchor course may be replaced by a suitable director-approved alternative; outside-department law-related course choices are not fully bounded. |
| Linguistics | BLOCKED_CONTRACT | A theoretical-subfield course not used toward that requirement may be used as an elective, requiring deterministic course allocation between groups. |
| Mathematics — Honors B.S. | REVIEW_EXISTING_NOTE | Existing reviewed definition has a repeated-course/seminar issue around a second 640:492 term because the planner represents a repeated course code once; existing data sends this to adviser confirmation. |
| Middle Eastern Studies | BLOCKED_DYNAMIC_APPROVAL | Seminar/literature substitutions, multilingual paths, and relevant outside electives may be director-approved beyond a finite set. |
| Modern Greek minor | BLOCKED_SOURCE | Current site confirms program/course pool but does not publish current distribution requirements; old 2005-07 catalog rules are too stale to import. |
| Modern Hebrew minor | BLOCKED_SOURCE | Current language page describes six semesters, but placement/review can alter sequence and a current minor-specific deterministic requirement page has not been located. |
| Molecular Biology & Biochemistry | BLOCKED_CONTRACT | Elective count changes as a function of research credits (6-11 versus 12+) and special-permission research choices; current JSON/evaluator cannot encode the dependency faithfully. |
| Military Science — Non-Commissioning track | BLOCKED_CONTRACT | Rutgers forbids using the same course for both the military-history requirement and the leadership-course bucket; contract v1 lacks exclusive allocation metadata. |
| Organizational Leadership | BLOCKED_SOURCE | Live required-course structure totals 18-19 credits while another live program page says 20-21, indicating conflicting curriculum generations. |
| Persian minor | BLOCKED_SOURCE | Current minor offers a pathway requiring two 300-level Persian language courses, but current public inventory exposes only one obvious 300-level advanced Persian course. |
| Political Science major | BLOCKED_DYNAMIC_APPROVAL | Four 300/400-level area requirements depend on Degree Navigator/category labels not completely mapped on the public program page. |
| Portuguese minor | BLOCKED_CONTRACT | Requirements depend on language of instruction and literature classification; current selectors cannot encode those attributes safely without a canonical finite classification dataset. |
| Psychology major | BLOCKED_CONTRACT | Rutgers requires separate courses from four core clusters, while at least one course appears in multiple clusters; v1 cannot declare exclusive allocation between clusters. |
| Religion major | BLOCKED_DYNAMIC_APPROVAL | Case-by-case cognates and transfer courses are valid paths beyond the finite subject-840 course universe. |
| Russian minor (860 tracks) | NEEDS_RESEARCH | Rutgers exposes three minor tracks under one program code. Academic rules can be sourced, but ScheduleRU picker/program-identity behavior for multiple curricular options sharing one SAS code should be confirmed before creating three program IDs. |
| Slavic & East European Studies minor | BLOCKED_DYNAMIC_APPROVAL | BTAA/study-abroad language study and approved interdisciplinary electives require special arrangements and a dynamic course universe. |
| Social Justice minor | BLOCKED_DYNAMIC_APPROVAL | Approved elective list and learning-goal qualification are dynamic, with overlap constraints. |
| South Asian Studies minor | BLOCKED_DYNAMIC_APPROVAL | Study-abroad approvals, discipline caps, and cross-listed courses assignable to different disciplines make the current rule set allocation/approval dependent. |
| Spanish minor | BLOCKED_CONTRACT | Language-of-instruction, placement/residency, and upper-level requirements cannot be represented faithfully with the current selector attributes alone. |
| Sport Management minor | BLOCKED_SOURCE | Current minor page provides a 955 elective set but also allows unspecified 377 courses “if needed”; the exact current minor-specific 377 pool is not identified there. |
| STEM in Society minor | DRAFT_SOURCE_VERIFIED | The 2025-2026 official catalog specifies six 3-credit courses from the listed pool; the current department page supplies the current 33-course classification. |
| Translation Studies minor | BLOCKED_DYNAMIC_APPROVAL | Participating-department electives, advanced language study/proficiency, department caps, and overlap rules rely on dynamic approved classifications. |
| Turkish minor | BLOCKED_SOURCE | Current minor offers a two-300-level-language-course path while current public inventory exposes only one obvious 300-level advanced Turkish course. |

## Generic infrastructure blocker to hand off

The requirement runtime already contains allocation-family logic (`allocation_family`, `max_uses`) for deterministic exclusive course use, but program-definition contract v1 does not expose that metadata. A program-neutral contract extension for reviewed allocation constraints would unlock a substantial set of SAS programs without program-specific code.

## Validation boundary

None of the new drafts in this branch should be promoted to `reviewed` until they are run through the repository's catalog validator and full baseline verification in a coding workspace (`npm test`, `npm run typecheck`, `git diff --check`) and then independently reviewed against the cited Rutgers sources.
