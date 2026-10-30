# Code walkthrough

For the code defense: what every file does and why it's built that way, then
the questions judges are most likely to ask, with answers. Read it alongside
the code. Every file starts with a comment saying what it's for.

## The big picture

There are two programs:

1. **The pipeline** (`pipeline/`, Python). It runs on GitHub's servers every
   15 minutes during the school day. It downloads the calendar feed and the
   bulletin PDF, turns them into small JSON files, and publishes them with the
   website.
2. **The website** (`site/`, HTML + CSS + JavaScript, no framework, no build
   step). It loads those JSON files and does all the time math in the browser.

They only talk through the JSON files in `site/data/`. That keeps each half
simple: the pipeline never thinks about pixels, and the website never parses
a PDF.

## Pipeline (`pipeline/`)

| File | What it does | Why it's built this way |
|---|---|---|
| `config.py` | File paths, the Honolulu time zone, which feed URL to use, `now_hst()`, and small JSON read/write helpers | One place for settings. `IOBOT_NOW` lets tests pretend it's a certain moment. Feed URLs can come from environment variables so they can be kept secret |
| `fetch.py` | `download(url)`: one GET with a 20-second timeout, a `?t=` cache-buster and a no-cache header | Every download goes through here, so none of them can hang a run or get an old cached copy |
| `textnorm.py` | `clean()` tidies spaces, `search_key()` makes a lowercase, accent-free copy for matching, `title_case()` turns `FALL BREAK` into "Fall Break" | We keep the original text for display and a simplified copy for search, so "pa" finds "Pā" |
| `grades.py` | Turns `(Grs. 9&10 Chapel)`, `GRS 9-11`, `(7-12)`, `Srs.`, "7th and 8th graders" into sets like `{9, 10}` | Grades are written a dozen ways. Every format we found has a test |
| `calendar_parse.py` | Reads the iCal feed: keeps this school year, splits all-day labels from timed blocks, converts UTC to Honolulu time, normalizes block names, reads letter/rotation/chapel from each label, finds dropped periods | Pure functions (data in, data out) so the tests can call them directly. The normal period order for each letter is *learned from the feed*, not typed in |
| `fetch_calendar.py` | Downloads the feed (or uses the fixture), parses it, writes `schedule.json`. If anything fails, republishes the last good copy | The site should never go blank because Google had a bad minute |
| `bulletin_parse.py` | Splits the bulletin text into header, TODAY'S SCHEDULE and sections; reads food, the US SCHEDULE line, each schedule line, and each section entry | Written after reading the real PDF text, which differs from the summary in the brief (headings share a line with the first entry, two-column headers in older years) |
| `clubs.py` | Finds clubs in ORGANIZATIONS and TODAY'S SCHEDULE, makes one id per club, and pulls out dates, times and rooms | "CHESS CLUB" and "Chess Club Mtg" must be the same club, or search would show duplicates |
| `fetch_bulletin.py` | Downloads the PDF, hashes it, archives it by date, writes `today.json` only if the bulletin is dated today, compares its US SCHEDULE with the calendar | The PDF is overwritten daily, so the archive is the only history. Hashing means unchanged PDFs aren't re-parsed every 15 minutes |
| `build_indexes.py` | Builds `clubs.json`, `clubs/<id>.json` and `announcements.json` from the archive | Keeps each file small: Today only needs the short club list, a club page loads its own history |
| `run.py` | Runs the three steps in order, with `--offline`, `--feed test` and `--state` options | One command for CI, local runs and the demo |
| `report.py` | Prints every distinct label and block name in the feed | Run it whenever the school changes the calendar, then update the normalization rules |

## Website (`site/`)

