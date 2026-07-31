import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const seed = await readFile(
  new URL("../schema/reviewed_course_prerequisites.sql", import.meta.url),
  "utf8"
);
const schemaDirectory = new URL("../schema/", import.meta.url);
const reviewedEligibilitySeed = (
  await Promise.all(
    (await readdir(schemaDirectory))
      .filter((name) => name.endsWith(".sql"))
      .map((name) => readFile(new URL(name, schemaDirectory), "utf8"))
  )
).join("\n");

test("reviewed source records cover the two non-current-term prerequisite regressions", () => {
  assert.match(seed, /'01:220:481'/);
  assert.match(seed, /'33:136:405'/);
  assert.match(seed, /economics\.rutgers\.edu/);
  assert.match(seed, /business\.rutgers\.edu/);
});

test("Economics of Uncertainty keeps all three prerequisite groups as alternatives", () => {
  assert.match(seed, /01:220:320/);
  assert.match(seed, /\["01:960:211","01:960:285"\]/);
  assert.match(seed, /\["01:640:136","01:640:152"\]/);
});

test("Risk Modeling requires the reviewed RBS concentration prerequisite", () => {
  assert.match(seed, /33:136:386/);
});

test("College Writing has a source-backed review instead of raw catalog prerequisites", () => {
  assert.match(reviewedEligibilitySeed, /'01:355:101'/);
  assert.match(reviewedEligibilitySeed, /'reviewed',\s*1,/);
  assert.match(reviewedEligibilitySeed, /sasundergrad\.rutgers\.edu/);
});
