export function backlog(): Record<string, unknown> {
  return {
    contract_version: 1,
    review_notes: [
      {
        program_id: "example-major",
        section_name: "Electives",
        raw_text: "Choose one additional approved course.",
        resolved: false,
      },
      {
        program_id: "example-minor",
        section_name: null,
        raw_text: "Residency wording was encoded in a reviewed rule.",
        resolved: true,
      },
    ],
  };
}
