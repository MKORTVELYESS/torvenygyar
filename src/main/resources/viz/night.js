import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { GRANULARITIES, quantile } from './data.js';
import { NIGHT_TICKS, moodMeta } from './people.js';
import { t } from './i18n.js';
import { formatInt, formatTime } from './format.js';
import {
  COLUMN_GRANULARITIES,
  DAY_MINUTES,
  HEAVY_LAYER,
  MARGIN,
  NIGHT_AXIS_W,
  SKY_STOPS,
  isWebKit,
} from './constants.js';
import { els } from './dom.js';
import { bucketsFor, overallMeanMinutes, state, totals } from './state.js';
import {
  barWidthFor,
  beginLayer,
  plotWidthFor,
  renderAnnotation,
  renderGrid,
  renderReference,
  renderStatCards,
  renderXAxis,
} from './plot.js';

// Offscreen canvas for heavy night/daily columns (SVG gradient megapaths freeze Safari).
const heavySkyCanvas = document.createElement('canvas');

/** Draw sky columns to a bitmap and place it inside the SVG layer (correct z-order). */
function appendHeavySkyColumns(layer, nonEmpty, { band, barW, offset, ground, skyTop, plotW, height }) {
  const dpr = isWebKit ? 1 : Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.ceil(plotW * dpr));
  const h = Math.max(1, Math.ceil(height * dpr));
  if (heavySkyCanvas.width !== w) heavySkyCanvas.width = w;
  if (heavySkyCanvas.height !== h) heavySkyCanvas.height = h;

  const ctx = heavySkyCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, plotW, height);

  ctx.save();
  ctx.beginPath();
  for (const d of nonEmpty) {
    ctx.rect(d.i * band + offset, ground - d.h, barW, Math.max(0, d.h));
  }
  ctx.clip();
  const grad = ctx.createLinearGradient(0, ground, 0, skyTop);
  for (const [stop, color] of SKY_STOPS) grad.addColorStop(stop, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, skyTop, plotW, Math.max(0, ground - skyTop));
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (const d of nonEmpty) {
    ctx.fillRect(d.i * band + offset, ground - d.h, barW, 1.6);
  }

  layer.append('image')
    .attr('href', heavySkyCanvas.toDataURL('image/png'))
    .attr('x', 0)
    .attr('y', 0)
    .attr('width', plotW)
    .attr('height', height)
    .attr('pointer-events', 'none');
}

/** Office hours / night-shift view: release times across the day. */
export function renderNightView(animate) {
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
  renderGrid(y, plotW, NIGHT_TICKS.map(tick => tick.minutes));
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

  // Daily (~5k bars): bitmap with sky gradient. SVG `url(#sky)` on a megapath freezes Safari.
  if (nonEmpty.length > HEAVY_LAYER) {
    layer.classed('heavy', true);
    appendHeavySkyColumns(layer, nonEmpty, {
      band, barW, offset, ground,
      skyTop: y(DAY_MINUTES),
      plotW: +els.plot.getAttribute('width'),
      height: +els.plot.getAttribute('height'),
    });
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

  // Merge only — candles stay SVG (daily uses columns + canvas instead).
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
    // Solid fill: gradient megapaths freeze Safari (see appendHeavySkyColumns).
    layer.append('path').attr('class', 'box').attr('d', boxPath).attr('fill', '#8ecbff');
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
