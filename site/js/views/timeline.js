/* A day's blocks as a vertical timeline, drawn like a transit line: times on
 * the left, a rail with one stop per block, then the block's name.
 *
 * On the Today screen the stops fill in as blocks finish, the current stop is
 * red, and a soft band slides behind the current row. Every row has the same
 * height, so moving the band to the next row is a single transform
 * (row number × row height) that the browser can animate smoothly.
 */

import { h } from '../dom.js';
import { clock } from '../format.js';
import { blockTitle, classFor } from '../schedule.js';

export function timeline(day, settings, { live = false } = {}) {
  const rows = day.blocks.map((block) => row(block, day, settings));
  const marker = live ? h('div', { class: 'tl-marker', 'aria-hidden': 'true', hidden: true }) : null;
  const list = h('ol', { class: 'tl' }, rows);
  const el = h('div', { class: `tl-wrap${live ? ' is-live' : ''}` }, marker, list);
  return { el, rows, marker, placed: false };
}

function row(block, day, settings) {
  const c = classFor(block, settings);
  const detail = c && !c.free ? [c.name, c.room].filter(Boolean).join(' · ') : '';
  return h('li', { class: `tl-row kind-${block.kind}` },
    h('span', { class: 'tl-time' },
      h('span', { class: 'tl-start' }, clock(block.start)),
      h('span', { class: 'tl-end' }, clock(block.end))),
    h('span', { class: 'tl-rail', 'aria-hidden': 'true' }, h('span', { class: 'tl-stop' })),
    h('span', { class: 'tl-body' },
      h('span', { class: 'tl-name' }, blockTitle(block, day, settings.grade),
        c?.free ? h('span', { class: 'pill' }, 'Free') : null),
      detail ? h('span', { class: 'tl-detail' }, detail) : null));
}

/* Mark blocks that are over, light up the current one, and move the band.
   Between blocks the band waits on the next block in a lighter style. */
export function markTimeline(tl, status, ms) {
  if (!tl.marker) return;
  const { block, next, state, blocks } = status;
  tl.rows.forEach((el, i) => {
    const b = blocks[i];
    el.classList.toggle('is-past', Boolean(b) && b.endAt <= ms);
    el.classList.toggle('is-current', block?.index === i);
    el.classList.toggle('is-next', !block && next?.index === i);
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
