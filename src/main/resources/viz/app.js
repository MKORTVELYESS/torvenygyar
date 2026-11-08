import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { GRANULARITIES, aggregate, parseRows, quantile, stdDev } from './data.js';
import { pickObject } from './objects.js';
import { NIGHT_TICKS, moodMeta } from './people.js';
import { renderDashboard } from './dashboard.js';
import { applyStaticTranslations, getLang, initI18n, setLang, t } from './i18n.js';
import { formatAxisTick, formatDuration, formatHeight, formatInt, formatRatio, formatTime } from './format.js';

const SHEET_M = 0.0001; // one 80 g/m² A4 sheet ≈ 0.1 mm
const DAY_MINUTES = 1440;
const MARGIN = { top: 72, bottom: 56 };
const Y_AXIS_W = 64;
const NIGHT_AXIS_W = 126;
const HEADROOM = 1.1;
const WHEEL_STEP = 40;
const WHEEL_COOLDOWN_MS = 380;
const VIEW_GROUPS = ['tower', 'night'];
const LANGS = ['en', 'hu'];
// One release a day (and most weeks) has no spread, so a candle collapses to nothing.
const COLUMN_GRANULARITIES = new Set(['daily', 'weekly']);

const byId = id => document.getElementById(id);
const els = {
  heading: document.querySelector('h1'),
  lede: document.querySelector('.lede'),
  groups: byId('view-groups'),
  granularity: byId('granularity'),
  stats: byId('stats'),
  chart: byId('chart'),
  yAxis: byId('y-axis'),
  scroll: byId('plot-scroll'),
  plot: byId('plot'),
  object: byId('object'),
  tooltip: byId('tooltip'),
  candleHelpLink: byId('candle-help-link'),
  candleModal: byId('candle-modal'),
  candleModalClose: byId('candle-modal-close'),
  cars: byId('cars'),
  dashAverage: byId('dash-average'),
  langToggle: byId('lang-toggle'),
};

const state = {
  viewId: 'tower',
  gIndex: GRANULARITIES.findIndex(g => g.id === 'yearly'),
  anchor: 1,
  renderedKey: null,
  objectId: null,
  view: null,
};
const bucketCache = new Map();
let rows = [];
let totals = { pages: 0, issues: 0 };
let overallMeanMinutes = null;

init();

