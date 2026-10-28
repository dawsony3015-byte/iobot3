"""Calendar feed tests. Each date here is a case named in the project brief."""
import datetime as dt

import pytest

from pipeline.calendar_parse import holiday_name, normalize_block, parse_feed
from tests.conftest import FIXTURES


def times(day):
    return [(b['name'], b['start'], b['end']) for b in day['blocks']]


def test_e_day_oct_20(days):
    day = days['2026-10-20']
    assert day['label'] == 'E Schedule (3,4,1,2) (Grs. 9&10 Chapel)'
    assert (day['letter'], day['variant'], day['rotation']) == ('E', 'E', [3, 4, 1, 2])
    assert times(day) == [
        ('Homeroom/Chapel', '07:40', '08:10'),
        ('Period 3', '08:15', '09:25'),
        ('Period 4', '09:30', '10:40'),
        ('Meeting', '10:40', '11:45'),
        ('Lunch', '11:45', '12:30'),
        ('Period 1', '12:35', '13:45'),
        ('Period 2', '13:50', '15:00'),
    ]


def test_oct_20_chapel_is_for_grades_9_and_10(days):
    day = days['2026-10-20']
    assert day['chapel'] == [9, 10]
    # The site shows "Chapel" for grade 9 and "Homeroom" for grade 11 from these two facts.
    assert day['blocks'][0]['kind'] == 'homeroom-chapel'
    assert 9 in day['chapel'] and 11 not in day['chapel']


def test_f_day_oct_21(days):
    day = days['2026-10-21']
    assert day['label'] == 'F Schedule (7,8,5,6)'
    assert day['rotation'] == [7, 8, 5, 6]
    assert [b['name'] for b in day['blocks']] == [
        'Homeroom/Chapel', 'Period 7', 'Period 8', 'Meeting', 'Lunch', 'Period 5', 'Period 6']
    assert [b['start'] for b in day['blocks']] == [b['start'] for b in days['2026-10-20']['blocks']]


def test_psat_day_has_a_label_but_no_blocks(days):
    day = days['2026-10-19']
    assert day['type'] == 'class'
    assert day['name'] == 'PSAT Schedule Day'
    assert day['tile'] == 'PSAT'
    assert day['blocks'] == []
    assert day['special']


def test_indigenous_peoples_day(days):
    day = days['2026-10-12']
    assert day['type'] == 'no-school'
    assert day['name'] == "Indigenous Peoples' Day"


