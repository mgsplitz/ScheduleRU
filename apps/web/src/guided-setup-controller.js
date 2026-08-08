/* The release shell keeps the legacy planner interactive while adding the reviewed, local-first flows. */
const modalController=(()=>{
  const root=document.getElementById("appModal"),card=root.querySelector("[role=dialog]"); let restore=null,dismissible=true;
  function close(){ if(!root.classList.contains("open")) return; root.classList.remove("open"); root.setAttribute("aria-hidden","true"); restore?.focus?.(); }
  function show({title,body,actions=[],canDismiss=true}){ restore=document.activeElement; dismissible=canDismiss; document.getElementById("appModalTitle").textContent=title; document.getElementById("appModalBody").innerHTML=body; const actionsRoot=document.getElementById("appModalActions"); actionsRoot.innerHTML=""; actions.forEach(action=>{const button=document.createElement("button");button.className=`choice-btn ${action.secondary?"secondary":""}`;button.textContent=action.label;button.addEventListener("click",()=>{if(action.close!==false) close(); action.onClick?.();});actionsRoot.append(button);}); root.classList.add("open");root.setAttribute("aria-hidden","false");(actionsRoot.querySelector("button")||card).focus(); }
  root.addEventListener("click",event=>{if(event.target===root&&dismissible)close();}); document.addEventListener("keydown",event=>{if(event.key==="Escape"&&root.classList.contains("open")&&dismissible){event.preventDefault();close();}}); return {show,close};
})();

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
function rerenderOnboardingApStep(){if(!ST.onboarding?.completed&&Number(ST.onboarding?.step)===1)renderOnboarding();}
async function loadHackathonConfiguration(){
  try{const config=await backendFetch("/api/config");ST.activeYear=config.activeYear;ST.activeTerm=config.activeTerm;}catch(_){ST.activeYear=new Date().getFullYear();ST.activeTerm="9";}
  ensureAcademicCalendarAnchor();
  try{const data=await backendFetch("/api/ap-equivalencies");AP=(data.equivalencies||[]).map(row=>({id:row.id,name:row.exam_name,equiv:parseJson(row.equivalent_course_codes_json).join(", "),credits:Number(row.credits)||0,fulfills:parseJson(row.fulfills_requirement_ids_json),minimumScore:Number(row.minimum_score),maximumScore:Number(row.maximum_score)}));refreshApFulfillment();}catch(_){AP=[];}
  rerenderOnboardingApStep();updateProgramTitle();renderSchedule();
}

function academicRecords(){ return Array.isArray(ST.academicRecords)?ST.academicRecords:[]; }
function addAcademicRecord(record){ ST.academicRecords.push(ScheduleRUPlannerStateLogic.normalizeAcademicRecord(record)); savePlannerState(); }
function legacyCompletedAcademicCodes(){const completed=Object.entries(ST.completed||{}).filter(([,taken])=>taken).flatMap(([id])=>[courseRecordFromId(id)?.code||id]);const ap=AP.filter(entry=>ST.apOn?.[entry.id]).flatMap(entry=>courseCodesFromText(entry.equiv));return [...new Set([...completed,...ap].filter(Boolean))];}
function completedAcademicCodes(){ return [...new Set([
  ...resolvedAcademicCourseCodes([...legacyCompletedAcademicCodes(),...academicRecords().filter(record=>record.creditStatus==="applied").flatMap(record=>[record.courseCode,...(record.equivalentCourseCodes||[])])]),
  ...confirmedAcademicCourseCodes(),
])]; }
const legacyConfirmedEntries=confirmedAcademicCreditEntries;
confirmedAcademicCreditEntries=function(){ return [...legacyConfirmedEntries(),...ScheduleRUPlannerStateLogic.academicCreditEntries(ST)]; };
const legacyIsCompleted=isCompleted;
isCompleted=function(id){ const code=COURSES[id]?.code||id; return legacyIsCompleted(id)||completedAcademicCodes().some(value=>requirementCourseId(value)===requirementCourseId(code)); };

