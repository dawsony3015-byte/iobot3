"""Build the search files the site loads from the bulletin archive.

  clubs.json          one short entry per club: name, other spellings, grades,
                      when it was last mentioned, and every meeting date we know.
                      Small enough for the Today screen to load.
  clubs/<id>.json     the full text of that club's last 20 mentions, newest first.
                      Only the club page loads it.
  announcements.json  every bulletin item, for grade pages and full-text search.
                      An announcement that runs for a week is stored once with
                      all its dates, which keeps the file about a third the size.
"""
import collections
import sys

from .clubs import club_id
from .config import CONFIG, SITE_DATA, iso_now, read_json, write_json
from .fetch_bulletin import public
from .textnorm import search_key


def load_archive(state_dir):
    """All archived bulletins, oldest first."""
    folder = state_dir / 'archive' / 'bulletins'
    return [read_json(p) for p in sorted(folder.glob('*.json'))]


def build_clubs(records):
    """Group every club mention in the archive by club id."""
    grouped = collections.defaultdict(list)
    for record in records:
        for mention in record['clubs']:
            grouped[club_id(mention['key'])].append({**mention, 'date': record['date']})

    index, pages = [], {}
    for cid, mentions in grouped.items():
        mentions.sort(key=lambda m: m['date'], reverse=True)
        # The school's own spelling from ORGANIZATIONS beats a TODAY'S SCHEDULE line.
        names = collections.Counter(m['name'] for m in mentions if m['source'] == 'organizations') \
            or collections.Counter(m['name'] for m in mentions)
        name = names.most_common(1)[0][0]
        events = {}
        for mention in reversed(mentions):  # oldest first, so a newer mention of a date wins
            for event in mention['events']:
                events[event['date']] = event
        index.append({
            'id': cid,
            'name': name,
            'aliases': sorted({m['name'] for m in mentions} - {name}),
            'grades': sorted({g for m in mentions for g in m['grades']}),
            'first_seen': mentions[-1]['date'],
            'last_seen': mentions[0]['date'],
            'mention_count': len(mentions),
            'events': [events[d] for d in sorted(events)][-20:],
        })
        pages[cid] = {
            'id': cid, 'name': name,
            'mentions': [{'date': m['date'], 'source': m['source'], 'text': m['text'], 'events': m['events']}
                         for m in mentions[:CONFIG['club_mentions_kept']]],
        }
    index.sort(key=lambda c: search_key(c['name']))
    return index, pages


def build_announcements(records):
    """Every section entry, merged across days when the same text runs again."""
    merged = {}
    for record in records:
        for item in public(record)['items']:
            key = (search_key(item['title']), search_key(item['text']))
            if key in merged:
                merged[key]['dates'].append(record['date'])
            else:
                merged[key] = {**item, 'dates': [record['date']]}
    items = sorted(merged.values(), key=lambda i: i['dates'][-1], reverse=True)
    schedule = [{'date': r['date'], **line} for r in reversed(records) for line in public(r)['schedule']]
    return items, schedule


def run(state_dir, site_data=SITE_DATA):
    records = load_archive(state_dir)
    first = records[0]['date'] if records else None
    clubs, pages = build_clubs(records)
    write_json(site_data / 'clubs.json', {'generated_at': iso_now(), 'first_archived': first, 'clubs': clubs})
    for cid, page in pages.items():
        write_json(site_data / 'clubs' / f'{cid}.json', page)
    # Pages for clubs no longer in the archive would be dead links; remove them.
    for stale in (site_data / 'clubs').glob('*.json') if (site_data / 'clubs').exists() else []:
        if stale.stem not in pages:
            stale.unlink()
    items, schedule = build_announcements(records)
    write_json(site_data / 'announcements.json',
               {'generated_at': iso_now(), 'first_archived': first, 'items': items, 'schedule': schedule})
    print(f'indexes: {len(clubs)} clubs, {len(items)} announcements, {len(schedule)} schedule lines',
          file=sys.stderr)
