# Google Search Console — bootstrap

Ownership of the `sc-domain:dvt.dev` Search Console property is established by a script,
not a manual walkthrough. `scripts/gsc-bootstrap.mjs` (DVT-2996) is run-once and
idempotent — safe to re-run any time.

## What it does

1. **getToken** — requests a DNS_TXT site-verification token from Google for the
   `seo-automation` service account + `dvt.dev`.
2. **cloudflare-txt** — creates that token as a TXT record in Cloudflare DNS. Additive
   only: it never modifies or deletes an existing record.
3. **verify** — completes DNS_TXT verification via `webResource.insert`, retrying with
   backoff while the TXT record propagates.
4. **co-owner** — adds `collin@dvt.dev` as a co-owner of the verified resource
   (best-effort; a failure here is logged, not fatal).
5. **sc-property** — registers the `sc-domain:dvt.dev` property in Search Console.
6. **sitemap** — submits `https://dvt.dev/sitemap-index.xml`.
7. **smoke** — runs a `searchAnalytics.query` to confirm the property responds (0 rows
   is a pass — the property may be new).

## Running it

```bash
doppler run --project dvt --config prd -- node scripts/gsc-bootstrap.mjs
```

Add `--dry-run` to perform auth and all read calls and print what each write step would
do, without making any writes:

```bash
doppler run --project dvt --config prd -- node scripts/gsc-bootstrap.mjs --dry-run
```

The script exits 0 with a `bootstrap complete` summary line on success, or exits 1
naming the failing step.

## Secrets

Both live in Doppler project `dvt`, config `prd`:

| Secret | Purpose |
|---|---|
| `GSC_SERVICE_ACCOUNT_JSON` | full JSON key for `seo-automation@getdvt.iam.gserviceaccount.com` (GCP project `getdvt`) |
| `CLOUDFLARE_DNS_TOKEN` | Cloudflare API token scoped to DNS edit on the `dvt.dev` zone |

Neither is ever logged by the script.

## Idempotency

Every step checks before it writes (or tolerates an "already exists" response), so
re-running the script is safe. DNS writes are additive-only — the pre-existing
`google-site-verification=vhlz4cp_...` TXT record belongs to the founder's personal
Search Console verification and must never be removed.

## Key rotation

The org policy `iam.disableServiceAccountKeyCreation` blocks new SA keys by default.
Rotating `GSC_SERVICE_ACCOUNT_JSON` requires a temporary project-level override, held by
`collin@dvt.dev` (`roles/orgpolicy.policyAdmin`):

```bash
gcloud resource-manager org-policies disable-enforce \
  iam.disableServiceAccountKeyCreation --project=getdvt

# create the new key, update the Doppler secret, then restore enforcement:
gcloud resource-manager org-policies enable-enforce \
  iam.disableServiceAccountKeyCreation --project=getdvt
```

Delete the old key from the service account once the new one is confirmed working.
