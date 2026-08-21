/* Plain-language rendering for one guided generation decision at a time. */
(function exposeGenerationDecisionsView(root) {
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");

  function prerequisiteNote(candidate) {
    const sizes = (candidate.prerequisitePaths || []).map((path) => path.length).filter((size) => size > 0);
    if (!sizes.length) return "No prerequisites listed in the official catalog";
    const count = Math.min(...sizes);
    return `Builds on ${count} course${count === 1 ? "" : "s"}`;
  }

  function rankedCandidates(candidates) {
    const unlocks = new Map();
    (candidates || []).forEach((candidate) => {
      const dependencies = new Set([...(candidate.prerequisitePaths || []), ...(candidate.enforceablePrerequisitePaths || [])].flat());
      dependencies.forEach((code) => unlocks.set(code, (unlocks.get(code) || 0) + 1));
    });
    const prerequisiteBurden = (candidate) => {
      const sizes = (candidate.prerequisitePaths || []).map((path) => path.length).filter(Boolean);
      return sizes.length ? Math.min(...sizes) : 0;
    };
    return [...(candidates || [])].sort((left, right) =>
      (unlocks.get(right.code) || 0) - (unlocks.get(left.code) || 0)
      || prerequisiteBurden(left) - prerequisiteBurden(right)
      || String(left.title || left.code).localeCompare(String(right.title || right.code)));
  }

  function renderDecision({ decision = {}, preference = {}, globalPreference = {}, index = 0, total = 1, expanded = false, search = "" } = {}) {
    if (decision.coreStrategy) return `
      <section class="generation-decision generation-core-strategy" data-decision-group="${escapeHtml(decision.decisionId || decision.requirementGroupId)}">
        <div class="generation-progress">Choice ${index + 1} of ${total}</div>
        <h2>${escapeHtml(decision.label)}</h2>
        <p>We can maximize overlap with your majors and minors so you have more room for courses you care about.</p>
        <div class="generation-core-options" role="radiogroup" aria-label="Core course planning preference">
          <button type="button" data-core-mode="recommend_for_me" class="choice-btn secondary ${preference.mode === "recommend_for_me" ? "selected" : ""}" role="radio" aria-checked="${preference.mode === "recommend_for_me"}"><strong>Optimize them for me</strong><span>Prioritize courses that complete the most requirements.</span></button>
          <button type="button" data-core-mode="ranked" class="choice-btn secondary ${preference.mode === "ranked" ? "selected" : ""}" role="radio" aria-checked="${preference.mode === "ranked"}"><strong>Let me choose</strong><span>Show the remaining Core areas after program choices.</span></button>
        </div>
      </section>`;
    const selected = (code, bucket) => (preference[bucket] || []).includes(code);
    const locallyRated = new Set(["interested", "maybe", "avoid"].flatMap((bucket) => preference[bucket] || []));
    const globallyRated = new Set(["interested", "maybe", "avoid"].flatMap((bucket) => globalPreference[bucket] || []));
    const available = rankedCandidates((decision.candidates || []).filter((candidate) => !globallyRated.has(candidate.code) || locallyRated.has(candidate.code)));
    const query = String(search || "").trim().toLowerCase();
    const filtered = query ? available.filter((candidate) => `${candidate.title || ""} ${candidate.code || ""}`.toLowerCase().includes(query)) : available;
    const visible = expanded || query ? filtered : filtered.slice(0, 8);
    const candidates = visible.map((candidate) => `
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
        <p>${decision.guidanceOnly ? "These courses fill the same role. Mark the one you prefer, or skip this path." : Number(decision.slotCount) > 1 ? "Mark as many as you can. More preferences help us build a better path." : "Mark what sounds useful. We’ll balance your interests with prerequisites and degree progress."}</p>
        <p class="generation-guidance">Avoid is a preference; a course may still be needed to unlock the path you choose.</p>
        ${available.length > 8 ? `<div class="generation-candidate-tools"><strong>Best matches</strong><input type="search" data-decision-search value="${escapeHtml(search)}" placeholder="Search ${available.length} courses" aria-label="Search course choices"></div>` : ""}
        <div class="generation-candidates">${candidates || `<p class="generation-empty">${query ? "No courses match that search." : "Your earlier ratings already cover these choices."}</p>`}</div>
        ${available.length > 8 ? `<div class="generation-expand"><button type="button" class="quiet-action" data-decision-expand>${expanded ? "Show best matches" : `Show all ${available.length}`}</button></div>` : ""}
        <div class="generation-delegate"><button type="button" data-decision-recommend class="choice-btn secondary ${preference.mode === "recommend_for_me" ? "selected" : ""}" aria-pressed="${preference.mode === "recommend_for_me"}">Choose for me</button></div>
      </section>`;
  }

  function renderRecommendations({ result = {}, requirements = [] } = {}) {
    const requirementById = new Map((requirements || []).map((item) => [item.id, item]));
    const explanationByCourse = new Map((result.explanations || []).map((item) => [item.courseCode, item]));
    const cards = (result.selectedCourses || []).map((course) => {
      const covered = (course.coverageRequirementIds || []).map((id) =>
        String(requirementById.get(id)?.label || id).replace(/[.\s]+$/, ""));
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
    return Number(document?.querySelector?.(".app-modal-card")?.scrollTop) || 0;
  }

  function restoreListScroll(document, scrollTop) {
    const list = document?.querySelector?.(".app-modal-card");
    if (list) list.scrollTop = Math.max(0, Number(scrollTop) || 0);
  }

  root.ScheduleRUGenerationDecisionsView = { renderDecision, renderRecommendations, captureListScroll, restoreListScroll };
})(globalThis);
