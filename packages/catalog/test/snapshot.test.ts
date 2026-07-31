import assert from "node:assert/strict";
import test from "node:test";

import {
  parseCatalogSnapshot,
  serializeCatalogSnapshot,
  type ProgramDefinition,
} from "../src/index.ts";

function definition(id: string): ProgramDefinition {
  const sourceUrl = `https://catalogs.rutgers.edu/${id}`;
  return {
    contract_version: 1,
    program: {
      id,
      name: id,
      school_slug: "sasnb",
      program_slug: id,
      type: "minor",
      catalog_year: "2026-2027",
      academic_program_code: null,
      degree_type: null,
      program_family_id: null,
      source_url: sourceUrl,
      review_status: "reviewed",
      requirement_evidence_required: false,
    },
    sources: [{
      id: "source-001",
      url: sourceUrl,
      title: `${id} requirements`,
      catalog_year: "2026-2027",
      scope: "program_requirements",
      accessed_at: 1785456000000,
      note: "Official requirements.",
    }],
    requirement_groups: [{
      id: `${id}-core`,
      parent_group_id: null,
      name: "Core",
      rule: "all",
      count: null,
      sort_order: 10,
      display_family: null,
      display_priority: 0,
      courses: [],
      selectors: [],
      conditions: [],
    }],
    eligibility_rules: [],
  };
}

test("serializes canonical definitions in program order with a SHA-256 manifest", async () => {
  const result = await serializeCatalogSnapshot(
    [definition("sasnb-zeta-minor"), definition("sasnb-alpha-minor")],
    { generated_at: 1785456000000 },
  );

  assert.deepEqual(result.manifest, {
    format_version: 1,
    generated_at: 1785456000000,
    definition_count: 2,
    program_ids: ["sasnb-alpha-minor", "sasnb-zeta-minor"],
    sha256: result.manifest.sha256,
  });
  assert.match(result.manifest.sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.jsonl.endsWith("\n"), true);
  assert.equal(result.jsonl.split("\n").filter(Boolean).length, 2);

  const parsed = await parseCatalogSnapshot(result.jsonl, result.manifest);
  assert.deepEqual(
    parsed.map((item) => item.program.id),
    ["sasnb-alpha-minor", "sasnb-zeta-minor"],
  );
});

test("rejects duplicate programs, invalid definitions, and changed snapshot bytes", async () => {
  await assert.rejects(
    serializeCatalogSnapshot(
      [definition("sasnb-alpha-minor"), definition("sasnb-alpha-minor")],
      { generated_at: 1785456000000 },
    ),
    /duplicate program ID/,
  );

  const invalid = definition("sasnb-alpha-minor");
  invalid.program.name = "";
  await assert.rejects(
    serializeCatalogSnapshot([invalid], { generated_at: 1785456000000 }),
    /program\.name/,
  );

  const valid = await serializeCatalogSnapshot(
    [definition("sasnb-alpha-minor")],
    { generated_at: 1785456000000 },
  );
  await assert.rejects(
    parseCatalogSnapshot(`${valid.jsonl} `, valid.manifest),
    /snapshot digest does not match manifest/,
  );
});
