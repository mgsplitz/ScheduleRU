import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/professor-link-model.js", import.meta.url);
const context = { globalThis: {}, URLSearchParams };
if (fs.existsSync(moduleUrl)) vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);

function model() {
  assert.ok(
    context.globalThis.ScheduleRUProfessorLinkModel,
    "professor-link-model.js must expose ScheduleRUProfessorLinkModel",
  );
  return context.globalThis.ScheduleRUProfessorLinkModel;
}

test("generic or missing instructor labels never produce a ratings link", () => {
  for (const value of ["", "Staff", "TBA", "Staff / TBA", "To Be Announced", "Instructor TBA"]) {
    assert.equal(model().ratingsSearchUrl(value), "");
  }
});

test("named instructors receive a safely encoded Rutgers professor search", () => {
  assert.equal(
    model().ratingsSearchUrl("  Jane Doe  "),
    "https://www.ratemyprofessors.com/search/professors/825?q=Jane+Doe",
  );
});

test("distinctNamedInstructors combines course and section data without duplicates", () => {
  assert.deepEqual(
    [...model().distinctNamedInstructors({
      instructor: "Jane Doe",
      instructors: ["Jane Doe", "Staff / TBA", { name: "John Smith" }],
      sections: [{ instructor: "John Smith" }, { instructor: "Ada Lovelace" }],
    })],
    ["Jane Doe", "John Smith", "Ada Lovelace"],
  );
});
