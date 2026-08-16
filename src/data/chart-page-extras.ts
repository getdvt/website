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
 * chart:lines, chart:map, and chart:geo:animated bind a real registered
 * `world` GeoJSON map (src/data/world.geo.json, lazy-loaded by
 * src/scripts/charts.ts) rather than an abstract cartesian stand-in — see
 * DVT-3081.
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
// Shared base `geo` fragment for the world-map compositions below: the
// registered `world` map (lazy-loaded by src/scripts/charts.ts), roam
// disabled so charts stay legible at the fixed 320px gallery height, silent
// so hover/tooltip stays on the data series layered above it.
const worldGeo = {
  map: 'world' as const,
  roam: false,
  silent: true,
  itemStyle: { areaColor: '#F4F4F5', borderColor: '#fff' },
};

export const chartPageExtras: ChartDef[] = [
  {
    dvtType: 'chart:lines',
    title: 'Flow map',
    blurb:
      'Directional movement between origin/destination points, drawn as animated arcs over real world geography.',
    option: {
      color: [C.indigo], textStyle, tooltip: tooltipItem,
      geo: worldGeo,
      series: [
        {
          type: 'lines', coordinateSystem: 'geo', polyline: false, zlevel: 1,
          lineStyle: { color: C.indigo, width: 1.5, curveness: 0.25, opacity: 0.55 },
          effect: { show: true, symbol: 'arrow', symbolSize: 7, period: 4, trailLength: 0.15, color: C.sky },
          data: [
            { coords: [[-122.42, 37.77], [-0.13, 51.51]] },
            { coords: [[-122.42, 37.77], [139.69, 35.69]] },
            { coords: [[-46.63, -23.55], [-0.13, 51.51]] },
            { coords: [[-0.13, 51.51], [151.21, -33.87]] },
          ],
        },
        {
          type: 'effectScatter', coordinateSystem: 'geo', symbolSize: 8, zlevel: 2,
          itemStyle: { color: C.navy },
          rippleEffect: { scale: 2.4, period: 3.5, brushType: 'stroke' },
          label: { show: true, position: 'top', fontFamily: FONT, fontSize: 10, color: '#71717A', formatter: '{b}' },
          labelLayout: { hideOverlap: true },
          data: [
            { name: 'San Francisco', value: [-122.42, 37.77, 1] },
            // Multiple arcs converge above this node — keep the label off
            // to the side so no arc crosses the text.
            { name: 'London', value: [-0.13, 51.51, 1], label: { position: [-32, 16], align: 'right' } },
            { name: 'Tokyo', value: [139.69, 35.69, 1] },
            { name: 'São Paulo', value: [-46.63, -23.55, 1] },
            // The London→Sydney arc curves down through the default 'top'
            // label position — push it below the node instead.
            { name: 'Sydney', value: [151.21, -33.87, 1], label: { position: 'bottom' } },
          ],
        },
      ],
    },
    spec: `{ "type": "chart:lines",
  "spec": { "geo": { "map": "world" },
            "series": [{ "type": "lines", "coordinateSystem": "geo",
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
    blurb: 'Geography-encoded measure by region, color intensity for value, drawn over real world geography.',
    option: {
      textStyle, tooltip: tooltipItem,
      visualMap: {
        min: 0, max: 100, calculable: false, orient: 'horizontal', left: 'center', bottom: 0,
        itemWidth: 10, itemHeight: 80, textStyle: { color: '#A1A1AA', fontSize: 10, fontFamily: FONT },
        inRange: { color: ['#EEF2FF', C.indigoLight, C.indigo] },
      },
      series: [{
        type: 'map', map: 'world', roam: false,
        itemStyle: { areaColor: '#F4F4F5', borderColor: '#fff' },
        emphasis: { itemStyle: { areaColor: C.indigoLight }, label: { show: false } },
        select: { disabled: true },
        data: [
          { name: 'United States', value: 82 },
          { name: 'Brazil', value: 47 },
          { name: 'Germany', value: 61 },
          { name: 'United Kingdom', value: 58 },
          { name: 'France', value: 53 },
          { name: 'India', value: 39 },
          { name: 'Japan', value: 71 },
          { name: 'Australia', value: 44 },
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
      'A geographic measure spreading across regions over time, ripple effects standing in for time-lapse playback over real world geography.',
    option: {
      textStyle, tooltip: tooltipItem,
      geo: worldGeo,
      series: [
        {
          type: 'effectScatter', coordinateSystem: 'geo', symbolSize: 14,
          itemStyle: { color: C.indigo },
          rippleEffect: { scale: 3.2, period: 3, brushType: 'stroke' },
          label: { show: true, position: 'top', fontFamily: FONT, fontSize: 10, color: '#71717A', formatter: '{b}' },
          labelLayout: { hideOverlap: true },
          data: [
            { name: 'San Francisco', value: [-122.42, 37.77, 0.6] },
            { name: 'London', value: [-0.13, 51.51, 0.9] },
            { name: 'Tokyo', value: [139.69, 35.69, 0.7] },
            { name: 'São Paulo', value: [-46.63, -23.55, 0.4] },
            { name: 'Sydney', value: [151.21, -33.87, 0.3] },
          ],
        },
      ],
    },
    spec: `{ "type": "chart:geo:animated",
  "spec": { "animation": { "frameField": "week" },
            "series": [{ "type": "map", "map": "world" }] } }`,
  },
];
