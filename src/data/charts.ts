/**
 * Chart catalog for the /spec gallery.
 *
 * Each entry carries a real (JSON-serializable) ECharts option so the gallery
 * renders the actual ECharts 6 engine dvt ships with — not a mockup. dvt type
 * names and selection guidance mirror dvt_chart_reference (ADR-0022).
 *
 * Keep every `option` pure data: no functions (formatters must be strings),
 * because options are serialized into the page and parsed client-side.
 */

export type ChartKind = 'chart' | 'table' | 'geo';

export interface ChartDef {
  /** dvt spec type, e.g. "chart:bar:stacked" */
  dvtType: string;
  title: string;
  blurb: string;
  kind?: ChartKind;
  /** ECharts option (for kind: 'chart') */
  option?: Record<string, unknown>;
  /** client animation behaviour, drives the runtime */
  animate?: 'race-bar' | 'progressive-line';
  /** short dvt spec fragment shown behind the "view spec" disclosure */
  spec: string;
  /** structured table payload (for kind: 'table') */
  table?: TableDef;
  /** flag a flagship example for the carousel */
  featured?: boolean;
}

/** One cell in a gallery table demo. Every field is optional so a cell can be a
 *  bare value, a conditional-formatted value, an inline data bar, a heat tint,
 *  or an in-cell visualization (sparkline / bullet / win-loss). */
export interface TableCellDef {
  v?: string;
  /** semantic delta colour */
  tone?: 'up' | 'down' | 'muted';
  /** inline horizontal data bar, 0–100 */
  bar?: number;
  /** continuous colour-scale tint, 0–100 */
  heat?: number;
  /** in-cell sparkline series */
  spark?: number[];
  sparkKind?: 'line' | 'area' | 'bar';
  /** in-cell bullet: actual vs target on a 0–max track */
  bullet?: { value: number; target: number; max?: number };
  /** in-cell win/loss/tie strip (1 | -1 | 0) */
  winloss?: number[];
  /** conditional-format background / text colour (any CSS colour) */
  fill?: string;
  fg?: string;
  bold?: boolean;
}

export interface TableRowDef {
  cells: Record<string, TableCellDef>;
  /** 'group' = full-width group header; 'subtotal' / 'total' = emphasised summary row */
  kind?: 'group' | 'subtotal' | 'total';
  /** label for a group-header row */
  label?: string;
}

export interface TableDef {
  columns: { key: string; label: string; align?: 'left' | 'right' }[];
  /** spanning header groups rendered as a second header row */
  columnGroups?: { label: string; span: number }[];
  rows: TableRowDef[];
}

export interface Family {
  id: string;
  label: string;
  blurb: string;
  charts: ChartDef[];
}

/* ── shared palette + base fragments ─────────────────────────────── */
// "Cool Analytical" chart-series palette — mirrors the product default
// (dvt web echarts-theme FALLBACK_PALETTE / exec-light preset, DVT-742).
// Declared as --chart-series-N tokens in styles/tokens.css; kept as literals
// here because ECharts options are serialized to JSON (no CSS var resolution).
// NOTE: these are chart-series slots, NOT brand primitives — e.g. `teal`
// (#1F9E96, series-2) is distinct from --color-brand-teal (#0D9488).
const C = {
  indigo: '#4F46E5',
  teal:   '#1F9E96',
  sky:    '#5B9BD5',
  amber:  '#E0A93B',
  violet: '#8B7EC8',
  slate:  '#64748B',
  // supporting tones (not part of the categorical cycle)
  indigoLight: '#818CF8',
  navy:        '#16263A', // dark anchor for stacked segments / wordmark-tone
  green:       '#10B981', // financial up (candlestick)
  rose:        '#EF4444', // financial down (candlestick)
};
const PALETTE = [C.indigo, C.teal, C.sky, C.amber, C.violet, C.slate];

const FONT = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';
const axisLabel = { color: '#A1A1AA', fontSize: 11, fontFamily: FONT };
const splitLine = { lineStyle: { color: '#F4F4F5' } };
const baseAxisLine = { lineStyle: { color: '#E4E4E7' } };
const grid = { left: 6, right: 16, top: 22, bottom: 4, containLabel: true };
// Cartesian charts that carry a bottom legend need extra room so the legend
// doesn't collide with the x-axis labels.
const gridLegend = { left: 6, right: 16, top: 16, bottom: 30, containLabel: true };
const tooltip = {
  trigger: 'axis' as const,
  backgroundColor: '#18181B',
  borderColor: '#27272A',
  textStyle: { color: '#FAFAFA', fontSize: 11, fontFamily: FONT },
};
const tooltipItem = { ...tooltip, trigger: 'item' as const };
const textStyle = { fontFamily: FONT };

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const catX = (_data: number[], name = '') => ({
  type: 'category',
  data: months,
  name,
  axisLabel,
  axisLine: baseAxisLine,
  axisTick: { show: false },
  boundaryGap: true,
});
const valY = (opts: Record<string, unknown> = {}) => ({
  type: 'value',
  axisLabel,
  splitLine,
  axisLine: { show: false },
  axisTick: { show: false },
  ...opts,
});

