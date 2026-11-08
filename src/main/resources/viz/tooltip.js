import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { quantile, stdDev } from './data.js';
import { t } from './i18n.js';
import { formatDuration, formatHeight, formatInt, formatRatio, formatTime } from './format.js';
import { MARGIN, SHEET_M } from './constants.js';
import { els } from './dom.js';
import { state } from './state.js';

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

export function showTooltip(event) {
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

export function hideTooltip() {
  els.tooltip.classList.remove('show');
  d3.select(els.plot).select('rect.hl').attr('opacity', 0);
}
