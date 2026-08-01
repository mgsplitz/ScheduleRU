import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const shell = await readFile(new URL("../../index.html", import.meta.url), "utf8");

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
    /<script src="apps\/web\/src\/guided-setup-controller\.js"><\/script>/,
  );
  assert.doesNotMatch(shell, /<style>/);
  assert.doesNotMatch(shell, /<script>\s/);
});