function plannerIssueText(issue){
  const courseCodes=issue.courseCodes?.join(", ")||issue.courseCode||"";
  if(["plan_capacity_exceeded","plan_course_slots_exceeded","plan_sequence_capacity_exceeded","plan_feasibility_inconclusive"].includes(issue.code))return globalThis.ScheduleRUPlannerUI.previewResult({status:"partial",issues:[issue]}).message;
  if(issue.code==="courses_unplaced")return `Could not place required courses: ${courseCodes}. Review their prerequisites or choose approved alternatives.`;
  if(issue.code==="optional_courses_unplaced")return `Wishlist courses not placed: ${courseCodes}. Required coursework was prioritized.`;
  if(issue.code==="requirements_unplaced")return `Some unresolved requirement slots could not fit within the term limits.`;
  if(issue.code==="locked_prerequisite_violation")return `${issue.courseCode||"A pinned course"} is pinned before a reviewed prerequisite can be completed.`;
  if(issue.code==="eligibility_rule_unresolved")return `${issue.courseCode||"A course"}: eligibility details still need review.`;
  return String(issue.code||"Planning issue").replaceAll("_"," ");
}
function issueList(){
  const issues=[]; if(ST.requirementsError)issues.push({group:"Requirements",severity:"error",text:ST.requirementsError});
  selectedProgramRows().filter(row=>row.requirements_available===false||row.coverage_status==="catalog_listed").forEach(row=>issues.push({group:"Requirements",severity:"warning",text:`${row.name}: requirements are still under review.`}));
  (ST.programEligibilityRules||[]).filter(rule=>ST.selectedPrograms.includes(rule.program_id)).forEach(rule=>issues.push({group:"Advising and program policy",severity:"advising",text:rule.advisory_message||rule.note||"Confirm this reviewed program policy with advising."}));
  const overlap=ST.doubleCount;if(overlap){(overlap.scopeResults||[]).filter(item=>item.violates||item.codes?.length).forEach(item=>issues.push({group:"Double-count policy",severity:item.violates?"warning":"info",text:item.violates?doubleCountMeaning(item):`${item.codes.length} potential shared course overlap${item.codes.length===1?"":"s"} reviewed.`}));(overlap.unscoped||[]).forEach(item=>issues.push({group:"Double-count policy",severity:"warning",text:`Confirm whether ${item.code||"this overlap"} may count toward both programs.`}));}
  const previewIssues=ST.generatedPlanPreview?.issues||[],eligibility=previewIssues.filter(issue=>issue.code==="eligibility_rule_unresolved"),otherPreviewIssues=previewIssues.filter(issue=>issue.code!=="eligibility_rule_unresolved");
  if(eligibility.length)issues.push({group:"Plan preview",severity:"warning",text:`Eligibility details need review for ${eligibility.map(issue=>issue.courseCode).filter(Boolean).join(", ")}.`});
  otherPreviewIssues.forEach(issue=>issues.push({group:"Plan preview",severity:issue.severity||"warning",text:plannerIssueText(issue)}));
  return issues;
}
function showIssues(){const issues=issueList(),groups=new Map();issues.forEach(issue=>{const entries=groups.get(issue.group)||[];entries.push(issue);groups.set(issue.group,entries);});modalController.show({title:`Issues · ${issues.length}`,body:issues.length?[...groups.entries()].map(([group,entries])=>`<section><h3>${html(group)}</h3>${entries.map(issue=>`<div class="planner-issue planner-issue-${issue.severity}"><span class="issue-severity issue-severity-${issue.severity}">${html(issue.severity)}</span><span>${html(issue.text)}</span></div>`).join("")}</section>`).join(""):"<p>No active planning issues.</p>",actions:[{label:"Close",secondary:true}]}); }
function orderedPrograms(){ const rows=selectedProgramRows(); const byId=new Map(rows.map(row=>[row.id,row])); const ids=[ST.primaryProgramId,ST.secondaryProgramId,...rows.map(row=>row.id)].filter((id,index,list)=>id&&list.indexOf(id)===index);return ids.map(id=>byId.get(id)).filter(Boolean); }
function setRequiredProgram(id){
  if(ST.requiredProgramTab!==id){ST.requiredRootOpen={};ST.nestedGroupOpen={};}
  ST.requiredProgramTab=id;renderPanel();
}
function treeIncludesSourceProgram(roots,sourceProgramId){return (roots||[]).some(root=>root?.program_id===sourceProgramId||treeIncludesSourceProgram(root?.children,sourceProgramId));}
function groupBelongsToRequiredProgram(group,programId){if(Array.isArray(group?.sourceProgramIds)&&group.sourceProgramIds.length)return group.sourceProgramIds.includes(programId);return !group?.sourceProgramId||group.sourceProgramId===programId||treeIncludesSourceProgram(ST.requirementTrees?.[programId],group.sourceProgramId);}
function requiredRootGroupHtml(group,collapsed){
  if(group.rule!=="all")return groupHtml(group.id);
  const applied=groupAppliedCourseIds(group),members=(group.members||[]).filter(id=>!applied.includes(id));
  const body=`${selectorGuidanceHtml(group)}${applied.length?`<div class="choice-picked"><strong style="font-size:10px;">Applied here</strong><div class="cgrid">${applied.map(cardHtml).join("")}</div></div>`:""}${members.length?`<div class="cgrid">${members.map(cardHtml).join("")}</div>`:""}${(group.children||[]).map(groupHtml).join("")}`;
  return `<section class="required-root"><button class="required-root-hdr" data-required-root-toggle="${html(group.id)}" aria-expanded="${String(!collapsed)}"><span>${html(groupDisplayName(group))}</span><span>${collapsed?"Show":"Hide"}</span></button><div class="required-root-body${collapsed?"":" open"}" id="required-root-${html(group.id)}">${body}</div></section>`;
}
const legacyRenderRequired=renderRequired;
renderRequired=function(){
  useRequirementTree(ST.majorRequirementTree); const pb=document.getElementById("pb"); if(ST.requirementsLoading||ST.requirementsError){legacyRenderRequired();return;}
  const programs=orderedPrograms(); if(!ST.requiredProgramTab||!programs.some(program=>program.id===ST.requiredProgramTab))ST.requiredProgramTab=programs[0]?.id||"";
  const issueCount=issueList().length; const subtabs=programs.map(program=>`<button class="program-subtab ${program.id===ST.requiredProgramTab?"active":""} ${program.type==="minor"?"program-subtab-minor":""}" data-required-program="${html(program.id)}">${html(program.name)}</button>`).join("");
  let groups=ROOT_GROUPS.map(id=>GROUPS[id]).filter(Boolean).filter(group=>groupBelongsToRequiredProgram(group,ST.requiredProgramTab));
  const selectedMajorIds=programs.filter(program=>program.type==="major").map(program=>program.id);
  let content=groups.map(group=>{
    const defaultOpen=!globalThis.ScheduleRUPlannerUI.shouldAutoCollapseSharedGroup({group,selectedMajorIds});
    const open=globalThis.ScheduleRUCourseInteractionLogic.expansionOpen({
      stored:ST.requiredRootOpen[group.id],defaultOpen,
    });
    return requiredRootGroupHtml(group,!open);
  }).join("");
  if(!content)content=`<div class="empty" style="margin-top:30px;">No reviewed requirements are available for this program yet.</div>`;
  pb.innerHTML=`<div class="required-tools"><span class="leg">Reviewed requirements for this program.</span><button class="issues-btn" id="issuesBtn">Issues · ${issueCount}</button></div><div class="subtabs">${subtabs}</div>${content}<div class="planning-disclaimer">ScheduleRU is a planning aid, not an official degree audit.</div>`;
  attachCardEvents(pb);
  pb.querySelectorAll("[data-required-program]").forEach(button=>button.addEventListener("click",()=>setRequiredProgram(button.dataset.requiredProgram)));
  pb.querySelectorAll("[data-required-root-toggle]").forEach(button=>button.addEventListener("click",()=>{
    const groupId=button.dataset.requiredRootToggle,body=document.getElementById("required-root-"+groupId),open=body?.classList.toggle("open");
    ST.requiredRootOpen[groupId]=!!open;button.setAttribute("aria-expanded",String(!!open));button.lastElementChild.textContent=open?"Hide":"Show";
  }));
  pb.querySelectorAll("[data-gtog]").forEach(toggle=>{
    const groupId=toggle.dataset.gtog,body=document.getElementById("gb-"+groupId);
    const open=globalThis.ScheduleRUCourseInteractionLogic.expansionOpen({stored:ST.nestedGroupOpen[groupId],defaultOpen:true});
    body?.classList.toggle("open",open);
    toggle.addEventListener("click",()=>{const next=body?.classList.toggle("open");ST.nestedGroupOpen[groupId]=!!next;});
  });
  pb.querySelectorAll("[data-gpicker]").forEach(button=>button.addEventListener("click",event=>{event.stopPropagation();openRequirementPicker(button.dataset.gpicker);}));
  pb.querySelectorAll("[data-gbrowse]").forEach(button=>button.addEventListener("click",event=>{event.stopPropagation();openRequirementPicker(button.dataset.gbrowse);}));
  pb.querySelectorAll("[data-gclear]").forEach(button=>button.addEventListener("click",()=>{delete ST.groupSelections[button.dataset.gclear];renderPanel();}));
  document.getElementById("issuesBtn")?.addEventListener("click",showIssues);
};

