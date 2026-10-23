"""Read the "Bell Schedule with Periods" iCal feed into one record per date.

The feed has two kinds of events:
  * one all-day event per date whose title is the day label, e.g.
    "E Schedule (3,4,1,2) (Grs. 9&10 Chapel)" or "FALL BREAK";
  * one timed event per block ("Period 3", "Lunch", "Homeroom/Chapel"),
    stored in UTC and converted here to Honolulu time.
Everything in this file is a pure function so the tests can call it directly.
"""
import collections
import datetime as dt
import re

from icalendar import Calendar

from .config import HST, school_year_start
from .grades import chapel_grades
from .textnorm import clean, title_case

# Block titles in the feed, old and new, mapped to one display name and a kind.
# The kind is what the site uses to decide colors and chapel wording.
BLOCK_RULES = [
    (re.compile(r'^(?:period|per\.?)\s*(\d)\b', re.I), None, 'period'),
    (re.compile(r'^homeroom\s*/\s*chapel$', re.I), 'Homeroom/Chapel', 'homeroom-chapel'),
    (re.compile(r'^(?:homeroom|hr)$', re.I), 'Homeroom', 'homeroom'),
    (re.compile(r'^chapel\s*/\s*assembly$', re.I), 'Chapel/Assembly', 'chapel-assembly'),
    (re.compile(r'^meeting\s*/\s*lunch$', re.I), 'Meeting/Lunch', 'meeting-lunch'),
    (re.compile(r'^lunch$', re.I), 'Lunch', 'lunch'),
    (re.compile(r'^meeting$', re.I), 'Meeting', 'meeting'),
    (re.compile(r'^break$', re.I), 'Break', 'break'),
    (re.compile(r'^assembly$', re.I), 'Assembly', 'assembly'),
    (re.compile(r'chapel', re.I), None, 'chapel'),  # "Christmas Chapel 1", "Easter Chapel 2"
]

LETTER_DAY = re.compile(r'^([A-F])(\d)?\s+Schedule\b', re.I)
# The rotation in a label: "(3,4,1,2)", "(7,8,5,6,)" (a stray comma appears in the feed).
ROTATION = re.compile(r'\((\d(?:\s*,\s*\d)+),?\s*\)')
EXAMS = re.compile(r'\bexams?\b', re.I)
HOLIDAY = re.compile(r'holiday|break|no .*classes|christmas|new year', re.I)


def normalize_block(raw_name):
    """'Chapel/ Assembly' -> ('Chapel/Assembly', 'chapel-assembly', None);
    'Per 3 B' -> ('Period 3', 'period', 3)."""
    name = clean(raw_name)
    for pattern, display, kind in BLOCK_RULES:
        match = pattern.search(name)
        if match:
            if kind == 'period':
                number = int(match.group(1))
                return f'Period {number}', kind, number
            return display or name, kind, None
    return name, 'other', None


def holiday_name(label):
    """'INDIGENOUS PEOPLES' DAY SCHOOL HOLIDAY' -> "Indigenous Peoples' Day"."""
    label = clean(label).rstrip('!')
    label = re.sub(r'^(.*\b(?:DAY|THANKSGIVING|FRIDAY))\s+SCHOOL HOLIDAY\b', r'\1', label)
    # A trailing note like "(Observed)" is typed in mixed case; title-case the rest alone.
    main, note = re.match(r'^(.*?)\s*(\([^()]*\))?$', label).groups()
    return title_case(main) + (f' {note.lower()}' if note else '')


def read_events(ics_bytes, keep_from):
    """Split the feed into {date: [labels]} and {date: [blocks]} for dates >= keep_from."""
    labels = collections.defaultdict(list)
    blocks = collections.defaultdict(list)
    warnings = []
    for event in Calendar.from_ical(ics_bytes).walk('VEVENT'):
        summary = clean(str(event.get('SUMMARY', '')))
        start = event.decoded('DTSTART')
        if 'RRULE' in event:
            # Repeating events only exist in pre-2017 data. They are never expanded,
            # so an old weekly "HR" event with no end date cannot leak into this year.
            if _event_date(start) >= keep_from:
                warnings.append(f'Ignored repeating event "{summary}" on {_event_date(start)}')
            continue
        if isinstance(start, dt.datetime):
            end = event.decoded('DTEND') if 'DTEND' in event else start + event.decoded('DURATION')
            start_hst, end_hst = _to_hst(start), _to_hst(end)
            if start_hst.date() >= keep_from:
                name, kind, period = normalize_block(summary)
                blocks[start_hst.date()].append({
                    'name': name, 'kind': kind, 'period': period,
                    'start': start_hst.strftime('%H:%M'), 'end': end_hst.strftime('%H:%M')})
        else:
            # All-day events end the morning after their last day (DTEND is exclusive).
            end = event.decoded('DTEND') if 'DTEND' in event else start + dt.timedelta(days=1)
            day = start
            while day < end:
                if day >= keep_from and summary not in labels[day]:
                    labels[day].append(summary)
                day += dt.timedelta(days=1)
    return labels, blocks, warnings


