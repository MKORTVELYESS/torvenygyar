// Government-clerk mascot, drawn in four moods across the 24-hour cycle.
// Each viewBox is 46 × 100 (aspect 0.46), matching the scale of objects.js art.

const SLEEP = `
  <rect x="13" y="50" width="9.5" height="47" rx="3" fill="#3c4566"/>
  <rect x="23.5" y="50" width="9.5" height="47" rx="3" fill="#3c4566"/>
  <rect x="11" y="95.5" width="12" height="4.5" rx="2" fill="#2b2f44"/>
  <rect x="23" y="95.5" width="12" height="4.5" rx="2" fill="#2b2f44"/>
  <rect x="4" y="19" width="6.5" height="31" rx="3.2" fill="#454f78"/>
  <rect x="35.5" y="19" width="6.5" height="31" rx="3.2" fill="#454f78"/>
  <circle cx="7.2" cy="51" r="3.2" fill="#f1c27d"/>
  <circle cx="38.8" cy="51" r="3.2" fill="#f1c27d"/>
  <path d="M10 20 Q10 16 14.5 16 H31.5 Q36 16 36 20 L35 55 H11 Z" fill="#4e5a86"/>
  <circle cx="19" cy="34" r="2.4" fill="#fff" opacity=".18"/>
  <circle cx="28" cy="44" r="1.8" fill="#fff" opacity=".18"/>
  <g transform="rotate(-9 23 10)">
    <rect x="20" y="13" width="6" height="5" fill="#e0ad6a"/>
    <circle cx="23" cy="9" r="7" fill="#f1c27d"/>
    <path d="M13.5 8 Q13 -4 23 -3 Q33 -4 32.5 8 Q31 2.5 23 3.4 Q15 2.5 13.5 8 Z" fill="#5a5f8c"/>
    <circle cx="32" cy="-3" r="2.4" fill="#f4f1ff"/>
    <path d="M19.4 8.6 q1.4 1.2 2.8 0" stroke="#5b3e2c" stroke-width="1" fill="none" stroke-linecap="round"/>
    <path d="M24 8.6 q1.4 1.2 2.8 0" stroke="#5b3e2c" stroke-width="1" fill="none" stroke-linecap="round"/>
    <path d="M20.8 12.3 q2.2 1 4.4 0" stroke="#8a5a3c" stroke-width="1" fill="none" stroke-linecap="round"/>
  </g>
  <text x="31" y="1" font-size="6.5" font-weight="700" fill="#ffd77a">z</text>
  <text x="35.5" y="-4.5" font-size="5" font-weight="700" fill="#ffd77a" opacity=".75">z</text>
  <text x="28.5" y="-8" font-size="4" font-weight="700" fill="#ffd77a" opacity=".55">z</text>`;

