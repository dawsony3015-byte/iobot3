"""Shared test setup: parse the calendar fixture once for every calendar test."""
import datetime as dt
from pathlib import Path

import pytest

from pipeline.calendar_parse import parse_feed

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / 'fixtures'


@pytest.fixture(scope='session')
def feed():
    """The fixture feed as the pipeline would see it on Oct 20, 2026."""
    ics = (FIXTURES / 'school-calendar.ics').read_bytes()
    return parse_feed(ics, dt.date(2026, 10, 20))


@pytest.fixture(scope='session')
def days(feed):
    return feed['days']


def bulletin_text(date):
    return (FIXTURES / 'bulletins' / f'{date}.txt').read_text(encoding='utf-8')


# ---- A running copy of the site, for the browser tests ---------------------

@pytest.fixture(scope='session')
def site_url(tmp_path_factory):
    """Build site/data from the fixtures into a temporary copy of the site and
    serve it on a free local port for the length of the test run."""
    import functools
    import http.server
    import os
    import shutil
    import threading

    from pipeline import build_indexes, fetch_bulletin, fetch_calendar

    site = tmp_path_factory.mktemp('site')
    shutil.copytree(ROOT / 'site', site, dirs_exist_ok=True, ignore=shutil.ignore_patterns('data'))
    state = tmp_path_factory.mktemp('state')
    old = os.environ.get('IOBOT_NOW')
    os.environ['IOBOT_NOW'] = '2026-10-26T12:00'  # the pipeline's "now" while building
    try:
        schedule = fetch_calendar.run(state, offline=True, site_data=site / 'data')
        fetch_bulletin.run(state, schedule, offline=True, site_data=site / 'data')
        build_indexes.run(state, site_data=site / 'data')
    finally:
        if old is None:
            del os.environ['IOBOT_NOW']
        else:
            os.environ['IOBOT_NOW'] = old

    class QuietHandler(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            """Keep test output readable: no line per request."""

    handler = functools.partial(QuietHandler, directory=str(site))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f'http://127.0.0.1:{server.server_address[1]}'
    server.shutdown()
