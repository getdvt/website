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
  "tabBar": { "position": "top", "layout": "horizontal", "alignment": "start", "size": "md" },
  "cache": { "ttlSeconds": 600, "enabled": true }
}
```

- Use **`pages`** for multi-tab dashboards; each page has its own `layout` + `panels`.
  (If you use `pages`, the top-level `panels`/`layout` can be empty.)
- **`tabBar`** (optional) configures the page-tab navigation control for a multi-page
  dashboard — declaratively, no callbacks. It renders in the editor, the chrome-less
  `/present` viewer, and full-bleed **canvas** dashboards; single-page dashboards render
  **no tab chrome**. Fields (all optional, sensible defaults):
  - **`position`** — `top` (default) · `bottom` · `left` · `right` · `free`. `left`/`right`
    dock a vertical rail; `free` **floats** the bar over the content at `placement` (the
    natural choice for a full-bleed canvas dashboard, which reserves no edge gutter).
  - **`layout`** — `horizontal` (default, a row) · `vertical` (a column) · `stacked`
    (a row that wraps onto multiple lines when the tabs overflow).
  - **`alignment`** — `start` (default) · `center` · `end` · `justify`.
  - **`size`** — `sm` · `md` (default) · `lg`.
  - **`placement`** — `{ "x": 0-100, "y": 0-100 }`, a percentage offset from the top-left
    of the viewport. Only used when `position: "free"`; ignored otherwise.
  Example (a centered floating bar for a canvas deck):
  `"tabBar": { "position": "free", "layout": "stacked", "alignment": "center", "size": "md", "placement": { "x": 50, "y": 4 } }`
- **`cache`** (optional) tunes how long this dashboard's query results may be reused
  before re-querying the warehouse. `ttlSeconds` is the freshness window (e.g. `600`
  = up to 10 min stale); `0` or `"enabled": false` means **always live**. Omit it to
  use the org default (10 min). Results are cached per `(source, query, params,
  viewer-role)` and never shared across identities; viewers can always force a live
  refresh from a panel's refresh control. Raise it for slow/expensive dashboards that
  don't need to be real-time; set it live for operational dashboards.
- **`page.background`** (per page) takes any CSS background — a solid, a `linear-gradient(...)`,
  a `radial-gradient(...)`, or an image. Use it to make each page its own visual "world."
- **`layout.items`** is keyed by breakpoint (`lg`, `md`, `sm`, `xs`). Each item:
  `{ "i": panelId, "x", "y", "w", "h" }` on a 24-column grid. `rowHeight` is ~30px;
  a KPI strip ≈ `h:4`, a chart ≈ `h:7–8`. Author `lg` always. Below a 640px-wide
  container the renderer stacks the `lg` panels into one full-width column in
  reading order — author `sm`/`xs` items (with `layout.breakpoints`) only when you
  want to hand-tune that narrow view; they win over the automatic stack. (`md` is
  not consulted for narrow stacking.)
- **`layout.mode`** defaults to `"grid"` (the 24-column grid above). Set
  `"mode": "canvas"` for an immersive, full-bleed, scroll-driven layout (sections +
  free-form blocks + motion) — see **Canvas mode** below. One spec, two layout shapes.

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
| `chart:map` | ECharts map (advanced) | `series[].map` names a registered map asset (bundled: `USA`, `world`); (name, value) rows bind automatically, `labelField`/`valueField` override; `visualMap` min/max auto-fill from bound values. For data-driven geography set `geoField` to a GeoJSON-geometry column (e.g. a Snowflake GEOGRAPHY/GEOMETRY column) and the query rows build a per-panel inline map — no named asset needed (DVT-153) — **`series[].map` must name a registered map asset (ADR-0023). dvt bundles `USA` (US states + DC + Puerto Rico) and `world` (country boundaries, region name on `properties.name`); other names need host-side registerMapAsset and render an explicit error until registered. For data-driven geography, set `geoField` to a column carrying GeoJSON geometry (e.g. a Snowflake GEOGRAPHY/GEOMETRY column, returned as GeoJSON by the engine) — the rows build a per-panel inline map, so no named asset is needed (DVT-153).** |
| `chart:custom` | ECharts custom (advanced) | `series[].renderItem` must be a registered `$dvtRef` — **Requires a renderItem function, which must be a registered $dvtRef (ADR-0016); raw functions cannot be expressed in a spec.** |
| `chart:bar:racing` | ECharts bar (advanced) | `animation.frameField` (required — the time column), `categoryField` (entity identity, stable across frames so bars slide not pop), `valueField` (measure); optional `animation.{speeds,speedDefault,loop,controls.placement}`, top-N via `yAxis.max` — **Animated 'bar chart race' (ADR-0034). dvt Full / non-portable. Requires an `animation` block with `frameField` (the time/sequence column); `categoryField` is the stable entity identity that slides between frames and `valueField` the measure. One query returns all frames stacked in rows; the client iterates in-browser — no per-frame query. Top-N via `yAxis.max`. Renders to a static poster (last frame) in exports (ADR-0024).** |
| `chart:line:racing` | ECharts line (advanced) | `animation.frameField` (required — the x/time column), `valueField` (y measure), optional `seriesField` (multi-line split); `animation.{speeds,speedDefault,loop,controls.placement}` — **Animated progressive / 'racing' line (ADR-0034). dvt Full / non-portable. Requires an `animation` block with `frameField` (the x/time column the line draws along); optional `seriesField` splits multiple lines, `valueField` is the y measure. One query, the client iterates frames as a cumulative slice — no per-frame query. Renders to a static poster (last frame) in exports (ADR-0024).** |
| `chart:geo:animated` | ECharts map (advanced) | `animation.frameField` (required — the period column), `series[].map` (registered asset, e.g. `USA`), `labelField`/`valueField` (region, measure) or `geoField` for data-driven geometry; `visualMap` auto-fills from values — **Animated choropleth over a time dimension (ADR-0034), built on the native ECharts `timeline` + `visualMap`. dvt Full / non-portable. Requires `animation.frameField` (the period column) and a registered map asset (`series[].map`, ADR-0023); `labelField`/`geoField` name the region, `valueField` the measure. Choropleth fills JUMP between periods (no color interpolation) — use smaller deltas / more frames. One query, the client iterates. Renders to a static poster (last frame) in exports (ADR-0024).** |
<!-- END generated chart-type table -->
| `metric-strip` | Row of KPI metric tiles | `metrics[]` (see below) |
| `kpi` | Single-value scorecard (one headline number + comparison + sparkline) | `valueField` (required), `agg`, `format`, `label`, `caption`, `comparison{…}`, `sparkline{…}` (see below) |
| `table` | Data table (dvt-native, portable) | `columns[]` — each `{ field, label?, format?, align?, sortable?, filterable? }`; omit for every query column in result order. `defaultSort{ field, direction }` seeds an initial sort; click-to-sort + per-column filter run client-side over the fetched rows (`sortable`/`filterable` default true). Row order follows the query `ORDER BY` unless `defaultSort` overrides it; `format` uses the shared format objects. `grouping{ groupBy[], aggregations[]{field,agg}, subtotals?, grandTotal?, defaultExpanded? }` collapses rows into a grouped tree with subtotal/grand-total rows — computed client-side over the fetched rows (no re-query, no SQL rewrite), `groupBy` order = nesting levels, `agg` ∈ sum/avg/min/max/count (default sum) |
| `text` | Markdown narrative | `markdown`, `variant` (`plain`\|`callout`), `align` |
| `html` | Sanitized HTML/CSS escape hatch | `html` (see below) |
| `stat` | Big-number tile (hero-scale single value) | `valueField` (required), `agg`, `format`, `label`, `caption`, `delta`, `sparkline`, `align` (see below) |
| `hero` | Headline block (eyebrow + headline + subhead) | `headline` (required), `eyebrow`, `subhead`, `align`, `size` (`sm`\|`md`\|`lg`\|`xl`); text fields support `{{ … }}` variables (see below) |
| `media` | Image block (ADR-0014 escape hatch) | `src` (required, sanitized), `alt`, `fit` (`cover`\|`contain`\|`fill`), `rounded`, `caption` (see below) |
| `divider` | Visible rule line | `orientation`, `thickness`, `color`, `style` (`solid`\|`dashed`\|`dotted`), `inset` (see below) |
| `filter` | Interactive control whose selected value re-queries target panels | `param` (required unless a range), `valueField` (required), `labelField`, `control` (`select`\|`multiselect`\|`date-range`\|`number-range`\|`search`), `valueType`, `targets`, `values`, `default`, `allLabel`, `unsetMode` (`omit`\|`null`), `operator` (`equals`\|`not-equals`\|`contains`\|`starts-with`\|`ends-with`\|`in`\|`not-in`\|`between`); **range** (`between` / `number-range` / `date-range`): `loParam`+`hiParam` (required, replace `param`), `min`, `max`, `step`; **date** (`date-range`): `relativeDate` (`{lo?,hi?}`, each `{unit,amount,direction}`), `presets` (`today`\|`last-7d`\|`last-30d`\|`last-90d`\|`mtd`\|`qtd`\|`ytd`\|`all-time`), `timezone` (IANA, default `UTC`) (see Filters & drill-downs) |
| `container` | Tabbed container — one page region holding several panel sets behind tabs (layout primitive, not a chart) | `spec.layout: "tabs"` (required), `tabs[]` (required) each `{ id, label, panels:[childId…], layout }`, `defaultTab?`. **Children stay real elements in `panels[]`** referenced by id (never inlined); each tab carries its own mini 24-col `layout`, and the container itself occupies one cell in the page grid. Children are NOT in the page grid. Single level only (no tabs-in-tabs). NOT the same as page-level tabs (`pages[]`+`tabBar`). The semantic validator rejects missing refs / a child placed twice / a child also in the page grid / nesting / a bad `defaultTab` / a tab id that collides with a panel id |

Any panel can also carry a `drill` object (left-click navigate) and/or a `contextMenu` object (right-click action menu) — neither is a `type`; see **Filters & drill-downs**.

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

**Write SQL in the canonical dvt style.** Leading commas, lowercase keywords, a
`where 1=1` guard — clean diffs, and a missing comma is a one-line error:

```sql
select alias1.field1
    , alias1.field2
    , sum(alias2.field3) as total_field3s
