/* All clubs, A-Z: #/clubs. Every club the daily bulletin has mentioned. */

import { data } from '../data.js';
import { fill, h } from '../dom.js';
import { dateText, gradesText } from '../format.js';
import { simplify } from '../search-text.js';
import { today } from '../time.js';

export function render(root, { settings }) {
  const clubs = data.clubs?.clubs || [];
  const now = today();
  const groups = new Map();
  for (const club of clubs) {
    // File ʻIolani under I, not under the ʻokina.
    const letter = simplify(club.name).replace(/^[^a-z0-9]+/, '').charAt(0).toUpperCase() || '#';
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(club);
  }

  fill(root,
    h('header', { class: 'page-head' }, h('h1', { class: 'page-title' }, 'All clubs'),
      h('a', { class: 'btn', href: '#/search' }, 'Search')),
    h('p', { class: 'muted' }, data.clubs?.first_archived
      ? `${clubs.length} clubs from the daily bulletin since ${dateText(data.clubs.first_archived, 'noWeekday')}. A club shows up here once the bulletin mentions it.`
      : 'No bulletins have been saved yet.'),
    [...groups].map(([letter, list]) => h('section', { class: 'az-group', 'aria-label': letter },
      h('h2', { class: 'az-letter' }, letter),
      h('ul', { class: 'az-list' }, list.map((club) => {
        const next = club.events.find((e) => e.date >= now);
        return h('li', {}, h('a', { class: 'result', href: `#/club/${club.id}` },
          h('span', { class: 'result-main' }, club.name, settings.follows.includes(club.id) ? h('span', { class: 'pill pill-accent' }, 'Following') : null),
          h('span', { class: 'result-sub' }, [
            club.grades.length ? gradesText(club.grades) : '',
            next ? `Next: ${dateText(next.date)}` : `Last mentioned ${dateText(club.last_seen)}`,
          ].filter(Boolean).join(' · '))));
      })))));
}
