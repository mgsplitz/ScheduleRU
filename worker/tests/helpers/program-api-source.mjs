import { readFile } from "node:fs/promises";

const sources = await Promise.all([
  "../../../apps/api/src/programs/public-routes.js",
  "../../../apps/api/src/programs/storage/public-program-repository.js",
  "../../../apps/api/src/programs/admin-routes.js",
  "../../../apps/api/src/programs/storage/admin-program-repository.js",
  "../../../apps/api/src/programs.js",
].map((path) => readFile(new URL(path, import.meta.url), "utf8")));

export const programApiSource = sources.join("\n");
