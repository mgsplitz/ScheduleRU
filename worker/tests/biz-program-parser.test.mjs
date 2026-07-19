import assert from "node:assert/strict";
import test from "node:test";
import { parseBizTable } from "../src/programs.js";

test("a Business Core cross-reference is retained as source prose, not a duplicate major requirement", () => {
  const section = parseBizTable(`
    <table>
      <tr><th>Required Accounting Courses</th></tr>
      <tr><th>Course</th><th>Credits</th><th>Notes and Prerequisites</th></tr>
      <tr><td>33:010:458 Accounting Information Systems</td><td>(3)</td><td>fulfilled in Business Core requirements, pre-reqs: 33:010:272 and 01:198:170</td></tr>
      <tr><td>33:010:325 Intermediate Accounting I</td><td>3</td><td>pre-req: 33:010:272</td></tr>
    </table>
  `);
  assert.deepEqual(section.courseItems.map((item) => item.code), ["33:010:325"]);
  assert.match(section.prose.join(" "), /33:010:458 Accounting Information Systems/);
  assert.match(section.prose.join(" "), /fulfilled in Business Core requirements/i);
});

test("a regular listed course remains a requirement", () => {
  const section = parseBizTable(`
    <table>
      <tr><th>Required Accounting Courses</th></tr>
      <tr><th>Course</th><th>Credits</th><th>Notes and Prerequisites</th></tr>
      <tr><td>33:010:326 Intermediate Accounting II</td><td>3</td><td>pre-req: 33:010:325</td></tr>
    </table>
  `);
  assert.deepEqual(section.courseItems.map((item) => item.code), ["33:010:326"]);
  assert.equal(section.prose.length, 0);
});