async function init() {
  await initI18n();
  try {
    const response = await fetch('results.csv', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    rows = parseRows(await response.text());
  } catch (error) {
    els.chart.innerHTML = `<div class="empty">${t('error.loadFailed', { message: error.message })}</div>`;
    return;
  }
  if (rows.length === 0) {
    els.chart.innerHTML = `<div class="empty">${t('error.noData')}</div>`;
    return;
  }
  totals = { pages: d3.sum(rows, r => r.pages), issues: rows.length };
  overallMeanMinutes = d3.mean(rows, r => r.minutes);
  setupPlot();
  applyStaticTranslations();
  renderViewGroups();
  applyViewCopy(state.viewId);
  renderPills();
  renderLangToggle();
  bindEvents();
  render();
  renderDashboard(els.cars, els.dashAverage, rows);
}

/** Re-renders everything that carries translated text, after a language switch. */
function applyLanguage() {
  applyStaticTranslations();
  renderViewGroups();
  applyViewCopy(state.viewId);
  renderPills();
  updatePills();
  renderLangToggle();
  render();
  renderDashboard(els.cars, els.dashAverage, rows);
}

function renderLangToggle() {
  els.langToggle.innerHTML = LANGS
    .map(id => `<button type="button" data-lang="${id}" class="${id === getLang() ? 'active' : ''}">${t(`lang.${id}`)}</button>`)
    .join('');
  [...els.langToggle.children].forEach(button =>
    button.addEventListener('click', async () => {
      if (button.dataset.lang === getLang()) return;
      await setLang(button.dataset.lang);
      applyLanguage();
    }));
}

function bucketsFor(g) {
  if (!bucketCache.has(g.id)) bucketCache.set(g.id, aggregate(rows, g));
  return bucketCache.get(g.id);
}

const barWidthFor = band => Math.max(1, band * (band > 40 ? 0.56 : band > 12 ? 0.7 : band > 5 ? 0.8 : 0.92));

// Above this count, layers use merged paths / solid fills and must not opacity-fade.
// Fading a ~5k-subpath gradient layer (daily night) freezes Safari on phone and desktop.
const HEAVY_LAYER = 1500;

/** Replace tower/column layers. Heavy outgoing layers are removed immediately. */
function beginLayer(container, animate) {
  const old = container.selectAll('g.layer');
  const heavyOut = !old.filter('.heavy').empty();
  if (animate && !heavyOut) old.interrupt().transition().duration(220).style('opacity', 0).remove();
  else old.interrupt().remove();
  return container.append('g').attr('class', 'layer');
}

// Real pixel-width measurement for x-axis tick labels, so overlap is resolved
// by thinning out ticks (never by shortening the label text further).
const TICK_FONT_STACK = 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const TICK_GAP = 12;
const measureCtx = document.createElement('canvas').getContext('2d');
function measureMaxLabelWidth(buckets, g, indices, level, short) {
  let max = 0;
  for (const i of indices) {
    const key = buckets[i].key;
    const bold = g.maxLevel > 0 && g.level(key) === g.maxLevel;
    const label = g.tick(key, level, { short });
    const lines = Array.isArray(label) ? label : [label];
    lines.forEach((line, k) => {
      measureCtx.font = `${k === 0 && bold ? 600 : 400} ${k === 0 ? 11 : 10.5}px ${TICK_FONT_STACK}`;
      const w = measureCtx.measureText(String(line)).width;
      if (w > max) max = w;
    });
  }
  return max;
}

// On narrow (phone) viewports, bars/candles and their gaps shrink below the
// desktop-tuned minimum band width so a whole series still fits without
// losing the ability to compare buckets at a glance.
const NARROW_CHART_W = 640;
function minBandFor(minBand, chartW) {
  if (chartW >= NARROW_CHART_W) return minBand;
  const scale = Math.max(0.18, chartW / 900);
  return Math.max(1, minBand * scale);
}

// Daily spans ~10k buckets → 13–30k px SVG. WebKit often freezes or tabs out
// past ~8k px with complex gradient paths; Chromium tolerates the full width.
const WEBKIT_MAX_PLOT_W = 8192;
const isWebKit = typeof navigator !== 'undefined' && /Apple Computer/.test(navigator.vendor);
function plotWidthFor(n, minBand, chartW, viewportW) {
  const desired = Math.max(viewportW, Math.ceil(n * minBandFor(minBand, chartW)));
  return isWebKit ? Math.min(desired, Math.max(viewportW, WEBKIT_MAX_PLOT_W)) : desired;
}

// Shrinks an SVG text element's font size (from its CSS-defined size) just
// enough to fit within `maxWidth`, so long labels never get silently clipped
// by the containing SVG's bounds on narrow screens.
function fitTextToWidth(sel, maxWidth) {
  const node = sel.node();
  if (!node) return;
  node.style.fontSize = '';
  if (maxWidth <= 0) return;
  const natural = node.getComputedTextLength();
  if (natural > maxWidth) {
    const current = parseFloat(getComputedStyle(node).fontSize);
    node.style.fontSize = `${Math.max(current * (maxWidth / natural), current * 0.5).toFixed(1)}px`;
  }
}

function setupPlot() {
  const svg = d3.select(els.plot);
  const defs = svg.append('defs');

  const paper = defs.append('pattern')
    .attr('id', 'paper').attr('patternUnits', 'userSpaceOnUse').attr('width', 8).attr('height', 2.4);
  paper.append('rect').attr('width', 8).attr('height', 2.4).attr('fill', '#f6f3ea');
  paper.append('rect').attr('y', 1.9).attr('width', 8).attr('height', 0.5).attr('fill', '#d4ccbb');

  const edge = defs.append('linearGradient').attr('id', 'edge');
  [[0, 0.3], [0.16, 0], [0.78, 0], [1, 0.34]].forEach(([offset, opacity]) =>
    edge.append('stop').attr('offset', offset).attr('stop-color', '#0b1020').attr('stop-opacity', opacity));

  const glow = defs.append('linearGradient').attr('id', 'hl').attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 1);
  glow.append('stop').attr('offset', 0).attr('stop-color', '#fbbf24').attr('stop-opacity', 0);
  glow.append('stop').attr('offset', 1).attr('stop-color', '#fbbf24').attr('stop-opacity', 0.16);

  const sky = defs.append('linearGradient').attr('id', 'sky').attr('gradientUnits', 'userSpaceOnUse')
    .attr('x1', 0).attr('x2', 0).attr('y1', 0).attr('y2', 100);
  [
    [0, '#0b1020'], [0.1667, '#152048'], [0.25, '#ff9d6a'], [0.333, '#ffd27a'],
    [0.5, '#8ecbff'], [0.667, '#8ecbff'], [0.75, '#ff8a65'], [0.833, '#5b3d79'],
    [0.9167, '#141b3d'], [1, '#0b1020'],
  ].forEach(([offset, color]) => sky.append('stop').attr('offset', offset).attr('stop-color', color));

  svg.append('g').attr('class', 'grid');
  svg.append('rect').attr('class', 'hl').attr('fill', 'url(#hl)').attr('opacity', 0);
  svg.append('rect').attr('class', 'hit').attr('fill', 'transparent').attr('pointer-events', 'all');
  svg.append('g').attr('class', 'towers');
  svg.append('g').attr('class', 'ref');
  svg.append('g').attr('class', 'annot');
  svg.append('g').attr('class', 'x-axis');
}

function renderViewGroups() {
  els.groups.innerHTML = VIEW_GROUPS
    .map(id => `<button type="button" data-view="${id}" class="${id === state.viewId ? 'active' : ''}">${t(`view.${id}.label`)}</button>`)
    .join('');
  [...els.groups.children].forEach(button =>
    button.addEventListener('click', () => setView(button.dataset.view)));
}

function applyViewCopy(id) {
  els.heading.textContent = t(`view.${id}.title`);
  els.lede.textContent = t(`view.${id}.lede`);
  document.title = `Magyar Közlöny · ${t(`view.${id}.label`)}`;
}

function setView(id) {
  if (id === state.viewId) return;
  captureAnchor();
  state.viewId = id;
  applyViewCopy(id);
  [...els.groups.children].forEach(button => button.classList.toggle('active', button.dataset.view === id));
  hideTooltip();
  render({ animate: true });
}

function renderPills() {
  els.granularity.innerHTML = '';
  GRANULARITIES.forEach((g, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.role = 'tab';
    button.textContent = t(`granularity.${g.id}`);
    button.addEventListener('click', () => setGranularity(i));
    els.granularity.append(button);
  });
}

