export function sourceBundle(): Record<string, unknown> {
  return {
    contract_version: 1,
    sources: [{
      id: "example-directory",
      school_slug: "example-school",
      directory_url: "https://example.rutgers.edu/programs",
      profile_path: "/programs/",
      catalog_year: "2026-2027",
      source_title: "Example program directory",
      adapter: "html_program_directory_v1",
      enabled: true,
      owner_labels: ["Example School"],
      identity_overrides: [{
        program_slug: "example-program",
        type: "major",
        program_id: "example-program-major",
      }],
    }],
  };
}