function applyProgramRoles(ids,primaryId=ST.programDraftPrimaryId){const byId=new Map((ST.availablePrograms||[]).map(program=>[program.id,program]));const majors=ids.filter(id=>byId.get(id)?.type==="major");ST.primaryProgramId=majors.includes(primaryId)?primaryId:majors[0]||null;ST.secondaryProgramId=majors.find(id=>id!==ST.primaryProgramId)||null;ST.requiredProgramTab=ST.primaryProgramId||ids[0]||"";}
function setProgramApplyPending(pending){ST.programApplyPending=!!pending;const button=document.getElementById("programApply");if(button){button.disabled=!!pending;button.textContent=pending?"Applying…":"Apply programs";}}
function acceptedProgramSnapshot(){return {selectedPrograms:ST.selectedPrograms,primaryProgramId:ST.primaryProgramId,secondaryProgramId:ST.secondaryProgramId,requiredProgramTab:ST.requiredProgramTab,requirementTrees:ST.requirementTrees,referenceRequirementTrees:ST.referenceRequirementTrees,majorRequirementTree:ST.majorRequirementTree,catalogListedProgramIds:ST.catalogListedProgramIds,doubleCountPolicies:ST.doubleCountPolicies,doubleCountRules:ST.doubleCountRules,doubleCountExceptions:ST.doubleCountExceptions,programEligibilityRules:ST.programEligibilityRules,activeProgram:ST.activeProgram,doubleCount:ST.doubleCount,requirementsError:ST.requirementsError};}
async function acceptProgramDraft(ids,generation){
  if(generation!==ST.programApplyGeneration||ST.programApplyPending)return;
  const snapshot=acceptedProgramSnapshot();setProgramApplyPending(true);ST.requirementsLoading=true;renderPanel();
  try{await loadSelectedRequirements(ids);if(generation!==ST.programApplyGeneration)return;ST.selectedPrograms=ids;applyProgramRoles(ids);ST.programSelectionConfirmed=true;ST.requirementsError="";savePlannerState();updateProgramTitle();renderOnboarding();closeProgramPicker();}
  catch(error){if(generation===ST.programApplyGeneration){Object.assign(ST,snapshot);showProgramPolicyFeedback({errors:[{message:`Programs were not changed: ${error.message||"requirements could not load"}.`} ]});}}
  finally{if(generation===ST.programApplyGeneration){ST.requirementsLoading=false;setProgramApplyPending(false);renderPanel();}}
}
async function applyProgramDraft(){
  if(ST.programApplyPending)return;const ids=[...new Set(ST.programDraft||[])],majors=(ST.availablePrograms||[]).filter(program=>ids.includes(program.id)&&program.type==="major");
  if(!majors.length){showProgramPolicyFeedback({errors:[{message:"Choose one primary major before applying programs."}]});return;}if(majors.length>2){showProgramPolicyFeedback({errors:[{message:"Choose one primary major and, if needed, one secondary major. Three majors are not supported."}]});return;}
  const generation=(ST.programApplyGeneration||0)+1;ST.programApplyGeneration=generation;setProgramApplyPending(true);let check;
  try{check=await backendFetch("/api/program-selection-check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({home_school:ST.homeSchoolSlug,program_ids:ids})});}catch(_){if(generation===ST.programApplyGeneration)showProgramPolicyFeedback({errors:[{message:"Program policy checks could not be loaded. Your saved programs were not changed."}]});}finally{if(generation===ST.programApplyGeneration)setProgramApplyPending(false);}
  if(!check||generation!==ST.programApplyGeneration)return;if(!check.allowed){showProgramPolicyFeedback(check);return;}
  if(check.warnings?.length){modalController.show({title:"Review program warnings",body:`<ul class="policy-warning-list">${check.warnings.map(warning=>`<li>${html(warning.message||warning.note||"This program combination needs advising.")}</li>`).join("")}</ul>`,actions:[{label:"Go back",secondary:true},{label:"Apply anyway",onClick:()=>acceptProgramDraft(ids,generation)}]});return;}
  await acceptProgramDraft(ids,generation);
}
const oldApply=document.getElementById("programApply"),newApply=oldApply.cloneNode(true);oldApply.replaceWith(newApply);newApply.addEventListener("click",applyProgramDraft);
let programDialogFocusRestore=null;
function setProgramDialogOpen(open){const root=document.getElementById("programOv"),dialog=root.querySelector("[role=dialog]");root.setAttribute("aria-hidden",String(!open));[document.getElementById("app"),document.getElementById("page-courses"),document.querySelector(".pagenav")].filter(Boolean).forEach(node=>{node.inert=open||!ST.onboarding?.completed;});document.getElementById("onboarding").inert=open;if(open){programDialogFocusRestore=document.activeElement;requestAnimationFrame(()=>dialog.querySelector("input, select, button:not([disabled])")?.focus());}else{const restore=programDialogFocusRestore;programDialogFocusRestore=null;requestAnimationFrame(()=>{if(restore?.isConnected&&restore!==document.body)restore.focus();else(!ST.onboarding?.completed?document.getElementById("onboardingPrograms"):document.getElementById("programBtn"))?.focus();});}}
const legacyOpenProgramPicker=openProgramPicker,legacyCloseProgramPicker=closeProgramPicker,legacyRenderProgramPickerList=renderProgramPickerList;
openProgramPicker=function(){ST.programDraftPrimaryId=ST.primaryProgramId;legacyOpenProgramPicker();setProgramDialogOpen(true);};
closeProgramPicker=function(){legacyCloseProgramPicker();setProgramDialogOpen(false);};
renderProgramPickerList=function(){legacyRenderProgramPickerList();const controls=document.getElementById("programRoleControls"),byId=new Map((ST.availablePrograms||[]).map(program=>[program.id,program]));if(!ST.programBrowseSchoolSlug){controls.innerHTML="";return;}const view=ScheduleRUProgramPickerLogic.programDraftView({draftIds:ST.programDraft,primaryId:ST.programDraftPrimaryId,programs:ST.availablePrograms});ST.programDraft=view.selectedIds;ST.programDraftPrimaryId=view.primaryId;controls.innerHTML=view.majorIds.length?`<div class="onboarding-note"><b>Major roles</b><br/>${view.majorIds.map(id=>`<button class="choice-btn secondary" data-draft-primary="${html(id)}" ${id===view.primaryId?"disabled":""}>${id===view.primaryId?"Primary: ":"Make primary: "}${html(byId.get(id)?.name||id)}</button>`).join(" ")}<br/>The first selected major is primary by default; choose another to swap roles.</div>`:"";controls.querySelectorAll("[data-draft-primary]").forEach(button=>button.addEventListener("click",()=>{ST.programDraftPrimaryId=button.dataset.draftPrimary;renderProgramPickerList();}));};
function replaceProgramPickerControl(id,handler){const control=document.getElementById(id),replacement=control.cloneNode(true);control.replaceWith(replacement);replacement.addEventListener("click",handler);}
replaceProgramPickerControl("programBtn",openProgramPicker);
replaceProgramPickerControl("programClose",closeProgramPicker);
replaceProgramPickerControl("programCancel",closeProgramPicker);
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&document.getElementById("programOv").classList.contains("open")&&!document.getElementById("appModal").classList.contains("open")&&!ST.programApplyPending){event.preventDefault();closeProgramPicker();}});
document.getElementById("programOv").addEventListener("click",event=>{if(event.target===document.getElementById("programOv")&&!ST.programApplyPending)closeProgramPicker();});

