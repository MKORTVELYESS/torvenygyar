import { getLang } from './i18n.js';

const trim = s => (s.includes('.') ? s.replace(/\.?0+$/, '') : s);

/** Picks mm, cm or m depending on magnitude. */
export function formatHeight(meters) {
  if (meters <= 0) return '0 cm';
  if (meters < 0.01) return `${trim((meters * 1000).toFixed(1))} mm`;
  if (meters < 1) return `${trim((meters * 100).toFixed(meters < 0.1 ? 1 : 0))} cm`;
  return `${trim(meters.toFixed(meters < 10 ? 2 : 1))} m`;
}

export function formatAxisTick(meters, unit) {
  return unit === 'cm' ? `${trim((meters * 100).toFixed(1))} cm` : `${trim(meters.toFixed(2))} m`;
}

export const formatInt = v => v.toLocaleString(getLang() === 'hu' ? 'hu-HU' : 'en-US');

/** Minutes since midnight (0–1440, Budapest time) as HH:MM. */
export function formatTime(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  const total = Math.round(minutes) % 1440;
  const hh = Math.floor(total / 60).toString().padStart(2, '0');
  const mm = (total % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

/** A span of minutes (e.g. a standard deviation) as "Xh Ym" / "Ym". */
export function formatDuration(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  const total = Math.round(minutes);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return hh > 0 ? `${hh}h ${mm}m` : `${mm}m`;
}

export function formatRatio(value, reference) {
  const r = value / reference;
  return r >= 1 ? `${trim(r.toFixed(r >= 10 ? 0 : 1))}×` : `${Math.round(r * 100)}%`;
}
