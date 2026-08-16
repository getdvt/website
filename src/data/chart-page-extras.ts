/**
 * Extra chart catalog entries for the programmatic chart-type pages
 * (DVT-3004) that the /spec gallery in charts.ts does not cover:
 * chart:lines, chart:chord, chart:map, chart:geo:animated.
 *
 * Kept in a separate file (not appended to charts.ts) so the
 * scripts/check-chart-types.mjs regex-based drift guard — which reads only
 * charts.ts — is unaffected.
 *
 * Same rules as charts.ts: every `option` is JSON-pure (no functions), since
 * it is serialized into a JSON script tag and parsed client-side.
 *
 * chart:lines, chart:map, and chart:geo:animated render as an abstract,
 * illustrative composition (a stylized flow / bubble layout on a hidden
 * cartesian grid) rather than binding real GeoJSON regions, which the site
 * runtime does not register. Each entry's blurb says so explicitly — a real
 * dvt build binds GeoJSON for these types.
 */

import type { ChartDef } from './charts';

/* ── local copies of the shared palette + base fragments from charts.ts ──
 * (charts.ts does not export these; duplicating keeps this file
 * self-contained and leaves charts.ts — read by the drift-guard regex —
 * untouched.) */
const C = {
  indigo: '#4F46E5',
  teal: '#1F9E96',
  sky: '#5B9BD5',
  amber: '#E0A93B',
  violet: '#8B7EC8',
  slate: '#64748B',
  indigoLight: '#818CF8',
  navy: '#16263A',
};

const FONT = 'Inter, -apple-system, BlinkMacSystemFont, sans-serif';
const textStyle = { fontFamily: FONT };
const tooltipItem = {
  trigger: 'item' as const,
  backgroundColor: '#18181B',
  borderColor: '#27272A',
  textStyle: { color: '#FAFAFA', fontSize: 11, fontFamily: FONT },
};
// Hidden value axis: an abstract canvas for the flow/bubble compositions
// below, not a real measured axis — so it carries no name and does not
// trigger the yAxis.name margin rule.
const hiddenAxis = { type: 'value' as const, min: 0, max: 100, show: false };
// Margin-affordance rule: always containLabel + left/right/bottom >= 24.
const flowGrid = { left: 24, right: 24, top: 22, bottom: 24, containLabel: true };

