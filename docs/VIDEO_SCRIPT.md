# Video script (2–3 minutes)

About 2 minutes 40 seconds read at a normal pace. **Bold** is what to show on
screen; the rest is what to say. Record on an iPad or in a phone-sized browser
window at https://iobot3.web.app.

Before recording, open these in tabs so there's no typing on camera:

| Tab | Address |
|---|---|
| 1 | `https://iobot3.web.app/?date=2026-10-20&time=09:24:45#/today` |
| 2 | `https://iobot3.web.app/?date=2026-10-14&time=10:00#/today` |
| 3 | `https://iobot3.web.app/#/calendar` |
| 4 | `https://iobot3.web.app/?date=2026-10-20&time=09:00#/search` |
| 5 | `https://github.com/dawsony3015-byte/iobot3/actions` |

In Me, set grade 9 and type a class name or two first, so they show on screen.

---

## 0:00 – 0:15 · Intro

**Tab 1, Today screen, full view.**

> This is ʻIobot, a live bell schedule for ʻIolani's Upper School. Open it
> between classes and it tells you what period it is, how long is left, and
> what's for lunch. It's live at iobot3.web.app, on Firebase.

## 0:15 – 0:45 · Today and the countdown

**Point to the red day tile and the period boxes.** Wait for 9:25 so the
countdown rolls into passing time.

> Today is an E day. The red box is the period I'm in, and since I'm in
> grade 9 it says Chapel, not Homeroom, because the calendar says grades 9
> and 10 have chapel today.
>
> Watch the countdown. It doesn't subtract one every second. Every screen
> refresh, it works out end time minus now from the real clock, in Hawaiʻi
> time, so it can't drift. … There: Period 3 ended, it rolled straight into
> passing time, and the timeline moved down to Period 4.

## 0:45 – 1:05 · Special days

**Tab 2 (Fall Break), then tab 3 (Calendar).**

> On a holiday it says so, and tells me when school's back. The calendar
> shows every school day's letter. Red corners are special schedules like
> assembly days, striped days are no school, and red dots are my chapel days.

## 1:05 – 1:25 · Search

**Tab 4. Type `next F day`, press Enter. Back. Type `mahjog`.**

> Search understands dates. "Next F day" jumps to the right day. It also
> searches clubs from the daily bulletin, even with a typo: "mahjog" still
> finds Mahjong Club, with its next meeting and room.

## 1:25 – 2:25 · How it works under the hood

**Optional: show the diagram from the README, or tab 5 (GitHub Actions).**

> Here's how the pieces fit together. There are three parts.
>
> **The data.** The school publishes two things: a Google Calendar of bell
> schedules, and a daily bulletin PDF. A browser isn't allowed to download
> those directly, so a small Python program runs on GitHub every 15 minutes
> during the school day. It reads the calendar, works out each day's letter,
> period order, and chapel grades, and pulls the lunch, clubs, and grade
> announcements out of the bulletin.
>
> **The database.** Instead of a database server, the program saves its
> results as small JSON files that get published with the website on
> Firebase. Bulletins are archived on a separate branch, one file per day,
> so the club search keeps a history the school's site doesn't. Personal
> settings, like my grade and classes, stay on my own device.
>
> **The front end.** The site is plain HTML, CSS, and JavaScript, no
> framework. It loads those JSON files, checks for new ones every five
> minutes, and does all the time math on the device. It even works offline,
> because it saves a copy of the schedule.

## 2:25 – 2:40 · Close

**Back to tab 1, Today screen.**

> So: real school data, updated automatically, accurate to the second, and
> tested with over 240 automated tests. That's ʻIobot.

---

### If you run long

Cut the Calendar part of "Special days" and the offline sentence. That saves
about 15 seconds without losing any required point (features, front end,
database, logic).
