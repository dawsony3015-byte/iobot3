"""Spotting schedule changes between one run and the next.

The school sometimes edits the calendar after the year starts: a regular day
becomes an assembly day, or a block moves. Each run compares the new calendar
with the last one it saw, and every date whose label or block times differ is
recorded, so the site can say "Changed: Fri, Nov 6 is now an E1 day".
"""
import datetime as dt

KEEP_DAYS = 14  # how long a change stays listed on the site


def times(day):
    return [(b['name'], b['start'], b['end']) for b in (day or {}).get('blocks', [])]


def find_changes(old_days, new_days, seen_at):
    """Dates whose label or blocks changed, as small records for the site."""
    changes = []
    for date in sorted(set(old_days) | set(new_days)):
        old, new = old_days.get(date), new_days.get(date)
        old_label = (old or {}).get('label', '')
        new_label = (new or {}).get('label', '')
        if old_label == new_label and times(old) == times(new):
            continue
        changes.append({
            'date': date, 'seen_at': seen_at,
            'before': old_label or 'not on the calendar',
            'after': new_label or 'removed from the calendar',
            'times_only': old_label == new_label,
        })
    return changes


def recent(history, today):
    """Changes seen in the last KEEP_DAYS days, for dates that haven't passed."""
    cutoff = (today - dt.timedelta(days=KEEP_DAYS)).isoformat()
    return [c for c in history if c['seen_at'][:10] >= cutoff and c['date'] >= today.isoformat()]
