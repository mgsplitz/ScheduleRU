/* Plain-language rendering for one guided generation decision at a time. */
(function exposeGenerationDecisionsView(root) {
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

  function prerequisiteNote(candidate) {
    const sizes = (candidate.prerequisitePaths || []).map((path) => path.length).filter((size) => size > 0);
    if (!sizes.length) return "No known course prerequisites";
    const count = Math.min(...sizes);
    return `Builds on ${count} course${count === 1 ? "" : "s"}`;
  }

  function renderDecision({ decision = {}, preference = {}, index = 0, total = 1 } = {}) {
    const selected = (code, bucket) => (preference[bucket] || []).includes(code);
    const candidates = (decision.candidates || []).map((candidate) => `
      <article class="generation-candidate">
        <div class="generation-candidate-main"><strong>${escapeHtml(candidate.title || candidate.code)}</strong><code>${escapeHtml(candidate.code)}</code><span>${escapeHtml(prerequisiteNote(candidate))}</span></div>
        <div class="generation-interest" aria-label="Interest in ${escapeHtml(candidate.title || candidate.code)}">
          ${["interested", "maybe", "avoid"].map((bucket) => `<button type="button" data-decision-bucket="${bucket}" data-decision-course="${escapeHtml(candidate.code)}" class="${selected(candidate.code, bucket) ? "selected" : ""}" aria-pressed="${selected(candidate.code, bucket)}">${bucket[0].toUpperCase()}${bucket.slice(1)}</button>`).join("")}
        </div>
      </article>`).join("");
    return `
      <section class="generation-decision" data-decision-group="${escapeHtml(decision.decisionId || decision.requirementGroupId)}">
        <div class="generation-progress">Choice ${index + 1} of ${total}</div>
        <h2>${escapeHtml(decision.label || "Choose courses")}</h2>
        <p>${Number(decision.slotCount) > 1 ? "Mark as many as you can. More preferences help us build a better path." : "Mark what sounds useful. We’ll balance your interests with prerequisites and degree progress."}</p>
        <p class="generation-guidance">Avoid is a preference; a course may still be needed to unlock the path you choose.</p>
        <div class="generation-candidates">${candidates}</div>
        <div class="generation-delegate"><button type="button" data-decision-recommend class="choice-btn secondary">Choose for me</button></div>
      </section>`;
  }

  function renderRecommendations({ result = {}, requirements = [] } = {}) {
    const requirementById = new Map((requirements || []).map((item) => [item.id, item]));
    const explanationByCourse = new Map((result.explanations || []).map((item) => [item.courseCode, item]));
    const cards = (result.selectedCourses || []).map((course) => {
      const covered = (course.coverageRequirementIds || []).map((id) => requirementById.get(id)?.label || id);
      const explanation = explanationByCourse.get(course.code);
      let summary = course.prerequisiteOnly
        ? "Needed to unlock a recommended course."
        : covered.length > 1
          ? `Covers ${covered.slice(0, -1).join(", ")}${covered.length > 2 ? "," : ""} and ${covered.at(-1)}.`
          : covered.length === 1 ? `Fulfills ${covered[0]}.` : "Supports the recommended course path.";
      if (explanation?.type === "preference_override") summary = "Needed as a prerequisite even though you marked it Avoid.";
      const replacementId = course.coverageRequirementIds?.[0];
      return `<article class="generation-recommendation">
        <div><strong>${escapeHtml(course.title || course.code)}</strong><code>${escapeHtml(course.code)}</code><p>${escapeHtml(summary)}</p></div>
        ${replacementId ? `<button type="button" class="quiet-action" data-replace-requirement="${escapeHtml(replacementId)}">Replace</button>` : ""}
      </article>`;
    }).join("");
    return `<section class="generation-review"><h2>Recommended courses</h2><p>Review these choices before they enter your four-year plan.</p><div class="generation-recommendations">${cards}</div></section>`;
  }

  function captureListScroll(document) {
    return Number(document?.querySelector?.(".generation-candidates")?.scrollTop) || 0;
  }

  function restoreListScroll(document, scrollTop) {
    const list = document?.querySelector?.(".generation-candidates");
    if (list) list.scrollTop = Math.max(0, Number(scrollTop) || 0);
  }

  root.ScheduleRUGenerationDecisionsView = { renderDecision, renderRecommendations, captureListScroll, restoreListScroll };
})(globalThis);
