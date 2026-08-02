import assert from "node:assert/strict";
import test from "node:test";
import {
  parseCourseLine,
  parseProgramText,
} from "../../apps/api/src/programs/scrapers/coursedog-program-parser.js";

test("Coursedog course parsing preserves shared-credit alternatives", () => {
  assert.deepEqual(
    parseCourseLine("01:198:111 Introduction to CS OR 01:198:170 Computer Applications (4)"),
    {
      isAlternative: true,
      items: [
        { code: "01:198:111", title: "Introduction to CS", credits: "4" },
        { code: "01:198:170", title: "Computer Applications", credits: "4" },
      ],
    },
  );
});

test("Coursedog program parsing keeps prerequisite codes in notes, not requirements", () => {
  const sections = parseProgramText(
    "\u0001Required Courses\u0002\n33:010:325 Intermediate Accounting I (3) (prerequisite: 33:010:272)",
    "Accounting",
  );

  assert.equal(sections.length, 1);
  assert.deepEqual(sections[0].courseItems, [{
    code: "33:010:325",
    title: "Intermediate Accounting I",
    credits: "3",
    note: "prerequisite: 33:010:272",
  }]);
});
