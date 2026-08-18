# SAS Program Coverage Matrix

Working census for the ScheduleRU School of Arts and Sciences program-sourcing pass. This is a review aid, not canonical catalog data. The current SAS Majors and Minors directory is the program-identity/ownership denominator.

Status meanings:

- `REVIEWED_EXISTING` — already present in the reviewed catalog snapshot at the sourcing branch baseline.
- `DRAFT_UNREVIEWED` — contract-v1 draft exists on `data/program-sourcing`; still requires local validation/tests and independent academic review.
- `DRAFT_SOURCE_VERIFIED` — current official Rutgers sources have been reconciled and the draft is covered by source-verification tests; it remains non-public and still requires independent academic review.
- `DRAFT_PREEXISTING` — unreviewed draft already existed before this sourcing pass.
- `BLOCKED_*` — current Rutgers completion rules cannot yet be represented safely or current sources are not sufficiently authoritative/consistent.
- `JOINT_SCOPE` — joint-school SAS program intentionally surfaced for a separate ownership pass rather than silently omitted.

## Complete SAS census

| SAS program / option | Status | Notes / primary issue |
|---|---|---|
| African Area Studies minor | BLOCKED_DYNAMIC_APPROVAL | Honors/topics, independent study, internships, study abroad, language substitutions, and outside-major distribution require approval/dynamic allocation. |
| African Languages minor | BLOCKED_SOURCE | Current AMESALL language pathways do not reconcile cleanly with the currently published Yoruba/upper-level language inventory. |
| AMESALL Regional major | BLOCKED_DYNAMIC_APPROVAL | Regional literature/sociolinguistics/linguistics credits may include chair-approved courses beyond a finite published set. |
| AMESALL Languages & Literatures minor | BLOCKED_DYNAMIC_APPROVAL | Final upper-level literature/language-related credits may include chair-approved courses beyond a finite published set. |
| Africana Studies major | BLOCKED_DYNAMIC_APPROVAL | Up to two outside-department courses and study-abroad credit may count by chair consultation. |
| Africana Studies minor | DRAFT_UNREVIEWED | `catalog/drafts/sasnb-africana-studies-minor.v1.json` |
| American Studies major | BLOCKED_CONTRACT | Clean departmental core/electives, but double majors have an explicit cross-major overlap limit requiring cross-program allocation. |
| American Studies minor | BLOCKED_SOURCE_AND_DYNAMIC_APPROVAL | Live page conflicts on outside-department eligibility and also relies on Undergraduate Director approval. |
| Anthropology — Cultural major | BLOCKED_CONTRACT_AND_DYNAMIC_APPROVAL | No course may fulfill more than one requirement; approval paths also exist. |
| Anthropology — Cultural minor | DRAFT_SOURCE_VERIFIED | Current department page resolves the total as 18 credits and specifies the introductory, geographic, elective, and upper-level structure. `catalog/drafts/sasnb-anthropology-cultural-minor.v1.json` |
| Anthropology — Evolutionary major | BLOCKED_CONTRACT_AND_DYNAMIC_APPROVAL | No course may fulfill more than one requirement; approved outside courses may count. |
| Anthropology — Evolutionary minor | DRAFT_SOURCE_VERIFIED | Current department page resolves the total as 20 credits and specifies the 11-credit introduction plus 9 elective credits. `catalog/drafts/sasnb-anthropology-evolutionary-minor.v1.json` |
| Anthropology — General major | BLOCKED_CONTRACT_AND_DYNAMIC_APPROVAL | No course may fulfill more than one requirement; approved outside courses may count. |
| Anthropology — General minor | DRAFT_SOURCE_VERIFIED | Current department page resolves the total as 19 credits: 7 introductory credits plus 12-13 approved elective credits, including 6 upper-level credits. `catalog/drafts/sasnb-anthropology-general-minor.v1.json` |
| Arabic minor | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-arabic-minor.v1.json` |
| Archaeology minor | BLOCKED_DYNAMIC_APPROVAL | Practicum can be approved field school, internship, or other hands-on course, including outside Rutgers. |
| Architectural Studies minor | BLOCKED_DYNAMIC_APPROVAL | Current department overview and 2024-2025 catalog agree on three electives, resolving the numeric conflict. The live elective page also permits director-approved petitions, study abroad, outside-university courses, and internships, so the remaining blocker is true dynamic approval. |
| Art History major | BLOCKED_DYNAMIC_CLASSIFICATION_AND_CONTRACT | Degree Navigator chronological/geographic categories, study-abroad approval, and max-two distribution uses per course. |
| Art History minor | REVIEWED_EXISTING | `sasnb-art-history-minor` |
| Asian American Studies minor | BLOCKED_DYNAMIC_APPROVAL | Approved elective set is updated yearly and public page is not a stable exhaustive pool. |
| Asian Studies major | BLOCKED_DYNAMIC_APPROVAL | Interdisciplinary electives are semantically defined/approved rather than a stable finite public pool. |
| Asian Studies minor | BLOCKED_DYNAMIC_APPROVAL | Same dynamic approved-course issue as major. |
| Astrobiology minor | BLOCKED_CONTRACT | Explicit major/minor non-reuse rule requires cross-program exclusive allocation. |
| Astronomy minor | REVIEWED_EXISTING | `sasnb-astronomy-minor` |
| Astrophysics major | BLOCKED_DYNAMIC_APPROVAL | Alternate/AP introductory physics entrants require adviser-planned curricula; upper-level residency rules also apply. |
| Biological Sciences major | BLOCKED_CONTRACT_AND_DYNAMIC_APPROVAL | Overlap limits, approved elective sets and adviser-approved substitutions prevent a complete static tree. |
| Biological Sciences minor | BLOCKED_CONTRACT_AND_DYNAMIC_APPROVAL | Requires non-overlap with major/other minor plus approved life-science choices. |
| Biomathematics major | BLOCKED_SOURCE | Current Math page warns its convenience summary may not match current Degree Navigator requirements. |
| Business & Technical Writing minor | BLOCKED_CONTRACT | One course may satisfy only one of five skill areas; 12/18 credits must be Writing Program credits. Contract v1 lacks allocation metadata. |
| Cell Biology & Neuroscience major | BLOCKED_DYNAMIC_APPROVAL | Additional lecture/lab courses may be accepted by individual adviser approval beyond preapproved lists. |
| Chemistry — Core option B.A. | REVIEWED_EXISTING_WITH_AUDIT_CAVEAT | `sasnb-chemistry-core-ba`; Chemistry states students may design department-approved programs, so existing definition should be reviewed as a standard path rather than necessarily exhaustive. |
| Chemistry — General ACS option | BLOCKED_DYNAMIC_APPROVAL | Chemistry permits department-approved individualized programs beyond named option schedules. |
| Chemistry — Chemical Biology option | BLOCKED_DYNAMIC_APPROVAL | Same department-wide individualized-program policy. |
| Chemistry — Environmental option | BLOCKED_DYNAMIC_APPROVAL | Same department-wide individualized-program policy. |
| Chemistry — Business/Law option | BLOCKED_DYNAMIC_APPROVAL | Same department-wide individualized-program policy. |
| Chemistry — Chemical Physics option | BLOCKED_DYNAMIC_APPROVAL | Same department-wide individualized-program policy. |
| Chemistry — Forensic Chemistry option | BLOCKED_DYNAMIC_APPROVAL | Same department-wide individualized-program policy. |
| Chemistry minor | BLOCKED_SOURCE | Current page omits enumeration of common core; older catalog core cannot safely be spliced into current option tables because course numbering/options changed. |
| Chemistry Education minor | DRAFT_UNREVIEWED | `catalog/drafts/sasnb-chemistry-education-minor.v1.json` |
| Chinese major | DRAFT_SOURCE_VERIFIED | Current ALC course titles/descriptions explicitly classify 165:321/322 as Introduction to Classical Chinese and 165:419/420 as Readings in Classical Chinese Literature, resolving the prior ambiguity. `catalog/drafts/sasnb-chinese-major.v1.json` |
| Chinese minor | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-chinese-minor.v1.json` |
| Cinema Studies major | BLOCKED_DYNAMIC_APPROVAL_AND_CONTRACT | Semester-specific elective flyer, director-approved additional courses, option/production limits. |
| Cinema Studies minor | BLOCKED_DYNAMIC_APPROVAL_AND_CONTRACT | Dynamic elective flyer, five courses outside major, one-production-course cap. |
| Classical Humanities major | BLOCKED_DYNAMIC_APPROVAL | Approved outside-department classical-humanities courses/substitutions make valid set non-static. |
| Classical Humanities minor | REVIEWED_EXISTING | `sasnb-classical-humanities-minor` |
| Classics — Greek and Latin major | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-classics-greek-latin-major.v1.json` |
| Classics — Greek major | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-classics-greek-major.v1.json` |
| Classics — Latin major | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-classics-latin-major.v1.json` |
| Cognitive Science major | BLOCKED_CONTRACT | Distribution courses cannot double-count as track electives; multi-list courses may satisfy only one requirement. |
| Cognitive Science minor | BLOCKED_CONTRACT | Formal/analytic vs elective exclusive-use rules plus department-distribution caps. |
| Comparative and Critical Race and Ethnic Studies (CCRES) minor | BLOCKED_DYNAMIC_APPROVAL_AND_CONTRACT | Yearly approved list, student-requested additions, and cross-major overlap cap. |
| Comparative Literature — Advanced major | BLOCKED_DYNAMIC_APPROVAL | Individualized coherent program approved by Undergraduate Director; checklist determines completion. |
| Comparative Literature major | BLOCKED_DYNAMIC_APPROVAL | Individualized coherent program approved by Undergraduate Director. |
| Comparative Literature minor | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-comparative-literature-minor.v1.json` |
| Computer Science B.A. | REVIEWED_EXISTING | `sasnb-computer-science-ba` |
| Computer Science B.S. | REVIEWED_EXISTING | `sasnb-computer-science-bs` |
| Computer Science minor | REVIEWED_EXISTING | `sasnb-computer-science-minor` |
| Creative Writing minor | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-creative-writing-minor.v1.json` |
| Criminal Justice major | BLOCKED_CONTRACT_AND_DYNAMIC_APPROVAL | Adviser-added thematic courses plus 202:307 method-vs-elective exclusive allocation. |
| Criminology minor | REVIEWED_EXISTING | `sasnb-criminology-minor` |
| Critical Intelligence Studies minor | BLOCKED_CONTRACT | Track curricula include explicit overlap limits with Political Science major/minor. |
| Data Science — Chemical Data track major | BLOCKED_VERSIONING_REVIEW | New Fall 2024 track with Spring/March 2026 capstone/code changes; reconcile latest curriculum sheet/Degree Navigator first. |
| Data Science — Computer Science track major | BLOCKED_VERSIONING_REVIEW | Recent declaration/code/restriction changes require latest curriculum-sheet reconciliation. |
| Data Science — Economics track major | BLOCKED_VERSIONING_REVIEW | Recent declaration/code/restriction changes require latest curriculum-sheet reconciliation. |
| Data Science — Societal Impact track major | BLOCKED_VERSIONING_AND_CONTRACT | Recent curriculum changes plus explicit no-double-use between some track and domain requirements. |
| Data Science — Statistics track major | BLOCKED_VERSIONING_REVIEW | Recent declaration/code/restriction changes require latest curriculum-sheet reconciliation. |
| Data Science minor | BLOCKED_VERSIONING_AND_CONTRACT | Current track-specific rules include exclusive-use/domain logic and recent course-code/curriculum changes. |
| Developmental Psychology minor | REVIEWED_EXISTING | `sasnb-developmental-psychology-minor` |
| Earth & Planetary Sciences — General option B.A. | BLOCKED_DYNAMIC_APPROVAL | Director-approved electives/equivalents and external-valid paths exceed finite static tree. |
| Earth & Planetary Sciences — Environmental Geology option B.S. | BLOCKED_DYNAMIC_APPROVAL | External/equivalent field geology and director-approved choices. |
| Earth & Planetary Sciences — Geological Sciences B.S. | BLOCKED_DYNAMIC_APPROVAL | External field geology/director-approved non-460 electives. |
| Earth & Planetary Sciences — Planetary Science option B.S. | BLOCKED_SOURCE | Current detailed page does not internally reconcile its elective/core listing with stated 63-credit total. |
| Earth & Planetary Sciences / Geological Sciences minor | BLOCKED_DYNAMIC_APPROVAL | Current EPS page explicitly says approved elective list is not exhaustive and inside/outside courses may be director-approved. |
| Economics major | REVIEWED_EXISTING | `sasnb-economics-major` |
| Economics minor | REVIEWED_EXISTING | `sasnb-economics-minor` |
| English major | BLOCKED_CONTRACT_AND_DYNAMIC_CLASSIFICATION | Maintained period/diversity/theory categories plus max-two-requirement course-use rule. |
| English minor | BLOCKED_SOURCE | Historically designated 300/400 literature category is not exposed as a complete current public set. |
| Environmental Studies major | BLOCKED_CONTRACT | 12-credit cross-degree double-count cap plus within-ENVS no-reuse/category allocation. |
| Environmental Studies minor | BLOCKED_CONTRACT | No course may satisfy more than one degree requirement; requires cross-program exclusive allocation. |
| European Studies major | BLOCKED_DYNAMIC_APPROVAL_AND_EXTERNAL_REQUIREMENT | Adviser-developed concentration, substitute core courses, language proficiency and approved European study abroad. |
| European Studies minor | BLOCKED_SOURCE_AND_DYNAMIC_APPROVAL | Current page has credit-total inconsistency and explicitly allows director-designed alternatives. |
| Exercise Science major | BLOCKED_VERSIONING | Active Fall 2026 curriculum transition; already-declared students remain on earlier Degree Navigator versions. |
| French major | BLOCKED_DYNAMIC_APPROVAL_AND_LANGUAGE_CLASSIFICATION | Placement exceptions, approved outside/English electives and interdisciplinary-option cognates. |
| French minor | BLOCKED_CONTRACT_AND_LANGUAGE_CLASSIFICATION | French-vs-English instruction rules cannot be expressed safely with current selectors. |
| Genetics and Genomics major | BLOCKED_DYNAMIC_APPROVAL | Curriculum worksheet, multi-semester/faculty-adviser research, AP/transfer/equivalent routes. |
| Geography major | BLOCKED_DYNAMIC_APPROVAL | Internship/problems/honors courses may be assigned to tracks based on content by director. |
| Geography minor | BLOCKED_DYNAMIC_APPROVAL | Same content-dependent track assignment issue. |
| German major | BLOCKED_DYNAMIC_APPROVAL | Director-selected concentration/study-abroad allocation and language-of-instruction requirements. |
| German minor | BLOCKED_DYNAMIC_APPROVAL | Department-approved thematic concentration and study-abroad assignment. |
| Global Humanities major | BLOCKED_DYNAMIC_APPROVAL | Study abroad/other Rutgers courses with significant AMESALL regional content may count by approval. |
| Government and Business minor | REVIEWED_EXISTING | `sasnb-government-business-minor` |
| Greek — Ancient minor | REVIEWED_EXISTING | `sasnb-ancient-greek-minor` |
| Greek — Modern minor | BLOCKED_SOURCE | Current site confirms program/course pool but not complete current distribution requirements; old catalog too stale. |
| Health and Society minor | BLOCKED_CONTRACT | Elective overlap with major and department-level distribution caps require allocation. |
| Hindi minor | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-hindi-minor.v1.json` |
| History — Ancient History and Classics major | BLOCKED_DYNAMIC_APPROVAL | Adviser substitutions, language/AP choices and topic-dependent seminars. |
| History — Law and History minor | BLOCKED_DYNAMIC_APPROVAL | Anchor can be director-approved alternative; outside law-related course pool is not fully bounded. |
| History — STEM in Society minor | DRAFT_SOURCE_VERIFIED | The current 2025-2026 catalog specifies six 3-credit courses from the listed pool, resolving the live page's introductory “including” wording. `catalog/drafts/sasnb-history-stem-society-minor.v1.json` |
| History major | BLOCKED_DYNAMIC_CLASSIFICATION | Selected 506/global-history, pre-1500 classifications, residency and overlap rules depend on maintained categories/advising. |
| History minor | REVIEWED_EXISTING | `sasnb-history-minor` |
| History/French major | BLOCKED_DYNAMIC_APPROVAL | Joint program requires advising/program approval and supports approved alternatives. |
| History/Political Science joint major | BLOCKED_DYNAMIC_CLASSIFICATION | History side inherits selected 506/508 and pre-1500 maintained classification issues. |
| Holocaust Studies minor | BLOCKED_DYNAMIC_APPROVAL | Independent study, internship, honors, transfer and cross-department courses may count by approval. |
| Hungarian minor | BLOCKED_SOURCE | SAS lists 535, while current REELL says no in-person Hungarian and points to BTAA Slavic/EE pathways; current completion path needs clarification. |
| Individualized Major | BLOCKED_DYNAMIC_APPROVAL | Intentionally bespoke faculty-sponsored program; no static curriculum exists. |
| International and Global Studies minor | BLOCKED_DYNAMIC_CLASSIFICATION | Region/language mappings and approved course sets depend on Degree Navigator/dynamic classifications. |
| Italian major | BLOCKED_DYNAMIC_APPROVAL_AND_LANGUAGE_CLASSIFICATION | Placement replacements, cross-department Italian Studies, instruction-language rules and UGD approval. |
| Italian minor | BLOCKED_DYNAMIC_APPROVAL_AND_LANGUAGE_CLASSIFICATION | Placement-dependent replacements and approved Italian Studies cognates. |
| Japanese major | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-japanese-major.v1.json` |
| Japanese minor | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-japanese-minor.v1.json` |
| Jewish Studies — Advanced Language major | BLOCKED_DYNAMIC_APPROVAL_AND_EXTERNAL_CREDENTIAL | Dynamic electives plus equivalent Hebrew/Yiddish options including outside institutions. |
| Jewish Studies major | BLOCKED_DYNAMIC_CLASSIFICATION_AND_CONTRACT | Premodern/modern classifications, irregular seminar fulfillment and double-count/transfer rules. |
| Jewish Studies minor | BLOCKED_CONTRACT | Max-two-course double count with another major/minor requires cross-program allocation. |
| Korean major | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-korean-major.v1.json` |
| Korean minor | DRAFT_SOURCE_VERIFIED | `catalog/drafts/sasnb-korean-minor.v1.json` |
| Language and Culture of Ancient Israel minor | DRAFT_UNREVIEWED | `catalog/drafts/sasnb-language-culture-ancient-israel-minor.v1.json` |
| Latin minor | REVIEWED_EXISTING | `sasnb-latin-minor` |
| Latin American Studies major | BLOCKED_DYNAMIC_APPROVAL | Electives defined by Latin American focus and program approval; language proficiency. |
| Latin American Studies minor | BLOCKED_DYNAMIC_APPROVAL | Replacement allowances are common; semantic focus electives/language proficiency prevent fixed exhaustive tree. |
| Latino and Caribbean Studies major | BLOCKED_DYNAMIC_APPROVAL | Alternate capstone, outside Rutgers-department electives and Spanish course may count by director approval. |
| Latino and Caribbean Studies minor | DRAFT_UNREVIEWED | `catalog/drafts/sasnb-latino-caribbean-studies-minor.v1.json` |
| Linguistics major | BLOCKED_CONTRACT_AND_DYNAMIC_APPROVAL | Unused primary electives may shift to another bucket; outside/200-level caps and approvals require deterministic allocation. |
| Linguistics minor | BLOCKED_CONTRACT | Theoretical course may count as elective only if not used in theory requirement; requires allocation. |
| Mathematics — Actuarial major | BLOCKED_CONTRACT | Passed Society of Actuaries FM exam may excuse 640:285; no external-credential substitution path in v1. |
| Mathematics B.A. | REVIEWED_EXISTING | `sasnb-mathematics-ba` |
| Mathematics B.S. / Honors Track | REVIEWED_EXISTING_WITH_AUDIT_CAVEAT | `sasnb-mathematics-honors-bs`; repeated 640:492 seminar term currently falls to adviser confirmation. |
| Mathematics minor | REVIEWED_EXISTING | `sasnb-mathematics-minor` |
| Medieval Studies major | BLOCKED_DYNAMIC_APPROVAL_AND_EXTERNAL_CREDENTIAL | Language via proficiency/test/coursework, substitute 400-level seminars, approved cognates. |
| Medieval Studies minor | BLOCKED_CONTRACT_AND_DYNAMIC_APPROVAL | Approved cognates plus outside-major and cross-discipline distribution rules. |
| Middle Eastern Studies major | BLOCKED_DYNAMIC_APPROVAL_AND_EXTERNAL_CREDENTIAL | Substitute seminars, other-discipline courses, less-common languages, placement reductions and internship credit. |
| Middle Eastern Studies minor | BLOCKED_DYNAMIC_APPROVAL_AND_EXTERNAL_CREDENTIAL | Same approval/placement/internship model as major. |
| Military Science — Army Commissioning track | BLOCKED_DYNAMIC_APPROVAL | Eight-course Army sequence is public, but required military history may use Professor-approved substitute; commissioning eligibility external. |
| Military Science — Naval Science track | BLOCKED_PROGRAM_EXTERNAL_REQUIREMENTS | NROTC option-specific science/writing/history/cultural and eligibility requirements are intertwined with commissioning status. |
| Military Science — Aerospace Science track | DRAFT_UNREVIEWED | `catalog/drafts/sasnb-military-science-aerospace-minor.v1.json` |
| Military Science — Non-Commissioning track | BLOCKED_CONTRACT | Course-use/exclusive bucket semantics cannot be represented safely with v1. |
| Molecular Biology & Biochemistry major | BLOCKED_CONTRACT | Elective count changes as a function of research credits plus special-permission research choices. |
| Organizational Leadership minor | BLOCKED_SOURCE | Current live requirement structure totals 18–19 credits while another live page says 20–21. |
| Persian minor | BLOCKED_SOURCE | Two-300-level-language-course pathway is not supported by a complete current public Persian sequence. |
| Philosophy major | REVIEWED_EXISTING | `sasnb-philosophy-major` |
| Philosophy minor | REVIEWED_EXISTING | `sasnb-philosophy-minor` |
| Philosophy, Politics, and Economics (PPE) minor | DRAFT_PREEXISTING | `catalog/drafts/sasnb-ppe-minor.v1.json`; existing draft already records case-by-case options. |
| Physics — Applied B.S. | BLOCKED_DYNAMIC_APPROVAL | Adviser-selected coherent physical/natural-science concentration and possible external experiential work. |
| Physics — General B.A. | REVIEWED_EXISTING_WITH_AUDIT_CAVEAT | `sasnb-physics-general-ba`; current official rules include adviser-selected coherent additional science/math paths, so existing definition needs standard-path/exhaustiveness review. |
| Physics — Planetary Physics B.S. | BLOCKED_DYNAMIC_APPROVAL | Nine concentration credits are adviser-selected. |
| Physics — Professional B.S. | BLOCKED_DYNAMIC_APPROVAL | Alternate/AP intro sequences require adviser-planned substitutions. |
| Physics minor | REVIEWED_EXISTING | `sasnb-physics-minor` |
| Political Science major | BLOCKED_DYNAMIC_CLASSIFICATION | Four upper-level area requirements rely on Degree Navigator/category labels not fully mapped publicly. |
| Political Science minor | REVIEWED_EXISTING | `sasnb-political-science-minor` |
| Portuguese major | BLOCKED_DYNAMIC_APPROVAL_AND_EXTERNAL_ASSESSMENT | Approved other-department courses, placement exceptions and final-year oral exam. |
| Portuguese minor | BLOCKED_CONTRACT_AND_DYNAMIC_APPROVAL | Language-of-instruction/literature requirements and adviser approval. |
| Psychology major | BLOCKED_CONTRACT | Separate courses required across overlapping core clusters; contract v1 cannot declare exclusive allocation. |
| Psychology minor | REVIEWED_EXISTING | `sasnb-psychology-minor` |
| Quantitative Economics minor | REVIEWED_EXISTING | `sasnb-quantitative-economics-minor` |
| Religion major | BLOCKED_DYNAMIC_APPROVAL | Case-by-case cognates and transfer courses may count outside finite subject-840 set. |
| Religion minor | REVIEWED_EXISTING | `sasnb-religion-minor` |
| Russian major | BLOCKED_DYNAMIC_APPROVAL | Placement substitutions, approved Slavic/EE electives and study paths. |
| Russian minor | BLOCKED_PROGRAM_MODEL_AND_DYNAMIC_APPROVAL | Rutgers exposes multiple minor tracks under one program code; picker/program-identity behavior and placement/approval paths need resolution before static IDs. |
| Sexualities Studies minor | DRAFT_UNREVIEWED | `catalog/drafts/sasnb-sexualities-studies-minor.v1.json`; final reviewer should inspect freshness because live page retains an older effective-date label. |
| Slavic and Eastern European Studies minor | BLOCKED_DYNAMIC_APPROVAL | BTAA/study-abroad language study and interdisciplinary electives require special arrangements/approval. |
| Social Justice minor | BLOCKED_DYNAMIC_APPROVAL_AND_CONTRACT | Dynamic approved list/learning-goal qualification plus overlap constraints. |
| Sociology major | REVIEWED_EXISTING | `sasnb-sociology-ba` |
| Sociology minor | REVIEWED_EXISTING | `sasnb-sociology-minor` |
| South Asian Studies minor | BLOCKED_DYNAMIC_APPROVAL_AND_CONTRACT | Study abroad, discipline caps and cross-listed course assignment make completion approval/allocation dependent. |
| Spanish — Intensive major | BLOCKED_DYNAMIC_APPROVAL_AND_LANGUAGE_CLASSIFICATION | Outside approved courses, placement and language-of-instruction rules. |
| Spanish major | BLOCKED_DYNAMIC_APPROVAL_AND_LANGUAGE_CLASSIFICATION | Preapproved outside-discipline courses plus placement/native-speaker and instruction-language rules. |
| Spanish minor | BLOCKED_CONTRACT_AND_LANGUAGE_CLASSIFICATION | Instruction-language, placement/residency and upper-level requirements exceed current selector attributes. |
| Speech and Hearing Sciences in Linguistics major | BLOCKED_CONTRACT_AND_DYNAMIC_CLASSIFICATION | Inherits Linguistics allocation plus ASHA-aligned external elective categories and AP/transfer caps. |
| Sport Management major | BLOCKED_VERSIONING_AND_SOURCE | Fall 2026 curriculum patching/course substitutions and current numbering/name inconsistencies. |
| Sport Management minor | BLOCKED_SOURCE | Current page lists 955 electives but also permits unspecified 377 courses “if needed.” |
| Statistics major | REVIEWED_EXISTING | `sasnb-statistics-major` |
| Statistics minor | REVIEWED_EXISTING | `sasnb-statistics-minor` |
| Statistics/Mathematics major | DRAFT_UNREVIEWED | `catalog/drafts/sasnb-statistics-mathematics-major.v1.json` |
| Translation Studies minor | BLOCKED_DYNAMIC_APPROVAL_AND_CONTRACT | Participating-department electives, language proficiency, department caps and overlap rules use dynamic classifications. |
| Turkish minor | BLOCKED_SOURCE | Two-300-level-language-course path is not supported by a complete current public Turkish sequence. |
| Women’s, Gender, and Sexuality Studies major | BLOCKED_DYNAMIC_APPROVAL_AND_VERSIONING | Distinct pre-/post-March-2020 curricula plus approved cognates/transnational courses and department distribution. |
| Women’s, Gender, and Sexuality Studies minor | BLOCKED_DYNAMIC_APPROVAL | Approved cognates/other adviser-approved courses plus semantic race/class/sexuality categories and department caps. |

## Joint-school item surfaced from the SAS directory

| Program | Status | Note |
|---|---|---|
| Gender and Media minor | JOINT_SCOPE | SAS/SC&I jointly listed. Keep visible, but source/ownership in a separate joint-school pass so SAS-only data production does not silently claim SC&I-owned rules. |

## Totals / interpretation

The matrix deliberately treats “Rutgers recognizes a valid completion route that a static ScheduleRU v1 definition would reject” as a blocker, even when a common/default path could be encoded. This keeps draft count lower but prevents false completeness.

The largest reusable infrastructure gap remains reviewed allocation/overlap semantics in the catalog contract. Runtime requirements code already supports allocation families, but contract v1 cannot publish them. A generic extension here would unlock a meaningful fraction of the `BLOCKED_CONTRACT` rows above.
