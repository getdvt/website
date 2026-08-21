#!/usr/bin/env node
//
// Guard: every dvtType string in src/data/charts.ts must be a member of
// the vendored PanelType enum in src/data/panel-types.json.
//
// The enum is VENDORED (not fetched live) because getdvt/dvt is private and
// CI has no token to read it, and there is no public schema URL. Refresh it
// locally with: scripts/sync-panel-types.sh (needs getdvt/dvt checked out
// as a sibling of this repo, or DVT_REPO=/path/to/dvt set).
//
// Coverage split:
//   - PR trigger (paths filter) catches a hand-edit of charts.ts that
//     introduces a typo or an invented type, and catches a stale panel-types.json
//     after a manual refresh that didn't get committed.
//   - UPSTREAM drift (a silent rename in getdvt/dvt while both local files sit
//     unchanged) is caught by the weekly `upstream-sweep` job in
//     .github/workflows/chart-types-drift.yml, which reads origin/main's schema
//     live via `gh api` using a short-lived getdvt-ci-reader GitHub App token
//     (gated on the DVT_SCHEMA_APP_ID variable) and set-compares the enum, then
//     structurally compares the full schema after normalizing the upstream fetch
//     with scripts/normalize-schema.mjs (asymmetric on purpose: only upstream is
//     normalized, the vendored file is compared as committed). The App and its
//     private-key secret are provisioned and the sweep is LIVE — see
//     .github/github-app-ci-reader.md. A red sweep is real drift, not an unwired gate.
//
// This script also gates the two vendored artifacts (panel-types.json and the
// full dashboard.schema.json) against each other — see the set-compare below.
//
// Zero external dependencies: reads three local files, pure Node built-ins.
//

import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CHARTS_FILE = resolve(REPO_ROOT, 'src/data/charts.ts');
const ENUM_FILE = resolve(REPO_ROOT, 'src/data/panel-types.json');
const SCHEMA_FILE = resolve(REPO_ROOT, 'src/data/dashboard.schema.json');
const README_FILE = resolve(REPO_ROOT, 'src/data/README.md');

// Maintained by scripts/sync-panel-types.sh — do not hand-edit. Must equal the
// sha256 of src/data/dashboard.schema.json AND the "Vendored (normalized) sha256"
// line in src/data/README.md; both are asserted below.
const EXPECTED_SHA256 = '2337f49d7760f8d0d1d1f8e493c67a440ef47f9b429a0e723a2ada6be9511e18';

const chartsSource = readFileSync(CHARTS_FILE, 'utf8');
const { panelTypes } = JSON.parse(readFileSync(ENUM_FILE, 'utf8'));

// Read the vendored schema's raw bytes ONCE — reused for the consistency check
// below and for the JSON.parse further down.
const schemaRaw = readFileSync(SCHEMA_FILE, 'utf8');
const schemaSha256 = createHash('sha256').update(schemaRaw).digest('hex');

// Check 1 (consistency): the file actually committed at src/data/dashboard.schema.json
// must match its recorded sha256. A mismatch here means the VENDORED file itself
// changed — an accidental split from a hand-edit, a botched merge, a partial
// sync — NOT that upstream drifted (that's the weekly sweep's job); this check
// runs on every PR/build. This is NOT tamper-resistance: EXPECTED_SHA256 lives
// in the same file (and the same diff) an attacker editing the schema would
// touch, so a deliberate, self-consistent edit of both defeats it trivially —
// it only catches an accidental split between the two.
if (schemaSha256 !== EXPECTED_SHA256) {
  console.error(
    `ERROR: ${SCHEMA_FILE} does not match its recorded sha256.\n` +
      `  expected: ${EXPECTED_SHA256}\n` +
      `  actual:   ${schemaSha256}\n` +
      'This means the VENDORED file changed, not that upstream drifted.\n' +
      'Fix: if this is an intentional refresh, run ./scripts/sync-panel-types.sh ' +
      '(it rewrites this constant and src/data/README.md) and commit all four files; ' +
      'otherwise revert the edit to src/data/dashboard.schema.json.'
  );
  process.exit(1);
}

