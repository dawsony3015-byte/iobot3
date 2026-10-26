/* Full-text search over the bulletin archive, with the matching words found
 * in the original text so they can be highlighted.
 *
 * Matching uses a simplified copy of the text: lowercase, no accents, no ʻokina.
 * So "pa" finds "Pā" and "iolani" finds "ʻIolani", while the page still shows
 * the school's own spelling. pipeline/textnorm.py does the same steps in Python.
 */

const OKINA_LIKE = /[ʻ‘’`´']/;
const DASHES = /[–—‐‑−]/;

/* The simplified form used for matching: 'ʻIolani Pā' -> 'iolani pa'. */
export function simplify(text) {
  return simplifyWithMap(text).simple;
}

/* Simplify one character at a time and remember where each simplified character
   came from, so a match in the simple text maps back to the original. */
export function simplifyWithMap(text) {
  let simple = '';
  const from = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    let out;
    if (OKINA_LIKE.test(ch)) out = '';
    else if (DASHES.test(ch)) out = '-';
    else if (ch === '“' || ch === '”') out = '"';
    else if (/\s/.test(ch)) out = ' ';
    else out = ch.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
    for (const c of out) {
      simple += c;
      from.push(i);
    }
  }
  return { simple, from };
}

/* Search words from what the student typed: 'Yearbook  photo' -> ['yearbook', 'photo']. */
export function terms(query) {
  return simplify(query).split(/[^a-z0-9]+/).filter(Boolean);
}

/* Where each search word appears. Short words (3 letters or fewer, like "pa"
   or "sat") must be whole words; longer ones may start a word ("photo" finds
   "photos"). Returns [start, end] pairs in the ORIGINAL text, or null if any
   word is missing (every word has to be there). */
export function findTerms(text, words) {
  const { simple, from } = simplifyWithMap(text);
  const ranges = [];
  for (const word of words) {
    const tail = word.length <= 3 ? '(?![a-z0-9])' : '';
    const pattern = new RegExp(`(?<![a-z0-9])${word}${tail}`, 'g');
    let found = false;
    for (const m of simple.matchAll(pattern)) {
      found = true;
      ranges.push([from[m.index], from[m.index + word.length - 1] + 1]);
    }
    if (!found) return null;
  }
  return ranges.sort((a, b) => a[0] - b[0]);
}

/* Search announcements.json. Returns the newest matches first:
   [{ kind: 'item' | 'line', date, title, text, ranges: { title, text } }] */
export function searchBulletins(query, archive, limit = 40) {
  const words = terms(query);
  if (!words.length || !archive) return [];
  const results = [];
  for (const item of archive.items) {
    const whole = `${item.title} ${item.text}`;
    if (!findTerms(whole, words)) continue;
    results.push({ kind: 'item', date: item.dates[item.dates.length - 1], dates: item.dates, section: item.section,
      title: item.title, text: item.text, club: item.club,
      ranges: { title: findAny(item.title, words), text: findAny(item.text, words) } });
  }
  for (const line of archive.schedule) {
    const whole = `${line.title} ${line.location}`;
    if (!findTerms(whole, words)) continue;
    results.push({ kind: 'line', date: line.date, title: line.title, text: line.location, start: line.start,
      ranges: { title: findAny(line.title, words), text: findAny(line.location, words) } });
  }
  return results.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

/* Like findTerms, but highlights whichever words appear in this piece of text. */
function findAny(text, words) {
  return words.flatMap((w) => findTerms(text, [w]) || []).sort((a, b) => a[0] - b[0]);
}
