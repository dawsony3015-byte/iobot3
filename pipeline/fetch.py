"""One place for network access, so every download has the same timeout and
no-cache behavior."""
import time

import requests

from .config import TIMEOUT


def download(url):
    """GET a URL with a timeout and no caching. Raises on any HTTP error."""
    # The ?t= query makes every request unique, so no proxy can hand back an old
    # copy of a file that the school overwrites in place every day.
    joiner = '&' if '?' in url else '?'
    response = requests.get(f'{url}{joiner}t={int(time.time())}', timeout=TIMEOUT,
                            headers={'Cache-Control': 'no-cache', 'User-Agent': 'Iobot schedule updater'})
    response.raise_for_status()
    return response.content