function updatePills() {
  [...els.granularity.children].forEach((button, i) => {
    button.classList.toggle('active', i === state.gIndex);
    button.setAttribute('aria-selected', String(i === state.gIndex));
  });
}

function setGranularity(index) {
  const next = Math.max(0, Math.min(GRANULARITIES.length - 1, index));
  if (next === state.gIndex) return;
  captureAnchor();
  state.gIndex = next;
  hideTooltip();
  render({ animate: true });
}

function captureAnchor() {
  const s = els.scroll;
  if (s.scrollWidth > s.clientWidth + 1) {
    state.anchor = (s.scrollLeft + s.clientWidth / 2) / s.scrollWidth;
  }
}

function render({ animate = false } = {}) {
  if (state.viewId === 'night') renderNightView(animate);
  else renderTowerView(animate);
  const candles = state.viewId === 'night' && !COLUMN_GRANULARITIES.has(GRANULARITIES[state.gIndex].id);
  els.candleHelpLink.hidden = !candles;
  if (!candles) closeCandleModal();
  updatePills();
}

// ---------------------------------------------------------------------------
// Paper tower view
// ---------------------------------------------------------------------------

function renderTowerView(animate) {
  const g = GRANULARITIES[state.gIndex];
  const buckets = bucketsFor(g);
  const n = buckets.length;
  const maxBucket = buckets.reduce((a, b) => (b.pages > a.pages ? b : a), buckets[0]);
  const maxH = maxBucket.pages * SHEET_M;
  const obj = pickObject(maxH);
  const top = Math.max(obj.height, maxH) * HEADROOM;

  const chartW = els.chart.clientWidth;
  const estimatedObjPx = (els.chart.clientHeight - MARGIN.top - MARGIN.bottom) * obj.height / top;
  const objFloor = chartW < NARROW_CHART_W ? 96 : 200;
  const objW = Math.round(Math.min(Math.max(estimatedObjPx * obj.aspect + 96, objFloor), chartW * 0.4));
  const viewportW = chartW - Y_AXIS_W - objW;
  const plotW = plotWidthFor(n, g.minBand, chartW, viewportW);

  els.scroll.style.width = `${viewportW}px`;
  els.plot.setAttribute('width', plotW);
  const height = els.scroll.clientHeight;
  els.plot.setAttribute('height', height);
  d3.select(els.plot).select('rect.hit').attr('width', plotW).attr('height', height);
  els.yAxis.setAttribute('width', Y_AXIS_W);
  els.yAxis.setAttribute('height', height);
  els.object.setAttribute('width', objW);
  els.object.setAttribute('height', height);

  const innerH = height - MARGIN.top - MARGIN.bottom;
  const y = d3.scaleLinear([0, top], [MARGIN.top + innerH, MARGIN.top]);
  const ground = y(0);
  const band = plotW / n;
  const key = `tower:${g.id}`;
  const animateTowers = animate && state.renderedKey !== key;

  renderYAxis(y, top);
  renderGrid(y, plotW);
  renderTowers(buckets, y, band, animateTowers);
  renderXAxis(buckets, g, band, ground);
  renderReference(y(obj.height), plotW);
  renderAnnotation(buckets.indexOf(maxBucket), maxH, y, band, plotW, formatHeight);
  renderObject(obj, y, objW, ground, animate);
  renderStats(g, maxBucket, maxH, obj);

  state.view = { viewId: 'tower', g, buckets, band, obj, ground };
  state.renderedKey = key;
  els.scroll.scrollLeft = state.anchor * plotW - viewportW / 2;
}

function renderYAxis(y, top) {
  const unit = top < 1 ? 'cm' : 'm';
  const svg = d3.select(els.yAxis);
  svg.selectAll('*').remove();
  svg.selectAll('text.tick')
    .data(y.ticks(5))
    .join('text')
    .attr('class', 'tick')
    .attr('x', Y_AXIS_W - 12)
    .attr('y', d => y(d))
    .attr('dy', '0.32em')
    .attr('text-anchor', 'end')
    .text(d => formatAxisTick(d, unit));
  const title = svg.append('text')
    .attr('class', 'title')
    .attr('x', 8)
    .attr('y', MARGIN.top - 36)
    .text(t('axis.height'));
  fitTextToWidth(title, Y_AXIS_W - 12);
}

function renderGrid(y, plotW, tickValues) {
  d3.select(els.plot).select('g.grid')
    .selectAll('line')
    .data(tickValues ?? y.ticks(5))
    .join('line')
    .attr('class', d => (d === 0 ? 'zero' : null))
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', d => Math.round(y(d)) + 0.5)
    .attr('y2', d => Math.round(y(d)) + 0.5);
}

