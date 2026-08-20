/* AP equivalencies are loaded from the reviewed Worker endpoint. */
let AP = [];

// Requirement data is populated from the public Worker API at startup.
// These containers deliberately contain no course or group data in source.
let COURSES = {};
let GROUPS = {};
let ROOT_GROUPS = [];

const BACKEND_SITE_CONFIG=ScheduleRUBackendClient.siteConfig({
  hostname:(typeof location!=="undefined"&&location.hostname)||"",
  storage:typeof localStorage!=="undefined"?localStorage:null,
});

/* ============================================================
   STATE
   ============================================================ */
// A home school owns the catalog rules that apply to a student's plan. The
// reviewed school profiles come from the Worker, so future schools can define
// their own labels and curriculum context without a separate frontend page.
const FALLBACK_SCHOOL_CONTEXT={
  label:"your home school",
  shortName:"your home school",
  defaultProgramId:null,
  advisingLabel:"your school advising office",
  sharedRequirementReferenceTypes:["major"],
  coreFallbackLabel:"Core Curriculum",
  coreIntro:"Completed, scheduled, and eligible AP-equivalent courses are allocated automatically to maximize completed curriculum goals. Click any course for details.",
  programTypeSections:[],
};
function schoolProfileBySlug(slug){
  return (ST.availableSchools||[]).find(school=>school.slug===slug)||null;
}
function schoolContextForProfile(school){
  if(!school) return FALLBACK_SCHOOL_CONTEXT;
  return {
    ...FALLBACK_SCHOOL_CONTEXT,
    ...(school.context||{}),
    label:school.short_name||school.name||FALLBACK_SCHOOL_CONTEXT.label,
    shortName:school.short_name||school.name||FALLBACK_SCHOOL_CONTEXT.shortName,
  };
}
function activeSchoolContext(){ return schoolContextForProfile(schoolProfileBySlug(ST.homeSchoolSlug)); }
function activeCoreLabel(){
  return ST.activeCoreCurriculum?.name||activeSchoolContext().coreFallbackLabel;
}

const ST = {
  apOn:{}, completed:{}, schedule:{}, wishlist:{}, groupSelections:{}, creditLedger:{}, courseEligibilityByCode:{}, courseEligibilityFetched:{},
  year:1, tab:"required", panelFull:false,
  page:"nav", // top-level page: "nav" (Planner) | "courses" (Courses)
  // Backend (Cloudflare Worker + D1) integration — see worker.js/schema.sql.
  // The worker reads Rutgers on a cron and serves cached results from D1,
  // so this is a plain same-origin-friendly fetch (the worker sends CORS
  // headers itself) rather than needing a public relay.
  backendUrl: BACKEND_SITE_CONFIG.initialUrl,
  availableSchools:[], availablePrograms:[], activeProgram:null, selectedPrograms:[],
  homeSchoolSlug:"", programSelectionPolicies:{limits:[],combination_policies:[]},
  requirementTrees:{}, referenceRequirementTrees:{}, majorRequirementTree:null, catalogListedProgramIds:[], doubleCountPolicies:[], doubleCountRules:[], doubleCountExceptions:[], programEligibilityRules:[], doubleCount:null,
  requirementsLoading:true, requirementsError:"",
  coreCurricula:[], activeCoreCurriculum:null, coreRequirementTree:null, coreLoading:false, coreError:"",
  backendSubject:"", backendSearch:"", backendLevels:[], backendCredits:[], backendAvailability:"any", backendCoreCodes:[], backendPage:1, backendSelectorGroupId:null, backendRequirementFilter:null,
  backendCourses:[], backendTotal:0, backendLoading:false, backendError:"",
  backendSubjects:[], backendCoreAttributeOptions:[], backendStatus:null,
  expandedIds: new Set(),   // course ids currently expanded on the Courses page
  sectionsCache: {},        // course id -> { sections } | { error }, lazy-loaded
  pickerSelector:null,      // selector-backed requirement modal state
  activeRequirementChoice:null,
  choicePreferences:{},
  requiredRootOpen:{}, nestedGroupOpen:{},
  builder: null,            // { year, sem, pool:[{code,title,credits,sections,checked,loading,error}], permutations, permIndex } | null
};

// This is intentionally device-local, not an account. It keeps a student's
// plan private while still surviving reloads and Pages deployments at this
// same site address. Catalog and requirement data stay on the Worker, so the
// saved payload remains small and can be re-evaluated against updated rules.
const CURRENT_PLANNER_STATE_VERSION=ScheduleRUPlannerStateLogic.STATE_VERSION;
const programRequirementModel=ScheduleRUProgramRequirementModel;
const {requirementCourseId,build:buildRequirementTree}=ScheduleRURequirementTreeBuilder;
const semesterScheduleModel=ScheduleRUSemesterScheduleModel;
const {dayIndex,meetingTimeRange,formatClock,buildPermutations}=semesterScheduleModel;
const academicProgressModel=ScheduleRUAcademicProgressModel.create({
  getState:()=>ST,
  getApAwards:()=>AP,
  getRequirementTrees:()=>[ST.majorRequirementTree,ST.coreRequirementTree].filter(Boolean),
  courseRecordFromId,
  courseCodesFromText,
});
const {creditNumber}=ScheduleRUAcademicProgressModel;
const coreAllocationModel=ScheduleRUCoreAllocationModel.create({
  getGroups:()=>GROUPS,
  getRootGroupIds:()=>ROOT_GROUPS,
  isCourseCompleted:directlyCompletedCoreCourse,
  getSelectedApAwards:()=>AP.filter(ap=>ST.apOn[ap.id]),
  courseCodesFromText,
  requirementCourseId,
  isApAllowedForGroup:coreApAllowedForGroup,
});
const courseRecordModel=ScheduleRUCourseRecordModel.create({
  getState:()=>ST,
  getRequirementCourses:()=>COURSES,
  cleanText:cleanApiText,
  saveState:savePlannerState,
});
const coursePathModel=ScheduleRUCoursePathModel.create({
  getCourseById:id=>COURSES[id]||null,
  getCourseByCode:courseByCode,
  getEligibilityForCourse:course=>course?.eligibility||ST.courseEligibilityByCode?.[course?.code]||null,
  getConfirmedCourseCodes:confirmedAcademicCourseCodes,
  getScheduledEntries:plannedScheduleCreditEntries,
});
const homeSchoolTransaction=ScheduleRUHomeSchoolTransaction.create({
  getState:()=>ST,
  loadCandidate:loadHomeSchoolCandidate,
  applyRequirementTree:useRequirementTree,
  saveState:savePlannerState,
  onCommitted:()=>{updateProgramTitle();renderProgramSchoolSelector();renderOnboarding();},
  onRolledBack:()=>modalController.show({title:"Home school unchanged",body:"<p>We could not load that home school. Your current plan and requirements were kept.</p>",actions:[{label:"Close",secondary:true}]}),
  onLoadingChange:loading=>{if(!loading)renderProgramSchoolSelector();renderPanel();},
});
function plannerStorage(){ return typeof localStorage!=="undefined"?localStorage:null; }
function restorePlannerState(){
  const restored=ScheduleRUPlannerStateStore.load({
    storage:plannerStorage(),currentVersion:CURRENT_PLANNER_STATE_VERSION,
    migrate:ScheduleRUPlannerStateLogic.migratePlannerState,
  });
  if(restored)Object.assign(ST,restored);
}
function savePlannerState(){
  ScheduleRUPlannerStateStore.save({storage:plannerStorage(),state:ST,currentVersion:CURRENT_PLANNER_STATE_VERSION});
}
function clearPlannerState(){ ScheduleRUPlannerStateStore.clear({storage:plannerStorage()}); }
restorePlannerState();
Object.assign(ST,ScheduleRUPlannerStateLogic.migratePlannerState({...ST,selectedProgramIds:ST.selectedPrograms}));
ST.expandedIds=new Set();
const PAGE_SIZE = 25;

function activeBackendYear(){ return String(ST.activeYear||new Date().getFullYear()); }
function activeBackendTerm(){ return String(ST.activeTerm||"9"); }
function activeRegistrationSemester(){
  const term=activeBackendTerm().toLowerCase();
  return term==="1"||term==="spring" ? "spring" : "fall";
}
function ensureAcademicCalendarAnchor(){
  const existing=Number(ST.academicCalendarStartYear);
  if(Number.isInteger(existing))return existing;
  const activeYear=Number(ST.activeYear);
  if(!Number.isInteger(activeYear))return null;
  const anchor=ScheduleRUPlannerStateLogic.deriveAcademicCalendarStartYear(ST.academicPosition,activeYear);
  if(Number.isInteger(anchor)){ST.academicCalendarStartYear=anchor;savePlannerState();}
  return anchor;
}
function activePlanYear(){
  const anchor=ensureAcademicCalendarAnchor(),calendarYear=Number(activeBackendYear());
  if(!Number.isInteger(anchor)||!Number.isInteger(calendarYear))return Number(ST.academicPosition?.year)||1;
  const year=calendarYear-anchor+(activeRegistrationSemester()==="fall"?1:0);
  return Number.isInteger(year)&&year>=1?year:Number(ST.academicPosition?.year)||1;
}
function currentPlannerTerm(){
  return globalThis.ScheduleRUPlannerUI.activePlannerTerm({
    academicPosition:ST.academicPosition,
    activeSemester:activeRegistrationSemester(),
  });
}

/* AP fulfillment: build map courseId -> [apIds that fulfill it] */
const AP_FULFILLS = {};
AP.forEach(a => a.fulfills.forEach(cid => {
  if(!AP_FULFILLS[cid]) AP_FULFILLS[cid] = [];
  AP_FULFILLS[cid].push(a.id);
}));

let academicCreditController=null;
function confirmedAcademicCreditEntries(){
  return academicCreditController?.confirmedEntries()||academicProgressModel.confirmedCreditEntries();
}
function installAcademicCreditController(controller){academicCreditController=controller;}
function resolvedAcademicCourseCodes(codes){
  return academicProgressModel.resolvedCourseCodes(codes);
}
function confirmedAcademicCourseCodes(){
  return academicProgressModel.confirmedCourseCodes(confirmedAcademicCreditEntries());
}
function plannedScheduleCreditEntries(){
  return academicProgressModel.scheduledCreditEntries();
}
function courseEligibilityForTerm(course,term){
  return academicProgressModel.eligibilityForTerm(course,term,{
    confirmedEntries:confirmedAcademicCreditEntries(), scheduledEntries:plannedScheduleCreditEntries(),
  });
}
function plannerEligibilityLabel(result){
  if(result.status==="eligible_now") return "Eligible based on completed credit and reviewed rules";
  if(result.status==="planned_assumption") return "Works in this plan if earlier planned courses are completed";
  const missing=result.missing?.[0];
  if(missing?.type==="minimum_prior_credits") return "Requires "+missing.minimum_credits+" previously completed credits";
  if(missing?.type==="minimum_plan_year") return "Available starting in plan year "+missing.minimum_year;
  if(missing?.type==="corequisite_course") return "A reviewed co-requisite must be scheduled in the same term";
  if(missing?.type==="prerequisite_course") return "A reviewed prerequisite must be completed first";
  return "Eligibility needs review; verify with Rutgers before registration";
}
function reviewedEligibilityForCourse(course){
  return academicProgressModel.reviewedEligibility(course);
}
function courseEligibilityNotice(course,term){
  if(!reviewedEligibilityForCourse(course)) return "";
  const result=courseEligibilityForTerm(course,term);
  return result.status==="eligible_now" ? "" : plannerEligibilityLabel(result);
}

