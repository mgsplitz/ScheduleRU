# Planner

Deterministic four-year planning, term-aware eligibility, planner input
normalization, and versioned planner state live here. This package owns no DOM,
network, catalog content, or Cloudflare code.

The modules currently expose browser globals to preserve the existing app
contract. Root-level files are compatibility imports and must not receive new
logic.
