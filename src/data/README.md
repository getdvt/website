# src/data provenance

## world.geo.json

- **Source**: https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json
  (Natural Earth-derived, public domain).
- **Fetched**: 2026-08-15.
- **sha256** (current file, post-modification): `acd578ac987146ca910f609eb3969432395c1a4d74a3db2207d4420d503a1046`
- **Shape**: a `FeatureCollection` of 180 features, each keyed on `properties.name`
  (the country name used to bind chart data — see `src/data/chart-page-extras.ts`).
- **Local modification**: the `United States of America` feature's `properties.name`
  was renamed to `United States` for parity with the common-English name vocabulary
  dvt's bundled `world` map uses (ADR-0023). No geometry was changed.

## dashboard.schema.json

- **Source**: `getdvt/dvt` -> `spec/schema/dashboard.schema.json`.
- **⚠️ NOT a verbatim copy — this is the NORMALIZED form.** `description`, `$comment`, `title`, and
  `examples` annotation prose is stripped by `scripts/normalize-schema.mjs` before vendoring. **This repo is public and
  `getdvt/dvt` is not**: upstream's prose is internal engineering commentary (source paths, ADR and
  ticket history, version-scoped security notes), and publishing it here would be irreversible.
  Structure only.

<!-- provenance:begin — maintained by scripts/sync-panel-types.sh; do not hand-edit between markers -->
- **Vendored**: 2026-08-21, from `getdvt/dvt` `origin/main` @ `7cd504b0cbec15726040d42714478f3baa581ae5`
  (blob sha `e184a92d9301a257c4e0461c3ecc5286e90c66af`, upstream sha256
  `ce5b9dccdf21379856086fe6a5711cb4b03dee1fa9e3d8beff4055425bb52877`).
- **Vendored (normalized) sha256**: `47400515b50da9ab812a25f2ccb84b8e1a86051a1b5b89fafeba61696fb898c7`.
- **Reproduce it** — the vendored file is a deterministic function of the upstream one:
  ```
  # ?ref= pins the SAME commit this block records. Without it the fetch follows the
  # default branch, so the first upstream schema commit makes the sha mismatch and
  # read as a bug rather than as expected drift.
  gh api "repos/getdvt/dvt/contents/spec/schema/dashboard.schema.json?ref=7cd504b0cbec15726040d42714478f3baa581ae5" \
    -H "Accept: application/vnd.github.raw" > /tmp/upstream.json
  node scripts/normalize-schema.mjs /tmp/upstream.json | shasum -a 256   # must match the sha256 above
  ```
<!-- provenance:end -->

- **Validation is unaffected.** `description`/`$comment`/`title`/`examples` (the DVT-3231 strip
  scope) are annotation keywords that ajv ignores. The original `description`/`$comment` strip was
  verified by validating the same panels against both the verbatim and the normalized schema and
  confirming identical accept/reject verdicts, including all three DVT-3084 defect shapes; the same
  annotation-keyword argument covers `title`/`examples`.
  The strip is schema-aware: 7 places in this schema use `description`/`$comment` as real property
  NAMES (`$defs/Meta`, `PageDoc`, `MetricItem`, `TableColumn`, `StatSpec`, `KpiSpec`, and top-level
  `properties/$comment`), and 5 more use `title` (`$defs/Meta`, `Section`, `FilterBarSpec`, `Panel`,
  `Page`). Those definitions are preserved — a naive recursive delete would have silently weakened
  what the schema accepts.
- **Why vendored**: `getdvt/dvt` is private and PR CI has no token to read it live (same reason as
  `panel-types.json`).
- **Refresh**: `scripts/sync-panel-types.sh` — one fetch, but it maintains FOUR artifacts: this file
  (`dashboard.schema.json`), `panel-types.json`, this README's own provenance block (between the
  markers above), and the `EXPECTED_SHA256` constant in `scripts/check-chart-types.mjs`. The weekly
  `upstream-sweep` job normalizes the live upstream with the *same* script before comparing, so the
  two sides cannot diverge — but note it therefore does NOT detect prose-only upstream edits, which by
  the argument above cannot affect any gate.
- Do NOT hand-edit it; do NOT import it from a page or component (it would land in the client
  bundle). It is read only by `scripts/check-chart-specs.mjs` at build/CI time.
- A hand-edit does not wait for the Monday sweep to surface: the `drift` job asserts at PR time that
  this file is a FIXED POINT of the normalizer (`normalize(vendored) == vendored`), so editing either
  this file or `scripts/normalize-schema.mjs` without re-running the sync goes red on the PR. Two more
  PR-time checks in `scripts/check-chart-types.mjs` catch a split among the OTHER artifacts the sync
  script maintains: a sha256-consistency check (this file vs. `EXPECTED_SHA256`) and a
  README-provenance-staleness check (this file's sha256 vs. the labeled line in this README's
  provenance block, above) — both advisory, same as the rest of that script. The fixed-point gate is
  also what makes the asymmetric weekly compare rigorous — it discharges the premise that lets
  `cmp normalize(upstream) vendored` stand in for a normalized-to-normalized compare.

