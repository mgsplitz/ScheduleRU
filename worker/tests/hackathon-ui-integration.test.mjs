import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { webApplicationSource } from "./helpers/web-source.mjs";

const html = webApplicationSource;

function functionSource(name) {
  const marker = `function ${name}(`;
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `${name} must be defined`);
  const bodyStart = html.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < html.length; index += 1) {
    if (html[index] === "{") depth += 1;
    if (html[index] === "}") depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`Could not parse ${name}`);
}

function asyncFunctionSource(name) {
  const marker = `async function ${name}(`;
  const start = html.indexOf(marker);
  assert.notEqual(start, -1, `${name} must be defined`);
  const bodyStart = html.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < html.length; index += 1) {
    if (html[index] === "{") depth += 1;
    if (html[index] === "}") depth -= 1;
    if (depth === 0) return html.slice(start, index + 1);
  }
  throw new Error(`Could not parse ${name}`);
}

function plannerTermsFor(academicPosition) {
  const context = { ST: { academicPosition }, globalThis: {} };
  vm.runInNewContext(`${functionSource("plannerTermsFromAcademicPosition")}; globalThis.terms = plannerTermsFromAcademicPosition();`, context);
  return context.globalThis.terms;
}

test("hackathon UI wires the approved modules and removes hard-coded future builders", () => {
  const html = webApplicationSource;
  assert.match(html, /planner-state-logic\.js/);
  assert.match(html, /four-year-planner-logic\.js/);
  assert.match(html, /schedule-preference-logic\.js/);
  assert.doesNotMatch(html, /RUTGERSBUSINESS SCHOOL/);
  assert.doesNotMatch(html, /Degree Navigator/);
  assert.doesNotMatch(html, /const BACKEND_YEAR=/);
  assert.match(html, /Schedule assistant/);
  assert.match(html, /Issues/);
});

test("localhost uses the development Worker instead of the production API", () => {
  assert.match(html, /LOCAL_DEVELOPMENT_HOSTS/);
  assert.match(html, /"localhost", "127\.0\.0\.1", "::1"/);
  assert.match(html, /LOCAL_DEVELOPMENT_HOSTS\.has\(host\)/);
  assert.match(html, /development \? DEVELOPMENT_BACKEND_URL : PRODUCTION_BACKEND_URL/);
  assert.match(html, /ScheduleRUBackendClient\.siteConfig/);
});

test("hackathon UI persists accepted programs, serializes program applies, and keeps the onboarding accessible", () => {
  const html = webApplicationSource;
  assert.match(html, /primaryProgramId:ST\.primaryProgramId/);
  assert.match(html, /secondaryProgramId:ST\.secondaryProgramId/);
  assert.match(html, /ST\.programApplyPending/);
  assert.match(html, /ST\.programApplyGeneration/);
  assert.match(html, /id="onboarding"[^>]*role="dialog"[^>]*aria-modal="true"/);
  assert.match(html, /setOnboardingOpen\(/);
  assert.match(html, /document\.getElementById\("app"\)\.inert/);
});

test("assistant projections retain Rutgers day and open-section semantics", () => {
  const html = webApplicationSource;
  assert.match(html, /function normalizeAssistantMeeting\(/);
  assert.match(html, /dayIndex\(meeting\?\.day_of_week\)/);
  assert.match(html, /open_status===true\|\|open_status===1\|\|open_status==="1"/);
  assert.match(html, /open_status===false\|\|open_status===0\|\|open_status==="0"/);
  assert.match(html, /courseCode:section\?\.code/);
  assert.match(html, /courseTitle:section\?\.fullTitle\|\|section\?\.title/);
  assert.doesNotMatch(html, /day_of_week\|\|""\)\.toUpperCase\(\)\]\|\|"M"/);
});

