# Decisions

A running record of what we found, what we chose, and why. Newest sections are
added at the bottom.

## 1. Gap report (start of v2)

The brief describes an existing v1 in `~/iobot-bell-schedule`. **That folder
didn't exist on the build machine**, and neither did `fixtures/school-calendar.ics`
or any feed URL. So v2 was built from scratch, with these substitutes:

| Brief expects | What we had | What we did |
|---|---|---|
| v1 code, tests, workflow, README | Nothing | Built everything new; no v1 code to keep or replace |
| `fixtures/school-calendar.ics` (5.6 MB real export) | A day-by-day 2026–27 export of the same feed (`CalendarData.gs`: labels, period order, start times) | Built a stand-in `.ics` in Google's format from it (see `fixtures/README.md`). The parser and tests are written against the brief's facts, so the real file can be dropped in |
| Feed A / Test feed / Feed B URLs | Placeholders only | `config.json` has empty slots. Until a URL is set, the pipeline uses the fixture and the site shows "Using the offline test calendar" |
| Oct 20 and Oct 23 bulletins | Today's real bulletin (Oct 23, 2026) plus four Wayback Machine snapshots (2021–2024) | Used the real PDFs. Oct 20 isn't available because the file is overwritten daily |
| GitHub Pages deploy | The team will host on Vercel or Firebase | The workflow deploys to whichever one has secrets set (see section 5) |

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
