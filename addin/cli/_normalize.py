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
