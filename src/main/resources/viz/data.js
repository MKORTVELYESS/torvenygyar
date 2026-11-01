import { t } from './i18n.js';

const DAY_MS = 86_400_000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

// Cabinet periods. `end` is exclusive: the first day of the next government,
// so it is the day after the outgoing prime minister's last day. `null` means still in office.
export const GOVERNMENTS = [
  { pm: 'Horn Gyula', start: '1994-07-15', end: '1998-07-06' },
  { pm: 'Orbán Viktor', cabinet: 'I', start: '1998-07-06', end: '2002-05-27' },
  { pm: 'Medgyessy Péter', start: '2002-05-27', end: '2004-09-29' },
  { pm: 'Gyurcsány Ferenc', cabinet: 'I', start: '2004-09-29', end: '2006-06-09' },
  { pm: 'Gyurcsány Ferenc', cabinet: 'II', start: '2006-06-09', end: '2009-04-14' },
  { pm: 'Bajnai Gordon', start: '2009-04-14', end: '2010-05-29' },
  { pm: 'Orbán Viktor', cabinet: 'II', start: '2010-05-29', end: '2014-06-06' },
  { pm: 'Orbán Viktor', cabinet: 'III', start: '2014-06-06', end: '2018-05-18' },
  { pm: 'Orbán Viktor', cabinet: 'IV', start: '2018-05-18', end: '2022-05-24' },
  { pm: 'Orbán Viktor', cabinet: 'V', start: '2022-05-24', end: '2026-05-13' },
  { pm: 'Magyar Péter', start: '2026-05-13', end: null },
].map(g => ({ ...g, startDay: isoDay(g.start), endDay: g.end ? isoDay(g.end) : Infinity }));

const budapestDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit',
});

const budapestTime = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Budapest', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function minutesOfDay(date) {
  const parts = budapestTime.formatToParts(date);
  const hh = Number(parts.find(p => p.type === 'hour').value);
  const mm = Number(parts.find(p => p.type === 'minute').value);
  return hh * 60 + mm;
}

function isoDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return dayOf(y, m, d);
}

function dayOf(y, m, d) {
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS);
}

function ymdOf(day) {
  const date = new Date(day * DAY_MS);
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate(), dow: date.getUTCDay() };
}

export const fmtDay = day => {
  const { y, m, d } = ymdOf(day);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

export function parseRows(text) {
  const rows = [];
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const [url, dateTime, pageCount] = lines[i].split(',');
    const pages = Number(pageCount);
    if (!dateTime || !Number.isFinite(pages) || pages <= 0) continue;
    const date = new Date(dateTime);
    const [y, m, d] = budapestDate.format(date).split('-').map(Number);
    rows.push({ url, pages, y, m, d, day: dayOf(y, m, d), minutes: minutesOfDay(date) });
  }
  return rows;
}

/**
 * Sums pages per bucket, fills gaps so the timeline is continuous, and tracks
 * each bucket's sorted release times (minutes since midnight) for the Night shift view.
 */
export function aggregate(rows, granularity) {
  const sums = new Map();
  for (const row of rows) {
    const key = granularity.key(row);
    if (key == null) continue;
    const bucket = sums.get(key) ?? { pages: 0, issues: 0, minutes: [] };
    bucket.pages += row.pages;
    bucket.issues += 1;
    bucket.minutes.push(row.minutes);
    sums.set(key, bucket);
  }
  if (sums.size === 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const key of sums.keys()) {
    if (key < min) min = key;
    if (key > max) max = key;
  }
  const buckets = [];
  for (let key = min; key <= max; key++) {
    const bucket = sums.get(key);
    const minutes = bucket?.minutes ?? [];
    minutes.sort((a, b) => a - b);
    const meanMinutes = minutes.length
      ? minutes.reduce((sum, v) => sum + v, 0) / minutes.length
      : null;
    buckets.push({
      key,
      pages: bucket?.pages ?? 0,
      issues: bucket?.issues ?? 0,
      minutes,
      meanMinutes,
    });
  }
  return buckets;
}

