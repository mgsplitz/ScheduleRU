import { readFileSync } from "node:fs";

const ROOT = new URL("../../../", import.meta.url);

export const webShell = readFileSync(new URL("index.html", ROOT), "utf8");
export const webStyles = readFileSync(
  new URL("apps/web/styles/app.css", ROOT),
  "utf8",
);
export const webControllerSource = [
  "packages/planner/src/academic-progress-model.js",
  "packages/planner/src/course-path-model.js",
  "packages/requirements/src/core-allocation-model.js",
  "packages/requirements/src/requirement-progress-model.js",
  "packages/requirements/src/requirement-tree-builder.js",
  "packages/requirements/src/program-requirement-model.js",
  "packages/scheduling/src/semester-schedule-model.js",
  "apps/web/src/backend-client.js",
  "apps/web/src/catalog-page-controller.js",
  "apps/web/src/course-details-controller.js",
  "apps/web/src/course-record-model.js",
  "apps/web/src/requirement-picker-controller.js",
  "apps/web/src/schedule-builder-controller.js",
  "apps/web/src/program-picker-logic.js",
  "apps/web/src/program-picker-controller.js",
  "apps/web/src/program-apply-transaction.js",
  "apps/web/src/home-school-transaction.js",
  "apps/web/src/planner-state-store.js",
  "apps/web/src/requirement-data-loader.js",
  "apps/web/src/planner-controller.js",
  "apps/web/src/guided-setup-controller.js",
].map((path) => readFileSync(new URL(path, ROOT), "utf8")).join("\n");
export const webApplicationSource = [
  webShell,
  webStyles,
  webControllerSource,
].join("\n");
