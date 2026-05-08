"""The `addin` console-script entry point.

A thin wrapper that normalizes argv and env so upstream `hermes_cli` sees
its expected names, then delegates to upstream's main(). The seam is at
the CLI boundary; everything below is upstream-as-is.

Spec §4.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from addin.cli._normalize import (
    alias_addin_env_vars,
    preserve_argv0_and_normalize,
)


def _set_web_dist_default() -> None:
    """Point upstream's dashboard at web-addin/dist/ unless HERMES_WEB_DIST is preset.

    Located at <repo_root>/web-addin/dist/ where <repo_root> is the parent
    of the addin/ package directory. This honors the user's explicit
    HERMES_WEB_DIST override.
    """
    if "HERMES_WEB_DIST" in os.environ:
        return
    package_dir = Path(__file__).resolve().parent.parent  # addin/
    repo_root = package_dir.parent                          # repo root
    candidate = repo_root / "web-addin" / "dist"
    if candidate.is_dir():
        os.environ["HERMES_WEB_DIST"] = str(candidate)


# ADDIN-OVERLAY-BEGIN: addin-owned subcommands intercepted before hermes_cli
_ADDIN_SUBCOMMANDS = {"nudge"}
# ADDIN-OVERLAY-END


def main() -> int:
    """Entry point registered as the `addin` console script.

    Returns:
        The exit code from upstream's main(). Returning rather than
        sys.exit-ing lets the entry-point shim handle the exit cleanly.
    """
    preserve_argv0_and_normalize(sys.argv, os.environ)
    alias_addin_env_vars(os.environ)
    _set_web_dist_default()

    # ADDIN-OVERLAY-BEGIN: intercept addin-owned subcommands before hermes_cli
    # sys.argv[0] has been rewritten to "hermes" by preserve_argv0_and_normalize;
    # sys.argv[1] is the subcommand (if any).
    subcommand = sys.argv[1] if len(sys.argv) > 1 else None
    if subcommand in _ADDIN_SUBCOMMANDS:
        if subcommand == "nudge":
            from addin.cli.nudge import main as nudge_main
            return nudge_main(sys.argv[2:])
    # ADDIN-OVERLAY-END

    # Defer import to here so the heavy upstream module is loaded only
    # after env normalization (in case upstream reads HERMES_* eagerly).
    from hermes_cli.main import main as hermes_main

    return hermes_main()


if __name__ == "__main__":
    sys.exit(main() or 0)
