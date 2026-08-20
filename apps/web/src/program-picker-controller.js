(function exposeProgramPickerController(root) {
  function create({
    getState,
    document,
    requestAnimationFrame,
    pickerLogic,
    plannerUI,
    escapeHtml,
    cleanText,
    getProgramTypeSections,
    programTypeLabel,
    programCoverageLabel,
    selectionLimitSummary,
    showFeedback,
    onApply,
  } = {}) {
    let bound = false;
    let focusRestore = null;

    function state() {
      return getState?.() || {};
    }

    function pickerRoot() {
      return document.getElementById("programOv");
    }

    function setBackgroundInert(open) {
      const current = state();
      [
        document.getElementById("app"),
        document.getElementById("page-courses"),
        document.querySelector(".pagenav"),
      ].filter(Boolean).forEach((node) => {
        node.inert = open || !current.onboarding?.completed;
      });
      const onboarding = document.getElementById("onboarding");
      if (onboarding) onboarding.inert = open;
    }

    function setOpen(open) {
      const rootElement = pickerRoot();
      const dialog = rootElement.querySelector("[role=dialog]");
      if (open) {
        focusRestore = document.activeElement;
        rootElement.classList.add("open");
      } else {
        rootElement.classList.remove("open");
      }
      rootElement.setAttribute("aria-hidden", String(!open));
      setBackgroundInert(open);
      if (open) {
        requestAnimationFrame(() => dialog.querySelector("input, select, button:not([disabled])")?.focus());
        return;
      }
      const restore = focusRestore;
      focusRestore = null;
      requestAnimationFrame(() => {
        if (restore?.isConnected && restore !== document.body) {
          restore.focus();
          return;
        }
        const fallback = !state().onboarding?.completed
          ? document.getElementById("onboardingPrograms")
          : document.getElementById("programBtn");
        fallback?.focus();
      });
    }

    function renderRoles() {
      const current = state();
      const controls = document.getElementById("programRoleControls");
      if (!current.programBrowseSchoolSlug) {
        controls.innerHTML = "";
        return;
      }
      const byId = new Map((current.availablePrograms || []).map((program) => [program.id, program]));
      const view = pickerLogic.programDraftView({
        draftIds: current.programDraft,
        primaryId: current.programDraftPrimaryId,
        programs: current.availablePrograms,
      });
      current.programDraft = view.selectedIds;
      current.programDraftPrimaryId = view.primaryId;
      controls.innerHTML = view.majorIds.length
        ? `<div class="onboarding-note program-role-summary"><b>Major roles</b>${view.majorIds.map((id) => `<div class="program-role-row"><span><strong>${escapeHtml(byId.get(id)?.name || id)}</strong><small>${id === view.primaryId ? "Primary major" : "Secondary major"}</small></span>${id === view.primaryId ? "" : `<button class="program-role-action" data-draft-primary="${escapeHtml(id)}">Make primary</button>`}</div>`).join("")}</div>`
        : "";
      controls.querySelectorAll("[data-draft-primary]").forEach((button) => button.addEventListener("click", () => {
        current.programDraftPrimaryId = button.dataset.draftPrimary;
        render();
      }));
    }

    function render() {
      const current = state();
      const list = document.getElementById("programList");
      const nav = document.getElementById("programSchoolNav");
      const search = document.getElementById("programSearch");
      const schoolChoices = plannerUI.programSchoolChoices({
        schools: current.availableSchools || [],
        programs: current.availablePrograms || [],
      });
      nav.innerHTML = schoolChoices.map((school) => `<button type="button" data-program-school="${escapeHtml(school.slug)}" class="${school.slug === current.programBrowseSchoolSlug ? "active" : ""}">${escapeHtml(school.label)}</button>`).join("");
      nav.querySelectorAll("[data-program-school]").forEach((button) => button.addEventListener("click", () => {
        current.programBrowseSchoolSlug = button.dataset.programSchool;
        current.programSearch = "";
        search.value = "";
        render();
      }));
      search.hidden = !current.programBrowseSchoolSlug;
      if (!current.programBrowseSchoolSlug) {
        list.innerHTML = `<div class="api-status">Choose a school to browse its available programs.</div>`;
        renderRoles();
        return;
      }
      const visiblePrograms = plannerUI.programsForBrowse({
        programs: current.availablePrograms || [],
        schoolSlug: current.programBrowseSchoolSlug,
        query: current.programSearch || "",
      });
      const categories = getProgramTypeSections().map((section) => ({
        ...section,
        programs: visiblePrograms.filter((program) => program.type === section.type),
      })).filter((section) => section.programs.length);
      list.innerHTML = categories.map((section) => `<section class="program-category">
        <h3 class="program-category-title">${escapeHtml(section.label)}</h3>
        ${section.programs.map((program) => {
          const degreeType = cleanText(program.degree_type);
          const metadata = [programTypeLabel(program.type), programCoverageLabel(program), degreeType].filter(Boolean).join(" · ");
          return `<label class="program-option">
            <input type="checkbox" data-program-choice="${escapeHtml(program.id)}" ${(current.programDraft || []).includes(program.id) ? "checked" : ""}/>
            <span><strong>${escapeHtml(program.name)}</strong><small>${escapeHtml(metadata)}</small></span>
          </label>`;
        }).join("")}
      </section>`).join("") || `<div class="api-status">No programs match that search for the selected school.</div>`;
      list.querySelectorAll("[data-program-choice]").forEach((input) => input.addEventListener("change", () => {
        const draft = new Set(current.programDraft || []);
        if (input.checked) draft.add(input.dataset.programChoice);
        else draft.delete(input.dataset.programChoice);
        current.programDraft = [...draft];
        render();
      }));
      renderRoles();
    }

    function open() {
      const current = state();
      current.programDraft = [...(current.selectedPrograms || [])];
      current.programDraftPrimaryId = current.primaryProgramId;
      current.programSearch = "";
      current.programBrowseSchoolSlug = "";
      document.getElementById("programPickerNote").textContent = `Choose a school, then select its majors and minors. Only reviewed programs show a requirement tree. ${selectionLimitSummary()} Your home school stays unchanged.`;
      showFeedback?.(null);
      const search = document.getElementById("programSearch");
      search.value = "";
      render();
      setOpen(true);
    }

    function close() {
      delete state().programDraft;
      setOpen(false);
    }

    function bind() {
      if (bound) return;
      bound = true;
      document.getElementById("programBtn").addEventListener("click", open);
      document.getElementById("programClose").addEventListener("click", close);
      document.getElementById("programCancel").addEventListener("click", close);
      document.getElementById("programApply").addEventListener("click", () => onApply?.());
      document.getElementById("programSearch").addEventListener("input", (event) => {
        state().programSearch = event.target.value.trim().toLowerCase();
        render();
      });
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!pickerRoot().classList.contains("open")) return;
        if (document.getElementById("appModal").classList.contains("open")) return;
        if (state().programApplyPending) return;
        event.preventDefault();
        close();
      });
      pickerRoot().addEventListener("click", (event) => {
        if (event.target === pickerRoot() && !state().programApplyPending) close();
      });
    }

    return { bind, open, close, render };
  }

  root.ScheduleRUProgramPickerController = { create };
})(globalThis);