function apFulfillsRequirementCourse(ap,id,course){
  if((ap?.fulfills||[]).includes(id)) return true;
  const acceptedIds=new Set([id,requirementCourseId(course?.code)]);
  (course?.alternatives||[]).forEach(alt=>acceptedIds.add(requirementCourseId(alt?.code||alt?.equivalent_course_code)));
  return courseCodesFromText(ap?.equiv).some(code=>acceptedIds.has(requirementCourseId(code)));
}
function baseIsCompleted(id){
  if(ST.completed[id]) return true;
  const c = COURSES[id];
  if(c && Object.values(ST.schedule).some(e=>e.code===c.code)) return true;
  // A reviewed requirement may name a course that has an approved
  // alternative in the planner. Keep that relationship in the
  // requirements database; the interface only evaluates the data it gets.
  if(c && (c.alternatives||[]).some(alt=>{
    const code=alt.code||alt.course_code||"";
    const altId=requirementCourseId(code);
    return !!ST.completed[altId] || Object.values(ST.schedule).some(e=>e.code===code);
  })) return true;
  // AP awards can carry more than one official course equivalency. The
  // legacy fulfills map covers Core-specific ids; the course-code comparison
  // makes every official equivalency available to reviewed programs too.
  return AP.some(ap=>ST.apOn[ap.id]&&apFulfillsRequirementCourse(ap,id,c));
}
function isCompleted(id){return academicCreditController?academicCreditController.isCompleted(id):baseIsCompleted(id);}
function standingRequirement(c){
  const text=[c?.restrictions,...(c?.requirementNotes||[])].join(" ").toLowerCase();
  if(/seniors?\s+(year|standing|status|only)|4th\s+year/.test(text)) return {year:4,label:"Senior (4th-year) standing required"};
  if(/juniors?\s*(\/|or|and|-)?\s*seniors?|juniors?\s+(year|standing|status)|3rd\s+year/.test(text)) return {year:3,label:"Junior (3rd-year) standing required"};
  if(/all\s+except\s+(?:1st|first)[ -]?year|not\s+open\s+to\s+(?:1st|first)[ -]?year|except\s+(?:1st|first)[ -]?year/.test(text)) return {year:2,label:"Not open to first-year students"};
  return null;
}
function groupFulfilled(gk){
  return requirementProgressModel.groupFulfilled(gk);
}
function groupProgress(g){
  return requirementProgressModel.groupProgress(g);
}
function reviewedGroupSelectors(g){
  const engine=globalThis.ScheduleRUCourseSelectorLogic;
  if(!engine) return [];
  return (Array.isArray(g?.courseSelectors)?g.courseSelectors:[]).map(row=>{
    try{
      const raw=typeof row?.selector_json==="string" ? JSON.parse(row.selector_json) : row?.selector_json;
      return engine.normalizeSelector(raw);
    }catch(_){ return null; }
  }).filter(Boolean);
}
function selectedCourseRecords(excludeGroupId=""){
  const selections=Object.fromEntries(Object.entries(ST.groupSelections||{})
    .filter(([groupId])=>groupId!==excludeGroupId));
  return globalThis.ScheduleRUCourseInteractionLogic.selectedCourseCodes(
    selections,
    id=>COURSES[id] ? requirementCourseRecord(id) : courseRecordFromId(id),
  ).map(courseRecordFromId).filter(Boolean);
}
function plannedOrCompletedCourseRecords(excludeGroupId=""){
  const records=new Map();
  const add=record=>{
    const code=String(record?.code||"").trim();
    if(!/^\d{2}:\d{3}:\d{3}$/.test(code)) return;
    records.set(code,globalThis.ScheduleRUCourseInteractionLogic.mergeCourseRecords([
      records.get(code),record,{code},
    ]));
  };
  Object.values(ST.schedule||{}).forEach(entry=>add(entry?.course||entry));
  selectedCourseRecords(excludeGroupId).forEach(add);
  Object.entries(ST.completed||{}).forEach(([id,taken])=>{
    if(!taken) return;
    add(courseRecordFromId(id));
    const catalog=(ST.backendCourses||[]).find(row=>requirementCourseId(catalogCourseCode(row))===id);
    if(catalog) add(backendCourseRecord(catalog));
  });
  return [...records.values()];
}
function registerSelectorCourseRecord(record){
  const code=String(record?.code||"").trim();
  const id=requirementCourseId(code);
  if(!id) return null;
  const existing=COURSES[id]||{};
  const incoming={
    code,
    title:cleanApiText(record?.fullTitle)||cleanApiText(record?.title),
    fullTitle:cleanApiText(record?.fullTitle)||cleanApiText(record?.title),
    credits:record?.credits,
    description:cleanApiText(record?.description),
    catalogPrereqs:cleanApiText(record?.catalogPrereqs),
    subjectNotes:cleanApiText(record?.subjectNotes),
    restrictions:cleanApiText(record?.restrictions),
  };
  COURSES[id]=globalThis.ScheduleRUCourseInteractionLogic.mergeCourseRecords([
    existing,incoming,{
      code,title:code,fullTitle:code,credits:"",
      requirementNotes:[],prereqs:[],alternatives:[],
    },
  ]);
  return id;
}
function baseGroupAppliedCourseIds(g){
  const selectedElsewhere=new Set(selectedCourseRecords(g?.id).map(record=>record.code));
  const explicit=(g?.members||[]).filter(id=>isCompleted(id)||selectedElsewhere.has(COURSES[id]?.code));
  const selectors=reviewedGroupSelectors(g);
  const engine=globalThis.ScheduleRUCourseSelectorLogic;
  if(!selectors.length||!engine) return explicit;
  const selectorMatches=plannedOrCompletedCourseRecords(g?.id)
    .filter(record=>engine.matchesAnySelector(record,selectors))
    .map(registerSelectorCourseRecord)
    .filter(Boolean);
  return [...new Set([...explicit,...selectorMatches])];
}
const requirementProgressModel=ScheduleRURequirementProgressModel.create({
  getGroups:()=>GROUPS,
  getState:()=>({
    completed:ST.completed,apOn:ST.apOn,schedule:ST.schedule,groupSelections:ST.groupSelections,
  }),
  isCompleted,selectedRequirementCourses,isConstraintGroup,
  baseAppliedCourseIds:baseGroupAppliedCourseIds,
  courseCredits:id=>creditNumber(COURSES[id]?.credits),
});
function groupAppliedCourseIds(g){
  return requirementProgressModel.groupAppliedCourseIds(g);
}
function selectorGuidanceHtml(g){
  const raw=Array.isArray(g?.courseSelectors)?g.courseSelectors:[];
  if(!raw.length) return "";
  const engine=globalThis.ScheduleRUCourseSelectorLogic;
  const selectors=reviewedGroupSelectors(g);
  const descriptions=selectors.map(selector=>engine.selectorDescription(selector));
  const corrected=selectors.length===raw.length;
  const rule=descriptions.length ? descriptions.join("; ") : "this reviewed course rule";
  const action=corrected
    ? `<div class="choice-actions"><button class="choice-btn" data-gbrowse="${escapeHtml(g.id)}">Browse matching courses</button></div>`
    : "";
  return `<div class="choice-summary">Scheduled and completed courses matching ${escapeHtml(rule)} apply here automatically. Browse the matching catalog, add a course to your wishlist, then place it in your plan.${corrected?"":" A reviewed course rule needs correction before it can be applied."}</div>${action}`;
}

/* ============================================================
   TOP-LEVEL PAGE SWITCH (Planner / Courses)
   ============================================================ */
function setTopLevelPage(page){
  ST.page=page==="courses"?"courses":"nav";
  document.querySelectorAll(".pagenav-btn").forEach(button=>button.classList.toggle("active",button.dataset.page===ST.page));
  document.getElementById("page-nav").style.display=ST.page==="nav" ? "" : "none";
  document.getElementById("page-courses").style.display=ST.page==="courses" ? "" : "none";
  if(ST.page==="courses") renderCoursesPage();
}
document.querySelectorAll(".pagenav-btn").forEach(b=>b.addEventListener("click", ()=>{
  setTopLevelPage(b.dataset.page);
}));

/* ============================================================
   PROGRAM SELECTION
   ============================================================ */
