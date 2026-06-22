# Cross-repo CI reads via a GitHub App — `getdvt-ci-reader`

**Internal pattern.** When a workflow in one getdvt repo needs to read a file from
*another, private* getdvt repo at CI time, authenticate with a **GitHub App
installation token** rather than a personal access token (PAT).

This repo's first use: the weekly `upstream-enum-sweep` job in
[`workflows/chart-types-drift.yml`](workflows/chart-types-drift.yml) reads
`getdvt/dvt`'s `spec/schema/dashboard.schema.json` to detect drift in the vendored
`PanelType` enum (GTM-33 / GTM-34).

## Why an App instead of a PAT

| | Fine-grained PAT | GitHub App installation token |
|---|---|---|
| Owner | a person's account | the **org** (survives anyone leaving) |
| Lifetime | up to a year (long-lived secret) | **~1 hour, minted per run** (auto-rotated) |
| Scope | repo + permission | repo + permission (same least-privilege) |
| Audit | acts as the person | acts as the App (clear in the audit log) |
| Revocation | revoke the token | uninstall the App |

For a recurring, unattended CI job the App is the right default: no human-owned
long-lived secret, and the token can't outlive the run.

## One-time setup (org owner)

You need to be a `getdvt` **org owner**. Steps 1–2 are GitHub-UI only (they generate
private-key material), so they can't be scripted.

### 1. Create the App (org-owned)

GitHub → your org: **github.com/organizations/getdvt/settings/apps** → **New GitHub App**.

- **Name:** `getdvt-ci-reader` (must be globally unique on GitHub; if taken, use
  `getdvt-ci-reader-bot` and update the `DVT_SCHEMA_APP_ID` variable accordingly —
  the name is cosmetic, the App ID is what the workflow uses).
- **Homepage URL:** `https://github.com/getdvt` (anything valid).
- **Webhook:** **uncheck "Active"** — this App needs no webhook.
- **Repository permissions:** **Contents → Read-only.** Nothing else.
- **Where can this App be installed:** "Only on this account."
- Create it. Note the **App ID** (shown on the App's settings page).
- Scroll to **Private keys → Generate a private key.** A `.pem` downloads — this is
  secret material; do not commit it. You'll paste it into a repo secret below, then
  delete the local file.

### 2. Install the App on the source repo(s)

On the App's page → **Install App** → install into the `getdvt` org → **Only select
repositories** → choose **`dvt`** (the repo whose files CI needs to read). Add more
repos here later to reuse the same App for other cross-repo reads.

### 3. Wire it into the consuming repo (`getdvt/website`)

The App ID is **not** secret (it's gated in an `if:`, and secrets can't be used in
`if:`), so it goes in a repo **variable**; the private key goes in a repo **secret**:

```bash
# App ID — a repo VARIABLE (non-secret)
gh variable set DVT_SCHEMA_APP_ID --repo getdvt/website --body "<APP_ID>"

# Private key — a repo SECRET (paste the .pem contents)
gh secret set DVT_SCHEMA_APP_PRIVATE_KEY --repo getdvt/website < /path/to/getdvt-ci-reader.<...>.private-key.pem

# then delete the local key
rm /path/to/getdvt-ci-reader.<...>.private-key.pem
```

(Or set both in the GitHub UI: repo **Settings → Secrets and variables → Actions** →
the **Variables** tab for `DVT_SCHEMA_APP_ID`, the **Secrets** tab for
`DVT_SCHEMA_APP_PRIVATE_KEY`.)

### 4. Verify

```bash
gh workflow run chart-types-drift.yml --ref main --repo getdvt/website
# watch the run; the upstream-enum-sweep job should now mint a token and print:
#   OK — upstream enum matches vendored copy (<N> types)
#   (<N> is whatever getdvt/dvt's PanelType enum currently has — the number isn't
#    a pass/fail assertion; a mismatch prints an explicit ::error:: instead.)
```

Before setup, the same run logs a `::notice::` that the sweep was skipped — that's the
inert state, not a failure.

## How the workflow consumes it

```yaml
- name: Mint getdvt/dvt read token (GitHub App)
  id: app-token
  if: vars.DVT_SCHEMA_APP_ID != ''
  uses: actions/create-github-app-token@v2
  with:
    app-id: ${{ vars.DVT_SCHEMA_APP_ID }}
    private-key: ${{ secrets.DVT_SCHEMA_APP_PRIVATE_KEY }}
    owner: getdvt
    repositories: dvt          # token scoped to ONLY this repo

- name: Read a file from the private repo
  if: vars.DVT_SCHEMA_APP_ID != ''
  env:
    GH_TOKEN: ${{ steps.app-token.outputs.token }}   # gh + Octokit read GH_TOKEN
  run: gh api repos/getdvt/dvt/contents/<path> -H "Accept: application/vnd.github.raw"
```

The `owner` + `repositories` inputs scope the minted token to exactly `getdvt/dvt`
even though the workflow runs in `getdvt/website`. The job's own `permissions:` block
(for the default `GITHUB_TOKEN`) is unrelated and stays least-privilege
(`contents: read`).

## Reusing this for another cross-repo read

1. Install `getdvt-ci-reader` on the additional source repo (step 2).
2. In the consuming repo, set the same `DVT_SCHEMA_APP_ID` variable +
   `DVT_SCHEMA_APP_PRIVATE_KEY` secret (the App can serve many consumers).
3. In the workflow, mint a token with `repositories:` set to the target repo.

No new App needed unless you want a different permission set or an independent
audit/revocation boundary.

## Caveats

- **Don't make the sweep a required status check.** It no-ops on PRs and when the App
  is unprovisioned, so it would report a false green. The PR-time gate is the
  `chart-types-drift` job.
- **Fail-open by design.** If the App is uninstalled or the key is rotated away, the
  sweep skips (or errors loudly on a bad key) — it never silently passes drift.
- **Key rotation.** To rotate: generate a new private key on the App, update
  `DVT_SCHEMA_APP_PRIVATE_KEY`, then delete the old key from the App. Zero workflow
  change.
