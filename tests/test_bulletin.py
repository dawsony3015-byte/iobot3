"""Daily bulletin tests, built from real bulletins in fixtures/bulletins/.

2026-10-23 is the current layout. The older ones (2021-2024) show layouts the
school has used before: a two-column header and headings on their own line.
"""
import datetime as dt

import pytest

from pipeline.bulletin_parse import (parse_bulletin, parse_date, parse_header, parse_schedule,
                                     split_location, to_24h)
from pipeline.textnorm import search_key, slug
from tests.conftest import bulletin_text

OCT_23 = dt.date(2026, 10, 23)


@pytest.fixture(scope='module')
def oct23():
    return parse_bulletin(bulletin_text('2026-10-23'))


def by_title(items, start):
    return next(i for i in items if i['title'].startswith(start))


# ---- Date line ---------------------------------------------------------------

@pytest.mark.parametrize('line, expected', [
    ('DAILY BULLETIN: Friday, October 23, 2026', OCT_23),
    ('DAILY BULLETIN: Thursday, Sept. 3, 2026', dt.date(2026, 9, 3)),
    ('DAILY BULLETIN: Dec 3, 2021', dt.date(2021, 12, 3)),
    ('Some other PDF', None),
])
def test_parse_date(line, expected):
    assert parse_date(line) == expected


# ---- Header: food and the US SCHEDULE line -----------------------------------

def test_food_oct_23(oct23):
    assert oct23['food'] == {
        'wagon': 'Bi Bim Bap',
        'dining_hall': 'Kal Bi Style Chicken, Teriyaki Pork Sandwich, Margherita Pizza',
        'snack_bar': 'Tonkatsu',
    }


def test_us_schedule_line_oct_23(oct23):
    assert oct23['us_schedule']['letter'] == 'B'
    assert oct23['us_schedule']['periods'] == [7, 8, 1, 2, 3, 4]


def test_two_column_header_from_2021():
    # "US SCHEDULE: A Weinberg Snack Bar: Tonkatsu" puts two fields on one line.
    data = parse_bulletin(bulletin_text('2021-12-03'))
    assert data['us_schedule']['letter'] == 'A'
    assert data['us_schedule']['periods'] == [1, 2, 3, 4, 5, 6]
    assert data['food']['snack_bar'] == 'Tonkatsu'
    assert data['food']['wagon'] == 'Steak Bowl or Plate'


def test_food_that_wraps_onto_the_next_line():
    food, _ = parse_header([
        'ASC Dining Hall: Kal Bi Style Chicken, Teriyaki',
        'Pork Sandwich, Margherita Pizza',
        'One Team Wagon: Bi Bim Bap',
    ])
    assert food['dining_hall'] == 'Kal Bi Style Chicken, Teriyaki Pork Sandwich, Margherita Pizza'
    assert food['wagon'] == 'Bi Bim Bap'
    assert food['snack_bar'] == ''


def test_letter_with_variant_and_chapel_note():
    _, us = parse_header(['US SCHEDULE: E1 - (Grs. 9&10 Chapel) Periods: 1,2,3,4'])
    assert us['letter'] == 'E1'
    assert us['periods'] == [1, 2, 3, 4]


# ---- TODAY'S SCHEDULE lines --------------------------------------------------

@pytest.mark.parametrize('text, hint, expected', [
    ('12:15 pm', None, '12:15'),
    ('7:15 am', None, '07:15'),
    ('1:05 pm', None, '13:05'),
    ('1:05', None, '13:05'),      # no am/pm: 1 o'clock on a school day is afternoon
    ('9:35', None, '09:35'),
    ('6:30', 'a', '06:30'),       # the end time's "am" carries over
    ('12:00 am', None, '00:00'),
])
def test_to_24h(text, hint, expected):
    assert to_24h(text, hint) == expected


def test_schedule_line_with_club(oct23):
    item = by_title(oct23['schedule'], 'Karaoke Club')
    assert (item['start'], item['end']) == ('12:15', '13:00')
    assert item['title'] == 'Karaoke Club Mtg'
    assert item['location'] == 'Seto'
    assert item['club'] == 'Karaoke Club'


def test_schedule_line_class_name_maps_to_grade(oct23):
    item = by_title(oct23['schedule'], 'Srs. Hawaii Pacific')
    assert item['grades'] == [12]
    assert item['location'] == 'CCO'
    assert (item['start'], item['end']) == ('13:05', '14:00')


