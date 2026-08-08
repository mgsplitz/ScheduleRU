# ScheduleRU Web

Browser presentation decisions and integration code live here. The root HTML
file is now a compatibility shell containing semantic markup and ordered
script/style references only.

`styles/app.css` owns the current desktop presentation.
`src/backend-client.js` owns production/development endpoint selection,
device-local endpoint overrides, HTTP transport, and JSON/error handling.
`src/planner-state-store.js` owns validation, migration, persistence, and
clearing of the guest planner state stored on the current device.
`src/planner-controller.js` owns the compatibility planner and schedule-builder
integration, while `src/guided-setup-controller.js` owns onboarding, program
selection, modal, and plan-preview orchestration. Smaller domain decisions
remain in their named modules; new browser logic must not return to
`index.html`.
