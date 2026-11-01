// Every drawing uses a viewBox of width (aspect * 100) and height 100, ground at y = 100.

const pts = list => list.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

function cubeFace(origin, u, v, colors, shade) {
  const at = (s, t) => [origin[0] + u[0] * s + v[0] * t, origin[1] + u[1] * s + v[1] * t];
  const gap = 0.07;
  let out = '';
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const a = (i + gap) / 3, b = (i + 1 - gap) / 3, c = (j + gap) / 3, d = (j + 1 - gap) / 3;
      const fill = colors[i * 3 + j];
      out += `<polygon points="${pts([at(a, c), at(b, c), at(b, d), at(a, d)])}" fill="${fill}"
        stroke="${fill}" stroke-width="1.4" stroke-linejoin="round"/>`;
    }
  }
  if (shade) {
    out += `<polygon points="${pts([at(0, 0), at(1, 0), at(1, 1), at(0, 1)])}" fill="#000" opacity="${shade}"/>`;
  }
  return out;
}

function rubik() {
  const T = [43.3, 0], R = [86.6, 25], C = [43.3, 50], L = [0, 25], B = [43.3, 100], RB = [86.6, 75], LB = [0, 75];
  const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
  const w = '#f4f4f0', y = '#ffd500', g = '#009b48', o = '#ff5800', r = '#c41e3a', b = '#0046ad';
  return `
    <polygon points="${pts([T, R, RB, B, LB, L])}" fill="#16171d" stroke="#16171d" stroke-width="3" stroke-linejoin="round"/>
    ${cubeFace(L, sub(T, L), sub(C, L), [w, w, y, w, w, g, o, w, w], 0)}
    ${cubeFace(L, sub(C, L), sub(LB, L), [r, r, b, r, y, r, r, r, g], 0.08)}
    ${cubeFace(C, sub(R, C), sub(B, C), [b, w, b, b, b, r, o, b, b], 0.2)}`;
}

const mug = () => `
  <path d="M80 30 C 104 28, 104 80, 76 77" fill="none" stroke="#d65a46" stroke-width="10" stroke-linecap="round"/>
  <path d="M8 7 H82 V86 Q82 100 68 100 H22 Q8 100 8 86 Z" fill="#ef6c57"/>
  <rect x="8" y="42" width="74" height="9" fill="#fff" opacity=".85"/>
  <path d="M17 18 V84" stroke="#fff" stroke-opacity=".3" stroke-width="4" stroke-linecap="round"/>
  <ellipse cx="45" cy="7" rx="37" ry="7" fill="#d65a46"/>
  <ellipse cx="45" cy="7.6" rx="32" ry="4.6" fill="#5b3424"/>`;

const phone = () => `
  <defs>
    <linearGradient id="phone-screen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1"/><stop offset=".55" stop-color="#a855f7"/><stop offset="1" stop-color="#ec4899"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="49" height="100" rx="7" fill="#1f2430" stroke="#3a4257" stroke-width=".8"/>
  <rect x="2.2" y="2.2" width="44.6" height="95.6" rx="5.2" fill="url(#phone-screen)"/>
  <rect x="18" y="4.6" width="13" height="3.6" rx="1.8" fill="#0b0d12"/>
  <text x="24.5" y="24" text-anchor="middle" font-size="9" font-weight="600" fill="#fff">13:37</text>
  ${[0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c =>
    `<rect x="${6 + c * 10}" y="${38 + r * 11}" width="7" height="7" rx="2" fill="#fff" opacity=".28"/>`).join('')).join('')}
  <rect x="16" y="93.4" width="17" height="1.4" rx=".7" fill="#fff" opacity=".75"/>`;

const wineBottle = () => `
  <path d="M10.5 0 H17.5 V27 C17.5 37 26 38 26 50 V95 Q26 100 21 100 H7 Q2 100 2 95 V50 C2 38 10.5 37 10.5 27 Z" fill="#24402f"/>
  <rect x="10" y="0" width="8" height="14" rx="1" fill="#7b1e3a"/>
  <rect x="2" y="58" width="24" height="24" fill="#f4ecd8"/>
  <rect x="6" y="64" width="16" height="2.2" fill="#7b1e3a"/>
  <rect x="8" y="69.5" width="12" height="1.2" fill="#9a8f7a"/>
  <rect x="9" y="73" width="10" height="1.2" fill="#9a8f7a"/>
  <path d="M6 50 V92" stroke="#fff" stroke-opacity=".2" stroke-width="2" stroke-linecap="round"/>`;

