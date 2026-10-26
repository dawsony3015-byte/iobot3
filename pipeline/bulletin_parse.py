"""Read the text of the daily bulletin PDF into structured data.

The bulletin (as pdfplumber extracts it) looks like:

    DAILY BULLETIN: Friday, October 23, 2026
    US SCHEDULE: B Periods: 7,8,1,2,3,4
    Weinberg Snack Bar: Tonkatsu
    One Team Wagon: Bi Bim Bap
    ASC Dining Hall: Kal Bi Style Chicken, ...
    ------------------------------------------
    TODAY'S SCHEDULE
    12:15 pm-1:00 pm Karaoke Club Mtg-Seto
    ...
    EVERYONE:--ALOHA FRIDAY AT THE Pā: Grab your friends ...
    ORGANIZATIONS:--CHESS CLUB: Mtg today, Fri, Oct 23, lunch, I-203.

Older bulletins put two header fields on one line and section headings on
their own line; both layouts are handled. Club details are in clubs.py.
"""
import datetime as dt
import re

from . import clubs
from .grades import as_list, grades_in, schedule_line_grades, tag_grades
from .textnorm import clean, title_case

DATE_LINE = re.compile(r'DAILY BULLETIN:\s*(?:[A-Za-z]+,\s*)?([A-Za-z]+)\.?\s+(\d{1,2}),\s*(\d{4})')
DIVIDER = re.compile(r'^-{10,}\s*$')
# Header fields can appear anywhere on a line ("US SCHEDULE: A Weinberg Snack Bar: Tonkatsu").
HEADER_FIELDS = {
    'US SCHEDULE:': 'us_schedule', 'Periods:': 'periods',
    'Weinberg Snack Bar:': 'snack_bar', 'One Team Wagon:': 'wagon', 'ASC Dining Hall:': 'dining_hall',
    'Type A:': None, 'Type B:': None,  # menu labels used before 2022; not shown
}
HEADER_LABEL = re.compile('|'.join(re.escape(label) for label in HEADER_FIELDS))
# A section heading: ALL CAPS, then a colon, then end of line or the first "--" entry.
HEADING = re.compile(r"^(?P<heading>[A-Z0-9][A-Z0-9 .,'’&/()\-–]{1,60}?):(?P<rest>--.*|-\s*[A-Z].*|\s*)$")
ENTRY_START = re.compile(r"^-{1,2}\s*(?=[A-Z0-9`'‘ʻ\"“(])")
TIME = r'\d{1,2}:\d{2}\s*(?:am|pm|a\.m\.|p\.m\.)?'
SCHEDULE_LINE = re.compile(rf'^(?P<start>{TIME})\s*(?:-\s*(?P<end>{TIME}))?\s+(?P<rest>.+)$', re.I)


def parse_date(text):
    """'DAILY BULLETIN: Friday, October 23, 2026' -> date(2026, 10, 23), or None."""
    match = DATE_LINE.search(text)
    if not match:
        return None
    month, day, year = match.groups()
    try:
        # The first three letters are enough and cover "Sept" and "Sep." too.
        return dt.datetime.strptime(f'{month[:3].title()} {day} {year}', '%b %d %Y').date()
    except ValueError:
        return None


def split_parts(lines):
    """Split the bulletin into header lines, TODAY'S SCHEDULE lines and section lines."""
    header, schedule, sections = [], [], []
    part = header
    for line in lines:
        if line.startswith('DAILY BULLETIN:') or DIVIDER.match(line):
            continue
        if line.strip().upper() == "TODAY'S SCHEDULE":
            part = schedule
            continue
        if part is not sections and HEADING.match(line):
            part = sections
        part.append(line)
    return header, schedule, sections


def parse_header(lines):
    """Food and the US SCHEDULE line. A line with no label continues the previous field."""
    fields, current = {}, None
    for line in lines:
        pieces = HEADER_LABEL.split(line)
        labels = HEADER_LABEL.findall(line)
        if pieces[0].strip() and current:
            fields[current] = f'{fields[current]} {pieces[0].strip()}'
        for label, value in zip(labels, pieces[1:]):
            current = HEADER_FIELDS[label]
            if current:
                fields[current] = clean(value)
    food = {key: fields.get(key, '') for key in ('wagon', 'dining_hall', 'snack_bar')}
    raw = fields.get('us_schedule', '')
    letter = re.match(r'^([A-F]\d?)\b', raw)
    us_schedule = {
        'raw': raw,
        'letter': letter.group(1) if letter else None,
        'periods': [int(n) for n in re.findall(r'\d', fields.get('periods', ''))],
    }
    return food, us_schedule