export const chartPageExtras: ChartDef[] = [
  {
    dvtType: 'chart:lines',
    title: 'Flow map',
    blurb:
      'Directional movement between origin/destination points. Illustrative render on an abstract canvas; a real build binds the `lines` series to a `geo` coordinate system with registered GeoJSON.',
    option: {
      color: [C.indigo], textStyle, grid: flowGrid, tooltip: tooltipItem,
      xAxis: hiddenAxis, yAxis: hiddenAxis,
      series: [
        {
          type: 'effectScatter', coordinateSystem: 'cartesian2d', symbolSize: 10,
          itemStyle: { color: C.navy },
          label: { show: true, position: 'top', fontFamily: FONT, fontSize: 10, color: '#71717A', formatter: '{b}' },
          data: [
            { name: 'Origin', value: [12, 70] },
            { name: 'Hub', value: [52, 40] },
            { name: 'Destination A', value: [86, 62] },
            { name: 'Destination B', value: [84, 18] },
          ],
        },
        {
          type: 'lines', coordinateSystem: 'cartesian2d', polyline: false,
          lineStyle: { color: C.indigo, width: 1.5, curveness: 0.25, opacity: 0.5 },
          effect: { show: true, symbol: 'arrow', symbolSize: 7, period: 5, trailLength: 0.15, color: C.sky },
          data: [
            { coords: [[12, 70], [52, 40]] },
            { coords: [[52, 40], [86, 62]] },
            { coords: [[52, 40], [84, 18]] },
          ],
        },
      ],
    },
    spec: `{ "type": "chart:lines",
  "spec": { "series": [{ "type": "lines", "coordinateSystem": "geo",
              "effect": { "show": true, "symbol": "arrow" } }] } }`,
  },
  {
    dvtType: 'chart:chord',
    title: 'Chord diagram',
    blurb: 'Bidirectional relationships between entities arranged around a circle, arc width proportional to strength.',
    option: {
      textStyle, tooltip: tooltipItem,
      series: [{
        type: 'graph', layout: 'circular', roam: false,
        circular: { rotateLabel: true },
        label: { show: true, fontFamily: FONT, fontSize: 10, color: '#52525B' },
        lineStyle: { color: 'source', curveness: 0.3, opacity: 0.45, width: 2 },
        itemStyle: { borderColor: '#fff', borderWidth: 1 },
        data: [
          { name: 'NA', symbolSize: 34, itemStyle: { color: C.indigo } },
          { name: 'EMEA', symbolSize: 28, itemStyle: { color: C.sky } },
          { name: 'APAC', symbolSize: 24, itemStyle: { color: C.teal } },
          { name: 'LATAM', symbolSize: 16, itemStyle: { color: C.amber } },
        ],
        links: [
          { source: 'NA', target: 'EMEA', value: 40, lineStyle: { width: 4 } },
          { source: 'NA', target: 'APAC', value: 24, lineStyle: { width: 3 } },
          { source: 'EMEA', target: 'APAC', value: 18, lineStyle: { width: 2 } },
          { source: 'EMEA', target: 'LATAM', value: 10, lineStyle: { width: 1.5 } },
          { source: 'APAC', target: 'LATAM', value: 8, lineStyle: { width: 1.5 } },
        ],
      }],
    },
    spec: `{ "type": "chart:chord",
  "spec": { "series": [{ "type": "graph", "layout": "circular" }] } }`,
  },
  {
    dvtType: 'chart:map',
    title: 'Choropleth map',
    blurb:
      'Geography-encoded measure by region, color intensity for value. Illustrative render on an abstract canvas; a real build binds the `map` series to registered GeoJSON regions.',
    option: {
      textStyle, grid: flowGrid, tooltip: tooltipItem,
      visualMap: {
        min: 0, max: 100, calculable: true, orient: 'horizontal', left: 'center', bottom: 0,
        itemHeight: 60, textStyle: { color: '#A1A1AA', fontSize: 11, fontFamily: FONT },
        inRange: { color: ['#EEF2FF', C.indigoLight, C.indigo] },
      },
      xAxis: hiddenAxis, yAxis: hiddenAxis,
      series: [{
        type: 'scatter', coordinateSystem: 'cartesian2d', symbol: 'roundRect',
        symbolSize: [34, 34],
        label: { show: true, fontFamily: FONT, fontSize: 10, color: '#fff', formatter: '{b}' },
        data: [
          { name: 'NA', value: [16, 68, 82] },
          { name: 'EMEA', value: [48, 74, 61] },
          { name: 'APAC', value: [78, 60, 44] },
          { name: 'LATAM', value: [30, 30, 28] },
          { name: 'AFR', value: [58, 22, 19] },
        ],
      }],
    },
    spec: `{ "type": "chart:map",
  "spec": { "geo": { "map": "world" },
            "series": [{ "type": "map", "map": "world" }] } }`,
  },
  {
    dvtType: 'chart:geo:animated',
    title: 'Animated map',
    blurb:
      'A geographic measure spreading across regions over time. Illustrative render — ripple effects stand in for time-lapse playback; a real build binds registered GeoJSON regions and a time field.',
    option: {
      textStyle, grid: flowGrid, tooltip: tooltipItem,
      xAxis: hiddenAxis, yAxis: hiddenAxis,
      series: [
        {
          type: 'scatter', coordinateSystem: 'cartesian2d', symbolSize: 8,
          itemStyle: { color: '#D4D4D8' },
          data: [[16, 68], [48, 74], [78, 60], [30, 30], [58, 22], [66, 44]],
        },
        {
          type: 'effectScatter', coordinateSystem: 'cartesian2d', symbolSize: 20,
          itemStyle: { color: C.indigo },
          rippleEffect: { scale: 3.2, period: 3, brushType: 'stroke' },
          label: { show: true, position: 'top', fontFamily: FONT, fontSize: 10, color: '#71717A', formatter: '{b}' },
          data: [
            { name: 'Wk 1', value: [48, 74] },
            { name: 'Wk 4', value: [78, 60] },
          ],
        },
      ],
    },
    spec: `{ "type": "chart:geo:animated",
  "animation": { "frameField": "week" },
  "spec": { "geo": { "map": "world" },
            "series": [{ "type": "effectScatter", "coordinateSystem": "geo" }] } }`,
  },
];