const DEFAULT_PROGRAM_TYPE_SECTIONS=[
  {type:"major",label:"Majors",singular:"Major"},
  {type:"minor",label:"Minors",singular:"Minor"},
  {type:"concentration",label:"Concentrations and tracks",singular:"Concentration or track"},
  {type:"certificate",label:"Certificates",singular:"Certificate"},
];
function programTypeSections(){
  const configured=activeSchoolContext().programTypeSections;
  if(!Array.isArray(configured)) return DEFAULT_PROGRAM_TYPE_SECTIONS;
  const byType=new Map(configured.filter(section=>section&&typeof section.type==="string").map(section=>[section.type,section]));
  return DEFAULT_PROGRAM_TYPE_SECTIONS.map(fallback=>{
    const section=byType.get(fallback.type)||{};
    return {
      type:fallback.type,
      label:typeof section.label==="string"&&section.label.trim()?section.label.trim():fallback.label,
      singular:typeof section.singular==="string"&&section.singular.trim()?section.singular.trim():fallback.singular,
    };
  });
}
function programTypeLabel(type){
  const section=programTypeSections().find(item=>item.type===type);
  return section?.singular||"Program";
}
function selectedProgramRows(){
  const selected=new Set(ST.selectedPrograms);
  return (ST.availablePrograms||[]).filter(program=>selected.has(program.id));
}
function activeHomeSchoolLabel(){
  return activeSchoolContext().label;
}
function selectionLimitSummary(){
  const limits=ST.programSelectionPolicies?.limits||[];
  if(!limits.length) return "No reviewed program-count limits are available yet for this home school.";
  const phrases=limits.map(limit=>{
    const count=Number(limit.max_selected);
    return `up to ${count} ${programTypeLabel(limit.program_type).toLowerCase()}${count===1?"":"s"}`;
  });
  return `Reviewed ${activeHomeSchoolLabel()} selection limits: ${phrases.join(", ")}.`;
}
function programCoverageLabel(program){
  return program?.requirements_available===false || program?.coverage_status==="catalog_listed"
    ? "Official catalog listing"
    : "Reviewed requirements";
}
function showProgramPolicyFeedback(check){
  const node=document.getElementById("programPolicyFeedback");
  if(!node) return;
  const issues=[...(check?.errors||[]),...(check?.warnings||[])];
  if(!issues.length){ node.className="program-policy-feedback"; node.textContent=""; return; }
  node.className=`program-policy-feedback ${check?.errors?.length?"warn":"info"}`;
  node.innerHTML=issues.map(issue=>`<div>${escapeHtml(issue.message||issue.note||"This selection needs review.")}</div>`).join("");
}
function updateProgramTitle(){
  document.getElementById("topSchoolTitle").textContent=activeHomeSchoolLabel();
}
function renderProgramSchoolSelector(){
  const select=document.getElementById("programSchoolSelect");
  const help=document.getElementById("programSchoolHelp");
  if(!select||!help)return;
  const schools=ST.availableSchools||[];
  select.innerHTML=schools.map(school=>`<option value="${escapeHtml(school.slug)}">${escapeHtml(school.name||school.short_name||school.slug)}</option>`).join("");
  select.value=ST.homeSchoolSlug;
  select.disabled=schools.length<2;
  help.textContent=schools.length<2
    ? "More Rutgers schools will appear here only after their curriculum and policy data are reviewed."
    : "Changing your home school re-evaluates your program requirements. Your planned courses stay in your browser.";
  select.onchange=()=>changeHomeSchool(select.value);
}
async function loadHomeSchoolCandidate(nextSchool){
  const schoolContext=schoolContextForProfile(nextSchool);
  const [programContext,coreContext]=await Promise.all([
    requirementDataLoader.loadPrograms({homeSchoolSlug:nextSchool.slug,scope:"school"}),
    requirementDataLoader.loadCoreCurriculum({homeSchoolSlug:nextSchool.slug,label:schoolContext.coreFallbackLabel}),
  ]);
  const availablePrograms=ScheduleRUProgramPickerLogic.availableProgramsForSchool(programContext.programs,nextSchool.slug);
  if(!availablePrograms.length)throw new Error("No reviewed program is available for that home school.");
  const curriculum=coreContext.curriculum;
  const selectedPrograms=ScheduleRUProgramPickerLogic.initialProgramIds({
    restoredIds:[],
    programs:availablePrograms,
    onboardingCompleted:ST.onboarding?.completed===true,
    selectionConfirmed:ST.programSelectionConfirmed===true,
    defaultProgramId:schoolContext.defaultProgramId,
  });
  const referenceTypes=schoolContext.sharedRequirementReferenceTypes||[],referencePrograms=availablePrograms.filter(program=>program.requirements_available!==false&&referenceTypes.includes(program.type));
  const [requirementsContext,referenceRequirementTrees]=await Promise.all([
    requirementDataLoader.loadRequirements({programIds:selectedPrograms,homeSchoolSlug:nextSchool.slug}),
    requirementDataLoader.loadReferenceRequirements({programIds:referencePrograms.map(program=>program.id)}),
  ]);
  const returned=requirementsContext.requirements,visibleIds=selectedPrograms.filter(id=>Array.isArray(returned[id]));
  if(selectedPrograms.length&&!visibleIds.length)throw new Error("The replacement program requirements could not be loaded.");
  const requirementTrees=programRequirementModel.normalizeProgramTrees({requirementTrees:returned,programIds:visibleIds,referenceRequirementTrees,availablePrograms});
  const doubleCountPolicies=requirementsContext.doubleCountPolicies,doubleCountExceptions=requirementsContext.doubleCountExceptions;
  const roles=ScheduleRUProgramPickerLogic.programRoles(visibleIds,availablePrograms);
  return {
    homeSchoolSlug:nextSchool.slug,availablePrograms,programSelectionPolicies:programContext.selectionPolicies,
    selectedPrograms:visibleIds,groupSelections:{},referenceRequirementTrees,requirementTrees,
    catalogListedProgramIds:requirementsContext.catalogListedProgramIds,doubleCountPolicies,
    doubleCountRules:requirementsContext.doubleCountRules,doubleCountExceptions,
    programEligibilityRules:requirementsContext.eligibilityRules,majorRequirementTree:buildRequirementTree(programRequirementModel.requirementsForDisplay({requirementTrees,programIds:visibleIds})),
    activeProgram:availablePrograms.find(program=>program.id===visibleIds[0])||null,
    doubleCount:visibleIds.length?programRequirementModel.computeDoubleCount({requirementTrees,programIds:visibleIds,availablePrograms,doubleCountExceptions,doubleCountPolicies}):null,
    requirementsError:"",coreCurricula:coreContext.curricula,activeCoreCurriculum:curriculum,
    coreRequirementTree:buildRequirementTree(coreContext.requirements),coreError:"",...roles,
  };
}
async function changeHomeSchool(nextSchoolSlug,confirmed=false){
  const next=schoolProfileBySlug(nextSchoolSlug);
  if(!next||next.slug===ST.homeSchoolSlug)return;
  if(ST.selectedPrograms.length&&!confirmed){
    modalController.show({title:"Change home school?",body:`<p>Your planned courses stay saved. Program selections and requirement choices will be re-evaluated for ${escapeHtml(next.name||next.short_name||next.slug)}.</p>`,actions:[{label:"Go back",secondary:true},{label:"Continue",onClick:()=>changeHomeSchool(nextSchoolSlug,true)}]});
    renderProgramSchoolSelector();return;
  }
  return homeSchoolTransaction.execute(next);
}
/* ============================================================
   PANEL EXPAND
   ============================================================ */
document.getElementById("expandBtn").addEventListener("click", () => {
  ST.panelFull = !ST.panelFull;
  document.getElementById("app").classList.toggle("panel-full", ST.panelFull);
  document.getElementById("expandBtn").textContent = ST.panelFull ? "⟶" : "⟵";
});

/* ============================================================
   AP MODAL
   ============================================================ */
document.getElementById("apBtn").addEventListener("click", () => {
  const list = document.getElementById("apList");
  list.innerHTML = AP.map(a => `
    <label class="ap-label">
      <input type="checkbox" data-ap="${a.id}" ${ST.apOn[a.id]?"checked":""} />
      <span>${a.name} <span class="ap-eq">→ ${a.equiv} (${a.credits} cr)</span></span>
    </label>`).join("");
  list.querySelectorAll("input").forEach(cb => {
    cb.addEventListener("change", e => {
      ST.apOn[e.target.dataset.ap] = e.target.checked;
      renderAll();
    });
  });
  document.getElementById("apOv").classList.add("open");
});
document.getElementById("apClose").addEventListener("click", () =>
  document.getElementById("apOv").classList.remove("open"));

/* ============================================================
   COURSE DETAILS MODAL
   ============================================================ */
function courseCodesFromText(text){
  return [...new Set((String(text||"").match(/\b\d{2}:\d{3}:\d{3}\b/g)||[]))];
}
function courseCreditsLabel(credits, abbreviated=false){
  const value=String(credits??"").trim();
  if(!value) return "Credits not listed";
  return abbreviated?`${value} cr`:`${value} credits`;
}
function courseByCode(code){
  return Object.values(COURSES).find(course=>course.code===code) || wishlistRecords().find(course=>course.code===code);
}
function prerequisiteEligibilityForTerm(course,term){
  return coursePathModel.eligibilityForTerm(course,term);
}
function prerequisiteBlockerLabel(result){
  const missing=result?.recommendedPath?.missing||[];
  if(!missing.length) return "A prerequisite must be completed before this semester";
  const names=missing.map(item=>{
    const known=courseByCode(item.course_code);
    const reference=(result.plan?.references||[]).find(row=>row.course_code===item.course_code);
    return known?.fullTitle||known?.title||reference?.title||item.course_code;
  });
  const same=missing.some(item=>item.reason==="same_term");
  const later=missing.some(item=>item.reason==="later_term");
  const prefix=result.plan?.paths?.length>1?"Choose a prerequisite path and complete ":"Complete ";
  const timing=same?" in an earlier semester (not the same semester)":later?" before moving this course earlier":" before this semester";
  return prefix+names.join(", ")+timing;
}
let courseDetailsController=null;
function installCourseDetailsController(controller){courseDetailsController=controller;}
function openCourseDetails(id){return courseDetailsController?.open(id);}

/* ============================================================
   LARGE REQUIREMENT GROUP PICKER
   ============================================================ */
let requirementPickerController=null;
function installRequirementPickerController(controller){requirementPickerController=controller;}
function openRequirementPicker(gk){return requirementPickerController?.open(gk);}
function groupAcceptsCourseId(g,id){
  if((g?.members||[]).includes(id))return true;
  const record=COURSES[id] ? requirementCourseRecord(id) : courseRecordFromId(id);
  return !!record&&globalThis.ScheduleRUCourseSelectorLogic.matchesAnySelector(record,reviewedGroupSelectors(g));
}

/* ============================================================
   COURSE RECORDS — one shape for requirements, catalog, wishlist and plan
   ============================================================ */
function catalogCourseCode(c){
  return courseRecordModel.catalogCourseCode(c);
}
function requirementCourseRecord(id){
  return courseRecordModel.requirementCourseRecord(id);
}
function backendCourseRecord(c){
  return courseRecordModel.backendCourseRecord(c);
}
function courseRecordFromId(ref){
  return courseRecordModel.courseRecordFromId(ref);
}
function addToWishlist(ref, explicitRecord=null){
  return courseRecordModel.addToWishlist(ref,explicitRecord);
}
function wishlistRecords(){
  return courseRecordModel.wishlistRecords();
}

/* ============================================================
   SCHEDULE
   ============================================================ */
function academicYearLabel(year){const value=Number(year),suffix=value%100>=11&&value%100<=13?"th":value%10===1?"st":value%10===2?"nd":value%10===3?"rd":"th";return Number.isInteger(value)&&value>0?`${value}${suffix} Year`:"Selected Year";}
function plannerDisplayMaxYear(){const year=Math.min(4,Math.max(1,Number(ST.academicPosition?.year)||1)),startingSemester=ST.academicPosition?.startingSemester==="spring"?"spring":"fall";return year+(startingSemester==="spring"?4:3);}
document.getElementById("yPrev").addEventListener("click", ()=>{if(ST.year>1){ST.year--;renderAll();}});
document.getElementById("yNext").addEventListener("click", ()=>{if(ST.year<plannerDisplayMaxYear()){ST.year++;renderAll();}});