function plannerTerms(){return plannerTermsFromAcademicPosition();}
function unresolvedPlannerRequirements(){return normalizedPlannerInputs().unresolvedRequirements;}
function generateFourYearPlan(){const input=normalizedPlannerInputs();ST.generatedPlanPreview=ScheduleRUFourYearPlanner.generatePlan(input);savePlannerState();showPlanPreview();}
function confirmClearPlan(){modalController.show({title:"Clear this plan?",body:"<p>This removes every semester placement and unresolved requirement placeholder. Your completed courses, programs, and wishlist will stay saved.</p>",actions:[{label:"Keep plan",secondary:true},{label:"Clear plan",onClick:()=>{ST.schedule={};ST.planPlaceholders=[];ST.generatedPlanPreview=null;savePlannerState();renderAll();}}]});}
document.getElementById("clearPlanBtn").addEventListener("click",confirmClearPlan);
function acceptGeneratedPlan(preview){const accepted=ScheduleRUPlannerStateLogic.withAcceptedPlan(ST,preview);Object.assign(ST,accepted);const firstPopulated=plannerTerms().find(term=>Object.values(ST.schedule).some(entry=>entry.year===term.year&&entry.sem===term.sem)||(ST.planPlaceholders||[]).some(placeholder=>placeholder.year===term.year&&placeholder.sem===term.sem));if(firstPopulated)ST.year=firstPopulated.year;savePlannerState();renderAll();}
function showPlanPreview(){const preview=ST.generatedPlanPreview;if(!preview)return;const rows=plannerTerms().map(term=>{const courses=Object.values(preview.schedule).filter(entry=>entry.year===term.year&&entry.sem===term.sem);const placeholders=(preview.placeholders||[]).filter(entry=>entry.year===term.year&&entry.sem===term.sem);const items=courses.map(entry=>`<div class="planner-item"><strong>${html(entry.code)}</strong> · ${html(entry.title||entry.code)} · ${html(entry.credits)} credits${entry.userPinned||entry.locked?" · pinned":""}</div>`).join("")+placeholders.map(entry=>`<div class="planner-item placeholder-item">To be selected: ${html(entry.label)} · ${html(entry.estimatedCredits)} estimated credits</div>`).join("");return `<section class="planner-term"><h3>${html(academicYearLabel(term.year))} · ${html(term.sem)}</h3>${items||"<div class=\"planner-item\">No placement</div>"}</section>`;}).join("");const result=globalThis.ScheduleRUPlannerUI.previewResult(preview),primaryCode={aggregate_capacity:"plan_capacity_exceeded",course_slot_capacity:"plan_course_slots_exceeded",sequencing_capacity:"plan_sequence_capacity_exceeded",indeterminate:"plan_feasibility_inconclusive"}[result.kind],blocking=(preview.issues||[]).filter(issue=>issue.severity==="error"&&issue.code!==primaryCode),warningCount=(preview.issues||[]).length-blocking.length-(primaryCode?1:0),canAccept=globalThis.ScheduleRUPlannerUI.canAcceptGeneratedPlan(preview);modalController.show({title:result.title,body:`<div class="planner-preview">${rows}${canAccept?"":`<div class="planner-issue planner-issue-error">${html(result.message)}</div>`}${blocking.map(issue=>`<div class="planner-issue planner-issue-error">${html(plannerIssueText(issue))}</div>`).join("")}${warningCount?`<div class="planner-issue">${warningCount} planning notes are available under Issues.</div>`:""}${canAccept?"":'<div class="planner-issue planner-issue-error">This draft is incomplete and has not replaced your current plan.</div>'}</div>`,actions:canAccept?[{label:"Cancel",secondary:true},{label:"Use this plan",onClick:()=>acceptGeneratedPlan(preview)}]:[{label:"Close",secondary:true}]});}