def to_24h(text, hint=None):
    """'1:05 pm' -> '13:05'. With no am/pm, use the hint, else assume a school day (7-11 am)."""
    match = re.match(r'(\d{1,2}):(\d{2})\s*([ap])?', text.strip(), re.I)
    hour, minute, half = int(match.group(1)), match.group(2), (match.group(3) or hint or '').lower()
    if not half:
        half = 'a' if 7 <= hour <= 11 else 'p'
    if half == 'p' and hour != 12:
        hour += 12
    if half == 'a' and hour == 12:
        hour = 0
    return f'{hour:02d}:{minute}'


def split_location(rest):
    """'Karaoke Club Mtg-Seto' -> ('Karaoke Club Mtg', 'Seto'). A best guess.

    The location follows the last hyphen that isn't inside parentheses and isn't
    part of a room number or time ("A-110", "7:15am-2:30pm").
    """
    depth, cut = 0, None
    for i, ch in enumerate(rest):
        depth += ch == '('
        depth -= ch == ')'
        if ch == '-' and depth == 0 and 0 < i < len(rest) - 1:
            after = rest[i + 1:].lstrip()
            if after and not after[0].isdigit():
                cut = i
    if cut is None:
        return clean(rest), ''
    return clean(rest[:cut]), clean(rest[cut + 1:])


def parse_schedule(lines):
    """TODAY'S SCHEDULE lines -> [{start, end, title, location, grades}]."""
    joined = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # A line without a leading time continues the previous one if that one was
        # cut off mid-list (ends with a comma, '&' or an open parenthesis).
        if joined and not SCHEDULE_LINE.match(line) and (
                joined[-1].endswith((',', '&', '-', '(')) or joined[-1].count('(') > joined[-1].count(')')):
            joined[-1] = f'{joined[-1]} {line}'
        else:
            joined.append(line)
    items = []
    for line in joined:
        match = SCHEDULE_LINE.match(line)
        if match:
            end_text = match.group('end')
            end = to_24h(end_text) if end_text else None
            hint = re.search(r'([ap])\.?m', end_text or '', re.I)
            start = to_24h(match.group('start'), hint.group(1) if hint else None)
            if end and start > end:  # "11:00 - 1:00 pm": the start is morning
                start = to_24h(match.group('start'), 'a')
            rest = match.group('rest')
        else:
            start = end = None
            rest = line
        title, location = split_location(rest)
        items.append({'start': start, 'end': end, 'title': title, 'location': location,
                      'grades': as_list(schedule_line_grades(title)),
                      'club': clubs.club_in_schedule_title(title)})
    return items


def split_entry_title(text):
    """'CHESS CLUB: Mtg today...' -> ('CHESS CLUB', 'Mtg today...').

    The title ends at the first colon followed by a space, so the colon inside
    "ONE TEAM 3:16" doesn't end it. Short mixed-case titles are accepted too.
    """
    match = re.match(r'^(.{2,100}?):(?=\s|$)', text)
    if match:
        title = match.group(1).strip()
        if not re.search(r'[a-z]', title) or len(title.split()) <= 10:
            return title, text[match.end():].strip()
    return '', text


def parse_sections(lines):
    """Section lines -> [{heading, grades, everyone, entries: [{title, text, grades}]}]."""
    sections = []
    for line in lines:
        line = line.rstrip()
        heading = HEADING.match(line)
        if heading:
            name = heading.group('heading').strip()
            sections.append({'heading': name, 'grades': grades_in(name),
                             'everyone': name.upper().startswith('EVERYONE'), 'entries': []})
            line = heading.group('rest').strip()
            if not line:
                continue
        if not sections:
            continue
        entries = sections[-1]['entries']
        if ENTRY_START.match(line) or not entries:
            entries.append(ENTRY_START.sub('', line).strip())
        else:
            entries[-1] = f'{entries[-1]} {line.strip()}'
    for section in sections:
        section['entries'] = [_entry(section, raw) for raw in section['entries'] if raw.strip()]
        section['grades'] = as_list(section['grades'])
    return sections


def _entry(section, raw):
    title, body = split_entry_title(clean(raw))
    name, tag = clubs.split_tag(title)
    grades = set(section['grades']) | tag_grades(tag)
    if not section['everyone']:
        grades |= grades_in(f'{title} {body}')
    # The grade tag is kept as numbers in `grades`, so the title doesn't repeat it.
    return {'title': title_case(name), 'text': body, 'grades': as_list(grades)}


def parse_bulletin(text):
    """The whole bulletin as a dict. `date` is None if the date line can't be read."""
    date = parse_date(text)
    header, schedule_lines, section_lines = split_parts(text.splitlines())
    food, us_schedule = parse_header(header)
    sections = parse_sections(section_lines)
    schedule = parse_schedule(schedule_lines)
    return {
        'date': date.isoformat() if date else None,
        'us_schedule': us_schedule,
        'food': food,
        'schedule': schedule,
        'sections': sections,
        'clubs': clubs.club_mentions(sections, schedule, date) if date else [],
    }
