import { GRANULARITIES, aggregate } from './data.js';

/** Mutable UI + data state shared by views and controls. */
export const state = {
  viewId: 'tower',
  gIndex: GRANULARITIES.findIndex(g => g.id === 'yearly'),
  anchor: 1,
  renderedKey: null,
  objectId: null,
  view: null,
};

const bucketCache = new Map();

export let rows = [];
export let totals = { pages: 0, issues: 0 };
export let overallMeanMinutes = null;

export function setRows(next) {
  rows = next;
  bucketCache.clear();
}

export function setTotals(next) {
  totals = next;
}

export function setOverallMeanMinutes(next) {
  overallMeanMinutes = next;
}

export function bucketsFor(g) {
  if (!bucketCache.has(g.id)) bucketCache.set(g.id, aggregate(rows, g));
  return bucketCache.get(g.id);
}
