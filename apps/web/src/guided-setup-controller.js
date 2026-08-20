/* The release shell keeps the legacy planner interactive while adding the reviewed, local-first flows. */
const modalController=(()=>{
  const root=document.getElementById("appModal"),card=root.querySelector("[role=dialog]"); let restore=null,dismissible=true;
  function close(){ if(!root.classList.contains("open")) return; root.classList.remove("open"); root.setAttribute("aria-hidden","true"); restore?.focus?.(); }
  function show({title,body,actions=[],canDismiss=true}){ restore=document.activeElement; dismissible=canDismiss; document.getElementById("appModalTitle").textContent=title; document.getElementById("appModalBody").innerHTML=body; const actionsRoot=document.getElementById("appModalActions"); actionsRoot.innerHTML=""; actions.forEach(action=>{const button=document.createElement("button");button.className=`choice-btn ${action.secondary?"secondary":""} ${action.className||""}`;button.textContent=action.label;button.disabled=action.disabled===true;button.addEventListener("click",()=>{if(action.close!==false) close(); action.onClick?.();});actionsRoot.append(button);}); root.classList.add("open");root.setAttribute("aria-hidden","false");(actionsRoot.querySelector("button:not(:disabled)")||card).focus(); }
  root.addEventListener("click",event=>{if(event.target===root&&dismissible)close();}); document.addEventListener("keydown",event=>{if(event.key==="Escape"&&root.classList.contains("open")&&dismissible){event.preventDefault();close();}}); return {show,close};
})();

const requirementPickerDialogController=ScheduleRURequirementPickerController.create({
  getState:()=>ST,document,requestAnimationFrame,setTimeout,clearTimeout,pageSize:PAGE_SIZE,
  getGroup:id=>GROUPS[id]||null,getCourse:id=>COURSES[id]||null,
  selectorsForGroup:reviewedGroupSelectors,groupDisplayName,groupRuleLabel,isConstraintGroup,
  selectedCourseIds:selectedRequirementCourses,appliedCourseIds:groupAppliedCourseIds,selectionLimit,
  registerSelectorCourseRecord,
  loadSelectorCourses:async({search,limit,offset,selectors})=>{
    const params=new URLSearchParams({search,limit:String(limit),offset:String(offset),selector:JSON.stringify(selectors)});
    const response=await backendFetch("/api/courses?"+params.toString());
    return {records:(response.courses||[]).map(backendCourseRecord).filter(Boolean),total:response.total};
  },
  courseRecordFromId,plannerUI:ScheduleRUPlannerUI,escapeHtml:html,courseCreditsLabel,
  userMessageModel:ScheduleRUUserMessageModel,
  constraintViolation:parentSelectionConstraintViolation,
  showSelectionReview:message=>modalController.show({title:"Selection needs review",body:`<p>${html(message)}</p>`,actions:[{label:"Close",secondary:true}]}),
  commitSelection:(groupId,selectedIds,record)=>{
    ST.groupSelections[groupId]=selectedIds;
    if(record?.code)addToWishlist(record.code,record);else savePlannerState();
  },
  toggleWishlist:record=>{
    if(ST.wishlist[record.code]){delete ST.wishlist[record.code];savePlannerState();}
    else addToWishlist(record.code,record);
  },
  renderAll,openCourseDetails,
});
installRequirementPickerController(requirementPickerDialogController);
requirementPickerDialogController.bind();

const courseDetailsDialogController=ScheduleRUCourseDetailsController.create({
  getState:()=>ST,document,requestAnimationFrame,
  getCourse:courseRecordFromId,getCourseByCode:courseByCode,
  loadEligibilityForCodes:loadCourseEligibilityForCodes,
  requirementCourseId,prerequisiteEligibilityForTerm,prerequisiteBlockerLabel,
  standingRequirement,courseEligibilityNotice,academicYearLabel,
  plannerUI:ScheduleRUPlannerUI,escapeHtml:html,cleanText:cleanApiText,courseCreditsLabel,
  resumeRequirementPicker:()=>requirementPickerDialogController.resume(),
  professorLinkModel:ScheduleRUProfessorLinkModel,
});
installCourseDetailsController(courseDetailsDialogController);
courseDetailsDialogController.bind();

const catalogPageLifecycleController=ScheduleRUCatalogPageController.create({
  getState:()=>ST,document,requestAnimationFrame,setTimeout,clearTimeout,pageSize:PAGE_SIZE,
  request:backendFetch,saveBackendUrl,selectorContext:activeCatalogSelectorContext,
  loadEligibilityForCodes:loadCourseEligibilityForCodes,catalogCourseCode,backendCourseRecord,
  wishlistRecords,addToWishlist,saveState:savePlannerState,
  activeRequirementChoice:()=>ST.activeRequirementChoice,
  useForRequirement:useCatalogCourseForRequirement,
  plannerUI:ScheduleRUPlannerUI,selectorLogic:ScheduleRUCourseSelectorLogic,
  filterModel:ScheduleRUCatalogFilterModel,
  userMessageModel:ScheduleRUUserMessageModel,
  interactionLogic:ScheduleRUCourseInteractionLogic,
  escapeHtml:html,cleanText:cleanApiText,courseCreditsLabel,formatMeeting:fmtMeeting,groupDisplayName,
});
installCatalogPageController(catalogPageLifecycleController);
catalogPageLifecycleController.initialize();

const scheduleBuilderPresentation=ScheduleRUScheduleBuilderView.create({
  getBuilder:()=>ST.builder,document,escapeHtml:html,formatMeeting:fmtMeeting,
  dayIndex,meetingTimeRange,formatClock,academicYearLabel,
  sortSections:ScheduleRUCourseInteractionLogic.sortSections,
  calendarBlockGeometry:ScheduleRUCourseInteractionLogic.calendarBlockGeometry,
  professorLinkModel:ScheduleRUProfessorLinkModel,
  handlers:{
    close:closeBuilder,openAssistant:openScheduleAssistant,
    setIncludeClosed:setBuilderIncludeClosed,add:addToBuilderPool,remove:removeFromBuilderPool,
    toggleSection:toggleBuilderSection,toggleCollapse:toggleBuilderCourseCollapse,
    toggleEnabled:toggleBuilderCourseEnabled,confirm:confirmBuilderSchedule,
  },
});
installScheduleBuilderView(scheduleBuilderPresentation);

