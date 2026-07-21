// Official program-requirement source importer.
//
// This module deliberately produces a source snapshot and conservative
// extraction candidates only. It does not decide that prose is an audited
// degree rule; publication remains behind the existing reviewed-evidence gate.

const COURSE_CODE_RE = /\b\d{2}:\d{3}:\d{3}\b/g;

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
  return decodeHtml(value)
    .replace(/<\s*br\b[^>]*>/gi, "\n")
    .replace(/<\/(?:p|li|h[1-6]|tr|div|section|article|main)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function visibleRequirementHtml(html) {
  return String(html || "")
    .replace(/<(?:script|style|noscript|svg|nav|header|footer|aside)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg|nav|header|footer|aside)\s*>/gi, " ");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function attributeValue(attributes, name) {
  const match = String(attributes || "").match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return match ? (match[1] ?? match[2] ?? "") : "";
}

function sourceIsValid(source) {
  if (!source || typeof source !== "object") return false;
  if (!/^[a-z0-9][a-z0-9-]{2,119}$/i.test(String(source.id || ""))) return false;
  if (!/^[a-z0-9][a-z0-9-]{2,119}$/i.test(String(source.program_id || ""))) return false;
  if (source.adapter !== "html_requirement_source_v1") return false;
  try {
    return new URL(source.source_url).protocol === "https:";
  } catch {
    return false;
  }
}

function isOfficialRutgersUrl(url) {
  return url.protocol === "https:"
    && !url.username
    && !url.password
    && (url.hostname === "rutgers.edu" || url.hostname.endsWith(".rutgers.edu"));
}

// SAS profiles identify the department-owned requirements page explicitly.
// Profile recommendations and advising links are intentionally ignored.
export function discoverProfileRequirementPage(html, profileSource, programType) {
  if (programType !== "major" || !sourceIsValid(profileSource)) return null;
  const anchors = String(html || "").matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const match of anchors) {
    const href = attributeValue(match[1], "href");
    if (!href || textFromHtml(match[2]).toLowerCase() !== "major web page") continue;
    try {
      const sourceUrl = new URL(decodeHtml(href), profileSource.source_url);
      if (!isOfficialRutgersUrl(sourceUrl)) continue;
      return {
        source_url: sourceUrl.href,
        source_title: "Official major requirements",
        source_kind: "requirements_page",
      };
    } catch {
      // Keep checking anchors when a profile contains a malformed link.
    }
  }
  return null;
}

// A compact deterministic content fingerprint is sufficient to skip an
// unchanged source snapshot. It is not a security primitive.
function contentHash(value) {
  let hash = 0xcbf29ce484222325n;
  for (const char of String(value || "")) {
    hash ^= BigInt(char.codePointAt(0));
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

function snapshotHeadings(snapshot) {
  try {
    const parsed = JSON.parse(String(snapshot?.parsed_json || "{}"));
    return Array.isArray(parsed.headings)
      ? unique(parsed.headings.map((heading) => String(heading || "").trim()))
      : [];
  } catch {
    return [];
  }
}

function courseCodesInText(value) {
  return unique(String(value || "").match(COURSE_CODE_RE) || []);
}

// This intentionally preserves source structure rather than translating
// prose into requirement rules. A reviewer can use these candidates to build
// a real audit with evidence, while ambiguous text remains draft-only.
export function extractRequirementDraftCandidate(snapshot) {
  const headings = snapshotHeadings(snapshot);
  const headingSet = new Set(headings);
  const lines = String(snapshot?.content_text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const sourceSections = [];
  let activeSection = null;

  for (const line of lines) {
    if (headingSet.has(line)) {
      activeSection = { heading: line, lines: [] };
      sourceSections.push(activeSection);
    } else if (activeSection) {
      activeSection.lines.push(line);
    }
  }

  return {
    extractor_version: 1,
    source_id: String(snapshot?.source_id || ""),
    program_id: String(snapshot?.program_id || ""),
    source_url: String(snapshot?.source_url || ""),
    content_hash: String(snapshot?.content_hash || ""),
    sections: sourceSections
      .map((section) => ({
        heading: section.heading,
        source_text: section.lines.join(" "),
        course_codes: courseCodesInText(section.lines.join(" ")),
      }))
      .filter((section) => section.course_codes.length > 0),
  };
}

export function parseProgramRequirementSource(html, source) {
  if (!sourceIsValid(source)) throw new Error("a valid official HTTPS source is required");
  const visibleHtml = visibleRequirementHtml(html);
  const content_text = textFromHtml(visibleHtml);
  if (!content_text) throw new Error("parsed zero source text");
  const headings = unique([...visibleHtml.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]\s*>/gi)]
    .map((match) => textFromHtml(match[1])));
  const course_codes = unique(content_text.match(COURSE_CODE_RE) || []);
  const source_title = String(source.source_title || headings[0] || "Official program requirements").trim();
  const parsed = {
    version: 1,
    headings,
    course_codes,
  };
  return {
    source_id: source.id,
    program_id: source.program_id,
    source_url: source.source_url,
    source_title,
    content_hash: contentHash(content_text),
    content_text,
    headings,
    course_codes,
    parsed_json: JSON.stringify(parsed),
  };
}

export async function importProgramRequirementSource({ source, fetchHtml, saveSnapshot }) {
  if (!sourceIsValid(source) || typeof fetchHtml !== "function" || typeof saveSnapshot !== "function") {
    throw new Error("a valid official HTTPS source, fetchHtml, and saveSnapshot are required");
  }
  const html = await fetchHtml(source.source_url);
  const snapshot = parseProgramRequirementSource(html, source);
  const saveResult = await saveSnapshot(snapshot);
  return {
    source_id: snapshot.source_id,
    program_id: snapshot.program_id,
    courses_found: snapshot.course_codes.length,
    headings_found: snapshot.headings.length,
    content_hash: snapshot.content_hash,
    changed: saveResult?.changed !== false,
  };
}
