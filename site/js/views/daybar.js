/* The day bar: the whole school day drawn to scale, one segment per block,
 * with a marker for "now" that glides along it.
 *
 * Segment widths are worked out once from the block times (Period 3 is 70
 * minutes out of 440, so 15.9% wide). Gaps between segments are passing time.
 * Each frame only the marker moves, and it moves with transform, so the
 * browser never has to lay the page out again.
 */

import { h } from '../dom.js';
import { clock } from '../format.js';
import { blockTitle } from '../schedule.js';
import { epochAt } from '../time.js';

// Short names for the labels under each segment.
const SHORT = {
  'homeroom-chapel': 'HR', homeroom: 'HR', chapel: 'CH', 'chapel-assembly': 'ASM', assembly: 'ASM',
  meeting: 'MTG', 'meeting-lunch': 'L', lunch: 'L', break: '',
};
// Labels on segments narrower than this (percent of the day) would collide.
const MIN_LABEL_WIDTH = 5;

export function dayBar(day, date, grade) {
  const first = day.blocks[0].start;
  const last = day.blocks.reduce((latest, b) => (b.end > latest ? b.end : latest), day.blocks[0].end);
  const start = epochAt(date, first);
  const end = epochAt(date, last);
  const span = end - start;
  const pct = (time) => ((epochAt(date, time) - start) / span) * 100;

  const segments = day.blocks.map((block) => {
    const left = pct(block.start);
    const width = pct(block.end) - left;
    let short = block.period ? String(block.period) : SHORT[block.kind] ?? '';
    if (block.kind === 'homeroom-chapel' && blockTitle(block, day, grade) === 'Chapel') short = 'CH';
    const seg = h('span', { class: `db-seg kind-${block.kind}`, style: `left:${left}%;width:${width}%` });
    const label = width >= MIN_LABEL_WIDTH && short
      ? h('span', { class: `db-label${block.period ? ' is-period' : ''}`, style: `left:${left + width / 2}%` }, short)
      : null;
    return { seg, label };
  });
  const marker = h('span', { class: 'db-marker', 'aria-hidden': 'true' }, h('span', { class: 'db-needle' }));
  const el = h('div', { class: 'daybar', role: 'img', 'aria-label': `School day from ${clock(first, true)} to ${clock(last, true)}` },
    h('div', { class: 'db-track' }, segments.map((s) => s.seg), marker),
    h('div', { class: 'db-labels', 'aria-hidden': 'true' }, segments.map((s) => s.label)),
    h('div', { class: 'db-ends', 'aria-hidden': 'true' },
      h('span', {}, clock(first)), h('span', {}, clock(last))));

  let shown = -1;
  return {
    el,
    /* Color the segments: done, current, still to come. */
    mark(status, ms) {
      segments.forEach(({ seg, label }, i) => {
        const b = status.blocks[i];
        const state = !b ? 'future' : b.endAt <= ms ? 'past' : status.block?.index === i ? 'current' : 'future';
        seg.dataset.state = state;
        if (label) label.dataset.state = state;
      });
    },
    /* Every frame: slide the marker to now. */
    tick(ms) {
      const p = Math.min(1, Math.max(0, (ms - start) / span));
      if (Math.abs(p - shown) < 0.0002) return;
      shown = p;
      marker.style.transform = `translateX(${p * 100}%)`;
      marker.classList.toggle('is-off', ms < start || ms >= end);
    },
  };
}
