import { looksLikeHeading } from "./html.js";

/* ============================================================
   TEXT -> {sections, rawNotes} intermediate representation
   ============================================================ */
const CODE_RE = /\d{2}:\d{2,3}:\d{3}/g;
const CREDIT_RE = /\((\d+(?:\.\d+)?)\)/g;
// Global variant used to strip note parens out BEFORE course-code
// segmentation — notes like "(prerequisite: 33:010:272)" contain a course
// code themselves, which would otherwise get misread as an extra
// requirement item. Segmenting the cleaned line first, then re-attaching
// the extracted note text, avoids that.
const PREREQ_NOTE_RE_G = /\(([^()]*(?:prerequisite|required if|pre-?req|score|grade of)[^()]*)\)/gi;

// Segments a line by course code rather than by a single "code title (credits)"
// regex, because Rutgers frequently writes alternatives as
// "CODE_A Title A OR CODE_B Title B (3)" — ONE trailing credit shared by
// both codes, not one per code. Splitting on code position first, then
// looking for the nearest "(N)" (falling back to the line's last "(N)" if
// a segment doesn't have its own), handles both the shared and per-code
// cases correctly.
export function parseCourseLine(line) {
  const codeMatches = [...line.matchAll(CODE_RE)];
  if (!codeMatches.length) return null;
  const creditMatches = [...line.matchAll(CREDIT_RE)];
  const trailingCredit = creditMatches.length ? creditMatches[creditMatches.length - 1][1] : "";

  const items = codeMatches.map((cm, idx) => {
    const codeEnd = cm.index + cm[0].length;
    const nextStart = idx + 1 < codeMatches.length ? codeMatches[idx + 1].index : line.length;
    const segment = line.slice(codeEnd, nextStart);
    const title = segment.split(/\(|\bOR\b/i)[0].trim().replace(/[,.]$/, "");
    const ownCredit = creditMatches.find((cr) => cr.index >= codeEnd && cr.index < nextStart);
    return { code: cm[0], title, credits: ownCredit ? ownCredit[1] : trailingCredit };
  });

  const isAlternative = items.length > 1 && /\bOR\b/i.test(line);
  return { items, isAlternative };
}

export function parseProgramText(flatText, programName) {
  const lines = flatText.split("\n").map((l) => l.trim()).filter(Boolean);

  const sections = []; // { name, courseItems: [{code,title,credits,note}], orGroups: [[{code,title,credits}]], prose: [] }
  let current = { name: programName || "Requirements", courseItems: [], orGroups: [], prose: [] };
  sections.push(current);

  for (let rawLine of lines) {
    let line = rawLine;

    // Peel off a leading bold span and decide if it's a heading.
    if (line.startsWith("\u0001")) {
      const end = line.indexOf("\u0002");
      if (end !== -1) {
        const boldSpan = line.slice(1, end);
        const rest = line.slice(end + 1).trim();
        if (looksLikeHeading(boldSpan)) {
          current = { name: boldSpan.trim(), courseItems: [], orGroups: [], prose: [] };
          sections.push(current);
          line = rest; // anything trailing the bold heading on the same line still gets parsed below
        }
      }
    }
    // Strip any remaining sentinels (mid-line bold that wasn't treated as a heading).
    line = line.replace(/\u0001/g, "").replace(/\u0002/g, "");
    if (!line) continue;

    // Pull note parens (which may contain their own course codes, e.g.
    // "(prerequisite: 33:010:272)") out BEFORE segmenting by course code,
    // so those embedded codes don't get misread as extra requirement items.
    const noteTexts = [];
    const cleanedLine = line.replace(PREREQ_NOTE_RE_G, (_, inner) => {
      noteTexts.push(inner.trim());
      return "";
    });

    const parsed = parseCourseLine(cleanedLine);
    if (!parsed) {
      // No course code on this line at all -> prose/footnote, human review needed.
      current.prose.push(line);
      continue;
    }

    if (parsed.isAlternative) {
      current.orGroups.push(parsed.items);
    } else {
      const note = noteTexts.join("; ");
      for (const it of parsed.items) {
        current.courseItems.push({ ...it, note });
      }
    }
  }

  return sections.filter((s) => s.courseItems.length || s.orGroups.length || s.prose.length);
}