from tablea as alias1
inner join tableb as alias2
    on alias1.key1 = alias2.key1
    and alias1.key2 = alias2.key2
where 1=1
    and alias1.region = %(region)s
group by alias1.field1
    , alias1.field2
```

Rules: lowercase keywords; one field per line with **leading** commas; explicit
`as` on every table alias and alias-qualified columns; `inner/left join` with `on`
then indented `and` predicates; `where 1=1` guard then each predicate as an
indented `and ...`; `group by` mirrors the select list. Parameter-bound predicates
use named `%(key)s` bindings (ADR-0028) — never string-interpolate values into the
SQL. Full reference: `docs/02-spec/sql-style-guide.md`.

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

### Filters & drill-downs — interactive parameter binding (ADR-0028)

Both make a dashboard interactive by binding a value into target panels **by name**:
the value overwrites a matching `data.params` entry — it is **never** interpolated
into the SQL string and never a column/identifier. So the contract is the same for
both, and a target panel must declare **two** things:

1. a **named placeholder** `%(param)s` in its `data.query`, and
2. a matching **`data.params`** default for that key (the slot the value overwrites).

A binding whose param no target panel declares is wired to nothing — it renders fine
but does nothing at runtime, and `dvt_spec_validate` warns about it. A
`multiselect` control binds an **array** of selected values into an `IN`-list:
write a bare named placeholder `WHERE region IN %(region)s` (no parens) and the
engine expands it to one parameter-bound placeholder per selection — values are
never spliced into SQL. **Clearing a multi-select to 0 selected = unset** ("show
everything"), resolved per `unsetMode` below — not "show nothing" (ADR-0028
Amendment 1).

**`filter`** — a dashboard-level control (its own panel). The selectable options come
from the panel's own `data` (a `SELECT DISTINCT` value query, or baked `data.rows`),
or from a static `values` list. Selecting a value re-queries the target panels.

```json
{ "id": "region-filter", "type": "filter", "title": "Region",
  "data": { "sourceId": "db", "query": "SELECT DISTINCT region FROM demo.public.orders ORDER BY 1" },
  "spec": { "param": "region", "valueField": "region", "control": "select",
            "valueType": "string", "targets": "all", "default": "NA" } }
