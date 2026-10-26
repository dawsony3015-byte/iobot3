/* The countdown: digits that roll over when they change, and a progress bar
 * that fills smoothly.
 *
 * Accuracy: nothing here ever "subtracts one second". Every animation frame the
 * page asks the real clock how much time is left (end − now) and only touches
 * the digits when the whole number of seconds changes. A late frame, a locked
 * iPad or a background tab can't make it drift, because the next frame simply
 * reads the clock again.
 *
 * Motion: each digit sits in its own fixed-width cell. When it changes, the old
 * digit slides up and out while the new one slides in from below, clipped to
 * the cell. Only `transform` and `opacity` animate.
 */

import { h, motionReduced } from './dom.js';
import { countdownText, countdownWords } from './format.js';

const FLIP = { duration: 300, easing: 'cubic-bezier(.2, .7, .2, 1)' };
const OUT = [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-100%)', opacity: 0 }];
const IN = [{ transform: 'translateY(100%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }];

export class Countdown {
  constructor() {
    this.el = h('div', { class: 'cd', role: 'timer' });
    this.text = '';
    this.cells = [];
    this.minutesSaid = null;
  }

  /* Show a number of seconds. `animate` is false for the first paint and after
     the device wakes up, when rolling every digit at once would look broken. */
  show(seconds, animate = true) {
    const text = countdownText(seconds);
    if (text !== this.text) {
      const shape = (t) => t.replace(/\d/g, '0');
      if (shape(text) !== shape(this.text)) {
        this.build(text); // e.g. 1:00:00 -> 59:59 changes the number of cells
      } else {
        const roll = animate && !motionReduced();
        for (let i = 0; i < text.length; i++) {
          if (text[i] !== this.text[i]) this.flip(this.cells[i], text[i], roll);
        }
      }
      this.text = text;
    }
    this.el.classList.toggle('is-long', text.length > 5);
    this.el.classList.toggle('is-final', seconds <= 60);
    // Screen readers get the time in words, updated once a minute, not every second.
    const words = countdownWords(seconds);
    if (words !== this.minutesSaid) {
      this.el.setAttribute('aria-label', `${words} left`);
      this.minutesSaid = words;
    }
  }

  build(text) {
    this.cells = [...text].map((ch) => {
      if (!/\d/.test(ch)) return h('span', { class: 'cd-sep', 'aria-hidden': 'true' }, ch);
      // The invisible "0" gives the cell its width and height; the real digit is
      // laid over it, so a sliding digit never pushes anything sideways.
      return h('span', { class: 'cd-cell', 'aria-hidden': 'true' },
        h('span', { class: 'cd-ghost' }, '0'), h('span', { class: 'cd-digit' }, ch));
    });
    this.el.replaceChildren(...this.cells);
  }

  flip(cell, digit, roll) {
    const old = cell.lastElementChild;
    const next = h('span', { class: 'cd-digit' }, digit);
    // At demo speeds a digit can change again before its last roll finished.
    // Rolling would just blur, so skip straight to the new digit.
    const busy = cell.childElementCount > 2;
    if (!roll || busy || !old.animate) {
      cell.replaceChildren(cell.firstElementChild, next);
      return;
    }
    cell.append(next);
    old.animate(OUT, FLIP).onfinish = () => old.remove();
    next.animate(IN, FLIP);
  }
}

/* A thin bar that fills from 0 to 1. It is moved with transform: scaleX(),
   which the browser can draw without recalculating the page layout. */
export class ProgressBar {
  constructor() {
    this.fill = h('div', { class: 'bar-fill' });
    this.el = h('div', { class: 'bar', 'aria-hidden': 'true' }, this.fill);
    this.value = -1;
  }

  set(fraction) {
    const value = Math.min(1, Math.max(0, fraction));
    // Skip writes too small to see; on a phone 0.0005 is a fraction of a pixel.
    if (Math.abs(value - this.value) < 0.0005) return;
    this.value = value;
    this.fill.style.transform = `scaleX(${value})`;
  }
}

/* Call onFrame(nowMs, woke) on every screen refresh while the page is visible.
 *
 * `woke` is true on the first frame after the page was hidden, the device slept,
 * or the tab was restored from the back/forward cache. The loop stops entirely
 * while the page is hidden, so it costs no battery in a background tab.
 * Returns a function that stops the loop.
 */
export function runFrames(clock, onFrame) {
  let handle = 0;
  let lastReal = 0;

  const frame = () => {
    const real = performance.now();
    const woke = !lastReal || real - lastReal > 1000;
    lastReal = real;
    onFrame(clock(), woke);
    handle = requestAnimationFrame(frame);
  };
  const start = () => {
    if (!handle && document.visibilityState === 'visible') {
      lastReal = 0;
      handle = requestAnimationFrame(frame);
    }
  };
  const stop = () => {
    cancelAnimationFrame(handle);
    handle = 0;
  };
  const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());

  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pageshow', onVisibility);
  start();
  return () => {
    stop();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pageshow', onVisibility);
  };
}
