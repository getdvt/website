# dvt.dev — data viz tool landing page

Astro site serving [dvt.dev](https://dvt.dev). Deploys via Cloudflare Pages.

## Stack

- **Framework:** [Astro](https://astro.build) (minimal, static + Pages Functions)
- **Hosting:** Cloudflare Pages (custom domain: dvt.dev)
- **Analytics:** Cloudflare Web Analytics (privacy-first, no cookies)
- **Handraise capture:** Cloudflare Pages Function → D1 + Resend notification

## Local dev

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # build to dist/
npm run preview    # preview the build
```

## Deploy

Push to `main` → Cloudflare Pages auto-deploys.

**First-time Cloudflare setup:**
1. Cloudflare → Workers & Pages → Create → Pages → connect `getdvt/website`
2. Build command: `npm run build`, output: `dist/`
3. Custom domain: `dvt.dev`
4. Environment variables (Pages → Settings → Environment variables):
   - `CF_BEACON_TOKEN` — from Cloudflare Web Analytics
   - `RESEND_API_KEY` — from [Resend](https://resend.com)
   - `NODE_VERSION` — `20`

## Handraise / D1 setup

```bash
# 1. Create the D1 database
wrangler d1 create dvt-handraises
# Copy the returned database_id into wrangler.toml

# 2. Run the schema
wrangler d1 execute dvt-handraises --file=schema.sql

# 3. Bind the DB in Pages → Settings → Functions → D1 database bindings
#    Variable name: DB, Database: dvt-handraises

# 4. Query handraises
wrangler d1 execute dvt-handraises --command="SELECT * FROM handraises ORDER BY created DESC LIMIT 20"
```

## Structure

```
src/
  layouts/Base.astro         ← <head>, meta, OG, CF analytics beacon
  components/
    Nav.astro                ← sticky nav: logo + GitHub CTA
    Hero.astro               ← headline, sub, primary CTAs
    Differentiators.astro    ← 5 feature cards
    Handraise.astro          ← early-access email capture
    Footer.astro             ← links + license
  pages/index.astro
  styles/
    tokens.css               ← CSS custom properties (brand tokens)
    global.css               ← resets + base styles
functions/
  api/handraise.ts           ← POST /api/handraise → D1 + Resend
public/                      ← favicons, OG image, logo SVGs
schema.sql                   ← D1 table definition
wrangler.toml                ← Cloudflare config
```

## Brand assets

Source SVGs live in `assets/brand/` in [`getdvt/dvt`](https://github.com/getdvt/dvt).
The `public/` copies are the subset needed for the site.

## Vendored content

`public/dvt-spec-authoring-skill.md` is a **vendored mirror** — the canonical copy
lives in the dvt product repo at `getdvt/dvt → web/public/dvt-spec-authoring-skill.md`
and is served here so [/spec](https://dvt.dev/spec) can offer it as a download.

**Do not hand-edit the website copy.** Edit it in the dvt repo, then re-sync:

```bash
./scripts/sync-spec-skill.sh        # copies from ../dvt/web/public/
```

CI (`.github/workflows/spec-skill-drift.yml`) fails if the two copies drift apart.
It compares against `demo.dvt.dev` (the public dvt deploy), so right after a dvt-side
change the check can lag until dvt redeploys.
