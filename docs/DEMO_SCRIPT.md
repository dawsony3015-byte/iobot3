# Demo script (5 minutes)

Open these links before you start, one tab each, so there's no typing on stage.
Replace `SITE` with the live address (for example
`https://your-team.github.io/iobot-bell-schedule`). Use an iPad if you can,
connected to the projector.

| Tab | Address |
|---|---|
| 1 | `SITE/?date=2026-10-20&time=09:24:40#/today` |
| 2 | `SITE/?date=2026-11-03&time=08:00#/today` |
| 3 | `SITE/?date=2026-10-14&time=10:00#/today` |
| 4 | `SITE/?date=2026-10-20&time=09:30#/search` |
| 5 | `SITE/#/me` |
| 6 | The GitHub repository → Actions → *Update schedule and bulletin* |

Before the presentation, set grade 9 in Me (tab 5) and fill in one or two
class names, so the screens show them.

---

**0:00 to 0:30. What it is.**
"ʻIobot tells you what period it is and exactly how long is left. It reads the
school's own bell schedule calendar and the daily bulletin, so special days
just work."

**0:30 to 1:15. Today and the countdown (tab 1).**
It's Tuesday, Oct 20, an E day, at 9:24:40. Point out the E tile, the
period order with Period 3 lit, and "Chapel today, grade 9".
Wait for 9:25: the countdown rolls into passing time, the words slide over to
"Period 4 starts in", and the highlight in the timeline glides down.
"The countdown never subtracts a second. Every frame it does end time minus
now, from the real clock, so it can't drift."

**1:15 to 2:00. Special schedules (tab 2, then the calendar).**
Nov 3 is an E3 assembly day: show the Assembly block in the timeline.
Tap Calendar: red corners mark special schedules, gray days are days off, red
dots are chapel days for grade 9. Tap Oct 19 (PSAT day) and Oct 21 (F day) to
show the rotation changing.

**2:00 to 2:30. A holiday (tab 3).**
"Fall Break. Back Mon, Oct 19 · PSAT Schedule Day." Point out *Coming up*:
during a break that's what you want to know.

**2:30 to 3:15. Search (tab 4).**
Type `next F day` and press Enter: it jumps to Oct 21. Back, then type
`fall break`. Then `days until christmas break`. Then `mahjog` (with the typo):
Mahjong Club comes up. Open it: its grades, its next meeting if the bulletin
announced one, and every bulletin mention. Tap **Follow**.

**3:15 to 3:45. Switch grade (tab 5).**
In Me, change grade 9 → 11. Go to Today on tab 1: the first block now says
Homeroom instead of Chapel, and the chapel note is gone. Open Calendar: the dots
moved to grade 11's chapel days.

**3:45 to 4:45. Live data (tab 6).**
Ask Mr. Weaver to change one day in the **Test** calendar (for example, turn a
day into an assembly day). Then: Run workflow → feed: **test** → Run.
While it runs (about a minute), explain: "GitHub's servers download the
calendar feed and the bulletin PDF every 15 minutes, because browsers aren't
allowed to read them directly. The Python pipeline turns them into small JSON
files and publishes them with the site." When it finishes, open that day in
ʻIobot (refresh): the change is there. The line at the bottom of Today says
"Schedule synced just now."

**4:45 to 5:00. Close.**
"It works offline, installs to the home screen, and every behavior here has a
test: 237 of them."

---

If the network fails on stage, stay in demo mode: everything except step 6
works offline from the saved copy.
