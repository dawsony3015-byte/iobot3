# Decisions

A running record of what we found, what we chose, and why. Newest sections are
added at the bottom.

## 1. Gap report (start of v2)

The brief describes an existing v1 in `~/iobot-bell-schedule`. **The folder
held only a `.gitignore`**: no v1 code, no `fixtures/school-calendar.ics`, and
no feed URLs. So v2 was built from scratch, with these substitutes:

| Brief expects | What we had | What we did |
|---|---|---|
| v1 code, tests, workflow, README | Nothing | Built everything new; no v1 code to keep or replace |
| `fixtures/school-calendar.ics` (5.6 MB real export) | A day-by-day 2026–27 export of the same feed (`CalendarData.gs`: labels, period order, start times) | Built a stand-in `.ics` in Google's format from it (see `fixtures/README.md`). The parser and tests are written against the brief's facts, so the real file can be dropped in |
| Feed A / Test feed / Feed B URLs | Placeholders only | `config.json` has empty slots. Until a URL is set, the pipeline uses the fixture and the site shows a small "Test calendar" tag |
| Oct 20 and Oct 23 bulletins | The real Oct 23 and Oct 26, 2026 bulletins, plus four Wayback Machine snapshots (2021–2024) | Used the real PDFs. Oct 20 isn't available: the file is overwritten daily and the Wayback Machine has no 2026 copy |
| GitHub Pages deploy | No GitHub remote yet | `update.yml` deploys `site/` with `upload-pages-artifact` + `deploy-pages`, as the brief asks. Setup steps are in the README |

The work happened in two sessions. The first one explored the data and wrote
the calendar parser and most of the bulletin parser (on the `iobot-v2`
branch). The second continued on `v2`: bulletin tests, search indexes, the
whole front end, offline support, the workflow, the browser tests, and the
docs. Each step is its own commit.

## 2. What the data actually looks like

### Calendar (from `python -m pipeline.report`)

- 85 distinct day labels in 2026–27. Trailing spaces (`'B Schedule '`) and
  double spaces (`'A Schedule  (Grs. 11&12 Chapel)'`) are common, so labels
  are whitespace-collapsed before matching. Never compare raw labels.
- The rotation in the label sometimes has a stray comma: `F1 Schedule (7,8,5,6,)`.
- Chapel notes seen: `Gr. N Chapel`, `Grs. N&M Chapel`, `Gr. 7 Chapel/Gr. 8 remain in HR`,
  `No Chapel` / `NO CHAPEL`, and none at all. `Chapel (No Chapel) Schedule` is a
  schedule *shape* (all eight periods, 41 minutes each) with no chapel.
- Block names: `Period 1`–`Period 8`, `Homeroom/Chapel`, `Homeroom`, `Meeting`,
  `Lunch`, `Break`, `Assembly`, `Meeting/Lunch`, `Chapel/ Assembly` (with a space)
  and `Chapel/Assembly`, `Christmas Chapel 1/2`, `Easter Chapel 1/2`.
- One real dropped block: **2026-09-16 C Schedule has no Period 5**. The usual
  C order (5,6,7,8,1,2) is learned from the feed itself, not hardcoded.
- **PSAT Schedule Day (10/19) has no timed blocks.** The site says so plainly
  instead of guessing times.
- Weekdays with more than one all-day event were missing from the export
  (12/25, 1/1, 3/26), which suggests that's how multi-label days look in the
  feed. The parser keeps every label for a date and picks the most useful one
  to show.

### Daily bulletin (real PDF, Oct 23, 2026)

The brief's sketch came from a text summarizer. The real extracted text differs
in ways that matter:

- **Single column**, Times New Roman, 1–2 pages. pdfplumber's default spacing
  keeps bold headings intact (checked against a tighter tolerance on all five
  fixtures: identical output).
- **Section headings share a line with the first entry:** `EVERYONE:--ALOHA FRIDAY…`,
  `GRS 9-11:--FROM MR ANDREWS…`. Older bulletins put `EVERYONE:` on its own line.
  The parser accepts both.