const DAWN = `
  <rect x="13" y="50" width="9.5" height="47" rx="3" fill="#8a94ad"/>
  <rect x="23.5" y="50" width="9.5" height="47" rx="3" fill="#8a94ad"/>
  <rect x="11" y="95.5" width="12" height="4.5" rx="2" fill="#3c4256"/>
  <rect x="23" y="95.5" width="12" height="4.5" rx="2" fill="#3c4256"/>
  <rect x="4" y="18" width="6.5" height="30" rx="3.2" fill="#d8d2c4"/>
  <rect x="35.5" y="18" width="6.5" height="30" rx="3.2" fill="#d8d2c4"/>
  <circle cx="7.2" cy="49" r="3.2" fill="#f1c27d"/>
  <path d="M10 19 Q10 15 14.5 15 H31.5 Q36 15 36 19 L35 55 H11 Z" fill="#e7e1d1"/>
  <path d="M11 30 L35 27" stroke="#c9c1ac" stroke-width="1.4"/>
  <g transform="translate(34,44)">
    <path d="M0 4 h8 v6 a4 4 0 0 1 -8 0 Z" fill="#fff" stroke="#c9c1ac" stroke-width="1"/>
    <path d="M8 6 q4 0 4 3 q0 3 -4 3" fill="none" stroke="#c9c1ac" stroke-width="1.3"/>
    <path d="M1.5 -1 q1 -3 3 0" stroke="#d8ccb0" stroke-width="1" fill="none" stroke-linecap="round" opacity=".8"/>
    <path d="M4.5 -2 q1 -3 3 0" stroke="#d8ccb0" stroke-width="1" fill="none" stroke-linecap="round" opacity=".6"/>
  </g>
  <circle cx="38.8" cy="51" r="3.2" fill="#f1c27d"/>
  <rect x="20" y="12" width="6" height="5" fill="#e0ad6a"/>
  <circle cx="23" cy="8" r="7" fill="#f1c27d"/>
  <path d="M14 6 Q13 -2 18 1 Q21 -3 23 1 Q26 -4 29 0 Q33 -2 32 6 Q28 2 23 3 Q17 2 14 6 Z" fill="#6b4a33"/>
  <rect x="18.5" y="7.2" width="4" height="1.6" rx=".8" fill="#5b3e2c" opacity=".85"/>
  <rect x="24" y="7.2" width="4" height="1.6" rx=".8" fill="#5b3e2c" opacity=".85"/>
  <ellipse cx="23" cy="12" rx="2.2" ry="1.6" fill="#8a5a3c"/>`;

const DAY = `
  <rect x="13" y="50" width="9.5" height="47" rx="3" fill="#2d3c56"/>
  <rect x="23.5" y="50" width="9.5" height="47" rx="3" fill="#2d3c56"/>
  <rect x="11" y="95.5" width="12" height="4.5" rx="2" fill="#1c1f2b"/>
  <rect x="23" y="95.5" width="12" height="4.5" rx="2" fill="#1c1f2b"/>
  <rect x="4" y="17" width="6.5" height="33" rx="3.2" fill="#1f3b63"/>
  <rect x="35.5" y="17" width="6.5" height="33" rx="3.2" fill="#1f3b63"/>
  <circle cx="7.2" cy="52" r="3.2" fill="#f1c27d"/>
  <g transform="translate(33,43)">
    <rect x="0" y="0" width="9" height="7" rx="1" fill="#b5292f"/>
    <rect x="2.5" y="-2.4" width="4" height="2.6" rx=".6" fill="#8a1f24"/>
  </g>
  <path d="M10 19 Q10 15 14.5 15 H31.5 Q36 15 36 19 L35 55 H11 Z" fill="#20314f"/>
  <path d="M20 16 L23 15 L26 16 L24 32 L22 32 Z" fill="#c23b3b"/>
  <circle cx="23" cy="24" r="2.2" fill="#f4c94a" stroke="#caa02c" stroke-width=".6"/>
  <path d="M15 16 L20 16 L19 20 Z" fill="#fff"/>
  <path d="M31 16 L26 16 L27 20 Z" fill="#fff"/>
  <circle cx="38.8" cy="52" r="3.2" fill="#f1c27d"/>
  <rect x="20" y="12" width="6" height="5" fill="#e0ad6a"/>
  <circle cx="23" cy="8" r="7" fill="#f1c27d"/>
  <path d="M15 6.5 Q15 -1.5 23 -1 Q31 -1.5 31 6.5 Q27 2.5 23 3 Q19 2.5 15 6.5 Z" fill="#3a2a1d"/>
  <circle cx="19.5" cy="7.5" r="1.1" fill="#2b1d12"/>
  <circle cx="26.5" cy="7.5" r="1.1" fill="#2b1d12"/>
  <path d="M19 11.5 Q23 14.2 27 11.5" stroke="#8a5a3c" stroke-width="1.1" fill="none" stroke-linecap="round"/>
  <circle cx="17.5" cy="10" r="1.3" fill="#f0a582" opacity=".55"/>
  <circle cx="28.5" cy="10" r="1.3" fill="#f0a582" opacity=".55"/>
  <g stroke="#ffd877" stroke-width="1.1" stroke-linecap="round" opacity=".85">
    <path d="M23 -5 v-3"/>
    <path d="M14 -1 l-2.2 -2"/>
    <path d="M32 -1 l2.2 -2"/>
  </g>`;

