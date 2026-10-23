"""Text cleanup shared by the calendar and bulletin parsers.

Two forms of every string are kept: the original for display, and a "search key"
that is lowercase with accents and ʻokina removed, so typing "pa" finds "Pā" and
"iolani" finds "ʻIolani". The site's search-text.js does the same steps in JS.
"""
import re
import unicodedata

# Every way the bulletin and calendar write an ʻokina or apostrophe.
OKINA_LIKE = 'ʻ‘’`´\''
DASHES = '–—‐‑−'


def clean(text):
    """Tidy text for display: one space between words, straight dashes kept as typed."""
    return re.sub(r'\s+', ' ', text or '').strip()


def search_key(text):
    """Lowercase, accent-free, punctuation-light form used only for matching."""
    text = unicodedata.normalize('NFKD', text or '')
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    text = ''.join('' if ch in OKINA_LIKE else ch for ch in text)
    text = ''.join('-' if ch in DASHES else ch for ch in text)
    text = text.replace('“', '"').replace('”', '"')
    return re.sub(r'\s+', ' ', text.lower()).strip()


def slug(text):
    """URL-safe id, e.g. "Chess Club" -> "chess-club"."""
    return re.sub(r'[^a-z0-9]+', '-', search_key(text)).strip('-')


SMALL_WORDS = {'a', 'an', 'and', 'at', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs', 'with'}
KEEP_UPPER = {'US', 'LS', 'HR', 'PSAT', 'SAT', 'AP', 'ASC', 'FTC', 'NAMI', 'PAAC', 'STEM',
              'DECA', 'FBLA', 'HOSA', 'MUN', 'JV', 'II', 'III', 'K'}


def title_case(text):
    """Turn an ALL-CAPS heading into readable title case ("FALL BREAK" -> "Fall Break").

    Text that already has lowercase letters is left alone, because the school
    typed it that way on purpose.
    """
    text = clean(text)
    if any(ch.islower() for ch in text):
        return text
    words = []
    for i, word in enumerate(text.split(' ')):
        core = re.sub(r'[^A-Za-z]', '', word)
        if core in KEEP_UPPER:
            words.append(word)
        elif i > 0 and core.lower() in SMALL_WORDS:
            words.append(word.lower())
        else:
            # Capitalize the first letter, even after a leading ʻokina or quote.
            lowered = word.lower()
            for j, ch in enumerate(lowered):
                if ch.isalpha():
                    lowered = lowered[:j] + ch.upper() + lowered[j + 1:]
                    break
            words.append(lowered)
    result = ' '.join(words)
    # The bulletin types the ʻokina as a backtick or a curly quote; show the real one.
    return re.sub(r"(^|\s)[`‘'](?=[A-Za-z])", r'\1ʻ', result)
