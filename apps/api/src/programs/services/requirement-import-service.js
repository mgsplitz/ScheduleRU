import { importProgramRequirementSource } from "../imports/program-requirements.js";

const FETCH_HEADERS = {
  Accept: "text/html",
  "User-Agent": "Mozilla/5.0 (compatible; RutgersDegreeNavigatorScraper/1.0; personal student project)",
};

function isSafeSourceId(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{2,119}$/.test(value);
}

function isSafeSchoolSlug(value) {
  return typeof value === "string" && /^[a-z0-9-]{2,80}$/.test(value);
}

function isSupportedSource(source) {
  return source
    && source.adapter === "html_requirement_source_v1"
    && typeof source.source_url === "string"
    && /^https:\/\//i.test(source.source_url);
}

export function requirementSourceImportBatchLimit(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isSafeInteger(parsed)) return 20;
  return Math.min(Math.max(parsed, 1), 25);
}

export function createRequirementImportService({
  repository,
  recordScrape,
  fetchImpl = fetch,
  wait = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  async function importSource(sourceId) {
    if (!isSafeSourceId(sourceId)) throw new Error("invalid requirement source id");
    const source = await repository.findEnabledSource(sourceId);
    if (!source) throw new Error("unknown or disabled requirement source");
    if (!isSupportedSource(source)) throw new Error("unsupported requirement source adapter");

    let rawHtml = "";
    try {
      const result = await importProgramRequirementSource({
        source,
        fetchHtml: async (sourceUrl) => {
          const response = await fetchImpl(sourceUrl, { headers: FETCH_HEADERS });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          rawHtml = await response.text();
          return rawHtml;
        },
        saveSnapshot: (snapshot) => repository.saveSnapshot(snapshot),
      });
      await recordScrape(
        `requirements:${source.id}`,
        "ok",
        {
          groupsWritten: 0,
          coursesWritten: result.courses_found,
          notesWritten: result.headings_found,
        },
        `${result.changed ? "saved" : "reused"} draft snapshot from ${source.source_url}; no review status changed`,
        rawHtml.slice(0, 1500),
      );
      return { ok: true, ...result };
    } catch (error) {
      const message = String(error?.message || error);
      await repository.markFailure(source.id, message);
      await recordScrape(
        `requirements:${source.id}`,
        "error",
        null,
        `requirements-source import failed: ${message}`,
        rawHtml.slice(0, 1500),
      );
      return {
        ok: false,
        source_id: source.id,
        program_id: source.program_id,
        error: message,
      };
    }
  }

  return {
    importSource,

    listPendingSources(schoolSlug, batchLimit) {
      if (!isSafeSchoolSlug(schoolSlug)) throw new Error("pass a valid school slug");
      return repository.listPendingSources(schoolSlug, batchLimit);
    },

    async importBatch(sources) {
      const imported = [];
      for (const source of sources) {
        imported.push(await importSource(source.id));
        await wait(100);
      }
      return imported;
    },
  };
}
