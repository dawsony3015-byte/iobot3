/* The Today screen: the day tile, the Now card, today's blocks, lunch, and
 * announcements for the student's grade and clubs.
 *
 * One animation-frame loop drives the screen. Each frame it updates the
 * countdown and progress bar; when the current status runs out (a block ends,
 * passing time ends, midnight), it asks schedule.js for the next status and
 * updates only the parts that change.
 */

import { runFrames } from '../countdown.js';
import { data, load } from '../data.js';
import { fill, h } from '../dom.js';
import { ago, clock, clockAt, dateText, ordinal } from '../format.js';
import { dayTitle, isClassDay, statusAt, wagonFreePeriod } from '../schedule.js';
import { demo, hst, now, weekday } from '../time.js';
import { announcement, chapelText, foodList, tile as dayTile } from './day-parts.js';
import { NowCard } from './now.js';
import { markTimeline, timeline } from './timeline.js';

export function render(root, { settings }) {
  let status = statusAt(data.schedule, now());
  let parts = build(root, status, settings);

  const stop = runFrames(now, (ms, woke) => {
    if (ms >= status.to || woke) {
      const next = statusAt(data.schedule, ms);
      if (next.date !== status.date) {
        status = next;
        parts = build(root, status, settings); // a new day: draw everything again
        return;
      }
      if (ms >= status.to) parts.card.show(next, ms, settings, parts.foodList(), !woke);
      status = next;
      mark(parts, status, ms);
    }
    parts.card.tick(status, ms, !woke);
  });
  return stop;
}

function build(root, status, settings) {
  const { day, date } = status;
  const card = new NowCard();
  const tl = day.blocks.length ? timeline(day, settings, { live: true }) : null;
  const lunch = h('div', { class: 'lunch-list' });
  const forYou = h('div', { class: 'for-you' });
  const head = header(status, settings);

  const parts = { card, tl, head, foodList: () => null };
  fill(root,
    staleNotice(),
    disagreement(date),
    head.el,
    card.el,
    h('div', { class: 'today-grid' },
      tl ? h('section', { class: 'section today-blocks', 'aria-labelledby': 'blocks-h' },
        h('div', { class: 'section-head' }, h('h2', { class: 'label', id: 'blocks-h' }, 'Today’s blocks'),
          h('a', { href: `#/day/${date}` }, 'Full day')),
        day.dropped.length ? h('p', { class: 'note' }, `No Period ${day.dropped.join(' or ')} today.`) : null,
        tl.el) : null,
      h('div', { class: 'today-side' },
        isClassDay(day) ? h('section', { class: 'section', 'aria-labelledby': 'lunch-h' },
          h('div', { class: 'section-head' }, h('h2', { class: 'label', id: 'lunch-h' }, 'Lunch')), lunch) : null,
        h('section', { class: 'section', 'aria-labelledby': 'foryou-h' },
          h('div', { class: 'section-head' },
            h('h2', { class: 'label', id: 'foryou-h' }, settings.grade ? `For you · Grade ${settings.grade}` : 'For you'),
            settings.grade ? h('a', { href: `#/grade/${settings.grade}` }, 'Grade page') : null),
          forYou))),
    freshness(),
  );

  const ms = now();
  card.show(status, ms, settings, null, false);
  mark(parts, status, ms);

  // The bulletin for this date: today.json normally, or the archive in demo mode.
  bulletinFor(date).then((bulletin) => {
    if (!lunch.isConnected) return;
    fill(lunch, lunchRows(bulletin, day, date, settings));
    fill(forYou, forYouItems(bulletin, settings));
    parts.foodList = () => foodList(bulletin, true);
    if (status.state === 'lunch') card.show(status, now(), settings, parts.foodList(), false);
  });
  return parts;
}

function mark(parts, status, ms) {
  if (parts.tl) markTimeline(parts.tl, status, ms);
  parts.head.mark(status);
}

/* ---- Header: date, day tile, rotation, chapel ----------------------------- */

function header(status, settings) {
  const { day, date } = status;
  const chapel = chapelText(day, settings.grade);
  const tile = dayTile(day);
  const strip = day.rotation.map((p) => h('span', { class: 'rot-p', 'data-period': p }, p));
  const el = h('header', { class: 'day-head' },
    tile,
    h('div', { class: 'day-head-text' },
      h('h1', { class: 'day-date' }, dateText(date, 'long')),
      h('p', { class: 'day-sub' },
        isClassDay(day) ? dayTitle(day) : '',
        chapel ? h('span', { class: 'chapel' }, chapel) : null),
      strip.length ? h('p', { class: 'rot', 'aria-label': `Period order ${day.rotation.join(', ')}` }, strip) : null),
    data.offline ? h('span', { class: 'pill offline-tag' }, 'Offline') : null);

  return {
    el,
    // Light up the period we're in and dim the ones that are done.
    mark(s) {
      tile?.classList.toggle('is-done', s.state === 'after');
      const done = new Set(s.blocks.filter((b) => b.period && b.endAt <= now()).map((b) => b.period));
      for (const span of strip) {
        const p = Number(span.dataset.period);
        span.classList.toggle('is-current', s.block?.period === p);
        span.classList.toggle('is-done', done.has(p) && s.block?.period !== p);
      }
    },
  };
}

