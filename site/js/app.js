/* Start-up and navigation.
 *
 * Every screen has its own address (#/today, #/day/2026-10-20, #/club/chess-club,
 * #/grade/10, #/search?q=psat, #/me), so links can be shared and the back
 * button works. Each screen lives in js/views/ and exports render(root, ctx),
 * which may return a cleanup function for when the student leaves the screen.
 */

import { startAlerts } from './alerts.js';
import { data, onData, refresh, startAutoRefresh } from './data.js';
import { fadeIn, h } from './dom.js';
import { clock, dateText } from './format.js';
import { getSettings, onSettings } from './store.js';
import { demo, hst, now } from './time.js';

const VIEWS = {
  today: () => import('./views/today.js'),
  calendar: () => import('./views/calendar.js'),
  day: () => import('./views/day.js'),
  search: () => import('./views/search.js'),
  clubs: () => import('./views/clubs.js'),
  club: () => import('./views/club.js'),
  grade: () => import('./views/grade.js'),
  me: () => import('./views/me.js'),
};
// Which tab is lit up for each screen.
const TAB = { today: 'today', calendar: 'calendar', day: 'calendar', search: 'search', clubs: 'search',
  club: 'search', grade: 'search', me: 'me' };

const root = document.getElementById('view');
let cleanup = null;
let shown = null;

export function parseRoute(hash = location.hash) {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const [name, ...args] = path.split('/').filter(Boolean);
  return { name: VIEWS[name] ? name : 'today', args: args.map(decodeURIComponent), query: new URLSearchParams(query) };
}

/* Draw the screen for the current address. `soft` is used when only the data
   or settings changed: the screen fades to its new content instead of popping. */
async function show(soft = false) {
  const route = parseRoute();
  const key = location.hash;
  let view;
  try {
    view = await VIEWS[route.name]();
  } catch (err) {
    root.replaceChildren(h('p', { class: 'empty' }, 'This page didn’t load. Check your connection and try again.'));
    return;
  }
  if (key !== location.hash) return; // the student already tapped somewhere else
  cleanup?.();
  root.className = `view ${route.name}`;
  if (!data.schedule) {
    root.replaceChildren(h('p', { class: 'empty' }, 'The schedule couldn’t load. If you’re offline, open ʻIobot once on school Wi-Fi so it can save a copy.'));
    cleanup = null;
    return;
  }
  cleanup = view.render(root, { route, settings: getSettings() }) || null;
  for (const link of document.querySelectorAll('.nav-item')) {
    if (link.dataset.tab === TAB[route.name]) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  if (soft) fadeIn(root);
  else if (shown !== route.name) {
    root.classList.add('view-enter');
    window.scrollTo(0, 0);
  }
  shown = route.name;
}

/* Theme, motion, text size and contrast come from Me, falling back to the
   device's own setting. */
function applySettings() {
  const { theme, motion, textSize, contrast } = getSettings();
  const html = document.documentElement;
  // Black is the default look, so it needs no attribute; tokens.css has the others.
  if (theme === 'dark') delete html.dataset.theme;
  else html.dataset.theme = theme;
  const systemReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  html.dataset.motion = motion === 'reduced' || systemReduced ? 'reduced' : 'full';
  html.dataset.text = textSize;
  const systemContrast = matchMedia('(prefers-contrast: more)').matches;
  html.dataset.contrast = contrast === 'high' || systemContrast ? 'high' : 'normal';
  const light = theme === 'light' || (theme === 'system' && matchMedia('(prefers-color-scheme: light)').matches);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', light ? '#fafafa' : '#000000');
}

/* A slim banner while demo mode is on, with a way out. */
function showDemoBanner() {
  if (!demo) return;
  const banner = document.getElementById('demo-banner');
  const exit = `${location.pathname}${location.hash}`;
  const label = h('span', {});
  const tick = () => {
    const t = hst(now());
    const time = `${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`;
    label.textContent = `${dateText(t.date)} · ${clock(time, true)}${demo.speed > 1 ? ` · ${demo.speed}× speed` : ''}`;
  };
  tick();
  setInterval(tick, demo.speed > 1 ? 250 : 1000);
  banner.replaceChildren(h('span', { class: 'demo-tag' }, 'Demo'), label, h('a', { href: exit }, 'Exit'));
  banner.hidden = false;
}

async function start() {
  applySettings();
  matchMedia('(prefers-color-scheme: light)').addEventListener('change', applySettings);
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', applySettings);
  showDemoBanner();
  await refresh();
  window.addEventListener('hashchange', () => show());
  onData(() => show(true));
  onSettings(() => {
    applySettings();
    // On Me, typing a class name shouldn't redraw the form under the student's fingers.
    if (parseRoute().name !== 'me') show(true);
  });
  await show();
  startAutoRefresh();
  startAlerts();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {
      // Offline support is a bonus; the site works the same without it.
    });
  }
}

start();
