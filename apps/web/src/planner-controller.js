/* AP equivalencies are loaded from the reviewed Worker endpoint. */
let AP = [];

// Requirement data is populated from the public Worker API at startup.
// These containers deliberately contain no course or group data in source.
let COURSES = {};
let GROUPS = {};
let ROOT_GROUPS = [];

// Production and the named development Pages branch deliberately use different
// Workers. This keeps experiments with catalog syncing and degree rules away
// from the live application. A student can still intentionally override the
// URL in the Course Catalog connection bar; that override remains private to
// the current browser and site address.
const PRODUCTION_BACKEND_URL="https://rutgers-course-sync.housselllaura.workers.dev";
const DEVELOPMENT_BACKEND_URL="https://rutgers-course-sync-dev.housselllaura.workers.dev";
const CURRENT_HOST=((typeof location!=="undefined" && location.hostname)||"").toLowerCase();
const LOCAL_DEVELOPMENT_HOSTS=["localhost","127.0.0.1","::1"];
const IS_DEVELOPMENT_SITE=LOCAL_DEVELOPMENT_HOSTS.includes(CURRENT_HOST) || (CURRENT_HOST.endsWith(".scheduleru-9fb.pages.dev") && CURRENT_HOST!=="scheduleru-9fb.pages.dev");
const BACKEND_URL_STORAGE_KEY=IS_DEVELOPMENT_SITE ? "scheduleru_dev_backend_url" : "bait_backend_url";
function defaultBackendUrl(){
  return IS_DEVELOPMENT_SITE ? DEVELOPMENT_BACKEND_URL : PRODUCTION_BACKEND_URL;
}

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
  backendUrl: (typeof localStorage!=="undefined" && localStorage.getItem(BACKEND_URL_STORAGE_KEY)) || defaultBackendUrl(),
  availableSchools:[], availablePrograms:[], activeProgram:null, selectedPrograms:[],
  homeSchoolSlug:"", programSelectionPolicies:{limits:[],combination_policies:[]},
  requirementTrees:{}, referenceRequirementTrees:{}, majorRequirementTree:null, catalogListedProgramIds:[], doubleCountPolicies:[], doubleCountRules:[], doubleCountExceptions:[], programEligibilityRules:[], doubleCount:null,
  requirementsLoading:true, requirementsError:"",
  coreCurricula:[], activeCoreCurriculum:null, coreRequirementTree:null, coreLoading:false, coreError:"",
  backendSubject:"", backendSearch:"", backendPage:1, backendSelectorGroupId:null, backendRequirementFilter:null,
  backendCourses:[], backendTotal:0, backendLoading:false, backendError:"",
  backendSubjects:[], backendStatus:null,
  expandedIds: new Set(),   // course ids currently expanded on the Courses page
  sectionsCache: {},        // course id -> { sections } | { error }, lazy-loaded
  pickerSelector:null,      // selector-backed requirement modal state
  requiredRootOpen:{}, nestedGroupOpen:{},
  builder: null,            // { year, sem, pool:[{code,title,credits,sections,checked,loading,error}], permutations, permIndex } | null
};

// This is intentionally device-local, not an account. It keeps a student's
// plan private while still surviving reloads and Pages deployments at this
// same site address. Catalog and requirement data stay on the Worker, so the
// saved payload remains small and can be re-evaluated against updated rules.
const PLANNER_STATE_KEY="scheduleru_planner_state_v1";
// Keep legacy markers while accepting earlier migrations; new saves use the current version.
const PLANNER_STATE_VERSION=3;
const CURRENT_PLANNER_STATE_VERSION=ScheduleRUPlannerStateLogic.STATE_VERSION;
function savedObject(value){
  return value && typeof value==="object" && !Array.isArray(value) ? value : {};
}
function restorePlannerState(){
  try{
    if(typeof localStorage==="undefined") return;
    const saved=JSON.parse(localStorage.getItem(PLANNER_STATE_KEY)||"null");
    if(!saved || (![1,2,PLANNER_STATE_VERSION,4].includes(saved.version)&&saved.version!==CURRENT_PLANNER_STATE_VERSION)) return;
    ST.apOn=savedObject(saved.apOn);
    ST.completed=savedObject(saved.completed);
    ST.schedule=savedObject(saved.schedule);
    ST.wishlist=savedObject(saved.wishlist);
    ST.groupSelections=savedObject(saved.groupSelections);
    ST.creditLedger=savedObject(saved.creditLedger);
    const year=Number(saved.year);
    if(Number.isInteger(year) && year>=1 && year<=8) ST.year=year;
    if(typeof saved.homeSchoolSlug==="string" && /^[a-z0-9-]{2,80}$/.test(saved.homeSchoolSlug)) ST.homeSchoolSlug=saved.homeSchoolSlug;
    if(Array.isArray(saved.selectedPrograms)) ST.selectedPrograms=saved.selectedPrograms.filter(id=>typeof id==="string");
    const migrated=ScheduleRUPlannerStateLogic.migratePlannerState({...saved,selectedProgramIds:saved.selectedProgramIds||saved.selectedPrograms});
    Object.assign(ST,migrated);
    ST.selectedPrograms=Array.isArray(saved.selectedPrograms)?saved.selectedPrograms.filter(id=>typeof id==="string"):[];
  }catch(e){
    // A malformed or outdated local value should never prevent the planner
    // from opening; the user can continue with a fresh in-browser plan.
  }
}
function savePlannerState(){
  try{
    if(typeof localStorage==="undefined") return;
    localStorage.setItem(PLANNER_STATE_KEY,JSON.stringify({
      version:CURRENT_PLANNER_STATE_VERSION, savedAt:Date.now(), apOn:ST.apOn, completed:ST.completed,
      schedule:ST.schedule, wishlist:ST.wishlist, groupSelections:ST.groupSelections,
      creditLedger:ST.creditLedger,
      year:ST.year, homeSchoolSlug:ST.homeSchoolSlug, selectedPrograms:ST.selectedPrograms,
      onboarding:ST.onboarding, academicPosition:ST.academicPosition, academicRecords:ST.academicRecords,
      academicCalendarStartYear:ST.academicCalendarStartYear,
      primaryProgramId:ST.primaryProgramId, secondaryProgramId:ST.secondaryProgramId,
      programSelectionConfirmed:ST.programSelectionConfirmed===true,
      generatedPlanPreview:ST.generatedPlanPreview, schedulePreferences:ST.schedulePreferences,
      planPlaceholders:ST.planPlaceholders, issueDismissals:ST.issueDismissals,
    }));
  }catch(e){
    // Browsers can disable or limit local storage. Planning still works for
    // the current visit even when persistence is unavailable.
  }
}
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

