#!/usr/bin/env node
//
// Canonicalize dvt's dashboard.schema.json for vendoring into THIS PUBLIC REPO.
//
// Why this exists: `getdvt/website` is public, `getdvt/dvt` is private. The
// canonical schema's `description` / `$comment` prose is engineering commentary,
// not user documentation — it names internal source paths, ADR/ticket history, and
// version-scoped security notes ("this sink was OPEN before DVT-<n>"). Vendoring it
// verbatim would publish all of that, irreversibly, to anyone reading this repo.
// So the vendored copy carries STRUCTURE ONLY.
//
// Reads a schema file, writes the normalized form to stdout. Used in two places
// that MUST agree, which is exactly why it is one script rather than two copies:
//   1. scripts/sync-panel-types.sh  — normalizes before writing the vendored copy.
//   2. .github/workflows/chart-types-drift.yml — normalizes the live upstream fetch
//      before byte-comparing it against the vendored copy.
// If these two normalizations ever diverged, the weekly drift check would report
// permanent false drift. Sharing this file makes that divergence impossible.
//
// Validation impact: NONE. `description` and `$comment` are annotation keywords —
// ajv ignores both. The vendored copy validates exactly what the canonical one does.
// What the drift check loses is sensitivity to prose-only upstream edits, which by
// the same argument cannot affect any gate.
//
// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL: `description` is BOTH an annotation keyword AND, in this schema, a
// real property NAME in 7 places (`$defs/Meta/properties/description`, and the
// same under PageDoc, MetricItem, TableColumn, StatSpec, KpiSpec, plus a
// top-level `properties/$comment`). A naive recursive delete would strip those
// 7 property DEFINITIONS, silently changing what the schema accepts — the
// snippet gate would then pass specs the real engine rejects. So the walk is
// schema-aware: inside a keyword whose children are keyed by property NAME, the
// keys are data and are never stripped.
// ─────────────────────────────────────────────────────────────────────────────
//
// Zero dependencies: pure Node built-ins, so it runs in CI before `npm ci`.

import { readFileSync } from 'fs';

// Keywords whose immediate children are keyed by NAME, not by keyword. Their keys
// are user data; only their VALUES are schemas.
const NAME_KEYED = new Set([
  'properties',
  'patternProperties',
  '$defs',
  'definitions',
  'dependentSchemas',
]);

// Keywords whose values are literal DATA, not schemas. Never descend — an object
// inside `enum`/`const`/`default`/`examples` may legitimately carry a key called
// "description" that is part of the value, not an annotation.
const OPAQUE = new Set(['enum', 'const', 'default', 'examples']);

const STRIP = new Set(['description', '$comment']);

function normalize(node, keysAreNames) {
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map((v) => normalize(v, false));

  const out = {};
  for (const [key, value] of Object.entries(node)) {
    if (keysAreNames) {
      // `key` is a property name chosen by the schema author — keep it verbatim,
      // and descend into its value as a schema.
      out[key] = normalize(value, false);
      continue;
    }
    if (STRIP.has(key)) continue; // annotation position — this is the strip
    if (OPAQUE.has(key)) {
      out[key] = value; // literal data, copied untouched
      continue;
    }
    out[key] = normalize(value, NAME_KEYED.has(key));
  }
  return out;
}

const src = process.argv[2];
if (!src) {
  console.error('usage: node scripts/normalize-schema.mjs <schema.json>');
  process.exit(1);
}

let parsed;
try {
  parsed = JSON.parse(readFileSync(src, 'utf8'));
} catch (e) {
  console.error(`ERROR: could not parse ${src} as JSON: ${e.message}`);
  process.exit(1);
}

// Stable 2-space formatting with a trailing newline. Key ORDER is preserved from
// the source (JSON.stringify follows insertion order), so the output is a
// deterministic function of the input — which is what makes the byte-compare valid.
process.stdout.write(JSON.stringify(normalize(parsed, false), null, 2) + '\n');
