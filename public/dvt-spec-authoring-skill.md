---
name: dvt-spec-author
description: Author and edit dvt dashboard specs (JSON). Use when a user wants to create, modify, or theme a dvt dashboard, or convert a question/data into a dashboard. Covers the authoring method — audit the data for variance, find one answer-first key message, design encodings/layout, then build and render-verify — not just spec syntax.
---

# dvt Spec Authoring Skill

dvt dashboards are **JSON specs** — "dashboards as data." A spec is declarative: it
describes panels, their data queries, layout, and a token-based theme. The same
spec renders the same pixels every time. Hand this skill to your AI harness so it
can write and edit dvt specs directly, then paste the result into the dvt Spec
Builder (`/builder`) to see it render live.

## Top-level shape

```json
{
  "schemaVersion": 1,
  "id": "uuid-or-zeros",
  "meta": { "title": "...", "brief": "one-line thesis",
            "findings": ["..."], "readme": "markdown", "decisions": ["..."],
            "tags": ["..."], "createdBy": { "actorType": "user", "actorId": "..." } },
  "theme": { "tokens": { "primitive": {}, "semantic": {}, "component": {} } },
  "layout": { "columns": 24, "rowHeight": 30, "items": { "lg": [], "md": [] } },
  "panels": [ /* Panel[] for the default page */ ],
  "pages": [ { "id": "...", "title": "...", "layout": {...}, "panels": [...],
              "background": "linear-gradient(135deg,#1E1B4B,#0D9488)" } ],
  "tabBar": { "position": "top", "layout": "horizontal", "alignment": "start", "size": "md" }
}
```

- Use **`pages`** for multi-tab dashboards; each page has its own `layout` + `panels`.
  (If you use `pages`, the top-level `panels`/`layout` can be empty.)
- **`page.background`** (per page) takes any CSS background — a solid, a `linear-gradient(...)`,
  a `radial-gradient(...)`, or an image. Use it to make each page its own visual "world."
- **`layout.items`** is keyed by breakpoint (`lg`, `md`, `sm`, `xs`). Each item:
  `{ "i": panelId, "x", "y", "w", "h" }` on a 24-column grid. `rowHeight` is ~30px;
  a KPI strip ≈ `h:4`, a chart ≈ `h:7–8`. Author `lg` always. Below a 640px-wide
  container the renderer stacks the `lg` panels into one full-width column in
  reading order — author `sm`/`xs` items (with `layout.breakpoints`) only when you
  want to hand-tune that narrow view; they win over the automatic stack. (`md` is
  not consulted for narrow stacking.)

## Panel types

