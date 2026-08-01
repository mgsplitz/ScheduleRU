import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { programDefinition, requirementGroup } from "./helpers/catalog-snapshot.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const seed = fs.readFileSync(
  path.join(here, "..", "schema", "seed_rbs_areas_of_study_draft.sql"),
  "utf8"
);

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
  assert.doesNotMatch(seed, /'22:620:320'/);
  assert.match(seed, /'33:620:320'/);
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