/* ── COMPARISON ──────────────────────────────────────────────────── */
const comparison: ChartDef[] = [
  {
    dvtType: 'chart:bar',
    title: 'Bar',
    blurb: 'The BI workhorse — compare a measure across categories.',
    option: {
      color: PALETTE, textStyle, grid, tooltip,
      xAxis: catX([], 'Month'),
      yAxis: valY({ name: 'Revenue ($k)' }),
      series: [{ type: 'bar', data: [120, 150, 178, 168, 212, 264], barMaxWidth: 34, itemStyle: { color: C.indigo, borderRadius: [4, 4, 0, 0] } }],
    },
    spec: `{ "type": "chart:bar",
  "data": { "query": "SELECT month, SUM(revenue) AS revenue\\n            FROM sales GROUP BY month" },
  "spec": { "series": [{ "type": "bar", "barMaxWidth": 48 }] } }`,
  },
  {
    dvtType: 'chart:bar:horizontal',
    title: 'Horizontal bar',
    blurb: 'Long labels or top-N rankings get room to breathe.',
    option: {
      color: PALETTE, textStyle, grid: { ...grid, left: 8 }, tooltip,
      xAxis: valY(),
      yAxis: { type: 'category', data: ['Free', 'Startup', 'SMB', 'Mid-Market', 'Enterprise'], axisLabel, axisLine: baseAxisLine, axisTick: { show: false } },
      series: [{ type: 'bar', data: [40, 92, 180, 264, 322], barMaxWidth: 18, itemStyle: { color: C.sky, borderRadius: [0, 4, 4, 0] } }],
    },
    spec: `{ "type": "chart:bar:horizontal",
  "spec": { "series": [{ "type": "bar" }],
            "yAxis": { "type": "category" } } }`,
  },
  {
    dvtType: 'chart:bar:stacked',
    title: 'Stacked bar',
    blurb: 'Total and parts at once — best with 2–4 series.',
    option: {
      color: PALETTE, textStyle, grid: gridLegend, tooltip,
      legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: axisLabel },
      xAxis: catX([]),
      yAxis: valY(),
      series: [
        { name: 'Starter', type: 'bar', stack: 'p', data: [30, 38, 44, 40, 52, 60], itemStyle: { color: C.indigoLight } },
        { name: 'Pro', type: 'bar', stack: 'p', data: [50, 62, 70, 66, 82, 96], itemStyle: { color: C.indigo } },
        { name: 'Enterprise', type: 'bar', stack: 'p', data: [40, 50, 64, 62, 78, 108], itemStyle: { color: C.navy, borderRadius: [3, 3, 0, 0] } },
      ],
    },
    spec: `{ "type": "chart:bar:stacked",
  "spec": { "series": [
    { "type": "bar", "stack": "plan" },
    { "type": "bar", "stack": "plan" } ] } }`,
  },
  {
    dvtType: 'chart:bar:stacked-percent',
    title: '100% stacked',
    blurb: 'Composition share normalized to 100% across categories.',
    option: {
      color: PALETTE, textStyle, grid: gridLegend, tooltip,
      legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: axisLabel },
      xAxis: catX([]),
      yAxis: valY({ max: 100, axisLabel: { ...axisLabel, formatter: '{value}%' } }),
      series: [
        { name: 'Starter', type: 'bar', stack: 'p', data: [25, 25, 24, 23, 24, 23], itemStyle: { color: C.indigoLight } },
        { name: 'Pro', type: 'bar', stack: 'p', data: [42, 41, 40, 40, 39, 37], itemStyle: { color: C.indigo } },
        { name: 'Enterprise', type: 'bar', stack: 'p', data: [33, 34, 36, 37, 37, 40], itemStyle: { color: C.navy, borderRadius: [3, 3, 0, 0] } },
      ],
    },
    spec: `{ "type": "chart:bar:stacked-percent",
  "spec": { "series": [{ "type": "bar", "stack": "mix" }],
            "yAxis": { "max": 100 } } }`,
  },
  {
    dvtType: 'chart:pictorial-bar',
    title: 'Pictorial bar',
    blurb: 'Icon-repeated bars for editorial, infographic moments.',
    option: {
      color: PALETTE, textStyle, grid: { ...grid, top: 28 }, tooltip: tooltipItem,
      xAxis: { type: 'category', data: ['NA', 'EMEA', 'APAC', 'LATAM'], axisLabel, axisLine: baseAxisLine, axisTick: { show: false } },
      yAxis: valY({ splitLine: { show: false }, axisLabel: { show: false } }),
      series: [{
        type: 'pictorialBar', symbol: 'circle', symbolRepeat: true, symbolSize: [12, 12],
        symbolMargin: '28%', symbolClip: true, data: [82, 64, 48, 26],
        itemStyle: { color: C.indigo }, label: { show: true, position: 'top', color: '#71717A', fontFamily: FONT },
      }],
    },
    spec: `{ "type": "chart:pictorial-bar",
  "spec": { "series": [{ "type": "pictorialBar",
              "symbol": "circle", "symbolRepeat": true }] } }`,
  },
];