const scheduleBuilderLifecycleController=ScheduleRUScheduleBuilderController.create({
  getState:()=>ST,currentPlannerTerm,
  canOpenBuilder:ScheduleRUPlannerUI.canOpenSemesterBuilder,
  buildPermutations,renderMain,renderAll,
  showModal:options=>modalController.show(options),courseRecordFromId,lockedElsewhere,
  request:backendFetch,activeBackendYear,activeBackendTerm,academicYearLabel,escapeHtml:html,
  userMessageModel:ScheduleRUUserMessageModel,
  openAssistant:()=>{document.getElementById("assistantDrawer").classList.add("open");renderAssistant();},
});
installScheduleBuilderController(scheduleBuilderLifecycleController);

function openRestartSetupConfirmation(){
  modalController.show({
    title:"Restart everything?",
    body:"<p>This permanently clears your programs, completed coursework, AP selections, wishlist, semester plan, preferences, and setup progress from this browser.</p>",
    actions:[
      {label:"Cancel",secondary:true},
      {label:"Restart everything",onClick:()=>{clearPlannerState();location.reload();}},
    ],
  });
}

function openHomeSchoolPicker(){const schools=ST.availableSchools||[];modalController.show({title:"Change home school",body:`<label class="program-school-field">Home school<select id="homeSchoolChoice">${schools.map(school=>`<option value="${html(school.slug)}" ${school.slug===ST.homeSchoolSlug?"selected":""}>${html(school.name||school.short_name||school.slug)}</option>`).join("")}</select></label><p class="program-school-help">Changing schools re-evaluates programs and requirements. Your semester placements remain in this browser.</p>`,actions:[{label:"Cancel",secondary:true},{label:"Change school",onClick:()=>changeHomeSchool(document.getElementById("homeSchoolChoice").value)}]});}
document.getElementById("homeSchoolBtn").addEventListener("click",openHomeSchoolPicker);

function html(value){ return escapeHtml(String(value??"")); }
function parseJson(value){ try{return JSON.parse(value||"[]");}catch(_){return [];} }
function refreshApFulfillment(){
  Object.keys(AP_FULFILLS).forEach(key=>delete AP_FULFILLS[key]);
  AP.forEach(ap=>(ap.fulfills||[]).forEach(id=>{(AP_FULFILLS[id]||=[]).push(ap.id);}));
}
function rerenderOnboardingApStep(){if(!ST.onboarding?.completed&&ScheduleRUOnboardingFlowModel.stepAt(ST.onboarding?.step)==="ap")renderOnboarding();}
async function loadHackathonConfiguration(){
  try{const config=await backendFetch("/api/config");ST.activeYear=config.activeYear;ST.activeTerm=config.activeTerm;}catch(_){ST.activeYear=new Date().getFullYear();ST.activeTerm="9";}
  ensureAcademicCalendarAnchor();
  try{const data=await backendFetch("/api/ap-equivalencies");AP=(data.equivalencies||[]).map(row=>({id:row.id,name:row.exam_name,equiv:parseJson(row.equivalent_course_codes_json).join(", "),credits:Number(row.credits)||0,fulfills:parseJson(row.fulfills_requirement_ids_json),minimumScore:Number(row.minimum_score),maximumScore:Number(row.maximum_score)}));refreshApFulfillment();}catch(_){AP=[];}
  rerenderOnboardingApStep();updateProgramTitle();renderSchedule();
}

function academicRecords(){ return Array.isArray(ST.academicRecords)?ST.academicRecords:[]; }
function addAcademicRecord(record){ ST.academicRecords.push(ScheduleRUPlannerStateLogic.normalizeAcademicRecord(record)); savePlannerState(); }
function storedCompletedAcademicCodes(){const completed=Object.entries(ST.completed||{}).filter(([,taken])=>taken).flatMap(([id])=>[courseRecordFromId(id)?.code||id]);const ap=AP.filter(entry=>ST.apOn?.[entry.id]).flatMap(entry=>courseCodesFromText(entry.equiv));return [...new Set([...completed,...ap].filter(Boolean))];}
function completedAcademicCodes(){ return [...new Set([
  ...resolvedAcademicCourseCodes([...storedCompletedAcademicCodes(),...academicRecords().filter(record=>record.creditStatus==="applied").flatMap(record=>[record.courseCode,...(record.equivalentCourseCodes||[])])]),
  ...confirmedAcademicCourseCodes(),
])]; }
const academicCreditLifecycleController=ScheduleRUAcademicCreditController.create({
  baseConfirmedEntries:()=>academicProgressModel.confirmedCreditEntries(),
  additionalConfirmedEntries:()=>ScheduleRUPlannerStateLogic.academicCreditEntries(ST),
  baseIsCompleted,
  additionalCompletedCourseCodes:completedAcademicCodes,
  courseCodeForId:id=>COURSES[id]?.code||id,
  normalizeCourseId:requirementCourseId,
});
installAcademicCreditController(academicCreditLifecycleController);