function renderSchedule(){
  const displayMaxYear=plannerDisplayMaxYear();
  if(ST.year>displayMaxYear)ST.year=displayMaxYear;
  document.getElementById("yLabel").textContent = academicYearLabel(ST.year);
  document.getElementById("yPrev").disabled = ST.year===1;
  document.getElementById("yNext").disabled = ST.year===displayMaxYear;
  const currentTerm=currentPlannerTerm();
  ["fall","spring"].forEach(sem => {
    const zoneId = sem[0]+"z";
    const crId = sem[0]+"cr";
    const zone = document.getElementById(zoneId);
    const builderAvailable=globalThis.ScheduleRUPlannerUI.canOpenSemesterBuilder({
      displayedYear:ST.year,
      activeYear:currentTerm.year,
      semester:sem,
      activeSemester:currentTerm.semester,
    });
    const plus=document.querySelector(`[data-semplus="${sem}"]`);
    if(plus){plus.hidden=!builderAvailable;plus.disabled=!builderAvailable;}
    const codes = Object.keys(ST.schedule).filter(code=>{
      const e=ST.schedule[code]; return e.year===ST.year&&e.sem===sem;
    });
    const placeholders=(ST.planPlaceholders||[]).filter(placeholder=>placeholder.year===ST.year&&placeholder.sem===sem);
    let total=0;
    if(!codes.length&&!placeholders.length){ zone.innerHTML=`<div class="empty">${builderAvailable?"Drag a course here, or use + to build a real schedule":"Drag a course here to plan this semester"}</div>`; }
    else {
      const courseCards=codes.map(code=>{
        const e=ST.schedule[code]; total+=parseFloat(e.credits)||0;
        const eligibilityNote=courseEligibilityNotice(e.course||courseRecordFromId(e.code),{year:e.year,sem:e.sem});
        return `<div class="sc-card" draggable="true" data-id="${code}">
          <div class="sc-card-main">
            <div class="sn">${escapeHtml(e.code)}${e.locked?' <span class="sched-locked">SET</span>':''}</div>
            <div class="stitle" title="${escapeHtml(e.fullTitle||e.title||e.code)}">${escapeHtml(e.fullTitle||e.title||e.code)}</div>
            ${eligibilityNote?`<span class="sct">${escapeHtml(eligibilityNote)}</span>`:""}
            ${e.manualOverrides?.length?`<span class="sct" style="color:#9b5d00;">Override · ${escapeHtml(e.manualOverrides.map(item=>item.kind.replaceAll("_"," ")).join(", "))}</span>`:""}
            <span class="sct">${escapeHtml(courseCreditsLabel(e.credits,true))}${e.section_number?` · Sec ${escapeHtml(e.section_number)}`:''}</span>
          </div>
          <div class="sc-card-actions"><button class="placement-lock" data-placement-lock="${escapeHtml(code)}" aria-label="${e.locked?"Unlock":"Lock"} ${escapeHtml(e.code)}">${e.locked?"Unlock":"Lock"}</button><button class="rx" data-rem="${escapeHtml(code)}">✕</button></div></div>`;
      }).join("");
      const placeholderCards=placeholders.map(placeholder=>{const credits=Number(placeholder.estimatedCredits||placeholder.credits)||3;total+=credits;return `<div class="sc-card plan-placeholder-card"><div class="sc-card-main"><div class="sn">TO BE SELECTED</div><div class="stitle">${escapeHtml(placeholder.label||"Unresolved requirement")}</div><span class="sct">Estimated ${escapeHtml(courseCreditsLabel(credits,true))}</span></div><div class="sc-card-actions"><button class="placement-lock" data-plan-placeholder="${escapeHtml(placeholder.id)}">Choose</button></div></div>`;}).join("");
      zone.innerHTML=courseCards+placeholderCards;
    }
    document.getElementById(crId).textContent = placeholders.length?`${total} estimated credits`:`${total} credits`;
  });
  document.querySelectorAll("[data-rem]").forEach(b=>
    b.addEventListener("click",e=>{delete ST.schedule[e.target.dataset.rem];renderAll();}));
  document.querySelectorAll("[data-placement-lock]").forEach(button=>button.addEventListener("click",event=>{
    event.stopPropagation();const entry=ST.schedule[button.dataset.placementLock];if(!entry)return;entry.userPinned=!entry.userPinned;entry.locked=entry.userPinned;savePlannerState();renderAll();
  }));
  document.querySelectorAll("[data-plan-placeholder]").forEach(button=>button.addEventListener("click",event=>{
    event.stopPropagation();focusPlanPlaceholder(button.dataset.planPlaceholder);
  }));
  document.querySelectorAll(".sc-card[data-id]").forEach(card=>card.addEventListener("click",e=>{
    if(e.target.closest("[data-rem]")) return;
    openCourseDetails(card.dataset.id);
  }));
  document.querySelectorAll(".sc-card[data-id]").forEach(card=>card.addEventListener("dragstart",event=>{
    event.dataTransfer.setData("cid",card.dataset.id);event.dataTransfer.setData("schedule-cid",card.dataset.id);
  }));
  setupDropZones();
  const scheduledTotal = Object.values(ST.schedule).reduce((s,e)=>s+(parseFloat(e.credits)||0),0);
  const placeholderTotal=(ST.planPlaceholders||[]).reduce((sum,placeholder)=>sum+(Number(placeholder.estimatedCredits||placeholder.credits)||3),0);
  const total=scheduledTotal+placeholderTotal;
  document.getElementById("pill").textContent = placeholderTotal?`${total} / 120 estimated credits planned`:`${total} / 120 credits planned`;
}

function openCorePlaceholderCourseBrowser(placeholder,group){
  const context=placeholder?.candidateSelectionContext||{};
  const selectorRows=group?.courseSelectors?.length?group.courseSelectors:(context.courseSelectors||[]);
  const selectors=reviewedGroupSelectors({courseSelectors:selectorRows});
  const courseCodes=[...new Set([
    ...(context.memberCourseCodes||[]),
    ...(group?.members||[]).map(id=>ST.coreRequirementTree?.courses?.[id]?.code),
  ].filter(code=>/^\d{2}:\d{3}:\d{3}$/.test(code)))];
  if(!selectors.length&&courseCodes.length)selectors.push({
    version:1,
    kind:"course_codes",
    label:`Approved courses for ${placeholder?.label||groupDisplayName(group)}`,
    include_course_codes:courseCodes,
    exclude_course_codes:[],
  });
  ST.activeRequirementChoice=ScheduleRURequirementChoiceModel.createIntent({
    placeholder:{
      ...placeholder,
      candidateSelectionContext:{...context,memberCourseCodes:courseCodes,courseSelectors:selectors},
    },
    group,
    returnPage:"nav",
  });
  ST.backendRequirementFilter={
    group:group||{id:placeholder?.requirementGroupId,name:placeholder?.label||"Core requirement"},
    selectors,
  };
  ST.backendSelectorGroupId=null;ST.backendSearch="";ST.backendSubject="";ST.backendPage=1;ST.expandedIds.clear();
  savePlannerState();
  setTopLevelPage("courses");loadBackendCourses();
}

function planPlaceholderSourceType(placeholder){
  const sourceProgram=placeholder?.sourceProgram||placeholder?.candidateSelectionContext?.sourceProgram;
  if(
    placeholder?.sourceType==="core"
    ||sourceProgram===ST.activeCoreCurriculum?.id
    ||ST.coreCurricula?.some(curriculum=>curriculum.id===sourceProgram)
    ||ST.coreRequirementTree?.groups?.[placeholder?.requirementGroupId]
  )return "core";
  return "program";
}

async function focusPlanPlaceholder(placeholderId){
  const placeholder=(ST.planPlaceholders||[]).find(item=>item.id===placeholderId);if(!placeholder)return;
  const sourceProgramIds=placeholder.candidateSelectionContext?.sourceProgramIds||[];
  const sourceProgram=sourceProgramIds.find(id=>ST.selectedPrograms.includes(id))||placeholder.sourceProgram;
  let placeholderSourceType=planPlaceholderSourceType(placeholder);
  if(
    placeholderSourceType==="program"
    &&sourceProgram
    &&!ST.selectedPrograms.includes(sourceProgram)
    &&!ST.coreRequirementTree
    &&!ST.coreLoading
  ){
    await loadCoreCurriculum();
    placeholderSourceType=planPlaceholderSourceType(placeholder);
  }
  ST.tab=placeholderSourceType==="core"?"core":"required";
  if(ST.tab==="required"&&ST.selectedPrograms.includes(sourceProgram))ST.requiredProgramTab=sourceProgram;
  document.querySelectorAll(".tab-btn").forEach(button=>button.classList.toggle("active",button.dataset.tab===ST.tab));renderPanel();
  requestAnimationFrame(()=>{
    const tree=placeholderSourceType==="core"?ST.coreRequirementTree:ST.majorRequirementTree;
    let group=GROUPS[placeholder.requirementGroupId]||tree?.groups?.[placeholder.requirementGroupId];
    if(group&&!GROUPS[placeholder.requirementGroupId])GROUPS[placeholder.requirementGroupId]=group;
    if(!group&&placeholder.candidateSelectionContext){
      const context=placeholder.candidateSelectionContext;
      const memberIds=(context.members||[]).filter(id=>COURSES[id])
        .concat((context.memberCourseCodes||[]).flatMap(code=>Object.keys(COURSES).filter(id=>COURSES[id]?.code===code)));
      group={
        id:placeholder.requirementGroupId,
        name:placeholder.label,
        rule:context.rule,
        count:context.required,
        members:[...new Set(memberIds)],
        children:context.children||[],
        courseSelectors:context.courseSelectors||[],
      };
      GROUPS[placeholder.requirementGroupId]=group;
    }
    const destination=globalThis.ScheduleRUPlannerUI.placeholderDestination({
      sourceType:placeholderSourceType,
      group,
      candidateSelectionContext:placeholder.candidateSelectionContext,
    });
    if(destination==="course_catalog"){openCorePlaceholderCourseBrowser(placeholder,group);return;}
    if(destination==="requirement_picker"){openRequirementPicker(placeholder.requirementGroupId);return;}
    if(destination==="selector_browser"){openSelectorCourseBrowser(placeholder.requirementGroupId);return;}
    const toggle=[...document.querySelectorAll("[data-gtog]")].find(node=>node.dataset.gtog===placeholder.requirementGroupId);
    if(!toggle)return;
    document.getElementById("gb-"+placeholder.requirementGroupId)?.classList.add("open");
    toggle.scrollIntoView({block:"center",behavior:"smooth"});
  });
}

// A course already locked into a DIFFERENT semester (confirmed via the
// schedule builder) can't be double-booked into this one.
function lockedElsewhere(code, year, sem){
  const e = ST.schedule[code];
  return e && e.locked && (e.year!==year || e.sem!==sem);
}