```

```json
{ "id": "rev-by-month", "type": "chart:bar", "title": "Revenue by Month",
  "data": { "sourceId": "db",
            "query": "SELECT month, SUM(amount) AS rev FROM demo.public.orders WHERE region = %(region)s GROUP BY 1 ORDER BY 1",
            "params": { "region": "NA" } },
  "spec": { "series": [{ "type": "bar", "dataField": "rev" }] } }
```

`param` (required) — the params key this filter sets. `valueField` (required) — the
value-source column holding each option's bound value; `labelField` defaults to it.
`control`: `select` (default) | `multiselect` (binds an array → `IN`-list; the
target query uses a bare `IN %(param)s`) | `date-range` | `number-range` | `search`. `valueType`:
`string` (default) | `number` | `date` | `boolean`. `targets`: `"all"` (default — every
panel on the page that declares the key) or an explicit `["panelId", …]`; a panel that
doesn't declare the key is never re-fetched. `values` — a static `[value | { value, label }]`
list (the fallback when there's no value query/rows). `default` — the initial selection.

**The unfiltered / "everything" state (`allLabel` + `unsetMode`, ADR-0028
Amendment 1).** Don't hand-roll an `'ALL'` option row plus a
`(%(k)s = 'ALL' OR col = %(k)s)` SQL hack — the control renders the "All" affordance
for you. Two fields:

- `allLabel` — the display text for the unset state (e.g. `"All regions"`, `"Any
  date"`). Falls back to `placeholder`, then `"All"`. The single-select **All row**
  and the multi-select **0-selected** state are control affordances, not data rows.