| `type` | Renders | Key `spec` fields |
| --- | --- | --- |
<!-- BEGIN generated chart-type table (make echarts / ADR-0022) — do not edit between markers -->
| `chart:bar` / `chart:bar:horizontal` / `chart:bar:stacked` / `chart:bar:stacked-percent` | ECharts bar | `xAxis`, `yAxis`, `series[].dataField`, `series[].itemStyle.color`; stacked uses `categoryField`/`seriesField`/`valueField` |
| `chart:line` / `chart:line:smooth` / `chart:line:step` / `chart:area` | ECharts line | `series[].dataField`, `series[].smooth`, `series[].lineStyle`, dual `yAxis` + `yAxisIndex`; `chart:area` adds `areaStyle` |
| `chart:pie` / `chart:donut` | ECharts pie | `series[].radius` (`["40%","70%"]` = donut), `series[].label` |
| `chart:scatter` | ECharts scatter | `xField`, `yField`, `sizeField` (bubble), `labelField`; binds rows → `[x,y,size]` points |
| `chart:effect-scatter` | ECharts effectScatter (passthrough) | scatter with ripple emphasis — `series[].rippleEffect`, inline or `dataField`-bound points |
| `chart:heatmap` | ECharts heatmap | `xField`, `yField`, `valueField`, `valueFormat`; auto category axes + `visualMap` ramp (`heatmap.low`/`heatmap.high` tokens) |
| `chart:gauge` | ECharts gauge | first numeric column (or `valueField`) binds the value; `valueFormat` formats the detail readout; `min`/`max`, `progress`, `axisLine` |
| `chart:radar` | ECharts radar (passthrough) | `radar.indicator[]`, inline `series[].data: [{ name, value: [...] }]` |
| `chart:funnel` | ECharts funnel | (name, value) columns auto-bind (`labelField`/`valueField` to override); `series[].sort`, `gap`, `label` |
| `chart:treemap` | ECharts treemap (passthrough) | inline `series[].data` hierarchy (`{ name, value, children }`), `levels` |
| `chart:sankey` | ECharts sankey | `sourceField`/`targetField`/`valueField` columns → nodes + links (or inline `series[].data` + `series[].links`) |
| `chart:tree` | ECharts tree (passthrough) | inline `series[].data` hierarchy, `layout` (`orthogonal`/`radial`) |
| `chart:sunburst` | ECharts sunburst (passthrough) | inline `series[].data` hierarchy (`{ name, value, children }`), `radius` |
| `chart:boxplot` | ECharts boxplot (passthrough) | inline `series[].data: [[min, Q1, median, Q3, max], …]` + category `xAxis.data` |
| `chart:candlestick` | ECharts candlestick (passthrough) | inline `series[].data: [[open, close, low, high], …]` + category `xAxis.data` |
| `chart:graph` | ECharts graph (passthrough) | inline `series[].data` (nodes) + `series[].links`, `layout: "force"`, `categories` |
| `chart:lines` | ECharts lines (passthrough) | inline `series[].data` polylines/trajectories (`coords`), `polyline`, `effect` |
| `chart:parallel` | ECharts parallel (passthrough) | `parallelAxis[]` dims + inline `series[].data` rows |
| `chart:pictorial-bar` | ECharts pictorialBar (passthrough) | `series[].symbol` per category, `symbolRepeat`, `symbolSize` |
| `chart:theme-river` | ECharts themeRiver (passthrough) | `singleAxis` (time) + inline `series[].data: [[date, value, stream], …]` |
| `chart:chord` | ECharts chord (passthrough) | inline `series[].data` (nodes) + `series[].links` with values |
| `chart:map` | ECharts map (advanced) | `series[].map` names a registered map asset (bundled: `USA`); (name, value) rows bind automatically, `labelField`/`valueField` override; `visualMap` min/max auto-fill from bound values — **`series[].map` must name a registered map asset (ADR-0023). dvt bundles `USA` (US states + DC + Puerto Rico); other names need host-side registerMapAsset and render an explicit error until registered.** |
| `chart:custom` | ECharts custom (advanced) | `series[].renderItem` must be a registered `$dvtRef` — **Requires a renderItem function, which must be a registered $dvtRef (ADR-0016); raw functions cannot be expressed in a spec.** |
<!-- END generated chart-type table -->
| `metric-strip` | Row of KPI metric tiles | `metrics[]` (see below) |
| `kpi` | Single-value scorecard (one headline number + comparison + sparkline) | `valueField` (required), `agg`, `format`, `label`, `caption`, `comparison{…}`, `sparkline{…}` (see below) |
| `table` | Data table (dvt-native, portable) | `columns[]` — each `{ field, label?, format?, align?, sortable?, filterable? }`; omit for every query column in result order. `defaultSort{ field, direction }` seeds an initial sort; click-to-sort + per-column filter run client-side over the fetched rows (`sortable`/`filterable` default true). Row order follows the query `ORDER BY` unless `defaultSort` overrides it; `format` uses the shared format objects |
| `text` | Markdown narrative | `markdown`, `variant` (`plain`\|`callout`), `align` |
| `html` | Sanitized HTML/CSS escape hatch | `html` (see below) |
| `stat` | Big-number tile (hero-scale single value) | `valueField` (required), `agg`, `format`, `label`, `caption`, `delta`, `sparkline`, `align` (see below) |
| `hero` | Headline block (eyebrow + headline + subhead) | `headline` (required), `eyebrow`, `subhead`, `align`, `size` (`sm`\|`md`\|`lg`\|`xl`); text fields support `{{ … }}` variables (see below) |
| `media` | Image block (ADR-0014 escape hatch) | `src` (required, sanitized), `alt`, `fit` (`cover`\|`contain`\|`fill`), `rounded`, `caption` (see below) |
| `divider` | Visible rule line | `orientation`, `thickness`, `color`, `style` (`solid`\|`dashed`\|`dotted`), `inset` (see below) |

### Data binding

Each panel may set `data: { "sourceId": "...", "query": "SELECT ..." }`. The first
returned column is the category/label axis; subsequent columns are bound by
`series[].dataField` (chart) or `valueField` (metric/stacked). Charts that take an
explicit field mapping (scatter/heatmap) name their columns via `xField`/`yField`/etc.

