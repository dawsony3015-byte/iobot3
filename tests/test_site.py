"""Browser tests: load the real site in Chromium (through Playwright) in demo
mode and check what a student would see.

Demo mode (?date=...&time=...) pins the clock, so these tests give the same
answer on any day. Run with `pytest tests/test_site.py`; the first time,
install the browser with `python -m playwright install chromium`.
"""
import json
import re

import pytest
from playwright.sync_api import expect, sync_playwright

ERRORS = []
# Most tests switch the service worker off so each starts fresh; Playwright
# logs that it did so. That message is the test harness, not the site.
BLOCKED_SW = re.compile('Service Worker registration blocked by Playwright')
# While a block changes, the old words slide out as the new ones slide in, so
# for 350 ms there are two copies. These pick the incoming one.
TITLE = '.now-head .swap-layer:not(.is-leaving) .now-title'
KICKER = '.now-head .swap-layer:not(.is-leaving) .now-kicker'
FOOT = '.now-foot .swap-layer:not(.is-leaving)'


@pytest.fixture(scope='module')
def browser():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        yield browser
        browser.close()


@pytest.fixture
def open_page(browser, site_url):
    """open_page('?date=2026-10-20&time=09:00#/today', grade=9) -> a loaded page."""
    contexts = []

    def opener(path, grade=None, follows=(), width=390, height=844, workers='block'):
        context = browser.new_context(viewport={'width': width, 'height': height}, service_workers=workers)
        contexts.append(context)
        settings = {'grade': grade, 'follows': list(follows)}
        context.add_init_script(f"localStorage.setItem('iobot.settings.v1', {json.dumps(json.dumps(settings))})")
        page = context.new_page()
        page.on('console', lambda m: ERRORS.append(f'{path}: {m.text}') if m.type in ('error', 'warning') and not BLOCKED_SW.search(m.text) else None)
        page.on('pageerror', lambda e: ERRORS.append(f'{path}: {e}'))
        page.goto(f'{site_url}/{path}')
        page.wait_for_selector('#view > :not(.empty)')
        return page

    yield opener
    for context in contexts:
        context.close()


def countdown(page):
    return page.locator('.cd').get_attribute('data-text')


# ---- Today -----------------------------------------------------------------

def test_mid_period_countdown(open_page):
    page = open_page('?date=2026-10-20&time=09:00#/today')
    expect(page.locator(TITLE)).to_have_text('Period 3')
    assert countdown(page) in ('25:00', '24:59')
    expect(page.locator(FOOT)).to_contain_text('until 9:25 · Next: Period 4 at 9:30')
    expect(page.locator('.tl-row.is-current .tl-name')).to_have_text('Period 3')
    expect(page.locator('.tile')).to_have_text('E')


def test_rolls_into_passing_time(open_page):
    page = open_page('?date=2026-10-20&time=09:24:58#/today')
    expect(page.locator(TITLE)).to_have_text('Period 3')
    # Two real seconds later the period is over; no reload needed.
    expect(page.locator(KICKER)).to_have_text('Passing time', timeout=4000)
    expect(page.locator(TITLE)).to_have_text('Period 4 starts in')
    assert countdown(page) in ('05:00', '04:59', '04:58')


def test_rolls_into_period_4(open_page):
    page = open_page('?date=2026-10-20&time=09:29:58#/today')
    expect(page.locator(TITLE)).to_have_text('Period 4', timeout=4000)
    expect(page.locator('.tl-row.is-current .tl-name')).to_have_text('Period 4')


def test_fall_break(open_page):
    page = open_page('?date=2026-10-14&time=10:00#/today')
    expect(page.locator('.now-big')).to_have_text('Fall Break')
    expect(page.locator(FOOT)).to_have_text('Back Mon, Oct 19 · PSAT Schedule Day')
    assert page.locator('.cd').is_hidden()


@pytest.mark.parametrize('grade, first_block', [(9, 'Chapel'), (11, 'Homeroom')])
def test_chapel_or_homeroom_by_grade(open_page, grade, first_block):
    page = open_page('?date=2026-10-20&time=07:45#/today', grade=grade)
    expect(page.locator(TITLE)).to_have_text(first_block)
    expect(page.locator('.tl-row').first.locator('.tl-name')).to_have_text(first_block)


def test_lunch_shows_the_food(open_page):
    page = open_page('?date=2026-10-23&time=12:20#/today')
    expect(page.locator(TITLE)).to_have_text('Lunch')
    expect(page.locator('.now-food')).to_contain_text('Bi Bim Bap')


def test_after_school(open_page):
    page = open_page('?date=2026-10-20&time=15:30#/today')
    expect(page.locator('.now-big')).to_have_text('Done for today')
    expect(page.locator(FOOT)).to_have_text('Tomorrow is an F day (7 · 8 · 5 · 6)')


def test_for_you_lists_grade_announcements(open_page):
    page = open_page('?date=2026-10-23&time=10:00#/today', grade=10)
    expect(page.locator('.for-you')).to_contain_text('From Mr Andrews')


# ---- Search ----------------------------------------------------------------

def test_next_f_day(open_page):
    page = open_page('?date=2026-10-20&time=09:00#/search')
    page.fill('input[type=search]', 'next F day')
    expect(page.locator('.result.is-selected')).to_have_attribute('href', '#/day/2026-10-21')
    page.press('input[type=search]', 'Enter')
    expect(page).to_have_url(re.compile(r'#/day/2026-10-21$'))


