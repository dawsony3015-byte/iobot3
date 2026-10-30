/* Extra pieces of the Today screen: schedule changes, the to-do strip, and a
 * preview of tomorrow once school is out.
 */

import { data } from '../data.js';
import { h } from '../dom.js';
import { clockAt, dateText, relativeDay } from '../format.js';
import { dayRecord, dayTitle, isClassDay, nextClassDay } from '../schedule.js';
import { removeTask } from '../store.js';
import { addDays } from '../time.js';
import { timeline } from './timeline.js';

/* "Schedule change: Fri, Nov 6 is now E1 Schedule (1,2,3,4)." Lists changes the
   pipeline found for today and the next week, newest first. */
export function changeNotice(date) {
  const soon = addDays(date, 7);
  const changes = (data.schedule?.changes || []).filter((c) => c.date >= date && c.date <= soon);
  if (!changes.length) return null;
  const latest = new Map();
  for (const c of changes) latest.set(c.date, c); // a later edit of the same date wins
  return h('div', { class: 'notice notice-change', role: 'status' },
    h('strong', {}, 'Schedule change'),
    h('ul', { class: 'plain-list' }, [...latest.values()].map((c) => h('li', {},
      h('a', { href: `#/day/${c.date}` }, `${dateText(c.date)} (${relativeDay(c.date, date)})`),
      c.times_only ? ': block times changed' : `: was “${c.before}”, now “${c.after}”`,
      h('span', { class: 'muted' }, ` · updated ${clockAt(Date.parse(c.seen_at))}`)))));
}

/* The next few to-dos, overdue ones first, with a Done button on each. */
export function todoStrip(settings, date) {
  const tasks = [...settings.tasks].sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4);
  if (!tasks.length) return null;
  return h('section', { class: 'section', 'aria-labelledby': 'todo-h' },
    h('div', { class: 'section-head' }, h('h2', { class: 'label', id: 'todo-h' }, 'To-do'), h('a', { href: '#/me' }, 'Edit')),
    h('ul', { class: 'plain-list' }, tasks.map((t) => {
      const late = t.due < date;
      return h('li', { class: `todo-row${late ? ' is-late' : ''}` },
        h('span', { class: 'todo-due' }, late ? 'Overdue' : relativeDay(t.due, date).replace(/^in /, '')),
        h('span', { class: 'todo-text' }, t.text),
        h('button', { class: 'btn btn-quiet', type: 'button', 'aria-label': `Mark ${t.text} done`, onclick: () => removeTask(t.id) }, 'Done'));
    })));
}

/* After the last block: the next school day's blocks, so students can plan
   tonight without opening the calendar. */
export function tomorrowPreview(status, settings) {
  if (status.state !== 'after') return null;
  const next = nextClassDay(data.schedule, status.date);
  if (!next) return null;
  const [when, day] = next;
  const record = dayRecord(data.schedule, when);
  return h('section', { class: 'section today-blocks', 'aria-labelledby': 'tomorrow-h' },
    h('div', { class: 'section-head' },
      h('h2', { class: 'label', id: 'tomorrow-h' }, when === addDays(status.date, 1) ? 'Tomorrow' : dateText(when)),
      h('a', { href: `#/day/${when}` }, 'Full day')),
    h('p', { class: 'tomorrow-title' }, isClassDay(record) ? dayTitle(record) : record.name),
    day.blocks.length ? timeline(day, settings).el : h('p', { class: 'empty' }, 'No block times on the calendar for that day.'));
}
