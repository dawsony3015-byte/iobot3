/* The newer parts of the Me screen: pasting in a class schedule, the to-do
 * list, and the switch for 5-minute reminders. Kept apart from me.js so each
 * file stays short.
 */

import { askForNotifications } from '../alerts.js';
import { fill, h } from '../dom.js';
import { dateText } from '../format.js';
import { parseClasses } from '../import-classes.js';
import { addTask, getSettings, removeTask, update } from '../store.js';
import { addDays, today } from '../time.js';

/* A box to paste a whole schedule into. */
export function classImport(onDone) {
  const box = h('textarea', {
    class: 'field', rows: 5, 'aria-label': 'Paste your class schedule',
    placeholder: '1 Chemistry I-203\n2 English 10 C201\n3 Free\n…',
  });
  const message = h('p', { class: 'small', role: 'status' });
  const run = () => {
    const found = parseClasses(box.value);
    const count = Object.keys(found).length;
    if (!count) {
      message.textContent = 'No periods found. Start each line with the period number, like “1 Chemistry I-203”.';
      return;
    }
    update({ classes: { ...getSettings().classes, ...found } });
    message.textContent = `Filled in ${count} period${count === 1 ? '' : 's'}.`;
    box.value = '';
    onDone();
  };
  return h('div', { class: 'transfer' }, box,
    h('div', {}, h('button', { class: 'btn', type: 'button', onclick: run }, 'Fill in my classes')), message);
}

/* Add, see and remove to-dos. The next few also show on Today. */
export function taskEditor() {
  const text = h('input', { class: 'field', placeholder: 'Chem lab report', 'aria-label': 'To-do', maxlength: 80 });
  const due = h('input', { class: 'field', type: 'date', value: addDays(today(), 1), 'aria-label': 'Due date' });
  const list = h('div', {});
  const paint = () => {
    const tasks = [...getSettings().tasks].sort((a, b) => a.due.localeCompare(b.due));
    fill(list, tasks.length
      ? h('ul', { class: 'plain-list' }, tasks.map((t) => h('li', { class: 'follow-row' },
        h('span', {}, t.text, h('span', { class: 'muted' }, ` · ${dateText(t.due)}`)),
        h('button', { class: 'btn', type: 'button', onclick: () => { removeTask(t.id); paint(); } }, 'Done'))))
      : h('p', { class: 'empty' }, 'Nothing on your list.'));
  };
  const add = (event) => {
    event.preventDefault();
    if (!text.value.trim() || !due.value) return;
    addTask(text.value.trim(), due.value);
    text.value = '';
    paint();
  };
  paint();
  return h('div', {},
    h('form', { class: 'task-form', onsubmit: add }, text, due, h('button', { class: 'btn', type: 'submit' }, 'Add')),
    list);
}

/* On/off for reminders. Turning it on asks the browser for permission. */
export function reminderSwitch() {
  const button = h('button', { class: 'btn', type: 'button' });
  const message = h('p', { class: 'small', role: 'status' });
  const paint = () => {
    const on = getSettings().reminders;
    button.setAttribute('aria-pressed', String(on));
    button.textContent = on ? 'Reminders on' : 'Turn on reminders';
  };
  button.addEventListener('click', async () => {
    if (getSettings().reminders) {
      update({ reminders: false });
    } else if (await askForNotifications()) {
      update({ reminders: true });
      message.textContent = 'You’ll get a heads-up 5 minutes before each block ends, while ʻIobot is open.';
    } else {
      message.textContent = 'This browser didn’t allow notifications. On an iPad, add ʻIobot to your Home Screen first, then try again.';
    }
    paint();
  });
  paint();
  return h('div', {}, button, message);
}