def _event_date(value):
    return _to_hst(value).date() if isinstance(value, dt.datetime) else value


def _to_hst(value):
    # Times in the feed end in "Z" (UTC). A time with no zone is already local.
    return value.astimezone(HST) if value.tzinfo else value.replace(tzinfo=HST)


def classify(labels, blocks):
    """Build the record for one date from its labels and its timed blocks."""
    class_labels = [l for l in labels if re.search(r'\bschedule\b', l, re.I)]
    exam_labels = [l for l in labels if EXAMS.search(l)]
    primary = (class_labels or exam_labels or sorted(labels, key=_off_day_rank) or [''])[0]

    day = {
        'label': clean(primary), 'labels': labels, 'type': 'class', 'name': '', 'letter': None, 'variant': None,
        'tile': None, 'rotation': [], 'chapel': [], 'chapel_note': '', 'special': False,
        'dropped': [], 'blocks': _dedupe(blocks),
    }
    if not class_labels and (exam_labels or labels):
        day['type'] = 'exams' if exam_labels else 'no-school'
        day['name'] = holiday_name(primary)
        day['special'] = bool(exam_labels)
        return day

    letter = LETTER_DAY.match(primary)
    if letter:
        day['letter'] = letter.group(1).upper()
        day['variant'] = day['letter'] + (letter.group(2) or '')
        day['tile'] = day['variant']
        day['name'] = f"{day['variant']} day"
    else:
        day['tile'] = 'PSAT' if primary.upper().startswith('PSAT') else 'SP'
        day['name'] = clean(ROTATION.sub('', primary)) or 'Classes'

    rotation = ROTATION.search(primary)
    from_blocks = [b['period'] for b in day['blocks'] if b['kind'] == 'period']
    day['rotation'] = [int(n) for n in re.findall(r'\d', rotation.group(1))] if rotation else from_blocks
    grades, note = chapel_grades(primary)
    day['chapel'], day['chapel_note'] = sorted(grades), note
    # Anything other than a plain A-F day gets the red "special" marker on the calendar.
    has_assembly = any('assembly' in b['kind'] for b in day['blocks'])
    day['special'] = not letter or bool(letter.group(2)) or has_assembly
    return day


def _off_day_rank(label):
    # When a no-school date has several labels ("MERRY CHRISTMAS!" + "Christmas Break"),
    # show the holiday or break name first.
    return 0 if HOLIDAY.search(label) and 'no ' not in label.lower() else 1


def _dedupe(blocks):
    seen, result = set(), []
    for block in sorted(blocks, key=lambda b: (b['start'], b['end'])):
        key = (block['name'], block['start'])
        if key not in seen:
            seen.add(key)
            result.append(block)
    return result


def usual_rotations(days):
    """The normal period order for each letter, learned from the feed itself:
    the most common order among that letter's plain days."""
    counts = collections.defaultdict(collections.Counter)
    for day in days.values():
        if day['letter'] and day['variant'] == day['letter'] and day['rotation']:
            counts[day['letter']][tuple(day['rotation'])] += 1
    return {letter: list(c.most_common(1)[0][0]) for letter, c in sorted(counts.items())}


def check_rotation(date, day, rotations, warnings):
    """Compare the periods a day should have with the periods it has.

    The expected order comes from the label ("(3,4,1,2)") or, for a plain A-D day,
    from that letter's usual order. Missing periods are recorded as dropped; an
    order that doesn't fit at all is logged so a person can look at it.
    """
    actual = [b['period'] for b in day['blocks'] if b['kind'] == 'period']
    if day['type'] != 'class' or not actual:
        return
    expected = actual
    if ROTATION.search(day['label']):
        expected = day['rotation']
    elif day['letter'] and day['variant'] == day['letter']:
        expected = rotations.get(day['letter'], actual)
    if not _in_order(actual, expected):
        warnings.append(f'{date}: label says {expected}, blocks say {actual}')
        day['rotation'] = actual
        return
    day['rotation'] = expected
    day['dropped'] = [p for p in expected if p not in actual]
    if day['dropped']:
        day['special'] = True


def _in_order(actual, expected):
    """True if `actual` is `expected` with zero or more periods left out."""
    remaining = iter(expected)
    return all(p in remaining for p in actual)


def parse_feed(ics_bytes, today):
    """Turn the whole feed into {'days': {...}, 'rotations': {...}, 'warnings': [...]}.

    Only dates from July 1 of the current school year onward are kept, which
    covers this year and next year once the school adds it.
    """
    labels, blocks, warnings = read_events(ics_bytes, school_year_start(today))
    days = {}
    for date in sorted(set(labels) | set(blocks)):
        days[date.isoformat()] = classify(labels.get(date, []), blocks.get(date, []))
    rotations = usual_rotations(days)
    for date, day in days.items():
        if day['type'] != 'class' and day['blocks']:
            warnings.append(f'{date}: "{day["name"]}" has class blocks but no class label')
        check_rotation(date, day, rotations, warnings)
    return {'days': days, 'rotations': rotations, 'warnings': warnings}
