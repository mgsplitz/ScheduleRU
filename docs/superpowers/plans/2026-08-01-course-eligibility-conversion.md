# Course eligibility reference-data conversion

## Goal

Remove the final reviewed academic content from structural SQL while
preserving the existing course-eligibility API and planner behavior.

## Architecture

`packages/reference-data` owns source-reviewed, program-neutral academic facts.
The D1 schema remains structural, while the digest-protected JSON snapshot is
the portable recovery and contributor artifact. The development-only admin
route exports and restores the complete bundle transactionally.

## Work sequence

1. Extend the reference-data contract with course reviews and conditions.
2. Add fail-closed validation for sources, statuses, course codes, condition
   shapes, missing reviews, and contradictory no-condition declarations.
3. Extend generic D1 export, transactional publication, snapshots, and CLI
   inventory counts.
4. Convert the three reviewed courses and four conditions into the canonical
   snapshot.
5. Make worker regression tests consume the snapshot rather than SQL.
6. Delete the two reviewed-content SQL files.
7. Run package, legacy, type, and whitespace checks.
8. Deploy only the development Worker and generate a fresh development parity
   report when Cloudflare authentication is available.

## Safety

- No production deployment or production D1 write.
- No secret is stored in the repository.
- Structural course-eligibility tables remain in
  `worker/schema/schema_course_eligibility_conditions.sql`.
- The development parity report is not claimed until a fresh round trip has
  actually completed.
