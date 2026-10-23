# Fixtures

Offline copies of the two data sources, used by the tests and by
`python -m pipeline.run --offline`.

## `school-calendar.ics`: stand-in until the real export is added

The raw Google Calendar export of "Bell Schedule with Periods" wasn't in the
project folder when v2 was built, and the feed URL wasn't in the config. This
file is a **reconstruction** in Google's export format:

| Part | Where it came from |
|---|---|
| Day labels for every 2026–27 date (`E Schedule (3,4,1,2) (Grs. 9&10 Chapel)`, `FALL BREAK`, …) | A day-by-day export of the real feed (`CalendarData.gs`), copied exactly, trailing and double spaces included |
| Period order and period start times | Same export |
| Block end times, Lunch and Break blocks | Reconstructed from the brief (the Oct 20 E-day times) and the Oct 23, 2026 bulletin (lunch 12:15–1:00 and "pd. 3" at 1:05–2:00 on a B day) |
| 12/25, 1/1 and 3/26 labels, and `US FINAL EXAMS` on 6/1–6/3 | Added: the export dropped dates with more than one all-day event |
| A slice of 2025–26, plus 2014–2016 events with `RRULE`, `HR`, `Per 3 B`, `Lunch ` | Added so the tests prove that old data is filtered out |

The parser doesn't depend on any of the reconstructed parts. It reads whatever
blocks the feed has. The tests check the facts listed in the project brief,
which came from the real feed. **To switch to the real thing,** replace this
file with the real export (Google Calendar → Settings → Import & export →
Export) and run `pytest`.

## `bulletins/`

Real daily bulletins from `https://www.iolani.org/uploaded/PDF/DAILY_BULLETIN.pdf`.

| File | Source |
|---|---|
| `2026-10-23.pdf` and `.txt` | Downloaded on Oct 23, 2026 |
| `2021-05-11.txt`, `2021-12-03.txt`, `2022-12-06.txt`, `2024-05-24.txt` | Wayback Machine snapshots of the same address. These show how the layout has changed over the years: a two-column header, headings on their own lines, and `Type A:` menus |

The `.txt` files are pdfplumber's `extract_text()` output, joined page by page,
exactly as the pipeline sees it.