@pytest.mark.parametrize('date', ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'])
def test_fall_break(days, date):
    assert days[date]['type'] == 'no-school'
    assert days[date]['name'] == 'Fall Break'
    assert days[date]['blocks'] == []


def test_a_day_with_two_grade_chapel(days):
    day = days['2026-10-22']
    # The raw label has a double space; it is collapsed.
    assert day['label'] == 'A Schedule (Grs. 11&12 Chapel)'
    assert day['rotation'] == [1, 2, 3, 4, 5, 6]
    assert day['chapel'] == [11, 12]
    assert not day['special']
    assert times(day)[1] == ('Period 1', '08:15', '09:10')
    assert ('Lunch', '12:15', '13:00') in times(day)


def test_learned_rotations(feed):
    assert feed['rotations']['A'] == [1, 2, 3, 4, 5, 6]
    assert feed['rotations']['B'] == [7, 8, 1, 2, 3, 4]
    assert feed['rotations']['C'] == [5, 6, 7, 8, 1, 2]
    assert feed['rotations']['D'] == [3, 4, 5, 6, 7, 8]


def test_e1_assembly_day(days):
    day = days['2027-02-10']
    assert day['variant'] == 'E1'
    assert day['special']
    names = [b['name'] for b in day['blocks']]
    # "Chapel/ Assembly" (with a space) is normalized.
    assert 'Chapel/Assembly' in names
    assert day['blocks'][names.index('Chapel/Assembly')]['kind'] == 'chapel-assembly'
    assert day['rotation'] == [1, 2, 3, 4]


def test_f1_assembly_day_with_plain_homeroom(days):
    day = days['2026-08-25']
    assert day['variant'] == 'F1'
    assert day['blocks'][0]['name'] == 'Homeroom'
    assert day['blocks'][0]['kind'] == 'homeroom'
    assert day['blocks'][2]['start'] == '08:40'


def test_rotation_with_trailing_comma(days):
    assert days['2026-11-25']['rotation'] == [7, 8, 5, 6]


def test_single_grade_chapel(days):
    assert days['2026-08-12']['chapel'] == [11]
    assert days['2026-08-12']['chapel_note'] == 'Gr. 11 Chapel'


def test_no_chapel_day(days):
    day = days['2026-08-10']
    assert day['label'] == 'E2 Schedule (1,2,3,4) (NO CHAPEL)'
    assert day['chapel'] == []
    assert day['chapel_note'] == 'NO CHAPEL'


def test_grade_7_chapel_grade_8_homeroom(days):
    day = days['2026-09-14']
    assert day['chapel'] == [7]
    assert 8 not in day['chapel']


def test_chapel_schedule_without_chapel(days):
    day = days['2026-10-09']
    assert day['tile'] == 'SP'
    assert day['chapel'] == []
    assert day['rotation'] == [1, 2, 3, 4, 5, 6, 7, 8]
    assert day['special']


def test_dropped_period(days):
    day = days['2026-09-16']
    assert day['letter'] == 'C'
    assert day['dropped'] == [5]
    assert day['rotation'] == [5, 6, 7, 8, 1, 2]
    assert day['special']


@pytest.mark.parametrize('date', ['2027-06-01', '2027-06-02', '2027-06-03'])
def test_exam_week_has_two_labels(days, date):
    day = days[date]
    assert day['type'] == 'exams'
    assert sorted(day['labels']) == ['NO US CLASSES', 'US FINAL EXAMS']
    assert day['name'] == 'US Final Exams'
    assert day['blocks'] == []


def test_christmas_day(days):
    # Dec 25 has its own label in the feed, not the break's, and no blocks.
    day = days['2026-12-25']
    assert day['type'] == 'no-school'
    assert day['name'] == 'Merry Christmas'
    assert day['blocks'] == []


def test_special_christmas_schedule(days):
    day = days['2026-12-15']
    assert day['name'] == 'Special Christmas Schedule'
    assert day['rotation'] == [7, 8, 5, 6]
    # Homeroom, Christmas Chapel 1, a break, then Christmas Chapel 2.
    assert [b['kind'] for b in day['blocks'][:4]] == ['homeroom', 'chapel', 'break', 'chapel']


def test_only_this_school_year_is_kept(days):
    assert min(days) >= '2026-07-01'
    assert max(days) == '2027-06-03'
    names = {b['name'] for day in days.values() for b in day['blocks']}
    assert names <= {'Homeroom/Chapel', 'Homeroom', 'Chapel/Assembly', 'Meeting/Lunch', 'Lunch',
                     'Meeting', 'Break', 'Assembly', 'Christmas Chapel 1', 'Christmas Chapel 2',
                     'Easter Chapel 1', 'Easter Chapel 2'} | {f'Period {n}' for n in range(1, 9)}


def test_repeating_events_do_not_leak(feed):
    # The 2015 weekly "HR"/"Per 3 B" events would land on Mondays this year if expanded.
    assert all(b['name'] != 'Per 3 B' for day in feed['days'].values() for b in day['blocks'])
    assert not any('repeating' in w for w in feed['warnings'])


def test_weekends_are_not_school_days(days):
    assert '2026-10-24' not in days  # Saturday


def test_next_year_window_moves_on_july_1():
    ics = (FIXTURES / 'school-calendar.ics').read_bytes()
    assert parse_feed(ics, dt.date(2027, 7, 15))['days'] == {}
    # In June the 2026-27 year is still current.
    assert '2027-06-03' in parse_feed(ics, dt.date(2027, 6, 20))['days']


@pytest.mark.parametrize('raw, expected', [
    ('Chapel/ Assembly', ('Chapel/Assembly', 'chapel-assembly', None)),
    ('Lunch ', ('Lunch', 'lunch', None)),
    ('HR', ('Homeroom', 'homeroom', None)),
    ('Per 3 B', ('Period 3', 'period', 3)),
    ('Period 8', ('Period 8', 'period', 8)),
    ('Meeting/Lunch', ('Meeting/Lunch', 'meeting-lunch', None)),
    ('Easter Chapel 2', ('Easter Chapel 2', 'chapel', None)),
    ('Fire Drill', ('Fire Drill', 'other', None)),
])
def test_normalize_block(raw, expected):
    assert normalize_block(raw) == expected


@pytest.mark.parametrize('label, expected', [
    ('FALL BREAK', 'Fall Break'),
    ("INDIGENOUS PEOPLES' DAY SCHOOL HOLIDAY", "Indigenous Peoples' Day"),
    ('HEAD OF SCHOOL HOLIDAY', 'Head of School Holiday'),
    ('MARTIN LUTHER KING, JR. DAY SCHOOL HOLIDAY', 'Martin Luther King, Jr. Day'),
    ('KUHIO DAY SCHOOL HOLIDAY (Observed)', 'Kuhio Day (observed)'),
    ('GOOD FRIDAY SCHOOL HOLY DAY', 'Good Friday'),
    ('NO US CLASSES', 'No US Classes'),
    ('MERRY CHRISTMAS!', 'Merry Christmas'),
    ('Christmas Break', 'Christmas Break'),
])
def test_holiday_name(label, expected):
    assert holiday_name(label) == expected
