/* Student-facing issue copy. Technical details remain available to diagnostics. */
(function exposeUserMessageModel(root) {
  function issueCode(issue) {
    return typeof issue === "string" ? issue : String(issue?.code || "unknown_error");
  }

  function presentation(issue, values) {
    return {
      ...values,
      secondaryAction: values.secondaryAction || null,
      detail: typeof issue === "object" && issue !== null ? issue.detail || null : null,
    };
  }

  function presentIssue(issue = {}) {
    const code = issueCode(issue);
    if (code === "backend_not_found") return presentation(issue, {
      title: "We couldn't find that information",
      message: "The requested Rutgers record was not found. Your saved plan has not changed.",
      primaryAction: "Try again",
      secondaryAction: "Return to planner",
    });
    if (code === "backend_unavailable") return presentation(issue, {
      title: "We couldn't connect",
      message: "Check your internet connection, then try again. Your saved plan is still here.",
      primaryAction: "Try again",
      secondaryAction: "Return to planner",
    });
    if (code === "backend_not_configured") return presentation(issue, {
      title: "ScheduleRU needs a connection",
      message: "The course data service is not connected on this device.",
      primaryAction: "Connect course data",
    });
    if (code === "invalid_response") return presentation(issue, {
      title: "We couldn't read the latest data",
      message: "The latest Rutgers data arrived in an unexpected format. Please try again in a moment.",
      primaryAction: "Try again",
      secondaryAction: "Return to planner",
    });
    if (code === "backend_http_error") return presentation(issue, {
      title: "Course data is temporarily unavailable",
      message: "ScheduleRU could not load the latest information. Your saved plan has not changed.",
      primaryAction: issue?.retryable === false ? "Return to planner" : "Try again",
    });
    if (code === "plan_capacity_exceeded") return presentation(issue, {
      title: "This plan needs more room",
      message: issue?.overByCredits
        ? `Your selections need at least ${issue.overByCredits} more credit${issue.overByCredits === 1 ? "" : "s"} than the current four-year plan allows.`
        : "Your selected requirements need more credits than the current four-year plan allows.",
      primaryAction: "Review selections",
      secondaryAction: "Review completed credit",
    });
    if (code === "plan_course_slots_exceeded") return presentation(issue, {
      title: "This plan has too many course slots",
      message: "The selected requirements cannot all fit within the current semester limits.",
      primaryAction: "Review selections",
    });
    if (code === "plan_sequence_capacity_exceeded") return presentation(issue, {
      title: "A course sequence needs more time",
      message: "A required prerequisite or class-standing sequence extends past the final planned semester.",
      primaryAction: "Review course order",
      secondaryAction: "Review selections",
    });
    if (code === "locked_prerequisite_violation") return presentation(issue, {
      title: "A pinned course is too early",
      message: `${issue?.courseCode || "A course"} is pinned before a required earlier course can be completed.`,
      primaryAction: "Review pinned courses",
    });
    if (code === "courses_unplaced") return presentation(issue, {
      title: "Some required courses could not be placed",
      message: "Their prerequisites, timing, or semester limits conflict with the current plan.",
      primaryAction: "Review course order",
    });
    if (code === "requirements_unplaced") return presentation(issue, {
      title: "Some choices still need a semester",
      message: "One or more unresolved requirements could not fit within the current semester limits.",
      primaryAction: "Review selections",
    });
    if (code === "plan_feasibility_inconclusive") return presentation(issue, {
      title: "We couldn't finish checking this plan",
      message: "The planner stopped before it could confirm a safe four-year arrangement. Your current plan has not changed.",
      primaryAction: "Review selections",
    });
    if (code === "source_conflict") return presentation(issue, {
      title: "Rutgers sources disagree",
      message: "Two official sources show different requirement information. Review the source notes before relying on this choice.",
      primaryAction: "Review source details",
      secondaryAction: "Ask advising",
    });
    if (code === "eligibility_rule_unresolved") return presentation(issue, {
      title: "Check this course before registration",
      message: `${issue?.courseCode || "This course"} has a Rutgers enrollment condition that requires direct confirmation.`,
      primaryAction: "Check course details",
    });
    if (code === "optional_courses_unplaced") return presentation(issue, {
      title: "Some wishlist courses were left out",
      message: "Required courses were placed first. You can review the wishlist and try another arrangement.",
      primaryAction: "Review wishlist",
    });
    return presentation(issue, {
      title: "Something went wrong",
      message: "ScheduleRU could not complete that action. Your saved plan has not changed.",
      primaryAction: "Try again",
      secondaryAction: "Return to planner",
    });
  }

  function groupIssues(issues = [], { limit = 3 } = {}) {
    const groups = new Map();
    for (const issue of issues) {
      const shown = presentIssue(issue);
      const key = shown.primaryAction;
      const group = groups.get(key) || { ...shown, count: 0, issues: [] };
      group.count += 1;
      group.issues.push(issue);
      groups.set(key, group);
    }
    return [...groups.values()].slice(0, Math.max(0, limit));
  }

  root.ScheduleRUUserMessageModel = { presentIssue, groupIssues };
})(globalThis);
