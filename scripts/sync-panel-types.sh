#!/usr/bin/env bash
#
# Sync the vendored PanelType enum into src/data/panel-types.json, vendor the
# schema (NORMALIZED - structure only, annotation prose stripped, since this
# repo is public) into src/data/dashboard.schema.json (read by
# scripts/check-chart-specs.mjs), and maintain the provenance this creates in
# TWO more places so a refresh here can't silently go stale elsewhere:
#   - src/data/README.md    — the provenance block between the
#                              `<!-- provenance:begin -->` / `-end -->` markers.
#   - scripts/check-chart-types.mjs — the EXPECTED_SHA256 constant.
# All four writes come from the same fetch and are staged, then published
# together — the publish is FOUR `mv`s, so an interrupt between them can still
# split the set. What actually surfaces a split among the four is
# scripts/check-chart-types.mjs, which goes red whenever the drift workflow (or
# a local `npm run check:chart-types`) runs — advisory, not a required check:
# the enum set-compare surfaces a schema/panel-types.json split, the sha256
# consistency check surfaces a schema/EXPECTED_SHA256 split, and the
# README-staleness check surfaces a schema/README split.
#
# Canonical source of truth: getdvt/dvt → spec/schema/dashboard.schema.json
# ($defs.PanelType.enum). This repo's src/data/panel-types.json is a VENDORED
# MIRROR so CI can assert that every dvtType in src/data/charts.ts resolves to
# a real spec type, without a live network call to the private getdvt/dvt repo.
# Do NOT hand-edit any of the four vendored/maintained files — refresh them
# here and commit the result. CI (.github/workflows/chart-types-drift.yml)
# will catch a stale or split copy.
#
# Source-resolution precedence:
#   1. DVT_REPO=/path/to/dvt (env set)  — explicit local checkout; reads origin/main.
#   2. `gh` on PATH + authed            — reads origin/main live via gh api (DEFAULT).
#   3. ../dvt sibling checkout          — reads origin/main; hard-error if not found.
#
# Staleness (applies to every local checkout):
#   Paths 1 and 3 `git fetch -q origin` and then read `origin/main:<path>` — the
#   REF, never the working tree. So a checkout parked on a feature branch, or
#   holding uncommitted schema edits, cannot be vendored, and there is no
#   behind-count to check: a post-fetch ref read cannot be stale.
#   Unset DVT_REPO (or install/auth `gh`) to skip local checkouts entirely.
#
# Usage (from the website repo root):
#   ./scripts/sync-panel-types.sh                         # uses gh api (default)
#   DVT_REPO=/path/to/dvt ./scripts/sync-panel-types.sh  # explicit local checkout
#
# macOS note: this must run under bash 3.2 (no assoc arrays), and file rewrites
# use `node`, never `sed -i` (BSD/GNU flag semantics diverge).
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DST="$REPO_ROOT/src/data/panel-types.json"
SCHEMA_DST="$REPO_ROOT/src/data/dashboard.schema.json"
README_FILE="$REPO_ROOT/src/data/README.md"
CCT_FILE="$REPO_ROOT/scripts/check-chart-types.mjs"

# Temp file for the gh-api path, plus the staging files for the four atomic
# writes below; all cleaned up on exit.
TMP_SCHEMA=""
cleanup() {
  if [[ -n "$TMP_SCHEMA" && -f "$TMP_SCHEMA" ]]; then
    rm -f "$TMP_SCHEMA"
  fi
  rm -f "$SCHEMA_DST.tmp" "$DST.tmp" "$README_FILE.tmp" "$CCT_FILE.tmp"
}
trap cleanup EXIT

# (There is no freshness_check any more. It existed to prove a local checkout was
# not BEHIND origin/main before vendoring from its working tree — but paths 1 and 3
# now fetch and read `origin/main:` directly, and a post-fetch ref read cannot be
# stale, nor can it pick up a feature branch or an uncommitted edit. Reading the
# ref subsumes the check entirely rather than complementing it.)