/* ── TREND ───────────────────────────────────────────────────────── */
const weeks = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8'];
const trend: ChartDef[] = [
  {
    dvtType: 'chart:line',
    title: 'Line',
    blurb: 'The primary chart for trends over time.',
    option: {
      color: PALETTE, textStyle, grid, tooltip,
      xAxis: { type: 'category', data: weeks, boundaryGap: false, axisLabel, axisLine: baseAxisLine, axisTick: { show: false } },
      yAxis: valY(),
      series: [{ type: 'line', data: [40, 52, 49, 63, 71, 68, 84, 95], showSymbol: false, lineStyle: { width: 2.5, color: C.indigo }, itemStyle: { color: C.indigo } }],
    },
    spec: `{ "type": "chart:line",
  "spec": { "series": [{ "type": "line" }] } }`,
  },
  {
    dvtType: 'chart:line:smooth',
    title: 'Smooth line',
    blurb: 'Spline interpolation — only for truly continuous data.',
    option: {
      color: PALETTE, textStyle, grid: gridLegend, tooltip,
      legend: { bottom: 0, itemWidth: 14, itemHeight: 8, textStyle: axisLabel },
      xAxis: { type: 'category', data: weeks, boundaryGap: false, axisLabel, axisLine: baseAxisLine, axisTick: { show: false } },
      yAxis: valY(),
      series: [
        { name: 'This year', type: 'line', smooth: true, data: [40, 52, 49, 63, 71, 68, 84, 95], showSymbol: false, lineStyle: { width: 2.5, color: C.indigo } },
        { name: 'Last year', type: 'line', smooth: true, data: [30, 34, 38, 41, 44, 48, 52, 58], showSymbol: false, lineStyle: { width: 2, color: C.sky, type: 'dashed' } },
      ],
    },
    spec: `{ "type": "chart:line:smooth",
  "spec": { "series": [{ "type": "line", "smooth": true }] } }`,
  },
  {
    dvtType: 'chart:line:step',
    title: 'Step line',
    blurb: 'Discrete state changes — values hold between events.',
    option: {
      color: PALETTE, textStyle, grid, tooltip,
      xAxis: { type: 'category', data: months, boundaryGap: false, axisLabel, axisLine: baseAxisLine, axisTick: { show: false } },
      yAxis: valY({ name: 'Plan tier' }),
      series: [{ type: 'line', step: 'end', data: [1, 1, 2, 2, 2, 3], showSymbol: true, symbolSize: 6, lineStyle: { width: 2.5, color: C.teal }, itemStyle: { color: C.teal } }],
    },
    spec: `{ "type": "chart:line:step",
  "spec": { "series": [{ "type": "line", "step": "end" }] } }`,
  },
  {
    dvtType: 'chart:area',
    title: 'Area',
    blurb: 'Volume and trend together — baseline must be zero.',
    option: {
      color: PALETTE, textStyle, grid, tooltip,
      xAxis: { type: 'category', data: weeks, boundaryGap: false, axisLabel, axisLine: baseAxisLine, axisTick: { show: false } },
      yAxis: valY(),
      series: [{
        type: 'line', smooth: true, data: [40, 52, 49, 63, 71, 68, 84, 95], showSymbol: false,
        lineStyle: { width: 2, color: C.indigo },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(79,70,229,0.28)' }, { offset: 1, color: 'rgba(79,70,229,0)' }] } },
      }],
    },
    spec: `{ "type": "chart:area",
  "spec": { "series": [{ "type": "line", "areaStyle": {} }] } }`,
  },
  {
    dvtType: 'chart:theme-river',
    title: 'Theme river',
    blurb: 'Streamgraph — how stream volumes rise and fall over time.',
    option: {
      color: [C.indigo, C.sky, C.amber], textStyle, tooltip: { ...tooltipItem },
      singleAxis: { type: 'time', axisLabel, axisLine: baseAxisLine, top: 12, bottom: 24, left: 12, right: 16 },
      series: [{
        type: 'themeRiver', emphasis: { itemStyle: { shadowBlur: 8 } },
        label: { show: false },
        data: ([['Docs', 12], ['SEO', 22], ['Social', 8], ['Direct', 18], ['Referral', 6]] as [string, number][]).flatMap(([name, base]) =>
          ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05'].map((d, i) => [d, Math.round(base + base * 0.4 * Math.sin(i + base)), name])),
      }],
    },
    spec: `{ "type": "chart:theme-river",
  "spec": { "series": [{ "type": "themeRiver" }] } }`,
  },
];

/* ── PART-TO-WHOLE ───────────────────────────────────────────────── */
const planData = [
  { value: 1048, name: 'Enterprise' },
  { value: 735, name: 'Pro' },
  { value: 580, name: 'Team' },
  { value: 300, name: 'Starter' },
];
const partToWhole: ChartDef[] = [
  {
    dvtType: 'chart:pie',
    title: 'Pie',
    blurb: 'Part-to-whole for a handful of slices that sum to 100%.',
    option: {
      color: PALETTE, textStyle, tooltip: tooltipItem,
      series: [{ type: 'pie', radius: '68%', center: ['50%', '50%'], data: planData, label: { fontFamily: FONT, color: '#52525B', fontSize: 11 }, itemStyle: { borderColor: '#fff', borderWidth: 2 } }],
    },
    spec: `{ "type": "chart:pie",
  "spec": { "series": [{ "type": "pie" }] } }`,
  },
  {
    dvtType: 'chart:donut',
    title: 'Donut',
    blurb: 'Pie with the center reserved for a headline metric.',
    option: {
      color: PALETTE, textStyle, tooltip: tooltipItem,
      title: { text: '$2.6M', subtext: 'ARR', left: 'center', top: '40%', textStyle: { fontFamily: FONT, fontSize: 22, color: '#16263A', fontWeight: 700 }, subtextStyle: { fontFamily: FONT, fontSize: 11, color: '#A1A1AA' } },
      series: [{ type: 'pie', radius: ['52%', '74%'], center: ['50%', '50%'], data: planData, label: { show: false }, itemStyle: { borderColor: '#fff', borderWidth: 2 } }],
    },
    spec: `{ "type": "chart:donut",
  "spec": { "series": [{ "type": "pie", "radius": ["52%", "74%"] }] } }`,
  },
  {
    dvtType: 'chart:funnel',
    title: 'Funnel',
    blurb: 'Sequential stages where volume narrows at each step.',
    option: {
      color: PALETTE, textStyle, tooltip: tooltipItem,
      series: [{
        type: 'funnel', left: 8, right: 8, top: 10, bottom: 10, minSize: '24%', gap: 2,
        label: { show: true, position: 'inside', color: '#fff', fontFamily: FONT, fontSize: 11, fontWeight: 600 },
        data: [
          { value: 100, name: 'Signup', itemStyle: { color: C.indigo } },
          { value: 62, name: 'Activated', itemStyle: { color: C.indigoLight } },
          { value: 24, name: 'Trial', itemStyle: { color: C.sky } },
          { value: 8, name: 'Paid', itemStyle: { color: C.navy } },
        ],
      }],
    },
    spec: `{ "type": "chart:funnel",
  "spec": { "steps": ["Signup", "Activated", "Trial", "Paid"],
            "series": [{ "type": "funnel" }] } }`,
  },
  {
    dvtType: 'chart:treemap',
    title: 'Treemap',
    blurb: 'Hierarchical data as nested rectangles, area = value.',
    option: {
      textStyle, tooltip: tooltipItem,
      series: [{
        type: 'treemap', roam: false, nodeClick: false, breadcrumb: { show: false },
        label: { fontFamily: FONT, fontSize: 11, color: '#fff' },
        levels: [{ itemStyle: { borderColor: '#fff', borderWidth: 2, gapWidth: 2 } }],
        data: [
          { name: 'Engineering', value: 42, itemStyle: { color: C.indigo }, children: [{ name: 'Compute', value: 24 }, { name: 'Storage', value: 18 }] },
          { name: 'Sales', value: 30, itemStyle: { color: C.sky } },
          { name: 'Marketing', value: 18, itemStyle: { color: C.teal } },
          { name: 'G&A', value: 12, itemStyle: { color: C.navy } },
        ],
      }],
    },
    spec: `{ "type": "chart:treemap",
  "spec": { "series": [{ "type": "treemap" }] } }`,
  },
  {
    dvtType: 'chart:sunburst',
    title: 'Sunburst',
    blurb: 'Hierarchical part-to-whole as concentric rings.',
    option: {
      textStyle, tooltip: tooltipItem,
      series: [{
        type: 'sunburst', radius: ['18%', '92%'],
        label: { fontFamily: FONT, fontSize: 10, color: '#fff' },
        itemStyle: { borderColor: '#fff', borderWidth: 1.5 },
        data: [
          { name: 'NA', value: 50, itemStyle: { color: C.indigo }, children: [{ name: 'US', value: 38 }, { name: 'CA', value: 12 }] },
          { name: 'EMEA', value: 34, itemStyle: { color: C.sky }, children: [{ name: 'UK', value: 16 }, { name: 'DE', value: 10 }, { name: 'FR', value: 8 }] },
          { name: 'APAC', value: 22, itemStyle: { color: C.teal }, children: [{ name: 'JP', value: 12 }, { name: 'AU', value: 10 }] },
        ],
      }],
    },
    spec: `{ "type": "chart:sunburst",
  "spec": { "series": [{ "type": "sunburst" }] } }`,
  },
];

/* ── CORRELATION ─────────────────────────────────────────────────── */
const scatterPts = [[10, 8], [16, 14], [22, 19], [25, 16], [31, 27], [36, 30], [44, 35], [52, 47], [58, 44], [66, 58], [74, 63], [82, 71]];
const correlation: ChartDef[] = [
  {
    dvtType: 'chart:scatter',
    title: 'Scatter',
    blurb: 'Relationship between two quantitative variables.',
    option: {
      color: PALETTE, textStyle, grid, tooltip: tooltipItem,
      xAxis: valY({ name: 'Spend' }), yAxis: valY({ name: 'Signups' }),
      series: [{ type: 'scatter', symbolSize: 9, data: scatterPts, itemStyle: { color: C.indigo, opacity: 0.75 } }],
    },
    spec: `{ "type": "chart:scatter",
  "spec": { "series": [{ "type": "scatter" }] } }`,
  },
  {
    dvtType: 'chart:scatter (bubble)',
    title: 'Bubble',
    blurb: 'Scatter + a size channel encodes a third variable.',
    option: {
      color: PALETTE, textStyle, grid, tooltip: tooltipItem,
      xAxis: valY({ name: 'CAC' }), yAxis: valY({ name: 'LTV' }),
      series: [{
        type: 'scatter',
        data: ([[20, 60, 30], [35, 88, 60], [48, 70, 22], [55, 120, 90], [70, 95, 45], [82, 140, 70]] as number[][])
          .map(([x, y, s]) => ({ value: [x, y], symbolSize: Math.round(Math.sqrt(s) * 4.5) })),
        itemStyle: { color: C.sky, opacity: 0.7 },
      }],
    },
    spec: `{ "type": "chart:scatter",
  "spec": { "series": [{ "type": "scatter", "sizeField": "deal_size" }] } }`,
  },
  {
    dvtType: 'chart:effect-scatter',
    title: 'Effect scatter',
    blurb: 'Ripple emphasis to draw the eye to outliers.',
    option: {
      color: PALETTE, textStyle, grid, tooltip: tooltipItem,
      xAxis: valY(), yAxis: valY(),
      series: [
        { type: 'scatter', symbolSize: 8, data: scatterPts.slice(0, 9), itemStyle: { color: '#D4D4D8' } },
        { type: 'effectScatter', symbolSize: 14, data: [[66, 58], [82, 71]], itemStyle: { color: C.indigo }, rippleEffect: { scale: 3 } },
      ],
    },
    spec: `{ "type": "chart:effect-scatter",
  "spec": { "series": [{ "type": "effectScatter" }] } }`,
  },
  {
    dvtType: 'chart:heatmap',
    title: 'Heatmap',
    blurb: 'Two categories × a value as color — activity grids, matrices.',
    option: {
      textStyle, tooltip: tooltipItem, grid: { ...grid, top: 8, bottom: 26, left: 8 },
      xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], axisLabel, axisLine: baseAxisLine, axisTick: { show: false }, splitArea: { show: true } },
      yAxis: { type: 'category', data: ['Night', 'Eve', 'Aft', 'Morn'], axisLabel, axisLine: baseAxisLine, axisTick: { show: false }, splitArea: { show: true } },
      visualMap: { min: 0, max: 10, calculable: true, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 60, textStyle: axisLabel, inRange: { color: ['#EEF2FF', C.indigoLight, C.indigo] } },
      series: [{
        type: 'heatmap',
        data: Array.from({ length: 5 }, (_, x) => Array.from({ length: 4 }, (_, y) => [x, y, Math.round(2 + 8 * Math.abs(Math.sin(x * 1.3 + y)))])).flat(),
        label: { show: false }, itemStyle: { borderColor: '#fff', borderWidth: 1 },
      }],
    },
    spec: `{ "type": "chart:heatmap",
  "spec": { "series": [{ "type": "heatmap" }],
            "visualMap": { "min": 0, "max": 10 } } }`,
  },
];

