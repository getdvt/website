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
  // Both of these are keyed by PROPERTY NAME too, and this schema has 6 properties
  // literally called `description`. Omitting them was a live divergence: given
  // `dependentRequired: { description: ["lang"] }`, a naive walk emits
  // `dependentRequired: {}` — so `{"description":"hello"}` is REJECTED by upstream
  // and ACCEPTED by the normalized copy. Neither keyword appears upstream today,
  // so adding them does not change the vendored artifact; it closes a latent hole.
  'dependencies', // draft-07 legacy; schema-valued form normalizes, array-of-names form is data
  'dependentRequired',
]);

// Every key this walk expects to meet in KEYWORD position. The walk's correctness
// is a claim about a specific keyword vocabulary, so a keyword it has never been
// audited against must fail loudly rather than be guessed at.
//
// This matters more than it looks: the weekly sweep normalizes BOTH sides, so a
// normalizer bug produces ZERO drift signal (DVT-3124). It would surface only as
// the snippet gate accepting specs the real engine rejects — exactly the failure
// this file's schema-aware walk exists to prevent. Today's upstream uses 33
// keyword-position keys, all standard, so this is satisfied on day one and fires
// the first time upstream adopts a construct nobody has checked this walk against.
const KNOWN_KEYWORDS = new Set([
  // core / identifiers
  '$schema', '$id', '$ref', '$defs', '$comment', '$anchor', '$dynamicRef', '$dynamicAnchor',
  'definitions', 'id',
  // annotations
  'title', 'description', 'default', 'examples', 'deprecated', 'readOnly', 'writeOnly',
  // applicators
  'allOf', 'anyOf', 'oneOf', 'not', 'if', 'then', 'else',
  'items', 'prefixItems', 'additionalItems', 'contains',
  'properties', 'patternProperties', 'additionalProperties', 'unevaluatedProperties',
  'unevaluatedItems', 'propertyNames', 'dependentSchemas', 'dependencies',
  // validation
  'type', 'enum', 'const', 'required', 'dependentRequired',
  'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
  'minLength', 'maxLength', 'pattern', 'format',
  'minItems', 'maxItems', 'uniqueItems', 'minContains', 'maxContains',
  'minProperties', 'maxProperties',
  'contentEncoding', 'contentMediaType', 'contentSchema',
]);
const unknownKeywords = new Set();

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
    if (!KNOWN_KEYWORDS.has(key)) unknownKeywords.add(key);
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

const normalized = normalize(parsed, false);

if (unknownKeywords.size > 0) {
  console.error(
    `ERROR: ${src} uses keyword(s) this normalizer has not been audited against: ` +
      `${[...unknownKeywords].sort().join(', ')}.\n` +
      'Refusing to normalize. A keyword whose children are keyed by PROPERTY NAME (like\n' +
      '`properties` or `dependentRequired`) must be added to NAME_KEYED, and one whose value is\n' +
      'literal DATA must be added to OPAQUE — otherwise the walk will either strip real schema\n' +
      'or keep prose it was meant to remove, and the weekly sweep cannot detect either because\n' +
      'it normalizes both sides. Audit the keyword, then add it to KNOWN_KEYWORDS.'
  );
  process.exit(1);
}

// Stable 2-space formatting with a trailing newline. Key ORDER is preserved from
// the source (JSON.stringify follows insertion order), so the output is a
// deterministic function of the input — which is what makes the compare valid.
process.stdout.write(JSON.stringify(normalized, null, 2) + '\n');
