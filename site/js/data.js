/* Loading the data the pipeline publishes, and keeping it fresh.
 *
 * GitHub Actions rewrites site/data/*.json every 15 minutes on school days.
 * While the page is open we re-fetch every 5 minutes and whenever the tab comes
 * back into view. When a file really changed (a new bulletin, a corrected
 * schedule), every listener is told, and the views update in place.
 */

const FILES = {
  schedule: 'data/schedule.json',
  today: 'data/today.json',
  clubs: 'data/clubs.json',
};
const REFRESH_EVERY = 5 * 60 * 1000;

export const data = {
  schedule: null,
  today: null,
  clubs: null,
  offline: false,
  checkedAt: 0,
};
const listeners = new Set();
const lazy = new Map();

/* The parts of each file that matter for "did it change?". generated_at changes
   on every run, so it isn't one of them. */
const SIGNATURES = {
  schedule: (s) => `${s.source}|${s.changed_at}|${s.synced}`,
  today: (t) => `${t.date}|${t.posted}|${t.bulletin?.updated_at}`,
  clubs: (c) => JSON.stringify(c.clubs),
};

async function getJSON(path) {
  // ?t= makes every request unique, so no cache between here and GitHub can
  // hand back an old copy. sw.js strips it again when it saves a copy offline.
  const response = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const body = await response.json();
  return { body, fromCache: response.headers.get('X-Iobot-Offline') === '1' };
}

/* Fetch every file. Resolves with the names of the files that changed. */
export async function refresh() {
  const changed = [];
  let offline = false;
  await Promise.all(Object.entries(FILES).map(async ([name, path]) => {
    try {
      const { body, fromCache } = await getJSON(path);
      offline ||= fromCache;
      const before = data[name];
      if (!before || SIGNATURES[name](before) !== SIGNATURES[name](body)) changed.push(name);
      data[name] = body;
    } catch (err) {
      // No network and nothing cached yet (first visit while offline), or the
      // file is missing. Keep whatever we had; the views show what's missing.
      offline = true;
      data.lastError = err.message;
    }
  }));
  const wentOffline = offline !== data.offline;
  data.offline = offline || !navigator.onLine;
  data.checkedAt = Date.now();
  if (changed.length || wentOffline) {
    lazy.clear(); // announcements and club pages may be out of date too
    for (const fn of listeners) fn(changed);
  }
  return changed;
}

export function onData(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/* Files only some pages need (announcements.json, clubs/<id>.json, a day's
   bulletin). Loaded the first time they're asked for, then kept until the
   next refresh finds new data. Resolves to null if the file doesn't exist. */
export function load(path) {
  if (!lazy.has(path)) {
    lazy.set(path, getJSON(path).then((r) => r.body, () => {
      lazy.delete(path);
      return null;
    }));
  }
  return lazy.get(path);
}

export function startAutoRefresh() {
  setInterval(refresh, REFRESH_EVERY);
  document.addEventListener('visibilitychange', () => {
    // Back from another app or a locked screen: check right away, unless we just did.
    if (document.visibilityState === 'visible' && Date.now() - data.checkedAt > 30000) refresh();
  });
  window.addEventListener('online', refresh);
  window.addEventListener('offline', () => {
    data.offline = true;
    for (const fn of listeners) fn([]);
  });
}
