import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import {
  NARROW_CHART_W,
  SKY_STOPS,
  WEBKIT_MAX_PLOT_W,
  isWebKit,
} from './constants.js';
import { els } from './dom.js';

export const barWidthFor = band =>
  Math.max(1, band * (band > 40 ? 0.56 : band > 12 ? 0.7 : band > 5 ? 0.8 : 0.92));

/** Replace tower/column layers. Heavy outgoing layers are removed immediately. */
export function beginLayer(container, animate) {
  const old = container.selectAll('g.layer');
  const heavyOut = !old.filter('.heavy').empty();
  if (animate && !heavyOut) old.interrupt().transition().duration(220).style('opacity', 0).remove();
  else old.interrupt().remove();
  return container.append('g').attr('class', 'layer');
}

// On narrow (phone) viewports, bars/candles and their gaps shrink below the
// desktop-tuned minimum band width so a whole series still fits without
// losing the ability to compare buckets at a glance.
export function minBandFor(minBand, chartW) {
  if (chartW >= NARROW_CHART_W) return minBand;
  const scale = Math.max(0.18, chartW / 900);
  return Math.max(1, minBand * scale);
}

export function plotWidthFor(n, minBand, chartW, viewportW) {
  const desired = Math.max(viewportW, Math.ceil(n * minBandFor(minBand, chartW)));
  return isWebKit ? Math.min(desired, Math.max(viewportW, WEBKIT_MAX_PLOT_W)) : desired;
}

// Shrinks an SVG text element's font size (from its CSS-defined size) just
// enough to fit within `maxWidth`, so long labels never get silently clipped
// by the containing SVG's bounds on narrow screens.
export function fitTextToWidth(sel, maxWidth) {
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

export function setupPlot() {
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
  SKY_STOPS.forEach(([offset, color]) => sky.append('stop').attr('offset', offset).attr('stop-color', color));

  svg.append('g').attr('class', 'grid');
  svg.append('rect').attr('class', 'hl').attr('fill', 'url(#hl)').attr('opacity', 0);
  svg.append('rect').attr('class', 'hit').attr('fill', 'transparent').attr('pointer-events', 'all');
  svg.append('g').attr('class', 'towers');
  svg.append('g').attr('class', 'ref');
  svg.append('g').attr('class', 'annot');
  svg.append('g').attr('class', 'x-axis');
}

export function renderGrid(y, plotW, tickValues) {
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

export function renderXAxis(buckets, g, band, ground) {
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

export function renderReference(yRef, plotW) {
  d3.select(els.plot).select('g.ref')
    .selectAll('line')
    .data([yRef])
    .join('line')
    .attr('x1', 0)
    .attr('x2', plotW)
    .attr('y1', d => d)
    .attr('y2', d => d);
}

export function renderAnnotation(index, value, y, band, plotW, formatText) {
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

export function renderStatCards(cards) {
  els.stats.innerHTML = cards
    .map(c => `<div class="stat"><div class="k">${c.k}</div><div class="v">${c.v}</div><div class="s">${c.s}</div></div>`)
    .join('');
}