- `unsetMode` — how an unset filter binds:
  - `"omit"` (default) — the key is **not set**, so each target panel keeps its
    **authored `params` default**. Author writes plain `WHERE col = %(k)s`. Use when
    there's a natural default value.
  - `"null"` — the key binds **SQL NULL**. Author writes the guarded predicate
    `WHERE (%(k)s IS NULL OR col = %(k)s)`. Use for "show everything by default", for
    `IN`-list multi-selects (`WHERE (%(k)s IS NULL OR col IN %(k)s)`), and it is
    **required** for open-ended range sides.

```json
{ "id": "region-filter", "type": "filter", "title": "Region",
  "data": { "sourceId": "db", "query": "SELECT DISTINCT region FROM demo.public.orders ORDER BY 1" },
  "spec": { "param": "region", "valueField": "region", "control": "select",
            "allLabel": "All regions", "unsetMode": "null", "targets": "all" } }
```

…with the target panel guarding the param so unset = everything:
`WHERE (%(region)s IS NULL OR region = %(region)s)`. Unset is **omit or typed NULL
only** — never a sentinel string or client-built SQL.

**The comparison operator (`operator`, ADR-0028 Amendment 1).** `operator` is
**author-fixed** spec state — it tells the renderer how to *shape the bound value*
(e.g. wrap a `contains` term in `%…%`), it is **not** a control a viewer toggles, and
it **never** changes the SQL. You write the matching, fixed predicate yourself; the
value still enters SQL only as a bound `%(k)s` parameter (never interpolated). Default
`equals`.

| `operator` | you write this predicate | the value the viewer types is bound as |
|---|---|---|
| `equals` (default) | `WHERE col = %(k)s` | the value as-is |
| `not-equals` | `WHERE col <> %(k)s` | the value as-is |
| `contains` | `WHERE col LIKE %(k)s ESCAPE '!'` | `%value%` (LIKE metachars `! % _` escaped) |
| `starts-with` | `WHERE col LIKE %(k)s ESCAPE '!'` | `value%` |
| `ends-with` | `WHERE col LIKE %(k)s ESCAPE '!'` | `%value` |
| `not-in` | `WHERE col NOT IN %(k)s` | an array → parameter-bound `NOT IN`-list |
| `in` / `between` | (multiselect / range — see those controls) | array / two bounds |

**Required for the LIKE operators** (`contains` / `starts-with` / `ends-with`): your
query **must** carry the `ESCAPE '!'` clause. The renderer escapes `!`, `%`, and `_`
in the viewer's value with `!` so a typed `%` or `_` matches **literally** (not as a
wildcard). The `!` escape character is fixed on both sides — write it verbatim. The
text control shows the operator verb (e.g. `Customer  contains`) next to the label so
viewers see the match kind; a viewer who needs both `equals` and `contains` on one
column gets **two** filters (operator switching is author-time only).

```json
{ "id": "customer-search", "type": "filter", "title": "Customer",
  "data": { "sourceId": "db", "query": "SELECT DISTINCT customer FROM demo.public.orders ORDER BY 1" },
  "spec": { "param": "customer", "valueField": "customer", "control": "search",
            "operator": "contains", "unsetMode": "null", "targets": "all" } }
```

…with the target panel: `WHERE (%(customer)s IS NULL OR customer LIKE %(customer)s ESCAPE '!')`.

**Number range (`control: "number-range"`, `operator: "between"`, ADR-0028 Amendment 1
— DVT-257).** A range filter binds **two** values, so it uses **two author-declared
keys** — `loParam` and `hiParam` — instead of the single `param` (for a range,
`param` is **forbidden** and `loParam`+`hiParam` are **required**). They are ordinary
`data.params` keys (no `__lo`/`__hi` magic suffix): you declare both and write the
predicate. The renderer shows a dual-thumb slider (domain from `min`/`max`, or derived
from a `MIN()`/`MAX()` value-source query, stepped by `step`) plus paired min/max
numeric inputs. The two values bind as named scalar parameters — never interpolated,
never a list — so the engine is unchanged.

