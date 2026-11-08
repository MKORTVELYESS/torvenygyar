import { els } from './dom.js';

export function openCandleModal() {
  els.candleModal.hidden = false;
}

export function closeCandleModal() {
  els.candleModal.hidden = true;
}
