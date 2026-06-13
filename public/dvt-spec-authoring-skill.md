---
name: dvt-spec-author
description: Author and edit dvt dashboard specs (JSON). Use when a user wants to create, modify, or theme a dvt dashboard, or convert a question/data into a dashboard.
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
| `metric-strip` | KPI scorecards | `metrics[]` (see below) |
| `table` | Data table (dvt-native, portable) | `columns[]` — each `{ field, label?, format?, align? }`; omit for every query column in result order. Ordering is the SQL `ORDER BY`; `format` uses the shared format objects |
| `text` | Markdown narrative | `markdown`, `variant` (`plain`\|`callout`), `align` |
| `html` | Sanitized HTML/CSS escape hatch | `html` (see below) |

### Data binding

Each panel may set `data: { "sourceId": "...", "query": "SELECT ..." }`. The first
returned column is the category/label axis; subsequent columns are bound by
`series[].dataField` (chart) or `valueField` (metric/stacked). Charts that take an
explicit field mapping (scatter/heatmap) name their columns via `xField`/`yField`/etc.

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

### text panels + narrative variables  ← dvt's differentiator

Text panels render markdown and **interpolate live values** from the panel's own
`data.query` using `{{ field | agg | format }}`:

```json
{ "type": "text", "title": "",
  "data": { "sourceId": "db", "query": "SELECT month, SUM(amount) AS revenue FROM orders GROUP BY 1 ORDER BY 1" },
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
  "data": { "sourceId": "db", "query": "SELECT SUM(amount) AS revenue FROM orders",
            "rows": [ { "revenue": 2803054.22 } ] },
  "spec": { "html": "<div style=\"height:100%;display:flex;align-items:center;justify-content:space-between;padding:24px 30px;border-radius:16px;background:linear-gradient(120deg,#EEF0FF,#E9F7F5);\"><div style=\"font-size:26px;font-weight:800;color:var(--ink);\">Revenue Overview</div><div style=\"font-size:42px;font-weight:800;color:var(--accent);\">{{ revenue | sum | currency }}</div></div>" } }
```

The theme is exposed to your CSS as variables: `var(--accent)`, `var(--accent-2)`,
`var(--ink)`, `var(--muted)` — use them so escape-hatch markup stays on-palette.
text/html panels are **bare** (transparent) by default so they paint their own
surface; set `overrides["panel.background"]` if you want a card behind them.

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

## Authoring workflow

1. Decide the **key message** (set `meta.brief`) and the 2–4 questions the dashboard answers.
2. Lead with a `text` panel stating the thesis with live `{{ }}` variables, then KPIs, then supporting charts.
3. Bind each panel to a `query`; keep ≤ ~12 elements per page; put primary KPIs at the top.
4. Theme with tokens; reserve color for signal (deltas, the primary series).
5. Paste into the **dvt Spec Builder** to validate and preview, then save via the API / MCP.

## Rules

- No JS functions in specs — use `format` objects and the `{ "$dvtRef": "formatter:pie-label" }` ref instead.
- Every `layout.items[*].i` must match a panel `id`.
- Keep series colors as `{chart.series.N}` refs so the theme stays consistent.
- Prefer `pages` for anything with more than ~8 panels.

The machine-readable JSON Schema lives at `spec/schema/dashboard.schema.json` in the dvt repo — validate against it when in doubt.