function renderTowers(buckets, y, band, animate) {
  const container = d3.select(els.plot).select('g.towers');
  const layer = beginLayer(container, animate);
  const ground = y(0);
  const barW = barWidthFor(band);
  const offset = (band - barW) / 2;
  const nonEmpty = [];
  buckets.forEach((b, i) => {
    if (b.pages > 0) nonEmpty.push({ b, i, j: nonEmpty.length, h: ground - y(b.pages * SHEET_M) });
  });
  const heavy = nonEmpty.length > HEAVY_LAYER;
  const detailed = barW >= 4 && !heavy;

  // Daily (~5k bars): one path, no per-bar DOM / opacity fades (Safari-safe).
  if (heavy) {
    layer.classed('heavy', true);
    const bodyPath = d3.path();
    for (const d of nonEmpty) bodyPath.rect(d.i * band + offset, ground - d.h, barW, d.h);
    layer.append('path').attr('class', 'body').attr('d', bodyPath).attr('fill', '#ebe5d7');
    return;
  }

  const towers = layer.selectAll('g')
    .data(nonEmpty)
    .join('g')
    .attr('transform', d => `translate(${(d.i * band + offset).toFixed(2)},0)`);

  towers.append('rect').attr('class', 'body').attr('width', barW)
    .attr('fill', detailed ? 'url(#paper)' : '#ebe5d7');
  if (detailed) {
    towers.append('rect').attr('class', 'body').attr('width', barW).attr('fill', 'url(#edge)');
    towers.append('rect').attr('class', 'cap').attr('width', barW).attr('height', 1.5).attr('fill', '#fff');
  }

  const bodies = towers.selectAll('rect.body');
  const caps = towers.selectAll('rect.cap');

  if (animate) {
    const stagger = Math.min(14, 520 / Math.max(1, nonEmpty.length));
    bodies.attr('y', ground).attr('height', 0)
      .transition().delay(d => 120 + d.j * stagger).duration(700).ease(d3.easeCubicOut)
      .attr('y', d => ground - d.h).attr('height', d => d.h);
    caps.attr('y', ground)
      .transition().delay(d => 120 + d.j * stagger).duration(700).ease(d3.easeCubicOut)
      .attr('y', d => ground - d.h);
  } else {
    bodies.attr('y', d => ground - d.h).attr('height', d => d.h);
    caps.attr('y', d => ground - d.h);
  }
}

function renderObject(obj, y, objW, ground, animate) {
  const svg = d3.select(els.object);
  svg.selectAll('line.ground').data([0]).join('line')
    .attr('class', 'ground').attr('x1', 0).attr('x2', objW).attr('y1', ground).attr('y2', ground);

  const objPx = ground - y(obj.height);
  const w = objPx * obj.aspect;
  const geometry = { x: Math.max(16, (objW - w) / 2 - 10), w, objPx, ground, topY: ground - objPx, objW };

  let layer = svg.select('g.obj-layer.current');
  if (state.objectId === obj.id && !layer.empty()) {
    layer.select('text.obj-name').text(t(`object.${obj.id}`).toUpperCase());
    applyObjectGeometry(layer, geometry, animate);
    return;
  }

  if (!layer.empty()) {
    layer.classed('current', false);
    if (animate) layer.interrupt().transition().duration(260).style('opacity', 0).attr('transform', 'translate(0,16)').remove();
    else layer.remove();
  }

  layer = svg.append('g').attr('class', 'obj-layer current');
  layer.append('line').attr('class', 'ref');
  layer.append('ellipse').attr('class', 'shadow');
  layer.append('svg')
    .attr('class', 'art')
    .attr('overflow', 'visible')
    .attr('viewBox', `0 0 ${(obj.aspect * 100).toFixed(2)} 100`)
    .html(obj.art);
  const dim = layer.append('g').attr('class', 'dim');
  dim.append('line').attr('class', 'dim-v');
  dim.append('line').attr('class', 'cap-top');
  dim.append('line').attr('class', 'cap-bottom');
  layer.append('text').attr('class', 'obj-name').text(t(`object.${obj.id}`).toUpperCase());
  layer.append('text').attr('class', 'obj-height').text(formatHeight(obj.height));
  applyObjectGeometry(layer, geometry, false);

  if (animate) {
    layer.style('opacity', 0).attr('transform', 'translate(0,-14)')
      .transition().delay(120).duration(460).ease(d3.easeCubicOut)
      .style('opacity', 1).attr('transform', 'translate(0,0)');
  }
  state.objectId = obj.id;
}

// The artwork may be wider than its pane on phones; its labels must still stay fully inside.
function placeObjectLabel(sel, centerX, y, objW, tr) {
  const margin = 6;
  fitTextToWidth(sel, objW - margin * 2);
  const half = (sel.node()?.getComputedTextLength() ?? 0) / 2;
  const x = Math.max(margin + half, Math.min(centerX, objW - margin - half));
  tr(sel).attr('x', x).attr('y', y);
}

function applyObjectGeometry(layer, { x, w, objPx, ground, topY, objW }, animate) {
  const tr = selection => (animate ? selection.transition().duration(650).ease(d3.easeCubicOut) : selection);
  const dimX = x + w + 16;
  const centerX = x + w / 2;
  tr(layer.select('svg.art')).attr('x', x).attr('y', topY).attr('width', w).attr('height', objPx);
  tr(layer.select('ellipse.shadow'))
    .attr('cx', centerX).attr('cy', ground)
    .attr('rx', w * 0.58 + 4).attr('ry', Math.max(3, Math.min(10, w * 0.07)));
  tr(layer.select('line.ref')).attr('x1', 0).attr('x2', x - 6).attr('y1', topY).attr('y2', topY);
  tr(layer.select('line.dim-v')).attr('x1', dimX).attr('x2', dimX).attr('y1', topY).attr('y2', ground);
  tr(layer.select('line.cap-top')).attr('x1', dimX - 5).attr('x2', dimX + 5).attr('y1', topY).attr('y2', topY);
  tr(layer.select('line.cap-bottom')).attr('x1', dimX - 5).attr('x2', dimX + 5).attr('y1', ground).attr('y2', ground);
  placeObjectLabel(layer.select('text.obj-name'), centerX, topY - 34, objW, tr);
  placeObjectLabel(layer.select('text.obj-height'), centerX, topY - 12, objW, tr);
}