const hydrant = () => `
  <rect x="6" y="92" width="58" height="8" rx="2" fill="#8f2a22"/>
  <rect x="3" y="45" width="14" height="13" rx="3" fill="#b8352a"/>
  <rect x="53" y="45" width="14" height="13" rx="3" fill="#b8352a"/>
  <rect x="15" y="32" width="40" height="62" rx="3" fill="#d94436"/>
  <rect x="11" y="84" width="48" height="6" rx="2" fill="#b8352a"/>
  <path d="M15 30 Q15 9 35 8 Q55 9 55 30 Z" fill="#d94436"/>
  <rect x="11" y="27" width="48" height="7" rx="2" fill="#b8352a"/>
  <rect x="30" y="0" width="10" height="9" rx="2" fill="#b8352a"/>
  <circle cx="35" cy="60" r="10" fill="#b8352a"/>
  <circle cx="35" cy="60" r="4.5" fill="#8f2a22"/>
  <path d="M21 38 V80" stroke="#fff" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/>`;

const chair = () => `
  <rect x="7" y="0" width="5" height="100" rx="2" fill="#8d5a35"/>
  <rect x="38" y="0" width="5" height="100" rx="2" fill="#8d5a35"/>
  <rect x="5" y="1" width="40" height="9" rx="3" fill="#a86b3c"/>
  <rect x="16" y="10" width="3.5" height="37" fill="#a86b3c"/>
  <rect x="23.25" y="10" width="3.5" height="37" fill="#a86b3c"/>
  <rect x="30.5" y="10" width="3.5" height="37" fill="#a86b3c"/>
  <rect x="9" y="79" width="32" height="3" fill="#7a4c2c"/>
  <rect x="1" y="54" width="6" height="46" rx="2" fill="#b77945"/>
  <rect x="43" y="54" width="6" height="46" rx="2" fill="#b77945"/>
  <rect x="0" y="46" width="50" height="9" rx="2.5" fill="#c98b55"/>
  <rect x="0" y="46" width="50" height="2.2" rx="1.1" fill="#e8d5b7" opacity=".6"/>`;

const person = () => `
  <rect x="13" y="50" width="9.5" height="47" rx="3" fill="#3d4f6e"/>
  <rect x="23.5" y="50" width="9.5" height="47" rx="3" fill="#3d4f6e"/>
  <rect x="11" y="95.5" width="12" height="4.5" rx="2" fill="#e5e7eb"/>
  <rect x="23" y="95.5" width="12" height="4.5" rx="2" fill="#e5e7eb"/>
  <rect x="4" y="17" width="6.5" height="33" rx="3.2" fill="#4f7cac"/>
  <rect x="35.5" y="17" width="6.5" height="33" rx="3.2" fill="#4f7cac"/>
  <circle cx="7.2" cy="52" r="3.2" fill="#f1c27d"/>
  <circle cx="38.8" cy="52" r="3.2" fill="#f1c27d"/>
  <path d="M10 19 Q10 15 14.5 15 H31.5 Q36 15 36 19 L35 55 H11 Z" fill="#5b8cc2"/>
  <rect x="20" y="12" width="6" height="5" fill="#e0ad6a"/>
  <circle cx="23" cy="8" r="7" fill="#f1c27d"/>
  <path d="M16 8.5 Q16 0 23 0 Q30 0 30 8.5 Q27 4.2 23 4.6 Q19 4.2 16 8.5 Z" fill="#3b2a20"/>`;

