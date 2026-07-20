import assert from "node:assert/strict";
import test from "node:test";
import { publicSchoolProfile } from "../src/school-profiles.js";

test("a reviewed school profile exposes its own program terminology", () => {
  const profile = publicSchoolProfile({
    slug: "rbsnb",
    institution_slug: "rutgers",
    campus_slug: "new-brunswick",
    name: "Rutgers Business School - New Brunswick",
    short_name: "RBS New Brunswick",
    catalog_year: "25-26",
    source_url: "https://example.edu/catalog",
    source_title: "Example catalog",
    configuration_json: JSON.stringify({
      default_program_id: "rbsnb-bait",
      program_type_sections: [
        { type: "concentration", label: "Concentrations", singular: "Concentration" },
      ],
    }),
  });

  assert.equal(profile.context.defaultProgramId, "rbsnb-bait");
  assert.equal(profile.context.programTypeSections.find((section) => section.type === "concentration").label, "Concentrations");
  assert.equal(profile.context.programTypeSections.find((section) => section.type === "major").label, "Majors");
});

test("a malformed school configuration falls back to generic, safe labels", () => {
  const profile = publicSchoolProfile({
    slug: "test-school",
    institution_slug: "rutgers",
    campus_slug: "new-brunswick",
    name: "Test School",
    short_name: "",
    configuration_json: "not-json",
  });

  assert.equal(profile.short_name, "Test School");
  assert.equal(profile.context.defaultProgramId, null);
  assert.deepEqual(profile.context.sharedRequirementReferenceTypes, ["major"]);
  assert.equal(profile.context.programTypeSections.find((section) => section.type === "concentration").label, "Concentrations and tracks");
});