/* ── HIERARCHY & FLOW ────────────────────────────────────────────── */
const flow: ChartDef[] = [
  {
    dvtType: 'chart:sankey',
    title: 'Sankey',
    blurb: '"Where does it go?" — flows with width ∝ quantity.',
    option: {
      textStyle, tooltip: tooltipItem,
      series: [{
        type: 'sankey', left: 4, right: 70, top: 8, bottom: 8, nodeWidth: 12, nodeGap: 10,
        label: { fontFamily: FONT, fontSize: 10, color: '#52525B' },
        lineStyle: { color: 'gradient', opacity: 0.4 },
        data: [{ name: 'Visit' }, { name: 'Signup' }, { name: 'Trial' }, { name: 'Paid' }, { name: 'Churn' }],
        links: [
          { source: 'Visit', target: 'Signup', value: 60 },
          { source: 'Visit', target: 'Churn', value: 40 },
          { source: 'Signup', target: 'Trial', value: 38 },
          { source: 'Signup', target: 'Churn', value: 22 },
          { source: 'Trial', target: 'Paid', value: 24 },
          { source: 'Trial', target: 'Churn', value: 14 },
        ],
        itemStyle: { color: C.indigo, borderColor: C.indigo },
      }],
    },
    spec: `{ "type": "chart:sankey",
  "spec": { "series": [{ "type": "sankey" }] } }`,
  },
  {
    dvtType: 'chart:tree',
    title: 'Tree',
    blurb: 'Parent–child hierarchies where branching is the message.',
    option: {
      textStyle, tooltip: tooltipItem,
      series: [{
        type: 'tree', left: 8, right: 60, top: 8, bottom: 8, symbolSize: 8, orient: 'LR',
        label: { fontFamily: FONT, fontSize: 10, color: '#52525B', position: 'left', verticalAlign: 'middle', align: 'right' },
        leaves: { label: { position: 'right', align: 'left' } },
        lineStyle: { color: '#D4D4D8' }, itemStyle: { color: C.indigo },
        data: [{
          name: 'Org', children: [
            { name: 'GTM', children: [{ name: 'Sales' }, { name: 'Mktg' }] },
            { name: 'Product', children: [{ name: 'Eng' }, { name: 'Design' }] },
          ],
        }],
      }],
    },
    spec: `{ "type": "chart:tree",
  "spec": { "series": [{ "type": "tree", "orient": "LR" }] } }`,
  },
  {
    dvtType: 'chart:graph',
    title: 'Network graph',
    blurb: 'Entities connected by relationships — topology, knowledge graphs.',
    option: {
      textStyle, tooltip: tooltipItem,
      series: [{
        type: 'graph', layout: 'force', roam: false, force: { repulsion: 90, edgeLength: 50 },
        label: { show: true, fontFamily: FONT, fontSize: 9, color: '#52525B' },
        lineStyle: { color: '#D4D4D8', width: 1 },
        data: [
          { name: 'dvt', symbolSize: 26, itemStyle: { color: C.indigo } },
          { name: 'dbt', symbolSize: 18, itemStyle: { color: C.sky } },
          { name: 'dlt', symbolSize: 16, itemStyle: { color: C.teal } },
          { name: 'Claude', symbolSize: 18, itemStyle: { color: C.navy } },
          { name: 'Warehouse', symbolSize: 20, itemStyle: { color: C.amber } },
        ],
        links: [
          { source: 'dlt', target: 'Warehouse' }, { source: 'dbt', target: 'Warehouse' },
          { source: 'dvt', target: 'Warehouse' }, { source: 'Claude', target: 'dvt' },
          { source: 'dbt', target: 'dvt' },
        ],
      }],
    },
    spec: `{ "type": "chart:graph",
  "spec": { "series": [{ "type": "graph", "layout": "force" }] } }`,
  },
  {
    dvtType: 'chart:parallel',
    title: 'Parallel',
    blurb: 'Many dimensions, many entities, across parallel axes.',
    option: {
      color: PALETTE, textStyle,
      parallelAxis: [
        { dim: 0, name: 'Price', nameTextStyle: axisLabel, axisLabel },
        { dim: 1, name: 'Speed', nameTextStyle: axisLabel, axisLabel },
        { dim: 2, name: 'Scale', nameTextStyle: axisLabel, axisLabel },
        { dim: 3, name: 'Trust', nameTextStyle: axisLabel, axisLabel },
      ],
      parallel: { left: 28, right: 28, top: 24, bottom: 16 },
      series: [{
        type: 'parallel', lineStyle: { width: 2, opacity: 0.6 },
        data: [[20, 80, 60, 90], [60, 50, 80, 70], [40, 70, 40, 85], [80, 30, 90, 50]],
      }],
    },
    spec: `{ "type": "chart:parallel",
  "spec": { "series": [{ "type": "parallel" }] } }`,
  },
];

