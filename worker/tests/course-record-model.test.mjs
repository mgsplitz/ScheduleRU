import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

await import("../../apps/web/src/course-interaction-logic.js");

const moduleUrl = new URL("../../apps/web/src/course-record-model.js", import.meta.url);
const context = {
  globalThis: {
    ScheduleRUCourseInteractionLogic: globalThis.ScheduleRUCourseInteractionLogic,
  },
};
if (fs.existsSync(moduleUrl)) {
  vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);
}

function courseRecords() {
  assert.ok(
    context.globalThis.ScheduleRUCourseRecordModel,
    "course-record-model.js must expose ScheduleRUCourseRecordModel",
  );
  return context.globalThis.ScheduleRUCourseRecordModel;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const cleanText = (value) => String(value || "").replace(/<[^>]+>/g, "").trim();

function createModel({ requirements = {}, state = {}, onSave = () => {} } = {}) {
  const current = {
    wishlist: {},
    schedule: {},
    backendCourses: [],
    courseEligibilityByCode: {},
    ...state,
  };
  return {
    current,
    model: courseRecords().create({
      getState: () => current,
      getRequirementCourses: () => requirements,
      cleanText,
      saveState: onSave,
    }),
  };
}

test("requirement and catalog records normalize into one stable browser shape", () => {
  const { model } = createModel({
    requirements: {
      "01198111": {
        code: "01:198:111",
        title: "Intro Computer Science",
        credits: 4,
        prereqs: ["01640151"],
        alternatives: [{ code: "01:198:110" }],
      },
    },
    state: {
      courseEligibilityByCode: { "01:198:112": { review: { review_status: "reviewed" } } },
    },
  });

  assert.deepEqual(plain(model.requirementCourseRecord("01198111")), {
    id: "01198111",
    code: "01:198:111",
    title: "Intro Computer Science",
    fullTitle: "Intro Computer Science",
    credits: 4,
    description: "",
    catalogPrereqs: "",
    subjectNotes: "",
    restrictions: "",
    requirementNotes: [],
    prereqs: ["01640151"],
    alternatives: [{ code: "01:198:110" }],
    requirementId: "01198111",
    eligibility: null,
    catalogRecordAvailable: false,
  });
  assert.deepEqual(plain(model.backendCourseRecord({
    id: "catalog-112",
    school: "01",
    subject_code: "198",
    course_number: "112",
    title: "<b>Data Structures</b>",
    description: " <i>Catalog description</i> ",
    prereqs: "01:198:111",
    attributes: ["AHp", "WCr"],
  })), {
    id: "catalog-112",
    code: "01:198:112",
    title: "Data Structures",
    fullTitle: "Data Structures",
    credits: "",
    description: "Catalog description",
    catalogPrereqs: "01:198:111",
    subjectNotes: "",
    restrictions: "",
    requirementNotes: [],
    prereqs: [],
    attributes: ["AHp", "WCr"],
    eligibility: { review: { review_status: "reviewed" } },
    catalogRecordAvailable: true,
  });
});

test("record lookup merges requirement identity with plan, wishlist, and catalog details", () => {
  const { model } = createModel({
    requirements: {
      "01198111": { code: "01:198:111", title: "Intro CS", credits: 4 },
    },
    state: {
      schedule: {
        "01:198:111": { code: "01:198:111", year: 1, sem: "fall" },
      },
      wishlist: {
        "01:198:111": { code: "01:198:111", subjectNotes: "Saved note" },
      },
      backendCourses: [{
        id: "catalog-111",
        code: "01:198:111",
        title: "Catalog title",
        description: "Catalog description",
      }],
    },
  });

  const record = model.courseRecordFromId("01:198:111");
  assert.equal(record.id, "01198111");
  assert.equal(record.title, "Intro CS");
  assert.equal(record.description, "Catalog description");
  assert.equal(record.subjectNotes, "Saved note");
  assert.equal(record.year, 1);
});

test("legacy code-only records remain usable when the original catalog page is absent", () => {
  const { model } = createModel();
  const record = model.courseRecordFromId("01:220:102");
  assert.equal(record.code, "01:220:102");
  assert.equal(record.title, "01:220:102");
  assert.equal(record.catalogRecordAvailable, false);
  assert.equal(model.courseRecordFromId("unknown"), null);
});

test("wishlist writes use course code identity, retain details, and persist once", () => {
  let saves = 0;
  const { current, model } = createModel({ onSave: () => { saves += 1; } });
  model.addToWishlist("01:220:102", {
    id: "catalog-102",
    code: "01:220:102",
    title: "Intro Microeconomics",
    credits: 3,
  });
  model.addToWishlist("missing");

  assert.equal(saves, 1);
  assert.equal(current.wishlist["01:220:102"].title, "Intro Microeconomics");
  assert.deepEqual(
    plain(model.wishlistRecords().map((record) => [record.code, record.key])),
    [["01:220:102", "01:220:102"]],
  );
});
