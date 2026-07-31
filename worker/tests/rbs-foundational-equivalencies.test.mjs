import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

const schemaUrl = new URL("../schema/schema_requirement_course_equivalencies.sql", import.meta.url);
const migrationUrl = new URL("../schema/review_rbs_foundational_equivalencies.sql", import.meta.url);

test("RBS systemic equivalencies are idempotent data shared by every credit consumer", async () => {
  const [schema, migration] = await Promise.all([
    readFile(schemaUrl, "utf8"),
    readFile(migrationUrl, "utf8"),
  ]);
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON; CREATE TABLE programs (id TEXT PRIMARY KEY);");
  db.prepare("INSERT INTO programs (id) VALUES (?), (?)")
    .run("rbsnb-foundational-core", "rbsnb-core-curriculum");
  db.exec(schema);
  db.exec(migration);
  db.exec(migration);

  const rows = JSON.parse(JSON.stringify(db.prepare(
    `SELECT program_id, requirement_course_code, equivalent_course_code, review_status
     FROM requirement_course_equivalencies
     ORDER BY program_id, requirement_course_code, equivalent_course_code`,
  ).all()));

  assert.deepEqual(rows, [
    {
      program_id: "rbsnb-core-curriculum",
      requirement_course_code: "01:198:170",
      equivalent_course_code: "01:198:111",
      review_status: "reviewed",
    },
    {
      program_id: "rbsnb-core-curriculum",
      requirement_course_code: "01:960:285",
      equivalent_course_code: "01:960:211",
      review_status: "reviewed",
    },
    {
      program_id: "rbsnb-foundational-core",
      requirement_course_code: "01:198:170",
      equivalent_course_code: "01:198:111",
      review_status: "reviewed",
    },
    {
      program_id: "rbsnb-foundational-core",
      requirement_course_code: "01:960:285",
      equivalent_course_code: "01:960:211",
      review_status: "reviewed",
    },
  ]);
});
