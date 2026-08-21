import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sources = await Promise.all([
  "../../apps/web/src/course-details-controller.js",
  "../../apps/web/src/planner-ui-logic.js",
  "../../apps/web/src/planner-controller.js",
  "../../apps/web/src/program-picker-controller.js",
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
  ].forEach((message) => assert.doesNotMatch(source, new RegExp(message, "i")));
});
