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
});