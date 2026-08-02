import { htmlToFlatText, looksLikeHeading } from "./html.js";

const CODE_RE = /\d{2}:\d{2,3}:\d{3}/g;
const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

// RBS also uses bold text for headings placed immediately before tables.
// Keep this heading detection shared by the table and prose parsers.
function readBizHeadingLine(line) {
  if (!line.startsWith("\u0001")) return { heading: "", rest: line };
  const end = line.indexOf("\u0002");
  if (end === -1) return { heading: "", rest: line };
  const boldSpan = line.slice(1, end).trim();
  if (!looksLikeHeading(boldSpan)) return { heading: "", rest: line };
  return { heading: boldSpan, rest: line.slice(end + 1).trim() };
}

function findLatestBizHeading(html, currentHeading = "") {
  let heading = currentHeading;
  const lines = htmlToFlatText(html).split("\n").map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const found = readBizHeadingLine(line).heading;
    if (found) heading = found;
  }
  return heading;
}

function isBizColumnHeader(cells) {
  const words = cells.join(" ").toLowerCase().match(/[a-z]+/g) || [];
  const headerWords = new Set(["course", "courses", "credit", "credits", "note", "notes", "and", "prerequisite", "prerequisites"]);
  return words.length > 0 && words.includes("course") && words.every((word) => headerWords.has(word));
}

