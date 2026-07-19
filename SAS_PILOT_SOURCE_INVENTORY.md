# SAS pilot source inventory

**Status:** Discovery and modeling only. No SAS school, program, requirement, or policy is available in ScheduleRU from this document.

**Purpose:** Define the evidence and data-model work required before the School of Arts and Sciences (SAS) appears in the Programs modal. This prevents RBS rules from being silently reused for SAS.

## Confirmed policy baseline

| Topic | Confirmed public source | Safe product interpretation |
|---|---|---|
| SAS degree structure | [SAS Degree Requirements](https://sasundergrad.rutgers.edu/majors-and-core-curriculum/degree-requirements) | SAS publishes Core Curriculum, a major, normally a minor, at least 120 degree credits, and a 2.000 cumulative GPA as degree components. The app must model the minor requirement as a school-level rule with exceptions, not as an RBS-style program selector hint. |
| Major/minor exceptions | [Completion of a Major and a Minor](https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/completion-of-a-major-and-a-minor) | A second major can waive the SAS minor requirement; credit-intensive-major and other exceptions exist. This needs a reviewed conditional rule before it can be calculated automatically. |
| SAS Core | [SAS Core Curriculum](https://sasundergrad.rutgers.edu/majors-and-core-curriculum/core/about-sas-core) | SAS describes a goal-based Core and permits eligible Core courses to overlap with major or minor requirements unless a particular program prohibits it. Reuse of any current Core course data needs a course-level and catalog-year comparison first. |
| Major/minor overlap | [Completion of a Major and a Minor](https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/completion-of-a-major-and-a-minor) | SAS states that major and minor credits may overlap unless the specific program prohibits it. This is a policy permission, not proof that every pair may double-count. Program-specific prohibitions still win. |
| Incompatible combinations | [SAS Major/Minor Restrictions](https://www.sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-restrictions) | The same academic program cannot supply both major and minor, and SAS publishes a substantial list of named prohibited pairs. These need reviewed pair/combination records, never a frontend exception. |
| Cross-school combinations | [SAS cross-school double-major FAQ](https://sasundergrad.rutgers.edu/resources/faq/faq-detail/add-drop-is-over-how-can-i-add-a-class-2) | A cross-school double major may be possible within Rutgers-New Brunswick, depending on the program, and SAS directs students to advising. This supports an advisor-confirmation status, not blanket automatic permission. |
| Rutgers-New Brunswick school landscape | [Rutgers-New Brunswick undergraduate education](https://newbrunswick-undergrad-25-26.catalogs.rutgers.edu/pages/i6tEU8rJhpiu7BPqY9BN) | New Brunswick has multiple degree-granting undergraduate schools with different routes into majors. The Programs modal must use a reviewed home-school profile and cannot infer transfer or declaration eligibility from a program name. |

## What this changes in the data model

1. **School-level completion rules:** add a reusable, reviewed rule for requirements such as an SAS major, normally an SAS minor, 120 credits, and GPA. The existing program selector cannot be used as a proxy for graduation rules.
2. **Exception logic:** represent “second major waives minor” and credit-intensive exceptions as reviewed conditions. Do not make a generic assumption that a second selected program waives every school's minor requirement.
3. **Program degree metadata:** SAS has BA/BS distinctions for some programs. The program data now supports official program code, degree type, and a reviewed program-family identifier, so a B.A. and B.S. path can own separate requirements. No SAS program path has been entered or exposed yet.
4. **Combination policies:** encode specific prohibited pairs and permitted overlap outcomes in reviewed data. The SAS general overlap statement is not a substitute for program-level restrictions.
5. **Cross-school status:** a cross-school request must remain “needs advisor confirmation” unless an official, combination-specific policy supports a stronger result.
6. **Core module review:** the existing reviewed Core is now stored as the canonical `rutgers-nb-core-curriculum` module and attached to RBS through reviewed data. Compare the published SAS Core course-goal rules and catalog year with that module before attaching it to SAS; no SAS attachment exists yet.

## Evidence required before the SAS pilot is visible

1. Choose one SAS major and one SAS minor with public, catalog-year-specific requirement pages.
2. Capture each course list, choice rule, prerequisite, credit/grade condition, source date, and catalog year.
3. Record the SAS school profile with exact name, campus, category labels, Core context, and source links.
4. Model the SAS degree/minor rule and only the exceptions supported by sources.
5. Add a small reviewed set of named major/minor restrictions that covers the pilot combinations.
6. Select one RBS-plus-SAS scenario. It remains advisor-confirmation-only until a source establishes formal eligibility and double-count treatment.
7. Add comparison cases for: ordinary SAS major + minor, second-major minor waiver, prohibited same-program combination, allowed Core overlap, and the cross-school advisory scenario.

## Current support boundary

ScheduleRU currently supports reviewed RBS-New Brunswick data only. The Programs modal deliberately lists no SAS option until the evidence above is modeled, tested, and marked reviewed.
