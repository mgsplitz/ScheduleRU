import assert from "node:assert/strict";
import test from "node:test";

import { validateCatalogReviewBacklog } from "../src/index.ts";
import { backlog } from "./fixtures.ts";

test("accepts resolved and unresolved review notes without D1 IDs", () => {
  const result = validateCatalogReviewBacklog(backlog());
  assert.equal(result.ok, true);
});

test("rejects duplicate natural keys and unsafe program IDs", () => {
  const value = backlog();
  const notes = value.review_notes as Array<Record<string, unknown>>;
  notes.push(structuredClone(notes[0]!));
  notes[1]!.program_id = "unsafe/id";
  const result = validateCatalogReviewBacklog(value);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.issues.some(({ code }) => code === "duplicate_note"));
  assert.ok(result.issues.some(({ code }) => code === "invalid_identifier"));
});

test("requires an explicit resolved boolean and non-empty note text", () => {
  const value = backlog();
  const note = (value.review_notes as Array<Record<string, unknown>>)[0]!;
  note.resolved = 0;
  note.raw_text = " ";
  const result = validateCatalogReviewBacklog(value);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.deepEqual(
    result.issues.map(({ path }) => path),
    ["review_notes[0].raw_text", "review_notes[0].resolved"],
  );
});
