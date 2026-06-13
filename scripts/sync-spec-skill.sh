#!/usr/bin/env bash
#
# Sync the vendored dvt spec-authoring skill into website/public.
#
# Canonical source of truth: getdvt/dvt → web/public/dvt-spec-authoring-skill.md
# This repo's public/dvt-spec-authoring-skill.md is a VENDORED MIRROR so /spec can
# offer it as a download. Do NOT hand-edit the website copy — edit it in the dvt
# repo, then run this script. CI (.github/workflows/spec-skill-drift.yml) fails the
# build if the two copies drift apart.
#
# Usage (from the website repo root, with the dvt repo checked out as a sibling):
#   ./scripts/sync-spec-skill.sh
#   DVT_REPO=/path/to/dvt ./scripts/sync-spec-skill.sh   # explicit source location
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${DVT_REPO:-$REPO_ROOT/../dvt}/web/public/dvt-spec-authoring-skill.md"
DST="$REPO_ROOT/public/dvt-spec-authoring-skill.md"

if [[ ! -f "$SRC" ]]; then
  echo "error: canonical source not found at:" >&2
  echo "         $SRC" >&2
  echo "       Check out getdvt/dvt as a sibling of this repo, or set DVT_REPO=/path/to/dvt." >&2
  exit 1
fi

cp "$SRC" "$DST"
echo "synced: $SRC"
echo "    ->: $DST"
