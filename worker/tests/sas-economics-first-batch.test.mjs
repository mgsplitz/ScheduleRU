import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { evaluateProgramSelection } from "../src/program-selection-policy.js";

const seedUrl = new URL("../schema/review_sas_economics_batch_1.sql", import.meta.url);

test("the first public SAS batch contains reviewed Economics paths with evidence", async () => {
  assert.equal(
    existsSync(seedUrl),
    true,
    "reviewed SAS Economics seed must exist before it can be released"
  );

  const seed = await readFile(seedUrl, "utf8");
  assert.match(seed, /'sasnb-economics-major'/);
  assert.match(seed, /'sasnb-quantitative-economics-minor'/);
  assert.match(seed, /'sasnb'/);
  assert.match(seed, /requirement_evidence_required/);
  assert.match(seed, /program_requirement_evidence/);
  assert.match(seed, /'reviewed'/);
});

test("the reviewed Economics major retains its complete Spring 2026 course shape", async () => {
  const seed = await readFile(seedUrl, "utf8");
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

  for (const code of [...majorCore, ...calculusChoices, ...statisticsChoices, ...upperElectives]) {
    assert.match(seed, new RegExp(`'${code}'`));
  }
  assert.match(seed, /Seven Economics electives from the Spring 2026 worksheet/);
  assert.match(seed, /At least four upper-level Economics electives/);
  assert.match(seed, /'min_courses', 7/);
  assert.match(seed, /'min_courses', 4/);
});

test("the quantitative Economics minor uses its published finite upper-elective list", async () => {
  const seed = await readFile(seedUrl, "utf8");
  const minorElectives = [
    "01:220:410", "01:220:420", "01:220:422", "01:220:423", "01:220:424",
    "01:220:480", "01:220:481", "01:220:482", "01:220:483", "01:220:485",
  ];

  for (const code of minorElectives) {
    assert.match(seed, new RegExp(`\\('sasnb-quantitative-economics-minor-upper-elective', '${code}'`));
  }
  assert.match(seed, /One listed upper-level Economics elective/);
  assert.match(seed, /Current official Department of Economics requirements page; no catalog-year boundary stated/);
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
    combinationPolicies: [{
      policy_key: "sasnb-economics-major-no-quantitative-economics-minor",
      home_school_slug: "sasnb",
      program_a_id: "sasnb-economics-major",
      program_b_id: "sasnb-quantitative-economics-minor",
      decision: "blocked",
      note: "Economics (220) majors may not minor in Quantitative Economics (221).",
      source_url: "https://sasundergrad.rutgers.edu/majors-and-core-curriculum/major/major-minor-details/economics",
    }],
  });

  assert.equal(result.allowed, false);
  assert.deepEqual(result.errors.map((issue) => issue.code), [
    "combination:sasnb-economics-major-no-quantitative-economics-minor",
  ]);
});
