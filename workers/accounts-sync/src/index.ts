/**
 * dvt-accounts-sync — Cloudflare Worker cron trigger (DVT-2096).
 *
 * On each scheduled tick this Worker makes a single authenticated POST to the
 * dvt-pm accounts-sync endpoint, which pulls dvt org data into the pm-tool CRM
 * `accounts` table. The Worker carries NO sync logic and NO database access —
 * it is purely the clock. This replaces a founder-clicked button that has not
 * run since 2026-06-30. Every safety guard, admin gating, and the
 * `AccountSyncRun` audit row recorded on every attempt live in the API
 * (slice 1, DVT-2096, already merged and deployed).
 *
 * There is intentionally no `fetch` handler: this Worker is unreachable over
 * HTTP and can only be driven by its cron trigger, so the credential it holds
 * cannot be exercised by an external caller.
 *
 * This Worker deviates from the house pattern (trial-sweep, exports-runner,
 * sandbox-reaper) in THREE ways. Each is deliberate — read before "fixing":
 *
 * 1. SINGLE auth factor, not the two-factor `Bearer <KEY>` + `X-Cron-Secret`
 *    the other three Workers use. Founder-approved 2026-08-01, and
 *    re-affirmed the same day after a `review-architect` HIGH finding.
 *
 *    Blast radius, stated plainly: pm-tool's `ApiToken` has NO scope column,
 *    so this credential grants the ENTIRE admin surface — the whole CRM,
 *    expenses/financials, AND token minting. Because minting is included, an
 *    attacker holding this token can mint another one, so revoking the
 *    leaked token does NOT fully contain a breach. The other three Workers'
 *    secrets each cost exactly one endpoint; this one costs the whole admin
 *    surface. This was accepted deliberately for an internal-only tool whose
 *    secret lives in Cloudflare's secret store — an accepted risk, not a
 *    virtue. The token MUST be minted for a dedicated non-human identity
 *    under `@agents.dvt.dev`, never a founder's personal user, so revocation
 *    never disrupts a human and `last_used_at` attributes cleanly.
 *
 *    Why `ApiToken` over a bespoke shared secret: pm-tool has ZERO inbound
 *    machine-auth prior art — no `compare_digest` anywhere in the repo, no
 *    `X-Cron-Secret`, no inbound `INTERNAL_API_KEY` (its three `*_key`
 *    settings are all outbound). We instead use a dedicated admin `ApiToken`
 *    (`backend/app/auth.py` `mint_api_token`), which is DB-backed,
 *    revocable, and audited (`last_used_at` stamped per call), flows through
 *    `_ensure_active` so deactivation kills it, and satisfies `require_admin`
 *    with zero new server code. A bespoke `PM_CRON_SECRET` would be a
 *    strictly worse non-revocable, non-audited parallel auth path — and the
 *    first place in that repo where constant-time comparison would actually
 *    matter.
 *
 * 2. TIMEOUT above the 30s baseline (120_000, the exports-runner precedent).
 *    dvt-pm runs `min_machines_running = 0` and cold-starts from zero, and
 *    this endpoint then fans out to dvt-api per demo invite. See the
 *    justification on the line directly above the timeout below.
 *
 * 3. TARGET is `pm.dvt.dev`, NOT a `.fly.dev` direct origin — inverting what
 *    the other three Workers do. The other Workers target dvt-api, which
 *    sits behind `app.dvt.dev`, a Cloudflare-proxied record that returns CF
 *    1010 on `/internal/*`; their `.fly.dev` hop exists to route around that
 *    proxy. `pm.dvt.dev` is DNS-only (`proxied = false`,
 *    `infra/cloudflare/dns.tf:76-90`, so Fly terminates TLS with its own
 *    cert) — measured: `server: Fly/…` with no `cf-ray`. There is no proxy
 *    to bypass, so using `dvt-pm.fly.dev` would hardcode Fly infrastructure
 *    and abandon the stable public hostname for nothing.
 */

export interface Env {
  /** dvt-pm accounts-sync URL, including the load-bearing `?triggered_by=cron`. */
  SYNC_URL: string
  /** pm-tool admin ApiToken. Grants the entire pm-tool admin surface — see header comment. */
  PM_API_TOKEN: string
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    // Fail loud (and visible in `wrangler tail`) if the secret was never set —
    // a silent no-auth call would just 401 forever and the sync would never run.
    if (!env.PM_API_TOKEN) {
      throw new Error('accounts-sync: missing PM_API_TOKEN secret')
    }

    // Await directly (single request): a throw here marks the scheduled
    // invocation as errored in the CF cron dashboard, which is the only
    // signal a failed sync produces. No waitUntil — we want the failure to
    // count.
    await sync(env)
  },
}

async function sync(env: Env): Promise<void> {
  const res = await fetch(env.SYNC_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.PM_API_TOKEN}`,
    },
    // dvt-pm runs min_machines_running=0 and cold-starts from zero, and this
    // endpoint then fans out to dvt-api per demo invite — allow more headroom
    // than the 30s baseline (exports-runner precedent) while still failing
    // before the Worker wall-clock limit if dvt-pm hangs.
    signal: AbortSignal.timeout(120_000),
  })

  // Body is small JSON (an AccountSyncRun summary); log it so `wrangler tail`
  // shows what happened. Throw on non-2xx so the failure surfaces in the
  // Cloudflare cron dashboard rather than passing silently.
  const body = await res.text()
  if (!res.ok) {
    throw new Error(`accounts-sync: sync failed ${res.status}: ${body.slice(0, 500)}`)
  }
  console.log(`accounts-sync: ok ${res.status} ${body.slice(0, 500)}`)
}