function plannerIssueText(issue){
  return ScheduleRUUserMessageModel.presentIssue(issue).message;
}
function issueList(){
  const issues=[]; if(ST.requirementsError){const shown=ScheduleRUUserMessageModel.presentIssue(ST.requirementsError);issues.push({group:"Requirements",severity:"error",title:shown.title,text:shown.message,action:shown.primaryAction});}
  selectedProgramRows().filter(row=>row.requirements_available===false||row.coverage_status==="catalog_listed").forEach(row=>issues.push({group:"Requirements",severity:"warning",title:"Requirements are still under review",text:`${row.name} is available to select, but its full requirement list is not ready yet.`,action:"Review official requirements"}));
  (ST.programEligibilityRules||[]).filter(rule=>ST.selectedPrograms.includes(rule.program_id)).forEach(rule=>issues.push({group:"Advising and program policy",severity:"advising",title:"Confirm with advising",text:rule.advisory_message||rule.note||"Confirm this reviewed program policy with advising.",action:"Ask advising"}));
  const overlap=ST.doubleCount;if(overlap){(overlap.scopeResults||[]).filter(item=>item.violates||item.codes?.length).forEach(item=>issues.push({group:"Double-count policy",severity:item.violates?"warning":"info",title:item.violates?"Some courses cannot count twice":"Shared courses reviewed",text:item.violates?doubleCountMeaning(item):`${item.codes.length} potential shared course overlap${item.codes.length===1?"":"s"} reviewed.`,action:item.violates?"Review shared courses":"Close"}));(overlap.unscoped||[]).forEach(item=>issues.push({group:"Double-count policy",severity:"warning",title:"Double-counting needs review",text:`Confirm whether ${item.code||"this overlap"} may count toward both programs.`,action:"Ask advising"}));}
  const previewIssues=ST.generatedPlanPreview?.issues||[],eligibility=previewIssues.filter(issue=>issue.code==="eligibility_rule_unresolved"),otherPreviewIssues=previewIssues.filter(issue=>issue.code!=="eligibility_rule_unresolved");
  if(eligibility.length){const shown=ScheduleRUUserMessageModel.presentIssue(eligibility[0]);issues.push({group:"Plan preview",severity:"warning",title:shown.title,text:`Eligibility details need review for ${eligibility.map(issue=>issue.courseCode).filter(Boolean).join(", ")}.`,action:shown.primaryAction});}
  otherPreviewIssues.forEach(issue=>{const shown=ScheduleRUUserMessageModel.presentIssue(issue);issues.push({group:"Plan preview",severity:issue.severity||"warning",title:shown.title,text:shown.message,action:shown.primaryAction});});
  return issues;
}
function showIssues(){const issues=issueList(),groups=new Map();issues.forEach(issue=>{const key=issue.action||issue.group,entries=groups.get(key)||[];entries.push(issue);groups.set(key,entries);});const visible=[...groups.entries()].slice(0,3),hidden=Math.max(0,groups.size-visible.length);modalController.show({title:issues.length?"What needs your attention":"No issues right now",body:issues.length?visible.map(([action,entries])=>`<section><h3>${html(entries[0].title||entries[0].group)}</h3><p>${html(entries[0].text)}</p>${entries.length>1?`<div class="issue-count">${entries.length} related items</div>`:""}<div class="issue-action">Next: ${html(action)}</div></section>`).join("")+(hidden?`<p class="planner-issue">${hidden} more type${hidden===1?"":"s"} of issue can be reviewed after these.</p>`:""):"<p>Your plan has no active warnings.</p>",actions:[{label:"Close",secondary:true}]}); }
const requiredPanelPresentationController=ScheduleRURequiredPanelController.create({
  getState:()=>ST,document,selectedProgramRows,useRequirementTree,
  getRequirementState:()=>({groups:GROUPS,rootGroupIds:ROOT_GROUPS}),
  issueList,escapeHtml:html,groupHtml,groupDisplayName,groupAppliedCourseIds,
  selectorGuidanceHtml,cardHtml,attachCardEvents,
  shouldAutoCollapseSharedGroup:ScheduleRUPlannerUI.shouldAutoCollapseSharedGroup,
  groupFulfilled:id=>requirementProgressModel.groupFulfilled(id),
  expansionOpen:ScheduleRUCourseInteractionLogic.expansionOpen,
  openRequirementPicker,showIssues,renderPanel,
  userMessageModel:ScheduleRUUserMessageModel,
  programRequirementModel,
});
installRequiredPanelController(requiredPanelPresentationController);

