"""Run the whole pipeline: calendar, then bulletin, then search indexes.

    python -m pipeline.run --offline            # fixtures only, no network
    python -m pipeline.run --feed test          # the Test feed (for the live demo)
    python -m pipeline.run --state data-branch  # CI: keep state in the data branch checkout

The state folder holds what must survive between runs: the last good schedule,
the bulletin hash, and the bulletin archive. Locally it is the project folder.
"""
import argparse
import os
from pathlib import Path

from . import fetch_calendar
from .config import ROOT


def main():
    parser = argparse.ArgumentParser(description='Update the site data.')
    parser.add_argument('--feed', choices=['production', 'test'],
                        default=os.environ.get('IOBOT_FEED') or 'production')
    parser.add_argument('--offline', action='store_true', help='use fixtures instead of the network')
    parser.add_argument('--state', type=Path, default=ROOT, help='folder for state/ and archive/')
    args = parser.parse_args()

    fetch_calendar.run(args.state, args.feed, args.offline)


if __name__ == '__main__':
    main()