function creditNumber(value){
  const match=String(value??"").match(/\d+(?:\.\d+)?/);
  const number=Number(match?.[0]);
  return Number.isFinite(number)&&number>=0?number:0;
}
function confirmedAcademicCreditEntries(){
  const entries=[];
  AP.filter(ap=>ST.apOn[ap.id]).forEach(ap=>entries.push({
    id:"ap:"+ap.id, source:"ap", credits:creditNumber(ap.credits),
    course_code:courseCodesFromText(ap.equiv)[0]||"",
    equivalent_course_codes:[...new Set([
      ...courseCodesFromText(ap.equiv),
      ...(ap.fulfills||[]).map(value=>globalThis.ScheduleRUAcademicCredit.normalizeCourseCode(value)).filter(Boolean),
    ])],
  }));
  Object.entries(ST.completed||{}).forEach(([id,taken])=>{
    if(!taken) return;
    const course=courseRecordFromId(id);
    if(course) entries.push({
      id:"completed:"+id, source:"rutgers_completed", credits:creditNumber(course.credits), course_code:course.code,
    });
  });
  Object.values(ST.creditLedger||{}).forEach(entry=>entries.push(entry));
  return globalThis.ScheduleRUEligibilityLogic.confirmedCreditEntries(entries);
}
function academicRequirementTrees(){
  return [ST.majorRequirementTree,ST.coreRequirementTree].filter(Boolean);
}
function resolvedAcademicCourseCodes(codes){
  return [...globalThis.ScheduleRUAcademicCredit.satisfiedCourseCodes({
    confirmedCourseCodes:codes,
    requirementTrees:academicRequirementTrees(),
  })];
}
function confirmedAcademicCourseCodes(){
  const logic=globalThis.ScheduleRUEligibilityLogic;
  return resolvedAcademicCourseCodes(confirmedAcademicCreditEntries().flatMap(entry=>logic.entryCourseCodes(entry)));
}
function plannedScheduleCreditEntries(){
  const entries=Object.values(ST.schedule||{}).map(entry=>({
    id:"scheduled:"+entry.code, course_code:entry.code, credits:creditNumber(entry.credits),
    year:Number(entry.year), sem:entry.sem,
  }));
  return globalThis.ScheduleRUAcademicCredit.expandedPlannedCourseEntries({
    entries,
    requirementTrees:academicRequirementTrees(),
  });
}
function courseEligibilityForTerm(course,term){
  const payload=course?.eligibility||ST.courseEligibilityByCode?.[course?.code]||null;
  return globalThis.ScheduleRUEligibilityLogic.evaluateEligibility({
    targetTerm:term, mode:"plan", review:payload?.review, conditions:payload?.conditions||[],
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
  const payload=course?.eligibility||ST.courseEligibilityByCode?.[course?.code]||null;
  return payload?.review?.review_status==="reviewed" ? payload : null;
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
function isCompleted(id){
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
function standingRequirement(c){
  const text=[c?.restrictions,...(c?.requirementNotes||[])].join(" ").toLowerCase();
  if(/seniors?\s+(year|standing|status|only)|4th\s+year/.test(text)) return {year:4,label:"Senior (4th-year) standing required"};
  if(/juniors?\s*(\/|or|and|-)?\s*seniors?|juniors?\s+(year|standing|status)|3rd\s+year/.test(text)) return {year:3,label:"Junior (3rd-year) standing required"};
  if(/all\s+except\s+(?:1st|first)[ -]?year|not\s+open\s+to\s+(?:1st|first)[ -]?year|except\s+(?:1st|first)[ -]?year/.test(text)) return {year:2,label:"Not open to first-year students"};
  return null;
}
function groupFulfilled(gk){
  return ScheduleRURequirementLogic.groupFulfilled(gk,GROUPS,{
    isCompleted,
    selectedRequirementCourses,
    isConstraintGroup,
    appliedCourseIds:groupAppliedCourseIds,
    courseCredits:id=>creditNumber(COURSES[id]?.credits),
  });
}
function groupProgress(g){
  return ScheduleRURequirementLogic.groupProgress(g,isCompleted,{
    appliedCourseIds:groupAppliedCourseIds,
    courseCredits:id=>creditNumber(COURSES[id]?.credits),
  });
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
let requirementAllocationCache={key:"",value:null};
function requirementAllocationKey(){
  return JSON.stringify([
    Object.keys(GROUPS).sort().map(id=>[
      id,GROUPS[id]?.allocation,GROUPS[id]?.members,GROUPS[id]?.rule,
      GROUPS[id]?.count,GROUPS[id]?.children,GROUPS[id]?.parentId,GROUPS[id]?.courseSelectors,
    ]),
    Object.keys(ST.completed||{}).filter(id=>ST.completed[id]).sort(),
    Object.keys(ST.apOn||{}).filter(id=>ST.apOn[id]).sort(),
    Object.values(ST.schedule||{}).map(entry=>entry?.code).filter(Boolean).sort(),
    Object.keys(ST.groupSelections||{}).sort().map(id=>[id,ST.groupSelections[id]]),
  ]);
}
function requirementAllocation(){
  const engine=globalThis.ScheduleRURequirementLogic;
  if(!engine?.allocateRequirementCourses) return null;
  const key=requirementAllocationKey();
  if(requirementAllocationCache.key===key) return requirementAllocationCache.value;
  const value=engine.allocateRequirementCourses(GROUPS,{
    isCompleted,
    selectedRequirementCourses,
    isConstraintGroup,
    appliedCourseIds:baseGroupAppliedCourseIds,
    courseCredits:id=>creditNumber(COURSES[id]?.credits),
  });
  requirementAllocationCache={key,value};
  return value;
}
function groupAppliedCourseIds(g){
  if(!g?.allocation) return baseGroupAppliedCourseIds(g);
  const allocated=requirementAllocation()?.appliedByGroup?.[g.id];
  return Array.isArray(allocated) ? allocated : baseGroupAppliedCourseIds(g);
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
function eligibilityRuleValues(rule){
  try{
    const parsed=JSON.parse(rule?.condition_value_json||"[]");
    return Array.isArray(parsed)?parsed.filter(value=>typeof value==="string"):[];
  }catch(err){ return []; }
}
function programIsAvailableForSchool(program,homeSchoolSlug){
  return !(program?.eligibility_rules||[]).some(rule=>{
    if(rule.decision!=="blocked") return false;
    const values=eligibilityRuleValues(rule);
    if(rule.condition_type==="home_school_must_be_one_of") return !values.includes(homeSchoolSlug);
    if(rule.condition_type==="home_school_must_not_be_one_of") return values.includes(homeSchoolSlug);
    return false;
  });
}
function programIsAvailableForHomeSchool(program){ return programIsAvailableForSchool(program,ST.homeSchoolSlug); }
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
    ? "Catalog-listed · requirements under review"
    : "Reviewed requirements";
}
function programMatchesSearch(program, query){
  const haystack=[program?.name,program?.degree_type,program?.type,program?.academic_program_code].join(" ").toLowerCase();
  return !query || haystack.includes(query);
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
function acceptedHomeSchoolSnapshot(){return {
  homeSchoolSlug:ST.homeSchoolSlug,availablePrograms:ST.availablePrograms,programSelectionPolicies:ST.programSelectionPolicies,
  selectedPrograms:ST.selectedPrograms,primaryProgramId:ST.primaryProgramId,secondaryProgramId:ST.secondaryProgramId,
  requiredProgramTab:ST.requiredProgramTab,groupSelections:ST.groupSelections,requirementTrees:ST.requirementTrees,
  referenceRequirementTrees:ST.referenceRequirementTrees,majorRequirementTree:ST.majorRequirementTree,
  catalogListedProgramIds:ST.catalogListedProgramIds,doubleCountPolicies:ST.doubleCountPolicies,doubleCountRules:ST.doubleCountRules,
  doubleCountExceptions:ST.doubleCountExceptions,programEligibilityRules:ST.programEligibilityRules,activeProgram:ST.activeProgram,
  doubleCount:ST.doubleCount,requirementsError:ST.requirementsError,coreCurricula:ST.coreCurricula,
  activeCoreCurriculum:ST.activeCoreCurriculum,coreRequirementTree:ST.coreRequirementTree,coreError:ST.coreError,
};}
function restoreHomeSchoolSnapshot(snapshot){Object.assign(ST,snapshot);useRequirementTree(ST.majorRequirementTree);}
function programRolesFor(ids,programs){const majors=ids.filter(id=>programs.find(program=>program.id===id)?.type==="major");return {primaryProgramId:majors[0]||null,secondaryProgramId:majors[1]||null,requiredProgramTab:majors[0]||ids[0]||""};}
function candidateProgramsForSchool(payload,schoolSlug){return (payload?.programs||[]).filter(program=>["major","minor","concentration","certificate"].includes(program.type)).filter(program=>programIsAvailableForSchool(program,schoolSlug));}
async function loadHomeSchoolCandidate(nextSchool){
  const schoolContext=schoolContextForProfile(nextSchool);
  const [programPayload,programSelectionPolicies,corePayload]=await Promise.all([
    backendFetch(`/api/programs?school=${encodeURIComponent(nextSchool.slug)}`),
    backendFetch(`/api/program-selection-policies?home_school=${encodeURIComponent(nextSchool.slug)}`),
    backendFetch(`/api/core-curricula?school=${encodeURIComponent(nextSchool.slug)}`),
  ]);
  const availablePrograms=candidateProgramsForSchool(programPayload,nextSchool.slug);
  if(!availablePrograms.length)throw new Error("No reviewed program is available for that home school.");
  const curriculum=(corePayload?.curricula||[])[0];
  if(!curriculum)throw new Error("No reviewed Core curriculum is available for that home school.");
  const selectedPrograms=ScheduleRUProgramPickerLogic.initialProgramIds({
    restoredIds:[],
    programs:availablePrograms,
    onboardingCompleted:ST.onboarding?.completed===true,
    selectionConfirmed:ST.programSelectionConfirmed===true,
    defaultProgramId:schoolContext.defaultProgramId,
  });
  const referenceTypes=schoolContext.sharedRequirementReferenceTypes||[],referencePrograms=availablePrograms.filter(program=>program.requirements_available!==false&&referenceTypes.includes(program.type));
  const [requirementsPayload,doubleCountPayload,referencePayload,coreDetail]=await Promise.all([
    selectedPrograms.length?backendFetch(`/api/requirements?programs=${selectedPrograms.map(encodeURIComponent).join(",")}`):Promise.resolve({requirements:{}}),
    backendFetch(`/api/double-count-policies?school=${encodeURIComponent(nextSchool.slug)}`),
    referencePrograms.length<2?Promise.resolve({requirements:{}}):backendFetch(`/api/requirements?programs=${referencePrograms.map(program=>encodeURIComponent(program.id)).join(",")}`),
    backendFetch(`/api/programs/${encodeURIComponent(curriculum.id)}/requirements`),
  ]);
  const returned=requirementsPayload?.requirements||{},visibleIds=selectedPrograms.filter(id=>Array.isArray(returned[id]));
  if(selectedPrograms.length&&!visibleIds.length)throw new Error("The replacement program requirements could not be loaded.");
  const referenceRequirementTrees=referencePayload?.requirements||{},requirementTrees=normalizedCoreRequirementTrees(returned,visibleIds,{referenceRequirementTrees,availablePrograms});
  const doubleCountPolicies=doubleCountPayload?.policies||[],doubleCountExceptions=requirementsPayload?.double_count_exceptions||[];
  const roles=programRolesFor(visibleIds,availablePrograms);
  return {
    homeSchoolSlug:nextSchool.slug,availablePrograms,programSelectionPolicies:programSelectionPolicies||{limits:[],combination_policies:[]},
    selectedPrograms:visibleIds,groupSelections:{},referenceRequirementTrees,requirementTrees,
    catalogListedProgramIds:requirementsPayload?.catalog_listed_program_ids||[],doubleCountPolicies,
    doubleCountRules:requirementsPayload?.double_count_rules||[],doubleCountExceptions,
    programEligibilityRules:requirementsPayload?.eligibility_rules||[],majorRequirementTree:buildRequirementTree(requirementsForDisplay(requirementTrees,visibleIds)),
    activeProgram:availablePrograms.find(program=>program.id===visibleIds[0])||null,
    doubleCount:visibleIds.length?computeDoubleCountOverlaps(requirementTrees,visibleIds,{availablePrograms,doubleCountExceptions,doubleCountPolicies}):null,
    requirementsError:"",coreCurricula:corePayload?.curricula||[],activeCoreCurriculum:curriculum,
    coreRequirementTree:buildRequirementTree(coreDetail?.requirements||[]),coreError:"",...roles,
  };
}
function commitHomeSchoolCandidate(candidate){Object.assign(ST,candidate);useRequirementTree(ST.majorRequirementTree);}
async function changeHomeSchool(nextSchoolSlug,confirmed=false){
  const next=schoolProfileBySlug(nextSchoolSlug);
  if(!next||next.slug===ST.homeSchoolSlug)return;
  if(ST.selectedPrograms.length&&!confirmed){
    modalController.show({title:"Change home school?",body:`<p>Your planned courses stay saved. Program selections and requirement choices will be re-evaluated for ${escapeHtml(next.name||next.short_name||next.slug)}.</p>`,actions:[{label:"Go back",secondary:true},{label:"Continue",onClick:()=>changeHomeSchool(nextSchoolSlug,true)}]});
    renderProgramSchoolSelector();return;
  }
  const generation=(ST.homeSchoolChangeGeneration||0)+1;const snapshot=acceptedHomeSchoolSnapshot();ST.homeSchoolChangeGeneration=generation;ST.requirementsLoading=true;renderPanel();
  try{
    const candidate=await loadHomeSchoolCandidate(next);
    if(generation!==ST.homeSchoolChangeGeneration)return;
    commitHomeSchoolCandidate(candidate);
    savePlannerState();
    updateProgramTitle();renderProgramSchoolSelector();renderOnboarding();
  }catch(error){
    if(generation!==ST.homeSchoolChangeGeneration)return;
    restoreHomeSchoolSnapshot(snapshot);
    modalController.show({title:"Home school unchanged",body:"<p>We could not load that home school. Your current plan and requirements were kept.</p>",actions:[{label:"Close",secondary:true}]});
  }finally{
    if(generation===ST.homeSchoolChangeGeneration){ST.requirementsLoading=false;renderProgramSchoolSelector();renderPanel();}
  }
}
function closeProgramPicker(){
  document.getElementById("programOv").classList.remove("open");
  delete ST.programDraft;
}
function openProgramPicker(){
  ST.programDraft=[...ST.selectedPrograms];
  ST.programSearch="";
  ST.programBrowseSchoolSlug="";
  delete ST.programDraftWarningSignature;
  document.getElementById("programPickerNote").textContent=`Choose a school, then select its majors and minors. Only reviewed programs show a requirement tree. ${selectionLimitSummary()} Your home school stays unchanged.`;
  showProgramPolicyFeedback(null);
  const search=document.getElementById("programSearch");
  search.value="";
  search.oninput=()=>{
    ST.programSearch=search.value.trim().toLowerCase();
    renderProgramPickerList();
  };
  renderProgramPickerList();
  document.getElementById("programOv").classList.add("open");
}
function renderProgramPickerList(){
  const list=document.getElementById("programList");
  const nav=document.getElementById("programSchoolNav");
  const search=document.getElementById("programSearch");
  const query=ST.programSearch||"";
  const schoolChoices=globalThis.ScheduleRUPlannerUI.programSchoolChoices({
    schools:ST.availableSchools||[],
    programs:ST.availablePrograms||[],
  });
  nav.innerHTML=schoolChoices.map(school=>`<button type="button" data-program-school="${escapeHtml(school.slug)}" class="${school.slug===ST.programBrowseSchoolSlug?"active":""}">${escapeHtml(school.label)}</button>`).join("");
  nav.querySelectorAll("[data-program-school]").forEach(button=>button.addEventListener("click",()=>{
    ST.programBrowseSchoolSlug=button.dataset.programSchool;
    ST.programSearch="";
    search.value="";
    renderProgramPickerList();
  }));
  search.hidden=!ST.programBrowseSchoolSlug;
  const visiblePrograms=globalThis.ScheduleRUPlannerUI.programsForBrowse({
    programs:ST.availablePrograms||[],
    schoolSlug:ST.programBrowseSchoolSlug,
    query,
  });
  if(!ST.programBrowseSchoolSlug){
    list.innerHTML=`<div class="api-status">Choose a school to browse its available programs.</div>`;
    return;
  }
  const categories=programTypeSections().map(section=>({
    ...section,
    programs:visiblePrograms.filter(program=>program.type===section.type),
  })).filter(section=>section.programs.length);
  list.innerHTML=categories.map(section=>`<section class="program-category">
    <h3 class="program-category-title">${escapeHtml(section.label)}</h3>
    ${section.programs.map(program=>`<label class="program-option">
      <input type="checkbox" data-program-choice="${escapeHtml(program.id)}" ${ST.programDraft.includes(program.id)?"checked":""}/>
      <span><strong>${escapeHtml(program.name)}</strong><small>${escapeHtml(programTypeLabel(program.type))} · ${escapeHtml(programCoverageLabel(program))}</small></span>
    </label>`).join("")}
  </section>`).join("") || `<div class="api-status">No programs match that search for the selected school.</div>`;
  for(const option of list.querySelectorAll("[data-program-choice]")){
    const degreeType=cleanApiText((ST.availablePrograms||[]).find(program=>program.id===option.dataset.programChoice)?.degree_type);
    if(!degreeType) continue;
    const metadata=option.closest(".program-option")?.querySelector("small");
    if(metadata) metadata.textContent=`${metadata.textContent} | ${degreeType}`;
  }
  list.querySelectorAll("[data-program-choice]").forEach(input=>input.addEventListener("change",()=>{
    const id=input.dataset.programChoice;
    const draft=new Set(ST.programDraft||[]);
    if(input.checked){
      draft.add(id);
    }else{
      draft.delete(id);
    }
    ST.programDraft=[...draft];
    delete ST.programDraftWarningSignature;
    renderProgramPickerList();
  }));
}
document.getElementById("programBtn").addEventListener("click", openProgramPicker);
document.getElementById("programClose").addEventListener("click", closeProgramPicker);
document.getElementById("programCancel").addEventListener("click", closeProgramPicker);
document.getElementById("programApply").addEventListener("click", async()=>{
  const ids=(ST.programDraft||[]);
  if(!ids.length){ showProgramPolicyFeedback({errors:[{message:"Choose at least one program."}]}); return; }
  let selectionCheck;
  try{
    selectionCheck=await backendFetch("/api/program-selection-check",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({home_school:ST.homeSchoolSlug,program_ids:ids}),
    });
  }catch(err){
    showProgramPolicyFeedback({errors:[{message:"Program policy checks could not be loaded. Your selection was not changed; please try again."}]});
    return;
  }
  if(!selectionCheck.allowed){
    showProgramPolicyFeedback(selectionCheck);
    return;
  }
  const warningSignature=JSON.stringify((selectionCheck.warnings||[]).map(issue=>issue.code).sort());
  if(selectionCheck.warnings?.length && ST.programDraftWarningSignature!==warningSignature){
    ST.programDraftWarningSignature=warningSignature;
    showProgramPolicyFeedback(selectionCheck);
    return;
  }
  showProgramPolicyFeedback(selectionCheck);
  ST.selectedPrograms=ids;
  closeProgramPicker();
  ST.requirementsLoading=true;
  ST.requirementsError="";
  renderPanel();
  try{
    await loadSelectedRequirements(ids);
    updateProgramTitle();
  }catch(err){
    ST.requirementsError=err.message||"Could not load the selected programs.";
  }finally{
    ST.requirementsLoading=false;
    renderPanel();
  }
});

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
function directPrerequisiteCodes(course){
  return [...new Set((Array.isArray(course?.prereqs)?course.prereqs:[])
    .map(id=>COURSES[id]?.code)
    .filter(code=>/^\d{2}:\d{3}:\d{3}$/.test(code)))];
}
function prerequisitePlanForCourse(course){
  const parsed=globalThis.ScheduleRUEligibilityLogic.parseCatalogPrerequisitePaths(course?.catalogPrereqs||"");
  const catalogPaths=globalThis.ScheduleRUEligibilityLogic.campusRelevantPrerequisitePaths({
    courseCode:course?.code,
    paths:parsed.paths,
  });
  const eligibility=course?.eligibility||ST.courseEligibilityByCode?.[course?.code]||null;
  const reviewedPaths=globalThis.ScheduleRUEligibilityLogic.prerequisitePathsFromConditions(eligibility?.conditions||[]);
  const verifiedNoPrerequisites=eligibility?.review?.review_status==="reviewed"
    && Number(eligibility?.review?.no_known_conditions)===1
    && !reviewedPaths.length;
  const direct=directPrerequisiteCodes(course);
  const references=new Map((parsed.references||[]).map(reference=>[reference.course_code,reference]));
  [...direct,...reviewedPaths.flat()].forEach(code=>{
    const known=courseByCode(code);
    if(!references.has(code)) references.set(code,{course_code:code,title:known?.fullTitle||known?.title||""});
  });
  if(reviewedPaths.length) return {reviewable:true,paths:reviewedPaths,references:[...references.values()],source:"reviewed_conditions",verifiedNoPrerequisites};
  if(direct.length) return {reviewable:true,paths:[direct],references:[...references.values()],source:"reviewed_simple",verifiedNoPrerequisites};
  return {...parsed,paths:catalogPaths,references:[...references.values()],source:parsed.reviewable?"catalog":"catalog_unreviewed",verifiedNoPrerequisites};
}
function prerequisiteEligibilityForTerm(course,term){
  const plan=prerequisitePlanForCourse(course);
  const result=globalThis.ScheduleRUEligibilityLogic.evaluatePrerequisitePaths({
    targetTerm:term,
    paths:plan.paths,
    confirmedCourseCodes:confirmedAcademicCourseCodes(),
    scheduledEntries:plannedScheduleCreditEntries(),
  });
  return {...result,plan};
}
function prerequisiteDisplayName(code,plan){
  const known=courseByCode(code);
  const reference=(plan.references||[]).find(item=>item.course_code===code);
  return known?.fullTitle||known?.title||reference?.title||code;
}
function prerequisiteBlockerLabel(result){
  const missing=result?.recommendedPath?.missing||[];
  if(!missing.length) return "A prerequisite must be completed before this semester";
  const names=missing.map(item=>prerequisiteDisplayName(item.course_code,result.plan));
  const same=missing.some(item=>item.reason==="same_term");
  const later=missing.some(item=>item.reason==="later_term");
  const prefix=result.plan?.paths?.length>1?"Choose a prerequisite path and complete ":"Complete ";
  const timing=same?" in an earlier semester (not the same semester)":later?" before moving this course earlier":" before this semester";
  return prefix+names.join(", ")+timing;
}
function prerequisiteChipHtml(code,pathResult,plan){
  const state=pathResult?.courseStates?.find(item=>item.course_code===code)?.state||"unknown";
  const className=state==="completed"||state==="planned_earlier"?" met":state==="same_term"?" same-term":state==="later_term"?" later-term":"";
  const stateLabel=state==="completed"?"Completed":state==="planned_earlier"?"Planned earlier":state==="same_term"?"Same semester — not eligible":state==="later_term"?"Planned later — not eligible":"Not yet planned";
  return `<div class="detail-chip${className}" title="${escapeHtml(stateLabel)}">${escapeHtml(prerequisiteDisplayName(code,plan))}<code>${escapeHtml(code)}</code></div>`;
}
function prerequisiteDetailsHtml(result,course){
  const plan=result.plan;
  if(plan.paths?.length){
    const paths=plan.paths.map((path,index)=>{
      const pathResult=result.paths?.[index];
      const className=pathResult?.missing?.length?" blocked":" met";
      const label=plan.paths.length>1?`Path ${index+1} — complete every course in this path`:"Complete before this course";
      return `<div class="prereq-path${className}"><div class="prereq-path-label">${escapeHtml(label)}</div><div class="detail-chips">${path.map(code=>prerequisiteChipHtml(code,pathResult,plan)).join("")}</div></div>`;
    }).join("");
    const sourceNote=plan.source==="catalog"
      ? "These paths are read from the official catalog."
      : plan.source==="reviewed_conditions"
      ? "These paths come from a reviewed Rutgers prerequisite record."
      : "";
    return `<div class="detail-section"><h3>Course path</h3>${paths}${sourceNote?`<p class="src-note">${sourceNote} A green course is completed or scheduled in an earlier semester.</p>`:""}</div>`;
  }
  if(plan.references?.length){
    return `<div class="detail-section"><h3>Course path</h3><div class="detail-chips">${plan.references.map(reference=>prerequisiteChipHtml(reference.course_code,null,plan)).join("")}</div><p class="src-note">Rutgers lists additional wording or alternatives that the app cannot safely turn into an automatic rule. Verify the official catalog before registration.</p></div>`;
  }
  const state=globalThis.ScheduleRUPlannerUI.coursePathState({
    plan,
    verifiedNoPrerequisites:plan.verifiedNoPrerequisites,
    catalogRecordAvailable:course?.catalogRecordAvailable===true,
    catalogPrerequisites:course?.catalogPrereqs||"",
  });
  return `<div class="detail-section"><h3>Course path</h3><p>${escapeHtml(state.message)}</p></div>`;
}
function compactRestriction(course, standing){
  if(standing) return standing.label;
  const text=cleanApiText(course.restrictions);
  if(/all\s+except\s+(?:1st|first)[ -]?year|not\s+open\s+to\s+(?:1st|first)[ -]?year/i.test(text)) return "Not open to first-year students";
  return text ? "See official catalog details" : "No special enrollment restriction listed";
}
function openCourseDetails(id){
  const c = courseRecordFromId(id);
  if(!c) return;
  document.getElementById("prTitle").textContent = "Course details";
  const body = document.getElementById("prBody");
  if(c.code&&!ST.courseEligibilityFetched[c.code]){
    void loadCourseEligibilityForCodes([c.code]).then(loaded=>{
      if(loaded) openCourseDetails(id);
    });
  }
  const requirementNotes=(c.requirementNotes||[]).join("; ");
  const standing=standingRequirement(c);
  const approvedAlternatives=(c.alternatives||[]).filter(alt=>alt.code||alt.equivalent_course_code);
  const completedAlternative=approvedAlternatives.find(alt=>{
    const code=alt.code||alt.equivalent_course_code;
    return !!ST.completed[requirementCourseId(code)] || Object.values(ST.schedule).some(entry=>entry.code===code);
  });
  const alternativeDetails=approvedAlternatives.map(alt=>{
    const code=alt.code||alt.equivalent_course_code;
    const label=alt.title ? `${alt.title} (${code})` : code;
    return `<div class="detail-chip">${escapeHtml(label)}<code>${escapeHtml(code)}</code></div>`;
  }).join("");
  const scheduledEntry=ST.schedule[c.code];
  const detailsTerm=scheduledEntry
    ? {year:Number(scheduledEntry.year),sem:scheduledEntry.sem}
    : {year:ST.year,sem:"fall"};
  const prerequisiteEligibility=prerequisiteEligibilityForTerm(c,detailsTerm);
  const available=prerequisiteEligibility.status!=="blocked" && (!standing || detailsTerm.year>=standing.year);
  const eligibilityNotice=courseEligibilityNotice(c,detailsTerm);
  const status=completedAlternative
    ? `This requirement is already fulfilled by ${completedAlternative.title||completedAlternative.code||completedAlternative.equivalent_course_code}.`
    : prerequisiteEligibility.status==="blocked"
    ? `Not yet available: ${prerequisiteBlockerLabel(prerequisiteEligibility)}.`
    : available
    ? (prerequisiteEligibility.plan.paths?.length ? "Available based on prerequisite courses completed or planned in earlier semesters." : "No verified prerequisite rule is blocking this course in the app.")
    : `Not yet available in the ${academicYearLabel(detailsTerm.year)} plan year because ${standing?.label?.toLowerCase()||"of an enrollment restriction"}.`;
  body.innerHTML=`
    <div class="detail-overview">
      <h2>${escapeHtml(c.fullTitle||c.title)}</h2>
      <div class="detail-code">${escapeHtml(c.code)} · ${escapeHtml(courseCreditsLabel(c.credits))}</div>
    <div class="detail-status${(available||completedAlternative)?" ready":""}">${escapeHtml(status)}</div>
    </div>
    <div class="detail-section"><h3>${standing?"When you can take it":"Enrollment"}</h3><p>${escapeHtml(compactRestriction(c,standing))}</p></div>
    ${eligibilityNotice?`<div class="detail-section"><h3>Planning eligibility</h3><p>${escapeHtml(eligibilityNotice)}</p></div>`:""}
    ${alternativeDetails?`<div class="detail-section"><h3>Also accepted for this requirement</h3><div class="detail-chips">${alternativeDetails}</div><p class="src-note">This reviewed equivalency comes from the degree-audit rule recorded for this requirement.</p></div>`:""}
    ${prerequisiteDetailsHtml(prerequisiteEligibility,c)}
    ${c.description?`<div class="detail-section"><h3>About this course</h3><p>${escapeHtml(cleanApiText(c.description))}</p></div>`:""}
    ${(c.catalogPrereqs||c.subjectNotes||requirementNotes||c.restrictions)?`<details class="detail-advanced"><summary>Official catalog details</summary><div class="detail-advanced-body">
      ${c.catalogPrereqs?`<p><b>Official prerequisite wording</b><br/>${escapeHtml(cleanApiText(c.catalogPrereqs))}</p>`:""}
      ${c.subjectNotes?`<p><b>Special notes</b><br/>${escapeHtml(cleanApiText(c.subjectNotes))}</p>`:""}
      ${requirementNotes?`<p><b>Degree requirement note</b><br/>${escapeHtml(requirementNotes)}</p>`:""}
      ${c.restrictions&&!standing?`<p><b>Catalog enrollment wording</b><br/>${escapeHtml(cleanApiText(c.restrictions))}</p>`:""}
    </div></details>`:""}
    <p class="src-note">Course details come from the official degree requirement and the current Rutgers course catalog when that course is offered this term.</p>`;
  document.getElementById("prOv").classList.add("open");
}
function closeCourseDetails(){
  document.getElementById("prOv").classList.remove("open");
  if(ST.returnToPicker && ST.pickerGroupId){
    ST.returnToPicker=false;
    document.getElementById("pickerOv").classList.add("open");
    renderRequirementPicker();
  }
}
document.getElementById("prClose").addEventListener("click", closeCourseDetails);

/* ============================================================
   LARGE REQUIREMENT GROUP PICKER
   ============================================================ */
function closeRequirementPicker(){
  document.getElementById("pickerOv").classList.remove("open");
  ST.pickerGroupId=null;
  ST.pickerSelector=null;
}
function openRequirementPicker(gk){
  const g=GROUPS[gk];
  const selectors=reviewedGroupSelectors(g);
  if(!g) return;
  if(!(g.members||[]).length&&!selectors.length) return;
  ST.pickerGroupId=gk;
  ST.pickerSelector=selectors.length?{
    groupId:gk,records:[],loading:false,error:"",page:1,total:0,search:"",requestGeneration:0,
  }:null;
  document.getElementById("pickerTitle").textContent=groupDisplayName(g);
  document.getElementById("pickerOv").classList.add("open");
  document.getElementById("pickerSearch").value="";
  renderRequirementPicker();
  document.getElementById("pickerSearch").focus();
  if(ST.pickerSelector) loadRequirementPickerSelectorCourses();
}
function groupAcceptsCourseId(g,id){
  if((g?.members||[]).includes(id))return true;
  const record=COURSES[id] ? requirementCourseRecord(id) : courseRecordFromId(id);
  return !!record&&globalThis.ScheduleRUCourseSelectorLogic.matchesAnySelector(record,reviewedGroupSelectors(g));
}
async function loadRequirementPickerSelectorCourses(){
  const state=ST.pickerSelector,group=GROUPS[ST.pickerGroupId];
  if(!state||!group||state.groupId!==group.id)return;
  const generation=state.requestGeneration+1;
  state.requestGeneration=generation;state.loading=true;state.error="";renderRequirementPicker();
  try{
    const params=new URLSearchParams({
      search:state.search||"",limit:String(PAGE_SIZE),offset:String((state.page-1)*PAGE_SIZE),
      selector:JSON.stringify(reviewedGroupSelectors(group)),
    });
    const response=await backendFetch("/api/courses?"+params.toString());
    if(ST.pickerSelector!==state||state.requestGeneration!==generation)return;
    state.records=(response.courses||[]).map(backendCourseRecord).filter(Boolean);
    state.records.forEach(registerSelectorCourseRecord);
    state.total=Number(response.total)||state.records.length;
  }catch(error){
    if(ST.pickerSelector===state&&state.requestGeneration===generation)state.error=error.message||"Approved courses could not be loaded.";
  }finally{
    if(ST.pickerSelector===state&&state.requestGeneration===generation){state.loading=false;renderRequirementPicker();}
  }
}
function renderRequirementPicker(){
  const g=GROUPS[ST.pickerGroupId];
  if(!g) return;
  const selected=selectedRequirementCourses(g.id);
  const applied=groupAppliedCourseIds(g);
  const limit=selectionLimit(g);
  const constraints=(g.children||[]).map(id=>GROUPS[id]).filter(isConstraintGroup);
  const search=String(document.getElementById("pickerSearch")?.value||"").trim().toLowerCase();
  document.getElementById("pickerIntro").textContent=
    g.rule==="distinct"
      ? `Choose ${limit} approved courses that cover ${g.count} distinct Arts and Humanities learning goals. Save any course here to your Wishlist without changing the requirement choice.`
      : `Scheduled, completed, and shared selected courses apply automatically. Choose up to ${Math.max(0,limit-applied.length)} additional approved ${limit===1?"course":"courses"} for this requirement.${constraints.length?` Your choices must also satisfy: ${constraints.map(child=>`${groupDisplayName(child)} (${groupRuleLabel(child)})`).join("; ")}.`:""} Chosen courses are also saved to your Wishlist.`;
  const selectorState=ST.pickerSelector;
  const sourceIds=selectorState
    ? selectorState.records.map(registerSelectorCourseRecord).filter(Boolean)
    : (g.members||[]);
  const ids=sourceIds.filter(id=>{
    const c=COURSES[id];
    return c && (!search || `${c.code} ${c.title} ${c.fullTitle||""}`.toLowerCase().includes(search));
  });
  const list=document.getElementById("pickerList");
  if(selectorState?.loading)list.innerHTML=`<div class="loading">Loading approved courses…</div>`;
  else if(selectorState?.error)list.innerHTML=`<div class="api-status err">${escapeHtml(selectorState.error)}</div><div class="choice-actions"><button class="choice-btn" id="pickerRetry">Retry</button></div>`;
  else list.innerHTML=ids.length?ids.map(id=>{
    const c=COURSES[id];
    const picked=selected.includes(id);
    const alreadyApplied=applied.includes(id);
    const selectSlotAvailable=new Set([...applied,...selected]).size<limit;
    const pickerActions=globalThis.ScheduleRUPlannerUI.pickerActions({
      alreadyApplied,
      selected:picked,
      canSelect:selectSlotAvailable,
      inWishlist:!!ST.wishlist[c.code],
    });
    return `<div class="picker-row${picked||alreadyApplied?" selected":""}">
      <div><div class="picker-code">${escapeHtml(c.code)}</div><div class="picker-name">${escapeHtml(c.fullTitle||c.title)}</div><div class="picker-meta">${escapeHtml(courseCreditsLabel(c.credits))}</div></div>
      <div class="picker-actions"><button class="picker-btn view" data-pview="${id}">Details</button><button class="picker-btn${pickerActions.intent==="wishlist"?" secondary":""}${pickerActions.intent==="wishlist"&&pickerActions.selected?" wishlist-active":""}" data-paction="${id}" data-pintent="${pickerActions.intent}" ${pickerActions.disabled?"disabled":""}>${pickerActions.label}</button></div>
    </div>`;
  }).join(""):`<div class="api-status">No approved course matches that search.</div>`;
  if(selectorState&&!selectorState.loading&&!selectorState.error){
    const pages=Math.max(1,Math.ceil(selectorState.total/PAGE_SIZE));
    list.insertAdjacentHTML("beforeend",`<div class="pager"><button id="pickerPrev" ${selectorState.page<=1?"disabled":""}>← Prev</button><span class="pg-info">Page ${selectorState.page} of ${pages}</span><button id="pickerNext" ${selectorState.page>=pages?"disabled":""}>Next →</button></div>`);
  }
  document.getElementById("pickerRetry")?.addEventListener("click",loadRequirementPickerSelectorCourses);
  document.getElementById("pickerPrev")?.addEventListener("click",()=>{selectorState.page-=1;loadRequirementPickerSelectorCourses();});
  document.getElementById("pickerNext")?.addEventListener("click",()=>{selectorState.page+=1;loadRequirementPickerSelectorCourses();});
  list.querySelectorAll("[data-pview]").forEach(b=>b.addEventListener("click",()=>{
    ST.returnToPicker=true;
    document.getElementById("pickerOv").classList.remove("open");
    openCourseDetails(b.dataset.pview);
  }));
  list.querySelectorAll("[data-paction]").forEach(b=>b.addEventListener("click",()=>{
    const id=b.dataset.paction;
    if(b.dataset.pintent==="wishlist"){
      const record=courseRecordFromId(id);
      if(!record?.code)return;
      if(ST.wishlist[record.code])delete ST.wishlist[record.code];
      else addToWishlist(record.code,record);
      savePlannerState();
      renderAll();
      renderRequirementPicker();
      return;
    }
    const current=selectedRequirementCourses(g.id);
    const currentlyApplied=groupAppliedCourseIds(g);
    if(currentlyApplied.includes(id)){
      return;
    }else if(current.includes(id)){
      ST.groupSelections[g.id]=current.filter(item=>item!==id);
    }else if(new Set([...currentlyApplied,...current]).size<limit){
      const proposed=[...current,id];
      const violation=parentSelectionConstraintViolation(g, proposed);
      if(violation){
        modalController.show({title:"Selection needs review",body:`<p>${escapeHtml(violation)}</p>`,actions:[{label:"Close",secondary:true}]});
        return;
      }
      ST.groupSelections[g.id]=proposed;
      addToWishlist(id,courseRecordFromId(id));
    }
    renderAll();
    renderRequirementPicker();
  }));
}
document.getElementById("pickerClose").addEventListener("click", closeRequirementPicker);
let pickerSearchTimer;
document.getElementById("pickerSearch").addEventListener("input",event=>{
  if(!ST.pickerSelector){renderRequirementPicker();return;}
  ST.pickerSelector.search=event.target.value;ST.pickerSelector.page=1;
  clearTimeout(pickerSearchTimer);
  pickerSearchTimer=setTimeout(loadRequirementPickerSelectorCourses,250);
});

/* ============================================================
   COURSE RECORDS — one shape for requirements, catalog, wishlist and plan
   ============================================================ */
function catalogCourseCode(c){
  return c?.code || [c?.school,c?.subject_code,c?.course_number].filter(Boolean).join(":");
}
function requirementCourseRecord(id){
  const c=COURSES[id];
  if(!c) return null;
  return {
    id, code:c.code, title:c.title||c.fullTitle||c.code, fullTitle:c.fullTitle||c.title||c.code,
    credits:c.credits??"", description:c.description||"", catalogPrereqs:c.catalogPrereqs||"",
    subjectNotes:c.subjectNotes||"", restrictions:c.restrictions||"", requirementNotes:c.requirementNotes||[],
    prereqs:Array.isArray(c.prereqs)?c.prereqs:[], alternatives:Array.isArray(c.alternatives)?c.alternatives:[], requirementId:id,
    eligibility:c.eligibility||null, catalogRecordAvailable:c.catalogRecordAvailable===true,
  };
}
function backendCourseRecord(c){
  if(!c) return null;
  const code=catalogCourseCode(c);
  if(!code) return null;
  return {
    id:c.id||code, code, title:cleanApiText(c.title)||code, fullTitle:cleanApiText(c.title)||code,
    credits:c.credits??"", description:cleanApiText(c.description), catalogPrereqs:cleanApiText(c.prereqs),
    subjectNotes:cleanApiText(c.subject_notes), restrictions:cleanApiText(c.restrictions), requirementNotes:[], prereqs:[],
    eligibility:ST.courseEligibilityByCode[code]||null, catalogRecordAvailable:true,
  };
}
function courseRecordFromId(ref){
  const id=String(ref||"");
  const directRequirement=COURSES[id] ? requirementCourseRecord(id) : null;
  const requirementEntry=Object.entries(COURSES).find(([,course])=>course.code===id);
  const requirement=requirementEntry ? requirementCourseRecord(requirementEntry[0]) : directRequirement;
  const code=requirement?.code||(/^\d{2}:\d{3}:\d{3}$/.test(id)?id:"");
  const wishlist=Object.values(ST.wishlist||{}).find(record=>record&&typeof record==="object"
    && (record.code===code||record.id===id)) || (ST.wishlist[id]&&typeof ST.wishlist[id]==="object"?ST.wishlist[id]:null);
  const scheduled=Object.values(ST.schedule||{}).find(entry=>entry?.code===code||entry?.course?.id===id);
  const catalog=(ST.backendCourses||[]).find(c=>c.id===id || catalogCourseCode(c)===(code||id));
  const merged=globalThis.ScheduleRUCourseInteractionLogic.mergeCourseRecords([
    requirement,scheduled?.course,scheduled,wishlist,backendCourseRecord(catalog),
  ]);
  if(merged.code) return merged;
  // Older in-memory wishlist entries were saved as { courseCode: true }.
  // Preserve the code even when their original catalog page is no longer open.
  return /^\d{2}:\d{3}:\d{3}$/.test(id)
    ? {id,code:id,title:id,fullTitle:id,credits:"",description:"",catalogPrereqs:"",subjectNotes:"",restrictions:"",requirementNotes:[],prereqs:[],catalogRecordAvailable:false}
    : null;
}
function addToWishlist(ref, explicitRecord=null){
  const record=explicitRecord||courseRecordFromId(ref);
  if(!record?.code) return;
  // The public course code is the stable identity shared by Rutgers' catalog,
  // a degree requirement and a scheduled section. Storing the full record here
  // prevents title/credit data from disappearing during drag-and-drop.
  ST.wishlist[record.code]=globalThis.ScheduleRUCourseInteractionLogic.mergeCourseRecords([
    ST.wishlist[record.code],record,{id:record.id||record.code,code:record.code},
  ]);
  savePlannerState();
}
function wishlistRecords(){
  const seen=new Set();
  return Object.entries(ST.wishlist).map(([key,value])=>{
    const record=value&&typeof value==="object" ? value : courseRecordFromId(key);
    return record?.code ? {...record,key} : null;
  }).filter(record=>record&&!seen.has(record.code)&&seen.add(record.code));
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
  ST.backendRequirementFilter={
    group:group||{id:placeholder?.requirementGroupId,name:placeholder?.label||"Core requirement"},
    selectors,
  };
  ST.backendSelectorGroupId=null;ST.backendSearch="";ST.backendSubject="";ST.backendPage=1;ST.expandedIds.clear();
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
  const out=[];
  function visit(groupId){
    const g=GROUPS[groupId];
    if(!g) return;
    if(g.rule==="distinct" || (g.rule!=="all" && (g.members||[]).length)){
      out.push(groupId);
      return;
    }
    (g.children||[]).forEach(visit);
  }
  visit(rootId);
  return out;
}
function coreGroupNeeded(g){
  return g?.rule==="min" || g?.rule==="distinct" ? Math.max(1,Number(g.count)||1) : 0;
}
function chooseCoreGroups(items, size, start=0, picked=[], out=[]){
  if(picked.length===size){ out.push([...picked]); return out; }
  for(let i=start;i<=items.length-(size-picked.length);i++){
    picked.push(items[i]);
    chooseCoreGroups(items,size,i+1,picked,out);
    picked.pop();
  }
  return out;
}
function coreCompletionTokens(){
  const coreIds=new Set(Object.values(GROUPS).flatMap(g=>g.members||[]));
  const tokens=[];
  [...coreIds].filter(directlyCompletedCoreCourse).sort().forEach(id=>{
    tokens.push({key:`course:${id}`,kind:"course",courseIds:new Set([id]),courseId:id});
  });
  AP.filter(ap=>ST.apOn[ap.id]).forEach(ap=>{
    const equivalentIds=new Set([
      ...courseCodesFromText(ap.equiv).map(requirementCourseId),
      ...(ap.fulfills||[]),
    ]);
    const courseIds=[...coreIds].filter(id=>equivalentIds.has(id));
    if(courseIds.length) tokens.push({key:`ap:${ap.id}`,kind:"ap",ap,courseIds:new Set(courseIds)});
  });
  return tokens;
}
function coreSlotsForRoot(rootId){
  const fixed=[];
  let variants=[[]];
  coreRequirementGroups(rootId).forEach(groupId=>{
    const g=GROUPS[groupId];
    if(g.rule==="distinct"){
      const children=(g.children||[]).map(id=>GROUPS[id]).filter(child=>(child?.members||[]).length);
      const choices=[[]];
      for(let count=1;count<=Math.min(coreGroupNeeded(g),children.length);count++){
        chooseCoreGroups(children,count).forEach(subset=>{
          choices.push(subset.map(child=>({groupId:g.id,subgroupId:child.id,courseIds:new Set(child.members||[]),apAllowed:coreApAllowedForGroup(g)})));
        });
      }
      variants=variants.flatMap(base=>choices.map(choice=>[...base,...choice]));
      return;
    }
    for(let i=0;i<coreGroupNeeded(g);i++){
      fixed.push({groupId:g.id,courseIds:new Set(g.members||[]),apAllowed:coreApAllowedForGroup(g)});
    }
  });
  return variants.map(variant=>[...fixed,...variant].map((slot,index)=>({...slot,key:`${rootId}:${slot.groupId}:${index}`})));
}
function coreMaximumMatching(slots,tokens){
  const tokenByKey=new Map(tokens.map(token=>[token.key,token]));
  const candidates=new Map(slots.map(slot=>[slot.key,tokens.filter(token=>
    (token.kind!=="ap" || slot.apAllowed) && [...slot.courseIds].some(id=>token.courseIds.has(id))
  ).map(token=>token.key)]));
  const tokenToSlot=new Map();
  const slotByKey=new Map(slots.map(slot=>[slot.key,slot]));
  function place(slotKey,seenTokens){
    for(const tokenKey of candidates.get(slotKey)||[]){
      if(seenTokens.has(tokenKey)) continue;
      seenTokens.add(tokenKey);
      const previous=tokenToSlot.get(tokenKey);
      if(previous===undefined || place(previous,seenTokens)){
        tokenToSlot.set(tokenKey,slotKey);
        return true;
      }
    }
    return false;
  }
  [...slots].sort((a,b)=>(candidates.get(a.key)||[]).length-(candidates.get(b.key)||[]).length)
    .forEach(slot=>place(slot.key,new Set()));
  return [...tokenToSlot.entries()].map(([tokenKey,slotKey])=>({token:tokenByKey.get(tokenKey),slot:slotByKey.get(slotKey)}));
}
function computeCoreAllocation(){
  const tokens=coreCompletionTokens();
  const byGroup={};
  ROOT_GROUPS.forEach(rootId=>{
    let best=[];
    coreSlotsForRoot(rootId).forEach(slots=>{
      const matches=coreMaximumMatching(slots,tokens);
      if(matches.length>best.length) best=matches;
    });
    best.forEach(({slot,token})=>{
      (byGroup[slot.groupId] ||= []).push(token);
      if(slot.subgroupId) (byGroup[slot.subgroupId] ||= []).push(token);
    });
  });
  return {tokens,byGroup};
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
function renderRequired(){
  useRequirementTree(ST.majorRequirementTree);
  const pb=document.getElementById("pb");
  if(ST.requirementsLoading){
    pb.innerHTML=`<div class="empty" style="margin-top:30px;">Loading requirements from Rutgers…</div>`;
    return;
  }
  if(ST.requirementsError){
    pb.innerHTML=`<div class="api-status err">Could not load degree requirements: ${escapeHtml(ST.requirementsError)}</div>`;
    return;
  }
  let h=`<div class="leg">Gray = not yet unlocked. Green = completed or AP-waived. Click any course card for full details; click ○ to mark a course taken/waived.</div>${catalogListedProgramsBannerHtml()}${programEligibilityBannerHtml()}${doubleCountBannerHtml()}`;
  ROOT_GROUPS.forEach(gk=>{
    const g=GROUPS[gk];
    if(!g) return;
    const applied=groupAppliedCourseIds(g);
    const members=(g.members||[]).filter(id=>!applied.includes(id));
    const children=(g.children||[]).map(groupHtml).join("");
    if(g.rule==="all"){
      h+=`<div class="sec-hdr">${groupDisplayName(g)}</div>`;
      h+=selectorGuidanceHtml(g);
      if(applied.length) h+=`<div class="choice-picked"><strong style="font-size:10px;">Applied here</strong><div class="cgrid">${applied.map(id=>cardHtml(id)).join("")}</div></div>`;
      if(members.length) h+=`<div class="cgrid">${members.map(id=>cardHtml(id)).join("")}</div>`;
      h+=children;
    } else {
      h+=groupHtml(gk);
    }
  });
  if(!ROOT_GROUPS.length) h+=`<div class="empty" style="margin-top:30px;">No reviewed requirements are available for the selected catalog-listed program yet.</div>`;
  pb.innerHTML=h;
  attachCardEvents(pb);
  pb.querySelectorAll("[data-gtog]").forEach(d=>d.addEventListener("click",()=>
    document.getElementById("gb-"+d.dataset.gtog).classList.toggle("open")));
  pb.querySelectorAll("[data-gpicker]").forEach(b=>b.addEventListener("click",e=>{
    e.stopPropagation(); openRequirementPicker(b.dataset.gpicker);
  }));
  pb.querySelectorAll("[data-gbrowse]").forEach(b=>b.addEventListener("click",e=>{
    e.stopPropagation(); openSelectorCourseBrowser(b.dataset.gbrowse);
  }));
  pb.querySelectorAll("[data-gclear]").forEach(b=>b.addEventListener("click",e=>{
    e.stopPropagation(); delete ST.groupSelections[b.dataset.gclear]; renderPanel();
  }));
}

function catalogListedProgramsBannerHtml(){
  const listed=selectedProgramRows().filter(program=>program?.requirements_available===false||program?.coverage_status==="catalog_listed");
  if(!listed.length) return "";
  const names=listed.map(program=>program.name).join(", ");
  return `<div class="dc-banner warn"><b>Requirements under review</b><div>${escapeHtml(names)} ${listed.length===1?"is":"are"} selectable from the official SAS catalog, but ScheduleRU is not yet showing a program-specific requirement audit. Use the linked catalog entry and SAS advising to confirm progress while we import the rules.</div></div>`;
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
    pb.innerHTML=`<div class="api-status err">Could not load the Core Curriculum: ${escapeHtml(ST.coreError)}</div>`;
    return;
  }
  if(!ST.coreRequirementTree){
    pb.innerHTML=`<div class="empty" style="margin-top:30px;">The reviewed ${escapeHtml(activeCoreLabel())} is not available yet.</div>`;
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
  ST.backendUrl = (u||"").trim().replace(/\/$/,"");
  try{ localStorage.setItem(BACKEND_URL_STORAGE_KEY, ST.backendUrl); }catch(e){}
}

async function backendFetch(path,options={}){
  if(!ST.backendUrl) throw new Error("No backend URL set.");
  const res = await fetch(ST.backendUrl + path,options);
  const text = await res.text();
  if(!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0,150)}`);
  try{ return JSON.parse(text); }
  catch(e){ throw new Error(`Response wasn't JSON: ${text.slice(0,150)}`); }
}

function activeCatalogSelectorContext(){
  if(ST.backendRequirementFilter?.selectors?.length)return ST.backendRequirementFilter;
  const group=GROUPS[ST.backendSelectorGroupId];
  const selectors=reviewedGroupSelectors(group);
  return group&&selectors.length ? {group,selectors} : null;
}
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
  ST.backendSelectorGroupId=null;
  ST.backendRequirementFilter=null;
  ST.backendPage=1;
  ST.expandedIds.clear();
  loadBackendCourses();
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

function requirementCourseId(code){
  return String(code||"").replace(/[^0-9A-Za-z]/g, "");
}
function prerequisiteIds(row, courseId, availableCourses=COURSES){
  // The catalog prerequisite field contains nested AND/OR alternatives. It
  // is not safe to flatten that grammar into a list of mandatory courses.
  // Use only a simple scraper note with no alternatives; ambiguous rules are
  // left unlocked rather than incorrectly blocking a student.
  const text=String(row.note||"").trim();
  if(!/^pre-reqs?:/i.test(text) || /;|\bor\b/i.test(text)) return [];
  const codes = text.match(/\b\d{2}:\d{3}:\d{3}\b/g)||[];
  return [...new Set(codes.map(requirementCourseId))].filter(id=>id && id!==courseId && availableCourses[id]);
}
function buildRequirementTree(requirements){
  const nextCourses={};
  const nextGroups={};
  const rootIds=[];
  const courseRows=[];
  const mapRule=rule=>rule==="min_courses" ? "min" : rule==="max_courses" ? "max" : rule==="min_credits" ? "min_credits" : rule==="max_credits" ? "max_credits" : rule==="min_distinct_children" ? "distinct" : rule==="one_of" ? "one_of" : "all";

  function addGroup(raw, parentId=null, inheritedSourceProgramIds=[]){
    const sourceProgramIds=[...new Set([
      ...(Array.isArray(raw.sourceProgramIds)?raw.sourceProgramIds:[]),
      ...inheritedSourceProgramIds,
    ].filter(Boolean))];
    const group={
      id:raw.id, name:raw.name, rule:mapRule(raw.rule), count:raw.count,
      parentId, members:[], children:[], sourceProgramId:raw.program_id,
      sourceProgramIds,
      display_family:cleanApiText(raw.display_family),
      display_priority:Number(raw.display_priority)||0,
      allocation:raw.allocation,
      courseSelectors:Array.isArray(raw.course_selectors)?raw.course_selectors:[],
    };
    nextGroups[group.id]=group;
    for(const row of raw.courses||[]){
      const id=requirementCourseId(row.course_code);
      if(!id) continue;
      const existing=nextCourses[id];
      const sourceTitle=cleanApiText(row.source_title);
      const catalogTitle=cleanApiText(row.catalog_title);
      const sourceCredits=cleanApiText(row.source_credits);
      const note=cleanApiText(row.note);
      const alternatives=[
        ...(existing?.alternatives||[]),
        ...(row.alternatives||[]).map(alt=>({
          code:cleanApiText(alt.equivalent_course_code)||cleanApiText(alt.code),
          title:cleanApiText(alt.catalog_title)||cleanApiText(alt.source_title),
          credits:cleanApiText(alt.catalog_credits),
          note:cleanApiText(alt.note),
          sourceLabel:cleanApiText(alt.source_label),
        })),
      ];
      nextCourses[id]={
        ...existing,
        code:row.course_code,
        // Keep source metadata when a course is not offered this term, but
        // prefer the live Rutgers catalog when it is available: it carries
        // the current official course title (for example, Game Theory and
        // Economics rather than a stale abbreviated requirement label).
        title:catalogTitle||sourceTitle||existing?.title||row.course_code,
        fullTitle:catalogTitle||sourceTitle||existing?.fullTitle||row.course_code,
        credits:sourceCredits||cleanApiText(row.catalog_credits)||existing?.credits||"",
        description:cleanApiText(row.catalog_description)||existing?.description||"",
        catalogPrereqs:cleanApiText(row.catalog_prereqs)||existing?.catalogPrereqs||"",
        subjectNotes:cleanApiText(row.catalog_subject_notes)||existing?.subjectNotes||"",
        restrictions:cleanApiText(row.section_restrictions)||existing?.restrictions||"",
        catalogRecordAvailable:!!(catalogTitle||row.catalog_description||row.catalog_prereqs||row.catalog_subject_notes),
        requirementNotes:[...new Set([...(existing?.requirementNotes||[]),note].filter(Boolean))],
        prereqs:existing?.prereqs||[],
        eligibility:row.eligibility||existing?.eligibility||null,
        alternatives:[...new Map(alternatives.filter(alt=>alt.code).map(alt=>[alt.code,alt])).values()],
      };
      group.members.push(id);
      courseRows.push({id,row});
    }
    for(const child of raw.children||[]) group.children.push(addGroup(child, group.id,sourceProgramIds));
    return group.id;
  }

  for(const root of requirements||[]) rootIds.push(addGroup(root));
  for(const {id,row} of courseRows){
    nextCourses[id].prereqs=[...new Set([...(nextCourses[id].prereqs||[]),...prerequisiteIds(row,id,nextCourses)])];
  }
  return {courses:nextCourses, groups:nextGroups, roots:rootIds};
}
function useRequirementTree(tree){
  COURSES=tree?.courses||{};
  GROUPS=tree?.groups||{};
  ROOT_GROUPS=tree?.roots||[];
}

/* ============================================================
   MULTI-PROGRAM REQUIREMENTS + DOUBLE-COUNT CHECK
   ============================================================ */
function collectRawCourseCodes(group, into=new Set()){
  for(const course of group?.courses||[]) if(course?.course_code) into.add(course.course_code);
  for(const child of group?.children||[]) collectRawCourseCodes(child,into);
  return into;
}
function collectRawSelectorSignatures(group, into=[]){
  for(const selector of group?.course_selectors||[]){
    const raw=typeof selector?.selector_json==="string" ? selector.selector_json : JSON.stringify(selector?.selector_json||{});
    if(raw) into.push(raw);
  }
  for(const child of group?.children||[]) collectRawSelectorSignatures(child,into);
  return into;
}
function normalizedRequirementName(name){
  return String(name||"").replace(/\s+/g," ").trim().toLowerCase();
}
function rootRequirementSignature(root){
  const codes=[...collectRawCourseCodes(root)].sort();
  const selectors=collectRawSelectorSignatures(root).sort();
  return JSON.stringify([normalizedRequirementName(root?.name),root?.rule||"",root?.count??null,codes,selectors]);
}
function sharedRootGroups(requirementTrees, programIds){
  return ScheduleRURequirementLogic.sharedRequirementGroups(
    requirementTrees,programIds,rootRequirementSignature
  );
}
function sharedRootKey(root){
  return ScheduleRURequirementLogic.sharedRequirementRootKey(root,rootRequirementSignature);
}
function rootCourseCodes(root){
  return (root?.courses||[]).map(course=>course?.course_code).filter(Boolean);
}
function sharedCoreBaselines(referenceTrees){
  const candidates=new Map();
  for(const roots of Object.values(referenceTrees||{})){
    for(const root of roots||[]){
      const key=normalizedRequirementName(root?.name);
      const codes=rootCourseCodes(root);
      if(!key || root?.rule!=="all" || (root?.children||[]).length || codes.length<4 || !/(business|foundational|common|core)/i.test(root?.name||"")) continue;
      const rows=candidates.get(key)||[];
      rows.push(root);
      candidates.set(key,rows);
    }
  }
  const baselines=new Map();
  for(const [key,roots] of candidates){
    if(roots.length<2) continue;
    const shared=roots.slice(1).reduce((codes,root)=>{
      const available=new Set(rootCourseCodes(root));
      return codes.filter(code=>available.has(code));
    },rootCourseCodes(roots[0]));
    if(shared.length>=4) baselines.set(key,{template:roots[0], codes:new Set(shared)});
  }
  return baselines;
}
function normalizedCoreRequirementTrees(requirementTrees, programIds,{referenceRequirementTrees=ST.referenceRequirementTrees,availablePrograms=ST.availablePrograms}={}){
  const baselines=sharedCoreBaselines(Object.keys(referenceRequirementTrees||{}).length?referenceRequirementTrees:requirementTrees);
  if(!baselines.size) return requirementTrees;
  const out={};
  for(const programId of programIds){
    const roots=requirementTrees[programId]||[];
    out[programId]=roots.flatMap(root=>{
      const baseline=baselines.get(normalizedRequirementName(root?.name));
      const rootCodes=rootCourseCodes(root);
      if(!baseline || root?.rule!=="all" || (root?.children||[]).length || !rootCodes.length) return [root];
      const byCode=new Map((root.courses||[]).map(course=>[course.course_code,course]));
      const sharedCourses=[...baseline.codes].map(code=>byCode.get(code)||baseline.template.courses?.find(course=>course.course_code===code)).filter(Boolean);
      const sharedRoot={...root, id:`${root.id}-shared-base`, courses:sharedCourses};
      const residualCourses=(root.courses||[]).filter(course=>{
        if(baseline.codes.has(course.course_code)) return false;
        // If a school lists an Accounting-only course in both the business
        // core and its Required Accounting section, show it once only.
        return !roots.some(other=>other!==root && rootCourseCodes(other).includes(course.course_code));
      });
      if(!residualCourses.length) return [sharedRoot];
      const program=(availablePrograms||[]).find(item=>item.id===programId);
      return [sharedRoot,{
        ...root,
        id:`${root.id}-program-additions`,
        name:`${program?.name||"Program"}-specific additions to ${root.name}`,
        courses:residualCourses,
      }];
    });
  }
  return out;
}
function requirementsForDisplay(requirementTrees, programIds){
  return ScheduleRURequirementLogic.requirementsForDisplay(
    requirementTrees,programIds,rootRequirementSignature
  );
}
function computeDoubleCountOverlaps(requirementTrees, programIds,{availablePrograms=ST.availablePrograms,doubleCountExceptions=ST.doubleCountExceptions,doubleCountPolicies=ST.doubleCountPolicies}={}){
  const shared=sharedRootGroups(requirementTrees,programIds);
  const sharedKeys=new Set(shared.map(entry=>entry.key));
  const programsById=Object.fromEntries((availablePrograms||[]).map(program=>[program.id,program]));
  const coursePrograms=new Map();
  for(const id of programIds){
    const codes=new Set();
    for(const root of requirementTrees[id]||[]){
      if(sharedKeys.has(sharedRootKey(root))) continue;
      collectRawCourseCodes(root,codes);
    }
    for(const code of codes){
      const ids=coursePrograms.get(code)||new Set();
      ids.add(id);
      coursePrograms.set(code,ids);
    }
  }
  const overlaps=[...coursePrograms.entries()]
    .filter(([,ids])=>ids.size>1)
    .map(([code,ids])=>({code,programs:[...ids]}))
    .sort((a,b)=>a.code.localeCompare(b.code));
  const partition=ScheduleRURequirementLogic.partitionDoubleCountOverlaps(
    overlaps,programsById,doubleCountExceptions||[]
  );
  const scopeResults=["major_major","major_concentration"].map(scope=>{
    const policy=(doubleCountPolicies||[]).find(item=>item.scope===scope);
    const codes=partition.scopes[scope]||[];
    const cap=policy?.max_shared_courses===null||policy?.max_shared_courses===undefined ? null : Number(policy.max_shared_courses);
    return {scope,policy,codes,cap,violates:cap!==null&&codes.length>cap};
  });
  return {shared,overlaps,scopeResults,unscoped:partition.unscoped||[],exceptions:partition.exceptions||[]};
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
  const [data,policyData]=await Promise.all([
    backendFetch("/api/programs"),
    backendFetch(`/api/program-selection-policies?home_school=${encodeURIComponent(ST.homeSchoolSlug)}`),
  ]);
  ST.availablePrograms=(data.programs||[])
    .filter(p=>["major","minor","concentration","certificate"].includes(p.type))
    .filter(programIsAvailableForHomeSchool);
  const catalogReplacements=new Map(ST.availablePrograms
    .filter(program=>typeof program.catalog_program_id==="string"&&program.catalog_program_id)
    .map(program=>[program.catalog_program_id,program.id]));
  const migratedSelections=[...new Set(ST.selectedPrograms.map(id=>catalogReplacements.get(id)||id))];
  if(migratedSelections.some((id,index)=>id!==ST.selectedPrograms[index])||migratedSelections.length!==ST.selectedPrograms.length){
    ST.selectedPrograms=migratedSelections;
    savePlannerState();
  }
  ST.programSelectionPolicies=policyData||{limits:[],combination_policies:[]};
  return ST.availablePrograms;
}
async function loadAvailableSchools(){
  const data=await backendFetch("/api/schools");
  const schools=Array.isArray(data.schools)?data.schools.filter(school=>school&&typeof school.slug==="string"&&school.slug):[];
  if(!schools.length) throw new Error("No reviewed Rutgers school profiles are available yet.");
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
async function loadSelectedRequirements(programIds){
  const ids=[...new Set((programIds||[]).filter(Boolean))];
  if(!ids.length) throw new Error("Choose at least one program.");
  const [data,policies]=await Promise.all([
    backendFetch(`/api/requirements?programs=${ids.map(encodeURIComponent).join(",")}`),
    backendFetch(`/api/double-count-policies?school=${encodeURIComponent(ST.homeSchoolSlug)}`),
  ]);
  const returned=data.requirements||{};
  const visibleIds=ids.filter(id=>Array.isArray(returned[id]));
  if(!visibleIds.length) throw new Error("None of the selected programs is available from the current catalog.");
  const normalized=normalizedCoreRequirementTrees(returned,visibleIds);
  ST.selectedPrograms=visibleIds;
  ST.catalogListedProgramIds=data.catalog_listed_program_ids||[];
  ST.requirementTrees=normalized;
  ST.doubleCountPolicies=policies.policies||[];
  ST.doubleCountRules=data.double_count_rules||[];
  ST.doubleCountExceptions=data.double_count_exceptions||[];
  ST.programEligibilityRules=data.eligibility_rules||[];
  ST.majorRequirementTree=buildRequirementTree(requirementsForDisplay(normalized,visibleIds));
  if(ST.tab!=="core") useRequirementTree(ST.majorRequirementTree);
  ST.doubleCount=computeDoubleCountOverlaps(normalized,visibleIds);
  ST.activeProgram=visibleIds.length===1 ? (ST.availablePrograms||[]).find(program=>program.id===visibleIds[0])||null : null;
  return {requirements:normalized,policies:ST.doubleCountPolicies};
}
async function loadSchoolReferenceRequirementTrees(programs){
  const ids=(programs||[]).map(program=>program.id).filter(Boolean);
  if(ids.length<2) return {};
  const data=await backendFetch(`/api/requirements?programs=${ids.map(encodeURIComponent).join(",")}`);
  ST.referenceRequirementTrees=data.requirements||{};
  return ST.referenceRequirementTrees;
}
async function loadCoreCurriculum(){
  ST.coreLoading=true;
  ST.coreError="";
  renderPanel();
  try{
    const data=await backendFetch(`/api/core-curricula?school=${encodeURIComponent(ST.homeSchoolSlug)}`);
    const curriculum=(data.curricula||[])[0];
    if(!curriculum) throw new Error(`No reviewed ${activeCoreLabel()} is available yet.`);
    const detail=await backendFetch(`/api/programs/${encodeURIComponent(curriculum.id)}/requirements`);
    ST.coreCurricula=data.curricula||[];
    ST.activeCoreCurriculum=curriculum;
    ST.coreRequirementTree=buildRequirementTree(detail.requirements||[]);
  }catch(err){
    ST.coreError=err.message||"Unknown error";
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
    ST.requirementsError=err.message||"Unknown error";
  }finally{
    ST.requirementsLoading=false;
    renderPanel();
  }
}

async function loadBackendMeta(){
  try{ const d = await backendFetch("/api/subjects"); ST.backendSubjects = d.subjects||[]; }catch(e){ ST.backendSubjects=[]; }
  try{ ST.backendStatus = await backendFetch("/api/sync-status"); }catch(e){ ST.backendStatus=null; }
  renderCoursesPage();
}

async function loadBackendCourses(){
  if(!ST.backendUrl){ ST.backendError=""; ST.backendCourses=[]; renderCoursesPage(); return; }
  ST.backendLoading=true; ST.backendError=""; renderCoursesPage();
  try{
    const params=new URLSearchParams({
      search: ST.backendSearch||"", subject: ST.backendSubject||"",
      limit: String(PAGE_SIZE), offset: String((ST.backendPage-1)*PAGE_SIZE),
    });
    const selectorContext=activeCatalogSelectorContext();
    if(selectorContext) params.set("selector",JSON.stringify(selectorContext.selectors));
    const d = await backendFetch("/api/courses?"+params.toString());
    ST.backendCourses = d.courses||[];
    await loadCourseEligibilityForCodes(ST.backendCourses.map(catalogCourseCode));
    ST.backendTotal = d.total ?? ST.backendCourses.length;
  }catch(err){
    ST.backendError = `Couldn't reach backend: ${err.message}`;
    ST.backendCourses=[];
  }
  ST.backendLoading=false;
  renderCoursesPage();
}

function fmtTimeAgo(ts){
  if(!ts) return "never";
  const mins = Math.round((Date.now()-ts)/60000);
  if(mins < 1) return "just now";
  if(mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins/60);
  if(hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs/24)}d ago`;
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

// Sections are fetched lazily (one call per course, only once it's expanded)
// rather than up front for every row on the page.
async function toggleCourseExpand(id){
  if(ST.expandedIds.has(id)){
    ST.expandedIds.delete(id);
    renderCoursesPage();
    return;
  }
  ST.expandedIds.add(id);
  renderCoursesPage();
  if(!ST.sectionsCache[id]){
    try{
      const d = await backendFetch(`/api/courses/${encodeURIComponent(id)}/sections`);
      ST.sectionsCache[id] = { sections: d.sections||[] };
    }catch(err){
      ST.sectionsCache[id] = { error: err.message };
    }
    renderCoursesPage();
  }
}

function courseRowHtml(c){
  const code = `${c.school}:${c.subject_code}:${c.course_number}`;
  const inW = !!ST.wishlist[code] || wishlistRecords().some(item=>item.code===code);
  const wishlistAction=globalThis.ScheduleRUPlannerUI.catalogWishlistAction({inWishlist:inW});
  const isOpen = ST.expandedIds.has(c.id);
  const openCt = c.open_count ?? 0, totalCt = c.section_count ?? 0;

  let bodyHtml = "";
  if(isOpen){
    const cached = ST.sectionsCache[c.id];
    if(!cached){
      bodyHtml = `<div class="loading">Loading sections…</div>`;
    } else if(cached.error){
      bodyHtml = `<div class="api-status err">${escapeHtml(cached.error)}</div>`;
    } else {
      const sections = cached.sections;
      bodyHtml = `
        ${c.subject_notes ? `<div class="subj-notes"><b>Subject Notes:</b>${escapeHtml(cleanApiText(c.subject_notes))}</div>` : ""}
        ${c.description ? `<div class="cr-desc">${escapeHtml(cleanApiText(c.description))}</div>` : ""}
        ${cleanApiText(c.prereqs)
          ? `<details class="catalog-advanced"><summary>Official prerequisite details</summary><p>${escapeHtml(cleanApiText(c.prereqs))}</p></details>`
          : `<div class="cr-prereqs"><b>Prerequisites</b>None listed</div>`}
        ${sections.length ? `<table class="sec-table">
          <thead><tr><th>Sec</th><th>Status</th><th>Index</th><th>Meeting</th><th>Instructor</th></tr></thead>
          <tbody>${sections.map(s=>{
            const extras=[];
            if(cleanApiText(s.notes)) extras.push(`<div class="row"><b>Notes:</b> ${escapeHtml(cleanApiText(s.notes))}</div>`);
            if(cleanApiText(s.restrictions)) extras.push(`<div class="row"><b>Restrictions:</b> ${escapeHtml(cleanApiText(s.restrictions))}</div>`);
            if(cleanApiText(s.comments)) extras.push(`<div class="row"><b>Comments:</b> ${escapeHtml(cleanApiText(s.comments))}</div>`);
            if(cleanApiText(s.open_to)) extras.push(`<div class="row"><b>Open To:</b> ${escapeHtml(cleanApiText(s.open_to))}</div>`);
            return `<tr>
            <td>${escapeHtml(s.section_number||s.index_number||"")}</td>
            <td class="${s.open_status?'status-open':'status-closed'}">${s.open_status?'OPEN':'CLOSED'}</td>
            <td>${escapeHtml(s.index_number||"")}</td>
            <td>${(s.meetings||[]).map(fmtMeeting).map(escapeHtml).join('<br/>')||'—'}</td>
            <td>${escapeHtml(s.instructor||"—")}</td>
          </tr>${extras.length?`<tr class="sec-extra"><td colspan="5">${extras.join("")}</td></tr>`:""}`;
          }).join("")}</tbody>
        </table>` : `<div class="api-status">No sections found for this course.</div>`}`;
    }
  }

  return `<div class="course-row">
    <div class="course-row-hdr" data-toggle="${c.id}">
      <span class="cr-arrow${isOpen?" open":""}">▶</span>
      <span class="cr-code">${escapeHtml(code)}</span>
      ${cleanApiText(c.prereqs) ? `<span class="prereq-hint" onclick="event.stopPropagation()">Prereqs listed<span class="tip">${escapeHtml(cleanApiText(c.prereqs))}</span></span>` : ""}
      <span class="cr-title">${escapeHtml(c.title)}<span class="sub"> ${escapeHtml(c.subject_description||"")}</span></span>
      <span class="cr-credits">${escapeHtml(courseCreditsLabel(c.credits,true))}</span>
      <span class="cr-sections" style="color:${openCt>0?'#3a8a3a':'var(--grayt)'}">${openCt}/${totalCt} open</span>
      <button class="cr-wish${wishlistAction.remove?" selected":""}" data-wadd="${escapeHtml(code)}" aria-pressed="${wishlistAction.remove}">${wishlistAction.label}</button>
    </div>
    <div class="course-row-body${isOpen?" open":""}">${bodyHtml}</div>
  </div>`;
}

function renderCoursesPage(){
  const root = document.getElementById("coursesRoot");
  if(!root) return;
  const coursePage=document.getElementById("page-courses");
  const previousSearch=document.getElementById("cpSearch");
  const viewState=globalThis.ScheduleRUCourseInteractionLogic.catalogViewState({
    scrollLeft:coursePage?.scrollLeft,scrollTop:coursePage?.scrollTop,
    activeElementId:document.activeElement?.id||"",
    selectionStart:previousSearch?.selectionStart,selectionEnd:previousSearch?.selectionEnd,
  });
  const restoreView=()=>requestAnimationFrame(()=>{
    const search=document.getElementById("cpSearch");
    if(viewState.restoreSearchFocus&&search){
      search.focus({preventScroll:true});
      if(viewState.selectionStart!==null)search.setSelectionRange(viewState.selectionStart,viewState.selectionEnd);
    }
    if(coursePage){
      coursePage.scrollLeft=viewState.scrollLeft;
      coursePage.scrollTop=viewState.scrollTop;
    }
  });
  const selectorContext=activeCatalogSelectorContext();

  // Connection bar is always visible so the backend URL can be seen/changed
  // at any time, not just on first connect. The "Open" link hits the raw
  // endpoint directly in a new tab — useful for telling apart "the Worker
  // isn't deployed/reachable" from "it's reachable but CORS/JSON is off",
  // since a plain browser tab isn't subject to the app's CORS fetch rules.
  const connectionBar = `
    <div class="cp-connect">
      <input id="cpUrl" placeholder="https://your-worker.workers.dev" value="${escapeHtml(ST.backendUrl)}"/>
      <button class="add-btn" id="cpConnect">${ST.backendUrl?"Update":"Connect"}</button>
      ${ST.backendUrl?`<a href="${escapeHtml(ST.backendUrl)}/api/sync-status" target="_blank" rel="noopener" class="cp-connect-testlink">Open ↗</a>`:""}
      <span class="cp-connect-status ${ST.backendUrl && !ST.backendError ? "ok" : ""}">${
        ST.backendUrl ? (ST.backendError ? "⚠ " + escapeHtml(ST.backendError) : "● Connected") : "Not connected"
      }</span>
    </div>`;

  function wireConnectionBar(){
    const connectBtn=document.getElementById("cpConnect");
    const urlEl=document.getElementById("cpUrl");
    connectBtn?.addEventListener("click", ()=>{
      saveBackendUrl(urlEl.value);
      ST.backendPage=1; ST.expandedIds.clear(); ST.sectionsCache={};
      loadBackendMeta(); loadBackendCourses();
    });
    urlEl?.addEventListener("keydown", e=>{ if(e.key==="Enter") connectBtn?.click(); });
  }

  if(!ST.backendUrl){
    root.innerHTML = `
      <div class="cp-header"><h1>Course Catalog</h1><div class="cp-sub">Live section data, synced from Rutgers</div></div>
      ${connectionBar}
      <div class="api-status" style="margin-top:8px">Not connected yet. Deploy <code>worker.js</code> (see README.md), then paste its
        <code>https://your-worker.workers.dev</code> URL above.</div>`;
    wireConnectionBar();
    restoreView();
    return;
  }

  const subjOpts = `<option value="">All subjects</option>` + (ST.backendSubjects||[]).map(s=>
    `<option value="${s.code}"${ST.backendSubject===s.code?" selected":""}>${escapeHtml(s.description||s.code)} (${s.code})</option>`
  ).join("");
  const selectorDescription=selectorContext
    ? selectorContext.selectors.map(selector=>globalThis.ScheduleRUCourseSelectorLogic.selectorDescription(selector)).join("; ")
    : "";
  const displayedCourses=selectorContext
    ? ST.backendCourses.filter(course=>globalThis.ScheduleRUCourseSelectorLogic.matchesAnySelector(backendCourseRecord(course),selectorContext.selectors))
    : ST.backendCourses;

  let statusLine = "";
  if(ST.backendStatus){
    const st = ST.backendStatus;
    statusLine = `${st.courses_in_db.toLocaleString()} courses in database · last sync ${fmtTimeAgo(st.last_fetch_at)}`;
  }

  let bodyHtml;
  if(ST.backendLoading){
    bodyHtml = `<div class="loading">Loading courses…</div>`;
  } else if(ST.backendError){
    bodyHtml = `<div class="api-status err">${escapeHtml(ST.backendError)}</div>`;
  } else if(displayedCourses.length){
    const pages = Math.max(1, Math.ceil(ST.backendTotal / PAGE_SIZE));
    bodyHtml = `
      <div class="course-list">${displayedCourses.map(courseRowHtml).join("")}</div>
      <div class="pager">
        <button id="cpPrev" ${ST.backendPage<=1?"disabled":""}>← Prev</button>
        <span class="pg-info">Page ${ST.backendPage} of ${pages} (${ST.backendTotal.toLocaleString()} courses)</span>
        <button id="cpNext" ${ST.backendPage>=pages?"disabled":""}>Next →</button>
      </div>`;
  } else {
    bodyHtml = `<div class="api-status">Connected — 0 courses matched. Try clearing the search/subject filter, or the backend hasn't finished its first sync yet (check ${escapeHtml(ST.backendUrl)}/api/sync-status).</div>`;
  }

  root.innerHTML = `
    <div class="cp-header"><h1>Course Catalog</h1><div class="cp-sub">${statusLine}</div></div>
    ${connectionBar}
    ${selectorContext?`<div class="choice-summary">Choosing for <b>${escapeHtml(groupDisplayName(selectorContext.group))}</b>: ${escapeHtml(selectorDescription)}. Add one to your wishlist, then place it in your plan to apply it automatically.</div>`:""}
    <div class="cp-controls">
      <input id="cpSearch" placeholder="Search by title or course code…" value="${escapeHtml(ST.backendSearch)}"/>
      ${selectorContext?`<button class="choice-btn secondary" id="cpClearSelector">Clear requirement filter</button>`:`<select id="cpSubject">${subjOpts}</select>`}
    </div>
    ${bodyHtml}`;

  wireConnectionBar();
  attachCoursesPageControls();
  restoreView();
}

function attachCoursesPageControls(){
  const searchEl=document.getElementById("cpSearch");
  const subjEl=document.getElementById("cpSubject");

  if(searchEl){
    let t;
    searchEl.addEventListener("input", e=>{
      ST.backendSearch=e.target.value;
      clearTimeout(t);
      t=setTimeout(()=>{ ST.backendPage=1; loadBackendCourses(); }, 350);
    });
  }
  if(subjEl) subjEl.addEventListener("change", e=>{
    ST.backendSubject=e.target.value; ST.backendPage=1; loadBackendCourses();
  });
  document.getElementById("cpClearSelector")?.addEventListener("click", clearCatalogSelectorBrowser);

  document.getElementById("cpPrev")?.addEventListener("click", ()=>{ ST.backendPage--; loadBackendCourses(); });
  document.getElementById("cpNext")?.addEventListener("click", ()=>{ ST.backendPage++; loadBackendCourses(); });

  document.querySelectorAll("[data-toggle]").forEach(el=>el.addEventListener("click", e=>{
    if(e.target.closest(".cr-wish")) return;
    toggleCourseExpand(el.dataset.toggle);
  }));
  document.querySelectorAll("[data-wadd]").forEach(b=>b.addEventListener("click", e=>{
    e.stopPropagation();
    const code=b.dataset.wadd;
    const saved=wishlistRecords().find(item=>item.code===code);
    if(saved) delete ST.wishlist[saved.key];
    else addToWishlist(code);
    savePlannerState();
    const action=globalThis.ScheduleRUPlannerUI.catalogWishlistAction({inWishlist:!saved});
    b.textContent=action.label;
    b.classList.toggle("selected",action.remove);
    b.setAttribute("aria-pressed",String(action.remove));
  }));
}

// Auto-connect on load if a backend URL was already saved from a previous visit.
if(ST.backendUrl){ loadBackendMeta(); loadBackendCourses(); }

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

/* ============================================================
   SCHEDULE BUILDER — "+" on a semester opens this. Drag courses in
   from the Required/Wishlist panel (still visible to the right),
   check/uncheck sections per course, browse conflict-free
   permutations, then confirm one to lock it into that semester.
   ============================================================ */
// Building-code → campus lookup for New Brunswick, keyed off the prefix
// before the room number (e.g. "SC 135" -> "SC", "ABW-2160" -> "ABW").
// Compiled from Rutgers' Digital Classroom Services classroom finder
// (dcs.rutgers.edu) — it covers the common lecture/classroom buildings but
// isn't exhaustive. Anything not listed here falls back to OTHER/UNKNOWN
// rather than breaking, and can be extended freely.
const BUILDING_CAMPUS = {
  // College Avenue
  SC:"COLLEGE AVENUE", ABE:"COLLEGE AVENUE", ABW:"COLLEGE AVENUE", AB:"COLLEGE AVENUE",
  MU:"COLLEGE AVENUE", VH:"COLLEGE AVENUE", HH:"COLLEGE AVENUE", BH:"COLLEGE AVENUE",
  CA:"COLLEGE AVENUE", CI:"COLLEGE AVENUE", ED:"COLLEGE AVENUE", FH:"COLLEGE AVENUE",
  MI:"COLLEGE AVENUE", ZIM:"COLLEGE AVENUE", RUL:"COLLEGE AVENUE", VD:"COLLEGE AVENUE",
  // Busch
  ARC:"BUSCH", BME:"BUSCH", BST:"BUSCH", CCB:"BUSCH", COR:"BUSCH", EN:"BUSCH",
  FBO:"BUSCH", HLL:"BUSCH", PH:"BUSCH", PHY:"BUSCH", SEC:"BUSCH", WL:"BUSCH", SERC:"BUSCH", LSB:"BUSCH", RWH:"BUSCH",
  // Cook/Douglass
  ARH:"COOK/DOUGLASS", BIO:"COOK/DOUGLASS", BL:"COOK/DOUGLASS", BT:"COOK/DOUGLASS",
  CDL:"COOK/DOUGLASS", DAV:"COOK/DOUGLASS", FSW:"COOK/DOUGLASS", HCK:"COOK/DOUGLASS", RAB:"COOK/DOUGLASS",
  LOR:"COOK/DOUGLASS", FOR:"COOK/DOUGLASS", IFNH:"COOK/DOUGLASS", FNH:"COOK/DOUGLASS",
  HSB:"COOK/DOUGLASS", KLG:"COOK/DOUGLASS", TH:"COOK/DOUGLASS", WAL:"COOK/DOUGLASS",
  // Livingston
  BE:"LIVINGSTON", TIL:"LIVINGSTON", LSH:"LIVINGSTON", GVLL:"LIVINGSTON", BRR:"LIVINGSTON",
  // Downtown New Brunswick
  HC:"DOWNTOWN", HELD:"DOWNTOWN",
};
// Fill/border colors for each campus bucket, used for both the calendar
// legend and the calendar blocks themselves.
const CAMPUS_COLORS = {
  "ONLINE":          {fill:"#f6b8b8", border:"#c0392b"},
  "BUSCH":           {fill:"#aecdf2", border:"#3f6fb0"},
  "COLLEGE AVENUE":  {fill:"#bce3b3", border:"#4f9a44"},
  "COOK/DOUGLASS":   {fill:"#a9e0d4", border:"#2f8f77"},
  "LIVINGSTON":      {fill:"#ffcc99", border:"#d4791e"},
  "DOWNTOWN":        {fill:"#e6b3e0", border:"#9c3f96"},
  "CAMDEN":          {fill:"#cdbdf2", border:"#6f4fae"},
  "NEWARK":          {fill:"#c9c9c9", border:"#6b6b6b"},
  "OTHER/UNKNOWN":   {fill:"#e9e7e1", border:"#9b968c"},
};
// Determine which campus bucket a meeting's location belongs to.
function campusFor(m){
  if(!m) return "OTHER/UNKNOWN";
  if(/ONLINE/i.test(m.mode||"") || /ONLINE/i.test(m.meeting_mode||"")) return "ONLINE";
  const b = String(m.building||"").trim();
  if(!b) return "OTHER/UNKNOWN"; // do not label a missing location as online without an explicit mode
  const prefix = b.split(/[\s-]/)[0].toUpperCase();
  return BUILDING_CAMPUS[prefix] || "OTHER/UNKNOWN";
}
// The calendar legend shown above the schedule builder's calendar — one
// swatch per campus bucket, plus a dashed outline meaning "closed section".
function renderCampusLegend(){
  const swatches = Object.entries(CAMPUS_COLORS).map(([name,c])=>
    `<span class="cal-legend-item"><i style="background:${c.fill};border-color:${c.border};"></i>${escapeHtml(name)}</span>`
  ).join("");
  return `<div class="cal-legend">${swatches}<span class="cal-legend-item"><i class="dashed" style="border-color:#c0392b;"></i>CLOSED SECTION</span></div>`;
}
function dayIndex(d){
  const M={M:0,MON:0,MONDAY:0,T:1,TU:1,TUE:1,TUESDAY:1,W:2,WED:2,WEDNESDAY:2,
    H:3,TH:3,THU:3,THURSDAY:3,F:4,FRI:4,FRIDAY:4,S:5,SA:5,SAT:5,SATURDAY:5,
    U:6,SU:6,SUN:6,SUNDAY:6};
  return M[String(d||"").toUpperCase().trim()];
}
function parseRutgersClock(value){
  const match=String(value||"").trim().match(/^(\d{1,2})(?::?(\d{2}))?\s*([AP]M)?$/i);
  if(!match) return null;
  let hour=Number(match[1]), minute=Number(match[2]||0);
  if(!Number.isInteger(hour)||!Number.isInteger(minute)||hour<1||hour>12||minute>59) return null;
  const suffix=(match[3]||"").toUpperCase();
  if(suffix){
    if(suffix==="PM" && hour!==12) hour+=12;
    if(suffix==="AM" && hour===12) hour=0;
    return {minutes:hour*60+minute, explicit:true};
  }
  // The Rutgers section feed uses a compact 12-hour clock without AM/PM:
  // 0830 is 8:30am, 0200 is 2:00pm, and 0745 is 7:45pm.
  return {hour,minute,explicit:false};
}
function compactRutgersMinutes(clock){
  if(clock.explicit) return clock.minutes;
  if(clock.hour===12) return 12*60+clock.minute;
  return (clock.hour>=8 ? clock.hour : clock.hour+12)*60+clock.minute;
}
function meetingTimeRange(meeting){
  const startClock=parseRutgersClock(meeting?.start_time), endClock=parseRutgersClock(meeting?.end_time);
  if(!startClock||!endClock) return null;
  const start=compactRutgersMinutes(startClock);
  let end=compactRutgersMinutes(endClock);
  // A 7:45-8:40 evening meeting arrives as 0745-0840. The end has to move
  // into the same afternoon/evening period when the raw clock wraps.
  if(!endClock.explicit && end<=start) end+=12*60;
  return end>start ? {start,end} : null;
}
function formatClock(minutes){
  const normalized=((minutes%(24*60))+(24*60))%(24*60);
  const hour=Math.floor(normalized/60), minute=normalized%60;
  const displayHour=(hour%12)||12;
  return `${displayHour}:${String(minute).padStart(2,"0")} ${hour>=12?"PM":"AM"}`;
}
function timeToSlot(t){
  const clock=parseRutgersClock(t);
  return clock ? (compactRutgersMinutes(clock)-8*60)/30 : null;
}
function meetingsConflict(mA,mB){
  const dA=dayIndex(mA.day_of_week), dB=dayIndex(mB.day_of_week);
  if(dA==null||dB==null||dA!==dB) return false;
  const a=meetingTimeRange(mA), b=meetingTimeRange(mB);
  if(!a||!b) return false;
  return a.start<b.end && b.start<a.end;
}
function comboConflicts(combo, sec){
  for(const c of combo) for(const m1 of c.meetings||[]) for(const m2 of sec.meetings||[])
    if(meetingsConflict(m1,m2)) return true;
  return false;
}
// Cross-product of one checked section per REQUIRED course, skipping any
// combo with a time conflict. Every enabled course in the pool must end up
// represented — courses are never silently dropped from consideration just
// because nothing's checked yet. If any required course can't contribute a
// section (still loading, errored, no sections offered, or nothing checked),
// generation stops and reports that course as a "blocker" instead of
// quietly returning partial schedules. Capped so a heavily-checked pool
// can't blow up runtime.
function buildPermutations(pool){
  const required = pool.filter(p=>p.enabled!==false);
  if(!required.length) return {combos:[], blockers:[], required};

  const blockers = required.filter(p=>
    p.loading ||
    (p.error && !(p.sections||[]).length) ||
    !(p.sections||[]).length ||
    !p.checked || p.checked.size===0
  );
  if(blockers.length) return {combos:[], blockers, required};

  let combos=[[]];
  for(const course of required){
    const opts=(course.sections||[]).filter(s=>course.checked.has(s.index_number));
    const next=[];
    for(const combo of combos){
      for(const sec of opts){
        if(!comboConflicts(combo, sec)){
          next.push([...combo, {code:course.code, title:course.title, credits:course.credits, ...sec}]);
        }
      }
    }
    combos = next;
    if(!combos.length) break; // no point continuing the cross-product once it's dead
  }
  return {combos: combos.length>500 ? combos.slice(0,500) : combos, blockers:[], required};
}

function recomputeBuilderPermutations(){
  if(!ST.builder) return;
  const result = buildPermutations(ST.builder.pool);
  ST.builder.permutations = result.combos;
  ST.builder.blockers = result.blockers;
  ST.builder.requiredCount = result.required.length;
  ST.builder.permIndex = 0;
}

function openBuilder(sem){
  const currentTerm=currentPlannerTerm();
  if(!globalThis.ScheduleRUPlannerUI.canOpenSemesterBuilder({
    displayedYear:ST.year,
    activeYear:currentTerm.year,
    semester:sem,
    activeSemester:currentTerm.semester,
  }))return;
  ST.builder = { year:ST.year, sem, pool:[], permutations:[], blockers:[], requiredCount:0, permIndex:0 };
  renderMain();
  // Pull in anything already dropped into this semester's column so the
  // builder starts in sync with the 4-Year Plan instead of empty.
  Object.values(ST.schedule)
    .filter(e=>e.year===ST.builder.year && e.sem===sem)
    .forEach(seedBuilderPoolFromSchedule);
}
function closeBuilder(){
  ST.builder = null;
  renderAll();
}

// Fetches title/credits (if missing) and sections for a pool entry, then
// sets its default checked sections. Shared by addToBuilderPool (adding a
// course fresh from the panel) and seedBuilderPoolFromSchedule (pulling in
// a course already dropped into this semester on the 4-Year Plan). If
// preselectIndex is given and still offered, only that section starts
// checked (it's the one already locked in); otherwise all open sections do.
async function hydratePoolEntry(entry, preselectIndex){
  const parts=entry.code.split(":");
  const backendId=`${parts[0]}:${parts[1]}:${parts[2]}:${activeBackendYear()}:${activeBackendTerm()}`;
  try{
    if(!entry.title||entry.credits===undefined){
      const meta = await backendFetch(`/api/courses/${encodeURIComponent(backendId)}`);
      entry.title = entry.title || meta.course?.title || entry.code;
      entry.credits = entry.credits ?? meta.course?.credits ?? "";
    }
    const d = await backendFetch(`/api/courses/${encodeURIComponent(backendId)}/sections`);
    entry.sections = d.sections||[];
    if(preselectIndex!=null && entry.sections.some(s=>s.index_number===preselectIndex)){
      entry.checked = new Set([preselectIndex]);
    } else {
      entry.checked = new Set(entry.sections.filter(s=>s.open_status===true||s.open_status===1||s.open_status==="1").map(s=>s.index_number));
    }
    if(!entry.sections.length) entry.error = "No sections found for this course/term in the backend.";
  }catch(err){
    entry.error = err.message;
  }
  entry.loading=false;
}

async function addToBuilderPool(cid){
  if(!ST.builder || !cid) return;
  const record=courseRecordFromId(cid);
  if(!record) return;
  const {code,title,fullTitle,credits}=record;
  if(ST.builder.pool.some(p=>p.code===code)) return;
  if(lockedElsewhere(code, ST.builder.year, ST.builder.sem)){
    const e=ST.schedule[code];
    modalController.show({title:"Course already locked",body:`<p>${escapeHtml(code)} is already scheduled for ${escapeHtml(academicYearLabel(e.year))} ${escapeHtml(e.sem)}. Remove it there first.</p>`,actions:[{label:"Close",secondary:true}]});
    return;
  }
  const entry={code, title, fullTitle:fullTitle||title, credits, course:record, sections:[], checked:new Set(), loading:true, enabled:true, collapsed:false};
  ST.builder.pool.push(entry);
  renderBuilder();
  await hydratePoolEntry(entry);
  recomputeBuilderPermutations();
  renderBuilder();
}
// A course dropped straight into this semester's column on the 4-Year Plan
// (drag-and-drop, no section chosen yet) should show up here automatically
// instead of leaving the builder empty and out of sync with the plan.
async function seedBuilderPoolFromSchedule(e){
  if(!ST.builder || ST.builder.pool.some(p=>p.code===e.code)) return;
  const entry={code:e.code, title:e.title, fullTitle:e.fullTitle||e.title, credits:e.credits, course:e.course, sections:[], checked:new Set(), loading:true, enabled:true, collapsed:false};
  ST.builder.pool.push(entry);
  renderBuilder();
  // If this course was already locked with a specific section (e.g. set via
  // the builder previously, or synced back from a saved schedule), keep
  // that exact section pre-selected rather than defaulting to "all open".
  await hydratePoolEntry(entry, e.locked ? e.index_number : null);
  recomputeBuilderPermutations();
  renderBuilder();
}
function removeFromBuilderPool(code){
  if(!ST.builder) return;
  ST.builder.pool = ST.builder.pool.filter(p=>p.code!==code);
  recomputeBuilderPermutations();
  renderBuilder();
}
function toggleBuilderSection(code, indexNum){
  if(!ST.builder) return;
  const p = ST.builder.pool.find(p=>p.code===code);
  if(!p) return;
  if(p.checked.has(indexNum)) p.checked.delete(indexNum); else p.checked.add(indexNum);
  recomputeBuilderPermutations();
  renderBuilder();
}
// Collapsing a course's section list is pure UI state — it doesn't change
// which schedules are possible, so no need to recompute permutations.
function toggleBuilderCourseCollapse(code){
  if(!ST.builder) return;
  const p = ST.builder.pool.find(p=>p.code===code);
  if(!p) return;
  p.collapsed = !p.collapsed;
  renderBuilder();
}
// Unchecking a course removes it from consideration when building
// schedules (without losing its section list / selections), letting
// someone temporarily exclude a class rather than delete it from the pool.
function toggleBuilderCourseEnabled(code){
  if(!ST.builder) return;
  const p = ST.builder.pool.find(p=>p.code===code);
  if(!p) return;
  p.enabled = p.enabled===false ? true : false;
  recomputeBuilderPermutations();
  renderBuilder();
}
function confirmBuilderSchedule(){
  if(!ST.builder) return;
  const combo = ST.builder.permutations[ST.builder.permIndex];
  if(!combo || !combo.length){ modalController.show({title:"No schedule to use",body:"<p>Check at least one section for every required course before using a conflict-free schedule.</p>",actions:[{label:"Close",secondary:true}]}); return; }
  const {year, sem} = ST.builder;
  combo.forEach(c=>{
    ST.schedule[c.code] = {
      year, sem, code:c.code, title:c.title, fullTitle:c.fullTitle||c.title, credits:c.credits,
      course:c.course||courseRecordFromId(c.code),
      sectionId:c.id, index_number:c.index_number, section_number:c.section_number,
      meetings:c.meetings||[], locked:true, userPinned:true,
    };
  });
  ST.builder = null;
  renderAll();
}

function poolCourseHtml(p){
  const enabled = p.enabled !== false;
  const collapsed = !!p.collapsed;
  let body;
  if(p.loading) body=`<div class="loading">Loading sections…</div>`;
  else if(p.error && !(p.sections||[]).length) body=`<div class="api-status err">${escapeHtml(p.error)}</div>`;
  else if(!(p.sections||[]).length) body=`<div class="api-status">No sections available.</div>`;
  else body=globalThis.ScheduleRUCourseInteractionLogic.sortSections(p.sections||[]).map(s=>{
    const open=s.open_status===true||s.open_status===1||s.open_status==="1";
    const checked=p.checked && p.checked.has(s.index_number);
    const meet=(s.meetings||[]).map(fmtMeeting).join(", ")||"—";
    const instructor = escapeHtml(s.instructor||"Staff / TBA");
    return `<label class="pool-sec-row">
      <input type="checkbox" data-poolsec="${escapeHtml(p.code)}|${escapeHtml(s.index_number)}" ${checked?"checked":""}/>
      <span style="width:36px;flex-shrink:0;">${escapeHtml(s.section_number||s.index_number||"")}</span>
      <span class="pool-sec-meet">${escapeHtml(meet)}</span>
      <span class="pool-sec-instr" title="${instructor}">${instructor}</span>
      <span class="pool-sec-status ${open?'status-open':'status-closed'}">${open?"OPEN":"CLOSED"}</span>
    </label>`;
  }).join("");
  return `<div class="pool-course ${enabled?"":"pool-course-disabled"}">
    <div class="pool-course-hdr">
      <span class="pool-collapse" data-poolcollapse="${escapeHtml(p.code)}" title="${collapsed?"Show":"Hide"} sections">${collapsed?"▸":"▾"}</span>
      <input type="checkbox" class="pool-enable" data-poolenable="${escapeHtml(p.code)}" ${enabled?"checked":""}
        title="${enabled?"Required for schedules — uncheck to exclude":"Excluded from schedules — check to require"}"/>
      <b>${escapeHtml(p.code)}</b> ${escapeHtml(p.title||"")} <span style="color:var(--muted);font-family:var(--fmono);font-size:10px;">${p.credits!==undefined&&p.credits!==""?p.credits+"cr":""}</span>
      <button class="rx" data-poolrm="${escapeHtml(p.code)}">✕</button>
    </div>
    ${collapsed?"":`<div class="pool-sections">${body}</div>`}
  </div>`;
}

function renderBuilderCalendar(){
  const combo = (ST.builder.permutations||[])[ST.builder.permIndex] || [];
  // Match the familiar Rutgers WebReg work-week view. Weekend and untimed
  // meetings remain visible below instead of being silently dropped.
  const DAYS=["Mon","Tue","Wed","Thu","Fri"];
  const pixelsPerMinute=.8,dayStartMinute=8*60,dayEndMinute=22*60;
  let dayCells=DAYS.map((d,i)=>`<div class="cal-daylabel" style="left:${i*20}%;width:20%;">${d}</div>`).join("");
  let timeLabels="";
  for(let h=8; h<=22; h++){
    const label = h===12?"12pm":h>12?`${h-12}pm`:`${h}am`;
    const top=28+(h*60-dayStartMinute)*pixelsPerMinute;
    timeLabels += `<div class="cal-timelabel" style="top:${top}px;">${label}</div>`;
  }
  const outside=[];
  combo.forEach(c=>{
    (c.meetings||[]).forEach(m=>{
      const day=dayIndex(m.day_of_week);
      if(day==null || day>4){
        outside.push(`${c.code} · ${fmtMeeting(m)}`);
        return;
      }
      const range=meetingTimeRange(m);
      const geometry=range&&range.start>=dayStartMinute&&range.end<=dayEndMinute
        ? globalThis.ScheduleRUCourseInteractionLogic.calendarBlockGeometry({
          startMinute:range.start,endMinute:range.end,dayStartMinute,pixelsPerMinute,
        })
        : null;
      if(!geometry){
        outside.push(`${c.code} · ${fmtMeeting(m)}`);
        return;
      }
      const campus = campusFor(m);
      const col = CAMPUS_COLORS[campus] || CAMPUS_COLORS["OTHER/UNKNOWN"];
      const closed = c.open_status===false || c.open_status===0;
      const loc = [m.building,m.room].filter(Boolean).join(" ") || (campus==="ONLINE"?"Online":"");
      const time=`${formatClock(range.start)} – ${formatClock(range.end)}`;
      dayCells += `<div class="cal-block${closed?" cal-block-closed":""}" style="left:calc(${day*20}% + 2px);width:calc(20% - 4px);top:${geometry.top}px;height:${geometry.height}px;
        background:${col.fill};border-color:${col.border};">
        <b>${escapeHtml(c.code)}</b><span class="cal-course-title">${escapeHtml(c.title||c.code)}</span>
        <span class="cal-detail">${escapeHtml(time)}</span><span class="cal-detail">${escapeHtml(loc)}</span></div>`;
    });
  });
  return `<div class="calendar-scroll"><div class="builder-cal minute-scale">${timeLabels}<div class="cal-days">${dayCells}</div></div></div>
    ${outside.length?`<div class="cal-outside"><b>Weekend, online, or untimed meetings</b><br/>${escapeHtml(outside.join(" · "))}</div>`:""}`;
}

function renderBuilder(){
  const root = document.getElementById("builderRoot");
  if(!ST.builder) return;
  const b = ST.builder;
  const semLabel = b.sem==="fall"?"Fall":"Spring";
  const hasCourses = b.pool.length>0;
  const requiredCount = b.requiredCount||0;
  const blockers = b.blockers||[];
  const n = (b.permutations||[]).length;

  // The calendar/legend/nav block sits ABOVE the course+section list, so the
  // schedule itself is the first thing visible once courses are added.
  let resultsHtml = "";
  if(hasCourses){
    if(requiredCount===0){
      resultsHtml = `<div class="no-sched">Every course below is excluded (unchecked) — check at least one to build a schedule around it.</div>`;
    } else if(blockers.length){
      const names = blockers.map(p=>{
        if(p.loading) return `${p.code} (loading…)`;
        if(p.error && !(p.sections||[]).length) return `${p.code} (couldn't load sections)`;
        if(!(p.sections||[]).length) return `${p.code} (no sections offered this term)`;
        return `${p.code} (no section checked)`;
      }).join(", ");
      resultsHtml = `<div class="no-sched">No schedules available — every required course needs at least one section checked before a schedule can be built.<br/>Needs attention: ${escapeHtml(names)}</div>`;
    } else if(!n){
      resultsHtml = `<div class="no-sched">No schedules available — there's no way to fit every required, checked course into one schedule without a time conflict.<br/>Try checking additional sections, or temporarily uncheck a course above.</div>`;
    } else {
      resultsHtml = `
        ${renderCampusLegend()}
        <div class="builder-nav">
          <button id="permPrev" ${b.permIndex<=0?"disabled":""}>← Prev</button>
          <label>Schedule <input id="permIndex" class="builder-nav-index" type="number" min="1" max="${n}" value="${b.permIndex+1}" aria-label="Schedule number"/> of ${n}</label>
          <button id="permNext" ${b.permIndex>=n-1?"disabled":""}>Next →</button>
        </div>
        <div class="inline-error" id="permIndexError" aria-live="polite"></div>
        ${renderBuilderCalendar()}
        <button class="builder-confirm" id="permConfirm">Use this schedule for ${semLabel} ${academicYearLabel(b.year)}</button>
      `;
    }
  }

  root.innerHTML = `
    <div class="builder-hdr">
      <h2>Build Schedule — ${semLabel} · ${academicYearLabel(b.year)}</h2>
      <button class="builder-back" id="builderBack">← Back to 4-Year Plan</button>
    </div>
    <div class="drop-pool" id="poolDrop">Drag courses here from the Required / Wishlist panel →</div>
    ${resultsHtml}
    <div id="poolList">${b.pool.map(poolCourseHtml).join("")}</div>
  `;

  document.getElementById("builderBack").addEventListener("click", closeBuilder);
  const drop = document.getElementById("poolDrop");
  drop.ondragover = e=>{ e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = ()=> drop.classList.remove("over");
  drop.ondrop = e=>{
    e.preventDefault(); drop.classList.remove("over");
    const cid = e.dataTransfer.getData("cid");
    if(cid) addToBuilderPool(cid);
  };
  root.querySelectorAll("[data-poolrm]").forEach(el=>el.addEventListener("click",()=>removeFromBuilderPool(el.dataset.poolrm)));
  root.querySelectorAll("[data-poolsec]").forEach(el=>el.addEventListener("change",()=>{
    const [code, idx] = el.dataset.poolsec.split("|");
    toggleBuilderSection(code, idx);
  }));
  root.querySelectorAll("[data-poolcollapse]").forEach(el=>el.addEventListener("click",()=>toggleBuilderCourseCollapse(el.dataset.poolcollapse)));
  root.querySelectorAll("[data-poolenable]").forEach(el=>el.addEventListener("change",()=>toggleBuilderCourseEnabled(el.dataset.poolenable)));
  document.getElementById("permPrev")?.addEventListener("click", ()=>{ b.permIndex=Math.max(0,b.permIndex-1); renderBuilder(); });
  document.getElementById("permNext")?.addEventListener("click", ()=>{ b.permIndex=Math.min(n-1,b.permIndex+1); renderBuilder(); });
  document.getElementById("permIndex")?.addEventListener("keydown",event=>{
    if(event.key==="Escape"){event.preventDefault();event.currentTarget.value=String(b.permIndex+1);event.currentTarget.blur();return;}
    if(event.key!=="Enter")return;event.preventDefault();const requested=Number(event.currentTarget.value),error=document.getElementById("permIndexError");
    if(!Number.isInteger(requested)||requested<1||requested>n){error.textContent=`Enter a schedule number from 1 to ${n}.`;return;}
    b.permIndex=requested-1;renderBuilder();
  });
  document.getElementById("permConfirm")?.addEventListener("click", confirmBuilderSchedule);
}

document.querySelectorAll(".sem-plus").forEach(btn=>btn.addEventListener("click", e=>{
  e.stopPropagation();
  openBuilder(btn.dataset.semplus);
}));

// Initial load
renderAll();
loadInitialRequirements();