| File | What it does | Why it's built this way |
|---|---|---|
| `index.html` | The page shell: navigation, the empty `#view` the screens draw into, font preloads, a tiny script that applies dark mode before the first paint | Everything else is JavaScript modules, loaded as needed |
| `js/time.js` | `now()` (real or demo clock), `hst()` (wall-clock time in Honolulu via `Intl.DateTimeFormat`), `epochAt(date, time)`, date arithmetic | **All time math goes through here.** A student whose iPad is set to California time still sees Hawaiʻi periods |
| `js/schedule.js` | `statusAt(schedule, ms)` answers "what's happening at this instant?": before school, in a block, passing, lunch, after school, no school. Also chapel-vs-homeroom naming and the Wagon tip | No DOM code at all, so it's easy to test and to reason about |
| `js/countdown.js` | The rolling digits, the progress bar, and `runFrames()`, the animation-frame loop | See "How does the countdown stay accurate?" below |
| `js/data.js` | Loads the JSON files, re-checks every 5 minutes and when the tab is shown again, tells screens when something changed | Change detection ignores `generated_at` (it changes every run) and looks at what students see |
| `js/store.js` | Settings in `localStorage`, with try/catch around every read and write; export/import codes | Some school iPads block storage. The app still works; Me says settings won't be remembered |
| `js/dom.js` | `h()` builds elements; text is always inserted as text | Bulletin text can never inject HTML into the page |
| `js/format.js` | Times, dates, countdown text, "6 min ago", "grades 9 and 10" | One place for wording |
| `js/search-date.js` | Turns "next F day", "nov 3", "school days until finals" into dates | A small hand-written parser: a few regular expressions, each with a comment, and tests for every example in the brief |
| `js/search-clubs.js` | Typo-tolerant club search with an edit-distance function | No library. About 60 lines |
| `js/search-text.js` | Full-text search with highlights | Matches on simplified text, then maps matches back to the original characters |
| `js/app.js` | Start-up, theme and motion settings, the demo banner, the router (`#/today`, `#/day/…`, `#/club/…`) | Each screen is a separate module loaded the first time it's opened |
| `js/views/today.js` | The Today screen and its animation loop | When a block ends it updates only what changed, so the countdown never blanks |
| `js/views/now.js` | The Now card: wording for each state, and the slide when a block changes | `describe()` (the words) is separate from the drawing code |
| `js/views/timeline.js` | The list of blocks drawn as a transit line (one stop per block), with the sliding highlight | Same-height rows mean the highlight moves with one `transform` |
| `js/alerts.js` | Countdown in the tab title, app-icon badge, and 5-minute reminders | Runs once a second on every screen and reads the same `statusAt()` as Today, so they can't disagree |
| `js/import-classes.js` | Turns a pasted schedule ("1 Chemistry I-203") into the eight periods | Pure function with a test for every format |
| `js/views/today-extras.js` | Schedule-change notice, to-do strip, tomorrow preview | Kept apart so `today.js` stays short |
| `js/views/me-extras.js` | Paste-schedule box, to-do editor, reminders switch | Same reason, for `me.js` |
| `js/views/daybar.js` | The whole day drawn to scale, with a needle at "now" | Segment widths are worked out once from the block times; each frame only the needle moves, with `transform` |
| `js/views/calendar.js`, `day.js`, `search.js`, `clubs.js`, `club.js`, `grade.js`, `me.js` | One screen each | Each is under 250 lines |
| `js/views/day-parts.js` | Pieces shared by several screens: the day tile, lunch list, an announcement | Avoids copying the same code into three screens |
| `css/tokens.css` | Every color, font size and spacing value as a CSS variable; the fonts | The whole look can be tuned in one file. `tests/test_contrast.py` reads it |
| `css/base.css`, `today.css`, `views.css` | Layout, navigation, controls; the Today screen; the other screens | Plain CSS, no preprocessor |
| `sw.js` | Service worker: app files from the cache (refreshed in the background), data from the network with the cache as backup | Opens instantly on slow Wi-Fi and works offline |
| `manifest.webmanifest`, `icons/` | Lets students add ʻIobot to the home screen, full screen | |
| `404.html` | Friendly page for a wrong address | Self-contained, because GitHub Pages serves it at any depth |

## Other folders

- `tests/`: pytest for the pipeline, plus Playwright tests that drive the real site in Chromium.
- `fixtures/`: the calendar and real bulletins the tests use, so tests never need the network.
- `.github/workflows/update.yml`: the schedule, the data branch, and the Pages deploy.
- `tools/make_icons.py`: renders the PNG icons from the SVG.

## Likely judge questions

**1. How does the countdown stay accurate?**
It never counts down by subtracting one. Every animation frame (about 60 times
a second) it computes `remaining = blockEnd − now` from the real clock and
rounds up to whole seconds. Digits only change when that number changes, so
they flip exactly when the real second turns over. If a frame is late, or the
iPad sleeps, the next frame just reads the clock again, so there's nothing to
drift. See `countdown.js` and `today.js`.

**2. Why GitHub Actions instead of fetching in the browser?**
Browsers block a website from reading files on other websites unless those
sites allow it (CORS). Google Calendar and iolani.org don't. A Python job on
GitHub's servers isn't a browser, so it can download them, and it can parse
the PDF once instead of on every student's iPad.

