/* The usage stats page (stats.html): reads the anonymous daily totals that
 * usage.js writes to Firestore and shows them as headline numbers, a daily
 * chart of app opens, and ranked bars for screens, features and devices.
 *
 * Reads go straight to Firestore's public REST address; the database rules
 * (firestore.rules) allow reading the totals and nothing else.
 */

import { fill, h } from './dom.js';
import { dateText } from './format.js';
import { COUNTERS } from './usage.js';
import { addDays, today } from './time.js';

const LIST = 'https://firestore.googleapis.com/v1/projects/iobot3/databases/(default)/documents/stats?pageSize=400';
const content = document.getElementById('content');
const range = document.getElementById('range');
let days = [];
let span = 7;

/* Firestore's REST format nests every value: {integerValue: "3"} or {mapValue: {fields}}. */
function flatten(fields, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(fields || {})) {
    if (value.mapValue) flatten(value.mapValue.fields, `${prefix}${key}.`, out);
    else out[`${prefix}${key}`] = Number(value.integerValue ?? value.doubleValue ?? 0);
  }
  return out;
}

async function loadDays() {
  const response = await fetch(LIST, { cache: 'no-store' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  return (body.documents || [])
    .map((doc) => ({ date: doc.name.split('/').pop(), counts: flatten(doc.fields) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function inRange() {
  if (!span) return days;
  const from = addDays(today(), -(span - 1));
  return days.filter((d) => d.date >= from);
}

function total(list, key) {
  return list.reduce((sum, d) => sum + (d.counts[key] || 0), 0);
}

function tile(label, value, note) {
  return h('div', { class: 'stat-tile' },
    h('p', { class: 'label' }, label),
    h('p', { class: 'stat-value' }, value.toLocaleString()),
    note ? h('p', { class: 'muted small' }, note) : null);
}

/* One bar per day, height = app opens. Hovering (or tapping) a bar shows its numbers. */
function dailyChart(list) {
  const ns = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  };
  const dates = [];
  for (let d = span ? addDays(today(), -(span - 1)) : (list[0]?.date || today()); d <= today(); d = addDays(d, 1)) dates.push(d);
  const byDate = new Map(list.map((d) => [d.date, d.counts]));
  const values = dates.map((d) => byDate.get(d)?.visits || 0);
  const max = Math.max(1, ...values);
  // Drawn at the page's real width, so the 12 px axis labels stay 12 px on a phone.
  const W = Math.max(300, content.clientWidth || 640), H = 214, padL = 36, padT = 14, padB = 24, gap = 2;
  const plot = H - padT - padB;
  const bw = (W - padL) / dates.length;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'App opens per day' });
  for (const f of [0.5, 1]) {
    const y = padT + plot * (1 - f);
    svg.append(svgEl('line', { x1: padL, x2: W, y1: y, y2: y, class: 'grid' }));
    const t = svgEl('text', { x: padL - 6, y: y + 4, class: 'axis', 'text-anchor': 'end' });
    t.textContent = Math.round(max * f);
    svg.append(t);
  }
  const readout = h('p', { class: 'readout muted small', 'aria-live': 'polite' }, 'Hover or tap a bar for that day.');
  dates.forEach((date, i) => {
    const v = values[i];
    const bh = Math.max(v ? 2 : 0, (v / max) * plot);
    const x = padL + i * bw + gap / 2;
    const bar = svgEl('path', {
      d: roundedTop(x, H - padB - bh, Math.max(1, bw - gap), bh, Math.min(4, (bw - gap) / 2)),
      class: `bar-mark${date === today() ? ' is-today' : ''}`,
    });
    const hit = svgEl('rect', { x: padL + i * bw, y: 0, width: bw, height: H - padB, class: 'hit', tabindex: 0 });
    const show = () => {
      readout.textContent = `${dateText(date)}: ${v.toLocaleString()} opens, ${(byDate.get(date)?.refreshes || 0).toLocaleString()} data checks`;
      svg.querySelectorAll('.bar-mark').forEach((b) => b.classList.remove('is-active'));
      bar.classList.add('is-active');
    };
    hit.addEventListener('mouseenter', show);
    hit.addEventListener('focus', show);
    hit.addEventListener('click', show);
    svg.append(bar, hit);
  });
  [0, dates.length - 1].forEach((i) => {
    const t = svgEl('text', { x: padL + i * bw + bw / 2, y: H - 6, class: 'axis', 'text-anchor': i ? 'end' : 'start' });
    t.textContent = dateText(dates[i]).replace(/^\w+, /, '');
    svg.append(t);
  });
  return h('div', {}, svg, readout);
}

/* Bars only round the end that's away from the baseline. */
function roundedTop(x, y, w, hgt, r) {
  if (hgt <= r) return `M${x},${y + hgt}V${y}H${x + w}V${y + hgt}Z`;
  return `M${x},${y + hgt}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hgt}Z`;
}

/* Ranked horizontal bars for one group of counters (views, features, …). */
function ranked(title, group, list) {
  const rows = Object.keys(COUNTERS).filter((k) => k.startsWith(`${group}.`))
    .map((k) => [COUNTERS[k], total(list, k)]).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return h('section', { class: 'section' },
    h('div', { class: 'section-head' }, h('h2', { class: 'label' }, title)),
    h('ul', { class: 'ranked' }, rows.map(([label, n]) => h('li', {},
      h('span', { class: 'ranked-label' }, label),
      h('span', { class: 'ranked-track' }, h('span', { class: 'ranked-fill', style: `transform: scaleX(${n / max})` })),
      h('span', { class: 'ranked-n' }, n.toLocaleString())))));
}

function table(list) {
  return h('details', { class: 'section' }, h('summary', { class: 'label' }, 'Show daily numbers as a table'),
    h('table', { class: 'stats-table' },
      h('thead', {}, h('tr', {}, ['Day', 'Opens', 'Data checks', 'Home screen'].map((t) => h('th', {}, t)))),
      h('tbody', {}, [...list].reverse().map((d) => h('tr', {},
        h('td', {}, dateText(d.date)), h('td', {}, d.counts.visits || 0),
        h('td', {}, d.counts.refreshes || 0), h('td', {}, d.counts.installed || 0))))));
}

function render() {
  for (const b of range.children) b.setAttribute('aria-checked', String(Number(b.dataset.days) === span));
  const list = inRange();
  if (!days.length) {
    fill(content, h('p', { class: 'empty' }, 'No usage recorded yet. Numbers appear after students open ʻIobot on iobot3.web.app.'));
    return;
  }
  const opens = total(list, 'visits');
  const installed = total(list, 'installed');
  fill(content,
    h('div', { class: 'stat-tiles' },
      tile('App opens', opens),
      tile('Data checks', total(list, 'refreshes'), 'How often open apps checked for new data'),
      tile('From the home screen', installed, opens ? `${Math.round((installed / opens) * 100)}% of opens` : null),
      tile('Days recorded', list.length)),
    h('section', { class: 'section' }, h('div', { class: 'section-head' }, h('h2', { class: 'label' }, 'App opens per day')), dailyChart(list)),
    h('div', { class: 'stats-grid' },
      ranked('Screens opened', 'views', list),
      ranked('Features used', 'features', list),
      ranked('Devices', 'devices', list),
      ranked('Settings on', 'settings', list)),
    table(list));
}

range.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  span = Number(button.dataset.days);
  render();
});

loadDays().then((loaded) => {
  days = loaded;
  render();
}, (err) => {
  fill(content, h('p', { class: 'empty' }, `The stats didn’t load (${err.message}). Check your connection and reload.`));
});