/** Linear-interpolated percentile (q in [0,1]) over an already-sorted array. */
export function quantile(sorted, q) {
  if (!sorted || sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

/** Population standard deviation of `values` around `mean` (or computed from them if omitted). */
export function stdDev(values, mean) {
  if (!values || values.length === 0) return null;
  const m = mean ?? values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

const weekMonday = k => k * 7 + 4; // day 4 since epoch is Monday 1970-01-05

function isoWeek(monday) {
  const thursday = monday + 3;
  const { y } = ymdOf(thursday);
  return { year: y, week: Math.floor((thursday - dayOf(y, 1, 1)) / 7) + 1 };
}

/** The first day of a month falling inside the week, if any. */
function monthStartInWeek(k) {
  const first = ymdOf(weekMonday(k));
  const last = ymdOf(weekMonday(k) + 6);
  if (first.d === 1) return first;
  if (last.d < first.d) return last;
  return null;
}

function governmentIndex(day) {
  for (let i = 0; i < GOVERNMENTS.length; i++) {
    if (day >= GOVERNMENTS[i].startDay && day < GOVERNMENTS[i].endDay) return i;
  }
  return null;
}

/**
 * Ordered from finest to coarsest. `level` ranks a bucket for axis labelling
 * (higher = more significant boundary); `minBand` is the minimum px per bucket.
 */
export const GRANULARITIES = [
  {
    id: 'daily', label: 'Daily', unit: 'day', minBand: 3, maxLevel: 3,
    key: r => r.day,
    title: k => fmtDay(k),
    level: k => {
      const { m, d, dow } = ymdOf(k);
      return m === 1 && d === 1 ? 3 : d === 1 ? 2 : dow === 1 ? 1 : 0;
    },
    tick: (k, level) => {
      const { y, m, d } = ymdOf(k);
      if (level >= 2) return m === 1 && d === 1 ? `${y}` : `${MONTHS[m - 1]} ’${String(y).slice(-2)}`;
      return `${d} ${MONTHS[m - 1]}`;
    },
  },
  {
    id: 'weekly', label: 'Weekly', unit: 'week', minBand: 6, maxLevel: 3,
    key: r => Math.floor((r.day - 4) / 7),
    title: k => {
      const { year, week } = isoWeek(weekMonday(k));
      return `Week ${week}, ${year}`;
    },
    sub: k => `${fmtDay(weekMonday(k))} – ${fmtDay(weekMonday(k) + 6)}`,
    level: k => {
      const start = monthStartInWeek(k);
      if (!start) return 0;
      return start.m === 1 ? 3 : (start.m - 1) % 3 === 0 ? 2 : 1;
    },
    tick: k => {
      const start = monthStartInWeek(k);
      if (start) return start.m === 1 ? `${start.y}` : MONTHS[start.m - 1];
      return `W${isoWeek(weekMonday(k)).week}`;
    },
  },
  {
    id: 'monthly', label: 'Monthly', unit: 'month', minBand: 16, maxLevel: 2, tickPx: 44,
    key: r => r.y * 12 + r.m - 1,
    title: k => `${MONTHS_LONG[k % 12]} ${Math.floor(k / 12)}`,
    level: k => (k % 12 === 0 ? 2 : k % 3 === 0 ? 1 : 0),
    tick: k => (k % 12 === 0 ? `${Math.floor(k / 12)}` : MONTHS[k % 12]),
  },
  {
    id: 'quarterly', label: 'Quarterly', unit: 'quarter', minBand: 14, maxLevel: 2,
    key: r => r.y * 4 + Math.floor((r.m - 1) / 3),
    title: k => `Q${(k % 4) + 1} ${Math.floor(k / 4)}`,
    sub: k => `${MONTHS[(k % 4) * 3]} – ${MONTHS[(k % 4) * 3 + 2]} ${Math.floor(k / 4)}`,
    level: k => (k % 4 !== 0 ? 0 : Math.floor(k / 4) % 5 === 0 ? 2 : 1),
    tick: k => (k % 4 === 0 ? `${Math.floor(k / 4)}` : `Q${(k % 4) + 1}`),
  },
  {
    id: 'half', label: 'Half-yearly', unit: 'half-year', minBand: 18, maxLevel: 2, tickPx: 34,
    key: r => r.y * 2 + (r.m > 6 ? 1 : 0),
    title: k => `H${(k % 2) + 1} ${Math.floor(k / 2)}`,
    sub: k => (k % 2 ? `Jul – Dec ${Math.floor(k / 2)}` : `Jan – Jun ${Math.floor(k / 2)}`),
    level: k => (k % 2 ? 0 : Math.floor(k / 2) % 5 === 0 ? 2 : 1),
    tick: k => (k % 2 ? 'H2' : `${Math.floor(k / 2)}`),
  },
  {
    id: 'yearly', label: 'Yearly', unit: 'year', minBand: 36, maxLevel: 2, tickPx: 34,
    key: r => r.y,
    title: k => `${k}`,
    level: k => (k % 10 === 0 ? 2 : k % 5 === 0 ? 1 : 0),
    tick: k => `${k}`,
  },
  {
    id: 'government', label: 'Governments', unit: 'government', minBand: 128, maxLevel: 0, tickPx: 0,
    key: r => governmentIndex(r.day),
    title: k => {
      const g = GOVERNMENTS[k];
      return g.cabinet ? `${g.pm} (${g.cabinet})` : g.pm;
    },
    sub: k => {
      const g = GOVERNMENTS[k];
      return `${fmtDay(g.startDay)} – ${g.end ? fmtDay(g.endDay - 1) : 'present'}`;
    },
    level: () => 0,
    tick: (k, _level, opts) => {
      const g = GOVERNMENTS[k];
      const lastYear = g.end ? ymdOf(g.endDay - 1).y : '';
      if (opts?.short) {
        const surname = g.pm.split(' ')[0];
        const name = g.cabinet ? `${surname} ${g.cabinet}` : surname;
        const shortYears = `’${g.start.slice(2, 4)}–${lastYear ? `’${String(lastYear).slice(-2)}` : ''}`;
        return [name, shortYears];
      }
      const years = `${g.start.slice(0, 4)}–${lastYear}`;
      return [g.pm, g.cabinet ? `${g.cabinet} · ${years}` : years];
    },
  },
  {
    // The entire archive collapsed into a single bucket — every page and every
    // release time ever recorded, side by side as one column.
    id: 'alltime', label: 'All time', unit: 'all-time', minBand: 240, maxLevel: 0, tickPx: 0,
    key: () => 0,
    title: () => t('granularity.alltime'),
    sub: () => t('allTimeArchive'),
    level: () => 0,
    tick: () => t('granularity.alltime'),
  },
];
