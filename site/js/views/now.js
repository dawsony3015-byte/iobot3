/* The "Now" card at the top of Today: what's happening and how long is left.
 *
 * The wording changes with the moment (see statusAt in schedule.js):
 *   before school   Homeroom starts in 0:22:14
 *   in a block      Period 3 · Chemistry · I-203, 25:00, until 9:25 · Next: Period 4 at 9:30
 *   passing time    Period 4 starts in 3:41
 *   lunch           Lunch, 31:08 left, plus the food
 *   after school    Done for today · Tomorrow is an F day (7 · 8 · 5 · 6)
 *   no school       Fall Break · Back Mon, Oct 19 · PSAT day
 *
 * When a block ends, the words slide out and the new ones slide in, while the
 * countdown keeps running and simply rolls into the new block's time.
 */

import { Countdown, ProgressBar } from '../countdown.js';
import { fill, h, motionReduced } from '../dom.js';
import { clock, dateText, rotationText } from '../format.js';
import { addDays } from '../time.js';
import { blockTitle, classFor } from '../schedule.js';

const SWAP = { duration: 350, easing: 'cubic-bezier(.2, .7, .2, 1)' };

export class NowCard {
  constructor() {
    this.countdown = new Countdown();
    this.bar = new ProgressBar();
    this.head = h('div', { class: 'now-swap now-head' });
    this.big = h('p', { class: 'now-big' });
    this.foot = h('div', { class: 'now-swap now-foot' });
    this.food = h('div', { class: 'now-food' });
    this.meter = h('div', { class: 'now-meter' }, this.countdown.el, this.bar.el);
    this.el = h('section', { class: 'now', 'aria-label': 'Right now' }, this.head, this.meter, this.big, this.foot, this.food);
    this.key = null;
  }

  /* Show a new status. Called on first paint and whenever a block starts or ends. */
  show(status, ms, settings, food, animate) {
    const words = describe(status, settings);
    const key = `${status.date}|${status.state}|${status.block?.index ?? status.next?.index ?? ''}`;
    const changed = key !== this.key;
    this.key = key;
    swap(this.head, [
      h('p', { class: 'label now-kicker' }, words.kicker),
      words.title ? h('h2', { class: 'now-title' }, words.title) : null,
      words.detail ? h('p', { class: 'now-detail' }, words.detail) : null,
    ], animate && changed);
    swap(this.foot, h('p', {}, words.foot), animate && changed);
    this.meter.hidden = !words.counts;
    this.big.hidden = !words.big;
    this.big.textContent = words.big || '';
    this.el.dataset.state = status.state;
    fill(this.food, status.state === 'lunch' ? food : null);
    this.tick(status, ms, false);
  }

  /* Every frame: the countdown digits and the progress bar. */
  tick(status, ms, animate = true) {
    if (this.meter.hidden) return;
    this.countdown.show(Math.ceil((status.to - ms) / 1000), animate);
    this.bar.set((ms - status.from) / (status.to - status.from));
  }
}

/* Replace an element's content, sliding the old words out and the new ones in.
   With reduced motion it's a quick cross-fade instead. */
function swap(el, nodes, animate) {
  const next = h('div', { class: 'swap-layer' }, nodes);
  const old = el.firstElementChild;
  if (!animate || !old || !next.animate) {
    el.replaceChildren(next);
    return;
  }
  const still = motionReduced();
  old.classList.add('is-leaving');
  el.append(next);
  old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: still ? 'none' : 'translateX(-24px)' }], SWAP)
    .onfinish = () => old.remove();
  next.animate([{ opacity: 0, transform: still ? 'none' : 'translateX(24px)' }, { opacity: 1, transform: 'none' }], SWAP);
}

/* The words for a status. Kept apart from the drawing code so it's easy to read. */
export function describe(status, settings) {
  const { state, day, block, next, prev, back, date } = status;
  const name = (b) => blockTitle(b, day, settings.grade);
  const where = (b) => {
    const c = classFor(b, settings);
    if (!c) return '';
    return c.free ? 'Free' : [c.name, c.room].filter(Boolean).join(' · ');
  };
  const nextText = next ? `Next: ${name(next)} at ${clock(next.start)}` : 'Last block today';

  switch (state) {
    case 'before':
      return { kicker: 'Before school', title: `${name(next)} starts in`, detail: where(next), counts: true,
        foot: `at ${clock(next.start, true)}` };
    case 'block':
      return { kicker: 'Now', title: name(block), detail: where(block), counts: true,
        foot: `until ${clock(block.end)} · ${nextText}` };
    case 'lunch':
      return { kicker: 'Now', title: name(block), detail: `until ${clock(block.end)}`, counts: true,
        foot: `left · ${nextText}` };
    case 'passing':
      return { kicker: 'Passing time', title: `${name(next)} starts in`, detail: where(next), counts: true,
        foot: `at ${clock(next.start)} · ${name(prev)} ended at ${clock(prev.end)}` };
    case 'after':
      return { kicker: 'After school', big: 'Done for today', foot: comingUp(back, date, 'after') };
    case 'no-times':
      return { kicker: day.name, big: 'No bell times', foot: 'The school calendar has no block times for today. Check with your teachers.' };
    default:
      return { kicker: offKicker(day), big: day.type === 'weekend' ? 'Weekend' : day.name, foot: comingUp(back, date, 'off') };
  }
}

function offKicker(day) {
  if (day.type === 'exams') return 'No regular classes';
  if (day.type === 'weekend') return 'No school';
  return 'No school today';
}

/* 'Tomorrow is an F day (7 · 8 · 5 · 6)' or 'Back Mon, Oct 19 · PSAT Schedule Day'. */
export function comingUp(back, date, mode) {
  if (!back) return 'The calendar has no more school days yet.';
  const [when, day] = back;
  const rotation = day.rotation.length ? ` (${rotationText(day.rotation)})` : '';
  const kind = day.variant ? `${/^[AEF]/.test(day.variant) ? 'an' : 'a'} ${day.variant} day${rotation}` : day.name;
  if (mode === 'after') {
    const lead = when === addDays(date, 1) ? 'Tomorrow is' : `Next school day is ${dateText(when)}:`;
    return `${lead} ${kind}`;
  }
  return `Back ${dateText(when)} · ${day.variant ? `${day.variant} day${rotation}` : day.name}`;
}
