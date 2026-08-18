import assert from "node:assert/strict";
import test from "node:test";
import { webApplicationSource as indexHtml } from "./helpers/web-source.mjs";


test("requirement notices use the API's structured advisory wording", () => {
  assert.match(indexHtml, /rule\.advisory_message\s*\|\|\s*rule\.note/);
  assert.match(indexHtml, /Planning notices from reviewed program sources/);
  assert.doesNotMatch(indexHtml, /Formal program conditions/);
});

test("student issue views route structured failures through the message model", () => {
  assert.match(indexHtml, /apps\/web\/src\/user-message-model\.js/);
  assert.match(indexHtml, /ScheduleRUUserMessageModel\.presentIssue/);
  assert.doesNotMatch(indexHtml, /Could not load degree requirements:\s*\$\{escapeHtml\(current\.requirementsError\)\}/);
  assert.doesNotMatch(indexHtml, /Couldn't reach backend:\s*\$\{error\.message\}/);
});
