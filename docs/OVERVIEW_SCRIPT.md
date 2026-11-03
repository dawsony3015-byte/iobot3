# ʻIobot overview script

A spoken walkthrough of what ʻIobot does, how it works, and why it's built
this way. About 7 minutes at a normal pace (about 1,050 words). Written to be read straight to
the camera or an audience; short paragraphs so you can glance down between
them. [Name] is a placeholder.

---

## 1. The problem (0:00)

Hi, I'm [name], and this is ʻIobot, a live bell schedule for ʻIolani's Upper
School. It's at iobot3.web.app.

At ʻIolani, every day is different. There are A through F days, the periods
rotate, some days have assembly or chapel, some days drop a period, and
there's a daily bulletin with lunch and club meetings. The original ʻIobot
widget broke, so students were left checking three different places just to
answer one question: what period is it, and how long do I have?

So my goal was simple. Open the app between classes, and in one glance you
know where you are, how long is left, and what's coming next.

## 2. What it does (0:40)

The main screen is called Today. At the top is the letter day in a big red
box, and under it the period order as a row of boxes, with the period you're
in lit up in red.

Then there's the countdown, the biggest thing on the screen. It shows the
exact time left in the period, down to the second, and the digits roll over
like a scoreboard.

Under that is a bar showing your whole day to scale, with a needle that moves
as time passes, so you can see how far it is to lunch. And there's a timeline
of every block, drawn like a train line, with each block as a stop.

It's personal. You pick your grade, so on chapel days it says "Chapel" for
your grade and "Homeroom" for everyone else. You can type in your classes, or
just paste your whole schedule, and instead of "Period 3" it says "Chemistry,
I-203."

It also shows lunch for the One Team Wagon, the dining hall and the snack bar,
announcements for your grade, and your to-do list.

## 3. The features I'm proudest of (1:40)

A few things make it different from a normal schedule app.

**It handles the weird days.** Assembly days, PSAT day, holidays, a day where
a period is dropped. Nothing is typed in by hand. It reads the school's real
calendar, so if the school invents a new kind of day, ʻIobot just follows it.

**It notices when the school changes the schedule.** Every time it reads the
calendar, it compares it with the last copy. If an upcoming day changed, say a
B day becomes an assembly day, Today tells you what changed and when.

**Search understands how students talk.** You can type "next F day," "fall
break," or "school days until finals," and it gives you the date or the count.
Club search forgives typos, so "mahjog" still finds Mahjong Club.

**It remembers the bulletin.** The school replaces the bulletin every day, so
yesterday's is gone. ʻIobot saves every one, which means club search has a
history the school's own website doesn't keep.

**After school, it shows tomorrow**, with your classes, so you can plan your
night. And it works offline, installs to your home screen, and has a demo mode
I can use to show any day and time.

## 4. How it gets the data (2:40)

Here's how it actually works. There are two sources of data.

The first is the bell schedule. The school keeps it as a Google Calendar with
one event for each day, like "E Schedule (3,4,1,2) (Grades 9 and 10 Chapel)",
plus one event for every block with its start and end time.

The second is the daily bulletin. It's a PDF the school posts at the same web
address every morning on iolani.org, and it's public.

The catch is that a website running in your browser isn't allowed to download
files from other websites unless they give permission, and Google Calendar and
iolani.org don't. So I can't just fetch them from the page.

Instead, a small Python program runs on GitHub's servers, automatically, every
15 minutes during the school day. For the bulletin, it:

1. Downloads the PDF, adding the current time to the address so it never gets
   an old cached copy.
2. Makes a fingerprint of the file. If it matches last time, nothing changed,
   so it stops.
3. Pulls the text out of the PDF and reads it line by line: the lunch lines,
   the schedule line, every section, and every club entry with its date, time,
   and room.
4. Checks the date printed on the bulletin. It only shows it if it's today's,
   so you never see yesterday's lunch.
5. Saves it to the archive, one file per day.

For the calendar, it reads every event, keeps only this school year, converts
the times to Hawaiʻi time, and works out each day's letter, period order, and
which grades have chapel.

## 5. How the pieces fit together (3:50)

So there are three parts.

**The data side** is that Python program on GitHub, refreshing every 15
minutes.

**The storage** is small data files, published with the website on Firebase.
Instead of a database server, the program writes the schedule, today's
bulletin, and the club list as files, and the bulletin archive is saved on a
separate branch of the project. Your own settings, like your grade and
classes, stay on your device and never leave it.

**The front end** is plain HTML, CSS, and JavaScript, with no framework. It
loads those files, checks for new ones every five minutes, and does all the
time math right on your device.

One detail I'm proud of: the countdown never just subtracts one second. Every
time the screen refreshes, it calculates end time minus now from the real
clock, in Hawaiʻi time. So it can't drift, even if your iPad goes to sleep or
is set to a different time zone.

## 6. Why I built it this way (4:40)

I made a few choices on purpose.

I kept it simple enough to explain every line, which is why there's no
framework.

I made it free to run. It uses Firebase's free plan and GitHub's free tools,
so the school wouldn't have to pay anything.

I made it reliable. If the calendar or bulletin can't be reached, it keeps the
last good copy instead of going blank. And there are over 260 automated tests,
including ones that check special days, the countdown rolling into the next
period, and that someone who opened the app before still gets new updates.

And I designed it for the hallway: black, white, and ʻIolani red, big
readable numbers, and red used only for what matters right now.

## 7. Why I like it (5:20)

What I like most is that it just knows. You don't have to remember if it's an
F day, or check the bulletin for lunch, or figure out if your grade has
chapel. You open it, and it already has the answer, accurate to the second.

That's ʻIobot. Thanks for watching.