function renderStats(g, maxBucket, maxH, obj) {
  const cards = [
    { k: t('stats.pagesPublished'), v: formatInt(totals.pages), s: t('stats.issuesSuffix', { count: formatInt(totals.issues) }) },
    { k: t('stats.allTimeStack'), v: formatHeight(totals.pages * SHEET_M), s: t('stats.sheetsNote') },
    { k: t('stats.tallest', { unit: t(`unit.${g.unit}`) }), v: formatHeight(maxH), s: g.title(maxBucket.key) },
    {
      k: t('stats.comparedTo'),
      v: t(`object.${obj.id}`),
      s: t('stats.comparedToSub', { height: formatHeight(obj.height), ratio: formatRatio(maxH, obj.height) }),
    },
  ];
  renderStatCards(cards);
}

// ---------------------------------------------------------------------------
// Night shift view
// ---------------------------------------------------------------------------

function renderNightView(animate) {
  const g = GRANULARITIES[state.gIndex];
  const buckets = bucketsFor(g);
  const n = buckets.length;
  const withTime = buckets.filter(b => b.issues > 0);
  const maxTimeBucket = withTime.length
    ? withTime.reduce((a, b) => (b.meanMinutes > a.meanMinutes ? b : a), withTime[0])
    : null;

  const chartW = els.chart.clientWidth;
  const viewportW = chartW - NIGHT_AXIS_W;
  const plotW = plotWidthFor(n, g.minBand, chartW, viewportW);

  els.scroll.style.width = `${viewportW}px`;
  els.plot.setAttribute('width', plotW);
  const height = els.scroll.clientHeight;
  els.plot.setAttribute('height', height);
  d3.select(els.plot).select('rect.hit').attr('width', plotW).attr('height', height);
  els.yAxis.setAttribute('width', NIGHT_AXIS_W);
  els.yAxis.setAttribute('height', height);
  els.object.setAttribute('width', 0);
  els.object.setAttribute('height', height);
  if (state.objectId !== null) {
    d3.select(els.object).selectAll('*').remove();
    state.objectId = null;
  }

  const innerH = height - MARGIN.top - MARGIN.bottom;
  const y = d3.scaleLinear([0, DAY_MINUTES], [MARGIN.top + innerH, MARGIN.top]);
  const ground = y(0);
  const band = plotW / n;
  const key = `night:${g.id}`;
  const animateColumns = animate && state.renderedKey !== key;

  d3.select(els.plot).select('#sky').attr('y1', ground).attr('y2', y(DAY_MINUTES));

  renderNightYAxis(y);
  renderGrid(y, plotW, NIGHT_TICKS.map(t => t.minutes));
  if (COLUMN_GRANULARITIES.has(g.id)) renderNightColumns(buckets, y, band, ground, animateColumns);
  else renderNightCandles(buckets, y, band, ground, animateColumns);
  renderXAxis(buckets, g, band, ground);
  renderReference(y(overallMeanMinutes), plotW);
  const annot = d3.select(els.plot).select('g.annot');
  if (maxTimeBucket) {
    renderAnnotation(buckets.indexOf(maxTimeBucket), maxTimeBucket.meanMinutes, y, band, plotW, formatTime);
  } else {
    annot.selectAll('*').remove();
  }
  renderNightStats(g, maxTimeBucket);

  state.view = { viewId: 'night', g, buckets, band, ground };
  state.renderedKey = key;
  els.scroll.scrollLeft = state.anchor * plotW - viewportW / 2;
}

function renderNightYAxis(y) {
  const svg = d3.select(els.yAxis);
  svg.selectAll('*').remove();

  NIGHT_TICKS.forEach(tick => {
    const cy = y(tick.minutes);
    svg.append('text')
      .attr('class', 'mood')
      .attr('x', 10)
      .attr('y', cy)
      .attr('dominant-baseline', 'central')
      .text(tick.emoji);
    svg.append('text')
      .attr('class', 'tick')
      .attr('x', NIGHT_AXIS_W - 12)
      .attr('y', cy)
      .attr('dominant-baseline', 'central')
      .attr('text-anchor', 'end')
      .text(tick.label);
  });

  svg.append('text')
    .attr('class', 'title')
    .attr('x', 10)
    .attr('y', MARGIN.top - 36)
    .text(t('axis.releaseTime'));
}

