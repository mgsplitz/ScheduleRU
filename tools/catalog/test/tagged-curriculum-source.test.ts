import assert from "node:assert/strict";
import test from "node:test";

import {
  parseTaggedCurriculumPages,
} from "../src/adapters/tagged-curriculum-source.ts";

test("tagged curriculum parsing merges duplicate course assignments across pages", () => {
  const pageOne = `
    <table>
      <tr><th>Course</th><th>Title</th><th>Credits</th><th>Core codes</th></tr>
      <tr><td>01:198:111</td><td>INTRO COMPUTER SCI</td><td>4</td><td>QR</td></tr>
      <tr><td>21:198:101</td><td>NEWARK COURSE</td><td>3</td><td>QR</td></tr>
    </table>`;
  const pageTwo = `
    <table>
      <tr><td>01:198:111</td><td>INTRO COMPUTER SCI</td><td>4</td><td>QQ, QR</td></tr>
      <tr><td>01:198:112</td><td>BAD CREDIT</td><td>variable</td><td>QQ</td></tr>
    </table>`;

  assert.deepEqual(parseTaggedCurriculumPages([pageOne, pageTwo]), [{
    code: "01:198:111",
    title: "INTRO COMPUTER SCI",
    credits: 4,
    tags: ["QQ", "QR"],
  }]);
});

test("tagged curriculum parsing decodes basic HTML and sorts stable rows", () => {
  const html = `
    <table>
      <tr><td>01:640:151</td><td>CALCULUS I &amp; APPLICATIONS</td><td>4</td><td>QQ</td></tr>
      <tr><td>01:198:110</td><td>PRINCIPLES<br>OF COMPUTER SCIENCE</td><td>3</td><td>QR</td></tr>
    </table>`;

  assert.deepEqual(parseTaggedCurriculumPages([html]), [
    {
      code: "01:198:110",
      title: "PRINCIPLES OF COMPUTER SCIENCE",
      credits: 3,
      tags: ["QR"],
    },
    {
      code: "01:640:151",
      title: "CALCULUS I & APPLICATIONS",
      credits: 4,
      tags: ["QQ"],
    },
  ]);
});

test("tagged curriculum parsing fails closed when no usable rows exist", () => {
  assert.throws(
    () => parseTaggedCurriculumPages([
      "<table><tr><td>Course</td><td>Title</td><td>Credits</td><td>Tags</td></tr></table>",
    ]),
    /official source contained no tagged course rows/,
  );
});
