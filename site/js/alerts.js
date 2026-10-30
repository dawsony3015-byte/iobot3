/* Glanceable time, without opening the Today screen.
 *
 *   Tab title   "12:40 · Period 3" while a block is on, so the browser's tab
 *               bar (or the app switcher) shows what's left.
 *   App badge   minutes left, on the home-screen icon of an installed ʻIobot,
 *               where the device supports badges (iPadOS 16.4+, Chrome).
 *   Reminders   a notification 5 minutes before each block ends, if the
 *               student turned them on in Me. These come from the page itself,
 *               so they only fire while ʻIobot is open or installed and
 *               running; reminders with the app fully closed would need a push
 *               server, which Firebase's free plan doesn't include.
 *
 * Runs once a second on every screen. It reads the same statusAt() as Today,
 * so the title and the big countdown can never disagree.
 */

import { data } from './data.js';
import { clock, countdownText } from './format.js';
import { blockTitle, statusAt } from './schedule.js';
import { getSettings } from './store.js';
import { now } from './time.js';

const BASE_TITLE = document.title;
const WARN_SECONDS = 5 * 60;
const warned = new Set();
let badgeShown = null;

export function startAlerts() {
  tick();
  setInterval(tick, 1000);
}

function tick() {
  if (!data.schedule) return;
  const ms = now();
  const status = statusAt(data.schedule, ms);
  const { grade, reminders } = getSettings();
  const counting = status.state === 'block' || status.state === 'lunch' || status.state === 'passing' || status.state === 'before';
  const seconds = Math.ceil((status.to - ms) / 1000);
  const target = status.block || status.next;

  document.title = counting && target ? `${countdownText(seconds)} · ${blockTitle(target, status.day, grade)}` : BASE_TITLE;
  setBadge(counting ? Math.ceil(seconds / 60) : null);

  if (reminders && status.block && seconds <= WARN_SECONDS && seconds > WARN_SECONDS - 5) {
    const key = `${status.date}|${status.block.index}`;
    if (!warned.has(key)) {
      warned.add(key);
      const name = blockTitle(status.block, status.day, grade);
      const next = status.next ? ` Next: ${blockTitle(status.next, status.day, grade)}.` : ' Last block today.';
      notify(`5 minutes left in ${name}`, `${name} ends at ${clock(status.block.end)}.${next}`);
    }
  }
}

function setBadge(minutes) {
  if (!('setAppBadge' in navigator) || minutes === badgeShown) return;
  badgeShown = minutes;
  const done = minutes ? navigator.setAppBadge(minutes) : navigator.clearAppBadge();
  done.catch(() => {
    // Badges are a bonus; a browser that refuses them still shows the title.
    badgeShown = null;
  });
}

/* Show a notification through the service worker when there is one: that's
   the only way phones and iPads allow it. */
async function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const options = { body, icon: 'icons/icon-192.png', badge: 'icons/favicon-32.png', tag: 'iobot-reminder' };
  const registration = await navigator.serviceWorker?.getRegistration();
  if (registration) registration.showNotification(title, options);
  else new Notification(title, options);
}

/* Ask for permission; called from the Me screen's switch, since browsers only
   allow the question right after a tap. Resolves to true if allowed. */
export async function askForNotifications() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  return (await Notification.requestPermission()) === 'granted';
}
