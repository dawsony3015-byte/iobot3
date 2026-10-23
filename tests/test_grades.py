"""Every grade format found in the calendar and the bulletins."""
import pytest

from pipeline.grades import chapel_grades, grades_in, schedule_line_grades, tag_grades

ALL = set(range(7, 13))


@pytest.mark.parametrize('label, grades, note', [
    ('E Schedule (3,4,1,2) (Grs. 9&10 Chapel)', {9, 10}, 'Grs. 9&10 Chapel'),
    ('A Schedule (Grs. 11&12 Chapel)', {11, 12}, 'Grs. 11&12 Chapel'),
    ('C Schedule (Grs. 7&8 Chapel)', {7, 8}, 'Grs. 7&8 Chapel'),
    ('B Schedule (Gr. 10 Chapel)', {10}, 'Gr. 10 Chapel'),
    ('A Schedule (Gr. 7 Chapel/Gr. 8 remain in HR)', {7}, 'Gr. 7 Chapel/Gr. 8 remain in HR'),
    ('E2 Schedule (1,2,3,4) (NO CHAPEL)', set(), 'NO CHAPEL'),
    ('D Schedule (No Chapel)', set(), 'No Chapel'),
    ('Chapel (No Chapel) Schedule', set(), 'No Chapel'),
    ('B Schedule ', set(), ''),
    ('PSAT Schedule Day', set(), ''),
])
def test_chapel_grades(label, grades, note):
    assert chapel_grades(label) == (grades, note)


@pytest.mark.parametrize('text, expected', [
    ('GR 9', {9}),
    ('GR. 8', {8}),
    ('GRS 9-11', {9, 10, 11}),
    ('GRS 9–11', {9, 10, 11}),
    ('GRS 7/11', {7, 11}),
    ('Grs. 7&8', {7, 8}),
    ('Gr. 7', {7}),
    ('Grs-7-11 Classes', {7, 8, 9, 10, 11}),
    ('grades 7–12', ALL),
    ('grades 9, 10, and 11', {9, 10, 11}),
    ('Calling all 7th and 8th graders!', {7, 8}),
    ('SENIORS', {12}),
    ('3rd Gr. Dance', set()),          # Lower School grade, not ours
    ('Gr. 6 Moving-up Ceremony', set()),
    ('EVERYONE', set()),
])
def test_grades_in(text, expected):
    assert grades_in(text) == expected


@pytest.mark.parametrize('tag, expected', [
    ('7-12', ALL),
    ('(7-12)', ALL),
    ('(GRS 7-12)', ALL),
    ('GRS 9-12', {9, 10, 11, 12}),
    ('(9)', {9}),
    ('', set()),
])
def test_tag_grades(tag, expected):
    assert tag_grades(tag) == expected


@pytest.mark.parametrize('title, expected', [
    ('Srs. Hawaii Pacific University - pd. 3', {12}),
    ('Jrs. College Counseling Mtg', {11}),
    ('Sophs. Class Mtg', {10}),
    ('Frosh Retreat', {9}),
    ('Fr. Class Mtg', {9}),
    ('Fr. Bill Chapel Service', set()),   # "Fr." as in Father
    ('Student Support (8) Mtg', {8}),
    ('Gr. 9 Advisory PD Mtg.', {9}),
    ('Football – Varsity vs. Damien (exc. 1:05 pm, pds. 3,4)', set()),
    ('K-3 Parent/Teacher Conf.', set()),
])
def test_schedule_line_grades(title, expected):
    assert schedule_line_grades(title) == expected
