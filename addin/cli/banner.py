"""The branded A/addin ASCII banner.

Per spec §4.4. The `presented by tanyewhong.com` line was deliberately
omitted from the terminal banner per Section 4 amendments — that line
lives on the marketing site footer and dashboard About page only.
"""

from __future__ import annotations

import os

# Four-line banner; pure ASCII (the box-drawing characters use Unicode but are
# universally rendered on modern terminals).
BANNER = """\
   ╱╲
  ╱  ╲   A/addin 2.0
  ╲  ╱   local-first autonomous operator
   ╲╱
"""


def get_banner() -> str:
    """Return the active banner.

    Honors `ADDIN_BANNER=upstream` as a debug escape hatch so a maintainer
    diagnosing a merge issue can side-by-side the addin banner against
    upstream's. Falls back silently to the addin banner if the upstream
    banner module isn't importable (e.g., during early bootstrap).
    """
    if os.environ.get("ADDIN_BANNER") == "upstream":
        try:
            from addin.cli.banner_upstream import BANNER as UPSTREAM_BANNER
            return UPSTREAM_BANNER
        except ImportError:
            pass
    return BANNER
