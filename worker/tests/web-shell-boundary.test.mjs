import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shell = await readFile(new URL("../../index.html", import.meta.url), "utf8");
const headers = await readFile(new URL("../../_headers", import.meta.url), "utf8");

test("the HTML shell delegates presentation and controller code to apps/web", () => {
  assert.match(
    shell,
    /<link rel="stylesheet" href="apps\/web\/styles\/app\.css"\/>/,
  );
  assert.match(
    shell,
    /<script src="apps\/web\/src\/planner-controller\.js"><\/script>/,
  );
  assert.match(
    shell,
    /<script src="apps\/web\/src\/backend-client\.js"><\/script>[\s\S]*<script src="apps\/web\/src\/planner-controller\.js"><\/script>/,
  );
  assert.match(
    shell,
    /<script src="apps\/web\/src\/academic-credit-controller\.js"><\/script>[\s\S]*<script src="apps\/web\/src\/planner-controller\.js"><\/script>/,
  );
  assert.match(
    shell,
    /<script src="apps\/web\/src\/guided-setup-controller\.js"><\/script>/,
  );
  assert.doesNotMatch(shell, /<style>/);
  assert.doesNotMatch(shell, /<script>\s/);
});

test("the static shell revalidates changed application assets", () => {
  assert.match(shell, /candidate-coverage-model\.js\?v=\d{8}\.\d+/);
  assert.match(shell, /course-set-optimizer\.js\?v=\d{8}\.\d+/);
  assert.match(headers, /\/\*[\s\S]*Cache-Control: no-cache, must-revalidate/);
});
