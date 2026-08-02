import assert from "node:assert/strict";
import test from "node:test";
import { programApiSource as worker } from "./helpers/program-api-source.mjs";

function routeBlock(start, end) {
  const startIndex = worker.indexOf(start);
  assert.notEqual(startIndex, -1, `missing route start: ${start}`);
  const endIndex = worker.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing route end: ${end}`);
  return worker.slice(startIndex, endIndex);
}

test("public program routes hide reviewed programs with incomplete requirement evidence", () => {
  assert.match(
    worker,
    /import\s+\{\s*requirementEvidenceComplete,?\s*\}\s+from\s+"\.\/programs\/requirement-evidence\.js"/,
  );
  assert.match(worker, /async function programHasCompleteRequirementEvidence\(env, program\)/);
  assert.match(worker, /requirementEvidenceComplete\(\{\s*required:\s*true,/);

  const programList = routeBlock(
    'if (path === "/api/programs" && request.method === "GET")',
    'if (path === "/api/core-curricula" && request.method === "GET")'
  );
  assert.match(programList, /programHasCompleteRequirementEvidence\(env, program\)/);

  const directRequirements = routeBlock(
    'if (path.match(/^\\/api\\/programs\\/[^/]+\\/requirements$/) && request.method === "GET")',
    'if (path === "/api/requirements" && request.method === "GET")'
  );
  assert.match(directRequirements, /programHasCompleteRequirementEvidence\(env, program\)/);

  const comparisonRequirements = routeBlock(
    'if (path === "/api/requirements" && request.method === "GET")',
    'if (path === "/api/course-eligibility" && request.method === "GET")'
  );
  assert.match(comparisonRequirements, /programHasCompleteRequirementEvidence\(env, program\)/);

  const selectionCheck = routeBlock(
    'if (path === "/api/program-selection-check" && request.method === "POST")',
    'export async function handleProgramAdminRoute'
  );
  assert.match(selectionCheck, /programHasCompleteRequirementEvidence\(env, program\)/);
});
