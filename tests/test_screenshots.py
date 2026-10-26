"""Screenshots of the main screens at phone, iPad and laptop sizes, in light and
dark mode, saved to docs/screenshots/ for the README and for design review.

Skipped in normal test runs. Make them with:

    IOBOT_SCREENSHOTS=1 python -m pytest tests/test_screenshots.py
"""
import json
import os

import pytest
from playwright.sync_api import sync_playwright

from tests.conftest import ROOT

pytestmark = pytest.mark.skipif(not os.environ.get('IOBOT_SCREENSHOTS'), reason='set IOBOT_SCREENSHOTS=1 to make screenshots')

OUT = ROOT / 'docs' / 'screenshots'
SIZES = {'phone': (390, 844), 'ipad-portrait': (820, 1180), 'ipad-landscape': (1180, 820), 'desktop': (1440, 900)}
SCREENS = {
    'today': '?date=2026-10-23&time=09:41#/today',
    'holiday': '?date=2026-10-14&time=10:00#/today',
    'calendar': '?date=2026-10-23&time=09:41#/calendar/2026-10',
    'club': '?date=2026-10-23&time=09:41#/club/mahjong-club',
    'search': '?date=2026-10-23&time=09:41#/search?q=yearbook%20photo',
}
# A believable grade 10 setup, so the screenshots show class names and rooms.
SETTINGS = {
    'grade': 10,
    'follows': ['mahjong-club'],
    'classes': {
        '1': {'name': 'English 10', 'room': 'C-201'}, '2': {'name': 'Chemistry', 'room': 'I-203'},
        '3': {'name': 'World History', 'room': 'B-105'}, '4': {'free': True},
        '5': {'name': 'Geometry', 'room': 'W-210'}, '6': {'name': 'Spanish 3', 'room': 'N-104'},
        '7': {'name': 'Ceramics', 'room': 'A-112'}, '8': {'name': 'PE', 'room': 'Upper Gym'},
    },
}


@pytest.mark.parametrize('theme', ['light', 'dark'])
def test_screenshots(site_url, theme):
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for size, (width, height) in SIZES.items():
            context = browser.new_context(viewport={'width': width, 'height': height}, color_scheme=theme,
                                          service_workers='block', device_scale_factor=2 if width < 900 else 1)
            context.add_init_script(f"localStorage.setItem('iobot.settings.v1', {json.dumps(json.dumps(SETTINGS))})")
            page = context.new_page()
            for name, path in SCREENS.items():
                page.goto(f'{site_url}/{path}')
                page.wait_for_selector('#view > :not(.empty)')
                page.wait_for_timeout(700)  # let the fade-in and the bulletin finish
                page.screenshot(path=str(OUT / f'{name}-{size}-{theme}.png'))
            context.close()
        browser.close()
