import { extractRequirementDraftCandidate } from "../imports/program-requirements.js";

export function createRequirementCandidateService({ repository, recordScrape }) {
  return {
    listPendingSnapshots(schoolSlug, batchLimit) {
      if (schoolSlug !== "sasnb") {
        throw new Error("draft candidate extraction currently supports school=sasnb majors only");
      }
      return repository.listPendingSnapshots(schoolSlug, batchLimit);
    },

    async extractBatch(snapshots) {
      const extracted = [];
      for (const snapshot of snapshots) {
        try {
          const candidate = extractRequirementDraftCandidate(snapshot);
          const { changed } = await repository.saveCandidate(candidate);
          const sectionsFound = candidate.sections.length;
          const coursesFound = candidate.sections.reduce(
            (total, section) => total + section.course_codes.length,
            0,
          );
          await recordScrape(
            `requirements-candidate:${snapshot.source_id}`,
            "ok",
            {
              groupsWritten: 0,
              coursesWritten: coursesFound,
              notesWritten: sectionsFound,
            },
            `${changed ? "saved" : "reused"} generic source-section draft; no review status changed`,
            snapshot.content_text.slice(0, 1500),
          );
          extracted.push({
            ok: true,
            source_id: snapshot.source_id,
            program_id: snapshot.program_id,
            changed,
            sections_found: sectionsFound,
            courses_found: coursesFound,
          });
        } catch (error) {
          const message = String(error?.message || error);
          await recordScrape(
            `requirements-candidate:${snapshot.source_id}`,
            "error",
            null,
            `requirements-candidate extraction failed: ${message}`,
            String(snapshot.content_text || "").slice(0, 1500),
          );
          extracted.push({
            ok: false,
            source_id: snapshot.source_id,
            program_id: snapshot.program_id,
            error: message,
          });
        }
      }
      return extracted;
    },
  };
}