**Always fully-qualify table names** as `database.schema.table` (e.g.
`SNOWFLAKE_SAMPLE_DATA.TPCH_SF1.ORDERS`). A connection may carry no default
database/schema — Snowflake service connections don't — so an unqualified
`FROM orders` fails; fully-qualified names are also deterministic regardless of
session/connection context and role defaults on every warehouse. Never rely on an
implicit current database/schema.

**Backend-free specs:** add `data.rows` (an array of row objects) and the panel
renders from those directly — **no engine, no warehouse, no live query.** This makes
a spec fully self-contained (great for demos, the `/builder`, and static hosting).
Keep `query` alongside `rows` so the SQL inspector still shows real SQL:

```json
"data": { "sourceId": "db", "query": "SELECT category, SUM(amount) AS revenue ...",
          "rows": [ { "category": "Software", "revenue": 1269315.62 } ] }
```

### metric-strip

```json
{ "type": "metric-strip", "title": "KPIs",
  "data": { "sourceId": "db", "query": "SELECT month, SUM(amount) AS revenue ... GROUP BY 1 ORDER BY 1" },
  "spec": { "metrics": [
    { "label": "Revenue", "valueField": "revenue", "agg": "sum",
      "format": { "type": "currency", "currency": "USD", "compact": true }, "color": "{chart.series.1}" }
  ] } }
```

`agg`: `sum | avg | last | first | min | max | count | delta`. The strip shows the
headline number, a ▲/▼ delta vs. the prior row, and a sparkline.

### kpi  ← single-value scorecard

A `kpi` is one headline number with an explicit period-over-period comparison and an
optional inline sparkline — the grid-native scorecard (the metric-strip tile, scaled
up and given a real comparison binding):

```json
{ "type": "kpi", "title": "Revenue",
  "data": { "sourceId": "db", "query": "SELECT month, SUM(amount) AS revenue, LAG(SUM(amount)) OVER (ORDER BY month) AS revenue_prev FROM analytics.public.orders GROUP BY 1 ORDER BY 1" },
  "spec": { "valueField": "revenue", "agg": "last",
    "format": { "type": "currency", "currency": "USD", "compact": true },
    "comparison": { "field": "revenue_prev", "mode": "percent", "improvement": "up" },
    "sparkline": { "field": "revenue" } } }
```

- **`valueField`** (required) + `agg` reduce the column to the headline (default `sum`).
- **`comparison`**: `{ field?, agg?, mode?, improvement? }`. With `field`, the comparison value is that column; omit `field` to compare the last two points of the value series. `mode`: `percent | delta | both` (default `percent`). `improvement`: `up` (default) or `down` — set `down` for metrics where lower is better (cost, churn) so the chip colors green/red semantically.
- **`sparkline`**: `{ field?, color? }` — needs ≥2 rows; `field` defaults to `valueField`. Omit for no trend line.
- `label`, `caption`, `color`, `align` (`left | center`) trim the chrome.

### text panels + narrative variables  ← dvt's differentiator

Text panels render markdown and **interpolate live values** from the panel's own
`data.query` using `{{ field | agg | format }}`:

```json
{ "type": "text", "title": "",
  "data": { "sourceId": "db", "query": "SELECT month, SUM(amount) AS revenue FROM analytics.public.orders GROUP BY 1 ORDER BY 1" },
  "spec": { "variant": "callout",
    "markdown": "Revenue reached **{{ revenue | sum | currency }}**, {{ revenue | delta | percent }} vs. last month." } }
```

- **agg ops:** `sum, avg, last, first, min, max, count, delta` (delta = % change of last two rows; defaults to percent format).
- **format ops:** `currency, percent, number, compact, date`.
- Omit the agg → `last`. Omit the format → plain number. Unknown/empty → `—`.

Use text panels to give every dashboard a thesis and takeaways — **explain the data, don't just plot it.**

### html panels  ← the escape hatch

When charts and text aren't enough — hero banners, gradient backdrops, big-number
tiles, badges, bespoke multi-column layouts — use an `html` panel. It renders raw
HTML/CSS, **sanitized** (DOMPurify: inline styles, gradients, `<svg>`, `<style>`,
classes are allowed; `<script>` and `on*` handlers are stripped). It also supports
the same `{{ field | agg | format }}` variables, so a hand-built hero can show live
numbers.