function termPreferenceState(){const currentTerm=currentPlannerTerm(),key=ScheduleRUPlannerStateLogic.termKey({year:currentTerm.year,sem:currentTerm.semester});ST.schedulePreferences[key]||={version:1,constraints:[],messages:[]};return ST.schedulePreferences[key];}
function normalizeAssistantOpenStatus(open_status){if(open_status===true||open_status===1||open_status==="1")return true;if(open_status===false||open_status===0||open_status==="0")return false;return null;}
function normalizeAssistantMeeting(meeting,section){const day=["M","T","W","R","F","S","U"][dayIndex(meeting?.day_of_week)],range=meetingTimeRange(meeting);if(!day||!range)return null;return {day,start:range.start,end:range.end,courseCode:section?.code||"",courseTitle:section?.fullTitle||section?.title||"",campus:campusFor(meeting),modality:meeting?.mode||meeting?.meeting_mode||"",open:normalizeAssistantOpenStatus(section?.open_status)};}
globalThis.ScheduleRUUIContracts={normalizeAssistantOpenStatus,normalizeAssistantMeeting};
function builderScheduleFacts(){return (ST.builder?.permutations||[]).map((combo,index)=>({stableIndex:combo.stableIndex||index+1,meetings:combo.flatMap(section=>(section.meetings||[]).map(meeting=>normalizeAssistantMeeting(meeting,section)).filter(Boolean))}));}
function renderAssistant(){const state=termPreferenceState(),root=document.getElementById("assistantMessages");const messages=state.messages||[];root.innerHTML=(messages.length?messages:[{role:"assistant",content:"Tell me preferences like ‘no classes before 10’ or ‘keep Friday light.’ I only recommend verified schedule numbers."}]).map(message=>`<div class="assistant-message ${message.role==="user"?"user":""}">${html(message.content)}${message.recommendations?.length?`<div class="assistant-recs">${message.recommendations.slice(0,3).map(index=>`<button data-assistant-index="${index}">Try #${index}</button>`).join("")}</div>`:""}${message.quickReplies?.length?`<div class="assistant-recs">${message.quickReplies.map(reply=>`<button data-assistant-reply="${html(reply)}">${html(reply)}</button>`).join("")}</div>`:""}</div>`).join("");root.querySelectorAll("[data-assistant-index]").forEach(button=>button.addEventListener("click",()=>{const index=Number(button.dataset.assistantIndex);if(ST.builder){const found=ST.builder.permutations.findIndex(combo=>combo.stableIndex===index);if(found>=0){ST.builder.permIndex=found;renderBuilder();}}}));root.querySelectorAll("[data-assistant-reply]").forEach(button=>button.addEventListener("click",()=>{const input=document.getElementById("assistantInput"),reply=button.dataset.assistantReply;input.value=[input.value.trim(),reply].filter(Boolean).join(", ");input.focus();}));}
function assistantFailureMessage(error){const text=String(error?.message||error);if(/assistant_quota/.test(text))return "The schedule assistant has reached its API limit. Your verified schedules are still available.";if(/assistant_(?:authentication|configuration)/.test(text))return "The schedule assistant needs a configuration update. Your verified schedules are unaffected.";return "The schedule assistant is temporarily unavailable. You can keep browsing verified schedules.";}
async function sendAssistant(){const input=document.getElementById("assistantInput"),content=input.value.trim();if(!content)return;const state=termPreferenceState();(state.undo||=[]).push(JSON.parse(JSON.stringify({constraints:state.constraints||[],messages:state.messages||[]})));state.messages.push({role:"user",content});input.value="";renderAssistant();try{const response=await backendFetch("/api/schedule-assistant/interpret",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({messages:state.messages.slice(-20),currentPreferences:{version:1,constraints:state.constraints||[]}})});if(response.clarification){state.messages.push({role:"assistant",content:response.acknowledgement,quickReplies:response.clarification.replyOptions||[]});savePlannerState();renderAssistant();return;}state.constraints=ScheduleRUPreferenceLogic.mergePreferencePatch({version:1,constraints:state.constraints||[]},response.preferencePatch).constraints;const recommendation=ScheduleRUPreferenceLogic.recommendSchedules(builderScheduleFacts(),{version:1,constraints:state.constraints});const indices=(recommendation.matches.length?recommendation.matches:recommendation.tradeoffs).slice(0,3).map(item=>item.stableIndex);state.messages.push({role:"assistant",content:recommendation.conflictSummary?`${response.acknowledgement} ${recommendation.conflictSummary.message} Which preference matters most?`:response.acknowledgement,recommendations:indices});}catch(error){state.messages.push({role:"assistant",content:assistantFailureMessage(error)});}savePlannerState();renderAssistant();}
document.getElementById("assistantClose").addEventListener("click",()=>document.getElementById("assistantDrawer").classList.remove("open"));document.getElementById("assistantSend").addEventListener("click",sendAssistant);document.getElementById("assistantUndo").addEventListener("click",()=>{const state=termPreferenceState(),snapshot=state.undo?.pop();if(snapshot){state.constraints=snapshot.constraints;state.messages=snapshot.messages;}savePlannerState();renderAssistant();});document.getElementById("assistantClear").addEventListener("click",()=>{const state=termPreferenceState();state.messages=[];state.constraints=[];state.undo=[];savePlannerState();renderAssistant();});

