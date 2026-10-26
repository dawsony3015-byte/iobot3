/* Any date's full schedule: #/day/2026-10-20.
 *
 * Shows the label, period order, chapel, every block with the student's class
 * names, and that day's lunch and bulletin if the bulletin was archived.
 */

import { data, load } from '../data.js';
import { fill, h, icon } from '../dom.js';
import { clock, dateText, relativeDay, rotationText } from '../format.js';
import { dayRecord, dayTitle, isClassDay } from '../schedule.js';
import { addDays, today, weekday } from '../time.js';
import { announcement, chapelText, foodList, tile } from './day-parts.js';
import { timeline } from './timeline.js';

export function render(root, { route, settings }) {
  const now = today();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(route.args[0] || '') ? route.args[0] : now;
  const day = dayRecord(data.schedule, date);
  const chapel = chapelText(day, settings.grade, 'this day');
  const bulletin = h('div', {}, h('p', { class: 'empty' }, 'Looking for this day’s bulletin…'));

  fill(root,
    h('nav', { class: 'day-nav', 'aria-label': 'Other days' },
      h('a', { class: 'btn', href: `#/day/${schoolDay(date, -1)}`, 'aria-label': 'Previous school day' }, icon('left')),
      h('a', { class: 'btn', href: `#/day/${schoolDay(date, 1)}`, 'aria-label': 'Next school day' }, icon('right')),
      date !== now ? h('a', { class: 'btn', href: '#/today' }, 'Today') : h('a', { class: 'btn', href: '#/today' }, 'Live view'),
      h('a', { class: 'btn btn-quiet', href: `#/calendar/${date.slice(0, 7)}` }, 'Month')),
    h('header', { class: 'day-head' },
      tile(day),
      h('div', { class: 'day-head-text' },
        h('h1', { class: 'day-date' }, dateText(date, 'full')),
        h('p', { class: 'day-sub' }, isClassDay(day) ? dayTitle(day) : day.name,
          chapel ? h('span', { class: 'chapel' }, chapel) : null,
          h('span', { class: 'muted' }, relativeDay(date, now))),
        day.rotation.length ? h('p', { class: 'rot' }, rotationText(day.rotation)) : null)),
    day.label ? h('p', { class: 'source-label' }, 'Calendar says: ', h('q', {}, day.labels.join(' + '))) : null,
    body(day, settings),
    h('section', { class: 'section', 'aria-labelledby': 'bulletin-h' },
      h('div', { class: 'section-head' }, h('h2', { class: 'label', id: 'bulletin-h' }, 'Daily bulletin')), bulletin));

  load(`data/bulletins/${date}.json`).then((b) => {
    if (bulletin.isConnected) fill(bulletin, bulletinParts(b, date, now));
  });
}

function body(day, settings) {
  if (!isClassDay(day)) {
    return h('section', { class: 'off-day' }, h('p', { class: 'now-big' }, day.type === 'weekend' ? 'Weekend' : day.name),
      h('p', { class: 'muted' }, day.type === 'exams' ? 'Final exams. No regular classes.' : 'No classes.'));
  }
  if (!day.blocks.length) {
    return h('p', { class: 'notice' }, 'The school calendar has no block times for this day.');
  }
  return h('section', { class: 'section' },
    h('div', { class: 'section-head' }, h('h2', { class: 'label' }, 'Blocks')),
    day.dropped.length ? h('p', { class: 'note' }, `No Period ${day.dropped.join(' or ')} this day.`) : null,
    timeline(day, settings).el);
}

function bulletinParts(b, date, now) {
  if (!b) {
    return h('p', { class: 'empty' }, date > now ? 'The bulletin comes out the morning of.'
      : `No bulletin was saved for this day. The archive starts ${dateText(data.clubs?.first_archived || date, 'noWeekday')}.`);
  }
  const lines = b.schedule.filter((s) => s.start);
  return [
    foodList(b),
    b.items.length ? h('div', { class: 'sub-section' }, h('h3', { class: 'label' }, 'Announcements'),
      b.items.map((item) => announcement(item, item.everyone ? 'Everyone' : item.section))) : null,
    lines.length ? h('div', { class: 'sub-section' }, h('h3', { class: 'label' }, 'Today’s schedule'),
      h('ul', { class: 'lines' }, lines.map((s) => h('li', {},
        h('span', { class: 'fy-time' }, clock(s.start, true)), ' ', s.title, s.location ? h('span', { class: 'muted' }, ` · ${s.location}`) : null)))) : null,
  ];
}

/* The nearest weekday before or after a date (school days are Mon-Fri). */
function schoolDay(date, step) {
  let d = addDays(date, step);
  while (weekday(d) === 0 || weekday(d) === 6) d = addDays(d, step);
  return d;
}