test("planner generation derives concrete inputs from immutable program and Core trees", () => {
  const html = webApplicationSource;
  assert.match(
    html,
    /<script src="packages\/planner\/src\/planner-input-logic\.js"><\/script>/,
  );
  assert.match(html, /ScheduleRUPlannerInput\.buildPlannerInput\(/);
  assert.match(html, /function plannerTermsFromAcademicPosition\(/);
  assert.match(html, /ST\.academicPosition\?\.startingSemester/);
  assert.match(html, /function plannerRequirementInputs\(tree/);
  assert.match(html, /corePlannerStatus\(\).*ST\.coreRequirementTree/);
  assert.match(html, /requirementTrees:ST\.majorRequirementTree\?\[\{id:"selected-programs",tree:ST\.majorRequirementTree\}\]:\[\]/);
  assert.match(html, /coreTree:ST\.coreRequirementTree/);
  assert.match(html, /await loadCoreCurriculum\(\)/);
  assert.doesNotMatch(html, /courses:Object\.values\(COURSES\)/);
});

test("program roles, grouped Issues, and closed sections have explicit UI contracts", () => {
  const html = webApplicationSource;
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

test("program onboarding has no silent BAIT default and rerenders every draft mutation", () => {
  assert.match(
    html,
    /<script src="apps\/web\/src\/program-picker-logic\.js"><\/script>/,
  );
  assert.match(html, /ScheduleRUProgramPickerLogic\.initialProgramIds\(/);
  assert.match(html, /function loadHomeSchoolCandidate\([\s\S]*?ScheduleRUProgramPickerLogic\.initialProgramIds\(/);
  assert.doesNotMatch(html, /const initial=availablePrograms\.find\(program=>program\.id===schoolContext\.defaultProgramId/);
  assert.match(html, /programSelectionConfirmed/);
  assert.match(html, /ScheduleRUProgramPickerLogic\.programDraftView\(/);
  assert.match(html, /ST\.programDraft=\[\.\.\.draft\];[\s\S]*?renderProgramPickerList\(\)/);
  assert.match(html, /ST\.programSelectionConfirmed=true/);
  assert.match(html, /savePlannerState\(\);updateProgramTitle\(\);renderOnboarding\(\);closeProgramPicker\(\)/);
  assert.match(html, /#programOv \.modal-footer\{[^}]*position:sticky[^}]*bottom:0/);
});

test("plan previews name blocking courses without flooding the modal with warnings", () => {
  assert.match(html, /function plannerIssueText\(/);
  assert.match(html, /issue\.courseCodes\?\.join\(", "\)/);
  assert.match(html, /issue\.severity==="error"/);
  assert.match(html, /planning notes? (?:is|are) available under Issues/i);
});

test("planner horizon, legacy completion state, and modal transitions stay safe", () => {
  assert.match(html, /function plannerTermsFromAcademicPosition\([\s\S]*?terms\.length<8/);
  assert.match(html, /schedule:ST\.schedule\|\|\{\}/);
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

test("planner horizon always contains eight consecutive Fall/Spring terms from Year 2 Fall", () => {
  const terms = plannerTermsFor({ year: 2, startingSemester: "fall" });
  assert.equal(terms.length, 8);
  assert.deepEqual(JSON.parse(JSON.stringify(terms)), [
    { year: 2, sem: "fall" }, { year: 2, sem: "spring" },
    { year: 3, sem: "fall" }, { year: 3, sem: "spring" },
    { year: 4, sem: "fall" }, { year: 4, sem: "spring" },
    { year: 5, sem: "fall" }, { year: 5, sem: "spring" },
  ]);
});

test("planner horizon always contains eight consecutive Fall/Spring terms from Year 4 Spring", () => {
  const terms = plannerTermsFor({ year: 4, startingSemester: "spring" });
  assert.equal(terms.length, 8);
  assert.deepEqual(JSON.parse(JSON.stringify(terms)), [
    { year: 4, sem: "spring" }, { year: 5, sem: "fall" },
    { year: 5, sem: "spring" }, { year: 6, sem: "fall" },
    { year: 6, sem: "spring" }, { year: 7, sem: "fall" },
    { year: 7, sem: "spring" }, { year: 8, sem: "fall" },
  ]);
  assert.match(html, /function academicYearLabel\(year\)/);
  assert.doesNotMatch(html, /YL\[term\.year\]/);
  const context = { ST: { academicPosition: { year: 4, startingSemester: "spring" } }, globalThis: {} };
  vm.runInNewContext(`${functionSource("academicYearLabel")}; ${functionSource("plannerDisplayMaxYear")}; globalThis.labels = [4, 5, 6, 7, 8].map(academicYearLabel); globalThis.maximum = plannerDisplayMaxYear();`, context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.globalThis.labels)), ["4th Year", "5th Year", "6th Year", "7th Year", "8th Year"]);
  assert.equal(context.globalThis.maximum, 8);
});

test("semester titles expose schedule-builder buttons", () => {
  assert.match(html, /<h3>Fall <button class="sem-plus" data-semplus="fall"/);
  assert.match(html, /<h3>Spring <button class="sem-plus" data-semplus="spring"/);
  assert.match(html, /openBuilder\(btn\.dataset\.semplus\)/);
});

test("placed-course cards have an explicit lock action and planning sends only locked placements", () => {
  assert.match(html, /data-placement-lock=/);
  assert.match(html, /entry\.userPinned=!entry\.userPinned;entry\.locked=entry\.userPinned/);
  assert.match(html, /schedule:ST\.schedule\|\|\{\}/);
  assert.match(html, /locked:true, userPinned:true/);
  assert.match(html, /unless you unlock/);
});

test("accepted plans retain generated titles and render persisted placeholders without pinning every course", () => {
  assert.match(html, /ST\.planPlaceholders/);
  assert.match(html, /plan-placeholder-card/);
  assert.match(html, /placeholder\.year===ST\.year&&placeholder\.sem===sem/);
  assert.match(html, /ScheduleRUPlannerStateLogic\.withAcceptedPlan\(ST,preview\)/);
  assert.doesNotMatch(html, /accepted\.schedule\[code\]=\{[\s\S]{0,400}?locked:true/);
  assert.match(html, /entry\.userPinned=!entry\.userPinned/);
  assert.match(html, /estimated credits planned/);
  assert.match(html, /placeholders\.length\?`\$\{total\} estimated credits`/);
});

test("semester cards can move, plans can clear, and restart requires destructive confirmation", () => {
  assert.match(html, /dataTransfer\.setData\("schedule-cid",card\.dataset\.id\)/);
  assert.match(html, /const movingScheduled=e\.dataTransfer\.getData\("schedule-cid"\)===code/);
  assert.match(html, /id="clearPlanBtn"/);
  assert.match(html, /function confirmClearPlan\(/);
  assert.match(html, /ST\.schedule=\{\};ST\.planPlaceholders=\[\]/);
  assert.match(html, /title:"Restart everything\?"/);
  assert.match(html, /clearPlannerState\(\);location\.reload\(\)/);
  assert.match(html, /id="onboardingRestart"/);
  assert.match(html, /function openRestartSetupConfirmation\(/);
  assert.match(html, /document\.getElementById\("onboardingRestart"\)\.addEventListener\("click",openRestartSetupConfirmation\)/);
});

test("small choose-one requirements and full sequence choices have explicit planner controls", () => {
  assert.match(html, /function requirementChoiceControlsHtml\(/);
  assert.match(html, /data-plan-choice-group=/);
  assert.match(html, /function setRequirementChoice\(/);
  assert.match(html, /ST\.groupSelections\[groupId\]=next/);
  assert.match(html, /data-plan-placeholder=/);
  assert.match(html, /function focusPlanPlaceholder\(/);
});

test("guest onboarding is the approved compact five-step workflow", () => {
  assert.match(html, /Array\.from\(\{length:5\}/);
  assert.match(html, /Account functionality is not enabled yet\. Continue as a guest for now\./);
  assert.doesNotMatch(html, /Set your academic position/);
  assert.match(html, /data-onboarding-ap=/);
  assert.match(html, /Scores of 4 or 5/);
  assert.match(html, /id="recordCourseSearch"/);
  assert.doesNotMatch(html, /id="recordTitle"/);
  assert.doesNotMatch(html, /id="recordGrade"/);
  assert.match(html, /id="onboardingHomeSchool"/);
  assert.match(html, /Add program of study/);
  assert.match(html, /Try the four-year auto-planner/);
});

test("completed-course onboarding searches the full catalog and only adds verified matches", () => {
  assert.match(html, /function searchOnboardingCourses\(/);
  assert.match(html, /ScheduleRUCourseInteractionLogic\.onboardingCatalogSearchTerms\(/);
  assert.match(html, /backendFetch\("\/api\/courses\?"/);
  assert.match(html, /ScheduleRUCourseInteractionLogic\.rankOnboardingCourseMatches\(/);
  assert.match(html, /ScheduleRUCourseInteractionLogic\.verifiedOnboardingCourse\(/);
  assert.match(html, /id="recordCourseSearchStatus"/);
  assert.match(html, /id="recordCourseSearchResults"[^>]*role="listbox"/);
  assert.match(html, /data-record-course-option=/);
  assert.doesNotMatch(html, /<datalist id="recordCourseOptions"/);
  assert.doesNotMatch(
    html,
    /function onboardingCourseRecord\([\s\S]*?return requirement\|\|catalog\|\|courseRecordFromId\(value\)/
  );
});

test("a long AP-credit list stays inside the onboarding dialog", () => {
  assert.match(html, /class="onboarding-records onboarding-records-scroll"/);
  assert.match(html, /\.onboarding-card\{[^}]*max-height:calc\(100dvh - 80px\)[^}]*display:flex[^}]*flex-direction:column[^}]*overflow:hidden/);
  assert.match(html, /#onboardingContent\{[^}]*min-height:0[^}]*flex:1[^}]*display:flex[^}]*flex-direction:column/);
  assert.match(html, /\.onboarding-records-scroll\{[^}]*overflow-y:auto/);
  assert.match(html, /\.onboarding-actions\{[^}]*flex-shrink:0/);
});

test("Programs edits programs only while home-school changes use a separate control", () => {
  assert.match(html, /id="homeSchoolBtn"/);
  assert.match(html, /function openHomeSchoolPicker\(/);
  const programDialog = html.match(/<!-- PROGRAM SELECTOR -->([\s\S]*?)<div class="app-modal"/)?.[1] || "";
  assert.doesNotMatch(programDialog, /programSchoolSelect/);
  assert.match(programDialog, /id="programSchoolNav"/);
  assert.match(html, /ST\.programBrowseSchoolSlug=""/);
  assert.match(html, /Choose a school to browse its available programs/);
  assert.match(html, /class="policy-warning-list"/);
});

test("requirement picker, placeholders, and AP prerequisite credit use their systemic fallbacks", () => {
  assert.doesNotMatch(html, /data-pwishlist=/);
  assert.doesNotMatch(html, />Requirement filled</);
  assert.match(html, /data-pintent=/);
  assert.match(html, /candidateSelectionContext:placeholder\.candidateSelectionContext/);
  assert.match(html, /ScheduleRUAcademicCredit\.normalizeCourseCode\(value\)/);
  assert.match(html, /\.\.\.confirmedAcademicCourseCodes\(\)/);
  assert.match(html, /ScheduleRUAcademicCredit\.expandedPlannedCourseEntries\(/);
});

test("Core placeholder choices open a labeled Courses catalog filter instead of a no-op modal path", () => {
  assert.match(html, /backendRequirementFilter:null/);
  assert.match(html, /function openCorePlaceholderCourseBrowser\(/);
  assert.match(html, /kind:"course_codes"/);
  assert.match(html, /setTopLevelPage\("courses"\);loadBackendCourses\(\)/);
  assert.match(html, /placeholderDestination\(\{[\s\S]*?sourceType:placeholderSourceType/);
  assert.match(html, /function planPlaceholderSourceType\(/);
  assert.match(html, /ST\.coreRequirementTree\?\.groups\?\.\[placeholder\?\.requirementGroupId\]/);
  assert.match(html, /await loadCoreCurriculum\(\);[\s\S]*?placeholderSourceType=planPlaceholderSourceType\(placeholder\)/);
  assert.match(html, /if\(destination==="course_catalog"\)\{openCorePlaceholderCourseBrowser\(placeholder,group\);return;\}/);
  assert.match(html, /Choosing for <b>/);
  assert.match(html, /ST\.backendRequirementFilter=null/);
});

test("program discovery spans supported schools while policy lookup keeps the home school", async () => {
  const loads = [];
  const context = {
    ST: {
      homeSchoolSlug: "rbsnb",
      availablePrograms: [],
      selectedPrograms: ["rbsnb-finance"],
    },
    requirementDataLoader: {
      loadPrograms: async (options) => {
        loads.push(options);
        return {
          programs: [
            { id: "rbsnb-finance", type: "major", eligibility_rules: [] },
            { id: "sasnb-economics-major", type: "major", eligibility_rules: [] },
          ],
          selectionPolicies: { limits: [], combination_policies: [] },
        };
      },
    },
    savePlannerState: () => {},
    globalThis: {},
  };
  vm.runInNewContext(
    `${functionSource("eligibilityRuleValues")};`
    + `${functionSource("programIsAvailableForSchool")};`
    + `${functionSource("programIsAvailableForHomeSchool")};`
    + `${asyncFunctionSource("loadAvailablePrograms")};`
    + "globalThis.load = loadAvailablePrograms;",
    context,
  );

  const result = await context.globalThis.load();
  assert.deepEqual(result.map((program) => program.id), ["rbsnb-finance", "sasnb-economics-major"]);
  assert.deepEqual(JSON.parse(JSON.stringify(loads)), [{ homeSchoolSlug: "rbsnb", scope: "all" }]);
  assert.equal(context.ST.homeSchoolSlug, "rbsnb");
});

test("program tabs include a shared family only for its contributing programs", () => {
  const context = {
    ST: { requirementTrees: {} },
    globalThis: {},
  };
  vm.runInNewContext(
    `${functionSource("treeIncludesSourceProgram")};`
    + `${functionSource("groupBelongsToRequiredProgram")};`
    + "globalThis.belongs = groupBelongsToRequiredProgram;",
    context,
  );
  const sharedCore = {
    sourceProgramId: "accounting-core-variant",
    sourceProgramIds: ["rbsnb-bait", "rbsnb-finance"],
  };
  assert.equal(context.globalThis.belongs(sharedCore, "rbsnb-finance"), true);
  assert.equal(context.globalThis.belongs(sharedCore, "rbsnb-bait"), true);
  assert.equal(context.globalThis.belongs(sharedCore, "rbsnb-accounting"), false);
});

test("home-school replacement rolls back on failure and ignores stale responses", () => {
  assert.match(html, /function acceptedHomeSchoolSnapshot\(\)/);
  assert.match(html, /function restoreHomeSchoolSnapshot\(snapshot\)/);
  assert.match(html, /function loadHomeSchoolCandidate\(nextSchool\)/);
  assert.match(html, /const generation=\(ST\.homeSchoolChangeGeneration\|\|0\)\+1/);
  assert.match(html, /if\(generation!==ST\.homeSchoolChangeGeneration\)return;/);
  assert.match(html, /commitHomeSchoolCandidate\(candidate\);\s*savePlannerState\(\)/);
  assert.match(html, /restoreHomeSchoolSnapshot\(snapshot\);/);
  assert.doesNotMatch(html, /ST\.selectedPrograms=\[\];\s*ST\.groupSelections=\{\};\s*ST\.requirementTrees=\{\};/);
});

test("home-school transaction restores the accepted context and discards stale candidates", async () => {
  const commits = [];
  const restores = [];
  const saves = [];
  const deferred = new Map();
  const context = {
    ST: { homeSchoolSlug: "sasnb", selectedPrograms: ["sas-major"], homeSchoolChangeGeneration: 0 },
    schoolProfileBySlug: (slug) => ({ slug }),
    acceptedHomeSchoolSnapshot: () => ({ homeSchoolSlug: "sasnb", selectedPrograms: ["sas-major"] }),
    restoreHomeSchoolSnapshot: (snapshot) => { restores.push(snapshot); Object.assign(context.ST, snapshot); },
    loadHomeSchoolCandidate: (school) => new Promise((resolve, reject) => { deferred.set(school.slug, { resolve, reject }); }),
    commitHomeSchoolCandidate: (candidate) => { commits.push(candidate); Object.assign(context.ST, candidate); },
    savePlannerState: () => saves.push("save"),
    updateProgramTitle: () => {},
    renderProgramSchoolSelector: () => {},
    renderPanel: () => {},
    openProgramPicker: () => {},
    modalController: { show: () => {} },
    escapeHtml: (value) => value,
    globalThis: {},
  };
  vm.runInNewContext(`${asyncFunctionSource("changeHomeSchool")}; globalThis.changeHomeSchool = changeHomeSchool;`, context);

  const failing = context.globalThis.changeHomeSchool("rbsnb", true);
  deferred.get("rbsnb").reject(new Error("offline"));
  await failing;
  assert.equal(context.ST.homeSchoolSlug, "sasnb");
  assert.equal(restores.length, 1);
  assert.equal(saves.length, 0);

  const first = context.globalThis.changeHomeSchool("rbsnb", true);
  const second = context.globalThis.changeHomeSchool("sebs", true);
  deferred.get("rbsnb").resolve({ homeSchoolSlug: "rbsnb" });
  await first;
  assert.equal(commits.length, 0);
  deferred.get("sebs").resolve({ homeSchoolSlug: "sebs" });
  await second;
  assert.deepEqual(JSON.parse(JSON.stringify(commits)), [{ homeSchoolSlug: "sebs" }]);
  assert.equal(saves.length, 1);
});

test("desktop polish keeps semantic overlays and visual workflow hooks", () => {
  const html = webApplicationSource;
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
  const html = webApplicationSource;
  assert.match(html, /:focus-visible\{outline:3px solid #7b0022;outline-offset:3px;\}/);
  assert.match(html, /\.topbar :focus-visible,[\s\S]*?outline-color:#fff;/);
  assert.match(html, /\.choice-btn:not\(\.secondary\):focus-visible,[\s\S]*?box-shadow:0 0 0 3px #7b0022;/);
});

test("semester schedule-builder buttons are restricted to the active registration term", () => {
  const html = webApplicationSource;
  assert.match(html, /ScheduleRUPlannerUI\.canOpenSemesterBuilder/);
  assert.match(html, /plus\.hidden=!builderAvailable;plus\.disabled=!builderAvailable/);
  assert.match(html, /\.sem-plus\[hidden\]\{display:none;\}/);
  assert.ok(
    html.indexOf("function activePlanYear()") < html.indexOf("function renderSchedule()"),
    "the active-plan helper must be initialized before the first schedule render",
  );
});
