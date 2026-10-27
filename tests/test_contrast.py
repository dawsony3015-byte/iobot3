"""Every text color on every background it is used on must pass WCAG AA (4.5:1).

The colors are read straight from site/css/tokens.css, so changing a token
without re-checking contrast fails this test. The table this prints with
`pytest -s tests/test_contrast.py` is the one in docs/DECISIONS.md.
"""
import re

import pytest

from tests.conftest import ROOT

CSS = (ROOT / 'site' / 'css' / 'tokens.css').read_text(encoding='utf-8')

# (text, background, minimum ratio). Large text (the day tile, the countdown)
# only needs 3:1, but everything here is held to 4.5:1 anyway.
PAIRS = [
    ('ink', 'bg'), ('ink', 'surface'), ('ink', 'surface-2'), ('ink', 'bg-sunk'), ('ink', 'accent-tint'), ('ink', 'off-day'),
    ('ink-2', 'bg'), ('ink-2', 'surface'), ('ink-2', 'bg-sunk'), ('ink-2', 'accent-tint'), ('ink-2', 'off-day'),
    ('ink-3', 'bg'), ('ink-3', 'surface'), ('ink-3', 'surface-2'), ('ink-3', 'off-day'),
    ('accent', 'bg'), ('accent', 'surface'), ('accent', 'accent-tint'),
    ('on-accent', 'accent-fill'), ('on-ink', 'ink-fill'), ('banner-ink', 'banner-bg'),
]


def block(selector):
    """The custom properties declared in the first rule whose selector matches."""
    match = re.search(re.escape(selector) + r'\s*\{(.*?)\}', CSS, re.S)
    return dict(re.findall(r'--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;', match.group(1)))


THEMES = {'dark': block(':root'), 'light': block(":root[data-theme='light']")}


def luminance(hex_color):
    channels = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def ratio(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


@pytest.mark.parametrize('theme', THEMES)
@pytest.mark.parametrize('text, background', PAIRS)
def test_aa_contrast(theme, text, background):
    colors = THEMES[theme]
    value = ratio(colors[text], colors[background])
    print(f'{theme:5} {text:>10} on {background:<12} {value:5.2f}:1')
    assert value >= 4.5, f'{theme}: --{text} on --{background} is only {value:.2f}:1'


def test_light_theme_is_declared_the_same_way_twice():
    # The light colors appear once for "Light" in Me and once for "System" on a light device.
    media = CSS.split('@media (prefers-color-scheme: light)')[1]
    system_light = dict(re.findall(r'--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;', media.split('}')[0]))
    assert system_light == THEMES['light']
