/* One grade: #/grade/10.
 *
 * Chapel days for that grade over the next two weeks, today's TODAY'S SCHEDULE
 * lines tagged for it ("Srs." -> 12), and bulletin announcements tagged for it,
 * including range headings like "GRS 9-11".
 */

import { data, load } from '../data.js';
import { fill, h } from '../dom.js';
import { clock, dateText, relativeDay } from '../format.js';
import { dayTitle } from '../schedule.js';
import { update } from '../store.js';
import { addDays, today } from '../time.js';
import { announcement } from './day-parts.js';

const GRADES = [7, 8, 9, 10, 11, 12];

export function render(root, { route, settings }) {
  const grade = Number(route.args[0]);
  if (!GRADES.includes(grade)) {
    location.replace(`#/grade/${settings.grade || 9}`);
    return;
  }
  const now = today();
  const announcements = h('div', {}, h('p', { class: 'empty' }, 'Loading announcements…'));
  const makeMine = h('button', { class: 'btn', type: 'button', onclick: () => update({ grade }) }, `Make grade ${grade} my grade`);

  fill(root,
    h('header', { class: 'page-head' },
      h('h1', { class: 'page-title' }, `Grade ${grade}`),
      settings.grade === grade ? h('span', { class: 'pill pill-accent' }, 'Your grade') : makeMine),
    h('nav', { class: 'chips', 'aria-label': 'Grades' }, GRADES.map((g) =>
      h('a', { class: `chip${g === grade ? ' is-current' : ''}`, href: `#/grade/${g}`, 'aria-current': g === grade ? 'page' : null }, String(g)))),
    h('section', { class: 'section', 'aria-labelledby': 'chapel-h' },
      h('div', { class: 'section-head' }, h('h2', { class: 'label', id: 'chapel-h' }, 'Chapel, next two weeks')),
      chapelDays(grade, now)),
    todaysLines(grade),
    h('section', { class: 'section', 'aria-labelledby': 'ann-h' },
      h('div', { class: 'section-head' }, h('h2', { class: 'label', id: 'ann-h' }, 'Announcements')),
      announcements));

  load('data/announcements.json').then((archive) => {
    if (!announcements.isConnected) return;
    const items = (archive?.items || []).filter((i) => !i.everyone && i.grades.includes(grade)).slice(0, 30);
    fill(announcements, items.length
      ? items.map((i) => announcement(i, i.dates.length > 1
        ? `${dateText(i.dates[0])} – ${dateText(i.dates[i.dates.length - 1])}` : dateText(i.dates[0])))
      : h('p', { class: 'empty' }, `No announcements tagged for grade ${grade} yet.`));
  });
}

function chapelDays(grade, now) {
  const rows = [];
  for (let i = 0, d = now; i < 14; i++, d = addDays(d, 1)) {
    const day = data.schedule.days[d];
    if (day?.chapel.includes(grade)) {
      rows.push(h('li', {}, h('a', { class: 'result', href: `#/day/${d}` },
        h('span', { class: 'result-date' }, dateText(d), h('span', { class: 'muted' }, ` · ${relativeDay(d, now)}`)),
        h('span', { class: 'result-main' }, dayTitle(day)))));
    }
  }
  return rows.length ? h('ul', { class: 'plain-list' }, rows) : h('p', { class: 'empty' }, `No chapel for grade ${grade} in the next two weeks.`);
}

function todaysLines(grade) {
  const bulletin = data.today?.posted ? data.today.bulletin : null;
  if (!bulletin) return null;
  const lines = bulletin.schedule.filter((s) => s.grades.includes(grade));
  if (!lines.length) return null;
  return h('section', { class: 'section', 'aria-labelledby': 'lines-h' },
    h('div', { class: 'section-head' }, h('h2', { class: 'label', id: 'lines-h' }, 'On today’s schedule')),
    h('ul', { class: 'lines' }, lines.map((s) => h('li', {},
      s.start ? h('span', { class: 'fy-time' }, clock(s.start, true)) : null, ' ', s.title,
      s.location ? h('span', { class: 'muted' }, ` · ${s.location}`) : null))));
}
