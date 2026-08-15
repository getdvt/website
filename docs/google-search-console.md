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
doppler run --project dvt --config ops -- node scripts/gsc-bootstrap.mjs
```

Add `--dry-run` to perform auth and all read calls and print what each write step would
do, without making any writes:

```bash
doppler run --project dvt --config ops -- node scripts/gsc-bootstrap.mjs --dry-run
```

The script exits 0 with a `bootstrap complete` summary line on success, or exits 1
naming the failing step.

## Secrets

Both live in Doppler project `dvt`, config `ops` — a dedicated operator config, not `prd`.
`prd` syncs into the Fly product runtimes (ADR-0026), and the dvt secrets-registry carves
out `CLOUDFLARE_*` as Terraform-owned; a registry row for these two is a follow-up ticket:

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

The dedup check is content-equality on the TXT value, so a *changed* verification token
would add a second record, not replace the old one. The token is stable in practice, so
this shouldn't happen — if cruft appears, clean it up manually in the Cloudflare
dashboard, never by re-running this script.

## DNS source of truth

The apex TXT record this script creates lives outside infra's `cloudflare/dns.tf` (the
declared source of truth for the `dvt.dev` zone). After the first live run it must be
`terraform import`ed there, per that file's existing Resend-records precedent (follow-up
infra ticket). Until then the record is deliberately script-managed — don't delete it by
hand.

## Key rotation

The org policy `iam.disableServiceAccountKeyCreation` blocks new SA keys by default.
Rotating `GSC_SERVICE_ACCOUNT_JSON` requires a temporary project-level override, held by
`collin@dvt.dev` (`roles/orgpolicy.policyAdmin`):

```bash
gcloud resource-manager org-policies disable-enforce \
  iam.disableServiceAccountKeyCreation --project=getdvt

# create the new key on stdout (never touches disk), load it straight into Doppler:
gcloud iam service-accounts keys create /dev/stdout \
  --iam-account=seo-automation@getdvt.iam.gserviceaccount.com \
  | doppler secrets set GSC_SERVICE_ACCOUNT_JSON --project dvt --config ops

# once confirmed working, retire the old key:
gcloud iam service-accounts keys list --iam-account=seo-automation@getdvt.iam.gserviceaccount.com
gcloud iam service-accounts keys delete <OLD_KEY_ID> \
  --iam-account=seo-automation@getdvt.iam.gserviceaccount.com

# restore enforcement EVEN IF a step above failed — the override must never outlive the rotation:
gcloud resource-manager org-policies enable-enforce \
  iam.disableServiceAccountKeyCreation --project=getdvt

# verify it actually restored (expect "enforced: true"):
gcloud resource-manager org-policies describe \
  iam.disableServiceAccountKeyCreation --project=getdvt --effective
```

### Rotating `CLOUDFLARE_DNS_TOKEN`

Zone-scoped `DNS:Edit`, not record-scoped — its blast radius covers every DNS record in
the `dvt.dev` zone (Workspace MX, Resend's DKIM/SPF, the Pages apex CNAME), far beyond
what this script touches. Rotate by minting a new token in the Cloudflare dashboard,
`doppler secrets set CLOUDFLARE_DNS_TOKEN --project dvt --config ops`, then revoking the
old token in the dashboard.

## Ongoing

- Weekly: check GSC coverage + performance for `sc-domain:dvt.dev` (soon automated by the
  growth-monitor SEO extension, DVT-3002).
- Gotcha: relative sitemap paths are rejected on Domain properties — sitemap URLs must be
  absolute.
- New pages need `export const prerender = true` to be crawlable/indexable at all.