function setupDropZones(){
  document.querySelectorAll(".dz").forEach(z=>{
    z.ondragover=e=>{e.preventDefault();z.classList.add("over");};
    z.ondragleave=()=>z.classList.remove("over");
    z.ondrop=async e=>{
      e.preventDefault();z.classList.remove("over");
      const cid=e.dataTransfer.getData("cid");
      if(!cid) return;
      const record=courseRecordFromId(cid);
      if(!record) return;
      const sem=z.dataset.sem;
      let code, title, fullTitle, credits;
      if(COURSES[cid]){
        code=record.code; title=record.title; fullTitle=record.fullTitle; credits=record.credits;
      } else {
        code=record.code; title=record.title; fullTitle=record.fullTitle; credits=record.credits;
      }
      const movingScheduled=e.dataTransfer.getData("schedule-cid")===code;
      if(lockedElsewhere(code, ST.year, sem)&&!movingScheduled){
        modalController.show({title:"Course already locked",body:`<p>${escapeHtml(code)} is already scheduled with a chosen section for a different semester. Remove it there first.</p>`,actions:[{label:"Close",secondary:true}]});
        return;
      }
      await loadCourseEligibilityForCodes([record.code]);
      const prerequisiteEligibility=prerequisiteEligibilityForTerm(record,{year:ST.year,sem});
      const eligibility=courseEligibilityForTerm(record,{year:ST.year,sem});
      const prev = ST.schedule[code];
      const currentCredits=Object.values(ST.schedule).filter(entry=>
        entry.code!==code&&entry.year===ST.year&&entry.sem===sem
      ).reduce((sum,entry)=>sum+(Number(entry.credits)||0),0)
        +(ST.planPlaceholders||[]).filter(item=>item.year===ST.year&&item.sem===sem)
          .reduce((sum,item)=>sum+(Number(item.estimatedCredits||item.credits)||3),0);
      const warnings=globalThis.ScheduleRUCourseInteractionLogic.manualPlacementWarnings({
        currentCredits,incomingCredits:Number(prev?.credits??credits)||0,
        prerequisiteBlocked:prerequisiteEligibility.status==="blocked",
        prerequisiteReason:prerequisiteBlockerLabel(prerequisiteEligibility),
        standingBlocked:eligibility.status==="blocked"
          && (eligibility.missing||[]).some(item=>item.type!=="prerequisite_course"),
        standingReason:plannerEligibilityLabel(eligibility),
      });
      const commitPlacement=()=>{
        ST.schedule[code] = {
          year:ST.year, sem, code,
          title: prev?.title || title, fullTitle: prev?.fullTitle || fullTitle || title, credits: prev?.credits ?? credits,
          course: prev?.course || record,
          sectionId: prev?.sectionId, index_number: prev?.index_number,
          section_number: prev?.section_number, meetings: prev?.meetings,
          locked:true, userPinned:true,manualOverrides:warnings,
          eligibilityStatus:eligibility.status, eligibilityAssumptions:eligibility.assumptions,
        };
        renderAll();
      };
      if(!warnings.length){commitPlacement();return;}
      const onlyCredit=warnings.length===1&&warnings[0].kind==="credit_limit";
      modalController.show({
        title:onlyCredit?"Override 18-credit limit?":"Place course with override?",
        body:`<p>${escapeHtml(code)} needs your confirmation for ${escapeHtml(sem)} of ${escapeHtml(academicYearLabel(ST.year))}.</p><ul>${warnings.map(item=>`<li>${escapeHtml(item.reason)}</li>`).join("")}</ul>`,
        actions:[
          {label:"Go back",secondary:true},
          {label:onlyCredit?"Override 18-credit limit":warnings.length===1?"Place with override":"Place with overrides",onClick:commitPlacement},
        ],
      });
    };
  });
}

/* ============================================================
   TABS
   ============================================================ */
document.querySelectorAll(".tab-btn").forEach(b=>b.addEventListener("click",()=>{
  document.querySelectorAll(".tab-btn").forEach(x=>x.classList.remove("active"));
  b.classList.add("active"); ST.tab=b.dataset.tab; renderPanel();
  if(ST.tab==="core" && !ST.coreRequirementTree && !ST.coreLoading) loadCoreCurriculum();
}));

/* ============================================================
   COURSE CARD (requirements panel)
   ============================================================ */
function cardHtml(id, opts={}){
  const c=COURSES[id];
  if(!c) return "";
  const done=isCompleted(id);
  const record=requirementCourseRecord(id);
  const fallEligibility=prerequisiteEligibilityForTerm(record,{year:ST.year,sem:"fall"});
  const springEligibility=prerequisiteEligibilityForTerm(record,{year:ST.year,sem:"spring"});
  const standing=standingRequirement(c);
  const ok=(fallEligibility.status!=="blocked" || springEligibility.status!=="blocked") && (!standing || ST.year>=standing.year);
  const gray=!done&&!ok;
  const alternative=(c.alternatives||[]).find(alt=>{
    const code=alt.code||alt.course_code||"";
    return !!ST.completed[requirementCourseId(code)] || Object.values(ST.schedule).some(e=>e.code===code);
  });
  return `<div class="cc${gray?" gr":""}${done?" done":""}" draggable="${!gray}" data-cid="${id}">
    <div class="chk${done?" on":""}" data-chk="${id}"></div>
    ${opts.plus?`<div class="plus-btn" data-plus="${id}">+</div>`:""}
    <div class="code">${c.code}</div>
    <div class="ttl">${c.title}</div>
    <div class="meta">${c.credits} cr</div>
    ${alternative?`<div class="restr">Satisfied by ${escapeHtml(alternative.code||alternative.course_code||"approved alternative")}</div>`:standing?`<div class="restr">${standing.label}</div>`:c.restrictions?`<div class="restr">${c.restrictions}</div>`:""}
  </div>`;
}

function attachCardEvents(el){
  el.querySelectorAll("[data-cid]").forEach(card=>{
    card.addEventListener("dragstart",e=>e.dataTransfer.setData("cid",card.dataset.cid));
    card.addEventListener("click",()=>openCourseDetails(card.dataset.cid));
  });
  el.querySelectorAll("[data-chk]").forEach(d=>d.addEventListener("click",e=>{
    e.stopPropagation(); const id=d.dataset.chk;
    ST.completed[id]=!ST.completed[id]; renderAll();
  }));
  el.querySelectorAll("[data-plus]").forEach(d=>d.addEventListener("click",e=>{
    e.stopPropagation(); addToWishlist(d.dataset.plus); renderAll();
  }));
  el.querySelectorAll("[data-plan-choice-group]").forEach(button=>button.addEventListener("click",event=>{
    event.stopPropagation();setRequirementChoice(button.dataset.planChoiceGroup,button.dataset.planChoiceItem);
  }));
}

/* ============================================================
   TAB 1: REQUIRED
   ============================================================ */
function groupRuleLabel(g){
  if(g.rule==="one_of") return "complete one approved sequence";
  if(g.rule==="min") return `choose at least ${g.count}`;
  if(g.rule==="max") return `choose up to ${g.count}`;
  if(g.rule==="min_credits") return `complete at least ${g.count} credits`;
  if(g.rule==="max_credits") return `apply up to ${g.count} credits`;
  if(g.rule==="distinct") return `choose ${g.count} across distinct goals`;
  return "all required";
}
function isCreditRule(g){
  return g?.rule==="min_credits"||g?.rule==="max_credits";
}
function groupDisplayName(g){
  if(/^choose 1$/i.test(g.name||"") && (g.members||[]).length){
    return `Choose 1: ${g.members.map(id=>COURSES[id]?.code||id).join(" or ")}`;
  }
  return g.name || "Requirement group";
}
const PICKER_THRESHOLD=6;
function isPickerGroup(g){
  return !!g && g.rule!=="all"&&g.rule!=="one_of"&&!isCreditRule(g) && (g.members||[]).length>PICKER_THRESHOLD;
}
function selectedRequirementCourses(gk){
  const group=GROUPS[gk];
  // Once a course is scheduled or marked complete, it is applied
  // automatically. Preserve an older manual selection in saved state so it
  // can reappear if that course is later removed from the plan.
  return [...new Set(ST.groupSelections[gk]||[])].filter(id=>groupAcceptsCourseId(group,id)&&!isCompleted(id));
}
function selectionLimit(g){
  return Math.max(1,Number(g?.count)||1);
}
function isConstraintGroup(g){
  const parent=GROUPS[g?.parentId];
  if(!parent || parent.rule==="distinct") return false;
  if(g?.members?.length && parent.members?.length){
    const parentMembers=new Set(parent.members);
    return g.members.every(id=>parentMembers.has(id));
  }
  const engine=globalThis.ScheduleRUCourseSelectorLogic;
  const childSelectors=reviewedGroupSelectors(g);
  const parentSelectors=reviewedGroupSelectors(parent);
  return !!engine && childSelectors.length>0 && parentSelectors.length>0
    && childSelectors.every(child=>parentSelectors.some(parentSelector=>engine.selectorIsSubset(child,parentSelector)));
}
function constraintSelectionCount(g){
  const parent=GROUPS[g?.parentId];
  if(!parent) return 0;
  const plannedOrCompleted=new Set([
    ...selectedRequirementCourses(parent.id),
    ...groupAppliedCourseIds(parent),
  ]);
  return groupAppliedCourseIds(g).filter(id=>plannedOrCompleted.has(id)).length;
}
function parentSelectionConstraintViolation(parent, proposed){
  const limit=selectionLimit(parent);
  const planned=new Set([...proposed,...groupAppliedCourseIds(parent)]);
  if(parent.rule==="distinct" && planned.size===limit){
    const distinct=(parent.children||[]).map(id=>GROUPS[id]).filter(Boolean)
      .filter(child=>(child.members||[]).some(id=>planned.has(id))).length;
    if(distinct<parent.count){
      return `${groupDisplayName(parent)} needs ${parent.count} courses that cover ${parent.count} distinct Arts and Humanities goals.`;
    }
  }
  for(const childId of parent.children||[]){
    const child=GROUPS[childId];
    if(!isConstraintGroup(child)) continue;
    const chosen=groupAppliedCourseIds(child).filter(id=>planned.has(id)).length;
    if(child.rule==="max" && chosen>child.count){
      return `${groupDisplayName(child)} allows at most ${child.count} course${child.count===1?"":"s"}.`;
    }
    if(child.rule==="min"){
      const remainingSlots=limit-planned.size;
      if(chosen+remainingSlots<child.count){
        return `Keep enough room for ${groupDisplayName(child)}: at least ${child.count} course${child.count===1?"":"s"} are required.`;
      }
      if(proposed.length===limit && chosen<child.count){
        return `${groupDisplayName(child)} needs at least ${child.count} selected course${child.count===1?"":"s"}.`;
      }
    }
  }
  return "";
}
function constraintSummaryHtml(g){
  if(isCreditRule(g)){
    const progress=groupProgress(g);
    const requirement=g.rule==="min_credits" ? `at least ${g.count}` : `up to ${g.count}`;
    return `<div class="choice-summary">${progress.courses} courses / ${progress.credits} credits applied · ${requirement} credits required. Matching scheduled and completed courses apply automatically.</div>`;
  }
  const selected=constraintSelectionCount(g);
  const requirement=g.rule==="min" ? `at least ${g.count}` : `up to ${g.count}`;
  return `<div class="choice-summary">${selected} selected or completed · ${requirement} required. Choose these through the approved list above.</div>`;
}
function allocationSummaryHtml(g){
  const allocation=g?.allocation;
  if(!allocation) return "";
  const applied=groupAppliedCourseIds(g);
  const maxUses=Number(allocation.max_uses);
  const selected=applied.length
    ? `${applied.length} completed course${applied.length===1?" is":"s are"} allocated to this group.`
    : "No completed course is allocated to this group.";
  return `<div class="choice-summary">${selected} This reviewed ${escapeHtml(allocation.allocation_family)} allocation permits each course to count in up to ${maxUses} group${maxUses===1?"":"s"}; other eligible choices remain visible.</div>`;
}
function pickerSummaryHtml(gk){
  const g=GROUPS[gk];
  const selected=selectedRequirementCourses(gk);
  const applied=groupAppliedCourseIds(g);
  const limit=selectionLimit(g);
  const noun=limit===1?"course":"courses";
  const selectionText=applied.length
    ? `${applied.length} course${applied.length===1?"":"s"} automatically applied from your schedule or completed courses.`
    : `No scheduled or completed course is applied yet.`;
  const manualText=selected.length
    ? ` ${selected.length} additional course${selected.length===1?"":"s"} selected to consider.`
    : ` Choose up to ${Math.max(0,limit-applied.length)} additional ${noun} from the approved list.`;
  return `<div class="choice-summary">${selectionText}${manualText}</div>
    ${applied.length?`<div class="choice-picked"><strong style="font-size:10px;">Applied here</strong><div class="cgrid">${applied.map(id=>cardHtml(id)).join("")}</div></div>`:""}
    ${selected.length?`<div class="choice-picked"><strong style="font-size:10px;">Selected for this requirement</strong><div class="cgrid">${selected.map(id=>cardHtml(id)).join("")}</div></div>`:""}
    <div class="choice-actions"><button class="choice-btn" data-gpicker="${gk}">${selected.length?"Change selection":"Browse approved courses"}</button>
      ${selected.length?`<button class="choice-btn secondary" data-gclear="${gk}">Clear selection</button>`:""}</div>`;
}
function setRequirementChoice(groupId,itemId){
  const group=GROUPS[groupId],valid=group?.rule==="one_of"?(group.children||[]):(group?.members||[]);
  if(!group||!valid.includes(itemId))return;
  const current=(ST.groupSelections[groupId]||[]).filter(id=>valid.includes(id));
  let next=current.includes(itemId)?current.filter(id=>id!==itemId):group.rule==="one_of"?[itemId]:[...current,itemId].slice(-selectionLimit(group));
  ST.groupSelections[groupId]=next;savePlannerState();renderPanel();
}
function requirementChoiceControlsHtml(group){
  const itemIds=group.rule==="one_of"?(group.children||[]):(!isConstraintGroup(group)&&group.rule!=="all"&&(group.members||[]).length<=PICKER_THRESHOLD?(group.members||[]):[]);
  if(!itemIds.length)return "";
  const selected=new Set(ST.groupSelections[group.id]||[]);
  const buttons=itemIds.map(id=>{const child=GROUPS[id],course=COURSES[id],label=child?groupDisplayName(child):`${course?.code||id} · ${course?.fullTitle||course?.title||"Approved course"}`;return `<button class="requirement-choice-btn ${selected.has(id)?"active":""}" data-plan-choice-group="${escapeHtml(group.id)}" data-plan-choice-item="${escapeHtml(id)}"><span>${escapeHtml(label)}</span><span>${selected.has(id)?"Selected":"Choose"}</span></button>`;}).join("");
  return `<div class="requirement-choice-controls">${buttons}</div>`;
}
function groupHtml(gk){
  const g=GROUPS[gk];
  if(!g) return "";
  const ok=groupFulfilled(gk);
  const applied=groupAppliedCourseIds(g);
  const members=(g.members||[]).filter(id=>!applied.includes(id));
  const children=(g.children||[]).map(groupHtml).join("");
  const appliedHtml=applied.length
    ? `<div class="choice-picked"><strong style="font-size:10px;">Applied here</strong><div class="cgrid">${applied.map(id=>cardHtml(id)).join("")}</div></div>`
    : "";
  let body=isConstraintGroup(g)
    ? `${constraintSummaryHtml(g)}${appliedHtml}`
    : (isPickerGroup(g)
      ? pickerSummaryHtml(gk)
      : `${appliedHtml}${members.length?`<div class="cgrid">${members.map(id=>cardHtml(id)).join("")}</div>`:""}`);
  body=`${allocationSummaryHtml(g)}${requirementChoiceControlsHtml(g)}${body}`;
  body=isConstraintGroup(g)||isPickerGroup(g) ? body : `${selectorGuidanceHtml(g)}${body}`;
  const selectorCount=reviewedGroupSelectors(g).length;
  const appliedProgress=groupProgress(g);
  const progressCourseIds=globalThis.ScheduleRUPlannerUI.requirementProgressCourseIds({
    appliedIds:applied,
    selectedIds:selectedRequirementCourses(g.id),
  });
  const creditProgress=isCreditRule(g)
    ? ` · ${appliedProgress.courses} courses / ${appliedProgress.credits}/${g.count} credits applied`
    : "";
  const selectorProgress=selectorCount ? ` · ${progressCourseIds.length}/${Math.max(1,Number(g.count)||1)} applied` : "";
  const explicitProgress=g.members?.length
    ? ` · ${progressCourseIds.length}/${g.rule==="all"?g.members.length:Math.min(Number(g.count)||1,g.members.length)} applied`
    : "";
  const progress=creditProgress || selectorCount ? (creditProgress||selectorProgress) : explicitProgress;
  return `<div class="gr-row"><div class="gr-hdr${ok?" ok":""}" data-gtog="${gk}">
    <span class="gn">${groupDisplayName(g)}</span>
    <span class="gm">${groupRuleLabel(g)}${progress} · click to expand</span>
  </div><div class="gr-body" id="gb-${gk}">${body}${children}</div></div>`;
}

