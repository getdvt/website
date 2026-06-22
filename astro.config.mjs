// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://dvt.dev',
  integrations: [sitemap()],
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