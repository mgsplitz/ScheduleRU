import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  serializeReferenceDataSnapshot,
} from "@scheduleru/reference-data";
import { runReferenceDataCli } from "../src/cli.ts";

function bundle() {
  return {
    contract_version: 1,
    school_profiles: [],
    school_curriculum_modules: [],
    program_selection_limits: [],
    program_combination_policies: [],
    double_count_rules: [],
    double_count_policies: [],
    double_count_exceptions: [],
    requirement_course_equivalencies: [],
    course_prerequisite_substitutions: [],
    ap_equivalencies: [],
    course_eligibility_reviews: [],
    course_eligibility_conditions: [],
    course_credit_exclusion_policies: [],
    course_credit_exclusion_members: [],
  };
}

function dependencies(fetch: typeof globalThis.fetch) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    overrides: {
      environment: { SCHEDULERU_ADMIN_SECRET: "test-secret" },
      fetch,
      stdout: (line: string) => stdout.push(line),
      stderr: (line: string) => stderr.push(line),
      now: () => 1785456000000,
    },
    stdout,
    stderr,
  };
}

test("refuses production targets without making a request", async () => {
  let called = false;
  const state = dependencies(async () => {
    called = true;
    return new Response();
  });
  const code = await runReferenceDataCli([
    "snapshot",
    "--api",
    "https://rutgers-course-sync.example.workers.dev",
    "--output",
    "unused.json",
  ], state.overrides);
  assert.equal(code, 1);
  assert.equal(called, false);
});

test("snapshots and restores a validated development bundle", async () => {
  const directory = await mkdtemp(join(tmpdir(), "reference-data-cli-"));
  try {
    const snapshotPath = join(directory, "reference-data.json");
    let restored: unknown = null;
    const state = dependencies(async (_input, init) => {
      if (init?.method === "PUT") {
        restored = JSON.parse(String(init.body));
        return Response.json({ ok: true });
      }
      return Response.json({ bundle: bundle() });
    });
    assert.equal(
      await runReferenceDataCli([
        "snapshot",
        "--api",
        "https://rutgers-course-sync-dev.example.workers.dev",
        "--output",
        snapshotPath,
      ], state.overrides),
      0,
    );
    const manifestPath = join(directory, "reference-data.manifest.json");
    assert.equal(
      await runReferenceDataCli([
        "restore",
        "--api",
        "https://rutgers-course-sync-dev.example.workers.dev",
        "--snapshot",
        snapshotPath,
        "--manifest",
        manifestPath,
      ], state.overrides),
      0,
    );
    assert.deepEqual(restored, JSON.parse(await readFile(snapshotPath, "utf8")));
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("rejects a tampered snapshot before sending a restore", async () => {
  const directory = await mkdtemp(join(tmpdir(), "reference-data-cli-"));
  try {
    const value = await serializeReferenceDataSnapshot(bundle(), {
      generated_at: 1785456000000,
    });
    const snapshotPath = join(directory, "snapshot.json");
    const manifestPath = join(directory, "manifest.json");
    await writeFile(snapshotPath, `${value.json} `);
    await writeFile(manifestPath, JSON.stringify(value.manifest));
    let called = false;
    const state = dependencies(async () => {
      called = true;
      return Response.json({});
    });
    assert.equal(
      await runReferenceDataCli([
        "restore",
        "--api",
        "https://rutgers-course-sync-dev.example.workers.dev",
        "--snapshot",
        snapshotPath,
        "--manifest",
        manifestPath,
      ], state.overrides),
      1,
    );
    assert.equal(called, false);
  } finally {
    await rm(directory, { recursive: true });
  }
});