/* ============================================================
   CORE CREDIT ALLOCATION
   ============================================================
   Rutgers' Core audit may move a completed course between compatible goals
   as new courses are added, so the app calculates an assignment instead of
   letting one course silently satisfy every tag on its record. A course may
   still count once in each top-level Core family, as Rutgers permits.
*/
function directlyCompletedCoreCourse(id){
  if(ST.completed[id]) return true;
  const c=COURSES[id];
  return !!c && Object.values(ST.schedule).some(entry=>entry.code===c.code);
}
function coreApAllowedForGroup(g){
  // Rutgers' published Core FAQ excludes AP credit from CCD, CCO, and WCr.
  return !/\[(?:CCD|CCO|WCr)\]/.test(g?.name||"");
}
function coreRequirementGroups(rootId){
  return coreAllocationModel.requirementGroupIds(rootId);
}
function coreGroupNeeded(g){
  return coreAllocationModel.groupNeeded(g);
}
function computeCoreAllocation(){
  return coreAllocationModel.allocate();
}
function coreAppliedCardHtml(token){
  if(token.kind==="ap"){
    const codes=[...token.courseIds].map(id=>COURSES[id]?.code||id).join(", ");
    return `<div class="cc done core-applied-card" data-apcore="${escapeHtml(token.ap.id)}">
      <div class="code">AP CREDIT</div><div class="ttl">${escapeHtml(token.ap.name)}</div>
      <div class="meta">Rutgers equivalency: ${escapeHtml(codes)}</div></div>`;
  }
  const c=COURSES[token.courseId];
  return `<div class="cc done core-applied-card" data-cid="${escapeHtml(token.courseId)}">
    <div class="code">${escapeHtml(c?.code||token.courseId)}</div><div class="ttl">${escapeHtml(c?.fullTitle||c?.title||token.courseId)}</div>
    <div class="meta">Applied to this Core goal</div></div>`;
}
function coreGroupHtml(gk,allocation){
  const g=GROUPS[gk];
  if(!g) return "";
  const applied=allocation.byGroup[gk]||[];
  const needed=coreGroupNeeded(g);
  const ok=needed>0 && applied.length>=needed;
  // Arts & Humanities is one requirement that needs two courses across two
  // different goals. Keep that shared rule at the parent, but show AHo,
  // AHp, AHq and AHr as their own browsable subgroups beneath it.
  if(g.rule==="distinct" && (g.children||[]).length){
    const subgroups=(g.children||[]).map(id=>coreGroupHtml(id,allocation)).join("");
    const summary=applied.length
      ? `${applied.length} of ${needed} distinct Arts & Humanities goals automatically applied. The app will reassign credit when that completes more Core requirements.`
      : `Choose ${needed} courses across ${needed} different Arts & Humanities goals. Browse any goal below at any time.`;
    return `<div class="gr-row"><div class="gr-hdr${ok?" ok":""}" data-gtog="${gk}">
      <span class="gn">${groupDisplayName(g)}</span><span class="gm">${applied.length}/${needed} distinct goals applied Â· click to expand</span>
    </div><div class="gr-body" id="gb-${gk}"><div class="choice-summary">${summary}</div>${subgroups}</div></div>`;
  }
  const selected=selectedRequirementCourses(gk);
  const selectedHtml=selected.length?`<div class="choice-picked"><strong style="font-size:10px;">Courses you picked to consider</strong><div class="cgrid">${selected.map(id=>cardHtml(id)).join("")}</div></div>`:"";
  const summary=applied.length
    ? `${applied.length} of ${needed} course${needed===1?"":"s"} automatically applied. The app will reassign credit when that completes more Core requirements.`
    : `No completed or scheduled course is applied yet. Browse the approved list at any time.`;
  return `<div class="gr-row"><div class="gr-hdr${ok?" ok":""}" data-gtog="${gk}">
    <span class="gn">${groupDisplayName(g)}</span><span class="gm">${applied.length}/${needed} applied · click to expand</span>
  </div><div class="gr-body" id="gb-${gk}"><div class="choice-summary">${summary}</div>
    ${applied.length?`<div class="choice-picked"><strong style="font-size:10px;">Applied here</strong><div class="cgrid">${applied.map(coreAppliedCardHtml).join("")}</div></div>`:""}
    ${selectedHtml}<div class="choice-actions"><button class="choice-btn" data-gpicker="${gk}">Browse approved courses</button>
    ${selected.length?`<button class="choice-btn secondary" data-gclear="${gk}">Clear picked courses</button>`:""}</div></div></div>`;
}
let requiredPanelController=null;
function installRequiredPanelController(controller){requiredPanelController=controller;}
function renderRequired(){return requiredPanelController?.render();}

function catalogListedProgramsBannerHtml(){
  const listed=selectedProgramRows().filter(program=>program?.requirements_available===false||program?.coverage_status==="catalog_listed");
  if(!listed.length) return "";
  const names=listed.map(program=>program.name).join(", ");
  return `<div class="dc-banner warn"><b>Requirements could not load</b><div>Reopen Programs and refresh ${escapeHtml(names)} before building your plan.</div></div>`;
}

/* ============================================================
   TAB 2: REVIEWED CORE CURRICULUM
   ============================================================ */
function renderCore(){
  const pb=document.getElementById("pb");
  if(ST.coreLoading){
    pb.innerHTML=`<div class="empty" style="margin-top:30px;">Loading the reviewed ${escapeHtml(activeCoreLabel())}…</div>`;
    return;
  }
  if(ST.coreError){
    const shown=ScheduleRUUserMessageModel.presentIssue(ST.coreError);
    pb.innerHTML=`<div class="api-status err"><strong>${escapeHtml(shown.title)}</strong><span>${escapeHtml(shown.message)}</span></div>`;
    return;
  }
  if(!ST.coreRequirementTree){
    pb.innerHTML=`<div class="api-status err"><strong>Core requirements could not load</strong><span>Refresh the page before building your plan.</span></div>`;
    return;
  }
  useRequirementTree(ST.coreRequirementTree);
  const allocation=computeCoreAllocation();
  ST.coreAllocation=allocation;
  let h=`<div class="leg">${escapeHtml(activeSchoolContext().coreIntro)}</div>`;
  ROOT_GROUPS.forEach(gk=>{
    const g=GROUPS[gk];
    if(!g) return;
    h+=`<div class="sec-hdr">${groupDisplayName(g)}</div>`;
    h+=coreRequirementGroups(gk).map(id=>coreGroupHtml(id,allocation)).join("");
  });
  if(allocation.tokens.length) h+=`<div class="sec-hdr">✓ Completed / AP Credit</div><div class="cgrid">${allocation.tokens.map(coreAppliedCardHtml).join("")}</div>`;
  pb.innerHTML=h;
  attachCardEvents(pb);
  pb.querySelectorAll("[data-apcore]").forEach(card=>card.addEventListener("click",()=>document.getElementById("apBtn").click()));
  pb.querySelectorAll("[data-gtog]").forEach(d=>d.addEventListener("click",()=>
    document.getElementById("gb-"+d.dataset.gtog).classList.toggle("open")));
  pb.querySelectorAll("[data-gpicker]").forEach(b=>b.addEventListener("click",e=>{
    e.stopPropagation(); openRequirementPicker(b.dataset.gpicker);
  }));
  pb.querySelectorAll("[data-gclear]").forEach(b=>b.addEventListener("click",e=>{
    e.stopPropagation(); delete ST.groupSelections[b.dataset.gclear]; renderPanel();
  }));
}
/* ============================================================
   PAGE 2: COURSES — live data from the Cloudflare Worker + D1
   backend (worker.js / schema.sql). No curated/offline fallback
   catalog anymore — this page reads straight from your deployed
   backend. See the README for deploying worker.js; paste its
   *.workers.dev URL below once it's live. The URL is remembered
   in this browser via localStorage so you only enter it once.
   ============================================================ */