def test_schedule_line_without_end_time(oct23):
    item = by_title(oct23['schedule'], 'Student Support')
    assert (item['start'], item['end']) == ('15:10', None)
    assert item['grades'] == [8]
    assert item['location'] == 'I203'


def test_wrapped_schedule_line_is_joined(oct23):
    item = by_title(oct23['schedule'], 'K-3 Parent')
    assert 'PE-102' in item['location']
    # The continuation line is not a separate item.
    assert not any(i['title'].startswith('PE-102') for i in oct23['schedule'])
    assert item['grades'] == []  # K-3 is Lower School


def test_lower_school_grade_is_not_ours(oct23):
    assert by_title(oct23['schedule'], '3rd Gr. Dance')['grades'] == []


@pytest.mark.parametrize('rest, expected', [
    ('Karaoke Club Mtg-Seto', ('Karaoke Club Mtg', 'Seto')),
    ('Aloha Friday at the Pā-Pā, Center Ctyd.', ('Aloha Friday at the Pā', 'Pā, Center Ctyd.')),
    ('Football – Varsity vs. Damien (exc. 1:05 pm, pds. 3,4)-‘Iolani',
     ('Football – Varsity vs. Damien (exc. 1:05 pm, pds. 3,4)', '‘Iolani')),
    # Hyphens inside parentheses and before digits (room numbers) don't split.
    ('Yearbook All-Staff Late Night-SCIL302 (3:15 pm-9:00 pm)', ('Yearbook All-Staff Late Night', 'SCIL302 (3:15 pm-9:00 pm)')),
    ('US Library Hours', ('US Library Hours', '')),
])
def test_split_location(rest, expected):
    assert split_location(rest) == expected


def test_schedule_line_starting_without_a_time():
    items = parse_schedule(['Cross Country - Varsity - HHSAA Tournament (Exc. ALL DAY) - Hawaii Prep'])
    assert items[0]['start'] is None
    assert items[0]['location'] == 'Hawaii Prep'


# ---- Sections and grades -----------------------------------------------------

def test_section_headings_oct_23(oct23):
    assert [s['heading'] for s in oct23['sections']] == ['EVERYONE', 'GRS 9-11', 'ORGANIZATIONS', 'SPORTS']


def test_heading_on_the_same_line_as_the_first_entry(oct23):
    everyone = oct23['sections'][0]
    assert everyone['everyone']
    assert everyone['entries'][0]['title'] == 'Aloha Friday at the Pā'
    assert len(everyone['entries']) == 6


def test_grade_range_heading(oct23):
    section = oct23['sections'][1]
    assert section['grades'] == [9, 10, 11]
    assert section['entries'][0]['grades'] == [9, 10, 11]
    assert 'PSAT' in section['entries'][0]['text']


def test_headings_on_their_own_line_from_2022():
    data = parse_bulletin(bulletin_text('2022-12-06'))
    headings = {s['heading']: s['grades'] for s in data['sections']}
    assert headings['GRS 9-12'] == [9, 10, 11, 12]
    assert headings['GRS 7/11'] == [7, 11]   # a slash means "and"
    assert 'WEEKLY QUOTATION' in headings and 'LOST AND FOUND' in headings


def test_one_off_and_homeroom_headings():
    text = '\n'.join([
        'DAILY BULLETIN: Monday, October 26, 2026',
        'TALK WITH CONGRESSMAN ED CASE:--Join us in the Seto Hall at lunch.',
        'HOMEROOM TEACHERS (GRS 9-12):--Please read the PSAT note.',
        'GR 7:--Field trip forms are due 10/30.',
    ])
    sections = parse_bulletin(text)['sections']
    assert [s['heading'] for s in sections] == [
        'TALK WITH CONGRESSMAN ED CASE', 'HOMEROOM TEACHERS (GRS 9-12)', 'GR 7']
    assert sections[1]['grades'] == [9, 10, 11, 12]
    assert sections[2]['grades'] == [7]


def test_grades_inside_an_entry(oct23):
    sports = oct23['sections'][3]
    wrestling = next(e for e in sports['entries'] if e['title'] == 'Wrestling Team')
    assert wrestling['grades'] == [7, 8]   # "Calling all 7th and 8th graders!"


def test_everyone_entries_stay_untagged(oct23):
    # "Students in grades 7–12 are invited" is for everyone, not a grade filter.
    arc = by_title(oct23['sections'][0]['entries'], 'Academic Resource')
    assert arc['grades'] == []


def test_entry_title_with_a_colon_inside(oct23):
    orgs = oct23['sections'][2]
    titles = [e['title'] for e in orgs['entries']]
    assert 'One Team 3:16 (Grs 7-12)' in titles
    assert "ʻIolani Young Women's Collective" in titles


