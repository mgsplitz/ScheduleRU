import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const seed = await readFile(
  new URL("../schema/reviewed_course_prerequisites.sql", import.meta.url),
  "utf8"
);

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