```json
{ "type": "html", "title": "",
  "data": { "sourceId": "db", "query": "SELECT SUM(amount) AS revenue FROM analytics.public.orders",
            "rows": [ { "revenue": 2803054.22 } ] },
  "spec": { "html": "<div style=\"height:100%;display:flex;align-items:center;justify-content:space-between;padding:24px 30px;border-radius:16px;background:linear-gradient(120deg,#EEF0FF,#E9F7F5);\"><div style=\"font-size:26px;font-weight:800;color:var(--ink);\">Revenue Overview</div><div style=\"font-size:42px;font-weight:800;color:var(--accent);\">{{ revenue | sum | currency }}</div></div>" } }
```

The theme is exposed to your CSS as variables: `var(--accent)`, `var(--accent-2)`,
`var(--ink)`, `var(--muted)` — use them so escape-hatch markup stays on-palette.
text/html panels are **bare** (transparent) by default so they paint their own
surface; set `overrides["panel.background"]` if you want a card behind them.

### canvas blocks — `stat` · `hero` · `media` · `divider`

Composition blocks for richer layouts (designed for `layout.mode: "canvas"`
sections, but valid in a grid too). All dvt Core (renderer-neutral) except `media`
(an ADR-0014 escape hatch). All are **bare** by default.

**`stat`** — a big-number tile (the hero-scale sibling of a metric-strip tile, same
count-up + delta primitive). Use it for a single headline figure that needs to read
large. The DVT-133 `kpi` is the grid scorecard with an explicit comparison binding;
reach for `stat` when you just want the number big.

```json
{ "type": "stat", "title": "",
  "data": { "sourceId": "db", "query": "SELECT month, SUM(amount) AS revenue FROM analytics.public.orders GROUP BY 1 ORDER BY 1" },
  "spec": { "label": "Revenue", "valueField": "revenue", "agg": "sum",
    "format": { "type": "currency", "currency": "USD", "compact": true },
    "delta": true, "sparkline": true, "align": "center" } }
```

`valueField` (required) + `agg` (default `sum`); `delta`/`sparkline` are booleans
(need ≥2 rows); `label`, `caption`, `color`, `align` (`left | center`).

**`hero`** — a headline block (eyebrow + headline + subhead) to open a canvas section.
The three text fields interpolate `{{ field | agg | format }}` variables.

```json
{ "type": "hero", "title": "",
  "data": { "sourceId": "db", "query": "SELECT SUM(amount) AS revenue FROM analytics.public.orders" },
  "spec": { "eyebrow": "FY25", "headline": "{{ revenue | sum | currency }} in revenue",
    "subhead": "Up and to the right.", "align": "center", "size": "xl" } }
```

`headline` (required); `eyebrow`, `subhead`; `align` (`left | center | right`);
`size` (`sm | md | lg | xl`, default `lg`).

**`media`** — an image block (escape hatch). `src` is **sanitized** (media-safety):
a same-origin relative path, a dvt-hosted `https` asset, or a raster `data:` URI —
anything else is rejected.

```json
{ "type": "media", "title": "",
  "spec": { "src": "/assets/logo.png", "alt": "Company logo", "fit": "contain", "rounded": 12 } }
```

`src` (required); `alt`; `fit` (`cover | contain | fill`, default `cover`);
`rounded` (`true` → 12px, a number → px, `false` → square); `caption`.

**`divider`** — a visible rule line (a pure spacer needs no block — just leave empty
geometry). `orientation` (`horizontal | vertical`, default horizontal); `thickness`
(px, default 1); `style` (`solid | dashed | dotted`); `color`; `inset` (px, shortens
the rule from both ends).

## Theme & tokens (the customization engine)

Tokens are a 3-tier tree (`primitive` → `semantic` → `component`). Any value may be
a literal (`"#4F46E5"`) or a reference (`"{color.brand-indigo}"`). Change one
primitive and every chart updates. Useful tokens:

- `chart.series.1..6` — the series palette (drives chart colors automatically)
- `chart.axis.label.color`, `chart.grid.line.color`, `chart.axis.line.color` — chart chrome (retint these on dark surfaces)
- `heatmap.low`, `heatmap.high` — heatmap value ramp endpoints
- `page.background` — the canvas behind panels (or set `page.background` per page via `pages[].background`)
- `panel.background`, `panel.border.color`, `panel.radius`, `panel.shadow` — per-card chrome
- `panel.title.size`, `panel.title.weight`
- `text.primary`, `text.secondary`, `text.muted`
- `typography.fontFamily`

**Per-panel overrides:** any panel may set `"overrides": { "panel.background": "#0F1E2E", "text.primary": "#E8EEF5", "chart.axis.label.color": "#8DA2B8", "chart.grid.line.color": "rgba(255,255,255,0.06)", "chart.series.1": "#5BBFBA" }`
to restyle just that card. This is how you make one panel dark, recolor a single
chart, or retint axes/gridlines — without touching the rest. A dark page is just a
gradient `pages[].background` plus a shared dark `overrides` block on each card.

