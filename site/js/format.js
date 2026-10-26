/* Turning times, dates and lists into the short words students read. */

import { daysBetween } from './time.js';

/* '13:45' -> '1:45'. With ampm: '1:45 pm'. */
export function clock(time24, ampm = false) {
  const [h, m] = time24.split(':').map(Number);
  const text = `${h % 12 || 12}:${String(m).padStart(2, '0')}`;
  return ampm ? `${text} ${h >= 12 ? 'pm' : 'am'}` : text;
}

/* Clock time in Honolulu for an instant: '8:12 am'. */
const instantFormat = new Intl.DateTimeFormat('en-US', { timeZone: 'Pacific/Honolulu', hour: 'numeric', minute: '2-digit' });
export function clockAt(ms) {
  return instantFormat.format(ms).replace(' AM', ' am').replace(' PM', ' pm');
}

const formats = {
  long: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'short', day: 'numeric' }),
  short: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }),
  full: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
  month: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }),
  noWeekday: new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }),
};
/* 'Friday, Oct 23' (long), 'Fri, Oct 23' (short), 'Friday, October 23, 2026' (full),
   'October 2026' (month), 'Oct 23, 2026' (noWeekday). */
export function dateText(date, style = 'short') {
  return formats[style].format(Date.parse(`${date}T12:00Z`));
}

/* 'today', 'tomorrow', 'yesterday', or 'in 5 days' / '3 days ago'. */
export function relativeDay(date, from) {
  const n = daysBetween(from, date);
  if (n === 0) return 'today';
  if (n === 1) return 'tomorrow';
  if (n === -1) return 'yesterday';
  return n > 0 ? `in ${n} days` : `${-n} days ago`;
}

/* Seconds left -> '25:00' under an hour, '1:02:03' otherwise. */
export function countdownText(seconds) {
  const s = Math.max(0, seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = String(s % 60).padStart(2, '0');
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${String(minutes).padStart(2, '0')}:${secs}`;
}

/* Spoken version for screen readers: '25 minutes left'. */
export function countdownWords(seconds) {
  const minutes = Math.ceil(seconds / 60);
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h} hour${h > 1 ? 's' : ''}${m ? ` ${m} minutes` : ''}`;
  }
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

/* '6 min ago', '2 hr ago', 'just now'. */
export function ago(ms, nowMs) {
  const minutes = Math.round((nowMs - ms) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/* [7, 8, 1, 2] -> '7 · 8 · 1 · 2' */
export function rotationText(rotation) {
  return rotation.join(' · ');
}

/* [9, 10] -> 'grades 9 and 10'; [11] -> 'grade 11'; 7-12 -> 'all grades'. */
export function gradesText(grades) {
  if (!grades.length) return '';
  if (grades.length === 6) return 'all grades';
  if (grades.length === 1) return `grade ${grades[0]}`;
  const consecutive = grades.every((g, i) => i === 0 || g === grades[i - 1] + 1);
  if (consecutive && grades.length > 2) return `grades ${grades[0]}–${grades[grades.length - 1]}`;
  return `grades ${grades.slice(0, -1).join(', ')} and ${grades[grades.length - 1]}`;
}

/* 4 -> '4th' */
export function ordinal(n) {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
  return `${n}${suffix}`;
}
