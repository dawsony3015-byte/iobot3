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