## Formats

`format` objects compile to number formatters: `{ "type": "currency"|"percentage"|"number"|"compact"|"date", "currency": "USD", "decimals": 0, "compact": true }`.
Place them where a value is rendered, e.g. `"axisLabel": { "format": {...} }` or on a metric.

## Authoring method — audit, narrate, design, verify

Don't jump straight to charts. A dashboard that just "plots the data" reads flat and
forgettable. Work in four passes; each one constrains the next. **The first pass is
analytical, not visual** — that's what separates a compelling dashboard from a
technically-correct but boring one.

### 1. Audit the data first — what's actually interesting?

Before choosing a single chart, profile the source so you build on signal, not noise.
Run small profiling queries (always fully-qualified — `database.schema.table`):

- **Shape & variance:** `SELECT count(*), count(distinct <dim>), min(<m>), max(<m>), avg(<m>), stddev(<m>) FROM …`. A dimension whose categories all carry ~equal measures has **no story** — a bar chart of it is flat. (TPC-H is uniformly distributed this way: orders per nation/segment barely differ. Notice that and do **not** lead with it.)
- **Distribution & outliers:** percentiles or a histogram-bucket query. Skew, long tails, and concentration ARE the story.
- **Time:** if there's a date column, pull the trend and the period-over-period delta — time series almost always has shape.
- **Concentration:** top-N share / Pareto (does ~20% of X drive ~80% of Y?).
- **Quality caveats:** null rates, tiny-N categories, a partial current period. Note them; never silently chart misleading numbers.

Prefer cuts with real variance — **time series, distributions, comparisons of unlike things, concentration, and change** — over flat categoricals. If the only available cut is uniform, **reframe the question** rather than drawing a boring bar.

### 2. Narrative — one key message, answer-first

- State the **single key message** in `meta.brief`: one sentence that is the *answer*, not the topic. If you can't write it, you don't understand the data yet — go back to step 1.
- **Answer-first (Minto / SCQA):** lead with the conclusion, then the support. The first page and the top-left panel carry the headline; detail comes after.
- **One question per page.** Order pages and panels so a reader gets the answer in the first few seconds and can drill into "why" below.
- Open each page with a `text` panel stating that page's takeaway, using live `{{ field | agg | format }}` variables so the prose moves with the data.

### 3. Design — encoding and layout in service of the message

- **Match the chart to the analytical task,** not to variety: trend → line/area; comparison → bar; distribution → histogram/box; relationship → scatter; part-to-whole → a few bars or a single donut (not a wall of pies); flow → sankey; concentration → sorted bar / Pareto. (See Panel types; avoid passthrough types that need inline data when binding a live query.)
- **Reserve color for signal** — the primary series, a delta, an outlier. Everything else stays neutral. Keep series colors as `{chart.series.N}` so the theme drives them.
- **Make the headline preattentive:** put the number that matters at the top, larger, with the one accent color; supporting charts recede.
- **Group and align** related panels; keep ≤ ~8–12 per page. Don't crowd — the renderer adapts label density to panel width automatically, so trust it instead of cramming.

### 4. Build, then SEE it — verify and iterate

1. Write the spec (mechanics above). Bind each panel to a fully-qualified `query`.
2. Validate with `dvt_spec_validate` — fix field errors and heed `warnings` (typos, and panels that will render EMPTY).
3. **Render and actually look at it:** `dvt_dashboard_render_inline` at desktop (`width` ~1280–1440) AND mobile (`width` ~390–414), for each `page`. Read the image: is there a clear headline? Any unreadable text, squished labels, empty panels, flat bars? Does it answer the question?
4. Iterate on what you saw, then save via the API / MCP. **Don't ship a dashboard you haven't looked at.**

## Rules

- No JS functions in specs — use `format` objects and the `{ "$dvtRef": "formatter:pie-label" }` ref instead.
- Every `layout.items[*].i` must match a panel `id`.
- Keep series colors as `{chart.series.N}` refs so the theme stays consistent.
- Prefer `pages` for anything with more than ~8 panels.
- Always fully-qualify table names in `data.query` as `database.schema.table` — connections may carry no default database/schema.

The machine-readable JSON Schema lives at `spec/schema/dashboard.schema.json` in the dvt repo — validate against it when in doubt.
