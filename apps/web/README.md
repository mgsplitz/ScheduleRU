# ScheduleRU Web

Browser presentation decisions and integration code live here. The root HTML
file is now a compatibility shell containing semantic markup and ordered
script/style references only.

`styles/app.css` owns the current desktop presentation.
`src/backend-client.js` owns production/development endpoint selection,
device-local endpoint overrides, HTTP transport, and JSON/error handling.
`src/planner-state-store.js` owns validation, migration, persistence, and
clearing of the guest planner state stored on the current device.
`src/requirement-data-loader.js` owns school, program, requirement-policy, and
Core request orchestration without mutating browser or presentation state.
`src/program-picker-logic.js` owns program availability, role, and draft
selection decisions. `src/program-picker-controller.js` owns the picker dialog,
focus lifecycle, browsing presentation, and its one-time event bindings.
`src/program-apply-transaction.js` validates and commits
complete program/requirement candidates without exposing partial state.
`src/home-school-transaction.js` owns stale-safe home school replacement,
commit, and rollback without rendering the interface.
`src/course-record-model.js` normalizes and resolves requirement, catalog,
wishlist, and planned-course records behind one stable course-code identity.
`src/requirement-picker-controller.js` owns the approved-course picker,
including stale-safe selector searches, pagination, focus, and picker actions.
`src/planner-controller.js` owns the compatibility planner and schedule-builder
integration, while `src/guided-setup-controller.js` owns onboarding, program
selection, modal, and plan-preview orchestration. Smaller domain decisions
remain in their named modules; new browser logic must not return to
`index.html`.