def test_fall_break_search(open_page):
    page = open_page('?date=2026-10-20&time=09:00#/search?q=fall%20break')
    expect(page.locator('.result').first).to_have_attribute('href', '#/day/2026-10-13')


@pytest.mark.parametrize('query, club', [('chess', 'chess-club'), ('mahjong', 'mahjong-club'), ('mahjog', 'mahjong-club')])
def test_club_search(open_page, query, club):
    page = open_page(f'#/search?q={query}')
    expect(page.locator('a.result[href^="#/club/"]').first).to_have_attribute('href', f'#/club/{club}')


def test_bulletin_search_highlights(open_page):
    page = open_page('#/search?q=p%C4%81')  # "pā"
    expect(page.locator('.result-text mark').first).to_have_text('Pā')


@pytest.mark.parametrize('query, expected', [
    ('nov 3', '2026-11-03'), ('11/3', '2026-11-03'), ('2026-11-03', '2026-11-03'),
    ('today', '2026-10-20'), ('tomorrow', '2026-10-21'), ('monday', '2026-10-26'), ('next friday', '2026-10-23'),
    ('next E1', '2027-02-10'), ('next assembly', '2026-11-03'), ('next day off', '2026-11-11'),
    ('thanksgiving', '2026-11-26'), ('christmas break', '2026-12-21'), ('spring break', '2027-03-15'),
    ('finals', '2027-06-01'),
])
def test_date_parser(open_page, query, expected):
    page = open_page('?date=2026-10-20&time=09:00#/today')
    found = page.evaluate("""async (q) => {
        const { searchDates } = await import('./js/search-date.js');
        const schedule = await fetch('data/schedule.json').then(r => r.json());
        return searchDates(q, schedule, '2026-10-20', 9).results[0].date;
    }""", query)
    assert found == expected


def test_counting(open_page):
    page = open_page('?date=2026-10-20&time=09:00#/today')
    count = page.evaluate("""async () => {
        const { searchDates } = await import('./js/search-date.js');
        const schedule = await fetch('data/schedule.json').then(r => r.json());
        return [searchDates('days until christmas break', schedule, '2026-10-20').count.n,
                searchDates('next chapel', schedule, '2026-10-20', 9).results[0].date];
    }""")
    assert count == [62, '2026-10-27']


# ---- Other screens ---------------------------------------------------------

def test_calendar_marks_special_and_off_days(open_page):
    page = open_page('?date=2026-10-20&time=09:00#/calendar/2026-10', grade=9)
    expect(page.locator('a[href="#/day/2026-10-19"]')).to_have_class(re.compile(r'\bis-special\b'))
    expect(page.locator('a[href="#/day/2026-10-14"]')).to_have_class(re.compile(r'\bis-off\b'))
    expect(page.locator('a[href="#/day/2026-10-20"] .cal-dot')).to_have_count(1)
    expect(page.locator('a[href="#/day/2026-10-20"]')).to_have_class(re.compile(r'\bis-today\b'))


def test_club_page_and_follow(open_page):
    page = open_page('#/club/mahjong-club')
    expect(page.locator('.page-title')).to_have_text('Mahjong Club')
    expect(page.locator('.mention')).to_have_count(1)
    page.click('button[aria-pressed]')
    expect(page.locator('button[aria-pressed="true"]')).to_have_text('Following')
    assert 'mahjong-club' in page.evaluate("localStorage.getItem('iobot.settings.v1')")


def test_grade_page(open_page):
    page = open_page('?date=2026-10-23&time=09:00#/grade/12')
    expect(page.locator('.lines')).to_contain_text('Srs. Hawaii Pacific University')


def test_settings_export_and_import(open_page):
    page = open_page('#/me', grade=10)
    code = page.evaluate("import('./js/store.js').then(s => s.exportCode())")
    assert code.startswith('IOBOT1-')
    other = open_page('#/me')
    assert other.evaluate(f"import('./js/store.js').then(s => s.importCode({json.dumps(code)}) && s.getSettings().grade)") == 10


def test_no_horizontal_scroll_at_320px(open_page):
    for route in ('#/today', '#/calendar', '#/search?q=chess', '#/me', '#/club/chess-club'):
        page = open_page(f'?date=2026-10-20&time=09:00{route}', width=320, height=640)
        assert page.evaluate('document.documentElement.scrollWidth') <= 320, route


def test_works_offline(browser, site_url):
    context = browser.new_context(viewport={'width': 390, 'height': 844})
    page = context.new_page()
    page.goto(f'{site_url}/?date=2026-10-20&time=09:00#/today')
    page.evaluate('navigator.serviceWorker.ready')
    page.reload()  # now the service worker saves the data files too
    expect(page.locator(TITLE)).to_have_text('Period 3')
    context.set_offline(True)
    page.reload()
    expect(page.locator(TITLE)).to_have_text('Period 3')
    expect(page.locator('.offline-tag')).to_be_visible()
    context.close()


def test_no_console_errors():
    # Runs last in this file: every page opened above reported here.
    assert ERRORS == [], '\n'.join(sorted(set(ERRORS)))
