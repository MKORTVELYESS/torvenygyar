// Layout and view constants shared across the chart.

export const SHEET_M = 0.0001; // one 80 g/m² A4 sheet ≈ 0.1 mm
export const DAY_MINUTES = 1440;
export const MARGIN = { top: 72, bottom: 56 };
export const Y_AXIS_W = 64;
export const NIGHT_AXIS_W = 126;
export const HEADROOM = 1.1;
export const WHEEL_STEP = 40;
export const WHEEL_COOLDOWN_MS = 380;
export const VIEW_GROUPS = ['tower', 'night'];
export const LANGS = ['en', 'hu'];
// One release a day (and most weeks) has no spread, so a candle collapses to nothing.
export const COLUMN_GRANULARITIES = new Set(['daily', 'weekly']);

// Above this count, layers use merged paths / solid fills and must not opacity-fade.
// Fading a ~5k-subpath gradient layer (daily night) freezes Safari on phone and desktop.
export const HEAVY_LAYER = 1500;

// Vertical day-sky palette shared by the SVG gradient and the heavy-layer canvas.
export const SKY_STOPS = [
  [0, '#0b1020'], [0.1667, '#152048'], [0.25, '#ff9d6a'], [0.333, '#ffd27a'],
  [0.5, '#8ecbff'], [0.667, '#8ecbff'], [0.75, '#ff8a65'], [0.833, '#5b3d79'],
  [0.9167, '#141b3d'], [1, '#0b1020'],
];

export const NARROW_CHART_W = 640;
// Daily spans ~10k buckets → 13–30k px SVG. WebKit often freezes or tabs out
// past ~8k px with complex gradient paths; Chromium tolerates the full width.
export const WEBKIT_MAX_PLOT_W = 8192;
export const isWebKit = typeof navigator !== 'undefined' && /Apple Computer/.test(navigator.vendor);
