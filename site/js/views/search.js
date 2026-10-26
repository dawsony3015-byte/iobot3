/* Search: one box for dates, clubs and the bulletin archive. #/search?q=psat
 *
 * Results update as you type. The first result is selected, so Enter jumps
 * straight to it; the arrow keys move the selection. The address keeps the
 * query, so a search can be shared and the back button returns to it.
 */

import { data, load } from '../data.js';
import { fill, h } from '../dom.js';
import { clock, dateText, gradesText } from '../format.js';
import { searchClubs } from '../search-clubs.js';
import { searchDates } from '../search-date.js';
import { searchBulletins } from '../search-text.js';
import { today } from '../time.js';

const EXAMPLES = ['next F day', 'fall break', 'next chapel', 'days until christmas break', 'chess', 'yearbook photo', 'pā'];

export function render(root, { route, settings }) {
  const input = h('input', {
    class: 'field field-big', type: 'search', value: route.query.get('q') || '', autocomplete: 'off',
    placeholder: 'Dates, clubs, or anything in the bulletin', 'aria-label': 'Search', enterkeyhint: 'go',
    'aria-controls': 'search-results',
  });
  const results = h('div', { class: 'results', id: 'search-results', 'aria-live': 'polite' });
  let timer = 0;
  let run = 0;

  const update = async () => {
    const q = input.value.trim();
    history.replaceState(null, '', q ? `#/search?q=${encodeURIComponent(q)}` : '#/search');
    const mine = ++run;
    if (!q) {
      fill(results, suggestions(settings));
      return;
    }
    const dates = searchDates(q, data.schedule, today(), settings.grade);
    const clubs = searchClubs(q, data.clubs?.clubs).slice(0, 6);
    fill(results, dateSection(dates), clubSection(clubs), h('p', { class: 'empty' }, 'Searching the bulletin…'));
    const archive = await load('data/announcements.json');
    if (mine !== run) return; // the student kept typing
    const hits = searchBulletins(q, archive);
    fill(results, dateSection(dates), clubSection(clubs), bulletinSection(hits, archive));
    if (!dates?.results.length && !clubs.length && !hits.length) {
      fill(results, h('p', { class: 'empty' }, `Nothing found for “${q}”. Try a date like “nov 3”, a club name, or a word from the bulletin.`));
    }
    select(results, 0);
  };

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(update, 120);
  });
  input.addEventListener('keydown', (e) => {
    const rows = [...results.querySelectorAll('.result')];
    const at = rows.findIndex((r) => r.classList.contains('is-selected'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      select(results, Math.max(0, Math.min(rows.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Enter' && rows[at]) {
      rows[at].click();
    }
  });

  fill(root, h('h1', { class: 'page-title' }, 'Search'), h('div', { class: 'search-box' }, input), results);
  update();
  // Focus the box, except on touch screens where it would pop the keyboard open uninvited.
  if (matchMedia('(hover: hover)').matches) input.focus();
}

function select(container, index) {
  container.querySelectorAll('.result').forEach((row, i) => {
    row.classList.toggle('is-selected', i === index);
    if (i === index) row.setAttribute('aria-current', 'true');
    else row.removeAttribute('aria-current');
  });
}

function section(title, ...body) {
  return h('section', { class: 'result-group' }, h('h2', { class: 'label section-head' }, title), body);
}

function dateSection(found) {
  if (!found?.results.length) return null;
  const count = found.count;
  return section(found.title,
    count ? h('p', { class: 'count' },
      h('span', { class: 'count-n' }, count.n), ` ${count.unit}${count.n === 1 ? '' : 's'} until `,
      h('strong', {}, found.results[0].label), ` (${dateText(found.results[0].date)})`) : null,
    found.results.map((r) => h('a', { class: 'result', href: `#/day/${r.date}` },
      h('span', { class: 'result-date' }, dateText(r.date), r.range ? ` – ${dateText(r.range)}` : ''),
      h('span', { class: 'result-main' }, r.label))));
}

function clubSection(clubs) {
  if (!clubs.length) return null;
  const now = today();
  return section('Clubs', clubs.map((club) => {
    const next = club.events.find((e) => e.date >= now);
    const detail = next ? `Next: ${dateText(next.date)}${next.time ? `, ${next.time}` : ''}${next.location ? `, ${next.location}` : ''}`
      : `Last in the bulletin ${dateText(club.last_seen)}`;
    return h('a', { class: 'result', href: `#/club/${club.id}` },
      h('span', { class: 'result-main' }, club.name),
      h('span', { class: 'result-sub' }, [club.grades.length ? gradesText(club.grades) : '', detail].filter(Boolean).join(' · ')));
  }));
}

function bulletinSection(hits, archive) {
  if (!hits.length) return null;
  return section(`In the bulletin${archive?.first_archived ? ` since ${dateText(archive.first_archived, 'noWeekday')}` : ''}`,
    hits.map((hit) => h('a', { class: 'result result-text', href: `#/day/${hit.date}` },
      h('span', { class: 'result-date' }, dateText(hit.date), hit.dates?.length > 1 ? ` · ran ${hit.dates.length} days` : '',
        hit.kind === 'line' && hit.start ? ` · ${clock(hit.start, true)}` : ''),
      h('span', { class: 'result-main' }, marked(hit.title, hit.ranges.title)),
      hit.text ? h('span', { class: 'result-sub' }, marked(...snippet(hit.text, hit.ranges.text))) : null)));
}

/* Text with <mark> around each matched range. */
export function marked(text, ranges) {
  const parts = [];
  let at = 0;
  for (const [start, end] of ranges) {
    if (start < at) continue; // overlapping matches: the first one wins
    parts.push(text.slice(at, start), h('mark', {}, text.slice(start, end)));
    at = end;
  }
  parts.push(text.slice(at));
  return parts;
}

/* About 160 characters around the first match, so long announcements stay short. */
function snippet(text, ranges) {
  if (text.length <= 180) return [text, ranges];
  const start = Math.max(0, (ranges[0]?.[0] ?? 0) - 60);
  const cut = text.slice(start, start + 170);
  const shifted = ranges.map(([a, b]) => [a - start, b - start]).filter(([a, b]) => a >= 0 && b <= cut.length);
  const lead = start > 0 ? '…' : '';
  return [`${lead}${cut}…`, shifted.map(([a, b]) => [a + lead.length, b + lead.length])];
}

function suggestions(settings) {
  const grades = [7, 8, 9, 10, 11, 12];
  return [
    section('Try',
      h('div', { class: 'chips' }, EXAMPLES.map((q) => h('a', { class: 'chip', href: `#/search?q=${encodeURIComponent(q)}` }, q)))),
    section('Grades',
      h('div', { class: 'chips' }, grades.map((g) => h('a', { class: `chip${settings.grade === g ? ' is-mine' : ''}`, href: `#/grade/${g}` }, `Grade ${g}`)))),
    section('Clubs',
      h('a', { class: 'result', href: '#/clubs' }, h('span', { class: 'result-main' }, 'All clubs, A–Z'),
        h('span', { class: 'result-sub' }, `${data.clubs?.clubs.length || 0} clubs found in the daily bulletin so far`))),
  ];
}

