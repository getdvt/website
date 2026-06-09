---
name: pr-review
description: Local adversarial pre-PR review — runs the repo's specialist reviewer + the cross-repo review-architect, synthesizes a GO / NO-GO verdict, and records a pass-marker so `gh pr create` is unblocked. Run this before opening any PR.
---

You are running dvt's **local adversarial review** before a PR is opened. This is the team's
default pre-submission gate (the dvt-org plugin enforces it with a PreToolUse hook on `gh pr create`).
Your job: review the change hard, surface CRITICAL/HIGH issues and cross-repo breakage *before* it
ships, and only record a pass when it's genuinely safe to open the PR.

Optional focus from the user: $ARGUMENTS

## Step 1 — Resolve the change under review

Run these (read-only):

```bash
git rev-parse --show-toplevel                       # repo root
git fetch origin main -q 2>/dev/null || true
BASE=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null)
git --no-pager diff --stat "${BASE}"...HEAD          # committed changes vs main
git --no-pager diff --stat                           # uncommitted (working tree)
```

Capture the **full diff** and the **changed-file list**:
- Committed: `git --no-pager diff "${BASE}"...HEAD`
- Plus any uncommitted working-tree changes: `git --no-pager diff` and `git --no-pager diff --staged`

Review the union of committed + uncommitted changes. If the diff is empty, tell the user there's
nothing to review and stop.

Determine the **repo** from the toplevel directory name (or `git remote get-url origin`):
- `dvt` → specialist agent **`code-reviewer`**
- `infra` → specialist agent **`infra-reviewer`**
- `website` → specialist agent **`website-reviewer`**

## Step 2 — Dispatch the reviewers (in parallel)

Make BOTH of these Agent calls in a single message so they run concurrently:

1. **The repo specialist** (`code-reviewer` / `infra-reviewer` / `website-reviewer`). Brief it with:
   the changed-file list, the full diff, and the user's focus (if any). Ask for its standard
   severity-sorted findings report including its **Cross-repo flags** section.

2. **`review-architect`.** Brief it with: the repo name, the changed-file list, and the diff. Ask it
   to (a) map the change against the cross-repo contract map, (b) name any other repos that need a
   specialist pass and what to verify there, and (c) stand by to synthesize — you will hand it the
   specialist's findings in the next step.

> Note: sub-agents can't call other sub-agents, so YOU are the conductor. If `review-architect`
> reports that another repo is affected, dispatch that repo's specialist too (point it at the relevant
> files in `~/git/getdvt/<repo>/`), then include its findings in the synthesis.

## Step 3 — Synthesize the verdict

Fold the specialist findings + the architect's cross-repo assessment into one report. Apply the gate:

- **NO-GO 🚫** if there is any **CRITICAL** finding, or an unmitigated **cross-repo contract break**,
  or a **HIGH** finding that is neither fixed nor explicitly justified.
- **GO ✅** otherwise. List MEDIUM/LOW as "address before merge / follow-up," not blockers.

Present:
1. **Verdict** (GO / NO-GO) and the decisive reason.
2. **Consolidated findings**, severity-sorted, each with file:line + a concrete fix.
3. **Cross-repo impact** + any downstream reviews still needed.
4. If NO-GO: the **minimal set of fixes** to flip it to GO.

## Step 4 — Record the result

**Only if the verdict is GO**, record a pass-marker so the enforcement hook lets `gh pr create`
through (keyed to the exact commit, so new commits require a fresh review):

```bash
GITDIR=$(git rev-parse --absolute-git-dir)   # worktree-safe; matches the enforcement hook
SHA=$(git rev-parse HEAD)
mkdir -p "${GITDIR}/dvt-pr-review"
# Clear any stale markers, then record the pass for this commit.
rm -f "${GITDIR}/dvt-pr-review/"*.pass 2>/dev/null || true
printf 'pass %s\n' "$(date -u +%FT%TZ)" > "${GITDIR}/dvt-pr-review/${SHA}.pass"
```

If the working tree was **dirty** (uncommitted changes were part of the review), warn the user: the
marker is keyed to the current HEAD, so they must **commit, then re-run `/pr-review`** before opening
the PR — otherwise the review won't cover what actually ships and the hook will (correctly) block.

On **NO-GO**, do not write a marker. Tell the user to fix the blockers and re-run `/pr-review`.

## Step 5 — Offer next step

On GO, offer to open the PR (`gh pr create`) and to paste the consolidated verdict into the PR body so
reviewers see what the local review found.
