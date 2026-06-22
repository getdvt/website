#!/usr/bin/env bash
#
# Sync the vendored PanelType enum into src/data/panel-types.json.
#
# Canonical source of truth: getdvt/dvt → spec/schema/dashboard.schema.json
# ($defs.PanelType.enum). This repo's src/data/panel-types.json is a VENDORED
# MIRROR so CI can assert that every dvtType in src/data/charts.ts resolves to
# a real spec type, without a live network call to the private getdvt/dvt repo.
# Do NOT hand-edit the vendored copy — refresh it here and commit the result.
# CI (.github/workflows/chart-types-drift.yml) will catch a stale copy.
#
# Source-resolution precedence:
#   1. DVT_REPO=/path/to/dvt (env set)  — explicit local checkout; freshness-checked.
#   2. `gh` on PATH + authed            — reads origin/main live via gh api (DEFAULT).
#   3. ../dvt sibling checkout          — freshness-checked; hard-error if not found.
#
# Freshness check (applies to every local checkout):
#   git fetch -q origin, then checks commits behind origin/main. Hard-errors if
#   the checkout is stale — never vendor from an out-of-date local copy.
#   Unset DVT_REPO (or install/auth `gh`) to skip local checkouts entirely.
#
# Usage (from the website repo root):
#   ./scripts/sync-panel-types.sh                         # uses gh api (default)
#   DVT_REPO=/path/to/dvt ./scripts/sync-panel-types.sh  # explicit local checkout
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DST="$REPO_ROOT/src/data/panel-types.json"

# Temp file for the gh-api path; cleaned up on exit.
TMP_SCHEMA=""
cleanup() {
  if [[ -n "$TMP_SCHEMA" && -f "$TMP_SCHEMA" ]]; then
    rm -f "$TMP_SCHEMA"
  fi
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# freshness_check <dir>: ensure the local checkout is NOT behind origin/main.
# Exits 1 with an actionable message if it is.
# ---------------------------------------------------------------------------
freshness_check() {
  local dir="$1"
  echo "Fetching origin in $dir ..." >&2
  git -C "$dir" fetch -q origin
  local behind
  behind=$(git -C "$dir" rev-list --count HEAD..origin/main)
  if [[ "$behind" != "0" ]]; then
    echo "error: $dir is $behind commit(s) behind origin/main." >&2
    echo "       Vendoring from a stale checkout would produce a stale enum." >&2
    echo "       Fix: git -C \"$dir\" pull" >&2
    echo "       Or unset DVT_REPO to use the gh api path (requires gh + auth)." >&2
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Determine schema acquisition path.
# ---------------------------------------------------------------------------

if [[ -n "${DVT_REPO:-}" ]]; then
  # --- Path 1: explicit DVT_REPO override ---
  echo "Using explicit DVT_REPO: $DVT_REPO" >&2
  SRC="$DVT_REPO/spec/schema/dashboard.schema.json"
  if [[ ! -f "$SRC" ]]; then
    echo "error: canonical source not found at: $SRC" >&2
    echo "       Check that DVT_REPO points to a valid getdvt/dvt checkout." >&2
    exit 1
  fi
  freshness_check "$DVT_REPO"
  SCHEMA_FILE="$SRC"
  SCHEMA_SOURCE="$SRC"

elif command -v gh &>/dev/null && gh auth status &>/dev/null; then
  # --- Path 2: gh api (default, always fresh) ---
  echo "Using gh api (origin/main) ..." >&2
  TMP_SCHEMA="$(mktemp)"
  if ! gh api repos/getdvt/dvt/contents/spec/schema/dashboard.schema.json \
       -H "Accept: application/vnd.github.raw" > "$TMP_SCHEMA"; then
    echo "error: gh api fetch failed." >&2
    exit 1
  fi
  # Guard: must be valid JSON with a non-empty $defs.PanelType.enum.
  GUARD_OK="$(TMP_SCHEMA="$TMP_SCHEMA" node -e '
const fs = require("fs");
try {
  const schema = JSON.parse(fs.readFileSync(process.env.TMP_SCHEMA, "utf8"));
  const arr = (schema["$defs"] || {})["PanelType"] && schema["$defs"]["PanelType"]["enum"];
  if (!Array.isArray(arr) || arr.length === 0) { process.exit(1); }
  process.stdout.write("ok");
} catch(e) { process.exit(1); }
' 2>/dev/null || true)"
  if [[ "$GUARD_OK" != "ok" ]]; then
    echo "error: gh api returned invalid JSON or missing \$defs.PanelType.enum." >&2
    echo "       Cannot safely update the vendored file." >&2
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
  SRC="$SIBLING/spec/schema/dashboard.schema.json"
  if [[ ! -f "$SRC" ]]; then
    echo "error: canonical source not found at: $SRC" >&2
    echo "       Check out getdvt/dvt as a sibling of this repo, or set DVT_REPO=/path/to/dvt." >&2
    exit 1
  fi
  freshness_check "$SIBLING"
  SCHEMA_FILE="$SRC"
  SCHEMA_SOURCE="$SRC"
fi

# ---------------------------------------------------------------------------
# Extract PanelType enum and write the vendored file.
# Paths are passed via env (not string-interpolated into the JS) so a path with
# a quote/space/newline can't break out of the eval. $defs needs no escaping here.
# ---------------------------------------------------------------------------
SCHEMA_FILE="$SCHEMA_FILE" DST="$DST" node -e '
const fs = require("fs");
const schema = JSON.parse(fs.readFileSync(process.env.SCHEMA_FILE, "utf8"));
const panelTypes = schema["$defs"]["PanelType"]["enum"];
const out = {
  "$comment": "VENDORED mirror of dvt'"'"'s canonical PanelType enum. Do NOT hand-edit. Refresh with: scripts/sync-panel-types.sh — gh api (origin/main) is the default refresh path; DVT_REPO or a freshness-checked sibling are fallbacks. Drift from charts.ts is caught by scripts/check-chart-types.mjs in CI (see .github/workflows/chart-types-drift.yml).",
  source: "getdvt/dvt -> spec/schema/dashboard.schema.json -> $defs/PanelType.enum",
  panelTypes,
};
fs.writeFileSync(process.env.DST, JSON.stringify(out, null, 2) + "\n");
'

echo "synced: $SCHEMA_SOURCE"
echo "    ->: $DST"
