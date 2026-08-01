import { assertCatalogReviewBacklog } from "./validation.ts";

export interface CatalogIngestionPreparedStatement {
  bind(...values: unknown[]): CatalogIngestionPreparedStatement;
}

export interface CatalogIngestionDatabase {
  prepare(sql: string): CatalogIngestionPreparedStatement;
  batch(statements: CatalogIngestionPreparedStatement[]): Promise<unknown[]>;
}

export async function publishCatalogReviewBacklog(
  database: CatalogIngestionDatabase,
  value: unknown,
) {
  const backlog = assertCatalogReviewBacklog(value);
  const notes = [...backlog.review_notes].sort((left, right) =>
    JSON.stringify([
      left.program_id,
      left.section_name,
      left.raw_text,
    ]).localeCompare(JSON.stringify([
      right.program_id,
      right.section_name,
      right.raw_text,
    ]))
  );
  const statements = [
    database.prepare("DELETE FROM requirement_raw_notes").bind(),
    ...notes.map((note) =>
      database.prepare(
        `INSERT INTO requirement_raw_notes (
           program_id, section_name, raw_text, resolved
         ) VALUES (?, ?, ?, ?)`,
      ).bind(
        note.program_id,
        note.section_name,
        note.raw_text,
        note.resolved ? 1 : 0,
      )
    ),
  ];
  await database.batch(statements);
  return {
    note_count: notes.length,
    statement_count: statements.length,
  };
}