# ---------------------------------------------------------------------------
# Determine schema acquisition path. Each path also resolves UPSTREAM_COMMIT —
# the last commit that actually TOUCHED the schema, not the branch tip. That's
# what makes it a stable, reproducible `?ref=` pin: re-running this script
# against an unrelated upstream commit (one that doesn't touch the schema
# path) reproduces the same UPSTREAM_COMMIT, rather than needlessly moving the
# provenance pin.
# ---------------------------------------------------------------------------

if [[ -n "${DVT_REPO:-}" ]]; then
  # --- Path 1: explicit DVT_REPO override ---
  echo "Using explicit DVT_REPO: $DVT_REPO" >&2
  if ! git -C "$DVT_REPO" rev-parse --git-dir &>/dev/null; then
    echo "error: DVT_REPO is not a git checkout: $DVT_REPO" >&2
    echo "       Check that DVT_REPO points to a valid getdvt/dvt checkout." >&2
    exit 1
  fi
  # Read the REF, not the working tree. A checkout parked on a feature branch that
  # modifies the schema — or one with uncommitted edits — would otherwise be
  # vendored verbatim, and since the vendored copy is now byte-compared weekly,
  # that surfaces days later as a phantom "upstream drift" pointing at getdvt/dvt
  # instead of at the local tree. This is the workspace's "read the ref, not the
  # working tree" rule (OS-90). A post-fetch ref read also cannot be stale, which
  # is why no separate freshness check is needed on this path.
  echo "Fetching origin in $DVT_REPO ..." >&2
  git -C "$DVT_REPO" fetch -q origin
  UPSTREAM_COMMIT="$(git -C "$DVT_REPO" log -1 --format=%H origin/main -- spec/schema/dashboard.schema.json)"
  if [[ -z "$UPSTREAM_COMMIT" ]]; then
    echo "error: no commit touching spec/schema/dashboard.schema.json found on origin/main in $DVT_REPO." >&2
    exit 1
  fi
  TMP_SCHEMA="$(mktemp)"
  if ! git -C "$DVT_REPO" show origin/main:spec/schema/dashboard.schema.json > "$TMP_SCHEMA"; then
    echo "error: could not read spec/schema/dashboard.schema.json from origin/main in $DVT_REPO." >&2
    exit 1
  fi
  SCHEMA_FILE="$TMP_SCHEMA"
  SCHEMA_SOURCE="$DVT_REPO -> origin/main:spec/schema/dashboard.schema.json"

elif command -v gh &>/dev/null && gh auth status &>/dev/null; then
  # --- Path 2: gh api (default, always fresh) ---
  echo "Using gh api (origin/main) ..." >&2
  # Resolve the last commit that touched the schema path FIRST, then fetch the
  # contents pinned to that exact commit via `?ref=`. This also removes the
  # fetch/sha race the two-step (fetch-then-guess-the-commit) version had.
  UPSTREAM_COMMIT="$(gh api "repos/getdvt/dvt/commits?path=spec/schema/dashboard.schema.json&sha=main&per_page=1" --jq '.[0].sha // empty')"
  if [[ -z "$UPSTREAM_COMMIT" ]]; then
    echo "error: gh api could not resolve the last commit touching spec/schema/dashboard.schema.json on main." >&2
    exit 1
  fi
  TMP_SCHEMA="$(mktemp)"
  if ! gh api "repos/getdvt/dvt/contents/spec/schema/dashboard.schema.json?ref=$UPSTREAM_COMMIT" \
       -H "Accept: application/vnd.github.raw" > "$TMP_SCHEMA"; then
    echo "error: gh api fetch failed." >&2
    exit 1
  fi
  SCHEMA_FILE="$TMP_SCHEMA"
  SCHEMA_SOURCE="gh api repos/getdvt/dvt/contents/spec/schema/dashboard.schema.json (origin/main @ $UPSTREAM_COMMIT)"

