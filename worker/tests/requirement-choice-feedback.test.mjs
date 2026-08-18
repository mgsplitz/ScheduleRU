import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/requirement-choice-feedback.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);

function feedback() {
  assert.ok(
    context.globalThis.ScheduleRURequirementChoiceFeedback,
    "requirement-choice-feedback.js must expose ScheduleRURequirementChoiceFeedback",
  );
  return context.globalThis.ScheduleRURequirementChoiceFeedback;
}

test("a committed course is highlighted briefly without persisting planner state", () => {
  const classes = new Set();
  const card = {
    dataset: { id: "01:355:201" },
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
    },
    scrollIntoView: (options) => { card.scrollOptions = options; },
  };
  let clearHighlight;
  const result = feedback().highlightCourse({
    document: { querySelectorAll: () => [card] },
    courseCode: "01:355:201",
    setTimeout: (callback, duration) => {
      clearHighlight = callback;
      assert.equal(duration, 1200);
    },
  });

  assert.equal(result, true);
  assert.equal(classes.has("recent-requirement-choice"), true);
  assert.equal(card.scrollOptions.behavior, "smooth");
  assert.equal(card.scrollOptions.block, "center");
  clearHighlight();
  assert.equal(classes.has("recent-requirement-choice"), false);
});
