import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const html = await readFile(new URL("index.html", root), "utf8");

const ownership = {
  "academic-credit-logic.js": "packages/requirements/src/academic-credit-logic.js",
  "course-interaction-logic.js": "apps/web/src/course-interaction-logic.js",
  "course-selector-logic.js": "packages/requirements/src/course-selector-logic.js",
  "eligibility-logic.js": "packages/planner/src/eligibility-logic.js",
  "four-year-planner-logic.js": "packages/planner/src/four-year-planner-logic.js",
  "planner-input-logic.js": "packages/planner/src/planner-input-logic.js",
  "planner-state-logic.js": "packages/planner/src/planner-state-logic.js",
  "planner-ui-logic.js": "apps/web/src/planner-ui-logic.js",
  "program-picker-logic.js": "apps/web/src/program-picker-logic.js",
  "requirement-group-logic.js": "packages/requirements/src/requirement-group-logic.js",
  "schedule-preference-logic.js": "packages/scheduling/src/schedule-preference-logic.js",
};

test("the web entrypoint loads each browser module from its owning boundary", () => {
  for (const [legacyPath, canonicalPath] of Object.entries(ownership)) {
    assert.match(html, new RegExp(`<script src="${canonicalPath}"></script>`));
    assert.doesNotMatch(html, new RegExp(`<script src="${legacyPath}"></script>`));
  }
});

test("root browser modules are explicit compatibility imports", async () => {
  for (const [legacyPath, canonicalPath] of Object.entries(ownership)) {
    const source = await readFile(new URL(legacyPath, root), "utf8");
    assert.equal(source, `import "./${canonicalPath}";\n`);
  }
});
