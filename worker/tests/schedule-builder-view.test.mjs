import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/schedule-builder-view.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);

function view(builder = null) {
  assert.ok(
    context.globalThis.ScheduleRUScheduleBuilderView,
    "schedule-builder-view.js must expose ScheduleRUScheduleBuilderView",
  );
  return context.globalThis.ScheduleRUScheduleBuilderView.create({
    getBuilder: () => builder,
    escapeHtml: (value) => String(value),
    formatMeeting: () => "T 10:00 AM – 11:00 AM",
    dayIndex: (day) => ({ M: 0, S: 5 }[day]),
    meetingTimeRange: () => ({ start: 600, end: 660 }),
    formatClock: (minutes) => minutes === 600 ? "10:00 AM" : "11:00 AM",
    academicYearLabel: () => "1st Year",
    sortSections: (sections) => sections,
    calendarBlockGeometry: () => ({ top: 124, height: 48 }),
  });
}

test("campus classification is explicit and fails safely for unknown locations", () => {
  const app = view();

  assert.equal(app.campusFor({ meeting_mode: "ONLINE" }), "ONLINE");
  assert.equal(app.campusFor({ building: "ABW 2160" }), "COLLEGE AVENUE");
  assert.equal(app.campusFor({ building: "TIL 232" }), "LIVINGSTON");
  assert.equal(app.campusFor({}), "OTHER/UNKNOWN");
});

test("closed sections stay in markup but remain hidden until requested", () => {
  const builder = { includeClosed: false };
  const app = view(builder);
  const course = {
    code: "01:198:111",
    title: "Intro Computer Science",
    credits: 4,
    enabled: true,
    checked: new Set(["10001"]),
    sections: [
      { index_number: "10001", section_number: "01", open_status: true, meetings: [] },
      { index_number: "10002", section_number: "02", open_status: false, meetings: [] },
    ],
  };

  const hiddenMarkup = app.poolCourseMarkup(course);
  assert.match(hiddenMarkup, /data-poolsec="01:198:111\|10002"/);
  assert.match(hiddenMarkup, /pool-sec-row" hidden/);

  builder.includeClosed = true;
  const visibleMarkup = app.poolCourseMarkup(course);
  assert.doesNotMatch(visibleMarkup, /pool-sec-row" hidden/);
});

test("builder markup keeps verified schedule navigation and assistant controls together", () => {
  const builder = {
    year: 1,
    sem: "fall",
    pool: [{ code: "01:198:111", title: "Intro Computer Science", credits: 4, sections: [], checked: new Set() }],
    permutations: [[{ code: "01:198:111", title: "Intro Computer Science", meetings: [] }]],
    blockers: [],
    requiredCount: 1,
    permIndex: 0,
    includeClosed: false,
  };
  const markup = view(builder).markup();

  assert.match(markup, /Schedule assistant/);
  assert.match(markup, /value="1"[^>]*aria-label="Schedule number"/);
  assert.match(markup, /Use this schedule for Fall 1st Year/);
  assert.match(markup, /Include closed sections/);
});
