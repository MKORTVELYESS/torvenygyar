// Mood of a government clerk across the day, shown as emoji on the Night shift axis.

/** Fixed y-axis reference points for the Night shift view, bottom (00:00) to top (24:00). */
export const NIGHT_TICKS = [
  { minutes: 0, emoji: '😴', label: '00:00' },
  { minutes: 360, emoji: '🥱', label: '06:00' },
  { minutes: 720, emoji: '😄', label: '12:00' },
  { minutes: 1080, emoji: '😩', label: '18:00' },
  { minutes: 1440, emoji: '😴', label: '24:00' },
];

/** Mood for an arbitrary minute-of-day value. `key` maps to the `mood.*` translation keys. */
export function moodMeta(minutes) {
  if (minutes == null) return { emoji: '🙂', key: 'unknown' };
  const h = (minutes / 60) % 24;
  if (h < 5) return { emoji: '😴', key: 'sleep' };
  if (h < 8) return { emoji: '🥱', key: 'dawn' };
  if (h < 18) return { emoji: '😄', key: 'day' };
  if (h < 22) return { emoji: '😩', key: 'dusk' };
  return { emoji: '😴', key: 'night' };
}
