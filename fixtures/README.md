# Fixtures

Offline copies of the two data sources, used by the tests and by
`python -m pipeline.run --offline`.

## `school-calendar.ics`: the real feed

The "Bell Schedule with Periods" Google Calendar, exported from its public
iCal address on Oct 28, 2026 (5.8 MB, about 21,000 events from 2014 to
mid-2027). The tests run against this file, and `python -m pipeline.run
--offline` uses it instead of downloading.

An earlier version of this file was a reconstruction built from a day-by-day
export (`CalendarData.gs`) before the feed address was known. Swapping in the
real export changed 14 days: assembly-day homerooms are 5 minutes shorter than
guessed, the Christmas schedule has a break between its two chapels, Dec 25
carries only its own label, and Good Friday is spelled "SCHOOL HOLY DAY". Every
other date matched. The tests were corrected to the real values.

## `bulletins/`

Real daily bulletins from `https://www.iolani.org/uploaded/PDF/DAILY_BULLETIN.pdf`.

| File | Source |
|---|---|
| `2026-10-23.pdf` and `.txt` | Downloaded on Oct 23, 2026 |
| `2026-10-26.pdf` and `.txt` | Downloaded on Oct 26, 2026 (a C day; its US SCHEDULE line matches the calendar) |
| `2021-05-11.txt`, `2021-12-03.txt`, `2022-12-06.txt`, `2024-05-24.txt` | Wayback Machine snapshots of the same address. These show how the layout has changed over the years: a two-column header, headings on their own lines, and `Type A:` menus |

The `.txt` files are pdfplumber's `extract_text()` output, joined page by page,
exactly as the pipeline sees it.