**3. What happens if the feed or bulletin is down?**
The calendar step republishes the last good schedule (saved on the `data`
branch) with an error note. The bulletin step keeps the archive and today's
copy if it already has one. In the browser, if the JSON can't load, the service
worker serves the last saved copy and the page shows "Offline". If the data is
over two hours old during school hours, Today shows a calm notice.

**4. How do you know which grades have chapel?**
Only from the day's label, e.g. `E Schedule (3,4,1,2) (Grs. 9&10 Chapel)`.
`grades.chapel_grades()` finds the note in parentheses that mentions chapel and
reads the grade numbers from it. For `(Gr. 7 Chapel/Gr. 8 remain in HR)` it
splits on `/` and only counts the part that says Chapel. `(NO CHAPEL)` or no
note means no grade has chapel.

**5. How does club search handle typos?**
It simplifies both texts (lowercase, no accents or ʻokina), drops filler words
like "club", and compares each typed word to each word in club names: exact,
start of a word, inside a word, then within one typo (two for long words) using
edit distance, which is how many single-letter changes turn one word into the
other. "mahjog" is one insertion away from "mahjong".

**6. Why are times converted to Honolulu time instead of using the device's time?**
The feed stores times in UTC, and devices can be set to any time zone. `time.js`
asks `Intl.DateTimeFormat` with `timeZone: 'Pacific/Honolulu'` what the clock
says in Honolulu, so the period is right on any device.

**7. How do special days work? Is anything hardcoded?**
Nothing about the year is hardcoded. Each day's blocks come from the feed's
timed events for that date, so an assembly day simply has an Assembly block.
The only "knowledge" in the code is how to read labels (letter, variant,
period order, chapel note) and how to name block types.

**8. What if the bulletin says a different schedule than the calendar?**
The contest says the calendar is the source of truth, so the site follows the
calendar. The pipeline logs a warning, and Today shows a one-line notice so
students know to double-check.

**9. How do you avoid showing yesterday's bulletin?**
The PDF has a date line (`DAILY BULLETIN: Friday, October 23, 2026`). The
pipeline only publishes `today.json` when that date is today in Honolulu.
Before then the site says "Today's bulletin isn't posted yet."

**10. How does it know a bulletin was corrected?**
Every download is hashed (SHA-256). A different hash means a different file,
so it's parsed again and that day's archive file is replaced. The same hash
means nothing changed, and parsing is skipped.

**11. Why no framework like React?**
The judges have to be able to read every line, and there's no build step to
explain. The whole site is about 2,200 lines of JavaScript and 1,000 of CSS across small files, and screens
load only when opened.

**12. How does it work offline?**
`sw.js` saves the app files when it first loads and every data file it
fetches. Offline, it serves those copies. The countdown only needs the schedule
and the clock, so it keeps working.

**13. How is the page updated without reloading?**
`data.js` re-fetches every 5 minutes and when the tab is shown again. It
compares the parts that matter (for example the bulletin's `updated_at`) and,
if something changed, the current screen redraws itself with a short fade.

**14. How does the "next F day" search work?**
`search-date.js` tries patterns in order: counting ("days until…"), an exact
date ("nov 3", "11/3", "monday"), then kinds of days ("F day", "assembly",
"chapel", named breaks). For "next F day" it goes through the schedule's dates
after today and keeps those whose letter is F.

**15. Why is the archive on a separate branch?**
The pipeline commits new data every school day. If that went to `main`, the
judges would have to scroll past hundreds of automatic commits to see ours. The
`data` branch holds only the archive and the last good schedule.

**16. How do you keep GitHub from turning off the schedule?**
GitHub disables scheduled workflows in public repos after 60 days without
activity, and summer break is longer. Each run calls GitHub's "enable
workflow" API, which counts as activity.

**17. How did you check colors are readable?**
`tests/test_contrast.py` reads the colors from `tokens.css` and computes the
WCAG contrast ratio for every text/background pair we use, in light and dark.
All are at least 4.5:1. The test caught one that wasn't, and we fixed it.

**18. How do you know the parser works on real data?**
The bulletin tests use real PDFs from Oct 23 and Oct 26, 2026, and four older
ones from the Wayback Machine, which show different layouts. The calendar tests
cover every case in the brief.

**19. What's demo mode?**
`?date=2026-10-21&time=09:00` makes `time.js` start its clock at that moment;
`&speed=60` makes it run 60× faster. Everything else in the app just asks
`now()`, so the whole app behaves as if it's that moment.

**20. What would you do next?**
Read the monthly Sodexo menus as a lunch fallback when the bulletin is late;
confirm the official red with the school; test on the school's own iPads.
