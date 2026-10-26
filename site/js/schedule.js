/* Schedule logic: which day it is, which block we're in, and what comes next.
 *
 * No page code in here, only data in and answers out, so the Playwright tests
 * can call these functions directly. `schedule` is site/data/schedule.json.
 */

import { addDays, epochAt, hst, weekday } from './time.js';

const HOUR = 3600000;

/* The record for a date. Weekends aren't in the feed, so they're made up here. */
export function dayRecord(schedule, date) {
  const day = schedule?.days?.[date];
  if (day) return day;
  const empty = { label: '', labels: [], letter: null, variant: null, tile: null, rotation: [], chapel: [],
    chapel_note: '', special: false, dropped: [], blocks: [] };
  const wd = weekday(date);
  if (wd === 0 || wd === 6) return { ...empty, type: 'weekend', name: wd === 0 ? 'Sunday' : 'Saturday' };
  const inYear = schedule && date >= schedule.first_day && date <= schedule.last_day;
  return { ...empty, type: 'unknown', name: inYear ? 'No school' : 'Not on the school calendar' };
}

export function isClassDay(day) {
  return day.type === 'class';
}

/* The first class day after `date`, as [date, record], or null. */
export function nextClassDay(schedule, date) {
  for (let d = addDays(date, 1), i = 0; i < 120; d = addDays(d, 1), i++) {
    const day = schedule?.days?.[d];
    if (day && isClassDay(day)) return [d, day];
    if (schedule && d > schedule.last_day) break;
  }
  return null;
}

/* "Chapel" or "Homeroom" for the first block, depending on the student's grade.
 * The feed calls it "Homeroom/Chapel" every day; the day's label says which
 * grades have chapel ("(Grs. 9&10 Chapel)"). With no grade chosen we show the
 * feed's own name. */
export function blockTitle(block, day, grade) {
  if (!grade) return block.name;
  const hasChapel = day.chapel.includes(grade);
  if (block.kind === 'homeroom-chapel') return hasChapel ? 'Chapel' : 'Homeroom';
  // A Chapel/Assembly label with no chapel note doesn't say who goes where, so keep both words.
  if (block.kind === 'chapel-assembly' && day.chapel_note) return hasChapel ? 'Chapel' : 'Assembly';
  return block.name;
}

/* The student's class for a period block, or null. */
export function classFor(block, settings) {
  return block.period ? settings.classes[block.period] || null : null;
}

/* 'Period 3 · Chemistry · I-203', or 'Period 4 · Free'. */
export function blockLine(block, day, settings) {
  const c = classFor(block, settings);
  const parts = [blockTitle(block, day, settings.grade)];
  if (c?.free) parts.push('Free');
  else if (c) parts.push(c.name, c.room);
  return parts.filter(Boolean).join(' · ');
}

export function isLunch(block) {
  return block.kind === 'lunch' || block.kind === 'meeting-lunch';
}

/* The day's blocks with their start and end as instants. */
export function timedBlocks(day, date) {
  return day.blocks.map((block, index) => ({
    ...block, index, startAt: epochAt(date, block.start), endAt: epochAt(date, block.end),
  }));
}

/* Everything the Today screen needs to know about one moment.
 *
 * state is one of:
 *   'before'   before the first block (counts down to it)
 *   'block'    inside a block (counts down to its end)
 *   'lunch'    inside lunch
 *   'passing'  between two blocks (counts down to the next one)
 *   'after'    after the last block
 *   'no-times' a class day the feed has no bell times for (PSAT day)
 *   'off'      weekend, holiday, break or exam day
 *
 * `from` and `to` are the instants the progress bar runs between, and `to` is
 * also when this answer stops being true, so the page knows when to ask again.
 */
export function statusAt(schedule, ms) {
  const { date } = hst(ms);
  const day = dayRecord(schedule, date);
  const midnight = epochAt(addDays(date, 1));
  const base = { date, day, blocks: [], block: null, next: null, prev: null };

  if (!isClassDay(day)) {
    return { ...base, state: 'off', back: nextClassDay(schedule, date), from: epochAt(date), to: midnight };
  }
  const blocks = timedBlocks(day, date);
  if (!blocks.length) {
    return { ...base, state: 'no-times', back: nextClassDay(schedule, date), from: epochAt(date), to: midnight };
  }
  const first = blocks[0];
  const last = blocks.reduce((a, b) => (b.endAt > a.endAt ? b : a));
  if (ms < first.startAt) {
    // The bar fills over the last hour before school.
    return { ...base, blocks, state: 'before', next: first, from: first.startAt - HOUR, to: first.startAt };
  }
  if (ms >= last.endAt) {
    return { ...base, blocks, state: 'after', back: nextClassDay(schedule, date), from: last.endAt, to: midnight };
  }
  // If blocks overlap, the one that started most recently is the current one.
  const current = blocks.filter((b) => b.startAt <= ms && ms < b.endAt).pop();
  if (current) {
    const next = blocks.find((b) => b.startAt >= current.endAt) || null;
    return { ...base, blocks, state: isLunch(current) ? 'lunch' : 'block', block: current, next,
      from: current.startAt, to: current.endAt };
  }
  const next = blocks.find((b) => b.startAt > ms);
  const prev = blocks.filter((b) => b.endAt <= ms).pop();
  return { ...base, blocks, state: 'passing', next, prev, from: prev.endAt, to: next.startAt };
}

/* "You're free 4th period. The Wagon opens at 11 and sells out."
 * Returns the free period number when the student has a free period that is
 * still going at 11:00 and starts before lunch, otherwise null. */
export function wagonFreePeriod(day, settings) {
  const lunch = day.blocks.find(isLunch);
  if (!lunch) return null;
  const free = day.blocks.find((b) => b.period && settings.classes[b.period]?.free && b.start < lunch.start && b.end > '11:00');
  return free ? free.period : null;
}

/* A short name for the kind of day: 'B day', 'E1 day · Assembly', 'PSAT day'. */
export function dayTitle(day) {
  if (day.type !== 'class') return day.name;
  const assembly = day.blocks.some((b) => b.kind.includes('assembly'));
  if (day.variant) return `${day.variant} day${assembly ? ' · Assembly' : ''}`;
  return day.name;
}

/* Text for the day tile: 'B', 'E1', 'PSAT', 'SP'. */
export function tileText(day) {
  return day.tile || '';
}