let onboardingFocusRestore=null;
function setOnboardingOpen(open,wasOpen=document.getElementById("onboarding").classList.contains("open")){const root=document.getElementById("onboarding");root.classList.toggle("open",open);root.setAttribute("aria-hidden",String(!open));[document.getElementById("app"),document.getElementById("page-courses"),document.querySelector(".pagenav")].filter(Boolean).forEach(node=>{node.inert=open;});if(open){if(!wasOpen)onboardingFocusRestore=document.activeElement;requestAnimationFrame(()=>root.querySelector("#onboardingContent button:not([disabled]), #onboardingContent input, #onboardingContent select, #onboardingContent textarea, #onboardingContent [tabindex]")?.focus());}else if(wasOpen){const restore=onboardingFocusRestore;onboardingFocusRestore=null;requestAnimationFrame(()=>{if(restore?.isConnected&&restore!==document.body)restore.focus();else document.getElementById("restartSetup")?.focus();});}}

function renderOnboarding(){
  const onboarding=ST.onboarding||{completed:false,step:0},root=document.getElementById("onboarding"),content=document.getElementById("onboardingContent"),step=Math.max(0,Math.min(4,Number(onboarding.step)||0));
  root.classList.toggle("open",!onboarding.completed);document.getElementById("onboardingSteps").setAttribute("aria-valuenow",String(step+1));document.getElementById("onboardingSteps").innerHTML=Array.from({length:5},(_,index)=>`<i class="onboarding-step-dot ${index<=step?"active":""}"></i>`).join("");
  const records=academicRecords(),layout=(title,text,body,options={})=>{content.innerHTML=`<h1 id="onboardingTitle">${title}</h1><p>${text}</p>${body}<div class="onboarding-actions"><button class="choice-btn secondary" id="onboardingBack" ${step===0?"disabled":""}>Back</button><div class="right">${options.skip?'<button class="choice-btn secondary" id="onboardingSkip">Skip</button>':""}<button class="choice-btn" id="onboardingNext">${options.next||"Continue"}</button></div></div>`;document.getElementById("onboardingBack").onclick=()=>{ST.onboarding.step=step-1;savePlannerState();renderOnboarding();};document.getElementById("onboardingSkip")?.addEventListener("click",()=>{ST.onboarding.step=step+1;savePlannerState();renderOnboarding();});document.getElementById("onboardingNext").onclick=()=>{if(step===4)ST.onboarding.completed=true;else ST.onboarding.step=step+1;savePlannerState();renderOnboarding();renderAll();};};
  if(step===0)return layout("Welcome to ScheduleRU","Account functionality is not enabled yet. Continue as a guest for now.","",{next:"Continue as guest"});
  if(step===1){const choices=AP.length?AP.map(ap=>{const score=ap.minimumScore===ap.maximumScore?String(ap.minimumScore):`${ap.minimumScore}-${ap.maximumScore}`;return `<label class="onboarding-record"><span><input type="checkbox" data-onboarding-ap="${html(ap.id)}" ${ST.apOn?.[ap.id]?"checked":""}/> ${html(ap.name)} (${html(score)})</span><span>${html(ap.credits)} credits</span></label>`;}).join(""):"<div class=\"onboarding-note\">Reviewed AP choices are loading.</div>";return layout("Add AP credit","Scores of 4 or 5 may count when a reviewed Rutgers equivalency applies.",`<div class="onboarding-records onboarding-records-scroll">${choices}</div>`,{skip:true});}
  if(step===2)return layout("Add completed coursework","Search by course name or enter a Rutgers course code.",`<div class="onboarding-fields onboarding-course-search"><label for="recordCourseSearch">Course code or search</label><input id="recordCourseSearch" autocomplete="off" aria-controls="recordCourseSearchResults" aria-autocomplete="list" placeholder="01:198:111 or Introduction to Computer Science"/><span id="recordCourseSearchStatus" class="onboarding-search-status" aria-live="polite">Start typing to search the Rutgers catalog.</span><div id="recordCourseSearchResults" class="onboarding-course-results" role="listbox" aria-label="Verified Rutgers course matches"></div></div><button class="choice-btn secondary" id="addCourseRecord">Add course</button><div class="onboarding-records">${records.filter(record=>record.type!=="ap").map(record=>`<div class="onboarding-record"><span>${html(record.courseCode)}${record.title?` · ${html(record.title)}`:""}</span><button class="choice-btn secondary" data-remove-record="${html(record.id)}">Remove</button></div>`).join("")}</div>`,{skip:true});
  if(step===3)return layout("Choose programs of study","Set your home school, then add a primary major, optional second major, and minors.",`<div class="onboarding-fields"><label>Home school<select id="onboardingHomeSchool">${(ST.availableSchools||[]).map(school=>`<option value="${html(school.slug)}" ${school.slug===ST.homeSchoolSlug?"selected":""}>${html(school.name||school.short_name||school.slug)}</option>`).join("")}</select></label></div><div class="onboarding-review">${selectedProgramRows().map(program=>`<div>${html(program.name)} · ${html(program.type)}</div>`).join("")||"<div>No program selected yet.</div>"}</div><button class="choice-btn secondary" id="onboardingPrograms">Add program of study</button>`);
  return layout("Ready to explore","Try out our strongest planning features:","<ul class=\"onboarding-feature-list\"><li>Try the four-year auto-planner for a balanced eight-semester draft.</li><li>Build a real semester schedule from verified Rutgers sections.</li><li>Refine schedule options with natural-language preferences.</li></ul>",{next:"Get started"});
}
const legacyRenderOnboarding=renderOnboarding;
renderOnboarding=function(){const wasOpen=document.getElementById("onboarding").classList.contains("open");legacyRenderOnboarding();setOnboardingOpen(!ST.onboarding?.completed,wasOpen);};
const baseSetOnboardingOpen=setOnboardingOpen;
setOnboardingOpen=function(open,wasOpen){document.getElementById("app").inert=open;document.getElementById("page-courses").inert=open;document.querySelector(".pagenav").inert=open;baseSetOnboardingOpen(open,wasOpen);};
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
  const input=document.getElementById("recordCourseSearch"),button=document.getElementById("addCourseRecord"),query=input?.value?.trim()||"";
  if(!query)return;
  if(button)button.disabled=true;
  const matches=await searchOnboardingCourses(query);
  const record=ScheduleRUCourseInteractionLogic.verifiedOnboardingCourse(matches,query);
  if(!record){
    renderOnboardingCourseSearchResults(query,matches,"Choose a verified Rutgers course from the catalog matches.");
    if(button)button.disabled=false;
    return;
  }
  addAcademicRecord({type:"rutgers_completed",courseCode:record.code,title:record.fullTitle||record.title,credits:Number(record.credits)||0});
  onboardingCourseMatches=[];
  renderOnboarding();
  renderAll();
}
document.addEventListener("input",event=>{if(event.target.id==="recordCourseSearch")scheduleOnboardingCourseSearch(event.target.value);});
document.addEventListener("click",event=>{const courseOption=event.target.closest("[data-record-course-option]");if(courseOption){const input=document.getElementById("recordCourseSearch");if(input)input.value=courseOption.dataset.recordCourseOption;addOnboardingCompletedCourse();return;}if(event.target.id==="addCourseRecord")addOnboardingCompletedCourse();if(event.target.matches("[data-remove-record]")){ST.academicRecords=academicRecords().filter(record=>record.id!==event.target.dataset.removeRecord);savePlannerState();renderOnboarding();renderAll();}if(event.target.id==="onboardingPrograms")openProgramPicker();});
document.getElementById("restartSetup").addEventListener("click",openRestartSetupConfirmation);
document.getElementById("onboardingRestart").addEventListener("click",openRestartSetupConfirmation);

