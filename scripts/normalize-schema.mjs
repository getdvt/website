#!/usr/bin/env node
//
// Canonicalize dvt's dashboard.schema.json for vendoring into THIS PUBLIC REPO.
//
// Why this exists: `getdvt/website` is public, `getdvt/dvt` is private. The
// canonical schema's `description` / `$comment` / `title` / `examples` annotations
// are engineering commentary, not user documentation — they name internal source
// paths, ADR/ticket history, and version-scoped security notes ("this sink was
// OPEN before DVT-<n>"). Vendoring them verbatim would publish all of that,
// irreversibly, to anyone reading this repo. So the vendored copy carries
// STRUCTURE ONLY.
//
// Reads a schema file, writes the normalized form to stdout. Used in two places
// that MUST agree, which is exactly why it is one script rather than two copies:
//   1. scripts/sync-panel-types.sh  — normalizes before writing the vendored copy.
//   2. .github/workflows/chart-types-drift.yml — normalizes the live upstream fetch
//      before byte-comparing it against the vendored copy.
// If these two normalizations ever diverged, the weekly drift check would report
// permanent false drift. Sharing this file makes that divergence impossible.
//
// Validation impact: NONE. `description`, `$comment`, `title`, and `examples` are
// all annotation keywords — ajv ignores all four. The vendored copy validates
// exactly what the canonical one does. What the drift check loses is sensitivity
// to prose-only upstream edits, which by the same argument cannot affect any gate.
//
// ─────────────────────────────────────────────────────────────────────────────
// CRITICAL: `description` and `title` are BOTH annotation keywords AND, in this
// schema, real property NAMEs. `description` is a property name in 7 places
// (`$defs/Meta/properties/description`, and the same under PageDoc, MetricItem,
// TableColumn, StatSpec, KpiSpec, plus a top-level `properties/$comment`).
// `title` is a property name in 5 places (`$defs/Meta/properties/title`, and
// the same under Section, FilterBarSpec, Panel, Page — VERIFIED 2026-08-20 on
// the vendored file; the DVT-3231 ticket comment claiming "title is NOT a
// property name anywhere" is REFUTED, do not copy that claim into this comment
// or any other). A naive recursive delete would strip those 12 property
// DEFINITIONS, silently changing what the schema accepts — the snippet gate
// would then pass specs the real engine rejects. So the walk is schema-aware:
// inside a keyword whose children are keyed by property NAME, the keys are
// data and are never stripped.
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
// inside `enum`/`const`/`default` may legitimately carry a key called
// "description" (or "title") that is part of the value, not an annotation.
// `examples` is NOT opaque here: it is itself a STRIP key (see below), so it is
// dropped outright before OPAQUE is ever consulted — see the `STRIP.has(key)`
// check in `normalize()`, which runs before the `OPAQUE.has(key)` check.
const OPAQUE = new Set(['enum', 'const', 'default']);

const STRIP = new Set(['description', '$comment', 'title', 'examples']);

// Paths (from the document root, e.g. `$defs/Foo/enum[2]/description`) where a
// STRIP key was found INSIDE an opaque (data-position) value. OPAQUE values are
// never descended by `normalize()` below — correct, since an object nested in
// `enum`/`const`/`default` may legitimately carry a key named "description" (or
// "title"/"examples") as DATA. But if upstream ever nests real annotation prose
// there instead, this walk would copy it verbatim to a public repo, and the
// fixed-point gate can't catch it (normalization is idempotent on opaque values —
// there is nothing for a byte-compare to see). So opaque values are deep-scanned
// separately, purely to detect and refuse this, never to strip anything from them.
const opaqueViolations = [];

function scanOpaqueForStripKeys(value, path) {
  if (value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => scanOpaqueForStripKeys(v, `${path}[${i}]`));
    return;
  }
  for (const [key, v] of Object.entries(value)) {
    const childPath = `${path}/${key}`;
    if (STRIP.has(key)) opaqueViolations.push(childPath);
    scanOpaqueForStripKeys(v, childPath);
  }
}

function normalize(node, keysAreNames, path) {
  if (node === null || typeof node !== 'object') return node;
  if (Array.isArray(node)) return node.map((v, i) => normalize(v, false, `${path}[${i}]`));

  const out = {};
  for (const [key, value] of Object.entries(node)) {
    const childPath = path ? `${path}/${key}` : key;
    if (keysAreNames) {
      // `key` is a property name chosen by the schema author — keep it verbatim,
      // and descend into its value as a schema.
      out[key] = normalize(value, false, childPath);
      continue;
    }
    if (!KNOWN_KEYWORDS.has(key)) unknownKeywords.add(key);
    if (STRIP.has(key)) continue; // annotation position — this is the strip
    if (OPAQUE.has(key)) {
      out[key] = value; // literal data, copied untouched
      scanOpaqueForStripKeys(value, childPath);
      continue;
    }
    out[key] = normalize(value, NAME_KEYED.has(key), childPath);
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

const normalized = normalize(parsed, false, '');

// Fail-closed: either check below must produce ZERO bytes of stdout, so both
// run and both report BEFORE anything is written.
let hasError = false;

if (unknownKeywords.size > 0) {
  console.error(
    `ERROR: ${src} uses keyword(s) this normalizer has not been audited against: ` +
      `${[...unknownKeywords].sort().join(', ')}.\n` +
      'Refusing to normalize. A keyword whose children are keyed by PROPERTY NAME (like\n' +
      '`properties` or `dependentRequired`) must be added to NAME_KEYED, one whose value is\n' +
      'literal DATA must be added to OPAQUE, and one that is itself annotation prose to be\n' +
      `removed from the public mirror must be added to STRIP (currently: ${[...STRIP].sort().join('/')}) ` +
      '— otherwise the walk will either strip real schema or keep prose it was meant to remove, ' +
      'and the weekly sweep cannot detect either because it normalizes both sides. Audit the ' +
      'keyword, then add it to KNOWN_KEYWORDS.'
  );
  hasError = true;
}

if (opaqueViolations.length > 0) {
  console.error(
    `ERROR: ${src} has STRIP key(s) (${[...STRIP].sort().join('/')}) nested INSIDE an opaque ` +
      `(${[...OPAQUE].sort().join('/')}) value, at:\n` +
      opaqueViolations.map((p) => `  ${p}`).join('\n') +
      '\n\n' +
      'Opaque values are copied verbatim, on the assumption their contents are literal DATA — ' +
      `a ${[...STRIP].sort().join('/')} key found there would be published to this PUBLIC repo ` +
      'unstripped, and the PR-time fixed-point gate cannot detect it (normalization is idempotent ' +
      'on opaque values, so there is nothing for the byte-compare to see). Refusing to normalize.\n' +
      `A human must decide: if this is genuinely data (a real property named "${[...STRIP].sort().join('"/"')}" ` +
      `inside an ${[...OPAQUE].sort().join('/')} member), audit it and adjust this script deliberately ` +
      'to allow it; if it is annotation prose, it must not ship here — fix it upstream instead.'
  );
  hasError = true;
}

if (hasError) process.exit(1);

// Stable 2-space formatting with a trailing newline. Key ORDER is preserved from
// the source (JSON.stringify follows insertion order), so the output is a
// deterministic function of the input — which is what makes the compare valid.
process.stdout.write(JSON.stringify(normalized, null, 2) + '\n');
