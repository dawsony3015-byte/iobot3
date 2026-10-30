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