const programApplyTransaction=ScheduleRUProgramApplyTransaction.create({
  getState:()=>ST,
  checkSelection:ids=>backendFetch("/api/program-selection-check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({home_school:ST.homeSchoolSlug,program_ids:ids})}),
  loadCandidate:loadSelectedRequirementCandidate,
  programDraftView:ScheduleRUProgramPickerLogic.programDraftView,
  applyRequirementTree:tree=>{if(ST.tab!=="core")useRequirementTree(tree);},
  saveState:savePlannerState,
  onPendingChange:pending=>{const button=document.getElementById("programApply");if(button){button.disabled=pending;button.textContent=pending?"Applying…":"Apply programs";}},
  onLoadingChange:()=>renderPanel(),
  onFeedback:showProgramPolicyFeedback,
  onWarnings:({warnings,proceed})=>modalController.show({title:"Review program warnings",body:`<ul class="policy-warning-list">${warnings.map(warning=>`<li>${html(warning.message||warning.note||"This program combination needs advising.")}</li>`).join("")}</ul>`,actions:[{label:"Go back",secondary:true},{label:"Apply anyway",onClick:proceed}]}),
  onCommitted:()=>{updateProgramTitle();renderOnboarding();closeProgramPicker();},
});
function applyProgramDraft(){return programApplyTransaction.execute({ids:ST.programDraft,primaryId:ST.programDraftPrimaryId});}
const programPickerController=ScheduleRUProgramPickerController.create({
  getState:()=>ST,document,requestAnimationFrame,
  pickerLogic:ScheduleRUProgramPickerLogic,plannerUI:ScheduleRUPlannerUI,
  escapeHtml:html,cleanText:cleanApiText,getProgramTypeSections:programTypeSections,
  programTypeLabel,programCoverageLabel,selectionLimitSummary,
  showFeedback:showProgramPolicyFeedback,onApply:applyProgramDraft,
});
function openProgramPicker(){return programPickerController.open();}
function closeProgramPicker(){return programPickerController.close();}
programPickerController.bind();

function plannerTerms(){return plannerTermsFromAcademicPosition();}
function unresolvedPlannerRequirements(){return normalizedPlannerInputs().unresolvedRequirements;}
function generateFourYearPlan(input=normalizedPlannerInputs()){ST.generatedPlanPreview=ScheduleRUFourYearPlanner.generatePlan(input);savePlannerState();showPlanPreview();}
function confirmClearPlan(){modalController.show({title:"Clear this plan?",body:"<p>This removes every semester placement and unresolved requirement placeholder. Your completed courses, programs, and wishlist will stay saved.</p>",actions:[{label:"Keep plan",secondary:true},{label:"Clear plan",onClick:()=>{ST.schedule={};ST.planPlaceholders=[];ST.generatedPlanPreview=null;savePlannerState();renderAll();}}]});}
document.getElementById("clearPlanBtn").addEventListener("click",confirmClearPlan);
function acceptGeneratedPlan(preview){const accepted=ScheduleRUPlannerStateLogic.withAcceptedPlan(ST,preview);Object.assign(ST,accepted);const firstPopulated=plannerTerms().find(term=>Object.values(ST.schedule).some(entry=>entry.year===term.year&&entry.sem===term.sem)||(ST.planPlaceholders||[]).some(placeholder=>placeholder.year===term.year&&placeholder.sem===term.sem));if(firstPopulated)ST.year=firstPopulated.year;savePlannerState();renderAll();}
function showPlanPreview(){const preview=ST.generatedPlanPreview;if(!preview)return;const rows=plannerTerms().map(term=>{const courses=Object.values(preview.schedule).filter(entry=>entry.year===term.year&&entry.sem===term.sem);const placeholders=(preview.placeholders||[]).filter(entry=>entry.year===term.year&&entry.sem===term.sem);const items=courses.map(entry=>`<div class="planner-item"><strong>${html(entry.code)}</strong> · ${html(entry.title||entry.code)} · ${html(entry.credits)} credits${entry.userPinned||entry.locked?" · pinned":""}</div>`).join("")+placeholders.map(entry=>`<div class="planner-item placeholder-item">To be selected: ${html(entry.label)} · ${html(entry.estimatedCredits)} estimated credits</div>`).join("");return `<section class="planner-term"><h3>${html(academicYearLabel(term.year))} · ${html(term.sem)}</h3>${items||"<div class=\"planner-item\">No placement</div>"}</section>`;}).join("");const result=globalThis.ScheduleRUPlannerUI.previewResult(preview),primaryCode={aggregate_capacity:"plan_capacity_exceeded",course_slot_capacity:"plan_course_slots_exceeded",sequencing_capacity:"plan_sequence_capacity_exceeded",indeterminate:"plan_feasibility_inconclusive"}[result.kind],blocking=(preview.issues||[]).filter(issue=>issue.severity==="error"&&issue.code!==primaryCode),warningCount=(preview.issues||[]).length-blocking.length-(primaryCode?1:0),canAccept=globalThis.ScheduleRUPlannerUI.canAcceptGeneratedPlan(preview),blockingGroups=ScheduleRUUserMessageModel.groupIssues(blocking,{limit:3});modalController.show({title:result.title,body:`<div class="planner-preview">${rows}${canAccept?"":`<div class="planner-issue planner-issue-error">${html(result.message)}</div>`}${blockingGroups.map(group=>`<div class="planner-issue planner-issue-error"><strong>${html(group.title)}</strong><span>${html(group.message)}</span></div>`).join("")}${warningCount?`<div class="planner-issue">${warningCount} other note${warningCount===1?"":"s"} can be reviewed under Issues.</div>`:""}</div>`,actions:canAccept?[{label:"Cancel",secondary:true},{label:"Use this plan",onClick:()=>acceptGeneratedPlan(preview)}]:[{label:"Close",secondary:true}]});}

function termPreferenceState(){const currentTerm=currentPlannerTerm(),key=ScheduleRUPlannerStateLogic.termKey({year:currentTerm.year,sem:currentTerm.semester});ST.schedulePreferences[key]||={version:1,constraints:[],messages:[]};return ST.schedulePreferences[key];}
function normalizeAssistantOpenStatus(open_status){if(open_status===true||open_status===1||open_status==="1")return true;if(open_status===false||open_status===0||open_status==="0")return false;return null;}
function normalizeAssistantMeeting(meeting,section){const day=["M","T","W","R","F","S","U"][dayIndex(meeting?.day_of_week)],range=meetingTimeRange(meeting);if(!day||!range)return null;return {day,start:range.start,end:range.end,courseCode:section?.code||"",courseTitle:section?.fullTitle||section?.title||"",campus:campusFor(meeting),modality:meeting?.mode||meeting?.meeting_mode||"",open:normalizeAssistantOpenStatus(section?.open_status)};}
globalThis.ScheduleRUUIContracts={normalizeAssistantOpenStatus,normalizeAssistantMeeting};
function builderScheduleFacts(){return (ST.builder?.permutations||[]).map((combo,index)=>({stableIndex:combo.stableIndex||index+1,meetings:combo.flatMap(section=>(section.meetings||[]).map(meeting=>normalizeAssistantMeeting(meeting,section)).filter(Boolean))}));}
function renderAssistant(){const state=termPreferenceState(),root=document.getElementById("assistantMessages");const messages=state.messages||[];root.innerHTML=(messages.length?messages:[{role:"assistant",content:"Tell me preferences like ‘no classes before 10’ or ‘keep Friday light.’ I only recommend verified schedule numbers."}]).map(message=>`<div class="assistant-message ${message.role==="user"?"user":""}">${html(message.content)}${message.recommendations?.length?`<div class="assistant-recs">${message.recommendations.slice(0,3).map(index=>`<button data-assistant-index="${index}">Try #${index}</button>`).join("")}</div>`:""}${message.quickReplies?.length?`<div class="assistant-recs">${message.quickReplies.map(reply=>`<button data-assistant-reply="${html(reply)}">${html(reply)}</button>`).join("")}</div>`:""}</div>`).join("");root.querySelectorAll("[data-assistant-index]").forEach(button=>button.addEventListener("click",()=>{const index=Number(button.dataset.assistantIndex);if(ST.builder){const found=ST.builder.permutations.findIndex(combo=>combo.stableIndex===index);if(found>=0){ST.builder.permIndex=found;renderBuilder();}}}));root.querySelectorAll("[data-assistant-reply]").forEach(button=>button.addEventListener("click",()=>{const input=document.getElementById("assistantInput"),reply=button.dataset.assistantReply;input.value=[input.value.trim(),reply].filter(Boolean).join(", ");input.focus();}));}
function assistantFailureMessage(error){const text=`${error?.code||""} ${error?.detail||""}`;if(/assistant_quota/.test(text))return "The schedule assistant has reached its API limit. Your verified schedules are still available.";if(/assistant_(?:authentication|configuration)/.test(text))return "The schedule assistant needs a configuration update. Your verified schedules are unaffected.";return "The schedule assistant is temporarily unavailable. You can keep browsing verified schedules.";}
async function sendAssistant(){const input=document.getElementById("assistantInput"),content=input.value.trim();if(!content)return;const state=termPreferenceState();(state.undo||=[]).push(JSON.parse(JSON.stringify({constraints:state.constraints||[],messages:state.messages||[]})));state.messages.push({role:"user",content});input.value="";renderAssistant();try{const response=await backendFetch("/api/schedule-assistant/interpret",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:state.messages.slice(-20),currentPreferences:{version:1,constraints:state.constraints||[]}})});if(response.clarification){state.messages.push({role:"assistant",content:response.acknowledgement,quickReplies:response.clarification.replyOptions||[]});savePlannerState();renderAssistant();return;}state.constraints=ScheduleRUPreferenceLogic.mergePreferencePatch({version:1,constraints:state.constraints||[]},response.preferencePatch).constraints;const recommendation=ScheduleRUPreferenceLogic.recommendSchedules(builderScheduleFacts(),{version:1,constraints:state.constraints});const indices=(recommendation.matches.length?recommendation.matches:recommendation.tradeoffs).slice(0,3).map(item=>item.stableIndex);state.messages.push({role:"assistant",content:recommendation.conflictSummary?`${response.acknowledgement} ${recommendation.conflictSummary.message} Which preference matters most?`:response.acknowledgement,recommendations:indices});}catch(error){state.messages.push({role:"assistant",content:assistantFailureMessage(error)});}savePlannerState();renderAssistant();}
document.getElementById("assistantClose").addEventListener("click",()=>document.getElementById("assistantDrawer").classList.remove("open"));document.getElementById("assistantSend").addEventListener("click",sendAssistant);document.getElementById("assistantUndo").addEventListener("click",()=>{const state=termPreferenceState(),snapshot=state.undo?.pop();if(snapshot){state.constraints=snapshot.constraints;state.messages=snapshot.messages;}savePlannerState();renderAssistant();});document.getElementById("assistantClear").addEventListener("click",()=>{const state=termPreferenceState();state.messages=[];state.constraints=[];state.undo=[];savePlannerState();renderAssistant();});