- **Club tags come with or without parentheses:** `BADMINTON CLUB 7-12:`, `ONE TEAM 3:16 (GRS 7-12):`
  (note the colon *inside* the name), `BIBLE STUDY CLUB GRS 7-12:`.
- The ʻokina appears as `ʻ`, `‘`, `'` and even a backtick (`` `IOLANI ``).
- **TODAY'S SCHEDULE lines wrap.** A line that doesn't start with a time
  continues the previous one when that line ended with a comma.
- **Older layouts use two columns at the top:** `US SCHEDULE: A Weinberg Snack Bar: Tonkatsu`.
  So the food parser finds each label anywhere in the header lines, not only at
  the start of a line.
- Headings seen over the years: `TODAY'S SCHEDULE`, `EVERYONE:`, `ORGANIZATIONS:`,
  `SPORTS:`, `GR. 8:`, `GRS 9-11:`, `GRS 7/11:` (a slash means "and"),
  `SENIORS:`, `FACULTY/STAFF:`, `WEEKLY QUOTATION:`, `JOB OPPORTUNITIES:`, `LOST AND FOUND:`.

## 3. The official red

`#C8102E`. Downloaded the iolani.org homepage on Oct 23, 2026, followed its
stylesheet links and counted saturated reds:

| Color | Uses | Files |
|---|---|---|
| `#C8102E` | 68 | `/uploaded/themes/default_21/main.css`, `Custom-Files/DS-Custom-Class.css`, `Custom-Files/BB-Custom-Class.css` |
| `#960C23` | 2 | `main.css` (darker companion, used on hover) |
| everything else | ≤ 8 | the vendor `application.css` bundle, not the school theme |

`#C8102E` is also Pantone 186 C, the usual "school red". It's no longer an
approximation.

## 4. Choices made where the brief left room

- **Keep from July 1.** "Current school year" is computed, not typed in: every
  date from July 1 of the school year containing today is kept. That
  automatically includes next year once the school adds it.
- **Repeating events are never expanded.** They only exist before 2017. Expanding
  them could let an old weekly event with no end date leak into this year.
- **Chapel wording per grade.** A `Homeroom/Chapel` block shows "Chapel" if my
  grade is in the label's chapel note, otherwise "Homeroom". A `Chapel/Assembly`
  block shows "Chapel" or "Assembly" the same way, and keeps both words when the
  label has no note. With no grade chosen, the feed's own name is shown.
- **"Fr." only means freshmen next to a class word** (Class, Mtg, Advisory, …).
  At an Episcopal school, "Fr." is just as likely to be a priest.
- **The calendar feed wins.** If the bulletin's `US SCHEDULE` line disagrees with
  the feed, the pipeline logs a warning and the site uses the feed, as the
  contest rules require.

## 5. Design

### Color

**Black, white and 'Iolani red**, with black as the default. The brief asked
for a warm off-white background; after seeing the first version, the team
asked for a black background with white text, so the light warm palette was
replaced. A White option (and "Match device") is still in Me.

All colors are CSS custom properties in `site/css/tokens.css`, in pure
neutral grays so nothing competes with the red. Red is used for the day tile,
the current period chip, the progress bar, the current stop on the timeline,
the countdown's colon, links, and the countdown's final minute.

| Token | Black (default) | White | Used for |
|---|---|---|---|
| `--bg` | `#000000` | `#fafafa` | Page background |
| `--ink` | `#ffffff` | `#0a0a0a` | Main text |
| `--ink-2` / `--ink-3` | `#a3a3a3` / `#858585` | `#525252` / `#6b6b6b` | Secondary text / blocks that are over |
| `--accent` | `#ff4359` | `#c8102e` | Red *text* and lines. Brighter on black so it stays readable (6.2:1) |
| `--accent-fill` | `#c8102e` | `#c8102e` | Red areas with white text on them (5.9:1) |
| `--accent-tint` | `#230a0e` | `#fcebed` | Behind the current block |
| `--surface` | `#111111` | `#ffffff` | Calendar cells, text fields |

On the calendar, days off are drawn with fine diagonal lines (the usual
calendar sign for "not a school day"), because on a black page a plain
"grayed" cell is nearly invisible.

### Contrast

Every text/background pair the site uses, checked against WCAG AA (4.5:1 for
normal text) by `tests/test_contrast.py`, which reads the values straight from
`tokens.css`. The lowest is 4.51:1.

| Text | Background | Black (default) | White |
|---|---|---|---|
| `--ink` | `--bg` | 21.00:1 | 18.97:1 |
| `--ink` | `--surface` | 18.88:1 | 19.80:1 |
| `--ink` | `--surface-2` | 17.40:1 | 17.68:1 |
| `--ink` | `--bg-sunk` | 19.68:1 | 17.37:1 |
| `--ink` | `--accent-tint` | 18.73:1 | 17.20:1 |
| `--ink` | `--off-day` | 21.00:1 | 16.76:1 |
| `--ink-2` | `--bg` | 8.33:1 | 7.49:1 |
| `--ink-2` | `--surface` | 7.49:1 | 7.81:1 |
| `--ink-2` | `--bg-sunk` | 7.80:1 | 6.86:1 |
| `--ink-2` | `--accent-tint` | 7.42:1 | 6.79:1 |
| `--ink-2` | `--off-day` | 8.33:1 | 6.61:1 |
| `--ink-3` | `--bg` | 5.69:1 | 5.11:1 |
| `--ink-3` | `--surface` | 5.12:1 | 5.33:1 |
| `--ink-3` | `--surface-2` | 4.72:1 | 4.76:1 |
| `--ink-3` | `--off-day` | 5.69:1 | 4.51:1 |
| `--accent` | `--bg` | 6.20:1 | 5.64:1 |
| `--accent` | `--surface` | 5.57:1 | 5.88:1 |
| `--accent` | `--accent-tint` | 5.53:1 | 5.11:1 |
| `--on-accent` | `--accent-fill` | 5.88:1 | 5.88:1 |
| `--on-ink` | `--ink-fill` | 21.00:1 | 19.80:1 |
| `--banner-ink` | `--banner-bg` | 18.10:1 | 19.80:1 |

During development the test caught a failure (`--ink-3` on `--off-day` at
4.37:1 in the first palette), which was fixed before it shipped.

### Graphics

- **Period chips.** The period order is a row of scoreboard boxes under the day
  tile. Finished periods fade, the current one is red, and during passing time
  the next one gets a white outline.
- **The day bar** (`js/views/daybar.js`). The whole school day drawn to scale,
  one segment per block, with a needle at "now" that glides along it. Students
  can see the shape of the day (how long until lunch, how much is left) at a
  glance. Only the needle moves each frame, with `transform`.
- **The timeline rail.** The blocks are drawn like a transit line: a rail with
  one stop per block. Stops fill in as blocks finish, and the current stop is red.
- **Condensed uppercase labels** (Barlow Condensed) for headings, the tab
  bar and section titles, for a scoreboard / athletics feel. Body text stays
  in Source Sans 3 for reading.

### Type

- **Barlow Condensed** (700) for the countdown, the day letter and big status
  words. It looks like a scoreboard and fits `29:00` large on a phone. Its
  default digits are proportional, so the countdown turns on `tabular-nums`
  *and* gives every digit its own fixed-width cell.
- **Source Sans 3** for everything else. Its digits are already equal width,
  so the times in the timeline line up in a column.
- Both are self-hosted in `site/fonts/` (no Google Fonts requests, works
  offline). Barlow Condensed is cut down to basic Latin (13 KB per weight).
  Source Sans 3's Hawaiian vowels with a kahakō (ā ē ī ō ū) are in a separate
  2.8 KB file the browser downloads only when a page contains one. The ʻokina
  is already in the main file. Subsetting used fontTools' `pyftsubset` once;
  the command is in the README.
- Type scale: 12 / 14 / 16 / 20 / 28 / 40 px, plus the countdown at
  `clamp(5rem, 29vw, 11rem)` on phones and `clamp(7rem, 17vw, 11rem)` above 720 px.
- Barlow's digits stand 0.71 em tall but the font reserves 1.2 em per line, so
  the countdown's line box is set to 0.8 em. Without that, there was a large
  empty band above the digits.

### Countdown format

The brief says `MM:SS` under an hour and `H:MM:SS` otherwise, but some of its
examples are written `3:41` and `0:22:14`. We follow the rule: `03:41`, and
`22:14` for 22 minutes before homeroom. Keeping two minute digits under an
hour means the countdown always has the same five cells, so crossing 10:00 is
just two digits rolling instead of the whole number being rebuilt.

### Layout

- Phone and iPad portrait (under 1024 px): bottom tab bar. iPad landscape and
  laptops: a left side rail, and Today becomes two columns (Now on the left,
  the day's blocks on the right) so the whole day is visible without scrolling.
- Calendar shows Monday–Friday only. School never meets on weekends, and five
  columns fit a phone without shrinking the letters.
- Timeline rows are all the same height (60 px). That's what lets the current
  block's highlight glide between rows with a single `transform`.

## 6. Data and architecture choices

- **Repeated announcements are stored once.** A notice that runs all week is
  one item in `announcements.json` with five dates, not five copies.
- **Clubs are split in two.** `clubs.json` (one short line per club) is small
  enough for Today to load; each club's full mention history is in
  `clubs/<id>.json` and loads only on that club's page.
- **`today.json` lists which days have a saved bulletin**, so the site never
  requests a bulletin that doesn't exist (a 404 shows up as a console error).
- **The service worker refreshes the app in the background.** The app shell is
  served from the cache instantly and re-downloaded quietly, so an update
  reaches students on their next visit without anyone bumping a version
  number. Data always tries the network first.
- **Bulletin vs. calendar disagreements are shown, not just logged.** The feed
  stays the source of truth, but if the bulletin's `US SCHEDULE` line says
  something else, Today shows a calm one-line notice so students know to check.
- **"For you" on days off** is replaced by "Coming up": the next four school
  days with their letters. There's no bulletin on a holiday, and what a
  student checks during a break is when school starts again and what day it is.
- **Keeping the schedule alive over summer.** GitHub turns off scheduled
  workflows in public repos after 60 days without activity, and summer break
  is longer. Each run calls GitHub's "enable workflow" API, which counts as activity.

## 7. Not verified

- **The real Feed A, Test feed and Feed B URLs.** None were provided, and the
  school's site has no public link to them. Everything was built and tested
  against `fixtures/school-calendar.ics`, a reconstruction (see section 1).
- **The real 5.6 MB calendar export.** The parser follows the brief's
  description of it (RRULE events before 2017, `Per 3 B`, folded lines) and the
  fixture includes those cases, but it hasn't seen the actual file.
- **Lighthouse scores.** Lighthouse needs Node.js, which wasn't on the build
  machine. The site was built to score well (self-hosted subset fonts, no
  framework, about 100 KB of heavily commented JS (about 31 KB compressed) with each screen loaded only when opened, labeled controls, AA
  contrast), but the 95+ target is unconfirmed.
- **The GitHub Actions workflow.** The folder has no GitHub remote, so
  `update.yml` hasn't run on GitHub yet. Its pipeline command was run locally,
  online and offline.
- **Real iPads.** Tested in Chromium at iPad sizes, not on iPad hardware or in Safari.
- **The school's red.** `#C8102E` was read from iolani.org's stylesheet on
  Oct 23, 2026 (section 3). It's the official value as published there; nobody
  at the school has confirmed it.