/* ── STATISTICAL ─────────────────────────────────────────────────── */
const statistical: ChartDef[] = [
  {
    dvtType: 'chart:boxplot',
    title: 'Box plot',
    blurb: 'Distribution summary — quartiles, spread, outliers per group.',
    option: {
      textStyle, grid, tooltip: tooltipItem,
      xAxis: { type: 'category', data: ['NA', 'EMEA', 'APAC', 'LATAM'], axisLabel, axisLine: baseAxisLine, axisTick: { show: false } },
      yAxis: valY(),
      series: [{
        type: 'boxplot', itemStyle: { color: 'rgba(79,70,229,0.12)', borderColor: C.indigo },
        data: [[14, 28, 40, 55, 78], [20, 34, 48, 60, 84], [8, 22, 33, 47, 66], [18, 30, 38, 52, 70]],
      }],
    },
    spec: `{ "type": "chart:boxplot",
  "spec": { "series": [{ "type": "boxplot" }] } }`,
  },
  {
    dvtType: 'chart:candlestick',
    title: 'Candlestick',
    blurb: 'Financial OHLC — price action, volatility, ranges.',
    option: {
      textStyle, grid, tooltip: tooltipItem,
      xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Mon', 'Tue'], axisLabel, axisLine: baseAxisLine, axisTick: { show: false } },
      yAxis: valY({ scale: true }),
      series: [{
        type: 'candlestick',
        itemStyle: { color: C.green, color0: C.rose, borderColor: C.green, borderColor0: C.rose },
        data: [[20, 34, 18, 36], [34, 30, 28, 38], [30, 42, 29, 44], [42, 38, 36, 46], [38, 50, 37, 52], [50, 46, 44, 55], [46, 58, 45, 60]],
      }],
    },
    spec: `{ "type": "chart:candlestick",
  "spec": { "series": [{ "type": "candlestick" }] } }`,
  },
  {
    dvtType: 'chart:gauge',
    title: 'Gauge',
    blurb: "A value's position within a known range (use sparingly).",
    option: {
      textStyle,
      series: [{
        type: 'gauge', radius: '92%', startAngle: 210, endAngle: -30, min: 0, max: 100,
        progress: { show: true, width: 12, itemStyle: { color: C.indigo } },
        axisLine: { lineStyle: { width: 12, color: [[1, '#EEF2FF']] } },
        axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { show: false }, pointer: { show: false },
        anchor: { show: false },
        detail: { valueAnimation: true, fontSize: 26, fontFamily: FONT, fontWeight: 700, color: C.navy, offsetCenter: [0, 0], formatter: '{value}%' },
        data: [{ value: 73 }],
      }],
    },
    spec: `{ "type": "chart:gauge",
  "spec": { "series": [{ "type": "gauge", "max": 100 }] } }`,
  },
  {
    dvtType: 'chart:radar',
    title: 'Radar',
    blurb: 'Compare entities across 5–10 dimensions — profiles, scorecards.',
    option: {
      color: PALETTE, textStyle,
      legend: { bottom: 0, itemWidth: 10, itemHeight: 10, textStyle: axisLabel },
      radar: {
        indicator: [{ name: 'Speed', max: 100 }, { name: 'Cost', max: 100 }, { name: 'Scale', max: 100 }, { name: 'DX', max: 100 }, { name: 'Trust', max: 100 }],
        radius: '62%', center: ['50%', '46%'], axisName: { color: '#71717A', fontFamily: FONT, fontSize: 10 },
        splitLine: { lineStyle: { color: '#E4E4E7' } }, splitArea: { areaStyle: { color: ['#fff', '#FAFAFA'] } },
      },
      series: [{
        type: 'radar', areaStyle: { opacity: 0.15 },
        data: [
          { value: [90, 70, 85, 95, 80], name: 'dvt', itemStyle: { color: C.indigo } },
          { value: [60, 85, 55, 50, 65], name: 'Legacy BI', itemStyle: { color: C.amber } },
        ],
      }],
    },
    spec: `{ "type": "chart:radar",
  "spec": { "series": [{ "type": "radar" }] } }`,
  },
];