let onboardingFocusRestore=null;
function setOnboardingOpen(open,wasOpen=document.getElementById("onboarding").classList.contains("open")){const root=document.getElementById("onboarding");root.classList.toggle("open",open);root.setAttribute("aria-hidden",String(!open));[document.getElementById("app"),document.getElementById("page-courses"),document.querySelector(".pagenav")].filter(Boolean).forEach(node=>{node.inert=open;});if(open){if(!wasOpen)onboardingFocusRestore=document.activeElement;requestAnimationFrame(()=>root.querySelector("#onboardingContent button:not([disabled]), #onboardingContent input, #onboardingContent select, #onboardingContent textarea, #onboardingContent [tabindex]")?.focus());}else if(wasOpen){const restore=onboardingFocusRestore;onboardingFocusRestore=null;requestAnimationFrame(()=>{if(restore?.isConnected&&restore!==document.body)restore.focus();else document.getElementById("restartSetup")?.focus();});}}

function renderOnboardingContent(){
  const onboarding=ST.onboarding||{completed:false,step:0},root=document.getElementById("onboarding"),content=document.getElementById("onboardingContent"),step=Math.max(0,Math.min(4,Number(onboarding.step)||0)),activeStep=ScheduleRUOnboardingFlowModel.stepAt(step);
  root.classList.toggle("open",!onboarding.completed);document.getElementById("onboardingSteps").setAttribute("aria-valuenow",String(step+1));document.getElementById("onboardingSteps").innerHTML=Array.from({length:5},(_,index)=>`<i class="onboarding-step-dot ${index<=step?"active":""}"></i>`).join("");
  const records=academicRecords(),layout=(title,text,body,options={})=>{content.innerHTML=`<h1 id="onboardingTitle">${title}</h1><p>${text}</p>${body}<div class="onboarding-actions"><button class="choice-btn secondary" id="onboardingBack" ${step===0?"disabled":""}>Back</button><div class="right">${options.skip?'<button class="choice-btn secondary" id="onboardingSkip">Skip</button>':""}<button class="choice-btn" id="onboardingNext">${options.next||"Continue"}</button></div></div>`;document.getElementById("onboardingBack").onclick=()=>{ST.onboarding.step=ScheduleRUOnboardingFlowModel.move(step,"back");savePlannerState();renderOnboarding();};document.getElementById("onboardingSkip")?.addEventListener("click",()=>{ST.onboarding.step=ScheduleRUOnboardingFlowModel.move(step,"next");savePlannerState();renderOnboarding();});document.getElementById("onboardingNext").onclick=()=>{if(activeStep==="review")ST.onboarding.completed=true;else ST.onboarding.step=ScheduleRUOnboardingFlowModel.move(step,"next");savePlannerState();renderOnboarding();renderAll();};};
  if(activeStep==="welcome")return layout("Welcome to ScheduleRU","Build your plan locally in this browser. You can add an account later when sign-in is available.",`<button class="choice-btn secondary onboarding-coming-soon" type="button" disabled>Create account · Coming soon</button>`,{next:"Continue locally"});
  if(activeStep==="programs"){
    const roleRows=ScheduleRUOnboardingFlowModel.programRoleRows({programs:selectedProgramRows(),primaryId:ST.primaryProgramId,secondaryId:ST.secondaryProgramId});
    return layout("Choose programs of study","Start with your home school, primary major, optional second major, and minors.",`<div class="onboarding-fields"><label>Home school<select id="onboardingHomeSchool">${(ST.availableSchools||[]).map(school=>`<option value="${html(school.slug)}" ${school.slug===ST.homeSchoolSlug?"selected":""}>${html(school.name||school.short_name||school.slug)}</option>`).join("")}</select></label></div><div class="onboarding-review">${roleRows.map(program=>`<div><strong>${html(program.name)}</strong><span>${html(program.role)}</span></div>`).join("")||"<div>No program selected yet.</div>"}</div><button class="choice-btn secondary" id="onboardingPrograms">Add program of study</button>`);
  }
  if(activeStep==="coursework"){
    const terms=ScheduleRUOnboardingFlowModel.courseworkTerms();
    return layout("Add completed coursework","Add verified Rutgers courses manually. Transcript parsing is not available yet.",`<button class="choice-btn secondary onboarding-coming-soon" type="button" disabled>Transcript upload · Coming soon</button><div class="onboarding-fields onboarding-course-search"><label for="recordCourseTerm">Term completed</label><select id="recordCourseTerm">${terms.map(term=>`<option value="${term}">${term}</option>`).join("")}</select><label for="recordCourseSearch">Course code or search</label><input id="recordCourseSearch" autocomplete="off" aria-controls="recordCourseSearchResults" aria-autocomplete="list" placeholder="01:198:111 or Introduction to Computer Science"/><span id="recordCourseSearchStatus" class="onboarding-search-status" aria-live="polite">Start typing to search the Rutgers catalog.</span><div id="recordCourseSearchResults" class="onboarding-course-results" role="listbox" aria-label="Verified Rutgers course matches"></div></div><button class="choice-btn secondary" id="addCourseRecord">Add course</button><div class="onboarding-records">${records.filter(record=>record.type!=="ap").map(record=>`<div class="onboarding-record"><span><small>${html(record.completedTerm||"Term not set")}</small> ${html(record.courseCode)}${record.title?` · ${html(record.title)}`:""}</span><button class="choice-btn secondary" data-remove-record="${html(record.id)}">Remove</button></div>`).join("")}</div>`,{skip:true});
  }
  if(activeStep==="ap"){
    const choices=AP.length?AP.map(ap=>{const score=ap.minimumScore===ap.maximumScore?String(ap.minimumScore):`${ap.minimumScore}-${ap.maximumScore}`;return `<label class="onboarding-record"><span><input type="checkbox" data-onboarding-ap="${html(ap.id)}" ${ST.apOn?.[ap.id]?"checked":""}/> ${html(ap.name)} (${html(score)})</span><span>${html(ap.credits)} credits</span></label>`;}).join(""):"<div class=\"onboarding-note\">Reviewed AP choices are loading.</div>";
    return layout("Add AP credit","Scores of 4 or 5 may count when a reviewed Rutgers equivalency applies.",`<button class="choice-btn secondary onboarding-coming-soon" type="button" disabled>AP score report upload · Coming soon</button><div class="onboarding-records onboarding-records-scroll">${choices}</div>`,{skip:true});
  }
  return layout("Review your setup","Confirm the basics before opening your planner.",`<div class="onboarding-review"><div><strong>Home school</strong><span>${html(activeHomeSchoolLabel())}</span></div><div><strong>Programs</strong><span>${html(selectedProgramRows().length)} selected</span></div><div><strong>Completed courses</strong><span>${html(records.filter(record=>record.type!=="ap").length)} added</span></div><div><strong>AP exams</strong><span>${html(AP.filter(ap=>ST.apOn?.[ap.id]).length)} selected</span></div></div><ul class="onboarding-feature-list"><li>Generate a prerequisite-aware four-year draft.</li><li>Build a semester schedule from verified Rutgers sections.</li><li>Refine schedules with natural-language preferences.</li></ul>`,{next:"Open my planner"});
}
function renderOnboarding(){const wasOpen=document.getElementById("onboarding").classList.contains("open");renderOnboardingContent();setOnboardingOpen(!ST.onboarding?.completed,wasOpen);}
document.addEventListener("change",event=>{if(event.target.matches("[data-onboarding-ap]")){ST.apOn[event.target.dataset.onboardingAp]=event.target.checked;savePlannerState();renderAll();}if(event.target.id==="onboardingHomeSchool")changeHomeSchool(event.target.value);});
let onboardingCourseMatches=[];
let onboardingCourseSearchTimer=null;
let onboardingCourseSearchGeneration=0;
function onboardingLocalCourseCandidates(){
  return [...new Map([
    ...Object.values(COURSES).map(course=>ScheduleRUCourseInteractionLogic.mergeCourseRecords([course])),
    ...(ST.backendCourses||[]).map(backendCourseRecord),
  ].filter(course=>course?.code).map(course=>[course.code,course])).values()];
}
function renderOnboardingCourseSearchResults(query,matches,error=""){
  const options=document.getElementById("recordCourseSearchResults"),status=document.getElementById("recordCourseSearchStatus");
  if(options)options.innerHTML=(matches||[]).slice(0,8).map(course=>`<button type="button" class="onboarding-course-option" role="option" data-record-course-option="${html(course.code)}"><code>${html(course.code)}</code><span>${html(course.fullTitle||course.title||course.code)}</span><small>${html(courseCreditsLabel(course.credits,true))}</small></button>`).join("");
  if(!status)return;
  if(error)status.textContent=error;
  else if(!String(query||"").trim())status.textContent="Start typing to search the Rutgers catalog.";
  else if(matches?.length)status.textContent=`${matches.length} verified catalog match${matches.length===1?"":"es"} found.`;
  else status.textContent="No verified Rutgers course matched that search.";
}
async function searchOnboardingCourses(query){
  const generation=++onboardingCourseSearchGeneration;
  const terms=ScheduleRUCourseInteractionLogic.onboardingCatalogSearchTerms(query);
  if(!terms.length){onboardingCourseMatches=[];renderOnboardingCourseSearchResults(query,[]);return [];}
  try{
    const responses=await Promise.all(terms.map(term=>{
      const params=new URLSearchParams({search:term,limit:"50",offset:"0"});
      return backendFetch("/api/courses?"+params.toString());
    }));
    if(generation!==onboardingCourseSearchGeneration)return onboardingCourseMatches;
    const candidates=[...onboardingLocalCourseCandidates(),...responses.flatMap(data=>(data.courses||[]).map(backendCourseRecord))];
    onboardingCourseMatches=ScheduleRUCourseInteractionLogic.rankOnboardingCourseMatches(candidates,query).slice(0,25);
    renderOnboardingCourseSearchResults(query,onboardingCourseMatches);
    return onboardingCourseMatches;
  }catch(_){
    if(generation!==onboardingCourseSearchGeneration)return onboardingCourseMatches;
    onboardingCourseMatches=ScheduleRUCourseInteractionLogic.rankOnboardingCourseMatches(onboardingLocalCourseCandidates(),query).slice(0,25);
    renderOnboardingCourseSearchResults(query,onboardingCourseMatches,"The full catalog could not be reached. Try again in a moment.");
    return onboardingCourseMatches;
  }
}
function scheduleOnboardingCourseSearch(query){
  clearTimeout(onboardingCourseSearchTimer);
  const status=document.getElementById("recordCourseSearchStatus");
  if(status)status.textContent=String(query||"").trim()?"Searching the Rutgers catalog…":"Start typing to search the Rutgers catalog.";
  onboardingCourseSearchTimer=setTimeout(()=>searchOnboardingCourses(query),220);
}
async function addOnboardingCompletedCourse(){
  const input=document.getElementById("recordCourseSearch"),button=document.getElementById("addCourseRecord"),query=input?.value?.trim()||"",completedTerm=document.getElementById("recordCourseTerm")?.value||"";
  if(!query)return;
  if(button)button.disabled=true;
  const matches=await searchOnboardingCourses(query);
  const record=ScheduleRUCourseInteractionLogic.verifiedOnboardingCourse(matches,query);
  if(!record){
    renderOnboardingCourseSearchResults(query,matches,"Choose a verified Rutgers course from the catalog matches.");
    if(button)button.disabled=false;
    return;
  }
  addAcademicRecord({type:"rutgers_completed",courseCode:record.code,title:record.fullTitle||record.title,credits:Number(record.credits)||0,completedTerm});
  onboardingCourseMatches=[];
  renderOnboarding();
  renderAll();
}
document.addEventListener("input",event=>{if(event.target.id==="recordCourseSearch")scheduleOnboardingCourseSearch(event.target.value);});
document.addEventListener("click",event=>{const courseOption=event.target.closest("[data-record-course-option]");if(courseOption){const input=document.getElementById("recordCourseSearch");if(input)input.value=courseOption.dataset.recordCourseOption;addOnboardingCompletedCourse();return;}if(event.target.id==="addCourseRecord")addOnboardingCompletedCourse();if(event.target.matches("[data-remove-record]")){ST.academicRecords=academicRecords().filter(record=>record.id!==event.target.dataset.removeRecord);savePlannerState();renderOnboarding();renderAll();}if(event.target.id==="onboardingPrograms")openProgramPicker();});
document.getElementById("restartSetup").addEventListener("click",openRestartSetupConfirmation);
document.getElementById("onboardingRestart").addEventListener("click",openRestartSetupConfirmation);

