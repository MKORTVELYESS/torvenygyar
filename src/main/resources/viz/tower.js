import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { GRANULARITIES } from './data.js';
import { pickObject } from './objects.js';
import { t } from './i18n.js';
import { formatAxisTick, formatHeight, formatInt, formatRatio } from './format.js';
import { HEADROOM, HEAVY_LAYER, MARGIN, NARROW_CHART_W, SHEET_M, Y_AXIS_W } from './constants.js';
import { els } from './dom.js';
import { bucketsFor, state, totals } from './state.js';
import {
  barWidthFor,
  beginLayer,
  fitTextToWidth,
  plotWidthFor,
  renderAnnotation,
  renderGrid,
  renderReference,
  renderStatCards,
  renderXAxis,
} from './plot.js';

/** Paper tower view: stacked gazette pages vs a familiar object. */
export function renderTowerView(animate) {
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
