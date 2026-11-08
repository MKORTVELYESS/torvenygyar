import { WHEEL_COOLDOWN_MS, WHEEL_STEP } from './constants.js';
import { els } from './dom.js';
import { state } from './state.js';
import { captureAnchor, render, setGranularity } from './chrome.js';
import { hideTooltip, showTooltip } from './tooltip.js';
import { closeCandleModal, openCandleModal } from './candle-modal.js';

/** Chart input: wheel/keyboard granularity, pan/drag, tooltips, resize, candle modal. */
export function bindEvents() {
  let wheelAccumulator = 0;
  let lastStep = 0;
  els.chart.addEventListener('wheel', event => {
    event.preventDefault();
    const scale = event.deltaMode === 1 ? 16 : 1;
    const horizontal = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
    if (horizontal) {
      els.scroll.scrollLeft += (event.deltaX || event.deltaY) * scale;
      return;
    }
    const now = performance.now();
    if (now - lastStep < WHEEL_COOLDOWN_MS) {
      wheelAccumulator = 0;
      return;
    }
    wheelAccumulator += event.deltaY * scale;
    if (Math.abs(wheelAccumulator) >= WHEEL_STEP) {
      setGranularity(state.gIndex + Math.sign(wheelAccumulator));
      wheelAccumulator = 0;
      lastStep = now;
    }
  }, { passive: false });

  window.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'PageDown') setGranularity(state.gIndex + 1);
    else if (event.key === 'ArrowUp' || event.key === 'PageUp') setGranularity(state.gIndex - 1);
    else return;
    event.preventDefault();
  });

  // Phones have no hover, so a tap has to open the tooltip and leave it open.
  const noHover = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;
  const isTouch = event => event.pointerType === 'touch' || event.pointerType === 'pen';
  let drag = null;
  let touchTooltip = false;
  els.scroll.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = { x: event.clientX, left: els.scroll.scrollLeft, moved: false };
  });
  window.addEventListener('pointermove', event => {
    if (!drag) return;
    const dx = event.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 3) {
      drag.moved = true;
      els.scroll.classList.add('dragging');
      hideTooltip();
    }
    if (drag.moved) els.scroll.scrollLeft = drag.left - dx;
  });
  window.addEventListener('pointerup', () => {
    drag = null;
    els.scroll.classList.remove('dragging');
  });

  els.plot.addEventListener('pointermove', event => {
    if (noHover() || isTouch(event) || drag?.moved) return;
    showTooltip(event);
  });
  // pointerup reaches the plot before the window handler clears the drag.
  els.plot.addEventListener('pointerup', event => {
    if ((!isTouch(event) && !noHover()) || drag?.moved) return;
    touchTooltip = true;
    showTooltip(event);
  });
  els.plot.addEventListener('pointerleave', () => {
    if (touchTooltip || noHover()) return;
    hideTooltip();
  });
  document.addEventListener('pointerdown', event => {
    if ((touchTooltip || noHover()) && !els.plot.contains(event.target)) {
      touchTooltip = false;
      hideTooltip();
    }
  });

  els.candleHelpLink.addEventListener('click', openCandleModal);
  els.candleModalClose.addEventListener('click', closeCandleModal);
  els.candleModal.addEventListener('click', event => {
    if (event.target === els.candleModal) closeCandleModal();
  });
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !els.candleModal.hidden) closeCandleModal();
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      captureAnchor();
      render();
    }, 120);
  });
}