const bus = () => `
  <rect x="6" y="90" width="9" height="10" rx="2" fill="#1c1f26"/>
  <rect x="43" y="90" width="9" height="10" rx="2" fill="#1c1f26"/>
  <rect x="1" y="0" width="56" height="94" rx="5" fill="#c8102e"/>
  <rect x="9" y="3" width="40" height="6.5" rx="1.5" fill="#15171c"/>
  <rect x="13" y="5.3" width="22" height="2" rx="1" fill="#fbbf24"/>
  <rect x="38" y="5.3" width="7" height="2" rx="1" fill="#fbbf24"/>
  <rect x="5" y="12" width="48" height="26" rx="3" fill="#a9cbe3"/>
  <path d="M8 34 L22 14 H30 L16 34 Z" fill="#fff" opacity=".25"/>
  <rect x="1" y="42" width="56" height="3" fill="#9e0c24"/>
  <rect x="5" y="49" width="48" height="27" rx="3" fill="#a9cbe3"/>
  <rect x="28.5" y="49" width="1.2" height="27" fill="#c8102e"/>
  <path d="M8 72 L20 52 H27 L15 72 Z" fill="#fff" opacity=".22"/>
  <circle cx="10" cy="80.5" r="2.6" fill="#fff6d5"/>
  <circle cx="48" cy="80.5" r="2.6" fill="#fff6d5"/>
  <rect x="4" y="85" width="50" height="7" rx="2" fill="#2a2d35"/>`;

const house = () => `
  <rect x="57" y="10" width="9" height="22" fill="#8c3d2e"/>
  <rect x="55.5" y="8" width="12" height="4" rx="1" fill="#6f3024"/>
  <path d="M8 40 L40 8 L72 40 V100 H8 Z" fill="#f2e3c9"/>
  <path d="M3 41.5 L40 4 L77 41.5" fill="none" stroke="#b5523b" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/>
  <circle cx="40" cy="26" r="5" fill="#9fc4e0" stroke="#fff" stroke-width="1.2"/>
  ${[[14, 46], [50, 46], [14, 72]].map(([x, y]) => `
    <rect x="${x}" y="${y}" width="16" height="16" fill="#9fc4e0" stroke="#fff" stroke-width="1.4"/>
    <path d="M${x + 8} ${y} V${y + 16} M${x} ${y + 8} H${x + 16}" stroke="#fff" stroke-width="1"/>`).join('')}
  <rect x="48" y="68" width="15" height="32" rx="1" fill="#7a4b2a"/>
  <circle cx="60" cy="85" r="1.1" fill="#f2c94c"/>
  <rect x="8" y="96" width="64" height="4" fill="#c9b89a"/>`;

const tree = () => `
  <path d="M31 100 L32.5 58 H37.5 L39 100 Z" fill="#7a5134"/>
  <path d="M35 70 L44 58" stroke="#7a5134" stroke-width="3" stroke-linecap="round"/>
  <circle cx="18" cy="40" r="17" fill="#3f8a5a"/>
  <circle cx="52" cy="40" r="17" fill="#3f8a5a"/>
  <circle cx="35" cy="22" r="22" fill="#4f9d69"/>
  <circle cx="35" cy="48" r="18" fill="#4f9d69"/>
  <circle cx="23" cy="56" r="11" fill="#66b27e"/>
  <circle cx="47" cy="55" r="12" fill="#5aa874"/>
  <circle cx="28" cy="16" r="7" fill="#7cc191" opacity=".6"/>`;

const basilica = () => `
  <rect x="2" y="88" width="56" height="12" fill="#cfc6ac"/>
  <rect x="8" y="50" width="44" height="40" fill="#efe6cf"/>
  <path d="M8 50 L30 32 L52 50 Z" fill="#e3d6b0"/>
  <rect x="14" y="58" width="4" height="32" fill="#cbbd96"/>
  <rect x="22" y="58" width="4" height="32" fill="#cbbd96"/>
  <rect x="34" y="58" width="4" height="32" fill="#cbbd96"/>
  <rect x="42" y="58" width="4" height="32" fill="#cbbd96"/>
  <rect x="0" y="22" width="12" height="52" fill="#e3d6b0"/>
  <rect x="1" y="14" width="10" height="9" fill="#cbbd96"/>
  <path d="M1 14 Q6 4 11 14 Z" fill="#b9ab82"/>
  <rect x="5" y="0" width="2" height="6" fill="#8d8265"/>
  <rect x="48" y="22" width="12" height="52" fill="#e3d6b0"/>
  <rect x="49" y="14" width="10" height="9" fill="#cbbd96"/>
  <path d="M49 14 Q54 4 59 14 Z" fill="#b9ab82"/>
  <rect x="53" y="0" width="2" height="6" fill="#8d8265"/>
  <rect x="20" y="16" width="20" height="18" fill="#e3d6b0"/>
  <path d="M18 16 A12 14 0 0 1 42 16 Z" fill="#b9ab82"/>
  <rect x="29" y="0" width="2" height="8" fill="#8d8265"/>
  <rect x="26" y="2" width="8" height="2" fill="#8d8265"/>`;

