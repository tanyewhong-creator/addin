"""Pure-Python helpers used by the addin CLI wrapper.

Kept separate from cli/__init__.py so it can be unit-tested without
importing upstream's hermes_cli (which has heavy side effects on import).
"""

from __future__ import annotations

from typing import MutableMapping


def alias_addin_env_vars(env: MutableMapping[str, str]) -> None:
    """Mirror every ADDIN_<SUFFIX> entry onto HERMES_<SUFFIX>, in-place.

    Uses set-don't-override semantics: an existing HERMES_<SUFFIX> entry is
    preserved (so a user pinning the upstream form keeps their override).
    Entries with empty suffix (the literal key 'ADDIN_') are skipped.

    Args:
        env: The environment mapping to mutate. Typically `os.environ`.
    """
    for key in list(env.keys()):
        if not key.startswith("ADDIN_"):
            continue
        suffix = key[len("ADDIN_"):]
        if not suffix:
            continue
        env.setdefault("HERMES_" + suffix, env[key])


import os.path
from typing import MutableSequence


def preserve_argv0_and_normalize(
    argv: MutableSequence[str],
    env: MutableMapping[str, str],
) -> None:
    """Record the original argv[0] and normalize it to 'hermes'.

    Captures the basename of `argv[0]` into `ADDIN_ORIGINAL_ARGV0`
    (set-don't-override) so telemetry, shell completion, and debugging
    can reach for the original invocation form. Then rewrites `argv[0]`
    in place to "hermes" so upstream's hermes_cli sees its expected name
    regardless of how the user invoked the wrapper.

    Args:
        argv: A mutable sequence (usually `sys.argv`) whose first
            element is rewritten in place.
        env: The environment mapping to record into.
    """
    original = os.path.basename(argv[0]) if argv else ""
    env.setdefault("ADDIN_ORIGINAL_ARGV0", original)
    if argv:
        argv[0] = "hermes"
