import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const migration = fs.readFileSync(
  path.join(here, "..", "schema", "review_rbs_requirement_course_metadata.sql"),
  "utf8"
);
const seed = fs.readFileSync(
  path.join(here, "..", "schema", "seed_rbs_areas_of_study_draft.sql"),
  "utf8"
);

test("reviewed requirement metadata preserves Global Business titles outside the current term catalog", () => {
  for (const [code, title] of [
    ["33:620:320", "Cross-Cultural Management"],
    ["33:620:370", "Diversity, Equity, and Inclusion in Management and Organizations"],
    ["33:620:475", "International Entrepreneurship"],
    ["33:630:371", "International Marketing"],
  ]) {
    assert.match(migration, new RegExp(`WHEN '${code}' THEN '${title}'`));
  }
  assert.match(migration, /rbsnb-global-business-concentration-elective/);
  assert.doesNotMatch(seed, /'22:620:320'/);
  assert.match(seed, /'33:620:320'/);
});

test("metadata repair covers every reviewed program group that lacked durable titles", () => {
  for (const groupId of [
    "rbsnb-business-administration-minor-required",
    "rbsnb-business-analytics-concentration-required",
    "rbsnb-entrepreneurship-concentration-elective",
    "rbsnb-finance-concentration-required",
    "rbsnb-foundational-core-g1",
    "rbsnb-global-business-concentration-required",
    "rbsnb-management-information-systems-concentration-required",
    "rbsnb-professional-selling-concentration-required",
  ]) {
    assert.match(migration, new RegExp(groupId));
  }
});