## chart-type-status.json

- **Source**: `getdvt/dvt` -> `spec/schema/echarts/chart-types.json` -> `types[*].status`.
- **⚠️ NOT a strip of upstream — this is a WHITELIST PROJECTION.** The upstream file is ~91KB and
  saturated with internal engineering prose at every level: ticket refs, ADR citations, security
  commentary, internal file paths, and per-entry `caveat`/`research`/`whenToUse`/`exampleSkeleton`
  fields. A *strip* (delete known-bad keys, keep the rest) inherits the upstream author's vocabulary —
  a new prose key added upstream tomorrow sails straight through unstripped, because a strip-list only
  knows what to remove, not what is safe to keep. A *projection* (`scripts/project-chart-type-status.mjs`)
  inverts that: the output is built key-by-key from an explicit allowlist — here, just `status` per
  type — so no upstream annotation *value* can leak by construction. The type *keys* are
  upstream-authored strings, so the projector additionally refuses to run unless every key matches a
  strict shape pattern. **This repo is public and `getdvt/dvt` is not.**
- **Closed status enum, fail-closed**: every type's `status` must be one of `stable` / `passthrough` /
  `advanced`. A missing status, or a value outside that set, makes `scripts/project-chart-type-status.mjs`
  refuse to project (zero stdout bytes, non-zero exit) rather than pass an unrecognized value through —
  a new upstream status may carry a data-binding contract `scripts/check-chart-specs.mjs` has never been
  audited against, so it must be reviewed by a human before it is vendored.
- **Consumed by**: `scripts/check-chart-specs.mjs`'s data-binding gate — a deliberately-stricter
  gallery *house style* keyed on status alone (dvt's real lint is binder-sensitive, and `binder` is
  not vendored): `passthrough` chart types ship with inline `spec.series[].data`; every other chart
  type, plus the data-bearing element types (`table`/`kpi`/`stat`/`metric-strip`), carries a `data`
  block (`query`/`sourceId`/`rows`/`metricRef`). Non-data element types are schema-validated only.

<!-- chart-type-status-provenance:begin — maintained by scripts/sync-panel-types.sh; do not hand-edit between markers -->
- **Vendored**: 2026-08-21, from `getdvt/dvt` `origin/main` @ `1b43b40dcbe7495e35fea96467df5e1f415637b7`
  (blob sha `cb6c52a3322e84a37eddd0bbc47557f61300d87b`, upstream sha256
  `bbab92920a2d3c79d86183d03f4f9303163a74f6ae0354e2b8f077026142bb36`).
- **Vendored (projected) sha256**: `ef30f3a0f054db92175974b32817ce14ec199efd059cd204299acf3483d8b317`.
- **Reproduce it** — the vendored file is a deterministic function of the upstream one:
  ```
  # ?ref= pins the SAME commit this block records. Without it the fetch follows the
  # default branch, so the first upstream chart-types commit makes the sha mismatch and
  # read as a bug rather than as expected drift.
  gh api "repos/getdvt/dvt/contents/spec/schema/echarts/chart-types.json?ref=1b43b40dcbe7495e35fea96467df5e1f415637b7" \
    -H "Accept: application/vnd.github.raw" > /tmp/upstream-chart-types.json
  node scripts/project-chart-type-status.mjs /tmp/upstream-chart-types.json | shasum -a 256   # must match the sha256 above
  ```
<!-- chart-type-status-provenance:end -->

- **Why vendored**: `getdvt/dvt` is private and PR CI has no token to read it live (same reason as
  `panel-types.json` and `dashboard.schema.json`).
- **Refresh**: `scripts/sync-panel-types.sh` — one additional fetch (of `spec/schema/echarts/chart-types.json`,
  resolved to its OWN last-touching commit, `CT_UPSTREAM_COMMIT` — distinct from the schema's
  `UPSTREAM_COMMIT`, since the two files have different edit histories) alongside the schema fetch. It
  maintains this file, this README's chart-type-status provenance block (between the markers above),
  and the `EXPECTED_CHART_TYPE_STATUS_SHA256` constant in `scripts/check-chart-types.mjs`. The weekly
  `upstream-sweep` job projects the live upstream with the *same* script before comparing, so the two
  sides cannot diverge — but note it therefore does NOT detect prose-only or status-preserving upstream
  edits, which by the argument above cannot affect any gate.
- Do NOT hand-edit it; do NOT import it from a page or component (it would land in the client bundle).
  It is read only by `scripts/check-chart-specs.mjs` at build/CI time.
- `scripts/check-chart-types.mjs` catches a split among the artifacts the sync script maintains for
  this file: a sha256-consistency check (this file vs. `EXPECTED_CHART_TYPE_STATUS_SHA256`), a
  README-provenance-staleness check (this file's sha256 vs. the labeled line in the provenance block
  above), and a shape check (non-empty `types`, every value in the closed enum) — all advisory, same as
  the rest of that script.
