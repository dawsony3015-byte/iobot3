"""Schedule changes: a day the school edits shows up as a change, once."""
import datetime as dt
import json

from pipeline import fetch_calendar
from pipeline.changes import find_changes, recent
from tests.conftest import FIXTURES

B_DAY = {'label': 'B Schedule', 'blocks': [{'name': 'Period 7', 'start': '08:15', 'end': '09:10'}]}
E1_DAY = {'label': 'E1 Schedule (1,2,3,4)', 'blocks': [{'name': 'Assembly', 'start': '07:55', 'end': '08:35'}]}


def test_a_new_label_is_a_change():
    [change] = find_changes({'2026-11-06': B_DAY}, {'2026-11-06': E1_DAY}, '2026-10-30T08:00:00-10:00')
    assert (change['date'], change['before'], change['after'], change['times_only']) == (
        '2026-11-06', 'B Schedule', 'E1 Schedule (1,2,3,4)', False)


def test_moved_block_with_same_label():
    moved = {**B_DAY, 'blocks': [{'name': 'Period 7', 'start': '08:20', 'end': '09:10'}]}
    [change] = find_changes({'2026-11-06': B_DAY}, {'2026-11-06': moved}, 'now')
    assert change['times_only'] is True


def test_no_change_no_record():
    assert find_changes({'2026-11-06': B_DAY}, {'2026-11-06': B_DAY}, 'now') == []


def test_old_and_past_changes_drop_off():
    history = [
        {'date': '2026-11-06', 'seen_at': '2026-10-29T08:00:00-10:00'},
        {'date': '2026-10-28', 'seen_at': '2026-10-27T08:00:00-10:00'},   # day already passed
        {'date': '2026-12-01', 'seen_at': '2026-10-01T08:00:00-10:00'},   # seen too long ago
    ]
    assert [c['date'] for c in recent(history, dt.date(2026, 10, 30))] == ['2026-11-06']


def test_run_records_an_edit_between_runs(tmp_path, monkeypatch):
    ics = (FIXTURES / 'school-calendar.ics').read_bytes()
    # Turn the real Nov 6 B day into an E1 day, as if the school edited it.
    start = ics.index(b'DTSTART;VALUE=DATE:20261106')
    end = ics.index(b'END:VEVENT', start)
    edited = ics[:start] + ics[start:end].replace(b'SUMMARY:B Schedule', b'SUMMARY:E1 Schedule (1\\,2\\,3\\,4)') + ics[end:]
    assert edited != ics
    feeds = iter([ics, edited])
    monkeypatch.setattr(fetch_calendar, 'download', lambda url: next(feeds))
    monkeypatch.setattr(fetch_calendar, 'feed_url', lambda name: 'https://example.test/feed.ics')
    monkeypatch.setenv('IOBOT_NOW', '2026-10-30T08:00')
    fetch_calendar.run(tmp_path, site_data=tmp_path / 'site')
    first = json.loads((tmp_path / 'site' / 'schedule.json').read_text())
    assert first['changes'] == []      # nothing to compare with on the first run
    fetch_calendar.run(tmp_path, site_data=tmp_path / 'site')
    second = json.loads((tmp_path / 'site' / 'schedule.json').read_text())
    [change] = second['changes']
    assert (change['date'], change['before'], change['after']) == ('2026-11-06', 'B Schedule', 'E1 Schedule (1,2,3,4)')
