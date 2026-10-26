/* Me: the student's settings, saved on this device. #/me
 *
 * Grade, a class name and room for each period (or Free), followed clubs,
 * theme and motion, and a short code to copy the whole setup to another device.
 */

import { data } from '../data.js';
import { fill, h } from '../dom.js';
import { exportCode, getSettings, importCode, storageWorks, toggleFollow, update } from '../store.js';

export function render(root) {
  fill(root,
    h('h1', { class: 'page-title' }, 'Me'),
    storageWorks ? null : h('p', { class: 'notice', role: 'status' },
      'This browser is blocking saved data, so your settings will reset when you close ʻIobot.'),
    group('Grade', 'Used for chapel, “For you”, and your calendar dots.',
      choice('grade', [[null, 'Not set'], ...[7, 8, 9, 10, 11, 12].map((g) => [g, String(g)])])),
    group('My classes', 'Shown next to each period. Mark a period Free if you don’t have a class.', classTable()),
    group('Clubs I follow', 'Their bulletin mentions show up under “For you” on Today.', followed()),
    group('Theme', null, choice('theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']])),
    group('Motion', 'Reduced turns off the rolling digits and sliding.', choice('motion', [['system', 'System'], ['reduced', 'Reduced']])),
    group('Move my setup to another device', 'Copy this code on one device, then paste it here on the other.', transfer()),
    h('p', { class: 'muted small about' }, 'ʻIobot reads the school’s bell schedule calendar and the daily bulletin. ',
      'Your settings never leave this device.'));
}

function group(title, hint, ...body) {
  return h('section', { class: 'me-group' },
    h('h2', { class: 'me-title' }, title), hint ? h('p', { class: 'muted small' }, hint) : null, body);
}

/* A row of buttons that act like radio buttons. */
function choice(key, options) {
  const box = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': key });
  const paint = () => {
    for (const button of box.children) button.setAttribute('aria-checked', String(button.dataset.value === String(getSettings()[key])));
  };
  for (const [value, label] of options) {
    box.append(h('button', {
      type: 'button', role: 'radio', 'data-value': String(value),
      onclick: () => {
        update({ [key]: value });
        paint();
      },
    }, label));
  }
  paint();
  return box;
}

function classTable() {
  const rows = [];
  for (let p = 1; p <= 8; p++) {
    const saved = getSettings().classes[p] || {};
    const name = h('input', { class: 'field', value: saved.name || '', placeholder: 'Class', 'aria-label': `Period ${p} class`, maxlength: 40 });
    const room = h('input', { class: 'field', value: saved.room || '', placeholder: 'Room', 'aria-label': `Period ${p} room`, maxlength: 20 });
    const free = h('button', { class: 'btn', type: 'button', 'aria-pressed': String(Boolean(saved.free)), 'aria-label': `Period ${p} is free` }, 'Free');
    const save = () => {
      const classes = { ...getSettings().classes };
      const isFree = free.getAttribute('aria-pressed') === 'true';
      classes[p] = { name: name.value.trim(), room: room.value.trim(), free: isFree };
      name.disabled = room.disabled = isFree;
      update({ classes });
    };
    free.addEventListener('click', () => {
      free.setAttribute('aria-pressed', String(free.getAttribute('aria-pressed') !== 'true'));
      save();
    });
    name.addEventListener('change', save);
    room.addEventListener('change', save);
    name.disabled = room.disabled = Boolean(saved.free);
    rows.push(h('div', { class: 'class-row' }, h('span', { class: 'class-p' }, p), name, room, free));
  }
  return h('div', { class: 'class-table' }, rows);
}

function followed() {
  const list = h('div', {});
  const paint = () => {
    const ids = getSettings().follows;
    const clubs = ids.map((id) => data.clubs?.clubs.find((c) => c.id === id) || { id, name: id });
    fill(list, clubs.length
      ? h('ul', { class: 'plain-list' }, clubs.map((club) => h('li', { class: 'follow-row' },
        h('a', { href: `#/club/${club.id}` }, club.name),
        h('button', { class: 'btn', type: 'button', onclick: () => { toggleFollow(club.id); paint(); } }, 'Unfollow'))))
      : h('p', { class: 'empty' }, 'None yet. ', h('a', { href: '#/clubs' }, 'Find a club'), ' and tap Follow.'));
  };
  paint();
  return list;
}

function transfer() {
  const out = h('input', { class: 'field mono', readonly: true, 'aria-label': 'Your setup code', placeholder: 'Tap “Copy my code”' });
  const paste = h('input', { class: 'field mono', placeholder: 'Paste a code here', 'aria-label': 'Paste a setup code' });
  const message = h('p', { class: 'small', role: 'status' });
  const copy = async () => {
    out.value = exportCode();
    out.select();
    try {
      await navigator.clipboard.writeText(out.value);
      message.textContent = 'Copied. Paste it into ʻIobot on your other device.';
    } catch (err) {
      message.textContent = 'Select the code and copy it.';
    }
  };
  const use = () => {
    if (importCode(paste.value)) {
      message.textContent = 'Done. Your setup was loaded.';
      setTimeout(() => location.reload(), 600); // redraw every field with the new settings
    } else {
      message.textContent = 'That code didn’t work. Copy it again and paste the whole thing.';
    }
  };
  return h('div', { class: 'transfer' },
    h('div', { class: 'transfer-row' }, out, h('button', { class: 'btn', type: 'button', onclick: copy }, 'Copy my code')),
    h('div', { class: 'transfer-row' }, paste, h('button', { class: 'btn', type: 'button', onclick: use }, 'Use this code')),
    message);
}