else
  # --- Path 3: sibling checkout fallback ---
  SIBLING="$REPO_ROOT/../dvt"
  if [[ ! -d "$SIBLING" ]]; then
    echo "error: no gh tool/auth available and no sibling dvt checkout found at:" >&2
    echo "         $SIBLING" >&2
    echo "" >&2
    echo "       To fix, choose one of:" >&2
    echo "         a) Install gh (https://cli.github.com/) and run: gh auth login" >&2
    echo "         b) Set DVT_REPO=/path/to/dvt" >&2
    echo "         c) Check out getdvt/dvt at $SIBLING" >&2
    exit 1
  fi
  # Read the REF, not the working tree — same rationale as path 1 above (OS-90).
  echo "Fetching origin in $SIBLING ..." >&2
  git -C "$SIBLING" fetch -q origin
  UPSTREAM_COMMIT="$(git -C "$SIBLING" log -1 --format=%H origin/main -- spec/schema/dashboard.schema.json)"
  if [[ -z "$UPSTREAM_COMMIT" ]]; then
    echo "error: no commit touching spec/schema/dashboard.schema.json found on origin/main in $SIBLING." >&2
    exit 1
  fi
  TMP_SCHEMA="$(mktemp)"
  if ! git -C "$SIBLING" show origin/main:spec/schema/dashboard.schema.json > "$TMP_SCHEMA"; then
    echo "error: could not read spec/schema/dashboard.schema.json from origin/main in $SIBLING." >&2
    echo "       Check out getdvt/dvt as a sibling of this repo, or set DVT_REPO=/path/to/dvt." >&2
    exit 1
  fi
  SCHEMA_FILE="$TMP_SCHEMA"
  SCHEMA_SOURCE="$SIBLING -> origin/main:spec/schema/dashboard.schema.json"
fi

# ---------------------------------------------------------------------------
# Shape guard — runs on EVERY acquisition path, against whichever $SCHEMA_FILE
# was resolved above. It must be valid JSON with a non-empty $defs.PanelType.enum
# and a $defs.Panel def (the shape scripts/check-chart-specs.mjs validates
# against). If either is missing, an upstream shape change would silently disarm
# the guards that depend on it, so fail loudly here instead.
#
# This deliberately sits AFTER the path selection, not inside the gh-api branch:
# a local checkout (paths 1 and 3) can hold a malformed or reshaped schema just
# as easily as a bad fetch can, and validating only one of the three paths left
# the other two able to clobber the vendored copy with an unusable file.
# ---------------------------------------------------------------------------
GUARD_OK="$(SCHEMA_FILE="$SCHEMA_FILE" node -e '
const fs = require("fs");
try {
  const schema = JSON.parse(fs.readFileSync(process.env.SCHEMA_FILE, "utf8"));
  const arr = (schema["$defs"] || {})["PanelType"] && schema["$defs"]["PanelType"]["enum"];
  if (!Array.isArray(arr) || arr.length === 0) { process.exit(1); }
  if (!(schema["$defs"] || {})["Panel"]) { process.exit(1); }
  process.stdout.write("ok");
} catch(e) { process.exit(1); }
' 2>/dev/null || true)"
if [[ "$GUARD_OK" != "ok" ]]; then
  echo "error: $SCHEMA_SOURCE is not valid JSON, or is missing \$defs.PanelType.enum / \$defs.Panel." >&2
  echo "       Cannot safely update the vendored files; none are touched." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Extract PanelType enum, staging to $DST.tmp.
