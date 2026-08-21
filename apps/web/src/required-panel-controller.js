/* Required-program tabs, requirement-root presentation, and browser actions. */
(function exposeRequiredPanelController(root) {
  function create({
    getState,
    document,
    selectedProgramRows,
    useRequirementTree,
    getRequirementState,
    issueList,
    escapeHtml,
    groupHtml,
    groupDisplayName,
    groupAppliedCourseIds,
    selectorGuidanceHtml,
    cardHtml,
    attachCardEvents,
    shouldAutoCollapseSharedGroup,
    groupFulfilled,
    expansionOpen,
    openRequirementPicker,
    showIssues,
    renderPanel,
    userMessageModel,
    programRequirementModel,
  } = {}) {
    function state() { return getState?.() || {}; }

    function orderedPrograms() {
      const current = state();
      const rows = selectedProgramRows();
      const byId = new Map(rows.map((program) => [program.id, program]));
      const ids = [current.primaryProgramId, current.secondaryProgramId, ...rows.map((program) => program.id)]
        .filter((id, index, list) => id && list.indexOf(id) === index);
      return ids.map((id) => byId.get(id)).filter(Boolean);
    }

    function treeIncludesSourceProgram(roots, sourceProgramId) {
      return (roots || []).some((entry) =>
        entry?.program_id === sourceProgramId
        || treeIncludesSourceProgram(entry?.children, sourceProgramId)
      );
    }

    function groupBelongsToProgram(group, programId) {
      const explicitOwners = group?.sourceProgramIds;
      if (Array.isArray(explicitOwners) && explicitOwners.length) return explicitOwners.includes(programId);
      return !group?.sourceProgramId
        || group.sourceProgramId === programId
        || treeIncludesSourceProgram(state().requirementTrees?.[programId], group.sourceProgramId);
    }

    function isSharedGroup(group) {
      return !!String(group?.display_family || "").trim()
        || (Array.isArray(group?.sourceProgramIds) && group.sourceProgramIds.length > 1);
    }

    function rootGroupMarkup(group, collapsed) {
      if (group.rule !== "all") return groupHtml(group.id);
      const applied = groupAppliedCourseIds(group);
      const members = (group.members || []).filter((id) => !applied.includes(id));
      const body = `${selectorGuidanceHtml(group)}${applied.length ? `<div class="choice-picked"><strong style="font-size:10px;">Applied here</strong><div class="cgrid">${applied.map(cardHtml).join("")}</div></div>` : ""}${members.length ? `<div class="cgrid">${members.map(cardHtml).join("")}</div>` : ""}${(group.children || []).map(groupHtml).join("")}`;
      return `<section class="required-root"><button class="required-root-hdr" data-required-root-toggle="${escapeHtml(group.id)}" aria-expanded="${String(!collapsed)}"><span>${escapeHtml(groupDisplayName(group))}</span><span>${collapsed ? "Show" : "Hide"}</span></button><div class="required-root-body${collapsed ? "" : " open"}" id="required-root-${escapeHtml(group.id)}">${body}</div></section>`;
    }

    function markup() {
      const current = state();
      if (current.requirementsLoading) return `<div class="empty" style="margin-top:30px;">Loading requirements from Rutgers…</div>`;
      if (current.requirementsError) {
        const shown = userMessageModel.presentIssue(current.requirementsError);
        return `<div class="api-status err"><strong>${escapeHtml(shown.title)}</strong><span>${escapeHtml(shown.message)}</span></div>`;
      }

      useRequirementTree(current.majorRequirementTree);
      const programs = orderedPrograms().map((program) => ({
        ...program,
        role: program.id === current.primaryProgramId
          ? "primary"
          : program.id === current.secondaryProgramId ? "secondary" : undefined,
      }));
      const count = issueList().length;
      const requirementState = getRequirementState();
      const rootGroups = requirementState.rootGroupIds.map((id) => requirementState.groups[id]).filter(Boolean);
      const sharedGroups = rootGroups.filter(isSharedGroup);
      const homeSchool = (current.availableSchools || []).find((school) => school.slug === current.homeSchoolSlug)
        || { slug: current.homeSchoolSlug };
      const tabs = programRequirementModel.requirementTabs({ homeSchool, programs, sharedRoots: sharedGroups });
      if (!current.requiredProgramTab || !tabs.some((tab) => tab.id === current.requiredProgramTab)) {
        current.requiredProgramTab = tabs[0]?.id || "";
      }
      const activeTab = tabs.find((tab) => tab.id === current.requiredProgramTab);
      const activeTabIndex = tabs.findIndex((tab) => tab.id === current.requiredProgramTab);
      const nextTab = activeTabIndex >= 0 ? tabs[activeTabIndex + 1] : null;
      const subtabs = tabs.map((tab) => `<button class="program-subtab ${tab.id === current.requiredProgramTab ? "active" : ""} ${tab.minor ? "program-subtab-minor" : ""}" data-required-program="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</button>`).join("");
      const selectedMajorIds = programs.filter((program) => program.type === "major").map((program) => program.id);
      const groups = rootGroups.filter((group) => activeTab?.kind === "shared"
        ? isSharedGroup(group)
        : !isSharedGroup(group) && groupBelongsToProgram(group, current.requiredProgramTab));
      const actions = programRequirementModel.nextActions(groups.map((group, index) => ({
        id: group.id,
        label: groupDisplayName(group),
        complete: groupFulfilled?.(group.id) === true,
        priority: index,
      })));
      const firstActionableId = actions[0]?.id || "";
      let content = groups.map((group) => {
        const defaultOpen = activeTab?.kind === "shared"
          || (group.id === firstActionableId && !shouldAutoCollapseSharedGroup({ group, selectedMajorIds }));
        const open = expansionOpen({ stored: current.requiredRootOpen[group.id], defaultOpen });
        return rootGroupMarkup(group, !open);
      }).join("");
      if (!content) content = `<div class="api-status err" style="margin-top:30px;"><strong>We couldn't display these requirements</strong><span>Refresh the page or reopen Programs. Your saved plan has not changed.</span></div>`;
      const nextUp = nextTab
        ? `<section class="required-next"><button type="button" data-required-next-tab="${escapeHtml(nextTab.id)}"><strong>Next up</strong><span>Required ${escapeHtml(nextTab.label)} courses</span><span aria-hidden="true">→</span></button></section>`
        : actions.length
          ? `<section class="required-next"><strong>Next up</strong><ol>${actions.map((action) => `<li>${escapeHtml(action.label)}</li>`).join("")}</ol></section>`
        : `<section class="required-next complete"><strong>You're caught up here</strong><span>No unfinished reviewed requirement is visible in this tab.</span></section>`;
      return `<div class="required-tools"><button class="issues-btn" id="issuesBtn">Issues · ${count}</button></div><div class="subtabs">${subtabs}</div>${nextUp}${content}<div class="planning-disclaimer">ScheduleRU is a planning aid, not an official degree audit.</div>`;
    }

    function setProgram(programId) {
      const current = state();
      if (current.requiredProgramTab !== programId) {
        current.requiredRootOpen = {};
        current.nestedGroupOpen = {};
      }
      current.requiredProgramTab = programId;
      renderPanel();
    }

    function bind(panel) {
      const current = state();
      attachCardEvents(panel);
      panel.querySelectorAll("[data-required-program]").forEach((button) => button.addEventListener("click", () => setProgram(button.dataset.requiredProgram)));
      panel.querySelector("[data-required-next-tab]")?.addEventListener("click", (event) => setProgram(event.currentTarget.dataset.requiredNextTab));
      panel.querySelectorAll("[data-required-root-toggle]").forEach((button) => button.addEventListener("click", () => {
        const groupId = button.dataset.requiredRootToggle;
        const body = panel.querySelector(`#required-root-${groupId}`);
        const open = body?.classList.toggle("open");
        current.requiredRootOpen[groupId] = !!open;
        button.setAttribute("aria-expanded", String(!!open));
        button.lastElementChild.textContent = open ? "Hide" : "Show";
      }));
      panel.querySelectorAll("[data-gtog]").forEach((toggle) => {
        const groupId = toggle.dataset.gtog;
        const body = panel.querySelector(`#gb-${groupId}`);
        const open = expansionOpen({ stored: current.nestedGroupOpen[groupId], defaultOpen: true });
        body?.classList.toggle("open", open);
        toggle.addEventListener("click", () => {
          const next = body?.classList.toggle("open");
          current.nestedGroupOpen[groupId] = !!next;
        });
      });
      panel.querySelectorAll("[data-gpicker], [data-gbrowse]").forEach((button) => button.addEventListener("click", (event) => {
        event.stopPropagation();
        openRequirementPicker(button.dataset.gpicker || button.dataset.gbrowse);
      }));
      panel.querySelectorAll("[data-gclear]").forEach((button) => button.addEventListener("click", () => {
        delete current.groupSelections[button.dataset.gclear];
        renderPanel();
      }));
      panel.querySelector("#issuesBtn")?.addEventListener("click", showIssues);
    }

    function render() {
      const panel = document?.getElementById("pb");
      if (!panel) return;
      panel.innerHTML = markup();
      if (!state().requirementsLoading && !state().requirementsError) bind(panel);
    }

    return { render, markup, orderedPrograms, groupBelongsToProgram, isSharedGroup, setProgram };
  }

  root.ScheduleRURequiredPanelController = { create };
})(globalThis);