**Open-ended (one side blank) is required to work**, so write the **null-tolerant
guarded predicate** and set `unsetMode: "null"` (required for ranges): an unset side
binds typed **NULL**, which the guard reads as "no bound on that side."

```json
{ "id": "amount-range", "type": "filter", "title": "Order amount",
  "data": { "sourceId": "db", "query": "SELECT MIN(amount) AS amount, MAX(amount) AS amount FROM demo.public.orders" },
  "spec": { "control": "number-range", "operator": "between", "valueField": "amount",
            "valueType": "number", "loParam": "amount_lo", "hiParam": "amount_hi",
            "min": 0, "max": 50000, "step": 1000,
            "unsetMode": "null", "allLabel": "Any amount", "targets": "all" } }
```

…with the target panel writing the dual-guarded predicate and declaring **both** keys:

```sql
WHERE (%(amount_lo)s IS NULL OR amount >= %(amount_lo)s)
  AND (%(amount_hi)s IS NULL OR amount <= %(amount_hi)s)
```

`"params": { "amount_lo": null, "amount_hi": null }`. A blank min **or** max is
open-ended on that side; an **inverted** range (min above max) binds faithfully and
simply matches no rows (the renderer never silently swaps the bounds).

**Date range (`control: "date-range"`, ADR-0028 Amendment 1 A2.3/A5 — DVT-256).** A
date filter is a range, so it binds the **same two author-declared keys** as a number
range — `loParam` + `hiParam` (the scalar `param` is **forbidden**; declare both keys
and write the dual-guarded predicate, exactly like the number range above). What it
adds is **relative** windows that resolve to concrete dates:

- **`relativeDate`** — `{ lo?, hi? }`, where each end is
  `{ unit: "day" | "week" | "month" | "quarter" | "year", amount: <int ≥ 0>, direction: "past" | "future" }`.
  `amount: 0` = the anchor ("today"). An omitted end is **open-ended** on that side.
  Example: last 30 days = `lo: { unit:"day", amount:30, direction:"past" }`,
  `hi: { unit:"day", amount:0, direction:"past" }`.
- **`presets`** — an allow-list of quick-pick chips, a subset (in your order) of:
  `today`, `last-7d`, `last-30d`, `last-90d`, `mtd`, `qtd`, `ytd`, `all-time`.
  `all-time` clears both bounds (fully open).
- **`timezone`** — an IANA zone (e.g. `"America/New_York"`, default `"UTC"`) that
  defines what "today" / day boundaries mean. **This is your authored basis, not the
  viewer's locale** — the dashboard resolves identically for every viewer.

**How relative dates resolve (the contract you can rely on).** A relative window
resolves to **absolute** dates that bind as ordinary `date` params — never
interpolated, never the warehouse `CURRENT_DATE`. "Now" is sampled **once per
dashboard load** and the resolution uses your `timezone`, so "last 7 days" always
means the same 7 days for everyone viewing at the same moment. Crucially, a shared
link / reload encodes the **relative expression** (e.g. "last 30 days"), not the
resolved dates — so the recipient re-resolves against **their** current "now" and a
link stays meaningfully relative. The viewer can also switch to **Absolute** mode and
pick literal dates (those are fixed, and encode as-is). Either side blank/disabled =
open-ended, so write the same null-tolerant guard and `unsetMode: "null"` as a number
range.

```json
{ "id": "date-range", "type": "filter", "title": "Order date",
  "data": { "sourceId": "db", "query": "SELECT MIN(order_date) AS order_date, MAX(order_date) AS order_date FROM demo.public.orders" },
  "spec": { "control": "date-range", "valueField": "order_date", "valueType": "date",
            "loParam": "order_date_lo", "hiParam": "order_date_hi",
            "unsetMode": "null", "allLabel": "Any date", "timezone": "America/New_York",
            "relativeDate": { "lo": { "unit": "day", "amount": 30, "direction": "past" },
                              "hi": { "unit": "day", "amount": 0, "direction": "past" } },
            "presets": ["today", "last-7d", "last-30d", "mtd", "qtd", "ytd", "all-time"],
            "targets": "all" } }
```

…with the target panel writing the dual-guarded date predicate and declaring **both**
keys (`"params": { "order_date_lo": null, "order_date_hi": null }`):

```sql
WHERE (%(order_date_lo)s IS NULL OR order_date >= %(order_date_lo)s)
  AND (%(order_date_hi)s IS NULL OR order_date <= %(order_date_hi)s)
```

