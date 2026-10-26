/* Time in Honolulu, and the demo clock.
 *
 * Every "what time is it?" in the app goes through now() and hst() here. The
 * school runs on Hawaiʻi time (UTC−10, no daylight saving), so a student whose
 * iPad is still set to California time still sees the right period.
 *
 * Demo mode: ?date=2026-10-21&time=09:00 makes the app act as if it is that
 * moment, and &speed=60 runs the clock 60 times faster.
 */

const ZONE = 'Pacific/Honolulu';
const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/* Wall-clock time in Honolulu for an instant (milliseconds since 1970). */
export function hst(ms = now()) {
  const p = {};
  for (const { type, value } of partsFormat.formatToParts(ms)) p[type] = value;
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour), minute: Number(p.minute), second: Number(p.second) };
}

/* The instant when Honolulu's clocks read `time` on `date`.
   epochAt('2026-10-20', '09:25') is the end of Period 3 that day. */
export function epochAt(date, time = '00:00') {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm, ss = 0] = time.split(':').map(Number);
  const asIfUtc = Date.UTC(y, m - 1, d, hh, mm, ss);
  // Ask Intl what Honolulu's clock says at that instant; the difference is the offset.
  const seen = hst(asIfUtc);
  const [sy, sm, sd] = seen.date.split('-').map(Number);
  const offset = Date.UTC(sy, sm - 1, sd, seen.hour, seen.minute, seen.second) - asIfUtc;
  return asIfUtc - offset;
}

/* Calendar arithmetic on 'YYYY-MM-DD' strings. These are dates, not instants,
   so UTC is used only as a neutral calendar. */
export function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
export function weekday(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
}
export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00Z`) - Date.parse(`${from}T00:00Z`)) / 86400000);
}

/* ---- The clock, real or demo -------------------------------------------- */

export const demo = readDemo(new URLSearchParams(location.search));

function readDemo(params) {
  const date = params.get('date') || '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) return null;
  const time = /^\d{1,2}:\d{2}(:\d{2})?$/.test(params.get('time') || '') ? params.get('time') : '07:30';
  const speed = Math.min(Math.max(Number(params.get('speed')) || 1, 1), 600);
  return { date, time, speed, startAt: epochAt(date, time), startedAt: performance.now() };
}

/* Milliseconds since 1970 for "now". In demo mode the clock starts at the chosen
   moment and runs `speed` times faster. */
export function now() {
  if (!demo) return Date.now();
  return demo.startAt + (performance.now() - demo.startedAt) * demo.speed;
}

export function today() {
  return hst().date;
}
