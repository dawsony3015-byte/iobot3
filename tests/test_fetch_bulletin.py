"""The bulletin download step: hashing, archiving, corrections, and the rule that
yesterday's bulletin is never shown as today's. The network is replaced by the
real Oct 23 PDF, and every file is written to a temporary folder."""
import json

import pytest

from pipeline import fetch_bulletin
from tests.conftest import FIXTURES

PDF = (FIXTURES / 'bulletins' / '2026-10-23.pdf').read_bytes()
FRIDAY = {'days': {'2026-10-23': {'variant': 'B', 'letter': 'B', 'name': 'B day', 'rotation': [7, 8, 1, 2, 3, 4]}}}


@pytest.fixture
def folders(tmp_path, monkeypatch):
    calls = []

    def fake_download(url):
        calls.append(url)
        return PDF
    monkeypatch.setattr(fetch_bulletin, 'download', fake_download)
    return tmp_path / 'state', tmp_path / 'site', calls


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def test_todays_bulletin_is_published(folders, monkeypatch):
    state, site, _ = folders
    monkeypatch.setenv('IOBOT_NOW', '2026-10-23T09:00')
    fetch_bulletin.run(state, FRIDAY, site_data=site)
    today = read(site / 'today.json')
    assert today['posted'] is True
    assert today['bulletin']['food']['wagon'] == 'Bi Bim Bap'
    assert today['check']['agrees'] is True
    assert (state / 'archive' / 'bulletins' / '2026-10-23.json').exists()
    assert today['archived'] == ['2026-10-23']


def test_yesterdays_bulletin_is_not_shown_as_today(folders, monkeypatch):
    state, site, _ = folders
    # Monday morning: the school hasn't replaced Friday's PDF yet.
    monkeypatch.setenv('IOBOT_NOW', '2026-10-26T07:00')
    fetch_bulletin.run(state, FRIDAY, site_data=site)
    today = read(site / 'today.json')
    assert today['posted'] is False
    assert today['bulletin'] is None
    # Friday's is still archived and searchable.
    assert read(site / 'bulletin-recent.json')['dates'] == ['2026-10-23']


def test_unchanged_pdf_is_not_parsed_again(folders, monkeypatch):
    state, site, calls = folders
    monkeypatch.setenv('IOBOT_NOW', '2026-10-23T09:00')
    fetch_bulletin.run(state, FRIDAY, site_data=site)
    monkeypatch.setattr(fetch_bulletin, 'archive_bulletin',
                        lambda *a: pytest.fail('parsed an unchanged PDF'))
    fetch_bulletin.run(state, FRIDAY, site_data=site)
    assert len(calls) == 2


def test_a_correction_replaces_that_days_file(tmp_path):
    archive = tmp_path / 'archive'
    archive.mkdir()
    text = (FIXTURES / 'bulletins' / '2026-10-23.txt').read_text(encoding='utf-8')
    first = fetch_bulletin.archive_bulletin(archive, text, 'aaa', '2026-10-23T07:30:00-10:00')
    corrected = text.replace('Bi Bim Bap', 'Chicken Katsu')
    second = fetch_bulletin.archive_bulletin(archive, corrected, 'bbb', '2026-10-23T10:05:00-10:00')
    saved = read(archive / '2026-10-23.json')
    assert saved['food']['wagon'] == 'Chicken Katsu'
    assert saved['first_seen_at'] == first['first_seen_at'] == '2026-10-23T07:30:00-10:00'
    assert saved['updated_at'] == second['updated_at'] == '2026-10-23T10:05:00-10:00'
    assert 'Chicken Katsu' in saved['text']   # the full text is archived for search


def test_feed_wins_when_the_bulletin_disagrees(capsys):
    record = {'us_schedule': {'raw': 'C', 'letter': 'C', 'periods': [5, 6, 7, 8, 1, 2]}}
    check = fetch_bulletin.check_against_feed(record, FRIDAY['days']['2026-10-23'])
    assert check['agrees'] is False
    assert check['feed'] == 'B 7,8,1,2,3,4'
    assert 'using the feed' in capsys.readouterr().err


def test_download_failure_keeps_the_archive(folders, monkeypatch):
    import requests
    state, site, _ = folders
    monkeypatch.setenv('IOBOT_NOW', '2026-10-23T09:00')
    fetch_bulletin.run(state, FRIDAY, site_data=site)

    def offline(url):
        raise requests.ConnectionError('school site is down')
    monkeypatch.setattr(fetch_bulletin, 'download', offline)
    fetch_bulletin.run(state, FRIDAY, site_data=site)
    today = read(site / 'today.json')
    assert today['posted'] is True                 # still have this morning's copy
    assert 'school site is down' in today['error']
