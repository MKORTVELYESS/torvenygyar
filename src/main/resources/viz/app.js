import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { GRANULARITIES, aggregate, parseRows, quantile } from './data.js';
import { pickObject } from './objects.js';
import { CLERK_ART, CLERK_ASPECT, NIGHT_TICKS, moodMeta } from './people.js';
import { formatAxisTick, formatHeight, formatInt, formatRatio, formatTime } from './format.js';

const SHEET_M = 0.0001; // one 80 g/m² A4 sheet ≈ 0.1 mm
const DAY_MINUTES = 1440;
const MARGIN = { top: 72, bottom: 56 };
const Y_AXIS_W = 64;
const NIGHT_AXIS_W = 126;
const HEADROOM = 1.1;
const WHEEL_STEP = 40;
const WHEEL_COOLDOWN_MS = 380;
const VIEW_GROUPS = [
  { id: 'tower', label: 'Paper tower' },
  { id: 'night', label: 'Night shift' },
];

const byId = id => document.getElementById(id);
const els = {
  groups: byId('view-groups'),
  granularity: byId('granularity'),
  stats: byId('stats'),
  chart: byId('chart'),
  yAxis: byId('y-axis'),
  scroll: byId('plot-scroll'),
  plot: byId('plot'),
  object: byId('object'),
  tooltip: byId('tooltip'),
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
  try {
    const response = await fetch('results.csv', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    rows = parseRows(await response.text());
  } catch (error) {
    els.chart.innerHTML = `<div class="empty">Could not load results.csv (${error.message})</div>`;
    return;
  }
  if (rows.length === 0) {
    els.chart.innerHTML = '<div class="empty">results.csv has no dated rows yet.</div>';
    return;
  }
  totals = { pages: d3.sum(rows, r => r.pages), issues: rows.length };
  overallMeanMinutes = d3.mean(rows, r => r.minutes);
  setupPlot();
  renderViewGroups();
  renderPills();
  bindEvents();
  render();
}

function bucketsFor(g) {
  if (!bucketCache.has(g.id)) bucketCache.set(g.id, aggregate(rows, g));
  return bucketCache.get(g.id);
}

const barWidthFor = band => Math.max(1, band * (band > 40 ? 0.56 : band > 12 ? 0.7 : band > 5 ? 0.8 : 0.92));

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
  svg.append('g').attr('class', 'towers');
  svg.append('g').attr('class', 'ref');
  svg.append('g').attr('class', 'annot');
  svg.append('g').attr('class', 'x-axis');
}

function renderViewGroups() {
  els.groups.innerHTML = VIEW_GROUPS
    .map(v => `<button type="button" data-view="${v.id}" class="${v.id === state.viewId ? 'active' : ''}">${v.label}</button>`)
    .join('');
  [...els.groups.children].forEach(button =>
    button.addEventListener('click', () => setView(button.dataset.view)));
}

function setView(id) {
  if (id === state.viewId) return;
  captureAnchor();
  state.viewId = id;
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
    button.textContent = g.label;
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
  const objW = Math.round(Math.min(Math.max(estimatedObjPx * obj.aspect + 96, 200), chartW * 0.4));
  const viewportW = chartW - Y_AXIS_W - objW;
  const plotW = Math.max(viewportW, Math.ceil(n * g.minBand));

  els.scroll.style.width = `${viewportW}px`;
  els.plot.setAttribute('width', plotW);
  const height = els.scroll.clientHeight;
  els.plot.setAttribute('height', height);
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
  svg.append('text')
    .attr('class', 'title')
    .attr('x', 16)
    .attr('y', MARGIN.top - 36)
    .text('HEIGHT');
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
  const old = container.selectAll('g.layer');
  if (animate) old.interrupt().transition().duration(220).style('opacity', 0).remove();
  else old.remove();

  const layer = container.append('g').attr('class', 'layer');
  const ground = y(0);
  const barW = barWidthFor(band);
  const offset = (band - barW) / 2;
  const nonEmpty = [];
  buckets.forEach((b, i) => {
    if (b.pages > 0) nonEmpty.push({ b, i, j: nonEmpty.length, h: ground - y(b.pages * SHEET_M) });
  });
  const detailed = barW >= 4 && nonEmpty.length <= 1500;

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

  if (animate && nonEmpty.length <= 1500) {
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
    if (animate) layer.style('opacity', 0).transition().duration(260).style('opacity', 1);
  }
}

