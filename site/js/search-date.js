/* Date search: turns what a student types into dates on the school calendar.
 *
 *   dates            nov 3 · 11/3 · 2026-11-03 · today · tomorrow · monday · next friday
 *   schedule types   next F day · next E1 · next assembly · next chapel · next day off
 *   breaks/holidays  fall break · thanksgiving · christmas break · spring break · finals
 *   counting         days until christmas break · school days until finals
 *
 * searchDates() returns { title, results: [{ date, label, range? }], count? }, or
 * null when the text isn't about dates (then Search tries clubs and the bulletin).
 * Pure functions only, so tests can call them directly.
 */

import { dayRecord, dayTitle, isClassDay } from './schedule.js';
import { addDays, daysBetween, weekday } from './time.js';

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MAX_RESULTS = 6;

/* Named breaks and holidays, and how to recognize their days in the feed. */
const NAMED = [
  { words: /^(fall break)$/, test: (d) => /fall break/i.test(d.name) },
  { words: /^(thanksgiving( break)?)$/, test: (d) => /thanksgiving/i.test(d.name) },
  { words: /^(christmas( break)?|winter break|xmas)$/, test: (d) => /christmas/i.test(d.name) && d.type !== 'class' },
  { words: /^(spring break)$/, test: (d) => /spring break/i.test(d.name) },
  { words: /^(finals|final exams|exams|exam week)$/, test: (d) => d.type === 'exams' },
];

