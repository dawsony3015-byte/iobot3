"""Download the schedule feed and write site/data/schedule.json.

If the download or parse fails, the last good schedule (kept in the state folder)
is published again with an error note, so the site never goes blank because
Google or the school's calendar had a bad minute.
"""
import hashlib
import json
import sys

import requests

from .calendar_parse import parse_feed
from .config import CONFIG, ROOT, SITE_DATA, feed_url, iso_now, now_hst, read_json, write_json
from .fetch import download


def run(state_dir, feed_name='production', offline=False):
    """Update the schedule. Returns the published schedule dict."""
    state_path = state_dir / 'state' / 'schedule.json'
    previous = read_json(state_path)
    url = '' if offline else feed_url(feed_name)
    source = f'feed:{feed_name}' if url else 'fixture'
    error = None
    try:
        if url:
            ics = download(url)
        else:
            print('No feed URL configured: using fixtures/school-calendar.ics', file=sys.stderr)
            ics = (ROOT / CONFIG['fixture_calendar']).read_bytes()
        content = parse_feed(ics, now_hst().date())
        if not content['days']:
            raise ValueError('the feed has no dates in this school year')
    except (requests.RequestException, ValueError) as exc:
        if previous is None:
            raise
        error = f'{type(exc).__name__}: {exc}'
        print(f'Calendar update failed, keeping the last good copy. {error}', file=sys.stderr)
        content, source = previous['content'], previous['source']

    for warning in content['warnings']:
        print(f'calendar warning: {warning}', file=sys.stderr)

    digest = hashlib.sha256(json.dumps(content, sort_keys=True).encode()).hexdigest()
    changed = previous is None or previous['hash'] != digest or previous['source'] != source
    changed_at = iso_now() if changed else previous['changed_at']
    write_json(state_path, {'hash': digest, 'changed_at': changed_at, 'source': source, 'content': content})

    days = content['days']
    schedule = {
        'source': source,
        'generated_at': iso_now(),
        'changed_at': changed_at,
        'synced': error is None,
        'error': error,
        'first_day': min(days),
        'last_day': max(days),
        'rotations': content['rotations'],
        'days': days,
    }
    write_json(SITE_DATA / 'schedule.json', schedule)
    print(f'schedule.json: {len(days)} dates, source={source}, changed={changed}')
    return schedule
