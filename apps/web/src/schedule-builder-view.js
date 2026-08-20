/* Semester schedule-builder presentation and browser event binding. */
(function exposeScheduleBuilderView(root) {
  const BUILDING_CAMPUS = {
    SC:"COLLEGE AVENUE", ABE:"COLLEGE AVENUE", ABW:"COLLEGE AVENUE", AB:"COLLEGE AVENUE",
    MU:"COLLEGE AVENUE", VH:"COLLEGE AVENUE", HH:"COLLEGE AVENUE", BH:"COLLEGE AVENUE",
    CA:"COLLEGE AVENUE", CI:"COLLEGE AVENUE", ED:"COLLEGE AVENUE", FH:"COLLEGE AVENUE",
    MI:"COLLEGE AVENUE", ZIM:"COLLEGE AVENUE", RUL:"COLLEGE AVENUE", VD:"COLLEGE AVENUE",
    ARC:"BUSCH", BME:"BUSCH", BST:"BUSCH", CCB:"BUSCH", COR:"BUSCH", EN:"BUSCH",
    FBO:"BUSCH", HLL:"BUSCH", PH:"BUSCH", PHY:"BUSCH", SEC:"BUSCH", WL:"BUSCH",
    SERC:"BUSCH", LSB:"BUSCH", RWH:"BUSCH",
    ARH:"COOK/DOUGLASS", BIO:"COOK/DOUGLASS", BL:"COOK/DOUGLASS", BT:"COOK/DOUGLASS",
    CDL:"COOK/DOUGLASS", DAV:"COOK/DOUGLASS", FSW:"COOK/DOUGLASS", HCK:"COOK/DOUGLASS",
    RAB:"COOK/DOUGLASS", LOR:"COOK/DOUGLASS", FOR:"COOK/DOUGLASS", IFNH:"COOK/DOUGLASS",
    FNH:"COOK/DOUGLASS", HSB:"COOK/DOUGLASS", KLG:"COOK/DOUGLASS", TH:"COOK/DOUGLASS",
    WAL:"COOK/DOUGLASS", BE:"LIVINGSTON", TIL:"LIVINGSTON", LSH:"LIVINGSTON",
    GVLL:"LIVINGSTON", BRR:"LIVINGSTON", HC:"DOWNTOWN", HELD:"DOWNTOWN",
  };

  const CAMPUS_COLORS = {
    ONLINE:{fill:"#f6b8b8",border:"#c0392b"},
    BUSCH:{fill:"#aecdf2",border:"#3f6fb0"},
    "COLLEGE AVENUE":{fill:"#bce3b3",border:"#4f9a44"},
    "COOK/DOUGLASS":{fill:"#a9e0d4",border:"#2f8f77"},
    LIVINGSTON:{fill:"#ffcc99",border:"#d4791e"},
    DOWNTOWN:{fill:"#e6b3e0",border:"#9c3f96"},
    CAMDEN:{fill:"#cdbdf2",border:"#6f4fae"},
    NEWARK:{fill:"#c9c9c9",border:"#6b6b6b"},
    "OTHER/UNKNOWN":{fill:"#e9e7e1",border:"#9b968c"},
  };

  function create({
    getBuilder,
    document,
    escapeHtml,
    formatMeeting,
    dayIndex,
    meetingTimeRange,
    formatClock,
    academicYearLabel,
    sortSections,
    calendarBlockGeometry,
    professorLinkModel,
    handlers = {},
  } = {}) {
    function builder() { return getBuilder?.() || null; }

    function campusFor(meeting) {
      if (!meeting) return "OTHER/UNKNOWN";
      if (/ONLINE/i.test(meeting.mode || "") || /ONLINE/i.test(meeting.meeting_mode || "")) return "ONLINE";
      const building = String(meeting.building || "").trim();
      if (!building) return "OTHER/UNKNOWN";
      return BUILDING_CAMPUS[building.split(/[\s-]/)[0].toUpperCase()] || "OTHER/UNKNOWN";
    }

    function legendMarkup() {
      const swatches = Object.entries(CAMPUS_COLORS).map(([name, color]) =>
        `<span class="cal-legend-item"><i style="background:${color.fill};border-color:${color.border};"></i>${escapeHtml(name)}</span>`
      ).join("");
      return `<div class="cal-legend">${swatches}<span class="cal-legend-item"><i class="dashed" style="border-color:#c0392b;"></i>CLOSED SECTION</span></div>`;
    }

    function poolCourseMarkup(course) {
      const current = builder();
      const enabled = course.enabled !== false;
      const collapsed = !!course.collapsed;
      let body;
      if (course.loading) body = `<div class="loading">Loading sections…</div>`;
      else if (course.error && !(course.sections || []).length) body = `<div class="api-status err">${escapeHtml(course.error)}</div>`;
      else if (!(course.sections || []).length) body = `<div class="api-status">No sections available.</div>`;
      else body = sortSections(course.sections || []).map((section) => {
        const open = section.open_status === true || section.open_status === 1 || section.open_status === "1";
        const checked = course.checked?.has(section.index_number);
        const meetings = (section.meetings || []).map(formatMeeting).join(", ") || "—";
        const instructorName = professorLinkModel?.instructorName(section.instructor) || "";
        const instructor = escapeHtml(instructorName || section.instructor || "Staff / TBA");
        const ratingsUrl = instructorName ? professorLinkModel.ratingsSearchUrl(instructorName) : "";
        const instructorMarkup = ratingsUrl
          ? `<a class="pool-sec-instr external-professor-link" href="${escapeHtml(ratingsUrl)}" target="_blank" rel="noopener noreferrer" aria-label="View ratings for ${instructor} on Rate My Professors" title="${instructor}">${instructor} ↗</a>`
          : `<span class="pool-sec-instr" title="${instructor}">${instructor}</span>`;
        return `<label class="pool-sec-row" ${!open && !current?.includeClosed ? "hidden" : ""}>
          <input type="checkbox" data-poolsec="${escapeHtml(course.code)}|${escapeHtml(section.index_number)}" ${checked ? "checked" : ""}/>
          <span style="width:36px;flex-shrink:0;">${escapeHtml(section.section_number || section.index_number || "")}</span>
          <span class="pool-sec-meet">${escapeHtml(meetings)}</span>
          ${instructorMarkup}
          <span class="pool-sec-status ${open ? "status-open" : "status-closed"}">${open ? "OPEN" : "CLOSED"}</span>
        </label>`;
      }).join("");
      return `<div class="pool-course ${enabled ? "" : "pool-course-disabled"}">
        <div class="pool-course-hdr">
          <span class="pool-collapse" data-poolcollapse="${escapeHtml(course.code)}" title="${collapsed ? "Show" : "Hide"} sections">${collapsed ? "▸" : "▾"}</span>
          <input type="checkbox" class="pool-enable" data-poolenable="${escapeHtml(course.code)}" ${enabled ? "checked" : ""}
            title="${enabled ? "Required for schedules — uncheck to exclude" : "Excluded from schedules — check to require"}"/>
          <b>${escapeHtml(course.code)}</b> ${escapeHtml(course.title || "")} <span style="color:var(--muted);font-family:var(--fmono);font-size:10px;">${course.credits !== undefined && course.credits !== "" ? course.credits + "cr" : ""}</span>
          <button class="rx" data-poolrm="${escapeHtml(course.code)}">✕</button>
        </div>
        ${collapsed ? "" : `<div class="pool-sections">${body}</div>`}
      </div>`;
    }

    function calendarMarkup() {
      const current = builder();
      const combo = current?.permutations?.[current.permIndex] || [];
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
      const pixelsPerMinute = .8;
      const dayStartMinute = 8 * 60;
      const dayEndMinute = 22 * 60;
      let dayCells = days.map((day, index) => `<div class="cal-daylabel" style="left:${index * 20}%;width:20%;">${day}</div>`).join("");
      let timeLabels = "";
      for (let hour = 8; hour <= 22; hour += 1) {
        const label = hour === 12 ? "12pm" : hour > 12 ? `${hour - 12}pm` : `${hour}am`;
        const top = 28 + (hour * 60 - dayStartMinute) * pixelsPerMinute;
        timeLabels += `<div class="cal-timelabel" style="top:${top}px;">${label}</div>`;
      }
      const outside = [];
      combo.forEach((course) => (course.meetings || []).forEach((meeting) => {
        const day = dayIndex(meeting.day_of_week);
        if (day == null || day > 4) { outside.push(`${course.code} · ${formatMeeting(meeting)}`); return; }
        const range = meetingTimeRange(meeting);
        const geometry = range && range.start >= dayStartMinute && range.end <= dayEndMinute
          ? calendarBlockGeometry({ startMinute: range.start, endMinute: range.end, dayStartMinute, pixelsPerMinute })
          : null;
        if (!geometry) { outside.push(`${course.code} · ${formatMeeting(meeting)}`); return; }
        const campus = campusFor(meeting);
        const color = CAMPUS_COLORS[campus] || CAMPUS_COLORS["OTHER/UNKNOWN"];
        const closed = course.open_status === false || course.open_status === 0;
        const location = [meeting.building, meeting.room].filter(Boolean).join(" ") || (campus === "ONLINE" ? "Online" : "");
        const time = `${formatClock(range.start)} – ${formatClock(range.end)}`;
        dayCells += `<div class="cal-block${closed ? " cal-block-closed" : ""}" style="left:calc(${day * 20}% + 2px);width:calc(20% - 4px);top:${geometry.top}px;height:${geometry.height}px;background:${color.fill};border-color:${color.border};">
          <b>${escapeHtml(course.code)}</b><span class="cal-course-title">${escapeHtml(course.title || course.code)}</span>
          <span class="cal-detail">${escapeHtml(time)}</span><span class="cal-detail">${escapeHtml(location)}</span></div>`;
      }));
      return `<div class="calendar-scroll"><div class="builder-cal minute-scale">${timeLabels}<div class="cal-days">${dayCells}</div></div></div>
        ${outside.length ? `<div class="cal-outside"><b>Weekend, online, or untimed meetings</b><br/>${escapeHtml(outside.join(" · "))}</div>` : ""}`;
    }

    function markup() {
      const current = builder();
      if (!current) return "";
      const semLabel = current.sem === "fall" ? "Fall" : "Spring";
      const count = current.permutations?.length || 0;
      let results = "";
      if (current.pool.length) {
        if (!(current.requiredCount || 0)) {
          results = `<div class="no-sched">Every course below is excluded (unchecked) — check at least one to build a schedule around it.</div>`;
        } else if ((current.blockers || []).length) {
          const names = current.blockers.map((course) => {
            if (course.loading) return `${course.code} (loading…)`;
            if (course.error && !(course.sections || []).length) return `${course.code} (couldn't load sections)`;
            if (!(course.sections || []).length) return `${course.code} (no sections offered this term)`;
            return `${course.code} (no section checked)`;
          }).join(", ");
          results = `<div class="no-sched">No schedules available — every required course needs at least one section checked before a schedule can be built.<br/>Needs attention: ${escapeHtml(names)}</div>`;
        } else if (!count) {
          results = `<div class="no-sched">No schedules available — there's no way to fit every required, checked course into one schedule without a time conflict.<br/>Try checking additional sections, or temporarily uncheck a course above.</div>`;
        } else {
          results = `${legendMarkup()}<div class="builder-nav">
            <button id="permPrev" ${current.permIndex <= 0 ? "disabled" : ""}>← Prev</button>
            <label>Schedule <input id="permIndex" class="builder-nav-index" type="number" min="1" max="${count}" value="${current.permIndex + 1}" aria-label="Schedule number"/> of ${count}</label>
            <button id="permNext" ${current.permIndex >= count - 1 ? "disabled" : ""}>Next →</button>
          </div><div class="inline-error" id="permIndexError" aria-live="polite"></div>${calendarMarkup()}
          <button class="builder-confirm" id="permConfirm">Use this schedule for ${semLabel} ${academicYearLabel(current.year)}</button>`;
        }
      }
      return `<div class="builder-hdr"><h2>Build Schedule — ${semLabel} · ${academicYearLabel(current.year)}</h2>
        <button class="schedule-assistant-toggle" id="builderAssistant">Schedule assistant</button>
        <button class="builder-back" id="builderBack">← Back to 4-Year Plan</button></div>
        <div class="drop-pool" id="poolDrop">Drag courses here from the Required / Wishlist panel →</div>${results}
        <label class="include-closed"><input type="checkbox" ${current.includeClosed ? "checked" : ""}/> Include closed sections</label>
        <div id="poolList">${current.pool.map(poolCourseMarkup).join("")}</div>`;
    }

    function bind(container) {
      const current = builder();
      container.querySelector("#builderBack")?.addEventListener("click", handlers.close);
      container.querySelector("#builderAssistant")?.addEventListener("click", handlers.openAssistant);
      container.querySelector(".include-closed input")?.addEventListener("change", (event) => handlers.setIncludeClosed?.(event.target.checked));
      const drop = container.querySelector("#poolDrop");
      if (drop) {
        drop.ondragover = (event) => { event.preventDefault(); drop.classList.add("over"); };
        drop.ondragleave = () => drop.classList.remove("over");
        drop.ondrop = (event) => { event.preventDefault(); drop.classList.remove("over"); const id = event.dataTransfer.getData("cid"); if (id) handlers.add?.(id); };
      }
      container.querySelectorAll("[data-poolrm]").forEach((element) => element.addEventListener("click", () => handlers.remove?.(element.dataset.poolrm)));
      container.querySelectorAll("[data-poolsec]").forEach((element) => element.addEventListener("change", () => { const [code, index] = element.dataset.poolsec.split("|"); handlers.toggleSection?.(code, index); }));
      container.querySelectorAll("[data-poolcollapse]").forEach((element) => element.addEventListener("click", () => handlers.toggleCollapse?.(element.dataset.poolcollapse)));
      container.querySelectorAll("[data-poolenable]").forEach((element) => element.addEventListener("change", () => handlers.toggleEnabled?.(element.dataset.poolenable)));
      container.querySelector("#permPrev")?.addEventListener("click", () => { current.permIndex = Math.max(0, current.permIndex - 1); render(); });
      container.querySelector("#permNext")?.addEventListener("click", () => { current.permIndex = Math.min(current.permutations.length - 1, current.permIndex + 1); render(); });
      container.querySelector("#permIndex")?.addEventListener("keydown", (event) => {
        if (event.key === "Escape") { event.preventDefault(); event.currentTarget.value = String(current.permIndex + 1); event.currentTarget.blur(); return; }
        if (event.key !== "Enter") return;
        event.preventDefault();
        const requested = Number(event.currentTarget.value);
        const error = container.querySelector("#permIndexError");
        if (!Number.isInteger(requested) || requested < 1 || requested > current.permutations.length) { error.textContent = `Enter a schedule number from 1 to ${current.permutations.length}.`; return; }
        current.permIndex = requested - 1;
        render();
      });
      container.querySelector("#permConfirm")?.addEventListener("click", handlers.confirm);
    }

    function render() {
      const container = document?.getElementById("builderRoot");
      if (!container || !builder()) return;
      container.innerHTML = markup();
      bind(container);
    }

    return { render, markup, poolCourseMarkup, calendarMarkup, campusFor };
  }

  root.ScheduleRUScheduleBuilderView = { create };
})(globalThis);
