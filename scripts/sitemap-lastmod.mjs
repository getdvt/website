// Builds a URL -> ISO-date map used by astro.config.mjs to stamp <lastmod>
// on sitemap entries (DVT-2993).
//
// Two sources, each best-effort and never fabricated:
//   - Blog posts: parsed straight from the frontmatter block in
//     src/content/blog/*.md (updatedDate if present, else pubDate). No
//     astro:content import here — this file runs at Astro *config* load
//     time, outside the content-collections runtime.
//   - Static pages: the last git commit date touching each src/pages/**/*.astro
//     file. Cloudflare Pages CI may build from a shallow clone, in which case
//     `git log` can't see history — when that's detected, static pages are
//     simply omitted from the map rather than stamped with a wrong date.
//
// Zero external dependencies: pure Node built-ins.

import { readdirSync, readFileSync, statSync } from 'fs';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, relative, resolve } from 'path';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://dvt.dev';

/** Walk a directory recursively, returning absolute paths of files matching `test`. */
function walk(dir, test, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, test, out);
    } else if (test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Parse `key: value` out of a leading `---`-delimited frontmatter block. */
function parseFrontmatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const fields = {};
  if (!match) return fields;
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.+?)\s*$/);
    if (m) fields[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return fields;
}

function isShallowClone() {
  try {
    const out = execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    return out === 'true';
  } catch {
    // Not a git checkout at all (or git unavailable) — treat like a shallow
    // clone: no reliable history, so omit static-page lastmod rather than guess.
    return true;
  }
}

function blogLastmods() {
  const map = new Map();
  const blogDir = join(REPO_ROOT, 'src/content/blog');
  let files;
  try {
    files = readdirSync(blogDir).filter((f) => f.endsWith('.md'));
  } catch {
    return map;
  }
  for (const file of files) {
    const source = readFileSync(join(blogDir, file), 'utf8');
    const fm = parseFrontmatter(source);
    const date = fm.updatedDate ?? fm.pubDate;
    if (!date) continue;
    const slug = file.replace(/\.md$/, '');
    map.set(`${SITE}/blog/${slug}/`, date);
  }
  return map;
}

function staticPageLastmods() {
  const map = new Map();
  if (isShallowClone()) return map;

  const pagesDir = join(REPO_ROOT, 'src/pages');
  const files = walk(pagesDir, (name) => name.endsWith('.astro') && !name.includes('['));

  for (const file of files) {
    const rel = relative(pagesDir, file); // e.g. "quickstart.astro", "security/roles.astro", "index.astro"
    if (rel === '404.astro') continue;

    let route = '/' + rel.replace(/\.astro$/, '');
    route = route.replace(/\/index$/, '/') || '/';
    if (route !== '/') route = route.replace(/\/$/, '') + '/';

    let date;
    try {
      date = execFileSync('git', ['log', '-1', '--format=%cI', '--', file], {
        cwd: REPO_ROOT,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim();
    } catch {
      date = '';
    }
    if (!date) continue;

    map.set(`${SITE}${route}`, date);
  }
  return map;
}

/** @returns {Map<string, string>} full URL -> ISO date string */
export function buildLastmodMap() {
  const map = new Map();
  for (const [url, date] of blogLastmods()) map.set(url, date);
  for (const [url, date] of staticPageLastmods()) map.set(url, date);
  return map;
}
