import { readFileSync } from "node:fs";

const snapshot = readFileSync(
  new URL(
    "../../../catalog/snapshots/reviewed-programs.v1.jsonl",
    import.meta.url,
  ),
  "utf8",
);
const definitions = snapshot
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const byProgramId = new Map();
for (const definition of definitions) {
  const id = definition?.program?.id;
  if (!id) throw new TypeError("catalog snapshot contains a program without an ID");
  if (byProgramId.has(id)) {
    throw new TypeError(`catalog snapshot contains duplicate program: ${id}`);
  }
  byProgramId.set(id, definition);
}

export function allProgramDefinitions() {
  return definitions;
}

export function programDefinition(programId) {
  const definition = byProgramId.get(programId);
  if (!definition) throw new TypeError(`missing program definition: ${programId}`);
  return definition;
}

export function requirementGroup(programId, groupId) {
  const group = programDefinition(programId).requirement_groups.find(
    ({ id }) => id === groupId,
  );
  if (!group) {
    throw new TypeError(
      `missing requirement group ${groupId} for program ${programId}`,
    );
  }
  return group;
}

export function courseCodes(programId) {
  return programDefinition(programId).requirement_groups.flatMap(
    ({ courses }) => courses.map(({ code }) => code),
  );
}
