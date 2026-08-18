(function exposeRequirementPickerController(root) {
  function create({
    getState,
    document,
    requestAnimationFrame,
    setTimeout,
    clearTimeout,
    pageSize = 50,
    getGroup,
    getCourse,
    selectorsForGroup,
    groupDisplayName,
    groupRuleLabel,
    isConstraintGroup,
    selectedCourseIds,
    appliedCourseIds,
    selectionLimit,
    registerSelectorCourseRecord,
    loadSelectorCourses,
    courseRecordFromId,
    plannerUI,
    escapeHtml,
    courseCreditsLabel,
    constraintViolation,
    showSelectionReview,
    commitSelection,
    toggleWishlist,
    renderAll,
    openCourseDetails,
    userMessageModel,
  } = {}) {
    let bound = false;
    let focusRestore = null;
    let searchTimer = null;

    function state() {
      return getState?.() || {};
    }

    function pickerRoot() {
      return document.getElementById("pickerOv");
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

    function setOpen(open, { restoreFocus = true } = {}) {
      const rootElement = pickerRoot();
      if (open) {
        if (!focusRestore) focusRestore = document.activeElement;
        rootElement.classList.add("open");
      } else {
        rootElement.classList.remove("open");
      }
      rootElement.setAttribute("aria-hidden", String(!open));
      setBackgroundInert(open);
      if (open) {
        requestAnimationFrame(() => document.getElementById("pickerSearch")?.focus());
        return;
      }
      if (!restoreFocus) return;
      const restore = focusRestore;
      focusRestore = null;
      requestAnimationFrame(() => {
        if (restore?.isConnected && restore !== document.body) restore.focus();
      });
    }

    function cancelSearch() {
      if (searchTimer !== null) clearTimeout(searchTimer);
      searchTimer = null;
    }

    function close() {
      const current = state();
      cancelSearch();
      if (current.pickerSelector) current.pickerSelector.requestGeneration += 1;
      current.pickerGroupId = null;
      current.pickerSelector = null;
      current.returnToPicker = false;
      setOpen(false);
    }

    function suspend() {
      setOpen(false, { restoreFocus: false });
    }

    function resume() {
      if (!getGroup(state().pickerGroupId)) return false;
      setOpen(true);
      render();
      return true;
    }

    async function load() {
      const current = state();
      const selectorState = current.pickerSelector;
      const group = getGroup(current.pickerGroupId);
      if (!selectorState || !group || selectorState.groupId !== group.id) return;
      const generation = selectorState.requestGeneration + 1;
      selectorState.requestGeneration = generation;
      selectorState.loading = true;
      selectorState.error = "";
      render();
      try {
        const response = await loadSelectorCourses({
          search: selectorState.search || "",
          limit: pageSize,
          offset: (selectorState.page - 1) * pageSize,
          selectors: selectorsForGroup(group),
        });
        if (state().pickerSelector !== selectorState || selectorState.requestGeneration !== generation) return;
        selectorState.records = (response?.records || response?.courses || []).filter(Boolean);
        selectorState.records.forEach(registerSelectorCourseRecord);
        selectorState.total = Number(response?.total) || selectorState.records.length;
      } catch (error) {
        if (state().pickerSelector === selectorState && selectorState.requestGeneration === generation) {
          selectorState.error = userMessageModel.presentIssue(error).message;
        }
      } finally {
        if (state().pickerSelector === selectorState && selectorState.requestGeneration === generation) {
          selectorState.loading = false;
          render();
        }
      }
    }

    function render() {
      const current = state();
      const group = getGroup(current.pickerGroupId);
      if (!group) return;
      const selected = selectedCourseIds(group.id);
      const applied = appliedCourseIds(group);
      const limit = selectionLimit(group);
      const constraints = (group.children || []).map(getGroup).filter(isConstraintGroup);
      const search = String(document.getElementById("pickerSearch")?.value || "").trim().toLowerCase();
      document.getElementById("pickerIntro").textContent = group.rule === "distinct"
        ? `Choose ${limit} approved courses that cover ${group.count} distinct Arts and Humanities learning goals. Save any course here to your Wishlist without changing the requirement choice.`
        : `Scheduled, completed, and shared selected courses apply automatically. Choose up to ${Math.max(0, limit - applied.length)} additional approved ${limit === 1 ? "course" : "courses"} for this requirement.${constraints.length ? ` Your choices must also satisfy: ${constraints.map((child) => `${groupDisplayName(child)} (${groupRuleLabel(child)})`).join("; ")}.` : ""} Chosen courses are also saved to your Wishlist.`;
      const selectorState = current.pickerSelector;
      const sourceIds = selectorState
        ? selectorState.records.map(registerSelectorCourseRecord).filter(Boolean)
        : (group.members || []);
      const ids = sourceIds.filter((id) => {
        const course = getCourse(id);
        return course && (!search || `${course.code} ${course.title} ${course.fullTitle || ""}`.toLowerCase().includes(search));
      });
      const list = document.getElementById("pickerList");
      if (selectorState?.loading) {
        list.innerHTML = `<div class="loading">Loading approved courses…</div>`;
      } else if (selectorState?.error) {
        list.innerHTML = `<div class="api-status err">${escapeHtml(selectorState.error)}</div><div class="choice-actions"><button class="choice-btn" id="pickerRetry">Retry</button></div>`;
      } else {
        list.innerHTML = ids.length ? ids.map((id) => {
          const course = getCourse(id);
          const picked = selected.includes(id);
          const alreadyApplied = applied.includes(id);
          const canSelect = new Set([...applied, ...selected]).size < limit;
          const action = plannerUI.pickerActions({
            alreadyApplied,
            selected: picked,
            canSelect,
            inWishlist: !!current.wishlist?.[course.code],
          });
          return `<div class="picker-row${picked || alreadyApplied ? " selected" : ""}">
            <div><div class="picker-code">${escapeHtml(course.code)}</div><div class="picker-name">${escapeHtml(course.fullTitle || course.title)}</div><div class="picker-meta">${escapeHtml(courseCreditsLabel(course.credits))}</div></div>
            <div class="picker-actions"><button class="picker-btn view" data-pview="${escapeHtml(id)}">Details</button><button class="picker-btn${action.intent === "wishlist" ? " secondary" : ""}${action.intent === "wishlist" && action.selected ? " wishlist-active" : ""}" data-paction="${escapeHtml(id)}" data-pintent="${action.intent}" ${action.disabled ? "disabled" : ""}>${action.label}</button></div>
          </div>`;
        }).join("") : `<div class="api-status">No approved course matches that search.</div>`;
      }
      if (selectorState && !selectorState.loading && !selectorState.error) {
        const pages = Math.max(1, Math.ceil(selectorState.total / pageSize));
        list.insertAdjacentHTML("beforeend", `<div class="pager"><button id="pickerPrev" ${selectorState.page <= 1 ? "disabled" : ""}>← Prev</button><span class="pg-info">Page ${selectorState.page} of ${pages}</span><button id="pickerNext" ${selectorState.page >= pages ? "disabled" : ""}>Next →</button></div>`);
      }
      document.getElementById("pickerRetry")?.addEventListener("click", load);
      document.getElementById("pickerPrev")?.addEventListener("click", () => {
        selectorState.page -= 1;
        load();
      });
      document.getElementById("pickerNext")?.addEventListener("click", () => {
        selectorState.page += 1;
        load();
      });
      list.querySelectorAll("[data-pview]").forEach((button) => button.addEventListener("click", () => {
        current.returnToPicker = true;
        suspend();
        openCourseDetails(button.dataset.pview);
      }));
      list.querySelectorAll("[data-paction]").forEach((button) => button.addEventListener("click", () => {
        const id = button.dataset.paction;
        const record = courseRecordFromId(id);
        if (button.dataset.pintent === "wishlist") {
          if (record?.code) toggleWishlist(record);
          renderAll();
          render();
          return;
        }
        const activeGroup = getGroup(state().pickerGroupId);
        if (!activeGroup || activeGroup.id !== group.id) return;
        const currentSelection = selectedCourseIds(group.id);
        const currentlyApplied = appliedCourseIds(group);
        if (currentlyApplied.includes(id)) return;
        if (currentSelection.includes(id)) {
          commitSelection(group.id, currentSelection.filter((item) => item !== id), null);
        } else if (new Set([...currentlyApplied, ...currentSelection]).size < limit) {
          const proposed = [...currentSelection, id];
          const violation = constraintViolation(group, proposed);
          if (violation) {
            showSelectionReview(violation);
            return;
          }
          commitSelection(group.id, proposed, record);
        }
        renderAll();
        render();
      }));
    }

    function open(groupId) {
      const current = state();
      const group = getGroup(groupId);
      if (!group) return false;
      const selectors = selectorsForGroup(group);
      if (!(group.members || []).length && !selectors.length) return false;
      current.pickerGroupId = groupId;
      current.pickerSelector = selectors.length ? {
        groupId,
        records: [],
        loading: false,
        error: "",
        page: 1,
        total: 0,
        search: "",
        requestGeneration: 0,
      } : null;
      document.getElementById("pickerTitle").textContent = groupDisplayName(group);
      document.getElementById("pickerSearch").value = "";
      setOpen(true);
      render();
      if (current.pickerSelector) load();
      return true;
    }

    function bind() {
      if (bound) return;
      bound = true;
      document.getElementById("pickerClose").addEventListener("click", close);
      document.getElementById("pickerSearch").addEventListener("input", (event) => {
        const selectorState = state().pickerSelector;
        if (!selectorState) {
          render();
          return;
        }
        selectorState.requestGeneration += 1;
        selectorState.search = event.target.value;
        selectorState.page = 1;
        cancelSearch();
        searchTimer = setTimeout(load, 250);
      });
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !pickerRoot().classList.contains("open")) return;
        if (document.getElementById("appModal")?.classList.contains("open")) return;
        event.preventDefault();
        close();
      });
      pickerRoot().addEventListener("click", (event) => {
        if (event.target === pickerRoot()) close();
      });
    }

    return { bind, close, load, open, render, resume, suspend };
  }

  root.ScheduleRURequirementPickerController = { create };
})(globalThis);
