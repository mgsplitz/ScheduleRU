# RBS New Brunswick minors and concentrations: import inventory

Status: development-only draft, imported on 2026-07-19. Nothing in this inventory is public in ScheduleRU until the individual program and every relevant rule are marked `reviewed`.

## What this import covers

- Two RBS-offered minors: Business Administration and Entrepreneurship.
- Nine current entries on the RBS concentrations landing page: Business Analytics, Entrepreneurship, Finance, Fixed Income and Credit Analysis, Global Business, Leadership Skills, Management Information Systems, Professional Selling, and Real Estate.
- Exact course rows from the official detail pages where the page listed them.
- Declaration and combination facts as structured draft rules rather than frontend exceptions.

The two RBS minors are for non-RBS students. They are deliberately in the academic model now so a future SAS/SEBS/etc. student can select them after the corresponding home-school rules are reviewed. An RBS-home student must not be offered either minor.

## Source inventory

| Program | Type used in ScheduleRU | Official source | Draft status | Review work still required |
|---|---|---|---|---|
| Business Administration | Minor | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/business-administration-minor) | Unreviewed | Formal admission/GPA/math/statistics/transfer rules need evaluator support and catalog-year confirmation. |
| Entrepreneurship | Minor | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/entrepreneurship-minor) | Unreviewed | Formal admission process and cross-school applicability need confirmation. |
| Business Analytics | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/business-analytics-concentration) | Unreviewed | Confirm declaration timing and no-overlap rule against a dated catalog. |
| Entrepreneurship | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/entrepreneurship-concentration) | Needs reconciliation | The page’s Leadership & Management restriction conflicts with a broader sentence about management majors. |
| Finance | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/finance-concentration) | Unreviewed | Grade threshold is captured; catalog-year confirmation required. |
| Fixed Income and Credit Analysis | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/fixed-income-credit-analysis-concentration) | Needs reconciliation | Detail page does not enumerate the required finance elective; landing page’s Finance-major-only condition needs catalog confirmation. |
| Global Business | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/global-business-concentration) | Unreviewed | Catalog-year confirmation required. |
| Leadership Skills | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/leadership-skills-concentration) | Needs reconciliation | Its third-course condition depends on whether one or two primary electives are used. |
| Management Information Systems | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/management-information-systems-concentration) | Unreviewed | Catalog-year confirmation required. |
| Professional Selling | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/professional-selling-concentration) | Needs reconciliation | The page promises a transcript certification and creates a Marketing-major overlap exception. |
| Real Estate | Concentration | [detail page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/real-estate-concentration) | Needs reconciliation | Two mutually exclusive major paths plus a Finance overlap exception; page references a retired 33:390:310 prerequisite. |

## Important source conflicts kept visible

1. The [current concentrations landing page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/concentrations) lists nine concentrations and says a student may declare one after 45 credits. The [RBS policies page](https://myrbs.business.rutgers.edu/undergraduate-new-brunswick/policies-procedures) has a shorter/older-looking list and describes a different declaration timing. ScheduleRU will not choose between those statements silently.
2. Several detail pages call the courses “certificate courses” while their own landing page calls the programs concentrations. They remain `concentration` records for selector organization, with the wording preserved in provenance notes until RBS confirms the formal transcript label.
3. The existing RBS-wide rule says a major and concentration may not overlap, but the Professional Selling and Real Estate pages state named Finance/Marketing exceptions. Those exceptions must become explicit, tested double-count policies before either program is reviewed.

## Before publication

For every row, we need a dated catalog source (or written RBS confirmation), a reviewed requirement tree, and a comparison case. The first comparison set will cover:

1. A non-RBS student selecting each RBS minor.
2. An RBS student being blocked from those minors.
3. BAIT being blocked from Business Analytics/MIS concentrations.
4. Finance and Leadership & Management exclusions.
5. The Finance-only Fixed Income case.
6. Professional Selling and Real Estate overlap exceptions.

Until then, these records are useful development data only; they are not shown by public ScheduleRU endpoints.
