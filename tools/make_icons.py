"""Draw the PNG app icons from the two SVGs in site/icons/.

Phones and iPads want PNG icons at fixed sizes for the home screen. This
renders the SVGs in Playwright's Chromium (already used for the tests), so
there is no extra image library to install or explain.

    python tools/make_icons.py
"""
from pathlib import Path

from playwright.sync_api import sync_playwright

ICONS = Path(__file__).resolve().parent.parent / 'site' / 'icons'
# (output file, source SVG, size in pixels)
TARGETS = [
    ('favicon-32.png', 'favicon.svg', 32),
    ('icon-192.png', 'favicon.svg', 192),
    ('icon-512.png', 'favicon.svg', 512),
    ('apple-touch-icon.png', 'icon-full.svg', 180),
    ('icon-maskable-512.png', 'icon-full.svg', 512),
]

with sync_playwright() as p:
    browser = p.chromium.launch()
    for name, source, size in TARGETS:
        page = browser.new_page(viewport={'width': size, 'height': size})
        svg = (ICONS / source).read_text(encoding='utf-8')
        page.set_content(f'<style>html,body{{margin:0;background:transparent}}svg{{display:block;width:{size}px;height:{size}px}}</style>{svg}')
        page.screenshot(path=str(ICONS / name), omit_background=True)
        page.close()
        print(f'{name}: {size}x{size}')
    browser.close()