const DUSK = `
  <rect x="13" y="50" width="9.5" height="47" rx="3" fill="#4a5572"/>
  <rect x="23.5" y="50" width="9.5" height="47" rx="3" fill="#4a5572"/>
  <rect x="11" y="95.5" width="12" height="4.5" rx="2" fill="#262a3a"/>
  <rect x="23" y="95.5" width="12" height="4.5" rx="2" fill="#262a3a"/>
  <rect x="4" y="25" width="6.5" height="23" rx="3" fill="#e7e1d1"/>
  <rect x="35.5" y="25" width="6.5" height="23" rx="3" fill="#e7e1d1"/>
  <rect x="3" y="22" width="8.5" height="4" rx="2" fill="#cfc6ac"/>
  <rect x="34.5" y="22" width="8.5" height="4" rx="2" fill="#cfc6ac"/>
  <circle cx="7.2" cy="49" r="3.2" fill="#f1c27d"/>
  <circle cx="38.8" cy="49" r="3.2" fill="#f1c27d"/>
  <path d="M10 19 Q10 15 14.5 15 H31.5 Q36 15 36 19 L35 55 H11 Z" fill="#efe9da"/>
  <path d="M19.5 16 L22 25 L18 36 L20.5 38 L24.5 24 Z" fill="#8a3b3b" transform="rotate(8 21 25)"/>
  <path d="M15 16 L20 16 L19 20 Z" fill="#fff"/>
  <path d="M31 16 L26 16 L27 20 Z" fill="#fff"/>
  <rect x="20" y="12" width="6" height="5" fill="#e0ad6a"/>
  <circle cx="23" cy="8" r="7" fill="#f1c27d"/>
  <path d="M15 6.5 Q15 -1 23 -0.6 Q31 -1 31 6.5 Q28 3 23 3.2 Q18 3 15 6.5 Z" fill="#4a3526"/>
  <path d="M27.5 1 l2 -2.4" stroke="#4a3526" stroke-width="1.4" stroke-linecap="round"/>
  <rect x="19" y="7" width="3.6" height="1.4" rx=".7" fill="#5b3e2c" opacity=".7"/>
  <rect x="23.4" y="7" width="3.6" height="1.4" rx=".7" fill="#5b3e2c" opacity=".7"/>
  <path d="M20 12 q3 0.6 6 0" stroke="#8a5a3c" stroke-width="1" fill="none" stroke-linecap="round"/>
  <path d="M30.5 5 q1.2 2 0 4" stroke="#bcd8ff" stroke-width="1" fill="none" stroke-linecap="round" opacity=".8"/>`;

export const CLERK_ASPECT = 0.46;
export const CLERK_ART = { sleep: SLEEP, dawn: DAWN, day: DAY, dusk: DUSK };

/** Fixed y-axis reference points for the Night shift view, bottom (00:00) to top (24:00). */
export const NIGHT_TICKS = [
  { minutes: 0, mood: 'sleep', label: '00:00' },
  { minutes: 360, mood: 'dawn', label: '06:00' },
  { minutes: 720, mood: 'day', label: '12:00' },
  { minutes: 1080, mood: 'dusk', label: '18:00' },
  { minutes: 1440, mood: 'sleep', label: '24:00' },
];

/** Narrative label for an arbitrary minute-of-day value, used in the stat cards. */
export function moodMeta(minutes) {
  if (minutes == null) return { mood: 'day', label: 'Unknown' };
  const h = (minutes / 60) % 24;
  if (h < 5) return { mood: 'sleep', label: 'Burning midnight oil' };
  if (h < 8) return { mood: 'dawn', label: 'Early riser' };
  if (h < 18) return { mood: 'day', label: 'Office hours' };
  if (h < 22) return { mood: 'dusk', label: 'Overtime clerk' };
  return { mood: 'sleep', label: 'Night-shift nap' };
}
