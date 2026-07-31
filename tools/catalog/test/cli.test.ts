import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

import { runCatalogCli } from "../src/cli.ts";

const cliPath = new URL("../src/cli.ts", import.meta.url);

function definition(): Record<string, unknown> {
  return {
    contract_version: 1,
    program: {
      id: "sasnb-example-minor",
      name: "Example Studies",
      school_slug: "sasnb",
      program_slug: "example-studies",
      type: "minor",
      catalog_year: "2026-2027",
      academic_program_code: "999",
      degree_type: null,
      program_family_id: "sasnb-example-999",
      source_url: "https://example.rutgers.edu/requirements",
      review_status: "reviewed",
      requirement_evidence_required: true,
    },
    sources: [{
      id: "requirements",
      url: "https://example.rutgers.edu/requirements",
      title: "Example requirements",
      catalog_year: "2026-2027",
      scope: "program_requirements",
      accessed_at: 1785456000000,
      note: "Official requirements.",
    }],
    requirement_groups: [{
      id: "sasnb-example-minor-core",
      parent_group_id: null,
      name: "Core",
      rule: "all",
      count: null,
      sort_order: 10,
      display_family: null,
      display_priority: 0,
      courses: [{
        code: "01:999:101",
        title: "Introduction",
        credits: 3,
        note: null,
        evidence: {
          source_id: "requirements",
          reviewer_note: "Required introduction.",
          review_status: "reviewed",
        },
      }],
      selectors: [],
      conditions: [],
      evidence: {
        source_id: "requirements",
        reviewer_note: "Official core.",
        review_status: "reviewed",
      },
    }],
    eligibility_rules: [],
  };
}

async function definitionFile(value = definition()): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "scheduleru-catalog-"));
  const file = path.join(directory, "program.json");
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

function runCli(
  args: string[],
  environment: Record<string, string | undefined> = {},
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath.pathname, ...args], {
      env: { ...process.env, ...environment },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("validate exits successfully for a complete definition", async () => {
  const file = await definitionFile();

  const result = await runCli(["validate", file]);

  assert.equal(result.code, 0);
  assert.match(result.stdout, /valid catalog definition: sasnb-example-minor/);
  assert.equal(result.stderr, "");
});

test("validate reports path-addressed issues and a failing exit code", async () => {
  const value = definition();
  (value.program as Record<string, unknown>).name = "";
  const file = await definitionFile(value);

  const result = await runCli(["validate", file]);

  assert.equal(result.code, 1);
  assert.match(result.stderr, /program\.name: must be a non-empty string/);
});

test("publish rejects production API targets before making a request", async () => {
  const file = await definitionFile();
  const output: string[] = [];
  let fetched = false;

  const code = await runCatalogCli(
    [
      "publish",
      file,
      "--api",
      "https://rutgers-course-sync.housselllaura.workers.dev",
    ],
    {
      environment: { SCHEDULERU_ADMIN_SECRET: "do-not-print" },
      fetch: async () => {
        fetched = true;
        return new Response();
      },
      stdout: (line) => output.push(line),
      stderr: (line) => output.push(line),
    },
  );

  assert.equal(code, 1);
  assert.equal(fetched, false);
  assert.match(output.join("\n"), /development API target/);
  assert.doesNotMatch(output.join("\n"), /do-not-print/);
});

test("publish reads the secret from the environment and sends the exact definition", async () => {
  const file = await definitionFile();
  const output: string[] = [];
  let received: Request | undefined;

  const code = await runCatalogCli(
    [
      "publish",
      file,
      "--api",
      "http://127.0.0.1:8787",
    ],
    {
      environment: { SCHEDULERU_ADMIN_SECRET: "local-test-secret" },
      fetch: async (input, init) => {
        received = new Request(input, init);
        return Response.json({
        ok: true,
        publication: { program_id: "sasnb-example-minor" },
        });
      },
      stdout: (line) => output.push(line),
      stderr: (line) => output.push(line),
    },
  );

  assert.equal(code, 0);
  assert.ok(received);
  assert.equal(received.method, "PUT");
  assert.equal(
    new URL(received.url).pathname,
    "/api/admin/catalog/program-definitions/sasnb-example-minor",
  );
  assert.equal(received.headers.get("Authorization"), "Bearer local-test-secret");
  assert.deepEqual(await received.json(), definition());
  assert.match(output.join("\n"), /published catalog definition: sasnb-example-minor/);
  assert.doesNotMatch(output.join("\n"), /local-test-secret/);
});

test("publish fails before network access when the secret is missing", async () => {
  const file = await definitionFile();
  const errors: string[] = [];

  const code = await runCatalogCli(
    ["publish", file, "--api", "http://127.0.0.1:8787"],
    {
      environment: {},
      fetch: async () => {
        throw new Error("network must not be reached");
      },
      stdout: () => {},
      stderr: (line) => errors.push(line),
    },
  );

  assert.equal(code, 1);
  assert.match(errors.join("\n"), /SCHEDULERU_ADMIN_SECRET/);
});
