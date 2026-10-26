/* One club: #/club/chess-club.
 *
 * Name, grades, next meeting (if the bulletin gave one), a Follow button, and
 * every bulletin mention, newest first. It says plainly where the information
 * comes from and when a club hasn't been mentioned in a while.
 */

import { data, load } from '../data.js';
import { fill, h } from '../dom.js';
import { dateText, daysAgoText, gradesText, relativeDay } from '../format.js';
import { getSettings, toggleFollow } from '../store.js';
import { daysBetween, today } from '../time.js';

const QUIET_AFTER_DAYS = 30;

export function render(root, { route }) {
  const id = route.args[0] || '';
  const club = data.clubs?.clubs.find((c) => c.id === id);
  if (!club) {
    fill(root, h('h1', { class: 'page-title' }, 'Club not found'),
      h('p', { class: 'empty' }, 'The daily bulletin hasn’t mentioned a club by that name. ', h('a', { href: '#/clubs' }, 'See all clubs.')));
    return;
  }
  const now = today();
  const next = club.events.find((e) => e.date >= now);
  const quiet = daysBetween(club.last_seen, now) > QUIET_AFTER_DAYS;
  const mentions = h('div', {}, h('p', { class: 'empty' }, 'Loading mentions…'));

  const follow = h('button', { class: 'btn', type: 'button' });
  const paintFollow = () => {
    const on = getSettings().follows.includes(club.id);
    follow.setAttribute('aria-pressed', String(on));
    follow.textContent = on ? 'Following' : 'Follow';
  };
  follow.addEventListener('click', () => {
    toggleFollow(club.id);
    paintFollow();
  });
  paintFollow();

  fill(root,
    h('p', {}, h('a', { href: '#/clubs' }, 'All clubs')),
    h('header', { class: 'page-head' },
      h('div', {}, h('h1', { class: 'page-title' }, club.name),
        h('p', { class: 'muted' }, club.grades.length ? `For ${gradesText(club.grades)}` : 'Grades not listed in the bulletin')),
      follow),
    h('section', { class: 'next-meeting' },
      h('h2', { class: 'label' }, 'Next meeting'),
      next ? [
        h('p', { class: 'next-when' }, dateText(next.date, 'long'), h('span', { class: 'muted' }, ` · ${relativeDay(next.date, now)}`)),
        h('p', { class: 'next-where' }, [next.time, next.location].filter(Boolean).join(' · ') || 'Time and place not given'),
        h('p', { class: 'muted small' }, next.what),
      ] : h('p', { class: 'muted' }, 'The bulletin hasn’t announced the next meeting.')),
    quiet ? h('p', { class: 'notice' }, `No mentions in the last ${QUIET_AFTER_DAYS} days. Last seen ${daysAgoText(club.last_seen, now)}.`) : null,
    h('section', { class: 'section', 'aria-labelledby': 'mentions-h' },
      h('div', { class: 'section-head' }, h('h2', { class: 'label', id: 'mentions-h' }, `Bulletin mentions (${club.mention_count})`)),
      h('p', { class: 'muted small source-note' }, `From the daily bulletin since ${dateText(data.clubs.first_archived, 'noWeekday')}.`),
      mentions));

  load(`data/clubs/${club.id}.json`).then((page) => {
    if (!mentions.isConnected) return;
    if (!page) {
      fill(mentions, h('p', { class: 'empty' }, 'The mentions didn’t load. Check your connection.'));
      return;
    }
    fill(mentions, h('ol', { class: 'mentions' }, page.mentions.map((m) => h('li', { class: 'mention' },
      h('a', { class: 'mention-date', href: `#/day/${m.date}` }, dateText(m.date)),
      h('p', {}, m.text),
      m.source === 'schedule' ? h('span', { class: 'pill' }, 'Today’s schedule') : null))));
  });
}