function clean(text) {
  return text.toLowerCase().replace(/[?.!]/g, ' ').replace(/\b(when|is|the|what)\b/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function searchDates(query, schedule, today, grade = null) {
  const q = clean(query);
  if (!q || !schedule) return null;

  const counting = /^(school )?days? (until|till|til|to|before) (.+)$/.exec(q);
  if (counting) return countUntil(counting[3], Boolean(counting[1]), schedule, today, grade);

  const exact = exactDate(q, today);
  if (exact) return { title: 'Date', results: [result(exact, schedule)] };

  const rule = matcher(q.replace(/^next /, ''), grade);
  if (!rule) return null;
  if (rule.named) {
    const runs = namedRuns(rule.test, schedule, today);
    // A word that matched no day name ("chess") isn't a date search at all.
    return runs.length || !rule.guess ? { title: 'Dates', results: runs } : null;
  }
  const results = upcoming(rule.test, schedule, today, q.startsWith('next '));
  return { title: rule.title, results };
}

/* ---- One specific date ---------------------------------------------------- */

export function exactDate(q, today) {
  if (q === 'today') return today;
  if (q === 'tomorrow') return addDays(today, 1);
  if (q === 'yesterday') return addDays(today, -1);
  const day = WEEKDAYS.findIndex((w) => q === w || q === `next ${w}` || q === w.slice(0, 3));
  if (day !== -1) {
    // "friday" is the coming Friday (today counts); "next friday" never means today.
    let ahead = (day - weekday(today) + 7) % 7;
    if (ahead === 0 && q.startsWith('next ')) ahead = 7;
    return addDays(today, ahead);
  }
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(q);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(q);
  if (m) return inSchoolYear(+m[1], +m[2], m[3], today);
  m = /^([a-z]{3,9})\.? (\d{1,2})(?:st|nd|rd|th)?(?:,? (\d{4}))?$/.exec(q) || /^(\d{1,2}) ([a-z]{3,9})$/.exec(q);
  if (m) {
    const [word, num] = /^\d/.test(m[1]) ? [m[2], m[1]] : [m[1], m[2]];
    const month = MONTHS.indexOf(word.slice(0, 3)) + 1;
    if (month && MONTHS[month - 1].startsWith(word.slice(0, 3))) return inSchoolYear(month, +num, m[3], today);
  }
  return null;
}

/* A month/day without a year means this school year: August-December is the
   first calendar year, January-July the second. */
function inSchoolYear(month, day, year, today) {
  if (year) return valid(year.length === 2 ? 2000 + Number(year) : Number(year), month, day);
  const [ty, tm] = today.split('-').map(Number);
  const start = tm >= 7 ? ty : ty - 1;
  return valid(month >= 7 ? start : start + 1, month, day);
}

function valid(y, m, d) {
  const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return addDays(date, 0) === date ? date : null; // rejects Feb 30 and friends
}

/* ---- Kinds of days -------------------------------------------------------- */

function matcher(q, grade) {
  const named = NAMED.find((n) => n.words.test(q));
  if (named) return { named: true, test: named.test };

  const letter = /^([a-f])([1-3])?( day| schedule)?$/.exec(q);
  if (letter) {
    const wanted = letter[1].toUpperCase() + (letter[2] || '');
    // "F day" means any F rotation (F, F1, F2…); "E1" means exactly E1.
    return { title: `${wanted} days`, test: (d) => (letter[2] ? d.variant === wanted : d.letter === wanted) };
  }
  if (/^(assembly|assemblies)( day)?$/.test(q)) {
    return { title: 'Assembly days', test: (d) => d.blocks.some((b) => b.kind.includes('assembly')) };
  }
  if (/^chapel( day)?$/.test(q)) {
    return grade
      ? { title: `Chapel days, grade ${grade}`, test: (d) => d.chapel.includes(grade) }
      : { title: 'Chapel days', test: (d) => d.chapel.length > 0 };
  }
  if (/^(day off|days off|no school|holiday|break)$/.test(q)) {
    return { title: 'Days off', test: (d) => d.type === 'no-school' };
  }
  if (/^(special|special schedule|special day)$/.test(q)) {
    return { title: 'Special schedules', test: (d) => d.type === 'class' && d.special };
  }
  // Anything else that names a day in the feed: "psat", "veterans day", "good friday".
  if (q.length >= 3 && !/^\d+$/.test(q)) {
    return { named: true, guess: true,
      test: (d) => d.name.toLowerCase().includes(q) || d.labels.some((l) => l.toLowerCase().includes(q)) };
  }
  return null;
}

function sortedDates(schedule) {
  return Object.keys(schedule.days).sort();
}

/* The next few dates that pass `test`, starting today (or tomorrow for "next …"). */
function upcoming(test, schedule, today, strictlyAfter) {
  return sortedDates(schedule)
    .filter((d) => (strictlyAfter ? d > today : d >= today) && test(schedule.days[d]))
    .slice(0, MAX_RESULTS)
    .map((d) => result(d, schedule));
}

/* Runs of consecutive matching days ("Fall Break, Oct 13-16"). Upcoming runs
   come first; if there are none left this year, the most recent past one. */
function namedRuns(test, schedule, today) {
  const runs = [];
  for (const date of sortedDates(schedule)) {
    if (!test(schedule.days[date])) continue;
    const last = runs[runs.length - 1];
    // Weekends sit inside breaks, so a gap of up to 3 days still continues a run.
    if (last && daysBetween(last.end, date) <= 3) last.end = date;
    else runs.push({ start: date, end: date });
  }
  const future = runs.filter((r) => r.end >= today);
  const chosen = future.length ? future : runs.slice(-1);
  return chosen.slice(0, MAX_RESULTS).map((r) => ({ ...result(r.start, schedule), range: r.end !== r.start ? r.end : null }));
}

function result(date, schedule) {
  const day = dayRecord(schedule, date);
  return { date, label: isClassDay(day) || day.type === 'exams' || day.type === 'no-school' ? dayTitle(day) : day.name, day };
}

/* ---- Counting ------------------------------------------------------------- */

function countUntil(target, schoolDaysOnly, schedule, today, grade) {
  const found = exactDate(target, today) ? { results: [result(exactDate(target, today), schedule)] }
    : searchDates(target, schedule, today, grade);
  const hit = found?.results.find((r) => r.date > today) || found?.results[0];
  if (!hit) return { title: 'Counting', results: [], count: null };
  let n = daysBetween(today, hit.date);
  if (schoolDaysOnly) {
    n = sortedDates(schedule).filter((d) => d > today && d < hit.date && isClassDay(schedule.days[d])).length;
  }
  return { title: 'Counting', results: [hit], count: { n, unit: schoolDaysOnly ? 'school day' : 'day', target: hit } };
}