// Daily and weekly: one column per bucket, rising from midnight to the average release time.
function renderNightColumns(buckets, y, band, ground, animate) {
  const container = d3.select(els.plot).select('g.towers');
  const layer = beginLayer(container, animate);
  const barW = barWidthFor(band);
  const offset = (band - barW) / 2;
  const nonEmpty = [];
  buckets.forEach((b, i) => {
    if (b.issues > 0) nonEmpty.push({ b, i, j: nonEmpty.length, h: ground - y(b.meanMinutes) });
  });

  // Thousands of gradient-filled rects: merge into paths and skip opacity fades
  // (Safari freezes when compositing these, especially on navigate away).
  if (nonEmpty.length > HEAVY_LAYER) {
    layer.classed('heavy', true);
    const bodyPath = d3.path();
    const capPath = d3.path();
    for (const d of nonEmpty) {
      const x = d.i * band + offset;
      bodyPath.rect(x, ground - d.h, barW, d.h);
      capPath.rect(x, ground - d.h, barW, 1.6);
    }
    layer.append('path').attr('class', 'body').attr('d', bodyPath).attr('fill', 'url(#sky)');
    layer.append('path').attr('class', 'cap').attr('d', capPath).attr('fill', '#fff').attr('opacity', 0.85);
    return;
  }

  const cols = layer.selectAll('g')
    .data(nonEmpty)
    .join('g')
    .attr('transform', d => `translate(${(d.i * band + offset).toFixed(2)},0)`);

  cols.append('rect').attr('class', 'body').attr('width', barW).attr('fill', 'url(#sky)');
  cols.append('rect').attr('class', 'cap').attr('width', barW).attr('height', 1.6)
    .attr('fill', '#fff').attr('opacity', 0.85);

  const bodies = cols.selectAll('rect.body');
  const caps = cols.selectAll('rect.cap');

  if (animate) {
    const stagger = Math.min(14, 520 / Math.max(1, nonEmpty.length));
    bodies.attr('y', ground).attr('height', 0)
      .transition().delay(d => 120 + d.j * stagger).duration(700).ease(d3.easeCubicOut)
      .attr('y', d => ground - d.h).attr('height', d => d.h);
    caps.attr('y', ground)
      .transition().delay(d => 120 + d.j * stagger).duration(700).ease(d3.easeCubicOut)
      .attr('y', d => ground - d.h);
  } else {
    bodies.attr('y', d => ground - d.h).attr('height', d => d.h);
    caps.attr('y', d => ground - d.h);
  }
}

// A collapsed percentile range would be invisible, so keep at least a 1px mark.
function visibleSpan(yTop, yBottom) {
  const h = yBottom - yTop;
  if (h >= 1) return { y: yTop, h };
  return { y: yTop - (1 - h) / 2, h: 1 };
}

// Each column is a candlestick. The wide box is the 25th–75th percentile; the thin
// wick is the 10th–90th, so releases outside that band stay off the chart as outliers.
function renderNightCandles(buckets, y, band, ground, animate) {
  const container = d3.select(els.plot).select('g.towers');
  const layer = beginLayer(container, animate);
  const barW = barWidthFor(band);
  const wickW = Math.max(1, Math.min(barW * 0.22, 3));
  const offset = (band - barW) / 2;
  const wickX = (barW - wickW) / 2;

  const nonEmpty = [];
  buckets.forEach((b, i) => {
    if (b.issues === 0) return;
    const sorted = b.minutes;
    const wick = visibleSpan(y(quantile(sorted, 0.9)), y(quantile(sorted, 0.1)));
    const box = visibleSpan(y(quantile(sorted, 0.75)), y(quantile(sorted, 0.25)));
    nonEmpty.push({
      b, i, j: nonEmpty.length,
      yWick: wick.y, hWick: wick.h,
      yBox: box.y, hBox: box.h,
      yMed: y(quantile(sorted, 0.5)),
    });
  });

  // Same Safari-safe path as night columns: merge and skip opacity fades.
  if (nonEmpty.length > HEAVY_LAYER) {
    layer.classed('heavy', true);
    const wickPath = d3.path();
    const boxPath = d3.path();
    for (const d of nonEmpty) {
      const x = d.i * band + offset;
      wickPath.rect(x + wickX, d.yWick, wickW, d.hWick);
      boxPath.rect(x, d.yBox, barW, d.hBox);
    }
    layer.append('path').attr('class', 'wick').attr('d', wickPath).attr('fill', '#9fb4d8');
    layer.append('path').attr('class', 'box').attr('d', boxPath).attr('fill', 'url(#sky)');
    return;
  }

  const cols = layer.selectAll('g')
    .data(nonEmpty)
    .join('g')
    .attr('transform', d => `translate(${(d.i * band + offset).toFixed(2)},0)`);

  cols.append('rect').attr('class', 'wick').attr('x', wickX).attr('width', wickW).attr('fill', '#9fb4d8');
  cols.append('rect').attr('class', 'box').attr('x', 0).attr('width', barW).attr('fill', 'url(#sky)');

  const wicks = cols.selectAll('rect.wick');
  const boxes = cols.selectAll('rect.box');

  if (animate) {
    const stagger = Math.min(14, 520 / Math.max(1, nonEmpty.length));
    wicks.attr('y', d => d.yMed).attr('height', 0)
      .transition().delay(d => 120 + d.j * stagger).duration(700).ease(d3.easeCubicOut)
      .attr('y', d => d.yWick).attr('height', d => d.hWick);
    boxes.attr('y', d => d.yMed).attr('height', 0)
      .transition().delay(d => 120 + d.j * stagger).duration(700).ease(d3.easeCubicOut)
      .attr('y', d => d.yBox).attr('height', d => d.hBox);
  } else {
    wicks.attr('y', d => d.yWick).attr('height', d => d.hWick);
    boxes.attr('y', d => d.yBox).attr('height', d => d.hBox);
  }
}

function renderNightStats(g, maxTimeBucket) {
  const mood = moodMeta(overallMeanMinutes);
  const latestAvgLabel = t('stats.latestAvg', { unit: t(`unit.${g.unit}`) });
  const cards = [
    { k: t('stats.releasesAnalyzed'), v: formatInt(totals.issues), s: t('stats.pagesTotalSuffix', { count: formatInt(totals.pages) }) },
    { k: t('stats.allTimeAverage'), v: formatTime(overallMeanMinutes), s: t('stats.meanPublicationTime') },
    maxTimeBucket
      ? { k: latestAvgLabel, v: formatTime(maxTimeBucket.meanMinutes), s: g.title(maxTimeBucket.key) }
      : { k: latestAvgLabel, v: '—', s: t('stats.noDataInRange') },
    { k: t('stats.typicalMood'), v: `${mood.emoji}  ${t(`mood.${mood.key}`)}`, s: t('stats.avgReleaseAt', { time: formatTime(overallMeanMinutes) }) },
  ];
  renderStatCards(cards);
}

