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
  assert.match(html, /#programOv\{z-index:65;\}/);
  assert.match(html, /id="programRoleControls"/);
  assert.match(html, /programDraftPrimaryId/);
  assert.match(html, /Make primary/);
  assert.match(html, /function setProgramDialogOpen\(/);
  assert.match(html, /document\.getElementById\("onboarding"\)\.inert=open/);
  assert.match(html, /Advising and program policy/);
  assert.match(html, /Double-count policy/);
  assert.match(html, /function setBuilderIncludeClosed\(/);
  assert.match(html, /autoIncludedClosed/);
  assert.match(html, /recomputeBuilderPermutations\(\);renderBuilder\(\)/);
});

test("planner horizon, legacy completion state, and modal transitions stay safe", () => {
  const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /function plannerTermsFromAcademicPosition\([\s\S]*?while\(year<=4\)/);
  assert.doesNotMatch(html, /plannerTermsFromAcademicPosition\([\s\S]*?index<8/);
  assert.match(html, /termKeys=new Set\(terms\.map/);
  assert.match(html, /concrete=sourceType==="core"\?selected/);
  assert.match(html, /function legacyCompletedAcademicCodes\([\s\S]*?ST\.completed[\s\S]*?ST\.apOn/);
  assert.match(html, /function completedAcademicCodes\([\s\S]*?legacyCompletedAcademicCodes\(\)/);
  assert.match(html, /function plannerKnownCourseCodes\([\s\S]*?completedAcademicCodes\(\)/);
  assert.match(html, /completedCourseCodes:completedAcademicCodes\(\)/);
  assert.doesNotMatch(html, /completedCourseCodes:\[\.\.\.plannerKnownCourseCodes\(\)\]/);
  assert.match(html, /renderOnboarding=function\(\)\{const wasOpen=.*legacyRenderOnboarding\(\);setOnboardingOpen\([^,]+,wasOpen\)/);
  assert.match(html, /event\.key==="Escape"[\s\S]*?closeProgramPicker\(\)/);
  assert.match(html, /event\.target===document\.getElementById\("programOv"\)[\s\S]*?closeProgramPicker\(\)/);
  assert.match(html, /function rerenderOnboardingApStep\([\s\S]*?renderOnboarding\(\)/);
  assert.match(html, /refreshApFulfillment\(\);[\s\S]*?rerenderOnboardingApStep\(\);[\s\S]*?renderSchedule\(\)/);
});

test("desktop polish keeps semantic overlays and visual workflow hooks", () => {
  const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /id="onboarding"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /id="programOv"[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"/);
  assert.match(html, /id="appModal"[\s\S]*?role="dialog"[\s\S]*?aria-modal="true"/);
  assert.match(html, /class="program-subtab /);
  assert.match(html, /program-subtab-minor/);
  assert.match(html, /class="planner-issue planner-issue-\$\{issue\.severity\}"/);
  assert.match(html, /class="issue-severity issue-severity-\$\{issue\.severity\}"/);
  assert.match(html, /class="assistant-drawer" id="assistantDrawer" aria-label="Schedule assistant"/);
  assert.match(html, /id="onboardingSteps"[^>]*role="progressbar"[^>]*aria-label="Onboarding progress"/);
  assert.match(html, /onboardingSteps"\)\.setAttribute\("aria-valuenow",String\(step\+1\)\)/);
  assert.doesNotMatch(html, /<title>[^<]*Degree Gooner[^<]*<\/title>/i);
});

test("desktop polish uses contrast-safe focus rings on light and dark surfaces", () => {
  const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /:focus-visible\{outline:3px solid #7b0022;outline-offset:3px;\}/);
  assert.match(html, /\.topbar :focus-visible,[\s\S]*?outline-color:#fff;/);
  assert.match(html, /\.choice-btn:not\(\.secondary\):focus-visible,[\s\S]*?box-shadow:0 0 0 3px #7b0022;/);
});

test("only the active registration semester exposes the schedule builder", () => {
  const html = fs.readFileSync(new URL("../../index.html", import.meta.url), "utf8");
  assert.match(html, /renderSchedule=function\(\)\{[\s\S]*?button\.hidden=!enabled;button\.disabled=!enabled;/);
  assert.match(html, /\.sem-plus\[hidden\]\{display:none;\}/);
});
