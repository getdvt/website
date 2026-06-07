# Google Search Console — Setup Walkthrough

**Priority:** Do this before publishing any new SEO content. Without it, Google doesn't
know your sitemap exists and new pages index slowly or not at all.

**Time to complete:** ~15 minutes.

---

## Prerequisites

- Access to the `dvt.dev` Cloudflare Pages project (or DNS records)
- A Google account (use a shared team account or your personal one — ownership can be
  transferred later)

---

## Step 1 — Open Search Console

Go to [search.google.com/search-console](https://search.google.com/search-console).
Click **"Start now"** and sign in.

---

## Step 2 — Add a property

Click **"Add property"** (top-left dropdown → "Add property").

Choose **"Domain"** (not "URL prefix") and enter `dvt.dev`.

> The Domain property covers all protocols (http/https) and all subdomains automatically —
> it's the right choice for a root domain. The URL prefix property only covers one
> protocol + subdomain combination.

---

## Step 3 — Verify ownership (DNS method)

Google will give you a **TXT record** to add to your DNS. It looks like:
```
google-site-verification=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Add it in Cloudflare:**

1. Open [dash.cloudflare.com](https://dash.cloudflare.com) → select the `dvt.dev` zone.
2. Go to **DNS → Records**.
3. Click **"Add record"**:
   - Type: `TXT`
   - Name: `@` (the root, i.e. `dvt.dev`)
   - Content: paste the full `google-site-verification=...` string
   - TTL: Auto
4. Click **Save**.

Back in Search Console, click **"Verify"**.

> DNS changes propagate in seconds on Cloudflare but Google may take a minute or two
> to confirm. If it fails, wait 2 minutes and try again.

---

## Step 4 — Submit the sitemap

After verification, you're inside the Search Console dashboard for dvt.dev.

1. Left sidebar → **"Sitemaps"**
2. In the "Add a new sitemap" field enter: `sitemap-index.xml`
3. Click **"Submit"**

The sitemap URL is `https://dvt.dev/sitemap-index.xml` — this is generated automatically
by the `@astrojs/sitemap` integration and contains references to all pages. Astro
generates it at build time whenever a page has `export const prerender = true`.

**Verify it's working:** after submitting, the status should show "Success" with the
number of discovered URLs. If it shows an error, check:
- Run `npm run build` locally and confirm `sitemap-index.xml` exists in `dist/`
- Check that every page in `src/pages/` has `export const prerender = true`

---

## Step 5 — Request indexing for key pages

Once the sitemap is submitted, go to the **URL Inspection** tool (top search bar in
Search Console). Enter each key URL and click **"Request Indexing"**:

- `https://dvt.dev/`
- `https://dvt.dev/spec`
- `https://dvt.dev/vision`

This doesn't guarantee same-day indexing but puts the URLs in Google's crawl queue
immediately rather than waiting for the next crawl cycle.

---

## Step 6 — What to check weekly (once indexed)

In Search Console:

- **Performance → Search results**: which queries are driving impressions/clicks.
  Look for the `JSON dashboard spec`, `dbt dashboarding`, and `DVT` brand terms
  appearing. Click volume will be low at first — impressions are the signal to watch.
- **Coverage**: any pages with errors (redirects, 404s, noindex flags). Should be clean.
- **Core Web Vitals**: flag any LCP or CLS regressions. dvt.dev is a static Astro
  site so this should be green, but check after any layout changes.

---

## Ongoing: adding new pages

Whenever a new page is added to `src/pages/`:
1. Make sure it has `export const prerender = true`
2. Rebuild + deploy (Cloudflare Pages auto-deploys on `website/main` merge)
3. The sitemap updates automatically at deploy time
4. Use URL Inspection → "Request Indexing" on the new page to speed up discovery

---

## Notes

- `robots.txt` is now live at `/robots.txt` (added 2026-06-07) with the sitemap
  directive. Googlebot will pick this up on its next crawl.
- Cloudflare Web Analytics (cookieless) is already on the site — it covers real-user
  traffic but doesn't show search queries. Search Console is the query-level signal.
- Transfer Search Console ownership to a shared `team@dvt.dev` account when email
  is set up — don't leave it tied to a personal account only.