// ---------------------------------------------------------------------------
// Shared chart elements
// ---------------------------------------------------------------------------

function chooseTicks(buckets, g, band, short) {
  const minPx = short ? Math.max(28, (g.tickPx ?? 52) * 0.55) : (g.tickPx ?? 52);
  for (let level = 0; level <= g.maxLevel; level++) {
    const indices = [];
    buckets.forEach((b, i) => {
      if (g.level(b.key) >= level) indices.push(i);
    });
    if (indices.length === 0) continue;
    const spacing = (buckets.length * band) / indices.length;
    if (spacing < minPx && level !== g.maxLevel) continue;

    const initialStep = Math.max(1, Math.ceil(minPx / spacing));
    const candidates = indices.filter((_, k) => k % initialStep === 0);
    // Thin out further if the real label widths would still overlap (never shorten the text).
    const neededPx = measureMaxLabelWidth(buckets, g, candidates, level, short) + TICK_GAP;
    const step = Math.max(initialStep, Math.ceil(neededPx / spacing));
    return { level, indices: indices.filter((_, k) => k % step === 0) };
  }
  return { level: 0, indices: [] };
}

function renderXAxis(buckets, g, band, ground) {
  const axis = d3.select(els.plot).select('g.x-axis');
  axis.selectAll('*').remove();
  const short = els.chart.clientWidth < NARROW_CHART_W;
  const { level, indices } = chooseTicks(buckets, g, band, short);
  for (const i of indices) {
    const key = buckets[i].key;
    const x = i * band + band / 2;
    const label = g.tick(key, level, { short });
    const lines = Array.isArray(label) ? label : [label];
    axis.append('line').attr('x1', x).attr('x2', x).attr('y1', ground).attr('y2', ground + 5);
    const text = axis.append('text')
      .attr('x', x)
      .attr('y', ground + 20)
      .attr('text-anchor', 'middle')
      .attr('class', g.maxLevel > 0 && g.level(key) === g.maxLevel ? 'major' : null);
    lines.forEach((line, k) => text.append('tspan')
      .attr('x', x)
      .attr('dy', k ? '1.35em' : 0)
      .attr('class', k ? 'sub' : null)
      .text(line));
  }
}

function renderReference(yRef, plotW) {
  d3.select(els.plot).select('g.ref')
    .selectAll('line')
    .data([yRef])
    .join('line')
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', d => d)
    .attr('y2', d => d);
}

function renderAnnotation(index, value, y, band, plotW, formatText) {
  const x = Math.min(Math.max(index * band + band / 2, 28), plotW - 28);
  const yTop = y(value);
  const annot = d3.select(els.plot).select('g.annot');
  annot.selectAll('circle').data([0]).join('circle').attr('cx', x).attr('cy', yTop - 6).attr('r', 2.2);
  annot.selectAll('text').data([0]).join('text')
    .attr('x', x)
    .attr('y', yTop - 14)
    .attr('text-anchor', 'middle')
    .text(formatText(value));
}