function panelBlock() {
  const W = 56, floors = 10, roof = 3.2, fh = (100 - roof) / floors;
  const balcony = ['#d9734e', '#e2a54a', '#4f9c94'];
  let s = `<rect x="0" y="0" width="${W}" height="100" fill="#d6d1c7"/>`;
  for (let f = 0; f < floors; f++) {
    const y0 = roof + f * fh;
    s += `<rect x="0" y="${y0.toFixed(2)}" width="${W}" height=".45" fill="#b9b2a6"/>`;
    for (let c = 0; c < 4; c++) {
      if (f === floors - 1 && (c === 1 || c === 2)) continue;
      const lit = (f * 7 + c * 3) % 5 === 0;
      s += `<rect x="${4 + c * 13}" y="${(y0 + fh * 0.2).toFixed(2)}" width="9" height="${(fh * 0.5).toFixed(2)}"
        rx=".6" fill="${lit ? '#f3d27a' : '#5b7593'}"/>`;
    }
    if (f < floors - 1) {
      const by = (y0 + fh * 0.6).toFixed(2);
      s += `<rect x="15.5" y="${by}" width="25" height="${(fh * 0.36).toFixed(2)}" fill="${balcony[f % 3]}"/>`;
      s += `<rect x="15.5" y="${by}" width="25" height=".7" fill="#fff" opacity=".35"/>`;
    }
  }
  const gy = roof + (floors - 1) * fh;
  s += `<rect x="13" y="${(gy + fh * 0.12).toFixed(2)}" width="30" height="1.6" fill="#8b8478"/>`;
  s += `<rect x="21" y="${(gy + fh * 0.25).toFixed(2)}" width="14" height="${(100 - gy - fh * 0.25).toFixed(2)}" fill="#3e4a5c"/>`;
  s += `<rect x="27.6" y="${(gy + fh * 0.25).toFixed(2)}" width=".8" height="${(100 - gy - fh * 0.25).toFixed(2)}" fill="#26303f"/>`;
  s += `<rect x="-1.2" y="0" width="${W + 2.4}" height="${roof}" fill="#8d949e"/>`;
  return s;
}

/** Sorted by height (meters). */
export const OBJECTS = [
  { id: 'rubik', name: "Rubik's Cube", height: 0.057, aspect: 0.866, art: rubik() },
  { id: 'mug', name: 'Coffee mug', height: 0.095, aspect: 1.0, art: mug() },
  { id: 'phone', name: 'Smartphone', height: 0.15, aspect: 0.49, art: phone() },
  { id: 'wine', name: 'Wine bottle', height: 0.3, aspect: 0.28, art: wineBottle() },
  { id: 'hydrant', name: 'Fire hydrant', height: 0.6, aspect: 0.7, art: hydrant() },
  { id: 'chair', name: 'Kitchen chair', height: 0.9, aspect: 0.5, art: chair() },
  { id: 'person', name: 'Adult person', height: 1.75, aspect: 0.46, art: person() },
  { id: 'bus', name: 'Double-decker bus', height: 4.4, aspect: 0.58, art: bus() },
  { id: 'house', name: 'Family house', height: 9, aspect: 0.8, art: house() },
  { id: 'tree', name: 'Oak tree', height: 20, aspect: 0.7, art: tree() },
  { id: 'panel', name: 'Ten-storey panel block', height: 30, aspect: 0.56, art: panelBlock() },
  { id: 'basilica', name: "St. Stephen's Basilica", height: 96, aspect: 0.6, art: basilica() },
];

/** Smallest object at least as tall as the tallest tower. */
export function pickObject(maxHeight) {
  return OBJECTS.find(o => o.height >= maxHeight) ?? OBJECTS[OBJECTS.length - 1];
}