// Turns one <table>...</table> block into a section. Row 0 is a caption
// spanning the table ("Business Core", "At most TWO courses from the
// following electives", ...); row 1 is usually the Course/Credits/Notes
// header (skipped); everything after is data rows. A "Credit Total" row
// and any row with no course code in its first cell (e.g. the placeholder
// "BAIT elective" rows inside the Required-Courses table — real options
// for those live in the separate Elective-Courses table below) are
// skipped rather than mis-recorded as real requirements.
export function parseBizTable(tableHtml, precedingHeading = "") {
  const rows = [...tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map((m) => m[0]);
  if (!rows.length) return null;
  const cellsOf = (row) =>
    [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      htmlToFlatText(c[1]).replace(/[\u0001\u0002]/g, "").replace(/\s*\n\s*/g, "; ").trim()
    );

  let idx = 0;
  const captionCells = cellsOf(rows[idx]); idx++;
  // Captions are almost always wrapped in <strong>/<b>/<th><b> in the source
  // HTML, so htmlToFlatText's bold-sentinel markers (\u0001...\u0002 — used
  // elsewhere to detect headings, e.g. in extractBizProse) are still attached
  // here. Strip them before using the caption as either the group's display
  // name OR the target of the rule regex below — leaving them in silently
  // broke both: names rendered with literal \u0001/\u0002 characters, and
  // "at least/at most" never matched because the string started with \u0001,
  // not "A".
  const caption = (captionCells.find((c) => c) || "").replace(/[\u0001\u0002]/g, "").trim();
  const needsHeadingFallback = !caption || isBizColumnHeader(captionCells);
  const sectionName = needsHeadingFallback ? precedingHeading : caption;
  if (!sectionName) return null; // unrecognized table shape — let the caller log it and skip

  if (rows[idx]) {
    const hdr = cellsOf(rows[idx]).join(" ").toLowerCase();
    if (hdr.includes("course") && hdr.includes("credit")) idx++; // skip literal column-header row
  }

  // A heading outside a Course/Credits/Notes table confirms this is a
  // selectable-course group, but does not reliably state how many to choose.
  const section = {
    name: sectionName,
    sourceHeading: precedingHeading,
    courseItems: [],
    orGroups: [],
    subgroups: [],
    prose: [],
    placeholderElectiveCount: 0,
    rule: needsHeadingFallback ? "min_courses" : "all",
    count: null,
  };
  if (!needsHeadingFallback) {
    const atLeast = caption.match(/^at least (\w+)/i);
    const atMost = caption.match(/^at most (\w+)/i);
    if (atLeast) {
      section.rule = "min_courses";
      section.count = WORD_NUM[atLeast[1].toLowerCase()] || parseInt(atLeast[1], 10) || 1;
    } else if (atMost) {
      section.rule = "max_courses";
      section.count = WORD_NUM[atMost[1].toLowerCase()] || parseInt(atMost[1], 10) || 1;
    }
  }

  for (; idx < rows.length; idx++) {
    const cells = cellsOf(rows[idx]);
    if (!cells.length) continue;
    const courseCell = cells[0] || "";
    const creditCell = cells[1] || "";
    const noteCell = cells[2] || "";
    if (/credit total/i.test(courseCell)) continue;
    const codeMatches = [...courseCell.matchAll(CODE_RE)];
    if (!codeMatches.length) {
      // Some RBS pages state the required number of electives as repeated
      // placeholders in the required-course table (for example, four rows
      // reading "Finance elective"), then list the actual choices in the
      // next "Elective Courses" table. Retain the count instead of silently
      // dropping the requirement just because this particular row has no
      // course code.
      if (/\belective\b/i.test(courseCell)) section.placeholderElectiveCount++;
      continue;
    }

    const items = codeMatches.map((cm, i) => {
      const segStart = cm.index + cm[0].length;
      const nextStart = i + 1 < codeMatches.length ? codeMatches[i + 1].index : courseCell.length;
      const title = courseCell.slice(segStart, nextStart).replace(/\bOR\b/gi, "").trim().replace(/[,.]$/, "");
      return { code: cm[0], title, credits: (creditCell.match(/[\d.]+/) || [""])[0] };
    });
    const note = noteCell;
    // Some official RBS tables repeat a course in a major-specific section
    // only to say it is already fulfilled by the Business Core. It is a
    // cross-reference, not a second requirement or additional credit. Keep
    // the source statement as reviewable prose but do not render a duplicate
    // course card outside the Core.
    if (
      !/business core/i.test(section.name) &&
      /\bfulfilled in (?:the )?business core requirements?\b/i.test(note)
    ) {
      section.prose.push(`${items.map((item) => `${item.code} ${item.title}`.trim()).join(" / ")}: ${note}`);
      continue;
    }
    if (items.length > 1) {
      section.orGroups.push(items.map((it) => ({ ...it, note })));
    } else {
      section.courseItems.push({ ...items[0], note });
    }
  }
  return section.courseItems.length || section.orGroups.length ? section : null;
}

function isLegacyBizCurriculum(section) {
  // The app currently represents the active catalog path for a program.
  // Rutgers labels older tables explicitly (for example, "students admitted
  // prior to Fall 2022"), so excluding those tables prevents students from
  // being shown both old and current requirements as if they were cumulative.
  const heading = String(section.sourceHeading || "");
  return /\bstudents?\b[\s\S]{0,70}\b(?:admitted|entered)\b[\s\S]{0,70}\b(?:prior|before|earlier)\b/i.test(heading);
}

function linkBizElectivePlaceholders(sections) {
  for (let index = 0; index < sections.length; index++) {
    const source = sections[index];
    if (!source.placeholderElectiveCount) continue;

    // RBS places the selectable course list immediately after the required
    // course table. Only infer a count for a plainly titled generic elective
    // table; headings that already say "at least" or "at most" own their
    // rule and must not be overwritten.
    const target = sections.slice(index + 1).find((candidate) =>
      /^elective courses?$/i.test(String(candidate.name || "").trim()) && candidate.count == null
    );
    if (!target) continue;
    target.rule = "min_courses";
    target.count = source.placeholderElectiveCount;
  }
}

function bizNumber(value) {
  return WORD_NUM[String(value || "").toLowerCase()] || parseInt(value, 10) || 0;
}

function applyBizElectiveMixPolicies(sections, html) {
  const text = htmlToFlatText(html).replace(/\s+/g, " ");
  const policyRe = /at least\s+(\w+)\s+of your\s+(\w+)\s+major electives[\s\S]{0,140}?must come from the\s+(\d{3})\/([^\.]+?)\s+major code\.\s*no more than\s+(\w+)\s+major elective may come from other departments/gi;

  for (const match of text.matchAll(policyRe)) {
    const [, minimumText, totalText, subjectCode, subjectName, maximumOutsideText] = match;
    const minimum = bizNumber(minimumText);
    const total = bizNumber(totalText);
    const maximumOutside = bizNumber(maximumOutsideText);
    if (!minimum || !total || !maximumOutside) continue;

    const electiveSection = sections.find((section) =>
      /^elective courses?$/i.test(String(section.name || "").trim()) &&
      section.courseItems.some((item) => item.code.startsWith(`33:${subjectCode}:`))
    );
    if (!electiveSection) continue;

    const subjectItems = electiveSection.courseItems.filter((item) => item.code.startsWith(`33:${subjectCode}:`));
    const outsideItems = electiveSection.courseItems.filter((item) => !item.code.startsWith(`33:${subjectCode}:`));
    if (!subjectItems.length || !outsideItems.length) continue;

    electiveSection.rule = "min_courses";
    electiveSection.count = total;
    electiveSection.subgroups.push(
      {
        name: `At least ${minimum} ${subjectName.trim()} elective${minimum === 1 ? "" : "s"}`,
        rule: "min_courses",
        count: minimum,
        courseItems: subjectItems,
      },
      {
        name: `Up to ${maximumOutside} approved elective${maximumOutside === 1 ? "" : "s"} from other departments`,
        rule: "max_courses",
        count: maximumOutside,
        courseItems: outsideItems,
      }
    );
  }
}

function finalizeBizSections(sections, html) {
  const activeCatalogSections = sections.filter((section) => !isLegacyBizCurriculum(section));
  linkBizElectivePlaceholders(activeCatalogSections);
  applyBizElectiveMixPolicies(activeCatalogSections, html);
  return activeCatalogSections;
}

export function parseBizPageText(html) {
  const sections = [];
  let currentHeading = "";
  let lastTableEnd = 0;
  for (const match of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    currentHeading = findLatestBizHeading(html.slice(lastTableEnd, match.index), currentHeading);
    const section = parseBizTable(match[0], currentHeading);
    if (section) sections.push(section);
    lastTableEnd = match.index + match[0].length;
  }
  return finalizeBizSections(sections, html);
}

// parseBizTable/parseBizPageText only ever look INSIDE <table> elements.
// Real policy text — e.g. "BAIT Major Special Notes" (the double-count cap,
// the Accounting-major substitution rule) and footnotes like "*01:640:151
// or 01:640:130 also acceptable" — lives in a <ul>/<li> or a stray <p>
// between tables, not in one, so it was previously never seen at all.
//
// IMPORTANT — bullet capture is heading-gated on purpose. These pages are
// full of OTHER bullet lists that have nothing to do with requirements:
// nav menus ("Ancillary", "Academic Programs", "Areas of Study"), "Key
// Facts", "Sample Occupations", footer links. Capturing every bullet
// on the page (an earlier version of this function did) pulled in menu
// items right alongside real policy notes — confirmed against a real
// fetch of the BAIT page, which has 4 genuine Special Notes bullets
// buried among 100+ irrelevant ones. So bullets only get pushed while
// currentHeading matches /special notes/i — every RBS major page so far
// follows the same "{Major} Major Special Notes" heading, so this should
// generalize across all 6 without hardcoding each major's exact heading
// text. Footnote lines (a bare line starting with "*") are NOT
// heading-gated — they're rare and distinctive enough on their own not
// to need it, and gating them would lose the Business Core footnote,
// which sits right after that table, before any heading at all.
export function extractBizProse(html) {
  const gapsHtml = html.split(/<table[\s\S]*?<\/table>/gi);
  const notes = [];
  let currentHeading = "";

  for (const gap of gapsHtml) {
    const text = htmlToFlatText(gap);
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    for (let line of lines) {
      const headingLine = readBizHeadingLine(line);
      if (headingLine.heading) {
        currentHeading = headingLine.heading;
        line = headingLine.rest; // fall through in case a bullet trails the heading on the same line
        if (!line) continue;
      }
      line = line.replace(/\u0001/g, "").replace(/\u0002/g, "");
      if (line.startsWith("• ")) {
        // Confirmed against a real scrape: the "Special Notes" heading is
        // sometimes immediately followed by an unrelated "Quick Links" list
        // (resource titles like "BAIT Curriculum Guidesheet") with no
        // heading of its own in between to reset currentHeading. Real
        // policy notes are written as full sentences and end in a period;
        // link titles are short labels that don't. This one extra check
        // filtered out exactly the 3 junk entries and none of the 5 real
        // ones in that test run.
        const bulletText = line.slice(2).trim();
        if (/special notes/i.test(currentHeading) && /[.!?]$/.test(bulletText)) {
          notes.push({ section_name: currentHeading, raw_text: bulletText });
        }
        // else: not under a Special Notes heading, or looks like a link
        // title rather than a policy sentence — skip either way.
      } else if (/policy on .*electives/i.test(currentHeading) && /\b(?:at least|at most|no more than|must)\b/i.test(line)) {
        // A small number of majors state a qualifying elective mix in prose
        // rather than in a table. Save that wording for review instead of
        // pretending that a plain elective list fully captures the rule.
        notes.push({ section_name: currentHeading, raw_text: line });
      } else if (/^\*\S/.test(line) && line.length > 8) {
        notes.push({ section_name: currentHeading || "Footnote", raw_text: line });
      }
    }
  }
  return notes;
}

