#!/usr/bin/env bash
#
# Sync the vendored PanelType enum into src/data/panel-types.json, AND vendor
# the schema (NORMALIZED - structure only, annotation prose stripped, since this
# repo is public) into src/data/dashboard.schema.json (read by
# scripts/check-chart-specs.mjs). Both writes come from the same fetch and are
# staged, then published together, so the two vendored artifacts cannot drift
# from each other UNDETECTED — the publish is two `mv`s, so an interrupt between
# them can still split the pair. What actually guarantees agreement is the
# set-compare gate in scripts/check-chart-types.mjs, which fails CI on a split.
#
# Canonical source of truth: getdvt/dvt → spec/schema/dashboard.schema.json
# ($defs.PanelType.enum). This repo's src/data/panel-types.json is a VENDORED
# MIRROR so CI can assert that every dvtType in src/data/charts.ts resolves to
# a real spec type, without a live network call to the private getdvt/dvt repo.
# Do NOT hand-edit the vendored copy — refresh it here and commit the result.
# CI (.github/workflows/chart-types-drift.yml) will catch a stale copy.
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
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DST="$REPO_ROOT/src/data/panel-types.json"
SCHEMA_DST="$REPO_ROOT/src/data/dashboard.schema.json"

# Temp file for the gh-api path, plus the staging files for the two atomic
# writes below; all cleaned up on exit.
TMP_SCHEMA=""
cleanup() {
  if [[ -n "$TMP_SCHEMA" && -f "$TMP_SCHEMA" ]]; then
    rm -f "$TMP_SCHEMA"
  fi
  rm -f "$SCHEMA_DST.tmp" "$DST.tmp"
}
trap cleanup EXIT

# (There is no freshness_check any more. It existed to prove a local checkout was
# not BEHIND origin/main before vendoring from its working tree — but paths 1 and 3
# now fetch and read `origin/main:` directly, and a post-fetch ref read cannot be
# stale, nor can it pick up a feature branch or an uncommitted edit. Reading the
# ref subsumes the check entirely rather than complementing it.)

# ---------------------------------------------------------------------------
# Determine schema acquisition path.
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
  TMP_SCHEMA="$(mktemp)"
  if ! gh api repos/getdvt/dvt/contents/spec/schema/dashboard.schema.json \
       -H "Accept: application/vnd.github.raw" > "$TMP_SCHEMA"; then
    echo "error: gh api fetch failed." >&2
    exit 1
  fi
  SCHEMA_FILE="$TMP_SCHEMA"
  SCHEMA_SOURCE="gh api repos/getdvt/dvt/contents/spec/schema/dashboard.schema.json (origin/main)"

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
  echo "       Cannot safely update the vendored files; both are left untouched." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Extract PanelType enum, staging to $DST.tmp.
# Paths are passed via env (not string-interpolated into the JS) so a path with
# a quote/space/newline can't break out of the eval. $defs needs no escaping here.
#
# Both vendored artifacts are STAGED first and moved into place only once both
# have been produced successfully. Writing the schema before extracting the enum
# meant a failed extraction left a clobbered schema next to a stale enum — the
# exact drift the header promises is impossible. `mv` within one filesystem is
# atomic, so an interrupt can no longer leave a truncated ~97KB JSON in the tree.
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

# Stage the NORMALIZED schema copy — structure only, with `description`/`$comment`
# annotation prose stripped. This repo is PUBLIC and the canonical schema's prose is
# internal engineering commentary (source paths, ADR/ticket history, version-scoped
# security notes), so it must not be published here. See scripts/normalize-schema.mjs
# for why the strip is schema-aware rather than a recursive delete.
#
# The same normalizer runs on the live upstream fetch in the weekly drift check, so
# the byte-compare stays valid; it just compares normalized forms on both sides.
# Same $SCHEMA_FILE the extraction above read, so the two vendored artifacts are
# still produced from one source and cannot disagree.
node "$REPO_ROOT/scripts/normalize-schema.mjs" "$SCHEMA_FILE" > "$SCHEMA_DST.tmp"

# Both artifacts produced — publish them. Each `mv` is atomic, but the PAIR is not:
# an interrupt between the two leaves one published and the other stale. The order
# does not change which side is left stale in any useful way, so it carries no
# safety argument — what makes the split safe is that `check-chart-types.mjs`
# set-compares the two and fails CI whenever they disagree, and re-running this
# script repairs either direction.
mv -f "$DST.tmp" "$DST"
mv -f "$SCHEMA_DST.tmp" "$SCHEMA_DST"

echo "synced: $SCHEMA_SOURCE"
echo "    ->: $DST"
echo "    ->: $SCHEMA_DST"
