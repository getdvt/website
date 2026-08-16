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
