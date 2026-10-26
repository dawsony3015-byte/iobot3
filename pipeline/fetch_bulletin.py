"""Fetch the daily bulletin PDF, archive it, and write today's bulletin data.

The school overwrites the same PDF address every school day, and sometimes
again later the same day with corrections. So on every run we:
  1. download it with a cache-busting query and a no-cache header;
  2. hash the bytes and stop if they match the last run (nothing new);
  3. otherwise extract the text, parse it, and save it as
     archive/bulletins/YYYY-MM-DD.json (a correction replaces that day's file);
  4. publish today.json only if the bulletin's own date line is today in HST,
     so yesterday's bulletin is never shown as today's.
"""
import hashlib
import io
import sys

import pdfplumber
import requests
from pdfplumber.utils.exceptions import PdfminerException

from .bulletin_parse import parse_bulletin
from .clubs import club_id, is_club_section
from .config import CONFIG, ROOT, SITE_DATA, iso_now, now_hst, read_json, school_year_start, write_json
from .fetch import download


def extract_text(pdf_bytes):
    """All pages of the PDF as plain text, page after page."""
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        return '\n'.join(page.extract_text() or '' for page in pdf.pages)


def archive_bulletin(archive_dir, text, sha, seen_at):
    """Parse a bulletin and save it under its own date. Returns the saved record."""
    data = parse_bulletin(text)
    if not data['date']:
        raise ValueError('no "DAILY BULLETIN: <date>" line found')
    path = archive_dir / f"{data['date']}.json"
    old = read_json(path)
    if old and old['sha256'] == sha:
        return old
    record = {**data, 'sha256': sha, 'first_seen_at': old['first_seen_at'] if old else seen_at,
              'updated_at': seen_at, 'text': text}
    write_json(path, record)
    print(f"bulletin {data['date']}: {'corrected' if old else 'new'}")
    return record


def import_fixtures(archive_dir, today):
    """Offline mode: archive the fixture bulletins from this school year."""
    folder = ROOT / CONFIG['fixture_bulletins']
    for path in sorted(folder.iterdir()):
        if path.suffix == '.pdf':
            raw = path.read_bytes()
            text = extract_text(raw)
        elif path.suffix == '.txt' and not path.with_suffix('.pdf').exists():
            raw = path.read_bytes()
            text = raw.decode('utf-8')
        else:
            continue
        if path.stem >= school_year_start(today).isoformat():
            archive_bulletin(archive_dir, text, hashlib.sha256(raw).hexdigest(), f'{path.stem}T07:30:00-10:00')


def public(record):
    """What the site needs from an archived bulletin (no raw text, no hashes)."""
    items = [{'section': s['heading'], 'title': e['title'], 'text': e['text'],
              'grades': e['grades'], 'everyone': s['everyone'],
              'club': club_id(e['title']) if e['title'] and is_club_section(s) else None}
             for s in record['sections'] for e in s['entries']]
    schedule = [{**item, 'club': club_id(item['club']) if item['club'] else None} for item in record['schedule']]
    return {'date': record['date'], 'first_seen_at': record['first_seen_at'],
            'updated_at': record['updated_at'], 'us_schedule': record['us_schedule'],
            'food': record['food'], 'schedule': schedule, 'items': items,
            'clubs': sorted({club_id(m['key']) for m in record['clubs']})}


def check_against_feed(record, day):
    """Compare the bulletin's US SCHEDULE line with the feed. The feed always wins."""
    said = record['us_schedule']
    if not day or not (said['letter'] or said['periods']):
        return None
    letter_ok = said['letter'] in (None, day['variant'], day['letter'])
    periods_ok = not said['periods'] or said['periods'] == day['rotation']
    check = {'agrees': letter_ok and periods_ok,
             'bulletin': f"{said['letter'] or said['raw']} {','.join(map(str, said['periods']))}".strip(),
             'feed': f"{day['variant'] or day['name']} {','.join(map(str, day['rotation']))}".strip()}
    if not check['agrees']:
        print(f"WARNING: bulletin says {check['bulletin']}, feed says {check['feed']}; using the feed",
              file=sys.stderr)
    return check


def run(state_dir, schedule, offline=False, site_data=SITE_DATA):
    """Update the archive and write today.json, bulletin-recent.json and bulletins/*.json."""
    today = now_hst().date().isoformat()
    archive_dir = state_dir / 'archive' / 'bulletins'
    archive_dir.mkdir(parents=True, exist_ok=True)
    state_path = state_dir / 'state' / 'bulletin.json'
    state = read_json(state_path, {})
    error = None
    if offline:
        import_fixtures(archive_dir, now_hst().date())
    else:
        try:
            pdf = download(CONFIG['bulletin_url'])
            sha = hashlib.sha256(pdf).hexdigest()
            if sha != state.get('sha256'):  # only re-parse when the file really changed
                record = archive_bulletin(archive_dir, extract_text(pdf), sha, iso_now())
                write_json(state_path, {'sha256': sha, 'date': record['date'], 'changed_at': iso_now()})
        except (requests.RequestException, PdfminerException, ValueError) as exc:
            error = f'{type(exc).__name__}: {exc}'
            print(f'Bulletin update failed: {error}', file=sys.stderr)

    records = {p.stem: read_json(p) for p in sorted(archive_dir.glob('*.json'))}
    for date, record in records.items():
        write_json(site_data / 'bulletins' / f'{date}.json', public(record))

    todays = records.get(today)
    write_json(site_data / 'today.json', {
        'date': today, 'generated_at': iso_now(), 'posted': todays is not None, 'error': error,
        'bulletin': public(todays) if todays else None,
        'check': check_against_feed(todays, schedule['days'].get(today)) if todays else None,
        # Which days have a saved bulletin, so the site never asks for one that doesn't exist.
        'archived': sorted(records),
    })

    recent = [d for d in records if d <= today][-CONFIG['recent_bulletins']:]
    write_json(site_data / 'bulletin-recent.json', {
        'dates': recent,
        'first_archived': min(records) if records else None,
        'items': [{'date': d, **item} for d in recent for item in public(records[d])['items']],
        'schedule': [{'date': d, **item} for d in recent for item in public(records[d])['schedule']],
    })
    print(f'bulletins: {len(records)} archived, today posted={todays is not None}')
    return records
