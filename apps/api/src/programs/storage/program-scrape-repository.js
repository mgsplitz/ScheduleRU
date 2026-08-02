function requirementStatements(database, program, sections, extraNotes = []) {
  const statements = [
    database.prepare(
      "DELETE FROM requirement_courses WHERE group_id IN (SELECT id FROM requirement_groups WHERE program_id = ? AND auto_generated = 1)",
    ).bind(program.id),
    database.prepare(
      "DELETE FROM requirement_groups WHERE program_id = ? AND auto_generated = 1",
    ).bind(program.id),
    database.prepare("DELETE FROM requirement_raw_notes WHERE program_id = ?").bind(program.id),
  ];
  let groupCounter = 0;
  let groupsWritten = 0;
  let coursesWritten = 0;
  let notesWritten = 0;

  for (const section of sections) {
    groupCounter += 1;
    const groupId = `${program.id}-g${groupCounter}`;
    statements.push(database.prepare(
      `INSERT INTO requirement_groups (
         id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated
       ) VALUES (?,?,?,?,?,?,?,1)`,
    ).bind(
      groupId,
      program.id,
      null,
      section.name,
      section.rule || "all",
      section.count ?? null,
      groupCounter,
    ));
    groupsWritten += 1;

    for (const item of section.courseItems) {
      statements.push(database.prepare(
        `INSERT OR REPLACE INTO requirement_courses
           (group_id, course_code, note, source_title, source_credits)
         VALUES (?,?,?,?,?)`,
      ).bind(groupId, item.code, item.note || "", item.title || "", item.credits || ""));
      coursesWritten += 1;
    }

    let subgroupCounter = 0;
    for (const subgroup of section.subgroups || []) {
      subgroupCounter += 1;
      const subgroupId = `${groupId}-sub${subgroupCounter}`;
      statements.push(database.prepare(
        `INSERT INTO requirement_groups (
           id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated
         ) VALUES (?,?,?,?,?,?,?,1)`,
      ).bind(
        subgroupId,
        program.id,
        groupId,
        subgroup.name,
        subgroup.rule || "all",
        subgroup.count ?? null,
        subgroupCounter,
      ));
      groupsWritten += 1;
      for (const item of subgroup.courseItems || []) {
        statements.push(database.prepare(
          `INSERT OR REPLACE INTO requirement_courses
             (group_id, course_code, note, source_title, source_credits)
           VALUES (?,?,?,?,?)`,
        ).bind(subgroupId, item.code, item.note || "", item.title || "", item.credits || ""));
        coursesWritten += 1;
      }
    }

    let orCounter = 0;
    for (const orGroup of section.orGroups) {
      orCounter += 1;
      const orGroupId = `${groupId}-or${orCounter}`;
      statements.push(database.prepare(
        `INSERT INTO requirement_groups (
           id, program_id, parent_group_id, name, rule, count, sort_order, auto_generated
         ) VALUES (?,?,?,?,?,?,?,1)`,
      ).bind(orGroupId, program.id, groupId, "Choose 1", "min_courses", 1, orCounter));
      groupsWritten += 1;
      for (const item of orGroup) {
        statements.push(database.prepare(
          `INSERT OR REPLACE INTO requirement_courses
             (group_id, course_code, note, source_title, source_credits)
           VALUES (?,?,?,?,?)`,
        ).bind(orGroupId, item.code, item.note || "", item.title || "", item.credits || ""));
        coursesWritten += 1;
      }
    }

    for (const prose of section.prose) {
      statements.push(database.prepare(
        "INSERT INTO requirement_raw_notes (program_id, section_name, raw_text, resolved) VALUES (?,?,?,0)",
      ).bind(program.id, section.name, prose));
      notesWritten += 1;
    }
  }

  for (const note of extraNotes) {
    statements.push(database.prepare(
      "INSERT INTO requirement_raw_notes (program_id, section_name, raw_text, resolved) VALUES (?,?,?,0)",
    ).bind(program.id, note.section_name, note.raw_text));
    notesWritten += 1;
  }
  return { statements, counts: { groupsWritten, coursesWritten, notesWritten } };
}

export function createProgramScrapeRepository(env, { now = Date.now } = {}) {
  const { DB: database } = env;
  return {
    async replaceRequirements(program, sections, sourceUrl, extraNotes = []) {
      const { statements, counts } = requirementStatements(
        database,
        program,
        sections,
        extraNotes,
      );
      statements.push(database.prepare(
        "UPDATE programs SET last_scraped_at = ?, review_status = 'unreviewed', source_url = ? WHERE id = ?",
      ).bind(now(), sourceUrl, program.id));
      try {
        await database.batch(statements);
      } catch (error) {
        error.scrapeCounts = counts;
        throw error;
      }
      return counts;
    },
  };
}
