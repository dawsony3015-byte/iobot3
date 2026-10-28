# Video script (2–3 minutes, talking to the camera)

About 2 minutes 30 seconds at a normal speaking pace. No screen recording
needed. Short paragraphs are there so you can glance down between them.

---

**Intro (0:00)**

Hi, I'm [name], and this is ʻIobot, a live bell schedule for ʻIolani's Upper
School. It's published on Firebase at iobot3.web.app.

The idea is simple. You're walking between classes, you open it, and in one
glance you know what period it is, exactly how long is left, and what's for
lunch.

**What it does (0:20)**

The main screen shows today's letter day, like "A day," in a big red box, and
the period order underneath, with the period you're in lit up in red. Then
there's a big countdown that ticks every second, and a bar showing your whole
day to scale, so you can see how far it is to lunch.

It knows your grade, so on chapel days it says "Chapel" for the grades that
have chapel and "Homeroom" for everyone else. You can type in your class names
and rooms, so instead of "Period 3" it says "Chemistry, I-203."

It also handles the tricky days: assembly schedules, PSAT day, holidays, and
breaks. On Fall Break, for example, it tells you school's out and when you're
back.

And there's search. You can type "next F day" and it jumps to the date, or
search for a club, even with a typo, and see when it meets.

**How it works under the hood (1:10)**

There are three parts working together.

First, the data. The school publishes the bell schedule as a Google Calendar,
and the daily bulletin as a PDF. A website isn't allowed to read those
directly, so I have a small Python program that runs automatically on GitHub
every 15 minutes during the school day. It reads the calendar, figures out each
day's letter, period order, and which grades have chapel, and pulls the lunch
menu and club meetings out of the bulletin.

Second, the database. Instead of a database server, that program saves
everything as small data files that get published with the website on
Firebase. It also saves every day's bulletin, so club search has a history the
school's own site doesn't keep. Your personal settings, like your grade and
classes, stay on your own device.

Third, the front end. That's the part you see. It's plain HTML, CSS, and
JavaScript. It loads those data files, checks for new ones every five minutes,
and does the time math right on your device. The countdown doesn't just
subtract a second each time; it recalculates from the real clock, in Hawaiʻi
time, so it can't drift. And it saves a copy of the schedule, so it still
works offline.

**Close (2:15)**

So that's ʻIobot: real school data, updated automatically, accurate to the
second, and checked by over 240 automated tests. Thanks for watching.
