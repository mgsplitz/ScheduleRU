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
    expansionOpen,
    openRequirementPicker,
    showIssues,
    renderPanel,
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
      if (current.requirementsError) return `<div class="api-status err">Could not load degree requirements: ${escapeHtml(current.requirementsError)}</div>`;

      useRequirementTree(current.majorRequirementTree);
      const programs = orderedPrograms();
      if (!current.requiredProgramTab || !programs.some((program) => program.id === current.requiredProgramTab)) {
        current.requiredProgramTab = programs[0]?.id || "";
      }
      const count = issueList().length;
      const subtabs = programs.map((program) => `<button class="program-subtab ${program.id === current.requiredProgramTab ? "active" : ""} ${program.type === "minor" ? "program-subtab-minor" : ""}" data-required-program="${escapeHtml(program.id)}">${escapeHtml(program.name)}</button>`).join("");
      const requirementState = getRequirementState();
      const selectedMajorIds = programs.filter((program) => program.type === "major").map((program) => program.id);
      const groups = requirementState.rootGroupIds
        .map((id) => requirementState.groups[id])
        .filter(Boolean)
        .filter((group) => groupBelongsToProgram(group, current.requiredProgramTab));
      let content = groups.map((group) => {
        const defaultOpen = !shouldAutoCollapseSharedGroup({ group, selectedMajorIds });
        const open = expansionOpen({ stored: current.requiredRootOpen[group.id], defaultOpen });
        return rootGroupMarkup(group, !open);
      }).join("");
      if (!content) content = `<div class="empty" style="margin-top:30px;">No reviewed requirements are available for this program yet.</div>`;
      return `<div class="required-tools"><span class="leg">Reviewed requirements for this program.</span><button class="issues-btn" id="issuesBtn">Issues · ${count}</button></div><div class="subtabs">${subtabs}</div>${content}<div class="planning-disclaimer">ScheduleRU is a planning aid, not an official degree audit.</div>`;
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

    return { render, markup, orderedPrograms, groupBelongsToProgram, setProgram };
  }

  root.ScheduleRURequiredPanelController = { create };
})(globalThis);
