export interface TaggedCurriculumCourse {
  code: string;
  title: string;
  credits: number;
  tags: string[];
}

function cellText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTaggedCurriculumPages(
  pages: string[],
): TaggedCurriculumCourse[] {
  const courses = new Map<string, TaggedCurriculumCourse>();
  for (const page of pages) {
    const rows = page.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const row of rows) {
      const cells = [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((match) => cellText(match[1] ?? ""));
      if (cells.length < 4) continue;
      const [code = "", title = "", rawCredits = "", rawTags = ""] = cells;
      if (
        !/^\d{2}:\d{3}:\d{3}$/.test(code)
        || /^(21|29|50):/.test(code)
        || !/^\d+(?:\.\d+)?$/.test(rawCredits)
      ) {
        continue;
      }
      const credits = Number(rawCredits);
      if (!Number.isFinite(credits) || credits <= 0 || !title) continue;
      const tags = rawTags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => /^[A-Z][A-Za-z]{1,3}$/.test(tag));
      if (!tags.length) continue;

      const existing = courses.get(code);
      courses.set(code, {
        code,
        title: existing?.title || title,
        credits: existing?.credits || credits,
        tags: [...new Set([...(existing?.tags || []), ...tags])].sort(),
      });
    }
  }
  const output = [...courses.values()].sort((left, right) =>
    left.code.localeCompare(right.code)
  );
  if (!output.length) {
    throw new Error("official source contained no tagged course rows");
  }
  return output;
}
