/* Pieces shared by the screens that show a day: the day tile and header, the
 * bulletin's lunch and announcements, and the month grid's day cells.
 */

import { h } from '../dom.js';
import { gradesText, rotationText } from '../format.js';
import { dayTitle, isClassDay } from '../schedule.js';

export const FOOD = [['wagon', 'One Team Wagon'], ['dining_hall', 'ASC Dining Hall'], ['snack_bar', 'Weinberg Snack Bar']];

/* The big square day letter. */
export function tile(day, extraClass = '') {
  if (!day.tile) return null;
  return h('div', { class: `tile tile-${day.tile.length} ${extraClass}`.trim(), 'aria-hidden': 'true' }, day.tile);
}

/* 'Chapel today, grade 9', or for no grade chosen 'Chapel for grades 9 and 10'. */
export function chapelText(day, grade, when = 'today') {
  if (grade) return day.chapel.includes(grade) ? `Chapel ${when}, grade ${grade}` : '';
  return day.chapel.length ? `Chapel for ${gradesText(day.chapel)}` : '';
}

/* What kind of day it is, in a few words, for lists and calendar cells. */
export function dayLine(day) {
  if (!isClassDay(day)) return day.name;
  const rotation = day.rotation.length ? ` · ${rotationText(day.rotation)}` : '';
  return `${dayTitle(day)}${rotation}`;
}

/* The bulletin's lunch as a definition list. */
export function foodList(bulletin, compact = false) {
  if (!bulletin) return null;
  const rows = FOOD.filter(([key]) => bulletin.food[key])
    .map(([key, place]) => h('div', { class: 'food-row' }, h('dt', {}, place), h('dd', {}, bulletin.food[key])));
  return rows.length ? h('dl', { class: `food${compact ? ' food-compact' : ''}` }, rows) : null;
}

/* One bulletin announcement that opens to its full text. */
export function announcement(item, meta) {
  return h('details', { class: 'fy-item' },
    h('summary', {}, h('span', { class: 'fy-title' }, item.title || item.section),
      h('span', { class: 'fy-meta' }, meta ?? item.section)),
    h('p', {}, item.text),
    item.club ? h('a', { href: `#/club/${item.club}` }, 'Club page') : null);
}
