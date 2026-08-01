# ScheduleRU Web

Browser presentation decisions and integration code live here. The production
HTML shell remains at the repository root during the compatibility migration,
but it loads these canonical web modules and the domain packages directly.

The next web checkpoint will extract the inline CSS and application controller
from `index.html`; new browser logic should be added under this app instead of
the repository root.
