import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

// Blog posts live as Markdown in src/content/blog/.
// The route /blog/<id> is derived from each file's name.
const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default('Collin Austad'),
    ogImage: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

// Programmatic chart-type SEO pages (DVT-3004). Authored content lives in
// src/data/chart-pages.json — one entry per approved dvt chart type. The
// route /charts/<id> is derived from each entry's id (slug drift is
// enforced by scripts/check-chart-pages.mjs, not by this schema).
const chartPages = defineCollection({
  loader: file('src/data/chart-pages.json'),
  schema: z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    type: z.string().startsWith('chart:'),
    title: z.string().min(3),
    metaDescription: z.string().min(80).max(180),
    whenToUse: z.string().min(60),
    targetQuery: z.string().min(3),
    summary: z.string().min(20).max(120),
  }),
});

export const collections = { blog, chartPages };
