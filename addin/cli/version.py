"""addin --version formatter."""

from __future__ import annotations

import os
import platform
from pathlib import Path


def format_version(
    *,
    addin_version: str,
    upstream_version: str,
    overlay_sha: str,
) -> str:
    """Render the multi-line `addin --version` output.

    Args:
        addin_version: The full A/addin version string (e.g. "2.0.1+addin.0").
        upstream_version: The hermes-agent version we're built on.
        overlay_sha: Short git SHA of the addin overlay HEAD at install time.

    Returns:
        A multi-line string suitable for printing directly to stdout.
    """
    home_str = os.environ.get("HERMES_HOME") or str(Path.home() / ".hermes")
    home = Path(home_str)
    if home.is_symlink():
        target = home.resolve()
        home_line = f"home: {home} -> {target}"
    else:
        home_line = f"home: {home}"

    return "\n".join([
        f"A/addin {addin_version} (Aladdin)",
        f"upstream: hermes-agent {upstream_version}",
        f"overlay-commit: {overlay_sha}",
        f"python: {platform.python_version()}",
        home_line,
    ])
