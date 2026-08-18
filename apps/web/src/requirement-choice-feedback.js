/* Transient DOM feedback after a requirement choice returns to the planner. */
(function exposeRequirementChoiceFeedback(root) {
  function highlightCourse({
    document,
    courseCode,
    setTimeout = root.setTimeout,
    duration = 1200,
  } = {}) {
    const card = [...(document?.querySelectorAll?.(".sc-card[data-id]") || [])]
      .find((element) => element?.dataset?.id === courseCode);
    if (!card) return false;
    card.classList.add("recent-requirement-choice");
    card.scrollIntoView?.({ behavior: "smooth", block: "center" });
    setTimeout?.(() => card.classList.remove("recent-requirement-choice"), duration);
    return true;
  }

  root.ScheduleRURequirementChoiceFeedback = { highlightCourse };
})(globalThis);
