"""The usage counters the app sends must be exactly what the database accepts,
and nothing personal may ever be on the list."""
import re

from tests.conftest import ROOT

JS = (ROOT / 'site' / 'js' / 'usage.js').read_text(encoding='utf-8')
RULES = (ROOT / 'firestore.rules').read_text(encoding='utf-8')
COUNTERS = re.findall(r"'?([a-z_]+(?:\.[a-z_]+)?)'?:\s*'", JS.split('export const COUNTERS = {')[1].split('};')[0])


def allowed_in_rules():
    top = re.search(r"request\.resource\.data\.keys\(\)\.hasOnly\(\[([^\]]*)\]\)", RULES).group(1)
    names = set(re.findall(r"'([a-z_]+)'", top))
    groups = {g: set(re.findall(r"'([a-z_]+)'", fields))
              for g, fields in re.findall(r"request\.resource\.data\.([a-z_]+)\.keys\(\)\.hasOnly\(\[([^\]]*)\]\)", RULES)}
    return names, groups


def test_every_counter_is_allowed_by_the_rules():
    names, groups = allowed_in_rules()
    for counter in COUNTERS:
        if '.' in counter:
            group, field = counter.split('.')
            assert group in names and field in groups.get(group, set()), counter
        else:
            assert counter in names, counter


def test_rules_allow_nothing_the_app_doesnt_send():
    names, groups = allowed_in_rules()
    sent = set(COUNTERS)
    for group, fields in groups.items():
        assert {f'{group}.{f}' for f in fields} <= sent
    assert {n for n in names if n not in groups} <= sent


def test_only_stats_documents_are_writable():
    assert "match /{document=**}" in RULES and 'allow read, write: if false' in RULES
    assert 'allow delete: if false' in RULES


def test_nothing_personal_is_counted():
    for counter in COUNTERS:
        assert not re.search(r'name|email|grade_\d|class_name|room|query|typed|_id$', counter), counter
