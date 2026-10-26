"""Search index tests: clubs grouped across days, and repeated announcements merged."""
import json

import pytest

from pipeline import build_indexes
from pipeline.fetch_bulletin import archive_bulletin
from tests.conftest import bulletin_text

FRIDAY = bulletin_text('2026-10-23')
# Monday's bulletin repeats most of Friday's, with a new Chess Club note in mixed case.
MONDAY = (FRIDAY.replace('Friday, October 23, 2026', 'Monday, October 26, 2026')
          .replace('--CHESS CLUB: Mtg today, Fri, Oct 23, lunch, I-203.',
                   '--Chess Club Mtg: Tournament Thursday, 10/29, after school in I-203.'))


@pytest.fixture(scope='module')
def site(tmp_path_factory):
    state = tmp_path_factory.mktemp('state')
    site = tmp_path_factory.mktemp('site')
    archive = state / 'archive' / 'bulletins'
    archive.mkdir(parents=True)
    archive_bulletin(archive, FRIDAY, 'fri', '2026-10-23T07:30:00-10:00')
    archive_bulletin(archive, MONDAY, 'mon', '2026-10-26T07:30:00-10:00')
    build_indexes.run(state, site_data=site)
    return site


def load(site, name):
    return json.loads((site / name).read_text(encoding='utf-8'))


def test_one_entry_per_club_however_it_is_written(site):
    clubs = {c['id']: c for c in load(site, 'clubs.json')['clubs']}
    chess = clubs['chess-club']
    assert chess['name'] == 'Chess Club'
    assert chess['mention_count'] == 2
    assert (chess['first_seen'], chess['last_seen']) == ('2026-10-23', '2026-10-26')
    assert [(e['date'], e['time'], e['location']) for e in chess['events']] == [
        ('2026-10-23', 'Lunch', 'I-203'), ('2026-10-29', 'After school', 'I-203')]


def test_club_index_is_sorted_and_carries_grades(site):
    clubs = load(site, 'clubs.json')['clubs']
    names = [c['name'] for c in clubs]
    assert names == sorted(names, key=lambda n: n.lower().lstrip('ʻ'))
    mahjong = next(c for c in clubs if c['id'] == 'mahjong-club')
    assert mahjong['grades'] == [7, 8, 9, 10, 11, 12]


def test_club_page_lists_mentions_newest_first(site):
    page = load(site, 'clubs/chess-club.json')
    assert [m['date'] for m in page['mentions']] == ['2026-10-26', '2026-10-23']
    assert 'Tournament' in page['mentions'][0]['text']


def test_repeated_announcement_is_stored_once(site):
    data = load(site, 'announcements.json')
    halloween = [i for i in data['items'] if i['title'] == 'Halloween Costumes']
    assert len(halloween) == 1
    assert halloween[0]['dates'] == ['2026-10-23', '2026-10-26']
    assert data['first_archived'] == '2026-10-23'


def test_grade_tagged_announcement(site):
    items = load(site, 'announcements.json')['items']
    psat = next(i for i in items if 'Test Prep' in i['title'])
    assert psat['grades'] == [9, 10, 11]
    assert psat['section'] == 'GRS 9-11'


def test_club_items_link_to_their_club(site):
    items = load(site, 'announcements.json')['items']
    mahjong = next(i for i in items if i['title'].startswith('Mahjong'))
    assert mahjong['club'] == 'mahjong-club'
