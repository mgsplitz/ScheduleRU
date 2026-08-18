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
      <section class="generation-decision" data-decision-group="${escapeHtml(decision.requirementGroupId)}">
        <div class="generation-progress">Choice ${index + 1} of ${total}</div>
        <h2>${escapeHtml(decision.label || "Choose courses")}</h2>
        <p>Mark what sounds useful. We’ll balance your interests with prerequisites and degree progress.</p>
        <p class="generation-guidance">Avoid is a preference; a course may still be needed to unlock the path you choose.</p>
        <div class="generation-candidates">${candidates}</div>
        <div class="generation-delegate"><button type="button" data-decision-recommend class="choice-btn secondary">Choose for me</button>${decision.canDefer ? `<button type="button" data-decision-defer class="choice-btn secondary">I’ll do this later</button>` : ""}</div>
      </section>`;
  }

  root.ScheduleRUGenerationDecisionsView = { renderDecision };
})(globalThis);
