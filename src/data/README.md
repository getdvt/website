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
  (blob sha `ddfbfba94de7dc0e21fe9ace75ecf7acb42fbd9f`).
- **sha256**: `715ddb53f18d709db4d1f0e5c16f8c244497aa6e46e8b264058f94a86712c0e8`.
- **Why vendored**: `getdvt/dvt` is private and PR CI has no token to read it live (same reason as
  `panel-types.json`).
- **Refresh**: `scripts/sync-panel-types.sh` (it refreshes this file and `panel-types.json` from one
  fetch).
- Do NOT hand-edit it; do NOT import it from a page or component (225KB would land in the client
  bundle). It is read only by `scripts/check-chart-specs.mjs` at build/CI time.
