// "Full throttle" — a per-government car dashboard comparing legislative output.
// Speed = pages/day. RPM = issues/day. Both are normalized against whichever
// government's own pages/day sits closest to the all-time average, which is
// pinned to a realistic highway cruise: 130 km/h at a steady engine speed.
import { GOVERNMENTS, fmtDay } from './data.js';
import { t } from './i18n.js';

const SPEED_REFERENCE_KMH = 130; // the reference government's pin on the speedometer
const SPEED_MAX = 240;
const SPEED_MAJOR = 40;
const SPEED_MINOR = 20;
const SPEED_REDLINE = 200;

// A typical car cruising at a steady 130 km/h in top gear sits around 2,600 rpm —
// that's the realistic fixed point the whole tachometer is calibrated against.
const RPM_REFERENCE = 2600;
const RPM_MAX = 8000;
const RPM_MAJOR = 1000;
const RPM_MINOR = 500;
const RPM_REDLINE = 6500;

const START_ANGLE = -120; // degrees from 12 o'clock, clockwise
const SWEEP = 240;
const SVG_NS = 'http://www.w3.org/2000/svg';

function polar(cx, cy, r, deg) {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

function arcPath(cx, cy, r, a0, a1) {
  if (a1 <= a0) return '';
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function valueAngle(value, max) {
  return START_ANGLE + SWEEP * Math.max(0, Math.min(1, value / max));
}

function el(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, val] of Object.entries(attrs)) node.setAttribute(key, val);
  return node;
}

/** Per-government throughput: pages and issues per calendar day in office. */
function computeGovernmentStats(rows) {
  if (rows.length === 0) return [];
  const maxDay = rows.reduce((m, r) => Math.max(m, r.day), -Infinity);
  return GOVERNMENTS
    .map((g, index) => {
      const endDayExclusive = Number.isFinite(g.endDay) ? g.endDay : maxDay + 1;
      const days = Math.max(1, endDayExclusive - g.startDay);
      let pages = 0;
      let issues = 0;
      for (const r of rows) {
        if (r.day >= g.startDay && r.day < endDayExclusive) {
          pages += r.pages;
          issues += 1;
        }
      }
      return {
        index, pm: g.pm, cabinet: g.cabinet ?? null,
        startDay: g.startDay, endDay: g.end ? g.endDay : null,
        days, pages, issues,
        pagesPerDay: pages / days,
        issuesPerDay: issues / days,
      };
    })
    .filter(g => g.pages > 0);
}

function renderGauge({ value, max, major, minor, redline, tickLabel, digits, unit, className }) {
  const cx = 100;
  const cy = 96;
  const r = 72;
  const svg = el('svg', { viewBox: '0 -18 200 180', class: `gauge ${className}` });

  svg.append(el('path', { class: 'track', d: arcPath(cx, cy, r, START_ANGLE, START_ANGLE + SWEEP) }));
  const redZoneStart = valueAngle(redline, max);
  svg.append(el('path', { class: 'redzone', d: arcPath(cx, cy, r, redZoneStart, START_ANGLE + SWEEP) }));

  const steps = Math.round(max / minor);
  const majorEvery = Math.round(major / minor);
  for (let i = 0; i <= steps; i++) {
    const v = i * minor;
    const isMajor = i % majorEvery === 0;
    const a = valueAngle(v, max);
    const [x0, y0] = polar(cx, cy, r + 2, a);
    const [x1, y1] = polar(cx, cy, r + (isMajor ? 12 : 6), a);
    svg.append(el('line', {
      class: isMajor ? 'tick major' : 'tick', x1: x0.toFixed(2), y1: y0.toFixed(2),
      x2: x1.toFixed(2), y2: y1.toFixed(2),
    }));
    if (isMajor) {
      const [lx, ly] = polar(cx, cy, r + 24, a);
      const label = el('text', {
        class: 'tick-label', x: lx.toFixed(2), y: ly.toFixed(2),
        'text-anchor': 'middle', 'dominant-baseline': 'central',
      });
      label.textContent = tickLabel(v);
      svg.append(label);
    }
  }

  const angle = valueAngle(value, max);
  const tip = polar(cx, cy, r * 0.82, angle);
  const left = polar(cx, cy, 5, angle - 90);
  const right = polar(cx, cy, 5, angle + 90);
  const tail = polar(cx, cy, 14, angle + 180);
  svg.append(el('polygon', {
    class: 'needle' + (value > redline ? ' hot' : ''),
    points: `${tip.map(n => n.toFixed(2)).join(',')} ${right.map(n => n.toFixed(2)).join(',')} `
      + `${tail.map(n => n.toFixed(2)).join(',')} ${left.map(n => n.toFixed(2)).join(',')}`,
  }));
  svg.append(el('circle', { class: 'hub', cx, cy, r: 8 }));

  const readout = el('text', { class: 'readout', x: cx, y: cy + 38, 'text-anchor': 'middle' });
  readout.textContent = digits(value);
  svg.append(readout);
  const unitLabel = el('text', { class: 'unit', x: cx, y: cy + 54, 'text-anchor': 'middle' });
  unitLabel.textContent = unit;
  svg.append(unitLabel);

  return svg;
}

