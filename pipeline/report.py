"""Print every distinct day label and block name in the feed for this school year.

Run this first whenever the school changes the calendar: the normalization rules
in calendar_parse.py are based on exactly this list.

    python -m pipeline.report                 # the fixture
    python -m pipeline.report --feed test     # the live Test feed
"""
import argparse
import collections
import datetime as dt

from icalendar import Calendar

from .config import CONFIG, HST, ROOT, feed_url, now_hst, school_year_start
from .fetch import download


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--feed', help='production or test (default: the fixture)')
    args = parser.parse_args()
    url = feed_url(args.feed) if args.feed else ''
    data = download(url) if url else (ROOT / CONFIG['fixture_calendar']).read_bytes()

    keep_from = school_year_start(now_hst().date())
    labels, blocks, old_names = collections.Counter(), collections.Counter(), collections.Counter()
    years, repeating = collections.Counter(), 0
    for event in Calendar.from_ical(data).walk('VEVENT'):
        # repr() keeps trailing spaces visible, which matter for matching.
        summary = str(event.get('SUMMARY', ''))
        start = event.decoded('DTSTART')
        timed = isinstance(start, dt.datetime)
        day = start.astimezone(HST).date() if timed else start
        years[day.year] += 1
        repeating += 'RRULE' in event
        if day < keep_from:
            if timed:
                old_names[summary] += 1
            continue
        (blocks if timed else labels)[summary] += 1

    print(f'Events per year: {dict(sorted(years.items()))}')
    print(f'Repeating (RRULE) events: {repeating}')
    print(f'\nDay labels from {keep_from} on ({len(labels)} distinct):')
    for label, n in sorted(labels.items()):
        print(f'  {n:4d}  {label!r}')
    print(f'\nBlock names from {keep_from} on ({len(blocks)} distinct):')
    for name, n in sorted(blocks.items()):
        print(f'  {n:4d}  {name!r}')
    print(f'\nOlder block names ({len(old_names)} distinct):')
    for name, n in sorted(old_names.items()):
        print(f'  {n:4d}  {name!r}')


if __name__ == '__main__':
    main()
