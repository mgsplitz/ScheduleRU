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

test("hackathon UI persists accepted programs, serializes program applies, and keeps the onboarding accessible", () => {
  const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /primaryProgramId:ST\.primaryProgramId/);
  assert.match(html, /secondaryProgramId:ST\.secondaryProgramId/);
  assert.match(html, /ST\.programApplyPending/);
  assert.match(html, /ST\.programApplyGeneration/);
  assert.match(html, /id="onboarding"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /setOnboardingOpen\(/);
  assert.match(html, /document\.getElementById\("app"\)\.inert/);
});

test("assistant projections retain Rutgers day and open-section semantics", () => {
  const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /function normalizeAssistantMeeting\(/);
  assert.match(html, /dayIndex\(meeting\?\.day_of_week\)/);
  assert.match(html, /open_status===true\|\|open_status===1\|\|open_status==="1"/);
  assert.match(html, /open_status===false\|\|open_status===0\|\|open_status==="0"/);
  assert.doesNotMatch(html, /day_of_week\|\|""\)\.toUpperCase\(\)\]\|\|"M"/);
});

test("planner generation derives concrete inputs from immutable program and Core trees", () => {
  const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /function plannerTermsFromAcademicPosition\(/);
  assert.match(html, /ST\.academicPosition\?\.startingSemester/);
  assert.match(html, /function plannerRequirementInputs\(tree/);
  assert.match(html, /corePlannerStatus\(\).*ST\.coreRequirementTree/);
  assert.match(html, /unresolvedRequirements:\[\.\.\.program\.placeholders,\.\.\.core\.placeholders\]/);
  assert.match(html, /await loadCoreCurriculum\(\)/);
  assert.doesNotMatch(html, /courses:Object\.values\(COURSES\)/);
});

test("program roles, grouped Issues, and closed sections have explicit UI contracts", () => {
  const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /id="programOv"[^>]*aria-hidden/);
  assert.match(html, /id="programOv"[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"/);
  assert.match(html, /id="programRoleControls"/);
  assert.match(html, /programDraftPrimaryId/);
  assert.match(html, /Make primary/);
  assert.match(html, /function setProgramDialogOpen\(/);
  assert.match(html, /Advising and program policy/);
  assert.match(html, /Double-count policy/);
  assert.match(html, /function setBuilderIncludeClosed\(/);
  assert.match(html, /autoIncludedClosed/);
  assert.match(html, /recomputeBuilderPermutations\(\);renderBuilder\(\)/);
});
