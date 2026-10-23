"""Settings shared by every pipeline step: file paths, the HST time zone, and which
feed URL to use. Feed URLs live in config.json, and an environment variable can
override them, so CI can keep a private Google Calendar address in a secret."""
import datetime as dt
import json
import os
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parent.parent
SITE_DATA = ROOT / 'site' / 'data'
HST = ZoneInfo('Pacific/Honolulu')
# Every network request gives up after this many seconds, so a slow school
# server can never hang a scheduled run.
TIMEOUT = 20

with open(ROOT / 'config.json', encoding='utf-8') as f:
    CONFIG = json.load(f)


def feed_url(name=None):
    """Return the URL for 'production' or 'test', or '' if none is configured.

    IOBOT_FEED_PRODUCTION_URL / IOBOT_FEED_TEST_URL override config.json.
    """
    name = name or os.environ.get('IOBOT_FEED') or CONFIG['active_feed']
    env = os.environ.get(f'IOBOT_FEED_{name.upper()}_URL', '').strip()
    return env or CONFIG['feeds'].get(name, '').strip()


def now_hst():
    """The current moment in Honolulu. IOBOT_NOW (ISO text) pins it for tests and demos."""
    pinned = os.environ.get('IOBOT_NOW')
    if pinned:
        moment = dt.datetime.fromisoformat(pinned)
        return moment.replace(tzinfo=HST) if moment.tzinfo is None else moment.astimezone(HST)
    return dt.datetime.now(HST)


def school_year_start(today):
    """July 1 of the school year containing `today`. Everything before it is old data."""
    year = today.year if today.month >= 7 else today.year - 1
    return dt.date(year, 7, 1)


def iso_now():
    return now_hst().isoformat(timespec='seconds')


def write_json(path, data):
    """Write compact UTF-8 JSON, creating folders as needed. Returns True if the file changed."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(data, ensure_ascii=False, separators=(',', ':'), sort_keys=False)
    if path.exists() and path.read_text(encoding='utf-8') == text:
        return False
    path.write_text(text, encoding='utf-8')
    return True


def read_json(path, default=None):
    path = Path(path)
    if not path.exists():
        return default
    with open(path, encoding='utf-8') as f:
        return json.load(f)
