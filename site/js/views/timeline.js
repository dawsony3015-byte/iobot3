/* A day's blocks as a vertical timeline, with the times in a tidy column.
 *
 * On the Today screen a single highlight sits behind the current block. Every
 * row has the same height, so moving the highlight to the next block is just a
 * transform (translateY by row number × row height), which the browser can
 * animate smoothly without re-measuring anything.
 */

import { h } from '../dom.js';
import { clock } from '../format.js';
import { blockTitle, classFor } from '../schedule.js';

export function timeline(day, settings, { live = false } = {}) {
  const rows = day.blocks.map((block) => row(block, day, settings));
  const marker = live ? h('li', { class: 'tl-marker', 'aria-hidden': 'true', hidden: true }) : null;
  const el = h('ol', { class: `tl${live ? ' is-live' : ''}` }, marker, rows);
  return { el, rows, marker, placed: false };
}

function row(block, day, settings) {
  const c = classFor(block, settings);
  const detail = c && !c.free ? [c.name, c.room].filter(Boolean).join(' · ') : '';
  return h('li', { class: `tl-row kind-${block.kind}` },
    h('span', { class: 'tl-time' },
      h('span', { class: 'tl-start' }, clock(block.start)),
      h('span', { class: 'tl-end' }, clock(block.end))),
    h('span', { class: 'tl-body' },
      h('span', { class: 'tl-name' }, blockTitle(block, day, settings.grade),
        c?.free ? h('span', { class: 'pill' }, 'Free') : null),
      detail ? h('span', { class: 'tl-detail' }, detail) : null));
}

/* Dim the blocks that are over and move the highlight to the current one.
   Between blocks the highlight waits on the next block in a lighter style. */
export function markTimeline(tl, status, ms) {
  if (!tl.marker) return;
  const { block, next, state, blocks } = status;
  tl.rows.forEach((el, i) => {
    el.classList.toggle('is-past', Boolean(blocks[i]) && blocks[i].endAt <= ms);
    el.classList.toggle('is-current', block?.index === i);
    if (block?.index === i) el.setAttribute('aria-current', 'time');
    else el.removeAttribute('aria-current');
  });
  const target = block || (state === 'passing' || state === 'before' ? next : null);
  tl.marker.hidden = !target;
  if (!target) return;
  tl.marker.style.setProperty('--i', target.index);
  tl.marker.classList.toggle('is-next', !block);
  // The first placement shouldn't glide in from the top; later moves should.
  if (!tl.placed) {
    tl.placed = true;
    requestAnimationFrame(() => requestAnimationFrame(() => tl.el.classList.add('is-ready')));
  }
}
