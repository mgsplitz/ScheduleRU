import {
  discoverNestedMajorRequirementPage,
  discoverProfileRequirementPage,
} from "../imports/program-requirements.js";

const FETCH_HEADERS = {
  Accept: "text/html",
  "User-Agent": "Mozilla/5.0 (compatible; RutgersDegreeNavigatorScraper/1.0; personal student project)",
};

function validSchoolSlug(value) {
  return typeof value === "string" && /^[a-z0-9-]{2,80}$/.test(value);
}

function validProgramId(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,119}$/.test(value);
}

export function createRequirementDiscoveryService({
  repository,
  recordScrape,
  fetchImpl = fetch,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}) {
  return {
    async registerSchool(schoolSlug) {
      if (!validSchoolSlug(schoolSlug)) throw new Error("pass a valid school slug");
      const registered = await repository.registerProfileSources(schoolSlug);
      return { registered };
    },

    listPendingProfiles(schoolSlug, batchLimit) {
      if (!validSchoolSlug(schoolSlug)) throw new Error("pass a valid school slug");
      return repository.listPendingProfiles(schoolSlug, batchLimit);
    },

    listPendingNestedDetails(schoolSlug, batchLimit) {
      if (schoolSlug !== "sasnb") {
        throw new Error("nested requirement discovery currently supports school=sasnb majors only");
      }
      return repository.listPendingNestedDetails(schoolSlug, batchLimit);
    },

    async discoverProfiles(profileSources) {
      const discovered = [];
      for (const profileSource of profileSources) {
        let rawHtml = "";
        try {
          if (!validProgramId(profileSource.program_id)) throw new Error("invalid program id");
          const response = await fetchImpl(profileSource.source_url, { headers: FETCH_HEADERS });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          rawHtml = await response.text();
          const detailSource = discoverProfileRequirementPage(rawHtml, profileSource, "major");
          if (!detailSource) throw new Error("profile has no official Major Web Page link");
          await repository.saveProfileDetail(profileSource, detailSource);
          await recordScrape(
            `requirements-discovery:${profileSource.id}`,
            "ok",
            { groupsWritten: 0, coursesWritten: 0, notesWritten: 1 },
            `saved official major requirements source ${detailSource.source_url}; no review status changed`,
            rawHtml.slice(0, 1500),
          );
          discovered.push({
            ok: true,
            source_id: profileSource.id,
            program_id: profileSource.program_id,
          });
        } catch (error) {
          const message = String(error?.message || error);
          await repository.markSourceError(profileSource.id, message);
          await recordScrape(
            `requirements-discovery:${profileSource.id}`,
            "error",
            null,
            `requirements-source discovery failed: ${message}`,
            rawHtml.slice(0, 1500),
          );
          discovered.push({
            ok: false,
            source_id: profileSource.id,
            program_id: profileSource.program_id,
            error: message,
          });
        }
        await wait(100);
      }
      return discovered;
    },

    async discoverNestedDetails(parentSources) {
      const discovered = [];
      for (const source of parentSources) {
        let rawHtml = "";
        try {
          const response = await fetchImpl(source.source_url, { headers: FETCH_HEADERS });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          rawHtml = await response.text();
          const detailSource = discoverNestedMajorRequirementPage(rawHtml, source);
          if (!detailSource) {
            await repository.recordNestedAttempt(
              source,
              "no_link",
              null,
              "no explicitly labelled Major Requirements link",
            );
            await recordScrape(
              `requirements-detail-discovery:${source.id}`,
              "ok",
              { groupsWritten: 0, coursesWritten: 0, notesWritten: 1 },
              "no explicit nested major-requirements link found; no audit changed",
              rawHtml.slice(0, 1500),
            );
            discovered.push({
              ok: true,
              source_id: source.id,
              program_id: source.program_id,
              found: false,
            });
          } else {
            await repository.saveNestedDetail(source, detailSource);
            await repository.recordNestedAttempt(
              source,
              "found",
              detailSource.source_url,
              "saved official detailed major requirements source",
            );
            await recordScrape(
              `requirements-detail-discovery:${source.id}`,
              "ok",
              { groupsWritten: 0, coursesWritten: 0, notesWritten: 1 },
              `saved official nested major requirements source ${detailSource.source_url}; no review status changed`,
              rawHtml.slice(0, 1500),
            );
            discovered.push({
              ok: true,
              source_id: source.id,
              program_id: source.program_id,
              found: true,
            });
          }
        } catch (error) {
          const message = String(error?.message || error);
          await repository.recordNestedAttempt(source, "error", null, message);
          await recordScrape(
            `requirements-detail-discovery:${source.id}`,
            "error",
            null,
            `nested requirements-source discovery failed: ${message}`,
            rawHtml.slice(0, 1500),
          );
          discovered.push({
            ok: false,
            source_id: source.id,
            program_id: source.program_id,
            error: message,
          });
        }
        await wait(100);
      }
      return discovered;
    },
  };
}