function renderStatCards(cards) {
  els.stats.innerHTML = cards
    .map(c => `<div class="stat"><div class="k">${c.k}</div><div class="v">${c.v}</div><div class="s">${c.s}</div></div>`)
    .join('');
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function highlightColumn(i, band, ground) {
  d3.select(els.plot).select('rect.hl')
    .attr('x', i * band)
    .attr('width', band)
    .attr('y', MARGIN.top - 24)
    .attr('height', ground - MARGIN.top + 24)
    .attr('opacity', 1);
}

function positionTooltip(event) {
  const rect = els.tooltip.getBoundingClientRect();
  const left = event.clientX + 16 + rect.width > window.innerWidth ? event.clientX - rect.width - 16 : event.clientX + 16;
  const top = Math.min(event.clientY + 16, window.innerHeight - rect.height - 8);
  els.tooltip.style.transform = `translate(${left}px, ${top}px)`;
  els.tooltip.classList.add('show');
}

function showTooltip(event) {
  const view = state.view;
  if (!view) return;
  const [px, py] = d3.pointer(event, els.plot);
  const i = Math.floor(px / view.band);
  if (i < 0 || i >= view.buckets.length || py < MARGIN.top - 24 || py > view.ground + 44) {
    hideTooltip();
    return;
  }
  const bucket = view.buckets[i];
  highlightColumn(i, view.band, view.ground);
  if (view.viewId === 'night') showNightTooltip(event, view, bucket);
  else showTowerTooltip(event, view, bucket);
}

function showTowerTooltip(event, view, bucket) {
  const height = bucket.pages * SHEET_M;
  const sub = view.g.sub?.(bucket.key);
  els.tooltip.innerHTML = `
    <div class="tt-title">${view.g.title(bucket.key)}</div>
    ${sub ? `<div class="tt-sub">${sub}</div>` : '<div class="tt-sub"></div>'}
    <div class="tt-row"><span>${t('tooltip.pages')}</span><b>${formatInt(bucket.pages)}</b></div>
    <div class="tt-row"><span>${t('tooltip.issues')}</span><b>${formatInt(bucket.issues)}</b></div>
    <div class="tt-row"><span>${t('tooltip.stackHeight')}</span><b>${formatHeight(height)}</b></div>
    <div class="tt-row"><span>${t('tooltip.vs', { name: t(`object.${view.obj.id}`).toLowerCase() })}</span><b>${formatRatio(height, view.obj.height)}</b></div>`;
  positionTooltip(event);
}

function showNightTooltip(event, view, bucket) {
  const sub = view.g.sub?.(bucket.key);
  const body = bucket.issues > 0
    ? `
      <div class="tt-row"><span>${t('tooltip.issues')}</span><b>${formatInt(bucket.issues)}</b></div>
      <div class="tt-row"><span>${t('tooltip.avg')}</span><b>${formatTime(bucket.meanMinutes)}</b></div>
      <div class="tt-row"><span>${t('tooltip.median')}</span><b>${formatTime(quantile(bucket.minutes, 0.5))}</b></div>
      <div class="tt-row"><span>${t('tooltip.stdDeviation')}</span><b>${formatDuration(stdDev(bucket.minutes, bucket.meanMinutes))}</b></div>
      <div class="tt-row"><span>${t('tooltip.p10')}</span><b>${formatTime(quantile(bucket.minutes, 0.1))}</b></div>
      <div class="tt-row"><span>${t('tooltip.p25')}</span><b>${formatTime(quantile(bucket.minutes, 0.25))}</b></div>
      <div class="tt-row"><span>${t('tooltip.p75')}</span><b>${formatTime(quantile(bucket.minutes, 0.75))}</b></div>
      <div class="tt-row"><span>${t('tooltip.p90')}</span><b>${formatTime(quantile(bucket.minutes, 0.9))}</b></div>`
    : `<div class="tt-row"><span>${t('tooltip.noIssues')}</span><b>—</b></div>`;
  els.tooltip.innerHTML = `
    <div class="tt-title">${view.g.title(bucket.key)}</div>
    ${sub ? `<div class="tt-sub">${sub}</div>` : '<div class="tt-sub"></div>'}
    ${body}`;
  positionTooltip(event);
}

function hideTooltip() {
  els.tooltip.classList.remove('show');
  d3.select(els.plot).select('rect.hl').attr('opacity', 0);
}

// ---------------------------------------------------------------------------
// Candle interpretation modal
// ---------------------------------------------------------------------------

function openCandleModal() {
  els.candleModal.hidden = false;
}

function closeCandleModal() {
  els.candleModal.hidden = true;
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------

function bindEvents() {
  let wheelAccumulator = 0;
  let lastStep = 0;
  els.chart.addEventListener('wheel', event => {
    event.preventDefault();
    const scale = event.deltaMode === 1 ? 16 : 1;
    const horizontal = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
    if (horizontal) {
      els.scroll.scrollLeft += (event.deltaX || event.deltaY) * scale;
      return;
    }
    const now = performance.now();
    if (now - lastStep < WHEEL_COOLDOWN_MS) {
      wheelAccumulator = 0;
      return;
    }
    wheelAccumulator += event.deltaY * scale;
    if (Math.abs(wheelAccumulator) >= WHEEL_STEP) {
      setGranularity(state.gIndex + Math.sign(wheelAccumulator));
      wheelAccumulator = 0;
      lastStep = now;
    }
  }, { passive: false });

  window.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'PageDown') setGranularity(state.gIndex + 1);
    else if (event.key === 'ArrowUp' || event.key === 'PageUp') setGranularity(state.gIndex - 1);
    else return;
    event.preventDefault();
  });

  // Phones have no hover, so a tap has to open the tooltip and leave it open.
  const noHover = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;
  const isTouch = event => event.pointerType === 'touch' || event.pointerType === 'pen';
  let drag = null;
  let touchTooltip = false;
  els.scroll.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, left: els.scroll.scrollLeft, moved: false };
  });
  window.addEventListener('pointermove', event => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 3) {
      drag.moved = true;
      els.scroll.classList.add('dragging');
      hideTooltip();
    }
    if (drag.moved) els.scroll.scrollLeft = drag.left - dx;
  });
  window.addEventListener('pointerup', () => {
    drag = null;
    els.scroll.classList.remove('dragging');
  });

  els.plot.addEventListener('pointermove', event => {
    if (noHover() || isTouch(event) || drag?.moved) return;
    showTooltip(event);
  });
  // pointerup reaches the plot before the window handler clears the drag.
  els.plot.addEventListener('pointerup', event => {
    if ((!isTouch(event) && !noHover()) || drag?.moved) return;
    touchTooltip = true;
    showTooltip(event);
  });
  els.plot.addEventListener('pointerleave', () => {
    if (touchTooltip || noHover()) return;
    hideTooltip();
  });
  document.addEventListener('pointerdown', event => {
    if ((touchTooltip || noHover()) && !els.plot.contains(event.target)) {
      touchTooltip = false;
      hideTooltip();
    }
  });

  els.candleHelpLink.addEventListener('click', openCandleModal);
  els.candleModalClose.addEventListener('click', closeCandleModal);
  els.candleModal.addEventListener('click', event => {
    if (event.target === els.candleModal) closeCandleModal();
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !els.candleModal.hidden) closeCandleModal();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      captureAnchor();
      render();
    }, 120);
  });
}
