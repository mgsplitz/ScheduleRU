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

test("rankSchedules eliminates every schedule that violates a hard constraint", () => {
  const schedules = [
    { stableIndex: 4, meetings: [{ day: "M", start: 539, end: 600 }] },
    { stableIndex: 8, meetings: [{ day: "T", start: 540, end: 600 }] },
  ];
  const preferences = { version: 1, constraints: [{ kind: "earliest_start", minutes: 540, strength: "hard" }] };
  assert.deepEqual(plain(logic.rankSchedules(schedules, preferences).map((item) => item.stableIndex)), [8]);
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
  assert.deepEqual(plain(result.tradeoffs.map((item) => item.stableIndex)), [2, 1, 3]);
  assert.equal(result.conflictSummary.impossible, true);
  assert.deepEqual(plain(result.conflictSummary.constraints), ["avoid_day", "earliest_start"]);
});

test("tradeoffs prefer a smaller hard miss before soft penalties and cap results at three", () => {
  const schedules = [
    { stableIndex: 1, meetings: [{ day: "F", start: 539, end: 600 }] },
    { stableIndex: 2, meetings: [{ day: "M", start: 440, end: 500 }] },
    { stableIndex: 3, meetings: [{ day: "M", start: 430, end: 500 }] },
    { stableIndex: 4, meetings: [{ day: "M", start: 420, end: 500 }] },
  ];
  const preferences = {
    version: 1,
    constraints: [
      { kind: "earliest_start", minutes: 540, strength: "hard" },
      { kind: "avoid_day", day: "F", strength: "soft" },
    ],
  };
  const result = logic.recommendSchedules(schedules, preferences);
  assert.deepEqual(plain(result.matches), []);
  assert.deepEqual(plain(result.tradeoffs.map((item) => item.stableIndex)), [1, 2, 3]);
});

test("normalization fails closed for unsupported kinds and malformed fields", () => {
  const normalized = logic.normalizePreferenceSet({
    version: 1,
    constraints: [
      { kind: "campus", value: "busch", strength: "soft" },
      { kind: "earliest_start", minutes: "morning", strength: "hard" },
      { kind: "latest_end", minutes: 960, strength: "urgent" },
      { kind: "invented", strength: "hard" },
    ],
  });
  assert.deepEqual(plain(normalized.constraints), [{ kind: "campus", strength: "soft", value: "busch" }]);
});

test("normalization keeps only exact canonical version-1 fields and types", () => {
  const canonical = logic.normalizePreferenceSet({
    version: 1,
    constraints: [
      { kind: "maximum_gap", minutes: 45, strength: "hard" },
      { kind: "compact_schedule", strength: "soft" },
      { kind: "modality", value: "online", strength: "soft" },
      { kind: "open_sections", value: true, strength: "hard" },
      { kind: "time_window_exception", day: "T", startMinutes: 480, endMinutes: 540, minimumClasses: 1, maximumClasses: 2, strength: "soft" },
    ],
  });
  assert.deepEqual(plain(canonical.constraints), [
    { kind: "maximum_gap", strength: "hard", minutes: 45 },
    { kind: "compact_schedule", strength: "soft" },
    { kind: "modality", strength: "soft", value: "online" },
    { kind: "open_sections", strength: "hard", value: true },
    { kind: "time_window_exception", strength: "soft", day: "T", startMinutes: 480, endMinutes: 540, minimumClasses: 1, maximumClasses: 2 },
  ]);

  const rejected = logic.normalizePreferenceSet({
    version: 1,
    constraints: [
      { kind: "earliest_start", minutes: "540", strength: "hard" },
      { kind: "maximum_gap", maximumGap: 45, strength: "hard" },
      { kind: "campus", campus: "busch", strength: "soft" },
      { kind: "modality", modality: "online", strength: "soft" },
      { kind: "open_sections", required: true, strength: "hard" },
      { kind: "open_sections", value: true, required: false, strength: "hard" },
      { kind: "compact_schedule", minutes: 30, strength: "soft" },
      { kind: "preferred_day", day: "m", strength: "soft" },
      { kind: "avoid_day", day: "M" },
    ],
  });
  assert.deepEqual(plain(rejected.constraints), []);
  assert.deepEqual(plain(logic.normalizePreferenceSet({ version: "1", constraints: canonical.constraints }).constraints), []);
});

test("open-sections accepts only true and false patches do not clear an existing preference", () => {
  const current = { version: 1, constraints: [{ kind: "open_sections", value: true, strength: "hard" }] };
  const falseConstraint = { kind: "open_sections", value: false, strength: "hard" };
  assert.deepEqual(plain(logic.normalizePreferenceSet({ version: 1, constraints: [falseConstraint] }).constraints), []);
  assert.deepEqual(plain(logic.mergePreferencePatch(current, { constraints: [falseConstraint] }).constraints), current.constraints);
});

test("time-window exceptions require at least one class-count bound", () => {
  const normalized = logic.normalizePreferenceSet({
    version: 1,
    constraints: [
      { kind: "time_window_exception", day: "T", startMinutes: 480, endMinutes: 540, strength: "soft" },
      { kind: "time_window_exception", startMinutes: 480, endMinutes: 540, maximumClasses: 1, strength: "soft" },
    ],
  });
  assert.deepEqual(plain(normalized.constraints), [
    { kind: "time_window_exception", strength: "soft", startMinutes: 480, endMinutes: 540, maximumClasses: 1 },
  ]);
});

test("string availability is unknown and cannot satisfy a hard open-sections preference", () => {
  const schedules = [
    { stableIndex: 1, meetings: [{ day: "M", start: 540, end: 600, open: "false" }] },
    { stableIndex: 2, meetings: [{ day: "T", start: 540, end: 600, open: true }] },
  ];
  const preferences = { version: 1, constraints: [{ kind: "open_sections", value: true, strength: "hard" }] };
  assert.deepEqual(plain(logic.rankSchedules(schedules, preferences).map((item) => item.stableIndex)), [2]);
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
