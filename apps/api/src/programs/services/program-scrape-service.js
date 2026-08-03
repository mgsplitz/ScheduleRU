import { extractBizProse, parseBizPageText } from "../scrapers/business-school-parser.js";
import { parseProgramText } from "../scrapers/coursedog-program-parser.js";
import { htmlToFlatText } from "../scrapers/html.js";

const FETCH_HEADERS = {
  Accept: "text/html",
  "User-Agent": "Mozilla/5.0 (compatible; RutgersDegreeNavigatorScraper/1.0; personal student project)",
};

function approvedBusinessRequirementsUrl(value) {
  try {
    const source = new URL(String(value || ""));
    if (
      source.protocol !== "https:"
      || source.hostname !== "www.business.rutgers.edu"
      || !/^\/undergraduate-new-brunswick\/[a-z0-9-]+\/?$/.test(source.pathname)
    ) {
      return null;
    }
    return source.href;
  } catch {
    return null;
  }
}

export function createProgramScrapeService({
  repository,
  recordScrape,
  fetchImpl = fetch,
  catalogSubdomain = "newbrunswick-undergrad-25-26",
}) {
  async function fetchText(url) {
    const response = await fetchImpl(url, { headers: FETCH_HEADERS });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  }

  return {
    async scrapeCatalogProgram(program) {
      const url = program.source_url
        || `https://${catalogSubdomain}.catalogs.rutgers.edu/schools/${program.school_slug}/degree-requirements/programs-majors-minors/${program.program_slug}`;
      let flat = "";
      try {
        flat = htmlToFlatText(await fetchText(url));
      } catch (error) {
        await recordScrape(program.id, "error", null, `fetch failed: ${error.message}`, "");
        return { ok: false, error: error.message };
      }
      const sections = parseProgramText(flat, program.name);
      if (!sections.length) {
        await recordScrape(
          program.id,
          "empty",
          null,
          "parsed zero sections — page structure may not match parseProgramText's assumptions",
          flat.slice(0, 1500),
        );
        return { ok: false, error: "no sections parsed" };
      }
      try {
        const counts = await repository.replaceRequirements(program, sections, url);
        await recordScrape(program.id, "ok", counts, `scraped ${url}`, flat.slice(0, 1500));
        return { ok: true, ...counts };
      } catch (error) {
        await recordScrape(
          program.id,
          "error",
          error.scrapeCounts || null,
          `D1 write failed: ${error.message}`,
          flat.slice(0, 1500),
        );
        return { ok: false, error: error.message };
      }
    },

    async scrapeBusinessProgram(program) {
      const url = approvedBusinessRequirementsUrl(program.source_url);
      if (!url) {
        return {
          ok: false,
          error: "program data does not declare an approved RBS requirements source URL",
        };
      }
      let html = "";
      try {
        html = await fetchText(url);
      } catch (error) {
        await recordScrape(
          program.id,
          "error",
          null,
          `biz-site fetch failed: ${error.message}`,
          "",
        );
        return { ok: false, error: error.message };
      }
      const sections = parseBizPageText(html);
      if (!sections.length) {
        await recordScrape(
          program.id,
          "empty",
          null,
          "biz-site parse found zero usable tables — table markup may not match parseBizTable's assumptions, check raw_sample",
          html.slice(0, 2000),
        );
        return { ok: false, error: "no sections parsed from biz site" };
      }
      try {
        const counts = await repository.replaceRequirements(
          program,
          sections,
          url,
          extractBizProse(html),
        );
        await recordScrape(
          program.id,
          "ok",
          counts,
          `scraped (biz site) ${url}`,
          html.slice(0, 2000),
        );
        return { ok: true, ...counts };
      } catch (error) {
        await recordScrape(
          program.id,
          "error",
          error.scrapeCounts || null,
          `biz-site D1 write failed: ${error.message}`,
          html.slice(0, 2000),
        );
        return { ok: false, error: error.message };
      }
    },

    async discoverPrograms(schoolSlug, indexPath) {
      const url = `https://${catalogSubdomain}.catalogs.rutgers.edu${indexPath}`;
      let html;
      try {
        html = await fetchText(url);
      } catch (error) {
        return { ok: false, error: error.message, found: [] };
      }
      const linkPattern = /href="[^"]*\/schools\/([a-z0-9-]+)\/degree-requirements\/programs-majors-minors\/([a-z0-9-]+)"[^>]*>([^<]*)</gi;
      const found = [];
      const seen = new Set();
      let match;
      while ((match = linkPattern.exec(html))) {
        const [, foundSchool, programSlug, linkText] = match;
        const key = `${foundSchool}:${programSlug}`;
        if (seen.has(key)) continue;
        seen.add(key);
        found.push({
          school_slug: foundSchool,
          program_slug: programSlug,
          name: linkText.trim() || programSlug,
        });
      }
      return { ok: true, found };
    },
  };
}
