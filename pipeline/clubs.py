"""Clubs in the daily bulletin: their names, grade tags, and when/where they meet.

An ORGANIZATIONS entry looks like:
    --MAHJONG CLUB 7-12: ... first meeting today, Fri, 10/23, 12:15, N-207. ...
    --ONE TEAM 3:16 (GRS 7-12): Yearbook photo on Mon, 10/26 at the Pā at 12:30 pm!
and TODAY'S SCHEDULE has lines like "12:15 pm-1:00 pm Karaoke Club Mtg-Seto".
"""
import datetime as dt
import re

from .grades import as_list
from .textnorm import clean, search_key, slug, title_case

# A grade tag at the end of a club name: "7-12", "(GRS 7-12)", "GRS 9-12", "(9)".
TAG = re.compile(r'\s*(\((?:GRS?\.?\s*)?\d{1,2}(?:\s*[-–&/]\s*\d{1,2})?\)'
                 r'|(?:GRS?\.?\s*)?\d{1,2}\s*[-–]\s*\d{1,2})$', re.I)

MONTHS = {m: i for i, m in enumerate(
    ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], 1)}
WEEKDAYS = {'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6}
DATE_TOKEN = re.compile(
    r'\b(?P<rel>today|tomorrow|tonight)\b'
    r'|\b(?P<mon>jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s+(?P<mday>\d{1,2})(?:st|nd|rd|th)?\b'
    r'|(?<![\d/])(?P<m>\d{1,2})/(?P<d>\d{1,2})(?:/(?P<y>\d{2,4}))?(?![\d/])'
    # Saturday and Sunday only count when spelled out: "SAT" is a test, "sun" is the sun.
    r'|\b(?P<wd>monday|mon|tuesday|tues|tue|wednesday|wed|thursday|thurs|thur|thu|friday|fri'
    r'|saturday|sunday)\b\.?', re.I)
TIME_TOKEN = re.compile(
    r'\b(?P<h>\d{1,2})(?::(?P<mi>\d{2}))?\s*(?P<ap>[ap])\.?m\b\.?'
    r'|\b(?P<h2>\d{1,2}):(?P<mi2>\d{2})\b'
    r'|\b(?P<word>lunch(?:time)?|after school|before school)\b', re.I)
ROOM = re.compile(r'\b[A-Z]{1,4}-?\d{3}[A-Z]?\b')
PLACES = re.compile(r"\b(?:the P[āa]|Upper Gym|Lower Gym|Seto Hall|ASC Commons|dorm lobby|"
                    r"Weinberg Snack Bar|Library|St\. Alban'?s Chapel|Kozuki Stadium|the pool|"
                    r"Meeting Room|Sullivan Center|Learning Commons|Dining Hall|wrestling room|"
                    r"I Bldg\. Ctyd\.|Center Ctyd\.|Castle Bldg\.?|Football Field|Baseball Field)(?!\w)", re.I)


def split_tag(title):
    """'BADMINTON CLUB 7-12' -> ('BADMINTON CLUB', '7-12')."""
    match = TAG.search(title)
    if not match:
        return title, ''
    return title[:match.start()].strip(), match.group(1)


def club_key(name):
    """One key per club however it's written: 'CHESS CLUB' and 'Chess Club Mtg.' -> 'chess club'."""
    key = search_key(split_tag(name)[0])
    key = re.sub(r'\b(?:mtgs?|meetings?)\b\.?', ' ', key)
    key = re.sub(r'\b(?:grs?|grades?)\b\.?\s*[\d\s&,/-]+(?:only)?', ' ', key)
    key = re.sub(r'[^a-z0-9: ]+', ' ', key)
    return re.sub(r'\s+', ' ', key).strip(' :')


def club_id(name):
    """The id used in URLs and file names: 'CHESS CLUB 7-12' -> 'chess-club'."""
    return slug(club_key(name))


def display_name(name):
    """Keep the school's own mixed case; tidy ALL CAPS ('`IOLANI ...' -> 'ʻIolani ...')."""
    name = re.sub(r'\s+(?:Mtgs?|Meetings?)\.?$', '', split_tag(name)[0], flags=re.I)
    return title_case(name)


def club_in_schedule_title(title):
    """'Karaoke Club Mtg' -> 'Karaoke Club'. None when the line isn't about a club."""
    match = re.search(r'^(.*?\bClub)\b', title, re.I)
    return clean(match.group(1)) if match else None


def resolve_date(token, bulletin_date):
    """Turn one DATE_TOKEN match into a date, relative to the bulletin's own date."""
    g = token.groupdict()
    try:
        if g['rel']:
            return bulletin_date + dt.timedelta(days=g['rel'].lower() == 'tomorrow')
        if g['wd']:
            ahead = (WEEKDAYS[g['wd'][:3].lower()] - bulletin_date.weekday()) % 7
            return bulletin_date + dt.timedelta(days=ahead)
        if g['mon']:
            month, day = MONTHS[g['mon'][:3].lower()], int(g['mday'])
        else:
            month, day = int(g['m']), int(g['d'])
        date = dt.date(bulletin_date.year, month, day)
    except ValueError:
        return None
    # "1/12" in a December bulletin means next January.
    if date < bulletin_date - dt.timedelta(days=120):
        date = date.replace(year=date.year + 1)
    return date


def time_text(match):
    """A TIME_TOKEN match -> '12:20 pm' or 'Lunch'."""
    if match.group('word'):
        return match.group('word').capitalize().replace('time', '')
    hour = int(match.group('h') or match.group('h2'))
    minute = match.group('mi') or match.group('mi2') or '00'
    half = (match.group('ap') or '').lower()
    if not half:  # a bare "12:15": guess from a school day
        half = 'a' if 7 <= hour <= 11 else 'p'
    return f'{hour}:{minute} {half}m'


def extract_events(text, bulletin_date):
    """Find '[date] [time] [place]' mentions in a club entry.

    For each date, the time and place are the first ones found between that date
    and the next one (at most 90 characters on). A weekday written right before
    an explicit date ("Mon, Oct 26") names the same day, so it's skipped.
    """
    tokens = list(DATE_TOKEN.finditer(text))
    found = {}
    for i, token in enumerate(tokens):
        following = tokens[i + 1] if i + 1 < len(tokens) else None
        if (token.group('wd') or token.group('rel')) and following and \
                following.start() - token.end() <= 3 and (following.group('mon') or following.group('m')):
            continue
        date = resolve_date(token, bulletin_date)
        if date is None:
            continue
        stop = min(following.start() if following else len(text), token.end() + 90)
        window = text[token.end():stop]
        time = TIME_TOKEN.search(window)
        place = ROOM.search(window) or PLACES.search(window)
        event = {'date': date.isoformat(), 'time': time_text(time) if time else None,
                 'location': clean(place.group(0)) if place else None,
                 'what': _sentence(text, token.start())}
        # Keep the most detailed mention of each date ("today, Fri, Oct 23, lunch, I-203").
        old = found.get(event['date'])
        if not old or _detail(event) > _detail(old):
            found[event['date']] = event
    return [found[d] for d in sorted(found)]


def _detail(event):
    return (event['time'] is not None) + (event['location'] is not None)


def _sentence(text, position):
    """The sentence around a position, for showing what a date refers to."""
    start = max(text.rfind('. ', 0, position), text.rfind('! ', 0, position), text.rfind('? ', 0, position))
    ends = [i for i in (text.find('. ', position), text.find('! ', position), text.find('? ', position)) if i != -1]
    end = min(ends) + 1 if ends else len(text)
    sentence = clean(text[start + 1 if start != -1 else 0:end])
    return sentence if len(sentence) <= 160 else sentence[:157].rstrip() + '…'


def is_club_section(section):
    """ORGANIZATIONS (and any heading with CLUB in it) holds one club per entry."""
    return bool(re.search(r'ORGANIZATION|CLUB', section['heading'], re.I))


def club_mentions(sections, schedule, bulletin_date):
    """Every club mention in one bulletin: ORGANIZATIONS entries and club lines in TODAY'S SCHEDULE."""
    mentions = []
    for section in sections:
        if not is_club_section(section):
            continue
        for entry in section['entries']:
            if not entry['title']:
                continue
            body = entry['text']
            mentions.append({
                'key': club_key(entry['title']), 'name': display_name(entry['title']),
                'grades': entry['grades'], 'text': f"{entry['title']}: {body}",
                'events': extract_events(body, bulletin_date), 'source': 'organizations'})
    for item in schedule:
        if item['club']:
            mentions.append(schedule_mention(item, item['club'], bulletin_date))
    return mentions


def schedule_mention(item, name, bulletin_date):
    """A TODAY'S SCHEDULE line as a club mention dated the bulletin's day."""
    start = None
    if item['start']:  # '13:05' -> '1:05 pm'
        hour, minute = item['start'].split(':')
        start = f"{int(hour) % 12 or 12}:{minute} {'pm' if int(hour) >= 12 else 'am'}"
    return {
        'key': club_key(name), 'name': display_name(name), 'grades': as_list(item['grades']),
        'text': f"{item['title']}" + (f" ({item['location']})" if item['location'] else ''),
        'events': [{'date': bulletin_date.isoformat(), 'time': start,
                    'location': item['location'] or None, 'what': item['title']}],
        'source': 'schedule'}