function saveBackendUrl(u){
  ST.backendUrl=ScheduleRUBackendClient.saveUrl({
    storage:typeof localStorage!=="undefined"?localStorage:null,
    storageKey:BACKEND_SITE_CONFIG.storageKey,
    value:u,
  });
}

async function backendFetch(path,options={}){
  return ScheduleRUBackendClient.fetchJson({
    baseUrl:ST.backendUrl,
    path,
    options,
    fetchImpl:fetch,
  });
}
const requirementDataLoader=ScheduleRURequirementDataLoader.create({request:backendFetch});

function activeCatalogSelectorContext(){
  if(ST.backendRequirementFilter?.selectors?.length)return ST.backendRequirementFilter;
  const group=GROUPS[ST.backendSelectorGroupId];
  const selectors=reviewedGroupSelectors(group);
  return group&&selectors.length ? {group,selectors} : null;
}
let catalogPageController=null;
function installCatalogPageController(controller){catalogPageController=controller;}
function renderCoursesPage(){return catalogPageController?.render();}
function loadBackendMeta(){return catalogPageController?.loadMeta();}
function loadBackendCourses(){return catalogPageController?.loadCourses();}
function openSelectorCourseBrowser(gk){
  const group=GROUPS[gk];
  if(ST.tab==="core"){
    openCorePlaceholderCourseBrowser({
      sourceType:"core",requirementGroupId:gk,label:groupDisplayName(group),
      candidateSelectionContext:{
        courseSelectors:group?.courseSelectors||[],
        memberCourseCodes:(group?.members||[]).map(id=>COURSES[id]?.code).filter(Boolean),
      },
    },group);
    return;
  }
  openRequirementPicker(gk);
}
function clearCatalogSelectorBrowser(){
  return catalogPageController?.clearSelector();
}

function useCatalogCourseForRequirement(record){
  const intent=ST.activeRequirementChoice;
  if(!intent||!ScheduleRURequirementChoiceModel.courseMatchesIntent(record,intent,ScheduleRUCourseSelectorLogic)){
    return {status:"rejected"};
  }
  const courseId=registerSelectorCourseRecord(record);
  const committed=ScheduleRURequirementChoiceModel.commitChoice({
    intent,courseId,groupSelections:ST.groupSelections,
  });
  if(!committed)return {status:"rejected"};
  const placement=committed.returnPlacement;
  ST.groupSelections=committed.groupSelections;
  ST.planPlaceholders=(ST.planPlaceholders||[]).filter(item=>item.id!==committed.resolvedPlaceholderId);
  if(placement&&!ST.schedule[record.code]){
    ST.schedule[record.code]={
      year:placement.year,sem:placement.sem,code:record.code,
      title:record.title||record.code,fullTitle:record.fullTitle||record.title||record.code,
      credits:record.credits,course:record,locked:false,userPinned:false,
    };
  }
  ST.activeRequirementChoice=null;
  ST.backendRequirementFilter=null;
  ST.backendSelectorGroupId=null;
  if(placement)ST.year=placement.year;
  savePlannerState();
  setTopLevelPage(committed.returnPage);
  renderAll();
  ScheduleRURequirementChoiceFeedback.highlightCourse({document,courseCode:record.code});
  return {status:"committed"};
}

async function loadCourseEligibilityForCodes(codes){
  const unique=[...new Set((codes||[]).filter(code=>/^\d{2}:\d{3}:\d{3}$/.test(code)))]
    .filter(code=>!ST.courseEligibilityFetched[code])
    .slice(0,25);
  if(!unique.length) return;
  try{
    const response=await backendFetch("/api/course-eligibility?codes="+encodeURIComponent(unique.join(",")));
    unique.forEach(code=>{ST.courseEligibilityFetched[code]=true;});
    Object.assign(ST.courseEligibilityByCode,response.eligibility||{});
    return true;
  }catch(_){
    // Missing or unavailable reviewed data remains a neutral needs-review state.
    return false;
  }
}

function useRequirementTree(tree){
  COURSES=tree?.courses||{};
  GROUPS=tree?.groups||{};
  ROOT_GROUPS=tree?.roots||[];
}

function programEligibilityBannerHtml(){
  const rules=(ST.programEligibilityRules||[]).filter(rule=>ST.selectedPrograms.includes(rule.program_id));
  if(!rules.length) return "";
  const programsById=Object.fromEntries((ST.availablePrograms||[]).map(program=>[program.id,program]));
  const facts=rules.map(rule=>{
    const name=programsById[rule.program_id]?.name||"Selected program";
    return `<li><strong>${escapeHtml(name)}:</strong> ${escapeHtml(rule.advisory_message||rule.note||"Confirm this reviewed program policy with advising.")}</li>`;
  }).join("");
  return `<div class="dc-banner warn"><b>Planning notices</b><ul style="margin:5px 0 0;padding-left:18px;">${facts}</ul><span>Planning notices from reviewed program sources. ScheduleRU does not verify grades, residency, transfer credit, formal applications, or school approvals.</span></div>`;
}
function overlapProgramPairsHtml(overlaps,programsById){
  const byPrograms=new Map();
  for(const overlap of overlaps||[]){
    const ids=[...new Set(overlap.programs||[])].sort();
    const key=ids.join("|");
    const entry=byPrograms.get(key)||{ids,codes:[]};
    entry.codes.push(overlap.code);
    byPrograms.set(key,entry);
  }
  return [...byPrograms.values()].map(entry=>{
    const names=entry.ids.map(id=>programsById[id]?.name||id).join(" + ");
    return `<li><strong>${escapeHtml(names)}:</strong> ${escapeHtml(entry.codes.join(", "))}</li>`;
  }).join("");
}
function doubleCountMeaning(item){
  const count=item.codes.length;
  if(item.scope==="major_concentration" && item.cap===0){
    return `These ${count===1?"course":"courses"} cannot fulfill both a major and a concentration. You can still pursue both programs; use different approved course${count===1?"":"s"} for the concentration requirement.`;
  }
  if(item.scope==="major_major" && item.cap!==null){
    if(item.violates){
      return `RBS permits up to ${item.cap} shared course${item.cap===1?"":"s"} across your RBS majors. Your selected requirement lists contain ${count} potential overlaps, so only ${item.cap} may count toward both majors; satisfy the other requirement${count-item.cap===1?"":"s"} with different approved course${count-item.cap===1?"":"s"}.`;
    }
    return `RBS permits up to ${item.cap} shared course${item.cap===1?"":"s"} across your RBS majors. If you use this course for both majors, it uses that allowance.`;
  }
  if(item.cap===0){
    return `These courses cannot fulfill both programs. Use different approved courses for one program's requirement.`;
  }
  return `ScheduleRU found overlapping requirement lists. Confirm with advising whether any of these courses may count toward both programs.`;
}
function doubleCountExceptionHtml(exception,programsById){
  const names=(exception.programs||[]).map(id=>programsById[id]?.name||id).join(" + ");
  const codes=(exception.courses||[]).map(course=>course.code).join(", ");
  const sourceNote=exception.note||"Rutgers publishes a specific exception for this program combination.";
  return `<div style="margin-top:6px;"><strong>Published exception</strong><ul style="margin:3px 0 4px;padding-left:18px;"><li><strong>${escapeHtml(names)}:</strong> ${escapeHtml(codes)}</li></ul><strong>What this means:</strong> ${escapeHtml(sourceNote)} The exception applies only to the course${(exception.courses||[]).length===1?"":"s"} listed above; any other overlap still follows the normal policy.</div>`;
}
function doubleCountBannerHtml(){
  const result=ST.doubleCount;
  if(!result || ST.selectedPrograms.length<2) return "";
  const sharedNames=[...new Set(result.shared.map(item=>item.name))];
  const activeScopes=result.scopeResults.filter(item=>item.codes.length);
  const unscoped=result.unscoped||[];
  const exceptions=result.exceptions||[];
  const violates=activeScopes.some(item=>item.violates) || unscoped.length>0;
  const programsById=Object.fromEntries((ST.availablePrograms||[]).map(program=>[program.id,program]));
  let content=sharedNames.length?`<div>Shared requirements are shown once: ${escapeHtml(sharedNames.join(", "))}. You do not need to take those shared sections twice.</div>`:"";
  content+=exceptions.map(exception=>doubleCountExceptionHtml(exception,programsById)).join("");
  if(!activeScopes.length && !unscoped.length){
    content+=`<div>${exceptions.length?"Apart from the published exception above, ":""}No additional course-overlap adjustment is currently needed.</div>`;
  }else{
    content+=activeScopes.map(item=>{
      const label=item.scope==="major_major"?"Major-to-major overlap":"Major-to-concentration overlap";
      return `<div style="margin-top:6px;"><strong>${label}</strong><ul style="margin:3px 0 4px;padding-left:18px;">${overlapProgramPairsHtml(item.codes,programsById)}</ul><strong>What this means:</strong> ${escapeHtml(doubleCountMeaning(item))}</div>`;
    }).join("");
    if(unscoped.length){
      content+=`<div style="margin-top:6px;"><strong>Policy confirmation needed</strong><ul style="margin:3px 0 4px;padding-left:18px;">${overlapProgramPairsHtml(unscoped,programsById)}</ul>ScheduleRU does not yet have a reviewed rule for this program combination, so confirm with advising before relying on the same course twice.</div>`;
    }
  }
  const title=violates?"Plan adjustment needed":"Course-overlap check";
  const suffix=violates?`<span> This is a planning check, not a final degree audit; confirm the final decision with ${escapeHtml(activeSchoolContext().advisingLabel)}.</span>`:"";
  return `<div class="dc-banner ${violates?"warn":"ok"}"><b>${title}</b>${content}${suffix}</div>`;
}