# ---- Clubs -------------------------------------------------------------------

def club(data, key):
    return [m for m in data['clubs'] if m['key'] == key]


def test_club_keys_oct_23(oct23):
    keys = {m['key'] for m in oct23['clubs']}
    assert {'chess club', 'mahjong club', 'badminton club', 'karaoke club', 'korean club',
            'one team 3:16', 'young entrepreneurs club', 'iolani young womens collective'} <= keys


def test_chess_club_today_at_lunch(oct23):
    [chess] = club(oct23, 'chess club')
    assert chess['events'] == [{'date': '2026-10-23', 'time': 'Lunch', 'location': 'I-203',
                                'what': 'Mtg today, Fri, Oct 23, lunch, I-203.'}]


def test_mahjong_club_meeting(oct23):
    [mahjong] = club(oct23, 'mahjong club')
    assert mahjong['name'] == 'Mahjong Club'
    assert mahjong['grades'] == [7, 8, 9, 10, 11, 12]
    event = mahjong['events'][0]
    assert (event['date'], event['time'], event['location']) == ('2026-10-23', '12:15 pm', 'N-207')


def test_badminton_next_meeting(oct23):
    [badminton] = club(oct23, 'badminton club')
    event = badminton['events'][0]
    assert (event['date'], event['time'], event['location']) == ('2026-10-26', '12:20 pm', 'Upper Gym')


def test_two_dates_in_one_entry(oct23):
    [iywc] = club(oct23, 'iolani young womens collective')
    assert iywc['name'] == "ʻIolani Young Women's Collective"
    found = [(e['date'], e['time'], e['location']) for e in iywc['events']]
    assert found == [('2026-10-26', '12:30 pm', 'the Pā'), ('2026-10-27', 'Lunch', 'ASC303')]


def test_place_names(oct23):
    [korean] = club(oct23, 'korean club')
    assert korean['events'][0]['location'] == 'dorm lobby'


def test_club_in_both_organizations_and_schedule(oct23):
    sources = sorted(m['source'] for m in club(oct23, 'karaoke club'))
    assert sources == ['organizations', 'schedule']


@pytest.mark.parametrize('a, b', [
    ('CHESS CLUB', 'Chess Club Mtg'),
    ('CHESS CLUB', 'Chess Club Mtg.'),
    ('MAHJONG CLUB 7-12', 'Mahjong Club'),
    ('ONE TEAM 3:16 (GRS 7-12)', 'One Team 3:16'),
    ("`IOLANI YOUNG WOMEN'S COLLECTIVE", "‘Iolani Young Women’s Collective"),
    ('BIBLE STUDY CLUB GRS 7-12', 'Bible Study Club'),
])
def test_club_names_normalize_to_one_key(a, b):
    from pipeline.clubs import club_key
    assert club_key(a) == club_key(b)


def test_dates_relative_to_the_bulletin():
    from pipeline.clubs import extract_events
    events = extract_events('Meet Monday, Oct 26, 12:20 pm in I-203. Then again 10/27 after school, Upper Gym.',
                            OCT_23)
    assert [(e['date'], e['time'], e['location']) for e in events] == [
        ('2026-10-26', '12:20 pm', 'I-203'), ('2026-10-27', 'After school', 'Upper Gym')]


def test_january_date_in_a_december_bulletin():
    from pipeline.clubs import extract_events
    [event] = extract_events('Next meeting 1/12 at lunch.', dt.date(2026, 12, 15))
    assert event['date'] == '2027-01-12'


def test_saturday_abbreviation_is_not_a_date():
    from pipeline.clubs import extract_events
    # "SAT" is the test; only a spelled-out "Saturday" counts.
    assert extract_events('SAT prep is open to all.', OCT_23) == []


# ---- Text cleanup for search -------------------------------------------------

@pytest.mark.parametrize('text, key', [
    ('Pā', 'pa'),
    ('ʻIolani', 'iolani'),
    ('‘Iolani', 'iolani'),
    ("'Iolani", 'iolani'),
    ('`IOLANI', 'iolani'),
    ('Hawaiʻi', 'hawaii'),
    ('grades 7–12', 'grades 7-12'),
    ('“Smash”  Club', '"smash" club'),
])
def test_search_key(text, key):
    assert search_key(text) == key


def test_slug():
    assert slug('ONE TEAM 3:16') == 'one-team-3-16'
    assert slug("ʻIolani Young Women's Collective") == 'iolani-young-womens-collective'
