/*
 * Course catalog page lifecycle. This controller owns remote catalog loading,
 * filtering, pagination, lazy section expansion, wishlist controls, and view
 * restoration while the planner supplies shared storage and record adapters.
 */
(function exposeCatalogPageController(root) {
  function create({
    getState,
    document,
    requestAnimationFrame,
    setTimeout,
    clearTimeout,
    pageSize,
    request,
    saveBackendUrl,
    selectorContext,
    loadEligibilityForCodes,
    catalogCourseCode,
    backendCourseRecord,
    wishlistRecords,
    addToWishlist,
    saveState,
    plannerUI,
    selectorLogic,
    interactionLogic,
    escapeHtml,
    cleanText,
    courseCreditsLabel,
    formatMeeting,
    groupDisplayName,
  } = {}) {
    let courseRequestGeneration = 0;
    let metadataRequestGeneration = 0;

    function state() {
      return getState?.() || {};
    }

    function timeAgo(timestamp) {
      if (!timestamp) return "never";
      const minutes = Math.round((Date.now() - timestamp) / 60000);
      if (minutes < 1) return "just now";
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.round(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.round(hours / 24)}d ago`;
    }

    function connectionBarHtml(current) {
      return `
        <div class="cp-connect">
          <input id="cpUrl" placeholder="https://your-worker.workers.dev" value="${escapeHtml(current.backendUrl || "")}"/>
          <button class="add-btn" id="cpConnect">${current.backendUrl ? "Update" : "Connect"}</button>
          ${current.backendUrl ? `<a href="${escapeHtml(current.backendUrl)}/api/sync-status" target="_blank" rel="noopener" class="cp-connect-testlink">Open ↗</a>` : ""}
          <span class="cp-connect-status ${current.backendUrl && !current.backendError ? "ok" : ""}">${
            current.backendUrl
              ? (current.backendError ? `⚠ ${escapeHtml(current.backendError)}` : "● Connected")
              : "Not connected"
          }</span>
        </div>`;
    }

    function sectionTableHtml(course, sections) {
      return sections.length ? `<table class="sec-table">
        <thead><tr><th>Sec</th><th>Status</th><th>Index</th><th>Meeting</th><th>Instructor</th></tr></thead>
        <tbody>${sections.map((section) => {
          const extras = [];
          if (cleanText(section.notes)) extras.push(`<div class="row"><b>Notes:</b> ${escapeHtml(cleanText(section.notes))}</div>`);
          if (cleanText(section.restrictions)) extras.push(`<div class="row"><b>Restrictions:</b> ${escapeHtml(cleanText(section.restrictions))}</div>`);
          if (cleanText(section.comments)) extras.push(`<div class="row"><b>Comments:</b> ${escapeHtml(cleanText(section.comments))}</div>`);
          if (cleanText(section.open_to)) extras.push(`<div class="row"><b>Open To:</b> ${escapeHtml(cleanText(section.open_to))}</div>`);
          return `<tr>
            <td>${escapeHtml(section.section_number || section.index_number || "")}</td>
            <td class="${section.open_status ? "status-open" : "status-closed"}">${section.open_status ? "OPEN" : "CLOSED"}</td>
            <td>${escapeHtml(section.index_number || "")}</td>
            <td>${(section.meetings || []).map(formatMeeting).map(escapeHtml).join("<br/>") || "—"}</td>
            <td>${escapeHtml(section.instructor || "—")}</td>
          </tr>${extras.length ? `<tr class="sec-extra"><td colspan="5">${extras.join("")}</td></tr>` : ""}`;
        }).join("")}</tbody>
      </table>` : `<div class="api-status">No sections found for this course.</div>`;
    }

    function courseRowHtml(course) {
      const current = state();
      const code = catalogCourseCode(course);
      const saved = wishlistRecords().some((item) => item.code === code);
      const wishlistAction = plannerUI.catalogWishlistAction({ inWishlist: saved });
      const isOpen = current.expandedIds.has(course.id);
      const openCount = course.open_count ?? 0;
      const totalCount = course.section_count ?? 0;
      let bodyHtml = "";
      if (isOpen) {
        const cached = current.sectionsCache[course.id];
        if (!cached) {
          bodyHtml = `<div class="loading">Loading sections…</div>`;
        } else if (cached.error) {
          bodyHtml = `<div class="api-status err">${escapeHtml(cached.error)}</div>`;
        } else {
          bodyHtml = `
            ${course.subject_notes ? `<div class="subj-notes"><b>Subject Notes:</b>${escapeHtml(cleanText(course.subject_notes))}</div>` : ""}
            ${course.description ? `<div class="cr-desc">${escapeHtml(cleanText(course.description))}</div>` : ""}
            ${cleanText(course.prereqs)
              ? `<details class="catalog-advanced"><summary>Official prerequisite details</summary><p>${escapeHtml(cleanText(course.prereqs))}</p></details>`
              : `<div class="cr-prereqs"><b>Prerequisites</b>None listed</div>`}
            ${sectionTableHtml(course, cached.sections)}`;
        }
      }
      return `<div class="course-row">
        <div class="course-row-hdr" data-toggle="${escapeHtml(course.id)}">
          <span class="cr-arrow${isOpen ? " open" : ""}">▶</span>
          <span class="cr-code">${escapeHtml(code)}</span>
          ${cleanText(course.prereqs) ? `<span class="prereq-hint" onclick="event.stopPropagation()">Prereqs listed<span class="tip">${escapeHtml(cleanText(course.prereqs))}</span></span>` : ""}
          <span class="cr-title">${escapeHtml(course.title)}<span class="sub"> ${escapeHtml(course.subject_description || "")}</span></span>
          <span class="cr-credits">${escapeHtml(courseCreditsLabel(course.credits, true))}</span>
          <span class="cr-sections" style="color:${openCount > 0 ? "#3a8a3a" : "var(--grayt)"}">${openCount}/${totalCount} open</span>
          <button class="cr-wish${wishlistAction.remove ? " selected" : ""}" data-wadd="${escapeHtml(code)}" aria-pressed="${wishlistAction.remove}">${wishlistAction.label}</button>
        </div>
        <div class="course-row-body${isOpen ? " open" : ""}">${bodyHtml}</div>
      </div>`;
    }

    function connect(url) {
      const current = state();
      saveBackendUrl(url);
      current.backendPage = 1;
      current.expandedIds.clear();
      current.sectionsCache = {};
      void loadMeta();
      void loadCourses();
    }

    function clearSelector() {
      const current = state();
      current.backendSelectorGroupId = null;
      current.backendRequirementFilter = null;
      current.backendPage = 1;
      current.expandedIds.clear();
      return loadCourses();
    }

    function toggleWishlist(code, button = null) {
      const current = state();
      const saved = wishlistRecords().find((item) => item.code === code);
      if (saved) {
        delete current.wishlist[saved.key];
        saveState();
      } else {
        addToWishlist(code);
      }
      const action = plannerUI.catalogWishlistAction({ inWishlist: !saved });
      if (button) {
        button.textContent = action.label;
        button.classList.toggle("selected", action.remove);
        button.setAttribute("aria-pressed", String(action.remove));
      }
      return action;
    }

    function wireControls() {
      const current = state();
      const connectButton = document.getElementById("cpConnect");
      const urlInput = document.getElementById("cpUrl");
      connectButton?.addEventListener("click", () => connect(urlInput.value));
      urlInput?.addEventListener("keydown", (event) => {
        if (event.key === "Enter") connectButton?.click();
      });

      const search = document.getElementById("cpSearch");
      if (search) {
        let timer;
        search.addEventListener("input", (event) => {
          current.backendSearch = event.target.value;
          clearTimeout(timer);
          timer = setTimeout(() => {
            current.backendPage = 1;
            void loadCourses();
          }, 350);
        });
      }
      document.getElementById("cpSubject")?.addEventListener("change", (event) => {
        current.backendSubject = event.target.value;
        current.backendPage = 1;
        void loadCourses();
      });
      document.getElementById("cpClearSelector")?.addEventListener("click", () => void clearSelector());
      document.getElementById("cpPrev")?.addEventListener("click", () => {
        current.backendPage -= 1;
        void loadCourses();
      });
      document.getElementById("cpNext")?.addEventListener("click", () => {
        current.backendPage += 1;
        void loadCourses();
      });
      document.querySelectorAll("[data-toggle]").forEach((element) => element.addEventListener("click", (event) => {
        if (event.target.closest(".cr-wish")) return;
        void toggleCourseExpand(element.dataset.toggle);
      }));
      document.querySelectorAll("[data-wadd]").forEach((button) => button.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleWishlist(button.dataset.wadd, button);
      }));
    }

    function render() {
      const current = state();
      const container = document.getElementById("coursesRoot");
      if (!container) return;
      const coursePage = document.getElementById("page-courses");
      const previousSearch = document.getElementById("cpSearch");
      const viewState = interactionLogic.catalogViewState({
        scrollLeft: coursePage?.scrollLeft,
        scrollTop: coursePage?.scrollTop,
        activeElementId: document.activeElement?.id || "",
        selectionStart: previousSearch?.selectionStart,
        selectionEnd: previousSearch?.selectionEnd,
      });
      const restoreView = () => requestAnimationFrame(() => {
        const search = document.getElementById("cpSearch");
        if (viewState.restoreSearchFocus && search) {
          search.focus({ preventScroll: true });
          if (viewState.selectionStart !== null) {
            search.setSelectionRange(viewState.selectionStart, viewState.selectionEnd);
          }
        }
        if (coursePage) {
          coursePage.scrollLeft = viewState.scrollLeft;
          coursePage.scrollTop = viewState.scrollTop;
        }
      });
      const filter = selectorContext();
      const connectionBar = connectionBarHtml(current);
      if (!current.backendUrl) {
        container.innerHTML = `
          <div class="cp-header"><h1>Course Catalog</h1><div class="cp-sub">Live section data, synced from Rutgers</div></div>
          ${connectionBar}
          <div class="api-status" style="margin-top:8px">Not connected yet. Deploy <code>worker.js</code> (see README.md), then paste its <code>https://your-worker.workers.dev</code> URL above.</div>`;
        wireControls();
        restoreView();
        return;
      }

      const subjectOptions = `<option value="">All subjects</option>${(current.backendSubjects || []).map((subject) =>
        `<option value="${escapeHtml(subject.code)}"${current.backendSubject === subject.code ? " selected" : ""}>${escapeHtml(subject.description || subject.code)} (${escapeHtml(subject.code)})</option>`
      ).join("")}`;
      const selectorDescription = filter
        ? filter.selectors.map((item) => selectorLogic.selectorDescription(item)).join("; ")
        : "";
      const displayedCourses = filter
        ? current.backendCourses.filter((course) => selectorLogic.matchesAnySelector(backendCourseRecord(course), filter.selectors))
        : current.backendCourses;
      const statusLine = current.backendStatus
        ? `${Number(current.backendStatus.courses_in_db || 0).toLocaleString()} courses in database · last sync ${timeAgo(current.backendStatus.last_fetch_at)}`
        : "";

      let bodyHtml;
      if (current.backendLoading) {
        bodyHtml = `<div class="loading">Loading courses…</div>`;
      } else if (current.backendError) {
        bodyHtml = `<div class="api-status err">${escapeHtml(current.backendError)}</div>`;
      } else if (displayedCourses.length) {
        const pages = Math.max(1, Math.ceil(current.backendTotal / pageSize));
        bodyHtml = `
          <div class="course-list">${displayedCourses.map(courseRowHtml).join("")}</div>
          <div class="pager">
            <button id="cpPrev" ${current.backendPage <= 1 ? "disabled" : ""}>← Prev</button>
            <span class="pg-info">Page ${current.backendPage} of ${pages} (${current.backendTotal.toLocaleString()} courses)</span>
            <button id="cpNext" ${current.backendPage >= pages ? "disabled" : ""}>Next →</button>
          </div>`;
      } else {
        bodyHtml = `<div class="api-status">Connected — 0 courses matched. Try clearing the search/subject filter, or the backend hasn't finished its first sync yet (check ${escapeHtml(current.backendUrl)}/api/sync-status).</div>`;
      }

      container.innerHTML = `
        <div class="cp-header"><h1>Course Catalog</h1><div class="cp-sub">${statusLine}</div></div>
        ${connectionBar}
        ${filter ? `<div class="choice-summary">Choosing for <b>${escapeHtml(groupDisplayName(filter.group))}</b>: ${escapeHtml(selectorDescription)}. Add one to your wishlist, then place it in your plan to apply it automatically.</div>` : ""}
        <div class="cp-controls">
          <input id="cpSearch" placeholder="Search by title or course code…" value="${escapeHtml(current.backendSearch || "")}"/>
          ${filter ? `<button class="choice-btn secondary" id="cpClearSelector">Clear requirement filter</button>` : `<select id="cpSubject">${subjectOptions}</select>`}
        </div>
        ${bodyHtml}`;
      wireControls();
      restoreView();
    }

    async function loadMeta() {
      const current = state();
      const generation = ++metadataRequestGeneration;
      try {
        const subjects = await request("/api/subjects");
        if (generation !== metadataRequestGeneration) return;
        current.backendSubjects = subjects.subjects || [];
      } catch (_error) {
        if (generation !== metadataRequestGeneration) return;
        current.backendSubjects = [];
      }
      try {
        const status = await request("/api/sync-status");
        if (generation !== metadataRequestGeneration) return;
        current.backendStatus = status;
      } catch (_error) {
        if (generation !== metadataRequestGeneration) return;
        current.backendStatus = null;
      }
      render();
    }

    async function loadCourses() {
      const current = state();
      const generation = ++courseRequestGeneration;
      if (!current.backendUrl) {
        current.backendError = "";
        current.backendCourses = [];
        current.backendLoading = false;
        render();
        return;
      }
      current.backendLoading = true;
      current.backendError = "";
      render();
      try {
        const params = new URLSearchParams({
          search: current.backendSearch || "",
          subject: current.backendSubject || "",
          limit: String(pageSize),
          offset: String((current.backendPage - 1) * pageSize),
        });
        const filter = selectorContext();
        if (filter) params.set("selector", JSON.stringify(filter.selectors));
        const result = await request(`/api/courses?${params.toString()}`);
        if (generation !== courseRequestGeneration) return;
        const courses = result.courses || [];
        await loadEligibilityForCodes(courses.map(catalogCourseCode));
        if (generation !== courseRequestGeneration) return;
        current.backendCourses = courses;
        current.backendTotal = result.total ?? courses.length;
      } catch (error) {
        if (generation !== courseRequestGeneration) return;
        current.backendError = `Couldn't reach backend: ${error.message}`;
        current.backendCourses = [];
      }
      if (generation !== courseRequestGeneration) return;
      current.backendLoading = false;
      render();
    }

    async function toggleCourseExpand(id) {
      const current = state();
      if (current.expandedIds.has(id)) {
        current.expandedIds.delete(id);
        render();
        return;
      }
      current.expandedIds.add(id);
      render();
      if (!current.sectionsCache[id]) {
        try {
          const result = await request(`/api/courses/${encodeURIComponent(id)}/sections`);
          current.sectionsCache[id] = { sections: result.sections || [] };
        } catch (error) {
          current.sectionsCache[id] = { error: error.message };
        }
        render();
      }
    }

    function initialize() {
      if (!state().backendUrl) {
        render();
        return;
      }
      void loadMeta();
      void loadCourses();
    }

    return {
      initialize,
      loadMeta,
      loadCourses,
      render,
      connect,
      clearSelector,
      toggleCourseExpand,
      toggleWishlist,
    };
  }

  root.ScheduleRUCatalogPageController = { create };
})(globalThis);