# Paths are passed via env (not string-interpolated into the JS) so a path with
# a quote/space/newline can't break out of the eval. $defs needs no escaping here.
#
# All four artifacts are STAGED first and moved into place only once every one
# of them has been produced successfully. Writing the schema before extracting
# the enum meant a failed extraction left a clobbered schema next to a stale
# enum — the exact drift the header promises is impossible. `mv` within one
# filesystem is atomic, so an interrupt can no longer leave a truncated ~97KB
# JSON in the tree.
# ---------------------------------------------------------------------------
SCHEMA_FILE="$SCHEMA_FILE" DST="$DST.tmp" node -e '
const fs = require("fs");
const schema = JSON.parse(fs.readFileSync(process.env.SCHEMA_FILE, "utf8"));
const panelTypes = schema["$defs"]["PanelType"]["enum"];
const out = {
  "$comment": "VENDORED mirror of dvt'"'"'s canonical PanelType enum. Do NOT hand-edit. Refresh with: scripts/sync-panel-types.sh — gh api (origin/main) is the default refresh path; DVT_REPO or a sibling checkout are fallbacks, both read from origin/main. Drift from charts.ts is caught by scripts/check-chart-types.mjs in CI (see .github/workflows/chart-types-drift.yml).",
  source: "getdvt/dvt -> spec/schema/dashboard.schema.json -> $defs/PanelType.enum",
  panelTypes,
};
fs.writeFileSync(process.env.DST, JSON.stringify(out, null, 2) + "\n");
'

# Stage the NORMALIZED schema copy — structure only, with `description`/`$comment`/
# `title`/`examples` annotation prose stripped. This repo is PUBLIC and the canonical
# schema's prose is internal engineering commentary (source paths, ADR/ticket history,
# version-scoped security notes), so it must not be published here. See
# scripts/normalize-schema.mjs for why the strip is schema-aware rather than a
# recursive delete.
#
# The same normalizer runs on the live upstream fetch in the weekly drift check, so
# the byte-compare stays valid; it just compares normalized forms on both sides.
# Same $SCHEMA_FILE the extraction above read, so the vendored artifacts are still
# produced from one source and cannot disagree.
node "$REPO_ROOT/scripts/normalize-schema.mjs" "$SCHEMA_FILE" > "$SCHEMA_DST.tmp"

# ---------------------------------------------------------------------------
# Compute the provenance values every remaining artifact needs, all from what
# is already in hand — no extra fetch.
# ---------------------------------------------------------------------------
UPSTREAM_BLOB="$(git hash-object "$SCHEMA_FILE")"
UPSTREAM_SHA256="$(shasum -a 256 "$SCHEMA_FILE" | awk '{print $1}')"
VENDORED_SHA256="$(shasum -a 256 "$SCHEMA_DST.tmp" | awk '{print $1}')"
TODAY="$(date +%Y-%m-%d)"

# ---------------------------------------------------------------------------
# Stage src/data/README.md — regenerate ONLY the region between the
# `<!-- provenance:begin -->` / `<!-- provenance:end -->` markers (the Vendored
# date/commit/blob/upstream-sha256 bullet, the vendored-sha256 bullet, and the
# reproduce-command block). Everything outside the markers is hand-maintained
# prose and is left untouched. Hard-fail if the markers are missing or
# duplicated — silently no-op-ing would let the README go stale in a way
# nothing else catches until check-chart-types.mjs's staleness check fires.
# ---------------------------------------------------------------------------
README_FILE="$README_FILE" README_TMP="$README_FILE.tmp" \
UPSTREAM_COMMIT="$UPSTREAM_COMMIT" UPSTREAM_BLOB="$UPSTREAM_BLOB" \
UPSTREAM_SHA256="$UPSTREAM_SHA256" VENDORED_SHA256="$VENDORED_SHA256" TODAY="$TODAY" \
node -e '
const fs = require("fs");
const path = process.env.README_FILE;
const src = fs.readFileSync(path, "utf8");
const BEGIN = "<!-- provenance:begin — maintained by scripts/sync-panel-types.sh; do not hand-edit between markers -->";
const END = "<!-- provenance:end -->";
const beginIdx = src.indexOf(BEGIN);
const endIdx = src.indexOf(END);
if (beginIdx === -1 || endIdx === -1) {
  console.error("error: provenance markers not found in " + path + " — expected both:");
  console.error("  " + BEGIN);
  console.error("  " + END);
  process.exit(1);
}
if (src.indexOf(BEGIN, beginIdx + 1) !== -1 || src.indexOf(END, endIdx + 1) !== -1) {
  console.error("error: duplicate provenance markers in " + path);
  process.exit(1);
}
const commit = process.env.UPSTREAM_COMMIT;
const blob = process.env.UPSTREAM_BLOB;
const upstreamSha = process.env.UPSTREAM_SHA256;
const vendoredSha = process.env.VENDORED_SHA256;
const today = process.env.TODAY;
const block =
  BEGIN + "\n" +
  "- **Vendored**: " + today + ", from `getdvt/dvt` `origin/main` @ `" + commit + "`\n" +
  "  (blob sha `" + blob + "`, upstream sha256\n" +
  "  `" + upstreamSha + "`).\n" +
  "- **Vendored (normalized) sha256**: `" + vendoredSha + "`.\n" +
  "- **Reproduce it** — the vendored file is a deterministic function of the upstream one:\n" +
  "  ```\n" +
  "  # ?ref= pins the SAME commit this block records. Without it the fetch follows the\n" +
  "  # default branch, so the first upstream schema commit makes the sha mismatch and\n" +
  "  # read as a bug rather than as expected drift.\n" +
  "  gh api \"repos/getdvt/dvt/contents/spec/schema/dashboard.schema.json?ref=" + commit + "\" \\\n" +
  "    -H \"Accept: application/vnd.github.raw\" > /tmp/upstream.json\n" +
  "  node scripts/normalize-schema.mjs /tmp/upstream.json | shasum -a 256   # must match the sha256 above\n" +
  "  ```\n" +
  END;