async function loadAvailablePrograms(){
  // The API combines reviewed requirement trees with the official SAS catalog
  // coverage tier. Filtering stays client-side so all supported program types
  // remain visible as soon as source-backed data is available.
  const context=await requirementDataLoader.loadPrograms({homeSchoolSlug:ST.homeSchoolSlug,scope:"all"});
  ST.availablePrograms=ScheduleRUProgramPickerLogic.availableProgramsForSchool(context.programs,ST.homeSchoolSlug);
  const catalogReplacements=new Map(ST.availablePrograms
    .filter(program=>typeof program.catalog_program_id==="string"&&program.catalog_program_id)
    .map(program=>[program.catalog_program_id,program.id]));
  const migratedSelections=[...new Set(ST.selectedPrograms.map(id=>catalogReplacements.get(id)||id))];
  if(migratedSelections.some((id,index)=>id!==ST.selectedPrograms[index])||migratedSelections.length!==ST.selectedPrograms.length){
    ST.selectedPrograms=migratedSelections;
    savePlannerState();
  }
  ST.programSelectionPolicies=context.selectionPolicies;
  return ST.availablePrograms;
}
async function loadAvailableSchools(){
  const schools=await requirementDataLoader.loadSchools();
  ST.availableSchools=schools;
  if(!schoolProfileBySlug(ST.homeSchoolSlug)){
    ST.homeSchoolSlug=schools[0].slug;
    ST.selectedPrograms=[];
    ST.groupSelections={};
    savePlannerState();
  }
  return ST.availableSchools;
}
async function loadRequirements(programId){
  return loadSelectedRequirements([programId]);
}
async function loadSelectedRequirementCandidate(programIds){
  const ids=[...new Set((programIds||[]).filter(Boolean))];
  if(!ids.length) throw new Error("Choose at least one program.");
  const context=await requirementDataLoader.loadRequirements({programIds:ids,homeSchoolSlug:ST.homeSchoolSlug});
  const returned=context.requirements;
  const visibleIds=ids.filter(id=>Array.isArray(returned[id]));
  if(!visibleIds.length) throw new Error("None of the selected programs is available from the current catalog.");
  const normalized=programRequirementModel.normalizeProgramTrees({requirementTrees:returned,programIds:visibleIds,referenceRequirementTrees:ST.referenceRequirementTrees,availablePrograms:ST.availablePrograms});
  return {
    selectedPrograms:visibleIds,catalogListedProgramIds:context.catalogListedProgramIds,
    requirementTrees:normalized,doubleCountPolicies:context.doubleCountPolicies,
    doubleCountRules:context.doubleCountRules,doubleCountExceptions:context.doubleCountExceptions,
    programEligibilityRules:context.eligibilityRules,
    majorRequirementTree:buildRequirementTree(programRequirementModel.requirementsForDisplay({requirementTrees:normalized,programIds:visibleIds})),
    doubleCount:programRequirementModel.computeDoubleCount({requirementTrees:normalized,programIds:visibleIds,availablePrograms:ST.availablePrograms,doubleCountExceptions:context.doubleCountExceptions,doubleCountPolicies:context.doubleCountPolicies}),
    activeProgram:visibleIds.length===1 ? (ST.availablePrograms||[]).find(program=>program.id===visibleIds[0])||null : null,
  };
}
function commitSelectedRequirementCandidate(candidate){
  Object.assign(ST,candidate);
  if(ST.tab!=="core")useRequirementTree(ST.majorRequirementTree);
  return {requirements:ST.requirementTrees,policies:ST.doubleCountPolicies};
}
async function loadSelectedRequirements(programIds){
  return commitSelectedRequirementCandidate(await loadSelectedRequirementCandidate(programIds));
}
async function loadSchoolReferenceRequirementTrees(programs){
  const ids=(programs||[]).map(program=>program.id).filter(Boolean);
  ST.referenceRequirementTrees=await requirementDataLoader.loadReferenceRequirements({programIds:ids});
  return ST.referenceRequirementTrees;
}
async function loadCoreCurriculum(){
  ST.coreLoading=true;
  ST.coreError="";
  renderPanel();
  try{
    const context=await requirementDataLoader.loadCoreCurriculum({homeSchoolSlug:ST.homeSchoolSlug,label:activeCoreLabel()});
    ST.coreCurricula=context.curricula;
    ST.activeCoreCurriculum=context.curriculum;
    ST.coreRequirementTree=buildRequirementTree(context.requirements);
  }catch(err){
    ST.coreError=err;
  }finally{
    ST.coreLoading=false;
    if(ST.tab==="core") renderPanel();
  }
}
async function loadInitialRequirements({reloadSchools=true}={}){
  ST.requirementsLoading=true;
  ST.requirementsError="";
  renderPanel();
  try{
    if(reloadSchools) await loadAvailableSchools();
    const programs=await loadAvailablePrograms();
    // This one read lets the UI derive a shared requirement baseline from the
    // reviewed school data, including when a program's own table contains
    // additional major-only rows. It is not a hard-coded course list.
    // The active school configuration determines which program types participate;
    // this prevents a future minor or certificate from accidentally becoming
    // part of a shared major-level baseline.
    const referenceTypes=activeSchoolContext().sharedRequirementReferenceTypes||[];
    try{ await loadSchoolReferenceRequirementTrees(programs.filter(program=>program.requirements_available!==false&&referenceTypes.includes(program.type))); }catch(e){ ST.referenceRequirementTrees={}; }
    const initialIds=ScheduleRUProgramPickerLogic.initialProgramIds({
      restoredIds:ST.selectedPrograms,
      programs,
      onboardingCompleted:ST.onboarding?.completed===true,
      selectionConfirmed:ST.programSelectionConfirmed===true,
      defaultProgramId:activeSchoolContext().defaultProgramId,
    });
    if(!programs.length) throw new Error(`No catalog-listed programs are available yet for ${activeHomeSchoolLabel()}.`);
    ST.selectedPrograms=initialIds;
    if(initialIds.length)await loadSelectedRequirements(initialIds);
    else{
      ST.requirementTrees={};ST.catalogListedProgramIds=[];ST.doubleCountPolicies=[];ST.doubleCountRules=[];ST.doubleCountExceptions=[];ST.programEligibilityRules=[];ST.majorRequirementTree=buildRequirementTree([]);ST.activeProgram=null;ST.doubleCount=null;ST.primaryProgramId=null;ST.secondaryProgramId=null;ST.requiredProgramTab="";
      useRequirementTree(ST.majorRequirementTree);
    }
    updateProgramTitle();
  }catch(err){
    ST.requirementsError=err;
  }finally{
    ST.requirementsLoading=false;
    renderPanel();
  }
}

function escapeHtml(s){
  return String(s).replace(/[&<>]/g, ch=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[ch]));
}

// Rutgers' text fields (preReqNotes, courseDescription) come back HTML-ish
// (e.g. an <em>OR</em> between alternative prereq groups). We want the plain
// reading — strip tags but keep their inner text, decode the handful of
// entities Rutgers actually uses, then collapse whitespace/newlines.
function cleanApiText(raw){
  if(!raw) return "";
  return String(raw)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#0?39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// A section's meeting times, collapsed to one readable line per meeting.
// Rutgers stores its class times in a compact twelve-hour format; the helper
// converts that format into normal AM/PM wording for students.
function fmtMeeting(m){
  const day = m.day_of_week || "";
  const range=meetingTimeRange(m);
  const time = range ? `${formatClock(range.start)} – ${formatClock(range.end)}` :
    ((m.start_time && m.end_time) ? `${m.start_time} – ${m.end_time}` : "");
  const loc = [m.building, m.room].filter(Boolean).join(" ");
  const bits = [day, time].filter(Boolean).join(" ");
  if(!bits && !loc) return (m.mode||"").toUpperCase().includes("ONLINE") ? "Online" : "—";
  return loc ? `${bits || "—"} · ${loc}` : (bits || "Online");
}

/* ============================================================
   TAB 3: WISHLIST
   ============================================================ */
function renderWishlist(){
  const pb=document.getElementById("pb");
  const records=wishlistRecords();

  if(!records.length){
    pb.innerHTML=`<div class="empty" style="margin-top:30px;">No wishlist courses yet.<br/>
      Use the <b>Courses</b> page and click + Wishlist to add electives here.</div>`;
    return;
  }
  pb.innerHTML=`<div class="sec-hdr">Saved courses</div><div class="cgrid">${records.map(record=>{
    const scheduled=Object.values(ST.schedule).some(entry=>entry.code===record.code);
    return `
    <div class="cc wish-card${scheduled?" done":""}" data-cid="${escapeHtml(record.code)}" draggable="true" title="${scheduled?"Already added to your semester plan":""}">
      <div class="code">${escapeHtml(record.code)}</div>
      <div class="ttl">${escapeHtml(record.fullTitle||record.title||record.code)}</div>
      <div class="meta">${escapeHtml(courseCreditsLabel(record.credits))}${scheduled?" · In your plan":""}</div>
      <button class="rx" data-wrem="${escapeHtml(record.key)}" title="Remove from wishlist">×</button>
    </div>`;}).join("")}</div>`;
  attachCardEvents(pb);
  pb.querySelectorAll("[data-wrem]").forEach(b=>b.addEventListener("click",e=>{
    e.stopPropagation();
    delete ST.wishlist[e.target.dataset.wrem]; savePlannerState(); renderWishlist();
  }));
}

/* ============================================================
   RENDER ALL
   ============================================================ */
function renderPanel(){
  savePlannerState();
  if(ST.tab==="required") renderRequired();
  else if(ST.tab==="core") renderCore();
  else renderWishlist();
}
function renderMain(){
  const planRoot=document.getElementById("planRoot");
  const builderRoot=document.getElementById("builderRoot");
  if(ST.builder){
    planRoot.style.display="none";
    builderRoot.style.display="";
    renderBuilder();
  } else {
    planRoot.style.display="";
    builderRoot.style.display="none";
    renderSchedule();
  }
}
function renderAll(){ renderMain(); renderPanel(); }

let scheduleBuilderView=null;
function installScheduleBuilderView(view){scheduleBuilderView=view;}
function renderBuilder(){return scheduleBuilderView?.render();}
function campusFor(meeting){return scheduleBuilderView?.campusFor(meeting)||"OTHER/UNKNOWN";}

let scheduleBuilderController=null;
function installScheduleBuilderController(controller){scheduleBuilderController=controller;}
function recomputeBuilderPermutations(){return scheduleBuilderController?.recompute();}
function openBuilder(sem){return scheduleBuilderController?.open(sem);}
function closeBuilder(){return scheduleBuilderController?.close();}
function addToBuilderPool(cid){return scheduleBuilderController?.add(cid);}
function seedBuilderPoolFromSchedule(entry){return scheduleBuilderController?.seedFromSchedule(entry);}
function removeFromBuilderPool(code){return scheduleBuilderController?.remove(code);}
function toggleBuilderSection(code,indexNum){return scheduleBuilderController?.toggleSection(code,indexNum);}
function toggleBuilderCourseCollapse(code){return scheduleBuilderController?.toggleCollapse(code);}
function toggleBuilderCourseEnabled(code){return scheduleBuilderController?.toggleEnabled(code);}
function confirmBuilderSchedule(){return scheduleBuilderController?.confirm();}
function setBuilderIncludeClosed(includeClosed){return scheduleBuilderController?.setIncludeClosed(includeClosed);}
function openScheduleAssistant(){return scheduleBuilderController?.openAssistant?.();}


document.querySelectorAll(".sem-plus").forEach(btn=>btn.addEventListener("click", e=>{
  e.stopPropagation();
  openBuilder(btn.dataset.semplus);
}));

// Initial load
renderAll();
loadInitialRequirements();
