# dvt-accounts-sync (Cloudflare Worker cron)

Scheduled-only Worker that drives the pm-tool CRM accounts sync (DVT-2096).

On every cron tick it makes a single authenticated `POST` to the dvt-pm
accounts-sync endpoint, which pulls dvt org data into the pm-tool CRM
`accounts` table and records an `AccountSyncRun` row on every attempt. This
Worker holds **no** sync logic and **no** DB access — it is purely the clock.
It replaces a founder-clicked button that has not run since 2026-06-30. All
scoping, admin gating, and the audit trail live in the API: dvt-pm-tool
(slice 1 of DVT-2096, already merged and deployed).

It is deliberately deployed as a **standalone Worker**, not a Pages Function:
Cloudflare cron triggers are a Workers-only feature, and the dvt.dev site is a
Pages project. (Mirrors `workers/trial-sweep`, `workers/sandbox-reaper`,
`workers/exports-runner`.)

A registry entry for this Worker belongs in `infra/cloudflare/workers.tf`
(different repo — out of scope here).

## Why it's safe

- No `fetch` handler → unreachable over HTTP → the credential it holds cannot
  be exercised by any external caller; only the cron schedule drives it.
- Fails closed: until `PM_API_TOKEN` is set, the Worker throws before making
  any network call, so no unauthenticated request is ever sent.
- Every attempt — scheduled or button-clicked — is recorded as an
  `AccountSyncRun` row in pm-tool, so a missed or failed tick is auditable
  after the fact even without alerting (see "No alerting" below).

## Deviations from the house pattern (read before "fixing")

This Worker differs from `trial-sweep` / `exports-runner` / `sandbox-reaper`
in three deliberate ways; the full reasoning for each lives in the header
comment of `src/index.ts`:

1. **Single auth factor** (`Bearer <PM_API_TOKEN>` only, not the two-factor
   `Bearer <KEY>` + `X-Cron-Secret` the others use). Founder-approved
   2026-08-01, re-affirmed the same day after a `review-architect` HIGH.

   **Blast radius, stated plainly:** pm-tool's `ApiToken` has no scope
   column, so this credential grants the **entire** pm-tool admin surface —
   the whole CRM, expenses/financials, **and token minting**. Because minting
   is included, an attacker holding this token can mint another one, so
   revoking the leaked token does **not** fully contain a breach. The other
   three Workers' secrets each cost exactly one endpoint; this one costs the
   whole admin surface. This is an **accepted risk** for an internal-only
   tool whose secret lives in Cloudflare's secret store — not a virtue.
2. **120s timeout**, not the 30s baseline (`exports-runner` precedent):
   dvt-pm cold-starts from zero and fans out to dvt-api per demo invite.
3. **Targets `pm.dvt.dev` directly**, not a `.fly.dev` origin: `pm.dvt.dev`
   is DNS-only (`proxied = false`, `infra/cloudflare/dns.tf:76-90`), so there
   is no Cloudflare proxy to route around, unlike `app.dvt.dev`.

## Setup

The `PM_API_TOKEN` secret must be **minted by a human**, per
`dvt-pm-tool/CLAUDE.md`, for a `role="admin"` pm-tool user whose email is
under `@agents.dvt.dev` in prod — never a founder's personal user, so
revocation never disrupts a human and `last_used_at` attributes cleanly. That
same human runs `wrangler secret put PM_API_TOKEN` below, so the plaintext
token value never transits an agent.

## Deploy

```bash
cd workers/accounts-sync

# 1. One-time: set the secret (a pm-tool admin ApiToken — see Setup above).
#    Run by a human; the plaintext must never transit an agent.
npx wrangler secret put PM_API_TOKEN

# 2. Deploy (registers the worker + the daily cron trigger)
npx wrangler deploy
```

Requires `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` in the environment.

## Operate

```bash
npx wrangler tail dvt-accounts-sync   # live logs (each tick logs the sync summary)
```

Schedule: daily at 04:00 UTC (`0 4 * * *`), deliberately staggered from
`dvt-trial-sweep`'s `0 3 * * *` since both call Fly apps that cold-start from
zero. The acceptance bar is `accounts.last_synced_at` never older than ~25h,
which daily satisfies with ~1h of margin. Change the cadence in
`wrangler.toml` (`[triggers].crons`).

### Secret rotation

Simpler than `trial-sweep`'s two-place warning: `PM_API_TOKEN` lives in only
two places, pm-tool's DB and this Worker. To rotate:

1. Mint a new `ApiToken` (human step, per Setup above).
2. `npx wrangler secret put PM_API_TOKEN` with the new value.
3. Revoke the old token via `revoke_api_token` in pm-tool.

Do steps 2 and 3 close together — between them the old token still works, and
after step 3 (before step 2, if done out of order) the sync fails closed
(401), which is visible but not yet alerted (see below).

## No alerting

No alerting exists org-wide for this Worker. A failed tick is visible only in
the Cloudflare dashboard or `npx wrangler tail dvt-accounts-sync` — nothing
pages anyone. Tracked as a follow-up: **DVT-732**. Do not build alerting here.