/* ── ANIMATED (carousel stars) ───────────────────────────────────── */
const racingNames = ['Enterprise', 'Pro', 'Team', 'Starter', 'Free'];
const animated: ChartDef[] = [
  {
    dvtType: 'chart:bar:racing',
    title: 'Bar chart race',
    blurb: 'Animated ranking over time — temporal storytelling that moves.',
    featured: true,
    animate: 'race-bar',
    option: {
      color: PALETTE, textStyle, grid: { ...grid, top: 12, left: 8, right: 52 },
      xAxis: { ...valY(), max: 'dataMax', axisLabel: { ...axisLabel, formatter: '{value}' } },
      yAxis: { type: 'category', data: racingNames, inverse: true, axisLabel, axisLine: baseAxisLine, axisTick: { show: false }, animationDuration: 300, animationDurationUpdate: 300 },
      series: [{
        type: 'bar', realtimeSort: true, barMaxWidth: 22,
        itemStyle: { color: C.indigo, borderRadius: [0, 4, 4, 0] },
        label: { show: true, position: 'right', valueAnimation: true, fontFamily: FONT, color: '#71717A', fontSize: 11 },
        data: [320, 264, 180, 92, 40],
      }],
      animationDuration: 0, animationDurationUpdate: 1400, animationEasing: 'linear', animationEasingUpdate: 'linear',
    },
    spec: `{ "type": "chart:bar:racing",
  "animation": { "frameField": "month" },
  "spec": { "categoryField": "plan", "valueField": "revenue" } }`,
  },
  {
    dvtType: 'chart:line:racing',
    title: 'Racing line',
    blurb: 'A progressive line that draws itself along the time axis.',
    featured: true,
    animate: 'progressive-line',
    option: {
      color: PALETTE, textStyle, grid, tooltip,
      xAxis: { type: 'category', data: ['Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9', 'Q10'], boundaryGap: false, axisLabel, axisLine: baseAxisLine, axisTick: { show: false } },
      yAxis: valY(),
      series: [{
        type: 'line', smooth: true, showSymbol: false,
        data: [20, 32, 28, 45, 60, 55, 72, 85, 92, 110],
        lineStyle: { width: 3, color: C.indigo },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(79,70,229,0.22)' }, { offset: 1, color: 'rgba(79,70,229,0)' }] } },
      }],
      animationDuration: 2600, animationEasing: 'cubicOut',
    },
    spec: `{ "type": "chart:line:racing",
  "animation": { "frameField": "quarter" },
  "spec": { "valueField": "revenue" } }`,
  },
];

