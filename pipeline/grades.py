"""Turn the many ways the school writes grades into plain sets of numbers 7-12.

Formats seen in the calendar and bulletin:
  chapel notes   "(Grs. 9&10 Chapel)", "(Gr. 7 Chapel/Gr. 8 remain in HR)", "(NO CHAPEL)"
  headings       "GR 9:", "GRS 9-11:"
  club tags      "BADMINTON CLUB 7-12:", "(GRS 7-12)"
  class names    "Srs." -> 12, "Jrs." -> 11, "Sophs." -> 10, "Frosh" -> 9
  prose          "grades 7–12", "7th and 8th graders", "Gr. 9 Advisory"
"""
import re

UPPER_SCHOOL = frozenset(range(7, 13))
DASH = r'\s*[-–—]\s*'

# "Grs. 9&10", "GRS 9-11", "Gr. 7", "grades 7–12", "Grs-7-11", "Grs. 9, 10 & 11"
GRADE_WORD = re.compile(
    r'\b(?:grades?|grs?)\b\.?[\s-]*'
    r'(\d{1,2}(?:\s*(?:,\s*and|[-–—&,/]|and)\s*\d{1,2})*)', re.I)
# A bare range used as a tag: "7-12" or "(7-12)" at the end of a club name.
BARE_RANGE = re.compile(r'(?<![\d:/-])(\d{1,2})' + DASH + r'(\d{1,2})(?![\d:/])')
ORDINALS = re.compile(
    r'\b((?:\d{1,2}(?:st|nd|rd|th)(?:\s*,\s*|\s+and\s+|\s*&\s*))*\d{1,2}(?:st|nd|rd|th))'
    r'\s+(?:grade|graders|grd?\.?)\b', re.I)
CLASS_NAMES = [
    (re.compile(r'\b(?:Srs\.|Seniors?)(?![a-z])', re.I), 12),
    (re.compile(r'\b(?:Jrs\.|Juniors?)(?![a-z])', re.I), 11),
    (re.compile(r'\b(?:Sophs\.?|Sophomores?)(?![a-z])', re.I), 10),
    (re.compile(r'\b(?:Frosh|Freshm[ae]n)\b', re.I), 9),
    # "Fr." is also "Father" at a church school, so it only counts as freshmen
    # when it is clearly followed by a class activity.
    (re.compile(r'\bFr\.(?=\s+(?:Class|Mtg|Meeting|Advisory|Assembly|Retreat|Orientation|'
                r'HR|Homeroom|Elections?|Photos?|Picnic|Lunch)\b)'), 9),
]
# "Student Support (8) Mtg": a lone grade number in parentheses.
PAREN_GRADE = re.compile(r'\((\d{1,2})\)')


def _numbers_to_grades(text):
    """'9&10' -> {9, 10}; '9-11' -> {9, 10, 11}; '9, 10 & 11' -> {9, 10, 11}."""
    grades = set()
    for a, b in re.findall(r'(\d{1,2})' + DASH + r'(\d{1,2})', text):
        a, b = int(a), int(b)
        if a <= b:
            grades.update(range(a, b + 1))
    text = re.sub(r'\d{1,2}' + DASH + r'\d{1,2}', ' ', text)
    grades.update(int(n) for n in re.findall(r'\d{1,2}', text))
    return {g for g in grades if g in UPPER_SCHOOL}


def chapel_grades(label):
    """Grades with chapel on a day, read from the label's chapel note.

    Returns (grades, note). "No chapel" and "no note" both give an empty set; the
    note text is kept so the site can say which one it was.
    """
    match = re.search(r'\(([^()]*chapel[^()]*)\)', label, re.I)
    if not match:
        return set(), ''
    note = match.group(1).strip()
    if re.search(r'\bno chapel\b', note, re.I):
        return set(), note
    # "Gr. 7 Chapel/Gr. 8 remain in HR": only the part that mentions Chapel counts.
    grades = set()
    for part in note.split('/'):
        if 'chapel' in part.lower():
            grades |= _numbers_to_grades(part)
    return grades, note


def grades_in(text):
    """Every grade mentioned in a heading, tag or line of text."""
    grades = set()
    for match in GRADE_WORD.finditer(text):
        grades |= _numbers_to_grades(match.group(1))
    for match in ORDINALS.finditer(text):
        grades |= _numbers_to_grades(re.sub(r'(st|nd|rd|th)', '', match.group(1)))
    for pattern, grade in CLASS_NAMES:
        if pattern.search(text):
            grades.add(grade)
    return grades


def tag_grades(tag):
    """Grades from a club tag such as '7-12', '(GRS 7-12)' or '(9)'."""
    grades = grades_in(tag)
    for a, b in BARE_RANGE.findall(tag):
        grades |= _numbers_to_grades(f'{a}-{b}')
    for n in PAREN_GRADE.findall(tag):
        grades |= _numbers_to_grades(n)
    return grades


def schedule_line_grades(title):
    """Grades for a TODAY'S SCHEDULE line: class names, 'Gr. 9', or a lone '(8)'."""
    grades = grades_in(title)
    for n in PAREN_GRADE.findall(title):
        grades |= _numbers_to_grades(n)
    return grades


def as_list(grades):
    return sorted(grades)
