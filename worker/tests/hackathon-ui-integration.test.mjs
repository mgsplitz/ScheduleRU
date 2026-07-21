import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("hackathon UI wires the approved modules and removes hard-coded future builders", () => {
  const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /planner-state-logic\.js/);
  assert.match(html, /four-year-planner-logic\.js/);
  assert.match(html, /schedule-preference-logic\.js/);
  assert.doesNotMatch(html, /RUTGERSBUSINESS SCHOOL/);
  assert.doesNotMatch(html, /Degree Navigator/);
  assert.doesNotMatch(html, /const BACKEND_YEAR=/);
  assert.match(html, /Schedule assistant/);
  assert.match(html, /Issues/);
});
