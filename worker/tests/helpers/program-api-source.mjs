import { readFile } from "node:fs/promises";

export const programApiSource = await readFile(
  new URL("../../../apps/api/src/programs.js", import.meta.url),
  "utf8",
);