const legacyRenderBuilder=renderBuilder;
renderBuilder=function(){legacyRenderBuilder();const root=document.getElementById("builderRoot"),header=root.querySelector(".builder-hdr");if(header){const control=document.createElement("button");control.className="schedule-assistant-toggle";control.textContent="Schedule assistant";control.onclick=()=>{document.getElementById("assistantDrawer").classList.add("open");renderAssistant();};header.append(control);}root.querySelectorAll(".pool-sec-row").forEach(row=>{if(row.querySelector(".status-closed"))row.hidden=!ST.builder?.includeClosed;});const pool=root.querySelector("#poolList");if(pool){const label=document.createElement("label");label.className="include-closed";label.innerHTML=`<input type="checkbox" ${ST.builder?.includeClosed?"checked":""}/> Include closed sections`;label.querySelector("input").onchange=event=>{ST.builder.includeClosed=event.target.checked;renderBuilder();};pool.before(label);}};
const originalRecompute=recomputeBuilderPermutations;
recomputeBuilderPermutations=function(){originalRecompute();(ST.builder?.permutations||[]).forEach((combo,index)=>{combo.stableIndex=index+1;});};
function sectionIsOpen(section){return section?.open_status===true||section?.open_status===1||section?.open_status==="1";}
function setBuilderIncludeClosed(includeClosed){if(!ST.builder)return;ST.builder.includeClosed=includeClosed;ST.builder.pool.forEach(pool=>{pool.autoIncludedClosed||=new Set();(pool.sections||[]).forEach(section=>{if(sectionIsOpen(section))return;const index=section.index_number;if(includeClosed){if(!pool.checked.has(index)){pool.checked.add(index);pool.autoIncludedClosed.add(index);}}else if(pool.autoIncludedClosed.has(index)){pool.checked.delete(index);pool.autoIncludedClosed.delete(index);}});});recomputeBuilderPermutations();renderBuilder();}
const legacyRenderBuilderWithClosed=renderBuilder;
renderBuilder=function(){legacyRenderBuilderWithClosed();const toggle=document.querySelector(".include-closed input");if(toggle)toggle.onchange=event=>setBuilderIncludeClosed(event.target.checked);};

