"""A student who opened ʻIobot before must get a new version without doing
anything: no clearing caches, no deleting the home-screen app.

This copies the site, opens it with the service worker running (as a real
returning visitor would have it), then "deploys" a change the way GitHub
Actions does: new files plus a new VERSION in sw.js. The open page should pick
it up and reload itself into the new version.
"""
import functools
import http.server
import re
import shutil
import threading

import pytest
from playwright.sync_api import sync_playwright

from tests.conftest import ROOT


@pytest.fixture
def served_copy(tmp_path):
    site = tmp_path / 'site'
    shutil.copytree(ROOT / 'site', site)
    if not (site / 'data' / 'schedule.json').exists():
        pytest.skip('run `python -m pipeline.run --offline` first to build site/data')

    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            """No line per request."""

        def end_headers(self):
            # Like Firebase: app files must be revalidated, never reused blindly.
            self.send_header('Cache-Control', 'no-cache')
            super().end_headers()

        def do_GET(self):
            # This server's "not modified" check only looks at file times to the
            # second, and the test deploys twice within one second. Firebase
            # compares contents, so always send the real file here.
            del self.headers['If-Modified-Since']
            super().do_GET()

    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=str(site)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    yield site, f'http://127.0.0.1:{server.server_address[1]}'
    server.shutdown()


def deploy(site, version, marker):
    """What the workflow does: changed app files and a new fingerprint in sw.js."""
    index = site / 'index.html'
    index.write_text(re.sub(r'(<head>)', rf'\1\n  <meta name="test-build" content="{marker}">',
                            re.sub(r'\n  <meta name="test-build"[^>]*>', '', index.read_text()), count=1))
    sw = site / 'sw.js'
    sw.write_text(re.sub(r"^const VERSION = '[^']*';", f"const VERSION = '{version}';", sw.read_text(), flags=re.M))


def build_marker(page):
    return page.evaluate("document.querySelector('meta[name=test-build]')?.content || null")


def test_returning_visitor_gets_the_new_version(served_copy):
    site, url = served_copy
    deploy(site, 'one', 'first')
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        page.goto(f'{url}/#/today')
        page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=15000)
        page.reload()
        page.wait_for_function('navigator.serviceWorker.controller !== null')
        assert build_marker(page) == 'first'

        deploy(site, 'two', 'second')
        # The student switches back to the tab; ʻIobot checks for a new version.
        page.evaluate('navigator.serviceWorker.getRegistration().then((r) => r.update())')
        page.wait_for_function("document.querySelector('meta[name=test-build]')?.content === 'second'", timeout=15000)

        # And it stays new after closing and reopening.
        page.goto(f'{url}/#/today')
        assert build_marker(page) == 'second'
        browser.close()


def test_works_on_return_visits_when_the_host_redirects_index_html(tmp_path):
    """Firebase (with clean URLs) redirected /index.html to /. A saved copy of a
    redirected page made every visit after the first fail with a network error."""
    site = tmp_path / 'site'
    shutil.copytree(ROOT / 'site', site)
    if not (site / 'data' / 'schedule.json').exists():
        pytest.skip('run `python -m pipeline.run --offline` first to build site/data')

    class Redirecting(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            """No line per request."""

        def do_GET(self):
            if self.path.split('?')[0] == '/index.html':
                self.send_response(301)
                self.send_header('Location', '/')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return
            super().do_GET()

    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Redirecting, directory=str(site)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_address[1]}'
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            page = browser.new_page()
            for visit in range(3):
                # A new query each time forces a real page load (a #-only change wouldn't).
                page.goto(f'{url}/?visit={visit}#/today')
                page.wait_for_selector('#view > :not(.empty)')
                if visit == 0:
                    page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=15000)
            assert page.locator('.day-head, .now').count() > 0
            browser.close()
    finally:
        server.shutdown()


def test_reset_page_rescues_a_stuck_device_and_keeps_settings(tmp_path):
    """A device that saved the broken copy before the fix can open reset.html
    (which the broken copy can't intercept) and be back in business."""
    site = tmp_path / 'site'
    shutil.copytree(ROOT / 'site', site)
    if not (site / 'data' / 'schedule.json').exists():
        pytest.skip('run `python -m pipeline.run --offline` first to build site/data')
    sw = site / 'sw.js'
    fixed = sw.read_text()
    # Recreate the old, broken service worker: no re-wrapping of redirected pages.
    sw.write_text(re.sub(r'\n  // A page saved after a server redirect.*?\n  if \(cached\?\.redirected\)[^\n]*', '', fixed, flags=re.S))
    assert 'cached?.redirected' not in sw.read_text()

    class Redirecting(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args):
            """No line per request."""

        def do_GET(self):
            del self.headers['If-Modified-Since']
            if self.path.split('?')[0] == '/index.html':
                self.send_response(301)
                self.send_header('Location', '/')
                self.send_header('Content-Length', '0')
                self.end_headers()
                return
            super().do_GET()

    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Redirecting, directory=str(site)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{server.server_address[1]}'
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            context = browser.new_context()
            page = context.new_page()
            page.goto(f'{url}/?visit=0#/today')
            page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=15000)
            page.evaluate("localStorage.setItem('iobot.settings.v1', JSON.stringify({grade: 11}))")
            with pytest.raises(Exception, match='ERR_FAILED'):
                page.goto(f'{url}/?visit=1#/today')          # stuck, like the live site was

            page = context.new_page()                         # the student taps the repair link
            page.goto(f'{url}/reset.html')
            page.wait_for_url(re.compile(r'/$'), timeout=10000)
            page.wait_for_selector('#view > :not(.empty)')
            assert page.evaluate("JSON.parse(localStorage.getItem('iobot.settings.v1')).grade") == 11
            browser.close()
    finally:
        server.shutdown()
