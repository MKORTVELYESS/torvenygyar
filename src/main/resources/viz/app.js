import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { parseRows } from './data.js';
import { renderDashboard } from './dashboard.js';
import { applyStaticTranslations, initI18n, t } from './i18n.js';
import { els } from './dom.js';
import {
  rows,
  setOverallMeanMinutes,
  setRows,
  setTotals,
  state,
} from './state.js';
import { setupPlot } from './plot.js';
import {
  applyViewCopy,
  render,
  renderLangToggle,
  renderPills,
  renderViewGroups,
} from './chrome.js';
import { bindEvents } from './interactions.js';

init();

async function init() {
  await initI18n();
  try {
    const response = await fetch('results.csv', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    setRows(parseRows(await response.text()));
  } catch (error) {
    els.chart.innerHTML = `<div class="empty">${t('error.loadFailed', { message: error.message })}</div>`;
    return;
  }
  if (rows.length === 0) {
    els.chart.innerHTML = `<div class="empty">${t('error.noData')}</div>`;
    return;
  }
  setTotals({ pages: d3.sum(rows, r => r.pages), issues: rows.length });
  setOverallMeanMinutes(d3.mean(rows, r => r.minutes));
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
