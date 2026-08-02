import { importProgramDirectory } from "../imports/program-directory.js";

const FETCH_HEADERS = {
  Accept: "text/html",
  "User-Agent": "Mozilla/5.0 (compatible; RutgersDegreeNavigatorScraper/1.0; personal student project)",
};

function isSafeSourceId(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{2,119}$/.test(value);
}

function isSupportedSource(source) {
  return source
    && source.adapter === "html_program_directory_v1"
    && typeof source.directory_url === "string"
    && typeof source.profile_path === "string";
}

function ownerLabels(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((label) => typeof label === "string" && label.trim()).slice(0, 30)
      : [];
  } catch {
    return [];
  }
}

function programIdOverrides(rows) {
  return Object.fromEntries((rows || [])
    .filter((row) => isSafeSourceId(row.program_slug)
      && (row.type === "major" || row.type === "minor")
      && isSafeSourceId(row.program_id))
    .map((row) => [`${row.program_slug}:${row.type}`, row.program_id]));
}

export function createCatalogDirectoryImportService({
  repository,
  recordScrape,
  fetchImpl = fetch,
  now = Date.now,
  createToken = () => crypto.randomUUID(),
}) {
  return {
    async importSource(sourceId) {
      if (!isSafeSourceId(sourceId)) throw new Error("invalid catalog source id");
      const storedSource = await repository.findEnabledSource(sourceId);
      if (!storedSource) throw new Error("unknown or disabled catalog source");
      if (!isSupportedSource(storedSource)) {
        throw new Error("unsupported catalog directory adapter");
      }

      const source = {
        ...storedSource,
        owner_labels: ownerLabels(storedSource.owner_labels_json),
        program_id_overrides: programIdOverrides(
          await repository.listIdentityOverrides(storedSource.id),
        ),
      };
      const startedAt = now();
      const importToken = createToken();
      if (!(await repository.acquireImportLease(source.id, importToken, startedAt))) {
        return {
          ok: false,
          source_id: source.id,
          error: "a catalog import for this source is already running",
          status: 409,
        };
      }

      let rawHtml = "";
      try {
        const result = await importProgramDirectory({
          source,
          fetchHtml: async (directoryUrl) => {
            const response = await fetchImpl(directoryUrl, { headers: FETCH_HEADERS });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            rawHtml = await response.text();
            return rawHtml;
          },
          saveEntries: (entries) =>
            repository.replaceEntries(source, entries, importToken),
        });
        await recordScrape(
          `catalog:${source.id}`,
          "ok",
          { groupsWritten: 0, coursesWritten: result.programs_imported, notesWritten: 0 },
          `imported ${result.programs_imported} catalog-listed programs from ${source.directory_url}`,
          rawHtml.slice(0, 1500),
        );
        return { ok: true, source_id: source.id, ...result };
      } catch (error) {
        const message = String(error?.message || error);
        await repository.failImport(source.id, importToken, message);
        await recordScrape(
          `catalog:${source.id}`,
          "error",
          null,
          `catalog directory import failed: ${message}`,
          rawHtml.slice(0, 1500),
        );
        return { ok: false, source_id: source.id, error: message };
      }
    },
  };
}
