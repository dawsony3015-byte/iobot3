/* Reading a pasted class schedule into the Me screen's eight periods.
 *
 * Students can copy their schedule from wherever they keep it and paste it in.
 * Each line that starts with a period number becomes that period:
 *
 *   1 Chemistry I-203          -> Period 1: Chemistry, room I-203
 *   Period 2: English 10 - C201 -> Period 2: English 10, room C201
 *   P4 Free                     -> Period 4: Free
 *   3. World History (B105)     -> Period 3: World History, room B105
 *
 * The room is the last word if it looks like a room (letters then digits,
 * "Upper Gym", "Library"). Lines without a period number are skipped.
 */

const LINE = /^\s*(?:p(?:er(?:iod)?)?\.?\s*)?([1-8])\s*[.:)\-–]?\s+(.+?)\s*$/i;
const ROOM = /^\(?([A-Za-z]{0,4}-?\d{2,4}[A-Za-z]?|Upper Gym|Lower Gym|Library|Seto Hall|the P[aā])\)?$/i;

export function parseClasses(text) {
  const classes = {};
  for (const line of text.split(/\r?\n/)) {
    const m = LINE.exec(line);
    if (!m) continue;
    const period = Number(m[1]);
    let rest = m[2].replace(/\s+/g, ' ');
    if (/^free( period)?$/i.test(rest)) {
      classes[period] = { name: '', room: '', free: true };
      continue;
    }
    let room = '';
    // "English 10 - C201", "Chemistry, I-203", "History (B105)", or a trailing room word.
    const split = /^(.*?)\s*(?:[-–,]\s+|\s+)(\(?[A-Za-z]{0,4}-?\d{2,4}[A-Za-z]?\)?|Upper Gym|Lower Gym|Library|Seto Hall|the P[aā])$/i.exec(rest);
    if (split && ROOM.test(split[2]) && split[1]) {
      rest = split[1];
      room = split[2].replace(/[()]/g, '');
    }
    classes[period] = { name: rest.replace(/[\s,–-]+$/, '').slice(0, 40), room: room.slice(0, 20), free: false };
  }
  return classes;
}