function renderObject(obj, y, objW, ground, animate) {
  const svg = d3.select(els.object);
  svg.selectAll('line.ground').data([0]).join('line')
    .attr('class', 'ground').attr('x1', 0).attr('x2', objW).attr('y1', ground).attr('y2', ground);

  const objPx = ground - y(obj.height);
  const w = objPx * obj.aspect;
  const geometry = { x: Math.max(16, (objW - w) / 2 - 10), w, objPx, ground, topY: ground - objPx };

  let layer = svg.select('g.obj-layer.current');
  if (state.objectId === obj.id && !layer.empty()) {
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
  layer.append('text').attr('class', 'obj-name').text(obj.name.toUpperCase());
  layer.append('text').attr('class', 'obj-height').text(formatHeight(obj.height));
  applyObjectGeometry(layer, geometry, false);

  if (animate) {
    layer.style('opacity', 0).attr('transform', 'translate(0,-14)')
      .transition().delay(120).duration(460).ease(d3.easeCubicOut)
      .style('opacity', 1).attr('transform', 'translate(0,0)');
  }
  state.objectId = obj.id;
}

function applyObjectGeometry(layer, { x, w, objPx, ground, topY }, animate) {
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
  tr(layer.select('text.obj-name')).attr('x', centerX).attr('y', topY - 34);
  tr(layer.select('text.obj-height')).attr('x', centerX).attr('y', topY - 12);
}

function renderStats(g, maxBucket, maxH, obj) {
  const cards = [
    { k: 'Pages published', v: formatInt(totals.pages), s: `${formatInt(totals.issues)} issues` },
    { k: 'All-time stack', v: formatHeight(totals.pages * SHEET_M), s: 'A4 sheets at 0.1 mm each' },
    { k: `Tallest ${g.unit}`, v: formatHeight(maxH), s: g.title(maxBucket.key) },
    { k: 'Compared to', v: obj.name, s: `${formatHeight(obj.height)} · tallest tower is ${formatRatio(maxH, obj.height)} of it` },
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
  const plotW = Math.max(viewportW, Math.ceil(n * g.minBand));

  els.scroll.style.width = `${viewportW}px`;
  els.plot.setAttribute('width', plotW);
  const height = els.scroll.clientHeight;
  els.plot.setAttribute('height', height);
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
  renderNightColumns(buckets, y, band, ground, animateColumns);
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
  const iconH = 34;
  const iconW = iconH * CLERK_ASPECT;

  NIGHT_TICKS.forEach(tick => {
    const cy = y(tick.minutes);
    svg.append('svg')
      .attr('x', 14)
      .attr('y', cy - iconH / 2)
      .attr('width', iconW)
      .attr('height', iconH)
      .attr('viewBox', `0 0 ${(CLERK_ASPECT * 100).toFixed(1)} 100`)
      .attr('overflow', 'visible')
      .html(CLERK_ART[tick.mood]);
    svg.append('text')
      .attr('class', 'tick')
      .attr('x', NIGHT_AXIS_W - 12)
      .attr('y', cy)
      .attr('dy', '0.32em')
      .attr('text-anchor', 'end')
      .text(tick.label);
  });

  svg.append('text')
    .attr('class', 'title')
    .attr('x', 10)
    .attr('y', MARGIN.top - 36)
    .text('RELEASE TIME');
}

function renderNightColumns(buckets, y, band, ground, animate) {
  const container = d3.select(els.plot).select('g.towers');
  const old = container.selectAll('g.layer');
  if (animate) old.interrupt().transition().duration(220).style('opacity', 0).remove();
  else old.remove();

  const layer = container.append('g').attr('class', 'layer');
  const barW = barWidthFor(band);
  const offset = (band - barW) / 2;
  const nonEmpty = [];
  buckets.forEach((b, i) => {
    if (b.issues > 0) nonEmpty.push({ b, i, j: nonEmpty.length, h: ground - y(b.meanMinutes) });
  });

  const cols = layer.selectAll('g')
    .data(nonEmpty)
    .join('g')
    .attr('transform', d => `translate(${(d.i * band + offset).toFixed(2)},0)`);

  cols.append('rect').attr('class', 'body').attr('width', barW).attr('fill', 'url(#sky)');
  cols.append('rect').attr('class', 'cap').attr('width', barW).attr('height', 1.6)
    .attr('fill', '#fff').attr('opacity', 0.85);

  const bodies = cols.selectAll('rect.body');
  const caps = cols.selectAll('rect.cap');

  if (animate && nonEmpty.length <= 1500) {
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
    if (animate) layer.style('opacity', 0).transition().duration(260).style('opacity', 1);
  }
}

function renderNightStats(g, maxTimeBucket) {
  const mood = moodMeta(overallMeanMinutes);
  const cards = [
    { k: 'Releases analyzed', v: formatInt(totals.issues), s: `${formatInt(totals.pages)} pages total` },
    { k: 'All-time average', v: formatTime(overallMeanMinutes), s: 'mean publication time' },
    maxTimeBucket
      ? { k: `Latest avg ${g.unit}`, v: formatTime(maxTimeBucket.meanMinutes), s: g.title(maxTimeBucket.key) }
      : { k: `Latest avg ${g.unit}`, v: '—', s: 'no data in range' },
    { k: 'Typical mood', v: mood.label, s: `avg release at ${formatTime(overallMeanMinutes)}` },
  ];
  renderStatCards(cards);
}

// ---------------------------------------------------------------------------
// Shared chart elements
// ---------------------------------------------------------------------------

function chooseTicks(buckets, g, band) {
  const minPx = g.tickPx ?? 52;
  for (let level = 0; level <= g.maxLevel; level++) {
    const indices = [];
    buckets.forEach((b, i) => {
      if (g.level(b.key) >= level) indices.push(i);
    });
    if (indices.length === 0) continue;
    const spacing = (buckets.length * band) / indices.length;
    if (spacing >= minPx || level === g.maxLevel) {
      const step = Math.max(1, Math.ceil(minPx / spacing));
      return { level, indices: indices.filter((_, k) => k % step === 0) };
    }
  }
  return { level: 0, indices: [] };
}

function renderXAxis(buckets, g, band, ground) {
  const axis = d3.select(els.plot).select('g.x-axis');
  axis.selectAll('*').remove();
  const { level, indices } = chooseTicks(buckets, g, band);
  for (const i of indices) {
    const key = buckets[i].key;
    const x = i * band + band / 2;
    const label = g.tick(key, level);
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
    <div class="tt-row"><span>Pages</span><b>${formatInt(bucket.pages)}</b></div>
    <div class="tt-row"><span>Issues</span><b>${formatInt(bucket.issues)}</b></div>
    <div class="tt-row"><span>Stack height</span><b>${formatHeight(height)}</b></div>
    <div class="tt-row"><span>vs. ${view.obj.name.toLowerCase()}</span><b>${formatRatio(height, view.obj.height)}</b></div>`;
  positionTooltip(event);
}

function showNightTooltip(event, view, bucket) {
  const sub = view.g.sub?.(bucket.key);
  const body = bucket.issues > 0
    ? `
      <div class="tt-row"><span>Issues</span><b>${formatInt(bucket.issues)}</b></div>
      <div class="tt-row"><span>Average time</span><b>${formatTime(bucket.meanMinutes)}</b></div>
      <div class="tt-row"><span>10th percentile</span><b>${formatTime(quantile(bucket.minutes, 0.1))}</b></div>
      <div class="tt-row"><span>20th percentile</span><b>${formatTime(quantile(bucket.minutes, 0.2))}</b></div>
      <div class="tt-row"><span>50th percentile</span><b>${formatTime(quantile(bucket.minutes, 0.5))}</b></div>
      <div class="tt-row"><span>75th percentile</span><b>${formatTime(quantile(bucket.minutes, 0.75))}</b></div>
      <div class="tt-row"><span>90th percentile</span><b>${formatTime(quantile(bucket.minutes, 0.9))}</b></div>`
    : '<div class="tt-row"><span>No issues</span><b>—</b></div>';
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

  let drag = null;
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
    if (!drag?.moved) showTooltip(event);
  });
  els.plot.addEventListener('pointerleave', hideTooltip);

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      captureAnchor();
      render();
    }, 120);
  });
}
