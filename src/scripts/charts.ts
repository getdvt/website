/**
 * Client runtime for the chart gallery.
 *
 * ECharts (the same engine dvt ships) is dynamically imported the first time a
 * chart scrolls near the viewport, so it never blocks initial page load. Charts
 * are sized lazily, resized on container changes, and respect reduced-motion.
 * The gallery's tab switch calls window.dvtChartsScan() to boot newly-revealed
 * charts.
 */
import type { EChartsType } from 'echarts';

type AnyOption = Record<string, any>;

const prefersReduced =
  typeof matchMedia !== 'undefined' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches;

let libPromise: Promise<typeof import('echarts')> | null = null;
const instances = new WeakMap<Element, EChartsType>();

function lib() {
  if (!libPromise) libPromise = import('echarts');
  return libPromise;
}

// World boundaries (Natural Earth-derived, public domain) are bundled locally
// and loaded on demand — no CDN fetch at runtime — so charts that don't need
// geography never pay for the ~250KB GeoJSON payload.
let worldPromise: Promise<void> | null = null;
function worldMap(echarts: typeof import('echarts')): Promise<void> {
  worldPromise ??= import('../data/world.geo.json')
    .then((m) => {
      echarts.registerMap('world', m.default as any);
    })
    .catch((err) => {
      // Clear the memo on failure so a later retry (e.g. a subsequent chart
      // scrolling into view) re-attempts the import instead of replaying a
      // cached rejection forever.
      worldPromise = null;
      throw err;
    });
  return worldPromise;
}

function needsWorld(option: AnyOption): boolean {
  if (option?.geo?.map === 'world') return true;
  const series = Array.isArray(option?.series) ? option.series : [];
  return series.some((s: AnyOption) => s?.map === 'world' || s?.coordinateSystem === 'geo');
}

function readOption(el: HTMLElement): AnyOption | null {
  const tag = el.querySelector('script[type="application/json"]');
  if (!tag || !tag.textContent) return null;
  try {
    return JSON.parse(tag.textContent);
  } catch {
    return null;
  }
}

function visible(el: HTMLElement) {
  return el.offsetParent !== null && el.clientWidth > 0;
}

async function boot(el: HTMLElement) {
  if (instances.has(el) || !visible(el)) return;
  const option = readOption(el);
  if (!option) return;

  const echarts = await lib();
  // The element may have been removed/hidden while the lib loaded.
  if (instances.has(el) || !visible(el)) return;

  if (needsWorld(option)) {
    try {
      await worldMap(echarts);
    } catch (err) {
      console.error('Failed to load world map GeoJSON:', err);
      return;
    }
    if (instances.has(el) || !visible(el)) return;
  }

  const chart = echarts.init(el, null, { renderer: 'canvas' });
  instances.set(el, chart);
  if (prefersReduced) option.animation = false;
  chart.setOption(option);

  const ro = new ResizeObserver(() => chart.resize());
  ro.observe(el);

  const animate = el.dataset.animate;
  if (animate && !prefersReduced) runAnimation(animate, chart, option, el);
}

function runAnimation(kind: string, chart: EChartsType, option: AnyOption, el: HTMLElement) {
  if (kind === 'race-bar') {
    let data = (option.series[0].data as number[]).slice();
    const tick = () => {
      if (document.hidden || !visible(el)) return;
      data = data.map((v) => Math.round(Math.max(24, Math.min(420, v + (Math.random() * 70 - 26)))));
      chart.setOption({ series: [{ type: 'bar', data }] });
    };
    tick();
    setInterval(tick, 1600);
  } else if (kind === 'progressive-line') {
    const full = (option.series[0].data as number[]).slice();
    const seriesType = option.series[0].type;
    let i = 2;
    let hold = 0;
    const tick = () => {
      if (document.hidden || !visible(el)) return;
      if (i < full.length) {
        i++;
        chart.setOption({
          series: [{ type: seriesType, data: full.slice(0, i).concat(new Array(full.length - i).fill(null)) }],
        });
      } else if (hold < 8) {
        hold++;
      } else {
        i = 2;
        hold = 0;
      }
    };
    tick();
    setInterval(tick, 320);
  }
}

const io =
  typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (e.isIntersecting) {
              boot(e.target as HTMLElement);
              io.unobserve(e.target);
            }
          }
        },
        { rootMargin: '160px 0px' }
      )
    : null;

function scan() {
  document.querySelectorAll<HTMLElement>('.echart[data-echart]').forEach((el) => {
    if (instances.has(el)) return;
    if (visible(el)) boot(el);
    else io?.observe(el);
  });
}

declare global {
  interface Window {
    dvtChartsScan?: () => void;
  }
}

window.dvtChartsScan = scan;
if (document.readyState !== 'loading') scan();
else document.addEventListener('DOMContentLoaded', scan);
