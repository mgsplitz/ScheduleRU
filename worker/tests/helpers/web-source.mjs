import { readFileSync } from "node:fs";

const ROOT = new URL("../../../", import.meta.url);

export const webShell = readFileSync(new URL("index.html", ROOT), "utf8");
export const webStyles = readFileSync(
  new URL("apps/web/styles/app.css", ROOT),
  "utf8",
);
export const webControllerSource = [
  "apps/web/src/backend-client.js",
  "apps/web/src/planner-state-store.js",
  "apps/web/src/planner-controller.js",
  "apps/web/src/guided-setup-controller.js",
].map((path) => readFileSync(new URL(path, ROOT), "utf8")).join("\n");
export const webApplicationSource = [
  webShell,
  webStyles,
  webControllerSource,
].join("\n");
