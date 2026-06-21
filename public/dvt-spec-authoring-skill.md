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
  - A page may set **`hidden": true`** (ADR-0036): it is **excluded from the tab bar / default
    nav** but stays fully authored and is a valid `drill`/`openOverlay` target — the way to
    build a **detail page that only opens as an overlay** (`pages: [{ id: "region-detail",
    title: "Region detail", hidden: true, layout, panels:[…] }]`). ⚠️ `hidden` is
    **presentation, not access control** — a hidden page's data is governed by the same RBAC
    as any page; never use it to "protect" sensitive data.
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
| `chart:geo:animated` | ECharts map (advanced) | `animation.frameField` (required — the period column), `series[].map` (registered asset, e.g. `USA`), `labelField`/`valueField` (region, measure) or `geoField` for data-driven geometry; `visualMap` auto-fills from values — **Animated choropleth over a time dimension (ADR-0034), driven by the shared merge-clock + `visualMap` (not the native ECharts `timeline`, ADR-0034 Amdt 1). dvt Full / non-portable. Requires `animation.frameField` (the period column) and a registered map asset (`series[].map`, ADR-0023); `labelField`/`geoField` name the region, `valueField` the measure. Fills CROSS-FADE between periods via per-region value interpolation (ADR-0034 Amdt 3); regions with no data on either side snap at the boundary, and large maps (>80 regions, e.g. `world`) stay discrete. One query, the client iterates. Renders to a static poster (last frame) in exports (ADR-0024).** |
<!-- END generated chart-type table -->
| `metric-strip` | Row of KPI metric tiles | `metrics[]` (see below); each metric accepts `description` (optional hover tooltip) |
| `kpi` | Single-value scorecard (one headline number + comparison + sparkline) | `valueField` (required), `agg`, `format`, `label`, `caption`, `description` (optional hover tooltip), `comparison{…}`, `sparkline{…}` (see below) |
| `table` | Data table (dvt-native, portable) | `columns[]` — each `{ field, label?, format?, align?, sortable?, filterable? }`; omit for every query column in result order. `defaultSort{ field, direction }` seeds an initial sort; click-to-sort + per-column filter run client-side over the fetched rows (`sortable`/`filterable` default true). Row order follows the query `ORDER BY` unless `defaultSort` overrides it; `format` uses the shared format objects. `grouping{ groupBy[], aggregations[]{field,agg}, subtotals?, grandTotal?, defaultExpanded? }` collapses rows into a grouped tree with subtotal/grand-total rows — computed client-side over the fetched rows (no re-query, no SQL rewrite), `groupBy` order = nesting levels, `agg` ∈ sum/avg/min/max/count (default sum) |
| `text` | Markdown narrative | `markdown`, `variant` (`plain`\|`callout`), `align` |
| `html` | Sanitized HTML/CSS escape hatch | `html` (see below) |
| `stat` | Big-number tile (hero-scale single value) | `valueField` (required), `agg`, `format`, `label`, `caption`, `description` (optional hover tooltip), `delta`, `sparkline`, `align` (see below) |
| `hero` | Headline block (eyebrow + headline + subhead) | `headline` (required), `eyebrow`, `subhead`, `align`, `size` (`sm`\|`md`\|`lg`\|`xl`); text fields support `{{ … }}` variables (see below) |
| `media` | Image block (ADR-0014 escape hatch) | `src` (required, sanitized), `alt`, `fit` (`cover`\|`contain`\|`fill`), `rounded`, `caption` (see below) |
| `divider` | Visible rule line | `orientation`, `thickness`, `color`, `style` (`solid`\|`dashed`\|`dotted`), `inset` (see below) |
| `section` | Grid heading band that labels a group of panels | panel `title` = the heading; `subtitle` (one line), `rule` (hairline below, default true), `align` (`left`\|`center`\|`right`); takes no query, spans full width (`w:24` by convention). **dvt Core. NOT the canvas `layout.sections[]` block — distinct constructs** (see below) |
| `filter` | Interactive control whose selected value re-queries target panels | `param` (required unless a range), `valueField` (required), `labelField`, `label` (display label — preferred over `placeholder` for labelling; falls back to `placeholder` → param → `'Filter'`), `placeholder` (input-hint text only), `help` (accessible `?` tooltip), `control` (`select`\|`multiselect`\|`date-range`\|`number-range`\|`search`\|`toggle`\|`number`\|`segmented`\|`radio`\|`button-group`\|`checkbox-list`), `valueType` (`string`\|`number`\|`date`\|`boolean`), `targets`, `values`, `default`, `allLabel`, `unsetMode` (`omit`\|`null`), `operator` (`equals`\|`not-equals`\|`contains`\|`starts-with`\|`ends-with`\|`in`\|`not-in`\|`between`\|`gt`\|`gte`\|`lt`\|`lte`), `apply` (`live`\|`button`), `required` (boolean), `chrome` (`card`\|`none`), `width` (`compact`\|`full`), `density` (`comfortable`\|`compact`), `icon` (`calendar`\|`search`\|`filter`\|`region`\|`tag`\|`clock`\|`user`\|`dollar`); **range** (`between` / `number-range` / `date-range`): `loParam`+`hiParam` (required, replace `param`), `min`, `max`, `step`; **date** (`date-range`): `relativeDate` (`{lo?,hi?}`, each `{unit: minute\|hour\|day\|week\|month\|quarter\|year, amount, direction}`), `presets` (`today`\|`last-7d`\|`last-30d`\|`last-90d`\|`mtd`\|`qtd`\|`ytd`\|`all-time`), `timezone` (IANA, default `UTC`) (see Filters & drill-downs) |
| `filter-bar` | Horizontal band grouping several filter elements in one light surface (DVT-551) | `panels` (required — ordered list of child filter element ids from the same page's `panels[]`), `title?`; child filters should set `chrome:"none"` to avoid doubled chrome; children are NOT page grid items; semantic pass enforces existence / no double-placement |
| `container` | Tabbed container — one page region holding several panel sets behind tabs (layout primitive, not a chart) | `spec.layout: "tabs"` (required), `tabs[]` (required) each `{ id, label, panels:[childId…], layout }`, `defaultTab?`. **Children stay real elements in `panels[]`** referenced by id (never inlined); each tab carries its own mini 24-col `layout`, and the container itself occupies one cell in the page grid. Children are NOT in the page grid. Single level only (no tabs-in-tabs). NOT the same as page-level tabs (`pages[]`+`tabBar`). The semantic validator rejects missing refs / a child placed twice / a child also in the page grid / nesting / a bad `defaultTab` / a tab id that collides with a panel id |

Any panel can also carry a `drill` object (retained for back-compat, now inert on its own — DVT-555) and/or a `contextMenu` object (right-click action menu). Drill navigation is now triggered via a `contextMenu` action of `type:"drill"`; for overlay presentation use `openOverlay` — see **Filters & drill-downs**.

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
SQL. Full reference: `docs/02-spec/sql-style-guide.md`. This is dvt's opinionated
default for SQL that's easy to read and audit; customers can override authoring with
their own skills, but the dvt app always normalizes the SQL shown in the panel query
inspector to this canonical style.

**Backend-free specs:** add `data.rows` (an array of row objects) and the panel
renders from those directly — **no engine, no warehouse, no live query.** This makes
a spec fully self-contained (great for demos, the `/builder`, and static hosting).
Keep `query` alongside `rows` so the SQL inspector still shows real SQL:

```json
"data": { "sourceId": "db", "query": "SELECT category, SUM(amount) AS revenue ...",
          "rows": [ { "category": "Software", "revenue": 1269315.62 } ] }
```

### Tooltip — dvt Core extensions (DVT-301 / DVT-408)

The tooltip sub-keys `fields`, `total`, `order`, `template`, and `crosshair` are *dvt Core* (portable, renderer-neutral). They are compiled + stripped before the ECharts tooltip passthrough — any other key under `tooltip` is the ECharts escape hatch. Tooltip enrichment works on bar/line/area, pie/donut, and scatter; ignored on pivot/relational families.

**Functions are never allowed in dvt specs.** The `template` key is the function-free alternative to a raw ECharts `tooltip.formatter`.

#### tooltip.fields — extra columns on hover (DVT-301)

`spec.tooltip.fields` surfaces additional query-result columns in the chart hover tooltip. Absent columns are silently skipped.

Each entry: `{ "field": "<column>", "label"?: "...", "format"?: { ... } }`. `label` defaults to a humanized form of the field name. `format` is the shared FormatObject.

```json
{ "type": "chart:bar",
  "spec": {
    "series": [{ "type": "bar", "dataField": "rev" }],
    "tooltip": { "fields": [
      { "field": "order_count", "label": "Orders", "format": { "type": "number" } },
      { "field": "yoy", "label": "YoY", "format": { "type": "percentage" } }
    ] } } }
```

#### tooltip.total — shared-axis sum row (DVT-408)

Appends a total row summing all numeric series values at the hovered category. *dvt Core.*

`total.show` (boolean) — enable the total row. `total.label` (string, default `"Total"`) — the row label. `total.format` (FormatObject) — formats the sum; defaults to a grouped number.

```json
"tooltip": { "total": { "show": true, "label": "Total", "format": { "type": "currency", "currency": "USD", "compact": true } } }
```

#### tooltip.order — sort per-series rows (DVT-408)

`order`: `"asc"` \| `"desc"` \| `"seriesIndex"` (default). Sorts the per-series tooltip rows by numeric value ascending or descending; `"seriesIndex"` keeps the original series order.

```json
"tooltip": { "order": "desc" }
```

#### tooltip.template — function-free row template (DVT-408)

A string template applied to each per-series tooltip row instead of the default `name: value` line. *dvt Core — no functions needed.*

**Token grammar** (only these tokens are substituted; everything else is left as literal text):

- `{value}` — the formatted series value for this row
- `{label}` — the series name
- `{field:<colname>}` — a named query-result column from the hovered row (`<colname>` must be `[A-Za-z0-9_]+`)

All substituted values and all literal template text are HTML-escaped. Unknown tokens (anything that doesn't match the allow-list) are left as-is in the output.

```json
"tooltip": {
  "template": "{label}: {value} ({field:region})"
}
```

Example output for a series named `Revenue`, value `$1.2M`, hovered row `region=West`: `Revenue: $1.2M (West)`.

#### tooltip.crosshair — axis pointer style (DVT-408)

Compiles to ECharts `tooltip.axisPointer`. *dvt Core.*

- `crosshair.axis`: `"x"` \| `"y"` \| `"both"` — `x`/`y` renders a line pointer on that axis; `"both"` renders a cross pointer.
- `crosshair.label` (boolean) — when `true`, shows the axis value label on the pointer line.
- `crosshair.snap` (boolean) — when `true`, the pointer snaps to the nearest data point.

```json
"tooltip": { "crosshair": { "axis": "x", "label": true, "snap": false } }
```

#### Composing all Core keys

All dvt Core tooltip keys compose freely and can be mixed with ECharts passthrough keys:

```json
"tooltip": {
  "trigger": "axis",
  "fields": [{ "field": "order_count", "label": "Orders", "format": { "type": "number" } }],
  "total": { "show": true },
  "order": "desc",
  "template": "{label}: {value}",
  "crosshair": { "axis": "x" }
}
```

**The FormatObject** (`format`) is one shared, renderer-neutral vocabulary — it renders identically on chart axes/labels/tooltips, KPI scorecards, table cells, and `{{ }}` text variables. `type` is one of:

- `number` / `currency` (`currency` ISO code) / `percentage` — `decimals` sets fraction digits; `compact` (`1.2M`) on number/currency. (Percentage expects a whole number, e.g. `25` → `25%`.)
- `compact` — shorthand for compact number notation.
- `date` — `pattern` selects which fields show (CLDR-ish tokens: `yyyy`/`yy`, `MMMM`/`MMM`/`MM`/`M`, `dd`/`d`, `HH`, `mm`), e.g. `"MMM d, yyyy"` → `Mar 9, 2026`. Rendered in UTC.
- `duration` — humanizes a numeric duration. `unit` is the input unit (`ms` default, or `s`/`m`/`h`/`d`); `style` is `short` (`2h 5m`, default), `long` (`2 hours 5 minutes`), or `colon` (`2:05:00`).
- `custom` — `pattern` is a [d3-format](https://github.com/d3/d3-format) string (a portable mini-language, **not** author code — ADR-0016): `",.2f"`, `"$,.0f"`, `".1%"`, `"~s"`. Note: a d3 `%` pattern (`".1%"`) multiplies by 100 and expects a **fraction** (`0.25` → `25%`), unlike `type:"percentage"` which expects a whole number (`25` → `25%`).

All types also accept `prefix`/`suffix` (wrap the output) and `locale` (BCP-47; defaults to `en-US` for deterministic output).

### Legend (DVT-407)

*Multi-series charts auto-get a legend.* A chart with ≥2 series (bar/line/area/scatter, any orientation) receives a styled legend automatically — no `legend: {}` needed. Single-series cartesian charts do *not* get an auto-legend (it's noise). Set `"legend": { "show": false }` to suppress.

`legend.position` — *dvt Core* placement shorthand: `"top"` \| `"bottom"` \| `"left"` \| `"right"`. `left`/`right` automatically set `orient:"vertical"`. Compiled + stripped; not a native ECharts key. Raw ECharts placement keys (`top`/`left`/`right`/`bottom`/`orient`) set directly on `legend` win over this shorthand.

`legend.values` — *dvt Core* value-in-legend: appends an aggregated series value to each legend label. No JS needed.

```json
{ "type": "chart:bar",
  "spec": {
    "series": [
      { "type": "bar", "dataField": "revenue", "name": "Revenue" },
      { "type": "bar", "dataField": "target",  "name": "Target" }
    ],
    "legend": {
      "position": "bottom",
      "values": { "agg": "total", "format": { "type": "currency", "currency": "USD", "compact": true } }
    } } }
```

`values.agg`: `last` (last non-null) · `total` (sum) · `min` · `max` · `mean`. `values.format` is the shared *FormatObject*.

For scroll behavior, hiding individual series by default, or other ECharts legend features — use the raw ECharts legend passthrough (`type:"scroll"`, `selected`, etc.) directly alongside Core keys.

### Number display — value labels, funnel rates, derived metrics

dvt Core, renderer-neutral ways to put numbers *on the chart* — no hand-written ECharts `formatter`. All format via the shared format objects (see Formats). A raw `series[].label.formatter` remains the Full escape hatch and takes precedence over these.

**Value labels on marks** — top-level `spec.label` puts the formatted datum value on each mark. Works on bar/line/area, pie/donut, scatter (ignored on pivot/relational families). `position` defaults sensibly per type (bar→top, horizontal bar→right, pie/donut→outside, scatter→top).

```json
{ "type": "chart:bar",
  "spec": {
    "series": [{ "type": "bar", "dataField": "revenue" }],
    "label": { "show": true, "position": "top", "format": { "type": "currency", "currency": "USD", "compact": true } } } }
```

**Derived display metrics** — `label.derive` shows a value computed from the series instead of the raw number:

- `percentOfTotal` — each datum as % of the series sum.
- `deltaPrev` — absolute change vs the previous datum (signed ▲/▼).
- `deltaPrevPct` — percent change vs the previous datum (signed ▲/▼).

First datum / zero-sum / zero-prior render as `—`.

```json
"label": { "show": true, "derive": "percentOfTotal", "format": { "type": "percentage", "decimals": 0 } }
```

**Funnel conversion rates** — on `chart:funnel`, top-level `spec.funnelRate` shows conversion % in the stage labels (no raw formatter needed):

```json
{ "type": "chart:funnel",
  "spec": {
    "labelField": "stage", "valueField": "count",
    "funnelRate": { "mode": "step", "showValue": true, "precision": 0 } } }
```

`mode`: `step` (% of the previous stage) · `overall` (% of the first stage) · `total` (% of all stages) · `none`. `showValue` also prints the formatted stage value (uses the panel's `valueFormat`).

### Axes

`xAxis` and `yAxis` accept a single *AxisSpec* object or an array of *AxisSpec* objects for multi-axis charts. Every property below is dvt Core (portable). Any key *not* listed here is raw ECharts passthrough — it validates and renders as-is (the escape hatch, ADR-0014).

| Property | Type | Notes |
|----------|------|-------|
| `type` | `"value"` \| `"category"` \| `"time"` \| `"log"` | Axis scale. Default `"value"` for numeric axes, `"category"` for label axes. |
| `min` | number \| `"dataMin"` | Fixed lower bound, or `"dataMin"` to derive from the data. |
| `max` | number \| `"dataMax"` | Fixed upper bound, or `"dataMax"` to derive from the data. |
| `scale` | boolean | Value axis: don't force a zero baseline. Default `false`. |
| `splitNumber` | integer | Suggested tick count (ECharts treats as a hint). |
| `logBase` | number | Base for `type:"log"`. Default 10. |
| `name` | string | Axis title label. Styled by `chart.axis.name.*` tokens. |
| `nameLocation` | `"start"` \| `"middle"` \| `"center"` \| `"end"` | Where along the axis the name anchors. Default `"end"`. |
| `nameGap` | number | Distance in pixels between the name and the axis line. |
| `nameRotate` | number | Name label rotation in degrees. |
| `boundaryGap` | boolean \| array | Category-axis edge padding. `false` = data point on the axis edge. Array `["10%","10%"]` for value axes. |
| `inverse` | boolean | Reverse the axis direction. Default `false`. |
| `position` | `"top"` \| `"bottom"` \| `"left"` \| `"right"` | Axis position. Default `"bottom"` for xAxis, `"left"` for yAxis. |
| `axisLabel.rotate` | number | Tick-label rotation (-90 to 90). Use for long labels that overlap. |
| `axisLabel.interval` | number \| `"auto"` | Label display interval. `0` = every label; `"auto"` = auto-hide overlapping. |
| `axisLabel.hideOverlap` | boolean | Auto-hide overlapping labels. |
| `axisLabel.margin` | number | Distance (px) between label text and the axis. |
| `axisLabel.width` | number | Max label width (px); overflow handled by `axisLabel.overflow`. |
| `axisLabel.overflow` | `"none"` \| `"truncate"` \| `"break"` \| `"breakAll"` | Text overflow handling when label exceeds `width`. |
| `axisLabel.format` | FormatObject | The compiler turns this into an ECharts `axisLabel.formatter` — the same renderer-neutral vocabulary as value labels and tooltips. Use for date axes to avoid hand-written formatters. |

*Example — named axes with rotated labels:*

```json
{ "type": "chart:bar",
  "spec": {
    "xAxis": { "type": "category", "name": "Month", "nameLocation": "end",
               "axisLabel": { "rotate": 45 } },
    "yAxis": { "type": "value", "name": "Revenue (USD)", "nameGap": 20,
               "axisLabel": { "format": { "type": "currency", "currency": "USD", "compact": true } } },
    "series": [{ "type": "bar", "dataField": "revenue" }] } }
```

**Dual-axis pattern.** Set `yAxis` to an array and reference the secondary axis by index in the series. `dvt_spec_validate` warns when `series[].yAxisIndex > 0` but `yAxis` is not an array of sufficient length.

```json
{ "type": "chart:line",
  "spec": {
    "xAxis": { "type": "category" },
    "yAxis": [
      { "type": "value", "name": "Revenue" },
      { "type": "value", "name": "Margin %", "position": "right" }
    ],
    "series": [
      { "type": "line", "dataField": "revenue" },
      { "type": "line", "dataField": "margin", "yAxisIndex": 1 }
    ] } }
```

Any other ECharts axis key (e.g. `splitLine`, `axisPointer`, `minInterval`) is raw passthrough and validates alongside these documented properties — both coexist freely.

### Gridlines, banding & plot area

Four dvt-Core keys control the plot grid — no hand-written ECharts `splitLine`/`splitArea`/`grid` needed for common cases. *Precedence*: raw ECharts passthrough (e.g. a `xAxis.splitLine` set directly, or a raw `grid:{left:60}`) always wins over these Core keys, which in turn win over the theme defaults.

| Key | Type | Effect |
|-----|------|--------|
| `gridlines.x` | *GridlineAxis* | Gridlines on the x axis |
| `gridlines.y` | *GridlineAxis* | Gridlines on the y axis |
| `banding` | `{ axis, colors? }` | Zebra-stripe bands on the named axis |
| `plotArea` | `{ background?, border? }` | Plot area fill and border color |
| `gridPadding` | `{ left?, right?, top?, bottom? }` | Plot-area inset overrides (partial deep-merge) |
| `density` | `"comfortable"` \| `"compact"` | Preset spacing; `"compact"` tightens insets for dense dashboards |

*GridlineAxis* properties: `show` (boolean), `style` (`"solid"` \| `"dashed"` \| `"dotted"`), `width` (number), `color` (CSS color string).

*Example — dashed y-axis gridlines, zebra x banding, compact plot area:*

```json
{ "type": "chart:bar",
  "spec": {
    "gridlines": { "y": { "show": true, "style": "dashed", "color": "#E0E0E0" } },
    "banding":   { "axis": "x" },
    "plotArea":  { "background": "#FAFAFA" },
    "gridPadding": { "left": 60 },
    "density": "compact",
    "xAxis": { "type": "category" },
    "yAxis": { "type": "value" },
    "series": [{ "type": "bar", "dataField": "revenue" }] } }
```

`density:"compact"` is for panels where space is scarce (e.g. a narrow column). For most charts, omit it (the `"comfortable"` default). A partial `gridPadding` (e.g. only `left`) deep-merges over the defaults — the other three insets and `containLabel` are unchanged.

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
headline number, a ▲/▼ delta vs. the prior row, and a sparkline. Each metric accepts an optional **`description`** field — a plain-text explanation shown as a hover tooltip; falls back to `label` when not set. dvt Core (DVT-558).

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
- **`description`** (optional) — a plain-text explanation of the metric shown as a hover tooltip; falls back to `caption` when not set. dvt Core, renderer-neutral (DVT-558).

### Rich tables — conditional formatting, heat maps, in-cell viz, pivot (DVT-507)

The `table` panel type ships a full vocabulary for presentation-quality tables.
All features are dvt Core (client-side over already-bound rows, ADR-0011). The
core table `spec` shape:

```jsonc
{
  "type": "table",
  "data": { "sourceId": "db", "query": "SELECT …" },
  "spec": {
    "columns": [ /* TableColumn[] — ordered column defs */ ],
    "defaultSort": { "field": "revenue", "direction": "desc" },
    "columnGroups": [ /* optional spanning headers */ ],
    "grouping":  { /* optional row-grouping tree */ },
    "conditionalFormat": [ /* table-wide CF rules */ ],
    "footnotes": [ /* footnotes beneath the table */ ],
    "sourceNote": "Source: analytics.public.orders",
    "pivot": { /* pivot/cross-tab mode */ }
  }
}
```

Each **`TableColumn`** is `{ field, label?, description?, format?, align?, sortable?,
filterable?, conditionalFormat?, colorScale?, cell?, textStyle? }`.

---

#### Conditional formatting (DVT-509, ADR-0044 §3)

`TableSpec.conditionalFormat[]` sets **table-wide** rules (can target any column or
the whole row). `TableColumn.conditionalFormat[]` sets **column-level** rules applied
*after* table-wide ones (more specific wins per style key unless `stopIfMatched` is
used).

Each rule: `{ where: CellPredicate, apply: CellStyle, target?, stopIfMatched? }`.

**`target`** — what gets painted when the predicate matches:

- `"cell"` (default) — only the tested cell.
- `"row"` — the entire row.
- any field name string — that column's cell in the same row.

**Precedence** (lowest → highest): `colorScale` background tint → table-wide CF →
column-level CF. Within one array, rules layer **last-wins per style key** unless
`stopIfMatched: true` (then first-wins short-circuits later rules for that row/cell).

**`CellStyle`** properties: `fill`, `textColor`, `weight` (`normal|medium|bold`),
`italic`, `underline`, `strikethrough`, `align` (`left|center|right`). Color slots
accept a `ColorTokenValue` (hex / `rgb()` / named / `{token}`) or a `FieldColorRef`
`{ fromField: "<col>" }` — see field-value color below.

**`CellPredicate`** grammar:

| op | `value` shape | Notes |
|---|---|---|
| `eq` / `neq` | scalar | Equality / inequality |
| `gt` / `gte` / `lt` / `lte` | number | Numeric comparison |
| `between` | `[lo, hi]` | Inclusive range |
| `in` / `notIn` | array of scalars | Set membership |
| `contains` | string | Substring match |
| `isNull` / `isNotNull` | omit `value` | Null test |
| `topN` / `bottomN` | integer N | Tier-B (cap-sensitive — a badge appears when result was capped) |

`field` defaults to the column the rule is attached to; required for table-wide rules.
Use `all: [...]` (AND) / `any: [...]` (OR) to combine sub-predicates (nesting capped at 5).

```jsonc
// Column-level CF: bold green when revenue > 100000, red italic when < 10000
{
  "field": "revenue",
  "conditionalFormat": [
    {
      "where": { "op": "gt", "value": 100000 },
      "apply": { "fill": "#d1fae5", "textColor": "#065f46", "weight": "bold" }
    },
    {
      "where": { "op": "lt", "value": 10000 },
      "apply": { "fill": "#fee2e2", "textColor": "#991b1b", "italic": true }
    }
  ]
}

// Table-wide CF: highlight the whole row when status = "at-risk"
// (table-level conditionalFormat[], target:"row")
{
  "where": { "field": "status", "op": "eq", "value": "at-risk" },
  "apply": { "fill": "#fff7ed" },
  "target": "row"
}

// stopIfMatched — first matching rule wins; later rules don't layer
{
  "where": { "op": "topN", "value": 3 },
  "apply": { "fill": "#fef9c3", "weight": "bold" },
  "stopIfMatched": true
}
```

---

#### Heat-map color coding — `colorScale` (DVT-509, ADR-0044 §3)

`TableColumn.colorScale` paints a **background tint proportional to each cell's
numeric value** — the column stays readable (auto-contrast text) while giving an
instant visual heat map. Computed client-side over the column's bound rows (ADR-0011).

```jsonc
{
  "field": "conversion_rate",
  "colorScale": {
    "method": "numeric",       // "numeric" | "bin" | "quantile"
    "domain": [0, 1],          // [min, (mid,) max] or "auto" (default)
    "palette": "blues",        // named ramp or ColorTokenValue[] (≥2 stops)
    "bins": 5,                 // for method:"bin" — number of equal-width bins
    "nullColor": "#f3f4f6"     // background for null cells; omit = transparent
  }
}
```

`method`:

- `"numeric"` — linear interpolation between domain bounds (default).
- `"bin"` — equal-width bins; `bins` (default 5) controls the count.
- `"quantile"` — nearest-rank percentile bins. **Tier-B cap-sensitive**: a badge
  appears when the result set was truncated.

`domain`: `"auto"` (default) derives min/max from the column's finite values — also
Tier-B cap-sensitive. Explicit `[lo, hi]` or `[lo, mid, hi]` pins the scale.

`palette`: a **named ramp** from the color-schemes registry or an explicit array of
`ColorTokenValue` stops (at least 2). Named ramps:

| Name | Kind |
|---|---|
| `blues` | sequential (light→dark blue, default) |
| `viridis` | sequential (perceptually uniform) |
| `magma` | sequential (dark→light) |
| `rdbu` | diverging (red→neutral→blue) |
| `brbg` | diverging (brown→neutral→green) |
| `spectral` | diverging (red→yellow→blue) |
| `okabe-ito` | categorical (colorblind-safe) |
| `set2` | categorical (soft, print-safe) |

---

#### Field-value color — `FieldColorRef` (DVT-510, ADR-0044 §4)

`CellStyle.fill` and `CellStyle.textColor` accept a `{ "fromField": "<col>" }` object
instead of a literal color — the renderer reads the color from the named column of
the same bound row. The warehouse-controlled value is sanitized by `sanitizeBackground`
at render time (the same gate as an authored `ColorTokenValue`): an unsafe value
(e.g., a URL function) is dropped and the cell renders without that color slot.

```jsonc
// Cells in the "status" column adopt the background color from the "status_color" column
{
  "field": "status",
  "conditionalFormat": [
    {
      "where": { "op": "isNotNull" },
      "apply": {
        "fill": { "fromField": "status_color" },
        "textColor": "#ffffff"
      }
    }
  ]
}
```

---

#### In-cell visualizations — `TableColumn.cell` (DVT-511/512, ADR-0044 §4)

`TableColumn.cell` replaces the plain text value with an inline SVG visualization.
Dispatch on `kind`. Don't combine `cell` with `colorScale` on the same column —
`cell` replaces the value, so the heat-map tint is moot (this is an authoring
guideline, not a schema constraint; `colorScale` tints the background and keeps
the value visible, which only makes sense when the value is still shown).

**`ValueSeriesSource`** — used by `sparkline` and `winloss` to resolve a per-row
numeric series. Exactly one of:

- `{ "valuesField": "<col>" }` — column holding a comma-delimited string or JSON array of numbers.
- `{ "valuesFromColumns": ["q1", "q2", "q3", "q4"] }` — ordered sibling column names whose values form the series.

**`kind: "sparkline"`** — mini inline trend line/area/bar chart:

```jsonc
{
  "field": "quarterly_trend",
  "cell": {
    "kind": "sparkline",
    "type": "line",          // "line" (default) | "area" | "bar"
    "source": { "valuesFromColumns": ["q1", "q2", "q3", "q4"] },
    "color": "#2563eb",      // ColorTokenValue
    "min": 0                 // optional fixed domain
  }
}
```

**`kind: "bar"`** — horizontal data bar sized to the cell value:

```jsonc
{
  "field": "revenue",
  "cell": {
    "kind": "bar",
    "domain": "auto",          // [min, max] or "auto"
    "color": "#3b82f6",
    "negativeColor": "#ef4444",
    "baseline": 0,             // bar diverges here for negatives
    "hideNumber": false        // true = suppress the inline text value
  }
}
```

**`kind: "bullet"`** — value bar + target reference line + optional qualitative bands:

```jsonc
{
  "field": "attainment",
  "cell": {
    "kind": "bullet",
    "valueField": "attainment",    // defaults to this column's own value
    "targetField": "quota",        // per-row target column; overrides static "target"
    "domain": [0, 150],
    "qualBands": [50, 100]         // thresholds → poor / ok / good bands
  }
}
```

**`kind: "winloss"`** — win/loss tile strip (positive = win, negative = loss, zero = tie):

```jsonc
{
  "field": "game_results",
  "cell": {
    "kind": "winloss",
    "source": { "valuesField": "results_array" },
    "winColor": "#22c55e",
    "lossColor": "#ef4444",
    "tieColor": "#94a3b8"
  }
}
```

**`kind: "dot"`** — positioned dot marker on a domain scale:

```jsonc
{ "field": "score", "cell": { "kind": "dot", "domain": [0, 100], "color": "#6366f1" } }
```

**`kind: "icon"`** — allow-listed bundled SVG icon. `name` or `nameField` selects
the icon; an unrecognized name renders nothing (never injected into markup):

```jsonc
{
  "field": "trend",
  "cell": {
    "kind": "icon",
    "nameField": "trend_icon",   // column value selects icon at render time
    "colorField": "trend_color"  // column value tints the icon (sanitized)
    // or: "name": "arrow-up" + "color": "#22c55e" for a static icon
  }
}
```

Allow-listed icon names: `check` · `x` · `arrow-up` · `arrow-down` · `arrow-right` ·
`arrow-left` · `circle` · `circle-check` · `circle-x` · `star` · `star-half` ·
`warning` · `info` · `ban` · `bolt` · `clock` · `fire` · `heart` · `thumb-up` ·
`thumb-down` · `trending-up` · `trending-down` · flag codes (`flag-us` `flag-gb`
`flag-de` `flag-fr` `flag-jp` `flag-cn` `flag-ca` `flag-au` `flag-in` `flag-br`).

**`kind: "image"`** — logo/avatar/thumbnail. `src`/`srcField` must pass the media
safety gate (same-origin relative, https on approved dvt asset hosts, raster `data:`
URIs; SVG and unapproved hosts are blocked — renders a placeholder):

```jsonc
{
  "field": "logo_url",
  "cell": {
    "kind": "image",
    "srcField": "logo_url",   // or static "src"
    "shape": "circle",        // "rect" (default) | "circle"
    "height": 32,             // px (8–200), width scales proportionally
    "altField": "company_name"
  }
}
```

**`kind: "markdown"`** — renders the cell's string value as **sanitized inline
markdown** (marked + DOMPurify; https/mailto links only; no `<img>`, no raw HTML).

```jsonc
{ "field": "notes", "cell": { "kind": "markdown" } }
```

---

#### Text styling + number format additions (DVT-513, ADR-0044 §3b)

**`TableColumn.textStyle`** sets a base style for data cells in a column — applied
under `colorScale` and `conditionalFormat` (those override it per key):

```jsonc
{
  "field": "region",
  "textStyle": {
    "weight": "bold",          // "normal" | "medium" | "bold"
    "align": "left",           // "left" | "center" | "right"
    "size": 13,                // font size px (8–48)
    "font": "JetBrains Mono, monospace",  // closed FontFamily enum (ADR-0032 §A3)
    "color": "#374151",        // ColorTokenValue
    "transform": "uppercase",  // "none" | "uppercase" | "lowercase" | "capitalize"
    "decoration": "underline"  // "none" | "underline" | "line-through"
  }
}
```

`font` is the same **closed allow-set** as `typography.fontFamily` — free-text CSS
font stacks are rejected (ADR-0032 §A3). Valid values: `"Inter Variable, Inter, sans-serif"` ·
`"Inter, sans-serif"` · `"JetBrains Mono, monospace"` · `"JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"` ·
`"ui-sans-serif, system-ui, sans-serif"` · `"ui-serif, Georgia, serif"` · `"ui-monospace, monospace"`.

**`FormatObject` additions** (also available on chart panels):

- **`negativeParens: true`** — accounting-style `(1,234)` instead of `-1,234`.
- **`scaleBy: 1000`** — divide the raw value before formatting (e.g. `scaleBy:1000` +
  `suffix:" K"` displays thousands; distinct from `compact` notation).

---

#### Column spanners + grouping totals (DVT-514, ADR-0044 §8)

**`TableSpec.columnGroups[]`** adds spanning header rows above the normal column
headers — like `gt::tab_spanner`. Groups may be nested to produce multiple spanner
rows. Pure header layout — no data transform.

```jsonc
{
  "columnGroups": [
    {
      "label": "This Quarter",
      "columns": ["q_revenue", "q_deals", "q_win_rate"]   // leaf column fields
    },
    {
      "label": "Totals",
      "columnGroups": [                                    // nested sub-groups
        { "label": "YTD", "columns": ["ytd_revenue"] },
        { "label": "Annual Target", "columns": ["target"] }
      ]
    }
  ]
}
```

`columns` (leaf fields) and `columnGroups` (nested) are mutually exclusive. Columns
not covered by any group show a blank cell in the spanner row.

**`TableGrouping`** labels on totals rows:

```jsonc
{
  "grouping": {
    "groupBy": ["region", "segment"],
    "aggregations": [{ "field": "revenue", "agg": "sum" }],
    "subtotals": true,
    "grandTotal": true,
    "totalLabel": "Grand Total",
    "subtotalLabelTemplate": "{value} subtotal"  // {value} = group value
  }
}
```

`totalLabel` sets the label in the leading cell of the grand-total row (default
`"Total"`). `subtotalLabelTemplate` uses `{value}` to interpolate the group value —
e.g., `"{value} subtotal"` renders as `"West subtotal"`.

---

#### Footnotes and source note (DVT-517, ADR-0044 §9)

`TableSpec.footnotes[]` renders footnote marks as superscripts on column headers and
collects the annotated text in a block beneath the table.

```jsonc
{
  "footnotes": [
    {
      "mark": "*",                  // explicit mark; omit for auto (¹ ² ³ …)
      "where": { "column": "revenue" },  // column header to anchor; omit = no anchor
      "text": "Revenue excludes returns and chargebacks."
    },
    {
      "text": "Win rate computed on closed opportunities only."
      // no "where" → appears in notes block without a header superscript
    }
  ],
  "sourceNote": "Source: [analytics.public.orders](https://example.com/docs)"
}
```

Both `text` and `sourceNote` are **sanitized markdown** (https/mailto links only;
no raw HTML). `sourceNote` is rendered after any `footnotes[]`.

Charts support the same `footnotes[]` + `sourceNote` on `ChartSpec` (DVT-569) — see "Chart footnotes and source note" and "Document as you build" below.

---

#### Pivot / cross-tab mode (DVT-515, ADR-0044 §8)

`TableSpec.pivot` restructures bound rows client-side into a cross-tab — no new
panel type. The result is a `table` whose generated value-columns inherit the full
`cell` / `conditionalFormat` / `colorScale` / `format` vocabulary (a colorScale heat
map on a pivot is a common killer combo). Mutually exclusive with `grouping` (pivot
wins; do not combine).

```jsonc
{
  "pivot": {
    "rows": ["region"],              // row-dimension fields (the left stub)
    "columns": ["quarter"],          // column-dimension fields (low-cardinality)
    "values": [
      {
        "field": "revenue",
        "agg": "sum",                // "sum" (default) | "avg" | "min" | "max" | "count"
        "weightField": "deals",      // with agg:"avg" → weighted mean Σ(v·w)/Σw
        "label": "Revenue",
        "format": { "type": "currency", "currency": "USD", "compact": true },
        "colorScale": { "method": "numeric", "domain": "auto", "palette": "blues" }
      }
    ],
    "totals": {
      "row": true,    // trailing total COLUMN at the right (aggregate across quarters)
      "column": true, // trailing grand-total ROW at the bottom
      "grand": true   // grand-total intersection cell (bottom-right)
    },
    "maxColumns": 50  // cap on generated value-columns (default 50); exceeded → "showing K of J columns" disclosure
  }
}
```

**Avg-of-avgs guard (ADR-0044 §8):** omitting `agg` defaults to `sum`, never an
implicit average. Use `agg: "avg"` explicitly; add `weightField` for a proper
weighted mean.

**Cardinality cap:** when the distinct column-dimension tuples × values exceeds
`maxColumns` (max 200), the renderer truncates to the first N (in column-tuple order)
and shows a visible "showing K of J columns (capped)" disclosure — the Tier-B
honesty contract.

---

#### Composition example — rich table with multiple features

```jsonc
{
  "type": "table",
  "title": "Sales by Rep",
  "data": { "sourceId": "db", "query": "SELECT rep, region, revenue, quota, monthly_trend, status_color FROM analytics.public.rep_performance ORDER BY revenue DESC" },
  "spec": {
    "columnGroups": [
      { "label": "Identity",  "columns": ["rep", "region"] },
      { "label": "Performance", "columns": ["revenue", "quota", "monthly_trend"] }
    ],
    "columns": [
      { "field": "rep", "label": "Sales Rep" },
      { "field": "region" },
      {
        "field": "revenue",
        "format": { "type": "currency", "currency": "USD", "compact": true },
        // colorScale: heat-map tint; keeps value visible
        "colorScale": { "method": "numeric", "domain": "auto", "palette": "blues" },
        // CF rule on top: bold the top 3
        "conditionalFormat": [
          {
            "where": { "op": "topN", "value": 3 },
            "apply": { "weight": "bold" },
            "stopIfMatched": true
          }
        ]
      },
      {
        "field": "quota",
        "format": { "type": "currency", "currency": "USD", "compact": true },
        // bullet chart: attainment bar vs quota target
        "cell": {
          "kind": "bullet",
          "targetField": "quota",
          "domain": "auto",
          "qualBands": [50, 100]
        }
      },
      {
        "field": "monthly_trend",
        "label": "Trend (12mo)",
        // sparkline: area chart from a JSON-array column
        "cell": {
          "kind": "sparkline",
          "type": "area",
          "source": { "valuesField": "monthly_trend" },
          "color": "{chart.series.1}"
        }
      }
    ],
    // table-wide CF: highlight entire row when rep is over quota
    "conditionalFormat": [
      {
        "where": { "field": "revenue", "op": "gte", "value": 100 },
        "apply": { "fill": { "fromField": "status_color" } },
        "target": "row"
      }
    ],
    "footnotes": [
      { "where": { "column": "revenue" }, "text": "Revenue is recognized at close date." }
    ],
    "sourceNote": "Source: analytics.public.rep_performance"
  }
}
```

#### Pivot example — revenue by region × quarter with heat map

```jsonc
{
  "type": "table",
  "title": "Revenue by Region × Quarter",
  "data": { "sourceId": "db", "query": "SELECT region, quarter, SUM(revenue) AS revenue FROM analytics.public.orders GROUP BY 1, 2" },
  "spec": {
    "pivot": {
      "rows": ["region"],
      "columns": ["quarter"],
      "values": [
        {
          "field": "revenue",
          "agg": "sum",
          "format": { "type": "currency", "currency": "USD", "compact": true },
          "colorScale": { "method": "numeric", "domain": "auto", "palette": "blues" }
        }
      ],
      "totals": { "row": true, "column": true }
    }
  }
}
```

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
- **Text columns:** `first`/`last` (and the default agg) over a text column return the raw string — `{{ artist | last }}` or `{{ department }}` resolves to the value, not `—`. A numeric format op (`currency`/`percent`/`number`/`compact`) forces the numeric path; a non-numeric value then renders `—`. `—` now means only: missing column, empty result, or a numeric format applied to non-numeric text.

Use text panels to give every dashboard a thesis and takeaways — **explain the data, don't just plot it.**

### Takeaway titles & subtitles — `{{ }}` in panel headers (A1/DVT-468)

A panel's own `title` and `subtitle` interpolate the **same** `{{ field | agg | format }}`
variables, resolved against that panel's query rows. Use this to write **takeaway titles** that
state the insight with a live number instead of naming a column — the single highest-leverage
narrative change.

```json
{ "type": "chart:line", "title": "Revenue grew {{ revenue | delta | percent }} to {{ revenue | last | currency | compact }}",
  "subtitle": "Enterprise now {{ ent_share | last | percent }} of the book",
  "data": { "sourceId": "db", "query": "SELECT month, SUM(amount) AS revenue, … GROUP BY 1 ORDER BY 1" },
  "spec": { "series": [{ "dataField": "revenue" }] } }
```

| Column-name title (weak) | Takeaway title (strong) |
| --- | --- |
| `"Revenue Over Time"` | `"Revenue grew {{ revenue \| delta \| percent }} to {{ revenue \| last \| currency \| compact }}"` |
| `"NRR by Quarter"` | `"NRR improved to {{ nrr \| last \| percent }} — best in 6 quarters"` |

- `title: ""` renders **no header** (common for `text`/`html` panels that paint their own headline).
- `subtitle` shows as a muted second line under the title; omit it to show none.
- Same agg/format ops as text panels (`sum avg last first min max count delta` · `currency percent number compact date`); unknown/empty → `—`. Text columns: `first`/`last` (and the default) return the raw string; a numeric format op forces the numeric path (non-numeric → `—`).

### section panels — grid heading bands (A2/DVT-469)

A `section` panel is a **labelled heading band** that groups the panels beneath it — the panel
`title` is the heading, with an optional one-line `subtitle` and a hairline `rule`. It takes **no
query**, spans full width (`w:24` by convention), and is dvt Core. Use it to break a long grid
page into legible chapters (Gestalt grouping) — e.g. a guided top band, then a "By segment"
section below.

```json
{ "type": "section", "title": "By segment",
  "spec": { "subtitle": "Where the growth came from", "rule": true, "align": "left" } }
```

- `rule` defaults `true` (a hairline below the heading); set `false` for a bare label.
- `align` ∈ `left` (default) `center` `right`. `section.*` component tokens theme it.
- **Not the same as canvas `layout.sections[]`** (ADR-0027, the scroll spine) — that is a layout
  construct; this is a grid panel type. They are distinct and non-overlapping.

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
(need ≥2 rows); `label`, `caption`, `color`, `align` (`left | center`). Optional **`description`** — a plain-text explanation of the metric shown as a hover tooltip; falls back to `caption` when not set. dvt Core (DVT-558).

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

The multi-select control's UX affordances are **automatic — no spec field**: a
tri-state **Select all / Clear all** bulk row, an in-list **search** box (appears once
the option list exceeds 8), an **"N selected"** footer summary, and **batched Apply**
(the re-query fires once on Apply, not per checkbox). For a `not-in` (exclude)
multi-select, author the guarded `WHERE (%(k)s IS NULL OR col NOT IN %(k)s)` so an
empty exclusion means "show all" rather than matching no rows.

**Filter selections round-trip in the URL.** When a viewer adjusts a filter, the
selection is mirrored to the page URL (under an `f.<param>` query param), so a reload
or a **shared/bookmarked link restores the exact filter bar** (multi-select arrays,
scalars, ranges, and dates alike). Dates encode the relative **intent** ("last 7
days"), not the resolved dates, so a shared "last 7 days" re-resolves against the
recipient's current day. No authoring action is required; an unset filter simply
drops its URL param. (View-time URL sync is on for the live viewer and the immersive
present view; the Builder authoring canvas and headless renders don't touch the URL.)

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
`label` — the display label shown in the pill/popover header. Use this instead of
`placeholder` for labelling the control; `placeholder` is now input-hint text only
(shown inside a blank text/search input). Precedence: `label` → `placeholder` → `param`
→ `'Filter'`. `help` — per-control help text; the renderer surfaces an accessible `?`
tooltip on hover + keyboard focus (`aria-describedby`).

`control`: `select` (default) | `multiselect` (binds an array → `IN`-list; target query
uses a bare `IN %(param)s`) | `date-range` | `number-range` | `search` | `toggle`
(tri-state boolean switch; pair with `valueType:"boolean"`, binds a scalar boolean via
the `equals` path; unset = no predicate when `unsetMode:"omit"`) | `number` (single
`<input type=number>` binding one scalar to `param`; use with `operator: gt|gte|lt|lte|
equals` for one-sided numeric comparisons — unlike `number-range` it binds a single
`param`, not `loParam`/`hiParam`) | `segmented` / `button-group` (inline single-select —
a horizontal row of option buttons, same value binding as `select`, ideal for ≤6 options)
| `radio` (inline single-select as a vertical radio list, same binding as `select`) |
`checkbox-list` (inline multiselect as a vertical checkbox list, same array binding as
`multiselect`; engine expands to IN-list, DVT-170). All four inline controls commit
instantly (no Apply step) and share the same option source as their popover counterparts.

`valueType`: `string` (default) | `number` | `date` | `boolean`. `targets`: `"all"`
(default — every panel on the page that declares the key) or an explicit `["panelId", …]`;
a panel that doesn't declare the key is never re-fetched. `values` — a static
`[value | { value, label }]` list (the fallback when there's no value query/rows).
`default` — the initial selection.

**UX and presentation fields.** `apply`: `"live"` | `"button"` — override the default
commit timing. Default: instant controls (`select`, `search`, `toggle`, `number`) commit
on each change; batched controls (`multiselect`, `number-range`, `date-range`) hold in a
draft until the viewer presses Apply. `"button"` forces an explicit Apply step even for
normally-instant controls; `"live"` forces immediate commits even for batched controls.
`required`: `true` — suppresses the clear/All affordance and holds target queries until
a value is chosen (prevents a "fetch everything" on expensive panels while unset). Default
`false`. `chrome`: `"card"` (default) | `"none"` — `"none"` renders the bare control only
(no background, border, shadow, radius, or minHeight floor); use it to embed a filter
inside a `filter-bar` without doubled card-in-card chrome. `width`: `"compact"` |
`"full"` (default) — `"compact"` shrinks the control to fit-content width inside its
grid cell. `density`: `"comfortable"` (default, 36 px min-height) | `"compact"` (28 px
min-height, tighter padding) — useful when multiple filters share a filter-bar.
`icon`: closed enum — `calendar` | `search` | `filter` | `region` | `tag` | `clock` |
`user` | `dollar`. A curated leading glyph inside the filter pill; values outside this
list fail validation (422, ADR-0032 §A3). Omit for no icon.

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
| `gt` | `WHERE col > %(k)s` | a plain scalar (NOT LIKE-wrapped) |
| `gte` | `WHERE col >= %(k)s` | a plain scalar |
| `lt` | `WHERE col < %(k)s` | a plain scalar |
| `lte` | `WHERE col <= %(k)s` | a plain scalar |

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
  `{ unit: "minute" | "hour" | "day" | "week" | "month" | "quarter" | "year", amount: <int ≥ 0>, direction: "past" | "future" }`.
  `amount: 0` = the anchor ("today"). An omitted end is **open-ended** on that side.
  Example: last 30 days = `lo: { unit:"day", amount:30, direction:"past" }`,
  `hi: { unit:"day", amount:0, direction:"past" }`.
  Sub-day units (`hour`, `minute`) resolve to an **absolute ISO 8601 timestamp** (not a
  calendar date) — use them for ops / real-time dashboards that filter by rolling hour or
  minute windows. Day and coarser units resolve to a calendar date.
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

**`filter-bar` — the de-blocky grouping band (DVT-551, dvt Core).** A `filter-bar`
element is a horizontal band that lays out several filter elements inside one light,
theme-aware surface. Its children are **real elements** in the same page's `panels[]`
(never inlined), referenced by id — they remain individually queryable/filterable.
The `filter-bar` itself occupies one grid cell; its children are **NOT** in the page
grid (the semantic pass enforces this, along with existence / no double-placement).

Intended pattern: set `chrome: "none"` on each child filter so the bare pill merges
into the band surface without doubled card-in-card chrome. Use `density: "compact"`
on children to tighten vertical padding when filters share a narrow row.

```json
{ "id": "filter-band", "type": "filter-bar", "title": "Filters",
  "spec": { "panels": ["active-toggle", "status-seg"] } }

{ "id": "active-toggle", "type": "filter", "title": "",
  "spec": { "param": "is_active", "valueField": "val", "control": "toggle",
            "valueType": "boolean", "label": "Active only",
            "chrome": "none", "density": "compact",
            "unsetMode": "omit", "targets": "all" },
  "data": { "rows": [] } }

{ "id": "status-seg", "type": "filter", "title": "",
  "data": { "rows": [{ "val": "open" }, { "val": "closed" }, { "val": "pending" }] },
  "spec": { "param": "status", "valueField": "val", "control": "segmented",
            "label": "Status", "help": "Filter by order lifecycle state",
            "chrome": "none", "density": "compact",
            "allLabel": "All", "unsetMode": "null", "targets": "all" } }
```

The target panel writes the standard guarded predicates and declares both params in
`data.params`:

```sql
where 1=1
    and (%(is_active)s is null or is_active = %(is_active)s)
    and (%(status)s is null or status = %(status)s)
```

Spec fields on `filter-bar`: `panels` (required, ordered child ids) + `title?`
(optional heading above the band).

**`drill`** — a property on **any** panel (not a `type`). Retained for back-compat but **inert on its own** (DVT-555): the left-click trigger was removed. To wire drill navigation, use a `contextMenu` action of `type:"drill"` (right-click menu, see below). The `drill` object fields (`targetPage`, `param`, `valueFrom`, `valueType`) are unchanged and the same binding contract applies — the clicked value enters the target page's panels by name through `data.params`, never interpolated.

**`contextMenu`** — a property on **any** panel (and, additively, on any `table` column,
ADR-0035). The **right-click menu**: an ordered `actions[]` list, each parameterized by the clicked
mark/row, that turns a dashboard from read-only into explorable. This is the correct way to wire drill navigation (DVT-555) and overlay presentation. Like `filter`/`drill` it
is interactive-only (a no-op in a static PNG render). Six action types:

```json
{ "id": "rev-by-region", "type": "chart:bar", "title": "Revenue by Region",
  "data": { "sourceId": "db", "query": "SELECT region, SUM(amount) AS rev FROM demo.public.orders GROUP BY 1" },
  "contextMenu": { "actions": [
    { "type": "drill", "label": "Drill into {category}", "targetPage": "region-detail", "param": "region", "valueFrom": "category", "valueType": "string" }
  ] },
  "spec": { "series": [{ "type": "bar", "dataField": "rev" }] } }
```

The `region-detail` page's panels declare `%(region)s` + a `data.params` `region` default,
exactly like the filter targets above. `targetPage` (required) — a `pages[].id`. `param`
(required) — the params key set on the target page's panels. `valueFrom`: `category`
(default) | `value` | `seriesName` | a field name from the clicked row (use a field name
for tables). `valueType` — as above.

```json
{ "id": "rev-by-region", "type": "chart:bar", "title": "Revenue by Region",
  "data": { "sourceId": "db", "query": "SELECT region, SUM(amount) AS rev, region_id FROM demo.public.orders GROUP BY 1, 3" },
  "spec": { "series": [{ "type": "bar", "dataField": "rev" }] },
  "contextMenu": { "actions": [
    { "type": "filter", "label": "Filter page to {category}", "param": "region", "valueFrom": "category" },
    { "type": "drill",  "label": "Open {category} detail", "targetPage": "region-detail", "param": "region", "valueFrom": "category" },
    { "type": "openOverlay", "label": "Inspect {category}", "targetPage": "region-detail", "present": "modal", "param": "region", "valueFrom": "category" },
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
  `valueType?`. This is the canonical drill trigger (DVT-555: the bare `drill` property is
  now inert). One menu can hold several drill destinations.
- **`openOverlay`** (ADR-0036) — opens `targetPage` as a **modal or drawer overlay** *over*
  the current page (detail-on-demand), instead of navigating away. A superset of `drill`:
  `targetPage` (required), optional `param`/`valueFrom`/`valueType` (the clicked value is
  bound into the overlay page's panels, scoped to the overlay — it never touches the base
  page; closing the overlay discards it). Presentation: `present?` (`modal` default |
  `drawer`), `size?` (`sm`|`md`|`lg`|`full`), `side?` (`left`|`right`, drawer only). Omit
  `param` for a context-free detail/help overlay. The target is **usually a hidden page**
  (see below). In a renderer without overlay support it degrades to a `drill` navigation.
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
| `chart:geo:animated` | a measure spreading across a map over periods (share by state by quarter) | fills **cross-fade** (large maps step) |

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
  "loop": true,                  // restart after the last frame (DEFAULT true; set false to play once)
  "controls": { "placement": "below" }   // "below" (default) | "overlay"
}
```

The shared control bar (play/pause · scrubber · speed · period label · loop, keyboard-operable)
renders automatically; you don't author it. Panels **autoplay and loop on mount** by default so a
dashboard stays alive (set `loop:false` to play once and park on the final frame; OS
*prefers-reduced-motion* starts paused on the first frame). Speed scales the tick interval **and**
the tween duration together so motion stays smooth.

**Smoothness is automatic.** The bar and line races synthesize interpolated sub-frames between your
data periods (ADR-0034 Amendment 2), so sparse data (a handful of periods) still glides instead of
lurching — you don't author intermediate frames. Animated geo **cross-fades** too (Amendment 3): per-region
values interpolate so fills shift smoothly; regions with no data on a side snap at the boundary, and large
maps (>80 regions, e.g. `world`) stay discrete to avoid repaint jank. Reduced-motion steps discretely.

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
a literal (`"#4F46E5"`) or a reference (`"{color.brand-indigo}"`) — with one exception:
the **font-family** slots below are a *closed allow-set*, not free text (see
`typography.fontFamily`). Change one primitive and every chart updates. Useful tokens:

- `chart.series.1..6` — the series palette (drives chart colors automatically)
- `chart.axis.label.color`, `chart.grid.line.color`, `chart.axis.line.color` — chart chrome (retint these on dark surfaces)
- `chart.*` component style (renderer-neutral themeable defaults — ADR-0014 Amendment 1): `chart.font.family`; axis `chart.axis.label.size`/`.weight`, `chart.axis.name.size`/`.weight`, `chart.axis.tick.show`; tooltip card `chart.tooltip.background`/`.border.color`/`.border.width`/`.text.color`/`.text.size`/`.radius`/`.shadow`/`.padding`; legend `chart.legend.icon`/`.item.size`/`.gap`/`.text.size`; bars `chart.bar.maxWidth`/`.categoryGap`/`.radius`; lines `chart.line.width`/`.showSymbol`; plot insets `chart.grid.left`/`.right`/`.top`/`.bottom`. Set any in `theme.tokens.component` or a panel `overrides` block to restyle chrome without raw ECharts passthrough.
- `heatmap.low`, `heatmap.high` — heatmap value ramp endpoints
- `page.background` — the canvas behind panels (or set `page.background` per page via `pages[].background`)
- `panel.background`, `panel.border.color`, `panel.radius`, `panel.shadow` — per-card chrome
- `panel.title.size`, `panel.title.weight`
- `text.primary`, `text.secondary`, `text.muted`
- `typography.fontFamily` (and any `*.family` token) — a **closed allow-set, not free text**. Use exactly one of these stacks (or a `"{typography.fontFamily}"` ref): `Inter Variable, Inter, sans-serif` · `Inter, sans-serif` · `JetBrains Mono, monospace` · `JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace` · `ui-sans-serif, system-ui, sans-serif` · `ui-serif, Georgia, serif` · `ui-monospace, monospace`. An off-list stack (e.g. `"Helvetica, Arial, sans-serif"`) is **rejected with a 422 by `dvt_spec_validate`** — a font stack has no safe-literal grammar, so the schema gates it as an enum, not free text (DVT-294, ADR-0032 §A3).

**Per-panel overrides:** any panel may set `"overrides": { "panel.background": "#0F1E2E", "text.primary": "#E8EEF5", "chart.axis.label.color": "#8DA2B8", "chart.grid.line.color": "rgba(255,255,255,0.06)", "chart.series.1": "#5BBFBA" }`
to restyle just that card. This is how you make one panel dark, recolor a single
chart, or retint axes/gridlines — without touching the rest. A dark page is just a
gradient `pages[].background` plus a shared dark `overrides` block on each card.

### Theme presets — `exec-light` · `exec-dark` · `exec-brand` (A7/DVT-471, ADR-0043)

For a polished starting point, set `theme.preset` to a named, pre-baked token pack instead of
hand-authoring every token:

```json
{ "theme": { "preset": "exec-dark", "tokens": { "primitive": {}, "semantic": {} } } }
```

- **Closed enum:** `exec-light`, `exec-dark`, `exec-brand`. An off-list value is **rejected by
  `dvt_spec_validate`** (and fails closed to an empty tier at resolve time).
- `theme.tokens` (with `primitive` + `semantic`) is **still required** alongside `preset` — leave
  the maps empty to take the preset as-is, or fill keys to override it.
- **Precedence (lowest → highest):** `BUILTIN_DEFAULTS → org baseline → PRESET → your primitive →
  semantic → component → per-element overrides`. So the dashboard's own tokens always win per-key,
  and the preset sits **above** the org baseline.
- **Org-brand inheritance:** `exec-brand` inherits org branding by **omitting** the accent palette
  (`chart.series.1`–`6`) and the page background (`color.page` / `page.background`) — the org
  baseline beneath the preset flows through for exactly those keys. Do **not** hard-code accent or
  background tokens at the dashboard tier or you block co-branding (ADR-0037). Pick `exec-dark` for
  presentation/kiosk, `exec-light` for embedded/print/daytime, `exec-brand` when co-branding a tenant.
- The spec stays **dvt Core** — presets are just a token tier.

### Color encoding (DVT-411 / E7)

dvt provides three declarative color-encoding directives on `ChartSpec` (all dvt Core, stripped before the ECharts option is emitted):

**`palette`** — override the series palette with a named categorical color scheme:

```json
{ "palette": "okabe-ito" }
```

Registered schemes: `okabe-ito` (colorblind-safe, 8 colors), `set2` (soft, print-safe, 8 colors), `viridis`, `magma`, `blues` (sequential), `rdbu`, `brbg`, `spectral` (diverging). An invalid name is silently ignored (keeps the default brand palette). A raw passthrough `color` array in the spec still wins.

**`colorRules`** — conditional per-datum color (bar, line, area, scatter, pie, donut). Rules are evaluated in order; the first match wins:

```json
{
  "colorRules": [
    { "when": { "field": "delta", "op": "lt", "value": 0 }, "color": "{semantic.negative}" },
    { "when": { "field": "delta", "op": "gt", "value": 0 }, "color": "{semantic.positive}" }
  ]
}
```

Operators: `lt` / `lte` / `gt` / `gte` / `eq` (numeric or string), `in` (value is an array — membership check), `between` (value is `[lo, hi]` — inclusive range). `color` may be a hex literal or a `{token}` ref. Absent columns skip the rule (no throw).

**`colorScale`** — continuous or stepped value-to-color encoding for heatmap and scatter:

```json
{ "colorScale": { "type": "sequential", "scheme": "viridis" } }
{ "colorScale": { "type": "diverging",  "scheme": "rdbu", "domainMid": 0 } }
{ "colorScale": { "type": "piecewise",  "scheme": "blues", "buckets": 5, "domain": [0, 100] } }
```

Compiles to an ECharts `visualMap`. `domain: [min, max]` overrides the auto-computed data extent. `domainMid` centers a diverging ramp. `buckets` splits a piecewise map into equal-width bins.

When a scatter sets both `colorScale` and `colorRules`, `colorRules` takes precedence per datum (a rule-matched point keeps its explicit color; unmatched points are colored by the scale).

**Semantic tokens** — built-in defaults (overridable per dashboard or org):

- `{semantic.positive}` → `#16A34A` (green-600)
- `{semantic.negative}` → `#DC2626` (red-600)
- `{semantic.warning}` → `#D97706` (amber-600)

Use these in `colorRules.color` to get consistent traffic-light color on unthemed dashboards. Override via `theme.tokens.semantic` to retheme globally.

All color values (hex, rgb, token refs) are validated through the SSRF guard (`safeChartColor`) — `image://`, `url(`, `javascript:`, and `expression(` are rejected at compile time. Raw ECharts `visualMap` and per-series `itemStyle.color` remain the Full escape hatch and win over dvt Core directives.

### Annotations (DVT-413 / E8)

dvt provides a declarative `annotations[]` array on `ChartSpec` for reference lines, shaded bands, and callout markers — the "draw a line at our goal/SLA/budget" feature. Annotations are *dvt Core* (portable, themed, validated) and are stripped before the ECharts option is emitted.

**Supported on cartesian families only** (line/area/bar/scatter/combo). Ignored on axis-less families (pie, gauge, funnel, sankey).

**Annotation types:**

- `"line"` — a full-width/height reference rule (`markLine`)
- `"band"` — a shaded range (`markArea`)
- `"point"` — a single marker at a coordinate (`markPoint`)
- `"text"` — a label callout with no symbol (`markPoint` with `symbol:"none"`)

**Placement keys:**

- `value` (number) — fixed scalar position on the chosen axis (`axis:"y"` for horizontal rules, `axis:"x"` for vertical rules)
- `from` + `to` (numbers, *band only*) — the band extent on `axis`
- `at` (string or number) — categorical or time position on the x-axis for event markers (e.g. `"2024-06-01"` or a category label); emitted as a coordinate, never evaluated
- `stat` (`"avg"` | `"median"` | `"min"` | `"max"`) — computed at compile time from the host series' bound data and emitted as a numeric literal; a stat over empty or all-non-numeric data *drops the annotation* (no NaN coordinate)

**Example — target line + average line + launch marker + target-zone band:**

```json
{
  "annotations": [
    {
      "type": "line",
      "axis": "y",
      "value": 100,
      "label": "Target",
      "style": "dashed",
      "color": "{semantic.warning}"
    },
    {
      "type": "line",
      "axis": "y",
      "stat": "avg",
      "label": "Average"
    },
    {
      "type": "line",
      "axis": "x",
      "at": "2024-06-01",
      "label": "Launch"
    },
    {
      "type": "band",
      "axis": "y",
      "from": 80,
      "to": 100,
      "label": "Target zone",
      "color": "{semantic.positive}",
      "opacity": 0.12
    }
  ]
}
```

**Per-annotation style keys:**

- `style` — `"solid"` | `"dashed"` | `"dotted"` (line type, defaults to `"dashed"`)
- `width` — line width in px for `line` annotations (defaults to the `annotation.line.width` token, `1`; clamped to `(0, 100]`)
- `color` — hex literal or token ref; validated by `safeChartColor` — `image://`, `url(`, `javascript:`, `expression(` are rejected to the default
- `opacity` — `[0, 1]` fill opacity for bands; clamped defensively at compile time
- `label` — either a **plain string** (just the text) *or* a **styled object** (DVT-493):
  - `text` (required) — the label text (truncated to 256 chars)
  - `color` — label text color (hex or token ref, `safeChartColor`-guarded). **Defaults to the mark's own color** for `line`/`point` labels (so the label reads as part of the line, not a decoupled grey); band labels default to the `annotation.label.color` token
  - `size` — font size in px (clamped to `[1, 100]`; defaults to the `annotation.label.size` token, `11`)
  - `bold` — `true` for a bold font weight
  - `italic` — `true` for an italic font style
  - `maxWidth` — max label width in px; **enables wrapping** (the text breaks onto multiple lines instead of running off the plot). Clamped to `[1, 2000]`
  - `position` (DVT-500) — placement, mapped per mark type: `line` honors `start`/`middle`/`end` (along the line, kept inside the grid); `point`/`text`/`band` honor `top`/`bottom`/`left`/`right`/`inside`. Values that don't apply to the mark type fall back to the default (line: end; point/text: top). Use it to spread several labels that would otherwise stack
  - `offset` (DVT-500) — a pixel nudge `[dx, dy]` applied to the label (e.g. `[0, 12]` bumps it down). Each component clamped to `[-1000, 1000]`
  - `rotate` (DVT-500) — label rotation in degrees, clamped `[-90, 90]`. Vertical (x-axis) event-marker labels default to `0` (horizontal) so they read normally instead of running along the line

  ```json
  { "type": "line", "axis": "y", "value": 100, "color": "#DC2626",
    "width": 2, "style": "solid",
    "label": { "text": "Hard limit — do not exceed", "bold": true,
               "maxWidth": 120, "position": "start", "offset": [0, 10] } }
  ```

  Labels are always emitted as a **static string** — no `backgroundColor`/`rich` (the `image://` SSRF sinks, ADR-0041 §5); reference-line labels default to `insideEndTop` so they stay inside the plot (DVT-492). `point` markers render as a small circle with the label above it; **lines and point/text markers are interactive** — hover shows the label + value (bands stay passive so they don't block the axis tooltip) (DVT-500).

**Annotation tokens** (`annotation.*` namespace, overridable per dashboard or org):

- `annotation.line.color` — default `#71717A` (zinc-500)
- `annotation.line.width` — default `1`
- `annotation.line.style` — default `"dashed"`
- `annotation.band.color` — default `#E4E4E7`
- `annotation.band.opacity` — default `0.12`
- `annotation.label.color` — default `#52525B`
- `annotation.label.size` — default `11`
- `annotation.point.color` — default `#71717A`
- `annotation.font` — defaults to `chart.font.family`

**Semantic tokens for annotation colors** (same traffic-light tokens as `colorRules`):

- `{semantic.positive}` → `#16A34A` (green-600)
- `{semantic.negative}` → `#DC2626` (red-600)
- `{semantic.warning}` → `#D97706` (amber-600)

**Full escape hatch:** a raw `series[].markLine` / `series[].markArea` / `series[].markPoint` set directly on a series is the ECharts passthrough (`layer:echarts`) and takes precedence over dvt-layer annotations for that series. dvt *defensively themes* these raw marks — the neutral annotation defaults are merged underneath the author's mark (so the escape hatch no longer renders raw ECharts blue), and every color leaf is run through `safeChartColor` to block `image://` SSRF values.

#### Query-bound thresholds (DVT-419)

Two additional placement keys let an annotation read its scalar position from the panel's **own result rows** rather than a literal — join your target or SLA value into the query (e.g. via `CROSS JOIN` or a subquery that broadcasts it as a repeated constant column) and point the annotation at that column. An absent or all-non-numeric column **drops the annotation silently** at render time (the server cannot see live query columns; this is by design per ADR-0011).

- `valueField` (string) — take the **first finite numeric value** of that named column across the result rows (case-tolerant: exact match wins, then case-insensitive unique match). Applies to `line`, `point`, and `text` types.
- `of` (string) — used together with `stat` to compute the stat over a **named result column** instead of the host series' bound data. Without `of`, `stat` keeps its original meaning (computed over the host series' values).

Placement precedence: `stat` → `valueField` → `value` (literal) → `at` (categorical, `line` only).

```json
{ "type": "line", "axis": "y", "valueField": "plan_target", "label": "Plan" }
```

```json
{ "type": "line", "axis": "y", "stat": "avg", "of": "revenue", "label": "Avg revenue" }
```

### Chart footnotes and source note (DVT-569, ADR-0045 §3)

*dvt Core.* `ChartSpec.footnotes[]` and `ChartSpec.sourceNote` mirror the table footnotes vocabulary (DVT-517) for charts — rendered as a notes block beneath the chart visualization.

- **`footnotes[]`** — array of `{ text, mark?, where?: { column } }`. `where.column` anchors the superscript to a matching series or axis label; omit `where` and the note appears in the block without an anchor.
- **`sourceNote`** — string rendered after any `footnotes[]` as a source-attribution line.

Both `text` and `sourceNote` are **sanitized markdown** (https/mailto links only; no raw HTML).

```jsonc
{
  "type": "chart:bar",
  "data": { "sourceId": "db", "query": "SELECT quarter, SUM(revenue) AS revenue FROM analytics.public.orders GROUP BY 1" },
  "spec": {
    "series": [{ "type": "bar", "dataField": "revenue" }],
    "footnotes": [
      {
        "where": { "column": "revenue" },
        "text": "Revenue recognized at contract close date; excludes refunds."
      }
    ],
    "sourceNote": "Source: [analytics.public.orders](https://docs.example.com/orders)"
  }
}
```

See "Document as you build" below for when to add footnotes vs. intent/assumptions.

## Formats

`format` objects are dvt's portable number-display vocabulary (dvt Core) — they compile to a formatter at render time so a spec stays declarative (no JS). One shape, reused everywhere a value is rendered: table columns, `valueFormat`, axis labels, tooltip fields, value labels, funnel rates.

`{ "type": "currency"|"percentage"|"number"|"compact"|"date", "decimals": 1, "currency": "USD", "compact": true, "prefix": "~", "suffix": " /mo", "locale": "en-US" }`

- **type** — `number` (grouped), `currency` (with `currency` ISO code), `percentage` (input is a whole-number percent — `12.5` → `12.5%`), `compact` (1234567 → `1.2M`), `date`.
- **decimals** — fixed decimal places.
- **compact** — K/M/B/T notation; combine with `currency` for `$1.2M`.
- **prefix / suffix** — arbitrary affixes wrapped around the formatted value (empty/blank values stay blank — no bare affix).
- **locale** — BCP-47 separators; defaults to `en-US` for deterministic output.

Place a format where a value renders: `"axisLabel": { "format": {…} }`, a table column `format`, `valueFormat` on a chart, a `tooltip.fields` entry, or a value `label` (see "Number display" above).

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

**Let the chart reference drive selection.** Call `dvt_chart_reference()` with no arguments to get the catalog — every chart type with a one-line `whenToUse` and `dataShapes` tags (`time-series`, `part-to-whole`, `correlation`, `flow`, `distribution`, `hierarchy`, `geo`, `categorical-comparison`, `ranking`, `multivariate`, `network`, `single-kpi`). Match your profiled data's shape to a type, then call `dvt_chart_reference(chart_type)` for its option summary and `dvt_chart_reference(chart_type, property_path)` to drill into a specific property before you author it. Validate the result with `dvt_spec_validate`.

### 4. Build, then SEE it — verify and iterate

1. Write the spec (mechanics above). Bind each panel to a fully-qualified `query`.
2. Validate with `dvt_spec_validate` — fix field errors and heed `warnings` (typos, and panels that will render EMPTY).
3. **Render and actually look at it:** `dvt_dashboard_render_inline` at desktop (`width` ~1280–1440) AND mobile (`width` ~390–414), for each `page`. Read the image: is there a clear headline? Any unreadable text, squished labels, empty panels, flat bars? Does it answer the question?
4. Iterate on what you saw, then save via the API / MCP. **Don't ship a dashboard you haven't looked at.**

### 5. Premium polish — the exec-grade checklist

For a C-suite / board / prospect-facing dashboard, run this final gate (every item TRUE) before
you ship. It's the authoring-skill condensation of the executive-dashboard playbook:

1. **One key message** — answer-first headline top-left before any chart (Minto/BLUF), with live `{{ }}` values.
2. **Answer-first ordering** — hero → supporting groups → detail (inverted pyramid); no chart above the key message.
3. **Guided band, then explore** — a full-width headline + KPI strip + insight sentence reads on its own; filters/drill live below it, never above.
4. **One hero, ≥2 size tiers** — the hero panel is ≥2× a standard panel's area; **never an all-same-size grid**.
5. **Top-left = most important** — respect F/Z reading paths.
6. **KPI strip: 3–6 cards** — each with value + signed % delta + sparkline + target, semantic color only.
7. **Takeaway titles** — titles state the insight with injected values, not column names.
8. **Narrative block per section** — a `text` panel with live `{{ }}` precedes the chart it explains.
9. **Annotation callouts** on the hero chart's target/peak/inflection with a cause phrase (cap 3/chart).
10. **Section headers** (`section` panels) group the grid into legible chapters.
11. **Restrained palette** — neutral base + 1 accent + semantic tokens; color = meaning only. Consider a `theme.preset`.
12. **Flat & clean** — no gradient/shadow/3D on data; faint horizontal gridlines only; high data-ink ratio.
13. **Humanized, consistent units & locked axes** for fair comparison.
14. **No pies >3 slices, no dual-axis, no rainbow heatmaps** — sorted bars / split panels / single-hue ramps.
15. **Render and look at it** — desktop AND mobile; dark mode is first-class, not an inversion filter.

(The full playbook — audience framing, KPI-card anatomy, the anti-pattern table — lives in the
`executive-dashboard` design skill; this checklist is the spec-author's pocket version.)

## Document as you build — self-documenting dashboards (ADR-0045)

Claude authors the spec — so Claude should document it. dvt's Documentation Layer (ADR-0045) gives you a structured place to record **why** each element exists, **what assumptions** it rests on, and **what caveats** a reader needs. Writing this at authoring time costs almost nothing; reconstructing it from a cold read later is expensive.

### Two audiences, two field families

The doc layer distinguishes two scopes:

| Audience | Where | Fields | Rendered? |
|---|---|---|---|
| **Human / exposed** | `ChartSpec.footnotes[]` / `sourceNote`, `TableSpec.footnotes[]` / `sourceNote`, `Page.doc.description`, `Page.doc.intent` | Footnotes, source attribution, page description/intent | Yes — rendered in chart/table notes block and the docs drawer |
| **Research / agent** | `Page.doc.assumptions[]`, `Page.doc.notes`, `meta.panels[id].purpose`, `meta.panels[id].intent`, `meta.panels[id].assumptions[]`, `meta.panels[id].notes` | Analytical assumptions, data-quality caveats, element rationale | No — read over MCP, never rendered in the UI |

Use **exposed fields** for caveats, source attribution, and narrative context that human readers should see. Use **research fields** to document the analytical reasoning that an AI agent needs to reproduce or extend the dashboard.

### Chart footnotes and source attribution

`ChartSpec.footnotes[]` + `ChartSpec.sourceNote` — see "Chart footnotes and source note" above for the full reference. Use whenever a metric has a definition caveat or a data-source citation a viewer needs:

```jsonc
{
  "type": "chart:line",
  "spec": {
    "series": [{ "type": "line", "dataField": "arr" }],
    "footnotes": [
      { "where": { "column": "arr" }, "text": "ARR computed at contract start date; excludes expansions mid-period." }
    ],
    "sourceNote": "Source: analytics.public.contracts"
  }
}
```

### Page documentation (`Page.doc`)

`Page.doc` attaches to a page object inside `pages[]`. `description` and `intent` are **exposed** — rendered as sanitized inline markdown in the docs drawer. `assumptions[]` and `notes` are **research-audience** only.

```jsonc
{
  "id": "pipeline",
  "title": "Pipeline Health",
  "doc": {
    "description": "Open pipeline as of the last CRM sync. Excludes closed-won and closed-lost.",
    "intent": "Enable the VP of Sales to identify whether pipeline coverage (3× quota) is on track before the weekly forecast call.",
    "assumptions": [
      {
        "text": "CRM sync runs nightly at 02:00 UTC; same-day closes may not appear until tomorrow.",
        "assertedBy": "agent"
      }
    ],
    "notes": "stage_order column drives the funnel sequence; reorder the lookup table to change funnel stage ranks."
  }
}
```

`ProvenanceClaim` shape: `{ "text": string, "assertedBy": "agent" | "human", "validatedAt"?: ISO-8601 }`. Use `assertedBy: "human"` only when a human has explicitly confirmed the claim; `agent` is the honest default for AI-asserted assumptions.

### Element intent and assumptions (`meta.panels[id]`)

Per-element documentation lives in the dashboard manifest at `meta.panels`, keyed by panel `id`. These fields are **agent-facing** — never rendered in the UI, read over `dvt_dashboard_docs`. They let a future agent understand what decision each panel informs and what analytical choices were made.

```jsonc
{
  "meta": {
    "title": "Pipeline Health",
    "brief": "3× coverage holds in ENT; SMB slipping.",
    "panels": {
      "pipeline-funnel": {
        "purpose": "Show stage-by-stage conversion so the team can see where deals stall.",
        "serves_question": 0,
        "intent": "Highlight the Proposal→Negotiation drop, which is the bottleneck this quarter.",
        "assumptions": [
          {
            "text": "Win rate denominator is all deals reaching Proposal stage, not total created.",
            "assertedBy": "agent"
          }
        ],
        "notes": "If deal volume is <20 per stage, funnel rates become statistically noisy — caveat verbally in the forecast meeting."
      }
    }
  }
}
```

`serves_question` is a zero-based index into `meta.keyQuestions` — the dashboard-level list of the questions the dashboard is designed to answer. An out-of-range index logs a ProvenanceCheck WARN; omit for decoration/navigation panels.

### Researching existing dashboards with `dvt_dashboard_docs`

Before authoring a new dashboard that covers the same subject area as an existing one, call `dvt_dashboard_docs` to read the existing dashboard's full documentation tree. It returns:

- **`provenance`** — dashboard-level meta (brief, purpose, audience, keyQuestions, assumptions, conclusions, findings, tags, readme, decisions, dataAsOf).
- **`pages[*].doc`** — per-page description, intent, assumptions, notes.
- **`elements[*]`** — per-element purpose, intent, assumptions, notes, plus **`sql`** — the raw stored `data.query` for each element.

The SQL is a **read-only reference** — dvt exposes it so you can understand exactly how each metric was built (joins, filters, grain, table names). dvt never executes it via this tool (ADR-0011). If you want to run the SQL, execute it yourself in your warehouse CLI (snowsql, psql, bq, etc.).

```
dvt_dashboard_docs(dashboard_id="<uuid>")
```

**When to call it:**

- You are authoring a dashboard that should reuse a metric definition already captured in another dashboard. Pull the SQL from `elements[*].sql` so you copy the exact join/filter logic rather than re-deriving it.
- You need to understand the analytical assumptions behind another team's numbers before building a comparison or follow-on analysis. Read `elements[*].assumptions` instead of guessing.
- You want to confirm data freshness or scope before citing another dashboard's numbers. Check `provenance.dataAsOf` and `provenance.assumptions`.

This tool is far cheaper than `dvt_dashboard_get(format="full")` when you only need the documentation — it omits the heavy ECharts/layout spec payload.

### Quick reference — which field to use

| What you want to express | Field | Audience |
|---|---|---|
| Where this data comes from | `sourceNote` (chart or table) | Human |
| Metric definition caveat | `footnotes[*].text` (chart or table) | Human |
| What this page is about | `Page.doc.description` | Human |
| Why this page exists / what decision it supports | `Page.doc.intent` | Human |
| Analytical assumptions behind this page | `Page.doc.assumptions[]` | Agent / research |
| Data-quality caveats for this page | `Page.doc.notes` | Agent / research |
| Why this element exists | `meta.panels[id].purpose` | Agent / research |
| Which key question this element answers | `meta.panels[id].serves_question` | Agent / research |
| What decision this element informs | `meta.panels[id].intent` | Agent / research |
| Metric-level assumptions (joins, filters, grain) | `meta.panels[id].assumptions[]` | Agent / research |
| Data-quality caveats for this element | `meta.panels[id].notes` | Agent / research |

## Rules

- No JS functions in specs — use `format` objects and the `{ "$dvtRef": "formatter:pie-label@1" }` ref instead. `$dvtRef` ids are **versioned** (`<kind>:<name>@<version>`, e.g. `formatter:usd-compact@1`) and must be one of the registered ids — an unknown or unversioned ref is rejected at write time (ADR-0016).
- Every `layout.items[*].i` must match a panel `id`.
- Keep series colors as `{chart.series.N}` refs so the theme stays consistent.
- Prefer `pages` for anything with more than ~8 panels.
- Always fully-qualify table names in `data.query` as `database.schema.table` — connections may carry no default database/schema.
- Write SQL in the canonical dvt style — lowercase keywords, leading commas, `where 1=1` guard, `%(key)s` bindings (see `docs/02-spec/sql-style-guide.md`).

The machine-readable JSON Schema lives at `spec/schema/dashboard.schema.json` in the dvt repo — validate against it when in doubt.
