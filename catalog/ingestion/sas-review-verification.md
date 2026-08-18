# SAS Source Verification

This ledger records the bounded source-verification pass for SAS program drafts. `DRAFT_SOURCE_VERIFIED` means that the draft's identity and deterministic requirement structure have been reconciled against the cited current official Rutgers sources and covered by automated tests. It does not imply that every recorded policy condition is executable by the current public runtime.

This does not constitute independent academic review. Every entry below must remain `unreviewed`, non-public, and absent from the reviewed snapshot until a separate qualified reviewer supplies the catalog contract's required reviewed evidence.

## Source-verified drafts

| Program id | Reconciliation result | Remaining review gate |
|---|---|---|
| `sasnb-anthropology-general-minor` | Current Anthropology page resolves the earlier catalog/page discrepancy as 19 credits: one 3-credit cultural/linguistic introduction, one 4-credit evolutionary introduction, remaining approved electives, and 6 upper-level credits. The upper-level selector is restricted to the published minor pool. | Confirm current finite course classifications, Anthropology-family combination handling, and runtime enforcement of the minimum-grade condition. |
| `sasnb-anthropology-cultural-minor` | Current Anthropology page resolves the total as 18 credits with two fixed introductions, one geographic course, three electives, and two upper-level courses. The upper-level selector is restricted to the published Cultural Anthropology pool. | Confirm current finite course classifications, distinct-course allocation, and runtime enforcement of the minimum-grade condition. |
| `sasnb-anthropology-evolutionary-minor` | Current Anthropology page resolves the total as 20 credits: 11 introductory credits and three electives totaling 9 credits, including 6 upper-level credits. The upper-level selector is restricted to the published Evolutionary Anthropology elective pool. | Confirm current finite course classifications, distinct-course allocation, and runtime enforcement of the minimum-grade and grading-basis conditions. |
| `sasnb-japanese-major` | Current ALC major page, master course list, and SAS identity directory reconcile the language/culture split, East Asian civilization choice, and capstone. | Independent academic review. |
| `sasnb-japanese-minor` | Current ALC requirements and master course list reconcile the six-course total and four-course language subset. | Independent academic review. |
| `sasnb-korean-major` | Current ALC major page, master course list, and SAS identity directory reconcile the language/culture split, East Asian civilization choice, and capstone. | Independent academic review. |
| `sasnb-korean-minor` | Current ALC requirements and master course list reconcile the six-course total and four-course language subset. | Independent academic review. |
| `sasnb-history-stem-society-minor` | Current catalog resolves the live page's “including” wording as six 3-credit courses from the published 33-course pool; SAS separately confirms code 519 and the History-major restriction. | Independent academic review. |
| `sasnb-chinese-minor` | Current ALC Chinese requirements and master course list reconcile the six-course total and four-course language subset. | Independent academic review. |
| `sasnb-chinese-major` | Current ALC requirements and course classifications reconcile the 12-course structure; current titles/descriptions explicitly establish 165:321/322 and 165:419/420 as Classical Chinese. | Independent academic review. |
| `sasnb-arabic-minor` | Current AMESALL requirements, course descriptions, SAS profile, and restriction page reconcile the fixed language and literature sequences. | Independent academic review. |
| `sasnb-hindi-minor` | Current AMESALL requirements, course descriptions, SAS profile, and restriction page reconcile the fixed language and literature sequences. | Independent academic review. |
| `sasnb-comparative-literature-minor` | Current department requirements and SAS identity directory reconcile the core, four electives, upper-level minimum, and 100-level cap. | Independent academic review. |
| `sasnb-creative-writing-minor` | Current English department and SAS pages reconcile introductory, elective, advanced, critical-study, and minimum-grade requirements. | Independent academic review. |
| `sasnb-classics-greek-major` | Current Classics requirements and current Rutgers catalog reconcile the total, Greek-language minimum, and upper-level count. | Independent academic review. |
| `sasnb-classics-latin-major` | Current Classics requirements and SAS profile reconcile the total, Latin-language minimum, and upper-level count. | Independent academic review. |
| `sasnb-classics-greek-latin-major` | Current Classics requirements and current Rutgers catalog reconcile the total, combined-language minimum, language-specific minima, and upper-level count. | Independent academic review. |

## Reconciled but still blocked

### Requirement-condition publication boundary

The current catalog validator accepts descriptive requirement-group conditions, but the public API only executes selection and allocation condition types. It deliberately hides a reviewed group carrying an unknown condition instead of silently ignoring it. The following source-verified drafts therefore must not be promoted until their recorded academic policies are either implemented by the runtime or moved to a supported reviewed advisory representation:

- minimum grade: Anthropology General, Cultural, and Evolutionary minors; Arabic minor; all three Classics majors; Comparative Literature minor; Creative Writing minor; Hindi minor; and STEM in Society minor
- grading basis: Evolutionary Anthropology minor
- adviser approval: Comparative Literature minor

The STEM in Society History-major exclusion has been normalized to the already-supported `selected_program_must_not_include_any` eligibility condition and `blocked` decision.

### Architectural Studies minor

The current department overview and the 2024-2025 Rutgers catalog both require three foundational courses plus three electives (18 credits). The separate live elective page's statement that students take two electives applies ambiguously across the minor and five-course certificate, and does not override the two sources that specifically describe the six-course minor.

The numeric source blocker is therefore resolved. A true variability blocker remains because the live elective page permits director-approved petitions for unlisted Rutgers courses, study abroad, courses at other universities, and relevant internships. The program is now classified `BLOCKED_DYNAMIC_APPROVAL`, not `BLOCKED_SOURCE`.

## Verification boundary

`worker/tests/sas-source-verification.test.mjs` validates the drafts, verifies official Rutgers source provenance, and ensures every source-verified draft stays non-public. `worker/tests/sas-anthropology-minors-source-verification.test.mjs` preserves the three reconciled Anthropology totals and group structures.
