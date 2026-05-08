"""`addin nudge` CLI subcommand (Phase 2b).

Currently exposes one verb:

    addin nudge add "<text>" [--cmd <suggested_command>]

Adds a pending nudge to ~/.hermes/curator/nudges.json. The dashboard
Evolve panel will surface it for capture or dismissal.

Future verbs (Phase 2c+): list, capture, dismiss — for parity with the
dashboard. Not in v2.b.
"""

from __future__ import annotations

import argparse
import sys
from typing import Sequence

from addin import nudges as nudges_mod


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="addin nudge")
    sub = parser.add_subparsers(dest="verb", required=True)

    add_p = sub.add_parser("add", help="add a pending nudge")
    add_p.add_argument("text", help="observation copy shown in the Evolve panel")
    add_p.add_argument(
        "--cmd",
        dest="suggested_command",
        default=None,
        help="optional shell command suggestion attached to the nudge",
    )

    return parser


def main(argv: Sequence[str] | None = None) -> int:
    args = _build_parser().parse_args(list(argv) if argv is not None else None)
    if args.verb == "add":
        n = nudges_mod.add(text=args.text, suggested_command=args.suggested_command)
        print(f"created nudge {n.id}: {n.text}")
        return 0
    return 2


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
