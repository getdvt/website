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
    setInterval(() => {
      if (document.hidden || !visible(el)) return;
      data = data.map((v) => Math.round(Math.max(24, Math.min(420, v + (Math.random() * 70 - 26)))));
      chart.setOption({ series: [{ type: 'bar', data }] });
    }, 1600);
  } else if (kind === 'progressive-line') {
    setInterval(() => {
      if (document.hidden || !visible(el)) return;
      chart.setOption(option, true);
    }, 5400);
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