function renderCar(g, isReference) {
  const card = document.createElement('div');
  card.className = 'car' + (isReference ? ' reference' : '');
  const period = `${fmtDay(g.startDay)} – ${g.endDay ? fmtDay(g.endDay - 1) : 'present'}`;
  card.innerHTML = `
    <div class="car-plate">
      <div class="car-who">
        <div class="car-pm">${g.pm}${g.cabinet ? ` <span class="cab">${g.cabinet}</span>` : ''}</div>
        <div class="car-period">${period}</div>
      </div>
      ${isReference ? `<div class="car-badge">${t('dash.reference', { speed: SPEED_REFERENCE_KMH })}</div>` : ''}
    </div>
    <div class="gauges"></div>
    <div class="car-readout">
      <div><span>${t('dash.pagesPerDay')}</span><b>${g.pagesPerDay.toFixed(1)}</b></div>
      <div><span>${t('dash.issuesPerDay')}</span><b>${g.issuesPerDay.toFixed(2)}</b></div>
    </div>`;

  const gauges = card.querySelector('.gauges');
  gauges.append(renderGauge({
    value: g.speed, max: SPEED_MAX, major: SPEED_MAJOR, minor: SPEED_MINOR, redline: SPEED_REDLINE,
    tickLabel: v => `${v}`, digits: v => `${Math.round(v)}`, unit: 'km/h', className: 'speed',
  }));
  gauges.append(renderGauge({
    value: g.rpm, max: RPM_MAX, major: RPM_MAJOR, minor: RPM_MINOR, redline: RPM_REDLINE,
    tickLabel: v => `${v / 1000}`, digits: v => `${Math.round(v / 100) * 100}`, unit: 'rpm', className: 'rpm',
  }));
  return card;
}

export function renderDashboard(container, averageEl, rows) {
  const stats = computeGovernmentStats(rows);
  container.innerHTML = '';
  if (averageEl) averageEl.innerHTML = '';
  if (stats.length === 0) return;

  const totalPages = stats.reduce((s, g) => s + g.pages, 0);
  const totalIssues = stats.reduce((s, g) => s + g.issues, 0);
  const totalDays = stats.reduce((s, g) => s + g.days, 0);
  const globalVelocity = totalPages / totalDays;
  const globalIssueVelocity = totalIssues / totalDays;
  const reference = stats.reduce((best, g) => (
    Math.abs(g.pagesPerDay - globalVelocity) < Math.abs(best.pagesPerDay - globalVelocity) ? g : best
  ), stats[0]);

  if (averageEl) {
    averageEl.innerHTML = `
      <div class="dash-stat"><span>${t('dash.allTimeAverage')}</span><b>${globalVelocity.toFixed(1)}</b> ${t('dash.pagesPerDay')}</div>
      <div class="dash-stat"><span>${t('dash.allTimeAverage')}</span><b>${globalIssueVelocity.toFixed(2)}</b> ${t('dash.issuesPerDay')}</div>`;
  }

  stats
    .map(g => ({
      ...g,
      speed: SPEED_REFERENCE_KMH * (g.pagesPerDay / reference.pagesPerDay),
      rpm: RPM_REFERENCE * (g.issuesPerDay / reference.issuesPerDay),
    }))
    .forEach(g => container.append(renderCar(g, g.index === reference.index)));
}
