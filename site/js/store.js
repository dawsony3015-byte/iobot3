/* The student's own settings, saved on this device in localStorage.
 *
 *   grade    7-12, or null until they pick one
 *   classes  { 1: { name: 'Chemistry', room: 'I-203', free: false }, ... }
 *   follows  club ids, e.g. ['chess-club']
 *   theme    'dark' (black, the default) | 'light' | 'system'
 *   motion   'system' | 'reduced'
 *   textSize 'normal' | 'large'
 *   contrast 'normal' | 'high'
 *   reminders  true to get a heads-up 5 minutes before each block ends
 *   tasks    [{ id, text, due: 'YYYY-MM-DD' }], the student's own to-do list
 *
 * Some school devices and private windows block storage. Every read and write is
 * wrapped in try/catch, and when storage is blocked the app keeps working with
 * the settings in memory and the Me page says they won't be remembered.
 */

const KEY = 'iobot.settings.v1';
const DEFAULTS = { grade: null, classes: {}, follows: [], theme: 'dark', motion: 'system',
  textSize: 'normal', contrast: 'normal', reminders: false, tasks: [] };
const listeners = new Set();

export let storageWorks = true;
let settings = load();

function load() {
  try {
    return clean(JSON.parse(localStorage.getItem(KEY) || '{}'));
  } catch (err) {
    storageWorks = false;
    return clean({});
  }
}

/* Keep only values we understand, so a hand-edited or old save can't break the app. */
function clean(raw) {
  const grade = Number(raw.grade);
  const classes = {};
  for (let p = 1; p <= 8; p++) {
    const c = raw.classes?.[p];
    if (c && (c.name || c.room || c.free)) {
      classes[p] = { name: String(c.name || '').slice(0, 40), room: String(c.room || '').slice(0, 20), free: Boolean(c.free) };
    }
  }
  return {
    grade: grade >= 7 && grade <= 12 ? grade : null,
    classes,
    follows: Array.isArray(raw.follows) ? [...new Set(raw.follows.filter((id) => /^[a-z0-9-]{1,80}$/.test(id)))] : [],
    theme: ['light', 'system'].includes(raw.theme) ? raw.theme : DEFAULTS.theme,
    motion: raw.motion === 'reduced' ? 'reduced' : DEFAULTS.motion,
    textSize: raw.textSize === 'large' ? 'large' : DEFAULTS.textSize,
    contrast: raw.contrast === 'high' ? 'high' : DEFAULTS.contrast,
    reminders: raw.reminders === true,
    tasks: (Array.isArray(raw.tasks) ? raw.tasks : [])
      .filter((t) => t && typeof t.text === 'string' && t.text.trim() && /^\d{4}-\d{2}-\d{2}$/.test(t.due))
      .slice(0, 50)
      .map((t) => ({ id: String(t.id || `${t.due}-${t.text}`).slice(0, 60), text: t.text.trim().slice(0, 80), due: t.due })),
  };
}

export function getSettings() {
  return settings;
}

export function update(changes) {
  settings = clean({ ...settings, ...changes });
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
    storageWorks = true;
  } catch (err) {
    storageWorks = false;
  }
  for (const fn of listeners) fn(settings);
}

export function onSettings(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function toggleFollow(id) {
  const follows = settings.follows.includes(id) ? settings.follows.filter((f) => f !== id) : [...settings.follows, id];
  update({ follows });
}

/* ---- The to-do list ------------------------------------------------------ */

export function addTask(text, due) {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  update({ tasks: [...settings.tasks, { id, text, due }] });
}

export function removeTask(id) {
  update({ tasks: settings.tasks.filter((t) => t.id !== id) });
}

/* ---- Moving a setup between devices --------------------------------------- */

/* A copyable code like "IOBOT1-eyJnIjoxMC…". It's the settings as compact JSON,
   base64-encoded so it survives being pasted into a chat or a note. */
export function exportCode() {
  const compact = {
    g: settings.grade,
    c: Object.fromEntries(Object.entries(settings.classes).map(([p, c]) => [p, [c.name, c.room, c.free ? 1 : 0]])),
    f: settings.follows,
    t: settings.theme,
    m: settings.motion,
    x: [settings.textSize, settings.contrast, settings.reminders ? 1 : 0],
    k: settings.tasks.map((t) => [t.text, t.due]),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(compact));
  return `IOBOT1-${btoa(String.fromCharCode(...bytes)).replace(/=+$/, '')}`;
}

/* Returns true if the code was valid and applied. */
export function importCode(code) {
  const match = /^IOBOT1-([A-Za-z0-9+/]+)$/.exec(code.trim());
  if (!match) return false;
  try {
    const bytes = Uint8Array.from(atob(match[1]), (ch) => ch.charCodeAt(0));
    const compact = JSON.parse(new TextDecoder().decode(bytes));
    const classes = {};
    for (const [p, [name, room, free]] of Object.entries(compact.c || {})) classes[p] = { name, room, free: Boolean(free) };
    const [textSize, contrast, reminders] = compact.x || [];
    const tasks = (compact.k || []).map(([text, due], i) => ({ id: `imported-${i}`, text, due }));
    update({ grade: compact.g, classes, follows: compact.f, theme: compact.t, motion: compact.m,
      textSize, contrast, reminders: Boolean(reminders), tasks });
    return true;
  } catch (err) {
    return false;
  }
}
