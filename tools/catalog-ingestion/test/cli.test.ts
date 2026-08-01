import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  serializeCatalogReviewBacklogSnapshot,
} from "@scheduleru/catalog-ingestion";
import { runCatalogIngestionCli } from "../src/cli.ts";

function backlog() {
  return {
    contract_version: 1,
    review_notes: [{
      program_id: "example-major",
      section_name: "Electives",
      raw_text: "Choose an approved course.",
      resolved: false,
    }],
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
      now: () => 1785542400000,
    },
    stdout,
    stderr,
  };
}

test("rejects production API targets without a request", async () => {
  let called = false;
  const state = dependencies(async () => {
    called = true;
    return new Response();
  });
  const result = await runCatalogIngestionCli([
    "snapshot",
    "--api",
    "https://rutgers-course-sync.example.workers.dev",
    "--output",
    "unused.json",
  ], state.overrides);
  assert.equal(result, 1);
  assert.equal(called, false);
});

test("snapshots and restores a validated review backlog", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-ingestion-cli-"));
  try {
    const snapshotPath = join(directory, "review-backlog.json");
    let restored: unknown = null;
    const state = dependencies(async (_input, init) => {
      if (init?.method === "PUT") {
        restored = JSON.parse(String(init.body));
        return Response.json({ ok: true });
      }
      return Response.json({ backlog: backlog() });
    });
    assert.equal(await runCatalogIngestionCli([
      "snapshot",
      "--api",
      "https://rutgers-course-sync-dev.example.workers.dev",
      "--output",
      snapshotPath,
    ], state.overrides), 0);
    assert.equal(await runCatalogIngestionCli([
      "restore",
      "--api",
      "https://rutgers-course-sync-dev.example.workers.dev",
      "--snapshot",
      snapshotPath,
      "--manifest",
      join(directory, "review-backlog.manifest.json"),
    ], state.overrides), 0);
    assert.deepEqual(restored, JSON.parse(await readFile(snapshotPath, "utf8")));
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("rejects a tampered snapshot before network access", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-ingestion-cli-"));
  try {
    const snapshot = await serializeCatalogReviewBacklogSnapshot(backlog(), {
      generated_at: 1785542400000,
    });
    const snapshotPath = join(directory, "backlog.json");
    const manifestPath = join(directory, "backlog.manifest.json");
    await writeFile(snapshotPath, `${snapshot.json} `);
    await writeFile(manifestPath, JSON.stringify(snapshot.manifest));
    let called = false;
    const state = dependencies(async () => {
      called = true;
      return Response.json({});
    });
    assert.equal(await runCatalogIngestionCli([
      "restore",
      "--api",
      "https://rutgers-course-sync-dev.example.workers.dev",
      "--snapshot",
      snapshotPath,
      "--manifest",
      manifestPath,
    ], state.overrides), 1);
    assert.equal(called, false);
  } finally {
    await rm(directory, { recursive: true });
  }
});

test("round-trip restores the snapshot and records exact semantic parity", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-ingestion-cli-"));
  try {
    const snapshot = await serializeCatalogReviewBacklogSnapshot(backlog(), {
      generated_at: 1785542400000,
    });
    const snapshotPath = join(directory, "backlog.json");
    const manifestPath = join(directory, "backlog.manifest.json");
    const reportPath = join(directory, "backlog.parity.json");
    await writeFile(snapshotPath, snapshot.json);
    await writeFile(manifestPath, JSON.stringify(snapshot.manifest));
    let writes = 0;
    const state = dependencies(async (_input, init) => {
      if (init?.method === "PUT") writes += 1;
      return init?.method === "PUT"
        ? Response.json({ ok: true })
        : Response.json({ backlog: backlog() });
    });
    assert.equal(await runCatalogIngestionCli([
      "round-trip",
      "--api",
      "https://rutgers-course-sync-dev.example.workers.dev",
      "--snapshot",
      snapshotPath,
      "--manifest",
      manifestPath,
      "--report",
      reportPath,
    ], state.overrides), 0);
    assert.equal(writes, 1);
    const report = JSON.parse(await readFile(reportPath, "utf8"));
    assert.equal(report.ok, true);
    assert.equal(report.before_sha256, report.after_sha256);
    assert.deepEqual(report.differences, []);
  } finally {
    await rm(directory, { recursive: true });
  }
});
