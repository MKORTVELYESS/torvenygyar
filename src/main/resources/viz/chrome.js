import { GRANULARITIES } from './data.js';
import { applyStaticTranslations, getLang, setLang, t } from './i18n.js';
import { renderDashboard } from './dashboard.js';
import { COLUMN_GRANULARITIES, LANGS, VIEW_GROUPS } from './constants.js';
import { els } from './dom.js';
import { rows, state } from './state.js';
import { renderNightView } from './night.js';
import { renderTowerView } from './tower.js';
import { hideTooltip } from './tooltip.js';
import { closeCandleModal } from './candle-modal.js';

/** Header + toolbar: view groups, granularity pills, language toggle, title copy. */

export function renderViewGroups() {
  els.groups.innerHTML = VIEW_GROUPS
    .map(id => `<button type="button" data-view="${id}" class="${id === state.viewId ? 'active' : ''}">${t(`view.${id}.label`)}</button>`)
    .join('');
  [...els.groups.children].forEach(button =>
    button.addEventListener('click', () => setView(button.dataset.view)));
}

export function applyViewCopy(id) {
  els.heading.textContent = t(`view.${id}.title`);
  els.lede.textContent = t(`view.${id}.lede`);
  document.title = `Magyar Közlöny · ${t(`view.${id}.label`)}`;
}

export function setView(id) {
  if (id === state.viewId) return;
  captureAnchor();
  state.viewId = id;
  applyViewCopy(id);
  [...els.groups.children].forEach(button => button.classList.toggle('active', button.dataset.view === id));
  hideTooltip();
  render({ animate: true });
}

export function renderPills() {
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

export function updatePills() {
  [...els.granularity.children].forEach((button, i) => {
    button.classList.toggle('active', i === state.gIndex);
    button.setAttribute('aria-selected', String(i === state.gIndex));
  });
}

export function setGranularity(index) {
  const next = Math.max(0, Math.min(GRANULARITIES.length - 1, index));
  if (next === state.gIndex) return;
  captureAnchor();
  state.gIndex = next;
  hideTooltip();
  render({ animate: true });
}

export function captureAnchor() {
  const s = els.scroll;
  if (s.scrollWidth > s.clientWidth + 1) {
    state.anchor = (s.scrollLeft + s.clientWidth / 2) / s.scrollWidth;
  }
}

export function render({ animate = false } = {}) {
  if (state.viewId === 'night') renderNightView(animate);
  else renderTowerView(animate);
  const candles = state.viewId === 'night' && !COLUMN_GRANULARITIES.has(GRANULARITIES[state.gIndex].id);
  els.candleHelpLink.hidden = !candles;
  if (!candles) closeCandleModal();
  updatePills();
}

export function renderLangToggle() {
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

/** Re-renders everything that carries translated text, after a language switch. */
export function applyLanguage() {
  applyStaticTranslations();
  renderViewGroups();
  applyViewCopy(state.viewId);
  renderPills();
  updatePills();
  renderLangToggle();
  render();
  renderDashboard(els.cars, els.dashAverage, rows);
}