/* ---- Lunch ---------------------------------------------------------------- */

async function bulletinFor(date) {
  if (data.today?.date === date) return data.today.posted ? data.today.bulletin : null;
  return load(`data/bulletins/${date}.json`);
}

function lunchRows(bulletin, day, date, settings) {
  if (!bulletin) {
    const isRealToday = !demo && date === data.today?.date;
    return [h('p', { class: 'empty' }, isRealToday ? 'Today’s bulletin isn’t posted yet.' : 'No bulletin was saved for this day.')];
  }
  const free = bulletin.food.wagon ? wagonFreePeriod(day, settings) : null;
  return [
    foodList(bulletin) || h('p', { class: 'empty' }, 'The bulletin didn’t list lunch today.'),
    free ? h('p', { class: 'tip' }, `You’re free ${ordinal(free)} period. The Wagon opens at 11 and sells out.`) : null,
  ];
}

/* ---- For you: my grade's announcements and my clubs ----------------------- */

function forYouItems(bulletin, settings) {
  const { grade, follows } = settings;
  if (!grade && !follows.length) {
    return [h('p', { class: 'empty' }, 'Pick your grade in ', h('a', { href: '#/me' }, 'Me'), ' to see announcements for you.')];
  }
  if (!bulletin) return [h('p', { class: 'empty' }, 'Nothing yet. Announcements show up when the bulletin is posted.')];
  const mine = bulletin.items.filter((item) =>
    (grade && !item.everyone && item.grades.includes(grade)) || (item.club && follows.includes(item.club)));
  const lines = bulletin.schedule.filter((line) =>
    (grade && line.grades.includes(grade)) || (line.club && follows.includes(line.club)));
  if (!mine.length && !lines.length) {
    return [h('p', { class: 'empty' }, grade ? `Nothing for grade ${grade} today.` : 'Nothing from your clubs today.')];
  }
  return [
    ...lines.map((line) => h('p', { class: 'fy-line' },
      h('span', { class: 'fy-time' }, line.start ? clock(line.start, true) : ''),
      ' ', line.title, line.location ? h('span', { class: 'muted' }, ` · ${line.location}`) : null)),
    ...mine.map((item) => announcement(item, item.club ? 'Your club' : item.section)),
  ];
}

/* ---- Notices: bulletin disagrees, data is old, freshness line ----------- */

/* The calendar feed is the source of truth, but if today's bulletin lists a
   different letter or period order, students should know to double-check. */
function disagreement(date) {
  const check = data.today?.date === date ? data.today.check : null;
  if (!check || check.agrees) return null;
  return h('p', { class: 'notice', role: 'status' },
    `Today’s bulletin lists ${check.bulletin}, but the school calendar says ${check.feed}. `
    + 'Times here follow the calendar. Ask a teacher if you’re unsure.');
}

function freshness() {
  const s = data.schedule;
  const t = data.today;
  const real = Date.now();
  const bits = [];
  if (t?.posted && t.bulletin) bits.push(`Bulletin ${clockAt(Date.parse(t.bulletin.updated_at))}`);
  if (s) bits.push(`Schedule synced ${ago(Date.parse(s.generated_at), real)}`);
  return h('p', { class: 'freshness' }, bits.join(' · '),
    s?.source === 'fixture' ? h('span', { class: 'pill', title: 'No live feed URL is set in config.json yet' }, 'Test calendar') : null);
}

/* "If the data is more than 2 hours old during school hours, show a clear but
   calm notice." School hours here are 6:00 am to 6:45 pm on weekdays. */
function staleNotice() {
  const s = data.schedule;
  if (!s || demo) return null;
  const real = Date.now();
  const hours = (real - Date.parse(s.generated_at)) / 3600000;
  const { date, hour, minute } = hst(real);
  const minutes = hour * 60 + minute;
  const schoolHours = weekday(date) >= 1 && weekday(date) <= 5 && minutes >= 6 * 60 && minutes <= 18 * 60 + 45;
  if (hours < 2 || !schoolHours) return null;
  return h('p', { class: 'notice', role: 'status' },
    `The schedule last synced ${ago(Date.parse(s.generated_at), real)}. It’s probably still right, but if today looks off, check the bulletin.`);
}
