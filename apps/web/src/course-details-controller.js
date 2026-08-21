(function exposeCourseDetailsController(root) {
  function create({
    getState,
    document,
    requestAnimationFrame,
    getCourse,
    getCourseByCode,
    loadEligibilityForCodes,
    requirementCourseId,
    prerequisiteEligibilityForTerm,
    prerequisiteBlockerLabel,
    standingRequirement,
    courseEligibilityNotice,
    academicYearLabel,
    plannerUI,
    escapeHtml,
    cleanText,
    courseCreditsLabel,
    resumeRequirementPicker,
    professorLinkModel,
  } = {}) {
    let bound = false;
    let currentCourseId = null;
    let focusRestore = null;
    let viewGeneration = 0;
    const loadingCodes = new Set();

    function state() {
      return getState?.() || {};
    }

    function modalRoot() {
      return document.getElementById("prOv");
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
      const rootElement = modalRoot();
      if (open) {
        if (!rootElement.classList.contains("open")) focusRestore = document.activeElement;
        rootElement.classList.add("open");
      } else {
        rootElement.classList.remove("open");
      }
      rootElement.setAttribute("aria-hidden", String(!open));
      setBackgroundInert(open);
      if (open) requestAnimationFrame(() => document.getElementById("prClose")?.focus());
    }

    function restoreFocus() {
      const restore = focusRestore;
      focusRestore = null;
      requestAnimationFrame(() => {
        if (restore?.isConnected && restore !== document.body) restore.focus();
      });
    }

    function prerequisiteDisplayName(code, plan) {
      const known = getCourseByCode?.(code);
      const reference = (plan.references || []).find((item) => item.course_code === code);
      return known?.fullTitle || known?.title || reference?.title || code;
    }

    function prerequisiteChipHtml(code, pathResult, plan) {
      const chipState = pathResult?.courseStates?.find((item) => item.course_code === code)?.state || "unknown";
      const className = chipState === "completed" || chipState === "planned_earlier"
        ? " met"
        : chipState === "same_term"
          ? " same-term"
          : chipState === "later_term"
            ? " later-term"
            : "";
      const stateLabel = chipState === "completed"
        ? "Completed"
        : chipState === "planned_earlier"
          ? "Planned earlier"
          : chipState === "same_term"
            ? "Same semester — not eligible"
            : chipState === "later_term"
              ? "Planned later — not eligible"
              : "Not yet planned";
      return `<div class="detail-chip${className}" title="${escapeHtml(stateLabel)}">${escapeHtml(prerequisiteDisplayName(code, plan))}<code>${escapeHtml(code)}</code></div>`;
    }

    function prerequisiteDetailsHtml(result, course) {
      const plan = result.plan;
      if (plan.paths?.length) {
        const paths = plan.paths.map((path, index) => {
          const pathResult = result.paths?.[index];
          const className = pathResult?.missing?.length ? " blocked" : " met";
          const label = plan.paths.length > 1
            ? `Path ${index + 1} — complete every course in this path`
            : "Complete before this course";
          return `<div class="prereq-path${className}"><div class="prereq-path-label">${escapeHtml(label)}</div><div class="detail-chips">${path.map((code) => prerequisiteChipHtml(code, pathResult, plan)).join("")}</div></div>`;
        }).join("");
        const sourceNote = plan.source === "catalog"
          ? "These paths are read from the official catalog."
          : plan.source === "reviewed_conditions"
            ? "These paths come from a Rutgers prerequisite record."
            : "";
        return `<div class="detail-section"><h3>Course path</h3>${paths}${sourceNote ? `<p class="src-note">${sourceNote} A green course is completed or scheduled in an earlier semester.</p>` : ""}</div>`;
      }
      if (plan.references?.length) {
        return `<div class="detail-section"><h3>Course path</h3><div class="detail-chips">${plan.references.map((reference) => prerequisiteChipHtml(reference.course_code, null, plan)).join("")}</div><p class="src-note">This requirement includes official placement or alternative-course wording. Review the catalog details below before registration.</p></div>`;
      }
      const presentation = plannerUI.coursePathState({
        plan,
        verifiedNoPrerequisites: plan.verifiedNoPrerequisites,
        catalogRecordAvailable: course?.catalogRecordAvailable === true,
        catalogPrerequisites: course?.catalogPrereqs || "",
      });
      return `<div class="detail-section"><h3>Course path</h3><p>${escapeHtml(presentation.message)}</p></div>`;
    }

    function compactRestriction(course, standing) {
      if (standing) return standing.label;
      const text = cleanText(course.restrictions);
      if (/all\s+except\s+(?:1st|first)[ -]?year|not\s+open\s+to\s+(?:1st|first)[ -]?year/i.test(text)) {
        return "Not open to first-year students";
      }
      return text ? "See official catalog details" : "No special enrollment restriction listed";
    }

    function renderCourse(id, generation) {
      const course = getCourse(id);
      if (!course) return false;
      document.getElementById("prTitle").textContent = "Course details";
      const current = state();
      const scheduledEntry = current.schedule?.[course.code];
      const detailsTerm = scheduledEntry
        ? { year: Number(scheduledEntry.year), sem: scheduledEntry.sem }
        : { year: current.year, sem: "fall" };
      const prerequisiteEligibility = prerequisiteEligibilityForTerm(course, detailsTerm);
      const standing = standingRequirement(course);
      const requirementNotes = (course.requirementNotes || []).join("; ");
      const approvedAlternatives = (course.alternatives || []).filter((alternative) => (
        alternative.code || alternative.equivalent_course_code
      ));
      const completedAlternative = approvedAlternatives.find((alternative) => {
        const code = alternative.code || alternative.equivalent_course_code;
        return !!current.completed?.[requirementCourseId(code)]
          || Object.values(current.schedule || {}).some((entry) => entry.code === code);
      });
      const alternativeDetails = approvedAlternatives.map((alternative) => {
        const code = alternative.code || alternative.equivalent_course_code;
        const label = alternative.title ? `${alternative.title} (${code})` : code;
        return `<div class="detail-chip">${escapeHtml(label)}<code>${escapeHtml(code)}</code></div>`;
      }).join("");
      const available = prerequisiteEligibility.status !== "blocked"
        && (!standing || detailsTerm.year >= standing.year);
      const eligibilityNotice = courseEligibilityNotice(course, detailsTerm);
      const instructors = professorLinkModel?.distinctNamedInstructors(course) || [];
      const instructorLinks = instructors.map((name) => (
        `<a class="external-professor-link" href="${escapeHtml(professorLinkModel.ratingsSearchUrl(name))}" target="_blank" rel="noopener noreferrer" aria-label="View ratings for ${escapeHtml(name)} on Rate My Professors">${escapeHtml(name)} ↗</a>`
      )).join("");
      const status = completedAlternative
        ? `This requirement is already fulfilled by ${completedAlternative.title || completedAlternative.code || completedAlternative.equivalent_course_code}.`
        : prerequisiteEligibility.status === "blocked"
          ? `Not yet available: ${prerequisiteBlockerLabel(prerequisiteEligibility)}.`
          : available
        ? (prerequisiteEligibility.plan.paths?.length
          ? "Available based on prerequisite courses completed or planned in earlier semesters."
          : "Available based on the official course facts used for this plan.")
        : `Not yet available in the ${academicYearLabel(detailsTerm.year)} plan year because ${standing?.label?.toLowerCase() || "of an enrollment restriction"}.`;
      document.getElementById("prBody").innerHTML = `
        <div class="detail-overview">
          <h2>${escapeHtml(course.fullTitle || course.title)}</h2>
          <div class="detail-code">${escapeHtml(course.code)} · ${escapeHtml(courseCreditsLabel(course.credits))}</div>
          <div class="detail-status${available || completedAlternative ? " ready" : ""}">${escapeHtml(status)}</div>
        </div>
        <div class="detail-section"><h3>${standing ? "When you can take it" : "Enrollment"}</h3><p>${escapeHtml(compactRestriction(course, standing))}</p></div>
        ${instructorLinks ? `<div class="detail-section"><h3>Instructors</h3><div class="external-professor-links">${instructorLinks}</div><p class="src-note">Opens the instructor's external Rate My Professors profile or search.</p></div>` : ""}
        ${eligibilityNotice ? `<div class="detail-section"><h3>Planning eligibility</h3><p>${escapeHtml(eligibilityNotice)}</p></div>` : ""}
        ${alternativeDetails ? `<div class="detail-section"><h3>Also accepted for this requirement</h3><div class="detail-chips">${alternativeDetails}</div><p class="src-note">This equivalency comes from the degree-audit rule recorded for this requirement.</p></div>` : ""}
        ${prerequisiteDetailsHtml(prerequisiteEligibility, course)}
        ${course.description ? `<div class="detail-section"><h3>About this course</h3><p>${escapeHtml(cleanText(course.description))}</p></div>` : ""}
        ${course.catalogPrereqs || course.subjectNotes || requirementNotes || course.restrictions ? `<details class="detail-advanced"><summary>Official catalog details</summary><div class="detail-advanced-body">
          ${course.catalogPrereqs ? `<p><b>Official prerequisite wording</b><br/>${escapeHtml(cleanText(course.catalogPrereqs))}</p>` : ""}
          ${course.subjectNotes ? `<p><b>Special notes</b><br/>${escapeHtml(cleanText(course.subjectNotes))}</p>` : ""}
          ${requirementNotes ? `<p><b>Degree requirement note</b><br/>${escapeHtml(requirementNotes)}</p>` : ""}
          ${course.restrictions && !standing ? `<p><b>Catalog enrollment wording</b><br/>${escapeHtml(cleanText(course.restrictions))}</p>` : ""}
        </div></details>` : ""}
        <p class="src-note">Course details come from the official degree requirement and the current Rutgers course catalog when that course is offered this term.</p>`;
      setOpen(true);
      if (course.code && !current.courseEligibilityFetched?.[course.code] && !loadingCodes.has(course.code)) {
        loadingCodes.add(course.code);
        void Promise.resolve(loadEligibilityForCodes([course.code])).then((loaded) => {
          if (loaded
            && generation === viewGeneration
            && currentCourseId === id
            && modalRoot().classList.contains("open")) {
            renderCourse(id, generation);
          }
        }).catch(() => {
          // Initial requirement details remain useful when the catalog is unavailable.
        }).finally(() => loadingCodes.delete(course.code));
      }
      return true;
    }

    function open(id) {
      if (!getCourse(id)) return false;
      currentCourseId = id;
      viewGeneration += 1;
      return renderCourse(id, viewGeneration);
    }

    function close() {
      if (!modalRoot().classList.contains("open")) return false;
      currentCourseId = null;
      viewGeneration += 1;
      setOpen(false);
      const current = state();
      if (current.returnToPicker && current.pickerGroupId) {
        current.returnToPicker = false;
        const resumed = resumeRequirementPicker?.() === true;
        if (resumed) {
          focusRestore = null;
          return true;
        }
      }
      restoreFocus();
      return true;
    }

    function bind() {
      if (bound) return;
      bound = true;
      document.getElementById("prClose").addEventListener("click", close);
      document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !modalRoot().classList.contains("open")) return;
        if (document.getElementById("appModal")?.classList.contains("open")) return;
        event.preventDefault();
        close();
      });
      modalRoot().addEventListener("click", (event) => {
        if (event.target === modalRoot()) close();
      });
    }

    return { bind, close, open };
  }

  root.ScheduleRUCourseDetailsController = { create };
})(globalThis);