/* ── TABLES ──────────────────────────────────────────────────────── */
// Tables are dvt Core (rendered client-side over already-bound rows — never a
// re-query, never a re-bill). The gallery shows the real vocabulary: conditional
// formatting, colour scales, in-cell viz, grouping + subtotals, and pivots.
const tables: ChartDef[] = [
  {
    dvtType: 'table',
    title: 'Metrics table',
    blurb: 'Conditional formatting, deltas, and inline share bars — all declared.',
    kind: 'table',
    table: {
      columns: [
        { key: 'seg', label: 'Segment' },
        { key: 'rev', label: 'Revenue', align: 'right' },
        { key: 'mom', label: 'MoM', align: 'right' },
        { key: 'share', label: 'Share' },
      ],
      rows: [
        { cells: { seg: { v: 'Enterprise' }, rev: { v: '$1.05M', bold: true }, mom: { v: '+18%', tone: 'up' }, share: { v: '41%', bar: 41 } } },
        { cells: { seg: { v: 'Pro' }, rev: { v: '$735K' }, mom: { v: '+9%', tone: 'up' }, share: { v: '29%', bar: 29 } } },
        { cells: { seg: { v: 'Team' }, rev: { v: '$580K' }, mom: { v: '+4%', tone: 'up' }, share: { v: '23%', bar: 23 } } },
        { cells: { seg: { v: 'Starter' }, rev: { v: '$180K' }, mom: { v: '−6%', tone: 'down', fill: 'rgba(239,68,68,0.10)' }, share: { v: '7%', bar: 7 } } },
      ],
    },
    spec: `{ "type": "table",
  "spec": {
    "columns": [
      { "field": "revenue", "format": { "type": "currency", "currency": "USD" } },
      { "field": "mom",     "format": { "type": "percentage" } },
      { "field": "share",   "cell": { "kind": "bar" } }
    ],
    "conditionalFormat": [
      { "where": { "field": "mom", "op": "lt", "value": 0 },
        "apply": { "fill": "danger.subtle", "textColor": "danger", "weight": "bold" } }
    ] } }`,
  },
  {
    dvtType: 'table',
    title: 'In-cell visualizations',
    blurb: 'Sparklines, bullet bars, and win/loss strips rendered inside cells.',
    kind: 'table',
    table: {
      columns: [
        { key: 'metric', label: 'Metric' },
        { key: 'trend', label: 'Trend (6mo)' },
        { key: 'pace', label: 'Pace vs quota', align: 'left' },
        { key: 'streak', label: 'Weekly W/L' },
      ],
      rows: [
        { cells: { metric: { v: 'ARR' }, trend: { spark: [12, 14, 13, 17, 19, 22], sparkKind: 'area' }, pace: { bullet: { value: 82, target: 75, max: 100 } }, streak: { winloss: [1, 1, -1, 1, 1, 1] } } },
        { cells: { metric: { v: 'Net new logos' }, trend: { spark: [8, 6, 9, 7, 10, 11], sparkKind: 'line' }, pace: { bullet: { value: 61, target: 70, max: 100 } }, streak: { winloss: [1, -1, 1, -1, 1, -1] } } },
        { cells: { metric: { v: 'Churn' }, trend: { spark: [5, 6, 4, 4, 3, 3], sparkKind: 'bar' }, pace: { bullet: { value: 40, target: 50, max: 100 } }, streak: { winloss: [-1, 1, 1, 1, 1, 1] } } },
      ],
    },
    spec: `{ "type": "table",
  "spec": { "columns": [
    { "field": "trend",  "cell": { "kind": "sparkline", "type": "area",
        "source": { "valuesFromColumns": ["m1","m2","m3","m4","m5","m6"] } } },
    { "field": "pace",   "cell": { "kind": "bullet", "target": "quota" } },
    { "field": "streak", "cell": { "kind": "winloss" } } ] } }`,
  },
  {
    dvtType: 'table',
    title: 'Grouped + subtotals',
    blurb: 'Row grouping with per-group subtotals and a grand total.',
    kind: 'table',
    table: {
      columns: [
        { key: 'rep', label: 'Rep' },
        { key: 'deals', label: 'Deals', align: 'right' },
        { key: 'rev', label: 'Revenue', align: 'right' },
      ],
      rows: [
        { kind: 'group', label: 'West' },
        { cells: { rep: { v: 'A. Rivera' }, deals: { v: '14' }, rev: { v: '$420K' } } },
        { cells: { rep: { v: 'J. Okafor' }, deals: { v: '11' }, rev: { v: '$330K' } } },
        { kind: 'subtotal', cells: { rep: { v: 'West subtotal' }, deals: { v: '25' }, rev: { v: '$750K' } } },
        { kind: 'group', label: 'East' },
        { cells: { rep: { v: 'M. Chen' }, deals: { v: '18' }, rev: { v: '$540K' } } },
        { cells: { rep: { v: 'P. Nowak' }, deals: { v: '9' }, rev: { v: '$260K' } } },
        { kind: 'subtotal', cells: { rep: { v: 'East subtotal' }, deals: { v: '27' }, rev: { v: '$800K' } } },
        { kind: 'total', cells: { rep: { v: 'Grand total' }, deals: { v: '52' }, rev: { v: '$1.55M' } } },
      ],
    },
    spec: `{ "type": "table",
  "spec": { "grouping": {
    "groupBy": ["region"],
    "aggregations": [
      { "field": "deals",   "agg": "count" },
      { "field": "revenue", "agg": "sum" } ],
    "subtotals": true, "grandTotal": true } } }`,
  },
  {
    dvtType: 'table',
    title: 'Pivot / cross-tab',
    blurb: 'Revenue by region × quarter with spanning headers and heat.',
    kind: 'table',
    table: {
      columns: [
        { key: 'region', label: 'Region' },
        { key: 'q1', label: 'Q1', align: 'right' },
        { key: 'q2', label: 'Q2', align: 'right' },
        { key: 'q3', label: 'Q3', align: 'right' },
        { key: 'total', label: 'Total', align: 'right' },
      ],
      columnGroups: [
        { label: '', span: 1 },
        { label: 'FY26 revenue', span: 3 },
        { label: '', span: 1 },
      ],
      rows: [
        { cells: { region: { v: 'West' }, q1: { v: '$210K', heat: 62 }, q2: { v: '$255K', heat: 74 }, q3: { v: '$285K', heat: 86 }, total: { v: '$750K', bold: true } } },
        { cells: { region: { v: 'East' }, q1: { v: '$240K', heat: 70 }, q2: { v: '$268K', heat: 79 }, q3: { v: '$292K', heat: 90 }, total: { v: '$800K', bold: true } } },
        { cells: { region: { v: 'EMEA' }, q1: { v: '$160K', heat: 48 }, q2: { v: '$180K', heat: 54 }, q3: { v: '$205K', heat: 61 }, total: { v: '$545K', bold: true } } },
      ],
    },
    spec: `{ "type": "table",
  "spec": { "pivot": {
    "rows": ["region"],
    "columns": ["quarter"],
    "values": [ { "field": "revenue", "agg": "sum" } ],
    "totals": { "row": true } },
    "columns": [ { "field": "revenue",
      "colorScale": { "method": "numeric", "palette": "blues" } } ] } }`,
  },
  {
    dvtType: 'table',
    title: 'Cohort heat table',
    blurb: 'Retention grid with continuous colour-scale heat encoding.',
    kind: 'table',
    table: {
      columns: [
        { key: 'c', label: 'Cohort' },
        { key: 'm0', label: 'M0', align: 'right' },
        { key: 'm1', label: 'M1', align: 'right' },
        { key: 'm2', label: 'M2', align: 'right' },
        { key: 'm3', label: 'M3', align: 'right' },
      ],
      rows: [
        { cells: { c: { v: 'Jan' }, m0: { v: '100%', heat: 100 }, m1: { v: '82%', heat: 82 }, m2: { v: '71%', heat: 71 }, m3: { v: '64%', heat: 64 } } },
        { cells: { c: { v: 'Feb' }, m0: { v: '100%', heat: 100 }, m1: { v: '85%', heat: 85 }, m2: { v: '74%', heat: 74 }, m3: { v: '69%', heat: 69 } } },
        { cells: { c: { v: 'Mar' }, m0: { v: '100%', heat: 100 }, m1: { v: '88%', heat: 88 }, m2: { v: '79%', heat: 79 }, m3: { v: '72%', heat: 72 } } },
      ],
    },
    spec: `{ "type": "table",
  "spec": { "columns": [ { "field": "retention",
    "colorScale": { "method": "quantile",
                    "palette": "blues", "domain": [50, 100] } } ] } }`,
  },
];

