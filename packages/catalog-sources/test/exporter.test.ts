import assert from "node:assert/strict";
import test from "node:test";

import {
  exportCatalogSourceBundle,
  type CatalogSourceReadDatabase,
  type CatalogSourceReadPreparedStatement,
} from "../src/index.ts";

type Row = Record<string, unknown>;

class Statement implements CatalogSourceReadPreparedStatement {
  private readonly database: Database;
  private readonly name: string;

  constructor(
    database: Database,
    name: string,
  ) {
    this.database = database;
    this.name = name;
  }

  bind(): CatalogSourceReadPreparedStatement {
    return this;
  }

  async all<T>(): Promise<{ results: T[] }> {
    this.database.calls.push(this.name);
    return { results: (this.database.rows[this.name] ?? []) as T[] };
  }
}

class Database implements CatalogSourceReadDatabase {
  readonly calls: string[] = [];
  readonly rows: Record<string, Row[]>;

  constructor(rows: Record<string, Row[]>) {
    this.rows = rows;
  }

  prepare(sql: string): CatalogSourceReadPreparedStatement {
    const name = /catalog-sources-export:([a-z-]+)/.exec(sql)?.[1];
    if (!name) throw new Error("missing query name");
    return new Statement(this, name);
  }
}

test("exports configuration and nests stable identity overrides", async () => {
  const database = new Database({
    sources: [{
      id: "example-directory",
      school_slug: "example-school",
      directory_url: "https://example.rutgers.edu/programs",
      profile_path: "/programs/",
      catalog_year: "2026-2027",
      source_title: "Example program directory",
      adapter: "html_program_directory_v1",
      enabled: 1,
      owner_labels_json: "[\"Example School\"]",
    }],
    overrides: [{
      catalog_source_id: "example-directory",
      program_slug: "example-program",
      type: "major",
      program_id: "example-program-major",
    }],
  });

  const bundle = await exportCatalogSourceBundle(database);
  assert.deepEqual(bundle, sourceBundleFixture());
  assert.deepEqual(database.calls, ["sources", "overrides"]);
});

test("fails closed for malformed stored labels or orphan overrides", async () => {
  await assert.rejects(
    exportCatalogSourceBundle(new Database({
      sources: [{
        ...sourceRow(),
        owner_labels_json: "{",
      }],
      overrides: [],
    })),
    /owner_labels_json/,
  );
  await assert.rejects(
    exportCatalogSourceBundle(new Database({
      sources: [sourceRow()],
      overrides: [{
        catalog_source_id: "missing-directory",
        program_slug: "example-program",
        type: "major",
        program_id: "example-program-major",
      }],
    })),
    /orphan identity override/,
  );
});

function sourceRow(): Row {
  return {
    id: "example-directory",
    school_slug: "example-school",
    directory_url: "https://example.rutgers.edu/programs",
    profile_path: "/programs/",
    catalog_year: "2026-2027",
    source_title: "Example program directory",
    adapter: "html_program_directory_v1",
    enabled: 1,
    owner_labels_json: "[\"Example School\"]",
  };
}

function sourceBundleFixture(): Record<string, unknown> {
  return {
    contract_version: 1,
    sources: [{
      id: "example-directory",
      school_slug: "example-school",
      directory_url: "https://example.rutgers.edu/programs",
      profile_path: "/programs/",
      catalog_year: "2026-2027",
      source_title: "Example program directory",
      adapter: "html_program_directory_v1",
      enabled: true,
      owner_labels: ["Example School"],
      identity_overrides: [{
        program_slug: "example-program",
        type: "major",
        program_id: "example-program-major",
      }],
    }],
  };
}
