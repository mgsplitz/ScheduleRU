import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  serializeCatalogSourceSnapshot,
} from "@scheduleru/catalog-sources";
import { runCatalogSourceCli } from "../src/cli.ts";

function bundle(): Record<string, unknown> {
  return { contract_version: 1, sources: [] };
}

function dependencies(fetch: typeof globalThis.fetch = globalThis.fetch) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    stdout,
    stderr,
    values: {
      environment: { SCHEDULERU_ADMIN_SECRET: "test-secret" },
      fetch,
      stdout: (line: string) => stdout.push(line),
      stderr: (line: string) => stderr.push(line),
      now: () => 1785542400000,
    },
  };
}

test("validates local configuration with path-addressed diagnostics", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-sources-"));
  const file = join(directory, "bundle.json");
  await writeFile(file, JSON.stringify({ contract_version: 1, sources: "bad" }));
  const io = dependencies();
  assert.equal(await runCatalogSourceCli(["validate", file], io.values), 1);
  assert.match(io.stderr.join("\n"), /sources/);
});

test("rejects production API targets before making a request", async () => {
  let called = false;
  const io = dependencies(async () => {
    called = true;
    return new Response();
  });
  assert.equal(
    await runCatalogSourceCli(
      ["snapshot", "--api", "https://api.scheduleru.example", "--output", "x"],
      io.values,
    ),
    1,
  );
  assert.equal(called, false);
  assert.match(io.stderr.join("\n"), /development API/);
});

test("snapshots and restores through the development-only endpoint", async () => {
  const directory = await mkdtemp(join(tmpdir(), "catalog-sources-"));
  const snapshotFile = join(directory, "sources.json");
  const calls: Array<{ url: string; method: string; authorization: string | null }> = [];
  const io = dependencies(async (input, init) => {
    calls.push({
      url: String(input),
      method: String(init?.method || "GET"),
      authorization: new Headers(init?.headers).get("Authorization"),
    });
    return Response.json(init?.method === "PUT"
      ? { ok: true }
      : { bundle: bundle() });
  });
  assert.equal(
    await runCatalogSourceCli(
      ["snapshot", "--api", "http://localhost:8787", "--output", snapshotFile],
      io.values,
    ),
    0,
  );
  const manifestFile = snapshotFile.replace(/\.json$/, ".manifest.json");
  assert.deepEqual(JSON.parse(await readFile(snapshotFile, "utf8")), bundle());
  assert.equal(
    await runCatalogSourceCli([
      "restore",
      "--api",
      "http://localhost:8787",
      "--snapshot",
      snapshotFile,
      "--manifest",
      manifestFile,
    ], io.values),
    0,
  );
  assert.deepEqual(calls, [
    {
      url: "http://localhost:8787/api/admin/catalog-sources",
      method: "GET",
      authorization: "Bearer test-secret",
    },
    {
      url: "http://localhost:8787/api/admin/catalog-sources",
      method: "PUT",
      authorization: "Bearer test-secret",
    },
  ]);
  const serialized = await serializeCatalogSourceSnapshot(bundle(), {
    generated_at: 1785542400000,
  });
  assert.equal(await readFile(manifestFile, "utf8"), `${
    JSON.stringify(serialized.manifest, null, 2)
  }\n`);
});
