/* Anonymous usage counts, so the team can see how ʻIobot is used.
 *
 * What is sent: only daily totals, like "Today screen opened +3" or "search
 * used +1", added to one shared document per day (stats/2026-11-03) in the
 * project's Firestore database. Nothing identifies a student: no names, no
 * IDs, no cookies, no device fingerprint, no search text, no class names.
 *
 * How: counts pile up in memory and are sent as a single write every few
 * minutes and when the student leaves the page. One write per flush keeps a
 * whole school's use far under Firestore's free daily limit.
 *
 * Off when the student turns off "Share anonymous usage counts" in Me, when the
 * browser sends Global Privacy Control or Do Not Track, in demo mode, and when
 * running locally.
 */

import { getSettings } from './store.js';
import { demo, today } from './time.js';

const PROJECT = 'iobot3';
const ENDPOINT = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`;
const FLUSH_EVERY = 3 * 60 * 1000;

// Every counter name the app may send. firestore.rules allows exactly these.
export const COUNTERS = {
  visits: 'App opened', refreshes: 'Data checked for updates', updates: 'New data arrived',
  installed: 'Opened from the home screen',
  'views.today': 'Today', 'views.calendar': 'Calendar', 'views.day': 'Day page', 'views.search': 'Search',
  'views.clubs': 'All clubs', 'views.club': 'Club page', 'views.grade': 'Grade page', 'views.me': 'Me',
  'features.search_date': 'Date search', 'features.search_club': 'Club search', 'features.search_text': 'Bulletin search',
  'features.follow': 'Followed a club', 'features.reminders_on': 'Turned on reminders',
  'features.import_classes': 'Pasted a schedule', 'features.todo_add': 'Added a to-do', 'features.todo_done': 'Finished a to-do',
  'features.compact_on': 'Switched to compact', 'features.setup_export': 'Copied setup code', 'features.setup_import': 'Used a setup code',
  'devices.phone': 'Phone', 'devices.tablet': 'iPad / tablet', 'devices.desktop': 'Laptop / desktop',
  'settings.grade_set': 'Has a grade set', 'settings.dark': 'Black theme', 'settings.light': 'White theme',
  'settings.compact': 'Compact layout', 'settings.large_text': 'Large text', 'settings.high_contrast': 'High contrast',
};

const pending = new Map();
let started = false;

function allowed() {
  if (demo || !getSettings().shareUsage) return false;
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return false;
  return !/^(localhost|127\.|\[::1\])/.test(location.hostname);
}

/* Add one to a counter, e.g. count('features.follow'). */
export function count(name) {
  if (!COUNTERS[name] || !allowed()) return;
  pending.set(name, (pending.get(name) || 0) + 1);
}

/* Record the visit itself and start sending. Called once by app.js. */
export function startUsage() {
  if (started) return;
  started = true;
  const s = getSettings();
  count('visits');
  if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) count('installed');
  count(innerWidth < 700 ? 'devices.phone' : innerWidth < 1100 ? 'devices.tablet' : 'devices.desktop');
  if (s.grade) count('settings.grade_set');
  count(s.theme === 'light' ? 'settings.light' : 'settings.dark');
  if (s.layout === 'compact') count('settings.compact');
  if (s.textSize === 'large') count('settings.large_text');
  if (s.contrast === 'high') count('settings.high_contrast');
  setInterval(flush, FLUSH_EVERY);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}

/* Send what has piled up as one write, then start over. */
function flush() {
  if (!pending.size || !allowed()) {
    pending.clear();
    return;
  }
  const fieldTransforms = [...pending].map(([fieldPath, n]) => ({ fieldPath, increment: { integerValue: String(n) } }));
  pending.clear();
  const document = `projects/${PROJECT}/databases/(default)/documents/stats/${today()}`;
  fetch(ENDPOINT, {
    method: 'POST',
    keepalive: true, // still sent if the student is closing the page
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes: [{ transform: { document, fieldTransforms } }] }),
  }).catch(() => {
    // Offline or blocked: these counts are dropped. The app never depends on them.
  });
}