// Check 2 (README staleness): src/data/README.md's provenance block must record
// the SAME sha256 as the file actually committed here, so a stale README goes red
// in CI instead of sitting silent. Anchored on the stable label, not on any bare
// 64-hex match — the README also records an unrelated sha256 for world.geo.json.
// Scoped and unique, mirroring the EXPECTED_SHA256-uniqueness discipline
// sync-panel-types.sh applies to itself: match globally and require EXACTLY one
// occurrence of the label (zero or more than one is an error), and require that
// occurrence to fall AFTER the `<!-- provenance:begin` marker — a stray or
// duplicated label outside the machine-maintained block must not be mistaken
// for the real one.
const readmeRaw = readFileSync(README_FILE, 'utf8');
const provenanceBeginIdx = readmeRaw.indexOf('<!-- provenance:begin');
if (provenanceBeginIdx === -1) {
  console.error(
    `ERROR: could not find the "<!-- provenance:begin" marker in ${README_FILE}.\n` +
      'Fix: run ./scripts/sync-panel-types.sh to regenerate the provenance block.'
  );
  process.exit(1);
}
const readmeShaMatches = [...readmeRaw.matchAll(/\*\*Vendored \(normalized\) sha256\*\*:\s*`([0-9a-f]{64})`/g)];
if (readmeShaMatches.length !== 1) {
  console.error(
    `ERROR: expected exactly one "Vendored (normalized) sha256" provenance label in ${README_FILE}, found ${readmeShaMatches.length}.\n` +
      'Fix: run ./scripts/sync-panel-types.sh to regenerate the provenance block.'
  );
  process.exit(1);
}
const [readmeMatch] = readmeShaMatches;
if (readmeMatch.index < provenanceBeginIdx) {
  console.error(
    `ERROR: the "Vendored (normalized) sha256" provenance label in ${README_FILE} sits outside/before ` +
      'the <!-- provenance:begin --> marker.\n' +
      'Fix: run ./scripts/sync-panel-types.sh to regenerate the provenance block.'
  );
  process.exit(1);
}
if (readmeMatch[1] !== schemaSha256) {
  console.error(
    `ERROR: ${README_FILE} records a stale vendored sha256.\n` +
      `  README says: ${readmeMatch[1]}\n` +
      `  actual:       ${schemaSha256}\n` +
      'Fix: run ./scripts/sync-panel-types.sh to regenerate the provenance block and commit the result.'
  );
  process.exit(1);
}

// Gate: the two vendored artifacts must agree. sync-panel-types.sh writes both
// from ONE fetch, so they cannot drift when the script is used — but a hand-edit
// of either file can still split them, and nothing else would notice. Reading the
// enum out of the schema needs no dependency, so this script stays zero-dep and
// keeps running BEFORE `npm ci` in CI.
const schemaEnum = JSON.parse(schemaRaw)?.$defs?.PanelType?.enum;
if (!Array.isArray(schemaEnum) || schemaEnum.length === 0) {
  console.error(
    `ERROR: could not read $defs.PanelType.enum from ${SCHEMA_FILE}. The vendored schema is ` +
      'malformed or its shape changed upstream. Fix: run scripts/sync-panel-types.sh.'
  );
  process.exit(1);
}
const schemaSet = new Set(schemaEnum);
const vendoredSet = new Set(panelTypes);
const onlyInSchema = schemaEnum.filter((t) => !vendoredSet.has(t));
const onlyInVendored = panelTypes.filter((t) => !schemaSet.has(t));
if (onlyInSchema.length > 0 || onlyInVendored.length > 0) {
  console.error(
    'ERROR: the two vendored artifacts disagree — src/data/panel-types.json is out of sync with ' +
      '$defs.PanelType.enum in src/data/dashboard.schema.json.'
  );
  if (onlyInSchema.length > 0) {
    console.error(`  In the schema but not in panel-types.json: ${JSON.stringify(onlyInSchema)}`);
  }
  if (onlyInVendored.length > 0) {
    console.error(`  In panel-types.json but not in the schema: ${JSON.stringify(onlyInVendored)}`);
  }
  console.error('Fix: run ./scripts/sync-panel-types.sh and commit BOTH files.');
  process.exit(1);
}

// Extract every dvtType string-literal value. The regex only matches quoted
// string assignments — the TS interface field `dvtType: string;` has no quotes
// so it never fires here.
const dvtTypeRe = /dvtType:\s*'([^']+)'/g;
const matches = [...chartsSource.matchAll(dvtTypeRe)];

// Sanity guard: if zero literals were found the file shape changed and the
// check would silently pass on an empty set — that's worse than a failure.
if (matches.length === 0) {
  console.error(
    'ERROR: regex /dvtType:\\s*\'([^\']+)\'/g matched nothing in ' + CHARTS_FILE
  );
  console.error('The shape of charts.ts may have changed. Update the regex in this script.');
  process.exit(1);
}

// Strip display-label suffixes of the form " (anything)" to get the base type.
// e.g. "chart:scatter (bubble)" -> "chart:scatter", "table (retention)" -> "table"
const offenders = [];
for (const [, rawValue] of matches) {
  const baseType = rawValue.replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (!panelTypes.includes(baseType)) {
    offenders.push({ rawValue, baseType });
  }
}

if (offenders.length > 0) {
  console.error('ERROR: the following dvtType values in charts.ts are not in the vendored PanelType enum:');
  for (const { rawValue, baseType } of offenders) {
    console.error(
      `  raw: '${rawValue}'  ->  base: '${baseType}'  (missing from ${ENUM_FILE})`
    );
  }
  console.error('');
  console.error(
    'Fix hint: if the type was renamed/removed upstream, run scripts/sync-panel-types.sh to refresh src/data/panel-types.json; if it\'s a typo, fix charts.ts.'
  );
  process.exit(1);
}

console.log(
  `OK — all ${matches.length} chart/table types in charts.ts are valid PanelType members (${panelTypes.length} in vendored enum).`
);
