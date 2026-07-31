# Catalog data parity

## Result

The reviewed catalog completed a development-only legacy-to-generic round trip
on 2026-07-31.

- Reviewed definitions published: 49
- Before public API SHA-256:
  `167f00b1fc786b2faac3323b4e6382ac227e3bfe977e81fcc6ae5770f0083b2c`
- After public API SHA-256:
  `167f00b1fc786b2faac3323b4e6382ac227e3bfe977e81fcc6ae5770f0083b2c`
- Academic/public differences: 0
- Production deployments or database writes: 0

The machine-readable report is
`catalog/snapshots/reviewed-programs.v1.parity.json`.

## Captured surfaces

The parity tool captures before and after:

- `GET /api/programs`;
- `GET /api/core-curricula`;
- every `GET /api/programs/:id/requirements` response;
- `GET /api/requirements` responses in the public 25-program batch limit.

The 49 definitions are republished one at a time through the authenticated,
development-only generic publisher between captures.

## Comparison boundary

The comparison ignores only two non-academic database fields:

- `last_scraped_at`, which is the publication timestamp;
- `auto_generated`, which records the legacy row-construction mechanism.

It compares stored JSON fields structurally so object key order and JSON number
spelling do not create false differences. It also recognizes the existing
application's equivalent legacy representations:

- `max` and `max_courses`;
- empty, zero, and null durable course-credit metadata.

Every other field remains in the comparison, including program identity,
hierarchy, rules, counts, courses, selectors, conditions, eligibility rules,
source information, and evidence returned by the public APIs.

## Recovery and clean rerun

The first run intentionally failed because its comparator treated the
representation differences above as byte differences. No SQL was removed.

Development D1 was restored with Time Travel to the verified bookmark
immediately before that run:

`00000134-00000022-000050b9-6fe7475f10415524974d488b621c33fb`

The improved comparator then reran from the restored legacy state and produced
the matching hashes above. The development database now contains the generic
round-trip result.