const out = src.slice(0, beginIdx) + block + src.slice(endIdx + END.length);
fs.writeFileSync(process.env.README_TMP, out);
'

# ---------------------------------------------------------------------------
# Stage scripts/check-chart-types.mjs — rewrite ONLY the EXPECTED_SHA256
# constant line, by pattern. Hard-fail unless exactly one line matches: zero
# means the constant moved or was hand-edited into a different shape (this
# script would then silently fail to keep it in sync), and more than one means
# something is badly wrong with the file.
# ---------------------------------------------------------------------------
CCT_FILE="$CCT_FILE" CCT_TMP="$CCT_FILE.tmp" VENDORED_SHA256="$VENDORED_SHA256" node -e '
const fs = require("fs");
const Q = String.fromCharCode(39);
const path = process.env.CCT_FILE;
const src = fs.readFileSync(path, "utf8");
const re = new RegExp("^const EXPECTED_SHA256 = " + Q + "[0-9a-f]{64}" + Q + ";$", "m");
const matches = src.match(new RegExp(re.source, "gm"));
if (!matches || matches.length !== 1) {
  console.error("error: expected exactly one EXPECTED_SHA256 constant line in " + path + ", found " + (matches ? matches.length : 0));
  process.exit(1);
}
const replacement = "const EXPECTED_SHA256 = " + Q + process.env.VENDORED_SHA256 + Q + ";";
const out = src.replace(re, replacement);
fs.writeFileSync(process.env.CCT_TMP, out);
'

# All four artifacts produced — publish them. Each `mv` is atomic, but the SET
# is not: an interrupt between them can leave some published and some stale.
# The order does not change which side is left stale in any useful way, so it
# carries no safety argument — what makes the split visible is that
# check-chart-types.mjs surfaces any resulting split (advisory, not a required
# check: enum set-compare for a schema/panel-types.json split, sha256
# consistency check for a schema/EXPECTED_SHA256 split, README-staleness check
# for a schema/README split), and re-running this script repairs any direction.
mv -f "$DST.tmp" "$DST"
mv -f "$SCHEMA_DST.tmp" "$SCHEMA_DST"
mv -f "$README_FILE.tmp" "$README_FILE"
mv -f "$CCT_FILE.tmp" "$CCT_FILE"

echo "synced: $SCHEMA_SOURCE"
echo "    ->: $DST"
echo "    ->: $SCHEMA_DST"
echo "    ->: $README_FILE (provenance block)"
echo "    ->: $CCT_FILE (EXPECTED_SHA256)"