**`drill`** — a property on **any** panel (not a `type`). Clicking a mark/row navigates
to `targetPage` with the clicked value bound, by name, into that page's panels — the same
value→query contract as a filter.

```json
{ "id": "rev-by-region", "type": "chart:bar", "title": "Revenue by Region",
  "data": { "sourceId": "db", "query": "SELECT region, SUM(amount) AS rev FROM demo.public.orders GROUP BY 1" },
  "drill": { "targetPage": "region-detail", "param": "region", "valueFrom": "category", "valueType": "string" },
  "spec": { "series": [{ "type": "bar", "dataField": "rev" }] } }
```

The `region-detail` page's panels declare `%(region)s` + a `data.params` `region` default,
exactly like the filter targets above. `targetPage` (required) — a `pages[].id`. `param`
(required) — the params key set on the target page's panels. `valueFrom`: `category`
(default) | `value` | `seriesName` | a field name from the clicked row (use a field name
for tables). `valueType` — as above.

**`contextMenu`** — a property on **any** panel (and, additively, on any `table` column,
ADR-0032). Where `drill` is the single left-click quick-path, `contextMenu` is the
**right-click menu**: an ordered `actions[]` list, each parameterized by the clicked
mark/row, that turns a dashboard from read-only into explorable. Like `filter`/`drill` it
is interactive-only (a no-op in a static PNG render). Five action types:

```json
{ "id": "rev-by-region", "type": "chart:bar", "title": "Revenue by Region",
  "data": { "sourceId": "db", "query": "SELECT region, SUM(amount) AS rev, region_id FROM demo.public.orders GROUP BY 1, 3" },
  "spec": { "series": [{ "type": "bar", "dataField": "rev" }] },
  "contextMenu": { "actions": [
    { "type": "filter", "label": "Filter page to {category}", "param": "region", "valueFrom": "category" },
    { "type": "drill",  "label": "Open {category} detail", "targetPage": "region-detail", "param": "region", "valueFrom": "category" },
    { "type": "link",   "label": "Open {category} in CRM", "url": "https://crm.example.com/regions/{region_id}", "target": "tab" },
    { "type": "copy",   "label": "Copy value", "copy": "value" },
    { "type": "export", "label": "Export this row", "format": "csv", "scope": "row" }
  ] } }
```

- Every action has `type` (the discriminator), `label` (required — supports `{token}`
  templates), optional `icon`, and optional `when: { field }` (show the action only when
  the clicked datum has a non-null value for `field` — e.g. "Open in CRM" only on rows
  with an account id).
- **`{token}` templates** in `label` (and `link.url`): `{category}`, `{value}`,
  `{seriesName}`, and `{<field>}` for any field of the clicked row. On **tables** every
  field works. On **charts**, `{category}`/`{value}`/`{seriesName}` always work; arbitrary
  `{<field>}` / `valueFrom:<field>` resolve the clicked mark's source row on row-per-mark
  charts (bar, line, area, scatter, pie) — for a pivoting stacked/multi-series chart, bind
  from `category`/`value`/`seriesName` instead.
- **`filter`** — cross-filters the **current** page (no navigation): `param` (required),
  `valueFrom?` (default `category`), `valueType?`, `targets?` (`"all"` | panel-id list).
  Same value→query binding + targeting as a `filter` control.
- **`drill`** — navigates to a page: `targetPage` + `param` (required), `valueFrom?`,
  `valueType?`. One menu can hold several drill destinations (the bare `drill` property
  holds only one); the two coexist.
- **`link`** — opens an external URL. Scheme must be `https` | `mailto` | `tel`
  (`javascript:`/`data:`/`http:` are rejected). Token values are URL-encoded, and a
  `{token}` may appear only in the path/query/fragment — never in the scheme or host (so
  `https://{host}/…` is rejected). `target?`: `tab` (default, opens a new tab with
  `noopener`/`no-referrer`) | `self`. A missing token disables the action.
