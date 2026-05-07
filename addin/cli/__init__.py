"""The `addin` console-script entry point.

A thin wrapper that normalizes argv and env so upstream `hermes_cli` sees
its expected names, then delegates to upstream's main(). The seam is at
the CLI boundary; everything below is upstream-as-is.

Spec §4.
"""

from __future__ import annotations

import os
import sys

from addin.cli._normalize import (
    alias_addin_env_vars,
    preserve_argv0_and_normalize,
)


def main() -> int:
    """Entry point registered as the `addin` console script.

    Returns:
        The exit code from upstream's main(). Returning rather than
        sys.exit-ing lets the entry-point shim handle the exit cleanly.
    """
    preserve_argv0_and_normalize(sys.argv, os.environ)
    alias_addin_env_vars(os.environ)

    # Defer import to here so the heavy upstream module is loaded only
    # after env normalization (in case upstream reads HERMES_* eagerly).
    from hermes_cli.main import main as hermes_main

    return hermes_main()


if __name__ == "__main__":
    sys.exit(main() or 0)
