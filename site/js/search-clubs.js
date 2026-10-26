/* Club search that forgives typos.
 *
 * Three simple steps, no library:
 *   1. simplify the text (lowercase, no accents or ʻokina; see search-text.js);
 *   2. each typed word must match a word of the club's name: exactly, as the
 *      start of a word ("mah" -> "Mahjong"), or inside it;
 *   3. failing that, a word within one or two typos counts too ("mahjog",
 *      "chses"), using edit distance: how many letters you'd have to add,
 *      remove, change or swap to get from one word to the other.
 */

import { simplify } from './search-text.js';

// Words that are in so many club names that they don't help narrow anything.
const FILLER = new Set(['club', 'clubs', 'the', 'of', 'and', 'team']);

export function searchClubs(query, clubs) {
  const words = simplify(query).split(/[^a-z0-9:]+/).filter(Boolean);
  const useful = words.filter((w) => !FILLER.has(w));
  const wanted = useful.length ? useful : words;
  if (!wanted.length || !clubs) return [];

  const scored = [];
  for (const club of clubs) {
    const names = [club.name, ...club.aliases].map(simplify);
    const nameWords = names.flatMap((n) => n.split(/[^a-z0-9:]+/)).filter(Boolean);
    let score = 0;
    for (const word of wanted) {
      const best = Math.max(0, ...nameWords.map((n) => wordScore(word, n)));
      if (!best) {
        score = 0;
        break; // every typed word has to match something
      }
      score += best;
    }
    if (!score) continue;
    if (names.some((n) => n.startsWith(simplify(query)))) score += 2;
    scored.push({ club, score });
  }
  return scored.sort((a, b) => b.score - a.score || a.club.name.localeCompare(b.club.name)).map((s) => s.club);
}

function wordScore(typed, word) {
  if (typed === word) return 4;
  if (word.startsWith(typed)) return 3;
  if (typed.length >= 3 && word.includes(typed)) return 2;
  // Allow one typo in a word of 4+ letters, two in a word of 7+.
  const allowed = typed.length >= 7 ? 2 : typed.length >= 4 ? 1 : 0;
  if (allowed && editDistance(typed, word.slice(0, typed.length + allowed)) <= allowed) return 1;
  return 0;
}

/* Optimal string alignment distance: insertions, deletions, substitutions, and
   swapping two neighboring letters ("chses" -> "chess") each cost 1. */
export function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}