function plannerTermsFromAcademicPosition(){const terms=[];let year=Math.min(4,Math.max(1,Number(ST.academicPosition?.year)||1)),sem=ST.academicPosition?.startingSemester==="spring"?"spring":"fall";while(terms.length<8){terms.push({year,sem});if(sem==="fall")sem="spring";else{year+=1;sem="fall";}}return terms;}
plannerTerms=plannerTermsFromAcademicPosition;
function plannerKnownCourseCodes(){return new Set([...completedAcademicCodes(),...Object.values(ST.schedule||{}).map(entry=>entry.code).filter(Boolean)]);}
function plannerLeafGroups(tree){return Object.values(tree?.groups||{}).filter(group=>(group.children||[]).length===0||(group.members||[]).length>0);}
function plannerRequirementInputs(tree,{sourceType,sourceProgram=""}={}){const known=plannerKnownCourseCodes(),selectedByGroup=ST.groupSelections||{},coursesByCode=new Map(),placeholders=[];for(const group of plannerLeafGroups(tree)){const members=group.members||[],selected=members.filter(id=>selectedByGroup[group.id]?.includes(id)||known.has(tree.courses?.[id]?.code)),required=group.rule==="all"?members.length:Math.max(1,Number(group.count)||1),concrete=sourceType==="core"?selected:(group.rule==="all"?members:selected);concrete.forEach(id=>{const course=tree.courses?.[id];if(course?.code&&!known.has(course.code))coursesByCode.set(course.code,course);});if(selected.length<required&&(sourceType==="core"||group.rule!=="all"))placeholders.push({id:group.id,label:groupDisplayName(group),credits:3,sourceType:sourceType||"program",sourceProgram,requirementGroupId:group.id,candidateSelectionContext:{rule:group.rule,required}});}return {courses:[...coursesByCode.values()],placeholders};}
function corePlannerStatus(){const inputs=plannerRequirementInputs(ST.coreRequirementTree,{sourceType:"core",sourceProgram:ST.activeCoreCurriculum?.id||"core"});return {...inputs,incomplete:inputs.placeholders.length>0};}
normalizedPlannerInputs=function(){
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
};
const checkedGeneratePlanButton=document.getElementById("generatePlanBtn"),coreAwareGeneratePlanButton=checkedGeneratePlanButton.cloneNode(true);checkedGeneratePlanButton.replaceWith(coreAwareGeneratePlanButton);
function finishPlanGenerationPreflight(){ST.planGenerationPending=false;coreAwareGeneratePlanButton.disabled=false;}
async function beginPlanGenerationPreflight(){
  if(globalThis.ScheduleRUPlannerUI.generationPreflight({busy:ST.planGenerationPending,coreIncomplete:false})==="ignore")return;
  ST.planGenerationPending=true;coreAwareGeneratePlanButton.disabled=true;
  if(!ST.coreRequirementTree&&!ST.coreLoading)await loadCoreCurriculum();
  if(!ST.coreRequirementTree){
    finishPlanGenerationPreflight();
    modalController.show({title:"Core requirements unavailable",body:"<p>The reviewed Core requirements could not be loaded, so ScheduleRU did not generate an incomplete plan. Try again after the connection recovers.</p>",actions:[{label:"Close",secondary:true}]});
    return;
  }
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
      {label:decision==="warn"?"I understand":"Generate preview",onClick:()=>{finishPlanGenerationPreflight();generateFourYearPlan();}},
    ],
  });
}
coreAwareGeneratePlanButton.addEventListener("click",beginPlanGenerationPreflight);

loadHackathonConfiguration();renderOnboarding();renderAll();
