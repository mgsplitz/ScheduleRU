/* Semester schedule-builder lifecycle and state transitions. */
(function exposeScheduleBuilderController(root) {
  function create({
    getState,
    currentPlannerTerm,
    canOpenBuilder,
    buildPermutations,
    renderMain,
    renderAll,
    showModal,
    courseRecordFromId,
    lockedElsewhere,
    request,
    activeBackendYear,
    activeBackendTerm,
    academicYearLabel,
    escapeHtml,
    openAssistant,
    userMessageModel,
  } = {}) {
    function state() { return getState?.() || {}; }
    function sectionIsOpen(section) {
      return section?.open_status === true
        || section?.open_status === 1
        || section?.open_status === "1";
    }

    function recompute() {
      const current = state();
      if (!current.builder) return;
      const result = buildPermutations(current.builder.pool);
      current.builder.permutations = result.combos;
      current.builder.permutations.forEach((combo, index) => { combo.stableIndex = index + 1; });
      current.builder.blockers = result.blockers;
      current.builder.requiredCount = result.required.length;
      current.builder.permIndex = 0;
    }

    function open(semester) {
      const current = state();
      const active = currentPlannerTerm();
      if (!canOpenBuilder({
        displayedYear: current.year,
        activeYear: active.year,
        semester,
        activeSemester: active.semester,
      })) return false;
      current.builder = {
        year: current.year,
        sem: semester,
        pool: [],
        permutations: [],
        blockers: [],
        requiredCount: 0,
        permIndex: 0,
        includeClosed: false,
      };
      renderMain();
      Object.values(current.schedule || {})
        .filter((entry) => entry.year === current.builder.year && entry.sem === semester)
        .forEach((entry) => void seedFromSchedule(entry));
      return true;
    }

    function close() {
      const current = state();
      current.builder = null;
      renderAll();
    }

    async function hydrate(entry, preselectedIndex = null) {
      const parts = entry.code.split(":");
      const backendId = `${parts[0]}:${parts[1]}:${parts[2]}:${activeBackendYear()}:${activeBackendTerm()}`;
      try {
        if (!entry.title || entry.credits === undefined) {
          const metadata = await request(`/api/courses/${encodeURIComponent(backendId)}`);
          entry.title ||= metadata.course?.title || entry.code;
          entry.credits ??= metadata.course?.credits ?? "";
        }
        const result = await request(`/api/courses/${encodeURIComponent(backendId)}/sections`);
        entry.sections = result.sections || [];
        if (preselectedIndex != null && entry.sections.some((section) => section.index_number === preselectedIndex)) {
          entry.checked = new Set([preselectedIndex]);
        } else {
          entry.checked = new Set(entry.sections.filter(sectionIsOpen).map((section) => section.index_number));
        }
        if (!entry.sections.length) entry.error = "No sections found for this course/term in the backend.";
      } catch (error) {
        entry.error = userMessageModel.presentIssue(error).message;
      }
      entry.loading = false;
    }

    async function seedFromSchedule(scheduleEntry) {
      const current = state();
      if (!current.builder || current.builder.pool.some((entry) => entry.code === scheduleEntry.code)) return;
      const entry = {
        code: scheduleEntry.code,
        title: scheduleEntry.title,
        fullTitle: scheduleEntry.fullTitle || scheduleEntry.title,
        credits: scheduleEntry.credits,
        course: scheduleEntry.course,
        sections: [],
        checked: new Set(),
        loading: true,
        enabled: true,
        collapsed: false,
      };
      current.builder.pool.push(entry);
      renderMain();
      await hydrate(entry, scheduleEntry.locked ? scheduleEntry.index_number : null);
      recompute();
      renderMain();
    }

    async function add(courseId) {
      const current = state();
      if (!current.builder || !courseId) return false;
      const record = courseRecordFromId(courseId);
      if (!record || current.builder.pool.some((entry) => entry.code === record.code)) return false;
      if (lockedElsewhere(record.code, current.builder.year, current.builder.sem)) {
        const placement = current.schedule[record.code];
        showModal({
          title: "Course already locked",
          body: `<p>${escapeHtml(record.code)} is already scheduled for ${escapeHtml(academicYearLabel(placement.year))} ${escapeHtml(placement.sem)}. Remove it there first.</p>`,
          actions: [{ label: "Close", secondary: true }],
        });
        return false;
      }
      const entry = {
        code: record.code,
        title: record.title,
        fullTitle: record.fullTitle || record.title,
        credits: record.credits,
        course: record,
        sections: [],
        checked: new Set(),
        loading: true,
        enabled: true,
        collapsed: false,
      };
      current.builder.pool.push(entry);
      renderMain();
      await hydrate(entry);
      recompute();
      renderMain();
      return true;
    }

    function remove(code) {
      const current = state();
      if (!current.builder) return;
      current.builder.pool = current.builder.pool.filter((entry) => entry.code !== code);
      recompute();
      renderMain();
    }

    function toggleSection(code, indexNumber) {
      const entry = state().builder?.pool.find((item) => item.code === code);
      if (!entry) return;
      if (entry.checked.has(indexNumber)) entry.checked.delete(indexNumber);
      else entry.checked.add(indexNumber);
      recompute();
      renderMain();
    }

    function toggleCollapse(code) {
      const entry = state().builder?.pool.find((item) => item.code === code);
      if (!entry) return;
      entry.collapsed = !entry.collapsed;
      renderMain();
    }

    function toggleEnabled(code) {
      const entry = state().builder?.pool.find((item) => item.code === code);
      if (!entry) return;
      entry.enabled = entry.enabled === false;
      recompute();
      renderMain();
    }

    function setIncludeClosed(includeClosed) {
      const current = state();
      if (!current.builder) return;
      current.builder.includeClosed = includeClosed;
      current.builder.pool.forEach((entry) => {
        entry.autoIncludedClosed ||= new Set();
        (entry.sections || []).forEach((section) => {
          if (sectionIsOpen(section)) return;
          const index = section.index_number;
          if (includeClosed) {
            if (!entry.checked.has(index)) {
              entry.checked.add(index);
              entry.autoIncludedClosed.add(index);
            }
          } else if (entry.autoIncludedClosed.has(index)) {
            entry.checked.delete(index);
            entry.autoIncludedClosed.delete(index);
          }
        });
      });
      recompute();
      renderMain();
    }

    function confirm() {
      const current = state();
      if (!current.builder) return false;
      const combo = current.builder.permutations[current.builder.permIndex];
      if (!combo?.length) {
        showModal({
          title: "No schedule to use",
          body: "<p>Check at least one section for every required course before using a conflict-free schedule.</p>",
          actions: [{ label: "Close", secondary: true }],
        });
        return false;
      }
      const { year, sem } = current.builder;
      combo.forEach((section) => {
        current.schedule[section.code] = {
          year,
          sem,
          code: section.code,
          title: section.title,
          fullTitle: section.fullTitle || section.title,
          credits: section.credits,
          course: section.course || courseRecordFromId(section.code),
          sectionId: section.id,
          index_number: section.index_number,
          section_number: section.section_number,
          meetings: section.meetings || [],
          locked: true,
          userPinned: true,
        };
      });
      current.builder = null;
      renderAll();
      return true;
    }

    return {
      open,
      close,
      hydrate,
      seedFromSchedule,
      add,
      remove,
      toggleSection,
      toggleCollapse,
      toggleEnabled,
      recompute,
      setIncludeClosed,
      confirm,
      sectionIsOpen,
      openAssistant,
    };
  }

  root.ScheduleRUScheduleBuilderController = { create };
})(globalThis);
