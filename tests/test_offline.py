"""The service worker must list every file the app needs to start offline.

A new JS module that isn't in sw.js's SHELL list would work online and then
break the first time a student opens ʻIobot without Wi-Fi. This catches that.
"""
import json
import re

from tests.conftest import ROOT

SITE = ROOT / 'site'
SW = (SITE / 'sw.js').read_text(encoding='utf-8')
SHELL = set(re.findall(r"^\s*'([^']+)',$", SW.split('const SHELL = [')[1].split('];')[0], re.M))


def test_every_app_file_is_cached_for_offline():
    needed = {p.relative_to(SITE).as_posix() for folder in ('js', 'css', 'fonts')
              for p in (SITE / folder).rglob('*') if p.suffix in ('.js', '.css', '.woff2')}
    assert needed - SHELL == set()


def test_every_cached_file_exists():
    missing = [f for f in SHELL if f != './' and not (SITE / f).exists()]
    assert missing == []


def test_manifest_icons_exist():
    manifest = json.loads((SITE / 'manifest.webmanifest').read_text(encoding='utf-8'))
    assert manifest['display'] == 'standalone'
    for icon in manifest['icons']:
        assert (SITE / icon['src']).exists(), icon['src']


def test_index_links_exist():
    html = (SITE / 'index.html').read_text(encoding='utf-8')
    for ref in re.findall(r'(?:href|src)="([^"#:]+)"', html):
        assert (SITE / ref).exists(), ref
