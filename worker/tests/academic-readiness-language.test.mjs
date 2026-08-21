import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sources = await Promise.all([
  "../../index.html",
  "../../apps/web/src/course-details-controller.js",
  "../../apps/web/src/course-interaction-logic.js",
  "../../apps/web/src/guided-setup-controller.js",
  "../../apps/web/src/planner-ui-logic.js",
  "../../apps/web/src/planner-controller.js",
  "../../apps/web/src/program-picker-controller.js",
  "../../apps/web/src/required-panel-controller.js",
  "../../apps/web/src/requirement-data-loader.js",
].map((path) => readFile(new URL(path, import.meta.url), "utf8")));

test("released academic planning UI never exposes implementation-readiness disclaimers", () => {
  const source = sources.join("\n");
  [
    "No verified prerequisite rule",
    "machine-readable prerequisite path is not available yet",
    "Requirements under review",
    "is not available yet",
    "Only reviewed programs",
    "Reviewed requirements",
    "No reviewed program-count limits",
    "reviewed Rutgers equivalency",
    "unfinished reviewed requirement",
    "reviewed prerequisite must",
    "reviewed standing rule",
    "reviewed course rule needs correction",
    "Loading the reviewed",
    "reviewed program policy",
    "reviewed program sources",
    "reviewed prerequisite record",
    "reviewed equivalency comes",
  ].forEach((message) => assert.doesNotMatch(source, new RegExp(message, "i")));
});
