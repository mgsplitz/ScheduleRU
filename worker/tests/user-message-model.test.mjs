import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const moduleUrl = new URL("../../apps/web/src/user-message-model.js", import.meta.url);
const context = { globalThis: {} };
if (fs.existsSync(moduleUrl)) vm.runInNewContext(fs.readFileSync(moduleUrl, "utf8"), context);

function messages() {
  assert.ok(context.globalThis.ScheduleRUUserMessageModel);
  return context.globalThis.ScheduleRUUserMessageModel;
}

const cases = [
  [{ code: "backend_not_found", status: 404, detail: "HTTP 404 {raw}" }, "We couldn't find that information", "Try again"],
  [{ code: "backend_unavailable", retryable: true, detail: "TypeError: Failed to fetch" }, "We couldn't connect", "Try again"],
  [{ code: "invalid_response", detail: "<html>proxy error</html>" }, "We couldn't read the latest data", "Try again"],
  [{ code: "plan_capacity_exceeded", overByCredits: 9 }, "This plan needs more room", "Review selections"],
  [{ code: "plan_sequence_capacity_exceeded", courseCodes: ["01:198:112"] }, "A course sequence needs more time", "Review course order"],
  [{ code: "cyclic_prerequisite", courseCodes: ["01:198:111"] }, "A prerequisite loop needs attention", "Review course details"],
  [{ code: "locked_prerequisite_violation", courseCode: "01:198:112" }, "A pinned course is too early", "Review pinned courses"],
  [{ code: "source_conflict", sourceCount: 2 }, "Rutgers sources disagree", "Review source details"],
  [{ code: "something_new", detail: "stack trace" }, "Something went wrong", "Try again"],
];

for (const [issue, title, primaryAction] of cases) {
  test(`presents ${issue.code} as actionable student language`, () => {
    const result = messages().presentIssue(issue);
    assert.equal(result.title, title);
    assert.equal(result.primaryAction, primaryAction);
    assert.ok(result.message.length > 10);
    assert.doesNotMatch(`${result.title} ${result.message}`, /HTTP|\{raw\}|stack trace|parser|solver/i);
    assert.equal(result.detail, issue.detail || null);
  });
}

test("repeated issues are grouped by the action a student can take", () => {
  const groups = messages().groupIssues([
    { code: "backend_unavailable" },
    { code: "backend_not_found" },
    { code: "locked_prerequisite_violation", courseCode: "01:198:112" },
    { code: "locked_prerequisite_violation", courseCode: "01:198:205" },
    { code: "source_conflict" },
  ], { limit: 3 });

  assert.equal(groups.length, 3);
  assert.equal(groups.find((group) => group.primaryAction === "Review pinned courses").count, 2);
});
