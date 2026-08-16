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
- **Vendored**: 2026-08-16, from `getdvt/dvt` `origin/main` @ `1374178aba454f5feb26ac00653e2b77f5b9dedc`
  (blob sha `ddfbfba94de7dc0e21fe9ace75ecf7acb42fbd9f`, upstream sha256
  `715ddb53f18d709db4d1f0e5c16f8c244497aa6e46e8b264058f94a86712c0e8`).
- **⚠️ NOT a verbatim copy — this is the NORMALIZED form.** `description` and `$comment` annotation
  prose is stripped by `scripts/normalize-schema.mjs` before vendoring. **This repo is public and
  `getdvt/dvt` is not**: upstream's prose is internal engineering commentary (source paths, ADR and
  ticket history, version-scoped security notes), and publishing it here would be irreversible.
  Structure only.
- **sha256 of the vendored (normalized) file**:
  `2337f49d7760f8d0d1d1f8e493c67a440ef47f9b429a0e723a2ada6be9511e18`.
- **Reproduce it** — the vendored file is a deterministic function of the upstream one:
  ```
  gh api repos/getdvt/dvt/contents/spec/schema/dashboard.schema.json \
    -H "Accept: application/vnd.github.raw" > /tmp/upstream.json
  node scripts/normalize-schema.mjs /tmp/upstream.json | shasum -a 256   # must match the sha256 above
  ```
- **Validation is unaffected.** `description`/`$comment` are annotation keywords that ajv ignores.
  This was verified by validating the same panels against both the verbatim and the normalized
  schema and confirming identical accept/reject verdicts, including all three DVT-3084 defect shapes.
  The strip is schema-aware: 7 places in this schema use `description`/`$comment` as real property
  NAMES (`$defs/Meta`, `PageDoc`, `MetricItem`, `TableColumn`, `StatSpec`, `KpiSpec`, and top-level
  `properties/$comment`), and those definitions are preserved — a naive recursive delete would have
  silently weakened what the schema accepts.
- **Why vendored**: `getdvt/dvt` is private and PR CI has no token to read it live (same reason as
  `panel-types.json`).
- **Refresh**: `scripts/sync-panel-types.sh` (it refreshes this file and `panel-types.json` from one
  fetch). The weekly `upstream-sweep` job normalizes the live upstream with the *same* script before
  comparing, so the two sides cannot diverge — but note it therefore does NOT detect prose-only
  upstream edits, which by the argument above cannot affect any gate.
- Do NOT hand-edit it; do NOT import it from a page or component (it would land in the client
  bundle). It is read only by `scripts/check-chart-specs.mjs` at build/CI time.
