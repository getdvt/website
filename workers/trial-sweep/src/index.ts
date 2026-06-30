/**
 * dvt-trial-sweep — Cloudflare Worker cron trigger (DVT-783 / ADR-0052 D5).
 *
 * On each scheduled tick this Worker makes a single authenticated POST to the
 * dvt-api trial-sweep endpoint, which purges the content of expired Gallery-trial
 * orgs (≥30 days past trial_ends_at, never converted) and their R2 artifacts. The
 * Worker carries NO delete logic and NO database access — it is purely the clock.
 * Every safety guard (plan='gallery' scoping, converted_at suppression, the
 * organizations_guard_delete trigger that never lets the org row be deleted,
 * explicit entity_revisions prune, per-org transaction) lives in the API:
 * dvt/server/internal/repo/trial.go (SweepExpiredTrials).
 *
 * Auth: the sweep requires BOTH factors (ADR-0052 D5) —
 *   Authorization: Bearer <TRIAL_PROVISION_KEY>
 *   X-Cron-Secret: <TRIAL_CRON_SECRET>
 * both of which must match the secrets on the dvt-api Fly app. Until both are set
 * the endpoint fails closed (401) and nothing is purged.
 *
 * There is intentionally no `fetch` handler: this Worker is unreachable over
 * HTTP and can only be driven by its cron trigger, so the credentials it holds
 * cannot be exercised by an external caller.
 */

export interface Env {
  /** Direct dvt-api trial-sweep URL (bypasses the Cloudflare proxy). */
  SWEEP_URL: string
  /** First factor — matches TRIAL_PROVISION_KEY on dvt-api. */
  TRIAL_PROVISION_KEY: string
  /** Second factor — matches TRIAL_CRON_SECRET on dvt-api. */
  TRIAL_CRON_SECRET: string
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    // Fail loud (and visible in `wrangler tail`) if a secret was never set —
    // a silent no-auth call would just 401 forever and the sweep would never run.
    if (!env.TRIAL_PROVISION_KEY || !env.TRIAL_CRON_SECRET) {
      throw new Error(
        'trial-sweep: missing TRIAL_PROVISION_KEY / TRIAL_CRON_SECRET secret(s)',
      )
    }

    // Await directly (single short request): a throw here marks the scheduled
    // invocation as errored in the CF cron dashboard, which is the only signal
    // a failed sweep produces. No waitUntil — we want the failure to count.
    await sweep(env)
  },
}

async function sweep(env: Env): Promise<void> {
  const res = await fetch(env.SWEEP_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.TRIAL_PROVISION_KEY}`,
      'X-Cron-Secret': env.TRIAL_CRON_SECRET,
    },
    // Fail fast rather than riding the Worker wall-clock limit if dvt-api hangs.
    signal: AbortSignal.timeout(30_000),
  })

  // Body is small JSON (a SweepResult summary); log it so `wrangler tail` shows
  // how many orgs were swept. Throw on non-2xx so the failure surfaces in the
  // Cloudflare cron dashboard rather than passing silently.
  const body = await res.text()
  if (!res.ok) {
    throw new Error(`trial-sweep: sweep failed ${res.status}: ${body.slice(0, 500)}`)
  }
  console.log(`trial-sweep: ok ${res.status} ${body.slice(0, 500)}`)
}