- **`copy`** — `copy?`: `value` (default) | `row` (tab-separated) | a field name. Client-only.
- **`export`** — `scope?`: `row` (default, the clicked row client-side) | `result` (the
  panel's full result via the audited export endpoint); `format?`: `csv` (default) | `json`.

A column-level `contextMenu` on a `table` column **merges below** the panel-level menu
(panel actions first, then that column's actions).

### Animated / temporal charts — playback over a time dimension (ADR-0034)

Three chart types replay **one query result as frames** over a time/sequence column —
a bar-chart **race**, a **racing line**, and an animated **choropleth**. They are
**dvt Full** (non-portable, ECharts-coupled): a spec using one reports
`conformance: "full"`, and an **export/render captures a static poster frame** (the
final frame), not the motion. Live playback is a web-renderer capability.

| Type | Use it for | Mode |
|------|-----------|------|
| `chart:bar:racing` | top-N rankings that reshuffle over time (brands/regions by year) | continuous tween — bars **slide** |
| `chart:line:racing` | series drawing in / diverging over time (prices, cumulative metrics) | continuous tween — line **grows** |
| `chart:geo:animated` | a measure spreading across a map over periods (share by state by quarter) | discrete steps — fills **jump** |

**One query, all frames.** The rows carry every frame stacked; the client groups them by
`animation.frameField` and iterates **in-browser** — there is **no per-frame query** and no
engine change (ADR-0011/0013). A 12-year race of 10 categories is 120 rows in one result,
not 12 queries. For a backend-free spec, bake all frames into `data.rows`.

**The `animation` block** (required on these three types):

```jsonc
"animation": {
  "frameField": "year",          // REQUIRED — the column rows are grouped/ordered by
  "frames": ["2019","2020","…"], // optional explicit order; else numeric/date-aware sort
  "speedDefault": 1,             // initial speed multiplier (∈ speeds)
  "speeds": [0.5, 1, 2, 4],      // selectable multipliers; scrubber + segmented control
  "loop": false,                 // restart after the last frame
  "controls": { "placement": "below" }   // "below" (default) | "overlay"
}
```

The shared control bar (play/pause · scrubber · speed · period label · loop, keyboard-operable)
renders automatically; you don't author it. Speed scales the tick interval **and** the tween
duration together so motion stays smooth.

**Stable identity is the whole trick.** Each data item must keep a stable name across frames so
the renderer *slides* it instead of popping. For a **bar race**, `categoryField` is that identity
(one row per category per frame) and `valueField` is the measure; `yAxis.max: N-1` shows the
top-N (default 10). For a **line race**, `valueField` is the y measure and an optional
`seriesField` splits multiple lines. For **animated geo**, `series[].map` names a registered
asset (`USA`/`world`, ADR-0023), `labelField` is the region (matching the map's
`properties.name`, e.g. a full US state name), `valueField` the measure, and a single
`visualMap` colours all frames on one scale (set `min`/`max` so colours are comparable
period-to-period).

```jsonc
// Bar race — top regions by MRR over the year
{ "type": "chart:bar:racing", "title": "MRR by region",
  "data": { "rows": [
    {"month":"Jan","region":"AMER","mrr":120}, {"month":"Jan","region":"EMEA","mrr":131},
    {"month":"Feb","region":"AMER","mrr":135}, {"month":"Feb","region":"EMEA","mrr":141}
    /* …all months × regions… */ ] },
  "spec": {
    "categoryField": "region", "valueField": "mrr",
    "series": [{ "type": "bar" }],
    "animation": { "frameField": "month", "loop": true }
  } }
```

Tips: keep frames ≲ 50 and one row per entity per frame; tidy, numeric/date-sortable
`frameField` values order without an explicit `frames` list; for geo prefer smaller period
deltas (monthly > yearly) since fills don't interpolate.

## Canvas mode — immersive, full-bleed, scroll-driven layouts

Set **`layout.mode: "canvas"`** (the default is `"grid"`) to author a full-bleed,
free-form, scroll-driven dashboard instead of the 24-column grid — a scrollytelling
report or a kiosk/presentation view rather than a tile grid (ADR-0027). The **same
spec, panels, theme, data binding, and blocks** apply; only the layout shape changes.
Humans and agents author it identically — an agent can generate a canvas spec exactly
like a grid one.

```json
"layout": {
  "mode": "canvas",
  "fullBleed": true,
  "sections": [
    {
      "id": "hero",
      "background": "radial-gradient(circle at 30% 20%, #1E1B4B 0%, #0B0B0F 60%)",
      "width": 1440, "height": 810,
      "scroll": "none",
      "blocks": [
        { "ref": "hero-title", "x": 120, "y": 280, "w": 900, "h": 220, "z": 1,
          "motion": { "type": "rise", "trigger": "load", "duration": 600 } },
        { "ref": "headline-stat", "x": 120, "y": 540, "w": 1100, "h": 140, "z": 2,
          "motion": { "type": "count-up", "trigger": "in-view", "duration": 1200 } }
      ]
    }
  ]
}
```

**The model (a slide deck that scrolls):**

- A canvas layout is an ordered list of **`sections`**. The page scrolls top-to-bottom
  between them; each is a fixed **design-space rectangle** (`width`×`height`, default
  **1440×810**) the renderer **scales to fit the viewport width** — author once at
  1440-wide and it reads at any size (no per-breakpoint map).
- **`blocks`** are absolutely positioned *inside* a section, in design-space units:
  `{ "ref": panelId, "x", "y", "w", "h", "z?", "motion?" }`. `ref` points at a
  `panels[]` id (exactly like grid `items[].i`) — **content lives in `panels[]`,
  placement lives in blocks.** Blocks may overlap and layer by `z` (default 0); a panel
  may appear in more than one block.
- **`section.background`** takes any CSS background (solid / gradient / a token ref like
  `{page.background}`) — **sanitized** (no remote `url()`); use `media` blocks for images.
- **`fullBleed: true`** is a render hint to drop app chrome (edge-to-edge / kiosk /
  presentation). Open a canvas dashboard, then click **Present** for the chrome-less
  viewer at `/present/:id`.

**Scroll behaviors** (`section.scroll`):

- `none` (default) — the section scrolls normally.
- `pin` — sticks to the top while later sections scroll up over it (stacked scrollytelling).
- `reveal` — its blocks rise/fade in as the section enters view (a default entrance for
  blocks that declare no `motion` of their own).

**Motion** (`block.motion`) — a declarative entrance animation compiled at render (data,
not functions — ADR-0016):

- `type`: `none | fade | rise | scale | count-up`. `count-up` rolls a `stat`/`metric-strip`/`kpi`
  number up on entrance (on any other panel it degrades to a plain fade); the others animate the block.
- `trigger`: `in-view` (default — plays when scrolled into view) or `load` (on first paint).
- `delay`, `duration` (ms; defaults 0 / 600).
- Motion always respects `prefers-reduced-motion` and is **off in static renders** (a
  headless capture lands on the final frame), so it never blocks or races a render.

**When to use canvas:** a flagship/executive narrative, a launch or quarterly report you
want to feel bespoke and full-bleed, a scrollytelling walk-through, a kiosk/presentation.
Use **grid** for an everyday analytical dashboard of tiles. The rich blocks
(`hero`/`stat`/`media`/`divider`) shine in canvas but work in either.

**Authoring tips:** open with a `hero` over a gradient `section.background`; use `stat`
blocks with `count-up` motion for headline figures; give each section **one idea**
(scrollytelling = one message per section, the canvas analogue of one-question-per-page);
keep blocks on a tidy implied grid inside the 1440×810 space and don't overlap text
illegibly; a `divider` or generous empty geometry gives breathing room. Verify the same
way (§4) — render at desktop width and read it; motion is off in the capture so you see
the final frame.

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
- **For a narrative showpiece, reach for canvas mode** (`layout.mode: "canvas"`): one idea per scrolling section, a `hero` + `stat` opener, motion on entrance. Scrollytelling (Segel & Heer, author-driven) is the canvas analogue of answer-first paging — see Canvas mode.

### 4. Build, then SEE it — verify and iterate

1. Write the spec (mechanics above). Bind each panel to a fully-qualified `query`.
2. Validate with `dvt_spec_validate` — fix field errors and heed `warnings` (typos, and panels that will render EMPTY).
3. **Render and actually look at it:** `dvt_dashboard_render_inline` at desktop (`width` ~1280–1440) AND mobile (`width` ~390–414), for each `page`. Read the image: is there a clear headline? Any unreadable text, squished labels, empty panels, flat bars? Does it answer the question?
4. Iterate on what you saw, then save via the API / MCP. **Don't ship a dashboard you haven't looked at.**

## Rules

- No JS functions in specs — use `format` objects and the `{ "$dvtRef": "formatter:pie-label@1" }` ref instead. `$dvtRef` ids are **versioned** (`<kind>:<name>@<version>`, e.g. `formatter:usd-compact@1`) and must be one of the registered ids — an unknown or unversioned ref is rejected at write time (ADR-0016).
- Every `layout.items[*].i` must match a panel `id`.
- Keep series colors as `{chart.series.N}` refs so the theme stays consistent.
- Prefer `pages` for anything with more than ~8 panels.
- Always fully-qualify table names in `data.query` as `database.schema.table` — connections may carry no default database/schema.
- Write SQL in the canonical dvt style — lowercase keywords, leading commas, `where 1=1` guard, `%(key)s` bindings (see `docs/02-spec/sql-style-guide.md`).

The machine-readable JSON Schema lives at `spec/schema/dashboard.schema.json` in the dvt repo — validate against it when in doubt.
