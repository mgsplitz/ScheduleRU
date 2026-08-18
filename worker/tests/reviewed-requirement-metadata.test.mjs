import assert from "node:assert/strict";
import test from "node:test";
import { programDefinition, requirementGroup } from "./helpers/catalog-snapshot.mjs";

test("reviewed requirement metadata preserves Global Business titles outside the current term catalog", () => {
  const elective = requirementGroup(
    "rbsnb-global-business-concentration",
    "rbsnb-global-business-concentration-elective",
  );
  const titles = new Map(elective.courses.map(({ code, title }) => [code, title]));
  for (const [code, title] of [
    ["33:620:320", "Cross-Cultural Management"],
    ["33:620:370", "Diversity, Equity, and Inclusion in Management and Organizations"],
    ["33:620:475", "International Entrepreneurship"],
    ["33:630:371", "International Marketing"],
  ]) {
    assert.equal(titles.get(code), title);
  }
  assert.equal(titles.has("22:620:320"), false);
  assert.equal(titles.has("33:620:320"), true);
});

test("every formerly repaired reviewed group now owns durable course titles", () => {
  for (const [programId, groupId] of [
    ["rbsnb-business-administration-minor", "rbsnb-business-administration-minor-required"],
    ["rbsnb-business-analytics-concentration", "rbsnb-business-analytics-concentration-required"],
    ["rbsnb-entrepreneurship-concentration", "rbsnb-entrepreneurship-concentration-elective"],
    ["rbsnb-finance-concentration", "rbsnb-finance-concentration-required"],
    ["rbsnb-foundational-core", "rbsnb-foundational-core-g1"],
    ["rbsnb-global-business-concentration", "rbsnb-global-business-concentration-required"],
    ["rbsnb-management-information-systems-concentration", "rbsnb-management-information-systems-concentration-required"],
    ["rbsnb-professional-selling-concentration", "rbsnb-professional-selling-concentration-required"],
  ]) {
    assert.ok(
      requirementGroup(programId, groupId).courses.every(({ title }) => title?.trim()),
      `${groupId} contains an untitled course`,
    );
    assert.equal(programDefinition(programId).program.review_status, "reviewed");
  }
});

test("reviewed Computer Science choice pools keep titles when courses are absent from the active term", () => {
  for (const [programId, groupId] of [
    ["sasnb-computer-science-ba", "sasnb-computer-science-ba-cs-electives"],
    ["sasnb-computer-science-bs", "sasnb-computer-science-bs-cs-electives"],
    ["sasnb-computer-science-minor", "sasnb-computer-science-minor-approved-courses"],
  ]) {
    const courses = requirementGroup(programId, groupId).courses;
    assert.ok(courses.length > 0, `${groupId} must retain its reviewed choices`);
    assert.ok(
      courses.every(({ code, title }) => title?.trim() && title.trim() !== code),
      `${groupId} contains a course whose only label is its code`,
    );
  }

  const minorTitles = new Map(
    requirementGroup(
      "sasnb-computer-science-minor",
      "sasnb-computer-science-minor-approved-courses",
    ).courses.map(({ code, title }) => [code, title]),
  );
  assert.equal(minorTitles.get("01:198:442"), "Topics in Computer Science");
  assert.equal(minorTitles.get("01:198:452"), "Formal Languages and Automata");
});
