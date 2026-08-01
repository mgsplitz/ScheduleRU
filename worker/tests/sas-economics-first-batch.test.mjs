import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProgramSelection } from "../src/program-selection-policy.js";
import {
  courseCodes,
  programDefinition,
  requirementGroup,
} from "./helpers/catalog-snapshot.mjs";
import { programCombinationPolicy } from "./helpers/reference-data-snapshot.mjs";

test("the reviewed Economics major retains its complete Spring 2026 course shape", () => {
  const id = "sasnb-economics-major";
  const definition = programDefinition(id);
  const majorCore = ["01:220:102", "01:220:103", "01:220:320", "01:220:321", "01:220:322"];
  const calculusChoices = ["01:640:130", "01:640:135", "01:640:151"];
  const statisticsChoices = ["01:960:211", "01:960:285", "01:960:291"];
  const upperElectives = [
    "01:220:402", "01:220:410", "01:220:411", "01:220:412", "01:220:413",
    "01:220:420", "01:220:421", "01:220:422", "01:220:423", "01:220:424",
    "01:220:431", "01:220:432", "01:220:433", "01:220:435", "01:220:436",
    "01:220:438", "01:220:439", "01:220:440", "01:220:441", "01:220:460",
    "01:220:463", "01:220:477", "01:220:480", "01:220:481", "01:220:482",
    "01:220:483", "01:220:485", "01:220:493", "01:220:494", "01:220:495",
  ];

  const codes = new Set(courseCodes(id));
  for (const code of [...majorCore, ...calculusChoices, ...statisticsChoices, ...upperElectives]) {
    assert.ok(codes.has(code), `missing ${code}`);
  }
  assert.equal(definition.program.catalog_year, "Spring 2026 worksheet");
  assert.equal(definition.program.requirement_evidence_required, true);
  assert.deepEqual(
    [
      requirementGroup(id, `${id}-electives`).count,
      requirementGroup(id, `${id}-upper-electives`).count,
    ],
    [7, 4],
  );
});

test("the quantitative Economics minor uses its published finite upper-elective list", () => {
  const id = "sasnb-quantitative-economics-minor";
  const minorElectives = [
    "01:220:410", "01:220:420", "01:220:422", "01:220:423", "01:220:424",
    "01:220:480", "01:220:481", "01:220:482", "01:220:483", "01:220:485",
  ];

  const group = requirementGroup(id, `${id}-upper-elective`);
  assert.deepEqual(group.courses.map(({ code }) => code), minorElectives);
  assert.equal(group.count, 1);
  assert.match(group.evidence.reviewer_note, /no catalog-year boundary stated/);
});

test("the published Economics major and Quantitative Economics minor pairing is blocked", () => {
  const result = evaluateProgramSelection({
    homeSchoolSlug: "sasnb",
    selectedProgramIds: ["sasnb-economics-major", "sasnb-quantitative-economics-minor"],
    programs: [
      { id: "sasnb-economics-major", school_slug: "sasnb", type: "major" },
      { id: "sasnb-quantitative-economics-minor", school_slug: "sasnb", type: "minor" },
    ],
    limits: [],
    eligibilityRules: [],
    combinationPolicies: [
      programCombinationPolicy("sasnb-economics-major-no-quantitative-economics-minor"),
    ],
  });

  assert.equal(result.allowed, false);
  assert.deepEqual(result.errors.map((issue) => issue.code), [
    "combination:sasnb-economics-major-no-quantitative-economics-minor",
  ]);
});

test("the traditional Economics minor is a reviewed selector-backed SAS program", () => {
  const id = "sasnb-economics-minor";
  const definition = programDefinition(id);
  assert.deepEqual(
    [definition.program.academic_program_code, definition.program.program_family_id],
    ["220", "sasnb-economics-220"],
  );
  assert.ok(courseCodes(id).includes("01:220:212"));
  assert.equal(courseCodes(id).includes("14:540:343"), false);
  const selector = requirementGroup(id, `${id}-electives`).selectors[0].selector;
  assert.deepEqual(
    [selector.course_number_min, selector.course_number_max],
    [300, 499],
  );
});
