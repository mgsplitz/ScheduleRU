import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const moduleUrl = new URL("../../schedule-preference-logic.js", import.meta.url);
const source = fs.existsSync(moduleUrl) ? fs.readFileSync(moduleUrl, "utf8") : "";
const context = { globalThis: {} };
vm.runInNewContext(source, context);
const logic = context.globalThis.ScheduleRUPreferenceLogic;
const plain = (value) => JSON.parse(JSON.stringify(value));

test("publishes the deterministic preference API", () => {
  assert.ok(logic, "ScheduleRUPreferenceLogic must be available");
  for (const name of ["normalizePreferenceSet", "mergePreferencePatch", "scheduleMetrics", "rankSchedules", "recommendSchedules"]) {
    assert.equal(typeof logic[name], "function", `${name} must be a function`);
  }
});

test("hard earliest-start constraints reject early schedules", () => {
  const schedules = [
    { stableIndex: 1, meetings: [{ day: "M", start: 510, end: 590 }] },
    { stableIndex: 2, meetings: [{ day: "M", start: 600, end: 680 }] },
  ];
  const result = logic.recommendSchedules(schedules, { version: 1, constraints: [{ kind: "earliest_start", minutes: 540, strength: "hard" }] });
  assert.deepEqual(plain(result.matches.map((item) => item.stableIndex)), [2]);
  assert.deepEqual(plain(result.tradeoffs), []);
});

test("preference patches accumulate without deleting earlier constraints", () => {
  const first = logic.mergePreferencePatch(
    { version: 1, constraints: [{ kind: "earliest_start", minutes: 540, strength: "hard" }] },
    { constraints: [{ kind: "light_day", day: "F", maximumClasses: 2, strength: "soft" }] },
  );
  assert.equal(first.constraints.length, 2);
  assert.deepEqual(plain(first.constraints.map((constraint) => constraint.kind)), ["earliest_start", "light_day"]);
});

test("recommendations preserve original indices and never exceed three", () => {
  const schedules = Array.from({ length: 10 }, (_, index) => ({ stableIndex: index + 10, meetings: [] }));
  assert.deepEqual(plain(logic.recommendSchedules(schedules, { version: 1, constraints: [] }).matches.map((x) => x.stableIndex)), [10, 11, 12]);
});

test("soft constraints rank by penalty and then original stable index", () => {
  const schedules = [
    { stableIndex: 9, meetings: [{ day: "M", start: 600, end: 660 }] },
    { stableIndex: 3, meetings: [{ day: "T", start: 600, end: 660 }] },
    { stableIndex: 7, meetings: [{ day: "F", start: 600, end: 660 }] },
  ];
  const preferences = { version: 1, constraints: [{ kind: "avoid_day", day: "F", strength: "soft" }] };
  assert.deepEqual(plain(logic.rankSchedules(schedules, preferences).map((item) => item.stableIndex)), [3, 9, 7]);
});

test("impossible hard constraints return closest tradeoffs with a conflict summary", () => {
  const schedules = [
    { stableIndex: 1, meetings: [{ day: "M", start: 510, end: 600 }] },
    { stableIndex: 2, meetings: [{ day: "F", start: 600, end: 690 }] },
    { stableIndex: 3, meetings: [{ day: "F", start: 510, end: 600 }] },
  ];
  const preferences = {
    version: 1,
    constraints: [
      { kind: "earliest_start", minutes: 540, strength: "hard" },
      { kind: "avoid_day", day: "F", strength: "hard" },
    ],
  };
  const result = logic.recommendSchedules(schedules, preferences);
  assert.deepEqual(plain(result.matches), []);
  assert.deepEqual(plain(result.tradeoffs.map((item) => item.stableIndex)), [1, 2]);
  assert.equal(result.conflictSummary.impossible, true);
  assert.deepEqual(plain(result.conflictSummary.constraints), ["earliest_start", "avoid_day"]);
});

test("normalization fails closed for unsupported kinds and malformed fields", () => {
  const normalized = logic.normalizePreferenceSet({
    version: 1,
    constraints: [
      { kind: "campus", campus: "busch", strength: "soft" },
      { kind: "earliest_start", minutes: "morning", strength: "hard" },
      { kind: "latest_end", minutes: 960, strength: "urgent" },
      { kind: "invented", strength: "hard" },
    ],
  });
  assert.deepEqual(plain(normalized.constraints), [{ kind: "campus", campus: "busch", strength: "soft" }]);
});

test("metrics expose daily classes, gaps, campus, modality, and availability facts", () => {
  const metrics = logic.scheduleMetrics({
    meetings: [
      { day: "M", start: 540, end: 600, campus: "busch", modality: "in_person", open: true },
      { day: "M", start: 660, end: 720, campus: "busch", modality: "in_person", open: true },
    ],
  });
  assert.equal(metrics.classesByDay.M, 2);
  assert.equal(metrics.maximumGap, 60);
  assert.deepEqual(plain(metrics.campuses), ["busch"]);
  assert.deepEqual(plain(metrics.modalities), ["in_person"]);
  assert.equal(metrics.allOpen, true);
});
