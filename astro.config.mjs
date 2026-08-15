// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import { buildLastmodMap } from './scripts/sitemap-lastmod.mjs';

// Built once at config load (DVT-2993): blog frontmatter dates + git commit
// dates for static pages. See scripts/sitemap-lastmod.mjs for sourcing rules
// and the shallow-clone guard.
const lastmodMap = buildLastmodMap();

// https://astro.build/config
export default defineConfig({
  site: 'https://dvt.dev',
  integrations: [
    sitemap({
      // @astrojs/sitemap already excludes 404.astro's built output
      // (dist/client/404.html) from the generated sitemap by default — this
      // filter is a belt-and-braces guard in case that default ever
      // changes. Sitemap URLs are trailing-slash (e.g.
      // "https://dvt.dev/404/"), so match on that form.
      filter: (page) => !/\/404\/?$/.test(page),
      serialize(item) {
        const lastmod = lastmodMap.get(item.url);
        if (lastmod) item.lastmod = lastmod;
        return item;
      },
    }),
  ],
  adapter: cloudflare(),
  output: 'static', // static pages; Pages Functions (functions/) handle the handraise API
  vite: {
    // Pre-bundle echarts when the dev server starts instead of transforming its
    // ~1MB source on the first chart request (which made `astro dev` feel slow
    // on first load). No effect on the production build, where echarts is
    // already emitted as a lazy-loaded chunk.
    optimizeDeps: { include: ['echarts'] },
  },
});