/* The month calendar: #/calendar or #/calendar/2026-11.
 *
 * Only Monday-Friday are drawn, since school never meets on weekends. Each
 * school day shows its letter; special schedules get a small red corner, days
 * off are grayed (their name shows on hover, and in full on wider screens),
 * and chapel days for the student's grade get a dot. Tapping a day opens it.
 * A date search box at the top jumps anywhere ("next F day", "nov 3").
 */

import { data } from '../data.js';
import { fill, h, icon } from '../dom.js';
import { dateText } from '../format.js';
import { searchDates } from '../search-date.js';
import { dayRecord, dayTitle, isClassDay } from '../schedule.js';
import { addDays, today, weekday } from '../time.js';

export function render(root, { route, settings }) {
  const now = today();
  const month = /^\d{4}-\d{2}$/.test(route.args[0] || '') ? route.args[0] : now.slice(0, 7);
  const results = h('div', { class: 'jump-results', id: 'jump-results' });
  const input = h('input', {
    class: 'field', type: 'search', placeholder: 'Jump to a date: next F day, nov 3, spring break',
    'aria-label': 'Jump to a date', 'aria-controls': 'jump-results', autocomplete: 'off', enterkeyhint: 'go',
  });
  let first = null;
  input.addEventListener('input', () => {
    const found = searchDates(input.value, data.schedule, now, settings.grade);
    first = found?.results[0] || null;
    fill(results, found ? found.results.map((r, i) => h('a', { class: `jump-row${i === 0 ? ' is-selected' : ''}`, href: `#/day/${r.date}` },
      h('span', { class: 'jump-date' }, dateText(r.date)), h('span', { class: 'muted' }, r.label))) : null);
    if (found && !found.results.length) fill(results, h('p', { class: 'empty' }, 'No matching days this school year.'));
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && first) location.hash = `#/day/${first.date}`;
  });

  fill(root,
    h('header', { class: 'page-head' },
      h('h1', { class: 'page-title' }, dateText(`${month}-01`, 'month')),
      h('nav', { class: 'month-nav', 'aria-label': 'Months' },
        h('a', { class: 'btn', href: `#/calendar/${shiftMonth(month, -1)}`, 'aria-label': 'Previous month' }, icon('left')),
        h('a', { class: 'btn', href: `#/calendar/${shiftMonth(month, 1)}`, 'aria-label': 'Next month' }, icon('right')),
        month !== now.slice(0, 7) ? h('a', { class: 'btn', href: '#/calendar' }, 'This month') : null)),
    h('div', { class: 'jump' }, input, results),
    grid(month, now, settings.grade),
    legend(settings.grade));
}

function grid(month, now, grade) {
  const cells = [];
  // Blank cells push the 1st under its weekday. A month starting on a weekend
  // needs none: its first school day is a Monday.
  let d = `${month}-01`;
  const pad = weekday(d) >= 1 && weekday(d) <= 5 ? weekday(d) - 1 : 0;
  for (let i = 0; i < pad; i++) cells.push(h('span', { class: 'cal-cell is-blank', 'aria-hidden': 'true' }));
  for (; d.startsWith(month); d = addDays(d, 1)) {
    const wd = weekday(d);
    if (wd === 0 || wd === 6) continue;
    cells.push(cell(d, dayRecord(data.schedule, d), now, grade));
  }
  return h('div', { class: 'cal', role: 'grid', 'aria-label': `School days in ${dateText(`${month}-01`, 'month')}` },
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((w) => h('span', { class: 'cal-head', role: 'columnheader' }, w)),
    cells);
}

function cell(date, day, now, grade) {
  const classDay = isClassDay(day);
  const chapel = grade ? day.chapel.includes(grade) : false;
  const kind = classDay ? 'is-class' : day.type === 'unknown' ? 'is-unknown' : 'is-off';
  const words = [dateText(date, 'long'), classDay ? dayTitle(day) : day.name];
  if (chapel) words.push(`chapel for grade ${grade}`);
  return h('a', {
    class: `cal-cell ${kind}${day.special || day.type === 'exams' ? ' is-special' : ''}${date === now ? ' is-today' : ''}${date < now ? ' is-past' : ''}`,
    href: `#/day/${date}`, title: classDay ? day.label : day.name, 'aria-label': words.join(', '),
  },
  h('span', { class: 'cal-num' }, Number(date.slice(8))),
  classDay ? h('span', { class: `cal-letter${(day.tile || '').length > 2 ? ' is-small' : ''}` }, day.tile || '') : null,
  !classDay && day.type !== 'unknown' ? h('span', { class: 'cal-name' }, day.type === 'exams' ? 'Exams' : day.name) : null,
  chapel ? h('span', { class: 'cal-dot', 'aria-hidden': 'true' }) : null);
}

function legend(grade) {
  return h('ul', { class: 'legend', 'aria-label': 'Key' },
    h('li', {}, h('span', { class: 'key key-special', 'aria-hidden': 'true' }), 'Special schedule'),
    h('li', {}, h('span', { class: 'key key-off', 'aria-hidden': 'true' }), 'No school'),
    grade ? h('li', {}, h('span', { class: 'key key-dot', 'aria-hidden': 'true' }), `Chapel for grade ${grade}`)
      : h('li', {}, h('a', { href: '#/me' }, 'Pick your grade'), ' to see your chapel days'));
}

function shiftMonth(month, by) {
  const [y, m] = month.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1 + by, 1));
  return date.toISOString().slice(0, 7);
}
