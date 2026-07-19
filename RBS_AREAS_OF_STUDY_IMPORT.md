# RBS New Brunswick minors and concentrations: import inventory

Status: development source inventory, started on 2026-07-19. Ten source-backed programs are reviewed and enabled on the development site; Fixed Income and Credit Analysis stays hidden until RBS publishes its approved additional-finance-elective list and confirms how it becomes part of the Finance major. Production is unchanged.

## What this import covers

- Two RBS-offered minors: Business Administration and Entrepreneurship.
- Nine current entries on the RBS concentrations landing page: Business Analytics, Entrepreneurship, Finance, Fixed Income and Credit Analysis, Global Business, Leadership Skills, Management Information Systems, Professional Selling, and Real Estate.
- Exact course rows from the official detail pages where the page listed them.
- Declaration and combination facts as structured draft rules rather than frontend exceptions.

The two RBS minors are for non-RBS students. They are deliberately in the academic model now so a future SAS/SEBS/etc. student can select them after the corresponding home-school rules are reviewed. An RBS-home student must not be offered either minor.

## Source inventory

| Program | Type used in ScheduleRU | Official source | Draft status | Review work still required |
|---|---|---|---|---|
| Business Administration | Minor | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/business-administration-minor) | Reviewed / dev enabled | Formal admission conditions are displayed as advising notes; the source does not state a catalog year. |
| Entrepreneurship | Minor | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/entrepreneurship-minor) | Reviewed / dev enabled | Available only to future non-RBS home-school profiles; current source does not state a catalog year. |
| Business Analytics | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/business-analytics-concentration) | Reviewed / dev enabled | RBS-only, BAIT exclusion, and required office contact are enforced/shown. |
| Entrepreneurship | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/entrepreneurship-concentration) | Reviewed / dev enabled | The current 2025-26 catalog’s named Leadership & Management exclusion resolves the older broad management-major sentence. |
| Finance | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/finance-concentration) | Reviewed / dev enabled | Finance-major exclusion is enforced; B-grade declaration condition is shown as an advising note. |
| Fixed Income and Credit Analysis | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/fixed-income-credit-analysis-concentration) | Needs source clarification | The current catalog confirms Finance-major-only eligibility but does not enumerate the required finance elective or explain its overlap treatment within the Finance major. |
| Global Business | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/global-business-concentration) | Reviewed / dev enabled | RBS-only and Leadership & Management exclusion are enforced. |
| Leadership Skills | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/leadership-skills-concentration) | Reviewed / dev enabled | The reusable requirement engine enforces two electives total, including at least one primary elective; declaration timing remains a transparent RBS-advising confirmation. |
| Management Information Systems | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/management-information-systems-concentration) | Reviewed / dev enabled | RBS-only, BAIT exclusion, and required office contact are enforced/shown. |
| Professional Selling | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/professional-selling-concentration) | Reviewed / dev enabled | The current catalog explicitly permits Marketing majors and identifies its concentration courses as major electives; the exception is stored course-by-course. |
| Real Estate | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/real-estate-concentration) | Reviewed / dev enabled | The current catalog gives an exact Finance path, another RBS-major path, 33:390:300 prerequisites, and a one-course Finance exception. |

## Important source conflicts kept visible

1. The [current concentrations landing page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/concentrations) lists nine concentrations and says a student may declare one after 45 credits. The [RBS policies page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/policies-procedures) has a shorter/older-looking list and describes a different declaration timing. ScheduleRU will not choose between those statements silently.
2. Several detail pages call the courses “certificate courses” while their own landing page calls the programs concentrations. They remain `concentration` records for selector organization, with the wording preserved in provenance notes until RBS confirms the formal transcript label.
3. The existing RBS-wide rule says a major and concentration may not overlap, but the Professional Selling and Real Estate pages state named Finance/Marketing exceptions. The reviewed implementation stores each exception as a tested, program-pair-and-course-code rule; it does not weaken the no-overlap rule for any other course.
4. The Global Business detail page still displayed `22:620:320`, but the [current 2025-26 undergraduate catalog](https://newbrunswick-undergrad-25-26.catalogs.rutgers.edu/pages/tZghCvs9mjVhRGvNWqgC) confirms the New Brunswick elective is `33:620:320`. The reviewed metadata migration corrects that code and stores full source titles and credits for every reviewed manually entered requirement row, so display does not depend on a course being offered in the currently synced term.

## Before publication

For every row, we need a dated catalog source (or written RBS confirmation), a reviewed requirement tree, durable source title/credit metadata, and a comparison case. The first comparison set will cover:

1. A non-RBS student selecting each RBS minor.
2. An RBS student being blocked from those minors.
3. BAIT being blocked from Business Analytics/MIS concentrations.
4. Finance and Leadership & Management exclusions.
5. The Finance-only Fixed Income case, including its unlisted elective and overlap treatment.

Until RBS publishes or confirms the remaining Fixed Income details, that one record stays as development-only data and is not shown by public ScheduleRU endpoints.
