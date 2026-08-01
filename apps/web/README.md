# ScheduleRU Web

Browser presentation decisions and integration code live here. The root HTML
file is now a compatibility shell containing semantic markup and ordered
script/style references only.

`styles/app.css` owns the current desktop presentation.
`src/planner-controller.js` owns the compatibility planner and schedule-builder
integration, while `src/guided-setup-controller.js` owns onboarding, program
selection, modal, and plan-preview orchestration. Smaller domain decisions
remain in their named modules; new browser logic must not return to
`index.html`.
