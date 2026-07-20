function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function textFromHtml(value) {
  return decodeHtml(value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeDegree(value) {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z]/g, "");
  if (compact === "BA") return "BA";
  if (compact === "BS") return "BS";
  if (compact === "BAORBS" || compact === "BSORBA") return "BA OR BS";
  return null;
}

function degreeType(label) {
  const match = String(label || "").match(/(?:\|\s*|\s+)(B\.?\s*[AS]\.?)(?:\s+or\s+(B\.?\s*[AS]\.?)\s*)?$/i);
  if (!match) return null;
  return normalizeDegree(match[2] ? `${match[1]} or ${match[2]}` : match[1]);
}

function displayName(label) {
  return String(label || "")
    .replace(/(?:\s*\|\s*|\s+)B\.?\s*[AS]\.?\s*(?:or\s+B\.?\s*[AS]\.?\s*)?$/i, "")
    .replace(/\s*\((?:Major|Minor)(?:\s*(?:,|\/)\s*(?:Major|Minor))*\)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function programTypes(label) {
  return [...new Set([...String(label || "").matchAll(/\b(Major|Minor)\b/gi)]
    .map((match) => match[1].toLowerCase()))];
}

function attributeValue(attributes, name) {
  const match = String(attributes || "").match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return match ? (match[1] ?? match[2] ?? "") : "";
}

function profileSlug(url, profilePath) {
  const index = url.pathname.indexOf(profilePath);
  if (index < 0) return null;
  const remainder = url.pathname.slice(index + profilePath.length).replace(/^\/+|\/+$/g, "");
  return /^[a-z0-9-]+$/i.test(remainder) ? remainder.toLowerCase() : null;
}

function normalizedOwnerLabel(value) {
  return textFromHtml(value).toLowerCase().replace(/\s+/g, "");
}

function allowedOwnerLabels(source) {
  if (!Array.isArray(source.owner_labels)) return [];
  return source.owner_labels
    .map(normalizedOwnerLabel)
    .filter(Boolean);
}

function ownerLabelFromRow(row) {
  const match = String(row || "").match(
    /<td\b[^>]*\bdata-title\s*=\s*(?:"School"|'School')[^>]*>([\s\S]*?)<\/td>/i,
  );
  return match ? textFromHtml(match[1]) : "";
}

function safeProgramId(value) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9-]{2,119}$/.test(value);
}

function validSource(source) {
  return source
    && typeof source.id === "string"
    && typeof source.school_slug === "string"
    && typeof source.directory_url === "string"
    && typeof source.profile_path === "string";
}

// Parses a directory page into catalog-listed data. It deliberately only
// extracts program identity from the official list; degree requirements stay
// unreviewed until a source-specific requirement importer validates them.
export function parseProgramDirectory(html, source) {
  if (!validSource(source)) return [];
  const profilePath = source.profile_path.startsWith("/") ? source.profile_path : `/${source.profile_path}`;
  const entries = [];
  const seen = new Set();
  const permittedOwners = allowedOwnerLabels(source);
  const rowBlocks = [...String(html || "").matchAll(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi)]
    .map((match) => match[0]);
  // Some future official directories will not use a table. In that case, the
  // source has no owner column to filter, so continue to support the generic
  // anchor-only layout.
  const containers = rowBlocks.length ? rowBlocks : [String(html || "")];
  for (const container of containers) {
    if (permittedOwners.length && !permittedOwners.includes(normalizedOwnerLabel(ownerLabelFromRow(container)))) {
      continue;
    }
    const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = anchorRe.exec(container))) {
      const [, attributes, body] = match;
      const href = attributeValue(attributes, "href");
      if (!href) continue;
      let sourceUrl;
      try {
        sourceUrl = new URL(decodeHtml(href), source.directory_url);
      } catch {
        continue;
      }
      const programSlug = profileSlug(sourceUrl, profilePath);
      if (!programSlug) continue;
      const label = textFromHtml(attributeValue(attributes, "title") || body);
      const name = displayName(label);
      const types = programTypes(label);
      if (!name || !types.length) continue;
      const degree = degreeType(label);
      for (const type of types) {
        const override = source.program_id_overrides?.[`${programSlug}:${type}`];
        const id = safeProgramId(override)
          ? override
          : `${source.school_slug}-catalog-${programSlug}-${type}`;
        if (seen.has(id)) continue;
        seen.add(id);
        entries.push({
          id,
          name,
          school_slug: source.school_slug,
          program_slug: programSlug,
          type,
          catalog_year: source.catalog_year || null,
          degree_type: degree,
          program_family_id: `${source.school_slug}-catalog-${programSlug}`,
          source_url: sourceUrl.href,
          review_status: "catalog_listed",
          catalog_source_id: source.id,
        });
      }
    }
  }
  return entries;
}

export async function importProgramDirectory({ source, fetchHtml, saveEntries }) {
  if (!validSource(source) || typeof fetchHtml !== "function" || typeof saveEntries !== "function") {
    throw new Error("a valid directory source, fetchHtml, and saveEntries are required");
  }
  const html = await fetchHtml(source.directory_url);
  const entries = parseProgramDirectory(html, source);
  if (!entries.length) throw new Error(`parsed zero programs from ${source.directory_url}`);
  await saveEntries(entries);
  return { programs_imported: entries.length };
}