function plannerTermsFromAcademicPosition(){const terms=[];let year=Math.min(4,Math.max(1,Number(ST.academicPosition?.year)||1)),sem=ST.academicPosition?.startingSemester==="spring"?"spring":"fall";while(terms.length<8){terms.push({year,sem});if(sem==="fall")sem="spring";else{year+=1;sem="fall";}}return terms;}
function plannerKnownCourseCodes(){return new Set([...completedAcademicCodes(),...Object.values(ST.schedule||{}).map(entry=>entry.code).filter(Boolean)]);}
function plannerLeafGroups(tree){return Object.values(tree?.groups||{}).filter(group=>(group.children||[]).length===0||(group.members||[]).length>0);}
function plannerRequirementInputs(tree,{sourceType,sourceProgram=""}={}){const known=plannerKnownCourseCodes(),selectedByGroup=ST.groupSelections||{},coursesByCode=new Map(),placeholders=[];for(const group of plannerLeafGroups(tree)){const members=group.members||[],selected=members.filter(id=>selectedByGroup[group.id]?.includes(id)||known.has(tree.courses?.[id]?.code)),required=group.rule==="all"?members.length:Math.max(1,Number(group.count)||1),concrete=sourceType==="core"?selected:(group.rule==="all"?members:selected);concrete.forEach(id=>{const course=tree.courses?.[id];if(course?.code&&!known.has(course.code))coursesByCode.set(course.code,course);});if(selected.length<required&&(sourceType==="core"||group.rule!=="all"))placeholders.push({id:group.id,label:groupDisplayName(group),credits:3,sourceType:sourceType||"program",sourceProgram,requirementGroupId:group.id,candidateSelectionContext:{rule:group.rule,required}});}return {courses:[...coursesByCode.values()],placeholders};}
function corePlannerStatus(){const inputs=plannerRequirementInputs(ST.coreRequirementTree,{sourceType:"core",sourceProgram:ST.activeCoreCurriculum?.id||"core"});return {...inputs,incomplete:inputs.placeholders.length>0};}
function normalizedPlannerInputs(){
  const terms=plannerTermsFromAcademicPosition(),core=corePlannerStatus();
  const input=ScheduleRUPlannerInput.buildPlannerInput({
    terms,
    requirementTrees:ST.majorRequirementTree?[{id:"selected-programs",tree:ST.majorRequirementTree}]:[],
    coreTree:ST.coreRequirementTree,
    groupSelections:ST.groupSelections||{},
    schedule:ST.schedule||{},
    wishlistCourses:wishlistRecords(),
    completedCourseCodes:completedAcademicCodes(),
    confirmedCredits:confirmedAcademicCreditEntries().reduce((total,entry)=>total+(Number(entry.credits)||0),0),
  });
  return {...input,core};
}
async function hydratePlannerDecisions(input){
  const decisions=await ScheduleRUPlanningDecisionLoader.hydrate({
    decisions:input.planningDecisions||[],request:backendFetch,
    normalizeCandidate:course=>backendCourseRecord(course),
  });
  const codes=[...new Set(decisions.flatMap(decision=>(decision.candidates||[]).map(candidate=>candidate.code)).filter(Boolean))];
  for(let index=0;index<codes.length;index+=25)await loadCourseEligibilityForCodes(codes.slice(index,index+25));
  const normalizedDecisions=decisions.map(decision=>({
    ...decision,
    candidates:(decision.candidates||[]).map(candidate=>({
      ...ScheduleRUPlannerInput.normalizedCourse({
        ...candidate,eligibility:ST.courseEligibilityByCode[candidate.code]||candidate.eligibility,
      }),
      attributes:[...(candidate.attributes||[])],
    })),
  }));
  return {...input,planningDecisions:await ScheduleRUPlanningDecisionLoader.hydratePrerequisiteMetadata({decisions:normalizedDecisions,request:backendFetch})};
}
const checkedGeneratePlanButton=document.getElementById("generatePlanBtn"),coreAwareGeneratePlanButton=checkedGeneratePlanButton.cloneNode(true);checkedGeneratePlanButton.replaceWith(coreAwareGeneratePlanButton);
function finishPlanGenerationPreflight(){ST.planGenerationPending=false;coreAwareGeneratePlanButton.disabled=false;}
function confirmPlanGenerationPreview(approvedInput){
  const core=corePlannerStatus();
  const decision=globalThis.ScheduleRUPlannerUI.generationPreflight({busy:false,coreIncomplete:core.incomplete});
  modalController.show({
    title:decision==="warn"?"Core choices are incomplete":"Generate a plan preview",
    body:decision==="warn"
      ? "<p>Accuracy improves when Core choices are completed. Placed courses stay where you put them unless you unlock them, and unresolved Core areas will appear as typed placeholders.</p>"
      : "<p>Placed courses stay where you put them unless you unlock them. This creates a preview; your accepted plan changes only after you choose Use this plan.</p>",
    canDismiss:false,
    actions:[
      {label:"Go back",secondary:true,onClick:finishPlanGenerationPreflight},
      {label:decision==="warn"?"I understand":"Generate preview",onClick:()=>{finishPlanGenerationPreflight();generateFourYearPlan(approvedInput);}},
    ],
  });
}
function generateApprovedCourseSet(approvedInput){
  const decision=globalThis.ScheduleRUPlannerUI.approvedGenerationPreflight({coreIncomplete:corePlannerStatus().incomplete});
  if(decision==="generate"){
    finishPlanGenerationPreflight();
    generateFourYearPlan(approvedInput);
    return;
  }
  modalController.show({
    title:"Core choices are incomplete",
    body:"<p>Accuracy improves when Core choices are completed. Your approved program courses will be used, and unresolved Core areas will remain clearly marked.</p>",
    canDismiss:false,
    actions:[
      {label:"Go back",secondary:true,onClick:finishPlanGenerationPreflight},
      {label:"I understand",onClick:()=>{finishPlanGenerationPreflight();generateFourYearPlan(approvedInput);}},
    ],
  });
}
function openGenerationDecisionFlow(input){
  let index=0;
  const scrollByDecision={};
  const displayByDecision={};
  const flow=ScheduleRUGenerationDecisionsController.create({
    decisions:input.planningDecisions||[],
    programs:ST.availablePrograms||[],
    initialPreferences:ST.choicePreferences||{},
    onChange:()=>{ST.choicePreferences=flow.preferences();savePlannerState();},
  });
  const decisions=flow.decisions();
  if(!decisions.length){confirmPlanGenerationPreview();return;}
  function decisionKey(decision){return decision.decisionId||decision.requirementGroupId;}
  function moveDecision(direction){
    let next=index+direction;
    while(next>=0&&next<decisions.length&&direction>0&&flow.unratedCandidates(decisionKey(decisions[next])).length===0)next+=direction;
    if(next>=decisions.length){renderRecommendationReview();return;}
    if(next<0){finishPlanGenerationPreflight();modalController.hide?.();return;}
    index=next;renderDecision();
  }
  function optimizedCourseSet(){
    const graph=ScheduleRUCandidateCoverageModel.buildCoverageGraph({
      decisions:input.planningDecisions||[],
      policies:{
        programs:ST.availablePrograms||[],
        doubleCountPolicies:ST.doubleCountPolicies||[],
        doubleCountRules:ST.doubleCountRules||[],
        doubleCountExceptions:ST.doubleCountExceptions||[],
      },
    });
    const result=ScheduleRUCourseSetOptimizer.optimizeCourseSet(graph,flow.preferences());
    return {graph,result};
  }
  function renderRecommendationReview(){
    const {graph,result}=optimizedCourseSet();
    if(result.status!=="complete"){
      const unresolvedIds=(result.issues||[]).filter(issue=>issue.type==="unresolved_requirements")
        .flatMap(issue=>(issue.requirements||[]).map(item=>item.requirementId));
      const labels=[...new Set(unresolvedIds.map(id=>graph.requirements.find(item=>item.id===id)?.label).filter(Boolean))];
      const message=result.status==="indeterminate"
        ? "There are too many equally valid combinations to recommend one safely. Narrow one or two preferences and try again."
        : labels.length
          ? `We could not complete ${labels.slice(0,3).join(", ")}${labels.length>3?", and other choices":""} from the reviewed options. Go back and mark more courses you would consider.`
          : "Some required choices do not yet have enough reviewed options for a complete recommendation.";
      modalController.show({title:"A complete recommendation isn’t ready",body:`<p>${html(message)}</p>`,canDismiss:false,actions:[{label:"Back",secondary:true,close:false,onClick:()=>{index=decisions.length-1;renderDecision();}}]});
      return;
    }
    modalController.show({
      title:"Review recommended courses",
      body:ScheduleRUGenerationDecisionsView.renderRecommendations({result,requirements:graph.requirements}),
      canDismiss:false,
      actions:[
        {label:"Back",secondary:true,close:false,onClick:()=>{index=decisions.length-1;renderDecision();}},
        {label:"Use these courses",className:"push-right",close:false,onClick:()=>generateApprovedCourseSet(ScheduleRUPlannerInput.applyApprovedCourseSet(input,result))},
      ],
    });
    document.getElementById("appModalBody")?.querySelectorAll("[data-replace-requirement]").forEach(button=>button.addEventListener("click",()=>{
      const replacementIndex=decisions.findIndex(decision=>decisionKey(decision)===button.dataset.replaceRequirement);
      if(replacementIndex>=0){index=replacementIndex;renderDecision();}
    }));
  }
  function renderDecision(){
    const previous=document.querySelector(".generation-decision")?.dataset?.decisionGroup;
    if(previous)scrollByDecision[previous]=ScheduleRUGenerationDecisionsView.captureListScroll(document);
    const decision=decisions[index],groupId=decisionKey(decision);
    const preference=flow.preferences()[groupId]||{};
    const display=displayByDecision[groupId]||{expanded:false,search:""};
    modalController.show({
      title:"Plan your course choices",
      body:ScheduleRUGenerationDecisionsView.renderDecision({decision,preference,globalPreference:flow.preferences().__global,index,total:decisions.length,...display}),
      canDismiss:false,
      actions:[
        {label:"Back",secondary:true,close:index===0,onClick:()=>{if(index===0)finishPlanGenerationPreflight();else moveDecision(-1);}},
        ...(decision.canDefer||decision.canSkip?[{label:decision.canSkip?"Skip":"I’ll do this later",className:"quiet-action",close:false,onClick:()=>{flow.defer(groupId);moveDecision(1);}}]:[]),
        {label:index===decisions.length-1?"Review courses":"Next",className:"push-right",disabled:!flow.canAdvance(groupId),close:false,onClick:()=>moveDecision(1)},
      ],
    });
    ScheduleRUGenerationDecisionsView.restoreListScroll(document,scrollByDecision[groupId]);
    const body=document.getElementById("appModalBody");
    body.querySelectorAll("[data-decision-bucket]").forEach(button=>button.addEventListener("click",()=>{
      flow.setInterest(groupId,button.dataset.decisionCourse,button.dataset.decisionBucket);
      renderDecision();
    }));
    body.querySelector("[data-decision-recommend]")?.addEventListener("click",()=>{flow.chooseForMe(groupId);renderDecision();});
    body.querySelector("[data-decision-expand]")?.addEventListener("click",()=>{displayByDecision[groupId]={...display,expanded:!display.expanded};renderDecision();});
    body.querySelector("[data-decision-search]")?.addEventListener("input",event=>{
      displayByDecision[groupId]={expanded:true,search:event.target.value};renderDecision();
      const search=document.getElementById("appModalBody")?.querySelector("[data-decision-search]");
      if(search){search.focus();search.setSelectionRange(search.value.length,search.value.length);}
    });
  }
  renderDecision();
}
async function beginPlanGenerationPreflight(){
  if(globalThis.ScheduleRUPlannerUI.generationPreflight({busy:ST.planGenerationPending,coreIncomplete:false})==="ignore")return;
  ST.planGenerationPending=true;coreAwareGeneratePlanButton.disabled=true;
  if(!ST.coreRequirementTree&&!ST.coreLoading)await loadCoreCurriculum();
  if(!ST.coreRequirementTree){
    finishPlanGenerationPreflight();
    modalController.show({title:"Core requirements unavailable",body:"<p>The reviewed Core requirements could not be loaded, so ScheduleRU did not generate an incomplete plan. Try again after the connection recovers.</p>",actions:[{label:"Close",secondary:true}]});
    return;
  }
  modalController.show({title:"Preparing your choices",body:"<p>Loading the reviewed courses for your selected programs…</p>",actions:[],canDismiss:false});
  try{
    openGenerationDecisionFlow(await hydratePlannerDecisions(normalizedPlannerInputs()));
  }catch(error){
    finishPlanGenerationPreflight();
    const shown=ScheduleRUUserMessageModel.presentIssue(error);
    modalController.show({title:"Course choices unavailable",body:`<p>${html(shown.message)}</p>`,actions:[{label:"Close",secondary:true}]});
  }
}
coreAwareGeneratePlanButton.addEventListener("click",beginPlanGenerationPreflight);

loadHackathonConfiguration();renderOnboarding();renderAll();
