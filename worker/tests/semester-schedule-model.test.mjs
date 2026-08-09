import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL(
  "../../packages/scheduling/src/semester-schedule-model.js",
  import.meta.url,
);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}

const model = () => {
  assert.ok(
    context.globalThis.ScheduleRUSemesterScheduleModel,
    "semester-schedule-model.js must expose ScheduleRUSemesterScheduleModel",
  );
  return context.globalThis.ScheduleRUSemesterScheduleModel;
};
const meeting = (day, start, end) => ({
  day_of_week: day,
  start_time: start,
  end_time: end,
});
const section = (index, meetings = []) => ({ index_number: index, meetings });
const poolCourse = (code, sections, checked = sections.map((item) => item.index_number)) => ({
  code,
  title: code,
  credits: 3,
  enabled: true,
  loading: false,
  error: "",
  sections,
  checked: new Set(checked),
});

test("Rutgers compact clocks normalize morning, afternoon, and wrapped evening meetings", () => {
  assert.deepEqual(
    JSON.parse(JSON.stringify(model().meetingTimeRange(meeting("M", "0830", "0950")))),
    { start: 510, end: 590 },
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(model().meetingTimeRange(meeting("T", "0200", "0320")))),
    { start: 840, end: 920 },
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(model().meetingTimeRange(meeting("W", "0745", "0840")))),
    { start: 1185, end: 1240 },
  );
  assert.equal(model().meetingTimeRange(meeting("H", "not-a-time", "0320")), null);
});

test("meeting conflicts use normalized day aliases and allow adjacent classes", () => {
  assert.equal(
    model().meetingsConflict(
      meeting("T", "1000", "1120"),
      meeting("TUESDAY", "1100", "1220"),
    ),
    true,
  );
  assert.equal(
    model().meetingsConflict(
      meeting("T", "1000", "1120"),
      meeting("TU", "1120", "1240"),
    ),
    false,
  );
  assert.equal(
    model().meetingsConflict(
      meeting("T", "1000", "1120"),
      meeting("W", "1100", "1220"),
    ),
    false,
  );
});

test("permutation generation reports every enabled course that cannot contribute a section", () => {
  const loading = poolCourse("01:198:111", []);
  loading.loading = true;
  const unchecked = poolCourse("01:640:250", [section("01")], []);
  const disabled = poolCourse("01:220:102", []);
  disabled.enabled = false;

  const result = model().buildPermutations([loading, unchecked, disabled]);

  assert.equal(result.combos.length, 0);
  assert.equal(result.blockers.length, 2);
  assert.equal(result.blockers[0], loading);
  assert.equal(result.blockers[1], unchecked);
  assert.equal(result.required.length, 2);
  assert.equal(result.required[0], loading);
  assert.equal(result.required[1], unchecked);
});

test("permutation generation keeps one section per enabled course and removes conflicts", () => {
  const first = poolCourse("01:198:111", [
    section("01", [meeting("M", "1000", "1120")]),
    section("02", [meeting("T", "1000", "1120")]),
  ]);
  const second = poolCourse("01:640:250", [
    section("03", [meeting("M", "1100", "1220")]),
    section("04", [meeting("W", "1100", "1220")]),
  ]);

  const result = model().buildPermutations([first, second]);

  assert.equal(result.blockers.length, 0);
  assert.deepEqual(
    JSON.parse(JSON.stringify(result.combos.map((combo) =>
      combo.map((item) => item.index_number)))),
    [["01", "04"], ["02", "03"], ["02", "04"]],
  );
  assert.ok(result.combos.every((combo) => combo.map((item) => item.code).join(",") === "01:198:111,01:640:250"));
});

test("permutation generation caps a large valid result set at 500 stable entries", () => {
  const sections = Array.from({ length: 501 }, (_, index) => section(String(index + 1)));
  const result = model().buildPermutations([poolCourse("01:198:111", sections)]);

  assert.equal(result.combos.length, 500);
  assert.equal(result.combos[0][0].index_number, "1");
  assert.equal(result.combos[499][0].index_number, "500");
});