export const families: Family[] = [
  { id: 'comparison', label: 'Comparison', blurb: 'Compare a measure across categories.', charts: comparison },
  { id: 'trend', label: 'Trend', blurb: 'How a measure moves over time.', charts: trend },
  { id: 'part-to-whole', label: 'Part-to-whole', blurb: 'Composition and proportion.', charts: partToWhole },
  { id: 'correlation', label: 'Correlation', blurb: 'Relationships and density.', charts: correlation },
  { id: 'flow', label: 'Hierarchy & flow', blurb: 'Structure, networks, and movement.', charts: flow },
  { id: 'statistical', label: 'Statistical', blurb: 'Distribution and financial shape.', charts: statistical },
  { id: 'animated', label: 'Animated', blurb: 'Specs that move — temporal storytelling.', charts: animated },
  { id: 'tables', label: 'Tables', blurb: 'Rich tabular layouts, formatted and conditional.', charts: tables },
];

/** The flagship set the hero carousel rotates through. */
export const featured: ChartDef[] = [
  animated[0], // bar race
  trend[3], // area
  partToWhole[2], // funnel
  correlation[3], // heatmap
  flow[0], // sankey
  animated[1], // racing line
  statistical[3], // radar
];

export const totalChartCount = families.reduce((n, f) => n + f.charts.length, 0);
